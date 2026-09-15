# Multi-cycle purchases and delivery-earned settlement

Implemented on `v1`, September 15, 2026. This document records the approved extension and operational rollout; it does not authorize deployment.

## Purchase contract

- One package, one upfront payment, fixed portions, one subscription, and a complete atomic schedule. A cycle means the package's delivery-day count, not a calendar month. For example, a 20-day package bought for three cycles includes 60 eligible delivery days.
- Owners offer selected integer durations from one through six cycles. One cycle is mandatory with zero duration discount. Additional discounts are 0–90%, to two decimal places. Options are append-only revisions on the same package, including published packages; base price, composition, day count, and existing purchased terms remain immutable.
- Every required date must have capacity. Weekday rules, known closures, caterer timezone and cutoff remain authoritative. Capacity failures never silently omit a date or create a partial purchase. Lunch + dinner reserves portions once per day.
- New schedules must finish within 366 days of checkout in the caterer's timezone. The absolute booking limit is snapshotted and also enforced when rescheduling. Historical purchases without this field retain their existing rules. Recurring capacity guarantees those dates even if daily menus have not been filled yet; sellers should review closures and long-term production commitments before enabling longer durations.
- Payment holds remain 15 minutes, bounded by the first cutoff; the payment adapter retains the existing minimum remaining hold requirement. Expiry releases the complete hold. A late confirmation must reacquire every required date or enter the existing payment-exception/support flow.
- Renewal is an explicit new purchase at current pricing. The existing `renewed_from` chain finds the latest noncancelled successor and starts after its actual delivery end. Pending successor payments are surfaced. Exact-package overlapping active/pending ranges remain rejected; an existing term cannot be rescheduled across an already reserved successor.
- No automatic billing, installments, changing portions mid-term, automatic renewal, spendable balance, or cashback.

## Pricing and history

All amounts are integer IDR. Database arithmetic uses numeric intermediates before the existing signed-integer storage ceiling of Rp 2,147,483,647. The database quote is authoritative; the shared TypeScript helper is for seller previews.

1. `subtotal = daily package price × delivery days per cycle × cycles × portions` (trial remains one day at its trial price).
2. Apply the highest eligible portion-tier percentage, rounding once to whole IDR.
3. Apply the selected duration percentage to the remaining package amount, rounding once.
4. The result is package net. Both reductions are seller-funded package pricing.
5. New temporary promotions are disabled: no code field, nonempty codes rejected, historical promotions retained read-only. This follows the final approved scope. Old pending checkouts and historical promotion snapshots are not repriced.
6. Seller commission is calculated on package net using the snapshotted attribution and approved pilot/global policy. Customer service fee is itemized once per purchase. Full upfront charge equals package net plus service fee.

New quotes snapshot pricing version, daily price and complete offer/contents, portion tiers and chosen percentage, duration revision and options, selected option, both discounts, days/cycles/portions, all dates, absolute horizon, address, attribution, fee-policy inputs, seller commission/net, settlement model/policy, and rounding method. New checkout terms and existing subscription snapshots cannot be rewritten. Missing cycles on historical records means one cycle; no purchase backfill is performed.

The customer review shows price components before the payment action and groups the full schedule by cycle. Package editing has duration checkboxes, short labels, discounts, and example totals. Existing native purchases remain readable and native checkout defaults to one cycle; new native duration selection remains deferred with native product work.

## Settlement contract

New-model purchases use `delivery_earned_v1`. Legacy allocations continue through the existing legacy payout/reconciliation path and are excluded from this ledger.

- Activation divides the immutable seller net over original scheduled days. Divide by day count, then assign one extra rupiah to the first remainder days. Rescheduling retains the day identity and amount.
- Credit a day once only when all its meal fulfillments are delivered. For combined packages, lunch alone is insufficient. Imported externally paid terms create no new earning allocation.
- Append-only entries record earned amounts, pre-delivery entitlement reductions, post-delivery refund debits, externally received recoveries, and balanced debt offsets. Original entitlement amounts do not change.
- Open support, allocation holds, and unreconciled refunds block eligible balances. Admin refund reconciliation explicitly apportions seller deduction, optionally to selected day IDs. Deduction cannot exceed the refund or remaining original entitlement. No automatic cancellation refund formula is introduced.
- Refunds after a payout can create recovery due. Future unheld earnings offset that debt using balanced immutable entries, preventing repeated deduction in later weeks. An admin may record an evidenced external recovery; the UI does not transfer funds.
- Monday 09:00 Asia/Jakarta is the weekly cutoff. Scheduler invocations catch up after that instant. Credits recorded at or after cutoff wait until next week. One seller/cutoff run is unique. Runs and provider submissions serialize against delivery/refund operations using the existing seller advisory lock.
- Seller-approved minimum and maximum transfer limits control carry-forward and chunking. A sub-minimum remainder carries forward. Available balances are bigint totals serialized as strings. Payout records remain within existing integer limits.
- Planned payouts reserve earnings. Before first submission, balances, holds and enablement are rechecked; affected unsent transfers are cancelled and funds are reconsidered at a subsequent weekly run. Once submission starts, retries retain the same captured recipient request and idempotency key, since an uncertain network result may already represent a bank transfer.
- Validated Xendit V3 events distinguish pending/compliance, succeeded, failed/rejected, and reversed. Duplicate events cannot increment paid totals twice. A reversal releases the earlier payout exactly once. Authenticated callbacks validate merchant, reference, amount, currency and recipient against the captured request. Pending-provider lookups supplement callbacks and rotate through a bounded queue. Failures remain reserved and are reported in scheduler reconciliation results.

