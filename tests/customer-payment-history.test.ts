import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { ADDRESS_ID, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";

// C-03: Riwayat pembayaran tells "still to pay" from "being checked", and keeps recent expired checkouts.
let db: PGlite, source: string, sourceQuote: any;
const read = (actor: string) => localRpc<any>(db, actor, "catera_v1_read", ["customer-actions", { limit: 20 }]);
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;

/** A synthetic checkout for `user`, cloned from one bought through the public command. */
async function checkout(user: string, state: string, expires: string, extra: { mode?: string; created?: string } = {}) {
  // The demo database sells hosted payments; lift the mode guard only to give a test a direct checkout.
  if (extra.mode === "direct") await q("alter table v1.checkouts disable trigger checkout_direct_mode");
  const [row] = await q(
    `insert into v1.checkouts(user_id,package_id,address_id,quote,state,expires_at,payment_mode,created_at)
     select $1,package_id,address_id,quote,$3,$4::timestamptz,$5,coalesce($6::timestamptz,now()) from v1.checkouts where id=$2 returning id`,
    [user, source, state, expires, extra.mode ?? "hosted", extra.created ?? null],
  );
  if (extra.mode === "direct") await q("alter table v1.checkouts enable trigger checkout_direct_mode");
  return row.id as string;
}
const operation = (id: string, state: string, result: object = {}) =>
  q(
    `insert into v1.provider_operations(kind,entity_id,merchant,reference,amount,state,payment_mode,channel,result)
     values('payment',$1::uuid,'synthetic-merchant',$4,1000,$2,'direct','QRIS',$3::jsonb)`,
    [id, state, JSON.stringify(result), "CT" + id.replaceAll("-", "")],
  );
async function customer() {
  const id = crypto.randomUUID();
  await q("insert into v1.profiles(id,name) values($1,'Synthetic payment history customer')", [id]);
  return id;
}
const minutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeAll(async () => {
  db = await createDemoDatabase(true);
  const created = await localRpc<any>(db, U.customer, "catera_v1_command", [
    "checkout.create",
    { acceptedTerms: true, packageId: P[2], addressId: ADDRESS_ID, portions: 2, startDate: addDays(localDay(), 120), trial: false },
    crypto.randomUUID(),
  ]);
  source = created.id;
  sourceQuote = (await q("select quote from v1.checkouts where id=$1", [source]))[0].quote;
});
afterAll(async () => db?.close());

it("a checkout waiting for payment within its hold is still to pay, never 'being checked'", async () => {
  const user = await customer();
  const hosted = await checkout(user, "pending", minutes(12));
  const direct = await checkout(user, "pending", minutes(12), { mode: "direct" });
  await operation(direct, "pending", { instructions: { kind: "qris", qrContent: "SYNTHETIC" } });
  const preparing = await checkout(user, "pending", minutes(12), { mode: "direct" });
  await operation(preparing, "submitting");
  const status = Object.fromEntries((await read(user)).items.map((i: any) => [i.id, i.status]));
  expect(status).toEqual({
    ["payment-" + hosted]: "awaiting_payment",
    ["payment-" + direct]: "awaiting_payment",
    ["payment-" + preparing]: "awaiting_payment",
  });
});

it("says 'being checked' only when a payment was received or the provider is still answering", async () => {
  const user = await customer();
  const received = await checkout(user, "pending", minutes(12), { mode: "direct" });
  await operation(received, "succeeded", { instructions: { kind: "qris", qrContent: "SYNTHETIC" } });
  const review = await checkout(user, "payment_exception", minutes(-30));
  // The hold ran out while the bank still had the virtual account open: Bayar says it is checking.
  const late = await checkout(user, "pending", minutes(-2), { mode: "direct" });
  await operation(late, "pending", { instructions: { kind: "qris", qrContent: "SYNTHETIC" } });
  const feed = await read(user);
  const status = Object.fromEntries(feed.items.map((i: any) => [i.id, i.status]));
  expect(status).toEqual({ ["payment-" + received]: "checking_payment", ["payment-" + review]: "payment_exception" });
  expect(feed.ended.map((i: any) => [i.id, i.status])).toEqual([["payment-" + late, "checking_payment"]]);
});

it("keeps expired and failed checkouts of the last 7 days, newest first, with what Bayar lagi needs", async () => {
  const user = await customer();
  const lapsed = await checkout(user, "pending", minutes(-5));
  const expired = await checkout(user, "expired", days(-3));
  const failed = await checkout(user, "failed", days(-1));
  await checkout(user, "expired", days(-8));
  const feed = await read(user);
  expect(feed.items).toEqual([]);
  expect(feed.total).toBe(0);
  expect(feed.ended.map((i: any) => i.id)).toEqual(["payment-" + lapsed, "payment-" + failed, "payment-" + expired]);
  expect(feed.ended[0]).toMatchObject({
    kind: "payment_action",
    status: "expired",
    href: "/payment/" + lapsed,
    packageName: sourceQuote.offer.name,
    catererName: sourceQuote.offer.caterer,
    payAgain: { packageId: P[2], portions: 2, trial: false, cycles: sourceQuote.cycles ?? 1, addressId: ADDRESS_ID },
  });
  expect(feed.ended[0].payAgain).not.toHaveProperty("renewedFrom");
  // A failed payment says so; one that ran out does not.
  expect(feed.ended.map((i: any) => i.paymentFailed ?? false)).toEqual([false, true, false]);
});

it("drops an expired checkout once the same package was bought or is waiting again", async () => {
  const user = await customer();
  await checkout(user, "expired", days(-2), { created: days(-2) });
  const again = await checkout(user, "pending", minutes(10));
  const feed = await read(user);
  expect(feed.ended).toEqual([]);
  expect(feed.items.map((i: any) => i.id)).toEqual(["payment-" + again]);
});

it("shows nobody else's checkouts and gives a fresh customer an empty history", async () => {
  const user = await customer();
  const other = await customer();
  await checkout(other, "expired", days(-1));
  expect(await read(user)).toEqual({ total: 0, items: [], ended: [] });
});
