import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { RefreshControl } from "react-native";
import * as Haptics from "expo-haptics";
import * as Reanimated from "react-native-reanimated";
import { router } from "expo-router";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { Confetti, SuccessRig, ToastProvider } from "@catera/mobile-ui";
import type { SellerCustomer, SellerOffer } from "@catera/domain";
import { MenuDayScreen } from "../src/menu/MenuDayScreen";
import { SlotEditor } from "../src/menu/SlotEditor";
import { ImportAssistant } from "../src/import/ImportAssistant";
import { CustomerList } from "../src/customers/CustomerList";
import { commitImport } from "../src/import/commits";
import { goToTab } from "../src/nav";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn() }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("../src/business/upload", () => ({ uploadPhoto: jest.fn() }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

// The route file: Paket baru, which reads the caterer's packages and hands the editor the first-publish fact.
const NewPackageRoute = require("../app/(tabs)/(index,pelanggan,menu,usaha)/paket/baru").default as () => React.JSX.Element;

const owner = { id: "u-1", role: "owner", catererId: "k-1" };
const successes = () => (Haptics.notificationAsync as jest.Mock).mock.calls.filter(([kind]) => kind === "success");
const reduced = (on: boolean) => (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(on);

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: owner, demo: false })),
    command: jest.fn(async () => ({})),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}

/** Calls the provider's own `command`, so a test can stand for a save made on another screen (it bumps the revision). */
let commandOf: ((action: string, payload: unknown) => Promise<unknown>) | null = null;
function Grab() {
  commandOf = useMobile().command;
  return null;
}

const wrap = (runtime: MobileRuntime, node: React.ReactNode) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
      <ToastProvider os="android">
        {node}
        <Grab />
      </ToastProvider>
    </MobileProvider>,
  );

const pkg = (id: string, status: SellerOffer["status"]) =>
  ({
    id,
    slug: id,
    version: 1,
    catererId: "k-1",
    name: "Makan Siang Rumahan",
    description: "Masakan rumahan harian dengan nasi, dua lauk dan sayur.",
    price: 28000,
    days: 5,
    meal: "lunch",
    weekdays: [1, 2, 3, 4, 5],
    flexible: true,
    trialPrice: null,
    trialMax: null,
    capacity: { "1": 40, "2": 40, "3": 40, "4": 40, "5": 40 },
    tiers: [],
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    tags: [],
    image: "https://cdn.example.test/k-1/a.jpg",
    status,
    menus: [{ meal: "lunch", name: "x", description: "", image: "", contentModel: "slots", composition: [{ id: "g-main", categoryId: "main", name: "Lauk", slots: 2 }] }],
  }) as unknown as SellerOffer;

const ops = (offers: SellerOffer[]) => jest.fn(async () => ({ caterer: { id: "k-1", name: "Dapur" }, dishes: [], datedMenus: [], offers }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  reduced(false);
});

