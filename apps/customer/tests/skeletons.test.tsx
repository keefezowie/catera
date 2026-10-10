import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeMotion, nativeThemes } from "@catera/design-tokens";
import { FadeSwap, MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import type { CustomerState } from "@catera/domain";
import { Beranda } from "../src/today/Beranda";
import { HERO_OVERLAP } from "../src/today/Plate";
import { Jadwal } from "../src/schedule/Jadwal";
import { PaymentScreen } from "../src/buy/PaymentScreen";
import { Masuk } from "../src/account/Masuk";
import { PaketSaya } from "../src/plan/PlanList";
import { customerLink } from "../src/links";
import { customerState } from "./fixtures";

/** Spec 2: each screen's data area waits as its own skeleton, or as the mascot when nothing can be shown yet. */

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined }),
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
  jest.clearAllMocks();
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
    expect(within(header).getByText("Beranda")).toBeTruthy();
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
    renderWith(runtime, <Beranda />);
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
    expect(after[0].props.swapKey).toBe("ready");
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
          expect(flat(cell).backgroundColor).toBe(nativeMood[scheme][mood].toggleTrack);
        screen.unmount();

        const home = pending();
        renderThemed(home, <Beranda />, scheme, now);
        await waitFor(() => expect(home.api.customer).toHaveBeenCalled());
        const blocks = screen
          .getByTestId("beranda-skeleton")
          .findAll((n) => typeof n.type === "string" && flat(n).height !== undefined && !!flat(n).backgroundColor)
          .map((n) => flat(n));
        // The hero's photo rides on the header, so it reads the mood track; the rows below sit on the theme canvas.
        expect(blocks.find((b) => b.height === 168)?.backgroundColor).toBe(nativeMood[scheme][mood].toggleTrack);
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
    expect(await screen.findByText("Koneksi terlalu lama. Periksa koneksi dan coba lagi.")).toBeTruthy();
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

  it("while the SMS code is checked, the page is the mascot with Memeriksa kode", async () => {
    await codeEntered(() => new Promise(() => undefined));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Masuk" })));
    expect(screen.getByTestId("mascot-loading").props.accessibilityLabel).toBe("Memeriksa kode…");
    expect(screen.queryByLabelText("Kode dari SMS")).toBeNull();
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
