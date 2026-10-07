import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";
import { GET as pushJobs } from "../apps/web/src/app/api/jobs/push/route";

type Day = { id: string; service_date: string; subscription_id: string };
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const start = addDays(localDay(), 5);
const today = localDay();
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const system = <T = any>(action: string, payload: object = {}) =>
  localRpc<T>(db, null, "catera_v1_system", [action, payload], true);
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
// A Jakarta wall-clock time on the given day.
const at = (day: string, time: string) => `${day}T${time}:00+07:00`;
const remindDue = (now: string) => system<{ queued: number }>("delivery.remindDue", { now });
const arrival = (id: string, meal = "lunch") =>
  q<{ id: string; processed_at: string | null }>("select id,processed_at from v1.outbox where dedupe=$1", [
    "arrive:" + id + ":" + meal,
  ]);
// The purchased offer is a frozen snapshot; lift its guard only to give a test a known window.
const setWindow = async (id: string, window: string) => {
  await q("alter table v1.subscriptions disable trigger subscription_terms");
  await q(
    `update v1.subscriptions s set snapshot=jsonb_set(s.snapshot,'{offer,windows}',jsonb_build_object('lunch',$2::text,'dinner',$2::text))
     from v1.delivery_days d where d.id=$1 and s.id=d.subscription_id`,
    [id, window],
  );
  await q("alter table v1.subscriptions enable trigger subscription_terms");
};
let parked = 0;
// Moves a day to the Jakarta date given, every meal in the given state, with a window of 11.00-13.00.
async function prepare(day: Day, date: string, status = "scheduled") {
  await q(
    "update v1.delivery_days set service_date='2020-01-01'::date + $4::int where subscription_id=$1 and service_date=$2::date and id<>$3",
    [day.subscription_id, date, day.id, parked++],
  );
  await q("update v1.fulfillments set status=$2 where day_id=$1", [day.id, status]);
  await q("update v1.delivery_days set service_date=$2::date, status=$3 where id=$1", [day.id, date, status]);
  await setWindow(day.id, "11.00–13.00");
  return day;
}
async function buy(packageId: string, startDate: string): Promise<Day[]> {
  const checkout: Checkout = await cmd("checkout.create", {
    acceptedTerms: true,
    packageId,
    addressId: A,
    portions: 1,
    startDate,
    trial: false,
  });
  await cmd("checkout.demo_pay", { id: checkout.id });
  return q<Day>(
    "select d.id,d.subscription_id,d.service_date::text service_date from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
    [checkout.id],
  );
}

let lunch: Day[]; // Ayam Sambal Rumahan: lunch only
let both: Day[]; // Rantang Nusantara: lunch and dinner
let hijau: Day[]; // Plant-based Everyday
beforeAll(async () => {
  db = await createDemoDatabase(true);
  lunch = await buy(P[4], start);
  both = await buy(P[2], start);
  hijau = await buy(P[3], start);
});
afterAll(async () => db?.close());

it("queues one arrival reminder an hour after the window", async () => {
  const day = await prepare(lunch[0], today);
  expect(await remindDue(at(today, "13:59"))).toEqual({ queued: 0 });
  expect(await arrival(day.id)).toHaveLength(0);
  expect(await remindDue(at(today, "14:00"))).toEqual({ queued: 1 });
  expect(await remindDue(at(today, "14:15"))).toEqual({ queued: 0 });
  const rows = await q<{ payload: any; kind: string }>(
    "select kind,payload from v1.outbox where dedupe=$1",
    ["arrive:" + day.id + ":lunch"],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].kind).toBe("push");
  expect(rows[0].payload).toMatchObject({
    userId: U.customer,
    body: "Makanan hari ini sudah sampai? Tandai di Catera.",
    href: "/today",
  });
  const notes = await q("select 1 from v1.notifications where user_id=$1 and body=$2", [
    U.customer,
    "Makanan hari ini sudah sampai? Tandai di Catera.",
  ]);
  expect(notes).toHaveLength(1);
});

