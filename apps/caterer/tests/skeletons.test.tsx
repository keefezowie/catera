import { act, render, screen, waitFor, within } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { spyFades } from "./fade";
import * as ReactNative from "react-native";
import { StyleSheet, Text as RNText } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { nativeMood, nativeMotion, nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import type { SellerOperationsState } from "@catera/domain";
import { TodayScreen } from "../src/today/TodayScreen";
import { CustomerList } from "../src/customers/CustomerList";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { MenuWeek } from "../src/menu/MenuWeek";
import { MenuDayScreen } from "../src/menu/MenuDayScreen";
import { ReportScreen } from "../src/today/ReportScreen";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { DetailSkeleton, ListSkeleton, UangSkeleton } from "../src/skeletons";
import { UangScreen } from "../src/business/UangScreen";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import * as offline from "../src/today/offline";
import { canvasDay } from "./fixtures";
import { withDapurScale } from "./dapur-scale";

/**
 * Dapur's loading pass (Phase F task 6): every screen waits behind its own skeleton, never a bare "Memuat…" line or a
 * spinner, and Hari ini and Pelanggan reload with a pull. The skeleton's words are its progress bar's name, so the tests
 * find each one by that name ("Memuat dapur"), the same way a screen reader meets it.
 */

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
}));
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

// Thursday 8 Oct 2026, 10.00 Jakarta (Siang). Only the clock is pinned: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
const SIANG = () => NOW;
const MALAM = () => new Date("2026-10-08T12:00:00Z");
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  // A stored theme or session must not reach the next test.
  secureStore.clear();
});

const secureStore = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Mbak Sari", catererId: "k-1" };
const never = () => new Promise<never>(() => undefined);
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as ReactNative.StyleProp<ReactNative.ViewStyle>) ?? {};
/** A `FadeSwap` bringing content in: opacity to 1 over the content duration (other timings fade things out). */
const fadeIn = (call: unknown[]) =>
  call[0] === 1 && (call[1] as { duration?: number } | undefined)?.duration === nativeMotion.content;
/** A drawn view (not the component that passed its test id down), so its style is the one on screen. */
const host = (n: { type: unknown }) => typeof n.type === "string";

/**
 * A read that answers only when told. Every call waits (the screen reads once before the account is known and again
 * after), and `answer` settles all of them.
 */
function held<T>() {
  const waiting: ((value: T) => void)[] = [];
  let settled: { value: T } | null = null;
  const fn = jest.fn(
    () => new Promise<T>((resolve) => (settled ? resolve(settled.value) : waiting.push(resolve))),
  );
  return {
    fn,
    answer: (value: T) => {
      // A read that starts after the answer (the account's own, once it is known) gets it at once.
      settled = { value };
      waiting.splice(0).forEach((resolve) => resolve(value));
    },
  };
}

/** The canvas day on today's date, every lunch row still to cook. */
function today(): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = "2026-10-08";
  day.today = "2026-10-08";
  day.deliveries = day.deliveries.map((d) => ({ ...d, service_date: "2026-10-08" }));
  return day;
}

const menuOps = () => ({
  ...today(),
  dishes: [],
  datedMenus: [],
  offers: [
    {
      id: "p-1",
      name: "Makan Siang Rumahan",
      status: "published",
      meal: "lunch",
      price: 25000,
      weekdays: [1, 2, 3, 4, 5],
      contentRevision: 2,
      menus: [{ meal: "lunch", name: "Makan Siang", description: "", image: "", composition: [{ id: "g", name: "Lauk", slots: 1 }] }],
    },
  ],
});

