import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { ActivityIndicator, Linking, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { CustomerActionItem, CustomerState, SupportCase } from "@catera/domain";
import { ReportProblem } from "../src/help/ReportProblem";
import { ReportList } from "../src/help/ReportList";
import { customerLink } from "../src/links";
import { nativeThemes } from "@catera/design-tokens";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import * as nav from "../src/nav";
import { HelpForm } from "../src/help/HelpForm";
import { customerState, TODAY } from "./fixtures";
import { SheetHost } from "./sheetHost";

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
/** The phone a test draws on; by default the size React Native's jest setup reports. */
const DEFAULT_WINDOW = { width: 750, height: 1334, scale: 2, fontScale: 2 };
let mockWindow = DEFAULT_WINDOW;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
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
  created_at: string;
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
  created_at: `${TODAY}T05:00:00Z`,
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
const renderWith = (runtime: MobileRuntime, ui: React.ReactElement, opts: { toast?: boolean } = {}) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      {opts.toast ? <ToastProvider>{ui}</ToastProvider> : ui}
    </MobileProvider>,
  );
/** "Minta bantuan" and "Minta Catera meninjau" open form sheets (`/bantuan-form`): the host shows them over the list. */
const FORMS = { "/bantuan-form": HelpForm };
const toParams = (params: Record<string, string>) => void (mockParams = params);
const listWithForms = (
  <>
    <ReportList />
    <SheetHost routes={FORMS} onParams={toParams} />
  </>
);
const withPhone = (state: CustomerState): CustomerState => ({
  ...state,
  deliveries: state.deliveries.map((d) => ({ ...d, catererPhone: "+6281200000001" })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockWindow = DEFAULT_WINDOW;
});

/** A Bantuan topic: a radio row whose name is the topic, then its example line. */
const topic = (name: string) => screen.findByRole("radio", { name: new RegExp(`^${name}, `) });
const twoPlans = () => {
  const state = customerState(null);
  const first = state.subscriptions[0];
  state.subscriptions = [
    first,
    { ...first, id: "s-2", snapshot: { ...first.snapshot, offer: { ...first.snapshot.offer, name: "Makan Malam Sehat" } } },
  ];
  return state;
};
const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

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
    expect(screen.getByRole("radio", { name: "Makanannya tidak layak dimakan" })).toBeTruthy();
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
    fireEvent.press(await screen.findByRole("radio", { name: "Makanannya tidak layak dimakan" }));
    fireEvent.changeText(screen.getByLabelText("Catatan (boleh dikosongkan)"), "  Nasinya basi  ");
    fireEvent.press(screen.getByRole("button", { name: "Kirim laporan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "deliveryIssue.create",
        { deliveryId: "d-today", meal: "lunch", subject: "Makanannya tidak layak dimakan", body: "Nasinya basi" },
        expect.any(String),
      ),
    );
  });

  it("shows the shape of the choices while the day loads, with no spinner", async () => {
    const runtime = runtimeWith();
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => {}));
    renderWith(runtime, <ReportProblem />);
    // The session is in and the day's read has started: this is the sheet waiting for the delivery.
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledWith("?deliveryId=d-today"));
    const skeleton = screen.getByRole("progressbar", { name: "Memuat pengantaran" });
    expect(skeleton.props.accessibilityState).toMatchObject({ busy: true });
    // The sheet already says what it is; the form waits for the day.
    expect(screen.getByRole("header", { name: "Ada masalah" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it("says why the day did not load and Coba lagi reads it again", async () => {
    const runtime = runtimeWith();
    const read = runtime.api.customer as jest.Mock;
    read.mockRejectedValueOnce(new Error("network down"));
    renderWith(runtime, <ReportProblem />);
    expect(await screen.findByText("Belum bisa memuat. Cek koneksi lalu coba lagi.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    const before = read.mock.calls.length;
    fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    // The read runs again and, once it lands, the form is there.
    expect(await screen.findByRole("button", { name: "Kirim laporan" })).toBeTruthy();
    expect(read.mock.calls.length).toBe(before + 1);
    expect(read).toHaveBeenLastCalledWith("?deliveryId=d-today");
  });

  it("waits for a choice when the link names none", async () => {
    mockParams = { id: "d-today", meal: "lunch" };
    renderWith(runtimeWith(), <ReportProblem />);
    const send = await screen.findByRole("button", { name: "Kirim laporan" });
    expect(send.props.accessibilityState.disabled).toBe(true);
  });

  it("sending closes the sheet and shows Laporan terkirim with Lihat", async () => {
    renderWith(runtimeWith(), <ReportProblem />, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    // The sheet closes back to the page under it; the outcome is a toast whose action opens Bantuan.
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Laporan terkirim")).toBeTruthy();
    // The old full "sent" page is gone.
    expect(screen.queryByText(/^Sekarang:/)).toBeNull();
    // The toast's action closes the sheets above the tabs and opens Bantuan in the tab: never a push behind a sheet.
    const close = jest.spyOn(nav, "closeSheetFor").mockImplementation(() => {});
    fireEvent.press(screen.getByRole("button", { name: "Lihat" }));
    expect(close).toHaveBeenCalledWith("/bantuan");
    expect(router.push).not.toHaveBeenCalledWith("/bantuan");
    close.mockRestore();
  });

  it("a CONFLICT stays in the sheet with its message", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("CONFLICT"), { code: "CONFLICT" });
    });
    renderWith(runtimeWith({ command }), <ReportProblem />, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    expect(await screen.findByText("Laporan untuk makan ini sudah terkirim.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.queryByText("Laporan terkirim")).toBeNull();
    expect(screen.getByRole("header", { name: "Ada masalah" })).toBeTruthy();
  });

  it("keeps the form and says so when sending fails", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderWith(runtimeWith({ command }), <ReportProblem />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Kirim laporan" })).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("shows the day, the package and the caterer under the sheet title", async () => {
    renderWith(runtimeWith(), <ReportProblem />);
    expect(await screen.findByText(/Dapur Contoh$/)).toBeTruthy();
    expect(screen.getByRole("header", { name: "Ada masalah" })).toBeTruthy();
  });

  it("a day of two meals asks which meal, and the link's meal comes chosen", async () => {
    const state = customerState({ status: "out_for_delivery" });
    state.deliveries = state.deliveries.map((d) =>
      d.id === "d-today" ? { ...d, meals: [...(d.meals ?? []), { ...(d.meals ?? [])[0], meal: "dinner" as const }] } : d,
    );
    mockParams = { id: "d-today", meal: "dinner", jenis: "belum" };
    const command = jest.fn(async () => ({ id: "i-9" }));
    renderWith(runtimeWith({ state, command }), <ReportProblem />);
    const dinner = await screen.findByRole("radio", { name: "Makan malam" });
    expect(dinner.props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByRole("radio", { name: "Makan siang" }));
    fireEvent.press(screen.getByRole("button", { name: "Kirim laporan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith("deliveryIssue.create", expect.objectContaining({ meal: "lunch" }), expect.any(String)),
    );
  });

  it("says plainly when the server refuses a report for a day not yet due", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("NOT_ALLOWED"), { code: "NOT_ALLOWED" });
    });
    renderWith(runtimeWith({ command }), <ReportProblem />);
    fireEvent.press(await screen.findByRole("button", { name: "Kirim laporan" }));
    expect(
      await screen.findByText("Kamu bisa melapor mulai hari pengantaran, setelah jam antarnya mulai."),
    ).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("says the delivery is not found when the read has no meals list", async () => {
    const state = customerState({ status: "out_for_delivery" });
    state.deliveries = state.deliveries.map((d) => (d.id === "d-today" ? ({ ...d, meals: null } as unknown as typeof d) : d));
    renderWith(runtimeWith({ state }), <ReportProblem />);
    expect(await screen.findByText("Pengantaran tidak ditemukan.")).toBeTruthy();
  });

  it("points to Bantuan when this meal already has a report", async () => {
    const state = customerState({ status: "out_for_delivery", issue: { id: "i-1", status: "open" } });
    renderWith(runtimeWith({ state }), <ReportProblem />);
    expect(await screen.findByText("Laporan untuk makan ini sudah terkirim.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    // The sheet closes and Bantuan opens in the tab beneath it (the router tree is covered in navigation.test).
    const close = jest.spyOn(nav, "closeSheetFor").mockImplementation(() => {});
    fireEvent.press(screen.getByRole("button", { name: "Lihat laporan saya" }));
    expect(close).toHaveBeenCalledWith("/bantuan");
    close.mockRestore();
  });

  it("what-happened picks are 48dp and give a selection haptic", async () => {
    renderWith(runtimeWith(), <ReportProblem />);
    const pick = await screen.findByRole("radio", { name: "Makanannya tidak layak dimakan" });
    expect(StyleSheet.flatten(pick.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(pick);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("radio", { name: "Makanannya tidak layak dimakan" }).props.accessibilityState.checked).toBe(true);
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

  it("Masalah shows the delivery card and the caterer name is not cut to one line", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    const long = "Dapur Ibu Sari Rasa Nusantara Masakan Rumahan Jakarta Selatan";
    const state = customerState({ status: "out_for_delivery" });
    state.deliveries = state.deliveries.map((d) => (d.id === "d-today" ? { ...d, offer: { ...d.offer, caterer: long } } : d));
    renderWith(runtimeWith({ state }), <ReportProblem />);
    const card = await screen.findByTestId("delivery-card");
    // The day and the meal, then the caterer in full on up to two lines.
    expect(within(card).getByText(/Makan siang/)).toBeTruthy();
    const caterer = within(card).getByText(long);
    expect(caterer.props.numberOfLines).toBe(2);
    // The header no longer carries the caterer on its one held line.
    expect(screen.getAllByText(new RegExp(long))).toHaveLength(1);
  });

  it("the delivery card names the meal being reported, also for a two-meal day", async () => {
    const state = customerState({ status: "out_for_delivery" });
    state.deliveries = state.deliveries.map((d) =>
      d.id === "d-today" ? { ...d, meals: [...(d.meals ?? []), { ...(d.meals ?? [])[0], meal: "dinner" as const }] } : d,
    );
    mockParams = { id: "d-today", meal: "dinner" };
    renderWith(runtimeWith({ state }), <ReportProblem />);
    const card = await screen.findByTestId("delivery-card");
    expect(within(card).getByText(/Makan malam/)).toBeTruthy();
    fireEvent.press(screen.getByRole("radio", { name: "Makan siang" }));
    expect(within(screen.getByTestId("delivery-card")).getByText(/Makan siang/)).toBeTruthy();
  });

  it.each(["light", "dark"] as const)("Masalah choices are not forest-filled (%s)", async (scheme) => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme);
    const state = customerState({ status: "out_for_delivery" });
    state.deliveries = state.deliveries.map((d) =>
      d.id === "d-today" ? { ...d, meals: [...(d.meals ?? []), { ...(d.meals ?? [])[0], meal: "dinner" as const }] } : d,
    );
    renderWith(
      runtimeWith({ state }),
      <ThemeProvider storageKey={`masalah-${scheme}`}>
        <ReportProblem />
      </ThemeProvider>,
    );
    await act(async () => {});
    const palette = nativeThemes[scheme];
    for (const name of ["Belum sampai", "Makan siang"]) {
      const chosen = await screen.findByRole("radio", { name });
      expect(chosen.props.accessibilityState.checked).toBe(true);
      expect(flat(chosen).backgroundColor).not.toBe(palette.forest);
      // The label stays ink on the page, not cream on a forest pill.
      expect(StyleSheet.flatten(within(chosen).getByText(name).props.style).color).toBe(palette.charcoal);
    }
    jest.restoreAllMocks();
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
          issue({ id: "i-2", status: "escalated", case_id: "c-2", subject: "Makanannya tidak layak dimakan" }),
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
      listWithForms,
      { toast: true },
    );
    fireEvent.press(await screen.findByRole("button", { name: "Minta Catera meninjau" }));
    // The form is a native sheet over the list, opened for this report.
    expect(router.push).toHaveBeenCalledWith("/bantuan-form?kind=review&issue=i-1");
    const send = await screen.findByRole("button", { name: "Kirim ke Catera" });
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Kirim ke Catera" })).toBeTruthy();
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
    // Sent: the sheet closes and the toast says so.
    expect(await screen.findByText("Permintaan bantuan terkirim")).toBeTruthy();
    expect(router.back).toHaveBeenCalled();
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
      { id: "c-2", subject: "Makanannya tidak layak dimakan", status: "escalated", description: "", resolution: null, amount: null, checkout_id: null },
      { id: "c-7", subject: "Ajukan pembatalan", status: "resolved", description: "", resolution: "Dibatalkan, dana kembali.", amount: 90000, checkout_id: null },
    ] as unknown as SupportCase[];
    const state = { ...customerState(null), cases };
    renderWith(
      runtimeWith({
        state,
        issues: [issue({ id: "i-2", status: "escalated", case_id: "c-2", subject: "Makanannya tidak layak dimakan" })],
      }),
      <ReportList />,
    );
    expect(await screen.findByText("Ajukan pembatalan")).toBeTruthy();
    expect(screen.getByText("Dibatalkan, dana kembali.")).toBeTruthy();
    expect(screen.getAllByText("Makanannya tidak layak dimakan")).toHaveLength(1);
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

  it("empty Bantuan shows the art, the Jadwal line, and Minta bantuan when there is a plan", async () => {
    const view = renderWith(runtimeWith({ state: customerState(null) }), <ReportList />);
    const title = await screen.findByText("Belum ada laporan");
    expect(screen.getByTestId("mascot-tidur", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Kalau ada yang salah dengan pengantaran, laporkan dari harinya di Jadwal.")).toBeTruthy();
    // With a plan, the way to ask sits in the empty state, under its line.
    const empty = screen.getByTestId("bantuan-empty");
    expect(within(empty).getByText("Belum ada laporan")).toBe(title);
    expect(within(empty).getByRole("button", { name: "Minta bantuan" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Minta bantuan" })).toHaveLength(1);
    view.unmount();
    // Without a plan there is nothing to ask about yet: the art and the line, no button.
    renderWith(runtimeWith({ state: { ...customerState(null), subscriptions: [] } }), <ReportList />);
    expect(await screen.findByText("Belum ada laporan")).toBeTruthy();
    expect(screen.getByTestId("mascot-tidur", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Minta bantuan" })).toBeNull();
  });

  it("with reports, Minta bantuan stays above them and there is no empty state", async () => {
    renderWith(runtimeWith({ issues: [issue()] }), <ReportList />);
    expect(await screen.findByRole("button", { name: "Minta bantuan" })).toBeTruthy();
    expect(screen.queryByTestId("bantuan-empty")).toBeNull();
    expect(screen.queryByTestId("mascot-tidur", { includeHiddenElements: true })).toBeNull();
  });

  it("asks to sign in and comes back to Bantuan", async () => {
    const runtime = runtimeWith();
    (runtime.api.me as jest.Mock).mockResolvedValue({ actor: null, demo: false });
    renderWith(runtime, <ReportList />);
    fireEvent.press(await screen.findByRole("button", { name: "Masuk" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/login", params: { next: "/bantuan" } });
  });
});

describe("Bantuan: asking Catera to review an ignored report", () => {
  // 10.00 in Jakarta on Wednesday 7 October 2026. Only Date is frozen so async code keeps working.
  beforeAll(() => {
    jest.useFakeTimers({
      now: new Date("2026-10-07T03:00:00Z"),
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
  beforeEach(() => jest.setSystemTime(new Date("2026-10-07T03:00:00Z")));

  it("holds an open report until 12.00 the day after it was sent, and says so", async () => {
    // Sent 9.00 on the 7th: ready from 12.00 on the 8th.
    renderWith(runtimeWith({ issues: [issue({ status: "open", created_at: "2026-10-07T02:00:00Z" })] }), <ReportList />);
    expect(await screen.findByText("Bisa minta Catera meninjau mulai besok 12.00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Minta Catera meninjau" })).toBeNull();
  });

  it("names today when the wait ends at noon today", async () => {
    // Sent on the 6th: ready 12.00 on the 7th, and it is 10.00.
    renderWith(runtimeWith({ issues: [issue({ status: "open", created_at: "2026-10-06T02:00:00Z" })] }), <ReportList />);
    expect(await screen.findByText("Bisa minta Catera meninjau hari ini 12.00")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Minta Catera meninjau" })).toBeNull();
  });

  it("offers review of an open report after 12.00 Jakarta the next day, with its version", async () => {
    const command = jest.fn(async () => ({}));
    // Sent 23.30 Jakarta on the 6th (16.30Z); at 12.00 on the 7th it is ready. Now 12.01.
    jest.setSystemTime(new Date("2026-10-07T05:01:00Z"));
    renderWith(
      runtimeWith({ command, issues: [issue({ status: "open", version: 3, created_at: "2026-10-06T16:30:00Z" })] }),
      listWithForms,
      { toast: true },
    );
    fireEvent.press(await screen.findByRole("button", { name: "Minta Catera meninjau" }));
    fireEvent.changeText(await screen.findByLabelText("Apa yang belum beres?"), "Belum ada balasan sama sekali");
    fireEvent.press(screen.getByRole("button", { name: "Kirim ke Catera" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "deliveryIssue.escalate",
        { id: "i-1", version: 3, body: "Belum ada balasan sama sekali" },
        expect.any(String),
      ),
    );
  });

  it("counts the day in Jakarta, not in UTC", async () => {
    // Sent 23.30 Jakarta on the 6th. 12.00 Jakarta on the 7th is 05.00Z, so at 04.59Z it is not yet.
    jest.setSystemTime(new Date("2026-10-07T04:59:00Z"));
    renderWith(runtimeWith({ issues: [issue({ status: "open", created_at: "2026-10-06T16:30:00Z" })] }), <ReportList />);
    expect(await screen.findByText("Bisa minta Catera meninjau hari ini 12.00")).toBeTruthy();
  });

  it("lets a replied report go to Catera at any time", async () => {
    renderWith(
      runtimeWith({
        issues: [issue({ status: "responded", created_at: "2026-10-07T02:30:00Z", events: [...issue().events, reply] })],
      }),
      <ReportList />,
    );
    expect(await screen.findByRole("button", { name: "Minta Catera meninjau" })).toBeTruthy();
    expect(screen.queryByText(/mulai besok 12\.00/)).toBeNull();
  });
});

describe("Bantuan: Minta bantuan", () => {
  it("sends a cancellation request for the subscription and lists the new case as Terkirim", async () => {
    const state = customerState(null);
    const command = jest.fn(async (action: string, payload: any) => {
      if (action === "support.create")
        state.cases = [
          {
            id: "c-new",
            subject: payload.subject,
            description: payload.description,
            status: "open",
            resolution: null,
            amount: null,
          } as unknown as SupportCase,
        ];
      return { id: "c-new" };
    });
    renderWith(runtimeWith({ state, command }), listWithForms, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Minta bantuan" }));
    expect(router.push).toHaveBeenCalledWith("/bantuan-form?kind=help");
    fireEvent.press(await topic("Pembatalan"));
    // The primary action is pinned in the sheet's footer, not in the scrolling content.
    expect(within(screen.getByTestId("sheet-footer")).getByRole("button", { name: "Kirim permintaan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim permintaan" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Ceritakan masalahnya"), "Saya pindah kota, mohon dibatalkan");
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "support.create",
        { subscriptionId: "s-1", subject: "Pembatalan", description: "Saya pindah kota, mohon dibatalkan" },
        expect.any(String),
      ),
    );
    expect(await screen.findByText("Terkirim")).toBeTruthy();
    expect(screen.getByText("Pembatalan", { exact: true })).toBeTruthy();
    // The form sheet closes after sending, with the toast.
    expect(screen.queryByLabelText("Ceritakan masalahnya")).toBeNull();
    expect(screen.getByText("Permintaan bantuan terkirim")).toBeTruthy();
  });

  it("keeps the form when sending fails", async () => {
    const command = jest.fn(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    });
    renderWith(runtimeWith({ state: customerState(null), command }), listWithForms, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Minta bantuan" }));
    fireEvent.press(await topic("Lainnya"));
    fireEvent.changeText(screen.getByLabelText("Ceritakan masalahnya"), "Pertanyaan soal paket");
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText("Ceritakan masalahnya")).toBeTruthy();
  });

  it("asks which package when there are several", async () => {
    const state = twoPlans();
    const command = jest.fn(async () => ({}));
    renderWith(runtimeWith({ state, command }), listWithForms, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Minta bantuan" }));
    fireEvent.press(await screen.findByRole("button", { name: "Paket, Makan Siang Rumahan" }));
    fireEvent.press(screen.getByRole("radio", { name: "Makan Malam Sehat" }));
    fireEvent.press(await topic("Pembayaran"));
    fireEvent.changeText(screen.getByLabelText("Ceritakan masalahnya"), "Sudah bayar tapi belum aktif");
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "support.create",
        { subscriptionId: "s-2", subject: "Pembayaran", description: "Sudah bayar tapi belum aktif" },
        expect.any(String),
      ),
    );
  });

  it("package picks are 48dp and give a selection haptic", async () => {
    renderWith(runtimeWith({ state: twoPlans() }), listWithForms, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Minta bantuan" }));
    fireEvent.press(await screen.findByRole("button", { name: "Paket, Makan Siang Rumahan" }));
    const pick = screen.getByRole("radio", { name: "Makan Malam Sehat" });
    expect(StyleSheet.flatten(pick.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(pick);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("topics are radio rows with an example line", async () => {
    mockParams = { kind: "help" };
    renderWith(runtimeWith({ state: customerState(null) }), <HelpForm />, { toast: true });
    const cancel = await topic("Pembatalan");
    expect(screen.queryByRole("tab")).toBeNull();
    for (const [name, example] of [
      ["Pembatalan", "Berhenti langganan atau batalkan paket"],
      ["Pembayaran", "Sudah bayar tapi paket belum aktif"],
      ["Lainnya", "Pertanyaan lain soal paket atau pengantaran"],
    ]) {
      const row = screen.getByRole("radio", { name: `${name}, ${example}` });
      expect(within(row).getByText(example)).toBeTruthy();
      expect(row.props.accessibilityState.checked).toBe(false);
    }
    fireEvent.press(cancel);
    const chosen = await topic("Pembatalan");
    expect(chosen.props.accessibilityState.checked).toBe(true);
    // Choosing marks the row, it does not fill it in forest.
    expect(flat(chosen).backgroundColor).not.toBe(nativeThemes.light.forest);
  });

  it("the package is one Paket row; the paket param preselects it", async () => {
    mockParams = { kind: "help", paket: "s-2" };
    const command = jest.fn(async () => ({}));
    renderWith(runtimeWith({ state: twoPlans(), command }), <HelpForm />, { toast: true });
    // One row names the chosen package; no chip per package.
    const row = await screen.findByRole("button", { name: "Paket, Makan Malam Sehat" });
    expect(flat(row).minHeight).toBeGreaterThanOrEqual(48);
    expect(row.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByRole("radio", { name: "Makan Siang Rumahan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Makan Siang Rumahan" })).toBeNull();
    fireEvent.press(await topic("Lainnya"));
    fireEvent.changeText(screen.getByLabelText("Ceritakan masalahnya"), "Bisa ganti alamat?");
    fireEvent.press(screen.getByRole("button", { name: "Kirim permintaan" }));
    await waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        "support.create",
        { subscriptionId: "s-2", subject: "Lainnya", description: "Bisa ganti alamat?" },
        expect.any(String),
      ),
    );
  });

  it("the Paket row opens the packages as radio rows and closes on a choice", async () => {
    mockParams = { kind: "help" };
    renderWith(runtimeWith({ state: twoPlans() }), <HelpForm />, { toast: true });
    fireEvent.press(await screen.findByRole("button", { name: "Paket, Makan Siang Rumahan" }));
    expect(screen.getByRole("button", { name: "Paket, Makan Siang Rumahan" }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByRole("radio", { name: "Makan Siang Rumahan" }).props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByRole("radio", { name: "Makan Malam Sehat" }));
    expect(screen.queryByRole("radio", { name: "Makan Siang Rumahan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Paket, Makan Malam Sehat" })).toBeTruthy();
  });

  it("one package is named on a plain Paket row, and an unknown paket param falls back to it", async () => {
    mockParams = { kind: "help", paket: "s-gone" };
    renderWith(runtimeWith({ state: customerState(null) }), <HelpForm />, { toast: true });
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("Paket")).toBeTruthy();
    // Nothing to choose between, so the row does not open anything.
    expect(screen.queryByRole("button", { name: /^Paket, / })).toBeNull();
  });

  it("topic rows and the Paket row grow at font 1.3 on a 360dp phone", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    mockParams = { kind: "help" };
    const state = twoPlans();
    const long = "Paket Makan Siang Rumahan Keluarga Besar Dengan Nama Panjang Sekali";
    state.subscriptions[0] = {
      ...state.subscriptions[0],
      snapshot: { ...state.subscriptions[0].snapshot, offer: { ...state.subscriptions[0].snapshot.offer, name: long } },
    };
    renderWith(runtimeWith({ state }), <HelpForm />, { toast: true });
    const row = await screen.findByRole("button", { name: `Paket, ${long}` });
    // Rows set a minimum height only and never cut the package or the example line.
    expect(flat(row).height).toBeUndefined();
    expect(within(row).getByText(long).props.numberOfLines).toBeUndefined();
    const cancel = await topic("Pembatalan");
    expect(flat(cancel).height).toBeUndefined();
    expect(within(cancel).getByText("Pembatalan").props.numberOfLines).toBeUndefined();
  });

  it("has no package to ask about without a subscription", async () => {
    renderWith(runtimeWith({ state: { ...customerState(null), subscriptions: [] } }), <ReportList />);
    await screen.findByText("Belum ada laporan");
    expect(screen.queryByRole("button", { name: "Minta bantuan" })).toBeNull();
  });
});

describe("Bantuan: payment help from a checkout", () => {
  const feedItem = (id: string, status: string) =>
    ({
      id: "payment-" + id,
      kind: "payment_action",
      status,
      priority: 1,
      packageName: "Paket " + id,
      catererName: "Dapur Contoh",
      href: "/payment/" + id,
    }) as CustomerActionItem;

  it.each(["awaiting_payment", "checking_payment", "choose_method", "payment_exception"])(
    "shows the checkout from the link in %s",
    async (status) => {
      mockParams = { checkoutId: "ck-9", catererId: "k-1" };
      renderWith(runtimeWith({ actions: [feedItem("ck-9", status), feedItem("ck-1", "awaiting_payment")] }), <ReportList />);
      expect(await screen.findByText(/Paket ck-9/)).toBeTruthy();
      expect(screen.queryByText(/Paket ck-1/)).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: "Buka pembayaran" }));
      expect(router.push).toHaveBeenCalledWith("/payment/ck-9");
    },
  );

  it("still offers the payment screen when the checkout has left the feed (failed or expired)", async () => {
    mockParams = { checkoutId: "ck-7" };
    renderWith(runtimeWith({ actions: [] }), <ReportList />);
    expect(await screen.findByText("Pembayaran belum selesai")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Buka pembayaran" }));
    expect(router.push).toHaveBeenCalledWith("/payment/ck-7");
  });

  it("without a link shows every checkout waiting for payment", async () => {
    renderWith(
      runtimeWith({ actions: [feedItem("ck-1", "awaiting_payment"), feedItem("ck-2", "awaiting_payment")] }),
      <ReportList />,
    );
    await screen.findByText(/Paket ck-1/);
    expect(screen.getAllByRole("button", { name: "Buka pembayaran" })).toHaveLength(2);
  });
});

describe("Ada masalah without a reportable meal", () => {
  it("says the delivery was not found, with no form", async () => {
    mockParams = { id: "d-today", meal: "lunch", jenis: "belum" };
    renderWith(runtimeWith({ state: customerState({ status: "cancelled" }) }), <ReportProblem />);
    expect(await screen.findByText("Pengantaran tidak ditemukan.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Kirim laporan" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("status pill colours", () => {
  it("spends no Sunrise on a status pill", async () => {
    renderWith(
      runtimeWith({
        issues: [
          issue({ id: "i-1", status: "open" }),
          issue({ id: "i-2", status: "responded", events: [...issue().events, reply] }),
          issue({ id: "i-3", status: "escalated", case_id: "c-3" }),
          issue({ id: "i-4", status: "resolved" }),
        ],
      }),
      <ReportList />,
    );
    const colour = async (word: string) => StyleSheet.flatten((await screen.findByText(word)).props.style).color;
    // No pill is Sunrise now; the reply that needs the customer sits on the cream pill and the rest on sage.
    for (const word of ["Dibalas", "Terkirim", "Ditinjau Catera", "Selesai"]) expect(await colour(word)).toBe(nativeThemes.light.charcoal);
  });
});

describe("legacy support links", () => {
  it("opens Bantuan from the old /support href", () => {
    expect(customerLink("/support?issue=i-1")).toBe("/bantuan?issue=i-1");
    expect(customerLink("/support")).toBe("/bantuan");
  });
});
