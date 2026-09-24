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
  "packageOption.save": [
    "Pilihan paket diperbarui.",
    "Package options updated.",
  ],
  "customerMenu.saveBatch": [
    "Menu pilihan Anda tersimpan.",
    "Your menu choices are saved.",
  ],
  "customerMenu.resetBatch": [
    "Menu diserahkan ke katerer.",
    "The caterer will choose the menu.",
  ],
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
  drafts: Record<string, unknown>;
  setDraft: (key: string, value: unknown) => void;
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
  const [draftState, setDraftState] = useState<{
    actor: string | undefined;
    values: Record<string, unknown>;
  }>({ actor: actor?.id, values: {} });
  const drafts = draftState.actor === actor?.id ? draftState.values : {};
  const setDraft = (key: string, value: unknown) =>
    setDraftState((previous) => ({
      actor: actor?.id,
      values: {
        ...(previous.actor === actor?.id ? previous.values : {}),
        [key]:
          typeof value === "function"
            ? value(
                previous.actor === actor?.id ? previous.values[key] : undefined,
              )
            : value,
      },
    }));
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
        drafts,
        setDraft,
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
// Sensitive drafts live only in the mounted, actor-scoped workspace, never storage.
export function useWorkspaceDraft<T>(key: string, initial: T) {
  const { drafts, setDraft } = useApp();
  const value = (drafts[key] as T | undefined) ?? initial;
  return [
    value,
    (next: T | ((previous: T) => T)) =>
      setDraft(
        key,
        typeof next === "function"
          ? (previous: T | undefined) =>
              (next as (previous: T) => T)(previous ?? initial)
          : next,
      ),
  ] as const;
}
export function useResource<T>(
  key: string,
  load: () => Promise<T>,
  { keepPreviousData = false }: { keepPreviousData?: boolean } = {},
) {
  const { revision, locale } = useApp();
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key, data: null, error: "", loading: true });
  const [tick, setTick] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    let live = true;
    setResult((previous) => ({
      key,
      data: previous.key === key || keepPreviousData ? previous.data : null,
      error: "",
      loading: true,
    }));
    const request = loader.current;
    Promise.resolve()
      .then(request)
      .then((value) => {
        if (live) setResult({ key, data: value, error: "", loading: false });
      })
      .catch((e) => {
        if (live)
          setResult((previous) => ({
            ...previous,
            error: e?.code || "REQUEST_FAILED",
            loading: false,
          }));
      });
    return () => {
      live = false;
    };
  }, [key, revision, tick, keepPreviousData]);
  // Never expose the previous record/filter's data, including the render before
  // its effect starts. Refreshes of the same resource retain editable UI state.
  // A persistent navigation shell can opt in only if it masks prior records.
  const current = result.key === key;
  const error =
    current && result.error
      ? errorLabel(result.error, locale) ||
        (locale === "en"
          ? "Data could not be loaded. Try again."
          : "Data belum berhasil dimuat. Coba lagi.")
      : "";
  return {
    data: current || keepPreviousData ? result.data : null,
    error,
    loading: !current || result.loading,
    reload: () => setTick((v) => v + 1),
  };
}
