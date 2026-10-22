/**
 * Whether a row's spoken label is made of non-empty parts: no leading, trailing or doubled separator, and no part that is
 * only spaces (", Data akun, ", "Senin 26 Okt, , 1 hari lagi").
 */
export const wellFormedLabel = (label: string): boolean =>
  label.length > 0 &&
  label === label.trim() &&
  !label.startsWith(",") &&
  !label.endsWith(",") &&
  label.split(", ").every((part) => part.trim() !== "" && part === part.trim() && !part.includes(","));
