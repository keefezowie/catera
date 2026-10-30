import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

// seller-calendar counts a day only while the asked meal is still served (not cancelled, not issue),
// on real PostgreSQL and through the full wrapper chain, as the kitchen owner. Synthetic rows only.
export async function verifySellerCalendar(pool, evidence) {
  await pool.query(await readFile("supabase/migrations/20261030100000_seller_calendar_served_meals.sql", "utf8"));
  const base = addDays(localDay(), 400);
  const days = { cancelledDinner: addDays(base, 0), issueDinner: addDays(base, 1), cancelledAll: addDays(base, 2), served: addDays(base, 3) };
  const add = async (date, dinner, lunch = "scheduled") => {
    const sub = crypto.randomUUID(), day = crypto.randomUUID();
    await pool.query(
      "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p)),2,$3,$3 from v1.packages p where id=$4",
      [sub, U.customer, date, P[0]],
    );
    await pool.query("insert into v1.delivery_days(id,subscription_id,service_date,address,status) values($1,$2,$3,'{}','scheduled')", [day, sub, date]);
    await pool.query("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch',$2),($1,'dinner',$3)", [day, lunch, dinner]);
  };
  await add(days.cancelledDinner, "cancelled");
  await add(days.issueDinner, "issue");
  await add(days.cancelledAll, "cancelled", "cancelled");
  await add(days.served, "scheduled");
  const read = async (from, to, meal, status) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [U.owner]);
      const params = { id: K[0], from, to, meal, packageId: P[0], ...(status ? { status } : {}) };
      return (await c.query("select public.catera_v1_read('seller-calendar',$1) value", [params])).rows[0].value.days;
    } finally {
      await c.query("rollback").catch(() => {});
      c.release();
    }
  };
  assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "dinner"), []);
  assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "lunch"), [{ date: days.cancelledDinner, orders: 1, lunch: true, dinner: false }]);
  assert.deepEqual(await read(days.issueDinner, days.issueDinner, "dinner"), []);
  assert.deepEqual(await read(days.issueDinner, days.issueDinner, "all"), [{ date: days.issueDinner, orders: 1, lunch: true, dinner: false }]);
  assert.deepEqual(await read(days.cancelledAll, days.cancelledAll, "all"), []);
  assert.deepEqual(await read(days.served, days.served, "all"), [{ date: days.served, orders: 1, lunch: true, dinner: true }]);
  assert.deepEqual((await read(days.cancelledDinner, days.served, "dinner")).map((d) => d.date), [days.served]);
  await assert.rejects(
    (async () => {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [U.owner]);
        await c.query("select public.catera_v1_read('seller-calendar',$1)", [{ id: K[1], from: days.served, to: days.served }]);
      } finally {
        await c.query("rollback").catch(() => {});
        c.release();
      }
    })(),
    /FORBIDDEN/,
  );
  evidence.push("seller-calendar counts a day for a meal only while that meal is not cancelled or issue (cancelled-dinner and issue-dinner days vanish from Malam but stay in Siang), keeps the response shape, and still refuses another caterer's staff.");
}
