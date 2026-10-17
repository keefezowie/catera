import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Dimensions, Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { MenuWeek } from "../src/menu/MenuWeek";
import { Pengaturan } from "../src/settings/Pengaturan";
import { BahasaSheet, TampilanSheet } from "../src/settings/ChoiceSheets";
import { RoleGate } from "../src/RoleGate";

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Link: () => null,
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(), MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic-kitchen]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0", extra: { eas: { projectId: "synthetic-project" } } } },
}));

const owner = { id: "u-1", role: "owner", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", catererId: "k-1" };
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

function runtimeWith(actor: Record<string, unknown> = owner): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    sellerOperations: jest.fn(async () => ({
      caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" },
      offers: [],
      dishes: [],
      datedMenus: [],
    })),
    request: jest.fn(async () => ({ active: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  runtime.signOut = jest.fn(async () => undefined);
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <ThemeProvider storageKey={runtime.storageKey("theme")}>
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <ToastProvider>{ui}</ToastProvider>
      </MobileProvider>
    </ThemeProvider>,
  );

const notificationSwitch = () => screen.getByRole("switch", { name: "Notifikasi di ponsel ini" });

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined", canAskAgain: true });
});

it("Usaha has no notifications button and links to Pengaturan", async () => {
  renderWith(runtimeWith(), <UsahaScreen />);
  expect(await screen.findByText("Dapur Bu Rina")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Nyalakan notifikasi" })).toBeNull();
  expect(screen.queryByText("Tampilan")).toBeNull();
  expect(screen.queryByRole("tab", { name: "English" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
  const gear = within(screen.getByTestId("usaha-header")).getByRole("button", { name: "Pengaturan" });
  fireEvent.press(gear);
  expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
  const rows = screen.getAllByRole("button", { name: "Pengaturan" });
  expect(rows).toHaveLength(2);
  fireEvent.press(rows[1]);
  expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
  expect(screen.getByText("Notifikasi, bahasa, tampilan")).toBeTruthy();
});

it("staff reach Pengaturan from Menu", async () => {
  renderWith(runtimeWith(staff), <MenuWeek />);
  expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Pengaturan" }));
  expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
});

it("owners keep Pengaturan on Usaha, so Menu has no gear for them", async () => {
  renderWith(runtimeWith(owner), <MenuWeek />);
  expect(await screen.findByRole("button", { name: "Buat paket" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Pengaturan" })).toBeNull();
});

it("Dapur supporting copy reads Pesanan baru, laporan, pembayaran", async () => {
  renderWith(runtimeWith(staff), <Pengaturan />);
  expect(await screen.findByText("Pesanan baru, laporan, pembayaran")).toBeTruthy();
  expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Pengaturan", "Notifikasi", "Aplikasi", "Tentang"]);
  expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
});

it("the Syarat dan privasi row opens the web page", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
  renderWith(runtimeWith(staff), <Pengaturan />);
  expect(screen.queryByText("Segera hadir")).toBeNull();
  fireEvent.press(await screen.findByRole("button", { name: "Syarat dan privasi" }));
  expect(open).toHaveBeenLastCalledWith("https://catera.example.test/syarat-dan-privasi");
  open.mockRestore();
});

it("turning on registers on the Catera Dapur channel and is still on after the screen is opened again", async () => {
  const runtime = runtimeWith();
  const first = renderWith(runtime, <Pengaturan />);
  await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
  fireEvent(notificationSwitch(), "valueChange", true);
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "device.register",
      { token: "ExponentPushToken[synthetic-kitchen]" },
      expect.any(String),
    ),
  );
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith("default", expect.objectContaining({ name: "Catera Dapur" }));
  await waitFor(() => expect(store().get("t.push.u-1")).toBe("on"));
  first.unmount();
  // The old button forgot it was on as soon as the screen closed; the switch reads the phone and the flag.
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  renderWith(runtimeWith(), <Pengaturan />);
  await waitFor(() => expect(notificationSwitch()).toBeChecked());
});

it("Keluar signs the kitchen out", async () => {
  const runtime = runtimeWith();
  renderWith(runtime, <Pengaturan />);
  fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
  await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
});

describe("Keluar lets go of this phone's push token", () => {
  const unregistered = (runtime: MobileRuntime) =>
    (runtime.api.command as jest.Mock).mock.calls.filter(([action]) => action === "device.unregister");

  it("Pengaturan's Keluar sends device.unregister before signing out and clears the flag", async () => {
    const runtime = runtimeWith(staff);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set("t.push.u-2", "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(unregistered(runtime)).toEqual([["device.unregister", { token: "ExponentPushToken[synthetic-kitchen]" }, expect.any(String)]]);
    const sent = (runtime.api.command as jest.Mock).mock.invocationCallOrder[0];
    expect(sent).toBeLessThan((runtime.signOut as jest.Mock).mock.invocationCallOrder[0]);
    expect(store().has("t.push.u-2")).toBe(false);
  });

  it("the customer-account gate's Keluar lets go of this phone's token too", async () => {
    const runtime = runtimeWith({ id: "u-c", role: "customer" });
    store().set("t.push.u-c", "on");
    renderWith(runtime, <RoleGate>{null}</RoleGate>);
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(unregistered(runtime)).toEqual([["device.unregister", { token: "ExponentPushToken[synthetic-kitchen]" }, expect.any(String)]]);
    expect(store().has("t.push.u-c")).toBe(false);
  });

  it("a refused unregister still signs the gate out", async () => {
    const runtime = runtimeWith({ id: "u-c", role: "customer" });
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" }));
    renderWith(runtime, <RoleGate>{null}</RoleGate>);
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(unregistered(runtime)).toHaveLength(1);
  });
});

it("a failed turn-off keeps the switch on and says so, never as an unhandled rejection", async () => {
  const runtime = runtimeWith();
  (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  store().set("t.push.u-1", "on");
  renderWith(runtime, <Pengaturan />);
  await waitFor(() => expect(notificationSwitch()).toBeChecked());
  fireEvent(notificationSwitch(), "valueChange", false);
  expect(await screen.findByText("Belum berhasil. Coba lagi.")).toBeTruthy();
  expect(notificationSwitch()).toBeChecked();
  expect(store().get("t.push.u-1")).toBe("on");
  expect(screen.queryByText("REQUEST_TIMEOUT")).toBeNull();
});

it("the Tampilan sheet speaks to kamu and closes on a choice", async () => {
  renderWith(runtimeWith(), <TampilanSheet />);
  expect(await screen.findByText("Ikuti sistem memakai pengaturan ponsel kamu.")).toBeTruthy();
  fireEvent.press(screen.getByRole("radio", { name: "Terang" }));
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("t.theme", "light");
  expect(router.back).toHaveBeenCalledTimes(1);
});

it.each([
  ["Tampilan", () => <TampilanSheet />, "Gelap"],
  ["Bahasa", () => <BahasaSheet />, "English"],
] as const)("the %s sheet scrolls under its title once it outgrows the screen", async (title, sheet, last) => {
  type Node = { type: unknown; props: Record<string, unknown>; parent: Node | null };
  const inside = (inner: unknown, outer: unknown) => {
    for (let n = inner as Node | null; n; n = n.parent) if (n === outer) return true;
    return false;
  };
  renderWith(runtimeWith(), sheet());
  const lastChoice = await screen.findByRole("radio", { name: last });
  const scrollers = screen.UNSAFE_root.findAll((n) => n.type === "RCTScrollView" && !n.props.horizontal) as unknown as Node[];
  expect(scrollers).toHaveLength(1);
  const [scroller] = scrollers;
  expect(inside(lastChoice, scroller)).toBe(true);
  expect(inside(screen.getByRole("header", { name: title }), scroller)).toBe(false);
  expect(StyleSheet.flatten(scroller.props.style as never)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  expect(scroller.props.nestedScrollEnabled).toBe(true);
  // The nearest frame above the scroller that sets a height cap.
  let cap: unknown;
  for (let n = scroller.parent; n && cap === undefined; n = n.parent)
    cap = (StyleSheet.flatten(n.props.style as never) as { maxHeight?: number } | undefined)?.maxHeight;
  expect(cap).toBeLessThan(Dimensions.get("window").height);
});

describe("Keluar while sign-out waits", () => {
  it("Pengaturan shows the row busy, dimmed and not pressable, and a second tap sends nothing", async () => {
    const runtime = runtimeWith(staff);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
      await act(async () => void (await jest.advanceTimersByTimeAsync(100)));
      const row = screen.getByRole("button", { name: "Keluar" });
      expect(row.props.accessibilityState).toEqual({ busy: true, disabled: true });
      expect(within(row).getByTestId("settings-row-busy")).toBeTruthy();
      expect(StyleSheet.flatten(within(row).getByTestId("settings-row-body").props.style).opacity).toBe(0.45);
      fireEvent.press(row);
      await act(async () => void (await jest.advanceTimersByTimeAsync(2900)));
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
      expect(runtime.signOut).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("the customer-account gate's Keluar is disabled while it waits, so a second tap sends nothing", async () => {
    const runtime = runtimeWith({ id: "u-c", role: "customer" });
    renderWith(runtime, <RoleGate>{null}</RoleGate>);
    const keluar = await screen.findByRole("button", { name: "Keluar" });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      fireEvent.press(keluar);
      await act(async () => void (await jest.advanceTimersByTimeAsync(100)));
      expect(screen.getByRole("button", { name: "Keluar" })).toBeDisabled();
      fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
      await act(async () => void (await jest.advanceTimersByTimeAsync(2900)));
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
      expect(runtime.signOut).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

it("Pengaturan lists Data akun after Tentang and opens it", async () => {
  renderWith(runtimeWith(), <Pengaturan />);
  const row = await screen.findByRole("button", { name: "Data akun" });
  fireEvent.press(row);
  expect(router.push).toHaveBeenCalledWith("/pengaturan/data-akun");
});
