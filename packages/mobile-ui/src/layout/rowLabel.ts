/**
 * What a screen reader says for a row: its non-empty parts, trimmed, joined by ", ". A part that is missing, empty or
 * only spaces leaves no leading, trailing or doubled separator ("Data akun", not ", Data akun, ").
 */
export function rowLabel(...parts: (string | number | null | undefined | false)[]): string {
  return parts
    .map((part) => (part === null || part === undefined || part === false ? "" : String(part).trim()))
    .filter(Boolean)
    .join(", ");
}
