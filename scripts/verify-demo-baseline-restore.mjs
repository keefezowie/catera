import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { localBootstrap } from "../packages/backend/src/seed.ts";

const backup =
  process.argv[2] ?? ".data/backups/catera-v1-baseline-2026-09-11.sql";
const { default: EmbeddedPostgres } = await import("embedded-postgres");
await mkdir(".data/tests", { recursive: true });
const dataDir = await mkdtemp(path.resolve(".data/tests/catera-v1-restore-"));
assert.ok(dataDir.startsWith(path.resolve(".data/tests") + path.sep));
const port = await new Promise((resolve, reject) => {
  const socket = createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    socket.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const embedded = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "local-synthetic-restore",
  port,
  initdbFlags: ["--encoding=UTF8"],
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) => {
    if (process.env.CATERA_POSTGRES_DEBUG) console.log(message);
  },
  onError: (message) => console.error(message),
});
let pool;
try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase("catera_restore");
  pool = new pg.Pool({
    connectionString: `postgresql://postgres:local-synthetic-restore@127.0.0.1:${port}/catera_restore`,
  });
  await pool.query(localBootstrap);
  for (const file of (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql") && name !== "202609080001_core.sql")
    .sort()) {
    await pool.query(
      await readFile(path.join("supabase/migrations", file), "utf8"),
    );
  }
  await pool.query(`
    insert into v1.profiles(id,name,role) values
      ('01000000-0000-4000-8000-000000000001','Demo Pelanggan','customer'),
      ('01000000-0000-4000-8000-000000000002','Demo Pemilik','owner'),
      ('01000000-0000-4000-8000-000000000003','Demo Admin','platform_admin'),
      ('01000000-0000-4000-8000-000000000004','Demo Staf','staff');
    insert into v1.caterers(id,slug,name,description,areas,status)
      values('11000000-0000-4000-8000-000000000001','catera-demo-workspace','Demo Dapur Catera','Synthetic restore marker',array['Jakarta Selatan'],'draft');
    insert into v1.staff values
      ('11000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000002','owner'),
      ('11000000-0000-4000-8000-000000000001','01000000-0000-4000-8000-000000000004','staff');
    insert into v1.policies values(true,2500,8,3,true,true);
  `);
  await pool.query(await readFile(backup, "utf8"));

  const manifest = (
    await pool.query(
      "select details from v1.audit where action='demo.baseline.reset' order by created_at desc limit 1",
    )
  ).rows[0].details;
  assert.deepEqual(manifest.counts, {
    caterers: 3,
    packages: 7,
    checkouts: 11,
    customers: 7,
    deliveries: 36,
    supportCases: 4,
    subscriptions: 8,
  });
  assert.deepEqual(Object.keys(manifest.hashes).sort(), [
    "checkouts",
    "deliveries",
    "messages",
    "packages",
    "subscriptions",
  ]);
  assert.ok(
    Object.values(manifest.hashes).every((hash) => /^[a-f0-9]{32}$/.test(hash)),
  );

  const readAs = async (user, resource, params = {}) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [
        user,
      ]);
      const value = (
        await client.query("select public.catera_v1_read($1,$2) value", [
          resource,
          params,
        ])
      ).rows[0].value;
      await client.query("rollback");
      return value;
    } finally {
      client.release();
    }
  };
  const customer = await readAs(
    "01000000-0000-4000-8000-000000000001",
    "customer",
    { from: "2026-01-01", to: "2027-12-31", calendarMeta: "true" },
  );
  const seller = await readAs(
    "01000000-0000-4000-8000-000000000002",
    "seller",
    { id: "11000000-0000-4000-8000-000000000001", date: "2026-09-11" },
  );
  const staff = await readAs("01000000-0000-4000-8000-000000000004", "seller", {
    id: "11000000-0000-4000-8000-000000000001",
    date: "2026-09-11",
  });
  const admin = await readAs("01000000-0000-4000-8000-000000000003", "admin");
  assert.equal(customer.subscriptions.length, 2);
  assert.ok(customer.deliveries.length > 1);
  assert.ok(seller.deliveries.length >= 4);
  assert.ok(seller.transactions.length > 0);
  assert.deepEqual(staff.transactions, []);
  assert.deepEqual(staff.payouts, []);
  assert.ok(admin.caterers.some((item) => item.status === "submitted"));
  assert.equal(admin.refunds.length, 1);
  if (manifest.baselineVersion === "2026.09.11.2") {
    assert.ok(seller.contentRevisions.every(r => r.contents.menus.every(m => m.contentModel === "slots")));
    assert.equal((await pool.query("select count(*)::int n from v1.menus where not v1.valid_slot_menu(details,true,false)")).rows[0].n, 0);
    await pool.query(await readFile(backup, "utf8"));
    const repeated = (await pool.query("select details from v1.audit where action='demo.baseline.reset' order by created_at desc limit 1")).rows[0].details;
    assert.deepEqual(repeated.counts, manifest.counts);
    assert.deepEqual(repeated.hashes, manifest.hashes);
  }
  console.log(
    `Disposable restore verified: ${manifest.baselineVersion}, anchor ${manifest.anchorDate}.`,
  );
} finally {
  await pool?.end();
  await embedded.stop().catch(() => {});
  await rm(dataDir, { recursive: true, force: true });
}
