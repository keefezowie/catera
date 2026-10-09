import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc } from "../packages/backend/src/database";
import { applyDemoStates, DEMO_STATE_IDS, demoStatesSQL } from "../packages/backend/src/demo-states";
import { CATERER_IDS as K, DEMO_ACTORS as U } from "../packages/backend/src/seed";
import {
  addDays,
  deliveryRoute,
  kitchenSession,
  localDay,
  renewalDue,
  todayPlates,
  trialFollowUp,
  type Checkout,
  type CustomerState,
  type SellerOperationsState,
  type Subscription,
} from "@catera/domain";

let db: PGlite;
let customer: CustomerState;
let subs: Subscription[];
const today = localDay();

const read = <T>(actor: string, resource: string, params: object = {}) =>
  localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const renewals = (s: Subscription) =>
  subs.filter((n) => n.renewed_from === s.id && n.status !== "cancelled");
const full = (s: Subscription) => !s.snapshot.trial;
const checkoutIds = async (where: string) =>
  (
    await db.query<{ id: string }>(
      `select id from v1.checkouts where user_id=$1 and ${where} order by created_at, id`,
      [U.customer],
    )
  ).rows.map((r) => r.id);
const checkoutRead = (id: string) => read<Checkout>(U.customer, "checkout", { id });

beforeAll(async () => {
  db = await createDemoDatabase(true);
  customer = await read<CustomerState>(U.customer, "customer");
  subs = customer.subscriptions;
});
afterAll(async () => db?.close());

describe("renewal states for the demo customer", () => {
  it("renewDue: an active full plan with 2 or 3 days left and no renewal", () => {
    const due = subs.filter(
      (s) => full(s) && s.status === "active" && [2, 3].includes(s.remaining) && renewals(s).length === 0,
    );
    expect(due).toHaveLength(1);
    expect(due[0].id).toBe(DEMO_STATE_IDS.renewDue);
    expect(renewalDue(due[0], subs)).toBe(true);
    expect(due[0].legacy).toBe(false);
  });

  it("renewed: an active full plan that another non-cancelled plan renews", () => {
    const renewed = subs.filter((s) => full(s) && s.status === "active" && renewals(s).length > 0);
    expect(renewed).toHaveLength(1);
    expect(renewed[0].id).toBe(DEMO_STATE_IDS.renewed);
    expect(renewalDue(renewed[0], subs)).toBe(false);
    const next = renewals(renewed[0])[0];
    expect(next.status).toBe("active");
    expect(next.starts_on > renewed[0].ends_on).toBe(true);
  });

  it("trialActive: an active trial plan that has not been continued", () => {
    const trials = subs.filter((s) => s.snapshot.trial && s.status === "active" && s.remaining >= 1);
    expect(trials.length).toBeGreaterThanOrEqual(1);
    const trial = trials.find((s) => trialFollowUp({ ...s, remaining: 1 }, subs));
    expect(trial).toBeTruthy();
  });

  it("completedRecent: a completed full plan that ended yesterday with no renewal", () => {
    const recent = subs.filter((s) => full(s) && s.status === "completed" && s.ends_on === addDays(today, -1));
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(DEMO_STATE_IDS.completedRecent);
    expect(renewals(recent[0])).toHaveLength(0);
    expect(recent[0].remaining).toBe(0);
    expect(recent[0].snapshot.dates.at(-1)).toBe(addDays(today, -1));
  });

  it("completedOld: a completed full plan that ended 180 days ago with no renewal", () => {
    const old = subs.filter((s) => full(s) && s.status === "completed" && s.ends_on === addDays(today, -180));
    expect(old).toHaveLength(1);
    expect(old[0].id).toBe(DEMO_STATE_IDS.completedOld);
    expect(renewals(old[0])).toHaveLength(0);
    expect(old[0].remaining).toBe(0);
  });
});

