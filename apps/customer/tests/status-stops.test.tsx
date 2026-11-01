import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { type CustomerState, type Delivery, type Offer, type Plate } from "@catera/domain";
import { nativeLayout, nativeMood } from "@catera/design-tokens";
import { HeroPager, LayoutScaleProvider, MoodProvider, ThemeProvider, useMood, withAlpha } from "@catera/mobile-ui";
import { Beranda, HERO_BAND_OVERLAP } from "../src/today/Beranda";
import { STATUS_PILL, StatusStops, type StopInfo } from "../src/today/StatusStops";
import { stateLabel, statementFor } from "../src/today/Plate";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { customerState, delivery, offer, TODAY } from "./fixtures";
import { goOffline, goOnline } from "./offline";

/** Jest's own window at the default text size, so the type ramp's line heights hold (above 1, Android drops them). */
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 750, height: 1334, scale: 2, fontScale: 1 }),
}));

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
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const SIANG_NOW = () => new Date("2026-10-09T03:00:00Z"); // 10:00 WIB
const MALAM_NOW = () => new Date("2026-10-09T10:00:00Z"); // 17:00 WIB

// Both meals' heroes stay mounted, the other one offstage and hidden from screen readers: the node on screen wins over
// its hidden twin.
const nodeOf = (id: string) => {
  const shown = screen.queryAllByTestId(id);
  return shown.length === 1 ? shown[0] : screen.getByTestId(id, { includeHiddenElements: true });
};
const flat = (id: string) => StyleSheet.flatten(nodeOf(id).props.style);
const flatOf = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
/** The pill learns its width from layout; the door is sized from it. */
const layout = (width: number) =>
  act(() => fireEvent(screen.getByTestId("status-stops"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 60 } } }));
const translateX = (node: { props: { style?: unknown } }) =>
  ((flatOf(node).transform as { translateX?: number }[] | undefined) ?? []).find((t) => "translateX" in t)?.translateX;

let seen: ReturnType<typeof useMood>;
function Probe() {
  seen = useMood();
  return null;
}

