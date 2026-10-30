import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import { NavigationContext } from "expo-router/react-navigation";
import { jakartaDay, type SellerOperationsState } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider, ThemeProvider } from "@catera/mobile-ui";
import { render } from "./render-dapur";
import { canvasDay, emptyDay } from "./fixtures";
import { BelanjaScreen } from "../src/today/BelanjaScreen";
import { belanjaHtml, belanjaLines } from "../src/today/belanja";
import { goToTab } from "../src/nav";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  Link: () => null,
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
jest.mock("expo-print", () => ({ printAsync: jest.fn(async () => undefined) }));
jest.mock("../src/nav", () => ({ ...jest.requireActual("../src/nav"), goToTab: jest.fn() }));

const composition = [
  { id: "g-nasi", name: "Nasi", slots: 1 },
  { id: "g-lauk", name: "Lauk", slots: 2 },
  { id: "g-sayur", name: "Sayur", slots: 1 },
];
const hematGroups = [composition[0], { ...composition[1], slots: 1 }, composition[2]];
const dated = (date: string, packageId: string, names: [string, string][], groups = composition) => ({
  package_id: packageId,
  content_revision: 0,
  service_date: date,
  meal: "lunch",
  version: 1,
  details: {
    name: "",
    description: "",
    image: "",
    meal: "lunch",
    composition: groups,
    items: names.map(([groupId, name], i) => ({ id: `${packageId}-${i}`, name, groupId })),
  },
});
const dishes: [string, string][] = [
  ["g-nasi", "Nasi putih"],
  ["g-lauk", "Ayam bakar madu"],
  ["g-lauk", "Tempe orek"],
  ["g-sayur", "Sayur asem"],
];

/** A day with the canvas orders (28 portions of Makan Siang Rumahan, 6 Paket Hemat Kantor), menus filled or not. */
function orderedDay(date: string, filled = true): SellerOperationsState {
  const day = canvasDay();
  day.operationalDate = date;
  day.datedMenus = filled
    ? ([dated(date, "p-rumahan", dishes), dated(date, "p-hemat", [["g-nasi", "Nasi putih"], ["g-lauk", "Telur balado"], ["g-sayur", "Sayur asem"]], hematGroups)] as never)
    : [];
  return day;
}
const quiet = (date: string): SellerOperationsState => ({ ...emptyDay(), operationalDate: date });

/** The seven dates the screen reads, from now on. */
const sevenDates = () => Array.from({ length: 7 }, (_, i) => jakartaDay(new Date(), i));

function runtimeWith(
  sellerOperations: (catererId: string, date?: string) => Promise<SellerOperationsState>,
  role: "owner" | "staff" = "owner",
): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role, catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(sellerOperations),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

type Bar = { setOptions: jest.Mock; isFocused: () => boolean; addListener: () => () => void };

