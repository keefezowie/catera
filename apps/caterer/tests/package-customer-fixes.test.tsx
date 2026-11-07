import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import type { SellerCustomer } from "@catera/domain";
import { PackageEditor } from "../src/business/PackageEditor";
import { UangScreen } from "../src/business/UangScreen";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { CustomerList } from "../src/customers/CustomerList";
import { withDapurScale } from "./dapur-scale";
import { hostsOf } from "./host-queries";
import { confirm, lastConfirm, resetSheets } from "./sheet-host";

jest.mock("expo-router", () => ({
  ...require("./sheet-host").routerModule,
  useLocalSearchParams: () => ({ id: "p-1", from: "p-1" }),
}));
jest.mock("@catera/mobile-ui", () => require("./sheet-host").mobileUiModule());
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
// The empty form is not a publishable one; `mockIssues` decides what the rules say.
let mockIssues: Record<string, string> = {};
jest.mock("../src/business/package", () => ({
  ...jest.requireActual("../src/business/package"),
  packageIssues: () => mockIssues,
  nutritionIssues: () => ({}),
}));

const { router } = jest.requireMock("expo-router") as { router: { push: jest.Mock } };
const NewPackageRoute = require("../app/(tabs)/(index,pelanggan,menu,usaha)/paket/baru").default as () => React.JSX.Element;
const PackageRoute = require("../app/(tabs)/(index,pelanggan,menu,usaha)/paket/[id]").default as () => React.JSX.Element;

const down = () => Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const mount = async (runtime: MobileRuntime, ui: React.ReactNode) =>
  await render(
    withDapurScale(
      <MobileProvider runtime={runtime} linkMapper={(h) => h}>
        <ToastProvider>{ui}</ToastProvider>
      </MobileProvider>,
    ),
  );

beforeEach(() => {
  resetSheets();
  confirm.mockClear();
  router.push.mockClear();
  mockIssues = {};
});

