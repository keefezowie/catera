import { z } from "zod";
import type { Offer, Quote } from "./index";
export const MAX_PURCHASE_AMOUNT = 2147483647;
export const durationOptionsSchema = z
  .array(
    z.object({
      cycles: z.number().int().min(1).max(6),
      discountPercent: z.number().min(0).max(90).multipleOf(0.01),
    }),
  )
  .min(1)
  .max(6)
  .superRefine((options, ctx) => {
    if (
      !options.some((o) => o.cycles === 1 && o.discountPercent === 0) ||
      new Set(options.map((o) => o.cycles)).size !== options.length
    )
      ctx.addIssue({
        code: "custom",
        message: "One cycle at 0% is required; cycles must be unique.",
      });
  });
export type DurationOption = z.infer<typeof durationOptionsSchema>[number];
export type DurationPricing = { revision: number; options: DurationOption[] };
export const durationPricingSchema = z.object({
  packageId: z.uuid(),
  catererId: z.uuid(),
  revision: z.number().int().nonnegative(),
  options: durationOptionsSchema,
});
export function durationOptions(
  offer: Pick<Offer, "durationPricing">,
): DurationOption[] {
  return offer.durationPricing?.options ?? [{ cycles: 1, discountPercent: 0 }];
}
export function purchasePricing(
  offer: Pick<
    Offer,
    "price" | "days" | "tiers" | "trialPrice" | "durationPricing"
  >,
  portions: number,
  cycles = 1,
  trial = false,
) {
  if (
    !Number.isInteger(portions) ||
    portions < 1 ||
    portions > 100 ||
    !Number.isInteger(cycles) ||
    cycles < 1 ||
    cycles > 6 ||
    (trial && cycles !== 1)
  )
    throw new Error("INVALID_INPUT");
  const option = durationOptions(offer).find((o) => o.cycles === cycles);
  if (!option) throw new Error("DURATION_UNAVAILABLE");
  const days = trial ? 1 : offer.days * cycles;
  const subtotal =
    (trial ? (offer.trialPrice ?? offer.price) : offer.price) * portions * days;
  if (!Number.isSafeInteger(subtotal) || subtotal > MAX_PURCHASE_AMOUNT)
    throw new Error("AMOUNT_TOO_LARGE");
  const discountPercent = trial
    ? 0
    : Math.max(
        0,
        ...offer.tiers.filter((t) => portions >= t.min).map((t) => t.percent),
      );
  const discount = Math.round((subtotal * discountPercent) / 100);
  const durationDiscountPercent = trial ? 0 : option.discountPercent;
  const durationDiscount = Math.round(
    ((subtotal - discount) * durationDiscountPercent) / 100,
  );
  return {
    subtotal,
    discount,
    discountPercent,
    durationDiscount,
    durationDiscountPercent,
    packageNet: subtotal - discount - durationDiscount,
    days,
    cycles,
  };
}
export function purchasedCycles(quote: Quote) {
  return quote.cycles ?? 1;
}
export function dailySellerAmounts(total: number, count: number) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("INVALID_INPUT");
  return Array.from(
    { length: count },
    (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0),
  );
}
