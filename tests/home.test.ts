import { describe, expect, it } from "vitest";
import {
  activePlans,
  mealPlates,
  planLabel,
  todayPlates,
  upcomingDays,
  waitingItems,
  type CustomerActionItem,
  type CustomerState,
  type Delivery,
  type DeliveryMeal,
  type Offer,
  type Quote,
  type Subscription,
} from "@catera/domain";

// 2026-10-07 is a Wednesday; WIB = UTC+7. Every date below is built from this fixed clock.
const NOW = new Date("2026-10-07T10:00:00+07:00");
const TODAY = "2026-10-07";
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

const composition = [
  { id: "g-nasi", name: "Nasi", slots: 1 },
  { id: "g-lauk", name: "Lauk", slots: 1 },
  { id: "g-sayur", name: "Sayur", slots: 1 },
];
const dish = (id: string, name: string, groupId: string, over: Record<string, unknown> = {}) => ({
  id,
  name,
  description: "",
  image: "",
  serving: "",
  groupId,
  ...over,
});
const menu = (meal: "lunch" | "dinner", over: Record<string, unknown> = {}) => ({
  meal,
  name: `Menu ${meal}`,
  description: "",
  image: "",
  composition,
  items: [
    dish("i1", "Nasi putih", "g-nasi"),
    dish("i2", "Ayam bumbu rujak", "g-lauk", { categoryId: "main" }),
    dish("i3", "Sayur asem", "g-sayur"),
  ],
  ...over,
});
const offer = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Makan Siang Rumahan",
    caterer: "Dapur Bu Sari",
    image: "https://img/package.jpg",
    weekdays: [1, 2, 3, 4, 5],
    windows: { lunch: "11.00–13.00", dinner: "17.30–19.30" },
    menus: [menu("lunch", { image: "https://img/lunch.jpg" }), menu("dinner")],
    ...over,
  }) as unknown as Offer;

const quote = (over: Record<string, unknown> = {}, o: Offer = offer()) =>
  ({ packageId: "p1", portions: 1, trial: false, dates: [], offer: o, ...over }) as unknown as Quote;

const sub = (over: Partial<Subscription> & { trial?: boolean; offer?: Offer } = {}): Subscription => {
  const { trial, offer: o, ...rest } = over;
  return {
    id: "s1",
    package_id: "p1",
    portions: 1,
    starts_on: day(-9),
    ends_on: day(9),
    status: "active",
    remaining: 10,
    legacy: false,
    snapshot: quote({ trial: !!trial }, o ?? offer()),
    ...rest,
  } as unknown as Subscription;
};

let seq = 0;
const delivery = (date: string, meals: DeliveryMeal[] | null, over: Partial<Delivery> = {}, o: Offer = offer()): Delivery => {
  seq += 1;
  return {
    id: `d${seq}`,
    subscription_id: "s1",
    service_date: date,
    address: { id: "a1", label: "Rumah", line: "Jl. Kenanga", area: "Kemang", city: "Jakarta", instructions: "", version: 1 },
    status: "scheduled",
    version: 1,
    portions: 1,
    trial: false,
    offer: o,
    meals: meals as DeliveryMeal[],
    cutoff_at: `${date}T00:00:00Z`,
    canChange: false,
    ...over,
  };
};
const lunch = (over: Partial<DeliveryMeal> = {}): DeliveryMeal => ({ meal: "lunch", status: "scheduled", ...over });
const dinner = (over: Partial<DeliveryMeal> = {}): DeliveryMeal => ({ meal: "dinner", status: "scheduled", ...over });
const state = (deliveries: Delivery[], subscriptions: Subscription[] = []): CustomerState => ({
  subscriptions,
  deliveries,
  addresses: [],
  notifications: [],
  cases: [],
});

