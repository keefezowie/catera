import { beforeAll, afterAll, it, expect } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  type SettlementReport,
  type SettlementPage,
  type SettlementPayout,
  type SettlementState,
} from "@catera/domain";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let payout: string;
let emptyPayout: string;
let checkoutId: string;
const read = <T>(
  resource: string,
  params: Record<string, unknown> = {},
  user: string | null = U.owner,
) =>
  localRpc<T>(db, user, "catera_v1_read", [resource, { id: K[0], ...params }]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await db.query(
    `insert into v1.settlement_entries(caterer_id,kind,amount,source,created_at)
 select $1,'earned',10,'report-credit-'||i,(statement_timestamp() at time zone 'Asia/Jakarta')::date::timestamp at time zone 'Asia/Jakarta' from generate_series(1,130)i`,
    [K[0]],
  );
  await db.query(
    `insert into v1.settlement_entries(caterer_id,kind,amount,source) values
 ($1,'earned',9007199254740993,'report-big'),($1,'refund_debit',-50,'report-refund'),($1,'recovery',20,'report-recovery'),($1,'debt_offset',-4,'report-offset'),($1,'entitlement_reduction',-99999,'report-entitlement')`,
    [K[0]],
  );
  await db.query(
    `insert into v1.settlement_entries(caterer_id,kind,amount,source,created_at) values
 ($1,'earned',777,'report-outside',(((statement_timestamp() at time zone 'Asia/Jakarta')::date-29)::timestamp at time zone 'Asia/Jakarta')-interval '1 microsecond'),
 ($1,'earned',31,'report-boundary',((statement_timestamp() at time zone 'Asia/Jakarta')::date-29)::timestamp at time zone 'Asia/Jakarta'),
 ($1,'earned',888,'report-tomorrow',((statement_timestamp() at time zone 'Asia/Jakarta')::date+1)::timestamp at time zone 'Asia/Jakarta')`,
    [K[0]],
  );
  const cmd = (action: string, payload: unknown, user = U.customer) =>
    localRpc<any>(db, user, "catera_v1_command", [
      action,
      payload,
      crypto.randomUUID(),
    ]);
  const co = await cmd("checkout.create", {
    packageId: P[2],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), 5),
    trial: false,
  });
  checkoutId = co.id;
  await cmd("checkout.demo_pay", { id: co.id });
  await db.query(
    `insert into v1.settlement_entries(caterer_id,allocation_id,kind,amount,source) select caterer_id,id,'earned',300,'report-held' from v1.allocations where checkout_id=$1`,
    [co.id],
  );
  await db.query("update v1.allocations set held=100 where checkout_id=$1", [
    co.id,
  ]);
  const policy = (
    await db.query<{ id: string }>(
      `insert into v1.settlement_policies(caterer_id,enabled,synthetic,actor_id,reason) values($1,false,true,$2,'Reporting fixtures') returning id`,
      [K[0], U.platform_admin],
    )
  ).rows[0].id;
  const run = (
    await db.query<{ id: string }>(
      `insert into v1.settlement_runs(caterer_id,policy_id,cutoff_at) values($1,$2,now()) returning id`,
      [K[0], policy],
    )
  ).rows[0].id;
  payout = (
    await db.query<{ id: string }>(
      `insert into v1.payouts(caterer_id,amount,status,settlement_run_id,recipient_request) values($1,200,'reversed',$2,'{"secret":"NEVER_RETURN"}') returning id`,
      [K[0], run],
    )
  ).rows[0].id;
  emptyPayout = (
    await db.query<{ id: string }>(
      `insert into v1.payouts(caterer_id,amount,status,settlement_run_id) values($1,10,'failed',$2) returning id`,
      [K[0], run],
    )
  ).rows[0].id;
  await db.query(
    `insert into v1.settlement_payout_items select $1,id,200 from v1.allocations where checkout_id=$2`,
    [payout, co.id],
  );
  await db.query(
    `insert into v1.payout_events(event_key,payout_id,fingerprint,status,created_at) values('report-1',$1,'private','pending',now()-interval '3 hours'),('report-2',$1,'private','pending',now()-interval '2 hours'),('report-3',$1,'private','succeeded',now()-interval '1 hour'),('report-4',$1,'private','reversed',now())`,
    [payout],
  );
}, 60000);
afterAll(async () => db?.close());
it("aggregates all records with exact integers and Jakarta half-open days", async () => {
  const r = await read<SettlementReport>("seller-settlement-report", {
    days: 30,
  });
  expect(r.days).toHaveLength(30);
  expect(r.credits).toBe(String(9007199254740993n + 1300n + 31n + 300n));
  expect(r.adjustments).toBe("-34");
  expect(r.days[0].credits).toBe("31");
  expect(r.days[1].credits).toBe("0");
  expect(r.days.at(-1)?.adjustments).toBe("-34");
  const week = await read<SettlementReport>("seller-settlement-report", {
    days: 7,
  });
  expect(week.days).toHaveLength(7);
  expect(BigInt(week.credits)).toBe(BigInt(r.credits) - 31n);
});
it("paginates tied timestamps without omitting or repeating records", async () => {
  const ids: string[] = [];
  let cursor: unknown = undefined;
  do {
    const p = await read<SettlementPage>("seller-settlement-history", {
      kind: "entries",
      ...(cursor ? { cursor: JSON.stringify(cursor) } : {}),
    });
    expect(p.items.length).toBeLessThanOrEqual(25);
    ids.push(...p.items.map((x) => x.id));
    cursor = p.nextCursor;
  } while (cursor);
  const count = (
    await db.query<{ n: number }>(
      "select count(*)::int n from v1.settlement_entries where caterer_id=$1",
      [K[0]],
    )
  ).rows[0].n;
  expect(ids).toHaveLength(count);
  expect(new Set(ids).size).toBe(count);
});
it("returns only safe payout details and recorded events", async () => {
  const p = await read<SettlementPayout>("seller-settlement-payout", {
    payoutId: payout,
  });
  expect(p.events.map((x) => x.status)).toEqual([
    "pending",
    "pending",
    "succeeded",
    "reversed",
  ]);
  expect(p.synthetic).toBe(true);
  expect(p.items[0].amount).toBe("200");
  expect(p.items[0].checkout_id).toBe(checkoutId);
  expect(JSON.stringify(p)).not.toMatch(
    /NEVER_RETURN|recipient_request|fingerprint/,
  );
  const empty = await read<SettlementPayout>("seller-settlement-payout", {
    payoutId: emptyPayout,
  });
  expect(empty.events).toEqual([]);
  expect(empty.status).toBe("failed");
  await expect(
    read("seller-settlement-payout", { payoutId: crypto.randomUUID() }),
  ).rejects.toThrow("NOT_FOUND");
});
it("reuses held amounts and excludes legacy payouts from reports", async () => {
  const holds = await read<SettlementPage>("seller-settlement-history", {
    kind: "holds",
  });
  const hold = holds.items.find((x) => x.checkout_id === checkoutId);
  expect(hold?.amount).toBe("300");
  expect(hold?.allocation_hold).toBe(true);
  const p = await read<SettlementPage>("seller-settlement-history", {
    kind: "payouts",
  });
  expect(p.items.map((x) => x.id).sort()).toEqual([payout, emptyPayout].sort());
});
it.each([null, U.customer, U.staff])(
  "rejects unauthorized report readers %s",
  async (user) => {
    for (const resource of [
      "seller-settlement-report",
      "seller-settlement-history",
      "seller-settlement-payout",
    ])
      await expect(
        read(resource, { kind: "entries", payoutId: payout }, user),
      ).rejects.toThrow(/UNAUTHORIZED|FORBIDDEN/);
  },
);
it("allows admin and rejects cross-tenant owner reads", async () => {
  await expect(read("seller-settlement-report", { id: K[1] })).rejects.toThrow(
    "FORBIDDEN",
  );
  const p = await read<SettlementReport>(
    "seller-settlement-report",
    {},
    U.platform_admin,
  );
  expect(p.days).toHaveLength(30);
  await expect(
    read(
      "seller-settlement-payout",
      { id: K[1], payoutId: payout },
      U.platform_admin,
    ),
  ).rejects.toThrow("NOT_FOUND");
});
it.each([{ days: 8 }, { days: "nonsense" }])(
  "rejects invalid chart range %j",
  async (params) => {
    await expect(read("seller-settlement-report", params)).rejects.toThrow(
      "INVALID_INPUT",
    );
  },
);
it("rejects invalid history and cursors", async () => {
  await expect(
    read("seller-settlement-history", { kind: "unknown" }),
  ).rejects.toThrow("INVALID_INPUT");
  for (const cursor of ["invalid", "{}", '{"at":"bad","id":"bad"}'])
    await expect(
      read("seller-settlement-history", { kind: "entries", cursor }),
    ).rejects.toThrow("INVALID_INPUT");
});
it("reports effective readiness without promising disabled or synthetic transfers", async () => {
  const s = await read<SettlementState>("seller-settlement");
  expect(s.reportingVersion).toBe(1);
  expect(s.payoutReadiness).toBe("synthetic");
  expect(s.nextProcessingAt).toBeNull();
  const missing = await read<SettlementState>(
    "seller-settlement",
    { id: K[1] },
    U.platform_admin,
  );
  expect(missing.payoutReadiness).toBe("not_configured");
  for (const [enabled, dispatch, status] of [
    [false, false, "seller_disabled"],
    [true, false, "dispatch_disabled"],
    [true, true, "ready"],
  ] as const) {
    await db.query(
      `insert into v1.settlement_policies(caterer_id,enabled,synthetic,actor_id,reason) values($1,$2,false,$3,'Readiness fixture')`,
      [K[1], enabled, U.platform_admin],
    );
    await db.query("update v1.purchase_features set automatic_payouts=$1", [
      dispatch,
    ]);
    const r = await read<SettlementState>(
      "seller-settlement",
      { id: K[1] },
      U.platform_admin,
    );
    expect(r.payoutReadiness).toBe(status);
    expect(!!r.nextProcessingAt).toBe(status === "ready");
  }
});

it("keeps private report helpers inaccessible to client roles", async () => {
  const result = (
    await db.query<{ allowed: boolean }>(
      `select has_function_privilege('authenticated','v1.settlement_report(uuid,integer)','EXECUTE') or has_function_privilege('anon','v1.settlement_history(uuid,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','v1.settlement_payout_detail(uuid,uuid,jsonb)','EXECUTE') allowed`,
    )
  ).rows[0];
  expect(result.allowed).toBe(false);
});
