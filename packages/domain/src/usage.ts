import { z } from "zod";

/** The only events the apps may count. Includes the ones Phase D will send (Ruling C12). */
export const usageNames = [
  "app_open",
  "tomorrow_story_viewed",
  "journey_viewed",
  "plan_sheet_opened",
  "renew_started",
  "purchase_confirmed_viewed",
  "cook_started",
  "depart_tapped",
] as const;
export type UsageName = (typeof usageNames)[number];

/** A count carries the event and the app, never a user, a caterer or a device. */
export const usageSchema = z
  .object({ name: z.enum(usageNames), app: z.enum(["customer", "dapur"]) })
  .strict();
export type UsageApp = z.infer<typeof usageSchema>["app"];
