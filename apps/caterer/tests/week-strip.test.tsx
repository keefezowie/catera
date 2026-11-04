import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import * as Reanimated from "react-native-reanimated";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SellerOperationsState } from "@catera/domain";
import { MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { contrastRatio, nativeMood, nativeThemes } from "@catera/design-tokens";
import { render } from "./render-dapur";
import { hostsOf, iconsIn } from "./host-queries";
import { canvasDay, delivery } from "./fixtures";
import { TodayScreen } from "../src/today/TodayScreen";

import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { resetSheets, SheetHost, type Opened } from "./sheet-host";
import * as offline from "../src/today/offline";

// The clock is pinned to Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
/** Also fakes setTimeout and clearTimeout, so a test can step the calendar's waits (the fill's half fade, the fold after a pick). */
const stepTimeouts = () => {
  jest.useRealTimers();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval",
    ],
  });
};
const pinToday = () =>
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("../src/nav", () => ({
  openLink: jest.fn(),
  goToTab: jest.fn(),
  pushScreen: (href: string) => require("expo-router").router.push(href),
}));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("../src/today/offline", () => ({
  cacheSession: jest.fn(() => 0),
  saveCachedDay: jest.fn(async () => undefined),
  loadCachedDay: jest.fn(async () => null),
}));

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const SIANG_NOW = () => new Date("2026-10-08T07:59:00Z");
const MALAM_NOW = () => new Date("2026-10-08T08:00:00Z");

/** The canvas day on `date`, every row still scheduled; the kitchen's own date is the one asked for. */
function dayFor(date: string, status: "scheduled" | "preparing" = "scheduled"): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = date;
  const meal = status === "scheduled" ? { status } : { status, cooking_started_at: "2026-10-08T01:10:00Z" };
  day.deliveries = day.deliveries.map((d) => ({ ...d, service_date: date, status, meals: [{ meal: "lunch", ...meal }] }) as typeof d);
  return day;
}
/** The week reads that were made for the signed-in kitchen (the first render, before the actor is known, asks with no id). */
const weekReads = (runtime: MobileRuntime) => (runtime.api.sellerCalendar as jest.Mock).mock.calls.filter((c) => c[0] === "k-1");

type Calendar = (id: string, params: Record<string, string>) => Promise<unknown>;
const ordersOn = (...days: [string, number][]) => async () => ({
  days: days.map(([date, orders]) => ({ date, orders, lunch: true, dinner: false })),
});

/** A day is read again with the same rows (ids included), as the server answers; the stop sheet finds its stop by id. */
const steadyDays = () => {
  const days = new Map<string, SellerOperationsState>();
  return async (_id: string, date: string) => {
    if (!days.has(date)) days.set(date, dayFor(date));
    return days.get(date)!;
  };
};
function runtimeWith(calendar: Calendar | null, day: (id: string, date: string) => Promise<unknown> = steadyDays()) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(day),
    sellerCalendar: jest.fn(calendar ?? (async () => ({ days: [] }))),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({ moved: 4 })),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const stopSheet = ({ path, params }: Opened) =>
  path.startsWith("/atur-antaran/") ? (
    <ExceptionSheet id={path.split("/")[2]} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={params.date} />
  ) : null;

function renderToday(runtime: MobileRuntime, { date, now = SIANG_NOW }: { date?: string; now?: () => Date } = {}) {
  return render(
    <MoodProvider now={now}>
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <ToastProvider>
          <TodayScreen date={date} />
          <SheetHost render={stopSheet} />
        </ToastProvider>
      </MobileProvider>
    </MoodProvider>,
  );
}

/** The calendar's day tabs on screen (the Siang / Malam switch is a tab pair of its own). */
const strip = () => screen.getByTestId("week-strip");
const dayTabs = () => within(screen.getByTestId("week-window")).getAllByRole("tab");
const cell = (date: string) => screen.getByTestId(`week-day-${date}`);
const handle = () => screen.getByTestId("week-handle");
/** Every count line keeps its room but is unseen and unheard (queryByText would skip hidden text, so read the wrapper). */
const expectCountLinesHidden = () => {
  for (const tab of dayTabs()) {
    const date = tab.props.testID.slice("week-day-".length);
    const line = screen.getByTestId(`week-day-${date}-count-line`, { includeHiddenElements: true });
    expect(StyleSheet.flatten(line.props.style).opacity).toBe(0);
    expect(line.props.accessibilityElementsHidden).toBe(true);
    expect(line.props.importantForAccessibility).toBe("no-hide-descendants");
  }
};
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const selectedDay = () => dayTabs().find((t) => t.props.accessibilityState.selected)?.props.testID.slice("week-day-".length);
const touch = (y: number, t: number, from = y - 1) => ({
  touchHistory: {
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: t,
    numberActiveTouches: 1,
    touchBank: [{ touchActive: true, startPageX: 100, startPageY: 0, startTimeStamp: 0, currentPageX: 100, currentPageY: y, currentTimeStamp: t, previousPageX: 100, previousPageY: from, previousTimeStamp: t - 16 }],
  },
  nativeEvent: { touches: [], changedTouches: [], timestamp: t },
});
// The handle is a responder, not a button with onPress: a tap is a touch that starts and ends without moving, and the
// handlers are called as the responder system would.
const tapHandle = async () => {
  const zone = handle();
  await act(async () => {
    zone.props.onResponderGrant(touch(0, 0));
    zone.props.onResponderRelease(touch(0, 40, 0));
  });
};
const openMonth = tapHandle;
const WEEK = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
const reads = (runtime: MobileRuntime) => weekReads(runtime).map((c) => [c[1].from, c[1].to]);
const weekdayNames = () => screen.getByTestId("week-weekdays", { includeHiddenElements: true });

