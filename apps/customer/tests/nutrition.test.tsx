import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { fonts, LayoutScaleProvider, MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { Jelajah } from "../src/discover/Jelajah";
import { StatStrip } from "../src/discover/NutritionCard";
import { PackageDetail } from "../src/discover/PackageDetail";
import { offer } from "./fixtures";

let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  Link: () => null,
  useLocalSearchParams: () => mockParams,
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

// Values from the demo seed (packages/backend/src/seed.ts): Ayam Panggang Harian has all four, Salmon Teriyaki has no
// carbohydrate, Rantang Nusantara's two menus (lines 316 and 352) give a range for every metric, Ayam Sambal Rumahan
// has none.
const full = offer({ id: "p-ayam", name: "Ayam Panggang Harian", nutrition: { caloriesKcal: 620, proteinG: 32, carbsG: 78, fatG: 20 } });
const noCarbs = offer({ id: "p-salmon", name: "Salmon Teriyaki", nutrition: { caloriesKcal: 580, proteinG: 34, fatG: 22 } });
const range = offer({
  id: "p-rantang",
  name: "Rantang Nusantara",
  nutrition: {
    caloriesKcal: { min: 610, max: 640 },
    proteinG: { min: 29, max: 30 },
    carbsG: { min: 76, max: 82 },
    fatG: { min: 19, max: 21 },
  },
});
const none = offer({ id: "p-sambal", name: "Ayam Sambal Rumahan", nutrition: null });
// Synthetic, not from the seed: a zero, a calorie-only package and the brief's own range example.
const zeroFat = offer({ id: "p-nabati", name: "Sayur Rebus", nutrition: { caloriesKcal: 310, proteinG: 12, fatG: 0 } });
const caloriesOnly = offer({ id: "p-kalori", name: "Nasi Kuning", nutrition: { caloriesKcal: 540 } });
const calorieRange = offer({ id: "p-contoh", name: "Paket Contoh", nutrition: { caloriesKcal: { min: 580, max: 640 }, proteinG: 32 } });
const all = [full, noCarbs, zeroFat, range, caloriesOnly, none];

function runtimeWith(): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "catera" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-c1", role: "customer", name: "Rani Contoh" }, demo: false })),
    catalog: jest.fn(async () => ({ items: all, nextCursor: null })),
    offer: jest.fn(async (id: string) => ({ offer: all.find((o) => o.id === id) ?? null })),
    request: jest.fn(async () => []),
    savedPackages: jest.fn(async () => ({ packageIds: [], items: [], nextCursor: null })),
    command: jest.fn(async () => ({})),
  } as unknown as MobileRuntime["api"];
  return runtime;
}

const SIANG_NOW = () => new Date("2026-10-09T07:59:00Z");
const wrap = (ui: React.ReactElement) =>
  render(
    <LayoutScaleProvider value="v2">
      <MoodProvider now={SIANG_NOW}>
        <MobileProvider runtime={runtimeWith()} linkMapper={customerLink}>
          {ui}
        </MobileProvider>
      </MoodProvider>
    </LayoutScaleProvider>,
  );
