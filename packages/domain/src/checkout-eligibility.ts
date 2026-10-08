import { addDays, localDay } from "./dates";
import type { Offer, Subscription } from "./index";

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

/** Bookable start dates for a new purchase, soonest first, within the next three weeks. */
export function startDates(
  offer: Pick<Offer, "timezone" | "cutoff" | "weekdays">,
  now: Date,
  count: number,
): string[] {
  const out: string[] = [];
  for (let i = 0, d = localDay(now); i < 21 && out.length < count; i += 1, d = addDays(d, 1))
    if (purchaseStartAvailable(offer, d, now)) out.push(d);
  return out;
}

/** The first bookable start after the customer's running plan of this package, for when a new
 * purchase would overlap it. Looks up to 60 days ahead; null when there is no running plan. */
export function nextStartAfter(
  offer: Pick<Offer, "id" | "timezone" | "cutoff" | "weekdays">,
  subscriptions: readonly Pick<Subscription, "package_id" | "status" | "ends_on">[],
  now = new Date(),
): { endsOn: string; start: string } | null {
  const endsOn = subscriptions
    .filter((s) => s.status === "active" && s.package_id === offer.id)
    .reduce<string | null>((latest, s) => (!latest || s.ends_on > latest ? s.ends_on : latest), null);
  if (!endsOn) return null;
  for (let i = 1; i <= 60; i += 1) {
    const day = addDays(endsOn, i);
    if (purchaseStartAvailable(offer, day, now)) return { endsOn, start: day };
  }
  return null;
}
