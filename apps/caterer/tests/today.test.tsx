import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
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

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("../src/today/offline", () => ({
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

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen />
    </MobileProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it("shows the lunch cooking total for the day", async () => {
  renderToday(runtimeWith(async () => canvasDay()));
  expect(within(await screen.findByTestId("session-count")).getByText("34")).toBeTruthy();
  expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
  // The session card names its meal but does not repeat the count in a second large number.
  expect(screen.getByText("Makan siang")).toBeTruthy();
  expect(screen.getByText("Per paket")).toBeTruthy();
  expect(screen.getAllByText("34")).toHaveLength(1);
  expect(screen.queryByText(/^\d+ porsi$/)).toBeNull();
  const large = screen.UNSAFE_root.findAll(
    (n) => typeof n.type === "string" && n.type === "Text" && StyleSheet.flatten(n.props.style)?.fontSize === 40,
  );
  expect(large).toHaveLength(1);
});

it("shares the route as WhatsApp-ready text", async () => {
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  renderToday(runtimeWith(async () => canvasDay()));
  fireEvent.press(await screen.findByText("Bagikan rute ke WhatsApp"));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0][0]).toEqual(
    expect.objectContaining({ message: expect.stringMatching(/^\*Antar siang/) }),
  );
});

it("reports a failed delivery by stepping it to the issue status", async () => {
  const runtime = runtimeWith(async () => canvasDay());
  renderToday(runtime);
  fireEvent.press(await screen.findByLabelText("Ada masalah: Keluarga Hartono"));
  fireEvent.press(await screen.findByText("Gagal diantar"));
  fireEvent.press(screen.getByText("Simpan laporan"));
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
  expect(screen.getByText(/Terakhir diperbarui 06\.12/)).toBeTruthy();
});

it("welcomes a new caterer with the setup card instead of empty lists", async () => {
  renderToday(runtimeWith(async () => emptyDay()));
  expect(await screen.findByText("Siapkan dapur Anda")).toBeTruthy();
});

it("report cards and setup rows dim on press and still navigate", async () => {
  const runtime = runtimeWith(async () => canvasDay());
  (runtime.api.request as jest.Mock).mockImplementation(async (path: string) => (path.startsWith("delivery-issues") ? [report()] : []));
  const first = renderToday(runtime);
  const card = () => screen.getByRole("button", { name: "Buka laporan: Nadia Putri" });
  await screen.findByText("Nadia Putri melaporkan masalah");
  expect(StyleSheet.flatten(card().props.style)?.opacity ?? 1).toBe(1);
  fireEvent(card(), "responderGrant", touch);
  expect(StyleSheet.flatten(card().props.style).opacity).toBe(0.7);
  // Same chevron as the link attention cards.
  expect(within(card()).UNSAFE_getByType(Ionicons).props).toMatchObject({ name: "chevron-forward", size: 18, color: nativeThemes.light.muted });
  fireEvent.press(card());
  expect(router.push).toHaveBeenCalledWith("/laporan/i-1");
  first.unmount();

  renderToday(runtimeWith(async () => emptyDay()));
  const step = () => screen.getByRole("button", { name: /Buat paket pertama/ });
  await screen.findByText("Siapkan dapur Anda");
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ minHeight: 56, backgroundColor: nativeThemes.light.cream });
  fireEvent(step(), "responderGrant", touch);
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ opacity: 0.7, backgroundColor: nativeThemes.light.cream });
  fireEvent.press(step());
  expect(router.push).toHaveBeenCalledWith("/paket/baru");
});

describe("the setup card in the dark theme", () => {
  afterEach(() => jest.restoreAllMocks());

  it("swaps the brand card and its rows with the theme, and keeps the unselected rows lifted", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    render(
      <ThemeProvider storageKey="t.theme">
        <MobileProvider runtime={runtimeWith(async () => emptyDay())} linkMapper={(h) => h}>
          <TodayScreen />
        </MobileProvider>
      </ThemeProvider>,
    );
    await screen.findByText("Siapkan dapur Anda");
    const row = (name: RegExp) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style);
    // The first step is the cream token, which is the deep green in dark: it differs from the light value.
    expect(nativeThemes.dark.cream).not.toBe(nativeThemes.light.cream);
    expect(row(/Buat paket pertama/).backgroundColor).toBe(nativeThemes.dark.cream);
    expect(row(/Pindahkan pelanggan lama/).backgroundColor).toBe("rgba(22,61,46,0.08)");
    expect(StyleSheet.flatten(screen.getByText("Siapkan dapur Anda").props.style).color).toBe(nativeThemes.dark.cream);
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
  const runtime = runtimeWith(async () => canvasDay());
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
  expect(await screen.findByText("Tidak ada masakan untuk hari ini.")).toBeTruthy();
  expect(screen.getByRole("button", { name: CHANGE_DAY })).toBeTruthy();
  expect(screen.queryByText("Siapkan dapur Anda")).toBeNull();
});

