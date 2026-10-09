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
const mockTabBar: { style?: Record<string, unknown>; itemStyle?: Record<string, unknown>; tint?: Record<string, unknown> } = {};

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  /** Renders each registered screen's header title the way the native stack would show it. The tab group renders
   * its real layout, so the tab bar is checked under the same providers the app mounts. */
  const Screen = ({ name, options }: any) => {
    if (name === "(tabs)") {
      const TabsLayout = require("../app/(tabs)/_layout").default;
      return <TabsLayout />;
    }
    const resolved = typeof options === "function" ? options({ route: { name, params: mockParams } }) : options;
    if (resolved?.headerShown === false) return null;
    return <Text testID={`header:${name}`}>{resolved?.title ?? name}</Text>;
  };
  const Stack: any = ({ children }: any) => <View>{children}</View>;
  Stack.Screen = Screen;
  const Tabs: any = ({ screenOptions, children }: any) => {
    mockTabBar.style = screenOptions.tabBarStyle;
    mockTabBar.itemStyle = screenOptions.tabBarItemStyle;
    mockTabBar.tint = { active: screenOptions.tabBarActiveTintColor, inactive: screenOptions.tabBarInactiveTintColor };
    return children;
  };
  Tabs.Screen = () => null;
  return { Stack, Tabs, Redirect: () => null, router: { push: jest.fn(), replace: jest.fn() }, Link: () => null };
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
import RootLayout from "../app/_layout";

/** Every file route under app/ that the root stack must name (layouts and tab/auth groups excluded). */
function pushedRoutes(dir = path.join(__dirname, "..", "app"), prefix = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_layout.tsx" || entry.name.startsWith("(")) return [];
    if (entry.isDirectory()) return pushedRoutes(path.join(dir, entry.name), `${prefix}${entry.name}/`);
    return [`${prefix}${entry.name.replace(/\.tsx?$/, "")}`];
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
    await screen.findByTestId("header:pelanggan/[id]");
    expect(screen.queryByText("Demo · data sintetis")).toBeNull();
  });
});

describe("stack headers", () => {
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
    mockTabBar.style = undefined;
    mockTabBar.itemStyle = undefined;
    mockStatusBar.style = undefined;
  });

  let restoreInsets: (() => void) | undefined;
  afterEach(() => {
    mockMe.actor = null;
    restoreInsets?.();
    restoreInsets = undefined;
    jest.restoreAllMocks();
  });

  it("follows a dark system scheme in the tab bar and the status bar", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    await act(async () => {});
    expect(mockTabBar.style).toMatchObject({ backgroundColor: "#1E1E1C", borderTopColor: "#34332F" });
    expect(mockStatusBar.style).toBe("light");
  });

  it("clears the bottom gesture inset and keeps every tab item at least 48dp", async () => {
    // The safe-area mock is a plain jest.fn that restoreAllMocks does not reset, so the default is put back by hand.
    const insets = require("react-native-safe-area-context").useSafeAreaInsets as jest.Mock;
    const original = insets.getMockImplementation();
    insets.mockImplementation(() => ({ top: 0, bottom: 24, left: 0, right: 0 }));
    restoreInsets = () => insets.mockImplementation(original);
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    await act(async () => {});
    // 64dp of bar plus the inset, with the inset as bottom padding so the labels sit above the gesture pill.
    expect(mockTabBar.style).toMatchObject({ height: 88, paddingBottom: 24 });
    expect(mockTabBar.itemStyle).toMatchObject({ minHeight: 48 });
  });

  it("is the plain 64dp tab bar when the phone has no bottom inset", async () => {
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    await act(async () => {});
    expect(mockTabBar.style).toMatchObject({ height: 64, paddingBottom: 0 });
  });

  it("keeps the light tab bar and a dark status bar on a light system scheme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    mockMe.actor = owner;
    render(<RootLayout />);
    await waitFor(() => expect(mockTabBar.style).toBeDefined());
    await act(async () => {});
    expect(mockTabBar.style).toMatchObject({ backgroundColor: "#FFFEFA", borderTopColor: "#E2E3D8" });
    expect(mockStatusBar.style).toBe("dark");
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
