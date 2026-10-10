import fs from "node:fs";
import path from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import * as ReactNative from "react-native";

const mockParams = { date: "2030-01-03" };
const mockMe: { demo: boolean; actor: { id: string; role: string; name: string; catererId: string } | null } = {
  demo: false,
  actor: null,
};
const mockStatusBar: { style?: string } = {};
// When set, the stack also draws the Siang / Malam toggle, the way a screen with a mood header does.
let mockShowToggle = false;
// When set, the tabs also render one tab's own stack (the shared group layout) under this segment, so its titles show.
let mockTabStack: string | null = null;
const mockNavTheme: { value?: { dark: boolean; colors: Record<string, string> } } = {};
/** The props the layout hands the native tab bar. */
const mockNativeTabs: { props?: Record<string, any> } = {};
// The native bar cannot render under Jest, so a stand-in records its props instead.
jest.mock("expo-router/unstable-native-tabs", () => {
  const Trigger = Object.assign(() => null, { Icon: () => null, Label: () => null, Badge: () => null, VectorIcon: () => null });
  const NativeTabs = Object.assign(
    ({ children: _children, ...props }: { children?: unknown }) => {
      mockNativeTabs.props = props;
      return null;
    },
    { Trigger },
  );
  return { NativeTabs };
});

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  /** Renders each registered screen's header title the way the native stack would show it. The tab group renders
   * its real layout, so the tab bar is checked under the same providers the app mounts. */
  const Screen = ({ name, options }: any) => {
    if (name === "(tabs)") {
      const TabsLayout = require("../app/(tabs)/_layout").default;
      const TabStack = require("../app/(tabs)/(index,pelanggan,menu,usaha)/_layout").default;
      return (
        <>
          <TabsLayout />
          {mockTabStack ? <TabStack segment={mockTabStack} /> : null}
        </>
      );
    }
    const resolved = typeof options === "function" ? options({ route: { name, params: mockParams } }) : options;
    if (resolved?.headerShown === false) return null;
    return <Text testID={`header:${name}`}>{resolved?.title ?? name}</Text>;
  };
  // The stack also renders its shared header once, the way a pushed screen shows it.
  const Stack: any = ({ children, screenOptions }: any) => (
    <View>
      {screenOptions?.header
        ? screenOptions.header({ options: { title: "Judul uji" }, navigation: { goBack: () => {} }, back: { title: "x" } })
        : null}
      {mockShowToggle ? React.createElement(require("@catera/mobile-ui").MoodToggle) : null}
      {children}
    </View>
  );
  Stack.Screen = Screen;
  Stack.Protected = ({ guard, children }: any) => (guard ? children : null);
  // The root hands the navigator a theme built from the palette; the library defaults are stood in by plain objects.
  const DefaultTheme = { dark: false, colors: { background: "rgb(242, 242, 242)" } };
  const DarkTheme = { dark: true, colors: { background: "rgb(1, 1, 1)" } };
  const ThemeProvider = ({ value, children }: any) => {
    mockNavTheme.value = value;
    return children;
  };
  return {
    Stack,
    DefaultTheme,
    DarkTheme,
    ThemeProvider,
    Redirect: () => null,
    router: { push: jest.fn(), replace: jest.fn() },
    Link: () => null,
    useNavigationContainerRef: () => ({ isReady: () => false }),
  };
});
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
const mockFonts: { result: [boolean, Error | null] } = { result: [true, null] };
jest.mock("expo-font", () => ({ useFonts: () => mockFonts.result }));
jest.mock("expo-status-bar", () => ({
  StatusBar: (props: { style?: string }) => {
    mockStatusBar.style = props.style;
    return null;
  },
}));
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: mockMe.actor, demo: mockMe.demo })) };
  return { runtime };
});
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

import { jakartaDay } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { tabBarColors } from "@catera/mobile-ui";
import RootLayout from "../app/_layout";
import { runtime } from "../src/runtime";

const TAB_ROOTS = ["index", "pelanggan", "menu", "usaha"];

/**
 * Every pushed file route under app/: the root stack's (Aktifkan, Impor) and the tab stacks' (in
 * `(tabs)/(index,pelanggan,menu,usaha)`). Layouts, the auth group and the tab roots, which have no header, are left out.
 */
