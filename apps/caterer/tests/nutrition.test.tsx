import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMobileRuntime, MobileProvider, type MobileRuntime } from "@catera/mobile-core";
import type { SellerOffer } from "@catera/domain";
import { emptyPackage, formFromOffer, nutritionIssues, packageIssues, quickOffer, type PackageForm } from "../src/business/package";
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
    fireEvent(await screen.findByRole("switch", { name: "Pakai rentang" }), "valueChange", false);
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
