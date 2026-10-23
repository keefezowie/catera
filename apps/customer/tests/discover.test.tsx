import * as ReactNative from "react-native";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { currency, shortDate, startDates, type Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood, nativeThemes } from "@catera/design-tokens";
import Ionicons from "@expo/vector-icons/Ionicons";
import { androidTabBarHeight, DEMO_STRIP_HEIGHT, FadeSwap, fonts, LayoutScaleProvider, MoodProvider, ThemeProvider, useMood } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { topTags } from "../src/discover/categories";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { SavedList } from "../src/discover/SavedList";
import { AreaSheet } from "../src/discover/area";
import { BODY_GAP } from "../src/discover/ChipRow";
import { offer } from "./fixtures";
import { SheetHost } from "./sheetHost";

/** The phone the screen is drawn on; a test sets it to try another width or text size. */
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
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const cheap = offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000, trialPrice: 20000, trialMax: 1 });
const pricey = offer({ id: "p-mahal", name: "Menu Sehat Premium", caterer: "Dapur Sehat", price: 45000 });
const dinner = offer({ id: "p-malam", name: "Makan Malam Nabati", meal: "dinner", price: 28000 });

function runtimeWith(actor: Record<string, unknown> | null = customer, over: Record<string, unknown> = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    catalog: jest.fn(async () => ({ items: [cheap, pricey, dinner], nextCursor: null })),
    offer: jest.fn(async (id: string) => ({ offer: [cheap, pricey, dinner].find((o) => o.id === id) ?? null })),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
    ...over,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** A saved-packages server that remembers what the command wrote, like the real one. */
function savedServer(initial: string[] = [], fail = false) {
  const ids = new Set(initial);
  const all = [cheap, pricey, dinner];
  return {
    savedPackages: jest.fn(async () => ({
      packageIds: [...ids],
      items: [...ids].map((id) => ({
        packageId: id,
        savedAt: "2026-10-01T00:00:00Z",
        summary: {},
        offer: all.find((o) => o.id === id) ?? null,
      })),
      nextCursor: null,
    })),
    command: jest.fn(async (_action: string, payload: { packageId: string; saved: boolean }) => {
      if (fail) throw new Error("REQUEST_FAILED");
      if (payload.saved) ids.add(payload.packageId);
      else ids.delete(payload.packageId);
      return payload;
    }),
  };
}

const SIANG_NOW = () => new Date("2026-10-09T07:59:00Z"); // 14:59 WIB
const MALAM_NOW = () => new Date("2026-10-09T08:00:00Z"); // 15:00 WIB

// The mood is part of what Jelajah shows (the meal segment is the mood toggle), so every screen here has a provider
// that opens in Siang, like the app does before 15:00.
const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MoodProvider now={SIANG_NOW}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        {ui}
      </MobileProvider>
    </MoodProvider>,
  );

/** The area choice is a sheet route (`/area`): the host shows it over Jelajah when the area line pushes it. */
const AREA = { "/area": AreaSheet };
const toParams = (params: Record<string, string>) => void (mockParams = params);
const jelajahWithArea = (
  <>
    <Jelajah />
    <SheetHost routes={AREA} onParams={toParams} />
  </>
);

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

/** The grid's gaps as the Jelajah list sets them: the columns' gap on a row, the row gap as the separator's height. */
const gridGaps = () => {
  const list = screen.UNSAFE_getByType(FlatList);
  const separator = list.props.ItemSeparatorComponent() as { props: { style: unknown } };
  return {
    columnGap: flat({ props: { style: list.props.columnWrapperStyle } }).columnGap,
    rowGap: flat(separator).height,
    numColumns: list.props.numColumns,
  };
};

