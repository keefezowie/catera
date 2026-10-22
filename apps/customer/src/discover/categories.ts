import type { Offer } from "@catera/domain";

/** A meal is not a category: the Siang / Malam segment already owns it, so these tags never become a chip. */
const MEAL_TAG = /makan siang|makan malam|siang & malam/i;

/**
 * The Jelajah category chips come from what caterers really tagged, not from a list written here. The most frequent
 * tags across the loaded packages (a tag counts once per package), ties in alphabetical order.
 */
export function topTags(offers: Offer[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    for (const tag of new Set(offer.tags)) {
      if (!tag || MEAL_TAG.test(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, max)
    .map(([tag]) => tag);
}
