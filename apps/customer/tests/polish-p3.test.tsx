import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, POLISH_ART, ThemeProvider, type PolishArtName } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { categoryArt, categoryTiles } from "../src/discover/categories";
import { laukScore, sortByLauk } from "../src/discover/laukSort";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { SavedList } from "../src/discover/SavedList";
import { NotificationsScreen } from "../src/account/Notifications";
import { ReportList } from "../src/help/ReportList";
import { Akun } from "../src/account/Akun";
import { customerState, offer } from "./fixtures";

/* Polish artwork, task P3: Jelajah, package detail, Disimpan, Akun and the empty states (canvas 2026-10-30). */

let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));
let mockPrefs: string[] = [];
jest.mock("../src/onboarding/prefs", () => ({
  ...jest.requireActual("../src/onboarding/prefs"),
  readLaukPrefs: jest.fn(async () => mockPrefs),
}));

const hidden = { includeHiddenElements: true };
const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
/** Every drawn copy of one polish artwork. */
const art = (name: PolishArtName) => screen.queryAllByTestId("polish-art", hidden).filter((n) => n.props.source === POLISH_ART[name]);

function runtimeWith(over: Record<string, unknown> = {}, actor: Record<string, unknown> | null = customer): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    customer: jest.fn(async () => customerState(null)),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    offer: jest.fn(async () => ({ offer: null })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    ...over,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const mount = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <ThemeProvider storageKey="polish-p3">
      <MoodProvider now={() => new Date("2026-10-09T03:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {ui}
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockPrefs = [];
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
});
afterEach(() => jest.restoreAllMocks());

describe("category art", () => {
  it("matches the caterers' own tags to the canvas art, and nothing else", () => {
    expect(categoryArt("Menu Nusantara")).toBe("category-nusantara");
    expect(categoryArt("Sehat")).toBe("category-sehat");
    expect(categoryArt("Pedas")).toBe("spot-cabai");
    expect(categoryArt("Nabati")).toBe("spot-plate-leaf");
    expect(categoryArt("Vegetarian")).toBe("spot-plate-leaf");
    expect(categoryArt("Keluarga")).toBe("category-keluarga");
    expect(categoryArt("Kantor")).toBe("category-kantor");
    expect(categoryArt("Rumahan")).toBeNull();
  });

  it("gives each art to its most frequent tag and leaves the rest as chips", () => {
    const o = (id: string, tags: string[]) => offer({ id, tags });
    const { tiles, chips } = categoryTiles([o("a", ["Nusantara", "Rumahan"]), o("b", ["Nusantara", "Menu Nusantara"]), o("c", ["Pedas"])], 6);
    expect(tiles).toEqual([
      { tag: "Nusantara", art: "category-nusantara" },
      { tag: "Pedas", art: "spot-cabai" },
    ]);
    expect(chips).toEqual(["Menu Nusantara", "Rumahan"]);
  });
});

describe("lauk sort", () => {
  const ikan = offer({ id: "p-ikan", name: "Ikan Bumbu Kuning", menus: [] });
  const ayam = offer({ id: "p-ayam", name: "Paket Harian" }); // its menu holds "Ayam bakar madu"
  const sayur = offer({ id: "p-sayur", name: "Paket Hijau", tags: ["Nabati"], menus: [] });

  it("counts the choices a package's name, tags or menu match", () => {
    expect(laukScore(ayam, ["ayam", "sayur"], "id")).toBe(2); // ayam bakar madu, sayur asem
    expect(laukScore(ikan, ["ayam"], "id")).toBe(0);
    expect(laukScore(sayur, ["sayur"], "id")).toBe(1);
  });

  it("puts better matches first and keeps the catalogue order otherwise; no choices changes nothing", () => {
    expect(sortByLauk([ayam, ikan, sayur], ["ikan"], "id").map((o) => o.id)).toEqual(["p-ikan", "p-ayam", "p-sayur"]);
    const list = [ayam, ikan, sayur];
    expect(sortByLauk(list, [], "id")).toBe(list);
  });

  it("only says tanpa santan when a caterer wrote it", () => {
    expect(laukScore(offer({ name: "Sayur bening", menus: [] }), ["tanpa-santan"], "id")).toBe(0);
    expect(laukScore(offer({ name: "Sayur bening", tags: ["Tanpa santan"], menus: [] }), ["tanpa-santan"], "id")).toBe(1);
  });
});

describe("Jelajah", () => {
  const sehat = offer({ id: "p-sehat", name: "Menu Sehat", tags: ["Sehat"], menus: [] });
  const pedas = offer({ id: "p-pedas", name: "Paket Balado", tags: ["Pedas", "Rumahan"], menus: [] });
  const catalog = (items: Offer[]) => ({ catalog: jest.fn(async () => ({ items, nextCursor: null })) });

  it("draws an art chip for each tag that has art, in the one chip row ahead of the plain tags, filtering like a chip", async () => {
    mount(runtimeWith(catalog([sehat, pedas])), <Jelajah />);
    await screen.findByText("Menu Sehat");
    const row = within(screen.getByTestId("chip-row"));
    expect(row.getAllByRole("button").map((b) => b.props.accessibilityLabel ?? "").filter((l) => l.startsWith("Kategori"))).toEqual([
      "Kategori Pedas",
      "Kategori Sehat",
      "Kategori Rumahan",
    ]);
    expect(row.getAllByTestId("category-art-chip")).toHaveLength(2);
    expect(art("category-sehat")).toHaveLength(1);
    expect(art("spot-cabai")).toHaveLength(1);
    // A 34 chip that reaches the 44 target through its hit slop, like every chip in the row (the grid keeps its fold).
    const tile = screen.getByRole("button", { name: "Kategori Sehat" });
    expect(flat(tile).minHeight + tile.props.hitSlop.top + tile.props.hitSlop.bottom).toBe(44);
    fireEvent.press(tile);
    expect(screen.getByRole("button", { name: "Kategori Sehat" }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText("Paket Balado")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Kategori Sehat" }));
    expect(screen.getByText("Paket Balado")).toBeTruthy();
  });

  it("has no art chip when no tag has art", async () => {
    mount(runtimeWith(catalog([offer({ tags: ["Rumahan"] })])), <Jelajah />);
    await screen.findByText("Makan Siang Rumahan");
    expect(screen.queryByTestId("category-art-chip")).toBeNull();
  });

  it("puts the packages that match the saved lauk choices first", async () => {
    mockPrefs = ["ikan"];
    const a = offer({ id: "p-a", name: "Paket Ayam", menus: [] });
    const b = offer({ id: "p-b", name: "Paket Ikan Bakar", menus: [] });
    mount(runtimeWith(catalog([a, b])), <Jelajah />);
    await screen.findByText("Paket Ikan Bakar");
    const names = screen.getAllByTestId("package-cell").map((c) => within(c).getByText(/^Paket /).props.children);
    expect(names).toEqual(["Paket Ikan Bakar", "Paket Ayam"]);
  });

  it("an area no caterer reaches shows the empty-area art and Lihat semua area", async () => {
    await SecureStore.setItemAsync("catera.area", "Menteng");
    mount(runtimeWith(catalog([sehat])), <Jelajah />);
    expect(await screen.findByText(/Belum ada katering yang antar ke/)).toBeTruthy();
    expect(art("empty-area")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-mencari", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Lihat semua area" })).toBeTruthy();
  });

  it("filters that match nothing show the saringan art and Hapus pilihan", async () => {
    mount(runtimeWith(catalog([sehat])), <Jelajah />);
    await screen.findByText("Menu Sehat");
    fireEvent.changeText(screen.getByLabelText("Cari paket"), "rendang");
    expect(screen.getByText("Belum ada paket yang cocok.")).toBeTruthy();
    expect(art("spot-saringan")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-mencari", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Hapus pilihan" })).toBeTruthy();
  });

  it("nothing on offer shows empty-area, and a meal with no packages shows the saringan art, never the mascot", async () => {
    mount(runtimeWith(), <Jelajah />);
    expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
    expect(art("empty-area")).toHaveLength(1);
    screen.unmount();
    mount(runtimeWith(catalog([offer({ id: "p-malam", name: "Paket Malam", meal: "dinner" })])), <Jelajah />);
    expect(await screen.findByText("Belum ada paket makan siang.")).toBeTruthy();
    expect(art("spot-saringan")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-mencari", hidden)).toBeNull();
  });

  it("draws the empty art at 160, and smaller on a 360dp phone at font scale 1.3", async () => {
    mount(runtimeWith(catalog([sehat])), <Jelajah />);
    await screen.findByText("Menu Sehat");
    fireEvent.changeText(screen.getByLabelText("Cari paket"), "rendang");
    expect(flat(art("spot-saringan")[0])).toMatchObject({ width: 160, height: 160 });
    screen.unmount();
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    mount(runtimeWith(catalog([sehat])), <Jelajah />);
    await screen.findByText("Menu Sehat");
    fireEvent.changeText(screen.getByLabelText("Cari paket"), "rendang");
    expect(flat(art("spot-saringan")[0]).width).toBeLessThan(160);
  });
});

