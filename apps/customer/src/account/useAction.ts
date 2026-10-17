import { useRef, useState } from "react";
import { useMobile } from "@catera/mobile-core";
import { failureText } from "./failure";

/**
 * Runs one action at a time and keeps its plain-language error. `busy` is for a `Button busy`; `failures` counts the
 * failed attempts, so a `FormError` announces a repeated message again (`failureKey`).
 */
export function useAction(describe?: (e: unknown, locale: "id" | "en", t: (id: string, en: string) => string) => string) {
  const { t, locale } = useMobile();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failures, setFailures] = useState(0);
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((describe ?? failureText)(e, locale, t));
      setFailures((n) => n + 1);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, failures, setError, run };
}
