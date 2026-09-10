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
import { createClient } from "@supabase/supabase-js";
import { createApi } from "@catera/api-client";
import { type Actor, type Offer, type Locale, errors } from "@catera/domain";
import { signInNative } from "./auth";
export const apiBase = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, v: string) => SecureStore.setItemAsync(key, v),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
const supabase =
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            storage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          },
        },
      )
    : null;
export const nativeApi = createApi(apiBase, async () => {
  const token = await SecureStore.getItemAsync("catera.demo.token");
  return (
    token ||
    (await supabase?.auth.getSession())?.data.session?.access_token ||
    null
  );
});
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
export function NativeProvider({ children }: { children: ReactNode }) {
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
  const refresh = useCallback(async () => {
    try {
      if (!apiBase) throw new Error("NOT_CONFIGURED");
      const [catalogResult, meResult] = await Promise.allSettled([
        nativeApi.catalog("?limit=100"),
        nativeApi.me(),
      ]);
      if (meResult.status === "fulfilled") {
        setActor(meResult.value.actor);
        setDemo(meResult.value.demo);
      }
      if (catalogResult.status === "fulfilled")
        setOffers(catalogResult.value.items);
      if (meResult.status === "rejected") throw meResult.reason;
      if (catalogResult.status === "rejected") throw catalogResult.reason;
      setError("");
      setRevision((r) => r + 1);
    } catch (e) {
      setError(
        errors[(e as Error).message] ||
          "Tidak dapat terhubung. Periksa koneksi dan coba lagi.",
      );
    } finally {
      setReady(true);
    }
  }, []);
  const command = useCallback(
    async <T,>(action: string, payload: unknown): Promise<T> => {
      const key = action + JSON.stringify(payload),
        id = requests.current.get(key) || Crypto.randomUUID();
      requests.current.set(key, id);
      const result = await nativeApi.command<T>(action, payload, id);
      requests.current.delete(key);
      setRevision((r) => r + 1);
      return result;
    },
    [],
  );
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
    const response = Notifications.addNotificationResponseReceivedListener(
      (r) => {
        const href = r.notification.request.content.data?.href;
        if (typeof href === "string") router.push(nativeLink(href) as never);
      },
    );
    return () => {
      sub.remove();
      push.remove();
      response.remove();
    };
  }, [refresh]);
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
    await SecureStore.deleteItemAsync("catera.demo.token");
    await supabase?.auth.signOut({ scope: "local" });
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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId)
      throw new Error(
        "Push memerlukan development build dan EAS project yang dikonfigurasi.",
      );
    if (Platform.OS === "android")
      await Notifications.setNotificationChannelAsync("default", {
        name: "Pengantaran & bantuan",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted")
      throw new Error(
        "Izin notifikasi belum diberikan. Ubah dari pengaturan perangkat.",
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
  if (href === "/#packages") return "/discover";
  if (href === "/#how-it-works") return "/discover?section=how-it-works";
  return href
    .replace(/^\/deliveries\//, "/delivery/")
    .replace(/^\/packages\//, "/package/")
    .replace(/^\/home$/, "/");
};
export function useData<T>(key: string, loader: () => Promise<T>) {
  const { revision } = useNative();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const load = useRef(loader);
  load.current = loader;
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    load
      .current()
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(errors[e.code] || e.message);
      });
    return () => {
      live = false;
    };
  }, [key, revision, refresh]);
  return { data, error, reload: () => setRefresh((r) => r + 1) };
}
