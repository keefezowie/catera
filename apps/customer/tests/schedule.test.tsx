import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { colors } from "@catera/mobile-ui";
import type { Address, CustomerState, Delivery } from "@catera/domain";
import { Jadwal } from "../src/schedule/Jadwal";
import { ChangeDaySheet } from "../src/schedule/ChangeDaySheet";
import { DayScreen } from "../src/schedule/DayScreen";
import { customerLink } from "../src/links";
import { delivery, offer, subscription } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
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
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

// Wednesday 7 October 2026, 10.00 in Jakarta. Only Date is frozen so async code keeps working.
const NOW = new Date("2026-10-07T03:00:00Z");
beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      "hrtime",
    ],
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const home: Address = {
  id: "a-1",
  label: "Kantor",
  line: "Jl. Contoh No. 1",
  area: "Tebet",
  city: "Jakarta Selatan",
  instructions: "",
  version: 1,
};
const rumah: Address = { ...home, id: "a-2", label: "Rumah", line: "Jl. Mawar No. 9" };
const jauh: Address = { ...home, id: "a-3", label: "Villa", line: "Jl. Jauh No. 3", area: "Bogor" };

type Availability = { date: string; available: boolean; reason: string | null; remaining: number }[];

function runtimeWith(
  state: CustomerState | (() => Promise<CustomerState>),
  availability: Availability = [],
  command: jest.Mock = jest.fn(async () => ({})),
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(typeof state === "function" ? state : async () => state),
    deliveryAvailability: jest.fn(async () => availability),
    command,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );

const stateOf = (deliveries: Delivery[], addresses: Address[] = [home, rumah, jauh]): CustomerState => ({
  subscriptions: [subscription()],
  deliveries,
  addresses,
  notifications: [],
  cases: [],
});

// Cutoff 17.00 on the day before service: 2026-10-07T10:00Z. It is 10.00 WIB on the 7th, so still open.
const open = (id: string, date: string, extra: Partial<Delivery> = {}) => delivery(id, date, {}, extra);

/** A day button by its date, whatever coverage its label then names. */
const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };
const dayButton = (date: string) => screen.getByRole("button", { name: new RegExp(`^${date}(,|$)`) });

