import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { nativeMotion, nativeThemes } from "@catera/design-tokens";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { ImportPhotoViewer } from "../src/import/PhotoViewer";
import { toImportRow } from "../src/import/rows";
import { ImportRowEditor } from "../src/import/RowEditor";
import { declared, resetSheets, SheetHost } from "./sheet-host";
import { withDapurScale } from "./dapur-scale";

beforeEach(() => resetSheets());

/** Impor with its row sheet, as the root stack draws them. */
const Impor = () => (
  <>
    <ImportAssistant />
    <SheetHost render={({ path, params }) => (path === "/impor-baris" ? <ImportRowEditor n={Number(params.n)} /> : null)} />
  </>
);

// A row opens its own sheet route (`/impor-baris?n=…`); here the sheet shows next to Impor (`SheetHost`).
jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
// A picked file reads as base64 for the upload; here every file holds the same short body.
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ base64: async () => "RklMRQ==" })) }));
// expo-image draws through a native view. The stand-in is a host View that keeps every prop, so a test reads the
// `source` and `contentFit` it was given and can fire its `onError`.
jest.mock("expo-image", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const Image = (props: Record<string, unknown>) => createElement(View, props);
  Image.displayName = "ExpoImage";
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
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <Impor />
      </MobileProvider>,
    ),
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
  expect(checked.reason).toMatch(/Kamis 8 Okt/);
});

it("gives a row's reasons in English, with the date named and no ISO date", () => {
  const { recheck } = jest.requireActual("../src/import/rows") as typeof import("../src/import/rows");
  const checked = recheck(row(1, { name: "", startDate: "2026-10-01" }), [{ id: "p-rumahan", days: 20 }], "2026-10-08", (_id, en) => en, "en");
  expect(checked.reason).toContain("Name missing");
  expect(checked.reason).toContain("Next delivery can be Thu 8 Oct at the earliest");
  expect(checked.reason).not.toMatch(/\d{4}-\d{2}-\d{2}/);
});

it("says what is wrong with a package in English too", () => {
  const { packageIssues, emptyPackage } = jest.requireActual("../src/business/package") as typeof import("../src/business/package");
  const form = emptyPackage;
  const english = packageIssues(form, (_id: string, en: string) => en);
  expect(english.name).toBe("The package name needs at least 3 letters");
  expect(english.image).toBe("Add a package photo");
  expect(packageIssues(form).name).toBe("Nama paket minimal 3 huruf");
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
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <Impor />
      </MobileProvider>,
    ),
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
    withDapurScale(
      <ThemeProvider storageKey="impor.undo.theme">
        <MobileProvider runtime={runtime} linkMapper={() => "/"}>
          <ToastProvider>
            <Impor />
          </ToastProvider>
        </MobileProvider>
      </ThemeProvider>,
    ),
  );
}
const read = async () => {
  fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
  fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
};

