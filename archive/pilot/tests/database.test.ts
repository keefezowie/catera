import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { localBootstrap, demoSeed, DEMO_USERS } from "../src/lib/demo-seed";
import type { Snapshot } from "../src/lib/types";
let db: PGlite;
async function rpc<T>(
  name: string,
  args: unknown[] = [],
  user = DEMO_USERS.owner,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user,
    ]);
    const { rows } = await tx.query<{ value: T }>(
      "select public." +
        name +
        "(" +
        args.map((_, i) => "$" + (i + 1)).join(",") +
        ") value",
      args,
    );
    return rows[0].value;
  });
}
const snapshot = (slug = "dapur-hijau", user = DEMO_USERS.owner) =>
  rpc<Snapshot>("workspace_snapshot", [slug], user);
const command = (
  action: string,
  payload: unknown,
  key = crypto.randomUUID(),
  user = DEMO_USERS.owner,
  slug = "dapur-hijau",
) =>
  rpc<{ id: string; applied: number }>(
    "execute_command",
    [slug, action, JSON.stringify(payload), key],
    user,
  );
beforeAll(async () => {
  db = new PGlite();
  await db.exec(localBootstrap);
  await db.exec(
    await readFile("supabase/migrations/202609080001_core.sql", "utf8"),
  );
  await db.exec(demoSeed);
});
afterAll(async () => {
  await db?.close();
});
describe("tenant isolation and atomic catering workflow", () => {
  it("loads both synthetic tenants with independent records", async () => {
    const a = await snapshot(),
      b = await snapshot("rasa-rumah");
    expect(a.customers).toHaveLength(8);
    expect(b.customers).toHaveLength(8);
    expect(
      a.customers.some((c) => b.customers.some((d) => c.id === d.id)),
    ).toBe(false);
  });
  it("filters subscriber data and denies an unrelated tenant to staff", async () => {
    const s = await snapshot("dapur-hijau", DEMO_USERS.subscriber);
    expect(s.customers).toHaveLength(1);
    expect(s.production).toHaveLength(0);
    expect(s.deliveries.every((d) => d.customer_id === s.customer_id)).toBe(
      true,
    );
    await expect(snapshot("rasa-rumah", DEMO_USERS.admin)).rejects.toThrow(
      "UNAUTHORIZED",
    );
  });
  it("grants quota once per purchase request and rejects reused keys", async () => {
    const s = await snapshot(),
      key = crypto.randomUUID();
    const payload = {
      customer_id: s.customers[0].id,
      package_id: s.packages[0].id,
      starts_on: s.deliveries[0].service_date,
    };
    const a = await command("purchase", payload, key),
      b = await command("purchase", payload, key);
    expect(a.id).toBe(b.id);
    await expect(
      command("purchase", { ...payload, external_reference: "different" }, key),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("prevents foreign tenant package references", async () => {
    const a = await snapshot(),
      b = await snapshot("rasa-rumah");
    await expect(
      command("purchase", {
        customer_id: a.customers[0].id,
        package_id: b.packages[0].id,
        starts_on: a.deliveries[0].service_date,
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
  it("automatically freezes defaults and preserves repeated freezes", async () => {
    const s = await snapshot();
    expect(s.production.length).toBeGreaterThan(0);
    expect(s.production[0].incomplete).toBe(0);
    await command("freeze", {
      service_date: s.production[0].service_date,
      slot_id: s.production[0].slot_id,
    });
    expect((await snapshot()).production.length).toBe(s.production.length);
  });
  it("rejects cutoff edits from subscribers", async () => {
    const s = await snapshot("dapur-hijau", DEMO_USERS.subscriber);
    const d = s.deliveries.find((d) => new Date(d.cutoff_at) < new Date())!;
    await expect(
      command(
        "change_delivery",
        { id: d.id, version: d.version, change: "skip" },
        undefined,
        DEMO_USERS.subscriber,
      ),
    ).rejects.toThrow("CUTOFF_REACHED");
  });
  it("fulfills once and reverses with an auditable compensating entry", async () => {
    let s = await snapshot();
    const id = s.deliveries.find(
      (d) => d.status === "scheduled" && new Date(d.cutoff_at) < new Date(),
    )!.id;
    const get = async () =>
      (await snapshot()).deliveries.find((d) => d.id === id)!;
    const before = s.grants.find(
      (g) => g.id === s.deliveries.find((d) => d.id === id)!.grant_id,
    )!;
    for (const status of ["ready", "out_for_delivery", "delivered"]) {
      const d = await get();
      await command("transition", { id, version: d.version, status });
    }
    const delivered = await get();
    await command("transition", { id, version: 1, status: "delivered" });
    s = await snapshot();
    let g = s.grants.find((g) => g.id === before.id)!;
    expect(g.remaining).toBe(before.remaining - 1);
    expect(g.reserved).toBe(before.reserved - 1);
    await expect(
      command(
        "reverse_delivery",
        { id, version: delivered.version, reason: "Correction" },
        undefined,
        DEMO_USERS.admin,
      ),
    ).rejects.toThrow("FORBIDDEN");
    await command("reverse_delivery", {
      id,
      version: delivered.version,
      reason: "Mistaken confirmation",
    });
    s = await snapshot();
    g = s.grants.find((g) => g.id === before.id)!;
    expect(g.remaining).toBe(before.remaining);
    expect(g.reserved).toBe(before.reserved);
    expect(
      s.ledger.filter((l) => l.delivery_id === id).map((l) => l.kind),
    ).toContain("reversal");
  });
  it("rejects stale edits and keeps profile addresses separate", async () => {
    const s = await snapshot("dapur-hijau", DEMO_USERS.subscriber),
      c = s.customers[0],
      d = s.deliveries[0];
    const a = {
      line: "Jl. Alamat Baru No. 20",
      city: "Jakarta",
      instructions: "New default",
    };
    await command(
      "profile",
      { version: c.version, phone: c.phone, address: a },
      undefined,
      DEMO_USERS.subscriber,
    );
    expect(
      (await snapshot("dapur-hijau", DEMO_USERS.subscriber)).deliveries.find(
        (x) => x.id === d.id,
      )!.address,
    ).toEqual(d.address);
    await expect(
      command(
        "profile",
        { version: c.version, phone: c.phone, address: a },
        undefined,
        DEMO_USERS.subscriber,
      ),
    ).rejects.toThrow("CONFLICT");
  });
  it("denies direct writes even when the subscriber knows table names", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role authenticated");
        await tx.exec(
          "insert into public.quota_ledger(business_id,grant_id,amount,kind) values(gen_random_uuid(),gen_random_uuid(),10,'grant')",
        );
      }),
    ).rejects.toThrow("permission denied");
  });
  it("reconciles ledger and reservation invariants", async () => {
    const { rows } = await db.query<{ value: unknown }>(
      "select public.check_integrity() value",
    );
    expect(rows[0].value).toEqual([]);
  });
});
