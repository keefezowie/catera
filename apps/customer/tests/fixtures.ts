import { addDays, jakartaDay, type CustomerState, type Delivery, type DeliveryMeal, type Offer, type Subscription } from "@catera/domain";

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
