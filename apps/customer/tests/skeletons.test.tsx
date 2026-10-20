import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeMotion, nativeThemes } from "@catera/design-tokens";
import * as SecureStore from "expo-secure-store";
import { FadeSwap, MoodProvider, SheetHeader, SkeletonGroup, ThemeProvider } from "@catera/mobile-ui";
import type { CustomerState } from "@catera/domain";
import { Beranda } from "../src/today/Beranda";
import { HERO_OVERLAP } from "../src/today/Plate";
import { Jadwal } from "../src/schedule/Jadwal";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { Masuk } from "../src/account/Masuk";
import { PaketSaya } from "../src/plan/PlanList";
import { customerLink } from "../src/links";
import { Addresses } from "../src/account/Addresses";
import { Akun } from "../src/account/Akun";
import { NotificationsScreen } from "../src/account/Notifications";
import { Payments } from "../src/account/Payments";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { ReportList } from "../src/help/ReportList";
import { ReportProblem } from "../src/help/ReportProblem";
import { ChooseMenu } from "../src/schedule/ChooseMenu";
import { ChangeDayRoute } from "../src/schedule/ChangeDaySheet";
import { DayScreen } from "../src/schedule/DayScreen";
import * as offline from "../src/today/offline";
import { PlanSkeleton } from "../src/skeletons";
import { customerState, offer } from "./fixtures";

/** Spec 2: each screen's data area waits as its own skeleton, or as the mascot when nothing can be shown yet. */

/** The route's params, per test (a screen opened from a link). */
let mockParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined, dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

// The jest environment reports a font scale of 2; the skeletons are measured for a 360dp phone at the default size.
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 800, scale: 3, fontScale: 1 }),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    usage: jest.fn(async () => undefined),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
/** Whether `node` sits somewhere inside `ancestor`. */
function inside(node: { parent: unknown }, ancestor: unknown) {
  for (let n = node.parent as { parent: unknown } | null; n; n = n.parent as { parent: unknown } | null)
    if (n === ancestor) return true;
  return false;
}

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
  // The module mocks are plain jest.fn()s, which restoreAllMocks does not reset: no copy is kept unless a test says so.
  (offline.loadCachedCustomer as jest.Mock).mockImplementation(async () => null);
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

