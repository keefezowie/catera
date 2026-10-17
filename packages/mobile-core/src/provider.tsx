import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type * as NotificationTypes from "expo-notifications";
import Constants from "expo-constants";
import { Notifications, pushAvailableNow, unregisterThisPhone } from "./notifications";
import { router } from "expo-router";
import { errorLabel, type Actor, type Locale, type UsageName } from "@catera/domain";
import type { MobileRuntime } from "./runtime";
import { createOpenCounter, sendUsage } from "./usage";

/** How long sign-out waits for this phone's push token to come off the account before it signs out anyway. */
const RELEASE_PUSH_MS = 3000;

/** Waits for `work` to settle, at most `ms`; its outcome, a rejection included, is ignored. */
function settleWithin(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work.then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type MobileContextValue = {
  runtime: MobileRuntime;
  actor: Actor | null;
  demo: boolean;
  /**
   * An actor or a definite signed-out answer is known, so screens can render. With a stored actor and token it turns
   * true at boot, before `me()` answers; without a stored session it waits for `me()`.
   */
  ready: boolean;
  /** The stored actor, token and locale have been read from the phone (or the read failed). */
  booted: boolean;
  /** A `me()` is in flight. */
  refreshing: boolean;
  error: string;
  locale: Locale;
  t: (id: string, en: string) => string;
  setLocale: (l: Locale) => void;
  revision: number;
  refresh: () => Promise<void>;
  command: <T = Record<string, unknown>>(action: string, payload: unknown) => Promise<T>;
  signedIn: (actor: Actor) => Promise<void>;
  logout: () => Promise<void>;
  enablePush: (channelName: string) => Promise<void>;
};

const Context = createContext<MobileContextValue>(null!);

export const translator = (locale: Locale) => (id: string, en: string) =>
  locale === "id" ? id : en;

/** The failure line for a session read: the code's own label, or the connection line. */
function sessionError(code: string, locale: Locale): string {
  if (!code) return "";
  return (
    errorLabel(code, locale) ||
    translator(locale)(
      "Belum bisa terhubung. Cek koneksi lalu coba lagi.",
      "Can't connect. Check your connection and try again.",
    )
  );
}

function parseActor(saved: string | null): Actor | null {
  if (!saved) return null;
  try {
    return JSON.parse(saved) as Actor;
  } catch {
    return null;
  }
}

/** Session, commands, live refresh and push routing shared by the Catera apps. */
export function MobileProvider({
  runtime,
  linkMapper,
  openLink,
  onSignedOut,
  children,
}: {
  runtime: MobileRuntime;
  /** Maps a server href (e.g. "/seller/schedule?date=…") to an app route. */
  linkMapper: (href: string) => string;
  /** Opens the mapped route; an app with a stack per tab selects a tab for a tab root instead of pushing it. Default: push. */
  openLink?: (path: string) => void;
  /**
   * Forgets what this phone kept for the account (the app's cached first screen) whenever the session ends: a logout,
   * a sign-out event, or the server answering that the session is gone. Failures are ignored.
   */
  onSignedOut?: () => Promise<void> | void;
  children: ReactNode;
}) {
  const [actor, setActor] = useState<Actor | null>(null),
    [demo, setDemo] = useState(false),
    [ready, setReady] = useState(false),
    [booted, setBooted] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [errorCode, setErrorCode] = useState(""),
    [locale, setLocaleState] = useState<Locale>("id"),
    [revision, setRevision] = useState(0);
  const requests = useRef(new Map<string, string>());
  const sessionGeneration = useRef(0);
  const refreshGeneration = useRef(0);
  const lastNotification = useRef("");
  const mapLink = useRef(linkMapper);
  mapLink.current = linkMapper;
  const open = useRef(openLink);
  open.current = openLink;
  const forget = useRef(onSignedOut);
  forget.current = onSignedOut;
  const actorRef = useRef(actor);
  actorRef.current = actor;
  // How many me() reads are in flight, and whether one has answered yet (a stored actor never overrides an answer).
  const inFlight = useRef(0);
  const answered = useRef(false);
  // The actor painted from the phone at boot, until the first answer: an unchanged answer does not reload every screen.
  const bootActor = useRef<Actor | null>(null);
  const countOpen = useMemo(() => createOpenCounter(runtime), [runtime]);

  const signedOutLocally = useCallback(() => {
    void SecureStore.deleteItemAsync(runtime.storageKey("actor")).catch(() => {});
    void Promise.resolve()
      .then(() => forget.current?.())
      .catch(() => {});
  }, [runtime]);

  // The identity of `refresh` depends on the runtime only: the locale is read at render time, so loading a stored
  // English choice never re-runs the mount effect below (which would start a second me() and re-add every listener).
  const refresh = useCallback(async () => {
    const session = sessionGeneration.current;
    const request = ++refreshGeneration.current;
    const current = () =>
      session === sessionGeneration.current && request === refreshGeneration.current;
    inFlight.current += 1;
    setRefreshing(true);
    try {
      if (!runtime.apiBase) throw new Error("NOT_CONFIGURED");
      const me = await runtime.api.me();
      if (!current()) return;
      answered.current = true;
      const painted = bootActor.current;
      bootActor.current = null;
      setActor(me.actor);
      setDemo(me.demo);
      // Remembered so the next launch paints at once, and so a kitchen without signal still opens on its last day.
      if (me.actor) {
        void SecureStore.setItemAsync(runtime.storageKey("actor"), JSON.stringify(me.actor)).catch(() => {});
        // The open is counted only now: an account painted from the phone at boot is not yet confirmed by the server.
        void countOpen(me.actor);
      } else signedOutLocally();
      setErrorCode("");
      // Screens painted from the stored actor already read for this account; only a different answer reloads them.
      const unchanged = !!painted && !!me.actor && painted.id === me.actor.id && painted.role === me.actor.role;
      if (!unchanged) setRevision((r) => r + 1);
    } catch (e) {
      if (!current()) return;
      answered.current = true;
      bootActor.current = null;
      const code = (e as { code?: string }).code || (e as Error).message;
      if (["UNAUTHORIZED", "FORBIDDEN"].includes(code)) {
        setActor(null);
        signedOutLocally();
      } else {
        // Offline: reopen the last account, but only while this device still holds a session.
        const [saved, token] = await Promise.all([
          SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null),
          runtime.token().catch(() => null),
        ]);
        if (!current()) return;
        const stored = token ? parseActor(saved) : null;
        if (stored) setActor((a) => a ?? stored);
      }
      setErrorCode(code || "NETWORK");
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setRefreshing(false);
      if (current()) setReady(true);
    }
  }, [runtime, signedOutLocally, countOpen]);

  const command = useCallback(
    async <T,>(action: string, payload: unknown): Promise<T> => {
      const generation = sessionGeneration.current;
      // Retrying the same command reuses its request id, so the server applies it once.
      const key = generation + action + JSON.stringify(payload),
        id = requests.current.get(key) || Crypto.randomUUID();
      requests.current.set(key, id);
      const result = await runtime.api.command<T>(action, payload, id);
      requests.current.delete(key);
      if (generation !== sessionGeneration.current) throw new Error("UNAUTHORIZED");
      setRevision((r) => r + 1);
      return result;
    },
    [runtime],
  );

  useEffect(() => {
    const auth = runtime.supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        signedOutLocally();
        sessionGeneration.current += 1;
        requests.current.clear();
        bootActor.current = null;
        setActor(null);
        setRevision((r) => r + 1);
      }
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT")
        setTimeout(() => void refresh(), 0);
    });
    return () => auth?.data.subscription.unsubscribe();
  }, [runtime, refresh, signedOutLocally]);

  useEffect(() => {
    let live = true;
    const session = sessionGeneration.current;
    // Local reads only: the stored account, its token and the language. With an account and a token the app paints
    // at once from what the phone holds; me() below confirms or replaces it.
    void Promise.all([
      SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null),
      runtime.token().catch(() => null),
      SecureStore.getItemAsync(runtime.storageKey("locale")).catch(() => null),
    ]).then(([saved, token, storedLocale]) => {
      if (!live) return;
      setLocaleState((l) => (storedLocale === "en" ? "en" : storedLocale === "id" ? "id" : l));
      const stored = token ? parseActor(saved) : null;
      if (stored && !answered.current && session === sessionGeneration.current) {
        bootActor.current = stored;
        setActor((a) => a ?? stored);
        setReady(true);
      }
      setBooted(true);
    });
    // The one launch read of the session.
    void refresh();
    let previous: AppStateStatus | null = AppState.currentState;
    const appState = AppState.addEventListener("change", (state) => {
      const was = previous;
      previous = state;
      if (state === "active") {
        runtime.supabase?.auth.startAutoRefresh();
        // Only a return from the background reads again; the "active" a launch reports, or one while a read is still
        // running, would only repeat it.
        if ((was === "background" || was === "inactive") && inFlight.current === 0) void refresh();
        // Before the first answer the actor may be only the one painted from the phone; refresh() counts it once confirmed.
        if (answered.current) void countOpen(actorRef.current);
      } else runtime.supabase?.auth.stopAutoRefresh();
    });
    const received = Notifications?.addNotificationReceivedListener(() =>
      setRevision((r) => r + 1),
    );
    const handleResponse = (r: NotificationTypes.NotificationResponse | null) => {
      if (!r) return;
      const key = r.notification.request.identifier + ":" + r.actionIdentifier;
      if (lastNotification.current === key) return;
      const href = r.notification.request.content.data?.href;
      if (typeof href === "string") {
        lastNotification.current = key;
        const path = mapLink.current(href);
        if (open.current) open.current(path);
        else router.push(path as never);
        void Notifications?.clearLastNotificationResponseAsync();
      }
    };
    const response = Notifications?.addNotificationResponseReceivedListener(handleResponse);
    void Notifications?.getLastNotificationResponseAsync().then(handleResponse);
    return () => {
      live = false;
      appState.remove();
      received?.remove();
      response?.remove();
    };
  }, [runtime, refresh, countOpen]);

  useEffect(() => {
    const client = runtime.supabase;
    if (!client || demo || !actor) return;
    const channel = client
      .channel(`catera:${actor.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "catera_v1_events",
          filter: `user_id=eq.${actor.id}`,
        },
        () => setRevision((v) => v + 1),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [runtime, actor?.id, demo]);

  async function signedIn(next: Actor) {
    bootActor.current = null;
    setActor(next);
    await refresh();
  }

  /**
   * Signs this phone out: Pengaturan's Keluar in both apps and Dapur's customer-account gate. First, while the session
   * still exists, this phone's push token comes off the leaving account (`device.unregister`) and its switch flag is
   * forgotten, so the next person holding the phone never gets that account's notifications. That step is best effort:
   * skipped in a build without push (Expo Go), bounded by `RELEASE_PUSH_MS`, and every failure (offline, a token read
   * that never answers, a refusal) is ignored, so it can delay sign-out by at most that long and never stop it.
   */
  async function logout() {
    const leaving = actorRef.current;
    if (leaving && pushAvailableNow()) {
      const send = (action: string, payload: unknown) => runtime.api.command(action, payload, Crypto.randomUUID());
      await settleWithin(unregisterThisPhone(send, runtime.storageKey(`push.${leaving.id}`)), RELEASE_PUSH_MS);
    }
    sessionGeneration.current += 1;
    requests.current.clear();
    bootActor.current = null;
    await SecureStore.deleteItemAsync(runtime.storageKey("actor"));
    await Promise.resolve()
      .then(() => forget.current?.())
      .catch(() => {});
    await runtime.signOut();
    setActor(null);
    setRevision((r) => r + 1);
  }

  function setLocale(v: Locale) {
    setLocaleState(v);
    void SecureStore.setItemAsync(runtime.storageKey("locale"), v);
  }

  async function enablePush(channelName: string) {
    const t = translator(locale);
    if (!Notifications)
      throw new Error(
        t(
          "Notifikasi hanya tersedia di aplikasi yang dipasang.",
          "Notifications are only available in the installed app.",
        ),
      );
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId)
      throw new Error(
        t(
          "Notifikasi belum bisa dipakai di versi aplikasi ini.",
          "Notifications aren't available in this version of the app.",
        ),
      );
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: channelName,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      throw new Error(
        t(
          "Izin notifikasi belum diberikan. Ubah dari pengaturan perangkat.",
          "Notification permission was not granted. Change it in device settings.",
        ),
      );
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await command("device.register", { token: data });
  }

  return (
    <Context.Provider
      value={{
        runtime,
        actor,
        demo,
        ready,
        booted,
        refreshing,
        error: sessionError(errorCode, locale),
        locale,
        t: translator(locale),
        setLocale,
        revision,
        refresh,
        command,
        signedIn,
        logout,
        enablePush,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useMobile = () => useContext(Context);

/**
 * Returns the function that counts a usage event. Its identity never changes while the runtime
 * stays, so an effect that depends on it does not fire again when the session refreshes.
 * Calling it never throws and never waits; without a signed-in actor it does nothing.
 */
export function useTrack(): (name: UsageName) => void {
  const { runtime, actor } = useMobile();
  const actorRef = useRef(actor);
  actorRef.current = actor;
  return useCallback((name: UsageName) => sendUsage(runtime, actorRef.current, name), [runtime]);
}