function mount(ui: React.ReactElement, { now = SIANG_NOW, scheme = "light" as "light" | "dark" } = {}) {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
  return render(
    <ThemeProvider storageKey="status-stops-test">
      <MoodProvider now={now}>
        <LayoutScaleProvider value="v2">
          {ui}
          <Probe />
        </LayoutScaleProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

const LUNCH: StopInfo = { window: "11.00–13.00", state: "Sedang diantar" };
const DINNER: StopInfo = { window: "17.00–19.00", state: "Sate ayam madura" };

/** The status line alone, under the app's runtime for its translator (its session read never answers, so nothing updates). */
const quietRuntime = () => {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = { ...runtime.api, me: jest.fn(() => new Promise(() => undefined)) } as unknown as MobileRuntime["api"];
  return runtime;
};
const Stops = (props: React.ComponentProps<typeof StatusStops>) => (
  <MobileProvider runtime={quietRuntime()} linkMapper={customerLink}>
    <StatusStops {...props} />
  </MobileProvider>
);

/** Mounts and lets the provider's boot read settle inside act, so no update lands after the test. */
async function settled(ui: React.ReactElement, options?: Parameters<typeof mount>[1]) {
  const view = mount(ui, options);
  await act(async () => {});
  return view;
}

describe("StatusStops", () => {
  it("is a tablist of two tabs, the chosen mood selected, named by meal, window and state", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    expect(screen.getByTestId("status-stops").props.accessibilityRole).toBe("tablist");
    const siang = screen.getByRole("tab", { name: "Makan siang, 11.00–13.00, Sedang diantar" });
    const malam = screen.getByRole("tab", { name: "Makan malam, 17.00–19.00, Sate ayam madura" });
    expect(siang.props.accessibilityState).toMatchObject({ selected: true });
    expect(malam.props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId("status-stop-lunch")).toBe(siang);
    expect(screen.getByTestId("status-stop-dinner")).toBe(malam);
  });

  it("slides a toggleActive door over the chosen half once it knows its width, hidden from screen readers, and moves it on a switch", async () => {
    jest.spyOn(require("react-native-reanimated"), "useReducedMotion").mockReturnValue(true);
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    // No width yet, so no door to size.
    expect(screen.queryByTestId("status-stops-door", { includeHiddenElements: true })).toBeNull();
    layout(303);
    const door = () => screen.getByTestId("status-stops-door", { includeHiddenElements: true });
    // Inside the 1.5 edges the pill is 300 wide: the door is half of it less the 4 gap, and starts over Siang.
    expect(flatOf(door())).toMatchObject({ width: 146, backgroundColor: nativeMood.light.siang.toggleActive, borderRadius: 999 });
    expect(translateX(door())).toBe(0);
    // Drawing only: it takes no touches, and screen readers hear the tab's selected state instead.
    expect(door().props.pointerEvents).toBe("none");
    expect(screen.queryByTestId("status-stops-door")).toBeNull();
    // Under reduced motion it jumps the whole way.
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(translateX(door())).toBe(146);
  });

  it("puts a sun on the Siang half and a moon on the Malam half, and the door carries its own copy of both in onToggleActive", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    layout(303);
    const palette = nativeMood.light.siang;
    const glyph = (id: string) => within(screen.getByTestId(`status-stop-${id}`)).UNSAFE_getByType(Ionicons).props;
    expect(glyph("lunch")).toMatchObject({ name: "sunny", color: palette.heroText });
    expect(glyph("dinner")).toMatchObject({ name: "moon", color: palette.heroText });
    const door = within(screen.getByTestId("status-stops-door", { includeHiddenElements: true }));
    expect(door.UNSAFE_getAllByType(Ionicons).map((g) => [g.props.name, g.props.color])).toEqual([
      ["sunny", palette.onToggleActive],
      ["moon", palette.onToggleActive],
    ]);
    for (const text of ["Siang", "Sedang diantar", "Malam", "Sate ayam madura"]) {
      expect(flatOf(door.getByText(text, { includeHiddenElements: true })).color).toBe(palette.onToggleActive);
    }
    // The copy is drawing only: each meal's label testID is on the track's half alone.
    expect(screen.getAllByTestId("status-stop-lunch-label", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("pressing the Malam stop sets the app-wide mood and fires the select haptic once; the chosen stop confirms nothing", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    fireEvent.press(screen.getByTestId("status-stop-lunch"));
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(seen.mood).toBe("siang");
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(seen.mood).toBe("malam");
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("follows a mood set elsewhere (Jelajah's meal tabs are the same mood)", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    act(() => seen.setMood("malam"));
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("is one 60 tall pill with the 1.5 heroEdge, two tabs sharing it evenly, the meal in bodyStrong 700 over the state in meta", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    expect(STATUS_PILL).toBe(60);
    expect(flat("status-stops")).toMatchObject({ flexDirection: "row", minHeight: STATUS_PILL, borderRadius: 999, borderWidth: 1.5 });
    // A whole half is the target, well past 44.
    expect(STATUS_PILL).toBeGreaterThanOrEqual(nativeLayout.control.icon);
    for (const id of ["status-stop-lunch", "status-stop-dinner"]) expect(flat(id)).toMatchObject({ flex: 1 });
    expect(flatOf(screen.getByTestId("status-stop-lunch-label"))).toMatchObject({ fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-Bold" });
    expect(flatOf(screen.getByText("Sedang diantar"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    // Wraps instead of truncating at a large font.
    expect(screen.getByText("Sedang diantar").props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId("status-stop-lunch-label").props.numberOfLines).toBeUndefined();
  });

  it("labels each half by its meal alone: the window is in the tab's spoken name, never shown on the switch", async () => {
    await settled(<Stops lunch={{ window: null, state: "2 pengantaran" }} dinner={DINNER} />);
    expect(screen.getByTestId("status-stop-lunch-label").props.children).toBe("Siang");
    expect(screen.getByTestId("status-stop-dinner-label").props.children).toBe("Malam");
    expect(screen.queryByText(/17\.00–19\.00/)).toBeNull();
    expect(screen.getByRole("tab", { name: "Makan malam, 17.00–19.00, Sate ayam madura" })).toBeTruthy();
    // A meal with no single window is spoken by its name and state alone.
    expect(screen.getByRole("tab", { name: "Makan siang, 2 pengantaran" })).toBeTruthy();
    // No track line and no markers any more: the pill is the whole switch.
    expect(screen.queryByTestId("status-stops-track", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("status-stop-lunch-marker", { includeHiddenElements: true })).toBeNull();
  });

  it.each(["light", "dark"] as const)("paints the pill from the %s theme's toggle tokens, the door over the chosen Malam", async (scheme) => {
    jest.spyOn(require("react-native-reanimated"), "useReducedMotion").mockReturnValue(true);
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />, { scheme, now: MALAM_NOW });
    layout(303);
    const palette = nativeMood[scheme].malam;
    expect(flat("status-stops")).toMatchObject({ backgroundColor: palette.toggleTrack, borderColor: palette.heroEdge });
    const door = screen.getByTestId("status-stops-door", { includeHiddenElements: true });
    expect(flatOf(door).backgroundColor).toBe(palette.toggleActive);
    expect(translateX(door)).toBe(146);
    // Sunrise ink stays the tracker's current stop alone.
    expect(flatOf(door).backgroundColor).not.toBe(palette.stopActive);
  });

  it("withAlpha turns a hex colour into the same colour at a fraction of its strength", () => {
    expect(withAlpha("#2E2E2E", 0.16)).toBe("rgba(46,46,46,0.16)");
    expect(withAlpha("#F5F1E8", 1)).toBe("rgba(245,241,232,1)");
  });

  it("shows the choice with the door and the tab's selected state, not the label: both meals keep the same ink and weight", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    const label = (id: string) => flatOf(screen.getByTestId(`status-stop-${id}-label`));
    const ink = { color: nativeMood.light.siang.heroText, fontFamily: "Jakarta-Bold" };
    expect(label("lunch")).toMatchObject(ink);
    expect(label("dinner")).toMatchObject(ink);
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(label("lunch")).toMatchObject(ink);
    expect(label("dinner")).toMatchObject(ink);
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
  });

  it.each([
    ["siang", SIANG_NOW],
    ["malam", MALAM_NOW],
  ] as const)("reads the hero inks on the %s track: the meal in heroText, the state in heroMeta", async (mood, now) => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />, { now });
    const palette = nativeMood.light[mood];
    expect(flatOf(screen.getByTestId("status-stop-dinner-label")).color).toBe(palette.heroText);
    expect(flatOf(screen.getByText("Sate ayam madura")).color).toBe(palette.heroMeta);
  });

  it("each tab is the press: no scale feedback, the door moving is the answer", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    const { PressableScale } = require("@catera/mobile-ui");
    const tabs = screen.UNSAFE_getAllByType(PressableScale);
    expect(tabs.map((t) => [t.props.testID, t.props.pressFeedback, t.props.haptic])).toEqual([
      ["status-stop-lunch", false, "none"],
      ["status-stop-dinner", false, "select"],
    ]);
  });
});

describe("the words for each Plate state", () => {
  const plate = (state: Plate["state"], meal: Plate["meal"] = "lunch") => ({ state, meal }) as Plate;
  const id = (i: string) => i;
  const en = (_i: string, e: string) => e;
  it.each([
    ["scheduled", "Terjadwal", "Makan siang terjadwal.", "Scheduled", "Lunch is scheduled."],
    ["cooking", "Sedang dimasak", "Makan siang sedang dimasak.", "Being cooked", "Lunch is being cooked."],
    ["on_the_way", "Sedang diantar", "Makan siang sedang diantar.", "On the way", "Lunch is on the way."],
    ["due", "Belum sampai", "Makan siang belum sampai.", "Not here yet", "Lunch hasn't arrived yet."],
    ["arrived_unconfirmed", "Sudah diterima?", "Dapur menandai makan siang sudah sampai.", "Did it arrive?", "The kitchen marked lunch as arrived."],
    ["arrived", "Sudah sampai", "Makan siang sudah sampai.", "Arrived", "Lunch has arrived."],
    ["failed", "Gagal diantar", "Makan siang gagal diantar.", "Not delivered", "Lunch wasn't delivered."],
    ["reported", "Laporan terkirim", "Laporan makan siang terkirim.", "Report sent", "Your lunch report was sent."],
  ] as [Plate["state"], string, string, string, string][])("%s: short label and band statement in both languages", (state, label, statement, labelEn, statementEn) => {
    expect(stateLabel(plate(state), id)).toBe(label);
    expect(statementFor(plate(state), id)).toBe(statement);
    expect(stateLabel(plate(state), en)).toBe(labelEn);
    expect(statementFor(plate(state), en)).toBe(statementEn);
    // The statement names the meal and the state, never a dish.
    expect(statement.toLowerCase()).toContain("makan siang");
  });

  it("names the dinner in the statement of a dinner plate", () => {
    expect(statementFor(plate("on_the_way", "dinner"), id)).toBe("Makan malam sedang diantar.");
    expect(statementFor(plate("on_the_way", "dinner"), en)).toBe("Dinner is on the way.");
  });
});

describe("Beranda hero, band and status line", () => {
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

  type Item = { id: string; name: string; categoryId?: string };
  const menu = (meal: "lunch" | "dinner", items: Item[]) =>
    ({ meal, name: items.map((i) => i.name).join(", "), description: "", image: "", items }) as unknown as Offer["menus"][number];
  const dual = () =>
    offer({
      meal: "both",
      menus: [
        menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }]),
        menu("dinner", [{ id: "d-1", name: "Sate ayam madura" }]),
      ],
    });

  /** Today brings lunch and dinner; `meals` overrides their statuses. */
  function bothMeals(meals: Delivery["meals"] = [{ meal: "lunch", status: "scheduled" }, { meal: "dinner", status: "scheduled" }]) {
    const state = customerState(null);
    state.deliveries.unshift(delivery("d-both", TODAY, {}, { offer: dual(), meals }));
    return state;
  }

  const title = () => screen.getByTestId("home-title");

  it("the band holds the date in meta with a glyph and the statement in section, over a 104 overlap", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const band = within(screen.getByTestId("mood-header"));
    expect(flatOf(title())).toMatchObject({ fontSize: 20, lineHeight: 26 });
    // Lunch's window opened at 11.00 and it is 12.00: the band says the state, never the dish the hero names.
    expect(title().props.children).toBe("Makan siang belum sampai.");
    expect(title().props.children).not.toMatch(/ayam bakar madu/i);
    expect(screen.getByTestId("plate-dishes").props.children).toBe("Ayam bakar madu");
    const date = band.getByText(/^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) \d+ \w+$/);
    expect(flatOf(date)).toMatchObject({ fontSize: 13, lineHeight: 18 });
    const glyph = within(band.getByTestId("home-meta-glyph", { includeHiddenElements: true })).UNSAFE_getByProps({ name: "sunny" });
    expect(glyph.props.size).toBe(18);
    expect(HERO_BAND_OVERLAP).toBe(104);
    expect(flatOf(screen.getByTestId("mood-header")).paddingBottom).toBe(16 + HERO_BAND_OVERLAP);
    // The hero rides up the overlap plus the body's own 16 top padding.
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(require("@catera/mobile-ui").FadeSwap).props.style)).toMatchObject({
      marginTop: -(HERO_BAND_OVERLAP + nativeLayout.space.lg),
    });
  });

  it("shows the moon glyph in the Malam band", async () => {
    home(bothMeals(), MALAM_NOW);
    await screen.findByTestId("plate-hero");
    const glyph = within(screen.getByTestId("mood-header")).getByTestId("home-meta-glyph", { includeHiddenElements: true });
    expect(within(glyph).UNSAFE_getByProps({ name: "moon" })).toBeTruthy();
  });

  it("the hero is a 16 radius card with the 1.5 edge and no frame padding, its photo 16:10 at the card's inner width", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const frame = flat("plate-hero");
    expect(frame.borderRadius).toBe(nativeLayout.radius.card);
    expect(frame.padding).toBeUndefined();
    expect(flat("plate-hero-fill-siang")).toMatchObject({
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: nativeMood.light.siang.heroEdge,
      boxShadow: nativeMood.light.siang.heroShadow,
    });
    expect(flat("plate-photo").aspectRatio).toBeCloseTo(16 / 10, 6);
    expect(flat("plate-photo").minHeight).toBeUndefined();
    expect(screen.queryByTestId("plate-overlay")).toBeNull();
  });

  it("the photo is as wide as the card's inner width: the 1.5 inset is on the layer round it, never on the photo that has the ratio", async () => {
    // A node with both a margin and an aspect ratio lays itself out narrower than its slot on Android (the margin taken
    // off twice: 4px in on the left, 14 to 17px short on the right), so the two live on different layers.
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const photo = flat("plate-photo");
    const inset = flat("plate-photo-inset");
    expect(photo.aspectRatio).toBeCloseTo(16 / 10, 6);
    for (const key of ["margin", "marginHorizontal", "marginLeft", "marginRight", "width", "padding"]) expect(photo[key]).toBeUndefined();
    expect(inset).toMatchObject({ margin: 1.5, borderTopLeftRadius: 14.5, borderTopRightRadius: 14.5, overflow: "hidden" });
    expect(inset.aspectRatio).toBeUndefined();
    const node = screen.getByTestId("plate-photo");
    expect(within(screen.getByTestId("plate-photo-inset")).getByTestId("plate-photo")).toBe(node);
    expect(within(screen.getByTestId("plate-hero")).getByTestId("plate-photo-inset")).toBeTruthy();
  });

  it("sets the dish in heroTitle, the meal line in meta, in a body of 16 padding and 12 gap", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    expect(flatOf(screen.getByTestId("plate-dishes"))).toMatchObject({ fontSize: 24, lineHeight: 30 });
    const meal = within(screen.getByTestId("plate-hero")).getByText(/^Makan siang · /);
    expect(flatOf(meal)).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(flat("plate-body")).toMatchObject({ padding: 16, gap: 12 });
  });

  it("puts the two-stop status line on the band under the statement, not in the hero, and no other-meal row anywhere", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const band = within(screen.getByTestId("mood-header"));
    expect(band.getByTestId("status-stops")).toBeTruthy();
    expect(within(screen.getByTestId("plate-hero")).queryByTestId("status-stops")).toBeNull();
    // Statement first, then the 40 row: the status line follows the title in the band's content.
    const ids = screen
      .getByTestId("mood-header-content")
      .findAll((n) => typeof n.type === "string" && !!n.props.testID)
      .map((n) => n.props.testID);
    expect(ids.indexOf("status-stops")).toBeGreaterThan(ids.indexOf("home-title"));
    expect(screen.queryByTestId("other-meal-row")).toBeNull();
    expect(screen.queryByTestId("mood-arc")).toBeNull();
    expect(
      screen.UNSAFE_root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist"),
    ).toHaveLength(1);
  });

  it("pressing the Malam stop sets mood malam and the hero shows the dinner plate", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    expect(within(screen.getByTestId("plate-hero")).getByText(/^Makan siang · /)).toBeTruthy();
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(seen.mood).toBe("malam");
    expect(within(screen.getByTestId("plate-hero")).getByText(/^Makan malam · /)).toBeTruthy();
    expect(title().props.children).toBe("Makan malam terjadwal.");
    expect(screen.getByTestId("plate-dishes").props.children).toBe("Sate ayam madura");
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("the other meal's name and dish are its stop's label and meta line, its window in the tab's spoken name", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const dinner = within(screen.getByTestId("status-stop-dinner"));
    expect(dinner.getByTestId("status-stop-dinner-label").props.children).toBe("Malam");
    expect(dinner.getByText("Sate ayam madura")).toBeTruthy();
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityLabel).toBe("Makan malam, 17.00–19.00, Sate ayam madura");
  });

  it("the other meal's waiting sentence is its stop's meta line, in place of the old other-meal row", async () => {
    // Lunch is long past its window and nobody tapped it: it should have arrived. The mood is Malam.
    const state = bothMeals([{ meal: "lunch", status: "scheduled" }, { meal: "dinner", status: "scheduled" }]);
    state.deliveries[0].offer = { ...state.deliveries[0].offer, windows: { lunch: "00.01–00.30", dinner: "23.59–23.59" } };
    home(state, MALAM_NOW);
    await screen.findByTestId("plate-hero");
    const lunch = within(screen.getByTestId("status-stop-lunch"));
    expect(lunch.getByTestId("status-stop-lunch-label").props.children).toBe("Siang");
    expect(lunch.getByText("Belum sampai")).toBeTruthy();
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityLabel).toBe("Makan siang, 00.01–00.30, Belum sampai");
    expect(screen.queryByTestId("other-meal-row")).toBeNull();
    // The actions stay on the dinner hero until the stop is pressed.
    expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
    fireEvent.press(screen.getByTestId("status-stop-lunch"));
    expect(screen.getByRole("button", { name: "Sudah sampai" })).toBeTruthy();
  });

  it("a meal with no delivery says Tidak ada and with no hero the status line sits alone under the band", async () => {
    const state = customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` });
    home(state, MALAM_NOW);
    await screen.findByTestId("home-title");
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    expect(within(screen.getByTestId("status-stop-dinner")).getByText("Tidak ada")).toBeTruthy();
    // Today's lunch is done and one tap away: its dish is the stop's line, and Malam is the chosen tab.
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Ayam bakar madu")).toBeTruthy();
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
    // No hero rides up over the band.
    expect(flatOf(screen.getByTestId("mood-header")).paddingBottom).toBe(16);
    expect(screen.getByTestId("status-stop-dinner-label").props.children).toBe("Malam");
    expect(screen.getByTestId("status-stop-lunch-label").props.children).toBe("Siang");
  });

  it("two plates of the chosen meal keep the pager, with the one status line on the band above it", async () => {
    const second = offer({ id: "p-sehat", name: "Paket Sehat", windows: { lunch: "12.00–13.00", dinner: "17.00–19.00" } });
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-l-0", TODAY, {}, { meals: [{ meal: "lunch", status: "scheduled" }] }),
      delivery("d-l-1", TODAY, {}, { offer: second, meals: [{ meal: "lunch", status: "scheduled" }] }),
    );
    home(state);
    await screen.findAllByTestId("plate-hero");
    expect(screen.getAllByTestId("plate-hero")).toHaveLength(2);
    expect(screen.getAllByTestId("status-stops")).toHaveLength(1);
    // On the band, so it is in the first viewport whatever the cards below take; never under the pager.
    expect(within(screen.getByTestId("mood-header")).getByTestId("status-stops")).toBeTruthy();
    expect(within(screen.getByTestId("hero-pager")).queryByTestId("status-stops")).toBeNull();
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("2 pengantaran")).toBeTruthy();
    expect(title().props.children).toBe("Siang ini, 2 pengantaran.");
  });
});

describe("Beranda statement and stops", () => {
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

  it("names the main dish, not the first on the menu, with the lunch window on its stop", async () => {
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
    // The dish is the hero's title, once; the band says the state.
    expect(title()).toBe("Makan siang belum sampai.");
    expect(screen.getByTestId("plate-dishes").props.children).toBe("Sayur asem · Rendang sapi");
    expect(screen.getByRole("tab", { name: "Makan siang, 11.00–13.00, Belum sampai", selected: true })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Makan malam, Tidak ada", selected: false })).toBeTruthy();
  });

  it("never names a dish in the band, whether the menu is set or not", async () => {
    const o = offer({ menus: [menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }], { selectionStatus: "pending" })] });
    home(lunches(o));
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Makan siang belum sampai.");
    expect(title()).not.toMatch(/ayam bakar madu|makan siang rumahan/i);
  });

  it("speaks a window that does not start with a time as the caterer wrote it, in the stop's tab name", async () => {
    home(lunches(offer({ windows: { lunch: "siang hari", dinner: "17.00–19.00" } })));
    await screen.findByTestId("plate-hero");
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityLabel).toMatch(/^Makan siang, siang hari, /);
    expect(screen.getByTestId("status-stop-lunch-label").props.children).toBe("Siang");
  });

  it("counts two lunches in the statement and on the Siang stop, which has no single window", async () => {
    const second = offer({ id: "p-sehat", name: "Paket Sehat", windows: { lunch: "12.00–13.00", dinner: "17.00–19.00" } });
    home(lunches(offer(), second));
    await screen.findAllByTestId("plate-hero");
    expect(title()).toBe("Siang ini, 2 pengantaran.");
    expect(screen.getByRole("tab", { name: "Makan siang, 2 pengantaran", selected: true })).toBeTruthy();
  });

  it("says nothing comes for the chosen meal and counts the other meal in English", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    // Both lunches open late in the day, so neither is due and the stop counts them rather than saying a sentence.
    const late = { windows: { lunch: "23.59–23.59", dinner: "23.59–23.59" } };
    const second = offer({ id: "p-sehat", name: "Paket Sehat", ...late });
    home(lunches(offer(late), second), MALAM_NOW);
    await screen.findByTestId("home-title");
    expect(title()).toBe("Dinner tonight, no delivery.");
    expect(screen.getByRole("tab", { name: "Lunch, 2 deliveries", selected: false })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dinner, None", selected: true })).toBeTruthy();
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
  });

  it("says the state once: the band's statement, the shown stop's short label, and no state sentence in the hero body", async () => {
    home(bothTodayForState());
    await screen.findByTestId("plate-hero");
    expect(title()).toBe("Makan siang sedang diantar.");
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Sedang diantar")).toBeTruthy();
    expect(screen.queryByTestId("plate-sentence")).toBeNull();
    // The body keeps its second line: when the meal is due, as meta.
    expect(screen.getByTestId("plate-detail").props.children).toBe("Tiba sekitar 11.00–13.00");
    // The state label is on the band's stop once and is not repeated in the hero body (the tracker has its own words).
    expect(within(screen.getByTestId("status-stops")).getAllByText("Sedang diantar")).toHaveLength(1);
    expect(within(screen.getByTestId("plate-body")).queryByText("Sedang diantar")).toBeNull();
  });

  function bothTodayForState() {
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-one", TODAY, {}, {
        offer: offer({ menus: [menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }])] }),
        meals: [{ meal: "lunch", status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }],
      }),
    );
    return state;
  }

  it("the chosen meal's tab is selected whatever is under way: the lunch on its way says so in words", async () => {
    const state = bothTodayForState();
    state.deliveries[0].offer = offer({
      meal: "both",
      menus: [menu("lunch", [{ id: "l-1", name: "Ayam bakar madu" }]), menu("dinner", [{ id: "d-1", name: "Sate ayam madura" }])],
    });
    state.deliveries[0].meals = [
      { meal: "lunch", status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` },
      { meal: "dinner", status: "scheduled" },
    ];
    home(state);
    await screen.findByTestId("plate-hero");
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: false });
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Sedang diantar")).toBeTruthy();
    // Nothing on the line borrows the tracker's stop colour.
    expect(flat("status-stops").backgroundColor).not.toBe(nativeMood.light.siang.stopActive);
  });
});

