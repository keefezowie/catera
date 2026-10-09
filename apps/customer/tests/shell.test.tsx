import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

/** A fake Supabase client that behaves like supabase-js 2.116 where it matters here:
 * one channel per topic, and no postgres_changes callbacks after subscribe(). */
type FakeChannel = { topic: string; on: () => FakeChannel; subscribe: () => FakeChannel };
const mockClient = (() => {
  const channels = new Map<string, FakeChannel>();
  const listeners = new Set<(event: string, session: unknown) => void>();
  const client = {
    subscriptions: [] as string[],
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      signOut: jest.fn(async () => {
        listeners.forEach((cb) => cb("SIGNED_OUT", null));
        return { error: null };
      }),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      signInWithPassword: jest.fn(),
    },
    rpc: jest.fn(),
    channel(topic: string) {
      const existing = channels.get(topic);
      if (existing) return existing;
      let subscribed = false;
      const ch: FakeChannel = {
        topic,
        on() {
          if (subscribed)
            throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${topic} after \`subscribe()\`.`);
          return ch;
        },
        subscribe() {
          subscribed = true;
          client.subscriptions.push(topic);
          return ch;
        },
      };
      channels.set(topic, ch);
      return ch;
    },
    removeChannel: jest.fn(async (ch: FakeChannel) => void channels.delete(ch.topic)),
    reset() {
      channels.clear();
      client.subscriptions = [];
    },
  };
  return client;
})();

const mockResponseListeners: ((r: unknown) => void)[] = [];
jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => mockClient }));
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
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => {
    mockResponseListeners.push(cb);
    return { remove: () => mockResponseListeners.splice(mockResponseListeners.indexOf(cb), 1) };
  }),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
}));
const mockTabScreens: { name: string; options?: { tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => { props: { name: string } } } }[] = [];
const mockTabBar: {
  style?: Record<string, unknown>;
  itemStyle?: Record<string, unknown>;
  tint?: { active: unknown; inactive: unknown };
  label?: (p: { color: string; children: string }) => import("react").ReactElement;
} = {};
const mockStatusBar: { style?: string } = {};
// When set, the stack also draws the Siang / Malam toggle, the way a screen with a mood header does.
let mockShowToggle = false;
const mockNavTheme: { value?: { dark: boolean; colors: Record<string, string> } } = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  // The root hands the navigator a theme built from the palette; the library defaults are stood in by plain objects.
  DefaultTheme: { dark: false, colors: { background: "rgb(242, 242, 242)" } },
  DarkTheme: { dark: true, colors: { background: "rgb(1, 1, 1)" } },
  ThemeProvider: ({ value, children }: { value: typeof mockNavTheme.value; children: unknown }) => {
    mockNavTheme.value = value;
    return children;
  },
  // The tab group renders its real layout, so the tab bar is read under the providers the root mounts. The stack also
  // renders its shared header once, the way a pushed screen shows it.
  Stack: Object.assign(
    ({ children, screenOptions }: { children: unknown; screenOptions?: Record<string, any> }) => (
      <>
        {screenOptions?.header
          ? screenOptions.header({ options: { title: "Judul uji" }, navigation: { goBack: () => {} }, back: { title: "x" } })
          : null}
        {mockShowToggle ? require("react").createElement(require("@catera/mobile-ui").MoodToggle) : null}
        {children}
      </>
    ),
    {
      Screen: ({ name }: { name: string }) => {
        if (name !== "(tabs)") return null;
        const TabsLayout = require("../app/(tabs)/_layout").default;
        return <TabsLayout />;
      },
    },
  ),
  Tabs: Object.assign(
    ({ children, screenOptions }: { children: unknown; screenOptions?: Record<string, any> }) => {
      mockTabBar.style = screenOptions?.tabBarStyle;
      mockTabBar.itemStyle = screenOptions?.tabBarItemStyle;
      mockTabBar.label = screenOptions?.tabBarLabel;
      mockTabBar.tint = { active: screenOptions?.tabBarActiveTintColor, inactive: screenOptions?.tabBarInactiveTintColor };
      return children;
    },
    {
      Screen: (props: (typeof mockTabScreens)[number]) => {
        mockTabScreens.push(props);
        return null;
      },
    },
  ),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (fn: () => void) => require("react").useEffect(fn, []),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
// The shared header's round back button draws its icon from this path.
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-font", () => ({ useFonts: () => [true, null] }));
jest.mock("expo-status-bar", () => ({
  StatusBar: (props: { style?: string }) => {
    mockStatusBar.style = props.style;
    return null;
  },
}));