describe("Jadwal", () => {
  // Dinner is stored before lunch on the 9th, to prove the list orders by meal and not by storage.
  const coverage = stateOf([
    delivery("d-both", "2026-10-09", {}, {
      offer: offer({ name: "Salmon Teriyaki dan Ayam Panggang" }),
      meals: [
        { meal: "dinner", status: "scheduled" },
        { meal: "lunch", status: "scheduled" },
      ],
    }),
    delivery("d-dinner", "2026-10-10", {}, { meals: [{ meal: "dinner", status: "scheduled" }] }),
    delivery("d-lunch-done", "2026-10-12", { status: "delivered" }),
    delivery("d-both-done", "2026-10-13", {}, {
      meals: [
        { meal: "lunch", status: "delivered" },
        { meal: "dinner", status: "delivered" },
      ],
    }),
  ]);
  const month = stateOf([
    delivery("d-arrived", "2026-10-07", { status: "delivered" }),
    open("d-next", "2026-10-08"),
    open("d-later", "2026-10-12"),
  ]);

  it("month grid marks today and selected day", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    expect(await screen.findByText("Oktober 2026")).toBeTruthy();
    // Weekday header is Monday first.
    expect(screen.getAllByText(/^(Sen|Sel|Rab|Kam|Jum|Sab|Min)$/).map((n) => n.props.children)).toEqual([
      "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min",
    ]);
    const today = dayButton("Rabu 7 Oktober");
    const other = dayButton("Kamis 8 Oktober");
    // Today starts selected; every day is at least a 44pt target.
    expect(today.props.accessibilityState.selected).toBe(true);
    expect(other.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(other.props.style).minHeight).toBeGreaterThanOrEqual(44);
    fireEvent.press(other);
    expect(dayButton("Kamis 8 Oktober").props.accessibilityState.selected).toBe(true);
    // Today keeps its ring, in the readable Sunrise ink; its day is covered, so it also carries the scheduled background.
    const old = StyleSheet.flatten(dayButton("Rabu 7 Oktober").props.style);
    expect(old.borderColor).toBe(colors.sunriseInk);
    expect(old.borderWidth).toBe(1.5);
    expect(old.backgroundColor).toBe(colors.scheduled);
    const selected = StyleSheet.flatten(dayButton("Kamis 8 Oktober").props.style);
    expect(selected.backgroundColor).toBe(colors.forest);
  });

  it("loads the shown month by Jakarta dates", async () => {
    const runtime = runtimeWith(month);
    renderWith(runtime, <Jadwal />);
    await screen.findByText("Oktober 2026");
    expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-10-01&to=2026-10-31");
  });

  it("lists the selected day's meals and opens one", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await screen.findByText("Oktober 2026");
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    expect(within(row).getByText(/Makan siang · 11\.00–13\.00/)).toBeTruthy();
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/hari/d-next");
  });

  it("legend names lunch, dinner and arrived", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    expect(await screen.findByText("Makan siang")).toBeTruthy();
    expect(screen.getByText("Makan malam")).toBeTruthy();
    expect(screen.getByText("Sudah sampai")).toBeTruthy();
    expect(screen.queryByText("Diantar")).toBeNull();
    expect(screen.queryByText("Dipindah")).toBeNull();
  });

  it("sun icon and legend use sunriseInk", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await screen.findByText("Makan siang");
    const legend = (id: string) => within(screen.getByTestId(id)).UNSAFE_getByType(Ionicons).props.color;
    expect(legend("legend-lunch")).toBe(colors.sunriseInk);
    expect(legend("legend-dinner")).toBe(colors.forest);
    expect(legend("legend-arrived")).toBe(colors.muted);
  });

  it("month arrows give haptic feedback at 48dp", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    const next = await screen.findByRole("button", { name: "Bulan berikutnya" });
    const flat = StyleSheet.flatten(next.props.style);
    expect([flat.width, flat.height]).toEqual([48, 48]);
    fireEvent.press(next);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    fireEvent.press(await screen.findByRole("button", { name: "Bulan sebelumnya" }));
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it("day cells and meal rows dim on press without losing their state", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    await screen.findByText("Oktober 2026");
    const cell = () => dayButton("Kamis 8 Oktober");
    fireEvent(cell(), "responderGrant", touch);
    expect(StyleSheet.flatten(cell().props.style).opacity).toBe(0.7);
    expect(cell().props.accessibilityState.selected).toBe(false);
    fireEvent.press(cell());
    // A selected cell keeps its fill while pressed.
    expect(StyleSheet.flatten(cell().props.style)).toMatchObject({ opacity: 0.7, backgroundColor: colors.forest });
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    fireEvent(row, "responderGrant", touch);
    expect(StyleSheet.flatten(screen.getByRole("button", { name: /Makan Siang Rumahan/ }).props.style).opacity).toBe(0.7);
  });

  it("says a meal the caterer could not deliver was not delivered, and marks no coverage", async () => {
    const failed = stateOf([delivery("d-failed", "2026-10-06", { status: "issue" })]);
    renderWith(runtimeWith(failed), <Jadwal />);
    await screen.findByText("Oktober 2026");
    fireEvent.press(dayButton("Selasa 6 Oktober"));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    expect(within(row).getByText(/Tidak bisa diantar/)).toBeTruthy();
    // The day looks like a day without deliveries: no coverage in its label, background or icons.
    const cell = dayButton("Selasa 6 Oktober");
    expect(cell.props.accessibilityLabel).toBe("Selasa 6 Oktober");
    expect(within(cell).UNSAFE_queryAllByType(Ionicons)).toHaveLength(0);
    expect(StyleSheet.flatten(cell.props.style).backgroundColor).not.toBe(colors.scheduled);
    expect(StyleSheet.flatten(dayButton("Senin 5 Oktober").props.style).backgroundColor).toBeUndefined();
  });

  it("labels a covered day with its meals", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    expect(await screen.findByLabelText(/Jumat 9 Oktober, makan siang dan malam/)).toBeTruthy();
    expect(screen.getByLabelText("Sabtu 10 Oktober, makan malam")).toBeTruthy();
    expect(screen.getByLabelText("Senin 12 Oktober, makan siang, sudah sampai")).toBeTruthy();
    expect(screen.getByLabelText("Selasa 13 Oktober, makan siang dan malam, sudah sampai")).toBeTruthy();
    expect(screen.getByLabelText("Minggu 11 Oktober")).toBeTruthy();
  });

  it("marks coverage with a sun for lunch and a moon for dinner, muted once arrived", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await screen.findByText("Oktober 2026");
    const icons = (name: string) =>
      within(dayButton(name))
        .UNSAFE_queryAllByType(Ionicons)
        .map((i) => ({ name: i.props.name, size: i.props.size, color: i.props.color }));
    expect(icons("Jumat 9 Oktober")).toEqual([
      { name: "sunny", size: 12, color: colors.sunriseInk },
      { name: "moon", size: 11, color: colors.forest },
    ]);
    expect(icons("Sabtu 10 Oktober")).toEqual([{ name: "moon", size: 11, color: colors.forest }]);
    expect(icons("Minggu 11 Oktober")).toEqual([]);
    // Arrived days drop the colour cue.
    expect(icons("Selasa 13 Oktober")).toEqual([
      { name: "sunny", size: 12, color: colors.muted },
      { name: "moon", size: 11, color: colors.muted },
    ]);
    expect(StyleSheet.flatten(dayButton("Jumat 9 Oktober").props.style).backgroundColor).toBe(colors.scheduled);
    // Selected keeps the forest fill with cream icons.
    fireEvent.press(dayButton("Jumat 9 Oktober"));
    expect(StyleSheet.flatten(dayButton("Jumat 9 Oktober").props.style).backgroundColor).toBe(colors.forest);
    expect(icons("Jumat 9 Oktober").map((i) => i.color)).toEqual([colors.cream, colors.cream]);
  });

  it("lists lunch before dinner on a day with both", async () => {
    renderWith(runtimeWith(coverage), <Jadwal />);
    await screen.findByText("Oktober 2026");
    fireEvent.press(dayButton("Jumat 9 Oktober"));
    const rows = screen
      .getAllByRole("button")
      .filter((b) => /, Makan (siang|malam) · /.test(b.props.accessibilityLabel ?? ""));
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText(/Makan siang/)).toBeTruthy();
    expect(within(rows[1]).getByText(/Makan malam/)).toBeTruthy();
  });

  it("shows a day whose meals list is missing without failing", async () => {
    const bare = stateOf([{ ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery]);
    renderWith(runtimeWith(bare), <Jadwal />);
    expect(await screen.findByText("Oktober 2026")).toBeTruthy();
    fireEvent.press(dayButton("Kamis 8 Oktober"));
    expect(screen.getByText("Tidak ada pengantaran di hari ini.")).toBeTruthy();
  });

  it("moves to the next month and loads it", async () => {
    const runtime = runtimeWith(month);
    renderWith(runtime, <Jadwal />);
    fireEvent.press(await screen.findByRole("button", { name: "Bulan berikutnya" }));
    expect(await screen.findByText("November 2026")).toBeTruthy();
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledWith("?from=2026-11-01&to=2026-11-30"));
  });
});

