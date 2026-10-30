import { fireEvent, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { contrastRatio, nativeThemes } from "@catera/design-tokens";
import { shortDate, type SellerOperationsState } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { render } from "./render-dapur";
import { canvasDay } from "./fixtures";
import { TodayScreen } from "../src/today/TodayScreen";
import * as offline from "../src/today/offline";

// The clock is pinned to Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const NOW = new Date("2026-10-08T03:00:00Z");
const pinToday = () =>
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("../src/today/offline", () => ({
  cacheSession: jest.fn(() => 0),
  saveCachedDay: jest.fn(async () => undefined),
  loadCachedDay: jest.fn(async () => null),
}));

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const SIANG_NOW = () => new Date("2026-10-08T03:00:00Z");
const MALAM_NOW = () => new Date("2026-10-08T12:00:00Z");
const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

function dayFor(date: string): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = date;
  day.deliveries = day.deliveries.map((d) => ({ ...d, service_date: date }) as typeof d);
  return day;
}

function runtimeWith(role: "owner" | "staff" = "owner") {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { ...owner, role }, demo: false })),
    sellerOperations: jest.fn(async (_id: string, date: string) => dayFor(date)),
    sellerCalendar: jest.fn(async () => ({ days: [] })),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({ moved: 4 })),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

function renderToday(runtime: MobileRuntime, { date, now = SIANG_NOW }: { date?: string; now?: () => Date } = {}) {
  return render(
    <ThemeProvider storageKey="t.theme">
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>
            <TodayScreen date={date} />
          </ToastProvider>
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
}

/** A glyph by its Ionicons name (the icon draws nothing in Jest, so it is found by its props). */
const glyph = (name: string) => screen.UNSAFE_getAllByProps({ name })[0].props as { color: string; size: number };
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
// Today and the six days after it: Thursday 8 to Wednesday 14 October.
const range = (locale: "id" | "en") =>
  `${shortDate("2026-10-08", locale)} ${locale === "id" ? "sampai" : "to"} ${shortDate("2026-10-14", locale)}`;

beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  pinToday();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("Hari ini's Belanja entry row", () => {
  it("Hari ini's entry row navigates to belanja", async () => {
    renderToday(runtimeWith());
    const row = await screen.findByRole("button", { name: `Belanja 7 hari, Porsi per menu, ${range("id")}` });
    expect(screen.getByText("Belanja 7 hari")).toBeTruthy();
    expect(screen.getByText(`Porsi per menu, ${range("id")}`)).toBeTruthy();
    expect(glyph("basket-outline")).toBeTruthy();
    expect(glyph("chevron-forward")).toBeTruthy();
    // At least one 48 target.
    expect(flat(screen.getByTestId("belanja-entry-row")).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/belanja");
  });

  it("shows on a future day of the strip, and for a helper, with the same seven-day range", async () => {
    renderToday(runtimeWith("staff"), { date: "2026-10-12" });
    await screen.findByText("Belanja 7 hari");
    // The range is the recap's (from today), not the selected day's.
    expect(screen.getByText(`Porsi per menu, ${range("id")}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId("belanja-entry-row"));
    expect(router.push).toHaveBeenCalledWith("/belanja");
  });

  it("reads in English when the app is in English", async () => {
    const runtime = runtimeWith();
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByText("Shopping, 7 days")).toBeTruthy();
    expect(screen.getByText(`Portions per dish, ${range("en")}`)).toBeTruthy();
  });

  const combos = [
    ["light", "siang", SIANG_NOW],
    ["light", "malam", MALAM_NOW],
    ["dark", "siang", SIANG_NOW],
    ["dark", "malam", MALAM_NOW],
  ] as const;
  it.each(combos)("%s %s: text at 4.5:1 and glyphs at 3:1 on the card it sits on", async (scheme, _mood, now) => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    renderToday(runtimeWith(), { now });
    await screen.findByText("Belanja 7 hari");
    // The row sits in the body, on a theme surface card: the mood paints the header only, so both moods read alike.
    const theme = nativeThemes[scheme];
    const card = flat(screen.getByTestId("belanja-entry")).backgroundColor as string;
    expect(card).toBe(theme.surface);
    const title = flat(screen.getByTestId("belanja-entry-title")).color as string;
    const detail = flat(screen.getByTestId("belanja-entry-detail")).color as string;
    const chevron = glyph("chevron-forward").color;
    expect(title).toBe(theme.charcoal);
    expect(detail).toBe(theme.muted);
    expect(chevron).toBe(theme.muted);
    expect(contrastRatio(title, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(detail, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(chevron, card)).toBeGreaterThanOrEqual(3);
    expect(glyph("basket-outline").color).toBe(theme.forest);
    expect(contrastRatio(theme.forest, card)).toBeGreaterThanOrEqual(3);
  });
});
