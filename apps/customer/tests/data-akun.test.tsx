import * as ReactNative from "react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { nativeLayout, nativeThemes } from "@catera/design-tokens";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { LayoutScaleProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { DataAkun } from "../src/account/DataAkun";
import { HapusAkunRoute } from "../src/account/HapusAkun";
import { customerLink } from "../src/links";
import { customerState, eightPlans, offer, subscription } from "./fixtures";

/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

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
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn(async () => ({ type: "dismiss" })) }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const actor = { id: "u-c1", role: "customer", name: "Rani Contoh" };

type User = { id?: string; phone?: string; email?: string; app_metadata?: { provider?: string } };
type Auth = Record<string, jest.Mock>;

/** A runtime whose own session is `user` (none for a demo account) and whose auth calls are inspectable. */
function runtimeWith({ user, demo = false, state = customerState(null) }: { user?: User; demo?: boolean; state?: unknown } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  const auth: Auth = {
    getSession: jest.fn(async () => ({ data: { session: user ? { user } : null } })),
    getUser: jest.fn(async () => ({ data: { user }, error: null })),
    updateUser: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ error: null })),
    signInWithPassword: jest.fn(async () => ({ data: { session: {}, user }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: () => undefined } } })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  if (!demo)
    (runtime as { supabase: unknown }).supabase = {
      auth,
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: async () => undefined,
    };
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo })),
    customer: jest.fn(async () => state),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({ id: "r-1", status: "open" })),
  } as unknown as MobileRuntime["api"];
  return { runtime, auth };
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <ThemeProvider storageKey="data-akun-test">
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ToastProvider>{ui}</ToastProvider>
      </MobileProvider>
    </ThemeProvider>,
  );

