import { it, expect } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";

async function fixture() {
  const db = await createDemoDatabase(true);
  const cmd = (
    action: string,
    payload: any,
    user: string = U.customer,
    key = crypto.randomUUID(),
  ) => localRpc<any>(db, user, "catera_v1_command", [action, payload, key]);
  const sys = (action: string, payload: any = {}) =>
    localRpc<any>(db, null, "catera_v1_system", [action, payload], true);
  const c = await cmd("checkout.create", { acceptedTerms: true, ...({
    packageId: P[2],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), 30),
    trial: false,
  }) });
  const s = await cmd("checkout.demo_pay", { id: c.id });
  const allocation = (
    await db.query<any>("select * from v1.allocations where checkout_id=$1", [
      c.id,
    ])
  ).rows[0];
  const days = (
    await db.query<any>(
      "select * from v1.settlement_day_allocations where allocation_id=$1 order by ordinal",
      [allocation.id],
    )
  ).rows;
  const credit = async (index: number) =>
    db.query(
      "insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,created_at) values($1,$2,$3,'earned',$4,$5,v1.settlement_cutoff(now())-interval '1 second')",
      [
        K[0],
        allocation.id,
        days[index].day_id,
        days[index].amount,
        "test:" + days[index].day_id,
      ],
    );
  const refund = async (amount: number, dayIds: string[]) => {
    const support = await cmd("support.create", {
      subscriptionId: s.subscriptionId,
      subject: "Synthetic refund",
      description: "Synthetic refund regression test",
    });
    await cmd(
      "support.resolve",
      {
        id: support.id,
        amount,
        reason: "Synthetic refund approval",
        cancelRemaining: false,
      },
      U.platform_admin,
    );
    const r = (
      await db.query<any>("select id from v1.refunds where case_id=$1", [
        support.id,
      ])
    ).rows[0];
    await sys("refund.update", {
      id: r.id,
      state: "succeeded",
      providerId: "synthetic-" + r.id,
    });
    const key = crypto.randomUUID(),
      args = [
        "refund",
        r.id,
        {
          sellerDeduction: amount,
          dayIds,
          reference: "synthetic-transfer",
          reason: "Synthetic verified refund",
        },
        key,
      ];
    await localRpc(db, U.platform_admin, "catera_v1_reconcile", args);
    await localRpc(db, U.platform_admin, "catera_v1_reconcile", args);
    return r;
  };
  const policy = async (min = 1, max = 2147483647) => {
    await cmd(
      "settlement.policy",
      {
        catererId: K[0],
        enabled: true,
        synthetic: true,
        minimumAmount: min,
        maximumAmount: max,
        reason: "Synthetic policy test",
      },
      U.platform_admin,
    );
    await cmd(
      "settlement.features",
      {
        multiCycle: true,
        automaticPayouts: true,
        reason: "Synthetic policy test",
      },
      U.platform_admin,
    );
  };
  return { db, cmd, sys, c, s, allocation, days, credit, refund, policy };
}
it("refunds reduce future entitlements and debit earned days exactly once", async () => {
  const f = await fixture();
  try {
    await f.credit(0);
    await f.refund(1000, [f.days[0].day_id]);
    await f.refund(2000, [f.days[1].day_id]);
    const entries = (
      await f.db.query<any>(
        "select kind,amount::int amount from v1.settlement_entries where kind in('refund_debit','entitlement_reduction') order by amount",
      )
    ).rows;
    expect(entries).toEqual([
      { kind: "entitlement_reduction", amount: -2000 },
      { kind: "refund_debit", amount: -1000 },
    ]);
    await f.db.query(
      "update v1.fulfillments set status='delivered' where day_id=$1",
      [f.days[1].day_id],
    );
    await f.db.query(
      "update v1.delivery_days set status='delivered' where id=$1",
      [f.days[1].day_id],
    );
    expect(
      (
        await f.db.query<any>(
          "select amount::int amount from v1.settlement_entries where day_id=$1 and kind='earned'",
          [f.days[1].day_id],
        )
      ).rows[0].amount,
    ).toBe(f.days[1].amount - 2000);
    expect(
      (
        await f.db.query<any>("select amount from v1.allocations where id=$1", [
          f.allocation.id,
        ])
      ).rows[0].amount,
    ).toBe(f.allocation.amount);
  } finally {
    await f.db.close();
  }
});
it("a support hold after planning cancels an unsent transfer", async () => {
  const f = await fixture();
  try {
    await f.credit(0);
    await f.policy();
    await f.sys("settlement.run");
    const p = (
      await f.db.query<any>(
        "select * from v1.payouts where settlement_run_id is not null",
      )
    ).rows[0];
    await f.cmd("support.create", {
      subscriptionId: f.s.subscriptionId,
      subject: "Synthetic issue",
      description: "Synthetic delivery issue before payout",
    });
    expect(
      await f.sys("payout.prepare", {
        id: p.id,
        request: {
          reference_id: p.id,
          payout_details: { source_amount: p.amount },
        },
      }),
    ).toBeNull();
    expect(
      (
        await f.db.query<any>("select status from v1.payouts where id=$1", [
          p.id,
        ])
      ).rows[0].status,
    ).toBe("cancelled");
  } finally {
    await f.db.close();
  }
});
it("chunks payouts at channel limits and carries sub-minimum remainder", async () => {
  const f = await fixture();
  try {
    await f.credit(0);
    await f.policy(10000, 20000);
    await f.sys("settlement.run");
    const payouts = (
      await f.db.query<any>(
        "select amount from v1.payouts where settlement_run_id is not null",
      )
    ).rows;
    expect(payouts.length).toBeGreaterThan(0);
    expect(payouts.every((p) => p.amount >= 10000 && p.amount <= 20000)).toBe(
      true,
    );
    expect(payouts.reduce((n, p) => n + p.amount, 0)).toBeLessThanOrEqual(
      f.days[0].amount,
    );
    const legacy = await f.cmd(
      "payout.approve",
      { catererId: K[0], reason: "Synthetic manual payout" },
      U.platform_admin,
    );
    expect(
      (
        await f.db.query<any>(
          "select count(*)::int n from v1.payout_items where payout_id=$1 and allocation_id=$2",
          [legacy.id, f.allocation.id],
        )
      ).rows[0].n,
    ).toBe(0);
    await expect(
      f.cmd(
        "payout.approve",
        { catererId: K[0], reason: "Synthetic exhausted legacy payout" },
        U.platform_admin,
      ),
    ).rejects.toThrow("SETTLEMENT_SCHEDULED");
  } finally {
    await f.db.close();
  }
});
it("refund debt transfers between allocations with balanced immutable offsets", async () => {
  const f = await fixture();
  try {
    // A synthetic historical refund debt and a separate purchase with completed delivery earnings.
    await f.db.query(
      "insert into v1.settlement_entries(caterer_id,allocation_id,kind,amount,source,created_at) values($1,$2,'refund_debit',-5000,'test-debt',v1.settlement_cutoff(now())-interval '1 second')",
      [K[0], f.allocation.id],
    );
    const c2 = await f.cmd("checkout.create", { acceptedTerms: true, ...({
      packageId: P[2],
      addressId: A,
      portions: 1,
      startDate: addDays(localDay(), 100),
      trial: false,
    }) });
    await f.cmd("checkout.demo_pay", { id: c2.id });
    const a2 = (
      await f.db.query<any>(
        "select id from v1.allocations where checkout_id=$1",
        [c2.id],
      )
    ).rows[0].id;
    await f.db.query(
      "insert into v1.settlement_entries(caterer_id,allocation_id,kind,amount,source,created_at) values($1,$2,'earned',30000,'test-credit',v1.settlement_cutoff(now())-interval '1 second')",
      [K[0], a2],
    );
    await f.policy();
    await f.sys("settlement.run");
    await f.sys("settlement.run");
    const offsets = (
      await f.db.query<any>(
        "select count(*)::int n,sum(amount)::int amount from v1.settlement_entries where kind='debt_offset'",
      )
    ).rows[0];
    expect(offsets).toEqual({ n: 2, amount: 0 });
    expect(
      (
        await f.db.query<any>("select v1.settlement_earned($1)::int amount", [
          f.allocation.id,
        ])
      ).rows[0].amount,
    ).toBe(0);
    expect(
      (
        await f.db.query<any>(
          "select sum(amount)::int amount from v1.payouts where settlement_run_id is not null",
        )
      ).rows[0].amount,
    ).toBe(25000);
  } finally {
    await f.db.close();
  }
});