const lastCatalogQuery = (runtime: MobileRuntime) =>
  String((runtime.api.catalog as jest.Mock).mock.calls.at(-1)![0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("Jelajah", () => {
  it("keeps the filter chips in one scrolling row", async () => {
    const view = wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    const row = view.UNSAFE_getAllByType(ScrollView).find((r) => r.props.horizontal);
    expect(row).toBeTruthy();
    expect(row!.props.showsHorizontalScrollIndicator).toBe(false);
    expect(screen.getByRole("button", { name: "Bisa coba 1 hari" })).toBeTruthy();
  });

  it("chips filter by budget", async () => {
    const runtime = runtimeWith();
    wrap(runtime, <Jelajah />);
    expect(await screen.findByText("Menu Sehat Premium")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Di bawah Rp30.000" }));
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Di bawah Rp30.000" }).props.accessibilityState.selected).toBe(true);
    // The dinner package is under 30.000 too, but the list is on Siang.
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
  });

  it("the meal tabs switch between the two meals and a second press changes nothing", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
  });

  it("trial chip keeps only packages with a one-day trial", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.press(screen.getByRole("button", { name: "Bisa coba 1 hari" }));
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("coba 1 hari")).toBeTruthy();
  });

  it("toggling a chip never asks the server again or shows the spinner", async () => {
    const runtime = runtimeWith();
    const view = wrap(runtime, <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    const calls = (runtime.api.catalog as jest.Mock).mock.calls.length;
    for (const name of ["Siang", "Di bawah Rp30.000", "Bisa coba 1 hari", "Malam"]) {
      fireEvent.press(screen.getByRole(name === "Siang" || name === "Malam" ? "tab" : "button", { name }));
      expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(screen.queryByText("Nasi Ayam Bakar") || screen.queryByText("Belum ada paket yang cocok.")).toBeTruthy();
    }
    expect((runtime.api.catalog as jest.Mock).mock.calls.length).toBe(calls);
    expect(lastCatalogQuery(runtime)).toBe("?limit=100");
  });

  it("every control has a real 44 point target: the chips sit in a 44 tall row and the area and meal tabs are 44 tall", async () => {
    render(
      <LayoutScaleProvider value="v2">
        <MoodProvider now={SIANG_NOW}>
          <MobileProvider runtime={runtimeWith()} linkMapper={customerLink}>
            <Jelajah />
          </MobileProvider>
        </MoodProvider>
      </LayoutScaleProvider>,
    );
    await screen.findByText("Menu Sehat Premium");
    // A hitSlop never reaches past its parent, so the chip row's own content must be 44 tall for the chips' slop to count.
    // The row's own height is a real 44 (not shrunk by a negative margin), and so is its frame.
    const row = screen.getByTestId("chip-row");
    expect(flat(row)).toMatchObject({ height: 44, flexShrink: 0 });
    expect(flat(row).marginTop).toBeUndefined();
    expect(flat(row).marginVertical).toBeUndefined();
    expect(flat(screen.getByTestId("chip-row-frame"))).toMatchObject({ height: 44, flexShrink: 0 });
    expect(flat({ props: { style: row.props.contentContainerStyle } }).minHeight).toBeGreaterThanOrEqual(44);
    for (const name of ["Di bawah Rp30.000", "Bisa coba 1 hari"]) {
      const node = screen.getByRole("button", { name });
      expect(flat(node).minHeight).toBe(34);
      const slop = node.props.hitSlop as { top: number; bottom: number };
      expect(34 + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    }
    // The meal tabs and the area control are themselves 44 tall, with the 34 shape drawn inside.
    for (const name of ["Siang", "Malam"]) expect(flat(screen.getByRole("tab", { name })).minHeight).toBe(44);
    expect(flat(screen.getByRole("button", { name: "Pilih area pengantaran" })).minHeight).toBe(44);
    expect(flat(screen.getByTestId("area-chip")).minHeight).toBe(34);
  });

  it("filter chips and the other meal tab give a selection haptic, the chosen tab stays quiet", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole("button", { name: "Di bawah Rp30.000" }));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it("search narrows by name or caterer without another request", async () => {
    const runtime = runtimeWith();
    wrap(runtime, <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    const calls = (runtime.api.catalog as jest.Mock).mock.calls.length;
    fireEvent.changeText(screen.getByPlaceholderText("Cari menu atau katering…"), "sehat");
    await waitFor(() => expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull());
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect((runtime.api.catalog as jest.Mock).mock.calls.length).toBe(calls);
  });

  it("single-meal offer shows only / makan", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    // Two lunch packages on Siang; the dinner one shows on Malam.
    expect(screen.getAllByText("/ makan")).toHaveLength(2);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.getAllByText("/ makan")).toHaveLength(1);
    expect(screen.queryByText("2 kali makan / hari")).toBeNull();
  });

  it("combined offer shows its per-meal price on the tile; the 2 meals a day is on the package page", async () => {
    const both = offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", price: 60000 });
    wrap(runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [both], nextCursor: null })) }), <Jelajah />);
    await screen.findByText("Siang dan Malam");
    expect(screen.getByText("/ makan")).toBeTruthy();
    // The tile has no note line: name, caterer, price and meta only.
    expect(screen.queryByText("2 kali makan / hari")).toBeNull();
    expect(screen.getByText(currency(30000, "id"))).toBeTruthy();
    expect(screen.queryByText(/60\.000/)).toBeNull();
  });

  it("shows the caterer line without inventing a distance", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Nasi Ayam Bakar");
    expect(screen.getAllByText("Dapur Contoh").length).toBeGreaterThan(0);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it("shows a distance only when the catalog carries one", async () => {
    const runtime = runtimeWith(customer, {
      catalog: jest.fn(async () => ({ items: [{ ...cheap, distanceKm: 2.4 }], nextCursor: null })),
    });
    wrap(runtime, <Jelajah />);
    expect(await screen.findByText("Dapur Contoh, 2,4 km")).toBeTruthy();
  });

  it("remembers the delivery area in SecureStore and sends it to the catalog", async () => {
    const runtime = runtimeWith();
    wrap(runtime, jelajahWithArea);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.press(screen.getByRole("button", { name: "Pilih area pengantaran" }));
    // The area is a native choice sheet over Jelajah; a choice closes it.
    expect(router.push).toHaveBeenCalledWith("/area");
    fireEvent.press(await screen.findByRole("radio", { name: "Jakarta Selatan" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.area", "Jakarta Selatan"));
    await waitFor(() => expect(lastCatalogQuery(runtime)).toContain("area=Jakarta+Selatan"));
  });

  describe("area", () => {
    const selatan = { ...cheap, areas: ["Jakarta Selatan", "Jakarta Pusat"] };
    const bandung = { ...pricey, areas: ["Bandung"] };
    const both = { ...dinner, areas: ["Jakarta Selatan", "Bandung"] };
    const areaRuntime = () =>
      runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [selatan, bandung, both], nextCursor: null })) });
    const choose = async (name: string) => {
      fireEvent.press(screen.getByRole("button", { name: "Pilih area pengantaran" }));
      fireEvent.press(await screen.findByRole("radio", { name }));
    };

    it("shows only packages that deliver to the chosen area", async () => {
      const runtime = areaRuntime();
      wrap(runtime, jelajahWithArea);
      await screen.findByText("Menu Sehat Premium");
      await choose("Bandung");
      await waitFor(() => expect(lastCatalogQuery(runtime)).toContain("area=Bandung"));
      expect(await screen.findByText("Menu Sehat Premium")).toBeTruthy();
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      // The dinner package delivers to Bandung too; it shows once the list is on Malam.
      expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    });

    it("Semua area shows everything again", async () => {
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.area", "Bandung");
      wrap(areaRuntime(), jelajahWithArea);
      await screen.findByText("Menu Sehat Premium");
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      await choose("Semua area");
      expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    });

    it("says when no caterer delivers there, and Lihat semua area clears the area", async () => {
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.area", "Jakarta Utara");
      wrap(areaRuntime(), jelajahWithArea);
      expect(await screen.findByText("Belum ada katering yang antar ke Jakarta Utara.")).toBeTruthy();
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Lihat semua area" }));
      expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
      await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.area", ""));
      expect(screen.getByRole("button", { name: "Pilih area pengantaran" }).props.accessibilityValue).toEqual({
        text: "Belum dipilih",
      });
    });
  });

  it("opens a package when its card is pressed", async () => {
    wrap(runtimeWith(), <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: /^Nasi Ayam Bakar,/ }));
    expect(router.push).toHaveBeenCalledWith("/paket/p-murah?title=Nasi%20Ayam%20Bakar");
  });

  it("heart while signed out asks to sign in and comes back", async () => {
    const runtime = runtimeWith(null);
    wrap(runtime, <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(router.push).toHaveBeenCalledWith("/login?next=/jelajah");
    expect(runtime.api.command).not.toHaveBeenCalled();
  });

  it("heart while signed in saves the package and stays saved after the list reloads", async () => {
    const server = savedServer();
    const runtime = runtimeWith(customer, server);
    wrap(runtime, <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    await waitFor(() =>
      expect(server.command).toHaveBeenCalledWith("savedPackage.set", { packageId: "p-murah", saved: true }, expect.any(String)),
    );
    // The command refreshes saved packages; the heart must still be filled once that read lands.
    await waitFor(() => expect(server.savedPackages).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeNull();
  });

  it("heart goes back and says so when saving fails", async () => {
    const server = savedServer([], true);
    wrap(runtimeWith(customer, server), <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(await screen.findByText("Belum tersimpan. Coba lagi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" })).toBeNull();
  });

  it("an already saved package shows a filled heart and un-saving survives the reload", async () => {
    const server = savedServer(["p-murah"]);
    wrap(runtimeWith(customer, server), <Jelajah />);
    fireEvent.press(await screen.findByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }));
    await waitFor(() => expect(server.savedPackages).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Simpan Nasi Ayam Bakar" })).toBeTruthy();
  });

  it("says plainly that there are no packages when the catalogue is empty, with no meal to switch to", async () => {
    const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [], nextCursor: null })) });
    wrap(runtime, <Jelajah />);
    expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
    expect(screen.queryByText(/Belum ada paket makan/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Lihat makan malam" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hapus pilihan" })).toBeNull();
  });

  it("says so when a search matches nothing, with Hapus pilihan", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.changeText(screen.getByPlaceholderText("Cari menu atau katering…"), "tidak ada");
    expect(await screen.findByText("Belum ada paket yang cocok.")).toBeTruthy();
    expect(screen.getByText("Coba kata kunci atau pilihan lain.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Hapus pilihan" }));
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
  });

  describe("a meal with no packages", () => {
    const lunchOnly = () =>
      runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [cheap, pricey], nextCursor: null })) });

    it("on a Malam launch names the meal and switches to the other one", async () => {
      render(
        <MoodProvider now={MALAM_NOW}>
          <MobileProvider runtime={lunchOnly()} linkMapper={customerLink}>
            <Jelajah />
          </MobileProvider>
        </MoodProvider>,
      );
      expect(await screen.findByText("Belum ada paket makan malam.")).toBeTruthy();
      expect(screen.queryByText("Belum ada paket yang cocok.")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Lihat makan siang" }));
      expect(await screen.findByText("Menu Sehat Premium")).toBeTruthy();
      expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(true);
      expect(screen.queryByRole("button", { name: "Lihat makan siang" })).toBeNull();
    });

    it("names the area when one is chosen", async () => {
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.area", "Tebet");
      render(
        <MoodProvider now={MALAM_NOW}>
          <MobileProvider runtime={lunchOnly()} linkMapper={customerLink}>
            <Jelajah />
          </MobileProvider>
        </MoodProvider>,
      );
      expect(await screen.findByText("Belum ada paket makan malam di Tebet.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Lihat makan siang" })).toBeTruthy();
    });

    it("goes the other way from Siang when only dinner is on offer", async () => {
      const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [dinner], nextCursor: null })) });
      wrap(runtime, <Jelajah />);
      expect(await screen.findByText("Belum ada paket makan siang.")).toBeTruthy();
      expect(screen.queryByText("Belum ada paket.")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Lihat makan malam" }));
      expect(await screen.findByText("Makan Malam Nabati")).toBeTruthy();
    });
  });
});

describe("Jelajah list root", () => {
  it("the two column grid is the scroll root: one FlatList, no outer ScrollView", async () => {
    const view = wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    const lists = view.UNSAFE_getAllByType(FlatList);
    expect(lists).toHaveLength(1);
    expect(lists[0].props.numColumns).toBe(2);
    expect(lists[0].props.contentInsetAdjustmentBehavior).toBeDefined();
    expect(lists[0].props.keyboardShouldPersistTaps).toBe("handled");
    expect(screen.getAllByTestId("package-cell")).toHaveLength(2);
  });

  it("keeps the header, the search and the chips above the grid, and the loading skeleton before it", async () => {
    const runtime = runtimeWith(customer, { catalog: jest.fn(() => new Promise(() => undefined)) });
    wrap(runtime, <Jelajah />);
    expect(await screen.findByTestId("jelajah-skeleton")).toBeTruthy();
    expect(screen.getByTestId("jelajah-title")).toBeTruthy();
    expect(screen.getByTestId("jelajah-search")).toBeTruthy();
    expect(screen.queryByTestId("package-cell")).toBeNull();
  });

  it("the tiles come in with the chips as one block, only when the read finishes", async () => {
    let release: (v: unknown) => void = () => undefined;
    const runtime = runtimeWith(customer, { catalog: jest.fn(() => new Promise((r) => (release = r))) });
    wrap(runtime, <Jelajah />);
    await screen.findByTestId("jelajah-skeleton");
    await waitFor(() => expect(runtime.api.catalog).toHaveBeenCalled());
    await act(async () => release({ items: [cheap, pricey], nextCursor: null }));
    const cells = await screen.findAllByTestId("package-cell");
    for (const cell of cells) expect(cell.props.entering).toBeDefined();
    // A search later adds and removes tiles without any entrance.
    fireEvent.changeText(screen.getByLabelText("Cari paket"), "Nasi");
    for (const cell of screen.getAllByTestId("package-cell")) expect(cell.props.entering).toBeUndefined();
  });

  it("the empty block comes in with the chips when the read finishes", async () => {
    let release: (v: unknown) => void = () => undefined;
    const runtime = runtimeWith(customer, { catalog: jest.fn(() => new Promise((r) => (release = r))) });
    wrap(runtime, <Jelajah />);
    await screen.findByTestId("jelajah-skeleton");
    await waitFor(() => expect(runtime.api.catalog).toHaveBeenCalled());
    await act(async () => release({ items: [], nextCursor: null }));
    let node = screen.getByText("Belum ada paket.").parent;
    while (node && node.props.entering === undefined && node.props.testID !== "jelajah-empty") node = node.parent;
    expect(node?.props.entering).toBeDefined();
  });

  it("the chip row answers the first tap while the search keyboard is up", async () => {
    const view = wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    const row = view.UNSAFE_getAllByType(ScrollView).find((r) => r.props.horizontal);
    expect(row!.props.keyboardShouldPersistTaps).toBe("handled");
  });
});

