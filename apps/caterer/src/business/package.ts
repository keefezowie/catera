import {
  defaultDishCategories,
  nutritionSchema,
  packageNutrition,
  type NutrientValue,
  type Nutrition,
  type SellerOffer,
} from "@catera/domain";

/** What the one-screen package editor asks for; everything else takes a simple default. */
export type PackageForm = {
  name: string;
  description: string;
  price: string;
  meal: "lunch" | "dinner" | "both";
  weekdays: number[];
  capacity: string;
  image: string;
  /** Dishes per portion by category id, e.g. { rice: 1, main: 2, vegetable: 1 }. */
  counts: Record<string, number>;
  /** Optional caterer estimates per portion, as typed; calories may be a range, the others one number each. */
  nutrition: NutritionForm;
};

export type NutritionForm = {
  range: boolean;
  /** [from, to]; with `range` off only the first is used. */
  caloriesKcal: [string, string];
  proteinG: string;
  carbsG: string;
  fatG: string;
};

/** A gizi field that can carry a message; `caloriesMax` is the second calorie field of a range. */
export type NutritionField = "caloriesKcal" | "caloriesMax" | "proteinG" | "carbsG" | "fatG";

export const emptyPackage: PackageForm = {
  name: "",
  description: "",
  price: "",
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  capacity: "",
  image: "",
  counts: { rice: 1, main: 2, vegetable: 1 },
  nutrition: { range: false, caloriesKcal: ["", ""], proteinG: "", carbsG: "", fatG: "" },
};

const digits = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

/** The typed gizi fields in order, the second calorie field only while the range is on. */
function nutritionEntries(n: NutritionForm): [NutritionField, string][] {
  const fields: [NutritionField, string][] = [["caloriesKcal", n.caloriesKcal[0]]];
  if (n.range) fields.push(["caloriesMax", n.caloriesKcal[1]]);
  fields.push(["proteinG", n.proteinG], ["carbsG", n.carbsG], ["fatG", n.fatG]);
  return fields;
}

/**
 * The domain shape (`nutritionSchema`) from the typed fields: an empty field is left out (zero is a value), a range is
 * `{ min, max }` for calories only, and nothing filled is `null`. Call it on fields `nutritionIssues` accepts.
 */
export function nutritionFromForm(n: NutritionForm): Nutrition | null {
  const value = (v: string) => (v.trim() ? digits(v) : null);
  const result: Nutrition = {};
  const from = value(n.caloriesKcal[0]);
  const to = n.range ? value(n.caloriesKcal[1]) : null;
  if (from !== null && to !== null) result.caloriesKcal = { min: from, max: to };
  else if (from !== null) result.caloriesKcal = from;
  for (const key of ["proteinG", "carbsG", "fatG"] as const) {
    const v = value(n[key]);
    if (v !== null) result[key] = v;
  }
  return Object.keys(result).length ? result : null;
}

/** Field → message for the gizi fields; empty when they can be saved (all empty is fine: the section is optional). */
export function nutritionIssues(n: NutritionForm): Partial<Record<NutritionField, string>> {
  const issues: Partial<Record<NutritionField, string>> = {};
  for (const [field, v] of nutritionEntries(n)) if (v.trim() && digits(v) === null) issues[field] = "Angka bulat saja";
  if (Object.keys(issues).length) return issues;
  // A range needs both ends; one end alone is not a range a customer can read.
  const [from, to] = n.caloriesKcal.map((v) => !!v.trim());
  if (n.range && from !== to) {
    issues[from ? "caloriesMax" : "caloriesKcal"] = "Isi juga batas yang satunya";
    return issues;
  }
  // The shared schema owns the range rule (min not above max).
  if (!nutritionSchema.safeParse(nutritionFromForm(n) ?? {}).success)
    issues.caloriesMax = "Batas bawah tidak boleh lebih dari batas atas";
  return issues;
}