const phoneUser: User = { id: "u-c1", phone: "6281234567890", app_metadata: { provider: "phone" } };
const emailUser: User = { id: "u-c1", email: "rani@example.test", app_metadata: { provider: "email" } };

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("Data akun", () => {
  it("Data akun hides the password row for phone accounts", async () => {
    const { runtime } = runtimeWith({ user: phoneUser });
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByRole("button", { name: /^Nomor HP, 0812-3456-7890/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Nama, Rani Contoh/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Email/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kata sandi" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hapus akun" })).toBeTruthy();
  });

  it("shows the password row for an email account", async () => {
    const { runtime } = runtimeWith({ user: emailUser });
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByRole("button", { name: /^Email, rani@example\.test/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kata sandi" })).toBeTruthy();
  });

  it("names a demo account as sample data and still offers every row", async () => {
    const { runtime } = runtimeWith({ demo: true });
    renderWith(runtime, <DataAkun />);
    expect(
      await screen.findByText("Demo (data contoh): nomor HP, email, dan kata sandi hanya disimulasikan."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kata sandi" })).toBeTruthy();
  });

  it("changes the name through profile.update and busies the button while it waits", async () => {
    const { runtime } = runtimeWith({ user: phoneUser });
    let settle = () => {};
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise((resolve) => (settle = () => resolve({ name: "Rani Baru" }))));
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: /^Nama, / }));
    const field = screen.getByLabelText("Nama");
    expect(screen.getByRole("button", { name: "Simpan nama" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(field, "Rani Baru");
    fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan nama" }).props.accessibilityState.busy).toBe(true));
    fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
    expect(runtime.api.command).toHaveBeenCalledWith("profile.update", { name: "Rani Baru" }, expect.any(String));
    await act(async () => settle());
    await waitFor(() => expect(screen.queryByLabelText("Nama")).toBeNull());
  });

  it("sends a code to the new number, then saves it with the code", async () => {
    const { runtime, auth } = runtimeWith({ user: phoneUser });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: /^Nomor HP, / }));
    fireEvent.changeText(screen.getByLabelText("Nomor HP baru"), "0812 5555 0000");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ phone: "+6281255550000" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Simpan nomor" }));
    await waitFor(() =>
      expect(auth.verifyOtp).toHaveBeenCalledWith({ phone: "+6281255550000", token: "123456", type: "phone_change" }),
    );
  });

  it("asks for the email change by link and says nothing has changed yet", async () => {
    const { runtime, auth } = runtimeWith({ user: emailUser });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: /^Email, / }));
    fireEvent.changeText(screen.getByLabelText("Email baru"), "baru@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan" }));
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ email: "baru@example.test" }));
    expect((await screen.findByTestId("email-sent")).props.children).toMatch(/Email baru berlaku setelah kedua tautan dibuka/);
  });

  it("changes the password after checking the current one", async () => {
    const { runtime, auth } = runtimeWith({ user: emailUser });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Kata sandi" }));
    const save = () => screen.getByRole("button", { name: "Ganti kata sandi" });
    expect(save().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Kata sandi saat ini"), "lama-1234");
    fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "baru-12345");
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi baru"), "baru-1234x");
    expect(save().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi baru"), "baru-12345");
    expect(save().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(save());
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: "baru-12345" }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "rani@example.test", password: "lama-1234" });
  });

  it("puts a failed change in the form error, in words that say what to do", async () => {
    const { runtime, auth } = runtimeWith({ user: emailUser });
    auth.signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: { status: 400 } });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Kata sandi" }));
    fireEvent.changeText(screen.getByLabelText("Kata sandi saat ini"), "salah-1234");
    fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "baru-12345");
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi baru"), "baru-12345");
    fireEvent.press(screen.getByRole("button", { name: "Ganti kata sandi" }));
    const error = await screen.findByTestId("password-error");
    expect(within(error).getByText("Kata sandi saat ini belum cocok.")).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("says a simulated demo change did not change anything", async () => {
    const { runtime } = runtimeWith({ demo: true });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Kata sandi" }));
    fireEvent.changeText(screen.getByLabelText("Kata sandi saat ini"), "lama-1234");
    fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "baru-12345");
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi baru"), "baru-12345");
    fireEvent.press(screen.getByRole("button", { name: "Ganti kata sandi" }));
    expect(await screen.findByText("Contoh saja: kata sandi tidak berubah")).toBeTruthy();
    expect(screen.queryByText("Kata sandi diganti")).toBeNull();
  });

  it("rows that open an editor say whether it is open, and the editor takes the focus", async () => {
    const { runtime } = runtimeWith({ user: emailUser });
    renderWith(runtime, <DataAkun />);
    const row = await screen.findByRole("button", { name: /^Nama, / });
    expect(row.props.accessibilityState.expanded).toBe(false);
    fireEvent.press(row);
    expect(screen.getByRole("button", { name: /^Nama, / }).props.accessibilityState.expanded).toBe(true);
    expect(screen.getByLabelText("Nama").props.autoFocus).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: /^Nama, / }));
    expect(screen.getByRole("button", { name: /^Nama, / }).props.accessibilityState.expanded).toBe(false);
  });

  it("moves the screen reader to the editor's first field, not just the keyboard", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    const { runtime } = runtimeWith({ user: emailUser });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: /^Nama, / }));
    await waitFor(() => expect(focus).toHaveBeenCalled());
    const [target, event] = focus.mock.calls.at(-1) as [{ props: { accessibilityLabel?: string } }, string];
    expect(event).toBe("focus");
    expect(target.props.accessibilityLabel).toBe("Nama");
    focus.mockRestore();
  });

  it("in demo the hints and toasts do not claim anything was sent or changed", async () => {
    const { runtime } = runtimeWith({ demo: true });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: /^Email/ }));
    fireEvent.changeText(screen.getByLabelText("Email baru"), "baru@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan" }));
    expect((await screen.findByTestId("email-sent")).props.children).toBe("Demo: tidak ada email yang dikirim dan emailmu tidak berubah.");
    expect(screen.queryByText(/Kami mengirim tautan/)).toBeNull();
  });

  it("Data akun under the customer scale uses the same grouped cards, with trailing values", async () => {
    const { runtime } = runtimeWith({ user: emailUser });
    renderWith(
      runtime,
      <LayoutScaleProvider value="v2">
        <DataAkun />
      </LayoutScaleProvider>,
    );
    const email = await screen.findByRole("button", { name: "Email, rani@example.test" });
    expect(within(email).getByTestId("settings-value").props.children).toBe("rani@example.test");
    const cards = screen.getAllByTestId("settings-card");
    // The details, then Hapus akun on its own.
    expect(cards).toHaveLength(2);
    expect(StyleSheet.flatten(cards[0].props.style)).toMatchObject({ backgroundColor: nativeThemes.light.fill, borderRadius: 16 });
    expect(within(cards[1]).getByRole("button", { name: "Hapus akun" })).toBeTruthy();
  });

  it("opens the delete request sheet", async () => {
    const { runtime } = runtimeWith({ user: phoneUser });
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Hapus akun" }));
    expect(router.push).toHaveBeenCalledWith("/hapus-akun");
  });
});