process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://auth.example.test";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test-key";

const { router } = require("expo-router") as typeof import("expo-router");
const { useMobile } = require("@catera/mobile-core") as typeof import("@catera/mobile-core");
const { runtime } = require("../src/runtime") as typeof import("../src/runtime");
const { AppProviders } = require("../src/shell") as typeof import("../src/shell");

const actor = { id: "u-1", role: "customer", name: "Rani Contoh" };
let mockActor: typeof actor | null = null;
let mockDemo = false;
let mobile: ReturnType<typeof useMobile>;

function Probe() {
  mobile = useMobile();
  return <Text>{`m:${mobile.ready ? (mobile.actor?.id ?? "-") : "?"}`}</Text>;
}

const renderShell = () =>
  render(
    <AppProviders runtime={runtime}>
      <Probe />
    </AppProviders>,
  );

const tap = (id: string, href: string) => ({
  actionIdentifier: "default",
  notification: { request: { identifier: id, content: { data: { href } } } },
});
const tapAll = (r: unknown) => act(() => [...mockResponseListeners].forEach((cb) => cb(r)));

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.reset();
  mockResponseListeners.length = 0;
  mockActor = null;
  mockDemo = false;
  Object.assign(runtime.api, {
    me: jest.fn(async () => ({ actor: mockActor, demo: mockDemo })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  });
});

it("a signed-in start opens one realtime subscription per topic", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  await waitFor(() => expect(mockClient.subscriptions).toEqual(["catera:u-1"]));
});

it("a sign-in reaches the shell and subscribes once", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  mockActor = actor;
  await act(async () => {
    await mobile.signedIn(actor as never);
  });
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  expect(mockClient.subscriptions).toEqual(["catera:u-1"]);
});

