import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { nativeThemes } from "@catera/design-tokens";
import { bannerTime, ToastProvider } from "@catera/mobile-ui";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { todayPlates } from "@catera/domain";
import { Beranda } from "../src/today/Beranda";
import { Plate } from "../src/today/Plate";
import { customerLink } from "../src/links";
import { customerState, TODAY } from "./fixtures";
import { goOffline, keptLine } from "./offline";
import * as offline from "../src/today/offline";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
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
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const actor = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

function runtimeWith(read: () => Promise<unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(read),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderHome = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <ToastProvider>
        <Beranda />
      </ToastProvider>
    </MobileProvider>,
  );

/** The kitchen marked the lunch Sampai, with a photo, and the customer has not answered. */
const arrived = (extra: Record<string, unknown> = {}) =>
  customerState({ status: "out_for_delivery", arrived_at: `${TODAY}T04:30:00Z`, arrived_photo: "proof/d-today-lunch.jpg", ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  (offline.loadCachedCustomer as jest.Mock).mockResolvedValue(null);
  store().clear();
  store().set("catera.demo.token", "demo-session");
});

describe("Sudah sampai", () => {
  it("is busy while the answer is on its way, and a second press sends nothing more", async () => {
    const runtime = runtimeWith(async () => customerState({ status: "out_for_delivery" }));
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    renderHome(runtime);
    const answer = await screen.findByRole("button", { name: "Sudah sampai" });
    fireEvent.press(answer);
    fireEvent.press(answer);
    const busy = screen.getByRole("button", { name: "Sudah sampai" });
    expect(busy.props.accessibilityState.busy).toBe(true);
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
  });

  it("Sudah sampai failure shows an error toast with Coba lagi, and no loose text", async () => {
    const runtime = runtimeWith(async () => customerState({ status: "out_for_delivery" }));
    (runtime.api.command as jest.Mock).mockRejectedValueOnce(Object.assign(new Error("NOT_ALLOWED"), { code: "NOT_ALLOWED" }));
    renderHome(runtime);
    fireEvent.press(await screen.findByRole("button", { name: "Sudah sampai" }));
    expect(await screen.findByText(/^Belum bisa sekarang\./)).toBeTruthy();
    expect(screen.queryByTestId("plate-error")).toBeNull();
    // The toast's own button sends the same answer again.
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(2));
    expect(runtime.api.command).toHaveBeenLastCalledWith(
      "delivery.confirm",
      { deliveryId: "d-today", meal: "lunch" },
      expect.any(String),
    );
  });
});

