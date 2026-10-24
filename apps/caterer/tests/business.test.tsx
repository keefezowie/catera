import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { settlementCurrency, type SettlementState } from "@catera/domain";
import { quickOffer, packageIssues, type PackageForm } from "../src/business/package";
import { PackageEditor } from "../src/business/PackageEditor";
import { PackageDetail, weekdayLabel } from "../src/business/PackageDetail";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { UangScreen } from "../src/business/UangScreen";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { TimScreen } from "../src/business/TimScreen";
import { RoleGate } from "../src/RoleGate";
import { Pengaturan } from "../src/settings/Pengaturan";
import { BahasaSheet, TampilanSheet } from "../src/settings/ChoiceSheets";
import { StyleSheet, Text } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { HeroPhotoFrame, sheetSidePadding } from "@catera/mobile-ui";
import { DetailSkeleton } from "../src/skeletons";
import { HapusAkun } from "../src/settings/HapusAkun";
import { withDapurScale } from "./dapur-scale";
import * as uploadModule from "../src/business/upload";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
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
  nutrition: { range: false, caloriesKcal: ["", ""], proteinG: "", carbsG: "", fatG: "" },
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

it("the package photo picker gives a tap haptic and stays a button", async () => {
  const Haptics = require("expo-haptics") as { impactAsync: jest.Mock };
  Haptics.impactAsync.mockClear();
  const picker = require("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };
  picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: [] });
  render(
    withDapurScale(
      <MobileProvider runtime={runtimeWith({})} linkMapper={() => "/"}>
        <PackageEditor />
      </MobileProvider>,
    ),
  );
  const photo = await screen.findByRole("button", { name: "Pilih foto paket" });
  // The photo is drawn by ratio (16:10 in a HeroPhotoFrame), never at a fixed 168.
  expect(StyleSheet.flatten(screen.getByTestId("paket-photo").props.style).aspectRatio).toBe(16 / 10);
  expect(StyleSheet.flatten(photo.props.style).height).toBeUndefined();
  fireEvent.press(photo);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(picker.launchImageLibraryAsync).toHaveBeenCalled();
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
  fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
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

// Direction K rules 1, 2 and 6: forest fills only the primary button, so the payout card is a plain card and its
// amount is a price (bold charcoal), not a forest block with cream text.
it("Uang paints no forest block and shows the payout amount in bold charcoal", async () => {
  const runtime = runtimeWith({ settlement: jest.fn(async () => settlement) });
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      <UangScreen />
    </MobileProvider>,
  );
  const amount = await screen.findByTestId("uang-available");
  expect(StyleSheet.flatten(amount.props.style)).toMatchObject({ color: nativeThemes.light.charcoal, fontFamily: "Jakarta-ExtraBold" });
  const forestFills = screen.UNSAFE_root.findAll(
    (n) => typeof n.type === "string" && StyleSheet.flatten(n.props.style)?.backgroundColor === nativeThemes.light.forest,
  );
  expect(forestFills).toHaveLength(0);
  // A money state's amount (Akan diterima, 840.000) is a price too.
  expect(StyleSheet.flatten(screen.getByText(/840\.000/).props.style).color).toBe(nativeThemes.light.charcoal);
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
  fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
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
  expect(screen.queryByRole("button", { name: "Terbitkan paket" })).toBeNull();
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
  const photo = screen.UNSAFE_getByType(ExpoImage);
  expect(photo.props.source).toEqual({ uri: "https://catera.example.test/uploads/k-1/a.jpg" });
});

it("shows a live package's site-relative photo from the API host", () => {
  render(
    <MobileProvider runtime={runtimeWith({})} linkMapper={() => "/"}>
      <PackageDetail offer={photoOffer} />
    </MobileProvider>,
  );
  expect(screen.UNSAFE_getByType(ExpoImage).props.source).toEqual({ uri: "https://catera.example.test/uploads/k-1/a.jpg" });
});

it("saves a copied package as a new one, never over the original", async () => {
  const command = jest.fn(async () => ({ id: "p-new" }));
  render(
    <MobileProvider runtime={runtimeWith({ command })} linkMapper={() => "/"}>
      <PackageEditor from={liveOffer} />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
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
    const crashed = await screen.findByText("Rincian uang belum bisa ditampilkan.");
    expect(StyleSheet.flatten(crashed.props.style).color).toBe(require("@catera/design-tokens").nativeThemes.light.danger);
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Rincian uang belum bisa ditampilkan.")).toBeTruthy();
    errorLog.mockRestore();
  });
});