describe("Plate lead and sides", () => {
  it("lead is the main dish, not the rice", () => {
    const [plate] = todayPlates(state([delivery(TODAY, [lunch()])]), NOW);
    expect(plate.lead).toBe("Ayam bumbu rujak");
    expect(plate.sides).toEqual(["Nasi putih", "Sayur asem"]);
  });

  it("an unset menu has no lead", () => {
    const pending = offer({ menus: [menu("lunch", { selectionStatus: "pending" })] });
    const [plate] = todayPlates(state([delivery(TODAY, [lunch()], {}, pending)]), NOW);
    expect(plate.lead).toBeNull();
    expect(plate.sides).toEqual([]);
    const none = offer({ menus: [] });
    const [bare] = todayPlates(state([delivery(TODAY, [lunch()], {}, none)]), NOW);
    expect(bare.lead).toBeNull();
    expect(bare.sides).toEqual([]);
  });
});

describe("mealPlates", () => {
  it("two lunches stay two plates, in window order", () => {
    const early = offer({ id: "p2", name: "Lunch Pagi", windows: { lunch: "10.30–12.00", dinner: "17.30–19.30" } });
    const late = offer({ windows: { lunch: "12.00–14.00", dinner: "17.30–19.30" } });
    const plates = todayPlates(
      state([delivery(TODAY, [lunch(), dinner()], {}, late), delivery(TODAY, [lunch()], {}, early)]),
      NOW,
    );
    const { lunch: l, dinner: d } = mealPlates(plates);
    expect(l.map((p) => p.packageName)).toEqual(["Lunch Pagi", "Makan Siang Rumahan"]);
    expect(d).toHaveLength(1);
    expect(d[0].meal).toBe("dinner");
  });
});

describe("upcomingDays", () => {
  it("upcoming days group three deliveries of one day under one label", () => {
    const tomorrow = day(1);
    const other = offer({ id: "p2", name: "Katering Sehat", caterer: "Dapur Ani", windows: { lunch: "11.00–13.00", dinner: "18.30–20.00" } });
    const s = state([
      delivery(TODAY, [lunch()]),
      delivery(tomorrow, [dinner()], {}, other),
      delivery(tomorrow, [lunch(), dinner()]),
      delivery(day(3), [lunch()]),
      delivery(day(2), [lunch()], { status: "cancelled" }),
    ]);
    const days = upcomingDays(s, NOW, 5, "id");
    expect(days.map((d) => d.date)).toEqual([tomorrow, day(3)]);
    expect(days[0].label).toBe("Besok, Kamis 8 Okt");
    expect(days[0].meals).toHaveLength(3);
    expect(days[0].meals.map((m) => `${m.meal}:${m.packageName}`)).toEqual([
      "lunch:Makan Siang Rumahan",
      "dinner:Makan Siang Rumahan",
      "dinner:Katering Sehat",
    ]);
    expect(days[0].meals[0]).toMatchObject({
      catererName: "Dapur Bu Sari",
      lead: "Ayam bumbu rujak",
      image: "https://img/lunch.jpg",
      menuSet: true,
    });
    expect(upcomingDays(s, NOW, 1, "id").map((d) => d.date)).toEqual([tomorrow]);
  });

  it("a menu not yet set shows no dish and the package photo", () => {
    const pending = offer({ menus: [menu("lunch", { selectionStatus: "pending", image: "https://img/template.jpg" })] });
    const [first] = upcomingDays(state([delivery(day(1), [lunch()], {}, pending)]), NOW, 3, "id");
    expect(first.meals[0]).toMatchObject({ lead: null, menuSet: false, image: "https://img/package.jpg" });
  });

  it("changeUntil follows the cutoff while the day can change", () => {
    const open = delivery(day(2), [lunch()], { canChange: true, cutoff_at: new Date(NOW.getTime() + 3_600_000).toISOString() });
    const closed = delivery(day(3), [lunch()], { canChange: true, cutoff_at: new Date(NOW.getTime() - 3_600_000).toISOString() });
    const days = upcomingDays(state([open, closed]), NOW, 5, "id");
    expect(days[0].meals[0].changeUntil).toBe("hari ini 11.00");
    expect(days[1].meals[0].changeUntil).toBeNull();
  });
});

