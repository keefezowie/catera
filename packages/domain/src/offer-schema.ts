import { z } from "zod";
import { durationOptionsSchema } from "./purchase-pricing";
import { menuSchema, nutritionSchema, contentsIssues } from "./contents";

export const mealTypes = ["lunch", "dinner", "both"] as const;
export type MealType = (typeof mealTypes)[number];
export const offerSchema = z
  .object({
    durationPricing: z
      .object({
        revision: z.number().int().nonnegative(),
        options: durationOptionsSchema,
      })
      .optional(),
    name: z.string().trim().max(100),
    description: z.string().trim().max(1500),
    price: z.number().int().min(1000).max(10000000).nullable(),
    days: z.number().int().min(1).max(60),
    meal: z.enum(mealTypes),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    flexible: z.boolean(),
    trialPrice: z.number().int().min(1000).nullable(),
    trialMax: z.number().int().min(1).nullable(),
    capacity: z.record(z.string(), z.number().int().min(0)),
    tiers: z.array(
      z.object({
        min: z.number().int().min(1),
        percent: z.number().min(0).max(90),
      }),
    ),
    windows: z.object({ lunch: z.string().min(3), dinner: z.string().min(3) }),
    tags: z.array(z.string().max(40)),
    image: z.string().max(500),
    packageType: z.enum(["ala_carte", "nasi_box"]).nullable().optional(),
    menuSelectionMode: z.enum(["caterer", "customer"]).optional(),
    menus: z.array(menuSchema).max(2),
    nutrition: nutritionSchema.nullable().optional(),
    status: z.enum(["draft", "published", "suspended", "retired"]),
  })
  .superRefine((o, ctx) => {
    const complete = o.status !== "draft";
    if (complete && o.price === null)
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Isi harga per porsi / Enter the price per portion",
      });
    for (const [key, min] of [
      ["name", 3],
      ["description", 10],
    ] as const)
      if ((complete || o[key].length > 0) && o[key].length < min)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Minimal ${min} karakter / At least ${min} characters`,
        });
    if (complete && !o.weekdays.length)
      ctx.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Pilih hari pengantaran / Choose operating days",
      });
    if (complete && !o.image.trim())
      ctx.addIssue({
        code: "custom",
        path: ["image"],
        message: "Unggah foto paket / Upload a package photo",
      });
    const capacityUnset = !complete && Object.keys(o.capacity).length === 0;
    for (const d of capacityUnset ? [] : o.weekdays)
      if (o.capacity[String(d)] === undefined)
        ctx.addIssue({
          code: "custom",
          path: ["capacity"],
          message: "Isi kapasitas / Enter capacity",
        });
    const activeCapacity = o.weekdays.map((d) => o.capacity[String(d)]);
    if (
      activeCapacity.every(
        (capacity): capacity is number => capacity !== undefined,
      ) &&
      new Set(activeCapacity).size > 1
    )
      ctx.addIssue({
        code: "custom",
        path: ["capacity"],
        message:
          "Kapasitas harus sama untuk semua hari operasional / Capacity must be the same for every operating day",
      });
    for (const message of contentsIssues(o, o.status !== "draft"))
      ctx.addIssue({ code: "custom", path: ["menus"], message });
  });
