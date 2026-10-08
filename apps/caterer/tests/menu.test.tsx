import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { LibraryDish, MealMenu } from "@catera/domain";
import { copyWeekBatches, dayComplete, suggestDishes, weekDates } from "../src/menu/logic";
import { SlotEditor } from "../src/menu/SlotEditor";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const dish = (id: string, name: string, categoryId = "main"): LibraryDish =>
  ({ id, name, categoryId, description: "", image: "", serving: "", catererId: "k-1", version: 1, archived: false }) as LibraryDish;
const composition = [
  { id: "g-nasi", categoryId: "rice", name: "Nasi", slots: 1 },
  { id: "g-lauk", categoryId: "main", name: "Lauk", slots: 2 },
  { id: "g-sayur", categoryId: "vegetable", name: "Sayur", slots: 1 },
];
const item = (id: string, groupId: string, categoryId: string, name: string) => ({
  id,
  groupId,
  categoryId,
  name,
  description: "",
  image: "",
  serving: "",
});

describe("suggestDishes", () => {
  const library = [dish("d1", "Pepes tahu"), dish("d2", "Pepes ikan kembung"), dish("d3", "Pepes ayam", "vegetable"), { ...dish("d4", "Pepes udang"), archived: true }];
  it("matches by text within the category, most used first, hiding archived dishes", () => {
    const usage = new Map([["d2", 3], ["d1", 1]]);
    expect(suggestDishes(library, "main", "pep", usage).map((d) => d.name)).toEqual([
      "Pepes ikan kembung",
      "Pepes tahu",
    ]);
  });
});

describe("dayComplete", () => {
  it("requires exactly the package's count per category", () => {
    const one = [item("a", "g-nasi", "rice", "Nasi putih"), item("b", "g-lauk", "main", "Ayam"), item("c", "g-sayur", "vegetable", "Asem")];
    expect(dayComplete(composition, one)).toBe(false);
    expect(dayComplete(composition, [...one, item("d", "g-lauk", "main", "Tempe")])).toBe(true);
  });
});

describe("copyWeekBatches", () => {
  it("never copies onto past or already filled days", () => {
    const menu = { name: "M", description: "", image: "", meal: "lunch", composition, items: [item("x", "g-lauk", "main", "Ayam")] } as MealMenu;
    const lastWeek = ["2026-09-28", "2026-09-29", "2026-09-30"].map((date) => ({ date, details: menu }));
    const { batches, skipped } = copyWeekBatches(
      lastWeek,
      new Map([
        ["2026-10-05", { version: 1, editable: false, filled: false }],
        ["2026-10-06", { version: 4, editable: true, filled: true }],
        ["2026-10-07", { version: 0, editable: true, filled: false }],
      ]),
    );
    expect(batches.map((b) => b.dates.map((d) => d.date))).toEqual([["2026-10-07"]]);
    expect(skipped).toBe(2);
  });

  const menuFor = (lauk: string): MealMenu =>
    ({ name: "Makan Siang", description: "", image: "", meal: "lunch", composition, items: [item("x", "g-lauk", "main", lauk)] }) as MealMenu;
  it("sends one save per distinct menu and never mixes months", () => {
    const lastWeek = [
      { date: "2026-09-28", details: menuFor("Ayam") },
      { date: "2026-09-29", details: menuFor("Rendang") },
      { date: "2026-09-30", details: menuFor("Ayam") },
      { date: "2026-10-01", details: menuFor("Ikan") },
      { date: "2026-10-02", details: menuFor("Telur") },
    ];
    const open = { version: 0, editable: true, filled: false };
    const targets = new Map([
      ["2026-10-05", { ...open, version: 2 }],
      ["2026-10-06", open],
      ["2026-10-07", open],
      ["2026-10-08", open],
      ["2026-10-09", open],
    ]);
    const { batches } = copyWeekBatches(lastWeek, targets);
    expect(batches.map((b) => b.dates.map((d) => d.date))).toEqual([
      ["2026-10-05", "2026-10-07"],
      ["2026-10-06"],
      ["2026-10-08"],
      ["2026-10-09"],
    ]);
    expect(batches[0].dates[0].version).toBe(2);
    expect(batches[0].details).not.toHaveProperty("meal");
  });
});

describe("weekDates", () => {
  it("lists the package's delivery weekdays of the week containing the date", () => {
    expect(weekDates("2026-10-07", [1, 2, 3, 4, 5])).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });
});

it("keeps Simpan disabled until every category is filled exactly", () => {
  render(
    <SlotEditor
      composition={composition}
      items={[item("a", "g-nasi", "rice", "Nasi putih"), item("b", "g-lauk", "main", "Ayam goreng kremes"), item("c", "g-sayur", "vegetable", "Sayur asem")]}
      library={[]}
      usage={new Map()}
      onChange={() => undefined}
      onCreate={async () => dish("n", "x")}
      onSave={() => undefined}
      saving={false}
      canEdit
    />,
  );
  expect(screen.getByText("Lauk · 1 dari 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Simpan menu" }).props.accessibilityState.disabled).toBe(true);
});

