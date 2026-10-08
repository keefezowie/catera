import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";

// K-04: Catera Dapur shows who reported a delivery problem and lets owner and staff answer it.
let db: PGlite, day: string, record: string;
const cmd = (action: string, payload: object, actor: string = U.customer) =>
  localRpc<any>(db, actor, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const read = (params: object, actor: string) => localRpc<any[]>(db, actor, "catera_v1_read", ["delivery-issues", params]);

beforeAll(async () => {
  db = await createDemoDatabase(true);
  ({ id: day, record } = (
    await db.query<any>(
      "select d.id,s.customer_record_id record from v1.delivery_days d join v1.subscriptions s on s.id=d.subscription_id join v1.packages p on p.id=s.package_id where p.caterer_id=$1 and s.user_id=$2 order by d.service_date limit 1",
      [K[0], U.customer],
    )
  ).rows[0]);
});
afterAll(async () => db?.close());

it("names the customer on the caterer's delivery reports, with their number when the caterer has one", async () => {
  const issue = await cmd("deliveryIssue.create", {
    deliveryId: day,
    meal: "lunch",
    subject: "Belum sampai",
    body: "Sudah jam satu, makanan belum datang.",
  });
  for (const actor of [U.owner, U.staff]) {
    const [row] = await read({ id: K[0], issue: issue.id }, actor);
    expect(row).toMatchObject({
      id: issue.id,
      subject: "Belum sampai",
      description: "Sudah jam satu, makanan belum datang.",
      customerName: "Nadia Putri",
      customerRecordId: record,
      customerPhone: null,
    });
  }
  await db.query("update v1.customer_records set phone='+6281234567001' where id=$1", [record]);
  expect((await read({ id: K[0], issue: issue.id }, U.staff))[0].customerPhone).toBe("+6281234567001");

  // The customer's own list is unchanged, and another kitchen still cannot read it.
  expect((await read({}, U.customer))[0]).not.toHaveProperty("customerPhone");
  await expect(read({ id: K[1] }, U.owner)).rejects.toThrow("FORBIDDEN");

  // Staff may reply and close the report, as the app offers them.
  await cmd("deliveryIssue.respond", { id: issue.id, version: 1, body: "Maaf, kurir terlambat. Kami antar sekarang." }, U.staff);
  await cmd("deliveryIssue.resolve", { id: issue.id, version: 2, body: "Masalah ini sudah kami tangani." }, U.staff);
  const [done] = await read({ id: K[0], issue: issue.id }, U.owner);
  expect(done.status).toBe("resolved");
  expect(done.customerName).toBe("Nadia Putri");
  expect(done.events.map((e: any) => e.action)).toEqual([
    "deliveryIssue.create",
    "deliveryIssue.respond",
    "deliveryIssue.resolve",
  ]);
});