beforeEach(() => {
  jest.clearAllMocks();
  resetSheets();
  store().clear();
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  pinToday();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false);
});

describe("the title and the meta line", () => {
  it("titles the header with the plain date: no chevron, no button, on today", async () => {
    await renderToday(runtimeWith(null));
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
    const title = screen.getByText("Kamis 8 Okt");
    expect(title.props.accessibilityRole).toBe("header");
    expect(screen.queryByRole("button", { name: "Kembali ke hari ini" })).toBeNull();
    expect(iconsIn(screen.getByTestId("mood-header")).some((i) => i.name === "chevron-down")).toBe(false);
  });

  it("says Besok for tomorrow and the weekday for the other days, past ones included", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await fireEvent.press(cell("2026-10-09"));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(screen.getByText("Jumat 9 Okt")).toBeTruthy();
    await fireEvent.press(cell("2026-10-11"));
    expect(await screen.findByText("Dapur Bu Rina · Minggu")).toBeTruthy();
    await fireEvent.press(cell("2026-10-05"));
    expect(await screen.findByText("Dapur Bu Rina · Senin")).toBeTruthy();
    expect(screen.getByText("Senin 5 Okt")).toBeTruthy();
  });

  it("says the weekday in English", async () => {
    const runtime = runtimeWith(null);
    store().set(runtime.storageKey("locale"), "en");
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Today");
    await fireEvent.press(cell("2026-10-11"));
    expect(await screen.findByText("Dapur Bu Rina · Sunday")).toBeTruthy();
  });

  it("the title of another day returns to today, and today's title does nothing", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await fireEvent.press(cell("2026-10-11"));
    await screen.findByText("Dapur Bu Rina · Minggu");
    const back = screen.getByRole("button", { name: "Kembali ke hari ini" });
    expect(back.props.accessibilityHint).toBe("Minggu 11 Okt");
    await fireEvent.press(back);
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-08");
    expect(screen.queryByRole("button", { name: "Kembali ke hari ini" })).toBeNull();
  });
});

