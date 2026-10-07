import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout, type CustomerState } from "@catera/domain";

type Day = { id: string; service_date: string };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const start = addDays(localDay(), 5);
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const run = (action: string, payload: object, requestId: string, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, requestId]);
const read = async (id: string) => {
  const state = await localRpc<CustomerState>(db, U.customer, "catera_v1_read", ["customer", {}]);
  return state.deliveries.find((d) => d.id === id)!;
};
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const earned = async (id: string) =>
  (await q<{ n: number }>("select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'", [id]))[0].n;
const dayStatus = async (id: string) =>
  (await q<{ status: string }>("select status from v1.delivery_days where id=$1", [id]))[0].status;
const meals = (id: string) =>
  q<{ meal: string; status: string; confirmed_by: string | null }>(
    "select meal,status,confirmed_by from v1.fulfillments where day_id=$1 order by meal",
    [id],
  );
// The purchased offer is a frozen snapshot; lift its guard only to give a test a known window.
const setWindow = async (id: string, lunch: string, dinner = lunch) => {
  await q("alter table v1.subscriptions disable trigger subscription_terms");
  await q(
    `update v1.subscriptions s set snapshot=jsonb_set(s.snapshot,'{offer,windows}',jsonb_build_object('lunch',$2::text,'dinner',$3::text))
     from v1.delivery_days d where d.id=$1 and s.id=d.subscription_id`,
    [id, lunch, dinner],
  );
  await q("alter table v1.subscriptions enable trigger subscription_terms");
};

let parked = 0;
let pool: (Day & { subscription_id: string })[] = [];
async function buy(packageId: string, startDate: string) {
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId,
    addressId: A,
    portions: 1,
    startDate,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  return q<Day & { subscription_id: string }>(
    "select d.id,d.subscription_id,d.service_date::text service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
    [checkout.id],
  );
}
// Each test takes one unused synthetic day (the two packages give 15; a new test needs a new package or a reused day).
async function newDay() {
  const day = pool.shift();
  expect(day, "not enough synthetic days").toBeTruthy();
  return day!;
}

// A fresh day moved to the given Jakarta date, every meal in the given state.
async function prepare(date: string, status = "out_for_delivery", existing?: Day & { subscription_id: string }): Promise<any> {
  const day = existing ?? (await newDay());
  // A subscription cannot have two days on one date: park the earlier test's day first.
  await q(
    "update v1.delivery_days set service_date='2020-01-01'::date + $4::int where subscription_id=$1 and service_date=$2::date and id<>$3",
    [day.subscription_id, date, day.id, parked++],
  );
  await q("update v1.delivery_days set service_date=$2::date, status=$3 where id=$1", [day.id, date, status]);
  await q("update v1.fulfillments set status=$2 where day_id=$1", [day.id, status]);
  return day;
}
const confirmAll = async (id: string, extra: object = {}, user: string = U.customer) => {
  let last: any;
  for (const m of await meals(id))
    last = await cmd("delivery.confirm", { deliveryId: id, meal: m.meal, ...extra }, user);
  return last;
};

beforeAll(async () => {
  db = await createDemoDatabase(true);
  pool = [...(await buy(P[2], start)), ...(await buy(P[3], start))];
});
afterAll(async () => db?.close());

it("confirms an on-the-way meal for its owner and records one earning", async () => {
  const day = await prepare(localDay());
  const result = await confirmAll(day.id);
  expect(result).toMatchObject({ status: "delivered" });
  expect(result.confirmedAt).toBeTruthy();
  const seen = await read(day.id);
  expect(seen.status).toBe("delivered");
  expect(seen.meals[0].status).toBe("delivered");
  expect(seen.meals[0].confirmed_at).toBeTruthy();
  expect((await meals(day.id)).every((m) => m.confirmed_by === "customer")).toBe(true);
  expect(await earned(day.id)).toBe(1);
});

it("refuses another customer", async () => {
  const day = await prepare(localDay());
  const [m] = await meals(day.id);
  await expect(
    cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal }, U.owner),
  ).rejects.toThrow("FORBIDDEN");
  expect((await meals(day.id))[0].status).toBe("out_for_delivery");
});

