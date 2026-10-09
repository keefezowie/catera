import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout, type CustomerState } from "@catera/domain";
import { setAsideDemoKitchenDay } from "./fixtures/set-aside-demo-day";

type Day = { id: string; service_date: string };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const start = addDays(localDay(), 5);
// Cooking is only for the Jakarta day itself: three subscriptions (two of Dapur Senja, one of Hijau Kitchen) are due today.
const today = localDay();
const tomorrow = addDays(today, 1);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const autoDeliver = (day: string) =>
  localRpc<number>(db, null, "catera_v1_system", ["delivery.autoDeliver", { today: day }], true);
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const dayStatus = async (id: string) =>
  (await q<{ status: string }>("select status from v1.delivery_days where id=$1", [id]))[0].status;
type MealRow = { meal: string; status: string; cooking_started_at: string | null; departed_at: string | null };
const mealRows = (id: string) =>
  q<MealRow>(
    "select meal,status,cooking_started_at::text cooking_started_at,departed_at::text departed_at from v1.fulfillments where day_id=$1 order by meal",
    [id],
  );
const meal = async (id: string, which: string) => (await mealRows(id)).find((m) => m.meal === which)!;
const pushCount = async () => (await q("select 1 from v1.outbox where kind='push'")).length;
const eventCount = async (user: string) =>
  (await q("select 1 from public.catera_v1_events where user_id=$1 and topic='delivery.changed'", [user])).length;
const auditCount = async () =>
  (await q("select 1 from v1.audit where action='delivery.cook'")).length;

async function buy(packageId: string): Promise<Day[]> {
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId,
    addressId: A,
    portions: 1,
    startDate: start,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  return q<Day>(
    "select d.id,d.service_date::text service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
    [checkout.id],
  );
}

let both: Day[]; // Rantang Nusantara: lunch and dinner, Dapur Senja
let lunchSenja: Day[]; // Ayam Sambal Rumahan, Dapur Senja
let lunchHijau: Day[]; // Plant-based Everyday, Hijau Kitchen
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await setAsideDemoKitchenDay(db);
  both = await buy(P[2]);
  lunchSenja = await buy(P[4]);
  lunchHijau = await buy(P[3]);
  // Every test owns days with a fixed date, so a nightly run in one test never reaches another's days.
  const dates: [Day, number][] = [
    [both[0], 0],
    [lunchSenja[0], 0],
    [lunchHijau[0], 0],
    [both[1], 1],
    [lunchSenja[1], 3],
    [lunchSenja[2], 70],
  ];
  for (const [day, offset] of dates) {
    day.service_date = addDays(localDay(), offset);
    await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, day.service_date]);
  }
});
afterAll(async () => db?.close());

const cook = (meal: string, user: string = U.owner, catererId = K[0]) =>
  cmd("delivery.cook", { catererId, date: today, meal }, user);
const depart = (meal: string) => cmd("delivery.depart", { catererId: K[0], date: today, meal }, U.owner);

it("owner cooks today's lunch", async () => {
  const [pushes, events, audits] = [await pushCount(), await eventCount(U.customer), await auditCount()];
  const waiting = await q<{ n: number }>(
    `select count(*)::int n from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id
     join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
     where p.caterer_id=$1 and d.service_date=$2::date and f.meal='lunch' and f.status='scheduled'`,
    [K[0], today],
  );
  expect(waiting[0].n).toBe(2);
  expect(await cook("lunch")).toEqual({ moved: waiting[0].n });
  for (const day of [both[0], lunchSenja[0]]) {
    const lunch = await meal(day.id, "lunch");
    expect(lunch.status).toBe("preparing");
    expect(lunch.cooking_started_at).not.toBeNull();
    expect(lunch.departed_at).toBeNull();
    expect(await dayStatus(day.id)).toBe("preparing");
  }
  // The dinner of the same day, and another caterer's lunch, are untouched.
  const dinner = await meal(both[0].id, "dinner");
  expect(dinner.status).toBe("scheduled");
  expect(dinner.cooking_started_at).toBeNull();
  expect((await mealRows(lunchHijau[0].id))[0].status).toBe("scheduled");
  // No push (Ruling C2). One realtime event for the customer and one audit row.
  expect(await pushCount()).toBe(pushes);
  expect(await eventCount(U.customer)).toBe(events + 1);
  expect(await auditCount()).toBe(audits + 1);
});