type Api = Partial<Record<keyof MobileRuntime["api"], jest.Mock>>;
function runtimeWith(actor: typeof owner, api: Api = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "sk" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    sellerOperations: jest.fn(async () => today()),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    sellerCustomers: jest.fn(async () => ({ customers: [], total: 0, packages: [] })),
    settlement: jest.fn(async () => ({ unavailable: true })),
    menuMonth: jest.fn(async () => ({ dates: [], categories: [] })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

function renderWith(runtime: MobileRuntime, node: ReactNode, now = SIANG) {
  return render(
    <ThemeProvider storageKey="sk.theme">
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          {node}
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}

/** Every skeleton on screen, by its progress bar's name. */
const skeletonNames = () =>
  screen.queryAllByRole("progressbar").map((n) => n.props.accessibilityLabel as string);

type Node = ReturnType<typeof screen.getByTestId>;
/** The drawn views directly under a node, looking through the components between them. */
const drawnChildren = (n: Node): Node[] =>
  n.children.flatMap((c) => (typeof c === "string" ? [] : host(c) ? [c] : drawnChildren(c)));
/**
 * A column's height from its styles alone, the way the layout adds it up: a fixed height, else a text's line height,
 * else its drawn children stacked (a column adds them with its gap, a row takes the tallest) plus its vertical padding.
 * Jest has no layout engine, so this is how a skeleton and the view it stands for are compared.
 */
function stackHeight(n: Node): number {
  const s = flat(n) as ReactNative.ViewStyle & ReactNative.TextStyle;
  if (typeof s.height === "number") return s.height;
  if (n.type === "Text") return s.lineHeight ?? Number.NaN;
  const kids = drawnChildren(n).filter((k) => flat(k).position !== "absolute");
  const sizes = kids.map(stackHeight);
  const edge = (side: number | ReactNative.DimensionValue | undefined) => (typeof side === "number" ? side : 0);
  const pad =
    edge(s.paddingTop ?? s.paddingVertical ?? s.padding) + edge(s.paddingBottom ?? s.paddingVertical ?? s.padding);
  if (s.flexDirection === "row") return Math.max(0, ...sizes) + pad;
  return sizes.reduce((a, b) => a + b, 0) + edge(s.rowGap ?? s.gap) * Math.max(0, kids.length - 1) + pad;
}

/** The text drawn inside a subtree; a skeleton draws none, so a larger font cannot make it taller. */
const textsIn = (node: ReturnType<typeof screen.getByTestId>) => node.findAll((n) => n.type === RNText || (n.type as unknown) === "Text");

describe("Hari ini", () => {
  it("Hari ini loading shows the count card and checklist skeleton under the live header", async () => {
    const day = jest.fn(never);
    renderWith(runtimeWith(owner, { sellerOperations: day }), withDapurScale(<TodayScreen />));
    // The header is live: its date button and the Siang / Malam toggle work while the day loads.
    const header = await screen.findByTestId("mood-header");
    expect(within(header).getByLabelText(/, ganti hari$/)).toBeTruthy();
    expect(within(header).getByRole("tab", { name: "Malam" })).toBeTruthy();
    // The count card's numbers sit on the mood surface, in the header, hidden from screen readers (the body names the wait).
    const count = within(header).getByTestId("today-count-skeleton", { includeHiddenElements: true });
    expect(count.props.accessibilityElementsHidden).toBe(true);
    const blocks = count.findAll((n) => host(n) && typeof n.props.testID === "string" && n.props.testID.startsWith("today-count-block"));
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) expect(flat(block).backgroundColor).toBe(nativeMood.light.siang.arcTrack);
    // The body holds the session card's shape: four checklist rows, one progress bar named for the kitchen.
    expect(skeletonNames()).toEqual(["Memuat dapur"]);
    const body = screen.getByLabelText("Memuat dapur");
    expect(within(body).queryAllByTestId(/^today-skeleton-row-/, { includeHiddenElements: true })).toHaveLength(4);
    // The recap's "Per paket" rows stand above the checklist, at the loaded Row's 40dp, so the card does not grow.
    const packages = within(body).queryAllByTestId(/^today-skeleton-package-/, { includeHiddenElements: true });
    expect(packages).toHaveLength(2);
    for (const row of packages) expect(flat(row).height).toBe(40);
    expect(screen.queryByText(/Memuat…/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Mulai masak/ })).toBeNull();
    expect(screen.queryByText(/Tidak ada masakan/)).toBeNull();
  });

  it("the loaded day replaces both skeletons", async () => {
    const read = held<SellerOperationsState>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn }), withDapurScale(<TodayScreen />));
    expect(await screen.findByLabelText("Memuat dapur")).toBeTruthy();
    await act(async () => read.answer(today()));
    expect(await screen.findByTestId("session-count")).toBeTruthy();
    expect(screen.queryByTestId("today-count-skeleton", { includeHiddenElements: true })).toBeNull();
    expect(skeletonNames()).toEqual([]);
  });

  it("the count skeleton's track is as tall as the loaded rantang track, so the header keeps its height at the swap", async () => {
    const read = held<SellerOperationsState>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn }), withDapurScale(<TodayScreen />));
    const header = await screen.findByTestId("mood-header");
    const track = within(header).getByTestId("today-count-track", { includeHiddenElements: true });
    // The stop labels' row sits under the rail, its blocks on the mood surface like the rest.
    for (let i = 0; i < 4; i += 1)
      expect(flat(within(track).getByTestId(`today-count-block-stop-${i}`, { includeHiddenElements: true })).backgroundColor).toBe(
        nativeMood.light.siang.arcTrack,
      );
    const waiting = stackHeight(track);
    await act(async () => read.answer(today()));
    const loaded = stackHeight(await screen.findByTestId("rantang-track"));
    // The compact track: the 40 rail, then the stop labels' and counts' lines (18 each), 8dp apart. Its words line is
    // not drawn, so there is no caption line above the rail.
    expect(loaded).toBe(40 + 8 + 36);
    expect(waiting).toBe(loaded);
  });

  it("the count skeleton's strip is as tall as the loaded figure strip, and both sit 12 under the date and 12 apart", async () => {
    const read = held<SellerOperationsState>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn }), withDapurScale(<TodayScreen />));
    const header = await screen.findByTestId("mood-header");
    const skeleton = within(header).getByTestId("today-count-skeleton", { includeHiddenElements: true });
    const waitingStrip = stackHeight(within(skeleton).getByTestId("today-count-strip", { includeHiddenElements: true }));
    const waitingFlow = flat(skeleton);
    // Most kitchens have a delivery window, so the strip carries its "Antar" line: 12 + (18 + 40) + 6 + 18 + 12 = 106.
    const windowed = today();
    windowed.deliveries = windowed.deliveries.map(
      (d) => ({ ...d, offer: { ...d.offer, windows: { ...d.offer?.windows, lunch: "11.30-13.00" } } }) as typeof d,
    );
    await act(async () => read.answer(windowed));
    const loadedStrip = stackHeight(await screen.findByTestId("session-figures"));
    const loadedFlow = flat(screen.getByTestId("session-count"));
    expect(screen.getByText("Antar 11.30")).toBeTruthy();
    // The measure leaves the subline's 6 margin out; the skeleton holds it as a gap.
    expect(loadedStrip + 6).toBe(106);
    expect(waitingStrip).toBe(106);
    expect(waitingFlow).toMatchObject({ gap: 12, marginTop: 8 });
    expect(loadedFlow).toMatchObject({ gap: 12, marginTop: 8 });
  });

  it("in English the stop labels hold two lines' room (On the way wraps), in the track and in its skeleton alike", async () => {
    const read = held<SellerOperationsState>();
    const runtime = runtimeWith(owner, { sellerOperations: read.fn });
    secureStore.set(runtime.storageKey("locale"), "en");
    renderWith(runtime, withDapurScale(<TodayScreen />));
    const header = await screen.findByTestId("mood-header");
    await waitFor(() => expect(within(header).getByLabelText(/, change day$/)).toBeTruthy());
    const waiting = stackHeight(within(header).getByTestId("today-count-track", { includeHiddenElements: true }));
    await act(async () => read.answer(today()));
    const loaded = stackHeight(await screen.findByTestId("rantang-track"));
    // The compact rail (40), two label lines (36) and the count line (18), 8dp apart.
    expect(loaded).toBe(40 + 8 + 54);
    expect(waiting).toBe(loaded);
    secureStore.delete(runtime.storageKey("locale"));
  });

  it("Malam's skeleton sits on the Malam header, visible against its fill", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<TodayScreen />), MALAM);
    const header = await screen.findByTestId("mood-header");
    const count = within(header).getByTestId("today-count-skeleton", { includeHiddenElements: true });
    const block = count.find((n) => host(n) && n.props.testID === "today-count-block-number");
    expect(flat(block).backgroundColor).toBe(nativeMood.light.malam.arcTrack);
    expect(nativeMood.light.malam.arcTrack).not.toBe(nativeMood.light.malam.header);
    expect(screen.getByLabelText("Memuat dapur")).toBeTruthy();
  });

  it("in the dark theme the skeleton reads the dark mood and the dark sage", async () => {
    secureStore.set("sk.theme", "dark");
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<TodayScreen />));
    const header = await screen.findByTestId("mood-header");
    // The stored choice is read from the phone, so the dark palette lands a moment after the first frame.
    await waitFor(() =>
      expect(flat(within(header).getByTestId("today-count-block-number", { includeHiddenElements: true })).backgroundColor).toBe(
        nativeMood.dark.siang.arcTrack,
      ),
    );
    const row = within(screen.getByLabelText("Memuat dapur")).getByTestId("today-skeleton-row-0", { includeHiddenElements: true });
    const fills = row.findAll((n) => flat(n).backgroundColor === nativeThemes.dark.sage);
    expect(fills.length).toBeGreaterThan(0);
  });

  it("a failed first read shows the error with Coba lagi, never a skeleton", async () => {
    renderWith(
      runtimeWith(owner, {
        sellerOperations: jest.fn(async () => {
          throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
        }),
      }),
      withDapurScale(<TodayScreen />),
    );
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
    expect(screen.queryByTestId("today-count-skeleton", { includeHiddenElements: true })).toBeNull();
  });

  it("the kept day offline keeps its kept-data note and shows no skeleton", async () => {
    (offline.loadCachedDay as jest.Mock).mockResolvedValue({ savedAt: "2026-10-08T01:00:00.000Z", data: today() });
    renderWith(
      runtimeWith(owner, {
        sellerOperations: jest.fn(async () => {
          throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
        }),
      }),
      withDapurScale(<TodayScreen />),
    );
    expect(await screen.findByText(/Ini data terakhir yang tersimpan/)).toBeTruthy();
    expect(screen.getByTestId("session-count")).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
  });

  it("pull to refresh on Hari ini keeps the session on screen", async () => {
    const day = jest.fn(async () => today());
    renderWith(runtimeWith(owner, { sellerOperations: day }), withDapurScale(<TodayScreen />));
    expect(await screen.findByTestId("session-count")).toBeTruthy();
    const scroll = screen.getByTestId("screen-scroll");
    const control = scroll.props.refreshControl as ReactElement<ReactNative.RefreshControlProps>;
    expect(control.props.refreshing).toBe(false);
    // The pull starts a second read that has not answered yet.
    let answer!: (d: SellerOperationsState) => void;
    const before = day.mock.calls.length;
    day.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    await act(async () => control.props.onRefresh?.());
    const pulling = screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>;
    expect(pulling.props.refreshing).toBe(true);
    // The session stays where it was: no skeleton, no "Memperbarui…", the count still on the header.
    expect(screen.getByTestId("session-count")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mulai masak" })).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
    expect(screen.queryByText("Memperbarui…")).toBeNull();
    expect(day).toHaveBeenCalledTimes(before + 1);
    await act(async () => answer(today()));
    await waitFor(() =>
      expect((screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>).props.refreshing).toBe(false),
    );
    expect(screen.getByTestId("session-count")).toBeTruthy();
  });

  it("the pull spinner takes the theme's ink and surface", async () => {
    renderWith(runtimeWith(owner), withDapurScale(<TodayScreen />));
    await screen.findByTestId("session-count");
    const control = screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>;
    expect(control.props.tintColor).toBe(nativeThemes.light.forest);
    expect(control.props.colors).toEqual([nativeThemes.light.forest]);
    expect(control.props.progressBackgroundColor).toBe(nativeThemes.light.surface);
  });

  it("under reduced motion the skeleton holds still and the swap is instant", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const timing = jest.spyOn(Reanimated, "withTiming");
    const read = held<SellerOperationsState>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn }), withDapurScale(<TodayScreen />));
    expect(await screen.findByLabelText("Memuat dapur")).toBeTruthy();
    expect(repeat).not.toHaveBeenCalled();
    await act(async () => read.answer(today()));
    await screen.findByTestId("session-count");
    expect(timing.mock.calls.filter(fadeIn)).toEqual([]);
  });

  it("skeleton rows hold the checklist row's height and draw no text, so a 1.3 font scale only makes the loaded day taller", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<TodayScreen />));
    const body = await screen.findByLabelText("Memuat dapur");
    for (let i = 0; i < 4; i += 1) {
      const row = within(body).getByTestId(`today-skeleton-row-${i}`, { includeHiddenElements: true });
      // CheckRow's minimum height; its text grows with the font scale, the skeleton's blocks do not.
      expect(flat(row).height).toBe(56);
    }
    expect(textsIn(body)).toEqual([]);
    const header = screen.getByTestId("mood-header");
    expect(textsIn(within(header).getByTestId("today-count-skeleton", { includeHiddenElements: true }))).toEqual([]);
  });

  it("the body skeleton is built from the loaded layout's numbers: 56 check rows with a 48 quantity column and a 40 photo, 40 package rows, 24 between the sections", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<TodayScreen />));
    const body = await screen.findByLabelText("Memuat dapur");
    const hiddenToo = { includeHiddenElements: true };
    const row = within(body).getByTestId("today-skeleton-row-0", hiddenToo);
    expect(flat(row).height).toBe(56);
    const parts = drawnChildren(row);
    // The quantity column, the photo, the name and the tick.
    expect(flat(parts[0]).width).toBe(48);
    expect(flat(parts[1])).toMatchObject({ width: 40, height: 40, borderRadius: 8 });
    expect(flat(parts[3])).toMatchObject({ width: 48, height: 48 });
    for (const i of [0, 1]) expect(flat(within(body).getByTestId(`today-skeleton-package-${i}`, hiddenToo)).height).toBe(40);
    // Two sections under one 24 gap, each a heading line and 12 above its card (Daftar masak 48: its buttons; Per paket 26), the card with its hairline inset.
    const sections = drawnChildren(drawnChildren(body)[0]);
    expect(flat(drawnChildren(body)[0]).gap).toBe(24);
    expect(sections).toHaveLength(2);
    expect(flat(drawnChildren(sections[0])[0]).height).toBe(48);
    expect(flat(drawnChildren(sections[0])[1]).height).toBe(12);
    expect(flat(drawnChildren(sections[1])[0]).height).toBe(26);
  });
});

