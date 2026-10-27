import { validEmail } from "@catera/mobile-core";

type T = (id: string, en: string) => string;

/** Server codes about what the person typed: only these outline a field (spec 3.1, S-5). The rest are ours or the network's. */
export const FIELD_CODES = ["INVALID_CREDENTIALS", "INVALID_OTP"];

/** Spec 7: shown when nothing else names the failure, instead of blaming the number or the code. */
export const serverFallback = (t: T) =>
  t("Ada gangguan di sisi kami. Coba lagi sebentar lagi.", "Something went wrong on our side. Try again in a moment.");

export const phoneCheck = (t: T) => (v: string) => {
  const digits = v.replace(/\D/g, "").length;
  if (!digits) return t("Isi nomor HP-mu dulu.", "Enter your phone number first.");
  return digits < 9 || digits > 15 ? t("Nomor HP belum lengkap. Contoh: 0812 3456 7890", "That number looks incomplete. Example: 0812 3456 7890") : "";
};

export const emailCheck = (t: T) => (v: string) => {
  if (!v.trim()) return t("Isi emailmu dulu.", "Enter your email first.");
  return validEmail(v) ? "" : t("Format email belum benar. Contoh: nama@gmail.com", "That email doesn't look right. Example: name@gmail.com");
};

/** Sign-in passwords are only checked for being empty, so an old short password still works. */
export const passwordCheck = (t: T) => (v: string) => (v ? "" : t("Isi kata sandimu dulu.", "Enter your password first."));

export const nameCheck = (t: T) => (v: string) =>
  v.trim().length >= 3 ? "" : t("Tulis nama usahamu, minimal 3 huruf.", "Enter your business name, at least 3 letters.");

export const areaCheck = (t: T) => (v: string) => (v ? "" : t("Pilih satu lokasi dapur.", "Choose a kitchen area."));

/** The wrong-code line under the boxes; from the third miss it points to the resend. */
export const wrongCode = (t: T, misses: number) =>
  t("Kodenya salah. Cek SMS-nya, lalu coba lagi.", "That code is wrong. Check the SMS and try again.") +
  (misses >= 3 ? ` ${t("Belum dapat kodenya? Kirim ulang.", "Didn't get the code? Resend it.")}` : "");

export const rateText = (t: T, time: string) => t(`Terlalu banyak percobaan. Coba lagi dalam ${time}.`, `Too many tries. Try again in ${time}.`);
