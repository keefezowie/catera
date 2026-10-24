import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { render } from "./render-dapur";
import { Linking, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { kitchenSession, type SellerOperationsState } from "@catera/domain";
import { ToastProvider } from "@catera/mobile-ui";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { MoveSheet } from "../src/today/MoveSheet";
import { ProofSheet, resetProofDrafts } from "../src/today/ProofSheet";
import { TodayScreen } from "../src/today/TodayScreen";
import * as offline from "../src/today/offline";
import * as proof from "../src/today/proof";
import { canvasDay } from "./fixtures";
import { lastConfirm, resetSheets, SheetHost, type Opened } from "./sheet-host";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
/** The phone the screen is drawn on; a test sets it. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
}));
jest.mock("../src/today/proof", () => ({
  shrinkProof: jest.fn(async (photo: { uri: string }) => ({ uri: `small:${photo.uri}` })),
  uploadProof: jest.fn(async (_runtime: unknown, uri: string, id: string) => `k-1/${id}/lunch/${uri.length}.jpg`),
}));
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

// Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const TODAY = "2026-10-08";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
beforeEach(() => {
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
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
  resetProofDrafts();
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  (NetInfo as unknown as { __set(state?: unknown): void }).__set();
});
afterEach(() => jest.useRealTimers());

type MealState = { status: string; cooking_started_at?: string | null; departed_at?: string | null; arrived_at?: string | null };
const cooking: MealState = { status: "preparing", cooking_started_at: "2026-10-08T01:10:00Z" };
const out: MealState = { ...cooking, status: "out_for_delivery", departed_at: "2026-10-08T02:30:00Z" };
const waiting: MealState = { status: "scheduled" };

/** The canvas day (Bu Sari 2, Keluarga Hartono 3, Kost Damai 23, Kantor PT Sinar Rasa 6 porsi) with one meal state per row. */
function dayWith(meals: MealState[]): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = TODAY;
  day.deliveries = day.deliveries.map((d, i) => {
    const m = meals[Math.min(i, meals.length - 1)];
    return { ...d, service_date: TODAY, status: m.status, meals: [{ meal: "lunch", ...m }] } as typeof d;
  });
  return day;
}

type Extras = Partial<Record<"command" | "deliveryAvailability" | "request", jest.Mock>>;
function runtimeFor(build: () => SellerOperationsState, extras: Extras = {}): MobileRuntime {
  // One day for every read, as the server answers (a fresh fixture would give its stops new ids on each read).
  const day = build();
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(async () => day),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: extras.request ?? jest.fn(async () => []),
    command: extras.command ?? jest.fn(async () => ({ moved: 1 })),
    deliveryAvailability: extras.deliveryAvailability ?? jest.fn(async () => []),
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** The sheets Hari ini opens, drawn as their routes draw them. */
const sheets = ({ path, params }: Opened) => {
  const meal = params.meal === "dinner" ? "dinner" : "lunch";
  if (path.startsWith("/atur-antaran/")) return <ExceptionSheet id={path.split("/")[2]} meal={meal} date={params.date} />;
  if (path.startsWith("/pindah-tanggal/")) return <MoveSheet id={path.split("/")[2]} meal={meal} date={params.date} />;
  if (path === "/sampai") return <ProofSheet ids={params.ids.split(",")} meal={meal} date={params.date} />;
  return null;
};

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ToastProvider>
        <TodayScreen />
        <SheetHost render={sheets} />
      </ToastProvider>
    </MobileProvider>,
  );

const pilih = async () => fireEvent.press(await screen.findByRole("button", { name: "Pilih" }));
const stopBox = (name: RegExp) => screen.getByRole("checkbox", { name });
const checked = (name: RegExp) => stopBox(name).props.accessibilityState.checked;
const disabledOf = (label: string) => screen.getByRole("button", { name: label }).props.accessibilityState.disabled;

