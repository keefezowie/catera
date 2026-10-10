import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays, currency, type CustomerActionItem, type CustomerState } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { Beranda } from "../src/today/Beranda";
import { PaketSaya } from "../src/plan/PlanList";
import { customerLink } from "../src/links";
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

/** Rows that carry an href open through openLink; its tab handling is covered in navigation.test, so here it opens the
 * path the way a push does. */
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
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

function mount(
  runtime: MobileRuntime,
  { now = morningOf(DEMO_TODAY), scheme = "light" as "light" | "dark", node = <Beranda /> } = {},
) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="beranda-sections-test">
      <MoodProvider now={() => now}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {node}
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}

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
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("the hero pager", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("two lunches are two equal heroes with 1 dari 2", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    mount(demo().runtime);
    const pager = await screen.findByTestId("hero-pager");
    expect(title()).toBe("Siang ini,\n2 antaran.");
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

    // TalkBack: one adjustable control speaks the card and moves the pager.
    const control = screen.getByRole("adjustable");
    expect(control.props.accessibilityLabel).toBe("Makan siang 1 dari 2, Dapur Senja");
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(screen.getByRole("adjustable").props.accessibilityLabel).toBe("Makan siang 2 dari 2, Dapur Contoh");
    expect(screen.getByText("2 dari 2")).toBeTruthy();
    expect(announce).toHaveBeenCalledWith("Makan siang 2 dari 2, Dapur Contoh");

    // A swipe back to the first card moves the counter with it.
    fireEvent.scroll(scroller, {
      nativeEvent: { contentOffset: { x: 0, y: 0 }, contentSize: { width: 1000, height: 300 }, layoutMeasurement: { width: 400, height: 300 } },
    });
    fireEvent(scroller, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(screen.getByText("1 dari 2")).toBeTruthy();
    fireEvent(scroller, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: widths[0] + 12, y: 0 } } });
    expect(screen.getByText("2 dari 2")).toBeTruthy();
  });

  it("one plan with one meal keeps today's single hero, with no counter", async () => {
    const { runtime } = runtimeWith(async () => onePlanOneMeal());
    mount(runtime);
    expect(await screen.findByTestId("plate-hero")).toBeTruthy();
    expect(screen.queryByTestId("hero-pager")).toBeNull();
    expect(screen.queryByText(/dari \d/)).toBeNull();
    expect(screen.queryByRole("adjustable")).toBeNull();
    expect(title()).toBe("Siang ini,\nayam bakar madu.");
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
    expect(color(screen.getByText("1 dari 2"))).toBe(palette.forest);
  });
});

