import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays, jakartaDay, shortDate, type SellerCustomer } from "@catera/domain";
import { activeEndLabel, customerStatus, endLabel, paymentsActive, renewalAction } from "../src/customers/rules";
import { CustomerList } from "../src/customers/CustomerList";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { canvasDay } from "./fixtures";

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

beforeEach(() => jest.clearAllMocks());

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
  // One customer with a single delivery left is both on a running package and about to end.
  wrap(runtimeWith("approved", true, [customer("c-09", "Rina Maharani", [sub(1)])]), <CustomerList />);
  expect(await screen.findByText("Aktif · 1")).toBeTruthy();
  expect(screen.getByText("Segera berakhir · 1")).toBeTruthy();
  expect(screen.getByText("Selesai · 0")).toBeTruthy();
  // The Aktif list shows her, with the end label kept.
  expect(screen.getByText("Rina Maharani")).toBeTruthy();
  expect(screen.getByText(/^Berakhir/)).toBeTruthy();
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
  expect(await screen.findByText("2026-10-08")).toBeTruthy();
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

  it("lists every active package, soonest ending first, each with its own end line", async () => {
    wrap(withMulti(runtimeWith("approved", true)), <CustomerDetail id="c-07" />);
    expect(await screen.findByText("Berakhir hari ini · sisa 1 hari")).toBeTruthy();
    expect(screen.getByText(`Berakhir ${shortDate(inDays(9), "id")} · sisa 9 hari`)).toBeTruthy();
    const names = screen.getAllByText(/porsi$/).map((n) => String(n.props.children));
    expect(names[0]).toContain("Makan Siang Rumahan");
    expect(names[1]).toContain("Paket Hemat Kantor");
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
    expect(screen.getByText("+1 paket lain")).toBeTruthy();
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
    expect(await screen.findByText("Sisa 1 hari")).toBeTruthy();
    expect(screen.queryByText(/^Berakhir/)).toBeNull();
    list.unmount();
    wrap(runtime, <CustomerDetail id="c-09" />);
    expect(await screen.findByText("Sisa 1 hari")).toBeTruthy();
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
    expect(await screen.findByText("Memuat pelanggan…")).toBeTruthy();
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
    expect(screen.queryByText("Memuat pelanggan…")).toBeNull();
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
    expect(router.push).toHaveBeenCalledWith("/pelanggan/c-01");
  });

  it("chat button is 48dp", async () => {
    wrap(runtimeWith("approved", true), <CustomerList />);
    const chat = await screen.findByRole("link", { name: "Chat Andre Kusuma" });
    const flat = StyleSheet.flatten(chat.props.style);
    expect([flat.width, flat.height]).toEqual([48, 48]);
  });
});