describe("Pilih: selecting stops in Urutan antar", () => {
  it("selecting stops shows the count and Berangkat (n) and Sampai (n)", async () => {
    // Bu Sari and Keluarga Hartono are cooking; Kost Damai is on its way; Kantor PT Sinar Rasa has not started.
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    expect(screen.getByTestId("order-title").props.children).toEqual("Pilih pengantaran");
    // Nothing selected: both buttons wait, and the bar says why.
    expect(disabledOf("Berangkat (0)")).toBe(true);
    expect(disabledOf("Sampai (0)")).toBe(true);
    expect(screen.getByText("Pilih pengantaran dulu.")).toBeTruthy();
    fireEvent.press(stopBox(/Bu Sari/));
    expect(screen.getByText("1 dipilih")).toBeTruthy();
    expect(disabledOf("Berangkat (1)")).toBe(false);
    expect(disabledOf("Sampai (0)")).toBe(true);
    fireEvent.press(stopBox(/Kost Damai/));
    expect(screen.getByText("2 dipilih")).toBeTruthy();
    expect(disabledOf("Berangkat (1)")).toBe(false);
    expect(disabledOf("Sampai (1)")).toBe(false);
    // Selecting again clears; Selesai leaves the mode with nothing kept.
    fireEvent.press(stopBox(/Bu Sari/));
    expect(checked(/Bu Sari/)).toBe(false);
    fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText("Urutan antar")).toBeTruthy();
  });

  it("Pilih semua ticks the stops an area can still take, and Lepas semua clears them", async () => {
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    fireEvent.press(screen.getByRole("button", { name: /^Pilih semua: Tebet/ }));
    // Three of the four can be picked; the one that has not started cannot.
    expect(screen.getByText("3 dipilih")).toBeTruthy();
    expect(checked(/Kantor PT Sinar Rasa/)).toBe(false);
    expect(screen.getByRole("button", { name: /^Lepas semua: Tebet/ })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: /^Lepas semua: Tebet/ }));
    expect(screen.getByText("Pilih pengantaran")).toBeTruthy();
  });

  it("a stop already departed cannot be selected for Berangkat and says why", async () => {
    const command = jest.fn(async () => ({ moved: 2 }));
    const day = dayWith([cooking, cooking, out, waiting]);
    renderToday(runtimeFor(() => day, { command }));
    await pilih();
    const departed = day.deliveries[2].id;
    // The note under the departed stop and the one under the stop that has not started say why each is limited.
    expect(screen.getByText("Sudah berangkat, tinggal ditandai Sampai.")).toBeTruthy();
    expect(screen.getByText("Belum dimasak.")).toBeTruthy();
    expect(stopBox(/Kantor PT Sinar Rasa/).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: /^Pilih semua: Tebet/ }));
    // Berangkat counts only the two cooking stops, never the one already out.
    fireEvent.press(screen.getByRole("button", { name: "Berangkat (2)" }));
    await waitFor(() => expect(confirmAsked()).toBe(true));
    expect(lastConfirm().title).toBe("Berangkat dengan 2 pengantaran?");
    await lastConfirm().press("Berangkat");
    await waitFor(() => expect(command).toHaveBeenCalledWith("delivery.depart", expect.anything(), expect.any(String)));
    const payload = (command.mock.calls[0] as unknown[])[1] as { fulfillmentIds: string[] };
    expect(payload).toMatchObject({ catererId: "k-1", date: TODAY, meal: "lunch" });
    expect([...payload.fulfillmentIds].sort()).toEqual([day.deliveries[0].id, day.deliveries[1].id].sort());
    expect(payload.fulfillmentIds).not.toContain(departed);
  });

  it("the footer reads Berangkat semua sisa after a first round", async () => {
    const day = dayWith([cooking, cooking, out, out]);
    renderToday(runtimeFor(() => day));
    const left = kitchenSession(day, "lunch", new Date())!.remaining.portions;
    expect(left).toBe(5);
    expect(await screen.findByRole("button", { name: `Berangkat semua sisa · ${left} porsi` })).toBeTruthy();
    // Before anyone has left, the footer keeps its first wording.
    renderToday(runtimeFor(() => dayWith([cooking])));
    expect(await screen.findByRole("button", { name: /^Berangkat antar · 34 porsi$/ })).toBeTruthy();
  });
});

/** Whether a confirm question has been asked since the last reset. */
function confirmAsked() {
  try {
    lastConfirm();
    return true;
  } catch {
    return false;
  }
}

