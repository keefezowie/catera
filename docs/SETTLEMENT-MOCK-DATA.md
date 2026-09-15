# Hosted settlement mock data

Installed September 15, 2026 in the Catera V1 database, in **Demo Dapur Catera** (`catera-demo-workspace`). The separate historical pilot was not modified.

## Installed prerequisites

Applied the pending package lifecycle, nutrition ranges, usability read options, menu cutoff, customer choice menus, paid seller pilot, multi-cycle purchase, and delivery-earned settlement migrations in dependency order. The nutrition migration was applied as `v1_package_nutrition_ranges_null_safe`: both `jsonb_each` inputs use a `jsonb_typeof(...) = 'object'` guard because legacy JSON null nutrition values are not SQL NULL. Historical repository migrations were not rewritten.

## Fixture

[Seed SQL](../scripts/seed-settlement-mock.sql) is additive and repeat-safe, with batch key `settlement-demo-20260915`. It requires the expected demo workspace, synthetic pricing policy, and disabled payouts. It creates no Auth accounts or external jobs and changes no existing purchase terms.

- One clearly named MOCK package, kept in draft to exclude it from public discovery.
- Three synthetic customers and paid purchases: 3 cycles of 5 delivery days, 2 portions, Rp35,000 per portion/day, 5% duration savings, no promotion, Rp2,500 service fee, Rp1,000,000 upfront total each.
- 45 delivery dates and confirmed reservations, including 15 completed deliveries. Completion triggers produce 15 earning entries of Rp61,180 each.
- One held allocation and one terminal, simulated Rp200,000 payout. No bank recipient or provider transfer.
- Synthetic settlement policy disabled; global multi-cycle and automatic payout flags remain disabled.

Verified owner-authorized `seller-settlement` read:

| Balance | IDR |
| --- | ---: |
| Earned | 917,700 |
| Held | 305,900 |
| Simulated paid | 200,000 |
| Available | 411,800 |
| Expected upcoming | 1,835,400 |
| Reserved / recovery | 0 |

## Verification

The complete SQL first passed in a rolled-back transaction, then committed successfully. Running it again returned the same balances without duplicating fixtures. The owner-authorized database read succeeded. No frontend deployment was performed as part of this seed.

Existing checkout quote hash stayed `73a82df97564645a2545eddbf2bc2cbb`; existing subscription snapshot hash stayed `b22af2502493e45fbc3ce37849c820af`. The transaction asserts unchanged historical terms and outbox count before committing. Database checks confirmed 3 mock purchases, 45 delivery dates, 15 earning entries, automatic payouts disabled, and zero dispatchable mock payouts.

This is synthetic accounting history for UI demonstration, not evidence of provider settlement or live payment processing. The simulated completed payout is inserted directly; it does not exercise weekly dispatch eligibility or the payment provider.
