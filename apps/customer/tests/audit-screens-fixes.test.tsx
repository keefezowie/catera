import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { LayoutScaleProvider, MoodProvider, ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import { AddressForm } from "../src/account/AddressForm";
import { DataAkun } from "../src/account/DataAkun";
import { Jelajah } from "../src/discover/Jelajah";
import { PackageDetail } from "../src/discover/PackageDetail";
import { customerLink } from "../src/links";
import { ChooseMenu } from "../src/schedule/ChooseMenu";
import { Jadwal } from "../src/schedule/Jadwal";
import { offer } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => {},
}));
jest.mock("expo-router/react-navigation", () => ({
  ...jest.requireActual("expo-router/react-navigation"),
  useNavigation: () => ({ dispatch: jest.fn(), addListener: jest.fn(() => jest.fn()) }),
  usePreventRemove: jest.fn(),
}));
jest.mock("@catera/mobile-ui", () => ({
  ...jest.requireActual("@catera/mobile-ui"),
  useUnsavedGuard: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => require("node:crypto").randomUUID() }));

const actor = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const emptyState = { subscriptions: [], deliveries: [], addresses: [], notifications: [], cases: [] };

function runtimeWith(over: Record<string, unknown> = {}, user?: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  if (user)
    (runtime as { supabase: unknown }).supabase = {
      auth: {
        getSession: jest.fn(async () => ({ data: { session: { user } } })),
        getUser: jest.fn(async () => ({ data: { user }, error: null })),
        updateUser: jest.fn(async () => ({ error: null })),
        signInWithPassword: jest.fn(async () => ({ data: { session: {}, user }, error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: () => undefined } } })),
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel: async () => undefined,
    };
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(async () => emptyState),
    request: jest.fn(async () => []),
    catalog: jest.fn(async () => ({ items: [], nextCursor: null })),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
    ...over,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const renderWith = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <ThemeProvider storageKey="audit-screens-test">
      <MoodProvider now={() => new Date("2026-10-09T02:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={customerLink}>
          <ToastProvider>
            <LayoutScaleProvider value="v2">{ui}</LayoutScaleProvider>
          </ToastProvider>
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe("Jadwal month steps", () => {
  it("going back to a month already seen keeps it on screen while it is read again", async () => {
    const runtime = runtimeWith();
    await renderWith(runtime, <Jadwal />);
    await screen.findByTestId("month-grid");
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    await waitFor(() => expect(runtime.api.customer).toHaveBeenCalledTimes(2));
    await screen.findByTestId("month-grid");

    const calls = (runtime.api.customer as jest.Mock).mock.calls.length;
    (runtime.api.customer as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    await fireEvent.press(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    expect(screen.getByTestId("month-grid")).toBeTruthy();
    expect(screen.queryByTestId("jadwal-skeleton-cell")).toBeNull();
    // It is still read again, so what it shows does not stay old.
    expect((runtime.api.customer as jest.Mock).mock.calls.length).toBe(calls + 1);

    // A month not seen yet has nothing to keep, so it still waits on its skeleton.
    await fireEvent.press(screen.getByRole("button", { name: "Bulan sebelumnya" }));
    expect(screen.queryByTestId("month-grid")).toBeNull();
    expect(screen.getAllByTestId("jadwal-skeleton-cell").length).toBeGreaterThan(0);
  });
});

describe("ChooseMenu while only the menus load", () => {
  const menuOffer = {
    id: "offer",
    name: "Paket pilihan",
    caterer: "Dapur Contoh",
    meal: "lunch",
    menuSelectionMode: "customer",
    menus: [],
  };
  const customer = jest.fn(async () => ({
    ...emptyState,
    subscriptions: [{ id: "subscription", portions: 3, status: "active", snapshot: { offer: menuOffer } }],
  }));

  it("keeps the title and the chevrons, with the list skeleton in place", async () => {
    mockParams = { id: "subscription", date: "2026-11-03", meal: "lunch" };
    const runtime = runtimeWith({ customer, customerMenuMonth: jest.fn(() => new Promise(() => undefined)) });
    await renderWith(runtime, <ChooseMenu />);
    expect(await screen.findByText("Paket pilihan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bulan berikutnya" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Memuat menu" })).toBeTruthy();
    expect(screen.getByTestId("list-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("choose-menu-skeleton")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Bulan berikutnya" }));
    expect(screen.getByText("Paket pilihan")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bulan sebelumnya" })).toBeTruthy();
    expect(screen.getByText("Desember 2026")).toBeTruthy();
  });

  it("a month that failed to load says so under the same header, with no skeleton", async () => {
    mockParams = { id: "subscription", date: "2026-11-03", meal: "lunch" };
    const runtime = runtimeWith({ customer, customerMenuMonth: jest.fn(async () => Promise.reject(new Error("REQUEST_TIMEOUT"))) });
    await renderWith(runtime, <ChooseMenu />);
    expect(await screen.findByRole("button", { name: "Coba lagi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bulan berikutnya" })).toBeTruthy();
    expect(screen.queryByTestId("list-skeleton")).toBeNull();
  });
});

describe("Jelajah catalog pages", () => {
  const package1 = offer({ id: "p-1", name: "Paket Halaman Satu" });
  const package2 = offer({ id: "p-2", name: "Paket Halaman Dua" });

  it("follows nextCursor as the offset the server reads, so a later page can be listed and searched", async () => {
    const catalog = jest.fn(async (query: string) =>
      new URLSearchParams(query).get("offset") === "100"
        ? { items: [package2, package1], nextCursor: null }
        : { items: [package1], nextCursor: "100" },
    );
    await renderWith(runtimeWith({ catalog }), <Jelajah />);
    expect(await screen.findByText("Paket Halaman Dua")).toBeTruthy();
    expect(catalog).toHaveBeenCalledTimes(2);
    expect(catalog.mock.calls[1][0]).toContain("offset=100");
    // A package that came back on both pages is listed once.
    expect(screen.getAllByText("Paket Halaman Satu")).toHaveLength(1);
    await fireEvent.changeText(screen.getByLabelText("Cari paket"), "halaman dua");
    await waitFor(() => expect(screen.queryByText("Paket Halaman Satu")).toBeNull());
    expect(screen.getByText("Paket Halaman Dua")).toBeTruthy();
  });

  it("stops at the page ceiling when the server never ends", async () => {
    const catalog = jest.fn(async () => ({ items: [package1], nextCursor: "100" }));
    await renderWith(runtimeWith({ catalog }), <Jelajah />);
    expect(await screen.findByText("Paket Halaman Satu")).toBeTruthy();
    expect(catalog).toHaveBeenCalledTimes(10);
  });
});

it("PackageDetail encodes a deep-link id before it goes into the reviews path", async () => {
  mockParams = { id: "../me" };
  const request = jest.fn(async () => []);
  await renderWith(runtimeWith({ request, offer: jest.fn(async () => ({ offer: null })) }), <PackageDetail />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("reviews/..%2Fme"));
});

describe("DataAkun keyboards", () => {
  const emailUser = { id: "u-c1", email: "rani@example.test", app_metadata: { provider: "email" } };
  const openPassword = async () => {
    const runtime = runtimeWith({}, emailUser);
    await renderWith(runtime, <DataAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: "Kata sandi" }));
    return runtime;
  };

  it("the password fields show and hide: the current one alone, the new pair together", async () => {
    await openPassword();
    const secure = (label: string) => screen.getByLabelText(label).props.secureTextEntry;
    expect(secure("Kata sandi saat ini")).toBe(true);
    expect(secure("Kata sandi baru")).toBe(true);
    const toggles = screen.getAllByRole("button", { name: "Tampilkan kata sandi" });
    expect(toggles).toHaveLength(3);
    await fireEvent.press(toggles[1]);
    expect(secure("Kata sandi saat ini")).toBe(true);
    expect(secure("Kata sandi baru")).toBe(false);
    expect(secure("Ulangi kata sandi baru")).toBe(false);
    expect(screen.getAllByRole("button", { name: "Sembunyikan kata sandi" })).toHaveLength(2);
  });

  it("the return key walks the password fields, and the last one saves only when the form is valid", async () => {
    const runtime = await openPassword();
    const update = (runtime.supabase as unknown as { auth: { updateUser: jest.Mock } }).auth.updateUser;
    expect(screen.getByLabelText("Kata sandi saat ini").props.returnKeyType).toBe("next");
    expect(screen.getByLabelText("Kata sandi baru").props.returnKeyType).toBe("next");
    const last = () => screen.getByLabelText("Ulangi kata sandi baru");
    expect(last().props.returnKeyType).toBe("go");
    await fireEvent(last(), "submitEditing");
    expect(update).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Kata sandi saat ini"), "lama-1234");
    await fireEvent.changeText(screen.getByLabelText("Kata sandi baru"), "baru-12345");
    await fireEvent.changeText(last(), "baru-12345");
    await fireEvent(last(), "submitEditing");
    await waitFor(() => expect(update).toHaveBeenCalledWith({ password: "baru-12345" }));
  });

  it("the name saves from the keyboard, and not while the button would be off", async () => {
    const runtime = runtimeWith({}, emailUser);
    await renderWith(runtime, <DataAkun />);
    await fireEvent.press(await screen.findByRole("button", { name: /^Nama, / }));
    const field = () => screen.getByLabelText("Nama");
    await fireEvent(field(), "submitEditing");
    expect(runtime.api.command).not.toHaveBeenCalled();
    await fireEvent.changeText(field(), "Rani Baru");
    await fireEvent(field(), "submitEditing");
    await waitFor(() => expect(runtime.api.command).toHaveBeenCalledWith("profile.update", { name: "Rani Baru" }, expect.any(String)));
  });
});

it("AddressForm: Label and Kota say what they hold and the return key moves on", async () => {
  await renderWith(runtimeWith(), <AddressForm />);
  await fireEvent.press(await screen.findByRole("button", { name: "Lainnya" }));
  const label = screen.getByLabelText("Label alamat");
  expect(label.props.autoComplete).toBe("off");
  expect(label.props.returnKeyType).toBe("next");
  const city = screen.getByLabelText("Kota");
  expect(city.props.autoComplete).toBe("postal-address-locality");
  expect(city.props.textContentType).toBe("addressCity");
  expect(city.props.returnKeyType).toBe("next");
});
