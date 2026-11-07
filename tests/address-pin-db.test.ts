import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const q = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const cmd = (action: string, payload: object, requestId: string = crypto.randomUUID(), user: string = U.customer) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, requestId]);
const address = { label: "Kantor", line: "Jl. Wijaya I No. 12", area: "Jakarta Selatan", city: "Jakarta", instructions: "" };
const pinOf = async (id: string) => (await q<{ lat: string; lng: string; version: number }>("select lat::float8 lat,lng::float8 lng,version from v1.addresses where id=$1", [id]))[0];

beforeAll(async () => {
  db = await createDemoDatabase(true);
}, 120000);
afterAll(async () => db?.close());

describe("address.save and the pin", () => {
  it("stores a pin, and a later save without one leaves it, so older app builds can't wipe it", async () => {
    const { id } = await cmd("address.save", { ...address, lat: -6.2441, lng: 106.7992 });
    expect(await pinOf(id)).toMatchObject({ lat: -6.2441, lng: 106.7992 });
    await cmd("address.save", { ...address, id, version: 1, line: "Jl. Wijaya I No. 14" });
    expect(await pinOf(id)).toMatchObject({ lat: -6.2441, lng: 106.7992, version: 2 });
  });

  it("still saves with no pin at all", async () => {
    const { id } = await cmd("address.save", address);
    expect((await pinOf(id)).lat).toBeNull();
  });

  it("refuses half a pin, a text pin and a pin outside Indonesia", async () => {
    await expect(cmd("address.save", { ...address, lat: -6.2 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(cmd("address.save", { ...address, lat: "-6.2", lng: 106.8 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(cmd("address.save", { ...address, lat: 51.5, lng: -0.1 })).rejects.toThrow(/INVALID_INPUT/);
  });

  it("a retried request doesn't put an older pin back over a newer save", async () => {
    const retry = crypto.randomUUID();
    const payload = { ...address, lat: -6.2441, lng: 106.7992 };
    const { id } = await cmd("address.save", payload, retry);
    await cmd("address.save", { ...address, id, version: 1, lat: -6.25, lng: 106.8 });
    await cmd("address.save", payload, retry);
    expect(await pinOf(id)).toMatchObject({ lat: -6.25, lng: 106.8 });
  });

  it("one customer can't move another's pin", async () => {
    const { id } = await cmd("address.save", { ...address, lat: -6.2441, lng: 106.7992 });
    await expect(cmd("address.save", { ...address, id, version: 1, lat: -6.25, lng: 106.8 }, crypto.randomUUID(), U.owner)).rejects.toThrow();
    expect(await pinOf(id)).toMatchObject({ lat: -6.2441, lng: 106.7992, version: 1 });
  });

  it("comes back to its owner in the address book as plain numbers", async () => {
    const { id } = await cmd("address.save", { ...address, lat: -6.2441, lng: 106.7992 });
    const customer = await localRpc<any>(db, U.customer, "catera_v1_read", ["customer", {}]);
    expect(customer.addresses.find((a: { id: string }) => a.id === id)).toMatchObject({ lat: -6.2441, lng: 106.7992 });
  });

  it("the importer's list of a kitchen's customers answers without their pins", async () => {
    await q("update v1.addresses set lat=-6.2441,lng=106.7992 where user_id=$1", [U.customer]);
    const options = await localRpc<any>(db, U.owner, "catera_v1_read", ["seller-import-options", { id: K[0] }]);
    const addresses = options.customers.flatMap((c: { addresses: object[] }) => c.addresses);
    expect(addresses.length).toBeGreaterThan(0);
    for (const a of addresses) {
      expect(a).not.toHaveProperty("lat");
      expect(a).not.toHaveProperty("lng");
    }
  });
});