describe("Ubah hari sheet", () => {
  const available: Availability = [
    { date: "2026-10-19", available: true, reason: null, remaining: 4 },
    { date: "2026-10-20", available: false, reason: "CAPACITY", remaining: 0 },
    { date: "2026-10-21", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
  ];
  const flexible = open("d-1", "2026-10-08", { version: 3, catererPhone: "+6281200000001" } as Partial<Delivery>);
  const renderSheet = (d: Delivery, runtime: MobileRuntime) =>
    renderWith(runtime, <ChangeDaySheet delivery={d} addresses={[home, rumah, jauh]} onClose={jest.fn()} />);

  it("hides Pindah tanggal for a fixed package", async () => {
    const fixed = open("d-1", "2026-10-08", { canChange: false, offer: offer({ flexible: false }) });
    renderSheet(fixed, runtimeWith(stateOf([fixed])));
    expect(await screen.findByText("Ganti alamat")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    expect(screen.getByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
  });

  it("moves a day with the chosen date", async () => {
    const command = jest.fn(async () => ({}));
    const runtime = runtimeWith(stateOf([flexible]), available, command);
    renderSheet(flexible, runtime);
    expect(await screen.findByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
    expect(runtime.api.deliveryAvailability).toHaveBeenCalledWith("d-1", "2026-10-07", "2026-11-06");
    // Unavailable dates are listed and disabled, with the reason.
    const full = await screen.findByRole("button", { name: "Selasa 20 Okt, Katering penuh" });
    expect(full.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Rabu 21 Okt, Sudah ada pengantaran" }).props.accessibilityState.disabled).toBe(true);
    // Confirm waits for a choice.
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Senin 19 Okt" }));
    expect(
      screen.getByText("Tempat di hari baru dipesan dulu, baru Kamis 8 Okt dilepas. Dapur Contoh otomatis tahu."),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.reschedule",
        { id: "d-1", version: 3, date: "2026-10-19", kind: "reschedule" },
        expect.any(String),
      ),
    );
  });

  it("shows bookable dates as chips and picks one", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const chip = await screen.findByRole("button", { name: /Senin 12 Okt/ });
    expect(chip.props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(chip);
    expect(screen.getByRole("button", { name: "Senin 12 Okt" }).props.accessibilityState.selected).toBe(true);
    // The long label of the chosen day appears under the strip.
    expect(within(screen.getByTestId("chosen-day")).getByText("Senin 12 Okt")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pindah ke Senin 12 Okt" }).props.accessibilityState.disabled).toBe(false);
  });

  it("marks a full date as unavailable", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: true, reason: null, remaining: 4 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const chip = await screen.findByRole("button", { name: /Selasa 13 Okt, Katering penuh/ });
    expect(chip.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(chip);
    expect(screen.getByRole("button", { name: "Pilih tanggal" }).props.accessibilityState.disabled).toBe(true);
  });

  it("shows why a date is unavailable", async () => {
    const dates: Availability = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), dates));
    const full = await screen.findByRole("button", { name: /Selasa 13 Okt, Katering penuh/ });
    expect(within(full).getByText("Penuh")).toBeTruthy();
    const taken = screen.getByRole("button", { name: /Senin 12 Okt, Sudah ada pengantaran/ });
    expect(within(taken).getByText("Terisi")).toBeTruthy();
  });

  it("shows the empty message when no date is bookable", async () => {
    renderSheet(flexible, runtimeWith(stateOf([flexible]), []));
    expect(await screen.findByText("Belum ada tanggal yang tersedia dalam 30 hari ke depan.")).toBeTruthy();
  });

  it("shows the empty message when every date is unavailable", async () => {
    const full = [
      { date: "2026-10-12", available: false, reason: "DUPLICATE_DATE", remaining: 3 },
      { date: "2026-10-13", available: false, reason: "CAPACITY", remaining: 0 },
    ];
    renderSheet(flexible, runtimeWith(stateOf([flexible]), full));
    expect(await screen.findByText("Belum ada tanggal yang tersedia dalam 30 hari ke depan.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Selasa 13 Okt, Katering penuh/ })).toBeTruthy();
  });

  it("changes the address for one day", async () => {
    const command = jest.fn(async () => ({}));
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByRole("tab", { name: "Ganti alamat" }));
    // The current address and one outside the caterer's area cannot be chosen.
    expect(screen.getByRole("button", { name: /Kantor/ }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Villa/ }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: /Rumah/ }));
    expect(screen.getByText("Hanya untuk Kamis 8 Okt. Hari lain tetap ke Kantor.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Antar ke Rumah" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.address",
        { id: "d-1", version: 3, addressId: "a-2" },
        expect.any(String),
      ),
    );
  });

  it("after cutoff offers only chat", async () => {
    const late = open("d-1", "2026-10-07", { catererPhone: "+6281200000001" } as Partial<Delivery>);
    const runtime = runtimeWith(stateOf([late]), available);
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderSheet(late, runtime);
    expect(await screen.findByText("Hari ini sudah tidak bisa diubah")).toBeTruthy();
    expect(screen.queryByText("Pindah tanggal")).toBeNull();
    expect(screen.queryByText("Ganti alamat")).toBeNull();
    expect(screen.queryByRole("button", { name: /Pindah ke|Antar ke/ })).toBeNull();
    expect(runtime.api.deliveryAvailability).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Chat katering" }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/6281200000001"));
  });

  it.each(["CAPACITY", "FULL"])("says the day is full when the server answers %s", async (code) => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error(code), { code });
    });
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Hari itu sudah penuh. Pilih tanggal lain.")).toBeTruthy();
  });

  it("explains other failures with the shared label", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
    });
    renderSheet(flexible, runtimeWith(stateOf([flexible]), available, command));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Data sudah berubah. Muat ulang sebelum mencoba lagi.")).toBeTruthy();
  });

  it("sends the version captured on open and stops when the day changed underneath", async () => {
    const command = jest.fn(async () => ({}));
    const runtime = runtimeWith(stateOf([flexible]), available, command);
    const ui = (d: Delivery) => (
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <ChangeDaySheet delivery={d} addresses={[home, rumah, jauh]} onClose={jest.fn()} />
      </MobileProvider>
    );
    const view = render(ui(flexible));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    // The live day moves to version 4 while the sheet is open.
    view.rerender(ui({ ...flexible, version: 4 }));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Detail hari ini berubah. Periksa lagi.")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    // Checked again: the next confirm sends the new version.
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "delivery.reschedule",
        { id: "d-1", version: 4, date: "2026-10-19", kind: "reschedule" },
        expect.any(String),
      ),
    );
    expect(screen.queryByText("Detail hari ini berubah. Periksa lagi.")).toBeNull();
  });

  it("does not send once the cutoff passes while the sheet is open", async () => {
    const command = jest.fn(async () => ({}));
    const closing = open("d-1", "2026-10-08", { cutoff_at: "2026-10-07T03:00:01Z" });
    renderSheet(closing, runtimeWith(stateOf([closing]), available, command));
    fireEvent.press(await screen.findByRole("button", { name: "Senin 19 Okt" }));
    jest.setSystemTime(new Date("2026-10-07T03:00:05Z"));
    fireEvent.press(screen.getByRole("button", { name: "Pindah ke Senin 19 Okt" }));
    expect(await screen.findByText("Batas perubahan sudah lewat. Pilih tanggal berikutnya.")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    jest.setSystemTime(NOW);
  });
});

