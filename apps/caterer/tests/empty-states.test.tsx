import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { RefreshControl, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider, type MascotPose } from "@catera/mobile-ui";
import type { SellerOperationsState } from "@catera/domain";
import { ScreenGuard } from "../src/ErrorBoundary";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { UangScreen } from "../src/business/UangScreen";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { CustomerList } from "../src/customers/CustomerList";
import { MenuWeek } from "../src/menu/MenuWeek";
import { ReportScreen } from "../src/today/ReportScreen";
import { TodayScreen } from "../src/today/TodayScreen";
import { canvasDay } from "./fixtures";
import { withDapurScale } from "./dapur-scale";

/**
 * Spec 7.2, Task 13: Dapur's empty, done and failed states show their delivered mascot still, 88pt and centred above
 * their title (72 on a 360dp phone at font scale 1.3), decorative for screen readers; the cooking session shows the
 * cooking mascot at 72 beside the count card's numbers. The state's own copy and action are unchanged.
 */

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, [effect]),
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

/** The phone the state is drawn on: a 411dp phone at the default text size unless a test says otherwise. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

// Thursday 8 Oct 2026, 10.00 Jakarta (Siang). Only the clock is pinned: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
const TODAY = "2026-10-08";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
/** Mascot art is hidden from screen readers, so the queries that look for it opt in to hidden elements. */
const hidden = { includeHiddenElements: true };
const POSES: MascotPose[] = ["merayakan", "membaca", "tidur", "bingung", "melambai", "mencari", "memasak"];
const offline = () => Promise.reject(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
const secureStore = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;

/** The canvas day on today's date, every row of `meal` in `status`. */
function day(status: string, meal: "lunch" | "dinner" = "lunch"): SellerOperationsState {
  const ops = canvasDay();
  ops.operationalDate = TODAY;
  ops.today = TODAY;
  ops.deliveries = ops.deliveries.map(
    (d) =>
      ({
        ...d,
        service_date: TODAY,
        status: status === "preparing" ? "scheduled" : status,
        meals: [
          {
            meal,
            status,
            cooking_started_at: status === "preparing" ? "2026-10-08T01:10:00Z" : null,
          },
        ],
      }) as typeof d,
  );
  return ops;
}

type Api = Partial<Record<keyof MobileRuntime["api"], jest.Mock>>;
function runtimeWith(api: Api = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "es", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(async () => day("scheduled")),
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

const wrap = (runtime: MobileRuntime, ui: ReactElement) => (
  <ThemeProvider storageKey="es.theme">
    <MoodProvider now={() => NOW}>
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        {ui}
      </MobileProvider>
    </MoodProvider>
  </ThemeProvider>
);

/** A screen whose render throws, for the guard. */
function Broken(): ReactElement {
  throw new Error("a bad value");
}

type State = {
  name: string;
  pose: MascotPose;
  runtime: () => MobileRuntime;
  ui: ReactElement;
  copy: (string | RegExp)[];
  action?: string | RegExp;
};

/** A kitchen whose published packages all cook Monday to Wednesday: Thursday 8 Oct is its day off. */
function restDay(): SellerOperationsState {
  const ops = { ...day("scheduled"), deliveries: [] };
  ops.offers = ops.offers.map((o) => ({ ...o, status: "published", weekdays: [1, 2, 3] }) as typeof o);
  return ops;
}

/** DapurLibur: the sleeping mascot stays, as a character, on the kitchen's day off (140, the canvas size). */
const REST: State = {
  name: "Hari ini on the kitchen's day off",
  pose: "tidur",
  runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => restDay()) }),
  ui: withDapurScale(<TodayScreen />),
  copy: ["Dapur libur hari ini", "Masak lagi Senin 12 Okt."],
};

const STATES: State[] = [
  {
    name: "Hari ini that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(offline) }),
    ui: withDapurScale(<TodayScreen />),
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "a screen the guard caught",
    pose: "bingung",
    runtime: () => runtimeWith(),
    ui: (
      <ScreenGuard>
        <Broken />
      </ScreenGuard>
    ),
    copy: ["Halaman ini belum bisa ditampilkan."],
    action: "Coba lagi",
  },
  {
    name: "Pelanggan that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerCustomers: jest.fn(offline) }),
    ui: <CustomerList />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "a customer that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerCustomers: jest.fn(offline) }),
    ui: <CustomerDetail id="c-01" title="Andre Kusuma" />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Menu that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(offline) }),
    ui: <MenuWeek />,
    copy: ["Menu belum bisa dimuat."],
    action: "Coba lagi",
  },
  {
    name: "Uang that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ settlement: jest.fn(offline) }),
    ui: <UangScreen />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "a Laporan page that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ request: jest.fn(offline) }),
    ui: <ReportScreen id="i-01" />,
    copy: [],
    action: "Coba lagi",
  },
  {
    name: "Aktifkan pembayaran that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(offline) }),
    ui: <AktifkanScreen />,
    copy: [],
    action: "Coba lagi",
  },
];

