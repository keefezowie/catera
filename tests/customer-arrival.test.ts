import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout, type CustomerState } from "@catera/domain";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let day: { id: string; service_date: string };
const start = addDays(localDay(), 5);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = async () => {
  const state = await localRpc<CustomerState>(db, U.customer, "catera_v1_read", ["customer", {}]);
  return state.deliveries.find((d) => d.id === day.id)!;
};

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
      "select d.id,d.service_date::text service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date limit 1",
      [checkout.id],
    )
  ).rows[0];
});
afterAll(async () => db?.close());

it("exposes departure, confirmation, reaction and open report per meal", async () => {
  const before = (await read()).meals[0];
  expect(before.departed_at).toBeNull();
  expect(before.confirmed_at).toBeNull();
  expect(before.reaction).toBeNull();
  expect(before.issue).toBeNull();

  const meal = before.meal;
  await db.query("update v1.fulfillments set departed_at=now() where day_id=$1 and meal=$2", [
    day.id,
    meal,
  ]);
  await db.query(
    `insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description)
     select f.day_id,f.meal,$2,p.caterer_id,'Makanan tidak datang','Ditunggu sampai jam dua'
     from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
     where f.day_id=$1 and f.meal=$3`,
    [day.id, U.customer, meal],
  );
  const after = (await read()).meals.find((m) => m.meal === meal)!;
  expect(after.departed_at).toBeTruthy();
  expect(after.confirmed_at).toBeNull();
  expect(after.reaction).toBeNull();
  expect(after.issue).toMatchObject({ status: "open" });
  expect(after.issue?.id).toEqual(expect.any(String));
});