it("cooking twice moves nothing", async () => {
  const before = (await meal(both[0].id, "lunch")).cooking_started_at;
  expect(await cook("lunch")).toEqual({ moved: 0 });
  expect((await meal(both[0].id, "lunch")).cooking_started_at).toBe(before);
  expect((await meal(both[0].id, "lunch")).status).toBe("preparing");
});

it("depart after cook moves the preparing rows and keeps cooking_started_at", async () => {
  const stamps = [await meal(both[0].id, "lunch"), await meal(lunchSenja[0].id, "lunch")].map((m) => m.cooking_started_at);
  expect(stamps.every((s) => s !== null)).toBe(true);
  expect(await depart("lunch")).toEqual({ moved: 2 });
  for (const [i, day] of [both[0], lunchSenja[0]].entries()) {
    const lunch = await meal(day.id, "lunch");
    expect(lunch.status).toBe("out_for_delivery");
    expect(lunch.departed_at).not.toBeNull();
    expect(lunch.cooking_started_at).toBe(stamps[i]);
    expect(await dayStatus(day.id)).toBe("out_for_delivery");
  }
});

it("cook after depart moves nothing", async () => {
  expect(await cook("lunch")).toEqual({ moved: 0 });
  for (const day of [both[0], lunchSenja[0]]) {
    const lunch = await meal(day.id, "lunch");
    expect(lunch.status).toBe("out_for_delivery");
    expect(await dayStatus(day.id)).toBe("out_for_delivery");
  }
});

it("staff can cook; others cannot", async () => {
  // Cooking only takes scheduled meals: the dinner of the day that is already on the road.
  expect(await cook("dinner", U.staff)).toEqual({ moved: 1 });
  const dinner = await meal(both[0].id, "dinner");
  expect(dinner.status).toBe("preparing");
  expect(dinner.cooking_started_at).not.toBeNull();
  // The day was already out for delivery: cooking does not pull it back.
  expect(await dayStatus(both[0].id)).toBe("out_for_delivery");
  await expect(cook("lunch", U.customer)).rejects.toThrow("FORBIDDEN");
  await expect(cook("lunch", U.owner, K[1])).rejects.toThrow("FORBIDDEN");
  // Hijau Kitchen has no demo staff, so its lunch was not reached by Dapur Senja.
  expect((await mealRows(lunchHijau[0].id))[0].status).toBe("scheduled");
});

it("rejects bad input", async () => {
  const pushes = await pushCount();
  for (const date of [tomorrow, addDays(today, -1)])
    await expect(cmd("delivery.cook", { catererId: K[0], date, meal: "lunch" }, U.owner)).rejects.toThrow("INVALID_DATE");
  // Tomorrow's meal is still waiting and can still be changed by the customer.
  expect((await mealRows(both[1].id)).find((m) => m.meal === "lunch")!.status).toBe("scheduled");
  expect(await dayStatus(both[1].id)).toBe("scheduled");
  for (const payload of [
    { catererId: K[0], date: today, meal: "brunch" },
    { catererId: K[0], date: "tomorrow", meal: "lunch" },
    { catererId: "nope", date: today, meal: "lunch" },
    { catererId: K[0], date: today },
    { catererId: K[0], date: today, meal: "lunch", extra: 1 },
  ])
    await expect(cmd("delivery.cook", payload, U.owner)).rejects.toThrow("INVALID_INPUT");
  expect(await pushCount()).toBe(pushes);
});

