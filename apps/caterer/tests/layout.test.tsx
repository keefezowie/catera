import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react-native";

const mockParams = { date: "2030-01-03" };

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  /** Renders each registered screen's header title the way the native stack would show it. */
  const Screen = ({ name, options }: any) => {
    const resolved = typeof options === "function" ? options({ route: { name, params: mockParams } }) : options;
    if (resolved?.headerShown === false) return null;
    return <Text testID={`header:${name}`}>{resolved?.title ?? name}</Text>;
  };
  const Stack: any = ({ children }: any) => <View>{children}</View>;
  Stack.Screen = Screen;
  return { Stack, router: { push: jest.fn(), replace: jest.fn() }, Link: () => null };
});
jest.mock("expo-font", () => ({ useFonts: () => [true] }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("../src/runtime", () => {
  const { createMobileRuntime } = jest.requireActual("@catera/mobile-core");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "layout" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) };
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
