import type { Offer } from "@catera/domain";

/** A meal is not a category: the meal buttons already own it, so these tags never become a circle. */
const MEAL_TAG = /makan siang|makan malam|siang & malam/i;

/**
 * The Jelajah category circles come from what caterers really tagged, not from a list written here. The most frequent
 * tags across the loaded packages (a tag counts once per package), ties in alphabetical order, each shown with the
 * photo of the first package that carries it.
 */
export function topTags(offers: Offer[], max: number): { tag: string; image: string }[] {
  const found = new Map<string, { count: number; image: string }>();
  for (const offer of offers) {
    for (const tag of new Set(offer.tags)) {
      if (!tag || MEAL_TAG.test(tag)) continue;
      const seen = found.get(tag);
      if (seen) seen.count += 1;
      else found.set(tag, { count: 1, image: offer.image });
    }
  }
  return [...found]
    .sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b))
    .slice(0, max)
    .map(([tag, { image }]) => ({ tag, image }));
}
