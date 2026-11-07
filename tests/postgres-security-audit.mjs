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

  // Audit hardening 2026-11-07 installs on top of this harness too. tests/audit-hardening.test.ts covers the behaviour;
  // this is what needs real concurrency.
  for (const file of ["20261008110000_import_assistant_quota.sql", "20261107100000_audit_hardening.sql"])
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  const kitchen = async (status) =>
    (await pool.query("insert into v1.caterers(slug,name,status) values($1,'Synthetic ceiling kitchen',$2) returning id", ["ceiling-" + crypto.randomUUID(), status])).rows[0].id;
  const race = async (status, spent, room) => {
    await pool.query("insert into v1.import_assistant_usage(caterer_id,day,calls) values($1,'2031-01-01',$2)", [await kitchen(status), spent]);
    const other = await kitchen(status);
    const spends = await Promise.allSettled(
      Array.from({ length: 12 }, () => pool.query("select v1.import_assistant_consume($1,'2031-01-01')", [other])),
    );
    assert.equal(spends.filter((r) => r.status === "fulfilled").length, room);
    assert.ok(spends.every((r) => r.status === "fulfilled" || /QUOTA/.test(r.reason?.message)));
  };
  // Below the five an unapproved kitchen may use and the twenty an approved one may, so the ceiling is what stops them.
  await race("draft", 97, 3);
  await race("approved", 495, 5);
  evidence.push("Twelve simultaneous assistant reads against each daily ceiling: exactly the room left passes, the rest answer QUOTA, and neither ceiling touches the other");

  // A paid event that failed 50 applies, including one past 50 under the old 1-minute retries: the same event arriving
  // again gives it one more claim each time, and an applied event stays applied.
  const sys = async (action, payload = {}) => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`select set_config('request.jwt.claims','{"role":"service_role"}',true)`);
      const r = (await c.query("select public.catera_v1_system($1,$2) result", [action, payload])).rows[0].result;
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  };
  const operationId = (await pool.query(
    `insert into v1.provider_operations(kind,entity_id,provider,environment,merchant,reference,state,amount)
     values('payment',gen_random_uuid(),'doku','sandbox','m',$1,'pending',1000) returning id`,
    ["stuck-" + crypto.randomUUID()],
  )).rows[0].id;
  const event = { status: "paid" };
  const receive = (eventId) => sys("provider.inbox.receive", { operationId, eventId, event });
  const stuck = async (eventId, attempts, processed = null) => {
    await receive(eventId);
    await pool.query("update v1.provider_inbox set attempts=$2,available_at=now()+interval '1 day',processed_at=$3 where id=$1", [eventId, attempts, processed]);
  };
  const claimed = async () => (await sys("provider.inbox.claim")).map((e) => e.id);
  const attempts = async (eventId) => (await pool.query("select attempts from v1.provider_inbox where id=$1", [eventId])).rows[0].attempts;
  await stuck("stuck-at-50", 50);
  await stuck("stuck-at-300", 300);
  await stuck("stuck-applied", 300, new Date());
  await stuck("stuck-backing-off", 12);
  assert.deepEqual(await claimed(), []);
  for (const id of ["stuck-at-50", "stuck-at-300", "stuck-applied", "stuck-backing-off"])
    assert.equal((await receive(id)).duplicate, true);
  assert.equal(await attempts("stuck-applied"), 300);
  assert.equal(await attempts("stuck-backing-off"), 12);
  assert.equal((await sys("health")).providerInboxStuck, 2);
  assert.deepEqual((await claimed()).sort(), ["stuck-at-300", "stuck-at-50"]);
  assert.equal(await attempts("stuck-at-300"), 50);
  assert.deepEqual(await claimed(), []);
  await receive("stuck-at-300");
  assert.deepEqual(await claimed(), ["stuck-at-300"]);
  await pool.query("delete from v1.provider_inbox where operation_id=$1", [operationId]);
  await pool.query("delete from v1.provider_operations where id=$1", [operationId]);
  evidence.push("A provider event past 50 failed applies gets one more claim each time it arrives again, and health keeps counting it");

  const open = (await pool.query(
    `select d.id,d.version,d.service_date,f.meal from v1.delivery_days d join v1.fulfillments f on f.day_id=d.id
     join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id
     where p.caterer_id=$1 and f.status='scheduled' and s.user_id is not null
      and d.service_date<=(now() at time zone 'Asia/Jakarta')::date
      and not exists(select 1 from v1.fulfillments g where g.day_id=d.id and g.meal<>f.meal)
     order by d.service_date desc limit 1`,
    [catererId],
  )).rows[0];
  if (open) {
    const issue = () => cmd("delivery.status", { id: open.id, version: open.version, meal: open.meal, status: "issue" }, owner);
    const reports = await Promise.allSettled([issue(), issue(), issue(), issue()]);
    assert.equal(reports.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await pool.query("select status from v1.fulfillments where day_id=$1", [open.id])).rows[0].status, "issue");
    evidence.push("Four simultaneous Gagal diantar calls on a scheduled meal: one lands, the others answer CONFLICT");
  } else evidence.push("Harness has no past scheduled meal: simultaneous Gagal diantar not exercised here");

  // M2: the gate reads this database. The harness applies migrations in its own sequence, so only report here.
  const { failures } = await verifyFunctionStack((sql, params) => pool.query(sql, params));
  evidence.push(
    failures.length
      ? `Function-stack gate ran on PostgreSQL and reported ${failures.length} harness-order difference(s)`
      : "Function-stack gate ran on PostgreSQL: wrapper chains match the repo",
  );
}
