import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
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

  describe("week cards", () => {
    // Only Date is faked, so waitFor and the data hooks keep real timers.
    beforeEach(() =>
      jest.useFakeTimers({
        now: new Date("2026-10-08T05:00:00Z"),
        doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "performance", "requestAnimationFrame", "cancelAnimationFrame"],
      }),
    );
    afterEach(() => jest.useRealTimers());

    it("shows localized dates", async () => {
      const { wrap, MenuWeek } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
      render(wrap(<MenuWeek />));
      expect(await screen.findByText("Senin 5 Okt")).toBeTruthy();
      expect(screen.getByText("Jumat 9 Okt")).toBeTruthy();
      expect(screen.queryByText("2026-10-05")).toBeNull();
    });

    it("day cards dim on press and keep opening the day editor", async () => {
      const { wrap, MenuWeek } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
      render(wrap(<MenuWeek />));
      await screen.findByText("Senin 5 Okt");
      const card = () => screen.getByRole("button", { name: /Jumat 9 Okt/ });
      const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
      expect(StyleSheet.flatten(card().props.style)?.opacity ?? 1).toBe(1);
      fireEvent(card(), "responderGrant", touch);
      expect(StyleSheet.flatten(card().props.style).opacity).toBe(0.7);
      fireEvent.press(card());
      expect(require("expo-router").router.push).toHaveBeenCalledWith("/menu/2026-10-09?pkg=p-1&meal=lunch");
    });

    it("does not ask to fill past days", async () => {
      const { wrap, MenuWeek } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
      render(wrap(<MenuWeek />));
      await screen.findByText("Senin 5 Okt");
      // Mon-Wed are behind us; Thu (today) and Fri are still open to fill.
      expect(screen.getAllByText("Lewat")).toHaveLength(3);
      expect(screen.getAllByText("Belum diisi · isi menu")).toHaveLength(2);
    });
  });

  it("MenuDayScreen has one heading: the header, not a second raw date", async () => {
    const { wrap, MenuDayScreen } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
    render(wrap(<MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />));
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.queryByText("2026-10-07")).toBeNull();
    expect(screen.queryAllByRole("header")).toHaveLength(0);
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
    const message = await screen.findByText("Menu belum bisa dimuat.");
    // Same as every Dapur read error: the message in the error colour and a text "Coba lagi".
    expect(StyleSheet.flatten(message.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Coba lagi" }).props.style).backgroundColor).not.toBe(require("@catera/design-tokens").nativeThemes.light.forest);
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(screen.queryByText("Menu belum bisa dimuat.")).toBeNull());
    expect(menuMonth.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the same retry state on the day screen instead of loading forever", async () => {
    const menuMonth = jest.fn().mockRejectedValue(new Error("400"));
    const { wrap, MenuDayScreen } = setup(menuMonth);
    render(wrap(<MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />));
    const message = await screen.findByText("Menu belum bisa dimuat.");
    expect(StyleSheet.flatten(message.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
    // The pushed screen keeps its header as the only heading.
    expect(screen.queryAllByRole("header")).toHaveLength(0);
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

describe("menu loading and sharing states", () => {
  function runtimeFor(menuMonth: jest.Mock, sellerOperations?: jest.Mock) {
    const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "ms" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerOperations:
        sellerOperations ??
        jest.fn(async () => ({
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
    return render(
      <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
        <MenuWeek />
      </MobileProvider>,
    );
  }
  const disabled = (name: string) => screen.getByRole("button", { name }).props.accessibilityState.disabled;

  it("Menu actions wait for data", async () => {
    runtimeFor(jest.fn(() => new Promise(() => undefined)));
    await screen.findByRole("button", { name: "Bagikan menu" });
    expect(screen.getByText("Memuat…")).toBeTruthy();
    expect(disabled("Salin minggu lalu")).toBe(true);
    expect(disabled("Bagikan menu")).toBe(true);
    expect(screen.queryByText("Belum ada menu untuk dibagikan")).toBeNull();
  });

  it("shows Memuat while the packages load, with no actions", async () => {
    runtimeFor(jest.fn(), jest.fn(() => new Promise(() => undefined)));
    expect(await screen.findByText("Memuat…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Bagikan menu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salin minggu lalu" })).toBeNull();
  });

  it("Bagikan menu disabled when nothing to share", async () => {
    runtimeFor(jest.fn(async () => ({ dates: [], categories: [] })));
    expect(await screen.findByText("Belum ada menu untuk dibagikan")).toBeTruthy();
    expect(disabled("Bagikan menu")).toBe(true);
  });

  it("Salin minggu lalu is disabled with a reason when last week has no menu", async () => {
    runtimeFor(jest.fn(async () => ({ dates: [], categories: [] })));
    expect(await screen.findByText("Minggu lalu belum ada menu untuk disalin")).toBeTruthy();
    expect(disabled("Salin minggu lalu")).toBe(true);
    expect(screen.queryByText(/hari disalin/)).toBeNull();
  });

  it("says it is loading last week while Salin minggu lalu waits for it", async () => {
    // Fake only the clock: this week is in November and last week in October, so the two reads can be told apart.
    jest.useFakeTimers({
      now: new Date("2026-11-04T05:00:00Z"),
      doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "performance"],
    });
    try {
      let release: (value: { dates: never[]; categories: never[] }) => void = () => undefined;
      const lastWeek = new Promise<{ dates: never[]; categories: never[] }>((resolve) => (release = resolve));
      const menuMonth = jest.fn((_offer: string, _rev: number, month: string) =>
        month === "2026-11-01" ? Promise.resolve({ dates: [], categories: [] }) : lastWeek,
      );
      runtimeFor(menuMonth as unknown as jest.Mock);
      expect(await screen.findByText("Memuat minggu lalu…")).toBeTruthy();
      expect(disabled("Salin minggu lalu")).toBe(true);
      await act(async () => release({ dates: [], categories: [] }));
      await waitFor(() => expect(screen.queryByText("Memuat minggu lalu…")).toBeNull());
    } finally {
      jest.useRealTimers();
    }
  });

  it("offers Salin minggu lalu once last week has a filled day", async () => {
    const lastWeek = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 86400000).toISOString().slice(0, 10),
      version: 1,
      editable: false,
      details: {
        name: "Makan Siang",
        description: "",
        image: "",
        meal: "lunch",
        composition,
        items: [{ id: "x", groupId: "g-lauk", categoryId: "main", name: "Ayam", description: "", image: "", serving: "" }],
      },
    }));
    runtimeFor(jest.fn(async () => ({ dates: lastWeek, categories: [] })));
    await waitFor(() => expect(disabled("Salin minggu lalu")).toBe(false));
    expect(screen.queryByText("Minggu lalu belum ada menu untuk disalin")).toBeNull();
  });

  it("offers Bagikan menu once a day of the week has dishes", async () => {
    const today = new Date();
    const dates = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() + (i - 7) * 86400000);
      return {
        date: d.toISOString().slice(0, 10),
        version: 1,
        editable: true,
        details: {
          name: "Makan Siang",
          description: "",
          image: "",
          meal: "lunch",
          composition,
          items: [{ id: "x", groupId: "g-lauk", categoryId: "main", name: "Ayam", description: "", image: "", serving: "" }],
        },
      };
    });
    runtimeFor(jest.fn(async () => ({ dates, categories: [] })));
    await waitFor(() => expect(disabled("Bagikan menu")).toBe(false));
    expect(screen.queryByText("Belum ada menu untuk dibagikan")).toBeNull();
  });
});

describe("SlotEditor touch targets", () => {
  it("remove and suggestion controls are 48dp", () => {
    render(
      <SlotEditor
        composition={composition}
        items={[item("g-lauk-1", "g-lauk", "main", "Tempe bacem")]}
        library={[dish("d-ikan", "Ikan bakar")]}
        usage={new Map()}
        onChange={() => undefined}
        onCreate={async () => dish("n", "x")}
        onSave={() => undefined}
        saving={false}
        canEdit
      />,
    );
    const remove = StyleSheet.flatten(screen.getByRole("button", { name: "Hapus Tempe bacem" }).props.style);
    expect([remove.width, remove.height]).toEqual([48, 48]);
    fireEvent.changeText(screen.getByLabelText("Lauk berikutnya"), "ikan");
    expect(StyleSheet.flatten(screen.getByRole("button", { name: /Ikan bakar/ }).props.style).minHeight).toBeGreaterThanOrEqual(48);
    const create = screen.getByRole("button", { name: /Buat hidangan baru/ });
    expect(StyleSheet.flatten(create.props.style).minHeight).toBeGreaterThanOrEqual(48);
  });
});
