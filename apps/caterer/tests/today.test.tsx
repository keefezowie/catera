import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { render } from "./render-dapur";
import * as ReactNative from "react-native";
import { Share, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { errorLabel, kitchenSession, type SellerOperationsState } from "@catera/domain";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import * as SecureStore from "expo-secure-store";
import * as Reanimated from "react-native-reanimated";
import { TodayScreen } from "../src/today/TodayScreen";
import { SessionCard } from "../src/today/SessionCard";
import { issueSteps } from "../src/today/exceptions";
import * as offline from "../src/today/offline";
import * as Haptics from "expo-haptics";
import { canvasDay, emptyDay, quietDay, report } from "./fixtures";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { lastConfirm, resetSheets, SheetHost, type Opened } from "./sheet-host";
import { nativeMood, nativeThemes } from "@catera/design-tokens";

const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };

// The date button's accessible name starts with its visible date and ends with the action.
const CHANGE_DAY = /, ganti hari$/;

const pinToday = () =>
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    // Only the clock is pinned: timers, microtasks and animation frames keep running for real.
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

// A stop's "…" opens its sheet route; here the sheet shows next to the screen (`SheetHost`).
jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
// Links from attention cards open through the app's link opener, which selects a tab for a tab root.
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

function runtimeWith(day: () => Promise<unknown>, actor: Record<string, unknown> = owner): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    sellerOperations: jest.fn(day),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** A stop's sheet as its route draws it (`/atur-antaran/{id}?meal=…&date=…`). */
const stopSheet = ({ path, params }: Opened) =>
  path.startsWith("/atur-antaran/") ? (
    <ExceptionSheet id={path.split("/")[2]} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={params.date} />
  ) : null;

const renderToday = (runtime: MobileRuntime, date?: string) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen date={date} />
      <SheetHost render={stopSheet} />
    </MobileProvider>,
  );

/** The same day for every read, as the server answers: the stop sheet reads the day again and finds the same stop. */
const same = (day: SellerOperationsState) => async () => day;

beforeEach(() => {
  jest.clearAllMocks();
  resetSheets();
  // Hari ini now paints the kept day first (Phase F task 4), so a kept day one test sets must not reach the next.
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
});

/**
 * The "…" button of delivery-order row `n` (route order: 1 Bu Sari Wulandari, 2 Kantor PT Sinar Rasa, 3 Keluarga
 * Hartono, 4 Kost Damai). Its label says what the sheet can do, so it is found by its start.
 */
const stopMenu = async (n: number) =>
  within(await screen.findByTestId(`stop-${n}`)).getByLabelText(/^(Laporkan masalah|Pindah tanggal)/);

it("shows the lunch cooking total for the day", async () => {
  renderToday(runtimeWith(same(canvasDay())));
  expect(within(await screen.findByTestId("session-count")).getByText("34")).toBeTruthy();
  expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
  // The count is the strip's lead figure, once: no second large number, and the old 40 "number" style is gone.
  expect(screen.getByText("Per paket")).toBeTruthy();
  expect(screen.getAllByText("34")).toHaveLength(1);
  const lead = (size: number) =>
    screen.UNSAFE_root.findAll(
      (n) => typeof n.type === "string" && n.type === "Text" && StyleSheet.flatten(n.props.style)?.fontSize === size,
    );
  expect(lead(32)).toHaveLength(1);
  expect(lead(40)).toHaveLength(0);
  expect(screen.queryByText("Makan siang")).toBeNull();
});

it("shares the route as WhatsApp-ready text", async () => {
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  renderToday(runtimeWith(same(canvasDay())));
  fireEvent.press(await screen.findByText("Bagikan rute ke WhatsApp"));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0][0]).toEqual(
    expect.objectContaining({ message: expect.stringMatching(/^\*Antar siang/) }),
  );
});

it("reports a failed delivery by stepping it to the issue status", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  renderToday(runtime);
  fireEvent.press(await stopMenu(3));
  fireEvent.press(await screen.findByText("Gagal diantar"));
  fireEvent.press(screen.getByText("Tandai gagal diantar"));
  await lastConfirm().press("Tandai gagal");
  await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(3));
  const calls = (runtime.api.command as jest.Mock).mock.calls;
  expect(calls.map((c) => [c[0], c[1].status, c[1].version])).toEqual([
    ["delivery.status", "preparing", 3],
    ["delivery.status", "out_for_delivery", 4],
    ["delivery.status", "issue", 5],
  ]);
});

it("keeps showing the last loaded day when offline", async () => {
  (offline.loadCachedDay as jest.Mock).mockResolvedValue({
    savedAt: "2026-10-07T23:12:00.000Z",
    data: canvasDay(),
  });
  renderToday(
    runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    }),
  );
  expect(within(await screen.findByTestId("session-count")).getByText("34")).toBeTruthy();
  expect(screen.getByText(/Ini data terakhir yang tersimpan/)).toBeTruthy();
});

it("welcomes a new caterer with the setup card instead of empty lists", async () => {
  renderToday(runtimeWith(async () => emptyDay()));
  expect(await screen.findByText("Siapkan dapurmu")).toBeTruthy();
});

it("heads the setup card and the 'once you have customers' card in the section type, not the classic heading", async () => {
  renderToday(runtimeWith(async () => emptyDay()));
  for (const title of ["Siapkan dapurmu", "Setelah ada pelanggan"]) {
    expect(StyleSheet.flatten((await screen.findByText(title)).props.style)).toMatchObject({ fontSize: 20, lineHeight: 26 });
  }
});

