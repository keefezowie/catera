import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { Masuk } from "../src/auth/Masuk";
import { RoleGate } from "../src/RoleGate";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

function runtimeFor(actor: Record<string, unknown> | null, extra: Record<string, unknown> = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "busy", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  Object.assign(runtime, extra);
  return runtime;
}

/** A call that stays pending until the test lets it go (or lets it fail). */
const held = <T,>() => {
  let settle!: { resolve: (value: T) => void; reject: (error: Error) => void };
  const promise = new Promise<T>((resolve, reject) => (settle = { resolve, reject }));
  return { promise, ...settle };
};

const busyOf = (name: string) => screen.getByRole("button", { name }).props.accessibilityState.busy;

describe("Masuk", () => {
  it("every awaiting command button is busy while it waits: Kirim kode, and a second press sends nothing", async () => {
    const wait = held<void>();
    const sendPhoneOtp = jest.fn(() => wait.promise);
    render(
      <MobileProvider runtime={runtimeFor(null, { sendPhoneOtp })} linkMapper={(h) => h}>
        <Masuk />
      </MobileProvider>,
    );
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await waitFor(() => expect(busyOf("Kirim kode")).toBe(true));
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(sendPhoneOtp).toHaveBeenCalledTimes(1);
    await act(async () => wait.resolve());
    // The code field takes the number's place, and the button now signs in.
    expect(await screen.findByLabelText("Kode dari SMS")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masuk" }).props.accessibilityState.busy).toBeFalsy();
  });

  it("a failed sign-in is a FormError that says what to check, not a loose line", async () => {
    const sendPhoneOtp = jest.fn(async () => {
      throw new Error("SOMETHING_ODD");
    });
    render(
      <MobileProvider runtime={runtimeFor(null, { sendPhoneOtp })} linkMapper={(h) => h}>
        <Masuk />
      </MobileProvider>,
    );
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(await screen.findByTestId("form-error")).toBeTruthy();
    expect(screen.getByText("Belum bisa masuk. Periksa nomor atau kodenya, lalu coba lagi.")).toBeTruthy();
    expect(busyOf("Kirim kode")).toBeFalsy();
  });
});

describe("RoleGate", () => {
  it("Gabung ke dapur is busy while the invite code is checked", async () => {
    const wait = held<object>();
    const runtime = runtimeFor({ id: "u-c", name: "Pelanggan", role: "customer" });
    (runtime.api.command as jest.Mock).mockImplementation(() => wait.promise);
    render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <RoleGate>{null}</RoleGate>
      </MobileProvider>,
    );
    fireEvent.changeText(await screen.findByLabelText("Kode undangan"), "abc123");
    fireEvent.press(screen.getByRole("button", { name: "Gabung ke dapur" }));
    await waitFor(() => expect(busyOf("Gabung ke dapur")).toBe(true));
    fireEvent.press(screen.getByRole("button", { name: "Gabung ke dapur" }));
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
    await act(async () => wait.reject(Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" })));
    expect(await screen.findByText("Kode tidak ditemukan atau sudah dipakai.")).toBeTruthy();
    expect(busyOf("Gabung ke dapur")).toBeFalsy();
  });
});
