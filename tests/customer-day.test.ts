import { describe, expect, it } from "vitest";
import {
  canChangeDay,
  changeDeadline,
  dayLabel,
  renewalDefaults,
  renewalDue,
  reportableMeals,
  todayPlates,
  tomorrowStory,
  trialFollowUp,
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
  it("plate is scheduled until the kitchen starts, cooking once it has, and due after the window without departure", () => {
    const s = state([delivery("2026-10-07", [lunch()])]);
    const early = todayPlates(s, at("10:00"));
    expect(early).toHaveLength(1);
    expect(early[0]).toMatchObject({
      state: "scheduled",
      meal: "lunch",
      packageName: "Makan Siang Rumahan",
      catererName: "Dapur Bu Sari",
      window: "11.00–13.00",
      addressLabel: "Rumah",
      image: "https://img/lunch.jpg",
      dishes: ["Nasi putih", "Ayam bakar", "Tempe"],
    });
    expect(todayPlates(s, at("11:05"))[0].state).toBe("due");
    const cooking = state([delivery("2026-10-07", [lunch({ status: "preparing" })])]);
    expect(todayPlates(cooking, at("10:00"))[0].state).toBe("cooking");
    expect(todayPlates(cooking, at("11:05"))[0].state).toBe("due");
  });

  it("plate journey follows the fulfilment status", () => {
    const stage = (m: DeliveryMeal) => todayPlates(state([delivery("2026-10-07", [m])]), at("10:00"))[0].journey;
    expect(stage(lunch()).stage).toBe("scheduled");
    expect(stage(lunch({ status: "preparing", cooking_started_at: "2026-10-07T01:10:00Z" }))).toMatchObject({
      stage: "preparing",
      cookingAt: "2026-10-07T01:10:00Z",
    });
    expect(stage(lunch({ status: "out_for_delivery", departed_at: "2026-10-07T03:42:00Z" }))).toMatchObject({
      stage: "out_for_delivery",
      departedAt: "2026-10-07T03:42:00Z",
    });
    expect(stage(lunch({ status: "delivered", confirmed_by: "auto" }))).toMatchObject({
      stage: "delivered",
      arrivedBy: "auto",
    });
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

  it("plate is failed when the caterer marked the meal undelivered, unless the customer reported it", () => {
    const failed = lunch({ status: "issue", departed_at: "2026-10-07T04:30:00Z" });
    const plate = (m: DeliveryMeal, now = at("12:00")) =>
      todayPlates(state([delivery("2026-10-07", [m])]), now)[0];
    // Neither due nor cooking: no "Sudah sampai" is offered for it.
    expect(plate(failed).state).toBe("failed");
    expect(plate(failed, at("10:00")).state).toBe("failed");
    expect(plate({ ...failed, issue: { id: "i4", status: "open" } }).state).toBe("reported");
    expect(plate({ ...failed, issue: { id: "i5", status: "resolved" } }).state).toBe("failed");
  });

  it("carries the caterer's WhatsApp number for the plate's actions", () => {
    const d = delivery("2026-10-07", [lunch()], { catererPhone: "+6281200000001" });
    expect(todayPlates(state([d]), at("09:00"))[0].catererPhone).toBe("+6281200000001");
    expect(todayPlates(state([delivery("2026-10-07", [lunch()])]), at("09:00"))[0].catererPhone).toBeNull();
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
    expect(todayPlates(state([d]), at("10:59"))[0].state).toBe("scheduled");
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
      changeUntil: "hari ini 17.00",
    });
    expect(rows[1]).toMatchObject({ date: "2026-10-09", label: "Jumat 9 Okt", changeUntil: null });
  });

  it("hides the change deadline after the cutoff", () => {
    const s = state([
      delivery("2026-10-08", [lunch()], { canChange: true, cutoff_at: "2026-10-07T10:00:00Z" }),
    ]);
    expect(upcomingRows(s, at("16:59"), 1)[0].changeUntil).toBe("hari ini 17.00");
    expect(upcomingRows(s, at("17:00"), 1)[0].changeUntil).toBeNull();
  });

  it("names the package and the meal of each row", () => {
    const s = state([
      delivery("2026-10-08", [lunch()]),
      delivery("2026-10-09", [lunch(), dinner()]),
      delivery("2026-10-12", [dinner()]),
    ]);
    expect(upcomingRows(s, at("09:00"), 3).map((r) => [r.packageName, r.meal])).toEqual([
      ["Makan Siang Rumahan", "lunch"],
      ["Makan Siang Rumahan", "both"],
      ["Makan Siang Rumahan", "dinner"],
    ]);
  });

  it("shows the menu cover, then the package photo", () => {
    const photographed = offer({
      menus: [
        menu("lunch", {
          image: "https://img/menu.jpg",
          items: [
            { id: "i1", name: "Nasi putih", description: "", image: "", serving: "", groupId: "g-nasi" },
            { id: "i2", name: "Ayam bakar", description: "", image: "https://img/ayam.jpg", serving: "", groupId: "g-lauk", categoryId: "main" },
          ],
        }),
      ],
    });
    const plain = offer({ menus: [menu("lunch", { image: "" })] });
    const s = state([
      delivery("2026-10-08", [lunch()], {}, photographed),
      delivery("2026-10-09", [lunch()], {}, plain),
      delivery("2026-10-12", [lunch()], {}, offer({ image: "", menus: [menu("lunch", { image: "" })] })),
    ]);
    expect(upcomingRows(s, at("09:00"), 3).map((r) => r.image)).toEqual([
      "https://img/ayam.jpg",
      "https://img/offer.jpg",
      "",
    ]);
  });

  it("names the day of a deadline that is not today, in the reader's language", () => {
    const s = state([
      delivery("2026-10-08", [lunch()], { canChange: true, cutoff_at: "2026-10-07T10:00:00Z" }),
      delivery("2026-10-09", [lunch()], { canChange: true, cutoff_at: "2026-10-08T10:00:00Z" }),
      delivery("2026-10-12", [lunch()], { canChange: true, cutoff_at: "2026-10-09T10:00:00Z" }),
    ]);
    expect(upcomingRows(s, at("09:00"), 3).map((r) => r.changeUntil)).toEqual([
      "hari ini 17.00",
      "besok 17.00",
      "Jumat 17.00",
    ]);
    expect(upcomingRows(s, at("09:00"), 3, "en").map((r) => r.changeUntil)).toEqual([
      "today 17.00",
      "tomorrow 17.00",
      "Fri 17.00",
    ]);
  });
});

