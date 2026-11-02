import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { DataAkun } from "../src/settings/DataAkun";
import { HapusAkun } from "../src/settings/HapusAkun";
import { withDapurScale } from "./dapur-scale";

/** Jest's own window at the default text size, so the type ramp's line heights hold (above 1, Android drops them). */
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 750, height: 1334, scale: 2, fontScale: 1 }),
}));

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
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", whatsapp: "+6281234567890" } })),
  } as unknown as MobileRuntime["api"];
  return { runtime, rows };
}

const renderWith = async (runtime: MobileRuntime, ui: React.ReactNode) =>
  await render(
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <ToastProvider>{ui}</ToastProvider>
      </MobileProvider>,
    ),
  );

beforeEach(() => jest.clearAllMocks());

describe("Data akun on the Dapur scale", () => {
  const flatStyle = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

  it("is one flat form as drawn: Nama, the kitchen WhatsApp, then the Email and Kata sandi rows, 24 apart", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    await screen.findByTestId("data-akun-row-password");
    // The screen's title, then the only card left (the owner's kitchen request); the rest is flat.
    expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual(["Data akun", "Ubah nama atau kontak dapur"]);
    expect(screen.getByLabelText("Nama")).toBeTruthy();
    expect(screen.getByLabelText("Nomor WhatsApp dapur")).toBeTruthy();
    const rows = within(screen.getByTestId("data-akun-rows"));
    expect(rows.getByText("Email")).toBeTruthy();
    expect(rows.getByText("Kata sandi")).toBeTruthy();
    expect(rows.getByText("••••••••")).toBeTruthy();
    expect(rows.getByRole("button", { name: "Ganti email" })).toBeTruthy();
    expect(rows.getByRole("button", { name: "Ganti kata sandi" })).toBeTruthy();
    // The change forms stay closed until Ganti.
    expect(screen.queryByLabelText("Email baru")).toBeNull();
    expect(flatStyle(screen.getByTestId("data-akun-sections"))).toMatchObject({ gap: 24 });
    expect(within(screen.getByTestId("data-akun-sections")).getByRole("button", { name: "Hapus akun" })).toBeTruthy();
  });

  it("puts Cek di WhatsApp with its arrow and an outlined Simpan nomor on one row, 50 tall", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    const row = within(await screen.findByTestId("data-akun-wa-actions"));
    const check = row.getByRole("button", { name: "Cek di WhatsApp" });
    expect(within(check).getByTestId("button-trailing-icon")).toBeTruthy();
    const save = row.getByRole("button", { name: "Simpan nomor" });
    expect(flatStyle(screen.getByTestId("data-akun-wa-actions"))).toMatchObject({ flexDirection: "row" });
    expect(flatStyle(screen.getByLabelText("Nomor WhatsApp dapur"))).toMatchObject({ minHeight: 50 });
    expect(flatStyle(save)).toMatchObject({ minHeight: 50, borderWidth: 1 });
    expect(flatStyle(screen.getByText(/^Demo \(data contoh\): nama dan nomor WhatsApp tersimpan/))).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it("an owner's request card shows its last request status in 13/18 meta", async () => {
    const { runtime } = runtimeFor({ requests: [row()] });
    await renderWith(runtime, <DataAkun />);
    expect(flatStyle(await screen.findByTestId("kitchen-request-status"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it("a staff account has no kitchen request card", async () => {
    const { runtime } = runtimeFor({ actor: staff });
    await renderWith(runtime, <DataAkun />);
    await screen.findByLabelText("Nama");
    expect(screen.queryByRole("header", { name: "Ubah nama atau kontak dapur" })).toBeNull();
  });
});

describe("Data akun", () => {
  it("Data akun sends the kitchen-details request and shows its status", async () => {
    const rows: unknown[] = [];
    const command = jest.fn(async () => {
      rows.unshift(row());
      return { id: "r-1", status: "open" };
    });
    const { runtime } = runtimeFor({ command, requests: rows });
    await renderWith(runtime, <DataAkun />);
    const field = await screen.findByLabelText("Apa yang diubah?");
    // Nothing to send until something is written.
    expect(screen.getByRole("button", { name: "Kirim permintaan" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId("kitchen-request-status")).toBeNull();
    await fireEvent.changeText(field, "Nama dapur jadi Dapur Bu Rina");
    await fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
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
    await renderWith(runtime, <DataAkun />);
    expect((await screen.findByTestId("kitchen-request-status")).props.children).toBe("Permintaan terakhir: Selesai: Nama sudah diganti.");
  });

  it("keeps the kitchen request for the owner and gives staff the personal rows only", async () => {
    const { runtime } = runtimeFor({ actor: staff });
    await renderWith(runtime, <DataAkun />);
    await screen.findByLabelText("Nama");
    expect(screen.queryByLabelText("Apa yang diubah?")).toBeNull();
    expect(screen.queryByLabelText("Nomor WhatsApp dapur")).toBeNull();
    expect(runtime.api.sellerOperations).not.toHaveBeenCalled();
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("saves the name through profile.update and says so", async () => {
    const command = jest.fn(async () => ({ name: "Bu Rina Wati" }));
    const { runtime } = runtimeFor({ command });
    await renderWith(runtime, <DataAkun />);
    const field = await screen.findByLabelText("Nama");
    // Nothing to save until the name changes.
    expect(screen.queryByRole("button", { name: "Simpan nama" })).toBeNull();
    await fireEvent.changeText(field, "Bu Rina Wati");
    await fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("profile.update", { name: "Bu Rina Wati" }, expect.any(String)));
    expect(await screen.findByText("Nama tersimpan")).toBeTruthy();
  });

  it("a name that is too short is a FormError at the button, not a loose line", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "A");
    await fireEvent.press(screen.getByRole("button", { name: "Simpan nama" }));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByText("Periksa isiannya, lalu coba lagi.")).toBeTruthy();
  });

  it("prefills the kitchen WhatsApp, opens it in WhatsApp and saves a new one through seller.whatsapp", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const command = jest.fn(async () => ({ catererId: "k-1", whatsapp: "+6281299998888" }));
    const { runtime } = runtimeFor({ command });
    await renderWith(runtime, <DataAkun />);
    await waitFor(() => expect(screen.getByLabelText("Nomor WhatsApp dapur").props.value).toBe("081234567890"));
    expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1");
    expect(screen.getByText("Pelanggan menghubungimu lewat nomor ini. Tidak dipakai untuk masuk.")).toBeTruthy();
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByRole("button", { name: "Simpan nomor" })).toBeDisabled();
    await fireEvent.press(screen.getByRole("button", { name: "Cek di WhatsApp" }));
    expect(open).toHaveBeenCalledWith("https://wa.me/6281234567890");
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp dapur"), "0812");
    expect(screen.getByText("Nomor WhatsApp belum lengkap. Contoh: 0812 3456 7890")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan nomor" })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp dapur"), "0812 9999 8888");
    await fireEvent.press(screen.getByRole("button", { name: "Simpan nomor" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.whatsapp", { whatsapp: "+6281299998888", catererId: "k-1" }, expect.any(String)));
    expect(await screen.findByText("Nomor tersimpan")).toBeTruthy();
  });

  it("keeps the typed number on screen while the save is read back, never flashing empty", async () => {
    let saved = "+6281234567890";
    // The first read answers at once; every read after the save waits until the test lets it go.
    const held: Array<() => void> = [];
    let reads = 0;
    const command = jest.fn(async () => {
      saved = "+6281299998888";
      return { catererId: "k-1", whatsapp: saved };
    });
    const { runtime } = runtimeFor({ command });
    (runtime.api as { sellerOperations: unknown }).sellerOperations = jest.fn(() =>
      reads++ === 0
        ? Promise.resolve({ caterer: { id: "k-1", whatsapp: saved } })
        : new Promise((resolve) => held.push(() => resolve({ caterer: { id: "k-1", whatsapp: saved } }))),
    );
    await renderWith(runtime, <DataAkun />);
    await waitFor(() => expect(screen.getByLabelText("Nomor WhatsApp dapur").props.value).toBe("081234567890"));
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp dapur"), "0812 9999 8888");
    await fireEvent.press(screen.getByRole("button", { name: "Simpan nomor" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    // The read back is still on its way: the typed number stays.
    expect(screen.getByLabelText("Nomor WhatsApp dapur").props.value).toBe("0812 9999 8888");
    await act(async () => held.forEach((go) => go()));
    await waitFor(() => expect(screen.getByLabelText("Nomor WhatsApp dapur").props.value).toBe("081299998888"));
  });

  it("an emptied number clears it, and no phone code is asked for anywhere", async () => {
    const command = jest.fn(async () => ({ catererId: "k-1", whatsapp: null }));
    const { runtime } = runtimeFor({ command });
    await renderWith(runtime, <DataAkun />);
    await waitFor(() => expect(screen.getByLabelText("Nomor WhatsApp dapur").props.value).toBe("081234567890"));
    expect(screen.queryByText(/Kode dari SMS|Kirim kode/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp dapur"), "");
    await fireEvent.press(screen.getByRole("button", { name: "Simpan nomor" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.whatsapp", { whatsapp: null, catererId: "k-1" }, expect.any(String)));
  });

  it("an email change never claims to be done: it names both inboxes", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: "Ganti email" }));
    await fireEvent.changeText(await screen.findByLabelText("Email baru"), "rina@contoh.id");
    await fireEvent.press(screen.getByRole("button", { name: "Kirim tautan konfirmasi" }));
    expect(await screen.findByText("Demo (data contoh): tidak ada email yang dikirim.")).toBeTruthy();
  });

  it("the password section waits for the current password and eight characters", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: "Ganti kata sandi" }));
    // The row's own button now closes the form; the form's button is the one that saves.
    expect(screen.getByRole("button", { name: "Tutup ganti kata sandi" })).toBeTruthy();
    const button = async () => screen.getAllByRole("button", { name: "Ganti kata sandi" }).pop()!;
    await fireEvent.changeText(await screen.findByLabelText("Kata sandi saat ini"), "lama-sekali");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "pendek");
    expect((await button()).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "cukup-panjang");
    expect((await button()).props.accessibilityState.disabled).toBe(false);
  });

  it("Hapus akun opens its confirm sheet from the page", async () => {
    const { runtime } = runtimeFor();
    await renderWith(runtime, <DataAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: "Hapus akun" }));
    expect(router.push).toHaveBeenCalledWith("/pengaturan/hapus-akun");
  });
});

describe("Hapus akun", () => {
  it("sends the deletion request, promises no timing and links to the privacy section", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const command = jest.fn(async () => ({ id: "d-1", status: "open" }));
    const { runtime } = runtimeFor({ command });
    await renderWith(runtime, <HapusAkun />);
    expect(await screen.findByText(/kami selesaikan dulu bersamamu/)).toBeTruthy();
    expect(screen.queryByText(/hari|jam|menit/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Baca kebijakan privasi" }));
    expect(open).toHaveBeenCalledWith("https://api.example.test/syarat-dan-privasi#privasi");
    await fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
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
    await renderWith(runtime, <HapusAkun />);
    expect(await screen.findByTestId("deletion-status")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim permintaan hapus akun" })).toBeNull();
  });

  it("a failed request is a FormError with Coba lagi, and the button comes back", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    const { runtime } = runtimeFor({ command });
    await renderWith(runtime, <HapusAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: "Kirim permintaan hapus akun" }));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim permintaan hapus akun" }).props.accessibilityState.busy).toBeFalsy();
  });
});