describe("Beranda", () => {
  it("Beranda loading shows its skeleton under the live mood header", async () => {
    const runtime = runtimeWith({ customer: jest.fn(() => new Promise(() => undefined)) });
    renderWith(runtime, <Beranda />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const skeleton = screen.getByTestId("beranda-skeleton");
    const header = screen.getByTestId("mood-header");
    // The header is chrome and renders at once; only the data area waits, as one progress bar.
    // Laid out as the loaded header: the meal's opening line, the second headline line held by a skeleton line.
    expect(within(header).getByText(/^(Siang ini|Malam ini),$/)).toBeTruthy();
    expect(within(header).getByTestId("home-title-placeholder")).toBeTruthy();
    expect(inside(skeleton, header)).toBe(false);
    expect(inside(skeleton, screen.getByTestId("screen-body"))).toBe(true);
    expect(screen.getByRole("progressbar", { name: "Memuat beranda" })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    // Carried from Task 4: the skeleton hero rides over the header exactly as the loaded hero does, so the swap does
    // not jump. The header leaves the same 58 for it, and the skeleton lifts by the same 74 (58 plus the body's 16).
    expect(flat(header).paddingBottom).toBe(16 + 58);
    expect(flat(skeleton).marginTop).toBe(HERO_OVERLAP);
  });

  it("the loaded hero rides over the header by the same offset as its skeleton", async () => {
    renderWith(runtimeWith({ customer: jest.fn(async () => customerState({ status: "scheduled" })) }), <Beranda />);
    await screen.findByTestId("plate-hero");
    expect(flat(screen.getByTestId("mood-header")).paddingBottom).toBe(16 + 58);
    // The overlap belongs to the swapped data area, so the hero's own frame never sits outside its parent's bounds.
    const swap = screen.UNSAFE_getByType(FadeSwap);
    expect(flat(swap).marginTop).toBe(HERO_OVERLAP);
    expect(flat(screen.getByTestId("plate-hero")).marginTop ?? 0).toBe(0);
  });

  it("skeleton swaps to content in one FadeSwap, not per row", async () => {
    const read = deferred<CustomerState>();
    const runtime = runtimeWith({ customer: jest.fn(() => read.promise) });
    // Siang, so the mood fills' own easing (to 0) is never counted as a fade (to 1).
    renderAt(runtime, <Beranda />, SIANG);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const skeleton = screen.getByTestId("beranda-skeleton");
    const before = screen.UNSAFE_getAllByType(FadeSwap);
    expect(before).toHaveLength(1);
    expect(before[0].props.swapKey).toBe("loading");
    expect(inside(skeleton, before[0])).toBe(true);

    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => read.resolve(customerState({ status: "scheduled" })));
    const hero = await screen.findByTestId("plate-hero");
    const after = screen.UNSAFE_getAllByType(FadeSwap);
    // Still one wrapper, now holding the hero and every row below it: the page enters as one block.
    expect(after).toHaveLength(1);
    expect(after[0].props.swapKey).toBe("fresh");
    expect(inside(hero, after[0])).toBe(true);
    expect(inside(screen.getByTestId("upcoming-days"), after[0])).toBe(true);
    expect(screen.queryByTestId("beranda-skeleton")).toBeNull();
    // The same wrapper changed its key, so it faded once over `content`; nothing faded row by row.
    const fades = timing.mock.calls.filter(([to, config]) => to === 1 && config?.duration === nativeMotion.content);
    expect(fades).toHaveLength(1);
  });

  it("pull to refresh on Beranda keeps content on screen while it reloads", async () => {
    const read = jest.fn(async () => customerState({ status: "scheduled" }));
    renderWith(runtimeWith({ customer: read }), <Beranda />);
    await screen.findByTestId("plate-hero");
    const control = () => screen.getByTestId("screen-scroll").props.refreshControl;
    expect(control()).toBeTruthy();
    expect(control().props.refreshing).toBe(false);

    const next = deferred<CustomerState>();
    read.mockImplementationOnce(() => next.promise);
    await act(async () => void control().props.onRefresh());
    // While the fresh read is out the page stays as it was: no skeleton, no blank, the platform spinner on top.
    expect(read).toHaveBeenCalledTimes(2);
    expect(control().props.refreshing).toBe(true);
    expect(screen.getByTestId("plate-hero")).toBeTruthy();
    expect(screen.queryByTestId("beranda-skeleton")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Memperbarui…")).toBeNull();

    await act(async () => next.resolve(customerState({ status: "scheduled" })));
    await waitFor(() => expect(control().props.refreshing).toBe(false));
    expect(screen.getByTestId("plate-hero")).toBeTruthy();
  });
});

describe("Jadwal", () => {
  it("Jadwal loading draws skeleton cells inside the six-row frame", async () => {
    const runtime = runtimeWith({ customer: jest.fn(() => new Promise(() => undefined)) });
    renderWith(runtime, <Jadwal />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const header = screen.getByTestId("jadwal-header");
    const frame = within(header).getByTestId("month-frame");
    const wait = within(header).getByRole("progressbar", { name: "Memuat jadwal" });
    expect(inside(frame, wait)).toBe(true);
    const rows = within(frame).getAllByTestId("month-week");
    expect(rows).toHaveLength(6);
    for (const row of rows) expect(flat(row).height).toBe(52);
    // A cell for each day of this month, at the loaded cell's size, and no day drawn as if it were known.
    const cells = within(frame).getAllByTestId("jadwal-skeleton-cell");
    const now = new Date();
    const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    expect(cells.length).toBeGreaterThanOrEqual(28);
    expect(cells.length).toBeLessThanOrEqual(31);
    expect([days - 1, days, days + 1]).toContain(cells.length);
    for (const cell of cells) expect(flat(cell).height).toBe(52);
    expect(screen.queryByText("Memuat…")).toBeNull();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe("Bayar", () => {
  it("Payment while checking shows the mascot with Memeriksa pembayaran", async () => {
    renderWith(
      runtimeWith({ checkout: jest.fn(() => new Promise(() => undefined)), command: jest.fn(async () => ({})) }),
      <PaymentScreen checkoutId="ck-1" />,
    );
    const mascot = await screen.findByTestId("mascot-loading");
    expect(mascot.props.accessibilityLabel).toBe("Memeriksa pembayaran…");
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe("states", () => {
  const SIANG_NOW = () => new Date("2026-10-09T07:59:00Z"); // 14.59 WIB
  const MALAM_NOW = () => new Date("2026-10-09T08:00:00Z"); // 15.00 WIB
  function renderThemed(runtime: MobileRuntime, ui: React.ReactElement, scheme: "light" | "dark", now: () => Date) {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    return render(
      <ThemeProvider storageKey="skeleton-states">
        <MoodProvider now={now}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            {ui}
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
  }
  const pending = () => runtimeWith({ customer: jest.fn(() => new Promise(() => undefined)) });

  for (const scheme of ["light", "dark"] as const)
    for (const [mood, now] of [
      ["siang", SIANG_NOW],
      ["malam", MALAM_NOW],
    ] as const)
      it(`on the ${mood} header in ${scheme}, the skeleton blocks there read the mood's track and the page's read the theme`, async () => {
        const runtime = pending();
        renderThemed(runtime, <Jadwal />, scheme, now);
        await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
        for (const cell of screen.getAllByTestId("jadwal-skeleton-cell"))
          expect(flat(cell).backgroundColor).toBe(nativeMood[scheme][mood].arcTrack);
        screen.unmount();

        const home = pending();
        renderThemed(home, <Beranda />, scheme, now);
        await waitFor(() => expect(home.api.customer).toHaveBeenCalled());
        const blocks = screen
          .getByTestId("beranda-skeleton")
          .findAll((n) => typeof n.type === "string" && flat(n).height !== undefined && !!flat(n).backgroundColor)
          .map((n) => flat(n));
        // The hero's blocks sit on the hero card's own fill, so they read the hero's track (light Malam paints the hero
        // in the toggle track's colour, where a toggle-track block would vanish); the rows below read the theme.
        const hero = screen.getByTestId("beranda-skeleton-hero");
        expect(flat(within(hero).getByTestId("beranda-skeleton-hero-fill-siang")).backgroundColor).toBe(
          nativeMood[scheme].siang.hero,
        );
        expect(blocks.find((b) => b.height === 168)?.backgroundColor).toBe(nativeMood[scheme][mood].arcTrack);
        expect(nativeMood[scheme][mood].arcTrack).not.toBe(nativeMood[scheme][mood].hero);
        expect(blocks.find((b) => b.height === 54)?.backgroundColor).toBe(nativeThemes[scheme].sage);
      });

  it("under reduced motion the skeleton holds still: no pulse starts", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const repeat = jest.spyOn(Reanimated, "withRepeat");
    const runtime = pending();
    renderWith(runtime, <Beranda />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    expect(screen.getByRole("progressbar", { name: "Memuat beranda" })).toBeTruthy();
    expect(repeat).not.toHaveBeenCalled();
  });

  it("signed out shows the sign-in prompt, never a skeleton", async () => {
    const runtime = runtimeWith({ me: jest.fn(async () => ({ actor: null, demo: false })), customer: jest.fn() });
    renderWith(runtime, <Jadwal />);
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByTestId("jadwal-skeleton-cell")).toBeNull();
    expect(runtime.api.customer).not.toHaveBeenCalled();
  });

  it("a first read that fails keeps its message and Coba lagi, with no skeleton left behind", async () => {
    const runtime = runtimeWith({
      customer: jest.fn(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    });
    renderWith(runtime, <Beranda />);
    expect(await screen.findByTestId("home-error")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.queryByTestId("beranda-skeleton")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("a pull to refresh that fails keeps the page and says why under it", async () => {
    const read = jest.fn(async () => customerState({ status: "scheduled" }));
    renderWith(runtimeWith({ customer: read }), <Beranda />);
    await screen.findByTestId("plate-hero");
    read.mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
    await act(async () => void screen.getByTestId("screen-scroll").props.refreshControl.props.onRefresh());
    await waitFor(() => expect(screen.getByTestId("screen-scroll").props.refreshControl.props.refreshing).toBe(false));
    expect(screen.getByTestId("plate-hero")).toBeTruthy();
    expect(await screen.findByText("Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi.")).toBeTruthy();
  });

  it("the skeleton's fixed heights match the loaded page at the default text size, so a larger text only grows the page", async () => {
    const read = deferred<CustomerState>();
    const runtime = runtimeWith({ customer: jest.fn(() => read.promise) });
    renderWith(runtime, <Beranda />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const blocks = screen
      .getByTestId("beranda-skeleton")
      .findAll((n) => typeof n.type === "string" && typeof flat(n).height === "number")
      .map((n) => flat(n).height as number);
    // The hero photo and the 54 ring of a 60 row, in dp; they do not scale with text.
    expect(blocks).toContain(168);
    expect(blocks).toContain(54);
    await act(async () => read.resolve(customerState({ status: "scheduled" }, { past: [] })));
    expect(flat(await screen.findByTestId("plate-photo")).minHeight).toBe(168);
  });
});

describe("Masuk", () => {
  async function codeEntered(verify: () => Promise<never>) {
    const runtime = runtimeWith({ me: jest.fn(async () => ({ actor: null, demo: false })) });
    runtime.sendPhoneOtp = jest.fn(async () => undefined);
    runtime.verifyPhoneOtp = jest.fn(verify);
    renderWith(runtime, <Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    return runtime;
  }

  it("the OTP check keeps the code visible and busies Masuk", async () => {
    await codeEntered(() => new Promise(() => undefined));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Masuk" })));
    // The page stays the form: no mascot screen, the typed code still on it, and the button is the busy one.
    expect(screen.queryByTestId("mascot-loading")).toBeNull();
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("123456");
    expect(screen.getByRole("button", { name: "Masuk" }).props.accessibilityState.busy).toBe(true);
    // A second press while it waits sends nothing more.
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it("a code that does not match comes back to the form with what was typed and its message", async () => {
    await codeEntered(async () => {
      throw Object.assign(new Error("INVALID_OTP"), { code: "INVALID_OTP" });
    });
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Masuk" })));
    expect(await screen.findByText("Kode belum cocok. Periksa SMS lalu coba lagi.")).toBeTruthy();
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("123456");
    expect(screen.queryByTestId("mascot-loading")).toBeNull();
  });
});

describe("pull to refresh", () => {
  async function pullKeeps(ui: React.ReactElement, shown: string) {
    const read = jest.fn(async () => customerState({ status: "scheduled" }));
    renderWith(runtimeWith({ customer: read }), ui);
    await screen.findByTestId(shown);
    const control = () => screen.getByTestId("screen-scroll").props.refreshControl;
    const next = deferred<CustomerState>();
    read.mockImplementationOnce(() => next.promise);
    await act(async () => void control().props.onRefresh());
    expect(control().props.refreshing).toBe(true);
    expect(screen.getByTestId(shown)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    await act(async () => next.resolve(customerState({ status: "scheduled" })));
    await waitFor(() => expect(control().props.refreshing).toBe(false));
    expect(read).toHaveBeenCalledTimes(2);
  }

  it("pull to refresh on Jadwal keeps the month on screen while it reloads", async () => {
    await pullKeeps(<Jadwal />, "month-grid");
  });

  it("pull to refresh on Paket saya keeps the plans on screen while it reloads", async () => {
    await pullKeeps(<PaketSaya />, "plan-row-list");
  });

  it("no pull to refresh before there is anything to refresh", async () => {
    renderWith(runtimeWith({ customer: jest.fn(() => new Promise(() => undefined)) }), <PaketSaya />);
    await screen.findByRole("progressbar", { name: "Memuat paket" });
    expect(screen.getByTestId("screen-scroll").props.refreshControl).toBeUndefined();
  });
});

/* Fix round 1 (review findings 1 to 11, with the controller's rulings). */

const SIANG = () => new Date("2026-10-09T07:59:00Z"); // 14.59 WIB
const MALAM = () => new Date("2026-10-09T08:00:00Z"); // 15.00 WIB
function renderAt(runtime: MobileRuntime, ui: React.ReactElement, now: () => Date) {
  return render(
    <ThemeProvider storageKey="skeleton-fix">
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {ui}
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}
const num = (v: unknown) => v as number;

/**
 * Beranda's header height at font scale 1.0, summed from its fixed parts. Jest lays nothing out, so this adds up what
 * the header is built from: its two paddings, the 48 top row, the headline's lines (each at the title's 39), the day
 * arc (the tab's top inset, the 50 marker, the 16 title line and the 15 detail line) and the 12 gaps between them. Two
 * headers with the same sum and the same parts are laid out at the same height at 360dp, where each line fits.
 */
function headerHeight(header: ReturnType<typeof screen.getByTestId>) {
  const box = flat(header);
  const content = within(header).getByTestId("mood-header-content");
  const row = flat(within(header).getByTestId("mood-header-row"));
  const loaded = within(header).queryByTestId("home-title");
  let title: number;
  if (loaded) title = num(flat(loaded).lineHeight) * String(loaded.props.children).split("\n").length;
  else {
    const loading = within(header).getByTestId("home-title-loading");
    const first = within(loading).getByText(/ini,$/);
    title =
      num(flat(first).lineHeight) * String(first.props.children).split("\n").length +
      num(flat(within(loading).getByTestId("home-title-placeholder")).height);
  }
  const arc = within(header).getByTestId("mood-arc");
  const details = (["siang", "malam"] as const).map((m) => {
    const d = flat(within(arc).getByTestId(`mood-arc-detail-${m}`));
    return num(d.height ?? d.lineHeight);
  });
  const arcHeight =
    num(flat(within(arc).getByTestId("mood-arc-tab-siang")).paddingTop) +
    num(flat(within(arc).getByTestId("mood-arc-marker-siang")).height) +
    num(flat(within(arc).getByTestId("mood-arc-title-siang")).lineHeight) +
    Math.max(...details);
  const parts = [num(row.minHeight), title, arcHeight];
  return {
    height:
      num(box.paddingTop) +
      num(box.paddingBottom) +
      parts.reduce((a, b) => a + b, 0) +
      num(flat(content).gap) * (parts.length - 1),
    parts,
    // The details hold one line each: a detail line taller than 15 would grow the arc.
    details,
  };
}

describe("finding 1: Beranda's header keeps its height when the page lands", () => {
  for (const [mood, now, meal] of [
    ["Siang", SIANG, "lunch"],
    ["Malam", MALAM, "dinner"],
  ] as const)
    it(`in ${mood}, the loading header is laid out as the loaded one: meta row, two headline lines, the arc`, async () => {
      const read = deferred<CustomerState>();
      const runtime = runtimeWith({ customer: jest.fn(() => read.promise) });
      renderAt(runtime, <Beranda />, now);
      await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
      const before = headerHeight(screen.getByTestId("mood-header"));
      // The arc is drawn while it loads, each end's detail line held by a skeleton line of its own height.
      expect(before.details).toEqual([15, 15]);
      expect(screen.getByTestId("mood-arc-tab-siang").props.accessibilityLabel).toBe("Makan siang");
      expect(screen.getByTestId("home-meta")).toBeTruthy();

      await act(async () => read.resolve(customerState({ status: "scheduled", meal })));
      await screen.findByTestId("plate-hero");
      const after = headerHeight(screen.getByTestId("mood-header"));
      expect(after.parts).toEqual(before.parts);
      expect(after.height).toBe(before.height);
      // Two headline lines in both, at the title's 39.
      expect(before.parts[1]).toBe(78);
    });
});

describe("finding 2 and 9: a kept copy refreshes in place", () => {
  it("Memperbarui joins the date in the meta row, so the header keeps its height, and the fresh read fades in once", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: "2026-10-09T02:00:00.000Z",
      data: customerState({ status: "scheduled" }),
    } as never);
    const fresh = deferred<CustomerState>();
    renderAt(runtimeWith({ customer: jest.fn(() => fresh.promise) }), <Beranda />, SIANG);
    const word = await screen.findByText("Memperbarui…");
    const row = screen.getByTestId("mood-header-row");
    expect(inside(word, row)).toBe(true);
    // The meta row is 48 whatever it holds; its label lines are 18, so even a wrapped date and word fit in it.
    expect(flat(row).minHeight).toBe(48);
    expect(flat(within(row).getByText(/·$/)).lineHeight).toBe(18);
    const before = headerHeight(screen.getByTestId("mood-header"));
    expect(screen.UNSAFE_getByType(FadeSwap).props.swapKey).toBe("kept");

    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => fresh.resolve(customerState({ status: "scheduled" })));
    await waitFor(() => expect(screen.queryByText("Memperbarui…")).toBeNull());
    expect(headerHeight(screen.getByTestId("mood-header"))).toEqual(before);
    // Finding 9: the kept copy and the fresh read are keyed apart, so the fresh page fades in once.
    expect(screen.UNSAFE_getByType(FadeSwap).props.swapKey).toBe("fresh");
    expect(timing.mock.calls.filter(([to, c]) => to === 1 && c?.duration === nativeMotion.content)).toHaveLength(1);
  });
});

describe("finding 4: nothing running", () => {
  const nothing: CustomerState = { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] };

  it("the packages are read with the home read: one skeleton, then one fade into the invitation", async () => {
    const home = deferred<CustomerState>();
    const packages = deferred<{ items: unknown[]; nextCursor: null }>();
    const runtime = runtimeWith({ customer: jest.fn(() => home.promise), catalog: jest.fn(() => packages.promise) });
    // Siang, so the mood fills' own easing (to 0) is never counted as a fade (to 1).
    renderAt(runtime, <Beranda />, SIANG);
    // Both reads start together.
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    expect(runtime.api.catalog).toHaveBeenCalledWith("?limit=3");
    const timing = jest.spyOn(Reanimated, "withTiming");
    const fades = () => timing.mock.calls.filter(([to, c]) => to === 1 && c?.duration === nativeMotion.content);

    await act(async () => home.resolve(nothing));
    // The home read says nothing runs, but the packages are not in yet: still the one skeleton, no second loader.
    expect(screen.getByTestId("beranda-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("offers-skeleton")).toBeNull();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(fades()).toHaveLength(0);

    await act(async () =>
      packages.resolve({ items: [offer({ id: "p-a", name: "Makan Siang Rumahan" })], nextCursor: null }),
    );
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("Mau makan apa minggu ini?")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    // One swap of the page's own FadeSwap; the packages arrive inside it, not in a fade of their own.
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("empty");
    expect(fades()).toHaveLength(1);
    expect(runtime.api.catalog).toHaveBeenCalledTimes(1);
  });

  it("a customer with a running plan never waits on the packages", async () => {
    const packages = deferred<{ items: unknown[]; nextCursor: null }>();
    const runtime = runtimeWith({
      customer: jest.fn(async () => customerState({ status: "scheduled" })),
      catalog: jest.fn(() => packages.promise),
    });
    renderWith(runtime, <Beranda />);
    expect(await screen.findByTestId("plate-hero")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("finding 3: Bayar while the payment is checked", () => {
  it("the mascot waits at the top, the instructions stay under it, and its words are not repeated", async () => {
    const later = new Date(Date.now() + 15 * 60_000).toISOString();
    const quote = { packageId: "p-rumahan", portions: 1, cycles: 1, trial: false, total: 562500, offer: offer() };
    const checkout = {
      id: "ck-1",
      state: "pending",
      expires_at: later,
      subscription_id: null,
      payment_url: null,
      quote,
      payment: {
        mode: "direct",
        availableMethods: ["QRIS"],
        selectedMethod: "QRIS",
        status: "checking",
        expiresAt: later,
        instructions: null,
      },
    };
    renderWith(
      runtimeWith({ checkout: jest.fn(async () => checkout), command: jest.fn(async () => ({})) }),
      <PaymentScreen checkoutId="ck-1" />,
    );
    const rule = await screen.findByText("Jangan bayar lagi. Kami sedang mengecek statusnya.");
    const mascot = screen.getByRole("progressbar", { name: "Memeriksa pembayaran…" });
    // Document order: the mascot first, then the instruction, then Cek status.
    const order: string[] = [];
    (function walk(n: unknown) {
      if (typeof n !== "object" || n === null) return;
      const node = n as { props?: Record<string, unknown>; children: unknown[] };
      if (n === mascot) order.push("mascot");
      if (n === rule) order.push("rule");
      if (node.props?.accessibilityRole === "button" && typeof node.props?.accessibilityLabel === "string")
        order.push(node.props.accessibilityLabel);
      node.children.forEach(walk);
    })(screen.root);
    const at = (k: string) => order.indexOf(k);
    expect(at("mascot")).toBeGreaterThanOrEqual(0);
    expect(at("mascot")).toBeLessThan(at("rule"));
    expect(at("rule")).toBeLessThan(at("Cek status"));
    expect(screen.getByRole("button", { name: "Bantuan pembayaran" })).toBeTruthy();
    // The mascot is the stage's title: the old heading is not drawn under it as well.
    expect(screen.queryByText("Memeriksa pembayaran")).toBeNull();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe("finding 5: every screen's first read waits as its own skeleton", () => {
  const pending = () => new Promise<never>(() => undefined);
  const cases: [string, () => React.ReactElement, string, Record<string, unknown>, Record<string, string>][] = [
    ["Alamat", () => <Addresses />, "Memuat alamat", {}, {}],
    ["Riwayat pembayaran", () => <Payments />, "Memuat riwayat", {}, {}],
    ["Notifikasi", () => <NotificationsScreen />, "Memuat notifikasi", {}, {}],
    ["Bantuan", () => <ReportList />, "Memuat laporan", { request: jest.fn(pending) }, {}],
    ["Ada masalah", () => <ReportProblem />, "Memuat pengantaran", {}, { id: "d-today" }],
    ["Hari", () => <DayScreen />, "Memuat pengantaran", {}, { id: "d-today" }],
    ["Pilih menu", () => <ChooseMenu />, "Memuat menu", {}, { id: "s-1" }],
  ];
  for (const [name, ui, label, api, params] of cases)
    it(`${name} loading names its wait (${label}) with no spinner`, async () => {
      mockParams = params;
      const runtime = runtimeWith({ customer: jest.fn(pending), ...api });
      renderWith(runtime, ui());
      // Past the session check: the screen's own read is out.
      await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
      expect(await screen.findByRole("progressbar", { name: label })).toBeTruthy();
      expect(screen.getAllByRole("progressbar")).toHaveLength(1);
      expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    });

  it("Akun before the session is known names its wait and holds the contact line (finding 10)", async () => {
    renderWith(runtimeWith({ me: jest.fn(pending), customer: jest.fn(pending) }), <Akun />);
    expect(await screen.findByRole("progressbar", { name: "Memuat akun" })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    // The line under the name is reserved at the body line's 23, as the loaded header keeps it.
    const header = screen.getByTestId("mood-header");
    expect(flat(within(header).getByTestId("akun-contact")).minHeight).toBe(23);
  });

  it("Akun keeps the contact line's height once the account is known (finding 10)", async () => {
    renderWith(runtimeWith({ customer: jest.fn(pending) }), <Akun />);
    await screen.findByText("Rani Contoh");
    const header = screen.getByTestId("akun-header");
    expect(flat(within(header).getByTestId("akun-contact")).minHeight).toBe(23);
  });

  it("Jelajah's area waits inside a skeleton group, breathing with the list (finding 11)", async () => {
    const store = SecureStore.getItemAsync as jest.Mock;
    const real = store.getMockImplementation()!;
    store.mockImplementation((k: string) => (k === "catera.area" ? pending() : real(k)));
    try {
      renderWith(runtimeWith({}), <Jelajah />);
      await jelajahAreaWaits();
    } finally {
      store.mockImplementation(real);
    }
  });

  async function jelajahAreaWaits() {
    const area = await screen.findByTestId("jelajah-area-skeleton");
    expect(screen.UNSAFE_getAllByType(SkeletonGroup).some((g) => inside(area, g))).toBe(true);
    // One progress bar for the one wait: the list's.
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(screen.getByRole("progressbar", { name: "Memuat paket" })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  }
});

describe("findings 6 to 8: the swap and the skeleton's frame", () => {
  /** The page's first FadeSwap goes from `loading` to `ready` on the same instance, so it fades in. */
  async function fadesIn(
    ui: React.ReactElement,
    api: Record<string, jest.Mock>,
    read: string,
    resolve: () => void,
    landed: () => Promise<unknown>,
  ) {
    renderWith(runtimeWith(api), ui);
    // Past the session check: the screen's own read is out.
    await waitFor(() => expect(api[read]).toHaveBeenCalled());
    await waitFor(() => expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("loading"));
    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => resolve());
    await landed();
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("ready");
    expect(timing.mock.calls.filter(([to, c]) => to === 1 && c?.duration === nativeMotion.content)).not.toHaveLength(0);
    expect(screen.queryByRole("progressbar")).toBeNull();
  }

  it("Paket fades from its skeleton into the photo page", async () => {
    mockParams = { id: "p-rumahan" };
    const read = deferred<{ offer: unknown }>();
    await fadesIn(
      <PackageDetail />,
      { offer: jest.fn(() => read.promise), request: jest.fn(async () => []) },
      "offer",
      () => read.resolve({ offer: offer() }),
      () => screen.findByTestId("paket-name"),
    );
    // The block starts at the body's top and carries its padding, so the photo's pull stays inside it.
    const swap = flat(screen.UNSAFE_getAllByType(FadeSwap)[0]);
    expect([swap.marginTop, swap.paddingTop]).toEqual([-16, 16]);
  });

  it("Paket's photo and its heart sit inside the fading block, edge to edge (fix round 2, N1)", async () => {
    mockParams = { id: "p-rumahan" };
    renderWith(
      runtimeWith({ offer: jest.fn(async () => ({ offer: offer() })), request: jest.fn(async () => []) }),
      <PackageDetail />,
    );
    await screen.findByTestId("paket-name");
    const node = screen.UNSAFE_getAllByType(FadeSwap)[0];
    const swap = flat(node);
    // The block covers the body's whole box: its top and both sides, the body's 16 and 20 carried as padding.
    expect([swap.marginTop, swap.paddingTop, swap.marginHorizontal, swap.paddingHorizontal]).toEqual([-16, 16, -20, 20]);
    // The photo is pulled out by exactly that padding, so its edges are the block's own edges, and the heart on it
    // (16 from the photo's right) is inside the block, where Android delivers its touches.
    // The photo: the block's child with its own height and the -20 pull (the block's own view has no height).
    const photo = node.findAll(
      (n) => typeof n.type === "string" && flat(n)?.marginHorizontal === -20 && typeof flat(n)?.height === "number",
    )[0];
    expect([flat(photo).marginHorizontal, flat(photo).marginTop]).toEqual([
      -(swap.paddingHorizontal as number),
      -(swap.paddingTop as number),
    ]);
    // Found from the whole screen, so being inside the photo and the block is a fact about the tree, not the query.
    const heart = screen.getByRole("button", { name: /Simpan/ });
    expect(inside(heart, photo)).toBe(true);
    expect(inside(heart, node)).toBe(true);
  });

  it("Pilih menu fades from its skeleton into the page", async () => {
    mockParams = { id: "s-1" };
    const read = deferred<CustomerState>();
    await fadesIn(
      <ChooseMenu />,
      { customer: jest.fn(() => read.promise) },
      "customer",
      () => read.resolve(customerState(null)),
      () => screen.findByText("Makan Siang Rumahan"),
    );
  });

  it("Ada masalah fades from its skeleton into the form", async () => {
    mockParams = { id: "d-today" };
    const read = deferred<CustomerState>();
    await fadesIn(
      <ReportProblem />,
      { customer: jest.fn(() => read.promise) },
      "customer",
      () => read.resolve(customerState({ status: "delivered" })),
      () => screen.findByText("Apa yang terjadi?"),
    );
  });

  it("Jadwal's day panel fades in with the month instead of appearing at once", async () => {
    const read = deferred<CustomerState>();
    renderWith(runtimeWith({ customer: jest.fn(() => read.promise) }), <Jadwal />);
    await waitFor(() => expect(screen.getAllByTestId("jadwal-skeleton-cell").length).toBeGreaterThan(0));
    const panel = () => screen.UNSAFE_getAllByType(FadeSwap).find((f) => inside(f, screen.getByTestId("screen-body")))!;
    expect(panel().props.swapKey).toBe("loading");
    await act(async () => read.resolve(customerState({ status: "scheduled" })));
    await screen.findByTestId("month-grid");
    expect(panel().props.swapKey).toBe("ready");
  });

  it("the plan's skeleton has the kitchen line and the hero card of the loaded plan (finding 7)", () => {
    renderWith(runtimeWith({}), <PlanSkeleton />);
    const caterer = flat(screen.getByTestId("plan-skeleton-caterer"));
    expect([caterer.height, caterer.marginTop]).toEqual([23, -8]);
    const hero = screen.getByTestId("plan-skeleton-hero");
    expect([flat(hero).padding, flat(hero).borderRadius]).toEqual([10, 28]);
    expect(within(hero).getByTestId("plan-skeleton-hero-fill-siang")).toBeTruthy();
  });

  it("the Beranda skeleton's hero is the loaded hero's card, fill and shadow (finding 8)", async () => {
    const runtime = runtimeWith({ customer: jest.fn(() => new Promise(() => undefined)) });
    renderWith(runtime, <Beranda />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const hero = screen.getByTestId("beranda-skeleton-hero");
    expect([flat(hero).padding, flat(hero).borderRadius]).toEqual([10, 28]);
    expect(flat(within(hero).getByTestId("beranda-skeleton-hero-fill-siang")).boxShadow).toBeTruthy();
  });
});

/* Fix round 2 (re-review N2 and N3; N1 sits with the Paket fade tests above). */

describe("fix round 2", () => {
  const contentFades = (timing: jest.SpyInstance) =>
    timing.mock.calls.filter(([to, c]) => to === 1 && c?.duration === nativeMotion.content);

  it("Bayar keeps one mascot from the first read into the checking stage: no remount, no fade (N2)", async () => {
    const later = new Date(Date.now() + 15 * 60_000).toISOString();
    const checking = {
      id: "ck-1",
      state: "pending",
      expires_at: later,
      subscription_id: null,
      payment_url: null,
      quote: { packageId: "p-rumahan", portions: 1, cycles: 1, trial: false, total: 562500, offer: offer() },
      payment: {
        mode: "direct",
        availableMethods: ["QRIS"],
        selectedMethod: "QRIS",
        status: "checking",
        expiresAt: later,
        instructions: null,
      },
    };
    const read = deferred<unknown>();
    renderWith(
      runtimeWith({ checkout: jest.fn(() => read.promise), command: jest.fn(async () => ({})) }),
      <PaymentScreen checkoutId="ck-1" />,
    );
    const visual = () => screen.getByTestId("mascot-loading-visual", { includeHiddenElements: true });
    // The first read's mascot has drawn itself (after its 300ms entry delay).
    await waitFor(() => expect(flat(visual()).opacity).toBe(1), { timeout: 2000 });
    const before = screen.getByTestId("mascot-loading");
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("checking");

    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => read.resolve(checking));
    await screen.findByText("Jangan bayar lagi. Kami sedang mengecek statusnya.");
    // The same mascot is still drawn: a new one would hide for its 300ms entry delay, and a fade would blank it.
    expect(screen.getByTestId("mascot-loading")).toBe(before);
    expect(flat(visual()).opacity).toBe(1);
    expect(screen.getAllByTestId("mascot-loading")).toHaveLength(1);
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("checking");
    expect(contentFades(timing)).toHaveLength(0);
  });

  it("a loaded Beranda that a reload empties goes to the invitation in one fade, never back to the skeleton (N3)", async () => {
    const nothing: CustomerState = { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] };
    let mobile!: ReturnType<typeof useMobile>;
    function Probe() {
      mobile = useMobile();
      return null;
    }
    const customer = jest.fn(async () => customerState({ status: "scheduled" }));
    const catalog = jest.fn(async () => ({ items: [offer({ id: "p-a", name: "Makan Siang Rumahan" })], nextCursor: null }));
    renderAt(
      runtimeWith({ customer, catalog, command: jest.fn(async () => ({})) }),
      <>
        <Beranda />
        <Probe />
      </>,
      SIANG,
    );
    await screen.findByTestId("plate-hero");
    await waitFor(() => expect(catalog).toHaveBeenCalledTimes(1));

    // The last plan ends: a command bumps the revision, every read runs again, and the home read comes back empty.
    customer.mockImplementation(async () => nothing);
    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => {
      await mobile.command("subscription.cancel", { id: "s-1" });
    });
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("Mau makan apa minggu ini?")).toBeTruthy();
    expect(screen.queryByTestId("beranda-skeleton")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("empty");
    // One fade, fresh page to invitation; through the skeleton it would be two (to loading, then to empty).
    expect(contentFades(timing)).toHaveLength(1);
    // The packages read with the first load were kept, so none was read again.
    expect(catalog).toHaveBeenCalledTimes(1);
  });
});

/* Rebase fix (Task 9's Ada masalah sheet): the header holds the day's line, and the sign-in prompt fades in. */

describe("Ada masalah sheet after the rebase", () => {
  /** The header's fixed parts: the title's line and the context line's height (held, or the one-line text). */
  function sheetHeader() {
    const title = screen.getByRole("header", { name: "Ada masalah" });
    const context = screen.getByTestId("sheet-context");
    const line = flat(context);
    return {
      title: flat(title).lineHeight,
      context: (line.height ?? line.lineHeight) as number,
      lines: context.props.numberOfLines ?? 1,
    };
  }

  it("the header keeps its fixed parts from loading to ready: the day's line is held, then one line (A)", async () => {
    mockParams = { id: "d-today" };
    const read = deferred<CustomerState>();
    const runtime = runtimeWith({ customer: jest.fn(() => read.promise) });
    renderWith(runtime, <ReportProblem />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const loading = sheetHeader();
    expect(loading.context).toBe(20);
    // The held line is a skeleton breathing with the body's; the body's group alone names the wait.
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);

    await act(async () => read.resolve(customerState({ status: "delivered" })));
    await screen.findByText("Apa yang terjadi?");
    const ready = sheetHeader();
    expect(ready).toEqual(loading);
    // One line on screen; the whole day, package and kitchen for screen readers.
    const context = screen.getByTestId("sheet-context");
    expect(context.props.numberOfLines).toBe(1);
    expect(context.props.accessibilityLabel).toBe(context.props.children);
    expect(String(context.props.children)).toContain(" · ");
  });

  it("Ubah hari holds its context line too: the header keeps its fixed parts while the day is read", async () => {
    // After v2's SheetHeader, a null context draws nothing unless the sheet holds the line.
    mockParams = { id: "d-today" };
    const read = deferred<CustomerState>();
    const runtime = runtimeWith({ customer: jest.fn(() => read.promise) });
    renderWith(runtime, <ChangeDayRoute />);
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const held = screen.getByTestId("sheet-context");
    expect(flat(held).height).toBe(20);
    const title = flat(screen.getByRole("header", { name: "Ubah hari" })).lineHeight;

    await act(async () => read.resolve(customerState({ status: "scheduled" })));
    const context = await screen.findByText(/ · /);
    expect(context.props.testID).toBe("sheet-context");
    expect(flat(context).lineHeight).toBe(20);
    expect(context.props.numberOfLines).toBe(1);
    expect(context.props.accessibilityLabel).toBe(context.props.children);
    expect(flat(screen.getAllByRole("header")[0]).lineHeight).toBe(title);
  });

  it("a held context stays one line on iOS too, read out in full", () => {
    const long = "Besok, Sen 12 Okt · Makan Siang Rumahan Sehat Bergizi · Dapur Ibu Sari Jakarta Selatan";
    renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context={long} holdContextLine os="ios" />);
    const context = screen.getByTestId("sheet-context");
    expect(context.props.numberOfLines).toBe(1);
    expect(context.props.accessibilityLabel).toBe(long);
    expect(flat(context).lineHeight).toBe(20);
  });

  it("a held context is not selectable (a selectable TextView on Android does not ellipsize), a plain one is", () => {
    const view = renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context="Besok · Makan" holdContextLine os="android" />);
    expect(screen.getByTestId("sheet-context").props.selectable).toBe(false);
    view.unmount();
    renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context="Besok · Makan" os="android" />);
    expect(screen.getByTestId("sheet-context").props.selectable).toBe(true);
  });

  it("a held null context keeps the line's 20 with a skeleton, on both platforms", () => {
    for (const os of ["ios", "android"]) {
      const view = renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context={null} holdContextLine os={os} />);
      expect(flat(screen.getByTestId("sheet-context")).height).toBe(20);
      // A skeleton line, unnamed: the sheet body's own group names the wait.
      expect(screen.UNSAFE_getAllByType(SkeletonGroup)).toHaveLength(1);
      expect(screen.queryByRole("progressbar")).toBeNull();
      view.unmount();
    }
  });

  it("by default a long context wraps with a larger font, and a null context draws no line", () => {
    const long = "Besok, Sen 12 Okt · Makan Siang Rumahan Sehat Bergizi · Dapur Ibu Sari Jakarta Selatan";
    for (const os of ["ios", "android"]) {
      const view = renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context={long} os={os} />);
      const context = screen.getByTestId("sheet-context");
      expect(context.props.numberOfLines).toBeUndefined();
      expect(context.props.accessibilityLabel).toBeUndefined();
      expect(flat(context).height).toBeUndefined();
      expect(String(context.props.children)).toBe(long);
      view.unmount();
    }
    renderWith(runtimeWith({}), <SheetHeader title="Ada masalah" context={null} os="android" />);
    expect(screen.queryByTestId("sheet-context")).toBeNull();
    expect(screen.UNSAFE_queryAllByType(SkeletonGroup)).toHaveLength(0);
  });

  it("signed out, the sign-in prompt fades in from the skeleton through the same FadeSwap (B)", async () => {
    mockParams = { id: "d-today" };
    const me = deferred<{ actor: null; demo: boolean }>();
    const runtime = runtimeWith({ me: jest.fn(() => me.promise), customer: jest.fn() });
    renderAt(runtime, <ReportProblem />, SIANG);
    await waitFor(() => expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("loading"));
    expect(screen.getByRole("progressbar", { name: "Memuat pengantaran" })).toBeTruthy();
    const timing = jest.spyOn(Reanimated, "withTiming");
    await act(async () => me.resolve({ actor: null, demo: false }));
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(FadeSwap)[0].props.swapKey).toBe("signin");
    // The same FadeSwap changed its key, so it faded once; a new sheet would have cut in with no fade.
    expect(timing.mock.calls.filter(([to, c]) => to === 1 && c?.duration === nativeMotion.content)).toHaveLength(1);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(runtime.api.customer).not.toHaveBeenCalled();
  });
});
