import { z } from "zod";
import type { Delivery, SellerState } from "./index";

export type SellerDelivery = Delivery & {
  customer: { id: string; name: string };
};
export type SellerOperationsState = Omit<SellerState, "deliveries"> & {
  deliveries: SellerDelivery[];
  operationalDate: string;
  today: string;
};
export type SellerCalendar = {
  days: { date: string; orders: number; lunch: boolean; dinner: boolean }[];
};
export const deliveryBatchSchema = z
  .object({
    catererId: z.uuid(),
    date: z.iso.date(),
    meal: z.enum(["lunch", "dinner"]),
    status: z.enum(["preparing", "out_for_delivery", "delivered", "issue"]),
    items: z
      .array(z.object({ id: z.uuid(), version: z.number().int().positive() }))
      .min(1)
      .max(500),
  })
  .refine(
    (p) => new Set(p.items.map((i) => i.id)).size === p.items.length,
    "Duplicate delivery",
  );
export function nextDeliveryStatuses(status: string): string[] {
  return (
    (
      {
        scheduled: ["preparing"],
        preparing: ["out_for_delivery"],
        out_for_delivery: ["delivered", "issue"],
        issue: ["out_for_delivery"],
      } as Record<string, string[]>
    )[status] || []
  );
}
export function fulfillmentStatus(d: Delivery, meal: string) {
  return d.status === "cancelled"
    ? "cancelled"
    : d.meals.find((m) => m.meal === meal)?.status || "cancelled";
}
export function scheduleSummary(rows: SellerDelivery[], meal: string) {
  const active = rows.filter(
    (d) =>
      d.status !== "cancelled" &&
      d.meals.some(
        (m) => m.status !== "cancelled" && (meal === "all" || m.meal === meal),
      ),
  );
  return {
    orders: active.length,
    portions: active.reduce(
      (n, d) =>
        n +
        d.portions *
          d.meals.filter(
            (m) =>
              m.status !== "cancelled" && (meal === "all" || m.meal === meal),
          ).length,
      0,
    ),
    customers: new Set(active.map((d) => d.customer.id)).size,
    destinations: new Set(
      active.map((d) =>
        [
          d.address.line.trim().toLowerCase(),
          d.address.area.trim().toLowerCase(),
        ].join("|"),
      ),
    ).size,
  };
}
