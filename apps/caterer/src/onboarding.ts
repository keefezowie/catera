/** WhatsApp numbers as typed in Indonesia (0812…, 62812…, +62 812…) to E.164. */
export function e164Indonesia(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  else if (!digits.startsWith("62")) digits = "62" + digits;
  return "+" + digits;
}

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
