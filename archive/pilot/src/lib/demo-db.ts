import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { localBootstrap, demoSeed } from "./demo-seed";
const globalDb = globalThis as unknown as { cateraDb?: Promise<PGlite> };
export function demoEnabled() {
  return process.env.CATERA_DEMO_MODE === "true" && !process.env.VERCEL;
}
export async function getDemoDb() {
  if (!demoEnabled()) throw new Error("DEMO_DISABLED");
  if (!globalDb.cateraDb)
    globalDb.cateraDb = (async () => {
      await mkdir(path.join(process.cwd(), ".data"), { recursive: true });
      const db = new PGlite(path.join(process.cwd(), ".data", "postgres"));
      await db.waitReady;
      const exists = await db.query<{ name: string | null }>(
        "select to_regclass('public.businesses')::text as name",
      );
      if (!exists.rows[0].name) {
        await db.exec(localBootstrap);
        await db.exec(
          await readFile(
            path.join(
              process.cwd(),
              "supabase/migrations/202609080001_core.sql",
            ),
            "utf8",
          ),
        );
        await db.exec(demoSeed);
      }
      // Local counterpart of hosted cron; no quota or fulfillment transitions occur here.
      const tick = () =>
        db.query("select public.run_due_freezes()").catch(() => {
          console.warn(JSON.stringify({ event: "catera.local_freeze_failed" }));
        });
      await tick();
      setInterval(tick, 60000).unref();
      return db;
    })();
  return globalDb.cateraDb;
}
export async function demoRpc<T>(
  userId: string,
  name: string,
  args: unknown[] = [],
): Promise<T> {
  const db = await getDemoDb();
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      userId,
    ]);
    const placeholders = args.map((_, i) => "$" + (i + 1)).join(",");
    if (
      !["workspace_snapshot", "list_workspaces", "execute_command"].includes(
        name,
      )
    )
      throw new Error("INVALID_RPC");
    const result = await tx.query<{ value: T }>(
      "select public." + name + "(" + placeholders + ") as value",
      args,
    );
    return result.rows[0].value;
  });
}
