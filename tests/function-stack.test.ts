import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase } from "../packages/backend/src/database";
// @ts-expect-error: a plain ESM script without types.
import { verifyFunctionStack } from "../scripts/verify-function-stack.mjs";

// Security audit 2026-11-04, M2: the release gate that compares a database's RPC wrapper stacks with the repo.
let db: PGlite;
const query = (sql: string, params?: unknown[]) => db.query(sql, params);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("finds the demo database, built in repo order, in shape", async () => {
  const { failures } = await verifyFunctionStack(query);
  expect(failures).toEqual([]);
});

it("reports a guard layer that dropped out of the chain", async () => {
  // Re-point the top wrapper past its base, as an out-of-order apply or a `create or replace` would.
  const src = (
    await db.query<{ src: string }>(
      "select prosrc src from pg_proc where oid='public.catera_v1_command(text,jsonb,uuid)'::regprocedure",
    )
  ).rows[0].src;
  const base = /public\.(catera_v1_command_[a-z0-9_]+_base)\(/.exec(src)![1];
  const below = /public\.(catera_v1_command_[a-z0-9_]+)\(/.exec(
    (
      await db.query<{ src: string }>("select prosrc src from pg_proc where proname=$1", [base])
    ).rows[0].src,
  )![1];
  await db.exec("begin");
  try {
    await db.exec(
      `create or replace function public.catera_v1_command(action text,payload jsonb,request_id uuid) returns jsonb
       language plpgsql security definer set search_path='' as $$ begin
       return public.${below}(action,payload,request_id); end $$`,
    );
    const { failures } = await verifyFunctionStack(query, { rpcs: ["catera_v1_command"] });
    expect(failures.some((f: string) => f.includes("skips " + base))).toBe(true);
    await db.exec(`grant execute on function public.${below}(text,jsonb,uuid) to authenticated`);
    const again = await verifyFunctionStack(query, { rpcs: ["catera_v1_command"] });
    expect(again.failures.some((f: string) => f.includes("inner layer"))).toBe(true);
  } finally {
    await db.exec("rollback");
  }
});
