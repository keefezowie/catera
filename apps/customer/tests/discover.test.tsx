import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import type { Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { customerLink } from "../src/links";
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

const wrap = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
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
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Di bawah Rp30.000" }).props.accessibilityState.selected).toBe(true);
  });

  it("meal chips narrow to one meal and both together mean no meal filter", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    fireEvent.press(screen.getByRole("button", { name: "Malam" }));
    expect(screen.queryByText("Menu Sehat Premium")).toBeNull();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Siang" }));
    expect(screen.getByText("Menu Sehat Premium")).toBeTruthy();
    expect(screen.getByText("Makan Malam Nabati")).toBeTruthy();
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
      fireEvent.press(screen.getByRole("button", { name }));
      expect(view.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(screen.queryByText("Nasi Ayam Bakar") || screen.queryByText("Belum ada paket yang cocok.")).toBeTruthy();
    }
    expect((runtime.api.catalog as jest.Mock).mock.calls.length).toBe(calls);
    expect(lastCatalogQuery(runtime)).toBe("?limit=100");
  });

  it("every chip is at least 44 points tall", async () => {
    wrap(runtimeWith(), <Jelajah />);
    await screen.findByText("Menu Sehat Premium");
    for (const name of ["Siang", "Malam", "Di bawah Rp30.000", "Bisa coba 1 hari"]) {
      const style = StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
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
    expect(router.push).toHaveBeenCalledWith("/paket/p-murah");
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

  it("says so when nothing matches", async () => {
    const runtime = runtimeWith(customer, { catalog: jest.fn(async () => ({ items: [], nextCursor: null })) });
    wrap(runtime, <Jelajah />);
    expect(await screen.findByText("Belum ada paket yang cocok.")).toBeTruthy();
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
    expect(screen.getByText("Per porsi")).toBeTruthy();
    expect(screen.getByText(/45\.000/)).toBeTruthy();
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

  it("explains how Catera works", async () => {
    mockParams = { id: "p-murah" };
    wrap(runtimeWith(), <PackageDetail />);
    expect(await screen.findByText("Cara kerja Catera")).toBeTruthy();
    expect(screen.getByText("Pilih jadwal antar")).toBeTruthy();
    expect(screen.getByText("Bayar sekali di depan")).toBeTruthy();
    expect(screen.getByText("Diantar sesuai jadwal")).toBeTruthy();
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

  it("explains an empty list", async () => {
    wrap(runtimeWith(), <SavedList />);
    expect(await screen.findByText("Belum ada paket tersimpan.")).toBeTruthy();
  });
});