it("takes the Jakarta day from the given time, not from the clock", async () => {
  // 16.59 UTC is already 23.59 in Jakarta of the day before: today's window is still ahead.
  const day = await prepare(both[0], today, "out_for_delivery");
  expect(await remindDue(at(addDays(today, -1), "23:59"))).toEqual({ queued: 0 });
  expect(await arrival(day.id)).toHaveLength(0);
  // Each meal of the day is reminded on its own.
  expect(await remindDue(at(today, "14:00"))).toEqual({ queued: 2 });
  expect((await arrival(day.id, "lunch")).length + (await arrival(day.id, "dinner")).length).toBe(2);
});

it("does not remind after confirm or report", async () => {
  const confirmed = await prepare(lunch[1], today, "out_for_delivery");
  const reported = await prepare(hijau[0], today, "scheduled");
  expect(await remindDue(at(today, "14:00"))).toEqual({ queued: 2 });
  // Confirming deletes the unsent reminder and nothing queues it again.
  await cmd("delivery.confirm", { deliveryId: confirmed.id, meal: "lunch" });
  expect(await arrival(confirmed.id)).toHaveLength(0);
  expect(await remindDue(at(today, "14:30"))).toEqual({ queued: 0 });
  expect(await arrival(confirmed.id)).toHaveLength(0);
  // A meal with an open report is not asked whether it arrived.
  await q("delete from v1.outbox where dedupe=$1", ["arrive:" + reported.id + ":lunch"]);
  await cmd("deliveryIssue.create", {
    deliveryId: reported.id,
    meal: "lunch",
    subject: "Belum sampai",
    body: "Sudah lewat jam makan",
  });
  expect(await remindDue(at(today, "14:45"))).toEqual({ queued: 0 });
  expect(await arrival(reported.id)).toHaveLength(0);
});

it("ignores other days and meals that were cancelled or delivered", async () => {
  const future = await prepare(lunch[2], addDays(today, 1));
  const cancelled = await prepare(lunch[3], today, "cancelled");
  const delivered = await prepare(hijau[1], today, "delivered");
  expect(await remindDue(at(today, "23:00"))).toEqual({ queued: 0 });
  for (const d of [future, cancelled, delivered]) expect(await arrival(d.id)).toHaveLength(0);
});

// Only the subscription under test is active, so a run's count is about it alone.
const onlyActive = (id: string) =>
  q("update v1.subscriptions set status=case when id=$1 then 'active' else 'completed' end", [id]);

it("renews once at three days left after 09.00", async () => {
  await onlyActive(both[0].subscription_id);
  // Leave exactly three open days on the Rantang Nusantara subscription.
  const days = await q<{ id: string }>(
    "select id from v1.delivery_days where subscription_id=$1 order by service_date",
    [both[0].subscription_id],
  );
  for (const d of days.slice(0, days.length - 3))
    await q("update v1.delivery_days set status='cancelled' where id=$1", [d.id]);
  // The key the daily maintenance reminder uses too: a customer gets one renewal push.
  const dedupe = "renew-" + both[0].subscription_id;
  const input = { today: start, hour: 8 };
  expect(await system("subscription.remindRenewal", input)).toEqual({ queued: 0 });
  expect(await q("select 1 from v1.outbox where dedupe=$1", [dedupe])).toHaveLength(0);
  expect(await system("subscription.remindRenewal", { ...input, hour: 9 })).toEqual({ queued: 1 });
  expect(await system("subscription.remindRenewal", { ...input, hour: 10 })).toEqual({ queued: 0 });
  const rows = await q<{ payload: any }>("select payload from v1.outbox where dedupe=$1", [dedupe]);
  expect(rows).toHaveLength(1);
  expect(rows[0].payload.href).toBe("/renew/" + both[0].subscription_id);
  expect(rows[0].payload.userId).toBe(U.customer);
  expect(rows[0].payload.body).toMatch(/^Paket .+ tinggal 3 hari\. Perpanjang tanpa jeda\.$/);
  // Other subscriptions still have more than three days left.
  expect(await q("select 1 from v1.outbox where dedupe like 'renew%'")).toHaveLength(1);
  // The daily maintenance run at two days left adds no second push for the same package.
  await q("update v1.delivery_days set status='cancelled' where id=(select id from v1.delivery_days where subscription_id=$1 and status not in ('delivered','cancelled') order by service_date limit 1)", [
    both[0].subscription_id,
  ]);
  await system("maintenance");
  expect(
    await q("select 1 from v1.notifications where kind='renewal' and href like '%'||$1", [both[0].subscription_id]),
  ).toHaveLength(1);
  expect(await q("select 1 from v1.outbox where dedupe=$1", [dedupe])).toHaveLength(1);
});

