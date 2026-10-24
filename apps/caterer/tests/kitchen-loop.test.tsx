import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { render } from "./render-dapur";
import { Linking, Pressable, Share, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { errorLabel, kitchenSession, routeMapsUrl, type SellerOperationsState } from "@catera/domain";
import { nativeMotion } from "@catera/design-tokens";
import { MoodProvider, ToastProvider, useMood } from "@catera/mobile-ui";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { TodayScreen } from "../src/today/TodayScreen";
import { dishKey } from "../src/today/ticks";
import { canvasDay, delivery, report } from "./fixtures";
import { spyFades } from "./fade";
import { confirm, lastConfirm, resetSheets, SheetHost } from "./sheet-host";

// The clock is pinned to Thursday 8 Oct 2026, 10.00 Jakarta. Only the clock: timers and microtasks keep running.
const pinToday = () =>
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });

// The stop's "…" opens its sheet route; here the sheet shows next to the screen (`SheetHost`), and the confirm sheets
// answer from the test.
jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
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

const TODAY = "2026-10-08";
const TOMORROW = "2026-10-09";
const YESTERDAY = "2026-10-07";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };

type MealState = { status: string; cooking_started_at?: string | null; departed_at?: string | null; arrived_at?: string | null };
const scheduled: MealState = { status: "scheduled" };
const cooking: MealState = { status: "preparing", cooking_started_at: "2026-10-08T01:10:00Z" };

/**
 * The canvas day (four lunch rows, 34 portions) on `date`, one meal state per row (the last one repeats), with the
 * dated menus filled for both packages unless `dishes` is false.
 */
function kitchenDay(
  meals: MealState[],
  { date = TODAY, dishes = true, meal = "lunch" }: { date?: string; dishes?: boolean; meal?: "lunch" | "dinner" } = {},
): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = date;
  day.deliveries = day.deliveries.map((d, i) => {
    const m = meals[Math.min(i, meals.length - 1)];
    return { ...d, service_date: date, status: m.status, meals: [{ meal, ...m }] } as typeof d;
  });
  if (!dishes) return day;
  const dish = (id: string, groupId: string, name: string, image = "") => ({ id, groupId, name, description: "", image, serving: "" });
  const composition = (lauk: number) => [
    { id: "g-nasi", name: "Nasi", slots: 1 },
    { id: "g-lauk", name: "Lauk", slots: lauk },
    { id: "g-sayur", name: "Sayur", slots: 1 },
  ];
  const menu = (packageId: string, lauk: number, items: unknown[]) => ({
    package_id: packageId, content_revision: 0, service_date: date, meal: "lunch", version: 1,
    details: { name: "", description: "", image: "", meal: "lunch", composition: composition(lauk), items },
  });
  day.datedMenus = [
    menu("p-rumahan", 2, [
      dish("a", "g-nasi", "Nasi putih"),
      dish("b", "g-lauk", "Ayam bakar", "https://img.example.test/ayam.jpg"),
      dish("c", "g-lauk", "Tempe orek"),
      dish("d", "g-sayur", "Sayur asem"),
    ]),
    menu("p-hemat", 1, [dish("e", "g-nasi", "Nasi putih"), dish("f", "g-lauk", "Telur balado"), dish("g", "g-sayur", "Sayur asem")]),
  ] as never;
  return day;
}

function runtimeWith(
  day: (catererId: string, date: string) => Promise<unknown>,
  command: jest.Mock = jest.fn(async () => ({ moved: 4 })),
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "t", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(day),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command,
    usage: jest.fn(async () => undefined),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** A stop's sheet as its route draws it (`/atur-antaran/{id}?meal=…&date=…`). */
const stopSheet = ({ path, params }: { path: string; params: Record<string, string> }) =>
  path.startsWith("/atur-antaran/") ? (
    <ExceptionSheet id={path.split("/")[2]} meal={params.meal === "dinner" ? "dinner" : "lunch"} date={params.date} />
  ) : null;

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ToastProvider>
        <TodayScreen />
        <SheetHost render={stopSheet} />
      </ToastProvider>
    </MobileProvider>,
  );

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  jest.clearAllMocks();
  resetSheets();
  store().clear();
  pinToday();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("the count card's rantang track", () => {
  it("says Terjadwal for a meal nobody started, and Dimasak 08.10 once the kitchen did", async () => {
    let served = kitchenDay([scheduled]);
    const runtime = runtimeWith(async () => served);
    renderToday(runtime);
    const card = await screen.findByTestId("session-count");
    // The compact track leaves its words line out of the picture; they are the first thing its accessibility value says.
    const words = () => (within(screen.getByTestId("session-count")).getByTestId("rantang-track").props.accessibilityValue.text as string).split(". ")[0];
    expect(words()).toBe("Terjadwal");
    // The three stop labels are decoration for the eye; a screen reader gets the caption.
    const hidden = { includeHiddenElements: true };
    expect(within(card).getByText("Dimasak", hidden)).toBeTruthy();
    expect(within(card).getByText("Diantar", hidden)).toBeTruthy();
    expect(within(card).getByText("Sampai", hidden)).toBeTruthy();

    served = kitchenDay([cooking]);
    fireEvent.press(await screen.findByText("Mulai masak"));
    await lastConfirm().press("Mulai");
    await waitFor(() => expect(words()).toBe("Dimasak 08.10"));
  });
});

describe("the count card's four-stop track with mixed stages", () => {
  it("puts a figure under each stop and fills the line to the furthest stage any row reached", async () => {
    const left = { departed_at: "2026-10-08T03:00:00Z" };
    const day = kitchenDay([
      cooking,
      cooking,
      { status: "out_for_delivery", cooking_started_at: cooking.cooking_started_at, ...left },
      { status: "out_for_delivery", cooking_started_at: cooking.cooking_started_at, ...left, arrived_at: "2026-10-08T04:00:00Z" },
    ]);
    renderToday(runtimeWith(async () => day));
    const card = await screen.findByTestId("session-count");
    const hidden = { includeHiddenElements: true };
    const figure = (i: number) => (within(card).getByTestId(`rantang-track-count-${i}`, hidden).children as string[]).join("");
    expect([0, 1, 2, 3].map(figure)).toEqual(["0", "2", "1", "1"]);
    const track = within(card).getByTestId("rantang-track");
    // The caption, the line, the ring and the sentence all follow the furthest stage, so they never disagree.
    expect((track.props.accessibilityValue.text as string).split(". ")[0]).toBe("Ditandai sampai");
    expect(track.props.accessibilityValue.text).not.toContain("Dimasak 08.10");
    expect(track.props.accessibilityLabel).toBe("Pesanan: Ditandai sampai, langkah 4 dari 4");
    expect(within(card).getByTestId("rantang-track-stop-3-half", hidden)).toBeTruthy();
  });

  it("stays still across a mood switch: the other meal's track mounts in place (Decision A)", async () => {
    const day = kitchenDay([cooking]);
    for (const d of day.deliveries) d.meals.push({ meal: "dinner", status: "scheduled" } as never);
    const Switch = () => {
      const { setMood } = useMood();
      return <Pressable accessibilityLabel="ke Malam" onPress={() => setMood("malam")} />;
    };
    render(
      <MobileProvider runtime={runtimeWith(async () => day)} linkMapper={(h) => h}>
        <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
          <Switch />
          <TodayScreen />
        </MoodProvider>
      </MobileProvider>,
    );
    const sentence = () => within(screen.getByTestId("session-count")).getByTestId("rantang-track").props.accessibilityLabel;
    await waitFor(() => expect(sentence()).toBe("Pesanan: Dimasak, langkah 2 dari 4"));
    const timing = jest.spyOn(Reanimated, "withTiming");
    fireEvent.press(screen.getByLabelText("ke Malam"));
    await waitFor(() => expect(sentence()).toBe("Pesanan: Terjadwal, langkah 1 dari 4"));
    // The tracker moves over `feature` only on a real stage change; the other meal is not one.
    expect(timing.mock.calls.filter(([, config]) => config?.duration === nativeMotion.feature)).toEqual([]);
  });
});

