import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import {
  localDay,
  addDays,
  type CustomerState,
  type Quote,
  type Checkout,
} from "@catera/domain";
let db: PGlite;
const command = <T = Record<string, unknown>>(
  action: string,
  a: unknown,
  user: string = U.customer,
) =>
  localRpc<T>(db, user, "catera_v1_command", [action, a, crypto.randomUUID()]);
const read = <T>(r: string, a: unknown = {}) =>
  localRpc<T>(db, U.customer, "catera_v1_read", [r, a]);
const sys = (action: string, a: unknown = {}) =>
  localRpc(db, null, "catera_v1_system", [action, a], true);
beforeAll(async () => (db = await createDemoDatabase(true)));
afterAll(async () => db?.close());
it("previewing a legacy import reserves nothing and confirmation imports only remaining days", async () => {
  const payload = {
    catererId: K[0],
    rows: [
      {
        customerId: U.customer,
        addressId: A,
        packageId: P[2],
        portions: 2,
        startDate: addDays(localDay(), 60),
        remainingDays: 3,
        externalReference: "synthetic-paid-receipt-1",
      },
    ],
  };
  const preview = await command<{ id: string; rows: { preview: Quote }[] }>(
    "import.preview",
    payload,
    U.owner,
  );
  expect(preview.rows[0].preview.dates).toHaveLength(3);
  expect((await read<CustomerState>("customer")).subscriptions).toHaveLength(2);
  await command("import.commit", { catererId: K[0], id: preview.id }, U.owner);
  const state = await read<CustomerState>("customer");
  const imported = state.subscriptions.find((s) => s.legacy)!;
  expect(imported.snapshot.dates).toHaveLength(3);
  expect(imported.snapshot.serviceFee).toBe(0);
  expect(
    (
      await db.query("select * from v1.allocations where checkout_id=$1", [
        (imported as unknown as { checkout_id: string }).checkout_id,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    command("import.commit", { catererId: K[0], id: preview.id }, U.owner),
  ).rejects.toThrow("CONFLICT");
});
it("reviewed quotes cannot silently change before a purchase", async () => {
  const payload = {
    packageId: P[3],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), 90),
    trial: false,
    promo: "",
  };
  const quote = await read<Quote>("quote", payload);
  await db.query(
    "update v1.packages set offer=jsonb_set(offer,'{price}','43000') where id=$1",
    [P[3]],
  );
  await expect(
    command("checkout.create", { ...payload, expectedQuote: quote }),
  ).rejects.toThrow("PRICE_CHANGED");
});
it("support authorization keeps cancellation, refunds and reconciliation separate", async () => {
  const sub = (await read<CustomerState>("customer")).subscriptions[0];
  const request = await command<{ id: string }>("support.create", {
    subscriptionId: sub.id,
    subject: "Ajukan pembatalan",
    description: "Permintaan sintetis untuk pengujian.",
  });
  await expect(
    command(
      "support.resolve",
      { id: request.id, amount: 10000, reason: "Test valid reason" },
      U.owner,
    ),
  ).rejects.toThrow("FORBIDDEN");
  await command(
    "support.respond",
    { id: request.id, response: "Kami meminta Catera meninjau refund." },
    U.owner,
  );
  await command("support.escalate", { id: request.id });
  await command(
    "support.resolve",
    {
      id: request.id,
      amount: 10000,
      reason: "Admin menyetujui refund sebagian.",
      cancelRemaining: true,
    },
    U.platform_admin,
  );
  const r = (
    await db.query<{ id: string }>(
      "select id from v1.refunds where case_id=$1",
      [request.id],
    )
  ).rows[0];
  expect(
    (await read<CustomerState>("customer")).subscriptions.find(
      (s) => s.id === sub.id,
    )?.status,
  ).toBe("cancelled");
  await sys("refund.update", {
    id: r.id,
    state: "succeeded",
    providerId: "demo-refund",
  });
  const held = await db.query<{ held: number }>(
    "select held from v1.allocations where checkout_id=$1",
    [(sub as unknown as { checkout_id: string }).checkout_id],
  );
  expect(held.rows[0].held).toBeGreaterThan(0);
  await localRpc(db, U.platform_admin, "catera_v1_reconcile", [
    "refund",
    r.id,
    {
      sellerDeduction: 8000,
      reference: "provider-reversal-1",
      reason: "Biaya split telah direkonsiliasi.",
    },
    crypto.randomUUID(),
  ]);
  expect(
    (
      await db.query<{ held: number }>(
        "select held from v1.allocations where checkout_id=$1",
        [(sub as unknown as { checkout_id: string }).checkout_id],
      )
    ).rows[0].held,
  ).toBe(0);
});
it("records immutable production snapshots including meal and trial totals", async () => {
  const d = (await read<CustomerState>("customer")).deliveries.find(
    (x) => x.status === "scheduled" && x.offer.catererId === K[0],
  );
  const day = d?.service_date || addDays(localDay(), 63);
  const a = await command<{ id: string }>(
    "production.freeze",
    { catererId: K[0], date: day },
    U.staff,
  );
  await expect(
    db.query("update v1.production set entries='[]' where id=$1", [a.id]),
  ).rejects.toThrow("IMMUTABLE_HISTORY");
  const r = await localRpc<{ revision: number }>(
    db,
    U.staff,
    "catera_v1_manifest",
    [a.id],
  );
  expect(r.revision).toBe(1);
});
it("combined meals fulfill independently while sharing one daily reservation", async () => {
  const c = await command<Checkout>("checkout.create", {
    packageId: P[2],
    addressId: A,
    portions: 2,
    startDate: addDays(localDay(), 180),
    trial: false,
    promo: "",
  });
  await command("checkout.demo_pay", { id: c.id });
  const paid = await read<Checkout>("checkout", { id: c.id });
  let day = (
    await db.query<{ id: string; version: number }>(
      "select id,version from v1.delivery_days where subscription_id=$1 order by service_date",
      [paid.subscription_id],
    )
  ).rows[0];
  await db.query(
    "update v1.delivery_days set service_date=current_date where id=$1",
    [day.id],
  );
  await expect(
    command(
      "delivery.status",
      { id: day.id, version: day.version, status: "preparing" },
      U.customer,
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    command(
      "delivery.status",
      { id: day.id, version: day.version, status: "preparing" },
      U.staff,
    ),
  ).rejects.toThrow("INVALID_INPUT");
  for (const status of ["preparing", "out_for_delivery", "delivered"]) {
    await command(
      "delivery.status",
      { id: day.id, version: day.version++, meal: "lunch", status },
      U.staff,
    );
  }
  const fresh = (await read<CustomerState>("customer", { deliveryId: day.id }))
    .deliveries[0];
  expect(fresh.meals.find((m) => m.meal === "lunch")?.status).toBe("delivered");
  expect(fresh.meals.find((m) => m.meal === "dinner")?.status).toBe(
    "scheduled",
  );
  expect(fresh.status).not.toBe("delivered");
  expect(fresh.canChange).toBe(false);
  expect(
    (
      await db.query<{ n: number }>(
        "select sum(portions)::int n from v1.reservations where checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(20);
});
it("admin queue reads do not confuse record aliases with seller IDs", async () => {
  const admin = await localRpc<{
    caterers: { offers: unknown[] }[];
    audit: unknown[];
  }>(db, U.platform_admin, "catera_v1_read", ["admin", {}]);
  expect(admin.caterers).toHaveLength(3);
  expect(admin.caterers.reduce((n, c) => n + c.offers.length, 0)).toBe(6);
  expect(admin.audit.length).toBeGreaterThan(0);
});
it("rescheduling cannot extend an active subscription across a pending renewal", async () => {
  const active = (await read<CustomerState>("customer")).subscriptions.find(
    (s) => s.package_id === P[1],
  )!;
  const c = await command<Checkout>("checkout.create", {
    packageId: P[1],
    addressId: A,
    portions: 1,
    startDate: addDays(active.ends_on, 7),
    trial: false,
    promo: "",
  });
  const d = (await read<CustomerState>("customer")).deliveries.find(
    (d) => d.subscription_id === active.id,
  )!;
  await expect(
    command("delivery.reschedule", {
      id: d.id,
      version: d.version,
      date: c.quote.dates[0],
    }),
  ).rejects.toThrow("OVERLAP");
  expect(
    (await read<CustomerState>("customer")).deliveries.find(
      (x) => x.id === d.id,
    )?.service_date,
  ).toBe(d.service_date);
});
