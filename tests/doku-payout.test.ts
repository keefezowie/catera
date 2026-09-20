import { beforeAll, afterAll, it, expect } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";
let db: Awaited<ReturnType<typeof createDemoDatabase>>, payout: any;
const sys = (action: string, payload: any = {}) =>
  localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
const cmd = (action: string, payload: any, user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [
    action,
    payload,
    crypto.randomUUID(),
  ]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  for (const [i, provider] of ["doku", "xendit"].entries()) {
    await sys("provider.configure", {
      provider,
      environment: provider === "doku" ? "sandbox" : "legacy",
      merchant: provider === "doku" ? "MCH-test" : "",
      reason: "Synthetic source separation",
    });
    const c = await cmd("checkout.create", {
      packageId: P[0],
      addressId: A,
      portions: 1,
      startDate: addDays(localDay(), 100 + i * 30),
      trial: false,
    });
    await cmd("checkout.demo_pay", { id: c.id });
    await db.query(
      "insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,created_at) select a.caterer_id,a.id,d.day_id,'earned',d.amount,'doku-test:'||d.day_id,v1.settlement_cutoff(now())-interval '1 second' from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where a.checkout_id=$1 order by d.ordinal limit 1",
      [c.id],
    );
  }
  await cmd(
    "settlement.policy",
    {
      catererId: K[0],
      enabled: true,
      synthetic: true,
      reason: "Synthetic payout tests",
    },
    U.platform_admin,
  );
  await cmd(
    "settlement.features",
    {
      multiCycle: true,
      automaticPayouts: true,
      reason: "Synthetic payout tests",
    },
    U.platform_admin,
  );
  await sys("settlement.run");
  const rows = (
    await db.query<any>(
      "select * from v1.payouts where status='approved' and settlement_run_id is not null",
    )
  ).rows;
  for (const p of rows)
    if (
      (await sys("provider.payout.identity", { id: p.id })).provider === "doku"
    )
      payout = p;
});
afterAll(async () => {
  await db?.close();
});
it("partitions mixed provider earnings before any provider submission", async () => {
  const rows = (
    await db.query<any>(
      "select id,amount from v1.payouts where status='approved' and settlement_run_id is not null",
    )
  ).rows;
  expect(rows).toHaveLength(2);
  const identities = await Promise.all(
    rows.map((p) => sys("provider.payout.identity", { id: p.id })),
  );
  expect(identities.map((x) => x.provider).sort()).toEqual(["doku", "xendit"]);
  const used = (
    await db.query<any>(
      "select sum(v1.settlement_used(id))::int n from v1.allocations",
    )
  ).rows[0].n;
  expect(used).toBe(rows.reduce((total, p) => total + p.amount, 0));
});
it("leases payout preparation, retries insufficient funding, and prevents stale workers submitting", async () => {
  const input = {
    id: payout.id,
    merchant: "MCH-test",
    request: { bank: "synthetic", amount: payout.amount },
  };
  const first = await sys("provider.payout.claim", input);
  expect(first.submit).toBe(true);
  expect((await sys("provider.payout.claim", input)).submit).toBe(false);
  await sys("provider.error", {
    kind: "payout",
    id: payout.id,
    code: "DOKU_INSUFFICIENT_FUNDING",
    leaseToken: first.lease_token,
  });
  const second = await sys("provider.payout.claim", {
    ...input,
    request: { bank: "changed" },
  });
  expect(second.submit).toBe(true);
  expect(second.request).toEqual(first.request);
  expect(second.lease_token).not.toBe(first.lease_token);
  const result = { referenceNo: "inquiry-1", request: { bank: "synthetic" } };
  await expect(
    sys("provider.payout.capture", {
      id: payout.id,
      leaseToken: first.lease_token,
      result,
    }),
  ).rejects.toThrow("CONFLICT");
  await sys("provider.payout.capture", {
    id: payout.id,
    leaseToken: second.lease_token,
    result,
  });
  expect((await sys("provider.payout.claim", input)).submit).toBe(false);
});
it("applies confirmed success and reversal exactly once without releasing unknown transfers", async () => {
  const event = {
    id: payout.id,
    providerId: "inquiry-1",
    amount: payout.amount,
    currency: "IDR",
    status: "succeeded",
    eventKey: "doku:success",
  };
  await expect(sys("payout.event", event)).rejects.toThrow(
    "PROVIDER_EVENT_ROUTE_REQUIRED",
  );
  await sys("provider.payout.event", event);
  expect(await sys("provider.payout.event", event)).toEqual({
    duplicate: true,
  });
  const paid = async () =>
    (
      await db.query<any>(
        "select sum(paid_out)::int amount from v1.allocations where id in(select allocation_id from v1.payout_items where payout_id=$1)",
        [payout.id],
      )
    ).rows[0].amount;
  expect(await paid()).toBe(payout.amount);
  await sys("provider.payout.event", {
    ...event,
    status: "reversed",
    eventKey: "doku:reversal",
  });
  await sys("provider.payout.event", {
    ...event,
    status: "reversed",
    eventKey: "doku:reversal",
  });
  expect(await paid()).toBe(0);
});