describe("staff", () => {
  it("staff loading never shows Usaha skeletons", async () => {
    const runtime = runtimeWith(staff, { sellerOperations: jest.fn(never), sellerCustomers: jest.fn(never), settlement: jest.fn(never) });
    const first = renderWith(runtime, <TodayScreen />);
    expect(await screen.findByLabelText("Memuat dapur")).toBeTruthy();
    expect(skeletonNames()).toEqual(["Memuat dapur"]);
    first.unmount();
    // Menu while it loads: the week's shape, and no placeholder for the owner's Salin minggu lalu.
    renderWith(runtime, <MenuWeek />);
    expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
    expect(skeletonNames()).toEqual(["Memuat menu"]);
    expect(screen.queryByTestId("menu-skeleton-copy", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("menu-skeleton-share", { includeHiddenElements: true })).toBeTruthy();
    // Nothing a helper cannot open (packages, customers, money) ever loads on their screens.
    for (const name of ["Memuat paket", "Memuat pelanggan", "Memuat uang", "Memuat pembayaran"])
      expect(screen.queryByLabelText(name)).toBeNull();
    expect(runtime.api.sellerCustomers).not.toHaveBeenCalled();
    expect(runtime.api.settlement).not.toHaveBeenCalled();
  });

  it("the owner's Menu skeleton keeps a place for Salin minggu lalu", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), <MenuWeek />);
    expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
    expect(screen.getByTestId("menu-skeleton-copy", { includeHiddenElements: true })).toBeTruthy();
  });
});

