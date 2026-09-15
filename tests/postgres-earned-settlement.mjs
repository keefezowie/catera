import assert from "node:assert/strict";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
} from "../packages/backend/src/seed.ts";
export async function verifyEarnedSettlement(pool, cmd, evidence) {
  const system = async (action, payload = {}) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true),set_config('catera.demo','true',true)",
      );
      const result = (
        await client.query("select public.catera_v1_system($1,$2) result", [
          action,
          payload,
        ])
      ).rows[0].result;
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  };
  const d = (
    await pool.query(
      "select d.*,a.caterer_id from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where not exists(select 1 from v1.settlement_entries e where e.day_id=d.day_id) order by d.ordinal limit 1",
    )
  ).rows[0];
  await pool.query(
    "insert into v1.settlement_entries(caterer_id,allocation_id,day_id,kind,amount,source,created_at) values($1,$2,$3,'earned',$4,'concurrent-earlier',v1.settlement_cutoff(now())-interval '1 second')",
    [d.caterer_id, d.allocation_id, d.day_id, d.amount],
  );
  await cmd(
    "settlement.policy",
    {
      catererId: K[0],
      enabled: true,
      synthetic: true,
      reason: "Synthetic concurrency",
    },
    U.platform_admin,
  );
  await cmd(
    "settlement.features",
    {
      multiCycle: true,
      automaticPayouts: true,
      reason: "Synthetic concurrency",
    },
    U.platform_admin,
  );
  await Promise.all(Array.from({ length: 3 }, () => system("settlement.run")));
  const payouts = (
    await pool.query(
      "select * from v1.payouts where settlement_run_id is not null",
    )
  ).rows;
  assert.equal(payouts.length, 1);
  assert.equal(payouts[0].amount, d.amount);
  const p = payouts[0],
    request = {
      reference_id: p.id,
      payout_details: { source_amount: p.amount },
      recipient: { synthetic: true },
    };
  const preparations = await Promise.all(
    Array.from({ length: 3 }, () =>
      system("payout.prepare", { id: p.id, request }),
    ),
  );
  assert(preparations.every((x) => x.recipient_request.reference_id === p.id));
  const event = {
    id: p.id,
    providerId: "po-concurrent",
    amount: p.amount,
    currency: "IDR",
    status: "succeeded",
    eventKey: "concurrent-success",
  };
  await Promise.all(
    Array.from({ length: 3 }, () => system("payout.event", event)),
  );
  assert.equal(
    (
      await pool.query("select paid_out from v1.allocations where id=$1", [
        d.allocation_id,
      ])
    ).rows[0].paid_out,
    p.amount,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.payout_events where event_key='concurrent-success'",
      )
    ).rows[0].n,
    1,
  );
  await Promise.all(
    Array.from({ length: 3 }, () =>
      system("payout.event", {
        ...event,
        status: "reversed",
        eventKey: "concurrent-reversed",
      }),
    ),
  );
  assert.equal(
    (
      await pool.query("select paid_out from v1.allocations where id=$1", [
        d.allocation_id,
      ])
    ).rows[0].paid_out,
    0,
  );
  evidence.push(
    "Concurrent weekly workers reserve earnings once; concurrent transfer preparations reuse one captured recipient, success callbacks pay once, and reversal callbacks release once.",
  );
}
