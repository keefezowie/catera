import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SettlementState } from "@catera/domain";
import { quickOffer, packageIssues, type PackageForm } from "../src/business/package";
import { PackageEditor } from "../src/business/PackageEditor";
import { PackageDetail } from "../src/business/PackageDetail";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { UangScreen } from "../src/business/UangScreen";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { TimScreen } from "../src/business/TimScreen";
import { RoleGate } from "../src/RoleGate";
import { Image, Text } from "react-native";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(), MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const form: PackageForm = {
  name: "Makan Siang Rumahan",
  description: "Masakan rumahan harian, nasi dengan dua lauk dan sayur.",
  price: "28000",
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  capacity: "40",
  image: "https://cdn.example.test/k-1/a.jpg",
  counts: { rice: 1, main: 2, vegetable: 1 },
};

function runtimeWith(overrides: Partial<MobileRuntime["api"]>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    ...overrides,
  } as MobileRuntime["api"];
  return runtime;
}

describe("quickOffer", () => {
  it("uses one duration, no tiers, no trial and a flexible schedule", () => {
    const offer = quickOffer(form);
    expect(offer.trialPrice).toBeNull();
    expect(offer.trialMax).toBeNull();
    expect(offer.tiers).toEqual([]);
    expect(offer.durationPricing.options).toEqual([{ cycles: 1, discountPercent: 0 }]);
    expect(offer.flexible).toBe(true);
    expect(offer.capacity).toEqual({ "1": 40, "2": 40, "3": 40, "4": 40, "5": 40 });
    expect(offer.menus[0].composition.map((g) => [g.categoryId, g.slots])).toEqual([
      ["rice", 1],
      ["main", 2],
      ["vegetable", 1],
    ]);
  });
});

it("asks for daily capacity before saving", async () => {
  const command = jest.fn();
  const runtime = runtimeWith({ command });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <PackageEditor />
    </MobileProvider>,
  );
  expect(packageIssues({ ...form, capacity: "" }).capacity).toBe("Isi kapasitas per hari");
  fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
  expect(await screen.findByText("Isi kapasitas per hari")).toBeTruthy();
  expect(command).not.toHaveBeenCalled();
});

const settlement: SettlementState = {
  payoutReadiness: "ready",
  expected: "840000",
  earned: "560000",
  held: "28000",
  reserved: "0",
  paid: "1120000",
  available: "532000",
  recovery: "0",
  nextPayoutAt: "2026-10-09T09:00:00+07:00",
  entries: [],
  payouts: [],
  policy: null,
};

it("explains all seven money states", async () => {
  const runtime = runtimeWith({ settlement: jest.fn(async () => settlement) });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <UangScreen />
    </MobileProvider>,
  );
  await waitFor(() => expect(screen.getByText("Akan diterima")).toBeTruthy());
  for (const label of [
    "Akan diterima",
    "Sudah diperoleh",
    "Ditahan sementara",
    "Siap dicairkan",
    "Sedang dikirim",
    "Sudah dicairkan",
    "Potongan",
  ])
    expect(screen.getByText(label)).toBeTruthy();
});

it("shares a helper invite code over WhatsApp", async () => {
  const { Share } = jest.requireActual("react-native") as typeof import("react-native");
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  const command = jest.fn(async () => ({ id: "i-1", code: "abc123" }));
  render(
    <MobileProvider runtime={runtimeWith({ command })} linkMapper={() => "/"}>
      <TimScreen />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByRole("button", { name: "Undang pembantu" }));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(command.mock.calls[0]).toEqual(["staff.invite", { catererId: "k-1" }, expect.any(String)]);
  expect((share.mock.calls[0][0] as { message: string }).message).toContain("abc123");
});

it("lets a helper join a kitchen with the invite code", async () => {
  const me = jest
    .fn()
    .mockResolvedValueOnce({ actor: { id: "u-2", role: "customer", catererId: null }, demo: false })
    .mockResolvedValue({ actor: { id: "u-2", role: "staff", catererId: "k-1" }, demo: false });
  const command = jest.fn(async () => ({}));
  render(
    <MobileProvider runtime={runtimeWith({ me, command })} linkMapper={() => "/"}>
      <RoleGate>
        <Text>dapur</Text>
      </RoleGate>
    </MobileProvider>,
  );
  fireEvent.changeText(await screen.findByLabelText("Kode undangan"), " abc123 ");
  fireEvent.press(screen.getByRole("button", { name: "Gabung ke dapur" }));
  expect(await screen.findByText("dapur")).toBeTruthy();
  expect(command.mock.calls[0]).toEqual(["invite.accept", { code: "abc123" }, expect.any(String)]);
});

const liveOffer = {
  id: "p-live",
  slug: "rumahan",
  version: 3,
  catererId: "k-1",
  name: "Makan Siang Rumahan",
  description: "Masakan rumahan harian dengan nasi, dua lauk dan sayur.",
  price: 28000,
  days: 20,
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  flexible: false,
  trialPrice: 25000,
  trialMax: 2,
  capacity: { "1": 40, "2": 40, "3": 40, "4": 40, "5": 40 },
  tiers: [{ min: 10, percent: 5 }],
  windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
  tags: [],
  image: "https://cdn.example.test/k-1/a.jpg",
  status: "published",
  menus: [{ meal: "lunch", name: "x", description: "", image: "", contentModel: "slots", composition: [{ id: "g-main", categoryId: "main", name: "Lauk", slots: 2 }] }],
} as unknown as import("@catera/domain").SellerOffer;