describe("Paket diterbitkan", () => {
  it("the first publish plays the beat, later publishes toast", async () => {
    // First: the caterer's only package is a draft, copied into the editor and published.
    mockParams = { from: "p-draf" };
    const first = runtimeWith({ sellerOperations: ops([pkg("p-draf", "draft")]) });
    const view = wrap(first, <NewPackageRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(first.api.command).toHaveBeenCalledWith("package.save", expect.anything(), expect.any(String)));
    const beat = within(await screen.findByTestId("success-beat"));
    expect(beat.getByText("Paket diterbitkan")).toBeTruthy();
    expect(beat.getByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.UNSAFE_getByType(SuccessRig).props.play).toBe(true);
    expect(screen.UNSAFE_getByType(Confetti).props.play).toBe(true);
    expect(successes()).toHaveLength(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.queryByText("Paket diterbitkan", { exact: true })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Selesai" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    view.unmount();
    jest.clearAllMocks();

    // Later: a package was published before, so saving a new one goes back with the toast.
    mockParams = { from: "p-live" };
    const later = runtimeWith({ sellerOperations: ops([pkg("p-live", "published")]) });
    wrap(later, <NewPackageRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Paket diterbitkan")).toBeTruthy();
    expect(screen.queryByTestId("success-beat")).toBeNull();
    expect(screen.UNSAFE_queryByType(Confetti)).toBeNull();
    expect(successes()).toHaveLength(0);
  });

  it("a package read that cannot tell gives the toast, never the beat", () => {
    const { isFirstPublish } = jest.requireActual("../src/business/package") as typeof import("../src/business/package");
    expect(isFirstPublish(null)).toBeNull();
    expect(isFirstPublish([])).toBe(true);
    expect(isFirstPublish([pkg("a", "draft")])).toBe(true);
    // Suspended and retired packages were published once.
    expect(isFirstPublish([pkg("a", "draft"), pkg("b", "suspended")])).toBe(false);
    expect(isFirstPublish([pkg("b", "retired")])).toBe(false);
  });

  it("under reduced motion the first publish shows merayakan, no confetti, and keeps the haptic", async () => {
    reduced(true);
    mockParams = { from: "p-draf" };
    wrap(runtimeWith({ sellerOperations: ops([pkg("p-draf", "draft")]) }), <NewPackageRoute />);
    fireEvent.press(await screen.findByRole("button", { name: "Simpan paket" }));
    const beat = within(await screen.findByTestId("success-beat"));
    expect(beat.getByTestId("mascot-art", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
    expect(successes()).toHaveLength(1);
  });
});

describe("menu", () => {
  const composition = [
    { id: "g-nasi", categoryId: "rice", name: "Nasi", slots: 1 },
    { id: "g-lauk", categoryId: "main", name: "Lauk", slots: 1 },
  ];
  const dish = (id: string, groupId: string, categoryId: string, name: string) => ({
    id,
    groupId,
    categoryId,
    name,
    description: "",
    image: "",
    serving: "",
  });

  it("a saved day menu toasts its weekday", async () => {
    const runtime = runtimeWith({
      sellerOperations: jest.fn(async () => ({
        caterer: { id: "k-1", name: "Dapur" },
        dishes: [],
        datedMenus: [],
        offers: [
          { id: "p-1", name: "Makan Siang Rumahan", status: "published", meal: "lunch", weekdays: [1, 2, 3, 4, 5], contentRevision: 2, menus: [{ meal: "lunch", name: "Makan Siang", description: "", image: "", composition }] },
        ],
      })),
      menuMonth: jest.fn(async () => ({
        dates: [
          {
            date: "2026-10-06",
            version: 1,
            editable: true,
            details: { name: "Makan Siang", description: "", image: "", meal: "lunch", composition, items: [dish("g-nasi-1", "g-nasi", "rice", "Nasi putih"), dish("g-lauk-1", "g-lauk", "main", "Ayam bakar")] },
          },
        ],
        categories: [],
      })),
    });
    wrap(runtime, <MenuDayScreen date="2026-10-06" packageId="p-1" meal="lunch" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Simpan menu" }).props.accessibilityState.disabled).toBeFalsy());
    fireEvent.press(screen.getByRole("button", { name: "Simpan menu" }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    // 6 Oct 2026 is a Tuesday.
    expect(await screen.findByText("Menu Selasa tersimpan")).toBeTruthy();
  });

  it("a dish slot added or removed by the caterer moves as a row; the day's first draw does not", () => {
    const library = [{ ...dish("d-ikan", "", "main", "Ikan bakar"), archived: false }] as never;
    let items = [dish("g-nasi-1", "g-nasi", "rice", "Nasi putih")];
    const ui = () => (
      <SlotEditor
        composition={composition}
        items={items}
        library={library}
        usage={new Map()}
        onChange={(next) => (items = next as typeof items)}
        onCreate={async () => library[0]}
        onSave={() => undefined}
        saving={false}
        canEdit
      />
    );
    const view = render(ui());
    const rows = () => screen.getAllByTestId("menu-slot-row");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].props.entering).toBeUndefined();
    expect(rows()[0].props.exiting).toBeDefined();
    expect(rows()[0].props.layout).toBeDefined();
    // Add the lauk.
    fireEvent.changeText(screen.getByLabelText("Lauk berikutnya"), "ikan");
    fireEvent.press(screen.getByText("Ikan bakar"));
    view.rerender(ui());
    expect(rows()).toHaveLength(2);
    const added = rows().find((r) => within(r).queryByText("Ikan bakar"))!;
    expect(added.props.entering).toBeDefined();
    // Remove the rice.
    fireEvent.press(screen.getByRole("button", { name: "Hapus Nasi putih" }));
    view.rerender(ui());
    expect(rows()).toHaveLength(1);
    expect(screen.queryByText("Nasi putih")).toBeNull();
  });
});

describe("import", () => {
  const row = (n: number, extra: Record<string, unknown> = {}) => ({
    name: `Pelanggan ${n}`,
    phone: `+62812345678${String(n).padStart(2, "0")}`,
    addressLine: `Jl. Contoh No. ${n}`,
    area: "Setiabudi",
    city: "Jakarta Selatan",
    notes: "",
    packageId: "p-rumahan",
    startDate: "2026-12-01",
    remainingDays: 9,
    portions: 1,
    needsReview: false,
    reason: "",
    ...extra,
  });

  it("import saved plays the beat with the count", async () => {
    const command = jest.fn(async (action: string) => (action === "import.preview" ? { id: "pv-1", rows: [] } : { created: 3 }));
    const runtime = runtimeWith({
      sellerImportOptions: jest.fn(async () => ({ customers: [], packages: [{ id: "p-rumahan", name: "Makan Siang Rumahan", days: 20, areas: [], meal: "lunch" }] })),
      command,
    });
    const rows = [row(1), row(2), row(3), row(4, { addressLine: "", needsReview: true, reason: "Alamat belum lengkap" })];
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: { rows, needsReview: 1 } }) })) as unknown as typeof fetch;
    wrap(runtime, <ImportAssistant />);
    fireEvent.changeText(await screen.findByLabelText("Tempel atau ketik daftar pelanggan"), "daftar");
    fireEvent.press(screen.getByRole("button", { name: "Susun daftar" }));
    expect(await screen.findByText("Pelanggan 1")).toBeTruthy();
    // The rows the assistant read arrive as one list, not one by one.
    for (const r of screen.getAllByTestId("import-row")) expect(r.props.entering).toBeUndefined();
    fireEvent.press(await screen.findByRole("button", { name: "Simpan 3 pelanggan" }));
    const beat = within(await screen.findByTestId("success-beat"));
    expect(beat.getByText("3 pelanggan tersimpan")).toBeTruthy();
    expect(screen.UNSAFE_getByType(SuccessRig).props.play).toBe(true);
    expect(successes()).toHaveLength(1);
    // No confetti: importing is not a first package or a first paid plan.
    expect(screen.UNSAFE_queryByType(Confetti)?.props.play ?? false).toBe(false);
    // The saved rows leave; the one to check stays with its own exit ready.
    await waitFor(() => expect(screen.queryByText("Pelanggan 1")).toBeNull());
    const left = screen.getAllByTestId("import-row");
    expect(left).toHaveLength(1);
    expect(left[0].props.exiting).toBeDefined();
    fireEvent.press(beat.getByRole("button", { name: "Lihat Pelanggan" }));
    expect(goToTab).toHaveBeenCalledWith("pelanggan");
  });
});

