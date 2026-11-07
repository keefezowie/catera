import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { nativeThemes } from "@catera/design-tokens";
import { todayPlates } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { ToastProvider } from "@catera/mobile-ui";
import { NotificationsScreen } from "../src/account/Notifications";
import { Payments } from "../src/account/Payments";
import { SavedList } from "../src/discover/SavedList";
import { ChatKatering } from "../src/help/ChatKatering";
import { ReportList } from "../src/help/ReportList";
import { customerLink } from "../src/links";
import { Plate } from "../src/today/Plate";
import { customerState, offer, TODAY } from "./fixtures";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
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
  forgetCachedCustomer: jest.fn(async () => undefined),
}));

const actor = { id: "u-c1", role: "customer", name: "Rani Contoh" };

function runtimeWith(state: object = customerState(null)): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(async () => state),
    customerActions: jest.fn(async () => ({ total: 0, items: [] })),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const mount = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={customerLink}>
      <ToastProvider>{ui}</ToastProvider>
    </MobileProvider>,
  );

const unread = (id: string) => ({
  id,
  kind: "delivery",
  body: `Kabar ${id}`,
  href: "/deliveries/d-1",
  read_at: null,
  created_at: `${TODAY}T03:15:00Z`,
});

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("Notifikasi", () => {
  it("opens an unread update at once, without waiting on the read, and clears its dot", async () => {
    const runtime = runtimeWith({ ...customerState(null), notifications: [unread("n-1")] });
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    await mount(runtime, <NotificationsScreen />);
    await fireEvent.press(await screen.findByText("Kabar n-1"));
    expect(router.push).toHaveBeenCalledWith("/hari/d-1");
    expect(runtime.api.command).toHaveBeenCalledWith("notification.read", { id: "n-1" }, expect.any(String));
    expect(screen.queryAllByTestId("unread-dot")).toHaveLength(0);
  });

  it("a failed read says nothing and the update still opens", async () => {
    const runtime = runtimeWith({ ...customerState(null), notifications: [unread("n-1")] });
    (runtime.api.command as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    await mount(runtime, <NotificationsScreen />);
    await fireEvent.press(await screen.findByText("Kabar n-1"));
    await act(async () => {});
    expect(router.push).toHaveBeenCalledWith("/hari/d-1");
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("Tandai semua dibaca sends five at once, then the next five", async () => {
    const notes = ["1", "2", "3", "4", "5", "6", "7"].map((n) => unread(`n-${n}`));
    const runtime = runtimeWith({ ...customerState(null), notifications: notes });
    const pending: (() => void)[] = [];
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise((done) => pending.push(() => done({}))));
    await mount(runtime, <NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Tandai semua dibaca" }));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(5));
    await act(async () => pending.splice(0).forEach((done) => done()));
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledTimes(7));
    const reads = runtime.api.customer as jest.Mock;
    const before = reads.mock.calls.length;
    await act(async () => pending.splice(0).forEach((done) => done()));
    // One reload for the whole pass.
    await waitFor(() => expect(reads.mock.calls.length).toBe(before + 1));
  });

  it("a failed batch ends the pass", async () => {
    const notes = ["1", "2", "3", "4", "5", "6"].map((n) => unread(`n-${n}`));
    const runtime = runtimeWith({ ...customerState(null), notifications: notes });
    (runtime.api.command as jest.Mock).mockRejectedValue(new Error("REQUEST_TIMEOUT"));
    await mount(runtime, <NotificationsScreen />);
    await fireEvent.press(await screen.findByRole("button", { name: "Tandai semua dibaca" }));
    expect(await screen.findByText("Belum semua ditandai dibaca. Coba lagi.")).toBeTruthy();
    expect(runtime.api.command).toHaveBeenCalledTimes(5);
  });
});

describe("the reactions", () => {
  const state = customerState({ status: "delivered", confirmed_at: `${TODAY}T05:00:00Z`, confirmed_by: "customer" });
  const plate = todayPlates(state, new Date(`${TODAY}T06:00:00Z`))[0];
  const fill = (name: string) => StyleSheet.flatten(screen.getByRole("button", { name }).props.style).backgroundColor;

  it("marks the tapped one at once, and puts it back when the command fails", async () => {
    const runtime = runtimeWith(state);
    let fail: (e: Error) => void = () => undefined;
    (runtime.api.command as jest.Mock).mockImplementation(() => new Promise((_, no) => (fail = no)));
    await mount(runtime, <Plate plate={plate} apiBase="https://api.example.test" variant="card" />);
    expect(fill("Enak")).not.toBe(nativeThemes.light.forest);
    await fireEvent.press(screen.getByRole("button", { name: "Enak" }));
    expect(fill("Enak")).toBe(nativeThemes.light.forest);
    expect(runtime.api.command).toHaveBeenCalledTimes(1);
    await act(async () => fail(new Error("REQUEST_TIMEOUT")));
    expect(fill("Enak")).not.toBe(nativeThemes.light.forest);
  });
});

describe("a WhatsApp link that cannot open", () => {
  afterEach(() => jest.restoreAllMocks());

  it("ChatKatering says so", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no app"));
    await mount(runtimeWith(), <ChatKatering phone="081200000001" />);
    await fireEvent.press(await screen.findByRole("button", { name: "Chat katering" }));
    expect(await screen.findByText("WhatsApp belum bisa dibuka.")).toBeTruthy();
  });

  it("a failed plate's chat says so", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no app"));
    const state = customerState({ status: "issue", departed_at: `${TODAY}T03:42:00Z` }, { catererPhone: "+6281200000001" });
    const plate = todayPlates(state, new Date(`${TODAY}T06:00:00Z`))[0];
    await mount(runtimeWith(state), <Plate plate={plate} apiBase="https://api.example.test" variant="card" />);
    await fireEvent.press(await screen.findByRole("button", { name: /^Chat / }));
    expect(await screen.findByText("WhatsApp belum bisa dibuka.")).toBeTruthy();
  });
});

