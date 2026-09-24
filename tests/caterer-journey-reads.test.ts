import { beforeAll, afterAll, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  DEMO_ACTORS as U,
  CATERER_IDS as C,
  PACKAGE_IDS as P,
  ADDRESS_ID,
} from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";
let db: PGlite;
const read = (actor: string | null, resource: string, params: object) =>
  localRpc<any>(db, actor, "catera_v1_read", [resource, params]);
const cmd = (
  actor: string,
  action: string,
  payload: object,
  key = crypto.randomUUID(),
) => localRpc<any>(db, actor, "catera_v1_command", [action, payload, key]);
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());
it("attention links retain the exact delivery, day and meal for issues and fallback", async () => {
  const day = { id: crypto.randomUUID(), subscription_id: crypto.randomUUID() };
  const date = localDay();
  // A separate due-today synthetic obligation; never rewrite purchased terms.
  await db.query(
    "insert into v1.subscriptions(id,user_id,package_id,snapshot,portions,starts_on,ends_on) select $1,user_id,package_id,jsonb_set(snapshot,'{offer,menuSelectionMode}','\"customer\"'),1,$2,$2 from v1.subscriptions where user_id=$3 and snapshot->'offer'->>'catererId'=$4 order by id limit 1",
    [day.subscription_id, date, U.customer, C[0]],
  );
  await db.query(
    "insert into v1.delivery_days(id,subscription_id,service_date,address) select $1,$2,$3,address from v1.delivery_days order by id limit 1",
    [day.id, day.subscription_id, date],
  );
  await db.query(
    "insert into v1.fulfillments(day_id,meal,status) values($1,'lunch','issue')",
    [day.id],
  );
  const result = await read(U.owner, "seller-attention", { id: C[0] });
  for (const kind of ["delivery", "choice_fallback"]) {
    const item = result.items.find(
      (item: any) => item.kind === kind && item.id.includes(day.id),
    );
    expect(item, JSON.stringify({ kind, items: result.items })).toBeTruthy();
    const url = new URL(item.href, "http://127.0.0.1");
    expect(url.searchParams.get("delivery")).toBe(day.id);
    expect(url.searchParams.get("date")).toBe(date);
    expect(url.searchParams.get("meal")).toBe(item.id.split("-").at(-1));
  }
});
it("searches only the authorized tenant with literal matching and matching pagination totals", async () => {
  for (let i = 0; i < 103; i++)
    await db.query(
      "insert into v1.customer_records(caterer_id,name,phone,address,origin) values($1,$2,$3,'{}','seller')",
      [
        C[0],
        "Journey person " + String(i).padStart(3, "0"),
        "+628123" + String(i).padStart(6, "0"),
      ],
    );
  const first = await read(U.owner, "seller-customers", {
    id: C[0],
    search: "JOURNEY person",
  });
  const second = await read(U.staff, "seller-customers", {
    id: C[0],
    search: "Journey person",
    offset: 100,
  });
  expect(first.total).toBe(103);
  expect(first.customers).toHaveLength(100);
  expect(second.total).toBe(103);
  expect(second.customers).toHaveLength(3);
  expect(
    new Set([...first.customers, ...second.customers].map((c) => c.id)).size,
  ).toBe(103);
  expect(
    (await read(U.owner, "seller-customers", { id: C[0], search: "%" })).total,
  ).toBe(0);
  expect(
    (
      await read(U.owner, "seller-customers", {
        id: C[0],
        search: "628123000102",
      })
    ).total,
  ).toBe(1);
  await expect(
    read(U.owner, "seller-customers", {
      id: C[0],
      customerId: crypto.randomUUID(),
    }),
  ).rejects.toThrow("NOT_FOUND");
  for (const actor of [null, U.customer])
    await expect(
      read(actor, "seller-customers", { id: C[0], search: "Journey" }),
    ).rejects.toThrow(/FORBIDDEN|UNAUTHORIZED/);
  await expect(
    read(U.owner, "seller-customers", { id: C[1], search: "Journey" }),
  ).rejects.toThrow("FORBIDDEN");
});
it("recovers the latest production revision and detects changes across the whole day", async () => {
  const checkout = await cmd(U.customer, "checkout.create", {
    acceptedTerms: true,
    packageId: P[2],
    addressId: ADDRESS_ID,
    portions: 2,
    startDate: addDays(localDay(), 14),
    trial: true,
    paymentMethod: "qris",
  });
  await cmd(U.customer, "checkout.demo_pay", { id: checkout.id });
  const date = checkout.quote.dates[0];
  expect(
    (await read(U.owner, "seller", { id: C[0], date })).latestProduction,
  ).toBeNull();
  const key = crypto.randomUUID(),
    saved = await cmd(
      U.owner,
      "production.freeze",
      { catererId: C[0], date },
      key,
    );
  expect(
    await cmd(U.owner, "production.freeze", { catererId: C[0], date }, key),
  ).toEqual(saved);
  const state = await read(U.staff, "seller", {
    id: C[0],
    date,
    package: P[0],
    meal: "lunch",
  });
  expect(state.latestProduction).toMatchObject({
    id: saved.id,
    revision: saved.revision,
    changed: false,
  });
  expect(state.latestProduction.createdAt).toBeTruthy();
  const entries = (
    await db.query<any>("select entries from v1.production where id=$1", [
      saved.id,
    ])
  ).rows[0].entries;
  expect(entries[0].meals.map((meal: any) => meal.meal).sort()).toEqual([
    "dinner",
    "lunch",
  ]);
  await db.query(
    "update v1.delivery_days set address=jsonb_set(address,'{line}','\"Changed synthetic address\"'),version=version+1 where id=$1",
    [entries[0].id],
  );
  expect(
    (await read(U.owner, "seller", { id: C[0], date })).latestProduction
      .changed,
  ).toBe(true);
  const next = await cmd(U.owner, "production.freeze", {
    catererId: C[0],
    date,
  });
  expect(
    (await read(U.owner, "seller", { id: C[0], date })).latestProduction,
  ).toMatchObject({ id: next.id, changed: false });
  await expect(read(U.owner, "seller", { id: C[1], date })).rejects.toThrow(
    "FORBIDDEN",
  );
  await expect(read(U.customer, "seller", { id: C[0], date })).rejects.toThrow(
    "FORBIDDEN",
  );
});
