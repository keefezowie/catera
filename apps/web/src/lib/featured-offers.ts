import type { Offer } from "@catera/domain";

export function featuredOffers<T extends Pick<Offer, "catererId" | "areas">>(
  offers: T[],
  area: string,
): T[] {
  const seen = new Set<string>();
  return offers
    .filter((offer) => {
      if ((area && !offer.areas.includes(area)) || seen.has(offer.catererId))
        return false;
      seen.add(offer.catererId);
      return true;
    })
    .slice(0, 3);
}
