import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "../packages/domain/src/index.ts";
export async function verifyDoku(pool, cmd, evidence) {
  await pool.query(
    await readFile("packages/backend/src/doku-sandbox.sql", "utf8"),
  );
  const sys = async (action, payload = {}) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true),set_config('catera.demo','true',true)",
      );
      const r = (
        await c.query("select public.catera_v1_system($1,$2) result", [
          action,
          payload,
        ])
      ).rows[0].result;
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  for (const file of [
    "20260919145757_settlement_pending_status_qualification.sql",
    "20260919145914_settlement_pending_claim_alias.sql",
    "20260919150043_outbox_claim_top_level_cte.sql",
  ])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  assert.ok(Array.isArray(await sys("settlement.pending")));
  const claimedJobs = (
    await Promise.all(Array.from({ length: 5 }, () => sys("outbox.claim")))
  ).flat();
  assert.ok(claimedJobs.length > 0);
  assert.equal(
    new Set(claimedJobs.map((job) => job.id)).size,
    claimedJobs.length,
  );
  evidence.push(
    "Hosted worker queries: settlement polling executes; five concurrent outbox workers claim each job once with PostgreSQL data-modifying CTEs.",
  );
  await sys("provider.configure", {
    provider: "doku",
    environment: "sandbox",
    merchant: "MCH-concurrency",
    reason: "Disposable PostgreSQL verification",
  });
  const checkout = await cmd(
    "checkout.create",
    {
      packageId: P[1],
      addressId: A,
      portions: 1,
      startDate: addDays(localDay(), 280),
      trial: false,
    },
    U.customer,
  );
  const reference = "CT" + checkout.id.replaceAll("-", "").slice(0, 26);
  const claims = await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.payment.claim", {
        id: checkout.id,
        merchant: "MCH-concurrency",
        reference,
        request: {},
      }),
    ),
  );
  assert.equal(claims.filter((c) => c.submit).length, 1);
  const event = {
    checkoutId: checkout.id,
    providerId: reference,
    paymentRequestId: "tx-" + checkout.id,
    eventId: "doku:" + reference,
    status: "paid",
    amount: checkout.quote.total,
    currency: "IDR",
  };
  await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.inbox.receive", {
        operationId: claims[0].id,
        eventId: event.eventId,
        event,
      }),
    ),
  );
  await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.inbox.apply", { id: event.eventId }),
    ),
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.subscriptions where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.allocations where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    sys("payment.event", event),
    /PROVIDER_EVENT_ROUTE_REQUIRED/,
  );
  const privileges = (
    await pool.query(
      "select has_function_privilege('anon','public.catera_v1_system(text,jsonb)','EXECUTE') a,has_function_privilege('authenticated','public.catera_v1_system_provider_base(text,jsonb)','EXECUTE') b,has_table_privilege('authenticated','v1.provider_operations','SELECT') c",
    )
  ).rows[0];
  assert.deepEqual(privileges, { a: false, b: false, c: false });
  await sys("provider.configure", {
    provider: "xendit",
    environment: "legacy",
    merchant: "",
    reason: "Restore default after test",
  });
  assert.equal(
    (
      await pool.query("select provider from v1.checkouts where id=$1", [
        checkout.id,
      ])
    ).rows[0].provider,
    "doku",
  );
  evidence.push(
    "DOKU: five concurrent submissions obtain one network claim; concurrent callback insertion/processing activates one subscription/allocation; provider identity survives rollback; legacy event route and client privileges cannot mutate DOKU operations.",
  );
}
