import { act, render, screen, waitFor } from "@testing-library/react-native";
import type { SellerOperationsState } from "@catera/domain";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { canvasDay } from "./fixtures";

/**
 * Dapur's launch (spec 3): a stored kitchen paints its kept day first, with nothing on it that changes data until the
 * fresh read lands, and the helper's tabs hold while it does. The kept day belongs to one account and goes with it.
 */

// Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock is pinned: timers and microtasks keep running.
const pinToday = () =>
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
const TODAY = "2026-10-08";

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

/** The document folder in memory, so the real cache module (keys, clearing) runs. */
jest.mock("expo-file-system", () => {
  const files = new Map<string, string>();
  class File {
    uri: string;
    name: string;
    constructor(dir: { uri: string }, name: string) {
      this.uri = `${dir.uri}/${name}`;
      this.name = name;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, "");
    }
    write(text: string) {
      files.set(this.uri, text);
    }
    async text() {
      return files.get(this.uri) ?? "";
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(dir: { uri: string }) {
      this.uri = dir.uri;
    }
    list() {
      return [...files.keys()]
        .filter((k) => k.startsWith(this.uri + "/"))
        .map((k) => new File(this, k.slice(this.uri.length + 1)));
    }
  }
  return { __files: files, File, Directory, Paths: { document: { uri: "file:///doc" } } };
});

/** What the native tab bar was handed: each trigger's route and whether it is hidden. */
const mockTriggers: { name: string; hidden?: boolean }[] = [];
jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react");
  const Trigger = Object.assign(() => null, { Icon: () => null, Label: () => null, Badge: () => null, VectorIcon: () => null });
  const NativeTabs = Object.assign(
    ({ children }: { children?: unknown }) => {
      mockTriggers.length = 0;
      React.Children.toArray(children).forEach((c: { props: { name: string; hidden?: boolean } }) =>
        mockTriggers.push({ name: c.props.name, hidden: c.props.hidden }),
      );
      return null;
    },
    { Trigger },
  );
  return { NativeTabs };
});
/** The root stack draws its tab group and records which guarded screens a role may open. */
const mockGuards: Record<string, boolean> = {};
jest.mock("expo-router", () => {
  const React = require("react");
  const Screen = ({ name }: { name: string }) => {
    if (name !== "(tabs)") return null;
    const TabsLayout = require("../app/(tabs)/_layout").default;
    return <TabsLayout />;
  };
  const Stack: any = ({ children }: { children: unknown }) => <>{children}</>;
  Stack.Screen = Screen;
  Stack.Protected = ({ guard, children }: { guard: boolean; children: any }) => {
    React.Children.toArray(children).forEach((c: { props: { name: string } }) => (mockGuards[c.props.name] = guard));
    return guard ? children : null;
  };
  return {
    Stack,
    DefaultTheme: { dark: false, colors: {} },
    DarkTheme: { dark: true, colors: {} },
    ThemeProvider: ({ children }: { children: unknown }) => children,
    Redirect: () => null,
    router: { push: jest.fn(), replace: jest.fn() },
    Link: () => null,
    useNavigationContainerRef: () => ({ isReady: () => false, addListener: () => () => undefined }),
  };
});
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  return { runtime: createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur", app: "dapur" }) };
});

const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
const files = (jest.requireMock("expo-file-system") as { __files: Map<string, string> }).__files;
const { TodayScreen } = require("../src/today/TodayScreen") as typeof import("../src/today/TodayScreen");
const { clearCachedDays } = require("../src/today/offline") as typeof import("../src/today/offline");

const owner = { id: "u-owner", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-staff", role: "staff", name: "Mbak Sari", catererId: "k-1" };

/** The canvas day moved to today, every lunch row still to cook, so a fresh read offers "Mulai masak". */
function today(): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = TODAY;
  day.today = TODAY;
  day.deliveries = day.deliveries.map((d) => ({ ...d, service_date: TODAY }));
  return day;
}

/** A phone that already holds this account's session, as after an earlier launch. */
function storedSession(prefix: string, actor: typeof owner) {
  store.set(`${prefix}.actor`, JSON.stringify(actor));
  store.set(`${prefix}.demo.token`, "demo-token");
}

/** The day the previous launch kept for `actor`. */
function keptDay(actor: typeof owner) {
  files.set(
    `file:///doc/dapur-day-${actor.id}-k-1-${TODAY}.json`,
    JSON.stringify({ savedAt: "2026-10-08T01:00:00.000Z", data: today() }),
  );
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function runtimeWith(actor: typeof owner, day: () => Promise<unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(() => new Promise(() => undefined)),
    sellerOperations: jest.fn(day),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

let mobile: ReturnType<typeof useMobile>;
function Probe() {
  mobile = useMobile();
  return null;
}

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h} onSignedOut={clearCachedDays}>
      <Probe />
      <TodayScreen />
    </MobileProvider>,
  );

/** What a kept copy must not offer: the session's action and each stop's "…" sheet. */
const mutatingActions = () => [
  ...screen.queryAllByRole("button", { name: /^Mulai masak/ }),
  ...screen.queryAllByRole("button", { name: /^Berangkat antar/ }),
  ...screen.queryAllByLabelText(/^(Laporkan masalah|Pindah tanggal)/),
];

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  files.clear();
  pinToday();
});
afterEach(() => jest.useRealTimers());

