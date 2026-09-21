import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
} from "../packages/backend/src/seed.ts";
import { addDays, localDay } from "@catera/domain";
export async function verifyDirectPayments(pool, cmd, evidence) {
  await pool.query(
    await readFile(
      "supabase/migrations/20260920154045_direct_payments.sql",
      "utf8",
    ),
  );
  const sys = async (action, payload = {}) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true)",
      );
      const r = (
        await c.query("select public.catera_v1_system($1,$2) value", [
          action,
          payload,
        ])
      ).rows[0].value;
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  await sys("provider.configure", {
    provider: "doku",
    environment: "sandbox",
    merchant: "MCH-direct-concurrency",
    reason: "Disposable PostgreSQL direct test",
  });
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: ["VIRTUAL_ACCOUNT_BRI", "QRIS"],
    reason: "Synthetic channel fixtures only",
  });
  const checkout = await cmd(
    "checkout.create",
    {
      acceptedTerms: true,
      packageId: P[1],
      addressId: A,
      portions: 1,
      startDate: addDays(localDay(), 330),
      trial: false,
    },
    U.customer,
  );
  const starts = await Promise.allSettled(
    Array.from({ length: 6 }, (_, i) =>
      cmd(
        "checkout.payment.start",
        { id: checkout.id, method: i % 2 ? "QRIS" : "VIRTUAL_ACCOUNT_BRI" },
        U.customer,
      ),
    ),
  );
  assert.equal(starts.filter((x) => x.status === "fulfilled").length, 3);
  for (const r of starts.filter((x) => x.status === "rejected"))
    assert.match(r.reason.message, /PAYMENT_METHOD_LOCKED/);
  const op = await sys("provider.operation", {
    id: checkout.id,
    kind: "payment",
  });
  const claims = await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.direct.submit", {
        id: checkout.id,
        request: { fixture: true },
      }),
    ),
  );
  assert.equal(claims.filter((x) => x.submit).length, 1);
  await pool.query(
    "update v1.provider_operations set lease_until=null,polled_at=now()-interval '2 minutes' where id=$1",
    [op.id],
  );
  const polls = await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.direct.refresh", { id: checkout.id }),
    ),
  );
  assert.equal(polls.filter(Boolean).length, 1);
  const event = {
    checkoutId: checkout.id,
    providerId: op.reference,
    paymentRequestId: "direct-pg-payment",
    eventId: "direct-pg-event",
    status: "paid",
    amount: op.amount,
    currency: "IDR",
  };
  await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.inbox.receive", {
        operationId: op.id,
        eventId: "direct-pg-event",
        event,
      }),
    ),
  );
  await Promise.all(
    Array.from({ length: 5 }, () =>
      sys("provider.inbox.apply", { id: "direct-pg-event" }),
    ),
  );
  await sys("provider.direct.attached", {
    id: checkout.id,
    result: {
      expiresAt: new Date(
        Date.parse(checkout.expires_at) - 30000,
      ).toISOString(),
      instructions: {
        kind: "virtual_account",
        bank: "BRI",
        accountNumber: "123456",
        accountName: "SYNTHETIC",
      },
    },
  });
  const stored = (
    await pool.query(
      "select state,subscription_id from v1.checkouts where id=$1",
      [checkout.id],
    )
  ).rows[0];
  assert.equal(stored.state, "paid");
  assert.ok(stored.subscription_id);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.allocations where checkout_id=$1",
        [checkout.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await sys("provider.operation", { id: checkout.id, kind: "payment" }))
      .state,
    "succeeded",
  );
  await assert.rejects(
    cmd("checkout.payment.refresh", { id: checkout.id }, U.owner),
    /NOT_FOUND/,
  );
  await assert.rejects(
    pool.query("update v1.provider_operations set channel=$2 where id=$1", [
      op.id,
      op.channel === "QRIS" ? "VIRTUAL_ACCOUNT_BRI" : "QRIS",
    ]),
    /IMMUTABLE_PROVIDER/,
  );
  const privileges = (
    await pool.query(
      "select has_function_privilege('authenticated','public.catera_v1_system(text,jsonb)','EXECUTE') a,has_function_privilege('authenticated','public.catera_v1_command_direct_base(text,jsonb,uuid)','EXECUTE') b,has_table_privilege('anon','v1.provider_operations','SELECT') c",
    )
  ).rows[0];
  assert.deepEqual(privileges, { a: false, b: false, c: false });
  await sys("provider.direct.configure", {
    mode: "direct",
    methods: [],
    reason: "Disable new instruments without changing old ones",
  });
  await assert.rejects(
    cmd(
      "checkout.create",
      {
        acceptedTerms: true,
        packageId: P[1],
        addressId: A,
        portions: 1,
        startDate: addDays(localDay(), 350),
        trial: false,
      },
      U.customer,
    ),
    /PAYMENT_UNAVAILABLE/,
  );
  await sys("provider.configure", {
    provider: "xendit",
    environment: "legacy",
    merchant: "",
    reason: "Restore disposable suite default",
  });
  evidence.push(
    "Direct payments: six competing method selections lock one channel; five submitters obtain one claim; five refreshes obtain one minute-limited inquiry; duplicate callbacks before attachment activate exactly once; ownership, immutable mode/channel and private RPC privileges enforced.",
  );
}
