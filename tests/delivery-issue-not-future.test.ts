import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";
import { addDays, jakartaDay } from "@catera/domain";

// C-01: a delivery problem can be reported for today or earlier in Jakarta, never for a day ahead.
let db: PGlite;
const today = jakartaDay(new Date());
const cmd = (action: string, payload: object, actor: string = U.customer) =>
  localRpc<any>(db, actor, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const report = (deliveryId: string, meal: string, actor?: string) =>
  cmd("deliveryIssue.create", { deliveryId, meal, subject: "Belum sampai", body: "Makanan belum datang." }, actor);

/**
 * One of the customer's days on `date`, with a meal it serves. The seed schedules weekdays from
 * today+2, so `date` may already be a delivery day; that day is used as is, otherwise one is moved.
 */
async function dayOn(date: string): Promise<{ id: string; meal: string }> {
  const row = (
    await db.query<{ id: string; meal: string }>(
      `select d.id,f.meal from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id
       join v1.fulfillments f on f.day_id=d.id
       where s.user_id=$1 and d.status<>'cancelled' and f.status<>'cancelled'
        and not exists(select 1 from v1.delivery_issues i where i.day_id=d.id)
        and (d.service_date=$2::date
         or not exists(select 1 from v1.delivery_days x where x.subscription_id=d.subscription_id and x.service_date=$2::date))
       order by d.service_date=$2::date desc,d.service_date desc,d.id limit 1`,
      [U.customer, date],
    )
  ).rows[0];
  if (!row) throw new Error(`no customer delivery day can be placed on ${date}`);
  await db.query("update v1.delivery_days set service_date=$2::date where id=$1", [row.id, date]);
  return row;
}

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("refuses a report for a day after Jakarta today, and files nothing", async () => {
  for (const ahead of [1, 11]) {
    const day = await dayOn(addDays(today, ahead));
    await expect(report(day.id, day.meal)).rejects.toThrow("NOT_ALLOWED");
    expect((await db.query("select 1 from v1.delivery_issues where day_id=$1", [day.id])).rows).toHaveLength(0);
  }
});

it("still accepts today's and yesterday's meals", async () => {
  for (const back of [0, 1]) {
    const day = await dayOn(addDays(today, -back));
    expect((await report(day.id, day.meal)).status).toBe("open");
  }
});

it("does not tell another account whether a future day exists", async () => {
  const day = await dayOn(addDays(today, 3));
  await expect(report(day.id, day.meal, U.owner)).rejects.toThrow("FORBIDDEN");
});
