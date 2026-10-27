import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, pendingKey, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ToastProvider } from "@catera/mobile-ui";
import { AuthCallback } from "../src/auth/AuthCallback";
import { Masuk } from "../src/auth/Masuk";
import { Pulihkan } from "../src/auth/Pulihkan";
import { redirectSystemPath } from "../src/nav";
import { withDapurScale } from "./dapur-scale";

let mockParams: Record<string, string> = {};
const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** A synthetic Supabase auth client: no network, no real accounts. */
function fakeSupabase() {
  return {
    auth: {
      resend: jest.fn(async () => ({ error: null })),
      resetPasswordForEmail: jest.fn(async () => ({ error: null })),
      exchangeCodeForSession: jest.fn(),
      getUser: jest.fn(async () => ({ data: { user: { id: "kitchen-user" } }, error: null })),
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
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "dapur-recovery", app: "dapur" });
  (runtime as { supabase: unknown }).supabase = supabase;
  me = jest.fn(async () => ({ actor: null, demo: false }));
  runtime.api = { ...runtime.api, me, request: jest.fn(async () => []), usage: jest.fn(async () => undefined) } as unknown as MobileRuntime["api"];
});

const renderWith = (ui: React.ReactNode) =>
  render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>{ui}</ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    ),
  );

const intent = (purpose: string, email = "rina@example.test") =>
  store.set(pendingKey(runtime), JSON.stringify({ purpose, next: "/", at: Date.now(), email }));
const recoveryLink = () => {
  mockParams = { code: "one-time-code" };
  intent("recovery");
  supabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: { user: { id: "kitchen-user" }, session: { access_token: "synthetic" }, redirectType: "recovery" },
    error: null,
  });
};
const savePassword = async (repeat = "synthetic-password-2026") => {
  fireEvent.changeText(await screen.findByLabelText("Kata sandi baru"), "synthetic-password-2026");
  fireEvent.changeText(screen.getByLabelText("Ulangi kata sandi"), repeat);
  fireEvent.press(screen.getByRole("button", { name: "Simpan kata sandi" }));
};