it("never shows helpers the owner setup steps", async () => {
  renderToday(runtimeWith(async () => emptyDay(), { ...owner, role: "staff" }));
  expect(await screen.findByText("Tidak ada masakan untuk hari ini.")).toBeTruthy();
  expect(screen.getByRole("button", { name: CHANGE_DAY })).toBeTruthy();
  expect(screen.queryByText("Siapkan dapur Anda")).toBeNull();
});

it("moves a customer's day from Besok while the cutoff is still ahead", async () => {
  const day = canvasDay();
  const d = day.deliveries.find((x) => x.customer.name === "Keluarga Hartono")!;
  // The shape the seller read really returns: customerRecordId beside customer, not inside it.
  Object.assign(d, { cutoff_at: "2099-01-01T10:00:00Z", customerRecordId: "cr-1" });
  const runtime = runtimeWith(async () => day);
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86400000));
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen date={tomorrow} />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByLabelText("Pindah tanggal: Keluarga Hartono"));
  expect(screen.queryByText("Gagal diantar")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("Tanggal baru (TTTT-BB-HH)"), "2099-01-05");
  fireEvent.changeText(screen.getByLabelText("Alasan"), "Dapur tutup sehari");
  fireEvent.press(screen.getByText("Simpan laporan"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "customer.deliveryChange",
      expect.objectContaining({ id: d.id, date: "2099-01-05" }),
      expect.any(String),
    ),
  );
});

it("the stop menu button and the problem options give haptics", async () => {
  renderToday(runtimeWith(async () => canvasDay()));
  fireEvent.press(await screen.findByLabelText("Ada masalah: Keluarga Hartono"));
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  const option = (await screen.findAllByRole("radio"))[0];
  fireEvent.press(option);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
});

it("tells the caterer plainly what a failed delivery means", async () => {
  renderToday(runtimeWith(async () => canvasDay()));
  fireEvent.press(await screen.findByLabelText("Ada masalah: Keluarga Hartono"));
  expect(await screen.findByText(/tidak dihitung terkirim/)).toBeTruthy();
  expect(screen.queryByText(/pengembalian dana diurus Catera/)).toBeNull();
});

it("names the customer, day and meal on a problem report and opens it", async () => {
  const runtime = runtimeWith(async () => canvasDay());
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
  expect(await screen.findByText("Pertanyaan pelanggan menunggu")).toBeTruthy();
  fireEvent.press(await screen.findByText("Nadia Putri melaporkan masalah"));
  expect(router.push).toHaveBeenCalledWith("/laporan/i-1");
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
  fireEvent.press(await screen.findByLabelText("Ada masalah: Bu Sari Wulandari"));
  expect(await screen.findByText("Gagal diantar")).toBeTruthy();
  fireEvent.press(screen.getByText("Pindah tanggal"));
  fireEvent.changeText(screen.getByLabelText("Tanggal baru (TTTT-BB-HH)"), "2099-01-06");
  fireEvent.changeText(screen.getByLabelText("Alasan"), "Pelanggan minta pindah");
  fireEvent.press(screen.getByText("Simpan laporan"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "customer.deliveryChange",
      { catererId: "k-1", id: sari.id, version: 3, date: "2099-01-06", reason: "Pelanggan minta pindah" },
      expect.any(String),
    ),
  );
});

it("keeps only Gagal diantar today once the deadline has passed or the package has fixed dates", async () => {
  renderToday(runtimeWith(async () => canvasDay()));
  fireEvent.press(await screen.findByLabelText("Ada masalah: Keluarga Hartono"));
  expect(await screen.findByText("Gagal diantar")).toBeTruthy();
  expect(screen.queryByText("Pindah tanggal")).toBeNull();
});