describe("Terbitkan paket", () => {
  const publish = async () => fireEvent.press(await screen.findByRole("button", { name: "Terbitkan paket" }));
  const fill = async () => {
    await fireEvent.changeText(await screen.findByLabelText("Harga per porsi (Rp)"), "28000");
    await fireEvent.press(screen.getByRole("button", { name: /^Sen$/ }));
  };

  it("asks first, naming the price and the days; a cancel sends nothing", async () => {
    const command = jest.fn(async () => ({ id: "p-1" }));
    await mount(runtimeWith({ command }), <PackageEditor />);
    await fill();
    await publish();
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    const asked = lastConfirm();
    expect(asked.message).toMatch(/28[.]000/);
    // The days as they stand: Sen was just switched off.
    expect(asked.message).toContain("Sel, Rab, Kam, Jum");
    expect(asked.message).not.toContain("Sen");
    expect(asked.message).toContain("tidak bisa diubah");
    await asked.press(asked.cancelLabel);
    expect(command).not.toHaveBeenCalled();
  });

  it("a form the rules refuse never reaches the question", async () => {
    mockIssues = { name: "Isi nama paket" };
    await mount(runtimeWith({ command: jest.fn() }), <PackageEditor />);
    await publish();
    expect(await screen.findByText("Isi nama paket")).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("a second press after a lost answer sends the same slug and request id", async () => {
    const command = jest.fn(async (_action: string, _payload: { slug: string }, _id: string) => {
      throw down();
    });
    await mount(runtimeWith({ command }), <PackageEditor />);
    await fireEvent.changeText(await screen.findByLabelText("Nama paket"), "Makan Siang");
    await publish();
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    await lastConfirm().press("Terbitkan");
    await screen.findByTestId("form-error-save");
    // Later than the first press by more than the clock's resolution of the old suffix.
    const now = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    await publish();
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    await lastConfirm().press("Terbitkan");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    now.mockRestore();
    const [first, second] = command.mock.calls;
    expect(first[1].slug).toMatch(/^makan-siang-/);
    expect(second[1].slug).toBe(first[1].slug);
    expect(second[2]).toBe(first[2]);
  });
});

const customer = {
  id: "c-1", caterer_id: "k-1", user_id: "u-9", name: "Andre", phone: "+6281234500001",
  address: { id: "a-1", label: "", line: "", area: "", instructions: "" },
  origin: "seller", version: 1, claim_review: null,
  subscriptions: [{
    id: "s-1", package_id: "p-1", package_name: "Makan Siang", meal: "lunch", portions: 1, starts_on: "2026-10-01", ends_on: "2026-10-09",
    status: "active", remaining: 1, next_delivery: "2026-10-08", legacy: true, renewed_from: null, external_reference: null,
    payment_route: "external_reported", renewal_status: "unknown", prepared_at: null, trial: false, deliveries: [],
  }],
} as unknown as SellerCustomer;
const customers = jest.fn(async () => ({ customers: [customer], total: 1, packages: [] }));

describe("Kirim tautan perpanjang while the payments read has no answer", () => {
  it("a failed read neither redirects nor lets the button send", async () => {
    const sellerOperations = jest.fn(async () => {
      throw down();
    });
    await mount(runtimeWith({ sellerCustomers: customers, sellerOperations, request: jest.fn(async () => null) }), <CustomerDetail id="c-1" />);
    const renew = await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
    await waitFor(() => expect(sellerOperations).toHaveBeenCalled());
    expect(renew.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(renew);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("an answer that says off still goes to the setup screen", async () => {
    const sellerOperations = jest.fn(async () => ({ caterer: { id: "k-1", status: "draft" }, offers: [], datedMenus: [] }));
    await mount(runtimeWith({ sellerCustomers: customers, sellerOperations, request: jest.fn(async () => null) }), <CustomerDetail id="c-1" />);
    const name = { name: "Kirim tautan perpanjang" };
    await waitFor(() => expect(screen.getByRole("button", name).props.accessibilityState.disabled).toBeFalsy());
    await fireEvent.press(screen.getByRole("button", name));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/aktifkan"));
  });
});

describe("the customer row", () => {
  it("keeps the chat link outside the row's button, so a screen reader reaches both", async () => {
    await mount(runtimeWith({ sellerCustomers: customers }), <CustomerList />);
    const chat = await screen.findByRole("link", { name: "Chat Andre" });
    const row = screen.getByRole("button", { name: /^Andre/ });
    let node = chat.parent;
    while (node) {
      expect(node).not.toBe(row);
      node = node.parent;
    }
  });
});

describe("a failed package read", () => {
  it.each([
    ["Paket baru from a copy", NewPackageRoute],
    ["the package screen", PackageRoute],
  ])("%s offers Coba lagi, and the retry reads again", async (_name, Route) => {
    const sellerOperations = jest.fn(async () => {
      throw down();
    });
    await mount(runtimeWith({ sellerOperations }), <Route />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    const before = sellerOperations.mock.calls.length;
    await act(async () => {
      await fireEvent.press(retry);
    });
    expect(sellerOperations.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("pull to refresh", () => {
  const pullDown = () =>
    act(async () => {
      hostsOf("RCTScrollView").find((n) => n.props.refreshControl != null)!.props.refreshControl.props.onRefresh();
    });

  it("Uang reads the money again", async () => {
    const settlement = jest.fn(async () => ({
      available: "532000", nextPayoutAt: null, expected: "0", earned: "0", held: "0", reserved: "0", paid: "0", recovery: "0",
      entries: [], payouts: [], payoutReadiness: "ready", policy: null,
    }));
    await mount(runtimeWith({ settlement }), <UangScreen />);
    await screen.findByTestId("uang-available");
    const before = settlement.mock.calls.length;
    await pullDown();
    await waitFor(() => expect(settlement.mock.calls.length).toBeGreaterThan(before));
  });

  it("a customer reads again, with the page still there", async () => {
    const read = jest.fn(async () => ({ customers: [customer], total: 1, packages: [] }));
    await mount(runtimeWith({ sellerCustomers: read, sellerOperations: jest.fn(async () => ({ caterer: { id: "k-1", status: "approved" }, offers: [] })), request: jest.fn(async () => null) }), <CustomerDetail id="c-1" />);
    await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
    const before = read.mock.calls.length;
    await pullDown();
    await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByRole("button", { name: "Kirim tautan perpanjang" })).toBeTruthy();
  });
});