describe("the other-meal row", () => {
  it("the other meal row counts its deliveries", async () => {
    pin(eveningOf(DEMO_TODAY));
    mount(demo().runtime, { now: eveningOf(DEMO_TODAY) });
    await screen.findByTestId("plate-hero");
    // Malam: one dinner is the hero; the two lunches are one row that counts them.
    expect(screen.queryByTestId("hero-pager")).toBeNull();
    const row = within(screen.getByTestId("other-meal-row"));
    expect(row.getByText("Siang ini · 2 antaran")).toBeTruthy();
    expect(row.getByText("Ayam bakar madu")).toBeTruthy();
    // A tap switches to Siang, where both lunches are the pager.
    fireEvent.press(screen.getByTestId("other-meal-row"));
    expect(await screen.findByTestId("hero-pager")).toBeTruthy();
    expect(within(screen.getByTestId("other-meal-row")).getByText("Malam ini · 17.00–19.00")).toBeTruthy();
    expect(within(screen.getByTestId("other-meal-row")).getByText("Sate ayam madura")).toBeTruthy();
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
    pin(eveningOf(DEMO_TODAY));
    const { runtime } = runtimeWith(async () => riceFirst());
    mount(runtime, { now: eveningOf(DEMO_TODAY) });
    const row = within(await screen.findByTestId("other-meal-row"));
    expect(row.getByText("Rendang sapi")).toBeTruthy();
    expect(row.queryByText("Nasi putih")).toBeNull();
  });

  it("names the package, never a dish, while the menu is not set", async () => {
    pin(eveningOf(DEMO_TODAY));
    const { runtime } = runtimeWith(async () => riceFirst(pendingMenu("lunch")));
    mount(runtime, { now: eveningOf(DEMO_TODAY) });
    const row = within(await screen.findByTestId("other-meal-row"));
    expect(row.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(row.queryByText(/Nasi|Rendang/)).toBeNull();
  });
});

describe("Menunggu Anda", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("waiting rows are one list with a single sunrise action", async () => {
    const { runtime, usage } = demo();
    mount(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(screen.getByRole("header", { name: "Menunggu Anda" })).toBeTruthy();
    // The review row appears once its dismissal mark has been read.
    await list.findByText("Bagaimana Dapur Hijau selama ini?");
    const rows = list.getAllByTestId("waiting-row");
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      "Pilih menu Selasa 13 Okt, Makan Siang Kantor · sebelum Senin 17.00, Pilih",
      "Pilih menu Rabu dan Kamis, Makan Siang Rumahan · sebelum Selasa 17.00, Pilih",
      "Pilih menu 3 hari, Makan Malam Hemat · sebelum Kamis 17.00, Pilih",
      `Paket Sehat, sisa 2 hari, Dapur Hijau · ${currency(30000, "id")} per porsi, Perpanjang`,
      "Coba Nasi Bakar selesai hari ini, Dapur Arang · paket coba, Paket penuh",
      "Coba Bento selesai besok, Dapur Kecil · paket coba, Paket penuh",
      "Bagaimana Dapur Hijau selama ini?, Ulasan singkat, 1 menit, Nilai",
    ]);
    // One action word per row; only Perpanjang takes the sunrise ink.
    const actions = list.getAllByTestId("waiting-action");
    expect(actions.map((a) => a.props.children)).toEqual([
      "Pilih", "Pilih", "Pilih", "Perpanjang", "Paket penuh", "Paket penuh", "Nilai",
    ]);
    expect(actions.filter((a) => color(a) === light.sunriseInk).map((a) => a.props.children)).toEqual(["Perpanjang"]);
    expect(actions.filter((a) => color(a) === light.forest)).toHaveLength(6);
    // Rows are at least 64dp, separated by hairlines, in one bordered card with no shadow.
    for (const row of rows) expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(64);
    const card = StyleSheet.flatten(screen.getByTestId("waiting-list").props.style);
    expect(card).toMatchObject({ borderRadius: 16, borderWidth: 1, borderColor: light.line });
    expect(card.boxShadow).toBeUndefined();
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

  it("reads in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    mount(demo().runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    await list.findByText("How has Dapur Hijau been so far?");
    expect(list.getAllByTestId("waiting-row").map((r) => r.props.accessibilityLabel)).toEqual([
      "Choose the menu for Tue 13 Oct, Makan Siang Kantor · before Mon 17.00, Choose",
      "Choose menus for Wednesday and Thursday, Makan Siang Rumahan · before Tue 17.00, Choose",
      "Choose menus for 3 days, Makan Malam Hemat · before Thu 17.00, Choose",
      `Paket Sehat, 2 days left, Dapur Hijau · ${currency(30000, "en")} per portion, Renew`,
      "Coba Nasi Bakar ends today, Dapur Arang · trial, Full plan",
      "Coba Bento ends tomorrow, Dapur Kecil · trial, Full plan",
      "How has Dapur Hijau been so far?, A short review, 1 minute, Rate",
    ]);
    expect(screen.getByRole("header", { name: "Waiting on you" })).toBeTruthy();
  });

  it("nothing waiting hides the section", async () => {
    const { runtime } = runtimeWith(async () => onePlanOneMeal());
    mount(runtime);
    await screen.findByTestId("plate-hero");
    await settle();
    expect(screen.queryByTestId("waiting-list")).toBeNull();
    expect(screen.queryByText("Menunggu Anda")).toBeNull();
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
    mount(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(screen.getByText(/Terakhir diperbarui 08\.12/)).toBeTruthy();
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
    mount(runtime);
    const list = within(await screen.findByTestId("waiting-list"));
    expect(await list.findByText("Bagaimana Dapur Hijau selama ini?")).toBeTruthy();
    expect(list.queryByText(/^Pilih menu/)).toBeNull();
    expect(list.getByText("Paket Sehat, sisa 2 hari")).toBeTruthy();
  });

  it("review opens its form in a sheet", async () => {
    const { runtime } = demo();
    mount(runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    const sheet = within(await screen.findByTestId("review-sheet"));
    fireEvent.press(sheet.getByRole("button", { name: "4 bintang" }));
    expect(sheet.getByRole("button", { name: "4 bintang" }).props.accessibilityState.selected).toBe(true);
    expect(sheet.getByRole("button", { name: "5 bintang" }).props.accessibilityState.selected).toBe(false);
    fireEvent.changeText(sheet.getByLabelText("Cerita singkat (opsional)"), "Enak dan tepat waktu");
    fireEvent.press(sheet.getByRole("button", { name: "Kirim ulasan" }));
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
    mount(demo().runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    fireEvent.press(within(await screen.findByTestId("review-sheet")).getByRole("button", { name: "Nanti saja" }));
    await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Hijau selama ini?")).toBeNull());
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-sehat", "dismissed");
  });

  it("a review error stays in the sheet", async () => {
    const { runtime } = demo();
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("NOPE"), { code: "NOPE" }));
    mount(runtime);
    fireEvent.press(await screen.findByRole("button", { name: /^Bagaimana Dapur Hijau selama ini\?/ }));
    const sheet = within(await screen.findByTestId("review-sheet"));
    fireEvent.press(sheet.getByRole("button", { name: "Kirim ulasan" }));
    expect(await sheet.findByText("Belum berhasil. Coba lagi.")).toBeTruthy();
    expect(screen.getByText("Bagaimana Dapur Hijau selama ini?")).toBeTruthy();
  });
});

describe("Berikutnya", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("Berikutnya groups a day's deliveries under one label", async () => {
    mount(demo().runtime);
    const days = within(await screen.findByTestId("upcoming-days"));
    expect(screen.getByRole("header", { name: "Berikutnya" })).toBeTruthy();
    // Three days: Monday's three deliveries under one label, then Tuesday and Wednesday.
    expect(days.getAllByTestId("upcoming-day-label").map((n) => n.props.children)).toEqual([
      "Senin 12 Okt",
      "Selasa 13 Okt",
      "Rabu 14 Okt",
    ]);
    expect(days.getAllByTestId("upcoming-day-count").map((n) => n.props.children)).toEqual([
      "3 antaran",
      "1 antaran",
      "1 antaran",
    ]);
    const rows = days.getAllByRole("button");
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      "Senin 12 Okt, Ayam bakar madu, Siang · Makan Siang Kantor · Dapur Senja",
      "Senin 12 Okt, Rendang sapi, Siang · Makan Siang Rumahan · Dapur Contoh",
      "Senin 12 Okt, Sate ayam madura, Malam · Makan Malam Hemat · Dapur Bulan",
      "Selasa 13 Okt, Ayam bakar madu, Siang · Makan Siang Kantor · Dapur Senja",
      "Rabu 14 Okt, Ayam bakar madu, Siang · Paket Sehat · Dapur Hijau",
    ]);
    // A lunch ring is sunrise ink, a dinner ring forest; the label is forest and bold, the count muted.
    const rings = days.getAllByTestId("photo-ring", { includeHiddenElements: true });
    expect(rings.map((r) => StyleSheet.flatten(r.props.style).borderColor).slice(0, 3)).toEqual([
      light.sunriseInk,
      light.sunriseInk,
      light.forest,
    ]);
    expect(StyleSheet.flatten(rings[0].props.style).width).toBe(40);
    expect(color(days.getAllByTestId("upcoming-day-label")[0])).toBe(light.forest);
    expect(color(days.getAllByTestId("upcoming-day-count")[0])).toBe(light.muted);
    fireEvent.press(rows[2]);
    expect(router.push).toHaveBeenLastCalledWith("/hari/d-s-malam-2026-10-12?title=Senin%2012%20Okt");
  });

  it("says Menu belum ditentukan for a menu that is not set, never a dish", async () => {
    const only = plan("s-1", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", today: DEMO_TODAY, menus: [pendingMenu("lunch")] });
    const state = {
      subscriptions: [only],
      deliveries: [planDelivery(only, addDays(DEMO_TODAY, 2))],
      addresses: [],
      notifications: [],
      cases: [],
    } as CustomerState;
    const { runtime } = runtimeWith(async () => state);
    mount(runtime);
    const days = within(await screen.findByTestId("upcoming-days"));
    expect(days.getByText("Menu belum ditentukan")).toBeTruthy();
  });

  it("on a Saturday with nothing today, names Monday and lists it first", async () => {
    const { runtime } = runtimeWith(async () => quietSaturday());
    mount(runtime);
    await screen.findByTestId("home-title");
    expect(title()).toBe("Siang ini,\ntidak ada antaran.");
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    expect(within(screen.getByTestId("mood-header")).getByText("Berikutnya Senin 12 Okt")).toBeTruthy();
    expect(within(screen.getByTestId("upcoming-days")).getAllByTestId("upcoming-day-label")[0].props.children).toBe(
      "Senin 12 Okt",
    );
  });
});

