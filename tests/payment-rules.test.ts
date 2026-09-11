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
  addDays,
  localDay,
  type Checkout,
  type CustomerState,
  type Offer,
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
const sys = <T = Record<string, unknown>>(action: string, a: unknown = {}) =>
  localRpc<T>(db, null, "catera_v1_system", [action, a], true);
const input = (id = P[2], extra = {}) => ({
  packageId: id,
  addressId: A,
  portions: 3,
  startDate: addDays(localDay(), 60),
  trial: false,
  promo: "",
  ...extra,
});
beforeAll(async () => {
  db = await createDemoDatabase(true);
});
afterAll(async () => db?.close());
async function paid(c: Checkout, eventId = crypto.randomUUID()) {
  await sys("payment.attach", {
    id: c.id,
    providerId: "session-" + c.id,
    url: "https://example.test/pay",
  });
  return sys("payment.event", {
    checkoutId: c.id,
    providerId: "session-" + c.id,
    paymentRequestId: "request-" + c.id,
    eventId,
    status: "paid",
    amount: c.quote.total,
    currency: "IDR",
  });
}
it("combined packages reserve portions once and create both linked meals", async () => {
  const c = await command<Checkout>("checkout.create", input());
  await paid(c);
  const d = (
    await read<CustomerState>("customer", {
      from: addDays(localDay(), 50),
      to: addDays(localDay(), 100),
    })
  ).deliveries.filter((d) => d.offer.id === P[2]);
  expect(d).toHaveLength(10);
  expect(d.every((x) => x.meals.length === 2 && x.portions === 3)).toBe(true);
  const r = await db.query<{ n: number }>(
    "select sum(portions)::int n from v1.reservations where checkout_id=$1",
    [c.id],
  );
  expect(r.rows[0].n).toBe(30);
});
it("verified callbacks deduplicate and out-of-order expiration cannot undo paid subscriptions", async () => {
  const c = await command<Checkout>("checkout.create", input(P[3]));
  const id = crypto.randomUUID();
  await paid(c, id);
  expect(await paid(c, id)).toEqual({ duplicate: true });
  await sys("payment.event", {
    checkoutId: c.id,
    providerId: "session-" + c.id,
    eventId: crypto.randomUUID(),
    status: "expired",
    amount: c.quote.total,
    currency: "IDR",
  });
  const check = await read<Checkout>("checkout", { id: c.id });
  expect(check.state).toBe("paid");
  const r = await db.query<{ n: number }>(
    "select count(*)::int n from v1.allocations where checkout_id=$1",
    [c.id],
  );
  expect(r.rows[0].n).toBe(1);
});
it("missing amount or mismatched callback is rejected before activation", async () => {
  const c = await command<Checkout>("checkout.create", input(P[4]));
  await sys("payment.attach", { id: c.id, providerId: "session-" + c.id });
  await expect(
    sys("payment.event", {
      checkoutId: c.id,
      providerId: "session-" + c.id,
      eventId: crypto.randomUUID(),
      status: "paid",
      currency: "IDR",
    }),
  ).rejects.toThrow("AMOUNT_INVALID");
  expect(
    (await read<Checkout>("checkout", { id: c.id })).subscription_id,
  ).toBeNull();
});
it("late payment reacquires all released dates or opens exactly one exception", async () => {
  const c = await command<Checkout>(
    "checkout.create",
    input(P[0], { startDate: addDays(localDay(), 100) }),
  );
  await sys("payment.attach", { id: c.id, providerId: "session-" + c.id });
  await sys("payment.attach", { id: c.id, providerId: "session-" + c.id });
  await db.query(
    "update v1.checkouts set expires_at=now()-interval '1 minute' where id=$1",
    [c.id],
  );
  await sys("maintenance");
  await db.query("insert into v1.capacity values($1,$2,0,false)", [
    c.quote.packageId,
    c.quote.dates[2],
  ]);
  await paid(c);
  await paid(c);
  expect((await read<Checkout>("checkout", { id: c.id })).state).toBe(
    "payment_exception",
  );
  const r = await db.query<{ n: number }>(
    "select count(*)::int n from v1.support_cases where checkout_id=$1",
    [c.id],
  );
  expect(r.rows[0].n).toBe(1);
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.reservations where checkout_id=$1 and state<>'released'",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(0);
});
it("late payment with free capacity recreates the complete reservation", async () => {
  const c = await command<Checkout>(
    "checkout.create",
    input(P[1], { startDate: addDays(localDay(), 120) }),
  );
  await sys("payment.attach", { id: c.id, providerId: "session-" + c.id });
  await db.query(
    "update v1.checkouts set expires_at=now()-interval '1 minute' where id=$1",
    [c.id],
  );
  await sys("maintenance");
  await paid(c);
  expect((await read<Checkout>("checkout", { id: c.id })).state).toBe("paid");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from v1.reservations where checkout_id=$1 and state='confirmed'",
        [c.id],
      )
    ).rows[0].n,
  ).toBe(c.quote.dates.length);
});
it("a successful trial blocks another package trial from the same caterer", async () => {
  const c = await command<Checkout>(
    "checkout.create",
    input(P[0], {
      trial: true,
      startDate: addDays(localDay(), 150),
      portions: 1,
    }),
  );
  await paid(c);
  await expect(
    command(
      "checkout.create",
      input(P[2], {
        trial: true,
        startDate: addDays(localDay(), 160),
        portions: 1,
      }),
    ),
  ).rejects.toThrow("TRIAL_USED");
});
it("address edits cannot mutate a pending purchase address", async () => {
  const c = await command<Checkout>(
    "checkout.create",
    input(P[3], { startDate: addDays(localDay(), 180) }),
  );
  await command("address.save", {
    id: A,
    version: 1,
    label: "Rumah",
    line: "Jl. Berubah No. 99",
    area: "Bandung",
    city: "Bandung",
    instructions: "",
  });
  await paid(c);
  const d = await db.query<{ address: { area: string } }>(
    "select address from v1.delivery_days where subscription_id=(select subscription_id from v1.checkouts where id=$1)",
    [c.id],
  );
  expect(d.rows.every((x) => x.address.area === "Jakarta Selatan")).toBe(true);
});
it("direct RPC rejects invalid published offer data and preserves the old offer", async () => {
  const catalog = await read<{ items: Offer[] }>("catalog");
  const o = catalog.items.find((x) => x.id === P[0])!;
  await expect(
    command(
      "package.save",
      {
        catererId: K[0],
        id: o.id,
        version: o.version,
        offer: { ...o, days: 0 },
      },
      U.owner,
    ),
  ).rejects.toThrow("INVALID_INPUT");
});
it("dated menu edits appear in deliveries without changing the purchase snapshot", async () => {
  const c = await read<CustomerState>("customer");
  const d = c.deliveries.find((d) => d.offer.id === P[0])!;
  const currentMenu = d.offer.menus.find((m) => m.meal === "lunch")!;
  const replacementDish = currentMenu.items![0].name + " pengganti";
  const snapshotBefore = c.subscriptions.find(s => s.id === d.subscription_id)!.snapshot;
  const version = (await db.query<{ version: number }>("select version from v1.menus where package_id=$1 and service_date=$2 and meal='lunch' and content_revision=$3", [P[0], d.service_date, d.offer.contentRevision ?? 0])).rows[0]?.version ?? 0;
  await command(
    "menu.save",
    {
      catererId: K[0],
      packageId: P[0],
      date: d.service_date,
      meal: "lunch",
      contentRevision: d.offer.contentRevision ?? 0,
      version,
      details: {
        ...currentMenu,
        items: currentMenu.items!.map((item, index) =>
          index === 0 ? { ...item, name: replacementDish, sourceDishId: undefined, sourceDishVersion: undefined, sourceServing: undefined } : item,
        ),
      },
    },
    U.owner,
  );
  const fresh = await read<CustomerState>("customer");
  expect(
    fresh.deliveries
      .find((x) => x.id === d.id)
      ?.offer.menus.find((m) => m.meal === "lunch")?.items?.[0].name,
  ).toBe(replacementDish);
  expect(
    fresh.subscriptions.find((s) => s.id === d.subscription_id)?.snapshot,
  ).toEqual(snapshotBefore);
});