describe("Lihat lebih banyak", () => {
  it("shows busy and a second tap sends nothing", async () => {
    const paket = offer({ id: "p-1", name: "Nasi Ayam Bakar" });
    const runtime = runtimeWith();
    let finish: (page: object) => void = () => undefined;
    (runtime.api.savedPackages as jest.Mock).mockImplementation((cursor?: string) =>
      cursor
        ? new Promise((done) => (finish = done))
        : Promise.resolve({
            packageIds: ["p-1"],
            items: [{ packageId: "p-1", savedAt: "2026-10-01T00:00:00Z", summary: {}, offer: paket }],
            nextCursor: "c-2",
          }),
    );
    await mount(runtime, <SavedList />);
    await screen.findByText("Nasi Ayam Bakar");
    const more = () => screen.getByRole("button", { name: "Lihat lebih banyak" });
    await fireEvent.press(more());
    await waitFor(() => expect(more().props.accessibilityState.busy).toBe(true));
    await fireEvent.press(more());
    expect((runtime.api.savedPackages as jest.Mock).mock.calls.filter(([cursor]) => cursor)).toHaveLength(1);
    await act(async () => finish({ packageIds: ["p-1"], items: [], nextCursor: null }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lihat lebih banyak" })).toBeNull());
  });
});

describe("pull to refresh", () => {
  const pullRead = async (read: jest.Mock) => {
    const control = screen.getByTestId("screen-scroll").props.refreshControl;
    const before = read.mock.calls.length;
    await act(async () => void control.props.onRefresh());
    expect(read.mock.calls.length).toBe(before + 1);
  };

  it("Notifikasi reloads", async () => {
    const runtime = runtimeWith();
    await mount(runtime, <NotificationsScreen />);
    await screen.findByText("Belum ada notifikasi baru.");
    await pullRead(runtime.api.customer as jest.Mock);
  });

  it("Riwayat pembayaran reloads both reads", async () => {
    const runtime = runtimeWith();
    await mount(runtime, <Payments />);
    await waitFor(() => expect(screen.getByTestId("screen-scroll").props.refreshControl).toBeTruthy());
    await pullRead(runtime.api.customer as jest.Mock);
    await pullRead(runtime.api.customerActions as jest.Mock);
  });

  it("Bantuan reloads", async () => {
    const runtime = runtimeWith();
    await mount(runtime, <ReportList />);
    await waitFor(() => expect(screen.getByTestId("screen-scroll").props.refreshControl).toBeTruthy());
    await pullRead(runtime.api.request as jest.Mock);
  });

  it("Disimpan reloads", async () => {
    const runtime = runtimeWith();
    await mount(runtime, <SavedList />);
    await screen.findByText("Belum ada paket tersimpan.");
    await pullRead(runtime.api.savedPackages as jest.Mock);
  });
});
