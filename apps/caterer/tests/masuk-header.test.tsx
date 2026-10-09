import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { nativeMood } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { Masuk } from "../src/auth/Masuk";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const MALAM = () => new Date("2026-10-08T08:00:00Z");
const SIANG = () => new Date("2026-10-08T03:00:00Z");
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

function signedOut(): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "masuk" });
  runtime.api = { ...runtime.api, me: jest.fn(async () => ({ actor: null, demo: false })) } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderMasuk = (now = MALAM) =>
  render(
    <MoodProvider now={now}>
      <MobileProvider runtime={signedOut()} linkMapper={(h) => h}>
        <Masuk />
      </MobileProvider>
    </MoodProvider>,
  );

describe("Masuk mood header", () => {
  it("opens with Catera Dapur and its one-line purpose on the Malam header fill", async () => {
    renderMasuk();
    const header = await screen.findByTestId("masuk-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe(
      nativeMood.light.malam.header,
    );
    expect(nativeMood.light.malam.header).toBe("#0B1F16");
    const title = within(header).getByText("Catera Dapur");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#FFF7E9");
    const purpose = within(header).getByText("Masuk untuk melihat daftar masak dan antar hari ini.");
    expect(flat(purpose).color).toBe(nativeMood.light.malam.headerMeta);
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
  });

  it("uses the Siang header fill before 15.00", async () => {
    renderMasuk(SIANG);
    const header = await screen.findByTestId("masuk-header");
    expect(flat(within(header).getByTestId("mood-fill-siang")).backgroundColor).toBe(nativeMood.light.siang.header);
    expect(flat(within(header).getByText("Catera Dapur")).color).toBe(nativeMood.light.siang.headerText);
  });

  it("keeps the sign-in form on the page, outside the header", async () => {
    renderMasuk();
    const header = await screen.findByTestId("masuk-header");
    expect(screen.getByRole("button", { name: "Kirim kode" })).toBeTruthy();
    expect(within(header).queryByRole("button", { name: "Kirim kode" })).toBeNull();
    expect(within(header).queryAllByRole("tab")).toHaveLength(0);
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    expect(await screen.findByLabelText("Kata sandi")).toBeTruthy();
    expect(screen.getByTestId("masuk-header")).toBeTruthy();
  });
});
