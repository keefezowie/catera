import {
  addDays,
  jakartaDay,
  type CustomerActionItem,
  type CustomerState,
  type Delivery,
  type DeliveryMeal,
  type Offer,
  type Subscription,
} from "@catera/domain";

/** Synthetic customer data for the Beranda tests; no real people or phone numbers. */
export const TODAY = jakartaDay(new Date());

export function offer(extra: Partial<Offer> = {}): Offer {
  return {
    id: "p-rumahan",
    slug: "makan-siang-rumahan",
    catererId: "k-1",
    caterer: "Dapur Contoh",
    catererSlug: "dapur-contoh",
    name: "Makan Siang Rumahan",
    description: "",
    price: 30000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    image: "https://images.example.test/rumahan.jpg",
    tags: [],
    trialPrice: null,
    trialMax: null,
    tiers: [],
    capacity: {},
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    areas: ["Tebet"],
    cutoff: "17:00",
    timezone: "Asia/Jakarta",
    menus: [
      {
        meal: "lunch",
        name: "Ayam bakar",
        description: "",
        image: "",
        items: [
          { id: "i-1", name: "Ayam bakar madu" },
          { id: "i-2", name: "Sayur asem" },
        ],
      } as unknown as Offer["menus"][number],
    ],
    rating: null,
    reviewCount: 0,
    status: "published",
    sellerStatus: "active",
    version: 1,
    ...extra,
  };
}

export function subscription(extra: Partial<Subscription> = {}): Subscription {
  return {
    id: "s-1",
    package_id: "p-rumahan",
    snapshot: { offer: offer(), total: 150000 } as unknown as Subscription["snapshot"],
    portions: 1,
    starts_on: addDays(TODAY, -3),
    ends_on: addDays(TODAY, 6),
    status: "active",
    remaining: 6,
    legacy: false,
    ...extra,
  };
}

export function delivery(
  id: string,
  date: string,
  meal: Partial<DeliveryMeal> = {},
  extra: Partial<Delivery> = {},
): Delivery {
  const status = meal.status ?? "scheduled";
  return {
    id,
    subscription_id: "s-1",
    service_date: date,
    address: {
      id: "a-1",
      label: "Kantor",
      line: "Jl. Contoh No. 1",
      area: "Tebet",
      city: "Jakarta Selatan",
      instructions: "",
      version: 1,
    },
    status: status === "out_for_delivery" ? "scheduled" : status,
    version: 1,
    portions: 1,
    trial: false,
    offer: offer(),
    meals: [{ meal: "lunch", status, ...meal }],
    cutoff_at: `${addDays(date, -1)}T10:00:00Z`,
    canChange: true,
    ...extra,
  };
}

export function customerState(
  today: Partial<DeliveryMeal> | null,
  extra: { subscription?: Partial<Subscription>; past?: Delivery[]; catererPhone?: string } = {},
): CustomerState {
  const { catererPhone } = extra;
  const withPhone = (d: Delivery): Delivery => (catererPhone ? { ...d, catererPhone } : d);
  return {
    subscriptions: [subscription(extra.subscription)],
    deliveries: [
      ...(extra.past ?? []),
      ...(today ? [delivery("d-today", TODAY, today)] : []),
      delivery("d-next-1", addDays(TODAY, 1)),
      delivery("d-next-2", addDays(TODAY, 2)),
      delivery("d-next-3", addDays(TODAY, 3)),
      delivery("d-next-4", addDays(TODAY, 4)),
    ].map(withPhone),
    addresses: [],
    notifications: [],
    cases: [],
  };
}

/* Phase E, Task 10: Beranda for several plans. Synthetic plans, kitchens and dates only. */

/** The day the demo customer is seen on in the Beranda captures: Saturday 10 October 2026, Jakarta. */
export const DEMO_TODAY = "2026-10-10";

/** 09.00 Jakarta on `day`: Siang by default, and every lunch window of the fixtures still to come. */
export const morningOf = (day: string) => new Date(`${day}T02:00:00Z`);

/** 17.00 Jakarta on `day`: Malam by default. */
export const eveningOf = (day: string) => new Date(`${day}T10:00:00Z`);

type MenuItem = Offer["menus"][number];