describe("Hapus akun", () => {
  const running = (name: string, id: string) =>
    subscription({ id, snapshot: { offer: offer({ name }), total: 150000 } as never });

  const consequences = [
    "Pengantaran yang belum lewat dibatalkan.",
    "Riwayat dan alamat dihapus.",
    "Paket yang masih berjalan diselesaikan dulu oleh tim Catera. Kami hubungi kamu soal sisa harinya sebelum akun dihapus.",
  ];

  it("Hapus akun with 8 plans shows one callout and three consequence lines, and no plan names", async () => {
    const state = eightPlans();
    const { runtime } = runtimeWith({ user: phoneUser, state });
    renderWith(runtime, <HapusAkunRoute />);
    const callout = within(await screen.findByTestId("hapus-akun-plans"));
    expect(callout.getByText("8 paket masih berjalan")).toBeTruthy();
    expect(callout.getAllByTestId("hapus-akun-consequence").map((line) => line.props.children)).toEqual(consequences);
    for (const s of state.subscriptions) expect(screen.queryByText(new RegExp(s.snapshot.offer.name))).toBeNull();
    // Nothing in the sheet names a day, an hour or a number of days.
    expect(screen.queryByText(/\d+ (hari|jam)|dalam \d/)).toBeNull();
  });

  it.each(["light", "dark"] as const)("the plans callout stands off the sheet surface (%s)", async (scheme) => {
    const spy = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    const { runtime } = runtimeWith({ user: phoneUser, state: eightPlans() });
    renderWith(runtime, <HapusAkunRoute />);
    const ground = StyleSheet.flatten((await screen.findByTestId("hapus-akun-plans")).props.style).backgroundColor;
    expect(ground).toBe(nativeThemes[scheme].well);
    expect(ground).not.toBe(nativeThemes[scheme].surface);
    spy.mockRestore();
  });

  it("the send button is the danger variant", async () => {
    const { runtime } = runtimeWith({ user: phoneUser, state: eightPlans() });
    renderWith(runtime, <HapusAkunRoute />);
    const send = await screen.findByRole("button", { name: "Kirim permintaan hapus akun" });
    expect(StyleSheet.flatten(send.props.style).backgroundColor).toBe(nativeThemes.light.danger);
    expect(StyleSheet.flatten(within(send).getByText("Kirim permintaan hapus akun").props.style).color).toBe(nativeThemes.light.cream);
    // Batal stays a quiet text button.
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Batal" }).props.style).backgroundColor).not.toBe(
      nativeThemes.light.danger,
    );
  });

  it("the callout reads at font 1.3 and 360dp: every line wraps, none is cut", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    const { runtime } = runtimeWith({ user: phoneUser, state: eightPlans() });
    renderWith(runtime, <HapusAkunRoute />);
    const callout = await screen.findByTestId("hapus-akun-plans");
    for (const text of within(callout).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(callout.props.style).height).toBeUndefined();
    mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  });

  it("counts one plan in the singular in English, and the callout takes the card radius", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const state = { ...customerState(null), subscriptions: [running("Makan Siang Rumahan", "s-1")] };
    const { runtime } = runtimeWith({ user: phoneUser, state });
    renderWith(runtime, <HapusAkunRoute />);
    const callout = await screen.findByTestId("hapus-akun-plans");
    expect(await within(callout).findByText("1 plan still running")).toBeTruthy();
    expect(StyleSheet.flatten(callout.props.style).borderRadius).toBe(nativeLayout.radius.card);
  });

  it("Hapus akun with a running plan sends the request with the plan names for the team", async () => {
    const state = { ...customerState(null), subscriptions: [running("Makan Siang Rumahan", "s-1"), running("Paket Sehat", "s-2")] };
    const { runtime } = runtimeWith({ user: phoneUser, state });
    renderWith(runtime, <HapusAkunRoute />);
    const plans = within(await screen.findByTestId("hapus-akun-plans"));
    expect(plans.getByText("2 paket masih berjalan")).toBeTruthy();
    expect(plans.queryByText("Makan Siang Rumahan")).toBeNull();
    // The approved sentence, with no promise of a time.
    expect(plans.getByText(consequences[2])).toBeTruthy();
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Kirim permintaan hapus akun" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan hapus akun" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "accountRequest.create",
        {
          kind: "deletion",
          body: "Permintaan hapus akun dari aplikasi pelanggan. Paket berjalan: Makan Siang Rumahan, Paket Sehat.",
        },
        expect.any(String),
      ),
    );
    expect(await screen.findByTestId("hapus-akun-sent")).toBeTruthy();
    expect(screen.getByText("Akunmu belum dihapus. Tim Catera memeriksa permintaan ini lebih dulu.")).toBeTruthy();
    // Nothing in the sheet names a day, an hour or a number of days.
    expect(screen.queryByText(/\d+ (hari|jam)|dalam \d/)).toBeNull();
  });

  it("with no running plan it says nothing about plans", async () => {
    const { runtime } = runtimeWith({ user: phoneUser, state: { ...customerState(null), subscriptions: [] } });
    renderWith(runtime, <HapusAkunRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "accountRequest.create",
        { kind: "deletion", body: "Permintaan hapus akun dari aplikasi pelanggan." },
        expect.any(String),
      ),
    );
    expect(screen.queryByTestId("hapus-akun-plans")).toBeNull();
  });

  it("a failure stays at the button and sending again works from the same sheet", async () => {
    const { runtime } = runtimeWith({ user: phoneUser, state: { ...customerState(null), subscriptions: [] } });
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" }));
    renderWith(runtime, <HapusAkunRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
    expect(await screen.findByTestId("hapus-akun-error")).toBeTruthy();
    expect(screen.queryByTestId("hapus-akun-sent")).toBeNull();
    // Sending again works from the same sheet.
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan hapus akun" }));
    expect(await screen.findByTestId("hapus-akun-sent")).toBeTruthy();
  });

  it("links the privacy page", async () => {
    const { runtime } = runtimeWith({ user: phoneUser, state: { ...customerState(null), subscriptions: [] } });
    renderWith(runtime, <HapusAkunRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Baca kebijakan privasi" }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://api.example.test/syarat-dan-privasi#privasi");
  });
});


