import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { Address, AddressUse } from "@catera/domain";
import { Addresses } from "../src/account/Addresses";
import { customerLink } from "../src/links";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
/**
 * The confirm and action sheets (`/konfirmasi`, `/aksi`) answer what each test sets and the toast is captured; the real
 * sheets are covered on the real router in sheets.test.tsx.
 */
const mockConfirm = jest.fn(async (_input: Record<string, unknown>) => true);
const mockAsk = jest.fn(async (_input: Record<string, unknown>): Promise<string | null> => null);
const mockToast = jest.fn();
jest.mock("@catera/mobile-ui", () => ({
  ...jest.requireActual("@catera/mobile-ui"),
  useConfirm: () => mockConfirm,
  useActionSheet: () => mockAsk,
  useToast: () => ({ show: mockToast, hide: jest.fn() }),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const address = (id: string, label: string, area = "Jakarta Selatan"): Address => ({
  id,
  label,
  line: `Jl. Contoh No. ${id.length}`,
  area,
  city: "Jakarta",
  instructions: "",
  version: 1,
});
const HOME = address("a-home", "Rumah");
const OFFICE = address("a-office", "Kantor", "Jakarta Pusat");
const unused: AddressUse = { addressId: HOME.id, count: 0, from: null, to: null, kitchens: [], pendingCheckouts: 0 };
const inUse: AddressUse = {
  addressId: HOME.id,
  count: 12,
  from: "2026-10-13",
  to: "2026-10-31",
  kitchens: [{ id: "k", name: "Dapur Senja" }],
  pendingCheckouts: 0,
};

let runtime: MobileRuntime;
let command: jest.Mock;
let addressUse: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  command = jest.fn(async () => ({}));
  addressUse = jest.fn(async () => unused);
  runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "customer", role: "customer", name: "Rani" }, demo: false })),
    customer: jest.fn(async () => ({ subscriptions: [], deliveries: [], addresses: [HOME, OFFICE], notifications: [], cases: [] })),
    addressUse,
    command,
  } as unknown as MobileRuntime["api"];
});

const renderBook = () =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <Addresses />
    </MobileProvider>,
  );
const pressDelete = async (label = "Rumah") => fireEvent.press(await screen.findByRole("button", { name: `Hapus ${label}` }));

it("an unused address asks once, deletes and says Alamat dihapus", async () => {
  renderBook();
  await pressDelete();
  await waitFor(() => expect(command).toHaveBeenCalledWith("address.delete", { addressId: HOME.id }, expect.any(String)));
  expect(addressUse).toHaveBeenCalledWith(HOME.id);
  expect(mockConfirm).toHaveBeenCalledWith({
    title: "Hapus alamat ini?",
    message: "Rumah tidak muncul lagi di daftar alamat. Pesanan yang sudah dibayar tetap memakai alamat ini.",
    confirmLabel: "Hapus",
    cancelLabel: "Batal",
    tone: "danger",
    icon: "trash",
  });
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: "Alamat dihapus", tone: "success" }));
  expect(mockAsk).not.toHaveBeenCalled();
});

it("Batal keeps the address", async () => {
  mockConfirm.mockResolvedValueOnce(false);
  renderBook();
  await pressDelete();
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
  expect(command).not.toHaveBeenCalled();
  expect(mockToast).not.toHaveBeenCalled();
});

it("an address in use says how many deliveries and when, then moves them", async () => {
  addressUse.mockResolvedValue(inUse);
  mockAsk.mockResolvedValueOnce(OFFICE.id);
  command.mockResolvedValueOnce({ moved: 12, stayed: 0, stayedUntil: null, kitchens: [], pendingCheckouts: 0, deleted: true });
  renderBook();
  await pressDelete();
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: "Alamat dihapus", tone: "success" }));
  expect(mockConfirm).toHaveBeenCalledWith({
    title: "Alamat masih dipakai",
    message: "Alamat ini masih dipakai untuk 12 pengantaran, 13 Okt sampai 31 Okt.",
    confirmLabel: "Pindahkan ke alamat lain",
    cancelLabel: "Batal",
  });
  expect(mockAsk).toHaveBeenCalledWith({
    title: "Pindahkan ke alamat mana?",
    context: { title: "Rumah", lines: [HOME.line] },
    items: [
      { key: OFFICE.id, label: "Kantor, Jakarta Pusat", icon: "location-outline" },
      { key: "baru", label: "Tambah alamat baru", icon: "add-outline" },
    ],
    closeLabel: "Tutup",
  });
  expect(command).toHaveBeenCalledWith("address.replace", { fromAddressId: HOME.id, toAddressId: OFFICE.id }, expect.any(String));
  expect(command).not.toHaveBeenCalledWith("address.delete", expect.anything(), expect.anything());
});

