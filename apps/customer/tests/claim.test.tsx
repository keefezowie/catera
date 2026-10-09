import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ApiError } from "@catera/api-client";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { Actor, ClaimPreview } from "@catera/domain";
import ClaimRoute from "../app/claim/[token]";
import { customerLink } from "../src/links";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
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
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

/** Synthetic preview: no real caterer, customer or phone number. */
const preview: ClaimPreview = {
  catererName: "Dapur Contoh",
  packageName: "Makan Siang Rumahan",
  remainingDays: 9,
  nextDate: "2026-10-08",
  nextWindow: "11.00–13.00",
  addressLabel: "Kantor Sudirman",
  maskedPhone: "0812-•••-0001",
};
const TOKEN = "t".repeat(64);
const customer = { id: "u-c1", role: "customer", name: "Andre Contoh" } as Actor;

function runtimeWith(opts: { preview?: () => Promise<ClaimPreview>; command?: jest.Mock } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: null, demo: false })),
    claimPreview: jest.fn(opts.preview ?? (async () => preview)),
    command: opts.command ?? jest.fn(async () => ({ status: "claimed" })),
  } as unknown as MobileRuntime["api"];
  const sendPhoneOtp = jest.fn(async () => undefined);
  const verifyPhoneOtp = jest.fn(async () => customer);
  Object.assign(runtime, { sendPhoneOtp, verifyPhoneOtp });
  return { runtime, sendPhoneOtp, verifyPhoneOtp };
}
const renderRoute = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <ClaimRoute />
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: TOKEN };
});

