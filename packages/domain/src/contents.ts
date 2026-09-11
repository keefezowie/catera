import { z } from "zod";

export const packageTypes = ["ala_carte", "nasi_box"] as const;
export type PackageType = (typeof packageTypes)[number];
const text = (max: number) => z.string().trim().max(max);
export const nutritionSchema = z
  .object({
    caloriesKcal: z.number().finite().nonnegative().optional(),
    proteinG: z.number().finite().nonnegative().optional(),
    carbsG: z.number().finite().nonnegative().optional(),
    fatG: z.number().finite().nonnegative().optional(),
  })
  .strict();
export type Nutrition = z.infer<typeof nutritionSchema>;
export const dishSchema = z.object({
  id: text(80).min(1),
  name: text(120),
  description: text(600).default(""),
  image: text(500).default(""),
  serving: text(100).default(""),
  groupId: text(80).optional(),
  sourceDishId: z.uuid().optional(),
  sourceDishVersion: z.number().int().positive().optional(),
  sourceServing: text(100).optional(),
});
export const libraryDishDetailsSchema = dishSchema
  .pick({ name: true, description: true, image: true, serving: true })
  .extend({ name: text(120).min(1) });
export const dishSaveSchema = z
  .object({
    catererId: z.uuid(),
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    details: libraryDishDetailsSchema,
  })
  .refine((v) => !v.id || !!v.version, {
    message: "Version required",
    path: ["version"],
  });
export const dishArchiveSchema = z.object({
  catererId: z.uuid(),
  id: z.uuid(),
  version: z.number().int().positive(),
  archived: z.boolean(),
});
export type LibraryDish = z.infer<typeof libraryDishDetailsSchema> & {
  id: string;
  catererId: string;
  version: number;
  archived: boolean;
};
export function selectLibraryDish(
  slot: Dish,
  dish: LibraryDish,
  refresh = false,
  resetServing = false,
): Dish {
  return {
    ...slot,
    name: dish.name,
    description: dish.description,
    image: dish.image,
    serving:
      refresh && !resetServing && slot.serving !== slot.sourceServing
        ? slot.serving
        : dish.serving,
    sourceDishId: dish.id,
    sourceDishVersion: dish.version,
    sourceServing: dish.serving,
  };
}
export const componentSchema = z.object({
  id: text(80).min(1),
  name: text(60).min(1),
  slots: z.number().int().min(1).max(30),
});
export const menuSchema = z.object({
  name: text(1500),
  description: text(1500),
  image: text(500),
  meal: z.enum(["lunch", "dinner"]),
  items: z.array(dishSchema).max(60).optional(),
  composition: z.array(componentSchema).max(20).optional(),
  nutrition: nutritionSchema.nullable().optional(),
  source: z.enum(["initial", "dated"]).optional(),
});
export type Dish = z.infer<typeof dishSchema>;
export type ComponentGroup = z.infer<typeof componentSchema>;
export type MealMenu = Omit<z.infer<typeof menuSchema>, "meal"> & {
  meal: string;
};
export type ContentRevision = {
  packageId: string;
  revision: number;
  name: string;
  contents: { packageType?: PackageType; meal: string; menus: MealMenu[] };
};
export type DatedMenu = {
  package_id: string;
  content_revision: number;
  service_date: string;
  meal: string;
  version: number;
  details: MealMenu;
};
export const menuSaveSchema = z.object({
  catererId: z.uuid(),
  packageId: z.uuid(),
  date: z.iso.date(),
  meal: z.enum(["lunch", "dinner"]),
  contentRevision: z.number().int().nonnegative().default(0),
  version: z.number().int().nonnegative().default(0),
  details: menuSchema.omit({ meal: true, source: true }),
});
export function contentsIssues(
  o: { packageType?: PackageType | null; meal: string; menus: MealMenu[] },
  complete: boolean,
): string[] {
  if (!o.packageType) return [];
  const issues: string[] = [];
  const meals = o.meal === "both" ? ["lunch", "dinner"] : [o.meal];
  if (
    o.menus.some((m) => !meals.includes(m.meal)) ||
    new Set(o.menus.map((m) => m.meal)).size !== o.menus.length
  )
    issues.push("Waktu makan tidak sesuai / Invalid meal");
  if (complete && meals.some((meal) => !o.menus.some((m) => m.meal === meal)))
    issues.push("Lengkapi setiap waktu makan / Complete each meal");
  for (const m of o.menus) {
    const items = m.items ?? [],
      groups = m.composition ?? [];
    if (
      new Set(items.map((i) => i.id)).size !== items.length ||
      new Set(groups.map((g) => g.id)).size !== groups.length
    )
      issues.push("ID isi paket harus unik / Contents IDs must be unique");
    if (complete && (!items.length || items.some((i) => !i.name.trim())))
      issues.push("Lengkapi nama setiap hidangan / Name every dish");
    if (o.packageType === "nasi_box") {
      if (complete && !groups.length)
        issues.push("Tambahkan komponen nasi box / Add box components");
      if (items.some((i) => !groups.some((g) => g.id === i.groupId)))
        issues.push(
          "Pilih komponen hidangan / Assign each dish to a component",
        );
      if (
        complete &&
        groups.some(
          (g) => items.filter((i) => i.groupId === g.id).length !== g.slots,
        )
      )
        issues.push(
          "Jumlah hidangan harus sesuai komposisi / Dish slots must match composition",
        );
    } else if (groups.length || items.some((i) => i.groupId))
      issues.push(
        "Ala carte menggunakan daftar hidangan / Ala carte uses dish rows",
      );
  }
  return issues;
}
/** Read adapter only: never rewrite a legacy purchase or guess its format. */
export function menuItems(m: MealMenu): Dish[] {
  return (
    m.items ?? [
      {
        id: `legacy-${m.meal}`,
        name: m.name,
        description: m.description,
        image: m.image,
        serving: "",
      },
    ]
  );
}
export function menuSummary(m: MealMenu): string {
  return menuItems(m)
    .map((i) => {
      const group = m.composition?.find((g) => g.id === i.groupId)?.name;
      return `${group ? group + ": " : ""}${i.name}${i.serving ? " (" + i.serving + ")" : ""}`;
    })
    .join(", ");
}
export function packageTypeLabel(type?: PackageType | null, locale = "id") {
  return type === "ala_carte"
    ? "À la carte"
    : type === "nasi_box"
      ? "Nasi box"
      : locale === "id"
        ? "Paket katering"
        : "Catering package";
}
export function nutritionSummary(
  n: Nutrition | null | undefined,
  locale = "id",
) {
  const labels =
    locale === "id"
      ? ["kkal", "g protein", "g karbohidrat", "g lemak"]
      : ["kcal", "g protein", "g carbs", "g fat"];
  return (["caloriesKcal", "proteinG", "carbsG", "fatG"] as const)
    .flatMap((key, i) => (n?.[key] == null ? [] : [`${n[key]} ${labels[i]}`]))
    .join(" · ");
}