describe("topTags", () => {
  const tagged = (id: string, tags: string[]) => offer({ id, tags });

  it("returns the six most frequent tags, most frequent first", () => {
    const offers = [
      tagged("a", ["Sehat", "Rumahan", "Nabati", "Pedas", "Manis", "Gurih", "Asin"]),
      tagged("b", ["Sehat", "Rumahan", "Nabati", "Pedas", "Manis", "Gurih"]),
      tagged("c", ["Sehat", "Rumahan", "Nabati", "Pedas", "Manis"]),
      tagged("d", ["Sehat", "Rumahan", "Nabati", "Pedas"]),
      tagged("e", ["Sehat", "Rumahan", "Nabati"]),
      tagged("f", ["Sehat", "Rumahan"]),
      tagged("g", ["Sehat"]),
    ];
    expect(topTags(offers, 6)).toEqual(["Sehat", "Rumahan", "Nabati", "Pedas", "Manis", "Gurih"]);
  });

  it("drops the meal tags", () => {
    const offers = [
      tagged("a", ["Makan siang", "Makan malam", "Siang & Malam", "Sehat"]),
      tagged("b", ["makan siang", "Sehat"]),
    ];
    expect(topTags(offers, 6)).toEqual(["Sehat"]);
  });

  it("breaks ties alphabetically", () => {
    const offers = [tagged("a", ["Pedas", "Manis"]), tagged("b", ["Gurih", "Pedas", "Manis", "Asin"])];
    expect(topTags(offers, 6)).toEqual(["Manis", "Pedas", "Asin", "Gurih"]);
  });

  it("counts a tag once per offer and returns nothing when no offer has tags", () => {
    expect(topTags([tagged("a", ["Sehat", "Sehat"]), tagged("b", ["Pedas"])], 6)[0]).toBe("Pedas");
    expect(topTags([tagged("a", [])], 6)).toEqual([]);
    expect(topTags([], 6)).toEqual([]);
  });
});