describe("Paket", () => {
  const open = async (o: Offer, request: jest.Mock = jest.fn(async () => [])) => {
    mockParams = { id: o.id };
    mount(runtimeWith({ offer: jest.fn(async () => ({ offer: o })), request }), <PackageDetail />);
    await screen.findByTestId("paket-name");
  };
  const rows = () => screen.getAllByTestId("paket-termasuk-row");
  const titles = () => rows().map((r) => within(r).getAllByText(/./)[0].props.children);

  it("Termasuk lists only what the package's data says, each with its spot art", async () => {
    await open(offer({ id: "p-1", flexible: true, trialPrice: 20000, trialMax: 1 }));
    expect(screen.getByText("Termasuk")).toBeTruthy();
    expect(titles()).toEqual(["Diantar ke alamatmu", "Pilih tanggal mulai", "Bisa pindah tanggal", "Bisa coba 1 hari"]);
    expect(within(rows()[0]).getByText("Sen–Jum, 11.00–13.00. Ongkir sudah termasuk.")).toBeTruthy();
    expect(within(rows()[2]).getByText("Ubah hari sampai 17.00, sehari sebelumnya.")).toBeTruthy();
    for (const name of ["spot-rantang", "spot-calendar-tote", "spot-plate-pause", "spot-rantang-gift"] as const) {
      expect(art(name)).toHaveLength(1);
      expect(flat(art(name)[0])).toMatchObject({ width: 48, height: 48 });
    }
    // No field backs a vegetable every day, so the canvas row is not drawn.
    expect(screen.queryByText("Sayur tiap hari")).toBeNull();
    expect(art("spot-plate-leaf")).toHaveLength(0);
  });

  it("a fixed package does not promise moving a date, and no trial means no trial row", async () => {
    await open(offer({ id: "p-2", flexible: false, trialPrice: null }));
    expect(titles()).toEqual(["Diantar ke alamatmu", "Pilih tanggal mulai"]);
    expect(screen.queryByText(/Ubah hari sampai/)).toBeNull();
    expect(art("spot-rantang-gift")).toHaveLength(0);
  });

  it("Kata pelanggan counts the quick-praise phrases in real reviews and shows only those said", async () => {
    const request = jest.fn(async () => [
      { id: "r1", customer: "Dewi", rating: 5, body: "Masih hangat. Porsi pas." },
      { id: "r2", customer: "Budi", rating: 4, body: "masih hangat, tapi porsinya pas-pasan" },
    ]);
    await open(offer({ id: "p-3" }), request);
    await screen.findByText("Kata pelanggan");
    const block = within(screen.getByTestId("paket-pujian"));
    expect(block.getByLabelText("Masih hangat, 2 ulasan")).toBeTruthy();
    expect(block.getByLabelText("Porsi pas, 1 ulasan")).toBeTruthy();
    expect(block.queryByText("Rasa rumahan")).toBeNull();
    expect(art("compliment-hangat")).toHaveLength(1);
    expect(art("compliment-rumahan")).toHaveLength(0);
  });

  it("no reviews, or none with a praise phrase, means no Kata pelanggan", async () => {
    await open(offer({ id: "p-4" }), jest.fn(async () => [{ id: "r1", customer: "Dewi", rating: 5, body: "Enak." }]));
    await screen.findByText("Dewi · 5/5");
    expect(screen.queryByText("Kata pelanggan")).toBeNull();
  });
});