describe("tomorrowStory", () => {
  const open = { canChange: true, cutoff_at: "2026-10-07T10:00:00Z" } as const;

  it("is null with no delivery tomorrow", () => {
    expect(tomorrowStory(state([]), at("09:00"), "id")).toBeNull();
    expect(tomorrowStory(state([delivery("2026-10-07", [lunch()]), delivery("2026-10-09", [lunch()])]), at("09:00"), "id")).toBeNull();
    expect(tomorrowStory(state([delivery("2026-10-08", [lunch()], { status: "cancelled" })]), at("09:00"), "id")).toBeNull();
  });

  // A slot menu as the database stores it: its name is every dish joined, not a title.
  const dish = (id: string, name: string, groupId: string, over: Record<string, unknown> = {}) => ({
    id,
    name,
    description: "",
    image: "",
    serving: "",
    groupId,
    ...over,
  });
  const slotMenu = (meal: "lunch" | "dinner", items: ReturnType<typeof dish>[], over: Record<string, unknown> = {}) =>
    menu(meal, { name: items.map((i) => i.name).join(", "), contentModel: "slots", items, ...over });
  const rice = dish("i1", "Nasi putih", "g-nasi");
  const chicken = dish("i3", "Ayam bakar", "g-lauk", { categoryId: "main" });
  const tempe = dish("i2", "Tempe", "g-lauk");

  it("gives lunch then dinner for a day that has both", () => {
    const o = offer({ menus: [slotMenu("lunch", [tempe, chicken, rice]), slotMenu("dinner", [rice, tempe])] });
    const story = tomorrowStory(state([delivery("2026-10-08", [dinner(), lunch()], open, o)]), at("09:00"), "id");
    expect(story?.date).toBe("2026-10-08");
    expect(story?.parts.map((p) => p.meal)).toEqual(["lunch", "dinner"]);
    expect(story?.parts[0]).toMatchObject({
      catererName: "Dapur Bu Sari",
      window: "11.00–13.00",
      menuSet: true,
    });
  });

  it("makes the main dish the title and leaves it out of the sides, though the menu name lists every dish", () => {
    const o = offer({ menus: [slotMenu("lunch", [tempe, chicken, rice])] });
    expect(o.menus[0].name).toBe("Tempe, Ayam bakar, Nasi putih");
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, o)]), at("09:00"), "id")!.parts[0];
    expect(part.title).toBe("Ayam bakar");
    // Composition order (Nasi, then Lauk) among what is left.
    expect(part.sides).toEqual(["Nasi putih", "Tempe"]);
  });

  it("takes the dish whose photo is the cover as the title when no dish is the main one", () => {
    const photographed = dish("i2", "Tempe", "g-lauk", { image: "https://img/tempe.jpg" });
    const o = offer({ menus: [slotMenu("lunch", [rice, photographed])] });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, o)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ title: "Tempe", sides: ["Nasi putih"], image: "https://img/tempe.jpg" });
  });

  it("takes the first dish in composition order when nothing marks a lead", () => {
    const o = offer({ menus: [slotMenu("lunch", [tempe, rice])] });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, o)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ title: "Nasi putih", sides: ["Tempe"], menuSet: true });
  });

  it("shows a legacy menu with no dish rows by its name", () => {
    const legacy = offer({ menus: [{ meal: "lunch", name: "Nasi ayam bakar", description: "", image: "https://img/legacy.jpg" }] });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, legacy)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ title: "Nasi ayam bakar", sides: [], menuSet: true, image: "https://img/legacy.jpg" });
  });

  it("is not set for a nameless legacy menu, an empty slot menu or one left to the caterer", () => {
    const part = (m: Record<string, unknown>) =>
      tomorrowStory(state([delivery("2026-10-08", [lunch()], open, offer({ menus: [m] }))]), at("09:00"), "id")!.parts[0];
    const bare = { meal: "lunch", name: "", description: "", image: "" };
    expect(part(bare)).toMatchObject({ menuSet: false, title: null, sides: [] });
    expect(part({ ...bare, name: "Paket", contentModel: "slots", items: [] })).toMatchObject({ menuSet: false, title: null });
    expect(part({ ...bare, name: "Paket", selectionStatus: "caterer_choice", items: [] })).toMatchObject({
      menuSet: false,
      title: null,
    });
    expect(part({ ...bare, name: "Paket", selectionStatus: "caterer_choice" })).toMatchObject({ menuSet: false });
  });

  it("gives one part per delivery and meal, with every lunch before any dinner", () => {
    const other = offer({ id: "p2", name: "Paket Hemat", caterer: "Dapur Pak Budi", windows: { lunch: "12.00–13.00", dinner: "17.30–19.30" } });
    const s = state([
      delivery("2026-10-08", [lunch(), dinner()], open),
      delivery("2026-10-08", [lunch()], open, other),
    ]);
    const parts = tomorrowStory(s, at("09:00"), "id")!.parts;
    expect(parts.map((p) => p.meal)).toEqual(["lunch", "lunch", "dinner"]);
    expect(parts.map((p) => p.catererName)).toEqual(["Dapur Bu Sari", "Dapur Pak Budi", "Dapur Bu Sari"]);
    expect(new Set(parts.map((p) => p.deliveryId)).size).toBe(2);
    expect(parts[0].deliveryId).not.toBe(parts[1].deliveryId);
  });

  it("has no title and the package photo for a meal with no menu", () => {
    const bare = offer({ menus: [], image: "https://img/pkg.jpg" });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, bare)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ title: null, sides: [], menuSet: false, image: "https://img/pkg.jpg" });
  });

  it("has no title for a menu the customer still has to choose", () => {
    const pending = offer({ menus: [menu("lunch", { items: [], selectionStatus: "pending", image: "" })] });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, pending)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ title: null, sides: [], menuSet: false, image: "https://img/offer.jpg" });
  });

  it("shows the package photo, not a template photo, while the menu is not set", () => {
    const withTemplate = offer({
      menus: [menu("lunch", { items: [], selectionStatus: "pending", image: "https://img/template.jpg" })],
    });
    const part = tomorrowStory(state([delivery("2026-10-08", [lunch()], open, withTemplate)]), at("09:00"), "id")!.parts[0];
    expect(part).toMatchObject({ menuSet: false, image: "https://img/offer.jpg" });
    const slots = offer({
      menus: [menu("lunch", { items: [], contentModel: "slots", image: "https://img/template.jpg" })],
    });
    expect(tomorrowStory(state([delivery("2026-10-08", [lunch()], open, slots)]), at("09:00"), "id")!.parts[0].image).toBe(
      "https://img/offer.jpg",
    );
  });

  it("follows the change cutoff", () => {
    const s = state([delivery("2026-10-08", [lunch()], open)]);
    expect(tomorrowStory(s, at("16:59"), "id")!.parts[0]).toMatchObject({ changeable: true, until: "hari ini 17.00" });
    expect(tomorrowStory(s, at("16:59"), "en")!.parts[0].until).toBe("today 17.00");
    expect(tomorrowStory(s, at("17:00"), "id")!.parts[0]).toMatchObject({ changeable: false, until: null });
  });

  it("is closed once the cutoff has passed, the cutoff minute included, whatever the plan lets move", () => {
    const flexible = state([delivery("2026-10-08", [lunch()], open)]);
    const fixed = state([delivery("2026-10-08", [lunch()], { canChange: false, cutoff_at: "2026-10-07T10:00:00Z" })]);
    for (const s of [flexible, fixed]) {
      expect(tomorrowStory(s, at("16:59"), "id")!.parts[0].closed).toBe(false);
      expect(tomorrowStory(s, at("17:00"), "id")!.parts[0].closed).toBe(true);
      expect(tomorrowStory(s, at("17:01"), "id")!.parts[0].closed).toBe(true);
    }
    // A fixed plan is open but not changeable before the cutoff, and closed after it.
    expect(tomorrowStory(fixed, at("12:00"), "id")!.parts[0]).toMatchObject({ changeable: false, closed: false });
    expect(tomorrowStory(fixed, at("18:00"), "id")!.parts[0]).toMatchObject({ changeable: false, closed: true });
  });

  it("does not call a cutoff it cannot read closed", () => {
    const s = state([delivery("2026-10-08", [lunch()], { cutoff_at: "garbage" })]);
    expect(tomorrowStory(s, at("12:00"), "id")!.parts[0]).toMatchObject({ changeable: false, closed: false });
  });

  it("is not changeable when only the address can still be edited", () => {
    // A fixed plan keeps its days (canChange false); the address stays editable until the cutoff.
    const s = state([delivery("2026-10-08", [lunch()], { canChange: false, cutoff_at: "2026-10-07T10:00:00Z" })]);
    expect(canChangeDay(s.deliveries[0], at("12:00"))).toMatchObject({ date: false, address: true });
    expect(tomorrowStory(s, at("12:00"), "id")!.parts[0]).toMatchObject({ changeable: false, until: null });
  });

  it("skips cancelled meals", () => {
    const s = state([delivery("2026-10-08", [lunch({ status: "cancelled" }), dinner()], open)]);
    expect(tomorrowStory(s, at("09:00"), "id")!.parts.map((p) => p.meal)).toEqual(["dinner"]);
  });

  it("uses the Jakarta day for a phone at 23.30 UTC", () => {
    const s = state([delivery("2026-10-08", [lunch()], open)]);
    expect(tomorrowStory(s, new Date("2026-10-07T17:30:00Z"), "id")).toBeNull();
    expect(tomorrowStory(s, new Date("2026-10-06T17:30:00Z"), "id")?.date).toBe("2026-10-08");
  });
});