it("does not offer helpers package creation on an empty menu", async () => {
  const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
  const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "m" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-2", role: "staff", catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(async () => ({ offers: [], dishes: [], datedMenus: [], caterer: { name: "Dapur" } })),
  } as unknown as typeof runtime.api;
  render(
    <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
      <MenuWeek />
    </MobileProvider>,
  );
  expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Buat paket" })).toBeNull();
});

it("gives a re-added dish a free slot id instead of reusing a taken one", () => {
  const onChange = jest.fn();
  render(
    <SlotEditor
      composition={composition}
      items={[item("g-lauk-2", "g-lauk", "main", "Tempe bacem")]}
      library={[dish("d-ikan", "Ikan bakar")]}
      usage={new Map()}
      onChange={onChange}
      onCreate={async () => dish("n", "x")}
      onSave={() => undefined}
      saving={false}
      canEdit
    />,
  );
  fireEvent.changeText(screen.getByLabelText("Lauk berikutnya"), "ikan");
  fireEvent.press(screen.getByText("Ikan bakar"));
  const ids = (onChange.mock.calls[0][0] as { id: string }[]).map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe("menu reads", () => {
  function setup(menuMonth: jest.Mock) {
    const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
    const { MenuDayScreen } = jest.requireActual("../src/menu/MenuDayScreen") as typeof import("../src/menu/MenuDayScreen");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mm" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerOperations: jest.fn(async () => ({
        caterer: { id: "k-1", name: "Dapur" },
        dishes: [],
        datedMenus: [],
        offers: [
          {
            id: "p-1",
            name: "Makan Siang Rumahan",
            status: "published",
            meal: "lunch",
            weekdays: [1, 2, 3, 4, 5],
            contentRevision: 2,
            menus: [{ meal: "lunch", name: "Makan Siang", description: "", image: "", composition }],
          },
        ],
      })),
      menuMonth,
    } as unknown as typeof runtime.api;
    const wrap = (node: React.ReactNode) => (
      <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
        {node}
      </MobileProvider>
    );
    return { wrap, MenuWeek, MenuDayScreen };
  }

  it("asks the API for the month as YYYY-MM-01", async () => {
    const menuMonth = jest.fn(async () => ({ dates: [], categories: [] }));
    const { wrap, MenuWeek } = setup(menuMonth);
    render(wrap(<MenuWeek />));
    await waitFor(() => expect(menuMonth).toHaveBeenCalled());
    for (const call of menuMonth.mock.calls as unknown as unknown[][]) {
      expect(call[0]).toBe("p-1");
      expect(call[1]).toBe(2);
      expect(call[2]).toMatch(/^\d{4}-(0[1-9]|1[0-2])-01$/);
      expect(call[3]).toBe("lunch");
    }
  });

  it("reads a single day with the same month format", async () => {
    const menuMonth = jest.fn(async () => ({ dates: [], categories: [] }));
    const { wrap, MenuDayScreen } = setup(menuMonth);
    render(wrap(<MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />));
    await waitFor(() => expect(menuMonth).toHaveBeenCalled());
    expect((menuMonth.mock.calls[0] as unknown as unknown[])[2]).toBe("2026-10-01");
  });

  it("shows a plain error with Coba lagi when the menu read fails, and retries", async () => {
    const menuMonth = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("400"), { code: "VALIDATION_FAILED" }))
      .mockResolvedValue({ dates: [], categories: [] });
    const { wrap, MenuWeek } = setup(menuMonth);
    render(wrap(<MenuWeek />));
    expect(await screen.findByText("Menu belum bisa dimuat.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(screen.queryByText("Menu belum bisa dimuat.")).toBeNull());
    expect(menuMonth.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the same retry state on the day screen instead of loading forever", async () => {
    const menuMonth = jest.fn().mockRejectedValue(new Error("400"));
    const { wrap, MenuDayScreen } = setup(menuMonth);
    render(wrap(<MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />));
    expect(await screen.findByText("Menu belum bisa dimuat.")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });
});

describe("menu day with an unknown package", () => {
  it("says the package wasn't found and offers Kembali instead of loading forever", async () => {
    const { router } = require("expo-router") as { router: { back: jest.Mock } };
    const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const { MenuDayScreen } = jest.requireActual("../src/menu/MenuDayScreen") as typeof import("../src/menu/MenuDayScreen");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mp" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers: [] })),
      menuMonth: jest.fn(async () => ({ dates: [], categories: [] })),
    } as unknown as typeof runtime.api;
    render(
      <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
        <MenuDayScreen date="2026-10-07" packageId="p-gone" meal="lunch" />
      </MobileProvider>,
    );
    expect(await screen.findByText("Paket ini tidak ditemukan.")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Kembali" }));
    expect(router.back).toHaveBeenCalled();
  });
});