function pushedRoutes(dir = path.join(__dirname, "..", "app"), prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_layout.tsx" || entry.name === "(auth)") return [];
    if (entry.isDirectory())
      return pushedRoutes(path.join(dir, entry.name), entry.name.startsWith("(") ? prefix : `${prefix}${entry.name}/`);
    const route = `${prefix}${entry.name.replace(/\.tsx?$/, "")}`;
    return dir.endsWith("(index,pelanggan,menu,usaha)") && TAB_ROOTS.includes(route) ? [] : [route];
  });
}

describe("demo strip", () => {
  afterEach(() => {
    mockMe.demo = false;
  });

  it("shows the synthetic-data strip when the server reports demo", async () => {
    mockMe.demo = true;
    render(<RootLayout />);
    expect(await screen.findByText("Demo · data sintetis")).toBeTruthy();
  });

  it("shows no strip outside demo mode", async () => {
    render(<RootLayout />);
    await screen.findByTestId("header:(auth)/daftar");
    expect(screen.queryByText("Demo · data sintetis")).toBeNull();
  });
});

describe("stack headers", () => {
  // An owner opens every pushed screen; the root stack and one tab's stack are both drawn.
  beforeEach(() => {
    mockMe.actor = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
    mockTabStack = "(index)";
  });
  afterEach(() => {
    mockMe.actor = null;
    mockTabStack = null;
  });

  it("titles every pushed route in Indonesian instead of its route path", async () => {
    render(<RootLayout />);
    await screen.findByTestId("header:pelanggan/[id]");
    const routes = pushedRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(8);
    for (const route of routes) {
      const header = screen.getByTestId(`header:${route}`);
      const title = String(header.props.children);
      expect(title).not.toMatch(/[\[\]/]/);
      expect(title).not.toBe(route);
    }
    const titleOf = (route: string) => String(screen.getByTestId(`header:${route}`).props.children);
    expect(titleOf("pelanggan/[id]")).toBe("Pelanggan");
    expect(titleOf("paket/[id]")).toBe("Paket");
    expect(titleOf("paket/baru")).toBe("Paket baru");
    expect(titleOf("aktifkan")).toBe("Aktifkan pembayaran");
    expect(titleOf("tim")).toBe("Tim");
    expect(titleOf("impor")).toBe("Impor pelanggan");
    expect(titleOf("uang")).toBe("Uang");
    expect(titleOf("laporan/[id]")).toBe("Laporan masalah");
    expect(titleOf("menu/[date]")).toMatch(/^Menu /);
  });

  it("names the day on the menu screen header", async () => {
    mockParams.date = "2030-01-03";
    render(<RootLayout />);
    expect((await screen.findByTestId("header:menu/[date]")).props.children).toBe("Menu Kamis 3 Jan");
  });

  it("says Menu hari ini only for today's menu", async () => {
    mockParams.date = jakartaDay(new Date());
    render(<RootLayout />);
    expect((await screen.findByTestId("header:menu/[date]")).props.children).toBe("Menu hari ini");
  });
});