describe("the arrived-unconfirmed hero", () => {
  it("the arrived-unconfirmed hero shows the photo, Sudah sampai and Belum", async () => {
    renderHome(runtimeWith(async () => arrived()));
    expect(await screen.findByRole("header", { name: "Dapur menandai makan siang sudah sampai." })).toBeTruthy();
    expect(screen.getByText("Sudah diterima?")).toBeTruthy();
    const actions = within(screen.getByTestId("plate-actions"));
    expect(actions.getByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    expect(actions.getByRole("button", { name: "Belum" })).toBeTruthy();
    // The kitchen's photo sits beside them, read behind the session.
    const proof = await screen.findByTestId("plate-proof");
    expect(proof.props.accessibilityLabel).toBe("Foto dari dapur saat pesanan sampai");
    await waitFor(() => expect(within(proof).UNSAFE_queryAllByType(Image)).toHaveLength(1));
    expect(within(proof).UNSAFE_getByType(Image).props.source).toEqual({
      uri: "https://api.example.test/api/proof?deliveryId=d-today&meal=lunch",
      headers: { Authorization: "Bearer demo-session" },
    });
    expect(screen.getByText("Ditandai sampai, menunggu konfirmasimu")).toBeTruthy();
  });

  it("answers Sudah sampai with a confirm", async () => {
    const runtime = runtimeWith(async () => arrived());
    renderHome(runtime);
    fireEvent.press(await screen.findByRole("button", { name: "Sudah sampai" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "delivery.confirm",
        { deliveryId: "d-today", meal: "lunch" },
        expect.any(String),
      ),
    );
  });

  it("Belum opens the Belum sampai report", async () => {
    renderHome(runtimeWith(async () => arrived()));
    fireEvent.press(await screen.findByRole("button", { name: "Belum" }));
    expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch&jenis=belum");
  });

  it("says so in words when the photo cannot load, and keeps its place", async () => {
    renderHome(runtimeWith(async () => arrived()));
    const proof = await screen.findByTestId("plate-proof");
    await waitFor(() => expect(within(proof).UNSAFE_queryAllByType(Image)).toHaveLength(1));
    expect(screen.queryByTestId("plate-proof-failed")).toBeNull();
    act(() => within(proof).UNSAFE_getByType(Image).props.onError());
    expect(await screen.findByText("Foto belum bisa dimuat")).toBeTruthy();
    expect(screen.getByTestId("plate-proof")).toBeTruthy();
    // The buttons are still there to answer with.
    expect(screen.getByRole("button", { name: "Sudah sampai" })).toBeTruthy();
  });

  it("has no photo box when the kitchen left none", async () => {
    renderHome(runtimeWith(async () => arrived({ arrived_photo: null })));
    expect(await screen.findByRole("button", { name: "Sudah sampai" })).toBeTruthy();
    expect(screen.queryByTestId("plate-proof")).toBeNull();
  });

  it("offers nothing to answer from a copy kept offline", async () => {
    goOffline();
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({ savedAt: `${TODAY}T05:00:00.000Z`, data: arrived() });
    renderHome(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    expect(await screen.findByText("Dapur menandai makan siang sudah sampai.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
  });
});

describe("the hero with a failed photo", () => {
  it("the hero with a failed photo shows the photo ground and no pale band", async () => {
    renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
    const photo = await screen.findByTestId("plate-photo");
    const hero = within(photo).UNSAFE_getAllByType(Image)[0];
    act(() => hero.props.onError());
    const ground = await within(photo).findByTestId("photo-ground");
    // The dark photo ground of the theme: one even slab, never the page's pale neutral. The 16:10 frame keeps its size.
    expect(StyleSheet.flatten(ground.props.style).backgroundColor).toBe(nativeThemes.light.photoGround);
    expect(StyleSheet.flatten(photo.props.style).backgroundColor).toBe(nativeThemes.light.photoGround);
    expect(StyleSheet.flatten(photo.props.style).aspectRatio).toBeCloseTo(16 / 10, 6);
    // The text sits in the card's body now, so the photo carries no scrim or overlay.
    expect(within(photo).queryByTestId("plate-scrim")).toBeNull();
    expect(within(photo).queryByTestId("plate-overlay")).toBeNull();
  });
});

describe("Coba lagi on a stale copy", () => {
  it("keeps the line and busies the button while the retry runs, on Beranda", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: `${TODAY}T03:12:00.000Z`,
      data: customerState({ status: "out_for_delivery" }),
    });
    let settle = () => {};
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderHome(runtime);
    const line = `Belum bisa memperbarui. Menampilkan data terakhir, ${bannerTime(new Date(`${TODAY}T03:12:00.000Z`))}.`;
    await screen.findByText(line);
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise((_, reject) => (settle = () => reject(new Error("REQUEST_TIMEOUT")))));
    fireEvent.press(within(screen.getByTestId("stale-copy")).getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(within(screen.getByTestId("stale-copy")).getByRole("button", { name: "Coba lagi" }).props.accessibilityState.busy).toBe(true));
    expect(screen.getByText(line)).toBeTruthy();
    await act(async () => settle());
    expect(await screen.findByText(line)).toBeTruthy();
  });
});

describe("the card's reactions", () => {
  it("keeps unselected reaction labels charcoal; forest only fills the chosen one", async () => {
    const state = customerState({ status: "delivered", confirmed_at: `${TODAY}T05:00:00Z`, confirmed_by: "customer", reaction: "enak" });
    const plate = todayPlates(state, new Date(`${TODAY}T06:00:00Z`))[0];
    render(
      <MobileProvider runtime={runtimeWith(async () => state)} linkMapper={customerLink}>
        <Plate plate={plate} apiBase="https://api.example.test" variant="card" />
      </MobileProvider>,
    );
    const label = (name: string) => within(screen.getByRole("button", { name })).getByText(name);
    expect(StyleSheet.flatten(label("Biasa").props.style).color).toBe(nativeThemes.light.charcoal);
    expect(StyleSheet.flatten(label("Kurang").props.style).color).toBe(nativeThemes.light.charcoal);
    const chosen = StyleSheet.flatten(screen.getByRole("button", { name: "Enak" }).props.style);
    expect(chosen.backgroundColor).toBe(nativeThemes.light.forest);
  });
});

describe("module structure", () => {
  it("the hero and the day actions do not import each other (no require cycle)", () => {
    const src = (file: string) => readFileSync(join(__dirname, "..", "src", file), "utf8");
    expect(src("schedule/dayActions.ts")).not.toMatch(/from "\.\.\/today\/Plate"/);
    expect(src("today/Plate.tsx")).toMatch(/from "\.\.\/schedule\/dayActions"/);
  });
});

describe("Beranda offline and failed reads", () => {
  it("the offline copy shows the banner and no loose caption", async () => {
    goOffline();
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: `${TODAY}T03:12:00.000Z`,
      data: customerState({ status: "out_for_delivery" }),
    });
    renderHome(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    expect(await screen.findByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.getByText(keptLine(`${TODAY}T03:12:00.000Z`))).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.queryByText(/Terakhir diperbarui|tidak ada koneksi/)).toBeNull();
  });

  it("an online phone with a kept copy and a failed read names the copy's time in a ReadError", async () => {
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: `${TODAY}T03:12:00.000Z`,
      data: customerState({ status: "out_for_delivery" }),
    });
    renderHome(
      runtimeWith(async () => {
        throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      }),
    );
    await screen.findByText("Makan siang sedang diantar.");
    // Not "no connection" (the phone is online): the read failed, so the copy may be old, and the page says so.
    const clock = bannerTime(new Date(`${TODAY}T03:12:00.000Z`));
    expect(await screen.findByText(`Belum bisa memperbarui. Menampilkan data terakhir, ${clock}.`)).toBeTruthy();
    expect(screen.queryByText("Tidak ada koneksi")).toBeNull();
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("a read with no cache shows ReadError", async () => {
    const runtime = runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
    });
    renderHome(runtime);
    const page = within(await screen.findByTestId("home-error"));
    expect(page.getByText("Belum bisa memuat. Cek koneksi lalu coba lagi.")).toBeTruthy();
    fireEvent.press(page.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledTimes(2));
  });
});
