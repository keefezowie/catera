import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { ImportRowEditor } from "../src/import/RowEditor";
import { lastConfirm, resetSheets, SheetHost } from "./sheet-host";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
const mockBase64 = jest.fn(async () => "RklMRQ==");
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ base64: mockBase64 })) }));
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

const documents = jest.requireMock("expo-document-picker") as { getDocumentAsync: jest.Mock };

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  name: `Pelanggan ${n}`,
  phone: `+6281234${String(n).padStart(6, "0")}`,
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
const reply = (list: unknown[]) => ({ ok: true, json: async () => ({ data: { rows: list, needsReview: 0 } }) });
const refusal = (code: string) => Object.assign(new Error(code), { code });

type Payload = { rows: { customer: { phone: string } }[]; id?: string };
const calls = (command: jest.Mock, action: string) => command.mock.calls.filter((c) => c[0] === action) as [string, Payload, string][];

/** A server that takes everything unless `preview` says otherwise. */
const server = (preview: (payload: Payload) => unknown = () => ({ id: "pv-1", rows: [] }), commit: () => unknown = () => ({ created: 1 })) =>
  jest.fn(async (action: string, payload: Payload) => {
    if (action === "import.preview") return preview(payload);
    if (action === "import.commit") return commit();
    return { saved: 1 };
  });

async function setup(command: jest.Mock, response: unknown, draft: { rows: unknown[]; updatedAt: string } | null = null) {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }], draft })),
    command,
  } as unknown as MobileRuntime["api"];
  const fetchMock = jest.fn(async (..._args: [string, RequestInit]) => response);
  global.fetch = fetchMock as unknown as typeof fetch;
  const ui = () =>
    withDapurScale(
      <ThemeProvider storageKey="impor.save.theme">
        <MobileProvider runtime={runtime} linkMapper={() => "/"}>
          <ToastProvider>
            <ImportAssistant />
            <SheetHost render={({ path, params }) => (path === "/impor-baris" ? <ImportRowEditor n={Number(params.n)} /> : null)} />
          </ToastProvider>
        </MobileProvider>
      </ThemeProvider>,
    );
  const view = await render(ui());
  return { fetchMock, view, ui };
}
const read = async () => {
  await fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
  await fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
};