describe("changeDeadline", () => {
  it("says today, tomorrow, the weekday within a week, else the date", () => {
    const now = at("09:00");
    expect(changeDeadline("2026-10-07T10:00:00Z", now, "id")).toBe("hari ini 17.00");
    expect(changeDeadline("2026-10-08T10:00:00Z", now, "id")).toBe("besok 17.00");
    expect(changeDeadline("2026-10-13T10:00:00Z", now, "id")).toBe("Selasa 17.00");
    expect(changeDeadline("2026-10-14T10:00:00Z", now, "id")).toBe("Rabu 14 Okt 17.00");
    // Jakarta date of the cutoff, not UTC: 23.30 WIB on the 8th is 16.30 UTC on the 8th.
    expect(changeDeadline("2026-10-08T16:30:00Z", now, "en")).toBe("tomorrow 23.30");
    expect(changeDeadline("garbage", now, "id")).toBeNull();
  });
});

describe("reportableMeals", () => {
  // Ada masalah: today or yesterday in Jakarta, once the window started or the meal moved on.
  it("never offers a future day, even one on its way in the data", () => {
    expect(reportableMeals(delivery("2026-10-08", [lunch({ status: "out_for_delivery" })]), at("12:00"))).toEqual([]);
    expect(reportableMeals(delivery("2026-10-18", [lunch()]), at("12:00"))).toEqual([]);
  });
  it("offers today once the window has started", () => {
    const d = delivery("2026-10-07", [lunch(), dinner()]);
    expect(reportableMeals(d, at("10:59"))).toEqual([]);
    expect(reportableMeals(d, at("11:00"))).toEqual(["lunch"]);
    expect(reportableMeals(d, at("17:30"))).toEqual(["lunch", "dinner"]);
  });
  it("offers today before the window when the meal is on its way, delivered or failed", () => {
    for (const status of ["out_for_delivery", "delivered", "issue"] as const)
      expect(reportableMeals(delivery("2026-10-07", [lunch({ status })]), at("09:00"))).toEqual(["lunch"]);
    expect(reportableMeals(delivery("2026-10-07", [lunch({ status: "preparing" })]), at("09:00"))).toEqual([]);
  });
  it("offers yesterday, but not the day before", () => {
    expect(reportableMeals(delivery("2026-10-06", [lunch({ status: "delivered" })]), at("08:00"))).toEqual(["lunch"]);
    expect(reportableMeals(delivery("2026-10-05", [lunch({ status: "delivered" })]), at("08:00"))).toEqual([]);
  });
  it("uses the Jakarta day, not the device day", () => {
    // 23.30 UTC on the 6th is already 06.30 on the 7th in Jakarta.
    const late = new Date("2026-10-06T23:30:00Z");
    expect(reportableMeals(delivery("2026-10-07", [lunch({ status: "out_for_delivery" })]), late)).toEqual(["lunch"]);
    expect(reportableMeals(delivery("2026-10-05", [lunch({ status: "delivered" })]), late)).toEqual([]);
  });
  it("never offers a cancelled meal or day", () => {
    expect(reportableMeals(delivery("2026-10-07", [lunch({ status: "cancelled" })]), at("12:00"))).toEqual([]);
    expect(
      reportableMeals(delivery("2026-10-07", [lunch({ status: "delivered" })], { status: "cancelled" }), at("12:00")),
    ).toEqual([]);
    expect(reportableMeals(delivery("2026-10-07", null), at("12:00"))).toEqual([]);
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
    expect(renewalDue(sub({ remaining: 3 }), [])).toBe(true);
    expect(renewalDue(sub({ remaining: 4 }), [])).toBe(false);
    expect(renewalDue(sub({ status: "ended", remaining: 1 }), [])).toBe(false);
  });
  it("renewalDue is over once a renewal exists, and never for a trial", () => {
    const old = sub({ remaining: 2 });
    const next = sub({ id: "s2", renewed_from: "s1", status: "active", remaining: 5 });
    // Paid renewal: no second "Perpanjang".
    expect(renewalDue(old, [old, next])).toBe(false);
    // A cancelled renewal invites renewing again.
    expect(renewalDue(old, [old, { ...next, status: "cancelled" }])).toBe(true);
    // A renewal of some other plan does not count.
    expect(renewalDue(old, [old, { ...next, renewed_from: "s9" }])).toBe(true);
    // Trials are not renewed (matches the maintenance reminder).
    const trial = sub({ remaining: 1, snapshot: { trial: true } as unknown as Subscription["snapshot"] });
    expect(renewalDue(trial, [trial])).toBe(false);
  });
  it("trialFollowUp true for a trial with one day left", () => {
    const trial = sub({ remaining: 1, snapshot: { trial: true } as unknown as Subscription["snapshot"] });
    expect(trialFollowUp(trial, [trial])).toBe(true);
    expect(trialFollowUp({ ...trial, remaining: 2 }, [trial])).toBe(false);
  });
  it("trialFollowUp false once a full plan for the package exists", () => {
    const trial = sub({ remaining: 1, snapshot: { trial: true } as unknown as Subscription["snapshot"] });
    const full = sub({ id: "s2", starts_on: "2026-10-17", remaining: 5 });
    expect(trialFollowUp(trial, [trial, full])).toBe(false);
    // A cancelled plan, or one for another package, is not a follow-up.
    expect(trialFollowUp(trial, [trial, { ...full, status: "cancelled" }])).toBe(true);
    expect(trialFollowUp(trial, [trial, { ...full, package_id: "p9" }])).toBe(true);
    // A plan that started earlier is not a continuation of the trial.
    expect(trialFollowUp(trial, [trial, { ...full, starts_on: "2026-10-01" }])).toBe(true);
  });
  it("trialFollowUp false for non-trial", () => {
    expect(trialFollowUp(sub({ remaining: 1 }), [])).toBe(false);
    const trial = sub({ remaining: 1, status: "ended", snapshot: { trial: true } as unknown as Subscription["snapshot"] });
    expect(trialFollowUp(trial, [trial])).toBe(false);
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
