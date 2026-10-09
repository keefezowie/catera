import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import {
  ADDRESS_ID as A,
  CATERER_IDS as K,
  DEMO_ACTORS as U,
  PACKAGE_IDS as P,
} from "../packages/backend/src/seed";
import { addDays, localDay } from "@catera/domain";

// 17:34 UTC on 9 Oct is 00:34 on 10 Oct in Jakarta: the UTC date is still the day before.
// PGlite reads its clock from the JS Date, so now() in the database follows the pinned time.
// Its session time zone follows the machine, so it is set to UTC as on the hosted database.
const PINNED = new Date("2026-10-09T17:34:00Z");
const TODAY = "2026-10-10";
let db: PGlite;
const cmd = (action: string, payload: object, user: string = U.platform_admin) =>
  localRpc<any>(db, user, "catera_v1_command", [action, payload, crypto.randomUUID()]);
const pilot = (params: object = {}) =>
  localRpc<any>(db, U.platform_admin, "catera_v1_read", ["pilot", { id: K[0], ...params }]);

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: PINNED });
  db = await createDemoDatabase(true);
  await db.exec("set timezone to 'UTC'");
});
afterAll(async () => {
  await db?.close();
  vi.useRealTimers();
});

it("runs on the Jakarta date while the UTC date is the day before", async () => {
  expect(localDay()).toBe(TODAY);
  const r = await db.query<{ utc: string; jakarta: string }>(
    "select current_date::text utc,(now() at time zone 'Asia/Jakarta')::date::text jakarta",
  );
  expect(r.rows[0]).toEqual({ utc: "2026-10-09", jakarta: TODAY });
});

it("defaults the pilot window to the Jakarta month up to the Jakarta today", async () => {
  const m = (await pilot()).metrics;
  expect([m.from, m.to]).toEqual(["2026-10-01", TODAY]);
  expect((await pilot({ from: "2026-09-01", to: "2026-09-30" })).metrics.to).toBe("2026-09-30");
});

it("counts a payment made after Jakarta midnight in a window that starts on the Jakarta date", async () => {
  const before = (await pilot({ from: TODAY, to: addDays(TODAY, 90) })).metrics.processedGmv;
  const checkout = await cmd(
    "checkout.create",
    { acceptedTerms: true, packageId: P[2], addressId: A, portions: 1, startDate: addDays(TODAY, 30), trial: false },
    U.customer,
  );
  await cmd("checkout.demo_pay", { id: checkout.id }, U.customer);
  const after = (await pilot({ from: TODAY, to: addDays(TODAY, 90) })).metrics.processedGmv;
  expect(after - before).toBe(checkout.quote.total);
  expect((await pilot({ from: addDays(TODAY, -1), to: addDays(TODAY, -1) })).metrics.processedGmv).toBe(0);
});

it("counts costs recorded for the Jakarta date in the default window", async () => {
  for (const kind of ["processing", "payout", "incentive", "support"])
    await cmd("pilot.observation", {
      catererId: K[0],
      date: TODAY,
      kind,
      amount: 0,
      reference: "Verified synthetic zero " + kind,
    });
  const m = (await pilot()).metrics;
  expect(m.missingCosts).toEqual([]);
  expect(m.contribution).not.toBeNull();
});

it("accepts a pilot exit dated the Jakarta today and still rejects tomorrow", async () => {
  const policy = await cmd("pilot.pricing", {
    catererId: K[0],
    model: "transaction",
    cohort: "Synthetic Jakarta day",
    effectiveAt: new Date(Date.now() - 60000).toISOString(),
    serviceFee: 1000,
    marketplacePercent: 9,
    invitedPercent: 4,
    monthlyFee: 0,
    approved: true,
    synthetic: true,
    reason: "Synthetic approved test",
  });
  await cmd("pilot.enroll", {
    catererId: K[0],
    pricingId: policy.id,
    startDate: TODAY,
    reference: "Synthetic pilot consent",
  });
  await expect(
    cmd("pilot.exit", { catererId: K[0], date: addDays(TODAY, 1), reason: "Synthetic exit tomorrow" }),
  ).rejects.toThrow("INVALID_INPUT");
  await cmd("pilot.exit", { catererId: K[0], date: TODAY, reason: "Synthetic exit today" });
  expect((await pilot()).enrollment.exited_on).toBe(TODAY);
});
