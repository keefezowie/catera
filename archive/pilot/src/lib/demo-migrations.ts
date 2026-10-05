import type { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const baseline = "202609080001_core.sql";

/** Forward-only upgrades for the explicit local demo, including pre-ledger databases. */
export async function applyDemoMigrations(
  db: PGlite,
  directory = path.join(process.cwd(), "supabase", "migrations"),
) {
  const migrations = (await readdir(directory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  await db.transaction(async (tx) => {
    // Existing synthetic workspaces already contain the original core migration.
    const exists = await tx.query<{ name: string | null }>(
      "select to_regclass('public.businesses')::text as name",
    );
    await tx.exec(`
      create schema if not exists catera;
      create table if not exists catera.local_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    if (exists.rows[0].name)
      await tx.query(
        "insert into catera.local_migrations(name) values($1) on conflict do nothing",
        [baseline],
      );
    for (const name of migrations) {
      const applied = await tx.query(
        "select 1 from catera.local_migrations where name=$1",
        [name],
      );
      if (applied.rows.length) continue;
      await tx.exec(await readFile(path.join(directory, name), "utf8"));
      await tx.query("insert into catera.local_migrations(name) values($1)", [
        name,
      ]);
    }
  });
}
