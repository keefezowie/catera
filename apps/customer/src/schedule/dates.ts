import { addDays, monthWeeks } from "@catera/domain";

/** The calendar helpers live in `@catera/domain` so both native apps and `CalendarSheet` import one copy. */
export { longDay, monthOf, monthRange, monthTitle, monthWeeks, shiftMonth, weekdayName, WEEK_HEADER } from "@catera/domain";

/**
 * The month's weeks as whole Monday-to-Sunday weeks of 7 dates: the days outside the month that pad its first and last
 * weeks are real dates here. The grid draws only the month's own days, but the agenda shows the whole week.
 */
export function monthFullWeeks(month: string): string[][] {
  const weeks = monthWeeks(month);
  const first = weeks[0].findIndex((d) => d != null);
  const monday = addDays(weeks[0][first] as string, -first);
  return weeks.map((_, row) => Array.from({ length: 7 }, (_, col) => addDays(monday, row * 7 + col)));
}

/** What to read for a month: from the Monday of its first week to the Sunday of its last, so every week shown is complete. */
export function monthReadRange(month: string): { from: string; to: string } {
  const weeks = monthFullWeeks(month);
  return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
}
