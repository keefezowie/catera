import { errorLabel } from "@catera/domain";
import type { AccountErrorCode } from "@catera/mobile-core";

type T = (id: string, en: string) => string;

/**
 * What a failed account change says, by the typed code the account callers reject with. Every code gets its own line, so
 * the person learns what to fix. A code from outside the account callers falls back to the shared error map, then to
 * `fallback`, which names the action that failed.
 */
export function accountMessage(error: unknown, t: T, locale: "id" | "en", fallback: string): string {
  const code = ((error as { code?: string }).code || (error as Error)?.message) as AccountErrorCode | string;
  const known: Partial<Record<AccountErrorCode, string>> = {
    INVALID_INPUT: t("Periksa isiannya, lalu coba lagi.", "Check what you typed, then try again."),
    INVALID_PHONE: t(
      "Nomor HP belum benar. Tulis nomor Indonesia, misalnya 0812...",
      "That phone number is not right. Write an Indonesian number, such as 0812...",
    ),
    NOT_CONFIGURED: t("Perubahan ini belum tersedia di versi aplikasi ini.", "This change is not available in this version of the app."),
    UNAUTHORIZED: t("Sesimu sudah berakhir. Masuk lagi, lalu coba lagi.", "Your session has ended. Sign in again, then try again."),
    NO_EMAIL: t("Akun ini masuk dengan nomor HP, jadi tidak punya kata sandi.", "This account signs in with a phone number, so it has no password."),
    AUTH_RATE_LIMITED: t("Terlalu sering mencoba. Tunggu sebentar, lalu coba lagi.", "Too many tries. Wait a moment, then try again."),
    EMAIL_IN_USE: t("Email ini sudah dipakai akun lain.", "That email is used by another account."),
    PHONE_IN_USE: t("Nomor HP ini sudah dipakai akun lain.", "That phone number is used by another account."),
    CODE_INVALID: t("Kodenya tidak cocok atau sudah kedaluwarsa. Kirim kode baru.", "The code does not match or has expired. Send a new one."),
    INVALID_CREDENTIALS: t("Kata sandi saat ini salah.", "The current password is wrong."),
    ACCOUNT_MISMATCH: t("Kata sandi itu milik akun lain. Masuk lagi dengan akunmu.", "That password belongs to another account. Sign in again with your own."),
    PASSWORD_REJECTED: t("Kata sandi baru ditolak. Pilih yang lain, minimal 8 karakter.", "The new password was rejected. Pick another, at least 8 characters."),
    PHONE_CHANGE_FAILED: t("Kode ke nomor baru belum terkirim. Coba lagi.", "The code to the new number was not sent. Try again."),
    EMAIL_CHANGE_FAILED: t("Tautan konfirmasi belum terkirim. Coba lagi.", "The confirmation link was not sent. Try again."),
  };
  return known[code as AccountErrorCode] ?? (errorLabel(code, locale) || fallback);
}