/** Field → message, Indonesian first; empty when the package can be saved. */
export function packageIssues(f: PackageForm): Partial<Record<keyof PackageForm, string>> {
  const issues: Partial<Record<keyof PackageForm, string>> = {};
  if (f.name.trim().length < 3) issues.name = "Nama paket minimal 3 huruf";
  if (f.description.trim().length < 10) issues.description = "Ceritakan paketnya, minimal 10 huruf";
  const price = digits(f.price);
  if (price === null || price < 1000) issues.price = "Isi harga per porsi";
  if (!f.weekdays.length) issues.weekdays = "Pilih hari antar";
  const capacity = digits(f.capacity);
  if (capacity === null || capacity < 1) issues.capacity = "Isi kapasitas per hari";
  if (!f.image.trim()) issues.image = "Tambahkan foto paket";
  if (!Object.values(f.counts).some((n) => n > 0)) issues.counts = "Isi minimal satu hidangan per porsi";
  // The gizi messages sit under their own fields; this entry only stops the save.
  const gizi = Object.values(nutritionIssues(f.nutrition));
  if (gizi.length) issues.nutrition = gizi[0];
  return issues;
}

/** The existing offer shape with the simple defaults: one duration, no tiers, no trial, flexible. */
export function quickOffer(f: PackageForm) {
  const capacity = digits(f.capacity) ?? 0;
  const meals = f.meal === "both" ? (["lunch", "dinner"] as const) : ([f.meal] as const);
  const composition = defaultDishCategories
    .filter((c) => (f.counts[c.id] ?? 0) > 0)
    .map((c) => ({ id: `g-${c.id}`, categoryId: c.id, name: c.name, slots: f.counts[c.id] }));
  return {
    name: f.name.trim(),
    description: f.description.trim(),
    price: digits(f.price),
    days: Math.max(1, f.weekdays.length),
    meal: f.meal,
    weekdays: [...f.weekdays].sort(),
    flexible: true,
    trialPrice: null,
    trialMax: null,
    capacity: Object.fromEntries(f.weekdays.map((d) => [String(d), capacity])),
    tiers: [] as never[],
    durationPricing: { revision: 0, options: [{ cycles: 1, discountPercent: 0 }] },
    windows: { lunch: "11.00–13.00", dinner: "17.00–19.00" },
    tags: [] as string[],
    image: f.image.trim(),
    nutrition: nutritionFromForm(f.nutrition),
    packageType: "nasi_box" as const,
    menuSelectionMode: "caterer" as const,
    menus: meals.map((meal) => ({
      contentModel: "slots" as const,
      name: f.name.trim(),
      description: "",
      image: "",
      meal,
      composition,
      items: [],
      nutrition: null,
    })),
    status: "published" as const,
  };
}

/** Load an existing package into the form. */
export function formFromOffer(o: SellerOffer): PackageForm {
  const groups = o.menus[0]?.composition ?? [];
  return {
    name: o.name,
    description: o.description,
    price: o.price === null ? "" : String(o.price),
    meal: o.meal as PackageForm["meal"],
    weekdays: o.weekdays,
    capacity: o.weekdays.length ? String(o.capacity[String(o.weekdays[0])] ?? "") : "",
    image: o.image,
    counts: Object.fromEntries(groups.filter((g) => g.categoryId).map((g) => [g.categoryId!, g.slots])),
    nutrition: nutritionFormFrom(packageNutrition(o)),
  };
}

/**
 * The gizi fields for a package's saved estimates. Calories keep their range; the form holds one number for the
 * others, so a protein, carbohydrate or fat range (only the web editor makes one) is left empty for the caterer to fill
 * rather than narrowed to a number they never entered.
 */
function nutritionFormFrom(n: Nutrition | null): NutritionForm {
  const one = (v: NutrientValue | undefined) => (typeof v === "number" ? String(v) : "");
  const kcal = n?.caloriesKcal;
  const range = typeof kcal === "object" && kcal !== null;
  return {
    range,
    caloriesKcal: typeof kcal === "object" && kcal !== null ? [String(kcal.min), String(kcal.max)] : [one(kcal), ""],
    proteinG: one(n?.proteinG),
    carbsG: one(n?.carbsG),
    fatG: one(n?.fatG),
  };
}
