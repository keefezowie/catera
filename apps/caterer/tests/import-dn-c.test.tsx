import { earliestImportStart, longDay } from "@catera/domain";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { ImportRowEditor } from "../src/import/RowEditor";
import { lastConfirm, lastGuard, resetSheets, SheetHost } from "./sheet-host";
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
  startDate: "2999-01-05",
  remainingDays: 9,
  portions: 1,
  needsReview: false,
  reason: "",
  ...extra,
});
const saved = (command: jest.Mock) => command.mock.calls.filter((c) => c[0] === "import.draftSave").map((c) => c[1] as { catererId: string; rows: { name: string }[] });
const reply = (list: unknown[]) => ({ ok: true, json: async () => ({ data: { rows: list, needsReview: 0 } }) });

async function setup(command: jest.Mock, response: { ok: boolean; status?: number; json: () => Promise<unknown> }, draft: { rows: unknown[]; updatedAt: string } | null = null) {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }], draft })),
    command,
  } as unknown as MobileRuntime["api"];
  global.fetch = jest.fn(async () => response) as unknown as typeof fetch;
  await render(
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
const type = async (text = "daftar") => await fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), text);
const read = async () => {
  await type();
  await fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
};

describe("unsaved guard", () => {
  it("holds a close while text is pasted, and lets it go when empty", async () => {
    await setup(jest.fn(), reply([]));
    await screen.findByLabelText("Tempel atau ketik daftar pelanggan");
    expect(lastGuard()).toBeNull();
    await type("Bu Ani");
    expect(lastGuard()).toMatchObject({ voice: "kamu" });
  });

  it("lets a read list go, because the draft holds it, and holds the close when the draft failed", async () => {
    const command = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    await setup(command, reply([row(1)]));
    await read();
    await screen.findByRole("button", { name: "Simpan 1 pelanggan" });
    expect(lastGuard()).toBeNull();
    expect(await screen.findByTestId("import-draft-failed")).toBeTruthy();
    expect(lastGuard()).not.toBeNull();
  });
});