/** The nearest drawn ancestor of a node that satisfies a test (the skeleton's own wrappers sit between). */
function ancestor(node: Node, test: (n: Node) => boolean): Node | null {
  for (let n = node.parent as Node | null; n; n = n.parent as Node | null) if (host(n) && test(n)) return n;
  return null;
}

describe("Menu", () => {
  it("while the week loads the header and controls are live and the day card is a skeleton", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(async () => menuOps()), menuMonth: jest.fn(never) }), withDapurScale(<MenuWeek />));
    expect(await screen.findByRole("button", { name: "Bagikan menu" })).toBeTruthy();
    expect(skeletonNames()).toEqual(["Memuat menu"]);
    // Only the day card waits: the package chips and buttons are real, so they are not drawn twice.
    expect(screen.queryByTestId("menu-skeleton-share", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("menu-skeleton-day", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
  });

  it("Menu's first load draws the loaded header's shape on the Malam surface and keeps the day card on the page", async () => {
    const read = held<unknown>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn, menuMonth: jest.fn(never) }), withDapurScale(<MenuWeek />), MALAM);
    const header = await screen.findByTestId("mood-header");
    // The week line is already true (the screen opens on this week), and the title row keeps the step buttons' 44dp.
    expect(within(header).getByText("Minggu ini")).toBeTruthy();
    expect(flat(within(header).getByTestId("menu-title-row")).minHeight).toBe(44);
    // One row of five day blocks at the day tiles' 56dp and radius 12, on the Malam surface, hidden from screen readers.
    const strip = within(header).getByTestId("menu-strip-skeleton", { includeHiddenElements: true });
    expect(strip.props.accessibilityElementsHidden).toBe(true);
    const days = strip.findAll((n) => host(n) && /^menu-strip-skeleton-day-/.test(String(n.props.testID ?? "")));
    expect(days).toHaveLength(5);
    for (const day of days) {
      expect(flat(day).height).toBe(56);
      expect(flat(day).borderRadius).toBe(12);
      expect(flat(day).backgroundColor).toBe(nativeMood.light.malam.arcTrack);
    }
    expect(nativeMood.light.malam.arcTrack).not.toBe(nativeMood.light.malam.header);
    // The page holds the controls and the day card; only the day card names the wait.
    expect(skeletonNames()).toEqual(["Memuat menu"]);
    const fills = screen.getByLabelText("Memuat menu").findAll((n) => flat(n).backgroundColor === nativeThemes.light.sage);
    expect(fills.length).toBeGreaterThan(0);
    // The packages arrive: the week's five day buttons take the blocks' place at the same height.
    await act(async () => read.answer(menuOps()));
    await screen.findByTestId("menu-strip");
    const buttons = within(screen.getByTestId("mood-header")).getAllByTestId(/^menu-day-/);
    expect(buttons).toHaveLength(5);
    for (const button of buttons) expect(flat(button).minHeight).toBe(56);
    expect(flat(within(screen.getByTestId("mood-header")).getByTestId("menu-title-row")).minHeight).toBe(44);
  });

  it("the strip skeleton shares one row evenly and keeps the 4 gap of the loaded strip", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<MenuWeek />));
    const strip = await screen.findByTestId("menu-strip-skeleton", { includeHiddenElements: true });
    const row = strip.findAll((n) => host(n) && flat(n).flexDirection === "row")[0];
    expect(flat(row)).toMatchObject({ gap: 4 });
    expect(flat(row).flexWrap).not.toBe("wrap");
  });

  it("the controls skeleton is built from the loaded controls' constants: a 34 chip in a 48 frame, then two 50 pill buttons", async () => {
    jest.spyOn(require("react-native") as typeof ReactNative, "useWindowDimensions").mockReturnValue({ width: 412, height: 860, scale: 3, fontScale: 1 });
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<MenuWeek />));
    const chip = await screen.findByTestId("menu-skeleton-chip", { includeHiddenElements: true });
    expect(flat(chip).height).toBe(34);
    // The frame around the chip is 48 tall, like the package chips' frame once loaded.
    expect(flat(ancestor(chip, (n) => flat(n).height === 48)!)).toMatchObject({ height: 48, justifyContent: "center" });
    for (const id of ["menu-skeleton-copy", "menu-skeleton-share"]) {
      expect(flat(screen.getByTestId(id, { includeHiddenElements: true }))).toMatchObject({ height: 50, borderRadius: 25 });
    }
    // The buttons sit side by side, 8 apart, as the loaded row does.
    const copy = screen.getByTestId("menu-skeleton-copy", { includeHiddenElements: true });
    expect(flat(ancestor(copy, (n) => flat(n).flexDirection === "row")!)).toMatchObject({ flexDirection: "row", gap: 8 });
  });

  it("the controls skeleton stacks its two buttons where the loaded pair stacks (360 at font scale 1.3)", async () => {
    jest.spyOn(require("react-native") as typeof ReactNative, "useWindowDimensions").mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<MenuWeek />));
    const copy = await screen.findByTestId("menu-skeleton-copy", { includeHiddenElements: true });
    expect(flat(ancestor(copy, (n) => flat(n).flexDirection === "column" && flat(n).gap === 8)!)).toMatchObject({ gap: 8 });
  });

  it("the day card's skeleton is a section header line over 64 rows with 48 thumbs, like the loaded day", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<MenuWeek />));
    const day = await screen.findByTestId("menu-skeleton-day", { includeHiddenElements: true });
    const rows = day.findAll((n) => host(n) && flat(n).minHeight === 64);
    expect(rows).toHaveLength(3);
    // The owner's header holds "Ubah menu", so its line is the 48 target.
    expect(flat(drawnChildren(drawnChildren(day)[0])[0]).height).toBe(48);
    const thumbs = day.findAll((n) => host(n) && flat(n).width === 48 && flat(n).height === 48);
    expect(thumbs).toHaveLength(3);
    for (const thumb of thumbs) expect(flat(thumb).borderRadius).toBe(8);
    // Rows sit in a list card, not in a card of their own: no Card border, the list card's radius 16.
    expect(within(day).getByTestId("list-card", { includeHiddenElements: true })).toBeTruthy();
    expect(textsIn(day)).toEqual([]);
  });

  it("the day card's skeleton stays in place when the packages arrive, so it fades in once", async () => {
    const ops = held<unknown>();
    const month = held<unknown>();
    const timing = spyFades();
    renderWith(runtimeWith(owner, { sellerOperations: ops.fn, menuMonth: month.fn }), withDapurScale(<MenuWeek />));
    const day = await screen.findByTestId("menu-skeleton-day", { includeHiddenElements: true });
    await act(async () => ops.answer(menuOps()));
    expect(await screen.findByRole("button", { name: "Bagikan menu" })).toBeTruthy();
    // The day card still waits for its week in the very skeleton it started with (the same mounted view, not a new
    // one): it was not redrawn, so it did not fade with the controls.
    expect(skeletonNames()).toEqual(["Memuat menu"]);
    expect(screen.getByTestId("menu-skeleton-day", { includeHiddenElements: true })).toBe(day);
    // Two blocks entered: the header's day strip and the controls under it.
    expect(timing.mock.calls.filter(fadeIn)).toHaveLength(2);
    await act(async () => month.answer({ dates: [], categories: [] }));
    await waitFor(() => expect(skeletonNames()).toEqual([]));
    expect(screen.getByTestId("menu-day-2026-10-08").props.accessibilityLabel).toMatch(/menu belum diisi$/);
    // The day card's one swap.
    expect(timing.mock.calls.filter(fadeIn)).toHaveLength(3);
  });

  it("a kitchen with no packages yet fades its empty state in from the skeleton", async () => {
    const ops = held<unknown>();
    const timing = spyFades();
    renderWith(runtimeWith(owner, { sellerOperations: ops.fn }), withDapurScale(<MenuWeek />));
    expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
    await act(async () => ops.answer({ ...menuOps(), offers: [] }));
    expect(await screen.findByRole("button", { name: "Buat paket" })).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
    expect(timing.mock.calls.filter(fadeIn)).toHaveLength(1);
  });

  it("a failed Menu read keeps Menu belum bisa dimuat with Coba lagi", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(async () => menuOps()), menuMonth: jest.fn(async () => Promise.reject(new Error("400"))) }), withDapurScale(<MenuWeek />));
    expect(await screen.findByText("Menu belum bisa dimuat.")).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
  });

  it("the day screen waits behind the menu skeleton", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), withDapurScale(<MenuDayScreen date="2026-10-08" packageId="p-1" meal="lunch" />));
    expect(await screen.findByLabelText("Memuat menu")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
  });
});