describe("waitingItems", () => {
  const due = (id: string, date: string, over: Partial<CustomerActionItem> = {}): CustomerActionItem => ({
    id,
    kind: "menu_choice_due",
    status: "selection_due",
    priority: 1,
    dueAt: `${date}T10:00:00Z`,
    serviceDate: date,
    meal: "lunch",
    packageName: "Makan Siang Rumahan",
    href: `/subscriptions/s-1/menu?date=${date}&meal=lunch`,
    ...over,
  });

  it("menu rows group a plan's due dates and sort by deadline", () => {
    // Katering Sehat (s-2) arrives first but closes later than s-1's soonest day, so only the sort puts s-1 first.
    const actions = [
      due("c", day(3), {
        dueAt: `${day(2)}T10:00:00Z`,
        packageName: "Katering Sehat",
        href: `/subscriptions/s-2/menu?date=${day(3)}&meal=lunch`,
      }),
      due("a", day(6), { dueAt: `${day(5)}T10:00:00Z` }),
      due("b", day(2), { dueAt: `${day(1)}T10:00:00Z` }),
      due("d", day(4), { dueAt: `${day(3)}T10:00:00Z` }),
      due("e", day(9), { kind: "payment_action", status: "awaiting_payment" }),
      due("f", day(9), { status: "open" }),
    ];
    const rows = waitingItems(state([]), actions, NOW);
    expect(rows).toEqual([
      {
        kind: "menu",
        subscriptionId: "s-1",
        packageName: "Makan Siang Rumahan",
        dates: [day(2), day(4), day(6)],
        deadline: `${day(1)}T10:00:00Z`,
        href: `/subscriptions/s-1/menu?date=${day(2)}&meal=lunch`,
      },
      {
        kind: "menu",
        subscriptionId: "s-2",
        packageName: "Katering Sehat",
        dates: [day(3)],
        deadline: `${day(2)}T10:00:00Z`,
        href: `/subscriptions/s-2/menu?date=${day(3)}&meal=lunch`,
      },
    ]);
  });

  it("a menu row links to its soonest due date, whatever order the actions arrive in", () => {
    const rows = waitingItems(state([]), [due("late", day(5)), due("soon", day(2)), due("mid", day(3))], NOW);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.kind === "menu" && row.href).toBe(`/subscriptions/s-1/menu?date=${day(2)}&meal=lunch`);
  });

  it("offline: no menu rows", () => {
    const renew = sub({ remaining: 2 });
    const rows = waitingItems(state([], [renew]), null, NOW);
    expect(rows.some((r) => r.kind === "menu")).toBe(false);
    expect(rows.map((r) => r.kind)).toEqual(["renew"]);
  });

  it("orders menu, renew, trial, then review", () => {
    const renewing = sub({ id: "s-renew", remaining: 2 });
    const trialing = sub({ id: "s-trial", package_id: "p9", remaining: 1, trial: true, starts_on: day(-3) });
    const reviewing = sub({
      id: "s-review",
      package_id: "p8",
      remaining: 3,
      status: "completed",
      snapshot: quote({ trial: true, packageId: "p8" }),
    });
    const delivered = delivery(day(-1), [lunch({ status: "delivered" })], { subscription_id: "s-review", status: "delivered" });
    const rows = waitingItems(
      state([delivered], [renewing, trialing, reviewing]),
      [{ ...({} as CustomerActionItem), id: "m", kind: "menu_choice_due", status: "selection_due", priority: 1, serviceDate: day(2), dueAt: `${day(1)}T10:00:00Z`, href: "/subscriptions/s-renew/menu", packageName: "X" }],
      NOW,
    );
    expect(rows.map((r) => r.kind)).toEqual(["menu", "renew", "trial", "review"]);
    const review = rows[3];
    expect(review.kind === "review" && review.subscription.id).toBe("s-review");
  });

  it("the review candidate needs a delivered day and not a cancelled plan", () => {
    const soon = sub({ id: "s-soon", remaining: 3, snapshot: quote({ trial: true }) });
    const noDelivery = waitingItems(state([], [soon]), [], NOW);
    expect(noDelivery.map((r) => r.kind)).toEqual([]);
    const delivered = delivery(day(-1), [lunch({ status: "delivered" })], { subscription_id: "s-soon", status: "delivered" });
    expect(waitingItems(state([delivered], [soon]), [], NOW).map((r) => r.kind)).toEqual(["review"]);
    const cancelled = sub({ id: "s-soon", remaining: 3, status: "cancelled", snapshot: quote({ trial: true }) });
    expect(waitingItems(state([delivered], [cancelled]), [], NOW)).toEqual([]);
  });
});

