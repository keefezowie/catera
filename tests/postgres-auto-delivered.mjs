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

async function purchasedDays(pool, cmd, startDate) {
  const checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId: P[2], addressId: A, portions: 1, startDate, trial: false },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  return (
    await pool.query(
      "select d.id,d.service_date::text service_date,d.version from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by d.service_date",
      [checkout.id],
    )
  ).rows;
}

const earned = async (pool, id) =>
  (
    await pool.query(
      "select count(*)::int n from v1.settlement_entries where day_id=$1 and kind='earned'",
      [id],
    )
  ).rows[0].n;

export async function verifyAutoDelivered(pool, cmd, evidence) {
  await pool.query(
    await readFile("supabase/migrations/20261007100000_auto_delivered.sql", "utf8"),
  );
  const days = await purchasedDays(pool, cmd, addDays(localDay(), 120));
  const after = addDays(days[0].service_date, 1);

  // Two overlapping job runs recognise each day's earning once.
  await Promise.all([
    system(pool, "delivery.autoDeliver", { today: after }),
    system(pool, "delivery.autoDeliver", { today: after }),
  ]);
  assert.equal(
    (await pool.query("select status from v1.delivery_days where id=$1", [days[0].id])).rows[0]
      .status,
    "delivered",
  );
  assert.equal(await earned(pool, days[0].id), 1);
  evidence.push("Overlapping auto-delivery runs mark a past day delivered once and recognise one earning.");

  // A caterer update holding the day lock wins; the job skips the day instead of waiting or overriding it.
  const held = await pool.connect();
  try {
    await held.query("begin");
    await held.query("select id from v1.delivery_days where id=$1 for update", [days[1].id]);
    const marked = await system(pool, "delivery.autoDeliver", {
      today: addDays(days[1].service_date, 1),
    });
    assert.equal(
      (await pool.query("select status from v1.delivery_days where id=$1", [days[1].id])).rows[0]
        .status,
      "scheduled",
    );
    assert(marked >= 0);
    await held.query("update v1.fulfillments set status='cancelled' where day_id=$1", [days[1].id]);
    await held.query("update v1.delivery_days set status='cancelled' where id=$1", [days[1].id]);
    await held.query("commit");
  } catch (e) {
    await held.query("rollback");
    throw e;
  } finally {
    held.release();
  }
  await system(pool, "delivery.autoDeliver", { today: addDays(days[1].service_date, 1) });
  assert.equal(
    (await pool.query("select status from v1.delivery_days where id=$1", [days[1].id])).rows[0]
      .status,
    "cancelled",
  );
  assert.equal(await earned(pool, days[1].id), 0);
  evidence.push(
    "Auto-delivery skips a day locked by a concurrent cancellation and never earns on a cancelled day.",
  );

}
