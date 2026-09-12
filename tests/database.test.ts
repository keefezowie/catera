import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS,
  PACKAGE_IDS,
  ADDRESS_ID,
  CATERER_IDS,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  type CustomerState,
  type Checkout,
  type Quote,
  type Offer,
} from "@catera/domain";
let db: PGlite;
const command = (
  action: string,
  payload: unknown,
  actor: string = DEMO_ACTORS.customer,
  key = crypto.randomUUID(),
) =>
  localRpc<Record<string, unknown>>(db, actor, "catera_v1_command", [
    action,
    payload,
    key,
  ]);
const read = <T>(
  resource: string,
  params: unknown = {},
  actor: string | null = DEMO_ACTORS.customer,
) => localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());
const purchase = (extra = {}) => ({
  packageId: PACKAGE_IDS[3],
  addressId: ADDRESS_ID,
  portions: 2,
  startDate: addDays(localDay(), 20),
  trial: false,
  promo: "",
  invite: "",
  ...extra,
});
it("returns public packages without disclosing customer data", async () => {
  const c = await read<{ items: unknown[] }>("catalog", {}, null);
  expect(c.items).toHaveLength(6);
  await expect(read("customer", {}, null)).rejects.toThrow("UNAUTHORIZED");
});
it("shows a customer one calendar across two caterers", async () => {
  const c = await read<CustomerState>("customer");
  expect(c.subscriptions).toHaveLength(2);
  expect(new Set(c.deliveries.map((d) => d.offer.catererId)).size).toBe(2);
});
it("staff cannot read platform administration or another caterer", async () => {
  await expect(read("admin", {}, DEMO_ACTORS.staff)).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(
    read("seller", { id: CATERER_IDS[1] }, DEMO_ACTORS.staff),
  ).rejects.toThrow("FORBIDDEN");
});
it("staff have no financial transactions in seller responses", async () => {
  const s = await read<{ transactions: unknown[] }>(
    "seller",
    { id: CATERER_IDS[0] },
    DEMO_ACTORS.staff,
  );
  expect(s.transactions).toEqual([]);
});
it("blocks checkout outside coverage even through direct RPC", async () =>
  await expect(
    command("checkout.create", purchase({ packageId: PACKAGE_IDS[5] })),
  ).rejects.toThrow("COVERAGE"));
