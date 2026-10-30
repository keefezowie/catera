import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";

// seller-calendar counts a day for a meal only while that meal is not cancelled; an issue (Gagal diantar) meal still
// counts. Real PostgreSQL, the full wrapper chain, as the kitchen owner. Synthetic rows only, all rolled back.
export async function verifySellerCalendar(pool, evidence) {
  await pool.query(await readFile("supabase/migrations/20261030100000_seller_calendar_served_meals.sql", "utf8"));
  const base = addDays(localDay(), 400);
  const days = { cancelledDinner: addDays(base, 0), issueDinner: addDays(base, 1), cancelledAll: addDays(base, 2), served: addDays(base, 3) };
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('catera.demo','true',true)", [U.owner]);
    const add = async (date, dinner, lunch = "scheduled") => {
      const sub = crypto.randomUUID(), day = crypto.randomUUID();
      await c.query(
        "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,$2,id,jsonb_build_object('offer',v1.offer(p)),2,$3,$3 from v1.packages p where id=$4",
        [sub, U.customer, date, P[0]],
      );
      await c.query("insert into v1.delivery_days(id,subscription_id,service_date,address,status) values($1,$2,$3,'{}','scheduled')", [day, sub, date]);
      await c.query("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch',$2),($1,'dinner',$3)", [day, lunch, dinner]);
    };
    await add(days.cancelledDinner, "cancelled");
    await add(days.issueDinner, "issue");
    await add(days.cancelledAll, "cancelled", "cancelled");
    await add(days.served, "scheduled");
    const read = async (from, to, meal, status, id = K[0]) => {
      const params = { id, from, to, meal, packageId: P[0], ...(status ? { status } : {}) };
      return (await c.query("select public.catera_v1_read('seller-calendar',$1) value", [params])).rows[0].value.days;
    };
    assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "dinner"), []);
    assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "lunch"), [{ date: days.cancelledDinner, orders: 1, lunch: true, dinner: false }]);
    assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "all"), [{ date: days.cancelledDinner, orders: 1, lunch: true, dinner: false }]);
    assert.deepEqual(await read(days.issueDinner, days.issueDinner, "dinner"), [{ date: days.issueDinner, orders: 1, lunch: false, dinner: true }]);
    assert.deepEqual(await read(days.issueDinner, days.issueDinner, "all"), [{ date: days.issueDinner, orders: 1, lunch: true, dinner: true }]);
    assert.deepEqual(await read(days.cancelledAll, days.cancelledAll, "all"), []);
    assert.deepEqual(await read(days.served, days.served, "all"), [{ date: days.served, orders: 1, lunch: true, dinner: true }]);
    assert.deepEqual((await read(days.cancelledDinner, days.served, "dinner")).map((d) => d.date), [days.issueDinner, days.served]);
    // A meal cancelled on a running day is still listed under status=all.
    assert.deepEqual(await read(days.cancelledDinner, days.cancelledDinner, "dinner", "all"), [{ date: days.cancelledDinner, orders: 1, lunch: false, dinner: true }]);
    await c.query("savepoint forbidden");
    await assert.rejects(read(days.served, days.served, "all", undefined, K[1]), /FORBIDDEN/);
    await c.query("rollback to savepoint forbidden");
  } finally {
    await c.query("rollback").catch(() => {});
    c.release();
  }
  evidence.push("seller-calendar counts a day for a meal only while that meal is not cancelled (a cancelled dinner leaves Malam but stays in Siang), still counts an issue (Gagal diantar) meal, keeps the response shape, and still refuses another caterer's staff.");
}
