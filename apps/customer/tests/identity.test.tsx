import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeThemes } from "@catera/design-tokens";
import { ThemeProvider } from "@catera/mobile-ui";
import { Register } from "../src/account/Register";
import { Recover } from "../src/account/Recover";
import { Masuk } from "../src/account/Masuk";
import { customerLink } from "../src/links";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
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
/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** A synthetic Supabase auth client: no network, no real accounts. */
function fakeSupabase() {
  return {
    auth: {
      signUp: jest.fn(async () => ({ data: { session: null, user: { id: "u-new" } }, error: null })),
      resend: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ error: null })),
      exchangeCodeForSession: jest.fn(),
      getUser: jest.fn(async () => ({ data: { user: { id: "verified-user" } }, error: null })),
      updateUser: jest.fn(async () => ({ error: null })),
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
}

let supabase: ReturnType<typeof fakeSupabase>;
let runtime: MobileRuntime;

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockParams = {};
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  supabase = fakeSupabase();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  (runtime as { supabase: unknown }).supabase = supabase;
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: null, demo: false })),
  } as unknown as MobileRuntime["api"];
});

const renderWith = (ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

describe("Daftar dengan email", () => {
  it("registers with name, email and password, remembers where to return, and asks to check email", async () => {
    mockParams = { next: "/beli/p-1?portions=2" };
    renderWith(<Register />);
    const send = await screen.findByRole("button", { name: "Daftar & verifikasi email" });
    expect(send).toBeEnabled();
    fireEvent.changeText(screen.getByLabelText("Nama"), "Rani Contoh");
    fireEvent.changeText(screen.getByLabelText("Email"), " rani@example.test ");
    const password = screen.getByLabelText("Kata sandi");
    expect(password.props.secureTextEntry).toBe(true);
    fireEvent.changeText(password, "synthetic-password");
    fireEvent.press(send);
    await waitFor(() =>
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "rani@example.test",
        password: "synthetic-password",
        options: { data: { name: "Rani Contoh" }, emailRedirectTo: "catera://auth/callback" },
      }),
    );
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    const pending = JSON.parse(store.get("catera.auth.pending") ?? "{}");
    expect(pending).toMatchObject({ purpose: "signup", next: "/beli/p-1?portions=2" });
  });

  it("shows a single heading: the large Daftar title, with the subtitle under it", async () => {
    renderWith(<Register />);
    await screen.findByLabelText("Nama");
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Daftar"]);
    expect(screen.queryByText("Daftar dengan email")).toBeNull();
    expect(screen.queryByText("Daftar dengan email dan kata sandi.")).toBeNull();
    expect(screen.getByText("Kami kirim tautan verifikasi ke emailmu.")).toBeTruthy();
  });

  it("says so when the email is already registered instead of pretending a link was sent", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: { id: "u-old", identities: [] } },
      error: null,
    } as never);
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByText("Daftar & verifikasi email"));
    expect(await screen.findByText(/sudah terdaftar/)).toBeTruthy();
    expect(screen.queryByText("Cek emailmu")).toBeNull();
  });

  it("explains a rejected password and stays on the form", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: "weak_password" },
    } as never);
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani");
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
    expect(await screen.findByTestId("identity-error")).toBeTruthy();
    expect(screen.queryByText("Cek emailmu")).toBeNull();
    // The password is what was refused, so it carries the danger outline and the email does not.
    const edge = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style).borderColor;
    expect(edge("Kata sandi")).not.toBe(edge("Nama"));
    expect(edge("Email")).toBe(edge("Nama"));
  });
});

describe("Lupa kata sandi", () => {
  it("shows a single heading: the large Pemulihan akun title, with the explanation under it", async () => {
    renderWith(<Recover />);
    await screen.findByLabelText("Email");
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Pemulihan akun"]);
    expect(screen.queryByText("Pulihkan kata sandi")).toBeNull();
    expect(screen.getByText(/Kami kirim tautan/)).toBeTruthy();
  });

  it("does not outline the email when the service fails, only says so", async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "unexpected_failure", status: 500 } } as never);
    renderWith(<Recover />);
    const email = await screen.findByLabelText("Email");
    const before = StyleSheet.flatten(email.props.style).borderColor;
    fireEvent.changeText(email, "rani@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByTestId("identity-error")).toBeTruthy();
    // A server failure the person did not cause never outlines a field (S-5).
    expect(StyleSheet.flatten(screen.getByLabelText("Email").props.style).borderColor).toBe(before);
  });

  it("sends a recovery link to the email and says so", async () => {
    mockParams = { next: "/akun" };
    renderWith(<Recover />);
    fireEvent.changeText(await screen.findByLabelText("Email"), "rani@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    await waitFor(() =>
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("rani@example.test", {
        redirectTo: "catera://auth/callback",
      }),
    );
    expect(await screen.findByText(/tautan pemulihan/)).toBeTruthy();
    expect(JSON.parse(store.get("catera.auth.pending") ?? "{}")).toMatchObject({ purpose: "recovery", next: "/akun" });
  });
});

