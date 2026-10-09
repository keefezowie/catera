import { menuCoverImage } from "./contents";
import {
  canChangeDay,
  changeDeadline,
  dayLabel,
  MEALS,
  menuIsSet,
  renewalDue,
  servedMeals,
  storyDishes,
  trialFollowUp,
  type Plate,
} from "./customer-day";
import type { CustomerActionItem, CustomerState, Delivery, Locale, Subscription } from "./index";
import { jakartaDay, shortDate } from "./kitchen";
import { windowStartMinutes } from "./windows";

/** The sections of Beranda, read from the customer state. A leaf module: type-only imports from ./index. */

/** Today's plates split by meal, each in window order (`todayPlates` already orders them). */
export function mealPlates(plates: Plate[]): { lunch: Plate[]; dinner: Plate[] } {
  return {
    lunch: plates.filter((p) => p.meal === "lunch"),
    dinner: plates.filter((p) => p.meal === "dinner"),
  };
}

export type UpcomingMeal = {
  deliveryId: string;
  meal: "lunch" | "dinner";
  packageName: string;
  catererName: string;
  /** The main dish once the menu is set; null while it is not. */
  lead: string | null;
  /** The menu's cover photo once the menu is set, else the package photo; "" when there is neither. */
  image: string;
  menuSet: boolean;
  /** When changes close ("besok 17.00"), or null once they have or the day cannot move. */
  changeUntil: string | null;
};

export type UpcomingDay = { date: string; label: string; meals: UpcomingMeal[] };

/**
 * The next `days` Jakarta days after today that have a delivery, each with all its meals: lunch before dinner, the
 * caterer's window deciding the order among the same meal. Cancelled days and cancelled meals are left out.
 */
export function upcomingDays(state: CustomerState, now: Date, days: number, locale: Locale): UpcomingDay[] {
  const today = jakartaDay(now);
  const byDate = new Map<string, { meal: UpcomingMeal; start: number }[]>();
  for (const d of state.deliveries) {
    if (d.service_date <= today || d.status === "cancelled") continue;
    const changeable = canChangeDay(d, now);
    const changeUntil = changeable.date || changeable.address ? changeDeadline(d.cutoff_at, now, locale) : null;
    for (const meal of servedMeals(d)) {
      const menu = d.offer.menus?.find((m) => m.meal === meal) ?? null;
      const set = !!menu && menuIsSet(menu);
      const entry = {
        start: windowStartMinutes(d.offer, meal),
        meal: {
          deliveryId: d.id,
          meal,
          packageName: d.offer.name,
          catererName: d.offer.caterer,
          lead: set ? storyDishes(menu).title : null,
          // A menu that is not set can still carry a template photo; the package photo is the truth then.
          image: menuCoverImage(set ? menu : null, d.offer.image ?? ""),
          menuSet: set,
          changeUntil,
        },
      };
      const list = byDate.get(d.service_date);
      if (list) list.push(entry);
      else byDate.set(d.service_date, [entry]);
    }
  }
  return [...byDate.keys()]
    .sort()
    .slice(0, Math.max(0, days))
    .map((date) => ({
      date,
      label: dayLabel(date, today, locale),
      meals: byDate
        .get(date)!
        .sort((a, b) => MEALS.indexOf(a.meal.meal) - MEALS.indexOf(b.meal.meal) || a.start - b.start)
        .map((e) => e.meal),
    }));
}

export type WaitingItem =
  | { kind: "menu"; subscriptionId: string; packageName: string; dates: string[]; deadline: string }
  | { kind: "renew"; subscription: Subscription }
  | { kind: "trial"; subscription: Subscription }
  | { kind: "review"; subscription: Subscription };

