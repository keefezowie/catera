import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Share, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { TodayScreen } from "../src/today/TodayScreen";
import { SessionCard } from "../src/today/SessionCard";
import { issueSteps } from "../src/today/exceptions";
import * as offline from "../src/today/offline";
import * as Haptics from "expo-haptics";
import { canvasDay, emptyDay, quietDay, report } from "./fixtures";
import { colors } from "@catera/mobile-ui";

const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };

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
  expect(within(card()).UNSAFE_getByType(Ionicons).props).toMatchObject({ name: "chevron-forward", size: 18, color: colors.muted });
  fireEvent.press(card());
  expect(router.push).toHaveBeenCalledWith("/laporan/i-1");
  first.unmount();

  renderToday(runtimeWith(async () => emptyDay()));
  const step = () => screen.getByRole("button", { name: /Buat paket pertama/ });
  await screen.findByText("Siapkan dapur Anda");
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ minHeight: 56, backgroundColor: colors.cream });
  fireEvent(step(), "responderGrant", touch);
  expect(StyleSheet.flatten(step().props.style)).toMatchObject({ opacity: 0.7, backgroundColor: colors.cream });
  fireEvent.press(step());
  expect(router.push).toHaveBeenCalledWith("/paket/baru");
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
        <SessionCard ops={ops} meal="lunch" date="2026-10-08" report="today" caterer="Dapur Bu Rina" />
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
  expect(await screen.findByText("34 porsi")).toBeTruthy();
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
    expect(chevrons[0].props).toMatchObject({ name: "chevron-forward", size: 18, color: colors.muted });
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