describe("Daftar masak", () => {
  it("lists one row per dish with its count, and says the ticks are a kitchen note", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    // Nasi putih and Sayur asem are in both packages: 28 + 6 portions. Ayam bakar and Tempe orek are Rumahan only.
    expect(screen.getByLabelText("34× Nasi putih")).toBeTruthy();
    expect(screen.getByLabelText("28× Ayam bakar")).toBeTruthy();
    expect(screen.getByLabelText("28× Tempe orek")).toBeTruthy();
    expect(screen.getByLabelText("6× Telur balado")).toBeTruthy();
    expect(screen.getByLabelText("34× Sayur asem")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    // A dish with a photo shows it; one without shows the meal's icon.
    expect(screen.getByTestId("check-row-1-image")).toBeTruthy();
    expect(screen.getByTestId("check-row-0-icon", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Centang ini cuma catatan dapur. Pelanggan tidak melihatnya.")).toBeTruthy();
    // The old plain list is gone.
    expect(screen.queryByText("Yang dimasak")).toBeNull();
  });

  it("with no dishes reads Menu belum diisi and keeps the owner's Isi menu button", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled], { dishes: false })));
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    expect(screen.getAllByText(/^Menu belum diisi · /).length).toBe(2);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    const buttons = screen.getAllByText("Isi menu");
    fireEvent.press(buttons[0]);
    expect(router.push).toHaveBeenLastCalledWith(`/menu/${TODAY}?pkg=p-rumahan&meal=lunch`);
  });

  it("writes ticks.<catererId> with today's date and restores them", async () => {
    const runtime = runtimeWith(async () => kitchenDay([scheduled]));
    const view = renderToday(runtime);
    fireEvent.press(await screen.findByLabelText("28× Ayam bakar"));
    const key = runtime.storageKey("ticks.k-1");
    await waitFor(() => expect(store().has(key)).toBe(true));
    expect(JSON.parse(store().get(key)!)).toEqual({ [TODAY]: { lunch: [dishKey({ category: "Lauk", name: "Ayam bakar" })] } });
    expect(screen.getByLabelText("28× Ayam bakar").props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    // Untick writes it back out.
    fireEvent.press(screen.getByLabelText("28× Ayam bakar"));
    await waitFor(() => expect(JSON.parse(store().get(key)!)[TODAY].lunch).toEqual([]));

    fireEvent.press(screen.getByLabelText("6× Telur balado"));
    await waitFor(() => expect(JSON.parse(store().get(key)!)[TODAY].lunch).toHaveLength(1));
    view.unmount();
    // A new session of the screen reads the stored tick back.
    renderToday(runtime);
    const row = await screen.findByLabelText("6× Telur balado");
    await waitFor(() => expect(row.props.accessibilityState).toEqual(expect.objectContaining({ checked: true })));
  });

  it("keeps a ticked row ticked across a mood switch, reading the stored ticks only once", async () => {
    const day = kitchenDay([scheduled]);
    for (const d of day.deliveries) d.meals.push({ meal: "dinner", status: "scheduled" } as never);
    day.datedMenus = [
      ...day.datedMenus!,
      ...day.datedMenus!.map((m) => ({ ...m, meal: "dinner", details: { ...m.details, meal: "dinner" } })),
    ] as never;
    const Switch = () => {
      const { setMood } = useMood();
      return (
        <>
          <Pressable accessibilityLabel="ke Malam" onPress={() => setMood("malam")} />
          <Pressable accessibilityLabel="ke Siang" onPress={() => setMood("siang")} />
        </>
      );
    };
    const runtime = runtimeWith(async () => day);
    const ticksKey = runtime.storageKey("ticks.k-1");
    const reads = jest.spyOn(SecureStore, "getItemAsync");
    reads.mockClear();
    const ticksReads = () => reads.mock.calls.filter(([k]) => k === ticksKey).length;
    render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
          <Switch />
          <TodayScreen />
        </MoodProvider>
      </MobileProvider>,
    );
    const checked = () => screen.getByLabelText("28× Ayam bakar").props.accessibilityState.checked;
    fireEvent.press(await screen.findByLabelText("28× Ayam bakar"));
    await waitFor(() => expect(checked()).toBe(true));
    expect(ticksReads()).toBe(1);

    // Dinner has its own list, so the lunch tick is not shown there.
    fireEvent.press(screen.getByLabelText("ke Malam"));
    await waitFor(() => expect(checked()).toBe(false));
    fireEvent.press(screen.getByLabelText("ke Siang"));
    await waitFor(() => expect(checked()).toBe(true));
    // No reload on the way: the checklist stayed mounted, so the stored ticks were read once.
    expect(ticksReads()).toBe(1);
    expect(JSON.parse(store().get(ticksKey)!)).toEqual({ [TODAY]: { lunch: [dishKey({ category: "Lauk", name: "Ayam bakar" })] } });
  });

  it("never shows yesterday's ticks today and drops them on the next write", async () => {
    const runtime = runtimeWith(async () => kitchenDay([scheduled]));
    const key = runtime.storageKey("ticks.k-1");
    const ayam = dishKey({ category: "Lauk", name: "Ayam bakar" });
    store().set(key, JSON.stringify({ [YESTERDAY]: { lunch: [ayam], dinner: [ayam] } }));
    renderToday(runtime);
    const row = await screen.findByLabelText("28× Ayam bakar");
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
    // Reading alone leaves the store as it was; the next write is what drops the old date.
    expect(JSON.parse(store().get(key)!)).toHaveProperty(YESTERDAY);
    fireEvent.press(screen.getByLabelText("6× Telur balado"));
    await waitFor(() => expect(JSON.parse(store().get(key)!)).toHaveProperty(TODAY));
    expect(Object.keys(JSON.parse(store().get(key)!))).toEqual([TODAY]);
  });

  it("keeps tomorrow's ticks when today's are written", async () => {
    const runtime = runtimeWith(async () => kitchenDay([scheduled]));
    const key = runtime.storageKey("ticks.k-1");
    store().set(key, JSON.stringify({ [TOMORROW]: { lunch: ["Lauk\u0000Ayam bakar"] } }));
    renderToday(runtime);
    fireEvent.press(await screen.findByLabelText("6× Telur balado"));
    await waitFor(() => expect(JSON.parse(store().get(key)!)).toHaveProperty(TODAY));
    expect(JSON.parse(store().get(key)!)).toHaveProperty(TOMORROW);
  });

  it("never gates an action: Mulai masak works with nothing ticked, Berangkat antar with everything ticked", async () => {
    let served = kitchenDay([scheduled]);
    const command = jest.fn(async () => ({ moved: 4 }));
    renderToday(runtimeWith(async () => served, command));
    const start = await screen.findByRole("button", { name: "Mulai masak" });
    expect(start.props.accessibilityState?.disabled).toBeFalsy();

    served = kitchenDay([cooking]);
    fireEvent.press(start);
    await lastConfirm().press("Mulai");
    await screen.findByText("Berangkat antar · 34 porsi");
    for (const box of screen.getAllByRole("checkbox")) fireEvent.press(box);
    const depart = screen.getByRole("button", { name: "Berangkat antar · 34 porsi" });
    expect(depart.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(depart);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});

describe("Mulai masak", () => {
  it("asks first, then sends delivery.cook for today and the meal, with a success haptic and a count", async () => {
    const command = jest.fn(async () => ({ moved: 4 }));
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    const dialog = lastConfirm();
    expect(dialog.title).toBe("Mulai masak makan siang?");
    expect(dialog.message).toBe("Pelanggan akan melihat status Dimasak.");
    expect(dialog.labels).toEqual(["Batal", "Mulai"]);
    expect(dialog.icon).toBe("rantang");
    // Nothing is sent before the answer, and Batal sends nothing at all.
    expect(command).not.toHaveBeenCalled();
    await dialog.press("Batal");
    expect(command).not.toHaveBeenCalled();

    // Asked again, Mulai sends it.
    fireEvent.press(screen.getByText("Mulai masak"));
    await lastConfirm().press("Mulai");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(command).toHaveBeenCalledWith("delivery.cook", { catererId: "k-1", date: TODAY, meal: "lunch" }, expect.any(String));
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith("success"));
    await waitFor(() => expect(runtime.api.usage).toHaveBeenCalledWith("cook_started", "dapur"));
  });

  it("names the evening meal on the Malam side and sends it for dinner", async () => {
    const command = jest.fn(async () => ({ moved: 4 }));
    const runtime = runtimeWith(async () => kitchenDay([scheduled], { meal: "dinner", dishes: false }), command);
    render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <MoodProvider now={() => new Date("2026-10-08T12:00:00Z")}>
          <TodayScreen />
        </MoodProvider>
      </MobileProvider>,
    );
    fireEvent.press(await screen.findByText("Mulai masak"));
    const dialog = lastConfirm();
    expect(dialog.title).toBe("Mulai masak makan malam?");
    await dialog.press("Mulai");
    await waitFor(() => expect(command).toHaveBeenCalledWith("delivery.cook", { catererId: "k-1", date: TODAY, meal: "dinner" }, expect.any(String)));
    // Let the command settle and the day be read again, so nothing updates after the test has ended.
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith("success"));
    await waitFor(() => expect((runtime.api.sellerOperations as jest.Mock).mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Mulai masak" }).props.accessibilityState?.disabled).toBeFalsy());
  });

  it("is still offered when one stop has already moved on and the rest are scheduled", async () => {
    renderToday(runtimeWith(async () => kitchenDay([{ status: "out_for_delivery", departed_at: "2026-10-08T02:00:00Z" }, scheduled])));
    expect(await screen.findByText("Mulai masak")).toBeTruthy();
    expect(screen.queryByText(/^Berangkat antar/)).toBeNull();
    // The action follows the least advanced row; the track and its words follow the furthest one.
    const card = within(screen.getByTestId("session-count"));
    expect((card.getByTestId("rantang-track").props.accessibilityValue.text as string).split(". ")[0]).toBe("Diantar");
    expect(card.getByTestId("rantang-track").props.accessibilityLabel).toBe("Pesanan: Diantar, langkah 3 dari 4");
  });

  it("answers an INVALID_DATE with an error toast with Coba lagi, and reads the day again", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("INVALID_DATE"), { code: "INVALID_DATE" });
    });
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    await lastConfirm().press("Mulai");
    expect(await screen.findByText("Hanya bisa untuk hari ini.")).toBeTruthy();
    expect(screen.getByLabelText("Coba lagi")).toBeTruthy();
    // No loose line in the footer: the failure is the toast.
    expect(within(screen.getByTestId("screen-footer")).queryByText("Hanya bisa untuk hari ini.")).toBeNull();
    await waitFor(() => expect((runtime.api.sellerOperations as jest.Mock).mock.calls.length).toBeGreaterThan(1));
    expect(runtime.api.usage).not.toHaveBeenCalledWith("cook_started", "dapur");
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    // The button is usable again, and a new try clears the line.
    expect(screen.getByRole("button", { name: "Mulai masak" }).props.accessibilityState?.disabled).toBeFalsy();
  });

  it("maps another failure through the app's error helper", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderToday(runtimeWith(async () => kitchenDay([scheduled]), command));
    fireEvent.press(await screen.findByText("Mulai masak"));
    await lastConfirm().press("Mulai");
    expect(await screen.findByText(errorLabel("REQUEST_TIMEOUT", "id"))).toBeTruthy();
    // Coba lagi runs the command again without asking again.
    fireEvent.press(screen.getByLabelText("Coba lagi"));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
  });

  it("sends one command for a double press while it runs", async () => {
    let release: (v: unknown) => void = () => undefined;
    const command = jest.fn(() => new Promise((resolve) => (release = resolve)));
    renderToday(runtimeWith(async () => kitchenDay([scheduled]), command));
    const start = await screen.findByRole("button", { name: "Mulai masak" });
    fireEvent.press(start);
    await lastConfirm().press("Mulai");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    // The same sheet answered twice, and the footer pressed again, still make one command.
    await lastConfirm().press("Mulai");
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(screen.getByRole("button", { name: "Mulai masak" }).props.accessibilityState?.disabled).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => release({ moved: 4 }));
  });

  it("stays quiet when the late tap moved nothing: no success buzz, no count, a plain line", async () => {
    const command = jest.fn(async () => ({ moved: 0 }));
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    await lastConfirm().press("Mulai");
    expect(await screen.findByText("Sudah ditandai dimasak.")).toBeTruthy();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(runtime.api.usage).not.toHaveBeenCalledWith("cook_started", "dapur");
  });
});

