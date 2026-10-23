import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, ActivityIndicator, Image, Linking, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { NavigationContext } from "expo-router/react-navigation";
import * as Haptics from "expo-haptics";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { LayoutScaleProvider, MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { todayPlates, type Address, type CustomerState, type Delivery, type Offer } from "@catera/domain";
import { stateLabel } from "../src/today/Plate";
import { Jadwal } from "../src/schedule/Jadwal";
import { ChangeDaySheet } from "../src/schedule/ChangeDaySheet";
import { DayScreen } from "../src/schedule/DayScreen";
import { customerLink } from "../src/links";
import { closeSheetFor } from "../src/nav";
import { SHEET_FOCUS_FALLBACK_MS, SHEET_FOCUS_SETTLE_MS } from "@catera/mobile-ui";
import { ACTION_CIRCLE, DAY_ACTION_GAP, DAY_ACTIONS_PAD, DAY_GAP, DAY_MEAL_GAP } from "../src/schedule/dayMetrics";
import { delivery, offer, subscription } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
}));
// The day sheet closes itself and opens a page of the tab under it through the navigation helper; without a navigator
// that helper has nothing to act on, so these tests read what it was asked to open.
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), closeSheetFor: jest.fn() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

// React Native's jest environment reports a font scale of 2, which turns every photo cell into its large-font fallback.
// The hook module is replaced (not spied on) because components read it through react-native's lazy export.
let mockWidth = 390;
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: mockFontScale }),
}));

// Wednesday 7 October 2026, 10.00 in Jakarta. Only Date is frozen so async code keeps working.
const NOW = new Date("2026-10-07T03:00:00Z");
beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      "hrtime",
    ],
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockWidth = 390;
  mockFontScale = 1;
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const home: Address = {
  id: "a-1",
  label: "Kantor",
  line: "Jl. Contoh No. 1",
  area: "Tebet",
  city: "Jakarta Selatan",
  instructions: "",
  version: 1,
};
const rumah: Address = { ...home, id: "a-2", label: "Rumah", line: "Jl. Mawar No. 9" };
const jauh: Address = { ...home, id: "a-3", label: "Villa", line: "Jl. Jauh No. 3", area: "Bogor" };

type Availability = { date: string; available: boolean; reason: string | null; remaining: number }[];