describe("the plans row and Paket saya", () => {
  beforeEach(() => pin(morningOf(DEMO_TODAY)));

  it("eight plans become one row that opens Paket saya", async () => {
    const { runtime } = runtimeWith(async () => eightPlans());
    mount(runtime);
    const row = await screen.findByTestId("plans-row");
    expect(within(row).getByText("8 paket aktif")).toBeTruthy();
    expect(
      within(row).getByText("Dapur Senja, Dapur Contoh, Dapur Bulan, Dapur Hijau, Dapur Kecil, Dapur Arang"),
    ).toBeTruthy();
    expect(within(row).getAllByTestId("plans-thumb", { includeHiddenElements: true })).toHaveLength(3);
    expect(StyleSheet.flatten(row.props.style).minHeight).toBeGreaterThanOrEqual(64);
    // No per-plan lines, renewal cards or trial cards stay on Beranda.
    expect(screen.queryByText(/lihat detail paket/)).toBeNull();
    expect(screen.queryByText(/hari lagi/)).toBeNull();
    // Nothing follows the plans row.
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.lastIndexOf("8 paket aktif")).toBeGreaterThan(tree.lastIndexOf("Berikutnya"));
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/paket-saya");
  });

  it("counts one plan in the singular in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const { runtime } = runtimeWith(async () => onePlanOneMeal());
    mount(runtime);
    expect(within(await screen.findByTestId("plans-row")).getByText("1 active plan")).toBeTruthy();
  });

  it("duplicate plan names show their dates", async () => {
    const { runtime } = runtimeWith(async () => eightPlans());
    mount(runtime, { node: <PaketSaya /> });
    expect(await screen.findByText("Makan Siang Kantor · 5–16 Okt")).toBeTruthy();
    expect(screen.getByText("Makan Siang Kantor · 19–30 Okt")).toBeTruthy();
    // A unique name keeps its own.
    expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(within(screen.getByTestId("screen-native-title")).getByText("Paket aktif")).toBeTruthy();
    fireEvent.press(screen.getByText("Makan Siang Kantor · 19–30 Okt"));
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-b?title=Makan%20Siang%20Kantor");
  });

  it("Paket saya says so when the read fails, and reads again", async () => {
    let fail = true;
    const { runtime } = runtimeWith(async () => {
      if (fail) throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
      return eightPlans();
    });
    mount(runtime, { node: <PaketSaya /> });
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    fail = false;
    fireEvent.press(retry);
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
  });
});
