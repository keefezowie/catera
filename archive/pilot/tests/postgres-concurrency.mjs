import pg from "pg";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { localBootstrap, demoSeed, DEMO_USERS } from "../src/lib/demo-seed.ts";
let embedded, pool;
async function setup() {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const root = path.resolve(".data", "tests");
    await mkdir(root, { recursive: true });
    const dir = await mkdtemp(path.join(root, "postgres-"));
    embedded = new EmbeddedPostgres({
      databaseDir: dir,
      user: "postgres",
      password: "catera-local-test",
      port: 55439,
      persistent: true,
      postgresFlags: ["-h", "127.0.0.1"],
      onLog: () => {},
      onError: () => {},
    });
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("catera_test");
    url = "postgresql://postgres:catera-local-test@127.0.0.1:55439/catera_test";
  }
  if (new URL(url).pathname != "/catera_test")
    throw Error("Use a disposable database named catera_test.");
  pool = new pg.Pool({ connectionString: url, max: 8 });
  const { rows } = await pool.query(
    "select to_regclass('public.businesses') as existing",
  );
  if (rows[0].existing)
    throw Error("Test database must be empty; existing data is never deleted.");
  await pool.query(localBootstrap);
  await pool.query(
    await readFile("supabase/migrations/202609080001_core.sql", "utf8"),
  );
  await pool.query(demoSeed);
}
async function rpc(action, payload, uid = DEMO_USERS.owner) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      uid,
    ]);
    const { rows } = await client.query(
      "select public.execute_command($1,$2,$3,$4) result",
      ["dapur-hijau", action, JSON.stringify(payload), crypto.randomUUID()],
    );
    await client.query("commit");
    return rows[0].result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
