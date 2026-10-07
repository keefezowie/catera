import { afterAll, beforeAll, expect, it } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";

let db: Awaited<ReturnType<typeof createDemoDatabase>>;
let ownPackage: string;
let otherPackage: string;
let n = 0;
const cmd = (action: string, payload: object) =>
  localRpc<any>(db, U.owner, "catera_v1_command", [action, payload, crypto.randomUUID()]);

function row(packageId: string, area = "Jakarta Selatan", reference?: string) {
  n += 1;
  return {
    packageId,
    portions: 1,
    remainingDays: 2,
    startDate: addDays(localDay(), 14 + n * 3),
    externalReference: reference ?? `impor-test-${n}`,
    customer: {
      name: `Pelanggan Sintetis ${n}`,
      phone: `+62812000${String(1000 + n)}`,
      address: { label: "Rumah", line: `Jalan Sintetis ${n}`, area, city: "Kota Sintetis", instructions: "" },
    },
  };
}
const preview = (rows: object[]) => cmd("import.preview", { catererId: K[0], rows });

beforeAll(async () => {
  db = await createDemoDatabase(true);
  await db.query("update v1.caterers set status='submitted' where id=$1", [K[0]]);
  ownPackage = (
    await db.query<{ id: string }>(
      "select id from v1.packages where caterer_id=$1 and status='published' order by id limit 1",
      [K[0]],
    )
  ).rows[0].id;
  otherPackage = (
    await db.query<{ id: string }>(
      "select id from v1.packages where caterer_id=$1 and status='published' order by id limit 1",
      [K[1]],
    )
  ).rows[0].id;
});
afterAll(async () => db?.close());

it("lets a caterer awaiting approval import onto its own published package", async () => {
  const result = await preview([row(ownPackage)]);
  expect(result.rows).toHaveLength(1);
});

it("imports customers outside the caterer's listed delivery areas", async () => {
  const result = await preview([row(ownPackage, "Bogor")]);
  expect(result.rows[0].preview.address.area).toBe("Bogor");
});

it("commits imports with no money attached", async () => {
  const previewed = await preview([row(ownPackage)]);
  const committed = await cmd("import.commit", { catererId: K[0], id: previewed.id });
  const quote = (
    await db.query<{ quote: { total: number } }>(
      "select c.quote from v1.subscriptions s join v1.checkouts c on c.id=s.checkout_id where s.id=$1",
      [committed.subscriptions[0].id],
    )
  ).rows[0].quote;
  expect(quote.total).toBe(0);
});

it("still rejects another caterer's package", async () => {
  await expect(preview([row(otherPackage)])).rejects.toThrow("FORBIDDEN");
});

it("still rejects an unpublished package", async () => {
  await db.query("update v1.packages set status='draft' where id=$1", [ownPackage]);
  await expect(preview([row(ownPackage)])).rejects.toThrow("NOT_AVAILABLE");
  await db.query("update v1.packages set status='published' where id=$1", [ownPackage]);
});

it("still rejects a suspended caterer", async () => {
  await db.query("update v1.caterers set status='suspended' where id=$1", [K[0]]);
  await expect(preview([row(ownPackage)])).rejects.toThrow("NOT_AVAILABLE");
  await db.query("update v1.caterers set status='submitted' where id=$1", [K[0]]);
});
