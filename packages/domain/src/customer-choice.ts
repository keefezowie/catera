import { z } from "zod";
import type { LibraryDish, MenuMonth } from "./contents";
export type PackageDish = LibraryDish & {
  packageId: string;
  sourceDishId: string;
};
export type CustomerMenuMonth = Omit<MenuMonth, "dates"> & {
  options: PackageDish[];
  dates: (MenuMonth["dates"][number] & {
    dayId: string;
    deliveryVersion: number;
    cutoffAt: string;
    selectionStatus: "pending" | "selected" | "caterer_choice";
  })[];
};
export type CustomerMenuPresentationState =
  | "available_after_payment"
  | "selection_due"
  | "saved"
  | "caterer_choice"
  | "not_announced";
export type CustomerMenuPresentation = {
  state: CustomerMenuPresentationState;
  example: boolean;
};
export function customerMenuPresentation(
  input:
    | { surface: "package"; activeOptionCount: number }
    | {
        surface: "delivery";
        hasSavedMenu: boolean;
        editable: boolean;
        selectionStatus: "pending" | "selected" | "caterer_choice";
        activeOptionCount: number;
      },
): CustomerMenuPresentation {
  if (input.surface === "package")
    return input.activeOptionCount > 0
      ? { state: "available_after_payment", example: true }
      : { state: "not_announced", example: false };
  if (input.hasSavedMenu || input.selectionStatus === "selected")
    return { state: "saved", example: false };
  if (!input.editable || input.selectionStatus === "caterer_choice")
    return { state: "caterer_choice", example: false };
  if (input.activeOptionCount === 0)
    return { state: "not_announced", example: false };
  return { state: "selection_due", example: false };
}
export const packageOptionSchema = z
  .object({
    packageId: z.uuid(),
    id: z.uuid().optional(),
    version: z.number().int().positive().optional(),
    sourceDishId: z.uuid().optional(),
    refresh: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => (v.id ? !!v.version : !!v.sourceDishId));
const days = z
  .array(
    z
      .object({
        id: z.uuid(),
        date: z.iso.date(),
        deliveryVersion: z.number().int().positive(),
        version: z.number().int().nonnegative(),
      })
      .strict(),
  )
  .min(1)
  .max(31)
  .refine((v) => new Set(v.map((d) => d.id)).size === v.length);
export const customerMenuResetSchema = z
  .object({ subscriptionId: z.uuid(), meal: z.enum(["lunch", "dinner"]), days })
  .strict();
export const customerMenuSaveSchema = customerMenuResetSchema.extend({
  choices: z
    .array(
      z
        .object({
          slotId: z.string().min(1).max(100),
          optionId: z.uuid(),
          optionVersion: z.number().int().positive(),
        })
        .strict(),
    )
    .min(1)
    .max(60),
});
