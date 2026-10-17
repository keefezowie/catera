import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AccessibilityInfo, AppState, StyleSheet, Text, type AppStateStatus } from "react-native";
import * as Reanimated from "react-native-reanimated";
import * as SplashScreen from "expo-splash-screen";
import { nativeThemes } from "@catera/design-tokens";
import { useMobile } from "@catera/mobile-core";
import { LaunchCover, ThemeProvider } from "@catera/mobile-ui";
import { customerState, TODAY } from "./fixtures";
import { goOffline, keptLine } from "./offline";

/**
 * The launch sequence (spec 3): the splash held until the phone's own reads finish, Beranda painted from the copy kept
 * for this account while one me() and the fresh read run, and nothing acted on, or seen by another account, from that
 * copy.
 */

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));

/** SecureStore in memory; a key in `gates` answers only once its gate is released, to hold a local read. */
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  const gates = new Map<string, Promise<void>>();
  return {
    __store: store,
    __gates: gates,
    getItemAsync: jest.fn(async (k: string) => {
      await gates.get(k);
      return store.has(k) ? store.get(k) : null;
    }),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

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

jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

/** Fonts that load when the test says so. */
const mockFonts: { loaded: boolean; set?: (v: boolean) => void } = { loaded: true };
jest.mock("expo-font", () => ({
  useFonts: () => {
    const React = require("react");
    const [loaded, set] = React.useState(mockFonts.loaded);
    mockFonts.set = set;
    return [loaded, null];
  },
}));

// The navigator itself cannot run here; the stack draws a marker so a test can see the app past its gate.
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const Stack = Object.assign(() => <Text testID="app-stack">stack</Text>, { Screen: () => null });
  return {
    Stack,
    router: { push: jest.fn(), replace: jest.fn(), canGoBack: () => false, back: jest.fn() },
    Link: () => null,
    useLocalSearchParams: () => ({}),
    useNavigationContainerRef: () => ({ addListener: () => () => undefined, isReady: () => false }),
    DefaultTheme: { dark: false, colors: {} },
    DarkTheme: { dark: true, colors: {} },
    ThemeProvider: ({ children }: { children: unknown }) => children,
  };
});

jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  return {
    runtime: createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" }),
  };
});

const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
const { AppProviders } = require("../src/shell") as typeof import("../src/shell");
const { announceUpdating, Beranda } = require("../src/today/Beranda") as typeof import("../src/today/Beranda");
const SecureStore = jest.requireMock("expo-secure-store") as {
  __store: Map<string, string>;
  __gates: Map<string, Promise<void>>;
};
const files = (jest.requireMock("expo-file-system") as { __files: Map<string, string> }).__files;

const rani = { id: "u-rani", role: "customer", name: "Rani Contoh" };
const budi = { id: "u-budi", role: "customer", name: "Budi Contoh" };

/** A promise the test resolves by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A phone that already holds this account's session (actor and token), as after an earlier launch. */
function storedSession(actor: typeof rani) {
  SecureStore.__store.set("catera.actor", JSON.stringify(actor));
  SecureStore.__store.set("catera.demo.token", "demo-token");
}

/** Beranda as the previous launch kept it for `actor`: lunch on the way, so a fresh copy offers "Sudah sampai". */
function keptHome(actor: typeof rani, savedAt = `${TODAY}T03:00:00.000Z`) {
  files.set(
    `file:///doc/catera-customer-${actor.id}.json`,
    JSON.stringify({ savedAt, data: customerState({ status: "out_for_delivery" }) }),
  );
}

/** Decorative parts are hidden from screen readers, so their queries look past that on purpose. */
const hidden = { includeHiddenElements: true } as const;

let mobile: ReturnType<typeof useMobile>;
function Probe() {
  mobile = useMobile();
  return null;
}

const renderHome = () =>
  render(
    <AppProviders runtime={runtime}>
      <Probe />
      <Beranda />
    </AppProviders>,
  );

const renderRoot = () => {
  const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
  return render(<RootLayout />);
};