function runtimeWith(
  state: CustomerState | (() => Promise<CustomerState>),
  availability: Availability = [],
  command: jest.Mock = jest.fn(async () => ({})),
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(typeof state === "function" ? state : async () => state),
    deliveryAvailability: jest.fn(async () => availability),
    command,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

const stateOf = (deliveries: Delivery[], addresses: Address[] = [home, rumah, jauh]): CustomerState => ({
  subscriptions: [subscription()],
  deliveries,
  addresses,
  notifications: [],
  cases: [],
});

// Cutoff 17.00 on the day before service: 2026-10-07T10:00Z. It is 10.00 WIB on the 7th, so still open.
const open = (id: string, date: string, extra: Partial<Delivery> = {}) => delivery(id, date, {}, extra);

/** A day button by its date, whatever coverage its label then names. */
const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
const dayButton = (date: string) => screen.getByRole("button", { name: new RegExp(`^${date}(,|$)`) });

const siang = nativeMood.light.siang;
const malam = nativeMood.light.malam;
const PACKAGE_PHOTO = "https://images.example.test/paket.jpg";
const shot = (name: string) => `https://images.example.test/${name}.jpg`;
const menuOf = (meal: "lunch" | "dinner", image: string, items: unknown[] = [{ id: `${meal}-1`, name: "Nasi putih" }]) =>
  ({ meal, name: "Menu", description: "", image, items }) as unknown as Offer["menus"][number];
/** A package whose lunch and dinner menus are set, each with its own photo. */
const photoOffer = (lunch: string, dinner = "") =>
  offer({ image: PACKAGE_PHOTO, menus: [menuOf("lunch", lunch), menuOf("dinner", dinner)] });
/** The month has loaded: the header draws the grid only once there is data for it. */
const gridReady = () => screen.findByTestId("month-grid");
const hidden = { includeHiddenElements: true } as const;
/** A node inside one day cell, by test id. */
const inCell = (date: string, id: string) => within(dayButton(date)).queryByTestId(id, hidden);
const circle = (date: string) => inCell(date, "cell-circle")!;
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
/** Jadwal as the app draws it: the customer root provides the v2 layout scale. */
const renderV2 = (runtime: MobileRuntime, ui: React.ReactElement) =>
  renderWith(runtime, <LayoutScaleProvider value="v2">{ui}</LayoutScaleProvider>);
const agendaDay = (date: string) => screen.queryByTestId(`agenda-day-${date}`);

describe("Jadwal", () => {
  // Today is Wednesday the 7th. The 5th is past and delivered; the 7th is delivered but not past; the 8th has no menu yet.
  // Dinner is stored before lunch on the 9th, to prove the list orders by meal and not by storage. October 2026 spans
  // five weeks: Thursday the 1st to Saturday the 31st.
  const coverage = stateOf([
    delivery("d-past", "2026-10-05", { status: "delivered" }, { offer: photoOffer(shot("siang-5")) }),
    delivery("d-today", "2026-10-07", { status: "delivered" }, { offer: photoOffer(shot("siang-7")) }),
    delivery("d-unset", "2026-10-08", {}, {
      offer: offer({
        image: PACKAGE_PHOTO,
        menus: [{ ...menuOf("lunch", "", []), contentModel: "slots" } as Offer["menus"][number]],
      }),
    }),
    delivery("d-both", "2026-10-09", {}, {
      offer: offer({ ...photoOffer(shot("siang-9"), shot("malam-9")), name: "Salmon Teriyaki dan Ayam Panggang" }),
      meals: [
        { meal: "dinner", status: "scheduled" },
        { meal: "lunch", status: "scheduled" },
      ],
    }),
    delivery("d-dinner", "2026-10-10", {}, {
      offer: photoOffer(shot("siang-10"), shot("malam-10")),
      meals: [{ meal: "dinner", status: "scheduled" }],
    }),
    delivery("d-both-done", "2026-10-13", {}, {
      offer: photoOffer(shot("siang-13"), shot("malam-13")),
      meals: [
        { meal: "lunch", status: "delivered" },
        { meal: "dinner", status: "delivered" },
      ],
    }),
  ]);
  const month = stateOf([
    delivery("d-arrived", "2026-10-07", { status: "delivered" }),
    open("d-next", "2026-10-08"),
    open("d-later", "2026-10-12"),
  ]);

  describe("month band", () => {
    it("puts the month in the mood header: a heroTitle month, two 44 chevrons, the weekdays and the legend", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const header = screen.getByTestId("jadwal-header");
      const title = within(header).getByText("Oktober 2026");
      expect(flat(title)).toMatchObject({ fontSize: 24, lineHeight: 30, color: siang.headerText });
      expect(title.props.accessibilityRole).toBe("header");
      for (const name of ["Bulan sebelumnya", "Bulan berikutnya"]) {
        const arrow = within(header).getByRole("button", { name });
        expect([flat(arrow).width, flat(arrow).height]).toEqual([44, 44]);
      }
      expect(within(header).getByRole("button", { name: /^Kamis 8 Oktober/ })).toBeTruthy();
      expect(within(header).getByText("Ada pengantaran")).toBeTruthy();
      // The agenda is the body, below the header.
      expect(within(header).queryByText(/Makan Siang Rumahan/)).toBeNull();
      expect(within(header).queryByText("Minggu ini")).toBeNull();
    });

    it("draws the weekday names Monday first, in meta, 20 tall at least", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      expect(screen.getAllByText(/^(Sen|Sel|Rab|Kam|Jum|Sab|Min)$/).map((n) => n.props.children)).toEqual([
        "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min",
      ]);
      const label = screen.getAllByText("Sen")[0];
      expect(flat(label)).toMatchObject({ fontSize: 13, lineHeight: 18, color: siang.headerMeta });
      expect(flat(screen.getByTestId("month-weekdays")).minHeight).toBe(20);
    });

    it.each([
      ["2026-10-10T03:00:00Z", "Oktober 2026", 5],
      ["2026-08-10T03:00:00Z", "Agustus 2026", 6],
      ["2027-02-10T03:00:00Z", "Februari 2027", 4],
    ])("draws only the weeks the month needs (%s: %s has %i)", async (now, title, weeks) => {
      jest.setSystemTime(new Date(now));
      try {
        renderV2(runtimeWith(stateOf([])), <Jadwal />);
        const grid = await gridReady();
        expect(within(screen.getByTestId("jadwal-header")).getByText(title)).toBeTruthy();
        expect(within(grid).getAllByTestId("month-week")).toHaveLength(weeks);
        for (const row of within(grid).getAllByTestId("month-week")) expect(flat(row).height).toBe(40);
      } finally {
        jest.setSystemTime(NOW);
      }
    });

    it("makes every day a 40 tall cell that shares its row down to a 44 floor", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const other = flat(dayButton("Kamis 8 Oktober"));
      expect(other.height).toBe(40);
      expect(other.flex).toBe(1);
      expect(other.minWidth).toBeGreaterThanOrEqual(44);
      // The number is 15/500, and the 32 circle holds it.
      const number = within(dayButton("Kamis 8 Oktober")).getByText("8");
      expect(flat(number)).toMatchObject({ fontSize: 15, fontFamily: "Jakarta-Medium" });
      expect(flat(circle("Kamis 8 Oktober"))).toMatchObject({ width: 32, height: 32, borderRadius: 16 });
    });

    it("fills today's circle in forest while it is selected, and rings it in forest once another day is", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const today = dayButton("Rabu 7 Oktober");
      expect(today.props.accessibilityState.selected).toBe(true);
      expect(flat(circle("Rabu 7 Oktober"))).toMatchObject({ backgroundColor: siang.toggleActive, width: 32, height: 32 });
      expect(flat(within(today).getByText("7"))).toMatchObject({ color: siang.onToggleActive });
      // An ordinary day is a bare number: no fill, no ring.
      expect(flat(circle("Kamis 8 Oktober")).backgroundColor).toBeUndefined();
      expect(flat(circle("Kamis 8 Oktober")).borderWidth).toBeUndefined();
      fireEvent.press(dayButton("Kamis 8 Oktober"));
      expect(dayButton("Kamis 8 Oktober").props.accessibilityState.selected).toBe(true);
      expect(dayButton("Rabu 7 Oktober").props.accessibilityState.selected).toBe(false);
      expect(flat(circle("Kamis 8 Oktober"))).toMatchObject({ backgroundColor: siang.toggleActive });
      // Today keeps its ring after another day is picked, and has no fill any more.
      expect(flat(circle("Rabu 7 Oktober"))).toMatchObject({ borderWidth: 2, borderColor: siang.todayRing });
      expect(flat(circle("Rabu 7 Oktober")).backgroundColor).toBeUndefined();
    });

    it("marks a delivery day with a 6 ink dot under the circle, muted once the day is past", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      // The 9th and 10th are ahead, the 7th is today, the 5th is past.
      for (const date of ["Jumat 9 Oktober", "Sabtu 10 Oktober"])
        expect(flat(inCell(date, "cell-dot")!)).toMatchObject({ width: 6, height: 6, borderRadius: 3, backgroundColor: siang.headerText });
      expect(flat(inCell("Senin 5 Oktober", "cell-dot")!)).toMatchObject({ width: 6, height: 6, backgroundColor: siang.markerIdle });
      // The dot sits below the circle, outside its fill, so a selected day keeps the same ink dot and it shows on the header.
      expect(flat(inCell("Rabu 7 Oktober", "cell-dot")!).backgroundColor).toBe(siang.headerText);
      expect(within(circle("Rabu 7 Oktober")).queryByTestId("cell-dot", hidden)).toBeNull();
      expect(within(circle("Jumat 9 Oktober")).queryByTestId("cell-dot", hidden)).toBeNull();
      // A day with no meal is only its number.
      expect(inCell("Minggu 11 Oktober", "cell-dot")).toBeNull();
      expect(inCell("Minggu 11 Oktober", "cell-unset-ring")).toBeNull();
    });

    it("rings a day whose menu is not set with a 6 controlRing ring, never a dot, a photo or a dashed outline", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const ring = flat(inCell("Kamis 8 Oktober", "cell-unset-ring")!);
      expect(ring).toMatchObject({ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: siang.markerIdle });
      // On the deeper header the idle marker is a step darker than controlRing (3:1 on the header).
      expect(siang.markerIdle).toBe("#7E8679");
      expect(ring.backgroundColor).toBeUndefined();
      expect(inCell("Kamis 8 Oktober", "cell-dot")).toBeNull();
      expect(within(dayButton("Kamis 8 Oktober")).UNSAFE_queryByType(Image)).toBeNull();
      expect(inCell("Kamis 8 Oktober", "cell-dashed")).toBeNull();
    });

    it("draws no photo, moon or dashed outline on any day", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const grid = screen.getByTestId("month-grid");
      for (const id of ["cell-photo", "cell-moon", "cell-number-pill", "cell-dashed", "cell-sun", "cell-selected-bar"])
        expect(within(grid).queryByTestId(id, hidden)).toBeNull();
    });

    it("keeps the grid inside 360dp with the 16 margin and no fixed widths", async () => {
      mockWidth = 360;
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const header = screen.getByTestId("jadwal-header");
      const grid = within(header).getByTestId("month-grid");
      // The header insets its content by the 16 margin and the grid fills it as is: the days sit 16dp from the screen
      // edge, like the agenda below.
      expect(grid.props.style).toBeUndefined();
      const side = flat(within(header).getByTestId("mood-header-content")).paddingHorizontal as number;
      expect(side).toBe(16);
      expect(2 * side + 7 * 44).toBeLessThanOrEqual(360);
      expect(flat(dayButton("Jumat 9 Oktober")).width).toBeUndefined();
      for (const row of within(header).getAllByTestId("month-week")) expect(flat(row).width).toBeUndefined();
    });

    it("keeps the dot out of the circle's flow at font scale 1.3, so a larger number never pushes it out", async () => {
      mockFontScale = 1.3;
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      for (const date of ["Jumat 9 Oktober", "Rabu 7 Oktober"]) {
        // Unselected (the 9th) and selected (today): the dot is a sibling of the circle, absolutely placed at the cell's foot.
        expect(flat(inCell(date, "cell-dot-slot")!)).toMatchObject({ position: "absolute", bottom: 0 });
        expect(inCell(date, "cell-dot")).toBeTruthy();
        expect(within(circle(date)).queryByTestId("cell-dot", hidden)).toBeNull();
        // The circle is the cell's first 32; the dot takes the last 6 of the 40.
        expect(flat(circle(date)).height).toBe(32);
        expect(flat(dayButton(date)).justifyContent).toBe("flex-start");
      }
      const number = within(dayButton("Jumat 9 Oktober")).getByText("9");
      expect(number.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
      // The number is the circle's only child in flow, centred: a taller line grows inside the 32, never past it.
      expect(flat(number).lineHeight).toBeLessThanOrEqual(32);
    });

    it("under Malam the ring, the selected circle and the dots are the Malam tokens", async () => {
      renderV2(
        runtimeWith(coverage),
        <MoodProvider now={() => new Date("2026-10-09T08:00:00Z")}>
          <Jadwal />
        </MoodProvider>,
      );
      await gridReady();
      expect(flat(circle("Rabu 7 Oktober")).backgroundColor).toBe(malam.toggleActive);
      expect(malam.toggleActive).toBe("#163D2E");
      fireEvent.press(dayButton("Kamis 8 Oktober"));
      expect(flat(circle("Rabu 7 Oktober")).borderColor).toBe(malam.todayRing);
      expect(flat(inCell("Jumat 9 Oktober", "cell-dot")!).backgroundColor).toBe(malam.headerText);
    });

    it("in dark, the selected circle is the lifted green and its number the dark card colour", async () => {
      const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
      renderV2(
        runtimeWith(coverage),
        <ThemeProvider storageKey="jadwal-dark">
          <Jadwal />
        </ThemeProvider>,
      );
      try {
        await gridReady();
        const dark = nativeMood.dark.siang;
        expect(flat(circle("Rabu 7 Oktober")).backgroundColor).toBe(dark.toggleActive);
        expect(flat(within(dayButton("Rabu 7 Oktober")).getByText("7")).color).toBe(dark.onToggleActive);
        expect(flat(inCell("Jumat 9 Oktober", "cell-dot")!).backgroundColor).toBe(dark.headerText);
      } finally {
        scheme.mockRestore();
      }
    });

    it("labels a covered day with its meals and its state", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      expect(await screen.findByLabelText("Jumat 9 Oktober, makan siang dan makan malam")).toBeTruthy();
      expect(screen.getByLabelText("Sabtu 10 Oktober, makan malam")).toBeTruthy();
      expect(screen.getByLabelText("Kamis 8 Oktober, makan siang, menu belum diisi")).toBeTruthy();
      expect(screen.getByLabelText("Senin 5 Oktober, makan siang, sudah sampai")).toBeTruthy();
      expect(screen.getByLabelText("Selasa 13 Oktober, makan siang dan makan malam, sudah sampai")).toBeTruthy();
      expect(screen.getByLabelText("Minggu 11 Oktober")).toBeTruthy();
      // Today starts selected. Selection is the accessibility state, not a word, so the label is the same selected or not.
      expect(screen.getByLabelText("Rabu 7 Oktober, makan siang, sudah sampai, hari ini")).toBeTruthy();
      expect(dayButton("Rabu 7 Oktober").props.accessibilityState.selected).toBe(true);
      fireEvent.press(dayButton("Kamis 8 Oktober"));
      expect(screen.getByLabelText("Kamis 8 Oktober, makan siang, menu belum diisi")).toBeTruthy();
      expect(dayButton("Kamis 8 Oktober").props.accessibilityState.selected).toBe(true);
      expect(dayButton("Rabu 7 Oktober").props.accessibilityState.selected).toBe(false);
    });

    it("labels a covered day in English", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(coverage), <Jadwal />);
      expect(await screen.findByLabelText("Friday 9 October, lunch and dinner")).toBeTruthy();
      expect(screen.getByLabelText("Thursday 8 October, lunch, menu not set")).toBeTruthy();
      expect(screen.getByLabelText("Wednesday 7 October, lunch, arrived, today")).toBeTruthy();
    });

    it("says a meal the caterer could not deliver was not delivered, and marks no coverage on the day", async () => {
      const failed = stateOf([delivery("d-failed", "2026-10-06", { status: "issue" })]);
      renderV2(runtimeWith(failed), <Jadwal />);
      await gridReady();
      fireEvent.press(dayButton("Selasa 6 Oktober"));
      expect(within(screen.getByRole("button", { name: /Ayam bakar madu/ })).getByText(/Gagal diantar/)).toBeTruthy();
      // The day looks like a day without deliveries: no coverage in its label, no dot, no ring.
      expect(dayButton("Selasa 6 Oktober").props.accessibilityLabel).toBe("Selasa 6 Oktober");
      expect(dayButton("Selasa 6 Oktober").props.accessibilityState.selected).toBe(true);
      expect(inCell("Selasa 6 Oktober", "cell-dot")).toBeNull();
      expect(inCell("Selasa 6 Oktober", "cell-unset-ring")).toBeNull();
    });
  });

  describe("legend", () => {
    it("names the delivery dot and the unset ring, in meta, with 6 swatches that draw what the cells draw", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const header = screen.getByTestId("jadwal-header");
      const delivery = within(screen.getByTestId("legend-delivery"));
      const unset = within(screen.getByTestId("legend-unset"));
      expect(flat(delivery.getByText("Ada pengantaran"))).toMatchObject({ fontSize: 13, lineHeight: 18, color: siang.headerMeta });
      expect(flat(unset.getByText("Menu belum diisi")).fontSize).toBe(13);
      expect(flat(delivery.getByTestId("legend-delivery-swatch"))).toMatchObject({ width: 6, height: 6, borderRadius: 3, backgroundColor: siang.headerText });
      expect(flat(unset.getByTestId("legend-unset-swatch"))).toMatchObject({ width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: siang.markerIdle });
      // The old photo, moon and arrived explanations are gone with their cells.
      for (const gone of ["Foto menu", "Ada makan malam", "Diantar", "Dipindah"]) expect(within(header).queryByText(gone)).toBeNull();
    });

    it("reads in English when the language is English", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(month), <Jadwal />);
      expect(await screen.findByText("Delivery")).toBeTruthy();
      expect(screen.getByText("Menu not set")).toBeTruthy();
    });
  });

  describe("week agenda", () => {
    it("opens on this week: Minggu ini with its range, one block per delivery day, in order", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const heading = screen.getByTestId("agenda-heading");
      expect(flat(within(heading).getByText("Minggu ini"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
      expect(flat(within(heading).getByText("5–11 Okt")).fontSize).toBe(13);
      // Monday 5th to Sunday 11th: the 5th, 7th, 8th, 9th and 10th have meals.
      const shown = screen.getAllByTestId(/^agenda-day-/).map((n) => n.props.testID);
      expect(shown).toEqual(["agenda-day-2026-10-05", "agenda-day-2026-10-07", "agenda-day-2026-10-08", "agenda-day-2026-10-09", "agenda-day-2026-10-10"]);
      expect(within(agendaDay("2026-10-05")!).getByText("Senin 5 Okt")).toBeTruthy();
      expect(flat(within(agendaDay("2026-10-05")!).getByText("Senin 5 Okt"))).toMatchObject({ fontSize: 15, fontFamily: "Jakarta-SemiBold" });
      expect(within(agendaDay("2026-10-07")!).getByText("Rabu 7 Okt · Hari ini")).toBeTruthy();
      // Nothing from the next week is in this one.
      expect(agendaDay("2026-10-13")).toBeNull();
    });

    it("draws each meal as a 72 media row: a 56 thumb, the dish, and meta with the meal, window and state", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const row = screen.getByTestId("agenda-row-d-today-lunch");
      expect(flat(row).minHeight).toBe(72);
      expect(flat(within(row).getByTestId("agenda-row-d-today-lunch-thumb"))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
      expect(within(row).getByText("Nasi putih")).toBeTruthy();
      expect(flat(within(row).getByText("Nasi putih"))).toMatchObject({ fontSize: 17 });
      expect(within(row).getByText("Siang 11.00–13.00 · Sudah sampai")).toBeTruthy();
      expect(flat(within(row).getByText("Siang 11.00–13.00 · Sudah sampai")).fontSize).toBe(13);
      expect(within(row).queryByTestId("agenda-row-d-today-lunch-chevron")).toBeNull(); // chevron is iOS-only
      // A day's rows share one card.
      expect(within(agendaDay("2026-10-09")!).getAllByTestId("list-card")).toHaveLength(1);
    });

    it("titles a row with the meal's lead dish, never the package name, and 'Menu belum diisi' when the menu is not set", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      // The 7th's lunch menu is set (Nasi putih); the package is "Makan Siang Rumahan".
      expect(within(screen.getByTestId("agenda-row-d-today-lunch")).queryByText("Makan Siang Rumahan")).toBeNull();
      // The 8th has a slot menu with no dishes: the row says so, in the day sheet's words.
      const unset = screen.getByTestId("agenda-row-d-unset-lunch");
      expect(within(unset).getByText("Menu belum diisi")).toBeTruthy();
      expect(within(unset).queryByText("Makan Siang Rumahan")).toBeNull();
      // The 9th's both meals are set: lunch and dinner each name their own lead dish.
      expect(within(screen.getByTestId("agenda-row-d-both-lunch")).getByText("Nasi putih")).toBeTruthy();
    });

    it("says the meal's state after the window: terjadwal, sedang diantar, sudah sampai", async () => {
      const mixed = stateOf([
        delivery("d-sched", "2026-10-08", {}),
        delivery("d-road", "2026-10-07", { status: "out_for_delivery" }),
        delivery("d-cook", "2026-10-09", { status: "preparing" }),
        delivery("d-done", "2026-10-05", { status: "delivered" }),
        delivery("d-old", "2026-10-06", {}),
      ]);
      renderV2(runtimeWith(mixed), <Jadwal />);
      await gridReady();
      expect(within(screen.getByTestId("agenda-row-d-sched-lunch")).getByText("Siang 11.00–13.00 · Terjadwal")).toBeTruthy();
      expect(within(screen.getByTestId("agenda-row-d-road-lunch")).getByText("Siang 11.00–13.00 · Sedang diantar")).toBeTruthy();
      expect(within(screen.getByTestId("agenda-row-d-cook-lunch")).getByText("Siang 11.00–13.00 · Sedang dimasak")).toBeTruthy();
      expect(within(screen.getByTestId("agenda-row-d-done-lunch")).getByText("Siang 11.00–13.00 · Sudah sampai")).toBeTruthy();
      // A past day nobody updated is not "scheduled" any more.
      expect(within(screen.getByTestId("agenda-row-d-old-lunch")).getByText("Siang 11.00–13.00 · Belum sampai")).toBeTruthy();
    });

    it("says today's unmarked meal past its window what Beranda says for it, and leaves one still ahead Terjadwal", async () => {
      // It is 10.00 in Jakarta: the 08.00 lunch has started and nobody tapped it; the 17.00 dinner is still ahead.
      const early = offer({ windows: { lunch: "08.00–10.00", dinner: "17.00–19.00" } });
      const state = stateOf([
        delivery("d-late", "2026-10-07", {}, { offer: early }),
        delivery("d-ahead", "2026-10-07", {}, { meals: [{ meal: "dinner", status: "scheduled" }] }),
      ]);
      renderV2(runtimeWith(state), <Jadwal />);
      await gridReady();
      const [late, ahead] = todayPlates(state, NOW);
      expect(late.state).toBe("due");
      expect(within(screen.getByTestId("agenda-row-d-late-lunch")).getByText(`Siang 08.00–10.00 · ${stateLabel(late, (id) => id)}`)).toBeTruthy();
      expect(stateLabel(late, (id) => id)).toBe("Belum sampai");
      expect(within(screen.getByTestId("agenda-row-d-ahead-dinner")).getByText(`Malam 17.00–19.00 · ${stateLabel(ahead, (id) => id)}`)).toBeTruthy();
      expect(stateLabel(ahead, (id) => id)).toBe("Terjadwal");
    });

    it("draws a row's thumb from the row's own menu, never from the day's merged one", async () => {
      // Two caterers serve lunch on the 8th: one menu set, one not. The calendar merges them to "not set"; each row is its own.
      const unsetOffer = offer({
        id: "p-kosong",
        name: "Paket Kosong",
        image: PACKAGE_PHOTO,
        menus: [{ ...menuOf("lunch", "", []), contentModel: "slots" } as Offer["menus"][number]],
      });
      renderV2(
        runtimeWith(stateOf([delivery("d-set", "2026-10-08", {}), delivery("d-blank", "2026-10-08", {}, { offer: unsetOffer })])),
        <Jadwal />,
      );
      await gridReady();
      const set = screen.getByTestId("agenda-row-d-set-lunch");
      expect(within(set).getByText("Ayam bakar madu")).toBeTruthy();
      expect(within(set).queryByTestId("agenda-row-d-set-lunch-thumb-not-set")).toBeNull();
      const blank = screen.getByTestId("agenda-row-d-blank-lunch");
      expect(within(blank).getByText("Menu belum diisi")).toBeTruthy();
      expect(within(blank).getByTestId("agenda-row-d-blank-lunch-thumb-not-set")).toBeTruthy();
    });

    it("reads a scheduled meal in English as Scheduled", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(stateOf([delivery("d-sched", "2026-10-08", {})])), <Jadwal />);
      expect(await screen.findByText("Lunch 11.00–13.00 · Scheduled")).toBeTruthy();
    });

    it("labels a row for a screen reader from its non-empty parts only, with no stray commas", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      expect(screen.getByTestId("agenda-row-d-today-lunch").props.accessibilityLabel).toBe("Nasi putih, Siang 11.00–13.00 · Sudah sampai");
      for (const row of screen.getAllByTestId(/^agenda-row-[^-]+-[^-]+-(lunch|dinner)$/)) {
        const label = row.props.accessibilityLabel as string;
        expect(label).not.toMatch(/^[s,]|[s,]$|,s*,/);
      }
      // A row with no window still reads without a gap.
      expect(screen.getByTestId("agenda-row-d-unset-lunch").props.accessibilityLabel).toBe("Menu belum diisi, Siang 11.00–13.00 · Terjadwal");
    });

    it("lists lunch before dinner on a day with both", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const rows = within(agendaDay("2026-10-09")!).getAllByRole("button");
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText(/^Siang 11\.00–13\.00/)).toBeTruthy();
      expect(within(rows[1]).getByText(/^Malam 17\.00–19\.00/)).toBeTruthy();
    });

    it("shows a meal whose menu is not set with the dashed thumb", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const row = screen.getByTestId("agenda-row-d-unset-lunch");
      expect(within(row).getByTestId("agenda-row-d-unset-lunch-thumb-not-set")).toBeTruthy();
      // A set menu keeps the photo tile.
      expect(within(screen.getByTestId("agenda-row-d-both-lunch")).getByTestId("agenda-row-d-both-lunch-thumb")).toBeTruthy();
    });

    it("folds the days with nothing into one muted 56 row named from the week's own days", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const empty = screen.getByTestId("agenda-empty-days");
      // The 6th (Selasa) and the 11th (Minggu) have no meal.
      expect(within(empty).getByText("Selasa dan Minggu tidak ada pengantaran")).toBeTruthy();
      expect(flat(empty).minHeight).toBe(56);
      expect(flat(within(empty).getByText("Selasa dan Minggu tidak ada pengantaran")).color).toBe(nativeThemes.light.muted);
      expect(screen.getAllByTestId("agenda-empty-days")).toHaveLength(1);
      expect(agendaDay("2026-10-06")).toBeNull();
      expect(agendaDay("2026-10-11")).toBeNull();
    });

    it("names three or more empty days in a list, and a whole empty week in one line", async () => {
      renderV2(runtimeWith(stateOf([delivery("d-mon", "2026-10-05", {}), delivery("d-tue", "2026-10-06", {})])), <Jadwal />);
      await gridReady();
      expect(screen.getByText("Rabu, Kamis, Jumat, Sabtu, dan Minggu tidak ada pengantaran")).toBeTruthy();
      screen.unmount();
      renderV2(runtimeWith(stateOf([])), <Jadwal />);
      await gridReady();
      expect(screen.getByText("Tidak ada pengantaran di minggu ini")).toBeTruthy();
      expect(screen.queryAllByTestId(/^agenda-day-/)).toHaveLength(0);
    });

    it("selecting a date in another week moves the agenda to that week", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      fireEvent.press(dayButton("Selasa 13 Oktober"));
      const heading = screen.getByTestId("agenda-heading");
      expect(within(heading).getByText("Pekan 12–18 Okt")).toBeTruthy();
      expect(within(heading).queryByText("Minggu ini")).toBeNull();
      expect(screen.getAllByTestId(/^agenda-day-/).map((n) => n.props.testID)).toEqual(["agenda-day-2026-10-13"]);
      expect(within(agendaDay("2026-10-13")!).getByText("Selasa 13 Okt")).toBeTruthy();
      expect(agendaDay("2026-10-07")).toBeNull();
      // Both meals of that day are rows, both arrived.
      expect(within(screen.getByTestId("agenda-row-d-both-done-lunch")).getByText(/Sudah sampai/)).toBeTruthy();
      // Back in this week it reads Minggu ini again.
      fireEvent.press(dayButton("Jumat 9 Oktober"));
      expect(screen.getByText("Minggu ini")).toBeTruthy();
      expect(agendaDay("2026-10-09")).toBeTruthy();
    });

    it("selecting a day inside this week keeps the agenda on it", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      fireEvent.press(dayButton("Jumat 9 Oktober"));
      expect(screen.getByText("Minggu ini")).toBeTruthy();
      expect(agendaDay("2026-10-07")).toBeTruthy();
      expect(agendaDay("2026-10-09")).toBeTruthy();
    });

    it("ends with a 56 link to the next week that opens it", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const next = screen.getByRole("button", { name: "Minggu depan, 12–18 Okt" });
      expect(flat(next).minHeight).toBe(56);
      fireEvent.press(next);
      expect(within(screen.getByTestId("agenda-heading")).getByText("Pekan 12–18 Okt")).toBeTruthy();
      expect(agendaDay("2026-10-13")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Minggu depan, 19–25 Okt" })).toBeTruthy();
    });

    it("shows a week that straddles two months whole, from the Monday to the Sunday", async () => {
      const straddle = stateOf([
        ...coverage.deliveries,
        delivery("d-oct30", "2026-10-30", {}, {}),
        delivery("d-nov1", "2026-11-01", {}, { offer: offer({ name: "Nasi Uduk Minggu" }) }),
      ]);
      const runtime = runtimeWith(straddle);
      renderV2(runtime, <Jadwal />);
      await gridReady();
      // The read covers the Monday of the first week to the Sunday of the last: 28 Sep to 1 Nov for October 2026.
      expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-09-28&to=2026-11-01");
      fireEvent.press(dayButton("Rabu 28 Oktober"));
      const heading = screen.getByTestId("agenda-heading");
      expect(within(heading).getByText("Pekan 26 Okt–1 Nov")).toBeTruthy();
      // Never "Minggu <date>": that reads as Sunday.
      expect(within(heading).queryByText(/^Minggu /)).toBeNull();
      expect(screen.getAllByTestId(/^agenda-day-/).map((n) => n.props.testID)).toEqual(["agenda-day-2026-10-30", "agenda-day-2026-11-01"]);
      expect(within(agendaDay("2026-11-01")!).getByText("Minggu 1 Nov")).toBeTruthy();
      expect(within(screen.getByTestId("agenda-row-d-nov1-lunch")).getByText("Ayam bakar madu")).toBeTruthy();
      // Friday and Sunday have meals, so the empty line names only the other days.
      expect(screen.getByText("Senin, Selasa, Rabu, Kamis, dan Sabtu tidak ada pengantaran")).toBeTruthy();
      // The grid still draws only October's own days.
      expect(screen.queryByRole("button", { name: /^Minggu 1 November/ })).toBeNull();
      expect(within(screen.getByTestId("month-grid")).getAllByTestId("cell-circle")).toHaveLength(31);
    });

    it("the last week's link opens the next week in the next month and loads it whole", async () => {
      const runtime = runtimeWith(coverage);
      renderV2(runtime, <Jadwal />);
      await gridReady();
      fireEvent.press(dayButton("Rabu 28 Oktober"));
      fireEvent.press(screen.getByRole("button", { name: "Minggu depan, 2–8 Nov" }));
      expect(await screen.findByText("November 2026")).toBeTruthy();
      // November 2026 starts on a Sunday: from the Monday 26 Oct to the Sunday 6 Dec.
      await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-10-26&to=2026-12-06"));
      // The chosen week is kept across the month change: Monday 2 November is selected.
      await screen.findByRole("button", { name: /^Senin 2 November/ });
      expect(dayButton("Senin 2 November").props.accessibilityState.selected).toBe(true);
      expect(within(screen.getByTestId("agenda-heading")).getByText("Pekan 2–8 Nov")).toBeTruthy();
    });

    it("puts the range of this week on the heading's row, and counts meals in the other weeks' heading", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const heading = screen.getByTestId("agenda-heading");
      expect(flat(heading)).toMatchObject({ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" });
      expect(within(heading).getByText("5–11 Okt")).toBeTruthy();
      fireEvent.press(dayButton("Selasa 13 Oktober"));
      // The 13th has lunch and dinner: two meals, two deliveries.
      expect(within(screen.getByTestId("agenda-heading")).getByText("2 pengantaran")).toBeTruthy();
    });

    it("counts deliveries in English", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      fireEvent.press(await screen.findByRole("button", { name: /^Tuesday 13 October/ }));
      const heading = within(screen.getByTestId("agenda-heading"));
      expect(heading.getByText("Week of 12–18 Oct")).toBeTruthy();
      expect(heading.getByText("2 deliveries")).toBeTruthy();
    });

    it("draws the empty days as a surface card of at least 56", async () => {
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      expect(flat(screen.getByTestId("agenda-empty-days"))).toMatchObject({
        backgroundColor: nativeThemes.light.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        minHeight: 56,
      });
    });

    it("opens a meal on its day: the row pushes the day screen", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      fireEvent.press(within(agendaDay("2026-10-08")!).getByRole("button", { name: /Ayam bakar madu/ }));
      expect(router.push).toHaveBeenCalledWith("/hari/d-next?title=Kamis%208%20Okt");
    });

    it("reads in English", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(coverage), <Jadwal />);
      expect(await screen.findByText("This week")).toBeTruthy();
      expect(screen.getByText("Wednesday 7 Oct · Today")).toBeTruthy();
      expect(screen.getByText("No deliveries on Tuesday and Sunday")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Next week, 12–18 Oct" })).toBeTruthy();
      expect(within(screen.getByTestId("agenda-row-d-today-lunch")).getByText("Lunch 11.00–13.00 · Arrived")).toBeTruthy();
    });

    it("grows rows instead of cutting titles, state or the empty line at 360dp and font scale 1.3", async () => {
      mockWidth = 360;
      mockFontScale = 1.3;
      renderV2(runtimeWith(coverage), <Jadwal />);
      await gridReady();
      const row = screen.getByTestId("agenda-row-d-today-lunch");
      // The dish and the line with "Sudah sampai" wrap; a one-line cap hid the state at this size.
      expect(within(row).getByText("Nasi putih").props.numberOfLines).toBeUndefined();
      expect(within(row).getByText(/Sudah sampai/).props.numberOfLines).toBeUndefined();
      expect(within(screen.getByTestId("agenda-empty-days")).getByText(/tidak ada pengantaran/).props.numberOfLines).toBeUndefined();
      expect(within(screen.getByRole("button", { name: /^Minggu depan/ })).getByText(/Minggu depan/).props.numberOfLines).toBeUndefined();
      // Rows have a floor, never a fixed height.
      expect(flat(row).height).toBeUndefined();
    });

    it("keeps one row's press feedback: it dims and keeps its state", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const row = screen.getByTestId("agenda-row-d-next-lunch");
      fireEvent(row, "responderGrant", touch);
      expect(StyleSheet.flatten(screen.getByTestId("agenda-row-d-next-lunch").props.style).opacity).toBe(0.7);
    });

    it("shows Ditandai sampai on the row of a meal Dapur marked arrived", async () => {
      const meal = (status: string) => ({ meal: "lunch", status, departed_at: "2026-10-06T03:00:00Z", arrived_at: "2026-10-06T03:20:00Z" });
      const marked = stateOf([delivery("d-marked", "2026-10-06", {}, { meals: [meal("out_for_delivery")] })]);
      renderV2(runtimeWith(marked), <Jadwal />);
      await gridReady();
      expect(within(screen.getByRole("button", { name: /Ayam bakar madu/ })).getByText(/Ditandai sampai/)).toBeTruthy();
    });

    it("keeps Gagal diantar on the row of a failed meal that carries arrived stamps", async () => {
      const meal = { meal: "lunch", status: "issue", departed_at: "2026-10-06T03:00:00Z", arrived_at: "2026-10-06T03:20:00Z" };
      const failedRow = stateOf([delivery("d-failed2", "2026-10-06", {}, { meals: [meal] })]);
      renderV2(runtimeWith(failedRow), <Jadwal />);
      await gridReady();
      const row = screen.getByRole("button", { name: /Ayam bakar madu/ });
      expect(within(row).getByText(/Gagal diantar/)).toBeTruthy();
      expect(within(row).queryByText(/Ditandai sampai/)).toBeNull();
    });

    it("shows a day whose meals list is missing without failing", async () => {
      const bare = stateOf([{ ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery]);
      renderV2(runtimeWith(bare), <Jadwal />);
      expect(await gridReady()).toBeTruthy();
      expect(screen.getByText("Tidak ada pengantaran di minggu ini")).toBeTruthy();
    });

    it("leaves a cancelled delivery out of both the grid and the agenda", async () => {
      const cancelled = stateOf([delivery("d-x", "2026-10-08", { status: "cancelled" }, { status: "cancelled" })]);
      renderV2(runtimeWith(cancelled), <Jadwal />);
      await gridReady();
      expect(inCell("Kamis 8 Oktober", "cell-dot")).toBeNull();
      expect(agendaDay("2026-10-08")).toBeNull();
    });
  });

  describe("loading and reading", () => {
    it("loads the shown month's whole weeks by Jakarta dates", async () => {
      const runtime = runtimeWith(month);
      renderV2(runtime, <Jadwal />);
      await gridReady();
      expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-09-28&to=2026-11-01");
    });

    // Unknown data is never drawn as an uncovered month: with nothing loaded the header shows the empty frame, with no
    // days in it, instead of the grid. The legend stays (loading.test.tsx holds the frame's height and the legend).
    const noCalendar = () => {
      expect(screen.queryByTestId("month-grid")).toBeNull();
      expect(screen.queryByRole("button", { name: /^Rabu 7 Oktober/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /^Kamis 8 Oktober/ })).toBeNull();
      const frame = screen.getByTestId("month-frame");
      expect(within(frame).queryByText("7")).toBeNull();
      expect(within(frame).queryByText("8")).toBeNull();
      expect(screen.queryByTestId("agenda-heading")).toBeNull();
    };

    it("while the month loads, the header says so with one skeleton circle per day inside the grid's frame", async () => {
      const runtime = runtimeWith(() => new Promise<CustomerState>(() => {}));
      renderV2(runtime, <Jadwal />);
      await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
      const header = screen.getByTestId("jadwal-header");
      expect(within(header).getByText("Oktober 2026")).toBeTruthy();
      const frame = within(header).getByTestId("month-frame");
      expect(within(header).getByRole("progressbar", { name: "Memuat jadwal" })).toBeTruthy();
      const cells = within(frame).getAllByTestId("jadwal-skeleton-cell");
      expect(cells).toHaveLength(31);
      for (const cell of cells) expect(flat(cell)).toMatchObject({ width: 32, height: 32, borderRadius: 16 });
      expect(within(frame).getAllByTestId("month-week")).toHaveLength(5);
      expect(within(frame).UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      // The legend holds its place.
      expect(within(header).getByText("Ada pengantaran")).toBeTruthy();
      noCalendar();
    });

    it("the loading text reads in English", async () => {
      (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
      renderV2(runtimeWith(() => new Promise<CustomerState>(() => {})), <Jadwal />);
      expect(await screen.findByRole("progressbar", { name: "Loading schedule" })).toBeTruthy();
    });

    it("when the first load fails, the header shows the error and a retry in the grid's empty frame", async () => {
      const runtime = runtimeWith(month);
      const failure = Object.assign(new Error("slow"), { code: "REQUEST_TIMEOUT" });
      (runtime.api.customer as jest.Mock).mockRejectedValueOnce(failure);
      renderV2(runtime, <Jadwal />);
      const header = await screen.findByTestId("jadwal-header");
      const retry = await within(header).findByRole("button", { name: "Coba lagi" });
      const message = within(header).getByText("Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi.");
      expect(message.props.selectable).toBe(true);
      // Readable on both moods: the header's own text colour, not the theme danger red.
      expect(StyleSheet.flatten(message.props.style).color).toBe(siang.headerText);
      expect(flat(retry).minHeight).toBeGreaterThanOrEqual(48);
      expect(within(header).getByText("Oktober 2026")).toBeTruthy();
      noCalendar();
      // Trying again loads the month and the grid appears.
      fireEvent.press(retry);
      expect(await within(screen.getByTestId("jadwal-header")).findByRole("button", { name: /^Rabu 7 Oktober/ })).toBeTruthy();
      expect(screen.queryByText("Coba lagi")).toBeNull();
    });

    it("moving to a month that has not loaded replaces the grid with its skeleton", async () => {
      const runtime = runtimeWith(month);
      renderV2(runtime, <Jadwal />);
      await screen.findByRole("button", { name: /^Rabu 7 Oktober/ });
      (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise<CustomerState>(() => {}));
      fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
      expect(await screen.findByText("November 2026")).toBeTruthy();
      expect(within(screen.getByTestId("jadwal-header")).getByRole("progressbar", { name: "Memuat jadwal" })).toBeTruthy();
      // November 2026 has 30 days, each a placeholder until the month answers, over six weeks (the 1st is a Sunday).
      expect(screen.getAllByTestId("jadwal-skeleton-cell")).toHaveLength(30);
      expect(screen.getAllByTestId("month-week")).toHaveLength(6);
      expect(screen.queryByTestId("month-grid")).toBeNull();
    });

    it("a refresh that fails keeps the grid and the agenda on screen and offers Coba lagi in the page", async () => {
      const runtime = runtimeWith(coverage);
      renderV2(runtime, <Jadwal />);
      await gridReady();
      (runtime.api.customer as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("slow"), { code: "REQUEST_TIMEOUT" }));
      await act(async () => void screen.UNSAFE_getByType(ReactNative.RefreshControl).props.onRefresh());
      const retry = await screen.findByRole("button", { name: "Coba lagi" });
      // The month stays as it was: the cached grid and its week, with the failure above the agenda, outside the header.
      expect(screen.getByTestId("month-grid")).toBeTruthy();
      expect(agendaDay("2026-10-07")).toBeTruthy();
      expect(within(screen.getByTestId("jadwal-header")).queryByRole("button", { name: "Coba lagi" })).toBeNull();
      fireEvent.press(retry);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull());
    });

    it("a loaded month with no deliveries still draws the grid and says so, with the resting mascot", async () => {
      renderV2(runtimeWith(stateOf([])), <Jadwal />);
      expect(await screen.findByRole("button", { name: /^Rabu 7 Oktober/ })).toBeTruthy();
      expect(screen.getByTestId("month-grid")).toBeTruthy();
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByTestId("mascot-tidur", hidden)).toBeTruthy();
      expect(screen.getByText("Tidak ada pengantaran di minggu ini")).toBeTruthy();
    });

    it("moves to the next month and loads it, selecting its first day", async () => {
      const runtime = runtimeWith(month);
      renderV2(runtime, <Jadwal />);
      fireEvent.press(await screen.findByRole("button", { name: "Bulan berikutnya" }));
      expect(await screen.findByText("November 2026")).toBeTruthy();
      await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-10-26&to=2026-12-06"));
      expect((await screen.findByRole("button", { name: /^Minggu 1 November/ })).props.accessibilityState.selected).toBe(true);
    });

    it("month arrows give haptic feedback at 44dp", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      const next = await screen.findByRole("button", { name: "Bulan berikutnya" });
      expect([flat(next).width, flat(next).height]).toEqual([44, 44]);
      fireEvent.press(next);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
      fireEvent.press(await screen.findByRole("button", { name: "Bulan sebelumnya" }));
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
    });

    it("day cells dim on press without losing their state", async () => {
      renderV2(runtimeWith(month), <Jadwal />);
      await gridReady();
      const day = () => dayButton("Kamis 8 Oktober");
      // A day cell is a PressableScale: it shrinks on press (a transform, not a dim) and fires the selection haptic.
      fireEvent(day(), "responderGrant", touch);
      expect(day().props.accessibilityState.selected).toBe(false);
      fireEvent.press(day());
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
      expect(day().props.accessibilityState.selected).toBe(true);
      expect(flat(circle("Kamis 8 Oktober")).backgroundColor).toBe(siang.toggleActive);
    });
  });
});

