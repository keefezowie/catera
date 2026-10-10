import { describe, expect, it } from "vitest";
import {
  paidSummary,
  planDetail,
  recapCandidates,
  type Checkout,
  type CustomerState,
  type Delivery,
  type DeliveryMeal,
  type Offer,
  type Quote,
  type Subscription,
} from "@catera/domain";

// 2026-10-07 is a Wednesday; WIB = UTC+7. Every date below is relative to this pinned clock.
const NOW = new Date("2026-10-07T10:00:00+07:00");

const offer = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Makan Siang Rumahan",
    caterer: "Dapur Bu Sari",
    image: "https://img/package.jpg",
    weekdays: [1, 2, 3, 4, 5],
    windows: { lunch: "11.00-13.00", dinner: "17.30-19.30" },
    menus: [],
    ...over,
  }) as unknown as Offer;

const quote = (over: Record<string, unknown> = {}, o: Offer = offer()) =>
  ({ packageId: "p1", portions: 1, trial: false, dates: [], offer: o, ...over }) as unknown as Quote;

const sub = (over: Partial<Subscription> & { trial?: boolean } = {}): Subscription => {
  const { trial, ...rest } = over;
  return {
    id: "s1",
    package_id: "p1",
    portions: 1,
    starts_on: "2026-09-28",
    ends_on: "2026-10-16",
    status: "active",
    remaining: 10,
    legacy: false,
    snapshot: quote({ trial: !!trial }),
    ...rest,
  } as unknown as Subscription;
};

let seq = 0;
const delivery = (subscriptionId: string, date: string, over: Partial<Delivery> = {}): Delivery => {
  seq += 1;
  return {
    id: `d${seq}`,
    subscription_id: subscriptionId,
    service_date: date,
    address: {
      id: "a1",
      label: "Rumah",
      line: "Jl. Kenanga",
      area: "Kemang",
      city: "Jakarta",
      instructions: "",
      version: 1,
    },
    status: "scheduled",
    version: 1,
    portions: 1,
    trial: false,
    offer: offer(),
    meals: [{ meal: "lunch", status: "scheduled" }],
    cutoff_at: "2026-10-06T10:00:00Z",
    canChange: false,
    ...over,
  } as Delivery;
};

const state = (subscriptions: Subscription[], deliveries: Delivery[] = []): CustomerState => ({
  subscriptions,
  deliveries,
  addresses: [],
  notifications: [],
  cases: [],
});

