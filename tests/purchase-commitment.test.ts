import { describe, expect, it } from "vitest";
import { purchaseCommitment, type Offer, type Quote } from "@catera/domain";

const offer = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "lunch-dinner",
  catererId: "00000000-0000-4000-8000-000000000002",
  caterer: "Catera Test",
  catererSlug: "catera-test",
  name: "Lunch and dinner",
  description: "",
  price: 50_000,
  days: 5,
  meal: "both",
  weekdays: [1, 2, 3, 4, 5],
  flexible: true,
  image: "",
  tags: [],
  trialPrice: null,
  trialMax: null,
  tiers: [{ min: 2, percent: 10 }],
  capacity: {},
  windows: { lunch: "11:00–13:00", dinner: "17:00–19:00" },
  areas: ["Kemang"],
  cutoff: "09:00",
  timezone: "Asia/Jakarta",
  menus: [],
  rating: null,
  reviewCount: 0,
  status: "published",
  sellerStatus: "approved",
  version: 1,
} satisfies Offer;

describe("purchaseCommitment", () => {
  it("keeps fees unknown before the server quote", () => {
    expect(
      purchaseCommitment({ offer, portions: 2, addressCovered: true }),
    ).toMatchObject({
      deliveryDays: 5,
      mealCountPerDay: 2,
      portionsPerMeal: 2,
      totalMealPortions: 20,
      packagePrice: 450_000,
      serviceFee: null,
      finalPayable: null,
      addressEligibility: "eligible",
      renewal: "manual",
    });
  });

  it("uses the quoted contract once the server has priced the purchase", () => {
    const quote = {
      packageId: offer.id,
      portions: 2,
      trial: false,
      dates: ["2026-10-01", "2026-10-02", "2026-10-03"],
      subtotal: 300_000,
      discount: 30_000,
      discountPercent: 10,
      durationDiscount: 0,
      durationDiscountPercent: 0,
      packageNet: 270_000,
      promotion: 0,
      serviceFee: 5_000,
      total: 275_000,
      perDay: 100_000,
      sellerFee: 0,
      source: "test",
      offer,
    } satisfies Quote;
    expect(purchaseCommitment({ offer, quote })).toMatchObject({
      deliveryDays: 3,
      totalMealPortions: 12,
      packagePrice: 270_000,
      serviceFee: 5_000,
      finalPayable: 275_000,
    });
  });
});
