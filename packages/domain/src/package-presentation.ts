import {
  menuItems,
  menuSummary,
  type MealMenu,
  type Nutrition,
  type PackageType,
} from "./contents";

/** Read-only discovery copy; never infer structure for legacy menus. */
export function compositionPreview(
  menu: MealMenu,
  type?: PackageType | null,
  locale = "id",
) {
  if ((type === "nasi_box" || menu.contentModel === "slots") && menu.composition?.length)
    return menu.composition.map((g) => `${g.slots} ${g.name}`).join(" · ");
  if (type === "ala_carte" && menu.items) {
    const count = menuItems(menu).length;
    return locale === "id"
      ? `${count} hidangan`
      : `${count} ${count === 1 ? "dish" : "dishes"}`;
  }
  return menuSummary(menu);
}

export function nutritionMetrics(
  n: Nutrition | null | undefined,
  locale = "id",
) {
  const keys = ["caloriesKcal", "proteinG", "carbsG", "fatG"] as const;
  if (!keys.some((key) => n?.[key] != null)) return [];
  const labels =
    locale === "id"
      ? ["Energi", "Protein", "Karbo", "Lemak"]
      : ["Energy", "Protein", "Carbs", "Fat"];
  return keys.map((key, index) => ({
    key,
    label: labels[index],
    value:
      n?.[key] == null
        ? "—"
        : `${n[key]} ${index === 0 ? (locale === "id" ? "kkal" : "kcal") : "g"}`,
    available: n?.[key] != null,
  }));
}

export function menuSourceLabel(menu: MealMenu, locale = "id") {
  if (menu.contentModel === "slots" && !menu.items?.length) return locale === "id" ? "Menu belum ditentukan" : "Menu not yet set";
  return menu.source === "dated"
    ? locale === "id"
      ? "Menu tanggal ini"
      : "Menu for this date"
    : locale === "id"
      ? "Menu contoh"
      : "Example menu";
}
