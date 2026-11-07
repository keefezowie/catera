import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { DEMO_ACTORS as U } from "../packages/backend/src/seed";

// Dapur tells a customer "Langgananmu di Catera tetap jalan seperti biasa" before they open a kitchen on the same
// account, whose role then reads owner. This holds the customer side of that promise to the database.
let db: PGlite;
const read = (resource: string, params: Record<string, unknown> = {}) => localRpc<any>(db, U.customer, "catera_v1_read", [resource, params]);
const command = (action: string, payload: Record<string, unknown>) => localRpc<any>(db, U.customer, "catera_v1_command", [action, payload, crypto.randomUUID()]);

beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());

it("keeps the customer's subscriptions, deliveries and account reads after they open a kitchen", async () => {
  const before = await read("customer");
  expect(before.subscriptions.length).toBeGreaterThan(0);

  const made = await command("seller.create", { name: "Dapur Pelanggan", slug: "dapur-pelanggan-ab12", description: "", areas: ["Jakarta Selatan"], whatsapp: "+6281234567890" });
  expect(made.id).toBeTruthy();
  expect((await read("actor")).role).toBe("owner");

  const after = await read("customer");
  expect(after.subscriptions.map((s: any) => [s.id, s.status])).toEqual(before.subscriptions.map((s: any) => [s.id, s.status]));
  expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  await expect(read("customer-actions")).resolves.toBeTruthy();
});