describe("the week", () => {
  it("is the Monday to Sunday week of today, each cell with its day number and order count", async () => {
    await renderToday(runtimeWith(ordersOn(["2026-10-09", 28], ["2026-10-11", 5])));
    const tab = await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(dayTabs()).toHaveLength(7);
    expect(tab.props.accessibilityLabel).toBe("Jumat 9 Oktober, 28 pengantaran");
    expect(within(tab).getByText("9")).toBeTruthy();
    expect(within(tab).getByText("28")).toBeTruthy();
    expect(dayTabs().map((t) => t.props.accessibilityLabel)).toEqual([
      "Senin 5 Oktober, tidak ada pengantaran",
      "Selasa 6 Oktober, tidak ada pengantaran",
      "Rabu 7 Oktober, tidak ada pengantaran",
      "Kamis 8 Oktober, tidak ada pengantaran",
      "Jumat 9 Oktober, 28 pengantaran",
      "Sabtu 10 Oktober, tidak ada pengantaran",
      "Minggu 11 Oktober, 5 pengantaran",
    ]);
    // A day with no orders shows "0" (the copy glossary retires a lone en dash) and says "tidak ada pengantaran".
    expect(within(cell("2026-10-08")).getByText("0")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-08");
    expect(screen.getByTestId("week-window").props.accessibilityRole).toBe("tablist");
  });

  it("puts one row of weekday names above the cells and none inside them", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const names = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    for (const name of names) expect(within(weekdayNames(), { includeHiddenElements: true }).getByText(name, { includeHiddenElements: true })).toBeTruthy();
    for (const tab of dayTabs()) for (const name of names) expect(within(tab).queryByText(name)).toBeNull();
  });

  it("is the Monday to Sunday week across a month boundary when today is a Sunday", async () => {
    jest.setSystemTime(new Date("2026-11-01T03:00:00Z")); // Sunday 1 Nov
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(dayTabs().map((t) => t.props.testID)).toEqual(
      ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"].map((d) => `week-day-${d}`),
    );
    expect(selectedDay()).toBe("2026-11-01");
  });

  it("reads the week's counts once, Monday to Sunday, for the mood's meal", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    await renderToday(runtime);
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(weekReads(runtime)).toHaveLength(1);
    expect(weekReads(runtime)[0]).toEqual(["k-1", { from: "2026-10-05", to: "2026-10-11", meal: "lunch", status: "active" }]);
  });

  it("names the counts in English", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28], ["2026-10-11", 1]));
    store().set(runtime.storageKey("locale"), "en");
    await renderToday(runtime);
    expect(await screen.findByRole("tab", { name: "Friday 9 October, 28 deliveries" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sunday 11 October, 1 delivery" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Thursday 8 October, no deliveries" })).toBeTruthy();
    expect(within(weekdayNames(), { includeHiddenElements: true }).getByText("Fri", { includeHiddenElements: true })).toBeTruthy();
  });

  it("selecting a day reads that day, shows it read-only, and offers no Mulai masak", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    await renderToday(runtime);
    expect(await screen.findByText("Mulai masak")).toBeTruthy();
    await fireEvent.press(await screen.findByRole("tab", { name: /28 pengantaran/ }));
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-09"));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-09");
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Mulai masak")).toBeNull());
    expect(screen.queryByTestId("screen-footer")).toBeNull();
    // The week was read once; changing the day inside it does not read it again.
    expect(weekReads(runtime)).toHaveLength(1);
  });

  it("keeps seven tabs, without count lines, while the week is still loading", async () => {
    await renderToday(runtimeWith(() => new Promise<never>(() => {})));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(dayTabs()).toHaveLength(7);
    expectCountLinesHidden();
    expect(dayTabs()[4].props.accessibilityLabel).toMatch(/^Jumat 9 Oktober/);
  });

  it("keeps seven tabs, without count lines or an error banner, when the week cannot be read", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await waitFor(() => expect(runtime.api.sellerCalendar).toHaveBeenCalled());
    await act(async () => undefined);
    expect(dayTabs()).toHaveLength(7);
    expectCountLinesHidden();
    expect(screen.queryByText(/Belum bisa memuat/)).toBeNull();
    expect(screen.queryByText("Coba lagi")).toBeNull();
    // The day itself still works.
    expect(await screen.findByText("Mulai masak")).toBeTruthy();
  });

  it("holds one cell height with or without the count line", async () => {
    const pending = await renderToday(runtimeWith(() => new Promise<never>(() => {})));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const waiting = flat(cell("2026-10-09")).minHeight;
    await pending.unmount();
    await renderToday(runtimeWith(ordersOn(["2026-10-09", 28])));
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(flat(cell("2026-10-09")).minHeight).toBe(waiting);
    expect(waiting as number).toBeGreaterThanOrEqual(48);
  });

  it("switching Siang / Malam reads the other meal's counts and keeps the selected day", async () => {
    const runtime = runtimeWith(async (_id, params) =>
      params.meal === "dinner"
        ? { days: [{ date: "2026-10-09", orders: 9, lunch: false, dinner: true }] }
        : { days: [{ date: "2026-10-09", orders: 28, lunch: true, dinner: false }] },
    );
    await renderToday(runtime);
    await fireEvent.press(await screen.findByRole("tab", { name: /Jumat 9 Oktober, 28 pengantaran/ }));
    await screen.findByText("Dapur Bu Rina · Besok");
    await fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    await waitFor(() =>
      expect(runtime.api.sellerCalendar).toHaveBeenLastCalledWith("k-1", { from: "2026-10-05", to: "2026-10-11", meal: "dinner", status: "active" }),
    );
    expect(await screen.findByRole("tab", { name: /Jumat 9 Oktober, 9 pengantaran/ })).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-09");
  });

  it("a pull to refresh reads the week again", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    await renderToday(runtime);
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(weekReads(runtime)).toHaveLength(1);
    const scroll = hostsOf("RCTScrollView").find((n) => n.props.refreshControl)!;
    await act(async () => void (await scroll.props.refreshControl.props.onRefresh()));
    expect(weekReads(runtime)).toHaveLength(2);
  });

  it("gives a select haptic on a change of day, and none for the day already selected", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    (Haptics.selectionAsync as jest.Mock).mockClear();
    await fireEvent.press(cell("2026-10-08"));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    await fireEvent.press(cell("2026-10-10"));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(selectedDay()).toBe("2026-10-10");
  });
});

describe("the four cell states", () => {
  it("draws the selected day filled, today ringed, a past day as an open frame and a future day idle", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const ink = nativeMood.light.siang;
    // Today, selected: the toggle's pair.
    expect(flat(cell("2026-10-08")).borderColor).toBe(ink.toggleActive);
    expect(flat(cell("2026-10-08")).borderWidth).toBe(2);
    expect(flat(screen.getByTestId("week-day-2026-10-08-fill")).backgroundColor).toBe(ink.toggleActive);
    expect(flat(screen.getByTestId("week-day-2026-10-08-fill")).opacity).toBe(1);
    expect(flat(screen.getByTestId("week-day-2026-10-08-number")).color).toBe(ink.onToggleActive);
    // A past day: transparent, a 1dp markerIdle edge, heroMeta ink.
    expect(flat(cell("2026-10-06"))).toMatchObject({ backgroundColor: "transparent", borderWidth: 1, borderColor: ink.markerIdle });
    expect(flat(screen.getByTestId("week-day-2026-10-06-number")).color).toBe(ink.heroMeta);
    expect(flat(screen.getByTestId("week-day-2026-10-06-count")).color).toBe(ink.heroMeta);
    expect(flat(screen.getByTestId("week-day-2026-10-06-fill")).opacity).toBe(0);
    // A future day: the hero surface, the idle edge, the ink as before.
    expect(flat(cell("2026-10-10"))).toMatchObject({ backgroundColor: ink.hero, borderWidth: 1, borderColor: ink.markerIdle });
    expect(flat(screen.getByTestId("week-day-2026-10-10-number")).color).toBe(ink.heroText);
    // Today when another day is selected: the hero surface with a 2dp todayRing edge.
    await fireEvent.press(cell("2026-10-10"));
    expect(flat(cell("2026-10-08"))).toMatchObject({ backgroundColor: ink.hero, borderWidth: 2, borderColor: ink.todayRing });
    expect(flat(cell("2026-10-10")).borderColor).toBe(ink.toggleActive);
  });

  it("reads a past day as view-only: no actions and no Besok", async () => {
    await renderToday(runtimeWith(null, async (_id, date) => ({ ...dayFor(date), deliveries: [], customers: [] })));
    await screen.findByText("Tidak ada yang dimasak hari ini");
    await fireEvent.press(cell("2026-10-06"));
    expect(await screen.findByText("Tidak ada yang dimasak hari Selasa")).toBeTruthy();
    expect(screen.queryByText(/besok/i)).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });

  it("gives a past day's stops no menu, not even Pindah tanggal", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Mulai masak");
    await fireEvent.press(cell("2026-10-06"));
    await screen.findByText("Dapur Bu Rina · Selasa");
    await screen.findByText("Daftar masak");
    expect(screen.queryByLabelText(/^Pindah tanggal/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });
});

