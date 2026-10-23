import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays, currency, upcomingDays, type CustomerActionItem, type CustomerState } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { LayoutScaleProvider, MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { goToTab } from "../src/nav";
import { Beranda } from "../src/today/Beranda";
import { ReviewRoute } from "../src/today/ReviewSheet";
import { PerluDiurus } from "../src/today/PerluDiurus";
import { UpcomingDays } from "../src/today/UpcomingDays";
import { customerLink } from "../src/links";
import { SheetHost } from "./sheetHost";
import * as offline from "../src/today/offline";
import {
  DEMO_TODAY,
  demoCustomer,
  eightPlans,
  eveningOf,
  menu,
  morningOf,
  onePlanOneMeal,
  pendingMenu,
  plan,
  planDelivery,
  quietSaturday,
} from "./fixtures";
import { goOffline, keptLine } from "./offline";

/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
/** Rows that carry an href open through openLink; its tab handling is covered in navigation.test, so here it opens the
 * path the way a push does. */
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  goToTab: jest.fn(),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useIsFocused: () => true,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
// In-memory SecureStore, so the review dismissal and the recap marks persist within a test.
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
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const light = nativeThemes.light;

type UsageMock = jest.Mock<Promise<void>, [string, string]>;

function runtimeWith(
  state: () => Promise<CustomerState>,
  actions: () => Promise<{ total: number; items: CustomerActionItem[] }> = async () => ({ total: 0, items: [] }),
): { runtime: MobileRuntime; usage: UsageMock } {
  const usage: UsageMock = jest.fn(async () => undefined);
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(state),
    customerActions: jest.fn(actions),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
    usage,
  } as unknown as MobileRuntime["api"];
  return { runtime, usage };
}

/** The demo customer's read and action feed, as the API would give them. */
const demo = () => {
  const { state, actions } = demoCustomer();
  return runtimeWith(async () => state, async () => ({ total: actions.length, items: actions }));
};

let mockParams: Record<string, string> = {};
/** The review is a sheet route (`/ulasan/{id}`): the host shows it over Beranda when the row pushes it. */
const SHEETS = { "/ulasan": ReviewRoute };
const toParams = (params: Record<string, string>) => void (mockParams = params);

function mount(
  runtime: MobileRuntime,
  { now = morningOf(DEMO_TODAY), scheme = "light" as "light" | "dark", node = <Beranda />, v2 = false } = {},
) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="beranda-sections-test">
      <LayoutScaleProvider value={v2 ? "v2" : "classic"}>
        <MoodProvider now={() => now}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            {node}
            <SheetHost routes={SHEETS} onParams={toParams} />
          </MobileProvider>
        </MoodProvider>
      </LayoutScaleProvider>
    </ThemeProvider>,
  );
}

/** The full waiting list, the pushed screen "Perlu kamu urus". */
const mountList = (runtime: MobileRuntime, options: Parameters<typeof mount>[1] = {}) =>
  mount(runtime, { ...options, node: <PerluDiurus /> });

/** Lets the reads and storage reads land inside act. */
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 10))));
const color = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never).color;
const title = () => screen.getByTestId("home-title").props.children;

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  (offline.loadCachedCustomer as jest.Mock).mockResolvedValue(null);
});

/** Pins the clock to `now`; timers, microtasks and frames keep running for real. */
function pin(now: Date) {
  jest.useFakeTimers({
    now,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
}

afterEach(() => {
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("the hero pager", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("two lunches are two equal heroes with 1 dari 2", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    mount(demo().runtime);
    const pager = await screen.findByTestId("hero-pager");
    expect(title()).toBe("Siang ini, 2 pengantaran.");
    const heroes = within(pager).getAllByTestId("plate-hero");
    expect(heroes).toHaveLength(2);
    // Equal cards: each page is the same width, and the pager snaps one card at a time.
    const pages = within(pager).getAllByTestId("hero-page");
    const widths = pages.map((p) => StyleSheet.flatten(p.props.style).width);
    expect(widths[0]).toBeGreaterThan(0);
    expect(widths[1]).toBe(widths[0]);
    const scroller = screen.getByTestId("hero-pager-scroll");
    expect(scroller.props.snapToInterval).toBe(widths[0] + 12);
    expect(scroller.props.decelerationRate).toBe("fast");
    // Window order: Dapur Senja's 11.00 lunch first, Dapur Contoh's 12.00 second.
    expect(within(heroes[0]).getByText("Makan siang · Dapur Senja")).toBeTruthy();
    expect(within(heroes[1]).getByText("Makan siang · Dapur Contoh")).toBeTruthy();

    // Dots and the counter: the active dot is 20 wide, the other 8; the counter is tabular.
    const counter = screen.getByText("1 dari 2");
    expect(StyleSheet.flatten(counter.props.style).fontVariant).toContain("tabular-nums");
    const dots = screen.getAllByTestId(/^hero-dot-/, { includeHiddenElements: true });
    expect(dots.map((d) => StyleSheet.flatten(d.props.style).width)).toEqual([20, 8]);
    expect(StyleSheet.flatten(dots[0].props.style).backgroundColor).toBe(light.forest);

    // TalkBack: one adjustable control moves the pager. The meal names it and the position with the card's kitchen is
    // its value, which the platform speaks after each move, so "1 dari 2" is never in the label as well, and nothing
    // is announced on top.
    const control = screen.getByRole("adjustable");
    expect(control.props.accessibilityLabel).toBe("Makan siang");
    expect(control.props.accessibilityValue).toEqual({ text: "1 dari 2, Dapur Senja" });
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByRole("adjustable").props.accessibilityLabel).toBe("Makan siang");
    expect(screen.getByRole("adjustable").props.accessibilityValue).toEqual({ text: "2 dari 2, Dapur Contoh" });
    expect(screen.getByText("2 dari 2")).toBeTruthy();
    expect(announce).not.toHaveBeenCalled();
    fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(screen.getByRole("adjustable").props.accessibilityValue).toEqual({ text: "1 dari 2, Dapur Senja" });
    fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });

    // A swipe back to the first card moves the counter with it.
    fireEvent.scroll(scroller, {
      nativeEvent: { contentOffset: { x: 0, y: 0 }, contentSize: { width: 1000, height: 300 }, layoutMeasurement: { width: 400, height: 300 } },
    });
    fireEvent(scroller, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(screen.getByText("1 dari 2")).toBeTruthy();
    fireEvent(scroller, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: widths[0] + 12, y: 0 } } });
    expect(screen.getByText("2 dari 2")).toBeTruthy();
  });

  it("each page keeps its own content height: nothing stretches or grows a card to the tallest page", async () => {
    mount(demo().runtime);
    const pager = await screen.findByTestId("hero-pager");
    // Top-aligned pages in the scroll's content, so a shorter card is not stretched.
    const content = StyleSheet.flatten(screen.getByTestId("hero-pager-scroll").props.contentContainerStyle);
    expect(content.alignItems).toBe("flex-start");
    for (const page of within(pager).getAllByTestId("hero-page")) {
      expect(StyleSheet.flatten(page.props.style).alignSelf).toBe("flex-start");
      expect(StyleSheet.flatten(page.props.style).flexGrow).toBeUndefined();
    }
    // And the card inside has no flexGrow to fill a page taller than its content.
    for (const hero of within(pager).getAllByTestId("plate-hero")) {
      const style = StyleSheet.flatten(hero.props.style);
      expect(style.flexGrow).toBeUndefined();
      expect(style.flex).toBeUndefined();
    }
  });

  it("the pager's value reads in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    mount(demo().runtime);
    await screen.findByTestId("hero-pager");
    const control = screen.getByRole("adjustable");
    expect(control.props.accessibilityLabel).toBe("Lunch");
    expect(control.props.accessibilityValue).toEqual({ text: "1 of 2, Dapur Senja" });
    expect(screen.getByText("1 of 2")).toBeTruthy();
  });

  it("one plan with one meal keeps today's single hero, with no counter", async () => {
    const { runtime } = runtimeWith(async () => onePlanOneMeal());
    mount(runtime);
    expect(await screen.findByTestId("plate-hero")).toBeTruthy();
    expect(screen.queryByTestId("hero-pager")).toBeNull();
    expect(screen.queryByText(/dari \d/)).toBeNull();
    expect(screen.queryByRole("adjustable")).toBeNull();
    expect(title()).toBe("Makan siang terjadwal.");
  });

  it("counts journey_viewed for the card in view only, and for the next one once swiped to", async () => {
    const { state } = demoCustomer();
    // Both lunches are cooking, with ids no other test uses (the count is once per process).
    for (const d of state.deliveries.filter((x) => x.service_date === DEMO_TODAY && x.offer.meal === "lunch")) {
      d.id = `${d.id}-count`;
      d.meals = [{ meal: "lunch", status: "preparing", cooking_started_at: `${DEMO_TODAY}T01:10:00Z` }];
    }
    const { runtime, usage } = runtimeWith(async () => state);
    mount(runtime);
    await screen.findByTestId("hero-pager");
    const viewed = () => usage.mock.calls.filter(([name]) => name === "journey_viewed");
    await waitFor(() => expect(viewed()).toHaveLength(1));
    await settle();
    expect(viewed()).toHaveLength(1);
    fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    await waitFor(() => expect(viewed()).toHaveLength(2));
    fireEvent(screen.getByRole("adjustable"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    await settle();
    expect(viewed()).toHaveLength(2);
  });

  it.each([
    ["light", "siang"],
    ["light", "malam"],
    ["dark", "siang"],
    ["dark", "malam"],
  ] as const)("draws the dots from the theme in %s %s", async (scheme, mood) => {
    const { state, actions } = demoCustomer();
    // Two dinners on the Malam captures, so the pager shows in both moods.
    if (mood === "malam") {
      const second = plan("s-malam-2", { name: "Makan Malam Rumahan", caterer: "Dapur Contoh", meal: "dinner", today: DEMO_TODAY });
      state.subscriptions.push(second);
      state.deliveries.push(planDelivery(second, DEMO_TODAY));
    }
    const { runtime } = runtimeWith(async () => state, async () => ({ total: actions.length, items: actions }));
    mount(runtime, { scheme, now: mood === "siang" ? morningOf(DEMO_TODAY) : eveningOf(DEMO_TODAY) });
    await screen.findByTestId("hero-pager");
    const palette = nativeThemes[scheme];
    const dots = screen.getAllByTestId(/^hero-dot-/, { includeHiddenElements: true });
    expect(StyleSheet.flatten(dots[0].props.style).backgroundColor).toBe(palette.forest);
    expect(StyleSheet.flatten(dots[1].props.style).backgroundColor).toBe(palette.secondaryBorder);
    expect(color(screen.getByText("1 dari 2"))).toBe(palette.charcoal);
  });
});

