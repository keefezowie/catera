import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";

// Security audit 2026-11-04, M3: admin authority needs an aal2 (TOTP-verified) session on hosted projects.
// localRpc always marks the demo, which keeps synthetic admins password-only, so these calls set the claims the way
// PostgREST does for a hosted request instead.
let db: PGlite;
async function asCaller<T>(sub: string, claims: Record<string, unknown>, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('catera.demo','',true)",
      [sub, JSON.stringify(claims)],
    );
    return (await tx.query<{ value: T }>(sql, params)).rows[0].value;
  });
}
const adminRead = (aal?: string) =>
  asCaller(U.platform_admin, { role: "authenticated", ...(aal ? { aal } : {}) }, "select public.catera_v1_read('admin','{}') value");
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("refuses admin reads and admin commands to a password-only session", async () => {
  expect(await failure(adminRead())).toContain("FORBIDDEN");
  expect(await failure(adminRead("aal1"))).toContain("FORBIDDEN");
  expect(
    await failure(
      asCaller(
        U.platform_admin,
        { role: "authenticated", aal: "aal1" },
        "select public.catera_v1_reconcile('refund',gen_random_uuid(),'{}',gen_random_uuid()) value",
      ),
    ),
  ).toContain("FORBIDDEN");
});

it("allows them once the session passed TOTP", async () => {
  const admin = await adminRead("aal2");
  expect(admin).toHaveProperty("caterers");
});

it("keeps role-only answers about other people and in the demo", async () => {
  // A service-role job asking about an admin (auth.uid() is not that admin).
  expect(
    await asCaller("", { role: "service_role" }, "select v1.is_admin($1) value", [U.platform_admin]),
  ).toBe(true);
  // A customer is never an admin, whatever the session level.
  expect(
    await asCaller(U.customer, { role: "authenticated", aal: "aal2" }, "select v1.is_admin($1) value", [U.customer]),
  ).toBe(false);
  // The demo backend's own connection marks catera.demo.
  expect(
    await db.transaction(async (tx) => {
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims','{\"role\":\"authenticated\"}',true),set_config('catera.demo','true',true)",
        [U.platform_admin],
      );
      return (await tx.query<{ value: boolean }>("select v1.is_admin($1) value", [U.platform_admin])).rows[0].value;
    }),
  ).toBe(true);
});
