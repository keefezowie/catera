import { describe, expect, it } from "vitest";
import {
  cookingRecap,
  deliveryRoute,
  jakartaDay,
  journeyCaption,
  kitchenDayDone,
  kitchenSession,
  menuShareText,
  routeMapsUrl,
  routeShareText,
  sessionStart,
  whatsappUrl,
  type DeliveryIssue,
  type SellerOperationsState,
  type Stop,
} from "@catera/domain";

const DATE = "2026-10-07";

const composition = (lauk: number) => [
  { id: "g-nasi", name: "Nasi", slots: 1 },
  { id: "g-lauk", name: "Lauk", slots: lauk },
  { id: "g-sayur", name: "Sayur", slots: 1 },
];
const offer = (id: string, name: string, lauk: number) => ({
  id,
  name,
  menus: [{ meal: "lunch", name, description: "", image: "", composition: composition(lauk) }],
});
const rumahan = offer("p-rumahan", "Makan Siang Rumahan", 2);
const hemat = offer("p-hemat", "Paket Hemat Kantor", 1);

let seq = 0;
function delivery(
  pkg: ReturnType<typeof offer>,
  name: string,
  portions: number,
  extra: { area?: string; status?: string; meal?: string; instructions?: string } = {},
) {
  seq += 1;
  return {
    id: `d-${seq}`,
    subscription_id: `s-${seq}`,
    service_date: DATE,
    status: extra.status ?? "scheduled",
    version: 1,
    portions,
    trial: false,
    offer: pkg,
    meals: [{ meal: extra.meal ?? "lunch", status: extra.status ?? "scheduled" }],
    cutoff_at: "",
    canChange: false,
    customer: { id: `c-${seq}`, name },
    address: {
      id: `a-${seq}`,
      label: "",
      line: `Jl. Contoh ${seq}`,
      area: extra.area ?? "Tebet",
      city: "Jakarta Selatan",
      instructions: extra.instructions ?? "",
      version: 1,
    },
  };
}

const items = (pkg: string, dishes: [string, string][]) =>
  dishes.map(([groupId, name], i) => ({ id: `${pkg}-${i}`, name, groupId }));

function canvasState(): SellerOperationsState {
  const deliveries = [
    delivery(rumahan, "Bu Sari Wulandari", 2),
    delivery(rumahan, "Keluarga Hartono", 3),
    delivery(rumahan, "Kost Damai", 23),
    delivery(hemat, "Kantor PT Sinar Rasa", 6),
    delivery(rumahan, "Pindah Hari", 4, { status: "cancelled" }),
    delivery(rumahan, "Pelanggan Malam", 5, { meal: "dinner" }),
  ];
  return {
    deliveries,
    operationalDate: DATE,
    today: DATE,
    datedMenus: [
      {
        package_id: "p-rumahan",
        content_revision: 0,
        service_date: DATE,
        meal: "lunch",
        version: 1,
        details: {
          name: "",
          description: "",
          image: "",
          meal: "lunch",
          composition: composition(2),
          items: items("r", [
            ["g-nasi", "Nasi putih"],
            ["g-lauk", "Ayam bakar madu"],
            ["g-lauk", "Tempe orek"],
            ["g-sayur", "Sayur asem"],
          ]),
        },
      },
      {
        package_id: "p-hemat",
        content_revision: 0,
        service_date: DATE,
        meal: "lunch",
        version: 1,
        details: {
          name: "",
          description: "",
          image: "",
          meal: "lunch",
          composition: composition(1),
          items: items("h", [
            ["g-nasi", "Nasi putih"],
            ["g-lauk", "Telur balado"],
            ["g-sayur", "Sayur asem"],
          ]),
        },
      },
    ],
  } as unknown as SellerOperationsState;
}

