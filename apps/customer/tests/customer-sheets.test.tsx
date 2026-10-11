import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { BackHandler, StyleSheet, Text } from "react-native";
import { render } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { addDays, jakartaDay, shortDate, type CustomerState, type Delivery } from "@catera/domain";
import { ChoiceList } from "@catera/mobile-ui";
import { dayActionInput, dayHasActions } from "../src/schedule/dayActions";
import { customerState, delivery, subscription } from "./fixtures";

// A cold real-router mount can pass the default 5 s under machine load, as in the other real-router suites.
jest.setTimeout(30000);

// expo-router's testing library swaps in Reanimated's own jest mock, which has no useReducedMotion (setup.cjs adds it).
Object.assign(require("react-native-reanimated"), { useReducedMotion: () => false });

/**
 * Task 10's sheets on the real route tree in `app/` with the real root layout (Beli's choice sheets, the confirm and
 * action sheets) and the real stack inside each tab (the day's and the account's form sheets). The session and its
 * reads are stand-ins keyed like `useData`; Beli is a harness that asks its two choice sheets through `useChoice`.
 */
const mockSession = { actor: { id: "u-c1", role: "customer", name: "Rani Contoh" } as null | Record<string, string> };
const mockReads = new Map<string, unknown>();
const mockRead = (key: string) => {
  if (!mockReads.has(key)) mockReads.set(key, { data: undefined, loading: true, error: "", reload: async () => undefined });
  return mockReads.get(key);
};
const answer = (key: string, data: unknown) =>
  mockReads.set(key, { data, loading: false, error: "", reload: async () => undefined });
const mockT = (id: string) => id;
const mockRuntime = { apiBase: "", api: {}, storageKey: (k: string) => `catera.${k}` };
const mockCommand = jest.fn(async (..._args: unknown[]) => ({}));

jest.mock("@catera/mobile-core", () => ({
  useMobile: () => ({
    t: mockT,
    locale: "id",
    actor: mockSession.actor,
    ready: true,
    demo: false,
    runtime: mockRuntime,
    command: mockCommand,
    logout: async () => undefined,
  }),
  useTrack: () => () => undefined,
  useData: (key: string) => mockRead(key),
  plural: (n: number, w: string) => `${n} ${w}`,
}));
jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), useFonts: () => [true, null] }));
jest.mock("../src/runtime", () => ({ runtime: { storageKey: (k: string) => `catera.${k}` } }));
jest.mock("../src/shell", () => ({ AppProviders: ({ children }: { children: unknown }) => children }));
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  setNotificationHandler: jest.fn(),
}));
const mockStub = (name: string) => () => createElement(Text, { testID: "screen" }, name);
jest.mock("../src/today/Beranda", () => ({ Beranda: mockStub("Beranda") }));
jest.mock("../src/discover/Jelajah", () => ({ Jelajah: mockStub("Jelajah") }));
jest.mock("../src/help/ReportList", () => ({ ReportList: mockStub("Bantuan") }));
/** Beli: two buttons that ask its choice sheets the way BuyScreen does, and the answer it got. */
jest.mock("../src/buy/BuyScreen", () => ({
  BuyScreen: () => {
    const { useState, createElement: h } = require("react");
    const { Pressable: P, Text: T, View: V } = require("react-native");
    const { useChoice } = require("../src/choice");
    const choose = useChoice();
    const [picked, setPicked] = useState("belum");
    const button = (label: string, run: () => Promise<string | null>) =>
      h(P, { accessibilityRole: "button", accessibilityLabel: label, onPress: () => void run().then((r: string | null) => setPicked(String(r))) }, h(T, null, label));
    return h(
      V,
      null,
      h(T, { testID: "beli-picked" }, picked),
      button("Ganti alamat", () =>
        choose("/pembelian/alamat-pilih", {
          title: "Alamat pengantaran",
          items: [
            { id: "a-1", label: "Kantor", detail: "Jl. Contoh No. 1" },
            { id: "a-2", label: "Rumah", detail: "Jl. Mawar No. 9" },
          ],
          selected: "a-1",
          extra: { key: "kelola", label: "Kelola alamat" },
        }),
      ),
      button("Ganti tanggal mulai", () =>
        choose("/pembelian/mulai", { title: "Mulai tanggal", items: [{ id: "2026-10-19", label: "Senin 19 Okt" }], selected: null }),
      ),
    );
  },
}));

