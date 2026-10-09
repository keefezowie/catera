import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { RoleGate } from "../src/RoleGate";
import { ScreenGuard } from "../src/ErrorBoundary";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const MALAM = () => new Date("2026-10-08T08:00:00Z");
const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

function runtimeWith(actor: unknown): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "gate" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor, demo: false })) } as unknown as MobileRuntime["api"];
  return runtime;
}
const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MoodProvider now={MALAM}>
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        {ui}
      </MobileProvider>
    </MoodProvider>,
  );
const expectMalam = (id: string, title: string) => {
  const header = screen.getByTestId(id);
  expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe("#0B1F16");
  const heading = within(header).getByText(title);
  expect(heading.props.accessibilityRole).toBe("header");
  expect(flat(heading).color).toBe("#FFF7E9");
  return header;
};

describe("RoleGate customer-account state", () => {
  it("opens on a Malam header with the existing heading, and keeps the actions on the page", async () => {
    wrap(runtimeWith({ id: "u-c", role: "customer" }), <RoleGate>{null}</RoleGate>);
    expect(await screen.findByText("Gabung ke dapur")).toBeTruthy();
    const header = expectMalam("rolegate-header", "Buka aplikasi Catera");
    expect(within(header).queryByText("Gabung ke dapur")).toBeNull();
    expect(within(header).queryByRole("button", { name: "Buka Catera" })).toBeNull();
    expect(screen.getByRole("button", { name: "Buka Catera" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
  });
});

describe("ScreenGuard failure state", () => {
  // Its only caller is pushed under the Stack AppHeader, which already paints the mood fill: no second band here.
  it("shows the plain retry state with no mood header of its own", () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error("bad value");
    };
    wrap(
      runtimeWith(null),
      <ScreenGuard message="Catatan uang belum bisa ditampilkan.">
        <Broken />
        <Text>never</Text>
      </ScreenGuard>,
    );
    expect(screen.getByText("Catatan uang belum bisa ditampilkan.")).toBeTruthy();
    expect(screen.queryByTestId("guard-header")).toBeNull();
    expect(screen.queryByTestId("mood-fill-siang", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    errorLog.mockRestore();
  });
});
