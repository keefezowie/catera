import { normalizeCustomerPhone } from "@catera/domain";

/**
 * A number as typed in Indonesia (0812…, 62812…, +62 812…, 0062812…, +62 0812…) in E.164, or null when it is not one.
 * The domain's normaliser, so the app accepts exactly what the server stores (+62, then 8 to 13 digits not starting with 0).
 */
export function e164Indonesia(input: string): string | null {
  try {
    return normalizeCustomerPhone(input.trim());
  } catch {
    return null;
  }
}

/** WhatsApp's own link to a chat with this number (wa.me takes the digits without the plus). */
export const waLink = (input: string) => `https://wa.me/${(e164Indonesia(input) ?? "").slice(1)}`;

/** A unique, URL-safe slug for a new caterer: name plus a short random suffix. */
export function catererSlug(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "dapur"}-${suffix}`;
}
