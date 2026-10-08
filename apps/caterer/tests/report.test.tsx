import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ReportScreen } from "../src/today/ReportScreen";
import { report } from "./fixtures";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
const staff = { id: "u-2", role: "staff", name: "Bima", catererId: "k-1" };

function runtimeWith(issue: ReturnType<typeof report>, actor: Record<string, unknown> = owner): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "report" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    request: jest.fn(async () => [issue]),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const show = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ReportScreen id="i-1" />
    </MobileProvider>,
  );

beforeEach(() => jest.clearAllMocks());

it("shows who reported what, for which day and meal, and when", async () => {
  const runtime = runtimeWith(report());
  show(runtime);
  expect(await screen.findByText("Nadia Putri")).toBeTruthy();
  expect(runtime.api.request).toHaveBeenCalledWith("delivery-issues?id=k-1&issue=i-1");
  expect(screen.getByText("Kamis 8 Okt · Makan siang")).toBeTruthy();
  expect(screen.getByText("Rantang Nusantara")).toBeTruthy();
  expect(screen.getByText("Belum sampai")).toBeTruthy();
  expect(screen.getByText("Sudah jam satu, makanan belum datang.")).toBeTruthy();
  expect(screen.getByText("Terkirim")).toBeTruthy();
  // 05.40 UTC is 12.40 in Jakarta.
  expect(screen.getByText("Dikirim Kamis 8 Okt 12.40")).toBeTruthy();
});

it("sends the reply text with Balas", async () => {
  const runtime = runtimeWith(report());
  show(runtime);
  const balas = await screen.findByText("Balas");
  fireEvent.changeText(screen.getByLabelText("Balasan untuk pelanggan"), "Oke");
  fireEvent.press(balas);
  // Shorter than the five characters the server needs: nothing is sent.
  expect(runtime.api.command).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("Balasan untuk pelanggan"), "  Maaf, kami antar ulang sekarang.  ");
  fireEvent.press(screen.getByText("Balas"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "deliveryIssue.respond",
      { id: "i-1", version: 1, body: "Maaf, kami antar ulang sekarang." },
      expect.any(String),
    ),
  );
});

it("closes the report with Tandai selesai", async () => {
  const runtime = runtimeWith(
    report({
      status: "responded",
      version: 2,
      events: [{ id: "e-1", action: "deliveryIssue.respond", body: "Kami antar ulang jam dua.", created_at: "2026-10-08T06:00:00Z" }],
    }),
  );
  show(runtime);
  expect(await screen.findByText("Dibalas")).toBeTruthy();
  expect(screen.getByText("Kami antar ulang jam dua.")).toBeTruthy();
  fireEvent.press(screen.getByText("Tandai selesai"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "deliveryIssue.resolve",
      { id: "i-1", version: 2, body: "Masalah ini sudah kami tangani." },
      expect.any(String),
    ),
  );
});

it("lets staff answer too, as the server allows", async () => {
  const runtime = runtimeWith(report(), staff);
  show(runtime);
  fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Kurir sedang menuju ke sana.");
  fireEvent.press(screen.getByText("Tandai selesai"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "deliveryIssue.resolve",
      { id: "i-1", version: 1, body: "Kurir sedang menuju ke sana." },
      expect.any(String),
    ),
  );
});

it("opens WhatsApp with the customer when they have a number", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  show(runtimeWith(report()));
  fireEvent.press(await screen.findByText("Chat WhatsApp"));
  expect(open).toHaveBeenCalledWith("https://wa.me/6281234567001?text=");
});

it("offers no WhatsApp without a number and no actions once Catera is reviewing or it is done", async () => {
  const { unmount } = show(runtimeWith(report({ customerPhone: null, status: "escalated", case_id: "case-1" })));
  expect(await screen.findByText("Ditinjau Catera")).toBeTruthy();
  expect(screen.queryByText("Chat WhatsApp")).toBeNull();
  expect(screen.queryByText("Balas")).toBeNull();
  expect(screen.queryByText("Tandai selesai")).toBeNull();
  unmount();
  show(runtimeWith(report({ status: "resolved", version: 3 })));
  expect(await screen.findByText("Selesai")).toBeTruthy();
  expect(screen.queryByText("Balas")).toBeNull();
  expect(screen.queryByText("Tandai selesai")).toBeNull();
});
