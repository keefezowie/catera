import type { PGlite } from "@electric-sql/pglite";
import { DEMO_STATE_DAY_LIKE } from "../../packages/backend/src/demo-states";

/** The operating fixture's purchase (`packages/backend/src/fixture.sql`): Nadia's Rantang Nusantara trial today. */
const FIXTURE_CHECKOUT = "select checkout_id from v1.payments where provider_id='demo-operating-fixture'";

/**
 * The demo database ships with a busy kitchen day: Dapur Senja's route today, with Nadia (the operating fixture's
 * trial) and five other customers. A test whose counts are about the meals it buys itself (what one cook, depart or
 * reminder run moves) calls this first, which cancels the demo's scheduled meals. Delivered history and the other demo
 * states stay as they are.
 */
export async function setAsideDemoKitchenDay(db: PGlite) {
  const days = `select id from v1.delivery_days where status='scheduled' and (id::text like $1 or subscription_id in
    (select subscription_id from v1.checkouts where id in (${FIXTURE_CHECKOUT})))`;
  await db.query(
    `update v1.fulfillments set status='cancelled' where status='scheduled' and day_id in (${days})`,
    [DEMO_STATE_DAY_LIKE],
  );
  await db.query(`update v1.delivery_days set status='cancelled' where id in (${days})`, [DEMO_STATE_DAY_LIKE]);
}

/**
 * A customer has one trial per caterer, and the demo's operating fixture is Nadia's Dapur Senja trial. A test about
 * Nadia buying a Dapur Senja trial itself calls this first: the fixture's one-day purchase stops being a trial (its
 * checkout and its plan), so checkout and payment no longer count it as her used trial. Purchase terms are immutable,
 * so this test-only setup step skips the guard triggers for its own two updates. Nothing else in such a test reads
 * that purchase.
 */
export async function setAsideDemoDapurTrial(db: PGlite) {
  await db.exec(`begin;
set local session_replication_role=replica;
update v1.checkouts set quote=jsonb_set(quote,'{trial}','false') where id in (${FIXTURE_CHECKOUT});
update v1.subscriptions set snapshot=jsonb_set(snapshot,'{trial}','false') where checkout_id in (${FIXTURE_CHECKOUT});
commit;`);
}
