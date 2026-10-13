import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import * as ReactNative from "react-native";
import { AccessibilityInfo, BackHandler, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { render } from "@testing-library/react-native";
import { NavigationContext } from "expo-router/react-navigation";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { nativeThemes } from "@catera/design-tokens";
import {
  ActionSheet,
  ANDROID_TAB_BAR,
  androidTabBarHeight,
  canHoldRemoval,
  ConfirmSheet,
  SheetBody,
  SheetHeader,
  ThemeProvider,
  unsavedCopy,
  type ActionSheetInput,
  type ConfirmInput,
} from "@catera/mobile-ui";
import { customerState } from "./fixtures";

// A cold real-router mount can pass the default 5 s under machine load, as in the other real-router suites.
jest.setTimeout(30000);

// expo-router's testing library swaps in Reanimated's own jest mock, which has no useReducedMotion (setup.cjs adds it).
Object.assign(require("react-native-reanimated"), { useReducedMotion: () => false });

/**
 * The real route tree in `app/` with the real root layout (which declares the confirm and action sheets) and the real
 * stack inside each tab (which presents Ada masalah as a form sheet). The session is a stand-in, Beranda is a harness
 * that asks the confirm and action sheets, and Ada masalah is the real screen over a stand-in Hari.
 */
const mockStub = (name: string) => () => createElement(Text, { testID: "screen" }, name);
const mockSession = { demo: false, actor: { id: "u-c1", role: "customer", name: "Rani Contoh" } as null | Record<string, string> };
const mockReads = new Map<string, unknown>();
const mockRead = (key: string) => {
  if (!mockReads.has(key)) mockReads.set(key, { data: undefined, loading: true, error: "", reload: async () => undefined });
  return mockReads.get(key);
};
const answer = (key: string, data: unknown) =>
  mockReads.set(key, { data, loading: false, error: "", reload: async () => undefined });
const mockT = (id: string) => id;
const mockRuntime = { apiBase: "", api: {}, storageKey: (k: string) => `catera.${k}` };
const mockCommand = jest.fn(async () => ({}));

jest.mock("@catera/mobile-core", () => ({
  useMobile: () => ({
    t: mockT,
    locale: "id",
    actor: mockSession.actor,
    ready: true,
    demo: mockSession.demo,
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
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  setNotificationHandler: jest.fn(),
}));
jest.mock("../src/account/Addresses", () => ({ Addresses: mockStub("Alamat") }));
jest.mock("../src/account/Masuk", () => ({ Masuk: mockStub("Masuk") }));
jest.mock("../src/buy/BuyScreen", () => ({ BuyScreen: mockStub("Beli") }));
jest.mock("../src/discover/PackageDetail", () => ({ PackageDetail: mockStub("Paket") }));
jest.mock("../src/schedule/DayScreen", () => ({ DayScreen: mockStub("Hari") }));
jest.mock("../src/help/ReportList", () => ({ ReportList: mockStub("Bantuan") }));

/** What the harness's sheets resolved to, in order. */
const mockResults: unknown[] = [];
const mockConfirmInput: ConfirmInput = {
  title: "Hapus alamat?",
  message: "Alamat ini tidak bisa dipakai lagi.",
  confirmLabel: "Hapus",
  cancelLabel: "Batal",
  tone: "danger",
  icon: "trash",
};
const mockActionInput: ActionSheetInput = {
  title: "Senin 12 Okt",
  items: [
    { key: "lapor", label: "Laporkan masalah", icon: "flag-outline", tone: "danger" },
    { key: "pindah", label: "Pindah tanggal", icon: "calendar-outline" },
    { key: "chat", label: "Chat Dapur Contoh", icon: "chatbubble-outline" },
  ],
  // What the app passes as t("Tutup", "Close") with English chosen.
  closeLabel: "Close",
};
/** Beranda: two buttons that ask the confirm sheet and the action sheet and keep what they resolve to. */
jest.mock("../src/today/Beranda", () => ({
  Beranda: () => {
    const { useActionSheet, useConfirm } = require("@catera/mobile-ui");
    const { createElement: h } = require("react");
    const { Pressable: P, Text: T, View: V } = require("react-native");
    const confirm = useConfirm();
    const actions = useActionSheet();
    const button = (label: string, run: () => Promise<unknown>) =>
      h(P, { accessibilityRole: "button", accessibilityLabel: label, onPress: () => void run().then((r) => mockResults.push(r)) }, h(T, null, label));
    return h(
      V,
      null,
      button("Tanya", () => confirm(mockConfirmInput)),
      button("Pilihan", () => actions(mockActionInput)),
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
  // A cold start has no route behind it; the test router keeps the last render's route between renders.
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

type Host = { type: unknown; props: Record<string, unknown>; parent: Host | null; children: unknown[] };
const hosts = (type: string) => screen.UNSAFE_root.findAll((n) => n.type === type) as unknown as Host[];
/** The native screen react-native-screens gets for a route: the newest one by its route name. */
const screenOf = (route: string) => {
  const found = hosts("RNSScreen").filter((s) => String(s.props.screenId).startsWith(`${route}-`)).at(-1);
  if (!found) throw new Error(`no screen for ${route}`);
  return found;
};
/** The native sheet closing itself under a swipe: react-native-screens reports it dismissed, as on the device. */
const swipeAway = (route: string) =>
  go(() => (screenOf(route).props.onDismissed as (e: unknown) => void)({ nativeEvent: { dismissCount: 1 } }));

/** Every hardware back listener still subscribed; a press runs them newest first until one handles it. */
function hardwareBack() {
  const live: (() => boolean | null | undefined)[] = [];
  const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
    live.push(handler);
    return { remove: () => void live.splice(live.indexOf(handler), 1) };
  });
  return { press: () => [...live].reverse().some((h) => h()), restore: () => spy.mockRestore() };
}

beforeEach(() => {
  mockReads.clear();
  mockResults.length = 0;
  mockCommand.mockClear();
  answer("report:d-today", customerState({ status: "out_for_delivery" }));
});

describe("sheet routes", () => {
  it("masalah is a form sheet with the form detents", async () => {
    const app = await mount("/hari/d-today");
    await go(() => router.push("/masalah/d-today?meal=lunch"));
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
    const sheet = screenOf("masalah/[id]");
    // Opens at 60% and grows to the full height (the keyboard expands it on Android); the sheet draws its own title.
    expect(sheet.props.stackPresentation).toBe("formSheet");
    expect(sheet.props.sheetAllowedDetents).toEqual([0.6, 1]);
    expect(sheet.props.sheetGrabberVisible).toBe(true);
    expect(sheet.props.sheetCornerRadius).toBe(28);
    expect(screen.getByRole("header", { name: "Ada masalah" })).toBeTruthy();
    // The scroll view lets iOS move the focused field above the keyboard.
    expect(within(sheet as never).getByTestId("sheet-body").props.keyboardShouldPersistTaps).toBe("handled");
    // On Android a drag on the form scrolls it, rather than dragging the bottom sheet.
    expect(within(sheet as never).getByTestId("sheet-body").props.nestedScrollEnabled).toBe(true);
    app.unmount();
  });

  it("confirm and action sheets are fit-to-content sheets over everything", async () => {
    const app = await mount("/");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Tanya" })));
    expect(root()).toEqual(["(tabs)", "konfirmasi"]);
    expect(screenOf("konfirmasi").props.stackPresentation).toBe("formSheet");
    expect(screenOf("konfirmasi").props.sheetAllowedDetents).toEqual([-1]);
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Batal" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pilihan" })));
    expect(root()).toEqual(["(tabs)", "aksi"]);
    expect(screenOf("aksi").props.stackPresentation).toBe("formSheet");
    expect(screenOf("aksi").props.sheetAllowedDetents).toEqual([-1]);
    app.unmount();
  });
});

describe("useConfirm", () => {
  it("useConfirm resolves false when the sheet is swiped away", async () => {
    const app = await mount("/");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Tanya" })));
    expect(screen.getByRole("header", { name: "Hapus alamat?" })).toBeTruthy();
    expect(screen.getByText("Alamat ini tidak bisa dipakai lagi.")).toBeTruthy();
    await swipeAway("konfirmasi");
    expect(root()).toEqual(["(tabs)"]);
    expect(mockResults).toEqual([false]);
    app.unmount();
  });

  it("resolves true on confirm and false on cancel and on the hardware back, once each", async () => {
    const back = hardwareBack();
    try {
      const app = await mount("/");
      const ask = () => go(() => fireEvent.press(screen.getByRole("button", { name: "Tanya" })));
      await ask();
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Hapus" })));
      await ask();
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Batal" })));
      await ask();
      await go(() => void back.press());
      expect(root()).toEqual(["(tabs)"]);
      expect(mockResults).toEqual([true, false, false]);
      app.unmount();
    } finally {
      back.restore();
    }
  });

  it("a confirm route with nothing waiting closes itself", async () => {
    const app = await mount("/");
    await go(() => router.push("/konfirmasi?id=gone"));
    expect(root()).toEqual(["(tabs)"]);
    app.unmount();
  });

  it("a cold OS link to the confirm or action route lands on Beranda, never an empty stack", async () => {
    for (const link of ["/konfirmasi?id=9", "/aksi?id=9", "/konfirmasi"]) {
      const app = await mount(link);
      // Nothing is under it to go back to: Beranda replaces it.
      expect(root()).toEqual(["(tabs)"]);
      expect(screen.getByRole("button", { name: "Tanya" })).toBeTruthy();
      app.unmount();
    }
  });

  it("a confirm that leaves without beforeRemove still answers false, and the guarded sheet can then close", async () => {
    const back = hardwareBack();
    try {
      const app = await mount("/hari/d-today");
      await go(() => router.push("/masalah/d-today?meal=lunch"));
      fireEvent.changeText(screen.getByLabelText("Catatan (boleh dikosongkan)"), "Nasinya basi");
      await act(async () => {});
      await go(() => void back.press());
      expect(root()).toEqual(["(tabs)", "konfirmasi"]);
      // The confirm route goes without any action (the container's state is reset), so no beforeRemove reaches it.
      const { store } = require("expo-router/build/global-state/store");
      const ref = store.navigationRef.current;
      const dropConfirm = (node: Nav): Nav => {
        if (!node.state) return node;
        const routes = node.state.routes.filter((r) => r.name !== "konfirmasi").map(dropConfirm);
        return { ...node, state: { ...node.state, routes, index: Math.min(node.state.index, routes.length - 1) } };
      };
      await go(() => ref.resetRoot(dropConfirm({ key: "top", name: "top", state: ref.getRootState() }).state));
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
      // The question was answered (false), so the next close asks again instead of being held forever.
      await go(() => void back.press());
      expect(root()).toEqual(["(tabs)", "konfirmasi"]);
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
      app.unmount();
    } finally {
      back.restore();
    }
  });
});

describe("useActionSheet", () => {
  it("resolves the chosen key, and null when swiped away", async () => {
    const app = await mount("/");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pilihan" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pindah tanggal" })));
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pilihan" })));
    await swipeAway("aksi");
    expect(root()).toEqual(["(tabs)"]);
    expect(mockResults).toEqual(["pindah", null]);
    app.unmount();
  });

  it("speaks Close in the caller's language: the route passes closeLabel to the sheet", async () => {
    const app = await mount("/");
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Pilihan" })));
    expect(screen.UNSAFE_getByType(SheetHeader).props.closeLabel).toBe("Close");
    await swipeAway("aksi");
    app.unmount();
    // On iOS that is the Close button's spoken name; without one it stays "Tutup".
    const ios = render(<ActionSheet {...mockActionInput} onChoose={() => {}} os="ios" />);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    ios.unmount();
    render(<ActionSheet {...mockActionInput} closeLabel={undefined} onChoose={() => {}} os="ios" />);
    expect(screen.getByRole("button", { name: "Tutup" })).toBeTruthy();
  });
});

