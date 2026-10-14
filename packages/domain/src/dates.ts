import type { Locale } from "./index";

export function localDay(now = new Date(), timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function addDays(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function schedule(
  start: string,
  days: number,
  weekdays: number[],
  closed: string[] = [],
) {
  const result: string[] = [];
  if (!weekdays.length) throw new Error("NO_OPERATING_DAYS");
  for (let i = 0; i < 730 && result.length < days; i++) {
    const d = addDays(start, i);
    if (
      weekdays.includes(new Date(d + "T12:00:00Z").getUTCDay()) &&
      !closed.includes(d)
    )
      result.push(d);
  }
  if (result.length !== days) throw new Error("NO_AVAILABILITY");
  return result;
}

/** Calendar maths on Jakarta "YYYY-MM-DD" strings. Never touches device-local Date methods. Shared by both native apps. */
const CALENDAR_WEEKDAYS = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const CALENDAR_MONTHS = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
/** Header letters, Monday first. */
export const WEEK_HEADER = {
  id: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const calendarUtc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "2026-10-07" → "2026-10". */
export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const d = calendarUtc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

/** "Oktober 2026". */
export function monthTitle(month: string, locale: Locale): string {
  const d = calendarUtc(`${month}-01`);
  return `${CALENDAR_MONTHS[locale][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Rabu 7 Oktober": the spoken name of a day. */
export function longDay(date: string, locale: Locale): string {
  const d = calendarUtc(date);
  return `${CALENDAR_WEEKDAYS[locale][d.getUTCDay()]} ${d.getUTCDate()} ${CALENDAR_MONTHS[locale][d.getUTCMonth()]}`;
}

/** "Senin": the day of the week. */
export function weekdayName(date: string, locale: Locale): string {
  return CALENDAR_WEEKDAYS[locale][calendarUtc(date).getUTCDay()];
}

/** The month as weeks of 7 cells, Monday first; null pads the days outside the month. */
export function monthWeeks(month: string): (string | null)[][] {
  const { from, to } = monthRange(month);
  const lead = (calendarUtc(from).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
