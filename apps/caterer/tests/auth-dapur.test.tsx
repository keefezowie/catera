import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { BackHandler, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ToastProvider } from "@catera/mobile-ui";
import { Daftar } from "../src/auth/Daftar";
import { Masuk } from "../src/auth/Masuk";
import { withDapurScale } from "./dapur-scale";

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null, useNavigation: () => ({ setOptions: mockSetOptions }) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));

const actor = { id: "u-9", role: "owner", name: "Bu Rina", catererId: null };

function makeRuntime(overrides: Record<string, unknown> = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "auth-dapur", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: null, demo: false })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  runtime.sendPhoneOtp = jest.fn(async () => undefined) as never;
  runtime.verifyPhoneOtp = jest.fn(async () => actor) as never;
  Object.assign(runtime, overrides);
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

const held = <T,>() => {
  let settle!: { resolve: (value: T) => void; reject: (error: Error) => void };
  const promise = new Promise<T>((resolve, reject) => (settle = { resolve, reject }));
  return { promise, ...settle };
};
const border = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style as never)?.borderColor;
const busyOf = (name: string) => screen.getByRole("button", { name }).props.accessibilityState.busy;

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

async function sendMasukCode(runtime: MobileRuntime) {
  renderWith(runtime, <Masuk />);
  fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  await screen.findByLabelText("Kode dari SMS");
}

describe("Dapur Masuk code step", () => {
  it("Dapur code entry auto-submits on the sixth digit", async () => {
    const runtime = makeRuntime();
    await sendMasukCode(runtime);
    expect(screen.getByText(/Kode dikirim ke 0812 •••• 7890/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "12345");
    expect(runtime.verifyPhoneOtp).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(1));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledWith("+6281234567890", "123456", "", expect.any(String));
  });

  it("a wrong code empties the boxes and says so under them, outlining the boxes only", async () => {
    const runtime = makeRuntime({ verifyPhoneOtp: jest.fn(async () => Promise.reject(new Error("INVALID_OTP"))) });
    await sendMasukCode(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    expect(await screen.findByText("Kodenya salah. Cek SMS-nya, lalu coba lagi.")).toBeTruthy();
    expect(screen.getByLabelText("Kode dari SMS").props.value).toBe("");
    expect(screen.queryByTestId("form-error")).toBeNull();
  });

  it("resend waits 60s", async () => {
    jest.useFakeTimers();
    const runtime = makeRuntime();
    await sendMasukCode(runtime);
    const resend = () => screen.getByRole("button", { name: /^Kirim ulang/ });
    expect(resend()).toHaveTextContent("Kirim ulang dalam 1:00");
    expect(resend()).toBeDisabled();
    act(() => jest.advanceTimersByTime(59_000));
    expect(resend()).toHaveTextContent("Kirim ulang dalam 0:01");
    act(() => jest.advanceTimersByTime(1_000));
    expect(resend()).toHaveTextContent("Kirim ulang kode");
    expect(resend()).toBeEnabled();
    fireEvent.press(resend());
    await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledTimes(2));
    expect(resend()).toHaveTextContent("Kirim ulang dalam 1:00");
  });
});

