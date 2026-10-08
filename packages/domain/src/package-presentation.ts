import {
  menuItems,
  menuSummary,
  nutrientBounds,
  componentLabel,
  type MealMenu,
  type Nutrition,
  type PackageType,
} from "./contents";
import type { Locale, Offer } from "./index";

/** Read-only discovery copy; never infer structure for legacy menus. */
export function compositionPreview(
  menu: MealMenu,
  type?: PackageType | null,
  locale: "id" | "en" = "id",
) {
  if (
    (type === "nasi_box" || menu.contentModel === "slots") &&
    menu.composition?.length
  )
    return menu.composition
      .map((g) => {
        return `${g.slots} ${componentLabel(g, locale)}`;
      })
      .join(" · ");
  if (type === "ala_carte" && menu.items) {
    const count = menuItems(menu).length;
    return locale === "id"
      ? `${count} hidangan`
      : `${count} ${count === 1 ? "dish" : "dishes"}`;
  }
  return menuSummary(menu, locale);
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
        : (() => {
            const bounds = nutrientBounds(n[key])!;
            const amount =
              bounds.min === bounds.max
                ? String(bounds.min)
                : `${bounds.min}–${bounds.max}`;
            return `${amount} ${index === 0 ? (locale === "id" ? "kkal" : "kcal") : "g"}`;
          })(),
    available: n?.[key] != null,
  }));
}

export function menuSourceLabel(menu: MealMenu, locale = "id") {
  if (menu.selectionStatus === "selected")
    return locale === "id" ? "Pilihan pelanggan" : "Customer selection";
  if (menu.selectionStatus === "pending")
    return locale === "id" ? "Pilih menu sendiri" : "Choose your menu";
  if (menu.selectionStatus === "caterer_choice")
    return locale === "id" ? "Katerer memilih" : "Caterer chooses";
  if (menu.contentModel === "slots" && !menu.items?.length)
    return locale === "id" ? "Menu belum ditentukan" : "Menu not yet set";
  return menu.source === "dated"
    ? locale === "id"
      ? "Menu tanggal ini"
      : "Menu for this date"
    : locale === "id"
      ? "Menu contoh"
      : "Example menu";
}

/**
 * The unit that goes with a per-meal price (`perMealPrice`). A combined offer adds a note that one
 * day brings two meals, so its per-meal price is never read as the price of the whole day.
 */
export function priceUnitLabel(
  offer: Pick<Offer, "meal">,
  locale: Locale = "id",
): { unit: string; note: string | null } {
  const id = locale === "id";
  return {
    unit: id ? "/ sekali makan" : "/ meal",
    note: offer.meal === "both" ? (id ? "2 kali makan / hari" : "2 meals / day") : null,
  };
}
