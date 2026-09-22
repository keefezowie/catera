# Live multi-cycle checkout correction — September 21, 2026

The user explicitly requested enabling multi-cycle purchases on the live site after checkout rejected every duration above one cycle.

## Cause and change

Verified on Catera V1 (`ygzfdqrljunngfrdygzt`): `v1.purchase_features.multi_cycle` was false while Rantang Keluarga Siang & Malam advertised 1, 2 and 4 cycles. The quote function rejected longer durations with `DURATION_UNAVAILABLE` before calculating their schedules.

Enabled only `multi_cycle`, in a transaction with a `v1.audit` record under `purchase_features.multi_cycle.enable`. Independently confirmed `multi_cycle=true`, `automatic_payouts=false`. No application deployment or schema migration was needed for this configuration correction. The protected historical pilot was not touched.

## Verification

- Before activation, temporarily enabled the flag inside a rolled-back transaction and checked the live quote function with a temporary synthetic customer/address and demo mode explicitly false. All temporary rows and flag changes were rolled back.
- After activation, signed in using the existing synthetic customer and called the hosted `catera_v1_read` quote RPC. No checkout, payment, reservation or provider request was created.
- Package: Rantang Keluarga Siang & Malam; one portion; start November 16, 2026.

| Cycles | Delivery days | Subtotal | Duration discount | Total including service fee | Last delivery |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 | Rp 310,000 | Rp 0 | Rp 312,500 | November 20 |
| 2 | 10 | Rp 620,000 | Rp 18,600 (3%) | Rp 603,900 | November 27 |
| 4 | 20 | Rp 1,240,000 | Rp 62,000 (5%) | Rp 1,180,500 | December 11 |

All 11 focused tests passed in `tests/multi-cycle.test.ts` and `tests/checkout-sales-safeguards.test.ts`. No application code changed, so a new build and full code-validation suite were not required. Browser rendering and new provider payment processing were not exercised in this correction.

The earlier checkout-safeguards migration remains a separate release item: the live offer function inspected here does not expose `multiCycleAvailable`. Enabling the live flag aligns the currently advertised durations with quote eligibility; it does not deploy that migration or satisfy unrelated provider/payout release gates.

Rollback: disable `multi_cycle` with an audited configuration change; preserve existing purchases, delivery schedules and settlement records. The application eligibility change must be deployed before expecting older hosted selectors to hide disabled durations.