describe("the draft", () => {
  const ok = () => jest.fn(async () => ({ saved: 1 }));
  const draft = (...rows: unknown[]) => ({ rows, updatedAt: "2026-11-04T09:20:00Z" });

  it("saves the list on the server as it changes", async () => {
    const command = ok();
    await setup(command, reply([row(1), row(2, { area: "", needsReview: true, reason: "x" })]));
    await read();
    await waitFor(() => expect(saved(command).length).toBeGreaterThan(0));
    expect(saved(command).at(-1)).toMatchObject({ catererId: "k-1", rows: [{ name: "Pelanggan 1" }, { name: "Pelanggan 2" }] });
  });

  it("waits on the first screen with who is in it, and opens with Lanjutkan, today's checks applied", async () => {
    const command = ok();
    await setup(command, reply([]), draft({ ...row(1), n: 7, startDate: "2020-01-01" }));
    const card = await screen.findByTestId("import-draft");
    expect(within(card).getByText("Draf: 1 pelanggan")).toBeTruthy();
    expect(within(card).getByText(/^Pelanggan 1 · diubah/)).toBeTruthy();
    // Left alone, the waiting draft is not overwritten.
    await new Promise((done) => setTimeout(done, 700));
    expect(saved(command)).toHaveLength(0);
    await fireEvent.press(within(card).getByRole("button", { name: "Lanjutkan" }));
    expect(await screen.findByText("0 dari 1 pelanggan siap disimpan")).toBeTruthy();
    expect(screen.getByText(/^Antar berikutnya paling cepat/)).toBeTruthy();
  });

  it("adds a newly read list to the waiting draft", async () => {
    await setup(ok(), reply([row(2)]), draft(row(1)));
    await screen.findByTestId("import-draft");
    await read();
    expect(await screen.findByText("Pelanggan 2")).toBeTruthy();
    expect(screen.getByText("Pelanggan 1")).toBeTruthy();
    expect(screen.queryByTestId("import-draft")).toBeNull();
  });

  it("a saved customer leaves the draft, and Mulai lagi empties it", async () => {
    const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-1", rows: [] } : { created: 1, saved: 0 }));
    await setup(command, reply([row(1), row(2, { area: "", needsReview: true, reason: "x" })]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 1 pelanggan" }));
    await waitFor(() => expect(saved(command).at(-1)?.rows.map((r) => r.name)).toEqual(["Pelanggan 2"]));
    await fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    await lastConfirm().press("Kosongkan");
    await waitFor(() => expect(saved(command).at(-1)?.rows).toEqual([]));
  });
});

describe("Mulai lagi", () => {
  it("offers Urungkan, which brings the rows back", async () => {
    await setup(jest.fn(), reply([row(1), row(2)]));
    await read();
    await screen.findByRole("button", { name: "Ubah Pelanggan 2" });
    await fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    await lastConfirm().press("Kosongkan");
    await screen.findByLabelText("Tempel atau ketik daftar pelanggan");
    expect(screen.queryByRole("button", { name: "Ubah Pelanggan 1" })).toBeNull();
    await fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
    expect(await screen.findByRole("button", { name: "Ubah Pelanggan 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ubah Pelanggan 1" })).toBeTruthy();
  });
});

describe("review rows", () => {
  it("a row that needs checking lets its reason wrap; a clean row stays one line", async () => {
    await setup(jest.fn(), reply([row(1), row(2, { needsReview: true, reason: "Alamat belum lengkap, tambahkan nomor rumah dan RT" })]));
    await read();
    const line = await screen.findByTestId("import-row-2");
    expect(within(line).getByText("Alamat belum lengkap, tambahkan nomor rumah dan RT").props.numberOfLines).toBeUndefined();
    expect(within(screen.getByTestId("import-row-1")).getByText(/Setiabudi/).props.numberOfLines).toBe(1);
  });

  it("the ready count uses tabular figures", async () => {
    await setup(jest.fn(), reply([row(1)]));
    await read();
    expect(flat(await screen.findByText("1 dari 1 pelanggan siap disimpan"))).toMatchObject({ fontVariant: ["tabular-nums"] });
  });

  it("the date is picked from a calendar, and never typed", async () => {
    await setup(jest.fn(), reply([row(1, { startDate: null, needsReview: true, reason: "x" })]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: /^Lengkapi Pelanggan 1:/ }));
    const field = await screen.findByRole("button", { name: "Antar berikutnya, belum dipilih" });
    expect(screen.getByText("Pilih tanggal antar berikutnya")).toBeTruthy();
    await fireEvent.press(field);
    const first = earliestImportStart(new Date());
    expect(await screen.findByText(/paling cepat/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`calendar-day-${first}`));
    await fireEvent.press(screen.getByRole("button", { name: /^Pilih / }));
    expect(await screen.findByRole("button", { name: new RegExp("^Antar berikutnya, " + longDay(first, "id")) })).toBeTruthy();
  });

  it("says why a row can't be saved, under the field, with the package's limit and a fix", async () => {
    await setup(jest.fn(), reply([row(1, { remainingDays: 21, needsReview: true, reason: "x" })]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: /^Lengkapi Pelanggan 1:/ }));
    expect(await screen.findByText("Kurang 1 lagi")).toBeTruthy();
    expect(screen.getByText("Melebihi paket Makan Siang Rumahan (20 hari)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lengkapi yang kurang" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Pakai 20 hari" }));
    expect(await screen.findByText("Lengkap, siap disimpan")).toBeTruthy();
    expect(screen.queryByText(/Melebihi paket/)).toBeNull();
    expect(screen.getByRole("button", { name: "Selesai" })).toBeTruthy();
  });

  it("goes straight on to the next customer who needs something", async () => {
    await setup(jest.fn(), reply([row(1), row(2, { area: "", needsReview: true, reason: "x" })]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 1" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Lanjut ke Pelanggan 2" }));
    expect(await screen.findByText("Kurang 1 lagi")).toBeTruthy();
    expect(screen.getByLabelText("Nama").props.value).toBe("Pelanggan 2");
    expect(screen.getByText("Isi area")).toBeTruthy();
  });

  it("keeps a row the assistant guessed at until the caterer has looked", async () => {
    await setup(jest.fn(), reply([row(1, { needsReview: true, reason: "Nama kurang jelas" })]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: /^Lengkapi Pelanggan 1:/ }));
    expect(await screen.findByText("Perlu dicek: Nama kurang jelas")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sudah benar" }));
    expect(await screen.findByText("Lengkap, siap disimpan")).toBeTruthy();
  });
});

describe("errors", () => {
  it("a failed save shows its error in the footer, with the save button", async () => {
    const command = jest.fn(async () => {
      throw new Error("OFFLINE");
    });
    await setup(command, reply([row(1)]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 1 pelanggan" }));
    await waitFor(() => expect(within(screen.getByTestId("screen-footer")).getByTestId("form-error")).toBeTruthy());
    expect(within(screen.getByTestId("screen-footer")).getByRole("button", { name: "Simpan 1 pelanggan" })).toBeTruthy();
  });

  it("a gallery that fails to open says so instead of rejecting", async () => {
    await setup(jest.fn(), reply([]));
    picker.launchImageLibraryAsync.mockRejectedValueOnce(new Error("denied"));
    await fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    expect(await screen.findByText("Foto belum bisa dibuka. Coba lagi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tambah foto" }).props.accessibilityState).toMatchObject({ busy: false });
  });

  it("a photo that cannot be shrunk says so", async () => {
    await setup(jest.fn(), reply([]));
    const manipulator = (jest.requireMock("expo-image-manipulator") as { ImageManipulator: { manipulate: jest.Mock } }).ImageManipulator;
    manipulator.manipulate.mockImplementationOnce(() => {
      throw new Error("bad image");
    });
    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: false, assets: [{ uri: "file:///x.jpg", width: 3000, height: 4000 }] });
    await fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    expect(await screen.findByText("Foto belum bisa dibuka. Coba lagi.")).toBeTruthy();
  });

  it("a file that fails to read says so instead of rejecting", async () => {
    await setup(jest.fn(), reply([]));
    documents.getDocumentAsync.mockRejectedValueOnce(new Error("gone"));
    await fireEvent.press(await screen.findByRole("button", { name: "+ PDF / Excel" }));
    expect(await screen.findByText("File belum bisa dibaca. Coba lagi.")).toBeTruthy();
  });
});
