import assert from "node:assert/strict";
import { readFile, readdir, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import pg from "pg";
import EmbeddedPostgres from "embedded-postgres";
import { localBootstrap } from "../packages/backend/src/seed.ts";
import { generate, ids } from "./clean-catalog.mjs";
await mkdir(".data/tests", { recursive: true });
const databaseDir = await mkdtemp(path.resolve(".data/tests/clean-catalog-"));
const port = await new Promise((resolve) => {
  const s = createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const embedded = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "local-catalog-verification",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let pool;
try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase("catalog");
  pool = new pg.Pool({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "local-catalog-verification",
    database: "catalog",
  });
  await pool.query(
    localBootstrap + " create table auth.users(id uuid primary key);",
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql") && x !== "202609080001_core.sql")
    .sort())
    await pool.query(await readFile("supabase/migrations/" + file, "utf8"));
  const backup = JSON.parse(
    await readFile(".data/backups/before-clean-catalog-20260916.json", "utf8"),
  ).tables;
  for (const table of ["profiles", "caterers", "staff", "policies"]) {
    await pool.query(`delete from v1.${table}`);
    await pool.query(
      `insert into v1.${table} select * from jsonb_populate_recordset(null::v1.${table},$1)`,
      [JSON.stringify(backup[table])],
    );
  }
  await pool.query(
    "insert into auth.users(id) select id from v1.profiles where id=any($1::uuid[])",
    [
      [
        ids.customer,
        ids.owners[0],
        ids.admin,
        "e5dc6d99-9c6a-4dc0-9684-fc66f4500612",
      ],
    ],
  );
  const sql = generate();
  await pool.query(sql);
  const counts = (
    await pool.query(
      "select (select count(*)::int from v1.packages) packages,(select count(*)::int from v1.dishes) dishes,(select count(*)::int from v1.menus) menus,(select count(*)::int from v1.subscriptions) subscriptions,(select count(*)::int from v1.delivery_days) deliveries,(select count(*)::int from v1.customer_menus) customer_menus",
    )
  ).rows[0];
  assert.equal(counts.packages, 9);
  assert.equal(counts.dishes, 27);
  assert.equal(counts.subscriptions, 14);
  assert(counts.customer_menus > 0);
  // Repeating the replacement must remove the entire prior graph cleanly.
  await pool.query(sql);
  // A failed reset must preserve the last good graph atomically.
  await assert.rejects(
    pool.query(
      sql
        .replace("'Nasi Box Rumahan — 5 Hari'", "'Nasi Box Rumahan — 5 Hari'")
        .replace('"price":32000', '"price":0'),
    ),
    /INVALID_OFFER/,
  );
  await pool.query("rollback");
  assert.equal(
    (await pool.query("select count(*)::int n from v1.packages")).rows[0].n,
    9,
  );
  for (const [role, uid] of [
    ["owner", ids.owners[0]],
    ["customer", ids.customer],
    ["platform_admin", ids.admin],
  ]) {
    await pool.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid,
    ]);
    const data = (
      await pool.query("select public.catera_v1_read('actor','{}') data")
    ).rows[0].data;
    assert.equal(data.role, role);
    const resource =
      role === "owner" ? "seller" : role === "customer" ? "customer" : "admin";
    const params =
      role === "owner"
        ? { id: ids.sellers[0] }
        : role === "customer"
          ? { from: "2026-01-01", to: "2027-12-31" }
          : {};
    await pool.query("select public.catera_v1_read($1,$2)", [resource, params]);
  }
  await mkdir("output/verification", { recursive: true });
  await writeFile(
    "output/verification/clean-catalog.json",
    JSON.stringify(
      {
        counts,
        repeatReset: true,
        rollbackPreservesCatalog: true,
        roleReads: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      counts,
      repeatReset: true,
      rollbackPreservesCatalog: true,
      roleReads: true,
    }),
  );
} finally {
  await pool?.end();
  await embedded.stop();
}
