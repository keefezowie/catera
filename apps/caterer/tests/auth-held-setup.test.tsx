import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Text } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ToastProvider } from "@catera/mobile-ui";
import { Daftar } from "../src/auth/Daftar";
import { waCheck } from "../src/auth/checks";
import { holdInvite, holdKitchen, readHeldKitchen } from "../src/auth/pending";
import { RoleGate } from "../src/RoleGate";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  Link: () => null,
  useNavigation: () => ({ setOptions: jest.fn() }),
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
const KITCHEN_KEY = "held-setup.auth.kitchen";
const INVITE_KEY = "held-setup.auth.invite";
const kitchen = { name: "Dapur Ani", area: "Bandung", whatsapp: "+6281234567890", slugSuffix: "cd34" };
const customer = { id: "u-7", role: "customer", name: "Budi" };

/** A synthetic runtime: no network, no real accounts. `email` is the signed-in session's address. */
function makeRuntime(email: string | undefined, actor: unknown = customer, overrides: Record<string, unknown> = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "held-setup", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  (runtime as { supabase: unknown }).supabase = {
    auth: {
      // Supabase's way of saying the address already has an account.
      signUp: jest.fn(async () => ({ data: { user: { identities: [] }, session: null }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: { access_token: "synthetic", user: { email, user_metadata: {} } } } })),
      updateUser: jest.fn(async () => ({ data: {}, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      startAutoRefresh: () => undefined,
      stopAutoRefresh: () => undefined,
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  };
  Object.assign(runtime, overrides);
  return runtime;
}

const renderWith = async (runtime: MobileRuntime, ui: React.ReactNode) =>
  await render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>{ui}</ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    ),
  );
const gate = (runtime: MobileRuntime) => renderWith(runtime, <RoleGate><Text>Hari ini</Text></RoleGate>);
const press = async (name: string) => await fireEvent.press(screen.getByRole("button", { name }));

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
});

describe("waCheck", () => {
  const check = waCheck((id) => id);
  it.each(["", "   ", "abc", "D"])("%j has no digits, so it asks for the number", (value) => {
    expect(check(value)).toBe("Isi nomor WhatsApp dapur dulu.");
  });
  it("digits that fall short say the number is incomplete", () => {
    expect(check("0812")).toMatch(/belum lengkap/);
  });
  it("a whole number passes", () => {
    expect(check("0812 3456 7890")).toBe("");
  });
});

describe("Daftar on a registered email", () => {
  const signUpAs = async (signInPassword: jest.Mock) => {
    const runtime = makeRuntime(undefined, null, { signInPassword });
    await renderWith(runtime, <Daftar />);
    await fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    await press("Lanjut");
    await fireEvent.press(await screen.findByText("Jakarta Selatan"));
    await press("Lanjut");
    await fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "0812 3456 7890");
    await press("Lanjut");
    await fireEvent.changeText(await screen.findByLabelText("Email"), "Rina@Example.com");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    await press("Daftar");
    return await screen.findByTestId("form-error");
  };

  it("a dropped connection is not called a wrong password, and keeps Coba lagi", async () => {
    const signInPassword = jest.fn().mockRejectedValue(new Error("OFFLINE"));
    const error = await signUpAs(signInPassword);
    expect(within(error).queryByText(/kata sandinya belum cocok/)).toBeNull();
    expect(within(error).queryByText("Masuk dengan email ini")).toBeNull();
    await press("Coba lagi");
    await waitFor(() => expect(signInPassword).toHaveBeenCalledTimes(2));
  });

  it("the rate limit is not called a wrong password", async () => {
    const error = await signUpAs(jest.fn().mockRejectedValue(new Error("AUTH_RATE_LIMITED")));
    expect(within(error).getByText(/Terlalu banyak percobaan/)).toBeTruthy();
    expect(within(error).queryByText("Masuk dengan email ini")).toBeNull();
  });

  it("a failed profile read after a good password is not called a wrong password", async () => {
    const error = await signUpAs(jest.fn().mockRejectedValue(new Error("AUTH_UNAVAILABLE")));
    expect(within(error).queryByText(/kata sandinya belum cocok/)).toBeNull();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("a wrong password says so, and holds the kitchen for the lower-cased address", async () => {
    const error = await signUpAs(jest.fn().mockRejectedValue(new Error("INVALID_CREDENTIALS")));
    expect(within(error).getByText(/kata sandinya belum cocok/)).toBeTruthy();
    expect(JSON.parse(store.get(KITCHEN_KEY)!).email).toBe("rina@example.com");
  });
});

describe("what a phone holds belongs to one email", () => {
  it("is offered to its own account, whatever the case of the address", async () => {
    const runtime = makeRuntime("Ani@Example.com");
    await holdKitchen(runtime, kitchen, " ani@example.COM ");
    await expect(readHeldKitchen(runtime)).resolves.toEqual(kitchen);
  });

  it("another account on the phone is not offered it, and it is let go", async () => {
    const runtime = makeRuntime("budi@example.com");
    await holdKitchen(runtime, kitchen, "ani@example.com");
    await gate(runtime);
    expect(await screen.findByRole("button", { name: "Daftarkan dapurmu" })).toBeTruthy();
    expect(screen.queryByText("Buka dapur dengan data ini?")).toBeNull();
    expect(screen.queryByText("Dapur Ani")).toBeNull();
    expect(store.has(KITCHEN_KEY)).toBe(false);
    expect(runtime.api.command).not.toHaveBeenCalled();
  });

  it("a value kept by an older build, with no email, is not offered and is let go", async () => {
    const runtime = makeRuntime("ani@example.com");
    store.set(KITCHEN_KEY, JSON.stringify(kitchen));
    await expect(readHeldKitchen(runtime)).resolves.toBeNull();
    expect(store.has(KITCHEN_KEY)).toBe(false);
  });

  it("an unreadable value is let go", async () => {
    const runtime = makeRuntime("ani@example.com");
    store.set(KITCHEN_KEY, "{not json");
    await expect(readHeldKitchen(runtime)).resolves.toBeNull();
    expect(store.has(KITCHEN_KEY)).toBe(false);
  });

  it("no session means no offer", async () => {
    const runtime = makeRuntime(undefined);
    await holdKitchen(runtime, kitchen, "ani@example.com");
    await expect(readHeldKitchen(runtime)).resolves.toBeNull();
  });
});

describe("leaving lets go of what was held", () => {
  it("Keluar on the gate clears the kitchen and the invite", async () => {
    const runtime = makeRuntime("budi@example.com");
    await gate(runtime);
    await screen.findByRole("button", { name: "Daftarkan dapurmu" });
    await holdKitchen(runtime, kitchen, "budi@example.com");
    await holdInvite(runtime, "DPR-4K9Q");
    await press("Keluar");
    await waitFor(() => expect(store.has(KITCHEN_KEY)).toBe(false));
    await waitFor(() => expect(store.has(INVITE_KEY)).toBe(false));
  });

  it("an account with a kitchen clears both on arrival, so its later sign-out leaves nothing", async () => {
    const runtime = makeRuntime("rina@example.com", { id: "u-1", role: "owner", name: "Rina", catererId: "k-1" });
    await holdKitchen(runtime, kitchen, "ani@example.com");
    await holdInvite(runtime, "DPR-4K9Q");
    await gate(runtime);
    expect(await screen.findByText("Hari ini")).toBeTruthy();
    await waitFor(() => expect(store.has(KITCHEN_KEY)).toBe(false));
    await waitFor(() => expect(store.has(INVITE_KEY)).toBe(false));
  });
});
