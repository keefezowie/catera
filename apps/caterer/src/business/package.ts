import { defaultDishCategories, type SellerOffer } from "@catera/domain";

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
};

export const emptyPackage: PackageForm = {
  name: "",
  description: "",
  price: "",
  meal: "lunch",
  weekdays: [1, 2, 3, 4, 5],
  capacity: "",
  image: "",
  counts: { rice: 1, main: 2, vegetable: 1 },
};

const digits = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : null);

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
    nutrition: null,
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
  };
}
