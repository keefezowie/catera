import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { AuthCallback } from "../src/account/AuthCallback";
import { customerLink } from "../src/links";

let mockParams: Record<string, string> = {};
const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
// Scoped: the real contexts stay; only the guard is captured so a test can fire "back".
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  usePreventRemove: jest.fn(),
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
const { usePreventRemove } = require("expo-router/react-navigation") as { usePreventRemove: jest.Mock };

/** A synthetic Supabase auth client: no network, no real accounts. */
function fakeSupabase() {
  return {
    auth: {
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
let me: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockParams = {};
  supabase = fakeSupabase();
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  (runtime as { supabase: unknown }).supabase = supabase;
  me = jest.fn(async () => ({ actor: null, demo: false }));
  runtime.api = { ...runtime.api, me } as unknown as MobileRuntime["api"];
});

const renderCallback = () =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <AuthCallback />
    </MobileProvider>,
  );

const intent = (purpose: string, email = "rani@example.test") =>
  store.set("catera.auth.pending", JSON.stringify({ purpose, next: "/checkout/package?cycles=3", at: Date.now(), email }));
const recoveryLink = () => {
  mockParams = { code: "one-time-code" };
  intent("recovery");
  supabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: "verified-user" }, session: { access_token: "synthetic" }, redirectType: "recovery" },
    error: null,
  });
};
const savePassword = async () => {
  fireEvent.changeText(await screen.findByLabelText("Kata sandi baru"), "synthetic-password-2026");
  fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi"), "synthetic-password-2026");
  fireEvent.press(screen.getByRole("button", { name: "Simpan kata sandi" }));
};

describe("new password", () => {
  it("shows one heading and a rules line, with the button enabled", async () => {
    recoveryLink();
    renderCallback();
    expect(await screen.findByRole("header", { name: "Kata sandi baru" })).toBeTruthy();
    expect(screen.getAllByRole("header")).toHaveLength(1);
    expect(screen.getByTestId("password-rule")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan kata sandi" })).toBeEnabled();
  });

  it("mismatch shows Kata sandinya belum sama.", async () => {
    recoveryLink();
    renderCallback();
    fireEvent.changeText(await screen.findByLabelText("Kata sandi baru"), "synthetic-password-2026");
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi"), "synthetic-password-2027");
    fireEvent.press(screen.getByRole("button", { name: "Simpan kata sandi" }));
    expect(await screen.findByText("Kata sandinya belum sama.")).toBeTruthy();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi"), "synthetic-password-2026");
    expect(await screen.findByText("Kata sandinya sama")).toBeTruthy();
  });

  it("save keeps the session and shows Kata sandi diganti", async () => {
    recoveryLink();
    renderCallback();
    await savePassword();
    expect(await screen.findByRole("header", { name: "Kata sandi diganti" })).toBeTruthy();
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "synthetic-password-2026" });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(me).toHaveBeenCalled();
    expect(store.has("catera.auth.pending")).toBe(false);
    expect(screen.getByText("Kamu sudah masuk dengan kata sandi baru.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/checkout/package?cycles=3"));
  });

  it("back from an outcome goes where Lanjut goes", async () => {
    recoveryLink();
    renderCallback();
    await savePassword();
    await screen.findByRole("header", { name: "Kata sandi diganti" });
    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerBackVisible: false, gestureEnabled: false }));
    const [held, onBack] = usePreventRemove.mock.calls.at(-1)!;
    expect(held).toBe(true);
    await act(async () => onBack());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/checkout/package?cycles=3"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("refuses a normal sign-in code even when the local intent says recovery", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "verified-user" }, session: { access_token: "synthetic" }, redirectType: null },
      error: null,
    });
    renderCallback();
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("new password: leaving and rejection", () => {
  it("offers Kembali ke Masuk on the form and on the sent screen", async () => {
    recoveryLink();
    renderCallback();
    fireEvent.press(await screen.findByRole("button", { name: "Kembali ke Masuk" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/checkout/package?cycles=3" } });
  });

  it("a rejected password shows the error, keeps the form and the intent, and a second save succeeds", async () => {
    recoveryLink();
    supabase.auth.updateUser.mockResolvedValueOnce({ error: { code: "same_password", status: 422 } } as never);
    renderCallback();
    await savePassword();
    expect(await screen.findByTestId("identity-error")).toBeTruthy();
    expect(screen.getByLabelText("Kata sandi baru")).toBeTruthy();
    expect(screen.queryByText("Coba lagi")).toBeNull();
    expect(store.has("catera.auth.pending")).toBe(true);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Simpan kata sandi" }));
    expect(await screen.findByRole("header", { name: "Kata sandi diganti" })).toBeTruthy();
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(2);
  });
});

describe("verified", () => {
  it("verified shows Email terverifikasi with the name", async () => {
    mockParams = { code: "one-time-code" };
    intent("signup");
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "verified-user", user_metadata: { name: "Rani Contoh" } }, session: { access_token: "synthetic" } },
      error: null,
    });
    renderCallback();
    expect(await screen.findByRole("header", { name: "Email terverifikasi" })).toBeTruthy();
    expect(screen.getByText("Akunmu sudah siap, Rani Contoh.")).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith("catera_v1_command", {
      action: "profile.ensure",
      payload: { name: "Rani Contoh" },
      request_id: expect.any(String),
    });
    expect(store.has("catera.auth.pending")).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Mulai" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/checkout/package?cycles=3"));
  });

  it("a set-up failure after a good exchange says the server failed and Coba lagi finishes, never expired", async () => {
    mockParams = { code: "one-time-code" };
    intent("signup");
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "verified-user", user_metadata: { name: "Rani Contoh" } }, session: { access_token: "synthetic" } },
      error: null,
    });
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom", code: "XX000" } } as never);
    renderCallback();
    expect(await screen.findByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    expect(screen.queryByText("Tautannya sudah tidak berlaku")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByRole("header", { name: "Email terverifikasi" })).toBeTruthy();
    // The spent code is not exchanged again; only the set-up re-runs.
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });
});

