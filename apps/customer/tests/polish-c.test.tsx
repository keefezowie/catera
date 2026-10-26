import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { CustomerActionItem, CustomerState } from "@catera/domain";
import { Field, ReadError, SettingsRow, Stepper, Text } from "@catera/mobile-ui";
import { Masuk } from "../src/account/Masuk";
import { Register } from "../src/account/Register";
import { Payments } from "../src/account/Payments";
import { NotificationsScreen } from "../src/account/Notifications";
import { AddressForm } from "../src/account/AddressForm";
import { customerLink } from "../src/links";
import { customerState, TODAY } from "./fixtures";

jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 411, height: 860, scale: 3, fontScale: 1 }),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(state: Partial<CustomerState> = {}, actions: CustomerActionItem[] = []): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "polish-c" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(async () => ({ ...customerState(null), ...state })),
    customerActions: jest.fn(async () => ({ total: actions.length, items: actions })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe("shared mobile-ui primitives", () => {
  it("C1: Text passes accessibilityLiveRegion through", () => {
    render(<Text accessibilityLiveRegion="polite">Tersimpan</Text>);
    expect(screen.getByText("Tersimpan").props.accessibilityLiveRegion).toBe("polite");
  });

  it("C2: Field hides its visible label from screen readers and announces its error politely", () => {
    render(<Field label="Email" error="Email belum benar." value="" onChangeText={() => undefined} />);
    const visible = screen.getByText("Email", { includeHiddenElements: true });
    expect(visible.props.importantForAccessibility).toBe("no");
    expect(visible.props.accessibilityElementsHidden).toBe(true);
    // The input still carries the one spoken name.
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByText("Email belum benar.").props.accessibilityLiveRegion).toBe("polite");
  });

  it("C3: the Stepper count grows past its width and is exposed to screen readers", () => {
    render(<Stepper label="Porsi" value={12} onChange={() => undefined} decreaseLabel="Kurangi Porsi" increaseLabel="Tambah Porsi" />);
    const count = screen.getByText("12");
    expect(flat(count).width).toBeUndefined();
    expect(flat(count).minWidth).toBeGreaterThanOrEqual(24);
    expect(flat(count).fontVariant).toContain("tabular-nums");
    expect(screen.getByRole("button", { name: "Tambah Porsi" }).props.accessibilityValue).toEqual({ text: "12" });
    expect(screen.getByRole("button", { name: "Kurangi Porsi" }).props.accessibilityValue).toEqual({ text: "12" });
  });

  it("C4: ReadError announces its message politely", () => {
    render(<ReadError message="Belum bisa dimuat." onRetry={() => undefined} />);
    expect(screen.getByText("Belum bisa dimuat.").props.accessibilityLiveRegion).toBe("polite");
  });

  it("C5: a SettingsRow reads its supporting line and value after the label", () => {
    render(<SettingsRow label="Kata sandi" supporting="Terakhir diubah bulan lalu" onPress={() => undefined} os="android" />);
    expect(screen.getByRole("button", { name: "Kata sandi, Terakhir diubah bulan lalu" })).toBeTruthy();
    render(<SettingsRow label="Bahasa" value="Indonesia" supporting="Untuk seluruh aplikasi" onPress={() => undefined} os="ios" />);
    expect(screen.getByRole("button", { name: "Bahasa, Indonesia, Untuk seluruh aplikasi" })).toBeTruthy();
    render(<SettingsRow label="Nama" onPress={() => undefined} os="ios" />);
    expect(screen.getByRole("button", { name: "Nama" })).toBeTruthy();
  });
});

