import { render, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider } from "@catera/mobile-core";

type TabIcon = (p: { focused: boolean; color: string; size: number }) => { props: { name: string } };
const mockTabScreens: { name: string; options?: { tabBarIcon?: TabIcon } }[] = [];
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Redirect: () => null,
  Tabs: Object.assign(({ children }: { children: unknown }) => children, {
    Screen: (props: (typeof mockTabScreens)[number]) => {
      mockTabScreens.push(props);
      return null;
    },
  }),
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
