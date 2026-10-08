import { addDays } from "./dates";
import type { CustomerState, Delivery, DeliveryMeal, Locale, Offer, Subscription } from "./index";
import type { MealType } from "./offer-schema";
import { jakartaDay, shortDate } from "./kitchen";

/** Customer-facing views of a delivery day, shared by the customer app and the web. */
export type PlateState = "cooking" | "on_the_way" | "due" | "arrived" | "failed" | "reported" | "none";

export type Plate = {
  state: PlateState;
  deliveryId: string;
  meal: "lunch" | "dinner";
  packageName: string;
  catererName: string;
  window: string;
  dishes: string[];
  image: string;
  addressLabel: string;
  departedAt: string | null;
  confirmedAt: string | null;
  reaction: DeliveryMeal["reaction"];
  issue: DeliveryMeal["issue"];
  /** The caterer's verified WhatsApp number, when the read carries one. */
  catererPhone: string | null;
};

export type UpcomingRow = {
  deliveryId: string;
  date: string;
  label: string;
  /** The package this day belongs to, and which of its meals the day brings. */
  packageName: string;
  meal: MealType;
  dishes: string;
  /** When changes close, with the day: "hari ini 17.00", "besok 17.00", "Jumat 17.00". */
  changeUntil: string | null;
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Meal order within a day: lunch first. */
export const MEALS = ["lunch", "dinner"] as const;
const ADDRESS_LABEL_LENGTH = 24;

const mealsOf = (d: Delivery): DeliveryMeal[] => d.meals ?? [];

/** Window start in minutes after midnight, the same rule as SQL v1.window_bounds. */
export function windowStartMinutes(offer: Offer, meal: "lunch" | "dinner"): number {
  const m = /^\s*(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})\s*$/.exec(offer.windows?.[meal] ?? "");
  if (m) {
    const [sh, sm, eh, em] = [m[1], m[2], m[3], m[4]].map(Number);
    if (sh <= 23 && eh <= 23 && sm <= 59 && em <= 59) return sh * 60 + sm;
  }
  return meal === "dinner" ? 17 * 60 : 11 * 60;
}

function windowStart(date: string, offer: Offer, meal: "lunch" | "dinner"): number {
  const minutes = windowStartMinutes(offer, meal);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return Date.parse(`${date}T${hh}:${mm}:00+07:00`);
}

/** HH.MM in Asia/Jakarta, or null for an unreadable timestamp. */
function jakartaClock(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + JAKARTA_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Dish names in composition order, else the menu name; empty when the offer has no such menu. */
function dishesFor(offer: Offer, meal: "lunch" | "dinner"): string[] {
  const menu = offer.menus?.find((m) => m.meal === meal);
  if (!menu) return [];
  const items = (menu.items ?? []).filter((i) => i.name.trim());
  if (!items.length) return menu.name ? [menu.name] : [];
  const order = (menu.composition ?? []).map((g) => g.id);
  const rank = (groupId?: string) => {
    const at = groupId ? order.indexOf(groupId) : -1;
    return at < 0 ? order.length : at;
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.groupId) - rank(b.item.groupId) || a.index - b.index)
    .map(({ item }) => item.name);
}

/** reported > failed > arrived > on_the_way > due > cooking. */
function plateState(meal: DeliveryMeal, due: boolean): PlateState {
  if (meal.issue && meal.issue.status !== "resolved") return "reported";
  // The caterer marked the meal "Gagal diantar": it is not coming today.
  if (meal.status === "issue") return "failed";
  if (meal.status === "delivered") return "arrived";
  if (meal.status === "out_for_delivery") return "on_the_way";
  return due ? "due" : "cooking";
}

function addressLabel(d: Delivery): string {
  const label = d.address?.label?.trim();
  return label || (d.address?.line ?? "").slice(0, ADDRESS_LABEL_LENGTH);
}

/** One plate per meal delivered today in Jakarta, ordered by window start. */
export function todayPlates(state: CustomerState, now: Date): Plate[] {
  const today = jakartaDay(now);
  const plates: { plate: Plate; start: number }[] = [];
  for (const d of state.deliveries) {
    if (d.service_date !== today || d.status === "cancelled") continue;
    for (const m of mealsOf(d)) {
      if (m.status === "cancelled") continue;
      const start = windowStart(today, d.offer, m.meal);
      const menu = d.offer.menus?.find((x) => x.meal === m.meal);
      plates.push({
        start,
        plate: {
          state: plateState(m, start <= now.getTime()),
          deliveryId: d.id,
          meal: m.meal,
          packageName: d.offer.name,
          catererName: d.offer.caterer,
          window: d.offer.windows?.[m.meal] ?? "",
          dishes: dishesFor(d.offer, m.meal),
          image: menu?.image || d.offer.image || "",
          addressLabel: addressLabel(d),
          departedAt: m.departed_at ?? null,
          confirmedAt: m.confirmed_at ?? null,
          reaction: m.reaction ?? null,
          issue: m.issue ?? null,
          catererPhone: d.catererPhone ?? null,
        },
      });
    }
  }
  return plates
    .sort((a, b) => a.start - b.start || MEALS.indexOf(a.plate.meal) - MEALS.indexOf(b.plate.meal))
    .map((p) => p.plate);
}

/**
 * Meals of a delivery day the customer may report a problem with ("Ada masalah"): served today
 * or yesterday in Jakarta, not cancelled, and either past the start of their window or already
 * on the way, delivered or failed. Never a future day. In window order (lunch, dinner).
 */
