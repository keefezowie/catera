import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { jakartaDay, type SellerCustomer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { UangScreen } from "../src/business/UangScreen";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { BelanjaScreen } from "../src/today/BelanjaScreen";
import { ProofSheet, resetProofDrafts } from "../src/today/ProofSheet";
import * as proof from "../src/today/proof";
import { canvasDay, emptyDay } from "./fixtures";
import { hostsOf } from "./host-queries";
import { render } from "./render-dapur";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("../src/today/proof", () => ({
  shrinkProof: jest.fn(async (photo: { uri: string }) => ({ uri: `small:${photo.uri}` })),
  uploadProof: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const down = () => Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
const REFRESH_FAILED = "Belum bisa memperbarui. Tarik lagi untuk mencoba.";

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    request: jest.fn(async () => null),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}
const mount = async (runtime: MobileRuntime, ui: React.ReactElement) =>
  await render(
    <MobileProvider runtime={runtime} linkMapper={(h) => h}>
      <ToastProvider>{ui}</ToastProvider>
    </MobileProvider>,
  );
const pullDown = () =>
  act(async () => {
    hostsOf("RCTScrollView").find((n) => n.props.refreshControl != null)!.props.refreshControl.props.onRefresh();
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
const approved = { caterer: { id: "k-1", status: "approved" }, offers: [], datedMenus: [] };
const customers = async () => ({ customers: [customer], total: 1, packages: [] });
const settled = {
  available: "532000", nextPayoutAt: null, expected: "0", earned: "0", held: "0", reserved: "0", paid: "0", recovery: "0",
  entries: [], payouts: [], payoutReadiness: "ready", policy: null,
};

beforeEach(() => jest.clearAllMocks());

describe("the renewal button when the payments read failed", () => {
  const PAYMENTS_FAILED = /Status pembayaran belum bisa dicek/;

  it("says why it waits, and Coba lagi reads again and frees it", async () => {
    const sellerOperations = jest.fn(async (): Promise<unknown> => {
      throw down();
    });
    await mount(runtimeWith({ sellerCustomers: jest.fn(customers), sellerOperations }), <CustomerDetail id="c-1" />);
    expect(await screen.findByText(PAYMENTS_FAILED)).toBeTruthy();
    const renew = { name: "Kirim tautan perpanjang" };
    expect(screen.getByRole("button", renew).props.accessibilityState.disabled).toBe(true);
    sellerOperations.mockResolvedValue(approved);
    await fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() => expect(screen.getByRole("button", renew).props.accessibilityState.disabled).toBeFalsy());
    expect(screen.queryByText(PAYMENTS_FAILED)).toBeNull();
  });

  it("a pull re-reads it too", async () => {
    const sellerOperations = jest.fn(async (): Promise<unknown> => {
      throw down();
    });
    await mount(runtimeWith({ sellerCustomers: jest.fn(customers), sellerOperations }), <CustomerDetail id="c-1" />);
    await screen.findByText(PAYMENTS_FAILED);
    sellerOperations.mockResolvedValue(approved);
    await pullDown();
    await waitFor(() => expect(screen.queryByText(PAYMENTS_FAILED)).toBeNull());
    // It failed with nothing to replace: the explanation said so, the pull that fixed it needs no toast.
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
  });
});

describe("a pull that fails says so, and a good one says nothing", () => {
  it("a customer", async () => {
    const sellerCustomers = jest.fn(customers);
    await mount(runtimeWith({ sellerCustomers, sellerOperations: jest.fn(async () => approved) }), <CustomerDetail id="c-1" />);
    await screen.findByRole("button", { name: "Kirim tautan perpanjang" });
    await pullDown();
    await waitFor(() => expect(sellerCustomers.mock.calls.length).toBeGreaterThan(1));
    await act(async () => undefined);
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
    sellerCustomers.mockRejectedValue(down());
    await pullDown();
    expect(await screen.findByText(REFRESH_FAILED)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim tautan perpanjang" })).toBeTruthy();
  });

  it("Uang keeps its figures", async () => {
    const settlement = jest.fn(async (): Promise<unknown> => settled);
    await mount(runtimeWith({ settlement }), <UangScreen />);
    await screen.findByTestId("uang-available");
    await pullDown();
    await act(async () => undefined);
    expect(screen.queryByText(REFRESH_FAILED)).toBeNull();
    settlement.mockRejectedValue(down());
    await pullDown();
    expect(await screen.findByText(REFRESH_FAILED)).toBeTruthy();
    expect(screen.getByTestId("uang-available")).toBeTruthy();
  });

  it("Belanja keeps the recap, labelled as old, until a read lands", async () => {
    const sellerOperations = jest.fn(async (_id: string, date?: string): Promise<unknown> => ({ ...canvasDay(), operationalDate: date }));
    await mount(runtimeWith({ sellerOperations }), <BelanjaScreen />);
    await screen.findByTestId("belanja-total");
    expect(screen.queryByTestId("belanja-stale")).toBeNull();
    sellerOperations.mockRejectedValue(down());
    await pullDown();
    expect(await screen.findByText(REFRESH_FAILED)).toBeTruthy();
    expect(screen.getByTestId("belanja-total")).toBeTruthy();
    expect(screen.getByTestId("belanja-stale").props.children).toMatch(/^Menampilkan data terakhir, \d\d\.\d\d$/);
    sellerOperations.mockImplementation(async (_id, date) => ({ ...canvasDay(), operationalDate: date }));
    await pullDown();
    await waitFor(() => expect(screen.queryByTestId("belanja-stale")).toBeNull());
  });

  it("Belanja's empty recap is labelled too: no orders may only mean an old read", async () => {
    const sellerOperations = jest.fn(async (_id: string, date?: string): Promise<unknown> => ({ ...emptyDay(), operationalDate: date }));
    await mount(runtimeWith({ sellerOperations }), <BelanjaScreen />);
    await screen.findByTestId("belanja-empty");
    sellerOperations.mockRejectedValue(down());
    await pullDown();
    expect(await screen.findByTestId("belanja-stale")).toBeTruthy();
  });
});

describe("a proof photo retaken while the old one uploads", () => {
  const TODAY = jakartaDay(new Date());

  it("stays, and is the one the retry sends", async () => {
    resetProofDrafts();
    const day = canvasDay();
    day.operationalDate = TODAY;
    day.deliveries = day.deliveries.map(
      (d) =>
        ({
          ...d,
          service_date: TODAY,
          status: "out_for_delivery",
          meals: [{ meal: "lunch", status: "out_for_delivery", cooking_started_at: `${TODAY}T01:00:00Z`, departed_at: `${TODAY}T02:00:00Z` }],
        }) as typeof d,
    );
    const id = day.deliveries[0].id;
    const shot = (uri: string) =>
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: false, assets: [{ uri, width: 3000, height: 4000 }] });
    let finishOld: (path: string) => void = () => undefined;
    (proof.uploadProof as jest.Mock).mockImplementationOnce(() => new Promise((done) => (finishOld = done)));
    (proof.uploadProof as jest.Mock).mockResolvedValue("k-1/new.jpg");
    const command = jest.fn(async (): Promise<unknown> => {
      throw down();
    });
    await mount(runtimeWith({ sellerOperations: jest.fn(async () => day), command }), <ProofSheet ids={[id]} meal="lunch" date={TODAY} />);

    shot("old.jpg");
    await fireEvent.press(await screen.findByLabelText(/^Ambil foto:/));
    await waitFor(() => expect(screen.getByText("Foto siap")).toBeTruthy());
    await fireEvent.press(screen.getByRole("button", { name: "Sampai (1)" }));
    await waitFor(() => expect(proof.uploadProof).toHaveBeenCalledTimes(1));

    shot("new.jpg");
    await fireEvent.press(screen.getByLabelText(/^Ganti foto:/));
    await waitFor(() => expect(screen.getByTestId(`proof-photo-${id}`).props.source).toMatchObject({ uri: "small:new.jpg" }));

    await act(async () => finishOld("k-1/old.jpg"));
    await waitFor(() => expect(command).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId(`proof-photo-${id}`).props.source).toMatchObject({ uri: "small:new.jpg" });

    // delivery.arrive failed, so nothing is final yet: the retry sends the retaken photo, not the old path.
    await fireEvent.press(screen.getByRole("button", { name: "Sampai (1)" }));
    await waitFor(() => expect(proof.uploadProof).toHaveBeenCalledTimes(2));
    expect((proof.uploadProof as jest.Mock).mock.calls[1][1]).toBe("small:new.jpg");
    await waitFor(() => expect(command).toHaveBeenCalledTimes(2));
    expect((command.mock.calls[1] as unknown[])[1]).toMatchObject({ photos: { [id]: "k-1/new.jpg" } });
  });
});