it("a stored kitchen paints its cached day first with mutating actions hidden", async () => {
  const fresh = deferred<SellerOperationsState>();
  storedSession("t", owner);
  keptDay(owner);
  renderToday(runtimeWith(owner, () => fresh.promise));
  expect(await screen.findByTestId("session-count")).toBeTruthy();
  expect(screen.getByTestId("day-refreshing")).toBeTruthy();
  expect(screen.getByText("Memperbarui…")).toBeTruthy();
  // Review Focus 1: nothing on the kept copy changes data, and it is not labelled as offline.
  expect(mutatingActions()).toEqual([]);
  expect(screen.queryByText(/Ini data terakhir/)).toBeNull();
  await act(async () => fresh.resolve(today()));
  expect(await screen.findByRole("button", { name: "Mulai masak" })).toBeTruthy();
  expect(screen.queryAllByLabelText(/^(Laporkan masalah|Pindah tanggal)/).length).toBeGreaterThan(0);
  expect(screen.queryByText("Memperbarui…")).toBeNull();
});

it("a failed fresh read keeps the kept day with its offline card", async () => {
  storedSession("t", owner);
  keptDay(owner);
  renderToday(
    runtimeWith(owner, async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    }),
  );
  expect(await screen.findByText(/Ini data terakhir yang tersimpan/)).toBeTruthy();
  expect(screen.getByTestId("day-kept")).toBeTruthy();
  expect(mutatingActions()).toEqual([]);
});

it("another account's kept day never paints, and logout forgets this one", async () => {
  // The owner's day is kept, but the helper is the one signed in now.
  keptDay(owner);
  storedSession("t", staff);
  const first = renderToday(runtimeWith(staff, () => new Promise(() => undefined)));
  await act(async () => {});
  expect(screen.queryByTestId("session-count")).toBeNull();
  expect(screen.getByLabelText("Memuat dapur")).toBeTruthy();
  await act(async () => {
    await mobile.logout();
  });
  // Review Focus 2: every kept day on this phone is gone with the session.
  expect([...files.keys()].filter((k) => k.includes("dapur-day-"))).toEqual([]);
  first.unmount();
});

it("staff with a cached day still only see Hari ini and Menu", async () => {
  storedSession("dapur", staff);
  keptDay(staff);
  const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
  const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
  runtime.api = { ...runtime.api, me: jest.fn(() => new Promise(() => undefined)) } as MobileRuntime["api"];
  const root = render(<RootLayout />);
  // Painted from the phone before me() answers: the helper's tabs, never the owner's.
  await waitFor(() => expect(mockTriggers).toHaveLength(4));
  expect(mockTriggers.filter((t) => !t.hidden).map((t) => t.name)).toEqual(["(index)", "(menu)"]);
  expect(mockGuards).toMatchObject({ aktifkan: false, impor: false });
  expect(runtime.api.me).toHaveBeenCalledTimes(1);
  root.unmount();

  // Hari ini for the helper paints the kept day, read-only, while the fresh read runs.
  storedSession("t", staff);
  renderToday(runtimeWith(staff, () => new Promise(() => undefined)));
  expect(await screen.findByTestId("session-count")).toBeTruthy();
  expect(mutatingActions()).toEqual([]);
});

it("a fresh read that lands after logout keeps nothing on the phone", async () => {
  // Carried from the Task 4 review: the read started for the owner; Keluar runs before it answers.
  const fresh = deferred<SellerOperationsState>();
  storedSession("t", owner);
  const runtime = runtimeWith(owner, () => fresh.promise);
  renderToday(runtime);
  // The owner's own read (the stored account is painted first), not the one made before it was known.
  await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", TODAY));
  await act(async () => {
    await mobile.logout();
  });
  await act(async () => fresh.resolve(today()));
  await act(async () => {});
  // The answer belonged to the session that ended: it is not written back as this phone's kept day.
  expect([...files.keys()].filter((k) => k.includes("dapur-day-"))).toEqual([]);
});

it("a fresh read in the same session is kept for the next launch", async () => {
  storedSession("t", owner);
  renderToday(runtimeWith(owner, async () => today()));
  expect(await screen.findByRole("button", { name: "Mulai masak" })).toBeTruthy();
  await waitFor(() => expect(files.has(`file:///doc/dapur-day-u-owner-k-1-${TODAY}.json`)).toBe(true));
});

it("the launch gate shows the mascot once the splash lets go, even while the phone's reads hang", async () => {
  // Carried from the Task 4 review: a SecureStore read that never answers leaves `booted` false; past the 1500ms
  // ceiling the splash is gone, so the gate must not be a blank canvas.
  const secure = jest.requireMock("expo-secure-store") as { getItemAsync: jest.Mock };
  secure.getItemAsync.mockImplementation(() => new Promise(() => undefined));
  const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
  const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
  runtime.api = { ...runtime.api, me: jest.fn(() => new Promise(() => undefined)) } as MobileRuntime["api"];
  jest.useFakeTimers({ now: new Date("2026-10-08T03:00:00Z") });
  try {
    const root = render(<RootLayout />);
    await act(async () => {});
    expect(screen.queryByLabelText("Menyiapkan dapur kamu…")).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByLabelText("Menyiapkan dapur kamu…")).toBeTruthy();
    root.unmount();
  } finally {
    secure.getItemAsync.mockImplementation(async (k: string) => (store.has(k) ? store.get(k) : null));
  }
});
