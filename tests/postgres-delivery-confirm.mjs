import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ADDRESS_ID as A,
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
      // Auto-delivery does not stamp a confirmer yet, so a meal the job won is unconfirmed.
      assert(["customer", null].includes(f.confirmed_by), "confirmed_by " + f.confirmed_by);
      assert.equal(f.confirmed_by === null, f.confirmed_at === null);
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
}