describe("Jelajah mood header", () => {
  function mount(runtime: MobileRuntime, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    return render(
      <LayoutScaleProvider value="v2">
        <ThemeProvider storageKey="jelajah-mood-test">
          <MoodProvider now={now}>
            <MobileProvider runtime={runtime} linkMapper={customerLink}>
              <Jelajah />
            </MobileProvider>
          </MoodProvider>
        </ThemeProvider>
      </LayoutScaleProvider>,
    );
  }

  const header = () => within(screen.getByTestId("jelajah-header"));
  const title = () => screen.getByTestId("jelajah-title").props.children;
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

  const rumahan = { ...cheap, tags: ["Rumahan", "Sehat"], image: "https://images.example.test/a.jpg" };
  const sehat = { ...pricey, tags: ["Sehat"], image: "https://images.example.test/b.jpg" };
  const malam = { ...dinner, tags: ["Makan malam", "Rumahan"], image: "https://images.example.test/c.jpg" };
  const taggedRuntime = () =>
    runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [rumahan, sehat, malam], nextCursor: null })) });

  afterEach(() => jest.restoreAllMocks());

  it("shows the area chip, the heart, the one-line title and the 44 point search pill in the header", async () => {
    mount(runtimeWith());
    await screen.findByText("Menu Sehat Premium");
    expect(header().getByRole("button", { name: "Pilih area pengantaran" })).toBeTruthy();
    expect(header().getByText("Pilih area")).toBeTruthy();
    expect(flat(screen.getByTestId("jelajah-title"))).toMatchObject({ fontSize: 24, lineHeight: 30 });
    expect(flat(header().getByRole("button", { name: "Paket disimpan" }))).toMatchObject({ width: 44, height: 44 });
    expect(flat(screen.getByTestId("jelajah-search"))).toMatchObject({ minHeight: 44 });
    expect(title()).toBe("Makan siang minggu depan?");
    expect(header().getByPlaceholderText("Cari menu atau katering…")).toBeTruthy();
    expect(header().getByRole("button", { name: "Paket disimpan" })).toBeTruthy();
  });

  it("names the Malam meal in the title when the mood is Malam", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    expect(title()).toBe("Makan malam minggu depan?");
  });

  it("has no 60 point meal buttons in the header: Siang and Malam are a 34 point segment that is the mood and the meal filter", async () => {
    mount(runtimeWith());
    await screen.findByText("Menu Sehat Premium");
    expect(title()).toBe("Makan siang minggu depan?");
    expect(header().queryByRole("tab")).toBeNull();
    const segment = screen.getByTestId("meal-segment");
    expect(segment.props.accessibilityRole).toBe("tablist");
    expect(segment.props.accessibilityLabel).toBe("Waktu makan");
    // A 44 row holding the 34 surface track, whose two pills are 30 tall (a 2 inset).
    expect(flat(segment).height).toBe(44);
    expect(flat(screen.getByTestId("meal-track"))).toMatchObject({ height: 34, borderRadius: 17 });
    // The track is centred in the 44 row by its own wrapper, not pinned to the top.
    expect(flat(screen.getByTestId("meal-track-frame"))).toMatchObject({ justifyContent: "center", top: 0, bottom: 0 });
    // Each tab is named from its label alone, with no empty part and no stray comma.
    expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityLabel).toBe("Siang");
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityLabel).toBe("Malam");
    for (const name of ["Siang", "Malam"]) {
      expect(within(segment).getByRole("tab", { name })).toBeTruthy();
      expect(flat(screen.getByRole("tab", { name })).minHeight).toBe(44);
    }
    expect(flat(screen.getByTestId("meal-pill-siang")).height).toBe(30);
    expect(flat(screen.getByTestId("meal-pill-malam")).height).toBe(30);
    expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(false);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    // The list keeps dinner and combined packages only, and the title follows.
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
    expect(title()).toBe("Makan malam minggu depan?");
    fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
    expect(title()).toBe("Makan siang minggu depan?");
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
  });

  it("puts the meal segment first in the one chip row, then the filter chips, then the categories", async () => {
    mount(taggedRuntime());
    await screen.findByText("Menu Sehat Premium");
    const row = screen.getByTestId("chip-row");
    expect(row.props.horizontal).toBe(true);
    // It starts at the margin and runs to the right edge: a negative right margin on the frame, a matching content padding.
    expect(flat(screen.getByTestId("chip-row-frame"))).toMatchObject({ marginRight: -16 });
    expect(flat({ props: { style: row.props.contentContainerStyle } })).toMatchObject({ paddingRight: 16, gap: 8 });
    // The segment's own two tabs are tabs, not buttons; the buttons after it are the filters, then the categories.
    expect(within(row).getByTestId("meal-segment")).toBeTruthy();
    const names = within(row)
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel ?? within(b).getByText(/./).props.children);
    expect(names).toEqual(["Di bawah Rp30.000", "Bisa coba 1 hari", "Kategori Sehat", "Kategori Rumahan"]);
    // The segment leads the row: it comes before the first filter chip in the tree.
    const order: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== "object") {
        if (typeof node === "string") order.push(node);
        return;
      }
      const n = node as { props?: { testID?: string }; children?: unknown[] };
      if (n.props?.testID) order.push(n.props.testID);
      n.children?.forEach(walk);
    };
    walk(screen.toJSON());
    expect(order.indexOf("meal-segment")).toBeGreaterThan(order.indexOf("chip-row"));
    expect(order.indexOf("meal-segment")).toBeLessThan(order.indexOf("Di bawah Rp30.000"));
  });

  it("opens on Malam with the Malam tab selected and the lunch packages hidden", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
  });

  it("follows a mood change made outside Jelajah, in the selection, the title and the list", async () => {
    let setMoodOutside: (mood: "siang" | "malam") => void = () => {};
    function Probe() {
      setMoodOutside = useMood().setMood;
      return null;
    }
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    render(
      <ThemeProvider storageKey="jelajah-probe-test">
        <MoodProvider now={SIANG_NOW}>
          <Probe />
          <MobileProvider runtime={runtimeWith()} linkMapper={customerLink}>
            <Jelajah />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
    await screen.findByText("Menu Sehat Premium");
    act(() => setMoodOutside("malam"));
    expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
    expect(title()).toBe("Makan malam minggu depan?");
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    act(() => setMoodOutside("siang"));
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
  });

  it("keeps a combined package under the Malam tab", async () => {
    const both = offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", price: 60000 });
    const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [both, cheap, dinner], nextCursor: null })) });
    mount(runtime);
    await screen.findByText("Siang dan Malam");
    expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.getByText("Siang dan Malam")).toBeTruthy();
    expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
  });

  it("no longer carries Siang and Malam as filter chips, and keeps the budget and trial chips", async () => {
    mount(runtimeWith());
    await screen.findByText("Menu Sehat Premium");
    expect(screen.queryByRole("button", { name: "Siang" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Malam" })).toBeNull();
    expect(screen.getAllByRole("tab", { name: "Siang" })).toHaveLength(1);
    expect(screen.getAllByRole("tab", { name: "Malam" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Di bawah Rp30.000" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bisa coba 1 hari" })).toBeTruthy();
    expect(within(screen.getByTestId("jelajah-header")).queryByRole("button", { name: "Bisa coba 1 hari" })).toBeNull();
    expect(within(screen.getByTestId("jelajah-header")).queryByRole("tab")).toBeNull();
  });

  it("draws the header on the canvas: no mood band, no rounded panel, ink and surface from the theme", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    const colors = nativeThemes.light;
    expect(screen.queryByTestId("mood-fill-siang", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("jelajah-header").props.style).toEqual({ paddingTop: 8 });
    expect(flat(screen.getByTestId("jelajah-title")).color).toBe(colors.charcoal);
    expect(flat(header().getByPlaceholderText("Cari menu atau katering…")).color).toBe(colors.charcoal);
    // A tone step on the canvas, no borders; the heart is a bare glyph on a 44 target.
    expect(flat(screen.getByTestId("jelajah-search"))).toMatchObject({ backgroundColor: colors.inputFill });
    expect(flat(screen.getByTestId("jelajah-search")).borderWidth).toBeUndefined();
    expect(flat(screen.getByTestId("area-chip")).borderWidth).toBeUndefined();
    const heart = flat(header().getByRole("button", { name: "Paket disimpan" }));
    expect(heart.backgroundColor).toBeUndefined();
    expect(heart.borderWidth).toBeUndefined();
    // The status band behind the bar is the canvas, not a mood tint.
    expect(screen.getByTestId("status-band-canvas", { includeHiddenElements: true })).toBeTruthy();
    expect(flat(screen.getByTestId("status-band-canvas", { includeHiddenElements: true })).backgroundColor).toBe(colors.canvas);
  });

  it("draws the selected meal with a 1.5 forest ring, a 700 forest label and its glyph, and the idle one with a 500 label and no ring", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    const selected = screen.getByTestId("meal-pill-malam");
    const idle = screen.getByTestId("meal-pill-siang");
    expect(flat(selected)).toMatchObject({ borderWidth: 1.5, borderColor: nativeThemes.light.forest });
    expect(flat(within(selected).getByText("Malam"))).toMatchObject({ color: nativeThemes.light.forest, fontFamily: "Jakarta-Bold" });
    expect(flat(idle).borderColor).toBe("transparent");
    expect(flat(within(idle).getByText("Siang")).color).not.toBe(nativeThemes.light.forest);
    expect(flat(within(idle).getByText("Siang")).fontFamily).toBe("Jakarta-Medium");
    // A sun before Siang and a moon before Malam.
    expect(within(selected).UNSAFE_getByType(Ionicons).props.name).toBe("moon");
    expect(within(idle).UNSAFE_getByType(Ionicons).props.name).toBe("sunny");
    // The track is the surface colour.
    expect(flat(screen.getByTestId("meal-track")).backgroundColor).toBe(nativeThemes.light.inputFill);
  });

  describe("category circles", () => {
    it("renders a 34 point chip per top tag, without the meal tags and with no photo ring", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.getByRole("button", { name: "Kategori Sehat" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Kategori Makan malam/ })).toBeNull();
      expect(screen.queryByTestId("photo-ring", { includeHiddenElements: true })).toBeNull();
      expect(flat(screen.getByRole("button", { name: "Kategori Sehat" })).minHeight).toBe(34);
    });

    it("filters by the tapped tag, marks it selected, and clears on a second tap", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole("button", { name: "Kategori Sehat" }).props.accessibilityState.selected).toBe(false);
      // The active tag is a selection, so its chip is forest (direction K rule 3); the others are not.
      expect(flat(screen.getByRole("button", { name: "Kategori Rumahan" })).backgroundColor).toBe(nativeThemes.light.forest);
      expect(flat(screen.getByRole("button", { name: "Kategori Sehat" })).backgroundColor).not.toBe(nativeThemes.light.forest);
      // The tag carries over to the other meal: the dinner package is tagged Rumahan too.
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" }).props.accessibilityState.selected).toBe(false);
    });

    it("moves to another tag directly and combines with the other filters", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      fireEvent.press(screen.getByRole("button", { name: "Kategori Sehat" }));
      expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
      expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Di bawah Rp30.000" }));
      expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
      expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
    });

    it("Hapus pilihan clears the tag and the chips but never the meal, which is the mood", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      // The dinner package has no one-day trial, so the list is empty and offers the way out.
      fireEvent.press(screen.getByRole("button", { name: "Bisa coba 1 hari" }));
      expect(screen.getByText("Belum ada paket yang cocok.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Hapus pilihan" }));
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" }).props.accessibilityState.selected).toBe(false);
      expect(screen.getByRole("button", { name: "Bisa coba 1 hari" }).props.accessibilityState.selected).toBe(false);
      expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
      expect(title()).toBe("Makan malam minggu depan?");
    });

    it("suspends a tag the other meal lacks and brings it back selected on the way back", async () => {
      const pedas = { ...pricey, id: "p-pedas", name: "Paket Pedas", tags: ["Pedas"], image: "https://images.example.test/d.jpg" };
      const runtime = runtimeWith(customer, {
        catalog: jest.fn(async () => ({ items: [rumahan, sehat, malam, pedas], nextCursor: null })),
      });
      mount(runtime);
      await screen.findByText("Paket Pedas");
      fireEvent.press(screen.getByRole("button", { name: "Kategori Sehat" }));
      expect(screen.queryByText("Paket Pedas")).toBeNull();
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      // Nothing on Malam carries Sehat: no circle, and the list is not filtered by it.
      expect(screen.queryByRole("button", { name: "Kategori Sehat" })).toBeNull();
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      expect(screen.getByRole("button", { name: "Kategori Sehat" }).props.accessibilityState.selected).toBe(true);
      expect(screen.queryByText("Paket Pedas")).toBeNull();
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    });

    it("only offers tags that the current meal has, so no circle leads to an empty list", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.getByRole("button", { name: "Kategori Sehat" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" })).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Kategori Sehat" }));
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      // Sehat has no dinner package: its circle goes, and with it the filter.
      expect(screen.queryByRole("button", { name: "Kategori Sehat" })).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" })).toBeTruthy();
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    });

    it("does not render the row when the catalogue has no tags", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.queryByRole("button", { name: /^Kategori / })).toBeNull();
    });

    it("keeps every category chip a 44 point target", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      const chip = screen.getByRole("button", { name: "Kategori Sehat" });
      const slop = chip.props.hitSlop;
      expect(flat(chip).minHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    });
  });

  describe("grid", () => {
    const cellOf = (name: string) => within(screen.getByRole("button", { name: new RegExp("^" + name + ",") }));

    it("lays the packages out as a two column grid with a 12 column gap and a 20 row gap", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      expect(gridGaps()).toEqual({ columnGap: 12, rowGap: 20, numColumns: 2 });
      // The two lunch packages; the dinner one waits behind the Malam tab. Two columns: a 40 percent basis that grows.
      const cells = screen.getAllByTestId("package-cell");
      expect(cells).toHaveLength(2);
      for (const cell of cells) expect(flat(cell)).toMatchObject({ flexBasis: "40%", flexGrow: 1, maxWidth: "50%" });
    });

    it("keeps a lone last tile one column wide, with a spacer beside it", async () => {
      mount(runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [cheap, pricey, { ...cheap, id: "p-3", name: "Paket Tiga" }], nextCursor: null })) }));
      await screen.findByText("Paket Tiga");
      expect(screen.getAllByTestId("package-cell")).toHaveLength(3);
      expect(screen.getAllByTestId("package-cell-spacer")).toHaveLength(1);
    });

    it("draws each tile with a 4:3 photo, radius 12, no border, and the heart a 44 point target", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      const photos = screen.getAllByTestId("package-photo");
      expect(photos).toHaveLength(2);
      expect(flat(photos[0])).toMatchObject({ aspectRatio: 4 / 3, borderRadius: 12 });
      expect(flat(photos[0]).height).toBeUndefined();
      const tile = screen.getAllByTestId("package-tile")[0];
      // No card behind a tile: no fill, no border.
      expect(tile.props.style).toBeUndefined();
      const heart = screen.getByRole("button", { name: "Simpan Nasi Ayam Bakar" });
      expect(flat(heart)).toMatchObject({ width: 44, height: 44 });
      expect(flat(within(heart).getByTestId("save-heart-disc"))).toMatchObject({ width: 32, height: 32 });
    });

    it("sets the name over two lines, the caterer on one, and the price with a short unit", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.getByText("Menu Sehat Premium").props.numberOfLines).toBe(2);
      // The tile names the caterer only: the delivery days and the meal are on the package page.
      const caterer = screen.getByText("Dapur Sehat");
      expect(caterer.props.numberOfLines).toBe(1);
      expect(screen.queryByText(/Sen–Jum/)).toBeNull();
      expect(screen.queryByText(/Mulai/)).toBeNull();
      expect(screen.getAllByText("/ makan")).toHaveLength(2);
      expect(flat(screen.getAllByText("/ makan")[0]).fontSize).toBe(13);
    });

    it("groups the name with the caterer, then the price with its meta, 8 apart and 2 inside each", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      const tile = within(screen.getAllByTestId("package-tile")[1]);
      expect(flat(tile.getByTestId("tile-body"))).toMatchObject({ gap: 8, paddingTop: 8 });
      const [who, cost] = tile.getAllByTestId("tile-group");
      expect(flat(who).gap).toBe(2);
      expect(flat(cost).gap).toBe(2);
      expect(within(who).getByText("Menu Sehat Premium")).toBeTruthy();
      expect(within(who).getByText("Dapur Sehat")).toBeTruthy();
      expect(within(cost).getByText("/ makan")).toBeTruthy();
    });

    it("always draws a meta line: calories and trial, calories alone, or the no-trial wording", async () => {
      const kcal = (o: typeof cheap, n: number) => ({ ...o, nutrition: { caloriesKcal: n } }) as typeof cheap;
      const both = { ...kcal(cheap, 610), id: "p-a", name: "Paket A" };
      const kcalOnly = { ...kcal(pricey, 480), id: "p-b", name: "Paket B" };
      const neither = { ...pricey, id: "p-c", name: "Paket C" };
      mount(runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [both, kcalOnly, neither], nextCursor: null })) }));
      await screen.findByText("Paket C");
      const metaOf = (name: string) => {
        const tile = within(screen.getAllByTestId("package-tile").find((t) => within(t).queryByText(name))!);
        return tile.getAllByTestId("tile-group")[1];
      };
      expect(within(metaOf("Paket A")).getByText("± 610 kkal · coba 1 hari")).toBeTruthy();
      expect(within(metaOf("Paket B")).getByText("± 480 kkal")).toBeTruthy();
      expect(within(metaOf("Paket C")).getByText("Belum bisa dicoba")).toBeTruthy();
      // The cost group is the price line and one meta line in all three, so tiles in a row keep one structure.
      for (const name of ["Paket A", "Paket B", "Paket C"]) expect(within(metaOf(name)).getAllByText(/./)).toHaveLength(3);
    });

    it("fits four tiles (two rows, even with two-line names) above the tab bar on a Pixel 8 in production", async () => {
      // The device, as the gate measured it: 412 x 915 dp, a 50 dp status inset, and the Android tab bar (80 plus the
      // 24 dp navigation inset) from y = 811. Demo builds add the 24 dp demo strip above everything.
      const DEVICE = { width: 412, height: 915, statusInset: 50, tabBar: androidTabBarHeight(1) + 24, demoStrip: DEMO_STRIP_HEIGHT };
      mockWindow = { width: DEVICE.width, height: DEVICE.height, scale: 2.625, fontScale: 1 };
      const offers = ["A", "B", "C", "D"].map((k) => ({ ...pricey, id: "p-" + k, name: "Paket " + k + " dengan nama yang sangat panjang sekali" }));
      mount(runtimeWith(customer, { catalog: jest.fn(async () => ({ items: offers, nextCursor: null })) }));
      await screen.findByText("Paket A dengan nama yang sangat panjang sekali");
      // Every number below is read from the rendered styles; a missing one fails the test instead of defaulting.
      const need = (node: { props: { style?: unknown } }, key: string): number => {
        const value = flat(node)[key];
        if (typeof value !== "number") throw new Error(`style ${key} is missing or not a number: ${String(value)}`);
        return value;
      };
      const byId = (id: string) => screen.getByTestId(id);

      // Header, top to bottom, under the status inset.
      const headerTop = need(byId("jelajah-header"), "paddingTop");
      const row = need(byId("mood-header-row"), "minHeight");
      const headerGap = need(byId("mood-header-content"), "gap");
      const title = need(byId("jelajah-title"), "lineHeight");
      const searchTop = need(byId("jelajah-search"), "marginTop");
      const search = need(byId("jelajah-search"), "minHeight");
      const headerBottom = headerTop + row + headerGap + title + headerGap + searchTop + search;
      expect(headerBottom).toBe(150); // 8 + 44 + 8 + 30 + 8 + 8 + 44

      // Body: its own top padding, then the chip frame, then the gap to the grid.
      const bodyTop = need(byId("jelajah-body"), "paddingTop");
      const margin = need(byId("jelajah-body"), "paddingHorizontal");
      const frame = byId("chip-row-frame");
      const chip = need(byId("meal-track"), "height");
      const frameTop = need(frame, "marginTop");
      const frameHeight = need(frame, "height");
      const frameBottom = need(frame, "marginBottom");
      // The chips are centred in the frame: this much frame sits above them.
      const above = (frameHeight - chip) / 2;
      // The chips are 12 under the search, and the grid 16 under the chips.
      expect(bodyTop + frameTop + above).toBe(12);
      const gridTop = headerBottom + bodyTop + frameTop + frameHeight + frameBottom + need(byId("jelajah-body"), "paddingBottom");
      expect(gridTop - (headerBottom + 12) - chip).toBe(16);

      // A tile: the photo from the column width, the body's padding and gap, the two groups.
      const { columnGap, rowGap } = gridGaps();
      const column = (DEVICE.width - 2 * margin - columnGap) / 2;
      const tile = within(screen.getAllByTestId("package-tile")[0]);
      const photo = column / need(tile.getByTestId("package-photo"), "aspectRatio");
      const body = tile.getByTestId("tile-body");
      const [who, cost] = tile.getAllByTestId("tile-group");
      const nameText = tile.getByText("Paket A dengan nama yang sangat panjang sekali");
      const lines = nameText.props.numberOfLines as number;
      expect(lines).toBe(2);
      const name = need(nameText, "lineHeight");
      const caterer = need(tile.getByText("Dapur Sehat"), "lineHeight");
      const price = need(tile.getByText(/^Rp/), "lineHeight");
      const meta = need(tile.getByText("Belum bisa dicoba"), "lineHeight");
      // The tile is four text lines at most (name up to 2, caterer, price, meta): no note line.
      expect(within(cost).getAllByText(/./)).toHaveLength(3);
      const tileHeight = (nameLines: number) =>
        photo + need(body, "paddingTop") + (name * nameLines + need(who, "gap") + caterer) + need(body, "gap") + (price + need(cost, "gap") + meta);
      const twoRows = (nameLines: number) => gridTop + tileHeight(nameLines) + rowGap + tileHeight(nameLines);

      const tabBarTop = DEVICE.height - DEVICE.tabBar;
      expect(tabBarTop).toBe(811);
      const production = (nameLines: number) => DEVICE.statusInset + twoRows(nameLines);
      // Production: two rows of two tiles fit above the tab bar with one-line and with two-line names.
      expect(production(1)).toBeLessThanOrEqual(tabBarTop);
      expect(production(lines)).toBeLessThanOrEqual(tabBarTop);
      // Demo mode adds the strip: one-line rows still fit (29 spare), two-line rows overrun by 15; recorded here and in the report.
      const demo = (nameLines: number) => DEVICE.demoStrip + production(nameLines);
      expect(tabBarTop - demo(1)).toBeGreaterThanOrEqual(0);
      expect({ production1: tabBarTop - production(1), production2: tabBarTop - production(lines), demo1: tabBarTop - demo(1), demo2: tabBarTop - demo(lines) }).toEqual({ production1: 53, production2: 9, demo1: 29, demo2: -15 });
    });

    it("keeps two columns on a 360dp phone at the default text size", async () => {
      mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1 };
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      for (const cell of screen.getAllByTestId("package-cell")) expect(flat(cell).flexBasis).toBe("40%");
    });

    it("falls back to one column on a 360dp phone at font scale 1.3, so names wrap whole words", async () => {
      mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      for (const cell of screen.getAllByTestId("package-cell")) expect(flat(cell)).toMatchObject({ flexBasis: "100%", flexGrow: 1 });
      expect(screen.queryByTestId("package-cell-spacer")).toBeNull();
    });

    it("keeps two columns at font scale 1.3 on a 411dp phone", async () => {
      mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1.3 };
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      for (const cell of screen.getAllByTestId("package-cell")) expect(flat(cell).flexBasis).toBe("40%");
    });
  });

  describe("states on a Malam header", () => {
    it("says so when nothing matches, in the page colours", async () => {
      const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [], nextCursor: null })) });
      mount(runtime, { now: MALAM_NOW });
      expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Lihat makan siang" })).toBeNull();
      expect(title()).toBe("Makan malam minggu depan?");
    });

    it("shows the error with a retry under the header", async () => {
      const catalog = jest.fn(async () => {
        throw new Error("REQUEST_FAILED");
      });
      mount(runtimeWith(customer, { catalog }), { now: MALAM_NOW });
      expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
      expect(title()).toBe("Makan malam minggu depan?");
      expect(header().getByPlaceholderText("Cari menu atau katering…")).toBeTruthy();
    });

    it("shows the header and the catalogue skeleton while the catalogue loads", async () => {
      const catalog = jest.fn(() => new Promise<never>(() => {}));
      const view = mount(runtimeWith(customer, { catalog }), { now: MALAM_NOW });
      await waitFor(() => expect(catalog).toHaveBeenCalled());
      // One wait for the whole data area: chips and tiles as one progress bar, and no spinner.
      expect(screen.getByTestId("jelajah-skeleton")).toBeTruthy();
      expect(screen.getByTestId("jelajah-skeleton-grid")).toBeTruthy();
      expect(screen.getAllByTestId("jelajah-skeleton-tile")).toHaveLength(4);
      // The meal control is already there, and it works: it is the mood, which needs no catalogue.
      expect(screen.getByTestId("meal-segment")).toBeTruthy();
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(screen.getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole("progressbar", { name: "Memuat paket" })).toBeTruthy();
      expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(title()).toBe("Makan malam minggu depan?");
    });
  });
});

