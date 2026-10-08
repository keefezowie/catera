import { describe, expect, it } from "vitest";
import {
  cookingRecap,
  deliveryRoute,
  jakartaDay,
  menuShareText,
  routeShareText,
  whatsappUrl,
  type SellerOperationsState,
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
