import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import type { ReactElement } from "react";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { type CustomerState, type Offer } from "@catera/domain";
import { nativeMood } from "@catera/design-tokens";
import { MoodArc, MoodHeader, MoodProvider, MoodToggle, ThemeProvider } from "@catera/mobile-ui";
import { Beranda } from "../src/today/Beranda";
import { customerLink } from "../src/links";
import { customerState, delivery, offer, TODAY } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
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
}));

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z"); // 10:00 WIB
const MALAM_NOW = () => new Date("2026-10-09T10:00:00Z"); // 17:00 WIB

const ENDS = {
  siang: { title: "Siang", detail: "2 antaran", label: "Makan siang" },
  malam: { title: "Malam", detail: "17.00", label: "Makan malam" },
};

function mount(ui: ReactElement, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="mood-arc-test">
      <MoodProvider now={now}>{ui}</MoodProvider>
    </ThemeProvider>,
  );
}

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
/** The arc as wide as a 360dp phone's header content (20dp padding each side). */
const layout = (width = 320) =>
  fireEvent(screen.getByTestId("mood-arc"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 120 } } });
const tablists = () =>
  screen.UNSAFE_root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist");
const discAt = () => {
  const t = flat("mood-arc-disc").transform as { translateX?: number; translateY?: number }[];
  return { x: t.find((p) => "translateX" in p)!.translateX!, y: t.find((p) => "translateY" in p)!.translateY! };
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("MoodArc", () => {
  it("the arc is a tablist and switching fires the select haptic", () => {
    mount(<MoodArc {...ENDS} />);
    expect(screen.getByTestId("mood-arc").props.accessibilityRole).toBe("tablist");
    const siang = screen.getByRole("tab", { name: "Makan siang, 2 antaran" });
    const malam = screen.getByRole("tab", { name: "Makan malam, 17.00" });
    expect(siang.props.accessibilityState).toMatchObject({ selected: true });
    expect(malam.props.accessibilityState).toMatchObject({ selected: false });
    // The chosen end has nothing to confirm.
    fireEvent.press(siang);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    fireEvent.press(malam);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "Makan malam, 17.00" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole("tab", { name: "Makan siang, 2 antaran" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("speaks the title when no spoken label is given (English reads Lunch, 2 deliveries)", () => {
    mount(
      <MoodArc siang={{ title: "Lunch", detail: "2 deliveries" }} malam={{ title: "Dinner", detail: "None" }} />,
    );
    expect(screen.getByRole("tab", { name: "Lunch, 2 deliveries", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner, None", selected: false })).toBeTruthy();
  });

  it("gives each end a target of at least 48dp both ways, in a 104dp block at font scale 1.0", () => {
    mount(<MoodArc {...ENDS} />);
    for (const end of ["siang", "malam"]) {
      const s = flat(`mood-arc-tab-${end}`);
      expect(s.width).toBeGreaterThanOrEqual(48);
      const marker = flat(`mood-arc-marker-${end}`);
      expect(marker).toMatchObject({ width: 50, height: 50 });
      // The column stacks its top padding, the marker and the two label lines, with no gaps between them.
      expect(s.gap).toBeUndefined();
      const height =
        (s.paddingTop as number) +
        (marker.height as number) +
        (flat(`mood-arc-title-${end}`).lineHeight as number) +
        (flat(`mood-arc-detail-${end}`).lineHeight as number);
      expect(height).toBeGreaterThanOrEqual(48);
      // The owner-approved canvas gives the arc about 104dp under the headline.
      expect(height).toBe(104);
    }
  });

  it("gives no press feedback on the chosen end, and keeps it on the other", () => {
    const spring = jest.spyOn(Reanimated, "withSpring");
    mount(<MoodArc {...ENDS} />);
    fireEvent(screen.getByTestId("mood-arc-tab-siang"), "pressIn");
    expect(spring).not.toHaveBeenCalled();
    fireEvent(screen.getByTestId("mood-arc-tab-malam"), "pressIn");
    expect(spring).toHaveBeenCalledWith(0.97, expect.anything());
  });

  it("the idle end has the outline ring", () => {
    mount(<MoodArc {...ENDS} />);
    layout();
    // Both ends carry the same 44dp ring, so they read as matching buttons; the disc covers the chosen one.
    for (const end of ["siang", "malam"]) {
      expect(flat(`mood-arc-ring-${end}`)).toMatchObject({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: nativeMood.light.siang.markerIdle,
      });
    }
    expect(flat("mood-arc-disc")).toMatchObject({ width: 44, height: 44, backgroundColor: nativeMood.light.siang.markerActive });
    // The idle end's glyph is markerIdle; the chosen end's glyph rides the disc in onToggleActive.
    const idleMoon = within(screen.getByTestId("mood-arc-ring-malam", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: "moon",
    });
    expect(idleMoon.props.color).toBe(nativeMood.light.siang.markerIdle);
    const discSun = within(screen.getByTestId("mood-arc-disc", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: "sunny",
    });
    expect(discSun.props.color).toBe(nativeMood.light.siang.onToggleActive);
  });

  it.each([
    ["light", "siang"],
    ["light", "malam"],
    ["dark", "siang"],
    ["dark", "malam"],
  ] as const)("paints the %s %s look from the mood tokens", (scheme, mood) => {
    mount(<MoodArc {...ENDS} />, { scheme, now: mood === "siang" ? SIANG_NOW : MALAM_NOW });
    layout();
    const m = nativeMood[scheme][mood];
    expect(flat("mood-arc-disc").backgroundColor).toBe(m.markerActive);
    const idle = mood === "siang" ? "malam" : "siang";
    expect(flat(`mood-arc-ring-${idle}`).borderColor).toBe(m.markerIdle);
    expect(StyleSheet.flatten(screen.getByText("Siang").props.style).color).toBe(m.headerText);
    expect(StyleSheet.flatten(screen.getByText("2 antaran").props.style).color).toBe(m.headerMeta);
    const glyph = within(screen.getByTestId("mood-arc-disc", { includeHiddenElements: true })).UNSAFE_getByProps({
      name: mood === "siang" ? "sunny" : "moon",
    });
    expect(glyph.props.color).toBe(m.onToggleActive);
  });

  it("sets the title bold 13 and the detail 12 in tabular figures", () => {
    mount(<MoodArc {...ENDS} />);
    expect(StyleSheet.flatten(screen.getByText("Siang").props.style)).toMatchObject({ fontSize: 13, fontFamily: "Jakarta-Bold" });
    expect(StyleSheet.flatten(screen.getByText("17.00").props.style)).toMatchObject({
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    });
  });

  it("moves the disc from the sun end to the moon end along the arc, instantly under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(<MoodArc {...ENDS} />);
    layout();
    const sun = discAt();
    // The disc sits centred on the sun marker: the 96dp column's centre minus the disc's radius.
    expect(sun.x).toBe(48 - 22);
    fireEvent.press(screen.getByRole("tab", { name: "Makan malam, 17.00" }));
    const moon = discAt();
    expect(moon.x).toBe(320 - 48 - 22);
    expect(moon.y).toBeCloseTo(sun.y, 6);
    expect(flat("mood-arc-disc").backgroundColor).toBe(nativeMood.light.malam.markerActive);
  });

  it("cross-fades the disc glyph from the sun to the moon, instantly under reduced motion", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(<MoodArc {...ENDS} />);
    layout();
    // Both glyphs ride the disc; only opacity tells them apart, so the moon never shows over the sun marker.
    expect(flat("mood-arc-disc-glyph-siang").opacity).toBe(1);
    expect(flat("mood-arc-disc-glyph-malam").opacity).toBe(0);
    fireEvent.press(screen.getByRole("tab", { name: "Makan malam, 17.00" }));
    expect(flat("mood-arc-disc-glyph-siang").opacity).toBe(0);
    expect(flat("mood-arc-disc-glyph-malam").opacity).toBe(1);
    expect(flat("mood-arc-disc-glyph-malam").transform).toBeUndefined();
  });

  it("follows a switch made elsewhere (the Jelajah meal buttons are the same mood)", () => {
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
    mount(
      <>
        <MoodArc {...ENDS} />
        <MoodToggle />
      </>,
    );
    layout();
    // The toggle tab, whose own label is "Malam" (the arc tab only shows that word as its title).
    fireEvent.press(screen.getAllByRole("tab").find((t) => t.props.accessibilityLabel === "Malam")!);
    expect(screen.getByRole("tab", { name: "Makan malam, 17.00" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(discAt().x).toBe(320 - 48 - 22);
  });

  it("draws the disc and the track once it knows its width, and the chosen end is filled from the first frame", () => {
    mount(<MoodArc {...ENDS} />);
    expect(screen.queryByTestId("mood-arc-disc", { includeHiddenElements: true })).toBeNull();
    // Before layout the chosen end's filled disc sits in its own marker, so neither end looks idle.
    expect(flat("mood-arc-seed-siang-disc")).toMatchObject({
      width: 44,
      height: 44,
      backgroundColor: nativeMood.light.siang.markerActive,
    });
    const seed = screen.getByTestId("mood-arc-seed-siang", { includeHiddenElements: true });
    expect(seed.props.pointerEvents).toBe("none");
    expect(within(seed).UNSAFE_getByProps({ name: "sunny" }).props.color).toBe(nativeMood.light.siang.onToggleActive);
    expect(screen.queryByTestId("mood-arc-seed-malam", { includeHiddenElements: true })).toBeNull();
    layout();
    expect(screen.queryByTestId("mood-arc-seed-siang", { includeHiddenElements: true })).toBeNull();
    const disc = screen.getByTestId("mood-arc-disc", { includeHiddenElements: true });
    expect(disc.props.accessibilityElementsHidden).toBe(true);
    expect(disc.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(disc.props.pointerEvents).toBe("none");
    expect(screen.getByTestId("mood-arc-track", { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  it("arc labels wrap at font scale 1.3 without overlapping (a style check)", () => {
    // Jest has no text layout or font scale, so this checks the styles that let the labels wrap under their markers at
    // any scale; the 360dp, font scale 1.3 look itself is the emulator capture in the Task 9 report.
    mount(
      <MoodArc
        siang={{ title: "Siang", detail: "12 antaran", label: "Makan siang" }}
        malam={{ title: "Malam", detail: "Tidak ada", label: "Makan malam" }}
      />,
    );
    layout(320);
    for (const end of ["siang", "malam"] as const) {
      const column = flat(`mood-arc-tab-${end}`).width as number;
      for (const id of [`mood-arc-title-${end}`, `mood-arc-detail-${end}`]) {
        const node = screen.getByTestId(id);
        const s = StyleSheet.flatten(node.props.style);
        // Each label is held to its marker's column and wraps inside it; it never truncates.
        expect(s.maxWidth).toBe(column);
        expect(s.textAlign).toBe("center");
        expect(node.props.numberOfLines).toBeUndefined();
      }
    }
    // The two columns sit at opposite ends of a 320dp row and leave the middle to the arc.
    const row = flat("mood-arc-row");
    expect(row).toMatchObject({ flexDirection: "row", justifyContent: "space-between" });
    const sum = (flat("mood-arc-tab-siang").width as number) + (flat("mood-arc-tab-malam").width as number);
    expect(sum).toBeLessThan(320);
  });
});

describe("MoodHeader with the arc", () => {
  it("shows the arc under the headline and no toggle in the top row", () => {
    mount(<MoodHeader title="Halo" meta="Jumat 9 Okt" toggle arc={ENDS} />);
    expect(tablists()).toHaveLength(1);
    expect(screen.getByTestId("mood-arc")).toBeTruthy();
    expect(screen.queryByTestId("mood-toggle-pill", { includeHiddenElements: true })).toBeNull();
    expect(within(screen.getByTestId("mood-header-row")).queryByRole("tab")).toBeNull();
    expect(within(screen.getByTestId("mood-header-row")).getByText("Jumat 9 Okt")).toBeTruthy();
  });

  it("has no arc unless asked", () => {
    mount(<MoodHeader title="Halo" />);
    expect(screen.queryByTestId("mood-arc")).toBeNull();
  });
});

describe("Beranda header", () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date(`${TODAY}T05:00:00Z`),
      doNotFake: [
        "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
        "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
        "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      ],
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function runtimeWith(state: CustomerState): MobileRuntime {
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
    runtime.api = {
      ...runtime.api,
      me: jest.fn(async () => ({ actor: { id: "u-c1", role: "customer", name: "Rani Contoh" }, demo: false })),
      customer: jest.fn(async () => state),
      customerActions: jest.fn(async () => ({ total: 0, items: [] })),
      catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
      command: jest.fn(async () => ({})),
    } as unknown as MobileRuntime["api"];
    return runtime;
  }

  const home = (state: CustomerState, now = SIANG_NOW) =>
    mount(
      <MobileProvider runtime={runtimeWith(state)} linkMapper={customerLink}>
        <Beranda />
      </MobileProvider>,
      { now },
    );

  const title = () => screen.getByTestId("home-title").props.children;

  type Item = { id: string; name: string; categoryId?: string };
  const menu = (meal: "lunch" | "dinner", items: Item[], extra: Record<string, unknown> = {}) =>
    ({ meal, name: items.map((i) => i.name).join(", "), description: "", image: "", items, ...extra }) as unknown as Offer["menus"][number];

  /** Today brings one delivery per entry, each its own package and lunch, plus the fixtures' later days. */
  function lunches(...offers: Offer[]): CustomerState {
    const state = customerState(null);
    state.deliveries.unshift(
      ...offers.map((o, i) => delivery(`d-lunch-${i}`, TODAY, {}, { offer: o, meals: [{ meal: "lunch", status: "scheduled" }] })),
    );
    return state;
  }

  it("headline names the main dish", async () => {
    // The main dish is second in the menu; the old headline took the first dish.
    const o = offer({
      menus: [
        menu("lunch", [
          { id: "l-1", name: "Sayur asem", categoryId: "veg" },
          { id: "l-2", name: "Rendang sapi", categoryId: "main" },
        ]),
      ],
    });
    home(lunches(o));
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Siang ini,\nrendang sapi.");
    // One lunch today: the Siang end names when it comes, the Malam end that nothing comes.
    expect(screen.getByRole("tab", { name: "Makan siang, 11.00", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Makan malam, Tidak ada", selected: false })).toBeTruthy();
    expect(screen.getByTestId("mood-arc-detail-siang").props.children).toBe("11.00");
    expect(screen.getByTestId("mood-arc-detail-malam").props.children).toBe("Tidak ada");
  });

  it("headline uses the package name while the menu is not set, never a dish", async () => {
    const o = offer({
      menus: [menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }], { selectionStatus: "pending" })],
    });
    home(lunches(o));
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Siang ini,\nMakan Siang Rumahan.");
  });

  it("counts one delivery under the arc when its window does not start with a time", async () => {
    home(lunches(offer({ windows: { lunch: "siang hari", dinner: "17.00–19.00" } })));
    await screen.findByTestId("plate-hero");
    expect(screen.getByTestId("mood-arc-detail-siang").props.children).toBe("1 antaran");
  });

  it("headline counts two lunches", async () => {
    const first = offer();
    const second = offer({ id: "p-sehat", name: "Paket Sehat", windows: { lunch: "12.00–13.00", dinner: "17.00–19.00" } });
    home(lunches(first, second));
    await screen.findAllByTestId(/^plate-/);
    expect(title()).toBe("Siang ini,\n2 antaran.");
    expect(screen.getByRole("tab", { name: "Makan siang, 2 antaran", selected: true })).toBeTruthy();
    expect(screen.getByTestId("mood-arc-detail-siang").props.children).toBe("2 antaran");
  });

  it("says nothing comes with no plate for the chosen meal, and counts the other meal in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const second = offer({ id: "p-sehat", name: "Paket Sehat" });
    home(lunches(offer(), second), MALAM_NOW);
    await screen.findByTestId("home-title");
    expect(title()).toBe("Dinner tonight,\nno delivery.");
    expect(screen.getByRole("tab", { name: "Lunch, 2 deliveries", selected: false })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner, None", selected: true })).toBeTruthy();
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
  });

  it("switches the headline when the Malam end is tapped, and has one tablist", async () => {
    const dual = offer({
      meal: "both",
      menus: [
        menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }]),
        menu("dinner", [{ id: "d-1", name: "Sate ayam madura" }]),
      ],
    });
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-both", TODAY, {}, {
        offer: dual,
        meals: [
          { meal: "lunch", status: "scheduled" },
          { meal: "dinner", status: "scheduled" },
        ],
      }),
    );
    home(state);
    await screen.findByTestId("plate-hero");
    expect(tablists()).toHaveLength(1);
    fireEvent.press(screen.getByRole("tab", { name: "Makan malam, 17.00" }));
    expect(title()).toBe("Malam ini,\nsate ayam madura.");
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });
});
