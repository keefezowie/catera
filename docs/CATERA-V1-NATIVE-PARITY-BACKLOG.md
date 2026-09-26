# Catera V1 native parity backlog

Status: deferred after the September 26, 2026 web remediation. This document
maps approved outcomes to the existing customer-native entry points; it does
not authorize native implementation, provider testing, or a mobile release.

The web product is the current acceptance target. Shared domain and API
contracts may be reused, but native layouts must retain the implemented native
type scale, safe-area behavior, and platform navigation rather than copying web
CSS or claiming visual parity.

| Outcome                       | Existing native entry point                                                                                          | Shared contract to reuse                                                                           | Deferred acceptance                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Truthful package commitment   | `apps/customer/app/package/[id].tsx`, `apps/customer/src/package-preview.tsx`, `apps/customer/app/checkout/[id].tsx` | `purchaseCommitment`, `purchaseStartAvailable`, existing quote/checkout reads                      | Show delivery days, meal coverage, portions, included delivery, known fees, upfront payment, and manual renewal consistently; never infer unknown fees.                         |
| Customer menu states          | `apps/customer/app/subscriptions/[id].tsx`, `apps/customer/src/dish-gallery.tsx`                                     | `customerMenuPresentation`, `CustomerMenuMonth`                                                    | Distinguish post-payment availability, due cutoff, saved choice, caterer fallback, unannounced menu, and example content; preserve one choice for all portions and no menu fee. |
| Action-oriented Home          | `apps/customer/app/(tabs)/index.tsx`, `apps/customer/src/daily.tsx`                                                  | `CustomerActionFeed`, `customerActionPresentation`                                                 | Top three actionable menu/payment/delivery items with inline expansion; date-grouped meals; active-subscription empty state; renewal link.                                      |
| Canonical delivery recovery   | `apps/customer/app/delivery/[id].tsx`, `apps/customer/src/daily.tsx`                                                 | `DeliveryAvailability`, availability reason helpers, existing atomic `delivery.reschedule` command | One primary schedule action, skip as an intent, bounded disabled dates, full old/new review, retained original booking on conflict.                                             |
| Payment recovery              | `apps/customer/app/payment/[id].tsx`, `apps/customer/src/purchase.tsx`                                               | `paymentPresentation`, existing checkout/payment states                                            | Preparing, awaiting, checking, paid, expired, and booking-unresolved states with order reference and exactly one safe next action; uncertainty never prompts duplicate payment. |
| Loading and stale-data safety | `apps/customer/src/context.tsx` and each screen above                                                                | `resourcePhase` semantics                                                                          | Initial loading, retained refresh, true/filtered empty, stale-data error, action pending, conflict, and terminal states; stale data visible with unsafe writes disabled.        |
| Terminology and accessibility | Shared native UI in `apps/customer/src/ui.tsx`                                                                       | Approved ID/EN copy and status meanings                                                            | Indonesian-first copy, English expansion, screen-reader names, dynamic type, focus order, touch targets, reduced motion, safe areas, and keyboard avoidance.                    |

Seller operational scope, bulk transitions, exception pagination, package
lifecycle controls, and settlement hierarchy remain web-only because the V1
native app has no approved seller workspace.

## Required evidence before native completion

1. Implement on an isolated branch without changing web business rules or
   provider behavior.
2. Run native unit tests plus authenticated customer journeys in Indonesian and
   English on representative iOS and Android phone sizes and a tablet size.
3. Verify dynamic type/larger text, screen reader use, touch targets, safe areas,
   keyboard avoidance, reduced motion, offline/slow refresh, conflicts, and long
   copy.
4. Keep simulator evidence separate from physical-device, provider, hosted-auth,
   performance, and store-release acceptance. All of those remain outstanding
   until separately authorized and executed.
