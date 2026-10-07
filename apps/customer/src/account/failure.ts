import { errorLabel, type Locale } from "@catera/domain";

/** A plain sentence for a failed command or read: the shared label, or "try again". */
export function failureText(e: unknown, locale: Locale, t: (id: string, en: string) => string): string {
  const code = (e as { code?: string }).code || (e as Error).message;
  return errorLabel(code, locale) || t("Belum berhasil. Coba lagi.", "That didn't work. Try again.");
}