const APP = join(__dirname, "..", "app");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
const appRoutes = () =>
  Object.fromEntries(files(APP).map((file) => [relative(APP, file).split(sep).join("/").replace(/\.tsx?$/, ""), require(file)]));

type Nav = { key: string; name: string; params?: Record<string, unknown>; state?: { key: string; index: number; routes: Nav[] } };
let state: () => { routes: Nav[] };

async function mount(initialUrl = "/") {
  const { storeRef } = require("expo-router/build/global-state/store");
  if (storeRef.current) storeRef.current.routeInfo = undefined;
  const result = renderRouter(appRoutes() as never, { initialUrl });
  state = () => result.getRouterState() as unknown as { routes: Nav[] };
  await act(async () => {});
  return result;
}
const rootStack = () => {
  const top = state();
  return top.routes[0]?.name === "__root" && top.routes[0].state ? top.routes[0].state : (top as Nav["state"])!;
};
const root = () => rootStack().routes.map((r) => r.name);
const tabsState = () => rootStack().routes.find((r) => r.name === "(tabs)")?.state;
const stack = (group: string) => tabsState()?.routes.find((r) => r.name === group)?.state?.routes.map((r) => r.name) ?? [];
const go = async (work: () => void) => {
  act(work);
  await act(async () => {});
};
type Host = { type: unknown; props: Record<string, unknown> };
const screenOf = (route: string) => {
  const found = (screen.UNSAFE_root.findAll((n) => n.type === "RNSScreen") as unknown as Host[])
    .filter((s) => String(s.props.screenId).startsWith(`${route}-`))
    .at(-1);
  if (!found) throw new Error(`no screen for ${route}`);
  return found;
};
const swipeAway = (route: string) =>
  go(() => (screenOf(route).props.onDismissed as (e: unknown) => void)({ nativeEvent: { dismissCount: 1 } }));
function hardwareBack() {
  const live: (() => boolean | null | undefined)[] = [];
  const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    live.push(handler);
    return { remove: () => void live.splice(live.indexOf(handler), 1) };
  });
  return { press: () => [...live].reverse().some((h) => h()), restore: () => spy.mockRestore() };
}

/** The form-sheet and fit-sheet options react-native-screens gets ([-1] is fitToContents). */
const expectSheet = (route: string, detents: "form" | "fit") => {
  const s = screenOf(route);
  expect({ route, presentation: s.props.stackPresentation }).toEqual({ route, presentation: "formSheet" });
  expect({ route, detents: s.props.sheetAllowedDetents }).toEqual({ route, detents: detents === "form" ? [0.6, 1] : [-1] });
  expect(s.props.sheetGrabberVisible).toBe(true);
  expect(s.props.sheetCornerRadius).toBe(28);
};

const TODAY = jakartaDay(new Date());
/** A day whose cutoff is far ahead (everything still allowed) or already past. */
const open = (id: string, date: string, extra: Partial<Delivery> = {}, meal: Partial<Delivery["meals"][number]> = {}) =>
  delivery(id, date, meal, { cutoff_at: "2099-01-01T10:00:00Z", catererPhone: "+6281200000001", ...extra });
const past = (id: string, date: string, extra: Partial<Delivery> = {}, meal: Partial<Delivery["meals"][number]> = {}) =>
  delivery(id, date, meal, { cutoff_at: "2020-01-01T10:00:00Z", catererPhone: "+6281200000001", ...extra });
const stateWith = (deliveries: Delivery[], more: Partial<CustomerState> = {}): CustomerState => ({
  ...customerState(null),
  deliveries,
  addresses: [
    { id: "a-1", label: "Kantor", line: "Jl. Contoh No. 1", area: "Tebet", city: "Jakarta Selatan", instructions: "", version: 1 },
    { id: "a-2", label: "Rumah", line: "Jl. Mawar No. 9", area: "Tebet", city: "Jakarta Selatan", instructions: "", version: 3 },
  ],
  ...more,
});
const rowLabels = () =>
  (screen.UNSAFE_root.findAll((n) => typeof n.props.testID === "string" && n.props.testID.startsWith("action-row-") && typeof n.type === "string") as unknown as Host[]).map(
    (n) => n.props.accessibilityLabel,
  );

