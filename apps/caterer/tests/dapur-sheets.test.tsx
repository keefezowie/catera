import fs from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { AccessibilityInfo, Alert, Dimensions, Share, StyleSheet } from "react-native";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { type SellerOperationsState } from "@catera/domain";
import { SheetHeader, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import TabStack from "../app/(tabs)/(index,pelanggan,menu,usaha)/_layout";
import { TodayScreen } from "../src/today/TodayScreen";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { MoveSheet } from "../src/today/MoveSheet";
import { ReplySheet } from "../src/today/ReportScreen";
import { inviteShared, TimScreen } from "../src/business/TimScreen";
import { UsahaScreen } from "../src/business/UsahaScreen";
import NewPackageRoute from "../app/(tabs)/(index,pelanggan,menu,usaha)/paket/baru";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { ImportRowEditor } from "../src/import/RowEditor";
import * as offline from "../src/today/offline";
import { canvasDay, report } from "./fixtures";
import { declared, lastActionSheet, lastConfirm, lastGuard, resetSheets, SheetHost, unsavedGuard, type Opened } from "./sheet-host";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
}));
jest.mock("../src/today/offline", () => ({
  cacheSession: jest.fn(() => 0),
  saveCachedDay: jest.fn(async () => undefined),
  loadCachedDay: jest.fn(async () => null),
}));

// Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const TODAY = "2026-10-08";
const TOMORROW = "2026-10-09";
beforeEach(() => {
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
  jest.clearAllMocks();
  resetSheets();
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Bima", catererId: "k-1" };

type Meal = { status: string; cooking_started_at?: string | null };
/** The canvas day on `date`, every lunch row in `meal`'s state. */
function day(meal: Meal = { status: "scheduled" }, date = TODAY): SellerOperationsState {
  const d = canvasDay();
  d.operationalDate = date;
  d.deliveries = d.deliveries.map((x) => ({ ...x, service_date: date, status: meal.status, meals: [{ meal: "lunch", ...meal }] }) as typeof x);
  return d;
}

/** One day per date for a whole test, as the server answers: the fixture numbers its rows anew on every call. */
let days: Record<string, SellerOperationsState> = {};
const dayOf = (date: string) => (days[date] ??= day(undefined, date));
beforeEach(() => {
  days = {};
});

function runtimeWith(
  overrides: Partial<Record<keyof MobileRuntime["api"], unknown>> = {},
  actor: Record<string, unknown> = owner,
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "sheets", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    sellerOperations: jest.fn(async (_id: string, date: string) => dayOf(date)),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    deliveryAvailability: jest.fn(async () => []),
    command: jest.fn(async () => ({ moved: 4 })),
    usage: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** The Dapur sheets a screen opens, drawn the way their route files draw them. */
function sheetFor({ path: at, params }: Opened) {
  if (at.startsWith("/atur-antaran/"))
    return <ExceptionSheet id={at.split("/")[2]} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={params.date} />;
  if (at.startsWith("/pindah-tanggal/"))
    return <MoveSheet id={at.split("/")[2]} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={params.date} />;
  if (at.startsWith("/balas/")) return <ReplySheet id={at.split("/")[2]} title={params.title} />;
  if (at === "/impor-baris") return <ImportRowEditor n={Number(params.n)} />;
  return null;
}

/** The stop sheet once its day is drawn (it reads the day itself when nothing was parked). */
async function stopSheet() {
  const sheet = await screen.findByTestId("exception-sheet");
  await waitFor(() => expect(within(sheet).queryAllByText(/^(Simpan laporan|Pindah tanggal)$/).length).toBeGreaterThan(0));
  return screen.getByTestId("exception-sheet");
}

/** A screen with its sheets, under the toast. */
function show(runtime: MobileRuntime, ui: React.ReactNode, { dark = false } = {}) {
  if (dark) jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
  return render(
    <ThemeProvider storageKey="sheets.theme">
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <ToastProvider>
          {ui}
          <SheetHost render={sheetFor} />
        </ToastProvider>
      </MobileProvider>
    </ThemeProvider>,
  );
}

const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

describe("confirm sheets in place of dialogs", () => {
  it("Mulai masak asks in a confirm sheet with the existing copy", async () => {
    const alert = jest.spyOn(Alert, "alert");
    const runtime = runtimeWith();
    show(runtime, <TodayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Mulai masak" }));
    const asked = lastConfirm();
    expect(asked).toMatchObject({
      title: "Mulai masak makan siang?",
      message: "Pelanggan melihat status Dimasak.",
      cancelLabel: "Batal",
      confirmLabel: "Mulai",
      icon: "rantang",
    });
    expect(asked.tone).toBeUndefined();
    // Nothing is sent before the answer.
    expect(runtime.api.command).not.toHaveBeenCalled();
    await asked.press("Mulai");
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("delivery.cook", { catererId: "k-1", date: TODAY, meal: "lunch" }, expect.any(String)),
    );
    expect(alert).not.toHaveBeenCalled();
  });

  it("Berangkat antar asks with its own copy, with no number in it", async () => {
    const runtime = runtimeWith({ sellerOperations: jest.fn(async () => day({ status: "preparing", cooking_started_at: "2026-10-08T01:10:00Z" })) });
    show(runtime, <TodayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Berangkat antar · 34 porsi" }));
    expect(lastConfirm()).toMatchObject({
      title: "Berangkat antar sekarang?",
      message: "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.",
      labels: ["Batal", "Berangkat"],
      icon: "rantang",
    });
    await lastConfirm().press("Berangkat");
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith("delivery.depart", { catererId: "k-1", date: TODAY, meal: "lunch" }, expect.any(String)),
    );
  });

  it("cancelling the confirm sends nothing", async () => {
    const runtime = runtimeWith();
    show(runtime, <TodayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Mulai masak" }));
    await lastConfirm().press("Batal");
    await act(async () => undefined);
    expect(runtime.api.command).not.toHaveBeenCalled();
    // The button is usable again and asks again.
    const button = screen.getByRole("button", { name: "Mulai masak" });
    expect(button.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(button);
    expect(require("./sheet-host").confirm).toHaveBeenCalledTimes(2);
  });

  it("asks once for a quick double tap", async () => {
    show(runtimeWith(), <TodayScreen />);
    const button = await screen.findByRole("button", { name: "Mulai masak" });
    fireEvent.press(button);
    fireEvent.press(button);
    expect(require("./sheet-host").confirm).toHaveBeenCalledTimes(1);
  });

  it("a late tap that changed nothing keeps its caption: no buzz, no count", async () => {
    const runtime = runtimeWith({ command: jest.fn(async () => ({ moved: 0 })) });
    show(runtime, <TodayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Mulai masak" }));
    await lastConfirm().press("Mulai");
    expect(await screen.findByText("Sudah ditandai dimasak.")).toBeTruthy();
    expect(require("expo-haptics").notificationAsync).not.toHaveBeenCalled();
    expect(runtime.api.usage).not.toHaveBeenCalledWith("cook_started", "dapur");
  });
});

describe("stop exceptions", () => {
  it("stop exceptions open as a form sheet and keep their names", async () => {
    // The tab's stack declares the sheet with the form detents.
    render(
      <MobileProvider runtime={runtimeWith()} linkMapper={(h) => h}>
        <TabStack segment="(index)" />
      </MobileProvider>,
    );
    await waitFor(() => expect(declared["atur-antaran/[id]"]).toBeDefined());
    expect(declared["atur-antaran/[id]"]).toMatchObject({
      presentation: "formSheet",
      sheetAllowedDetents: [0.6, 1],
      sheetGrabberVisible: true,
      headerShown: false,
    });
    screen.unmount();

    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const runtime = runtimeWith();
    show(runtime, <TodayScreen />);
    const sari = (await screen.findAllByText("Bu Sari Wulandari"))[0];
    expect(sari).toBeTruthy();
    const id = dayOf(TODAY).deliveries[0].id;
    fireEvent.press(within(screen.getByTestId("stop-1")).getByLabelText("Laporkan masalah atau pindah hari: Bu Sari Wulandari"));
    expect(router.push).toHaveBeenLastCalledWith(`/atur-antaran/${id}?meal=lunch&date=${TODAY}`);
    // The sheet is named for the stop and keeps its two choices and their words.
    const sheet = await stopSheet();
    expect(within(sheet).getByRole("header", { name: "Bu Sari Wulandari" })).toBeTruthy();
    expect(within(sheet).getByText("2 porsi · Makan Siang Rumahan")).toBeTruthy();
    expect(within(sheet).getByText("Gagal diantar")).toBeTruthy();
    expect(within(sheet).getByText("Pindah tanggal")).toBeTruthy();
    expect(within(sheet).getByText(/tidak dibayarkan ke kamu/)).toBeTruthy();
    fireEvent.press(within(sheet).getByText("Simpan laporan"));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(3));
    expect((runtime.api.command as jest.Mock).mock.calls.map((c) => c[1].status)).toEqual(["preparing", "out_for_delivery", "issue"]);
    // Saved: the sheet closes and says so.
    expect(await screen.findByText("Laporan tersimpan")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("exception-sheet")).toBeNull());
    expect(router.back).toHaveBeenCalledTimes(1);
    // The toast is shown once the sheet is on its way out, so it is drawn against Hari ini, not the sheet.
    const saved = announce.mock.calls.findIndex(([message]) => message === "Laporan tersimpan");
    expect(saved).toBeGreaterThanOrEqual(0);
    expect((router.back as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(announce.mock.invocationCallOrder[saved]);
  });

  it("names each … for what it can do: both, report only, or move only on Besok", async () => {
    show(runtimeWith(), <TodayScreen />);
    // Keluarga Hartono's change deadline has passed: report only.
    fireEvent.press(within(await screen.findByTestId("stop-3")).getByLabelText("Laporkan masalah: Keluarga Hartono"));
    let sheet = await stopSheet();
    expect(within(sheet).getByText("Gagal diantar")).toBeTruthy();
    expect(within(sheet).queryByText("Pindah tanggal")).toBeNull();
    act(() => router.back());
    // Besok: only a move, and only where the day can move.
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    fireEvent.press(await within(await screen.findByTestId("stop-1")).findByLabelText("Pindah hari: Bu Sari Wulandari"));
    expect(router.push).toHaveBeenLastCalledWith(expect.stringMatching(new RegExp(`date=${TOMORROW}$`)));
    sheet = await stopSheet();
    expect(within(sheet).queryByText("Gagal diantar")).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Pindah tanggal" })).toBeTruthy();
  });

  it("staff report a stop and start cooking too", async () => {
    const runtime = runtimeWith({}, staff);
    show(runtime, <TodayScreen />);
    fireEvent.press(within(await screen.findByTestId("stop-1")).getByLabelText(/^Laporkan masalah atau pindah hari/));
    expect(await stopSheet()).toBeTruthy();
    act(() => router.back());
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(lastConfirm().title).toBe("Mulai masak makan siang?");
  });

  it("a copy kept from before the connection dropped offers no …", async () => {
    (offline.loadCachedDay as jest.Mock).mockResolvedValue({ savedAt: "2026-10-07T23:12:00.000Z", data: day() });
    const runtime = runtimeWith({
      sellerOperations: jest.fn(async () => {
        throw new TypeError("Network request failed");
      }),
    });
    show(runtime, <TodayScreen />);
    expect(await screen.findByText(/Ini data terakhir/)).toBeTruthy();
    await screen.findByTestId("stop-1");
    expect(screen.queryAllByLabelText(/^(Laporkan masalah|Pindah hari)/)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Mulai masak" })).toBeNull();
  });

  it("asks before dropping a typed reason, and not when nothing was typed", async () => {
    show(runtimeWith(), <MoveSheet id={dayOf(TOMORROW).deliveries[0].id} meal="lunch" date={TOMORROW} />);
    const reason = await screen.findByLabelText("Alasan");
    expect(lastGuard()).toBeNull();
    fireEvent.changeText(reason, "Dapur tutup");
    expect(lastGuard()).toEqual({ noun: "alasan", voice: "kamu", nounEn: "reason" });
    // A move with no day chosen cannot be saved.
    expect(screen.getByRole("button", { name: "Pindah tanggal" }).props.accessibilityState?.disabled).toBe(true);
  });

  it("keeps a typed reason for the same person and stop after an Android swipe closed the sheet", async () => {
    const id = dayOf(TOMORROW).deliveries[0].id;
    const sheetOf = () => <MoveSheet id={id} meal="lunch" date={TOMORROW} />;
    let mounted = show(runtimeWith(), sheetOf());
    fireEvent.changeText(await screen.findByLabelText("Alasan"), "Pelanggan ke luar kota");
    // A swipe closes the sheet before anything can ask: the reason waits for the next opening of this stop.
    mounted.unmount();
    mounted = show(runtimeWith(), sheetOf());
    expect((await screen.findByLabelText("Alasan")).props.value).toBe("Pelanggan ke luar kota");
    expect(lastGuard()).toEqual({ noun: "alasan", voice: "kamu", nounEn: "reason" });
    mounted.unmount();

    // Another person on this phone opens the same stop empty.
    mounted = show(runtimeWith({}, staff), sheetOf());
    expect((await screen.findByLabelText("Alasan")).props.value).toBe("");
    mounted.unmount();

    // "Buang" drops it.
    mounted = show(runtimeWith(), sheetOf());
    await screen.findByLabelText("Alasan");
    const guard = unsavedGuard.mock.calls[unsavedGuard.mock.calls.length - 1][2] as { onDiscard?: () => void };
    expect(guard.onDiscard).toEqual(expect.any(Function));
    act(() => guard.onDiscard!());
    mounted.unmount();
    mounted = show(runtimeWith(), sheetOf());
    expect((await screen.findByLabelText("Alasan")).props.value).toBe("");
  });
});

describe("Laporan reply sheet", () => {
  it("opens over Hari ini from a report card, sends, closes and says Balasan terkirim", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const runtime = runtimeWith({
      request: jest.fn(async (p: string) => (p.startsWith("delivery-issues") ? [report()] : [])),
      command: jest.fn(async () => ({})),
    });
    show(runtime, <TodayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Buka laporan: Nadia Putri" }));
    expect(router.push).toHaveBeenLastCalledWith("/balas/i-1?title=Nadia%20Putri");
    const sheet = await screen.findByTestId("reply-sheet");
    expect(within(sheet).getByRole("header", { name: "Nadia Putri" })).toBeTruthy();
    expect(await within(sheet).findByText("Kamis 8 Okt · Makan siang · Rantang Nusantara")).toBeTruthy();
    expect(within(sheet).getByText("Sudah jam satu, makanan belum datang.")).toBeTruthy();
    fireEvent.changeText(within(sheet).getByLabelText("Balasan untuk pelanggan"), "Maaf, kami antar ulang sekarang.");
    fireEvent.press(within(sheet).getByRole("button", { name: "Balas" }));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "deliveryIssue.respond",
        { id: "i-1", version: 1, body: "Maaf, kami antar ulang sekarang." },
        expect.any(String),
      ),
    );
    expect(await screen.findByText("Balasan terkirim")).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId("reply-sheet")).toBeNull());
    const sent = announce.mock.calls.findIndex(([message]) => message === "Balasan terkirim");
    expect(sent).toBeGreaterThanOrEqual(0);
    expect((router.back as jest.Mock).mock.invocationCallOrder.at(-1)).toBeLessThan(announce.mock.invocationCallOrder[sent]);
  });

  it("keeps a typed reply for the same report and person after the sheet closed without sending", async () => {
    const runtime = runtimeWith({ request: jest.fn(async () => [report()]) });
    const { unmount } = show(runtime, <ReplySheet id="i-1" />);
    expect(await screen.findByLabelText("Balasan untuk pelanggan")).toBeTruthy();
    expect(lastGuard()).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Balasan untuk pelanggan"), "Sebentar lagi sampai.");
    expect(lastGuard()).toEqual({ noun: "balasan", voice: "kamu", nounEn: "reply" });
    // An Android swipe closes the sheet before anything can ask: the reply waits for the next opening.
    unmount();
    show(runtime, <ReplySheet id="i-1" />);
    expect((await screen.findByLabelText("Balasan untuk pelanggan")).props.value).toBe("Sebentar lagi sampai.");
    screen.unmount();
    // Another person on this phone opens the same report empty.
    show(runtimeWith({ request: jest.fn(async () => [report()]) }, staff), <ReplySheet id="i-1" />);
    expect((await screen.findByLabelText("Balasan untuk pelanggan")).props.value).toBe("");
  });
});

describe("Tim", () => {
  it("Tim is a sheet that shares the invite and keeps the code, claiming nothing on Android", async () => {
    render(
      <MobileProvider runtime={runtimeWith()} linkMapper={(h) => h}>
        <TabStack segment="(usaha)" />
      </MobileProvider>,
    );
    await waitFor(() => expect(declared.tim).toBeDefined());
    expect(declared.tim).toMatchObject({ presentation: "formSheet", sheetAllowedDetents: "fitToContents", headerShown: false });
    screen.unmount();

    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const command = jest.fn(async () => ({ id: "i-1", code: "abc123" }));
    show(runtimeWith({ command }), <TimScreen />);
    expect(await screen.findByRole("header", { name: "Undang staf dapur" })).toBeTruthy();
    expect(screen.getByText(/tetap hanya untuk kamu/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Bagikan undangan" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(command.mock.calls[0]).toEqual(["staff.invite", { catererId: "k-1" }, expect.any(String)]);
    expect((share.mock.calls[0][0] as { message: string }).message).toContain("abc123");
    // The code stays on the sheet. Android reports every share as sent, even one backed out of, so this build (Jest
    // compiles the Android branch in) claims nothing about the invite going out.
    expect(await screen.findByText("abc123")).toBeTruthy();
    await act(async () => undefined);
    expect(screen.queryByText("Undangan dibagikan")).toBeNull();
  });

  it("says Undangan dibagikan only where the platform's answer can be trusted", () => {
    // iOS answers sharedAction only for a real share and dismissedAction for a dismissal; Android always answers
    // sharedAction (react-native Share.js), so it never earns the claim.
    expect(inviteShared("sharedAction", "ios")).toBe(true);
    expect(inviteShared("dismissedAction", "ios")).toBe(false);
    expect(inviteShared("sharedAction", "android")).toBe(false);
    expect(inviteShared("dismissedAction", "android")).toBe(false);
  });

  it("says nothing when the share was dismissed, and keeps the code", async () => {
    jest.spyOn(Share, "share").mockResolvedValue({ action: "dismissedAction" });
    show(runtimeWith({ command: jest.fn(async () => ({ code: "zz9" })) }), <TimScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
    expect(await screen.findByText("zz9")).toBeTruthy();
    expect(screen.queryByText("Undangan dibagikan")).toBeNull();
  });

  it("scrolls under its title once it outgrows the screen, so Bagikan undangan stays reachable", async () => {
    jest.spyOn(Share, "share").mockResolvedValue({ action: "dismissedAction" });
    show(runtimeWith({ command: jest.fn(async () => ({ code: "zz9" })) }), <TimScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
    expect(await screen.findByText("zz9")).toBeTruthy();
    type Node = { type: unknown; props: Record<string, unknown>; parent: Node | null };
    const inside = (inner: unknown, outer: unknown) => {
      for (let n = inner as Node | null; n; n = n.parent) if (n === outer) return true;
      return false;
    };
    const sheet = screen.getByTestId("tim-sheet");
    const scrollers = (sheet as unknown as { findAll: (m: (n: Node) => boolean) => Node[] }).findAll(
      (n) => n.type === "RCTScrollView" && !n.props.horizontal,
    );
    expect(scrollers).toHaveLength(1);
    const [scroller] = scrollers;
    expect(inside(screen.getByText("zz9"), scroller)).toBe(true);
    expect(inside(screen.getByRole("button", { name: "Bagikan undangan" }), scroller)).toBe(true);
    expect(inside(screen.getByRole("header", { name: "Undang staf dapur" }), scroller)).toBe(false);
    expect(flat(scroller)).toMatchObject({ flexGrow: 0, flexShrink: 1 });
    expect(scroller.props.nestedScrollEnabled).toBe(true);
    expect(flat(sheet).maxHeight).toBeLessThan(Dimensions.get("window").height);
  });

  it("staff have no Tim", async () => {
    render(
      <MobileProvider runtime={runtimeWith({}, staff)} linkMapper={(h) => h}>
        <TabStack segment="(menu)" />
      </MobileProvider>,
    );
    await waitFor(() => expect(declared["atur-antaran/[id]"]).toBeDefined());
    expect(declared.tim).toBeUndefined();
    expect(declared["balas/[id]"]).toBeDefined();
  });
});

describe("package actions", () => {
  const offers = [
    { id: "p-1", name: "Makan Siang Rumahan", price: 28000, status: "published", image: "" },
    { id: "p-2", name: "Paket Hemat Kantor", price: null, status: "draft", image: "" },
  ];
  /** The live package in full, as Paket baru reads it to fill the copy. */
  const copyable = {
    ...offers[0],
    slug: "rumahan",
    version: 3,
    catererId: "k-1",
    description: "Masakan rumahan harian.",
    days: 20,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: false,
    trialPrice: null,
    trialMax: 0,
    capacity: {},
    tiers: [],
    windows: { lunch: "11.00-13.00" },
    tags: [],
    menus: [{ meal: "lunch", name: "x", description: "", image: "", contentModel: "slots", composition: [{ id: "g-main", categoryId: "main", name: "Lauk", slots: 2 }] }],
  };
  const usaha = () =>
    runtimeWith({
      sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers, datedMenus: [] })),
      request: jest.fn(async () => ({ active: null })),
    });

  it("a package row offers Lihat paket and Salin jadi paket baru", async () => {
    show(usaha(), <UsahaScreen />);
    fireEvent.press(await screen.findByLabelText("Lihat atau salin: Makan Siang Rumahan"));
    const sheet = lastActionSheet();
    expect(sheet.items.map((i) => i.label)).toEqual(["Lihat paket", "Salin jadi paket baru"]);
    expect(sheet.items.some((i) => i.tone === "danger")).toBe(false);
    expect(sheet.context?.title).toBe("Makan Siang Rumahan");
    expect(sheet.context?.lines).toEqual([expect.stringMatching(/^Rp\s?28\.000 · tayang$/)]);
    expect(sheet.closeLabel).toBe("Tutup");
    await sheet.choose("salin");
    expect(router.push).toHaveBeenLastCalledWith("/paket/baru?from=p-1");
    // Nothing is copied yet: Paket baru says so once its prefilled editor opens.
    await act(async () => undefined);
    expect(screen.queryByText("Paket disalin")).toBeNull();

    fireEvent.press(screen.getByLabelText("Lihat atau salin: Paket Hemat Kantor"));
    // A draft with no price yet names only its state: nothing stands in for the missing price.
    expect(lastActionSheet().context?.lines).toEqual(["draf"]);
    await lastActionSheet().choose("lihat");
    expect(router.push).toHaveBeenLastCalledWith("/paket/p-2?title=Paket%20Hemat%20Kantor");
  });

  it("says Paket disalin once the copy opens in the editor, never over a missing or failed copy", async () => {
    const routerModule = require("./sheet-host").routerModule as { useLocalSearchParams: () => Record<string, string> };
    let read!: (value: unknown) => void;
    const sellerOperations = jest.fn(() => new Promise((resolve) => (read = resolve)));
    jest.spyOn(routerModule, "useLocalSearchParams").mockReturnValue({ from: "p-1" });
    show(runtimeWith({ sellerOperations }), <NewPackageRoute />);
    // While the package it copies loads, nothing has been copied.
    await waitFor(() => expect(sellerOperations).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByText("Paket disalin")).toBeNull();
    await act(async () =>
      read({ caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [copyable, offers[1]], datedMenus: [], dishes: [] }),
    );
    expect(await screen.findByText("Paket disalin")).toBeTruthy();
    expect(screen.getAllByText("Paket disalin")).toHaveLength(1);
    screen.unmount();

    // A package that is gone: the editor never opens, so nothing was copied.
    jest.spyOn(routerModule, "useLocalSearchParams").mockReturnValue({ from: "p-gone" });
    show(usaha(), <NewPackageRoute />);
    expect(await screen.findByText("Paket ini tidak ditemukan.")).toBeTruthy();
    await act(async () => undefined);
    expect(screen.queryByText("Paket disalin")).toBeNull();
    screen.unmount();

    // A failed read: the error shows, and no success over it.
    jest.spyOn(routerModule, "useLocalSearchParams").mockReturnValue({ from: "p-1" });
    const failing = jest.fn(async () => Promise.reject(new Error("offline")));
    show(runtimeWith({ sellerOperations: failing }), <NewPackageRoute />);
    await waitFor(() => expect(failing).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryByText("Paket disalin")).toBeNull();
  });

  it("closing the package sheet does nothing", async () => {
    show(usaha(), <UsahaScreen />);
    fireEvent.press(await screen.findByLabelText("Lihat atau salin: Makan Siang Rumahan"));
    await lastActionSheet().choose(null);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByText("Paket disalin")).toBeNull();
  });
});

describe("import row editor", () => {
  const disabled = { ok: false, status: 503, json: async () => ({ error: { code: "IMPORT_ASSISTANT_DISABLED" } }) };
  const importer = () => {
    global.fetch = jest.fn(async () => disabled) as unknown as typeof fetch;
    return runtimeWith({
      sellerImportOptions: jest.fn(async () => ({
        customers: [],
        packages: [{ id: "p-hemat", name: "Paket Hemat Kantor", days: 20, areas: [], meal: "lunch" }],
      })),
    });
  };

  it("the import row editor edits the shared store and returns", async () => {
    show(importer(), <ImportAssistant />);
    fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    // The new row opens in its sheet; a row with errors says what is missing.
    expect(router.push).toHaveBeenLastCalledWith("/impor-baris?n=1");
    const sheet = await screen.findByTestId("import-row-sheet");
    expect(within(sheet).getByText(/Nama belum ada/)).toBeTruthy();
    fireEvent.changeText(within(sheet).getByLabelText("Nama"), "Bu Ani");
    // The list under the sheet reads the same row.
    expect(screen.getByRole("button", { name: "Ubah Bu Ani" })).toBeTruthy();
    fireEvent.press(within(sheet).getByRole("button", { name: "Selesai" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("import-row-sheet")).toBeNull());
    expect(screen.getByText("Bu Ani")).toBeTruthy();
    // Opening it again edits the same row; removing it takes it off the list and returns.
    fireEvent.press(screen.getByRole("button", { name: "Ubah Bu Ani" }));
    fireEvent.press(within(await screen.findByTestId("import-row-sheet")).getByRole("button", { name: "Hapus baris ini" }));
    await waitFor(() => expect(screen.queryByTestId("import-row-sheet")).toBeNull());
    expect(screen.queryByText("Bu Ani")).toBeNull();
  });

  it("waits for the package choices instead of calling a loading row gone", async () => {
    let options!: (value: unknown) => void;
    const pending = new Promise((resolve) => (options = resolve));
    const sellerImportOptions = jest.fn(() => pending);
    global.fetch = jest.fn(async () => disabled) as unknown as typeof fetch;
    show(runtimeWith({ sellerImportOptions }), <ImportAssistant />);
    fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    // The row is on the list; only its package choices have not arrived.
    const sheet = await screen.findByTestId("import-row-sheet");
    expect(within(sheet).queryByText("Baris ini sudah tidak ada.")).toBeNull();
    expect(within(sheet).getByLabelText("Memuat pilihan paket")).toBeTruthy();
    await act(async () =>
      options({ customers: [], packages: [{ id: "p-hemat", name: "Paket Hemat Kantor", days: 20, areas: [], meal: "lunch" }] }),
    );
    expect(await within(screen.getByTestId("import-row-sheet")).findByLabelText("Nama")).toBeTruthy();
    expect(within(screen.getByTestId("import-row-sheet")).getByText("Paket Hemat Kantor")).toBeTruthy();
  });

  it("a row whose package choices could not be read says so and tries again", async () => {
    const sellerImportOptions = jest.fn().mockRejectedValue(new Error("offline"));
    global.fetch = jest.fn(async () => disabled) as unknown as typeof fetch;
    show(runtimeWith({ sellerImportOptions }), <ImportAssistant />);
    fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    fireEvent.press(await screen.findByRole("button", { name: "Isi manual" }));
    const sheet = await screen.findByTestId("import-row-sheet");
    const retry = await within(sheet).findByRole("button", { name: "Coba lagi" });
    expect(within(sheet).queryByText("Baris ini sudah tidak ada.")).toBeNull();
    sellerImportOptions.mockResolvedValue({
      customers: [],
      packages: [{ id: "p-hemat", name: "Paket Hemat Kantor", days: 20, areas: [], meal: "lunch" }],
    });
    fireEvent.press(retry);
    // The choices land and the same sheet becomes the row's editor.
    await waitFor(() => expect(within(screen.getByTestId("import-row-sheet")).getByText("Paket Hemat Kantor")).toBeTruthy());
  });

  it("a row link with no row behind it says so, and its Close never strands the person", async () => {
    const canGoBack = router.canGoBack as jest.Mock;
    try {
      // A cold link: /impor-baris is the only route, so both closes open Impor in its place.
      canGoBack.mockReturnValue(false);
      show(importer(), <ImportRowEditor n={42} />);
      expect(await screen.findByText("Baris ini sudah tidak ada.")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
      expect(router.replace).toHaveBeenLastCalledWith("/impor");
      // The header's Close (iOS) does the same.
      act(() => (screen.UNSAFE_getByType(SheetHeader).props.onClose as () => void)());
      expect(router.replace).toHaveBeenCalledTimes(2);
      expect(router.back).not.toHaveBeenCalled();
      // Opened from Impor: back to it.
      canGoBack.mockReturnValue(true);
      fireEvent.press(screen.getByRole("button", { name: "Tutup" }));
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledTimes(2);
    } finally {
      canGoBack.mockReturnValue(true);
    }
  });
});

describe("appearance", () => {
  it("the stop sheet reads the dark palette", async () => {
    show(runtimeWith(), <ExceptionSheet id={dayOf(TODAY).deliveries[0].id} meal="lunch" date={TODAY} />, { dark: true });
    const sheet = await stopSheet();
    const chosen = within(sheet).getByTestId("failed-option");
    expect(flat(chosen)).toMatchObject({ backgroundColor: nativeThemes.dark.surface, borderColor: nativeThemes.dark.line });
    expect(flat(within(sheet).getByRole("header", { name: "Bu Sari Wulandari" })).color).toBe(nativeThemes.dark.charcoal);
  });

  it("grows with a larger font: no fixed heights and no cut lines in the Dapur sheets", async () => {
    show(runtimeWith(), <ExceptionSheet id={dayOf(TODAY).deliveries[0].id} meal="lunch" date={TODAY} />);
    await stopSheet();
    const texts = screen.UNSAFE_root.findAll((n) => typeof n.type === "string" && n.type === "Text");
    expect(texts.length).toBeGreaterThan(4);
    for (const text of texts) expect(text.props.numberOfLines).toBeUndefined();
    expect(flat(screen.getByTestId("failed-option")).height).toBeUndefined();
    expect(flat(screen.getByRole("button", { name: "Pindah tanggal" })).height).toBeUndefined();
    screen.unmount();
    show(runtimeWith(), <TimScreen />);
    expect(flat(await screen.findByRole("button", { name: "Bagikan undangan" })).height).toBeUndefined();
  });
});

describe("no dialogs and no custom sheet left in Dapur", () => {
  it("no Dapur file imports Alert.alert or the custom Sheet", () => {
    const root = path.join(__dirname, "..");
    const files = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
      );
    const sources = [...files(path.join(root, "src")), ...files(path.join(root, "app"))];
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources) {
      const code = fs.readFileSync(file, "utf8");
      const where = path.relative(root, file);
      expect({ where, alert: /\bAlert\.alert\b|\bAlert\b[^;]*from "react-native"/.test(code) }).toEqual({ where, alert: false });
      const mobileUi = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@catera\/mobile-ui"/g)].flatMap((m) =>
        m[1].split(",").map((s) => s.trim()),
      );
      expect({ where, sheet: mobileUi.includes("Sheet") }).toEqual({ where, sheet: false });
    }
  });
});

describe("every awaiting command button is busy while it waits", () => {
  /** A command that stays pending until the test lets it go. */
  const held = () => {
    let release!: (value: unknown) => void;
    const command = jest.fn(() => new Promise((resolve) => (release = resolve)));
    return { command, release: () => act(async () => release({ code: "abc123" })) };
  };

  it("Balas sends once and is busy until the reply is sent", async () => {
    const { command, release } = held();
    show(runtimeWith({ request: jest.fn(async () => [report()]), command }), <ReplySheet id="i-1" />);
    fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Maaf, kami antar ulang sekarang.");
    fireEvent.press(screen.getByRole("button", { name: "Balas" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Balas" }).props.accessibilityState.busy).toBe(true));
    // The other button on the sheet is not the one waiting, and a second press sends nothing.
    expect(screen.getByRole("button", { name: "Tandai selesai" }).props.accessibilityState.busy).toBeFalsy();
    fireEvent.press(screen.getByRole("button", { name: "Balas" }));
    fireEvent.press(screen.getByRole("button", { name: "Tandai selesai" }));
    expect(command).toHaveBeenCalledTimes(1);
    await release();
  });

  it("Bagikan undangan is busy while the invite is made", async () => {
    jest.spyOn(Share, "share").mockResolvedValue({ action: "dismissedAction" });
    const { command, release } = held();
    show(runtimeWith({ command }), <TimScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Bagikan undangan" }).props.accessibilityState.busy).toBe(true));
    fireEvent.press(screen.getByRole("button", { name: "Bagikan undangan" }));
    expect(command).toHaveBeenCalledTimes(1);
    await release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Bagikan undangan" }).props.accessibilityState.busy).toBeFalsy());
  });

  it("a failed invite is a FormError with a fresh key on every failure", async () => {
    jest.spyOn(Share, "share").mockResolvedValue({ action: "dismissedAction" });
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    show(runtimeWith({ command }), <TimScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Bagikan undangan" }));
    const first = await screen.findByTestId("form-error");
    expect(first).toBeTruthy();
    // The button is back for another try, which fails the same way and is announced again.
    fireEvent.press(screen.getByRole("button", { name: "Bagikan undangan" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect(screen.getAllByTestId("form-error")).toHaveLength(1);
  });
});