it("report cards and setup rows dim on press and still navigate", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  (runtime.api.request as jest.Mock).mockImplementation(async (path: string) => (path.startsWith("delivery-issues") ? [report()] : []));
  const first = renderToday(runtime);
  const card = () => screen.getByRole("button", { name: "Buka laporan: Nadia Putri" });
  await screen.findByText("Nadia Putri melaporkan masalah");
  expect(StyleSheet.flatten(card().props.style)?.opacity ?? 1).toBe(1);
  fireEvent(card(), "responderGrant", touch);
  expect(StyleSheet.flatten(card().props.style).opacity).toBe(0.7);
  // The disclosure chevron is iOS only; Jest compiles the Android build.
  expect(within(card()).UNSAFE_queryAllByType(Ionicons).find((i) => i.props.name === "chevron-forward")).toBeUndefined();
  fireEvent.press(card());
  // The link opens the reply sheet and carries the customer's name, so its title is final on its first frame.
  expect(router.push).toHaveBeenCalledWith("/balas/i-1?title=Nadia%20Putri");
  first.unmount();

  renderToday(runtimeWith(async () => emptyDay()));
  const step = () => screen.getByRole("button", { name: /Buat paket pertama/ });
  await screen.findByText("Siapkan dapurmu");
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ minHeight: 56, backgroundColor: nativeThemes.light.forest });
  fireEvent(step(), "responderGrant", touch);
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ opacity: 0.7, backgroundColor: nativeThemes.light.forest });
  fireEvent.press(step());
  expect(router.push).toHaveBeenCalledWith("/paket/baru");
});

describe("the setup card in the dark theme", () => {
  afterEach(() => jest.restoreAllMocks());

  it("draws the setup card plain, with forest on the first step only, in the dark theme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="t.theme">
        <MobileProvider runtime={runtimeWith(async () => emptyDay())} linkMapper={(h) => h}>
          <TodayScreen />
        </MobileProvider>
      </ThemeProvider>,
    );
    await screen.findByText("Siapkan dapurmu");
    const row = (name: RegExp) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
    // Direction K: forest fills only the first step (the one brand control here); the other rows sit on sage.
    expect(row(/Buat paket pertama/).backgroundColor).toBe(nativeThemes.dark.forest);
    expect(row(/Pindahkan pelanggan lama/).backgroundColor).toBe(nativeThemes.dark.well);
    expect(StyleSheet.flatten(screen.getByText("Siapkan dapurmu").props.style).color).toBe(nativeThemes.dark.charcoal);
  });
});

describe("issueSteps", () => {
  it("walks any open status forward to issue", () => {
    expect(issueSteps("scheduled")).toEqual(["preparing", "out_for_delivery", "issue"]);
    expect(issueSteps("out_for_delivery")).toEqual(["issue"]);
    expect(issueSteps("delivered")).toEqual([]);
  });
});


it("opens on the day a notification points to", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86400000));
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen date={tomorrow} />
    </MobileProvider>,
  );
  await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenCalledWith("k-1", tomorrow));
});

it("keeps the day toggle for a kitchen with packages on a day without deliveries", async () => {
  renderToday(runtimeWith(async () => quietDay()));
  expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
  expect(screen.getByRole("button", { name: CHANGE_DAY })).toBeTruthy();
  expect(screen.queryByText("Siapkan dapurmu")).toBeNull();
});

it("never shows helpers the owner setup steps", async () => {
  renderToday(runtimeWith(async () => emptyDay(), { ...owner, role: "staff" }));
  expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
  expect(screen.getByRole("button", { name: CHANGE_DAY })).toBeTruthy();
  expect(screen.queryByText("Siapkan dapurmu")).toBeNull();
});

it("moves a customer's day from Besok while the cutoff is still ahead", async () => {
  const day = canvasDay();
  const d = day.deliveries.find((x) => x.customer.name === "Keluarga Hartono")!;
  // The shape the seller read really returns: customerRecordId beside customer, not inside it.
  Object.assign(d, { cutoff_at: "2099-01-01T10:00:00Z", customerRecordId: "cr-1" });
  const runtime = runtimeWith(async () => day);
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86400000));
  renderToday(runtime, tomorrow);
  fireEvent.press(await stopMenu(3));
  expect(screen.queryByText("Gagal diantar")).toBeNull();
  // The date is chosen on the calendar sheet, which replaces this one (the whole move is covered in selection-mode).
  fireEvent.press(screen.getByRole("button", { name: "Pindah tanggal" }));
  // The calendar opens once the tab stack reports the stop sheet has finished leaving.
  await waitFor(() => expect(router.push).toHaveBeenLastCalledWith(`/pindah-tanggal/${d.id}?meal=lunch&date=${tomorrow}`));
});

it("the stop menu button and the problem options give haptics", async () => {
  renderToday(runtimeWith(same(canvasDay())));
  fireEvent.press(await stopMenu(1));
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  fireEvent.press(await screen.findByRole("button", { name: "Pindah tanggal" }));
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
});

it("tells the caterer plainly what a failed delivery means", async () => {
  renderToday(runtimeWith(same(canvasDay())));
  fireEvent.press(await stopMenu(3));
  expect(await screen.findByText(/tidak dihitung sebagai pengantaran/)).toBeTruthy();
  expect(screen.queryByText(/pengembalian dana diurus Catera/)).toBeNull();
});

it("names the customer, day and meal on a problem report and opens it", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  (runtime.api.request as jest.Mock).mockImplementation(async (path: string) =>
    path.startsWith("delivery-issues") ? [report(), report({ id: "i-2", status: "resolved", customerName: "Sari" })] : [],
  );
  // The attention read lists the same report too; it must not become a second, generic card.
  const item = (id: string, kind: string, context: string) => ({
    id, kind, priority: 1, at_time: "2026-10-08T05:40:00Z", context, href: "/seller/support", serviceDate: "2026-10-08", meal: "lunch",
  });
  (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
    items: [item("issue-i-1", "delivery_issue", "Belum sampai"), item("case-1", "support", "Tanya tagihan")],
    total: 2,
    nextCursor: null,
    timezone: "Asia/Jakarta",
  });
  renderToday(runtime);
  // One to-do shows (the report, which comes first); the question waits behind "1 hal lainnya" and opens in place.
  expect(await screen.findByText("Nadia Putri melaporkan masalah")).toBeTruthy();
  expect(screen.queryByText("Pertanyaan pelanggan menunggu")).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "1 hal lainnya" }));
  expect(await screen.findByText("Pertanyaan pelanggan menunggu")).toBeTruthy();
  fireEvent.press(await screen.findByText("Nadia Putri melaporkan masalah"));
  expect(router.push).toHaveBeenCalledWith("/balas/i-1?title=Nadia%20Putri");
  expect(screen.getByText("Kamis 8 Okt · Makan siang")).toBeTruthy();
  expect(screen.getByText("Belum sampai")).toBeTruthy();
  // Only reports still waiting on the caterer are cards; the generic, untappable card is gone.
  expect(screen.queryByText("Sari melaporkan masalah")).toBeNull();
  expect(screen.queryByText("Pelanggan melaporkan masalah")).toBeNull();
  expect(runtime.api.request).toHaveBeenCalledWith("delivery-issues?id=k-1");
});

