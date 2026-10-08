import { expect, it } from "vitest";
import { perMealPrice, priceUnitLabel } from "@catera/domain";

it("a single-meal offer carries only the per-meal unit", () => {
  expect(priceUnitLabel({ meal: "lunch" }, "id")).toEqual({ unit: "/ sekali makan", note: null });
  expect(priceUnitLabel({ meal: "dinner" }, "en")).toEqual({ unit: "/ meal", note: null });
});

it("a combined offer says one day brings two meals", () => {
  expect(priceUnitLabel({ meal: "both" }, "id")).toEqual({ unit: "/ sekali makan", note: "2 kali makan / hari" });
  expect(priceUnitLabel({ meal: "both" }, "en")).toEqual({ unit: "/ meal", note: "2 meals / day" });
});

it("defaults to Indonesian and pairs with the per-meal price", () => {
  expect(priceUnitLabel({ meal: "both" }).unit).toBe("/ sekali makan");
  expect(perMealPrice({ price: 60000, meal: "both" })).toBe(30000);
});
