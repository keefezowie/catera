import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SellerOffer } from "@catera/domain";
import {
  editGram,
  emptyPackage,
  formFromOffer,
  nutritionIssues,
  packageIssues,
  quickOffer,
  type PackageForm,
} from "../src/business/package";
import { PackageEditor } from "../src/business/PackageEditor";
import { PackageDetail } from "../src/business/PackageDetail";

jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() }, Link: () => null }));
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(), MediaTypeOptions: { Images: "Images" } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

const form: PackageForm = {
  ...emptyPackage,
  name: "Makan Siang Rumahan",
  description: "Masakan rumahan harian, nasi dengan dua lauk dan sayur.",
  price: "28000",
  capacity: "40",
  image: "https://cdn.example.test/k-1/a.jpg",
};

function runtimeWith(overrides: Partial<MobileRuntime["api"]>): MobileRuntime {
  const runtime = createMobileRuntime({ apiUrl: "https://catera.example.test", storagePrefix: "t" });
  runtime.api = {
    ...runtime.api,
    me: jest.fn(async () => ({ actor: { id: "u-1", role: "owner", catererId: "k-1" }, demo: false })),
    ...overrides,
  } as MobileRuntime["api"];
  return runtime;
}

const liveOffer = {
  id: "p-live",
  slug: "rumahan",
  version: 3,
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
  status: "published",
  nutrition: { caloriesKcal: { min: 580, max: 640 }, proteinG: 32, fatG: 0 },
  menus: [{ meal: "lunch", name: "x", description: "", image: "", contentModel: "slots", composition: [{ id: "g-main", categoryId: "main", name: "Lauk", slots: 2 }] }],
} as unknown as SellerOffer;

// The demo seed's Rantang Nusantara (packages/backend/src/seed.ts:254-352, Dapur Senja): its two menus give a range for
// every metric, as the 20260911163659 backfill does for every legacy two-menu package.
const rantang = {
  ...liveOffer,
  id: "p-rantang",
  name: "Rantang Nusantara",
  nutrition: {
    caloriesKcal: { min: 610, max: 640 },
    proteinG: { min: 29, max: 30 },
    carbsG: { min: 76, max: 82 },
    fatG: { min: 19, max: 21 },
  },
} as unknown as SellerOffer;

const mount = (runtime: MobileRuntime, ui: React.ReactElement) =>
  render(
    <MobileProvider runtime={runtime} linkMapper={() => "/"}>
      {ui}
    </MobileProvider>,
  );

describe("quickOffer macros", () => {
  it("quickOffer sends the entered macros and omits empty ones", () => {
    const offer = quickOffer({
      ...form,
      nutrition: { range: false, caloriesKcal: ["620", ""], proteinG: "32", carbsG: "", fatG: "0" },
    });
    // Zero is a value; the empty carbohydrate is left out, not sent as zero.
    expect(offer.nutrition).toEqual({ caloriesKcal: 620, proteinG: 32, fatG: 0 });
    // The dated menus never carry nutrition; the package does.
    for (const menu of offer.menus) expect(menu.nutrition).toBeNull();
    // Nothing filled sends no nutrition at all.
    expect(quickOffer(form).nutrition).toBeNull();
  });

  it("a range sends min and max", () => {
    const offer = quickOffer({
      ...form,
      nutrition: { range: true, caloriesKcal: ["580", "640"], proteinG: "32", carbsG: "78", fatG: "20" },
    });
    expect(offer.nutrition).toEqual({ caloriesKcal: { min: 580, max: 640 }, proteinG: 32, carbsG: 78, fatG: 20 });
    // With the switch off the second field is ignored, even if it still holds a number.
    expect(
      quickOffer({ ...form, nutrition: { range: false, caloriesKcal: ["580", "640"], proteinG: "", carbsG: "", fatG: "" } }).nutrition,
    ).toEqual({ caloriesKcal: 580 });
  });

  it("whole numbers only", () => {
    const n = { range: false, caloriesKcal: ["620,5", ""] as [string, string], proteinG: "3.2", carbsG: "", fatG: "-1" };
    expect(nutritionIssues(n)).toEqual({ caloriesKcal: "Angka bulat saja", proteinG: "Angka bulat saja", fatG: "Angka bulat saja" });
    expect(packageIssues({ ...form, nutrition: n }).nutrition).toBeTruthy();
    expect(nutritionIssues(emptyPackage.nutrition)).toEqual({});
  });

  it("a range with one end asks for the other", () => {
    const n = { ...emptyPackage.nutrition, range: true };
    // Only "dari": the message sits under "sampai".
    expect(nutritionIssues({ ...n, caloriesKcal: ["600", ""] })).toEqual({ caloriesMax: "Isi juga batas yang satunya" });
    // Only "sampai": the message sits under "dari".
    expect(nutritionIssues({ ...n, caloriesKcal: ["", "640"] })).toEqual({ caloriesKcal: "Isi juga batas yang satunya" });
    expect(packageIssues({ ...form, nutrition: { ...n, caloriesKcal: ["", "640"] } }).nutrition).toBe("Isi juga batas yang satunya");
    // Both ends, or neither, is fine.
    expect(nutritionIssues({ ...n, caloriesKcal: ["600", "640"] })).toEqual({});
    expect(nutritionIssues(n)).toEqual({});
  });
});

