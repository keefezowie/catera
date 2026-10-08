import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { toImportRow } from "../src/import/rows";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  name: `Pelanggan ${n}`,
  phone: `+62812345678${String(n).padStart(2, "0")}`,
  addressLine: `Jl. Contoh No. ${n}`,
  area: "Setiabudi",
  city: "Jakarta Selatan",
  notes: "",
  packageId: "p-rumahan",
  startDate: "2026-10-01",
  remainingDays: 9,
  portions: 1,
  needsReview: false,
  reason: "",
  ...extra,
});
const rows = [
  ...Array.from({ length: 25 }, (_, i) => row(i + 1)),
  row(26, { addressLine: "", needsReview: true, reason: "Alamat belum lengkap" }),
  row(27, { packageId: null, needsReview: true, reason: "Paket belum dipilih" }),
];

it("builds an import row with a generated reference", () => {
  expect(toImportRow(row(3), "2026-10-07", 3)).toEqual({
    customer: {
      name: "Pelanggan 3",
      phone: "+6281234567803",
      address: { label: "Rumah", line: "Jl. Contoh No. 3", area: "Setiabudi", city: "Jakarta Selatan", instructions: "" },
    },
    packageId: "p-rumahan",
    portions: 1,
    startDate: "2026-10-01",
    remainingDays: 9,
    externalReference: "impor-2026-10-07-3",
  });
});

it("saves only the rows that need no checking", async () => {
  const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-1", rows: [] } : { created: 25 }));
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }] })),
    command,
  } as unknown as MobileRuntime["api"];
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ data: { rows, needsReview: 2 } }) }));
  global.fetch = fetchMock as unknown as typeof fetch;
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <ImportAssistant />
    </MobileProvider>,
  );
  fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar pelanggan saya …");
  fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
  fireEvent.press(await screen.findByRole("button", { name: "Simpan 25 pelanggan" }));
  await waitFor(() => expect(command).toHaveBeenCalledWith("import.commit", { catererId: "k-1", id: "pv-1" }, expect.any(String)));
  const preview = command.mock.calls.find((c) => c[0] === "import.preview")! as unknown as [string, { rows: { externalReference: string }[] }];
  expect(preview[1].rows).toHaveLength(25);
  expect(preview[1].rows.map((r) => r.externalReference)).not.toContain("impor-2026-10-07-26");
  expect(screen.getByText("Alamat belum lengkap")).toBeTruthy();
});

it("flags a start date before the earliest one the kitchen can cook for", () => {
  const { recheck } = jest.requireActual("../src/import/rows") as typeof import("../src/import/rows");
  const checked = recheck(row(1, { startDate: "2026-10-01" }), [{ id: "p-rumahan", days: 20 }], "2026-10-08");
  expect(checked.needsReview).toBe(true);
  expect(checked.reason).toMatch(/2026-10-08/);
});

it("does not retry row by row when the connection drops", async () => {
  const command = jest.fn(async () => {
    throw new TypeError("Network request failed");
  });
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }] })),
    command,
  } as unknown as MobileRuntime["api"];
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: { rows: rows.slice(0, 3), needsReview: 0 } }) })) as unknown as typeof fetch;
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <ImportAssistant />
    </MobileProvider>,
  );
  fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
  fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
  fireEvent.press(await screen.findByRole("button", { name: "Simpan 3 pelanggan" }));
  await waitFor(() => expect(command).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));
  expect(command).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Simpan 3 pelanggan" })).toBeTruthy();
});

const disabled = { ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_ASSISTANT_DISABLED" } }) };
function setup(command: jest.Mock, response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({
      customers: [],
      packages: [
        { id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" },
        { id: "p-hemat", name: "Paket Hemat Kantor", days: 20, areas: [], meal: "lunch" },
      ],
    })),
    command,
  } as unknown as MobileRuntime["api"];
  global.fetch = jest.fn(async () => response) as unknown as typeof fetch;
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <ImportAssistant />
    </MobileProvider>,
  );
}
const read = async () => {
  fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
  fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
};

it("offers manual entry, not 'try later', when the assistant is switched off", async () => {
  setup(jest.fn(), disabled);
  await read();
  expect(await screen.findByText("Asisten impor belum aktif. Anda tetap bisa memasukkan pelanggan satu per satu.")).toBeTruthy();
  expect(screen.queryByText(/Coba lagi nanti/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Isi manual" }));
  expect(await screen.findByText("Tanpa nama")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tambah baris" })).toBeTruthy();
});

it("keeps 'Coba lagi nanti' and no manual button for a real outage", async () => {
  setup(jest.fn(), { ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_UNAVAILABLE" } }) });
  await read();
  expect(await screen.findByText("Asisten impor sedang tidak tersedia. Coba lagi nanti.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Isi manual" })).toBeNull();
});

it("saves manually typed rows through import.preview then import.commit", async () => {
  const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-9", rows: [] } : { created: 1 }));
  setup(command, disabled);
  await read();
  fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
  // the empty row opens for editing; it cannot be saved yet
  expect(screen.getByRole("button", { name: "Simpan 0 pelanggan" }).props.accessibilityState?.disabled).toBe(true);
  fireEvent.changeText(await screen.findByLabelText("Nama"), "Bu Ani");
  fireEvent(screen.getByLabelText("Nomor WhatsApp"), "endEditing", { nativeEvent: { text: "0812 3456 7890" } });
  fireEvent.changeText(screen.getByLabelText("Alamat"), "Jl. Melati 5");
  fireEvent.changeText(screen.getByLabelText("Area"), "Tebet");
  fireEvent.changeText(screen.getByLabelText("Kota"), "Jakarta Selatan");
  fireEvent.press(screen.getByRole("button", { name: "Paket Hemat Kantor" }));
  fireEvent.changeText(screen.getByLabelText("Antar berikutnya (TTTT-BB-HH)"), "2999-01-05");
  fireEvent.changeText(screen.getByLabelText("Sisa hari"), "8");
  fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
  fireEvent.press(await screen.findByRole("button", { name: "Simpan 1 pelanggan" }));
  await waitFor(() => expect(command).toHaveBeenCalledWith("import.commit", { catererId: "k-1", id: "pv-9" }, expect.any(String)));
  const preview = command.mock.calls.find((c) => c[0] === "import.preview")! as unknown as [string, { rows: Record<string, any>[] }];
  expect(preview[1].rows).toHaveLength(1);
  expect(preview[1].rows[0]).toMatchObject({
    customer: { name: "Bu Ani", phone: "+6281234567890", address: { line: "Jl. Melati 5", area: "Tebet", city: "Jakarta Selatan" } },
    packageId: "p-hemat",
    portions: 1,
    startDate: "2999-01-05",
    remainingDays: 8,
  });
});

it("adds another empty row with Tambah baris", async () => {
  setup(jest.fn(), disabled);
  await read();
  fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
  fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
  fireEvent.press(screen.getByRole("button", { name: "Tambah baris" }));
  fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
  expect(screen.getAllByText("Tanpa nama")).toHaveLength(2);
});

it("import row names a missing package", async () => {
  const unset = row(1, { packageId: null, remainingDays: null, needsReview: true, reason: "Perlu dicek" });
  setup(jest.fn(), { ok: true, json: async () => ({ data: { rows: [unset], needsReview: 1 } }) });
  await read();
  expect(await screen.findByText("Paket belum dipilih · sisa hari belum diisi · 1 porsi")).toBeTruthy();
  expect(screen.queryByText(/—/)).toBeNull();
  expect(screen.queryByText(/\?/)).toBeNull();
});