async function snapshot() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
      DEMO_USERS.owner,
    ]);
    const { rows } = await client.query(
      "select public.workspace_snapshot('dapur-hijau') as s",
    );
    await client.query("commit");
    return rows[0].s;
  } finally {
    client.release();
  }
}
try {
  await setup();
  let s = await snapshot();
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 5);
  const date = day.toISOString().slice(0, 10);
  const customer = await rpc("save_customer", {
    name: "Concurrent customer",
    email: "",
    phone: "",
    address: { line: "Test Address 123", city: "Jakarta" },
  });
  const pack = await rpc("save_package", {
    name: "Single quota",
    deliveries: 1,
    validity_days: null,
  });
  await rpc("purchase", {
    customer_id: customer.id,
    package_id: pack.id,
    starts_on: date,
  });
  const bookings = await Promise.allSettled(
    s.slots.map((slot) =>
      rpc("generate_schedule", {
        customer_id: customer.id,
        starts_on: date,
        ends_on: date,
        weekdays: [day.getUTCDay()],
        slot_ids: [slot.id],
      }),
    ),
  );
  assert.equal(bookings.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    bookings.filter(
      (x) =>
        x.status === "rejected" && x.reason.message === "INSUFFICIENT_QUOTA",
    ).length,
    1,
  );
  console.log("PASS: concurrent bookings cannot spend the last quota twice.");
  s = await snapshot();
  let d = s.deliveries.find(
    (d) => d.status === "scheduled" && new Date(d.cutoff_at) < new Date(),
  );
  for (const status of ["ready", "out_for_delivery"]) {
    await rpc("transition", { id: d.id, version: d.version, status });
    d = (await snapshot()).deliveries.find((x) => x.id === d.id);
  }
  await Promise.all([
    rpc("transition", { id: d.id, version: d.version, status: "delivered" }),
    rpc("transition", { id: d.id, version: d.version, status: "delivered" }),
  ]);
  assert.equal(
    Number(
      (
        await pool.query(
          "select count(*) as n from public.quota_ledger where delivery_id=$1 and kind='consume'",
          [d.id],
        )
      ).rows[0].n,
    ),
    1,
  );
  console.log(
    "PASS: simultaneous delivery confirmations create one deduction.",
  );
  // Begin a subscriber transaction before cutoff, but keep it blocked on the tenant lock until after cutoff.
  s = await snapshot();
  d = s.deliveries.find(
    (d) =>
      d.customer_id ===
        s.customers.find((c) => c.user_id === DEMO_USERS.subscriber).id &&
      new Date(d.cutoff_at) > new Date(),
  );
  await pool.query(
    "update public.deliveries set cutoff_at=clock_timestamp()+interval '900 milliseconds' where id=$1",
    [d.id],
  );
  const lock = await pool.connect();
  await lock.query("begin");
  await lock.query("select id from public.businesses where id=$1 for update", [
    s.business.id,
  ]);
  const blocked = rpc(
    "change_delivery",
    { id: d.id, version: d.version, change: "skip" },
    DEMO_USERS.subscriber,
  ).then(
    () => ({ ok: true }),
    (e) => ({ ok: false, code: e.message }),
  );
  await lock.query("select pg_sleep(1.2)");
  await lock.query("commit");
  lock.release();
  assert.deepEqual(await blocked, { ok: false, code: "CUTOFF_REACHED" });
  console.log(
    "PASS: requests waiting on a lock are checked against actual time after cutoff.",
  );
  assert.deepEqual(
    (await pool.query("select public.check_integrity() as issues")).rows[0]
      .issues,
    [],
  );
  console.log("PASS: real PostgreSQL integrity reconciliation.");
  const health = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/health-report.mjs"], {
      env: { ...process.env, DATABASE_URL: pool.options.connectionString },
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      try {
        resolve({ code, report: JSON.parse(output) });
      } catch (error) {
        reject(error);
      }
    });
  });
  assert.equal(health.code, 2); // This isolated cluster intentionally has no cron extension.
  assert.equal(health.report.cron_history_available, false);
  assert.equal(health.report.discrepancy_count, 0);
  console.log(
    "PASS: operator health report flags missing cron with aggregate-only output.",
  );
  if (process.argv.includes("--benchmark")) {
    const benchmarks = [];
    const pack = await rpc("save_package", {
      name: "Synthetic benchmark quota",
      deliveries: 20,
      validity_days: null,
    });
    for (const [count, total] of [
      [100, 100],
      [400, 500],
    ]) {
      await pool.query(
        `with new_customers as (
 insert into public.customers(business_id,name,address) select $1,'Benchmark '||gen_random_uuid(),'{"line":"Synthetic address 123","city":"Jakarta"}'::jsonb from generate_series(1,$3::int) returning *
 ), new_purchases as (
 insert into public.purchases(business_id,customer_id,package_id,terms,starts_on) select business_id,id,$2,'{"name":"Synthetic","deliveries":20}'::jsonb,current_date from new_customers returning *
 ), new_grants as (
 insert into public.quota_grants(business_id,customer_id,purchase_id,starts_on) select business_id,customer_id,id,starts_on from new_purchases returning *
 ), new_ledger as (
 insert into public.quota_ledger(business_id,grant_id,amount,kind) select business_id,id,20,'grant' from new_grants
 ), new_deliveries as (
 insert into public.deliveries(business_id,customer_id,grant_id,service_date,slot_id,address,cutoff_at)
 select g.business_id,g.customer_id,g.id,current_date+n,$4,'{"line":"Synthetic address 123","city":"Jakarta"}'::jsonb,catera.cutoff_for(g.business_id,current_date+n)
 from new_grants g cross join generate_series(3,22) n returning *
 ) insert into public.quota_reservations(business_id,delivery_id,grant_id) select business_id,id,grant_id from new_deliveries`,
        [s.business.id, pack.id, count, s.slots[0].id],
      );
      const timings = [];
      let bytes = 0;
      for (let n = 0; n < 6; n++) {
        const start = performance.now();
        const snapshotValue = await snapshot();
        const elapsed = performance.now() - start;
        bytes = Buffer.byteLength(JSON.stringify(snapshotValue));
        if (n) timings.push(Math.round(elapsed));
      }
      timings.sort((a, b) => a - b);
      benchmarks.push({
        syntheticCustomersAdded: total,
        syntheticDeliveriesAdded: total * 20,
        snapshotMs: timings,
        medianMs: timings[2],
        maxMs: timings[4],
        responseBytes: bytes,
      });
    }
    const report = {
      measuredAt: new Date().toISOString(),
      engine: (await pool.query("select version() as v")).rows[0].v,
      scope:
        "Local native PostgreSQL; five warm full-workspace RPC samples per dataset. Excludes network, SSR and browser rendering. Synthetic sizes are fixtures, not business volumes or product capacity.",
      benchmarks,
    };
    await mkdir("docs/verification", { recursive: true });
    await writeFile(
      "docs/verification/benchmark.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    assert.deepEqual(
      (await pool.query("select public.check_integrity() as issues")).rows[0]
        .issues,
      [],
    );
  }
  if (embedded) {
    const client = await pool.connect();
    const pgVersion = (await client.query("select version() as v")).rows[0].v;
    client.release();
    console.log("Database engine: " + pgVersion.split(" on ")[0]);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await pool?.end();
  await embedded?.stop();
}