async function open(state: State) {
  render(wrap(state.runtime(), state.ui));
  return screen.findByTestId(`mascot-${state.pose}`, hidden, { timeout: 4000 });
}

/** The art's drawn height: `MascotArt` makes the pose's visible height equal to its size. */
const artHeight = (art: ReturnType<typeof screen.getByTestId>) =>
  StyleSheet.flatten(within(art).getByTestId("mascot-art", hidden).props.style).height as number;

beforeEach(() => {
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
  jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
  // The guard's caught error is expected; React's report of it is not this test's output.
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  secureStore.clear();
});

describe("each empty and error state shows its pose and keeps its copy and action", () => {
  describe.each(["light", "dark"] as const)("%s theme", (scheme) => {
    it.each(STATES.map((s) => [s.name, s] as const))("%s", async (_name, state) => {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
      const art = await open(state);
      expect(artHeight(art)).toBe(88);
      expect(StyleSheet.flatten(art.props.style).alignSelf).toBe("center");
      for (const pose of POSES.filter((p) => p !== state.pose))
        expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      for (const copy of state.copy) expect(screen.getByText(copy)).toBeTruthy();
      if (state.action) expect(screen.getAllByRole("button", { name: state.action }).length).toBeGreaterThan(0);
    });
  });

  it("draws the art at 72 on a 360dp phone at font scale 1.3, so the title and action stay above the fold", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    for (const state of [STATES[0]]) {
      expect(artHeight(await open(state))).toBe(72);
      screen.unmount();
    }
  });

  it("keeps Usaha's failed package read the compact line inside its card: the page around it still stands", async () => {
    render(wrap(runtimeWith({ sellerOperations: jest.fn(offline) }), <UsahaScreen />));
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
  });

  it("shows the same still under reduced motion: the art never moves", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const art = await open(STATES[0]);
    expect(within(art).getByTestId("mascot-art-image", hidden)).toBeTruthy();
    expect(artHeight(art)).toBe(88);
  });

  it("draws the day-off mascot at 140, 115 on a 360dp phone at font scale 1.3", async () => {
    const art = await open(REST);
    expect(artHeight(art)).toBe(140);
    for (const copy of REST.copy) expect(screen.getByText(copy)).toBeTruthy();
    screen.unmount();
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    expect(artHeight(await open(REST))).toBe(115);
  });
});

/**
 * DapurKosong and DapurSelesai (polish canvas, 2026-10-30): no orders shows the empty wok and a finished day shows
 * dapur-selesai, each centred above its title in place of the mascot. 180pt is DESIGN.md's success size (the canvas
 * draws both at 180); a 360dp phone at font scale 1.3 takes the same four-fifths step as StateArt (147).
 */
describe("Dapur polish art", () => {
  const ART_STATES = [
    {
      name: "no orders today",
      art: "art-dapur-kosong",
      runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => ({ ...day("scheduled"), deliveries: [] })) }),
      copy: ["Tidak ada yang dimasak hari ini", "Pesanan baru akan muncul di sini."],
    },
    {
      name: "everything delivered",
      art: "art-dapur-selesai",
      runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => day("delivered")) }),
      copy: ["Semua beres hari ini", "Semua sudah diantar. 4 pelanggan makan dari dapurmu hari ini."],
      action: "Lihat besok",
    },
    {
      // Nothing for this meal, the other one cooking: the same empty wok, not a second empty-card style.
      name: "no session for this meal",
      art: "art-dapur-kosong",
      runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => day("scheduled", "dinner")) }),
      copy: ["Tidak ada pengantaran makan siang"],
      action: /^Lihat makan malam · \d+ porsi$/,
    },
  ];
  const artSize = (art: ReturnType<typeof screen.getByTestId>) =>
    StyleSheet.flatten(within(art).getByTestId("polish-art", hidden).props.style).width as number;

  describe.each(["light", "dark"] as const)("%s theme", (scheme) => {
    it.each(ART_STATES.map((s) => [s.name, s] as const))("%s", async (_name, state) => {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
      render(wrap(state.runtime(), withDapurScale(<TodayScreen />)));
      const art = await screen.findByTestId(state.art, hidden, { timeout: 4000 });
      expect(artSize(art)).toBe(180);
      expect(StyleSheet.flatten(art.props.style).alignSelf).toBe("center");
      // Decorative: the title says what the picture shows.
      expect(within(art).queryByTestId("polish-art")).toBeNull();
      for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      for (const copy of state.copy) expect(screen.getByText(copy)).toBeTruthy();
      if (state.action) expect(screen.getByRole("button", { name: state.action })).toBeTruthy();
    });
  });

  it("draws the art at 147 on a 360dp phone at font scale 1.3", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    for (const state of ART_STATES) {
      render(wrap(state.runtime(), withDapurScale(<TodayScreen />)));
      expect(artSize(await screen.findByTestId(state.art, hidden, { timeout: 4000 }))).toBe(147);
      screen.unmount();
    }
  });

  it("drops the customer line when no meal arrived", async () => {
    // Every row was cancelled: nobody ate from this kitchen today, so no number (and no "diantar") is claimed.
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("cancelled")) }), withDapurScale(<TodayScreen />)));
    await screen.findByText(/^Tidak ada yang dimasak hari ini$|^Semua beres hari ini$/, {}, { timeout: 4000 });
    expect(screen.queryByText(/pelanggan makan dari dapurmu/)).toBeNull();
    expect(screen.queryByText(/^Semua sudah diantar/)).toBeNull();
  });

  it("is a plain empty state, not the day off, when packages carry no weekdays", async () => {
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => ({ ...day("scheduled"), deliveries: [] })) }), withDapurScale(<TodayScreen />)));
    expect(await screen.findByText("Tidak ada yang dimasak hari ini")).toBeTruthy();
    expect(screen.queryByText("Dapur libur hari ini")).toBeNull();
  });
});