describe("payment states", () => {
  it("paidLong: a paid checkout with more than 6 reserved dates and a subscription", async () => {
    const ids = await checkoutIds(
      "state='paid' and subscription_id is not null and jsonb_array_length(quote->'dates')>6",
    );
    expect(ids.length).toBeGreaterThanOrEqual(1);
    for (const id of ids) {
      const checkout = await checkoutRead(id);
      expect(checkout.state).toBe("paid");
      expect(checkout.quote.dates.length).toBeGreaterThan(6);
      expect(subs.some((s) => s.id === checkout.subscription_id)).toBe(true);
      const reserved = await db.query<{ n: number }>(
        "select count(*)::int n from v1.reservations where checkout_id=$1 and state='confirmed'",
        [id],
      );
      expect(reserved.rows[0].n).toBe(checkout.quote.dates.length);
    }
  });

  it("paidLong: one of them is a real purchase of upcoming dates, not history", async () => {
    const ahead = await checkoutIds(
      `state='paid' and subscription_id is not null and jsonb_array_length(quote->'dates')>6 and (quote->'dates'->>0)::date>'${today}'::date`,
    );
    expect(ahead).toHaveLength(1);
    const checkout = await checkoutRead(ahead[0]);
    expect(checkout.quote.dates).toHaveLength(10);
    expect(checkout.quote.dates.every((d) => d > today)).toBe(true);
  });

  it("paidMenuChoice: a paid checkout whose offer lets the customer choose the menu", async () => {
    const ids = await checkoutIds(
      "state='paid' and subscription_id is not null and quote->'offer'->>'menuSelectionMode'='customer'",
    );
    expect(ids).toHaveLength(1);
    const checkout = await checkoutRead(ids[0]);
    expect(checkout.quote.offer.menuSelectionMode).toBe("customer");
    const sub = subs.find((s) => s.id === checkout.subscription_id)!;
    expect(sub.status).toBe("active");
    // The menu screen the paid page links to answers for this plan.
    const month = await read<{ dates: unknown[] }>(U.customer, "customer-menu-month", {
      subscriptionId: sub.id,
      month: sub.starts_on.slice(0, 7) + "-01",
      meal: "lunch",
    });
    expect(month.dates.length).toBeGreaterThan(0);
  });

  it("paidPending: the database holds a paid checkout with no subscription yet", async () => {
    // Nothing in the schema ties a paid checkout to a subscription: the column is a plain nullable uuid.
    const ids = await checkoutIds("state='paid' and subscription_id is null");
    expect(ids).toHaveLength(1);
    const checkout = await checkoutRead(ids[0]);
    expect(checkout.state).toBe("paid");
    expect(checkout.subscription_id ?? null).toBeNull();
    expect(subs.some((s) => s.snapshot.packageId === checkout.quote.packageId && s.starts_on === checkout.quote.dates[0])).toBe(false);
    const payment = await db.query<{ state: string }>("select state from v1.payments where checkout_id=$1", [ids[0]]);
    expect(payment.rows.map((r) => r.state)).toEqual(["paid"]);
  });
});

