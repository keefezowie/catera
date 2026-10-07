import "react-native-url-polyfill/auto";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { router } from "expo-router";
import {
  type Actor,
  type Offer,
  type Locale,
  errorLabel,
} from "@catera/domain";
import { signInNative, nativeReturnPath } from "./auth";
import { runtime } from "./runtime";
// One Supabase client and API for the whole app: the old screens share the new
// runtime, so a sign-in or token refresh on either side is seen by both.
export const apiBase = runtime.apiBase;
export const supabase = runtime.supabase;
export const nativeApi = runtime.api;
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
type Value = {
  actor: Actor | null;
  offers: Offer[];
  demo: boolean;
  ready: boolean;
  error: string;
  locale: Locale;
  t: (id: string, en: string) => string;
  area: string;
  setArea: (s: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  revision: number;
  refresh: () => Promise<void>;
  command: <T = Record<string, unknown>>(
    action: string,
    payload: unknown,
  ) => Promise<T>;
  login: (phone: string, token: string, name: string) => Promise<Actor>;
  passwordLogin: (email: string, password: string) => Promise<Actor>;
  demoLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setLocale: (l: Locale) => void;
  enablePush: () => Promise<void>;
};
const Context = createContext<Value>(null!);
export function NativeProvider({
  children,
  routeNotifications = true,
}: {
  children: ReactNode;
  /** False while the shared MobileProvider owns push routing (customer app shell). */
  routeNotifications?: boolean;
}) {
  const [actor, setActor] = useState<Actor | null>(null),
    [offers, setOffers] = useState<Offer[]>([]),
    [demo, setDemo] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [locale, setLocaleState] = useState<Locale>("id"),
    [area, setAreaState] = useState(""),
    [compare, setCompare] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const requests = useRef(new Map<string, string>());
  const sessionGeneration = useRef(0);
  const refreshGeneration = useRef(0);
  const lastNotification = useRef("");
  const refresh = useCallback(async () => {
    const session = sessionGeneration.current;
    const request = ++refreshGeneration.current;
    try {
      if (!apiBase) throw new Error("NOT_CONFIGURED");
      const [catalogResult, meResult] = await Promise.allSettled([
        nativeApi.catalog("?limit=100"),
        nativeApi.me(),
      ]);
      if (
        session !== sessionGeneration.current ||
        request !== refreshGeneration.current
      )
        return;
      if (meResult.status === "fulfilled") {
        setActor(meResult.value.actor);
        setDemo(meResult.value.demo);
      }
      if (catalogResult.status === "fulfilled")
        setOffers(catalogResult.value.items);
      if (meResult.status === "rejected") {
        if (
          ["UNAUTHORIZED", "FORBIDDEN"].includes(
            meResult.reason?.code || meResult.reason?.message,
          )
        )
          setActor(null);
        throw meResult.reason;
      }
      if (catalogResult.status === "rejected") throw catalogResult.reason;
      setError("");
      setRevision((r) => r + 1);
    } catch (e) {
      if (
        session !== sessionGeneration.current ||
        request !== refreshGeneration.current
      )
        return;
      setError(
        errorLabel((e as Error).message, locale) ||
          (locale === "en"
            ? "Unable to connect. Check your connection and try again."
            : "Tidak dapat terhubung. Periksa koneksi dan coba lagi."),
      );
    } finally {
      if (
        session === sessionGeneration.current &&
        request === refreshGeneration.current
      )
        setReady(true);
    }
  }, [locale]);
  const command = useCallback(
    async <T,>(action: string, payload: unknown): Promise<T> => {
      const generation = sessionGeneration.current;
      const key = generation + action + JSON.stringify(payload),
        id = requests.current.get(key) || Crypto.randomUUID();
      requests.current.set(key, id);
      const result = await nativeApi.command<T>(action, payload, id);
      requests.current.delete(key);
      if (generation !== sessionGeneration.current)
        throw new Error("UNAUTHORIZED");
      setRevision((r) => r + 1);
      return result;
    },
    [],
  );
  useEffect(() => {
    const auth = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionGeneration.current += 1;
        requests.current.clear();
        setActor(null);
        setRevision((r) => r + 1);
      }
      // Leave the Supabase callback before reading the session again.
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT")
        setTimeout(() => void refresh(), 0);
    });
    return () => {
      auth?.data.subscription.unsubscribe();
    };
  }, [refresh]);
  useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync("catera.locale"),
      SecureStore.getItemAsync("catera.area"),
      SecureStore.getItemAsync("catera.compare"),
    ]).then(([l, a, c]) => {
      setLocaleState(l === "en" ? "en" : "id");
      setAreaState(a || "");
      try {
        setCompare(JSON.parse(c || "[]"));
      } catch {}
    });
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase?.auth.startAutoRefresh();
        refresh();
      } else supabase?.auth.stopAutoRefresh();
    });
    const push = Notifications.addNotificationReceivedListener(() =>
      setRevision((r) => r + 1),
    );
    const handleResponse = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const key = r.notification.request.identifier + ":" + r.actionIdentifier;
      if (lastNotification.current === key) return;
      const href = r?.notification.request.content.data?.href;
      if (typeof href === "string") {
        lastNotification.current = key;
        router.push(nativeLink(href) as never);
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    const response = routeNotifications
      ? Notifications.addNotificationResponseReceivedListener(handleResponse)
      : null;
    if (routeNotifications)
      void Notifications.getLastNotificationResponseAsync().then(handleResponse);
    return () => {
      sub.remove();
      push.remove();
      response?.remove();
    };
  }, [refresh, routeNotifications]);
  useEffect(() => {
    if (!supabase || demo || !actor) return;
    const client = supabase;
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
  }, [actor?.id, demo]);
  async function login(phone: string, token: string, name: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const r = await nativeApi.request<{
      session: { access_token: string; refresh_token: string };
    }>("auth/verify", { phone, token, name });
    const { error } = await supabase.auth.setSession(r.session);
    if (error) throw error;
    await SecureStore.deleteItemAsync("catera.demo.token");
    const me = await nativeApi.me();
    if (!me.actor) throw new Error("UNAUTHORIZED");
    setActor(me.actor);
    await refresh();
    return me.actor;
  }
  async function passwordLogin(email: string, password: string) {
    if (!supabase) throw new Error("NOT_CONFIGURED");
    const signedIn = await signInNative(
      supabase,
      email,
      password,
      Crypto.randomUUID(),
    );
    await SecureStore.deleteItemAsync("catera.demo.token");
    setActor(signedIn);
    await refresh();
    return signedIn;
  }
  async function demoLogin() {
    const r = await nativeApi.request<{ token: string }>("auth/demo", {
      role: "customer",
    });
    await supabase?.auth.signOut({ scope: "local" });
    await SecureStore.setItemAsync("catera.demo.token", r.token);
    await refresh();
  }
  async function logout() {
    sessionGeneration.current += 1;
    requests.current.clear();
    await SecureStore.deleteItemAsync("catera.demo.token");
    const result = await supabase?.auth.signOut({ scope: "local" });
    if (result?.error) throw result.error;
    setActor(null);
    setRevision((r) => r + 1);
    router.replace("/discover");
  }
  function setArea(v: string) {
    setAreaState(v);
    SecureStore.setItemAsync("catera.area", v);
  }
  function setLocale(v: Locale) {
    setLocaleState(v);
    SecureStore.setItemAsync("catera.locale", v);
  }
  function toggleCompare(id: string) {
    setCompare((v) => {
      const next = v.includes(id)
        ? v.filter((x) => x !== id)
        : v.length < 3
          ? [...v, id]
          : v;
      SecureStore.setItemAsync("catera.compare", JSON.stringify(next));
      return next;
    });
  }
  async function enablePush() {
    const translate = (id: string, en: string) => (locale === "id" ? id : en);
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId)
      throw new Error(
        translate(
          "Push memerlukan development build dan EAS project yang dikonfigurasi.",
          "Push notifications require a configured development build and EAS project.",
        ),
      );
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: translate("Pengantaran & bantuan", "Deliveries & support"),
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      throw new Error(
        translate(
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
        actor,
        offers,
        demo,
        ready,
        error,
        locale,
        t: (id, en) => (locale === "id" ? id : en),
        area,
        setArea,
        compare,
        toggleCompare,
        revision,
        refresh,
        command,
        login,
        passwordLogin,
        demoLogin,
        logout,
        setLocale,
        enablePush,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useNative = () => useContext(Context);
export const nativeLink = (href: string) => {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(href)
  )
    return "/";
  if (href === "/#packages") return "/discover";
  if (href === "/#how-it-works") return "/discover?section=how-it-works";
  if (href === "/?view=list#how-it-works")
    return "/discover?view=list&section=how-it-works";
  return nativeReturnPath(
    href
      .replace(/^\/deliveries\//, "/delivery/")
      .replace(/^\/packages\//, "/package/")
      .replace(/^\/home$/, "/"),
  );
};
export function useData<T>(key: string, loader: () => Promise<T>) {
  const { revision, locale, actor } = useNative();
  const identity = (actor?.id || "guest") + ":" + key;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: identity, data: null, error: "", loading: true });
  const load = useRef(loader);
  load.current = loader;
  const generation = useRef(0);
  const currentKey = useRef(identity);
  currentKey.current = identity;
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setState((s) => ({
      key: identity,
      data: s.key === identity ? s.data : null,
      error: "",
      loading: true,
    }));
    try {
      const data = await load.current();
      if (request === generation.current && currentKey.current === identity)
        setState({ key: identity, data, error: "", loading: false });
    } catch (e) {
      if (request === generation.current && currentKey.current === identity)
        setState((s) => ({
          ...s,
          loading: false,
          error:
            errorLabel(
              (e as { code?: string }).code || (e as Error).message,
              locale,
            ) ||
            (locale === "en"
              ? "Unable to load. Check your connection and try again."
              : "Tidak dapat memuat. Periksa koneksi dan coba lagi."),
        }));
    }
  }, [identity, locale]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload, revision]);
  const active =
    state.key === identity ? state : { data: null, error: "", loading: true };
  return {
    ...active,
    reload,
    stale: !!active.error && active.data !== null,
    canWrite: active.data !== null && !active.error && !active.loading,
  };
}
