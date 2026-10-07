import { render, screen } from "@testing-library/react-native";
import type { LibraryDish, MealMenu } from "@catera/domain";
import { copyWeekBatches, dayComplete, suggestDishes, weekDates } from "../src/menu/logic";
import { SlotEditor } from "../src/menu/SlotEditor";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-notifications", () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
}));

const dish = (id: string, name: string, categoryId = "main"): LibraryDish =>
  ({ id, name, categoryId, description: "", image: "", serving: "", catererId: "k-1", version: 1, archived: false }) as LibraryDish;
const composition = [
  { id: "g-nasi", categoryId: "rice", name: "Nasi", slots: 1 },
  { id: "g-lauk", categoryId: "main", name: "Lauk", slots: 2 },
  { id: "g-sayur", categoryId: "vegetable", name: "Sayur", slots: 1 },
];
const item = (id: string, groupId: string, categoryId: string, name: string) => ({
  id,
  groupId,
  categoryId,
  name,
  description: "",
  image: "",
  serving: "",
});

describe("suggestDishes", () => {
  const library = [dish("d1", "Pepes tahu"), dish("d2", "Pepes ikan kembung"), dish("d3", "Pepes ayam", "vegetable"), { ...dish("d4", "Pepes udang"), archived: true }];
  it("matches by text within the category, most used first, hiding archived dishes", () => {
    const usage = new Map([["d2", 3], ["d1", 1]]);
    expect(suggestDishes(library, "main", "pep", usage).map((d) => d.name)).toEqual([
      "Pepes ikan kembung",
      "Pepes tahu",
    ]);
  });
});

describe("dayComplete", () => {
  it("requires exactly the package's count per category", () => {
    const one = [item("a", "g-nasi", "rice", "Nasi putih"), item("b", "g-lauk", "main", "Ayam"), item("c", "g-sayur", "vegetable", "Asem")];
    expect(dayComplete(composition, one)).toBe(false);
    expect(dayComplete(composition, [...one, item("d", "g-lauk", "main", "Tempe")])).toBe(true);
  });
});

describe("copyWeekBatches", () => {
  const menuFor = (lauk: string): MealMenu =>
    ({ name: "Makan Siang", description: "", image: "", meal: "lunch", composition, items: [item("x", "g-lauk", "main", lauk)] }) as MealMenu;
  it("sends one save per distinct menu and never mixes months", () => {
    const lastWeek = [
      { date: "2026-09-28", details: menuFor("Ayam") },
      { date: "2026-09-29", details: menuFor("Rendang") },
      { date: "2026-09-30", details: menuFor("Ayam") },
      { date: "2026-10-01", details: menuFor("Ikan") },
      { date: "2026-10-02", details: menuFor("Telur") },
    ];
    const versions = new Map([["2026-10-05", 2]]);
    const batches = copyWeekBatches(lastWeek, versions);
    expect(batches.map((b) => b.dates.map((d) => d.date))).toEqual([
      ["2026-10-05", "2026-10-07"],
      ["2026-10-06"],
      ["2026-10-08"],
      ["2026-10-09"],
    ]);
    expect(batches[0].dates[0].version).toBe(2);
    expect(batches[0].details).not.toHaveProperty("meal");
  });
});

describe("weekDates", () => {
  it("lists the package's delivery weekdays of the week containing the date", () => {
    expect(weekDates("2026-10-07", [1, 2, 3, 4, 5])).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });
});

it("keeps Simpan disabled until every category is filled exactly", () => {
  render(
    <SlotEditor
      composition={composition}
      items={[item("a", "g-nasi", "rice", "Nasi putih"), item("b", "g-lauk", "main", "Ayam goreng kremes"), item("c", "g-sayur", "vegetable", "Sayur asem")]}
      library={[]}
      usage={new Map()}
      onChange={() => undefined}
      onCreate={async () => dish("n", "x")}
      onSave={() => undefined}
      saving={false}
      canEdit
    />,
  );
  expect(screen.getByText("Lauk · 1 dari 2")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Simpan menu" }).props.accessibilityState.disabled).toBe(true);
});

it("does not offer helpers package creation on an empty menu", async () => {
  const { createMobileRuntime, MobileProvider } = jest.requireActual("@catera/mobile-core") as typeof import("@catera/mobile-core");
  const { MenuWeek } = jest.requireActual("../src/menu/MenuWeek") as typeof import("../src/menu/MenuWeek");
  const runtime = createMobileRuntime({ apiUrl: "https://api.example.test", storagePrefix: "m" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-2", role: "staff", catererId: "k-1" }, demo: false })),
    sellerOperations: jest.fn(async () => ({ offers: [], dishes: [], datedMenus: [], caterer: { name: "Dapur" } })),
  } as unknown as typeof runtime.api;
  render(
    <MobileProvider runtime={runtime} linkMapper={(h: string) => h}>
      <MenuWeek />
    </MobileProvider>,
  );
  expect(await screen.findByText("Belum ada paket.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Buat paket" })).toBeNull();
});
