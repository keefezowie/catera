import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { TodayScreen } from "../src/today/TodayScreen";
import { issueSteps } from "../src/today/exceptions";
import * as offline from "../src/today/offline";
import { canvasDay, emptyDay, quietDay } from "./fixtures";

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
  fireEvent.press(await screen.findByText("Antar"));
  fireEvent.press(await screen.findByText("Bagikan rute ke WhatsApp"));
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(share.mock.calls[0][0]).toEqual(
    expect.objectContaining({ message: expect.stringMatching(/^\*Antar siang/) }),
  );
});

it("reports a failed delivery by stepping it to the issue status", async () => {
  const runtime = runtimeWith(async () => canvasDay());
  renderToday(runtime);
  fireEvent.press(await screen.findByText("Antar"));
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
  expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
  expect(screen.getByText("Besok")).toBeTruthy();
  expect(screen.queryByText("Siapkan dapur Anda")).toBeNull();
});

it("never shows helpers the owner setup steps", async () => {
  renderToday(runtimeWith(async () => emptyDay(), { ...owner, role: "staff" }));
  expect(await screen.findByText("Tidak ada yang dimasak hari ini.")).toBeTruthy();
  expect(screen.getByText("Besok")).toBeTruthy();
  expect(screen.queryByText("Siapkan dapur Anda")).toBeNull();
});

it("moves a customer's day from Besok while the cutoff is still ahead", async () => {
  const day = canvasDay();
  const d = day.deliveries.find((x) => x.customer.name === "Keluarga Hartono")!;
  Object.assign(d, { cutoff_at: "2099-01-01T10:00:00Z", customer: { ...d.customer, recordId: "cr-1" } });
  const runtime = runtimeWith(async () => day);
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(Date.now() + 86400000));
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <TodayScreen date={tomorrow} />
    </MobileProvider>,
  );
  fireEvent.press(await screen.findByText("Antar"));
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
  fireEvent.press(await screen.findByText("Antar"));
  fireEvent.press(await screen.findByLabelText("Ada masalah: Keluarga Hartono"));
  expect(await screen.findByText(/tidak dihitung terkirim/)).toBeTruthy();
  expect(screen.queryByText(/pengembalian dana diurus Catera/)).toBeNull();
});
