import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ADDRESS_ID as A,
  CATERER_IDS,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

async function system(pool, action, payload) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ role: "service_role" }),
    ]);
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

// Subscriptions are bought for a far-off start so they never overlap earlier checks.
async function purchased(pool, cmd, packageId, startDate) {
  const checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId, addressId: A, portions: 1, startDate, trial: false },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  return (
    await pool.query(
      "select d.id,d.subscription_id from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
      [checkout.id],
    )
  ).rows;
}

export async function verifyDeliveryConfirm(pool, cmd, evidence) {
  for (const file of [
    "20261008100000_customer_arrival.sql",
    "20261008100500_production_signature_arrival.sql",
    "20261008101000_delivery_confirm.sql",
    "20261008102000_delivery_depart.sql",
    "20261008102500_depart_today_one_push.sql",
    "20261008103000_push_timing.sql",
    "20261008111000_push_report_renewal_dedupe.sql",
    "20261008112000_claim_preview.sql",
    "20261008113000_caterer_whatsapp.sql",
    "20261008114000_caterer_whatsapp_denied.sql",
    "20261008114500_maintenance_renewal_conflict.sql",
    "20261008120000_delivery_issue_customer.sql",
    "20261008121000_delivery_issue_not_future.sql",
  ])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));

  const start = addDays(localDay(), 200);
  const pool20 = [
    ...(await purchased(pool, cmd, P[2], start)),
    ...(await purchased(pool, cmd, P[3], addDays(start, 100))),
    ...(await purchased(pool, cmd, P[4], start)),
  ];
  assert(pool20.length >= 20, "need 20 synthetic days, have " + pool20.length);
  const today = localDay();
  const tomorrow = addDays(today, 1);
  let parked = 0;

  for (const [round, day] of pool20.slice(0, 20).entries()) {
    // A subscription cannot have two days on one date: park the earlier rounds' days in the past.
    await pool.query(
      "update v1.delivery_days set service_date='2020-01-01'::date+$3::int where subscription_id=$1 and service_date=$2::date and id<>$4",
      [day.subscription_id, today, parked++, day.id],
    );
    await pool.query("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [day.id, today]);
    await pool.query("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [day.id]);
    const meals = (await pool.query("select meal from v1.fulfillments where day_id=$1 order by meal", [day.id])).rows.map((r) => r.meal);

    // The customer answers every meal while the nightly job runs.
    const [confirmed] = await Promise.all([
      Promise.allSettled(
        meals.map((meal, i) => cmd("delivery.confirm", { deliveryId: day.id, meal, reaction: i ? "biasa" : "enak" }, U.customer)),
      ),
      system(pool, "delivery.autoDeliver", { today: tomorrow }),
    ]);
    for (const r of confirmed) assert.equal(r.status, "fulfilled", round + ": " + (r.reason && r.reason.message));
    assert.equal(
      (await pool.query("select status from v1.delivery_days where id=$1", [day.id])).rows[0].status,
      "delivered",
    );
    assert.equal(
      (await pool.query("select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'", [day.id])).rows[0].n,
      1,
    );
    const rows = (await pool.query("select status,confirmed_at,confirmed_by from v1.fulfillments where day_id=$1", [day.id])).rows;
    for (const f of rows) {
      assert.equal(f.status, "delivered");
      // Whoever wins the race stamps the confirmation: the customer, or the job as 'auto'.
      assert(["customer", "auto"].includes(f.confirmed_by), "confirmed_by " + f.confirmed_by);
      assert(f.confirmed_at !== null, "confirmed_at");
    }
    assert.equal(
      (await pool.query("select count(*)::int n from v1.delivery_reactions where day_id=$1", [day.id])).rows[0].n,
      meals.length,
    );
  }
  evidence.push(
    "Customer confirmation racing the auto-delivery job 20 times delivers each day once with exactly one earning and one reaction per meal.",
  );

  // Two devices confirming the same meal at once: one confirmation, one earning.
  const dup = (await purchased(pool, cmd, P[4], addDays(start, 60)))[0];
  await pool.query("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [dup.id, today]);
  await pool.query("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [dup.id]);
  const meal = (await pool.query("select meal from v1.fulfillments where day_id=$1", [dup.id])).rows[0].meal;
  const both = await Promise.all([
    cmd("delivery.confirm", { deliveryId: dup.id, meal, reaction: "enak" }, U.customer),
    cmd("delivery.confirm", { deliveryId: dup.id, meal, reaction: "kurang" }, U.customer),
  ]);
  assert(both.every((r) => r.status === "delivered"));
  assert.equal(
    (await pool.query("select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'", [dup.id])).rows[0].n,
    1,
  );
  evidence.push("Two simultaneous confirmations of one meal record one delivery and one earning.");

  // The claim preview is a public read: anon may call it, the previous read stays closed to anon,
  // and unknown, used and expired links are one and the same NOT_FOUND.
  const claimLink = async (phone, usedAt, expiresIn) => {
    const token = (await import("node:crypto")).randomBytes(32).toString("hex");
    const record = (
      await pool.query(
        "insert into v1.customer_records(caterer_id,name,phone,address,origin) values($1,'Synthetic Preview',$2,'{\"line\":\"Jl. Sintetis Raya 12\",\"area\":\"Kebayoran\",\"city\":\"Jakarta\"}','seller') returning id",
        [CATERER_IDS[0], phone],
      )
    ).rows[0].id;
    await pool.query(
      "insert into v1.customer_claims(customer_record_id,token_hash,expires_at,used_at,created_by) values($1,encode(sha256(convert_to($2,'UTF8')),'hex'),now()+$3::interval,$4,$5)",
      [record, token, expiresIn, usedAt, U.owner],
    );
    return token;
  };
  const anonRead = async (token) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claim.sub','',true)");
      return (await c.query("select public.catera_v1_read('claim-preview',$1) value", [{ token }])).rows[0].value;
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  const live = await anonRead(await claimLink("+6281234560099", null, "1 day"));
  assert.deepEqual(Object.keys(live).sort(), [
    "addressLabel", "catererName", "maskedPhone", "nextDate", "nextWindow", "packageName", "remainingDays",
  ]);
  assert.equal(live.maskedPhone, "0812-•••-0099");
  assert.equal(live.addressLabel, "Jl. Sintetis Raya 12");
  for (const token of [
    "f".repeat(64),
    await claimLink("+6281234560098", new Date().toISOString(), "1 day"),
    await claimLink("+6281234560097", null, "-1 second"),
  ])
    await assert.rejects(anonRead(token), /NOT_FOUND/);
  const access = (
    await pool.query(
      "select has_function_privilege('anon','public.catera_v1_read(text,jsonb)','execute') open,has_function_privilege('anon','public.catera_v1_read_claim_preview_base(text,jsonb)','execute') base",
    )
  ).rows[0];
  assert.deepEqual(access, { open: true, base: false });
  evidence.push(
    "Claim preview: the public read returns only the seven preview fields with the phone masked, unknown, used and expired links are one NOT_FOUND, and the previous read stays closed to anonymous callers.",
  );

  // Catera Dapur's report screen: the caterer's delivery-issues read names the customer.
  const reported = (
    await pool.query(
      "select f.day_id,f.meal from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id where s.user_id=$1 and (s.snapshot->'offer'->>'catererId')::uuid=$2 and not exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id and i.meal=f.meal and i.status in('open','responded','escalated')) order by d.service_date desc limit 1",
      [U.customer, CATERER_IDS[0]],
    )
  ).rows[0];
  // Reports are taken only for a day that has come in Jakarta: the latest day is moved to a past date of its own.
  await pool.query("update v1.delivery_days set service_date='2019-06-01' where id=$1", [reported.day_id]);
  const issue = await cmd(
    "deliveryIssue.create",
    { deliveryId: reported.day_id, meal: reported.meal, subject: "Belum sampai", body: "Makanan belum datang." },
    U.customer,
  );
  const issueRead = async (user, params) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
      return (await c.query("select public.catera_v1_read('delivery-issues',$1) value", [params])).rows[0].value;
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  const [seen] = await issueRead(U.staff, { id: CATERER_IDS[0], issue: issue.id });
  assert.equal(seen.customerName, "Nadia Putri");
  assert.ok(seen.customerRecordId);
  assert.ok(!("customerName" in (await issueRead(U.customer, {})).find((i) => i.id === issue.id)));
  evidence.push("Delivery reports: the caterer's read names the customer (record, number) and the customer's own list is unchanged.");

  // C-01: no report for a day after Jakarta today; another account still gets FORBIDDEN.
  const ahead = (
    await pool.query(
      "select f.day_id,f.meal from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id where s.user_id=$1 and d.service_date>$2::date and f.status<>'cancelled' and not exists(select 1 from v1.delivery_issues i where i.day_id=f.day_id) order by d.service_date limit 1",
      [U.customer, localDay()],
    )
  ).rows[0];
  const futureReport = { deliveryId: ahead.day_id, meal: ahead.meal, subject: "Belum sampai", body: "Makanan belum datang." };
  await assert.rejects(cmd("deliveryIssue.create", futureReport, U.customer), /NOT_ALLOWED/);
  await assert.rejects(cmd("deliveryIssue.create", futureReport, U.owner), /FORBIDDEN/);
  assert.equal((await pool.query("select count(*)::int n from v1.delivery_issues where day_id=$1", [ahead.day_id])).rows[0].n, 0);
  evidence.push("Delivery reports: a day after Jakarta today is refused with NOT_ALLOWED and files nothing; today and earlier are accepted.");
}

async function claimed(pool, user, fn) {
  // A transaction held open on its own connection, acting as the given customer.
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [user]);
    return await fn(c);
  } finally {
    c.release();
  }
}

const waitingOnALock = async (pool) =>
  (await pool.query("select count(*)::int n from pg_stat_activity where wait_event_type='Lock' and datname=current_database()")).rows[0].n;

// The nightly rule only reaches days from the date it was switched on; the races use yesterday and today.
async function withPolicyFrom(pool, date, fn) {
  const before = (await pool.query("select since::text s from v1.auto_deliver_policy")).rows[0].s;
  await pool.query("update v1.auto_deliver_policy set since=$1::date", [date]);
  try {
    return await fn();
  } finally {
    await pool.query("update v1.auto_deliver_policy set since=$1::date", [before]);
  }
}

const dayStatusOf = async (pool, id) => (await pool.query("select status from v1.delivery_days where id=$1", [id])).rows[0].status;
const earnedOf = async (pool, id) =>
  (await pool.query("select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'", [id])).rows[0].n;

export async function verifyDeliveryDepart(pool, cmd, evidence) {
  const today = localDay();
  const yesterday = addDays(today, -1);
  const issue = (day, meal) => ({ deliveryId: day, meal, subject: "Makanan tidak datang", body: "Ditunggu sampai jam dua siang" });

  // 1. A report filed while the nightly job runs: the meal is held, or the report lands after delivery.
  const reportPool = [
    ...(await purchased(pool, cmd, P[2], addDays(today, 230))),
    ...(await purchased(pool, cmd, P[3], addDays(today, 330))),
  ];
  assert(reportPool.length >= 10, "need 10 synthetic days, have " + reportPool.length);
  const outcomes = { held: 0, reportedAfterDelivery: 0 };
  for (const [round, day] of reportPool.slice(0, 10).entries()) {
    // A report is taken only for a day that has come, so each round uses a past date of its own,
    // with the nightly rule switched on from that date so the run reaches only this day.
    const date = addDays(today, -(340 + round));
    await pool.query("update v1.delivery_days set service_date=$2::date where id=$1", [day.id, date]);
    const meal = (await pool.query("select meal from v1.fulfillments where day_id=$1 order by meal limit 1", [day.id])).rows[0].meal;
    const [report] = await withPolicyFrom(pool, date, () =>
      Promise.all([
        cmd("deliveryIssue.create", issue(day.id, meal), U.customer),
        system(pool, "delivery.autoDeliver", { today: addDays(date, 1) }),
      ]),
    );
    assert(report.id, round + ": the report was filed");
    const status = await dayStatusOf(pool, day.id);
    const earned = await earnedOf(pool, day.id);
    const reported = (await pool.query("select status from v1.fulfillments where day_id=$1 and meal=$2", [day.id, meal])).rows[0].status;
    if (status === "delivered") {
      // The report reached the database after the job had delivered the day.
      assert.equal(earned, 1, round + ": a delivered day earns once");
      assert.equal(reported, "delivered");
      outcomes.reportedAfterDelivery++;
    } else {
      assert.equal(earned, 0, round + ": a held day earns nothing");
      assert.equal(reported, "scheduled");
      assert.equal(status, "scheduled");
      outcomes.held++;
    }
  }

  // 2. A report in flight (uncommitted) holds its meal: the job leaves the day for its next run,
  // and the committed report keeps holding it until it is resolved.
  const spare = (await purchased(pool, cmd, P[0], addDays(today, 250)))[0];
  const spareDate = addDays(today, -350);
  await pool.query("update v1.delivery_days set service_date=$2::date where id=$1", [spare.id, spareDate]);
  const spareMeal = (await pool.query("select meal from v1.fulfillments where day_id=$1 limit 1", [spare.id])).rows[0].meal;
  const spareSince = (await pool.query("select since::text s from v1.auto_deliver_policy")).rows[0].s;
  await pool.query("update v1.auto_deliver_policy set since=$1::date", [spareDate]);
  await claimed(pool, U.customer, async (c) => {
    await c.query("select public.catera_v1_command('deliveryIssue.create',$1,gen_random_uuid())", [issue(spare.id, spareMeal)]);
    await system(pool, "delivery.autoDeliver", { today: addDays(spareDate, 1) });
    assert.equal(await dayStatusOf(pool, spare.id), "scheduled", "an in-flight report holds the day");
    await c.query("commit");
  });
  await system(pool, "delivery.autoDeliver", { today: addDays(spareDate, 1) });
  assert.equal(await dayStatusOf(pool, spare.id), "scheduled");
  assert.equal(await earnedOf(pool, spare.id), 0);
  await pool.query("update v1.delivery_issues set status='resolved' where day_id=$1", [spare.id]);
  await system(pool, "delivery.autoDeliver", { today: addDays(spareDate, 1) });
  assert.equal(await dayStatusOf(pool, spare.id), "delivered");
  assert.equal(await earnedOf(pool, spare.id), 1);
  await pool.query("update v1.auto_deliver_policy set since=$1::date", [spareSince]);
  evidence.push(
    "Reports filed while the nightly job runs 10 times never leave a reported meal delivered ahead of its report (" +
      outcomes.held + " held, " + outcomes.reportedAfterDelivery + " reported after delivery); an in-flight report holds its meal until resolved.",
  );

  // 3. Departures are idempotent under concurrency: simultaneous calls move a meal once and queue one push.
  const dep = (await purchased(pool, cmd, P[0], addDays(today, 270)))[0];
  // Departure is for the Jakarta day itself only.
  await pool.query("update v1.delivery_days set service_date=$2::date where id=$1", [dep.id, today]);
  await assert.rejects(cmd("delivery.depart", { catererId: CATERER_IDS[0], date: addDays(today, 1), meal: "lunch" }, U.owner), /INVALID_DATE/);
  const waiting = (await pool.query(
    "select count(*)::int n from v1.fulfillments f join v1.delivery_days d on d.id=f.day_id join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and d.service_date=$2::date and f.meal='lunch' and f.status in ('scheduled','preparing') and d.status<>'cancelled'",
    [CATERER_IDS[0], today],
  )).rows[0].n;
  assert(waiting >= 1, "the purchased day is waiting");
  const departs = await Promise.all(
    [U.owner, U.staff, U.owner].map((u) => cmd("delivery.depart", { catererId: CATERER_IDS[0], date: today, meal: "lunch" }, u)),
  );
  assert.equal(departs.reduce((sum, r) => sum + r.moved, 0), waiting);
  assert.equal(
    (await pool.query("select count(*)::int n from v1.outbox where dedupe=$1", ["depart:" + U.customer + ":" + CATERER_IDS[0] + ":" + today + ":lunch"])).rows[0].n,
    1,
  );
  evidence.push("Three simultaneous departures of a day's meals move each once and queue one push per customer; any date but today is refused.");

  // 4. The last two open days of a subscription close at once, one by the customer and one by the job:
  // the subscription always ends completed.
  const pairs = [];
  for (let start = 280; pairs.length < 12 && start < 350; start += 8) {
    const days = await purchased(pool, cmd, P[4], addDays(today, start));
    for (let k = 0; 2 * k + 1 < days.length; k++) pairs.push([days, k]);
  }
  assert(pairs.length >= 12, "need 12 day pairs, have " + pairs.length);
  let parkedDays = 0;
  const closeLastTwo = async ([days, k], race) => {
    const [a, b] = [days[2 * k], days[2 * k + 1]];
    const sub = a.subscription_id;
    // Everything else of the subscription is out of the way; earlier rounds' days are parked in the past.
    await pool.query("update v1.delivery_days set status='cancelled' where subscription_id=$1 and id not in ($2,$3) and status<>'delivered'", [sub, a.id, b.id]);
    await pool.query("update v1.fulfillments set status='cancelled' where status<>'delivered' and day_id in (select id from v1.delivery_days where subscription_id=$1 and id not in ($2,$3))", [sub, a.id, b.id]);
    for (const old of (await pool.query("select id from v1.delivery_days where subscription_id=$1 and id not in ($2,$3) and service_date in ($4::date,$5::date)", [sub, a.id, b.id, today, yesterday])).rows)
      await pool.query("update v1.delivery_days set service_date='2020-01-01'::date+$2::int where id=$1", [old.id, parkedDays++]);
    await pool.query("update v1.delivery_days set service_date=$2::date,status='out_for_delivery' where id=$1", [a.id, today]);
    await pool.query("update v1.fulfillments set status='out_for_delivery' where day_id=$1", [a.id]);
    await pool.query("update v1.delivery_days set service_date=$2::date,status='scheduled' where id=$1", [b.id, yesterday]);
    await pool.query("update v1.fulfillments set status='scheduled' where day_id=$1", [b.id]);
    await pool.query("update v1.subscriptions set status='active' where id=$1", [sub]);
    const meal = (await pool.query("select meal from v1.fulfillments where day_id=$1", [a.id])).rows[0].meal;
    await race(a, meal);
    assert.equal((await pool.query("select status from v1.subscriptions where id=$1", [sub])).rows[0].status, "completed", "subscription " + sub);
    assert.equal(await earnedOf(pool, a.id), 1);
    assert.equal(await earnedOf(pool, b.id), 1);
  };
  await withPolicyFrom(pool, yesterday, async () => {
    // Forced order: the confirmation holds the subscription while the job finishes the other day.
    await closeLastTwo(pairs[0], async (a, meal) => {
      await claimed(pool, U.customer, async (c) => {
        await c.query("select public.catera_v1_command('delivery.confirm',$1,gen_random_uuid())", [{ deliveryId: a.id, meal }]);
        const job = system(pool, "delivery.autoDeliver", { today });
        let waited = 0;
        while ((await waitingOnALock(pool)) === 0 && waited++ < 100) await new Promise((r) => setTimeout(r, 50));
        assert((await waitingOnALock(pool)) > 0, "the job waits for the subscription lock");
        await c.query("commit");
        await job;
      });
    });
    // Free-running races.
    for (const pair of pairs.slice(1, 12))
      await closeLastTwo(pair, (a, meal) =>
        Promise.all([
          cmd("delivery.confirm", { deliveryId: a.id, meal }, U.customer),
          system(pool, "delivery.autoDeliver", { today }),
        ]),
      );
  });
  evidence.push(
    "Confirming one last open day while the job delivers the other completes the subscription every time (12 rounds, one forced order).",
  );

  // 5. The kitchen sets off while the customer confirms the same meal (its window has started, so a
  // confirmation is allowed before or after the departure): delivered exactly once, one earning,
  // confirmed by the customer, and a push only when the departure actually moved the meal.
  const racePool = [];
  for (const start of [290, 305, 320]) {
    const days = await purchased(pool, cmd, P[0], addDays(today, start));
    await pool.query("alter table v1.subscriptions disable trigger subscription_terms");
    await pool.query(
      "update v1.subscriptions set snapshot=jsonb_set(snapshot,'{offer,windows}',$2::jsonb) where id=$1",
      [days[0].subscription_id, JSON.stringify({ lunch: "00.00–00.01", dinner: "00.00–00.01" })],
    );
    await pool.query("alter table v1.subscriptions enable trigger subscription_terms");
    racePool.push(...days);
  }
  assert(racePool.length >= 12, "need 12 synthetic days, have " + racePool.length);
  let racePark = 0;
  const pushCount = async () =>
    (await pool.query("select count(*)::int n from v1.notifications where user_id=$1 and kind='delivery' and body like 'Makan siangmu sedang diantar%'", [U.customer])).rows[0].n;
  const raced = { departedFirst: 0, confirmedFirst: 0 };
  for (const [round, day] of racePool.slice(0, 12).entries()) {
    await pool.query(
      "update v1.delivery_days set service_date='2020-01-01'::date+$3::int where subscription_id=$1 and id<>$2 and service_date=$4::date",
      [day.subscription_id, day.id, racePark++, today],
    );
    await pool.query("update v1.delivery_days set service_date=$2::date,status='scheduled' where id=$1", [day.id, today]);
    await pool.query("update v1.fulfillments set status='scheduled',departed_at=null,confirmed_at=null,confirmed_by=null where day_id=$1", [day.id]);
    await pool.query("delete from v1.outbox where dedupe like 'depart:%'");
    const before = await pushCount();
    const meal = (await pool.query("select meal from v1.fulfillments where day_id=$1", [day.id])).rows[0].meal;
    const departArgs = { catererId: CATERER_IDS[0], date: today, meal };
    const confirmArgs = { deliveryId: day.id, meal };
    let dep, conf;
    if (round < 2) {
      // Forced orders: the first transaction stays open while the other starts and waits on the day lock.
      const [firstUser, firstSql, first, secondRun] =
        round === 0
          ? [U.owner, "delivery.depart", departArgs, () => cmd("delivery.confirm", confirmArgs, U.customer)]
          : [U.customer, "delivery.confirm", confirmArgs, () => cmd("delivery.depart", departArgs, U.owner)];
      let second;
      const firstResult = await claimed(pool, firstUser, async (c) => {
        const r = (await c.query("select public.catera_v1_command($1,$2,gen_random_uuid()) value", [firstSql, first])).rows[0].value;
        second = secondRun();
        let waited = 0;
        while ((await waitingOnALock(pool)) === 0 && waited++ < 100) await new Promise((r2) => setTimeout(r2, 50));
        assert((await waitingOnALock(pool)) > 0, round + ": the second command waits for the first");
        await c.query("commit");
        return r;
      });
      [dep, conf] = round === 0 ? [firstResult, await second] : [await second, firstResult];
    } else {
      // Free-running with a growing head start for the departure.
      const lag = [0, 2, 5, 9][round % 4];
      [dep, conf] = await Promise.all([
        cmd("delivery.depart", departArgs, U.owner),
        new Promise((r) => setTimeout(r, lag)).then(() => cmd("delivery.confirm", confirmArgs, U.customer)),
      ]);
    }
    assert.equal(conf.status, "delivered", round + ": confirm succeeds before or after the departure");
    assert.equal(await dayStatusOf(pool, day.id), "delivered", round + ": day");
    assert.equal(await earnedOf(pool, day.id), 1, round + ": one earning");
    const f = (await pool.query("select status,confirmed_by,departed_at from v1.fulfillments where day_id=$1", [day.id])).rows[0];
    assert.equal(f.status, "delivered");
    assert.equal(f.confirmed_by, "customer");
    const pushed = (await pushCount()) - before;
    assert(pushed <= 1, round + ": at most one departure push, got " + pushed);
    assert.equal(pushed, dep.moved, round + ": a push only when the meal was moved");
    assert.equal(f.departed_at !== null, dep.moved === 1);
    if (dep.moved === 1) raced.departedFirst++;
    else raced.confirmedFirst++;
  }
  evidence.push(
    "Departure racing the customer's confirmation of the same meal 12 times delivers it once with one earning, confirmed by the customer, and at most one push (" +
      raced.departedFirst + " departed first, " + raced.confirmedFirst + " confirmed first).",
  );

  // 6. The daily maintenance renewal reminder while subscription.remindRenewal holds the same
  // 'renew-' key uncommitted: maintenance waits, then skips the key and finishes its run.
  const renewDays = await purchased(pool, cmd, P[4], addDays(today, 360));
  const renewSub = renewDays[0].subscription_id;
  await pool.query(
    "update v1.delivery_days set status='cancelled' where subscription_id=$1 and id not in (select id from v1.delivery_days where subscription_id=$1 order by service_date desc limit 2)",
    [renewSub],
  );
  await pool.query("update v1.subscriptions set status='active' where id=$1", [renewSub]);
  await pool.query("delete from v1.outbox where dedupe=$1", ["renew-" + renewSub]);
  const holder = await pool.connect();
  let maintenance;
  try {
    await holder.query("begin");
    await holder.query(
      "insert into v1.outbox(kind,payload,dedupe) values('push',jsonb_build_object('userId',$2::uuid,'body','Paket tinggal 3 hari.','href','/renew/'||$1),'renew-'||$1)",
      [renewSub, U.customer],
    );
    maintenance = system(pool, "maintenance", {}).then(() => null, (e) => e);
    let waited = 0;
    while ((await waitingOnALock(pool)) === 0 && waited++ < 100) await new Promise((r) => setTimeout(r, 50));
    assert((await waitingOnALock(pool)) > 0, "maintenance waits for the uncommitted renewal key");
    await holder.query("commit");
  } finally {
    holder.release();
  }
  const failed = await maintenance;
  assert.equal(failed, null, "maintenance finishes: " + (failed && failed.message));
  assert.deepEqual(
    (await pool.query("select kind from v1.outbox where dedupe=$1", ["renew-" + renewSub])).rows,
    [{ kind: "push" }],
  );
  assert.equal(
    (await pool.query("select count(*)::int n from v1.notifications where kind='renewal' and href='/renew/'||$1", [renewSub])).rows[0].n,
    0,
    "no second renewal message from maintenance",
  );
  evidence.push(
    "Daily maintenance meeting a renewal key that subscription.remindRenewal holds uncommitted waits, skips that key without a second message and completes its run.",
  );

  // 7. A role that may not read auth.users still gets the delivery read, with no WhatsApp number.
  await pool.query("create schema if not exists auth");
  const madeUsers = !(await pool.query("select to_regclass('auth.users') is not null x")).rows[0].x;
  if (madeUsers) await pool.query("create table auth.users(id uuid primary key, phone text, phone_confirmed_at timestamptz)");
  await pool.query("do $$ begin if not exists(select 1 from pg_roles where rolname='catera_no_auth') then create role catera_no_auth; end if; end $$");
  await pool.query("grant usage on schema v1, auth to catera_no_auth");
  await pool.query("grant select on v1.staff to catera_no_auth");
  await pool.query("revoke all on auth.users from catera_no_auth");
  await pool.query("grant execute on function v1.caterer_whatsapp(uuid) to catera_no_auth");
  const denied = await pool.connect();
  try {
    await denied.query("begin");
    await denied.query("set local role catera_no_auth");
    const phone = (await denied.query("select v1.caterer_whatsapp($1) p", [CATERER_IDS[0]])).rows[0].p;
    assert.equal(phone, null, "denied auth.users gives no number");
    await denied.query("rollback");
  } finally {
    denied.release();
  }
  await pool.query("revoke execute on function v1.caterer_whatsapp(uuid) from catera_no_auth");
  await pool.query("revoke all on v1.staff from catera_no_auth");
  await pool.query("revoke usage on schema v1, auth from catera_no_auth");
  await pool.query("drop role catera_no_auth");
  if (madeUsers) await pool.query("drop table auth.users");
  evidence.push("v1.caterer_whatsapp returns no number instead of failing the customer read when auth.users is not readable.");
}
