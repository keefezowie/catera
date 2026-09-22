import { expect, it } from "vitest";
import {
  mealWorkload,
  deliveryDeadlines,
  scheduleSummary,
  type SellerDelivery,
} from "@catera/domain";
const make = (
  id: string,
  customer: string,
  portions: number,
  statuses: Record<string, string>,
  cancelled = false,
  trial = false,
) =>
  ({
    id,
    customer: { id: customer, name: customer },
    portions,
    status: cancelled ? "cancelled" : "scheduled",
    trial,
    address: { line: "X", area: "Y", city: "Z" },
    cutoff_at: "2026-09-21T10:00:00Z",
    meals: Object.entries(statuses).map(([meal, status]) => ({ meal, status })),
  }) as SellerDelivery;
const rows = [
  make("A", "U1", 3, { lunch: "scheduled", dinner: "scheduled" }),
  make("B", "U2", 2, { lunch: "preparing" }),
  make("C", "U1", 1, { lunch: "delivered" }, false, true),
  make("D", "U3", 4, { dinner: "scheduled" }),
  make("E", "U4", 2, { lunch: "cancelled", dinner: "cancelled" }, true),
  make("F", "U5", 2, { lunch: "issue", dinner: "out_for_delivery" }),
];
it("reconciles orders, meal portions, trial, cancellations and per-meal stages", () => {
  expect(scheduleSummary(rows, "all")).toMatchObject({
    orders: 5,
    portions: 17,
  });
  expect(mealWorkload(rows, "lunch")).toMatchObject({
    orders: 4,
    portions: 8,
    stages: {
      scheduled: 3,
      preparing: 2,
      delivered: 1,
      issue: 2,
      out_for_delivery: 0,
    },
  });
  expect(mealWorkload(rows, "dinner")).toMatchObject({
    orders: 3,
    portions: 9,
    stages: {
      scheduled: 7,
      out_for_delivery: 2,
      preparing: 0,
      delivered: 0,
      issue: 0,
    },
  });
  expect(
    scheduleSummary(
      rows.filter((d) => d.customer.id === "U1"),
      "lunch",
    ),
  ).toMatchObject({ orders: 2, portions: 4 });
  expect(scheduleSummary(rows, "all", true)).toMatchObject({
    orders: 6,
    portions: 21,
  });
});
it("uses dated purchased deadlines at the exact boundary without merging different deadlines", () => {
  const boundary = Date.parse(rows[0].cutoff_at);
  expect(deliveryDeadlines(rows, boundary - 1)).toEqual([
    { at: rows[0].cutoff_at.replace("Z", ".000Z"), orders: 5, passed: false },
  ]);
  expect(deliveryDeadlines(rows, boundary)[0].passed).toBe(true);
  expect(deliveryDeadlines(rows, boundary + 1)[0].passed).toBe(true);
  expect(
    deliveryDeadlines(
      [
        ...rows,
        { ...rows[0], id: "different", cutoff_at: "2026-09-21T11:00:00Z" },
      ],
      boundary,
    ),
  ).toHaveLength(2);
  expect(deliveryDeadlines([], boundary)).toEqual([]);
});