it("snapshots pricing and reserves every date in a single transaction", async () => {
  const c = (await command(
    "checkout.create",
    purchase(),
  )) as unknown as Checkout;
  expect(c.quote.dates).toHaveLength(5);
  const reserved = await db.query<{ n: number }>(
    "select count(*)::int n from v1.reservations where checkout_id=$1 and state='held'",
    [c.id],
  );
  expect(reserved.rows[0].n).toBe(5);
  await expect(command("checkout.create", purchase())).rejects.toThrow(
    "OVERLAP",
  );
});
it("preserves purchased terms when the current offer changes", async () => {
  const before = await read<CustomerState>("customer");
  await db.query(
    "update v1.packages set offer=jsonb_set(offer,'{price}','999999') where id=$1",
    [PACKAGE_IDS[0]],
  );
  const after = await read<CustomerState>("customer");
  expect(after.subscriptions[0].snapshot).toEqual(
    before.subscriptions[0].snapshot,
  );
});
it("makes command retries idempotent and rejects changed payloads", async () => {
  const key = crypto.randomUUID();
  const a = {
    label: "Kantor",
    line: "Jl. Data Sintetis No. 8",
    area: "Jakarta Selatan",
    city: "Jakarta",
    instructions: "",
  };
  const x = await command("address.save", a, DEMO_ACTORS.customer, key);
  expect(await command("address.save", a, DEMO_ACTORS.customer, key)).toEqual(
    x,
  );
  await expect(
    command(
      "address.save",
      { ...a, label: "Different" },
      DEMO_ACTORS.customer,
      key,
    ),
  ).rejects.toThrow("CONFLICT");
});
it("keeps the old booking when replacement capacity is unavailable", async () => {
  const state = await read<CustomerState>("customer");
  const d = state.deliveries.find((d) => d.offer.id === PACKAGE_IDS[0])!;
  const target = addDays(d.service_date, 7);
  await db.query(
    "insert into v1.capacity values($1,$2,0,false) on conflict(package_id,service_date) do update set slots=0",
    [d.offer.id, target],
  );
  await expect(
    command("delivery.reschedule", {
      id: d.id,
      version: d.version,
      date: target,
    }),
  ).rejects.toThrow("CAPACITY");
  const fresh = (await read<CustomerState>("customer")).deliveries.find(
    (x) => x.id === d.id,
  )!;
  expect(fresh.service_date).toBe(d.service_date);
  expect(fresh.version).toBe(d.version);
});
it("does not release reservations merely because cancellation is requested", async () => {
  const state = await read<CustomerState>("customer");
  const s = state.subscriptions[0];
  await command("support.create", {
    subscriptionId: s.id,
    subject: "Pembatalan",
    description: "Mohon ditinjau.",
  });
  const after = await read<CustomerState>("customer");
  expect(after.subscriptions.find((x) => x.id === s.id)?.status).toBe("active");
  expect(after.cases).toHaveLength(1);
});
it("rejects unverified reviews", async () => {
  const c = await read<CustomerState>("customer");
  await expect(
    command("review.save", {
      subscriptionId: c.subscriptions[0].id,
      rating: 5,
      food: 5,
      delivery: 5,
      value: 5,
      body: "Bagus",
    }),
  ).rejects.toThrow("FORBIDDEN");
});
it("rejects changes to published capacity, preserving paid demand", async () => {
  const d = (await read<CustomerState>("customer")).deliveries.find(
    (x) => x.offer.catererId === CATERER_IDS[0],
  )!;
  const seller = await read<{ offers: Offer[] }>(
    "seller",
    { id: CATERER_IDS[0] },
    DEMO_ACTORS.owner,
  );
  const offer = seller.offers.find((x) => x.id === d.offer.id)!;
  const capacity = Object.fromEntries(
    Object.keys(offer.capacity).map((weekday) => [weekday, 0]),
  );
  await expect(
    command(
      "package.save",
      {
        catererId: CATERER_IDS[0],
        id: offer.id,
        version: offer.version,
        slug: offer.slug,
        offer: { ...offer, capacity },
      },
      DEMO_ACTORS.owner,
    ),
  ).rejects.toThrow("PACKAGE_IMMUTABLE");
});
it("rejects retired date-capacity commands without changing legacy rows", async () => {
  const packageId = PACKAGE_IDS[0];
  const date = addDays(localDay(), 180);
  const before = await db.query(
    "select * from v1.capacity where package_id=$1 and service_date=$2",
    [packageId, date],
  );
  await expect(
    command(
      "capacity.save",
      { catererId: CATERER_IDS[0], packageId, date, slots: 0, closed: true },
      DEMO_ACTORS.owner,
    ),
  ).rejects.toThrow("INVALID_ACTION");
  const after = await db.query(
    "select * from v1.capacity where package_id=$1 and service_date=$2",
    [packageId, date],
  );
  expect(after.rows).toEqual(before.rows);
});
it("requires the caller to own the delivery or work for its caterer", async () => {
  const d = (await read<CustomerState>("customer")).deliveries.find(
    (x) => x.offer.catererId === CATERER_IDS[1],
  )!;
  await expect(
    command(
      "delivery.address",
      { id: d.id, version: d.version, addressId: ADDRESS_ID },
      DEMO_ACTORS.owner,
    ),
  ).rejects.toThrow("FORBIDDEN");
});
it("system payment methods are inaccessible to authenticated clients", async () =>
  await expect(
    localRpc(db, DEMO_ACTORS.customer, "catera_v1_system", ["maintenance", {}]),
  ).rejects.toThrow("FORBIDDEN"));
it("checks database and shared pricing agreement", async () => {
  const quote = await read<Quote>(
    "quote",
    purchase({
      packageId: PACKAGE_IDS[2],
      portions: 4,
      startDate: addDays(localDay(), 40),
    }),
  );
  expect(quote.subtotal).toBe(2600000);
  expect(quote.discount).toBe(130000);
  expect(quote.total).toBe(2472500);
});
