import { describe, it, expect } from "vitest";
import { schedule, price, addDays, addressSchema } from "@catera/domain";
describe("shared customer and native rules", () => {
  it("generates all operating dates across weekends and closures", () =>
    expect(schedule("2026-09-11", 4, [1, 2, 3, 4, 5], ["2026-09-14"])).toEqual([
      "2026-09-11",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
    ]));
  it("rejects an empty operating week", () =>
    expect(() => schedule("2026-09-11", 4, [])).toThrow());
  it("applies the eligible quantity tier to all fixed portions", () =>
    expect(
      price(
        {
          price: 35000,
          days: 5,
          tiers: [
            { min: 3, percent: 5 },
            { min: 5, percent: 10 },
          ],
          trialPrice: 39000,
        },
        4,
      ),
    ).toEqual({
      subtotal: 700000,
      discount: 35000,
      discountPercent: 5,
      total: 665000,
    }));
  it("uses one-day trial pricing without regular quantity discounts", () =>
    expect(
      price(
        {
          price: 35000,
          days: 5,
          tiers: [{ min: 3, percent: 5 }],
          trialPrice: 39000,
        },
        4,
        true,
      ).total,
    ).toBe(156000));
  it("changes calendar dates independently of the browser timezone", () =>
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01"));
  it("requires a usable address and permits delivery instructions", () =>
    expect(
      addressSchema.safeParse({
        label: "Rumah",
        line: "x",
        area: "Jakarta Selatan",
        city: "Jakarta",
      }).success,
    ).toBe(false));
});
