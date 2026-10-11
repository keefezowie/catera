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

/** The gram metrics, which the form holds as one number each. */
export type GramKey = "proteinG" | "carbsG" | "fatG";

export type NutritionForm = {
  range: boolean;
  /** [from, to]; with `range` off only the first is used. */
  caloriesKcal: [string, string];
  proteinG: string;
  carbsG: string;
  fatG: string;
  /**
   * A gram range copied from the source package ("Salin jadi paket baru") and not edited since. It is saved as it came
   * in; its field shows it as "29–30", and the first edit replaces it with one number (`editGram`).
   */
  carried?: Partial<Record<GramKey, { min: number; max: number }>>;
};

const gramKeys = ["proteinG", "carbsG", "fatG"] as const;

/** "29–30": how a carried range reads in its field. */
export const carriedText = (r: { min: number; max: number }) => `${r.min}–${r.max}`;

/**
 * The form after the caterer types into a gram field. A carried range is not editable as a range: the first edit drops
 * it. The field selects its text on focus, so a keystroke usually replaces "29–30" and is kept as typed; digits typed
 * after the shown range keep only the new digits; any other edit that leaves the range's dash (a backspace into it)
 * clears the field.
 */
export function editGram(n: NutritionForm, key: GramKey, typed: string): NutritionForm {
  const range = n.carried?.[key];
  if (!range) return { ...n, [key]: typed };
  const { [key]: _dropped, ...carried } = n.carried!;
  const shown = carriedText(range);
  const next = typed.startsWith(shown) ? typed.slice(shown.length) : typed.includes("–") ? "" : typed;
  return { ...n, [key]: next, carried };
}

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
  // A carried range was valid where it came from and is not typed text.
  for (const key of gramKeys) if (!n.carried?.[key]) fields.push([key, n[key]]);
  return fields;
}

/**
 * The domain shape (`nutritionSchema`) from the typed fields: an empty field is left out (zero is a value), a typed range
 * is `{ min, max }` for calories only, a carried gram range goes out unchanged, and nothing filled is `null`. Call it on
 * fields `nutritionIssues` accepts.
 */
export function nutritionFromForm(n: NutritionForm): Nutrition | null {
  const value = (v: string) => (v.trim() ? digits(v) : null);
  const result: Nutrition = {};
  const from = value(n.caloriesKcal[0]);
  const to = n.range ? value(n.caloriesKcal[1]) : null;
  if (from !== null && to !== null) result.caloriesKcal = { min: from, max: to };
  else if (from !== null) result.caloriesKcal = from;
  for (const key of gramKeys) {
    const carried = n.carried?.[key];
    const v = value(n[key]);
    if (carried) result[key] = { min: carried.min, max: carried.max };
    else if (v !== null) result[key] = v;
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
 * The gizi fields for a package's saved estimates. Calories keep their range through the switch. The form holds one
 * number for protein, carbohydrate and fat, yet saved packages do have ranges there: the 20260911163659 backfill gives
 * every legacy two-menu package one (the demo seed's Rantang Nusantara reads 29–30 g protein, 76–82 g carbohydrate and
 * 19–21 g fat). Such a range is carried untouched, so a copy saved without edits keeps it, and it is never narrowed to
 * a number the caterer did not type.
 */
function nutritionFormFrom(n: Nutrition | null): NutritionForm {
  const one = (v: NutrientValue | undefined) => (typeof v === "number" ? String(v) : "");
  const kcal = n?.caloriesKcal;
  const range = typeof kcal === "object" && kcal !== null;
  const carried: NonNullable<NutritionForm["carried"]> = {};
  for (const key of gramKeys) {
    const v = n?.[key];
    if (typeof v === "object" && v !== null) carried[key] = { min: v.min, max: v.max };
  }
  return {
    range,
    caloriesKcal: typeof kcal === "object" && kcal !== null ? [String(kcal.min), String(kcal.max)] : [one(kcal), ""],
    proteinG: one(n?.proteinG),
    carbsG: one(n?.carbsG),
    fatG: one(n?.fatG),
    ...(Object.keys(carried).length ? { carried } : {}),
  };
}

/**
 * Whether saving a package now is the caterer's first publish (the success beat with confetti, spec 6.2): true when no
 * package of theirs was ever published (only drafts, or none). A suspended or retired package was published once.
 * Null while the package read has not answered: a first that cannot be told is a later publish (a toast).
 */
export function isFirstPublish(offers: readonly SellerOffer[] | null | undefined): boolean | null {
  if (!offers) return null;
  return offers.every((o) => o.status === "draft");
}