const strip = (o: Offer) => wrap(<StatStrip offer={o} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("StatStrip", () => {
  const cells = () => within(screen.getByTestId("stat-strip")).getAllByTestId("stat-cell");
  const labels = () => cells().map((c) => c.props.accessibilityLabel);
  const flat = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;

  it("one card of up to three cells: kkal, protein and meals a day, the numbers section 800 over a meta label", async () => {
    strip(full);
    expect(await screen.findByTestId("stat-strip")).toBeTruthy();
    expect(labels()).toEqual(["620 kkal", "32 g protein", "1× makan sehari"]);
    // One card (radius 16, padding 16, three columns), not a grid of tiles.
    expect(flat(screen.getByTestId("stat-strip"))).toMatchObject({ flexDirection: "row", borderRadius: 16, padding: 15, borderWidth: 1 });
    expect(screen.queryByTestId("gizi-row")).toBeNull();
    expect(screen.queryByTestId("gizi-tile")).toBeNull();
    // The number: section (20/26) at 800, tabular. The label: meta (13/18).
    expect(flat(screen.getByText("620"))).toMatchObject({ fontSize: 20, lineHeight: 26, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] });
    expect(flat(screen.getByText("kkal"))).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(screen.getByText("32 g")).toBeTruthy();
    expect(screen.getByText("protein")).toBeTruthy();
    expect(screen.getByText("1×")).toBeTruthy();
    expect(screen.getByText("makan sehari")).toBeTruthy();
  });

  it("carbs and fat are one meta line under the strip, with the caterer's caveat", async () => {
    strip(full);
    const line = await screen.findByText("Karbo 78 g · Lemak 20 g per porsi");
    expect(flat(line)).toMatchObject({ fontSize: 13, lineHeight: 18 });
    expect(screen.getByText("Perkiraan dari katering. Bisa berbeda tiap menu.")).toBeTruthy();
    expect(screen.queryByText("Gizi per porsi")).toBeNull();
  });

  it("a combined day reads 2× makan sehari", async () => {
    strip(offer({ id: "p-dua", name: "Siang dan Malam", meal: "both", nutrition: { caloriesKcal: 600, proteinG: 30 } }));
    await screen.findByTestId("stat-strip");
    expect(labels()).toEqual(["600 kkal", "30 g protein", "2× makan sehari"]);
  });

  it("ranges read 610–640 and carbs and fat keep theirs", async () => {
    strip(range);
    await screen.findByTestId("stat-strip");
    expect(labels()).toEqual(["610–640 kkal", "29–30 g protein", "1× makan sehari"]);
    expect(screen.getByText("Karbo 76–82 g · Lemak 19–21 g per porsi")).toBeTruthy();
  });

  it("an empty metric is left out", async () => {
    strip(noCarbs);
    expect(await screen.findByText("Lemak 22 g per porsi")).toBeTruthy();
    expect(screen.queryByText(/Karbo/)).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("zero fat is a value", async () => {
    strip(zeroFat);
    expect(await screen.findByText("Lemak 0 g per porsi")).toBeTruthy();
  });

  it("only calories gives two cells (kkal and meals a day) and no carbs line", async () => {
    strip(caloriesOnly);
    await screen.findByTestId("stat-strip");
    expect(labels()).toEqual(["540 kkal", "1× makan sehari"]);
    expect(screen.queryByText(/per porsi/)).toBeNull();
  });

  it("only carbs and fat leave the strip out but keep their line", async () => {
    strip(offer({ id: "p-karbo", name: "Karbo", nutrition: { carbsG: 50, fatG: 10 } }));
    expect(await screen.findByText("Karbo 50 g · Lemak 10 g per porsi")).toBeTruthy();
    expect(screen.queryByTestId("stat-strip")).toBeNull();
  });

  it("no metrics, no strip, no line and no caveat", async () => {
    const view = strip(none);
    expect(screen.queryByTestId("stat-strip")).toBeNull();
    expect(screen.queryByText(/Perkiraan dari katering/)).toBeNull();
    view.unmount();
    mockParams = { id: "p-sambal" };
    wrap(<PackageDetail />);
    expect(await screen.findByText("Ayam Sambal Rumahan")).toBeTruthy();
    expect(screen.queryByTestId("stat-strip")).toBeNull();
    expect(screen.queryByText(/per porsi/)).toBeNull();
  });

  it("at large text on a 360dp phone the cells stack under each other and nothing is cut", async () => {
    const dims = jest.spyOn(require("react-native"), "useWindowDimensions");
    dims.mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    const view = strip(range);
    await screen.findByTestId("stat-strip");
    expect(flat(screen.getByTestId("stat-strip")).flexDirection).toBe("column");
    expect(cells()).toHaveLength(3);
    for (const text of screen.getByTestId("stat-strip").findAll((n) => n.type === require("react-native").Text))
      expect(text.props.numberOfLines).toBeUndefined();
    view.unmount();
    dims.mockReturnValue({ width: 412, height: 860, scale: 3, fontScale: 1 });
    strip(range);
    expect(flat(screen.getByTestId("stat-strip")).flexDirection).toBe("row");
    dims.mockRestore();
  });
});

describe("Paket", () => {
  it("shows the strip and the carbs line, and no 'kkal · protein per porsi' line under the name", async () => {
    mockParams = { id: "p-ayam" };
    wrap(<PackageDetail />);
    expect(await screen.findByTestId("stat-strip")).toBeTruthy();
    expect(screen.getByText("Karbo 78 g · Lemak 20 g per porsi")).toBeTruthy();
    expect(screen.queryByText("620 kkal · 32 g protein per porsi")).toBeNull();
  });

  it("a calorie-only package still shows its strip", async () => {
    mockParams = { id: "p-kalori" };
    wrap(<PackageDetail />);
    expect(await screen.findByTestId("stat-strip")).toBeTruthy();
  });
});

describe("Jelajah", () => {
  it("the Jelajah row shows ± kalori only when present", async () => {
    wrap(<Jelajah />);
    // The area read and the catalogue load one after the other, so the first paint can take longer than the default wait.
    expect(await screen.findByText("Ayam Sambal Rumahan", {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("± 620 kkal")).toBeTruthy();
    expect(screen.getByText("± 310 kkal")).toBeTruthy();
    expect(screen.getByText("± 540 kkal")).toBeTruthy();
    expect(screen.getByText("± 580 kkal")).toBeTruthy();
    // A range shows its lower bound: Rantang's 610–640 reads "± 610 kkal".
    expect(screen.getByText("± 610 kkal")).toBeTruthy();
    // Six packages, five with calories: the one without has no suffix.
    expect(screen.getAllByText(/^± \d+ kkal$/)).toHaveLength(5);
  });
});