describe("Sampai (n): the proof-photo sheet", () => {
  const shot = (uri: string) => (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri, width: 3000, height: 4000 }] });
  const sheet = () => within(screen.getByTestId("exception-sheet"));
  const openProof = async (command: jest.Mock) => {
    const day = dayWith([out, out, cooking, waiting]);
    renderToday(runtimeFor(() => day, { command }));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(stopBox(/Keluarga Hartono/));
    fireEvent.press(screen.getByRole("button", { name: "Sampai (2)" }));
    await screen.findByText("Foto bukti sampai");
    return day;
  };

  it("Sampai (n) stays disabled until every selected stop has a photo", async () => {
    const command = jest.fn(async () => ({ moved: 2 }));
    const day = await openProof(command);
    expect(router.push).toHaveBeenLastCalledWith(expect.stringMatching(/^\/sampai\?meal=lunch&date=2026-10-08&ids=/));
    // Two tiles, each marked as missing, any order; the button waits and says why.
    expect(sheet().getAllByText("Belum ada foto")).toHaveLength(2);
    expect(sheet().getByRole("button", { name: "Sampai (2)" }).props.accessibilityState.disabled).toBe(true);
    expect(sheet().getByTestId("proof-reason").props.children).toBe("Ambil foto untuk 2 alamat lagi.");
    // The second stop first, then the first.
    shot("file:///hartono.jpg");
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Keluarga Hartono/));
    await act(async () => undefined);
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(1));
    expect(sheet().getByRole("button", { name: "Sampai (2)" }).props.accessibilityState.disabled).toBe(true);
    expect(sheet().getByTestId("proof-reason").props.children).toBe("Ambil foto untuk 1 alamat lagi.");
    shot("file:///sari.jpg");
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Bu Sari/));
    await act(async () => undefined);
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(2));
    expect(sheet().getByRole("button", { name: "Sampai (2)" }).props.accessibilityState.disabled).toBe(false);
    expect(command).not.toHaveBeenCalled();
    fireEvent.press(sheet().getByRole("button", { name: "Sampai (2)" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("delivery.arrive", expect.anything(), expect.any(String)));
    const sent = (command.mock.calls[0] as unknown[])[1] as { fulfillmentIds: string[]; photos: Record<string, string> };
    expect(sent.fulfillmentIds.sort()).toEqual([day.deliveries[0].id, day.deliveries[1].id].sort());
    expect(Object.keys(sent.photos).sort()).toEqual(sent.fulfillmentIds.slice().sort());
    expect(proof.shrinkProof).toHaveBeenCalledTimes(2);
    // The photos were sent first, one per stop, for the stops' own ids.
    expect((proof.uploadProof as jest.Mock).mock.calls.map((c) => c[2]).sort()).toEqual(sent.fulfillmentIds.slice().sort());
  });

  it("a failed photo upload keeps the other photos and shows FormError", async () => {
    const command = jest.fn(async () => ({ moved: 2 }));
    const day = await openProof(command);
    const hartono = day.deliveries[1].id;
    shot("file:///sari.jpg");
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Bu Sari/));
    await act(async () => undefined);
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(1));
    shot("file:///hartono.jpg");
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Keluarga Hartono/));
    await act(async () => undefined);
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(2));
    (proof.uploadProof as jest.Mock).mockImplementation(async (_r: unknown, uri: string, id: string) => {
      if (id === hartono) throw new Error("UPLOAD_UNAVAILABLE");
      return `k-1/${id}/lunch/ok.jpg`;
    });
    fireEvent.press(sheet().getByRole("button", { name: "Sampai (2)" }));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByText(/Foto Keluarga Hartono belum terkirim\. Foto lain tetap tersimpan\./)).toBeTruthy();
    // The tile that failed says so; the other tile and every photo are kept, and nothing was marked arrived.
    expect(sheet().getByTestId(`proof-state-${hartono}`).props.children).toBe("Foto belum terkirim");
    expect(sheet().getAllByText("Foto siap")).toHaveLength(1);
    expect(sheet().getByTestId(`proof-photo-${hartono}`)).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    // Coba lagi sends only the photo that did not go, then marks both.
    (proof.uploadProof as jest.Mock).mockClear();
    (proof.uploadProof as jest.Mock).mockImplementation(async (_r: unknown, _u: string, id: string) => `k-1/${id}/lunch/ok.jpg`);
    fireEvent.press(within(error).getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(command).toHaveBeenCalledWith("delivery.arrive", expect.anything(), expect.any(String)));
    expect((proof.uploadProof as jest.Mock).mock.calls.map((c) => c[2])).toEqual([hartono]);
  });
});

describe("Sampai (n): camera permission and kept photos", () => {
  const permission = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
  const shot = (uri: string) => (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri, width: 3000, height: 4000 }] });
  const sheet = () => within(screen.getByTestId("exception-sheet"));
  const day = dayWith([out, out, cooking, waiting]);
  const open = async () => {
    renderToday(runtimeFor(() => day));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(stopBox(/Keluarga Hartono/));
    fireEvent.press(screen.getByRole("button", { name: "Sampai (2)" }));
    await screen.findByText("Foto bukti sampai");
  };

  it("a denied camera that cannot be asked again offers Buka Pengaturan and no send retry", async () => {
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    permission.mockResolvedValueOnce({ granted: false, canAskAgain: false });
    await open();
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Bu Sari/));
    const error = await screen.findByTestId("form-error");
    expect(within(error).queryByRole("button", { name: "Coba lagi" })).toBeNull();
    fireEvent.press(sheet().getByRole("button", { name: "Buka Pengaturan" }));
    expect(settings).toHaveBeenCalled();
  });

  it("Coba lagi after a camera error opens the camera again, not the send", async () => {
    permission.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    await open();
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Bu Sari/));
    const error = await screen.findByTestId("form-error");
    expect(within(error).getByText("Izinkan kamera supaya bisa memotret bukti.")).toBeTruthy();
    expect(sheet().queryByRole("button", { name: "Buka Pengaturan" })).toBeNull();
    shot("file:///sari.jpg");
    fireEvent.press(within(error).getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(1));
    expect(screen.queryByTestId("form-error")).toBeNull();
  });

  it("photos not yet sent come back when the sheet is reopened", async () => {
    await open();
    shot("file:///sari.jpg");
    fireEvent.press(sheet().getByLabelText(/^Ambil foto: Bu Sari/));
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(1));
    screen.unmount();
    resetSheets();
    await open();
    expect(sheet().getAllByText("Foto siap")).toHaveLength(1);
  });
  it("kept photos are cleared once they are sent", async () => {
    await open();
    for (const [who, uri] of [["Bu Sari", "sari"], ["Keluarga Hartono", "hartono"]]) {
      shot(`file:///${uri}.jpg`);
      fireEvent.press(sheet().getByLabelText(new RegExp(`^Ambil foto: ${who}`)));
      await act(async () => undefined);
    }
    await waitFor(() => expect(sheet().getAllByText("Foto siap")).toHaveLength(2));
    fireEvent.press(sheet().getByRole("button", { name: "Sampai (2)" }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    screen.unmount();
    resetSheets();
    await open();
    expect(sheet().getAllByText("Belum ada foto")).toHaveLength(2);
  });
});

