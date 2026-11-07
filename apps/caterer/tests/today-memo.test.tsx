import type { ReactElement } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import type { RefreshControlProps } from "react-native";
import * as SecureStore from "expo-secure-store";
import { NavigationContext } from "expo-router/react-navigation";
import { kitchenSession, type SellerOperationsState } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { render } from "./render-dapur";
import { canvasDay, emptyDay } from "./fixtures";
import { BelanjaScreen } from "../src/today/BelanjaScreen";
import { TodayScreen } from "../src/today/TodayScreen";
import { saveCachedDay } from "../src/today/offline";

const mockRenders = { cells: 0, stops: [] as string[] };

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn(), pushScreen: jest.fn() }));
jest.mock("../src/today/offline", () => ({
  cacheSession: jest.fn(() => 0),
  saveCachedDay: jest.fn(async () => undefined),
  loadCachedDay: jest.fn(async () => null),
}));
jest.mock("@catera/domain", () => {
  const actual = jest.requireActual("@catera/domain");
  return { ...actual, kitchenSession: jest.fn(actual.kitchenSession) };
});
jest.mock("@catera/mobile-ui", () => {
  const actual = jest.requireActual("@catera/mobile-ui");
  const { createElement } = require("react");
  return {
    ...actual,
    StopRow: (props: { testID: string }) => {
      mockRenders.stops.push(props.testID);
      return createElement(actual.StopRow, props);
    },
    PressableScale: (props: { testID?: string }) => {
      if (props.testID?.startsWith("week-day-")) mockRenders.cells += 1;
      return createElement(actual.PressableScale, props);
    },
  };
});

// Only the clock is pinned, to Thursday 8 Oct 2026, 10.00 Jakarta: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
const TODAY = "2026-10-08";

function dayIn(status: "scheduled" | "preparing"): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = TODAY;
  const meal = status === "scheduled" ? { status } : { status, cooking_started_at: "2026-10-08T01:10:00Z" };
  day.deliveries = day.deliveries.map((d) => ({ ...d, service_date: TODAY, status, meals: [{ meal: "lunch", ...meal }] }) as typeof d);
  return day;
}

function runtimeWith(sellerOperations: () => Promise<SellerOperationsState>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(sellerOperations),
    sellerCalendar: jest.fn(async () => ({ days: [{ date: TODAY, orders: 4, lunch: true, dinner: false }] })),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <ToastProvider>
          <TodayScreen />
        </ToastProvider>
      </MobileProvider>
    </MoodProvider>,
  );

const pull = async () => {
  const control = screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<RefreshControlProps>;
  await act(async () => {
    control.props.onRefresh?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRenders.cells = 0;
  mockRenders.stops = [];
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("Hari ini draws only what changed", () => {
  it("a state change on the screen works out no session again and draws no day cell again", async () => {
    await renderToday(runtimeWith(async () => dayIn("preparing")));
    await screen.findByText("Pilih");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const sessions = (kitchenSession as jest.Mock).mock.calls.length;
    const cells = mockRenders.cells;

    fireEvent.press(screen.getByText("Pilih"));

    await screen.findByText("Pilih pengantaran");
    expect((kitchenSession as jest.Mock).mock.calls.length).toBe(sessions);
    expect(mockRenders.cells).toBe(cells);
  });

  it("a tick draws only its own stop, and each tick keeps the ones before it", async () => {
    await renderToday(runtimeWith(async () => dayIn("preparing")));
    fireEvent.press(await screen.findByText("Pilih"));
    await screen.findByText("Pilih pengantaran");
    mockRenders.stops = [];

    fireEvent.press(screen.getByTestId("stop-1-info"));
    await screen.findByText("1 dipilih");
    expect(mockRenders.stops).toEqual(["stop-1"]);

    fireEvent.press(screen.getByTestId("stop-2-info"));
    await screen.findByText("2 dipilih");
    expect(screen.getByTestId("stop-1-info").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("stop-2-info").props.accessibilityState.checked).toBe(true);
  });

  it("a day read again shows the new delivery state on the stops and the footer", async () => {
    let status: "scheduled" | "preparing" = "scheduled";
    await renderToday(runtimeWith(async () => dayIn(status)));
    await screen.findByText("Mulai masak");
    expect(screen.queryByTestId("stop-1-status")).toBeNull();

    status = "preparing";
    await pull();

    await waitFor(() => expect(screen.getByTestId("stop-1-status")).toBeTruthy());
    expect(screen.queryByText("Mulai masak")).toBeNull();
  });
});

describe("the day's copy on the phone", () => {
  it("a write that has not finished does not hold the day back", async () => {
    (saveCachedDay as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    await renderToday(runtimeWith(async () => dayIn("scheduled")));
    expect(await screen.findByTestId("stop-1")).toBeTruthy();
    expect(saveCachedDay).toHaveBeenCalled();
  });

  it("a write that fails leaves the fresh day on screen", async () => {
    (saveCachedDay as jest.Mock).mockImplementation(async () => {
      throw new Error("disk full");
    });
    await renderToday(runtimeWith(async () => dayIn("scheduled")));
    expect(await screen.findByText("Mulai masak")).toBeTruthy();
    expect(screen.queryByTestId("day-kept")).toBeNull();
  });
});

describe("Belanja 7 hari", () => {
  it("pulling reads the seven days again, from the empty state and from the recap", async () => {
    let day = (): SellerOperationsState => ({ ...emptyDay(), operationalDate: TODAY });
    const runtime = runtimeWith(async () => day());
    const bar = { setOptions: jest.fn(), isFocused: () => true, addListener: () => () => undefined };
    await render(
      <ThemeProvider storageKey="t.theme">
        <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
          <MobileProvider runtime={runtime} linkMapper={(h) => h}>
            <NavigationContext.Provider value={bar as never}>
              <BelanjaScreen />
            </NavigationContext.Provider>
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
    await screen.findByTestId("belanja-empty");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    day = () => dayIn("scheduled");
    const reads = (runtime.api.sellerOperations as jest.Mock).mock.calls.length;
    await pull();

    await screen.findByTestId("belanja-sections");
    expect((runtime.api.sellerOperations as jest.Mock).mock.calls.length).toBe(reads + 7);
    expect((screen.getByTestId("screen-scroll").props.refreshControl as ReactElement<RefreshControlProps>).props.onRefresh).toBeTruthy();
  });
});