describe("Hari", () => {
  it("opens the change sheet from the day", async () => {
    mockParams = { id: "d-next" };
    const d = open("d-next", "2026-10-08");
    renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    expect(await screen.findByText(/Makan Siang Rumahan/)).toBeTruthy();
    expect(screen.getByText(/Kamis 8 Okt/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Ubah hari" }));
    expect(await screen.findByText("Bisa diubah sampai hari ini 17.00")).toBeTruthy();
  });
});

describe("Hari: Ada masalah", () => {
  // NOW is Wednesday 7 Oct, 10.00 in Jakarta; the lunch window opens at 11.00.
  const report = () => screen.queryByRole("button", { name: "Ada masalah" });
  const show = async (d: Delivery) => {
    mockParams = { id: d.id };
    const view = renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    await screen.findByText(/Makan Siang Rumahan/);
    return view;
  };

  it("is not offered for a future day", async () => {
    await show(open("d-next", "2026-10-18"));
    expect(report()).toBeNull();
  });

  it("is not offered today before the window opens", async () => {
    await show(open("d-today", "2026-10-07"));
    expect(report()).toBeNull();
  });

  it("is not offered for a cancelled meal", async () => {
    const d = delivery("d-today", "2026-10-07", {}, {
      meals: [
        { meal: "lunch", status: "cancelled" },
        { meal: "dinner", status: "scheduled" },
      ],
      offer: offer({ windows: { lunch: "08.00–09.00", dinner: "17.00–19.00" } }),
    });
    await show(d);
    expect(report()).toBeNull();
  });

  it("is offered today once the meal is on its way, and opens the report for that meal", async () => {
    await show(delivery("d-today", "2026-10-07", { status: "out_for_delivery" }));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch");
  });

  it("is offered today once the window has started", async () => {
    await show(open("d-today", "2026-10-07", { offer: offer({ windows: { lunch: "09.30–11.00", dinner: "17.00–19.00" } }) }));
    expect(report()).toBeTruthy();
  });

  it("opens the meal that has no open report yet, and hides when every meal has one", async () => {
    const both = (lunchIssue: string | null, dinnerIssue: string | null) =>
      delivery("d-today", "2026-10-07", {}, {
        meals: [
          { meal: "lunch", status: "out_for_delivery", issue: lunchIssue ? { id: "i-1", status: lunchIssue } : null },
          { meal: "dinner", status: "out_for_delivery", issue: dinnerIssue ? { id: "i-2", status: dinnerIssue } : null },
        ],
      });
    let view = await show(both("open", null));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
    view.unmount();
    // A resolved report can be followed by a new one.
    view = await show(both("responded", "resolved"));
    fireEvent.press(report()!);
    expect(router.push).toHaveBeenLastCalledWith("/masalah/d-today?meal=dinner");
    view.unmount();
    await show(both("open", "escalated"));
    expect(report()).toBeNull();
  });

  it("is offered for yesterday's delivered meal", async () => {
    await show(delivery("d-past", "2026-10-06", { status: "delivered" }));
    expect(report()).toBeTruthy();
  });
});

describe("Hari without a meals list", () => {
  it("still shows the day", async () => {
    mockParams = { id: "d-bare" };
    const bare = { ...open("d-bare", "2026-10-08"), meals: null } as unknown as Delivery;
    renderWith(runtimeWith(stateOf([bare])), <DayScreen />);
    expect(await screen.findByText(/Makan Siang Rumahan/)).toBeTruthy();
  });
});

describe("Hari Chat katering", () => {
  it("opens WhatsApp from the day, and hides the chat without a number", async () => {
    mockParams = { id: "d-next" };
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const d = open("d-next", "2026-10-08", { catererPhone: "+6281200000001" } as Partial<Delivery>);
    const view = renderWith(runtimeWith(stateOf([d])), <DayScreen />);
    fireEvent.press(await screen.findByRole("button", { name: "Chat katering" }));
    expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
    view.unmount();
    renderWith(runtimeWith(stateOf([open("d-next", "2026-10-08")])), <DayScreen />);
    await screen.findByText(/Makan Siang Rumahan/);
    expect(screen.queryByRole("button", { name: "Chat katering" })).toBeNull();
  });
});

describe("signed out", () => {
  it("Jadwal asks to sign in and comes back to /jadwal", async () => {
    const runtime = runtimeWith(stateOf([]));
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    renderWith(runtime, <Jadwal />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/jadwal" } });
    expect(runtime.api.customer).not.toHaveBeenCalled();
  });
});

describe("legacy calendar links", () => {
  it("opens Jadwal from the old /calendar href", () => {
    expect(customerLink("/calendar")).toBe("/jadwal");
  });
});
