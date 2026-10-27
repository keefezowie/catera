import { useEffect } from "react";
import { useMobile } from "@catera/mobile-core";
import { countdownText, useResendTimer } from "@catera/mobile-ui";
import { RATE_WAIT_S } from "./emailAuth";
import { authFailure, rateText } from "./failure";
import { useAction } from "./useAction";

/**
 * `useAction` with the auth wording and the 60s rate-limit countdown. `message` is the sentence for `FormError` (the
 * countdown sentence while limited, then nothing); `wait` is the seconds left; `label` swaps a button label for
 * "Coba lagi dalam 0:42" while waiting.
 */
export function useAuthRun() {
  const { t } = useMobile();
  const action = useAction(authFailure);
  const rate = useResendTimer(RATE_WAIT_S);
  const { restart } = rate;
  const limited = action.code === "AUTH_RATE_LIMITED";
  useEffect(() => {
    if (limited) restart();
  }, [limited, action.failures, restart]);
  const wait = limited ? rate.left : 0;
  const message = limited ? (wait > 0 ? rateText(t, countdownText(wait)) : "") : action.error;
  const label = (normal: string) => (wait > 0 ? t(`Coba lagi dalam ${countdownText(wait)}`, `Try again in ${countdownText(wait)}`) : normal);
  return { ...action, message, wait, label };
}