let appStateListeners: ((s: AppStateStatus) => void)[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  SecureStore.__store.clear();
  SecureStore.__gates.clear();
  files.clear();
  mockFonts.loaded = true;
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (s: AppStateStatus) => void);
    return { remove: () => (appStateListeners = appStateListeners.filter((l) => l !== listener)) } as never;
  });
  (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false);
  Object.assign(runtime.api, {
    me: jest.fn(async () => ({ actor: rani, demo: false })),
    customer: jest.fn(async () => customerState({ status: "out_for_delivery" })),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("the launch cover", () => {
  // First in the file on purpose: the cover plays once per JS context, so this is the one cold start here.
  it("a cold start lays the cover over the app and a warm start does not", async () => {
    storedSession(rani);
    const first = renderRoot();
    expect(screen.getByTestId("launch-cover", hidden)).toBeTruthy();
    // Under the splash it holds still and keeps every touch; it never speaks to a screen reader.
    expect(screen.getByTestId("launch-cover", hidden).props.pointerEvents).toBe("auto");
    expect(screen.getByTestId("launch-cover", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
    // The mark decodes under the splash (an image load is a native event, not a touch, so it is called directly).
    await act(async () => screen.getByTestId("launch-cover-mark", hidden).props.onLoad());
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
    // Released: touches pass through from the first frame of the beat, and the beat lasts `feature` 320ms.
    expect(screen.getByTestId("launch-cover", hidden).props.pointerEvents).toBe("none");
    await act(async () => new Promise((r) => setTimeout(r, 800)));
    expect(screen.queryByTestId("launch-cover", hidden)).toBeNull();
    first.unmount();
    renderRoot();
    await screen.findByTestId("app-stack");
    expect(screen.queryByTestId("launch-cover", hidden)).toBeNull();
  });

  it("LaunchCover is skipped under reduced motion", () => {
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(true);
    const onDone = jest.fn();
    render(<LaunchCover scheme="light" onDone={onDone} />);
    expect(screen.queryByTestId("launch-cover", hidden)).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("the cover draws the splash mark at the splash's size on the theme canvas", () => {
    render(<LaunchCover scheme="dark" onDone={() => undefined} hold />);
    expect(StyleSheet.flatten(screen.getByTestId("launch-cover-mark", hidden).props.style)).toMatchObject({ width: 200, height: 200 });
    expect(StyleSheet.flatten(screen.getByTestId("launch-cover-canvas", hidden).props.style).backgroundColor).toBe(
      nativeThemes.dark.canvas,
    );
    expect(screen.getAllByTestId("sparkle", hidden)).toHaveLength(3);
  });

  it("a mark that never decodes steps aside without playing", async () => {
    const onDone = jest.fn();
    render(<LaunchCover scheme="light" onDone={onDone} />);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });
});

describe("the splash", () => {
  it("the splash stays until fonts, theme and the stored session are read", async () => {
    mockFonts.loaded = false;
    const theme = deferred<void>();
    const session = deferred<void>();
    SecureStore.__gates.set("catera.theme", theme.promise);
    SecureStore.__gates.set("catera.actor", session.promise);
    storedSession(rani);
    renderRoot();
    expect(SplashScreen.preventAutoHideAsync).toBeDefined();
    await act(async () => {});
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await act(async () => mockFonts.set!(true));
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await act(async () => theme.resolve());
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await act(async () => session.resolve());
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
    // Once, however the app goes on.
    await screen.findByTestId("app-stack");
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it("the splash hides after 1500ms even if a local read hangs", async () => {
    SecureStore.__gates.set("catera.theme", new Promise(() => undefined));
    renderRoot();
    await act(async () => new Promise((r) => setTimeout(r, 1000)));
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1), { timeout: 1500 });
  });

  it("fonts slower than the ceiling: the splash lifts onto the startup mascot in the system face", async () => {
    mockFonts.loaded = false;
    storedSession(rani);
    renderRoot();
    await act(async () => new Promise((r) => setTimeout(r, 1600)));
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mascot-loading").props.accessibilityLabel).toBe("Menyiapkan Catera untuk Anda…");
    expect(screen.queryByTestId("app-stack")).toBeNull();
    await act(async () => mockFonts.set!(true));
    expect(await screen.findByTestId("app-stack")).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it("a stored dark theme is the first frame's theme on a light phone", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    SecureStore.__store.set("catera.theme", "dark");
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    renderRoot();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1));
    // The frame the splash lifts onto (the gate, waiting on me()) is already on the dark canvas.
    await screen.findByTestId("mascot-loading");
    const backgrounds = screen.UNSAFE_root.findAll(
      (n) => typeof n.type === "string" && !!StyleSheet.flatten(n.props.style)?.backgroundColor,
    ).map((n) => StyleSheet.flatten(n.props.style).backgroundColor);
    expect(backgrounds).toContain(nativeThemes.dark.canvas);
    expect(backgrounds).not.toContain(nativeThemes.light.canvas);
  });
});

describe("the launch gate", () => {
  it("with no stored session the gate shows the mascot only after 300ms", async () => {
    const me = deferred<{ actor: null; demo: boolean }>();
    (runtime.api.me as jest.Mock).mockImplementation(() => me.promise);
    renderRoot();
    const gate = await screen.findByTestId("mascot-loading");
    // Screen readers hear it at once; the drawing and its words wait.
    expect(gate.props.accessibilityLabel).toBe("Menyiapkan Catera untuk Anda…");
    expect(StyleSheet.flatten(screen.getByTestId("mascot-loading-visual", hidden).props.style).opacity).toBe(0);
    await waitFor(
      () => expect(StyleSheet.flatten(screen.getByTestId("mascot-loading-visual", hidden).props.style).opacity).toBe(1),
      { timeout: 1000 },
    );
    await act(async () => me.resolve({ actor: null, demo: false }));
    expect(await screen.findByTestId("app-stack")).toBeTruthy();
    expect(screen.queryByTestId("mascot-loading")).toBeNull();
  });

  it("a stored session skips the gate: the app shows before me() answers", async () => {
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    storedSession(rani);
    renderRoot();
    expect(await screen.findByTestId("app-stack")).toBeTruthy();
    expect(screen.queryByTestId("mascot-loading")).toBeNull();
  });

  it("a stored-session read that hangs past the splash ceiling lifts onto the mascot, never a blank canvas", async () => {
    // Carried from Task 4: the session read never answers, so the app is never `booted`; the splash still lifts at
    // 1500ms and what it lifts onto must say that Catera is getting ready.
    SecureStore.__gates.set("catera.actor", new Promise(() => undefined));
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    renderRoot();
    await act(async () => new Promise((r) => setTimeout(r, 1000)));
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mascot-loading")).toBeNull();
    await waitFor(() => expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1), { timeout: 1500 });
    const gate = await screen.findByTestId("mascot-loading");
    expect(gate.props.accessibilityLabel).toBe("Menyiapkan Catera untuk Anda…");
    expect(screen.queryByTestId("app-stack")).toBeNull();
  });
});

describe("cache-first Beranda", () => {
  it("Memperbarui follows the date in the header's meta row, in a live region, never after the hero", async () => {
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    storedSession(rani);
    keptHome(rani);
    renderHome();
    const line = await screen.findByText("Memperbarui…");
    // Controller ruling (finding 2): it sits in the fixed 48 meta row after the date, never under the headline.
    const row = screen.getByTestId("mood-header-row");
    expect(within(row).getByText("Memperbarui…")).toBe(line);
    expect(within(row).getByText(/·$/)).toBeTruthy();
    expect(within(screen.getByTestId("home-title")).queryByText("Memperbarui…")).toBeNull();
    expect(within(screen.getByTestId("screen-body")).queryByText("Memperbarui…")).toBeNull();
    // One polite live region holds it, mounted with the meta row, so TalkBack hears the word once when it appears.
    const region = screen.getByTestId("home-refreshing-region");
    expect(region.props.accessibilityLiveRegion).toBe("polite");
    expect(within(region).getByText("Memperbarui…")).toBe(line);
    // On Android the live region speaks; announcing as well would say it twice.
    expect(announce).not.toHaveBeenCalled();
  });

  it("VoiceOver hears Memperbarui once, announced; TalkBack is left to the live region", () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
    announceUpdating("Memperbarui…", "ios");
    announceUpdating("Memperbarui…", "android");
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Memperbarui…");
  });

  it("a read still out when the person signs out never writes the forgotten copy back", async () => {
    // Carried from Task 4: Keluar forgets the kept Beranda; a fresh read that lands after that must not save it again.
    const fresh = deferred<unknown>();
    (runtime.api.customer as jest.Mock).mockImplementation(() => fresh.promise);
    storedSession(rani);
    keptHome(rani);
    renderHome();
    expect(await screen.findByText("Sedang diantar")).toBeTruthy();
    await act(async () => {
      await mobile.logout();
    });
    expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]);
    await act(async () => fresh.resolve(customerState({ status: "out_for_delivery" })));
    await act(async () => {});
    expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]);
  });

  it("a read that answers after logout's first step is not saved", async () => {
    // Logout deletes the stored actor before it forgets the copies. The check before the save reads the stored actor;
    // here it is deleted while that check is out, so the read is never written.
    const fresh = deferred<unknown>();
    (runtime.api.customer as jest.Mock).mockImplementation(() => fresh.promise);
    storedSession(rani);
    renderHome();
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const check = deferred<void>();
    SecureStore.__gates.set("catera.actor", check.promise);
    await act(async () => fresh.resolve(customerState({ status: "out_for_delivery" })));
    SecureStore.__store.delete("catera.actor");
    await act(async () => check.resolve());
    await act(async () => {});
    expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]);
  });

  it("a save that lands while logout runs is taken back", async () => {
    // The check before the save still saw the session, so the copy was written; the session ended during the write,
    // so the check after it deletes the copy again.
    const fresh = deferred<unknown>();
    (runtime.api.customer as jest.Mock).mockImplementation(() => fresh.promise);
    storedSession(rani);
    renderHome();
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    const before = deferred<void>();
    const after = deferred<void>();
    SecureStore.__gates.set("catera.actor", before.promise);
    await act(async () => fresh.resolve(customerState({ status: "out_for_delivery" })));
    // The first check is waiting on `before`; the next read of the stored actor (the second check) waits on `after`.
    SecureStore.__gates.set("catera.actor", after.promise);
    await act(async () => before.resolve());
    await waitFor(() => expect(files.has("file:///doc/catera-customer-u-rani.json")).toBe(true));
    SecureStore.__store.delete("catera.actor");
    await act(async () => after.resolve());
    await waitFor(() => expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]));
  });

  it("a fresh read while signed in is kept for the next launch", async () => {
    storedSession(rani);
    renderHome();
    expect(await screen.findByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    await waitFor(() => expect(files.has("file:///doc/catera-customer-u-rani.json")).toBe(true));
  });

  it("a stored session paints the cached Beranda before me() answers, with Memperbarui", async () => {
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    storedSession(rani);
    keptHome(rani);
    renderHome();
    expect(await screen.findByText("Sedang diantar")).toBeTruthy();
    expect(screen.getByText("Memperbarui…")).toBeTruthy();
    // The kept copy is labelled as refreshing, not as offline.
    expect(screen.queryByText(/tidak ada koneksi/)).toBeNull();
  });

  it("actions are hidden on the cached paint and appear after the fresh read", async () => {
    const fresh = deferred<unknown>();
    (runtime.api.customer as jest.Mock).mockImplementation(() => fresh.promise);
    storedSession(rani);
    keptHome(rani);
    renderHome();
    expect(await screen.findByText("Sedang diantar")).toBeTruthy();
    // Review Focus 1: the meal may have moved since the copy was kept, so nothing on it can be acted on.
    expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Belum" })).toBeNull();
    expect(screen.queryByLabelText("…")).toBeNull();
    expect(screen.queryByText("…")).toBeNull();
    await act(async () => fresh.resolve(customerState({ status: "out_for_delivery" })));
    expect(await screen.findByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    expect(screen.queryByText("Memperbarui…")).toBeNull();
  });

  it("a fresh read that fails keeps the copy with today's offline line", async () => {
    (runtime.api.customer as jest.Mock).mockRejectedValue(
      Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }),
    );
    storedSession(rani);
    keptHome(rani, `${TODAY}T03:12:00.000Z`);
    goOffline();
    renderHome();
    expect(await screen.findByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.getByText(keptLine(`${TODAY}T03:12:00.000Z`))).toBeTruthy();
    expect(screen.queryByText(/Terakhir diperbarui|tidak ada koneksi/)).toBeNull();
    expect(screen.queryByText("Memperbarui…")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
  });

  it("with no copy kept a signed-in launch shows the Beranda skeleton under the live header", async () => {
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    storedSession(rani);
    renderHome();
    expect(await screen.findByTestId("beranda-skeleton")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Memuat beranda" })).toBeTruthy();
    expect(within(screen.getByTestId("mood-header")).getByText(/^(Siang ini|Malam ini),$/)).toBeTruthy();
  });

  it("after logout the next launch paints no cached home", async () => {
    storedSession(rani);
    keptHome(rani);
    const first = renderHome();
    expect(await screen.findByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    expect(files.has("file:///doc/catera-customer-u-rani.json")).toBe(true);
    await act(async () => {
      await mobile.logout();
    });
    // Review Focus 2: the copy is gone with the session.
    expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]);
    first.unmount();
    // The same person signs in again later: the first frame is the skeleton, never the old copy.
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    storedSession(rani);
    renderHome();
    expect(await screen.findByTestId("beranda-skeleton")).toBeTruthy();
    expect(screen.queryByText("Sedang diantar")).toBeNull();
  });

  it("another account's kept Beranda never paints for the person now signed in", async () => {
    (runtime.api.me as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    keptHome(rani);
    storedSession(budi);
    renderHome();
    expect(await screen.findByTestId("beranda-skeleton")).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByText("Sedang diantar")).toBeNull();
  });

  it("me() answering UNAUTHORIZED after a cached paint signs out and forgets the copy", async () => {
    const me = deferred<never>();
    (runtime.api.me as jest.Mock).mockImplementation(() => me.promise);
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    storedSession(rani);
    keptHome(rani);
    renderHome();
    expect(await screen.findByText("Sedang diantar")).toBeTruthy();
    await act(async () => me.reject(Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" })));
    await waitFor(() => expect(screen.queryByText("Sedang diantar")).toBeNull());
    expect(mobile.actor).toBeNull();
    await waitFor(() => expect([...files.keys()].filter((k) => k.includes("catera-customer-"))).toEqual([]));
  });
});

describe("one session read at launch", () => {
  it("only one me() runs at launch even with an English locale and an active event", async () => {
    SecureStore.__store.set("catera.locale", "en");
    storedSession(rani);
    keptHome(rani);
    renderHome();
    expect(await screen.findByRole("button", { name: "It's here" })).toBeTruthy();
    // The launch's own "active" arrives while the app is already in front.
    await act(async () => appStateListeners.forEach((l) => l("active")));
    await act(async () => {});
    expect(runtime.api.me).toHaveBeenCalledTimes(1);
    // Listeners were added once: the locale read did not re-run the session effect.
    expect(appStateListeners).toHaveLength(1);
    // A real return from the background still reads again.
    await act(async () => appStateListeners.forEach((l) => l("background")));
    await act(async () => appStateListeners.forEach((l) => l("active")));
    await waitFor(() => expect(runtime.api.me).toHaveBeenCalledTimes(2));
  });

  it("a confirmed stored account does not read Beranda twice", async () => {
    storedSession(rani);
    renderHome();
    expect(await screen.findByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    await act(async () => {});
    expect(runtime.api.me).toHaveBeenCalledTimes(1);
    expect(runtime.api.customer).toHaveBeenCalledTimes(1);
  });
});

describe("theme read", () => {
  it("useThemePreference reports loaded once the stored choice is read", async () => {
    const gate = deferred<void>();
    SecureStore.__gates.set("t.theme", gate.promise);
    const { useThemePreference } = require("@catera/mobile-ui") as typeof import("@catera/mobile-ui");
    function ThemeProbe() {
      const { loaded, scheme } = useThemePreference();
      return <Text>{`${loaded ? "loaded" : "reading"}:${scheme}`}</Text>;
    }
    SecureStore.__store.set("t.theme", "dark");
    render(
      <ThemeProvider storageKey="t.theme">
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByText("reading:light")).toBeTruthy();
    await act(async () => gate.resolve());
    expect(screen.getByText("loaded:dark")).toBeTruthy();
  });
});
