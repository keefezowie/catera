import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { Offer } from "@catera/domain";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import { MoodProvider } from "@catera/mobile-ui";
import { customerLink } from "../src/links";
import { Jelajah } from "../src/discover/Jelajah";
import { NutritionCard } from "../src/discover/NutritionCard";
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
// carbohydrate, Ayam Sambal Rumahan has none.
const full = offer({ id: "p-ayam", name: "Ayam Panggang Harian", nutrition: { caloriesKcal: 620, proteinG: 32, carbsG: 78, fatG: 20 } });
const noCarbs = offer({ id: "p-salmon", name: "Salmon Teriyaki", nutrition: { caloriesKcal: 580, proteinG: 34, fatG: 22 } });
const zeroFat = offer({ id: "p-nabati", name: "Sayur Rebus", nutrition: { caloriesKcal: 310, proteinG: 12, fatG: 0 } });
const range = offer({ id: "p-rantang", name: "Rantang Nusantara", nutrition: { caloriesKcal: { min: 580, max: 640 }, proteinG: 32 } });
const caloriesOnly = offer({ id: "p-kalori", name: "Nasi Kuning", nutrition: { caloriesKcal: 540 } });
const none = offer({ id: "p-sambal", name: "Ayam Sambal Rumahan", nutrition: null });
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
    <MoodProvider now={SIANG_NOW}>
      <MobileProvider runtime={runtimeWith()} linkMapper={customerLink}>
        {ui}
      </MobileProvider>
    </MoodProvider>,
  );
const card = (o: Offer, os: "ios" | "android") => wrap(<NutritionCard offer={o} os={os} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("NutritionCard", () => {
  it("the card shows filled metrics with units and the caption", async () => {
    // iOS: a label over each value, two by two. Jest compiles the Android build, so iOS is pinned through `os`.
    let view = card(full, "ios");
    expect(await screen.findByText("Gizi per porsi")).toBeTruthy();
    for (const [label, value] of [
      ["Kalori", "620 kkal"],
      ["Protein", "32 g"],
      ["Karbohidrat", "78 g"],
      ["Lemak", "20 g"],
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(screen.getByText("Perkiraan dari katering. Bisa berbeda tiap menu.")).toBeTruthy();
    expect(screen.getAllByTestId("gizi-row")).toHaveLength(2);
    // Order is Kalori, Protein, Karbohidrat, Lemak; each tile reads as one phrase.
    expect(screen.getAllByTestId("gizi-tile").map((t) => t.props.accessibilityLabel)).toEqual([
      "Kalori 620 kkal",
      "Protein 32 g",
      "Karbohidrat 78 g",
      "Lemak 20 g",
    ]);
    // Values are tabular numbers.
    expect(StyleSheet.flatten(screen.getByText("620 kkal").props.style).fontVariant).toEqual(["tabular-nums"]);
    view.unmount();

    // Android: four compact tiles in one row, the value over a short label ("Karbo"), the calorie unit as its label.
    view = card(full, "android");
    await screen.findByText("Gizi per porsi");
    expect(screen.getAllByTestId("gizi-row")).toHaveLength(1);
    for (const text of ["620", "kkal", "32 g", "Protein", "78 g", "Karbo", "20 g", "Lemak"]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText("Karbohidrat")).toBeNull();
    expect(screen.getAllByTestId("gizi-tile").map((t) => t.props.accessibilityLabel)).toEqual([
      "Kalori 620 kkal",
      "Protein 32 g",
      "Karbohidrat 78 g",
      "Lemak 20 g",
    ]);
    view.unmount();
  });

  it("zero is shown and an empty metric is not", async () => {
    card(zeroFat, "ios");
    expect(await screen.findByText("0 g")).toBeTruthy();
    expect(screen.getByText("Lemak")).toBeTruthy();
    expect(screen.queryByText("Karbohidrat")).toBeNull();
    expect(screen.getAllByTestId("gizi-tile")).toHaveLength(3);
    // No unavailable mark either: the empty metric is simply left out.
    expect(screen.queryByText("—")).toBeNull();
  });

  it("only calories shows one tile", async () => {
    card(caloriesOnly, "android");
    expect(await screen.findByText("540")).toBeTruthy();
    expect(screen.getAllByTestId("gizi-tile")).toHaveLength(1);
  });

  it("at large text the Android tiles wrap two by two instead of truncating", async () => {
    // Jest has no layout engine: the grid's measured width is handed in through its layout event. 288 is a 360dp
    // screen less the page and card padding.
    const dims = jest.spyOn(require("react-native"), "useWindowDimensions");
    dims.mockReturnValue({ width: 360, height: 760, scale: 3, fontScale: 1.3 });
    card(full, "android");
    await screen.findByText("Gizi per porsi");
    act(() => {
      fireEvent(screen.getByTestId("gizi-grid"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 288, height: 80 } } });
    });
    expect(screen.getAllByTestId("gizi-row")).toHaveLength(2);
    // No value or label is ever cut to one line with an ellipsis.
    for (const tile of screen.getAllByTestId("gizi-tile"))
      for (const text of within(tile).UNSAFE_getAllByType(require("react-native").Text)) expect(text.props.numberOfLines).toBeUndefined();
    dims.mockRestore();
  });

  it("a calorie range reads 580–640", async () => {
    const view = card(range, "ios");
    expect(await screen.findByText("580–640 kkal")).toBeTruthy();
    view.unmount();
    mockParams = { id: "p-rantang" };
    wrap(<PackageDetail />);
    expect(await screen.findByText("580–640 kkal · 32 g protein per porsi")).toBeTruthy();
  });

  it("no metrics, no card and no line", async () => {
    const view = card(none, "ios");
    expect(screen.queryByText("Gizi per porsi")).toBeNull();
    view.unmount();
    mockParams = { id: "p-sambal" };
    wrap(<PackageDetail />);
    expect(await screen.findByText("Ayam Sambal Rumahan")).toBeTruthy();
    expect(screen.queryByText("Gizi per porsi")).toBeNull();
    expect(screen.queryByText(/protein per porsi$/)).toBeNull();
  });
});

describe("Paket", () => {
  it("shows the gizi card after the package contents and the line under the name", async () => {
    mockParams = { id: "p-ayam" };
    wrap(<PackageDetail />);
    expect(await screen.findByText("620 kkal · 32 g protein per porsi")).toBeTruthy();
    expect(screen.getByText("Gizi per porsi")).toBeTruthy();
    expect(screen.getByText("Perkiraan dari katering. Bisa berbeda tiap menu.")).toBeTruthy();
  });

  it("the line needs both calories and protein", async () => {
    mockParams = { id: "p-kalori" };
    wrap(<PackageDetail />);
    expect(await screen.findByText("Gizi per porsi")).toBeTruthy();
    expect(screen.queryByText(/protein per porsi$/)).toBeNull();
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
    // Salmon is 580; a range shows its lower bound, so Rantang's 580–640 reads "± 580 kkal" too.
    expect(screen.getAllByText("± 580 kkal")).toHaveLength(2);
    // Six packages, five with calories: the one without has no suffix.
    expect(screen.getAllByText(/^± \d+ kkal$/)).toHaveLength(5);
  });
});