describe("Gizi per porsi in the editor", () => {
  it("min above max is refused with the message", async () => {
    const command = jest.fn();
    mount(runtimeWith({ command }), <PackageEditor from={liveOffer} />);
    expect(await screen.findByText("Gizi per porsi (opsional)")).toBeTruthy();
    expect(screen.getByText("Isi kalau kamu tahu. Pelanggan melihatnya sebagai perkiraan per porsi; kolom kosong tidak ditampilkan.")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Pakai rentang" }).props.accessibilityState.checked).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Kalori dari (kkal)"), "700");
    fireEvent.changeText(screen.getByLabelText("Kalori sampai (kkal)"), "600");
    fireEvent.press(screen.getByRole("button", { name: "Simpan paket" }));
    expect(await screen.findByText("Batas bawah tidak boleh lebih dari batas atas")).toBeTruthy();
    expect(command).not.toHaveBeenCalled();
    // The fields take a number keyboard.
    expect(screen.getByLabelText("Protein (g)").props.keyboardType).toBe("number-pad");
  });

  it("turning the range off keeps one calorie field with the lower value", async () => {
    const command = jest.fn(async () => ({ id: "p-new" }));
    mount(runtimeWith({ command }), <PackageEditor from={liveOffer} />);
    // The whole row is the switch: tapping its label turns the range off.
    await screen.findByRole("switch", { name: "Pakai rentang" });
    fireEvent.press(screen.getByText("Pakai rentang"));
    expect(screen.getByRole("switch", { name: "Pakai rentang" }).props.accessibilityState.checked).toBe(false);
    expect(screen.queryByLabelText("Kalori sampai (kkal)")).toBeNull();
    expect(screen.getByLabelText("Kalori (kkal)").props.value).toBe("580");
    fireEvent.press(screen.getByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    const [, payload] = command.mock.calls[0] as unknown as [string, { offer: { nutrition: unknown } }];
    expect(payload.offer.nutrition).toEqual({ caloriesKcal: 580, proteinG: 32, fatG: 0 });
  });

  it("Salin jadi paket baru carries the macros", async () => {
    expect(formFromOffer(liveOffer).nutrition).toEqual({ range: true, caloriesKcal: ["580", "640"], proteinG: "32", carbsG: "", fatG: "0" });
    const command = jest.fn(async () => ({ id: "p-new" }));
    mount(runtimeWith({ command }), <PackageEditor from={liveOffer} />);
    expect((await screen.findByLabelText("Kalori dari (kkal)")).props.value).toBe("580");
    expect(screen.getByLabelText("Kalori sampai (kkal)").props.value).toBe("640");
    expect(screen.getByLabelText("Lemak (g)").props.value).toBe("0");
    expect(screen.getByLabelText("Karbo (g)").props.value).toBe("");
    fireEvent.press(screen.getByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    const [, payload] = command.mock.calls[0] as unknown as [string, { offer: { nutrition: unknown } }];
    expect(payload.offer.nutrition).toEqual({ caloriesKcal: { min: 580, max: 640 }, proteinG: 32, fatG: 0 });
  });

  it("Salin jadi paket baru keeps Rantang Nusantara's ranges until one is edited", async () => {
    expect(formFromOffer(rantang).nutrition).toEqual({
      range: true,
      caloriesKcal: ["610", "640"],
      proteinG: "",
      carbsG: "",
      fatG: "",
      carried: { proteinG: { min: 29, max: 30 }, carbsG: { min: 76, max: 82 }, fatG: { min: 19, max: 21 } },
    });
    const seedRanges = {
      caloriesKcal: { min: 610, max: 640 },
      proteinG: { min: 29, max: 30 },
      carbsG: { min: 76, max: 82 },
      fatG: { min: 19, max: 21 },
    };

    // Copied and saved without edits: all four ranges go out as they came in.
    let command = jest.fn(async () => ({ id: "p-new" }));
    let view = mount(runtimeWith({ command }), <PackageEditor from={rantang} />);
    expect((await screen.findByLabelText("Protein (g)")).props.value).toBe("29–30");
    expect(screen.getByLabelText("Karbo (g)").props.value).toBe("76–82");
    expect(screen.getByLabelText("Lemak (g)").props.value).toBe("19–21");
    // The range is selected on focus, so the first keystroke replaces it.
    expect(screen.getByLabelText("Protein (g)").props.selectTextOnFocus).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    let [, payload] = command.mock.calls[0] as unknown as [string, { offer: { nutrition: unknown } }];
    expect(payload.offer.nutrition).toEqual(seedRanges);
    view.unmount();

    // Editing protein replaces its range with the one number typed; the untouched ranges still go out.
    command = jest.fn(async () => ({ id: "p-new" }));
    view = mount(runtimeWith({ command }), <PackageEditor from={rantang} />);
    fireEvent.changeText(await screen.findByLabelText("Protein (g)"), "31");
    expect(screen.getByLabelText("Protein (g)").props.value).toBe("31");
    fireEvent.press(screen.getByRole("button", { name: "Simpan paket" }));
    await waitFor(() => expect(command).toHaveBeenCalled());
    [, payload] = command.mock.calls[0] as unknown as [string, { offer: { nutrition: unknown } }];
    expect(payload.offer.nutrition).toEqual({ ...seedRanges, proteinG: 31 });
    view.unmount();
  });

  it("the first keystroke into a carried range starts a single number", () => {
    const n = formFromOffer(rantang).nutrition;
    // Typed after the shown "29–30" (the cursor at its end): only the new digits stay.
    expect(editGram(n, "proteinG", "29–303")).toMatchObject({ proteinG: "3", carried: { carbsG: { min: 76, max: 82 } } });
    expect(editGram(n, "proteinG", "29–303").carried?.proteinG).toBeUndefined();
    // The field selects "29–30" on focus, so the first digit replaces it.
    expect(editGram(n, "proteinG", "2").proteinG).toBe("2");
    // A backspace into the range clears the field.
    expect(editGram(n, "proteinG", "29–3").proteinG).toBe("");
    // A field without a carried range takes the text as typed.
    expect(editGram(editGram(n, "proteinG", "31"), "proteinG", "312").proteinG).toBe("312");
  });

  it("a keystroke typed inside a carried range keeps the new digit instead of clearing the field", () => {
    const n = { ...formFromOffer(rantang).nutrition, carried: { proteinG: { min: 29, max: 30 } } };
    // The cursor sat between the 2 and the 9: "2|9–30" plus a 5.
    expect(editGram(n, "proteinG", "259–30").proteinG).toBe("5");
    expect(editGram(n, "proteinG", "259–30").carried?.proteinG).toBeUndefined();
    // Inside the dash side too, and at the very start.
    expect(editGram(n, "proteinG", "29–530").proteinG).toBe("5");
    expect(editGram(n, "proteinG", "529–30").proteinG).toBe("5");
    // A deletion into the dash still clears, as before.
    expect(editGram(n, "proteinG", "29–3").proteinG).toBe("");
  });

  it("the calorie and gram fields line up at the top, so an error under one does not lift it", async () => {
    mount(runtimeWith({}), <PackageEditor from={liveOffer} />);
    await screen.findByText("Gizi per porsi (opsional)");
    for (const id of ["gizi-kalori", "gizi-gram"]) expect(StyleSheet.flatten(screen.getByTestId(id).props.style).alignItems).toBe("flex-start");
  });

  it("a new package starts with every gizi field empty and the range off", async () => {
    mount(runtimeWith({}), <PackageEditor />);
    expect((await screen.findByRole("switch", { name: "Pakai rentang" })).props.accessibilityState.checked).toBe(false);
    for (const label of ["Kalori (kkal)", "Protein (g)", "Karbo (g)", "Lemak (g)"]) expect(screen.getByLabelText(label).props.value).toBe("");
  });
});

describe("Dapur package view", () => {
  it("shows the macros the package carries, zero included", async () => {
    mount(runtimeWith({}), <PackageDetail offer={liveOffer} />);
    expect(await screen.findByText("Gizi per porsi: 580–640 kkal · 32 g protein · 0 g lemak")).toBeTruthy();
  });

  it("says nothing about gizi when the package has none", async () => {
    mount(runtimeWith({}), <PackageDetail offer={{ ...liveOffer, nutrition: null } as SellerOffer} />);
    expect(await screen.findByText("Makan Siang Rumahan")).toBeTruthy();
    expect(screen.queryByText(/Gizi per porsi/)).toBeNull();
  });
});

describe("the gram fields at a larger text size", () => {
  const { NutritionFields } = require("../src/business/NutritionFields") as typeof import("../src/business/NutritionFields");
  const ReactNative = require("react-native") as typeof import("react-native");

  function gramCells(fontScale: number) {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({ width: 360, height: 800, scale: 3, fontScale });
    const view = mount(runtimeWith({}), <NutritionFields value={formFromOffer(rantang).nutrition} onChange={() => undefined} errors={{}} />);
    const row = StyleSheet.flatten(screen.getByTestId("gizi-gram").props.style);
    const cells = ["Protein (g)", "Karbo (g)", "Lemak (g)"].map((label) => {
      let node = screen.getByLabelText(label).parent;
      while (node && StyleSheet.flatten(node.props.style)?.flexBasis === undefined) node = node.parent;
      return StyleSheet.flatten(node!.props.style);
    });
    view.unmount();
    return { row, cells };
  }
  afterEach(() => jest.restoreAllMocks());

  it("each basis grows with the text and the row wraps instead of squeezing a label onto two lines", () => {
    const normal = gramCells(1);
    expect(normal.cells.map((c) => c.flexBasis)).toEqual([92, 92, 92]);
    const large = gramCells(1.3);
    expect(large.row).toMatchObject({ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" });
    for (const cell of large.cells) expect(cell).toMatchObject({ flexGrow: 1, minWidth: 0 });
    expect(large.cells.map((c) => c.flexBasis)).toEqual([92 * 1.3, 92 * 1.3, 92 * 1.3]);
    // At 360dp less the sheet's 20dp padding, three 1.3x cells and two gaps do not fit one line, so the row wraps.
    const needed = large.cells.reduce((sum, c) => sum + (c.flexBasis as number), 0) + 2 * (large.row.gap as number);
    expect(needed).toBeGreaterThan(360 - 40);
  });
});

describe("the Gizi per porsi header", () => {
  it("is the label text variant, 12/23, like the editor's other section headers", () => {
    const { NutritionFields } = require("../src/business/NutritionFields") as typeof import("../src/business/NutritionFields");
    mount(runtimeWith({}), <NutritionFields value={formFromOffer(rantang).nutrition} onChange={() => undefined} errors={{}} />);
    const header = StyleSheet.flatten(screen.getByRole("header", { name: /Gizi per porsi/ }).props.style);
    expect([header.fontSize, header.lineHeight]).toEqual([12, 23]);
  });
});