describe("cookingRecap", () => {
  it("totals lunch portions across packages, excluding cancelled and dinner", () => {
    const recap = cookingRecap(canvasState(), "lunch");
    expect(recap.total).toBe(34);
    expect(recap.byPackage).toEqual([
      { packageId: "p-rumahan", name: "Makan Siang Rumahan", portions: 28 },
      { packageId: "p-hemat", name: "Paket Hemat Kantor", portions: 6 },
    ]);
  });

  it("counts each dish by the portions of the packages that serve it", () => {
    const byName = Object.fromEntries(
      cookingRecap(canvasState(), "lunch").byDish.map((d) => [d.name, d.count]),
    );
    expect(byName).toEqual({
      "Nasi putih": 34,
      "Ayam bakar madu": 28,
      "Tempe orek": 28,
      "Telur balado": 6,
      "Sayur asem": 34,
    });
  });

  it("unfilled slots are reported separately and never listed as dishes", () => {
    const state = canvasState();
    state.datedMenus = [];
    const recap = cookingRecap(state, "lunch");
    expect(recap.byDish).toEqual([]);
    expect(recap.unfilled).toEqual([
      { packageId: "p-rumahan", packageName: "Makan Siang Rumahan", group: "Nasi", slots: 1, portions: 28 },
      { packageId: "p-rumahan", packageName: "Makan Siang Rumahan", group: "Lauk", slots: 2, portions: 56 },
      { packageId: "p-rumahan", packageName: "Makan Siang Rumahan", group: "Sayur", slots: 1, portions: 28 },
      { packageId: "p-hemat", packageName: "Paket Hemat Kantor", group: "Nasi", slots: 1, portions: 6 },
      { packageId: "p-hemat", packageName: "Paket Hemat Kantor", group: "Lauk", slots: 1, portions: 6 },
      { packageId: "p-hemat", packageName: "Paket Hemat Kantor", group: "Sayur", slots: 1, portions: 6 },
    ]);
  });

  it("keeps real dishes and reports only the slots still missing", () => {
    const state = canvasState();
    const dated = state.datedMenus!.find((m) => m.package_id === "p-rumahan")!;
    dated.details.items = dated.details.items!.filter((i) => i.name !== "Tempe orek");
    const recap = cookingRecap(state, "lunch");
    expect(recap.byDish.map((d) => d.name)).not.toContain("Tempe orek");
    expect(recap.byDish.map((d) => d.name)).toContain("Ayam bakar madu");
    expect(recap.unfilled).toEqual([
      { packageId: "p-rumahan", packageName: "Makan Siang Rumahan", group: "Lauk", slots: 1, portions: 28 },
    ]);
  });

  it("no unfilled line when the menu is complete", () => {
    expect(cookingRecap(canvasState(), "lunch").unfilled).toEqual([]);
  });
});

