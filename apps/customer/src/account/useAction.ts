import { useRef, useState } from "react";
import { useMobile } from "@catera/mobile-core";
import { failureText } from "./failure";

/** Runs one action at a time and keeps its plain-language error. */
export function useAction() {
  const { t, locale } = useMobile();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(failureText(e, locale, t));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, run };
}