/** The plan a menu action belongs to: the id in its `/subscriptions/{id}/menu` link, else the action itself. */
function menuPlanId(item: CustomerActionItem): string {
  const m = /^\/subscriptions\/([^/?#]+)/.exec(item.href);
  if (!m) return item.id;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

const deadlineAt = (deadline: string) => {
  const at = Date.parse(deadline);
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
};

/** Menu choices that are due, one row per plan: its due dates, soonest first, and the earliest deadline among them. */
function menuRows(state: CustomerState, actions: CustomerActionItem[]): WaitingItem[] {
  const plans = new Map<string, { packageName: string; dates: Set<string>; deadline: string }>();
  for (const item of actions) {
    if (item.kind !== "menu_choice_due" || item.status !== "selection_due" || !item.serviceDate) continue;
    const id = menuPlanId(item);
    const plan = plans.get(id) ?? {
      packageName: item.packageName ?? state.subscriptions.find((s) => s.id === id)?.snapshot?.offer?.name ?? "",
      dates: new Set<string>(),
      deadline: "",
    };
    plan.dates.add(item.serviceDate);
    if (item.dueAt && (!plan.deadline || deadlineAt(item.dueAt) < deadlineAt(plan.deadline))) plan.deadline = item.dueAt;
    plans.set(id, plan);
  }
  return [...plans.entries()]
    .map(([subscriptionId, p]) => ({
      kind: "menu" as const,
      subscriptionId,
      packageName: p.packageName,
      dates: [...p.dates].sort(),
      deadline: p.deadline,
    }))
    .sort((a, b) => deadlineAt(a.deadline) - deadlineAt(b.deadline));
}

/** Asked once, when 3 or fewer days remain or after the final delivery (review.save needs one delivered day). */
function reviewCandidate(state: CustomerState): Subscription | undefined {
  return state.subscriptions.find(
    (s) =>
      s.status !== "cancelled" &&
      s.remaining <= 3 &&
      state.deliveries.some((d: Delivery) => d.subscription_id === s.id && d.status === "delivered"),
  );
}

/**
 * What waits on the customer, in the order Beranda shows it: menus still to choose (soonest deadline first), plans to
 * renew, trials to continue, then the review to leave. `actions` is the action read; null (offline, never loaded)
 * gives no menu rows, since a menu that is due is only known from that read. Nothing here depends on the clock:
 * `now` is accepted so every Beranda section reads the same way, and for rules that start to depend on it.
 */
export function waitingItems(state: CustomerState, actions: CustomerActionItem[] | null, _now: Date): WaitingItem[] {
  const items: WaitingItem[] = actions ? menuRows(state, actions) : [];
  for (const subscription of state.subscriptions) {
    if (renewalDue(subscription, state.subscriptions)) items.push({ kind: "renew", subscription });
  }
  for (const subscription of state.subscriptions) {
    if (trialFollowUp(subscription, state.subscriptions)) items.push({ kind: "trial", subscription });
  }
  const review = reviewCandidate(state);
  if (review) items.push({ kind: "review", subscription: review });
  return items;
}

/** The plans that still serve days: how many, which kitchens, and up to three package photos. */
export function activePlans(state: CustomerState): { count: number; caterers: string[]; images: string[] } {
  const active = state.subscriptions.filter((s) => s.status === "active");
  const caterers: string[] = [];
  const images: string[] = [];
  for (const s of active) {
    const offer = s.snapshot?.offer;
    if (offer?.caterer && !caterers.includes(offer.caterer)) caterers.push(offer.caterer);
    if (offer?.image && !images.includes(offer.image) && images.length < 3) images.push(offer.image);
  }
  return { count: active.length, caterers, images };
}

/** "12–23 Okt", or "26 Okt–6 Nov" when the plan crosses a month. */
function rangeLabel(from: string, to: string, locale: Locale): string {
  const [, fromDay, fromMonth] = shortDate(from, locale).split(" ");
  const [, toDay, toMonth] = shortDate(to, locale).split(" ");
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${fromDay}–${toDay} ${toMonth}`
    : `${fromDay} ${fromMonth}–${toDay} ${toMonth}`;
}

/** The plan's name, plus its dates only when another active plan carries the same name. */
export function planLabel(sub: Subscription, all: Subscription[], locale: Locale): string {
  const name = sub.snapshot?.offer?.name ?? "";
  const twin = all.some((s) => s.id !== sub.id && s.status === "active" && (s.snapshot?.offer?.name ?? "") === name);
  return twin ? `${name} · ${rangeLabel(sub.starts_on, sub.ends_on, locale)}` : name;
}