describe("Dapur Masuk errors", () => {
  it("demo button shows its own spinner", async () => {
    const wait = held<void>();
    const runtime = makeRuntime({ demoLogin: jest.fn(() => wait.promise) });
    renderWith(runtime, <Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk sebagai pemilik" }));
    await waitFor(() => expect(busyOf("Masuk sebagai pemilik")).toBe(true));
    expect(busyOf("Kirim kode")).toBeFalsy();
    expect(busyOf("Masuk sebagai staf dapur")).toBeFalsy();
    await act(async () => wait.resolve());
  });

  it("offline says Belum ada koneksi and outlines nothing", async () => {
    const runtime = makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("OFFLINE"))) });
    renderWith(runtime, <Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const quiet = border("Email");
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "rahasia123");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Belum ada koneksi. Cek internetmu, lalu coba lagi.")).toBeTruthy();
    expect(border("Email")).toBe(quiet);
    expect(border("Kata sandi")).toBe(quiet);
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("wrong credentials outline both fields, empty the password and focus it", async () => {
    const runtime = makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("INVALID_CREDENTIALS"))) });
    renderWith(runtime, <Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    const quiet = border("Email");
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "salah-salah");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(border("Email")).not.toBe(quiet);
    expect(border("Kata sandi")).not.toBe(quiet);
    expect(screen.getByLabelText("Kata sandi").props.value).toBe("");
  });

  it("an unknown failure no longer blames the number or the code", async () => {
    const runtime = makeRuntime({ sendPhoneOtp: jest.fn(async () => Promise.reject(new Error("SOMETHING_ODD"))) });
    renderWith(runtime, <Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
    const quiet = border("Nomor WhatsApp");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(await screen.findByText("Ada gangguan di sisi kami. Coba lagi sebentar lagi.")).toBeTruthy();
    expect(border("Nomor WhatsApp")).toBe(quiet);
  });

  it("a rate limit counts down on the button and in the message", async () => {
    jest.useFakeTimers();
    const runtime = makeRuntime({ sendPhoneOtp: jest.fn(async () => Promise.reject(new Error("AUTH_RATE_LIMITED"))) });
    renderWith(runtime, <Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(await screen.findByText("Terlalu banyak percobaan. Coba lagi dalam 1:00.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi dalam 1:00" })).toBeDisabled();
    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText("Terlalu banyak percobaan. Coba lagi dalam 0:30.")).toBeTruthy();
    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByRole("button", { name: "Kirim kode" })).toBeEnabled();
  });
});