it("shows a live package read-only and copies it into a new package", async () => {
  const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
  render(
    <MobileProvider runtime={runtimeWith({})} linkMapper={() => "/"}>
      <PackageDetail offer={liveOffer} />
    </MobileProvider>,
  );
  expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Simpan paket" })).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Salin jadi paket baru" }));
  expect(router.push).toHaveBeenCalledWith("/paket/baru?from=p-live");
});

const photoOffer = { ...liveOffer, image: "/uploads/k-1/a.jpg" } as typeof liveOffer;

it("shows the package photo", async () => {
  const runtime = runtimeWith({
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [photoOffer], datedMenus: [] })),
    request: jest.fn(async () => ({ active: null })),
  });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <UsahaScreen />
    </MobileProvider>,
  );
  expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
  const photo = screen.UNSAFE_getByType(Image);
  expect(photo.props.source).toEqual({ uri: "https://catera.example.test/uploads/k-1/a.jpg" });
});

it("shows a live package's site-relative photo from the API host", () => {
  render(
    <MobileProvider runtime={runtimeWith({})} linkMapper={() => "/"}>
      <PackageDetail offer={photoOffer} />
    </MobileProvider>,
  );
  expect(screen.UNSAFE_getByType(Image).props.source).toEqual({ uri: "https://catera.example.test/uploads/k-1/a.jpg" });
});

it("saves a copied package as a new one, never over the original", async () => {
  const command = jest.fn(async () => ({ id: "p-new" }));
  render(
    <MobileProvider runtime={runtimeWith({ command })} linkMapper={() => "/"}>
      <PackageEditor from={liveOffer} />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
  await waitFor(() => expect(command).toHaveBeenCalled());
  const [action, payload] = command.mock.calls[0] as unknown as [string, Record<string, unknown>];
  expect(action).toBe("package.save");
  expect(payload.id).toBeUndefined();
  expect(payload.version).toBeUndefined();
  expect(payload.slug).not.toBe("rumahan");
});

describe("Uang error guard", () => {
  it("shows a retry state instead of a blank app when the money screen cannot render", async () => {
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const runtime = runtimeWith({ settlement: jest.fn(async () => ({ ...settlement, nextPayoutAt: "bukan-tanggal" })) });
    render(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <UangScreen />
      </MobileProvider>,
    );
    expect(await screen.findByText("Catatan uang belum bisa ditampilkan.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Catatan uang belum bisa ditampilkan.")).toBeTruthy();
    errorLog.mockRestore();
  });
});

describe("Usaha states", () => {
  const renderUsaha = (runtime: MobileRuntime) =>
    render(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        <UsahaScreen />
      </MobileProvider>,
    );

  it("Usaha shows loading and error", async () => {
    const pending = runtimeWith({
      sellerOperations: jest.fn(() => new Promise(() => undefined)),
      request: jest.fn(async () => ({ active: null })),
    });
    const first = renderUsaha(pending);
    expect(await screen.findByText("Memuat…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "+ Paket baru" })).toBeNull();
    first.unmount();

    let down = true;
    const failing = jest.fn(async () => {
      if (down) throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      return { caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [photoOffer], datedMenus: [] };
    });
    renderUsaha(runtimeWith({ sellerOperations: failing, request: jest.fn(async () => ({ active: null })) }));
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    down = false;
    fireEvent.press(retry);
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Paket baru" })).toBeTruthy();
  });

  it("payments card names the action", async () => {
    renderUsaha(
      runtimeWith({
        sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [], datedMenus: [] })),
        request: jest.fn(async () => ({ active: null })),
      }),
    );
    expect(await screen.findByRole("button", { name: "Aktifkan pembayaran" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mulai" })).toBeNull();
  });
});

describe("Uang and Aktifkan errors", () => {
  const timeout = () => Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });

  it("Uang error offers Coba lagi", async () => {
    let down = true;
    const settle = jest.fn(async () => {
      if (down) throw timeout();
      return settlement;
    });
    render(
      <MobileProvider runtime={runtimeWith({ settlement: settle })} linkMapper={() => "/"}>
        <UangScreen />
      </MobileProvider>,
    );
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    down = false;
    fireEvent.press(retry);
    expect(await screen.findByText("Masuk ke rekening berikutnya")).toBeTruthy();
  });

  it("Aktifkan error offers Coba lagi", async () => {
    let down = true;
    const ops = jest.fn(async () => {
      if (down) throw timeout();
      return { caterer: { id: "k-1", name: "Dapur", status: "draft" }, offers: [], datedMenus: [] };
    });
    render(
      <MobileProvider runtime={runtimeWith({ sellerOperations: ops, request: jest.fn(async () => ({ active: null })) })} linkMapper={() => "/"}>
        <AktifkanScreen />
      </MobileProvider>,
    );
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    down = false;
    fireEvent.press(retry);
    expect(await screen.findByText(/Setelah aktif/)).toBeTruthy();
  });
});
