import {
  createContext,
  useCallback,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type * as NotificationTypes from "expo-notifications";
import Constants from "expo-constants";
import { Notifications, PUSH_OWNER, pushAvailableNow, releasePreviousAccount, unregisterThisPhone } from "./notifications";
import { router } from "expo-router";
import { ApiError } from "@catera/api-client";
import { errorLabel, type Actor, type Locale, type UsageName } from "@catera/domain";
import { settleWithin, type MobileRuntime } from "./runtime";
import { createOpenCounter, sendUsage } from "./usage";

/** How long sign-out waits for this phone's push token to come off the account before it signs out anyway. */
const RELEASE_PUSH_MS = 3000;

/** How long a command whose outcome is unknown keeps its request id for a retry. */
const RETRY_ID_MS = 2 * 60 * 1000;

/**
 * The server answered and refused, so nothing was applied and a later try is a new intent. Everything else (no signal,
 * a timeout, an unreadable answer) may have committed, and the retry must carry the same id to apply it once.
 */
const refused = (e: unknown) =>
  e instanceof ApiError && !["REQUEST_TIMEOUT", "INVALID_API_RESPONSE", "REQUEST_FAILED"].includes(e.code);

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
  error: string;
  locale: Locale;
  t: (id: string, en: string) => string;
  setLocale: (l: Locale) => void;
  revision: number;
  /**
   * Moves when the app returns from the background or the network comes back, at most once per `RESUME_THROTTLE`.
   * `useData` reloads quietly on it: only a screen that already shows data, and without `loading`.
   */
  resumed: number;
  refresh: () => Promise<void>;
  /**
   * Sends a command, then moves `revision` so every mounted `useData` reloads. `{ refresh: false }` skips that move,
   * for a command that repeats (a status poll) or runs in a loop: the caller reloads what it shows and calls
   * `invalidate()` once when the rest of the app should catch up.
   */
  command: <T = Record<string, unknown>>(
    action: string,
    payload: unknown,
    options?: { refresh?: boolean },
  ) => Promise<T>;
  /** Moves `revision` once: every mounted `useData` reloads. */
  invalidate: () => void;
  signedIn: (actor: Actor) => Promise<void>;
  logout: () => Promise<void>;
  enablePush: (channelName: string) => Promise<void>;
  /** `useData`'s shared reads. `epoch` moves after every command and sign-out: a read begun before it serves no one after. */
  reads: { epoch: number; inFlight: Map<string, Promise<unknown>> };
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

/** The shortest gap between two quiet refetches; a burst of app switches or a flapping network reloads once. */
export const RESUME_THROTTLE = 30_000;

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
    [errorCode, setErrorCode] = useState(""),
    [locale, setLocaleState] = useState<Locale>("id"),
    [revision, setRevision] = useState(0),
    [resumed, setResumed] = useState(0);
  const lastResume = useRef(0);
  // The last network report (null before the first). A return while offline leaves the slot to the reconnect.
  const connected = useRef<boolean | null>(null);
  const resume = useCallback(() => {
    if (connected.current === false) return;
    const now = Date.now();
    if (now - lastResume.current < RESUME_THROTTLE) return;
    lastResume.current = now;
    setResumed((n) => n + 1);
  }, []);
  const requests = useRef(new Map<string, { id: string; at: number }>());
  const reads = useRef<MobileContextValue["reads"]>({ epoch: 0, inFlight: new Map() }).current;
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
  // `quiet`: a return from the background, where screens reload through `resumed` instead; the revision moves only if
  // the answer names another account.
  const refresh = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    const session = sessionGeneration.current;
    const request = ++refreshGeneration.current;
    const current = () =>
      session === sessionGeneration.current && request === refreshGeneration.current;
    inFlight.current += 1;
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
        if (pushAvailableNow())
          void releasePreviousAccount(
            (action, payload) => runtime.api.command(action, payload, Crypto.randomUUID()),
            runtime.storageKey,
            me.actor.id,
          ).catch(() => undefined);
      } else signedOutLocally();
      setErrorCode("");
      // Screens painted from the stored actor already read for this account; only a different answer reloads them.
      const before = quiet ? actorRef.current : painted;
      const unchanged = !!before && !!me.actor && before.id === me.actor.id && before.role === me.actor.role;
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
        const [saved, held] = await Promise.all([
          SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null),
          runtime.hasSession().catch(() => false),
        ]);
        if (!current()) return;
        const stored = held ? parseActor(saved) : null;
        if (stored) setActor((a) => a ?? stored);
      }
      setErrorCode(code || "NETWORK");
    } finally {
      inFlight.current -= 1;
      if (current()) setReady(true);
    }
  }, [runtime, signedOutLocally, countOpen]);

  const command = useCallback(
    async <T,>(action: string, payload: unknown, options?: { refresh?: boolean }): Promise<T> => {
      const generation = sessionGeneration.current;
      const key = generation + action + JSON.stringify(payload),
        now = Date.now();
      for (const [k, kept] of requests.current) if (now - kept.at > RETRY_ID_MS) requests.current.delete(k);
      // Retrying the same command reuses its request id, so the server applies it once.
      const id = requests.current.get(key)?.id ?? Crypto.randomUUID();
      requests.current.set(key, { id, at: now });
      let result: T;
      try {
        result = await runtime.api.command<T>(action, payload, id);
      } catch (e) {
        if (refused(e)) requests.current.delete(key);
        else requests.current.set(key, { id, at: Date.now() });
        throw e;
      } finally {
        reads.epoch += 1;
      }
      requests.current.delete(key);
      if (generation !== sessionGeneration.current) throw new Error("UNAUTHORIZED");
      if (options?.refresh !== false) setRevision((r) => r + 1);
      return result;
    },
    [runtime, reads],
  );
  const invalidate = useCallback(() => setRevision((r) => r + 1), []);

  useEffect(() => {
    const auth = runtime.supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        signedOutLocally();
        sessionGeneration.current += 1;
        reads.epoch += 1;
        requests.current.clear();
        bootActor.current = null;
        setActor(null);
        setRevision((r) => r + 1);
      }
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT")
        setTimeout(() => void refresh(), 0);
    });
    return () => auth?.data.subscription.unsubscribe();
  }, [runtime, refresh, signedOutLocally, reads]);

  useEffect(() => {
    let live = true;
    const session = sessionGeneration.current;
    // Local reads only: the stored account, whether a session is held and the language. With an account and a session
    // the app paints at once from what the phone holds, however old its token; me() below confirms or replaces it.
    void Promise.all([
      SecureStore.getItemAsync(runtime.storageKey("actor")).catch(() => null),
      runtime.hasSession().catch(() => false),
      SecureStore.getItemAsync(runtime.storageKey("locale")).catch(() => null),
    ]).then(([saved, held, storedLocale]) => {
      if (!live) return;
      setLocaleState((l) => (storedLocale === "en" ? "en" : storedLocale === "id" ? "id" : l));
      const stored = held ? parseActor(saved) : null;
      if (stored && !answered.current && session === sessionGeneration.current) {
        bootActor.current = stored;
        setActor((a) => a ?? stored);
        setReady(true);
      }
      setBooted(true);
    });
    // The one launch read of the session.
    void refresh();
    let previous: AppStateStatus | null = (AppState.currentState as AppStateStatus | undefined) ?? null;
    const appState = AppState.addEventListener("change", (state) => {
      const was = previous;
      previous = state;
      if (state === "active") {
        runtime.supabase?.auth.startAutoRefresh();
        // Only a return from the background reads again; the "active" a launch reports, or one while a read is still
        // running, would only repeat it.
        if (was === "background" || was === "inactive") {
          if (inFlight.current === 0) void refresh({ quiet: true });
          resume();
        }
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
    // A network that comes back (offline to online, not the first report) reloads what is on screen, quietly.
    const network = NetInfo.addEventListener((state) => {
      const was = connected.current;
      connected.current = state.isConnected === true;
      if (was === false && connected.current) resume();
    });
    return () => {
      live = false;
      appState.remove();
      received?.remove();
      response?.remove();
      network();
    };
  }, [runtime, refresh, countOpen, resume]);

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

  const signedIn = useCallback(
    async (next: Actor) => {
      bootActor.current = null;
      setActor(next);
      await refresh();
    },
    [refresh],
  );

  /**
   * Signs this phone out: Pengaturan's Keluar in both apps and Dapur's customer-account gate. First, while the session
   * still exists, this phone's push token comes off the leaving account (`device.unregister`) and its switch flag is
   * forgotten, so the next person holding the phone never gets that account's notifications. That step is best effort:
   * skipped in a build without push (Expo Go), bounded by `RELEASE_PUSH_MS`, and every failure (offline, a token read
   * that never answers, a refusal) is ignored, so it can delay sign-out by at most that long and never stop it.
   */
  const logout = useCallback(async () => {
    const leaving = actorRef.current;
    if (leaving && pushAvailableNow()) {
      const send = (action: string, payload: unknown) => runtime.api.command(action, payload, Crypto.randomUUID());
      await settleWithin(
        unregisterThisPhone(send, runtime.storageKey(`push.${leaving.id}`), runtime.storageKey(PUSH_OWNER), leaving.id),
        RELEASE_PUSH_MS,
      );
    }
    sessionGeneration.current += 1;
    reads.epoch += 1;
    requests.current.clear();
    bootActor.current = null;
    await SecureStore.deleteItemAsync(runtime.storageKey("actor"));
    await Promise.resolve()
      .then(() => forget.current?.())
      .catch(() => {});
    await runtime.signOut();
    setActor(null);
    setRevision((r) => r + 1);
  }, [runtime, reads]);

  const setLocale = useCallback(
    (v: Locale) => {
      setLocaleState(v);
      void SecureStore.setItemAsync(runtime.storageKey("locale"), v);
    },
    [runtime],
  );

  const t = useMemo(() => translator(locale), [locale]);

  const enablePush = useCallback(
    async (channelName: string) => {
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
      // Channels exist on Android only; Jest compiles EXPO_OS to null, so "not iOS" keeps the test path.
      if (process.env.EXPO_OS !== "ios")
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
      const owner = actorRef.current?.id;
      if (owner) await SecureStore.setItemAsync(runtime.storageKey(PUSH_OWNER), owner).catch(() => undefined);
    },
    [runtime, t, command],
  );

  const value = useMemo<MobileContextValue>(
    () => ({
      runtime,
      actor,
      demo,
      ready,
      booted,
      error: sessionError(errorCode, locale),
      locale,
      t,
      setLocale,
      revision,
      resumed,
      refresh,
      command,
      invalidate,
      signedIn,
      logout,
      enablePush,
      reads,
    }),
    [
      runtime,
      actor,
      demo,
      ready,
      booted,
      errorCode,
      locale,
      t,
      setLocale,
      revision,
      resumed,
      refresh,
      command,
      invalidate,
      signedIn,
      logout,
      enablePush,
      reads,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useMobile = () => use(Context);

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