describe("deliveryRoute", () => {
  it("lists active stops for the meal ordered by area then name, numbered from 1", () => {
    const state = canvasState();
    state.deliveries.push(
      delivery(hemat, "Ani", 1, { area: "Kuningan", instructions: "Titip satpam" }) as never,
    );
    const stops = deliveryRoute(state, "lunch");
    expect(stops.map((s) => s.name)).toEqual([
      "Ani",
      "Bu Sari Wulandari",
      "Kantor PT Sinar Rasa",
      "Keluarga Hartono",
      "Kost Damai",
    ]);
    expect(stops.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    expect(stops[0]).toMatchObject({
      note: "Titip satpam",
      portions: 1,
      packageName: "Paket Hemat Kantor",
      area: "Kuningan",
    });
    expect(stops[0].mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
  });
});

describe("sessionStart", () => {
  // Windows are the packages' own; the fixtures above carry none, so each case dresses its offers.
  const early = { ...hemat, windows: { lunch: "10.30–12.00", dinner: "18.30–20.00" } };
  const late = { ...rumahan, windows: { lunch: "11.30–13.00", dinner: "17.45–19.30" } };

  it("is the earliest window start among the meal's deliveries, as HH.MM", () => {
    const state = canvasState();
    state.deliveries = [
      delivery(late, "Bu Sari Wulandari", 2),
      delivery(early, "Kantor PT Sinar Rasa", 6),
    ] as never;
    expect(sessionStart(state, "lunch")).toBe("10.30");
  });

  it("reads the window of the meal asked for", () => {
    const state = canvasState();
    state.deliveries = [
      delivery(late, "Pelanggan Malam", 5, { meal: "dinner" }),
      delivery(early, "Kantor Malam", 1, { meal: "dinner" }),
    ] as never;
    expect(sessionStart(state, "dinner")).toBe("17.45");
  });

  it("ignores cancelled deliveries", () => {
    const state = canvasState();
    state.deliveries = [
      delivery(early, "Pindah Hari", 4, { status: "cancelled" }),
      delivery(late, "Bu Sari Wulandari", 2),
    ] as never;
    expect(sessionStart(state, "lunch")).toBe("11.30");
  });

  const unset = { ...hemat, windows: { lunch: "", dinner: "" } };
  const garbled = { ...rumahan, windows: { lunch: "segera", dinner: "25.00–26.00" } };

  it("shows no time when no delivery has a window the caterer actually set", () => {
    const state = canvasState();
    state.deliveries = [delivery(unset, "Tanpa Jam", 3), delivery(garbled, "Jam Rusak", 2)] as never;
    // The 11.00 and 17.00 fallbacks order rows elsewhere; here they would pass for the caterer's own hours.
    expect(sessionStart(state, "lunch")).toBeNull();
    state.deliveries = [delivery(unset, "Tanpa Jam", 3, { meal: "dinner" }), delivery(garbled, "Jam Rusak", 2, { meal: "dinner" })] as never;
    expect(sessionStart(state, "dinner")).toBeNull();
  });

  it("skips a delivery without a readable window when another one has one", () => {
    const state = canvasState();
    state.deliveries = [delivery(unset, "Tanpa Jam", 3), delivery(late, "Bu Sari Wulandari", 2)] as never;
    expect(sessionStart(state, "lunch")).toBe("11.30");
  });

  it("is null when the meal has no deliveries", () => {
    const state = canvasState();
    state.deliveries = [delivery(early, "Kantor PT Sinar Rasa", 6)] as never;
    expect(sessionStart(state, "dinner")).toBeNull();
    state.deliveries = [];
    expect(sessionStart(state, "lunch")).toBeNull();
  });
});

describe("routeShareText", () => {
  const meta = { date: DATE, meal: "lunch" as const, caterer: "Dapur Bu Rina" };

  it("starts with a bold Indonesian header that counts stops and portions", () => {
    const [text] = routeShareText(deliveryRoute(canvasState(), "lunch"), meta, "id");
    expect(text.startsWith("*Antar siang · Rabu 7 Okt* (4 alamat, 34 porsi)")).toBe(true);
    expect(text).toContain("1. Bu Sari Wulandari, 2 porsi");
  });

  it("splits a 60-stop route into parts of at most 1,800 characters with continuous numbering", () => {
    const state = canvasState();
    for (let i = 0; i < 56; i += 1)
      state.deliveries.push(
        delivery(rumahan, `Pelanggan nomor ${i}`, 1, {
          instructions: "Taruh di depan pintu, telepon dulu sebelum sampai",
        }) as never,
      );
    const stops = deliveryRoute(state, "lunch");
    expect(stops).toHaveLength(60);
    const parts = routeShareText(stops, meta, "id");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(1800);
    const numbers = parts
      .join("\n")
      .split("\n")
      .map((line) => /^(\d+)\. /.exec(line)?.[1])
      .filter(Boolean)
      .map(Number);
    expect(numbers).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(parts[1]).toContain("(bagian 2)");
  });
});

describe("jakartaDay", () => {
  it("uses the Asia/Jakarta calendar date", () => {
    expect(jakartaDay(new Date("2026-10-07T17:30:00Z"))).toBe("2026-10-08");
    expect(jakartaDay(new Date("2026-10-07T16:59:00Z"))).toBe("2026-10-07");
  });
  it("adds whole days", () => {
    expect(jakartaDay(new Date("2026-10-07T03:00:00Z"), 1)).toBe("2026-10-08");
  });
});

describe("whatsappUrl", () => {
  it("normalises Indonesian numbers and encodes the text", () => {
    expect(whatsappUrl("a b", "0812-3456")).toBe("https://wa.me/628123456?text=a%20b");
  });
  it("omits the number when none is given", () => {
    expect(whatsappUrl("halo")).toBe("https://wa.me/?text=halo");
  });
});

describe("menuShareText", () => {
  it("menu share header has no em dash", () => {
    const text = menuShareText(
      [
        {
          date: "2026-10-06",
          lines: [
            { category: "Nasi", dishes: ["Nasi putih"] },
            { category: "Lauk", dishes: ["Ayam goreng lengkuas", "Tahu bacem"] },
          ],
        },
      ],
      { caterer: "Dapur Bu Rina", packageName: "Makan Siang Rumahan" },
      "id",
    );
    expect(text).toBe(
      "*Menu Dapur Bu Rina · Makan Siang Rumahan*\n\n*Selasa 6 Okt*\nNasi: Nasi putih\nLauk: Ayam goreng lengkuas, Tahu bacem",
    );
  });
});

describe("earliestImportStart", () => {
  it("is tomorrow before the 17.00 Jakarta cutoff and the day after once it has passed", async () => {
    const { earliestImportStart } = await import("@catera/domain");
    expect(earliestImportStart(new Date("2026-10-07T09:59:00Z"))).toBe("2026-10-08");
    expect(earliestImportStart(new Date("2026-10-07T10:00:00Z"))).toBe("2026-10-09");
  });
});

// A session is one meal across the day's active rows. Fixture builders for it live here.
const TODAY_NOON = new Date("2026-10-07T05:00:00Z"); // 12.00 WIB on DATE
type MealPatch = {
  status?: string;
  cooking_started_at?: string | null;
  departed_at?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: "customer" | "auto" | "caterer" | null;
};
type Row = ReturnType<typeof delivery>;
function sessionRow(name: string, over: MealPatch = {}, meal = "lunch", portions = 2): Row {
  const d = delivery(rumahan, name, portions, { meal });
  d.meals = [{ meal, status: "scheduled", ...over }];
  d.status = over.status ?? "scheduled";
  return d;
}
function sessionState(rows: Row[], over: Record<string, unknown> = {}): SellerOperationsState {
  return { ...canvasState(), deliveries: rows, operationalDate: DATE, today: DATE, ...over } as unknown as SellerOperationsState;
}

describe("kitchenSession", () => {
  it("is null with no active rows", () => {
    expect(kitchenSession(sessionState([]), "lunch", TODAY_NOON)).toBeNull();
    const onlyOthers = sessionState([
      sessionRow("Gagal", { status: "issue" }),
      sessionRow("Batal", { status: "cancelled" }),
      sessionRow("Malam", {}, "dinner"),
    ]);
    expect(kitchenSession(onlyOthers, "lunch", TODAY_NOON)).toBeNull();
  });

  it("takes the least advanced active row as its stage", () => {
    const mixed = sessionState([
      sessionRow("Sudah jalan", { status: "out_for_delivery", departed_at: "2026-10-07T03:00:00Z" }),
      sessionRow("Belum mulai"),
    ]);
    const s = kitchenSession(mixed, "lunch", TODAY_NOON)!;
    expect(s.journey.stage).toBe("scheduled");
    expect(s.canCook).toBe(true);
    expect(s.canDepart).toBe(false);
    // The caption stays true to the mixed session: it did not start, and it did not leave as one.
    expect(journeyCaption(s.journey, "id")).toBe("Terjadwal");
    const preparing = sessionState([
      sessionRow("Dimasak", { status: "preparing", cooking_started_at: "2026-10-07T01:00:00Z" }),
      sessionRow("Sudah jalan", { status: "out_for_delivery" }),
    ]);
    expect(kitchenSession(preparing, "lunch", TODAY_NOON)!.journey.stage).toBe("preparing");
    const allOut = sessionState([sessionRow("A", { status: "out_for_delivery" }), sessionRow("B", { status: "delivered" })]);
    expect(kitchenSession(allOut, "lunch", TODAY_NOON)!.journey.stage).toBe("out_for_delivery");
  });

  it("offers cooking while any row is scheduled, and departure once none is and some row is preparing", () => {
    const scheduled = sessionState([sessionRow("A"), sessionRow("B", { status: "preparing" })]);
    expect(kitchenSession(scheduled, "lunch", TODAY_NOON)).toMatchObject({ canCook: true, canDepart: false });
    const cooked = sessionState([sessionRow("A", { status: "preparing" }), sessionRow("B", { status: "out_for_delivery" })]);
    expect(kitchenSession(cooked, "lunch", TODAY_NOON)).toMatchObject({ canCook: false, canDepart: true });
    const gone = sessionState([sessionRow("A", { status: "out_for_delivery" })]);
    expect(kitchenSession(gone, "lunch", TODAY_NOON)).toMatchObject({ canCook: false, canDepart: false });
  });

  it("offers neither on a day that is not today", () => {
    const tomorrow = sessionState([sessionRow("A")], { operationalDate: "2026-10-08" });
    expect(kitchenSession(tomorrow, "lunch", TODAY_NOON)).toMatchObject({ canCook: false, canDepart: false });
    const preparingTomorrow = sessionState([sessionRow("A", { status: "preparing" })], { operationalDate: "2026-10-08" });
    expect(kitchenSession(preparingTomorrow, "lunch", TODAY_NOON)!.canDepart).toBe(false);
    const yesterday = sessionState([sessionRow("A")], { operationalDate: "2026-10-06" });
    expect(kitchenSession(yesterday, "lunch", TODAY_NOON)!.canCook).toBe(false);
  });

  it("skips issue and cancelled rows", () => {
    const s = kitchenSession(
      sessionState([
        sessionRow("Aktif", { status: "preparing" }, "lunch", 3),
        sessionRow("Gagal", { status: "issue" }, "lunch", 5),
        sessionRow("Batal", { status: "cancelled" }, "lunch", 7),
      ]),
      "lunch",
      TODAY_NOON,
    )!;
    expect(s.journey.stage).toBe("preparing");
    expect(s.portions).toBe(3);
    expect(s.canCook).toBe(false);
  });

  it("counts portions and distinct addresses of active rows", () => {
    const a = sessionRow("A", {}, "lunch", 2);
    const b = sessionRow("B", {}, "lunch", 3);
    const c = sessionRow("C", {}, "lunch", 4);
    b.address = { ...b.address, line: a.address.line, area: a.address.area };
    const s = kitchenSession(sessionState([a, b, c]), "lunch", TODAY_NOON)!;
    expect(s.portions).toBe(9);
    expect(s.addresses).toBe(2);
    expect(s.stops).toHaveLength(3);
    expect(s.recap.total).toBe(9);
    expect(s.meal).toBe("lunch");
  });

  it("keeps the recap and the stops on the same rows as the portions", () => {
    const s = kitchenSession(
      sessionState([
        sessionRow("Aktif", { status: "preparing" }, "lunch", 3),
        sessionRow("Gagal", { status: "issue" }, "lunch", 5),
        sessionRow("Batal", { status: "cancelled" }, "lunch", 7),
      ]),
      "lunch",
      TODAY_NOON,
    )!;
    expect(s.stops.map((stop) => stop.name)).toEqual(["Aktif"]);
    expect(s.recap.total).toBe(3);
    expect(s.recap.total).toBe(s.portions);
    expect(s.recap.byPackage.reduce((sum, p) => sum + p.portions, 0)).toBe(s.portions);
  });

  it("carries the earliest cooking and departure times", () => {
    const s = kitchenSession(
      sessionState([
        sessionRow("A", { status: "out_for_delivery", cooking_started_at: "2026-10-07T02:00:00Z", departed_at: "2026-10-07T04:10:00Z" }),
        sessionRow("B", { status: "out_for_delivery", cooking_started_at: "2026-10-07T01:30:00Z", departed_at: "2026-10-07T03:50:00Z" }),
        sessionRow("C", { status: "out_for_delivery" }),
      ]),
      "lunch",
      TODAY_NOON,
    )!;
    expect(s.journey).toMatchObject({
      stage: "out_for_delivery",
      cookingAt: "2026-10-07T01:30:00Z",
      departedAt: "2026-10-07T03:50:00Z",
    });
  });

  it("is arrived by the system only when every delivered row was closed by the system", () => {
    const auto = (name: string) =>
      sessionRow(name, { status: "delivered", confirmed_by: "auto", confirmed_at: "2026-10-07T06:00:00Z" });
    const allAuto = kitchenSession(sessionState([auto("A"), auto("B")]), "lunch", TODAY_NOON)!;
    expect(allAuto.journey).toMatchObject({ stage: "delivered", arrivedBy: "auto", arrivedAt: "2026-10-07T06:00:00Z" });
    const mixed = kitchenSession(
      sessionState([auto("A"), sessionRow("B", { status: "delivered", confirmed_by: "customer", confirmed_at: "2026-10-07T05:30:00Z" })]),
      "lunch",
      TODAY_NOON,
    )!;
    expect(mixed.journey.arrivedBy).toBe("customer");
    expect(mixed.journey.arrivedAt).toBe("2026-10-07T06:00:00Z");
  });
});

describe("kitchenDayDone", () => {
  const delivered = (name: string, meal = "lunch") =>
    sessionRow(name, { status: "delivered", confirmed_by: "auto" }, meal);
  const issue = (status: string, date = DATE) =>
    ({ id: "i1", day_id: "d-1", meal: "lunch", status, service_date: date }) as unknown as DeliveryIssue;

  it("is true when every active row of the day is delivered", () => {
    expect(kitchenDayDone(sessionState([delivered("A"), delivered("B", "dinner")]), [], TODAY_NOON)).toBe(true);
  });
  it("is false on a day that is not today", () => {
    expect(kitchenDayDone(sessionState([delivered("A")], { operationalDate: "2026-10-06" }), [], TODAY_NOON)).toBe(false);
  });
  it("is false with no active rows", () => {
    expect(kitchenDayDone(sessionState([]), [], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(sessionState([sessionRow("Batal", { status: "cancelled" })]), [], TODAY_NOON)).toBe(false);
  });
  it("is false while any row is not delivered", () => {
    expect(kitchenDayDone(sessionState([delivered("A"), sessionRow("B", { status: "out_for_delivery" })]), [], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(sessionState([delivered("A"), sessionRow("B", {}, "dinner")]), [], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(sessionState([delivered("A"), sessionRow("B", { status: "preparing" })]), [], TODAY_NOON)).toBe(false);
  });
  it("counts a row marked as failed as finished, and ignores cancelled rows", () => {
    const failed = sessionRow("Gagal", { status: "issue" });
    expect(kitchenDayDone(sessionState([delivered("A"), failed]), [], TODAY_NOON)).toBe(true);
    expect(kitchenDayDone(sessionState([failed]), [], TODAY_NOON)).toBe(true);
    expect(kitchenDayDone(sessionState([delivered("A"), sessionRow("Batal", { status: "cancelled" })]), [], TODAY_NOON)).toBe(true);
    expect(kitchenDayDone(sessionState([failed, sessionRow("B", {}, "dinner")]), [], TODAY_NOON)).toBe(false);
  });
  it("is false with an unresolved issue for that date, true once it is resolved or belongs to another day", () => {
    const rows = sessionState([delivered("A")]);
    expect(kitchenDayDone(rows, [issue("open")], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(rows, [issue("responded")], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(rows, [issue("escalated")], TODAY_NOON)).toBe(false);
    expect(kitchenDayDone(rows, [issue("resolved")], TODAY_NOON)).toBe(true);
    expect(kitchenDayDone(rows, [issue("open", "2026-10-06")], TODAY_NOON)).toBe(true);
  });
});

describe("routeMapsUrl", () => {
  const stop = (n: number): Stop => ({
    n,
    deliveryId: `d-${n}`,
    version: 1,
    name: `Pelanggan ${n}`,
    addressLine: `Jl. Contoh ${n}`,
    area: "Tebet",
    note: "",
    portions: 1,
    packageName: "Paket",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Jl. Contoh ${n}, Tebet, Jakarta Selatan`)}`,
  });
  const params = (url: string) => new URL(url).searchParams;

  it("is null for no stops", () => {
    expect(routeMapsUrl([])).toBeNull();
  });
  it("sends the last stop as the destination and the others as waypoints", () => {
    const r = routeMapsUrl([stop(1), stop(2), stop(3)])!;
    expect(r.count).toBe(3);
    expect(r.url.startsWith("https://www.google.com/maps/dir/?api=1")).toBe(true);
    expect(params(r.url).get("destination")).toBe("Jl. Contoh 3, Tebet, Jakarta Selatan");
    expect(params(r.url).get("waypoints")).toBe("Jl. Contoh 1, Tebet, Jakarta Selatan|Jl. Contoh 2, Tebet, Jakarta Selatan");
  });
  it("has no waypoints for a single stop", () => {
    const r = routeMapsUrl([stop(1)])!;
    expect(r.count).toBe(1);
    expect(params(r.url).get("destination")).toBe("Jl. Contoh 1, Tebet, Jakarta Selatan");
    expect(params(r.url).get("waypoints")).toBeNull();
  });
  it("opens at most the first 10 stops", () => {
    const r = routeMapsUrl(Array.from({ length: 12 }, (_, i) => stop(i + 1)))!;
    expect(r.count).toBe(10);
    expect(params(r.url).get("destination")).toBe("Jl. Contoh 10, Tebet, Jakarta Selatan");
    expect(params(r.url).get("waypoints")!.split("|")).toHaveLength(9);
  });
  it("skips a stop with no address and counts only the stops it opens", () => {
    const blank: Stop = { ...stop(2), addressLine: "", area: "", mapsUrl: "" };
    const r = routeMapsUrl([stop(1), blank, stop(3)])!;
    expect(r.count).toBe(2);
    expect(params(r.url).get("destination")).toBe("Jl. Contoh 3, Tebet, Jakarta Selatan");
    expect(params(r.url).get("waypoints")).toBe("Jl. Contoh 1, Tebet, Jakarta Selatan");
    expect(routeMapsUrl([blank])).toBeNull();
    // The ten are the first ten that can be routed to.
    const many = [blank, ...Array.from({ length: 11 }, (_, i) => stop(i + 1))];
    expect(routeMapsUrl(many)!.count).toBe(10);
  });
  it("opens the route the kitchen session lists, in its order", () => {
    const state = sessionState([sessionRow("Ani"), sessionRow("Bayu"), sessionRow("Citra")]);
    const stops = deliveryRoute(state, "lunch");
    const r = routeMapsUrl(stops)!;
    expect(r.count).toBe(3);
    expect(params(r.url).get("destination")).toBe(`${stops[2].addressLine}, ${stops[2].area}, Jakarta Selatan`);
    expect(params(r.url).get("waypoints")!.split("|")).toEqual([
      `${stops[0].addressLine}, ${stops[0].area}, Jakarta Selatan`,
      `${stops[1].addressLine}, ${stops[1].area}, Jakarta Selatan`,
    ]);
  });
  it("builds the address from the stop when its link carries none", () => {
    const r = routeMapsUrl([{ ...stop(1), mapsUrl: "" }, { ...stop(2), mapsUrl: "" }])!;
    expect(params(r.url).get("destination")).toBe("Jl. Contoh 2, Tebet");
  });
});

describe("cookingRecap dish photos", () => {
  it("carries the dish photo, or an empty string", () => {
    const state = canvasState();
    const dated = (state as unknown as { datedMenus: { details: { items: { image?: string }[] } }[] }).datedMenus;
    dated[0].details.items[1].image = "https://img/ayam.jpg";
    const byName = Object.fromEntries(cookingRecap(state, "lunch").byDish.map((d) => [d.name, d.image]));
    expect(byName["Ayam bakar madu"]).toBe("https://img/ayam.jpg");
    expect(byName["Nasi putih"]).toBe("");
    expect(byName["Telur balado"]).toBe("");
  });
});
