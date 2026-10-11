import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AppState, Dimensions, Linking, StyleSheet, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, themeChoiceLabels, ToastProvider } from "@catera/mobile-ui";
import { Akun } from "../src/account/Akun";
import { Pengaturan } from "../src/settings/Pengaturan";
import { BahasaSheet, TampilanSheet } from "../src/settings/ChoiceSheets";
import { customerLink } from "../src/links";
import { customerState } from "./fixtures";

/** Every screen focus the stand-in router has seen; `focus()` replays them, as returning to the screen does. */
const mockFocus = new Set<() => void>();
const focus = () => act(() => mockFocus.forEach((effect) => effect()));

jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Link: () => null,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void) => {
      useEffect(() => {
        mockFocus.add(effect);
        effect();
        return () => void mockFocus.delete(effect);
      }, [effect]);
    },
  };
});
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn() }));
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
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const FLAG = "catera.push.u-c1";
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;
const constants = () => (require("expo-constants") as { default: { executionEnvironment?: string } }).default;

function runtimeWith({ actor = customer as Record<string, unknown> | null } = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(async () => customerState(null)),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
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

/** The labels of every row and the switch, top to bottom. */
const rowNames = () =>
  screen
    .getAllByTestId(/^settings-(row|switch-row)$/)
    .map((row) => within(row).getAllByTestId("settings-label")[0].props.children as string);

const notificationSwitch = () => screen.getByRole("switch", { name: "Notifikasi di ponsel ini" });

type Node = { type: unknown; props: Record<string, unknown>; parent: Node | null };
const isInside = (inner: unknown, outer: unknown) => {
  for (let n = inner as Node | null; n; n = n.parent) if (n === outer) return true;
  return false;
};
/**
 * A fit sheet that can outgrow the screen (a larger font on a small phone): its choices sit in one vertical scroller
 * that may shrink, inside a frame no taller than the window, with the title row fixed above it.
 */
function expectFitScrolls(title: string, reachable: unknown[]) {
  const scrollers = screen.UNSAFE_root.findAll((n) => n.type === "RCTScrollView" && !n.props.horizontal) as unknown as Node[];
  expect(scrollers).toHaveLength(1);
  const [scroller] = scrollers;
  for (const node of reachable) expect(isInside(node, scroller)).toBe(true);
  expect(isInside(screen.getByRole("header", { name: title }), scroller)).toBe(false);
  expect(StyleSheet.flatten(scroller.props.style as never)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  expect(scroller.props.nestedScrollEnabled).toBe(true);
  // The nearest frame above the scroller that sets a height cap.
  let cap: unknown;
  for (let n = scroller.parent; n && cap === undefined; n = n.parent)
    cap = (StyleSheet.flatten(n.props.style as never) as { maxHeight?: number } | undefined)?.maxHeight;
  expect(typeof cap).toBe("number");
  expect(cap as number).toBeLessThan(Dimensions.get("window").height);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.clear();
  store().clear();
  delete constants().executionEnvironment;
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined", canAskAgain: true });
});

describe("Pengaturan entry", () => {
  it("Akun has a Pengaturan entry and no inline Bahasa or Tampilan", async () => {
    renderWith(runtimeWith(), <Akun />);
    expect(await screen.findByText("Rani Contoh")).toBeTruthy();
    const entries = screen.getAllByRole("button", { name: "Pengaturan" });
    // The gear in the header and the last row of the page.
    expect(entries).toHaveLength(2);
    expect(within(screen.getByTestId("akun-header")).getByRole("button", { name: "Pengaturan" })).toBeTruthy();
    for (const entry of entries) {
      fireEvent.press(entry);
      expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
    }
    expect(screen.queryByText("Bahasa")).toBeNull();
    expect(screen.queryByText("Tampilan")).toBeNull();
    expect(screen.queryByRole("tab", { name: "English" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
    // Notifikasi still opens the updates list; it no longer claims a push state.
    expect(screen.getByRole("button", { name: "Notifikasi" })).toBeTruthy();
  });

  it("signed-out Akun keeps the Pengaturan entry", async () => {
    renderWith(runtimeWith({ actor: null }), <Akun />);
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Pengaturan" })).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "English" })).toBeNull();
  });
});

describe("Pengaturan", () => {
  it("Pengaturan lists Notifikasi, Bahasa, Tampilan, Versi aplikasi, Syarat dan privasi and Keluar in that order", async () => {
    renderWith(runtimeWith(), <Pengaturan />);
    expect(await screen.findByRole("switch", { name: "Notifikasi di ponsel ini" })).toBeTruthy();
    // Android sets the screen's name as its first content line, then the three section labels.
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Pengaturan", "Notifikasi", "Aplikasi", "Tentang"]);
    expect(rowNames()).toEqual([
      "Notifikasi di ponsel ini",
      "Bahasa",
      "Tampilan",
      "Versi aplikasi",
      "Syarat dan privasi",
      "Keluar",
    ]);
    expect(screen.getByText("Makanan berangkat, menu besok, pembayaran")).toBeTruthy();
    // Each row shows its current value; Android (the Jest build) words the system theme "Ikuti sistem".
    expect(screen.getByRole("button", { name: "Bahasa, Indonesia" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tampilan, Ikuti sistem" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Bahasa, Indonesia" }));
    expect(router.push).toHaveBeenLastCalledWith("/pengaturan/bahasa");
    fireEvent.press(screen.getByRole("button", { name: "Tampilan, Ikuti sistem" }));
    expect(router.push).toHaveBeenLastCalledWith("/pengaturan/tampilan");
    // There is no terms page on the web yet, so the row says so instead of opening nothing.
    expect(screen.queryByRole("button", { name: /Syarat dan privasi/ })).toBeNull();
    expect(screen.getByText("Segera hadir")).toBeTruthy();
    const keluar = screen.getByRole("button", { name: "Keluar" });
    expect(StyleSheet.flatten(within(keluar).getByText("Keluar").props.style).color).toBe(nativeThemes.light.danger);
  });

  it("Keluar signs out and returns to Beranda", async () => {
    const runtime = runtimeWith();
    renderWith(runtime, <Pengaturan />);
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    // Every tab back at its root, so Akun opens on its sign-in prompt and not on this signed-out Pengaturan.
    await waitFor(() => expect(require("../src/nav").goToTab).toHaveBeenCalledWith("index", { everyTab: true }));
  });

  it("signed out shows Bahasa and Tampilan only", async () => {
    renderWith(runtimeWith({ actor: null }), <Pengaturan />);
    expect(await screen.findByRole("button", { name: "Bahasa, Indonesia" })).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByText("Notifikasi")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
    // The only things to change are the language and the theme; Tentang stays as information.
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      "Bahasa, Indonesia",
      "Tampilan, Ikuti sistem",
    ]);
    expect(screen.getByText("Versi aplikasi")).toBeTruthy();
  });

  it("Versi aplikasi reads the app config version", async () => {
    renderWith(runtimeWith(), <Pengaturan />);
    const version = await screen.findByText("2.4.1");
    expect(version.props.selectable).toBe(true);
    expect(StyleSheet.flatten(version.props.style).fontVariant).toEqual(["tabular-nums"]);
    // The switch's first read settles before the screen goes away.
    expect(await screen.findByRole("switch", { name: "Notifikasi di ponsel ini" })).toBeTruthy();
  });

  it("speaks English after the language changes", async () => {
    renderWith(
      runtimeWith(),
      <>
        <Pengaturan />
        <BahasaSheet />
      </>,
    );
    fireEvent.press(await screen.findByRole("radio", { name: "English" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.locale", "en");
    expect(await screen.findByRole("button", { name: "Language, English" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Appearance, Follow system" })).toBeTruthy();
    expect(screen.getByText("Meals on the way, tomorrow's menu, payments")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("large text grows the rows: minimum heights only and no truncated line", async () => {
    renderWith(runtimeWith(), <Pengaturan />);
    await screen.findByRole("switch", { name: "Notifikasi di ponsel ini" });
    for (const row of screen.getAllByTestId(/^settings-(row|switch-row)$/)) {
      const style = StyleSheet.flatten(row.props.style) ?? {};
      expect(style.height).toBeUndefined();
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    for (const label of screen.getAllByTestId("settings-label")) expect(label.props.numberOfLines).toBeUndefined();
  });
});

describe("notification switch", () => {
  it("turning on asks for permission, registers this phone and remembers it", async () => {
    const runtime = runtimeWith();
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined", canAskAgain: true });
    fireEvent(notificationSwitch(), "valueChange", true);
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "device.register",
        { token: "ExponentPushToken[synthetic-phone]" },
        expect.any(String),
      ),
    );
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(store().get(FLAG)).toBe("on"));
    expect(notificationSwitch()).toBeChecked();
  });

  it("stays on after leaving and coming back, because the phone and the flag both say so", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    const first = renderWith(runtimeWith(), <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    first.unmount();
    renderWith(runtimeWith(), <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
  });

  it("the switch reads the phone permission on focus", async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtimeWith(), <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    // Notifications were turned off in the phone's own settings while Catera was away.
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied", canAskAgain: false });
    focus();
    await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
    expect(screen.getByText("Izinkan notifikasi di Pengaturan ponsel")).toBeTruthy();
  });

  it("reads the permission again when the app returns from the phone's settings", async () => {
    const listeners: ((s: AppStateStatus) => void)[] = [];
    // AppState is already a Jest stand-in here; it is swapped for one that keeps the listeners, and put back after.
    const original = AppState.addEventListener;
    AppState.addEventListener = ((_type: string, listener: (s: AppStateStatus) => void) => {
      listeners.push(listener);
      return { remove: () => undefined };
    }) as typeof AppState.addEventListener;
    try {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
      store().set(FLAG, "on");
      const view = renderWith(runtimeWith(), <Pengaturan />);
      await waitFor(() => expect(notificationSwitch()).toBeChecked());
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied", canAskAgain: false });
      act(() => listeners.forEach((l) => l("background")));
      act(() => listeners.forEach((l) => l("active")));
      await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
      expect(screen.getByText("Izinkan notifikasi di Pengaturan ponsel")).toBeTruthy();
      view.unmount();
    } finally {
      AppState.addEventListener = original;
    }
  });

  it("denied by the phone: the switch stays off and Buka Pengaturan opens the phone settings", async () => {
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied", canAskAgain: false });
    store().set(FLAG, "on");
    renderWith(runtimeWith(), <Pengaturan />);
    expect(await screen.findByText("Izinkan notifikasi di Pengaturan ponsel")).toBeTruthy();
    // Never on while the system blocks it, even though this phone was registered earlier.
    expect(notificationSwitch()).not.toBeChecked();
    fireEvent.press(screen.getByRole("button", { name: "Buka Pengaturan" }));
    expect(open).toHaveBeenCalledTimes(1);
    // Flipping it asks the phone again, and the switch does not show on even for the moment the question takes.
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "denied", canAskAgain: false });
    fireEvent(notificationSwitch(), "valueChange", true);
    expect(notificationSwitch()).not.toBeChecked();
    await waitFor(() => expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1));
    expect(notificationSwitch()).not.toBeChecked();
    expect(screen.getByText("Izinkan notifikasi di Pengaturan ponsel")).toBeTruthy();
    open.mockRestore();
  });

  it("a refused permission request leaves the switch off with the system-settings line", async () => {
    const runtime = runtimeWith();
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: "denied", canAskAgain: false });
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
    fireEvent(notificationSwitch(), "valueChange", true);
    expect(await screen.findByText("Izinkan notifikasi di Pengaturan ponsel")).toBeTruthy();
    expect(notificationSwitch()).not.toBeChecked();
    expect(runtime.api.command).not.toHaveBeenCalledWith("device.register", expect.anything(), expect.anything());
  });

  it("turning off sends device.unregister with this device's token and clears the flag", async () => {
    const runtime = runtimeWith();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    fireEvent(notificationSwitch(), "valueChange", false);
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "device.unregister",
        { token: "ExponentPushToken[synthetic-phone]" },
        expect.any(String),
      ),
    );
    await waitFor(() => expect(store().has(FLAG)).toBe(false));
    expect(notificationSwitch()).not.toBeChecked();
    expect(screen.queryByText("Belum berhasil. Coba lagi.")).toBeNull();
  });

  it("a failed turn-off keeps the switch on and shows the error toast", async () => {
    const runtime = runtimeWith();
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    fireEvent(notificationSwitch(), "valueChange", false);
    expect(await screen.findByText("Belum berhasil. Coba lagi.")).toBeTruthy();
    expect(notificationSwitch()).toBeChecked();
    expect(store().get(FLAG)).toBe("on");
  });

  it("a failed turn-on returns the switch to off, says so once and never shows the code", async () => {
    const runtime = runtimeWith();
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).not.toBeChecked());
    fireEvent(notificationSwitch(), "valueChange", true);
    expect(await screen.findByText("Belum berhasil. Coba lagi.")).toBeTruthy();
    expect(notificationSwitch()).not.toBeChecked();
    expect(screen.queryByText("REQUEST_TIMEOUT")).toBeNull();
    expect(store().has(FLAG)).toBe(false);
  });

  it("Expo Go shows the switch as unavailable", async () => {
    constants().executionEnvironment = "storeClient";
    renderWith(runtimeWith(), <Pengaturan />);
    expect(await screen.findByText("Tidak tersedia di versi aplikasi ini")).toBeTruthy();
    expect(notificationSwitch()).not.toBeChecked();
    expect(notificationSwitch()).toBeDisabled();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("follows the dark palette: forest track and cream thumb swap with the theme", async () => {
    store().set("catera.theme", "dark");
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtimeWith(), <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    await waitFor(() => expect(notificationSwitch().props.thumbTintColor).toBe(nativeThemes.dark.cream));
    expect(notificationSwitch().props.trackColorForTrue).toBe(nativeThemes.dark.forest);
    expect(nativeThemes.dark.forest).toBe("#FFF7E9");
  });
});

describe("choice sheets", () => {
  it("Tampilan sheet applies the choice at once and closes", async () => {
    renderWith(
      runtimeWith(),
      <>
        <Pengaturan />
        <TampilanSheet />
      </>,
    );
    // The group is a container, not a focus stop of its own, so it is found by its name and checked for its role.
    const group = await screen.findByLabelText("Tampilan");
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(within(group).getByRole("radio", { name: "Ikuti sistem" })).toBeChecked();
    expect(screen.getByText("Ikuti sistem memakai pengaturan ponsel Anda.")).toBeTruthy();
    fireEvent.press(within(group).getByRole("radio", { name: "Gelap" }));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.theme", "dark");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Tampilan, Gelap" })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: "Gelap" })).toBeChecked();
  });

  it("names the system choice Sistem on iOS and Ikuti sistem on Android", () => {
    const t = (id: string) => id;
    expect(themeChoiceLabels(t, "ios")).toEqual({ system: "Sistem", light: "Terang", dark: "Gelap" });
    expect(themeChoiceLabels(t, "android")).toEqual({ system: "Ikuti sistem", light: "Terang", dark: "Gelap" });
    const en = (_id: string, english: string) => english;
    expect(themeChoiceLabels(en, "ios").system).toBe("System");
    expect(themeChoiceLabels(en, "android").system).toBe("Follow system");
  });

  it("Bahasa sheet offers Indonesia and English with the current one chosen", async () => {
    renderWith(runtimeWith(), <BahasaSheet />);
    const group = await screen.findByLabelText("Bahasa");
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(within(group).getByRole("radio", { name: "Indonesia" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "English" })).not.toBeChecked();
  });

  it.each([
    ["Tampilan", () => <TampilanSheet />, "Gelap"],
    ["Bahasa", () => <BahasaSheet />, "English"],
  ] as const)("the %s sheet scrolls under its title once it outgrows the screen", async (title, sheet, last) => {
    renderWith(runtimeWith(), sheet());
    expectFitScrolls(title, [await screen.findByRole("radio", { name: last })]);
  });
});

