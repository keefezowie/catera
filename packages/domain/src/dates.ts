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
