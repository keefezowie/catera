import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { addDays, localDay } from "@catera/domain";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as C, DEMO_ACTORS as U } from "../packages/backend/src/seed";

let db: PGlite;
const read = (actor: string | null, resource: string, params: object) =>
  localRpc<any>(db, actor, "catera_v1_read", [resource, params]);

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("attaches customer.phone only on today's active delivery stops for kitchen owners and staff", async () => {
  const today = localDay();
  const tomorrow = addDays(today, 1);
  const activeDayId = crypto.randomUUID();
  const cancelledDayId = crypto.randomUUID();
  const futureDayId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const cancelledSubId = crypto.randomUUID();

  // Ensure the customer profile has a known phone number.
  await db.query("update v1.profiles set phone=$1 where id=$2", ["+6281299990001", U.customer]);

  // Create synthetic subscriptions with an active today delivery, a cancelled today delivery, and a future delivery.
  for (const id of [subId, cancelledSubId]) {
    await db.query(
      `insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on)
       select $1,user_id,package_id,snapshot,1,$2,$3
       from v1.subscriptions
       where user_id=$4 and snapshot->'offer'->>'catererId'=$5
       order by id limit 1`,
      [id, today, tomorrow, U.customer, C[0]],
    );
  }
  await db.query(
    "insert into v1.delivery_days(id,subscription_id,service_date,address) select $1,$2,$3,address from v1.delivery_days order by id limit 1",
    [activeDayId, subId, today],
  );
  await db.query(
    "insert into v1.delivery_days(id,subscription_id,service_date,address) select $1,$2,$3,address from v1.delivery_days order by id limit 1",
    [cancelledDayId, cancelledSubId, today],
  );
  await db.query(
    "insert into v1.delivery_days(id,subscription_id,service_date,address) select $1,$2,$3,address from v1.delivery_days order by id limit 1",
    [futureDayId, subId, tomorrow],
  );
  await db.query("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch','scheduled')", [activeDayId]);
  await db.query("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch','cancelled')", [cancelledDayId]);
  await db.query("insert into v1.fulfillments(day_id,meal,status) values($1,'lunch','scheduled')", [futureDayId]);

  // Both owner and staff receive customer.phone on today's active stop, never on today's cancelled stop.
  for (const actor of [U.owner, U.staff]) {
    const todayRead = await read(actor, "seller", { id: C[0], date: today });
    const activeStop = todayRead.deliveries.find((d: any) => d.id === activeDayId);
    const cancelledStop = todayRead.deliveries.find((d: any) => d.id === cancelledDayId);
    expect(activeStop, "active today delivery should exist").toBeTruthy();
    expect(activeStop.customer.phone).toBe("+6281299990001");
    if (cancelledStop) expect(cancelledStop.customer.phone).toBeUndefined();

    // Future operational date must NOT expose customer.phone.
    const futureRead = await read(actor, "seller", { id: C[0], date: tomorrow });
    const futureStop = futureRead.deliveries.find((d: any) => d.id === futureDayId);
    expect(futureStop, "future delivery should exist").toBeTruthy();
    expect(futureStop.customer.phone).toBeUndefined();
  }

  // Non-member actors remain forbidden.
  await expect(read(U.customer, "seller", { id: C[0], date: today })).rejects.toThrow(/FORBIDDEN|UNAUTHORIZED/);
  await expect(read(U.owner, "seller", { id: C[1], date: today })).rejects.toThrow("FORBIDDEN");
});
