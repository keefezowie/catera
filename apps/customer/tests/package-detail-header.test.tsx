import { ActivityIndicator, StyleSheet } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { goToTab } from "../src/nav";
import { PackageDetail } from "../src/discover/PackageDetail";
import { offer } from "./fixtures";

let mockParams: Record<string, string> = {};
/** Tab changes and leaving a screen above the tabs go through nav (navigation.test covers them on the real router). */
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn(), leaveFor: jest.fn() }));
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
/** The screen's own stack entry, as the native stack hands it over. */
const navigation = { setOptions: jest.fn(), isFocused: () => true, addListener: () => () => undefined };
const wrap = (runtime: MobileRuntime) =>
  render(
    <NavigationContext.Provider value={navigation as never}>
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <PackageDetail />
        </MobileProvider>
      </MoodProvider>
    </NavigationContext.Provider>,
  );
/** The screen's name: its Android content title (iOS shows it as the large title). */
const nativeTitle = async () => within(await screen.findByTestId("screen-native-title"));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: "p-murah" };
});

describe("Paket without a photo to lead with", () => {
  it("opens under the plain native header while the package loads, named Paket, with no mood fill even in Malam", async () => {
    const view = wrap(runtimeWith(() => new Promise(() => undefined)));
    const title = (await nativeTitle()).getByText("Paket");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe(nativeThemes.light.forest);
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    // The back is the platform's own, in the native header.
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
    expect(view.UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it("a link that carries the package name shows it while loading, never Paket", async () => {
    mockParams = { id: "p-murah", title: "Nasi Ayam Bakar" };
    wrap(runtimeWith(() => new Promise(() => undefined)));
    expect((await nativeTitle()).getByText("Nasi Ayam Bakar")).toBeTruthy();
    expect(screen.queryByText("Paket")).toBeNull();
  });

  it("keeps its title when the package cannot be read, with the message and retry on the page", async () => {
    const read = jest.fn(async (): Promise<{ offer: unknown }> => {
      throw new Error("REQUEST_TIMEOUT");
    });
    wrap(runtimeWith(read));
    expect((await nativeTitle()).getByText("Paket")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    const before = read.mock.calls.length;
    fireEvent.press(retry);
    expect(read.mock.calls.length).toBeGreaterThan(before);
  });

  it("keeps its title when the package is not found and still offers Jelajah paket", async () => {
    wrap(runtimeWith(async () => ({ offer: null })));
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
    expect((await nativeTitle()).getByText("Paket")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Jelajah paket" }));
    expect(goToTab).toHaveBeenCalledWith("jelajah");
  });
});

describe("Paket with its photo (ruling B3: the photo is the header)", () => {
  it("lays a transparent bar with no title over the photo, its back in light ink on a scrim", async () => {
    wrap(runtimeWith(async () => ({ offer: cheap })));
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      headerTransparent: true,
      headerLargeTitle: false,
      headerTitle: "",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "transparent" },
      headerTintColor: nativeThemes.light.cream,
    });
    expect(screen.queryByTestId("screen-native-title")).toBeNull();
    // No back of its own on the photo: the bar's platform back sits on the scrim.
    expect(screen.queryByRole("button", { name: "Kembali" })).toBeNull();
    const scrim = screen.getByTestId("paket-photo-scrim");
    expect(flat(scrim)).toMatchObject({ position: "absolute", top: 0, left: 0, right: 0 });
    expect(String(flat(scrim).experimental_backgroundImage)).toMatch(/^linear-gradient\(rgba\(11,31,22,0\.6\)/);
    // The heart stays on the photo, at its foot, clear of the bar.
    const heart = screen.getByRole("button", { name: "Simpan Nasi Ayam Bakar" });
    expect(flat(heart)).toMatchObject({ position: "absolute", bottom: 12, right: 16 });
    expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
  });
});