describe("Paket", () => {
  it("package detail shows trial only when offered", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    expect(await screen.findByRole("button", { name: "Coba 1 hari" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Coba 1 hari" }));
    expect(router.push).toHaveBeenCalledWith("/beli/p-murah?trial=1");
    fireEvent.press(screen.getByRole("button", { name: "Pilih jadwal" }));
    expect(router.push).toHaveBeenCalledWith("/beli/p-murah");
  });

  it("the footer reflows at large text: the buttons wrap under the price, never over it, Pilih jadwal last", async () => {
    // Jest has no layout engine, so this pins the flex contract the reflow rests on (Yoga breaks the line, checked on
    // the emulator at font scale 1.3 on a 360dp screen): a wrapping row whose price and button group never shrink below
    // their own text and never outgrow the row, and a button group that fills its line from the trailing edge.
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    await screen.findByRole("button", { name: "Coba 1 hari" });
    const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(style("paket-footer")).toMatchObject({ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 10 });
    for (const id of ["paket-price", "paket-actions"]) {
      const s = style(id);
      expect(s).toMatchObject({ flexShrink: 0, maxWidth: "100%" });
      // `flex: 1` would make it shrink to fit one line and draw its contents over its neighbour (the G1 gate failure).
      expect(s.flex).toBeUndefined();
      expect(s.flexBasis).toBeUndefined();
      expect(s.width).toBeUndefined();
    }
    expect(style("paket-actions")).toMatchObject({
      flexGrow: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
    });
    // Price first, then the buttons, the primary one last so it lands at the trailing edge.
    const footer = screen.getByTestId("paket-footer");
    const order = within(footer)
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel);
    expect(order).toEqual(["Coba 1 hari", "Pilih jadwal"]);
    // The price stays tabular wherever it lands.
    const price = within(screen.getByTestId("paket-price")).getByText(/^Rp/);
    expect(StyleSheet.flatten(price.props.style).fontVariant).toEqual(["tabular-nums"]);
    // The buttons keep their own 48dp height and do not stretch or squeeze on a wrapped line.
    for (const b of within(footer).getAllByRole("button")) {
      const s = StyleSheet.flatten(b.props.style);
      expect(s.minHeight).toBe(48);
      expect(s.height).toBeUndefined();
      expect(s.flexShrink ?? 0).toBe(0);
    }
  });

  it("hides the trial button when the package has no trial", async () => {
    mockParams = { id: "p-mahal" };
    wrap(runtimeWith(), <PackageDetail />);
    expect(await screen.findByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Coba 1 hari" })).toBeNull();
  });

  it("shows caterer, rating, facts and the per-portion price", async () => {
    mockParams = { id: "p-mahal" };
    const runtime = runtimeWith(customer, {
      offer: jest.fn(async () => ({
        offer: { ...pricey, rating: 4.8, reviewCount: 23, description: "Masakan rumahan sehari-hari." },
      })),
    });
    wrap(runtime, <PackageDetail />);
    expect(await screen.findByText("Dapur Sehat, Tebet. 4,8 dari 23 ulasan")).toBeTruthy();
    expect(screen.getByText("Masakan rumahan sehari-hari.")).toBeTruthy();
    // The facts are icon rows now, each one sentence (the label and value table is gone).
    expect(screen.getByText("Pengantaran")).toBeTruthy();
    expect(screen.getByText(/^Sen–Jum, 17.00–19.00$|^Sen–Jum, 11.00–13.00$/)).toBeTruthy();
    expect(screen.getByText("Ubah hari sampai 17.00, sehari sebelumnya")).toBeTruthy();
    expect(screen.getByText("Ongkir sudah termasuk")).toBeTruthy();
    expect(screen.getByText("Per sekali makan")).toBeTruthy();
    expect(screen.getByText(/45\.000/)).toBeTruthy();
    // A price is read as text, never announced as a heading.
    expect(screen.getByText(/45\.000/).props.accessibilityRole).toBe("text");
  });

  it("shows the package contents instead of inventing dated menus", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    expect(await screen.findByText("Isi paket")).toBeTruthy();
    expect(screen.getByText(/Ayam bakar madu, Sayur asem/)).toBeTruthy();
  });

  it("shows \"Menu belum diisi\" once", async () => {
    mockParams = { id: "p-kosong" };
    const slots = offer({
      id: "p-kosong",
      name: "Ayam Panggang Harian",
      menus: [{ meal: "lunch", name: "", description: "", image: "", contentModel: "slots", items: [] } as unknown as Offer["menus"][number]],
    });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: slots })) }), <PackageDetail />);
    await screen.findByText("Isi paket");
    expect(screen.getAllByText(/Menu belum diisi/)).toHaveLength(1);
  });

  it("package detail labels the price per meal and notes a combined day", async () => {
    mockParams = { id: "p-dua" };
    const both = offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", price: 60000 });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: both })) }), <PackageDetail />);
    expect(await screen.findByText("Per sekali makan · 2 kali makan / hari")).toBeTruthy();
    expect(screen.getByText(/30\.000/)).toBeTruthy();
    expect(screen.queryByText("Per porsi")).toBeNull();
  });

  it("package detail shows earliest start and no Cara kerja", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    await screen.findByText("Isi paket");
    const first = startDates(cheap, new Date(), 1)[0];
    expect(screen.getByText(`Mulai paling cepat ${shortDate(first, "id")}`)).toBeTruthy();
    expect(screen.queryByText("Cara kerja Catera")).toBeNull();
    expect(screen.queryByText("Bayar sekali di depan")).toBeNull();
  });

  it("package detail hides the earliest start when nothing is bookable", async () => {
    mockParams = { id: "p-tutup" };
    const closed = offer({ id: "p-tutup", name: "Paket Tutup", weekdays: [] });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: closed })) }), <PackageDetail />);
    await screen.findByText("Isi paket");
    expect(screen.queryByText(/Mulai paling cepat/)).toBeNull();
  });

  it("says when the package is gone", async () => {
    mockParams = { id: "p-hilang" };
    wrap(runtimeWith(), <PackageDetail />);
    expect(await screen.findByText("Paket tidak ditemukan.")).toBeTruthy();
  });

  it("a link's title names the package only while it loads; gone or failed, it is Paket", async () => {
    const nativeTitle = () => within(screen.getByTestId("screen-native-title")).getByRole("header").props.children;
    mockParams = { id: "p-hilang", title: "Promo Palsu" };
    // Loading: the carried name.
    let view = wrap(runtimeWith(customer, { offer: jest.fn(() => new Promise(() => undefined)) }), <PackageDetail />);
    await act(async () => {});
    expect(nativeTitle()).toBe("Promo Palsu");
    view.unmount();
    // Gone: the carried name was never checked against a package.
    view = wrap(runtimeWith(), <PackageDetail />);
    await screen.findByText("Paket tidak ditemukan.");
    expect(nativeTitle()).toBe("Paket");
    expect(screen.queryByText("Promo Palsu")).toBeNull();
    view.unmount();
    // A failed read.
    const failing = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    wrap(runtimeWith(customer, { offer: failing }), <PackageDetail />);
    await screen.findByRole("button", { name: "Coba lagi" });
    expect(nativeTitle()).toBe("Paket");
    expect(screen.queryByText("Promo Palsu")).toBeNull();
  });
});

