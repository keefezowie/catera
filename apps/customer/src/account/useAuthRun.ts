import { useEffect, useState } from "react";
import { useMobile } from "@catera/mobile-core";
import { countdownText, useResendTimer, type MascotPose } from "@catera/mobile-ui";
import { RATE_WAIT_S, validEmail } from "./emailAuth";
import { authFailure, rateText } from "./failure";
import { useAction } from "./useAction";

const OWN_FAILURES = ["INVALID_CREDENTIALS", "INVALID_OTP", "EMAIL_REGISTERED", "EMAIL_NOT_CONFIRMED", "PASSWORD_REJECTED"];

type Tr = (id: string, en: string) => string;

/** The email field's rule on sign in, sign up and recovery: empty, then shape. */
export const emailCheck = (t: Tr) => (v: string) =>
  !v.trim()
    ? t("Isi emailmu dulu.", "Enter your email first.")
    : validEmail(v)
      ? ""
      : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com");

/** The 60s wait after a 429: seconds left, the live sentence and the primary button's label while it runs. */
export function useRateWait() {
  const { t } = useMobile();
  const timer = useResendTimer(RATE_WAIT_S);
  return {
    ...timer,
    message: (left: number) => (left > 0 ? rateText(t, countdownText(left)) : ""),
    label: (normal: string, left: number) =>
      left > 0 ? t(`Coba lagi dalam ${countdownText(left)}`, `Try again in ${countdownText(left)}`) : normal,
  };
}

/**
 * The mascot and the press of a form. The person's own failures (a field that did not pass, wrong credentials or
 * code, a registered or unconfirmed email, a rejected password) make it bingung; OFFLINE makes it mencari; any other
 * failure leaves it melambai. The next edit sends it back to melambai. `press` checks the fields and runs `go` only
 * when they pass.
 */
export function useFormPose(code: string, failures: number) {
  const [edited, setEdited] = useState(true);
  const [fieldFailed, setFieldFailed] = useState(false);
  useEffect(() => {
    if (failures) setEdited(false);
  }, [failures]);
  // bingung only for what the person did (spec 6A); server trouble and the rate limit leave the mascot waving.
  const pose: MascotPose = edited ? "melambai" : code === "OFFLINE" ? "mencari" : fieldFailed || OWN_FAILURES.includes(code) ? "bingung" : "melambai";
  return {
    pose,
    edit: (set: (v: string) => void) => (v: string) => {
      set(v);
      setEdited(true);
    },
    reset: () => {
      setFieldFailed(false);
      setEdited(true);
    },
    press: (checks: { submit: (go: () => void) => void }, go: () => void) => {
      let ok = false;
      checks.submit(() => {
        ok = true;
        go();
      });
      setFieldFailed(!ok);
      if (!ok) setEdited(false);
    },
  };
}

/**
 * `useAction` with the auth wording and the 60s rate-limit countdown. `message` is the sentence for `FormError` (the
 * countdown sentence while limited, then nothing); `wait` is the seconds left; `label` swaps a button label for
 * "Coba lagi dalam 0:42" while waiting.
 */
export function useAuthRun() {
  const action = useAction(authFailure);
  const rate = useRateWait();
  const { restart } = rate;
  const limited = action.code === "AUTH_RATE_LIMITED";
  useEffect(() => {
    if (limited) restart();
  }, [limited, action.failures, restart]);
  const wait = limited ? rate.left : 0;
  const message = limited ? rate.message(wait) : action.error;
  return { ...action, message, wait, label: (normal: string) => rate.label(normal, wait) };
}
