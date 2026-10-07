import { describe, expect, it } from "vitest";
import {
  canChangeDay,
  dayLabel,
  renewalDefaults,
  renewalDue,
  todayPlates,
  upcomingRows,
  type CustomerState,
  type Delivery,
  type DeliveryMeal,
  type Offer,
  type Subscription,
} from "@catera/domain";

const composition = [
  { id: "g-nasi", name: "Nasi", slots: 1 },
  { id: "g-lauk", name: "Lauk", slots: 2 },
];
const menu = (meal: "lunch" | "dinner", over: Record<string, unknown> = {}) => ({
  meal,
  name: `Menu ${meal}`,
  description: "",
  image: "",
  composition,
  items: [
    { id: "i3", name: "Ayam bakar", description: "", image: "", serving: "", groupId: "g-lauk" },
    { id: "i1", name: "Nasi putih", description: "", image: "", serving: "", groupId: "g-nasi" },
    { id: "i2", name: "Tempe", description: "", image: "", serving: "", groupId: "g-lauk" },
  ],
  ...over,
});
const offer = (over: Record<string, unknown> = {}) =>
  ({
    id: "p1",
    name: "Makan Siang Rumahan",
    caterer: "Dapur Bu Sari",
    image: "https://img/offer.jpg",
    weekdays: [1, 2, 3, 4, 5],
    windows: { lunch: "11.00–13.00", dinner: "17.30–19.30" },
    menus: [menu("lunch", { image: "https://img/lunch.jpg" }), menu("dinner")],
    ...over,
  }) as unknown as Offer;

let seq = 0;
function delivery(
  date: string,
  meals: DeliveryMeal[] | null,
  over: Partial<Delivery> = {},
  o: Offer = offer(),
): Delivery {
  seq += 1;
  return {
    id: `d${seq}`,
    subscription_id: "s1",
    service_date: date,
    address: {
      id: "a1",
      label: "Rumah",
      line: "Jl. Kenanga No. 7",
      area: "Kemang",
      city: "Jakarta",
      instructions: "",
      version: 1,
    },
    status: "scheduled",
    version: 1,
    portions: 1,
    trial: false,
    offer: o,
    meals: meals as DeliveryMeal[],
    cutoff_at: "2026-10-06T10:00:00Z",
    canChange: false,
    ...over,
  };
}
const state = (deliveries: Delivery[]): CustomerState => ({
  subscriptions: [],
  deliveries,
  addresses: [],
  notifications: [],
  cases: [],
});
const lunch = (over: Partial<DeliveryMeal> = {}): DeliveryMeal => ({
  meal: "lunch",
  status: "scheduled",
  ...over,
});
const dinner = (over: Partial<DeliveryMeal> = {}): DeliveryMeal => ({
  meal: "dinner",
  status: "scheduled",
  ...over,
});

// 2026-10-07 is a Wednesday (Rabu); WIB = UTC+7.
const at = (hhmm: string) => new Date(`2026-10-07T${hhmm}:00+07:00`);

describe("todayPlates", () => {
  it("plate is cooking before the window and due after it without departure", () => {
    const s = state([delivery("2026-10-07", [lunch()])]);
    const early = todayPlates(s, at("10:00"));
    expect(early).toHaveLength(1);
    expect(early[0]).toMatchObject({
      state: "cooking",
      meal: "lunch",
      packageName: "Makan Siang Rumahan",
      catererName: "Dapur Bu Sari",
      window: "11.00–13.00",
      addressLabel: "Rumah",
      image: "https://img/lunch.jpg",
      dishes: ["Nasi putih", "Ayam bakar", "Tempe"],
    });
    expect(todayPlates(s, at("11:05"))[0].state).toBe("due");
  });

  it("plate is on the way after departure, arrived after confirm, reported with an open issue", () => {
    const depart = lunch({ status: "out_for_delivery", departed_at: "2026-10-07T04:30:00Z" });
    const arrived = lunch({
      status: "delivered",
      departed_at: "2026-10-07T04:30:00Z",
      confirmed_at: "2026-10-07T05:10:00Z",
      reaction: "enak",
    });
    const reported = lunch({
      status: "delivered",
      confirmed_at: "2026-10-07T05:10:00Z",
      issue: { id: "i1", status: "open" },
    });
    const now = at("12:00");
    const plate = (m: DeliveryMeal) => todayPlates(state([delivery("2026-10-07", [m])]), now)[0];
    expect(plate(depart)).toMatchObject({ state: "on_the_way", departedAt: "2026-10-07T04:30:00Z" });
    expect(plate(arrived)).toMatchObject({
      state: "arrived",
      confirmedAt: "2026-10-07T05:10:00Z",
      reaction: "enak",
    });
    expect(plate(reported)).toMatchObject({ state: "reported", issue: { id: "i1", status: "open" } });
    expect(plate({ ...depart, issue: { id: "i2", status: "open" } }).state).toBe("reported");
    expect(plate({ ...arrived, issue: { id: "i3", status: "resolved" } }).state).toBe("arrived");
  });

  it("uses Jakarta today for a phone at 23.30 UTC", () => {
    const s = state([delivery("2026-10-07", [lunch()]), delivery("2026-10-08", [lunch()])]);
    const plates = todayPlates(s, new Date("2026-10-07T17:30:00Z"));
    expect(plates).toHaveLength(1);
    expect(plates[0].deliveryId).toBe(s.deliveries[1].id);
  });

  it("lunch and dinner give two plates in window order", () => {
    const s = state([delivery("2026-10-07", [dinner(), lunch()])]);
    const plates = todayPlates(s, at("09:00"));
    expect(plates.map((p) => p.meal)).toEqual(["lunch", "dinner"]);
    expect(plates[1]).toMatchObject({ window: "17.30–19.30", image: "https://img/offer.jpg" });
    expect(plates[1].dishes).toEqual(["Nasi putih", "Ayam bakar", "Tempe"]);
  });

  it("treats a missing meals list as empty and falls back to the menu name and address line", () => {
    expect(todayPlates(state([delivery("2026-10-07", null)]), at("09:00"))).toEqual([]);
    const bare = offer({ menus: [menu("lunch", { items: [] })], image: "" });
    const base = delivery("2026-10-07", []);
    const d = delivery(
      "2026-10-07",
      [lunch()],
      { address: { ...base.address, label: "", line: "Jl. Kenanga Panjang Sekali No. 7" } },
      bare,
    );
    const [p] = todayPlates(state([d]), at("09:00"));
    expect(p.dishes).toEqual(["Menu lunch"]);
    expect(p.image).toBe("");
    expect(p.addressLabel).toBe("Jl. Kenanga Panjang Seka");
  });

  it("uses the default window when the offer window is unreadable", () => {
    const d = delivery("2026-10-07", [lunch()], {}, offer({ windows: { lunch: "", dinner: "" } }));
    expect(todayPlates(state([d]), at("10:59"))[0].state).toBe("cooking");
    expect(todayPlates(state([d]), at("11:00"))[0].state).toBe("due");
  });
});

