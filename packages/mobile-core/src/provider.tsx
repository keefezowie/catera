import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import { errorLabel, type Actor, type Locale } from "@catera/domain";
import type { MobileRuntime } from "./runtime";

Notifications.setNotificationHandler({
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
  ready: boolean;
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

/** Session, commands, live refresh and push routing shared by the Catera apps. */
export function MobileProvider({
  runtime,
  linkMapper,
  children,
}: {
  runtime: MobileRuntime;
  /** Maps a server href (e.g. "/seller/schedule?date=…") to an app route. */
  linkMapper: (href: string) => string;
  children: ReactNode;
}) {
  const [actor, setActor] = useState<Actor | null>(null),
    [demo, setDemo] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [locale, setLocaleState] = useState<Locale>("id"),
    [revision, setRevision] = useState(0);
  const requests = useRef(new Map<string, string>());
  const sessionGeneration = useRef(0);
  const refreshGeneration = useRef(0);
  const lastNotification = useRef("");
  const mapLink = useRef(linkMapper);
  mapLink.current = linkMapper;

  const refresh = useCallback(async () => {
    const session = sessionGeneration.current;
    const request = ++refreshGeneration.current;
    const current = () =>
      session === sessionGeneration.current && request === refreshGeneration.current;
    try {
      if (!runtime.apiBase) throw new Error("NOT_CONFIGURED");
      const me = await runtime.api.me();
      if (!current()) return;
      setActor(me.actor);
      setDemo(me.demo);
      setError("");
      setRevision((r) => r + 1);
    } catch (e) {
      if (!current()) return;
      const code = (e as { code?: string }).code || (e as Error).message;
      if (["UNAUTHORIZED", "FORBIDDEN"].includes(code)) setActor(null);
      setError(
        errorLabel(code, locale) ||
          translator(locale)(
            "Tidak dapat terhubung. Periksa koneksi dan coba lagi.",
            "Unable to connect. Check your connection and try again.",
          ),
      );
    } finally {
      if (current()) setReady(true);
    }
  }, [runtime, locale]);

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
        sessionGeneration.current += 1;
        requests.current.clear();
        setActor(null);
        setRevision((r) => r + 1);
      }
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT")
        setTimeout(() => void refresh(), 0);
    });
    return () => auth?.data.subscription.unsubscribe();
  }, [runtime, refresh]);

  useEffect(() => {
    void SecureStore.getItemAsync(runtime.storageKey("locale")).then((l) =>
      setLocaleState(l === "en" ? "en" : "id"),
    );
    void refresh();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        runtime.supabase?.auth.startAutoRefresh();
        void refresh();
      } else runtime.supabase?.auth.stopAutoRefresh();
    });
    const received = Notifications.addNotificationReceivedListener(() =>
      setRevision((r) => r + 1),
    );
    const handleResponse = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const key = r.notification.request.identifier + ":" + r.actionIdentifier;
      if (lastNotification.current === key) return;
      const href = r.notification.request.content.data?.href;
      if (typeof href === "string") {
        lastNotification.current = key;
        router.push(mapLink.current(href) as never);
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    const response = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then(handleResponse);
    return () => {
      appState.remove();
      received.remove();
      response.remove();
    };
  }, [runtime, refresh]);

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
    setActor(next);
    await refresh();
  }

  async function logout() {
    sessionGeneration.current += 1;
    requests.current.clear();
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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId)
      throw new Error(
        t(
          "Push memerlukan development build dan EAS project yang dikonfigurasi.",
          "Push notifications require a configured development build and EAS project.",
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
        error,
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
