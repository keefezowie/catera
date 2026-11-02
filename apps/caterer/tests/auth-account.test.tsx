import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ToastProvider } from "@catera/mobile-ui";
import { Daftar } from "../src/auth/Daftar";
import { Masuk } from "../src/auth/Masuk";
import { DataAkun } from "../src/settings/DataAkun";
import { HapusAkun } from "../src/settings/HapusAkun";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };

function makeRuntime(options: { demo?: boolean; request?: jest.Mock; command?: jest.Mock; actor?: unknown } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "auth-account", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: options.actor ?? null, demo: options.demo ?? false })),
    request: options.request ?? jest.fn(async () => []),
    command: options.command ?? jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", whatsapp: null } })),
  } as unknown as MobileRuntime["api"];
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

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

describe("Masuk autofill tags", () => {
  it("tags email and password", async () => {
    await renderWith(makeRuntime(), <Masuk />);
    expect((await screen.findByLabelText("Email")).props).toMatchObject({ autoComplete: "email", textContentType: "emailAddress" });
    expect(screen.getByLabelText("Kata sandi").props).toMatchObject({ autoComplete: "current-password", textContentType: "password" });
  });
});

describe("Daftar autofill tags", () => {
  it("tags the WhatsApp number, the email and the new password", async () => {
    await renderWith(makeRuntime(), <Daftar />);
    await fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Rina");
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    await fireEvent.press(await screen.findByText("Jakarta Selatan"));
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    const phone = await screen.findByLabelText("Nomor WhatsApp");
    expect(phone.props).toMatchObject({ autoComplete: "tel", keyboardType: "phone-pad" });
    await fireEvent.changeText(phone, "081234567890");
    await fireEvent.press(screen.getByRole("button", { name: "Lanjut" }));
    expect((await screen.findByLabelText("Email")).props).toMatchObject({ autoComplete: "email" });
    expect(screen.getByLabelText("Kata sandi").props).toMatchObject({ autoComplete: "new-password", textContentType: "newPassword" });
  });
});

describe("Data akun hints, tags and failed reads", () => {
  it("says what the disabled buttons wait for", async () => {
    await renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    await screen.findByLabelText("Apa yang diubah?");
    expect(screen.getByTestId("request-reason")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Apa yang diubah?"), "nama baru");
    expect(screen.queryByTestId("request-reason")).toBeNull();
  });

  it("tags the kitchen WhatsApp, email and the password fields", async () => {
    await renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    expect((await screen.findByLabelText("Nomor WhatsApp dapur")).props).toMatchObject({ autoComplete: "tel", keyboardType: "phone-pad" });
    await fireEvent.press(screen.getByRole("button", { name: "Ganti email" }));
    expect(screen.getByLabelText("Email baru").props).toMatchObject({ autoComplete: "email" });
    await fireEvent.press(await screen.findByRole("button", { name: "Ganti kata sandi" }));
    expect((await screen.findByLabelText("Kata sandi saat ini")).props).toMatchObject({ autoComplete: "current-password" });
    expect(screen.getByLabelText("Kata sandi baru").props).toMatchObject({ autoComplete: "new-password", textContentType: "newPassword" });
  });

  it("a failed account read shows a ReadError, and retrying brings the password section", async () => {
    const getUser = jest
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: new Error("NETWORK") })
      .mockResolvedValue({ data: { user: { email: "rina@example.test" } }, error: null });
    const runtime = makeRuntime({ actor: owner });
    const channel = { on: () => channel, subscribe: () => channel, unsubscribe: jest.fn() };
    (runtime as { supabase: unknown }).supabase = {
      auth: { getUser, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }) },
      channel: () => channel,
      removeChannel: jest.fn(),
    };
    await renderWith(runtime, <DataAkun />);
    await screen.findByText("Belum bisa membaca akunmu.");
    await fireEvent.press(screen.getByText("Coba lagi"));
    // The password row comes back, with the address the account read named.
    await screen.findByTestId("data-akun-row-password");
    expect(screen.getByText("rina@example.test")).toBeTruthy();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("the disabled button carries the reason as an accessibility hint", async () => {
    await renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    await screen.findByLabelText("Apa yang diubah?");
    expect(screen.getByRole("button", { name: "Kirim permintaan" }).props.accessibilityHint).toMatch(/5 karakter/);
  });

  it("a failed request-status read shows a ReadError that retries", async () => {
    let fail = true;
    const request = jest.fn(async () => {
      if (fail) throw new Error("NETWORK");
      return [];
    });
    await renderWith(makeRuntime({ demo: true, actor: owner, request }), <DataAkun />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    fail = false;
    await act(async () => await fireEvent.press(retry));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull());
  });
});

describe("Hapus akun read states", () => {
  it("holds the button until the requests read answers, and shows a ReadError on failure", async () => {
    let fail = true;
    const request = jest.fn(async () => {
      if (fail) throw new Error("NETWORK");
      return [];
    });
    await renderWith(makeRuntime({ demo: true, actor: owner, request }), <HapusAkun />);
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
    fail = false;
    await act(async () => await fireEvent.press(retry));
    await screen.findByRole("button", { name: "Kirim permintaan hapus akun" });
  });
});

describe("demo sign-out", () => {
  it("always asks the demo backend to drop its cookie when there is no Supabase, without waiting for it", async () => {
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "demo-signout", app: "dapur" });
    const request = jest.spyOn(runtime.api, "request").mockImplementation(() => new Promise(() => undefined));
    // No demo token is stored, yet the shared cookie jar may still hold the demo session.
    await runtime.signOut();
    expect(request).toHaveBeenCalledWith("auth/logout", {});
  });
});