describe("Pelanggan", () => {
  const customer = {
    id: "c-01",
    caterer_id: "k-1",
    user_id: null,
    name: "Andre Kusuma",
    phone: "+628123450001",
    address: { line: "Kost Damai", area: "Setiabudi" },
    origin: "seller",
    version: 1,
    claim_review: null,
    // One running package, so the customer is in the Aktif filter the list opens on.
    subscriptions: [
      {
        id: "s-1",
        package_id: "p-rumahan",
        package_name: "Makan Siang Rumahan",
        meal: "lunch",
        portions: 1,
        starts_on: "2026-10-01",
        ends_on: "2026-10-20",
        status: "active",
        remaining: 9,
        next_delivery: "2026-10-09",
        legacy: true,
        renewed_from: null,
        external_reference: null,
        payment_route: "external_reported",
        renewal_status: "unknown",
        prepared_at: null,
        trial: false,
        deliveries: [],
      },
    ],
  };

  it("Pelanggan loading shows customer rows under the live header, then the list fades in once", async () => {
    const read = held<unknown>();
    renderWith(runtimeWith(owner, { sellerCustomers: read.fn }), withDapurScale(<CustomerList />));
    const header = await screen.findByTestId("pelanggan-header");
    expect(within(header).getByText("Pelanggan")).toBeTruthy();
    expect(skeletonNames()).toEqual(["Memuat pelanggan"]);
    expect(within(header).queryByLabelText("Memuat pelanggan")).toBeNull();
    // The three filter chips hold their row: 34 chips in the same 48 frame as the loaded chips, above the rows.
    const chips = screen.queryAllByTestId(/^list-skeleton-chip-/, { includeHiddenElements: true });
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(flat(chip).height).toBe(34);
    expect(flat(screen.getByTestId("list-skeleton-chips", { includeHiddenElements: true }))).toMatchObject({ height: 48, marginRight: -16 });
    // The rows are one card of 64 rows, the loaded list's own ListCard, with its hairlines.
    const rows = screen.queryAllByTestId(/^list-skeleton-row-/, { includeHiddenElements: true });
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const row of rows) expect(flat(row).height).toBe(64);
    expect(screen.getAllByTestId("list-card", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "+ Pelanggan lama" })).toBeTruthy();
    expect(screen.queryByText("Memuat pelanggan…")).toBeNull();
    const timing = spyFades();
    await act(async () => read.answer({ customers: [customer, { ...customer, id: "c-02", name: "Dewi" }], total: 2, packages: [] }));
    expect(await screen.findByText("Andre Kusuma")).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
    // One block enters from the skeleton: one fade over the content duration, not one per row.
    expect(timing.mock.calls.filter(fadeIn)).toHaveLength(1);
  });

  it("a failed list keeps its error and Coba lagi", async () => {
    renderWith(
      runtimeWith(owner, {
        sellerCustomers: jest.fn(async () => {
          throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
        }),
      }),
      <CustomerList />,
    );
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
  });

  it("pull to refresh on Pelanggan keeps the list on screen", async () => {
    const list = jest.fn(async () => ({ customers: [customer], total: 1, packages: [] }));
    renderWith(runtimeWith(owner, { sellerCustomers: list }), <CustomerList />);
    expect(await screen.findByText("Andre Kusuma")).toBeTruthy();
    let answer!: (v: unknown) => void;
    list.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    const control = screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>;
    await act(async () => control.props.onRefresh?.());
    expect((screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>).props.refreshing).toBe(true);
    expect(screen.getByText("Andre Kusuma")).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
    await act(async () => answer({ customers: [customer, { ...customer, id: "c-02", name: "Dewi" }], total: 2, packages: [] }));
    expect(await screen.findByText("Dewi")).toBeTruthy();
    expect((screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<ReactNative.RefreshControlProps>).props.refreshing).toBe(false);
  });

  it("the shared skeletons keep their default shapes for every other screen", () => {
    // The customer shapes are opt-in (`shape="customer"`); the default DetailSkeleton and ListSkeleton are as they were.
    renderWith(
      runtimeWith(owner),
      withDapurScale(
        <>
          <DetailSkeleton label="Memuat laporan" />
          <ListSkeleton rows={3} chips={2} label="Memuat pembayaran" />
        </>,
      ),
    );
    const hidden = { includeHiddenElements: true };
    // DetailSkeleton: one Card of a heading, three text lines and the 48 action row; no key-value block or address well.
    expect(screen.queryAllByTestId(/^detail-skeleton-/, hidden)).toHaveLength(0);
    const detail = screen.getByLabelText("Memuat laporan");
    const card = drawnChildren(detail)[0];
    expect(drawnChildren(card).map((k) => stackHeight(k))).toEqual([28, 23, 23, 18, 48]);
    // ListSkeleton: one Card per row (name and two caption lines), not one ListCard of 64 rows; chips at 48 wrapping.
    expect(screen.queryAllByTestId("list-card", hidden)).toHaveLength(0);
    const rows = screen.queryAllByTestId(/^list-skeleton-row-/, hidden);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(flat(row).gap).toBe(8);
      expect(drawnChildren(row).map((k) => flat(k).height)).toEqual([14, 10, 10]);
    }
    const frame = screen.getByTestId("list-skeleton-chips", hidden);
    expect(flat(frame)).toMatchObject({ flexWrap: "wrap", gap: 8 });
    for (const chip of screen.queryAllByTestId(/^list-skeleton-chip-/, hidden)) expect(flat(chip).height).toBe(48);
  });

  it("a customer's page waits behind the customer skeleton under the name its link carried", async () => {
    renderWith(runtimeWith(owner, { sellerCustomers: jest.fn(never) }), withDapurScale(<CustomerDetail id="c-01" title="Andre Kusuma" />));
    expect(await screen.findByLabelText("Memuat pelanggan")).toBeTruthy();
    // The detail's shape, from the loaded layout: five 40 key-value rows in one card, the 50 action row and the 56
    // address well.
    const kv = screen.queryAllByTestId(/^detail-skeleton-kv-/, { includeHiddenElements: true });
    expect(kv).toHaveLength(5);
    for (const row of kv) expect(flat(row).height).toBe(40);
    expect(flat(screen.getByTestId("detail-skeleton-actions", { includeHiddenElements: true })).height).toBe(50);
    expect(flat(screen.getByTestId("detail-skeleton-address", { includeHiddenElements: true }))).toMatchObject({ height: 56, marginTop: 8 });
    expect(screen.queryByText("Memuat…")).toBeNull();
  });
});

