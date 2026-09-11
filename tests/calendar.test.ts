import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  addDays,
  localDay,
  type CustomerState,
  type Delivery,
} from "@catera/domain";
import { CalendarStore } from "../apps/web/src/lib/calendar-store";
import {
  activePackageCount,
  datesBetween,
  indexDeliveries,
  mealCoverage,
  monthEnd,
  shiftMonth,
  upcoming,
  validDay,
  weekStart,
} from "../apps/web/src/lib/meal-calendar";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS } from "../packages/backend/src/seed";

const delivery = (id: string, overrides: Partial<Delivery> = {}) =>
  ({
    id,
    service_date: "2026-09-10",
    status: "scheduled",
    portions: 3,
    meals: [
      { meal: "lunch", status: "scheduled" },
      { meal: "dinner", status: "scheduled" },
    ],
    offer: { caterer: "Synthetic kitchen" },
    ...overrides,
  }) as Delivery;
const state = (deliveries: Delivery[]): CustomerState => ({
  deliveries,
  subscriptions: [],
  addresses: [],
  cases: [],
  notifications: [],
  calendarMeta: { nextDeliveryDate: null, lastUpcomingDeliveryDate: null },
});

it("uses Monday weeks and real month boundaries including leap day and year rollover", () => {
  expect(weekStart("2026-09-13")).toBe("2026-09-07");
  expect(weekStart("2026-09-14")).toBe("2026-09-14");
  expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  expect(shiftMonth("2026-12-31", 1)).toBe("2027-01-01");
  expect(datesBetween("2028-02-28", "2028-03-01")).toHaveLength(3);
  expect(validDay("2026-02-30")).toBe(false);
  expect(validDay("2028-02-29")).toBe(true);
});
it("counts coverage once per day/meal regardless of portions and caterers; delivered still counts", () => {
  const day = indexDeliveries([
    delivery("a"),
    delivery("b", { portions: 9 }),
    delivery("c", { status: "delivered" }),
  ]).get("2026-09-10")!;
  expect(day.lunch).toBe(true);
  expect(day.dinner).toBe(true);
  expect(day.deliveries).toHaveLength(3);
  const cancelled = indexDeliveries([
    delivery("a", { status: "cancelled" }),
  ]).get("2026-09-10")!;
  expect(cancelled.lunch).toBe(false);
  expect(cancelled.dinner).toBe(false);
});
it("classifies every lunch and dinner coverage combination", () => {
  expect(mealCoverage(undefined)).toBe("none");
  expect(mealCoverage({ lunch: false, dinner: false })).toBe("none");
  expect(mealCoverage({ lunch: true, dinner: false })).toBe("lunch");
  expect(mealCoverage({ lunch: false, dinner: true })).toBe("dinner");
  expect(mealCoverage({ lunch: true, dinner: true })).toBe("both");
});
it("counts only packages with at least one non-cancelled covered meal", () => {
  const day = indexDeliveries([
    delivery("both"),
    delivery("lunch", {
      meals: [
        { meal: "lunch", status: "delivered" },
        { meal: "dinner", status: "cancelled" },
      ],
    }),
    delivery("cancelled-delivery", { status: "cancelled" }),
    delivery("cancelled-meals", {
      meals: [
        { meal: "lunch", status: "cancelled" },
        { meal: "dinner", status: "cancelled" },
      ],
    }),
  ]).get("2026-09-10");
  expect(activePackageCount(day)).toBe(2);
  expect(activePackageCount(undefined)).toBe(0);
});
it("uses independent meal statuses for coverage and upcoming agenda", () => {
  const d = delivery("a", {
    meals: [
      { meal: "lunch", status: "delivered" },
      { meal: "dinner", status: "cancelled" },
    ],
  });
  expect(indexDeliveries([d]).get(d.service_date)).toMatchObject({
    lunch: true,
    dinner: false,
  });
  expect(upcoming(d, "lunch")).toBe(false);
  expect(upcoming(d, "dinner")).toBe(false);
  expect(upcoming(delivery("b"), "dinner")).toBe(true);
});
it("deduplicates month requests and distinguishes loading from empty", async () => {
  let finish!: (s: CustomerState) => void;
  let calls = 0;
  const store = new CalendarStore(() => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = store.ensure("2026-09-01"),
    second = store.ensure("2026-09-10");
  expect(first).toBe(second);
  expect(store.months.get("2026-09-01")?.status).toBe("loading");
  await Promise.resolve();
  expect(calls).toBe(1);
  finish(state([]));
  await first;
  expect(store.months.get("2026-09-01")).toEqual({
    status: "ready",
    deliveries: [],
  });
});
it("retries failed months and replaces refreshed contents after a move", async () => {
  let call = 0;
  const store = new CalendarStore(async () => {
    call++;
    if (call === 1) throw Error("offline");
    return state(call === 2 ? [delivery("a")] : []);
  });
  await store.ensure("2026-09-01");
  expect(store.months.get("2026-09-01")?.status).toBe("error");
  await store.ensure("2026-09-01", true);
  expect(store.months.get("2026-09-01")?.deliveries).toHaveLength(1);
  await store.ensure("2026-09-01", true);
  expect(store.months.get("2026-09-01")?.deliveries).toEqual([]);
});
it("old customer/revision responses cannot overwrite the replacement store", async () => {
  let finish!: (s: CustomerState) => void;
  const old = new CalendarStore(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const request = old.ensure("2026-09-01");
  await Promise.resolve();
  const replacement = new CalendarStore(async () => state([]));
  await replacement.ensure("2026-09-01");
  finish(state([delivery("old")]));
  await request;
  expect(replacement.months.get("2026-09-01")?.deliveries).toEqual([]);
});

let db: PGlite;
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => {
  await db?.close();
});
const read = (params: unknown, actor: string | null = DEMO_ACTORS.customer) =>
  localRpc<CustomerState>(db, actor, "catera_v1_read", ["customer", params]);
it("metadata is opt-in, independent of requested range, and scoped to the signed-in customer", async () => {
  expect((await read({})).calendarMeta).toBeUndefined();
  const c = await read({
    calendarMeta: "true",
    from: "2040-01-01",
    to: "2040-01-31",
  });
  expect(c.deliveries).toEqual([]);
  expect(c.calendarMeta?.nextDeliveryDate).toBeTruthy();
  expect(
    (await read({ calendarMeta: "true" }, DEMO_ACTORS.owner)).calendarMeta,
  ).toEqual({ nextDeliveryDate: null, lastUpcomingDeliveryDate: null });
  await expect(read({ calendarMeta: "true" }, null)).rejects.toThrow(
    "UNAUTHORIZED",
  );
});
it("next delivery includes distant unfinished dinners but excludes completed/cancelled fulfillments", async () => {
  const before = await read({});
  const d = before.deliveries.find((d) =>
    d.meals.some((m) => m.meal === "dinner"),
  )!;
  await db.exec("update v1.fulfillments set status='delivered'");
  expect(
    (await read({ calendarMeta: "true" })).calendarMeta?.nextDeliveryDate,
  ).toBeNull();
  const distant = addDays(localDay(), 160);
  await db.query(
    "update v1.delivery_days set service_date=$1,status='scheduled' where id=$2",
    [distant, d.id],
  );
  await db.query(
    "update v1.fulfillments set status='scheduled' where day_id=$1 and meal='dinner'",
    [d.id],
  );
  expect((await read({ calendarMeta: "true" })).calendarMeta).toEqual({
    nextDeliveryDate: distant,
    lastUpcomingDeliveryDate: distant,
  });
  await db.query(
    "update v1.fulfillments set status='cancelled' where day_id=$1 and meal='dinner'",
    [d.id],
  );
  expect(
    (await read({ calendarMeta: "true" })).calendarMeta?.nextDeliveryDate,
  ).toBeNull();
});
