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
import {
  errorLabel,
  type Actor,
  type Offer,
  type Locale,
  type Workspace,
} from "@catera/domain";
export const api = createApi();
const actionMessages: Record<string, [string, string]> = {
  "package.save": ["Paket tersimpan.", "Package saved."],
  "package.suspend": [
    "Penjualan paket ditangguhkan.",
    "Package sales suspended.",
  ],
  "package.archive": ["Paket diarsipkan.", "Package archived."],
  "seller.save": ["Profil katerer tersimpan.", "Caterer profile saved."],
  "seller.submit": [
    "Verifikasi diajukan. Catera akan meninjau profilmu.",
    "Verification requested. Catera will review your profile.",
  ],
  "menu.save": ["Menu tersimpan.", "Menu saved."],
  "menu.saveBatch": [
    "Menu untuk tanggal terpilih tersimpan.",
    "Menus saved for the selected dates.",
  ],
  "dish.save": ["Hidangan tersimpan di pustaka.", "Dish saved to the library."],
  "delivery.statusBatch": [
    "Status pesanan diperbarui.",
    "Order statuses updated.",
  ],
  "delivery.status": [
    "Status pengantaran diperbarui.",
    "Delivery status updated.",
  ],
  "delivery.reschedule": [
    "Tanggal pengantaran diganti.",
    "Delivery date changed.",
  ],
  "delivery.address": [
    "Alamat pengantaran diperbarui.",
    "Delivery address updated.",
  ],
  "production.freeze": [
    "Daftar dapur dan pengantaran tersimpan.",
    "Kitchen and delivery list saved.",
  ],
  "import.preview": [
    "Pratinjau siap. Belum ada langganan dibuat.",
    "Preview ready. No subscriptions created yet.",
  ],
  "import.commit": [
    "Langganan prabayar berhasil diimpor.",
    "Prepaid subscriptions imported.",
  ],
  "support.create": ["Permintaan bantuan terkirim.", "Support request sent."],
  "support.respond": ["Tanggapan bantuan terkirim.", "Support response sent."],
  "message.send": ["Pesan terkirim.", "Message sent."],
  "admin.verify": [
    "Keputusan verifikasi tersimpan.",
    "Verification decision saved.",
  ],
  "address.save": ["Alamat tersimpan.", "Address saved."],
};
type Context = {
  actor: Actor | null;
  workspace: Workspace;
  offers: Offer[];
  demo: boolean;
  locale: Locale;
  t: (id: string, en: string) => string;
  area: string;
  setArea: (v: string) => void;
  compare: string[];
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
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
  workspace,
  offers,
  demo,
  initialLocale,
  children,
}: {
  actor: Actor | null;
  workspace: Workspace;
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
  function clearCompare() {
    setCompare((current) => {
      if (current.length === 0) return current;
      sessionStorage.removeItem("catera-compare");
      return [];
    });
  }
  const perform = useCallback(
    async <T,>(action: string, payload: unknown): Promise<T> => {
      const hash = action + JSON.stringify(payload);
      const key = keys.current.get(hash) || crypto.randomUUID();
      keys.current.set(hash, key);
      const result = await api.command<T>(action, payload, key);
      keys.current.delete(hash);
      if (action !== "import.preview") setRevision((v) => v + 1);
      const message = actionMessages[action];
      setToast(
        message
          ? message[locale === "id" ? 0 : 1]
          : locale === "id"
            ? "Perubahan tersimpan."
            : "Changes saved.",
      );
      return result;
    },
    [locale],
  );
  return (
    <AppContext.Provider
      value={{
        actor,
        workspace,
        offers,
        demo,
        locale,
        t: (id, en) => (locale === "id" ? id : en),
        area,
        setArea,
        compare,
        toggleCompare,
        clearCompare,
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
  const { revision, locale } = useApp();
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
          setError(
            errorLabel(e.code || "", locale) ||
              (locale === "en"
                ? "Data could not be loaded. Try again."
                : "Data belum berhasil dimuat. Coba lagi."),
          );
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
