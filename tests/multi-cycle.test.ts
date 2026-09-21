import { beforeAll, afterAll, it, expect } from "vitest";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
  ADDRESS_ID as A,
  CATERER_IDS as K,
} from "../packages/backend/src/seed";
import {
  addDays,
  localDay,
  purchasePricing,
  dailySellerAmounts,
  type Checkout,
  type Quote,
} from "@catera/domain";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const cmd = <T = any>(
  action: string,
  payload: unknown,
  user: string = U.customer,
  key = crypto.randomUUID(),
) => localRpc<T>(db, user, "catera_v1_command", [action, payload, key]);
const read = <T = any>(resource: string, params: unknown) =>
  localRpc<T>(db, U.customer, "catera_v1_read", [resource, params]);
const input = (extra = {}) => ({
  packageId: P[0],
  addressId: A,
  portions: 2,
  cycles: 3,
  startDate: addDays(localDay(), 40),
  trial: false,
  ...extra,
});
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await cmd(
    "package.durationPricing.save",
    {
      packageId: P[0],
      catererId: K[0],
      revision: 0,
      options: [
        { cycles: 1, discountPercent: 0 },
        { cycles: 3, discountPercent: 5 },
        { cycles: 6, discountPercent: 10 },
      ],
    },
    U.owner,
  );
});
afterAll(async () => db?.close());
it("prices and reserves every cycle as one immutable purchase", async () => {
  const q = await read<Quote>("quote", input());
  const preview = purchasePricing(q.offer, q.portions, 3);
  expect(q.dates).toHaveLength(q.offer.days * 3);
  expect(q.durationDiscount).toBe(preview.durationDiscount);
  expect(q.total).toBe(preview.packageNet + q.serviceFee);
  const c = await cmd<Checkout>("checkout.create", { acceptedTerms: true, ...(input({ expectedQuote: q })) });
  expect(
    (
      await db.query<any>(
        "select count(*)::int n from v1.reservations where checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(q.dates.length);
  await cmd("checkout.demo_pay", { id: c.id });
  const s = (await read<Checkout>("checkout", { id: c.id })).subscription_id!;
  expect(
    (
      await db.query<any>(
        "select sum(amount)::int n from v1.settlement_day_allocations where allocation_id=(select id from v1.allocations where checkout_id=$1)",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(q.sellerNet);
  await expect(
    db.query(
      "update v1.subscriptions set snapshot=snapshot||'{\"cycles\":1}' where id=$1",
      [s],
    ),
  ).rejects.toThrow("IMMUTABLE_TERMS");
  await expect(
    db.query(
      "update v1.checkouts set quote=quote||'{\"cycles\":1}' where id=$1",
      [c.id],
    ),
  ).rejects.toThrow("IMMUTABLE_TERMS");
  await expect(cmd("checkout.create", { acceptedTerms: true, ...(input()) })).rejects.toThrow("OVERLAP");
});
it("rejects unsupported durations, trial multiplication, promotions and distant schedules", async () => {
  await expect(read("quote", input({ cycles: 2 }))).rejects.toThrow(
    "DURATION_UNAVAILABLE",
  );
  await expect(read("quote", input({ trial: true }))).rejects.toThrow(
    "INVALID_INPUT",
  );
  await expect(read("quote", input({ promo: "TEST" }))).rejects.toThrow(
    "PROMOTIONS_DISABLED",
  );
  await expect(
    read("quote", input({ startDate: addDays(localDay(), 365) })),
  ).rejects.toThrow("BOOKING_HORIZON");
});
it("a failure on the final date creates no partial holds", async () => {
  const a = input({ startDate: addDays(localDay(), 100) });
  const q = await read<Quote>("quote", a);
  await db.query("insert into v1.capacity values($1,$2,0,false)", [
    P[0],
    q.dates.at(-1),
  ]);
  const before = (
    await db.query<any>("select count(*)::int n from v1.checkouts")
  ).rows[0].n;
  await expect(cmd("checkout.create", { acceptedTerms: true, ...(a) })).rejects.toThrow("CAPACITY");
  expect(
    (await db.query<any>("select count(*)::int n from v1.checkouts")).rows[0].n,
  ).toBe(before);
});
it("revisions change future quotes without changing held prices", async () => {
  const a = input({ startDate: addDays(localDay(), 180) });
  const q = await read<Quote>("quote", a);
  await cmd(
    "package.durationPricing.save",
    {
      packageId: P[0],
      catererId: K[0],
      revision: 1,
      options: [
        { cycles: 1, discountPercent: 0 },
        { cycles: 3, discountPercent: 15 },
      ],
    },
    U.owner,
  );
  await expect(
    cmd("checkout.create", { acceptedTerms: true, ...({ ...a, expectedQuote: q }) }),
  ).rejects.toThrow("PRICE_CHANGED");
  await expect(
    cmd(
      "package.durationPricing.save",
      { packageId: P[0], catererId: K[0], revision: 1, options: [] },
      U.owner,
    ),
  ).rejects.toThrow("CONFLICT");
});
it("uses sequential discounts and deterministic integer allocations", () => {
  const p = purchasePricing(
    {
      price: 30000,
      days: 20,
      tiers: [{ min: 2, percent: 10 }],
      trialPrice: null,
      durationPricing: {
        revision: 1,
        options: [{ cycles: 3, discountPercent: 5 }],
      },
    },
    2,
    3,
  );
  expect(p.packageNet).toBe(3078000);
  expect(dailySellerAmounts(10, 3)).toEqual([4, 3, 3]);
  expect(() =>
    purchasePricing(
      {
        price: 10000000,
        days: 60,
        tiers: [],
        trialPrice: null,
        durationPricing: {
          revision: 1,
          options: [{ cycles: 6, discountPercent: 0 }],
        },
      },
      100,
      6,
    ),
  ).toThrow("AMOUNT_TOO_LARGE");
});

it("historical pending promotion quotes activate unchanged without new earned allocations", async () => {
  // Build an old-format synthetic pending record using the preserved pre-extension quote function.
  const a = {
    packageId: P[3],
    addressId: A,
    portions: 1,
    startDate: addDays(localDay(), 230),
    trial: false,
    promo: "MAKANBAIK",
  };
  const old = (
    await db.query<any>("select v1.quote_pilot_base($1,$2) q", [U.customer, a])
  ).rows[0].q;
  expect(old.promotion).toBeGreaterThan(0);
  expect(old.cycles).toBeUndefined();
  const c = (
    await db.query<any>(
      "insert into v1.checkouts(user_id,package_id,address_id,quote,expires_at) values($1,$2,$3,$4,now()+interval '15 minutes') returning id",
      [U.customer, a.packageId, A, old],
    )
  ).rows[0];
  for (const d of old.dates)
    await db.query("insert into v1.reservations values($1,$2,$3,1,'held')", [
      c.id,
      a.packageId,
      d,
    ]);
  await cmd("checkout.demo_pay", { id: c.id });
  const paid = await read<Checkout>("checkout", { id: c.id });
  expect(paid.quote).toEqual(old);
  expect(
    (
      await db.query<any>(
        "select count(*)::int n from v1.settlement_day_allocations d join v1.allocations a on a.id=d.allocation_id where a.checkout_id=$1",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(0);
});
