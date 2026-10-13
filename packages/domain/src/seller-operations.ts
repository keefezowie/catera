import { z } from "zod";
import type { Delivery, SellerState } from "./index";

export type SellerDelivery = Delivery & {
  customer: { id: string; name: string; recordId?: string };
  /** The caterer's customer record behind this day (staff reads only); customer.deliveryChange needs one. */
  customerRecordId?: string | null;
};
export type SellerOperationsState = Omit<SellerState, "deliveries"> & {
  deliveries: SellerDelivery[];
  operationalDate: string;
  today: string;
  latestProduction?: {
    id: string;
    revision: number;
    createdAt: string;
    changed: boolean;
  } | null;
};
export type SellerCalendar = {
  days: { date: string; orders: number; lunch: boolean; dinner: boolean }[];
};
export const deliveryBatchSchema = z
  .object({
    catererId: z.uuid(),
    date: z.iso.date(),
    meal: z.enum(["lunch", "dinner"]),
    // Only the customer or the system closes a meal; the kitchen marks Sampai through delivery.arrive.
    status: z.enum(["preparing", "out_for_delivery", "issue"]),
    items: z
      .array(z.object({ id: z.uuid(), version: z.number().int().positive() }))
      .min(1)
      .max(500),
  })
  .refine(
    (p) => new Set(p.items.map((i) => i.id)).size === p.items.length,
    "Duplicate delivery",
  );
/** A stop the caterer selected, by delivery day id (one meal per command, so the day names the fulfilment). */
const stopIds = z
  .array(z.uuid())
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate delivery");
/** Proof photos live at {catererId}/{deliveryId}/{meal}/{uuid}.{ext} in the private proof bucket. */
export const proofPathPattern =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(lunch|dinner)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;
export const deliveryDepartSchema = z
  .object({
    catererId: z.uuid(),
    date: z.iso.date(),
    meal: z.enum(["lunch", "dinner"]),
    fulfillmentIds: stopIds.optional(),
  })
  .strict();
export const deliveryArriveSchema = z
  .object({
    catererId: z.uuid(),
    date: z.iso.date(),
    meal: z.enum(["lunch", "dinner"]),
    fulfillmentIds: stopIds,
    photos: z.record(z.uuid(), z.string().regex(proofPathPattern)),
  })
  .strict()
  .refine(
    (p) =>
      Object.keys(p.photos).length === p.fulfillmentIds.length &&
      p.fulfillmentIds.every((id) =>
        p.photos[id]?.startsWith(`${p.catererId}/${id}/${p.meal}/`),
      ),
    "Every stop needs its own photo",
  );
/**
 * What the workspace offers next for one meal. "arrived" is Sampai with a proof photo (delivery.arrive);
 * a stop already marked waits for the customer, so it is offered only "issue". delivery.arrive takes the
 * Jakarta day only, so Sampai is left out on any other date (`onToday` false).
 */
export function nextDeliveryStatuses(
  status: string,
  arrived = false,
  onToday = true,
): string[] {
  if (status === "out_for_delivery" && (arrived || !onToday)) return ["issue"];
  return (
    (
      {
        scheduled: ["preparing"],
        preparing: ["out_for_delivery"],
        out_for_delivery: ["arrived", "issue"],
        issue: ["out_for_delivery"],
      } as Record<string, string[]>
    )[status] || []
  );
}
/** Whether the kitchen already marked this meal Sampai. */
export function mealArrived(d: Delivery, meal: string) {
  return !!d.meals.find((m) => m.meal === meal)?.arrived_at;
}
export function fulfillmentStatus(d: Delivery, meal: string) {
  return d.status === "cancelled"
    ? "cancelled"
    : d.meals.find((m) => m.meal === meal)?.status || "cancelled";
}
export function destinationKey(address: SellerDelivery["address"]) {
  return JSON.stringify(
    [address.line, address.area, address.city].map((v) =>
      v.trim().toLowerCase().replace(/\s+/g, " "),
    ),
  );
}
export function scheduleSummary(
  rows: SellerDelivery[],
  meal: string,
  includeCancelled = false,
) {
  const active = rows.filter(
    (d) =>
      (includeCancelled || d.status !== "cancelled") &&
      d.meals.some(
        (m) =>
          (includeCancelled || m.status !== "cancelled") &&
          (meal === "all" || m.meal === meal),
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
              (includeCancelled || m.status !== "cancelled") &&
              (meal === "all" || m.meal === meal),
          ).length,
      0,
    ),
    customers: new Set(active.map((d) => d.customer.id)).size,
    destinations: new Set(active.map((d) => destinationKey(d.address))).size,
  };
}

/** Read-only workload: purchased portions per non-cancelled meal occurrence. */
export function mealWorkload(rows: SellerDelivery[], meal: "lunch" | "dinner") {
  const stages: Record<string, number> = {
    scheduled: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0,
    issue: 0,
  };
  for (const row of rows) {
    const status = fulfillmentStatus(row, meal);
    if (status in stages) stages[status] += row.portions;
  }
  return { ...scheduleSummary(rows, meal), stages };
}

/** Never substitute today's configured cutoff for a purchased delivery deadline. */
export function deliveryDeadlines(rows: SellerDelivery[], now: number) {
  const deadlines = new Map<string, number>();
  for (const row of rows) {
    if (
      row.status === "cancelled" ||
      !Number.isFinite(Date.parse(row.cutoff_at))
    )
      continue;
    const at = new Date(row.cutoff_at).toISOString();
    deadlines.set(at, (deadlines.get(at) || 0) + 1);
  }
  return [...deadlines]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([at, orders]) => ({ at, orders, passed: now >= Date.parse(at) }));
}

export function operationalGroups(
  rows: SellerDelivery[],
  meal: string,
  mode: string,
) {
  const groups = new Map<
    string,
    {
      key: string;
      name: string;
      area: string;
      menu: string;
      rows: SellerDelivery[];
      portions: number;
    }
  >();
  for (const row of rows) {
    const menus = row.offer.menus.filter(
      (m) => meal === "all" || m.meal === meal,
    );
    const signature = JSON.stringify(
      menus
        .map((m) => ({
          meal: m.meal,
          selectionStatus: m.selectionStatus,
          items: (m.items || [])
            .map((i) => [
              i.optionId || i.sourceDishId,
              i.optionVersion || i.sourceDishVersion,
              i.categoryId,
              i.name,
              i.serving,
              i.description,
              i.image,
            ])
            .sort(),
        }))
        .sort((a, b) => a.meal.localeCompare(b.meal)),
    );
    const area = mode === "area" ? row.address.area.trim() : "";
    const key =
      mode === "flat"
        ? "flat"
        : JSON.stringify([row.offer.id, signature, area.toLowerCase()]);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        name: row.offer.name,
        area,
        menu: menus
          .flatMap((m) => (m.items || []).map((i) => i.name))
          .filter(Boolean)
          .join(", "),
        rows: [],
        portions: 0,
      };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.portions += row.portions;
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.menu.localeCompare(b.menu) ||
      a.area.localeCompare(b.area),
  );
}