describe("Pindah tanggal: the calendar", () => {
  const availability = jest.fn(async () => [
    { date: "2026-10-12", available: true, reason: null, remaining: 5 },
    { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    { date: "2026-10-14", available: false, reason: "INVALID_DATE", remaining: 0 },
  ]);
  const openMove = async (command = jest.fn(async () => ({}))) => {
    const day = dayWith([waiting]);
    const runtime = runtimeFor(() => day, { command, deliveryAvailability: availability });
    renderToday(runtime);
    fireEvent.press(await within(await screen.findByTestId("stop-1")).findByLabelText(/^Laporkan masalah atau pindah tanggal/));
    fireEvent.press(await screen.findByRole("button", { name: "Pindah tanggal" }));
    await screen.findByTestId("calendar-grid");
    return { day, command, runtime };
  };

  it("Pindah tanggal uses the calendar", async () => {
    const { day, command, runtime } = await openMove();
    // The stop's sheet gave way to the calendar; the days come from the availability read for this stop.
    expect(runtime.api.deliveryAvailability).toHaveBeenCalledWith(day.deliveries[0].id, TODAY, "2026-12-07");
    expect(screen.queryByLabelText("Tanggal baru (TTTT-BB-HH)")).toBeNull();
    expect(screen.getByTestId("calendar-day-2026-10-08").props.accessibilityLabel).toMatch(/hari pengantaran sekarang/);
    // A full day reads why when tapped, and cannot be chosen; the move waits for a day and a reason.
    fireEvent.press(screen.getByTestId("calendar-day-2026-10-13"));
    expect(within(screen.getByTestId("calendar-caption")).getByText(/Penuh/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("calendar-day-2026-10-14"));
    expect(within(screen.getByTestId("calendar-caption")).getByText(/Dapur libur/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("calendar-day-2026-10-12"));
    const move = () => screen.getByRole("button", { name: "Pindah ke Senin 12 Okt" });
    // "Pindah ke …" is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Pindah ke Senin 12 Okt" })).toBeTruthy();
    expect(move().props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Alasan"), "Dapur tutup sehari");
    expect(move().props.accessibilityState.disabled).toBe(false);
    fireEvent.press(move());
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "customer.deliveryChange",
        { catererId: "k-1", id: day.deliveries[0].id, version: 3, date: "2026-10-12", reason: "Dapur tutup sehari" },
        expect.any(String),
      ),
    );
    expect(await screen.findByText("Tanggal dipindah")).toBeTruthy();
    expect(router.back).toHaveBeenCalled();
  });

  it("the calendar is a root-stack sheet: the stop's tab sheet closes, then the root route opens", async () => {
    const runtime = runtimeFor(() => dayWith([waiting]), { deliveryAvailability: availability });
    renderToday(runtime);
    fireEvent.press(await within(await screen.findByTestId("stop-1")).findByLabelText(/^Laporkan masalah atau pindah tanggal/));
    (router.back as jest.Mock).mockClear();
    (router.push as jest.Mock).mockClear();
    fireEvent.press(await screen.findByRole("button", { name: "Pindah tanggal" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    // Unmounting the sheet is not enough: the root route opens only once the tab stack reports the native dismissal
    // ended (the host's `back` reports it a tick later, as `onFinishTransitioning` would).
    expect(router.push).not.toHaveBeenCalled();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/pindah-tanggal/")));
    expect((router.back as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((router.push as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("names the minimum reason before the move can be sent", async () => {
    await openMove();
    expect(screen.getByText("Minimal 5 karakter.")).toBeTruthy();
    expect(screen.queryByText(/Dibaca pelanggan/)).toBeNull();
  });

  it("the consequence line says only customers with the app are told", async () => {
    await openMove();
    expect(screen.getByTestId("calendar-note").props.children).toBe("Pelanggan yang memakai aplikasi diberi tahu.");
    expect(screen.queryByText("Pelanggan diberi tahu.")).toBeNull();
  });
});

describe("the offline copy", () => {
  it("the offline state shows the banner", async () => {
    (offline.loadCachedDay as jest.Mock).mockResolvedValue({ savedAt: "2026-10-07T23:12:00.000Z", data: dayWith([cooking]) });
    (NetInfo as unknown as { __set(state?: unknown): void }).__set({ isConnected: false, isInternetReachable: false });
    const runtime = runtimeFor(() => dayWith([cooking]));
    (runtime.api.sellerOperations as jest.Mock).mockRejectedValue(new TypeError("Network request failed"));
    renderToday(runtime);
    const banner = await screen.findByTestId("connection-banner");
    expect(within(banner).getByText("Tidak ada koneksi")).toBeTruthy();
    // The banner follows NetInfo; the cached day (and so its time) arrives one async read later, so wait for it.
    expect(await within(banner).findByText(/^Menampilkan data terakhir, \d\d\.\d\d$/)).toBeTruthy();
    expect(within(banner).getByRole("button", { name: "Coba lagi" })).toBeTruthy();
    // The old attention card is gone: no loose "Terakhir diperbarui" caption beside the banner.
    expect(screen.queryByText(/Terakhir diperbarui/)).toBeNull();
    // The kept copy can be read but not acted on.
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Berangkat/ })).toBeNull();
  });

  it("an online phone shows no banner", async () => {
    renderToday(runtimeFor(() => dayWith([cooking])));
    await screen.findByTestId("session-count");
    await act(async () => undefined);
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });
});

describe("every awaiting command button is busy while it waits", () => {
  /** A command that stays pending until the test lets it go. */
  const held = () => {
    let release!: (value: unknown) => void;
    const command = jest.fn(() => new Promise((resolve) => (release = resolve)));
    return { command, release: () => act(async () => release({ moved: 1 })) };
  };
  const busyOf = (name: string | RegExp) => screen.getByRole("button", { name }).props.accessibilityState.busy;

  it("Mulai masak", async () => {
    const { command, release } = held();
    renderToday(runtimeFor(() => dayWith([waiting]), { command }));
    fireEvent.press(await screen.findByRole("button", { name: "Mulai masak" }));
    await lastConfirmReady();
    await lastConfirm().press("Mulai");
    await waitFor(() => expect(busyOf("Mulai masak")).toBe(true));
    // A second press while it waits sends nothing.
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(command).toHaveBeenCalledTimes(1);
    await release();
    await waitFor(() => expect(busyOf("Mulai masak")).toBe(false));
  });

  it("Berangkat (n)", async () => {
    const { command, release } = held();
    renderToday(runtimeFor(() => dayWith([cooking, out]), { command }));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(screen.getByRole("button", { name: "Berangkat (1)" }));
    await lastConfirmReady();
    await lastConfirm().press("Berangkat");
    await waitFor(() => expect(busyOf("Berangkat (1)")).toBe(true));
    expect(command).toHaveBeenCalledTimes(1);
    await release();
  });

  it("a failed Berangkat (n) is an error toast with Coba lagi that sends again without asking", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderToday(runtimeFor(() => dayWith([cooking, out]), { command }));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(screen.getByRole("button", { name: "Berangkat (1)" }));
    await lastConfirmReady();
    await lastConfirm().press("Berangkat");
    expect(await screen.findByLabelText("Coba lagi")).toBeTruthy();
    expect(screen.queryByTestId("form-error")).toBeNull();
    fireEvent.press(screen.getByLabelText("Coba lagi"));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
  });

  it("the retry sends the stops that failed, not the selection at retry time, and asks nothing", async () => {
    const day = dayWith([cooking, cooking, out, waiting]);
    const command = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }))
      .mockResolvedValue({ moved: 1 });
    renderToday(runtimeFor(() => day, { command }));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(screen.getByRole("button", { name: "Berangkat (1)" }));
    await lastConfirmReady();
    await lastConfirm().press("Berangkat");
    const retry = await screen.findByLabelText("Coba lagi");
    // The selection changes before the retry: Bu Sari is cleared and Keluarga Hartono is picked.
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(stopBox(/Keluarga Hartono/));
    const asked = (require("./sheet-host").confirm as jest.Mock).mock.calls.length;
    fireEvent.press(retry);
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    const ids = (command.mock.calls[1] as unknown[])[1] as { fulfillmentIds: string[] };
    expect(ids.fulfillmentIds).toEqual([day.deliveries[0].id]);
    expect((require("./sheet-host").confirm as jest.Mock).mock.calls.length).toBe(asked);
  });

  it("the selection title is a polite live region", async () => {
    renderToday(runtimeFor(() => dayWith([cooking, out])));
    await pilih();
    expect(screen.getByTestId("order-live").props.accessibilityLiveRegion).toBe("polite");
  });

  it("Tandai gagal diantar", async () => {
    const { command, release } = held();
    renderToday(runtimeFor(() => dayWith([cooking]), { command }));
    fireEvent.press(await within(await screen.findByTestId("stop-1")).findByLabelText(/^Laporkan masalah/));
    fireEvent.press(await screen.findByRole("button", { name: "Tandai gagal diantar" }));
    await waitFor(() => expect(busyOf("Tandai gagal diantar")).toBe(true));
    await release();
  });
});

async function lastConfirmReady() {
  await waitFor(() => expect(confirmAsked()).toBe(true));
}

describe("narrow width and large text (360dp, font scale 1.3)", () => {
  const phone = (width: number, fontScale: number) => {
    mockWindow = { width, height: 760, scale: 3, fontScale };
  };
  const flat = (node: { props: { style?: unknown } }) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));

  async function openProof() {
    const day = dayWith([out, out, cooking, waiting]);
    renderToday(runtimeFor(() => day));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(stopBox(/Keluarga Hartono/));
    fireEvent.press(screen.getByRole("button", { name: "Sampai (2)" }));
    await screen.findByText("Foto bukti sampai");
    return day;
  }

  it("the proof tile stacks its camera button under the names so no word is split", async () => {
    phone(360, 1.3);
    const day = await openProof();
    const tile = screen.getByTestId(`proof-tile-${day.deliveries[0].id}`);
    expect(flat(tile).flexDirection).toBe("column");
  });

  it.each([[360, 1.15], [360, 1], [320, 1]])("the proof tile stacks at %idp, font scale %f", async (w, f) => {
    phone(w, f);
    const day = await openProof();
    expect(flat(screen.getByTestId(`proof-tile-${day.deliveries[0].id}`)).flexDirection).toBe("column");
  });

  it("the proof tile is a row on a wide phone at the default text size", async () => {
    phone(411, 1);
    const day = await openProof();
    expect(flat(screen.getByTestId(`proof-tile-${day.deliveries[0].id}`)).flexDirection).toBe("row");
  });

  /** The proof sheet for 1 or 4 stops that are all on their way (a 4 stop run needs no cooking row to be selectable). */
  async function openProofOf(count: 1 | 4) {
    const day = dayWith([out, out, out, out]);
    renderToday(runtimeFor(() => day));
    await pilih();
    const names = [/Bu Sari/, /Keluarga Hartono/, /Kost Damai/, /Kantor PT Sinar Rasa/].slice(0, count);
    for (const name of names) fireEvent.press(stopBox(name));
    fireEvent.press(screen.getByRole("button", { name: `Sampai (${count})` }));
    await screen.findByText("Foto bukti sampai");
    return day;
  }
  const shotOf = (uri: string) =>
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri, width: 3000, height: 4000 }] });

  it.each([1, 4] as const)("the proof sheet draws %i stop(s) as 72 rows with a 56 thumb, radius 8, in one card", async (count) => {
    phone(411, 1);
    const day = await openProofOf(count);
    const list = within(screen.getByTestId("exception-sheet")).getByTestId("list-card");
    const tiles = within(list).getAllByTestId(/^proof-tile-/);
    // One sage card with no clip: the photo is never inside an overflow-hidden rounded ancestor.
    expect(flat(list).backgroundColor).toBe(nativeThemes.light.sage);
    expect(flat(list).overflow).not.toBe("hidden");
    expect(tiles).toHaveLength(count);
    for (const d of day.deliveries.slice(0, count)) {
      expect(flat(screen.getByTestId(`proof-tile-${d.id}`)).minHeight).toBe(72);
      // No photo yet: the dashed not-set tile, and the words say so.
      const thumb = screen.getByTestId(`proof-thumb-${d.id}-not-set`);
      expect(flat(thumb)).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
      // The missing proof photo shows the camera, not the dish tile's utensils.
      expect(thumb.findAll((n) => n.props.name === "camera-outline").length).toBeGreaterThan(0);
      expect(thumb.findAll((n) => n.props.name === "restaurant-outline")).toHaveLength(0);
      // The camera action is a text button with a 48 target.
      expect(flat(screen.getByLabelText(new RegExp(`^Ambil foto: ${d.customer.name}`)))).toMatchObject({ minHeight: 48 });
      expect(screen.queryByTestId(`proof-photo-${d.id}`)).toBeNull();
      expect(screen.getByTestId(`proof-state-${d.id}`).props.children).toBe("Belum ada foto");
    }
  });

  it("a photo that was taken keeps its own 56 radius and has no clipping ancestor, so it can load late on Android", async () => {
    phone(411, 1);
    const day = await openProofOf(1);
    const id = day.deliveries[0].id;
    shotOf("file:///sari.jpg");
    fireEvent.press(screen.getByLabelText(/^Ambil foto: Bu Sari/));
    await act(async () => undefined);
    const photo = await screen.findByTestId(`proof-photo-${id}`);
    expect(flat(photo)).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
    expect(screen.queryByTestId(`proof-thumb-${id}-not-set`)).toBeNull();
    expect(screen.getByTestId(`proof-state-${id}`).props.children).toBe("Foto siap");
    expect(screen.getByLabelText(/^Ganti foto: Bu Sari/)).toBeTruthy();
    // Up to the list, nothing around the photo clips it (expo-image can stay blank inside an overflow-hidden rounded view).
    for (let node = photo.parent; node && node.props?.testID !== "list-card"; node = node.parent) {
      expect(flat(node).overflow).not.toBe("hidden");
    }
    expect(flat(within(screen.getByTestId("exception-sheet")).getByTestId("list-card")).overflow).not.toBe("hidden");
  });

  it("pins Sampai (n) and the reason to the sheet's foot, and the reason's line keeps its room once the photos are in", async () => {
    phone(411, 1);
    await openProofOf(1);
    const footer = () => within(screen.getByTestId("sheet-footer"));
    const body = () => within(screen.getByTestId("sheet-body"));
    expect(footer().getByRole("button", { name: "Sampai (1)" }).props.accessibilityState.disabled).toBe(true);
    expect(footer().getByTestId("proof-reason").props.children).toBe("Ambil foto untuk 1 alamat lagi.");
    expect(body().queryByRole("button", { name: "Sampai (1)" })).toBeNull();
    expect(body().queryByTestId("proof-reason")).toBeNull();
    const room = flat(footer().getByTestId("proof-reason-slot")).minHeight;
    expect(room).toBe(18);
    shotOf("file:///sari.jpg");
    fireEvent.press(screen.getByLabelText(/^Ambil foto: Bu Sari/));
    await act(async () => undefined);
    await waitFor(() => expect(footer().getByRole("button", { name: "Sampai (1)" }).props.accessibilityState.disabled).toBe(false));
    expect(footer().queryByTestId("proof-reason")).toBeNull();
    // The line's slot is still there, still 18 tall, so the footer does not shrink under the thumb.
    expect(flat(footer().getByTestId("proof-reason-slot")).minHeight).toBe(18);
  });

  it("the Berangkat and Sampai buttons stack so Berangkat (n) stays on one line", async () => {
    phone(360, 1.3);
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    expect(flat(screen.getByTestId("selection-actions")).flexDirection).toBe("column");
  });

  it.each([[360, 1.15], [411, 1.3], [320, 1]])("the buttons stack at %idp, font scale %f", async (w, f) => {
    phone(w, f);
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    expect(flat(screen.getByTestId("selection-actions")).flexDirection).toBe("column");
  });

  it.each([[360, 1], [411, 1.2]])("the buttons share a row at %idp, font scale %f", async (w, f) => {
    phone(w, f);
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    expect(flat(screen.getByTestId("selection-actions")).flexDirection).toBe("row");
  });
});