it("opens the claim route from a link and connects", async () => {
  expect(customerLink("/claim/" + TOKEN)).toBe("/claim/" + TOKEN);
  const command = jest.fn(async () => ({ status: "claimed" }));
  const { runtime, sendPhoneOtp, verifyPhoneOtp } = runtimeWith({ command });
  renderRoute(runtime);

  expect(await screen.findByText("Dari Dapur Contoh")).toBeTruthy();
  expect(runtime.api.claimPreview).toHaveBeenCalledWith(TOKEN);
  expect(screen.getByText("Langganan Anda sekarang ada di Catera")).toBeTruthy();
  expect(
    screen.getByText(
      "Sudah dibayar ke Dapur Contoh, tidak ada tagihan baru. Di sini Anda bisa melihat menu, tahu kapan makanan berangkat, dan memindah hari.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
  expect(screen.getByText("9 hari")).toBeTruthy();
  expect(screen.getByText("Kamis 8 Okt, 11.00–13.00")).toBeTruthy();
  expect(screen.getByText("Kantor Sudirman")).toBeTruthy();
  expect(screen.getByText("Bukan nomor Anda? Minta Dapur Contoh mengirim tautan baru.")).toBeTruthy();
  // The phone is asked for only after the customer has seen the package.
  expect(screen.queryByLabelText("Nomor HP")).toBeNull();

  fireEvent.press(screen.getByRole("button", { name: "Lanjut dengan 0812-•••-0001" }));
  fireEvent.changeText(screen.getByLabelText("Nomor HP"), "0812 3450 0001");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+6281234500001"));

  expect(await screen.findByText("Masukkan kode dari SMS")).toBeTruthy();
  expect(screen.getByText("Kami kirim 6 angka ke 0812-3450-0001, nomor yang dicatat Dapur Contoh.")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Kode"), "123456");
  fireEvent.changeText(screen.getByLabelText("Nama Anda"), "Andre");
  fireEvent.press(screen.getByRole("button", { name: "Sambungkan langganan" }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(verifyPhoneOtp).toHaveBeenCalledWith("+6281234500001", "123456", "Andre", expect.any(String));
  expect(command).toHaveBeenCalledWith("customer.claim", { token: TOKEN }, expect.any(String));
  expect(verifyPhoneOtp.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]);
});

it("the back button is a 48dp round button with a haptic", async () => {
  const { runtime } = runtimeWith();
  renderRoute(runtime);
  fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan 0812-•••-0001" }));
  jest.clearAllMocks();
  const back = screen.getByRole("button", { name: "Kembali" });
  const style = StyleSheet.flatten(back.props.style);
  expect([style.width, style.height]).toEqual([48, 48]);
  fireEvent.press(back);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("button", { name: "Lanjut dengan 0812-•••-0001" })).toBeTruthy();
});

it.each(["NOT_FOUND", "INVALID_INPUT"])("a %s preview shows only the plain message", async (code) => {
  const { runtime } = runtimeWith({
    preview: async () => {
      throw new ApiError(code);
    },
  });
  renderRoute(runtime);
  expect(await screen.findByText("Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda.")).toBeTruthy();
  expect(screen.queryByText(/Dapur Contoh/)).toBeNull();
  expect(screen.queryByText(/Lanjut dengan/)).toBeNull();
  expect(screen.queryByText("Langganan Anda sekarang ada di Catera")).toBeNull();
});

it("a refused claim ends in the plain message and never on Beranda", async () => {
  const command = jest.fn(async () => {
    throw new ApiError("CLAIM_UNAVAILABLE");
  });
  const { runtime } = runtimeWith({ command });
  renderRoute(runtime);
  fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan 0812-•••-0001" }));
  fireEvent.changeText(screen.getByLabelText("Nomor HP"), "081234500001");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  fireEvent.changeText(await screen.findByLabelText("Kode"), "123456");
  fireEvent.changeText(screen.getByLabelText("Nama Anda"), "Andre");
  fireEvent.press(screen.getByRole("button", { name: "Sambungkan langganan" }));
  expect(await screen.findByText("Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda.")).toBeTruthy();
  expect(screen.queryByText(/Dapur Contoh/)).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});

it("a wrong SMS code keeps the customer on the code step", async () => {
  const { runtime, verifyPhoneOtp } = runtimeWith();
  verifyPhoneOtp.mockRejectedValueOnce(new Error("INVALID_OTP"));
  renderRoute(runtime);
  fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan 0812-•••-0001" }));
  fireEvent.changeText(screen.getByLabelText("Nomor HP"), "081234500001");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  fireEvent.changeText(await screen.findByLabelText("Kode"), "000000");
  fireEvent.changeText(screen.getByLabelText("Nama Anda"), "Andre");
  fireEvent.press(screen.getByRole("button", { name: "Sambungkan langganan" }));
  expect(await screen.findByText("Kode belum cocok. Periksa SMS lalu coba lagi.")).toBeTruthy();
  expect(screen.getByLabelText("Kode")).toBeTruthy();
  expect(runtime.api.command).not.toHaveBeenCalled();
});

const MISMATCH =
  "Nomor ini berbeda dengan yang dicatat Dapur Contoh. Pakai nomor yang Anda berikan ke Dapur Contoh, atau minta Dapur Contoh memperbarui nomor Anda.";

it("a number that differs from the recorded one gets no SMS and a plain explanation", async () => {
  const { runtime, sendPhoneOtp } = runtimeWith();
  renderRoute(runtime);
  fireEvent.press(await screen.findByRole("button", { name: "Lanjut dengan 0812-•••-0001" }));
  fireEvent.changeText(screen.getByLabelText("Nomor HP"), "0812 9999 0000");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  expect(await screen.findByText(MISMATCH)).toBeTruthy();
  expect(sendPhoneOtp).not.toHaveBeenCalled();
  // The number stays editable, and the recorded one is sent once typed.
  expect(screen.getByLabelText("Nomor HP").props.editable).not.toBe(false);
  fireEvent.changeText(screen.getByLabelText("Nomor HP"), "+62 812 3450 0001");
  fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
  await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+6281234500001"));
  expect(screen.queryByText(MISMATCH)).toBeNull();
});

it("an unusable link offers a way to Beranda without going there by itself", async () => {
  const { runtime } = runtimeWith({
    preview: async () => {
      throw new ApiError("NOT_FOUND");
    },
  });
  renderRoute(runtime);
  const home = await screen.findByRole("button", { name: "Ke Beranda" });
  expect(router.replace).not.toHaveBeenCalled();
  fireEvent.press(home);
  expect(router.replace).toHaveBeenCalledWith("/");
});

it("a preview that cannot load offers Coba lagi and Ke Beranda", async () => {
  const preview = jest
    .fn<Promise<ClaimPreview>, []>()
    .mockRejectedValueOnce(new ApiError("REQUEST_TIMEOUT"))
    .mockResolvedValue({
      catererName: "Dapur Contoh",
      packageName: "Makan Siang Rumahan",
      remainingDays: 9,
      nextDate: null,
      nextWindow: null,
      addressLabel: "Kantor Sudirman",
      maskedPhone: "0812-•••-0001",
    });
  const { runtime } = runtimeWith({ preview });
  renderRoute(runtime);
  const message = await screen.findByText("Belum bisa memuat. Periksa koneksi lalu coba lagi.");
  expect(StyleSheet.flatten(message.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
  fireEvent.press(await screen.findByRole("button", { name: "Ke Beranda" }));
  expect(router.replace).toHaveBeenCalledWith("/");
  fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
  expect(await screen.findByText("Dari Dapur Contoh")).toBeTruthy();
});
