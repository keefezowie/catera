import { render, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";
import { spokenTabLabel } from "@catera/mobile-ui";
import { tabsForRole } from "../src/roles";

type TabIcon = (p: { focused: boolean; color: string; size: number }) => { props: { name: string } };
const mockTabScreens: { name: string; options?: { tabBarIcon?: TabIcon; tabBarAccessibilityLabel?: string } }[] = [];
const mockTabBar: { label?: (p: { color: string; children: string }) => import("react").ReactElement } = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: () => null,
  Tabs: Object.assign(
    ({ children, screenOptions }: { children: unknown; screenOptions?: Record<string, any> }) => {
      mockTabBar.label = screenOptions?.tabBarLabel;
      return children;
    },
    {
      Screen: (props: (typeof mockTabScreens)[number]) => {
        mockTabScreens.push(props);
        return null;
      },
    },
  ),
}));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

import TabsLayout from "../app/(tabs)/_layout";

it("Dapur tab icons are outline until focused", async () => {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "tabs" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" }, demo: false })),
  } as unknown as typeof runtime.api;
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TabsLayout />
    </MobileProvider>,
  );
  await waitFor(() => expect(mockTabScreens.length).toBeGreaterThan(0));
  const tabs = mockTabScreens.filter((s) => s.options?.tabBarIcon);
  expect(tabs.map((s) => s.name)).toEqual(["index", "pelanggan", "menu", "usaha"]);
  for (const { options } of tabs) {
    const icon = (focused: boolean) => options!.tabBarIcon!({ focused, color: "#000", size: 24 }).props.name;
    expect(icon(true)).not.toMatch(/-outline$/);
    expect(icon(false)).toBe(`${icon(true)}-outline`);
  }
});

it("Dapur tab labels stop growing at 1.15 times the system font size, so Pelanggan stays whole at font scale 1.3", async () => {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "tabs-label" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" }, demo: false })),
  } as unknown as typeof runtime.api;
  mockTabBar.label = undefined;
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TabsLayout />
    </MobileProvider>,
  );
  await waitFor(() => expect(mockTabBar.label).toBeDefined());
  const { getByText } = render(mockTabBar.label!({ color: "#123456", children: "Pelanggan" }));
  expect(getByText("Pelanggan").props.maxFontSizeMultiplier).toBe(1.15);
  expect(getByText("Pelanggan").props.numberOfLines).toBe(1);
});

it("the spoken tab label is iOS only and counts the tabs a role really has", async () => {
  // iOS: the custom label replaces the bar's own "title, tab, n of m", so each tab builds it. Android already announces
  // the tab role (TalkBack would say "tab" twice), so the layout sets none there; jest runs as Android.
  const t = (id: string) => id;
  const label = (roleTabs: string[], titles: Record<string, string>) =>
    Object.fromEntries(roleTabs.map((name, i) => [name, spokenTabLabel(titles[name], i + 1, roleTabs.length, t, "ios")]));
  const titles = { index: "Hari ini", pelanggan: "Pelanggan", menu: "Menu", usaha: "Usaha" };
  expect(label(tabsForRole("owner"), titles)).toEqual({
    index: "Hari ini, tab, 1 dari 4",
    pelanggan: "Pelanggan, tab, 2 dari 4",
    menu: "Menu, tab, 3 dari 4",
    usaha: "Usaha, tab, 4 dari 4",
  });
  expect(label(tabsForRole("staff"), titles)).toEqual({ index: "Hari ini, tab, 1 dari 2", menu: "Menu, tab, 2 dari 2" });
  expect(spokenTabLabel("Menu", 3, 4, t, "android")).toBeUndefined();

  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "tabs-spoken" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" }, demo: false })),
  } as unknown as typeof runtime.api;
  mockTabScreens.length = 0;
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TabsLayout />
    </MobileProvider>,
  );
  await waitFor(() => expect(mockTabScreens.length).toBeGreaterThan(0));
  expect(mockTabScreens.map((s) => s.options?.tabBarAccessibilityLabel)).toEqual([undefined, undefined, undefined, undefined]);
});