describe("saving", () => {
  it("sends a list over the server's limit in parts of 100, and never row by row", async () => {
    const command = server();
    await setup(command, reply(Array.from({ length: 120 }, (_, i) => row(i + 1))));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 120 pelanggan" }));
    expect(await screen.findByText("120 pelanggan tersimpan")).toBeTruthy();
    expect(calls(command, "import.preview").map((c) => c[1].rows.length)).toEqual([100, 20]);
    expect(calls(command, "import.commit")).toHaveLength(2);
  });

  it("keeps a part already saved when a later part is refused", async () => {
    const command = server((payload) => {
      if (payload.rows.length === 20) throw refusal("CAPACITY");
      return { id: "pv-1", rows: [] };
    });
    await setup(command, reply(Array.from({ length: 120 }, (_, i) => row(i + 1))));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 120 pelanggan" }));
    expect(await screen.findByText("100 pelanggan tersimpan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan 20 pelanggan" })).toBeTruthy();
  });

  it("flags both rows that share a number, when each passes alone", async () => {
    const command = server((payload) => {
      if (payload.rows.length > 1) throw refusal("DUPLICATE_IMPORT");
      return { id: "pv-1", rows: [] };
    });
    await setup(command, reply([row(1), row(2, { phone: row(1).phone }), row(3)]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 3 pelanggan" }));
    expect(await screen.findByText("2 baris perlu dicek sebelum disimpan.")).toBeTruthy();
    expect(screen.getAllByText("Nomor WhatsApp ini dipakai juga di baris lain.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Simpan 1 pelanggan" })).toBeTruthy();
  });

  it("says what the server said when nothing can be flagged: capacity only in sum", async () => {
    const command = server((payload) => {
      if (payload.rows.length > 1) throw refusal("CAPACITY");
      return { id: "pv-1", rows: [] };
    });
    await setup(command, reply([row(1), row(2)]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 2 pelanggan" }));
    expect(await screen.findByText(/^Porsi pada salah satu tanggal sudah habis/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan 2 pelanggan" })).toBeTruthy();
  });

  it("flags the one row refused for its own data, and checks rows at most five at a time", async () => {
    let inFlight = 0;
    let most = 0;
    const bad = row(7).phone;
    const command = jest.fn(async (action: string, payload: Payload) => {
      if (action !== "import.preview") return { saved: 1 };
      if (payload.rows.length > 1) throw refusal("INVALID_INPUT");
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((done) => setTimeout(done, 1));
      inFlight -= 1;
      if (payload.rows[0].customer.phone === bad) throw refusal("INVALID_INPUT");
      return { id: "pv-1", rows: [] };
    });
    await setup(command, reply(Array.from({ length: 12 }, (_, i) => row(i + 1))));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 12 pelanggan" }));
    expect(await screen.findByText("1 baris perlu dicek sebelum disimpan.")).toBeTruthy();
    expect(most).toBe(5);
    expect(screen.getByTestId("import-row-7")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan 11 pelanggan" })).toBeTruthy();
  });

  it("retries a commit that timed out with the same preview and the same request", async () => {
    let commits = 0;
    const command = server(undefined, () => {
      commits += 1;
      if (commits === 1) throw refusal("REQUEST_TIMEOUT");
      return { created: 1 };
    });
    await setup(command, reply([row(1), row(2)]));
    await read();
    const save = await screen.findByRole("button", { name: "Simpan 2 pelanggan" });
    await fireEvent.press(save);
    await waitFor(() => expect(screen.getByTestId("form-error")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Simpan 2 pelanggan" }));
    expect(await screen.findByText("2 pelanggan tersimpan")).toBeTruthy();
    expect(calls(command, "import.preview")).toHaveLength(1);
    const [first, second] = calls(command, "import.commit");
    expect(second[1]).toEqual(first[1]);
    expect(second[2]).toBe(first[2]);
  });

  it("previews again once the list has changed after a failed commit", async () => {
    let commits = 0;
    const command = server(undefined, () => {
      commits += 1;
      if (commits === 1) throw refusal("REQUEST_TIMEOUT");
      return { created: 1 };
    });
    await setup(command, reply([row(1), row(2)]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Simpan 2 pelanggan" }));
    await waitFor(() => expect(screen.getByTestId("form-error")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Ubah Pelanggan 1" }));
    await fireEvent.changeText(await screen.findByLabelText("Nama"), "Bu Ani");
    await fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    await fireEvent.press(screen.getByRole("button", { name: "Simpan 2 pelanggan" }));
    await waitFor(() => expect(calls(command, "import.preview")).toHaveLength(2));
  });
});

describe("the waiting draft", () => {
  it("joins the list when the owner fills a row in by hand, and is not overwritten", async () => {
    const command = server();
    const disabled = { ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_ASSISTANT_DISABLED" } }) };
    await setup(command, disabled, { rows: [row(1)], updatedAt: "2026-11-04T09:20:00Z" });
    await screen.findByTestId("import-draft");
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Nanti saja" }));
    expect(screen.getByText("Pelanggan 1")).toBeTruthy();
    expect(screen.getByText("Tanpa nama")).toBeTruthy();
    await waitFor(() => expect(calls(command, "import.draftSave").length).toBeGreaterThan(0));
    for (const [, payload] of calls(command, "import.draftSave")) expect(payload.rows).toHaveLength(2);
  });
});

describe("reading", () => {
  it("refuses a file over the limit before reading it into memory", async () => {
    await setup(server(), reply([]));
    mockBase64.mockClear();
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: "besar.pdf", uri: "file:///besar.pdf", size: 3_000_000 }] });
    await fireEvent.press(await screen.findByRole("button", { name: "+ PDF / Excel" }));
    expect(await screen.findByText("File terlalu besar. Maksimal sekitar 2,8 MB.")).toBeTruthy();
    expect(mockBase64).not.toHaveBeenCalled();
  });

  it("takes a file under the limit", async () => {
    await setup(server(), reply([]));
    mockBase64.mockClear();
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: "kecil.pdf", uri: "file:///kecil.pdf", size: 1_000 }] });
    await fireEvent.press(await screen.findByRole("button", { name: "+ PDF / Excel" }));
    await waitFor(() => expect(mockBase64).toHaveBeenCalled());
  });

  it("calls the read off when Impor closes, and its late answer brings nothing back", async () => {
    let answer: (value: unknown) => void = () => undefined;
    const { fetchMock, view, ui } = await setup(server(), reply([]));
    fetchMock.mockImplementationOnce(() => new Promise((done) => (answer = done)));
    await read();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signal = fetchMock.mock.calls[0][1].signal!;
    expect(signal.aborted).toBe(false);
    await view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => answer(reply([row(1)])));
    await render(ui());
    expect(await screen.findByLabelText("Tempel atau ketik daftar pelanggan")).toBeTruthy();
    expect(screen.queryByText("Pelanggan 1")).toBeNull();
  });
});

describe("Mulai lagi", () => {
  it("asks first, in the danger tone, and leaves the list alone on Batal", async () => {
    const command = server();
    await setup(command, reply([row(1)]));
    await read();
    await screen.findByRole("button", { name: "Ubah Pelanggan 1" });
    await fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    expect(lastConfirm()).toMatchObject({ tone: "danger", confirmLabel: "Kosongkan", cancelLabel: "Batal" });
    await lastConfirm().press("Batal");
    expect(screen.getByRole("button", { name: "Ubah Pelanggan 1" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    await lastConfirm().press("Kosongkan");
    expect(await screen.findByLabelText("Tempel atau ketik daftar pelanggan")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Urungkan" })).toBeTruthy();
  });
});

describe("the row sheet's keyboard", () => {
  it("runs the text fields in order, with words capitalised", async () => {
    await setup(server(), reply([row(1)]));
    await read();
    await fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 1" }));
    const fields = ["Nama", "Nomor WhatsApp", "Alamat", "Area", "Kota"];
    for (const label of fields) await screen.findByLabelText(label);
    for (const label of fields.slice(0, -1)) expect(screen.getByLabelText(label).props).toMatchObject({ returnKeyType: "next", submitBehavior: "submit" });
    expect(screen.getByLabelText("Kota").props.returnKeyType).toBe("done");
    for (const label of ["Nama", "Alamat", "Area", "Kota"]) expect(screen.getByLabelText(label).props.autoCapitalize).toBe("words");
    expect(screen.getByLabelText("Nama").props.autoComplete).toBe("name");
    expect(screen.getByLabelText("Alamat").props.autoComplete).toBe("street-address");
  });
});
