import { act, render, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";
import { nativeThemes } from "@catera/design-tokens";
import { tabBarColors } from "@catera/mobile-ui";
import { tabsForRole } from "../src/roles";

/** What the layout hands the native tab bar: the bar's own props and each trigger's props (name, hidden, children). */
type MockTrigger = { name: string; hidden?: boolean; children?: import("react").ReactNode };
const mockNativeTabs: { props?: Record<string, any>; triggers: MockTrigger[] } = { triggers: [] };
const mockRedirects: string[] = [];
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));
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
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

import TabsLayout from "../app/(tabs)/_layout";

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

function renderAs(role: string | null, prefix: string) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: prefix });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({
      actor: role ? { id: "u-1", role, name: "Bu Rina", catererId: "k-1" } : null,
      demo: false,
    })),
  } as unknown as typeof runtime.api;
  mockNativeTabs.props = undefined;
  mockNativeTabs.triggers = [];
  mockRedirects.length = 0;
  return render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TabsLayout />
    </MobileProvider>,
  );
}

it("the Dapur owner's tab bar is the native one with Ionicons, filled when selected", async () => {
  renderAs("owner", "tabs-owner");
  await waitFor(() => expect(mockNativeTabs.triggers.length).toBeGreaterThan(0));
  const Ionicons = require("@expo/vector-icons/Ionicons").default;
  const tabs = mockNativeTabs.triggers.map(readTrigger);
  expect(tabs.map((tab) => [tab.name, tab.hidden])).toEqual([
    ["index", false],
    ["pelanggan", false],
    ["menu", false],
    ["usaha", false],
  ]);
  expect(tabs.map((tab) => tab.label)).toEqual(["Hari ini", "Pelanggan", "Menu", "Usaha"]);
  const glyphs: Record<string, string> = { index: "home", pelanggan: "people", menu: "book", usaha: "storefront" };
  for (const tab of tabs) {
    expect(tab.icon).toEqual({
      default: { vector: true, family: Ionicons, name: `${glyphs[tab.name]}-outline` },
      selected: { vector: true, family: Ionicons, name: glyphs[tab.name] },
    });
  }
  expect(mockNativeTabs.props).toMatchObject({ labelVisibilityMode: "labeled", minimizeBehavior: "onScrollDown" });
  // Colours come from the theme (light here, with no theme provider), never the mood.
  const bar = tabBarColors(nativeThemes.light);
  expect(mockNativeTabs.props).toMatchObject({
    backgroundColor: bar.backgroundColor,
    indicatorColor: bar.indicatorColor,
    rippleColor: bar.rippleColor,
    tintColor: bar.tintColor,
    iconColor: bar.iconColor,
  });
  expect(mockNativeTabs.props!.labelStyle).toEqual({
    default: { fontFamily: "Jakarta-SemiBold", fontSize: 12, color: bar.labelColor.default },
    selected: { fontFamily: "Jakarta-SemiBold", fontSize: 12, color: bar.labelColor.selected },
  });
});

it("staff see only their tabs", async () => {
  renderAs("staff", "tabs-staff");
  await waitFor(() => expect(mockNativeTabs.triggers.length).toBeGreaterThan(0));
  const tabs = mockNativeTabs.triggers.map(readTrigger);
  // Every route stays declared, so the navigator keeps one shape; the ones staff may not open are hidden triggers.
  expect(tabs.map((tab) => tab.name)).toEqual(["index", "pelanggan", "menu", "usaha"]);
  const allowed = tabsForRole("staff");
  expect(allowed).toEqual(["index", "menu"]);
  expect(tabs.filter((tab) => !tab.hidden).map((tab) => tab.name)).toEqual(allowed);
  expect(tabs.filter((tab) => tab.hidden).map((tab) => tab.name)).toEqual(["pelanggan", "usaha"]);
  expect(tabs.filter((tab) => !tab.hidden).map((tab) => tab.label)).toEqual(["Hari ini", "Menu"]);
});

it("signed out, Dapur goes to /masuk and draws no tab bar", async () => {
  renderAs(null, "tabs-signed-out");
  await waitFor(() => expect(mockRedirects).toContain("/masuk"));
  // Let the session read settle: it still finds no one, so the bar never mounts.
  await act(async () => {});
  expect(mockNativeTabs.props).toBeUndefined();
});