describe("the other screens", () => {
  it("a report waits behind Memuat laporan, and a failed read keeps Coba lagi", async () => {
    const first = renderWith(runtimeWith(owner, { request: jest.fn(never) }), <ReportScreen id="i-1" />);
    expect(await screen.findByLabelText("Memuat laporan")).toBeTruthy();
    first.unmount();
    renderWith(runtimeWith(owner, { request: jest.fn(async () => Promise.reject(new Error("REQUEST_TIMEOUT"))) }), <ReportScreen id="i-1" />);
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
  });

  it("Usaha's package rows wait behind Memuat paket inside their card, under the live header", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never), request: jest.fn(async () => ({ active: null })) }), <UsahaScreen />);
    const header = await screen.findByTestId("usaha-header");
    expect(within(header).getByText("Usaha")).toBeTruthy();
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
    // The rest of the page stays live while the packages load: the settings gear and the Pengaturan row.
    expect(screen.getAllByRole("button", { name: "Pengaturan" })).toHaveLength(2);
    expect(screen.queryByText("Memuat…")).toBeNull();
  });

  it("Uang waits behind Memuat uang", async () => {
    renderWith(runtimeWith(owner, { settlement: jest.fn(never) }), <UangScreen />);
    expect(await screen.findByLabelText("Memuat uang")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
  });

  it("Aktifkan waits behind Memuat pembayaran", async () => {
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), <AktifkanScreen />);
    expect(await screen.findByLabelText("Memuat pembayaran")).toBeTruthy();
    expect(screen.queryByText("Memuat…")).toBeNull();
  });
});