/** A set menu for one meal. Items may carry a category; a `main` one is the lead dish. */
export function menu(meal: "lunch" | "dinner", names: (string | { name: string; categoryId: string })[]): MenuItem {
  const items = names.map((n, i) => (typeof n === "string" ? { id: `${meal}-${i}`, name: n } : { id: `${meal}-${i}`, ...n }));
  return { meal, name: items[0].name, description: "", image: "", items } as unknown as MenuItem;
}

/** A menu the caterer has not set yet: the customer still has to pick. */
export const pendingMenu = (meal: "lunch" | "dinner"): MenuItem =>
  ({ meal, name: "", description: "", image: "", items: [], selectionStatus: "pending" }) as unknown as MenuItem;

type PlanOptions = {
  name: string;
  caterer: string;
  meal?: "lunch" | "dinner";
  remaining?: number;
  trial?: boolean;
  today?: string;
  menus?: MenuItem[];
  image?: string;
} & Partial<Omit<Subscription, "snapshot">>;

/** One running plan with its own offer: name, kitchen, meal, photo and days left. */
export function plan(id: string, options: PlanOptions): Subscription {
  const { name, caterer, meal = "lunch", remaining = 6, trial = false, today = TODAY, menus, image, ...extra } = options;
  const planOffer = offer({
    id: `p-${id}`,
    name,
    caterer,
    meal,
    image: image ?? `https://images.example.test/${id}.jpg`,
    menus:
      menus ?? [menu(meal, meal === "lunch" ? ["Ayam bakar madu", "Sayur asem"] : ["Sate ayam madura", "Tumis kangkung"])],
  });
  const snapshot = { offer: planOffer, total: planOffer.price * planOffer.days, ...(trial ? { trial: true } : {}) };
  return subscription({
    id,
    package_id: `p-${id}`,
    snapshot: snapshot as unknown as Subscription["snapshot"],
    starts_on: addDays(today, -3),
    ends_on: addDays(today, Math.max(0, remaining - 1)),
    remaining,
    ...extra,
  });
}

/** A delivery of `sub` on `date` for the plan's meal, carrying the plan's own offer. */
export function planDelivery(
  sub: Subscription,
  date: string,
  meal: Partial<DeliveryMeal> = {},
  extra: Partial<Delivery> = {},
): Delivery {
  const planOffer = sub.snapshot.offer;
  return delivery(
    `d-${sub.id}-${date}`,
    date,
    { meal: planOffer.meal === "dinner" ? "dinner" : "lunch", ...meal },
    { subscription_id: sub.id, offer: planOffer, ...extra },
  );
}

/** A menu choice the action read says is due, linking to the plan's menu screen for that date. */
export function menuDue(sub: Subscription, date: string, dueAt: string): CustomerActionItem {
  const meal = sub.snapshot.offer.meal === "dinner" ? "dinner" : "lunch";
  return {
    id: `menu-${sub.id}-${date}-${meal}`,
    kind: "menu_choice_due",
    status: "selection_due",
    priority: 1,
    dueAt,
    serviceDate: date,
    meal,
    packageName: sub.snapshot.offer.name,
    catererName: sub.snapshot.offer.caterer,
    href: `/subscriptions/${sub.id}/menu?date=${date}&meal=${meal}`,
  };
}

const stateOf = (subscriptions: Subscription[], deliveries: Delivery[]): CustomerState => ({
  subscriptions,
  deliveries,
  addresses: [],
  notifications: [],
  cases: [],
});

/** Changes close at 17.00 Jakarta the day before. */
const dueBefore = (date: string) => `${addDays(date, -1)}T10:00:00Z`;

/**
 * The demo customer as seen on a day with deliveries: two lunches from two kitchens (Dapur Senja's first by window),
 * one dinner, three menu rows due (one day, two days, three days), a plan to renew that also asks for a review, and
 * two trials ending (today and tomorrow). Six running plans.
 */
