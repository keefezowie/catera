import { menuCoverImage } from "./contents";
import { renewalDue, upcomingRows, type UpcomingRow } from "./customer-day";
import { addDays } from "./dates";
import type { Checkout, CustomerState, Locale, Offer, Subscription } from "./index";
import { jakartaDay } from "./kitchen";

/** What a plan page offers next. "renewed" is a statement, not an action. */
export type PlanAction =
  | { kind: "renew"; href: string }
  | { kind: "trial"; href: string }
  | { kind: "renewed" }
  | { kind: "none" };

export type PlanDetail = {
  sub: Subscription;
  offer: Offer;
  status: "active" | "completed" | "other";
  remaining: number;
  startsOn: string;
  endsOn: string;
  /** This plan's next deliveries after Jakarta today, soonest first, at most UPCOMING_LIMIT. */
  upcoming: UpcomingRow[];
  action: PlanAction;
};

const UPCOMING_LIMIT = 5;
/** A completed plan's recap shows for this many Jakarta days after its last day. */
const RECAP_DAYS = 14;

/** Another plan that renews `sub` and has not been cancelled. */
function isRenewed(sub: Subscription, subscriptions: readonly Subscription[]): boolean {
  return subscriptions.some((s) => s.renewed_from === sub.id && s.status !== "cancelled");
}

function planAction(sub: Subscription, subscriptions: readonly Subscription[]): PlanAction {
  if (sub.snapshot?.trial) {
    // A trial invites the full package unless a later plan for it already exists (no duplicate purchase).
    if (sub.status !== "active" && sub.status !== "completed") return { kind: "none" };
    const taken = subscriptions.some(
      (s) => s.package_id === sub.package_id && s.status !== "cancelled" && s.starts_on > sub.starts_on,
    );
    return taken ? { kind: "none" } : { kind: "trial", href: `/paket/${sub.package_id}` };
  }
  if (isRenewed(sub, subscriptions)) return { kind: "renewed" };
  if (sub.status === "completed" || renewalDue(sub, subscriptions)) return { kind: "renew", href: `/renew/${sub.id}` };
  return { kind: "none" };
}

/** The plan screen's data for one subscription of the customer read; null when the read does not hold it. */
export function planDetail(state: CustomerState, id: string, now: Date, locale: Locale): PlanDetail | null {
  const sub = state.subscriptions.find((s) => s.id === id);
  if (!sub) return null;
  const mine = { ...state, deliveries: state.deliveries.filter((d) => d.subscription_id === id) };
  return {
    sub,
    offer: sub.snapshot.offer,
    status: sub.status === "active" ? "active" : sub.status === "completed" ? "completed" : "other",
    remaining: sub.remaining,
    startsOn: sub.starts_on,
    endsOn: sub.ends_on,
    upcoming: upcomingRows(mine, now, UPCOMING_LIMIT, locale),
    action: planAction(sub, state.subscriptions),
  };
}

/**
 * Plans worth a "Paket selesai" recap: completed full plans that ended within the last 14 Jakarta
 * days (the 14th day counts) and have no non-cancelled renewal. Most recently ended first. Whether
 * the customer has already seen the recap is the app's storage check, not decided here.
 */
export function recapCandidates(state: CustomerState, now: Date): Subscription[] {
  const earliest = addDays(jakartaDay(now), -RECAP_DAYS);
  return state.subscriptions
    .filter(
      (s) =>
        s.status === "completed" &&
        !s.snapshot?.trial &&
        s.ends_on >= earliest &&
        !isRenewed(s, state.subscriptions),
    )
    .sort((a, b) => b.ends_on.localeCompare(a.ends_on));
}

export type PaidSummary = {
  subscriptionId: string;
  offerName: string;
  caterer: string;
  image: string;
  firstDate: string;
  /** The first six reserved dates, sorted. */
  dates: string[];
  /** How many reserved dates come after those shown. */
  more: number;
  /** The customer picks the menus themselves ("Pilih menu"). */
  menuChoice: boolean;
};

const PAID_DATES_SHOWN = 6;

/** The payment success screen's data; null until the checkout is paid and its subscription exists. */
export function paidSummary(checkout: Checkout): PaidSummary | null {
  if (checkout.state !== "paid" || !checkout.subscription_id) return null;
  const { offer } = checkout.quote;
  const sorted = [...checkout.quote.dates].sort();
  return {
    subscriptionId: checkout.subscription_id,
    offerName: offer.name,
    caterer: offer.caterer,
    image: menuCoverImage(offer.menus?.[0] ?? null, offer.image ?? ""),
    firstDate: sorted[0] ?? "",
    dates: sorted.slice(0, PAID_DATES_SHOWN),
    more: Math.max(0, sorted.length - PAID_DATES_SHOWN),
    menuChoice: offer.menuSelectionMode === "customer",
  };
}