describe("ActionSheet", () => {
  const rows = () => screen.getAllByTestId(/^action-row-/).map((r) => r.props.testID);
  const tree = (os: string, input: Partial<ActionSheetInput> = {}) =>
    render(<ActionSheet {...mockActionInput} {...input} onChoose={() => {}} os={os} />);

  it("action sheet puts the destructive item last", () => {
    tree("android");
    expect(rows()).toEqual(["action-row-pindah", "action-row-chat", "action-row-lapor"]);
    // A divider separates the destructive row from the rest; the row reads in the danger ink.
    expect(screen.getByTestId("action-divider")).toBeTruthy();
    const danger = screen.getByText("Laporkan masalah");
    expect(StyleSheet.flatten(danger.props.style).color).toBe(nativeThemes.light.danger);
  });

  it("rows are 52pt on iOS and 56dp on Android, and a disabled item cannot be chosen", () => {
    const onChoose = jest.fn();
    const view = render(
      <ActionSheet
        title="Senin 12 Okt"
        items={[{ key: "a", label: "Pindah tanggal", icon: "calendar-outline", disabled: true }]}
        onChoose={onChoose}
        os="ios"
      />,
    );
    const row = screen.getByTestId("action-row-a");
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(52);
    expect(row.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(row);
    expect(onChoose).not.toHaveBeenCalled();
    view.unmount();
    const android = tree("android");
    expect(StyleSheet.flatten(screen.getByTestId("action-row-pindah").props.style).minHeight).toBe(56);
    // No divider when nothing destructive is offered.
    android.unmount();
    tree("android", { items: mockActionInput.items.filter((i) => i.tone !== "danger") });
    expect(screen.queryByTestId("action-divider")).toBeNull();
  });

  it("shows the item it acts on: its photo, name and lines", () => {
    tree("android", { context: { image: "https://img.example/nasi.jpg", title: "Nasi Bakar", lines: ["Makan siang", "Dapur Contoh"] } });
    expect(screen.getByText("Nasi Bakar")).toBeTruthy();
    expect(screen.getByText("Makan siang")).toBeTruthy();
    expect(screen.getByTestId("action-context-image").props.source).toEqual({ uri: "https://img.example/nasi.jpg" });
  });
});

describe("ConfirmSheet", () => {
  const sheet = (os: string, input: Partial<ConfirmInput> = {}) =>
    render(<ConfirmSheet {...mockConfirmInput} {...input} onConfirm={() => {}} onCancel={() => {}} os={os} />);
  const box = (label: string) => StyleSheet.flatten(screen.getByRole("button", { name: label }).props.style);

  it("iOS puts the two buttons side by side, cancel first, the confirm in the danger fill", () => {
    sheet("ios");
    const row = screen.getByTestId("confirm-actions");
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe("row");
    expect(within(row).getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual(["Batal", "Hapus"]);
    expect(box("Batal").flex).toBe(1);
    expect(box("Hapus").backgroundColor).toBe(nativeThemes.light.danger);
  });

  it("Android ends the row with a text button and a filled button", () => {
    sheet("android", { tone: undefined, icon: "rantang" });
    const row = screen.getByTestId("confirm-actions");
    expect(StyleSheet.flatten(row.props.style).justifyContent).toBe("flex-end");
    expect(box("Batal").backgroundColor).toBeUndefined();
    expect(box("Hapus").backgroundColor).toBe(nativeThemes.light.forest);
    expect(screen.getByTestId("confirm-icon-rantang", { includeHiddenElements: true })).toBeTruthy();
  });

  it("TalkBack focus starts on the sheet title", () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    jest.useFakeTimers();
    try {
      sheet("android");
      // Not before the sheet has risen: the reader would still be on the page under it.
      expect(focus).not.toHaveBeenCalled();
      act(() => jest.runOnlyPendingTimers());
      expect(focus).toHaveBeenCalledTimes(1);
      const [target, event] = focus.mock.calls[0] as unknown as [{ props: { children: string; accessibilityRole: string } }, string];
      expect(event).toBe("focus");
      expect(target.props).toMatchObject({ children: "Hapus alamat?", accessibilityRole: "header" });
    } finally {
      jest.useRealTimers();
      focus.mockRestore();
    }
  });

  it("moves the screen reader on the sheet's own present and once more after the settle; the present cancels the fallback", () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    type Ended = (e: { data?: { closing?: boolean } }) => void;
    const listeners: Record<string, Ended[]> = {};
    const navigation = {
      getState: () => ({ type: "stack" }),
      getParent: () => undefined,
      isFocused: () => true,
      addListener: (event: string, cb: Ended) => {
        (listeners[event] ??= []).push(cb);
        return () => void listeners[event].splice(listeners[event].indexOf(cb), 1);
      },
    };
    jest.useFakeTimers();
    try {
      render(
        <NavigationContext.Provider value={navigation as never}>
          <ConfirmSheet {...mockConfirmInput} onConfirm={() => {}} onCancel={() => {}} os="android" />
        </NavigationContext.Provider>,
      );
      // The sheet lands before the fallback: focus at once, again after the settle, and the fallback never fires.
      act(() => listeners.transitionEnd.forEach((cb) => cb({ data: { closing: false } })));
      expect(focus).toHaveBeenCalledTimes(1);
      act(() => jest.runOnlyPendingTimers());
      expect(focus).toHaveBeenCalledTimes(2);
      act(() => jest.runOnlyPendingTimers());
      expect(focus).toHaveBeenCalledTimes(2);
      // A closing transition does not move it.
      act(() => listeners.transitionEnd.forEach((cb) => cb({ data: { closing: true } })));
      act(() => jest.runOnlyPendingTimers());
      expect(focus).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
      focus.mockRestore();
    }
  });
});

