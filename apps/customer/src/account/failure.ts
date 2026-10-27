import { errorLabel, type Locale } from "@catera/domain";

/** A plain sentence for a failed command or read: the shared label, or "try again". */
export function failureText(e: unknown, locale: Locale, t: (id: string, en: string) => string): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  return errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again.");
}

type Tr = (id: string, en: string) => string;

/**
 * Sign-in, sign-up and recovery failures in the words of the auth spec (section 7). Other codes keep the shared label.
 * AUTH_RATE_LIMITED is worded live by `rateText`, so its message here is only the fallback.
 */
export function authFailure(e: unknown, locale: Locale, t: Tr): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  if (code === "INVALID_CREDENTIALS") return t("Email atau kata sandinya salah.", "Wrong email or password.");
  if (code === "EMAIL_NOT_CONFIRMED") return t("Emailmu belum diverifikasi.", "Your email isn't verified yet.");
  if (code === "OFFLINE") return t("Belum ada koneksi. Cek internetmu, lalu coba lagi.", "No connection. Check your internet and try again.");
  if (code === "AUTH_UNAVAILABLE") return t("Ada gangguan di sisi kami. Coba lagi sebentar lagi.", "Something went wrong on our side. Try again in a moment.");
  if (code === "EMAIL_REGISTERED")
    return t(
      "Email ini sudah terdaftar. Masuk, atau pilih Lupa kata sandi kalau kamu lupa.",
      "This email is already registered. Sign in, or use Forgot password if you don't remember it.",
    );
  return errorLabel(code, locale) || t("Ada gangguan di sisi kami. Coba lagi sebentar lagi.", "Something went wrong on our side. Try again in a moment.");
}

/** Failures worth a Coba lagi: no connection, the service down, or a code with no sentence of its own. Never a field or the rate limit. */
export const canRetry = (code: string, locale: Locale) => code === "OFFLINE" || code === "AUTH_UNAVAILABLE" || (!!code && !errorLabel(code, locale) && code !== "INVALID_OTP");

/** The rate-limit sentence with the live time ("0:42"). */
export const rateText = (t: Tr, time: string) =>
  t(`Terlalu banyak percobaan. Coba lagi dalam ${time}.`, `Too many tries. Try again in ${time}.`);