describe("the handle and the month", () => {
  it("is a 40 by 5 pill in a 48dp target, a button that says whether the month is open", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(handle().props.accessibilityRole).toBe("button");
    expect(handle().props.accessibilityLabel).toBe("Buka kalender bulan");
    expect(handle().props.accessibilityState.expanded).toBe(false);
    expect(flat(handle()).minHeight).toBeGreaterThanOrEqual(48);
    const pill = handle().queryAll((n) => n.type === "View" && flat(n).width === 40 && flat(n).height === 5);
    expect(pill.length).toBeGreaterThan(0);
    expect(flat(pill[0]).backgroundColor).toBe(nativeMood.light.siang.markerIdle);
    await openMonth();
    expect(handle().props.accessibilityLabel).toBe("Tutup kalender bulan");
    expect(handle().props.accessibilityState.expanded).toBe(true);
    await tapHandle();
    expect(handle().props.accessibilityLabel).toBe("Buka kalender bulan");
    expect(handle().props.accessibilityState.expanded).toBe(false);
  });

  it("opens and closes from a screen reader's activate action, which never reaches the touch responder", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(handle().props.accessibilityActions).toEqual([{ name: "activate" }]);
    await act(async () => handle().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(handle().props.accessibilityState.expanded).toBe(true);
    await act(async () => handle().props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(handle().props.accessibilityState.expanded).toBe(false);
  });

  it("names the handle in English", async () => {
    const runtime = runtimeWith(null);
    store().set(runtime.storageKey("locale"), "en");
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Today");
    expect(handle().props.accessibilityLabel).toBe("Open month calendar");
    await openMonth();
    expect(handle().props.accessibilityLabel).toBe("Close month calendar");
  });

  it("opens to the selected day's month: 5 weeks for October 2026, with the neighbours' days, and reads that grid", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    expect(screen.getByText("Oktober 2026")).toBeTruthy();
    expect(dayTabs()).toHaveLength(35);
    expect(dayTabs()[0].props.accessibilityLabel).toMatch(/^Senin 28 September/);
    expect(dayTabs()[34].props.accessibilityLabel).toMatch(/^Minggu 1 November/);
    await waitFor(() => expect(reads(runtime)).toEqual([["2026-10-05", "2026-10-11"], ["2026-09-28", "2026-11-01"]]));
    expect(selectedDay()).toBe("2026-10-08");
  });

  it("draws the days of the other months in markerIdle ink in the month, and the others in the normal ink", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    const ink = nativeMood.light.siang;
    expect(flat(screen.getByTestId("week-day-2026-09-30-number")).color).toBe(ink.markerIdle);
    expect(flat(screen.getByTestId("week-day-2026-11-01-count")).color).toBe(ink.markerIdle);
    expect(flat(screen.getByTestId("week-day-2026-10-20-number")).color).toBe(ink.heroText);
  });

  it("sizes the open month by its weeks: 5, then 6 for November 2026", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(dayTabs()).toHaveLength(7);
    await openMonth();
    expect(dayTabs()).toHaveLength(35);
    // November 2026 starts on a Sunday and ends on a Monday: six weeks.
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(dayTabs()).toHaveLength(42);
  });

  it("moves between months with the arrows and reads each month's grid", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(screen.getByText("November 2026")).toBeTruthy();
    await waitFor(() => expect(reads(runtime)).toContainEqual(["2026-10-26", "2026-12-06"]));
    await fireEvent.press(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    await fireEvent.press(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    expect(screen.getByText("September 2026")).toBeTruthy();
  });

  it("names the arrows and the month in English", async () => {
    const runtime = runtimeWith(null);
    store().set(runtime.storageKey("locale"), "en");
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Today");
    await openMonth();
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
  });

  it("hides the month row and the other weeks from the screen reader while the week shows", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(screen.queryByRole("button", { name: "Bulan berikutnya" })).toBeNull();
    expect(dayTabs()).toHaveLength(7);
  });

  it("picking a day in the month selects it, then folds back to that day's week", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("tab", { name: /^Senin 19 Oktober/ }));
    expect(selectedDay()).toBe("2026-10-19");
    await act(async () => void (await jest.advanceTimersByTimeAsync(300)));
    await waitFor(() => expect(dayTabs()).toHaveLength(7));
    expect(dayTabs()[0].props.testID).toBe("week-day-2026-10-19");
    expect(handle().props.accessibilityState.expanded).toBe(false);
    expect(await screen.findByText("Dapur Bu Rina · Senin")).toBeTruthy();
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-19"));
    // The open month was read for its whole grid, which already holds the folded week: no third read.
    await waitFor(() => expect(reads(runtime)).toEqual([["2026-10-05", "2026-10-11"], ["2026-09-28", "2026-11-01"]]));
    expect(within(cell("2026-10-20")).getByText("0")).toBeTruthy();
  });

  it("picking a neighbour's day in the grid lands on its own month's week", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("tab", { name: /^Minggu 1 November/ }));
    await act(async () => void (await jest.advanceTimersByTimeAsync(300)));
    await waitFor(() => expect(dayTabs()).toHaveLength(7));
    expect(selectedDay()).toBe("2026-11-01");
    expect(await screen.findByText("Dapur Bu Rina · Minggu")).toBeTruthy();
  });

  it("closing with the handle after browsing away shows the selected day's week again", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    await tapHandle();
    expect(dayTabs().map((t) => t.props.testID)).toEqual(WEEK.map((d) => `week-day-${d}`));
    await openMonth();
    expect(screen.getByText("Oktober 2026")).toBeTruthy();
  });

  it("keeps the selected day and the open month through a Siang / Malam switch", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.getByText("Oktober 2026")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-08");
  });

  it("gives one select haptic when the month opens and one when it closes", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    (Haptics.selectionAsync as jest.Mock).mockClear();
    await openMonth();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    await tapHandle();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });
});