describe("Paket on the layout scale (v2)", () => {
  const withNutrition = offer({
    id: "p-gizi",
    name: "Rantang Nusantara",
    caterer: "Dapur Senja",
    areas: ["Jakarta Selatan"],
    description: "Paket siang dan malam selama 10 hari kerja.",
    price: 65000,
    meal: "both",
    nutrition: { caloriesKcal: { min: 610, max: 640 }, proteinG: { min: 29, max: 30 }, carbsG: { min: 76, max: 82 }, fatG: { min: 19, max: 21 } },
    menus: [
      { meal: "lunch", name: "", description: "", image: "", contentModel: "slots", composition: [{ id: "g1", slots: 1, name: "Nasi" }, { id: "g2", slots: 1, name: "Lauk" }], items: [{ id: "i1", groupId: "g1", name: "Nasi putih" }] },
      { meal: "dinner", name: "", description: "", image: "", contentModel: "slots", composition: [{ id: "g1", slots: 1, name: "Nasi" }, { id: "g2", slots: 2, name: "Lauk" }], items: [{ id: "i2", groupId: "g1", name: "Nasi putih" }] },
    ] as unknown as Offer["menus"],
  });
  const wrapV2 = (runtime: MobileRuntime, ui: React.ReactElement) =>
    render(
      <LayoutScaleProvider value="v2">
        <MoodProvider now={SIANG_NOW}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            {ui}
          </MobileProvider>
        </MoodProvider>
      </LayoutScaleProvider>,
    );
  const open = async (o: Offer = withNutrition, over: Record<string, unknown> = {}) => {
    mockParams = { id: o.id };
    wrapV2(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: o })), ...over }), <PackageDetail />);
    await screen.findByTestId("paket-name");
  };

  it("the hero is 4:3 and bleeds by the 16 margin, not the classic 20", async () => {
    await open();
    expect(flat(screen.getByTestId("paket-hero"))).toMatchObject({ aspectRatio: 4 / 3, marginHorizontal: -16 });
    expect(flat(screen.getByTestId("paket-hero")).marginTop).toBeUndefined();
    const swap = flat(screen.UNSAFE_getAllByType(FadeSwap)[0]);
    expect([swap.marginHorizontal, swap.paddingHorizontal]).toEqual([-16, 16]);
  });

  it("the name is heroTitle and the caterer line is meta", async () => {
    await open();
    expect(flat(screen.getByText("Rantang Nusantara"))).toMatchObject({ fontSize: 24, lineHeight: 30, fontFamily: fonts.bold });
    expect(flat(screen.getByText(/^Dapur Senja, Jakarta Selatan\./))).toMatchObject({ fontSize: 13, lineHeight: 18 });
  });

  it("the stat strip comes before the description, carbs and fat as one meta line", async () => {
    await open();
    expect(screen.getByTestId("stat-strip")).toBeTruthy();
    expect(screen.getByText("Karbo 76–82 g · Lemak 19–21 g per porsi")).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("stat-strip")).toBeLessThan(tree.indexOf("Paket siang dan malam selama 10 hari kerja."));
    expect(flat(screen.getByText("Paket siang dan malam selama 10 hari kerja."))).toMatchObject({ fontSize: 15, lineHeight: 22 });
  });

  it("Isi paket is a section heading over one card of 72 rows, a 40 circle on the mood tint", async () => {
    await open();
    expect(flat(screen.getByText("Isi paket"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    const rows = screen.getAllByTestId(/^paket-meal-(lunch|dinner)$/);
    expect(rows.map((r) => r.props.testID)).toEqual(["paket-meal-lunch", "paket-meal-dinner"]);
    for (const r of rows) expect(flat(r).minHeight).toBe(72);
    expect(flat(screen.getByTestId("paket-meal-lunch-glyph", { includeHiddenElements: true }))).toMatchObject({ width: 40, height: 40, borderRadius: 20, backgroundColor: nativeMood.light.siang.header });
    expect(flat(screen.getByTestId("paket-meal-dinner-glyph", { includeHiddenElements: true })).backgroundColor).toBe(nativeMood.light.malam.header);
    expect(flat(screen.getByText("Makan siang"))).toMatchObject({ fontSize: 17, lineHeight: 22, fontFamily: fonts.semibold });
    expect(flat(screen.getByText("Menu contoh · 1 Nasi · 1 Lauk"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(screen.getByText("Menu contoh · 1 Nasi · 2 Lauk")).toBeTruthy();
    // One card, no per-meal boxes with borders.
    expect(screen.getAllByTestId("list-card")).toHaveLength(1);
    expect(flat(rows[0]).borderWidth).toBeUndefined();
  });

  it("a one-meal package has one row", async () => {
    await open(offer({ id: "p-satu", name: "Nasi Ayam", nutrition: null }));
    expect(screen.getAllByTestId(/^paket-meal-(lunch|dinner)$/)).toHaveLength(1);
  });

  it("a row says where its menu comes from, so a sample menu's dishes never read as the real menu", async () => {
    const menu = (meal: string, extra: Record<string, unknown>) =>
      ({ meal, name: "Ayam bakar", description: "", image: "", items: [{ id: `${meal}-1`, name: "Ayam bakar madu" }], ...extra });
    await open(
      offer({
        id: "p-sumber",
        name: "Paket Sumber",
        meal: "both",
        nutrition: null,
        menus: [menu("lunch", {}), menu("dinner", { selectionStatus: "caterer_choice" })] as unknown as Offer["menus"],
      }),
    );
    expect(within(screen.getByTestId("paket-meal-lunch")).getByText("Menu contoh · Ayam bakar madu")).toBeTruthy();
    // A state that is already the whole line is not said twice.
    expect(within(screen.getByTestId("paket-meal-dinner")).getByText("Katering memilih")).toBeTruthy();
  });

  it("Pengantaran is a section of 48 icon rows set in bodyL", async () => {
    await open();
    expect(flat(screen.getByText("Pengantaran"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    const rows = screen.getAllByTestId("paket-info");
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(flat(r).minHeight).toBe(48);
      expect(flat(within(r).getByTestId("paket-info-glyph"))).toMatchObject({ width: 20, height: 20 });
    }
    const texts = rows.map((r) => within(r).UNSAFE_getAllByType(ReactNative.Text).at(-1)!);
    for (const text of texts) expect(flat(text)).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(texts[0].props.children).toBe("Sen–Jum, 11.00–13.00 · 17.00–19.00");
    expect(texts[1].props.children).toBe("Ubah hari sampai 17.00, sehari sebelumnya");
    expect(texts[2].props.children).toBe("Ongkir sudah termasuk");
    expect(String(texts[3].props.children)).toMatch(/^Mulai paling cepat /);
    // Nothing is cut to one line: the rows grow at large text.
    for (const text of texts) expect(text.props.numberOfLines).toBeUndefined();
  });

  it("with no bookable day the earliest start row is left out", async () => {
    await open(offer({ id: "p-tutup", name: "Paket Tutup", weekdays: [] }));
    expect(screen.getAllByTestId("paket-info")).toHaveLength(3);
    expect(screen.queryByText(/Mulai paling cepat/)).toBeNull();
  });

  it("the sections sit 32 apart", async () => {
    await open();
    for (const id of ["paket-isi", "paket-antar"]) expect(flat(screen.getByTestId(id)).marginTop).toBe(16);
  });

  it("the footer shows the price in section 800 with its meta unit, and two 50 buttons", async () => {
    await open(offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000, trialPrice: 20000, trialMax: 1 }));
    const price = within(screen.getByTestId("paket-price")).getByText(/^Rp/);
    expect(flat(price)).toMatchObject({ fontSize: 20, lineHeight: 26, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] });
    expect(flat(within(screen.getByTestId("paket-price")).getByText("Per sekali makan"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    for (const b of within(screen.getByTestId("paket-footer")).getAllByRole("button")) {
      expect(flat(b)).toMatchObject({ minHeight: 50, borderRadius: 25 });
    }
    // 16 around the 50 buttons makes the 82 bar, with a line hairline above it in light.
    const footer = flat(screen.getByTestId("screen-footer"));
    expect([footer.padding, footer.paddingBottom, footer.borderTopWidth]).toEqual([16, 16, 1]);
  });

  it("a combined day keeps the unit and its note on one meta line", async () => {
    await open();
    expect(screen.getByText("Per sekali makan · 2 kali makan / hari")).toBeTruthy();
  });

  it("the reviews keep their block as tone cards without borders", async () => {
    await open(withNutrition, {
      request: jest.fn(async () => [{ id: "r1", customer: "Dewi", rating: 5, body: "Enak sekali." }]),
    });
    expect(await screen.findByText("Dewi · 5/5")).toBeTruthy();
    expect(screen.getByText("Enak sekali.")).toBeTruthy();
    expect(flat(screen.getByText("Ulasan"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
    expect(flat(screen.getByTestId("paket-review")).borderWidth).toBeUndefined();
  });

  it("a failed reviews read shows a compact retry in the Ulasan block, not a missing block", async () => {
    let fail = true;
    const request = jest.fn(async (path: string) => {
      if (fail && path.startsWith("reviews/")) throw new Error("REQUEST_TIMEOUT");
      return path.startsWith("reviews/") ? [{ id: "r1", customer: "Dewi", rating: 5, body: "Enak sekali." }] : [];
    });
    await open(withNutrition, { request });
    expect(await screen.findByText(/^Belum bisa memuat ulasan/)).toBeTruthy();
    expect(screen.getByText("Ulasan")).toBeTruthy();
    expect(screen.getByTestId("paket-name")).toBeTruthy();
    fail = false;
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Dewi · 5/5")).toBeTruthy();
    expect(screen.queryByText(/^Belum bisa memuat ulasan/)).toBeNull();
  });

  it("in the dark theme and in Malam the surfaces and the meal tints come from the dark palette", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    try {
      mockParams = { id: withNutrition.id };
      render(
        <LayoutScaleProvider value="v2">
          <ThemeProvider storageKey="paket-dark">
            <MoodProvider now={MALAM_NOW}>
              <MobileProvider runtime={runtimeWith(customer, { offer: jest.fn(async () => ({ offer: withNutrition })) })} linkMapper={customerLink}>
                <PackageDetail />
              </MobileProvider>
            </MoodProvider>
          </ThemeProvider>
        </LayoutScaleProvider>,
      );
      await screen.findByTestId("paket-name");
      expect(flat(screen.getByTestId("stat-strip")).backgroundColor).toBe(nativeThemes.dark.surface);
      expect(flat(screen.getByTestId("paket-meal-lunch-glyph", { includeHiddenElements: true })).backgroundColor).toBe(nativeMood.dark.siang.header);
      expect(flat(screen.getByTestId("paket-meal-dinner-glyph", { includeHiddenElements: true })).backgroundColor).toBe(nativeMood.dark.malam.header);
      expect(flat(screen.getByText("Rantang Nusantara")).color).toBe(nativeThemes.dark.charcoal);
      expect(flat(screen.getByText("kkal")).color).toBe(nativeThemes.dark.muted);
    } finally {
      scheme.mockRestore();
    }
  });

  it("at font scale 1.3 on 360dp the footer wraps instead of clipping and the rows keep their full text", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    try {
      await open(offer({ id: "p-murah", name: "Nasi Ayam Bakar", price: 25000, trialPrice: 20000, trialMax: 1 }));
      expect(flat(screen.getByTestId("paket-footer"))).toMatchObject({ flexWrap: "wrap" });
      expect(screen.getByRole("button", { name: "Pilih jadwal" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Coba 1 hari" })).toBeTruthy();
      for (const r of screen.getAllByTestId("paket-info"))
        for (const text of within(r).UNSAFE_getAllByType(ReactNative.Text)) expect(text.props.numberOfLines).toBeUndefined();
    } finally {
      mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
    }
  });
});

describe("Disimpan", () => {
  it("lists saved packages on the same card and a removed one is gone after the reload", async () => {
    const server = savedServer(["p-murah", "p-mahal"]);
    wrap(runtimeWith(customer, server), <SavedList />);
    expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }));
    await waitFor(() =>
      expect(server.command).toHaveBeenCalledWith("savedPackage.set", { packageId: "p-murah", saved: false }, expect.any(String)),
    );
    await waitFor(() => expect(server.savedPackages).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
  });

  it("lists the saved packages as the same two column tile grid", async () => {
    wrap(runtimeWith(customer, savedServer(["p-murah", "p-mahal"])), <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    expect(flat(screen.getByTestId("package-grid"))).toMatchObject({ flexWrap: "wrap", columnGap: 12, rowGap: 20 });
    expect(screen.getAllByTestId("package-tile")).toHaveLength(2);
    for (const photo of screen.getAllByTestId("package-photo")) expect(flat(photo)).toMatchObject({ aspectRatio: 4 / 3, borderRadius: 12 });
    expect(flat(screen.getByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }))).toMatchObject({ width: 44, height: 44 });
  });

  it("while the saved list loads, its skeleton is the tile grid's shape: four 4:3 tiles in the same grid", async () => {
    wrap(runtimeWith(customer, { savedPackages: jest.fn(() => new Promise(() => undefined)) }), <SavedList />);
    const skeleton = await screen.findByTestId("saved-skeleton");
    expect(skeleton).toBeTruthy();
    expect(flat(screen.getByTestId("saved-skeleton-grid"))).toMatchObject({ flexWrap: "wrap", columnGap: 12, rowGap: 20 });
    const tiles = screen.getAllByTestId("saved-skeleton-tile");
    expect(tiles).toHaveLength(4);
    for (const tile of tiles) expect(flat(tile)).toMatchObject({ flexBasis: "40%", flexGrow: 1 });
    expect((tiles[0].children[0] as unknown as { props: Record<string, unknown> }).props).toMatchObject({ aspectRatio: 4 / 3, radius: 12 });
    expect(screen.getByRole("progressbar", { name: "Memuat paket tersimpan" })).toBeTruthy();
  });

  it("an unavailable package takes the tile shape: a 4:3 sage block, then its name and why", async () => {
    const server = savedServer(["p-murah", "p-gone"]);
    const base = server.savedPackages;
    server.savedPackages = jest.fn(async () => {
      const page = await base();
      return {
        ...page,
        items: [...page.items.slice(0, 1), { packageId: "p-gone", savedAt: "2026-10-01T00:00:00Z", summary: { name: "Paket Lama" }, offer: null }],
      };
    });
    wrap(runtimeWith(customer, server), <SavedList />);
    await screen.findByText("Paket Lama");
    expect(flat(screen.getByTestId("saved-unavailable-photo"))).toMatchObject({ aspectRatio: 4 / 3, borderRadius: 12 });
    expect(screen.getByText("Paket Lama").props.numberOfLines).toBe(2);
    expect(screen.getByText("Paket ini tidak tersedia lagi.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hapus Paket Lama dari simpanan" })).toBeTruthy();
  });

  it("keeps the package listed and says so when removing fails", async () => {
    wrap(runtimeWith(customer, savedServer(["p-murah"], true)), <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    fireEvent.press(screen.getByRole("button", { name: "Hapus Nasi Ayam Bakar dari simpanan" }));
    expect(await screen.findByText("Belum tersimpan. Coba lagi.")).toBeTruthy();
    expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
  });

  it("asks a signed-out visitor to sign in", async () => {
    wrap(runtimeWith(null), <SavedList />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalled();
  });

  it("while the session loads, the skeleton sits in the scrolling Screen, below the iOS large title", async () => {
    const view = wrap(runtimeWith(customer, { me: jest.fn(() => new Promise(() => undefined)) }), <SavedList />);
    await act(async () => {});
    const scroll = screen.getByTestId("screen-scroll");
    expect(scroll.findByProps({ testID: "saved-skeleton" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Memuat paket tersimpan" })).toBeTruthy();
    expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
    view.unmount();
  });

  it("explains an empty list", async () => {
    wrap(runtimeWith(), <SavedList />);
    expect(await screen.findByText("Belum ada paket tersimpan.")).toBeTruthy();
  });
});
