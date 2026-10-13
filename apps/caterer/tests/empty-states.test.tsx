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

/**
 * Spec 7.2, Task 13: Dapur's empty, done and failed states show their delivered mascot still, 120pt and centred above
 * their title (96 on a 360dp phone at font scale 1.3), decorative for screen readers; the cooking session shows the
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

const STATES: State[] = [
  {
    name: "Hari ini with no session",
    pose: "tidur",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => ({ ...day("scheduled"), deliveries: [] })) }),
    ui: <TodayScreen />,
    copy: ["Tidak ada masakan untuk hari ini.", "Pesanan baru akan muncul di sini."],
  },
  {
    name: "Hari ini with no session for this meal",
    pose: "tidur",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => day("scheduled", "dinner")) }),
    ui: <TodayScreen />,
    copy: ["Tidak ada antaran makan siang."],
    action: /^Lihat makan malam · \d+ porsi$/,
  },
  {
    name: "Semua beres hari ini",
    pose: "merayakan",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(async () => day("delivered")) }),
    ui: <TodayScreen />,
    copy: ["Semua beres hari ini", "Semua antaran tercatat sampai."],
    action: "Lihat besok",
  },
  {
    name: "Hari ini that could not load",
    pose: "bingung",
    runtime: () => runtimeWith({ sellerOperations: jest.fn(offline) }),
    ui: <TodayScreen />,
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
      expect(artHeight(art)).toBe(120);
      expect(StyleSheet.flatten(art.props.style).alignSelf).toBe("center");
      for (const pose of POSES.filter((p) => p !== state.pose))
        expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      for (const copy of state.copy) expect(screen.getByText(copy)).toBeTruthy();
      if (state.action) expect(screen.getAllByRole("button", { name: state.action }).length).toBeGreaterThan(0);
    });
  });

  it("draws the art at 96 on a 360dp phone at font scale 1.3, so the title and action stay above the fold", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    for (const state of [STATES[0], STATES[2], STATES[3]]) {
      expect(artHeight(await open(state))).toBe(96);
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
    const art = await open(STATES[2]);
    expect(within(art).getByTestId("mascot-art-image", hidden)).toBeTruthy();
    expect(artHeight(art)).toBe(120);
  });
});

describe("the cooking session", () => {
  it("shows the cooking mascot at 72 beside the count card's numbers while the session is cooking", async () => {
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), <TodayScreen />));
    const card = await screen.findByTestId("session-count");
    const art = await within(card).findByTestId("mascot-memasak", hidden);
    expect(artHeight(art)).toBe(72);
    // In the numbers' row, beside the portions.
    const row = within(card).getByTestId("session-count-row", hidden);
    expect(within(row).getByTestId("mascot-memasak", hidden)).toBeTruthy();
    expect(within(row).getByText(/^\d+$/)).toBeTruthy();
    for (const pose of POSES.filter((p) => p !== "memasak")) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
  });

  it("shrinks it to 58 on a 360dp phone at font scale 1.3", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), <TodayScreen />));
    const card = await screen.findByTestId("session-count");
    expect(artHeight(await within(card).findByTestId("mascot-memasak", hidden))).toBe(58);
  });

  it("keeps the count card's layout the same before, during and after cooking: the slot is held in the numbers row", async () => {
    // A 360dp phone at the default text size, where the caption has the least room.
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
    // A lunch window the caterer set, so the row carries "Antar 11.30" beside the slot.
    const windowed = (status: string): SellerOperationsState => {
      const ops = day(status);
      ops.deliveries = ops.deliveries.map(
        (d) => ({ ...d, offer: { ...d.offer, windows: { ...d.offer?.windows, lunch: "11.30-13.00" } } }) as typeof d,
      );
      return ops;
    };
    const layout = async (status: string) => {
      render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => windowed(status)) }), <TodayScreen />));
      const card = await screen.findByTestId("session-count");
      const cooking = status === "preparing";
      const slotId = cooking ? "mascot-memasak" : "mascot-memasak-slot";
      const slot = within(card).getByTestId(slotId, hidden);
      const box = StyleSheet.flatten(
        within(slot).getByTestId("mascot-art-fade", hidden).props.style,
      );
      const row = within(card).getByTestId("session-count-row", hidden);
      const caption = within(card).getByTestId("session-count-caption", hidden);
      const numbers = within(card).getByTestId("session-count-numbers", hidden);
      const antar = within(row).getByText(/^Antar /, hidden);
      const shape = {
        row: StyleSheet.flatten(row.props.style),
        numbers: StyleSheet.flatten(numbers.props.style),
        caption: { text: caption.props.children, lines: caption.props.numberOfLines },
        antar: StyleSheet.flatten(antar.props.style),
        // `[numbers flex:1][slot][Antar]` in one row: the slot always takes its width beside the numbers' column
        // (never inside it, never stacked over "Antar"), so the caption wraps the same way in every stage.
        slotInRow: within(row).queryByTestId(slotId, hidden) !== null,
        slotInNumbers: within(numbers).queryByTestId(slotId, hidden) !== null,
        antarInNumbers: within(numbers).queryByText(/^Antar /, hidden) !== null,
        stacked: within(card).queryByTestId("session-count-side", hidden) !== null,
        slot: StyleSheet.flatten(slot.props.style),
        box: { width: box.width, height: box.height },
      };
      screen.unmount();
      return shape;
    };
    const before = await layout("scheduled");
    const during = await layout("preparing");
    const after = await layout("out_for_delivery");
    expect(during).toEqual(before);
    expect(after).toEqual(before);
    expect(before).toMatchObject({ slotInRow: true, slotInNumbers: false, antarInNumbers: false, stacked: false });
    expect(before.box.height).toBe(72);
  });

  /** `withTiming` calls that move a value to `to` over `nativeMotion.content`. */
  const contentFades = (timing: jest.SpyInstance, to: number) =>
    timing.mock.calls.filter(([value, config]) => value === to && (config as { duration?: number })?.duration === 440);
  const opacityOf = (el: ReturnType<typeof screen.getByTestId>) => StyleSheet.flatten(el.props.style).opacity;

  it("changes only the mascot's opacity at Mulai masak and Berangkat antar: one box that never remounts", async () => {
    const reads = jest.fn(async () => day("scheduled"));
    const timing = jest.spyOn(Reanimated, "withTiming");
    render(wrap(runtimeWith({ sellerOperations: reads }), <TodayScreen />));
    const box = await screen.findByTestId("mascot-memasak-slot", hidden);
    const fade = within(box).getByTestId("mascot-art-fade", hidden);
    expect(opacityOf(fade)).toBe(0);

    timing.mockClear();
    reads.mockImplementation(async () => day("preparing"));
    await act(async () => void (await screen.UNSAFE_getByType(RefreshControl).props.onRefresh()));
    // The same box and the same fading view, now drawn: no mount, so no layout animation, just the opacity to 1.
    expect(await screen.findByTestId("mascot-memasak", hidden)).toBe(box);
    expect(within(box).getByTestId("mascot-art-fade", hidden)).toBe(fade);
    expect(contentFades(timing, 1).length).toBeGreaterThan(0);
    for (const el of [box, fade]) {
      expect(el.props.entering).toBeUndefined();
      expect(el.props.exiting).toBeUndefined();
    }

    timing.mockClear();
    reads.mockImplementation(async () => day("out_for_delivery"));
    await act(async () => void (await screen.UNSAFE_getByType(RefreshControl).props.onRefresh()));
    expect(await screen.findByTestId("mascot-memasak-slot", hidden)).toBe(box);
    expect(within(box).getByTestId("mascot-art-fade", hidden)).toBe(fade);
    expect(contentFades(timing, 0).length).toBeGreaterThan(0);
  });

  it("makes the change at once under reduced motion", async () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    const reads = jest.fn(async () => day("scheduled"));
    const timing = jest.spyOn(Reanimated, "withTiming");
    render(wrap(runtimeWith({ sellerOperations: reads }), <TodayScreen />));
    const box = await screen.findByTestId("mascot-memasak-slot", hidden);
    for (const next of ["preparing", "out_for_delivery"]) {
      timing.mockClear();
      reads.mockImplementation(async () => day(next));
      await act(async () => void (await screen.UNSAFE_getByType(RefreshControl).props.onRefresh()));
      await screen.findByTestId(next === "preparing" ? "mascot-memasak" : "mascot-memasak-slot", hidden);
      expect(contentFades(timing, 0)).toHaveLength(0);
      expect(contentFades(timing, 1)).toHaveLength(0);
      expect(opacityOf(within(box).getByTestId("mascot-art-fade", hidden))).toBe(next === "preparing" ? 1 : 0);
    }
  });

  it("draws a session already cooking at first paint at full opacity: the header's fade brings it in", async () => {
    render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), <TodayScreen />));
    const art = await screen.findByTestId("mascot-memasak", hidden);
    expect(opacityOf(within(art).getByTestId("mascot-art-fade", hidden))).toBe(1);
    expect(art.props.entering).toBeUndefined();
  });

  it("leaves with its block: switching to Besok leaves no cooking mascot behind and it has no exit animation", async () => {
    const reads = jest.fn((_id: string, date: string) =>
      date === TODAY ? Promise.resolve(day("preparing")) : new Promise<SellerOperationsState>(() => undefined),
    );
    render(wrap(runtimeWith({ sellerOperations: reads }), <TodayScreen />));
    const art = await screen.findByTestId("mascot-memasak", hidden);
    for (const el of [art, within(art).getByTestId("mascot-art-fade", hidden)]) {
      expect(el.props.exiting).toBeUndefined();
      expect(el.props.entering).toBeUndefined();
    }
    fireEvent.press(screen.getByRole("button", { name: /ganti hari$/ }));
    await waitFor(() => expect(screen.queryByTestId("session-count", hidden)).toBeNull());
    expect(screen.queryByTestId("mascot-memasak", hidden)).toBeNull();
    expect(screen.queryByTestId("mascot-memasak-slot", hidden)).toBeNull();
  });

  it("shows no mascot before cooking starts or once the meal is on its way", async () => {
    for (const status of ["scheduled", "out_for_delivery"]) {
      render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day(status)) }), <TodayScreen />));
      await screen.findByTestId("session-count");
      for (const pose of POSES) expect(screen.queryByTestId(`mascot-${pose}`, hidden)).toBeNull();
      screen.unmount();
    }
  });
});

it("mascot art is hidden from screen readers", async () => {
  for (const state of [STATES[0], STATES[2], STATES[3]]) {
    const art = await open(state);
    expect(screen.queryByTestId(`mascot-${state.pose}`)).toBeNull();
    expect(art.props.accessible).toBe(false);
    expect(art.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(art.props.accessibilityElementsHidden).toBe(true);
    screen.unmount();
  }
  render(wrap(runtimeWith({ sellerOperations: jest.fn(async () => day("preparing")) }), <TodayScreen />));
  const art = await screen.findByTestId("mascot-memasak", hidden);
  expect(screen.queryByTestId("mascot-memasak")).toBeNull();
  expect(art.props.accessible).toBe(false);
});
