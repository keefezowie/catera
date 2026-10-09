import type { DeliveryMeal } from "./index";

/**
 * Where one meal is on its way to the customer. A leaf module: it imports types only, so the
 * customer and kitchen views can both build on it without a require cycle.
 *
 * Stages come from fulfilment status and timestamps, never from the clock: a meal the kitchen
 * never tapped stays "scheduled".
 */
export type JourneyStage = "scheduled" | "preparing" | "out_for_delivery" | "delivered";

export type Journey = {
  stage: JourneyStage;
  /** When the kitchen started cooking, when it was recorded. */
  cookingAt: string | null;
  departedAt: string | null;
  arrivedAt: string | null;
  /** Who recorded the arrival; "auto" means nobody tapped and the system closed the meal. */
  arrivedBy: "customer" | "auto" | "caterer" | null;
  /** The caterer marked the meal "Gagal diantar". The stage keeps what the timestamps imply. */
  issue: boolean;
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/** HH.MM in Asia/Jakarta, or null for a missing or unreadable timestamp. */
export function jakartaClock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + JAKARTA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function mealJourney(meal: DeliveryMeal): Journey {
  const cookingAt = meal.cooking_started_at ?? null;
  const departedAt = meal.departed_at ?? null;
  const issue = meal.status === "issue";
  let stage: JourneyStage;
  if (meal.status === "delivered") stage = "delivered";
  else if (meal.status === "out_for_delivery") stage = "out_for_delivery";
  else if (meal.status === "preparing") stage = "preparing";
  else if (issue) stage = departedAt ? "out_for_delivery" : cookingAt ? "preparing" : "scheduled";
  else stage = "scheduled";
  const delivered = stage === "delivered";
  return {
    stage,
    cookingAt,
    departedAt,
    arrivedAt: delivered ? (meal.confirmed_at ?? null) : null,
    arrivedBy: delivered ? (meal.confirmed_by ?? null) : null,
    issue,
  };
}

/** One short line for the stage, or null when the meal is marked as a problem. Times are HH.MM Jakarta. */
export function journeyCaption(j: Journey, locale: "id" | "en"): string | null {
  if (j.issue) return null;
  const en = locale === "en";
  switch (j.stage) {
    case "scheduled":
      return en ? "Scheduled" : "Terjadwal";
    case "preparing": {
      const at = jakartaClock(j.cookingAt);
      if (!at) return en ? "Cooking" : "Dimasak";
      return en ? `Cooking since ${at}` : `Dimasak ${at}`;
    }
    case "out_for_delivery": {
      const at = jakartaClock(j.departedAt);
      if (!at) return en ? "On the way" : "Sedang diantar";
      return en ? `Left at ${at}` : `Berangkat ${at}`;
    }
    case "delivered":
      if (j.arrivedBy === "auto") return en ? "Recorded as arrived" : "Tercatat sampai";
      return en ? "Arrived" : "Sampai";
  }
}
