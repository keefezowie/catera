import * as ReactNative from "react-native";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { currency, shortDate, startDates, type Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeMood } from "@catera/design-tokens";
import { MoodProvider, ThemeProvider, useMood } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { topTags } from "../src/discover/categories";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { SavedList } from "../src/discover/SavedList";
import { offer } from "./fixtures";

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

// The mood is part of what Jelajah shows (the meal buttons are the mood toggle), so every screen here has a provider
// that opens in Siang, like the app does before 15:00.
const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MoodProvider now={SIANG_NOW}>
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        {ui}
      </MobileProvider>
    </MoodProvider>,
  );

const lastCatalogQuery = (runtime: MobileRuntime) =>
  String((runtime.api.catalog as jest.Mock).mock.calls.at(-1)![0]);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
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
    expect(screen.getByText("Bisa coba 1 hari dulu")).toBeTruthy();
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

  it("every chip and the area control is at least 48 points tall", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    for (const name of ["Siang", "Malam", "Di bawah Rp30.000", "Bisa coba 1 hari", "Pilih area pengantaran"]) {
      const role = name === "Siang" || name === "Malam" ? "tab" : "button";
      const style = StyleSheet.flatten(screen.getByRole(role, { name }).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
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
    fireEvent.changeText(screen.getByPlaceholderText("Cari ayam bakar, nabati, Bu Rini…"), "sehat");
    await waitFor(() => expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull());
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect((runtime.api.catalog as jest.Mock).mock.calls.length).toBe(calls);
  });

  it("single-meal offer shows only / sekali makan", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    // Two lunch packages on Siang; the dinner one shows on Malam.
    expect(screen.getAllByText("/ sekali makan")).toHaveLength(2);
    fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
    expect(screen.getAllByText("/ sekali makan")).toHaveLength(1);
    expect(screen.queryByText("2 kali makan / hari")).toBeNull();
  });

  it("combined offer shows 2 kali makan / hari and its per-meal price", async () => {
    const both = offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", price: 60000 });
    wrap(runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [both], nextCursor: null })) }), <Jelajah />);
    await screen.findByText("Siang dan Malam");
    expect(screen.getByText("/ sekali makan")).toBeTruthy();
    expect(screen.getByText("2 kali makan / hari")).toBeTruthy();
    expect(screen.getByText(currency(30000, "id"))).toBeTruthy();
    expect(screen.queryByText(/60\.000/)).toBeNull();
  });

  it("shows the caterer line without inventing a distance", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Nasi Ayam Bakar");
    expect(screen.getAllByText("Dapur Contoh. Sen–Jum siang").length).toBeGreaterThan(0);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it("shows a distance only when the catalog carries one", async () => {
    const runtime = runtimeWith(customer, {
      catalog: jest.fn(async () => ({ items: [{ ...cheap, distanceKm: 2.4 }], nextCursor: null })),
    });
    wrap(runtime, <Jelajah />);
    expect(await screen.findByText("Dapur Contoh, 2,4 km. Sen–Jum siang")).toBeTruthy();
  });

  it("remembers the delivery area in SecureStore and sends it to the catalog", async () => {
    const runtime = runtimeWith();
    wrap(runtime, <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.press(screen.getByRole("button", { name: "Pilih area pengantaran" }));
    fireEvent.press(await screen.findByRole("button", { name: "Jakarta Selatan" }));
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
      fireEvent.press(await screen.findByRole("button", { name }));
    };

    it("shows only packages that deliver to the chosen area", async () => {
      const runtime = areaRuntime();
      wrap(runtime, <Jelajah />);
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
      wrap(areaRuntime(), <Jelajah />);
      await screen.findByText("Menu Sehat Premium");
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      await choose("Semua area");
      expect(await screen.findByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    });

    it("says when no caterer delivers there, and Lihat semua area clears the area", async () => {
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.area", "Jakarta Utara");
      wrap(areaRuntime(), <Jelajah />);
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
    fireEvent.changeText(screen.getByPlaceholderText("Cari ayam bakar, nabati, Bu Rini…"), "tidak ada");
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

describe("topTags", () => {
  const tagged = (id: string, tags: string[], image = `${id}.jpg`) => offer({ id, tags, image });

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
    expect(topTags(offers, 6).map((x) => x.tag)).toEqual(["Sehat", "Rumahan", "Nabati", "Pedas", "Manis", "Gurih"]);
  });

  it("drops the meal tags", () => {
    const offers = [
      tagged("a", ["Makan siang", "Makan malam", "Siang & Malam", "Sehat"]),
      tagged("b", ["makan siang", "Sehat"]),
    ];
    expect(topTags(offers, 6).map((x) => x.tag)).toEqual(["Sehat"]);
  });

  it("breaks ties alphabetically", () => {
    const offers = [tagged("a", ["Pedas", "Manis"]), tagged("b", ["Gurih", "Pedas", "Manis", "Asin"])];
    expect(topTags(offers, 6).map((x) => x.tag)).toEqual(["Manis", "Pedas", "Asin", "Gurih"]);
  });

  it("takes the image from the first offer that carries the tag", () => {
    const offers = [tagged("a", ["Sehat"], "a.jpg"), tagged("b", ["Sehat", "Pedas"], "b.jpg"), tagged("c", ["Pedas"], "c.jpg")];
    expect(topTags(offers, 6)).toEqual([
      { tag: "Pedas", image: "b.jpg" },
      { tag: "Sehat", image: "a.jpg" },
    ]);
  });

  it("takes the image from the first offer that carries the tag and has a photo", () => {
    const offers = [tagged("a", ["Sehat"], ""), tagged("b", ["Sehat", "Pedas"], "b.jpg"), tagged("c", ["Pedas"], "")];
    expect(topTags(offers, 6)).toEqual([
      { tag: "Pedas", image: "b.jpg" },
      { tag: "Sehat", image: "b.jpg" },
    ]);
    // A tag no photographed package carries keeps an empty image, as before.
    expect(topTags([tagged("a", ["Sehat"], "")], 6)).toEqual([{ tag: "Sehat", image: "" }]);
  });

  it("counts a tag once per offer and returns nothing when no offer has tags", () => {
    expect(topTags([tagged("a", ["Sehat", "Sehat"]), tagged("b", ["Pedas"])], 6)[0].tag).toBe("Pedas");
    expect(topTags([tagged("a", [])], 6)).toEqual([]);
    expect(topTags([], 6)).toEqual([]);
  });
});

describe("Jelajah mood header", () => {
  function mount(runtime: MobileRuntime, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    return render(
      <ThemeProvider storageKey="jelajah-mood-test">
        <MoodProvider now={now}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            <Jelajah />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
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

  it("shows the area line, the title and the search field in the header", async () => {
    mount(runtimeWith());
    await screen.findByText("Menu Sehat Premium");
    expect(header().getByRole("button", { name: "Pilih area pengantaran" })).toBeTruthy();
    expect(header().getByText("Pilih area")).toBeTruthy();
    expect(title()).toBe("Makan siang\nminggu depan?");
    expect(header().getByPlaceholderText("Cari ayam bakar, nabati, Bu Rini…")).toBeTruthy();
    expect(header().getByRole("button", { name: "Paket disimpan" })).toBeTruthy();
  });

  it("names the Malam meal in the title when the mood is Malam", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    expect(title()).toBe("Makan malam\nminggu depan?");
  });

  it("has two 60 point meal tabs in a tablist that are the mood toggle and the meal filter", async () => {
    mount(runtimeWith());
    await screen.findByText("Menu Sehat Premium");
    expect(title()).toBe("Makan siang\nminggu depan?");
    expect(screen.UNSAFE_getByProps({ accessibilityRole: "tablist" }).props.accessibilityLabel).toBe("Waktu makan");
    for (const name of ["Siang", "Malam"]) {
      expect(flat(header().getByRole("tab", { name })).minHeight).toBeGreaterThanOrEqual(60);
    }
    expect(header().getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(true);
    expect(header().getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(false);
    fireEvent.press(header().getByRole("tab", { name: "Malam" }));
    // The list keeps dinner and combined packages only, and the title follows.
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    expect(header().getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(header().getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
    expect(title()).toBe("Makan malam\nminggu depan?");
    fireEvent.press(header().getByRole("tab", { name: "Siang" }));
    expect(title()).toBe("Makan siang\nminggu depan?");
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect(screen.queryByText("Makan Malam Nabati")).toBeNull();
  });

  it("opens on Malam with the Malam tab selected and the lunch packages hidden", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    expect(header().getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(header().getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
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
    expect(header().getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
    expect(header().getByRole("tab", { name: "Siang" }).props.accessibilityState.selected).toBe(false);
    expect(title()).toBe("Makan malam\nminggu depan?");
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
    fireEvent.press(header().getByRole("tab", { name: "Malam" }));
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
  });

  it("paints the header from the mood palette and the search text on it", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    const palette = nativeMood.light.malam;
    expect(flat(screen.getByTestId("jelajah-title")).color).toBe(palette.headerText);
    expect(flat(header().getByPlaceholderText("Cari ayam bakar, nabati, Bu Rini…")).color).toBe(palette.headerText);
    expect(flat(screen.getByTestId("mood-fill-malam")).backgroundColor).toBe(palette.header);
  });

  it("colours the selected Malam tab onToggleActive on toggleActive and the idle one headerMeta on toggleTrack", async () => {
    mount(runtimeWith(), { now: MALAM_NOW });
    await screen.findByText("Makan Malam Nabati");
    const palette = nativeMood.light.malam;
    const selected = header().getByRole("tab", { name: "Malam" });
    const idle = header().getByRole("tab", { name: "Siang" });
    expect(flat(selected).backgroundColor).toBe(palette.toggleActive);
    expect(flat(within(selected).getByText("Malam")).color).toBe(palette.onToggleActive);
    expect(flat(idle).backgroundColor).toBe(palette.toggleTrack);
    expect(flat(within(idle).getByText("Siang")).color).toBe(palette.headerMeta);
  });

  describe("category circles", () => {
    it("renders a PhotoRing per top tag, without the meal tags", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.getByRole("button", { name: "Kategori Sehat" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Kategori Makan malam/ })).toBeNull();
      expect(screen.getAllByTestId("photo-ring")).toHaveLength(2);
    });

    it("filters by the tapped tag, marks it selected, and clears on a second tap", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      expect(screen.getByText("Nasi Ayam Bakar")).toBeTruthy();
      expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" }).props.accessibilityState.selected).toBe(true);
      expect(screen.getByRole("button", { name: "Kategori Sehat" }).props.accessibilityState.selected).toBe(false);
      // The tag carries over to the other meal: the dinner package is tagged Rumahan too.
      fireEvent.press(header().getByRole("tab", { name: "Malam" }));
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      expect(screen.queryByText("Nasi Ayam Bakar")).toBeNull();
      fireEvent.press(header().getByRole("tab", { name: "Siang" }));
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
      fireEvent.press(header().getByRole("tab", { name: "Malam" }));
      fireEvent.press(screen.getByRole("button", { name: "Kategori Rumahan" }));
      // The dinner package has no one-day trial, so the list is empty and offers the way out.
      fireEvent.press(screen.getByRole("button", { name: "Bisa coba 1 hari" }));
      expect(screen.getByText("Belum ada paket yang cocok.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Hapus pilihan" }));
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" }).props.accessibilityState.selected).toBe(false);
      expect(screen.getByRole("button", { name: "Bisa coba 1 hari" }).props.accessibilityState.selected).toBe(false);
      expect(header().getByRole("tab", { name: "Malam" }).props.accessibilityState.selected).toBe(true);
      expect(title()).toBe("Makan malam\nminggu depan?");
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
      fireEvent.press(header().getByRole("tab", { name: "Malam" }));
      // Nothing on Malam carries Sehat: no circle, and the list is not filtered by it.
      expect(screen.queryByRole("button", { name: "Kategori Sehat" })).toBeNull();
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
      fireEvent.press(header().getByRole("tab", { name: "Siang" }));
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
      fireEvent.press(header().getByRole("tab", { name: "Malam" }));
      // Sehat has no dinner package: its circle goes, and with it the filter.
      expect(screen.queryByRole("button", { name: "Kategori Sehat" })).toBeNull();
      expect(screen.getByRole("button", { name: "Kategori Rumahan" })).toBeTruthy();
      expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    });

    it("does not render the row when the catalogue has no tags", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      expect(screen.queryByRole("button", { name: /^Kategori / })).toBeNull();
      expect(screen.queryByTestId("photo-ring")).toBeNull();
    });

    it("keeps every circle at least 48 points to tap", async () => {
      mount(taggedRuntime());
      await screen.findByText("Menu Sehat Premium");
      const style = flat(screen.getByRole("button", { name: "Kategori Sehat" }));
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    });
  });

  describe("rows", () => {
    it("renders each package as a row card with a 112 point photo and the price unit", async () => {
      mount(runtimeWith());
      await screen.findByText("Menu Sehat Premium");
      const photos = screen.getAllByTestId("package-photo");
      // The two lunch packages; the dinner one waits behind the Malam tab.
      expect(photos).toHaveLength(2);
      expect(flat(photos[0])).toMatchObject({ width: 112, height: 112 });
      expect(screen.getAllByText("/ sekali makan")).toHaveLength(2);
      // B2: the caterer, the delivery days and the meal, with no start date.
      expect(screen.getAllByText("Dapur Contoh. Sen–Jum siang").length).toBeGreaterThan(0);
      expect(screen.queryByText(/Mulai/)).toBeNull();
    });

    it("keeps the heart a 48 point button on the row", async () => {
      mount(runtimeWith());
      const heart = await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" });
      expect(flat(heart)).toMatchObject({ width: 48, height: 48 });
    });
  });

  describe("states on a Malam header", () => {
    it("says so when nothing matches, in the page colours", async () => {
      const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [], nextCursor: null })) });
      mount(runtime, { now: MALAM_NOW });
      expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Lihat makan siang" })).toBeNull();
      expect(title()).toBe("Makan malam\nminggu depan?");
    });

    it("shows the error with a retry under the header", async () => {
      const catalog = jest.fn(async () => {
        throw new Error("REQUEST_FAILED");
      });
      mount(runtimeWith(customer, { catalog }), { now: MALAM_NOW });
      expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
      expect(title()).toBe("Makan malam\nminggu depan?");
      expect(header().getByPlaceholderText("Cari ayam bakar, nabati, Bu Rini…")).toBeTruthy();
    });

    it("shows the header and the spinner while the catalogue loads", async () => {
      const catalog = jest.fn(() => new Promise<never>(() => {}));
      const view = mount(runtimeWith(customer, { catalog }), { now: MALAM_NOW });
      await waitFor(() => expect(view.UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0));
      expect(title()).toBe("Makan malam\nminggu depan?");
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
    expect(screen.getByText("Diantar")).toBeTruthy();
    expect(screen.getByText("Ubah hari")).toBeTruthy();
    expect(screen.getByText("Pengantaran termasuk")).toBeTruthy();
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

  it("shows \"Menu belum ditentukan\" once", async () => {
    mockParams = { id: "p-kosong" };
    const slots = offer({
      id: "p-kosong",
      name: "Ayam Panggang Harian",
      menus: [{ meal: "lunch", name: "", description: "", image: "", contentModel: "slots", items: [] } as unknown as Offer["menus"][number]],
    });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: slots })) }), <PackageDetail />);
    await screen.findByText("Isi paket");
    expect(screen.getAllByText(/Menu belum ditentukan/)).toHaveLength(1);
  });

  it("package detail labels the price per meal and notes a combined day", async () => {
    mockParams = { id: "p-dua" };
    const both = offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", price: 60000 });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: both })) }), <PackageDetail />);
    expect(await screen.findByText("Per sekali makan")).toBeTruthy();
    expect(screen.queryByText("Per porsi")).toBeNull();
    expect(screen.getByText(/30\.000/)).toBeTruthy();
    expect(screen.getByText("2 kali makan / hari")).toBeTruthy();
  });

  it("package detail shows earliest start and no Cara kerja", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    await screen.findByText("Isi paket");
    const first = startDates(cheap, new Date(), 1)[0];
    expect(screen.getByText("Mulai paling cepat")).toBeTruthy();
    expect(screen.getByText(shortDate(first, "id"))).toBeTruthy();
    expect(screen.queryByText("Cara kerja Catera")).toBeNull();
    expect(screen.queryByText("Bayar sekali di depan")).toBeNull();
  });

  it("package detail hides the earliest start when nothing is bookable", async () => {
    mockParams = { id: "p-tutup" };
    const closed = offer({ id: "p-tutup", name: "Paket Tutup", weekdays: [] });
    wrap(runtimeWith(customer, { offer: jest.fn(async () => ({ offer: closed })) }), <PackageDetail />);
    await screen.findByText("Isi paket");
    expect(screen.queryByText("Mulai paling cepat")).toBeNull();
  });

  it("heart on the detail goes to sign-in and back to the package", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(null), <PackageDetail />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan Nasi Ayam Bakar" }));
    expect(router.push).toHaveBeenCalledWith("/login?next=/paket/p-murah");
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

  it("while the session loads, the spinner sits in the scrolling Screen, below the iOS large title", async () => {
    const view = wrap(runtimeWith(customer, { me: jest.fn(() => new Promise(() => undefined)) }), <SavedList />);
    await act(async () => {});
    const scroll = screen.getByTestId("screen-scroll");
    expect(scroll.findByType(ActivityIndicator)).toBeTruthy();
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe("automatic");
    view.unmount();
  });

  it("explains an empty list", async () => {
    wrap(runtimeWith(), <SavedList />);
    expect(await screen.findByText("Belum ada paket tersimpan.")).toBeTruthy();
  });
});
