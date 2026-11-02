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

/** Jest's own window at the default text size, so the type ramp's line heights hold (above 1, Android drops them). */
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 750, height: 1334, scale: 2, fontScale: 1 }),
}));

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
const wrap = async (ui: React.ReactElement) =>
  await render(
    <LayoutScaleProvider value="v2">
      <MoodProvider now={SIANG_NOW}>
        <MobileProvider runtime={runtimeWith()} linkMapper={customerLink}>
          {ui}
        </MobileProvider>
      </MoodProvider>
    </LayoutScaleProvider>,
  );
const strip = async (o: Offer) => await wrap(<StatStrip offer={o} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("StatStrip", () => {
  const cells = () => within(screen.getByTestId("stat-strip")).getAllByTestId("stat-cell");
  const labels = () => cells().map((c) => c.props.accessibilityLabel);
  const flat = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
  const bar = () => screen.getByTestId("energy-bar", { includeHiddenElements: true }).children.map((n) => flat(n as never).flex);

  it("one card: calories with kkal and per porsi, the energy bar, the three macros as columns and the caveat inside", async () => {
    await strip(full);
    expect(await screen.findByTestId("stat-strip")).toBeTruthy();
    expect(flat(screen.getByTestId("nutrition"))).toMatchObject({ borderRadius: 16, padding: 15, borderWidth: 1 });
    expect(screen.getByTestId("stat-kcal").props.accessibilityLabel).toBe("620 kkal per porsi");
    expect(flat(screen.getByText(/^620/))).toMatchObject({ fontSize: 20, lineHeight: 26, fontFamily: fonts.extrabold, fontVariant: ["tabular-nums"] });
    expect(labels()).toEqual(["Protein 32 g, 21% energi", "Karbohidrat 78 g, 50% energi", "Lemak 20 g, 29% energi"]);
    expect(flat(screen.getByTestId("stat-strip")).flexDirection).toBe("row");
    expect(screen.getByText("Karbo 50%")).toBeTruthy();
    // Protein and carbs 4 kkal a gram, fat 9: 128, 312 and 180 of 620.
    expect(bar()).toEqual([21, 50, 29]);
    const caveat = screen.getByText("Perkiraan dari katering. Bisa berbeda tiap menu.");
    expect(within(screen.getByTestId("nutrition")).getByText("Perkiraan dari katering. Bisa berbeda tiap menu.")).toBe(caveat);
    expect(screen.queryByText(/makan sehari/)).toBeNull();
  });

  it("ranges read 610–640 and the shares come from the middle of each range", async () => {
    await strip(range);
    await screen.findByTestId("stat-strip");
    expect(screen.getByTestId("stat-kcal").props.accessibilityLabel).toBe("610–640 kkal per porsi");
    expect(labels()).toEqual(["Protein 29–30 g, 19% energi", "Karbohidrat 76–82 g, 51% energi", "Lemak 19–21 g, 30% energi"]);
  });

  it("an empty metric is left out, and without all three macros there is no bar and no share", async () => {
    await strip(noCarbs);
    await screen.findByTestId("stat-strip");
    expect(labels()).toEqual(["Protein 34 g", "Lemak 22 g"]);
    expect(screen.queryByTestId("energy-bar", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText(/Karbo/)).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("zero fat is a value", async () => {
    await strip(zeroFat);
    await screen.findByTestId("stat-strip");
    expect(labels()).toContain("Lemak 0 g");
  });

  it("only calories gives the calorie line and the caveat, no columns", async () => {
    await strip(caloriesOnly);
    expect(await screen.findByTestId("stat-kcal")).toBeTruthy();
    expect(screen.queryByTestId("stat-strip")).toBeNull();
    expect(screen.getByText(/Perkiraan dari katering/)).toBeTruthy();
  });

  it("only carbs and fat keep their columns without a calorie line", async () => {
    await strip(offer({ id: "p-karbo", name: "Karbo", nutrition: { carbsG: 50, fatG: 10 } }));
    await screen.findByTestId("stat-strip");
    expect(labels()).toEqual(["Karbohidrat 50 g", "Lemak 10 g"]);
    expect(screen.queryByTestId("stat-kcal")).toBeNull();
  });

  it("no metrics, no card and no caveat", async () => {
    const view = await strip(none);
    expect(screen.queryByTestId("nutrition")).toBeNull();
    expect(screen.queryByText(/Perkiraan dari katering/)).toBeNull();
    await view.unmount();
    mockParams = { id: "p-sambal" };
    await wrap(<PackageDetail />);
    expect(await screen.findByText("Ayam Sambal Rumahan")).toBeTruthy();
    expect(screen.queryByTestId("nutrition")).toBeNull();
    expect(screen.queryByText(/per porsi/)).toBeNull();
  });

  it("at large text on a 360dp phone the columns become lines and nothing is cut", async () => {
    const dims = jest.spyOn(require("react-native"), "useWindowDimensions");
    dims.mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    const view = await strip(range);
    await screen.findByTestId("stat-strip");
    expect(flat(screen.getByTestId("stat-strip")).flexDirection).toBeUndefined();
    expect(flat(cells()[0]).flexDirection).toBe("row-reverse");
    for (const text of screen.getByTestId("nutrition").queryAll((n) => n.type === require("react-native").Text))
      expect(text.props.numberOfLines).toBeUndefined();
    await view.unmount();
    dims.mockReturnValue({ width: 412, height: 860, scale: 3, fontScale: 1 });
    await strip(range);
    expect(flat(screen.getByTestId("stat-strip")).flexDirection).toBe("row");
    dims.mockRestore();
  });
});

describe("Paket", () => {
  it("shows the card, and no 'kkal · protein per porsi' line under the name", async () => {
    mockParams = { id: "p-ayam" };
    await wrap(<PackageDetail />);
    expect(await screen.findByTestId("stat-strip")).toBeTruthy();
    expect(screen.getByTestId("energy-bar", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("620 kkal · 32 g protein per porsi")).toBeNull();
  });

  it("a calorie-only package still shows its card", async () => {
    mockParams = { id: "p-kalori" };
    await wrap(<PackageDetail />);
    expect(await screen.findByTestId("stat-kcal")).toBeTruthy();
  });
});

describe("Jelajah", () => {
  it("the Jelajah row shows ± kalori only when present", async () => {
    await wrap(<Jelajah />);
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
