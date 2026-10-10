import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { nativeThemes } from "@catera/design-tokens";
import { tabBarColors, tabLabelStyle } from "@catera/mobile-ui";

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
/** What the layout hands the native tab bar: the bar's own props and each trigger's props (name, hidden, children). */
type MockTrigger = { name: string; hidden?: boolean; children?: import("react").ReactNode };
const mockNativeTabs: { props?: Record<string, any>; triggers: MockTrigger[] } = { triggers: [] };
// The native bar cannot render under Jest, so a stand-in records its props and its triggers instead.
jest.mock("expo-router/unstable-native-tabs", () => {
  const React = require("react");
  const Trigger = Object.assign(() => null, {
    Icon: () => null,
    Label: () => null,
    Badge: () => null,
    VectorIcon: () => null,
  });
  const NativeTabs = Object.assign(
    ({ children, ...props }: { children?: unknown }) => {
      mockNativeTabs.props = props;
      mockNativeTabs.triggers = React.Children.toArray(children)
        .filter((c: { type?: unknown }) => c.type === Trigger)
        .map((c: { props: MockTrigger }) => c.props);
      return null;
    },
    { Trigger },
  );
  return { NativeTabs };
});
const mockStatusBar: { style?: string } = {};
// When set, the stack also draws the Siang / Malam toggle, the way a screen with a mood header does.
let mockShowToggle = false;
// When set, a tab root's mood header is in front.
let mockShowHeader = false;
const mockStack: { screenOptions?: Record<string, any> } = {};
const mockNavTheme: { value?: { dark: boolean; colors: Record<string, string> } } = {};
/** A tapped push opens through openLink (navigation.test runs it on the real router). */
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), openLink: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  // The root layout registers the navigation container for goToTab and openLink; this one never has a state.
  useNavigationContainerRef: () => ({ addListener: () => () => undefined, isReady: () => false }),
  // The root hands the navigator a theme built from the palette; the library defaults are stood in by plain objects.
  DefaultTheme: { dark: false, colors: { background: "rgb(242, 242, 242)" } },
  DarkTheme: { dark: true, colors: { background: "rgb(1, 1, 1)" } },
  ThemeProvider: ({ value, children }: { value: typeof mockNavTheme.value; children: unknown }) => {
    mockNavTheme.value = value;
    return children;
  },
  // The tab group renders its real layout, so the tab bar is read under the providers the root mounts. The stack records
  // the header options it hands every pushed screen, shows a probe of the current mood's header fill, and, when asked,
  // a tab root's mood header in front.
  Stack: Object.assign(
    ({ children, screenOptions }: { children: unknown; screenOptions?: Record<string, any> }) => {
      const React = require("react");
      const ui = require("@catera/mobile-ui");
      mockStack.screenOptions = screenOptions;
      const Probe = () =>
        React.createElement(require("react-native").View, {
          testID: "mood-probe",
          style: { backgroundColor: ui.useMoodColors().header },
        });
      return (
        <>
          <Probe />
          {mockShowHeader ? React.createElement(ui.MoodHeader, { title: "Judul uji" }) : null}
          {mockShowToggle ? React.createElement(ui.MoodToggle) : null}
          {children}
        </>
      );
    },
    {
      Screen: ({ name }: { name: string }) => {
        if (name !== "(tabs)") return null;
        const TabsLayout = require("../app/(tabs)/_layout").default;
        return <TabsLayout />;
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
const { openLink } = require("../src/nav") as { openLink: jest.Mock };
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
  // The mapped path goes to openLink, which selects a tab root or opens the screen in the current tab.
  expect(openLink).toHaveBeenCalledTimes(1);
  expect(openLink).toHaveBeenCalledWith("/hari/d-1");
  tapAll(tap("n-2", "/payment/ck-1"));
  expect(openLink).toHaveBeenLastCalledWith("/bayar/ck-1");
  tapAll(tap("n-3", "/subscriptions/s-1/menu?date=2026-11-02&meal=lunch"));
  expect(openLink).toHaveBeenLastCalledWith("/pilih-menu/s-1?date=2026-11-02&meal=lunch");
  tapAll(tap("n-4", "/calendar"));
  expect(openLink).toHaveBeenLastCalledWith("/jadwal");
  expect(openLink).toHaveBeenCalledTimes(4);
  expect(router.push).not.toHaveBeenCalled();
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

/** A trigger as the native bar reads it: its label text, and the vector glyph it draws unselected and selected. */
function readTrigger({ name, hidden, children }: MockTrigger) {
  const { NativeTabs } = require("expo-router/unstable-native-tabs");
  const parts = require("react").Children.toArray(children) as import("react").ReactElement<any>[];
  const icon = parts.find((p) => p.type === NativeTabs.Trigger.Icon);
  const label = parts.find((p) => p.type === NativeTabs.Trigger.Label);
  const glyph = (el: import("react").ReactElement<any>) => ({
    vector: el.type === NativeTabs.Trigger.VectorIcon,
    family: el.props.family,
    name: el.props.name,
  });
  return {
    name,
    hidden: !!hidden,
    label: label?.props.children as string | undefined,
    icon: icon ? { default: glyph(icon.props.src.default), selected: glyph(icon.props.src.selected) } : undefined,
  };
}

const renderTabs = () => {
  const TabsLayout = (require("../app/(tabs)/_layout") as typeof import("../app/(tabs)/_layout")).default;
  mockNativeTabs.props = undefined;
  mockNativeTabs.triggers = [];
  render(
    <AppProviders runtime={runtime}>
      <TabsLayout />
    </AppProviders>,
  );
};

describe("native tab bar", () => {
  afterEach(() => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.delete(runtime.storageKey("locale"));
  });

  it("the tab bar is the native one with Ionicons, filled when selected", async () => {
    // Signed out (no actor, the beforeEach default): the customer tabs still show.
    expect(mockActor).toBeNull();
    renderTabs();
    const Ionicons = require("@expo/vector-icons/Ionicons").default;
    const tabs = mockNativeTabs.triggers.map(readTrigger);
    const shown = tabs.filter((tab) => !tab.hidden);
    // Each tab is a group with its own stack.
    expect(shown.map((tab) => tab.name)).toEqual(["(index)", "(jadwal)", "(jelajah)", "(akun)"]);
    expect(shown.map((tab) => tab.label)).toEqual(["Beranda", "Jadwal", "Jelajah", "Akun"]);
    const glyphs: Record<string, string> = { "(index)": "home", "(jadwal)": "calendar", "(jelajah)": "search", "(akun)": "person" };
    for (const tab of shown) {
      expect(tab.icon).toEqual({
        default: { vector: true, family: Ionicons, name: `${glyphs[tab.name]}-outline` },
        selected: { vector: true, family: Ionicons, name: glyphs[tab.name] },
      });
    }
    // Nothing hidden: old /discover links are a redirect inside the tab stacks, not a trigger.
    expect(tabs.filter((tab) => tab.hidden)).toEqual([]);
    // Android: the label always shows under its icon. iOS 26: the bar shrinks while a long list scrolls down.
    expect(mockNativeTabs.props).toMatchObject({ labelVisibilityMode: "labeled", minimizeBehavior: "onScrollDown" });
    // Plus Jakarta Sans at the platform's own label size (Jest runs as Android: 12).
    expect(mockNativeTabs.props!.labelStyle).toEqual({
      default: { fontFamily: "Jakarta-SemiBold", fontSize: 12, color: nativeThemes.light.muted },
      selected: { fontFamily: "Jakarta-SemiBold", fontSize: 12, color: nativeThemes.light.forest },
    });
  });

  it("the tab labels read Home, Schedule, Explore and Account in English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
    renderTabs();
    await waitFor(() =>
      expect(mockNativeTabs.triggers.map(readTrigger).filter((tab) => !tab.hidden).map((tab) => tab.label)).toEqual([
        "Home",
        "Schedule",
        "Explore",
        "Account",
      ]),
    );
  });

  it("tab labels are Plus Jakarta Sans SemiBold at 10 on iOS and 12 on Android", () => {
    expect(tabLabelStyle("ios")).toEqual({ fontFamily: "Jakarta-SemiBold", fontSize: 10 });
    expect(tabLabelStyle("android")).toEqual({ fontFamily: "Jakarta-SemiBold", fontSize: 12 });
    // No cap on text scaling and no custom spoken label: the native bar does its own.
    expect(Object.keys(tabLabelStyle("ios")).sort()).toEqual(["fontFamily", "fontSize"]);
  });
});

describe("appearance", () => {
  beforeEach(() => {
    mockNativeTabs.props = undefined;
    mockStatusBar.style = undefined;
    mockNavTheme.value = undefined;
    // The launch mood comes from the Jakarta clock, so each test pins it: 10:00 WIB (Siang) unless it says otherwise.
    atJakarta("2026-10-09T03:00:00Z");
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockShowToggle = false;
    mockShowHeader = false;
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
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
  };

  /** The colour props the native bar received, label colours included. */
  const barColours = () => {
    const { backgroundColor, indicatorColor, rippleColor, tintColor, iconColor, labelStyle } = mockNativeTabs.props!;
    return {
      backgroundColor,
      indicatorColor,
      rippleColor,
      tintColor,
      iconColor,
      labelColor: { default: labelStyle.default.color, selected: labelStyle.selected.color },
    };
  };

  it("tab bar colours come from the theme, never the mood", async () => {
    // Pinned values: the bar surface, the forest indicator pill, forest for selected and muted for the rest.
    expect(tabBarColors(nativeThemes.light)).toEqual({
      backgroundColor: "#F2ECDF",
      indicatorColor: "#BFD8BB",
      rippleColor: "#BFD8BB",
      tintColor: "#163D2E",
      iconColor: { default: "#60675F", selected: "#163D2E" },
      labelColor: { default: "#60675F", selected: "#163D2E" },
    });
    expect(tabBarColors(nativeThemes.dark)).toEqual({
      backgroundColor: "#1E1E1C",
      indicatorColor: "#163D2E",
      rippleColor: "#163D2E",
      tintColor: "#FFF7E9",
      iconColor: { default: "#B5B2AA", selected: "#FFF7E9" },
      labelColor: { default: "#B5B2AA", selected: "#FFF7E9" },
    });
    // Control: the mood header really is Siang, then Malam, in each theme.
    const header = { light: ["#FFEFD9", "#0B1F16"], dark: ["#3A2617", "#163D2E"] };
    for (const theme of ["light", "dark"] as const) {
      jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue(theme);
      for (const [i, at] of ["2026-10-09T03:00:00Z", MALAM].entries()) {
        atJakarta(at);
        await renderRoot();
        expect(StyleSheet.flatten(screen.getByTestId("mood-probe").props.style).backgroundColor).toBe(header[theme][i]);
        // theme and time ride along so a failure names the case.
        expect({ theme, at, ...barColours() }).toEqual({ theme, at, ...tabBarColors(nativeThemes[theme]) });
        screen.unmount();
        mockNativeTabs.props = undefined;
      }
    }
  });

  it("light system scheme: light tab bar and a dark status bar", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    await renderRoot();
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#F2ECDF" });
    expect(mockStatusBar.style).toBe("dark");
    expect(mockNavTheme.value).toMatchObject({ dark: false, colors: { background: "#FDFAF3", card: "#FFFEFA" } });
  });

  /** The glyphs each mounted mood header asks for while its screen is in front (React Native's own status bar). */
  const moodGlyphs = () => screen.UNSAFE_queryAllByType(require("react-native").StatusBar).map((b) => b.props.barStyle);

  it("Malam on a light system theme: the mood header in front asks for light glyphs, pushed screens keep the theme's, and the tab bar stays theme", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    mockShowHeader = true;
    await renderRoot();
    // The app's default follows the theme: a pushed screen sits on the light canvas.
    expect(mockStatusBar.style).toBe("dark");
    // A tab root's Malam header in front sets light glyphs over it.
    expect(moodGlyphs()).toEqual(["light-content"]);
    expect(StyleSheet.flatten(screen.getByTestId("mood-probe").props.style).backgroundColor).toBe("#0B1F16");
    expect(StyleSheet.flatten(screen.getByText("Judul uji").props.style).color).toBe("#FFF7E9");
    // Pushed screens get the native header on the theme canvas, never the mood fill.
    expect(mockStack.screenOptions).toMatchObject({
      headerStyle: { backgroundColor: "#FDFAF3" },
      headerTintColor: "#2E2E2E",
      contentStyle: { backgroundColor: "#FDFAF3" },
    });
    expect(mockStack.screenOptions?.header).toBeUndefined();
    // The mood never reaches the tab bar.
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#F2ECDF" });
  });

  it("Siang on a light system theme keeps the dark status bar and the sunrise header", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    mockShowHeader = true;
    await renderRoot();
    expect(mockStatusBar.style).toBe("dark");
    expect(moodGlyphs()).toEqual(["dark-content"]);
    expect(StyleSheet.flatten(screen.getByTestId("mood-probe").props.style).backgroundColor).toBe("#FFEFD9");
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
    mockShowHeader = true;
    await renderRoot();
    expect(await screen.findByText("Demo · data sintetis")).toBeTruthy();
    // Control: the mood really is Malam here, so "dark" is the demo strip's doing and not a Siang launch.
    expect(StyleSheet.flatten(screen.getByTestId("mood-probe").props.style).backgroundColor).toBe("#0B1F16");
    expect(mockStatusBar.style).toBe("dark");
    expect(moodGlyphs()).toEqual(["dark-content"]);
    // The strip pays the status-bar inset, so the Android header adds none.
    expect(mockStack.screenOptions).toMatchObject({ unstable_nativeProps: { headerConfig: { topInsetEnabled: false } } });
  });

  it("the loading spinner and the app's default sit on the canvas, so Malam never turns them light", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
    render(<RootLayout />);
    expect(screen.UNSAFE_queryByType(require("react-native").ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("dark");
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    // Only a mood header in front sets the mood's glyphs (above); the default stays the theme's.
    expect(mockStatusBar.style).toBe("dark");
  });

  it("sets the status bar glyphs while the loading spinner is still showing", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");
    const RootLayout = (require("../app/_layout") as typeof import("../app/_layout")).default;
    render(<RootLayout />);
    // Nothing has been awaited yet, so the session read is pending and the app is behind the ready gate.
    expect(screen.UNSAFE_queryByType(require("react-native").ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("light");
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
  });

  it("dark system scheme: dark tab bar and a light status bar", async () => {
    jest.spyOn(require("react-native"), "useColorScheme").mockReturnValue("dark");
    await renderRoot();
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#1E1E1C" });
    expect(mockStatusBar.style).toBe("light");
    // Scene containers get the dark canvas, not the navigation library's light default.
    expect(mockNavTheme.value).toMatchObject({ dark: true, colors: { background: "#151514", card: "#232321", border: "#34332F" } });
  });
});