describe("planDetail", () => {
  it("is null for an unknown id", () => {
    expect(planDetail(state([sub()]), "nope", NOW, "id")).toBeNull();
  });

  it("carries the plan, its offer, status, remaining and dates", () => {
    const s = sub({ remaining: 7 });
    expect(planDetail(state([s]), "s1", NOW, "id")).toMatchObject({
      sub: s,
      offer: s.snapshot.offer,
      status: "active",
      remaining: 7,
      startsOn: "2026-09-28",
      endsOn: "2026-10-16",
    });
    expect(planDetail(state([sub({ status: "completed", remaining: 0 })]), "s1", NOW, "id")?.status).toBe("completed");
    expect(planDetail(state([sub({ status: "cancelled" })]), "s1", NOW, "id")?.status).toBe("other");
  });

  it("lists only this plan's upcoming rows, at most 5, in date order", () => {
    const mine = ["2026-10-14", "2026-10-09", "2026-10-13", "2026-10-08", "2026-10-12", "2026-10-15", "2026-10-16"];
    const rows = [
      ...mine.map((d) => delivery("s1", d)),
      delivery("s2", "2026-10-08"),
      delivery("s1", "2026-10-06"), // past
      delivery("s1", "2026-10-10", { status: "cancelled" }),
    ];
    const detail = planDetail(state([sub(), sub({ id: "s2" })], rows), "s1", NOW, "id");
    expect(detail?.upcoming.map((r) => r.date)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    const ids = new Set(rows.filter((d) => d.subscription_id === "s1").map((d) => d.id));
    expect(detail?.upcoming.every((r) => ids.has(r.deliveryId))).toBe(true);
  });

  describe("today's day under Berikutnya", () => {
    const TODAY = "2026-10-07";

    it("comes first while a meal of it is not delivered, labelled the way Beranda labels today", () => {
      const today = delivery("s1", TODAY, {
        meals: [
          { meal: "lunch", status: "delivered" },
          { meal: "dinner", status: "scheduled" },
        ],
      });
      const rows = [delivery("s1", "2026-10-08"), today];
      const detail = planDetail(state([sub()], rows), "s1", NOW, "id");
      expect(detail?.upcoming.map((r) => r.date)).toEqual([TODAY, "2026-10-08"]);
      expect(detail?.upcoming[0]).toMatchObject({ deliveryId: today.id, label: "Rabu 7 Okt" });
    });

    it("is left out once every meal of it is delivered or cancelled, and when the day is cancelled", () => {
      const done = (meals: { meal: "lunch" | "dinner"; status: string }[], over: Partial<Delivery> = {}) =>
        planDetail(state([sub()], [delivery("s1", TODAY, { meals, ...over })]), "s1", NOW, "id")?.upcoming;
      expect(done([{ meal: "lunch", status: "delivered" }])).toEqual([]);
      expect(
        done([
          { meal: "lunch", status: "delivered" },
          { meal: "dinner", status: "cancelled" },
        ]),
      ).toEqual([]);
      expect(done([{ meal: "lunch", status: "scheduled" }], { status: "cancelled" })).toEqual([]);
    });

    it("is left out when today's meal failed or has an open report, as Beranda counts them done", () => {
      const upcoming = (meals: DeliveryMeal[]) =>
        planDetail(state([sub()], [delivery("s1", TODAY, { meals })]), "s1", NOW, "id")?.upcoming;
      // The caterer marked it "Gagal diantar".
      expect(upcoming([{ meal: "lunch", status: "issue" }])).toEqual([]);
      // The customer reported it and the report is still open.
      expect(upcoming([{ meal: "lunch", status: "delivered", issue: { id: "c1", status: "open" } }])).toEqual([]);
      expect(upcoming([{ meal: "lunch", status: "scheduled", issue: { id: "c2", status: "open" } }])).toEqual([]);
      // A meal still on its way beside them keeps the day listed.
      expect(
        upcoming([
          { meal: "lunch", status: "issue" },
          { meal: "dinner", status: "out_for_delivery" },
        ])?.map((r) => r.date),
      ).toEqual([TODAY]);
    });

    it("counts toward the limit of 5", () => {
      const later = ["2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"];
      const rows = [...later.map((d) => delivery("s1", d)), delivery("s1", TODAY)];
      const detail = planDetail(state([sub()], rows), "s1", NOW, "id");
      expect(detail?.upcoming.map((r) => r.date)).toEqual([TODAY, "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13"]);
    });
  });

  describe("action", () => {
    it("renew to /renew/{id} for an active full plan with 3 or fewer days left and no renewal", () => {
      expect(planDetail(state([sub({ remaining: 3 })]), "s1", NOW, "id")?.action).toEqual({
        kind: "renew",
        href: "/renew/s1",
      });
    });

    it("none for an active plan with 10 days left", () => {
      expect(planDetail(state([sub({ remaining: 10 })]), "s1", NOW, "id")?.action).toEqual({ kind: "none" });
    });

    it("renew for a completed full plan with no renewal", () => {
      const s = sub({ status: "completed", remaining: 0, ends_on: "2026-10-06" });
      expect(planDetail(state([s]), "s1", NOW, "id")?.action).toEqual({ kind: "renew", href: "/renew/s1" });
    });

    it("a cancelled renewal does not count: the plan can be renewed again", () => {
      const old = sub({ remaining: 2 });
      const cancelled = sub({ id: "s2", renewed_from: "s1", status: "cancelled" });
      expect(planDetail(state([old, cancelled]), "s1", NOW, "id")?.action).toEqual({
        kind: "renew",
        href: "/renew/s1",
      });
    });

    it("renewed, never renew, once another non-cancelled plan renews it (Review Focus 2)", () => {
      const next = sub({ id: "s2", renewed_from: "s1", remaining: 12 });
      expect(planDetail(state([sub({ remaining: 2 }), next]), "s1", NOW, "id")?.action).toEqual({ kind: "renewed" });
      const done = sub({ status: "completed", remaining: 0 });
      expect(planDetail(state([done, next]), "s1", NOW, "id")?.action).toEqual({ kind: "renewed" });
    });

    it("none for a cancelled plan", () => {
      expect(planDetail(state([sub({ status: "cancelled", remaining: 2 })]), "s1", NOW, "id")?.action).toEqual({
        kind: "none",
      });
    });

    it("trial to /paket/{package_id} for a trial, carrying the package name as its title", () => {
      expect(planDetail(state([sub({ trial: true, remaining: 1 })]), "s1", NOW, "id")?.action).toEqual({
        kind: "trial",
        href: "/paket/p1?title=Makan%20Siang%20Rumahan",
      });
    });

    it("trial none once a later non-cancelled plan for the same package exists (Ruling P2)", () => {
      const trial = sub({ trial: true, remaining: 1 });
      const later = sub({ id: "s3", starts_on: "2026-10-05", remaining: 15 });
      expect(planDetail(state([trial, later]), "s1", NOW, "id")?.action).toEqual({ kind: "none" });
      // A cancelled later plan, an earlier plan and a plan of another package do not block it.
      const cancelled = sub({ id: "s4", starts_on: "2026-10-05", status: "cancelled" });
      const earlier = sub({ id: "s5", starts_on: "2026-09-01" });
      const other = sub({ id: "s6", package_id: "p9", starts_on: "2026-10-05" });
      expect(planDetail(state([trial, cancelled, earlier, other]), "s1", NOW, "id")?.action).toEqual({
        kind: "trial",
        href: "/paket/p1?title=Makan%20Siang%20Rumahan",
      });
    });

    it("trial none for a cancelled trial", () => {
      expect(planDetail(state([sub({ trial: true, status: "cancelled" })]), "s1", NOW, "id")?.action).toEqual({
        kind: "none",
      });
    });
  });
});

describe("recapCandidates", () => {
  const done = (id: string, endsOn: string, over: Partial<Subscription> & { trial?: boolean } = {}) =>
    sub({ id, status: "completed", remaining: 0, starts_on: "2026-08-01", ends_on: endsOn, ...over });

  it("includes a completed full plan that ended yesterday in Jakarta", () => {
    const s = done("s1", "2026-10-06");
    expect(recapCandidates(state([s]), NOW).map((x) => x.id)).toEqual(["s1"]);
  });

  it("keeps a plan that ended 14 days ago and drops one that ended 15 days ago", () => {
    const in14 = done("s14", "2026-09-23");
    const out15 = done("s15", "2026-09-22");
    expect(recapCandidates(state([in14, out15]), NOW).map((x) => x.id)).toEqual(["s14"]);
  });

  it("counts days in Jakarta, not UTC (01:00 WIB is still the previous UTC day)", () => {
    const earlyJakarta = new Date("2026-10-06T18:00:00Z"); // 2026-10-07 01:00 WIB
    const out15 = done("s15", "2026-09-22");
    expect(recapCandidates(state([out15]), earlyJakarta)).toEqual([]);
  });

  it("never offers a plan that ended months ago (Review Focus 5)", () => {
    expect(recapCandidates(state([done("old", "2026-04-07")]), NOW)).toEqual([]);
  });

  it("excludes a trial, a renewed plan, an active plan and a cancelled plan", () => {
    const trial = done("trial", "2026-10-06", { trial: true });
    const renewed = done("renewed", "2026-10-06");
    const renewal = sub({ id: "next", renewed_from: "renewed", starts_on: "2026-10-07", ends_on: "2026-10-30" });
    const active = sub({ id: "active", ends_on: "2026-10-06", remaining: 0 });
    const cancelled = sub({ id: "cancelled", status: "cancelled", ends_on: "2026-10-06" });
    expect(recapCandidates(state([trial, renewed, renewal, active, cancelled]), NOW)).toEqual([]);
  });

  it("a cancelled renewal does not hide the recap", () => {
    const s = done("s1", "2026-10-06");
    const cancelled = sub({ id: "s2", renewed_from: "s1", status: "cancelled" });
    expect(recapCandidates(state([s, cancelled]), NOW).map((x) => x.id)).toEqual(["s1"]);
  });

  it("lists the most recently ended plan first", () => {
    const a = done("a", "2026-10-01");
    const b = done("b", "2026-10-06");
    expect(recapCandidates(state([a, b]), NOW).map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("paidSummary", () => {
  const checkout = (over: Partial<Checkout> = {}, q: Quote = quote()): Checkout =>
    ({
      id: "c1",
      state: "paid",
      subscription_id: "s1",
      quote: q,
      expires_at: "2026-10-08T00:00:00Z",
      payment_url: null,
      ...over,
    }) as unknown as Checkout;

  it("is null while pending and for a paid checkout with no subscription id yet (Review Focus 4)", () => {
    expect(paidSummary(checkout({ state: "pending" }))).toBeNull();
    expect(paidSummary(checkout({ subscription_id: null }))).toBeNull();
  });

  it("sorts the dates, keeps the first 6 and counts the rest", () => {
    const dates = [
      "2026-10-14",
      "2026-10-08",
      "2026-10-13",
      "2026-10-09",
      "2026-10-12",
      "2026-10-15",
      "2026-10-16",
      "2026-10-19",
      "2026-10-10",
    ];
    const summary = paidSummary(checkout({}, quote({ dates })));
    expect(summary).toMatchObject({
      subscriptionId: "s1",
      offerName: "Makan Siang Rumahan",
      caterer: "Dapur Bu Sari",
      firstDate: "2026-10-08",
      more: 3,
    });
    expect(summary?.dates).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    // The input stays untouched.
    expect(dates[0]).toBe("2026-10-14");
  });

  it("reports no more dates when there are 6 or fewer", () => {
    const summary = paidSummary(checkout({}, quote({ dates: ["2026-10-09", "2026-10-08"] })));
    expect(summary?.dates).toEqual(["2026-10-08", "2026-10-09"]);
    expect(summary?.more).toBe(0);
  });

  it("menuChoice follows menuSelectionMode customer", () => {
    expect(paidSummary(checkout({}, quote({}, offer({ menuSelectionMode: "customer" }))))?.menuChoice).toBe(true);
    expect(paidSummary(checkout({}, quote({}, offer({ menuSelectionMode: "caterer" }))))?.menuChoice).toBe(false);
    expect(paidSummary(checkout())?.menuChoice).toBe(false);
  });

  it("uses the first menu's cover photo, else the package photo", () => {
    const menu = { meal: "lunch", name: "Menu", description: "", image: "https://img/menu.jpg", items: [] };
    expect(paidSummary(checkout({}, quote({}, offer({ menus: [menu] }))))?.image).toBe("https://img/menu.jpg");
    expect(paidSummary(checkout())?.image).toBe("https://img/package.jpg");
  });
});
