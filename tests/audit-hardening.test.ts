import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, localDay, type Checkout } from "@catera/domain";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { ADDRESS_ID as A, CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
import { setAsideDemoKitchenDay } from "./fixtures/set-aside-demo-day";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const today = localDay();
const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const cmd = (action: string, payload: object, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = (resource: string, params: object, user: string | null) =>
  localRpc<any>(db, user, "catera_v1_read", [resource, params]);
const system = (action: string, payload: object = {}) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);

/** A person with an address of their own who has nothing to do with any kitchen yet. */
async function stranger(name: string) {
  const id = crypto.randomUUID();
  await q("insert into v1.profiles(id,name,role) values($1,$2,'customer')", [id, name]);
  const [address] = await q<{ id: string }>(
    "insert into v1.addresses(user_id,label,line,area,city) select $1,'Rumah','Jalan Rahasia 7',area,city from v1.addresses where id=$2 returning id",
    [id, A],
  );
  return { id, addressId: address.id };
}
const openCheckout = (user: { id: string; addressId: string }, startDate: string) =>
  cmd(
    "checkout.create",
    { acceptedTerms: true, packageId: P[2], addressId: user.addressId, portions: 1, startDate, trial: false },
    user.id,
  ) as Promise<Checkout>;

beforeAll(async () => {
  db = await createDemoDatabase(true);
  await setAsideDemoKitchenDay(db);
}, 120000);
afterAll(async () => db?.close());

describe("the seller read and people who only opened a checkout", () => {
  it("hides them, then shows the customer once they have paid", async () => {
    const buyer = await stranger("Pembeli Belum Bayar");
    const checkout = await openCheckout(buyer, addDays(today, 40));
    expect(await q("select 1 from v1.relationships where user_id=$1", [buyer.id])).toHaveLength(1);

    const before = await read("seller", { id: K[0] }, U.owner);
    expect(before.customers.map((c: any) => c.id)).not.toContain(buyer.id);
    const row = before.transactions.find((t: any) => t.id === checkout.id);
    expect(row.state).toBe("pending");
    expect(row.quote.total).toBeGreaterThan(0);
    expect(row.quote.address).toBeUndefined();
    expect(row.user_id).toBeUndefined();
    expect(row.customerName).toBeUndefined();
    expect(row.address_id).toBeUndefined();
    expect(JSON.stringify(before)).not.toContain("Jalan Rahasia 7");
    expect(JSON.stringify(before)).not.toContain("Pembeli Belum Bayar");

    await cmd("checkout.demo_pay", { id: checkout.id }, buyer.id);
    const after = await read("seller", { id: K[0] }, U.owner);
    expect(after.customers.map((c: any) => c.id)).toContain(buyer.id);
    const paid = after.transactions.find((t: any) => t.id === checkout.id);
    expect(paid.quote.address.line).toBe("Jalan Rahasia 7");
    expect(paid.customerName).toBe("Pembeli Belum Bayar");
  });

  it("keeps a known customer's name on a new unpaid checkout, without its address", async () => {
    const buyer = await stranger("Pelanggan Lama");
    const first = await openCheckout(buyer, addDays(today, 70));
    await cmd("checkout.demo_pay", { id: first.id }, buyer.id);
    const again = await openCheckout(buyer, addDays(today, 100));
    const row = (await read("seller", { id: K[0] }, U.owner)).transactions.find((t: any) => t.id === again.id);
    expect(row.customerName).toBe("Pelanggan Lama");
    expect(row.quote.address).toBeUndefined();
  });

  it("gives another kitchen's staff nothing", async () => {
    const other = crypto.randomUUID();
    await q("insert into v1.profiles(id,name,role) values($1,'Pemilik Lain','customer')", [other]);
    await q("insert into v1.staff(caterer_id,user_id,role) values($1,$2,'owner')", [K[1], other]);
    const buyer = await stranger("Pembeli Dapur Lain");
    const checkout = await openCheckout(buyer, addDays(today, 130));
    await expect(read("seller", { id: K[0] }, other)).rejects.toThrow("FORBIDDEN");
    const own = await read("seller", { id: K[1] }, other);
    expect(own.customers.map((c: any) => c.id)).not.toContain(buyer.id);
    expect(own.transactions.map((t: any) => t.id)).not.toContain(checkout.id);
  });
});

describe("Gagal diantar in one call", () => {
  async function dayToday(startDate: string) {
    const checkout = await cmd("checkout.create", {
      acceptedTerms: true,
      packageId: P[0],
      addressId: A,
      portions: 1,
      startDate,
      trial: false,
    });
    await cmd("checkout.demo_pay", { id: checkout.id });
    const [day] = await q<{ id: string; version: number }>(
      "select d.id,d.version from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date limit 1",
      [checkout.id],
    );
    await q("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, today]);
    return (await q<{ id: string; version: number }>("select id,version from v1.delivery_days where id=$1", [day.id]))[0];
  }
  const trip = `${U.customer}:${K[0]}:${today}:lunch`;

  it("goes from scheduled to issue with exactly one push and one audit row", async () => {
    const day = await dayToday(addDays(today, 160));
    const pushesBefore = await q("select 1 from v1.outbox where kind='push'");
    const notesBefore = await q("select 1 from v1.notifications where user_id=$1", [U.customer]);
    await cmd("delivery.status", { id: day.id, version: day.version, meal: "lunch", status: "issue" }, U.owner);

    expect((await q("select status from v1.fulfillments where day_id=$1 and meal='lunch'", [day.id]))[0].status).toBe("issue");
    const [after] = await q<any>("select status,version from v1.delivery_days where id=$1", [day.id]);
    expect(after).toEqual({ status: "issue", version: day.version + 1 });
    expect(await q("select 1 from v1.outbox where kind='push'")).toHaveLength(pushesBefore.length + 1);
    expect(await q("select 1 from v1.notifications where user_id=$1", [U.customer])).toHaveLength(notesBefore.length + 1);
    expect(await q("select dedupe from v1.outbox where dedupe=$1", [`failed:${trip}`])).toHaveLength(1);
    expect(await q("select 1 from v1.outbox where dedupe=$1 or dedupe=$2", [`cooking:${trip}`, `depart:${trip}`])).toEqual([]);
    expect(
      await q("select 1 from v1.audit where action='delivery.status' and details->>'id'=$1", [day.id]),
    ).toHaveLength(1);
  });

  it("goes from preparing too, and the same checks still hold", async () => {
    const day = await dayToday(addDays(today, 190));
    const issue = (user: string, version = day.version) =>
      cmd("delivery.status", { id: day.id, version, meal: "lunch", status: "issue" }, user);
    await expect(issue(U.customer)).rejects.toThrow("FORBIDDEN");
    await expect(issue(U.owner, day.version + 9)).rejects.toThrow("CONFLICT");
    await q("update v1.fulfillments set status='preparing' where day_id=$1 and meal='lunch'", [day.id]);
    await issue(U.owner);
    expect((await q("select status from v1.fulfillments where day_id=$1 and meal='lunch'", [day.id]))[0].status).toBe("issue");
    // Failed food cannot fail again, and the rest of the ladder is unchanged.
    await expect(issue(U.owner, day.version + 1)).rejects.toThrow("INVALID_STATE");
  });
});

describe("the public reviews read", () => {
  it("names its columns, leaves out the account ids and stops at 100", async () => {
    const [sub] = await q<{ id: string; user_id: string; package_id: string }>(
      "select id,user_id,package_id from v1.subscriptions where user_id is not null and package_id=$1 limit 1",
      [P[2]],
    );
    await q("delete from v1.reviews where package_id=$1", [sub.package_id]);
    await q(
      `insert into v1.reviews(subscription_id,user_id,package_id,rating,food,delivery,value,body,reply)
       values($1,$2,$3,5,5,4,3,'Enak','Terima kasih')`,
      [sub.id, sub.user_id, sub.package_id],
    );
    const [one] = await read("reviews", { id: sub.package_id }, null);
    expect(Object.keys(one).sort()).toEqual(
      ["body", "created_at", "customer", "delivery", "food", "id", "rating", "reply", "value"].sort(),
    );
    expect(one).toMatchObject({ rating: 5, food: 5, delivery: 4, value: 3, body: "Enak", reply: "Terima kasih" });

    await q("alter table v1.reviews drop constraint if exists reviews_subscription_id_key");
    await q(
      `insert into v1.reviews(subscription_id,user_id,package_id,rating,food,delivery,value,body)
       select $1,$2,$3,4,4,4,4,'Ulasan '||n from generate_series(1,120) n`,
      [sub.id, sub.user_id, sub.package_id],
    );
    expect(await read("reviews", { id: sub.package_id }, null)).toHaveLength(100);
  });
});

describe("the import assistant spend cap", () => {
  const consume = (catererId: string, day: string) => system("importAssistant.consume", { catererId, day });

  it("stops a kitchen that is not approved at 5, and an approved one still at 20", async () => {
    const [draft] = await q<{ id: string }>(
      "insert into v1.caterers(slug,name) values('audit-draft-kitchen','Dapur Baru') returning id",
    );
    for (let i = 1; i <= 5; i++) expect(await consume(draft.id, "2026-11-01")).toBe(i);
    await expect(consume(draft.id, "2026-11-01")).rejects.toThrow("QUOTA");
    for (let i = 1; i <= 20; i++) expect(await consume(K[0], "2026-11-01")).toBe(i);
    await expect(consume(K[0], "2026-11-01")).rejects.toThrow("QUOTA");
  });

  const kitchen = async (status: string) =>
    (
      await q<{ id: string }>("insert into v1.caterers(slug,name,status) values($1,'Dapur Uji',$2) returning id", [
        "audit-" + crypto.randomUUID(),
        status,
      ])
    )[0].id;
  const spent = (id: string, day: string, calls: number) =>
    q("insert into v1.import_assistant_usage(caterer_id,day,calls) values($1,$2,$3)", [id, day, calls]);

  it("lets kitchens not yet approved use up only their own 100 a day", async () => {
    const day = "2026-11-02";
    await spent(await kitchen("draft"), day, 99);
    const [first, second] = [await kitchen("draft"), await kitchen("submitted")];
    expect(await consume(first, day)).toBe(1);
    await expect(consume(second, day)).rejects.toThrow("QUOTA");
    expect(await consume(await kitchen("approved"), day)).toBe(1);
    expect(await consume(second, "2026-11-03")).toBe(1);
  });

  it("stops approved kitchens at 500 a day together, and they do not touch the other ceiling", async () => {
    const day = "2026-11-04";
    await spent(await kitchen("approved"), day, 499);
    const [first, second] = [await kitchen("approved"), await kitchen("approved")];
    expect(await consume(first, day)).toBe(1);
    await expect(consume(second, day)).rejects.toThrow("QUOTA");
    expect(await consume(await kitchen("draft"), day)).toBe(1);
  });
});

describe("the provider webhook inbox", () => {
  const claim = () => system("provider.inbox.claim") as Promise<{ id: string; attempts: number }[]>;
  let operation: string;
  const add = (id: string, attempts: number, availableAgo = "1 hour") =>
    q(
      `insert into v1.provider_inbox(id,operation_id,event,fingerprint,attempts,available_at,received_at)
       values($1,$2,'{}','x',$3,now()-$4::interval,now()-interval '1 day')`,
      [id, operation, attempts, availableAgo],
    );

  beforeAll(async () => {
    await q("delete from v1.provider_inbox");
    const [op] = await q<{ id: string }>(
      `insert into v1.provider_operations(kind,entity_id,provider,environment,merchant,reference,state,amount)
       values('payment',gen_random_uuid(),'doku','sandbox','m','audit-inbox','preparing',1000) returning id`,
    );
    operation = op.id;
  });

  it("backs off with the attempt count and caps the wait at an hour", async () => {
    await add("first-failure", 0);
    await add("many-failures", 49);
    await claim();
    const rows = await q<{ id: string; attempts: number; minutes: number }>(
      "select id,attempts,round(extract(epoch from available_at-clock_timestamp())/60)::int minutes from v1.provider_inbox order by id",
    );
    expect(rows.find((r) => r.id === "first-failure")).toMatchObject({ attempts: 1, minutes: 1 });
    expect(rows.find((r) => r.id === "many-failures")).toMatchObject({ attempts: 50, minutes: 50 });
    expect(await claim()).toEqual([]);
  });

  it("keeps an event out of the claim at 50 attempts, never deletes it, and health counts it", async () => {
    await q("update v1.provider_inbox set available_at=now()-interval '1 minute'");
    const claimed = await claim();
    expect(claimed.map((r) => r.id)).toEqual(["first-failure"]);
    expect(await q("select 1 from v1.provider_inbox where id='many-failures' and processed_at is null")).toHaveLength(1);
    expect((await system("health")).providerInboxStuck).toBe(1);
  });

  it("does not let 20 stuck events hold back a new one", async () => {
    await q("delete from v1.provider_inbox");
    for (let i = 0; i < 25; i++) await add("stuck-" + i, 49 - (i % 2), "2 hours");
    await claim();
    await claim();
    await add("fresh", 0, "1 second");
    expect((await claim()).map((r) => r.id)).toContain("fresh");
  });
});

describe("maintenance pruning", () => {
  it("removes old events, checked tickets and one-off jobs, and keeps what dedupes notifications", async () => {
    const old = "now()-interval '40 days'";
    await q(`insert into public.catera_v1_events(id,user_id,topic,created_at) values
      ('a0000000-0000-4000-8000-000000000001',$1,'old',now()-interval '8 days'),
      ('a0000000-0000-4000-8000-000000000002',$1,'recent',now()-interval '6 days')`, [U.customer]);
    const job = (dedupe: string, processed = old) =>
      q<{ id: string }>(`insert into v1.outbox(kind,payload,dedupe,processed_at) values('push','{}',$1,${processed}) returning id`, [dedupe]);
    const uuid = () => crypto.randomUUID();
    const [gone] = await job(uuid());
    const [recent] = await job(uuid(), "now()-interval '20 days'");
    const [renew] = await job("renew-" + uuid());
    const [stage] = await job("failed:" + uuid());
    const [ticketed] = await job(uuid());
    const [checkedJob] = await job(uuid());
    await q(`insert into v1.push_tickets(id,token,job_id,checked_at) values
      ('audit-old','t',$1,now()-interval '8 days'),
      ('audit-recent','t',$2,now()-interval '6 days'),
      ('audit-open','t',$3,null)`, [checkedJob.id, recent.id, ticketed.id]);

    await system("maintenance");

    const ids = (await q<{ id: string }>("select id::text id from v1.outbox")).map((r) => r.id);
    expect(ids).not.toContain(gone.id);
    expect(ids).not.toContain(checkedJob.id);
    for (const kept of [recent, renew, stage, ticketed]) expect(ids).toContain(kept.id);
    expect((await q("select topic from public.catera_v1_events where id::text like 'a0000000%'")).map((r) => r.topic)).toEqual(["recent"]);
    expect((await q("select id from v1.push_tickets where id like 'audit-%' order by id")).map((r) => r.id)).toEqual([
      "audit-open",
      "audit-recent",
    ]);
  });
});

describe("row level security", () => {
  it("is on for the two tables that lacked it", async () => {
    const rows = await q<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class where oid in('v1.auto_deliver_policy'::regclass,'v1.import_assistant_usage'::regclass)",
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