it("replays by request id", async () => {
  await q("update v1.fulfillments set status='scheduled',cooking_started_at=null,departed_at=null where day_id=$1 and meal='lunch'", [both[0].id]);
  const id = crypto.randomUUID();
  const payload = { catererId: K[0], date: today, meal: "lunch" };
  const run = (body: object) => localRpc<any>(db, U.owner, "catera_v1_command", ["delivery.cook", body, id]);
  expect(await run(payload)).toEqual({ moved: 1 });
  const stamp = (await meal(both[0].id, "lunch")).cooking_started_at;
  expect(await run(payload)).toEqual({ moved: 1 });
  expect((await meal(both[0].id, "lunch")).cooking_started_at).toBe(stamp);
  await expect(run({ ...payload, meal: "dinner" })).rejects.toThrow("CONFLICT");
});

it("the delivery read exposes cooking and arrival facts", async () => {
  const read = async (day: Day) => {
    const state = await localRpc<CustomerState>(db, U.customer, "catera_v1_read", ["customer", {}]);
    return (state.deliveries.find((d) => d.id === day.id) as any).meals as any[];
  };
  const cooked = (await read(both[0])).find((m) => m.meal === "lunch");
  expect(cooked.cooking_started_at).toEqual(expect.any(String));
  expect(cooked.confirmed_by).toBeNull();
  const waiting = (await read(both[1]))[0];
  expect(waiting.cooking_started_at).toBeNull();
  expect(waiting.confirmed_by).toBeNull();
  // A meal the nightly job delivers records who confirmed it, and keeps its cooking time.
  const day = lunchSenja[1];
  await q("update v1.fulfillments set status='preparing',cooking_started_at=now() where day_id=$1", [day.id]);
  await autoDeliver(addDays(day.service_date, 1));
  const done = (await read(day))[0];
  expect(done.status).toBe("delivered");
  expect(done.confirmed_by).toBe("auto");
  expect(done.cooking_started_at).toEqual(expect.any(String));
});

it("cooking is not a production change", async () => {
  const attention = async () =>
    (await localRpc<any>(db, U.owner, "catera_v1_read", ["seller-attention", { id: K[0] }])).items.some(
      (i: any) => i.kind === "production_changed",
    );
  const signature = async () =>
    (
      await q<{ s: unknown }>(
        "select v1.beta_production_signature(jsonb_agg(v1.delivery(d))) s from v1.delivery_days d where d.id=any($1::uuid[])",
        [[lunchSenja[2].id]],
      )
    )[0].s;
  // A day of Dapur Senja far enough ahead that nothing else touches it: put it on today, freeze, then cook.
  const day = lunchSenja[2];
  // One subscription cannot have two days on one date: its earlier day goes to the past.
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [lunchSenja[0].id, addDays(today, -5)]);
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, today]);
  await cmd("production.freeze", { catererId: K[0], date: today }, U.owner);
  expect(await attention()).toBe(false);
  const before = await signature();
  expect(await cook("lunch")).toEqual({ moved: 1 });
  expect((await meal(day.id, "lunch")).status).toBe("preparing");
  expect(await signature()).toEqual(before);
  expect(await attention()).toBe(false);
  // Setting off is not masked: a move to out_for_delivery still raises the warning (caterer-ux AT-11).
  await q("update v1.fulfillments set status='out_for_delivery' where day_id=$1 and meal='lunch'", [day.id]);
  await q("update v1.delivery_days set status='out_for_delivery',version=version+1 where id=$1", [day.id]);
  expect(await attention()).toBe(true);
  await q("update v1.fulfillments set status='preparing' where day_id=$1 and meal='lunch'", [day.id]);
  await q("update v1.delivery_days set status='preparing',version=version+1 where id=$1", [day.id]);
  expect(await attention()).toBe(false);
  // A real change of what the kitchen makes or where it goes still counts.
  await q(
    "update v1.delivery_days set address=jsonb_set(address,'{instructions}','\"Synthetic new delivery instruction\"'),version=version+1 where id=$1",
    [day.id],
  );
  expect(await attention()).toBe(true);
});
