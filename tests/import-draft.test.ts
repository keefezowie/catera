import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U, CATERER_IDS as K } from "../packages/backend/src/seed";

// Impor pelanggan's draft: one list per kitchen, owners only, kept until it is emptied.
let db: PGlite;
const save = (rows: unknown, who: string = U.owner, catererId: unknown = K[0]) =>
  localRpc<any>(db, who, "catera_v1_command", ["import.draftSave", { catererId, rows }, crypto.randomUUID()]);
const read = (who: string = U.owner, id: string = K[0]) => localRpc<any>(db, who, "catera_v1_read", ["seller-import-options", { id }]);
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => "",
    (e: unknown) => (e instanceof Error ? e.message : String(e)),
  );

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("has no draft until one is saved, then keeps and replaces the whole list", async () => {
  expect((await read()).draft).toBeNull();
  await save([{ n: 1, name: "Bu Rina" }, { n: 2, name: "Ani" }]);
  const first = (await read()).draft;
  expect(first.rows.map((r: any) => r.name)).toEqual(["Bu Rina", "Ani"]);
  expect(first.updatedAt).toBeTruthy();
  await save([{ n: 2, name: "Ani" }]);
  expect((await read()).draft.rows.map((r: any) => r.name)).toEqual(["Ani"]);
});

it("an empty list removes the draft", async () => {
  await save([{ n: 1, name: "Ani" }]);
  await expect(save([])).resolves.toEqual({ saved: 0 });
  expect((await read()).draft).toBeNull();
});

it("leaves the other import options as they were", async () => {
  await save([{ n: 1, name: "Ani" }]);
  const options = await read();
  expect(Array.isArray(options.packages)).toBe(true);
  expect(Array.isArray(options.customers)).toBe(true);
});

it("belongs to the kitchen's owner: no helper, customer or other kitchen reads or writes it", async () => {
  await save([{ n: 1, name: "Rahasia" }]);
  const helper = "00000000-0000-4000-8000-00000000d001";
  await db.query("insert into v1.profiles(id,name,role) values($1,'Pembantu','staff')", [helper]);
  await db.query("insert into v1.staff values($1,$2,'staff')", [K[0], helper]);
  for (const who of [helper, U.customer]) {
    expect(await failure(save([], who))).toContain("FORBIDDEN");
    expect(await failure(read(who))).toContain("FORBIDDEN");
  }
  expect(await failure(save([], U.owner, K[1]))).toContain("FORBIDDEN");
  expect((await read()).draft.rows[0].name).toBe("Rahasia");
});

it("refuses a malformed or oversized list", async () => {
  expect(await failure(save("bukan daftar"))).toContain("INVALID_INPUT");
  expect(await failure(save([], U.owner, "bukan-id"))).toContain("INVALID_INPUT");
  expect(await failure(save(Array.from({ length: 501 }, (_, n) => ({ n }))))).toContain("INVALID_INPUT");
  expect(await failure(save([{ name: "x".repeat(520000) }]))).toContain("INVALID_INPUT");
});
