import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SellerOperationsState } from "@catera/domain";
import { MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { contrastRatio, nativeMood, nativeThemes } from "@catera/design-tokens";
import { render } from "./render-dapur";
import { canvasDay, delivery } from "./fixtures";
import { TodayScreen } from "../src/today/TodayScreen";
import { weekOffset } from "../src/today/WeekStrip";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { resetSheets, SheetHost, type Opened } from "./sheet-host";
import * as offline from "../src/today/offline";

// The clock is pinned to Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
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
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));
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

function runtimeWith(calendar: Calendar | null, day: (id: string, date: string) => Promise<unknown> = async (_id, date) => dayFor(date)) {
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

/** The seven day tabs of the strip (the Siang / Malam switch is a tab pair of its own). */
const strip = () => screen.getByTestId("week-strip");
const dayTabs = () => within(strip()).getAllByRole("tab");
const cell = (offset: number) => screen.getByTestId(`week-day-${offset}`);
/** Every count line keeps its room but is unseen and unheard (queryByText would skip hidden text, so read the wrapper). */
const expectCountLinesHidden = () => {
  for (let offset = 0; offset < 7; offset += 1) {
    const line = screen.getByTestId(`week-day-${offset}-count-line`, { includeHiddenElements: true });
    expect(StyleSheet.flatten(line.props.style).opacity).toBe(0);
    expect(line.props.accessibilityElementsHidden).toBe(true);
    expect(line.props.importantForAccessibility).toBe("no-hide-descendants");
  }
};
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const selectedOffset = () => dayTabs().findIndex((t) => t.props.accessibilityState.selected);

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
});

describe("weekOffset", () => {
  it("maps a date inside the next seven days to its offset", () => {
    expect(weekOffset("2026-10-12", NOW)).toBe(4);
    expect(weekOffset("2026-10-08", NOW)).toBe(0);
    expect(weekOffset("2026-10-14", NOW)).toBe(6);
  });
  it("falls back to today for anything else", () => {
    expect(weekOffset("2026-10-20", NOW)).toBe(0);
    expect(weekOffset("2026-10-15", NOW)).toBe(0);
    expect(weekOffset("2026-10-07", NOW)).toBe(0);
    expect(weekOffset(undefined, NOW)).toBe(0);
    expect(weekOffset("not a date", NOW)).toBe(0);
  });
  it("counts in Jakarta days, not UTC days", () => {
    // 23.00 UTC on the 8th is already the 9th in Jakarta.
    expect(weekOffset("2026-10-10", new Date("2026-10-08T23:00:00Z"))).toBe(1);
  });
});

describe("the title and the meta line", () => {
  it("titles the header with the plain date: no chevron, no button", async () => {
    renderToday(runtimeWith(null));
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
    const title = screen.getByText("Kamis 8 Okt");
    expect(title.props.accessibilityRole).toBe("header");
    expect(screen.queryByRole("button", { name: /ganti hari/ })).toBeNull();
    expect(screen.UNSAFE_queryAllByType(Ionicons).some((i) => i.props.name === "chevron-down")).toBe(false);
  });

  it("says Besok for tomorrow and the weekday for the days after", async () => {
    renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    fireEvent.press(dayTabs()[1]);
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(screen.getByText("Jumat 9 Okt")).toBeTruthy();
    fireEvent.press(dayTabs()[4]);
    expect(await screen.findByText("Dapur Bu Rina · Senin")).toBeTruthy();
    expect(screen.getByText("Senin 12 Okt")).toBeTruthy();
    fireEvent.press(dayTabs()[0]);
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
  });

  it("says the weekday in English", async () => {
    const runtime = runtimeWith(null);
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    await screen.findByText("Dapur Bu Rina · Today");
    fireEvent.press(dayTabs()[4]);
    expect(await screen.findByText("Dapur Bu Rina · Monday")).toBeTruthy();
  });
});