describe("Data akun reads", () => {
  it("holds the session rows as a skeleton while the session is read, never 'Belum ada'", async () => {
    const { runtime, auth } = runtimeWith({ user: phoneUser });
    auth.getSession.mockImplementation(() => new Promise(() => undefined));
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByRole("button", { name: /^Nama, / })).toBeTruthy();
    expect(screen.getByLabelText("Memuat data akun")).toBeTruthy();
    expect(screen.getAllByTestId("list-skeleton-row")).toHaveLength(2);
    expect(screen.queryByText("Belum ada")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Nomor HP/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Hapus akun" })).toBeTruthy();
  });

  it("a failed session read says so with Coba lagi, and the retry brings the rows", async () => {
    const { runtime, auth } = runtimeWith({ user: phoneUser });
    auth.getSession.mockRejectedValueOnce(new Error("offline"));
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByText(/^Belum bisa memuat nomor HP dan email/)).toBeTruthy();
    expect(screen.queryByText("Belum ada")).toBeNull();
    expect(screen.queryByTestId("list-skeleton")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByRole("button", { name: /^Nomor HP, 0812-3456-7890/ })).toBeTruthy();
    expect(screen.queryByText(/^Belum bisa memuat nomor HP/)).toBeNull();
  });

  it("a session read that resolves with an error (expired token, offline) is a failure, not 'Belum ada'", async () => {
    const { runtime, auth } = runtimeWith({ user: phoneUser });
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("fetch failed") });
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByText(/^Belum bisa memuat nomor HP dan email/)).toBeTruthy();
    expect(screen.queryByText("Belum ada")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByRole("button", { name: /^Nomor HP, 0812-3456-7890/ })).toBeTruthy();
  });

  it("a person with no phone or email still reads 'Belum ada' once the session answered", async () => {
    const { runtime } = runtimeWith({ user: { id: "u-c1", app_metadata: { provider: "email" } } });
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByRole("button", { name: /^Nomor HP, Belum ada/ })).toBeTruthy();
  });

  it("a failed read of the deletion request offers a retry for that section only", async () => {
    const { runtime } = runtimeWith({ user: phoneUser });
    (runtime.api.request as jest.Mock).mockRejectedValueOnce(new Error("REQUEST_TIMEOUT"));
    renderWith(runtime, <DataAkun />);
    expect(await screen.findByText(/^Belum bisa memeriksa permintaan hapus akun/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Nomor HP, 0812/ })).toBeTruthy();
    (runtime.api.request as jest.Mock).mockResolvedValueOnce([{ id: "r1", kind: "deletion", status: "open" }]);
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Permintaan sudah terkirim")).toBeTruthy();
    expect(screen.queryByText(/^Belum bisa memeriksa permintaan/)).toBeNull();
  });
});
