import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import * as ReactNative from "react-native";
import { AccessibilityInfo, BackHandler, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { nativeThemes } from "@catera/design-tokens";
import { SHEET_CLOSE_MS } from "@catera/mobile-ui";
import { addDays, jakartaDay, shortDate, type CustomerState, type Delivery } from "@catera/domain";
import { dayActionInput, dayHasActions } from "../src/schedule/dayActions";
import { customerState, delivery, subscription } from "./fixtures";

// A cold real-router mount can pass the default 5 s under machine load, as in the other real-router suites.
jest.setTimeout(30000);

// expo-router's testing library swaps in Reanimated's own jest mock, which has no useReducedMotion (setup.cjs adds it).
// `mockReduced` is the phone's Reduce Motion / Remove animations setting.
let mockReduced = false;
Object.assign(require("react-native-reanimated"), { useReducedMotion: () => mockReduced });

// React Native's jest environment reports a font scale of 2, so the suite states the one it means (1, or 1.3 for the
// larger-font case). The hook module is replaced: components read it through react-native's lazy export.
let mockFontScale = 1;
const WINDOW_HEIGHT = 800;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 800, scale: 2, fontScale: mockFontScale }),
}));

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
/** Beli: buttons that ask its choice sheets the way BuyScreen does, and the answer it got. */
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
          extra: { key: "kelola", label: "Kelola alamat", href: "/pembelian/alamat" },
        }),
      ),
      // A long address book: thirty saved addresses, more than one screen of rows.
      button("Ganti alamat dari buku panjang", () =>
        choose("/pembelian/alamat-pilih", {
          title: "Alamat pengantaran",
          items: Array.from({ length: 30 }, (_, i) => ({ id: `a-${i + 1}`, label: `Alamat ${i + 1}`, detail: `Jl. Contoh No. ${i + 1}` })),
          selected: "a-1",
          extra: { key: "kelola", label: "Kelola alamat", href: "/pembelian/alamat" },
        }),
      ),
      button("Ganti tanggal mulai", () =>
        choose("/pembelian/mulai", { title: "Mulai tanggal", items: [{ id: "2026-10-19", label: "Senin 19 Okt" }], selected: null }),
      ),
    );
  },
}));

/**
 * The platform the question sheets (`/aksi`, `/konfirmasi`, Beli's address picker) run as. Unset, they follow this
 * Android jest run; a test sets "ios" to check the iOS hand-off once the sheet has finished sliding away.
 */
let mockSheetOs: string | undefined;
jest.mock("../app/aksi", () => {
  const { createElement: h } = require("react");
  const { ActionRoute } = require("@catera/mobile-ui");
  return { __esModule: true, default: () => h(ActionRoute, { os: mockSheetOs }) };
});
jest.mock("../app/konfirmasi", () => {
  const { createElement: h } = require("react");
  const { ConfirmRoute } = require("@catera/mobile-ui");
  return { __esModule: true, default: () => h(ConfirmRoute, { os: mockSheetOs }) };
});
jest.mock("../app/pembelian/alamat-pilih", () => {
  const { createElement: h } = require("react");
  const { ChoiceRoute } = require("../src/choice");
  return { __esModule: true, default: () => h(ChoiceRoute, { os: mockSheetOs }) };
});

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

