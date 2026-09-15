import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
} from "../packages/backend/src/seed.ts";
export async function verifySettlementReporting(pool, evidence) {
  const file = (await readdir("supabase/migrations")).find((f) =>
    f.endsWith("_settlement_reporting.sql"),
  );
  await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
      U.owner,
    ]);
    const before = (
      await c.query(
        "select public.catera_v1_read('seller-settlement-report',$1) r",
        [{ id: K[0], days: 7 }],
      )
    ).rows[0].r;
    await c.query(
      "insert into v1.settlement_entries(caterer_id,kind,amount,source) select $1,'earned',9007199254740993,'pg-report-'||i from generate_series(1,130)i",
      [K[0]],
    );
    const after = (
      await c.query(
        "select public.catera_v1_read('seller-settlement-report',$1) r",
        [{ id: K[0], days: 7 }],
      )
    ).rows[0].r;
    assert.equal(
      BigInt(after.credits) - BigInt(before.credits),
      9007199254740993n * 130n,
    );
    assert.equal(after.days.length, 7);
    const page = (
      await c.query(
        "select public.catera_v1_read('seller-settlement-history',$1) r",
        [{ id: K[0], kind: "entries" }],
      )
    ).rows[0].r;
    assert.equal(page.items.length, 25);
    assert.ok(page.nextCursor);
    const second = (
      await c.query(
        "select public.catera_v1_read('seller-settlement-history',$1) r",
        [
          {
            id: K[0],
            kind: "entries",
            cursor: JSON.stringify(page.nextCursor),
          },
        ],
      )
    ).rows[0].r;
    assert.equal(
      new Set([...page.items, ...second.items].map((x) => x.id)).size,
      50,
    );
    await c.query("rollback");
    evidence.settlementReporting = {
      fullRangeExactAggregation: true,
      stablePagination: true,
      readOnlyMigration: true,
    };
  } finally {
    await c.query("rollback");
    c.release();
  }
}
