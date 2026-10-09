import {
  addDays,
  shortDate,
  type ComponentGroup,
  type Dish,
  type LibraryDish,
  type MealMenu,
  type SellerOffer,
} from "@catera/domain";
import type { MenuDay } from "./MenuWeek";

/** The package's template for one meal; a package with a single meal has only that one. */
export const mealOf = (offer: Pick<SellerOffer, "menus">, meal: string) =>
  offer.menus.find((m) => m.meal === meal) ?? offer.menus[0];

/**
 * Saves one delivery day's dishes. The menu keeps the package's own composition and name; only the dishes change.
 * `command` is the app's command sender (it retries safely and refreshes every screen that reads menus).
 */
export async function saveMenuDay(
  runtime: { command: (action: string, payload: unknown) => Promise<unknown> },
  args: {
    catererId: string;
    offer: Pick<SellerOffer, "id" | "contentRevision" | "menus">;
    meal: "lunch" | "dinner" | string;
    day: MenuDay;
    items: Dish[];
  },
): Promise<void> {
  const { catererId, offer, meal, day, items } = args;
  const { meal: _meal, source: _source, ...base } = mealOf(offer, meal);
  await runtime.command("menu.saveBatch", {
    catererId,
    packageId: offer.id,
    contentRevision: offer.contentRevision ?? 0,
    meal,
    dates: [{ date: day.date, version: day.version }],
    details: { ...base, contentModel: "slots", items },
  });
}

/** "5–9 Okt", or "28 Sep–2 Okt" across a month end; empty when the week has no delivery days. */
export function weekRange(dates: string[], locale: "id" | "en"): string {
  if (!dates.length) return "";
  // shortDate is "Senin 5 Okt": the weekday is dropped, the day number and month are kept.
  const part = (date: string) => shortDate(date, locale).split(" ").slice(1);
  const [firstDay, firstMonth] = part(dates[0]);
  const [lastDay, lastMonth] = part(dates[dates.length - 1]);
  if (dates.length === 1) return `${firstDay} ${firstMonth}`;
  return firstMonth === lastMonth ? `${firstDay}–${lastDay} ${lastMonth}` : `${firstDay} ${firstMonth}–${lastDay} ${lastMonth}`;
}

/** Three letters of the weekday: "Sen", "Mon". */
export const weekdayShort = (date: string, locale: "id" | "en") => shortDate(date, locale).split(" ")[0].slice(0, 3);

/** Dishes for one category that match what the caterer is typing, most used first. */
export function suggestDishes(
  library: LibraryDish[],
  categoryId: string | undefined,
  query: string,
  usage: Map<string, number>,
): LibraryDish[] {
  const q = query.trim().toLowerCase();
  return library
    .filter((d) => !d.archived && d.categoryId === categoryId && (!q || d.name.toLowerCase().includes(q)))
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name, "id"));
}

/** How often each library dish already appears in saved menus. */
export function dishUsage(menus: (MealMenu | null | undefined)[]): Map<string, number> {
  const usage = new Map<string, number>();
  for (const m of menus)
    for (const i of m?.items ?? [])
      if (i.sourceDishId) usage.set(i.sourceDishId, (usage.get(i.sourceDishId) ?? 0) + 1);
  return usage;
}

/** A day's menu is saveable only with exactly the package's count per category. */
export function dayComplete(composition: ComponentGroup[], items: Pick<Dish, "groupId">[]): boolean {
  return (
    composition.length > 0 &&
    composition.every((g) => items.filter((i) => i.groupId === g.id).length === g.slots)
  );
}

type MenuDetails = Omit<MealMenu, "meal" | "source">;

/**
 * Copies last week's menus one week forward. menu.saveBatch writes one menu to every date
 * in a batch (within one month), so days that share a menu are grouped into one batch.
 */
export type CopyTarget = { version: number; editable: boolean; filled: boolean };

/** Only days still open for changes and not yet filled receive last week's menu. */
export function copyWeekBatches(
  lastWeek: { date: string; details: MealMenu }[],
  targets: Map<string, CopyTarget>,
): { batches: { dates: { date: string; version: number }[]; details: MenuDetails }[]; skipped: number } {
  const batches = new Map<string, { dates: { date: string; version: number }[]; details: MenuDetails }>();
  let skipped = 0;
  for (const day of lastWeek) {
    const target = addDays(day.date, 7);
    const slot = targets.get(target);
    if (!slot?.editable || slot.filled) {
      skipped += 1;
      continue;
    }
    const { meal: _meal, source: _source, ...details } = day.details;
    const key = target.slice(0, 7) + JSON.stringify(details);
    const batch = batches.get(key) ?? { dates: [], details };
    batch.dates.push({ date: target, version: slot.version });
    batches.set(key, batch);
  }
  return { batches: [...batches.values()], skipped };
}

/** The delivery days (0 = Sunday) of the Monday-to-Sunday week containing `date`. */
export function weekDates(date: string, weekdays: number[]): string[] {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const monday = addDays(date, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) =>
    weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()),
  );
}
