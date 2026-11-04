// Release gate: a database runs the RPC wrapper stacks the repo describes (security audit 2026-11-04, M2).
//
// Every migration that changes a public RPC renames the current function to a *_base layer and puts a new wrapper on
// top, so a guard often lives in exactly one layer (for example "staff cannot set delivered" in the delivery_arrive
// wrapper). Applied out of order, or re-run with `create or replace`, a layer silently drops out of the chain and its
// guard goes with it. This walks each live chain from the top and checks, read-only:
//   1. the chain holds every layer the repo's migrations create, in the repo's order (hosted-only layers from
//      supabase/hosted/*.sql may sit in between, and are reported);
//   2. every layer is SECURITY DEFINER with a fixed search_path;
//   3. only the top of each chain is executable by clients, with the grants the API expects.
//
// Hosted: DATABASE_URL=postgresql://... node scripts/verify-function-stack.mjs   (exit 1 on any failure)
// The script never writes: it runs in a read-only transaction and reads pg_proc only.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Who may call the top of each chain. `null` roles must not have EXECUTE. */
export const RPC_GRANTS = {
  catera_v1_command: { args: "text,jsonb,uuid", allow: ["authenticated"], deny: ["anon"] },
  catera_v1_read: { args: "text,jsonb", allow: ["anon", "authenticated"], deny: [] },
  catera_v1_system: { args: "text,jsonb", allow: ["service_role"], deny: ["anon", "authenticated"] },
  catera_v1_reconcile: { args: "text,uuid,jsonb,uuid", allow: ["authenticated"], deny: ["anon"] },
  catera_v1_manifest: { args: "uuid", allow: ["authenticated"], deny: ["anon"] },
  catera_v1_usage: { args: "text,text", allow: ["authenticated"], deny: ["anon"] },
};

/**
 * Repo layers that a hosted project holds elsewhere in its chain on purpose, because a file in supabase/hosted puts the
 * repo's behaviour back on top. Each entry names that file. They are left out of the order comparison and reported.
 */
export const ACCEPTED_HOSTED_ORDER = {
  // Hosted applied caterer_journey_reads after customer_live_address; 20261023_catera_v2_live_address_reapply.sql
  // re-wraps the live-address read above it.
  catera_v1_read: ["catera_v1_read_journeys_base"],
};

const renames = (sql, name) =>
  [...sql.matchAll(new RegExp(`alter\\s+function\\s+public\\.${name}\\s*\\([^)]*\\)\\s+rename\\s+to\\s+([a-z0-9_]+)`, "gi"))].map(
    (m) => m[1].toLowerCase(),
  );

/** The layers the repo's migrations create for one RPC, oldest first, and the hosted-only layers. */
export async function repoLayers(name, dir = root) {
  const migrations = (await readdir(path.join(dir, "supabase/migrations"))).filter((f) => f.endsWith(".sql")).sort();
  const layers = [];
  for (const f of migrations) layers.push(...renames(await readFile(path.join(dir, "supabase/migrations", f), "utf8"), name));
  let hosted = [];
  try {
    for (const f of (await readdir(path.join(dir, "supabase/hosted"))).filter((x) => x.endsWith(".sql")).sort())
      hosted.push(...renames(await readFile(path.join(dir, "supabase/hosted", f), "utf8"), name));
  } catch {
    hosted = [];
  }
  return { layers: [...new Set(layers)], hosted: [...new Set(hosted)] };
}

/**
 * `query(sql, params)` resolves to `{ rows }` (pg and PGlite both do). Returns the failures found, empty when the
 * database is in shape, plus notes on hosted-only layers.
 */
