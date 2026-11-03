import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import {
  localDay,
  addDays,
  scheduleSummary,
  listsMeal,
  nextDeliveryStatuses,
  deliveryBatchSchema,
  type SellerOperationsState,
  type SellerCalendar,
} from "@catera/domain";
let db: PGlite;
// A day no demo state touches: the demo's own history runs from two weeks ago to yesterday.
const day = addDays(localDay(), -30);
const read = <T>(resource: string, params: object, user: string = U.owner) =>
  localRpc<T>(db, user, "catera_v1_read", [resource, params]);
const cmd = (payload: object, user: string = U.owner, request = crypto.randomUUID()) =>
  localRpc(db, user, "catera_v1_command", [
    "delivery.statusBatch",
    payload,
    request,
  ]);
async function fixture({
  status = "scheduled",
  address = "Jalan Sintetis 1",
  date = day,
  packageId = P[0],
} = {}) {
  const id = crypto.randomUUID(),
    sub = crypto.randomUUID();
  await db.query(
    `insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p)),2,$3,$3 from v1.packages p where id=$4`,
    [sub, U.customer, date, packageId],
  );
  await db.query(
    "insert into v1.delivery_days(id,subscription_id,service_date,address,status) values($1,$2,$3,$4,$5)",
    [
      id,
      sub,
      date,
      JSON.stringify({
        label: "Rumah",
        line: address,
        area: "Kelapa Gading",
        city: "Jakarta",
        instructions: "Sintetis",
      }),
      status,
    ],
  );
  await db.query(
    "insert into v1.fulfillments(day_id,meal,status) values($1,'lunch',$2),($1,'dinner','scheduled')",
    [id, status],
  );
  return { id, version: 1 };
}
const payload = (
  items: { id: string; version: number }[],
  status = "preparing",
) => ({ catererId: K[0], date: day, meal: "lunch", status, items });
beforeAll(async () => {
  db = await createDemoDatabase(true);
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("adds seller-only customer identity and preserves split addresses, combined order counts, and timezone default", async () => {
  await fixture();
  await fixture({ address: "Jalan Sintetis 2" });
  const s = await read<SellerOperationsState>("seller", {
    id: K[0],
    date: day,
  });
  expect(s.deliveries).toHaveLength(2);
  expect(s.deliveries.every((d) => d.customer.id === U.customer)).toBe(true);
  expect(scheduleSummary(s.deliveries, "all")).toEqual({
    orders: 2,
    portions: 8,
    customers: 1,
    destinations: 2,
  });
  expect(scheduleSummary(s.deliveries, "lunch").portions).toBe(4);
  const calendar = await read<SellerCalendar>("seller-calendar", {
    id: K[0],
    from: day,
    to: day,
    meal: "all",
  });
  expect(calendar.days).toEqual([
    { date: day, orders: 2, lunch: true, dinner: true },
  ]);
  await db.query(
    "update v1.caterers set timezone='Pacific/Kiritimati' where id=$1",
    [K[0]],
  );
  expect(
    (await read<SellerOperationsState>("seller", { id: K[0] })).operationalDate,
  ).toBe(localDay(new Date(), "Pacific/Kiritimati"));
  await db.query("update v1.caterers set timezone='Asia/Jakarta' where id=$1", [
    K[0],
  ]);
  const customer = await read<{ deliveries: object[] }>(
    "customer",
    { from: day, to: day },
    U.customer,
  );
  expect(customer.deliveries.every((d) => !("customer" in d))).toBe(true);
});
it("updates a batch once, keeping dinner independent and rejecting changed idempotency payloads", async () => {
  const a = await fixture(),
    b = await fixture();
  const p = payload([a, b]);
  const request = crypto.randomUUID();
  expect(await cmd(p, U.owner, request)).toEqual({ updated: 2 });
  expect(await cmd(p, U.owner, request)).toEqual({ updated: 2 });
  expect(
    (
      await db.query<{ status: string }>(
        "select status from v1.fulfillments where day_id=$1 order by meal",
        [a.id],
      )
    ).rows.map((x) => x.status),
  ).toEqual(["scheduled", "preparing"]);
  expect(
    (
      await db.query<{ version: number }>(
        "select version from v1.delivery_days where id=$1",
        [a.id],
      )
    ).rows[0].version,
  ).toBe(2);
  await expect(
    cmd({ ...p, status: "out_for_delivery" }, U.owner, request),
  ).rejects.toThrow("CONFLICT");
});
it("rolls back earlier rows, audit, receipts and notifications when a later version conflicts", async () => {
  const items = [await fixture(), await fixture()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  items[1].version = 99;
  const counts = async () =>
    (
      await db.query(
        "select (select count(*) from v1.audit) a,(select count(*) from v1.receipts) r,(select count(*) from v1.notifications) n",
      )
    ).rows;
  const before = await counts();
  await expect(cmd(payload(items))).rejects.toThrow("CONFLICT");
  expect(await counts()).toEqual(before);
  expect(
    (
      await db.query<{ status: string }>(
        "select status from v1.fulfillments where day_id=$1 and meal='lunch'",
        [items[0].id],
      )
    ).rows[0].status,
  ).toBe("scheduled");
});
it("rejects mixed transitions, duplicates, future days, cancelled deliveries and cross-tenant access", async () => {
  const a = await fixture(),
    b = await fixture({ status: "preparing" });
  await expect(cmd(payload([a, b]))).rejects.toThrow("INVALID_STATE");
  await expect(cmd(payload([a, a]))).rejects.toThrow("INVALID_INPUT");
  await expect(cmd(payload([a]), U.customer)).rejects.toThrow("FORBIDDEN");
  await expect(cmd({ ...payload([a]), catererId: K[1] })).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    read("seller-calendar", { id: K[1], from: day, to: day }),
  ).rejects.toThrow("FORBIDDEN");
  const cancelled = await fixture({ status: "cancelled" });
  await expect(cmd(payload([cancelled]))).rejects.toThrow("CONFLICT");
  const future = addDays(localDay(), 2),
    f = await fixture({ date: future });
  await expect(cmd({ ...payload([f]), date: future })).rejects.toThrow(
    "INVALID_DATE",
  );
  expect(nextDeliveryStatuses("delivered")).toEqual([]);
  // Sampai is offered only on the Jakarta day itself; a past day can still be reported as failed.
  expect(nextDeliveryStatuses("out_for_delivery")).toEqual(["arrived", "issue"]);
  expect(nextDeliveryStatuses("out_for_delivery", false, false)).toEqual(["issue"]);
  expect(nextDeliveryStatuses("issue", false, false)).toEqual(["out_for_delivery"]);
  expect(deliveryBatchSchema.safeParse(payload([a, a])).success).toBe(false);
});
it("filters calendar by package, meal and cancellation without counting cancelled production", async () => {
  const future = addDays(localDay(), 4);
  await fixture({ date: future, status: "cancelled" });
  const params = {
    id: K[0],
    from: future,
    to: future,
    packageId: P[0],
    meal: "dinner",
  };
  expect((await read<SellerCalendar>("seller-calendar", params)).days).toEqual(
    [],
  );
  expect(
    (
      await read<SellerCalendar>("seller-calendar", {
        ...params,
        status: "cancelled",
      })
    ).days,
  ).toEqual([{ date: future, orders: 1, lunch: false, dinner: true }]);
  expect(
    (
      await read<SellerCalendar>("seller-calendar", {
        ...params,
        packageId: P[1],
        status: "all",
      })
    ).days,
  ).toEqual([]);
  const state = await read<SellerOperationsState>("seller", {
    id: K[0],
    date: future,
  });
  expect(
    scheduleSummary(
      state.deliveries.filter((d) => d.status === "cancelled"),
      "all",
    ).portions,
  ).toBe(0);
});
it("counts a calendar day only while the asked meal is not cancelled", async () => {
  const cancelledDinner = addDays(localDay(), 300),
    issueDinner = addDays(localDay(), 301),
    cancelledBoth = addDays(localDay(), 302);
  const kept = await fixture({ date: cancelledDinner });
  await db.query("update v1.fulfillments set status='cancelled' where day_id=$1 and meal='dinner'", [kept.id]);
  const issue = await fixture({ date: issueDinner });
  await db.query("update v1.fulfillments set status='issue' where day_id=$1 and meal='dinner'", [issue.id]);
  const both = await fixture({ date: cancelledBoth });
  await db.query("update v1.fulfillments set status='cancelled' where day_id=$1", [both.id]);
  const calendar = async (date: string, meal: string, status?: string) =>
    (
      await read<SellerCalendar>("seller-calendar", {
        id: K[0],
        from: date,
        to: date,
        packageId: P[0],
        meal,
        ...(status ? { status } : {}),
      })
    ).days;
  // Lunch is kept, dinner is cancelled: Malam has no day, Siang and Semua still do.
  expect(await calendar(cancelledDinner, "dinner")).toEqual([]);
  expect(await calendar(cancelledDinner, "lunch")).toEqual([
    { date: cancelledDinner, orders: 1, lunch: true, dinner: false },
  ]);
  expect(await calendar(cancelledDinner, "all")).toEqual([
    { date: cancelledDinner, orders: 1, lunch: true, dinner: false },
  ]);
  // A meal marked Gagal diantar still counts: Dapur's failed-meal card and the web day list show it on that day.
  expect(await calendar(issueDinner, "dinner")).toEqual([
    { date: issueDinner, orders: 1, lunch: false, dinner: true },
  ]);
  expect(await calendar(issueDinner, "all")).toEqual([
    { date: issueDinner, orders: 1, lunch: true, dinner: true },
  ]);
  // Every meal cancelled: no day at all for any meal.
  expect(await calendar(cancelledBoth, "all")).toEqual([]);
  expect(await calendar(cancelledBoth, "lunch")).toEqual([]);
  // The calendar agrees with the kitchen's own day read and the web's active day list (listsMeal).
  const kitchen = await read<SellerOperationsState>("seller", { id: K[0], date: cancelledDinner });
  const keptRow = kitchen.deliveries.find((d) => d.id === kept.id)!;
  expect(keptRow.meals.find((m) => m.meal === "lunch")?.status).toBe("scheduled");
  expect(listsMeal(keptRow, "lunch")).toBe(true);
  expect(listsMeal(keptRow, "dinner")).toBe(false);
  expect(listsMeal(keptRow, "all")).toBe(true);
  const issueDay = await read<SellerOperationsState>("seller", { id: K[0], date: issueDinner });
  const issueRow = issueDay.deliveries.find((d) => d.id === issue.id)!;
  expect(issueRow.meals.find((m) => m.meal === "dinner")?.status).toBe("issue");
  expect(listsMeal(issueRow, "dinner")).toBe(true);
  const bothDay = await read<SellerOperationsState>("seller", { id: K[0], date: cancelledBoth });
  expect(listsMeal(bothDay.deliveries.find((d) => d.id === both.id)!, "all")).toBe(false);
  // A meal cancelled on a running day appears only under status=all; status=cancelled lists cancelled days.
  expect(await calendar(cancelledDinner, "dinner", "cancelled")).toEqual([]);
  expect(await calendar(cancelledDinner, "dinner", "all")).toEqual([
    { date: cancelledDinner, orders: 1, lunch: false, dinner: true },
  ]);
});
it("lists a day's delivery on the web only while its meal is not cancelled", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("apps/web/src/components/seller-operations.tsx", "utf8");
  // The active view (and /seller) filters rows with listsMeal, the same rule as seller-calendar.
  expect(source).toMatch(/includeCancelled\s*\?\s*meal === "all" \|\| d\.meals\.some\(\(m\) => m\.meal === meal\)\s*:\s*listsMeal\(d, meal\)/);
});
it("does not promise an auto-confirm time the scheduler does not keep yet", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("apps/web/src/components/seller-operations.tsx", "utf8");
  // The arrived-photo notice: the job runs daily until the scheduler is live, so no hour count.
  expect(source).not.toMatch(/dianggap sampai \d+ jam|counts as arrived \d+ hours?/);
  expect(source).toContain("ditandai sampai otomatis");
});