describe("Ubah hari sheet", () => {
  const available: Availability = [
    { date: "2026-10-19", available: true, reason: null, remaining: 4 },
    { date: "2026-10-20", available: false, reason: "CAPACITY", remaining: 0 },
    { date: "2026-10-21", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
  ];
  const flexible = open("d-1", "2026-10-08", { version: 3, catererPhone: "+6281200000001" } as Partial<Delivery>);
  const renderSheet = (d: Delivery, runtime: MobileRuntime) =>
    renderWith(runtime, <ChangeDaySheet delivery={d} addresses={[home, rumah, jauh]} onClose={jest.fn()} />);

  it("hides Pindah tanggal for a fixed package", async () => {
    const fixed = open("d-1", "2026-10-08", { canChange: false, offer: offer({ flexible: false }) });
    renderSheet(fixed, runtimeWith(stateOf([fixed])));
    expect(await screen.findByText("Ganti alamat")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    expect(screen.getByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
  });

  it("moves a day with the chosen date", async () => {
    const command = jest.fn(async () => ({}));
    const runtime = runtimeWith(stateOf([flexible]), available, command);
    renderSheet(flexible, runtime);
    expect(await screen.findByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
    expect(runtime.api.deliveryAvailability).toHaveBeenCalledWith("d-1", "2026-10-07", "2026-11-06");
    // An unavailable day stays in the calendar; a tap on it reads why.
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-20"));
    expect(within(screen.getByTestId("calendar-caption")).getByText("Selasa 20 Okt: Penuh")).toBeTruthy();
    fireEvent.press(screen.getByTestId("calendar-day-2026-10-21"));
    expect(within(screen.getByTestId("calendar-caption")).getByText("Rabu 21 Okt: Terisi")).toBeTruthy();
    // Confirm waits for a choice.
    expect(screen.getByRole("button", { name: "Pindah tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId("calendar-day-2026-10-19"));
    expect(
      screen.getByText("Kami pesan tempat di hari baru dulu, baru Kamis 8 Okt dilepas. Dapur Contoh otomatis dapat kabar."),
    ).toBeTruthy();
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Pindah ke Senin 19 Okt" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.reschedule",
        { id: "d-1", version: 3, date: "2026-10-19", kind: "reschedule" },
        expect.any(String),
      ),
    );
  });

  it("a change that goes through says so and closes, even after the sheet mounted twice", async () => {
    // StrictMode mounts, unmounts and mounts again, as Fast Refresh does: the sheet still knows it is open.
    const onDone = jest.fn();
    const onClose = jest.fn();
    render(
      <StrictMode>
        <MobileProvider runtime={runtimeWith(stateOf([flexible]), available)} linkMapper={customerLink}>
          <ChangeDaySheet delivery={flexible} addresses={[home, rumah, jauh]} onClose={onClose} onDone={onDone} />
        </MobileProvider>
      </StrictMode>,
    );
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledWith({ mode: "date", label: "Senin 19 Okt", message: "Pengantaran pindah ke Senin 19 Okt" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a change that lands after the sheet was swiped away still says so, and closes nothing", async () => {
    let settle = () => {};
    const command = jest.fn(() => new Promise((resolve) => (settle = () => resolve({}))));
    const onDone = jest.fn();
    const onClose = jest.fn();
    const view = renderWith(
      runtimeWith(stateOf([flexible]), available, command),
      <ChangeDaySheet delivery={flexible} addresses={[home, rumah, jauh]} onClose={onClose} onDone={onDone} />,
    );
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    // Swiped down while the change is on its way: the sheet is gone, the change still goes through.
    view.unmount();
    await act(async () => settle());
    // The toast still tells what happened; nothing is closed, because a back now would leave the page under it.
    expect(onDone).toHaveBeenCalledWith({ mode: "date", label: "Senin 19 Okt", message: "Pengantaran pindah ke Senin 19 Okt" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Ubah hari uses the calendar and disables the button until a day is chosen", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const day = await screen.findByTestId("calendar-day-2026-10-12");
    expect(day.props.accessibilityLabel).toBe("Senin 12 Okt, tersedia");
    // The delivery day itself is outlined, not offered; the chip strip is gone.
    expect(screen.getByTestId("calendar-day-2026-10-08").props.accessibilityLabel).toBe("Kamis 8 Okt, hari pengantaran sekarang");
    expect(screen.queryByTestId("chosen-day")).toBeNull();
    expect(screen.getByRole("button", { name: "Pindah tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(day);
    expect(screen.getByTestId("calendar-day-2026-10-12").props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("button", { name: "Pindah ke Senin 12 Okt" }).props.accessibilityState.disabled).toBe(false);
  });

  it("a day that is full cannot be chosen: its tap reads Penuh and the button stays off", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const full = await screen.findByTestId("calendar-day-2026-10-13");
    expect(full.props.accessibilityLabel).toBe("Selasa 13 Okt, tidak tersedia, Penuh");
    fireEvent.press(full);
    expect(within(screen.getByTestId("calendar-caption")).getByText("Selasa 13 Okt: Penuh")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pindah tanggal" }).props.accessibilityState.disabled).toBe(true);
  });

  it("reads Terisi for a day that already has a delivery", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-12"));
    expect(within(screen.getByTestId("calendar-caption")).getByText("Senin 12 Okt: Terisi")).toBeTruthy();
  });

  it("says no other day can be picked when no date is bookable", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), []));
    expect(await screen.findByText("Belum ada hari lain yang bisa kamu pilih di rentang ini.")).toBeTruthy();
  });

  it("says no other day can be picked when every date is unavailable", async () => {
    const full = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), full));
    expect(await screen.findByText("Belum ada hari lain yang bisa kamu pilih di rentang ini.")).toBeTruthy();
  });

  it("shows a busy button while the move is on its way and sends it once", async () => {
    let settle = () => {};
    const command = jest.fn(() => new Promise((resolve) => (settle = () => resolve({}))));
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    const move = screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" });
    fireEvent.press(move);
    fireEvent.press(move);
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }).props.accessibilityState.busy).toBe(true);
    await act(async () => settle());
  });

  it("changes the address for one day", async () => {
    const command = jest.fn(async () => ({}));
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByRole("tab", { name: "Ganti alamat" }));
    // The current address and one outside the caterer's area cannot be chosen.
    expect(screen.getByRole("button", { name: /Kantor/ }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Villa/ }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: /Rumah/ }));
    expect(screen.getByText("Hanya untuk Kamis 8 Okt. Hari lain tetap ke Kantor.")).toBeTruthy();
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Antar ke Rumah" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Antar ke Rumah" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.address",
        { id: "d-1", version: 3, addressId: "a-2" },
        expect.any(String),
      ),
    );
  });

  it("goes back to a disabled Pilih alamat when the chosen address is removed from the list", async () => {
    const runtime = runtimeWith(stateOf([flexible]), available);
    const view = renderWith(runtime, <ChangeDaySheet delivery={flexible} addresses={[home, rumah, jauh]} mode="address" onClose={jest.fn()} />);
    fireEvent.press(await screen.findByRole("button", { name: /Rumah/ }));
    expect(screen.getByRole("button", { name: "Antar ke Rumah" })).toBeEnabled();
    view.rerender(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ChangeDaySheet delivery={flexible} addresses={[home, jauh]} mode="address" onClose={jest.fn()} />
      </MobileProvider>,
    );
    const button = await screen.findByRole("button", { name: "Pilih alamat" });
    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it("scrolls the address list with the native sheet's own body, never a scroller inside it", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available));
    fireEvent.press(await screen.findByRole("tab", { name: "Ganti alamat" }));
    // The form sheet's SheetBody is the one vertical scroller; the dates keep their horizontal strip.
    const vertical = screen.UNSAFE_getAllByType(ScrollView).filter((s) => !s.props.horizontal);
    expect(vertical.map((s) => s.props.testID)).toEqual(["sheet-body"]);
    expect(within(screen.getByTestId("sheet-body")).getByRole("button", { name: /Rumah/ })).toBeTruthy();
  });

  it("opens on the side the day's … asked for, and falls back when the day no longer allows it", async () => {
    const runtime = runtimeWith(stateOf([flexible]), available);
    const view = renderWith(runtime, <ChangeDaySheet delivery={flexible} addresses={[home, rumah, jauh]} mode="address" onClose={jest.fn()} />);
    expect((await screen.findByRole("tab", { name: "Ganti alamat" })).props.accessibilityState.selected).toBe(true);
    view.unmount();
    // A fixed plan cannot move its date: asked for Pindah tanggal, it opens on Ganti alamat.
    const fixed = open("d-1", "2026-10-08", { canChange: false, offer: offer({ flexible: false }) });
    renderWith(runtimeWith(stateOf([fixed])), <ChangeDaySheet delivery={fixed} addresses={[home, rumah, jauh]} mode="date" onClose={jest.fn()} />);
    expect(await screen.findByText("Pilih alamat")).toBeTruthy();
    expect(screen.queryByText("Pilih tanggal")).toBeNull();
  });

  it("is a native sheet: the day is its title and the package its context line", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available));
    expect(await screen.findByRole("header", { name: "Kamis 8 Oktober" })).toBeTruthy();
    expect(screen.getByTestId("sheet-context").props.children).toBe("Makan Siang Rumahan · Dapur Contoh");
  });

  it("address rows are 48dp picks with a selection haptic; a disabled row is set to no haptic", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available));
    fireEvent.press(await screen.findByRole("tab", { name: "Ganti alamat" }));
    (Haptics.selectionAsync as jest.Mock).mockClear();
    const rumahRow = screen.getByRole("button", { name: /Rumah/ });
    expect(StyleSheet.flatten(rumahRow.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(rumahRow);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    // A disabled Pressable never fires onPress, so check the configured haptic on the row's PressableScale.
    const villa = screen.getByRole("button", { name: /Villa/ });
    const scale = (node: typeof villa) => {
      let n: typeof villa | null = node;
      while (n && n.props.haptic === undefined) n = n.parent;
      return n!.props.haptic;
    };
    expect(scale(villa)).toBe("none");
    expect(scale(rumahRow)).toBe("select");
  });

  it("after cutoff offers only chat", async () => {
    const late = open("d-1", "2026-10-07", { catererPhone: "+6281200000001" } as Partial<Delivery>);
    const runtime = runtimeWith(stateOf([late]), available);
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderSheet(late, runtime);
    expect(await screen.findByText("Hari itu sudah tidak bisa diubah")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    expect(screen.queryByText("Ganti alamat")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pindah ke|Antar ke/ })).toBeNull();
    expect(runtime.api.deliveryAvailability).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Chat katering" }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/6281200000001"));
  });

  it.each(["CAPACITY", "FULL"])("says the day is full when the server answers %s", async (code) => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error(code), { code });
    });
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Hari itu sudah penuh. Pilih tanggal lain.")).toBeTruthy();
  });

  it("explains other failures with the shared label", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
    });
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Ada yang berubah. Muat ulang, lalu coba lagi.")).toBeTruthy();
  });

  it("sends the version captured on open and stops when the day changed underneath", async () => {
    const command = jest.fn(async () => ({}));
    const runtime = runtimeWith(stateOf([flexible]), available, command);
    const ui = (d: Delivery) => (
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ChangeDaySheet delivery={d} addresses={[home, rumah, jauh]} onClose={jest.fn()} />
      </MobileProvider>
    );
    const view = render(ui(flexible));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    // The live day moves to version 4 while the sheet is open.
    view.rerender(ui({ ...flexible, version: 4 }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Ada yang berubah di hari itu. Cek lagi sebelum lanjut.")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    // Checked again: the next confirm sends the new version.
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.reschedule",
        { id: "d-1", version: 4, date: "2026-10-19", kind: "reschedule" },
        expect.any(String),
      ),
    );
    expect(screen.queryByText("Ada yang berubah di hari itu. Cek lagi sebelum lanjut.")).toBeNull();
  });

  it("does not send once the cutoff passes while the sheet is open", async () => {
    const command = jest.fn(async () => ({}));
    const closing = open("d-1", "2026-10-08", { cutoff_at: "2026-10-07T03:00:01Z" });
    renderSheet(closing, runtimeWith(stateOf([closing]), available, command));
    fireEvent.press(await screen.findByTestId("calendar-day-2026-10-19"));
    jest.setSystemTime(new Date("2026-10-07T03:00:05Z"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Batas perubahan sudah lewat. Pilih tanggal berikutnya.")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    jest.setSystemTime(NOW);
  });
});

