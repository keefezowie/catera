import type { Offer } from "@catera/domain";
import type { PolishArtName } from "@catera/mobile-ui";

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

/**
 * The polish art a caterer's tag can wear as a Jelajah category tile (canvas Jelajah). A tile is always one of the
 * caterers' own tags, so it filters exactly as its chip did; a tag with no matching art stays a chip.
 */
const CATEGORY_ART: [RegExp, PolishArtName][] = [
  [/nusantara/i, "category-nusantara"],
  [/sehat|diet/i, "category-sehat"],
  [/pedas/i, "spot-cabai"],
  [/vegetarian|vegan|nabati/i, "spot-plate-leaf"],
  [/keluarga/i, "category-keluarga"],
  [/kantor/i, "category-kantor"],
];

export function categoryArt(tag: string): PolishArtName | null {
  return CATEGORY_ART.find(([word]) => word.test(tag))?.[1] ?? null;
}

/**
 * Splits the area's tags into art tiles and plain chips. Each art goes to its most frequent tag, so two tiles never
 * share a picture; the other tags (up to `max`) stay chips.
 */
export function categoryTiles(offers: Offer[], max: number): { tiles: { tag: string; art: PolishArtName }[]; chips: string[] } {
  const tiles: { tag: string; art: PolishArtName }[] = [];
  const chips: string[] = [];
  for (const tag of topTags(offers, Number.POSITIVE_INFINITY)) {
    const art = categoryArt(tag);
    if (art && tiles.length < max && !tiles.some((t) => t.art === art)) tiles.push({ tag, art });
    else if (chips.length < max) chips.push(tag);
  }
  return { tiles, chips };
}
