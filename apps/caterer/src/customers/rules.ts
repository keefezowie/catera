import type { PayoutSetup, SellerCustomer } from "@catera/domain";

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

/** The subscription a renewal is about: the active one ending soonest. */
export function currentSubscription(c: SellerCustomer) {
  return [...c.subscriptions]
    .filter((s) => s.status === "active")
    .sort((a, b) => a.remaining - b.remaining)[0] ?? c.subscriptions[0];
}
