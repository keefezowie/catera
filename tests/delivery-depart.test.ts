import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";

type Day = { id: string; service_date: string };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const start = addDays(localDay(), 5);
// Departure is only for the Jakarta day itself: three subscriptions (two of Dapur Senja, one of Hijau Kitchen) are due today.
const today = localDay();
const tomorrow = addDays(today, 1);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const autoDeliver = (today: string) =>
  localRpc<number>(db, null, "catera_v1_system", ["delivery.autoDeliver", { today }], true);
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const earned = async (id: string) =>
  (await q<{ n: number }>("select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'", [id]))[0].n;
const dayStatus = async (id: string) =>
  (await q<{ status: string }>("select status from v1.delivery_days where id=$1", [id]))[0].status;
const mealRows = (id: string) =>
  q<{ meal: string; status: string; departed_at: string | null; confirmed_at: string | null; confirmed_by: string | null }>(
    "select meal,status,departed_at,confirmed_at,confirmed_by from v1.fulfillments where day_id=$1 order by meal",
    [id],
  );
const pushes = (kind: string) =>
  q<{ body: string; href: string }>(
    "select body,href from v1.notifications where kind=$1 and user_id=$2 order by body",
    [kind, U.customer],
  );

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
  both = await buy(P[2]);
  lunchSenja = await buy(P[4]);
  lunchHijau = await buy(P[3]);
  // Every test owns days with a fixed far-off date, so a nightly run in one test never reaches another's days.
  const dates: [Day, number][] = [
    [both[0], 0],
    [lunchSenja[0], 0],
    [lunchHijau[0], 0],
    [both[1], 42],
    [lunchSenja[1], 1],
    [both[2], 60],
    [lunchSenja[2], 70],
    [lunchSenja[3], 80],
    [lunchHijau[1], 90],
  ];
  for (const [day, offset] of dates) {
    day.service_date = addDays(localDay(), offset);
    await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, day.service_date]);
  }
});
afterAll(async () => db?.close());

const depart = (meal: string, user: string = U.owner, catererId = K[0]) =>
  cmd("delivery.depart", { catererId, date: today, meal }, user);

it("moves scheduled meals on the way once and notifies once", async () => {
  expect(await depart("lunch")).toEqual({ moved: 2 });
  for (const day of [both[0], lunchSenja[0]]) {
    const lunch = (await mealRows(day.id)).find((m) => m.meal === "lunch")!;
    expect(lunch.status).toBe("out_for_delivery");
    expect(lunch.departed_at).not.toBeNull();
    expect(await dayStatus(day.id)).toBe("out_for_delivery");
  }
  // The dinner of the same day, and another caterer's lunch, are untouched.
  expect((await mealRows(both[0].id)).find((m) => m.meal === "dinner")!.status).toBe("scheduled");
  expect((await mealRows(lunchHijau[0].id))[0].status).toBe("scheduled");
  // One push for the customer, although two of their packages from this caterer moved.
  expect(await pushes("delivery")).toEqual([{ body: "Makan siangmu sedang diantar dari Dapur Senja", href: "/today" }]);
  const outbox = await q<{ dedupe: string }>("select dedupe from v1.outbox where kind='push' and dedupe like 'depart:%' order by dedupe");
  expect(outbox.map((o) => o.dedupe)).toEqual([`depart:${U.customer}:${K[0]}:${today}:lunch`]);
  // A second call finds nothing left to move and sends nothing.
  expect(await depart("lunch")).toEqual({ moved: 0 });
  expect(await pushes("delivery")).toHaveLength(1);
  expect(await q("select 1 from v1.outbox where kind='push' and dedupe like 'depart:%'")).toHaveLength(1);
});

it("words the dinner departure for dinner", async () => {
  expect(await depart("dinner")).toEqual({ moved: 1 });
  const bodies = (await pushes("delivery")).map((n) => n.body);
  expect(bodies).toContain("Makan malammu sedang diantar dari Dapur Senja");
  expect(await dayStatus(both[0].id)).toBe("out_for_delivery");
});

it("does not notify again when the same departure is retried on a reached meal", async () => {
  // Someone else already took the meal back to scheduled and out again: dedupe still holds.
  await q("update v1.fulfillments set status='scheduled' where day_id=$1 and meal='lunch'", [lunchSenja[0].id]);
  expect(await depart("lunch")).toEqual({ moved: 1 });
  expect(await pushes("delivery")).toHaveLength(2);
});

it("staff may depart, another caterer may not", async () => {
  expect(await depart("lunch", U.staff)).toEqual({ moved: 0 });
  await expect(depart("lunch", U.owner, K[1])).rejects.toThrow("FORBIDDEN");
  await expect(depart("lunch", U.customer)).rejects.toThrow("FORBIDDEN");
  // Hijau Kitchen has no demo staff, so its lunch is still waiting and was not moved by Dapur Senja.
  expect((await mealRows(lunchHijau[0].id))[0].status).toBe("scheduled");
});

it("staff depart a fresh meal, and the customer is not told twice for the same caterer, day and meal", async () => {
  // The seeded Dapur Senja lunch subscription, due today as well.
  const [seeded] = await q<{ id: string }>(
    "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.package_id=$1 order by d.service_date limit 1",
    [P[0]],
  );
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [seeded.id, today]);
  expect(await cmd("delivery.depart", { catererId: K[0], date: today, meal: "lunch" }, U.staff)).toEqual({ moved: 1 });
  expect(await pushes("delivery")).toHaveLength(2);
});

