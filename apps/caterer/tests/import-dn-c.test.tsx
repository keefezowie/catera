import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { ImportRowEditor } from "../src/import/RowEditor";
import { lastGuard, resetSheets, SheetHost } from "./sheet-host";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ base64: async () => "RklMRQ==" })) }));
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const Image = (props: Record<string, unknown>) => createElement(View, props);
  Image.loadAsync = jest.fn(() => Promise.resolve({}));
  return { Image };
});
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

beforeEach(() => resetSheets());

const picker = jest.requireMock("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };
const documents = jest.requireMock("expo-document-picker") as { getDocumentAsync: jest.Mock };
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

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
const reply = (list: unknown[]) => ({ ok: true, json: async () => ({ data: { rows: list, needsReview: 0 } }) });

function setup(command: jest.Mock, response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }] })),
    command,
  } as unknown as MobileRuntime["api"];
  global.fetch = jest.fn(async () => response) as unknown as typeof fetch;
  render(
    withDapurScale(
      <ThemeProvider storageKey="impor.dnc.theme">
        <MobileProvider runtime={runtime} linkMapper={() => "/"}>
          <ToastProvider>
            <ImportAssistant />
            <SheetHost render={({ path, params }) => (path === "/impor-baris" ? <ImportRowEditor n={Number(params.n)} /> : null)} />
          </ToastProvider>
        </MobileProvider>
      </ThemeProvider>,
    ),
  );
}
const type = async (text = "daftar") => fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), text);
const read = async () => {
  await type();
  fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
};

describe("unsaved guard", () => {
  it("holds a close while text is pasted, and lets it go when empty", async () => {
    setup(jest.fn(), reply([]));
    await screen.findByLabelText("Tempel atau ketik daftar pelanggan");
    expect(lastGuard()).toBeNull();
    await type("Bu Ani");
    expect(lastGuard()).toMatchObject({ voice: "kamu" });
  });

  it("holds a close while read rows exist, and lets it go once they are all saved", async () => {
    const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-1", rows: [] } : { created: 1 }));
    setup(command, reply([row(1)]));
    await read();
    await screen.findByRole("button", { name: "Simpan 1 pelanggan" });
    expect(lastGuard()).not.toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Simpan 1 pelanggan" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("import.commit", expect.anything(), expect.any(String)));
    await waitFor(() => expect(lastGuard()).toBeNull());
  });
});

describe("Mulai lagi", () => {
  it("offers Urungkan, which brings the rows back", async () => {
    setup(jest.fn(), reply([row(1), row(2)]));
    await read();
    await screen.findByRole("button", { name: "Ubah Pelanggan 2" });
    fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    await screen.findByLabelText("Tempel atau ketik daftar pelanggan");
    expect(screen.queryByRole("button", { name: "Ubah Pelanggan 1" })).toBeNull();
    fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
    expect(await screen.findByRole("button", { name: "Ubah Pelanggan 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ubah Pelanggan 1" })).toBeTruthy();
  });
});

describe("review rows", () => {
  it("a row that needs checking lets its reason wrap; a clean row stays one line", async () => {
    setup(jest.fn(), reply([row(1), row(2, { needsReview: true, reason: "Alamat belum lengkap, tambahkan nomor rumah dan RT" })]));
    await read();
    const line = await screen.findByTestId("import-row-2");
    expect(within(line).getByText("Alamat belum lengkap, tambahkan nomor rumah dan RT").props.numberOfLines).toBeUndefined();
    expect(within(screen.getByTestId("import-row-1")).getByText(/Setiabudi/).props.numberOfLines).toBe(1);
  });

  it("the ready count uses tabular figures", async () => {
    setup(jest.fn(), reply([row(1)]));
    await read();
    expect(flat(await screen.findByText("1 siap disimpan"))).toMatchObject({ fontVariant: ["tabular-nums"] });
  });

  it("the date field opens the numbers and punctuation keyboard", async () => {
    setup(jest.fn(), reply([row(1)]));
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 1" }));
    expect((await screen.findByLabelText("Antar berikutnya (TTTT-BB-HH)")).props.keyboardType).toBe("numbers-and-punctuation");
  });
});

describe("errors", () => {
  it("a failed save shows its error in the footer, with the save button", async () => {
    const command = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    setup(command, reply([row(1)]));
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Simpan 1 pelanggan" }));
    await waitFor(() => expect(within(screen.getByTestId("screen-footer")).getByTestId("form-error")).toBeTruthy());
    expect(within(screen.getByTestId("screen-footer")).getByRole("button", { name: "Simpan 1 pelanggan" })).toBeTruthy();
  });

  it("a gallery that fails to open says so instead of rejecting", async () => {
    setup(jest.fn(), reply([]));
    picker.launchImageLibraryAsync.mockRejectedValueOnce(new Error("denied"));
    fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    expect(await screen.findByText("Foto belum bisa dibuka. Coba lagi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tambah foto" }).props.accessibilityState).toMatchObject({ busy: false });
  });

  it("a photo that cannot be shrunk says so", async () => {
    setup(jest.fn(), reply([]));
    const manipulator = (jest.requireMock("expo-image-manipulator") as { ImageManipulator: { manipulate: jest.Mock } }).ImageManipulator;
    manipulator.manipulate.mockImplementationOnce(() => {
      throw new Error("bad image");
    });
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///x.jpg", width: 3000, height: 4000 }] });
    fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    expect(await screen.findByText("Foto belum bisa dibuka. Coba lagi.")).toBeTruthy();
  });

  it("a file that fails to read says so instead of rejecting", async () => {
    setup(jest.fn(), reply([]));
    documents.getDocumentAsync.mockRejectedValueOnce(new Error("gone"));
    fireEvent.press(await screen.findByRole("button", { name: "+ PDF / Excel" }));
    expect(await screen.findByText("File belum bisa dibaca. Coba lagi.")).toBeTruthy();
  });
});
