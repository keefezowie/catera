import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { RefreshControl, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import * as ReactNative from "react-native";
import { TodayScreen } from "../src/today/TodayScreen";
import { ExceptionSheet } from "../src/today/ExceptionSheet";
import { ReportScreen, resetReportDrafts } from "../src/today/ReportScreen";
import * as offline from "../src/today/offline";
import { canvasDay, emptyDay, report } from "./fixtures";
import { withDapurScale } from "./dapur-scale";
import { lastConfirm, lastGuard, resetSheets } from "./sheet-host";

jest.mock("expo-router", () => require("./sheet-host").routerModule);
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("../src/nav", () => ({ openLink: jest.fn(), goToTab: jest.fn() }));
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
const owner = { id: "u-1", role: "owner", name: "Bu Rina", catererId: "k-1" };
beforeEach(() => {
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
  resetReportDrafts();
  (offline.loadCachedDay as jest.Mock).mockResolvedValue(null);
  (require("expo-secure-store") as { __store: Map<string, string> }).__store.clear();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function runtimeWith(overrides: Record<string, unknown> = {}): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "d2", app: "dapur" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    sellerOperations: jest.fn(async () => {
      const d = canvasDay();
      d.operationalDate = TODAY;
      return d;
    }),
    sellerAttention: jest.fn(async () => ({ items: [], total: 0, nextCursor: null, timezone: "Asia/Jakarta" })),
    request: jest.fn(async () => []),
    command: jest.fn(async () => ({})),
    usage: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

function show(runtime: MobileRuntime, ui: React.ReactNode, { dark = false } = {}) {
  if (dark) jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
  return render(
    withDapurScale(
      <ThemeProvider storageKey="d2.theme">
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>{ui}</ToastProvider>
        </MobileProvider>
      </ThemeProvider>,
    ),
  );
}

const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const chevrons = (node: Parameters<typeof within>[0]) =>
  within(node).UNSAFE_queryAllByType(Ionicons).filter((i) => i.props.name === "chevron-forward");
const withReport = (extra: Record<string, unknown> = {}) =>
  runtimeWith({ request: jest.fn(async (p: string) => (p.startsWith("delivery-issues") ? [report(extra)] : [])) });

describe("the report page", () => {
  it("guards a typed reply like the sheet does, and sending clears it without closing the page", async () => {
    const runtime = withReport();
    show(runtime, <ReportScreen id="i-1" />);
    const field = await screen.findByLabelText("Balasan untuk pelanggan");
    expect(lastGuard()).toBeNull();
    fireEvent.changeText(field, "Sebentar lagi sampai.");
    expect(lastGuard()).toEqual({ noun: "balasan", voice: "kamu", nounEn: "reply" });
    fireEvent.press(screen.getByRole("button", { name: "Balas" }));
    expect(await screen.findByText("Balasan terkirim")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    await waitFor(() => expect(lastGuard()).toBeNull());
  });

  it("keeps a typed reply after the page is left without sending", async () => {
    const runtime = withReport();
    const first = show(runtime, <ReportScreen id="i-1" />);
    fireEvent.changeText(await screen.findByLabelText("Balasan untuk pelanggan"), "Sebentar lagi sampai.");
    first.unmount();
    show(runtime, <ReportScreen id="i-1" />);
    expect((await screen.findByLabelText("Balasan untuk pelanggan")).props.value).toBe("Sebentar lagi sampai.");
  });

  it("sets the day and meal line selectable and tabular, and the status pill fully round", async () => {
    show(withReport(), <ReportScreen id="i-1" />);
    const line = await screen.findByText("Kamis 8 Okt · Makan siang");
    expect(line.props.selectable).toBe(true);
    expect(flat(line).fontVariant).toContain("tabular-nums");
    expect(flat(screen.getByTestId("report-status")).borderRadius).toBe(999);
  });

  it("draws the WhatsApp chevron on iOS only (Jest compiles the Android build)", async () => {
    show(withReport(), <ReportScreen id="i-1" />);
    await screen.findByText("Chat WhatsApp");
    expect(chevrons(screen.getByRole("button", { name: /Chat WhatsApp/ }))).toHaveLength(0);
  });
});

describe("Hari ini", () => {
  const attentionItems = {
    items: [{ id: "a-1", kind: "payment", priority: 1, at_time: "2026-10-08T05:40:00Z", context: "Bu Sari", href: "/seller/customers" }],
    total: 1,
    nextCursor: null,
    timezone: "Asia/Jakarta",
  };

  it("draws the report and link-card chevrons on iOS only (Jest compiles the Android build)", async () => {
    show(withReport(), <TodayScreen />);
    expect(chevrons(await screen.findByRole("button", { name: "Buka laporan: Nadia Putri" }))).toHaveLength(0);
  });

  it("draws the attention link chevron on iOS only (Jest compiles the Android build)", async () => {
    show(runtimeWith({ sellerAttention: jest.fn(async () => attentionItems) }), <TodayScreen />);
    expect(chevrons(await screen.findByRole("link", { name: /Ada pembayaran yang perlu dicek/ }))).toHaveLength(0);
  });

  it.each([
    ["light", false],
    ["dark", true],
  ] as const)("steps the second and third setup tiles off their card in %s, with continuous corners", async (name, dark) => {
    show(runtimeWith({ sellerOperations: jest.fn(async () => emptyDay()) }), <TodayScreen />, { dark });
    const tile = await screen.findByRole("button", { name: /Pindahkan pelanggan lama/ });
    const palette = nativeThemes[name];
    expect(flat(tile).backgroundColor).toBe(palette.well);
    expect(flat(tile).backgroundColor).not.toBe(palette.surface);
    expect(flat(tile).borderCurve).toBe("continuous");
    expect(flat(await screen.findByRole("button", { name: /Buat paket pertama/ })).borderCurve).toBe("continuous");
  });

  it("tells a failed pull to refresh with a toast while the day stays", async () => {
    const day = canvasDay();
    day.operationalDate = TODAY;
    let down = false;
    const sellerOperations = jest.fn(async () => {
      if (down) throw new Error("offline");
      return day;
    });
    show(runtimeWith({ sellerOperations }), <TodayScreen />);
    await screen.findByTestId("session-count");
    down = true;
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    expect(await screen.findByText("Belum bisa memperbarui. Tarik lagi untuk mencoba.")).toBeTruthy();
    expect(screen.getByTestId("session-count")).toBeTruthy();
  });

  it("does not toast a pull that worked", async () => {
    show(runtimeWith(), <TodayScreen />);
    await screen.findByTestId("session-count");
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    expect(screen.queryByText("Belum bisa memperbarui. Tarik lagi untuk mencoba.")).toBeNull();
  });

  it("shows a quiet inline error, with Coba lagi, when the attention items cannot be read", async () => {
    let down = true;
    const sellerAttention = jest.fn(async () => {
      if (down) throw new Error("offline");
      return attentionItems;
    });
    show(runtimeWith({ sellerAttention }), <TodayScreen />);
    expect(await screen.findByText("Hal yang perlu dicek belum bisa dimuat.")).toBeTruthy();
    down = false;
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(screen.queryByText("Hal yang perlu dicek belum bisa dimuat.")).toBeNull());
    expect(await screen.findByRole("link", { name: /Ada pembayaran yang perlu dicek/ })).toBeTruthy();
  });
});

describe("the stop sheet", () => {
  async function open() {
    const runtime = runtimeWith();
    const d = canvasDay();
    d.operationalDate = TODAY;
    const id = d.deliveries[0].id;
    (runtime.api.sellerOperations as jest.Mock).mockResolvedValue(d);
    show(runtime, <ExceptionSheet id={id} meal="lunch" date={TODAY} />);
    await screen.findByText("Tandai gagal diantar");
    return runtime;
  }

  it("asks before marking a delivery not delivered, and sends nothing until yes", async () => {
    const runtime = await open();
    fireEvent.press(screen.getByRole("button", { name: "Tandai gagal diantar" }));
    const asked = lastConfirm();
    expect(asked.tone).toBe("danger");
    expect(asked.title).toBe("Tandai gagal diantar?");
    expect(asked.message).toMatch(/tidak dibayar/);
    expect(asked.message).toMatch(/tidak bisa dibatalkan/);
    expect(runtime.api.command).not.toHaveBeenCalled();
    await asked.press(asked.confirmLabel);
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalled());
  });

  it("sends nothing when the question is cancelled", async () => {
    const runtime = await open();
    fireEvent.press(screen.getByRole("button", { name: "Tandai gagal diantar" }));
    const asked = lastConfirm();
    await asked.press(asked.cancelLabel);
    expect(runtime.api.command).not.toHaveBeenCalled();
  });

  it("draws the option chevron on iOS only (Jest compiles the Android build)", async () => {
    await open();
    expect(chevrons(screen.getByTestId("exception-sheet"))).toHaveLength(0);
  });
});

describe("the cooked summary", () => {
  it("sets the portion count in tabular figures", async () => {
    const day = canvasDay();
    day.operationalDate = TODAY;
    day.deliveries = day.deliveries.map((x) => ({ ...x, status: "out_for_delivery", meals: [{ meal: "lunch", status: "out_for_delivery" }] })) as typeof day.deliveries;
    show(runtimeWith({ sellerOperations: jest.fn(async () => day) }), <TodayScreen />);
    const summary = await screen.findByTestId("cooked-summary");
    expect(flat(within(summary).getByText(/Sudah dimasak · \d+ porsi/))).toMatchObject({ fontVariant: expect.arrayContaining(["tabular-nums"]) });
  });
});


describe("iOS-only disclosure chevrons", () => {
  // `process.env.EXPO_OS` is compiled in, so the iOS branch is checked by reading the source.
  const read = (file: string) => require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/today", file + ".tsx"), "utf8") as string;
  it.each([
    ["LiveSlot", 2],
    ["ExceptionSheet", 1],
    ["ReportScreen", 1],
  ])("%s gates each chevron-forward icon on iOS", (file, count) => {
    const gated = read(file).match(/process\.env\.EXPO_OS === "ios" \? <DecorativeIcon name="chevron-forward"/g) ?? [];
    expect(gated).toHaveLength(count);
    expect(read(file).match(/name="chevron-forward"/g) ?? []).toHaveLength(count);
  });
  it("DeliveryOrder no longer reads Platform", () => {
    expect(read("DeliveryOrder")).not.toMatch(/Platform\.OS/);
  });
});
