import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { type CustomerState, type Delivery, type Offer, type Plate } from "@catera/domain";
import { nativeLayout, nativeMood, nativeThemes } from "@catera/design-tokens";
import { HeroPager, LayoutScaleProvider, MoodProvider, ThemeProvider, useMood } from "@catera/mobile-ui";
import { Beranda, HERO_BAND_OVERLAP } from "../src/today/Beranda";
import { StatusStops, withAlpha, type StopInfo } from "../src/today/StatusStops";
import { stateLabel, statementFor } from "../src/today/Plate";
import { stopStatuses } from "../src/today/stopStatus";
import { customerLink } from "../src/links";
import * as offline from "../src/today/offline";
import { customerState, delivery, offer, TODAY } from "./fixtures";
import { goOffline, goOnline } from "./offline";

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

const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
const flatOf = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

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

const LUNCH: StopInfo = { window: "11.00–13.00", state: "Sedang diantar", status: "now" };
const DINNER: StopInfo = { window: "17.00–19.00", state: "Sate ayam madura", status: "next" };

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

  it("is one 40 tall row: each stop a dot beside a two-line block 8 apart, label in bodyStrong over the state in meta, a 44 target", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    expect(flat("status-stops")).toMatchObject({ flexDirection: "row", minHeight: 40 });
    for (const id of ["status-stop-lunch", "status-stop-dinner"]) {
      const stop = screen.getByTestId(id);
      const s = flatOf(stop);
      expect(s).toMatchObject({ flexDirection: "row", gap: 8, minHeight: 40 });
      // 40 tall, and the hit area adds the 2 above and below that make the 44 target.
      const slop = stop.props.hitSlop as { top: number; bottom: number };
      expect((s.minHeight as number) + slop.top + slop.bottom).toBeGreaterThanOrEqual(nativeLayout.control.icon);
    }
    expect(flatOf(screen.getByText("Siang 11.00–13.00"))).toMatchObject({ fontSize: 15, lineHeight: 22 });
    expect(flatOf(screen.getByText("Sedang diantar"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    // Wraps instead of truncating at a large font.
    expect(screen.getByText("Sedang diantar").props.numberOfLines).toBeUndefined();
    expect(screen.getByText("Siang 11.00–13.00").props.numberOfLines).toBeUndefined();
  });

  it("draws a 2dp heroEdge track between the stops, flexing to fill, and labels a stop with no window by its name alone", async () => {
    await settled(<Stops lunch={{ window: null, state: "2 pengantaran", status: "next" }} dinner={DINNER} />);
    expect(flat("status-stops-track")).toMatchObject({ height: 2, flex: 1, backgroundColor: nativeMood.light.siang.heroEdge });
    expect(screen.getByText("Siang")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Makan siang, 2 pengantaran" })).toBeTruthy();
  });

  it.each([
    ["light", "siang"],
    ["dark", "malam"],
  ] as const)("paints the dots from the tokens in the %s theme: now a filled ink dot with a 4dp halo at 16%% ink, none a controlRing ring 2 (%s)", async (scheme, mood) => {
    await settled(
      <Stops
        lunch={{ window: null, state: "Sedang diantar", status: "now" }}
        dinner={{ window: null, state: "Tidak ada", status: "none" }}
      />,
      { scheme, now: mood === "siang" ? SIANG_NOW : MALAM_NOW },
    );
    const palette = nativeMood[scheme][mood];
    const ink = palette.headerText;
    const dot = flat("status-stop-lunch-dot");
    expect(dot.backgroundColor).toBe(ink);
    // stopActive belongs to the tracker's current stop alone.
    expect(dot.backgroundColor).not.toBe(palette.stopActive);
    const halo = flat("status-stop-lunch-halo");
    expect(((halo.width as number) - (dot.width as number)) / 2).toBe(4);
    expect(halo.backgroundColor).toBe(withAlpha(ink, 0.16));
    expect(flat("status-stop-dinner-dot")).toMatchObject({ borderColor: nativeThemes[scheme].controlRing, borderWidth: 2 });
    expect(screen.queryByTestId("status-stop-dinner-halo")).toBeNull();
  });

  it("withAlpha turns a hex colour into the same colour at a fraction of its strength", () => {
    expect(withAlpha("#2E2E2E", 0.16)).toBe("rgba(46,46,46,0.16)");
    expect(withAlpha("#F5F1E8", 1)).toBe("rgba(245,241,232,1)");
  });

  it("marks a next stop with an ink ring 2 and a done stop with a filled muted dot", async () => {
    await settled(
      <Stops
        lunch={{ window: null, state: "Sudah sampai", status: "done" }}
        dinner={{ window: null, state: "Sate ayam madura", status: "next" }}
      />,
    );
    expect(flat("status-stop-dinner-dot")).toMatchObject({ borderColor: nativeMood.light.siang.headerText, borderWidth: 2 });
    expect(flat("status-stop-lunch-dot").backgroundColor).toBe(nativeMood.light.siang.headerMeta);
  });

  it("the shown meal's label is forest and 700, the other's ink and 600, so selection is not colour alone", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    expect(flatOf(screen.getByText("Siang 11.00–13.00"))).toMatchObject({
      color: nativeThemes.light.forest,
      fontFamily: "Jakarta-Bold",
    });
    expect(flatOf(screen.getByText("Malam 17.00–19.00"))).toMatchObject({
      color: nativeMood.light.siang.headerText,
      fontFamily: "Jakarta-SemiBold",
    });
    fireEvent.press(screen.getByTestId("status-stop-dinner"));
    expect(flatOf(screen.getByText("Malam 17.00–19.00"))).toMatchObject({ color: nativeThemes.light.forest, fontFamily: "Jakarta-Bold" });
    expect(flatOf(screen.getByText("Siang 11.00–13.00")).color).toBe(nativeMood.light.siang.headerText);
  });

  it("sits on the band, so the unshown label and the state line read the band's inks, in both moods", async () => {
    await settled(<Stops lunch={LUNCH} dinner={DINNER} />);
    expect(flatOf(screen.getByText("Malam 17.00–19.00")).color).toBe(nativeMood.light.siang.headerText);
    expect(flatOf(screen.getByText("Sate ayam madura")).color).toBe(nativeMood.light.siang.headerMeta);
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
    ["arrived_unconfirmed", "Sudah diterima?", "Dapur menandai makan siang sudah sampai.", "Has it reached you?", "The kitchen marked lunch as arrived."],
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

describe("stopStatuses: at most one stop is now", () => {
  const p = (state: Plate["state"]) => ({ state }) as Plate;
  it.each([
    [[], [], "none", "none"],
    [[p("scheduled")], [], "next", "none"],
    [[p("on_the_way")], [p("scheduled")], "now", "next"],
    [[p("arrived")], [p("scheduled")], "done", "next"],
    [[p("reported")], [], "done", "none"],
    // Lunch failed and dinner is on the way: the live stop is dinner, lunch is done.
    [[p("failed")], [p("on_the_way")], "done", "now"],
    [[p("arrived_unconfirmed")], [p("cooking")], "done", "now"],
    // Lunch failed and dinner has only been scheduled so far: lunch still needs the customer.
    [[p("failed")], [p("scheduled")], "now", "next"],
    // Both genuinely under way: the earlier meal is the live one.
    [[p("on_the_way")], [p("cooking")], "now", "next"],
    [[p("due")], [p("due")], "now", "next"],
  ] as [Plate[], Plate[], string, string][])("%#: lunch %j dinner %j gives %s and %s", (lunch, dinner, first, second) => {
    expect(stopStatuses(lunch, dinner)).toEqual({ lunch: first, dinner: second });
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

  it("the other meal's window and dish are its stop's label and meta line", async () => {
    home(bothMeals());
    await screen.findByTestId("plate-hero");
    const dinner = within(screen.getByTestId("status-stop-dinner"));
    expect(dinner.getByText("Malam 17.00–19.00")).toBeTruthy();
    expect(dinner.getByText("Sate ayam madura")).toBeTruthy();
  });

  it("the other meal's waiting sentence is its stop's meta line, in place of the old other-meal row", async () => {
    // Lunch is long past its window and nobody tapped it: it should have arrived. The mood is Malam.
    const state = bothMeals([{ meal: "lunch", status: "scheduled" }, { meal: "dinner", status: "scheduled" }]);
    state.deliveries[0].offer = { ...state.deliveries[0].offer, windows: { lunch: "00.01–00.30", dinner: "23.59–23.59" } };
    home(state, MALAM_NOW);
    await screen.findByTestId("plate-hero");
    const lunch = within(screen.getByTestId("status-stop-lunch"));
    expect(lunch.getByText("Siang 00.01–00.30")).toBeTruthy();
    expect(lunch.getByText("Belum sampai")).toBeTruthy();
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
    // Today's lunch is done and one tap away: its dish is the stop's line, its dot the filled "done" one.
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Ayam bakar madu")).toBeTruthy();
    expect(flat("status-stop-lunch-dot").backgroundColor).toBe(nativeMood.light.siang.headerMeta);
    // No hero rides up over the band, and the line reads the canvas inks.
    expect(flatOf(screen.getByTestId("mood-header")).paddingBottom).toBe(16);
    // The shown meal's label is forest, the other's ink.
    expect(flatOf(screen.getByText("Malam")).color).toBe(nativeThemes.light.forest);
    expect(flatOf(within(screen.getByTestId("status-stop-lunch")).getByText("Siang 11.00–13.00")).color).toBe(nativeThemes.light.charcoal);
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

  it("labels a stop with a window that does not start with a time by that window as the caterer wrote it", async () => {
    home(lunches(offer({ windows: { lunch: "siang hari", dinner: "17.00–19.00" } })));
    await screen.findByTestId("plate-hero");
    expect(within(screen.getByTestId("status-stop-lunch")).getByText("Siang siang hari")).toBeTruthy();
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

  it("a delivery on its way is a now dot with the halo, and the dinner still to come an ink ring", async () => {
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
    // The live stop is a filled ink dot with its halo; stopActive stays the tracker's.
    expect(flat("status-stop-lunch-dot").backgroundColor).toBe(nativeMood.light.siang.headerText);
    expect(flat("status-stop-lunch-dot").backgroundColor).not.toBe(nativeMood.light.siang.stopActive);
    expect(screen.getByTestId("status-stop-lunch-halo")).toBeTruthy();
    expect(flat("status-stop-dinner-dot")).toMatchObject({ borderWidth: 2, borderColor: nativeMood.light.siang.headerText });
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

  // Each Plate state: the dot its meal's stop wears, the stop's short label, the band's statement and the detail line.
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
    "%s: each fact is said once in its own region and the Siang stop wears its dot",
    async (_state, meal, window, status, label, statement, detail) => {
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
      const dot = flat("status-stop-lunch-dot");
      if (status === "now") expect(dot.backgroundColor).toBe(nativeMood.light.siang.headerText);
      else if (status === "done") expect(dot.backgroundColor).toBe(nativeMood.light.siang.headerMeta);
      else expect(dot.borderColor).toBe(nativeMood.light.siang.headerText);
      // The status line is the one in the hero's body, never a second one.
      expect(screen.getAllByTestId("status-stops")).toHaveLength(1);
    },
  );

  it("lunch failed and dinner on the way: one now dot, dinner's, and lunch's reads done", async () => {
    const state = customerState(null);
    state.deliveries.unshift(
      delivery("d-two-meals", TODAY, {}, {
        offer: offer({
          meal: "both",
          windows: { lunch: "00.01–00.30", dinner: "00.01–00.30" },
          menus: [
            { meal: "lunch", name: "Ayam", description: "", image: "", items: [{ id: "l", name: "Ayam bakar madu" }] },
            { meal: "dinner", name: "Sate", description: "", image: "", items: [{ id: "d", name: "Sate ayam madura" }] },
          ] as unknown as Offer["menus"],
        }),
        meals: [
          { meal: "lunch", status: "issue" },
          { meal: "dinner", status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` },
        ],
      }),
    );
    mount(
      <MobileProvider runtime={runtimeFor(state)} linkMapper={customerLink}>
        <Beranda />
      </MobileProvider>,
    );
    await screen.findByTestId("plate-hero");
    const ink = nativeMood.light.siang.headerText;
    expect(screen.queryByTestId("status-stop-lunch-halo")).toBeNull();
    expect(screen.getByTestId("status-stop-dinner-halo")).toBeTruthy();
    expect(flat("status-stop-dinner-dot").backgroundColor).toBe(ink);
    expect(flat("status-stop-lunch-dot").backgroundColor).toBe(nativeMood.light.siang.headerMeta);
  });

  it("no delivery for the chosen meal: the status line alone under the band, both stops Tidak ada", async () => {
    mount(
      <MobileProvider runtime={runtimeFor(customerState(null))} linkMapper={customerLink}>
        <Beranda />
      </MobileProvider>,
    );
    await screen.findByTestId("home-title");
    expect(screen.queryByTestId("plate-hero")).toBeNull();
    expect(screen.getAllByText("Tidak ada")).toHaveLength(2);
    expect(flat("status-stop-lunch-dot")).toMatchObject({ borderColor: nativeThemes.light.controlRing });
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
    "the Malam band is tinted from the %s Malam tokens and the live stop is a filled ink dot",
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
      expect(flat("status-stop-dinner-dot").backgroundColor).toBe(malam.headerText);
      expect(flat("status-stop-dinner-dot").backgroundColor).not.toBe(malam.stopActive);
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
    for (const node of [screen.getByText("Siang 11.00–13.00"), screen.getByText("Malam 17.00–19.00")]) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.ellipsizeMode).toBeUndefined();
    }
    // The stops grow with their text; no fixed height clips them.
    expect(flat("status-stop-lunch").height).toBeUndefined();
    expect(flat("status-stop-lunch").maxHeight).toBeUndefined();
  });
});