describe("upcomingRows", () => {
  it("labels tomorrow and shows the change deadline", () => {
    const s = state([
      delivery("2026-10-09", [lunch()], { canChange: false }),
      delivery("2026-10-08", [lunch()], { canChange: true, cutoff_at: "2026-10-07T10:00:00Z" }),
      delivery("2026-10-07", [lunch()]),
      delivery("2026-10-12", [lunch()]),
    ]);
    const rows = upcomingRows(s, at("09:00"), 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-10-08",
      label: "Besok, Kamis 8 Okt",
      dishes: "Nasi putih, Ayam bakar, Tempe",
      changeUntil: "17.00",
    });
    expect(rows[1]).toMatchObject({ date: "2026-10-09", label: "Jumat 9 Okt", changeUntil: null });
  });
});

describe("canChangeDay", () => {
  const d = delivery("2026-10-08", [lunch()], { canChange: true, cutoff_at: "2026-10-07T10:00:00Z" });
  it("flips at the cutoff minute", () => {
    expect(canChangeDay(d, at("16:59"))).toEqual({ date: true, address: true, until: "17.00" });
    expect(canChangeDay(d, at("17:00"))).toEqual({ date: false, address: false, until: "17.00" });
  });
  it("keeps date change off for fixed plans and address off after scheduling", () => {
    expect(canChangeDay({ ...d, canChange: false }, at("12:00"))).toMatchObject({
      date: false,
      address: true,
    });
    expect(canChangeDay({ ...d, status: "preparing" }, at("12:00"))).toMatchObject({
      address: false,
    });
  });
});

describe("renewal", () => {
  const sub = (over: Partial<Subscription> = {}) =>
    ({
      id: "s1",
      package_id: "p1",
      portions: 2,
      starts_on: "2026-10-05",
      ends_on: "2026-10-16",
      status: "active",
      remaining: 3,
      legacy: false,
      ...over,
    }) as unknown as Subscription;

  it("renewalDefaults starts the next operating day with no gap", () => {
    expect(renewalDefaults(sub(), offer())).toEqual({
      startDate: "2026-10-19",
      cycles: 1,
      portions: 2,
      packageId: "p1",
      renewedFrom: "s1",
    });
    expect(renewalDefaults(sub({ ends_on: "2026-10-14" }), offer()).startDate).toBe("2026-10-15");
  });
  it("renewalDue only for active plans with 3 or fewer days left", () => {
    expect(renewalDue(sub({ remaining: 3 }))).toBe(true);
    expect(renewalDue(sub({ remaining: 4 }))).toBe(false);
    expect(renewalDue(sub({ status: "ended", remaining: 1 }))).toBe(false);
  });
});

describe("dayLabel", () => {
  it("names weekday and month in Indonesian, with Besok for tomorrow", () => {
    expect(dayLabel("2026-10-07", "2026-10-07", "id")).toBe("Rabu 7 Okt");
    expect(dayLabel("2026-10-08", "2026-10-07", "id")).toBe("Besok, Kamis 8 Okt");
    expect(dayLabel("2026-10-19", "2026-10-07", "id")).toBe("Senin 19 Okt");
    expect(dayLabel("2026-10-08", "2026-10-07", "en")).toBe("Tomorrow, Thu 8 Oct");
  });
});