describe("sheet states", () => {
  afterEach(() => jest.restoreAllMocks());

  it("the confirm and action sheets read the dark palette", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const dark = nativeThemes.dark;
    render(
      <ThemeProvider storageKey="sheets-theme">
        <ConfirmSheet {...mockConfirmInput} onConfirm={() => {}} onCancel={() => {}} os="android" />
        <ActionSheet {...mockActionInput} onChoose={() => {}} os="android" />
      </ThemeProvider>,
    );
    await act(async () => {});
    const fill = StyleSheet.flatten(screen.getByRole("button", { name: "Hapus" }).props.style).backgroundColor;
    expect(fill).toBe(dark.danger);
    expect(StyleSheet.flatten(screen.getByText("Hapus").props.style).color).toBe(dark.cream);
    expect(StyleSheet.flatten(screen.getByRole("header", { name: "Hapus alamat?" }).props.style).color).toBe(dark.charcoal);
    expect(StyleSheet.flatten(screen.getByText("Laporkan masalah").props.style).color).toBe(dark.danger);
    expect(StyleSheet.flatten(screen.getByText("Pindah tanggal").props.style).color).toBe(dark.charcoal);
  });

  it("at a larger font every row and button grows with its text: no fixed heights, no cut lines", () => {
    render(
      <>
        <ConfirmSheet {...mockConfirmInput} onConfirm={() => {}} onCancel={() => {}} os="ios" />
        <ActionSheet {...mockActionInput} onChoose={() => {}} os="android" />
      </>,
    );
    for (const name of ["Batal", "Hapus", "Pindah tanggal", "Chat Dapur Contoh", "Laporkan masalah"]) {
      const style = StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
      expect({ name, height: style.height }).toEqual({ name, height: undefined });
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
    }
    for (const text of ["Hapus alamat?", "Alamat ini tidak bisa dipakai lagi.", "Pindah tanggal"])
      expect(screen.getByText(text).props.numberOfLines).toBeUndefined();
  });

  it("keyboard: iOS insets the form for the keyboard, and the two-detent Android sheet expands while it is up", () => {
    const ios = render(<SheetBody os="ios">{null}</SheetBody>);
    expect(screen.getByTestId("sheet-body").props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(screen.getByTestId("sheet-body").props.keyboardShouldPersistTaps).toBe("handled");
    ios.unmount();
    render(<SheetBody os="android">{null}</SheetBody>);
    expect(screen.getByTestId("sheet-body").props.automaticallyAdjustKeyboardInsets).toBe(false);
    // react-native-screens expands a sheet with two detents to its top one while the keyboard shows (SheetDelegate).
  });

  it("the discard question speaks to each app in its own voice", () => {
    expect(unsavedCopy("laporan")).toEqual({
      title: "Buang laporan?",
      message: "Yang sudah Anda tulis akan hilang.",
      confirmLabel: "Buang",
      cancelLabel: "Lanjut menulis",
      tone: "danger",
      icon: "trash",
    });
    expect(unsavedCopy("catatan", { voice: "kamu" }).message).toBe("Yang sudah kamu tulis akan hilang.");
    const en = unsavedCopy("alamat", { t: (_id, english) => english, nounEn: "address" });
    expect(en).toMatchObject({ title: "Discard address?", message: "What you wrote will be lost.", confirmLabel: "Discard", cancelLabel: "Keep writing" });
  });
});