/** The screen inside a stand-in navigator, so the header options it sets can be read back and drawn. */
async function show(runtime: MobileRuntime, english = false) {
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  if (english) store.set(runtime.storageKey("locale"), "en");
  else store.delete(runtime.storageKey("locale"));
  const bar: Bar = { setOptions: jest.fn(), isFocused: () => true, addListener: () => () => undefined };
  const view = render(
    <ThemeProvider storageKey="t.theme">
      <MoodProvider now={() => new Date("2026-10-08T03:00:00Z")}>
        <MobileProvider runtime={runtime} linkMapper={(h) => h}>
          <NavigationContext.Provider value={bar as never}>
            <BelanjaScreen />
          </NavigationContext.Provider>
        </MobileProvider>
      </MoodProvider>
    </ThemeProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return { ...view, bar };
}

/** The last `headerRight` the screen set, drawn into the tree; null when the bar has none. */
function drawHeaderRight(bar: Bar) {
  const calls = bar.setOptions.mock.calls.map((c) => c[0] as { headerRight?: () => React.ReactElement });
  const right = calls[calls.length - 1]?.headerRight;
  return right ? right() : null;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Belanja 7 hari", () => {
  it("reads today and the six days after it, one read each", async () => {
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!));
    await show(runtime);
    const reads = (runtime.api.sellerOperations as jest.Mock).mock.calls;
    // The provider settles the signed-in account after the first paint, which reads again for the kitchen; every read is one of the seven days.
    expect([...new Set(reads.map((c) => c[1]))]).toEqual(sevenDates());
    expect(reads.slice(-7).map((c) => [c[0], c[1]])).toEqual(sevenDates().map((d) => ["k-1", d]));
  });

  it("loading: skeleton rows, no spinner, no figure yet", async () => {
    const runtime = runtimeWith(() => new Promise(() => undefined));
    await show(runtime);
    expect(screen.getByTestId("belanja-skeleton")).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.queryByTestId("belanja-total")).toBeNull();
  });

  it("filled: the dish is summed over the seven days, with its total, range and a section per category", async () => {
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!));
    await show(runtime);
    // Seven days of 28 Ayam bakar madu each.
    const row = await screen.findByTestId("belanja-dish-Ayam bakar madu");
    expect(within(row).getByText("196 porsi")).toBeTruthy();
    // 34 portions a day over seven days.
    expect(screen.getByTestId("belanja-total").props.children).toBe("238 porsi");
    expect(screen.getByText(/ sampai /)).toBeTruthy();
    for (const category of ["Lauk", "Nasi", "Sayur"]) expect(screen.getByTestId(`belanja-section-${category}`)).toBeTruthy();
    expect(screen.queryByTestId("belanja-unfilled")).toBeNull();
    expect(screen.queryByText("Isi menu")).toBeNull();
  });

  it("failed read: one rejected day shows the error and no dish rows, and Coba lagi reads again", async () => {
    let fail = true;
    const runtime = runtimeWith(async (_id, date) => {
      if (fail && date === sevenDates()[3]) throw new Error("offline");
      return orderedDay(date!);
    });
    await show(runtime);
    expect(await screen.findByText("Rekap belanja belum bisa dimuat.")).toBeTruthy();
    expect(screen.queryByTestId("belanja-total")).toBeNull();
    expect(screen.queryByTestId("belanja-dish-Ayam bakar madu")).toBeNull();
    expect(screen.queryByTestId("belanja-skeleton")).toBeNull();
    fail = false;
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Coba lagi" }));
    });
    expect(await screen.findByTestId("belanja-dish-Ayam bakar madu")).toBeTruthy();
    expect(screen.queryByText("Rekap belanja belum bisa dimuat.")).toBeNull();
  });

  it("empty: the sleeping mascot and the line, and no Bagikan or Cetak", async () => {
    const { bar } = await show(runtimeWith(async (_id, date) => quiet(date!)));
    expect(await screen.findByText("Belum ada pesanan 7 hari ke depan.")).toBeTruthy();
    expect(screen.getByTestId("belanja-empty")).toBeTruthy();
    expect(screen.queryByTestId("belanja-total")).toBeNull();
    expect(drawHeaderRight(bar)).toBeNull();
  });

  it("unfilled menus: one bold row with the portions, never a dish, and Isi menu takes the owner to Menu", async () => {
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!, date !== sevenDates()[0]));
    await show(runtime);
    const row = await screen.findByTestId("belanja-unfilled");
    // The first day, bare: 28 x 4 slots and 6 x 3.
    expect(within(row).getByText("Menu belum diisi · 130 porsi")).toBeTruthy();
    const style = StyleSheet.flatten(within(row).getByText("Menu belum diisi · 130 porsi").props.style);
    expect(String(style.fontFamily ?? style.fontWeight)).toMatch(/700|bold|Bold|Strong/i);
    expect(screen.queryByTestId("belanja-dish-")).toBeNull();
    // Six filled days of 28.
    expect(screen.getByTestId("belanja-dish-Ayam bakar madu").props.accessibilityLabel).toContain("168");
    const fill = screen.getByRole("button", { name: "Isi menu" });
    expect(StyleSheet.flatten(fill.props.style).minHeight).toBeGreaterThanOrEqual(48);
    fireEvent.press(fill);
    expect(goToTab).toHaveBeenCalledWith("menu");
  });

  it("a helper opens the recap and sees the unfilled row, but no Isi menu", async () => {
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!, false), "staff");
    await show(runtime);
    expect(await screen.findByTestId("belanja-unfilled")).toBeTruthy();
    expect(screen.getByText("Menu belum diisi · 910 porsi")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Isi menu" })).toBeNull();
  });

  it("Bagikan shares the Indonesian text, Cetak prints it, both from the bar", async () => {
    const { Share } = jest.requireActual("react-native") as typeof import("react-native");
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const Print = require("expo-print") as { printAsync: jest.Mock };
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!));
    const { bar } = await show(runtime);
    await screen.findByTestId("belanja-total");
    const header = render(<>{drawHeaderRight(bar)}</>);
    const [from, to] = [sevenDates()[0], sevenDates()[6]];
    const week = { total: 238, from, to, unfilled: 0 };
    await act(async () => {
      fireEvent.press(header.getByRole("button", { name: "Bagikan" }));
    });
    const message = (share.mock.calls[0][0] as { message: string }).message;
    expect(message.split("\n")[0]).toBe("Dapur Bu Rina");
    expect(message).toContain(`*Belanja 7 hari* (`);
    expect(message).toContain(`, ${week.total} porsi)`);
    expect(message).toContain("*Lauk*\n196× Ayam bakar madu");
    expect(message).not.toContain("—");
    await act(async () => {
      fireEvent.press(header.getByRole("button", { name: "Cetak" }));
    });
    const html = (Print.printAsync.mock.calls[0][0] as { html: string }).html;
    expect(html).toContain("Dapur Bu Rina · Belanja 7 hari");
    expect(html).toContain("<li>196 × Ayam bakar madu</li>");
    share.mockRestore();
  });

  it("English labels in the app, Indonesian in the shared text", async () => {
    const runtime = runtimeWith(async (_id, date) => orderedDay(date!, false));
    const { bar } = await show(runtime, true);
    expect(await screen.findByText(/Menu not filled in/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fill in menu" })).toBeTruthy();
    const header = render(<>{drawHeaderRight(bar)}</>);
    expect(header.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(header.getByRole("button", { name: "Print" })).toBeTruthy();
    const week = { total: 7, byDish: [{ name: "Nasi putih", category: "Nasi", count: 7 }], unfilled: 3, from: "2026-10-08", to: "2026-10-14" };
    expect(belanjaLines(week, "Dapur Bu Rina")).toBe(
      "Dapur Bu Rina\n*Belanja 7 hari* (Kamis 8 Okt sampai Rabu 14 Okt, 7 porsi)\n\n*Nasi*\n7× Nasi putih\n\nMenu belum diisi · 3 porsi",
    );
    expect(belanjaHtml(week, "Dapur <Bu> Rina")).toContain("Dapur &lt;Bu&gt; Rina · Belanja 7 hari");
  });
});