it("refuses while a report is open", async () => {
  const day = await prepare(localDay());
  const [m] = await meals(day.id);
  await q(
    `insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description)
     select $1,$2,$3,p.caterer_id,'Makanan tidak datang','Ditunggu sampai jam dua'
     from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where d.id=$1`,
    [day.id, m.meal, U.customer],
  );
  await expect(cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal })).rejects.toThrow("NOT_ALLOWED");
  expect((await meals(day.id)).find((x) => x.meal === m.meal)!.status).toBe("out_for_delivery");
  expect(await earned(day.id)).toBe(0);
});

it("refuses before the window when the caterer has not departed", async () => {
  // The window is chosen relative to the real clock: 23.59 is never reached before the check,
  // 00.00 has always started.
  const early = await prepare(localDay(), "preparing");
  await setWindow(early.id, "23.59–23.59");
  const [m] = await meals(early.id);
  await expect(cmd("delivery.confirm", { deliveryId: early.id, meal: m.meal })).rejects.toThrow("NOT_ALLOWED");
  expect((await meals(early.id)).find((x) => x.meal === m.meal)!.status).toBe("preparing");

  const started = await prepare(localDay(), "preparing");
  await setWindow(started.id, "00.00–00.01");
  const result = await confirmAll(started.id);
  expect(result.status).toBe("delivered");
  expect(await dayStatus(started.id)).toBe("delivered");
  expect(await earned(started.id)).toBe(1);

  // Still scheduled and not departed: the same rule.
  await q("update v1.fulfillments set status='scheduled' where day_id=$1", [early.id]);
  await expect(cmd("delivery.confirm", { deliveryId: early.id, meal: m.meal })).rejects.toThrow("NOT_ALLOWED");
});

it("is a no-op the second time and keeps the reaction", async () => {
  const day = await prepare(localDay());
  const mealRows = await meals(day.id);
  for (const m of mealRows)
    await cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal, reaction: "enak" });
  const confirmedAt = (await read(day.id)).meals.find((m) => m.meal === mealRows[0].meal)!.confirmed_at;
  const again = await cmd("delivery.confirm", { deliveryId: day.id, meal: mealRows[0].meal, reaction: "kurang" });
  expect(again).toMatchObject({ status: "delivered" });
  const seen = await read(day.id);
  expect(seen.status).toBe("delivered");
  const first = seen.meals.find((m) => m.meal === mealRows[0].meal)!;
  expect(first.reaction).toBe("kurang");
  expect(first.confirmed_at).toBe(confirmedAt);
  expect(await earned(day.id)).toBe(1);
});

it("shows a confirmed meal's reaction in the customer read", async () => {
  const day = await prepare(localDay());
  await confirmAll(day.id, { reaction: "enak" });
  expect((await read(day.id)).meals.every((m) => m.reaction === "enak")).toBe(true);
});

it("uses the Jakarta date", async () => {
  const yesterday = await prepare(addDays(localDay(), -1));
  expect((await confirmAll(yesterday.id)).status).toBe("delivered");
  // Two days ago and tomorrow are both outside "today or yesterday".
  const other = await prepare(addDays(localDay(), -2));
  const [m] = await meals(other.id);
  await expect(cmd("delivery.confirm", { deliveryId: other.id, meal: m.meal })).rejects.toThrow("NOT_ALLOWED");
  await prepare(addDays(localDay(), 1), "out_for_delivery", other);
  await expect(cmd("delivery.confirm", { deliveryId: other.id, meal: m.meal })).rejects.toThrow("NOT_ALLOWED");
  expect((await meals(other.id)).find((x) => x.meal === m.meal)!.status).toBe("out_for_delivery");
});

it("refuses a cancelled day or meal", async () => {
  const day = await prepare(localDay());
  const [m] = await meals(day.id);
  await q("update v1.fulfillments set status='cancelled' where day_id=$1", [day.id]);
  await q("update v1.delivery_days set status='cancelled' where id=$1", [day.id]);
  await expect(cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal })).rejects.toThrow("NOT_AVAILABLE");
});

it("rejects malformed input", async () => {
  const day = await prepare(localDay());
  const [m] = await meals(day.id);
  for (const payload of [
    { deliveryId: day.id },
    { deliveryId: "nope", meal: m.meal },
    { deliveryId: day.id, meal: "brunch" },
    { deliveryId: day.id, meal: m.meal, reaction: "super" },
    { deliveryId: day.id, meal: m.meal, extra: 1 },
  ])
    await expect(cmd("delivery.confirm", payload)).rejects.toThrow("INVALID_INPUT");
});