it("logout signs the shell out", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  mockActor = null;
  await act(async () => {
    await mobile.logout();
  });
  expect(await screen.findByText("m:-")).toBeTruthy();
  expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("an expired session that signs out during startup ends in the guest state", async () => {
  let release!: () => void;
  (runtime.api.me as jest.Mock).mockImplementationOnce(
    () => new Promise((resolve) => (release = () => resolve({ actor: null, demo: false }))),
  );
  renderShell();
  expect(screen.getByText("m:?")).toBeTruthy();
  await act(async () => {
    await mockClient.auth.signOut();
  });
  expect(await screen.findByText("m:-")).toBeTruthy();
  await act(async () => release());
});

// Ported from the old startup test: a start that cannot reach Catera offers a retry instead of
// silently opening as a guest; a plain signed-out start still opens the app.
it.each(["REQUEST_TIMEOUT", "INVALID_API_RESPONSE"])(
  "a start that fails with %s shows Belum bisa terhubung and Coba lagi recovers",
  async (code) => {
    (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    renderShell();
    expect(await screen.findByText("Belum bisa terhubung.")).toBeTruthy();
    // The reason is an error, so it reads in the error colour like every other failed read.
    const reason = screen.getByTestId("startup-error");
    expect(require("react-native").StyleSheet.flatten(reason.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
    expect(screen.queryByText(/^m:/)).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    });
    expect(await screen.findByText("m:-")).toBeTruthy();
    expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
  },
);

it("an expired session (UNAUTHORIZED) opens as a guest without the retry screen", async () => {
  (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" }));
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
});

it("a later failed refresh never replaces a started app with the retry screen", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  (runtime.api.me as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
  await act(async () => {
    await mobile.refresh();
  });
  expect(screen.getByText("m:-")).toBeTruthy();
  expect(screen.queryByText("Belum bisa terhubung.")).toBeNull();
});

it("one push tap navigates once, through the customer link mapper", async () => {
  renderShell();
  expect(await screen.findByText("m:-")).toBeTruthy();
  // Only MobileProvider listens now: a tap must not open the screen twice.
  expect(mockResponseListeners).toHaveLength(1);
  tapAll(tap("n-1", "/deliveries/d-1"));
  tapAll(tap("n-1", "/deliveries/d-1"));
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith("/hari/d-1");
  tapAll(tap("n-2", "/payment/ck-1"));
  expect(router.push).toHaveBeenLastCalledWith("/bayar/ck-1");
  tapAll(tap("n-3", "/subscriptions/s-1/menu?date=2026-11-02&meal=lunch"));
  expect(router.push).toHaveBeenLastCalledWith("/pilih-menu/s-1?date=2026-11-02&meal=lunch");
  expect(router.push).toHaveBeenCalledTimes(3);
});

it("registers this phone for push through the shell (device.register)", async () => {
  mockActor = actor;
  renderShell();
  expect(await screen.findByText("m:u-1")).toBeTruthy();
  await act(async () => {
    await mobile.enablePush("Pengantaran & bantuan");
  });
  expect(runtime.api.command).toHaveBeenCalledWith(
    "device.register",
    { token: "ExponentPushToken[synthetic]" },
    expect.any(String),
  );
});

describe("runtime.signInPassword", () => {
  const signIn = () => {
    mockClient.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u-1", user_metadata: {} } },
      error: null,
    });
    mockClient.rpc.mockImplementation(async (fn: string) =>
      fn === "catera_v1_command" ? { data: { id: "u-1" }, error: null } : { data: actor, error: null },
    );
  };

  it("names a new customer with the name the app passes", async () => {
    signIn();
    await runtime.signInPassword("rani@example.test", "synthetic-password", "req-1", "Pelanggan");
    expect(mockClient.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Pelanggan" },
      request_id: "req-1",
    });
  });

  it("keeps Katerer as the default for Catera Dapur", async () => {
    signIn();
    await runtime.signInPassword("dapur@example.test", "synthetic-password", "req-2");
    expect(mockClient.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Katerer" },
      request_id: "req-2",
    });
  });

  // Ported from the old auth.test (signInNative): the same rules now live in runtime.signInPassword.
  it.each([
    [401, "INVALID_CREDENTIALS"],
    [429, "AUTH_RATE_LIMITED"],
  ])("a failed sign-in (HTTP %s) provisions no profile", async (status, code) => {
    mockClient.auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { status } });
    await expect(runtime.signInPassword("rani@example.test", "wrong", "req-3", "Pelanggan")).rejects.toThrow(code);
    expect(mockClient.rpc).not.toHaveBeenCalled();
  });

  it("failed profile setup removes the partly created local session", async () => {
    signIn();
    mockClient.rpc.mockResolvedValue({ data: null, error: new Error("FORBIDDEN") });
    await expect(runtime.signInPassword("rani@example.test", "synthetic-password", "req-4", "Pelanggan")).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(mockClient.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

it("tab labels stop growing at 1.15 times the system font size, so they stay on one line at font scale 1.3", () => {
  const TabsLayout = (require("../app/(tabs)/_layout") as typeof import("../app/(tabs)/_layout")).default;
  mockTabBar.label = undefined;
  render(
    <AppProviders runtime={runtime}>
      <TabsLayout />
    </AppProviders>,
  );
  const { getByText } = render(mockTabBar.label!({ color: "#123456", children: "Jelajah" }));
  expect(getByText("Jelajah").props.maxFontSizeMultiplier).toBe(1.15);
  expect(getByText("Jelajah").props.numberOfLines).toBe(1);
});

it("tab icons are outline until focused", () => {
  const TabsLayout = (require("../app/(tabs)/_layout") as typeof import("../app/(tabs)/_layout")).default;
  mockTabScreens.length = 0;
  render(
    <AppProviders runtime={runtime}>
      <TabsLayout />
    </AppProviders>,
  );
  const tabs = mockTabScreens.filter((s) => s.options?.tabBarIcon);
  expect(tabs.map((s) => s.name)).toEqual(["index", "jadwal", "jelajah", "akun"]);
  for (const { name, options } of tabs) {
    const icon = (focused: boolean) => options!.tabBarIcon!({ focused, color: "#000", size: 24 }).props.name;
    expect(icon(true)).not.toMatch(/-outline$/);
    expect(icon(false)).toBe(`${icon(true)}-outline`);
  }
});

describe("appearance", () => {
  beforeEach(() => {
    mockTabBar.style = undefined;
    mockTabBar.itemStyle = undefined;
    mockStatusBar.style = undefined;
    mockNavTheme.value = undefined;
    // The launch mood comes from the Jakarta clock, so each test pins it: 10:00 WIB (Siang) unless it says otherwise.
    atJakarta("2026-10-09T03:00:00Z");
  });
  let restoreInsets: (() => void) | undefined;
  afterEach(() => {
    restoreInsets?.();
    restoreInsets = undefined;
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockShowToggle = false;
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.delete(runtime.storageKey("locale"));
  });

  /** Only Date is faked: timers, microtasks and animation frames keep running for real. */
  const atJakarta = (iso: string) =>
    jest.useFakeTimers({
      now: new Date(iso),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
        "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval",
        "setTimeout", "clearTimeout",
      ],
    });
  const MALAM = "2026-10-09T09:00:00Z"; // 16:00 WIB

  const renderRoot = async () => {
    const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
    render(<RootLayout />);
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    await act(async () => {});
  };

  it("light system scheme: light tab bar and a dark status bar", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    await renderRoot();
    expect(mockTabBar.style).toMatchObject({ backgroundColor: "#FFFEFA", borderTopColor: "#E2E3D8" });
    expect(mockStatusBar.style).toBe("dark");
    expect(mockNavTheme.value).toMatchObject({ dark: false, colors: { background: "#FDFAF3", card: "#FFFEFA" } });
  });

  it("Malam on a light system theme: light status bar glyphs and a mood header on pushed screens, but the tab bar stays theme", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    await renderRoot();
    expect(mockStatusBar.style).toBe("light");
    const header = StyleSheet.flatten(screen.getByTestId("app-header").props.style);
    expect(header.backgroundColor).toBe("#0B1F16");
    expect(StyleSheet.flatten(screen.getByText("Judul uji").props.style).color).toBe("#FFF7E9");
    // The mood never reaches the tab bar.
    expect(mockTabBar.style).toMatchObject({ backgroundColor: "#FFFEFA", borderTopColor: "#E2E3D8" });
  });

  it("Siang on a light system theme keeps the dark status bar and the sunrise header", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    await renderRoot();
    expect(mockStatusBar.style).toBe("dark");
    expect(StyleSheet.flatten(screen.getByTestId("app-header").props.style).backgroundColor).toBe("#FFEFD9");
  });

  it("the Siang / Malam toggle reads Lunch and Dinner in English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
    mockShowToggle = true;
    await renderRoot();
    expect(await screen.findByRole("tab", { name: "Lunch" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Siang" })).toBeNull();
  });

  it("the Siang / Malam toggle reads Siang and Malam by default", async () => {
    mockShowToggle = true;
    await renderRoot();
    expect(screen.getByRole("tab", { name: "Siang" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Malam" })).toBeTruthy();
  });

  it("demo on and Malam: the demo strip sits above the header, so the status bar glyphs are dark", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    mockDemo = true;
    await renderRoot();
    expect(await screen.findByText("Demo · data sintetis")).toBeTruthy();
    // Control: the mood really is Malam here, so "dark" is the demo strip's doing and not a Siang launch.
    expect(StyleSheet.flatten(screen.getByTestId("app-header").props.style).backgroundColor).toBe("#0B1F16");
    expect(mockStatusBar.style).toBe("dark");
  });

  it("the loading spinner sits on the canvas, so Malam does not turn its status bar glyphs light", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
    render(<RootLayout />);
    expect(screen.UNSAFE_queryByType(require("react-native").ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("dark");
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    expect(mockStatusBar.style).toBe("light");
  });

  it("sets the status bar glyphs while the loading spinner is still showing", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");
    const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
    render(<RootLayout />);
    // Nothing has been awaited yet, so the session read is pending and the app is behind the ready gate.
    expect(screen.UNSAFE_queryByType(require("react-native").ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("light");
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
  });

  it("tab bar clears the bottom gesture inset and keeps every item at least 48dp", async () => {
    // The safe-area mock is a plain jest.fn that restoreAllMocks does not reset, so the default is put back by hand.
    const insets = require("react-native-safe-area-context").useSafeAreaInsets as jest.Mock;
    const original = insets.getMockImplementation();
    insets.mockImplementation(() => ({ top: 0, bottom: 24, left: 0, right: 0 }));
    restoreInsets = () => insets.mockImplementation(original);
    await renderRoot();
    // 64dp of bar plus the inset, with the inset as bottom padding so the labels sit above the gesture pill.
    expect(mockTabBar.style).toMatchObject({ height: 88, paddingBottom: 24 });
    expect(mockTabBar.itemStyle).toMatchObject({ minHeight: 48 });
  });

  it("tab bar is the plain 64dp when the phone has no bottom inset", async () => {
    await renderRoot();
    expect(mockTabBar.style).toMatchObject({ height: 64, paddingBottom: 0 });
  });

  it("dark system scheme: dark tab bar and a light status bar", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");
    await renderRoot();
    expect(mockTabBar.style).toMatchObject({ backgroundColor: "#1E1E1C", borderTopColor: "#34332F" });
    expect(mockStatusBar.style).toBe("light");
    // Scene containers get the dark canvas, not the navigation library's light default.
    expect(mockNavTheme.value).toMatchObject({ dark: true, colors: { background: "#151514", card: "#232321", border: "#34332F" } });
  });
});