describe("Berangkat antar", () => {
  it("shows once nothing is scheduled and something is cooking, with the caption that promises no number", async () => {
    const command = jest.fn(async () => ({ moved: 4 }));
    const runtime = runtimeWith(async () => kitchenDay([cooking]), command);
    renderToday(runtime);
    expect(await screen.findByText("Berangkat antar · 34 porsi")).toBeTruthy();
    expect(screen.queryByText("Mulai masak")).toBeNull();
    expect(screen.getByText("Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Berangkat antar · 34 porsi" }));
    const dialog = lastConfirm();
    expect(dialog.title).toBe("Berangkat antar sekarang?");
    expect(dialog.labels).toEqual(["Batal", "Berangkat"]);
    await dialog.press("Berangkat");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(command).toHaveBeenCalledWith("delivery.depart", { catererId: "k-1", date: TODAY, meal: "lunch" }, expect.any(String));
    await waitFor(() => expect(runtime.api.usage).toHaveBeenCalledWith("depart_tapped", "dapur"));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  });

  it("offers nothing once the meal is out for delivery", async () => {
    renderToday(runtimeWith(async () => kitchenDay([{ status: "out_for_delivery", departed_at: "2026-10-08T02:30:00Z" }])));
    await screen.findByTestId("session-count");
    expect(screen.queryByText("Mulai masak")).toBeNull();
    expect(screen.queryByText(/^Berangkat antar/)).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });
});

describe("a meal whose rows all failed", () => {
  it("says how many were marked Gagal diantar, never that there were none", async () => {
    renderToday(runtimeWith(async () => kitchenDay([{ status: "issue" }])));
    expect(await screen.findByText("4 pengantaran makan siang ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.queryByText("Tidak ada pengantaran makan siang.")).toBeNull();
    expect(screen.queryByText("Tidak ada yang dimasak hari ini.")).toBeNull();
    // Nothing is cooking, so there is no count card, checklist or footer action.
    expect(screen.queryByTestId("session-count")).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });

  it("counts only the real failed rows, and says delivery for one in English", async () => {
    const runtime = runtimeWith(async () => kitchenDay([{ status: "issue" }, { status: "cancelled" }]));
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByText("1 lunch delivery marked Not delivered.")).toBeTruthy();
  });

  it("still offers the other meal when it has a session", async () => {
    const day = kitchenDay([{ status: "issue" }]);
    day.deliveries[3].meals.push({ meal: "dinner", status: "scheduled" } as never);
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByText("4 pengantaran makan siang ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.getByText("Lihat makan malam · 6 porsi")).toBeTruthy();
  });
});

describe("the delivery time on the count card", () => {
  it("ignores the window of a row that failed", async () => {
    const day = kitchenDay([{ status: "issue" }, scheduled]);
    day.deliveries = day.deliveries.map((d, i) => ({
      ...d,
      offer: { ...d.offer, windows: { lunch: i === 0 ? "09.00-10.00" : "11.30-13.00" } },
    })) as typeof day.deliveries;
    renderToday(runtimeWith(async () => day));
    const card = await screen.findByTestId("session-count");
    expect(within(card).getByText("Antar 11.30")).toBeTruthy();
    expect(within(card).queryByText("Antar 09.00")).toBeNull();
  });
});

describe("other days and data", () => {
  it("shows the checklist for tomorrow and no footer action", async () => {
    renderToday(runtimeWith(async (_id, date) => kitchenDay([scheduled], { date })));
    await screen.findByText("Mulai masak");
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    expect(await screen.findByText("Daftar masak")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Mulai masak")).toBeNull());
    expect(screen.queryByTestId("screen-footer")).toBeNull();
    expect(screen.getByLabelText("28× Ayam bakar")).toBeTruthy();
  });

  it("offers no action on a copy kept from before the connection dropped", async () => {
    const offline = jest.requireMock("../src/today/offline") as { loadCachedDay: jest.Mock };
    offline.loadCachedDay.mockResolvedValue({ savedAt: "2026-10-08T01:00:00Z", data: kitchenDay([scheduled]) });
    renderToday(runtimeWith(async () => Promise.reject(new Error("REQUEST_TIMEOUT"))));
    expect(await screen.findByTestId("session-count")).toBeTruthy();
    expect(screen.queryByText("Mulai masak")).toBeNull();
    offline.loadCachedDay.mockResolvedValue(null);
  });
});

// ---- The delivery order and the done state ----

/** The canvas day with `n` stops, each with its own address, named so that the route order is stable. */
function manyStops(n: number): SellerOperationsState {
  const day = kitchenDay([scheduled]);
  const base = day.deliveries[0];
  day.deliveries = Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `x-${i}`,
    customer: { id: `cx-${i}`, name: `Pelanggan ${String(i + 1).padStart(2, "0")}` },
    address: { ...base.address, id: `ax-${i}`, line: `Jl. Kenanga ${i + 1}` },
  })) as typeof day.deliveries;
  return day;
}

const stopsOf = (day: SellerOperationsState) => kitchenSession(day, "lunch", new Date())!.stops;

/** Where each test id first appears in the rendered tree, in reading order; -1 when it is absent. */
function readingOrder(ids: string[]) {
  const seen = new Map<string, number>();
  let at = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const n = node as { props?: { testID?: string }; children?: unknown[] | null };
    at += 1;
    if (n.props?.testID && !seen.has(n.props.testID)) seen.set(n.props.testID, at);
    n.children?.forEach(walk);
  };
  walk(screen.toJSON());
  return ids.map((id) => seen.get(id) ?? -1);
}

const departed: MealState = { status: "out_for_delivery", departed_at: "2026-10-08T02:30:00Z" };
const delivered: MealState = { status: "delivered" };
const failed: MealState = { status: "issue" };
const LINE = "Tandai Sampai dengan foto bukti. Pelanggan lalu mengonfirmasi, dan tanpa laporan pengantaran ditandai sampai otomatis.";