describe("the header holds no cooking mascot", () => {
  // The cooking mascot's slot left the count card with the card itself (Dapur layout, spec 3.1): the header is the
  // meta row, the date, the figure strip and the compact track. The mascot stays on the done and empty states above.
  it("draws no mascot before cooking, while it cooks, or once the meal is on its way", async () => {
    for (const status of ["scheduled", "preparing", "out_for_delivery"]) {
      render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day(status)) }), withDapurScale(<TodayScreen />)));
      await screen.findByTestId("session-count");
      for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      expect(screen.queryByTestId("mascot-memasak-slot", hidden)).toBeNull();
      screen.unmount();
    }
  });

  it("keeps the strip and the track the same size before, during and after cooking", async () => {
    // A 360dp phone at the default text size, where the strip has the least room in one row.
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    // A lunch window the caterer set, so the strip carries "Antar 11.30" in every stage.
    const windowed = (status: string): SellerOperationsState => {
      const ops = day(status);
      ops.deliveries = ops.deliveries.map(
        (d) => ({ ...d, offer: { ...d.offer, windows: { ...d.offer?.windows, lunch: "11.30-13.00" } } }) as typeof d,
      );
      return ops;
    };
    const layout = async (status: string) => {
      render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => windowed(status)) }), withDapurScale(<TodayScreen />)));
      const card = await screen.findByTestId("session-count");
      const flat = (id: string) => StyleSheet.flatten(within(card).getByTestId(id, hidden).props.style);
      const shape = {
        card: StyleSheet.flatten(card.props.style),
        strip: flat("session-figures"),
        rail: flat("rantang-track-rail"),
        subline: within(card).queryByText("Antar 11.30", hidden) !== null,
        grid: within(card).queryByTestId("session-figures-grid", hidden) !== null,
        words: within(card).queryByTestId("rantang-track-caption", hidden) !== null,
      };
      screen.unmount();
      return shape;
    };
    const before = await layout("scheduled");
    const during = await layout("preparing");
    const after = await layout("out_for_delivery");
    expect(during).toEqual(before);
    expect(after).toEqual(before);
    expect(before).toMatchObject({ subline: true, grid: false, words: false });
    expect(before.rail.height).toBe(40);
  });

  it("stacks the figures as a 2-column grid on a 360dp phone at font scale 1.3, the lead across both", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), withDapurScale(<TodayScreen />)));
    const card = await screen.findByTestId("session-count");
    const grid = await within(card).findByTestId("session-figures-grid", hidden);
    expect(StyleSheet.flatten(within(grid).getByTestId("session-figures-cell-0", hidden).props.style).width).toBe("100%");
    // The primary label of the strip's lead is whole: one line of the label and the number, no clipping.
    expect(within(card).getByText("porsi", hidden).props.numberOfLines).toBeUndefined();
  });

  it("leaves a copy of the header's track to the screen reader: the words are in its accessibility value", async () => {
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), withDapurScale(<TodayScreen />)));
    const track = await screen.findByTestId("rantang-track", hidden);
    expect((track.props.accessibilityValue.text as string).split(". ")[0]).toMatch(/^Dimasak/);
  });
});

it("mascot art is hidden from screen readers", async () => {
  for (const state of [STATES[0], REST]) {
    const art = await open(state);
    expect(screen.queryByTestId(`mascot-${state.pose}`)).toBeNull();
    expect(art.props.accessible).toBe(false);
    expect(art.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(art.props.accessibilityElementsHidden).toBe(true);
    screen.unmount();
  }
});
