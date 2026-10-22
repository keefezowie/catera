import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { addDays, type CustomerState } from "@catera/domain";
import { nativeThemes } from "@catera/design-tokens";
import { LayoutScaleProvider, MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { PaketSaya } from "../src/plan/PlanList";
import { customerLink } from "../src/links";
import { DEMO_TODAY, eightPlans, plan } from "./fixtures";

/** The phone the screen is drawn on; a test sets it to try another width or text size. */
let mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow,
}));
jest.mock("../src/nav", () => ({
  ...jest.requireActual("../src/nav"),
  openLink: (path: string) => require("expo-router").router.push(path),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useLocalSearchParams: () => ({}),
  useIsFocused: () => true,
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

const customer = { id: "u-c1", role: "customer", name: "Rani Contoh" };
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

function runtimeWith(state: () => Promise<CustomerState>, actor: Record<string, unknown> | null = customer): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera", app: "customer" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor, demo: false })),
    customer: jest.fn(state),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

function mount(runtime: MobileRuntime) {
  return render(
    <LayoutScaleProvider value="v2">
      <ThemeProvider storageKey="paket-saya-test">
        <MoodProvider now={() => new Date(`${DEMO_TODAY}T02:00:00Z`)}>
          <MobileProvider runtime={runtime} linkMapper={customerLink}>
            <PaketSaya />
          </MobileProvider>
        </MoodProvider>
      </ThemeProvider>
    </LayoutScaleProvider>,
  );
}

/** A finished plan: `ended` days before the demo day. */
const finished = (id: string, name: string, caterer: string, ended: number) =>
  plan(id, {
    name,
    caterer,
    remaining: 0,
    today: DEMO_TODAY,
    status: "completed",
    starts_on: addDays(DEMO_TODAY, -ended - 9),
    ends_on: addDays(DEMO_TODAY, -ended),
  });

const withFinished = (state: CustomerState): CustomerState => ({
  ...state,
  subscriptions: [
    ...state.subscriptions,
    finished("s-z1", "Rantang Nusantara", "Dapur Senja", 3),
    finished("s-z2", "Plant-based Everyday", "Dapur Hijau", 20),
    plan("s-x", { name: "Paket Batal", caterer: "Dapur Kecil", today: DEMO_TODAY, status: "cancelled" }),
  ],
});

const rowNames = (container: ReturnType<typeof within>) =>
  container.getAllByTestId(/^plan-row-s-[a-z0-9]+$/).map((row) => within(row).getAllByText(/./)[0].props.children);

beforeEach(() => {
  jest.clearAllMocks();
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
  mockWindow = { width: 411, height: 860, scale: 3, fontScale: 1 };
});

describe("Paket saya", () => {
  it("is titled Paket saya and has an Aktif section with its count", async () => {
    mount(runtimeWith(async () => eightPlans()));
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(within(screen.getByTestId("screen-native-title")).getByText("Paket saya")).toBeTruthy();
    const heading = screen.getAllByTestId("plan-section")[0];
    expect(within(heading).getByText("Aktif")).toBeTruthy();
    expect(within(heading).getByText("8 paket")).toBeTruthy();
    expect(flat(within(heading).getByText("Aktif"))).toMatchObject({ fontSize: 20, lineHeight: 26 });
  });

  it("lists the running plans in a card of 72 rows with a 56 photo, soonest end first", async () => {
    mount(runtimeWith(async () => eightPlans()));
    await screen.findByText("Makan Siang Rumahan");
    const active = within(screen.getByTestId("plan-row-list"));
    // Six plans end on the 15th (by name), then the 16th, then the 30th.
    expect(rowNames(active)).toEqual([
      "Bento Anak",
      "Makan Malam Hemat",
      "Makan Siang Rumahan",
      "Nasi Bakar",
      "Paket Keluarga",
      "Paket Sehat",
      "Makan Siang Kantor · 5–16 Okt",
      "Makan Siang Kantor · 19–30 Okt",
    ]);
    expect(flat(screen.getByTestId("list-card"))).toMatchObject({ borderRadius: 16 });
    const first = active.getByTestId("plan-row-s-g");
    expect(flat(first)).toMatchObject({ minHeight: 72 });
    expect(flat(within(first).getByTestId("plan-row-s-g-thumb"))).toMatchObject({ width: 56, height: 56, borderRadius: 8 });
    expect(within(first).getByText("Dapur Kecil · 6 hari lagi")).toBeTruthy();
  });

  it("opens a plan's detail from its row", async () => {
    mount(runtimeWith(async () => eightPlans()));
    fireEvent.press(await screen.findByText("Makan Siang Kantor · 19–30 Okt"));
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-b?title=Makan%20Siang%20Kantor");
  });

  it("with one plan counts it and lists it", async () => {
    mount(runtimeWith(async () => ({ ...eightPlans(), subscriptions: [plan("s-1", { name: "Makan Siang Rumahan", caterer: "Dapur Contoh", today: DEMO_TODAY })] })));
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.getByText("1 paket")).toBeTruthy();
    expect(screen.queryByText("Selesai")).toBeNull();
  });

  it("adds a Selesai section for completed plans, most recently ended first, and leaves out cancelled ones", async () => {
    mount(runtimeWith(async () => withFinished(eightPlans())));
    await screen.findByText("Rantang Nusantara");
    const heading = screen.getAllByTestId("plan-section")[1];
    expect(within(heading).getByText("Selesai")).toBeTruthy();
    const done = within(screen.getByTestId("plan-finished-list"));
    expect(rowNames(done)).toEqual(["Rantang Nusantara", "Plant-based Everyday"]);
    expect(within(done.getByTestId("plan-row-s-z1")).getByText(/^Dapur Senja · /)).toBeTruthy();
    // A finished plan is not an Aktif row, and a cancelled one is nowhere.
    expect(within(screen.getByTestId("plan-row-list")).queryByText("Rantang Nusantara")).toBeNull();
    expect(screen.queryByText("Paket Batal")).toBeNull();
    // The active count still counts only the running ones.
    expect(screen.getByText("8 paket")).toBeTruthy();
    fireEvent.press(done.getByText("Plant-based Everyday"));
    expect(router.push).toHaveBeenCalledWith("/subscriptions/s-z2?title=Plant-based%20Everyday");
  });

  it("shows no Selesai section when no plan has finished", async () => {
    mount(runtimeWith(async () => eightPlans()));
    await screen.findByText("Makan Siang Rumahan");
    expect(screen.queryByText("Selesai")).toBeNull();
    expect(screen.queryByTestId("plan-finished-list")).toBeNull();
  });

  it("with no running plan says so under Aktif and still lists the finished ones", async () => {
    mount(runtimeWith(async () => withFinished({ ...eightPlans(), subscriptions: [] })));
    expect(await screen.findByText("Belum ada paket aktif.")).toBeTruthy();
    expect(screen.getByText("Rantang Nusantara")).toBeTruthy();
    expect(screen.queryByTestId("plan-row-list")).toBeNull();
  });

  it("draws the cards on the dark theme's surface", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    mount(runtimeWith(async () => withFinished(eightPlans())));
    await screen.findByText("Rantang Nusantara");
    for (const card of screen.getAllByTestId("list-card")) expect(flat(card).backgroundColor).toBe(nativeThemes.dark.surface);
    scheme.mockRestore();
  });

  it("says so when there are no plans at all", async () => {
    mount(runtimeWith(async () => ({ ...eightPlans(), subscriptions: [], deliveries: [] })));
    expect(await screen.findByText("Belum ada paket aktif.")).toBeTruthy();
    expect(screen.queryByText("Selesai")).toBeNull();
  });

  it("reads Paket saya, Active, Finished and the days left in English, one day singular", async () => {
    (SecureStore as unknown as { __store: Map<string, string> }).__store.set("catera.locale", "en");
    const state = withFinished({
      ...eightPlans(),
      subscriptions: [
        plan("s-1", { name: "Paket Satu", caterer: "Dapur Contoh", remaining: 1, today: DEMO_TODAY }),
        plan("s-2", { name: "Paket Dua", caterer: "Dapur Contoh", remaining: 6, today: DEMO_TODAY }),
      ],
    });
    mount(runtimeWith(async () => state));
    expect(await screen.findByText("Dapur Contoh · 1 day to go")).toBeTruthy();
    expect(screen.getByText("Dapur Contoh · 6 days to go")).toBeTruthy();
    expect(screen.queryByText(/1 days/)).toBeNull();
    expect(within(screen.getByTestId("screen-native-title")).getByText("My plans")).toBeTruthy();
    const [active, done] = screen.getAllByTestId("plan-section");
    expect(within(active).getByText("Active")).toBeTruthy();
    expect(within(active).getByText("2 plans")).toBeTruthy();
    expect(within(done).getByText("Finished")).toBeTruthy();
  });

  it("lets a row's words wrap and the row grow at 360dp and font scale 1.3", async () => {
    mockWindow = { width: 360, height: 800, scale: 3, fontScale: 1.3 };
    mount(runtimeWith(async () => withFinished(eightPlans())));
    await screen.findByText("Rantang Nusantara");
    for (const id of ["plan-row-list", "plan-finished-list"])
      for (const text of within(screen.getByTestId(id)).getAllByText(/./)) expect(text.props.numberOfLines).toBeUndefined();
  });

  it("says so when the read fails, with the puzzled art, and reads again", async () => {
    let fail = true;
    mount(
      runtimeWith(async () => {
        if (fail) throw Object.assign(new Error("REQUEST_FAILED"), { code: "REQUEST_FAILED" });
        return eightPlans();
      }),
    );
    const retry = await screen.findByRole("button", { name: "Coba lagi" });
    expect(screen.getByTestId("mascot-bingung", { includeHiddenElements: true })).toBeTruthy();
    fail = false;
    await act(async () => fireEvent.press(retry));
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
  });

  it("signed out asks to sign in under the title Paket saya", async () => {
    mount(runtimeWith(async () => eightPlans(), null));
    expect(await screen.findByRole("button", { name: "Masuk" })).toBeTruthy();
    expect(within(screen.getByTestId("screen-native-title")).getByText("Paket saya")).toBeTruthy();
  });
});