export async function verifyFunctionStack(query, { dir = root, rpcs = Object.keys(RPC_GRANTS) } = {}) {
  const failures = [];
  const notes = [];
  for (const name of rpcs) {
    const { args, allow, deny } = RPC_GRANTS[name];
    const { layers, hosted } = await repoLayers(name, dir);
    const known = new Set([...layers, ...hosted]);
    const order = new Map(layers.map((l, i) => [l, i]));
    const fn = async (proname) =>
      (
        await query(
          `select p.prosrc src, p.prosecdef definer, coalesce(array_to_string(p.proconfig, ','), '') config,
                  has_function_privilege('anon', p.oid, 'execute') anon,
                  has_function_privilege('authenticated', p.oid, 'execute') authenticated,
                  has_function_privilege('service_role', p.oid, 'execute') service_role
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = $1`,
          [proname],
        )
      ).rows;
    const walked = [];
    const unknownLayers = new Set();
    let current = name;
    while (current) {
      if (walked.includes(current)) {
        failures.push(`${name}: the chain loops at ${current}`);
        break;
      }
      const found = await fn(current);
      if (found.length !== 1) {
        failures.push(`${name}: ${current} ${found.length ? "is overloaded" : "is missing"}`);
        break;
      }
      const [row] = found;
      walked.push(current);
      if (!row.definer) failures.push(`${name}: ${current} is not SECURITY DEFINER`);
      if (!/(^|,)search_path=/.test(row.config)) failures.push(`${name}: ${current} has no fixed search_path`);
      const roles = { anon: row.anon, authenticated: row.authenticated, service_role: row.service_role };
      if (current === name) {
        for (const r of allow) if (!roles[r]) failures.push(`${name}: ${r} cannot execute the top of the chain`);
        for (const r of deny) if (roles[r]) failures.push(`${name}: ${r} can execute the top of the chain`);
      } else
        for (const r of ["anon", "authenticated"])
          if (roles[r]) failures.push(`${name}: ${r} can execute the inner layer ${current}`);
      // The next layer is the most recent known layer this body calls. Older bodies may also call a far older
      // layer directly; that is legitimate only when the walk still meets every layer below, checked after.
      const calls = [...row.src.matchAll(/public\.([a-z0-9_]+)\s*\(/gi)]
        .map((m) => m[1].toLowerCase())
        .filter((n) => n !== current && n.startsWith(name + "_"));
      const ranked = calls
        .filter((n) => known.has(n))
        .sort((a, b) => (order.get(b) ?? Infinity) - (order.get(a) ?? Infinity));
      const unknown = [...new Set(calls.filter((n) => !known.has(n)))];
      let next = ranked[0];
      // A layer no repo or hosted file creates: applied by hand, or from work not committed. Name it and keep walking
      // through it, so the layers below are still checked.
      if (unknown.length === 1 && !ranked.length) {
        failures.push(`${name}: ${unknown[0]} is not created by any file in supabase/migrations or supabase/hosted`);
        unknownLayers.add(unknown[0]);
        next = unknown[0];
      } else if (unknown.length) failures.push(`${name}: ${current} calls unknown layers ${unknown.join(", ")}`);
      current = next;
    }
    const accepted = ACCEPTED_HOSTED_ORDER[name] ?? [];
    const inner = walked.slice(1);
    const extras = inner.filter((l) => hosted.includes(l));
    if (extras.length) notes.push(`${name}: hosted-only layers ${extras.join(", ")}`);
    const missing = layers.filter((l) => !inner.includes(l));
    if (missing.length) failures.push(`${name}: the live chain skips ${missing.join(", ")}`);
    // Oldest first, as the repo lists them; only layers both sides know are compared.
    const keep = (l) => order.has(l) && !missing.includes(l) && !(extras.length && accepted.includes(l));
    const live = inner.filter(keep).reverse();
    const expected = layers.filter(keep);
    const at = expected.findIndex((l, i) => live[i] !== l);
    if (at >= 0)
      failures.push(
        `${name}: out of repo order above ${at ? expected[at - 1] : "the bottom"}: the repo puts ${expected[at]} next, the live chain ${live[at]}`,
      );
    for (const l of accepted)
      if (extras.length && inner.includes(l)) notes.push(`${name}: ${l} sits where the hosted reapply file puts it`);
  }
  return { failures, notes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the database to check (read-only).");
    process.exit(2);
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("begin transaction read only");
    const { failures, notes } = await verifyFunctionStack((sql, params) => client.query(sql, params));
    await client.query("rollback");
    for (const n of notes) console.log("note: " + n);
    if (failures.length) {
      for (const f of failures) console.error("FAIL " + f);
      process.exitCode = 1;
    } else console.log("Function stacks match the repo: " + Object.keys(RPC_GRANTS).join(", "));
  } finally {
    await client.end();
  }
}