describe("UangSkeleton", () => {
  const hidden = { includeHiddenElements: true } as const;

  it("draws the lead block, the seven 40 rows and the explanations from the loaded layout's constants, 24 apart", () => {
    renderWith(runtimeWith(owner), withDapurScale(<UangSkeleton />));
    expect(screen.getByLabelText("Memuat uang")).toBeTruthy();
    expect(flat(screen.getByTestId("uang-skeleton-sections", hidden)).gap).toBe(24);
    // The lead: a meta line (18), the figure's 40 line and a meta caption (18), the way the loaded lead stacks them.
    const lead = screen.getByTestId("uang-skeleton-lead", hidden);
    expect(drawnChildren(lead).map((k) => stackHeight(k))).toEqual([18, 40, 18]);
    // One list card of seven rows at the key-value row's 40, and nothing in them that a larger font could outgrow.
    const rows = screen.queryAllByTestId(/^uang-skeleton-row-/, hidden);
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      expect(flat(row).height).toBe(40);
      expect(textsIn(row)).toHaveLength(0);
    }
    expect(screen.getAllByTestId("list-card", hidden)).toHaveLength(1);
    // The explanations: meta lines at 18, 8 apart.
    const hints = screen.queryAllByTestId(/^uang-skeleton-hint-/, hidden);
    expect(hints).toHaveLength(7);
    for (const hint of hints) expect(stackHeight(hint)).toBe(18);
    expect(flat(screen.getByTestId("uang-skeleton-hints", hidden)).gap).toBe(8);
  });

  it("holds still under reduced motion and names the wait for screen readers", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    renderWith(runtimeWith(owner), withDapurScale(<UangSkeleton />));
    expect(skeletonNames()).toEqual(["Memuat uang"]);
  });
});

