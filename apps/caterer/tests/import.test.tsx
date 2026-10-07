import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { toImportRow } from "../src/import/rows";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
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