it("offers manual entry, not 'try later', when the assistant is switched off", async () => {
  setup(jest.fn(), disabled);
  await read();
  expect(await screen.findByText("Asisten impor belum aktif. Kamu tetap bisa memasukkan pelanggan satu per satu.")).toBeTruthy();
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

it("a phone typed and never blurred still reaches the preview in the +62 form", async () => {
  const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-9", rows: [] } : { created: 1 }));
  setup(command, disabled);
  await read();
  fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
  fireEvent.changeText(await screen.findByLabelText("Nama"), "Bu Ani");
  // changeText only: the keyboard never ends the edit before Selesai is pressed.
  fireEvent.changeText(screen.getByLabelText("Nomor WhatsApp"), "0812 3456 7890");
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
  expect(preview[1].rows[0].customer.phone).toBe("+6281234567890");
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

it("a review row dims on press and still opens its editor", async () => {
  const unset = row(1, { needsReview: true, reason: "Alamat belum lengkap" });
  setup(jest.fn(), { ok: true, json: async () => ({ data: { rows: [unset], needsReview: 1 } }) });
  await read();
  const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
  const edit = async () => screen.findByRole("button", { name: "Ubah Pelanggan 1" });
  fireEvent(await edit(), "responderGrant", touch);
  expect(StyleSheet.flatten((await edit()).props.style).opacity).toBe(0.7);
  // What the row still needs is a to-do: its one line on the list, bold charcoal in its sheet, never a bare danger caption.
  const bold = { color: nativeThemes.light.charcoal, fontFamily: "Jakarta-Bold" };
  expect(screen.getByText("Alamat belum lengkap")).toBeTruthy();
  fireEvent.press(await edit());
  expect(await screen.findByRole("button", { name: "Selesai" })).toBeTruthy();
  expect(StyleSheet.flatten(screen.getByTestId("import-row-reason").props.style)).toMatchObject(bold);
});

describe("deleting an import row", () => {
  const three = { ok: true, json: async () => ({ data: { rows: [row(1), row(2), row(3)], needsReview: 0 } }) };
  const names = () => screen.getAllByTestId("import-row").map((card) => within(card).getByRole("button").props.accessibilityLabel);
  /** Opens row 2, renames it, and takes it off with Hapus baris ini. */
  async function deleteSecond() {
    setup(jest.fn(), three);
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 2" }));
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Budi");
    fireEvent.press(await screen.findByRole("button", { name: "Hapus baris ini" }));
  }

  it("deleting an import row shows the undo toast", async () => {
    await deleteSecond();
    expect(await screen.findByText("Baris dihapus")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Urungkan" })).toBeTruthy();
    await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Pelanggan 3"]));
  });

  it("Urungkan restores the row at its place with its edits", async () => {
    await deleteSecond();
    fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
    await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Budi", "Ubah Pelanggan 3"]));
    expect(screen.queryByText("Baris dihapus")).toBeNull();
  });

  it("the toast passing leaves the row deleted", async () => {
    jest.useFakeTimers();
    try {
      await deleteSecond();
      expect(await screen.findByText("Baris dihapus")).toBeTruthy();
      act(() => void jest.advanceTimersByTime(5100));
      await waitFor(() => expect(screen.queryByText("Baris dihapus")).toBeNull());
      expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Pelanggan 3"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("deleting the only row, then Urungkan, brings it back", async () => {
    setup(jest.fn(), { ok: true, json: async () => ({ data: { rows: [row(1)], needsReview: 0 } }) });
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 1" }));
    fireEvent.press(await screen.findByRole("button", { name: "Hapus baris ini" }));
    fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
    await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1"]));
  });

  /** A command whose `import.commit` waits until the test lets it go. */
  function pendingCommit() {
    let finish: () => void = () => {};
    const command = jest.fn((action: string) =>
      action === "import.preview" ? Promise.resolve({ id: "pv-1", rows: [] }) : new Promise((resolve) => (finish = () => resolve({ created: 3 }))),
    );
    return { command, finish: () => finish() };
  }

  it("a row deleted during a save stays gone, and Urungkan cannot bring back a customer that got saved", async () => {
    const { command, finish } = pendingCommit();
    setup(command, three);
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Simpan 3 pelanggan" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("import.commit", { catererId: "k-1", id: "pv-1" }, expect.any(String)));
    // The save carries row 2; while it waits, the caterer deletes row 2.
    fireEvent.press(screen.getByRole("button", { name: "Ubah Pelanggan 2" }));
    fireEvent.press(await screen.findByRole("button", { name: "Hapus baris ini" }));
    expect(await screen.findByText("Baris dihapus")).toBeTruthy();
    await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Pelanggan 3"]));
    await act(async () => finish());
    // Row 2 was saved with the batch, so its undo goes away and the row does not come back.
    await waitFor(() => expect(screen.queryByText("Baris dihapus")).toBeNull());
    expect(screen.queryByRole("button", { name: "Urungkan" })).toBeNull();
    expect(screen.queryAllByTestId("import-row")).toHaveLength(0);
  });

  it("a row deleted before a save was never saved, so its Urungkan stays after the save", async () => {
    const { command, finish } = pendingCommit();
    setup(command, three);
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 2" }));
    fireEvent.changeText(await screen.findByLabelText("Nama"), "Budi");
    fireEvent.press(await screen.findByRole("button", { name: "Hapus baris ini" }));
    fireEvent.press(await screen.findByRole("button", { name: "Simpan 2 pelanggan" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("import.commit", { catererId: "k-1", id: "pv-1" }, expect.any(String)));
    await act(async () => finish());
    await waitFor(() => expect(screen.queryAllByTestId("import-row")).toHaveLength(0));
    fireEvent.press(screen.getByRole("button", { name: "Urungkan" }));
    await waitFor(() => expect(names()).toEqual(["Ubah Budi"]));
  });

  it("Hapus baris ini closes the sheet first and takes the row off only once the sheet has gone (G1a)", async () => {
    setup(jest.fn(), three);
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Pelanggan 2" }));
    // On the phone the sheet stays drawn while it slides away (and longer under TalkBack): here back does not unmount it.
    const back = router.back as jest.Mock;
    const unmount = back.getMockImplementation()!;
    back.mockImplementationOnce(() => {});
    const calls = back.mock.calls.length;
    fireEvent.press(await screen.findByRole("button", { name: "Hapus baris ini" }));
    expect(back).toHaveBeenCalledTimes(calls + 1);
    // While it leaves, the sheet still shows the row, never "no longer there", and the list still holds it.
    const sheet = screen.getByTestId("import-row-sheet");
    expect(within(sheet).queryByText("Baris ini sudah tidak ada.")).toBeNull();
    expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Pelanggan 2", "Ubah Pelanggan 3"]);
    expect(screen.queryByText("Baris dihapus")).toBeNull();
    // A second tap while it leaves removes nothing twice.
    fireEvent.press(within(sheet).getByRole("button", { name: "Hapus baris ini" }));
    // The sheet has gone: now the row leaves the list and the undo is offered.
    act(() => unmount());
    await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Pelanggan 3"]));
    expect(await screen.findByText("Baris dihapus")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Urungkan" })).toHaveLength(1);
  });

  it("a restored row waits for the rows below to make room, then fades in, so it never overlaps the next card", async () => {
    const reanimated = jest.requireMock("react-native-reanimated") as { FadeIn: { delay: (ms: number) => unknown }; FadeInDown: unknown };
    const delay = jest.spyOn(reanimated.FadeIn, "delay");
    try {
      await deleteSecond();
      fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
      await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Budi", "Ubah Pelanggan 3"]));
      const card = (name: string) => screen.getAllByTestId("import-row").find((c) => within(c).queryByRole("button", { name }))!;
      // Fade only (no rise), starting once the rows' own move (content) has run; the rows below still move with layout.
      expect(card("Ubah Budi").props.entering).toBe(reanimated.FadeIn);
      expect(delay).toHaveBeenCalledWith(nativeMotion.content);
      expect(card("Ubah Pelanggan 3").props.layout).toBeDefined();
      expect(card("Ubah Pelanggan 3").props.entering).toBeUndefined();
      // A row typed in by hand is new, not restored: it keeps the usual rise.
      fireEvent.press(screen.getByRole("button", { name: "Tambah baris" }));
      if (screen.queryByTestId("import-row-sheet")) fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
      const rows = screen.getAllByTestId("import-row");
      expect(rows).toHaveLength(4);
      expect(rows[3].props.entering).toBe(reanimated.FadeInDown);
    } finally {
      delay.mockRestore();
    }
  });

  it("Urungkan under reduced motion puts the row back at once, with no entrance or exit", async () => {
    const reanimated = jest.requireMock("react-native-reanimated") as { useReducedMotion: jest.Mock };
    reanimated.useReducedMotion.mockReturnValue(true);
    try {
      await deleteSecond();
      fireEvent.press(await screen.findByRole("button", { name: "Urungkan" }));
      await waitFor(() => expect(names()).toEqual(["Ubah Pelanggan 1", "Ubah Budi", "Ubah Pelanggan 3"]));
      for (const card of screen.getAllByTestId("import-row")) {
        expect(card.props.entering).toBeUndefined();
        expect(card.props.exiting).toBeUndefined();
      }
    } finally {
      reanimated.useReducedMotion.mockReturnValue(false);
    }
  });
});

const flatStyle = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
/** The nearest node above `node` whose style sets `key`. */
const above = (node: { props: { style?: unknown }; parent: unknown }, key: string) => {
  for (let n = node as { props: { style?: unknown }; parent: typeof node | null } | null; n; n = n.parent) if (flatStyle(n)[key as never] !== undefined) return flatStyle(n);
  return {};
};
const response = (list: unknown[]) => ({ ok: true, json: async () => ({ data: { rows: list, needsReview: 0 } }) });

describe("the review list on the Dapur scale (spec 3.7)", () => {
  it("is one list card of 64 two-line rows, each with its name, a one-line meta and a trailing Ubah", async () => {
    setup(jest.fn(), response([row(1), row(2), row(3)]));
    await read();
    const card = await screen.findByTestId("list-card");
    // One card for every row, not a card each, and a hairline between rows that starts at the text column (0).
    expect(screen.getAllByTestId("list-card")).toHaveLength(1);
    expect(within(card).getAllByTestId("import-row")).toHaveLength(3);
    const separators = within(card).getAllByTestId("list-card-separator");
    expect(separators).toHaveLength(2);
    expect(flatStyle(separators[0])).toMatchObject({ height: 1, marginLeft: 0 });
    for (const n of [1, 2, 3]) {
      const line = screen.getByTestId(`import-row-${n}`);
      expect(flatStyle(line)).toMatchObject({ minHeight: 64, gap: 12 });
      expect(line.props.accessibilityRole).toBe("button");
      expect(line.props.accessibilityLabel).toBe(`Ubah Pelanggan ${n}`);
      const name = within(line).getByText(`Pelanggan ${n}`);
      expect(flatStyle(name)).toMatchObject({ fontSize: 17, lineHeight: 22 });
      expect(name.props.numberOfLines).toBe(1);
      // Phone and area, one 13/18 line.
      const meta = within(line).getByText(`+62812345678${String(n).padStart(2, "0")} · Setiabudi`);
      expect(flatStyle(meta)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(meta.props.numberOfLines).toBe(1);
      const trailing = screen.getByTestId(`import-row-${n}-trailing`);
      const edit = within(trailing).getByText("Ubah");
      expect(flatStyle(edit)).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-SemiBold", color: nativeThemes.light.forest });
      expect(within(trailing).queryByTestId(`import-row-${n}-pill`)).toBeNull();
    }
    expect(screen.getByText("3 siap disimpan")).toBeTruthy();
    expect(flatStyle(screen.getByText("3 siap disimpan"))).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-SemiBold" });
  });

  it("holds 20 rows in the same one card, 19 hairlines between them", async () => {
    setup(jest.fn(), response(Array.from({ length: 20 }, (_, i) => row(i + 1))));
    await read();
    const card = await screen.findByTestId("list-card");
    expect(within(card).getAllByTestId("import-row")).toHaveLength(20);
    expect(within(card).getAllByTestId("list-card-separator")).toHaveLength(19);
    expect(screen.getByRole("button", { name: "Simpan 20 pelanggan" })).toBeTruthy();
  });

  it("draws no empty card for no rows, and still offers a row to add", async () => {
    setup(jest.fn(), response([]));
    await read();
    expect(await screen.findByText("0 siap disimpan")).toBeTruthy();
    expect(screen.queryByTestId("list-card")).toBeNull();
    expect(screen.getByRole("button", { name: "Tambah baris" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan 0 pelanggan" }).props.accessibilityState?.disabled).toBe(true);
  });

  it("marks a row with a problem with a pale pill, and its one line says what it needs", async () => {
    setup(jest.fn(), response([row(1), row(2, { addressLine: "", needsReview: true, reason: "Alamat belum lengkap" })]));
    await read();
    expect(await screen.findByText("1 siap disimpan · 1 perlu dicek")).toBeTruthy();
    // Only the problem row has the pill, in the trailing column before Ubah.
    expect(screen.queryByTestId("import-row-1-pill")).toBeNull();
    const pill = screen.getByTestId("import-row-2-pill");
    expect(within(screen.getByTestId("import-row-2-trailing")).getByTestId("import-row-2-pill")).toBe(pill);
    expect(flatStyle(pill)).toMatchObject({ backgroundColor: nativeThemes.light.cream, minHeight: 28, borderRadius: 14 });
    const label = within(pill).getByText("Perlu dicek");
    expect(flatStyle(label)).toMatchObject({ color: nativeThemes.light.charcoal, fontFamily: "Jakarta-Bold" });
    // What the row still needs is the row's one line (bold ink in its sheet), and the row is still one 64 line.
    const line = screen.getByTestId("import-row-2");
    expect(within(line).getByText("Alamat belum lengkap").props.numberOfLines).toBe(1);
    expect(flatStyle(line)).toMatchObject({ minHeight: 64 });
    expect(screen.getByRole("button", { name: "Ubah Pelanggan 2" })).toBe(line);
  });

  it("names a row with no name by its place in the list, and says what a missing package needs", async () => {
    const unset = row(1, { name: "", packageId: null, remainingDays: null, needsReview: true, reason: "Paket belum dipilih" });
    setup(jest.fn(), response([unset]));
    await read();
    expect(await screen.findByText("Tanpa nama")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ubah baris 1" })).toBeTruthy();
    expect(screen.getByText("Paket belum dipilih")).toBeTruthy();
    expect(screen.queryByText(/—/)).toBeNull();
    expect(screen.queryByText(/\?/)).toBeNull();
  });

  it("the buttons under the card are Tambah baris and Mulai lagi", async () => {
    setup(jest.fn(), response([row(1)]));
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Tambah baris" }));
    expect(router.push).toHaveBeenLastCalledWith("/impor-baris?n=2");
    fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    fireEvent.press(screen.getByRole("button", { name: "Mulai lagi" }));
    expect(await screen.findByLabelText("Tempel atau ketik daftar pelanggan")).toBeTruthy();
  });
});

describe("the paste stage on the Dapur scale", () => {
  it("draws the paste field with the Field's geometry: radius 12, 16 inset, at least 160 tall, 15/22 text", async () => {
    setup(jest.fn(), response([]));
    const field = await screen.findByLabelText("Tempel atau ketik daftar pelanggan");
    expect(flatStyle(field)).toMatchObject({ borderRadius: 12, padding: 16, minHeight: 160, fontSize: 15, lineHeight: 22 });
  });

  it("sets the intro as 15/22 body and the privacy note as 13/18 meta", async () => {
    setup(jest.fn(), response([]));
    const intro = await screen.findByText(/^Tempel catatan atau chat WhatsApp/);
    expect(flatStyle(intro)).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(flatStyle(screen.getByText(/^AI membaca data ini/))).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it("the reading state names the wait in the footer: 15/22 semibold", async () => {
    setup(jest.fn(), { ok: true, json: () => new Promise(() => {}) });
    await read();
    const said = await screen.findByText("Membaca daftar pelanggan…");
    expect(flatStyle(said)).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-SemiBold" });
  });
});

describe("the row editor on the Dapur scale", () => {
  const options = { customers: [], packages: [{ id: "p-hemat", name: "Paket Hemat Kantor", days: 20, areas: [], meal: "lunch" }] };
  function editor(sellerImportOptions: jest.Mock) {
    global.fetch = jest.fn(async () => disabled) as unknown as typeof fetch;
    const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerImportOptions,
      command: jest.fn(),
    } as unknown as MobileRuntime["api"];
    render(
      withDapurScale(
        <ThemeProvider storageKey="impor.editor.theme">
          <MobileProvider runtime={runtime} linkMapper={() => "/"}>
            <ToastProvider>
              <Impor />
            </ToastProvider>
          </MobileProvider>
        </ThemeProvider>,
      ),
    );
  }

  it("while the package choices load, the sheet shows 50 tall field boxes, 12 apart, and a 34 chip", async () => {
    editor(jest.fn(() => new Promise(() => {})));
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    const sheet = await screen.findByTestId("import-row-sheet");
    const boxes = within(within(sheet).getByLabelText("Memuat pilihan paket")).getAllByTestId(/^import-row-skeleton-/);
    expect(boxes.map((b) => flatStyle(b).height)).toEqual([50, 50, 50, 34]);
    expect(flatStyle(boxes[0])).toMatchObject({ borderRadius: 12 });
    expect(flatStyle(boxes[3])).toMatchObject({ borderRadius: 17 });
    expect(flatStyle(within(sheet).getByTestId("import-row-skeleton"))).toMatchObject({ gap: 12 });
  });

  it("its package chips wrap with a 14 row gap so each 34 chip keeps a 48 target of its own", async () => {
    editor(jest.fn(async () => options));
    await read();
    fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    const sheet = await screen.findByTestId("import-row-sheet");
    const chip = await within(sheet).findByRole("button", { name: "Paket Hemat Kantor" });
    expect(above(chip, "flexWrap")).toMatchObject({ flexWrap: "wrap", columnGap: 8, rowGap: 14 });
    expect(chip.props.hitSlop).toEqual({ top: 7, bottom: 7 });
  });
});

describe("photo previews", () => {
  const picker = jest.requireMock("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };
  const documents = jest.requireMock("expo-document-picker") as { getDocumentAsync: jest.Mock };
  const manipulator = (jest.requireMock("expo-image-manipulator") as { ImageManipulator: { manipulate: jest.Mock } }).ImageManipulator;
  const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock; replace: jest.Mock } };
  const secureStore = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
  const reanimated = jest.requireMock("react-native-reanimated") as { useReducedMotion: jest.Mock };
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

  /** Impor with its row sheet and its photo viewer, as the root stack draws them. */
  const ImporWithViewer = () => (
    <>
      <ImportAssistant />
      <SheetHost
        render={({ path, params }) =>
          path === "/impor-baris" ? (
            <ImportRowEditor n={Number(params.n)} />
          ) : path === "/impor-foto" ? (
            <ImportPhotoViewer i={Number(params.i)} />
          ) : null
        }
      />
    </>
  );

  let shrunk = 0;
  beforeEach(() => {
    shrunk = 0;
    picker.launchImageLibraryAsync.mockReset();
    documents.getDocumentAsync.mockReset();
    router.push.mockClear();
    router.replace.mockClear();
    // Each shrunk photo uploads its own base64, so a test can tell which one was sent.
    manipulator.manipulate.mockImplementation(() => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => {
            shrunk += 1;
            return { base64: `QkFTRTY0LQ${shrunk}`, uri: `file:///cache/shrunk-${shrunk}.jpg` };
          },
        }),
      };
      return context;
    });
  });
  afterEach(() => secureStore.delete("impor.theme"));

  type Reply = { ok: boolean; status?: number; json: () => Promise<unknown> };
  function renderImpor(response: Reply | "pending" = { ok: true, json: async () => ({ data: { rows: [row(1)], needsReview: 0 } }) }) {
    const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
      sellerImportOptions: jest.fn(async () => ({
        customers: [],
        packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }],
      })),
      command: jest.fn(),
    } as unknown as MobileRuntime["api"];
    const fetchMock = jest.fn(response === "pending" ? () => new Promise<Reply>(() => {}) : async () => response);
    global.fetch = fetchMock as unknown as typeof fetch;
    render(
      withDapurScale(
        <ThemeProvider storageKey="impor.theme">
          <MobileProvider runtime={runtime} linkMapper={() => "/"}>
            <ImporWithViewer />
          </MobileProvider>
        </ThemeProvider>,
      ),
    );
    return fetchMock;
  }

  /** Picks `count` photos from the gallery through the "+ Foto" tile; they are numbered on from `from`. */
  async function pick(count: number, from = 1) {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: Array.from({ length: count }, (_, i) => ({
        uri: `file:///picked-${from + i}.jpg`,
        width: 3000,
        height: 4000,
        fileName: `IMG_${from + i}.jpg`,
      })),
    });
    fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    const total = from + count - 1;
    await screen.findByLabelText(`Foto ${total} dari ${total}`);
  }

  const thumbUri = (i: number) => screen.getByTestId(`attachment-photo-${i}`).props.source?.uri ?? null;

  it("starts with no attachments: the count and the add tile, no thumbnails", async () => {
    renderImpor();
    expect(await screen.findByText("Lampiran · 0 dari 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tambah foto" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ PDF / Excel" })).toBeTruthy();
    expect(screen.queryByLabelText(/^Foto \d dari/)).toBeNull();
    // The add tile took the place of the old "+ Foto" button: one way to add a photo.
    expect(screen.queryByRole("button", { name: "+ Foto" })).toBeNull();
  });

  it("picked photos show as thumbnails with remove targets", async () => {
    renderImpor();
    await pick(3);
    expect(screen.getByText("Lampiran · 3 dari 6")).toBeTruthy();
    for (const i of [1, 2, 3]) {
      const thumb = screen.getByLabelText(`Foto ${i} dari 3`);
      expect(thumb.props.accessibilityRole).toBe("imagebutton");
      expect(thumbUri(i)).toBe(`file:///picked-${i}.jpg`);
      // 76dp, radius 12, cover fit, on the neutral ground while it decodes.
      const image = screen.getByTestId(`attachment-photo-${i}`);
      expect(flat(image)).toMatchObject({ width: 76, height: 76, borderRadius: 12, backgroundColor: nativeThemes.light.canvas });
      expect(image.props.contentFit).toBe("cover");
      // The canvas's 10dp between thumbnails: each tile keeps that room above and to the right of its photo.
      const tile = flat(screen.getByTestId(`attachment-tile-${i}`)) as { paddingTop: number; paddingRight: number };
      expect(tile).toMatchObject({ paddingTop: 10, paddingRight: 10 });
      const side = 76 + 10;
      // A 28dp badge on a 48dp target anchored to the tile's top-right corner, so the whole target lies inside the
      // tile's own box (Android never sends a touch outside a parent's bounds to its child).
      const remove = screen.getByRole("button", { name: `Hapus foto ${i}` });
      const target = flat(remove) as { top: number; right: number; width: number; height: number };
      expect(target).toMatchObject({ position: "absolute", top: 0, right: 0, width: 48, height: 48 });
      expect(target.top + target.height).toBeLessThanOrEqual(side);
      expect(target.right + target.width).toBeLessThanOrEqual(side);
      expect(flat(within(remove).getByTestId("remove-badge"))).toMatchObject({ width: 28, height: 28, borderRadius: 14 });
      // The badge sits 2dp into the target's corner, so it still hangs 8dp off the photo's corner, as on the canvas.
      const place = flat(within(remove).getByTestId("remove-badge-place")) as { top: number; right: number };
      expect(place).toMatchObject({ position: "absolute", top: 2, right: 2 });
      expect(tile.paddingTop - place.top).toBe(8);
      expect(tile.paddingRight - place.right).toBe(8);
    }
    // The add tile keeps the same 10dp, so the next photo lands where it stood.
    expect(flat(screen.getByTestId("add-photo-tile"))).toMatchObject({ paddingTop: 10, paddingRight: 10 });
    fireEvent.press(screen.getByRole("button", { name: "Hapus foto 2" }));
    await waitFor(() => expect(screen.getByText("Lampiran · 2 dari 6")).toBeTruthy());
    expect(screen.queryByLabelText("Foto 3 dari 3")).toBeNull();
    expect(thumbUri(1)).toBe("file:///picked-1.jpg");
    expect(thumbUri(2)).toBe("file:///picked-3.jpg");
    expect(screen.getByRole("button", { name: "Tambah foto" })).toBeTruthy();
  });

  it("six photos hide the add tile", async () => {
    renderImpor();
    await pick(4);
    // The gallery is asked for no more than the room left.
    await pick(2, 5);
    expect(picker.launchImageLibraryAsync).toHaveBeenLastCalledWith(expect.objectContaining({ selectionLimit: 2 }));
    expect(screen.getByText("Lampiran · 6 dari 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tambah foto" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Hapus foto 6" }));
    expect(await screen.findByRole("button", { name: "Tambah foto" })).toBeTruthy();
  });

  it("spreadsheets keep icon and name", async () => {
    renderImpor();
    await pick(2);
    documents.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "pelanggan-oktober.xlsx", uri: "file:///cache/pelanggan-oktober.xlsx" }],
    });
    fireEvent.press(screen.getByRole("button", { name: "+ PDF / Excel" }));
    const name = await screen.findByText("pelanggan-oktober.xlsx");
    // The count is of photos, the cap the assistant sets; a file is a row of its own.
    expect(screen.getByText("Lampiran · 2 dari 6")).toBeTruthy();
    const docRow = screen.getByTestId("attachment-file-1");
    expect(within(docRow).getByTestId("attachment-file-icon")).toBeTruthy();
    expect(within(docRow).getByText("pelanggan-oktober.xlsx")).toBe(name);
    // The whole name shows, wrapped at large text rather than cut.
    expect(name.props.numberOfLines).toBeUndefined();
    expect(flat(docRow).minHeight).toBe(52);
    expect(flat(docRow).height).toBeUndefined();
    const remove = within(docRow).getByRole("button", { name: "Hapus pelanggan-oktober.xlsx" });
    expect(flat(remove)).toMatchObject({ width: 48, height: 48 });
    fireEvent.press(remove);
    await waitFor(() => expect(screen.queryByText("pelanggan-oktober.xlsx")).toBeNull());
    expect(screen.getByLabelText("Foto 2 dari 2")).toBeTruthy();
  });

  it("tapping a thumbnail opens the viewer", async () => {
    renderImpor();
    await pick(3);
    fireEvent.press(screen.getByLabelText("Foto 2 dari 3"));
    expect(router.push).toHaveBeenLastCalledWith("/impor-foto?i=2");
    const viewer = await screen.findByTestId("import-photo-viewer");
    const full = within(viewer).getByLabelText("Foto 2 dari 3");
    // The whole photo, fitted to the screen with no pinch, from the file the caterer picked.
    expect(full.props.source).toEqual({ uri: "file:///picked-2.jpg" });
    expect(full.props.contentFit).toBe("contain");
    // The viewer names the photo in its own bar, from inside the screen (a `Stack.Screen` with no name).
    expect(declared[String(undefined)]).toMatchObject({ title: "Foto 2 dari 3" });
  });

  it("a viewer link with no photo behind it opens Impor instead of an empty viewer", async () => {
    render(
      <MobileProvider runtime={createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" })} linkMapper={() => "/"}>
        <ImportPhotoViewer i={4} />
      </MobileProvider>,
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/impor"));
    expect(screen.queryByTestId("import-photo-viewer")).toBeNull();
  });

  it("reading shows the reading mascot with the counts", async () => {
    renderImpor("pending");
    await pick(2);
    documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: "daftar.pdf", uri: "file:///cache/daftar.pdf" }] });
    fireEvent.press(screen.getByRole("button", { name: "+ PDF / Excel" }));
    await screen.findByText("daftar.pdf");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    // The mascot is decorative (hidden from screen readers); the words carry the wait.
    expect(await screen.findByTestId("mascot-reading", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Membaca daftar pelanggan…")).toBeTruthy();
    expect(screen.getByText("2 foto dan 1 file")).toBeTruthy();
    // In place of the button; the attachments stay in view but cannot change while they are read.
    expect(screen.queryByRole("button", { name: "Susun daftar" })).toBeNull();
    expect(screen.getByLabelText("Foto 2 dari 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Hapus/ })).toBeNull();
    // Both add controls stay in their place, dimmed and taking no press, and say why, so nothing below them moves.
    const add = screen.getByRole("button", { name: "Tambah foto" });
    const addFile = screen.getByRole("button", { name: "+ PDF / Excel" });
    for (const control of [add, addFile]) {
      expect(control.props.accessibilityState).toMatchObject({ disabled: true });
      expect(control.props.accessibilityHint).toBe("Bisa lagi setelah selesai membaca.");
      expect(flat(control).opacity).toBe(0.45);
    }
    fireEvent.press(add);
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(addFile);
    expect(documents.getDocumentAsync).toHaveBeenCalledTimes(1);
  });

  it("reading is announced once when it starts, not on a re-render or when it ends", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    // The preset already mocks it, so earlier tests' words are cleared first.
    announce.mockClear();
    const reads = () => announce.mock.calls.filter(([said]) => /Membaca/.test(String(said)));
    try {
      const fetchMock = renderImpor();
      let answer: (reply: Reply) => void = () => {};
      fetchMock.mockImplementation(() => new Promise<Reply>((resolve) => (answer = resolve)));
      await pick(2);
      documents.getDocumentAsync.mockResolvedValueOnce({ canceled: false, assets: [{ name: "daftar.pdf", uri: "file:///cache/daftar.pdf" }] });
      fireEvent.press(screen.getByRole("button", { name: "+ PDF / Excel" }));
      await screen.findByText("daftar.pdf");
      expect(reads()).toEqual([]);
      fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
      await screen.findByText("Membaca daftar pelanggan…");
      // The button the caterer pressed is gone, so the words are spoken on every platform, with what is read.
      expect(reads()).toEqual([["Membaca daftar pelanggan…, 2 foto dan 1 file"]]);
      // No live region as well, so Android does not say it twice.
      expect(screen.UNSAFE_root.findAll((node) => node.props.accessibilityLiveRegion != null)).toEqual([]);
      fireEvent.changeText(screen.getByLabelText("Tempel atau ketik daftar pelanggan"), "daftar baru");
      expect(reads()).toHaveLength(1);
      await act(async () => answer({ ok: true, json: async () => ({ data: { rows: [row(1)], needsReview: 0 } }) }));
      expect(await screen.findByRole("button", { name: "Simpan 1 pelanggan" })).toBeTruthy();
      expect(reads()).toHaveLength(1);
    } finally {
      announce.mockRestore();
    }
  });

  it("while picked photos shrink, the add tile waits and takes no press", async () => {
    renderImpor();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const base = manipulator.manipulate.getMockImplementation()!;
    manipulator.manipulate.mockImplementation((...args: unknown[]) => {
      const context = base(...args);
      const render = context.renderAsync;
      context.renderAsync = async () => {
        await gate;
        return render();
      };
      return context;
    });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [1, 2].map((n) => ({ uri: `file:///picked-${n}.jpg`, width: 3000, height: 4000, fileName: `IMG_${n}.jpg` })),
    });
    fireEvent.press(await screen.findByRole("button", { name: "Tambah foto" }));
    // The sage ground breathing where the photos will land, and no way to pick again until they do.
    expect(await screen.findByTestId("add-photo-waiting")).toBeTruthy();
    const add = screen.getByRole("button", { name: "Tambah foto" });
    expect(add.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(add);
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(await screen.findByLabelText("Foto 2 dari 2")).toBeTruthy();
    expect(screen.queryByTestId("add-photo-waiting")).toBeNull();
    expect(screen.getByRole("button", { name: "Tambah foto" }).props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(screen.getByText("Lampiran · 2 dari 6")).toBeTruthy();
  });

  it("a quick second tap opens the gallery once", async () => {
    renderImpor();
    let open: (value: unknown) => void = () => {};
    picker.launchImageLibraryAsync.mockImplementation(() => new Promise((resolve) => (open = resolve)));
    const add = await screen.findByRole("button", { name: "Tambah foto" });
    fireEvent.press(add);
    fireEvent.press(add);
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    await act(async () => open({ canceled: false, assets: [{ uri: "file:///picked-1.jpg", width: 3000, height: 4000, fileName: "IMG_1.jpg" }] }));
    expect(await screen.findByLabelText("Foto 1 dari 1")).toBeTruthy();
  });

  it("never holds more than six photos, even when the gallery hands back more than it was asked for", async () => {
    renderImpor();
    await pick(4);
    // Some galleries ignore the selection limit; the photos past six are dropped.
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [5, 6, 7, 8].map((n) => ({ uri: `file:///picked-${n}.jpg`, width: 3000, height: 4000, fileName: `IMG_${n}.jpg` })),
    });
    fireEvent.press(screen.getByRole("button", { name: "Tambah foto" }));
    expect(await screen.findByLabelText("Foto 6 dari 6")).toBeTruthy();
    expect(screen.getByText("Lampiran · 6 dari 6")).toBeTruthy();
    expect(screen.queryByLabelText(/dari 7|dari 8/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Tambah foto" })).toBeNull();
  });

  it("a file row holds still when reading starts and ends: same inset, its remove slot kept", async () => {
    renderImpor({ ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_UNAVAILABLE" } }) });
    const fetchMock = global.fetch as unknown as jest.Mock;
    let answer: (reply: Reply) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Reply>((resolve) => (answer = resolve)));
    await pick(3);
    documents.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "daftar-pelanggan-lama-bulan-september-dan-oktober.csv", uri: "file:///cache/a.csv" }],
    });
    fireEvent.press(screen.getByRole("button", { name: "+ PDF / Excel" }));
    await screen.findByText("daftar-pelanggan-lama-bulan-september-dan-oktober.csv");
    const before = flat(screen.getByTestId("attachment-file-1"));
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    await screen.findByText("Membaca daftar pelanggan…");
    const docRow = screen.getByTestId("attachment-file-1");
    expect(flat(docRow).paddingRight).toBe(before.paddingRight);
    expect(flat(within(docRow).getByTestId("attachment-file-slot"))).toMatchObject({ width: 48, height: 48 });
    // The add tile keeps its place too, so the photo grid above the row keeps its height.
    expect(screen.getByTestId("add-photo-tile")).toBeTruthy();
    await act(async () => answer({ ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_UNAVAILABLE" } }) }));
    await screen.findByText("Asisten impor sedang tidak tersedia. Coba lagi nanti.");
    const after = screen.getByTestId("attachment-file-1");
    expect(flat(after).paddingRight).toBe(before.paddingRight);
    expect(within(after).getByRole("button", { name: "Hapus daftar-pelanggan-lama-bulan-september-dan-oktober.csv" })).toBeTruthy();
  });

  it("reading names only what is there: one photo and no files", async () => {
    renderImpor("pending");
    await pick(1);
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    expect(await screen.findByText("1 foto")).toBeTruthy();
    expect(screen.queryByText(/\bfile\b/)).toBeNull();
  });

  it("reading pasted text alone shows the mascot with no count", async () => {
    renderImpor("pending");
    fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    expect(await screen.findByText("Membaca daftar pelanggan…")).toBeTruthy();
    expect(screen.queryByText(/\d+ (foto|file)/)).toBeNull();
  });

  it("the picked uri is kept and the base64 still uploads", async () => {
    const fetchMock = renderImpor();
    await pick(2);
    expect(thumbUri(1)).toBe("file:///picked-1.jpg");
    expect(thumbUri(2)).toBe("file:///picked-2.jpg");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.images).toEqual([
      { mediaType: "image/jpeg", data: "QkFTRTY0LQ1" },
      { mediaType: "image/jpeg", data: "QkFTRTY0LQ2" },
    ]);
    // No uri leaves the phone.
    expect(JSON.stringify(body)).not.toMatch(/file:\/\//);
  });

  it("a photo that fails to decode keeps the neutral ground and stays removable", async () => {
    renderImpor();
    await pick(2);
    act(() => screen.getByTestId("attachment-photo-1").props.onError?.({ error: "decode" }));
    const ground = await screen.findByTestId("attachment-photo-1");
    expect(ground.props.source).toBeUndefined();
    expect(flat(ground)).toMatchObject({ width: 76, height: 76, borderRadius: 12, backgroundColor: nativeThemes.light.canvas });
    expect(screen.getByLabelText("Foto 1 dari 2")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Hapus foto 1" }));
    await waitFor(() => expect(screen.getByText("Lampiran · 1 dari 6")).toBeTruthy());
    expect(thumbUri(1)).toBe("file:///picked-2.jpg");
  });

  it("a failed read keeps the attachments and shows the error", async () => {
    renderImpor({ ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_UNAVAILABLE" } }) });
    await pick(2);
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    expect(await screen.findByText("Asisten impor sedang tidak tersedia. Coba lagi nanti.")).toBeTruthy();
    expect(screen.getByLabelText("Foto 2 dari 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hapus foto 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Susun daftar" })).toBeTruthy();
    expect(screen.queryByTestId("mascot-reading", { includeHiddenElements: true })).toBeNull();
  });

  it("an assistant that is switched off keeps the attachments next to Isi manual", async () => {
    renderImpor(disabled);
    await pick(1);
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    expect(await screen.findByRole("button", { name: "Isi manual" })).toBeTruthy();
    expect(screen.getByLabelText("Foto 1 dari 1")).toBeTruthy();
    expect(screen.getByText("Lampiran · 1 dari 6")).toBeTruthy();
  });

  it("in the dark theme the thumbnails, badge and add tile read the dark palette", async () => {
    secureStore.set("impor.theme", "dark");
    renderImpor();
    await pick(1);
    const dark = nativeThemes.dark;
    await waitFor(() => expect(flat(screen.getByTestId("attachment-photo-1")).backgroundColor).toBe(dark.canvas));
    const badge = within(screen.getByRole("button", { name: "Hapus foto 1" })).getByTestId("remove-badge");
    expect(flat(badge)).toMatchObject({ backgroundColor: dark.charcoal, borderColor: dark.canvas });
    expect(flat(screen.getByRole("button", { name: "Tambah foto" })).borderColor).toBe(dark.muted);
    expect(flat(screen.getByText("Lampiran · 1 dari 6")).color).toBe(dark.muted);
  });

  it("keeps every label whole at large text: nothing is cut to one line", async () => {
    renderImpor("pending");
    await pick(1);
    documents.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "daftar-pelanggan-lama-bulan-september.csv", uri: "file:///cache/a.csv" }],
    });
    fireEvent.press(screen.getByRole("button", { name: "+ PDF / Excel" }));
    await screen.findByText("daftar-pelanggan-lama-bulan-september.csv");
    for (const text of ["Lampiran · 1 dari 6", "daftar-pelanggan-lama-bulan-september.csv", "Foto"])
      expect({ text, lines: screen.getByText(text).props.numberOfLines }).toEqual({ text, lines: undefined });
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    for (const text of ["Membaca daftar pelanggan…", "1 foto dan 1 file"])
      expect({ text, lines: (await screen.findByText(text)).props.numberOfLines }).toEqual({ text, lines: undefined });
  });

  it("a thumbnail enters when it is added and leaves when it is removed, and not under reduced motion", async () => {
    renderImpor();
    await pick(1);
    const tile = screen.getByTestId("attachment-tile-1");
    expect(tile.props.entering).toBeDefined();
    expect(tile.props.exiting).toBeDefined();
    screen.unmount();
    reanimated.useReducedMotion.mockReturnValue(true);
    try {
      renderImpor();
      await pick(1);
      const still = screen.getByTestId("attachment-tile-1");
      expect(still.props.entering).toBeUndefined();
      expect(still.props.exiting).toBeUndefined();
    } finally {
      reanimated.useReducedMotion.mockReturnValue(false);
    }
  });
});