`settlement_state` shows future delivery value, available, held, reserved, paid, recovery due, next scheduled time, recent entries and payouts. This is a seller settlement statement, not a wallet. Admin controls version policies, display current rollout flags and capture audit reasons. Existing manual payout approval includes only legacy allocations, even for mixed sellers.

## Files and schema ownership

| Area | Source |
| --- | --- |
| Domain pricing, validation and compatibility | `packages/domain/src/purchase-pricing.ts`, `settlement.ts`, `index.ts`, `pilot.ts` |
| Duration revisions, quote, full schedule, renewal, horizon | `packages/backend/src/multi-cycle.sql` |
| Immutable daily entitlements, ledger, runs, payout events and policies | `packages/backend/src/earned-settlement.sql` |
| Provider contract and controlled-collection guard | `packages/backend/src/payments.ts` |
| API transport, worker and callbacks | `packages/api-client/src/index.ts`, web API V1/jobs/webhooks, `apps/web/src/lib/settlement-jobs.ts` |
| Customer review and renewal | web `purchase.tsx`, `purchase-price-breakdown.tsx`, `customer.tsx`, `customer-pilot.tsx` |
| Owner/admin editing and statements | web `package-duration-editor.tsx`, `seller-settlement.tsx`, `admin-settlement.tsx`, `seller.tsx` |
| SQL artifacts | `20260915094614_multi_cycle.sql`, `20260915094829_earned_settlement.sql` |

Private tables use RLS and no authenticated direct-write access. Authorization, receipts, reservation/entitlement changes, ledger entries and audits stay in the database transaction. Demo initialization installs the same migrations after paid-pilot/customer-choice prerequisites. Only explicitly synthetic demo storage receives fixtures.

## Migration and rollout order

1. Preserve a backup and validate the existing paid-pilot/customer-choice migrations and historical purchase counts in staging. The paid-pilot files already present in the workspace remain a dependency, not an alternate import system.
2. Apply `20260914160856_paid_seller_pilot.sql` if not yet applied, then `20260915094614_multi_cycle.sql`, then `20260915094829_earned_settlement.sql`. Do not rewrite historical migrations. The two new compiler scripts synchronize their canonical SQL with these new artifacts.
3. Deploy compatible backend, worker, callbacks, shared types and web UI together. Existing records need no data rewrite. Duration defaults to one cycle; global multi-cycle and automatic payout flags start false. All new real purchases require approved non-synthetic pricing and settlement policies.
4. Configure and verify the merchant collection arrangement before new real purchases: `CATERA_CONTROLLED_COLLECTION=true`, with no seller account/split routing in `CATERA_XENDIT_ROUTING_JSON` for earned-settlement sellers. The payment adapter rejects incompatible routing to prevent immediate seller splits followed by a duplicate weekly payout.
5. Configure `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN`, `XENDIT_BUSINESS_ID`, authenticated scheduler `CRON_SECRET`, and verified `CATERA_PAYOUT_RECIPIENTS_JSON` entries (`recipient`, `purposeCode`, optional `minimumAmount`/`maximumAmount`). Match policy limits to that channel. Do not store credentials or bank fixtures in source control.
6. In Xendit sandbox, verify collection/fees, full and partial refunds, timeout retries, compliance, failed/rejected payout, duplicate callbacks, and reversal. Confirm callbacks and periodic provider lookups, scheduler lateness alerts, recipient ownership, and adequate merchant balance. Local contract tests do not prove real bank execution or the approved merchant topology.
7. Enable selected sellers' duration options and the global multi-cycle flag. Separately enable seller payout policies and automatic dispatch only after reconciliation approval. Check the first full weekly run against bank/provider statements and ledger totals.
8. Monitor reserved daily capacity far into the future, statement discrepancies, pending-provider age, outbox failures and reconciliation failures. Operational staff must honour confirmed future dates; suspending sales does not cancel them.

Rollback is additive: disable new multi-cycle sales and new payout planning, keep the compatible snapshot readers, earning triggers, pending-transfer retries and callbacks running. Never drop the new ledger or revert to a worker that submits earned allocations through legacy payout approval. Already submitted transfers must be resolved with the same idempotency keys. Existing terms remain deliverable.

## Verification

- Unit/database regressions: multi-cycle totals, full capacity failure rollback, stale revision, horizon/trial/promo rejection, immutable history, one daily earning after both meals, payout states, holds, refund reductions, debt offsets, channel chunking and mixed legacy settlements.
- PostgreSQL: contention on the 60th required date, repeat activation, concurrent early renewals, exactly-once delivery earnings, concurrent weekly planning/submission and duplicate success/reversal events, plus existing authorization/rescheduling/concurrency suite.
- Browser: Indonesian/English, 390px/1440px checkout, seller duration editing, all 60 dates, price review, upfront demo payment, early renewal, owner statements and admin controls. Axe checks cover the review region; the scrollable schedule is keyboard accessible.
- Evidence: `output/verification/postgres.json` and `output/usability-overhaul/multi-cycle*`. Hosted migrations, real money, deployment and physical-device validation are separate release gates.


### Local verification result

September 15, 2026: root typecheck passed; 145 unit/database tests across 21 suites passed; PostgreSQL concurrency checks passed; optimized web build passed; all five focused browser journeys passed in the fresh synthetic development runtime; native iOS-preset compatibility tests passed (32 tests across seven suites). Browser coverage includes both locales at phone and desktop widths and an accessibility scan of checkout review. See `output/verification/multi-cycle.json` and `output/usability-overhaul/multi-cycle-final-report`. An additional local launch of the built app was blocked by automatic approval review without a detailed reason; no built-runtime browser result is claimed. No hosted migration, deployment, real provider transaction or physical-device test was performed.
