import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout, type CustomerState } from "@catera/domain";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let day: { id: string; service_date: string; caterer_id: string };
const start = addDays(localDay(), 5);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = async (user: string = U.customer) =>
  (await localRpc<CustomerState>(db, user, "catera_v1_read", ["customer", {}])).deliveries.find(
    (d) => d.id === day.id,
  );
const attention = async () =>
  (
    await localRpc<any>(db, U.owner, "catera_v1_read", ["seller-attention", { id: day.caterer_id }])
  ).items.some((i: any) => i.kind === "production_changed");

beforeAll(async () => {
  db = await createDemoDatabase(true);
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId: P[2],
    addressId: A,
    portions: 1,
    startDate: start,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  day = (
    await db.query<any>(
      "select d.id,d.service_date::text service_date,p.caterer_id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where s.checkout_id=$1 order by d.service_date limit 1",
      [checkout.id],
    )
  ).rows[0];
});
afterAll(async () => db?.close());

it("is null while the demo has no verified owner phone", async () => {
  expect((await read())?.catererPhone).toBeNull();
});

it("shows the customer their own caterer's verified WhatsApp number, and no one else", async () => {
  // A production snapshot frozen before this key existed lacks it: the key must not count as a change.
  await cmd("production.freeze", { catererId: day.caterer_id, date: day.service_date }, U.owner);
  // Snapshots are immutable; rewrite the old shape past the trigger, as the fixture of a past release.
  await db.exec("set session_replication_role=replica");
  await db.query(
    "update v1.production set entries=(select coalesce(jsonb_agg(e-'catererPhone'),'[]') from jsonb_array_elements(entries) e) where caterer_id=$1 and service_date=$2",
    [day.caterer_id, day.service_date],
  );
  await db.exec("set session_replication_role=origin");
  expect(await attention()).toBe(false);

  // Supabase keeps phones without the plus sign; the app needs E.164.
  await db.exec("create table if not exists auth.users(id uuid primary key, phone text, phone_confirmed_at timestamptz)");
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'6281200000001',now())", [U.owner]);
  expect((await read())?.catererPhone).toBe("+6281200000001");
  expect(await attention()).toBe(false);

  // The seller's own read does not carry the key as a value: it is for the customer.
  expect((await read(U.owner))?.catererPhone ?? null).toBeNull();
  // A signed-out or other reader gets nothing.
  expect(
    JSON.stringify(await localRpc<any>(db, U.platform_admin, "catera_v1_read", ["customer", {}])),
  ).not.toContain("6281200000001");

  // An unverified number is not shown.
  await db.query("update auth.users set phone_confirmed_at=null where id=$1", [U.owner]);
  expect((await read())?.catererPhone).toBeNull();
});
