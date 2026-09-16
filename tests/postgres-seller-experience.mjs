import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as K,
} from "../packages/backend/src/seed.ts";

export async function verifySellerExperience(pool, cmd, evidence) {
  const migration = (await readdir("supabase/migrations")).find((f) =>
    f.endsWith("_seller_experience.sql"),
  );
  await pool.query(await readFile("supabase/migrations/" + migration, "utf8"));
  const record = crypto.randomUUID(),
    user = crypto.randomUUID();
  await pool.query(
    "insert into v1.profiles(id,name) values($1,'Synthetic messaging race')",
    [user],
  );
  await pool.query(
    "insert into v1.customer_records(id,caterer_id,user_id,name,origin) values($1,$2,$3,'Synthetic messaging race','seller')",
    [record, K[0], user],
  );
  const replies = await Promise.all(
    [U.owner, U.staff, U.owner].map((actor, i) =>
      cmd(
        "message.send",
        {
          catererId: K[0],
          customerRecordId: record,
          body: "Concurrent first message " + i,
        },
        actor,
      ),
    ),
  );
  assert.equal(new Set(replies.map((r) => r.id)).size, 1);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int n from v1.messages where conversation_id=$1",
        [replies[0].id],
      )
    ).rows[0].n,
    3,
  );
  const bank = {
    catererId: K[0],
    bank: "Synthetic Bank",
    holder: "Synthetic Owner",
    accountNumber: "12345678901",
    recipientType: "INDIVIDUAL",
  };
  const submitted = await cmd("payoutDestination.submit", bank, U.owner);
  const review = {
    id: submitted.id,
    version: submitted.version,
    decision: "approved",
    routingCode: "SYNTHETI",
    givenName: "Synthetic",
    surname: "Owner",
    reason: "Synthetic verified account",
  };
  const reviews = await Promise.allSettled(
    [1, 2].map(() => cmd("payoutDestination.review", review, U.platform_admin)),
  );
  assert.equal(reviews.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    reviews.find((r) => r.status === "rejected").reason.message,
    /CONFLICT/,
  );
  const replacement = await cmd(
    "payoutDestination.submit",
    { ...bank, accountNumber: "99999999999" },
    U.owner,
  );
  const original = (
    await pool.query(
      "select * from v1.payouts where settlement_run_id is not null limit 1",
    )
  ).rows[0];
  // Restore this disposable, previously reversed transfer to retrying state to test its immutable snapshot.
  await pool.query("update v1.payouts set status='submitting' where id=$1", [
    original.id,
  ]);
  const system = async (action, payload) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('request.jwt.claims','{\"role\":\"service_role\"}',true),set_config('catera.demo','true',true)",
      );
      const r = (
        await c.query("select public.catera_v1_system($1,$2) r", [
          action,
          payload,
        ])
      ).rows[0].r;
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  const [prepared] = await Promise.all([
    system("payout.prepare", {
      id: original.id,
      request: { ...original.recipient_request, recipient: { forged: true } },
    }),
    cmd(
      "payoutDestination.review",
      { ...review, id: replacement.id, version: replacement.version },
      U.platform_admin,
    ),
  ]);
  assert.deepEqual(prepared.recipient_request, original.recipient_request);
  assert.deepEqual(
    (
      await pool.query("select recipient_request from v1.payouts where id=$1", [
        original.id,
      ])
    ).rows[0].recipient_request,
    original.recipient_request,
  );
  assert.equal(
    (await system("payout.destination", { catererId: K[0] })).recipient
      .account_details.account_number,
    "99999999999",
  );
  const c = await pool.connect();
  try {
    for (const table of ["payout_destinations", "account_requests"]) {
      await c.query("begin");
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
        U.owner,
      ]);
      await assert.rejects(
        c.query("select * from v1." + table),
        /permission denied/,
      );
      await c.query("rollback");
    }
  } finally {
    await c.query("rollback");
    c.release();
  }
  const audit = (
    await pool.query(
      "select details from v1.audit where action like 'payoutDestination.%'",
    )
  ).rows;
  assert(!JSON.stringify(audit).includes(bank.accountNumber));
  evidence.push(
    "Concurrent seller first messages create one conversation and preserve all messages. Concurrent bank reviews accept one version; replacement approval racing transfer retry preserves its captured recipient. Private bank/account-request tables reject direct authenticated reads; audit records mask bank numbers.",
  );
}
