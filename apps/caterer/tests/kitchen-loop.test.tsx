import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { errorLabel, type SellerOperationsState } from "@catera/domain";
import { MoodProvider } from "@catera/mobile-ui";
import { TodayScreen } from "../src/today/TodayScreen";
import { dishKey } from "../src/today/ticks";
import { canvasDay } from "./fixtures";

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

const TODAY = "2026-10-08";
const TOMORROW = "2026-10-09";
const YESTERDAY = "2026-10-07";
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };

type MealState = { status: string; cooking_started_at?: string | null; departed_at?: string | null };
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

const renderToday = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen />
    </MobileProvider>,
  );

const store = () => (SecureStore as unknown as { __store: Map<string, string> }).__store;

/** Answers the next confirm dialog: returns its copy and presses the button named `press`. */
function lastAlert(spy: jest.SpyInstance) {
  const [title, message, buttons] = spy.mock.calls[spy.mock.calls.length - 1];
  return {
    title: title as string,
    message: message as string,
    labels: (buttons as { text: string }[]).map((b) => b.text),
    // The dialog is native: its button runs outside React's event system, so the test wraps it as a tap would be.
    press: (text: string) =>
      act(() => {
        // Batal has no handler: the dialog just closes.
        (buttons as { text: string; onPress?: () => void }[]).find((b) => b.text === text)!.onPress?.();
      }),
  };
}

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  store().clear();
  pinToday();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  alert.mockRestore();
});

describe("the count card's rantang track", () => {
  it("says Terjadwal for a meal nobody started, and Dimasak 08.10 once the kitchen did", async () => {
    let served = kitchenDay([scheduled]);
    const runtime = runtimeWith(async () => served);
    renderToday(runtime);
    const card = await screen.findByTestId("session-count");
    expect(within(card).getByTestId("rantang-track")).toBeTruthy();
    expect(within(card).getByText("Terjadwal")).toBeTruthy();
    // The three stop labels are decoration for the eye; a screen reader gets the caption.
    const hidden = { includeHiddenElements: true };
    expect(within(card).getByText("Dimasak", hidden)).toBeTruthy();
    expect(within(card).getByText("Diantar", hidden)).toBeTruthy();
    expect(within(card).getByText("Sampai", hidden)).toBeTruthy();

    served = kitchenDay([cooking]);
    fireEvent.press(await screen.findByText("Mulai masak"));
    lastAlert(alert).press("Mulai");
    expect(await within(screen.getByTestId("session-count")).findByText("Dimasak 08.10")).toBeTruthy();
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
    expect(screen.getByText("Centang hanya catatan dapur, tidak dikirim ke pelanggan.")).toBeTruthy();
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
    lastAlert(alert).press("Mulai");
    await screen.findByText("Berangkat antar · 34 porsi");
    for (const box of screen.getAllByRole("checkbox")) fireEvent.press(box);
    const depart = screen.getByRole("button", { name: "Berangkat antar · 34 porsi" });
    expect(depart.props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(depart);
    expect(alert).toHaveBeenCalledTimes(2);
  });
});

describe("Mulai masak", () => {
  it("asks first, then sends delivery.cook for today and the meal, with a success haptic and a count", async () => {
    const command = jest.fn(async () => ({ moved: 4 }));
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    const dialog = lastAlert(alert);
    expect(dialog.title).toBe("Mulai masak makan siang?");
    expect(dialog.message).toBe("Pelanggan melihat status Dimasak.");
    expect(dialog.labels).toEqual(["Batal", "Mulai"]);
    // Nothing is sent before the answer, and Batal sends nothing at all.
    expect(command).not.toHaveBeenCalled();
    dialog.press("Batal");
    expect(command).not.toHaveBeenCalled();

    dialog.press("Mulai");
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
    const dialog = lastAlert(alert);
    expect(dialog.title).toBe("Mulai masak makan malam?");
    dialog.press("Mulai");
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
    // The session is as far along as its least advanced row.
    expect(within(screen.getByTestId("session-count")).getByText("Terjadwal")).toBeTruthy();
  });

  it("answers an INVALID_DATE with a plain, selectable line in the footer and reads the day again", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("INVALID_DATE"), { code: "INVALID_DATE" });
    });
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    lastAlert(alert).press("Mulai");
    const line = await screen.findByText("Hanya bisa untuk hari ini.");
    expect(line.props.selectable).toBe(true);
    expect(within(screen.getByTestId("screen-footer")).getByText("Hanya bisa untuk hari ini.")).toBeTruthy();
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
    lastAlert(alert).press("Mulai");
    const line = await within(await screen.findByTestId("screen-footer")).findByText(errorLabel("REQUEST_TIMEOUT", "id"));
    expect(line.props.selectable).toBe(true);
  });

  it("sends one command for a double press while it runs", async () => {
    let release: (v: unknown) => void = () => undefined;
    const command = jest.fn(() => new Promise((resolve) => (release = resolve)));
    renderToday(runtimeWith(async () => kitchenDay([scheduled]), command));
    const start = await screen.findByRole("button", { name: "Mulai masak" });
    fireEvent.press(start);
    lastAlert(alert).press("Mulai");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    // The same dialog answered twice, and the footer pressed again, still make one command.
    lastAlert(alert).press("Mulai");
    fireEvent.press(screen.getByRole("button", { name: "Mulai masak" }));
    expect(screen.getByRole("button", { name: "Mulai masak" }).props.accessibilityState?.disabled).toBe(true);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledTimes(1);
    await act(async () => release({ moved: 4 }));
  });

  it("stays quiet when the late tap moved nothing: no success buzz, no count, a plain line", async () => {
    const command = jest.fn(async () => ({ moved: 0 }));
    const runtime = runtimeWith(async () => kitchenDay([scheduled]), command);
    renderToday(runtime);
    fireEvent.press(await screen.findByText("Mulai masak"));
    lastAlert(alert).press("Mulai");
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
    const dialog = lastAlert(alert);
    expect(dialog.title).toBe("Berangkat antar sekarang?");
    expect(dialog.labels).toEqual(["Batal", "Berangkat"]);
    dialog.press("Berangkat");
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
    expect(await screen.findByText("4 antaran makan siang ditandai Gagal diantar.")).toBeTruthy();
    expect(screen.queryByText("Tidak ada antaran makan siang.")).toBeNull();
    expect(screen.queryByText("Tidak ada masakan untuk hari ini.")).toBeNull();
    // Nothing is cooking, so there is no count card, checklist or footer action.
    expect(screen.queryByTestId("session-count")).toBeNull();
    expect(screen.queryByTestId("screen-footer")).toBeNull();
  });

  it("counts only the real failed rows, and says delivery for one in English", async () => {
    const runtime = runtimeWith(async () => kitchenDay([{ status: "issue" }, { status: "cancelled" }]));
    store().set(runtime.storageKey("locale"), "en");
    renderToday(runtime);
    expect(await screen.findByText("1 lunch delivery marked as failed.")).toBeTruthy();
  });

  it("still offers the other meal when it has a session", async () => {
    const day = kitchenDay([{ status: "issue" }]);
    day.deliveries[3].meals.push({ meal: "dinner", status: "scheduled" } as never);
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByText("4 antaran makan siang ditandai Gagal diantar.")).toBeTruthy();
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
