import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { DataAkun } from "../src/settings/DataAkun";
import { HapusAkun } from "../src/settings/HapusAkun";

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
const staff = { id: "u-2", role: "staff", name: "Bima", catererId: "k-1" };

const row = (extra: Record<string, unknown> = {}) => ({
  id: "r-1",
  kind: "help",
  status: "open",
  body: "Ubah nama atau kontak dapur: nama baru",
  resolution: null,
  caterer_id: "k-1",
  created_at: "2026-10-08T03:00:00Z",
  ...extra,
});

function runtimeFor(options: { actor?: Record<string, unknown>; requests?: unknown[]; command?: jest.Mock } = {}) {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "akun", app: "dapur" });
  const rows = options.requests ?? [];
  runtime.api = {
    ...runtime.api,
    // Demo mode: the account changes are simulated and send nothing to an auth service.
    me: jest.fn(async () => ({ actor: options.actor ?? owner, demo: true })),
    request: jest.fn(async (path: string) => (path === "account-requests" ? rows : [])),
    command: options.command ?? jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return { runtime, rows };
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactNode) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ToastProvider>{ui}</ToastProvider>
    </MobileProvider>,
  );

beforeEach(() => jest.clearAllMocks());

describe("Data akun", () => {
  it("Data akun sends the kitchen-details request and shows its status", async () => {
    const rows: unknown[] = [];
    const command = jest.fn(async () => {
      rows.unshift(row());
      return { id: "r-1", status: "open" };
    });
    const { runtime } = runtimeFor({ command, requests: rows });
    renderWith(runtime, <DataAkun />);
    const field = await screen.findByLabelText("Apa yang diubah?");
    // Nothing to send until something is written.
    expect(screen.getByRole("button", { name: "Kirim permintaan" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId("kitchen-request-status")).toBeNull();
    fireEvent.changeText(field, "Nama dapur jadi Dapur Bu Rina");
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "accountRequest.create",
        { kind: "help", body: "Ubah nama atau kontak dapur: Nama dapur jadi Dapur Bu Rina", catererId: "k-1" },
        expect.any(String),
      ),
    );
    // The request and its status stay on the page.
    expect((await screen.findByTestId("kitchen-request-status")).props.children).toBe("Permintaan terakhir: Terkirim, menunggu Tim Catera.");
    expect(await screen.findByText("Permintaan terkirim")).toBeTruthy();
  });

  it("shows a resolved request with what the team answered", async () => {
    const { runtime } = runtimeFor({ requests: [row({ status: "resolved", resolution: "Nama sudah diganti." })] });
    renderWith(runtime, <DataAkun />);
    expect((await screen.findByTestId("kitchen-request-status")).props.children).toBe("Permintaan terakhir: Selesai: Nama sudah diganti.");
  });

  it("keeps the kitchen request for the owner and gives staff the personal rows only", async () => {
    const { runtime } = runtimeFor({ actor: staff });
    renderWith(runtime, <DataAkun />);
    await screen.findByLabelText("Nama kamu");
    expect(screen.queryByLabelText("Apa yang diubah?")).toBeNull();
    expect(screen.getByText("Nomor HP")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("saves the name through profile.update and says so", async () => {
    const command = jest.fn(async () => ({ name: "Bu Rina Wati" }));
    const { runtime } = runtimeFor({ command });
    renderWith(runtime, <DataAkun />);
    const field = await screen.findByLabelText("Nama kamu");
    expect(screen.getByRole("button", { name: "Simpan nama" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(field, "Bu Rina Wati");
    fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("profile.update", { name: "Bu Rina Wati" }, expect.any(String)));
    expect(await screen.findByText("Nama tersimpan")).toBeTruthy();
  });

  it("a name that is too short is a FormError at the button, not a loose line", async () => {
    const { runtime } = runtimeFor();
    renderWith(runtime, <DataAkun />);
    fireEvent.changeText(await screen.findByLabelText("Nama kamu"), "A");
    fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByText("Periksa isiannya, lalu coba lagi.")).toBeTruthy();
  });

  it("changing the phone number asks for a code first, and demo says nothing was sent", async () => {
    const { runtime } = runtimeFor();
    renderWith(runtime, <DataAkun />);
    fireEvent.changeText(await screen.findByLabelText("Nomor HP baru"), "081234567890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    expect(await screen.findByLabelText("Kode dari SMS")).toBeTruthy();
    expect(screen.getByText(/Demo \(data contoh\): tidak ada SMS yang dikirim/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Ganti nomor" }));
    expect(await screen.findByText("Demo (data contoh): nomor tidak benar-benar diganti.")).toBeTruthy();
  });

  it("an email change never claims to be done: it names both inboxes", async () => {
    const { runtime } = runtimeFor();
    renderWith(runtime, <DataAkun />);
    fireEvent.changeText(await screen.findByLabelText("Email baru"), "rina@contoh.id");
    fireEvent.press(screen.getByRole("button", { name: "Kirim tautan konfirmasi" }));
    expect(await screen.findByText("Demo (data contoh): tidak ada email yang dikirim.")).toBeTruthy();
  });

  it("the password section waits for the current password and eight characters", async () => {
    const { runtime } = runtimeFor();
    renderWith(runtime, <DataAkun />);
    const button = async () => screen.getByRole("button", { name: "Ganti kata sandi" });
    fireEvent.changeText(await screen.findByLabelText("Kata sandi saat ini"), "lama-sekali");
    fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "pendek");
    expect((await button()).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "cukup-panjang");
    expect((await button()).props.accessibilityState.disabled).toBe(false);
  });

  it("Hapus akun opens its confirm sheet from the page", async () => {
    const { runtime } = runtimeFor();
    renderWith(runtime, <DataAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Hapus akun" }));
    expect(router.push).toHaveBeenCalledWith("/pengaturan/hapus-akun");
  });
});

describe("Hapus akun", () => {
  it("sends the deletion request, promises no timing and links to the privacy section", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const command = jest.fn(async () => ({ id: "d-1", status: "open" }));
    const { runtime } = runtimeFor({ command });
    renderWith(runtime, <HapusAkun />);
    expect(await screen.findByText(/diselesaikan dulu bersama tim/)).toBeTruthy();
    expect(screen.queryByText(/hari|jam|menit/)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Baca kebijakan privasi" }));
    expect(open).toHaveBeenCalledWith("https://api.example.test/syarat-dan-privasi#privasi");
    fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "accountRequest.create",
        { kind: "deletion", body: "Permintaan hapus akun dari aplikasi Catera Dapur." },
        expect.any(String),
      ),
    );
    expect((await screen.findByTestId("deletion-status")).props.children).toMatch(/sudah masuk dan menunggu Tim Catera/);
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
    open.mockRestore();
  });

  it("shows an open request as it stands instead of a second button", async () => {
    const { runtime } = runtimeFor({ requests: [row({ kind: "deletion", caterer_id: null })] });
    renderWith(runtime, <HapusAkun />);
    expect(await screen.findByTestId("deletion-status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
  });

  it("a failed request is a FormError with Coba lagi, and the button comes back", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    const { runtime } = runtimeFor({ command });
    renderWith(runtime, <HapusAkun />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim permintaan hapus akun" }).props.accessibilityState.busy).toBeFalsy();
  });
});