/** The vertical scroll views inside a mounted node (React Native's jest ScrollView renders an RCTScrollView host). */
type Node = Host & { parent: Node | null; findAll: (match: (n: Node) => boolean) => Node[] };
const scrollersIn = (node: unknown) => (node as Node).findAll((n) => n.type === "RCTScrollView" && !n.props.horizontal);
const isInside = (inner: unknown, outer: unknown) => {
  for (let n = inner as Node | null; n; n = n.parent) if (n === outer) return true;
  return false;
};
/** The nearest box around `node` (itself included) whose style sets `key`, and that value. */
const nearestStyle = (node: unknown, key: string) => {
  for (let n = node as Node | null; n; n = n.parent) {
    const value = (StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined)?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
};
/**
 * A fit sheet that can outgrow the screen: its rows (and the button under them) sit in one vertical scroller that may
 * shrink, inside a frame no taller than the window, with the title row fixed above it.
 */
const expectScrollsUnderTitle = (route: string, title: string, reachable: unknown[]) => {
  const sheet = screenOf(route);
  const scrollers = scrollersIn(sheet);
  expect(scrollers).toHaveLength(1);
  const [scroller] = scrollers;
  for (const node of reachable) expect(isInside(node, scroller)).toBe(true);
  expect(isInside(within(sheet as never).getByRole("header", { name: title }), scroller)).toBe(false);
  expect(StyleSheet.flatten(scroller.props.style as never)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  // On Android a drag on the list scrolls it, rather than dragging the bottom sheet.
  expect(scroller.props.nestedScrollEnabled).toBe(true);
  const cap = nearestStyle(scroller.parent, "maxHeight");
  expect(typeof cap).toBe("number");
  expect(cap as number).toBeLessThan(WINDOW_HEIGHT);
};

/** A fit sheet whose whole body may scroll: one vertical scroller that may shrink, inside a frame under the window. */
const expectFitScrolls = (route: string, reachable: unknown[]) => {
  const scrollers = scrollersIn(screenOf(route));
  expect({ route, scrollers: scrollers.length }).toEqual({ route, scrollers: 1 });
  const [scroller] = scrollers;
  for (const node of reachable) expect(isInside(node, scroller)).toBe(true);
  expect(StyleSheet.flatten(scroller.props.style as never)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
  expect(scroller.props.nestedScrollEnabled).toBe(true);
  const cap = nearestStyle(scroller.parent, "maxHeight");
  expect(typeof cap).toBe("number");
  expect(cap as number).toBeLessThan(WINDOW_HEIGHT);
};
/** Waits out the iOS sheet's own slide away, as the question routes do before they answer (renderRouter fakes timers). */
const sheetClosed = async () => {
  act(() => void jest.advanceTimersByTime(SHEET_CLOSE_MS));
  await act(async () => {});
};
/** A sheet that closes on its outcome shows the toast once it is on its way out, so the toast meets the page under it. */
const expectToastAfterBack = async (message: string, run: () => Promise<void>) => {
  const back = jest.spyOn(router, "back");
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
  try {
    await run();
    expect(back).toHaveBeenCalledTimes(1);
    const toast = announce.mock.calls.findIndex(([said]) => said === message);
    expect(toast).toBeGreaterThanOrEqual(0);
    expect(back.mock.invocationCallOrder[0]).toBeLessThan(announce.mock.invocationCallOrder[toast]);
  } finally {
    back.mockRestore();
    announce.mockRestore();
  }
};

beforeEach(() => {
  mockReads.clear();
  mockCommand.mockClear();
  mockReduced = false;
  mockSheetOs = undefined;
  mockFontScale = 1;
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

  it.each([false, true])(
    "the sheets add no motion of their own: the system presents them (reduced motion %s)",
    async (reduced) => {
      // Every sheet is handed to react-native-screens with the platform's own presentation, with or without reduced
      // motion: iOS Reduce Motion cross-fades it and Android Remove animations makes it instant. A custom animation
      // here would slide past the phone's setting.
      mockReduced = reduced;
      answer("ubah-hari:d1", stateWith([open("d1", addDays(TODAY, 2))]));
      answer("ulasan:s-1", stateWith([]));
      const presented = (route: string) => {
        const s = screenOf(route);
        return { route, presentation: s.props.stackPresentation, animation: s.props.stackAnimation };
      };
      const app = await mount("/hari/d1");
      for (const [path, route] of [
        ["/ubah-hari/d1", "ubah-hari/[id]"],
        ["/ulasan/s-1", "ulasan/[id]"],
        ["/alamat-form", "alamat-form"],
        ["/bantuan-form?kind=help", "bantuan-form"],
        ["/area", "area"],
      ] as const) {
        await go(() => router.push(path));
        // No stackAnimation: react-native-screens leaves the presentation to the platform.
        expect(presented(route)).toEqual({ route, presentation: "formSheet", animation: undefined });
        await go(() => router.back());
      }
      app.unmount();
      const beli = await mount("/");
      await go(() => router.push("/beli/p-1"));
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
      expect(presented("pembelian/alamat-pilih")).toEqual({
        route: "pembelian/alamat-pilih",
        presentation: "formSheet",
        animation: undefined,
      });
      beli.unmount();
    },
  );
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
  it("saving an address closes the sheet and toasts Alamat disimpan", () =>
    expectToastAfterBack("Alamat disimpan", async () => {
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
    }));

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

  it("sending a review closes the sheet, toasts Ulasan terkirim and marks the row dealt with", () =>
    expectToastAfterBack("Ulasan terkirim", async () => {
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
    }));

  it("asking for help closes the sheet and toasts Permintaan bantuan terkirim", () =>
    expectToastAfterBack("Permintaan bantuan terkirim", async () => {
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
    }));
});

describe("handing off once a sheet has closed", () => {
  it("on iOS the day's … opens Pindah tanggal only once /aksi has finished sliding away", async () => {
    mockSheetOs = "ios";
    const d = open("d1", addDays(TODAY, 2));
    answer("day:d1", stateWith([d]));
    answer("ubah-hari:d1", stateWith([d]));
    const app = await mount("/hari/d1");
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(d.service_date, "id")}` })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pindah tanggal" })));
    // /aksi has left the stack and is still sliding away: UIKit would refuse a sheet presented over it now.
    expect(root()).toEqual(["(tabs)"]);
    expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
    await sheetClosed();
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "ubah-hari/[id]"]);
    expect(screen.getByRole("tab", { name: "Pindah tanggal" }).props.accessibilityState.selected).toBe(true);
    app.unmount();
  });

  it("on iOS a discard confirm closes the form under it only once the confirm has gone", async () => {
    mockSheetOs = "ios";
    answer("alamat:customer", stateWith([]));
    answer("alamat-form:a-2", stateWith([]));
    const back = hardwareBack();
    try {
      const app = await mount("/alamat");
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah Rumah" })));
      fireEvent.changeText(screen.getByLabelText("Petunjuk pengantaran"), "Pagar hijau");
      await act(async () => {});
      await go(() => void back.press());
      expect(screen.getByRole("header", { name: "Buang alamat?" })).toBeTruthy();
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "alamat", "alamat-form"]);
      await sheetClosed();
      expect(stack("(index)")).toEqual(["index", "alamat"]);
      app.unmount();
    } finally {
      back.restore();
    }
  });

  it("on iOS Beli hears its choice once the picker has gone; a swipe answers as its close ends", async () => {
    mockSheetOs = "ios";
    const app = await mount("/");
    await go(() => router.push("/beli/p-1"));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    await go(() => fireEvent.press(screen.getByRole("radio", { name: "Rumah, Jl. Mawar No. 9" })));
    expect(root()).toEqual(["(tabs)", "beli/[id]"]);
    expect(screen.getByTestId("beli-picked").props.children).toBe("belum");
    await sheetClosed();
    expect(screen.getByTestId("beli-picked").props.children).toBe("a-2");
    // A swipe: UIKit has already finished the slide when it reports the dismissal, and the close transition that
    // follows answers at once.
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    const sheet = screenOf("pembelian/alamat-pilih");
    await go(() => {
      (sheet.props.onDismissed as (e: unknown) => void)({ nativeEvent: { dismissCount: 1 } });
      (sheet.props.onDisappear as () => void)();
    });
    expect(root()).toEqual(["(tabs)", "beli/[id]"]);
    expect(screen.getByTestId("beli-picked").props.children).toBe("null");
    app.unmount();
  });

  it("on Android the asker hears the answer only after /aksi has left the stack", async () => {
    const d = open("d1", TODAY, {}, { status: "out_for_delivery" });
    answer("day:d1", stateWith([d]));
    const original = router.push.bind(router);
    const push = jest.spyOn(router, "push");
    const atPush: string[][] = [];
    push.mockImplementation(((...args: Parameters<typeof router.push>) => {
      atPush.push(root());
      return original(...args);
    }) as never);
    try {
      const app = await mount("/hari/d1");
      push.mockClear();
      atPush.length = 0;
      await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(TODAY, "id")}` })));
      atPush.length = 0;
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Laporkan masalah" })));
      expect(atPush).toEqual([["(tabs)"]]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
      app.unmount();
    } finally {
      push.mockRestore();
    }
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
    // Kelola alamat answers its own key, and the sheet itself opens Alamat over the purchase in its place: one stack
    // change, so Alamat is never presented while the picker is still sliding away. Beli pushes nothing.
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Kelola alamat" })));
    expect(root()).toEqual(["(tabs)", "beli/[id]", "pembelian/alamat"]);
    // Beli is under Alamat now, hidden from the screen reader, with the answer it got.
    expect(screen.getByTestId("beli-picked", { includeHiddenElements: true }).props.children).toBe("kelola");
    app.unmount();
  });

  it("a long address book scrolls under its fixed title: the last address and Kelola alamat stay reachable", async () => {
    const app = await mount("/");
    await go(() => router.push("/beli/p-1"));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat dari buku panjang" })));
    const sheet = within(screenOf("pembelian/alamat-pilih") as never);
    expectScrollsUnderTitle("pembelian/alamat-pilih", "Alamat pengantaran", [
      sheet.getByRole("radio", { name: "Alamat 1, Jl. Contoh No. 1" }),
      sheet.getByRole("radio", { name: "Alamat 30, Jl. Contoh No. 30" }),
      sheet.getByRole("button", { name: "Kelola alamat" }),
    ]);
    // The last address is still a working choice.
    await go(() => fireEvent.press(sheet.getByRole("radio", { name: "Alamat 30, Jl. Contoh No. 30" })));
    expect(root()).toEqual(["(tabs)", "beli/[id]"]);
    expect(screen.getByTestId("beli-picked").props.children).toBe("a-30");
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

  it("the area rows scroll under the fixed title when they outgrow the screen", async () => {
    // Nine rows fit a phone at the default size; a large font on a small phone can pass the screen.
    mockFontScale = 1.3;
    const app = await mount("/jelajah");
    await go(() => router.push("/area"));
    const radios = within(screenOf("area") as never).getAllByRole("radio");
    expectScrollsUnderTitle("area", "Area pengantaran", [radios[0], radios.at(-1)]);
    app.unmount();
  });
});

