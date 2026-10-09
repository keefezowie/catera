import { ActivityIndicator, StyleSheet } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { PackageDetail } from "../src/discover/PackageDetail";
import { offer } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const cheap = offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000 });
const MALAM = () => new Date("2026-10-09T08:00:00Z");
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

function runtimeWith(read: (id: string) => Promise<{ offer: unknown }>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    offer: jest.fn(read),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const wrap = (runtime: MobileRuntime) =>
  render(
    <MoodProvider now={MALAM}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <PackageDetail />
      </MobileProvider>
    </MoodProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "p-murah" };
});

describe("Paket without a photo to lead with", () => {
  it("shows a Malam header with the back button while the package loads", async () => {
    const view = wrap(runtimeWith(() => new Promise(() => undefined)));
    const header = await screen.findByTestId("paket-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe(
      nativeMood.light.malam.header,
    );
    expect(nativeMood.light.malam.header).toBe("#0B1F16");
    const title = within(header).getByText("Paket");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#FFF7E9");
    const back = within(header).getByRole("button", { name: "Kembali" });
    expect([flat(back).width, flat(back).height]).toEqual([48, 48]);
    expect(flat(back).backgroundColor).toBe(nativeThemes.light.surface);
    fireEvent.press(back);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(view.UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it("keeps the header when the package cannot be read, with the message and retry on the page", async () => {
    const read = jest.fn(async (): Promise<{ offer: unknown }> => {
      throw new Error("REQUEST_TIMEOUT");
    });
    wrap(runtimeWith(read));
    const header = await screen.findByTestId("paket-header");
    expect(within(header).getByText("Paket")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    expect(within(header).queryByRole("button", { name: "Coba lagi" })).toBeNull();
    const before = read.mock.calls.length;
    fireEvent.press(retry);
    expect(read.mock.calls.length).toBeGreaterThan(before);
  });

  it("keeps the header when the package is not found and still offers Jelajah paket", async () => {
    wrap(runtimeWith(async () => ({ offer: null })));
    const header = await screen.findByTestId("paket-header");
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    expect(within(header).queryByText("Paket tidak ditemukan.")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Jelajah paket" }));
    expect(router.replace).toHaveBeenCalledWith("/jelajah");
  });

  it("leaves the photo branch with its photo and no mood header (ruling B3)", async () => {
    wrap(runtimeWith(async () => ({ offer: cheap })));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(screen.queryByTestId("paket-header")).toBeNull();
    expect(screen.getByRole("button", { name: "Kembali" })).toBeTruthy();
  });
});