describe("the strip", () => {
  it("draws seven equal tabs under the title, each with its weekday, day number and order count", async () => {
    renderToday(runtimeWith(ordersOn(["2026-10-09", 28], ["2026-10-11", 5])));
    const tab = await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(dayTabs()).toHaveLength(7);
    expect(tab.props.accessibilityLabel).toBe("Jumat 9 Oktober, 28 pengantaran");
    expect(within(tab).getByText("Jum")).toBeTruthy();
    expect(within(tab).getByText("9")).toBeTruthy();
    expect(within(tab).getByText("28")).toBeTruthy();
    expect(dayTabs().map((t) => t.props.accessibilityLabel)).toEqual([
      "Kamis 8 Oktober, tidak ada pengantaran",
      "Jumat 9 Oktober, 28 pengantaran",
      "Sabtu 10 Oktober, tidak ada pengantaran",
      "Minggu 11 Oktober, 5 pengantaran",
      "Senin 12 Oktober, tidak ada pengantaran",
      "Selasa 13 Oktober, tidak ada pengantaran",
      "Rabu 14 Oktober, tidak ada pengantaran",
    ]);
    // A day with no orders shows "0" (the copy glossary retires a lone en dash) and says "tidak ada pengantaran".
    expect(within(cell(0)).getByText("0")).toBeTruthy();
    expect(within(cell(0)).queryByText("–")).toBeNull();
    // Today is selected to begin with.
    expect(selectedOffset()).toBe(0);
    expect(strip().props.accessibilityRole).toBe("tablist");
  });

  it("reads the week's counts once, from today to six days on, for the mood's meal", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    renderToday(runtime);
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(weekReads(runtime)).toHaveLength(1);
    expect(weekReads(runtime)[0]).toEqual(["k-1", { from: "2026-10-08", to: "2026-10-14", meal: "lunch", status: "active" }]);
  });

  it("names the counts in English", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28], ["2026-10-11", 1]));
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByRole("tab", { name: "Friday 9 October, 28 deliveries" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sunday 11 October, 1 delivery" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Thursday 8 October, no deliveries" })).toBeTruthy();
    expect(within(cell(1)).getByText("Fri")).toBeTruthy();
  });

  it("selecting a day reads that day, shows it read-only, and offers no Mulai masak", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    renderToday(runtime);
    expect(await screen.findByText("Mulai masak")).toBeTruthy();
    fireEvent.press(await screen.findByRole("tab", { name: /28 pengantaran/ }));
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-09"));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(selectedOffset()).toBe(1);
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Mulai masak")).toBeNull());
    expect(screen.queryByTestId("screen-footer")).toBeNull();
    // The week was read once; changing the day does not read it again.
    expect(weekReads(runtime)).toHaveLength(1);
  });

  it("keeps seven tabs, without count lines, while the week is still loading", async () => {
    renderToday(runtimeWith(() => new Promise<never>(() => {})));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    expect(dayTabs()).toHaveLength(7);
    expectCountLinesHidden();
    expect(dayTabs()[1].props.accessibilityLabel).toMatch(/^Jumat 9 Oktober/);
  });

  it("keeps seven tabs, without count lines or an error banner, when the week cannot be read", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderToday(runtime);
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
    const pending = renderToday(runtimeWith(() => new Promise<never>(() => {})));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    const waiting = flat(cell(1)).minHeight;
    pending.unmount();
    renderToday(runtimeWith(ordersOn(["2026-10-09", 28])));
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(flat(cell(1)).minHeight).toBe(waiting);
    expect(waiting as number).toBeGreaterThanOrEqual(48);
  });

  it("switching Siang / Malam reads the other meal's counts and keeps the selected day", async () => {
    const runtime = runtimeWith(async (_id, params) =>
      params.meal === "dinner"
        ? { days: [{ date: "2026-10-12", orders: 9, lunch: false, dinner: true }] }
        : { days: [{ date: "2026-10-12", orders: 28, lunch: true, dinner: false }] },
    );
    renderToday(runtime);
    fireEvent.press(await screen.findByRole("tab", { name: /Senin 12 Oktober, 28 pengantaran/ }));
    await screen.findByText("Dapur Bu Rina · Senin");
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    await waitFor(() =>
      expect(runtime.api.sellerCalendar).toHaveBeenLastCalledWith("k-1", { from: "2026-10-08", to: "2026-10-14", meal: "dinner", status: "active" }),
    );
    expect(await screen.findByRole("tab", { name: /Senin 12 Oktober, 9 pengantaran/ })).toBeTruthy();
    expect(selectedOffset()).toBe(4);
    expect(screen.getByText("Dapur Bu Rina · Senin")).toBeTruthy();
  });

  it("a pull to refresh reads the week again", async () => {
    const runtime = runtimeWith(ordersOn(["2026-10-09", 28]));
    renderToday(runtime);
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(weekReads(runtime)).toHaveLength(1);
    await act(async () => void (await screen.UNSAFE_getByType(RefreshControl).props.onRefresh()));
    expect(weekReads(runtime)).toHaveLength(2);
  });

  it("gives a select haptic on a change of day, and none for the day already selected", async () => {
    renderToday(runtimeWith(null));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    (Haptics.selectionAsync as jest.Mock).mockClear();
    fireEvent.press(dayTabs()[0]);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    fireEvent.press(dayTabs()[2]);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(selectedOffset()).toBe(2);
  });
});