const tomorrowDay = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86400000));

it("offers Pindah tanggal on today's stop of a customer before the change deadline, beside Gagal diantar", async () => {
  const day = canvasDay();
  const sari = day.deliveries.find((x) => x.customer.name === "Bu Sari Wulandari")!;
  const runtime = runtimeWith(async () => day);
  renderToday(runtime);
  fireEvent.press(await stopMenu(1));
  expect(await screen.findByText("Gagal diantar")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Pindah tanggal" }));
  await waitFor(() => expect(router.push).toHaveBeenLastCalledWith(`/pindah-tanggal/${sari.id}?meal=lunch&date=${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())}`));
  expect(screen.queryByLabelText("Tanggal baru (TTTT-BB-HH)")).toBeNull();
});

it("keeps only Gagal diantar today once the deadline has passed or the package has fixed dates", async () => {
  renderToday(runtimeWith(same(canvasDay())));
  fireEvent.press(await stopMenu(3));
  expect(await screen.findByText("Gagal diantar")).toBeTruthy();
  expect(screen.queryByText("Pindah tanggal")).toBeNull();
});

it("shows the move button on Besok only for days that can still move", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  renderToday(runtime, tomorrowDay());
  fireEvent.press(await stopMenu(1));
  expect(screen.queryByText("Gagal diantar")).toBeNull();
  expect(screen.getByText("Pindah tanggal")).toBeTruthy();
  // Past the deadline (Keluarga Hartono, 3) or a fixed-date package (Kantor PT Sinar Rasa, 2): no button at all.
  expect(within(screen.getByTestId("stop-3")).queryByLabelText(/^(Laporkan masalah|Pindah tanggal)/)).toBeNull();
  expect(within(screen.getByTestId("stop-2")).queryByLabelText(/^(Laporkan masalah|Pindah tanggal)/)).toBeNull();
});

it("says when customer reports could not be loaded and retries", async () => {
  const runtime = runtimeWith(same(canvasDay()));
  let failing = true;
  (runtime.api.request as jest.Mock).mockImplementation(async () => {
    if (failing) throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    return [report()];
  });
  renderToday(runtime);
  expect(await screen.findByText("Laporan pelanggan belum bisa dimuat.")).toBeTruthy();
  failing = false;
  fireEvent.press(screen.getByText("Coba lagi"));
  expect(await screen.findByText("Nadia Putri melaporkan masalah")).toBeTruthy();
  expect(screen.queryByText("Laporan pelanggan belum bisa dimuat.")).toBeNull();
});

describe("session cards", () => {
  afterEach(() => jest.useRealTimers());


  it("shows one card per meal session with its delivery list", async () => {
    const base = canvasDay();
    const day = {
      ...base,
      deliveries: [{ ...base.deliveries[0], portions: 1, customer: { id: "c-9", name: "Nadia Putri" } }],
    } as unknown as typeof base;
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByTestId("session-card")).toBeTruthy();
    expect(within(screen.getByTestId("session-count")).getByTestId("session-figures-cell-0").props.accessibilityLabel).toBe("1 porsi");
    expect(screen.getByText("Nadia Putri")).toBeTruthy();
    expect(screen.getByText("Bagikan rute ke WhatsApp")).toBeTruthy();
    expect(screen.queryByText("Makan malam")).toBeNull();
  });

  it("shows a calm empty state", async () => {
    renderToday(runtimeWith(async () => quietDay()));
    expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
    expect(screen.getByText("Pesanan baru akan muncul di sini.")).toBeTruthy();
  });

  it("words the empty state for tomorrow", async () => {
    renderToday(runtimeWith(async () => quietDay()));
    await screen.findByText("Tidak ada yang dimasak hari ini.");
    fireEvent.press(screen.getByRole("button", { name: CHANGE_DAY }));
    expect(await screen.findByText("Tidak ada yang dimasak besok.")).toBeTruthy();
  });
});

