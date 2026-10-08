import { afterAll, beforeAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
import { addDays, localDay, type SellerOperationsState } from "@catera/domain";

// K-05: Catera Dapur offers "Pindah tanggal" when the seller read carries what customer.deliveryChange needs.
let db: PGlite, address: any;
const cmd = (action: string, payload: object, actor: string = U.owner) =>
  localRpc<any>(db, actor, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const seller = (date: string, actor: string) =>
  localRpc<SellerOperationsState>(db, actor, "catera_v1_read", ["seller", { id: K[0], date }]);

beforeAll(async () => {
  db = await createDemoDatabase(true);
  address = (await db.query<any>("select line,area,city,instructions from v1.addresses limit 1")).rows[0];
});
afterAll(async () => db?.close());

it("gives owner and staff the customer record id on each delivery, and the move the app sends goes through", async () => {
  const flexible = (
    await db.query<any>("select id from v1.packages where caterer_id=$1 and (offer->>'flexible')::boolean order by id limit 1", [K[0]])
  ).rows[0].id;
  expect(P).toContain(flexible);
  const preview = await cmd("import.preview", {
    catererId: K[0],
    rows: [
      {
        customer: { name: "Sari Contoh", phone: "+6281234598001", address },
        packageId: flexible,
        portions: 1,
        startDate: addDays(localDay(), 20),
        remainingDays: 3,
        externalReference: "k05-move-day",
      },
    ],
  });
  const { subscriptions } = await cmd("import.commit", { catererId: K[0], id: preview.id });
  const record = subscriptions[0].customerRecordId;
  const first = (
    await db.query<any>(
      "select id,service_date::text date from v1.delivery_days where subscription_id=$1 order by service_date limit 1",
      [subscriptions[0].id],
    )
  ).rows[0];

  for (const actor of [U.owner, U.staff]) {
    const day = (await seller(first.date, actor)).deliveries.find((d) => d.id === first.id)!;
    expect(day.customerRecordId).toBe(record);
    expect(day.customer.name).toBe("Sari Contoh");
    expect(day.offer.flexible).toBe(true);
    expect(new Date(day.cutoff_at).getTime()).toBeGreaterThan(Date.now());
  }

  // The exact payload ExceptionSheet sends; staff may move a day (the SQL is not owner-only).
  const day = (await seller(first.date, U.staff)).deliveries.find((d) => d.id === first.id)!;
  const weekdays: number[] = day.offer.weekdays;
  let to = addDays(first.date, 7);
  while (!weekdays.includes(new Date(`${to}T00:00:00Z`).getUTCDay())) to = addDays(to, 1);
  const moved = await cmd(
    "customer.deliveryChange",
    { catererId: K[0], id: day.id, version: day.version, date: to, reason: "Dapur tutup sehari" },
    U.staff,
  );
  expect(moved.delivery.service_date).toBe(to);
});