describe("a future day is read-only", () => {
  it("shows the checklist and order without Pilih, a proof-photo note or a footer, on a day three ahead", async () => {
    renderToday(runtimeWith(null, async (_id, date) => dayFor(date, "preparing")));
    // Today, for contrast: the order offers Pilih and the proof-photo note, and the footer has the action.
    expect(await screen.findByRole("button", { name: "Pilih" })).toBeTruthy();
    expect(screen.getByText(/foto bukti/i)).toBeTruthy();
    expect(await screen.findByText(/^Berangkat antar/)).toBeTruthy();
    fireEvent.press(dayTabs()[3]);
    await screen.findByText("Dapur Bu Rina · Minggu");
    await waitFor(() => expect(screen.queryByText(/^Berangkat antar/)).toBeNull());
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
    expect(screen.queryByText(/foto bukti/i)).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });

  it("keeps Pindah tanggal in the stop's menu where the day can move, as Besok does", async () => {
    renderToday(runtimeWith(null));
    await screen.findByText("Mulai masak");
    fireEvent.press(dayTabs()[3]);
    await screen.findByText("Dapur Bu Rina · Minggu");
    // Bu Sari can still move (record and cutoff ahead); Keluarga Hartono and the fixed-date package cannot, so no button.
    const menu = await within(await screen.findByTestId("stop-1")).findByLabelText(/^Pindah tanggal/);
    expect(within(screen.getByTestId("stop-3")).queryByLabelText(/^(Laporkan masalah|Pindah tanggal)/)).toBeNull();
    fireEvent.press(menu);
    expect(await screen.findByRole("button", { name: "Pindah tanggal" })).toBeTruthy();
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
    renderToday(runtime);
    expect(await screen.findByText("Ada pembayaran yang perlu dicek")).toBeTruthy();
    fireEvent.press(dayTabs()[2]);
    await screen.findByText("Dapur Bu Rina · Sabtu");
    expect(screen.queryByText("Ada pembayaran yang perlu dicek")).toBeNull();
    fireEvent.press(dayTabs()[0]);
    expect(await screen.findByText("Ada pembayaran yang perlu dicek")).toBeTruthy();
  });

  it("words the empty state for a later day with its weekday", async () => {
    renderToday(runtimeWith(null, async (_id, date) => ({ ...dayFor(date), deliveries: [], customers: [] })));
    await screen.findByText("Tidak ada yang dimasak hari ini.");
    fireEvent.press(dayTabs()[1]);
    expect(await screen.findByText("Tidak ada yang dimasak besok.")).toBeTruthy();
    fireEvent.press(dayTabs()[4]);
    expect(await screen.findByText("Tidak ada yang dimasak hari Senin.")).toBeTruthy();
  });
});

