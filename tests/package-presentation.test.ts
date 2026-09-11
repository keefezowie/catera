import { describe, expect, it } from "vitest";
import {
  compositionPreview,
  nutritionMetrics,
  menuSourceLabel,
  type MealMenu,
} from "../packages/domain/src/index";
const menu: MealMenu = {
  name: "Legacy, unsplit meal",
  description: "",
  image: "",
  meal: "lunch",
};
describe("discovery presentation preserves menu truth", () => {
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
      nutritionMetrics({
        caloriesKcal: 650,
        proteinG: 45,
        carbsG: 72,
        fatG: 18,
      }).every((m) => m.available),
    ).toBe(true);
  });
  it("never fills dated or dinner estimates from another menu", () => {
    const lunch = { ...menu, nutrition: { proteinG: 45 } };
    const dinner: MealMenu = {
      ...menu,
      meal: "dinner",
      source: "dated",
      nutrition: null,
    };
    expect(nutritionMetrics(lunch.nutrition)).toHaveLength(4);
    expect(nutritionMetrics(dinner.nutrition)).toEqual([]);
    expect(menuSourceLabel(dinner, "en")).toBe("Menu for this date");
  });
});