describe("offline link", () => {
  it("an offline exchange says so, and Coba lagi tries the same link again", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: "AuthRetryableFetchError", status: 0 },
    } as never);
    renderCallback();
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.queryByText("Tautannya sudah tidak berlaku")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByLabelText("Kata sandi baru")).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenLastCalledWith("one-time-code");
  });

  it("a thrown fetch error during the exchange is offline too", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockRejectedValueOnce(new TypeError("Network request failed"));
    renderCallback();
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.queryByText("Tautannya sudah tidak berlaku")).toBeNull();
  });
});

describe("expired link", () => {
  it("expired with no pending intent offers Masukkan email and makes no request", async () => {
    mockParams = { code: "one-time-code" };
    renderCallback();
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(screen.getAllByRole("header")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Kirim tautan baru" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Masukkan email" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/recover", params: { next: "/" } });
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(supabase.auth.resend).not.toHaveBeenCalled();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("an error param fails fast with no exchange, and names the stored address", async () => {
    mockParams = { error: "access_denied", code: "one-time-code" };
    intent("recovery");
    renderCallback();
    expect(await screen.findByText(/rani@example.test/)).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Kembali ke Masuk" }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/checkout/package?cycles=3" } });
  });

  it("Kirim tautan baru sends one recovery email for a double press", async () => {
    mockParams = {};
    intent("recovery");
    renderCallback();
    const send = await screen.findByRole("button", { name: "Kirim tautan baru" });
    fireEvent.press(send);
    fireEvent.press(send);
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kembali ke Masuk" })).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("rani@example.test", { redirectTo: "catera://auth/callback" });
  });

  it("a sign-up link asks for a new verification email", async () => {
    mockParams = {};
    intent("signup");
    renderCallback();
    fireEvent.press(await screen.findByRole("button", { name: "Kirim tautan baru" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "rani@example.test",
      options: { emailRedirectTo: "catera://auth/callback" },
    });
  });

  it("offline resend says so and offers Coba lagi", async () => {
    mockParams = {};
    intent("recovery");
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { name: "AuthRetryableFetchError", status: 0 } } as never);
    renderCallback();
    fireEvent.press(await screen.findByRole("button", { name: "Kirim tautan baru" }));
    expect(await screen.findByText(/Belum ada koneksi/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
  });
});
