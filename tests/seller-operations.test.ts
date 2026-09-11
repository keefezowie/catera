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
  nextDeliveryStatuses,
  deliveryBatchSchema,
  type SellerOperationsState,
  type SellerCalendar,
} from "@catera/domain";
let db: PGlite;
const day = addDays(localDay(), -1);
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