describe("Semua beres and notifications", () => {
  it("Lihat besok selects the tab for tomorrow", async () => {
    const done = (date: string) => {
      const d = dayFor(date);
      d.deliveries = d.deliveries.map((x) => ({ ...x, status: "delivered", meals: [{ meal: "lunch", status: "delivered" }] }) as typeof x);
      return date === "2026-10-08" ? d : dayFor(date);
    };
    renderToday(runtimeWith(null, async (_id, date) => done(date)));
    fireEvent.press(await screen.findByRole("button", { name: "Lihat besok" }));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(selectedOffset()).toBe(1);
  });

  it("opens on the day a notification points to, up to six days ahead", async () => {
    const runtime = runtimeWith(null);
    renderToday(runtime, { date: "2026-10-12" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-12"));
    expect(await screen.findByText("Dapur Bu Rina · Senin")).toBeTruthy();
    expect(selectedOffset()).toBe(4);
  });

  it("opens on today for a date outside the week", async () => {
    const runtime = runtimeWith(null);
    renderToday(runtime, { date: "2026-10-20" });
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", "2026-10-08"));
    expect(runtime.api.sellerOperations).not.toHaveBeenCalledWith("k-1", "2026-10-20");
    expect(selectedOffset()).toBe(0);
  });

  it("follows a new notification date while the screen is open", async () => {
    const runtime = runtimeWith(null);
    const view = renderToday(runtime, { date: "2026-10-09" });
    await screen.findByText("Dapur Bu Rina · Besok");
    view.rerender(
      <MoodProvider now={SIANG_NOW}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>
            <TodayScreen date="2026-10-11" />
          </ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    );
    expect(await screen.findByText("Dapur Bu Rina · Minggu")).toBeTruthy();
    expect(selectedOffset()).toBe(3);
  });
});

describe("a narrow phone and large text", () => {
  it("shares the width equally, keeps each line to one line that shrinks to 0.85, and never scrolls sideways", async () => {
    renderToday(runtimeWith(ordersOn(["2026-10-09", 28])));
    await screen.findByRole("tab", { name: /28 pengantaran/ });
    expect(flat(strip()).flexDirection).toBe("row");
    expect(within(strip()).UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    for (let i = 0; i < 7; i += 1) {
      expect(flat(cell(i)).flex).toBe(1);
      for (const part of ["weekday", "number", "count"]) {
        const text = screen.getByTestId(`week-day-${i}-${part}`, { includeHiddenElements: true });
        expect(text.props.numberOfLines).toBe(1);
        expect(text.props.adjustsFontSizeToFit).toBe(true);
        expect(text.props.minimumFontScale).toBe(0.85);
        expect(flat(text).fontVariant).toEqual(["tabular-nums"]);
      }
    }
    // Adjacent targets keep a gap.
    expect(flat(strip()).gap).toBeGreaterThanOrEqual(4);
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
    render(
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
    const picked = cell(0);
    expect(flat(picked).backgroundColor).toBe(ink.toggleActive);
    for (const part of ["weekday", "number", "count"]) {
      expect(flat(screen.getByTestId(`week-day-0-${part}`)).color).toBe(ink.onToggleActive);
    }
    expect(contrastRatio(ink.onToggleActive, ink.toggleActive)).toBeGreaterThanOrEqual(4.5);
    const idle = cell(1);
    expect(flat(idle).backgroundColor).toBe(ink.hero);
    expect(ink.hero).toBe(theme.surface);
    expect(flat(screen.getByTestId("week-day-1-weekday")).color).toBe(ink.heroMeta);
    expect(flat(screen.getByTestId("week-day-1-number")).color).toBe(ink.heroText);
    expect(flat(screen.getByTestId("week-day-1-count")).color).toBe(ink.heroMeta);
    expect(contrastRatio(ink.heroText, ink.hero)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ink.heroMeta, ink.hero)).toBeGreaterThanOrEqual(4.5);
    // The idle cell's edge reads against the header it sits on.
    expect(flat(idle).borderColor).toBe(ink.markerIdle);
    expect(contrastRatio(ink.markerIdle, ink.header)).toBeGreaterThanOrEqual(3);
  });
});