describe("activePlans", () => {
  it("activePlans counts active plans only", () => {
    const other = offer({ id: "p2", name: "Katering Sehat", caterer: "Dapur Ani", image: "https://img/two.jpg" });
    const subs = [
      sub({ id: "a" }),
      sub({ id: "b", snapshot: quote({}, other) }),
      sub({ id: "c", snapshot: quote({}, other) }),
      sub({ id: "d", status: "completed" }),
      sub({ id: "e", status: "cancelled" }),
    ];
    expect(activePlans(state([], subs))).toEqual({
      count: 3,
      caterers: ["Dapur Bu Sari", "Dapur Ani"],
      images: ["https://img/package.jpg", "https://img/two.jpg"],
    });
    expect(activePlans(state([], []))).toEqual({ count: 0, caterers: [], images: [] });
  });

  it("shows at most three photos", () => {
    const subs = [1, 2, 3, 4, 5].map((n) =>
      sub({ id: `s${n}`, snapshot: quote({}, offer({ id: `p${n}`, caterer: `Dapur ${n}`, image: `https://img/${n}.jpg` })) }),
    );
    const plans = activePlans(state([], subs));
    expect(plans.count).toBe(5);
    expect(plans.images).toEqual(["https://img/1.jpg", "https://img/2.jpg", "https://img/3.jpg"]);
  });
});

describe("planLabel", () => {
  it("duplicate plan names carry their date range", () => {
    const a = sub({ id: "a", starts_on: "2026-10-12", ends_on: "2026-10-23" });
    const b = sub({ id: "b", starts_on: "2026-10-26", ends_on: "2026-11-06" });
    const c = sub({ id: "c", starts_on: "2026-10-01", ends_on: "2026-10-09", snapshot: quote({}, offer({ name: "Katering Sehat" })) });
    const all = [a, b, c];
    expect(planLabel(a, all, "id")).toBe("Makan Siang Rumahan · 12–23 Okt");
    expect(planLabel(b, all, "id")).toBe("Makan Siang Rumahan · 26 Okt–6 Nov");
    expect(planLabel(c, all, "id")).toBe("Katering Sehat");
  });

  it("a one-day plan shows its single day, not a range", () => {
    const a = sub({ id: "a", starts_on: "2026-10-10", ends_on: "2026-10-10" });
    const b = sub({ id: "b", starts_on: "2026-10-12", ends_on: "2026-10-12" });
    const c = sub({ id: "c", starts_on: "2026-10-13", ends_on: "2026-10-26" });
    const all = [a, b, c];
    expect(planLabel(a, all, "id")).toBe("Makan Siang Rumahan · 10 Okt");
    expect(planLabel(b, all, "en")).toBe("Makan Siang Rumahan · 12 Oct");
    expect(planLabel(c, all, "id")).toBe("Makan Siang Rumahan · 13–26 Okt");
  });

  it("builds ranges from the calendar date, in either locale", () => {
    const a = sub({ id: "a", starts_on: "2026-12-28", ends_on: "2027-01-08" });
    const b = sub({ id: "b", starts_on: "2026-05-01", ends_on: "2026-05-09" });
    expect(planLabel(a, [a, b], "id")).toBe("Makan Siang Rumahan · 28 Des–8 Jan");
    expect(planLabel(a, [a, b], "en")).toBe("Makan Siang Rumahan · 28 Dec–8 Jan");
    expect(planLabel(b, [a, b], "id")).toBe("Makan Siang Rumahan · 1–9 Mei");
  });

  it("a finished plan with the same name does not force a range", () => {
    const a = sub({ id: "a" });
    const old = sub({ id: "old", status: "completed" });
    expect(planLabel(a, [a, old], "id")).toBe("Makan Siang Rumahan");
  });
});