export function demoCustomer(today = DEMO_TODAY): { state: CustomerState; actions: CustomerActionItem[] } {
  const kantor = plan("s-kantor", { name: "Makan Siang Kantor", caterer: "Dapur Senja", remaining: 9, today });
  // "Nasi putih" comes first on Rumahan's menu, but the main dish (the lead) is Rendang sapi.
  const rumahan = plan("s-rumahan", {
    name: "Makan Siang Rumahan",
    caterer: "Dapur Contoh",
    remaining: 6,
    today,
    menus: [menu("lunch", ["Nasi putih", { name: "Rendang sapi", categoryId: "main" }, "Sayur asem"])],
  });
  rumahan.snapshot.offer.windows = { lunch: "12.00–13.30", dinner: "17.00–19.00" };
  const malam = plan("s-malam", { name: "Makan Malam Hemat", caterer: "Dapur Bulan", meal: "dinner", remaining: 12, today });
  const sehat = plan("s-sehat", { name: "Paket Sehat", caterer: "Dapur Hijau", remaining: 2, today });
  const coba1 = plan("s-coba-1", { name: "Coba Nasi Bakar", caterer: "Dapur Arang", remaining: 1, trial: true, today });
  const coba2 = plan("s-coba-2", {
    name: "Coba Bento",
    caterer: "Dapur Kecil",
    remaining: 1,
    trial: true,
    today,
    ends_on: addDays(today, 1),
  });
  const deliveries = [
    planDelivery(kantor, today),
    planDelivery(rumahan, today),
    planDelivery(malam, today),
    planDelivery(sehat, addDays(today, -1), { status: "delivered" }, { status: "delivered" }),
    planDelivery(kantor, addDays(today, 2)),
    planDelivery(rumahan, addDays(today, 2)),
    planDelivery(malam, addDays(today, 2)),
    planDelivery(kantor, addDays(today, 3)),
    planDelivery(sehat, addDays(today, 4)),
    planDelivery(kantor, addDays(today, 5)),
  ];
  const actions = [
    menuDue(kantor, addDays(today, 3), dueBefore(addDays(today, 3))),
    menuDue(rumahan, addDays(today, 4), dueBefore(addDays(today, 4))),
    menuDue(rumahan, addDays(today, 5), dueBefore(addDays(today, 5))),
    menuDue(malam, addDays(today, 6), dueBefore(addDays(today, 6))),
    menuDue(malam, addDays(today, 7), dueBefore(addDays(today, 7))),
    menuDue(malam, addDays(today, 8), dueBefore(addDays(today, 8))),
  ];
  return { state: stateOf([kantor, rumahan, malam, sehat, coba1, coba2], deliveries), actions };
}

/** One plan, one lunch today, nothing waiting. */
export function onePlanOneMeal(today = DEMO_TODAY): CustomerState {
  const only = plan("s-1", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", remaining: 8, today });
  return stateOf([only], [planDelivery(only, today), planDelivery(only, addDays(today, 2)), planDelivery(only, addDays(today, 3))]);
}

/** A Saturday with nothing delivered today; the next delivery is Monday. `saturday` must be a Saturday. */
export function quietSaturday(saturday = DEMO_TODAY): CustomerState {
  const only = plan("s-1", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", remaining: 8, today: saturday });
  return stateOf([only], [planDelivery(only, addDays(saturday, 2)), planDelivery(only, addDays(saturday, 3))]);
}

/** Eight running plans; two carry the same name ("Makan Siang Kantor") over different dates. */
export function eightPlans(today = DEMO_TODAY): CustomerState {
  const subs = [
    plan("s-a", { name: "Makan Siang Kantor", caterer: "Dapur Senja", today, starts_on: "2026-10-05", ends_on: "2026-10-16" }),
    plan("s-b", { name: "Makan Siang Kantor", caterer: "Dapur Senja", today, starts_on: "2026-10-19", ends_on: "2026-10-30" }),
    plan("s-c", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", today }),
    plan("s-d", { name: "Makan Malam Hemat", caterer: "Dapur Bulan", meal: "dinner", today }),
    plan("s-e", { name: "Paket Sehat", caterer: "Dapur Hijau", today }),
    plan("s-f", { name: "Paket Keluarga", caterer: "Dapur Contoh", today }),
    plan("s-g", { name: "Bento Anak", caterer: "Dapur Kecil", today }),
    plan("s-h", { name: "Nasi Bakar", caterer: "Dapur Arang", today }),
  ];
  return stateOf(subs, [planDelivery(subs[0], addDays(today, 2))]);
}
