import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { CustomerActionItem, CustomerState, SupportCase } from "@catera/domain";
import { ReportProblem } from "../src/help/ReportProblem";
import { ReportList } from "../src/help/ReportList";
import { customerLink } from "../src/links";
import { customerState, TODAY } from "./fixtures";

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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

type Issue = {
  id: string;
  status: "open" | "responded" | "resolved" | "escalated";
  version: number;
  case_id: string | null;
  meal: "lunch" | "dinner";
  subject: string;
  service_date: string;
  package_name: string;
  events: { id: string; action: string; body: string; created_at: string }[];
};
const issue = (extra: Partial<Issue> = {}): Issue => ({
  id: "i-1",
  status: "open",
  version: 1,
  case_id: null,
  meal: "lunch",
  subject: "Belum sampai",
  service_date: TODAY,
  package_name: "Makan Siang Rumahan",
  events: [{ id: "e-1", action: "deliveryIssue.create", body: "Belum datang", created_at: `${TODAY}T05:00:00Z` }],
  ...extra,
});
const reply = {
  id: "e-2",
  action: "deliveryIssue.respond",
  body: "Kurir sedang di jalan, 15 menit lagi.",
  created_at: `${TODAY}T05:20:00Z`,
};

function runtimeWith(
  opts: {
    state?: CustomerState;
    issues?: Issue[];
    actions?: CustomerActionItem[];
    command?: jest.Mock;
  } = {},
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: customer, demo: false })),
    customer: jest.fn(async () => opts.state ?? customerState({ status: "out_for_delivery" })),
    customerActions: jest.fn(async () => ({ total: (opts.actions ?? []).length, items: opts.actions ?? [] })),
    request: jest.fn(async () => opts.issues ?? []),
    command: opts.command ?? jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {ui}
    </MobileProvider>,
  );
