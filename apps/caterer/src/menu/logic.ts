import { addDays, type ComponentGroup, type Dish, type LibraryDish, type MealMenu } from "@catera/domain";

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
