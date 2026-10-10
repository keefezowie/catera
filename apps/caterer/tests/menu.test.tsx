import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ActivityIndicator, Image, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import type { LibraryDish, MealMenu } from "@catera/domain";
import { contrastRatio, nativeMood, nativeThemes } from "@catera/design-tokens";
import { MoodProvider } from "@catera/mobile-ui";
import { uploadPhoto } from "../src/business/upload";
import { copyWeekBatches, dayComplete, saveMenuDay, suggestDishes, weekDates, weekRange } from "../src/menu/logic";
import { SlotEditor } from "../src/menu/SlotEditor";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("../src/business/upload", () => ({ uploadPhoto: jest.fn() }));
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

    it("shows localized dates, never raw ones", async () => {
      const { wrap, MenuWeek } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
      render(wrap(<MenuWeek />));
      expect(await screen.findByText("5–9 Okt")).toBeTruthy();
      // Today is selected, so its card carries the full date; every strip button names its day.
      expect(await screen.findByText("Kamis 8 Okt")).toBeTruthy();
      expect(screen.getByRole("button", { name: /Senin 5 Okt/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Jumat 9 Okt/ })).toBeTruthy();
      expect(screen.queryByText("2026-10-05")).toBeNull();
    });

    it("does not ask to fill past days", async () => {
      const open = (date: string, editable: boolean) => ({ date, version: 0, editable, details: null });
      // Production: today's cutoff has passed (closed), a later day is still open to fill, and past days are closed.
      const { wrap, MenuWeek } = setup(
        jest.fn(async () => ({
          dates: [open("2026-10-05", false), open("2026-10-08", false), open("2026-10-09", true)],
          categories: [],
        })),
      );
      render(wrap(<MenuWeek />));
      // Friday is open to fill: a to-do with its action.
      await screen.findByText("5–9 Okt");
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      expect(await screen.findByText("Belum diisi")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Ubah menu" })).toBeTruthy();
      // Monday is behind us: it says so and offers no editor.
      fireEvent.press(screen.getByTestId("menu-day-2026-10-05"));
      expect(screen.getByText("Lewat")).toBeTruthy();
      expect(screen.queryByText("Belum diisi")).toBeNull();
      expect(screen.queryByRole("button", { name: "Ubah menu" })).toBeNull();
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
    // Thursday 8 October 2026, 12.00 in Jakarta, so last week is Monday 28 September to Sunday 4 October whatever day
    // the suite runs. Only the clock is pinned: timers and microtasks keep running.
    jest.useFakeTimers({
      now: new Date("2026-10-08T05:00:00Z"),
      doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "performance"],
    });
    try {
      const lastWeek = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map(
        (date) => ({
          date,
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
        }),
      );
      runtimeFor(jest.fn(async () => ({ dates: lastWeek, categories: [] })));
      await waitFor(() => expect(disabled("Salin minggu lalu")).toBe(false));
      expect(screen.queryByText("Minggu lalu belum ada menu untuk disalin")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
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

describe("weekRange", () => {
  it("collapses the month when the week stays in one", () => {
    expect(weekRange(["2026-10-05", "2026-10-06", "2026-10-09"], "id")).toBe("5–9 Okt");
    expect(weekRange(["2026-10-05", "2026-10-09"], "en")).toBe("5–9 Oct");
  });
  it("names both months across a month end, and a single day alone", () => {
    expect(weekRange(["2026-09-28", "2026-10-02"], "id")).toBe("28 Sep–2 Okt");
    expect(weekRange(["2026-10-08"], "id")).toBe("8 Okt");
    expect(weekRange([], "id")).toBe("");
  });
});

describe("saveMenuDay", () => {
  it("writes one day through menu.saveBatch with the package's own template", async () => {
    const command = jest.fn(async () => ({}));
    const items = [item("a", "g-lauk", "main", "Ayam")];
    await saveMenuDay(
      { command },
      {
        catererId: "k-1",
        offer: {
          id: "p-1",
          contentRevision: 2,
          menus: [{ meal: "lunch", name: "Makan Siang", description: "", image: "", composition, source: "initial" }],
        },
        meal: "lunch",
        day: { date: "2026-10-07", version: 4, editable: true, details: null },
        items,
      },
    );
    expect(command).toHaveBeenCalledWith("menu.saveBatch", {
      catererId: "k-1",
      packageId: "p-1",
      contentRevision: 2,
      meal: "lunch",
      dates: [{ date: "2026-10-07", version: 4 }],
      details: { name: "Makan Siang", description: "", image: "", composition, contentModel: "slots", items },
    });
  });
});

describe("Menu week header, strip, day card and photo prompt", () => {
  const NOW = "2026-10-08T05:00:00Z"; // Thursday 12.00 in Jakarta
  const MALAM = "2026-10-08T09:00:00Z"; // 16.00 in Jakarta, so the launch mood is Malam
  const kept = [
    "nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    "queueMicrotask", "performance", "requestAnimationFrame", "cancelAnimationFrame",
  ] as const;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(NOW), doNotFake: [...kept] });
  });
  afterEach(() => jest.useRealTimers());

  const food = (id: string, groupId: string, categoryId: string, name: string, image = "") => ({
    ...item(id, groupId, categoryId, name),
    image,
  });
  const dishes = [
    food("i-nasi", "g-nasi", "rice", "Nasi putih", "https://cdn.test/nasi.jpg"),
    food("i-ayam", "g-lauk", "main", "Ayam goreng"),
    food("i-tempe", "g-lauk", "main", "Tempe bacem", "https://cdn.test/tempe.jpg"),
    food("i-sayur", "g-sayur", "vegetable", "Sayur asem"),
  ];
  const menuOf = (items: typeof dishes, meal = "lunch") =>
    ({ name: "Makan Siang", description: "", image: "", meal, composition, items }) as unknown as MealMenu;
  const filled = (date: string, items = dishes, editable = true) => ({ date, version: 3, editable, details: menuOf(items) });
  const template = (meal: string) => ({ meal, name: "Makan Siang", description: "", image: "", composition });
  const offerOf = (over: Record<string, unknown> = {}) => ({
    id: "p-1",
    name: "Makan Siang Rumahan",
    status: "published",
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    contentRevision: 2,
    image: "https://cdn.test/paket.jpg",
    menus: [template("lunch")],
    ...over,
  });
  const bothOffer = () => offerOf({ meal: "both", menus: [template("lunch"), template("dinner")] });

  function mount({
    offers = [offerOf()],
    dates = [] as unknown[],
    role = "owner",
    launch = NOW,
    unread = false,
  }: {
    offers?: unknown[];
    // The week as the API returns it; a function is asked again on every read, so a test can change the data in between.
    dates?: unknown[] | (() => unknown[]);
    role?: string;
    launch?: string;
    unread?: boolean;
  } = {}) {
    const { createMobileRuntime, MobileProvider, useMobile } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mw" });
    // `unread` keeps the week's read pending forever, to look at the screen while it loads.
    const menuMonth = jest.fn(async () => {
      if (unread) return new Promise(() => undefined);
      return { dates: typeof dates === "function" ? dates() : dates, categories: [] };
    });
    const command = jest.fn(async () => ({}));
    // A sibling that sends a command of its own, which refreshes every read like a save or a push would.
    let refresh: () => Promise<unknown> = async () => undefined;
    const Refresher = () => {
      const mobile = useMobile();
      refresh = () => mobile.command("refresh", {});
      return null;
    };
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role, catererId: "k-1" }, demo: false })),
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers })),
      menuMonth,
      command,
    } as unknown as typeof runtime.api;
    render(
      <MoodProvider now={() => new Date(launch)}>
        <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
          <Refresher />
          <MenuWeek />
        </MobileProvider>
      </MoodProvider>,
    );
    return { runtime, menuMonth, command, refresh: () => act(async () => void (await refresh())) };
  }
  const flatOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
  const mealsAsked = (menuMonth: jest.Mock) => [...new Set((menuMonth.mock.calls as unknown as unknown[][]).map((c) => c[3]))];

  describe("header", () => {
    it("titles the header with the week range", async () => {
      mount();
      const title = await screen.findByText("5–9 Okt");
      expect(title.props.accessibilityRole).toBe("header");
      expect(StyleSheet.flatten(title.props.style).color).toBe(nativeMood.light.siang.headerText);
    });

    it("steps to the other week and renames the range", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      fireEvent.press(screen.getByRole("button", { name: "Minggu berikutnya" }));
      expect(await screen.findByText("12–16 Okt")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Minggu sebelumnya" }));
      expect(await screen.findByText("5–9 Okt")).toBeTruthy();
    });

    it("the toggle picks the meal for a package that serves both", async () => {
      const { menuMonth } = mount({ offers: [bothOffer()] });
      await screen.findByText("5–9 Okt");
      expect(mealsAsked(menuMonth)).toEqual(["lunch"]);
      expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(true);
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      await waitFor(() => expect(mealsAsked(menuMonth)).toContain("dinner"));
      expect(screen.queryByText(/hanya untuk/)).toBeNull();
    });

    it("opens in Malam when the launch mood is Malam", async () => {
      const { menuMonth } = mount({ offers: [bothOffer()], launch: MALAM });
      await screen.findByText("5–9 Okt");
      expect(mealsAsked(menuMonth)).toEqual(["dinner"]);
      expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    });

    it("a lunch-only package keeps its own meal in Malam, with a caption and no toggle", async () => {
      const { menuMonth } = mount({ launch: MALAM });
      expect(await screen.findByText("Paket ini hanya untuk makan siang")).toBeTruthy();
      expect(mealsAsked(menuMonth)).toEqual(["lunch"]);
      expect(screen.queryAllByRole("tab")).toHaveLength(0);
    });

    it("a dinner-only package keeps its own meal in Siang", async () => {
      const { menuMonth } = mount({ offers: [offerOf({ meal: "dinner", menus: [template("dinner")] })] });
      expect(await screen.findByText("Paket ini hanya untuk makan malam")).toBeTruthy();
      expect(mealsAsked(menuMonth)).toEqual(["dinner"]);
    });

    it("keeps the header while the packages load", async () => {
      const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
      const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
      const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mh" });
      runtime.api = {
        ...runtime.api,
        me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
        sellerOperations: jest.fn(() => new Promise(() => undefined)),
      } as unknown as typeof runtime.api;
      render(
        <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
          <MenuWeek />
        </MobileProvider>,
      );
      expect(await screen.findByText("Memuat…")).toBeTruthy();
      expect(screen.getByTestId("mood-header")).toBeTruthy();
      expect(screen.getByText("Menu").props.accessibilityRole).toBe("header");
    });
  });

  describe("day strip", () => {
    it("renders one 64dp button per delivery date, with weekday, date and a check for a filled day", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("5–9 Okt");
      const buttons = screen.getAllByTestId(/^menu-day-/);
      expect(buttons.map((b) => b.props.testID)).toEqual([
        "menu-day-2026-10-05",
        "menu-day-2026-10-06",
        "menu-day-2026-10-07",
        "menu-day-2026-10-08",
        "menu-day-2026-10-09",
      ]);
      for (const b of buttons) expect(StyleSheet.flatten(b.props.style).minHeight).toBe(64);
      const thursday = screen.getByTestId("menu-day-2026-10-08");
      expect(within(thursday).getByText("Kam")).toBeTruthy();
      expect(within(thursday).getByText("8")).toBeTruthy();
      await waitFor(() => expect(within(thursday).UNSAFE_queryByType(Ionicons)).not.toBeNull());
      expect(within(thursday).UNSAFE_getByType(Ionicons).props.name).toBe("checkmark-circle");
      expect(within(screen.getByTestId("menu-day-2026-10-09")).UNSAFE_queryByType(Ionicons)).toBeNull();
      expect(thursday.props.accessibilityLabel).toBe("Kamis 8 Okt, hari ini, menu terisi");
      expect(screen.getByTestId("menu-day-2026-10-09").props.accessibilityLabel).toBe("Jumat 9 Okt, menu belum diisi");
    });

    it("draws today with a sunrise ink ring and the selected day with a forest fill", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      const light = nativeThemes.light;
      // Today starts selected.
      expect(flatOf("menu-day-2026-10-08")).toMatchObject({ backgroundColor: light.forest, borderColor: light.sunriseInk });
      expect(light.sunriseInk).toBe(nativeMood.light.siang.todayRing);
      // Any other day has neither.
      const friday = flatOf("menu-day-2026-10-09");
      expect(friday.backgroundColor).not.toBe(light.forest);
      expect(friday.borderColor).not.toBe(light.sunriseInk);
    });

    it("reads the mood's ring colour on a Malam header", async () => {
      mount({ launch: MALAM });
      await screen.findByText("5–9 Okt");
      expect(flatOf("menu-day-2026-10-08").borderColor).toBe(nativeMood.light.malam.todayRing);
    });

    it("tapping a day selects it without leaving the screen", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      expect(flatOf("menu-day-2026-10-09").backgroundColor).toBe(nativeThemes.light.forest);
      expect(screen.getByTestId("menu-day-2026-10-09").props.accessibilityState.selected).toBe(true);
      // Today loses the fill but keeps its ring.
      expect(flatOf("menu-day-2026-10-08").backgroundColor).not.toBe(nativeThemes.light.forest);
      expect(flatOf("menu-day-2026-10-08").borderColor).toBe(nativeThemes.light.sunriseInk);
      expect(await screen.findByText("Jumat 9 Okt")).toBeTruthy();
      expect(require("expo-router").router.push).not.toHaveBeenCalled();
    });

    it("shows the selected day on a Malam header: an inverted fill that stands out, in the mood's own tokens", async () => {
      mount({ launch: MALAM });
      await screen.findByText("5–9 Okt");
      const malam = nativeMood.light.malam;
      // Today (selected) keeps its ring and takes the inverted fill and ink.
      const thursday = screen.getByTestId("menu-day-2026-10-08");
      expect(flatOf("menu-day-2026-10-08")).toMatchObject({ backgroundColor: malam.headerText, borderColor: malam.todayRing });
      expect(StyleSheet.flatten(within(thursday).getByText("8").props.style).color).toBe(malam.header);
      expect(contrastRatio(malam.headerText, malam.header)).toBeGreaterThanOrEqual(3);
      // A selected day that is not today is outlined in the same token.
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      expect(flatOf("menu-day-2026-10-09")).toMatchObject({ backgroundColor: malam.headerText, borderColor: malam.headerText });
      // An unselected day has no fill.
      expect(flatOf("menu-day-2026-10-06").backgroundColor).toBe("transparent");
    });

    it("spreads seven delivery days over balanced rows, with no stretched button", async () => {
      mount({ offers: [offerOf({ weekdays: [0, 1, 2, 3, 4, 5, 6] })] });
      await screen.findByText("5–11 Okt");
      // A 360dp phone leaves 320dp inside the header: 4 buttons then 3, never 6 then 1.
      fireEvent(screen.getByTestId("menu-strip"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 64 } } });
      const buttons = screen.getAllByTestId(/^menu-day-/);
      expect(buttons).toHaveLength(7);
      const styles = buttons.map((b) => StyleSheet.flatten(b.props.style));
      expect(new Set(styles.map((s) => s.width)).size).toBe(1);
      expect(styles[0].width).toBe(75);
      for (const s of styles) expect(s.flexGrow).toBe(0);
      expect(4 * (styles[0].width as number) + 3 * 6).toBeLessThanOrEqual(320);
      expect(5 * (styles[0].width as number) + 4 * 6).toBeGreaterThan(320);
    });

    it("keeps one row of equal buttons for five days", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      fireEvent(screen.getByTestId("menu-strip"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 64 } } });
      const widths = screen.getAllByTestId(/^menu-day-/).map((b) => StyleSheet.flatten(b.props.style).width);
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBe(59);
    });

    it("does not call a day unfilled before the week has been read", async () => {
      mount({ unread: true });
      await screen.findByText("5–9 Okt");
      const buttons = screen.getAllByTestId(/^menu-day-/);
      for (const b of buttons) {
        expect(b.props.accessibilityLabel).not.toMatch(/belum diisi/);
        expect(within(b).UNSAFE_queryByType(Ionicons)).toBeNull();
      }
      expect(screen.getByTestId("menu-day-2026-10-08").props.accessibilityLabel).toBe("Kamis 8 Okt, hari ini");
    });
  });

  describe("day card", () => {
    it("lists the dishes under their composition group, with a dashed camera tile where a photo is missing", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      for (const label of ["Nasi", "Lauk", "Sayur"]) expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText("Ayam goreng")).toBeTruthy();
      expect(screen.getByText("Tempe bacem")).toBeTruthy();
      expect(flatOf("menu-photo-tile-i-ayam")).toMatchObject({ borderStyle: "dashed", borderColor: nativeThemes.light.controlRing });
      expect(screen.getByTestId("menu-photo-tile-i-sayur", { includeHiddenElements: true })).toBeTruthy();
      // The dishes that have a photo show it and offer nothing.
      expect(screen.queryByTestId("menu-photo-tile-i-nasi", { includeHiddenElements: true })).toBeNull();
      expect(within(screen.getByTestId("menu-dish-photo-i-nasi")).UNSAFE_getByType(Image).props.source).toEqual({ uri: "https://cdn.test/nasi.jpg" });
      // The corners are rounded by the Image itself, not clipped by its parent: on Android a photo that finishes loading
      // inside an `overflow: hidden` rounded view stayed blank until the screen was reopened.
      expect(flatOf("menu-dish-photo-i-nasi").overflow).toBeUndefined();
      expect(StyleSheet.flatten(within(screen.getByTestId("menu-dish-photo-i-nasi")).UNSAFE_getByType(Image).props.style)).toMatchObject({ borderRadius: 12 });
      expect(screen.getAllByText("Tambah foto")).toHaveLength(2);
    });

    it("calls an empty day past its change cutoff closed, in muted ink with no action", async () => {
      // Today in production: the cutoff was yesterday, so nothing can be filled and nothing is asked of the caterer.
      mount({ dates: [{ date: "2026-10-08", version: 0, editable: false, details: null }] });
      const label = await screen.findByText("Sudah lewat batas ubah");
      expect(StyleSheet.flatten(label.props.style).color).toBe(nativeThemes.light.muted);
      expect(screen.queryByText("Belum diisi")).toBeNull();
      expect(screen.queryByText("Lewat")).toBeNull();
      expect(screen.queryByRole("button", { name: "Ubah menu" })).toBeNull();
    });

    it("Ubah menu opens the day editor", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(screen.getByRole("button", { name: "Ubah menu" }));
      expect(require("expo-router").router.push).toHaveBeenCalledWith("/menu/2026-10-08?pkg=p-1&meal=lunch");
    });

    it("offers a helper no editing and no photo prompt", async () => {
      mount({ dates: [filled("2026-10-08")], role: "staff" });
      await screen.findByText("Nasi putih");
      expect(screen.queryByRole("button", { name: "Ubah menu" })).toBeNull();
      expect(screen.queryByText("Tambah foto")).toBeNull();
      // The dish still shows, without a pill; the tile is not a control.
      expect(screen.getByTestId("menu-photo-tile-i-ayam", { includeHiddenElements: true })).toBeTruthy();
    });
  });

  describe("photo prompt", () => {
    const asset = { uri: "file:///ayam.jpg", mimeType: "image/jpeg", fileSize: 1234 };
    const pick = ImagePicker.launchImageLibraryAsync as unknown as jest.Mock;
    const upload = uploadPhoto as unknown as jest.Mock;
    const ayamPill = () => screen.getByRole("button", { name: "Tambah foto, Ayam goreng" });

    it("uploads the picked photo, then saves that day's item only", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      const { runtime, command } = mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      await waitFor(() => expect(command).toHaveBeenCalled());
      expect(pick).toHaveBeenCalledWith({ mediaTypes: ["images"], quality: 0.8 });
      expect(upload).toHaveBeenCalledWith(runtime, asset, false);
      expect(command).toHaveBeenCalledWith(
        "menu.saveBatch",
        {
          catererId: "k-1",
          packageId: "p-1",
          contentRevision: 2,
          meal: "lunch",
          dates: [{ date: "2026-10-08", version: 3 }],
          details: {
            name: "Makan Siang",
            description: "",
            image: "",
            composition,
            contentModel: "slots",
            items: dishes.map((d) => (d.id === "i-ayam" ? { ...d, image: "https://cdn.test/ayam.jpg" } : d)),
          },
        },
        expect.any(String),
      );
      // Only the day's menu item changes: the library dish is never saved here.
      expect(command.mock.calls.every((call) => (call as unknown[])[0] === "menu.saveBatch")).toBe(true);
    });

    it("says Mengunggah… on the pill while the photo is on its way", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockReturnValue(new Promise(() => undefined));
      const { command } = mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      expect(await screen.findByText("Mengunggah…")).toBeTruthy();
      expect(command).not.toHaveBeenCalled();
      // One photo at a time: the other pill waits.
      expect(screen.getByRole("button", { name: "Tambah foto, Sayur asem" }).props.accessibilityState.disabled).toBe(true);
    });

    it("shows a selectable danger message when the upload fails, and saves nothing", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockRejectedValue(Object.assign(new Error("UPLOAD_FAILED"), { code: "UPLOAD_FAILED" }));
      const { command } = mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      const message = await screen.findByText("Foto gagal diunggah. Coba lagi.");
      expect(message.props.selectable).toBe(true);
      expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
      expect(command).not.toHaveBeenCalled();
      // The pill is back for another try.
      expect(screen.getByRole("button", { name: "Tambah foto, Ayam goreng" }).props.accessibilityState.disabled).toBeFalsy();
    });

    it("does nothing when the picker is cancelled", async () => {
      pick.mockResolvedValue({ canceled: true, assets: null });
      const { command } = mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      await waitFor(() => expect(pick).toHaveBeenCalled());
      expect(upload).not.toHaveBeenCalled();
      expect(command).not.toHaveBeenCalled();
      expect(screen.queryByText("Mengunggah…")).toBeNull();
      expect(screen.queryByText("Foto gagal diunggah. Coba lagi.")).toBeNull();
    });

    it("shows a failed save and reads the day again so a conflict can be retried", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      const { command, menuMonth } = mount({ dates: [filled("2026-10-08")] });
      command.mockRejectedValue(Object.assign(new Error("boom"), { code: "CONFLICT" }));
      await screen.findByText("Nasi putih");
      const reads = menuMonth.mock.calls.length;
      fireEvent.press(ayamPill());
      await waitFor(() => expect(command).toHaveBeenCalled());
      const message = await screen.findByText("Data sudah berubah. Muat ulang sebelum mencoba lagi.");
      expect(message.props.selectable).toBe(true);
      expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
      await waitFor(() => expect(menuMonth.mock.calls.length).toBeGreaterThan(reads));
      // The pill is available again for the retry.
      await waitFor(() => expect(ayamPill().props.accessibilityState.disabled).toBeFalsy());
      expect(screen.queryByText("Mengunggah…")).toBeNull();
    });

    it("opens the picker once when the pill is tapped twice before anything re-renders", async () => {
      pick.mockReturnValue(new Promise(() => undefined));
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      const pill = ayamPill();
      // Both taps land inside one act, so the pill has not had the chance to disable itself: only the guard stops the second.
      act(() => {
        fireEvent.press(pill);
        fireEvent.press(pill);
      });
      expect(pick).toHaveBeenCalledTimes(1);
    });

    it("keeps the saved dish uploading and every pill off until a read carries the photo", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      // The first read after the save still has the old week (no photo, same version); a later one has the photo.
      let phase: "before" | "stale" | "fresh" = "before";
      const withPhoto = dishes.map((d) => (d.id === "i-ayam" ? { ...d, image: "https://cdn.test/ayam.jpg" } : d));
      const { command, menuMonth, refresh } = mount({
        dates: () => [{ ...filled("2026-10-08", phase === "fresh" ? withPhoto : dishes), version: phase === "fresh" ? 4 : 3 }],
      });
      command.mockImplementation(async (action: string) => {
        if (action === "menu.saveBatch") phase = "stale";
        return {};
      });
      await screen.findByText("Nasi putih");
      const reads = menuMonth.mock.calls.length;
      fireEvent.press(ayamPill());
      await waitFor(() => expect(command).toHaveBeenCalled());
      // The read that follows the save lands without the photo.
      await waitFor(() => expect(menuMonth.mock.calls.length).toBeGreaterThan(reads));
      await act(async () => undefined);
      await act(async () => undefined);
      // The dish is still being saved: no empty tile, a pill that says so, and nothing else can be tapped.
      expect(screen.getByText("Mengunggah…")).toBeTruthy();
      expect(screen.queryByTestId("menu-photo-tile-i-ayam", { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId("menu-photo-pending-i-ayam", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Tambah foto, Ayam goreng" }).props.accessibilityState.disabled).toBe(true);
      expect(screen.getByRole("button", { name: "Tambah foto, Sayur asem" }).props.accessibilityState.disabled).toBe(true);
      // A later read brings the photo: the dish shows it and the other pill is free again.
      phase = "fresh";
      await refresh();
      await waitFor(() => expect(screen.queryByRole("button", { name: "Tambah foto, Ayam goreng" })).toBeNull());
      expect(within(screen.getByTestId("menu-dish-photo-i-ayam")).UNSAFE_getByType(Image).props.source).toEqual({ uri: "https://cdn.test/ayam.jpg" });
      expect(screen.queryByText("Mengunggah…")).toBeNull();
      expect(screen.getByRole("button", { name: "Tambah foto, Sayur asem" }).props.accessibilityState.disabled).toBeFalsy();
    });

    it("keeps Mengunggah… on the day being uploaded, not on another day's dish in the same slot", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockReturnValue(new Promise(() => undefined));
      // Friday has the same slots as Thursday, so the same dish ids.
      mount({ dates: [filled("2026-10-08"), filled("2026-10-09")] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      expect(await screen.findByText("Mengunggah…")).toBeTruthy();
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      await screen.findByText("Jumat 9 Okt");
      expect(screen.queryByText("Mengunggah…")).toBeNull();
      expect(screen.queryByTestId("menu-photo-pending-i-ayam", { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId("menu-photo-tile-i-ayam", { includeHiddenElements: true })).toBeTruthy();
      // Still one photo at a time: Friday's pill waits too.
      expect(ayamPill().props.accessibilityState.disabled).toBe(true);
      // Back on Thursday the upload is still shown.
      fireEvent.press(screen.getByTestId("menu-day-2026-10-08"));
      expect(await screen.findByText("Mengunggah…")).toBeTruthy();
      expect(screen.getByTestId("menu-photo-pending-i-ayam", { includeHiddenElements: true })).toBeTruthy();
    });

    it("keeps the wait for the fresh week on the saved day only", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      // Every read after the save is stale (no photo, same version), so the wait lasts.
      const { command, menuMonth } = mount({ dates: () => [filled("2026-10-08"), filled("2026-10-09")] });
      await screen.findByText("Nasi putih");
      const reads = menuMonth.mock.calls.length;
      fireEvent.press(ayamPill());
      await waitFor(() => expect(command).toHaveBeenCalled());
      await waitFor(() => expect(menuMonth.mock.calls.length).toBeGreaterThan(reads));
      await act(async () => undefined);
      await act(async () => undefined);
      expect(screen.getByText("Mengunggah…")).toBeTruthy();
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      await screen.findByText("Jumat 9 Okt");
      expect(screen.queryByText("Mengunggah…")).toBeNull();
      expect(screen.queryByTestId("menu-photo-pending-i-ayam", { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId("menu-photo-tile-i-ayam", { includeHiddenElements: true })).toBeTruthy();
      expect(ayamPill().props.accessibilityState.disabled).toBe(true);
      fireEvent.press(screen.getByTestId("menu-day-2026-10-08"));
      expect(await screen.findByText("Mengunggah…")).toBeTruthy();
      expect(screen.getByTestId("menu-photo-pending-i-ayam", { includeHiddenElements: true })).toBeTruthy();
    });

    it("shows a hidden system spinner in the pill while uploading, and none otherwise", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockReturnValue(new Promise(() => undefined));
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      fireEvent.press(ayamPill());
      await screen.findByText("Mengunggah…");
      const spinner = screen.getByTestId("menu-photo-spinner-i-ayam", { includeHiddenElements: true });
      expect(spinner.props.size).toBe("small");
      expect(spinner.props.color).toBe(nativeThemes.light.forest);
      expect(spinner.props.accessibilityElementsHidden).toBe(true);
      expect(spinner.props.importantForAccessibility).toBe("no-hide-descendants");
      // It sits inside the pill, beside the text, and only on the dish being uploaded.
      expect(within(ayamPill()).getByTestId("menu-photo-spinner-i-ayam", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
    });

    it("gives the pills back when the read after the save fails, so the caterer is never stuck", async () => {
      pick.mockResolvedValue({ canceled: false, assets: [asset] });
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      let failing = false;
      const { command } = mount({
        dates: () => {
          if (failing) throw Object.assign(new Error("offline"), { code: "REQUEST_TIMEOUT" });
          return [filled("2026-10-08")];
        },
      });
      command.mockImplementation(async () => {
        failing = true;
        return {};
      });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      await waitFor(() => expect(command).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText("Mengunggah…")).toBeNull());
      expect(ayamPill().props.accessibilityState.disabled).toBeFalsy();
    });

    it("saves against the version the week was reloaded to while the picker was open", async () => {
      let version = 3;
      let choose: (value: unknown) => void = () => undefined;
      pick.mockReturnValue(new Promise((resolve) => (choose = resolve)));
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      const { command, menuMonth, refresh } = mount({ dates: () => [{ ...filled("2026-10-08"), version }] });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      // While the picker is open, someone else changes the day: it moves to version 4 and the week is read again.
      version = 4;
      const reads = menuMonth.mock.calls.length;
      await refresh();
      await waitFor(() => expect(menuMonth.mock.calls.length).toBeGreaterThan(reads));
      await act(async () => undefined);
      await act(async () => choose({ canceled: false, assets: [asset] }));
      await waitFor(() => expect(command.mock.calls.some((c) => (c as unknown[])[0] === "menu.saveBatch")).toBe(true));
      const save = command.mock.calls.find((c) => (c as unknown[])[0] === "menu.saveBatch") as unknown as [string, { dates: unknown }];
      expect(save[1].dates).toEqual([{ date: "2026-10-08", version: 4 }]);
    });

    it("says the menu changed when the dish is gone by the time the photo is ready, and reads the day again", async () => {
      let gone = false;
      let choose: (value: unknown) => void = () => undefined;
      pick.mockReturnValue(new Promise((resolve) => (choose = resolve)));
      upload.mockResolvedValue("https://cdn.test/ayam.jpg");
      const { command, menuMonth, refresh } = mount({
        dates: () => [filled("2026-10-08", gone ? dishes.filter((d) => d.id !== "i-ayam") : dishes)],
      });
      await screen.findByText("Nasi putih");
      fireEvent.press(ayamPill());
      gone = true;
      const reads = menuMonth.mock.calls.length;
      await refresh();
      await waitFor(() => expect(screen.queryByText("Ayam goreng")).toBeNull());
      const readsBefore = menuMonth.mock.calls.length;
      expect(readsBefore).toBeGreaterThan(reads);
      await act(async () => choose({ canceled: false, assets: [asset] }));
      const message = await screen.findByText("Menu sudah berubah. Coba lagi.");
      expect(message.props.selectable).toBe(true);
      expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
      expect(command.mock.calls.some((c) => (c as unknown[])[0] === "menu.saveBatch")).toBe(false);
      await waitFor(() => expect(menuMonth.mock.calls.length).toBeGreaterThan(readsBefore));
    });
  });

  describe("story preview", () => {
    it("shows the cover customers will see, from the main dish photo, with the caption", async () => {
      mount({ dates: [filled("2026-10-08", [{ ...dishes[1], image: "https://cdn.test/ayam.jpg" }, dishes[0], dishes[2], dishes[3]])] });
      expect(await screen.findByText("Tampilan di aplikasi pelanggan")).toBeTruthy();
      const cover = screen.getByTestId("story-cover");
      expect(within(cover).UNSAFE_getByType(Image).props.source).toEqual({ uri: "https://cdn.test/ayam.jpg" });
      expect(
        screen.getByText("Foto lauk utama jadi sampul menu besok. Menu tanpa foto memakai foto paket."),
      ).toBeTruthy();
    });

    it("falls back to the package photo for a menu without photos", async () => {
      const bare = dishes.map((d) => ({ ...d, image: "" }));
      mount({ dates: [filled("2026-10-08", bare)] });
      await screen.findByText("Tampilan di aplikasi pelanggan");
      expect(within(screen.getByTestId("story-cover")).UNSAFE_getByType(Image).props.source).toEqual({
        uri: "https://cdn.test/paket.jpg",
      });
    });

    const segment = (i: number) => flatOf(`story-segment-${i}`);
    const segmentCount = () => screen.queryAllByTestId(/^story-segment-/, { includeHiddenElements: true }).length;

    it("mirrors the customer story: two slides for a package that serves both, lunch active in Siang", async () => {
      mount({ offers: [bothOffer()], dates: [filled("2026-10-08")] });
      await screen.findByText("Tampilan di aplikasi pelanggan");
      expect(segmentCount()).toBe(2);
      expect(segment(0).opacity).toBe(1);
      expect(segment(1).opacity).toBe(0.4);
    });

    it("has dinner active in Malam", async () => {
      mount({ offers: [bothOffer()], dates: [filled("2026-10-08")], launch: MALAM });
      await screen.findByText("Tampilan di aplikasi pelanggan");
      expect(segmentCount()).toBe(2);
      expect(segment(0).opacity).toBe(1);
      expect(segment(1).opacity).toBe(1);
    });

    it("is a single slide for a single-meal package", async () => {
      mount({ dates: [filled("2026-10-08")], launch: MALAM });
      await screen.findByText("Tampilan di aplikasi pelanggan");
      expect(segmentCount()).toBe(1);
      expect(segment(0).opacity).toBe(1);
    });

    it("has no preview for a day without a menu", async () => {
      mount({ dates: [{ date: "2026-10-08", version: 0, editable: true, details: null }] });
      await screen.findByText("Belum diisi");
      expect(screen.queryByTestId("story-cover")).toBeNull();
      expect(screen.queryByText("Tampilan di aplikasi pelanggan")).toBeNull();
    });
  });

  it("MenuDayScreen saves through saveMenuDay", async () => {
    const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const { MenuDayScreen } = jest.requireActual("../src/menu/MenuDayScreen") as typeof import("../src/menu/MenuDayScreen");
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "md" });
    const command = jest.fn(async () => ({}));
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers: [offerOf()] })),
      menuMonth: jest.fn(async () => ({ dates: [{ ...filled("2026-10-07", [dishes[0], dishes[1], food("i-oseng", "g-lauk", "main", "Oseng"), dishes[3]]) }], categories: [] })),
      command,
    } as unknown as typeof runtime.api;
    render(
      <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
        <MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />
      </MobileProvider>,
    );
    const save = await screen.findByRole("button", { name: "Simpan menu" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan menu" }).props.accessibilityState.disabled).toBeFalsy());
    fireEvent.press(save);
    await waitFor(() => expect(command).toHaveBeenCalled());
    const [action, payload] = command.mock.calls[0] as unknown as [string, { dates: unknown; details: { items: unknown[]; contentModel: string } }];
    expect(action).toBe("menu.saveBatch");
    expect(payload.dates).toEqual([{ date: "2026-10-07", version: 3 }]);
    expect(payload.details.contentModel).toBe("slots");
    expect(payload.details.items).toHaveLength(4);
    expect(require("expo-router").router.back).toHaveBeenCalled();
  });
});
