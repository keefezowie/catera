import { addDays, shortDate, type Locale, type PayoutSetup, type SellerCustomer } from "@catera/domain";

export type CustomerStatus = "active" | "ending" | "ended";

/** Ending = an active package with three or fewer delivery days left. */
export function customerStatus(c: SellerCustomer): CustomerStatus {
  const live = c.subscriptions.filter((s) => s.status === "active");
  if (!live.length) return "ended";
  return live.some((s) => s.remaining <= 3) ? "ending" : "active";
}

/** Renewals and new sales need Catera approval plus an active payout account. */
export function paymentsActive(catererStatus: string | undefined, setup: Pick<PayoutSetup, "active"> | null) {
  return catererStatus === "approved" && !!setup?.active;
}

/** Customers with a Catera account renew directly; others claim their account first. */
export function renewalAction(c: SellerCustomer): "followup" | "invite" | "none" {
  if (c.user_id) return "followup";
  return c.phone ? "invite" : "none";
}

/** Active packages, soonest ending first. */
export function activeSubscriptions(c: SellerCustomer) {
  return c.subscriptions
    .filter((s) => s.status === "active")
    .sort((a, b) => a.ends_on.localeCompare(b.ends_on) || a.remaining - b.remaining);
}

/** The subscription a renewal is about: the active one ending soonest. */
export function currentSubscription(c: SellerCustomer) {
  return activeSubscriptions(c)[0] ?? c.subscriptions[0];
}

/**
 * When a package ends, from its last delivery date against today's date in Jakarta
 * (both "YYYY-MM-DD"): today, tomorrow, or the day itself.
 */
export function endLabel(endsOn: string, today: string, t: (id: string, en: string) => string, locale: Locale) {
  if (endsOn === today) return t("Berakhir hari ini", "Ends today");
  if (endsOn === addDays(today, 1)) return t("Berakhir besok", "Ends tomorrow");
  return `${t("Berakhir", "Ends")} ${shortDate(endsOn, locale)}`;
}
