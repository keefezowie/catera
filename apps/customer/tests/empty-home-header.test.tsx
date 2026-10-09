import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { Beranda } from "../src/today/Beranda";
import { EmptyHome } from "../src/today/EmptyHome";
import { offer } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
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

const MALAM = () => new Date("2026-10-09T08:00:00Z");
const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

function runtimeWith(actor: Record<string, unknown> | null): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    catalog: jest.fn(async () => ({ items: [offer({ name: "Nasi Ayam Bakar" })], nextCursor: null })),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderEmpty = (actor: Record<string, unknown> | null) =>
  render(
    <MoodProvider now={MALAM}>
      <MobileProvider runtime={runtimeWith(actor)} linkMapper={customerLink}>
        <EmptyHome />
      </MobileProvider>
    </MoodProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});
// Beranda reads the cached home feed; there is none here.
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

describe("EmptyHome mood header", () => {
  it("opens on a Malam header titled Beranda, with no toggle, and the food stays on the page", async () => {
    renderEmpty(null);
    const header = await screen.findByTestId("beranda-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe("#0B1F16");
    const title = within(header).getByText("Beranda");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#FFF7E9");
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    // Existing copy and actions are untouched and sit below the header.
    expect(await screen.findByText("Mau makan apa minggu ini?")).toBeTruthy();
    expect(within(header).queryByText("Mau makan apa minggu ini?")).toBeNull();
    const card = await screen.findByRole("button", { name: /^Nasi Ayam Bakar,/ });
    expect(within(header).queryByRole("button", { name: /^Nasi Ayam Bakar,/ })).toBeNull();
    expect(flat(card).backgroundColor).toBe(nativeThemes.light.surface);
    expect(nativeThemes.light.surface).toBe("#FFFEFA");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("is titled Home in English, matching the tab label", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    renderEmpty(null);
    const header = await screen.findByTestId("beranda-header");
    expect(await within(header).findByText("Home")).toBeTruthy();
    expect(within(header).queryByText("Beranda")).toBeNull();
  });

  it("Beranda's own error and loading header is titled Home in English too", async () => {
    (require("expo-secure-store") as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const runtime = runtimeWith({ id: "u-c1", role: "customer", name: "Rani Contoh" });
    runtime.api.customer = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
    }) as never;
    (runtime.api as unknown as { customerActions: jest.Mock }).customerActions = jest.fn(async () => ({ total: 0, items: [] }));
    render(
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <Beranda />
        </MobileProvider>
      </MoodProvider>,
    );
    await screen.findByTestId("home-error");
    const header = screen.getByTestId("mood-header");
    expect(within(header).getByText("Home")).toBeTruthy();
    expect(within(header).queryByText("Beranda")).toBeNull();
  });

  it("keeps the header for a signed-in customer with no package", async () => {
    renderEmpty({ id: "u-c1", role: "customer", name: "Rani Contoh" });
    const header = await screen.findByTestId("beranda-header");
    expect(within(header).getByText("Beranda")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Masuk" })).toBeNull();
    expect(screen.getByRole("button", { name: "Jelajah paket" })).toBeTruthy();
  });
});
