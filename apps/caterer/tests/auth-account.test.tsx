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
const newActor = { id: "u-9", role: "owner", name: "Bu Rina", catererId: null };

function makeRuntime(options: { demo?: boolean; request?: jest.Mock; command?: jest.Mock; actor?: unknown } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "auth-account", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: options.actor ?? null, demo: options.demo ?? false })),
    request: options.request ?? jest.fn(async () => []),
    command: options.command ?? jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactNode) =>
  render(
    withDapurScale(
      <MoodProvider now={() => new Date("2026-10-08T08:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>{ui}</ToastProvider>
        </MobileProvider>
      </MoodProvider>,
    ),
  );

beforeEach(() => jest.clearAllMocks());

async function reachCodeStep(runtime: MobileRuntime) {
  renderWith(runtime, <Daftar />);
  fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Rina");
  fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
  fireEvent.press(screen.getByText("Jakarta Selatan"));
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  await screen.findByLabelText("Kode dari SMS");
}

describe("Daftar retry and recovery", () => {
  const setup = () => {
    const command = jest.fn().mockRejectedValueOnce(new Error("NETWORK")).mockResolvedValue({});
    const runtime = makeRuntime({ command });
    runtime.sendPhoneOtp = jest.fn(async () => undefined) as never;
    runtime.verifyPhoneOtp = jest.fn(async () => newActor) as never;
    return { runtime, command };
  };

  it("verifies the code once: a failed seller.create retries without verifying again, with the same slug", async () => {
    const { runtime, command } = setup();
    await reachCodeStep(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Buat dapur saya" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Buat dapur saya" })).toBeEnabled());
    fireEvent.press(screen.getByRole("button", { name: "Buat dapur saya" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1);
    expect(command.mock.calls[1][1].slug).toBe(command.mock.calls[0][1].slug);
    expect(command.mock.calls[1][2]).toBe(command.mock.calls[0][2]);
  });

  it("once verified, the retry needs no code and the resend action is gone", async () => {
    const { runtime, command } = setup();
    await reachCodeStep(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Buat dapur saya" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "");
    await waitFor(() => expect(screen.getByRole("button", { name: "Buat dapur saya" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Kirim ulang kode" })).toBeNull();
  });

  it("Ganti nomor after verifying signs the old number out, and the next create verifies again", async () => {
    const { runtime, command } = setup();
    runtime.signOut = jest.fn(async () => undefined) as never;
    await reachCodeStep(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Buat dapur saya" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ganti nomor" })).toBeEnabled());
    fireEvent.press(screen.getByRole("button", { name: "Ganti nomor" }));
    await waitFor(() => expect(runtime.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByLabelText("Kode dari SMS")).toBeNull());
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "654321");
    fireEvent.press(screen.getByRole("button", { name: "Buat dapur saya" }));
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(2));
  });

  it("Ganti nomor goes back to the editable fields and clears the code", async () => {
    const { runtime } = setup();
    await reachCodeStep(runtime);
    expect(screen.getByLabelText("Nomor WhatsApp").props.editable).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Ganti nomor" }));
    expect(screen.getByLabelText("Nomor WhatsApp").props.editable).not.toBe(false);
    expect(screen.queryByLabelText("Kode dari SMS")).toBeNull();
  });

  it("Kirim ulang kode sends the code again", async () => {
    const { runtime } = setup();
    await reachCodeStep(runtime);
    fireEvent.press(screen.getByRole("button", { name: "Kirim ulang kode" }));
    await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledTimes(2));
  });

  it("says what is missing while Kirim kode is disabled", async () => {
    renderWith(makeRuntime(), <Daftar />);
    await screen.findByLabelText("Nama usaha katering");
    const reason = screen.getByTestId("daftar-reason");
    expect(reason).toHaveTextContent(/nama usaha/i);
    expect(reason).toHaveTextContent(/nomor WhatsApp/);
    expect(reason).toHaveTextContent(/lokasi dapur/);
  });

  it("tags the phone and code fields for autofill", async () => {
    const { runtime } = setup();
    await reachCodeStep(runtime);
    expect(screen.getByLabelText("Nomor WhatsApp").props).toMatchObject({ autoComplete: "tel", textContentType: "telephoneNumber" });
    expect(screen.getByLabelText("Kode dari SMS").props).toMatchObject({ autoComplete: "sms-otp", textContentType: "oneTimeCode" });
  });
});

describe("Masuk autofill tags", () => {
  it("tags phone, email and password", async () => {
    renderWith(makeRuntime(), <Masuk />);
    expect((await screen.findByLabelText("Nomor WhatsApp")).props).toMatchObject({ autoComplete: "tel" });
    fireEvent.press(screen.getByText("Email"));
    expect(screen.getByLabelText("Email").props).toMatchObject({ autoComplete: "email", textContentType: "emailAddress" });
    expect(screen.getByLabelText("Kata sandi").props).toMatchObject({ autoComplete: "current-password", textContentType: "password" });
  });
});

describe("Data akun hints, tags and failed reads", () => {
  it("says what the disabled buttons wait for", async () => {
    renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    await screen.findByLabelText("Nomor HP baru");
    expect(screen.getByTestId("phone-reason")).toBeTruthy();
    expect(screen.getByTestId("request-reason")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor HP baru"), "081234567");
    expect(screen.queryByTestId("phone-reason")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Apa yang diubah?"), "nama baru");
    expect(screen.queryByTestId("request-reason")).toBeNull();
  });

  it("tags phone, email and the password fields", async () => {
    renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    expect((await screen.findByLabelText("Nomor HP baru")).props).toMatchObject({ autoComplete: "tel" });
    expect(screen.getByLabelText("Email baru").props).toMatchObject({ autoComplete: "email" });
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
    renderWith(runtime, <DataAkun />);
    await screen.findByText("Belum bisa membaca akunmu.");
    fireEvent.press(screen.getByText("Coba lagi"));
    await screen.findByLabelText("Kata sandi saat ini");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("the disabled button carries the reason as an accessibility hint", async () => {
    renderWith(makeRuntime({ demo: true, actor: owner }), <DataAkun />);
    await screen.findByLabelText("Nomor HP baru");
    expect(screen.getByRole("button", { name: "Kirim kode" }).props.accessibilityHint).toMatch(/9 angka/);
  });

  it("a failed request-status read shows a ReadError that retries", async () => {
    let fail = true;
    const request = jest.fn(async () => {
      if (fail) throw new Error("NETWORK");
      return [];
    });
    renderWith(makeRuntime({ demo: true, actor: owner, request }), <DataAkun />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    fail = false;
    await act(async () => fireEvent.press(retry));
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
    renderWith(makeRuntime({ demo: true, actor: owner, request }), <HapusAkun />);
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
    fail = false;
    await act(async () => fireEvent.press(retry));
    await screen.findByRole("button", { name: "Kirim permintaan hapus akun" });
  });
});
