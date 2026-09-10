"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { createApi } from "@catera/api-client";
import { createBrowserClient } from "@supabase/ssr";
import { errors, type Actor, type Offer, type Locale } from "@catera/domain";
export const api = createApi();
type Context = {
  actor: Actor | null;
  offers: Offer[];
  demo: boolean;
  locale: Locale;
  t: (id: string, en: string) => string;
  area: string;
  setArea: (v: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  revision: number;
  perform: <T = Record<string, unknown>>(
    action: string,
    payload: unknown,
  ) => Promise<T>;
  notify: (text: string) => void;
  setLocale: (l: Locale) => void;
};
const AppContext = createContext<Context>(null!);
const CatalogContext = createContext<Offer[] | null>(null);
export function CatalogProvider({
  offers,
  children,
}: {
  offers: Offer[];
  children: ReactNode;
}) {
  return (
    <CatalogContext.Provider value={offers}>{children}</CatalogContext.Provider>
  );
}
export function Provider({
  actor,
  offers,
  demo,
  initialLocale,
  children,
}: {
  actor: Actor | null;
  offers: Offer[];
  demo: boolean;
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale),
    [area, setAreaState] = useState(""),
    [compare, setCompare] = useState<string[]>([]),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState("");
  const keys = useRef(new Map<string, string>());
  useEffect(() => {
    if (
      demo ||
      !actor ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return;
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
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
  useEffect(() => {
    setAreaState(localStorage.getItem("catera-area") || "");
    try {
      setCompare(JSON.parse(sessionStorage.getItem("catera-compare") || "[]"));
    } catch {}
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  function setArea(value: string) {
    setAreaState(value);
    localStorage.setItem("catera-area", value);
  }
  function setLocale(value: Locale) {
    setLocaleState(value);
    document.cookie =
      "catera_locale=" + value + ";path=/;max-age=31536000;SameSite=Lax";
    document.documentElement.lang = value;
  }
  function toggleCompare(id: string) {
    setCompare((current) => {
      if (!current.includes(id) && current.length >= 3) {
        setToast(
          locale === "id"
            ? "Bandingkan maksimal 3 paket."
            : "Compare up to 3 packages.",
        );
        return current;
      }
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      sessionStorage.setItem("catera-compare", JSON.stringify(next));
      return next;
    });
  }
  const perform = useCallback(
    async <T,>(action: string, payload: unknown): Promise<T> => {
      const hash = action + JSON.stringify(payload);
      const key = keys.current.get(hash) || crypto.randomUUID();
      keys.current.set(hash, key);
      const result = await api.command<T>(action, payload, key);
      keys.current.delete(hash);
      setRevision((v) => v + 1);
      setToast(locale === "id" ? "Perubahan tersimpan." : "Changes saved.");
      return result;
    },
    [locale],
  );
  return (
    <AppContext.Provider
      value={{
        actor,
        offers,
        demo,
        locale,
        t: (id, en) => (locale === "id" ? id : en),
        area,
        setArea,
        compare,
        toggleCompare,
        revision,
        perform,
        notify: setToast,
        setLocale,
      }}
    >
      {children}
      <div
        className={"toast " + (toast ? "visible" : "")}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </AppContext.Provider>
  );
}
export const useApp = () => {
  const app = useContext(AppContext);
  const offers = useContext(CatalogContext);
  return offers ? { ...app, offers } : app;
};
export function useResource<T>(key: string, load: () => Promise<T>) {
  const { revision } = useApp();
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    loader
      .current()
      .then((value) => {
        if (live) setData(value);
      })
      .catch((e) => {
        if (live)
          setError(errors[e.code] || "Data belum berhasil dimuat. Coba lagi.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [key, revision, tick]);
  return { data, error, loading, reload: () => setTick((v) => v + 1) };
}
