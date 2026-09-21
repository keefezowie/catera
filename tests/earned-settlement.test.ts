import { beforeAll, afterAll, it, expect } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import { addDays, localDay, type Checkout } from "@catera/domain";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let checkout: Checkout;
let days: { id: string; amount: number }[];
const cmd = (action: string, payload: any, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [
    action,
    payload,
    crypto.randomUUID(),
  ]);
const sys = (action: string, payload: any = {}) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  checkout = await cmd("checkout.create", { acceptedTerms: true, ...({
    packageId: P[2],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), 5),
    trial: false,
  }) });
  await cmd("checkout.demo_pay", { id: checkout.id });
  days = (
    await db.query<any>(
      "select d.id,a.amount from v1.delivery_days d join v1.settlement_day_allocations a on a.day_id=d.id join v1.subscriptions s on s.id=d.subscription_id where s.checkout_id=$1 order by a.ordinal",
      [checkout.id],
    )
  ).rows;
});
afterAll(async () => db?.close());
it("polls pending payouts without colliding with the status variable", async () => {
  expect(await sys("settlement.pending")).toEqual([]);
});
it("recognizes exactly one daily credit only after both meals", async () => {
  await db.query(
    "update v1.fulfillments set status='delivered' where day_id=$1 and meal='lunch'",
    [days[0].id],
  );
  await expect(
    db.query("update v1.delivery_days set status='delivered' where id=$1", [
      days[0].id,
    ]),
  ).rejects.toThrow("INVALID_STATE");
  await db.query(
    "update v1.fulfillments set status='delivered' where day_id=$1",
    [days[0].id],
  );
  await db.query("update v1.delivery_days set status='delivered' where id=$1", [
    days[0].id,
  ]);
  await db.query("update v1.delivery_days set status='delivered' where id=$1", [
    days[0].id,
  ]);
  expect(
    (
      await db.query<any>(
        "select count(*)::int n,sum(amount)::int amount from v1.settlement_entries where day_id=$1 and kind='earned'",
        [days[0].id],
      )
    ).rows[0],
  ).toEqual({ n: 1, amount: days[0].amount });
});
it("weekly runs reserve once and verified events distinguish in-flight from paid", async () => {
  // Synthetic earlier earning to exercise the weekly cutoff without editing immutable entries.
  await db.query(
    "insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,created_at) select a.caterer_id,a.id,d.day_id,'earned',d.amount,'test-earlier:'||d.day_id,v1.settlement_cutoff(now())-interval '1 second' from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where d.day_id=$1",
    [days[1].id],
  );
  await cmd(
    "settlement.policy",
    {
      catererId: K[0],
      enabled: true,
      synthetic: true,
      reason: "Synthetic settlement test",
    },
    U.platform_admin,
  );
  await cmd(
    "settlement.features",
    {
      multiCycle: true,
      automaticPayouts: true,
      reason: "Synthetic settlement test",
    },
    U.platform_admin,
  );
  await sys("settlement.run");
  await sys("settlement.run");
  const p = (
    await db.query<any>(
      "select * from v1.payouts where settlement_run_id is not null",
    )
  ).rows;
  expect(p).toHaveLength(1);
  expect(p[0].amount).toBe(days[1].amount);
  await sys("payout.prepare", {
    id: p[0].id,
    request: {
      reference_id: p[0].id,
      payout_details: { source_amount: p[0].amount },
      recipient: { synthetic: true },
    },
  });
  const event = {
    id: p[0].id,
    providerId: "po-test",
    amount: p[0].amount,
    currency: "IDR",
    status: "succeeded",
    eventKey: "test-success",
  };
  await sys("payout.event", event);
  expect(await sys("payout.event", event)).toEqual({ duplicate: true });
  expect(
    (
      await db.query<any>(
        "select paid_out from v1.allocations where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].paid_out,
  ).toBe(p[0].amount);
  await sys("payout.event", {
    ...event,
    status: "reversed",
    eventKey: "test-reversal",
  });
  await sys("payout.event", {
    ...event,
    status: "reversed",
    eventKey: "test-reversal",
  });
  expect(
    (
      await db.query<any>(
        "select paid_out from v1.allocations where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].paid_out,
  ).toBe(0);
});
it("ledger and commercial day amounts reject rewriting", async () => {
  await expect(
    db.query("update v1.settlement_entries set amount=0"),
  ).rejects.toThrow("IMMUTABLE_HISTORY");
  await expect(
    db.query("update v1.settlement_day_allocations set amount=0"),
  ).rejects.toThrow("IMMUTABLE_HISTORY");
});