beforeEach(() => {
  mockReads.clear();
  mockCommand.mockClear();
  mockSession.actor = { id: "u-c1", role: "customer", name: "Rani Contoh" };
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("routes", () => {
  it("each short task opens as a form sheet", async () => {
    answer("ubah-hari:d1", stateWith([open("d1", addDays(TODAY, 2))]));
    answer("ulasan:s-1", stateWith([]));
    const app = await mount("/hari/d1");
    for (const [path, route, detents] of [
      ["/ubah-hari/d1", "ubah-hari/[id]", "form"],
      ["/ulasan/s-1", "ulasan/[id]", "form"],
      ["/alamat-form", "alamat-form", "form"],
      ["/bantuan-form?kind=help", "bantuan-form", "form"],
      ["/area", "area", "fit"],
    ] as const) {
      await go(() => router.push(path));
      expectSheet(route, detents);
      // Each draws its own title row: the stack header is hidden.
      expect(within(screenOf(route) as never).getAllByRole("header").length).toBeGreaterThan(0);
      await go(() => router.back());
    }
    app.unmount();

    // Beli's pickers sit in the root stack over the purchase; the address and help forms do too, from Alamat or Bantuan
    // opened over it.
    const beli = await mount("/");
    await go(() => router.push("/beli/p-1"));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    expect(root()).toEqual(["(tabs)", "beli/[id]", "pembelian/alamat-pilih"]);
    expectSheet("pembelian/alamat-pilih", "fit");
    await go(() => fireEvent.press(screen.getByRole("radio", { name: "Rumah, Jl. Mawar No. 9" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti tanggal mulai" })));
    expectSheet("pembelian/mulai", "fit");
    await go(() => fireEvent.press(screen.getByRole("radio", { name: "Senin 19 Okt" })));
    await go(() => router.push("/pembelian/alamat-form"));
    expectSheet("pembelian/alamat-form", "form");
    await go(() => router.back());
    await go(() => router.push("/pembelian/bantuan-form?kind=help"));
    expectSheet("pembelian/bantuan-form", "form");
    beli.unmount();
  });

  it("the sheets add no motion of their own: under reduced motion the system presents them", async () => {
    // The sheet routes set no custom animation, so iOS (Reduce Motion: a cross-fade) and Android (Remove animations:
    // instant) present them their own way; their content enters through FadeSwap, which is static under reduced motion.
    const layout = readFileSync(join(APP, "(tabs)", "(index,jadwal,jelajah,akun)", "_layout.tsx"), "utf8");
    for (const name of ["ubah-hari/[id]", "ulasan/[id]", "alamat-form", "bantuan-form", "area"])
      expect(layout).toMatch(new RegExp(`name="${name.replace(/[[\]/]/g, "\\$&")}" options=\\{sheetOptions\\(`));
    const { sheetOptions } = require("@catera/mobile-ui");
    expect(sheetOptions({ detents: "form", palette: {} as never })).not.toHaveProperty("animation");
  });
});

describe("the day's actions", () => {
  it("the day's … sheet lists only allowed actions, report last", async () => {
    // Before the cutoff, today, on its way, with the caterer's number: every action, the report last.
    answer("day:d1", stateWith([open("d1", TODAY, {}, { status: "out_for_delivery" })]));
    let app = await mount("/hari/d1");
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(TODAY, "id")}` })));
    expect(root()).toEqual(["(tabs)", "aksi"]);
    expect(rowLabels()).toEqual(["Pindah tanggal", "Ganti alamat hari ini", "Chat Dapur Contoh", "Laporkan masalah"]);
    expect(screen.getByTestId("action-divider")).toBeTruthy();
    // The context names what the actions are about.
    const context = within(screen.getByTestId("action-context"));
    expect(context.getByText("Makan siang · Dapur Contoh")).toBeTruthy();
    expect(context.getByText(/^Bisa diubah sampai /)).toBeTruthy();
    // Laporkan masalah opens Ada masalah for that meal over Hari.
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Laporkan masalah" })));
    expect(root()).toEqual(["(tabs)"]);
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
    app.unmount();

    // After the cutoff: no Pindah tanggal, no Ganti alamat hari ini.
    answer("day:d1", stateWith([past("d1", TODAY, {}, { status: "out_for_delivery" })]));
    app = await mount("/hari/d1");
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(TODAY, "id")}` })));
    expect(rowLabels()).toEqual(["Chat Dapur Contoh", "Laporkan masalah"]);
    expect(within(screen.getByTestId("action-context")).getByText("Sudah lewat batas ubah")).toBeTruthy();
    // Pindah tanggal and Ganti alamat open Ubah hari on their side.
    await swipeAway("aksi");
    app.unmount();
  });

  it("Pindah tanggal and Ganti alamat open Ubah hari on their side over the day", async () => {
    const d = open("d1", addDays(TODAY, 2));
    answer("day:d1", stateWith([d]));
    answer("ubah-hari:d1", stateWith([d]));
    const app = await mount("/hari/d1");
    const more = () => screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(d.service_date, "id")}` });
    await go(() => fireEvent.press(more()));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat hari ini" })));
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "ubah-hari/[id]"]);
    expect(screen.getByRole("tab", { name: "Ganti alamat" }).props.accessibilityState.selected).toBe(true);
    app.unmount();
  });

  it("each item shows only when allowed: a fixed plan, no caterer phone, a day already reported, nothing at all", () => {
    const now = new Date();
    const items = (d: Delivery, meal?: "lunch" | "dinner") =>
      dayActionInput(d, now, { t: mockT, locale: "id", apiBase: "https://api.test", meal }).input.items.map((i) => i.key);
    // A fixed plan cannot move its days, but its address can still change for the day.
    expect(items(open("d1", addDays(TODAY, 2), { canChange: false }))).toEqual(["alamat", "chat"]);
    // No verified number in the read: no chat.
    expect(items(open("d1", addDays(TODAY, 2), { catererPhone: null }))).toEqual(["pindah", "alamat"]);
    // A meal already reported (open report) offers no second report; a resolved one may be reported again.
    const reported = open("d1", TODAY, {}, { status: "out_for_delivery", issue: { id: "i1", status: "open" } });
    expect(items(reported)).toEqual(["pindah", "alamat", "chat"]);
    const resolved = open("d1", TODAY, {}, { status: "out_for_delivery", issue: { id: "i1", status: "resolved" } });
    expect(items(resolved)).toContain("lapor");
    // After the cutoff, no number, nothing to report: the "…" is not drawn at all.
    const nothing = past("d1", addDays(TODAY, 2), { catererPhone: null });
    expect(items(nothing)).toEqual([]);
    expect(dayHasActions(nothing, now)).toBe(false);
    expect(dayHasActions(undefined, now)).toBe(false);
    // The context: the meal's photo through the API base, the main dish or "Menu belum ditentukan".
    const opts = { t: mockT, locale: "id" as const, apiBase: "https://api.test" };
    const { input } = dayActionInput(open("d1", addDays(TODAY, 2)), now, opts);
    expect(input.title).toBe(shortDate(addDays(TODAY, 2), "id"));
    expect(input.context).toEqual({
      // The menu has no photo of its own, so the package's.
      image: "https://images.example.test/rumahan.jpg",
      title: "Ayam bakar madu",
      lines: ["Makan siang · Dapur Contoh", expect.stringMatching(/^Bisa diubah sampai /)],
    });
    expect(input.closeLabel).toBe("Tutup");
    // A menu not set yet, and a site-relative photo through the API base.
    const unset = open("d1", addDays(TODAY, 2), {
      offer: { ...open("d1", TODAY).offer, menus: [], image: "/food/rumahan.jpg" },
    });
    expect(dayActionInput(unset, now, opts).input.context).toMatchObject({
      image: "https://api.test/food/rumahan.jpg",
      title: "Menu belum ditentukan",
    });
  });
});

describe("outcomes", () => {
  it("saving an address closes the sheet and toasts Alamat disimpan", async () => {
    answer("alamat:customer", stateWith([]));
    const app = await mount("/alamat");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Tambah alamat" })));
    expect(stack("(index)")).toEqual(["index", "alamat", "alamat-form"]);
    expect(screen.getByRole("header", { name: "Alamat baru" })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Jalan, nomor, detail"), "Jl. Kenanga No. 4");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" })));
    expect(mockCommand).toHaveBeenCalledWith(
      "address.save",
      expect.objectContaining({ label: "Rumah", line: "Jl. Kenanga No. 4", area: "Jakarta Selatan", city: "Jakarta" }),
    );
    await act(async () => {});
    expect(stack("(index)")).toEqual(["index", "alamat"]);
    expect(screen.getByText("Alamat disimpan")).toBeTruthy();
    app.unmount();
  });

  it("an edited address with typed changes asks before closing; nothing typed closes at once", async () => {
    answer("alamat:customer", stateWith([]));
    answer("alamat-form:a-2", stateWith([]));
    const back = hardwareBack();
    try {
      const app = await mount("/alamat");
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah Rumah" })));
      expect(screen.getByRole("header", { name: "Ubah alamat" })).toBeTruthy();
      expect(screen.getByLabelText("Jalan, nomor, detail").props.value).toBe("Jl. Mawar No. 9");
      await go(() => void back.press());
      expect(stack("(index)")).toEqual(["index", "alamat"]);
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah Rumah" })));
      fireEvent.changeText(screen.getByLabelText("Petunjuk pengantaran"), "Pagar hijau");
      await act(async () => {});
      await go(() => void back.press());
      expect(screen.getByRole("header", { name: "Buang alamat?" })).toBeTruthy();
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      expect(stack("(index)")).toEqual(["index", "alamat"]);
      // The edit sends the address's version.
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah Rumah" })));
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Simpan alamat" })));
      expect(mockCommand).toHaveBeenCalledWith("address.save", expect.objectContaining({ id: "a-2", version: 3 }));
      app.unmount();
    } finally {
      back.restore();
    }
  });

  it("moving a day toasts the new date", async () => {
    const d = open("d1", addDays(TODAY, 2));
    const target = addDays(TODAY, 9);
    answer("day:d1", stateWith([d]));
    answer("ubah-hari:d1", stateWith([d]));
    answer(`availability:d1:${TODAY}`, [{ date: target, available: true, reason: null, remaining: 3 }]);
    const app = await mount("/hari/d1");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah hari" })));
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "ubah-hari/[id]"]);
    // The sheet's title is the day, its context the package and caterer.
    expect(within(screenOf("ubah-hari/[id]") as never).getByTestId("sheet-context").props.children).toBe(
      "Makan Siang Rumahan · Dapur Contoh",
    );
    await go(() => fireEvent.press(screen.getByRole("button", { name: shortDate(target, "id") })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pindah ke ${shortDate(target, "id")}` })));
    expect(mockCommand).toHaveBeenCalledWith("delivery.reschedule", { id: "d1", version: 1, date: target, kind: "reschedule" });
    await act(async () => {});
    expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
    expect(screen.getByText(`Hari dipindah ke ${shortDate(target, "id")}`)).toBeTruthy();
    app.unmount();
  });

  it("sending a review closes the sheet, toasts Ulasan terkirim and marks the row dealt with", async () => {
    answer("ulasan:s-1", stateWith([], { subscriptions: [subscription()] }));
    const app = await mount("/");
    await go(() => router.push("/ulasan/s-1"));
    expect(screen.getByRole("header", { name: "Ulasan untuk Dapur Contoh" })).toBeTruthy();
    await go(() => fireEvent.press(screen.getByRole("button", { name: "4 bintang" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Kirim ulasan" })));
    expect(mockCommand).toHaveBeenCalledWith(
      "review.save",
      expect.objectContaining({ subscriptionId: "s-1", rating: 4, food: 4, delivery: 4, value: 4 }),
    );
    await act(async () => {});
    expect(stack("(index)")).toEqual(["index"]);
    expect(screen.getByText("Ulasan terkirim")).toBeTruthy();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-1", "done");
    app.unmount();
  });

  it("asking for help closes the sheet and toasts Permintaan bantuan terkirim", async () => {
    answer("bantuan-form:customer", stateWith([], { subscriptions: [subscription()] }));
    const app = await mount("/bantuan");
    await go(() => router.push("/bantuan-form?kind=help"));
    expect(screen.getByRole("header", { name: "Minta bantuan" })).toBeTruthy();
    await go(() => fireEvent.press(screen.getByRole("tab", { name: "Pembatalan" })));
    fireEvent.changeText(screen.getByLabelText("Ceritakan kendalanya"), "Saya pindah kota bulan depan.");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" })));
    expect(mockCommand).toHaveBeenCalledWith("support.create", {
      subscriptionId: "s-1",
      subject: "Pembatalan",
      description: "Saya pindah kota bulan depan.",
    });
    await act(async () => {});
    expect(stack("(index)")).toEqual(["index", "bantuan"]);
    expect(screen.getByText("Permintaan bantuan terkirim")).toBeTruthy();
    app.unmount();
  });
});

describe("Beli and its sheets", () => {
  it("Beli's choice sheets sit over the purchase: a choice returns to it, Close or a swipe leaves it as it was", async () => {
    const app = await mount("/");
    await go(() => router.push("/beli/p-1"));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    // The current address is marked; Kelola alamat is under the list.
    expect(screen.getByRole("radio", { name: "Kantor, Jl. Contoh No. 1" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole("button", { name: "Kelola alamat" })).toBeTruthy();
    await swipeAway("pembelian/alamat-pilih");
    expect(root()).toEqual(["(tabs)", "beli/[id]"]);
    expect(screen.getByTestId("beli-picked").props.children).toBe("null");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    await go(() => fireEvent.press(screen.getByRole("radio", { name: "Rumah, Jl. Mawar No. 9" })));
    expect(root()).toEqual(["(tabs)", "beli/[id]"]);
    expect(screen.getByTestId("beli-picked").props.children).toBe("a-2");
    // Kelola alamat answers its own key; Beli then opens Alamat over the purchase.
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Kelola alamat" })));
    expect(screen.getByTestId("beli-picked").props.children).toBe("kelola");
    app.unmount();
  });

  it("a cold link to a Beli choice sheet has no purchase to choose for: it lands on Beranda", async () => {
    const app = await mount("/pembelian/mulai?id=9");
    expect(root()).toEqual(["(tabs)"]);
    app.unmount();
  });
});

describe("Jelajah's area", () => {
  it("with no area kept nothing is marked; a choice keeps it and closes the sheet", async () => {
    const app = await mount("/jelajah");
    await go(() => router.push("/area"));
    expect(screen.getByRole("header", { name: "Area pengantaran" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios[0].props.accessibilityLabel).toBe("Semua area");
    expect(radios.every((r) => !r.props.accessibilityState.checked)).toBe(true);
    await go(() => fireEvent.press(screen.getByRole("radio", { name: "Jakarta Selatan" })));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.area", "Jakarta Selatan");
    expect(stack("(jelajah)").at(-1)).not.toBe("area");
    // Next time the kept area is marked.
    await go(() => router.push("/area"));
    expect(screen.getByRole("radio", { name: "Jakarta Selatan" }).props.accessibilityState.checked).toBe(true);
    app.unmount();
  });
});

describe("states", () => {
  it("signed out: the sheets ask to sign in and no day offers a …", async () => {
    mockSession.actor = null;
    const app = await mount("/");
    await go(() => router.push("/ubah-hari/d1"));
    expect(screen.getByRole("header", { name: "Ubah hari" })).toBeTruthy();
    expect(within(screenOf("ubah-hari/[id]") as never).getByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryByTestId("header-more")).toBeNull();
    app.unmount();
  });

  it("at a larger font the choice rows grow with their text: no fixed heights, no cut lines", () => {
    render(
      <ChoiceList
        label="Alamat pengantaran"
        options={[{ value: "a-1", label: "Kantor", detail: "Jl. Contoh No. 1, sebuah alamat yang panjang sekali" }]}
        value="a-1"
        onChange={() => {}}
        os="android"
      />,
    );
    const row = StyleSheet.flatten(screen.getByRole("radio", { name: /Kantor/ }).props.style);
    expect(row.height).toBeUndefined();
    // Material's two-line list item.
    expect(row.minHeight).toBe(72);
    expect(screen.getByText(/sebuah alamat yang panjang/).props.numberOfLines).toBeUndefined();
  });
});

describe("the custom Sheet", () => {
  it("the custom Sheet is no longer imported by the customer app", () => {
    const root = join(__dirname, "..");
    const sources = [...files(join(root, "src")), ...files(join(root, "app"))].filter((f) => /\.tsx?$/.test(f));
    const importing = sources.filter((file) => {
      const text = readFileSync(file, "utf8");
      const named = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@catera\/mobile-ui"/g)].flatMap((m) =>
        m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]),
      );
      return named.includes("Sheet");
    });
    expect(importing).toEqual([]);
    // The component itself is gone from the shared package.
    expect(require("@catera/mobile-ui").Sheet).toBeUndefined();
  });
});