it("refuses any date but the Jakarta day itself and moves nothing", async () => {
  const before = (await pushes("delivery")).length;
  for (const date of [tomorrow, addDays(today, -1), addDays(today, 41)])
    await expect(cmd("delivery.depart", { catererId: K[0], date, meal: "lunch" }, U.owner)).rejects.toThrow("INVALID_DATE");
  // Tomorrow's meal is still waiting, can still be changed by the customer, and nobody was notified.
  expect((await mealRows(lunchSenja[1].id))[0].status).toBe("scheduled");
  expect(await dayStatus(lunchSenja[1].id)).toBe("scheduled");
  expect((await pushes("delivery")).length).toBe(before);
});

it("rejects malformed departures", async () => {
  for (const payload of [
    { catererId: K[0], date: today, meal: "breakfast" },
    { catererId: K[0], date: "tomorrow", meal: "lunch" },
    { catererId: "nope", date: today, meal: "lunch" },
    { catererId: K[0], date: today },
    { catererId: K[0], date: today, meal: "lunch", extra: 1 },
  ])
    await expect(cmd("delivery.depart", payload, U.owner)).rejects.toThrow("INVALID_INPUT");
});

it("replays a departure request without moving anything again", async () => {
  await q("update v1.fulfillments set status='scheduled' where day_id=$1 and meal='lunch'", [both[0].id]);
  const id = crypto.randomUUID();
  const payload = { catererId: K[0], date: today, meal: "lunch" };
  const first = await localRpc<any>(db, U.owner, "catera_v1_command", ["delivery.depart", payload, id]);
  expect(first).toEqual({ moved: 1 });
  expect(await localRpc<any>(db, U.owner, "catera_v1_command", ["delivery.depart", payload, id])).toEqual({ moved: 1 });
  await expect(
    localRpc<any>(db, U.owner, "catera_v1_command", ["delivery.depart", { ...payload, meal: "dinner" }, id]),
  ).rejects.toThrow("CONFLICT");
});

it("auto-deliver holds a reported meal", async () => {
  const day = both[2];
  // A report is accepted only once the day has come: file it on yesterday, then return the day to
  // its own far-off date so this nightly run stays apart from the other tests' days.
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, addDays(localDay(), -1)]);
  const issue = await cmd("deliveryIssue.create", {
    deliveryId: day.id,
    meal: "lunch",
    subject: "Makanan tidak datang",
    body: "Ditunggu sampai jam dua siang",
  });
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, day.service_date]);
  const after = addDays(day.service_date, 1);
  await autoDeliver(after);
  // The reported lunch waits with no earning; the unreported dinner is delivered. The day keeps its status.
  const meals = await mealRows(day.id);
  expect(meals.find((m) => m.meal === "lunch")!.status).toBe("scheduled");
  expect(meals.find((m) => m.meal === "dinner")!.status).toBe("delivered");
  expect(await dayStatus(day.id)).toBe("scheduled");
  expect(await earned(day.id)).toBe(0);
  // Escalated reports are held too.
  await q("update v1.delivery_issues set status='escalated' where id=$1", [issue.id]);
  await autoDeliver(after);
  expect(await dayStatus(day.id)).toBe("scheduled");
  expect(await earned(day.id)).toBe(0);
  // Once the report is resolved, the next run delivers the meal and recognises the earning.
  await q("update v1.delivery_issues set status='resolved' where id=$1", [issue.id]);
  await autoDeliver(after);
  expect(await dayStatus(day.id)).toBe("delivered");
  expect(await earned(day.id)).toBe(1);
});

it("auto-deliver records confirmed_by auto", async () => {
  const day = lunchSenja[2];
  await autoDeliver(addDays(day.service_date, 1));
  expect(await dayStatus(day.id)).toBe("delivered");
  const [meal] = await mealRows(day.id);
  expect(meal.status).toBe("delivered");
  expect(meal.confirmed_by).toBe("auto");
  expect(meal.confirmed_at).not.toBeNull();
});

it("auto-deliver leaves a meal the caterer already delivered unconfirmed", async () => {
  const day = lunchSenja[3];
  await q("update v1.fulfillments set status='delivered' where day_id=$1", [day.id]);
  await autoDeliver(addDays(day.service_date, 1));
  expect(await dayStatus(day.id)).toBe("delivered");
  const [meal] = await mealRows(day.id);
  expect(meal.confirmed_by).toBeNull();
});

it("completes a subscription through the shared helper once its last open day is delivered", async () => {
  const sub = (await q<{ subscription_id: string }>("select subscription_id from v1.delivery_days where id=$1", [lunchHijau[1].id]))[0].subscription_id;
  await q("update v1.delivery_days set status='cancelled' where subscription_id=$1 and id<>$2", [sub, lunchHijau[1].id]);
  await q("update v1.fulfillments set status='cancelled' where day_id in (select id from v1.delivery_days where subscription_id=$1 and id<>$2)", [sub, lunchHijau[1].id]);
  await autoDeliver(addDays(lunchHijau[1].service_date, 1));
  expect((await q<{ status: string }>("select status from v1.subscriptions where id=$1", [sub]))[0].status).toBe("completed");
  await db.query("select v1.complete_subscription_if_done($1)", [sub]);
  expect((await q<{ status: string }>("select status from v1.subscriptions where id=$1", [sub]))[0].status).toBe("completed");
});