describe("kitchen loop carry-overs", () => {
  it("kitchenToday: a Dapur Senja delivery for Nadia today, both meals scheduled, no open report, with more stops", async () => {
    const ops = await read<SellerOperationsState>(U.owner, "seller", { id: K[0] });
    expect(ops.operationalDate).toBe(today);
    const nadia = ops.deliveries.filter((d) => d.customer.name === "Nadia Putri" && d.service_date === today);
    expect(nadia).toHaveLength(1);
    expect(nadia[0].meals.map((m) => [m.meal, m.status])).toEqual([
      ["lunch", "scheduled"],
      ["dinner", "scheduled"],
    ]);
    expect(nadia[0].meals.every((m) => !m.issue && !m.confirmed_at && !m.departed_at)).toBe(true);
    const open = await db.query(
      "select 1 from v1.delivery_issues where day_id=$1 and status in('open','responded','escalated')",
      [nadia[0].id],
    );
    expect(open.rows).toHaveLength(0);

    for (const meal of ["lunch", "dinner"] as const) {
      const session = kitchenSession(ops, meal, new Date())!;
      // "Lihat {n} alamat lainnya" appears after the first three stops: at least three more behind them.
      expect(session.stops.length).toBeGreaterThanOrEqual(6);
      expect(session.stops.some((s) => s.name === "Nadia Putri")).toBe(true);
      expect(session.canCook).toBe(true);
      expect(session.journey.stage).toBe("scheduled");
      expect(deliveryRoute(ops, meal).slice(3).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("autoArrived: yesterday's last delivery was closed by the system, and today's plate says so", async () => {
    const yesterday = customer.deliveries.filter((d) => d.service_date === addDays(today, -1));
    const auto = yesterday.filter((d) => d.meals.every((m) => m.status === "delivered" && m.confirmed_by === "auto"));
    expect(auto).toHaveLength(1);
    for (const m of auto[0].meals) expect(Date.parse(m.confirmed_at!)).not.toBeNaN();
    expect(auto[0].status).toBe("delivered");

    // The customer's Beranda reads only today's plates, so the line "Tercatat sampai" needs an auto arrival today too.
    const plates = todayPlates(customer, new Date());
    const arrived = plates.filter((p) => p.state === "arrived" && p.journey.arrivedBy === "auto");
    expect(arrived).toHaveLength(1);
    expect(arrived[0].confirmedAt).toBeTruthy();
    // The kitchen's lunch and dinner for Nadia sit next to it, not yet cooked (a meal past its window reads "due").
    const kitchen = plates.filter((p) => p.packageName === "Rantang Nusantara");
    expect(kitchen.map((p) => p.meal)).toEqual(["lunch", "dinner"]);
    expect(kitchen.every((p) => ["scheduled", "due"].includes(p.state))).toBe(true);
  });
});

describe("synthetic data and isolation", () => {
  it("every added customer, address and package carries the synthetic wording", async () => {
    const demo = Object.values(U);
    const profiles = await db.query<{ id: string; name: string }>(
      "select id,name from v1.profiles where id<>all($1::uuid[]) order by name",
      [demo],
    );
    expect(profiles.rows.length).toBeGreaterThanOrEqual(5);
    for (const p of profiles.rows) expect(p.name).toMatch(/Contoh/);
    const addresses = await db.query<{ line: string; instructions: string }>(
      "select line,instructions from v1.addresses where user_id=any($1::uuid[])",
      [profiles.rows.map((p) => p.id)],
    );
    expect(addresses.rows).toHaveLength(profiles.rows.length);
    for (const a of addresses.rows) {
      expect(a.instructions).toMatch(/^Data sintetis/);
      expect(a.line).toMatch(/Contoh/);
    }
    const records = await db.query<{ name: string; address: { instructions?: string } }>(
      "select name,address from v1.customer_records where user_id=any($1::uuid[])",
      [profiles.rows.map((p) => p.id)],
    );
    expect(records.rows).toHaveLength(profiles.rows.length);
    for (const r of records.rows) {
      expect(r.name).toMatch(/Contoh/);
      expect(r.address.instructions).toMatch(/^Data sintetis/);
    }
    const bandung = await db.query<{ instructions: string }>(
      "select instructions from v1.addresses where user_id=$1 and area='Bandung'",
      [U.customer],
    );
    expect(bandung.rows).toHaveLength(1);
    expect(bandung.rows[0].instructions).toMatch(/^Data sintetis/);
    const added = await db.query<{ slug: string; caterer_id: string; offer: { description: string } }>(
      "select slug,caterer_id,offer from v1.packages where slug like 'contoh-%' order by slug",
    );
    expect(added.rows.map((p) => p.slug)).toEqual(["contoh-dua-pekan", "contoh-pilih-sendiri"]);
    for (const p of added.rows) {
      expect(p.offer.description).toMatch(/sintetis/i);
      // Dapur Senja's own days and attention list stay its own.
      expect(p.caterer_id).toBe(K[2]);
    }
    // The admin who signed for Rumah Rasa while the packages were saved holds no seat there afterwards.
    const seats = await db.query("select 1 from v1.staff where caterer_id=$1", [K[2]]);
    expect(seats.rows).toHaveLength(0);
  });

  it("applies once: a second pass adds nothing", async () => {
    const count = async () =>
      (
        await db.query<{ n: number }>(
          "select (select count(*) from v1.subscriptions)::int + (select count(*) from v1.checkouts)::int + (select count(*) from v1.delivery_days)::int + (select count(*) from v1.profiles)::int n",
        )
      ).rows[0].n;
    const before = await count();
    await applyDemoStates(db);
    expect(await count()).toBe(before);
  });

  it("a stored demo database keeps its states once across restarts", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "catera-demo-states-"));
    const was = process.env.CATERA_DEMO_DATA_DIR;
    process.env.CATERA_DEMO_DATA_DIR = dir;
    const count = async (stored: PGlite) =>
      (
        await stored.query<{ n: number; marked: number }>(
          "select (select count(*) from v1.subscriptions)::int + (select count(*) from v1.checkouts)::int + (select count(*) from v1.delivery_days)::int n, (select count(*) from v1.audit where action='demo.synthetic_states')::int marked",
        )
      ).rows[0];
    try {
      let stored = await createDemoDatabase();
      const first = await count(stored);
      await stored.close();
      stored = await createDemoDatabase();
      expect(await count(stored)).toEqual(first);
      expect(first.marked).toBe(1);
      await stored.close();
    } finally {
      if (was === undefined) delete process.env.CATERA_DEMO_DATA_DIR;
      else process.env.CATERA_DEMO_DATA_DIR = was;
      await rm(dir, { recursive: true, force: true });
    }
  }, 90000);

  it("is built from the day it is given, and never ships in a migration", async () => {
    expect(demoStatesSQL(today)).toContain(addDays(today, -180));
    expect(demoStatesSQL(addDays(today, 40))).not.toBe(demoStatesSQL(today));
    const dir = path.join(process.cwd(), "supabase/migrations");
    for (const file of await readdir(dir)) {
      const sql = await readFile(path.join(dir, file), "utf8");
      expect(sql, file).not.toContain("demo.synthetic_states");
    }
  });
});