describe("every Plate state under the food-led hero", () => {
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
    goOnline();
  });

  const runtimeFor = (state: CustomerState): MobileRuntime => {
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
  };
  const NOT_YET = "23.59–23.59";
  const EARLY = "00.01–00.30";

  /** One lunch today, its window at `window`, in the given kitchen state; ids are unique per case. */
  let seq = 0;
  function lunch(meal: Record<string, unknown>, window = NOT_YET) {
    const state = customerState(null);
    state.deliveries.unshift(
      delivery(`d-state-${++seq}`, TODAY, meal, { offer: offer({ windows: { lunch: window, dinner: NOT_YET } }) }),
    );
    return state;
  }

  // Each Plate state: the stop's short label, the band's statement and the detail line.
  it.each([
    ["scheduled", { status: "scheduled" }, NOT_YET, "next", "Terjadwal", "Makan siang terjadwal.", "Diantar 23.59–23.59 ke Kantor"],
    [
      "cooking",
      { status: "preparing", cooking_started_at: `${TODAY}T01:10:00Z` },
      NOT_YET,
      "now",
      "Sedang dimasak",
      "Makan siang sedang dimasak.",
      "Diantar 23.59–23.59 ke Kantor",
    ],
    [
      "on_the_way",
      { status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` },
      NOT_YET,
      "now",
      "Sedang diantar",
      "Makan siang sedang diantar.",
      "Tiba sekitar 23.59–23.59",
    ],
    ["due", { status: "scheduled" }, EARLY, "now", "Belum sampai", "Makan siang belum sampai.", `${EARLY} · belum ada kabar dari dapur`],
    [
      "arrived_unconfirmed",
      { status: "out_for_delivery", arrived_at: `${TODAY}T04:30:00Z` },
      NOT_YET,
      "now",
      "Sudah diterima?",
      "Dapur menandai makan siang sudah sampai.",
      "",
    ],
    ["arrived", { status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` }, NOT_YET, "done", "Sudah sampai", "Makan siang sudah sampai.", "Pukul 11.48"],
    ["failed", { status: "issue" }, NOT_YET, "now", "Gagal diantar", "Makan siang gagal diantar.", ""],
    [
      "reported",
      { status: "scheduled", issue: { status: "open" } },
      NOT_YET,
      "done",
      "Laporan terkirim",
      "Laporan makan siang terkirim.",
      "Menunggu balasan katering",
    ],
  ] as [string, Record<string, unknown>, string, "now" | "next" | "done", string, string, string][])(
    "%s: each fact is said once in its own region and the Siang stop is the chosen one",
    async (_state, meal, window, _status, label, statement, detail) => {
      mount(
        <MobileProvider runtime={runtimeFor(lunch(meal, window))} linkMapper={customerLink}>
          <Beranda />
        </MobileProvider>,
      );
      await screen.findByTestId("plate-hero");
      expect(flat("plate-photo").aspectRatio).toBeCloseTo(16 / 10, 6);
      // The band says the state, the stop its short label, the body only the detail (the second line), the title the dish.
      expect(screen.getByTestId("home-title").props.children).toBe(statement);
      expect(screen.getByTestId("home-title").props.children).not.toMatch(/ayam bakar madu/i);
      expect(screen.getByTestId("status-stop-lunch").props.accessibilityLabel).toMatch(new RegExp(`, ${label.replace("?", "\\?")}$`));
      expect(within(screen.getByTestId("status-stop-lunch")).getAllByText(label)).toHaveLength(1);
      expect(screen.queryByTestId("plate-sentence")).toBeNull();
      if (detail) expect(screen.getByTestId("plate-detail").props.children).toMatch(new RegExp(`^${detail.replace(/[.?]/g, "\\$&")}$`, "i"));
      else expect(screen.queryByTestId("plate-detail")).toBeNull();
      expect(screen.getAllByText("Ayam bakar madu · Sayur asem")).toHaveLength(1);
      expect(screen.getByTestId("status-stop-lunch").props.accessibilityState).toMatchObject({ selected: true });
      // The status line is the one in the hero's body, never a second one.
      expect(screen.getAllByTestId("status-stops")).toHaveLength(1);
    },
  );

  it("no delivery for the chosen meal: the status line alone under the band, both stops Tidak ada", async () => {
    mount(
      <MobileProvider runtime={runtimeFor(customerState(null))} linkMapper={customerLink}>
        <Beranda />
      </MobileProvider>,
    );
    await screen.findByTestId("home-title");
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    expect(screen.getAllByText("Tidak ada")).toHaveLength(2);
    // Still a switch: the chosen meal stays selected when it has nothing coming.
    expect(screen.getByTestId("status-stop-lunch").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("a kept copy offline still shows the hero and the status line, which still switches the mood, and no day menu", async () => {
    goOffline();
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
      savedAt: `${TODAY}T03:12:00.000Z`,
      data: lunch({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }),
    });
    const runtime = runtimeFor(customerState(null));
    (runtime.api.customer as jest.Mock).mockImplementation(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    mount(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <Beranda />
      </MobileProvider>,
    );
    await screen.findByTestId("plate-hero");
    expect(await screen.findByText("Tidak ada koneksi")).toBeTruthy();
    expect(screen.queryByTestId("header-more")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sudah sampai" })).toBeNull();
    expect(within(screen.getByTestId("mood-header")).getByTestId("status-stops")).toBeTruthy();
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(seen.mood).toBe("malam");
    (offline.loadCachedCustomer as jest.Mock).mockResolvedValue(null);
  });

  it.each(["light", "dark"] as const)(
    "the Malam band is tinted from the %s Malam tokens and the Malam stop is the selected tab",
    async (scheme) => {
      const state = customerState(null);
      state.deliveries.unshift(
        delivery("d-malam-band", TODAY, {}, {
          offer: offer({
            meal: "both",
            windows: { lunch: NOT_YET, dinner: NOT_YET },
            menus: [
              { meal: "lunch", name: "Ayam", description: "", image: "", items: [{ id: "l", name: "Ayam bakar madu" }] },
              { meal: "dinner", name: "Sate", description: "", image: "", items: [{ id: "d", name: "Sate ayam madura" }] },
            ] as unknown as Offer["menus"],
          }),
          meals: [
            { meal: "lunch", status: "scheduled" },
            { meal: "dinner", status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` },
          ],
        }),
      );
      mount(
        <MobileProvider runtime={runtimeFor(state)} linkMapper={customerLink}>
          <Beranda />
        </MobileProvider>,
        { now: MALAM_NOW, scheme },
      );
      await screen.findByTestId("plate-hero");
      const malam = nativeMood[scheme].malam;
      expect(flat("mood-fill-malam")).toMatchObject({ backgroundColor: malam.header });
      expect(flat("plate-hero-fill-malam").backgroundColor).toBe(malam.hero);
      expect(screen.getByTestId("status-stop-dinner").props.accessibilityState).toMatchObject({ selected: true });
      expect(flat("status-stops")).toMatchObject({ backgroundColor: malam.toggleTrack, borderColor: malam.heroEdge });
      expect(flatOf(screen.getByTestId("home-title")).color).toBe(malam.headerText);
    },
  );
});

describe("HeroPager under the layout scale", () => {
  const pager = (scale: "classic" | "v2") =>
    render(
      <ThemeProvider storageKey="pager-scale-test">
        <LayoutScaleProvider value={scale}>
          <HeroPager count={2} accessibilityLabelFor={() => "Makan siang"} counterLabel={(i) => String(i + 1)}>
            <ReactNative.View />
            <ReactNative.View />
          </HeroPager>
        </LayoutScaleProvider>
      </ThemeProvider>,
    );
  const measure = () => {
    const scroll = screen.getByTestId("hero-pager-scroll");
    const width = StyleSheet.flatten(screen.getAllByTestId("hero-page")[0].props.style).width as number;
    return { width, side: StyleSheet.flatten(scroll.props.contentContainerStyle).paddingHorizontal as number };
  };

  it("reaches the screen's margin (20, or 16 under v2) and peeks the next card 32 either way", () => {
    const classic = pager("classic");
    const before = measure();
    classic.unmount();
    pager("v2");
    const after = measure();
    expect([before.side, after.side]).toEqual([20, 16]);
    // The card is the pager's width minus the margin, the 12 gap and the 32 peek: 64 at a 20 margin (as it always was), 60 at 16.
    expect(before.width - after.width).toBe(-4);
  });

  it("keeps each page at its own height, top-aligned, instead of stretching every card to the tallest", () => {
    pager("v2");
    const content = StyleSheet.flatten(screen.getByTestId("hero-pager-scroll").props.contentContainerStyle);
    expect(content.alignItems).toBe("flex-start");
    for (const page of screen.getAllByTestId("hero-page")) expect(StyleSheet.flatten(page.props.style).height).toBeUndefined();
  });
});

describe("Beranda under font scale 1.3", () => {

  it("lets the statement and the stop labels wrap instead of truncating", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    for (const node of [screen.getByTestId("status-stop-lunch-label"), screen.getByTestId("status-stop-dinner-label")]) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
    }
    // The stops grow with their text; no fixed height clips them.
    expect(flat("status-stop-lunch").height).toBeUndefined();
    expect(flat("status-stop-lunch").maxHeight).toBeUndefined();
  });
});
