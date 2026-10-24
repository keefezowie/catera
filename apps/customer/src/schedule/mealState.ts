import { mealJourney } from "@catera/domain";

type Meal = Parameters<typeof mealJourney>[0] & { issue?: { status?: string } | null };

/** A report still open on the meal; it outranks every other state. */
export const mealReported = (m: Meal) => !!m.issue && m.issue.status !== "resolved";

/**
 * Beranda's rule for a past day: a meal nobody updated and nobody reported was settled as delivered by the server
 * (auto_deliver reads silence so). Only a past day, so today's unsent meal still reads as scheduled or due.
 * The agenda and the day sheet both read this, so they say the same word for the same meal.
 */
export function mealSettled(m: Meal, date: string, today: string) {
  const { stage } = mealJourney(m);
  return !mealReported(m) && date < today && (stage === "scheduled" || stage === "preparing");
}