describe("every fit sheet scrolls once it outgrows the screen", () => {
  it("the action and confirm sheets keep their last row and their buttons reachable at a larger font", async () => {
    mockFontScale = 1.3;
    answer("day:d1", stateWith([open("d1", TODAY, {}, { status: "out_for_delivery" })]));
    answer("alamat:customer", stateWith([]));
    answer("alamat-form:a-2", stateWith([]));
    let app = await mount("/hari/d1");
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(TODAY, "id")}` })));
    const action = within(screenOf("aksi") as never);
    expectFitScrolls("aksi", [action.getByRole("button", { name: "Pindah tanggal" }), action.getByRole("button", { name: "Laporkan masalah" })]);
    await swipeAway("aksi");
    app.unmount();

    const back = hardwareBack();
    try {
      app = await mount("/alamat");
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ubah Rumah" })));
      fireEvent.changeText(screen.getByLabelText("Petunjuk pengantaran"), "Pagar hijau");
      await act(async () => {});
      await go(() => void back.press());
      const confirm = within(screenOf("konfirmasi") as never);
      expectFitScrolls("konfirmasi", [
        confirm.getByRole("header", { name: "Buang alamat?" }),
        confirm.getByRole("button", { name: "Lanjut menulis" }),
        confirm.getByRole("button", { name: "Buang" }),
      ]);
      app.unmount();
    } finally {
      back.restore();
    }
  });
});

describe("states", () => {
  it("signed out: Hari asks to sign in and offers no …, and the sheets ask to sign in", async () => {
    mockSession.actor = null;
    // A day that offers every action to the person it belongs to: today, before the cutoff, on its way, with the
    // caterer's number. Signed out, none of it is shown or offered.
    answer("day:d1", stateWith([open("d1", TODAY, {}, { status: "out_for_delivery" })]));
    const app = await mount("/hari/d1");
    expect(within(screenOf("hari/[id]") as never).getByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Pilihan untuk / })).toBeNull();
    expect(screen.queryByTestId("header-more")).toBeNull();
    await go(() => router.push("/ubah-hari/d1"));
    expect(screen.getByRole("header", { name: "Ubah hari" })).toBeTruthy();
    expect(within(screenOf("ubah-hari/[id]") as never).getByRole("button", { name: "Masuk" })).toBeTruthy();
    app.unmount();
  });

  it("at a larger font the sheets grow with their text: no fixed heights, no cut or capped lines", async () => {
    mockFontScale = 1.3;
    /** Every line of text in the sheet scales with the phone's font and wraps; every row with text grows with it. */
    const expectGrows = (route: string) => {
      const sheet = screenOf(route) as unknown as Node;
      const texts = sheet.findAll((n) => n.type === "Text");
      expect(texts.length).toBeGreaterThan(2);
      for (const text of texts) {
        // The header's context line is the one kept to a single line on purpose: it ends in "…" and is spoken whole.
        if (text.props.testID === "sheet-context") continue;
        // An icon glyph is a picture drawn as text: it keeps its size, as the platforms' own icons do.
        if (/ionicons/i.test(String((StyleSheet.flatten(text.props.style as never) as { fontFamily?: string } | undefined)?.fontFamily))) continue;
        const { numberOfLines, allowFontScaling, maxFontSizeMultiplier } = text.props;
        expect({ route, numberOfLines, allowFontScaling, maxFontSizeMultiplier }).toEqual({
          route,
          numberOfLines: undefined,
          allowFontScaling: undefined,
          maxFontSizeMultiplier: undefined,
        });
      }
      const rows = sheet.findAll(
        (n) => typeof n.type === "string" && ["radio", "button"].includes(n.props.accessibilityRole as string) && n.findAll((m) => m.type === "Text").length > 0,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        const name = row.props.accessibilityLabel;
        expect({ route, name, height: (StyleSheet.flatten(row.props.style as never) as { height?: number } | undefined)?.height }).toEqual({
          route,
          name,
          height: undefined,
        });
      }
    };
    answer("day:d1", stateWith([open("d1", TODAY, {}, { status: "out_for_delivery" })]));
    let app = await mount("/hari/d1");
    // The day's action sheet.
    await go(() => fireEvent.press(screen.getByRole("button", { name: `Pilihan untuk makan siang ${shortDate(TODAY, "id")}` })));
    expectGrows("aksi");
    await swipeAway("aksi");
    // A form sheet.
    await go(() => router.push("/alamat-form"));
    expectGrows("alamat-form");
    app.unmount();
    // The choice sheets: Beli's address picker, whose two-line rows are Material's 72dp list items at the least.
    app = await mount("/");
    await go(() => router.push("/beli/p-1"));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
    expectGrows("pembelian/alamat-pilih");
    expect(StyleSheet.flatten(screen.getByRole("radio", { name: "Rumah, Jl. Mawar No. 9" }).props.style).minHeight).toBe(72);
    app.unmount();
  });

  it.each(["light", "dark"] as const)("a choice sheet reads the %s palette: its ground, title and rows", async (scheme) => {
    const system = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    try {
      const palette = nativeThemes[scheme];
      const app = await mount("/");
      await go(() => router.push("/beli/p-1"));
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Ganti alamat" })));
      const sheet = within(screenOf("pembelian/alamat-pilih") as never);
      const title = sheet.getByRole("header", { name: "Alamat pengantaran" });
      // The sheet's ground is the theme's surface (`sheetOptions`), the title and labels its ink.
      expect(nearestStyle(title, "backgroundColor")).toBe(palette.surface);
      expect(StyleSheet.flatten(title.props.style).color).toBe(palette.charcoal);
      expect(StyleSheet.flatten(sheet.getByText("Kantor").props.style).color).toBe(palette.charcoal);
      expect(StyleSheet.flatten(sheet.getByText("Jl. Contoh No. 1").props.style).color).toBe(palette.muted);
      app.unmount();
    } finally {
      system.mockRestore();
    }
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
