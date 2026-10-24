import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { FlatList, RefreshControl, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { nativeThemes } from "@catera/design-tokens";
import { createMobileRuntime, MobileProvider, useMobile, type MobileRuntime } from "@catera/mobile-core";
import { ThemeProvider, ToastProvider } from "@catera/mobile-ui";
import type { SellerCustomer, SettlementState } from "@catera/domain";
import { AktifkanScreen } from "../src/business/AktifkanScreen";
import { UangScreen } from "../src/business/UangScreen";
import { UsahaScreen } from "../src/business/UsahaScreen";
import { CustomerList } from "../src/customers/CustomerList";
import { CustomerDetail } from "../src/customers/CustomerDetail";
import { withDapurScale } from "./dapur-scale";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  Link: () => null,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const sty = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
const down = () => Object.assign(new Error("REQUEST_TIMEOUT"), { code: "REQUEST_TIMEOUT" });
const REFRESH = "Belum bisa memperbarui. Tarik lagi untuk mencoba.";

function runtimeWith(api: Record<string, unknown>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    command: jest.fn(async () => ({})),
    ...api,
  } as unknown as MobileRuntime["api"];
  return runtime;
}
/** A button that runs a command, which bumps the data revision: every `useData` on screen reads again. */
function Bump() {
  const { command } = useMobile();
  return <ReactNative.Pressable accessibilityRole="button" accessibilityLabel="bump" onPress={() => void command("noop", {})} />;
}
const show = (runtime: MobileRuntime, ui: React.ReactNode, { dark = false } = {}) => {
  jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(dark ? "dark" : "light");
  return render(
    withDapurScale(
      <ThemeProvider storageKey="dnf.theme">
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <ToastProvider>
            {ui}
            <Bump />
          </ToastProvider>
        </MobileProvider>
      </ThemeProvider>,
    ),
  );
};
afterEach(() => jest.restoreAllMocks());

const ops = { caterer: { id: "k-1", name: "Dapur Bu Rina", status: "approved" }, offers: [], datedMenus: [] };
const settlement = {
  available: "532000", nextPayoutAt: "2026-10-09T09:00:00+07:00", expected: "0", earned: "0", held: "0", reserved: "0",
  paid: "0", recovery: "0", entries: [], payouts: [], payoutReadiness: "ready", policy: null,
} as unknown as SettlementState;

describe("Aktifkan payout read", () => {
  it("a failed payout-setup read shows Coba lagi for step 2, never the empty bank form", async () => {
    let fail = true;
    const request = jest.fn(async () => {
      if (fail) throw down();
      return { active: null, latest: null };
    });
    show(runtimeWith({ sellerOperations: jest.fn(async () => ops), request }), <AktifkanScreen />);
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    expect(screen.queryByTestId("aktifkan-bank-form")).toBeNull();
    expect(screen.getByText("2. Rekening pencairan")).toBeTruthy();
    fail = false;
    fireEvent.press(retry);
    expect(await screen.findByTestId("aktifkan-bank-form")).toBeTruthy();
  });

  it("the saved bank line is selectable", async () => {
    const active = { id: "pd-1", bank: "BCA", maskedAccount: "****1234", holder: "Rina" };
    show(runtimeWith({ sellerOperations: jest.fn(async () => ops), request: jest.fn(async () => ({ active })) }), <AktifkanScreen />);
    expect((await screen.findByText("BCA · ****1234 · Rina")).props.selectable).toBe(true);
  });
});

describe("Uang figures", () => {
  it("the payout figure and next payout date are selectable, the date tabular", async () => {
    show(runtimeWith({ settlement: jest.fn(async () => settlement) }), <UangScreen />);
    const figure = await screen.findByTestId("uang-available");
    expect(figure.props.selectable).toBe(true);
    const date = screen.getByText(/^Pencairan berikutnya/);
    expect(date.props.selectable).toBe(true);
    expect(sty(date).fontVariant).toContain("tabular-nums");
  });
});

describe("Usaha", () => {
  const offer = { id: "p-1", name: "Paket 1", status: "published", price: 28000, image: "" };
  const usaha = (read: unknown) => runtimeWith({ sellerOperations: read, request: jest.fn(async () => ({ active: { id: "x" } })) });

  it("the Kelola rows draw no chevron off iOS (Jest runs the Android value)", async () => {
    show(usaha(jest.fn(async () => ops)), <UsahaScreen />);
    await screen.findByText("Impor pelanggan");
    expect(screen.UNSAFE_queryAllByType(Ionicons).filter((g) => g.props.name === "chevron-forward")).toHaveLength(0);
  });

  it("package prices are tabular", async () => {
    show(usaha(jest.fn(async () => ({ ...ops, offers: [offer] }))), <UsahaScreen />);
    const meta = await screen.findByText(/28[.]000/);
    expect(sty(meta).fontVariant).toContain("tabular-nums");
  });

  it("a failed refresh with packages on screen toasts, and the packages stay", async () => {
    let fail = false;
    const read = jest.fn(async () => {
      if (fail) throw down();
      return { ...ops, offers: [offer] };
    });
    show(usaha(read), <UsahaScreen />);
    await screen.findByText("Paket 1");
    expect(screen.queryByText(REFRESH)).toBeNull();
    fail = true;
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "bump" }));
    });
    expect(await screen.findByText(REFRESH)).toBeTruthy();
    expect(screen.getByText("Paket 1")).toBeTruthy();
  });
});