describe("Ada masalah as a sheet", () => {
  const typeNote = (text: string) => fireEvent.changeText(screen.getByLabelText("Catatan (boleh dikosongkan)"), text);
  async function onHari() {
    const app = await mount("/hari/d-today");
    await go(() => router.push("/masalah/d-today?meal=lunch"));
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
    return app;
  }

  it("typed text asks before closing, empty does not", async () => {
    const back = hardwareBack();
    try {
      // Nothing typed: back closes the sheet at once and Hari stays.
      let app = await onHari();
      expect(screenOf("masalah/[id]").props.preventNativeDismiss).toBeFalsy();
      await go(() => void back.press());
      expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
      expect(root()).toEqual(["(tabs)"]);
      app.unmount();

      // Typed text: the iOS swipe is held and back asks first.
      app = await onHari();
      typeNote("Nasinya basi");
      await act(async () => {});
      expect(screenOf("masalah/[id]").props.preventNativeDismiss).toBe(true);
      await go(() => void back.press());
      expect(root()).toEqual(["(tabs)", "konfirmasi"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
      expect(screen.getByRole("header", { name: "Buang laporan?" })).toBeTruthy();
      expect(screen.getByText("Yang sudah Anda tulis akan hilang.")).toBeTruthy();
      // Keep writing: the sheet and the text stay.
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Lanjut menulis" })));
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("Nasinya basi");
      // Asked once per close: back again, then Buang closes the sheet and keeps Hari.
      await go(() => void back.press());
      expect(screen.getAllByRole("header", { name: "Buang laporan?" })).toHaveLength(1);
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
      app.unmount();
    } finally {
      back.restore();
    }
  });

  it("a held iOS swipe asks first, an Android swipe cannot be held; Close asks too", async () => {
    // The native stack turns the sheet's own close into a pop naming the sheet. On iOS the swipe was held, so the sheet
    // is still up and the pop can be held; Android's bottom sheet is already gone. Close and back can always be held.
    const pop = { type: "POP", source: "masalah-key" };
    expect(canHoldRemoval(pop, "masalah-key", "ios")).toBe(true);
    expect(canHoldRemoval(pop, "masalah-key", "android")).toBe(false);
    expect(canHoldRemoval({ type: "GO_BACK", source: "masalah-key" }, "masalah-key", "android")).toBe(true);
    expect(canHoldRemoval({ type: "POP" }, "masalah-key", "android")).toBe(true);

    const app = await onHari();
    typeNote("Kurang sambal");
    await act(async () => {});
    // Close at the leading edge of the iOS title row goes back, and asks first.
    await go(() => router.back());
    expect(root()).toEqual(["(tabs)", "konfirmasi"]);
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Lanjut menulis" })));
    expect(stack("(index)")).toEqual(["index", "hari/[id]", "masalah/[id]"]);
    await go(() => router.back());
    expect(root()).toEqual(["(tabs)", "konfirmasi"]);
    await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
    expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
    app.unmount();
  });

  it("in the tab's stack the form ends above the Android tab bar, so Kirim laporan scrolls clear of it", async () => {
    const app = await onHari();
    const body = screen.getByTestId("sheet-body");
    // The bar is 80dp, grown with the font scale (React Native's jest window reports 2), over the system inset (0 in the
    // test's safe area); iOS presents the sheet above the bar.
    const bar = androidTabBarHeight(Dimensions.get("window").fontScale);
    expect(bar).toBeGreaterThanOrEqual(ANDROID_TAB_BAR);
    expect(StyleSheet.flatten(body.props.style).marginBottom).toBe(process.env.EXPO_OS === "ios" ? 0 : bar);
    expect(within(body).getByRole("button", { name: "Kirim laporan" })).toBeTruthy();
    app.unmount();
  });

  it("an Android swipe that already closed the sheet keeps the typed note for next time", async () => {
    let app = await onHari();
    typeNote("Lauknya kurang");
    await act(async () => {});
    // Android's bottom sheet cannot be held, so the sheet is gone; blocking it now would leave a route on no screen.
    await swipeAway("masalah/[id]");
    expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
    expect(root()).toEqual(["(tabs)"]);
    await go(() => router.push("/masalah/d-today?meal=lunch"));
    expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("Lauknya kurang");
    app.unmount();
    // The kept note still asks before it goes; once discarded it is gone.
    const back = hardwareBack();
    try {
      app = await onHari();
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("Lauknya kurang");
      await go(() => void back.press());
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      await go(() => router.push("/masalah/d-today?meal=lunch"));
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("");
      app.unmount();
    } finally {
      back.restore();
    }
  });

  it("a kept note belongs to its delivery and its account: another day or another person opens empty", async () => {
    answer("report:d-next-1", customerState({ status: "out_for_delivery" }));
    const signedIn = mockSession.actor;
    const back = hardwareBack();
    try {
      const app = await onHari();
      typeNote("Lauknya kurang");
      await act(async () => {});
      await swipeAway("masalah/[id]");
      // Another delivery: its own sheet, empty.
      await go(() => router.push("/masalah/d-next-1"));
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("");
      await go(() => void back.press());
      // Another person on the same phone: the same day, empty.
      mockSession.actor = { id: "u-c2", role: "customer", name: "Dewi Contoh" };
      await go(() => router.push("/masalah/d-today?meal=lunch"));
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("");
      await go(() => void back.press());
      // Back as the person who wrote it: the note is still theirs. Discarding it leaves nothing behind.
      mockSession.actor = signedIn;
      await go(() => router.push("/masalah/d-today?meal=lunch"));
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("Lauknya kurang");
      await go(() => void back.press());
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Buang" })));
      expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
      app.unmount();
    } finally {
      mockSession.actor = signedIn;
      back.restore();
    }
  });

  it("sending closes the sheet without asking, even with a note", async () => {
    const back = hardwareBack();
    try {
      const app = await onHari();
      fireEvent.press(screen.getByRole("radio", { name: "Belum sampai" }));
      typeNote("Belum datang");
      await go(() => fireEvent.press(screen.getByRole("button", { name: "Kirim laporan" })));
      await act(async () => {});
      expect(mockCommand).toHaveBeenCalledTimes(1);
      expect(root()).toEqual(["(tabs)"]);
      expect(stack("(index)")).toEqual(["index", "hari/[id]"]);
      expect(screen.getByText("Laporan terkirim")).toBeTruthy();
      // The sent note is not kept as a draft: Ada masalah for that day opens empty.
      await go(() => router.push("/masalah/d-today?meal=lunch"));
      expect(screen.getByLabelText("Catatan (boleh dikosongkan)").props.value).toBe("");
      app.unmount();
    } finally {
      back.restore();
    }
  });
});

// The harness components are referenced through the mock factories only.
void Pressable;
void View;