describe("appearance", () => {
  const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };

  beforeEach(() => {
    mockNativeTabs.props = undefined;
    mockStatusBar.style = undefined;
    mockNavTheme.value = undefined;
    // The launch mood comes from the Jakarta clock, so each test pins it: 10:00 WIB (Siang) unless it says otherwise.
    atJakarta("2026-10-09T03:00:00Z");
  });

  afterEach(() => {
    mockMe.actor = null;
    mockMe.demo = false;
    mockShowToggle = false;
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.delete(runtime.storageKey("locale"));
    jest.useRealTimers();
    jest.restoreAllMocks();
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

  it("Malam on a light system theme: light status bar glyphs and a mood header on pushed screens, but the tab bar stays theme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
    expect(mockStatusBar.style).toBe("light");
    const header = ReactNative.StyleSheet.flatten(screen.getByTestId("app-header").props.style);
    expect(header.backgroundColor).toBe("#0B1F16");
    expect(ReactNative.StyleSheet.flatten(screen.getByText("Judul uji").props.style).color).toBe("#FFF7E9");
    // The mood never reaches the tab bar.
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#F2ECDF" });
  });

  it("Dapur tab bar colours come from the theme, never the mood", async () => {
    mockMe.actor = owner;
    // Control: the mood header really is Siang, then Malam, in each theme.
    const header = { light: ["#FFEFD9", "#0B1F16"], dark: ["#3A2617", "#163D2E"] };
    for (const theme of ["light", "dark"] as const) {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(theme);
      for (const [i, at] of ["2026-10-09T03:00:00Z", MALAM].entries()) {
        atJakarta(at);
        mockNativeTabs.props = undefined;
        render(<RootLayout />);
        await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
        await act(async () => {});
        const headerFill = ReactNative.StyleSheet.flatten(screen.getByTestId("app-header").props.style).backgroundColor;
        expect(headerFill).toBe(header[theme][i]);
        const bar = tabBarColors(nativeThemes[theme]);
        const { labelStyle, ...props } = mockNativeTabs.props!;
        // theme and time ride along so a failure names the case.
        expect({ theme, at, ...props }).toMatchObject({
          theme,
          at,
          backgroundColor: bar.backgroundColor,
          indicatorColor: bar.indicatorColor,
          rippleColor: bar.rippleColor,
          tintColor: bar.tintColor,
          iconColor: bar.iconColor,
        });
        expect({ default: labelStyle.default.color, selected: labelStyle.selected.color }).toEqual(bar.labelColor);
        screen.unmount();
      }
    }
  });

  it("Siang on a light system theme keeps the dark status bar and the sunrise header", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
    expect(mockStatusBar.style).toBe("dark");
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId("app-header").props.style).backgroundColor).toBe("#FFEFD9");
  });

  it("the Siang / Malam toggle reads Lunch and Dinner in English", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
    mockShowToggle = true;
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    expect(await screen.findByRole("tab", { name: "Lunch" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Siang" })).toBeNull();
  });

  it("the Siang / Malam toggle reads Siang and Malam by default", async () => {
    mockShowToggle = true;
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
    expect(screen.getByRole("tab", { name: "Siang" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Malam" })).toBeTruthy();
  });

  it("demo on and Malam: the demo strip sits above the header, so the status bar glyphs are dark", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    mockMe.demo = true;
    mockMe.actor = owner;
    render(<RootLayout />);
    expect(await screen.findByText("Demo · data sintetis")).toBeTruthy();
    await act(async () => {});
    // Control: the mood really is Malam here, so "dark" is the demo strip's doing and not a Siang launch.
    expect(ReactNative.StyleSheet.flatten(screen.getByTestId("app-header").props.style).backgroundColor).toBe("#0B1F16");
    expect(mockStatusBar.style).toBe("dark");
  });

  it("the loading spinner sits on the canvas, so Malam does not turn its status bar glyphs light", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    atJakarta(MALAM);
    mockMe.actor = owner;
    render(<RootLayout />);
    expect(screen.UNSAFE_queryByType(ReactNative.ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("dark");
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    expect(mockStatusBar.style).toBe("light");
  });

  it("follows a dark system scheme in the tab bar and the status bar", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#1E1E1C" });
    expect(mockStatusBar.style).toBe("light");
    // Scene containers get the dark canvas, not the navigation library's light default.
    expect(mockNavTheme.value).toMatchObject({ dark: true, colors: { background: "#151514", card: "#232321", border: "#34332F" } });
  });

  it("sets the status bar glyphs while the loading spinner is still showing", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    mockMe.actor = owner;
    render(<RootLayout />);
    // Nothing has been awaited yet, so the session read is pending and the app is behind the ready gate.
    expect(screen.UNSAFE_queryByType(ReactNative.ActivityIndicator)).not.toBeNull();
    expect(mockStatusBar.style).toBe("light");
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
  });

  it("keeps the light tab bar and a dark status bar on a light system scheme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockNativeTabs.props).toBeDefined());
    await act(async () => {});
    expect(mockNativeTabs.props).toMatchObject({ backgroundColor: "#F2ECDF" });
    expect(mockStatusBar.style).toBe("dark");
    expect(mockNavTheme.value).toMatchObject({ dark: false, colors: { background: "#FDFAF3", card: "#FFFEFA" } });
  });
});

describe("font load failure", () => {
  afterEach(() => {
    mockFonts.result = [true, null];
  });

  it("Dapur shows a font error message", () => {
    mockFonts.result = [false, new Error("font")];
    render(<RootLayout />);
    expect(screen.getByText("Font tidak dapat dimuat. Mulai ulang aplikasi.")).toBeTruthy();
  });
});