describe("Keluar lets go of this phone's push token", () => {
  const unregisterCalls = (runtime: MobileRuntime) =>
    (runtime.api.command as jest.Mock).mock.calls.filter(([action]) => action === "device.unregister");

  it("sign-out sends device.unregister with this phone's token before the session ends and clears the flag", async () => {
    const runtime = runtimeWith();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(unregisterCalls(runtime)).toEqual([["device.unregister", { token: "ExponentPushToken[synthetic-phone]" }, expect.any(String)]]);
    // The request still carries the session: it goes out before signOut.
    const sent = (runtime.api.command as jest.Mock).mock.invocationCallOrder[0];
    expect(sent).toBeLessThan((runtime.signOut as jest.Mock).mock.invocationCallOrder[0]);
    expect(store().has(FLAG)).toBe(false);
  });

  it("a failing unregister still signs out, and the flag stays with the token the server still holds", async () => {
    const runtime = runtimeWith();
    (runtime.api.command as jest.Mock).mockRejectedValue(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(unregisterCalls(runtime)).toHaveLength(1);
    await waitFor(() => expect(require("../src/nav").goToTab).toHaveBeenCalledWith("index", { everyTab: true }));
    expect(store().get(FLAG)).toBe("on");
    // Sign-out went through, so nothing says it failed.
    expect(screen.queryByText("Belum berhasil. Coba lagi.")).toBeNull();
  });

  it("a token read that never answers still signs out after three seconds", async () => {
    const runtime = runtimeWith();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      fireEvent.press(screen.getByRole("button", { name: "Keluar" }));
      await act(async () => void (await jest.advanceTimersByTimeAsync(2900)));
      expect(runtime.signOut).not.toHaveBeenCalled();
      await act(async () => void (await jest.advanceTimersByTimeAsync(100)));
      expect(runtime.signOut).toHaveBeenCalledTimes(1);
      expect(unregisterCalls(runtime)).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("Expo Go signs out without reading a token or sending device.unregister", async () => {
    constants().executionEnvironment = "storeClient";
    const runtime = runtimeWith();
    renderWith(runtime, <Pengaturan />);
    fireEvent.press(await screen.findByRole("button", { name: "Keluar" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(unregisterCalls(runtime)).toEqual([]);
  });
});

describe("Keluar while sign-out waits", () => {
  it("shows the row busy, dimmed and not pressable, and a second tap sends nothing", async () => {
    const runtime = runtimeWith();
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    store().set(FLAG, "on");
    renderWith(runtime, <Pengaturan />);
    await waitFor(() => expect(notificationSwitch()).toBeChecked());
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockReturnValueOnce(new Promise(() => undefined));
    jest.useFakeTimers();
    try {
      const keluar = screen.getByRole("button", { name: "Keluar" });
      expect(screen.queryByTestId("settings-row-busy")).toBeNull();
      fireEvent.press(keluar);
      await act(async () => void (await jest.advanceTimersByTimeAsync(100)));
      const row = screen.getByRole("button", { name: "Keluar" });
      expect(row.props.accessibilityState).toEqual({ busy: true, disabled: true });
      expect(within(row).getByTestId("settings-row-busy")).toBeTruthy();
      expect(StyleSheet.flatten(within(row).getByTestId("settings-row-body").props.style).opacity).toBe(0.45);
      // The label stays, so the row still says what it is doing.
      expect(within(row).getByText("Keluar")).toBeTruthy();
      fireEvent.press(row);
      await act(async () => void (await jest.advanceTimersByTimeAsync(2900)));
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
      expect(runtime.signOut).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