it("sends no renewal push to a package the daily maintenance already told", async () => {
  const sub = lunch[0].subscription_id;
  await onlyActive(sub);
  await q("update v1.delivery_days set status='cancelled' where subscription_id=$1 and status<>'delivered'", [sub]);
  const open = await q<{ id: string }>("select id from v1.delivery_days where subscription_id=$1 order by service_date", [sub]);
  // Two open days: maintenance tells the customer.
  for (const d of open.slice(-2)) await q("update v1.delivery_days set status='scheduled' where id=$1", [d.id]);
  await system("maintenance");
  expect(await q("select 1 from v1.notifications where kind='renewal' and href like '%'||$1", [sub])).toHaveLength(1);
  // Back at three open days, the new reminder stays silent.
  await q("update v1.delivery_days set status='scheduled' where id=$1", [open[open.length - 3].id]);
  expect(await system("subscription.remindRenewal", { today: start, hour: 12 })).toEqual({ queued: 0 });
  expect(await q("select kind from v1.outbox where dedupe=$1", ["renew-" + sub])).toEqual([{ kind: "reminder.record" }]);
});

it("removes a queued arrival reminder when the customer files a report", async () => {
  const day = await prepare(lunch[4], today, "scheduled");
  expect(await remindDue(at(today, "14:00"))).toEqual({ queued: 1 });
  expect(await arrival(day.id)).toHaveLength(1);
  await cmd("deliveryIssue.create", {
    deliveryId: day.id,
    meal: "lunch",
    subject: "Belum sampai",
    body: "Sudah lewat jam makan",
  });
  expect(await arrival(day.id)).toHaveLength(0);
  expect(await remindDue(at(today, "14:30"))).toEqual({ queued: 0 });
  // A reminder that was already sent stays a record: nothing to delete.
  const other = await prepare(hijau[2], today, "scheduled");
  expect(await remindDue(at(today, "14:40"))).toEqual({ queued: 1 });
  await q("update v1.outbox set processed_at=now() where dedupe=$1", ["arrive:" + other.id + ":lunch"]);
  await cmd("deliveryIssue.create", { deliveryId: other.id, meal: "lunch", subject: "Belum sampai", body: "Terlambat" });
  expect(await arrival(other.id)).toHaveLength(1);
});

it("does not remind a renewal before the subscription starts", async () => {
  await onlyActive(hijau[0].subscription_id);
  await q(
    "update v1.delivery_days set status='cancelled' where subscription_id=$1 and id not in (select id from v1.delivery_days where subscription_id=$1 order by service_date desc limit 3)",
    [hijau[0].subscription_id],
  );
  const open = await q<{ n: number }>(
    "select count(*)::int n from v1.delivery_days where subscription_id=$1 and status not in ('delivered','cancelled')",
    [hijau[0].subscription_id],
  );
  expect(open[0].n).toBe(3);
  expect(await system("subscription.remindRenewal", { today: addDays(start, -1), hour: 12 })).toEqual({ queued: 0 });
  expect(await system("subscription.remindRenewal", { today: start, hour: 12 })).toEqual({ queued: 1 });
});

