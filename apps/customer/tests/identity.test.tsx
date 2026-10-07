import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { Register } from "../src/account/Register";
import { Recover } from "../src/account/Recover";
import { AuthCallback } from "../src/account/AuthCallback";
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
    expect(send).toBeDisabled();
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
    expect(await screen.findByText("Periksa email Anda")).toBeTruthy();
    const pending = JSON.parse(store.get("catera.auth.pending") ?? "{}");
    expect(pending).toMatchObject({ purpose: "signup", next: "/beli/p-1?portions=2" });

    fireEvent.press(screen.getByRole("button", { name: "Kirim ulang verifikasi" }));
    await waitFor(() =>
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "rani@example.test",
        options: { emailRedirectTo: "catera://auth/callback" },
      }),
    );
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
    expect(screen.queryByText("Periksa email Anda")).toBeNull();
  });
});

describe("Lupa kata sandi", () => {
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
    expect(await screen.findByText(/email pemulihan telah dikirim/)).toBeTruthy();
    expect(JSON.parse(store.get("catera.auth.pending") ?? "{}")).toMatchObject({ purpose: "recovery", next: "/akun" });
  });
});

describe("Masuk links", () => {
  it("offers email registration and password recovery, keeping where to return", async () => {
    mockParams = { next: "/disimpan" };
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Daftar dengan email" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/register", params: { next: "/disimpan" } });
    fireEvent.press(screen.getByRole("button", { name: "Masuk dengan email" }));
    fireEvent.press(screen.getByRole("button", { name: "Lupa kata sandi?" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/recover", params: { next: "/disimpan" } });
  });
});

describe("Masuk with email", () => {
  // Ported from the old login screen test.
  it("a failed sign-in explains the problem and does not navigate", async () => {
    runtime.signInPassword = jest.fn(async () => {
      throw new Error("INVALID_CREDENTIALS");
    });
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk dengan email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rani@example.test");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "wrong-password");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText(/Email atau kata sandi tidak cocok/)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("auth callback", () => {
  const intent = (purpose: string) =>
    store.set("catera.auth.pending", JSON.stringify({ purpose, next: "/checkout/package?cycles=3", at: Date.now() }));

  it("recovery refuses a normal sign-in code even when the local intent says recovery", async () => {
    mockParams = { code: "one-time-code" };
    intent("recovery");
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "verified-user" }, session: { access_token: "synthetic" }, redirectType: null },
      error: null,
    });
    renderWith(<AuthCallback />);
    expect(await screen.findByText(/Tautan tidak berlaku/)).toBeTruthy();
    expect(screen.queryByLabelText("Kata sandi baru")).toBeNull();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("a verified recovery code resets the matching session and preserves checkout on return", async () => {
    mockParams = { code: "one-time-code" };
    intent("recovery");
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "verified-user" }, session: { access_token: "synthetic" }, redirectType: "recovery" },
      error: null,
    });
    renderWith(<AuthCallback />);
    fireEvent.changeText(await screen.findByLabelText("Kata sandi baru"), "synthetic-password-2026");
    const save = screen.getByRole("button", { name: "Simpan kata sandi & masuk" });
    expect(save).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi"), "synthetic-password-2026");
    fireEvent.press(save);
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalled());
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "synthetic-password-2026" });
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/checkout/package?cycles=3" },
    });
  });

  it("a verified sign-up link creates the profile and returns where the customer started", async () => {
    mockParams = { code: "one-time-code" };
    intent("signup");
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: { id: "verified-user", user_metadata: { name: "Rani Contoh" } },
        session: { access_token: "synthetic" },
      },
      error: null,
    });
    renderWith(<AuthCallback />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/checkout/package?cycles=3"));
    expect(supabase.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Rani Contoh" },
      request_id: expect.any(String),
    });
    expect(store.has("catera.auth.pending")).toBe(false);
  });
});
