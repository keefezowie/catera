import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createDemoDatabase, localRpc, projectRoot } from "../packages/backend/src/database";
import { applyDemoStates, DEMO_STATE_IDS, demoStatesSQL } from "../packages/backend/src/demo-states";
import { ADDRESS_ID, CATERER_IDS as K, DEMO_ACTORS as U, PACKAGE_IDS as P } from "../packages/backend/src/seed";
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

const today = localDay();
const dirs: string[] = [];

/** Run `make` with the stored demo database pointed at `dir`, then put the setting back. */
async function withDataDir<T>(dir: string, make: () => Promise<T>): Promise<T> {
  const was = process.env.CATERA_DEMO_DATA_DIR;
  process.env.CATERA_DEMO_DATA_DIR = dir;
  try {
    return await make();
  } finally {
    if (was === undefined) delete process.env.CATERA_DEMO_DATA_DIR;
    else process.env.CATERA_DEMO_DATA_DIR = was;
  }
}
const tempDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "catera-demo-states-"));
  dirs.push(dir);
  return dir;
};

/** The two demo databases the states must look the same in: in memory, and a stored one made today in a new folder. */
const databases = {} as Record<"in memory" | "fresh stored", PGlite>;
beforeAll(async () => {
  databases["in memory"] = await createDemoDatabase(true);
  databases["fresh stored"] = await withDataDir(await tempDir(), () => createDemoDatabase());
}, 120000);
afterAll(async () => {
  for (const db of Object.values(databases)) await db?.close();
  for (const dir of dirs) await rm(dir, { recursive: true, force: true });
});

const read = <T>(db: PGlite, actor: string, resource: string, params: object = {}) =>
  localRpc<T>(db, actor, "catera_v1_read", [resource, params]);
const full = (s: Subscription) => !s.snapshot.trial;

