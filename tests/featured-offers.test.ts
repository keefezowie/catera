import { expect, it } from "vitest";
import { featuredOffers } from "../apps/web/src/lib/featured-offers";

const offers = [
  { id: "a1", catererId: "a", areas: ["South"] },
  { id: "a2", catererId: "a", areas: ["North"] },
  { id: "b1", catererId: "b", areas: ["South"] },
  { id: "c1", catererId: "c", areas: ["South"] },
  { id: "d1", catererId: "d", areas: ["South"] },
];
it("preserves catalog order, selects distinct caterers and caps the showcase at three", () => {
  expect(featuredOffers(offers, "").map((o) => o.id)).toEqual([
    "a1",
    "b1",
    "c1",
  ]);
});
it("selects the first eligible offer per caterer rather than dropping a caterer whose first offer does not deliver", () => {
  expect(featuredOffers(offers, "North").map((o) => o.id)).toEqual(["a2"]);
});
it("returns no synthetic replacements for an empty catalog or uncovered area", () => {
  expect(featuredOffers([], "")).toEqual([]);
  expect(featuredOffers(offers, "East")).toEqual([]);
});