describe("Pelanggan", () => {
  const customer = (id: string, name: string, remaining = 30): SellerCustomer =>
    ({
      id,
      caterer_id: "k-1",
      user_id: null,
      name,
      phone: null,
      address: { line: "Jl. Contoh", area: "Setiabudi" },
      origin: "seller",
      version: 1,
      claim_review: null,
      subscriptions: [
        {
          id: `s-${id}`,
          package_id: "p-rumahan",
          package_name: "Makan Siang Rumahan",
          meal: "lunch",
          portions: 1,
          starts_on: "2026-10-01",
          ends_on: "2026-12-30",
          status: "active",
          remaining,
          next_delivery: "2026-10-12",
          legacy: true,
          renewed_from: null,
          external_reference: null,
          payment_route: "external_reported",
          renewal_status: "unknown",
          prepared_at: null,
          trial: false,
          deliveries: [],
        },
      ],
    }) as unknown as SellerCustomer;

  it("after an import while the list is open, the new customers enter; the first load and a filter change do not", async () => {
    let list = [customer("c-01", "Andre Kusuma")];
    const runtime = runtimeWith({
      sellerCustomers: jest.fn(async () => ({ customers: list, total: list.length, packages: [] })),
    });
    wrap(runtime, <CustomerList />);
    await screen.findByText("Andre Kusuma");
    await act(async () => {});
    const rows = () => screen.getAllByTestId("customer-row");
    expect(rows()[0].props.entering).toBeUndefined();
    // An import commits on Impor, over this tab, on this phone: the list reads again and the two new customers arrive.
    list = [...list, customer("c-02", "Bu Ani"), customer("c-03", "Pak Budi")];
    await act(async () => void (await commitImport(commandOf!, "k-1", "pv-1")));
    expect(await screen.findByText("Bu Ani")).toBeTruthy();
    const byName = (name: string) => rows().find((r) => within(r).queryByText(name))!;
    expect(byName("Andre Kusuma").props.entering).toBeUndefined();
    expect(byName("Bu Ani").props.entering).toBeDefined();
    expect(byName("Pak Budi").props.entering).toBeDefined();
    // Once their entrance has run (220ms), switching to Selesai and back shows the same customers again: no entrance.
    await act(async () => void (await new Promise((r) => setTimeout(r, 500))));
    fireEvent.press(screen.getByRole("button", { name: /^Selesai/ }));
    fireEvent.press(screen.getByRole("button", { name: /^Aktif/ }));
    for (const r of rows()) expect(r.props.entering).toBeUndefined();
  });

  it("a customer who arrives by a push or another device's change has no entrance", async () => {
    let list = [customer("c-01", "Andre Kusuma")];
    const runtime = runtimeWith({
      sellerCustomers: jest.fn(async () => ({ customers: list, total: list.length, packages: [] })),
    });
    wrap(runtime, <CustomerList />);
    await screen.findByText("Andre Kusuma");
    await act(async () => {});
    // Any revision bump that is not this phone's import (a marketplace purchase pushed in, a save on the web) reads the
    // list again; what it brings is a refresh, so it swaps in without a row entrance.
    list = [...list, customer("c-02", "Bu Ani")];
    await act(async () => void (await commandOf!("customer.note", { id: "c-01" })));
    expect(await screen.findByText("Bu Ani")).toBeTruthy();
    for (const r of screen.getAllByTestId("customer-row")) expect(r.props.entering).toBeUndefined();
  });

  it("a filter change swaps the rows: no exit, no move and no entrance", async () => {
    const list = [customer("c-01", "Andre Kusuma"), customer("c-02", "Bu Ani", 2)];
    wrap(runtimeWith({ sellerCustomers: jest.fn(async () => ({ customers: list, total: list.length, packages: [] })) }), <CustomerList />);
    await screen.findByText("Andre Kusuma");
    await act(async () => {});
    const block = () => screen.UNSAFE_getByType(Reanimated.LayoutAnimationConfig);
    const ani = () => screen.getAllByTestId("customer-row").find((r) => within(r).queryByText("Bu Ani"))!;
    // The rows sit in a block that skips its children's entrances and exits when it is swapped.
    expect(block().props).toMatchObject({ skipEntering: true, skipExiting: true });
    const before = ani();
    // Bu Ani is about to end, so she is under Aktif and under Segera berakhir: the filter remounts her row in a new
    // block instead of moving it, and Andre's row leaves with the old block, without its own exit.
    fireEvent.press(screen.getByRole("button", { name: /^Segera berakhir/ }));
    expect(screen.queryByText("Andre Kusuma")).toBeNull();
    expect(ani()).not.toBe(before);
    expect(block().props).toMatchObject({ skipEntering: true, skipExiting: true });
  });

  it("a pull to refresh swaps the rows too, and what it brings never enters as an insertion", async () => {
    let list = [customer("c-01", "Andre Kusuma"), customer("c-02", "Bu Ani")];
    wrap(runtimeWith({ sellerCustomers: jest.fn(async () => ({ customers: list, total: list.length, packages: [] })) }), <CustomerList />);
    await screen.findByText("Andre Kusuma");
    await act(async () => {});
    const row = (name: string) => screen.getAllByTestId("customer-row").find((r) => within(r).queryByText(name));
    const andre = row("Andre Kusuma");
    // The pull drops Bu Ani and brings Pak Budi.
    list = [customer("c-01", "Andre Kusuma"), customer("c-03", "Pak Budi")];
    await act(async () => void (await screen.UNSAFE_getByType(RefreshControl).props.onRefresh()));
    expect(await screen.findByText("Pak Budi")).toBeTruthy();
    expect(screen.queryByText("Bu Ani")).toBeNull();
    // The block was swapped: Andre's row is a new mount (no move), Bu Ani left with the old block (no exit), and Pak
    // Budi has no entrance.
    expect(row("Andre Kusuma")).not.toBe(andre);
    expect(row("Pak Budi")!.props.entering).toBeUndefined();
    expect(screen.UNSAFE_getByType(Reanimated.LayoutAnimationConfig).props).toMatchObject({ skipEntering: true, skipExiting: true });
  });
});
