import type { PGlite } from "@electric-sql/pglite";
import { DEMO_STATE_DAY_LIKE } from "../../packages/backend/src/demo-states";

/**
 * The demo database ships with a busy kitchen day: Dapur Senja's route today, with Nadia and five other customers.
 * A test whose counts are about the meals it buys itself (what one cook, depart or reminder run moves) calls this
 * first, which cancels the demo's scheduled meals. Delivered history and the other demo states stay as they are.
 */
export async function setAsideDemoKitchenDay(db: PGlite) {
  await db.query(
    "update v1.fulfillments set status='cancelled' where status='scheduled' and day_id in (select id from v1.delivery_days where id::text like $1)",
    [DEMO_STATE_DAY_LIKE],
  );
  await db.query("update v1.delivery_days set status='cancelled' where status='scheduled' and id::text like $1", [
    DEMO_STATE_DAY_LIKE,
  ]);
}
