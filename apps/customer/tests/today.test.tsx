import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays } from "@catera/domain";
import { Beranda } from "../src/today/Beranda";
import { customerLink } from "../src/links";
import { Masuk } from "../src/account/Masuk";
import * as offline from "../src/today/offline";
import { customerState, delivery, TODAY } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
// In-memory SecureStore so the review dismissal persists within a test.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));
jest.mock("../src/today/offline", () => ({
  saveCachedCustomer: jest.fn(async () => undefined),
  loadCachedCustomer: jest.fn(async () => null),
}));

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(
  state: () => Promise<unknown>,
  actor: Record<string, unknown> | null = customer,
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(state),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderHome = (runtime: MobileRuntime) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <Beranda />
    </MobileProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

it("shows the on-the-way plate and confirms arrival", async () => {
  const runtime = runtimeWith(async () =>
    customerState({ status: "out_for_delivery", departed_at: `${TODAY}T03:42:00Z` }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Sedang diantar")).toBeTruthy();
  expect(screen.getByText("tiba sekitar 11.00–13.00")).toBeTruthy();
  expect(screen.getByText("Berangkat 10.42")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Sudah sampai" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "delivery.confirm",
      { deliveryId: "d-today", meal: "lunch" },
      expect.any(String),
    ),
  );
});

it("Belum opens the report screen preselected", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "out_for_delivery" })));
  fireEvent.press(await screen.findByRole("button", { name: "Belum" }));
  expect(router.push).toHaveBeenCalledWith("/masalah/d-today?meal=lunch&jenis=belum");
});

it("offers a private reaction after arrival", async () => {
  const runtime = runtimeWith(async () =>
    customerState({ status: "delivered", confirmed_at: `${TODAY}T04:48:00Z` }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Sudah sampai")).toBeTruthy();
  expect(screen.getByText("pukul 11.48")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Enak" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "delivery.react",
      { deliveryId: "d-today", meal: "lunch", reaction: "enak" },
      expect.any(String),
    ),
  );
});

it("lists the next days as rows", async () => {
  renderHome(runtimeWith(async () => customerState({ status: "scheduled" })));
  expect(await screen.findByText(/^Besok, /)).toBeTruthy();
  expect(screen.getAllByText("Ayam bakar madu, Sayur asem").length).toBeGreaterThan(1);
});

it("shows the renewal card at three days left", async () => {
  renderHome(runtimeWith(async () => customerState(null, { subscription: { remaining: 3 } })));
  expect(await screen.findByText("Sisa 3 hari")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Perpanjang" }));
  expect(router.push).toHaveBeenCalledWith("/renew/s-1");
});

it("asks for a review once near the end", async () => {
  const past = delivery("d-past", addDays(TODAY, -1), { status: "delivered" }, { status: "delivered" });
  const runtime = runtimeWith(async () =>
    customerState(null, { subscription: { remaining: 2 }, past: [past] }),
  );
  renderHome(runtime);
  expect(await screen.findByText("Bagaimana Dapur Contoh selama ini?")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Nanti saja" }));
  await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Contoh selama ini?")).toBeNull());
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("catera.review.s-1", "dismissed");
});

it("sends the review with the existing review.save payload", async () => {
  const past = delivery("d-past", addDays(TODAY, -1), { status: "delivered" }, { status: "delivered" });
  const runtime = runtimeWith(async () =>
    customerState(null, { subscription: { remaining: 2 }, past: [past] }),
  );
  renderHome(runtime);
  fireEvent.press(await screen.findByText("Bagaimana Dapur Contoh selama ini?"));
  fireEvent.press(screen.getByRole("button", { name: "4 bintang" }));
  fireEvent.changeText(screen.getByLabelText("Cerita singkat (opsional)"), "Enak dan tepat waktu");
  fireEvent.press(screen.getByRole("button", { name: "Kirim ulasan" }));
  await waitFor(() =>
    expect(runtime.api.command).toHaveBeenCalledWith(
      "review.save",
      { subscriptionId: "s-1", rating: 4, food: 4, delivery: 4, value: 4, body: "Enak dan tepat waktu" },
      expect.any(String),
    ),
  );
  await waitFor(() => expect(screen.queryByText("Bagaimana Dapur Contoh selama ini?")).toBeNull());
});

it("signed out shows Mau makan apa minggu ini?", async () => {
  renderHome(runtimeWith(async () => customerState(null), null));
  expect(await screen.findByText("Mau makan apa minggu ini?")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
  expect(router.push).toHaveBeenCalledWith("/login");
});

it("offline shows the cached day and when it was updated", async () => {
  (offline.loadCachedCustomer as jest.Mock).mockResolvedValue({
    savedAt: "2026-10-07T23:12:00.000Z",
    data: customerState({ status: "out_for_delivery" }),
  });
  renderHome(
    runtimeWith(async () => {
      throw Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
    }),
  );
  expect(await screen.findByText("Sedang diantar")).toBeTruthy();
  expect(screen.getByText(/Terakhir diperbarui 06\.12/)).toBeTruthy();
  expect(offline.loadCachedCustomer).toHaveBeenCalledWith("u-c1");
});

describe("customerLink", () => {
  it("maps server hrefs to the customer app routes", () => {
    expect(customerLink("/today")).toBe("/");
    expect(customerLink("/home")).toBe("/");
    expect(customerLink("/deliveries/d-1")).toBe("/hari/d-1");
    expect(customerLink("/subscriptions/s-1")).toBe("/jadwal");
    expect(customerLink("/claim/tok_abc")).toBe("/claim/tok_abc");
    expect(customerLink("/renew/s-1")).toBe("/renew/s-1");
    expect(customerLink("/seller")).toBe("/");
    expect(customerLink("https://evil.example/x")).toBe("/");
    expect(customerLink("//evil.example/x")).toBe("/");
  });
});

describe("Masuk", () => {
  it("signs in with the phone code first and offers email on request", async () => {
    const runtime = runtimeWith(async () => customerState(null), null);
    runtime.sendPhoneOtp = jest.fn(async () => undefined);
    runtime.verifyPhoneOtp = jest.fn(async () => customer as never);
    render(
      <MobileProvider runtime={runtime} linkMapper={customerLink}>
        <Masuk />
      </MobileProvider>,
    );
    expect(screen.queryByLabelText("Kata sandi")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Nomor HP"), "0812 3456 7890");
    fireEvent.press(screen.getByRole("button", { name: "Kirim kode" }));
    await waitFor(() => expect(runtime.sendPhoneOtp).toHaveBeenCalledWith("+6281234567890"));
    fireEvent.changeText(await screen.findByLabelText("Kode dari SMS"), "123456");
    fireEvent.press(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(runtime.verifyPhoneOtp).toHaveBeenCalledWith("+6281234567890", "123456", "Pelanggan", expect.any(String));
    fireEvent.press(screen.getByRole("button", { name: "Masuk dengan email" }));
    expect(screen.getByLabelText("Kata sandi").props.secureTextEntry).toBe(true);
  });
});
