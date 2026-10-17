import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Text as RNText } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { Pengaturan, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic-phone]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "2.4.1", extra: { eas: { projectId: "synthetic-project" } } } },
}));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

function runtimeWith(actor: Record<string, unknown> | null): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  runtime.signOut = jest.fn(async () => undefined);
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <ThemeProvider storageKey={runtime.storageKey("theme")}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ToastProvider>{ui}</ToastProvider>
      </MobileProvider>
    </ThemeProvider>,
  );

const rowNames = () =>
  screen
    .getAllByTestId(/^settings-(row|switch-row)$/)
    .map((row) => within(row).getAllByTestId("settings-label")[0].props.children as string);

const person = { id: "u-1", role: "customer", name: "Rani Contoh" };

test("both apps render the same Pengaturan rows from one component", async () => {
  const customerSide = renderWith(
    runtimeWith(person),
    <Pengaturan voice="kamu" supporting="Makanan berangkat, menu besok, pembayaran" channelName="Pengantaran & bantuan" onSignedOut={jest.fn()} />,
  );
  await screen.findByRole("switch", { name: "Notifikasi di HP ini" });
  const customerRows = rowNames();
  customerSide.unmount();
  renderWith(
    runtimeWith({ ...person, id: "u-2", role: "owner" }),
    <Pengaturan voice="kamu" supporting="Pesanan baru, laporan, pembayaran" channelName="Catera Dapur" onSignedOut={jest.fn()} />,
  );
  await screen.findByRole("switch", { name: "Notifikasi di HP ini" });
  expect(rowNames()).toEqual(customerRows);
  expect(customerRows).toEqual([
    "Notifikasi di HP ini",
    "Bahasa",
    "Tampilan",
    "Versi aplikasi",
    "Syarat dan privasi",
    "Keluar",
  ]);
  expect(screen.getByText("Pesanan baru, laporan, pembayaran")).toBeTruthy();
});

test("the after-logout hook receives onSignedOut", async () => {
  const onSignedOut = jest.fn();
  const runtime = runtimeWith(person);
  renderWith(runtime, <Pengaturan voice="kamu" supporting="x" channelName="Catera" onSignedOut={onSignedOut} />);
  fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
  expect(runtime.signOut).toHaveBeenCalled();
});

test("extraRows render after Tentang", async () => {
  renderWith(
    runtimeWith(person),
    <Pengaturan voice="kamu" supporting="x" channelName="Catera" onSignedOut={jest.fn()} extraRows={<RNText testID="extra">Data akun</RNText>} />,
  );
  const extra = await screen.findByTestId("extra");
  const about = screen.getByText("Syarat dan privasi");
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf("Data akun")).toBeGreaterThan(tree.indexOf("Syarat dan privasi"));
  expect(tree.indexOf("Data akun")).toBeLessThan(tree.indexOf("Keluar"));
  expect(extra).toBeTruthy();
  expect(about).toBeTruthy();
});
