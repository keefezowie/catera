import { serverErrorLabel } from "@catera/domain";
import { validEmail } from "@catera/mobile-core";
import { e164Indonesia } from "../onboarding";

type T = (id: string, en: string) => string;

/** Server codes about what the person typed: only these outline a field (spec 3.1, S-5). The rest are ours or the network's. */
export const FIELD_CODES = ["INVALID_CREDENTIALS"];

/** Spec 7: shown when nothing else names the failure, instead of blaming the number or the code. The words live in @catera/domain. */
export const serverFallback = (t: T) => t(serverErrorLabel("id"), serverErrorLabel("en"));

/** A kitchen WhatsApp number, by the domain rule for the Indonesian numbers the server stores. */
export const waCheck = (t: T) => (v: string) =>
  !v.replace(/D/g, "")
    ? t("Isi nomor WhatsApp dapur dulu.", "Enter the kitchen's WhatsApp number first.")
    : e164Indonesia(v)
      ? ""
      : t("Nomor WhatsApp belum lengkap. Contoh: 0812 3456 7890", "That WhatsApp number looks incomplete. Example: 0812 3456 7890");

export const emailCheck = (t: T) => (v: string) => {
  if (!v.trim()) return t("Isi emailmu dulu.", "Enter your email first.");
  return validEmail(v) ? "" : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com");
};

/** Sign-in passwords are only checked for being empty, so an old short password still works. */
export const passwordCheck = (t: T) => (v: string) => (v ? "" : t("Isi kata sandimu dulu.", "Enter your password first."));

/** A new password: eight characters at least, worded by the PasswordRule line under the field. */
export const newPasswordCheck = (v: string) => (v.length >= 8 ? "" : "short");

export const nameCheck = (t: T) => (v: string) =>
  v.trim().length >= 3 ? "" : t("Tulis nama usahamu, minimal 3 huruf.", "Enter your business name, at least 3 letters.");

export const personCheck = (t: T) => (v: string) =>
  v.replace(/[^\p{L}]/gu, "").length >= 2 ? "" : t("Tulis namamu, minimal 2 huruf.", "Enter your name, at least 2 letters.");

export const areaCheck = (t: T) => (v: string) => (v ? "" : t("Pilih satu lokasi dapur.", "Choose a kitchen area."));

export const inviteCheck = (t: T) => (v: string) => (v.trim() ? "" : t("Isi kode undangan dulu.", "Enter the invite code first."));

export const registeredText = (t: T) =>
  t(
    "Email ini sudah terdaftar. Masuk, atau pilih Lupa kata sandi kalau kamu lupa.",
    "This email is already registered. Sign in, or use Forgot password if you don't remember it.",
  );

export const rateText = (t: T, time: string) => t(`Terlalu banyak percobaan. Coba lagi dalam ${time}.`, `Too many tries. Try again in ${time}.`);

/** Spec 7: "Coba lagi" for a connection or server failure (the server fallback included), never for a field or the rate limit. */
export const canRetry = (t: T, f: { code?: string; message: string } | null) =>
  !!f && (f.code === "OFFLINE" || f.code === "AUTH_UNAVAILABLE" || f.message === serverFallback(t));
