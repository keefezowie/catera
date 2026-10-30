import { errorLabel, serverErrorLabel, type Locale } from "@catera/domain";

/** A plain sentence for a failed command or read: the shared label, or "try again". */
export function failureText(e: unknown, locale: Locale, t: (id: string, en: string) => string): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  return errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again.");
}

type Tr = (id: string, en: string) => string;

/**
 * Sign-in, sign-up and recovery failures in the words of the auth spec (section 7): the shared label (which holds the
 * spec wording), the registered-email sentence with its way out, and the server sentence for anything unnamed.
 * AUTH_RATE_LIMITED is worded live by `rateText`, so its message here is only the fallback.
 */
export function authFailure(e: unknown, locale: Locale, t: Tr): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  if (code === "EMAIL_REGISTERED")
    return t(
      "Email ini sudah terdaftar. Masuk, atau pilih Lupa kata sandi kalau kamu lupa.",
      "This email is already registered. Sign in, or use Forgot password if you don't remember it.",
    );
  return errorLabel(code, locale) || serverErrorLabel(locale);
}

/** Codes about what the person typed or the account: a new try with the same input cannot help, so no Coba lagi. */
const FIELD_CODES = ["INVALID_CREDENTIALS", "EMAIL_REGISTERED", "EMAIL_NOT_CONFIRMED", "PASSWORD_REJECTED", "AUTH_RATE_LIMITED"];

/** Failures worth a Coba lagi: no connection, the service down, or a code with no sentence of its own. */
export const canRetry = (code: string, locale: Locale) =>
  !FIELD_CODES.includes(code) && (code === "OFFLINE" || code === "AUTH_UNAVAILABLE" || (!!code && !errorLabel(code, locale)));

/** The rate-limit sentence with the live time ("0:42"). */
export const rateText = (t: Tr, time: string) =>
  t(`Terlalu banyak percobaan. Coba lagi dalam ${time}.`, `Too many tries. Try again in ${time}.`);