describe("motion", () => {
  it("opens and closes the month over the content duration on the travelling curve", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const spy = jest.spyOn(Reanimated, "withTiming");
    await openMonth();
    expect(spy).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 320, easing: expect.anything() }));
    await tapHandle();
    expect(spy).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 320 }));
  });

  it("slides the grid over the selection duration when the month changes", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    const spy = jest.spyOn(Reanimated, "withTiming");
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(spy).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 260 }));
    expect(spy).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 260 }));
  });

  it("fades a newly chosen day's fill over the control duration, and not on first load", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const spy = jest.spyOn(Reanimated, "withTiming");
    expect(spy).not.toHaveBeenCalled();
    await fireEvent.press(cell("2026-10-10"));
    expect(spy).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  });

  it("jumps every change under reduced motion: no timing at all, the same end state", async () => {
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(true);
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const spy = jest.spyOn(Reanimated, "withTiming");
    await openMonth();
    expect(dayTabs()).toHaveLength(35);
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    await fireEvent.press(screen.getByRole("tab", { name: /^Jumat 20 November/ }));
    await act(async () => void (await jest.advanceTimersByTimeAsync(0)));
    await waitFor(() => expect(dayTabs()).toHaveLength(7));
    expect(selectedDay()).toBe("2026-11-20");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("dragging the handle", () => {
  // The responder never starts here (the handle only claims a vertical move), which fireEvent honours by not firing; the
  // handlers are called as the responder system would.
  const drag = async (to: number, ms: number) => {
    const zone = handle();
    await act(async () => {
      zone.props.onResponderGrant(touch(0, 0));
      zone.props.onResponderMove(touch(to / 2, ms / 2, 0));
      zone.props.onResponderMove(touch(to, ms, to / 2));
      zone.props.onResponderRelease(touch(to, ms, to / 2));
    });
  };

  it("claims a touch on the handle at once, so the screen's scroll cannot take it, and no other touch", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(handle().props.onStartShouldSetResponder(touch(0, 0))).toBe(true);
    expect(handle().props.onStartShouldSetResponderCapture(touch(0, 0))).toBe(true);
    expect(hostsOf("RCTScrollView").find((n) => n.props.refreshControl)).toBeTruthy();
    expect(strip().props.onStartShouldSetResponder).toBeUndefined();
    expect(screen.getByTestId("week-window").props.onStartShouldSetResponder).toBeUndefined();
    // One path: the handle has no press handler of its own.
    expect(handle().props.onPress).toBeUndefined();
  });

  it("does not hand the gesture away while it is dragging", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(handle().props.onResponderTerminationRequest(touch(0, 0))).toBe(false);
  });

  it("goes back to the week when the gesture is cancelled half open", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await act(async () => {
      handle().props.onResponderGrant(touch(0, 0));
      handle().props.onResponderMove(touch(150, 200, 0));
      handle().props.onResponderTerminate(touch(150, 200, 0));
    });
    expect(handle().props.accessibilityState.expanded).toBe(false);
    expect(dayTabs()).toHaveLength(7);
  });

  it("stays open when an open month's gesture is cancelled", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await act(async () => {
      handle().props.onResponderGrant(touch(0, 0));
      handle().props.onResponderMove(touch(-150, 200, 0));
      handle().props.onResponderTerminate(touch(-150, 200, 0));
    });
    expect(handle().props.accessibilityState.expanded).toBe(true);
    expect(dayTabs()).toHaveLength(35);
  });

  it("takes the other months' ink as soon as the finger drags the handle down", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const ink = nativeMood.light.siang;
    await act(async () => {
      handle().props.onResponderGrant(touch(0, 0));
      handle().props.onResponderMove(touch(60, 100, 0));
    });
    expect(flat(screen.getByTestId("week-day-2026-09-30-number", { includeHiddenElements: true })).color).toBe(ink.markerIdle);
    expect(handle().props.accessibilityState.expanded).toBe(false);
  });

  it("opens the month when it is pulled down past half way, and closes it when pushed up", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await drag(200, 400);
    expect(handle().props.accessibilityState.expanded).toBe(true);
    await drag(-200, 400);
    expect(handle().props.accessibilityState.expanded).toBe(false);
  });

  it("goes back to the week when a short drag is let go before half way", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await drag(40, 400);
    expect(handle().props.accessibilityState.expanded).toBe(false);
  });

  it("snaps on release under reduced motion", async () => {
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(true);
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await drag(200, 400);
    expect(handle().props.accessibilityState.expanded).toBe(true);
    expect(dayTabs()).toHaveLength(35);
  });
});

