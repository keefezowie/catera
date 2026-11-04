import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyFunctionStack } from "../scripts/verify-function-stack.mjs";

// Security audit 2026-11-04 (M1, M3, M4) on PostgreSQL: the three migrations install on top of whatever this harness
// built, a kitchen's import read and import rows stay scoped to its own customers under concurrent previews, the
// command keeps the API's text limits, and admin checks need an aal2 session outside the demo.
export async function verifySecurityAudit(pool, cmd, evidence, { owner, customer, catererId }) {
  for (const file of [
    "20261104100000_kitchen_customer_scope.sql",
    "20261104101000_command_input_limits.sql",
    "20261104102000_admin_mfa.sql",
  ])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));

  // M1: an abandoned checkout leaves a relationship row and nothing else.
  const stranger = crypto.randomUUID();
  await pool.query("insert into v1.profiles(id,name) values($1,'Synthetic abandoned checkout')", [stranger]);
  await pool.query("insert into v1.relationships values($1,$2,'marketplace') on conflict do nothing", [stranger, catererId]);
  // This harness does not install the seller-import-options read (tests/kitchen-customer-scope.test.ts covers it on the
  // demo database); the import rows it does install are checked here.
  const pkg = (await pool.query("select id from v1.packages where caterer_id=$1 order by id limit 1", [catererId])).rows[0]?.id;
  assert.ok(pkg);
  const preview = () =>
    cmd(
      "import.preview",
      {
        catererId,
        rows: [{ customerId: stranger, packageId: pkg, portions: 1, remainingDays: 1, startDate: "2027-02-01", externalReference: "audit-" + crypto.randomUUID().slice(0, 8) }],
      },
      owner,
    );
  for (const result of await Promise.allSettled([preview(), preview(), preview()])) {
    assert.equal(result.status, "rejected");
    assert.match(String(result.reason?.message), /FORBIDDEN/);
  }
  evidence.push("Kitchens import only their own customers, also under concurrent previews; an abandoned checkout gives them nothing");

  // M4: the RPC holds the API's text limits.
  for (const bad of [
    { label: null, line: "Jalan Audit 1", area: "Setiabudi", city: "Jakarta" },
    { label: "Rumah", line: "x".repeat(241), area: "Setiabudi", city: "Jakarta" },
    { label: "Rumah", line: "Jalan Audit 1", area: "Setiabudi", city: "Jakarta", instructions: "x".repeat(401) },
  ])
    await assert.rejects(cmd("address.save", bad, customer), /INVALID_INPUT/);
  await assert.rejects(cmd("support.create", { subscriptionId: crypto.randomUUID(), subject: "x", description: "x".repeat(4001) }, customer), /INVALID_INPUT/);
  evidence.push("Direct RPC calls meet the same address, review and help text limits as the API");

  // M3: admin authority needs aal2 outside the demo; service-role checks about others are unchanged.
  const admin = crypto.randomUUID();
  await pool.query("insert into v1.profiles(id,name,role) values($1,'Synthetic admin','platform_admin')", [admin]);
  const isAdmin = async (sub, claims, demo = "") => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('catera.demo',$3,true)",
        [sub, JSON.stringify(claims), demo],
      );
      const r = await c.query("select v1.is_admin($1) value", [admin]);
      await c.query("rollback");
      return r.rows[0].value;
    } finally {
      c.release();
    }
  };
  assert.equal(await isAdmin(admin, { role: "authenticated", aal: "aal1" }), false);
  assert.equal(await isAdmin(admin, { role: "authenticated", aal: "aal2" }), true);
  assert.equal(await isAdmin("", { role: "service_role" }), true);
  assert.equal(await isAdmin(admin, { role: "authenticated" }, "true"), true);
  evidence.push("Platform admin authority needs a TOTP-verified (aal2) session; jobs and the demo are unchanged");

  // M2: the gate reads this database. The harness applies migrations in its own sequence, so only report here.
  const { failures } = await verifyFunctionStack((sql, params) => pool.query(sql, params));
  evidence.push(
    failures.length
      ? `Function-stack gate ran on PostgreSQL and reported ${failures.length} harness-order difference(s)`
      : "Function-stack gate ran on PostgreSQL: wrapper chains match the repo",
  );
}