describe("the other meal's stop", () => {
  it("counts the other meal's deliveries and a tap switches to it", async () => {
    // The morning clock keeps both lunches still to come; the mood is Malam, so one dinner is the hero.
    pin(morningOf(DEMO_TODAY));
    mount(demo().runtime, { now: eveningOf(DEMO_TODAY) });
    await screen.findByTestId("plate-hero");
    expect(screen.queryByTestId("hero-pager")).toBeNull();
    expect(screen.queryByTestId("other-meal-row")).toBeNull();
    const stop = within(screen.getByTestId("status-stop-lunch"));
    expect(stop.getByText("Siang")).toBeTruthy();
    expect(stop.getByText("2 pengantaran")).toBeTruthy();
    // A tap switches to Siang, where both lunches are the pager and the dinner is the other stop.
    fireEvent.press(screen.getByTestId("status-stop-lunch"));
    expect(await screen.findByTestId("hero-pager")).toBeTruthy();
    expect(within(screen.getByTestId("status-stop-dinner")).getByText("Malam 17.00–19.00")).toBeTruthy();
    expect(within(screen.getByTestId("status-stop-dinner")).getByText("Sate ayam madura")).toBeTruthy();
    // One status line serves the pager, on the band.
    expect(within(screen.getByTestId("mood-header")).getByTestId("status-stops")).toBeTruthy();
    expect(screen.getAllByTestId("status-stops")).toHaveLength(1);
    expect(within(screen.getByTestId("hero-pager")).queryByTestId("status-stops")).toBeNull();
  });

  it("says the lunches should have arrived once their window is past, in place of the count", async () => {
    pin(eveningOf(DEMO_TODAY));
    mount(demo().runtime, { now: eveningOf(DEMO_TODAY) });
    await screen.findByTestId("plate-hero");
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Belum sampai")).toBeTruthy();
  });

  /** One lunch (Rumahan, whose menu starts with rice) and one dinner, seen in the evening. */
  function riceFirst(lunchMenu = menu("lunch", ["Nasi putih", { name: "Rendang sapi", categoryId: "main" }, "Sayur asem"])) {
    const lunch = plan("s-rumahan", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", today: DEMO_TODAY, menus: [lunchMenu] });
    const dinner = plan("s-malam", { name: "Makan Malam Hemat", caterer: "Dapur Bulan", meal: "dinner", today: DEMO_TODAY });
    return {
      subscriptions: [lunch, dinner],
      deliveries: [planDelivery(lunch, DEMO_TODAY), planDelivery(dinner, DEMO_TODAY)],
      addresses: [],
      notifications: [],
      cases: [],
    } as CustomerState;
  }

  it("names the main dish, not the first item on the menu", async () => {
    pin(morningOf(DEMO_TODAY));
    const { runtime } = runtimeWith(async () => riceFirst());
    mount(runtime, { now: eveningOf(DEMO_TODAY) });
    const row = within(await screen.findByTestId("status-stop-lunch"));
    expect(row.getByText("Rendang sapi")).toBeTruthy();
    expect(row.queryByText("Nasi putih")).toBeNull();
  });

  it("names the package, never a dish, while the menu is not set", async () => {
    pin(morningOf(DEMO_TODAY));
    const { runtime } = runtimeWith(async () => riceFirst(pendingMenu("lunch")));
    mount(runtime, { now: eveningOf(DEMO_TODAY) });
    const row = within(await screen.findByTestId("status-stop-lunch"));
    expect(row.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(row.queryByText(/Nasi|Rendang/)).toBeNull();
  });
});

describe("Perlu kamu urus (the full list)", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("waiting rows are one list with a single sunrise action", async () => {
    const { runtime, usage } = demo();
    mountList(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(within(screen.getByTestId("screen-native-title")).getByText("Perlu kamu urus")).toBeTruthy();
    // The review row appears once its dismissal mark has been read.
    await list.findByText("Bagaimana Dapur Hijau selama ini?");
    const rows = list.getAllByTestId("waiting-row");
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      "Pilih menu Selasa 13 Okt, Makan Siang Kantor · sebelum Senin 17.00, Pilih",
      "Pilih menu Rabu dan Kamis, Makan Siang Rumahan · sebelum Selasa 17.00, Pilih",
      "Pilih menu 3 hari, Makan Malam Hemat · sebelum Kamis 17.00, Pilih",
      `Paket Sehat, sisa 2 hari, Dapur Hijau · harga terakhir ${currency(30000, "id")} per porsi, Perpanjang`,
      "Coba Nasi Bakar selesai hari ini, Dapur Arang · paket coba, Beli paket",
      "Coba Bento selesai besok, Dapur Kecil · paket coba, Beli paket",
      "Bagaimana Dapur Hijau selama ini?, Bintang saja cukup, ulasan tertulis boleh dilewati, Nilai",
    ]);
    // One action word per row; only Perpanjang is charcoal (the urgent one), the rest forest.
    const actions = list.getAllByTestId("waiting-action");
    expect(actions.map((a) => a.props.children)).toEqual([
      "Pilih", "Pilih", "Pilih", "Perpanjang", "Beli paket", "Beli paket", "Nilai",
    ]);
    expect(actions.filter((a) => color(a) === light.charcoal).map((a) => a.props.children)).toEqual(["Perpanjang"]);
    expect(actions.filter((a) => color(a) === light.forest)).toHaveLength(6);
    // Rows are 72 (the layout scale), separated by hairlines inset to the text, in one card that separates from the
    // canvas by tone: no border, no shadow.
    for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(72);
    const card = StyleSheet.flatten(within(screen.getByTestId("waiting-list")).getByTestId("list-card").props.style);
    expect(card).toMatchObject({ borderRadius: 16, backgroundColor: light.surface, paddingHorizontal: 15 });
    expect(card).toMatchObject({ borderWidth: 1, borderColor: light.cardBorder, boxShadow: light.cardShadow });
    expect(within(screen.getByTestId("waiting-list")).getAllByTestId("list-card-separator")).toHaveLength(6);
    // Titles wrap at large text: none is held to one line.
    for (const t of list.getAllByTestId("waiting-title")) expect(t.props.numberOfLines).toBeUndefined();

    fireEvent.press(rows[0]);
    expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-kantor?date=2026-10-13&meal=lunch");
    fireEvent.press(rows[3]);
    expect(router.push).toHaveBeenLastCalledWith("/renew/s-sehat");
    await waitFor(() => expect(usage.mock.calls.filter(([n]) => n === "renew_started")).toHaveLength(1));
    fireEvent.press(rows[4]);
    expect(router.push).toHaveBeenLastCalledWith("/paket/p-s-coba-1?title=Coba%20Nasi%20Bakar");
  });

  it("stacks the action under the text at 360dp and font scale 1.3, so a package name wraps whole words", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    mountList(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    for (const row of list.getAllByTestId("waiting-row")) {
      const text = within(row).getByTestId("waiting-text");
      expect(within(text).getByTestId("waiting-action")).toBeTruthy();
    }
  });

  it("keeps the action beside the text on a 360dp phone at the default text size", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    mountList(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    for (const row of list.getAllByTestId("waiting-row"))
      expect(within(within(row).getByTestId("waiting-text")).queryByTestId("waiting-action")).toBeNull();
  });

  it("the renewal row calls its price the last price, never the renewal's", async () => {
    mountList(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    // The snapshot price is what the last plan cost; the server quotes the renewal at today's price.
    const detail = list.getByText(`Dapur Hijau · harga terakhir ${currency(30000, "id")} per porsi`);
    expect(StyleSheet.flatten(detail.props.style).fontVariant).toContain("tabular-nums");
    expect(list.queryByText(`Dapur Hijau · ${currency(30000, "id")} per porsi`)).toBeNull();
  });

  it("each kind of row carries its own icon: the trial takes the packages bag, not the renewal's arrow", async () => {
    mountList(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    await list.findByText("Bagaimana Dapur Hijau selama ini?");
    const icons = list.getAllByTestId("waiting-row").map((row) => within(row).UNSAFE_getByType(Ionicons).props.name);
    expect(icons).toEqual([
      "reorder-three-outline",
      "reorder-three-outline",
      "reorder-three-outline",
      "refresh-outline",
      "bag-handle-outline",
      "bag-handle-outline",
      "star-outline",
    ]);
  });

  it("a menu row opens its soonest day, whatever order the action feed lists it in", async () => {
    const { state, actions } = demoCustomer();
    const reversed = [...actions].reverse();
    mountList(runtimeWith(async () => state, async () => ({ total: reversed.length, items: reversed })).runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    const rumahan = list.getByRole("button", { name: /^Pilih menu Rabu dan Kamis/ });
    fireEvent.press(rumahan);
    expect(router.push).toHaveBeenLastCalledWith(
      `/pilih-menu/s-rumahan?date=${addDays(DEMO_TODAY, 4)}&meal=lunch`,
    );
    fireEvent.press(list.getByRole("button", { name: /^Pilih menu 3 hari/ }));
    expect(router.push).toHaveBeenLastCalledWith(`/pilih-menu/s-malam?date=${addDays(DEMO_TODAY, 6)}&meal=dinner`);
  });

  it("reads in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    mountList(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    await list.findByText("How has Dapur Hijau been so far?");
    expect(list.getAllByTestId("waiting-row").map((r) => r.props.accessibilityLabel)).toEqual([
      "Choose the menu for Tue 13 Oct, Makan Siang Kantor · before Mon 17.00, Choose",
      "Choose menus for Wednesday and Thursday, Makan Siang Rumahan · before Tue 17.00, Choose",
      "Choose menus for 3 days, Makan Malam Hemat · before Thu 17.00, Choose",
      `Paket Sehat, 2 days left, Dapur Hijau · last price ${currency(30000, "en")} per portion, Renew`,
      "Coba Nasi Bakar ends today, Dapur Arang · trial, Buy package",
      "Coba Bento ends tomorrow, Dapur Kecil · trial, Buy package",
      "How has Dapur Hijau been so far?, Stars are enough; words are optional, Rate",
    ]);
    expect(within(screen.getByTestId("screen-native-title")).getByText("Needs you")).toBeTruthy();
  });

  it("nothing waiting says so instead of leaving the screen blank", async () => {
    const { runtime } = runtimeWith(async () => onePlanOneMeal());
    mountList(runtime);
    expect(await screen.findByText("Tidak ada yang perlu kamu urus sekarang.")).toBeTruthy();
    expect(screen.queryByTestId("waiting-list")).toBeNull();
  });

  it("loading shows the list's own skeleton, then the rows", async () => {
    let release: (state: CustomerState) => void = () => undefined;
    const { runtime } = runtimeWith(() => new Promise<CustomerState>((resolve) => (release = resolve)));
    mountList(runtime);
    expect(await screen.findByTestId("waiting-skeleton")).toBeTruthy();
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    expect(screen.getAllByTestId("waiting-skeleton-row")).toHaveLength(3);
    expect(within(screen.getByTestId("screen-native-title")).getByText("Perlu kamu urus")).toBeTruthy();
    await act(async () => release(demoCustomer().state));
    expect(await screen.findByTestId("waiting-list")).toBeTruthy();
    expect(screen.queryByTestId("waiting-skeleton")).toBeNull();
  });

  it("a failed read with nothing kept is the page, with Coba lagi", async () => {
    let fail = true;
    const { runtime } = runtimeWith(async () => {
      if (fail) throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
      return demoCustomer().state;
    });
    mountList(runtime);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    fail = false;
    fireEvent.press(retry);
    expect(await screen.findByTestId("waiting-list")).toBeTruthy();
  });

  it("signed out asks to sign in first", async () => {
    const { runtime } = runtimeWith(async () => demoCustomer().state);
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    mountList(runtime);
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
  });

  it("offline hides menu rows", async () => {
    const { state, actions } = demoCustomer();
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({ savedAt: `${DEMO_TODAY}T01:12:00.000Z`, data: state });
    const { runtime } = runtimeWith(
      async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      },
      async () => ({ total: actions.length, items: actions }),
    );
    goOffline();
    mountList(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(await screen.findByText(keptLine(`${DEMO_TODAY}T01:12:00.000Z`))).toBeTruthy();
    expect(list.queryByText(/^Pilih menu/)).toBeNull();
    expect(list.getByText("Paket Sehat, sisa 2 hari")).toBeTruthy();
    // A review cannot be sent from the saved copy.
    await settle();
    expect(list.queryByText(/selama ini/)).toBeNull();
  });

  it("keeps the other rows when the action feed fails", async () => {
    const { state } = demoCustomer();
    const { runtime } = runtimeWith(
      async () => state,
      async () => {
        throw new Error("REQUEST_TIMEOUT");
      },
    );
    mountList(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(await list.findByText("Bagaimana Dapur Hijau selama ini?")).toBeTruthy();
    expect(list.queryByText(/^Pilih menu/)).toBeNull();
    expect(list.getByText("Paket Sehat, sisa 2 hari")).toBeTruthy();
  });

  it("review opens its form in a sheet", async () => {
    const { runtime } = demo();
    mountList(runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    // A native form sheet over Beranda (`/ulasan/{id}`), not a sheet inside the list.
    expect(router.push).toHaveBeenCalledWith("/ulasan/s-sehat");
    const sheet = within(await screen.findByTestId("review-sheet"));
    fireEvent.press(sheet.getByRole("button", { name: "4 bintang" }));
    expect(sheet.getByRole("button", { name: "4 bintang" }).props.accessibilityState.selected).toBe(true);
    expect(sheet.getByRole("button", { name: "5 bintang" }).props.accessibilityState.selected).toBe(false);
    fireEvent.changeText(sheet.getByLabelText("Cerita singkat (opsional)"), "Enak dan tepat waktu");
    // "Kirim ulasan" is pinned under the form, outside the scrolling content.
    fireEvent.press(screen.getByRole("button", { name: "Kirim ulasan" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "review.save",
        { subscriptionId: "s-sehat", rating: 4, food: 4, delivery: 4, value: 4, body: "Enak dan tepat waktu" },
        expect.any(String),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Hijau selama ini?")).toBeNull());
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-sehat", "done");
  });

  it("Nanti saja in the sheet hides the review row for good", async () => {
    mountList(demo().runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    await screen.findByTestId("review-sheet");
    fireEvent.press(screen.getByRole("button", { name: "Nanti saja" }));
    await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Hijau selama ini?")).toBeNull());
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-sehat", "dismissed");
  });

  it("a review error stays in the sheet", async () => {
    const { runtime } = demo();
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("NOPE"), { code: "NOPE" }));
    mountList(runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    await screen.findByTestId("review-sheet");
    fireEvent.press(screen.getByRole("button", { name: "5 bintang" }));
    fireEvent.press(screen.getByRole("button", { name: "Kirim ulasan" }));
    expect(await screen.findByText("Ulasannya belum terkirim. Coba lagi.")).toBeTruthy();
    // The stars stay as they were, so trying again is one tap.
    expect(screen.getByRole("button", { name: "5 bintang" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText("Bagaimana Dapur Hijau selama ini?")).toBeTruthy();
  });
});

/** Beranda's lower part is drawn on the layout scale the customer app mounts at its root. */
const v2 = { v2: true };

/** One state with nothing waiting: a plan of `remaining` days and a lunch today, so a hero leads the page. */
function quietPlan(remaining = 8): CustomerState {
  const state = onePlanOneMeal();
  state.subscriptions[0].remaining = remaining;
  return state;
}

/** A waiting list of one: the plan to renew. */
const oneWaiting = () => quietPlan(2);

/** Five waiting items: three menus, a plan to renew and a trial ending (the demo customer without its review and a trial). */
function fiveWaiting(): { state: CustomerState; actions: CustomerActionItem[] } {
  const { state, actions } = demoCustomer();
  state.deliveries = state.deliveries.filter((d) => d.status !== "delivered");
  state.subscriptions = state.subscriptions.filter((s) => s.id !== "s-coba-2");
  return { state, actions };
}

describe("the live slot", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("shows only the first waiting item, with its own action and how many more wait", async () => {
    const { state, actions } = fiveWaiting();
    mount(runtimeWith(async () => state, async () => ({ total: actions.length, items: actions })).runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    // The order is the domain's: the soonest menu first.
    const row = slot.getByTestId("live-slot-row");
    // A screen reader hears the rest too: the link is not only a touch target.
    expect(row.props.accessibilityLabel).toBe(
      "Pilih menu Selasa 13 Okt, Makan Siang Kantor · sebelum Senin 17.00, Pilih, 4 hal lainnya",
    );
    expect(slot.getByText("Pilih menu Selasa 13 Okt")).toBeTruthy();
    expect(slot.getByTestId("waiting-action").props.children).toBe("Pilih");
    expect(slot.getByText("4 hal lainnya")).toBeTruthy();
    // Nothing else of the list stays on Beranda.
    expect(screen.queryByTestId("waiting-list")).toBeNull();
    expect(screen.queryByText(/^Pilih menu (Rabu|3 hari)/)).toBeNull();
    // A 72 row on a surface card: tone, not a border.
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(72);
    const card = StyleSheet.flatten(screen.getByTestId("live-slot").props.style);
    expect(card).toMatchObject({ borderRadius: 16, backgroundColor: light.surface });
    expect(card).toMatchObject({ borderWidth: 1, borderColor: light.cardBorder, boxShadow: light.cardShadow });
    // The existing action and its side effect.
    fireEvent.press(row);
    expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-kantor?date=2026-10-13&meal=lunch");
  });

  it("n hal lainnya opens the full list", async () => {
    const { state, actions } = fiveWaiting();
    mount(runtimeWith(async () => state, async () => ({ total: actions.length, items: actions })).runtime, v2);
    const link = await screen.findByTestId("live-slot-more");
    // Its own 44 target, a sibling of the row (not inside it), so a touch near it cannot run the row's action.
    expect(StyleSheet.flatten(link.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(within(screen.getByTestId("live-slot-row")).queryByTestId("live-slot-more")).toBeNull();
    fireEvent.press(link);
    expect(router.push).toHaveBeenLastCalledWith("/perlu-diurus");
    // The row's own action did not run with it.
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalledWith(expect.stringContaining("/pilih-menu"));
    // And the row's own press does not open the list.
    fireEvent.press(screen.getByTestId("live-slot-row"));
    expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-kantor?date=2026-10-13&meal=lunch");
    expect(router.push).toHaveBeenCalledTimes(2);
    // TalkBack reaches the same link as an action on the row.
    const row = screen.getByTestId("live-slot-row");
    expect(row.props.accessibilityActions).toEqual([{ name: "more", label: "4 hal lainnya" }]);
    fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "more" } });
    expect(router.push).toHaveBeenCalledTimes(3);
    expect(router.push).toHaveBeenLastCalledWith("/perlu-diurus");
  });

  it("one waiting item has no n hal lainnya, and its action keeps its side effect", async () => {
    const { runtime, usage } = runtimeWith(async () => oneWaiting());
    mount(runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    expect(slot.getByText("Makan Siang Rumahan, sisa 2 hari")).toBeTruthy();
    expect(slot.queryByText(/hal lainnya/)).toBeNull();
    expect(slot.queryByTestId("live-slot-more")).toBeNull();
    expect(screen.getByTestId("live-slot-row").props.accessibilityActions).toBeUndefined();
    // Only the renewal is charcoal; it is the urgent one.
    expect(color(slot.getByTestId("waiting-action"))).toBe(light.charcoal);
    fireEvent.press(slot.getByTestId("live-slot-row"));
    expect(router.push).toHaveBeenLastCalledWith("/renew/s-1");
    await waitFor(() => expect(usage.mock.calls.filter(([n]) => n === "renew_started")).toHaveLength(1));
  });

  it("nothing waiting hides the slot", async () => {
    mount(runtimeWith(async () => quietPlan()).runtime, v2);
    await screen.findByTestId("plate-hero");
    await settle();
    expect(screen.queryByTestId("live-slot")).toBeNull();
    expect(screen.queryByText(/hal lainnya/)).toBeNull();
  });

  it("keeps a 32 section gap after the hero and before the next block", async () => {
    const { runtime } = runtimeWith(async () => oneWaiting());
    mount(runtime, v2);
    // The page body gaps blocks by 16; the slot adds 16 more.
    expect(StyleSheet.flatten((await screen.findByTestId("live-slot")).props.style).marginTop).toBe(16);
  });

  it("a review is the slot only when it is first; until its mark is read it is not counted", async () => {
    const state = quietPlan(2);
    state.deliveries.push({ ...state.deliveries[0], id: "d-done", service_date: "2026-10-09", status: "delivered" });
    mount(runtimeWith(async () => state).runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    // The renewal leads; once the mark is read the review row is the one more.
    expect(await slot.findByText("1 hal lainnya")).toBeTruthy();
    fireEvent.press(slot.getByText("1 hal lainnya"));
    expect(router.push).toHaveBeenLastCalledWith("/perlu-diurus");
  });

  it("offline hides menu rows from the slot, as it does from the list", async () => {
    const { state, actions } = fiveWaiting();
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({ savedAt: `${DEMO_TODAY}T01:12:00.000Z`, data: state });
    const { runtime } = runtimeWith(
      async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      },
      async () => ({ total: actions.length, items: actions }),
    );
    goOffline();
    mount(runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    expect(slot.getByText("Paket Sehat, sisa 2 hari")).toBeTruthy();
    // The renewal, the trial: one more.
    expect(slot.getByText("1 hal lainnya")).toBeTruthy();
    expect(screen.queryByText(/^Pilih menu/)).toBeNull();
  });

  it("reads in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const { state, actions } = fiveWaiting();
    mount(runtimeWith(async () => state, async () => ({ total: actions.length, items: actions })).runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    expect(slot.getByText("4 more")).toBeTruthy();
    expect(slot.getByText("Choose the menu for Tue 13 Oct")).toBeTruthy();
  });

  it("drops the action under the text at 360dp and font scale 1.3, and lets the title grow", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    const { state, actions } = fiveWaiting();
    mount(runtimeWith(async () => state, async () => ({ total: actions.length, items: actions })).runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    expect(within(slot.getByTestId("live-slot-text")).getByTestId("waiting-action")).toBeTruthy();
    expect(slot.getByText("Pilih menu Selasa 13 Okt").props.numberOfLines).toBeUndefined();
  });

  it("keeps the action beside the text at 360dp and the default text size", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    const { state, actions } = fiveWaiting();
    mount(runtimeWith(async () => state, async () => ({ total: actions.length, items: actions })).runtime, v2);
    const slot = within(await screen.findByTestId("live-slot"));
    expect(within(slot.getByTestId("live-slot-text")).queryByTestId("waiting-action")).toBeNull();
  });
});

/** Four kitchens: two lunches (Dapur Senja's 11.00 first) and two dinners, each with one dish of its own. */
function kitchens(menus: Record<string, Parameters<typeof plan>[1]["menus"]> = {}) {
  const make = (id: string, name: string, caterer: string, meal: "lunch" | "dinner", dish: string, windows?: Record<string, string>) => {
    const sub = plan(id, { name, caterer, meal, today: DEMO_TODAY, remaining: 8, menus: menus[id] ?? [menu(meal, [dish])] });
    if (windows) sub.snapshot.offer.windows = windows as never;
    return sub;
  };
  return [
    make("s-1", "Paket Satu", "Dapur Senja", "lunch", "Ayam panggang"),
    make("s-2", "Paket Dua", "Dapur Contoh", "lunch", "Rendang sapi", { lunch: "12.00–13.30", dinner: "17.00–19.00" }),
    make("s-3", "Paket Tiga", "Dapur Bulan", "dinner", "Salmon teriyaki"),
    make("s-4", "Paket Empat", "Hijau Kitchen", "dinner", "Gado-gado", { lunch: "11.00–13.00", dinner: "18.30–20.00" }),
  ];
}

/** `counts` maps a day offset from DEMO_TODAY to how many of the four kitchens deliver that day; today has the first lunch. */
function scheduled(counts: Record<number, number>, menus: Parameters<typeof kitchens>[0] = {}): CustomerState {
  const subs = kitchens(menus);
  const deliveries = [planDelivery(subs[0], DEMO_TODAY)];
  for (const [offset, n] of Object.entries(counts))
    for (const sub of subs.slice(0, n)) deliveries.push(planDelivery(sub, addDays(DEMO_TODAY, Number(offset))));
  return { subscriptions: subs, deliveries, addresses: [], notifications: [], cases: [] };
}

const daysBlock = async () => within(await screen.findByTestId("upcoming-days"));

describe("Berikutnya", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("days with one delivery each are one card of 72 rows with a date column", async () => {
    const state = scheduled({});
    state.deliveries.push(
      ...[1, 2, 3, 4].map((o) => planDelivery(state.subscriptions[0], addDays(DEMO_TODAY, o))),
    );
    mount(runtimeWith(async () => state).runtime, v2);
    const days = await daysBlock();
    expect(days.getByText("Berikutnya")).toBeTruthy();
    // At most three days, in one list card; no day label of its own.
    expect(days.getAllByTestId("list-card")).toHaveLength(1);
    expect(days.queryByTestId("upcoming-day-label")).toBeNull();
    const rows = days.getAllByTestId(/^upcoming-row-d-.*-lunch$/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      "upcoming-row-d-s-1-2026-10-11-lunch",
      "upcoming-row-d-s-1-2026-10-12-lunch",
      "upcoming-row-d-s-1-2026-10-13-lunch",
    ]);
    for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(72);
    // Date column: the weekday over the day number, 36 wide; then the 56 thumb with the dish and its line.
    expect(within(rows[0]).getByText("Min")).toBeTruthy();
    expect(within(rows[0]).getByText("11")).toBeTruthy();
    expect(StyleSheet.flatten(within(rows[0]).getByTestId("upcoming-date").props.style).width).toBe(36);
    expect(StyleSheet.flatten(within(rows[0]).getByTestId("upcoming-row-d-s-1-2026-10-11-lunch-thumb").props.style)).toMatchObject({
      width: 56,
      height: 56,
      borderRadius: 8,
    });
    expect(within(rows[0]).getByText("Ayam panggang")).toBeTruthy();
    expect(within(rows[0]).getByText("Besok · Siang 11.00–13.00")).toBeTruthy();
    expect(within(rows[1]).getByText("Siang 11.00–13.00")).toBeTruthy();
    expect(rows[1].props.accessibilityLabel).toBe("Senin 12 Okt, Ayam panggang, Siang 11.00–13.00");
    // The rule between rows starts at the thumb, past the date column.
    expect(StyleSheet.flatten(days.getAllByTestId("list-card-separator")[0].props.style).marginLeft).toBe(48);
  });

  it("tomorrow's row opens the existing story, any other day its sheet", async () => {
    const state = scheduled({});
    state.deliveries.push(...[1, 2].map((o) => planDelivery(state.subscriptions[0], addDays(DEMO_TODAY, o))));
    mount(runtimeWith(async () => state).runtime, v2);
    const days = await daysBlock();
    fireEvent.press(days.getByTestId("upcoming-row-d-s-1-2026-10-11-lunch"));
    expect(router.push).toHaveBeenLastCalledWith("/tomorrow?part=0");
    fireEvent.press(days.getByTestId("upcoming-row-d-s-1-2026-10-12-lunch"));
    expect(router.push).toHaveBeenLastCalledWith("/hari/d-s-1-2026-10-12?title=Senin%2012%20Okt");
  });

  it("a tomorrow delivery the story does not list opens its day sheet, never story part 0", async () => {
    const state = scheduled({ 1: 2 });
    const days = upcomingDays(state, morningOf(DEMO_TODAY), 3, "id");
    // The story knows only the second delivery; the first falls back to its own sheet.
    const tomorrow = { date: addDays(DEMO_TODAY, 1), parts: [{ deliveryId: "d-s-2-2026-10-11", meal: "lunch" as const }] };
    mount(runtimeWith(async () => state).runtime, { v2: true, node: <UpcomingDays days={days} apiBase="" tomorrow={tomorrow} /> });
    const block = await daysBlock();
    fireEvent.press(block.getByTestId("upcoming-tile-d-s-1-2026-10-11-lunch"));
    expect(router.push).toHaveBeenLastCalledWith("/hari/d-s-1-2026-10-11?title=Minggu%2011%20Okt");
    fireEvent.press(block.getByTestId("upcoming-tile-d-s-2-2026-10-11-lunch"));
    expect(router.push).toHaveBeenLastCalledWith("/tomorrow?part=0");
  });

  it("Lihat jadwal goes to the Jadwal tab", async () => {
    mount(runtimeWith(async () => scheduled({ 2: 1 })).runtime, v2);
    const days = await daysBlock();
    fireEvent.press(days.getByRole("button", { name: "Lihat jadwal" }));
    expect(goToTab).toHaveBeenLastCalledWith("jadwal");
    expect(color(days.getByText("Lihat jadwal"))).toBe(light.forest);
  });

  it("a menu not set is the dashed tile and Menu belum diisi, never a dish", async () => {
    const state = scheduled({ 2: 1 }, { "s-1": [pendingMenu("lunch")] });
    mount(runtimeWith(async () => state).runtime, v2);
    const days = await daysBlock();
    const row = days.getByTestId("upcoming-row-d-s-1-2026-10-12-lunch");
    expect(within(row).getByText("Menu belum diisi")).toBeTruthy();
    expect(within(row).getByTestId("upcoming-row-d-s-1-2026-10-12-lunch-thumb-not-set")).toBeTruthy();
    expect(within(row).getByText("Siang 11.00–13.00 · Dapur Senja")).toBeTruthy();
  });

  it("a day with several deliveries is a block: two photo tiles, then how many more", async () => {
    mount(runtimeWith(async () => scheduled({ 2: 3 })).runtime, v2);
    const days = await daysBlock();
    expect(days.getByText("Senin 12 Okt")).toBeTruthy();
    expect(days.getByTestId("upcoming-day-count").props.children).toBe("3 pengantaran");
    // No list card: day blocks are tiles.
    expect(days.queryByTestId("list-card")).toBeNull();
    const tiles = days.getAllByTestId(/^upcoming-tile-d-.*-(lunch|dinner)$/);
    expect(tiles.map((t) => t.props.testID)).toEqual([
      "upcoming-tile-d-s-1-2026-10-12-lunch",
      "upcoming-tile-d-s-2-2026-10-12-lunch",
    ]);
    const photo = StyleSheet.flatten(days.getByTestId("upcoming-tile-d-s-1-2026-10-12-lunch-photo").props.style);
    expect(photo.aspectRatio).toBeCloseTo(16 / 10, 6);
    expect(photo.borderRadius).toBe(12);
    const grid = StyleSheet.flatten(days.getByTestId("upcoming-grid-2026-10-12").props.style);
    expect(grid).toMatchObject({ flexDirection: "row", gap: 12 });
    // The dish is one line of bodyStrong; under it the meal and the kitchen.
    expect(within(tiles[0]).getByText("Ayam panggang").props.numberOfLines).toBe(1);
    expect(within(tiles[0]).getByText("Siang · Dapur Senja")).toBeTruthy();
    expect(tiles[1].props.accessibilityLabel).toBe("Rendang sapi, Siang · Dapur Contoh");
    // The third delivery is one tap away; it is the dinner, one delivery, so its own sheet opens.
    const more = days.getByRole("button", { name: "+1 lagi" });
    expect(StyleSheet.flatten(more.props.style).minHeight).toBeGreaterThanOrEqual(36);
    fireEvent.press(more);
    expect(router.push).toHaveBeenLastCalledWith("/hari/d-s-3-2026-10-12?title=Senin%2012%20Okt");
    fireEvent.press(tiles[1]);
    expect(router.push).toHaveBeenLastCalledWith("/hari/d-s-2-2026-10-12?title=Senin%2012%20Okt");
  });

  it("four deliveries a day: two tiles and +2 lagi, which opens the schedule where all four are", async () => {
    mount(runtimeWith(async () => scheduled({ 2: 4 })).runtime, v2);
    const days = await daysBlock();
    expect(days.getAllByTestId(/^upcoming-tile-.*-lunch$/)).toHaveLength(2);
    expect(days.queryByText("Salmon teriyaki")).toBeNull();
    expect(days.getByTestId("upcoming-day-count").props.children).toBe("4 pengantaran");
    fireEvent.press(days.getByRole("button", { name: "+2 lagi" }));
    expect(goToTab).toHaveBeenLastCalledWith("jadwal");
  });

  it("a day with one delivery beside a busy one keeps its block, with the empty meal said", async () => {
    mount(runtimeWith(async () => scheduled({ 2: 3, 3: 1 })).runtime, v2);
    const days = await daysBlock();
    const tuesday = within(days.getByTestId("upcoming-day-2026-10-13"));
    expect(tuesday.getByText("Selasa 13 Okt")).toBeTruthy();
    expect(tuesday.getByText("Malam tidak ada pengantaran")).toBeTruthy();
    expect(tuesday.queryByText(/lagi$/)).toBeNull();
    const none = StyleSheet.flatten(tuesday.getByTestId("upcoming-none").props.style);
    expect(none.aspectRatio).toBeCloseTo(16 / 10, 6);
    expect(none.borderRadius).toBe(12);
    expect(none.backgroundColor).toBe(light.line);
  });

  it("a lone dinner leaves the lunch slot empty before it", async () => {
    const state = scheduled({});
    state.deliveries.push(planDelivery(state.subscriptions[2], addDays(DEMO_TODAY, 2)));
    state.deliveries.push(planDelivery(state.subscriptions[0], addDays(DEMO_TODAY, 3)));
    state.deliveries.push(planDelivery(state.subscriptions[1], addDays(DEMO_TODAY, 3)));
    mount(runtimeWith(async () => state).runtime, v2);
    const monday = within((await daysBlock()).getByTestId("upcoming-day-2026-10-12"));
    const labels = monday.getAllByText(/tidak ada pengantaran$|^Malam · /);
    expect(labels.map((l) => l.props.children)).toEqual(["Siang tidak ada pengantaran", "Malam · Dapur Bulan"]);
  });

  it("a day's unpicked deliveries collapse into one row with one Pilih menu", async () => {
    const state = scheduled(
      { 2: 4 },
      { "s-1": [pendingMenu("lunch")], "s-2": [pendingMenu("lunch")], "s-3": [pendingMenu("dinner")] },
    );
    mount(runtimeWith(async () => state).runtime, v2);
    const monday = within((await daysBlock()).getByTestId("upcoming-day-2026-10-12"));
    expect(monday.getByTestId("upcoming-day-count").props.children).toBe("4 pengantaran");
    // One row for the three unpicked; no dashed tile per delivery, and nothing left behind "+n lagi".
    const rows = monday.getAllByTestId("day-unpicked-row");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("3 pengantaran belum ada menu")).toBeTruthy();
    expect(monday.queryByTestId(/-photo-not-set$/)).toBeNull();
    expect(monday.queryByText("Menu belum diisi")).toBeNull();
    expect(monday.queryByText(/lagi$/)).toBeNull();
    // The picked one keeps its photo tile.
    expect(monday.getAllByTestId(/^upcoming-tile-d-.*-(lunch|dinner)$/).map((t) => t.props.testID)).toEqual([
      "upcoming-tile-d-s-4-2026-10-12-dinner",
    ]);
    // One action, to the first unpicked delivery's menu.
    const pick = within(rows[0]).getAllByRole("button", { name: "Pilih menu" });
    expect(pick).toHaveLength(1);
    fireEvent.press(pick[0]);
    expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-1?date=2026-10-12&meal=lunch");
  });

  it("a day with nothing picked is the one row and no tiles", async () => {
    const state = scheduled({ 2: 2 }, { "s-1": [pendingMenu("lunch")], "s-2": [pendingMenu("lunch")] });
    mount(runtimeWith(async () => state).runtime, v2);
    const monday = within((await daysBlock()).getByTestId("upcoming-day-2026-10-12"));
    expect(monday.getByText("2 pengantaran belum ada menu")).toBeTruthy();
    expect(monday.queryByTestId("upcoming-grid-2026-10-12")).toBeNull();
    expect(monday.queryByTestId("upcoming-none")).toBeNull();
  });

  it("one unpicked delivery reads Menu belum dipilih", async () => {
    const state = scheduled({ 2: 2 }, { "s-2": [pendingMenu("lunch")] });
    mount(runtimeWith(async () => state).runtime, v2);
    const monday = within((await daysBlock()).getByTestId("upcoming-day-2026-10-12"));
    const row = within(monday.getByTestId("day-unpicked-row"));
    expect(row.getByText("Menu belum dipilih")).toBeTruthy();
    expect(monday.queryByText(/belum ada menu$/)).toBeNull();
    expect(monday.getByTestId("upcoming-tile-d-s-1-2026-10-12-lunch")).toBeTruthy();
    fireEvent.press(row.getByRole("button", { name: "Pilih menu" }));
    expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-2?date=2026-10-12&meal=lunch");
  });

  it("the unpicked row at 360dp and font 1.3 grows instead of clipping", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    const state = scheduled({ 2: 3 }, { "s-1": [pendingMenu("lunch")], "s-2": [pendingMenu("lunch")] });
    mount(runtimeWith(async () => state).runtime, v2);
    const row = (await daysBlock()).getByTestId("day-unpicked-row");
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(within(row).getByText("2 pengantaran belum ada menu").props.numberOfLines).toBeUndefined();
    const pick = within(row).getByRole("button", { name: "Pilih menu" });
    expect(StyleSheet.flatten(pick.props.style).minHeight).toBeGreaterThanOrEqual(44);
    // The action keeps its words on one line; the count wraps beside it.
    expect(within(pick).getByText("Pilih menu").props.numberOfLines).toBe(1);
  });

  it("the unpicked row takes its inks from the dark theme", async () => {
    const state = scheduled({ 2: 2 }, { "s-1": [pendingMenu("lunch")] });
    mount(runtimeWith(async () => state).runtime, { ...v2, scheme: "dark" });
    const row = within((await daysBlock()).getByTestId("day-unpicked-row"));
    expect(color(row.getByText("Pilih menu"))).toBe(nativeThemes.dark.forest);
    expect(StyleSheet.flatten(row.getByTestId("day-unpicked-tile").props.style).backgroundColor).toBe(nativeThemes.dark.line);
  });

  it("shows at most three days, however many have a delivery", async () => {
    mount(runtimeWith(async () => scheduled({ 2: 2, 3: 2, 4: 2, 5: 2, 6: 2 })).runtime, v2);
    const days = await daysBlock();
    expect(days.getAllByTestId("upcoming-day-label").map((n) => n.props.children)).toEqual([
      "Senin 12 Okt",
      "Selasa 13 Okt",
      "Rabu 14 Okt",
    ]);
  });

  it("tomorrow's tiles and +n lagi open the story at their own part", async () => {
    mount(runtimeWith(async () => scheduled({ 1: 4 })).runtime, v2);
    const days = await daysBlock();
    expect(days.getByText("Besok, Minggu 11 Okt")).toBeTruthy();
    fireEvent.press(days.getByTestId("upcoming-tile-d-s-2-2026-10-11-lunch"));
    expect(router.push).toHaveBeenLastCalledWith("/tomorrow?part=1");
    // The first hidden part is the third in the story's own order (lunch, lunch, dinner by window, dinner).
    fireEvent.press(days.getByRole("button", { name: "+2 lagi" }));
    expect(router.push).toHaveBeenLastCalledWith("/tomorrow?part=2");
  });

  it("is gone when nothing is coming, and the old Menu besok row never returns", async () => {
    mount(runtimeWith(async () => scheduled({})).runtime, v2);
    await screen.findByTestId("plate-hero");
    await settle();
    expect(screen.queryByTestId("upcoming-days")).toBeNull();
    expect(screen.queryByTestId("tomorrow-row")).toBeNull();
    expect(screen.queryByText("Menu besok")).toBeNull();
  });

  it("on a Saturday with nothing today, names Monday and lists it first", async () => {
    const { runtime } = runtimeWith(async () => quietSaturday());
    mount(runtime, v2);
    await screen.findByTestId("home-title");
    expect(title()).toBe("Siang ini, tidak ada pengantaran.");
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    expect(within(screen.getByTestId("mood-header")).getByText("Berikutnya Senin 12 Okt")).toBeTruthy();
    const rows = within(screen.getByTestId("upcoming-days")).getAllByTestId(/^upcoming-row-d-.*-lunch$/);
    expect(within(rows[0]).getByText("Sen")).toBeTruthy();
    expect(within(rows[0]).getByText("12")).toBeTruthy();
  });

  it("at 360dp and font scale 1.3 the tiles take a column each and the dish may wrap", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    mount(runtimeWith(async () => scheduled({ 2: 2 })).runtime, v2);
    const days = await daysBlock();
    expect(StyleSheet.flatten(days.getByTestId("upcoming-grid-2026-10-12").props.style).flexDirection).toBe("column");
    expect(days.getByText("Ayam panggang").props.numberOfLines).toBeUndefined();
  });

  it("keeps two columns at 360dp and the default text size", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    mount(runtimeWith(async () => scheduled({ 2: 2 })).runtime, v2);
    const days = await daysBlock();
    expect(StyleSheet.flatten(days.getByTestId("upcoming-grid-2026-10-12").props.style).flexDirection).toBe("row");
  });

  it("reads in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    mount(runtimeWith(async () => scheduled({ 2: 3, 3: 1 })).runtime, v2);
    const days = await daysBlock();
    expect(days.getByText("Coming up")).toBeTruthy();
    expect(days.getByText("See schedule")).toBeTruthy();
    expect(days.getByText("3 deliveries")).toBeTruthy();
    expect(days.getByText("+1 more")).toBeTruthy();
    expect(days.getByText("No dinner delivery")).toBeTruthy();
    expect(days.getAllByText("Lunch · Dapur Senja")).toHaveLength(2);
  });
});

/** The plan rows and the rail: names by soonest end. */
const planIds = (nodes: { props: { testID?: string } }[]) => nodes.map((n) => n.props.testID);

describe("Paket kamu", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("one plan is one 72 row: its photo, name and kitchen with the days left", async () => {
    mount(runtimeWith(async () => quietPlan(8)).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.getByText("Paket kamu")).toBeTruthy();
    expect(plans.queryByText("Lihat semua")).toBeNull();
    expect(plans.getAllByTestId("list-card")).toHaveLength(1);
    const row = plans.getByTestId("plan-row-s-1");
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(72);
    expect(within(row).getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(within(row).getByText("Dapur Contoh · sisa 8 hari")).toBeTruthy();
    expect(within(row).queryByTestId("plan-row-s-1-chevron")).toBeNull(); // chevron is iOS-only
    expect(StyleSheet.flatten(within(row).getByTestId("plan-row-s-1-thumb").props.style)).toMatchObject({ width: 56, height: 56 });
    fireEvent.press(row);
    expect(router.push).toHaveBeenLastCalledWith("/subscriptions/s-1?title=Makan%20Siang%20Rumahan");
  });

  it("two plans are two rows in one card, the one ending first on top", async () => {
    const state = quietPlan(8);
    const other = plan("s-2", { name: "Makan Malam Hemat", caterer: "Dapur Bulan", meal: "dinner", remaining: 2, today: DEMO_TODAY });
    state.subscriptions.push(other);
    mount(runtimeWith(async () => state).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.getAllByTestId("list-card")).toHaveLength(1);
    expect(planIds(plans.getAllByTestId(/^plan-row-s-\d$/))).toEqual(["plan-row-s-2", "plan-row-s-1"]);
    expect(plans.getByText("Dapur Bulan · selesai besok")).toBeTruthy();
    expect(plans.queryByTestId("plans-rail")).toBeNull();
  });

  /** Eight plans; two end soon, so the order is not the read's. */
  function ending() {
    const state = eightPlans();
    const by = (id: string) => state.subscriptions.find((s) => s.id === id)!;
    by("s-h").remaining = 1;
    by("s-h").ends_on = addDays(DEMO_TODAY, 1);
    by("s-g").remaining = 2;
    by("s-g").ends_on = addDays(DEMO_TODAY, 2);
    state.subscriptions.reverse();
    return state;
  }

  it("eight plans are a heading with Lihat semua over a rail of 168 cards, soonest end first", async () => {
    mount(runtimeWith(async () => ending()).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.getByText("8 paket aktif")).toBeTruthy();
    expect(plans.queryByTestId("list-card")).toBeNull();
    const cards = plans.getAllByTestId(/^plan-card-s-[a-z0-9]+$/);
    expect(planIds(cards)).toEqual([
      "plan-card-s-h",
      "plan-card-s-g",
      // The same end: by name, the twins carrying their dates.
      "plan-card-s-d",
      "plan-card-s-c",
      "plan-card-s-f",
      "plan-card-s-e",
      "plan-card-s-a",
      "plan-card-s-b",
    ]);
    for (const card of cards) expect(StyleSheet.flatten(card.props.style).width).toBe(168);
    const photo = StyleSheet.flatten(plans.getByTestId("plan-card-s-h-photo").props.style);
    expect(photo.aspectRatio).toBeCloseTo(16 / 10, 6);
    expect(photo.borderRadius).toBe(12);
    // The line: the kitchen, then when it ends.
    expect(within(cards[0]).getByText("Nasi Bakar")).toBeTruthy();
    expect(within(cards[0]).getByText("Dapur Arang · selesai besok")).toBeTruthy();
    expect(within(cards[1]).getByText("Dapur Kecil · sisa 2 hari")).toBeTruthy();
    expect(within(cards[6]).getByText("Makan Siang Kantor · 5–16 Okt")).toBeTruthy();
    // The rail runs to the screen's edges and starts at its margin, with 8 between cards.
    const rail = plans.getByTestId("plans-rail");
    // The margin is taken off a plain wrapper (a scroll view with a negative margin does not widen on Android); the
    // scroll view inside is full width and pads its content by 16 at both ends, so the next card peeks at the edge.
    expect(StyleSheet.flatten(plans.getByTestId("plans-rail-bleed").props.style).marginHorizontal).toBe(-16);
    expect(StyleSheet.flatten(rail.props.style)?.marginHorizontal).toBeUndefined();
    expect(StyleSheet.flatten(rail.props.contentContainerStyle)).toMatchObject({ paddingHorizontal: 16, gap: 8 });
    expect(rail.props.horizontal).toBe(true);
    expect(rail.props.showsHorizontalScrollIndicator).toBe(false);
    fireEvent.press(cards[0]);
    expect(router.push).toHaveBeenLastCalledWith("/subscriptions/s-h?title=Nasi%20Bakar");
    // Every plan is one tap away through the list.
    fireEvent.press(plans.getByRole("button", { name: "Lihat semua" }));
    expect(router.push).toHaveBeenLastCalledWith("/paket-saya");
  });

  it("on a 360 phone the rail cards shrink so a sliver of the third card always peeks; at 412 they stay 168", async () => {
    const widthsAt = async (width: number) => {
      mockWindow = { ...mockWindow, width };
      mount(runtimeWith(async () => ending()).runtime, v2);
      const plans = within(await screen.findByTestId("plans"));
      const widths = plans.getAllByTestId(/^plan-card-s-[a-z0-9]+$/).map((c) => StyleSheet.flatten(c.props.style).width as number);
      screen.unmount();
      return widths;
    };
    const saved = mockWindow;
    try {
      const narrow = await widthsAt(360);
      expect(new Set(narrow).size).toBe(1);
      // Margin 16, two cards, three gaps of 8 up to the third card's start: what is left of 360 is the peek.
      expect(360 - (16 + 2 * narrow[0] + 2 * 8)).toBeGreaterThanOrEqual(28);
      expect(narrow[0]).toBeLessThan(168);
      expect((await widthsAt(412))[0]).toBe(168);
    } finally {
      mockWindow = saved;
    }
  });

  it("three plans already make the rail", async () => {
    const state = quietPlan(8);
    state.subscriptions.push(
      plan("s-2", { name: "Makan Malam Hemat", caterer: "Dapur Bulan", meal: "dinner", remaining: 5, today: DEMO_TODAY }),
      plan("s-3", { name: "Paket Sehat", caterer: "Dapur Hijau", remaining: 20, today: DEMO_TODAY }),
    );
    mount(runtimeWith(async () => state).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.getByText("3 paket aktif")).toBeTruthy();
    expect(planIds(plans.getAllByTestId(/^plan-card-s-[a-z0-9]+$/))).toEqual(["plan-card-s-2", "plan-card-s-1", "plan-card-s-3"]);
  });

  it("a plan that ended is not listed, and no plan hides the section", async () => {
    const state = quietPlan(8);
    state.subscriptions.push(plan("s-9", { name: "Paket Lama", caterer: "Dapur Lama", status: "completed", remaining: 0, today: DEMO_TODAY }));
    const view = mount(runtimeWith(async () => state).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.queryByText("Paket Lama")).toBeNull();
    view.unmount();
    state.subscriptions[0].status = "completed";
    mount(runtimeWith(async () => state).runtime, v2);
    await screen.findByTestId("plate-hero");
    await settle();
    expect(screen.queryByTestId("plans")).toBeNull();
  });

  it("reads in English: active plans, See all, ends tomorrow, days left", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    mount(runtimeWith(async () => ending()).runtime, v2);
    const plans = within(await screen.findByTestId("plans"));
    expect(plans.getByText("8 active plans")).toBeTruthy();
    expect(plans.getByText("See all")).toBeTruthy();
    expect(plans.getByText("Dapur Arang · ends tomorrow")).toBeTruthy();
    expect(plans.getByText("Dapur Kecil · 2 days left")).toBeTruthy();
  });

  it("the last block of the page, after the days", async () => {
    mount(runtimeWith(async () => ending()).runtime, v2);
    await screen.findByTestId("plans");
    const tree = JSON.stringify(screen.toJSON(), (key, value) => (key === "refreshControl" ? undefined : value));
    expect(tree.lastIndexOf("8 paket aktif")).toBeGreaterThan(tree.lastIndexOf("Berikutnya"));
  });
});

/** WCAG contrast ratio of two #rrggbb colours. */
function contrastOf(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("the lower blocks in dark and at Malam", () => {
  it.each([
    ["light", "siang"],
    ["dark", "siang"],
    ["light", "malam"],
    ["dark", "malam"],
  ] as const)("read the theme tokens in %s %s", async (scheme, mood) => {
    pin(mood === "siang" ? morningOf(DEMO_TODAY) : eveningOf(DEMO_TODAY));
    const state = scheduled({ 2: 3, 3: 1 });
    state.subscriptions[0].remaining = 2;
    state.subscriptions.push(
      plan("s-5", { name: "Paket Lima", caterer: "Dapur Lima", remaining: 4, today: DEMO_TODAY }),
      plan("s-6", { name: "Paket Enam", caterer: "Dapur Enam", remaining: 5, today: DEMO_TODAY }),
    );
    mount(runtimeWith(async () => state).runtime, { v2: true, scheme, now: mood === "siang" ? morningOf(DEMO_TODAY) : eveningOf(DEMO_TODAY) });
    const palette = nativeThemes[scheme];
    const slot = await screen.findByTestId("live-slot");
    expect(StyleSheet.flatten(slot.props.style).backgroundColor).toBe(palette.surface);
    expect(color(within(slot).getByTestId("waiting-action"))).toBe(palette.charcoal);
    const days = await daysBlock();
    expect(StyleSheet.flatten(days.getByTestId("upcoming-none").props.style).backgroundColor).toBe(palette.line);
    // Its words are ink on the line fill, at least 4.5:1 (muted there is 4.4).
    const noneText = color(days.getByText("Malam tidak ada pengantaran"));
    expect(noneText).toBe(palette.charcoal);
    expect(contrastOf(noneText, palette.line)).toBeGreaterThanOrEqual(4.5);
    expect(color(days.getByText("Lihat jadwal"))).toBe(palette.forest);
    expect(color(days.getAllByTestId("upcoming-day-count")[0])).toBe(palette.muted);
    const plans = within(await screen.findByTestId("plans"));
    expect(color(plans.getByText("Lihat semua"))).toBe(palette.forest);
    expect(StyleSheet.flatten(plans.getByTestId("plan-card-s-1-photo").props.style).backgroundColor).toBe(palette.sage);
  });
});