describe("Cek emailmu", () => {
  const toRegisterSent = async () => {
    renderWith(<Register />);
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Rani Contoh");
    fireEvent.changeText(screen.getByLabelText("Email"), " rani@example.test ");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "synthetic-password");
    fireEvent.press(screen.getByRole("button", { name: "Daftar & verifikasi email" }));
    return screen.findByTestId("check-email");
  };
  const toRecoverSent = async () => {
    renderWith(<Recover />);
    fireEvent.changeText(await screen.findByLabelText("Email"), " rani@example.test ");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    return screen.findByTestId("check-email");
  };
  /** What the shared view shows, so the two pages can be compared. */
  const shape = () => ({
    header: screen.getAllByRole("header").map((h) => h.props.children),
    address: StyleSheet.flatten(screen.getByText("rani@example.test").props.style).fontFamily,
    art: screen.queryAllByTestId(/^mascot-/, { includeHiddenElements: true }).length > 0,
    open: !!screen.getByRole("button", { name: "Buka aplikasi email" }),
    resend: !!screen.getByRole("button", { name: "Kirim ulang dalam 1:00" }),
    change: !!screen.getByRole("button", { name: "Ubah email" }),
    form: screen.queryByLabelText("Email"),
  });

  it("register and recover show the same Cek emailmu view with the address", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await toRegisterSent();
    const register = shape();
    expect(register).toMatchObject({ header: ["Cek emailmu"], art: true, open: true, resend: true, change: true, form: null });
    // The address is set in bold, so a typo shows.
    expect(register.address).toMatch(/Bold/);
    fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    expect(open).toHaveBeenCalledWith("mailto:");
    screen.unmount();

    await toRecoverSent();
    expect(shape()).toEqual(register);
    open.mockRestore();
  });

  it("an email app that cannot open is quiet", async () => {
    const open = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no app"));
    await toRecoverSent();
    fireEvent.press(screen.getByRole("button", { name: "Buka aplikasi email" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(screen.getByTestId("check-email")).toBeTruthy();
    open.mockRestore();
  });

  it("a resend that fails keeps the resend ready and says why", async () => {
    jest.useFakeTimers();
    try {
      await toRecoverSent();
      act(() => jest.advanceTimersByTime(60_000));
      supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "unexpected_failure", status: 500 } } as never);
      fireEvent.press(screen.getByRole("button", { name: "Kirim ulang tautan" }));
      expect(await screen.findByTestId("identity-error")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Kirim ulang tautan" })).not.toBeDisabled();
      expect(screen.queryByText("Terkirim lagi. Cek emailmu.")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("resends after the 60 second countdown, and Ubah email goes back to the form", async () => {
    jest.useFakeTimers();
    try {
      await toRegisterSent();
      expect(screen.getByRole("button", { name: "Kirim ulang dalam 1:00" })).toBeDisabled();
      act(() => jest.advanceTimersByTime(60_000));
      fireEvent.press(screen.getByRole("button", { name: "Kirim ulang tautan" }));
      await waitFor(() =>
        expect(supabase.auth.resend).toHaveBeenCalledWith({
          type: "signup",
          email: "rani@example.test",
          options: { emailRedirectTo: "catera://auth/callback" },
        }),
      );
      expect(await screen.findByText("Terkirim")).toBeTruthy();
      act(() => jest.advanceTimersByTime(3000));
      expect(await screen.findByRole("button", { name: /Kirim ulang dalam 0:5[0-9]/ })).toBeDisabled();
      expect(screen.getByText("Terkirim lagi. Cek emailmu.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Ubah email" }));
      expect(screen.getByLabelText("Email").props.value).toBe(" rani@example.test ");
      screen.unmount();

      await toRecoverSent();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
      act(() => jest.advanceTimersByTime(60_000));
      fireEvent.press(screen.getByRole("button", { name: "Kirim ulang tautan" }));
      await waitFor(() => expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps every line whole at 360dp and font scale 1.3", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    await toRecoverSent();
    for (const text of within(screen.getByTestId("check-email")).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
  });

  it("draws on the dark palette", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="check-email-dark-test">
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <Recover />
        </MobileProvider>
      </ThemeProvider>,
    );
    fireEvent.changeText(await screen.findByLabelText("Email"), "rani@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    await screen.findByTestId("check-email");
    expect(StyleSheet.flatten(screen.getByText("rani@example.test").props.style).color).toBe(nativeThemes.dark.charcoal);
    scheme.mockRestore();
  });
});

describe("Masuk links", () => {
  it("offers email registration and password recovery, keeping where to return", async () => {
    mockParams = { next: "/disimpan" };
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Daftar" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/register", params: { next: "/disimpan" } });
    fireEvent.press(screen.getByRole("tab", { name: "Email" }));
    fireEvent.press(screen.getByRole("button", { name: "Lupa kata sandi?" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/recover", params: { next: "/disimpan" } });
  });
});

describe("Masuk heading", () => {
  it("leaves the title to the header and keeps the explanation", async () => {
    renderWith(<Masuk />);
    expect(await screen.findByRole("button", { name: "Kirim kode" })).toBeTruthy();
    expect(screen.queryAllByText("Masuk ke Catera")).toHaveLength(0);
    expect(screen.getByText(/Pakai nomor HP yang kamu berikan/)).toBeTruthy();
  });
});

describe("Masuk with email", () => {
  // Ported from the old login screen test.
  it("a failed sign-in explains the problem and does not navigate", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText(/Email atau kata sandinya salah/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
