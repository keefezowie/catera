import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K } from "../packages/backend/src/seed";

let db: PGlite;
beforeAll(async () => {
  db = await createDemoDatabase(true);
}, 120000);
afterAll(async () => db?.close());

const consume = (catererId: string, day: string) =>
  localRpc<number>(db, null, "catera_v1_system", ["importAssistant.consume", { catererId, day }], true);

it("allows 20 assistant reads per kitchen per day, then refuses", async () => {
  for (let i = 1; i <= 20; i++) expect(await consume(K[0], "2026-10-08")).toBe(i);
  await expect(consume(K[0], "2026-10-08")).rejects.toThrow("QUOTA");
  expect(await consume(K[1], "2026-10-08")).toBe(1);
  expect(await consume(K[0], "2026-10-09")).toBe(1);
});

it("is only for the system", async () => {
  await expect(
    localRpc(db, null, "catera_v1_system", ["importAssistant.consume", { catererId: K[0], day: "2026-10-10" }], false),
  ).rejects.toThrow();
});