it("replays the same request id without a second confirmation", async () => {
  const day = await prepare(localDay());
  const mealRows = await meals(day.id);
  for (const m of mealRows.slice(1))
    await cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal });
  const id = crypto.randomUUID();
  const payload = { deliveryId: day.id, meal: mealRows[0].meal, reaction: "biasa" };
  const a = await run("delivery.confirm", payload, id);
  const b = await run("delivery.confirm", payload, id);
  expect(b).toEqual(a);
  await expect(run("delivery.confirm", { ...payload, reaction: "enak" }, id)).rejects.toThrow("CONFLICT");
  expect(await earned(day.id)).toBe(1);
});

it("clears an unsent arrival reminder when the customer confirms", async () => {
  const day = await prepare(localDay());
  const mealRows = await meals(day.id);
  const reminder = (meal: string) => "arrive:" + day.id + ":" + meal;
  for (const m of mealRows)
    await q("insert into v1.outbox(kind,payload,dedupe) values('push.send','{}',$1)", [reminder(m.meal)]);
  await q("update v1.outbox set processed_at=now() where dedupe=$1", [reminder(mealRows[mealRows.length - 1].meal)]);
  for (const m of mealRows) await cmd("delivery.confirm", { deliveryId: day.id, meal: m.meal });
  const left = await q<{ dedupe: string }>("select dedupe from v1.outbox where dedupe like $1", ["arrive:" + day.id + ":%"]);
  // Only the row that was already sent stays.
  expect(left.map((r) => r.dedupe)).toEqual([reminder(mealRows[mealRows.length - 1].meal)]);
});

it("completes the subscription when the last open day is confirmed", async () => {
  const own = await buy(P[4], start);
  // Everything but the first day is already done, so confirming the first completes the subscription.
  const sub = own[0].subscription_id;
  await q("update v1.fulfillments set status='delivered' where day_id in (select id from v1.delivery_days where subscription_id=$1 and id<>$2)", [sub, own[0].id]);
  await q("update v1.delivery_days set status='delivered' where subscription_id=$1 and id<>$2", [sub, own[0].id]);
  await q("update v1.delivery_days set service_date=$2::date where id=$1", [own[0].id, localDay()]);
  await q("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [own[0].id]);
  await q("update v1.delivery_days set status='out_for_delivery' where id=$1", [own[0].id]);
  await confirmAll(own[0].id);
  expect((await q<{ status: string }>("select status from v1.subscriptions where id=$1", [sub]))[0].status).toBe("completed");
});

it("lets the owner react within 48 hours and only then", async () => {
  const day = await prepare(localDay());
  const mealRows = await meals(day.id);
  const [m] = mealRows;
  // Not delivered yet.
  await expect(cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "enak" })).rejects.toThrow("NOT_ALLOWED");
  await confirmAll(day.id);
  expect(await cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "biasa" })).toEqual({ reaction: "biasa" });
  expect(await cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "enak" })).toEqual({ reaction: "enak" });
  expect((await read(day.id)).meals.find((x) => x.meal === m.meal)!.reaction).toBe("enak");
  await expect(
    cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "enak" }, U.owner),
  ).rejects.toThrow("FORBIDDEN");
  await expect(cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "super" })).rejects.toThrow("INVALID_INPUT");
  await q("update v1.fulfillments set confirmed_at=now()-interval '49 hours' where day_id=$1 and meal=$2", [day.id, m.meal]);
  await expect(cmd("delivery.react", { deliveryId: day.id, meal: m.meal, reaction: "kurang" })).rejects.toThrow("NOT_ALLOWED");
  expect((await read(day.id)).meals.find((x) => x.meal === m.meal)!.reaction).toBe("enak");
});

it("shows no issue once a report is resolved", async () => {
  const day = await prepare(localDay());
  const [m] = await meals(day.id);
  await q(
    `insert into v1.delivery_issues(day_id,meal,user_id,caterer_id,subject,description)
     select $1,$2,$3,p.caterer_id,'Makanan tidak datang','Ditunggu sampai jam dua'
     from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where d.id=$1`,
    [day.id, m.meal, U.customer],
  );
  expect((await read(day.id)).meals.find((x) => x.meal === m.meal)!.issue).toMatchObject({ status: "open" });
  await q("update v1.delivery_issues set status='resolved' where day_id=$1 and meal=$2", [day.id, m.meal]);
  expect((await read(day.id)).meals.find((x) => x.meal === m.meal)!.issue).toBeNull();
});
