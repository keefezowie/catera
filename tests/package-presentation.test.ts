import { describe, expect, it } from "vitest";
import {
  compositionPreview,
  nutritionMetrics,
  packageNutrition,
  menuSourceLabel,
  menuSummary,
  statusLabel,
  errorLabel,
  packageTypeLabel,
  localizedMessage,
  type MealMenu,
} from "../packages/domain/src/index";
const menu: MealMenu = {
  name: "Legacy, unsplit meal",
  description: "",
  image: "",
  meal: "lunch",
};
describe("discovery presentation preserves menu truth", () => {
  it("provides localized shared status, error, and menu labels", () => {
    expect(statusLabel("out_for_delivery", "en")).toBe("Out for delivery");
    expect(statusLabel("payment_exception", "en")).toBe("Payment under review");
    expect(errorLabel("INVALID_DATE", "en")).toBe(
      "The date is not an operating day for this package.",
    );
    expect(packageTypeLabel("nasi_box", "en")).toBe("Rice box");
    expect(localizedMessage("Isi kapasitas / Enter capacity", "en")).toBe(
      "Enter capacity",
    );
    expect(menuSummary({ ...menu, contentModel: "slots" }, "en")).toBe(
      "Menu not yet set",
    );
  });

  it("keeps legacy text unsplit and distinguishes structured dish counts from box slots", () => {
    expect(compositionPreview(menu)).toBe(menu.name);
    const items = [
      { id: "a", name: "Ayam", image: "", serving: "150 g", description: "" },
      {
        id: "b",
        name: "Tempe",
        image: "",
        serving: "2 potong",
        description: "",
      },
    ];
    expect(compositionPreview({ ...menu, items }, "ala_carte")).toBe(
      "2 hidangan",
    );
    expect(
      compositionPreview(
        { ...menu, items: items.slice(0, 1) },
        "ala_carte",
        "en",
      ),
    ).toBe("1 dish");
    expect(
      compositionPreview(
        {
          ...menu,
          items,
          composition: [{ id: "custom", name: "Pelengkap spesial", slots: 2 }],
        },
        "nasi_box",
      ),
    ).toBe("2 Pelengkap spesial");
    expect(
      compositionPreview(
        {
          ...menu,
          composition: [
            { id: "main", categoryId: "main", name: "Lauk", slots: 1 },
          ],
          contentModel: "slots",
        },
        "nasi_box",
        "en",
      ),
    ).toBe("1 Main dish");
  });
  it("omits absent nutrition, preserves zero, and retains missing metric positions", () => {
    expect(nutritionMetrics(null)).toEqual([]);
    expect(nutritionMetrics({})).toEqual([]);
    expect(
      nutritionMetrics({ carbsG: 0, proteinG: 45 }).map((m) => m.value),
    ).toEqual(["—", "45 g", "0 g", "—"]);
    expect(nutritionMetrics({ caloriesKcal: 650 }, "en")[0].value).toBe(
      "650 kcal",
    );
    expect(
      nutritionMetrics({ caloriesKcal: { min: 550, max: 700 } }, "en")[0].value,
    ).toBe("550–700 kcal");
    expect(
      nutritionMetrics({
        caloriesKcal: 650,
        proteinG: 45,
        carbsG: 72,
        fatG: 18,
      }).every((m) => m.available),
    ).toBe(true);
  });
  it("prefers package nutrition and aggregates legacy menu values as a range", () => {
    const lunch = { ...menu, nutrition: { proteinG: 45 } };
    const dinner: MealMenu = {
      ...menu,
      meal: "dinner",
      source: "dated",
      nutrition: null,
    };
    expect(nutritionMetrics(lunch.nutrition)).toHaveLength(4);
    expect(nutritionMetrics(dinner.nutrition)).toEqual([]);
    expect(
      packageNutrition({ nutrition: { proteinG: 50 }, menus: [lunch, dinner] }),
    ).toEqual({ proteinG: 50 });
    expect(
      packageNutrition({
        menus: [lunch, { ...dinner, nutrition: { proteinG: 35 } }],
      }),
    ).toEqual({ proteinG: { min: 35, max: 45 } });
    expect(menuSourceLabel(dinner, "en")).toBe("Menu for this date");
  });
});
