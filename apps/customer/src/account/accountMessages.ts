import type { AccountErrorCode } from "@catera/mobile-core";
import { failureText } from "./failure";

type T = (id: string, en: string) => string;

/**
 * The sentence for a failed account change. Each code the account callers reject with says what is wrong and what to do;
 * anything else falls back to the shared message for the failure.
 */
export function accountMessage(e: unknown, locale: "id" | "en", t: T): string {
  const code = ((e as { code?: string }).code || (e as Error).message) as AccountErrorCode | string;
  switch (code) {
    case "INVALID_INPUT":
      return t("Isiannya belum benar. Periksa lagi.", "That entry isn't right. Check it and try again.");
    case "INVALID_PHONE":
      return t("Nomor WhatsApp belum benar. Cek lagi.", "That WhatsApp number isn't right. Check it and try again.");
    case "AUTH_RATE_LIMITED":
      return t("Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.", "Too many tries. Wait a moment, then try again.");
    case "EMAIL_IN_USE":
      return t("Email ini sudah dipakai akun lain.", "Another account already uses this email.");
    case "INVALID_CREDENTIALS":
      return t("Kata sandi saat ini belum cocok.", "Your current password doesn't match.");
    case "PASSWORD_REJECTED":
      return t(
        "Kata sandi baru belum bisa dipakai. Pilih yang lain, minimal 10 karakter.",
        "The new password can't be used. Choose another, at least 10 characters.",
      );
    case "EMAIL_CHANGE_FAILED":
      return t("Email belum bisa diganti. Coba lagi nanti.", "The email couldn't be changed. Try again later.");
    case "NO_EMAIL":
      return t("Akun ini tidak punya email, jadi tidak punya kata sandi.", "This account has no email, so it has no password.");
    case "UNAUTHORIZED":
    case "ACCOUNT_MISMATCH":
      return t("Masuk lagi, lalu coba sekali lagi.", "Sign in again, then try once more.");
    default:
      return failureText(e, locale, t);
  }
}
