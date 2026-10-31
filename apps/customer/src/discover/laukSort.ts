import { menuSummary, type Locale, type Offer } from "@catera/domain";
import type { LaukPref } from "../onboarding/prefs";

/**
 * The words that put a package under a lauk choice (spec ruling 5): a plain keyword match on the package name, its
 * tags and its menu. "Tanpa santan" is only matched when a caterer wrote it; a missing "santan" proves nothing.
 */
const LAUK_WORDS: Record<LaukPref, RegExp> = {
  ayam: /\bayam\b/i,
  ikan: /\b(ikan|lele|bandeng|tongkol|nila|gurame|gurami|kakap|tuna|salmon|patin|cakalang)\b/i,
  daging: /\b(daging|sapi|rendang|kambing|empal)\b/i,
  sayur: /\b(sayur|sayuran|nabati|vegetarian|vegan|gado-gado|pecel|lodeh|capcay)\b/i,
  pedas: /\b(pedas|sambal|balado|cabai|cabe|rica-rica)\b/i,
  "tanpa-santan": /\btanpa santan\b/i,
};

/** How many of the customer's lauk choices the package matches. */
export function laukScore(offer: Offer, prefs: readonly LaukPref[], locale: Locale): number {
  if (!prefs.length) return 0;
  const text = [offer.name, ...offer.tags, ...(offer.menus ?? []).map((m) => menuSummary(m, locale))].join(" ");
  return prefs.filter((p) => LAUK_WORDS[p].test(text)).length;
}

/** Packages that match more lauk choices first; the rest keep the catalogue's order. */
export function sortByLauk<T extends Offer>(offers: T[], prefs: readonly LaukPref[], locale: Locale): T[] {
  if (!prefs.length) return offers;
  return offers
    .map((o, i) => ({ o, i, s: laukScore(o, prefs, locale) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ o }) => o);
}
