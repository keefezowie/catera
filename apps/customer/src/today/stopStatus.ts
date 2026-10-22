import type { Plate } from "@catera/domain";

/** Where a meal is in the day: `now`, `next` (still to come), `done` (arrived or its report sent), `none` (no plate). */
export type StopStatus = "now" | "next" | "none" | "done";

type PlateState = Plate["state"];

/** Plates being cooked, on their way, due, marked arrived by the kitchen, or failed: their meal is "now". */
const IN_PROGRESS: PlateState[] = ["cooking", "on_the_way", "due", "arrived_unconfirmed", "failed"];
/** The two that wait on the customer and do not move the meal along; they go quiet once the next meal has started. */
const STALE: PlateState[] = ["arrived_unconfirmed", "failed"];

function statusOf(plates: Plate[]): StopStatus {
  if (!plates.length) return "none";
  if (plates.some((p) => IN_PROGRESS.includes(p.state))) return "now";
  return plates.every((p) => ["arrived", "reported"].includes(p.state)) ? "done" : "next";
}

/**
 * The two stops' dots. At most one meal is "now": the earlier one while it is still in progress. When the earlier meal
 * is only waiting on the customer (a failed delivery, an arrival the kitchen marked) and dinner has started, lunch
 * counts as done so the day's one live stop is dinner; when both are genuinely under way, lunch stays "now" and dinner
 * is "next".
 */
export function stopStatuses(lunch: Plate[], dinner: Plate[]): { lunch: StopStatus; dinner: StopStatus } {
  const first = statusOf(lunch);
  const second = statusOf(dinner);
  if (first !== "now" || second !== "now") return { lunch: first, dinner: second };
  const lunchWaitsOnly = lunch.every((p) => !IN_PROGRESS.includes(p.state) || STALE.includes(p.state));
  const dinnerStarted = dinner.some((p) => p.state !== "scheduled");
  if (lunchWaitsOnly && dinnerStarted) return { lunch: "done", dinner: "now" };
  return { lunch: "now", dinner: "next" };
}
