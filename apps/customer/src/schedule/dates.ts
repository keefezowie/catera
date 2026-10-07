import { addDays, type Locale } from "@catera/domain";

/** Calendar maths on Jakarta "YYYY-MM-DD" strings. Never touches device-local Date methods. */
const WEEKDAYS = {
  id: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
/** Header letters, Monday first. */
export const WEEK_HEADER = {
  id: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "2026-10-07" → "2026-10". */
export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const d = utc(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  return { from, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
}

/** "Oktober 2026". */
export function monthTitle(month: string, locale: Locale): string {
  const d = utc(`${month}-01`);
  return `${MONTHS[locale][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Rabu 7 Oktober": the spoken name of a day. */
export function longDay(date: string, locale: Locale): string {
  const d = utc(date);
  return `${WEEKDAYS[locale][d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[locale][d.getUTCMonth()]}`;
}

/** "Senin": the day of the week. */
export function weekdayName(date: string, locale: Locale): string {
  return WEEKDAYS[locale][utc(date).getUTCDay()];
}

/** The month as weeks of 7 cells, Monday first; null pads the days outside the month. */
export function monthWeeks(month: string): (string | null)[][] {
  const { from, to } = monthRange(month);
  const lead = (utc(from).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
