import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { TodayScreen } from "../src/today/TodayScreen";
import { issueSteps } from "../src/today/exceptions";
import * as offline from "../src/today/offline";
import { canvasDay, emptyDay, quietDay, report } from "./fixtures";

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
  expect(await screen.findByText("34 porsi")).toBeTruthy();
  expect(screen.getByText("Makan Siang Rumahan")).toBeTruthy();
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
  expect(await screen.findByText("34 porsi")).toBeTruthy();
  expect(screen.getByText(/Terakhir diperbarui 06\.12/)).toBeTruthy();
});

it("welcomes a new caterer with the setup card instead of empty lists", async () => {
  renderToday(runtimeWith(async () => emptyDay()));
  expect(await screen.findByText("Siapkan dapur Anda")).toBeTruthy();
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
  expect(screen.getByText("Besok")).toBeTruthy();
  expect(screen.queryByText("Siapkan dapur Anda")).toBeNull();
});

it("never shows helpers the owner setup steps", async () => {
  renderToday(runtimeWith(async () => emptyDay(), { ...owner, role: "staff" }));
  expect(await screen.findByText("Tidak ada masakan untuk hari ini.")).toBeTruthy();
  expect(screen.getByText("Besok")).toBeTruthy();
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

  it("shows the date as the title", async () => {
    pinToday();
    renderToday(runtimeWith(async () => canvasDay()));
    expect(await screen.findByText("Kamis 8 Okt")).toBeTruthy();
    fireEvent.press(screen.getByText("Besok"));
    expect(await screen.findByText("Jumat 9 Okt")).toBeTruthy();
  });

  it("has a single day switch", async () => {
    renderToday(runtimeWith(async () => canvasDay()));
    await screen.findByText("34 porsi");
    const tablists = screen.UNSAFE_root.findAll(
      (n) => typeof n.type === "string" && n.props.accessibilityRole === "tablist",
    );
    expect(tablists).toHaveLength(1);
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityState.selected)).toEqual([true, false]);
    expect(screen.queryByText("Masak")).toBeNull();
    expect(screen.queryByText(/^Siang/)).toBeNull();
  });

  it("shows one card per meal session with its delivery list", async () => {
    const base = canvasDay();
    const day = {
      ...base,
      deliveries: [{ ...base.deliveries[0], portions: 1, customer: { id: "c-9", name: "Nadia Putri" } }],
    } as unknown as typeof base;
    renderToday(runtimeWith(async () => day));
    expect(await screen.findByText("Makan siang")).toBeTruthy();
    expect(screen.getByText("1 porsi")).toBeTruthy();
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
    fireEvent.press(screen.getByText("Besok"));
    expect(await screen.findByText("Tidak ada masakan untuk besok.")).toBeTruthy();
  });
});
