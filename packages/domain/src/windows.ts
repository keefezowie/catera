import type { Offer } from "./index";

/** The offer's delivery window start in minutes after midnight, or null when the caterer's window does not parse. */
export function parsedWindowStart(offer: Offer, meal: "lunch" | "dinner"): number | null {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})\s*$/.exec(offer.windows?.[meal] ?? "");
  if (!m) return null;
  const [sh, sm, eh, em] = [m[1], m[2], m[3], m[4]].map(Number);
  return sh <= 23 && eh <= 23 && sm <= 59 && em <= 59 ? sh * 60 + sm : null;
}

/**
 * Window start in minutes after midnight, the same rule as SQL v1.window_bounds, falling back to 11.00 for lunch and
 * 17.00 for dinner. The fallback orders rows; it is not a time the caterer set, so a screen that shows a time uses
 * `parsedWindowStart`. A leaf module: `customer-day` and `kitchen` both read it, so neither imports the other for it.
 */
export function windowStartMinutes(offer: Offer, meal: "lunch" | "dinner"): number {
  return parsedWindowStart(offer, meal) ?? (meal === "dinner" ? 17 * 60 : 11 * 60);
}
