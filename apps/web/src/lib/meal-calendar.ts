import { addDays, type Delivery } from "@catera/domain";

export type Meal = "lunch" | "dinner";
export type MealCoverage = "none" | Meal | "both";
export const meals: Meal[] = ["lunch", "dinner"];
export function mealCoverage(
  day: { lunch: boolean; dinner: boolean } | undefined,
): MealCoverage {
  if (day?.lunch && day.dinner) return "both";
  if (day?.lunch) return "lunch";
  if (day?.dinner) return "dinner";
  return "none";
}
export function activePackageCount(
  day: { deliveries: Delivery[] } | undefined,
) {
  return (
    day?.deliveries.filter((delivery) =>
      meals.some((meal) => covered(delivery, meal)),
    ).length || 0
  );
}
export const monthOf = (day: string) => day.slice(0, 7) + "-01";
export function shiftMonth(day: string, amount: number) {
  const date = new Date(monthOf(day) + "T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}
export const monthEnd = (day: string) => addDays(shiftMonth(day, 1), -1);
export function weekStart(day: string) {
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}
export function datesBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}
export function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  for (let m = monthOf(from); m <= monthOf(to); m = shiftMonth(m, 1))
    months.push(m);
  return months;
}
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    day >= "1900-01-01" &&
    day <= "9998-12-31" &&
    !Number.isNaN(Date.parse(day + "T12:00:00Z")) &&
    new Date(day + "T12:00:00Z").toISOString().slice(0, 10) === day
  );
}
export function covered(d: Delivery, meal: Meal) {
  return (
    d.status !== "cancelled" &&
    d.meals.some((m) => m.meal === meal && m.status !== "cancelled")
  );
}
export function upcoming(d: Delivery, meal: Meal) {
  return (
    !["delivered", "cancelled"].includes(d.status) &&
    d.meals.some(
      (m) => m.meal === meal && !["delivered", "cancelled"].includes(m.status),
    )
  );
}
export function indexDeliveries(deliveries: Delivery[]) {
  const days = new Map<
    string,
    { deliveries: Delivery[]; lunch: boolean; dinner: boolean }
  >();
  for (const d of deliveries) {
    const day = days.get(d.service_date) || {
      deliveries: [],
      lunch: false,
      dinner: false,
    };
    day.deliveries.push(d);
    for (const meal of meals) day[meal] ||= covered(d, meal);
    days.set(d.service_date, day);
  }
  for (const day of days.values())
    day.deliveries.sort(
      (a, b) =>
        a.offer.caterer.localeCompare(b.offer.caterer) ||
        a.id.localeCompare(b.id),
    );
  return days;
}
