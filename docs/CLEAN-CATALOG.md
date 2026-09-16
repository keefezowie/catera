# Catera V1 clean sample catalog

Applied on 2026-09-16 to the separately configured **Catera V1** Supabase project, `ygzfdqrljunngfrdygzt`. These are fictional sellers and customers with realistic commercial content, not verified businesses or real transactions. The database remains explicitly synthetic.

## Replacement contents

- Dapur Selaras, Hijau Kitchen, and Dapur Sunda Rasa, each with three published packages.
- Nine packages, 27 categorized reusable dishes, 24 independently versioned package dish options across three customer-choice packages, and 245 dated meal menus.
- Fourteen purchases, 66 delivery days, 76 meal fulfillments, five saved customer menus, three delivered-purchase reviews, and one open delivery-instruction support case.
- Active and completed terms, a one-day trial, single and multiple portions, lunch/dinner combinations, marketplace and invited attribution, portion savings, and delivery-earned settlement records.
- Existing Catera food artwork and dish-specific Wikimedia photographs; see [image credits](CLEAN-CATALOG-IMAGE-CREDITS.md).

The old sample order/catalog/settlement graph was cleared atomically. Auth users, passwords, existing staff access, global configuration, permanent audit history, Storage objects, and the separate historical pilot were preserved. Old unauthenticated sample customer profiles were replaced. Existing demo login display names were made natural; credentials did not change.

## Business rules

Package prices remain daily prices. The combined lunch/dinner package costs Rp62,000 per delivery day and displays Rp31,000 per meal. Capacity is 60 complete portions per selected weekday; combined meals reserve once per day. All schedules use consecutive eligible delivery weekdays. Delivery is included; Rp2,500 service fees are separate. Invited and marketplace seller fee rates are 3% and 8%. Portion savings apply before seller fees.

Purchased snapshots and checkout quotes match. Meals fill their exact category slots; package templates contain no dated dishes. Customer choices use package-owned options, one selection per meal shared by all purchased portions. Unchosen past-cutoff deliveries rely on the existing caterer-choice behavior. Earnings are created only for completed delivery days, including both meals for combined packages. No payment, refund, or payout dispatch jobs were queued.

Duration options are configured, but all seeded purchases use one cycle. The existing multi-cycle and automatic payout rollout flags remain disabled. No fake live provider payment or payout was performed.

## Reproduction and backup

- Generator: `node scripts/clean-catalog.mjs` (writes SQL only; does not connect or apply).
- Optional empty-order catalog: `node scripts/clean-catalog.mjs --catalog-only`.
- Anchor: add `--anchor YYYY-MM-DD`; omitted means the current Jakarta date.
- Generated SQL: ignored `.data/backups/clean-catalog-20260916.sql`.
- Pre-reset data snapshot: ignored `.data/backups/before-clean-catalog-20260916.json`, containing all 56 V1 tables plus notification events. This is an application-data backup, not an Auth/Storage/schema dump. It may contain private information and must not be committed.
- Disposable PostgreSQL validation: `node --import tsx scripts/verify-clean-catalog.mjs`.
- Hosted login/read validation: `node --env-file=apps/web/.env.local scripts/verify-clean-catalog-hosted.mjs`.

The replacement SQL uses explicit tenant/account guards, rejects nonsynthetic policies and real provider IDs, refuses populated paid-pilot records, takes an advisory transaction lock, and uses an explicit table list without CASCADE. It preserves immutable audit history. Do not use the older September 11 baseline generator to reset this catalog.

## Verification

Passed: disposable PostgreSQL reset, repeat reset, rollback on invalid data, offer/menu/category/choice/capacity/coverage/settlement checks; hosted customer/owner/staff/admin authentication and role boundaries; 173 unit tests; typecheck; production build; PostgreSQL concurrency suite. Hosted checks found zero old test packages, snapshot mismatches, wrong payment totals, premature earned credits, or provider dispatch jobs.

Browser checks used the local production build connected to hosted Catera V1: public discovery and combined-meal detail at desktop and 390px. This does not constitute a new Vercel deployment. The database replacement is already applied to the hosted project.
