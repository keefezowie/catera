import { pendingMenu } from "./contents";
import type { Delivery } from "./index";

/** One meal of a calendar day: the photo to draw, whether the caterer has set its menu, whether it arrived. */
export type CalendarMeal = { image: string; menuSet: boolean; delivered: boolean };

/** What a day covers. A meal the day does not serve, or that was cancelled or failed, is null. */
export type CalendarDay = { lunch: CalendarMeal | null; dinner: CalendarMeal | null };

/**
 * The Jadwal calendar's days, keyed by Jakarta service date.
 *
 * Cancelled days and cancelled meals are left out, and so are meals the caterer marked "Gagal diantar" (`"issue"`):
 * they did not come and are not coming, so a day of only those has no entry at all.
 *
 * `image` is the menu's own photo, then the first dish photo, then the package photo, then "" when there is none.
 * A menu that is not set yet (a slot menu with no items, or no menu entry for that meal) still carries the package
 * photo; `menuSet` is what tells the screen to hide it.
 *
 * Two deliveries serving the same meal on one day merge: `delivered` and `menuSet` need both, `image` is the first
 * that exists.
 */
export function calendarDays(deliveries: Delivery[]): Map<string, CalendarDay> {
  const days = new Map<string, CalendarDay>();
  for (const d of deliveries) {
    if (d.status === "cancelled") continue;
    for (const m of d.meals ?? []) {
      if (m.status === "cancelled" || m.status === "issue") continue;
      const menu = d.offer.menus?.find((x) => x.meal === m.meal);
      const day = days.get(d.service_date) ?? { lunch: null, dinner: null };
      const next: CalendarMeal = {
        image: menu?.image || menu?.items?.find((i) => i.image)?.image || d.offer.image || "",
        menuSet: !!menu && !pendingMenu(menu),
        delivered: m.status === "delivered",
      };
      // Two packages can serve the same meal on one day. The day is delivered and set only when both are; the photo is
      // the first one that exists.
      const prev = day[m.meal];
      day[m.meal] = prev
        ? { image: prev.image || next.image, menuSet: prev.menuSet && next.menuSet, delivered: prev.delivered && next.delivered }
        : next;
      days.set(d.service_date, day);
    }
  }
  return days;
}
