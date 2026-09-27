import { afterAll, beforeAll, expect, expectTypeOf, it } from "vitest";
import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import {
  addDays,
  draftCapacityValue,
  localDay,
  offerEditorIssues,
  offerSchema,
  withDraftCapacity,
  type DraftOffer,
  type Offer,
  type Quote,
  type SellerState,
} from "@catera/domain";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
} from "../packages/backend/src/seed";

let db: PGlite, base: Offer;
const read = <T>(
  resource: string,
  params = {},
  actor: string | null = U.owner,
) => localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const cmd = <T = { id: string }>(
  action: string,
  payload: unknown,
  actor: string | null = U.owner,
  key = crypto.randomUUID(),
) => localRpc<T>(db, actor, "catera_v1_command", [action, payload, key]);
const draft = (): DraftOffer => ({
  ...base,
  name: "",
  description: "",
  image: "",
  packageType: null,
  menus: [],
  status: "draft",
  price: null,
  capacity: {},
  trialPrice: null,
  trialMax: null,
  tiers: [],
  durationPricing: {
    revision: 0,
    options: [{ cycles: 1, discountPercent: 0 }],
  },
});
const save = (offer: unknown) =>
  cmd("package.save", {
    catererId: K[0],
    slug: "partial-draft-" + crypto.randomUUID(),
    offer,
  });
const stored = async (id: string) =>
  (await read<SellerState>("seller", { id: K[0] })).offers.find(
    (o) => o.id === id,
  )!;
const validSQL = async (offer: unknown) =>
  (
    await db.query<{ valid: boolean }>(
      "select v1.valid_offer($1::jsonb) valid",
      [JSON.stringify(offer)],
    )
  ).rows[0].valid;
const effects = async () =>
  (
    await db.query(`select
  (select count(*) from v1.customer_records) customers,
  (select count(*) from v1.subscriptions) subscriptions,
  (select count(*) from v1.checkouts) checkouts,
  (select count(*) from v1.reservations) reservations,
  (select count(*) from v1.allocations) allocations,
  (select count(*) from v1.receipts) receipts,
  (select count(*) from v1.audit) audit,
  (select count(*) from v1.outbox) outbox`)
  ).rows[0];

beforeAll(async () => {
  db = await createDemoDatabase(true);
  base = (await read<{ items: Offer[] }>("catalog")).items.find(
    (o) => o.catererId === K[0],
  )!;
});
afterAll(async () => db?.close());

it("keeps public and purchased prices numeric while exposing nullable draft prices", () => {
  expectTypeOf<Offer["price"]>().toEqualTypeOf<number>();
  expectTypeOf<Quote["offer"]["price"]>().toEqualTypeOf<number>();
  expectTypeOf<DraftOffer["price"]>().toEqualTypeOf<number | null>();
  expect(draftCapacityValue({}, [1, 2])).toBeNull();
  expect(withDraftCapacity({}, [1, 2], null)).toEqual({});
  expect(withDraftCapacity({ "1": 10 }, [1, 2], null)).toEqual({});
  expect(withDraftCapacity({}, [1, 2], 0)).toEqual({ "1": 0, "2": 0 });
  expect(draftCapacityValue({ "1": 0, "2": 0 }, [1, 2])).toBe(0);
  expect(withDraftCapacity({ "1": 20 }, [1, 2], 20)).toEqual({
    "1": 20,
    "2": 20,
  });
});

it("validates honest partial drafts but requires price and capacity for publication", async () => {
  const value = draft();
  expect(offerSchema.parse(value)).toMatchObject({
    price: null,
    capacity: {},
    status: "draft",
  });
  expect(offerEditorIssues(value, true)).toEqual([]);
  expect(await validSQL(value)).toBe(true);
  for (const status of ["published", "suspended", "retired"]) {
    for (const missing of [{ price: null }, { capacity: {} }]) {
      const input = { ...base, ...missing, status };
      expect(offerSchema.safeParse(input).success).toBe(false);
      expect(await validSQL(input)).toBe(false);
    }
  }
  expect(offerEditorIssues({ ...base, price: null })[0]).toMatchObject({
    step: "pricing",
    path: "price",
  });
  expect(offerEditorIssues({ ...base, capacity: {} })[0]).toMatchObject({
    step: "schedule",
    path: "capacity",
  });
});

it("rejects malformed and partially entered values with a boolean false in SQL", async () => {
  const value = draft();
  const invalid: unknown[] = [
    null,
    [],
    {},
    { ...value, status: null },
    { ...value, status: "unknown" },
  ];
  for (const key of [
    "price",
    "capacity",
    "status",
    "meal",
    "days",
    "weekdays",
    "flexible",
    "name",
    "windows",
    "tiers",
    "tags",
    "menus",
    "trialPrice",
    "trialMax",
  ]) {
    const absent = { ...value } as Record<string, unknown>;
    delete absent[key];
    invalid.push(absent);
    if (!["price", "trialPrice", "trialMax"].includes(key))
      invalid.push({ ...value, [key]: null });
  }
  invalid.push(
    { ...value, price: "35000" },
    { ...value, price: 0 },
    { ...value, price: 999 },
    { ...value, price: 10000001 },
    { ...value, price: 1000.5 },
    { ...value, capacity: { [value.weekdays[0]]: 10 } },
    { ...value, capacity: { ...base.capacity, [value.weekdays[0]]: null } },
    { ...value, capacity: { ...base.capacity, [value.weekdays[0]]: -1 } },
    { ...value, capacity: { ...base.capacity, [value.weekdays[0]]: 10.5 } },
    { ...value, capacity: { ...base.capacity, [value.weekdays[0]]: 11 } },
    { ...value, windows: { lunch: null, dinner: "17.00–19.00" } },
  );
  for (const input of invalid) {
    expect(offerSchema.safeParse(input).success, JSON.stringify(input)).toBe(
      false,
    );
    expect(await validSQL(input), JSON.stringify(input)).toBe(false);
  }
  expect(
    (
      await db.query<{ valid: boolean }>(
        "select v1.valid_offer(null::jsonb) valid",
      )
    ).rows[0].valid,
  ).toBe(false);
});