describe("Urutan antar", () => {
  it("shows the first three stops as numbered rows and reveals the rest on Lihat alamat lainnya", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    expect(await screen.findByText("Urutan antar")).toBeTruthy();
    const first = screen.getByTestId("stop-1");
    expect(within(first).getByText("1")).toBeTruthy();
    expect(within(first).getByText("Bu Sari Wulandari")).toBeTruthy();
    expect(within(first).getByText(" · 2 porsi")).toBeTruthy();
    expect(within(first).getByText(/^Makan Siang Rumahan · Jl\. Melati \d+, Tebet$/)).toBeTruthy();
    expect(screen.getByTestId("stop-3")).toBeTruthy();
    expect(screen.queryByTestId("stop-4")).toBeNull();
    expect(screen.queryByText("Kost Damai")).toBeNull();

    fireEvent.press(screen.getByText("Lihat 1 alamat lainnya"));
    expect(within(screen.getByTestId("stop-4")).getByText("Kost Damai")).toBeTruthy();
    expect(screen.queryByText(/^Lihat \d+ alamat lainnya$/)).toBeNull();
  });

  it("says how many addresses are folded away, and reveals all of them", async () => {
    renderToday(runtimeWith(async () => manyStops(12)));
    fireEvent.press(await screen.findByText("Lihat 9 alamat lainnya"));
    expect(screen.getByTestId("stop-12")).toBeTruthy();
  });

  it("starts each meal's order folded: switching the mood does not carry the expanded list to the other meal", async () => {
    const day = manyStops(5);
    for (const d of day.deliveries) d.meals.push({ meal: "dinner", status: "scheduled" } as never);
    const Switch = () => {
      const { setMood } = useMood();
      return <Pressable accessibilityLabel="ke Malam" onPress={() => setMood("malam")} />;
    };
    render(
      <MobileProvider runtime={runtimeWith(async () => day)} linkMapper={(h) => h}>
        <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
          <Switch />
          <TodayScreen />
        </MoodProvider>
      </MobileProvider>,
    );
    fireEvent.press(await screen.findByText("Lihat 2 alamat lainnya"));
    expect(screen.getByTestId("stop-5")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("ke Malam"));
    // The dinner session has the same five stops, but its own order starts with the first three.
    expect(await screen.findByText("Lihat 2 alamat lainnya")).toBeTruthy();
    expect(screen.queryByTestId("stop-5")).toBeNull();
    expect(screen.getByTestId("stop-3")).toBeTruthy();
  });

  it("keeps the whole address in the row's spoken label while the visible address is one line", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    const info = await screen.findByTestId("stop-1-info");
    expect(info.props.accessibilityLabel).toMatch(
      /^1\. Bu Sari Wulandari, 2 porsi · Makan Siang Rumahan, Jl\. Melati \d+, Tebet$/,
    );
    expect(within(screen.getByTestId("stop-1")).getByTestId("stop-1-meta").props.numberOfLines).toBe(1);
  });

  it("keeps a stop's delivery note under its row, on one line", async () => {
    const day = kitchenDay([scheduled]);
    day.deliveries[0].address.instructions = "Pagar hijau, titip di pos satpam";
    renderToday(runtimeWith(async () => day));
    const note = await screen.findByText("Pagar hijau, titip di pos satpam");
    // One more meta line in the stop's own text column, so the row grows by 18 and no more.
    expect(note.props.numberOfLines).toBe(1);
    expect(note.props.testID).toBe("stop-1-delivery-note");
    expect(within(screen.getByTestId("stop-1")).getByText("Pagar hijau, titip di pos satpam")).toBe(note);
    expect(screen.getByTestId("stop-1-info").props.accessibilityLabel).toMatch(/, Pagar hijau, titip di pos satpam$/);
  });

  it("opens that stop's map from its map button", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const day = kitchenDay([scheduled]);
    renderToday(runtimeWith(async () => day));
    fireEvent.press(await screen.findByLabelText("Buka peta Keluarga Hartono"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(stopsOf(day).find((s) => s.name === "Keluarga Hartono")!.mapsUrl);
    open.mockRestore();
  });

  it("opens the exception sheet for that stop from the ellipsis button", async () => {
    // One day for every read, as the server answers: the sheet reads it again and must find the same stop.
    const day = kitchenDay([scheduled]);
    renderToday(runtimeWith(async () => day));
    const more = within(await screen.findByTestId("stop-1")).getByLabelText(
      "Laporkan masalah atau pindah tanggal: Bu Sari Wulandari",
    );
    fireEvent.press(more);
    expect(await screen.findByText("Gagal diantar")).toBeTruthy();
    expect(screen.getByText("Pindah tanggal")).toBeTruthy();
    // The sheet is titled with the stop it was opened for: the name is on the row and on the sheet.
    expect(screen.getAllByText("Bu Sari Wulandari").length).toBeGreaterThan(1);
  });

  it("names the ellipsis for what its sheet can do: only a report when the day cannot move", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    // Keluarga Hartono's change deadline has passed.
    fireEvent.press(within(await screen.findByTestId("stop-3")).getByLabelText("Laporkan masalah: Keluarga Hartono"));
    expect(await screen.findByText("Gagal diantar")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
  });

  it("names the customer on every ellipsis, so no two buttons read the same", async () => {
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    await screen.findByTestId("stop-1");
    const labels = screen
      .getAllByLabelText(/^(Laporkan masalah|Pindah tanggal)/)
      .map((b) => b.props.accessibilityLabel as string);
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).toMatch(/: \S/);
  });

  it("names the customer in English too", async () => {
    // One day for every read, as the server returns it: the stored locale arrives after the first read and reads the
    // day again, and a fresh kitchenDay() per read numbers its rows anew, which would swap the stop rows under the query.
    const day = kitchenDay([scheduled]);
    const runtime = runtimeWith(async () => day);
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(
      within(await screen.findByTestId("stop-1")).getByLabelText(
        "Report a problem or move the date: Bu Sari Wulandari",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("stop-3")).getByLabelText("Report a problem: Keluarga Hartono"),
    ).toBeTruthy();
  });

  it("offers only a move on tomorrow, and only where the day can move", async () => {
    renderToday(runtimeWith(async (_id, date) => kitchenDay([scheduled], { date })));
    await screen.findByText("Mulai masak");
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    // Tomorrow's day is read before its first stop shows; the checklist beside it reads its note too, so let that settle.
    expect(
      await within(await screen.findByTestId("stop-1")).findByLabelText("Pindah tanggal: Bu Sari Wulandari"),
    ).toBeTruthy();
    await act(async () => undefined);
    expect(screen.queryByText("Mulai masak")).toBeNull();
    expect(within(screen.getByTestId("stop-3")).queryByLabelText(/Laporkan|Pindah tanggal/)).toBeNull();
  });

  it("shows no ellipsis on a stop whose meal is already delivered, and keeps it on the others", async () => {
    const day = kitchenDay([delivered, scheduled]);
    renderToday(runtimeWith(async () => day));
    const done = stopsOf(day).find((s) => s.deliveryId === day.deliveries[0].id)!;
    const other = stopsOf(day).find((s) => s.deliveryId !== day.deliveries[0].id)!;
    const row = await screen.findByTestId(`stop-${done.n}`);
    expect(within(row).getByText(done.name)).toBeTruthy();
    expect(within(row).queryByLabelText(/Laporkan|Pindah tanggal/)).toBeNull();
    expect(within(screen.getByTestId(`stop-${other.n}`)).getByLabelText(/^Laporkan masalah/)).toBeTruthy();
  });

  it("sends Gagal diantar for a stop whose sheet can only fail, and closes once saved", async () => {
    const command = jest.fn(async () => ({}));
    const day = kitchenDay([departed]);
    renderToday(runtimeWith(async () => day, command));
    const first = stopsOf(day)[0];
    fireEvent.press(
      await within(await screen.findByTestId("stop-1")).findByLabelText(`Laporkan masalah: ${first.name}`),
    );
    expect(await screen.findByText("Gagal diantar")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    fireEvent.press(screen.getByText("Tandai gagal diantar"));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.status",
        expect.objectContaining({ id: first.deliveryId, meal: "lunch", status: "issue" }),
        expect.any(String),
      ),
    );
    // The save resolves in microtasks and the sheet closes from the effect that follows: one async act lets both finish.
    await act(async () => undefined);
    expect(screen.queryByText("Tandai gagal diantar")).toBeNull();
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe("the exception sheet on its own", () => {
  it("never offers Gagal diantar for a delivered meal and never closes silently on save", async () => {
    const day = kitchenDay([delivered]);
    const command = jest.fn(async () => ({}));
    render(
      <MobileProvider runtime={runtimeWith(async () => day, command)} linkMapper={(h) => h}>
        <ExceptionSheet id={day.deliveries[0].id} meal="lunch" date={TODAY} />
      </MobileProvider>,
    );
    expect(await screen.findByText("Tidak ada yang bisa dilaporkan untuk alamat ini.")).toBeTruthy();
    expect(screen.queryByText("Gagal diantar")).toBeNull();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    // There is nothing to save, so there is no "Tandai gagal diantar": nothing is sent and the sheet does not close as if saved.
    expect(screen.queryByRole("button", { name: "Tandai gagal diantar" })).toBeNull();
    await act(async () => undefined);
    expect(command).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe("Buka semua di Peta", () => {
  it("opens the directions link for the route", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const day = kitchenDay([scheduled]);
    renderToday(runtimeWith(async () => day));
    fireEvent.press(await screen.findByText("Buka semua di Peta"));
    expect(open).toHaveBeenCalledWith(routeMapsUrl(stopsOf(day))!.url);
    open.mockRestore();
  });

  it("reads Buka 10 alamat pertama di Peta with twelve stops, and opens only those ten", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const day = manyStops(12);
    renderToday(runtimeWith(async () => day));
    fireEvent.press(await screen.findByText("Buka 10 alamat pertama di Peta"));
    expect(screen.queryByText("Buka semua di Peta")).toBeNull();
    const link = routeMapsUrl(stopsOf(day))!;
    expect(link.count).toBe(10);
    expect(open).toHaveBeenCalledWith(link.url);
    expect(decodeURIComponent(link.url)).not.toContain("Jl. Kenanga 11");
    open.mockRestore();
  });

  it("says it in English", async () => {
    const runtime = runtimeWith(async () => manyStops(12));
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByText("Open the first 10 addresses in Maps")).toBeTruthy();
  });
});

describe("Bagikan rute ke WhatsApp", () => {
  it("still shares the route text", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    renderToday(runtimeWith(async () => kitchenDay([scheduled])));
    fireEvent.press(await screen.findByText("Bagikan rute ke WhatsApp"));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0]).toEqual(expect.objectContaining({ message: expect.stringMatching(/^\*Antar siang/) }));
    share.mockRestore();
  });
});