export function reportableMeals(d: Delivery, now: Date): ("lunch" | "dinner")[] {
  const today = jakartaDay(now);
  if (d.status === "cancelled" || (d.service_date !== today && d.service_date !== addDays(today, -1))) return [];
  return MEALS.filter((meal) =>
    mealsOf(d).some(
      (m) =>
        m.meal === meal &&
        m.status !== "cancelled" &&
        (m.status === "out_for_delivery" ||
          m.status === "delivered" ||
          m.status === "issue" ||
          windowStart(d.service_date, d.offer, meal) <= now.getTime()),
    ),
  );
}

/** The next `n` deliveries after Jakarta today, soonest first. */
export function upcomingRows(state: CustomerState, now: Date, n: number, locale: Locale = "id"): UpcomingRow[] {
  const today = jakartaDay(now);
  return state.deliveries
    .filter((d) => d.service_date > today && d.status !== "cancelled")
    .sort((a, b) => a.service_date.localeCompare(b.service_date))
    .slice(0, Math.max(0, n))
    .map((d) => {
      const served = mealsOf(d)
        .filter((m) => m.status !== "cancelled")
        .map((m) => m.meal);
      const meals = MEALS.filter((meal) =>
        served.length ? served.includes(meal) : d.offer.menus?.some((m) => m.meal === meal),
      );
      const changeable = canChangeDay(d, now);
      return {
        deliveryId: d.id,
        date: d.service_date,
        label: dayLabel(d.service_date, today, "id"),
        packageName: d.offer.name,
        meal: meals.length > 1 ? "both" : (meals[0] ?? d.offer.meal),
        dishes: meals.flatMap((meal) => dishesFor(d.offer, meal)).join(", "),
        changeUntil: changeable.date || changeable.address ? changeDeadline(d.cutoff_at, now, locale) : null,
      };
    });
}

/** What the customer can still change on a delivery day; the cutoff minute itself is closed. */
export function canChangeDay(
  d: Delivery,
  now: Date,
): { date: boolean; address: boolean; until: string | null } {
  const cutoff = Date.parse(d.cutoff_at);
  const open = !Number.isNaN(cutoff) && now.getTime() < cutoff;
  return {
    date: d.canChange && open,
    address: open && d.status === "scheduled",
    until: jakartaClock(d.cutoff_at),
  };
}

/**
 * When a day's changes close, in Jakarta: "hari ini 17.00", "besok 17.00", the weekday within
 * the coming week ("Jumat 17.00"), else the date ("Rabu 14 Okt 17.00"). Null when unreadable.
 */
export function changeDeadline(cutoffAt: string, now: Date, locale: Locale = "id"): string | null {
  const time = jakartaClock(cutoffAt);
  if (!time) return null;
  const day = jakartaDay(new Date(Date.parse(cutoffAt)));
  const today = jakartaDay(now);
  if (day === today) return `${locale === "en" ? "today" : "hari ini"} ${time}`;
  if (day === addDays(today, 1)) return `${locale === "en" ? "tomorrow" : "besok"} ${time}`;
  const date = shortDate(day, locale);
  const withinWeek = day > today && day < addDays(today, 7);
  return `${withinWeek ? date.split(" ")[0] : date} ${time}`;
}

/** Next cycle of the same package, starting the first operating weekday after the current end. */
export function renewalDefaults(
  sub: Subscription,
  offer: Offer,
): { startDate: string; cycles: number; portions: number; packageId: string; renewedFrom: string } {
  let startDate = addDays(sub.ends_on, 1);
  if (offer.weekdays?.length) {
    for (let i = 0; i < 7 && !offer.weekdays.includes(new Date(`${startDate}T00:00:00Z`).getUTCDay()); i += 1) {
      startDate = addDays(startDate, 1);
    }
  }
  return {
    startDate,
    cycles: 1,
    portions: sub.portions,
    packageId: sub.package_id,
    renewedFrom: sub.id,
  };
}

/**
 * Whether to invite the customer to renew: an active, non-trial plan with 3 or fewer days left
 * that has no renewal yet (any subscription renewed from it that is not cancelled). Matches the
 * exclusions of the server's renewal reminders.
 */
export function renewalDue(sub: Subscription, subscriptions: readonly Subscription[]): boolean {
  if (sub.status !== "active" || sub.remaining > 3) return false;
  if (sub.snapshot?.trial) return false;
  return !subscriptions.some((s) => s.renewed_from === sub.id && s.status !== "cancelled");
}

/**
 * Whether to invite a trial customer to the full package: an active trial with one day or less
 * left and no later non-cancelled plan for the same package (the full plan, once bought, ends it).
 */
export function trialFollowUp(sub: Subscription, subscriptions: readonly Subscription[]): boolean {
  if (sub.status !== "active" || !sub.snapshot?.trial || sub.remaining > 1) return false;
  return !subscriptions.some(
    (s) => s.package_id === sub.package_id && s.status !== "cancelled" && s.starts_on > sub.starts_on,
  );
}

/** "Rabu 7 Okt", with a "Besok, " prefix for the day after `today`. */
export function dayLabel(date: string, today: string, locale: Locale): string {
  const label = shortDate(date, locale);
  if (date !== addDays(today, 1)) return label;
  return `${locale === "en" ? "Tomorrow" : "Besok"}, ${label}`;
}
