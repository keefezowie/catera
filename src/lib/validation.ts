import { z } from "zod";
const id = z.uuid(),
  text = z.string().trim().min(1).max(500),
  date = z.iso.date();
const address = z.object({
  line: z.string().trim().min(5).max(500),
  city: z.string().trim().min(2).max(100),
  instructions: z.string().max(1000).optional(),
});
const edit = {
  id: id.optional(),
  version: z.coerce.number().int().positive().optional(),
};
export const commandSchemas: Record<string, z.ZodType> = {
  save_customer: z.object({
    ...edit,
    name: text,
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().max(50),
    address,
  }),
  profile: z.object({
    phone: z.string().max(50),
    address,
    version: z.number().int().positive(),
  }),
  save_package: z.object({
    ...edit,
    name: text,
    deliveries: z.coerce.number().int().positive(),
    validity_days: z.union([
      z.coerce.number().int().positive(),
      z.null(),
      z.literal(""),
    ]),
    active: z.boolean().optional(),
  }),
  purchase: z.object({
    customer_id: id,
    package_id: id,
    starts_on: date,
    external_reference: z.string().max(200).optional(),
  }),
  save_menu: z.object({
    ...edit,
    name: text,
    description: z.string().max(2000),
    active: z.boolean().optional(),
  }),
  publish_menu: z.object({
    policy_version: z.number().int().positive(),
    service_date: date,
    slot_id: id,
    menu_ids: z.array(id).min(1),
    default_menu_id: id,
    reason: z.string().max(1000).optional(),
  }),
  generate_schedule: z.object({
    customer_id: id,
    starts_on: date,
    ends_on: date,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    slot_ids: z.array(id).min(1),
  }),
  revise_schedule: z.object({
    id,
    version: z.number().int().positive(),
    customer_id: id,
    starts_on: date,
    ends_on: date,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    slot_ids: z.array(id).min(1),
  }),
  change_delivery: z.object({
    id,
    version: z.number().int().positive(),
    change: z.enum(["menu", "skip", "reschedule", "address"]),
    menu_id: id.optional(),
    service_date: date.optional(),
    slot_id: id.optional(),
    address: address.optional(),
    reason: z.string().max(1000).optional(),
  }),
  transition: z.object({
    id,
    version: z.number().int().positive(),
    status: z.enum(["ready", "out_for_delivery", "delivered", "failed"]),
    reason: z.string().max(1000).optional(),
  }),
  reverse_delivery: z.object({
    id,
    version: z.number().int().positive(),
    reason: text,
  }),
  adjust_quota: z.object({
    grant_id: id,
    amount: z.coerce
      .number()
      .int()
      .refine((n) => n !== 0),
    reason: text,
  }),
  save_settings: z.object({
    policy_version: z.number().int().positive(),
    name: text,
    timezone: text,
    cutoff: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  }),
  save_slot: z.object({
    policy_version: z.number().int().positive(),
    id: id.optional(),
    name: text,
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    active: z.boolean().optional(),
  }),
  save_exception: z.object({
    policy_version: z.number().int().positive(),
    service_date: date,
    cutoff_at: z.string().optional(),
    cutoff_local: z
      .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
        z.literal(""),
      ])
      .optional(),
    closed: z.boolean(),
  }),
  invite: z.object({
    policy_version: z.number().int().positive(),
    email: z.email(),
    role: z.enum(["admin", "subscriber"]),
    customer_id: z.union([id, z.literal("")]).optional(),
  }),
  set_role: z.object({
    policy_version: z.number().int().positive(),
    user_id: id,
    role: z.enum(["admin", "subscriber", "revoked"]),
  }),
  freeze: z.object({ service_date: date, slot_id: id }),
};
export function errorCode(message: string) {
  const known = [
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "IDEMPOTENCY_CONFLICT",
    "INSUFFICIENT_QUOTA",
    "CUTOFF_REACHED",
    "CUTOFF_NOT_REACHED",
    "OVERRIDE_REASON_REQUIRED",
    "REASON_REQUIRED",
    "INVALID_TRANSITION",
    "PRODUCTION_INCOMPLETE",
    "MENU_UNAVAILABLE",
    "MENU_IN_USE",
    "DEFAULT_REQUIRED",
    "PACKAGE_EXPIRED",
    "DATE_UNAVAILABLE",
    "INVALID_ADDRESS",
    "INVALID_SCHEDULE",
    "INVALID_TIMEZONE",
    "POLICY_WOULD_LOCK",
    "DATE_IN_USE",
    "SLOT_IN_USE",
  ];
  return (
    known.find((x) => message === x) ||
    (message.includes("active_occurrence")
      ? "DUPLICATE_DELIVERY"
      : message.includes("duplicate key")
        ? "DUPLICATE_RECORD"
        : "SAVE_FAILED")
  );
}
