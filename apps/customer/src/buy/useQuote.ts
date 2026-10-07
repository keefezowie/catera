import { useEffect, useState } from "react";
import { errorLabel, type Quote } from "@catera/domain";
import { useMobile } from "@catera/mobile-core";

export type BuyPayload = {
  packageId: string;
  addressId: string;
  portions: number;
  startDate: string;
  cycles: number;
  trial: boolean;
  renewedFrom?: string;
};

/** The server's price for exactly this choice. Every rupiah on screen comes from here.
 * Requotes ~300 ms after the last change; `ready` is only the quote for the current choice. */
export function useQuote(payload: BuyPayload | null) {
  const { runtime, locale, t } = useMobile();
  const key = payload ? JSON.stringify(payload) : "";
  const [state, setState] = useState<{ key: string; quote: Quote | null; error: string }>({
    key: "",
    quote: null,
    error: "",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!payload) return;
    let live = true;
    const timer = setTimeout(() => {
      runtime.api
        .quote(payload)
        .then((quote) => live && setState({ key, quote, error: "" }))
        .catch((e) => {
          if (!live) return;
          const code = (e as { code?: string }).code || (e as Error).message;
          setState((s) => ({
            key,
            quote: s.quote,
            error:
              errorLabel(code, locale) ||
              t("Harga belum bisa dihitung. Coba lagi.", "Couldn't get the price. Try again."),
          }));
        });
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // The key is the payload; the payload object itself is rebuilt every render.
  }, [key, attempt, runtime]);

  const pending = !!payload && state.key !== key;
  const error = !pending && payload ? state.error : "";
  return {
    /** The last quote, possibly for an older choice: shown dimmed while `pending`.
     * Nothing when the current choice cannot be priced (outside the area, past cutoff). */
    shown: payload ? state.quote : null,
    ready: !pending && !error && payload ? state.quote : null,
    pending,
    error,
    retry: () => {
      setState((s) => ({ ...s, key: "" }));
      setAttempt((n) => n + 1);
    },
  };
}
