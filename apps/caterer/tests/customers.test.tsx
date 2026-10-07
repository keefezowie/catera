import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SellerCustomer } from "@catera/domain";
import { customerStatus, paymentsActive, renewalAction } from "../src/customers/rules";
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

function runtimeWith(caterStatus: string, payoutActive: boolean): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  const day = canvasDay();
  (day.caterer as { status?: string }).status = caterStatus;
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    sellerCustomers: jest.fn(async () => ({ customers, total: 3, packages: [] })),
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