it("days that stayed are counted, dated and blamed on the kitchen outside the new area", async () => {
  addressUse.mockResolvedValue(inUse);
  mockAsk.mockResolvedValueOnce(OFFICE.id);
  mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  command.mockResolvedValueOnce({
    moved: 10,
    stayed: 2,
    stayedUntil: "2026-10-14",
    kitchens: [{ id: "h", name: "Hijau Kitchen", reason: "COVERAGE" }],
    pendingCheckouts: 0,
    deleted: false,
  });
  renderBook();
  await pressDelete();
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
  expect(mockConfirm.mock.calls[1][0]).toEqual({
    title: "10 pengantaran dipindahkan",
    message:
      "2 pengantaran tetap ke alamat lama sampai 14 Okt. Hijau Kitchen tidak mengantar ke alamat baru. Alamat lama tetap ada di daftar. Hapus lagi setelah pengantaran itu selesai.",
    confirmLabel: "Lihat jadwal",
    cancelLabel: "Tutup",
  });
  expect(mockToast).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it("Tambah alamat baru opens the address form instead of moving", async () => {
  addressUse.mockResolvedValue(inUse);
  mockAsk.mockResolvedValueOnce("baru");
  renderBook();
  await pressDelete();
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/alamat-form"));
  expect(command).not.toHaveBeenCalled();
});

it("Hapus is busy until the removal settles and a second press sends nothing", async () => {
  jest.useFakeTimers();
  let answer!: (use: AddressUse) => void;
  addressUse.mockImplementation(() => new Promise<AddressUse>((resolve) => (answer = resolve)));
  mockConfirm.mockResolvedValue(false);
  renderBook();
  const button = await screen.findByRole("button", { name: "Hapus Rumah" });
  fireEvent.press(button);
  fireEvent.press(button);
  act(() => void jest.advanceTimersByTime(150));
  expect(screen.getByRole("button", { name: "Hapus Rumah" }).props.accessibilityState).toMatchObject({ busy: true });
  expect(screen.getByTestId("button-spinner")).toBeTruthy();
  expect(addressUse).toHaveBeenCalledTimes(1);
  await act(async () => answer(unused));
  await waitFor(() => expect(screen.getByRole("button", { name: "Hapus Rumah" }).props.accessibilityState).toMatchObject({ busy: false }));
  jest.useRealTimers();
});

it("a failed read ends in an error toast with Coba lagi", async () => {
  addressUse.mockRejectedValueOnce(new Error("REQUEST_TIMEOUT"));
  renderBook();
  await pressDelete();
  await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
  const toast = mockToast.mock.calls[0][0];
  expect(toast).toMatchObject({ message: "Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi.", tone: "error", action: { label: "Coba lagi" } });
  addressUse.mockResolvedValueOnce(unused);
  await act(async () => toast.action.onPress());
  await waitFor(() => expect(command).toHaveBeenCalledWith("address.delete", { addressId: HOME.id }, expect.any(String)));
});

it("a payment still open blocks the delete and offers no move", async () => {
  addressUse.mockResolvedValue({ ...unused, pendingCheckouts: 1 });
  renderBook();
  await pressDelete();
  await waitFor(() =>
    expect(mockToast).toHaveBeenCalledWith({
      message: "Alamat ini masih dipakai untuk pembayaran yang belum selesai. Coba lagi setelah dibayar atau kedaluwarsa.",
      tone: "error",
    }),
  );
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(command).not.toHaveBeenCalled();
});

it("a move held back only by an open payment says so", async () => {
  addressUse.mockResolvedValue(inUse);
  mockAsk.mockResolvedValueOnce(OFFICE.id);
  mockConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
  command.mockResolvedValueOnce({ moved: 12, stayed: 0, stayedUntil: null, kitchens: [], pendingCheckouts: 1, deleted: false });
  renderBook();
  await pressDelete();
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
  expect(mockConfirm.mock.calls[1][0]).toEqual({
    title: "12 pengantaran dipindahkan",
    message:
      "Alamat lama masih dipakai untuk pembayaran yang belum selesai, jadi belum terhapus. Hapus lagi setelah pembayaran itu selesai atau kedaluwarsa.",
    confirmLabel: "Lihat jadwal",
    cancelLabel: "Tutup",
  });
});