it("shows the move button on Besok only for days that can still move", async () => {
  const runtime = runtimeWith(async () => canvasDay());
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen date={tomorrowDay()} />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByLabelText("Pindah tanggal: Bu Sari Wulandari"));
  expect(screen.queryByText("Gagal diantar")).toBeNull();
  expect(screen.getByText("Pindah tanggal")).toBeTruthy();
  // Past the deadline (Keluarga Hartono) or a fixed-date package (Kantor PT Sinar Rasa): no button at all.
  expect(screen.queryByLabelText("Pindah tanggal: Keluarga Hartono")).toBeNull();
  expect(screen.queryByLabelText("Pindah tanggal: Kantor PT Sinar Rasa")).toBeNull();
});

it("says when customer reports could not be loaded and retries", async () => {
  const runtime = runtimeWith(async () => canvasDay());
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
    expect(await screen.findByText("Makan siang")).toBeTruthy();
    expect(within(screen.getByTestId("session-count")).getByText("1")).toBeTruthy();
    expect(screen.getByText("Nadia Putri")).toBeTruthy();
    expect(screen.getByText("Bagikan rute ke WhatsApp")).toBeTruthy();
    expect(screen.queryByText("Makan malam")).toBeNull();
  });

  it("shows a calm empty state", async () => {
    renderToday(runtimeWith(async () => quietDay()));
    expect(await screen.findByText("Tidak ada masakan untuk hari ini.")).toBeTruthy();
    expect(screen.getByText("Pesanan baru akan muncul di sini.")).toBeTruthy();
  });

  it("words the empty state for tomorrow", async () => {
    renderToday(runtimeWith(async () => quietDay()));
    await screen.findByText("Tidak ada masakan untuk hari ini.");
    fireEvent.press(screen.getByRole("button", { name: CHANGE_DAY }));
    expect(await screen.findByText("Tidak ada masakan untuk besok.")).toBeTruthy();
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
    for (const d of day.deliveries) d.meals = d.meals.map((m) => ({ ...m, meal: "dinner" }));
    return day;
  };
  const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);
  const tabsSelected = () => screen.getAllByRole("tab").map((t) => t.props.accessibilityState.selected);

  it("titles the header with the date, a button that switches between today and tomorrow", async () => {
    pinToday();
    renderMood(runtimeWith(async () => canvasDay()));
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
    expect(screen.getByText("Memuat…")).toBeTruthy();
  });

  it("words the date button in English", async () => {
    pinToday();
    const runtime = runtimeWith(async () => canvasDay());
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
    renderMood(runtimeWith(async () => canvasDay()));
    await screen.findByTestId("session-count");
    const tablists = screen.UNSAFE_root.findAll(
      (n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist",
    );
    expect(tablists).toHaveLength(1);
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Siang", "Malam"]);
    expect(tabsSelected()).toEqual([true, false]);
    expect(screen.queryByText("Masak")).toBeNull();
  });

  describe("the count card", () => {
    it("sits on the mood hero fill and counts the mood's meal", async () => {
      renderMood(runtimeWith(async () => timedDay()));
      const card = await screen.findByTestId("session-count");
      const number = within(card).getByText("34");
      expect(StyleSheet.flatten(number.props.style)).toMatchObject({
        color: nativeMood.light.siang.heroText,
        fontVariant: expect.arrayContaining(["tabular-nums"]),
      });
      const caption = within(card).getByText("porsi siang · 4 alamat");
      expect(StyleSheet.flatten(caption.props.style).color).toBe(nativeMood.light.siang.heroMeta);
      // The earliest of the lunch windows: Paket Hemat opens at 10.30.
      expect(within(card).getByText("Antar 10.30")).toBeTruthy();
      expect(flat("session-count-fill-siang").backgroundColor).toBe(nativeMood.light.siang.hero);
      expect(flat("session-count-fill-malam").backgroundColor).toBe(nativeMood.light.malam.hero);
      expect(flat("session-count")).toMatchObject({ borderRadius: 22, borderCurve: "continuous" });
      // The one shadow sits on the base fill (MoodFill), from the current mood's token.
      expect(flat("session-count-fill-siang")).toMatchObject({ borderRadius: 22, boxShadow: nativeMood.light.siang.heroShadow });
      expect(flat("session-count-fill-malam").boxShadow).toBeUndefined();
    });

    it("cross-fades its Malam fill over the Siang one when the mood switches (instant under reduced motion)", async () => {
      jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
      renderMood(runtimeWith(async () => toDinner(timedDay())));
      await screen.findByTestId("session-count");
      // Both layers are always mounted; only the Malam one's opacity says which mood is showing.
      expect(flat("session-count-fill-malam").opacity).toBe(0);
      expect(flat("mood-fill-malam").opacity).toBe(0);
      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(await within(screen.getByTestId("session-count")).findByText("23")).toBeTruthy();
      expect(flat("session-count-fill-malam").opacity).toBe(1);
      expect(flat("mood-fill-malam").opacity).toBe(1);
      fireEvent.press(screen.getByRole("tab", { name: "Siang" }));
      expect(await within(screen.getByTestId("session-count")).findByText("11")).toBeTruthy();
      expect(flat("session-count-fill-malam").opacity).toBe(0);
    });

    it("follows the mood to the dinner session", async () => {
      renderMood(runtimeWith(async () => toDinner(timedDay())), MALAM_NOW);
      const card = await screen.findByTestId("session-count");
      expect(within(card).getByText("23")).toBeTruthy();
      expect(within(card).getByText("porsi malam · 1 alamat")).toBeTruthy();
      expect(within(card).getByText("Antar 17.45")).toBeTruthy();
      expect(StyleSheet.flatten(within(card).getByText("23").props.style).color).toBe(nativeMood.light.malam.heroText);
      expect(flat("session-count-fill-siang").boxShadow).toBe(nativeMood.light.malam.heroShadow);
    });

    it("is worded in English", async () => {
      const runtime = runtimeWith(async () => timedDay());
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
      renderMood(runtime);
      const card = await screen.findByTestId("session-count");
      expect(await within(card).findByText("lunch portions · 4 addresses")).toBeTruthy();
      expect(within(card).getByText("Deliver 10.30")).toBeTruthy();
    });
  });

  describe("one session at a time", () => {
    it("shows only the mood's session card and swaps it with the toggle", async () => {
      renderMood(runtimeWith(async () => toDinner(canvasDay())));
      expect(await screen.findByText("Makan siang")).toBeTruthy();
      expect(screen.queryByText("Makan malam")).toBeNull();
      expect(screen.queryByText("Kost Damai")).toBeNull();

      fireEvent.press(screen.getByRole("tab", { name: "Malam" }));
      expect(await screen.findByText("Makan malam")).toBeTruthy();
      expect(screen.getByText("Kost Damai")).toBeTruthy();
      expect(screen.queryByText("Makan siang")).toBeNull();
      expect(screen.queryByText("Keluarga Hartono")).toBeNull();
      expect(tabsSelected()).toEqual([false, true]);
    });

    it("in Malam with only lunch work says so and offers the lunch session", async () => {
      renderMood(runtimeWith(async () => canvasDay()), MALAM_NOW);
      expect(await screen.findByText("Tidak ada antaran makan malam.")).toBeTruthy();
      expect(screen.queryByText("Makan siang")).toBeNull();
      expect(screen.queryByTestId("session-count")).toBeNull();
      expect(tabsSelected()).toEqual([false, true]);

      fireEvent.press(screen.getByRole("button", { name: "Lihat makan siang · 34 porsi" }));
      expect(await screen.findByText("Makan siang")).toBeTruthy();
      expect(tabsSelected()).toEqual([true, false]);
      expect(screen.queryByText("Tidak ada antaran makan malam.")).toBeNull();
      expect(within(screen.getByTestId("session-count")).getByText("34")).toBeTruthy();
    });

    it("in Siang with only dinner work offers the dinner session", async () => {
      renderMood(runtimeWith(async () => dinnerOnly()));
      expect(await screen.findByText("Tidak ada antaran makan siang.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Lihat makan malam · 34 porsi" }));
      expect(await screen.findByText("Makan malam")).toBeTruthy();
      expect(tabsSelected()).toEqual([false, true]);
    });

    it("keeps the whole-day empty card when neither meal has work", async () => {
      renderMood(runtimeWith(async () => quietDay()), MALAM_NOW);
      expect(await screen.findByText("Tidak ada masakan untuk hari ini.")).toBeTruthy();
      expect(screen.queryByText("Tidak ada antaran makan malam.")).toBeNull();
      expect(screen.queryByText(/^Lihat makan/)).toBeNull();
    });

    it("words the empty session and its way across in English", async () => {
      const runtime = runtimeWith(async () => canvasDay());
      (SecureStore as unknown as { __store: Map<string, string> }).__store.set(runtime.storageKey("locale"), "en");
      renderMood(runtime, MALAM_NOW);
      expect(await screen.findByText("No dinner deliveries.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "See lunch · 34 portions" })).toBeTruthy();
    });
  });

  describe("in Malam", () => {
    it("paints the header on the deep Malam fill and keeps the title readable on it", async () => {
      jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true);
      renderMood(runtimeWith(async () => canvasDay()), MALAM_NOW);
      await screen.findByText("Tidak ada antaran makan malam.");
      expect(flat("mood-fill-malam").backgroundColor).toBe("#0B1F16");
      // The fill is always mounted; in Malam it is the opaque layer.
      expect(flat("mood-fill-malam").opacity).toBe(1);
      const title = within(screen.getByTestId("mood-header")).getByRole("button", { name: CHANGE_DAY });
      expect(StyleSheet.flatten(within(title).getByText(/\d/).props.style).color).toBe("#FFF7E9");
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
          catererId="k-1"
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
  expect(await screen.findByText("Satu layar")).toBeTruthy();
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
    renderToday(runtimeWith(async () => canvasDay()));
    expect(await screen.findByText("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur")).toBeTruthy();
    expect(screen.getByText("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur")).toBeTruthy();
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
    renderToday(runtimeWith(async () => canvasDay()));
    fireEvent.press(await screen.findByText("Bagikan"));
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message).toContain("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur");
    expect(message).toContain("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur");
    expect(message).not.toMatch(/×\s?Lauk|Lauk ×/);
  });
});