describe("a future day is read-only", () => {
  it("shows the checklist and order without Pilih, a proof-photo note or a footer, on a day ahead", async () => {
    await renderToday(runtimeWith(null, async (_id, date) => dayFor(date, "preparing")));
    // Today, for contrast: the order offers Pilih and the proof-photo note, and the footer has the action.
    expect(await screen.findByRole("button", { name: "Pilih" })).toBeTruthy();
    expect(screen.getByText(/foto bukti/i)).toBeTruthy();
    expect(await screen.findByText(/^Berangkat antar/)).toBeTruthy();
    await fireEvent.press(cell("2026-10-11"));
    await screen.findByText("Dapur Bu Rina · Minggu");
    await waitFor(() => expect(screen.queryByText(/^Berangkat antar/)).toBeNull());
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
    expect(screen.queryByText(/foto bukti/i)).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });

  it("keeps Pindah tanggal in the stop's menu where the day can move, as Besok does", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Mulai masak");
    await fireEvent.press(cell("2026-10-11"));
    await screen.findByText("Dapur Bu Rina · Minggu");
    // Bu Sari can still move (record and cutoff ahead); Keluarga Hartono and the fixed-date package cannot, so no button.
    const menu = await within(await screen.findByTestId("stop-1")).findByLabelText(/^Pindah tanggal/);
    expect(within(screen.getByTestId("stop-3")).queryByLabelText(/^(Laporkan masalah|Pindah tanggal)/)).toBeNull();
    await fireEvent.press(menu);
    const sheet = await screen.findByTestId("exception-sheet");
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Pindah tanggal" })).toBeTruthy());
    expect(screen.queryByText("Gagal diantar")).toBeNull();
  });

  it("brings the attention items on today only", async () => {
    const runtime = runtimeWith(null);
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [{ id: "a-1", kind: "payment", priority: 1, at_time: "2026-10-08T01:00:00Z", context: "", href: "/uang" }],
      total: 1,
      nextCursor: null,
      timezone: "Asia/Jakarta",
    });
    await renderToday(runtime);
    expect(await screen.findByText("Ada pembayaran yang perlu dicek")).toBeTruthy();
    await fireEvent.press(cell("2026-10-10"));
    await screen.findByText("Dapur Bu Rina · Sabtu");
    expect(screen.queryByText("Ada pembayaran yang perlu dicek")).toBeNull();
    await fireEvent.press(cell("2026-10-08"));
    expect(await screen.findByText("Ada pembayaran yang perlu dicek")).toBeTruthy();
  });

  it("words the empty state for a later day with its weekday", async () => {
    await renderToday(runtimeWith(null, async (_id, date) => ({ ...dayFor(date), deliveries: [], customers: [] })));
    await screen.findByText("Tidak ada yang dimasak hari ini");
    await fireEvent.press(cell("2026-10-09"));
    expect(await screen.findByText("Tidak ada yang dimasak besok")).toBeTruthy();
    await fireEvent.press(cell("2026-10-11"));
    expect(await screen.findByText("Tidak ada yang dimasak hari Minggu")).toBeTruthy();
  });
});