const sub = {
  id: "s-1", package_id: "p-1", package_name: "Makan Siang Rumahan", meal: "lunch", portions: 1, starts_on: "2026-10-01", ends_on: "2026-10-09",
  status: "active", remaining: 5, next_delivery: "2026-10-08", legacy: true, renewed_from: null, external_reference: null,
  payment_route: "external_reported", renewal_status: "unknown", prepared_at: null, trial: false,
  deliveries: [{ id: "d-1", service_date: "2026-10-08", status: "scheduled" }],
};
const cust = (n: number): SellerCustomer =>
  ({
    id: `c-${n}`, caterer_id: "k-1", user_id: null, name: `Pelanggan ${n}`, phone: `+62812345000${n}`,
    address: { id: "a-1", label: "Rumah", line: "Jl. Melati 4", area: "Kebayoran", instructions: "Pagar hijau" },
    origin: "seller", version: 1, claim_review: null, subscriptions: [{ ...sub, id: `s-${n}` }],
  }) as unknown as SellerCustomer;

describe("Pelanggan", () => {
  const crm = (list: () => Promise<unknown>) =>
    runtimeWith({ sellerCustomers: list, sellerOperations: jest.fn(async () => ops), request: jest.fn(async () => ({ active: null })) });
  const one = () => crm(async () => ({ customers: [cust(1)], total: 1, packages: [] }));

  it("the address well steps off the canvas in dark, with a continuous corner", async () => {
    show(one(), <CustomerDetail id="c-1" />, { dark: true });
    const well = await screen.findByTestId("customer-address");
    expect(sty(well)).toMatchObject({ backgroundColor: nativeThemes.dark.fill, borderCurve: "continuous" });
    expect(nativeThemes.dark.fill).not.toBe(nativeThemes.dark.canvas);
  });

  it("the address and instructions are selectable and the Jadwal dates tabular", async () => {
    show(one(), <CustomerDetail id="c-1" />);
    await screen.findByTestId("customer-address");
    expect(screen.getByText("Jl. Melati 4, Kebayoran").props.selectable).toBe(true);
    expect(screen.getByText("Pagar hijau").props.selectable).toBe(true);
    const row = screen.getAllByTestId("schedule-row")[0];
    const date = row.findAll((n) => typeof n.props.children === "string" && /Okt/.test(n.props.children))[0];
    expect(sty(date).fontVariant).toContain("tabular-nums");
  });

  it("the list is a FlatList of customers under the chips", async () => {
    show(one(), <CustomerList />);
    expect(await screen.findByText("Pelanggan 1")).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(FlatList).length).toBeGreaterThan(0);
    expect(screen.getByTestId("pelanggan-chips")).toBeTruthy();
    expect(screen.getAllByTestId("customer-row")).toHaveLength(1);
    expect(screen.UNSAFE_getAllByType(RefreshControl).length).toBeGreaterThan(0);
  });

  it("a failed refresh with customers on screen toasts, and the rows stay", async () => {
    let fail = false;
    const runtime = crm(async () => {
      if (fail) throw down();
      return { customers: [cust(1)], total: 1, packages: [] };
    });
    show(runtime, <CustomerList />);
    await screen.findByText("Pelanggan 1");
    fail = true;
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "bump" }));
    });
    expect(await screen.findByText(REFRESH)).toBeTruthy();
    expect(screen.getByText("Pelanggan 1")).toBeTruthy();
  });
});

describe("Pelanggan list layout", () => {
  const Reanimated = require("react-native-reanimated") as typeof import("react-native-reanimated");
  const crm = (customers: SellerCustomer[]) =>
    runtimeWith({
      sellerCustomers: jest.fn(async () => ({ customers, total: customers.length, packages: [] })),
      sellerOperations: jest.fn(async () => ops),
      request: jest.fn(async () => ({ active: null })),
    });
  const pieces = () => screen.getAllByTestId("customer-card-row").map(sty);

  it("keeps the 8 between the chip frame and the first row", async () => {
    show(crm([cust(1)]), <CustomerList />);
    await screen.findByText("Pelanggan 1");
    expect(sty(screen.getByTestId("pelanggan-list-head")).paddingBottom).toBe(8);
  });

  it("slides rows through the list's item layout animation, and not under reduced motion", async () => {
    show(crm([cust(1)]), <CustomerList />);
    await screen.findByText("Pelanggan 1");
    expect(screen.UNSAFE_getByType(FlatList).props.itemLayoutAnimation).toBeDefined();
    screen.unmount();
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(true);
    show(crm([cust(1)]), <CustomerList />);
    await screen.findByText("Pelanggan 1");
    expect(screen.UNSAFE_getByType(FlatList).props.itemLayoutAnimation).toBeUndefined();
    (Reanimated.useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  it("draws the first row's top corners, the last row's bottom corners, and a lone row all four", async () => {
    show(crm([cust(1), cust(2), cust(3)]), <CustomerList />);
    await screen.findByText("Pelanggan 3");
    const [first, middle, last] = pieces();
    expect(first).toMatchObject({ borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopWidth: 1, borderBottomWidth: 0 });
    expect(middle).toMatchObject({ borderTopLeftRadius: 0, borderBottomRightRadius: 0, borderTopWidth: 0, borderBottomWidth: 0 });
    expect(last).toMatchObject({ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopWidth: 0, borderBottomWidth: 1 });
    expect(first.borderLeftWidth).toBe(1);
  });

  it("a single row takes all four corners and both edges", async () => {
    show(crm([cust(1)]), <CustomerList />);
    await screen.findByText("Pelanggan 1");
    expect(pieces()[0]).toMatchObject({ borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopWidth: 1, borderBottomWidth: 1 });
  });

  it("dark draws no edge", async () => {
    show(crm([cust(1)]), <CustomerList />, { dark: true });
    await screen.findByText("Pelanggan 1");
    expect(pieces()[0]).toMatchObject({ borderLeftWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 });
  });
});
