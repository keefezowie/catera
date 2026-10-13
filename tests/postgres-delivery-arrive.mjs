import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

// Phase G: the kitchen marks Sampai with a photo (delivery.arrive), departs subsets of stops, and
// v1.auto_confirm_arrived closes unanswered arrivals. Review Focus 1 to 3 of the Phase G plan.

async function system(pool, action, payload) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role" })]);
    const r = await c.query("select public.catera_v1_system($1,$2) value", [action, payload]);
    await c.query("commit");
    return r.rows[0].value;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** A transaction held open on its own connection as `user`; `fn` decides when it commits. */
async function held(pool, user, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [user]);
    return await fn(c);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const waitingOnALock = async (pool) =>
  (await pool.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and datname=current_database()")).rows[0].n;
async function untilBlocked(pool) {
  for (let i = 0; i < 200 && !(await waitingOnALock(pool)); i++) await new Promise((r) => setTimeout(r, 10));
}

export async function verifyDeliveryArrive(pool, cmd, evidence) {
  // A bare storage schema, as Supabase has, so the bucket and the read policy install for real.
  if (!(await pool.query("select to_regclass('storage.objects') is not null yes")).rows[0].yes) {
    await pool.query(`create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,created_at timestamptz default now());
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select on storage.objects to authenticated;`);
  }
  for (const file of ["20261014090000_delivery_arrive.sql", "20261014091000_delivery_depart_subset.sql", "20261014110000_push_events.sql"])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  // Meals delivered without confirmed_by before this scenario began (earlier scenarios' own setup).
  const unconfirmed = async () =>
    (await pool.query("select day_id||':'||meal k from v1.fulfillments where status='delivered' and confirmed_by is null")).rows.map((r) => r.k);
  const before = new Set(await unconfirmed());
  const newlyUnconfirmed = async () => (await unconfirmed()).filter((k) => !before.has(k));

  const today = localDay();
  // Each stop is the first day of its own purchase by its own synthetic customer, moved to today: a
  // subscription has one day per date, and the booking horizon leaves little room for one customer.
  const packages = [P[0], P[4], P[2]];
  const customerOf = new Map();
  let bought = 0;
  const addressOf = new Map();
  async function stop(status = "out_for_delivery", existing = null) {
    const n = bought++;
    const pkg = packages[n % packages.length];
    const user = existing ?? crypto.randomUUID();
    if (!existing) {
      addressOf.set(user, crypto.randomUUID());
      await pool.query("insert into v1.profiles(id,name,role) values($1,$2,'customer')", [user, "Pelanggan Contoh " + n]);
      await pool.query(
        "insert into v1.addresses(id,user_id,label,line,area,city,instructions) select $1,$2,label,line,area,city,'Data sintetis.' from v1.addresses where id=$3",
        [addressOf.get(user), user, A],
      );
    }
    const address = addressOf.get(user);
    const checkout = await cmd(
      "checkout.create",
      { acceptedTerms: true, packageId: pkg, addressId: address, portions: 1, startDate: addDays(today, 20 + 7 * Math.floor(n / 3)), trial: false },
      user,
    );
    await cmd("checkout.demo_pay", { id: checkout.id }, user);
    const { id } = (
      await pool.query(
        "select d.id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date limit 1",
        [checkout.id],
      )
    ).rows[0];
    await pool.query("update v1.delivery_days set service_date=$2::date,status=$3 where id=$1", [id, today, status]);
    await pool.query("update v1.fulfillments set status=$2,departed_at=case when $2='out_for_delivery' then now() end where day_id=$1 and meal='lunch'", [id, status]);
    customerOf.set(id, user);
    return id;
  }
  const photo = (id) => `${K[0]}/${id}/lunch/${crypto.randomUUID()}.jpg`;
  const arrivePayload = (ids) => ({
    catererId: K[0],
    date: today,
    meal: "lunch",
    fulfillmentIds: ids,
    photos: Object.fromEntries(ids.map((id) => [id, photo(id)])),
  });
  const arrive = (ids, user = U.owner) => cmd("delivery.arrive", arrivePayload(ids), user);
  const lunch = async (id) =>
    (await pool.query("select status,arrived_at,arrived_photo,confirmed_by from v1.fulfillments where day_id=$1 and meal='lunch'", [id])).rows[0];
  const issue = (id) => ({ deliveryId: id, meal: "lunch", subject: "Belum sampai", body: "Belum ada pesanan di depan rumah" });
  const settled = (results) => results.map((r) => (r.status === "fulfilled" ? "ok" : String(r.reason?.message ?? r.reason)));

  // 1. Arrive against the customer's confirmation: whichever commits first, the meal ends delivered by the
  // customer, any arrival stamp is the kitchen's, and nothing is ever delivered without confirmed_by.
  const order = { arriveFirst: 0, confirmFirst: 0 };
  for (let round = 0; round < 6; round++) {
    const id = await stop();
    const results = await Promise.allSettled([
      arrive([id], round % 2 ? U.staff : U.owner),
      cmd("delivery.confirm", { deliveryId: id, meal: "lunch" }, customerOf.get(id)),
    ]);
    assert.deepEqual(settled(results), ["ok", "ok"], "round " + round);
    const row = await lunch(id);
    assert.equal(row.status, "delivered");
    assert.equal(row.confirmed_by, "customer");
    if (row.arrived_at) order.arriveFirst++;
    else order.confirmFirst++;
  }
  // The kitchen cannot close a meal itself: the single-meal delivery.status refuses "delivered" too.
  const open = await stop();
  const { version } = (await pool.query("select version from v1.delivery_days where id=$1", [open])).rows[0];
  await assert.rejects(cmd("delivery.status", { id: open, version, meal: "lunch", status: "delivered" }, U.owner), /NOT_ALLOWED/);
  assert.equal((await lunch(open)).status, "out_for_delivery");
  assert.deepEqual(await newlyUnconfirmed(), []);
  evidence.push(
    `delivery.arrive racing delivery.confirm 6 times always ends delivered by the customer (${order.arriveFirst} arrived first, ${order.confirmFirst} confirmed first); staff delivery.status "delivered" is refused with NOT_ALLOWED.`,
  );

  // 2. Arrive against a report being filed: both land, the meal stays open with its report, and the
  // report then blocks auto-confirm even two hours later.
  for (let round = 0; round < 4; round++) {
    const id = await stop();
    const results = await Promise.allSettled([arrive([id]), cmd("deliveryIssue.create", issue(id), customerOf.get(id))]);
    assert.deepEqual(settled(results), ["ok", "ok"], "round " + round);
    const row = await lunch(id);
    assert.equal(row.status, "out_for_delivery");
    assert(row.arrived_at);
    await system(pool, "delivery.autoConfirm", { now: new Date(Date.now() + 3 * 3600_000).toISOString() });
    assert.equal((await lunch(id)).status, "out_for_delivery", "a reported arrival is never auto-confirmed");
  }
  evidence.push("delivery.arrive racing a report 4 times lands both, and the open report keeps the meal from auto-confirm.");

  // 3. Double arrive: two staff tap Sampai at once. One stamp, one push, the second answer is the first stamp.
  for (let round = 0; round < 3; round++) {
    const id = await stop();
    const [a, b] = await Promise.all([arrive([id], U.owner), arrive([id], U.staff)]);
    assert.equal(a.arrived + b.arrived, 1);
    assert.equal(Date.parse(a.arrivedAt[id]), Date.parse(b.arrivedAt[id]));
    const row = await lunch(id);
    assert.equal(Date.parse(row.arrived_at.toISOString()), Date.parse(a.arrivedAt[id]));
    const customer = customerOf.get(id);
    assert.equal((await pool.query("select count(*)::int n from v1.notifications where user_id=$1 and body like 'Pesananmu sudah diantar%'", [customer])).rows[0].n, 1);
    assert.equal(
      (await pool.query("select count(*)::int n from v1.outbox where dedupe=$1", ["arrived:" + customer + ":" + K[0] + ":" + today + ":lunch"])).rows[0].n,
      1,
    );
  }
  evidence.push("Two simultaneous arrives of one stop stamp it once, both answer the same arrived_at, and the customer gets one arrived push per caterer, date and meal.");

  // 4. Auto-confirm against a late report: the job waits on the report's pilot lock, then sees it.
  // Racing them never leaves a delivered meal hiding a report it could see.
  const late = await stop();
  await arrive([late]);
  const later = new Date(Date.now() + 2 * 3600_000 + 60_000).toISOString();
  let job;
  const waits = await held(pool, customerOf.get(late), async (c) => {
    await c.query("select public.catera_v1_command('deliveryIssue.create',$1,gen_random_uuid())", [issue(late)]);
    let done = false;
    job = system(pool, "delivery.autoConfirm", { now: later }).finally(() => (done = true));
    await untilBlocked(pool);
    const blocked = !done && (await waitingOnALock(pool)) > 0;
    assert.equal((await lunch(late)).status, "out_for_delivery", "an in-flight report holds the meal");
    await c.query("commit");
    return blocked;
  });
  assert.equal(waits, true, "auto-confirm waits for the report in flight instead of passing it");
  await job;
  assert.equal((await lunch(late)).status, "out_for_delivery", "the report it waited for keeps the meal open");
  await system(pool, "delivery.autoConfirm", { now: later });
  assert.equal((await lunch(late)).status, "out_for_delivery");
  const outcome = { held: 0, closedFirst: 0 };
  for (let round = 0; round < 6; round++) {
    const id = await stop();
    await arrive([id]);
    const results = await Promise.allSettled([
      cmd("deliveryIssue.create", issue(id), customerOf.get(id)),
      system(pool, "delivery.autoConfirm", { now: later }),
    ]);
    assert.equal(results[1].status, "fulfilled");
    const row = await lunch(id);
    if (row.status === "delivered") {
      assert.equal(row.confirmed_by, "auto");
      outcome.closedFirst++;
    } else {
      assert.equal(row.status, "out_for_delivery");
      outcome.held++;
    }
  }
  // Exactly two hours is enough; a minute less is not.
  const edge = await stop();
  await arrive([edge]);
  // Microseconds count: the bounds are computed in the database, not in JavaScript milliseconds.
  const bounds = (
    await pool.query(
      "select (arrived_at+interval '2 hours'-interval '1 minute')::text early,(arrived_at+interval '2 hours')::text exact from v1.fulfillments where day_id=$1 and meal='lunch'",
      [edge],
    )
  ).rows[0];
  await system(pool, "delivery.autoConfirm", { now: bounds.early });
  assert.equal((await lunch(edge)).status, "out_for_delivery");
  await system(pool, "delivery.autoConfirm", { now: bounds.exact });
  assert.equal((await lunch(edge)).confirmed_by, "auto");
  evidence.push(
    `Auto-confirm waits on the caterer lock while a report is in flight, then keeps the meal open once the report commits; racing late reports 6 times (${outcome.held} held, ${outcome.closedFirst} closed first) never closes a meal over a report it could see; exactly 2 hours closes, 1 minute less does not.`,
  );

  // 5. Two staff depart overlapping subsets at once: each stop leaves once, nothing outside the lists
  // moves, an id of another caterer fails the whole subset, and the customer is told once.
  const depart = (ids, user) => cmd("delivery.depart", { catererId: K[0], date: today, meal: "lunch", fulfillmentIds: ids }, user);
  for (let round = 0; round < 3; round++) {
    const [a, b, c, outside] = [await stop("preparing"), await stop("preparing"), await stop("preparing"), await stop("preparing")];
    const [x, y] = await Promise.all([depart([a, b], U.owner), depart([b, c], U.staff)]);
    assert.equal(x.moved + y.moved, 3, "round " + round);
    for (const id of [a, b, c]) assert.equal((await lunch(id)).status, "out_for_delivery");
    assert.equal((await lunch(outside)).status, "preparing");
    await assert.rejects(depart([outside, crypto.randomUUID()], U.owner), /NOT_FOUND/);
    assert.equal((await lunch(outside)).status, "preparing");
    await pool.query("update v1.fulfillments set status='cancelled' where day_id=$1", [outside]);
    await pool.query("update v1.delivery_days set status='cancelled' where id=$1", [outside]);
  }
  // A customer with two packages in this session: their stops leave in two subsets, and they are told once.
  const first = await stop("preparing");
  const twoPackages = customerOf.get(first);
  const second = await stop("preparing", twoPackages);
  await depart([first], U.owner);
  await depart([second], U.staff);
  assert.equal(
    (await pool.query("select count(*)::int n from v1.outbox where dedupe=$1", ["depart:" + twoPackages + ":" + K[0] + ":" + today + ":lunch"])).rows[0].n,
    1,
  );
  evidence.push("Two staff departing overlapping subsets at once move each stop once and nothing outside the lists; an unknown id fails the subset; one departure push per customer.");

  // 6. Arrive against depart of the same stops: depart moves only stops not yet on their way, arrive
  // marks only stops already out, so a stop is departed then marked or refused while still preparing.
  for (let round = 0; round < 3; round++) {
    const id = await stop("preparing");
    const results = await Promise.allSettled([depart([id], U.staff), arrive([id], U.owner)]);
    assert.equal(results[0].status, "fulfilled");
    const row = await lunch(id);
    assert.equal(row.status, "out_for_delivery");
    if (results[1].status === "fulfilled") assert(row.arrived_at, "an arrive that succeeded stamped the stop");
    else {
      assert.match(String(results[1].reason?.message), /INVALID_STATE/);
      assert.equal(row.arrived_at, null);
    }
  }
  evidence.push("delivery.arrive racing delivery.depart for one stop either marks it after it left or refuses with INVALID_STATE; it is never marked while still preparing.");

  // 7. The proof photo: its customer and that caterer's staff read it through the storage policy,
  // another kitchen's staff and another customer read nothing.
  const proofDay = await stop();
  await arrive([proofDay]);
  const { arrived_photo: path } = await lunch(proofDay);
  await pool.query("insert into storage.objects(bucket_id,name) values('catera-v1-proof',$1)", [path]);
  assert.equal((await pool.query("select public from storage.buckets where id='catera-v1-proof'")).rows[0].public, false);
  const outsider = crypto.randomUUID();
  const stranger = crypto.randomUUID();
  await pool.query("insert into v1.profiles(id,name,role) values($1,'Staf Contoh Lain','owner'),($2,'Pelanggan Contoh Lain','customer')", [outsider, stranger]);
  await pool.query("insert into v1.staff values($1,$2,'owner')", [K[1], outsider]);
  const sees = async (user) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
      await c.query("set local role authenticated");
      return (await c.query("select count(*)::int n from storage.objects where bucket_id='catera-v1-proof' and name=$1", [path])).rows[0].n;
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  const owner = customerOf.get(proofDay);
  assert.deepEqual(
    { customer: await sees(owner), staff: await sees(U.staff), otherKitchen: await sees(outsider), otherCustomer: await sees(stranger) },
    { customer: 1, staff: 1, otherKitchen: 0, otherCustomer: 0 },
  );
  const reads = async (user) =>
    held(pool, user, async (c) => {
      try {
        return (await c.query("select public.catera_v1_read('delivery-proof',$1) value", [{ deliveryId: proofDay, meal: "lunch" }])).rows[0].value.path;
      } catch (e) {
        return e.message;
      } finally {
        await c.query("rollback");
      }
    });
  assert.deepEqual([await reads(owner), await reads(U.owner), await reads(outsider), await reads(stranger)], [path, path, "FORBIDDEN", "FORBIDDEN"]);
  assert.deepEqual(
    (await pool.query("select has_function_privilege('authenticated','public.catera_v1_command_arrive_base(text,jsonb,uuid)','execute') a,has_function_privilege('authenticated','public.catera_v1_command_subset_base(text,jsonb,uuid)','execute') b,has_function_privilege('authenticated','v1.auto_confirm_arrived(timestamptz)','execute') c")).rows[0],
    { a: false, b: false, c: false },
  );
  assert.deepEqual(await newlyUnconfirmed(), [], "no meal delivered in this scenario lacks confirmed_by");
  evidence.push("Every meal delivered across these scenarios carries confirmed_by (customer or auto).");

  // 8. Stage pushes under the triggers (20261014110000): owner and staff cook, depart, fail and send out
  // again a customer's two packages at the same moment. Each stage reaches the customer once per trip,
  // and the trip that sets out again after Gagal diantar is announced again.
  const one = await stop("scheduled");
  const pair = customerOf.get(one);
  const two = await stop("scheduled", pair);
  const tail = pair + ":" + K[0] + ":" + today + ":lunch";
  const pushesFor = async () =>
    (await pool.query("select dedupe from v1.outbox where kind='push' and dedupe like '%:'||$1||'%' order by dedupe", [tail])).rows.map((r) =>
      r.dedupe.replace(tail, "*"),
    );
  const cook = (user) => cmd("delivery.cook", { catererId: K[0], date: today, meal: "lunch" }, user);
  const setStatus = async (id, status, user) => {
    const { version: v } = (await pool.query("select version from v1.delivery_days where id=$1", [id])).rows[0];
    return cmd("delivery.status", { id, version: v, meal: "lunch", status }, user);
  };
  assert.deepEqual(settled(await Promise.allSettled([cook(U.owner), cook(U.staff)])), ["ok", "ok"]);
  assert.deepEqual(settled(await Promise.allSettled([depart([one], U.owner), depart([two], U.staff)])), ["ok", "ok"]);
  assert.deepEqual(settled(await Promise.allSettled([setStatus(one, "issue", U.owner), setStatus(two, "issue", U.staff)])), ["ok", "ok"]);
  assert.deepEqual(
    settled(await Promise.allSettled([setStatus(one, "out_for_delivery", U.owner), setStatus(two, "out_for_delivery", U.staff)])),
    ["ok", "ok"],
  );
  assert.deepEqual(await pushesFor(), ["cooking:*", "depart:*", "depart:*:1", "failed:*"]);
  evidence.push(
    "Owner and staff cooking, departing, failing and resending a two-package customer's stops at once queue one push per stage per trip (Dimasak, Berangkat, Gagal diantar, then Berangkat again for the second trip).",
  );
  evidence.push("Proof photos sit in a private bucket: the stop's customer and that caterer's staff read the object and its path, another kitchen's staff and another customer read neither; the renamed bases and the auto-confirm job are not executable by clients.");
}