describe("package routes", () => {
  const params = { current: {} as Record<string, string> };
  beforeEach(() => {
    jest.spyOn(jest.requireMock("expo-router") as { useLocalSearchParams: () => unknown }, "useLocalSearchParams").mockImplementation(() => params.current);
  });

  it("an existing package waits behind Memuat paket and keeps its read error", async () => {
    params.current = { id: "p-1" };
    const Edit = (require("../app/(tabs)/(index,pelanggan,menu,usaha)/paket/[id]") as { default: () => ReactElement }).default;
    const first = renderWith(runtimeWith(owner, { sellerOperations: jest.fn(never) }), <Edit />);
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
    first.unmount();
    renderWith(runtimeWith(owner, { sellerOperations: jest.fn(async () => Promise.reject(Object.assign(new Error("x"), { code: "REQUEST_TIMEOUT" }))) }), <Edit />);
    await waitFor(() => expect(skeletonNames()).toEqual([]));
  });

  it("a copy of a package waits behind Memuat paket, and a package that is gone says so", async () => {
    params.current = { from: "p-404" };
    const New = (require("../app/(tabs)/(index,pelanggan,menu,usaha)/paket/baru") as { default: () => ReactElement }).default;
    const read = held<unknown>();
    renderWith(runtimeWith(owner, { sellerOperations: read.fn }), <New />);
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
    await act(async () => read.answer(menuOps()));
    expect(await screen.findByText("Paket ini tidak ditemukan.")).toBeTruthy();
    expect(skeletonNames()).toEqual([]);
  });
});

