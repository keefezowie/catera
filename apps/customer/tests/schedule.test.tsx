import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ActivityIndicator, Image, Linking, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { MoodProvider } from "@catera/mobile-ui";
import type { Address, CustomerState, Delivery, Offer } from "@catera/domain";
import { Jadwal } from "../src/schedule/Jadwal";
import { ChangeDaySheet } from "../src/schedule/ChangeDaySheet";
import { DayScreen } from "../src/schedule/DayScreen";
import { customerLink } from "../src/links";
import { delivery, offer, subscription } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
}));
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
/** A day-level cell by date, to look inside it. */
const cell = (date: string) => within(dayButton(date));
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const outline = (date: string, which: "today" | "selected") =>
  cell(date).queryByTestId(`cell-outline-${which}`, { includeHiddenElements: true });

describe("Jadwal", () => {
  // Today is the 7th. The 5th is past and delivered; the 7th is delivered but not past; the 8th has no menu yet.
  // Dinner is stored before lunch on the 9th, to prove the list orders by meal and not by storage.
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

  it("puts the month grid in the mood header, titled with the month", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    const header = screen.getByTestId("jadwal-header");
    expect(within(header).getByText("Oktober 2026")).toBeTruthy();
    // The month chevrons ride in the header's trailing slot, with the grid and the legend below the title.
    expect(within(header).getByRole("button", { name: "Bulan sebelumnya" })).toBeTruthy();
    expect(within(header).getByRole("button", { name: "Bulan berikutnya" })).toBeTruthy();
    expect(within(header).getByRole("button", { name: /^Kamis 8 Oktober/ })).toBeTruthy();
    expect(within(header).getByText("Foto menu")).toBeTruthy();
    // The selected day's meals are the body, below the header.
    expect(within(header).queryByText(/Makan Siang Rumahan/)).toBeNull();
  });

  it("month grid marks today and selected day", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    expect(await gridReady()).toBeTruthy();
    // Weekday header is Monday first.
    expect(screen.getAllByText(/^(Sen|Sel|Rab|Kam|Jum|Sab|Min)$/).map((n) => n.props.children)).toEqual([
      "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min",
    ]);
    const today = dayButton("Rabu 7 Oktober");
    const other = dayButton("Kamis 8 Oktober");
    // Today starts selected; every day is at least a 44pt target, tall enough for a photo.
    expect(today.props.accessibilityState.selected).toBe(true);
    expect(other.props.accessibilityState.selected).toBe(false);
    expect(flat(other).height).toBe(52);
    expect(flat(other).minWidth).toBeGreaterThanOrEqual(44);
    // Today carries the todayRing outline and, being selected as well, the headerText one inside it.
    expect(flat(outline("Rabu 7 Oktober", "today")!).borderColor).toBe(siang.todayRing);
    expect(flat(outline("Rabu 7 Oktober", "selected")!).borderColor).toBe(siang.headerText);
    expect(outline("Kamis 8 Oktober", "today")).toBeNull();
    expect(outline("Kamis 8 Oktober", "selected")).toBeNull();
    fireEvent.press(other);
    expect(dayButton("Kamis 8 Oktober").props.accessibilityState.selected).toBe(true);
    expect(dayButton("Rabu 7 Oktober").props.accessibilityState.selected).toBe(false);
    expect(flat(outline("Kamis 8 Oktober", "selected")!).borderColor).toBe(siang.headerText);
    // Today keeps its ring after another day is picked, and the selected ring moves away from it.
    expect(flat(outline("Rabu 7 Oktober", "today")!).borderColor).toBe(siang.todayRing);
    expect(outline("Rabu 7 Oktober", "selected")).toBeNull();
  });

  it("tells the selected day from today by more than the ring colour", async () => {
    // No deliveries: both days are bare numbers, so any difference between them is not a photo.
    renderWith(runtimeWith(stateOf([])), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    const bar = (date: string) => cell(date).queryByTestId("cell-selected-bar", { includeHiddenElements: true });
    // The selected day carries a selection bar along its bottom edge, in the header's text colour: a shape, not a hue.
    expect(flat(bar("Kamis 8 Oktober")!)).toMatchObject({ height: 4, backgroundColor: siang.headerText });
    // Today, no longer selected, keeps its ring and has no bar.
    expect(outline("Rabu 7 Oktober", "today")).toBeTruthy();
    expect(bar("Rabu 7 Oktober")).toBeNull();
    // The state is also spoken.
    expect(dayButton("Rabu 7 Oktober").props.accessibilityLabel).toBe("Rabu 7 Oktober, hari ini");
    expect(dayButton("Kamis 8 Oktober").props.accessibilityLabel).toBe("Kamis 8 Oktober, dipilih");
  });

  it("a selected photo day gets the bar and keeps its cream pill, which is not the past pill", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    expect(flat(cell("Jumat 9 Oktober").getByTestId("cell-number-pill")).backgroundColor).toBe(nativeThemes.light.cream);
    expect(cell("Jumat 9 Oktober").queryByTestId("cell-selected-bar", { includeHiddenElements: true })).toBeNull();
    fireEvent.press(dayButton("Jumat 9 Oktober"));
    expect(flat(cell("Jumat 9 Oktober").getByTestId("cell-number-pill")).backgroundColor).toBe(nativeThemes.light.cream);
    expect(cell("Jumat 9 Oktober").getByTestId("cell-selected-bar", { includeHiddenElements: true })).toBeTruthy();
    // A past delivered day keeps its forest pill whether or not it is selected.
    expect(flat(cell("Senin 5 Oktober").getByTestId("cell-number-pill")).backgroundColor).toBe(nativeThemes.light.forest);
  });

  it("keeps the grid inside 360dp wide screens with no horizontal overflow", async () => {
    mockWidth = 360;
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    const header = screen.getByTestId("jadwal-header");
    const sample = flat(dayButton("Jumat 9 Oktober"));
    // Each cell shares the row (flex: 1) down to a 44dp floor, instead of holding a fixed 48dp.
    expect(sample.minWidth).toBe(44);
    expect(sample.flex).toBe(1);
    expect(sample.width).toBeUndefined();
    const grid = flat(within(header).getByTestId("month-grid"));
    const gap = grid.gap as number;
    expect(gap).toBe(2);
    // The header pads 20dp and the grid pulls out 8dp, leaving 12dp on each side.
    const side = flat(within(header).getByTestId("mood-header-content")).paddingHorizontal as number + (grid.marginHorizontal as number);
    expect(side).toBe(12);
    // Seven floor-width cells, the gaps between them and both sides fit the screen.
    expect(2 * side + 7 * 44 + 6 * gap).toBeLessThanOrEqual(360);
    // No row or the grid itself is given a fixed width.
    for (const row of within(header).getAllByTestId("month-week")) expect(flat(row).width).toBeUndefined();
    expect(grid.width).toBeUndefined();
  });

  it("draws a covered day as the lunch photo, dimmed once it is past and delivered", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    expect(cell("Jumat 9 Oktober").UNSAFE_getByType(Image).props.source).toEqual({ uri: shot("siang-9") });
    expect(cell("Jumat 9 Oktober").queryByTestId("cell-dashed", { includeHiddenElements: true })).toBeNull();
    // Past (before today) and every meal delivered: dimmed, with the forest pill.
    expect(flat(cell("Senin 5 Oktober").getByTestId("cell-photo")).opacity).toBe(0.5);
    expect(flat(cell("Senin 5 Oktober").getByTestId("cell-number-pill")).backgroundColor).toBe(nativeThemes.light.forest);
    // Today's delivered lunch is not past, and neither is a delivered day still ahead.
    expect(flat(cell("Rabu 7 Oktober").getByTestId("cell-photo")).opacity).toBe(1);
    expect(flat(cell("Selasa 13 Oktober").getByTestId("cell-photo")).opacity).toBe(1);
    // A day with no meal is only its number.
    expect(cell("Minggu 11 Oktober").UNSAFE_queryByType(Image)).toBeNull();
  });

  it("shows the moon badge only when a day covers both meals", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    const moon = (date: string) => cell(date).queryByTestId("cell-moon", { includeHiddenElements: true });
    expect(moon("Jumat 9 Oktober")).toBeTruthy();
    expect(moon("Selasa 13 Oktober")).toBeTruthy();
    // A dinner-only day shows the dinner photo and no badge, and a lunch-only day none either.
    expect(cell("Sabtu 10 Oktober").UNSAFE_getByType(Image).props.source).toEqual({ uri: shot("malam-10") });
    expect(moon("Sabtu 10 Oktober")).toBeNull();
    expect(moon("Rabu 7 Oktober")).toBeNull();
  });

  it("draws a day whose menu is not set as a dashed outline with no photo", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    const unset = cell("Kamis 8 Oktober");
    expect(flat(unset.getByTestId("cell-dashed", { includeHiddenElements: true })).borderStyle).toBe("dashed");
    expect(flat(unset.getByTestId("cell-dashed", { includeHiddenElements: true })).borderColor).toBe(siang.markerIdle);
    // The package photo is not shown for a surprise menu.
    expect(unset.UNSAFE_queryByType(Image)).toBeNull();
  });

  it("falls back to the number and a dot at large text sizes, with the moon beside the dot", async () => {
    mockFontScale = 1.3;
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    expect(cell("Jumat 9 Oktober").UNSAFE_queryByType(Image)).toBeNull();
    expect(cell("Jumat 9 Oktober").getByTestId("cell-photo-dot", { includeHiddenElements: true })).toBeTruthy();
    expect(cell("Jumat 9 Oktober").getByTestId("cell-moon-dot", { includeHiddenElements: true })).toBeTruthy();
    expect(cell("Sabtu 10 Oktober").queryByTestId("cell-moon-dot", { includeHiddenElements: true })).toBeNull();
  });

  it("under Malam the rings and the selection bar are the Malam tokens", async () => {
    renderWith(
      runtimeWith(coverage),
      <MoodProvider now={() => new Date("2026-10-09T08:00:00Z")}>
        <Jadwal />
      </MoodProvider>,
    );
    await gridReady();
    expect(flat(outline("Rabu 7 Oktober", "today")!).borderColor).toBe(malam.todayRing);
    expect(flat(outline("Rabu 7 Oktober", "selected")!).borderColor).toBe(malam.headerText);
    expect(malam.headerText).toBe("#FFF7E9");
    expect(flat(cell("Rabu 7 Oktober").getByTestId("cell-selected-bar")).backgroundColor).toBe(malam.headerText);
    // The pill is the ordinary one, so it does not borrow the selected state's colour.
    expect(flat(cell("Rabu 7 Oktober").getByTestId("cell-number-pill")).backgroundColor).toBe(nativeThemes.light.cream);
  });

  it("loads the shown month by Jakarta dates", async () => {
    const runtime = runtimeWith(month);
    renderWith(runtime, <Jadwal />);
    await gridReady();
    expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-10-01&to=2026-10-31");
  });

  it("lists the selected day's meals and opens one", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    expect(within(row).getByText(/Makan siang · 11\.00–13\.00/)).toBeTruthy();
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/hari/d-next");
  });

  it("a meal row's detail line wraps instead of truncating at large text sizes", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    // The line carries the window and the arrived state; a one-line cap hid "Sudah sampai" at font scale 1.3.
    expect(within(row).getByText(/Makan siang · 11.00–13.00/).props.numberOfLines).toBeUndefined();
  });

  it("a meal row's dish name wraps instead of truncating at 360dp and font scale 1.3", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    // The name was cut to "Ayam Sambal Ruma..." by a one-line cap; headlines wrap and never truncate.
    expect(within(row).getByText("Makan Siang Rumahan").props.numberOfLines).toBeUndefined();
  });

  it("legend names the photo, the unset menu and the dinner badge", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    const header = screen.getByTestId("jadwal-header");
    expect(within(header).getByText("Foto menu")).toBeTruthy();
    expect(within(header).getByText("Menu belum diisi")).toBeTruthy();
    expect(within(header).getByText("Ada makan malam")).toBeTruthy();
    // The old sun, moon and arrived legend is gone.
    expect(screen.queryByTestId("legend-lunch")).toBeNull();
    expect(screen.queryByText("Diantar")).toBeNull();
    expect(screen.queryByText("Dipindah")).toBeNull();
  });

  it("legend swatches draw what the cells draw", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await screen.findByText("Foto menu");
    // Unset: a dashed markerIdle outline. Dinner: the forest moon. Both sit on the header, so they read the mood palette.
    const dashed = within(screen.getByTestId("legend-unset")).getByTestId("legend-unset-swatch");
    expect(flat(dashed)).toMatchObject({ borderStyle: "dashed", borderColor: siang.markerIdle });
    expect(within(screen.getByTestId("legend-dinner")).UNSAFE_getByType(Ionicons).props.name).toBe("moon");
    expect(flat(within(screen.getByTestId("legend-photo")).getByTestId("legend-photo-swatch")).borderRadius).toBeGreaterThan(0);
  });

  it("legend reads in English when the language is English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    renderWith(runtimeWith(month), <Jadwal />);
    expect(await screen.findByText("Menu photo")).toBeTruthy();
    expect(screen.getByText("Menu not set")).toBeTruthy();
    expect(screen.getByText("Dinner too")).toBeTruthy();
  });

  // Unknown data is never drawn as an uncovered month: with nothing loaded the header says so instead of the grid.
  const noCalendar = () => {
    expect(screen.queryByTestId("month-grid")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rabu 7 Oktober/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Kamis 8 Oktober/ })).toBeNull();
    expect(screen.queryByText("Foto menu")).toBeNull();
    expect(screen.queryByTestId("legend-photo")).toBeNull();
  };

  it("while the month loads, the header says so in place of the grid and legend", async () => {
    const runtime = runtimeWith(() => new Promise<CustomerState>(() => {}));
    renderWith(runtime, <Jadwal />);
    const header = await screen.findByTestId("jadwal-header");
    expect(within(header).getByText("Oktober 2026")).toBeTruthy();
    expect(within(header).getByText("Memuat…")).toBeTruthy();
    expect(within(header).UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    noCalendar();
  });

  it("the loading text reads in English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    renderWith(runtimeWith(() => new Promise<CustomerState>(() => {})), <Jadwal />);
    expect(await screen.findByText("Loading…")).toBeTruthy();
  });

  it("when the first load fails, the header shows the error and a retry in place of the grid", async () => {
    const runtime = runtimeWith(month);
    const failure = Object.assign(new Error("slow"), { code: "REQUEST_TIMEOUT" });
    (runtime.api.customer as jest.Mock).mockRejectedValueOnce(failure);
    renderWith(runtime, <Jadwal />);
    const header = await screen.findByTestId("jadwal-header");
    const retry = await within(header).findByRole("button", { name: "Coba lagi" });
    const message = within(header).getByText("Koneksi terlalu lama. Periksa koneksi dan coba lagi.");
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

  it("moving to a month that has not loaded replaces the grid with the loading text", async () => {
    const runtime = runtimeWith(month);
    renderWith(runtime, <Jadwal />);
    await screen.findByRole("button", { name: /^Rabu 7 Oktober/ });
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise<CustomerState>(() => {}));
    fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(await screen.findByText("November 2026")).toBeTruthy();
    expect(within(screen.getByTestId("jadwal-header")).getByText("Memuat…")).toBeTruthy();
    expect(screen.queryByTestId("month-grid")).toBeNull();
  });

  it("a loaded month with no deliveries still draws the grid, as an honest empty month", async () => {
    renderWith(runtimeWith(stateOf([])), <Jadwal />);
    expect(await screen.findByRole("button", { name: /^Rabu 7 Oktober/ })).toBeTruthy();
    expect(screen.getByTestId("month-grid")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
  });

  it("month arrows give haptic feedback at 48dp", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    const next = await screen.findByRole("button", { name: "Bulan berikutnya" });
    const flat = StyleSheet.flatten(next.props.style);
    expect([flat.width, flat.height]).toEqual([48, 48]);
    fireEvent.press(next);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(await screen.findByRole("button", { name: "Bulan sebelumnya" }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it("day cells and meal rows dim on press without losing their state", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await gridReady();
    const day = () => dayButton("Kamis 8 Oktober");
    // A day cell is a PressableScale: it shrinks on press (a transform, not a dim) and fires the selection haptic.
    fireEvent(day(), "responderGrant", touch);
    expect(day().props.accessibilityState.selected).toBe(false);
    fireEvent.press(day());
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    // A selected cell keeps its outline and state after the press.
    expect(day().props.accessibilityState.selected).toBe(true);
    expect(outline("Kamis 8 Oktober", "selected")).toBeTruthy();
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    fireEvent(row, "responderGrant", touch);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: /Makan Siang Rumahan/ }).props.style).opacity).toBe(0.7);
  });

  it("says a meal the caterer could not deliver was not delivered, and marks no coverage", async () => {
    const failed = stateOf([delivery("d-failed", "2026-10-06", { status: "issue" })]);
    renderWith(runtimeWith(failed), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Selasa 6 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    expect(within(row).getByText(/Tidak bisa diantar/)).toBeTruthy();
    // The day looks like a day without deliveries: no coverage in its label, no photo, dashed outline or dot.
    // It was just picked, so its label says that and nothing about a meal.
    expect(dayButton("Selasa 6 Oktober").props.accessibilityLabel).toBe("Selasa 6 Oktober, dipilih");
    expect(cell("Selasa 6 Oktober").UNSAFE_queryByType(Image)).toBeNull();
    expect(cell("Selasa 6 Oktober").queryByTestId("cell-dashed", { includeHiddenElements: true })).toBeNull();
    expect(cell("Selasa 6 Oktober").queryByTestId("cell-photo-dot", { includeHiddenElements: true })).toBeNull();
  });

  it("labels a covered day with its meals and its state", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    expect(await screen.findByLabelText("Jumat 9 Oktober, makan siang dan makan malam")).toBeTruthy();
    expect(screen.getByLabelText("Sabtu 10 Oktober, makan malam")).toBeTruthy();
    expect(screen.getByLabelText("Kamis 8 Oktober, makan siang, menu belum diisi")).toBeTruthy();
    expect(screen.getByLabelText("Senin 5 Oktober, makan siang, sudah sampai")).toBeTruthy();
    expect(screen.getByLabelText("Selasa 13 Oktober, makan siang dan makan malam, sudah sampai")).toBeTruthy();
    expect(screen.getByLabelText("Minggu 11 Oktober")).toBeTruthy();
    // Today starts selected, and both are said.
    expect(screen.getByLabelText("Rabu 7 Oktober, makan siang, sudah sampai, hari ini, dipilih")).toBeTruthy();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    expect(screen.getByLabelText("Kamis 8 Oktober, makan siang, menu belum diisi, dipilih")).toBeTruthy();
    expect(screen.getByLabelText("Rabu 7 Oktober, makan siang, sudah sampai, hari ini")).toBeTruthy();
  });

  it("labels a covered day in English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    renderWith(runtimeWith(coverage), <Jadwal />);
    expect(await screen.findByLabelText("Friday 9 October, lunch and dinner")).toBeTruthy();
    expect(screen.getByLabelText("Thursday 8 October, lunch, menu not set")).toBeTruthy();
    expect(screen.getByLabelText("Wednesday 7 October, lunch, arrived, today, selected")).toBeTruthy();
  });

  it("lists lunch before dinner on a day with both", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await gridReady();
    fireEvent.press(dayButton("Jumat 9 Oktober"));
    const rows = screen
      .getAllByRole("button")
      .filter((b) => /, Makan (siang|malam) · /.test(b.props.accessibilityLabel ?? ""));
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/Makan siang/)).toBeTruthy();
    expect(within(rows[1]).getByText(/Makan malam/)).toBeTruthy();
  });

  it("shows a day whose meals list is missing without failing", async () => {
    const bare = stateOf([{ ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery]);
    renderWith(runtimeWith(bare), <Jadwal />);
    expect(await gridReady()).toBeTruthy();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    expect(screen.getByText("Tidak ada pengantaran di hari ini.")).toBeTruthy();
  });

  it("moves to the next month and loads it", async () => {
    const runtime = runtimeWith(month);
    renderWith(runtime, <Jadwal />);
    fireEvent.press(await screen.findByRole("button", { name: "Bulan berikutnya" }));
    expect(await screen.findByText("November 2026")).toBeTruthy();
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-11-01&to=2026-11-30"));
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
    // Unavailable dates are listed and disabled, with the reason.
    const full = await screen.findByRole("button", { name: "Selasa 20 Okt, Katering penuh" });
    expect(full.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Rabu 21 Okt, Sudah ada pengantaran" }).props.accessibilityState.disabled).toBe(true);
    // Confirm waits for a choice.
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Senin 19 Okt" }));
    expect(
      screen.getByText("Tempat di hari baru dipesan dulu, baru Kamis 8 Okt dilepas. Dapur Contoh otomatis tahu."),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.reschedule",
        { id: "d-1", version: 3, date: "2026-10-19", kind: "reschedule" },
        expect.any(String),
      ),
    );
  });

  it("shows bookable dates as chips and picks one", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const chip = await screen.findByRole("button", { name: /Senin 12 Okt/ });
    expect(chip.props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(chip);
    expect(screen.getByRole("button", { name: "Senin 12 Okt" }).props.accessibilityState.selected).toBe(true);
    // The long label of the chosen day appears under the strip.
    expect(within(screen.getByTestId("chosen-day")).getByText("Senin 12 Okt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pindah ke Senin 12 Okt" }).props.accessibilityState.disabled).toBe(false);
  });

  it("marks a full date as unavailable", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const chip = await screen.findByRole("button", { name: /Selasa 13 Okt, Katering penuh/ });
    expect(chip.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(chip);
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
  });

  it("shows why a date is unavailable", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const full = await screen.findByRole("button", { name: /Selasa 13 Okt, Katering penuh/ });
    expect(within(full).getByText("Penuh")).toBeTruthy();
    const taken = screen.getByRole("button", { name: /Senin 12 Okt, Sudah ada pengantaran/ });
    expect(within(taken).getByText("Terisi")).toBeTruthy();
  });

  it("shows the empty message when no date is bookable", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), []));
    expect(await screen.findByText("Belum ada tanggal yang tersedia dalam 30 hari ke depan.")).toBeTruthy();
  });

  it("shows the empty message when every date is unavailable", async () => {
    const full = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), full));
    expect(await screen.findByText("Belum ada tanggal yang tersedia dalam 30 hari ke depan.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Selasa 13 Okt, Katering penuh/ })).toBeTruthy();
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
    fireEvent.press(screen.getByRole("button", { name: "Antar ke Rumah" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.address",
        { id: "d-1", version: 3, addressId: "a-2" },
        expect.any(String),
      ),
    );
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
    expect(await screen.findByText("Hari ini sudah tidak bisa diubah")).toBeTruthy();
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
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Hari itu sudah penuh. Pilih tanggal lain.")).toBeTruthy();
  });

  it("explains other failures with the shared label", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
    });
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Data sudah berubah. Muat ulang sebelum mencoba lagi.")).toBeTruthy();
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
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    // The live day moves to version 4 while the sheet is open.
    view.rerender(ui({ ...flexible, version: 4 }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Detail hari ini berubah. Periksa lagi.")).toBeTruthy();
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
    expect(screen.queryByText("Detail hari ini berubah. Periksa lagi.")).toBeNull();
  });

  it("does not send once the cutoff passes while the sheet is open", async () => {
    const command = jest.fn(async () => ({}));
    const closing = open("d-1", "2026-10-08", { cutoff_at: "2026-10-07T03:00:01Z" });
    renderSheet(closing, runtimeWith(stateOf([closing]), available, command));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    jest.setSystemTime(new Date("2026-10-07T03:00:05Z"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Batas perubahan sudah lewat. Pilih tanggal berikutnya.")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    jest.setSystemTime(NOW);
  });
});

