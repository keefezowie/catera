import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { type SellerOffer } from "@catera/domain";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { PackageDetail } from "../src/business/PackageDetail";
import { PackageEditor } from "../src/business/PackageEditor";
import { packageState } from "../src/business/kitchen";
import { resetSheets } from "./sheet-host";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("../src/business/package", () => ({
  ...jest.requireActual("../src/business/package"),
  packageIssues: () => ({}),
  nutritionIssues: () => ({}),
}));

const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock; back: jest.Mock } };

const offer = {
  id: "p-1",
  name: "twilly bad dog",
  description: "Nasi, lauk dan sayur.",
  status: "published",
  price: 35000,
  image: "",
  weekdays: [1, 2, 3, 4, 5],
  capacity: { "1": 20 },
  menus: [{ meal: "lunch", name: "x", description: "", image: "", contentModel: "slots", composition: [] }],
} as unknown as SellerOffer;

function runtimeFor(status: string, { offers = [offer], note, payments = false }: { offers?: SellerOffer[]; note?: string; payments?: boolean } = {}) {
  const command = jest.fn(async () => ({}));
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "PuffyFooods", status, review_note: note }, offers, datedMenus: [] })),
    request: jest.fn(async () => ({ active: payments ? { id: "pd-1" } : null })),
    command,
  } as unknown as MobileRuntime["api"];
  return { runtime, command };
}

const mount = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      {ui}
    </MobileProvider>,
  );

beforeEach(() => {
  resetSheets();
  router.push.mockClear();
  router.back.mockClear();
});

describe("packageState", () => {
  const t = (id: string) => id;
  it("says tayang only when the package is published and the kitchen approved", () => {
    expect(packageState("published", "approved", t)).toBe("tayang");
    for (const kitchen of ["draft", "submitted", "corrections", "suspended", undefined])
      expect(packageState("published", kitchen, t)).toBe("belum tampil");
    expect(packageState("draft", "approved", t)).toBe("draf");
  });
});

describe("Usaha per kitchen status", () => {
  it("draft with a package: the package is not shown yet, and Minta diperiksa sends the kitchen for review", async () => {
    const { runtime, command } = runtimeFor("draft");
    await mount(runtime, <UsahaScreen />);
    const card = await screen.findByTestId("kitchen-status");
    expect(within(card).getByRole("header", { name: "Pelanggan belum bisa melihat dapurmu" })).toBeTruthy();
    expect(screen.getByText(/· belum tampil$/)).toBeTruthy();
    expect(screen.queryByText(/· tayang$/)).toBeNull();
    // One cream card: the payments ask waits until the kitchen is live.
    expect(screen.queryByTestId("usaha-payments")).toBeNull();
    await fireEvent.press(within(card).getByRole("button", { name: "Minta diperiksa" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.submit", { catererId: "k-1" }, expect.any(String)));
  });

  it("draft with no package: the step is to create the first package", async () => {
    const { runtime } = runtimeFor("draft", { offers: [] });
    await mount(runtime, <UsahaScreen />);
    const card = await screen.findByTestId("kitchen-status");
    expect(within(card).queryByRole("button", { name: "Minta diperiksa" })).toBeNull();
    await fireEvent.press(within(card).getByRole("button", { name: "Buat paket pertama" }));
    expect(router.push).toHaveBeenCalledWith("/paket/baru");
  });

  it("submitted: in review, with nothing to press", async () => {
    const { runtime } = runtimeFor("submitted");
    await mount(runtime, <UsahaScreen />);
    const card = await screen.findByTestId("kitchen-status");
    expect(within(card).getByRole("header", { name: "Sedang ditinjau tim Catera" })).toBeTruthy();
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/· belum tampil$/)).toBeTruthy();
  });

  it("corrections: shows the reviewer's note and sends the kitchen again", async () => {
    const { runtime, command } = runtimeFor("corrections", { note: "Foto paket belum jelas." });
    await mount(runtime, <UsahaScreen />);
    const card = await screen.findByTestId("kitchen-status");
    expect(within(card).getByRole("header", { name: "Ada yang perlu diperbaiki" })).toBeTruthy();
    expect(within(card).getByText("Foto paket belum jelas.")).toBeTruthy();
    await fireEvent.press(within(card).getByRole("button", { name: "Kirim lagi untuk diperiksa" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.submit", { catererId: "k-1" }, expect.any(String)));
  });

  it("suspended: explains, shows the note, and offers no review button", async () => {
    const { runtime } = runtimeFor("suspended", { note: "Laporan keamanan pangan." });
    await mount(runtime, <UsahaScreen />);
    const card = await screen.findByTestId("kitchen-status");
    expect(within(card).getByRole("header", { name: "Dapurmu sedang dinonaktifkan" })).toBeTruthy();
    expect(within(card).getByText("Laporan keamanan pangan.")).toBeTruthy();
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
  });

  it("approved: no kitchen card, the package is tayang, and the payments card is back", async () => {
    const { runtime } = runtimeFor("approved");
    await mount(runtime, <UsahaScreen />);
    expect(await screen.findByText(/· tayang$/)).toBeTruthy();
    expect(screen.queryByTestId("kitchen-status")).toBeNull();
    expect(await screen.findByTestId("usaha-payments")).toBeTruthy();
  });
});

describe("Paket detail", () => {
  it("names a published package in an unapproved kitchen as not shown yet", async () => {
    const { runtime } = runtimeFor("draft");
    await mount(runtime, <PackageDetail offer={offer} kitchenStatus="draft" />);
    expect(within(screen.getByTestId("paket-fact-status")).getByText("Belum tampil")).toBeTruthy();
    expect(screen.getByText(/setelah tim Catera menyetujui dapurmu/)).toBeTruthy();
  });

  it("has no status row once the kitchen is approved", async () => {
    const { runtime } = runtimeFor("approved");
    await mount(runtime, <PackageDetail offer={offer} kitchenStatus="approved" />);
    expect(screen.queryByTestId("paket-fact-status")).toBeNull();
  });
});

describe("Aktifkan step 1", () => {
  it("corrections: the note and a resubmit", async () => {
    const { runtime, command } = runtimeFor("corrections", { note: "Lengkapi alamat dapur." });
    await mount(runtime, <AktifkanScreen />);
    expect(await screen.findByText("Perlu diperbaiki")).toBeTruthy();
    expect(screen.getByText("Lengkapi alamat dapur.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Kirim lagi untuk diperiksa" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.submit", { catererId: "k-1" }, expect.any(String)));
  });

  it("suspended: says so, with no review button", async () => {
    const { runtime } = runtimeFor("suspended");
    await mount(runtime, <AktifkanScreen />);
    expect(await screen.findByText("Dinonaktifkan")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Minta diperiksa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kirim lagi untuk diperiksa" })).toBeNull();
  });
});

describe("First package in a kitchen not yet reviewed", () => {
  it("ends on the review step; Minta diperiksa sends it and goes back", async () => {
    const { runtime, command } = runtimeFor("draft");
    await mount(runtime, <PackageEditor firstPublish kitchenStatus="draft" />);
    await fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
    expect(await screen.findByText(/Satu langkah lagi/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nanti saja" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Minta diperiksa" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("seller.submit", { catererId: "k-1" }, expect.any(String)));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it("an approved kitchen keeps the plain Selesai", async () => {
    const { runtime } = runtimeFor("approved");
    await mount(runtime, <PackageEditor firstPublish kitchenStatus="approved" />);
    await fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
    expect(await screen.findByRole("button", { name: "Selesai" })).toBeTruthy();
    expect(screen.queryByText(/Satu langkah lagi/)).toBeNull();
  });
});
