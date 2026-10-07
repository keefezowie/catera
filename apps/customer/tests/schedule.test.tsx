import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
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

describe("Jadwal", () => {
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
    const today = screen.getByRole("button", { name: "Rabu 7 Oktober" });
    const other = screen.getByRole("button", { name: "Kamis 8 Oktober" });
    // Today starts selected; every day is at least a 44pt target.
    expect(today.props.accessibilityState.selected).toBe(true);
    expect(other.props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(other.props.style).minHeight).toBeGreaterThanOrEqual(44);
    fireEvent.press(other);
    expect(screen.getByRole("button", { name: "Kamis 8 Oktober" }).props.accessibilityState.selected).toBe(true);
    const old = StyleSheet.flatten(screen.getByRole("button", { name: "Rabu 7 Oktober" }).props.style);
    expect(old.borderColor).toBe(colors.sunrise);
    expect(old.borderWidth).toBe(1.5);
    expect(old.backgroundColor).toBe(colors.cream);
    const selected = StyleSheet.flatten(screen.getByRole("button", { name: "Kamis 8 Oktober" }).props.style);
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
    fireEvent.press(await screen.findByRole("button", { name: "Kamis 8 Oktober" }));
    const row = screen.getByRole("button", { name: /Makan Siang Rumahan/ });
    expect(within(row).getByText(/Makan siang · 11\.00–13\.00/)).toBeTruthy();
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith("/hari/d-next");
  });

  it("legend shows planned and arrived only", async () => {
    renderWith(runtimeWith(month), <Jadwal />);
    expect(await screen.findByText("Diantar")).toBeTruthy();
    expect(screen.getByText("Sudah sampai")).toBeTruthy();
    expect(screen.queryByText("Dipindah")).toBeNull();
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
    expect(screen.getByText("Bisa diubah sampai 17.00")).toBeTruthy();
  });

  it("moves a day with the chosen date", async () => {
    const command = jest.fn(async () => ({}));
    const runtime = runtimeWith(stateOf([flexible]), available, command);
    renderSheet(flexible, runtime);
    expect(await screen.findByText("Bisa diubah sampai 17.00")).toBeTruthy();
    expect(runtime.api.deliveryAvailability).toHaveBeenCalledWith("d-1", "2026-10-07", "2026-11-06");
    // Unavailable dates are listed and disabled, with the reason.
    expect(await screen.findByText("Katering penuh")).toBeTruthy();
    expect(screen.getByText("Sudah ada pengantaran")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Selasa 20 Okt/ }).props.accessibilityState.disabled).toBe(true);
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
    expect(await screen.findByText("Bisa diubah sampai 17.00")).toBeTruthy();
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
