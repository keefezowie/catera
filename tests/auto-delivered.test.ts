import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let days: { id: string; service_date: string; amount: number }[];
const start = addDays(localDay(), 5);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const autoDeliver = (today: string) =>
  localRpc<number>(db, null, "catera_v1_system", ["delivery.autoDeliver", { today }], true);
const dayStatus = async (id: string) =>
  (await db.query<{ status: string }>("select status from v1.delivery_days where id=$1", [id]))
    .rows[0].status;
const earned = async (id: string) =>
  (
    await db.query<{ n: number }>(
      "select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'",
      [id],
    )
  ).rows[0].n;

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
  days = (
    await db.query<any>(
      "select d.id,d.service_date::text service_date,a.amount from v1.delivery_days d join v1.settlement_day_allocations a on a.day_id=d.id join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
      [checkout.id],
    )
  ).rows;
});
afterAll(async () => db?.close());

it("marks past undisputed days delivered and recognises one earning each", async () => {
  expect(days.length).toBeGreaterThan(2);
  const marked = await autoDeliver(addDays(days[0].service_date, 1));
  expect(marked).toBeGreaterThanOrEqual(1);
  expect(await dayStatus(days[0].id)).toBe("delivered");
  expect(await earned(days[0].id)).toBe(1);
  const meals = await db.query<{ status: string }>(
    "select status from v1.fulfillments where day_id=$1",
    [days[0].id],
  );
  expect(meals.rows.every((m) => m.status === "delivered")).toBe(true);
});

it("is idempotent", async () => {
  expect(await autoDeliver(addDays(days[0].service_date, 1))).toBe(0);
  expect(await earned(days[0].id)).toBe(1);
});

it("leaves the operating day itself and reported problems untouched", async () => {
  await db.query("update v1.fulfillments set status='issue' where day_id=$1", [days[1].id]);
  await db.query("update v1.delivery_days set status='issue' where id=$1", [days[1].id]);
  await autoDeliver(days[2].service_date);
  expect(await dayStatus(days[1].id)).toBe("issue");
  expect(await earned(days[1].id)).toBe(0);
  expect(await dayStatus(days[2].id)).toBe("scheduled");
});

it("skips an inconsistent day without blocking the rest of the run", async () => {
  // A day that already carries an earning while still scheduled must not abort the job.
  const [bad, good] = [days[3], days[4]];
  await db.query(
    "insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source) select a.caterer_id,a.id,d.day_id,'earned',d.amount,'synthetic-earlier' from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where d.day_id=$1",
    [bad.id],
  );
  await expect(autoDeliver(addDays(good.service_date, 1))).resolves.toBeGreaterThanOrEqual(1);
  expect(await dayStatus(good.id)).toBe("delivered");
  expect(await dayStatus(bad.id)).toBe("scheduled");
});

it("is refused to non-system callers", async () => {
  await expect(
    localRpc(db, U.owner, "catera_v1_system", ["delivery.autoDeliver", { today: start }]),
  ).rejects.toThrow();
});

it("never counts a day the customer reported as delivered", async () => {
  const day = days[days.length - 2];
  await db.query(
    `insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description)
     select f.day_id,f.meal,$2,p.caterer_id,'Makanan tidak datang','Ditunggu sampai jam dua'
     from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
     where f.day_id=$1 limit 1`,
    [day.id, U.customer],
  );
  await autoDeliver(addDays(day.service_date, 1));
  expect(await dayStatus(day.id)).toBe("scheduled");
  expect(await earned(day.id)).toBe(0);
});

it("leaves days from before the rule was switched on untouched", async () => {
  const day = days[days.length - 1];
  await db.query("update v1.auto_deliver_policy set since=$1::date + 1", [day.service_date]);
  await autoDeliver(addDays(day.service_date, 1));
  expect(await dayStatus(day.id)).toBe("scheduled");
  expect(await earned(day.id)).toBe(0);
});