describe("printed recap", () => {
  it("prints the unfilled line too", async () => {
    const Print = require("expo-print") as { printAsync: jest.Mock };
    renderToday(runtimeWith(async () => canvasDay()));
    fireEvent.press(await screen.findByText("Cetak"));
    expect(Print.printAsync.mock.calls[0][0].html).toContain("Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur");
    expect(Print.printAsync.mock.calls[0][0].html).toContain("Menu belum diisi · Paket Hemat Kantor: 1 nasi, 1 lauk, 1 sayur");
  });
});

describe("attention cards", () => {
  const attention = (href: string, kind = "payment") => ({
    items: [{ id: "a-1", kind, priority: 1, at_time: "2026-10-08T05:40:00Z", context: "Bu Sari", href }],
    total: 1, nextCursor: null, timezone: "Asia/Jakarta",
  });

  it("opens its link when the href maps to a Dapur screen", async () => {
    const runtime = runtimeWith(async () => canvasDay());
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue(attention("/seller/customers"));
    renderToday(runtime);
    fireEvent.press(await screen.findByRole("link", { name: /Ada urusan pembayaran/ }));
    expect(router.push).toHaveBeenCalledWith("/pelanggan");
  });

  it("a link card shows a chevron, a plain card does not", async () => {
    const runtime = runtimeWith(async () => canvasDay());
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue({
      items: [
        { id: "a-1", kind: "payment", priority: 1, at_time: "2026-10-08T05:40:00Z", context: "Bu Sari", href: "/seller/customers" },
        { id: "a-2", kind: "support", priority: 1, at_time: "2026-10-08T05:41:00Z", context: "Tanya tagihan", href: "/seller/support?case=c-1" },
      ],
      total: 2, nextCursor: null, timezone: "Asia/Jakarta",
    });
    renderToday(runtime);
    const link = await screen.findByRole("link", { name: /Ada urusan pembayaran/ });
    const chevrons = within(link).UNSAFE_getAllByType(Ionicons);
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].props).toMatchObject({ name: "chevron-forward", size: 18, color: nativeThemes.light.muted });
expect(within(screen.getByTestId("attention-a-2")).UNSAFE_queryAllByType(Ionicons)).toHaveLength(0);
    // Both kinds keep the Card's 10 between title and context.
    for (const id of ["a-1", "a-2"]) {
      expect(StyleSheet.flatten(screen.getByTestId(`attention-body-${id}`).props.style).gap).toBe(10);
    }
  });

  it("stays a plain card when the href has no Dapur screen", async () => {
    const runtime = runtimeWith(async () => canvasDay());
    (runtime.api.sellerAttention as jest.Mock).mockResolvedValue(attention("/seller/support?case=c-1", "support"));
    renderToday(runtime);
    expect(await screen.findByText("Pertanyaan pelanggan menunggu")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Pertanyaan pelanggan menunggu/ })).toBeNull();
    fireEvent.press(screen.getByText("Pertanyaan pelanggan menunggu"));
    expect(router.push).not.toHaveBeenCalled();
  });
});