describe("Dapur Daftar", () => {
  const fillAndSend = async (runtime: MobileRuntime) => {
    renderWith(runtime, <Daftar />);
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByText("Jakarta Selatan"));
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await screen.findByLabelText("Kode dari SMS");
  };

  it("Daftar empty submit shows three messages and focuses the name", async () => {
    const runtime = makeRuntime();
    const focus = jest.spyOn(TextInput.prototype, "focus");
    renderWith(runtime, <Daftar />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim kode" }));
    expect(screen.getByText("Tulis nama usahamu, minimal 3 huruf.")).toBeTruthy();
    expect(screen.getByText("Isi nomor HP-mu dulu.")).toBeTruthy();
    expect(screen.getByText("Pilih satu lokasi dapur.")).toBeTruthy();
    expect(screen.queryByTestId("daftar-reason")).toBeNull();
    expect(runtime.sendPhoneOtp).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("kitchen outcome says Dapurmu siap and opens Hari ini", async () => {
    const runtime = makeRuntime();
    await fillAndSend(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    expect(await screen.findByText("Dapurmu siap")).toBeTruthy();
    expect(screen.getByText("Dapur Bu Rina sudah terdaftar. Mulai dengan menambah menu.")).toBeTruthy();
    expect(screen.queryByLabelText("Nama usaha katering")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Buka Hari ini" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("hardware back from the outcome opens Hari ini too", async () => {
    const runtime = makeRuntime();
    jest.spyOn(BackHandler, "addEventListener");
    await fillAndSend(runtime);
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    await screen.findByText("Dapurmu siap");
    const press = (BackHandler.addEventListener as jest.Mock).mock.calls.filter(([e]) => e === "hardwareBackPress").pop()![1] as () => boolean;
    act(() => void press());
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("a wrong code is worded under the boxes, and the third adds the resend line", async () => {
    const runtime = makeRuntime({ verifyPhoneOtp: jest.fn(async () => Promise.reject(new Error("INVALID_OTP"))) });
    await fillAndSend(runtime);
    for (let i = 0; i < 3; i++) {
      fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
      await waitFor(() => expect(runtime.verifyPhoneOtp).toHaveBeenCalledTimes(i + 1));
      await waitFor(() => expect(screen.getByLabelText("Kode dari SMS").props.value).toBe(""));
    }
    expect(await screen.findByText(/Belum dapat kodenya\? Kirim ulang\./)).toBeTruthy();
  });
});

describe("Dapur Masuk, the other states", () => {
  it("phone: an empty submit and a bad number say so under the field and send nothing", async () => {
    const runtime = makeRuntime();
    renderWith(runtime, <Masuk />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim kode" }));
    expect(screen.getByText("Isi nomor HP-mu dulu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812");
    expect(screen.getByText("Nomor HP belum lengkap. Contoh: 0812 3456 7890")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(runtime.sendPhoneOtp).not.toHaveBeenCalled();
  });

  it("email: an empty submit and an invalid address say so under their fields", async () => {
    const signInPassword = jest.fn();
    renderWith(makeRuntime({ signInPassword }), <Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(screen.getByText("Isi emailmu dulu.")).toBeTruthy();
    expect(screen.getByText("Isi kata sandimu dulu.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "x");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    expect(screen.getByText("Format email belum benar. Contoh: nama@gmail.com")).toBeTruthy();
    expect(signInPassword).not.toHaveBeenCalled();
  });

  it("draws the verified ring after a good code", async () => {
    await sendMasukCode(makeRuntime());
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    expect(await screen.findByTestId("code-verified")).toBeTruthy();
  });

  it("Coba lagi repeats the step after a server failure, but is absent for a rate limit and a wrong password", async () => {
    const sendPhoneOtp = jest.fn().mockRejectedValueOnce(new Error("SOMETHING_ODD")).mockResolvedValue(undefined);
    renderWith(makeRuntime({ sendPhoneOtp }), <Masuk />);
    fireEvent.changeText(await screen.findByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.press(await screen.findByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledTimes(2));
    await screen.findByLabelText("Kode dari SMS");
  });

  it("offers no Coba lagi for wrong credentials", async () => {
    renderWith(makeRuntime({ signInPassword: jest.fn(async () => Promise.reject(new Error("INVALID_CREDENTIALS"))) }), <Masuk />);
    fireEvent.press(await screen.findByRole("tab", { name: "Email" }));
    fireEvent.changeText(screen.getByLabelText("Email"), "rina@example.com");
    fireEvent.changeText(screen.getByLabelText("Kata sandi"), "salah-salah");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await screen.findByTestId("form-error");
    expect(screen.queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});

describe("Dapur Daftar, retry and leaving the outcome", () => {
  it("Coba lagi repeats Kirim kode after an offline failure", async () => {
    const sendPhoneOtp = jest.fn().mockRejectedValueOnce(new Error("OFFLINE")).mockResolvedValue(undefined);
    renderWith(makeRuntime({ sendPhoneOtp }), <Daftar />);
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByText("Jakarta Selatan"));
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.press(await screen.findByRole("button", { name: "Coba lagi" }));
    await screen.findByLabelText("Kode dari SMS");
    expect(sendPhoneOtp).toHaveBeenCalledTimes(2);
  });

  it("once the kitchen outcome shows, the header back and swipe are off and any removal opens Hari ini", async () => {
    const runtime = makeRuntime();
    renderWith(runtime, <Daftar />);
    fireEvent.changeText(await screen.findByLabelText("Nama usaha katering"), "Dapur Bu Rina");
    fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "081234567890");
    fireEvent.press(screen.getByText("Jakarta Selatan"));
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    await screen.findByText("Dapurmu siap");
    expect(mockSetOptions).toHaveBeenCalledWith(expect.objectContaining({ headerBackVisible: false, gestureEnabled: false }));
    const guard = (usePreventRemove as jest.Mock).mock.calls.pop()!;
    expect(guard[0]).toBe(true);
    (guard[1] as () => void)();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