describe("Notifikasi accessibility", () => {
  const note = (id: string, read: boolean) => ({
    id,
    kind: "delivery",
    body: `Kabar ${id}`,
    href: "/deliveries/d-1",
    read_at: read ? `${TODAY}T05:00:00Z` : null,
    created_at: `${TODAY}T03:15:00Z`,
  });

  it("C6: an unread row says so in its label, with body and time; a read row does not", async () => {
    renderWith(runtimeWith({ notifications: [note("n-1", false), note("n-2", true)] as never }), <NotificationsScreen />);
    expect(await screen.findByRole("button", { name: "Belum dibaca, Kabar n-1, 10.15" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kabar n-2, 10.15" })).toBeTruthy();
  });

  it("C6: a double tap on an unread update marks it read and opens it once", async () => {
    const runtime = runtimeWith({ notifications: [note("n-1", false)] as never });
    let release: () => void = () => undefined;
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise<object>((done) => (release = () => done({}))));
    renderWith(runtime, <NotificationsScreen />);
    const row = await screen.findByRole("button", { name: /Kabar n-1/ });
    fireEvent.press(row);
    fireEvent.press(row);
    await act(async () => release());
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
  });
});

describe("Riwayat pembayaran", () => {
  it("C7: a failed feed shows its retry and not the empty state", async () => {
    const runtime = runtimeWith({ subscriptions: [] });
    (runtime.api.customerActions as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Pembayaran yang menunggu belum bisa dimuat.")).toBeTruthy();
    expect(screen.queryByText("Belum ada pembayaran.")).toBeNull();
  });

  it("C7: the Jangan bayar lagi line and a payment amount use the 13pt meta size", async () => {
    const runtime = runtimeWith(
      { subscriptions: [{ ...customerState(null).subscriptions[0], checkout_id: "ck-paid" } as never] },
      [
        {
          id: "payment-ck-2",
          kind: "payment_action",
          status: "checking_payment",
          priority: 1,
          packageName: "Paket Dicek",
          catererName: "Dapur Contoh",
          href: "/payment/ck-2",
        } as never,
      ],
    );
    renderWith(runtime, <Payments />);
    expect(flat(await screen.findByText(/^Jangan bayar lagi\./)).fontSize).toBe(13);
    expect(flat(screen.getByText(/150\.000/)).fontSize).toBe(13);
  });
});

describe("Simpan alamat fields", () => {
  it("C9: the street and instructions fields top-align, and the street field offers autofill", async () => {
    renderWith(runtimeWith(), <AddressForm />);
    const street = await screen.findByLabelText("Jalan, nomor, detail");
    expect(flat(street).textAlignVertical).toBe("top");
    expect(flat(street).paddingTop).toBe(12);
    expect(street.props.autoComplete).toBe("street-address");
    const instructions = screen.getByLabelText("Petunjuk pengantaran");
    expect(flat(instructions).textAlignVertical).toBe("top");
    expect(flat(instructions).paddingTop).toBe(12);
  });
});

describe("return keys", () => {
  it("C10: Masuk by email: next focuses the password, go submits only when both are filled", async () => {
    const runtime = runtimeWith();
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(runtime, <Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Kata sandi");
    expect(email.props.returnKeyType).toBe("next");
    expect(password.props.returnKeyType).toBe("go");
    const focus = jest.spyOn(TextInput.prototype, "focus").mockImplementation(() => undefined);
    fireEvent(email, "submitEditing");
    expect(focus).toHaveBeenCalledTimes(1);
    focus.mockRestore();

    fireEvent.changeText(email, "rani@example.test");
    fireEvent(password, "submitEditing");
    expect(runtime.signInPassword).not.toHaveBeenCalled();
    fireEvent.changeText(password, "synthetic-password");
    fireEvent(password, "submitEditing");
    await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(1));
  });

  it("C10/C11: Daftar chains name to email to password to submit, and capitalises the name", async () => {
    const runtime = runtimeWith();
    const signUp = jest.fn(async () => ({ data: { session: null, user: { id: "u-new" } }, error: null }));
    (runtime as { supabase: unknown }).supabase = {
      auth: {
        signUp,
        signOut: jest.fn(async () => ({ error: null })),
        getSession: jest.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        startAutoRefresh: () => undefined,
        stopAutoRefresh: () => undefined,
      },
      rpc: jest.fn(async () => ({ data: {}, error: null })),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: async () => undefined,
    };
    renderWith(runtime, <Register />);
    const name = await screen.findByLabelText("Nama");
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Kata sandi");
    expect(name.props.autoCapitalize).toBe("words");
    expect(name.props.returnKeyType).toBe("next");
    expect(email.props.returnKeyType).toBe("next");
    expect(password.props.returnKeyType).toBe("go");
    const focus = jest.spyOn(TextInput.prototype, "focus").mockImplementation(() => undefined);
    fireEvent(name, "submitEditing");
    fireEvent(email, "submitEditing");
    expect(focus).toHaveBeenCalledTimes(2);
    focus.mockRestore();

    fireEvent.changeText(name, "Rani Contoh");
    fireEvent.changeText(email, "rani@example.test");
    fireEvent.changeText(password, "short");
    fireEvent(password, "submitEditing");
    expect(signUp).not.toHaveBeenCalled();
    fireEvent.changeText(password, "synthetic-password");
    fireEvent(password, "submitEditing");
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
  });
});