describe("Hari ini by mood", () => {
  afterEach(() => {
    jest.useRealTimers();
    // The setup's mock returns false; a test that asked for reduced motion must not leak it.
    jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(false);
    (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  });

  // 14:59 and 15:00 in Jakarta: the two sides of the mood default.
  const SIANG_NOW = () => new Date("2026-10-08T07:59:00Z");
  const MALAM_NOW = () => new Date("2026-10-08T08:00:00Z");

  const renderMood = (runtime: MobileRuntime, now = SIANG_NOW) =>
    render(
      <MoodProvider now={now}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <TodayScreen />
        </MobileProvider>
      </MoodProvider>,
    );

  /** The canvas day with real windows: Rumahan opens 11.30, Hemat opens 10.30. */
  const timedDay = () => {
    const day = canvasDay();
    for (const d of day.deliveries) {
      const hemat = d.offer.id === "p-hemat";
      d.offer = {
        ...d.offer,
        windows: hemat ? { lunch: "10.30–12.00", dinner: "18.00–19.30" } : { lunch: "11.30–13.00", dinner: "17.45–19.30" },
      };
    }
    return day;
  };
  /** Kost Damai (23 portions) eats at dinner instead, so the day has both sessions. */
  const toDinner = (day: SellerOperationsState, who = "Kost Damai") => {
    const d = day.deliveries.find((x) => x.customer.name === who)!;
    d.meals = d.meals.map((m) => ({ ...m, meal: "dinner" }));
    return day;
  };
  const dinnerOnly = () => {
    const day = canvasDay();
    for (const d of day.deliveries)
      d.meals = d.meals.map((m) => ({ ...m, meal: "dinner", status: "preparing", cooking_started_at: "2026-10-08T11:00:00Z" }) as typeof m);
    return day;
  };
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
  const tabsSelected = () => screen.getAllByRole("tab").map((t) => t.props.accessibilityState.selected);

  it("titles the header with the date, a button that switches between today and tomorrow", async () => {
    pinToday();
    renderMood(runtimeWith(same(canvasDay())));
    const button = await screen.findByRole("button", { name: CHANGE_DAY });
    expect(within(button).getByText("Kamis 8 Okt")).toBeTruthy();
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(48);
    // Label in Name (WCAG 2.5.3): the accessible name begins with the text the eye reads.
    expect(button.props.accessibilityLabel).toBe("Kamis 8 Okt, ganti hari");
    expect(button.props.accessibilityHint).toBeUndefined();
    expect(within(button).UNSAFE_getByType(Ionicons).props).toMatchObject({
      name: "chevron-down",
      color: nativeMood.light.siang.headerText,
    });
    expect(StyleSheet.flatten(within(button).getByText("Kamis 8 Okt").props.style).color).toBe(nativeMood.light.siang.headerText);
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();

    fireEvent.press(button);
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(screen.getByText("Jumat 9 Okt")).toBeTruthy();

    const back = screen.getByRole("button", { name: CHANGE_DAY });
    expect(back.props.accessibilityLabel).toBe("Jumat 9 Okt, ganti hari");
    fireEvent.press(back);
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
    expect(screen.getByText("Kamis 8 Okt")).toBeTruthy();
  });

  it("keeps the caterer name in the meta while the other day loads", async () => {
    pinToday();
    // Tomorrow's read never answers, so the screen stays in its loading state for that day.
    const stuck = new Promise<never>(() => {});
    const byDate = (_id: string, date: string) => (date === "2026-10-09" ? stuck : Promise.resolve(canvasDay()));
    renderMood(runtimeWith(byDate as unknown as () => Promise<unknown>));
    await screen.findByText("Dapur Bu Rina · Hari ini");
    fireEvent.press(screen.getByRole("button", { name: CHANGE_DAY }));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    expect(screen.getByLabelText("Memuat dapur")).toBeTruthy();
  });

  it("words the date button in English", async () => {
    pinToday();
    const runtime = runtimeWith(same(canvasDay()));
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
    renderMood(runtime);
    const button = await screen.findByRole("button", { name: /, change day$/ });
    expect(button.props.accessibilityLabel).toBe("Thu 8 Oct, change day");
    expect(await screen.findByText("Dapur Bu Rina · Today")).toBeTruthy();
    fireEvent.press(button);
    expect(await screen.findByText("Dapur Bu Rina · Tomorrow")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fri 9 Oct, change day" })).toBeTruthy();
  });

  it("has exactly one tablist, the mood toggle", async () => {
    renderMood(runtimeWith(same(canvasDay())));
    await screen.findByTestId("session-count");
    const tablists = screen.UNSAFE_root.findAll(
      (n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist",
    );
    expect(tablists).toHaveLength(1);
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Siang", "Malam"]);
    expect(tabsSelected()).toEqual([true, false]);
    expect(screen.queryByText("Masak")).toBeNull();
  });

  it("draws the band's Siang / Malam toggle compact: a 34 track that keeps the 36 row, its tabs reaching 48 by hitSlop 7", async () => {
    renderMood(runtimeWith(same(canvasDay())));
    await screen.findByTestId("session-count");
    const row = within(screen.getByTestId("mood-header")).getByTestId("mood-header-row");
    expect(StyleSheet.flatten(row.props.style).minHeight).toBe(36);
    const [track] = screen.UNSAFE_root.findAll((n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist");
    // 34 = the 1 edge, the 1 padding and the 30 pills: shorter than the row, so the row stays 36 (the 54 regular track grew it to 48).
    expect(StyleSheet.flatten(track.props.style)).toMatchObject({ borderWidth: 1, padding: 1 });
    expect(Number.isInteger(StyleSheet.flatten(track.props.style).width)).toBe(true);
    // The toggle's wrapper in the row takes no negative margin: the track is shorter than the row.
    let wrapper = track.parent;
    while (wrapper && StyleSheet.flatten(wrapper.props.style as never)?.flexShrink !== 0) wrapper = wrapper.parent;
    expect(StyleSheet.flatten(wrapper!.props.style as never).marginVertical).toBe(0);
    for (const tab of screen.getAllByRole("tab")) {
      expect(StyleSheet.flatten(tab.props.style)).toMatchObject({ height: 34, marginVertical: -2 });
      expect(tab.props.hitSlop).toEqual({ top: 7, bottom: 7 });
    }
    expect(StyleSheet.flatten(screen.getByTestId("mood-toggle-pill").props.style)).toMatchObject({ top: 1, bottom: 1, left: 1 });
  });

  describe("the figure strip", () => {
    it("is the theme's surface under the date, leading with the mood's portions", async () => {
      renderMood(runtimeWith(async () => timedDay()));
      const card = await screen.findByTestId("session-count");
      const strip = within(card).getByTestId("session-figures");
      const number = within(strip).getByText("34");
      // The lead figure is the 32/40 tabular variant, in the ink.
      expect(StyleSheet.flatten(number.props.style)).toMatchObject({
        fontSize: 32,
        lineHeight: 40,
        fontVariant: expect.arrayContaining(["tabular-nums"]),
        color: nativeThemes.light.charcoal,
      });
      expect(within(strip).getByText("porsi")).toBeTruthy();
      expect(within(strip).getByText("paket")).toBeTruthy();
      expect(within(strip).getByText("alamat")).toBeTruthy();
      // The earliest of the lunch windows: Paket Hemat opens at 10.30.
      expect(within(strip).getByText("Antar 10.30")).toBeTruthy();
      // One card on the header: the theme's surface (which is the hero surface of both moods), radius 16, no hero fill.
      expect(flat("session-figures")).toMatchObject({ backgroundColor: nativeThemes.light.surface, borderRadius: 16, borderCurve: "continuous" });
      expect(screen.queryByTestId("session-count-fill-siang", { includeHiddenElements: true })).toBeNull();
    });

    it("needs no fill that fades: the strip is the same surface in Siang and Malam while the header's own fill fades", async () => {
      jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
      renderMood(runtimeWith(async () => toDinner(timedDay())));
      await screen.findByTestId("session-count");
      expect(nativeMood.light.siang.hero).toBe(nativeThemes.light.surface);
      expect(nativeMood.light.malam.hero).toBe(nativeThemes.light.surface);
      expect(flat("mood-fill-malam").opacity).toBe(0);
      expect(flat("session-figures").backgroundColor).toBe(nativeThemes.light.surface);
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(await within(screen.getByTestId("session-count")).findByText("23")).toBeTruthy();
      expect(flat("mood-fill-malam").opacity).toBe(1);
      expect(flat("session-figures").backgroundColor).toBe(nativeThemes.light.surface);
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      expect(await within(screen.getByTestId("session-count")).findByText("11")).toBeTruthy();
      expect(flat("mood-fill-malam").opacity).toBe(0);
    });

    it("follows the mood to the dinner session", async () => {
      renderMood(runtimeWith(async () => toDinner(timedDay())), MALAM_NOW);
      const card = await screen.findByTestId("session-count");
      expect(within(card).getByText("23")).toBeTruthy();
      expect(within(card).getByTestId("session-figures-cell-2").props.accessibilityLabel).toBe("1 alamat");
      expect(within(card).getByText("Antar 17.45")).toBeTruthy();
    });

    it("is worded in English", async () => {
      const runtime = runtimeWith(async () => timedDay());
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
      renderMood(runtime);
      const card = await screen.findByTestId("session-count");
      expect(await within(card).findByText("portions")).toBeTruthy();
      expect(within(card).getByText("packages")).toBeTruthy();
      expect(within(card).getByText("addresses")).toBeTruthy();
      expect(within(card).getByText("Delivery 10.30")).toBeTruthy();
    });
  });

  describe("one session at a time", () => {
    it("shows only the mood's session card and swaps it with the toggle", async () => {
      renderMood(runtimeWith(async () => toDinner(canvasDay())));
      expect(await screen.findByText("Keluarga Hartono")).toBeTruthy();
      expect(screen.queryByText("Kost Damai")).toBeNull();

      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(await screen.findByText("Kost Damai")).toBeTruthy();
      expect(screen.queryByText("Keluarga Hartono")).toBeNull();
      expect(tabsSelected()).toEqual([false, true]);
    });

    it("in Malam with only lunch work says so and offers the lunch session", async () => {
      renderMood(runtimeWith(same(canvasDay())), MALAM_NOW);
      expect(await screen.findByText("Tidak ada pengantaran makan malam.")).toBeTruthy();
      expect(screen.queryByTestId("session-count")).toBeNull();
      expect(tabsSelected()).toEqual([false, true]);

      fireEvent.press(screen.getByRole("button", { name: "Lihat makan siang · 34 porsi" }));
      expect(await screen.findByTestId("session-card")).toBeTruthy();
      expect(tabsSelected()).toEqual([true, false]);
      expect(screen.queryByText("Tidak ada pengantaran makan malam.")).toBeNull();
      expect(within(screen.getByTestId("session-count")).getByText("34")).toBeTruthy();
    });

    it("in Siang with only dinner work offers the dinner session", async () => {
      renderMood(runtimeWith(async () => dinnerOnly()));
      expect(await screen.findByText("Tidak ada pengantaran makan siang.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Lihat makan malam · 34 porsi" }));
      expect(await screen.findByTestId("session-card")).toBeTruthy();
      expect(tabsSelected()).toEqual([false, true]);
    });

    it("keeps the whole-day empty card when neither meal has work", async () => {
      renderMood(runtimeWith(async () => quietDay()), MALAM_NOW);
      expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
      expect(screen.queryByText("Tidak ada pengantaran makan malam.")).toBeNull();
      expect(screen.queryByText(/^Lihat makan/)).toBeNull();
    });

    it("words the empty session and its way across in English", async () => {
      const runtime = runtimeWith(same(canvasDay()));
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
      renderMood(runtime, MALAM_NOW);
      expect(await screen.findByText("No dinner deliveries.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "See lunch · 34 portions" })).toBeTruthy();
    });
  });

  describe("in Malam", () => {
    it("paints the header on the deep Malam fill and keeps the title readable on it", async () => {
      jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
      renderMood(runtimeWith(same(canvasDay())), MALAM_NOW);
      await screen.findByText("Tidak ada pengantaran makan malam.");
      expect(flat("mood-fill-malam").backgroundColor).toBe("#E2ECDD");
      // The fill is always mounted; in Malam it is the opaque layer.
      expect(flat("mood-fill-malam").opacity).toBe(1);
      const title = within(screen.getByTestId("mood-header")).getByRole("button", { name: CHANGE_DAY });
      expect(StyleSheet.flatten(within(title).getByText(/\d/).props.style).color).toBe("#2E2E2E");
    });

    it("keeps a failed read readable: the message sits on the body in the error colour, not inside the header", async () => {
      (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
      renderMood(
        runtimeWith(async () => {
          throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
        }),
        MALAM_NOW,
      );
      const message = await screen.findByText(errorLabel("REQUEST_TIMEOUT", "id"));
      expect(StyleSheet.flatten(message.props.style).color).toBe(nativeThemes.light.danger);
      expect(message.props.selectable).toBe(true);
      expect(within(screen.getByTestId("mood-header")).queryByText(errorLabel("REQUEST_TIMEOUT", "id"))).toBeNull();
      expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
      expect(screen.queryByTestId("session-count")).toBeNull();
    });
  });
});

describe("route sharing after a same-day revision", () => {
  it("shares a defined message when the route shrinks below the part already reached", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t" });
    const short = canvasDay();
    const long = {
      ...short,
      deliveries: short.deliveries.map((d) => ({ ...d, address: { ...d.address, instructions: "pagar hijau ".repeat(60) } })),
    } as typeof short;
    const card = (ops: typeof short) => (
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <SessionCard
          ops={ops}
          session={kitchenSession(ops, "lunch", new Date())!}
          ticks={{ ticked: new Set(), toggle: () => undefined }}
          meal="lunch"
          date="2026-10-08"
          report="today"
          caterer="Dapur Bu Rina"
        />
      </MobileProvider>
    );
    const view = render(card(long));
    fireEvent.press(screen.getByText("Bagikan rute ke WhatsApp"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    fireEvent.press(await screen.findByText("Bagikan bagian 2"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    // Now on part 3 of a longer route; the revision leaves a single part.
    view.rerender(card(short));
    fireEvent.press(await screen.findByText("Bagikan rute ke WhatsApp"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(3));
    expect(share.mock.calls[2][0]).toEqual(expect.objectContaining({ message: expect.stringMatching(/^\*Antar siang/) }));
  });
});

it("Today error offers Coba lagi", async () => {
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  let failing = true;
  renderToday(
    runtimeWith(async () => {
      if (failing) throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      return canvasDay();
    }),
  );
  const retry = await screen.findByRole("button", { name: "Coba lagi" });
  failing = false;
  fireEvent.press(retry);
  expect(within(await screen.findByTestId("session-count")).getByText("34")).toBeTruthy();
});

it("new kitchen card makes no time claim", async () => {
  renderToday(runtimeWith(async () => emptyDay()));
  expect(await screen.findByText("Nama, foto, harga, hari antar")).toBeTruthy();
  expect(screen.queryByText(/menit/)).toBeNull();
});

describe("unfilled menus on the session card", () => {
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  /** The day's dated menus filled for both packages, on the date the screen opens on. */
  const filled = () => {
    const day = canvasDay();
    day.operationalDate = today();
    const dish = (id: string, groupId: string, name: string) => ({ id, groupId, name, description: "", image: "", serving: "" });
    const composition = (lauk: number) => [
      { id: "g-nasi", name: "Nasi", slots: 1 },
      { id: "g-lauk", name: "Lauk", slots: lauk },
      { id: "g-sayur", name: "Sayur", slots: 1 },
    ];
    const menu = (packageId: string, lauk: number, items: ReturnType<typeof dish>[]) => ({
      package_id: packageId, content_revision: 0, service_date: today(), meal: "lunch", version: 1,
      details: { name: "", description: "", image: "", meal: "lunch", composition: composition(lauk), items },
    });
    day.datedMenus = [
      menu("p-rumahan", 2, [dish("a", "g-nasi", "Nasi putih"), dish("b", "g-lauk", "Ayam bakar"), dish("c", "g-lauk", "Tempe orek"), dish("d", "g-sayur", "Sayur asem")]),
      menu("p-hemat", 1, [dish("e", "g-nasi", "Nasi putih"), dish("f", "g-lauk", "Telur balado"), dish("g", "g-sayur", "Sayur asem")]),
    ] as never;
    return day;
  };

  it("names the slots nobody filled, one line per package, and each Isi menu opens its own package", async () => {
    renderToday(runtimeWith(same(canvasDay())));
    expect(await screen.findByText("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur")).toBeTruthy();
    expect(screen.getByText("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur")).toBeTruthy();
    // A to-do status in strong charcoal (bodyStrong), never a bare danger caption.
    for (const line of screen.getAllByText(/^Menu belum diisi · /))
      expect(StyleSheet.flatten(line.props.style)).toMatchObject({ color: nativeThemes.light.charcoal, fontSize: 15, lineHeight: 22, fontFamily: "Jakarta-SemiBold" });
    expect(screen.queryByText(/Lauk ×/)).toBeNull();
    expect(screen.queryByText(/Nasi ×/)).toBeNull();
    const buttons = screen.getAllByText("Isi menu");
    expect(buttons).toHaveLength(2);
    fireEvent.press(buttons[0]);
    expect(router.push).toHaveBeenLastCalledWith(`/menu/${today()}?pkg=p-rumahan&meal=lunch`);
    fireEvent.press(buttons[1]);
    expect(router.push).toHaveBeenLastCalledWith(`/menu/${today()}?pkg=p-hemat&meal=lunch`);
  });

  it("lists only the package that is still unfilled when the other is complete", async () => {
    const day = filled();
    day.datedMenus = day.datedMenus!.filter((m) => m.package_id === "p-rumahan");
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByText("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur")).toBeTruthy();
    expect(screen.queryByText(/Makan Siang Rumahan:/)).toBeNull();
    fireEvent.press(screen.getByText("Isi menu"));
    expect(router.push).toHaveBeenLastCalledWith(`/menu/${today()}?pkg=p-hemat&meal=lunch`);
  });

  it("shows helpers the line but not the button", async () => {
    renderToday(runtimeWith(async () => canvasDay(), { ...owner, role: "staff" }));
    expect((await screen.findAllByText(/^Menu belum diisi · /)).length).toBe(2);
    expect(screen.queryByText("Isi menu")).toBeNull();
  });

  it("shows no unfilled line when the menu is complete", async () => {
    renderToday(runtimeWith(async () => filled()));
    expect(await screen.findByText("Ayam bakar")).toBeTruthy();
    expect(screen.queryByText(/Menu belum diisi/)).toBeNull();
    expect(screen.queryByText("Isi menu")).toBeNull();
  });

  it("puts the unfilled line, not placeholder dishes, in the shared recap", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    renderToday(runtimeWith(same(canvasDay())));
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan" }));
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur");
    expect(message).toContain("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur");
    expect(message).not.toMatch(/×\s?Lauk|Lauk ×/);
  });
});

describe("printed recap", () => {
  it("prints the unfilled line too", async () => {
    const Print = require("expo-print") as { printAsync: jest.Mock };
    renderToday(runtimeWith(same(canvasDay())));
    fireEvent.press(await screen.findByRole("button", { name: "Cetak" }));
    expect(Print.printAsync.mock.calls[0][0].html).toContain("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur");
    expect(Print.printAsync.mock.calls[0][0].html).toContain("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur");
  });
});

describe("attention cards", () => {
  const attention = (href: string, kind = "payment") => ({
    items: [{ id: "a-1", kind, priority: 1, at_time: "2026-10-08T05:40:00Z", context: "Bu Sari", href }],
    total: 1, nextCursor: null, timezone: "Asia/Jakarta",
  });

  it("writes a delivery row's day and meal in words, not as 2026-10-20 · dinner", async () => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [{ id: "a-9", kind: "delivery", priority: 1, at_time: "2026-10-08T05:40:00Z", context: "2026-10-20 · dinner · Paket Hemat", href: "/seller" }],
      total: 1, nextCursor: null, timezone: "Asia/Jakarta",
    });
    renderToday(runtime);
    const body = await screen.findByTestId("attention-body-a-9");
    expect(within(body).queryByText(/2026-10-20|dinner/)).toBeNull();
    expect(within(body).getByText("Selasa 20 Okt · Makan malam · Paket Hemat")).toBeTruthy();
  });

  it("builds the line from the payload's own fields, and copes with no package name", async () => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [
        { id: "a-7", kind: "choice_deadline", priority: 2, at_time: "2026-10-08T05:40:00Z", context: "x", href: "/seller", serviceDate: "2026-10-21", meal: "lunch", packageName: "Paket Hemat" },
        { id: "a-8", kind: "delivery", priority: 0, at_time: "2026-10-08T05:41:00Z", context: "", href: "/seller", serviceDate: "2026-10-21", meal: "dinner" },
      ],
      total: 2, nextCursor: null, timezone: "Asia/Jakarta",
    });
    renderToday(runtime);
    expect(await within(await screen.findByTestId("attention-body-a-7")).findByText("Rabu 21 Okt · Makan siang · Paket Hemat")).toBeTruthy();
    // The second item is behind "1 hal lainnya".
    fireEvent.press(screen.getByRole("button", { name: "1 hal lainnya" }));
    expect(within(screen.getByTestId("attention-body-a-8")).getByText("Rabu 21 Okt · Makan malam")).toBeTruthy();
  });

  it("opens its link when the href maps to a Dapur screen", async () => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue(attention("/seller/customers"));
    renderToday(runtime);
    fireEvent.press(await screen.findByRole("link", { name: /Ada pembayaran yang perlu dicek/ }));
    expect(require("../src/nav").openLink).toHaveBeenCalledWith("/pelanggan");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("a link card is a link, and neither card shows a chevron on Android", async () => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [
        { id: "a-1", kind: "payment", priority: 1, at_time: "2026-10-08T05:40:00Z", context: "Bu Sari", href: "/seller/customers" },
        { id: "a-2", kind: "support", priority: 1, at_time: "2026-10-08T05:41:00Z", context: "Tanya tagihan", href: "/seller/support?case=c-1" },
      ],
      total: 2, nextCursor: null, timezone: "Asia/Jakarta",
    });
    renderToday(runtime);
    const link = await screen.findByRole("link", { name: /Ada pembayaran yang perlu dicek/ });
    const chevrons = within(link).UNSAFE_getAllByType(Ionicons).filter((i) => String(i.props.name).startsWith("chevron"));
    // The chevron is iOS only; Jest compiles the Android build (see dapur-d2.test.tsx).
    expect(chevrons).toHaveLength(0);
    fireEvent.press(screen.getByRole("button", { name: "1 hal lainnya" }));
    const plain = within(screen.getByTestId("attention-a-2")).UNSAFE_queryAllByType(Ionicons);
    expect(plain.filter((i) => String(i.props.name).startsWith("chevron"))).toHaveLength(0);
    // Both kinds are 64 rows: the title (rowTitle) and its context in the same text column.
    for (const id of ["a-1", "a-2"]) {
      expect(StyleSheet.flatten(screen.getByTestId(`attention-${id}`).props.style)).toMatchObject({ minHeight: 64, gap: 12 });
    }
  });

  it("stays a plain card when the href has no Dapur screen", async () => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue(attention("/seller/support?case=c-1", "support"));
    renderToday(runtime);
    expect(await screen.findByText("Pertanyaan pelanggan menunggu")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Pertanyaan pelanggan menunggu/ })).toBeNull();
    fireEvent.press(screen.getByText("Pertanyaan pelanggan menunggu"));
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("the live slot", () => {
  const box = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
  const item = (id: string, kind: string, context: string, href = "/seller/support") => ({
    id, kind, priority: 1, at_time: "2026-10-08T05:40:00Z", context, href,
  });
  /** One waiting report and two attention items: three to-dos in all. */
  const busy = (extra: Record<string, unknown> = {}) => {
    const runtime = runtimeWith(same(canvasDay()));
    (runtime.api.request as jest.Mock).mockImplementation(async (path: string) => (path.startsWith("delivery-issues") ? [report(extra)] : []));
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [item("a-1", "support", "Tanya tagihan"), item("a-2", "payment", "Bu Sari", "/seller/customers")],
      total: 2,
      nextCursor: null,
      timezone: "Asia/Jakarta",
    });
    return runtime;
  };

  it("shows one to-do and opens the other two in place from the 2 hal lainnya link", async () => {
    renderToday(busy());
    const slot = await screen.findByTestId("live-slot");
    // The first, in the existing order (reports, then attention items): the report; the rest wait.
    expect(within(slot).getByText("Nadia Putri melaporkan masalah")).toBeTruthy();
    expect(within(slot).queryByText("Pertanyaan pelanggan menunggu")).toBeNull();
    expect(within(slot).queryByText("Ada pembayaran yang perlu dicek")).toBeNull();
    const more = within(slot).getByRole("button", { name: "2 hal lainnya" });
    expect(box(more).minHeight).toBe(48);
    expect(more.props.accessibilityState).toMatchObject({ expanded: false });
    const card = within(slot).getByTestId("live-card");
    fireEvent.press(more);
    // In place: the same card holds all three, in order, and the link is gone. No route was opened.
    expect(within(slot).getByTestId("live-card")).toBe(card);
    const labels = ["Nadia Putri melaporkan masalah", "Pertanyaan pelanggan menunggu", "Ada pembayaran yang perlu dicek"];
    const all = card.findAll((n) => typeof n.type === "string");
    const places = labels.map((label) => all.indexOf(within(card).getByText(label)));
    expect(places).toEqual([...places].sort((a, b) => a - b));
    // The link stays where it is and now reads expanded, so focus is never left on a control that vanished.
    const open = within(slot).getByRole("button", { name: "2 hal lainnya" });
    expect(open.props.accessibilityState).toMatchObject({ expanded: true });
    expect(router.push).not.toHaveBeenCalled();
    // Pressing it again closes the two.
    fireEvent.press(open);
    expect(within(slot).queryByText("Pertanyaan pelanggan menunggu")).toBeNull();
    expect(within(slot).getByRole("button", { name: "2 hal lainnya" }).props.accessibilityState).toMatchObject({ expanded: false });
    fireEvent.press(within(slot).getByRole("button", { name: "2 hal lainnya" }));
    // Every row is a 64.
    for (const row of [within(card).getByRole("button", { name: "Buka laporan: Nadia Putri" }), within(card).getByTestId("attention-a-1")])
      expect(box(row).minHeight).toBe(64);
  });

  it("draws the card in the attention tone, as the reports and items had", async () => {
    renderToday(busy());
    const card = await screen.findByTestId("live-card");
    expect(box(card)).toMatchObject({
      backgroundColor: nativeThemes.light.cream,
      borderColor: nativeThemes.light.attentionBorder,
      borderRadius: 16,
    });
  });

  it("says when the report was already replied to, and says nothing more when it was not", async () => {
    const first = renderToday(busy());
    await screen.findByText("Nadia Putri melaporkan masalah");
    expect(screen.queryByText("Sudah kamu balas. Tandai selesai kalau sudah beres.")).toBeNull();
    first.unmount();
    renderToday(busy({ status: "responded" }));
    expect(await screen.findByText("Sudah kamu balas. Tandai selesai kalau sudah beres.")).toBeTruthy();
  });

  it("is left out when nothing waits, and on Besok even when reports do", async () => {
    const first = renderToday(runtimeWith(same(canvasDay())));
    await screen.findByTestId("session-card");
    expect(screen.queryByTestId("live-slot")).toBeNull();
    first.unmount();

    renderToday(busy());
    await screen.findByTestId("live-slot");
    fireEvent.press(screen.getByRole("button", { name: CHANGE_DAY }));
    await waitFor(() => expect(screen.queryByTestId("live-slot")).toBeNull());
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
  });

  it("keeps a new kitchen's setup card first, with the reports one tap behind it", async () => {
    const runtime = runtimeWith(async () => emptyDay());
    (runtime.api.request as jest.Mock).mockImplementation(async (path: string) => (path.startsWith("delivery-issues") ? [report()] : []));
    renderToday(runtime);
    expect(await screen.findByText("Siapkan dapurmu")).toBeTruthy();
    expect(screen.queryByText("Nadia Putri melaporkan masalah")).toBeNull();
    // The setup steps are 56 rows.
    for (const name of [/Buat paket pertama/, /Pindahkan pelanggan lama/, /Aktifkan pembayaran/])
      expect(box(screen.getByRole("button", { name })).minHeight).toBe(56);
    fireEvent.press(screen.getByRole("button", { name: "1 hal lainnya" }));
    expect(await screen.findByText("Nadia Putri melaporkan masalah")).toBeTruthy();
  });

  it("words the link in English", async () => {
    const runtime = busy();
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByRole("button", { name: "2 more" })).toBeTruthy();
    (SecureStore as unknown as { __store: Map<string, string> }).__store.delete(runtime.storageKey("locale"));
  });
});