const withPhone = (state: CustomerState): CustomerState => ({
  ...state,
  deliveries: state.deliveries.map((d) => ({ ...d, catererPhone: "+6281200000001" })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe("Ada masalah", () => {
  beforeEach(() => {
    mockParams = { id: "d-today", meal: "lunch", jenis: "belum" };
  });

  it("preselects Belum sampai from the link and sends the report", async () => {
    const command = jest.fn(async () => ({ id: "i-9" }));
    renderWith(runtimeWith({ command }), <ReportProblem />);
    const belum = await screen.findByRole("radio", { name: "Belum sampai" });
    expect(belum.props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole("radio", { name: "Ada yang kurang atau salah" }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole("radio", { name: "Makanan tidak layak" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Kirim laporan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "deliveryIssue.create",
        { deliveryId: "d-today", meal: "lunch", subject: "Belum sampai", body: "Tanpa catatan tambahan." },
        expect.any(String),
      ),
    );
  });

  it("sends the chosen subject and the note", async () => {
    mockParams = { id: "d-today", meal: "lunch" };
    const command = jest.fn(async () => ({ id: "i-9" }));
    renderWith(runtimeWith({ command }), <ReportProblem />);
    fireEvent.press(await screen.findByRole("radio", { name: "Makanan tidak layak" }));
    fireEvent.changeText(screen.getByLabelText("Catatan (boleh dikosongkan)"), "  Nasinya basi  ");
    fireEvent.press(screen.getByRole("button", { name: "Kirim laporan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "deliveryIssue.create",
        { deliveryId: "d-today", meal: "lunch", subject: "Makanan tidak layak", body: "Nasinya basi" },
        expect.any(String),
      ),
    );
  });

  it("waits for a choice when the link names none", async () => {
    mockParams = { id: "d-today", meal: "lunch" };
    renderWith(runtimeWith(), <ReportProblem />);
    const send = await screen.findByRole("button", { name: "Kirim laporan" });
    expect(send.props.accessibilityState.disabled).toBe(true);
  });

  it("shows the outcome rule after sending", async () => {
    renderWith(runtimeWith(), <ReportProblem />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    expect(await screen.findByText("Sekarang: Dapur Contoh mendapat laporan Anda.")).toBeTruthy();
    expect(screen.getByText("Sampai besok 12.00: Dapur Contoh membalas atau mengganti di sini.")).toBeTruthy();
    expect(screen.getByText("Belum beres? Catera meninjau dan bisa mengembalikan dana hari ini.")).toBeTruthy();
    expect(screen.getAllByText(/^[123]$/).map((n) => n.props.children)).toEqual(["1", "2", "3"]);
    expect(StyleSheet.flatten(screen.getByText(/^Sampai besok 12\.00/).props.style).fontVariant).toContain("tabular-nums");
    // The form is gone and the report can be followed from Bantuan.
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Lihat laporan saya" }));
    expect(router.replace).toHaveBeenCalledWith("/bantuan");
  });

  it("keeps the form and says so when sending fails", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderWith(runtimeWith({ command }), <ReportProblem />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Kirim laporan" })).toBeTruthy();
    expect(screen.queryByText(/^Sekarang:/)).toBeNull();
  });

  it("points to Bantuan when this meal already has a report", async () => {
    const state = customerState({ status: "out_for_delivery", issue: { id: "i-1", status: "open" } });
    renderWith(runtimeWith({ state }), <ReportProblem />);
    expect(await screen.findByText("Laporan untuk makan ini sudah terkirim.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Lihat laporan saya" }));
    expect(router.replace).toHaveBeenCalledWith("/bantuan");
  });

  it("opens WhatsApp with the caterer first, and hides the chat without a number", async () => {
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const view = renderWith(
      runtimeWith({ state: withPhone(customerState({ status: "out_for_delivery" })) }),
      <ReportProblem />,
    );
    fireEvent.press(await screen.findByRole("button", { name: "Atau chat Dapur Contoh di WhatsApp dulu" }));
    expect(openUrl).toHaveBeenCalledWith("https://wa.me/6281200000001?text=");
    view.unmount();
    renderWith(runtimeWith(), <ReportProblem />);
    await screen.findByRole("button", { name: "Kirim laporan" });
    expect(screen.queryByRole("button", { name: /chat Dapur Contoh/ })).toBeNull();
  });

  it("asks to sign in and comes back here", async () => {
    const runtime = runtimeWith();
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    renderWith(runtime, <ReportProblem />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/login",
      params: { next: "/masalah/d-today?meal=lunch&jenis=belum" },
    });
  });

  it("uses 44pt targets for the choices", async () => {
    renderWith(runtimeWith(), <ReportProblem />);
    const radio = await screen.findByRole("radio", { name: "Belum sampai" });
    expect(StyleSheet.flatten(radio.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe("Bantuan dan laporan", () => {
  it("lists a responded report as Dibalas with the caterer's reply", async () => {
    renderWith(
      runtimeWith({ issues: [issue({ status: "responded", version: 2, events: [...issue().events, reply] })] }),
      <ReportList />,
    );
    expect(await screen.findByText("Dibalas")).toBeTruthy();
    expect(screen.getByText("Belum sampai")).toBeTruthy();
    expect(screen.getByText("Kurir sedang di jalan, 15 menit lagi.")).toBeTruthy();
    expect(screen.getByText(/Makan Siang Rumahan/)).toBeTruthy();
  });

  it("says Terkirim, Ditinjau Catera and Selesai for the other states", async () => {
    renderWith(
      runtimeWith({
        issues: [
          issue({ id: "i-1", status: "open" }),
          issue({ id: "i-2", status: "escalated", case_id: "c-2", subject: "Makanan tidak layak" }),
          issue({ id: "i-3", status: "resolved", subject: "Ada yang kurang atau salah" }),
        ],
      }),
      <ReportList />,
    );
    expect(await screen.findByText("Terkirim")).toBeTruthy();
    expect(screen.getByText("Ditinjau Catera")).toBeTruthy();
    expect(screen.getByText("Selesai")).toBeTruthy();
  });

  it("asks Catera to review a replied report with the current version", async () => {
    const command = jest.fn(async () => ({}));
    renderWith(
      runtimeWith({ command, issues: [issue({ status: "responded", version: 4, events: [...issue().events, reply] })] }),
      <ReportList />,
    );
    fireEvent.press(await screen.findByRole("button", { name: "Minta Catera meninjau" }));
    const send = screen.getByRole("button", { name: "Kirim ke Catera" });
    expect(send.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Apa yang belum beres?"), "Makanan tetap tidak datang");
    fireEvent.press(screen.getByRole("button", { name: "Kirim ke Catera" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "deliveryIssue.escalate",
        { id: "i-1", version: 4, body: "Makanan tetap tidak datang" },
        expect.any(String),
      ),
    );
  });

  it("does not offer review before the caterer has replied or after Catera took it", async () => {
    renderWith(
      runtimeWith({
        issues: [issue({ id: "i-1", status: "open" }), issue({ id: "i-2", status: "escalated", case_id: "c-2" })],
      }),
      <ReportList />,
    );
    await screen.findByText("Terkirim");
    expect(screen.queryByRole("button", { name: "Minta Catera meninjau" })).toBeNull();
  });

  it("lists support cases once, without the ones a report already escalated", async () => {
    const cases = [
      { id: "c-2", subject: "Makanan tidak layak", status: "escalated", description: "", resolution: null, amount: null, checkout_id: null },
      { id: "c-7", subject: "Ajukan pembatalan", status: "resolved", description: "", resolution: "Dibatalkan, dana kembali.", amount: 90000, checkout_id: null },
    ] as unknown as SupportCase[];
    const state = { ...customerState(null), cases };
    renderWith(
      runtimeWith({
        state,
        issues: [issue({ id: "i-2", status: "escalated", case_id: "c-2", subject: "Makanan tidak layak" })],
      }),
      <ReportList />,
    );
    expect(await screen.findByText("Ajukan pembatalan")).toBeTruthy();
    expect(screen.getByText("Dibatalkan, dana kembali.")).toBeTruthy();
    expect(screen.getAllByText("Makanan tidak layak")).toHaveLength(1);
  });

  it("links payment help to the checkout's payment screen", async () => {
    const actions = [
      { id: "payment-ck-1", kind: "payment_action", status: "awaiting_payment", priority: 1, packageName: "Makan Siang Rumahan", catererName: "Dapur Contoh", href: "/payment/ck-1" },
      { id: "payment-ck-2", kind: "payment_action", status: "checking_payment", priority: 1, packageName: "Lain", href: "/payment/ck-2" },
      { id: "issue-i-1", kind: "delivery_issue", status: "open", priority: 1, href: "/support?issue=i-1" },
    ] as CustomerActionItem[];
    renderWith(runtimeWith({ actions }), <ReportList />);
    expect(await screen.findByText("Pembayaran belum selesai")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Buka pembayaran" }));
    expect(router.push).toHaveBeenCalledWith("/payment/ck-1");
    expect(screen.getAllByRole("button", { name: "Buka pembayaran" })).toHaveLength(1);
  });

  it("says plainly when there is nothing to show", async () => {
    renderWith(runtimeWith({ state: customerState(null) }), <ReportList />);
    expect(await screen.findByText("Belum ada laporan.")).toBeTruthy();
  });

  it("asks to sign in and comes back to Bantuan", async () => {
    const runtime = runtimeWith();
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    renderWith(runtime, <ReportList />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/bantuan" } });
  });
});

describe("legacy support links", () => {
  it("opens Bantuan from the old /support href", () => {
    expect(customerLink("/support?issue=i-1")).toBe("/bantuan");
    expect(customerLink("/support")).toBe("/bantuan");
  });
});
