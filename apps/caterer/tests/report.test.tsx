import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { useEffect } from "react";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
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

// The English test stores its locale; every test starts from a fresh store (Indonesian).
beforeEach(() => {
  jest.clearAllMocks();
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});

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

describe("Tandai selesai says what the customer will read", () => {
  const note = "Masalah ini sudah kami tangani.";

  it("with an empty field shows and sends the Indonesian note, even in English", async () => {
    const runtime = runtimeWith(report());
    show(runtime);
    expect(await screen.findByText(`Pelanggan akan menerima: “${note}”`)).toBeTruthy();
    fireEvent.press(screen.getByText("Tandai selesai"));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "deliveryIssue.resolve",
        { id: "i-1", version: 1, body: note },
        expect.any(String),
      ),
    );
  });

  it("sends the Indonesian note when the caterer uses English", async () => {
    const runtime = runtimeWith(report());
    render(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <EnglishReport />
      </MobileProvider>,
    );
    expect(await screen.findByText(`The customer will receive: “${note}”`)).toBeTruthy();
    fireEvent.press(screen.getByText("Mark as done"));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "deliveryIssue.resolve",
        { id: "i-1", version: 1, body: note },
        expect.any(String),
      ),
    );
  });

  it("with 1 to 4 characters disables both buttons and asks for at least 5", async () => {
    const runtime = runtimeWith(report());
    show(runtime);
    fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Oke");
    expect(screen.getByText("Tulis minimal 5 karakter.")).toBeTruthy();
    expect(screen.queryByText(/Pelanggan akan menerima/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tandai selesai" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Balas" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText("Tandai selesai"));
    expect(runtime.api.command).not.toHaveBeenCalled();
  });

  it("with 5 or more characters sends what was typed", async () => {
    const runtime = runtimeWith(report());
    show(runtime);
    fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Sudah diganti, maaf ya.");
    expect(screen.queryByText(/Pelanggan akan menerima/)).toBeNull();
    fireEvent.press(screen.getByText("Tandai selesai"));
    await waitFor(() =>
      expect(runtime.api.command).toHaveBeenCalledWith(
        "deliveryIssue.resolve",
        { id: "i-1", version: 1, body: "Sudah diganti, maaf ya." },
        expect.any(String),
      ),
    );
  });
});

it("reloads the report after a refused action so the next tap uses the fresh version", async () => {
  const runtime = runtimeWith(report());
  // The server answers with the old version until the refused command, then with the new one.
  let refused = false;
  (runtime.api.request as jest.Mock).mockImplementation(async () =>
    refused ? [report({ status: "responded", version: 2 })] : [report()],
  );
  (runtime.api.command as jest.Mock).mockImplementationOnce(async () => {
    refused = true;
    throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
  });
  show(runtime);
  fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Kami antar ulang sekarang.");
  fireEvent.press(screen.getByText("Balas"));
  expect(await screen.findByText("Data sudah berubah. Muat ulang sebelum mencoba lagi.")).toBeTruthy();
  // Nothing else reloads after a failed command: only the screen itself can fetch the new version.
  expect(await screen.findByText("Dibalas")).toBeTruthy();
  // The message and the typed reply survive the reload.
  expect(screen.getByText("Data sudah berubah. Muat ulang sebelum mencoba lagi.")).toBeTruthy();
  fireEvent.press(screen.getByText("Balas"));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenLastCalledWith(
      "deliveryIssue.respond",
      { id: "i-1", version: 2, body: "Kami antar ulang sekarang." },
      expect.any(String),
    ),
  );
});

function EnglishReport() {
  const { setLocale, locale } = useMobile();
  useEffect(() => {
    if (locale !== "en") setLocale("en");
  }, [locale, setLocale]);
  return locale === "en" ? <ReportScreen id="i-1" /> : null;
}