describe("Semua beres and notifications", () => {
  it("Lihat besok selects tomorrow's cell", async () => {
    const done = (date: string) => {
      const d = dayFor(date);
      d.deliveries = d.deliveries.map((x) => ({ ...x, status: "delivered", meals: [{ meal: "lunch", status: "delivered" }] }) as typeof x);
      return date === "2026-10-08" ? d : dayFor(date);
    };
    await renderToday(runtimeWith(null, async (_id, date) => done(date)));
    await fireEvent.press(await screen.findByRole("button", { name: "Lihat besok" }));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-09");
  });

  it("opens on the day a notification points to, in this week", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime, { date: "2026-10-11" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-11"));
    expect(await screen.findByText("Dapur Bu Rina · Minggu")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-11");
  });

  it("opens on a far day whatever week it is in, shows that day's week and reads it", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime, { date: "2026-11-20" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-11-20"));
    expect(await screen.findByText("Dapur Bu Rina · Jumat")).toBeTruthy();
    expect(selectedDay()).toBe("2026-11-20");
    expect(dayTabs()[0].props.testID).toBe("week-day-2026-11-16");
    await waitFor(() => expect(reads(runtime)).toContainEqual(["2026-11-16", "2026-11-22"]));
  });

  it("opens on a past day too", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime, { date: "2026-09-30" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-09-30"));
    expect(selectedDay()).toBe("2026-09-30");
  });

  it("opens on today for a date that is not a date", async () => {
    const runtime = runtimeWith(null);
    await renderToday(runtime, { date: "2026-02-30" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-08"));
    expect(runtime.api.sellerOperations).not.toHaveBeenCalledWith("k-1", "2026-02-30");
    expect(selectedDay()).toBe("2026-10-08");
  });

  it("follows a new notification date while the screen is open", async () => {
    const runtime = runtimeWith(null);
    const view = await renderToday(runtime, { date: "2026-10-09" });
    await screen.findByText("Dapur Bu Rina · Besok");
    await view.rerender(
      <MoodProvider now={SIANG_NOW}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>
            <TodayScreen date="2026-10-11" />
          </ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    );
    expect(await screen.findByText("Dapur Bu Rina · Minggu")).toBeTruthy();
    expect(selectedDay()).toBe("2026-10-11");
  });
});

describe("a narrow phone and large text", () => {
  it("shares the width equally, keeps each line to one line that shrinks to 0.85, and never scrolls sideways", async () => {
    await renderToday(runtimeWith(ordersOn(["2026-10-09", 28])));
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    const row = screen.getByTestId("week-row-1");
    expect(flat(row).flexDirection).toBe("row");
    expect(hostsOf("RCTScrollView", strip())).toHaveLength(0);
    for (const date of WEEK) {
      expect(flat(cell(date)).flex).toBe(1);
      for (const part of ["number", "count"]) {
        const text = screen.getByTestId(`week-day-${date}-${part}`, { includeHiddenElements: true });
        expect(text.props.numberOfLines).toBe(1);
        expect(text.props.adjustsFontSizeToFit).toBe(true);
        expect(text.props.minimumFontScale).toBe(0.85);
        expect(flat(text).fontVariant).toEqual(["tabular-nums"]);
      }
    }
    // Adjacent targets keep a gap.
    expect(flat(row).gap).toBeGreaterThanOrEqual(4);
  });
});

describe("light and dark, Siang and Malam", () => {
  const combos = [
    ["light", "siang", SIANG_NOW],
    ["light", "malam", MALAM_NOW],
    ["dark", "siang", SIANG_NOW],
    ["dark", "malam", MALAM_NOW],
  ] as const;

  it.each(combos)("%s %s: the selected cell is forest on cream-ink, the others the surface, all text at 4.5:1", async (scheme, mood, now) => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    await render(
      <ThemeProvider storageKey="t.theme">
        <MoodProvider now={now}>
          <MobileProvider runtime={runtime} linkMapper={(h) => h}>
            <TodayScreen />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    const ink = nativeMood[scheme][mood];
    const theme = nativeThemes[scheme];
    expect(flat(screen.getByTestId("week-day-2026-10-08-fill")).backgroundColor).toBe(ink.toggleActive);
    for (const part of ["number", "count"]) {
      expect(flat(screen.getByTestId(`week-day-2026-10-08-${part}`)).color).toBe(ink.onToggleActive);
    }
    expect(contrastRatio(ink.onToggleActive, ink.toggleActive)).toBeGreaterThanOrEqual(4.5);
    const idle = cell("2026-10-09");
    expect(flat(idle).backgroundColor).toBe(ink.hero);
    expect(ink.hero).toBe(theme.surface);
    expect(flat(screen.getByTestId("week-day-2026-10-09-number")).color).toBe(ink.heroText);
    expect(flat(screen.getByTestId("week-day-2026-10-09-count")).color).toBe(ink.heroMeta);
    expect(contrastRatio(ink.heroText, ink.hero)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.heroMeta, ink.hero)).toBeGreaterThanOrEqual(4.5);
    // A past day's frame is transparent on the header, so its ink reads against the header.
    expect(contrastRatio(ink.heroMeta, ink.header)).toBeGreaterThanOrEqual(4.5);
    // The idle cell's edge reads against the header it sits on.
    expect(flat(idle).borderColor).toBe(ink.markerIdle);
    expect(contrastRatio(ink.markerIdle, ink.header)).toBeGreaterThanOrEqual(3);
    // The weekday names read against the header.
    expect(contrastRatio(ink.headerMeta, ink.header)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("closing and picking", () => {
  /** How many times the month was folded (0 over the content duration) so far; other motions share that duration. */
  const folds = (spy: jest.SpyInstance) =>
    spy.mock.calls.filter((c) => c[0] === 0 && (c[1] as { duration: number }).duration === 320).length;

  it("closing after browsing to another month shows the selected week at once, without folding the wrong row", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    await tapHandle();
    expect(dayTabs().map((t) => t.props.testID)).toEqual(WEEK.map((d) => `week-day-${d}`));
  });

  it("closing without browsing away folds over the content duration", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    const spy = jest.spyOn(Reanimated, "withTiming");
    const before = folds(spy);
    await tapHandle();
    expect(folds(spy)).toBe(before + 1);
  });

  it("folds a picked neighbour-month day over its own week, in the grid it was picked in", async () => {
    stepTimeouts();
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    const spy = jest.spyOn(Reanimated, "withTiming");
    const before = folds(spy);
    await fireEvent.press(screen.getByRole("tab", { name: /^Minggu 1 November/ }));
    await act(async () => void (await jest.advanceTimersByTimeAsync(210)));
    expect(folds(spy)).toBeGreaterThan(before);
    expect(handle().props.accessibilityState.expanded).toBe(false);
    const week = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
    expect(dayTabs().map((t) => t.props.testID)).toEqual(week.map((d) => `week-day-${d}`));
    // The grid then follows the selected day's month: the same week, nothing moves.
    await act(async () => void (await jest.advanceTimersByTimeAsync(400)));
    expect(dayTabs().map((t) => t.props.testID)).toEqual(week.map((d) => `week-day-${d}`));
  });

  it("buzzes once for a picked day: the cell's, not the fold's", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    (Haptics.selectionAsync as jest.Mock).mockClear();
    await fireEvent.press(screen.getByRole("tab", { name: /^Senin 19 Oktober/ }));
    await act(async () => void (await jest.advanceTimersByTimeAsync(400)));
    await waitFor(() => expect(dayTabs()).toHaveLength(7));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("restarts the wait for a quick second pick and folds once", async () => {
    stepTimeouts();
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("tab", { name: /^Senin 19 Oktober/ }));
    await act(async () => void (await jest.advanceTimersByTimeAsync(120)));
    await fireEvent.press(screen.getByRole("tab", { name: /^Selasa 20 Oktober/ }));
    // 240ms after the first pick: its own wait (200) would have folded the month by now.
    await act(async () => void (await jest.advanceTimersByTimeAsync(120)));
    expect(handle().props.accessibilityState.expanded).toBe(true);
    await act(async () => void (await jest.advanceTimersByTimeAsync(120)));
    expect(handle().props.accessibilityState.expanded).toBe(false);
    expect(selectedDay()).toBe("2026-10-20");
  });

  it("leaves no fold behind when the screen goes away first", async () => {
    const view = await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await openMonth();
    await fireEvent.press(screen.getByRole("tab", { name: /^Senin 19 Oktober/ }));
    await view.unmount();
    await act(async () => void (await jest.advanceTimersByTimeAsync(400)));
  });
});

describe("a Jakarta day, not a UTC day", () => {
  it("is Monday's week and Monday itself when it is already Monday in Jakarta but still Sunday in UTC", async () => {
    // 20.00 UTC on Sunday 11 Oct is 03.00 on Monday 12 Oct in Jakarta.
    jest.setSystemTime(new Date("2026-10-11T20:00:00Z"));
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(dayTabs()[0].props.testID).toBe("week-day-2026-10-12");
    expect(dayTabs()[6].props.testID).toBe("week-day-2026-10-18");
    expect(selectedDay()).toBe("2026-10-12");
    expect(screen.getByText("Senin 12 Okt")).toBeTruthy();
  });

  it("is Friday when 23.00 UTC on Thursday is already Friday in Jakarta", async () => {
    jest.setSystemTime(new Date("2026-10-08T23:00:00Z"));
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(selectedDay()).toBe("2026-10-09");
    expect(dayTabs()[0].props.testID).toBe("week-day-2026-10-05");
    expect(screen.getByText("Jumat 9 Okt")).toBeTruthy();
  });
});

describe("the selected day's ink and the title button", () => {
  it("keeps the old ink until the fill is half faded, then flips to the toggle's ink", async () => {
    stepTimeouts();
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const ink = nativeMood.light.siang;
    await fireEvent.press(cell("2026-10-10"));
    expect(flat(screen.getByTestId("week-day-2026-10-10-number")).color).toBe(ink.heroText);
    expect(flat(screen.getByTestId("week-day-2026-10-08-number")).color).toBe(ink.onToggleActive);
    await act(async () => void (await jest.advanceTimersByTimeAsync(120)));
    expect(flat(screen.getByTestId("week-day-2026-10-10-number")).color).toBe(ink.onToggleActive);
    expect(flat(screen.getByTestId("week-day-2026-10-08-number")).color).toBe(ink.heroText);
  });

  it("flips the ink at once under reduced motion", async () => {
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(true);
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await fireEvent.press(cell("2026-10-10"));
    await act(async () => undefined);
    expect(flat(screen.getByTestId("week-day-2026-10-10-number")).color).toBe(nativeMood.light.siang.onToggleActive);
  });

  it("makes the title button 48dp tall itself rather than reaching with a hit slop", async () => {
    await renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    await fireEvent.press(cell("2026-10-11"));
    const back = await screen.findByRole("button", { name: "Kembali ke hari ini" });
    expect(flat(back).minHeight).toBeGreaterThanOrEqual(48);
    expect(back.props.hitSlop).toBeUndefined();
  });
});
