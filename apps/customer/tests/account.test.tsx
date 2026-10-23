import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import { MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { addDays, type CustomerActionItem, type CustomerState } from "@catera/domain";
import { Akun } from "../src/account/Akun";
import { TILES_STACK_BELOW } from "../src/account/AkunTiles";
import { wellFormedLabel } from "./labels";
import { Addresses } from "../src/account/Addresses";
import { Payments } from "../src/account/Payments";
import { NotificationsScreen } from "../src/account/Notifications";
import { Pengaturan } from "../src/settings/Pengaturan";
import { BahasaSheet, TampilanSheet } from "../src/settings/ChoiceSheets";
import { Beranda } from "../src/today/Beranda";
import { PerluDiurus } from "../src/today/PerluDiurus";
import { customerLink } from "../src/links";
import { AddressForm } from "../src/account/AddressForm";
import { customerState, eightPlans, subscription, offer, TODAY } from "./fixtures";
import { SheetHost } from "./sheetHost";

let mockParams: Record<string, string> = {};
/** Adding and editing an address is a sheet route (`/alamat-form`): the host shows it over Alamat. */
const SHEETS = { "/alamat-form": AddressForm };
const toParams = (params: Record<string, string>) => void (mockParams = params);
/** Alamat with its form sheet's stand-in stack, and the toast the sheet shows on saving. */
const withForm = (
  <ToastProvider>
    <Addresses />
    <SheetHost routes={SHEETS} onParams={toParams} />
  </ToastProvider>
);

/** Rows that carry an href open through openLink; its tab handling is covered in navigation.test, so here it opens the
 * path the way a push does. */
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
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
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[synthetic]" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "synthetic-project" } } } },
}));
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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(
  state: Partial<CustomerState> | (() => Promise<unknown>),
  {
    actor = customer as Record<string, unknown> | null,
    actions = [] as CustomerActionItem[],
    ended = undefined as CustomerActionItem[] | undefined,
    phone = "",
  } = {},
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(typeof state === "function" ? state : async () => ({ ...customerState(null), ...state })),
    customerActions: jest.fn(async () => ({ total: actions.length, items: actions, ...(ended ? { ended } : {}) })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  runtime.signOut = jest.fn(async () => undefined);
  if (phone)
    (runtime as { supabase: unknown }).supabase = {
      auth: {
        getSession: async () => ({ data: { session: { user: { phone } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        startAutoRefresh: () => undefined,
        stopAutoRefresh: () => undefined,
      },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: async () => undefined,
    };
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: "undetermined" });
});

/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
const address = (id: string, label: string) => ({
  id,
  label,
  line: "Jl. Contoh No. 1",
  area: "Jakarta Selatan",
  city: "Jakarta",
  instructions: "",
  version: 1,
});

describe("Akun", () => {
  beforeEach(() => {
    mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  });

  const finished = () =>
    subscription({
      id: "s-old",
      status: "completed",
      remaining: 0,
      snapshot: { offer: offer({ name: "Paket Lama" }), total: 90000 } as never,
    });

  it("opens with the initials avatar and the name in heroTitle, with the phone under it and no settings gear", async () => {
    renderWith(runtimeWith({}, { phone: "6281234567890" }), <Akun />);
    const header = await screen.findByTestId("akun-header");
    const avatar = within(header).getByTestId("akun-avatar", { includeHiddenElements: true });
    expect(flat(avatar)).toMatchObject({ width: 56, height: 56, borderRadius: 28 });
    expect(within(avatar).getByText("RC", { includeHiddenElements: true })).toBeTruthy();
    const name = within(header).getByText("Rani Contoh");
    expect(name.props.accessibilityRole).toBe("header");
    expect(flat(name)).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(await within(header).findByText("0812-3456-7890")).toBeTruthy();
    expect(within(header).queryByRole("button")).toBeNull();
  });

  it("hides the initials avatar from a screen reader, so the name is the first thing it reads", async () => {
    renderWith(runtimeWith({}, { phone: "6281234567890" }), <Akun />);
    const avatar = await screen.findByTestId("akun-avatar", { includeHiddenElements: true });
    expect(avatar.props.accessible).toBe(false);
    expect(avatar.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.queryByText("RC")).toBeNull();
    expect(screen.getByText("Rani Contoh")).toBeTruthy();
  });

  it("takes one initial for a one-word name", async () => {
    renderWith(runtimeWith({}, { actor: { id: "u-2", role: "customer", name: "Rani" } }), <Akun />);
    expect(within(await screen.findByTestId("akun-avatar", { includeHiddenElements: true })).getByText("R", { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows three shortcut tiles, each with its label over its count, that open Paket saya, Alamat and Riwayat", async () => {
    renderWith(
      runtimeWith({ subscriptions: [subscription(), finished()], addresses: [address("a-1", "Kantor"), address("a-2", "Rumah")] }),
      <Akun />,
    );
    const paket = await screen.findByTestId("akun-tile-paket");
    expect(within(paket).getByText("Paket saya")).toBeTruthy();
    // Only the running plan counts; the finished one is not "aktif".
    expect(await within(paket).findByText("1 aktif")).toBeTruthy();
    const alamat = screen.getByTestId("akun-tile-alamat");
    expect(within(alamat).getByText("2 tersimpan")).toBeTruthy();
    const riwayat = screen.getByTestId("akun-tile-riwayat");
    expect(within(riwayat).getByText("Riwayat")).toBeTruthy();
    expect(within(riwayat).getByText("Pembayaran")).toBeTruthy();
    // Gap 8, radius 16, at least 96 tall; the label is bodyStrong and the count is meta.
    for (const tile of [paket, alamat, riwayat]) expect(flat(tile)).toMatchObject({ minHeight: 96, borderRadius: 16 });
    expect(flat(screen.getByTestId("akun-tiles"))).toMatchObject({ columnGap: 8, rowGap: 8 });
    expect(flat(within(paket).getByText("Paket saya"))).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(flat(within(paket).getByText("1 aktif"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    fireEvent.press(paket);
    expect(router.push).toHaveBeenLastCalledWith("/paket-saya");
    fireEvent.press(alamat);
    expect(router.push).toHaveBeenLastCalledWith("/alamat");
    fireEvent.press(riwayat);
    expect(router.push).toHaveBeenLastCalledWith("/pembayaran");
  });

  it("says Tidak ada for no running plan and no saved address", async () => {
    renderWith(runtimeWith({ subscriptions: [finished()], addresses: [] }), <Akun />);
    expect(await within(await screen.findByTestId("akun-tile-paket")).findByText("Tidak ada")).toBeTruthy();
    expect(within(screen.getByTestId("akun-tile-alamat")).getByText("Tidak ada")).toBeTruthy();
  });

  it("counts eight running plans", async () => {
    renderWith(runtimeWith(eightPlans()), <Akun />);
    expect(await within(await screen.findByTestId("akun-tile-paket")).findByText("8 aktif")).toBeTruthy();
  });

  it("keeps the tiles reachable without counts when the plan read fails", async () => {
    const failing = async () => Promise.reject(Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" }));
    const runtime = runtimeWith(failing);
    renderWith(runtime, <Akun />);
    const paket = await screen.findByTestId("akun-tile-paket");
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalled());
    await act(async () => {});
    expect(within(paket).queryByText(/aktif|Tidak ada/)).toBeNull();
    expect(within(screen.getByTestId("akun-tile-alamat")).queryByText(/tersimpan|Tidak ada/)).toBeNull();
    fireEvent.press(paket);
    expect(router.push).toHaveBeenLastCalledWith("/paket-saya");
  });

  it("lists Data akun, Disimpan, Notifikasi and Bantuan dan laporan in one card of 56 rows, and Pengaturan in a card of its own", async () => {
    renderWith(runtimeWith({}), <Akun />);
    await screen.findByTestId("akun-tiles");
    expect(screen.getAllByTestId("list-card")).toHaveLength(2);
    const [rows, settings] = screen.getAllByTestId("list-card");
    const names = within(rows)
      .getAllByRole("button")
      .map((b) => within(b).getByText(/[A-Za-z]/).props.children);
    expect(names).toEqual(["Data akun", "Disimpan", "Notifikasi", "Bantuan dan laporan"]);
    for (const [label, href] of [
      ["Data akun", "/data-akun"],
      ["Disimpan", "/disimpan"],
      ["Notifikasi", "/notifications"],
      ["Bantuan dan laporan", "/bantuan"],
    ]) {
      fireEvent.press(within(rows).getByText(label));
      expect(router.push).toHaveBeenLastCalledWith(href);
    }
    for (const row of within(rows).getAllByRole("button")) expect(flat(row)).toMatchObject({ minHeight: 56 });
    // Pengaturan sits apart and says what it holds.
    expect(within(settings).getByText("Pengaturan")).toBeTruthy();
    expect(within(settings).getByText("Bahasa, tampilan")).toBeTruthy();
    fireEvent.press(within(settings).getByText("Pengaturan"));
    expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
    // Alamat and Riwayat are tiles now, not rows; no Keluar here.
    expect(within(rows).queryByText("Alamat")).toBeNull();
    expect(screen.queryByText("Riwayat pembayaran")).toBeNull();
    expect(screen.queryByRole("button", { name: "Keluar" })).toBeNull();
  });

  it("holds no plan rows: active plans live in Paket saya", async () => {
    renderWith(runtimeWith({ subscriptions: [subscription(), finished()] }), <Akun />);
    expect(await screen.findByText("1 aktif")).toBeTruthy();
    expect(screen.queryByText("Makan Siang Rumahan")).toBeNull();
    expect(screen.queryByText("Dapur Contoh · 6 hari lagi")).toBeNull();
    expect(screen.queryByText("Paket Lama")).toBeNull();
    expect(screen.queryByText("Paket aktif")).toBeNull();
  });

  it("stacks the tiles in one column and lets every label wrap at 360dp and font scale 1.3", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    renderWith(runtimeWith(eightPlans(), { phone: "6281234567890" }), <Akun />);
    await screen.findByTestId("akun-tiles");
    expect(flat(screen.getByTestId("akun-tiles")).flexDirection).toBe("column");
    // Nothing a tile or a row must show is cut to one line.
    for (const id of ["akun-tile-paket", "akun-tile-alamat", "akun-tile-riwayat"]) {
      for (const text of within(screen.getByTestId(id)).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
    }
    for (const row of within(screen.getAllByTestId("list-card")[0]).getAllByRole("button"))
      for (const text of within(row).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
  });

  it("stacks the tiles at 412dp and font scale 1.3 (effective width 316): 72 rows with the glyph beside the words", async () => {
    mockWindow = { width: 412, height: 860, scale: 3, fontScale: 1.3 };
    renderWith(runtimeWith(eightPlans(), { phone: "6281234567890" }), <Akun />);
    await screen.findByTestId("akun-tiles");
    expect(TILES_STACK_BELOW).toBe(340);
    expect(flat(screen.getByTestId("akun-tiles")).flexDirection).toBe("column");
    for (const id of ["akun-tile-paket", "akun-tile-alamat", "akun-tile-riwayat"]) {
      expect(flat(screen.getByTestId(id))).toMatchObject({ flexDirection: "row", alignItems: "center", minHeight: 72 });
    }
    // "Pembayaran" has the width of the tile, so it is no longer broken mid-word.
    expect(within(screen.getByTestId("akun-tile-riwayat")).getByText("Pembayaran").props.numberOfLines).toBeUndefined();
  });

  it("keeps three columns at 412dp and font scale 1 and at 360dp and font scale 1", async () => {
    for (const w of [
      { width: 412, height: 860, scale: 3, fontScale: 1 },
      { width: 360, height: 800, scale: 3, fontScale: 1 },
    ]) {
      mockWindow = w;
      const view = renderWith(runtimeWith({}), <Akun />);
      await screen.findByTestId("akun-tiles");
      expect(flat(screen.getByTestId("akun-tiles")).flexDirection).toBe("row");
      view.unmount();
    }
  });

  it("names its tiles and rows from their non-empty parts: no glyph, leading, trailing or doubled separator", async () => {
    renderWith(runtimeWith(eightPlans(), { phone: "6281234567890" }), <Akun />);
    await screen.findByTestId("akun-tiles");
    const labels = screen.getAllByRole("button").map((b) => b.props.accessibilityLabel as string | undefined).filter(Boolean) as string[];
    expect(labels.length).toBeGreaterThan(5);
    for (const label of labels) expect({ label, ok: wellFormedLabel(label) }).toEqual({ label, ok: true });
    expect(screen.getByRole("button", { name: "Data akun" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Riwayat, Pembayaran" })).toBeTruthy();
  });

  it("takes the dark theme's surface for the tiles and the cards, and its ink for the labels", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const dark = nativeThemes.dark;
    render(
      <ThemeProvider storageKey="akun-dark-test">
        <MobileProvider runtime={runtimeWith({})} linkMapper={customerLink}>
          <Akun />
        </MobileProvider>
      </ThemeProvider>,
    );
    const paket = await screen.findByTestId("akun-tile-paket");
    expect(flat(paket).backgroundColor).toBe(dark.surface);
    expect(flat(within(paket).getByText("Paket saya")).color).toBe(dark.charcoal);
    expect(flat(screen.getAllByTestId("list-card")[0]).backgroundColor).toBe(dark.surface);
    scheme.mockRestore();
  });

  it("reads the tiles in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    renderWith(runtimeWith({ subscriptions: [subscription()], addresses: [address("a-1", "Kantor")] }), <Akun />);
    const paket = await screen.findByTestId("akun-tile-paket");
    expect(within(paket).getByText("My plans")).toBeTruthy();
    expect(await within(paket).findByText("1 active")).toBeTruthy();
    expect(within(screen.getByTestId("akun-tile-alamat")).getByText("Addresses")).toBeTruthy();
    expect(within(screen.getByTestId("akun-tile-alamat")).getByText("1 saved")).toBeTruthy();
    expect(within(screen.getByTestId("akun-tile-riwayat")).getByText("History")).toBeTruthy();
    expect(within(screen.getByTestId("akun-tile-riwayat")).getByText("Payments")).toBeTruthy();
  });

  it("language switch changes copy to English", async () => {
    // The language is chosen in Pengaturan's Bahasa sheet; Akun follows it.
    renderWith(
      runtimeWith({}),
      <>
        <Akun />
        <BahasaSheet />
      </>,
    );
    expect(await screen.findByText("Paket saya")).toBeTruthy();
    fireEvent.press(screen.getByRole("radio", { name: "English" }));
    expect(await screen.findByText("My plans")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Settings/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Help and reports/ })).toBeTruthy();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.locale", "en");
  });

  it("shows no caterer or admin workspace links", async () => {
    renderWith(runtimeWith({}, { actor: { id: "u-o1", role: "owner", name: "Pemilik Contoh" } }), <Akun />);
    expect(await screen.findByText("Pemilik Contoh")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Pengaturan/ })).toHaveLength(1);
    expect(screen.queryByText(/ruang kerja|Catera Admin|workspace/i)).toBeNull();
  });

  it("signed out asks to sign in and comes back to Akun, and still offers Pengaturan", async () => {
    renderWith(
      runtimeWith({}, { actor: null }),
      <>
        <Akun />
        <BahasaSheet />
      </>,
    );
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/akun" } });
    expect(screen.getAllByRole("button", { name: /^Pengaturan/ })).toHaveLength(1);
    fireEvent.press(screen.getByRole("button", { name: /^Pengaturan/ }));
    expect(router.push).toHaveBeenLastCalledWith("/pengaturan");
    fireEvent.press(screen.getByRole("radio", { name: "English" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  // Tampilan moved from Akun to Pengaturan's sheet (Phase F); signed out reaches it through Pengaturan too.
  describe("Tampilan in Pengaturan", () => {
    const canvas = () => StyleSheet.flatten(screen.UNSAFE_getByType(SafeAreaView).props.style).backgroundColor;
    const renderThemed = async (runtime: MobileRuntime) => {
      render(
        <ThemeProvider storageKey={runtime.storageKey("theme")}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
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
      expect(canvas()).toBe("#E4DED1");
    });

    it("pressing Gelap stores dark and repaints Pengaturan under the sheet", async () => {
      await renderThemed(runtimeWith({}));
      fireEvent.press(screen.getByRole("radio", { name: "Gelap" }));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.theme", "dark");
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

    it("is offered while signed out too", async () => {
      await renderThemed(runtimeWith({}, { actor: null }));
      fireEvent.press(screen.getByRole("radio", { name: "Gelap" }));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.theme", "dark");
    });
  });
});

describe("Notifikasi", () => {
  it("lists the updates without a push card: the switch lives in Pengaturan", async () => {
    renderWith(runtimeWith({}), <NotificationsScreen />);
    expect(await screen.findByText("Belum ada kabar baru.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aktifkan" })).toBeNull();
    expect(screen.queryByText("Nonaktif")).toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("marks an unread notification read and opens its app screen", async () => {
    const runtime = runtimeWith({
      notifications: [
        {
          id: "n-1",
          kind: "delivery",
          body: "Makan siang sedang diantar.",
          href: "/deliveries/d-1",
          read_at: null,
          created_at: `${TODAY}T03:15:00Z`,
        },
        {
          id: "n-2",
          kind: "payment",
          body: "Pembayaran diterima.",
          href: "/payment/ck-1",
          read_at: `${TODAY}T02:00:00Z`,
          created_at: `${TODAY}T01:00:00Z`,
        },
      ],
    });
    renderWith(runtime, <NotificationsScreen />);
    fireEvent.press(await screen.findByText("Makan siang sedang diantar."));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("notification.read", { id: "n-1" }, expect.any(String)),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/hari/d-1"));
    expect(screen.getByText(/10.15/)).toBeTruthy();

    fireEvent.press(screen.getByText("Pembayaran diterima."));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/bayar/ck-1"));
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
  });

  it("says plainly when there is nothing yet", async () => {
    renderWith(runtimeWith({}), <NotificationsScreen />);
    expect(await screen.findByText("Belum ada kabar baru.")).toBeTruthy();
  });
});

describe("Alamat", () => {
  const kantor = {
    id: "a-1",
    label: "Kantor",
    line: "Jl. Contoh No. 1",
    area: "Jakarta Selatan",
    city: "Jakarta",
    instructions: "Titip resepsionis",
    version: 3,
  };

  it("edits an address with the same address.save payload", async () => {
    const runtime = runtimeWith({ addresses: [kantor] });
    renderWith(runtime, withForm);
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Kantor" }));
    // The form is a native sheet over Alamat, opened with the address's id.
    expect(router.push).toHaveBeenCalledWith("/alamat-form?id=a-1");
    // An edit reads the book for the address's version first.
    fireEvent.changeText(await screen.findByLabelText("Jalan, nomor, detail"), "Jl. Baru No. 2");
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Simpan alamat" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "address.save",
        {
          id: "a-1",
          version: 3,
          label: "Kantor",
          line: "Jl. Baru No. 2",
          area: "Jakarta Selatan",
          city: "Jakarta",
          instructions: "Titip resepsionis",
        },
        expect.any(String),
      ),
    );
    // Saved: the sheet closes and the toast says so.
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Simpan alamat" })).toBeNull());
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Alamat disimpan")).toBeTruthy();
  });

  it("adds a new address in the chosen area", async () => {
    const runtime = runtimeWith({ addresses: [] });
    renderWith(runtime, withForm);
    fireEvent.press(await screen.findByRole("button", { name: "Tambah alamat" }));
    expect(router.push).toHaveBeenCalledWith("/alamat-form");
    expect(screen.getByRole("header", { name: "Alamat baru" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan alamat" })).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. Melati No. 9");
    fireEvent.press(screen.getByRole("button", { name: "Tangerang Selatan" }));
    fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "address.save",
        {
          label: "Rumah",
          line: "Jl. Melati No. 9",
          area: "Tangerang Selatan",
          city: "Jakarta",
          instructions: "",
        },
        expect.any(String),
      ),
    );
  });

  it("keeps the form and says so when saving fails", async () => {
    const runtime = runtimeWith({ addresses: [kantor] });
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("CONFLICT"), { code: "CONFLICT" }));
    renderWith(runtime, withForm);
    fireEvent.press(await screen.findByRole("button", { name: "Ubah Kantor" }));
    fireEvent.press(await screen.findByRole("button", { name: "Simpan alamat" }));
    expect(await screen.findByTestId("address-error")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan alamat" })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("Riwayat pembayaran", () => {
  it("lists paid purchases and opens Bayar for one waiting for payment", async () => {
    const runtime = runtimeWith(
      {
        subscriptions: [
          { ...subscription(), checkout_id: "ck-paid" } as never,
          // Recorded by the caterer (not bought in Catera): not a Catera payment.
          subscription({ id: "s-imported", snapshot: { offer: offer({ name: "Paket Catatan" }), total: 0 } as never }),
        ],
      },
      {
        actions: [
          {
            id: "payment-ck-2",
            kind: "payment_action",
            status: "awaiting_payment",
            priority: 1,
            dueAt: `${TODAY}T10:00:00Z`,
            packageName: "Makan Malam Sehat",
            catererName: "Dapur Contoh",
            href: "/payment/ck-2",
          },
          {
            id: "menu-x",
            kind: "menu_choice_due",
            status: "selection_due",
            priority: 1,
            href: "/subscriptions/s-1/menu",
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Makan Malam Sehat")).toBeTruthy();
    expect(screen.getByText(/Menunggu pembayaran/)).toBeTruthy();
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText(/150\.000/)).toBeTruthy();
    expect(screen.queryByText("Paket Catatan")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Bayar Makan Malam Sehat" }));
    expect(router.push).toHaveBeenCalledWith("/bayar/ck-2");
  });

  it("never asks to pay for a payment that is being checked or was received", async () => {
    const item = (id: string, status: CustomerActionItem["status"], packageName: string): CustomerActionItem => ({
      id: `payment-${id}`,
      kind: "payment_action",
      status,
      priority: status === "payment_exception" ? 0 : 1,
      packageName,
      catererName: "Dapur Contoh",
      href: `/payment/${id}`,
    });
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        actions: [
          item("ck-1", "choose_method", "Paket Pilih Metode"),
          item("ck-2", "awaiting_payment", "Paket Menunggu"),
          item("ck-3", "checking_payment", "Paket Dicek"),
          item("ck-4", "payment_exception", "Paket Ditinjau"),
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Belum dibayar")).toBeTruthy();
    expect(screen.getByText("Sedang diproses")).toBeTruthy();
    // Only the two unpaid checkouts offer Bayar.
    const pay = screen.getAllByRole("button", { name: /^Bayar / });
    expect(pay.map((b) => b.props.accessibilityLabel)).toEqual(["Bayar Paket Pilih Metode", "Bayar Paket Menunggu"]);
    expect(screen.getByText(/Pembayaran sedang dicek/)).toBeTruthy();
    expect(screen.getByText(/Pembayaran diterima, pemesanan sedang ditinjau Catera/)).toBeTruthy();
    expect(screen.getByText(/Jangan bayar lagi/)).toBeTruthy();
    fireEvent.press(screen.getByText("Paket Dicek"));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Paket Ditinjau"));
    expect(router.push).toHaveBeenCalledWith("/bantuan?checkoutId=ck-4");
    fireEvent.press(pay[0]);
    expect(router.push).toHaveBeenLastCalledWith("/bayar/ck-1");
  });

  it("keeps an expired checkout as Kedaluwarsa with Bayar lagi, the way Bayar pays again", async () => {
    const ended = (id: string, packageName: string, payAgain: CustomerActionItem["payAgain"]): CustomerActionItem => ({
      id: `payment-${id}`,
      kind: "payment_action",
      status: "expired",
      priority: 1,
      dueAt: `${TODAY}T02:00:00Z`,
      packageName,
      catererName: "Dapur Contoh",
      href: `/payment/${id}`,
      payAgain,
    });
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        ended: [
          ended("ck-5", "Paket Habis", { packageId: "p-rumahan", trial: false, portions: 2, cycles: 1, addressId: "a-1" }),
          ended("ck-6", "Paket Perpanjang", {
            packageId: "p-rumahan",
            renewedFrom: "s-1",
            trial: false,
            portions: 1,
            cycles: 2,
            addressId: "a-2",
          }),
          {
            ...ended("ck-7", "Paket Coba", { packageId: "p-coba", trial: true, portions: 1, cycles: 1, addressId: "a-1" }),
            paymentFailed: true,
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Kedaluwarsa")).toBeTruthy();
    expect(screen.queryByText("Belum dibayar")).toBeNull();
    expect(screen.queryByText("Belum ada pembayaran.")).toBeNull();
    expect(screen.getAllByText(/Waktu pembayaran habis/)).toHaveLength(2);
    // A failed payment says so, with the same Bayar lagi.
    expect(screen.getByText("Pembayaran gagal · Dapur Contoh")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Bayar Paket/ })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Habis" }));
    expect(router.push).toHaveBeenLastCalledWith("/beli/p-rumahan?portions=2&cycles=1&addressId=a-1");
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Perpanjang" }));
    expect(router.push).toHaveBeenLastCalledWith("/renew/s-1?portions=1&cycles=2&addressId=a-2");
    fireEvent.press(screen.getByRole("button", { name: "Bayar lagi Paket Coba" }));
    expect(router.push).toHaveBeenLastCalledWith("/beli/p-coba?trial=1&portions=1&addressId=a-1");
  });

  it("an ended checkout the bank may still confirm is in progress, never paid again", async () => {
    const runtime = runtimeWith(
      { subscriptions: [] },
      {
        ended: [
          {
            id: "payment-ck-8",
            kind: "payment_action",
            status: "checking_payment",
            priority: 1,
            packageName: "Paket Telat",
            catererName: "Dapur Contoh",
            href: "/payment/ck-8",
            payAgain: { packageId: "p-rumahan", trial: false, portions: 1, cycles: 1 },
          },
        ],
      },
    );
    renderWith(runtime, <Payments />);
    expect(await screen.findByText("Sedang diproses")).toBeTruthy();
    expect(screen.getByText(/Pembayaran sedang dicek/)).toBeTruthy();
    expect(screen.queryByText("Kedaluwarsa")).toBeNull();
    expect(screen.queryByRole("button", { name: /Bayar/ })).toBeNull();
  });

  it("explains an empty history", async () => {
    renderWith(runtimeWith({ subscriptions: [] }), <Payments />);
    expect(await screen.findByText("Belum ada pembayaran.")).toBeTruthy();
  });
});

describe("Beranda: Pilih menu", () => {
  // The next Monday after today, in Jakarta dates.
  const monday = (() => {
    let d = addDays(TODAY, 1);
    while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1);
    return d;
  })();
  const due: CustomerActionItem = {
    id: "menu-d-9-lunch",
    kind: "menu_choice_due",
    status: "selection_due",
    priority: 1,
    dueAt: `${addDays(monday, -1)}T10:00:00Z`,
    serviceDate: monday,
    meal: "lunch",
    packageName: "Makan Siang Rumahan",
    catererName: "Dapur Contoh",
    href: `/subscriptions/s-1/menu?date=${monday}&meal=lunch`,
  };

  it("pilih menu appears only when a selection is due", async () => {
    const runtime = runtimeWith({}, { actions: [due] });
    renderWith(runtime, <Beranda />);
    // One due day reads with its date ("Pilih menu Senin 12 Okt"); the action word opens it.
    fireEvent.press(await screen.findByText(/^Pilih menu Senin \d+ Okt$/));
    expect(router.push).toHaveBeenCalledWith(`/pilih-menu/s-1?date=${monday}&meal=lunch`);
  });

  it("shows no menu row without a selection due", async () => {
    const runtime = runtimeWith(
      {},
      { actions: [{ ...due, id: "payment-ck-9", kind: "payment_action", status: "awaiting_payment", href: "/payment/ck-9" }] },
    );
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    await waitFor(() => expect(runtime.api.customerActions).toHaveBeenCalled());
    expect(screen.queryByText(/Pilih menu/)).toBeNull();
  });

  it("still shows Beranda when the action feed fails", async () => {
    const runtime = runtimeWith({});
    (runtime.api.customerActions as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    expect(screen.queryByText(/Pilih menu/)).toBeNull();
  });
});

describe("Akun mood header", () => {
  const MALAM_NOW = () => new Date("2026-10-09T08:00:00Z");
  const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z");
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
  const renderMood = (runtime: MobileRuntime, now = MALAM_NOW, screenUnderTest: React.ReactElement = <Akun />) =>
    render(
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          {screenUnderTest}
        </MobileProvider>
      </MoodProvider>,
    );

  it("opens with the name on the Malam header fill, with no toggle", async () => {
    renderMood(runtimeWith({}, { phone: "6281234567890" }));
    const header = await screen.findByTestId("akun-header");
    expect(flat(within(header).getByTestId("mood-fill-malam", { includeHiddenElements: true })).backgroundColor).toBe(
      nativeMood.light.malam.header,
    );
    expect(nativeMood.light.malam.header).toBe("#F3F6EF");
    const name = within(header).getByText("Rani Contoh");
    expect(name.props.accessibilityRole).toBe("header");
    expect(flat(name).color).toBe("#2E2E2E");
    expect(await within(header).findByText("0812-3456-7890")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    // The tiles below stay on the page, outside the header.
    expect(within(header).queryByTestId("akun-tiles")).toBeNull();
    expect(screen.getByTestId("akun-tiles")).toBeTruthy();
  });

  it("keeps the Siang header fill before 15.00", async () => {
    renderMood(runtimeWith({}), SIANG_NOW);
    const header = await screen.findByTestId("akun-header");
    expect(flat(within(header).getByTestId("mood-fill-siang")).backgroundColor).toBe(nativeMood.light.siang.header);
    expect(flat(within(header).getByText("Rani Contoh")).color).toBe(nativeMood.light.siang.headerText);
  });

  it("a pushed screen signed out keeps its plain title: the Stack header above it is the only header", async () => {
    renderMood(runtimeWith({}, { actor: null }), MALAM_NOW, <Addresses />);
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryByTestId("signin-header")).toBeNull();
    expect(screen.queryByTestId("mood-fill-siang", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText("Alamat")).toBeTruthy();
    expect(screen.getByText("Masuk dulu untuk melihat paket dan jadwal pengantaranmu.")).toBeTruthy();
  });

  it("signed out keeps a header too, so the status icons never fall on the cream page", async () => {
    renderMood(runtimeWith({}, { actor: null }));
    const header = await screen.findByTestId("akun-header");
    expect(within(header).getByText("Akun")).toBeTruthy();
    expect(flat(within(header).getByText("Akun")).color).toBe("#2E2E2E");
    // The settings gear is gone: Pengaturan is its row below the sign-in button.
    expect(within(header).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Masuk" })).toBeTruthy();
  });
});

describe("customerLink is the one mapper for every old href", () => {
  it.each([
    ["/#packages", "/jelajah"],
    ["/#how-it-works", "/jelajah"],
    ["/?view=list#how-it-works", "/jelajah"],
    ["/discover", "/jelajah"],
    ["/packages/p-1", "/paket/p-1"],
    ["/package/p-1", "/paket/p-1"],
    ["/payment/ck-1", "/bayar/ck-1"],
    ["/checkout/p-1?renewedFrom=s-1", "/checkout/p-1?renewedFrom=s-1"],
    ["/subscriptions/s-1", "/subscriptions/s-1"],
    ["/subscriptions/s-1/menu?date=2026-11-02&meal=lunch", "/pilih-menu/s-1?date=2026-11-02&meal=lunch"],
    ["/support?checkoutId=ck-1", "/bantuan?checkoutId=ck-1"],
    ["/calendar", "/jadwal"],
    ["/saved", "/disimpan"],
    ["/addresses", "/alamat"],
    ["/account", "/akun"],
    ["/notifications", "/notifications"],
    ["/masalah/d-1?meal=lunch", "/masalah/d-1?meal=lunch"],
    ["/beli/p-1?portions=2", "/beli/p-1?portions=2"],
    ["/messages", "/"],
    ["/seller/today", "/"],
    ["https://evil.example/x", "/"],
  ])("%s → %s", (href, route) => {
    expect(customerLink(href)).toBe(route);
  });
});


describe("Secondary reads keep their copy or offer a retry", () => {
  const failing = () => {
    const runtime = runtimeWith({});
    (runtime.api.customerActions as jest.Mock).mockRejectedValueOnce(new Error("REQUEST_TIMEOUT"));
    return runtime;
  };

  it("Beranda: a failed action feed shows a retry for Perlu kamu urus only, and the retry reads it again", async () => {
    const runtime = failing();
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    expect(await screen.findByText(/^Belum bisa memuat menu yang perlu dipilih/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(runtime.api.customerActions).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/^Belum bisa memuat menu yang perlu dipilih/)).toBeNull());
  });

  it("Beranda: an action feed that loaded keeps its place when a later read fails", async () => {
    const runtime = runtimeWith({});
    renderWith(runtime, <Beranda />);
    expect(await screen.findByText(/^Siang ini,/)).toBeTruthy();
    await waitFor(() => expect(runtime.api.customerActions).toHaveBeenCalled());
    expect(screen.queryByText(/^Belum bisa memuat menu yang perlu dipilih/)).toBeNull();
  });

  it("Perlu kamu urus: a failed action feed shows the same retry", async () => {
    const runtime = failing();
    renderWith(runtime, <PerluDiurus />);
    expect(await screen.findByText(/^Belum bisa memuat menu yang perlu dipilih/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(runtime.api.customerActions).toHaveBeenCalledTimes(2));
  });

  it("Akun: a failed customer read offers a retry under the tiles, and the tiles stay", async () => {
    const runtime = runtimeWith({}, { phone: "6281234567890" });
    (runtime.api.customer as jest.Mock).mockRejectedValueOnce(new Error("REQUEST_TIMEOUT"));
    renderWith(runtime, <Akun />);
    expect(await screen.findByText(/^Belum bisa memuat jumlah paket dan alamat/)).toBeTruthy();
    expect(screen.getByTestId("akun-tile-paket")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(screen.queryByText(/^Belum bisa memuat jumlah paket/)).toBeNull());
    expect(runtime.api.customer).toHaveBeenCalledTimes(2);
  });
});

describe("Simpan alamat says what is missing", () => {
  it("hints the street length and names the missing fields while the button is off, then goes quiet", async () => {
    const runtime = runtimeWith({ addresses: [] });
    renderWith(runtime, withForm);
    fireEvent.press(await screen.findByRole("button", { name: "Tambah alamat" }));
    expect(screen.getByRole("button", { name: "Simpan alamat" })).toBeDisabled();
    expect(screen.getByText("Isi dulu: jalan.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Label alamat"), "");
    fireEvent.changeText(screen.getByLabelText("Kota"), "");
    expect(screen.getByText("Isi dulu: label, jalan, kota.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. A");
    expect(screen.getByText("Isi dulu: label, kota.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl");
    expect(screen.getByText("Tulis jalan dan nomornya, minimal 5 huruf.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. Melati No. 9");
    fireEvent.changeText(screen.getByLabelText("Label alamat"), "Rumah");
    fireEvent.changeText(screen.getByLabelText("Kota"), "Jakarta");
    expect(screen.queryByText(/^Isi dulu:/)).toBeNull();
    expect(screen.queryByText(/minimal 5 huruf/)).toBeNull();
    expect(screen.getByRole("button", { name: "Simpan alamat" })).not.toBeDisabled();
  });
});