describe("Hari", () => {
  it("opens the change sheet from the day", async () => {
    mockParams = { id: "d-next" };
    const d = open("d-next", "2026-10-08");
    renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    expect(await screen.findByText(/Makan Siang Rumahan/)).toBeTruthy();
    expect(screen.getByText(/Kamis 8 Okt/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ubah hari" }));
    expect(await screen.findByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
  });
});

describe("Hari: Ada masalah", () => {
  // NOW is Wednesday 7 Oct, 10.00 in Jakarta; the lunch window opens at 11.00.
  const report = () => screen.queryByRole("button", { name: "Ada masalah" });
  const show = async (d: Delivery) => {
    mockParams = { id: d.id };
    const view = renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    await screen.findByText(/Makan Siang Rumahan/);
    return view;
  };

  it("is not offered for a future day", async () => {
    await show(open("d-next", "2026-10-18"));
    expect(report()).toBeNull();
  });

  it("is not offered today before the window opens", async () => {
    await show(open("d-today", "2026-10-07"));
    expect(report()).toBeNull();
  });

  it("is not offered for a cancelled meal", async () => {
    const d = delivery("d-today", "2026-10-07", {}, {
      meals: [
        { meal: "lunch", status: "cancelled" },
        { meal: "dinner", status: "scheduled" },
      ],
      offer: offer({ windows: { lunch: "08.00–09.00", dinner: "17.00–19.00" } }),
    });
    await show(d);
    expect(report()).toBeNull();
  });

  it("is offered today once the meal is on its way, and opens the report for that meal", async () => {
    await show(delivery("d-today", "2026-10-07", { status: "out_for_delivery" }));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch");
  });

  it("is offered today once the window has started", async () => {
    await show(open("d-today", "2026-10-07", { offer: offer({ windows: { lunch: "09.30–11.00", dinner: "17.00–19.00" } }) }));
    expect(report()).toBeTruthy();
  });

  it("opens the meal that has no open report yet, and hides when every meal has one", async () => {
    const both = (lunchIssue: string | null, dinnerIssue: string | null) =>
      delivery("d-today", "2026-10-07", {}, {
        meals: [
          { meal: "lunch", status: "out_for_delivery", issue: lunchIssue ? { id: "i-1", status: lunchIssue } : null },
          { meal: "dinner", status: "out_for_delivery", issue: dinnerIssue ? { id: "i-2", status: dinnerIssue } : null },
        ],
      });
    let view = await show(both("open", null));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
    view.unmount();
    // A resolved report can be followed by a new one.
    view = await show(both("responded", "resolved"));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
    view.unmount();
    await show(both("open", "escalated"));
    expect(report()).toBeNull();
  });

  it("is offered for yesterday's delivered meal", async () => {
    await show(delivery("d-past", "2026-10-06", { status: "delivered" }));
    expect(report()).toBeTruthy();
  });
});

describe("Hari without a meals list", () => {
  it("still shows the day", async () => {
    mockParams = { id: "d-bare" };
    const bare = { ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery;
    renderWith(runtimeWith(stateOf([bare])), <DayScreen />);
    expect(await screen.findByText(/Makan Siang Rumahan/)).toBeTruthy();
  });
});

describe("Hari Chat katering", () => {
  it("opens WhatsApp from the day, and hides the chat without a number", async () => {
    mockParams = { id: "d-next" };
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const d = open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>);
    const view = renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Chat katering" }));
    expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
    view.unmount();
    renderWith(runtimeWith(stateOf([open("d-next", "2026-10-08")])), <DayScreen />);
    await screen.findByText(/Makan Siang Rumahan/);
    expect(screen.queryByRole("button", { name: "Chat katering" })).toBeNull();
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