describe("Dapur Masuk to Pulihkan", () => {
  it("Masuk email tab links to Pulihkan", async () => {
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.press(screen.getByRole("button", { name: "Lupa kata sandi?" }));
    expect(router.push).toHaveBeenCalledWith("/pulihkan");
  });

  it("the second wrong password adds Lupa kata sandi? to the error", async () => {
    runtime.signInPassword = jest.fn(async () => Promise.reject(new Error("INVALID_CREDENTIALS"))) as never;
    renderWith(<Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.test");
    const attempt = async (n: number) => {
      fireEvent.changeText(screen.getByLabelText("Kata sandi"), "salah-salah");
      fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
      await waitFor(() => expect(runtime.signInPassword).toHaveBeenCalledTimes(n));
      await screen.findByTestId("form-error");
    };
    await attempt(1);
    expect(within(screen.getByTestId("form-error")).queryByText("Lupa kata sandi?")).toBeNull();
    await attempt(2);
    fireEvent.press(await within(screen.getByTestId("form-error")).findByText("Lupa kata sandi?"));
    expect(router.push).toHaveBeenCalledWith("/pulihkan");
  });
});

describe("Pulihkan", () => {
  it("an empty press shows the email message and sends nothing", async () => {
    renderWith(<Pulihkan />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Isi emailmu dulu.")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("an invalid email shows the format message", async () => {
    renderWith(<Pulihkan />);
    fireEvent.changeText(await screen.findByLabelText("Email"), "rina@");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("Pulihkan sends with redirect catera-dapur://auth/callback, remembers the request, then shows Cek emailmu", async () => {
    renderWith(<Pulihkan />);
    fireEvent.changeText(await screen.findByLabelText("Email"), "rina@example.test");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan pemulihan" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("rina@example.test", { redirectTo: "catera-dapur://auth/callback" });
    expect(JSON.parse(store.get(pendingKey(runtime))!)).toMatchObject({ purpose: "recovery", email: "rina@example.test" });
  });
});

describe("callback", () => {
  it("callback recovery shows the new-password form and the outcome", async () => {
    recoveryLink();
    renderWith(<AuthCallback />);
    expect(await screen.findByRole("header", { name: "Kata sandi baru" })).toBeTruthy();
    await savePassword();
    expect(await screen.findByRole("header", { name: "Kata sandi diganti" })).toBeTruthy();
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "synthetic-password-2026" });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(me).toHaveBeenCalled();
    expect(store.has(pendingKey(runtime))).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("a mismatch saves nothing", async () => {
    recoveryLink();
    renderWith(<AuthCallback />);
    await savePassword("synthetic-password-2027");
    expect(await screen.findByText("Kata sandinya belum sama.")).toBeTruthy();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("the outcome locks its exits and every removal goes where Lanjut goes", async () => {
    recoveryLink();
    renderWith(<AuthCallback />);
    await savePassword();
    await screen.findByRole("header", { name: "Kata sandi diganti" });
    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerBackVisible: false, gestureEnabled: false }));
    const guard = (usePreventRemove as jest.Mock).mock.calls.at(-1)!;
    expect(guard[0]).toBe(true);
    await act(async () => (guard[1] as () => void)());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("refuses a normal sign-in code even when the local intent says recovery", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "kitchen-user" }, session: { access_token: "synthetic" }, redirectType: null },
      error: null,
    });
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("an offline exchange says so, and Coba lagi tries the same link again", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: "AuthRetryableFetchError", status: 0 },
    } as never);
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(screen.queryByText("Tautannya sudah tidak berlaku")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByLabelText("Kata sandi baru")).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenLastCalledWith("one-time-code");
  });

  it("a server-rejected code still reaches the expired screen", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: "AuthApiError", status: 400, code: "flow_state_expired" },
    } as never);
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(screen.queryByText(/Belum ada koneksi/)).toBeNull();
  });

  it("refuses to set a password for a different user than the link signed in", async () => {
    recoveryLink();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "someone-else" } }, error: null } as never);
    renderWith(<AuthCallback />);
    await savePassword();
    expect(await screen.findByTestId("identity-error")).toBeTruthy();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("a signup intent in Dapur goes to expired", async () => {
    mockParams = { code: "one-time-code" };
    intent("signup");
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(screen.queryByText(/rina@example.test/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Masukkan email" }));
    expect(router.replace).toHaveBeenCalledWith("/pulihkan");
  });

  it("with no pending request it fails fast and asks for the email", async () => {
    mockParams = { code: "one-time-code" };
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Kirim tautan baru" })).toBeNull();
  });

  it("an error param fails fast, names the stored address and resends a recovery link", async () => {
    mockParams = { error: "access_denied", code: "one-time-code" };
    intent("recovery");
    renderWith(<AuthCallback />);
    expect(await screen.findByText(/rina@example.test/)).toBeTruthy();
    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan baru" }));
    expect(await screen.findByText("Cek emailmu")).toBeTruthy();
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("rina@example.test", { redirectTo: "catera-dapur://auth/callback" });
  });

  it("an expired code from the server shows expired", async () => {
    recoveryLink();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null }, error: { message: "expired" } });
    renderWith(<AuthCallback />);
    expect(await screen.findByText("Tautannya sudah tidak berlaku")).toBeTruthy();
  });
});

describe("native intent", () => {
  it("lets catera-dapur://auth/callback?code=abc and the recovery screen through unchanged", () => {
    expect(redirectSystemPath({ path: "catera-dapur://auth/callback?code=abc", initial: true })).toBe("catera-dapur://auth/callback?code=abc");
    expect(redirectSystemPath({ path: "/pulihkan", initial: false })).toBe("/pulihkan");
  });
});
