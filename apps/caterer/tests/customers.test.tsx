import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { addDays, jakartaDay, shortDate, type SellerCustomer } from "@catera/domain";
import { activeEndLabel, customerStatus, endLabel, paymentsActive, renewalAction } from "../src/customers/rules";
import { CustomerList } from "../src/customers/CustomerList";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { canvasDay } from "./fixtures";
import { withDapurScale } from "./dapur-scale";

/** The phone the screens are drawn on; a test sets it. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const sub = (remaining: number, status = "active") => ({
  id: `s-${remaining}-${status}`,
  package_id: "p-rumahan",
  package_name: "Makan Siang Rumahan",
  meal: "lunch",
  portions: 1,
  starts_on: "2026-10-01",
  ends_on: "2026-10-09",
  status,
  remaining,
  next_delivery: "2026-10-08",
  legacy: true,
  renewed_from: null,
  external_reference: null,
  payment_route: "external_reported" as const,
  renewal_status: "unknown" as const,
  prepared_at: null,
  trial: false,
  deliveries: [],
});
const customer = (
  id: string,
  name: string,
  subs: ReturnType<typeof sub>[],
  extra: Partial<SellerCustomer> = {},
): SellerCustomer => ({
  id,
  caterer_id: "k-1",
  user_id: null,
  name,
  phone: "+6281234500" + id.slice(-2),
  address: { line: "Kost Damai Lt. 2", area: "Setiabudi" },
  origin: "seller",
  version: 1,
  claim_review: null,
  subscriptions: subs,
  ...extra,
});
const customers = [
  customer("c-01", "Andre Kusuma", [sub(2)]),
  customer("c-02", "Dewi Saraswati", [sub(12)], { user_id: "u-dewi", origin: "marketplace" }),
  customer("c-03", "Bayu Tri", [sub(0, "completed")]),
];

function runtimeWith(caterStatus: string, payoutActive: boolean, list: SellerCustomer[] = customers): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  const day = canvasDay();
  (day.caterer as { status?: string }).status = caterStatus;
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerCustomers: jest.fn(async () => ({ customers: list, total: list.length, packages: [] })),
    sellerOperations: jest.fn(async () => day),
    request: jest.fn(async () => ({ active: payoutActive ? { id: "pd-1" } : null })),
    command: jest.fn(async (action: string) =>
      action === "customer.invite" ? { path: "/claim/tok123", phone: "+628123450001" } : { path: "/renew/s-2" },
    ),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const wrap = (runtime: MobileRuntime, node: React.ReactNode) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      {node}
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
});

describe("rules", () => {
  it("classifies customers by their subscriptions", () => {
    expect(customers.map(customerStatus)).toEqual(["ending", "active", "ended"]);
  });
  it("needs approval and an active bank account before payments are on", () => {
    expect(paymentsActive("approved", { active: { id: "x" } } as never)).toBe(true);
    expect(paymentsActive("submitted", { active: { id: "x" } } as never)).toBe(false);
    expect(paymentsActive("approved", { active: null } as never)).toBe(false);
  });
  it("invites account-less customers and follows up the rest", () => {
    expect(renewalAction(customers[0])).toBe("invite");
    expect(renewalAction(customers[1])).toBe("followup");
    expect(renewalAction({ ...customers[0], phone: null })).toBe("none");
  });
});

it("filters to customers whose package ends within three days", async () => {
  wrap(runtimeWith("approved", true), <CustomerList />);
  fireEvent.press(await screen.findByText("Segera berakhir · 1"));
  expect(screen.getByText("Andre Kusuma")).toBeTruthy();
  expect(screen.queryByText("Dewi Saraswati")).toBeNull();
  expect(screen.queryByText("Bayu Tri")).toBeNull();
});

it("counts ending customers as active", async () => {
  // The package ends on 9 Oct, so today is pinned to 8 Oct: one delivery left, end date still ahead.
  jest.useFakeTimers({
    now: new Date("2026-10-08T03:00:00Z"),
    // Only the clock is pinned: timers, microtasks and animation frames keep running for real.
    doNotFake: [
      "hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "setImmediate",
      "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    ],
  });
  try {
    // One customer with a single delivery left is both on a running package and about to end.
    wrap(runtimeWith("approved", true, [customer("c-09", "Rina Maharani", [sub(1)])]), <CustomerList />);
    expect(await screen.findByText("Aktif · 1")).toBeTruthy();
    expect(screen.getByText("Segera berakhir · 1")).toBeTruthy();
    expect(screen.getByText("Selesai · 0")).toBeTruthy();
    // The Aktif list shows her, with the end wording kept on her row's meta line.
    expect(screen.getByText("Rina Maharani")).toBeTruthy();
    expect(screen.getByText(/Berakhir besok/)).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it("lists ending and active customers together under Aktif, without the ended ones", async () => {
  wrap(runtimeWith("approved", true), <CustomerList />);
  expect(await screen.findByText("Aktif · 2")).toBeTruthy();
  expect(screen.getByText("Andre Kusuma")).toBeTruthy();
  expect(screen.getByText("Dewi Saraswati")).toBeTruthy();
  expect(screen.queryByText("Bayu Tri")).toBeNull();
});

it("sends an account-less customer a claim link on WhatsApp", async () => {
  const runtime = runtimeWith("approved", true);
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  wrap(runtime, <CustomerDetail id="c-01" />);
  fireEvent.press(await screen.findByText("Kirim tautan perpanjang"));
  await waitFor(() => expect(open).toHaveBeenCalled());
  expect((runtime.api.command as jest.Mock).mock.calls[0][0]).toBe("customer.invite");
  expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/628123450001\?text=.*claim%2Ftok123/);
});

it("asks to turn on payments before the first renewal", async () => {
  const runtime = runtimeWith("submitted", false);
  wrap(runtime, <CustomerDetail id="c-01" />);
  fireEvent.press(await screen.findByText("Kirim tautan perpanjang"));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/aktifkan"));
  expect(runtime.api.command).not.toHaveBeenCalled();
});

it("lists the live address under Alamat antar and no card when the customer has none left", async () => {
  const live = { id: "a-kantor", label: "Kantor", line: "Jl. Kantor 5", area: "Tebet" };
  const first = wrap(runtimeWith("approved", true, [customer("c-01", "Andre Kusuma", [sub(2)], { user_id: "u-a", address: live })]), <CustomerDetail id="c-01" />);
  // The address's own label rides on the heading line, as the board draws it.
  expect(await screen.findByText("Alamat antar · Kantor")).toBeTruthy();
  expect(screen.getByText("Jl. Kantor 5, Tebet")).toBeTruthy();
  first.unmount();
  // The server answers an empty address once every address was removed.
  wrap(runtimeWith("approved", true, [customer("c-01", "Andre Kusuma", [sub(2)], { user_id: "u-a", address: {} as never })]), <CustomerDetail id="c-01" />);
  expect(await screen.findByText("Kirim tautan perpanjang")).toBeTruthy();
  expect(screen.queryByText(/^Alamat antar/)).toBeNull();
});

describe("Pelanggan plain header", () => {
  const MALAM = () => new Date("2026-10-08T08:00:00Z");
  const flat = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
  const renderMood = (runtime: MobileRuntime) =>
    render(
      <MoodProvider now={MALAM}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          {withDapurScale(<CustomerList />)}
        </MobileProvider>
      </MoodProvider>,
    );

  it("titles the list on the canvas in Malam too (no mood band), with the customers' card below it on the theme surface", async () => {
    renderMood(runtimeWith("approved", true));
    const header = await screen.findByTestId("pelanggan-header");
    expect(within(header).queryByTestId("mood-fill-malam", { includeHiddenElements: true })).toBeNull();
    const title = within(header).getByText("Pelanggan");
    expect(title.props.accessibilityRole).toBe("header");
    expect(flat(title).color).toBe("#2E2E2E");
    expect(screen.queryByRole("tab", { name: "Malam" })).toBeNull();
    // The cards are on the page: Andre's row and its card carry the theme surface, not the header fill.
    expect(await screen.findByText("Andre Kusuma")).toBeTruthy();
    expect(within(header).queryByText("Andre Kusuma")).toBeNull();
    let card = screen.getByText("Andre Kusuma").parent;
    while (card && !flat(card).backgroundColor) card = card.parent;
    expect(flat(card!).backgroundColor).toBe(nativeThemes.light.surface);
    expect(nativeThemes.light.surface).toBe("#FFFFFF");
  });

  it("keeps + Pelanggan lama as a 48dp button that opens the import", async () => {
    renderMood(runtimeWith("approved", true));
    const add = await screen.findByRole("button", { name: "+ Pelanggan lama" });
    expect(StyleSheet.flatten(add.props.style).minHeight).toBe(48);
    fireEvent.press(add);
    expect(router.push).toHaveBeenCalledWith("/impor");
  });

  it("shows the customer skeleton inside the page while loading, and the error with its retry when the read fails", async () => {
    const pending = runtimeWith("approved", true);
    (pending.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(() => new Promise(() => undefined));
    const first = renderMood(pending);
    expect(await screen.findByLabelText("Memuat pelanggan")).toBeTruthy();
    expect(within(screen.getByTestId("pelanggan-header")).getByText("Pelanggan")).toBeTruthy();
    // The row holds the title and the action: 48 tall under Dapur's 48 target, 8 under the status bar, no empty row.
    const row = screen.getByTestId("mood-header-row");
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ minHeight: 48 });
    expect(StyleSheet.flatten(screen.getByTestId("pelanggan-header").props.style)).toMatchObject({ paddingTop: 8 });
    first.unmount();

    const broken = runtimeWith("approved", true);
    (broken.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async () => {
      throw new Error("REQUEST_TIMEOUT");
    });
    renderMood(broken);
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(within(screen.getByTestId("pelanggan-header")).queryByRole("button", { name: "Coba lagi" })).toBeNull();
  });
});

it("counts every customer of a kitchen with more than one page of them", async () => {
  const runtime = runtimeWith("approved", true);
  const many = Array.from({ length: 150 }, (_, i) => customer(`c-${String(i).padStart(3, "0")}`, `Pelanggan ${i}`, [sub(10)]));
  (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async (_id: string, query = "") => {
    const offset = Number(new URLSearchParams(query.replace(/^\?/, "")).get("offset") ?? 0);
    return { customers: many.slice(offset, offset + 100), total: 150, packages: [] };
  });
  wrap(runtime, <CustomerList />);
  expect(await screen.findByText("Aktif · 150")).toBeTruthy();
});

it("opens a customer's own record with their delivery schedule", async () => {
  const runtime = runtimeWith("approved", true);
  const detailed = customer("c-01", "Andre Kusuma", [
    { ...sub(2), deliveries: [{ id: "d-1", service_date: "2026-10-08", status: "scheduled" }] as never },
  ]);
  (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async (_id: string, query = "") =>
    query.includes("customerRecordId=c-01") ? { customers: [detailed], total: 1, packages: [] } : { customers: [], total: 0, packages: [] },
  );
  wrap(runtime, <CustomerDetail id="c-01" />);
  expect(await screen.findByText("Kamis 8 Okt")).toBeTruthy();
  expect(screen.getByText("Jadwal")).toBeTruthy();
});

describe("package end labels", () => {
  const t = (id: string, en: string) => (locale === "en" ? en : id);
  let locale: "id" | "en" = "id";
  it("says today, tomorrow or the date from the last delivery day", () => {
    expect(endLabel("2026-10-08", "2026-10-08", t, "id")).toBe("Berakhir hari ini");
    expect(endLabel("2026-10-09", "2026-10-08", t, "id")).toBe("Berakhir besok");
    expect(endLabel("2026-10-15", "2026-10-08", t, "id")).toBe("Berakhir Kamis 15 Okt");
    expect(endLabel("2026-10-08", "2026-10-08", t, "id")).not.toBe("Berakhir besok");
  });
  it("rolls tomorrow over a month end", () => {
    expect(endLabel("2026-11-01", "2026-10-31", t, "id")).toBe("Berakhir besok");
  });
  it("speaks English when asked", () => {
    locale = "en";
    expect(endLabel("2026-10-08", "2026-10-08", t, "en")).toBe("Ends today");
    expect(endLabel("2026-10-09", "2026-10-08", t, "en")).toBe("Ends tomorrow");
    locale = "id";
  });
  it("never says zero days left: with nothing left it falls back to the end label", () => {
    expect(activeEndLabel({ ends_on: "2026-10-07", remaining: 0 }, "2026-10-08", t, "id")).toBe(
      endLabel("2026-10-07", "2026-10-08", t, "id"),
    );
    expect(activeEndLabel({ ends_on: "2026-10-08", remaining: 0 }, "2026-10-08", t, "id", true)).toBe("Berakhir hari ini");
    expect(activeEndLabel({ ends_on: "2026-10-07", remaining: 0 }, "2026-10-08", t, "id")).not.toMatch(/0 hari/);
  });
  it("an active package past its last booked day shows only the days left", () => {
    const moved = { ends_on: "2026-10-07", remaining: 1 };
    expect(activeEndLabel(moved, "2026-10-08", t, "id")).toBe("Sisa 1 hari");
    expect(activeEndLabel(moved, "2026-10-08", t, "id", true)).toBe("Sisa 1 hari");
    expect(activeEndLabel({ ends_on: "2026-10-15", remaining: 5 }, "2026-10-08", t, "id", true)).toBe(
      "Berakhir Kamis 15 Okt · sisa 5 hari",
    );
    locale = "en";
    expect(activeEndLabel(moved, "2026-10-08", t, "en")).toBe("1 day left");
    expect(activeEndLabel({ ends_on: "2026-10-15", remaining: 5 }, "2026-10-08", t, "en", true)).toBe(
      "Ends Thu 15 Oct · 5 days left",
    );
    locale = "id";
  });
});

describe("customers with more than one package", () => {
  const today = jakartaDay(new Date());
  const inDays = (n: number) => addDays(today, n);
  const soon = { ...sub(1), id: "s-soon", package_name: "Makan Siang Rumahan", ends_on: today };
  const later = { ...sub(9), id: "s-later", package_name: "Paket Hemat Kantor", ends_on: inDays(9) };
  const multi = customer("c-07", "Sari Wulandari", [later, soon], { user_id: "u-sari", origin: "marketplace" });
  const withMulti = (runtime: MobileRuntime) => {
    (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async () => ({ customers: [multi], total: 1, packages: [] }));
    return runtime;
  };

  it("lists every active package, soonest ending first, each with its own dates and days left", async () => {
    wrap(withMulti(runtimeWith("approved", true)), withDapurScale(<CustomerDetail id="c-07" />));
    expect(await screen.findByLabelText("Sisa, 1 hari")).toBeTruthy();
    expect(screen.getByLabelText(`Selesai, ${shortDate(today, "id")}`)).toBeTruthy();
    expect(screen.getByLabelText("Sisa, 9 hari")).toBeTruthy();
    expect(screen.getByLabelText(`Selesai, ${shortDate(inDays(9), "id")}`)).toBeTruthy();
    const names = screen.getAllByLabelText(/^Paket, /).map((n) => String(n.props.accessibilityLabel));
    expect(names).toEqual(["Paket, Makan Siang Rumahan", "Paket, Paket Hemat Kantor"]);
    expect(screen.getAllByText("Kirim tautan perpanjang")).toHaveLength(2);
  });

  it("renews the package whose button was pressed", async () => {
    const runtime = withMulti(runtimeWith("approved", true));
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    wrap(runtime, <CustomerDetail id="c-07" />);
    const buttons = await screen.findAllByText("Kirim tautan perpanjang");
    fireEvent.press(buttons[1]);
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalled());
    expect((runtime.api.command as jest.Mock).mock.calls[0].slice(0, 2)).toEqual([
      "customer.followup",
      expect.objectContaining({ subscriptionId: "s-later" }),
    ]);
  });

  it("labels a package whose last day is today as ending today in the list", async () => {
    wrap(withMulti(runtimeWith("approved", true)), <CustomerList />);
    fireEvent.press(await screen.findByText(/Segera berakhir/));
    expect(await screen.findByText(/Berakhir hari ini/)).toBeTruthy();
    expect(screen.queryByText(/Berakhir besok/)).toBeNull();
    expect(screen.getByText(/\+1 paket lain/)).toBeTruthy();
  });

  it("never shows a past end date for a package that is still active, only the days left", async () => {
    const runtime = runtimeWith("approved", true);
    // Moved deliveries keep the package running past its booked last day.
    const overdue = { ...sub(1), id: "s-moved", package_name: "Rantang Nusantara", ends_on: inDays(-1) };
    (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async () => ({
      customers: [customer("c-09", "Nadia", [overdue])],
      total: 1,
      packages: [],
    }));
    const list = wrap(runtime, <CustomerList />);
    fireEvent.press(await screen.findByText(/Segera berakhir/));
    expect(await screen.findByText(/sisa 1 hari/)).toBeTruthy();
    expect(screen.queryByText(/Berakhir/)).toBeNull();
    list.unmount();
    wrap(runtime, <CustomerDetail id="c-09" />);
    expect(await screen.findByLabelText("Sisa, 1 hari")).toBeTruthy();
    expect(screen.queryByText(/Berakhir/)).toBeNull();
  });

  it("labels a package whose last day is tomorrow as ending tomorrow", async () => {
    const runtime = runtimeWith("approved", true);
    (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async () => ({
      customers: [customer("c-08", "Tomo", [{ ...sub(1), ends_on: inDays(1) }])],
      total: 1,
      packages: [],
    }));
    wrap(runtime, <CustomerList />);
    fireEvent.press(await screen.findByText(/Segera berakhir/));
    expect(await screen.findByText(/Berakhir besok/)).toBeTruthy();
  });
});

describe("Pelanggan loading and error states", () => {
  it("Pelanggan shows loading, hides counts", async () => {
    const runtime = runtimeWith("approved", true);
    (runtime.api.sellerCustomers as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    wrap(runtime, <CustomerList />);
    expect(await screen.findByLabelText("Memuat pelanggan")).toBeTruthy();
    expect(screen.queryByText(/^Aktif/)).toBeNull();
    expect(screen.queryByText(/^Selesai/)).toBeNull();
    expect(screen.queryByText("Belum ada pelanggan di sini.")).toBeNull();
  });

  it("Pelanggan error offers Coba lagi", async () => {
    const runtime = runtimeWith("approved", true);
    let failing = true;
    (runtime.api.sellerCustomers as jest.Mock).mockImplementation(async () => {
      if (failing) throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      return { customers, total: customers.length, packages: [] };
    });
    wrap(runtime, <CustomerList />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    failing = false;
    fireEvent.press(retry);
    expect(await screen.findByText("Aktif · 2")).toBeTruthy();
    expect(screen.queryByLabelText("Memuat pelanggan")).toBeNull();
  });

  it("Pelanggan detail error offers Coba lagi", async () => {
    const runtime = runtimeWith("approved", true);
    let failing = true;
    (runtime.api.sellerCustomers as jest.Mock).mockImplementation(async () => {
      if (failing) throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
      return { customers, total: customers.length, packages: [] };
    });
    wrap(runtime, <CustomerDetail id="c-01" />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    failing = false;
    fireEvent.press(retry);
    expect(await screen.findByText("Andre Kusuma")).toBeTruthy();
  });
});

describe("Pelanggan row feedback", () => {
  const touch = { nativeEvent: { touches: [], changedTouches: [] }, persist() {} };

  it("customer rows dim on press and still open the record", async () => {
    wrap(runtimeWith("approved", true), <CustomerList />);
    await screen.findByText("Andre Kusuma");
    const row = () => screen.getByRole("button", { name: /Andre Kusuma/ });
    expect(StyleSheet.flatten(row().props.style)?.opacity ?? 1).toBe(1);
    fireEvent(row(), "responderGrant", touch);
    expect(StyleSheet.flatten(row().props.style).opacity).toBe(0.7);
    fireEvent.press(row());
    // The link carries the customer's name, so the detail's header is final on its first frame.
    expect(router.push).toHaveBeenCalledWith("/pelanggan/c-01?title=Andre%20Kusuma");
  });

  it("chat button is 48dp", async () => {
    wrap(runtimeWith("approved", true), <CustomerList />);
    const chat = await screen.findByRole("link", { name: "Chat Andre Kusuma" });
    const flat = StyleSheet.flatten(chat.props.style);
    expect([flat.width, flat.height]).toEqual([48, 48]);
  });
});

/** Pelanggan and its detail on the Dapur scale (v2, 48 target): spec 3.2, boards Pelanggan and PelangganDetail. */
describe("Pelanggan on the Dapur scale", () => {
  const sty = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, any>;
  const phone = (width: number, fontScale: number) => {
    mockWindow = { width, height: 760, scale: 3, fontScale };
  };
  const dapur = (runtime: MobileRuntime, node: React.ReactNode) => wrap(runtime, withDapurScale(node));
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => customer(`c-${String(i).padStart(3, "0")}`, `Pelanggan ${i}`, [sub(10)]));
  const hold = (runtime: MobileRuntime) => {
    (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(() => new Promise(() => undefined));
    return runtime;
  };

  describe("header", () => {
    it("is a plain 48 row: Pelanggan in heroTitle, the + Pelanggan lama action 48 tall, no mood band and no empty row", async () => {
      dapur(runtimeWith("approved", true), <CustomerList />);
      const header = await screen.findByTestId("pelanggan-header");
      expect(within(header).queryByTestId("mood-fill", { includeHiddenElements: true })).toBeNull();
      const rows = within(header).getAllByTestId("mood-header-row");
      expect(rows).toHaveLength(1);
      expect(sty(rows[0]).minHeight).toBe(48);
      const title = within(header).getByText("Pelanggan");
      expect(title.props.accessibilityRole).toBe("header");
      expect(sty(title)).toMatchObject({ fontSize: 24, lineHeight: 30 });
      // The title and the action share the one row.
      expect(within(rows[0]).getByText("Pelanggan")).toBe(title);
      const add = within(rows[0]).getByRole("button", { name: "+ Pelanggan lama" });
      expect(sty(add).minHeight).toBe(48);
      // The whole 48 is inside the 48 row: no negative margin pulls it out (a touch outside a parent's bounds is lost on Android).
      expect(sty(add).marginVertical).toBeUndefined();
      expect(sty(add).marginRight).toBeUndefined();
      fireEvent.press(add);
      expect(router.push).toHaveBeenCalledWith("/impor");
    });

    it("gives + Pelanggan lama the tap haptic the Button had, once per press", async () => {
      const Haptics = require("expo-haptics") as { impactAsync: jest.Mock };
      dapur(runtimeWith("approved", true), <CustomerList />);
      const add = await screen.findByRole("button", { name: "+ Pelanggan lama" });
      Haptics.impactAsync.mockClear();
      fireEvent.press(add);
      expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenLastCalledWith("/impor");
    });

    it("stays the same while the list loads and when the read fails", async () => {
      const first = dapur(hold(runtimeWith("approved", true)), <CustomerList />);
      const header = await screen.findByTestId("pelanggan-header");
      expect(within(header).getByRole("button", { name: "+ Pelanggan lama" })).toBeTruthy();
      expect(sty(within(header).getByTestId("mood-header-row")).minHeight).toBe(48);
      first.unmount();
      const runtime = runtimeWith("approved", true);
      (runtime.api.sellerCustomers as jest.Mock).mockRejectedValue(Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" }));
      dapur(runtime, <CustomerList />);
      expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
      expect(within(screen.getByTestId("pelanggan-header")).getByRole("button", { name: "+ Pelanggan lama" })).toBeTruthy();
    });
  });

  describe("filter chips", () => {
    it("sit in a 48 frame, one row that scrolls sideways, with the 7 hit slop inside it; the counts are in the labels", async () => {
      dapur(runtimeWith("approved", true), <CustomerList />);
      expect(await screen.findByText("Aktif · 2")).toBeTruthy();
      const frame = screen.getByTestId("pelanggan-chips-frame");
      expect(sty(frame).height).toBe(48);
      const scroll = screen.getByTestId("pelanggan-chips");
      expect(scroll.props.horizontal).toBe(true);
      expect(sty(scroll).height).toBeGreaterThanOrEqual(48);
      for (const name of [/^Aktif/, /^Segera berakhir/, /^Selesai/]) {
        const chip = screen.getByRole("button", { name });
        expect(chip.props.hitSlop).toEqual({ top: 7, bottom: 7 });
        expect(sty(chip).minHeight).toBe(34);
        expect(within(frame).getByRole("button", { name })).toBe(chip);
      }
    });

    it("stay one scrolling row at 360dp and font scale 1.3, and hide their counts while the list loads", async () => {
      phone(360, 1.3);
      const first = dapur(hold(runtimeWith("approved", true)), <CustomerList />);
      expect(await screen.findByLabelText("Memuat pelanggan")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Aktif/ })).toBeNull();
      expect(screen.queryByText(/· \d/)).toBeNull();
      first.unmount();
      dapur(runtimeWith("approved", true), <CustomerList />);
      await screen.findByText("Aktif · 2");
      expect(screen.getByTestId("pelanggan-chips").props.horizontal).toBe(true);
      expect(sty(screen.getByTestId("pelanggan-chips")).flexWrap).toBeUndefined();
    });

    it("each filter shows its own customers, with the counts from the loaded list", async () => {
      dapur(runtimeWith("approved", true), <CustomerList />);
      expect(await screen.findByText("Aktif · 2")).toBeTruthy();
      expect(screen.getByText("Segera berakhir · 1")).toBeTruthy();
      expect(screen.getByText("Selesai · 1")).toBeTruthy();
      fireEvent.press(screen.getByRole("button", { name: /^Selesai/ }));
      expect(screen.getByText("Bayu Tri")).toBeTruthy();
      expect(screen.queryByText("Andre Kusuma")).toBeNull();
      fireEvent.press(screen.getByRole("button", { name: /^Segera berakhir/ }));
      expect(screen.getByText("Andre Kusuma")).toBeTruthy();
      expect(screen.queryByText("Dewi Saraswati")).toBeNull();
    });
  });

  describe("rows", () => {
    it("are TwoLineRows of 64 in one ListCard: rowTitle name, meta line, a 48 chat button, hairlines between", async () => {
      dapur(runtimeWith("approved", true, many(40)), <CustomerList />);
      await screen.findByText("Pelanggan 0");
      expect(screen.getAllByTestId("customer-row")).toHaveLength(40);
      expect(screen.getAllByTestId("list-card")).toHaveLength(1);
      expect(screen.getAllByTestId("list-card-separator")).toHaveLength(39);
      const row = screen.getByRole("button", { name: /Pelanggan 0,/ });
      expect(sty(row).minHeight).toBe(64);
      const name = screen.getByText("Pelanggan 0");
      expect(sty(name)).toMatchObject({ fontSize: 17, lineHeight: 22 });
      expect(name.props.numberOfLines).toBe(1);
      const chat = screen.getByRole("link", { name: "Chat Pelanggan 0" });
      expect([sty(chat).width, sty(chat).height]).toEqual([48, 48]);
      // The row opens the record, as before.
      fireEvent.press(row);
      expect(router.push).toHaveBeenCalledWith("/pelanggan/c-000?title=Pelanggan%200");
    });

    it("say package, days left and area on one meta line", async () => {
      const today = jakartaDay(new Date());
      const soon = { ...sub(1), ends_on: today };
      const later = { ...sub(9), ends_on: addDays(today, 9) };
      dapur(
        runtimeWith("approved", true, [
          customer("c-01", "Andre Kusuma", [later], { address: { line: "Kost Damai", area: "Setiabudi" } }),
          customer("c-02", "Sari Wulandari", [later, soon], { user_id: "u-s" }),
        ]),
        <CustomerList />,
      );
      await screen.findByText("Andre Kusuma");
      const meta = screen.getByText("Makan Siang Rumahan · sisa 9 hari · Setiabudi");
      expect(sty(meta)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      expect(meta.props.numberOfLines).toBe(1);
      // The package ending first leads, and "+n paket lain" stays.
      expect(screen.getByText("Makan Siang Rumahan · Berakhir hari ini · +1 paket lain · Setiabudi")).toBeTruthy();
    });

    it("keep the 64 row without a chat number: no chat button, the text takes the width", async () => {
      dapur(runtimeWith("approved", true, [customer("c-01", "Andre Kusuma", [sub(5)], { phone: null })]), <CustomerList />);
      await screen.findByText("Andre Kusuma");
      expect(screen.queryByRole("link", { name: /^Chat/ })).toBeNull();
      expect(sty(screen.getByRole("button", { name: /Andre Kusuma/ })).minHeight).toBe(64);
    });

    it("one customer is one row, no hairline; none says Belum ada pelanggan di sini and draws no empty card", async () => {
      const one = dapur(runtimeWith("approved", true, [customer("c-01", "Andre Kusuma", [sub(5)])]), <CustomerList />);
      await screen.findByText("Andre Kusuma");
      expect(screen.queryAllByTestId("list-card-separator")).toHaveLength(0);
      one.unmount();
      dapur(runtimeWith("approved", true, []), <CustomerList />);
      expect(await screen.findByText("Belum ada pelanggan di sini.")).toBeTruthy();
      expect(screen.queryByTestId("list-card")).toBeNull();
      expect(screen.getByText("Aktif · 0")).toBeTruthy();
    });
  });

  describe("detail", () => {
    const today = jakartaDay(new Date());
    const running = {
      ...sub(5),
      id: "s-run",
      starts_on: addDays(today, -6),
      ends_on: addDays(today, 5),
      portions: 2,
    };
    const deliveries = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `d-${i}`, service_date: addDays(today, i), status: i === 0 ? "delivered" : "scheduled" }));
    const record = (subs: ReturnType<typeof sub>[], extra: Partial<SellerCustomer> = {}) =>
      customer("c-01", "Andre Kusuma", subs as never, extra);
    const open = (list: SellerCustomer[], runtime = runtimeWith("approved", true, list)) => {
      (runtime.api as { sellerCustomers: jest.Mock }).sellerCustomers = jest.fn(async () => ({ customers: list, total: list.length, packages: [] }));
      return dapur(runtime, <CustomerDetail id="c-01" />);
    };

    it("opens with a meta status line, then one ListCard of five 40 key-value rows", async () => {
      open([record([running], { user_id: "u-a", origin: "marketplace" })]);
      const status = await screen.findByText("Aktif · Dari marketplace · dibayar lewat Catera");
      expect(sty(status)).toMatchObject({ fontSize: 13, lineHeight: 18 });
      const labels = ["Paket", "Mulai", "Selesai", "Sisa", "Porsi"];
      const values = [
        "Makan Siang Rumahan",
        shortDate(running.starts_on, "id"),
        shortDate(running.ends_on, "id"),
        "5 hari",
        "2 per hari",
      ];
      const block = screen.getAllByTestId("list-card")[0];
      for (const [i, label] of labels.entries()) {
        const row = within(block).getByLabelText(`${label}, ${values[i]}`);
        expect(sty(row).minHeight).toBe(40);
      }
      expect(within(block).getAllByTestId("list-card-separator")).toHaveLength(4);
    });

    it("an attention status reads Segera berakhir, a finished package Selesai", async () => {
      const first = open([record([{ ...running, remaining: 2 }])]);
      expect(await screen.findByText(/^Segera berakhir · Pelangganmu/)).toBeTruthy();
      first.unmount();
      open([record([{ ...sub(0, "completed"), starts_on: "2026-09-01", ends_on: "2026-09-12" }])]);
      expect(await screen.findByText(/^Selesai · Pelangganmu/)).toBeTruthy();
    });

    it("a package kept running past its booked last day shows only the days left, no past Selesai", async () => {
      open([record([{ ...running, ends_on: addDays(today, -1), remaining: 1 }])]);
      expect(await screen.findByLabelText("Sisa, 1 hari")).toBeTruthy();
      expect(screen.queryByLabelText(/^Selesai,/)).toBeNull();
    });

    it("puts WhatsApp and the renew action side by side at 50, the renew hint under them", async () => {
      open([record([running])]);
      const renew = await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
      const chat = screen.getByRole("button", { name: "Chat WhatsApp" });
      const row = screen.getByTestId("customer-actions");
      expect(sty(row)).toMatchObject({ flexDirection: "row", gap: 8 });
      expect(within(row).getByRole("button", { name: "Chat WhatsApp" })).toBe(chat);
      expect(within(row).getByRole("button", { name: "Kirim tautan perpanjang" })).toBe(renew);
      expect(sty(chat).minHeight).toBe(50);
      expect(sty(renew).minHeight).toBe(50);
      // The hint for an account-less customer sits under the row.
      expect(screen.getByText(/belum punya akun Catera/)).toBeTruthy();
      expect(within(row).queryByText(/belum punya akun Catera/)).toBeNull();
    });

    it("the renew error shows under the row with its retry", async () => {
      const runtime = runtimeWith("approved", true);
      (runtime.api.command as jest.Mock).mockRejectedValue(new Error("X"));
      open([record([running])], runtime);
      fireEvent.press(await screen.findByRole("button", { name: "Kirim tautan perpanjang" }));
      const message = await screen.findByText("Tautan perpanjang belum terkirim. Coba lagi.");
      expect(within(screen.getByTestId("customer-actions")).queryByText(message.props.children)).toBeNull();
    });

    it("the renew action alone takes the full row when the customer has no chat number; with neither there is no row", async () => {
      const first = open([record([running], { user_id: "u-a", phone: null })]);
      const renew = await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
      expect(screen.queryByRole("button", { name: "Chat WhatsApp" })).toBeNull();
      const row = screen.getByTestId("customer-actions");
      expect(within(row).getAllByRole("button")).toEqual([renew]);
      first.unmount();
      open([record([running], { phone: null })]);
      await screen.findByLabelText("Paket, Makan Siang Rumahan");
      expect(screen.queryByTestId("customer-actions")).toBeNull();
    });

    it("stacks the two buttons at 360dp whatever the font scale: the renew label does not fit beside WhatsApp", async () => {
      // 360 / 1.0 = 360 and 360 / 1.3 = 277 are both under the 400 effective width the row needs.
      for (const scale of [1, 1.3]) {
        phone(360, scale);
        const view = open([record([running])]);
        await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
        expect(sty(screen.getByTestId("customer-actions")).flexDirection).toBe("column");
        view.unmount();
      }
    });

    it("lets a 30-character package name wrap beside its label at 360dp and font scale 1.3 in English, ending on the same right edge", async () => {
      phone(360, 1.3);
      const list = [record([{ ...running, package_name: "Family Lunch Package Deluxe 30" }])];
      const runtime = runtimeWith("approved", true, list);
      // The stored locale is shared by every later test, so it is removed again however this one ends.
      const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
      const key = runtime.storageKey("locale");
      store.set(key, "en");
      try {
        open(list, runtime);
        const name = await screen.findByText("Family Lunch Package Deluxe 30");
        const row = screen.getByLabelText("Package, Family Lunch Package Deluxe 30");
        expect(name.props.numberOfLines).toBeUndefined();
        // The value sits at the right edge (auto left margin, no grow) and wraps within 60%; the label keeps its width.
        expect(sty(name)).toMatchObject({ marginLeft: "auto", flexShrink: 1, maxWidth: "60%", textAlign: "right" });
        expect(sty(name).flex).toBeUndefined();
        expect(sty(name).flexGrow).toBeUndefined();
        expect(sty(within(row).getByText("Package"))).toMatchObject({ flexShrink: 0, maxWidth: "40%" });
        // The date rows keep the default value (no wrap, no shrink), right-aligned with a label that grows to push it to the edge.
        const date = within(screen.getByLabelText(/^Starts,/)).getByText(shortDate(running.starts_on, "en"));
        expect(sty(date)).toMatchObject({ flexShrink: 0, textAlign: "right" });
        expect(sty(within(screen.getByLabelText(/^Starts,/)).getByText("Starts")).flex).toBe(1);
      } finally {
        store.delete(key);
      }
    });

    it("puts the two buttons side by side from 400 effective width (412dp at scale 1.0), each sharing the row, wrapping if they do not fit", async () => {
      // Both labels (about 100 and 180, with 16 padding either side and the 8 gap) come to about 350 of the 380 inner
      // width, so they share one line; the row wraps, so the renew button drops to a full-width line if a font is wider.
      phone(412, 1);
      open([record([running])]);
      const renew = await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
      const row = screen.getByTestId("customer-actions");
      expect(sty(row)).toMatchObject({ flexDirection: "row", flexWrap: "wrap", gap: 8 });
      for (const button of [renew, screen.getByRole("button", { name: "Chat WhatsApp" })]) {
        expect(sty(button)).toMatchObject({ flexGrow: 1, flexShrink: 0 });
      }
    });

    it("a lone action fills the row: the renew button alone grows to the full width", async () => {
      phone(412, 1);
      open([record([running], { user_id: "u-a", phone: null })]);
      const renew = await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
      expect(sty(renew).flexGrow).toBe(1);
    });

    it("draws the address in a 56 canvas-tone well, with its label and instructions", async () => {
      open([
        record([running], { address: { id: "a-1", label: "Rumah", line: "Jl. Melati 4", area: "Kebayoran", instructions: "Pagar hijau" } as never }),
      ]);
      expect(await screen.findByText("Alamat antar · Rumah")).toBeTruthy();
      const well = screen.getByTestId("customer-address");
      expect(sty(well)).toMatchObject({ minHeight: 56, backgroundColor: nativeThemes.light.well, borderRadius: 12 });
      expect(within(well).getByText("Jl. Melati 4, Kebayoran")).toBeTruthy();
      expect(within(well).getByText("Pagar hijau")).toBeTruthy();
    });

    it("caps a 12-delivery schedule at five 48 rows, then Lihat semua 12 shows them all in place", async () => {
      open([record([{ ...running, deliveries: deliveries(12) as never }])]);
      expect(await screen.findByText("Jadwal")).toBeTruthy();
      expect(screen.getAllByTestId("schedule-row")).toHaveLength(5);
      expect(sty(screen.getAllByTestId("schedule-row")[0]).minHeight).toBe(48);
      const more = screen.getByRole("button", { name: "Lihat semua 12" });
      expect(sty(more).minHeight).toBe(48);
      fireEvent.press(more);
      expect(screen.getAllByTestId("schedule-row")).toHaveLength(12);
      expect(screen.queryByRole("button", { name: "Lihat semua 12" })).toBeNull();
    });

    it("a schedule of five or fewer has no Lihat semua", async () => {
      open([record([{ ...running, deliveries: deliveries(5) as never }])]);
      await screen.findByText("Jadwal");
      expect(screen.getAllByTestId("schedule-row")).toHaveLength(5);
      expect(screen.queryByRole("button", { name: /^Lihat semua/ })).toBeNull();
    });

    it("three packages each get their key-value block and renew button, and each its own schedule", async () => {
      const a = { ...running, id: "s-a", package_name: "Paket A", deliveries: deliveries(2) as never };
      const b = { ...running, id: "s-b", package_name: "Paket B", ends_on: addDays(today, 6), deliveries: deliveries(7) as never };
      const c = { ...running, id: "s-c", package_name: "Paket C", ends_on: addDays(today, 7), deliveries: [] as never };
      open([record([c, b, a], { user_id: "u-a" })]);
      await screen.findByLabelText("Paket, Paket A");
      expect(screen.getByLabelText("Paket, Paket B")).toBeTruthy();
      expect(screen.getByLabelText("Paket, Paket C")).toBeTruthy();
      expect(screen.getAllByRole("button", { name: "Kirim tautan perpanjang" })).toHaveLength(3);
      // Only the first package's row carries WhatsApp.
      expect(screen.getAllByRole("button", { name: "Chat WhatsApp" })).toHaveLength(1);
      // Schedules: Paket A and B have deliveries, C none; each shows its own section.
      expect(screen.getAllByText("Jadwal")).toHaveLength(2);
      expect(screen.getAllByTestId("schedule-row")).toHaveLength(2 + 5);
      expect(screen.getAllByRole("button", { name: "Lihat semua 7" })).toHaveLength(1);
    });

    it("says so when the customer is not there", async () => {
      dapur(runtimeWith("approved", true, []), <CustomerDetail id="c-404" />);
      expect(await screen.findByText("Pelanggan ini tidak ditemukan.")).toBeTruthy();
    });
  });
});
