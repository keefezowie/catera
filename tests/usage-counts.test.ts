import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";
import { localDay, usageNames, usageSchema } from "@catera/domain";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const q = async <T = any>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const usage = (name: string, app: string, user: string | null = U.customer) =>
  localRpc<Record<string, never>>(db, user, "catera_v1_usage", [name, app]);
const count = async (name: string, app: string) =>
  (
    await q<{ n: number }>(
      "select n from v1.usage_daily where day=$1::date and app=$2 and name=$3",
      [localDay(), app, name],
    )
  )[0]?.n;

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("names the eight counts and nothing else", () => {
  expect(usageNames).toEqual([
    "app_open",
    "tomorrow_story_viewed",
    "journey_viewed",
    "plan_sheet_opened",
    "renew_started",
    "purchase_confirmed_viewed",
    "cook_started",
    "depart_tapped",
  ]);
  expect(usageSchema.parse({ name: "journey_viewed", app: "customer" })).toEqual({
    name: "journey_viewed",
    app: "customer",
  });
  expect(() => usageSchema.parse({ name: "journey_viewed", app: "web" })).toThrow();
  expect(() => usageSchema.parse({ name: "login", app: "customer" })).toThrow();
  // Strict: a caller cannot attach a user, a caterer or a device.
  expect(() => usageSchema.parse({ name: "app_open", app: "customer", userId: U.customer })).toThrow();
});

it("two app_open calls from the customer make n = 2 for today in Jakarta", async () => {
  expect(await usage("app_open", "customer")).toEqual({});
  expect(await usage("app_open", "customer")).toEqual({});
  expect(await count("app_open", "customer")).toBe(2);
});

it("counts the same name for the other app in its own row", async () => {
  await usage("cook_started", "dapur", U.owner);
  expect(await count("cook_started", "dapur")).toBe(1);
  expect(await count("cook_started", "customer")).toBeUndefined();
  expect(await count("app_open", "dapur")).toBeUndefined();
});

it("rejects a name outside the eight and a bad app", async () => {
  await expect(usage("login", "customer")).rejects.toThrow("INVALID_INPUT");
  await expect(usage("app_open", "web")).rejects.toThrow("INVALID_INPUT");
  await expect(usage("", "customer")).rejects.toThrow("INVALID_INPUT");
});

it("needs a signed-in caller", async () => {
  await expect(usage("app_open", "customer", null)).rejects.toThrow("UNAUTHORIZED");
  expect(await count("app_open", "customer")).toBe(2);
});

it("keeps the counts anonymous: day, app, name and n only", async () => {
  const columns = await q<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema='v1' and table_name='usage_daily' order by column_name",
  );
  expect(columns.map((c) => c.column_name)).toEqual(["app", "day", "n", "name"]);
});

it("is closed to direct table access", async () => {
  expect(
    (await q<{ rls: boolean }>("select relrowsecurity rls from pg_class where oid='v1.usage_daily'::regclass"))[0].rls,
  ).toBe(true);
  expect(
    (await q("select 1 from pg_policies where schemaname='v1' and tablename='usage_daily'")).length,
  ).toBe(0);
});