it("claimPush only claims due push jobs", async () => {
  await q("delete from v1.outbox");
  await q(
    `insert into v1.outbox(kind,payload,dedupe,available_at) values
      ('push','{"userId":"x","body":"due","href":"/"}','due',now()-interval '1 minute'),
      ('push','{"userId":"x","body":"later","href":"/"}','later',now()+interval '1 hour'),
      ('payment.create','{}','payment',now()-interval '1 minute'),
      ('push','{"userId":"x","body":"done","href":"/"}','done',now()-interval '1 minute')`,
  );
  await q("update v1.outbox set processed_at=now() where dedupe='done'");
  const claimed = await system<{ dedupe: string; attempts: number }[]>("outbox.claimPush", { limit: 10 });
  expect(claimed.map((j) => j.dedupe)).toEqual(["due"]);
  expect(claimed[0].attempts).toBe(1);
  // Leased: a second worker does not receive it again.
  expect(await system("outbox.claimPush", { limit: 10 })).toEqual([]);
  // The generic claim leaves pushes to the push worker and still serves other kinds.
  const generic = await system<{ dedupe: string }[]>("outbox.claim");
  expect(generic.map((j) => j.dedupe)).toEqual(["payment"]);
  // The limit applies.
  await q("update v1.outbox set available_at=now()-interval '1 minute' where dedupe in ('due','later')");
  expect(await system("outbox.claimPush", { limit: 1 })).toHaveLength(1);
});

it("keeps system actions to the service role and validates input", async () => {
  await expect(
    localRpc(db, U.customer, "catera_v1_system", ["delivery.remindDue", { now: at(today, "14:00") }], false),
  ).rejects.toThrow();
  await expect(system("delivery.remindDue", {})).rejects.toThrow("INVALID_INPUT");
  await expect(system("delivery.remindDue", { now: "garbage" })).rejects.toThrow("INVALID_INPUT");
  await expect(system("subscription.remindRenewal", { today: start, hour: 25 })).rejects.toThrow("INVALID_INPUT");
  await expect(system("subscription.remindRenewal", { hour: 9 })).rejects.toThrow("INVALID_INPUT");
  await expect(system("outbox.claimPush", {})).rejects.toThrow("INVALID_INPUT");
});

it("GET /api/jobs/push rejects without the cron secret", async () => {
  process.env.CRON_SECRET = "synthetic-cron-secret";
  const url = "https://catera.test/api/jobs/push";
  expect((await pushJobs(new Request(url))).status).toBe(401);
  expect((await pushJobs(new Request(url, { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
  delete process.env.CRON_SECRET;
  expect((await pushJobs(new Request(url, { headers: { authorization: "Bearer undefined" } }))).status).toBe(401);
});

it("daily maintenance survives a renewal push committed between its check and its insert", async () => {
  const sub = hijau[0].subscription_id;
  await onlyActive(sub);
  await q("delete from v1.outbox where dedupe like 'renew-%'");
  await q("delete from v1.notifications where kind='renewal'");
  const open = await q<{ n: number }>(
    "select count(*)::int n from v1.delivery_days where subscription_id=$1 and status not in ('delivered','cancelled')",
    [sub],
  );
  expect(open[0].n).toBeLessThanOrEqual(3);
  // Stand-in for subscription.remindRenewal committing the same key at that moment: it fires
  // as maintenance writes its renewal record, and queues the customer's renewal push first.
  await db.exec(`
    create function public.race_renewal() returns trigger language plpgsql as $$
    declare s record;
    begin
     if pg_trigger_depth()>1 or new.kind<>'reminder.record' or new.dedupe not like 'renew-%' then return new;end if;
     select id,user_id into s from v1.subscriptions where 'renew-'||id=new.dedupe;
     perform v1.notify(s.user_id,'renewal','Paket tinggal 3 hari. Perpanjang tanpa jeda.','/renew/'||s.id,new.dedupe);
     return new;
    end $$;
    create trigger race_renewal before insert on v1.outbox for each row execute function public.race_renewal();
  `);
  try {
    await system("maintenance");
  } finally {
    await db.exec("drop trigger race_renewal on v1.outbox; drop function public.race_renewal()");
  }
  // One renewal key, one renewal message: the one already queued.
  expect(await q("select kind from v1.outbox where dedupe=$1", ["renew-" + sub])).toEqual([{ kind: "push" }]);
  expect(
    await q("select body from v1.notifications where kind='renewal' and href like '%'||$1", [sub]),
  ).toEqual([{ body: "Paket tinggal 3 hari. Perpanjang tanpa jeda." }]);
});
