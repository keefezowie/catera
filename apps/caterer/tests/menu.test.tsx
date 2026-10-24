import type { ComponentProps, ReactNode } from "react";
import { withMobile as withMobileBare } from "./with-mobile";
import { withDapurScale } from "./dapur-scale";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Image as PhotoImage } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import type { LibraryDish, MealMenu } from "@catera/domain";
import { contrastRatio, nativeMood, nativeThemes } from "@catera/design-tokens";
import { MoodProvider } from "@catera/mobile-ui";
import { uploadPhoto } from "../src/business/upload";
import { copyWeekBatches, dayComplete, saveMenuDay, suggestDishes, weekDates, weekRange } from "../src/menu/logic";
import { SlotEditor } from "../src/menu/SlotEditor";

/** Everything here mounts under the scale the Dapur root provides: v2 with a 48 touch target. */
const withMobile = (ui: ReactNode) => withDapurScale(withMobileBare(ui));
const scaled = (Provider: typeof import("@catera/mobile-core").MobileProvider) =>
  function ScaledProvider(props: ComponentProps<typeof Provider>) {
    return withDapurScale(<Provider {...props} />);
  };

/** The phone the screen is drawn on: a 411dp phone at the default text size unless a test says otherwise. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

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

it("SlotEditor draws one section header per group with its count, and no Save button: Simpan menu is the screen's pinned footer", () => {
  render(
    withMobile(<SlotEditor
      composition={composition}
      items={[item("a", "g-nasi", "rice", "Nasi putih"), item("b", "g-lauk", "main", "Ayam goreng kremes"), item("c", "g-sayur", "vegetable", "Sayur asem")]}
      library={[]}
      usage={new Map()}
      onChange={() => undefined}
      onCreate={async () => dish("n", "x")}
      canEdit
    />),
  );
  const headers = screen.getAllByTestId("section-header");
  expect(headers).toHaveLength(3);
  expect(within(headers[1]).getByText("Lauk")).toBeTruthy();
  expect(within(headers[1]).getByText("1 dari 2")).toBeTruthy();
  expect(within(headers[0]).getByText("1 dari 1")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Simpan menu" })).toBeNull();
});

it("does not offer helpers package creation on an empty menu", async () => {
  const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
  const MobileProvider = scaled(BaseProvider);
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
    withMobile(<SlotEditor
      composition={composition}
      items={[item("g-lauk-2", "g-lauk", "main", "Tempe bacem")]}
      library={[dish("d-ikan", "Ikan bakar")]}
      usage={new Map()}
      onChange={onChange}
      onCreate={async () => dish("n", "x")}
      canEdit
    />),
  );
  fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "ikan");
  fireEvent.press(screen.getByText("Ikan bakar"));
  const ids = (onChange.mock.calls[0][0] as { id: string }[]).map((i) => i.id);
  expect(new Set(ids).size).toBe(ids.length);
});

describe("menu reads", () => {
  function setup(menuMonth: jest.Mock) {
    const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const MobileProvider = scaled(BaseProvider);
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
      // A status, not an error: bold charcoal, never a bare danger caption.
      expect(StyleSheet.flatten(screen.getByText("Belum diisi").props.style)).toMatchObject({
        color: nativeThemes.light.charcoal,
        fontFamily: "Jakarta-Bold",
      });
      expect(screen.getByRole("button", { name: "Ubah menu" })).toBeTruthy();
      // Monday is behind us: it says so and offers no editor.
      fireEvent.press(screen.getByTestId("menu-day-2026-10-05"));
      expect(StyleSheet.flatten(screen.getByText("Lewat").props.style)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(screen.queryByText("Belum diisi")).toBeNull();
      expect(screen.queryByRole("button", { name: "Ubah menu" })).toBeNull();
    });
  });

  it("MenuDayScreen's only headings are its groups: the header carries the date, never a second raw one", async () => {
    const { wrap, MenuDayScreen } = setup(jest.fn(async () => ({ dates: [], categories: [] })));
    render(wrap(<MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />));
    expect(await screen.findByText("Makan Siang Rumahan · Makan siang")).toBeTruthy();
    expect(screen.queryByText("2026-10-07")).toBeNull();
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Nasi", "Lauk", "Sayur"]);
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
    const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const MobileProvider = scaled(BaseProvider);
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
    const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const MobileProvider = scaled(BaseProvider);
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
    expect(screen.getByLabelText("Memuat menu")).toBeTruthy();
    expect(disabled("Salin minggu lalu")).toBe(true);
    expect(disabled("Bagikan menu")).toBe(true);
    expect(screen.queryByText("Belum ada menu untuk dibagikan")).toBeNull();
  });

  it("shows the menu skeleton while the packages load, with no actions", async () => {
    runtimeFor(jest.fn(), jest.fn(() => new Promise(() => undefined)));
    expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
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
      withMobile(<SlotEditor
        composition={composition}
        items={[item("g-lauk-1", "g-lauk", "main", "Tempe bacem")]}
        library={[dish("d-ikan", "Ikan bakar")]}
        usage={new Map()}
        onChange={() => undefined}
        onCreate={async () => dish("n", "x")}
        canEdit
      />),
    );
    const remove = StyleSheet.flatten(screen.getByRole("button", { name: "Hapus Tempe bacem" }).props.style);
    expect([remove.width, remove.height]).toEqual([48, 48]);
    // A chosen dish is a 48 row in the group's list card, and the input that follows it is 48 too.
    expect(StyleSheet.flatten(screen.getByTestId("menu-slot-row-body").props.style)).toMatchObject({ minHeight: 48 });
    expect(within(screen.getAllByTestId("list-card")[1]).getByTestId("menu-slot-row-body")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByLabelText("Tambah lauk").props.style).minHeight).toBe(48);
    fireEvent.changeText(screen.getByLabelText("Tambah lauk"), "ikan");
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
    const { createMobileRuntime, MobileProvider: BaseProvider, useMobile } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const MobileProvider = scaled(BaseProvider);
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

    it("sets the week range in heroTitle (24/30) between two 44 chevrons, in one 44 row", async () => {
      mount();
      const title = await screen.findByText("5–9 Okt");
      expect(StyleSheet.flatten(title.props.style)).toMatchObject({ fontSize: 24, lineHeight: 30, textAlign: "center" });
      const row = screen.getByTestId("menu-title-row");
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" });
      // The range is the one text between the two arrows, and each arrow is a 44 square that reaches 48 by its slop.
      const [back, next] = [within(row).getByRole("button", { name: "Minggu sebelumnya" }), within(row).getByRole("button", { name: "Minggu berikutnya" })];
      for (const chevron of [back, next]) {
        expect(StyleSheet.flatten(chevron.props.style)).toMatchObject({ width: 44, height: 44 });
        expect(chevron.props.hitSlop).toEqual({ top: 2, bottom: 2, left: 2, right: 2 });
      }
      expect(within(row).getAllByRole("header")).toHaveLength(1);
      // The week label ("Minggu ini") is the header's own 44 row above it.
      expect(within(screen.getByTestId("mood-header-row")).getByText("Minggu ini")).toBeTruthy();
    });

    it("steps to the other week and renames the range", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      fireEvent.press(screen.getByRole("button", { name: "Minggu berikutnya" }));
      expect(await screen.findByText("12–16 Okt")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Minggu sebelumnya" }));
      expect(await screen.findByText("5–9 Okt")).toBeTruthy();
    });

    it("a helper's loaded week keeps the Pengaturan gear in the header row, and the Siang / Malam toggle in its own 48 frame", async () => {
      const { menuMonth } = mount({ offers: [bothOffer()], role: "staff" });
      await screen.findByText("5–9 Okt");
      const row = screen.getByTestId("mood-header-row");
      // The week label and the gear share the 44 row; the toggle is not in it any more.
      expect(within(row).getAllByRole("button").map((n) => n.props.accessibilityLabel)).toEqual(["Pengaturan"]);
      expect(within(row).queryAllByRole("tab")).toHaveLength(0);
      fireEvent.press(within(row).getByRole("button", { name: "Pengaturan" }));
      expect(require("expo-router").router.push).toHaveBeenLastCalledWith("/pengaturan");
      // The toggle still picks the meal, from its frame under the week range.
      const frame = screen.getByTestId("menu-meal-frame");
      fireEvent.press(within(frame).getByRole("tab", { name: "Malam" }));
      expect(within(frame).getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
      await waitFor(() => expect(mealsAsked(menuMonth)).toContain("dinner"));
      await act(async () => {});
    });

    it("sits on the v2 header: a 44 top row, a 12 gap, the mood band behind it", async () => {
      // Dapur's root mounts the v2 scale, so the shared header takes the 44 row (it was 48 on the classic scale).
      mount({ offers: [bothOffer()] });
      await screen.findByText("5–9 Okt");
      expect(StyleSheet.flatten(screen.getByTestId("mood-header-row").props.style)).toMatchObject({ minHeight: 44 });
      expect(StyleSheet.flatten(screen.getByTestId("mood-header-content").props.style)).toMatchObject({ gap: 12, paddingHorizontal: 16 });
      expect(StyleSheet.flatten(screen.getByTestId("mood-header").props.style)).toMatchObject({ overflow: "hidden", paddingBottom: 16 });
      expect(screen.getByTestId("mood-fill-siang")).toBeTruthy();
    });

    it("puts Siang / Malam in a 48 frame, only for a package that serves both meals", async () => {
      mount({ offers: [bothOffer()] });
      await screen.findByText("5–9 Okt");
      await act(async () => {});
      const frame = screen.getByTestId("menu-meal-frame");
      // A minimum, not a fixed height: the toggle's 48 tabs on a 3 track are 54 tall and must stay inside the frame.
      const style = StyleSheet.flatten(frame.props.style);
      expect(style).toMatchObject({ minHeight: 48, alignItems: "center", justifyContent: "center" });
      expect(style.height).toBeUndefined();
      expect(within(frame).getByRole("tab", { name: "Siang" })).toBeTruthy();
      // An owner has no gear: Pengaturan lives on Usaha.
      expect(screen.queryByRole("button", { name: "Pengaturan" })).toBeNull();
    });

    it("draws the toggle compact in the frame: a 34 track of a whole-dp width (so centring never lands on a half pixel), tabs reaching 48 by hitSlop 7", async () => {
      mount({ offers: [bothOffer()] });
      await screen.findByText("5–9 Okt");
      const frame = screen.getByTestId("menu-meal-frame");
      const [track] = frame.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist");
      const style = StyleSheet.flatten(track.props.style);
      expect(style).toMatchObject({ borderWidth: 1, padding: 1 });
      expect(Number.isInteger(style.width)).toBe(true);
      // Both tabs are as wide as the wider label and the track holds exactly the two plus its 2 + 2 edge: an even width.
      expect((style.width as number) % 2).toBe(0);
      for (const tab of within(frame).getAllByRole("tab")) {
        expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ height: 34, marginVertical: -2 });
        expect(tab.props.hitSlop).toEqual({ top: 7, bottom: 7 });
      }
    });

    it("draws no meal frame for a single-meal package", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      expect(screen.queryByTestId("menu-meal-frame")).toBeNull();
      expect(screen.queryAllByRole("tab")).toHaveLength(0);
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
      const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
      const MobileProvider = scaled(BaseProvider);
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
      expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
      expect(screen.getByTestId("mood-header")).toBeTruthy();
      expect(screen.getByText("Menu").props.accessibilityRole).toBe("header");
    });
  });

  describe("day strip", () => {
    it("renders one 56dp tile per delivery date, with weekday, date and a 6dp dot for a filled day", async () => {
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
      for (const b of buttons) expect(StyleSheet.flatten(b.props.style)).toMatchObject({ minHeight: 56, borderRadius: 12 });
      const thursday = screen.getByTestId("menu-day-2026-10-08");
      // The weekday is a meta line over the date in bodyStrong.
      expect(StyleSheet.flatten(within(thursday).getByText("Kam").props.style)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(StyleSheet.flatten(within(thursday).getByText("8").props.style)).toMatchObject({ fontSize: 15, lineHeight: 22 });
      // The state mark is a 6 dot, there only for a filled day (the empty days keep the same 6 square, so dates line up).
      await waitFor(() => expect(within(thursday).queryByTestId("menu-dot-2026-10-08")).not.toBeNull());
      expect(StyleSheet.flatten(within(thursday).getByTestId("menu-dot-2026-10-08").props.style)).toMatchObject({ width: 6, height: 6, borderRadius: 3 });
      expect(within(screen.getByTestId("menu-day-2026-10-09")).queryByTestId("menu-dot-2026-10-09")).toBeNull();
      expect(StyleSheet.flatten(within(screen.getByTestId("menu-day-2026-10-09")).getByTestId("menu-mark-2026-10-09").props.style)).toMatchObject({ width: 6, height: 6 });
      expect(thursday.props.accessibilityLabel).toBe("Kamis 8 Okt, hari ini, menu terisi");
      expect(screen.getByTestId("menu-day-2026-10-09").props.accessibilityLabel).toBe("Jumat 9 Okt, menu belum diisi");
    });

    it("draws today with a forest ring and the selected day with a filled chip", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      const light = nativeThemes.light;
      // Today starts selected.
      const mood = nativeMood.light.siang;
      // The chosen day is a selection (direction K rule 3), so its fill is forest (toggleActive), never the charcoal ink.
      expect(flatOf("menu-day-2026-10-08")).toMatchObject({ backgroundColor: mood.toggleActive, borderColor: mood.todayRing });
      expect(light.forest).toBe(mood.todayRing);
      expect(light.forest).toBe(mood.toggleActive);
      expect(flatOf("menu-day-2026-10-08").backgroundColor).not.toBe(mood.headerText);
      // Any other day has neither.
      const friday = flatOf("menu-day-2026-10-09");
      expect(friday.backgroundColor).not.toBe(mood.toggleActive);
      expect(friday.borderColor).not.toBe(mood.todayRing);
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
      expect(flatOf("menu-day-2026-10-09")).toMatchObject({
        backgroundColor: nativeMood.light.siang.toggleActive,
        borderColor: nativeMood.light.siang.toggleActive,
      });
      expect(screen.getByTestId("menu-day-2026-10-09").props.accessibilityState.selected).toBe(true);
      // Today loses the fill but keeps its ring.
      expect(flatOf("menu-day-2026-10-08").backgroundColor).toBe("transparent");
      expect(flatOf("menu-day-2026-10-08").borderColor).toBe(nativeMood.light.siang.todayRing);
      expect(await screen.findByText("Jumat 9 Okt")).toBeTruthy();
      expect(require("expo-router").router.push).not.toHaveBeenCalled();
    });

    it("shows the selected day on a Malam header: a forest fill that stands out, in the mood's own tokens", async () => {
      mount({ launch: MALAM });
      await screen.findByText("5–9 Okt");
      const malam = nativeMood.light.malam;
      // Today (selected) keeps its ring and takes the selected segment's fill and ink.
      const thursday = screen.getByTestId("menu-day-2026-10-08");
      expect(flatOf("menu-day-2026-10-08")).toMatchObject({ backgroundColor: malam.toggleActive, borderColor: malam.todayRing });
      expect(StyleSheet.flatten(within(thursday).getByText("8").props.style).color).toBe(malam.onToggleActive);
      expect(contrastRatio(malam.toggleActive, malam.header)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(malam.onToggleActive, malam.toggleActive)).toBeGreaterThanOrEqual(4.5);
      // A selected day that is not today is filled and outlined in the same token.
      fireEvent.press(screen.getByTestId("menu-day-2026-10-09"));
      expect(flatOf("menu-day-2026-10-09")).toMatchObject({ backgroundColor: malam.toggleActive, borderColor: malam.toggleActive });
      // An unselected day has no fill.
      expect(flatOf("menu-day-2026-10-06").backgroundColor).toBe("transparent");
    });

    // The old test "spreads seven delivery days over balanced rows" (4 + 3 on a 320 strip, width 75) is replaced by
    // these two: the strip is one row for any package, so seven days no longer wrap (Dapur layout spec 3.3).
    it.each([
      [412, 380, 51],
      [360, 328, 44],
    ])("lays seven delivery days in one row at %idp (strip %i): tile width (inner - 6 x 4) / 7, about %i, height 56", async (_dp, inner, about) => {
      mount({ offers: [offerOf({ weekdays: [0, 1, 2, 3, 4, 5, 6] })] });
      await screen.findByText("5–11 Okt");
      // The strip's own width is the window less the 16 margins: 412 - 32 = 380, 360 - 32 = 328.
      fireEvent(screen.getByTestId("menu-strip"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: inner, height: 56 } } });
      const strip = flatOf("menu-strip");
      expect(strip).toMatchObject({ flexDirection: "row", gap: 4 });
      expect(strip.flexWrap).not.toBe("wrap");
      const buttons = screen.getAllByTestId(/^menu-day-/);
      expect(buttons).toHaveLength(7);
      const styles = buttons.map((b) => StyleSheet.flatten(b.props.style));
      const width = (inner - 6 * 4) / 7;
      for (const s of styles) expect(s).toMatchObject({ flexGrow: 0, flexShrink: 0, minHeight: 56 });
      for (const s of styles) expect(s.width as number).toBeCloseTo(width, 5);
      expect(Math.abs(width - about)).toBeLessThan(1);
      // Seven tiles and six gaps fill the row exactly.
      expect(7 * (styles[0].width as number) + 6 * 4).toBeCloseTo(inner, 5);
    });

    it("keeps one row of equal tiles for five days, by the same formula", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      fireEvent(screen.getByTestId("menu-strip"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 380, height: 56 } } });
      const widths = screen.getAllByTestId(/^menu-day-/).map((b) => StyleSheet.flatten(b.props.style).width as number);
      expect(widths).toHaveLength(5);
      for (const w of widths) expect(w).toBeCloseTo((380 - 4 * 4) / 5, 5);
      expect(flatOf("menu-strip").flexWrap).not.toBe("wrap");
    });

    it("does not call a day unfilled before the week has been read", async () => {
      mount({ unread: true });
      await screen.findByText("5–9 Okt");
      const buttons = screen.getAllByTestId(/^menu-day-/);
      for (const b of buttons) {
        expect(b.props.accessibilityLabel).not.toMatch(/belum diisi/);
        expect(within(b).queryByTestId(/^menu-dot-/)).toBeNull();
      }
      expect(screen.getByTestId("menu-day-2026-10-08").props.accessibilityLabel).toBe("Kamis 8 Okt, hari ini");
    });
  });

  describe("controls", () => {
    const twoOffers = () => [offerOf(), offerOf({ id: "p-2", name: "Rantang Nusantara" })];

    it("holds the package chips in a 48 frame that scrolls sideways, each chip 34 with a 7 slop", async () => {
      mount({ offers: twoOffers() });
      await screen.findByText("5–9 Okt");
      const chips = screen.getByTestId("menu-package-chips");
      expect(chips.props.horizontal).toBe(true);
      // The frame is the scroll view's content: at least 48 tall, so the horizontal scroller never clips the slop.
      expect(StyleSheet.flatten(chips.props.contentContainerStyle).minHeight).toBeGreaterThanOrEqual(48);
      for (const name of ["Makan Siang Rumahan", "Rantang Nusantara"]) {
        const chip = within(chips).getByRole("button", { name });
        expect(chip.props.hitSlop).toEqual({ top: 7, bottom: 7 });
        expect(StyleSheet.flatten(chip.props.style).minHeight).toBe(34);
      }
    });

    it("an owner has Salin minggu lalu and Bagikan menu side by side, two 50 secondary buttons", async () => {
      mount();
      await screen.findByText("5–9 Okt");
      const row = screen.getByTestId("menu-actions");
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: "row", gap: 8 });
      const buttons = within(row).getAllByRole("button");
      expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(["Salin minggu lalu", "Bagikan menu"]);
      for (const b of buttons) expect(StyleSheet.flatten(b.props.style)).toMatchObject({ flex: 1, minHeight: 50, borderWidth: 1 });
    });

    it("stacks Salin minggu lalu over Bagikan menu below 400 effective width (360dp at font scale 1.3), each on its own line", async () => {
      mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
      try {
        mount();
        await screen.findByText("5–9 Okt");
        const row = screen.getByTestId("menu-actions");
        expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: "column", gap: 8 });
        const buttons = within(row).getAllByRole("button");
        expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(["Salin minggu lalu", "Bagikan menu"]);
        for (const b of buttons) {
          expect(StyleSheet.flatten(b.props.style).flex).toBeUndefined();
          expect(StyleSheet.flatten(b.props.style).minHeight).toBe(50);
        }
      } finally {
        mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
      }
    });

    it("keeps the pair side by side from 400 effective width (412dp at font scale 1.0), the same rule the customer's pair uses", async () => {
      mockWindow = { width: 412, height: 860, scale: 3, fontScale: 1 };
      try {
        mount();
        await screen.findByText("5–9 Okt");
        expect(StyleSheet.flatten(screen.getByTestId("menu-actions").props.style).flexDirection).toBe("row");
        for (const b of within(screen.getByTestId("menu-actions")).getAllByRole("button")) expect(StyleSheet.flatten(b.props.style).flex).toBe(1);
      } finally {
        mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
      }
    });

    it("a helper's lone Bagikan menu keeps its full-width row even where an owner's pair stacks", async () => {
      mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
      try {
        mount({ role: "staff" });
        await screen.findByText("5–9 Okt");
        expect(StyleSheet.flatten(screen.getByTestId("menu-actions").props.style).flexDirection).toBe("row");
        expect(StyleSheet.flatten(within(screen.getByTestId("menu-actions")).getByRole("button").props.style).flex).toBe(1);
      } finally {
        mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
      }
    });

    it("a helper has Bagikan menu alone, across the full width", async () => {
      mount({ role: "staff" });
      await screen.findByText("5–9 Okt");
      const buttons = within(screen.getByTestId("menu-actions")).getAllByRole("button");
      expect(buttons.map((b) => b.props.accessibilityLabel)).toEqual(["Bagikan menu"]);
      expect(StyleSheet.flatten(buttons[0].props.style).flex).toBe(1);
      expect(screen.queryByRole("button", { name: "Salin minggu lalu" })).toBeNull();
    });
  });

  describe("day card", () => {
    it("lists the dishes under their composition group, with a dashed camera tile where a photo is missing", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      // Each group is a meta label over its own list card.
      for (const label of ["Nasi", "Lauk", "Sayur"]) expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      // Each group is the shared ListCard, open (`clip={false}`) so a late photo is never inside an overflow-hidden view, its
      // separators inset to the 48 thumb's text column.
      const cards = screen.getAllByTestId("list-card");
      expect(cards).toHaveLength(3);
      for (const card of cards) expect(StyleSheet.flatten(card.props.style).overflow).toBe("visible");
      expect(StyleSheet.flatten(screen.getAllByTestId("list-card-separator")[0].props.style).marginLeft).toBe(60);
      expect(screen.queryByTestId("menu-dish-list")).toBeNull();
      expect(screen.getByText("Ayam goreng")).toBeTruthy();
      expect(screen.getByText("Tempe bacem")).toBeTruthy();
      // The not-set tile is a 48 dashed square with the camera glyph, radius 8, like Thumb's.
      expect(flatOf("menu-photo-tile-i-ayam")).toMatchObject({ width: 48, height: 48, borderRadius: 8, borderStyle: "dashed", borderColor: nativeThemes.light.controlRing });
      expect(within(screen.getByTestId("menu-photo-tile-i-ayam")).UNSAFE_getByType(Ionicons).props.name).toBe("camera-outline");
      expect(screen.getByTestId("menu-photo-tile-i-sayur", { includeHiddenElements: true })).toBeTruthy();
      // The dishes that have a photo show it in a 48 r8 thumb and offer nothing.
      expect(screen.queryByTestId("menu-photo-tile-i-nasi", { includeHiddenElements: true })).toBeNull();
      expect(flatOf("menu-dish-photo-i-nasi")).toMatchObject({ width: 48, height: 48, borderRadius: 8 });
      const photo = within(screen.getByTestId("menu-dish-photo-i-nasi")).UNSAFE_getByType(PhotoImage);
      expect(photo.props.source).toEqual({ uri: "https://cdn.test/nasi.jpg" });
      // The corners are rounded by the image itself, and no ancestor clips it: on Android a photo that finishes loading
      // inside an `overflow: hidden` rounded view stayed blank until the screen was reopened (so no Thumb, no ListCard).
      expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ width: 48, height: 48, borderRadius: 8 });
      for (let n = photo.parent; n; n = n.parent) expect(StyleSheet.flatten((n.props as { style?: unknown }).style as never)?.overflow).not.toBe("hidden");
      // The owner's Tambah foto is the tile itself (the pill is gone), named by its dish.
      expect(screen.getAllByRole("button", { name: /^Tambah foto, / })).toHaveLength(2);
      expect(screen.queryByText("Tambah foto")).toBeNull();
    });

    it("every dish row is a 64 compact media row, with a photo or without", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      for (const id of ["i-nasi", "i-ayam", "i-tempe", "i-sayur"]) {
        expect(flatOf(`menu-dish-${id}`)).toMatchObject({ minHeight: 64, flexDirection: "row", alignItems: "center" });
      }
      // A dish's title is bodyStrong.
      expect(StyleSheet.flatten(screen.getByText("Ayam goreng").props.style)).toMatchObject({ fontSize: 15, lineHeight: 22 });
    });

    it("a dish row's one meta line is its serving, when it has one", async () => {
      const served = dishes.map((d) => (d.id === "i-nasi" ? { ...d, serving: "180 g" } : d));
      mount({ dates: [filled("2026-10-08", served)] });
      await screen.findByText("Nasi putih");
      expect(within(screen.getByTestId("menu-dish-i-nasi")).getByText("180 g")).toBeTruthy();
      expect(StyleSheet.flatten(screen.getByText("180 g").props.style)).toMatchObject({ fontSize: 13 });
    });

    it("the day's header holds its date and, for an owner, Ubah menu in its trailing slot", async () => {
      mount({ dates: [filled("2026-10-08")] });
      await screen.findByText("Nasi putih");
      const header = screen.getAllByTestId("section-header").find((h) => within(h).queryByText("Kamis 8 Okt"))!;
      const edit = within(within(header).getByTestId("section-header-trailing")).getByRole("button", { name: "Ubah menu" });
      expect(StyleSheet.flatten(edit.props.style)).toMatchObject({ minHeight: 48, minWidth: 48, paddingRight: 0 });
      expect(StyleSheet.flatten(edit.props.style).marginRight).toBeUndefined();
      // The row holds the whole 48 target (a 26 row clipped it to 37), with no negative margin on the slot either.
      expect(StyleSheet.flatten(header.props.style).minHeight).toBeGreaterThanOrEqual(48);
      expect(StyleSheet.flatten(within(header).getByTestId("section-header-trailing").props.style).marginVertical).toBeUndefined();
    });

    it("calls an empty day past its change cutoff closed, in muted ink with no action", async () => {
      // Today in production: the cutoff was yesterday, so nothing can be filled and nothing is asked of the caterer.
      mount({ dates: [{ date: "2026-10-08", version: 0, editable: false, details: null }] });
      const label = await screen.findByText("Sudah tidak bisa diubah");
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({ color: nativeThemes.light.muted, fontSize: 13, lineHeight: 18 });
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
      expect(screen.queryByRole("button", { name: /^Tambah foto/ })).toBeNull();
      // The dish row is the same 64 row; a dish without a photo shows Thumb's not-set tile (the utensils), which is not a control.
      expect(flatOf("menu-dish-i-ayam").minHeight).toBe(64);
      const tile = screen.getByTestId("menu-photo-tile-i-ayam-not-set", { includeHiddenElements: true });
      expect(flatOf("menu-photo-tile-i-ayam-not-set")).toMatchObject({ width: 48, height: 48, borderRadius: 8, borderStyle: "dashed" });
      expect(within(tile).UNSAFE_getByType(Ionicons).props.name).toBe("restaurant-outline");
      expect(screen.queryByTestId("menu-photo-tile-i-ayam", { includeHiddenElements: true })).toBeNull();
      expect(within(screen.getByTestId("menu-dish-i-ayam")).queryByRole("button")).toBeNull();
    });

    it("an owner sees the same utensils tile, not the camera action, on a day that can no longer change", async () => {
      mount({ dates: [filled("2026-10-08", dishes, false)] });
      await screen.findByText("Nasi putih");
      expect(screen.getByTestId("menu-photo-tile-i-ayam-not-set", { includeHiddenElements: true })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Tambah foto/ })).toBeNull();
      expect(flatOf("menu-dish-i-ayam").minHeight).toBe(64);
    });

    it("lets a long dish name wrap at 360dp and font scale 1.3 instead of cutting it, and a short one keeps the 64 row", async () => {
      const long = "Ayam panggang bumbu rempah";
      mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
      try {
        mount({ dates: [filled("2026-10-08", dishes.map((d) => (d.id === "i-ayam" ? { ...d, name: long } : d)))] });
        const title = await screen.findByText(long);
        // Not limited to one line: the name grows the row only when it needs to.
        expect(title.props.numberOfLines).toBeUndefined();
        expect(flatOf("menu-dish-i-ayam").minHeight).toBe(64);
      } finally {
        mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
      }
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

    it("says Mengunggah… on the dish while the photo is on its way", async () => {
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
      const message = await screen.findByText("Ada yang berubah. Muat ulang, lalu coba lagi.");
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
      expect(within(screen.getByTestId("menu-dish-photo-i-ayam")).UNSAFE_getByType(PhotoImage).props.source).toEqual({ uri: "https://cdn.test/ayam.jpg" });
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

    it("shows a hidden system spinner in the tile while uploading, and none otherwise", async () => {
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
      // It sits inside the tile, and only on the dish being uploaded.
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
      expect(within(cover).UNSAFE_getByType(PhotoImage).props.source).toEqual({ uri: "https://cdn.test/ayam.jpg" });
      expect(
        screen.getByText("Foto lauk utama jadi sampul menu besok. Menu tanpa foto memakai foto paket."),
      ).toBeTruthy();
    });

    it("falls back to the package photo for a menu without photos", async () => {
      const bare = dishes.map((d) => ({ ...d, image: "" }));
      mount({ dates: [filled("2026-10-08", bare)] });
      await screen.findByText("Tampilan di aplikasi pelanggan");
      expect(within(screen.getByTestId("story-cover")).UNSAFE_getByType(PhotoImage).props.source).toEqual({
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
    const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
    const MobileProvider = scaled(BaseProvider);
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

  describe("day editor footer", () => {
    function mountDay(role: string, items: typeof dishes) {
      const { createMobileRuntime, MobileProvider: BaseProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
      const MobileProvider = scaled(BaseProvider);
      const { MenuDayScreen } = jest.requireActual("../src/menu/MenuDayScreen") as typeof import("../src/menu/MenuDayScreen");
      const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "mf" });
      runtime.api = {
        ...runtime.api,
        me: jest.fn(async () => ({ actor: { id: "u-1", role, catererId: "k-1" }, demo: false })),
        sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers: [offerOf()] })),
        menuMonth: jest.fn(async () => ({ dates: [filled("2026-10-07", items)], categories: [] })),
        command: jest.fn(async () => ({})),
      } as unknown as typeof runtime.api;
      render(
        <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
          <MenuDayScreen date="2026-10-07" packageId="p-1" meal="lunch" />
        </MobileProvider>,
      );
    }

    it("pins Simpan menu in the screen footer for an owner, disabled until every group is filled", async () => {
      mountDay("owner", [dishes[0], dishes[1], dishes[3]]);
      const footer = await screen.findByTestId("screen-footer");
      const save = within(footer).getByRole("button", { name: "Simpan menu" });
      expect(save.props.accessibilityState.disabled).toBe(true);
      // The button is the footer's only content and 50 tall; it is not in the scrolling body any more.
      expect(StyleSheet.flatten(save.props.style).minHeight).toBe(50);
      expect(within(screen.getByTestId("screen-body")).queryByRole("button", { name: "Simpan menu" })).toBeNull();
      // The completeness caption stays in the body.
      expect(screen.getByText("Paket ini berisi 1 nasi, 2 lauk, 1 sayur. Tambah 1 lagi.")).toBeTruthy();
    });

    it("enables Simpan menu once the day is complete", async () => {
      mountDay("owner", dishes);
      const footer = await screen.findByTestId("screen-footer");
      await waitFor(() => expect(within(footer).getByRole("button", { name: "Simpan menu" }).props.accessibilityState.disabled).toBeFalsy());
    });

    it("a helper's day editor is read-only: no footer, no Simpan menu, no remove, no input", async () => {
      mountDay("staff", dishes);
      await screen.findByText("Ayam goreng");
      expect(screen.queryByTestId("screen-footer")).toBeNull();
      expect(screen.queryByRole("button", { name: "Simpan menu" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Hapus / })).toBeNull();
      expect(screen.queryByLabelText(/^Tambah /)).toBeNull();
    });
  });
});