it("saves, reloads, completes and clears commercial fields without fabricated values", async () => {
  const { id } = await save(draft());
  let current = await stored(id);
  expect(current).toMatchObject({
    price: null,
    capacity: {},
    trialPrice: null,
    trialMax: null,
  });
  await cmd("package.save", {
    catererId: K[0],
    id,
    version: current.version,
    offer: {
      ...current,
      price: 42000,
      capacity: withDraftCapacity({}, current.weekdays, 0),
    },
  });
  current = await stored(id);
  expect(current.price).toBe(42000);
  expect(draftCapacityValue(current.capacity, current.weekdays)).toBe(0);
  await cmd("package.save", {
    catererId: K[0],
    id,
    version: current.version,
    offer: { ...current, price: null, capacity: {} },
  });
  current = await stored(id);
  expect(current).toMatchObject({ price: null, capacity: {} });
  const raw = (
    await db.query<{ offer: unknown }>(
      "select offer from v1.packages where id=$1",
      [id],
    )
  ).rows[0].offer;
  expect(raw).toMatchObject({ price: null, capacity: {} });
});

it("rejects publication, checkout and prepaid import without financial or booking effects", async () => {
  const { id } = await save(draft());
  const current = await stored(id);
  const before = await effects();
  await expect(
    cmd("package.save", {
      catererId: K[0],
      id,
      version: current.version,
      offer: { ...base, status: "published", price: null, capacity: {} },
    }),
  ).rejects.toThrow("INVALID_INPUT");
  const purchase = {
    packageId: id,
    addressId: ADDRESS_ID,
    portions: 1,
    startDate: addDays(localDay(), 30),
    trial: false,
  };
  await expect(read("quote", purchase, U.customer)).rejects.toThrow(
    "NOT_AVAILABLE",
  );
  await expect(
    cmd("checkout.create", { ...purchase, acceptedTerms: true }, U.customer),
  ).rejects.toThrow("NOT_AVAILABLE");
  await expect(
    cmd("import.preview", {
      catererId: K[0],
      rows: [
        {
          ...purchase,
          customerId: U.customer,
          remainingDays: 1,
          externalReference: "partial-draft-test",
        },
      ],
    }),
  ).rejects.toThrow("NOT_AVAILABLE");
  expect(await effects()).toEqual(before);
  expect(await stored(id)).toEqual(current);
  expect(
    (await read<{ items: Offer[] }>("catalog", {}, null)).items.some(
      (o) => o.id === id,
    ),
  ).toBe(false);
});

it("completes a draft through the existing atomic publication command and preserves old offers", async () => {
  const untouched = (
    await db.query(
      "select id,offer,version,status from v1.packages order by id",
    )
  ).rows;
  const { id } = await save(draft());
  const current = await stored(id);
  await cmd("package.save", {
    catererId: K[0],
    id,
    version: current.version,
    offer: { ...base, status: "published" },
  });
  const published = await stored(id);
  expect(published).toMatchObject({
    status: "published",
    price: base.price,
    capacity: base.capacity,
  });
  expect(
    (
      await db.query(
        "select id,offer,version,status from v1.packages where id<>$1 order by id",
        [id],
      )
    ).rows,
  ).toEqual(untouched);
  await expect(
    cmd("package.save", {
      catererId: K[0],
      id,
      version: published.version,
      offer: { ...published, status: "draft", price: null, capacity: {} },
    }),
  ).rejects.toThrow("PACKAGE_IMMUTABLE");
});

it("keeps owner authorization, idempotent retries and stale versions for partial drafts", async () => {
  const payload = {
    catererId: K[0],
    slug: "draft-idempotency-" + crypto.randomUUID(),
    offer: draft(),
  };
  for (const actor of [U.staff, U.customer, null])
    await expect(cmd("package.save", payload, actor)).rejects.toThrow(
      actor ? "FORBIDDEN" : "UNAUTHORIZED",
    );
  const key = crypto.randomUUID();
  const saved = await cmd("package.save", payload, U.owner, key);
  expect(await cmd("package.save", payload, U.owner, key)).toEqual(saved);
  const current = await stored(saved.id);
  const update = {
    catererId: K[0],
    id: saved.id,
    version: current.version,
    offer: { ...current, price: 39000 },
  };
  await cmd("package.save", update);
  await expect(
    cmd("package.save", { ...update, offer: { ...current, price: null } }),
  ).rejects.toThrow("CONFLICT");
  expect(
    (
      await db.query("select 1 from v1.audit where details->>'requestId'=$1", [
        key,
      ])
    ).rows,
  ).toHaveLength(1);
});

it("installs the same draft validator in demo and migration without rewriting existing rows", async () => {
  const source = await readFile(
    "packages/backend/src/offer-validation.sql",
    "utf8",
  );
  const migration = await readFile(
    "supabase/migrations/20260927105917_partial_package_drafts.sql",
    "utf8",
  );
  expect(migration).toContain(
    source.slice(source.indexOf("create or replace function v1.valid_offer")),
  );
  const before = (
    await db.query(
      "select id,offer,version,status from v1.packages order by id",
    )
  ).rows;
  await db.exec(migration);
  expect(
    (
      await db.query(
        "select id,offer,version,status from v1.packages order by id",
      )
    ).rows,
  ).toEqual(before);
});
