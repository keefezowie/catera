import { useEffect } from "react";
import { RATE_WAIT_S, useMobile } from "@catera/mobile-core";
import { countdownText, useResendTimer, type AuthRun, type FormPose } from "@catera/mobile-ui";
import { useFormRun } from "../useFormRun";
import { canRetry, rateText, serverFallback } from "./checks";

/**
 * Dapur's `AuthRun` for the shared recovery screens: `useFormRun`'s busy button and failure, the rate-limit wait
 * (the countdown sentence while limited), and "Coba lagi" for a connection or server failure.
 */
export function useAuthRun(): AuthRun {
  const { t, locale } = useMobile();
  const { busy, failure, run } = useFormRun(locale, serverFallback(t));
  const rate = useResendTimer(RATE_WAIT_S);
  const { restart } = rate;
  const limited = failure?.code === "AUTH_RATE_LIMITED";
  useEffect(() => {
    if (limited) restart();
  }, [limited, failure?.key, restart]);
  const wait = limited ? rate.left : 0;
  return {
    busy,
    code: failure?.code ?? "",
    failures: failure?.key ?? 0,
    message: limited ? (wait > 0 ? rateText(t, countdownText(wait)) : "") : (failure?.message ?? ""),
    wait,
    retryable: canRetry(t, failure),
    label: (normal) => (wait > 0 ? t(`Coba lagi dalam ${countdownText(wait)}`, `Try again in ${countdownText(wait)}`) : normal),
    run: async (action) => void (await run(action)),
  };
}

/** Dapur has no mascot, so a form never changes pose; a press still checks the fields and runs `go` only when they pass. */
export const formPose: FormPose = {
  pose: "melambai",
  edit: (set) => set,
  press: (checks, go) => checks.submit(go),
};
