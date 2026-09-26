import type { Offer, Quote } from "./index";
import { purchasePricing, purchasedCycles } from "./purchase-pricing";

export type PurchaseCommitment = {
  deliveryDays: number;
  cycles: number;
  mealCountPerDay: number;
  portionsPerMeal: number;
  totalMealPortions: number;
  packagePrice: number;
  serviceFee: number | null;
  finalPayable: number | null;
  deliveryIncluded: true;
  addressEligibility: "eligible" | "outside" | "unknown";
  paymentTiming: "upfront";
  renewal: "manual";
};

/**
 * One read-only purchase contract for discovery, checkout, payment, and renewal.
 * Unknown fees stay unknown until the server has produced a quote.
 */
export function purchaseCommitment({
  offer,
  portions = 1,
  cycles = 1,
  trial = false,
  quote,
  addressCovered,
}: {
  offer: Offer;
  portions?: number;
  cycles?: number;
  trial?: boolean;
  quote?: Quote | null;
  addressCovered?: boolean | null;
}): PurchaseCommitment {
  const effectiveCycles = quote ? purchasedCycles(quote) : cycles;
  const pricing = purchasePricing(
    offer,
    quote?.portions ?? portions,
    effectiveCycles,
    quote?.trial ?? trial,
  );
  const deliveryDays = quote?.dates.length ?? pricing.days;
  const portionsPerMeal = quote?.portions ?? portions;
  const mealCountPerDay = offer.meal === "both" ? 2 : 1;
  return {
    deliveryDays,
    cycles: effectiveCycles,
    mealCountPerDay,
    portionsPerMeal,
    totalMealPortions: deliveryDays * portionsPerMeal * mealCountPerDay,
    packagePrice: quote
      ? (quote.packageNet ??
        quote.subtotal - quote.discount - (quote.durationDiscount ?? 0))
      : pricing.packageNet,
    serviceFee: quote ? quote.serviceFee : null,
    finalPayable: quote ? quote.total : null,
    deliveryIncluded: true,
    addressEligibility:
      addressCovered == null
        ? "unknown"
        : addressCovered
          ? "eligible"
          : "outside",
    paymentTiming: "upfront",
    renewal: "manual",
  };
}
