import { addDays, type Offer } from "./index";

/** Matches v1.cutoff: the previous day's cutoff in the caterer's timezone. */
export function purchaseStartAvailable(
  offer: Pick<Offer, "timezone" | "cutoff" | "weekdays">,
  date: string,
  now = new Date(),
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(day.getTime()) ||
    !offer.weekdays.includes(day.getUTCDay())
  )
    return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: offer.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const local = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  return local < `${addDays(date, -1)}T${offer.cutoff.padEnd(8, ":00")}`;
}