describe("the order across the stages", () => {
  it("sits below the checklist before departure", async () => {
    renderToday(runtimeWith(async () => kitchenDay([cooking])));
    await screen.findByText("Urutan antar");
    const [list, order] = readingOrder(["cooking-list", "delivery-order"]);
    expect(list).toBeGreaterThan(0);
    expect(order).toBeGreaterThan(list);
  });

  it("leads alone after departure: no checklist, the header and track say it is out, and the line explains arrival", async () => {
    renderToday(runtimeWith(async () => kitchenDay([departed])));
    expect(await screen.findByText("Urutan antar")).toBeTruthy();
    expect(screen.queryByTestId("cooking-list")).toBeNull();
    expect(screen.queryByText("Daftar masak")).toBeNull();
    expect(screen.queryByText("Per paket")).toBeNull();
    expect(screen.getByText("Dapur Bu Rina · Sedang diantar")).toBeTruthy();
    expect(within(screen.getByTestId("session-count")).getByTestId("rantang-track").props.accessibilityValue.text).toMatch(/^Berangkat 09.30/);
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
    // The order and its buttons are all still there.
    expect(screen.getByTestId("stop-1")).toBeTruthy();
    expect(screen.getByText("Buka semua di Peta")).toBeTruthy();
    expect(screen.getByText("Bagikan rute ke WhatsApp")).toBeTruthy();
  });

  it("keeps Hari ini in the header before departure, and says nothing about arrival on tomorrow", async () => {
    renderToday(runtimeWith(async (_id, date) => kitchenDay([scheduled], { date })));
    expect(await screen.findByText("Dapur Bu Rina · Hari ini")).toBeTruthy();
    expect(screen.getByText(LINE)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    // Wait for tomorrow's own day: the header names it before its stops are read.
    await screen.findByText("Dapur Bu Rina · Besok");
    await screen.findByLabelText(/^Pindah tanggal: /);
    await act(async () => undefined);
    expect(screen.queryByText(LINE)).toBeNull();
  });

  it("lets a stop of a meal that is out for delivery be reported", async () => {
    renderToday(runtimeWith(async () => kitchenDay([departed])));
    fireEvent.press(await within(await screen.findByTestId("stop-1")).findByLabelText(/^Laporkan masalah: \S/));
    expect(await screen.findByText("Gagal diantar")).toBeTruthy();
  });

  it("changes stage in place: Berangkat antar does not fade the day's body, a date change does", async () => {
    let served = kitchenDay([cooking]);
    renderToday(runtimeWith(async (_id, date) => ({ ...served, date })));
    await screen.findByText("Daftar masak");
    const fades = spyFades();
    served = kitchenDay([departed]);
    fireEvent.press(await screen.findByText("Berangkat antar · 34 porsi"));
    await lastConfirm().press("Berangkat");
    expect(await screen.findByText("Dapur Bu Rina · Sedang diantar", {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.queryByText("Daftar masak")).toBeNull();
    // The stage moved the track and the footer in place; no block entered.
    expect(fades.mock.calls).toHaveLength(0);
    // A different day is different content: it fades.
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    await screen.findByText("Dapur Bu Rina · Besok");
    await waitFor(() => expect(fades.mock.calls.length).toBeGreaterThan(0));
    fades.mockRestore();
  }, 30000);

  it("Mulai masak does not fade the session block", async () => {
    let served = kitchenDay([scheduled]);
    renderToday(runtimeWith(async () => served));
    fireEvent.press(await screen.findByText("Mulai masak"));
    const fades = spyFades();
    served = kitchenDay([cooking]);
    await lastConfirm().press("Mulai");
    await waitFor(() => expect(screen.queryByText("Mulai masak")).toBeNull());
    expect(fades.mock.calls).toHaveLength(0);
    fades.mockRestore();
  }, 30000);
});

describe("Semua beres", () => {
  it("replaces the sessions once every delivery is recorded, with a button to tomorrow", async () => {
    const runtime = runtimeWith(async (_id, date) => kitchenDay([delivered], { date }));
    renderToday(runtime);
    expect(await screen.findByText("Semua beres hari ini")).toBeTruthy();
    expect(screen.getByText("Semua pengantaran sudah ditandai sampai.")).toBeTruthy();
    expect(screen.queryByText("Urutan antar")).toBeNull();
    expect(screen.queryByText("Daftar masak")).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Lihat besok" }));
    await waitFor(() => expect(runtime.api.sellerOperations).toHaveBeenLastCalledWith("k-1", TOMORROW));
    expect(await screen.findByText("Dapur Bu Rina · Besok")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Semua beres hari ini")).toBeNull());
    expect(await screen.findByText("Urutan antar")).toBeTruthy();
  });

  it("counts from the real rows when some were marked Gagal diantar, and does not say everything arrived", async () => {
    renderToday(runtimeWith(async () => kitchenDay([delivered, delivered, delivered, failed])));
    expect(await screen.findByText("Semua beres hari ini")).toBeTruthy();
    expect(screen.getByText("3 ditandai sampai, 1 ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.queryByText("Semua pengantaran sudah ditandai sampai.")).toBeNull();
  });

  it("says it in English", async () => {
    const runtime = runtimeWith(async () => kitchenDay([delivered, delivered, failed, failed]));
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByText("All done today")).toBeTruthy();
    expect(screen.getByText("2 marked as arrived, 2 marked Not delivered.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See tomorrow" })).toBeTruthy();
  });

  it("counts a cancelled row as neither", async () => {
    renderToday(runtimeWith(async () => kitchenDay([delivered, delivered, { status: "cancelled" }])));
    expect(await screen.findByText("Semua pengantaran sudah ditandai sampai.")).toBeTruthy();
  });

  it("keeps the sessions while a customer report is still open", async () => {
    const runtime = runtimeWith(async () => kitchenDay([delivered]));
    (runtime.api.request as jest.Mock).mockResolvedValue([report({ service_date: TODAY, status: "responded" })]);
    renderToday(runtime);
    expect(await screen.findByText("Urutan antar")).toBeTruthy();
    expect(screen.queryByText("Semua beres hari ini")).toBeNull();
  });

  it("is done again once that report is resolved", async () => {
    const runtime = runtimeWith(async () => kitchenDay([delivered]));
    (runtime.api.request as jest.Mock).mockResolvedValue([report({ service_date: TODAY, status: "resolved" })]);
    renderToday(runtime);
    expect(await screen.findByText("Semua beres hari ini")).toBeTruthy();
  });

  it("does not call the day done when the reports could not be read", async () => {
    const runtime = runtimeWith(async () => kitchenDay([delivered]));
    (runtime.api.request as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    renderToday(runtime);
    expect(await screen.findByText("Laporan pelanggan belum bisa dimuat.")).toBeTruthy();
    expect(screen.getByText("Urutan antar")).toBeTruthy();
    expect(screen.queryByText("Semua beres hari ini")).toBeNull();
  });

  it("is not done while the other meal still has rows to serve", async () => {
    const day = kitchenDay([failed]);
    day.deliveries[3].meals.push({ meal: "dinner", status: "scheduled" } as never);
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByText("4 pengantaran makan siang ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.queryByText("Semua beres hari ini")).toBeNull();
    expect(screen.getByText("Lihat makan malam · 6 porsi")).toBeTruthy();
  });

  it("lets a meal whose rows all failed keep its own card, and counts every row once the other meal is shown", async () => {
    const day = kitchenDay([failed]);
    day.deliveries[3].meals.push({ meal: "dinner", status: "delivered" } as never);
    // The mood is what the "Lihat makan malam" button switches, so the screen needs its provider.
    render(
      <MobileProvider runtime={runtimeWith(async () => day)} linkMapper={(h) => h}>
        <MoodProvider>
          <TodayScreen />
        </MoodProvider>
      </MobileProvider>,
    );
    expect(await screen.findByText("4 pengantaran makan siang ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.queryByText("Semua beres hari ini")).toBeNull();
    fireEvent.press(screen.getByText("Lihat makan malam · 6 porsi"));
    expect(await screen.findByText("Semua beres hari ini")).toBeTruthy();
    expect(screen.getByText("1 ditandai sampai, 4 ditandai Gagal diantar.")).toBeTruthy();
  });

  it("is not done on a copy kept from before the connection dropped", async () => {
    const offline = jest.requireMock("../src/today/offline") as { loadCachedDay: jest.Mock };
    offline.loadCachedDay.mockResolvedValue({ savedAt: "2026-10-08T01:00:00Z", data: kitchenDay([delivered]) });
    renderToday(runtimeWith(async () => Promise.reject(new Error("REQUEST_TIMEOUT"))));
    expect(await screen.findByTestId("session-count")).toBeTruthy();
    expect(screen.queryByText("Semua beres hari ini")).toBeNull();
    offline.loadCachedDay.mockResolvedValue(null);
  });

  it("is never done for a day other than today", async () => {
    renderToday(runtimeWith(async (_id, date) => kitchenDay([delivered], { date })));
    await screen.findByText("Semua beres hari ini");
    fireEvent.press(screen.getByRole("button", { name: /, ganti hari$/ }));
    await waitFor(() => expect(screen.queryByText("Semua beres hari ini")).toBeNull());
  });
});

describe("Hari ini across a stage change", () => {
  // A long note on every stop splits the route's WhatsApp text into several parts.
  const longRoute = (meals: MealState[]) => {
    const day = kitchenDay(meals);
    day.deliveries = day.deliveries.map((d) => ({ ...d, address: { ...d.address, instructions: "pagar hijau ".repeat(60) } }));
    return day;
  };

  it("keeps the route part reached and the expanded stop list through Mulai masak and Berangkat antar", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    let served = longRoute([scheduled]);
    renderToday(runtimeWith(async () => served));
    fireEvent.press(await screen.findByText("Lihat 1 alamat lainnya"));
    expect(screen.getByTestId("stop-4")).toBeTruthy();
    fireEvent.press(screen.getByText("Bagikan rute ke WhatsApp"));
    await screen.findByText("Bagikan bagian 2");
    const part1 = share.mock.calls[0][0].message;

    served = longRoute([cooking]);
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    await lastConfirm().press("Mulai");
    await screen.findByText("Berangkat antar · 34 porsi");
    // The day re-keyed for the new stage; the next share is still part 2 and all four stops still show.
    expect(screen.getByText("Bagikan bagian 2")).toBeTruthy();
    expect(screen.getByTestId("stop-4")).toBeTruthy();
    fireEvent.press(screen.getByText("Bagikan bagian 2"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share.mock.calls[1][0].message).not.toBe(part1);
    share.mockRestore();
  });

  it("keeps the checklist ticks through Mulai masak without reading them again", async () => {
    let served = kitchenDay([scheduled]);
    renderToday(runtimeWith(async () => served));
    fireEvent.press(await screen.findByLabelText("6× Telur balado"));
    await waitFor(() => expect(screen.getByLabelText("6× Telur balado").props.accessibilityState?.checked).toBe(true));
    const reads = (SecureStore.getItemAsync as jest.Mock).mock.calls.filter(([k]) => String(k).includes("ticks.")).length;

    served = kitchenDay([cooking]);
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    await lastConfirm().press("Mulai");
    await screen.findByText("Berangkat antar · 34 porsi");
    // Checked in the very render the new stage appears in: no unticked frame while a fresh read runs.
    expect(screen.getByLabelText("6× Telur balado").props.accessibilityState?.checked).toBe(true);
    expect((SecureStore.getItemAsync as jest.Mock).mock.calls.filter(([k]) => String(k).includes("ticks.")).length).toBe(reads);
  });
});

/**
 * Hari ini on the Dapur scale (layout rethink, spec 3.1): the cooking list and the delivery run are their own sections
 * under a header that carries the day's figures and the compact track. Jest has no layout engine, so each size is read
 * from the style that sets it, the way the other layout tests do.
 */
describe("Hari ini on the Dapur scale", () => {
  type Node = ReturnType<typeof screen.getByTestId>;
  const box = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
  const hidden = { includeHiddenElements: true };
  /** Document order of the tree's drawn nodes, so "A is above B" is "A comes before B". */
  const before = (root: Node, a: object, b: object) => {
    const all = root.findAll((n) => typeof n.type === "string");
    return all.indexOf(a as never) < all.indexOf(b as never);
  };
  /** The canvas day with six stops, so "Lihat 3 alamat lainnya" has something to say. */
  const sixStops = (meals: MealState[] = [scheduled]) => {
    const day = kitchenDay(meals);
    const extra = ["Pak Budi", "Bu Wati"].map((who) => ({
      ...delivery({ id: "p-rumahan", name: "Makan Siang Rumahan" }, who, 1),
      service_date: TODAY,
      meals: [{ meal: "lunch", ...meals[0] }],
    }));
    day.deliveries = [...day.deliveries, ...(extra as never)];
    return day;
  };

  describe("the header", () => {
    it("runs the meta row, the date button, the figure strip with its Antar line and the compact track", async () => {
      const day = kitchenDay([scheduled]);
      for (const d of day.deliveries) {
        const windows = { lunch: "10.30–12.00", dinner: "18.00–19.30" };
        d.offer = { ...d.offer, windows } as typeof d.offer;
      }
      renderToday(runtimeWith(async () => day));
      const header = await screen.findByTestId("mood-header");
      const row = within(header).getByTestId("mood-header-row");
      const date = within(header).getByRole("button", { name: /, ganti hari$/ });
      const strip = await within(header).findByTestId("session-figures");
      const track = within(header).getByTestId("rantang-track");
      expect(before(header, row, date)).toBe(true);
      expect(before(header, date, strip)).toBe(true);
      expect(before(header, strip, track)).toBe(true);
      // Porsi leads, then paket and alamat, with "Antar" as the strip's own line.
      const cell = (i: number) => within(strip).getByTestId(`session-figures-cell-${i}`);
      expect(cell(0).props.accessibilityLabel).toBe("34 porsi");
      expect(cell(1).props.accessibilityLabel).toBe("2 paket");
      expect(cell(2).props.accessibilityLabel).toBe("4 alamat");
      expect(within(strip).getByText("Antar 10.30")).toBeTruthy();
      // The mascot is not in the header (it stays on the done and empty cards), and no hero fill is drawn behind it.
      expect(within(header).queryByTestId(/^mascot-/, hidden)).toBeNull();
      expect(within(header).queryByTestId("session-count-fill-siang", hidden)).toBeNull();
    });

    it("sets the date as a 24/30 button at least 48 tall, in a 36 meta row", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const date = await screen.findByRole("button", { name: /, ganti hari$/ });
      expect(box(date).minHeight).toBe(48);
      const title = within(date).getByText(/^Kamis 8 Okt$/);
      expect(box(title)).toMatchObject({ fontSize: 24, lineHeight: 30 });
      // The band's top row is 36, with the Siang / Malam toggle at its end.
      const header = screen.getByTestId("mood-header");
      expect(box(within(header).getByTestId("mood-header-row")).minHeight).toBe(36);
      expect(within(header).getByRole("tab", { name: "Siang" })).toBeTruthy();
    });

    it("draws the track compact: a 40 rail, no words line, the words kept for a screen reader", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const track = await screen.findByTestId("rantang-track");
      expect(box(within(track).getByTestId("rantang-track-rail")).height).toBe(40);
      expect(within(track).queryByTestId("rantang-track-caption")).toBeNull();
      expect(track.props.accessibilityValue.text).toContain("Terjadwal");
      // Rings of 32 round discs of 24.
      expect(box(within(track).getByTestId("rantang-track-stop-1", hidden)).width).toBe(32);
      expect(box(within(track).getByTestId("rantang-track-stop-1-disc", hidden)).width).toBe(24);
    });

    it("is the date and meta row only when there is no session", async () => {
      const day = kitchenDay([scheduled]);
      day.deliveries = [];
      renderToday(runtimeWith(async () => day));
      await screen.findByText("Tidak ada yang dimasak hari ini.");
      const header = screen.getByTestId("mood-header");
      expect(within(header).queryByTestId("session-figures")).toBeNull();
      expect(within(header).queryByTestId("rantang-track")).toBeNull();
      expect(within(header).getByRole("button", { name: /, ganti hari$/ })).toBeTruthy();
    });

    it("words the figures in English", async () => {
      const runtime = runtimeWith(async () => kitchenDay([scheduled]));
      store().set(runtime.storageKey("locale"), "en");
      renderToday(runtime);
      const strip = await screen.findByTestId("session-figures");
      await waitFor(() => expect(within(strip).getByTestId("session-figures-cell-0").props.accessibilityLabel).toBe("34 portions"));
      expect(within(strip).getByTestId("session-figures-cell-1").props.accessibilityLabel).toBe("2 packages");
      expect(within(strip).getByTestId("session-figures-cell-2").props.accessibilityLabel).toBe("4 addresses");
    });
  });

  describe("Daftar masak and Per paket", () => {
    it("heads the list with its count and two 48 actions, over a ListCard of 56 rows", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const list = await screen.findByTestId("cooking-list");
      expect(within(list).getByText("Daftar masak")).toBeTruthy();
      expect(within(list).getByText("5 menu")).toBeTruthy();
      for (const name of ["Bagikan", "Cetak"]) {
        const action = within(list).getByRole("button", { name });
        expect(box(action)).toMatchObject({ width: 48, height: 48 });
      }
      const rows = within(list).getAllByRole("checkbox");
      expect(rows).toHaveLength(5);
      for (const row of rows) expect(box(row).minHeight).toBe(56);
      expect(box(within(list).getByTestId("check-row-0-content")).minHeight).toBe(56);
      expect(box(within(list).getByTestId("check-row-0-box"))).toMatchObject({ width: 48, height: 48 });
      // A photo is 40 with radius 8, and so is the icon that stands in for one.
      expect(box(within(list).getByTestId("check-row-1-image"))).toMatchObject({ width: 40, height: 40, borderRadius: 8 });
      expect(box(within(list).getByTestId("check-row-0-icon", hidden))).toMatchObject({ width: 40, height: 40, borderRadius: 8 });
      // The hairlines start at the name: 48 + 12 + 40 + 12.
      expect(box(within(list).getAllByTestId("list-card-separator")[0]).marginLeft).toBe(112);
    });

    it("lets a dish photo carry its own radius: nothing between it and the list card clips", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const list = await screen.findByTestId("cooking-list");
      // An image that finishes loading inside an overflow-hidden rounded view can stay blank on Android.
      const clippers = (start: ReturnType<typeof screen.getByTestId>) => {
        const found: string[] = [];
        for (let n = start.parent; n; n = n.parent) {
          if (box(n)?.overflow === "hidden") found.push(String(n.props.testID ?? n.type));
          if (n.props.testID === "list-card") break;
        }
        return found;
      };
      expect(clippers(within(list).getByTestId("check-row-1-image"))).toEqual([]);
      expect(box(within(list).getAllByTestId("list-card")[0]).overflow).not.toBe("hidden");
    });

    it("keeps four digits in the 48 quantity column without moving the dish's name", async () => {
      const day = kitchenDay([scheduled]);
      day.deliveries[2] = { ...day.deliveries[2], portions: 1229 } as never;
      renderToday(runtimeWith(async () => day));
      expect(await screen.findByLabelText("1240× Nasi putih")).toBeTruthy();
      const quantity = (i: number) => screen.getByTestId(`check-row-${i}-quantity`);
      // Telur balado is the Hemat-only dish: 6 portions, in the fourth row.
      const telur = screen.getAllByRole("checkbox").findIndex((r) => r.props.accessibilityLabel === "6× Telur balado");
      expect(quantity(0).props.children).toBe(1240);
      expect(quantity(telur).props.children).toBe(6);
      for (const i of [0, telur]) {
        expect(box(quantity(i))).toMatchObject({ width: 48, textAlign: "right" });
        expect(quantity(i).props.numberOfLines).toBe(1);
        expect(quantity(i).props.adjustsFontSizeToFit).toBe(true);
      }
      // The name starts in the same place in both rows: nothing before it grows with the digits.
      const name = (i: number) => within(screen.getByTestId(`check-row-${i}`)).getByText(i === 0 ? "Nasi putih" : "Telur balado");
      expect(box(name(0)).flex).toBe(1);
      expect(box(name(0)).minWidth).toBeUndefined();
      expect(box(name(telur)).minWidth).toBeUndefined();
    });

    it("leaves a ticked row where it is", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const rowsBefore = (await screen.findAllByRole("checkbox")).map((r) => r.props.accessibilityLabel);
      fireEvent.press(screen.getByLabelText("6× Telur balado"));
      await waitFor(() => expect(screen.getByLabelText("6× Telur balado").props.accessibilityState.checked).toBe(true));
      expect(screen.getAllByRole("checkbox").map((r) => r.props.accessibilityLabel)).toEqual(rowsBefore);
    });

    it("puts the kitchen-truth lines and Isi menu directly under the list, before the note about ticks", async () => {
      const day = kitchenDay([scheduled]);
      day.datedMenus = (day.datedMenus as unknown as { package_id: string }[]).filter((m) => m.package_id === "p-hemat") as never;
      renderToday(runtimeWith(async () => day));
      const list = await screen.findByTestId("cooking-list");
      const card = within(list).getByTestId("list-card");
      const line = within(list).getByText(/^Menu belum diisi · Makan Siang Rumahan/);
      const button = within(list).getByRole("button", { name: "Isi menu Makan Siang Rumahan" });
      const note = within(list).getByText("Centang ini cuma catatan dapur. Pelanggan tidak melihatnya.");
      expect(before(list, card, line)).toBe(true);
      expect(before(list, line, button)).toBe(true);
      expect(before(list, button, note)).toBe(true);
      expect(box(button).minHeight).toBe(48);
    });

    it("lists the packages as 40 rows ending on one right edge", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const section = await screen.findByTestId("per-package");
      expect(within(section).getByText("Per paket")).toBeTruthy();
      const rows = ["p-rumahan", "p-hemat"].map((id) => within(section).getByTestId(`per-package-${id}`));
      for (const row of rows) expect(box(row).minHeight).toBe(40);
      expect(rows[0].props.accessibilityLabel).toBe("Makan Siang Rumahan, 28 porsi");
      expect(rows[1].props.accessibilityLabel).toBe("Paket Hemat Kantor, 6 porsi");
      // The hairline between them runs the card's whole width.
      expect(box(within(section).getByTestId("list-card-separator")).marginLeft).toBe(0);
    });

    it("keeps the sections 24 apart", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      expect(box(await screen.findByTestId("session-card")).gap).toBe(24);
    });
  });

  /** The text of a node the way a screen reads it: its own string and its nested Text children, joined. */
  const textOf = (node: { props: { children?: unknown } }): string => {
    const join = (child: unknown): string =>
      Array.isArray(child)
        ? child.map(join).join("")
        : typeof child === "object" && child
          ? join((child as { props: { children?: unknown } }).props.children)
          : String(child ?? "");
    return join(node.props.children);
  };

  describe("Urutan antar", () => {
    it("heads the run with its count and Pilih, and lists 64 rows, three stops then a link", async () => {
      // Pilih is offered once a stop can leave or arrive, so the meal is cooking.
      renderToday(runtimeWith(async () => sixStops([cooking])));
      const run = await screen.findByTestId("delivery-order");
      const header = within(run).getByTestId("section-header");
      expect(within(header).getByText("Urutan antar")).toBeTruthy();
      expect(within(header).getByText("6 alamat")).toBeTruthy();
      expect(box(within(header).getByRole("button", { name: "Pilih" })).minHeight).toBe(48);
      for (const n of [1, 2, 3]) expect(box(within(run).getByTestId(`stop-${n}`)).minHeight).toBe(64);
      expect(within(run).queryByTestId("stop-4")).toBeNull();
      const more = within(run).getByRole("button", { name: "Lihat 3 alamat lainnya" });
      expect(box(more).minHeight).toBe(48);
      fireEvent.press(more);
      expect(within(run).getByTestId("stop-6")).toBeTruthy();
      expect(within(run).queryByText("Lihat 3 alamat lainnya")).toBeNull();
    });

    it("holds the map and the … in one 96 column at the same place on every row", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      await screen.findByTestId("stop-1");
      for (const n of [1, 2, 3]) {
        const row = screen.getByTestId(`stop-${n}`);
        const actions = within(row).getByTestId(`stop-${n}-actions`);
        expect(box(actions)).toMatchObject({ width: 96, flexGrow: 0, flexShrink: 0 });
        expect(within(actions).getAllByRole("button")).toHaveLength(2);
        for (const button of within(actions).getAllByRole("button")) expect(box(button)).toMatchObject({ width: 48, height: 48 });
        // A 28 order badge starts the row.
        expect(box(within(row).getByTestId(`stop-${n}-badge`))).toMatchObject({ width: 28, height: 28 });
      }
      // The hairlines start at the name: the badge and the 12 gap.
      expect(box(within(screen.getByTestId("delivery-order")).getAllByTestId("list-card-separator")[0]).marginLeft).toBe(40);
    });

    it("holds a stop to one title line (name · n porsi) and one meta line (package · address, cut at the address)", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const title = await screen.findByTestId("stop-1-title");
      expect(title.props.numberOfLines).toBe(1);
      expect(box(title)).toMatchObject({ fontSize: 17, lineHeight: 22 });
      expect(textOf(title)).toBe("Bu Sari Wulandari · 2 porsi");
      const meta = within(screen.getByTestId("stop-1")).getByTestId("stop-1-meta");
      expect(meta.props.numberOfLines).toBe(1);
      expect(box(meta)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(textOf(meta)).toMatch(/^Makan Siang Rumahan · Jl\. Melati \d+, Tebet$/);
    });

    it("keeps a row at 64 without a note and at most 84 with one, at 412 and font scale 1", async () => {
      const day = kitchenDay([scheduled]);
      day.deliveries[0].address.instructions = "Pagar hijau, titip di pos satpam";
      renderToday(runtimeWith(async () => day));
      await screen.findByTestId("stop-1");
      // Jest has no layout engine: a row is its 8 + 8 padding around the lines it holds, never under 64, and every line
      // is held to one (a line that may wrap has no height to add up).
      const height = (n: number) => {
        const row = screen.getByTestId(`stop-${n}`);
        const lines = ["title", "meta", "delivery-note"].flatMap((part) => within(row).queryAllByTestId(`stop-${n}-${part}`));
        for (const line of lines) expect(line.props.numberOfLines).toBe(1);
        return Math.max(box(row).minHeight as number, 16 + lines.reduce((sum, line) => sum + (box(line).lineHeight as number), 0));
      };
      expect(within(screen.getByTestId("stop-1")).queryByTestId("stop-1-delivery-note")).toBeTruthy();
      expect(within(screen.getByTestId("stop-2")).queryByTestId("stop-2-delivery-note")).toBeNull();
      expect(height(2)).toBe(64);
      expect(height(1)).toBeGreaterThan(64);
      expect(height(1)).toBeLessThanOrEqual(84);
    });

    it("stacks Maps and WhatsApp as two full-width 50 secondary buttons, the route caption under them", async () => {
      renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const maps = await screen.findByRole("button", { name: "Buka semua di Peta" });
      const share = screen.getByRole("button", { name: "Bagikan rute ke WhatsApp" });
      for (const button of [maps, share]) expect(box(button).minHeight).toBe(50);
      // Neither is the screen's one primary: the footer is.
      expect(box(maps).backgroundColor).toEqual(box(share).backgroundColor);
      expect(box(maps).flex).toBeUndefined();
      expect(box(share).flex).toBeUndefined();
      const caption = screen.getByText(/^Tandai Sampai dengan foto bukti/);
      expect(before(screen.getByTestId("delivery-order"), share, caption)).toBe(true);
    });
  });

  describe("after departure", () => {
    const out = { status: "out_for_delivery", cooking_started_at: cooking.cooking_started_at, departed_at: "2026-10-08T03:00:00Z" };

    it("folds the cooking part into one 48 row and starts the run under it", async () => {
      renderToday(runtimeWith(async () => kitchenDay([out])));
      const summary = await screen.findByTestId("cooked-summary");
      expect(within(summary).getByText("Sudah dimasak · 34 porsi")).toBeTruthy();
      expect(box(summary).minHeight).toBe(48);
      expect(screen.queryByText("Daftar masak")).toBeNull();
      expect(screen.queryByText("Per paket")).toBeNull();
      // The figures and the track stay in the header, and the header says it is out.
      expect(screen.getByTestId("session-figures")).toBeTruthy();
      expect(screen.getByText(/Sedang diantar/)).toBeTruthy();
      expect(screen.getByText("Urutan antar")).toBeTruthy();
    });

    it("starts Antar one row (48) and one gap (24) under where the cooking part began", async () => {
      const first = renderToday(runtimeWith(async () => kitchenDay([scheduled])));
      const card = await screen.findByTestId("session-card");
      // Before: the cooking list opens the session card, and the run is far below it.
      const topOf = (root: Node, id: string) =>
        root.findAll((n) => typeof n.type === "string").filter((n) => ["cooking-list", "cooked-summary", "delivery-order"].includes(n.props.testID));
      expect(topOf(card, "").map((n) => n.props.testID)).toEqual(["cooking-list", "delivery-order"]);
      first.unmount();
      renderToday(runtimeWith(async () => kitchenDay([out])));
      const after = await screen.findByTestId("session-card");
      // After: the summary opens it, and Antar follows it directly: 48 + the 24 section gap, not a whole list further down.
      const parts = topOf(after, "");
      expect(parts.map((n) => n.props.testID)).toEqual(["cooked-summary", "delivery-order"]);
      expect((box(parts[0]).minHeight as number) + (box(after).gap as number)).toBe(72);
    });
  });

  describe("the footer", () => {
    it("is one height from Mulai masak to Berangkat antar: the caption line keeps its room", async () => {
      let served = kitchenDay([scheduled]);
      renderToday(runtimeWith(async () => served));
      const cook = await screen.findByTestId("kitchen-action-caption");
      const cookBox = box(cook);
      const cookButton = box(screen.getByRole("button", { name: "Mulai masak" }));
      expect(cookBox.minHeight).toBe(36);
      expect(within(cook).queryByText(/notifikasi/)).toBeNull();

      served = kitchenDay([cooking]);
      fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
      await lastConfirm().press("Mulai");
      await screen.findByText("Berangkat antar · 34 porsi");
      const depart = screen.getByTestId("kitchen-action-caption");
      expect(within(depart).getByText(/notifikasi/)).toBeTruthy();
      expect(box(depart)).toEqual(cookBox);
      expect(box(screen.getByRole("button", { name: "Berangkat antar · 34 porsi" })).minHeight).toBe(cookButton.minHeight);
      expect(box(screen.getByTestId("sticky-action")).gap).toBe(8);
    });
  });

  describe("the footer note", () => {
    const texts = (slot: Node) => slot.findAll((n) => n.type === "Text").length;

    it("does not carry a Mulai masak note into the Berangkat stage: the slot holds one line group, as before", async () => {
      let served = kitchenDay([scheduled]);
      const command = jest.fn(async () => {
        // Someone else started the cooking first: nothing moved here, and the day reads again as cooking.
        served = kitchenDay([cooking]);
        return { moved: 0 };
      });
      renderToday(runtimeWith(async () => served, command));
      const cookSlot = box(await screen.findByTestId("kitchen-action-caption"));
      fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
      await lastConfirm().press("Mulai");
      await screen.findByText("Berangkat antar · 34 porsi");
      const slot = screen.getByTestId("kitchen-action-caption");
      expect(within(slot).queryByText("Sudah ditandai dimasak.")).toBeNull();
      expect(within(slot).getByText(/notifikasi/)).toBeTruthy();
      expect(texts(slot)).toBe(1);
      expect(box(slot)).toEqual(cookSlot);
    });

    it("lets a Berangkat note take the caption's place, so the slot never holds more than its reserved lines", async () => {
      const command = jest.fn(async () => ({ moved: 0 }));
      renderToday(runtimeWith(async () => kitchenDay([cooking]), command));
      const slot0 = box(await screen.findByTestId("kitchen-action-caption"));
      fireEvent.press(await screen.findByRole("button", { name: "Berangkat antar · 34 porsi" }));
      await lastConfirm().press("Berangkat");
      expect(await screen.findByText("Sudah ditandai berangkat.")).toBeTruthy();
      const slot = screen.getByTestId("kitchen-action-caption");
      expect(within(slot).queryByText(/notifikasi/)).toBeNull();
      expect(texts(slot)).toBe(1);
      expect(box(slot)).toEqual(slot0);
    });
  });

  describe("staff", () => {
    const staff = { id: "u-2", role: "staff", name: "Mbak Sari", catererId: "k-1" };
    const staffRuntime = (day: SellerOperationsState) => {
      const runtime = runtimeWith(async () => day);
      (runtime.api.me as jest.Mock).mockResolvedValue({ actor: staff, demo: false });
      return runtime;
    };

    it("sees the same header and lists, with no setup card and no Isi menu", async () => {
      renderToday(staffRuntime(kitchenDay([scheduled], { dishes: false })));
      expect(await screen.findByTestId("session-figures")).toBeTruthy();
      expect(await screen.findAllByText(/^Menu belum diisi · /)).toHaveLength(2);
      expect(screen.queryByText("Isi menu")).toBeNull();
      expect(screen.queryByText("Siapkan dapurmu")).toBeNull();
      expect(screen.getByText("Daftar masak")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Mulai masak" })).toBeTruthy();
    });

    it("never shows a new kitchen's setup card to a helper", async () => {
      const day = kitchenDay([scheduled]);
      day.deliveries = [];
      day.offers = [];
      renderToday(staffRuntime(day));
      await screen.findByText("Tidak ada yang dimasak hari ini.");
      expect(screen.queryByText("Siapkan dapurmu")).toBeNull();
      expect(screen.queryByTestId("live-slot")).toBeNull();
    });
  });
});