describe("the compact rantang track and the regular one", () => {
  it("leaves the regular track as it was: a 64 rail, the words line drawn, the marker above the rail", () => {
    const { RantangTrack } = require("@catera/mobile-ui") as typeof import("@catera/mobile-ui");
    render(
      <MobileProvider runtime={runtimeWith(same(canvasDay()))} linkMapper={(h) => h}>
        <RantangTrack stage="preparing" caption="Dimasak 08.10" />
      </MobileProvider>,
    );
    const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
    expect(flat("rantang-track-rail").height).toBe(64);
    expect(screen.getByTestId("rantang-track-caption").props.children).toBe("Dimasak 08.10");
    expect(flat("rantang-track-marker")).toMatchObject({ top: 0, width: 24, height: 24 });
    expect(flat("rantang-track-stop-1")).toMatchObject({ width: 36, height: 36 });
    expect(flat("rantang-track-stop-1-disc")).toMatchObject({ width: 28, height: 28 });
  });
});

describe("dark Malam", () => {
  it("draws the figure strip on the dark surface and the batch progress on the dark mood, in Malam", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const day = canvasDay();
    for (const d of day.deliveries)
      d.meals = d.meals.map((m) => ({ ...m, meal: "dinner", status: "preparing", cooking_started_at: "2026-10-08T11:00:00Z" }) as typeof m);
    render(
      <ThemeProvider storageKey="t.theme">
        <MoodProvider now={() => new Date("2026-10-08T12:00:00Z")}>
          <MobileProvider runtime={runtimeWith(async () => day)} linkMapper={(h) => h}>
            <TodayScreen />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>,
    );
    const strip = await screen.findByTestId("session-figures");
    expect(StyleSheet.flatten(strip.props.style).backgroundColor).toBe(nativeThemes.dark.surface);
    expect(nativeMood.dark.malam.hero).toBe(nativeThemes.dark.surface);
    expect(StyleSheet.flatten(within(strip).getByText("34").props.style).color).toBe(nativeThemes.dark.charcoal);
    const flatOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
    const ink = nativeMood.dark.malam;
    expect(flatOf("batch-progress-track").backgroundColor).toBe(ink.arcTrack);
    expect(flatOf("batch-progress-segment-cooking").backgroundColor).toBe(ink.heroMeta);
    expect(StyleSheet.flatten(screen.getByText("0 dari 4 sampai").props.style).color).toBe(ink.headerText);
  });
});