describe("Usaha mood header", () => {
  const MALAM = () => new Date("2026-10-08T08:00:00Z");
  const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
  const renderMood = (runtime: MobileRuntime) =>
    render(
      withDapurScale(
        <MoodProvider now={MALAM}>
          <MobileProvider runtime={runtime} linkMapper={() => "/"}>
            <UsahaScreen />
          </MobileProvider>
        </MoodProvider>,
      ),
    );
  const kitchen = (name: string) =>
    runtimeWith({
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name, status: "approved" }, offers: [liveOffer], datedMenus: [] })),
      request: jest.fn(async () => ({ active: null })),
    });

  it("titles the screen with the kitchen name in a plain header: no mood band, heroTitle beside the gear", async () => {
    renderMood(kitchen("Dapur Bu Rina"));
    const header = await screen.findByTestId("usaha-header");
    // No fill and no rounded band: the header sits on the canvas.
    expect(within(header).queryByTestId("mood-fill", { includeHiddenElements: true })).toBeNull();
    expect(within(header).queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    const title = await within(header).findByText("Dapur Bu Rina");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title)).toMatchObject({ fontSize: 24, lineHeight: 30, color: nativeThemes.light.charcoal });
    // The name is the only text: the "Usaha" line above it is gone, and the 44 row holds the name and the gear.
    expect(within(header).queryByText("Usaha")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    const row = within(header).getByTestId("mood-header-row");
    expect(flat(row).minHeight).toBe(44);
    expect(within(row).getByText("Dapur Bu Rina")).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Pengaturan" })).toBeTruthy();
    // The Paket heading is on the page, not in the header.
    await screen.findByText("Paket");
    expect(within(header).queryByText("Paket")).toBeNull();
  });

  it("falls back to Usaha as the title while the kitchen name is unknown", async () => {
    const runtime = runtimeWith({
      sellerOperations: jest.fn(() => new Promise(() => undefined)),
      request: jest.fn(async () => ({ active: null })),
    });
    renderMood(runtime);
    const header = await screen.findByTestId("usaha-header");
    expect(within(header).getByText("Usaha").props.accessibilityRole).toBe("header");
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
    expect(within(header).queryByLabelText("Memuat paket")).toBeNull();
  });

  it("keeps the Pengaturan gear in the header and the package rows working under it", async () => {
    renderMood(kitchen("Dapur Bu Rina"));
    const header = await screen.findByTestId("usaha-header");
    const gear = within(header).getByRole("button", { name: "Pengaturan" });
    // It reads the canvas ink (charcoal), since the header has no mood band behind it.
    expect(within(gear).UNSAFE_getByType(Ionicons).props.color).toBe(nativeThemes.light.charcoal);
    expect(await screen.findByRole("button", { name: "Makan Siang Rumahan" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
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
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
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

  it("Usaha rows dim on press and still navigate", async () => {
    renderUsaha(
      runtimeWith({
        sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [photoOffer], datedMenus: [] })),
        request: jest.fn(async () => ({ active: { id: "pd-1" } })),
      }),
    );
    await screen.findByRole("button", { name: "Makan Siang Rumahan" });
    const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
    for (const name of ["Uang", "Makan Siang Rumahan"]) {
      const row = () => screen.getByRole("button", { name });
      expect(StyleSheet.flatten(row().props.style)?.opacity ?? 1).toBe(1);
      fireEvent(row(), "responderGrant", touch);
      expect(StyleSheet.flatten(row().props.style).opacity).toBe(0.7);
    }
    fireEvent.press(screen.getByRole("button", { name: "Uang" }));
    expect(require("expo-router").router.push).toHaveBeenCalledWith("/uang");
  });

  // Tampilan and Bahasa moved from Usaha to Pengaturan's choice sheets (Phase F); Usaha keeps only the way there.
  describe("Tampilan in Pengaturan", () => {
    const canvas = () => StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor;
    // The setup keeps one in-memory store for the whole file. Pressing Gelap and English writes the theme and locale
    // to it, and later tests in the file would otherwise start in English or dark.
    const clearStore = () => (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
    beforeEach(() => {
      clearStore();
      (SecureStore.setItemAsync as jest.Mock).mockClear();
    });
    afterEach(clearStore);
    const renderThemed = async (runtime: MobileRuntime) => {
      render(
        <ThemeProvider storageKey={runtime.storageKey("theme")}>
          <MobileProvider runtime={runtime} linkMapper={() => "/"}>
            <Pengaturan />
            <TampilanSheet />
            <BahasaSheet />
          </MobileProvider>
        </ThemeProvider>,
      );
      expect(await screen.findByRole("button", { name: "Tampilan, Ikuti sistem" })).toBeTruthy();
      await act(async () => {});
    };

    it("follows the system by default", async () => {
      await renderThemed(runtimeWith({}));
      expect(screen.getByRole("radio", { name: "Ikuti sistem" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Terang" })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: "Gelap" })).not.toBeChecked();
      expect(canvas()).toBe("#FFFFFF");
    });

    it("pressing Gelap stores dark and repaints Pengaturan under the sheet", async () => {
      await renderThemed(runtimeWith({}));
      fireEvent.press(screen.getByRole("radio", { name: "Gelap" }));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("t.theme", "dark");
      expect(canvas()).toBe("#151514");
      expect(screen.getByRole("radio", { name: "Gelap" })).toBeChecked();
      expect(screen.getByRole("button", { name: "Tampilan, Gelap" })).toBeTruthy();
    });

    it("reads Appearance, Follow system, Light and Dark in English", async () => {
      await renderThemed(runtimeWith({}));
      fireEvent.press(screen.getByRole("radio", { name: "English" }));
      expect(await screen.findByRole("button", { name: "Appearance, Follow system" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Follow system" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
      expect(screen.queryByText("Tampilan")).toBeNull();
    });
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
    expect(screen.getByRole("header", { name: "Terima pembayaran lewat Catera" })).toBeTruthy();
    expect(screen.getByText("Supaya pelanggan bisa memperpanjang lewat Catera.")).toBeTruthy();
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
    expect(await screen.findByText("Akan masuk ke rekening")).toBeTruthy();
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

// ---------------------------------------------------------------------------------------------------------------
// Dapur layout scale (task D6): Usaha is one list, Uang leads with the money, Tim and Paket read the shared rhythm.
// ---------------------------------------------------------------------------------------------------------------
type StyleBag = Record<string, unknown>;
const bag = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as StyleBag;
const scaled = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={() => "/"}>
        {ui}
      </MobileProvider>,
    ),
  );
const ReactNativeModule = require("react-native") as typeof import("react-native");
const packageNamed = (n: number, over: Record<string, unknown> = {}) =>
  ({ ...liveOffer, id: `p-${n}`, name: `Paket ${n}`, image: n % 2 ? "/uploads/k-1/a.jpg" : "", ...over }) as unknown as import("@catera/domain").SellerOffer;
const usahaWith = (offers: import("@catera/domain").SellerOffer[], payments: boolean) =>
  runtimeWith({
    sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers, datedMenus: [] })),
    request: jest.fn(async () => ({ active: payments ? { id: "pd-1" } : null })),
  });

describe("Usaha on the Dapur scale", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([0, 1, 4])("Paket is a section header with + Paket baru trailing, over %i media rows", async (count) => {
    const offers = Array.from({ length: count }, (_, i) => packageNamed(i + 1));
    scaled(usahaWith(offers, true), <UsahaScreen />);
    const heading = await screen.findByRole("header", { name: "Paket" });
    expect(bag(heading)).toMatchObject({ fontSize: 20, lineHeight: 26 });
    const section = screen.getAllByTestId("section-header")[0];
    const add = await within(section).findByRole("button", { name: "+ Paket baru" });
    expect(within(section).getByTestId("section-header-trailing")).toBeTruthy();
    fireEvent.press(add);
    expect(require("expo-router").router.push).toHaveBeenCalledWith("/paket/baru");
    for (let i = 1; i <= count; i++) {
      const row = screen.getByTestId(`usaha-package-p-${i}`);
      expect(bag(row).minHeight).toBe(72);
      // The 56 photo (r8) stands in the row's thumb, and the row speaks its name only.
      expect(bag(screen.getByTestId(`usaha-package-p-${i}-thumb`))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
      expect(row.props.accessibilityLabel).toBe(`Paket ${i}`);
      // The trailing "…" is its own 48 button beside the row, not inside it.
      const more = screen.getByRole("button", { name: `Lihat atau salin: Paket ${i}` });
      expect(bag(more)).toMatchObject({ width: 48, height: 48 });
      expect(within(row).queryByRole("button", { name: `Lihat atau salin: Paket ${i}` })).toBeNull();
    }
    expect(screen.queryAllByTestId(/^usaha-package-p-\d$/)).toHaveLength(count);
    if (count) expect(screen.getAllByText(/^Rp\s?28\.000 \/ makan · tayang$/)).toHaveLength(count);
    else expect(screen.getByText("Belum ada paket.")).toBeTruthy();
    // The package list is a card only when it has rows: with none, "Kelola" is the page's one list card.
    expect(screen.getAllByTestId("list-card")).toHaveLength(count ? 2 : 1);
  });

  it("a draft with no price names only its state; the row never reads a price it does not have", async () => {
    scaled(usahaWith([packageNamed(1, { status: "draft", price: null })], true), <UsahaScreen />);
    expect(await screen.findByText("draf")).toBeTruthy();
    expect(screen.queryByText(/makan/)).toBeNull();
  });

  it("Kelola is one list card of five 48 rows ending with Pengaturan, with no one-row card", async () => {
    scaled(usahaWith([packageNamed(1)], true), <UsahaScreen />);
    await screen.findByText("Paket 1");
    const heading = await screen.findByRole("header", { name: "Kelola" });
    expect(bag(heading)).toMatchObject({ fontSize: 20, lineHeight: 26 });
    const card = screen.getByTestId("usaha-kelola");
    const rows = within(card).getAllByRole("button");
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual(["Uang", "Impor pelanggan", "Tim", "Pembayaran", "Pengaturan"]);
    for (const row of rows) expect(bag(row).minHeight).toBe(48);
    // Every list card on the page has more than one row: Pengaturan's own card is gone.
    for (const list of screen.getAllByTestId("list-card")) expect(within(list).getAllByRole("button").length).toBeGreaterThan(1);
    fireEvent.press(rows[4]);
    expect(require("expo-router").router.push).toHaveBeenLastCalledWith("/pengaturan");
    // The settings gear in the header is still the other way in.
    expect(screen.getAllByRole("button", { name: "Pengaturan" })).toHaveLength(2);
  });

  it("the payments card comes first when payments are off, and is gone with Pembayaran reading Aktif when they are on", async () => {
    const off = scaled(usahaWith([packageNamed(1)], false), <UsahaScreen />);
    const button = await screen.findByRole("button", { name: "Aktifkan pembayaran" });
    expect(screen.getByRole("header", { name: "Terima pembayaran lewat Catera" })).toBeTruthy();
    // First under the header, then Paket, then Kelola: three blocks 24 apart.
    const sections = screen.getByTestId("usaha-sections");
    expect(bag(sections).gap).toBe(24);
    expect(within(screen.getByTestId("usaha-payments")).getByRole("button", { name: "Aktifkan pembayaran" })).toBe(button);
    expect(within(screen.getByTestId("usaha-kelola")).getByText("Belum aktif")).toBeTruthy();
    off.unmount();
    scaled(usahaWith([packageNamed(1)], true), <UsahaScreen />);
    await screen.findByText("Paket 1");
    expect(screen.queryByRole("button", { name: "Aktifkan pembayaran" })).toBeNull();
    expect(screen.queryByTestId("usaha-payments")).toBeNull();
    expect(within(screen.getByTestId("usaha-kelola")).getByText("Aktif")).toBeTruthy();
  });

  it("keeps every primary label whole at font scale 1.3 on a 360dp phone", async () => {
    jest.spyOn(ReactNativeModule, "useWindowDimensions").mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    scaled(usahaWith([packageNamed(1)], false), <UsahaScreen />);
    expect(await screen.findByRole("button", { name: "Aktifkan pembayaran" })).toBeTruthy();
    const status = await screen.findByText("Belum aktif");
    expect(status.props.numberOfLines).toBeUndefined();
    // The rows grow with the text (minHeight, never a fixed height).
    for (const row of within(screen.getByTestId("usaha-kelola")).getAllByRole("button")) expect(bag(row).height).toBeUndefined();
  });

  it("the package rows wait as 72 media rows with the 48 button's place, built from the loaded constants", async () => {
    const pending = runtimeWith({
      sellerOperations: jest.fn(() => new Promise(() => undefined)),
      request: jest.fn(async () => ({ active: null })),
    });
    scaled(pending, <UsahaScreen />);
    expect(await screen.findByLabelText("Memuat paket")).toBeTruthy();
    const hidden = { includeHiddenElements: true } as const;
    expect(bag(screen.getByTestId("usaha-skeleton-row-0", hidden)).height).toBe(72);
    expect(bag(screen.getByTestId("usaha-skeleton-row-1", hidden)).height).toBe(72);
    expect(screen.queryByRole("button", { name: "+ Paket baru" })).toBeNull();
  });
});

describe("Uang on the Dapur scale", () => {
  afterEach(() => jest.restoreAllMocks());
  const money = (over: Partial<SettlementState>) => runtimeWith({ settlement: jest.fn(async () => ({ ...settlement, ...over })) });

  it("leads with a meta label, the payout as the figure, and a meta caption", async () => {
    scaled(money({}), <UangScreen />);
    const figure = await screen.findByTestId("uang-available");
    expect(bag(figure)).toMatchObject({ fontSize: 32, lineHeight: 40, color: nativeThemes.light.charcoal, fontFamily: "Jakarta-ExtraBold" });
    expect(figure.props.numberOfLines).toBeUndefined();
    expect(figure.props.accessibilityRole).toBeUndefined();
    expect(bag(screen.getByText("Akan masuk ke rekening"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(bag(screen.getByText(/^Pencairan berikutnya/))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    // The lead sits on the canvas, not in a card.
    expect(bag(screen.getByTestId("uang-lead")).backgroundColor).toBeUndefined();
  });

  it.each([
    ["zero", "0", /^Rp.0$/],
    ["a long amount", "12345000", /^Rp.12[.]345[.]000$/],
  ])("shows the payout %s whole", async (_name, available, text) => {
    scaled(money({ available }), <UangScreen />);
    const figure = await screen.findByTestId("uang-available");
    expect(figure.props.children).toBe(settlementCurrency(available, "id"));
    expect(figure.props.children).toMatch(text);
  });

  it("puts the seven money states in 40 rows whose values end on one right edge, and no amount changes a row's height", async () => {
    const view = scaled(money({}), <UangScreen />);
    await screen.findByTestId("uang-available");
    const keys = ["expected", "earned", "held", "available", "reserved", "paid", "recovery"];
    const geometry = () =>
      keys.map((k) => {
        const row = screen.getByTestId(`uang-row-${k}`);
        const value = within(row).getByText(/^Rp./);
        return [bag(row), bag(value)];
      });
    for (const [row, value] of geometry()) {
      expect(row).toMatchObject({ minHeight: 40 });
      expect(value).toMatchObject({ textAlign: "right", flexShrink: 0, color: nativeThemes.light.charcoal });
      expect(value.fontVariant).toEqual(["tabular-nums"]);
    }
    const before = JSON.stringify(geometry());
    view.unmount();
    scaled(money({ expected: "123456789012", held: "0" }), <UangScreen />);
    await screen.findByTestId("uang-available");
    expect(JSON.stringify(geometry())).toBe(before);
    // One list card holds all seven rows.
    expect(within(screen.getByTestId("list-card")).getAllByTestId(/^uang-row-/)).toHaveLength(7);
  });

  it("moves each row's explanation out of the rows into meta paragraphs under the list", async () => {
    scaled(money({}), <UangScreen />);
    await screen.findByTestId("uang-available");
    const hints = screen.getByTestId("uang-hints");
    const escape = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    for (const hint of [
      "Dari pengantaran yang belum terjadi.",
      "Pengantaran selesai, menunggu jadwal pencairan.",
      "Catera sedang meninjau keluhan pelanggan.",
      "Ikut pencairan berikutnya ke rekeningmu.",
      "Sedang dikirim ke rekeningmu.",
      "Sudah masuk ke rekeningmu.",
      "Pengembalian dana pelanggan, dipotong dari pencairan berikutnya.",
    ]) {
      expect(within(hints).getByText(escape(hint))).toBeTruthy();
      for (const row of screen.getAllByTestId(/^uang-row-/)) expect(within(row).queryByText(escape(hint))).toBeNull();
    }
    expect(bag(within(hints).getByText(/Ikut pencairan/))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    // The lead, the list and the explanations are three sections 24 apart.
    expect(bag(screen.getByTestId("uang-sections")).gap).toBe(24);
  });

  it("keeps the long amount whole at font scale 1.3 on a 360dp phone", async () => {
    jest.spyOn(ReactNativeModule, "useWindowDimensions").mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    scaled(money({ available: "12345000", paid: "12345000" }), <UangScreen />);
    const figure = await screen.findByTestId("uang-available");
    expect(figure.props.children).toMatch(/^Rp.12[.]345[.]000$/);
    expect(figure.props.numberOfLines).toBeUndefined();
    for (const value of within(screen.getByTestId("uang-row-paid")).getAllByText(/^Rp./)) expect(value.props.numberOfLines).toBeUndefined();
  });
});

describe("Tim and Hapus akun read the shared sheet padding", () => {
  afterEach(() => jest.restoreAllMocks());

  // process.env.EXPO_OS is inlined by the Expo transform, so Jest runs the Android value: 24 (iOS is 20, which
  // `sheetSidePadding` itself pins in the shared sheet tests).
  it("Tim's side padding is sheetSidePadding", async () => {
    scaled(runtimeWith({}), <TimScreen />);
    const content = await screen.findByTestId("tim-content");
    expect(bag(content).paddingHorizontal).toBe(sheetSidePadding());
    expect(sheetSidePadding()).toBe(24);
    expect(sheetSidePadding("ios")).toBe(20);
  });

  it("Hapus akun's side padding is sheetSidePadding", async () => {
    scaled(runtimeWith({ request: jest.fn(async () => ({ requests: [] })) }), <HapusAkun />);
    const content = await screen.findByTestId("hapus-akun-content");
    expect(bag(content).paddingHorizontal).toBe(sheetSidePadding());
  });

  it("the invite code box is a Card with a 16 radius", async () => {
    const { Share } = jest.requireActual("react-native") as typeof import("react-native");
    jest.spyOn(Share, "share").mockResolvedValue({ action: "dismissedAction" });
    const command = jest.fn(async () => ({ id: "i-1", code: "abc123" }));
    scaled(runtimeWith({ command }), <TimScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
    const box = await screen.findByTestId("tim-code");
    expect(bag(box).borderRadius).toBe(16);
    expect(within(box).getByText("abc123").props.selectable).toBe(true);
  });
});

describe("Paket detail on the Dapur scale", () => {
  it("draws the photo at 16:10 in a HeroPhotoFrame, with its own radius and no fixed 168", () => {
    scaled(runtimeWith({}), <PackageDetail offer={photoOffer} />);
    const photo = screen.getByTestId("paket-photo");
    expect(bag(photo).aspectRatio).toBe(16 / 10);
    expect(bag(photo).height).toBeUndefined();
    expect(screen.getByTestId("paket-photo-inset")).toBeTruthy();
    // The image rounds itself: a photo that finishes loading must not depend on a clipping ancestor for its corners.
    expect(bag(screen.UNSAFE_getByType(ExpoImage))).toMatchObject({ borderRadius: 16 });
  });

  it("draws no photo block when the package has none", () => {
    scaled(runtimeWith({}), <PackageDetail offer={{ ...photoOffer, image: "" } as typeof photoOffer} />);
    expect(screen.queryByTestId("paket-photo")).toBeNull();
    expect(screen.getByText("Masakan rumahan harian dengan nasi, dua lauk dan sayur.")).toBeTruthy();
  });

  it("states the facts as 40 key-value rows in one list card, and the copy action as a 50 secondary button", () => {
    scaled(runtimeWith({}), <PackageDetail offer={photoOffer} />);
    expect(bag(screen.getByText(/^Masakan rumahan/))).toMatchObject({ fontSize: 15, lineHeight: 22 });
    const card = screen.getByTestId("list-card");
    const rows = within(card).getAllByTestId(/^paket-fact-/);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(bag(row).minHeight).toBe(40);
    expect(within(screen.getByTestId("paket-fact-harga")).getByText(/^Rp\s?28\.000 per porsi$/)).toBeTruthy();
    expect(within(screen.getByTestId("paket-fact-hari")).getByText("Senin–Jumat")).toBeTruthy();
    expect(within(screen.getByTestId("paket-fact-kapasitas")).getByText("40 porsi per hari")).toBeTruthy();
    // What is in a portion is a sentence, so it stays a line under the list rather than a value that could crowd its label.
    expect(screen.getByText("2 lauk")).toBeTruthy();
    const copy = screen.getByRole("button", { name: "Salin jadi paket baru" });
    expect(bag(copy)).toMatchObject({ minHeight: 50, borderWidth: 1 });
    expect(bag(copy).backgroundColor).not.toBe(nativeThemes.light.forest);
  });

  it("a package with no price says so in the price row", () => {
    scaled(runtimeWith({}), <PackageDetail offer={{ ...photoOffer, price: null } as unknown as typeof photoOffer} />);
    expect(within(screen.getByTestId("paket-fact-harga")).getByText("Belum ada harga")).toBeTruthy();
  });

  it("waits as a photo block at 16:10, three 40 rows and the 50 button", () => {
    render(withDapurScale(<DetailSkeleton shape="package" label="Memuat paket" />));
    const hidden = { includeHiddenElements: true } as const;
    expect(bag(screen.getByTestId("detail-skeleton-photo", hidden)).aspectRatio).toBe(16 / 10);
    for (const i of [0, 1, 2]) expect(bag(screen.getByTestId(`detail-skeleton-kv-${i}`, hidden)).height).toBe(40);
    expect(bag(screen.getByTestId("detail-skeleton-actions", hidden)).height).toBe(50);
  });
});

describe("Paket editor on the Dapur scale", () => {
  const sections = ["Foto", "Isi satu porsi", "Harga", "Hari antar", "Kuota"];

  it.each([
    ["new", undefined],
    ["edit", liveOffer],
  ])("a %s package lays out its sections 24 apart under section headers", async (_name, from) => {
    scaled(runtimeWith({}), <PackageEditor from={from} />);
    await screen.findByRole("button", { name: "Pilih foto paket" });
    expect(bag(screen.getByTestId("paket-sections")).gap).toBe(24);
    for (const name of sections) expect(bag(screen.getByRole("header", { name }))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    expect(bag(screen.getByRole("header", { name: /^Gizi per porsi/ }))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    expect(screen.getByRole("button", { name: "Terbitkan paket" })).toBeTruthy();
  });

  it("a new package shows the empty photo tile at 16:10; an edit shows the photo with its own radius", async () => {
    const fresh = scaled(runtimeWith({}), <PackageEditor />);
    expect(await screen.findByText("+ Foto paket")).toBeTruthy();
    expect(bag(screen.getByTestId("paket-photo")).aspectRatio).toBe(16 / 10);
    expect(screen.queryByTestId("paket-photo-image")).toBeNull();
    fresh.unmount();
    scaled(runtimeWith({}), <PackageEditor from={liveOffer} />);
    await screen.findByRole("button", { name: "Pilih foto paket" });
    expect(bag(screen.getByTestId("paket-photo")).aspectRatio).toBe(16 / 10);
    expect(bag(screen.getByTestId("paket-photo-image"))).toMatchObject({ borderRadius: 16 });
    expect(screen.queryByText("+ Foto paket")).toBeNull();
  });

  it("the portion steppers sit in one list card", async () => {
    scaled(runtimeWith({}), <PackageEditor />);
    const counts = await screen.findByTestId("paket-counts");
    expect(within(counts).getByTestId("list-card")).toBeTruthy();
    expect(within(counts).getAllByRole("button", { name: /^Tambah / }).length).toBeGreaterThan(3);
  });

  it("delivery-day chips wrap in frames at least 48 tall, each chip keeping its 7 hit slop", async () => {
    scaled(runtimeWith({}), <PackageEditor />);
    await screen.findByRole("button", { name: "Pilih foto paket" });
    const wrap = screen.getByTestId("paket-days");
    expect(bag(wrap)).toMatchObject({ flexDirection: "row", flexWrap: "wrap" });
    for (const d of [1, 2, 3, 4, 5, 6, 0]) expect(bag(screen.getByTestId(`paket-day-${d}`)).minHeight).toBeGreaterThanOrEqual(48);
    // Two 34 chips with a 7 hit slop overlap their targets unless their rows are at least 14 apart. Each frame is 48 tall
    // around its 34 chip, so the visible rows are 14 apart and the targets meet without overlapping; no extra row gap.
    expect(bag(wrap).rowGap ?? 0).toBe(0);
    expect(bag(screen.getByTestId("paket-day-1")).minHeight - 34).toBeGreaterThanOrEqual(14);
    const chip = within(wrap).getByRole("button", { name: "Sen" });
    expect(chip.props.hitSlop).toEqual({ top: 7, bottom: 7 });
    // Selecting still works: Sab is off in a new package.
    fireEvent.press(within(wrap).getByRole("button", { name: "Sab" }));
    expect(within(wrap).getByRole("button", { name: "Sab" }).props.accessibilityState.selected).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fix round 1: digits-only fields, an unclipped package photo, delivery days as a range, muted Kelola glyphs.
// ---------------------------------------------------------------------------------------------------------------
describe("Paket editor number fields", () => {
  it.each([
    ["28.000", "28000"],
    ["Rp 28000", "28000"],
    ["28 000", "28000"],
    ["D28D", "28"],
  ])("typing %p into the price stores %p: every non-digit is stripped", async (typed, stored) => {
    scaled(runtimeWith({}), <PackageEditor />);
    const field = await screen.findByLabelText("Harga per porsi (Rp)");
    fireEvent.changeText(field, typed);
    expect(screen.getByLabelText("Harga per porsi (Rp)").props.value).toBe(stored);
  });

  it.each([
    ["40 porsi", "40"],
    ["1.200", "1200"],
    ["D5", "5"],
  ])("typing %p into the capacity stores %p", async (typed, stored) => {
    scaled(runtimeWith({}), <PackageEditor />);
    const field = await screen.findByLabelText("Kapasitas per hari (porsi)");
    fireEvent.changeText(field, typed);
    expect(screen.getByLabelText("Kapasitas per hari (porsi)").props.value).toBe(stored);
  });

  it("a price typed as 28.000 publishes as 28000", async () => {
    const command = jest.fn(async () => ({ id: "p-new" }));
    scaled(runtimeWith({ command }), <PackageEditor from={liveOffer} />);
    fireEvent.changeText(await screen.findByLabelText("Harga per porsi (Rp)"), "28.000");
    fireEvent.changeText(screen.getByLabelText("Kapasitas per hari (porsi)"), "40 porsi");
    fireEvent.press(screen.getByRole("button", { name: "Terbitkan paket" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    const payload = (command.mock.calls[0] as unknown as [string, { offer: { price: number; capacity: Record<string, number> } }])[1];
    expect(payload.offer.price).toBe(28000);
    expect(Object.values(payload.offer.capacity)).toEqual([40, 40, 40, 40, 40]);
  });
});

describe("the package photo is not clipped by an ancestor", () => {
  /** Every host ancestor of a node that clips its children. */
  const clippers = (node: { parent: unknown }) => {
    const found: string[] = [];
    let at = (node as { parent: { props?: { style?: unknown; testID?: string }; parent: unknown } | null }).parent;
    while (at) {
      if (at.props && bag(at as never).overflow === "hidden") found.push(String(at.props.testID ?? "?"));
      at = at.parent as typeof at;
    }
    return found;
  };

  it("on the detail: no ancestor of the image has overflow hidden, and the image carries the radius", () => {
    scaled(runtimeWith({}), <PackageDetail offer={photoOffer} />);
    const image = screen.getByTestId("paket-photo-image");
    expect(clippers(image)).toEqual([]);
    expect(bag(image)).toMatchObject({ borderRadius: 16 });
    expect(bag(screen.getByTestId("paket-photo-inset")).overflow).toBeUndefined();
    expect(bag(screen.getByTestId("paket-photo-inset")).borderTopLeftRadius).toBeUndefined();
  });

  it("in the editor: the same for a photo that arrives after the screen has mounted, and for an edit's own", async () => {
    const picker = require("expo-image-picker") as { launchImageLibraryAsync: jest.Mock };
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.jpg" }] });
    jest.spyOn(uploadModule, "uploadPhoto").mockResolvedValue("https://cdn.example.test/new.jpg");
    scaled(runtimeWith({}), <PackageEditor />);
    expect(screen.queryByTestId("paket-photo-image")).toBeNull();
    fireEvent.press(await screen.findByRole("button", { name: "Pilih foto paket" }));
    const arrived = await screen.findByTestId("paket-photo-image");
    expect(arrived.props.source).toEqual({ uri: "https://cdn.example.test/new.jpg" });
    expect(clippers(arrived)).toEqual([]);
    expect(bag(arrived)).toMatchObject({ borderRadius: 16 });
    screen.unmount();
    scaled(runtimeWith({}), <PackageEditor from={liveOffer} />);
    const own = await screen.findByTestId("paket-photo-image");
    expect(clippers(own)).toEqual([]);
    expect(bag(own)).toMatchObject({ borderRadius: 16 });
    jest.restoreAllMocks();
  });

  it("the default HeroPhotoFrame still clips its top corners (the customer's hero), and clip={false} drops both", () => {
    render(
      withDapurScale(
        <>
          <HeroPhotoFrame ratio={1.6} testID="clipped" />
          <HeroPhotoFrame ratio={1.6} testID="open" clip={false} />
        </>,
      ),
    );
    expect(bag(screen.getByTestId("clipped-inset"))).toMatchObject({ overflow: "hidden", borderTopLeftRadius: 14.5, borderTopRightRadius: 14.5, margin: 1.5 });
    expect(bag(screen.getByTestId("open-inset"))).toMatchObject({ margin: 1.5 });
    expect(bag(screen.getByTestId("open-inset")).overflow).toBeUndefined();
    expect(bag(screen.getByTestId("open-inset")).borderTopLeftRadius).toBeUndefined();
    expect(bag(screen.getByTestId("open")).aspectRatio).toBe(1.6);
  });
});

describe("the delivery days read as a range", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [[1, 2, 3, 4, 5], "id", "Senin–Jumat"],
    [[1, 2, 3, 4, 5, 6, 0], "id", "Senin–Minggu"],
    [[0, 6, 5, 4, 3, 2, 1], "id", "Senin–Minggu"],
    [[1, 2, 3, 4, 5], "en", "Monday–Friday"],
    [[1], "id", "Senin"],
    [[1, 3, 5], "id", "Sen, Rab, Jum"],
    [[6, 0, 1], "id", "Sen, Sab, Min"],
    [[1, 2, 3, 5, 6], "id", "Sen–Rab, Jum, Sab"],
    [[1, 2, 4, 5, 0], "en", "Mon, Tue, Thu, Fri, Sun"],
  ] as const)("%j (%s) reads %s", (days, locale, text) => {
    expect(weekdayLabel([...days], locale)).toBe(text);
  });

  it("a seven-day package stays whole in its 40 row at 360dp and font scale 1.3", () => {
    jest.spyOn(ReactNativeModule, "useWindowDimensions").mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    scaled(runtimeWith({}), <PackageDetail offer={{ ...photoOffer, weekdays: [1, 2, 3, 4, 5, 6, 0] } as typeof photoOffer} />);
    const value = within(screen.getByTestId("paket-fact-hari")).getByText("Senin–Minggu");
    expect(value.props.numberOfLines).toBeUndefined();
    // About 100dp at 1.3x of the 296 inner width, so the label keeps its room beside it.
    expect("Senin–Minggu".length * 8.3 * 1.3).toBeLessThan(296 - 120);
    expect(within(screen.getByTestId("paket-fact-hari")).getByText("Hari antar")).toBeTruthy();
  });
});

describe("Kelola glyphs", () => {
  it("are muted, not forest: forest is for actions", async () => {
    scaled(usahaWith([packageNamed(1)], true), <UsahaScreen />);
    await screen.findByText("Paket 1");
    const glyphs = within(screen.getByTestId("usaha-kelola")).UNSAFE_getAllByType(Ionicons).filter((g) => g.props.size === 20 && g.props.name !== "chevron-forward");
    expect(glyphs).toHaveLength(5);
    for (const glyph of glyphs) expect(glyph.props.color).toBe(nativeThemes.light.muted);
  });
});