describe("empty states", () => {
  it("Disimpan with nothing saved shows the lid-heart art", async () => {
    mount(runtimeWith(), <SavedList />);
    expect(await screen.findByText("Belum ada paket tersimpan.")).toBeTruthy();
    expect(art("spot-lid-heart")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-mencari", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Cari paket" })).toBeTruthy();
  });

  it("Notifikasi with no updates shows the kentongan art and opens Pengaturan", async () => {
    mount(runtimeWith(), <NotificationsScreen />);
    expect(await screen.findByText("Belum ada notifikasi baru.")).toBeTruthy();
    expect(art("empty-kentongan-lid")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-tidur", hidden)).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Pengaturan notifikasi" }));
    expect(router.push).toHaveBeenCalledWith("/pengaturan");
  });

  it("Bantuan dan laporan with no reports shows the nota art and keeps Minta bantuan", async () => {
    mount(runtimeWith(), <ReportList />);
    expect(await screen.findByText("Belum ada laporan")).toBeTruthy();
    expect(art("spot-nota")).toHaveLength(1);
    expect(screen.queryByTestId("mascot-tidur", hidden)).toBeNull();
    expect(screen.getByRole("button", { name: "Minta bantuan" })).toBeTruthy();
  });
});

describe("Akun", () => {
  it("the three tiles wear their spot art at 48, and there is no referral card", async () => {
    mount(runtimeWith(), <Akun />);
    await screen.findByTestId("akun-tiles");
    const tiles = { "akun-tile-paket": "spot-rantang", "akun-tile-alamat": "spot-pin-lid", "akun-tile-riwayat": "spot-nota" } as const;
    for (const [id, name] of Object.entries(tiles)) {
      const node = within(screen.getByTestId(id)).getByTestId("polish-art", hidden);
      expect(node.props.source).toBe(POLISH_ART[name]);
      expect(flat(node)).toMatchObject({ width: 48, height: 48 });
    }
    expect(screen.queryByText(/Ajak teman/)).toBeNull();
    expect(art("spot-rantang-gift")).toHaveLength(0);
  });
});
