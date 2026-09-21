import { beforeAll, afterAll, expect, it, vi } from "vitest";
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
  purchaseStartAvailable,
  durationOptions,
  salesHistory,
  type Quote,
  type Checkout,
  type SellerState,
} from "@catera/domain";
import { createPaymentSession } from "../packages/backend/src/payment-provider";
let db: Awaited<ReturnType<typeof createDemoDatabase>>;
const cmd = (payload: unknown, key = crypto.randomUUID()) =>
  localRpc<Checkout>(db, U.customer, "catera_v1_command", [
    "checkout.create",
    payload,
    key,
  ]);
const input = () => ({
  packageId: P[0],
  addressId: A,
  portions: 1,
  startDate: addDays(localDay(), 50),
  cycles: 2,
});
beforeAll(async () => {
  db = await createDemoDatabase(true);
  await localRpc(db, U.owner, "catera_v1_command", [
    "package.durationPricing.save",
    {
      packageId: P[0],
      catererId: K[0],
      revision: 0,
      options: [
        { cycles: 1, discountPercent: 0 },
        { cycles: 2, discountPercent: 5 },
      ],
    },
    crypto.randomUUID(),
  ]);
});
afterAll(async () => db?.close());
it("records consent atomically, rejects omitted/false/forged values without holds or payment outbox, and preserves idempotency", async () => {
  const counts = async () =>
    (
      await db.query(
        "select (select count(*) from v1.checkouts) checkouts,(select count(*) from v1.reservations) holds,(select count(*) from v1.outbox) jobs",
      )
    ).rows;
  const before = await counts();
  for (const acceptedTerms of [undefined, false, "true", 1])
    await expect(cmd({ ...input(), acceptedTerms })).rejects.toThrow(
      "TERMS_REQUIRED",
    );
  expect(await counts()).toEqual(before);
  const q = await localRpc<Quote>(db, U.customer, "catera_v1_read", [
    "quote",
    input(),
  ]);
  expect(q.dates).toHaveLength(q.offer.days * 2);
  const payload = { ...input(), acceptedTerms: true, expectedQuote: q },
    key = crypto.randomUUID();
  const c = await cmd(payload, key),
    retry = await cmd(payload, key);
  expect(c.terms_version).toBe("purchase-2026-09-20");
  expect(c.terms_accepted_at).toBeTruthy();
  expect(retry.id).toBe(c.id);
  expect(retry.terms_accepted_at).toBe(c.terms_accepted_at);
  await expect(
    db.query("update v1.checkouts set terms_accepted_at=null where id=$1", [
      c.id,
    ]),
  ).rejects.toThrow("IMMUTABLE_TERMS");
});
it("prevents provider work before acceptance, including historical pending checkouts", async () => {
  const system = vi.fn();
  await expect(
    createPaymentSession(
      { id: "unaccepted", provider: "doku" } as Checkout,
      system,
    ),
  ).rejects.toThrow("TERMS_REQUIRED");
  expect(system).not.toHaveBeenCalled();
});
it("exposes the rollout gate without removing configured seller options", async () => {
  await db.query("select set_config('catera.demo','false',false)");
  const offer = (
    await db.query<{ o: Quote["offer"] }>(
      "select v1.offer(p) o from v1.packages p where id=$1",
      [P[0]],
    )
  ).rows[0].o;
  expect(offer.multiCycleAvailable).toBe(false);
  expect(offer.durationPricing?.options.map((o) => o.cycles)).toEqual([1, 2]);
  expect(durationOptions(offer).map((o) => o.cycles)).toEqual([1]);
  await expect(
    db.query("select v1.quote($1,$2)", [U.customer, input()]),
  ).rejects.toThrow("DURATION_UNAVAILABLE");
  await db.query("update v1.purchase_features set multi_cycle=true");
  const enabled = (
    await db.query<{ o: Quote["offer"] }>(
      "select v1.offer(p) o from v1.packages p where id=$1",
      [P[0]],
    )
  ).rows[0].o;
  expect(durationOptions(enabled).map((o) => o.cycles)).toEqual([1, 2]);
});
it("matches PostgreSQL cutoff at the boundary across Indonesian timezones", async () => {
  for (const timezone of ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]) {
    const offer = {
      timezone,
      cutoff: "17:00",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    };
    const cutoff = (
      await db.query<{ cutoff: string }>(
        "select v1.cutoff($1,'2026-09-21')::text cutoff",
        [offer],
      )
    ).rows[0].cutoff;
    const ms = new Date(cutoff).getTime();
    for (const delta of [-1000, 0, 1000])
      expect(
        purchaseStartAvailable(offer, "2026-09-21", new Date(ms + delta)),
      ).toBe(delta < 0);
    expect(purchaseStartAvailable(offer, "2026-09-20", new Date(ms))).toBe(
      false,
    );
    expect(purchaseStartAvailable(offer, "2026-09-22", new Date(ms))).toBe(
      true,
    );
    expect(
      purchaseStartAvailable(
        { ...offer, weekdays: [2] },
        "2026-09-21",
        new Date(ms - 1000),
      ),
    ).toBe(false);
  }
});
it("groups three payment attempts, deduplicates row IDs, and preserves distinct paid purchases and customers", () => {
  const row = (id: string, state: string, user = "user") =>
    ({
      id,
      state,
      user_id: user,
      package_id: "p",
      address_id: "a",
      created_at: `2026-09-20T0${id}:00:00Z`,
      quote: {
        packageId: "p",
        dates: ["2026-09-22"],
        portions: 1,
        trial: false,
        total: 100,
      },
    }) as SellerState["transactions"][number];
  const failed = row("1", "failed"),
    expired = row("2", "expired"),
    paid = row("3", "paid");
  const groups = salesHistory([paid, failed, expired, paid]);
  expect(groups).toHaveLength(1);
  expect(groups[0].transaction.id).toBe("3");
  expect(groups[0].attempts).toHaveLength(3);
  expect(salesHistory([failed, paid, row("4", "paid")])).toHaveLength(2);
  expect(salesHistory([paid, row("4", "paid", "other")])).toHaveLength(2);
});
