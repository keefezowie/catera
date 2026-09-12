import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U, CATERER_IDS as K, PACKAGE_IDS as P, ADDRESS_ID } from "../packages/backend/src/seed";
import { addDays, localDay, type Offer, type Checkout, type CustomerState } from "@catera/domain";
let db: PGlite, base: Offer;
const read = <T>(resource: string, params = {}, actor: string | null = U.owner) => localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const cmd = <T = any>(action: string, payload: unknown, actor: string | null = U.owner, key = crypto.randomUUID()) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, key]);
const state = () => read<{ offers: Offer[] }>("seller", { id: K[0] });
const args = (o: Offer) => ({ catererId: K[0], id: o.id, version: o.version });
async function create(status = "published") {
  const r = await cmd("package.save", { catererId: K[0], slug: "lifecycle-" + crypto.randomUUID(), offer: { ...base, status, days: 1 } });
  return (await state()).offers.find(o => o.id === r.id)!;
}
const input = (id: string) => ({ packageId: id, addressId: ADDRESS_ID, portions: 1, startDate: addDays(localDay(), 20), trial: false });
beforeAll(async () => { db = await createDemoDatabase(true); base = (await state()).offers.find(o => o.id === P[0])!; });
afterAll(async () => db?.close());

it("allows draft completion but rejects every published term and status rewrite", async () => {
  let o = await create("draft");
  await cmd("package.save", { ...args(o), offer: { ...o, status: "published" } });
  o = (await state()).offers.find(p => p.id === o.id)!;
  for (const change of [{ price: o.price + 1000 }, { status: "draft" }, { status: "retired" }, { menus: [] }]) {
    await expect(cmd("package.save", { ...args(o), offer: { ...o, ...change } })).rejects.toThrow("PACKAGE_IMMUTABLE");
  }
  expect((await state()).offers.find(p => p.id === o.id)).toEqual(o);
  await expect(cmd("package.archive", args(o))).rejects.toThrow("SUSPEND_FIRST");
  await expect(cmd("package.save", { catererId: K[0], slug: crypto.randomUUID(), offer: { ...base, status: "retired" } })).rejects.toThrow("INVALID_STATE");
});

it("enforces owner authorization, stale versions, idempotency and audit atomically", async () => {
  const o = await create(), key = crypto.randomUUID();
  for (const user of [U.staff, U.customer, null]) await expect(cmd("package.suspend", args(o), user)).rejects.toThrow(user ? "FORBIDDEN" : "UNAUTHORIZED");
  await expect(cmd("package.suspend", { ...args(o), catererId: K[1] })).rejects.toThrow("FORBIDDEN");
  const result = await cmd("package.suspend", args(o), U.owner, key);
  expect(await cmd("package.suspend", args(o), U.owner, key)).toEqual(result);
  await expect(cmd("package.archive", args(o))).rejects.toThrow("CONFLICT");
  expect((await db.query("select * from v1.audit where details->>'requestId'=$1", [key])).rows).toHaveLength(1);
});

it("hides suspended offers and rejects checkout/import while preserving existing deliveries", async () => {
  const o = await create();
  const c = await cmd<Checkout>("checkout.create", input(o.id), U.customer);
  await cmd("checkout.demo_pay", { id: c.id }, U.customer);
  const before = await read<CustomerState>("customer", {}, U.customer);
  await cmd("package.suspend", args(o));
  expect((await read<{ items: Offer[] }>("catalog", {}, null)).items.some(p => p.id === o.id)).toBe(false);
  await expect(cmd("checkout.create", input(o.id), U.customer)).rejects.toThrow("NOT_AVAILABLE");
  await expect(read("quote", input(o.id), U.customer)).rejects.toThrow("NOT_AVAILABLE");
  await expect(cmd("import.preview", { catererId: K[0], rows: [{ ...input(o.id), customerId: U.customer, remainingDays: 1, externalReference: crypto.randomUUID() }] })).rejects.toThrow("NOT_AVAILABLE");
  const after = await read<CustomerState>("customer", {}, U.customer);
  expect(after.subscriptions).toEqual(before.subscriptions);
  expect(after.deliveries).toEqual(before.deliveries);
  const suspended = (await state()).offers.find(p => p.id === o.id)!;
  expect(suspended.canArchive).toBe(false);
  await expect(cmd("package.archive", args(suspended))).rejects.toThrow("PACKAGE_HAS_DELIVERIES");
  // Advance the synthetic delivery to today, then use actual fulfillment commands.
  const days = await db.query<{ id: string }>("update v1.delivery_days set service_date=current_date where subscription_id=$1 returning id", [after.subscriptions.find(s => s.package_id === o.id)!.id]);
  for (const d of days.rows) {
    const meals = await db.query<{ meal: string }>("select meal from v1.fulfillments where day_id=$1", [d.id]);
    let version = 1;
    for (const { meal } of meals.rows) for (const status of ["preparing", "out_for_delivery", "delivered"]) await cmd("delivery.status", { id: d.id, version: version++, meal, status });
  }
  expect((await state()).offers.find(p => p.id === o.id)!.canArchive).toBe(true);
  await cmd("package.archive", args(suspended));
  expect((await state()).offers.find(p => p.id === o.id)!.status).toBe("retired");
});

it("keeps valid checkout holds payable during suspension and prevents early archive", async () => {
  const o = await create();
  const c = await cmd<Checkout>("checkout.create", input(o.id), U.customer);
  await cmd("package.suspend", args(o));
  const suspended = (await state()).offers.find(p => p.id === o.id)!;
  await expect(cmd("package.archive", args(suspended))).rejects.toThrow("PACKAGE_HAS_DELIVERIES");
  expect((await cmd("checkout.demo_pay", { id: c.id }, U.customer)).subscriptionId).toBeTruthy();
  await expect(cmd("package.archive", args(suspended))).rejects.toThrow("PACKAGE_HAS_DELIVERIES");
});

it("archives after holds expire and sends late payments to support without reactivation", async () => {
  const o = await create();
  const c = await cmd<Checkout>("checkout.create", input(o.id), U.customer);
  await cmd("package.suspend", args(o));
  await db.query("update v1.checkouts set expires_at=now()-interval '1 minute' where id=$1", [c.id]);
  const suspended = (await state()).offers.find(p => p.id === o.id)!;
  expect(suspended.canArchive).toBe(true);
  await cmd("package.archive", args(suspended));
  expect((await cmd("checkout.demo_pay", { id: c.id }, U.customer)).subscriptionId).toBeNull();
  expect((await db.query<{ state: string }>("select state from v1.checkouts where id=$1", [c.id])).rows[0].state).toBe("payment_exception");
  expect((await db.query("select * from v1.support_cases where checkout_id=$1", [c.id])).rows).toHaveLength(1);
  const archived = (await state()).offers.find(p => p.id === o.id)!;
  await expect(cmd("package.suspend", args(archived))).rejects.toThrow("INVALID_STATE");
});