/** The day sheet as the app draws it: the customer root provides the v2 layout scale. */
const showDay = async (d: Delivery, wait: RegExp | string = "Ayam bakar madu", state: CustomerState = stateOf([d])) => {
  mockParams = { id: d.id };
  const view = renderV2(runtimeWith(state), <DayScreen />);
  await screen.findByText(wait);
  // Let the data and fade effects settle inside act.
  await act(async () => {});
  return view;
};
const circleOf = (key: string) => screen.queryByTestId(`day-action-circle-${key}`);
const actionKeys = () =>
  ["change", "menu", "report", "chat", "address"].filter((key) => circleOf(key) !== null);

describe("Hari", () => {
  it("is a sheet body: the handle, a 16:10 photo, the day's line, the dish as hero title, the state line with its cut-off, the address well", async () => {
    const d = open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>);
    await showDay(d);
    // No title row and no package-name line: the sheet has the handle, then the photo and the day's own line.
    expect(screen.getByTestId("sheet-handle", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("sheet-context")).toBeNull();
    expect(screen.queryByText("Makan Siang Rumahan")).toBeNull();
    // The day's line is the screen reader's way in: a header named with the full day, the meal and the caterer.
    expect(screen.getByRole("header", { name: "Besok, Kamis 8 Okt, Makan siang, Dapur Contoh" })).toBeTruthy();
    // Order: the photo first, then the day's line, then the dish.
    const order = JSON.stringify(screen.toJSON());
    expect(order.indexOf("day-photo")).toBeGreaterThan(-1);
    expect(order.indexOf("day-photo")).toBeLessThan(order.indexOf("Kamis 8 Okt · Makan siang · Dapur Contoh"));
    expect(order.indexOf("Kamis 8 Okt · Makan siang · Dapur Contoh")).toBeLessThan(order.indexOf("Ayam bakar madu"));
    // Photo 16:10, radius 16.
    const photo = screen.getByTestId("day-photo");
    expect(flat(photo)).toMatchObject({ aspectRatio: 16 / 10, borderRadius: 16 });
    // Meal and caterer on the meta line; the dish in heroTitle (24/30); the sides under it.
    expect(screen.getByText("Kamis 8 Okt · Makan siang · Dapur Contoh")).toBeTruthy();
    expect(flat(screen.getByText("Ayam bakar madu"))).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(screen.getByText("Sayur asem")).toBeTruthy();
    // The state line: the status, the window and until when the day can change (cut-off 17.00 today).
    expect(screen.getByTestId("day-state-lunch")).toHaveTextContent("Terjadwal 11.00–13.00 · bisa diubah sampai hari ini 17.00");
    // The address row is a 56 well in the canvas tone.
    const well = screen.getByTestId("day-address");
    expect(flat(well)).toMatchObject({ minHeight: 56, borderRadius: 12, backgroundColor: nativeThemes.light.well });
    expect(within(well).getByText("Kantor · Jl. Contoh No. 1 · Tebet")).toBeTruthy();
  });

  it("spaces its blocks by 16 and a meal's own lines by 4, the constants the skeleton reads", async () => {
    await showDay(open("d-next", "2026-10-08"));
    expect(DAY_GAP).toBe(16);
    expect(DAY_MEAL_GAP).toBe(4);
    // Photo and expo-image add two composite levels between the host view and the block that spaces it.
    let body = screen.getByTestId("day-photo").parent!;
    for (let i = 0; i < 6 && flat(body as never).gap !== DAY_GAP; i += 1) body = body.parent!;
    expect(flat(body as never)).toMatchObject({ gap: DAY_GAP });
    // The meal's block is the nearest ancestor of its state line that spaces its lines by 4.
    let meal = screen.getByTestId("day-state-dot-lunch").parent;
    for (let i = 0; i < 8 && meal && flat(meal as never).gap !== DAY_MEAL_GAP; i += 1) meal = meal.parent;
    expect(meal && flat(meal as never)).toMatchObject({ gap: DAY_MEAL_GAP });
  });

  it("puts the actions directly under the first meal's state line, before the address well and any further meal", async () => {
    // One meal: photo, the meal, the actions, then the address.
    let view = await showDay(open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>));
    let tree = JSON.stringify(screen.toJSON());
    let at = (needle: string) => tree.indexOf(needle);
    expect(at("day-photo")).toBeGreaterThan(-1);
    expect(at("day-state-lunch")).toBeGreaterThan(at("day-photo"));
    expect(at("day-actions")).toBeGreaterThan(at("day-state-lunch"));
    expect(at("day-address")).toBeGreaterThan(at("day-actions"));
    view.unmount();
    // Lunch and dinner: the row comes after lunch, before dinner's block and the address well.
    const both = delivery("d-both", "2026-10-08", {}, {
      meals: [
        { meal: "lunch", status: "scheduled" },
        { meal: "dinner", status: "scheduled" },
      ],
      offer: offer({ meal: "both", menus: [menuOf("lunch", "", [{ id: "l-1", name: "Ayam bakar madu" }]), menuOf("dinner", "", [{ id: "d-1", name: "Soto betawi" }])] }),
    } as unknown as Partial<Delivery>);
    view = await showDay(both);
    tree = JSON.stringify(screen.toJSON());
    at = (needle: string) => tree.indexOf(needle);
    expect(at("day-actions")).toBeGreaterThan(at("day-state-lunch"));
    expect(at("Soto betawi")).toBeGreaterThan(at("day-actions"));
    expect(at("day-state-dinner")).toBeGreaterThan(at("Soto betawi"));
    expect(at("day-address")).toBeGreaterThan(at("day-state-dinner"));
    // The row is drawn once.
    expect(screen.getAllByTestId("day-actions")).toHaveLength(1);
    view.unmount();
  });

  it("has no per-meal ⋮, no pinned Ubah hari footer and no text link: the actions are circles in the body", async () => {
    await showDay(delivery("d-today", "2026-10-07", { status: "out_for_delivery" }, { catererPhone: "+6281200000001" } as Partial<Delivery>));
    expect(screen.queryByRole("button", { name: /^Pilihan untuk / })).toBeNull();
    expect(screen.queryByTestId("header-more")).toBeNull();
    expect(screen.queryByTestId("sheet-footer")).toBeNull();
    expect(screen.queryByText("Lihat atau pilih menu")).toBeNull();
    expect(screen.queryByText("Chat katering")).toBeNull();
    // Ada masalah is a labelled circle, not a text button.
    expect(circleOf("report")).toBeTruthy();
    expect(within(screen.getByTestId("day-actions")).getByText("Ada masalah")).toBeTruthy();
  });

  it("draws every action as a 56 circle with its label beneath", async () => {
    // Before the cutoff, today, on its way, with the caterer's number and a menu: all five can show except none hidden.
    const d = delivery("d-today", "2026-10-07", { status: "out_for_delivery" }, {
      catererPhone: "+6281200000001",
      cutoff_at: "2026-10-07T10:00:00Z",
    } as Partial<Delivery>);
    // 10.00 WIB: the cut-off at 17.00 WIB has not passed, so change and address are open too.
    await showDay(d);
    expect(actionKeys()).toEqual(["change", "menu", "report", "chat", "address"]);
    for (const key of actionKeys()) {
      expect(flat(circleOf(key)!)).toMatchObject({ width: 56, height: 56, borderRadius: 28 });
    }
    const row = within(screen.getByTestId("day-actions"));
    for (const label of ["Ubah hari", "Lihat menu", "Ada masalah", "Chat", "Ganti alamat"]) expect(row.getByText(label)).toBeTruthy();
    expect(flat(row.getByText("Ubah hari"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  describe("each action keeps its condition", () => {
    it("Ubah hari opens the change sheet; Ganti alamat opens it on the address side", async () => {
      await showDay(open("d-next", "2026-10-08"));
      fireEvent.press(screen.getByRole("button", { name: "Ubah hari" }));
      expect(router.push).toHaveBeenLastCalledWith("/ubah-hari/d-next");
      fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" }));
      expect(router.push).toHaveBeenLastCalledWith("/ubah-hari/d-next?mode=address");
    });

    it("a closed day (every meal delivered) hides Ubah hari and Ganti alamat", async () => {
      await showDay(delivery("d-past", "2026-10-06", { status: "delivered" }, { catererPhone: "+6281200000001" } as Partial<Delivery>));
      expect(circleOf("change")).toBeNull();
      expect(circleOf("address")).toBeNull();
      // The rest still shows: the menu, the report of yesterday's meal and the chat.
      expect(actionKeys()).toEqual(["menu", "report", "chat"]);
    });

    it("a cancelled day hides Ubah hari and Ganti alamat", async () => {
      const d = delivery("d-gone", "2026-10-08", { status: "cancelled" }, { status: "cancelled" } as Partial<Delivery>);
      mockParams = { id: d.id };
      renderV2(runtimeWith(stateOf([d])), <DayScreen />);
      // No meal is still on: the day is one block named by its package, in the state it is.
      await screen.findByText("Makan Siang Rumahan");
      await act(async () => {});
      expect(screen.getByTestId("day-state-day")).toHaveTextContent("Dibatalkan");
      expect(screen.getByText("Kamis 8 Okt · Dapur Contoh")).toBeTruthy();
      expect(circleOf("change")).toBeNull();
      expect(circleOf("address")).toBeNull();
    });

    it("after the cut-off Ubah hari and Ganti alamat are hidden and the state line says so", async () => {
      // 06.00 on the 7th in Jakarta was the cutoff of the 7th's service: 2026-10-06T10:00Z has passed at 10.00 WIB on the 7th.
      const d = delivery("d-today", "2026-10-07", {}, { cutoff_at: "2026-10-06T10:00:00Z" });
      await showDay(d);
      expect(circleOf("change")).toBeNull();
      expect(circleOf("address")).toBeNull();
      expect(screen.getByTestId("day-state-lunch")).toHaveTextContent("Terjadwal 11.00–13.00 · sudah tidak bisa diubah");
    });

    it("a fixed plan (days cannot move) hides Ubah hari but keeps Ganti alamat", async () => {
      await showDay(open("d-next", "2026-10-08", { canChange: false }));
      expect(circleOf("change")).toBeNull();
      expect(circleOf("address")).toBeTruthy();
    });

    it("Chat is hidden without the caterer's number and opens WhatsApp with it", async () => {
      const view = await showDay(open("d-next", "2026-10-08"));
      expect(circleOf("chat")).toBeNull();
      view.unmount();
      const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
      await showDay(open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>));
      fireEvent.press(screen.getByRole("button", { name: "Chat" }));
      expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
    });

    it("Pilih menu in a pick-your-own package opens the menu choice for the day's first meal; Lihat menu otherwise", async () => {
      const picks = open("d-next", "2026-10-08", { offer: offer({ menuSelectionMode: "customer" } as Partial<Offer>) });
      const view = await showDay(picks);
      expect(screen.getByRole("button", { name: "Pilih menu" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Lihat menu" })).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Pilih menu" }));
      // The sheet closes and the page opens in the tab under it; it is never pushed under a sheet that stays up.
      expect(closeSheetFor).toHaveBeenLastCalledWith("/subscriptions/s-1/menu?date=2026-10-08&meal=lunch");
      expect(router.push).not.toHaveBeenCalled();
      view.unmount();
      // The caterer picks and the menu is set: Lihat menu opens the package.
      await showDay(open("d-next", "2026-10-08"));
      expect(screen.queryByRole("button", { name: "Pilih menu" })).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Lihat menu" }));
      expect(closeSheetFor).toHaveBeenLastCalledWith(`/paket/p-rumahan?title=${encodeURIComponent("Makan Siang Rumahan")}`);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("the menu circle is hidden when the caterer picks and no menu is set yet", async () => {
      await showDay(open("d-next", "2026-10-08", { offer: offer({ menus: [] }) }), "Menu belum diisi");
      expect(circleOf("menu")).toBeNull();
    });

    it("Ada masalah is hidden for a future day, before the window, for a cancelled meal and when every meal has a report", async () => {
      let view = await showDay(open("d-next", "2026-10-18"));
      expect(circleOf("report")).toBeNull();
      view.unmount();
      view = await showDay(open("d-today", "2026-10-07"));
      expect(circleOf("report")).toBeNull();
      view.unmount();
      const reported = delivery("d-today", "2026-10-07", {}, {
        meals: [{ meal: "lunch", status: "out_for_delivery", issue: { id: "i-1", status: "open" } }],
      } as unknown as Partial<Delivery>);
      view = await showDay(reported);
      expect(circleOf("report")).toBeNull();
    });

    it("Ada masalah opens the report for the meal that has no open report yet", async () => {
      const both = (lunchIssue: string | null, dinnerIssue: string | null) =>
        delivery("d-today", "2026-10-07", {}, {
          meals: [
            { meal: "lunch", status: "out_for_delivery", issue: lunchIssue ? { id: "i-1", status: lunchIssue } : null },
            { meal: "dinner", status: "out_for_delivery", issue: dinnerIssue ? { id: "i-2", status: dinnerIssue } : null },
          ],
        } as unknown as Partial<Delivery>);
      let view = await showDay(both("open", null));
      fireEvent.press(screen.getByRole("button", { name: "Ada masalah" }));
      expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
      view.unmount();
      // A resolved report can be followed by a new one.
      view = await showDay(both("responded", "resolved"));
      fireEvent.press(screen.getByRole("button", { name: "Ada masalah" }));
      expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
      view.unmount();
      await showDay(both("open", "escalated"));
      expect(circleOf("report")).toBeNull();
    });

    it("Ada masalah for a meal the kitchen is on the way with, and yesterday's delivered meal", async () => {
      const view = await showDay(delivery("d-today", "2026-10-07", { status: "out_for_delivery" }));
      fireEvent.press(screen.getByRole("button", { name: "Ada masalah" }));
      expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=lunch");
      view.unmount();
      await showDay(delivery("d-past", "2026-10-06", { status: "delivered" }));
      expect(circleOf("report")).toBeTruthy();
    });
  });

  describe("meals and states", () => {
    it("says on the way, arrived and failed in the state line, as Beranda reads them", async () => {
      let view = await showDay(delivery("d-today", "2026-10-07", { status: "out_for_delivery" }));
      expect(screen.getByTestId("day-state-lunch")).toHaveTextContent(/Sedang diantar/);
      view.unmount();
      view = await showDay(
        delivery("d-today", "2026-10-07", {}, {
          meals: [{ meal: "lunch", status: "out_for_delivery", departed_at: "2026-10-07T03:00:00Z", arrived_at: "2026-10-07T03:20:00Z" }],
        } as unknown as Partial<Delivery>),
      );
      expect(screen.getByTestId("day-state-lunch")).toHaveTextContent(/Ditandai sampai/);
      expect(screen.queryByText(/Sedang diantar/)).toBeNull();
      view.unmount();
      await showDay(
        delivery("d-today", "2026-10-07", {}, {
          meals: [{ meal: "lunch", status: "issue", departed_at: "2026-10-07T03:00:00Z", arrived_at: "2026-10-07T03:20:00Z" }],
        } as unknown as Partial<Delivery>),
      );
      expect(screen.getByTestId("day-state-lunch")).toHaveTextContent(/Gagal diantar/);
    });

    it("a day read slower than the sheet's rise still gets the screen reader onto its header, after the loading header had it first", async () => {
      const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
      mockParams = { id: "d-next", title: "Kamis 8 Okt" };
      let release!: (state: CustomerState) => void;
      try {
        const runtime = runtimeWith(() => new Promise<CustomerState>((resolve) => (release = resolve)));
        renderV2(runtime, <DayScreen />);
        // From the first frame the loading sheet has a header: the day the link carried.
        expect(await screen.findByRole("header", { name: "Kamis 8 Okt" })).toBeTruthy();
        // The day's own sheet is up (the session is read and the day is being asked for).
        await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
        await act(async () => {});
        // The sheet's focus window (the fallback and its settle) passes while the day is still being read.
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, SHEET_FOCUS_FALLBACK_MS + SHEET_FOCUS_SETTLE_MS + 100));
        });
        const early = focus.mock.calls.map(([target]) => (target as unknown as { props: Record<string, unknown> }).props.accessibilityLabel);
        expect(early.length).toBeGreaterThan(0);
        expect(early.every((label) => label === "Kamis 8 Okt")).toBe(true);
        focus.mockClear();
        // The day lands after that window: its header takes the focus now.
        await act(async () => release(stateOf([open("d-next", "2026-10-08")])));
        await screen.findByText("Ayam bakar madu");
        await act(async () => {});
        expect(focus).toHaveBeenCalled();
        const [target, event] = focus.mock.calls.at(-1) as unknown as [{ props: Record<string, unknown> }, string];
        expect(event).toBe("focus");
        expect(target.props).toMatchObject({
          accessibilityRole: "header",
          accessibilityLabel: "Besok, Kamis 8 Okt, Makan siang, Dapur Contoh",
        });
      } finally {
        focus.mockRestore();
      }
    });

    it("a day with lunch and dinner shows both meals, one block each, and one row of actions", async () => {
      const d = delivery("d-both", "2026-10-08", {}, {
        meals: [
          { meal: "lunch", status: "scheduled" },
          { meal: "dinner", status: "scheduled" },
        ],
        offer: offer({
          meal: "both",
          menus: [
            menuOf("lunch", "", [{ id: "l-1", name: "Ayam bakar madu" }]),
            menuOf("dinner", "", [{ id: "d-1", name: "Soto betawi" }]),
          ],
        }),
      } as unknown as Partial<Delivery>);
      await showDay(d);
      expect(screen.getByText("Soto betawi")).toBeTruthy();
      expect(screen.getByText("Kamis 8 Okt · Makan siang · Dapur Contoh")).toBeTruthy();
      expect(screen.getByText("Kamis 8 Okt · Makan malam · Dapur Contoh")).toBeTruthy();
      // Only the first block's line is the header the screen reader starts on.
      expect(screen.getAllByRole("header", { name: /Dapur Contoh$/ })).toHaveLength(1);
      expect(screen.getByTestId("day-state-lunch")).toHaveTextContent(/^Terjadwal 11\.00–13\.00/);
      expect(screen.getByTestId("day-state-dinner")).toHaveTextContent(/^Terjadwal 17\.00–19\.00/);
      expect(screen.getAllByTestId("day-actions")).toHaveLength(1);
    });

    it("a day without a meals list still shows the day", async () => {
      const bare = { ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery;
      mockParams = { id: "d-bare" };
      renderV2(runtimeWith(stateOf([bare])), <DayScreen />);
      expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
      await act(async () => {});
    });

    it("signed out, the sheet asks to sign in and comes back to this day", async () => {
      mockParams = { id: "d-next" };
      const runtime = runtimeWith(stateOf([open("d-next", "2026-10-08")]));
      (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
      renderV2(runtime, <DayScreen />);
      fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
      expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/hari/d-next" } });
      expect(runtime.api.customer).not.toHaveBeenCalled();
    });

    it("a day the read does not hold, or a failed read, never shows the day its link carried: the sheet has no title row", async () => {
      mockParams = { id: "d-palsu", title: "Senin 12 Okt" };
      // Loading: the skeleton alone.
      let view = renderV2(runtimeWith(() => new Promise(() => undefined)), <DayScreen />);
      await act(async () => {});
      expect(screen.getByTestId("day-skeleton")).toBeTruthy();
      // The carried day is only the screen reader's header while it loads; nothing on screen says it.
      expect(screen.queryByText("Senin 12 Okt")).toBeNull();
      expect(screen.getByRole("header", { name: "Senin 12 Okt" })).toBeTruthy();
      view.unmount();
      // Not found.
      view = renderV2(runtimeWith(stateOf([open("d-next", "2026-10-08")])), <DayScreen />);
      expect(await screen.findByText("Pengantaran tidak ditemukan.")).toBeTruthy();
      expect(screen.queryByText("Senin 12 Okt")).toBeNull();
      view.unmount();
      // A failed read (offline without a copy).
      renderV2(
        runtimeWith(async () => {
          throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
        }),
        <DayScreen />,
      );
      expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
      expect(screen.queryByText("Senin 12 Okt")).toBeNull();
      await act(async () => {});
    });
  });

  describe("the action row at large text and 360dp", () => {
    const four = () => open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>);

    it("stays on one row at 412dp and normal text", async () => {
      mockWidth = 412;
      await showDay(four());
      expect(actionKeys()).toEqual(["change", "menu", "chat", "address"]);
      // One line, spread across the sheet with 12 at each side.
      expect(flat(screen.getByTestId("day-actions"))).toMatchObject({
        flexDirection: "row",
        flexWrap: "nowrap",
        justifyContent: "space-between",
        paddingHorizontal: DAY_ACTIONS_PAD,
      });
      expect(flat(screen.getByTestId("day-action-change"))).toMatchObject({ minWidth: 56, flexShrink: 1 });
    });

    it("reads its circle, gap and padding from the same constants as the skeleton", async () => {
      await showDay(four());
      expect(ACTION_CIRCLE).toBe(56);
      expect(DAY_ACTION_GAP).toBe(8);
      expect(DAY_ACTIONS_PAD).toBe(12);
      expect(flat(screen.getByTestId("day-action-change"))).toMatchObject({ gap: DAY_ACTION_GAP });
      expect(flat(circleOf("change")!)).toMatchObject({ width: ACTION_CIRCLE, height: ACTION_CIRCLE });
    });

    it("wraps to two lines at 360dp: two circles per line, every label whole", async () => {
      mockWidth = 360;
      await showDay(four());
      expect(flat(screen.getByTestId("day-actions"))).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
      for (const key of actionKeys()) expect(flat(screen.getByTestId(`day-action-${key}`))).toMatchObject({ width: "50%" });
      for (const label of ["Ubah hari", "Lihat menu", "Chat", "Ganti alamat"]) {
        expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
      }
    });

    it("keeps the address and the actions inside the sheet's scrolling body, so at 0.75 and font scale 1.3 they scroll into reach", async () => {
      mockWidth = 360;
      mockFontScale = 1.3;
      await showDay(four());
      const body = screen.getByTestId("sheet-body");
      // Everything under the photo is content of the scroll view: nothing is pinned, fixed in height or clipped by the sheet.
      expect(within(body).getByTestId("day-address")).toBeTruthy();
      expect(within(body).getByTestId("day-actions")).toBeTruthy();
      expect(screen.queryByTestId("sheet-footer")).toBeNull();
      expect(body.props.nestedScrollEnabled).toBe(true);
      const style = StyleSheet.flatten(body.props.contentContainerStyle) as Record<string, unknown>;
      expect(style.height).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      // The rows grow with the text instead of being cut.
      for (const label of ["Ubah hari", "Lihat menu", "Chat", "Ganti alamat"]) expect(screen.getByText(label).props.numberOfLines).toBeUndefined();
      expect(flat(screen.getByTestId("day-address")).minHeight).toBe(56);
      expect(flat(screen.getByTestId("day-address")).height).toBeUndefined();
    });

    it("wraps at font scale 1.3 and keeps the circles 56", async () => {
      mockWidth = 412;
      mockFontScale = 1.3;
      await showDay(four());
      expect(flat(screen.getByTestId("day-actions"))).toMatchObject({ flexWrap: "wrap" });
      for (const key of actionKeys()) expect(flat(circleOf(key)!)).toMatchObject({ width: 56, height: 56 });
    });
  });

  describe("dark theme", () => {
    it("draws the circles on the dark tone and the well on the dark canvas", async () => {
      const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
      mockParams = { id: "d-next" };
      try {
        renderV2(
          runtimeWith(stateOf([open("d-next", "2026-10-08")])),
          <ThemeProvider storageKey="hari-dark">
            <DayScreen />
          </ThemeProvider>,
        );
        await screen.findByText("Ayam bakar madu");
        await act(async () => {});
        expect(flat(circleOf("change")!)).toMatchObject({ backgroundColor: nativeThemes.dark.sage });
        expect(flat(screen.getByTestId("day-address"))).toMatchObject({ backgroundColor: nativeThemes.dark.canvas });
      } finally {
        scheme.mockRestore();
      }
    });
  });
});


describe("signed out", () => {
  it("Jadwal asks to sign in and comes back to /jadwal", async () => {
    const runtime = runtimeWith(stateOf([]));
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    renderWith(runtime, <Jadwal />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/jadwal" } });
    expect(runtime.api.customer).not.toHaveBeenCalled();
  });
});

describe("legacy calendar links", () => {
  it("opens Jadwal from the old /calendar href", () => {
    expect(customerLink("/calendar")).toBe("/jadwal");
  });
});
