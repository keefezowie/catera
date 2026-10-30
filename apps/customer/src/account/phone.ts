import { normalizeCustomerPhone } from "@catera/domain";

type Tr = (id: string, en: string) => string;

/** A number as typed in Indonesia (0812…, 62812…, +62 812…) in E.164, or null when it is not one. */
export function e164(input: string): string | null {
  try {
    return normalizeCustomerPhone(input.trim());
  } catch {
    return null;
  }
}

/** The WhatsApp or HP field's rule: empty says `empty`, a malformed number shows the example. */
export const phoneCheck = (t: Tr, empty: string) => (v: string) =>
  !v.replace(/\D/g, "")
    ? empty
    : e164(v)
      ? ""
      : t("Nomornya belum benar. Contoh: 0812 3456 7890", "That number doesn't look right. Example: 0812 3456 7890");