/** What the customer's plans look like, without ids or times, so two databases can be compared. */
const planShape = (subs: Subscription[]) =>
  subs
    .map((s) => ({
      plan: s.snapshot.offer.name,
      trial: !!s.snapshot.trial,
      portions: s.portions,
      status: s.status,
      remaining: s.remaining,
      starts: s.starts_on,
      ends: s.ends_on,
      renewed: subs.some((n) => n.renewed_from === s.id && n.status !== "cancelled"),
      renews: !!s.renewed_from,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const shapes: Record<string, unknown> = {};

describe.each(["in memory", "fresh stored"] as const)("demo states, %s", (mode) => {
  let db: PGlite;
  let customer: CustomerState;
  let subs: Subscription[];
  const renewals = (s: Subscription) => subs.filter((n) => n.renewed_from === s.id && n.status !== "cancelled");
  const checkoutIds = async (where: string) =>
    (
      await db.query<{ id: string }>(
        `select id from v1.checkouts where user_id=$1 and ${where} order by created_at, id`,
        [U.customer],
      )
    ).rows.map((r) => r.id);
  const checkoutRead = (id: string) => read<Checkout>(db, U.customer, "checkout", { id });

  beforeAll(async () => {
    db = databases[mode];
    customer = await read<CustomerState>(db, U.customer, "customer");
    subs = customer.subscriptions;
    shapes[mode] = planShape(subs);
  });

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
      expect(renewalDue(renewed[0], subs)).toBe(false);
      const next = renewals(renewed[0])[0];
      expect(next.status).toBe("active");
      expect(next.starts_on > renewed[0].ends_on).toBe(true);
    });

    it("trialActive: an active trial plan ahead that has not been continued", () => {
      const trials = subs.filter((s) => s.snapshot.trial && s.status === "active" && s.remaining >= 1);
      expect(trials.length).toBeGreaterThanOrEqual(1);
      const trial = trials.find((s) => s.starts_on > today && trialFollowUp({ ...s, remaining: 1 }, subs));
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

    it("no two active plans of one package overlap, as checkout's own rule requires", () => {
      const active = subs.filter((s) => s.status === "active");
      for (const a of active)
        for (const b of active)
          if (a.id < b.id && a.package_id === b.package_id)
            expect(a.starts_on > b.ends_on || b.starts_on > a.ends_on, a.snapshot.offer.name).toBe(true);
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

    it("paidLong: a real purchase of ten upcoming dates", async () => {
      const ahead = await checkoutIds(
        `state='paid' and subscription_id is not null and jsonb_array_length(quote->'dates')>6 and (quote->'dates'->>0)::date>'${today}'::date`,
      );
      expect(ahead.length).toBeGreaterThanOrEqual(1);
      for (const id of ahead) {
        const checkout = await checkoutRead(id);
        expect(checkout.quote.dates).toHaveLength(10);
        expect(checkout.quote.dates.every((d) => d > today)).toBe(true);
      }
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
      const month = await read<{ dates: unknown[] }>(db, U.customer, "customer-menu-month", {
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
      expect(
        subs.some((s) => s.snapshot.packageId === checkout.quote.packageId && s.starts_on === checkout.quote.dates[0]),
      ).toBe(false);
      const payment = await db.query<{ state: string }>("select state from v1.payments where checkout_id=$1", [ids[0]]);
      expect(payment.rows.map((r) => r.state)).toEqual(["paid"]);
    });
  });

  describe("kitchen loop carry-overs", () => {
    it("kitchenToday: one Dapur Senja delivery for Nadia today, both meals scheduled, no open report, six stops", async () => {
      const ops = await read<SellerOperationsState>(db, U.owner, "seller", { id: K[0] });
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
        // Nadia and five synthetic customers: the first three stops show, then "Lihat 3 alamat lainnya".
        expect(session.stops).toHaveLength(6);
        expect(session.stops.filter((s) => s.name === "Nadia Putri")).toHaveLength(1);
        expect(session.canCook).toBe(true);
        expect(session.journey.stage).toBe("scheduled");
        expect(deliveryRoute(ops, meal).slice(3)).toHaveLength(3);
      }
    });

    it("autoArrived: yesterday's last delivery was closed by the system, and nothing today is", async () => {
      const yesterday = customer.deliveries.filter((d) => d.service_date === addDays(today, -1));
      const auto = yesterday.filter((d) =>
        d.meals.every((m) => m.status === "delivered" && m.confirmed_by === "auto"),
      );
      expect(auto).toHaveLength(1);
      for (const m of auto[0].meals) expect(Date.parse(m.confirmed_at!)).not.toBeNaN();
      expect(auto[0].status).toBe("delivered");
      // The nightly auto-close only closes days before today, so no meal today may say the system closed it.
      const todays = customer.deliveries.filter((d) => d.service_date === today);
      expect(todays.flatMap((d) => d.meals).some((m) => m.confirmed_by === "auto")).toBe(false);
      const plates = todayPlates(customer, new Date());
      expect(plates.some((p) => p.journey.arrivedBy === "auto")).toBe(false);
      // The kitchen's lunch and dinner for Nadia, not yet cooked (a meal past its window reads "due").
      const kitchen = plates.filter((p) => p.packageName === "Rantang Nusantara");
      expect(kitchen.map((p) => p.meal)).toEqual(["lunch", "dinner"]);
      expect(kitchen.every((p) => ["scheduled", "due"].includes(p.state))).toBe(true);
    });
  });

  it("every added customer, address and package carries the synthetic wording", async () => {
    const demo = Object.values(U);
    const profiles = await db.query<{ id: string; name: string }>(
      "select id,name from v1.profiles where id<>all($1::uuid[]) order by name",
      [demo],
    );
    expect(profiles.rows).toHaveLength(5);
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
    // Nadia's addresses: the seed's home, the operating fixture's office and the states' Bandung address.
    const own = await db.query<{ label: string; instructions: string }>(
      "select label,instructions from v1.addresses where user_id=$1 order by label",
      [U.customer],
    );
    expect(own.rows.map((a) => a.label)).toEqual(["Kantor", "Rumah", "Rumah Bandung"]);
    for (const a of own.rows) expect(a.instructions).toMatch(/^Data sintetis/);
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

  it("Nadia has ten plans at three caterers", () => {
    expect(subs).toHaveLength(10);
    expect(new Set(customer.deliveries.map((d) => d.offer.catererId)).size).toBe(3);
  });
});

describe("the same states in every fresh demo database", () => {
  it("Nadia's plans have the same shape in memory and in a fresh stored database", () => {
    expect(shapes["in memory"]).toBeTruthy();
    expect(shapes["fresh stored"]).toEqual(shapes["in memory"]);
  });

  it("applies once: a second pass adds nothing", async () => {
    const db = databases["in memory"];
    const count = async () =>
      (
        await db.query<{ n: number }>(
          "select (select count(*) from v1.subscriptions)::int + (select count(*) from v1.checkouts)::int + (select count(*) from v1.delivery_days)::int + (select count(*) from v1.profiles)::int n",
        )
      ).rows[0].n;
    const before = await count();
    await applyDemoStates(db, { seeded: true, root: projectRoot() });
    expect(await count()).toBe(before);
  });

  it("a fresh stored demo database keeps its states once across restarts", async () => {
    const dir = await tempDir();
    const count = async (stored: PGlite) =>
      (
        await stored.query<{ n: number; marked: number }>(
          "select (select count(*) from v1.subscriptions)::int + (select count(*) from v1.checkouts)::int + (select count(*) from v1.delivery_days)::int n, (select count(*) from v1.audit where action='demo.synthetic_states')::int marked",
        )
      ).rows[0];
    let stored = await withDataDir(dir, () => createDemoDatabase());
    const first = await count(stored);
    await stored.close();
    stored = await withDataDir(dir, () => createDemoDatabase());
    expect(await count(stored)).toEqual(first);
    expect(first.marked).toBe(1);
    await stored.close();
  }, 120000);

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

describe("a stored demo database made before the states", () => {
  /** Row counts and record states that must not move when an older demo database is opened again. */
  const fingerprint = async (db: PGlite) =>
    (
      await db.query<Record<string, unknown>>(`select
        (select count(*) from v1.profiles)::int profiles, (select count(*) from v1.addresses)::int addresses,
        (select count(*) from v1.packages)::int packages, (select count(*) from v1.checkouts)::int checkouts,
        (select count(*) from v1.subscriptions)::int subscriptions, (select count(*) from v1.delivery_days)::int days,
        (select count(*) from v1.fulfillments)::int meals, (select count(*) from v1.payments)::int payments,
        (select count(*) from v1.reservations)::int reservations, (select count(*) from v1.notifications)::int notices,
        (select count(*) from v1.audit where action like 'demo.%')::int demo_marks,
        (select string_agg(id::text||':'||state,',' order by id) from v1.checkouts) checkout_states,
        (select string_agg(id::text||':'||status||':'||starts_on||':'||ends_on,',' order by id) from v1.subscriptions) plans`)
    ).rows[0];

  it("starts, gets no states, says how to reset once, and leaves its records as they were", async () => {
    // Made by the code before the states existed: the seed and the operating fixture only.
    const original = await tempDir();
    vi.resetModules();
    vi.doMock("../packages/backend/src/demo-states", async (load) => ({
      ...(await load<typeof import("../packages/backend/src/demo-states")>()),
      applyDemoStates: async () => {},
    }));
    const before = await import("../packages/backend/src/database");
    let db = await withDataDir(original, () => before.createDemoDatabase());
    // Used since: Nadia bought a trial and a plan of a package the states also buy, so replaying them would collide.
    const cmd = <T>(action: string, payload: object) =>
      before.localRpc<T>(db, U.customer, "catera_v1_command", [action, payload, crypto.randomUUID()]);
    for (const trial of [true, false]) {
      const c = await cmd<{ id: string }>("checkout.create", {
        acceptedTerms: true,
        packageId: P[3],
        addressId: ADDRESS_ID,
        portions: 1,
        startDate: addDays(today, trial ? 2 : 20),
        trial,
      });
      await cmd("checkout.demo_pay", { id: c.id });
    }
    const made = await fingerprint(db);
    await db.close();
    vi.doUnmock("../packages/backend/src/demo-states");
    vi.resetModules();
    const now = await import("../packages/backend/src/database");

    // Open a copy, as a developer's own .data/v1 would be opened by the new code, twice.
    const copy = await tempDir();
    await cp(original, copy, { recursive: true });
    const said = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      db = await withDataDir(copy, () => now.createDemoDatabase());
      expect(await fingerprint(db)).toEqual(made);
      await db.close();
      db = await withDataDir(copy, () => now.createDemoDatabase());
      expect(await fingerprint(db)).toEqual(made);
      expect(made.demo_marks).toBe(1); // the operating fixture's own mark, no states
      const states = await db.query("select 1 from v1.audit where action='demo.synthetic_states'");
      expect(states.rows).toHaveLength(0);
      const synthetic = await db.query("select 1 from v1.profiles where name like '%Contoh%'");
      expect(synthetic.rows).toHaveLength(0);
      // Nadia's own purchases are still hers and still readable.
      const customer = await now.localRpc<CustomerState>(db, U.customer, "catera_v1_read", ["customer", {}]);
      expect(customer.subscriptions.filter((s) => s.package_id === P[3])).toHaveLength(2);
      // One line per start, naming the folder and both ways to reset.
      const lines = said.mock.calls.map((c) => String(c[0]));
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain(copy);
      expect(lines[0]).toContain("CATERA_DEMO_DATA_DIR");
      await db.close();
    } finally {
      said.mockRestore();
    }
  }, 240000);
});
