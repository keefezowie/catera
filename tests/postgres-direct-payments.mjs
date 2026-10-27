import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  await pool.query(
    await readFile("supabase/migrations/20261027120000_payment_channels.sql", "utf8"),
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
  // Payment channels: every bank, wallet and paylater code, redirect invoices, customer read.
  const ALL = [
    "QRIS",
    "VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_BANK_MANDIRI", "VIRTUAL_ACCOUNT_BRI", "VIRTUAL_ACCOUNT_BNI",
    "VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI", "VIRTUAL_ACCOUNT_BANK_PERMATA", "VIRTUAL_ACCOUNT_BANK_CIMB",
    "EMONEY_SHOPEE_PAY", "EMONEY_DANA", "EMONEY_OVO", "EMONEY_LINKAJA",
    "PEER_TO_PEER_KREDIVO", "PEER_TO_PEER_AKULAKU", "PEER_TO_PEER_INDODANA",
  ];
  await assert.rejects(
    sys("provider.direct.configure", { mode: "direct", methods: ["QRIS", "VIRTUAL_ACCOUNT_XYZ"], reason: "Unknown code must fail" }),
    /INVALID_INPUT/,
  );
  await assert.rejects(
    sys("provider.direct.configure", { mode: "direct", methods: ["CREDIT_CARD"], reason: "Cards are not direct" }),
    /INVALID_INPUT/,
  );
  await sys("provider.direct.configure", { mode: "direct", methods: ALL, reason: "Synthetic every-channel fixtures" });
  const fresh = async (days, pkg = P[1]) =>
    cmd("checkout.create", { acceptedTerms: true, packageId: pkg, addressId: A, portions: 1, startDate: addDays(localDay(), days), trial: false }, U.customer);
  const invoice = (id) => "CT" + createHash("sha256").update(id).digest("hex").slice(0, 26);
  const vaCheckout = await fresh(335, P[0]);
  await cmd("checkout.payment.start", { id: vaCheckout.id, method: "VIRTUAL_ACCOUNT_BCA" }, U.customer);
  const vaOp = await sys("provider.operation", { id: vaCheckout.id, kind: "payment" });
  assert.equal(vaOp.channel, "VIRTUAL_ACCOUNT_BCA");
  assert.equal(vaOp.reference, "CT" + vaCheckout.id.replaceAll("-", ""));
  for (const method of ["EMONEY_DANA", "QRIS", "VIRTUAL_ACCOUNT_BANK_CIMB"])
    await assert.rejects(cmd("checkout.payment.start", { id: vaCheckout.id, method }, U.customer), /PAYMENT_METHOD_LOCKED/);
  await cmd("checkout.payment.start", { id: vaCheckout.id, method: "VIRTUAL_ACCOUNT_BCA" }, U.customer);
  const walletCheckout = await fresh(335, P[2]);
  await cmd("checkout.payment.start", { id: walletCheckout.id, method: "EMONEY_SHOPEE_PAY" }, U.customer);
  const walletOp = await sys("provider.operation", { id: walletCheckout.id, kind: "payment" });
  assert.equal(walletOp.channel, "EMONEY_SHOPEE_PAY");
  assert.equal(walletOp.reference, invoice(walletCheckout.id));
  assert.ok(walletOp.reference.length < 30);
  assert.equal(
    (await pool.query("select provider_id from v1.checkouts where id=$1", [walletCheckout.id])).rows[0].provider_id,
    walletOp.reference,
  );
  await assert.rejects(
    cmd("checkout.payment.start", { id: walletCheckout.id, method: "VIRTUAL_ACCOUNT_BCA" }, U.customer),
    /PAYMENT_METHOD_LOCKED/,
  );
  const laterCheckout = await fresh(335, P[3]);
  await cmd("checkout.payment.start", { id: laterCheckout.id, method: "PEER_TO_PEER_KREDIVO" }, U.customer);
  const laterOp = await sys("provider.operation", { id: laterCheckout.id, kind: "payment" });
  assert.equal(laterOp.reference, invoice(laterCheckout.id));
  const lateFresh = await fresh(335, P[4]);
  await sys("provider.direct.configure", { mode: "direct", methods: ["QRIS"], reason: "Channel list shrinks" });
  await assert.rejects(
    cmd("checkout.payment.start", { id: lateFresh.id, method: "EMONEY_OVO" }, U.customer),
    /PAYMENT_UNAVAILABLE/,
  );
  // provider.payment.customer: service role only, fixed keys, null when not stored.
  const asRole = async (role, id) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query("select set_config('request.jwt.claims',$1,true),set_config('request.jwt.claim.sub',$2,true)", [JSON.stringify({ role }), U.customer]);
      return (await c.query("select public.catera_v1_system('provider.payment.customer',$1) value", [{ id }])).rows[0].value;
    } finally {
      await c.query("rollback");
      c.release();
    }
  };
  for (const role of ["authenticated", "anon"])
    await assert.rejects(asRole(role, laterCheckout.id), /FORBIDDEN/);
  await assert.rejects(asRole(null, laterCheckout.id), /FORBIDDEN/);
  const keys = ["address", "city", "email", "name", "packageName", "phone", "postcode"];
  const before = await sys("provider.payment.customer", { id: laterCheckout.id });
  assert.deepEqual(Object.keys(before).sort(), keys);
  assert.ok(before.name && before.address && before.city && before.packageName);
  assert.equal(before.phone, null);
  assert.equal(before.email, null);
  assert.equal(before.postcode, null);
  const madeAuth = !(await pool.query("select to_regclass('auth.users') is not null x")).rows[0].x;
  if (madeAuth)
    await pool.query("create table auth.users(id uuid primary key, phone text, email text)");
  await pool.query("insert into auth.users(id,phone,email) values($1,'+6281200000001','synthetic@example.test') on conflict(id) do update set phone=excluded.phone,email=excluded.email", [U.customer]);
  const after = await sys("provider.payment.customer", { id: laterCheckout.id });
  assert.deepEqual(Object.keys(after).sort(), keys);
  assert.equal(after.phone, "+6281200000001");
  assert.equal(after.email, "synthetic@example.test");
  await assert.rejects(sys("provider.payment.customer", { id: crypto.randomUUID() }), /NOT_FOUND/);
  // Later suites buy the same dates: expire this section's pending checkouts and free their holds.
  const mine = [vaCheckout.id, walletCheckout.id, laterCheckout.id, lateFresh.id];
  await pool.query("update v1.reservations set state='released' where checkout_id=any($1) and state='held'", [mine]);
  await pool.query("update v1.checkouts set state='expired' where id=any($1) and state='pending'", [mine]);
  await pool.query(madeAuth ? "drop table auth.users" : "delete from auth.users where id=$1", madeAuth ? [] : [U.customer]);
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
    "Direct payments: six competing method selections lock one channel; five submitters obtain one claim; five refreshes obtain one minute-limited inquiry; duplicate callbacks before attachment activate exactly once; ownership, immutable mode/channel and private RPC privileges enforced. Channels: every bank, wallet and paylater code is configurable and unknown codes are rejected; methods lock across kinds; redirect invoices equal the DOKU Checkout invoice; the customer read is service-role only with fixed keys.",
  );
}