describe("Pilih on the Dapur scale", () => {
  const box = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
  const day = () => dayWith([cooking, cooking, out, waiting]);

  it("leaves the run's heading as a live title with a 48 Selesai, and opens each stop's row as a 64 checkbox", async () => {
    renderToday(runtimeFor(day));
    await pilih();
    expect(screen.getByTestId("order-live").props.accessibilityLiveRegion).toBe("polite");
    expect(box(screen.getByRole("button", { name: "Selesai" })).minHeight).toBe(48);
    // The check circle is 24 and the row is 64, like every stop of the run.
    const row = screen.getByTestId("stop-1");
    expect(box(row).minHeight).toBe(64);
    expect(box(within(row).getByTestId("stop-1-circle"))).toMatchObject({ width: 24, height: 24 });
    // Every stop is listed while picking, with no "Lihat n alamat lainnya".
    expect(screen.queryByText(/alamat lainnya/)).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    // The area header's action is a 48 target too.
    for (const action of screen.getAllByRole("button", { name: /^Pilih semua: / })) expect(box(action).minHeight).toBe(48);
  });

  it("keeps the bar one height with 0, 1 and n selected: the caption line holds its room", async () => {
    renderToday(runtimeFor(day));
    await pilih();
    const slot = () => box(screen.getByTestId("selection-caption"));
    const none = slot();
    expect(screen.getByText("Pilih pengantaran dulu.")).toBeTruthy();
    fireEvent.press(stopBox(/Bu Sari/));
    expect(screen.queryByText("Pilih pengantaran dulu.")).toBeNull();
    expect(slot()).toEqual(none);
    fireEvent.press(stopBox(/Kost Damai/));
    expect(slot()).toEqual(none);
    expect(none.minHeight).toBe(18);
    // Both buttons are the Dapur 50, whatever is selected.
    for (const name of [/^Berangkat \(/, /^Sampai \(/]) expect(box(screen.getByRole("button", { name })).minHeight).toBe(50);
  });

  it("stacks the bar's buttons below 340 effective width and keeps their labels whole", async () => {
    mockWindow = { width: 360, height: 760, scale: 3, fontScale: 1.3 };
    renderToday(runtimeFor(day));
    await pilih();
    expect(box(screen.getByTestId("selection-actions")).flexDirection).toBe("column");
    fireEvent.press(stopBox(/Bu Sari/));
    expect(screen.getByRole("button", { name: "Berangkat (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sampai (0)" })).toBeTruthy();
  });
});

describe("residual layout: targets inside their parents, one-line status and meta", () => {
  const sheetFlat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};
  /** Android delivers a touch only inside every ancestor's bounds: no box from the target up to `top` may be pulled out by a negative margin. */
  function expectInside(target: { parent: unknown }, top: string) {
    let node = target as { props?: { testID?: string; style?: unknown }; parent: unknown } | null;
    const seen: string[] = [];
    while (node && node.props?.testID !== top) {
      const style = node.props?.style ? sheetFlat(node as { props: { style?: unknown } }) : {};
      for (const side of ["margin", "marginLeft", "marginRight", "marginTop", "marginBottom", "marginHorizontal", "marginVertical"]) {
        const value = (style as Record<string, unknown>)[side];
        if (typeof value === "number" && value < 0) seen.push(`${side} ${value}`);
      }
      node = node.parent as typeof node;
    }
    expect(node).not.toBeNull();
    expect(seen).toEqual([]);
  }

  it("Pilih, after departure, is a 48 x 48 target whose label ends on the card edge and which no negative margin pulls out of its parents", async () => {
    renderToday(runtimeFor(() => dayWith([cooking, out])));
    const pilihButton = await screen.findByRole("button", { name: "Pilih" });
    expect(sheetFlat(pilihButton)).toMatchObject({ minHeight: 48, minWidth: 48, paddingRight: 0, alignItems: "flex-end" });
    expectInside(pilihButton, "delivery-order");
    // The header row holds the whole 48: a 26 row would clip the target's top and bottom.
    const header = within(screen.getByTestId("delivery-order")).getByTestId("section-header");
    expect(sheetFlat(header).minHeight).toBeGreaterThanOrEqual(48);
  });

  it("Urutan antar keeps its 48 header before anything can be picked, so Pilih arriving shifts nothing", async () => {
    renderToday(runtimeFor(() => dayWith([waiting])));
    await screen.findByText("Urutan antar");
    expect(screen.queryByRole("button", { name: "Pilih" })).toBeNull();
    const header = within(screen.getByTestId("delivery-order")).getByTestId("section-header");
    expect(sheetFlat(header).minHeight).toBe(48);
  });

  it("Selesai and Pilih semua are inside their parents too, and the picking heading holds 48", async () => {
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    for (const name of ["Selesai", /^Pilih semua: Tebet/]) {
      const action = screen.getByRole("button", { name });
      expect(sheetFlat(action)).toMatchObject({ minHeight: 48, minWidth: 48, paddingRight: 0 });
      expectInside(action, "delivery-order");
    }
    let row = screen.getByTestId("order-title") as { props: { style?: unknown }; parent: unknown } | null;
    while (row && sheetFlat(row).minHeight === undefined) row = row.parent as typeof row;
    expect(sheetFlat(row!).minHeight).toBe(48);
  });

  it.each([[412, 1], [360, 1.3]])("a stop in Pilih mode shows its status on one line at %idp, font scale %f", async (width, fontScale) => {
    mockWindow = { width, height: 760, scale: 3, fontScale };
    renderToday(runtimeFor(() => dayWith([cooking, cooking, out, waiting])));
    await pilih();
    expect(screen.getByText("Sudah berangkat, tinggal ditandai Sampai.").props.numberOfLines).toBe(1);
    expect(screen.getByText("Belum dimasak.").props.numberOfLines).toBe(1);
  });

  it("a proof row's meta is one line, so the row holds its 72", async () => {
    mockWindow = { width: 412, height: 860, scale: 3, fontScale: 1 };
    const day = dayWith([out, out, out, out]);
    renderToday(runtimeFor(() => day));
    await pilih();
    fireEvent.press(stopBox(/Bu Sari/));
    fireEvent.press(screen.getByRole("button", { name: "Sampai (1)" }));
    await screen.findByText("Foto bukti sampai");
    const state = screen.getByTestId(`proof-state-${day.deliveries[0].id}`);
    let meta = state.parent as { props: { numberOfLines?: number }; parent: unknown } | null;
    while (meta && meta.props.numberOfLines === undefined) meta = meta.parent as typeof meta;
    expect(meta?.props.numberOfLines).toBe(1);
    expect(sheetFlat(screen.getByTestId(`proof-tile-${day.deliveries[0].id}`)).minHeight).toBe(72);
  });
});
