# Catera V1 implementation and release plan

September 10 package-editor follow-up: [reusable dishes and reliable editing](REUSABLE-DISHES.md) records local delivery, migration order, snapshot preservation and verification. Hosted migration and physical-device checks remain separate gates.

This is the implementation status of the user-approved September 9, 2026 overhaul. PRODUCT.md defines scope. This plan replaces the tenant-specific pilot plan and distinguishes delivered local functionality from remaining release work.

| Milestone                        | Delivered                                                                                                                                                                                                       | Remaining gate                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Restore foundation            | Repaired lockfile; verified fresh npm ci; workspaces; shared types/API/services; archived pilot; isolated explicit synthetic database                                                                           | CI must run on the eventual remote branch; never connect V1 to the pilot                                                                       |
| 2. Brand and shells              | Individual regenerated identity/food assets; manifests/gallery; shared font/tokens; separate customer/seller/admin web; native tabs; reviewed web compositions                                                  | Requested master resolution and derivative icon exports; device visual evidence (true-alpha derivatives verified September 10)                 |
| 3. Identity, catalog, onboarding | Phone OTP implementation, saved areas/addresses, coverage, comparisons, seller verification, guided packages, menus and capacity                                                                                | Separate Supabase auth/storage/realtime configuration and real SMS/SMTP tests                                                                  |
| 4. Purchasing                    | Shared quote/hold/activation rules, trials, quantity discounts, immutable purchase snapshots, Xendit adapter, callback verification, payment recovery, native/web return bridge                                 | Xendit sandbox end-to-end evidence; approved fees and split topology; device payment returns                                                   |
| 5. Daily operations and recovery | Global calendar, reviewable date/address changes, independent meal fulfillment, production/manifests, messages/inbox/push outbox, reviews, support/refunds, admin payout release/reconciliation, manual renewal | Actual push delivery/receipt tests and merchant refund/payout reconciliation; complete English copy QA; expanded history pagination at scale   |
| 6. Release preparation           | Explicit preview/confirm external-prepaid import, concurrency and browser checks, native component checks/exports, updated design/product/runbook                                                               | Signed Android/iOS dev builds and device E2E, hosted isolation/security tests, restore drill, monitoring and all production checklist evidence |

## Verified customer and operational behavior

- September 10 package contents follow-up: structured à la carte/nasi box, optional macros and purchased content revisions extend V1. Local evidence and hosted/device gates are tracked in [PACKAGE-CONTENTS.md](PACKAGE-CONTENTS.md).

- Public discovery and comparison precede login. In-area offers lead; coverage rules are enforced again at checkout.
- Web journey: compare, review a generated schedule, create a checkout, simulate payment in explicit demo mode, replace an eligible date with confirmation, request cancellation without silently releasing delivery, and navigate to manual renewal.
- Shared SQL verifies every-date reservation, combined meals, immutable terms/address snapshots, trial limits, quantity discounts, out-of-area rejection, cutoffs, duplicate/overlapping schedules, closures/capacity commitments, late payments, callback duplication and scoped authorization.
- Seller production includes trial portions and separate meals, preserves date/meal context and produces permanent revisions with CSV/print output. Staff are excluded from financial controls.
- Support review, financial authorization and refund/split/payout reconciliation are separate traceable actions. Legacy imports preview before committing remaining delivery days.

## Remaining work in execution order

1. True-alpha derivatives completed September 10 with originals/prompts retained and edges inspected on contrasting surfaces. Finish the remaining asset acceptance gates: provide supported master resolutions and individual icon/favicon/PWA export packs. Do not resize the board or label interpolation as regeneration.
2. Provision fresh staging Supabase and configure SMS, SMTP, storage and scoped Realtime. Apply only V1 migrations and use synthetic seller/customer accounts. Verify revocation, tenant isolation and native/web session refresh against hosted auth.
3. Configure Xendit sandbox, server-side account/split routes, approved fictional staging fees and payout recipients. Exercise payment, callback retries, expiration, late payment, refund, split reconciliation and payout failure. Record actual provider IDs in private evidence, never in public fixtures.
4. Create Android/iOS EAS development builds. Test full purchase and return links, background/terminated state recovery, notifications and receipt handling, font scaling, screen reader and keyboard behavior on supported phones/tablets. Finish complete English UI copy and locale layout verification.
5. Validate the legacy import with a reviewed synthetic external receipt file and verify exactly the remaining prepaid obligations. Expand cursor pagination for high-volume histories before onboarding large operational datasets.
6. Complete the runbook restore/monitoring drill and approve production commercial policies. Launch only after all rows have evidence. Keep the hosted pilot unchanged until a separately approved migration is complete.

## Evidence index

- output/install-verification.json: clean npm ci success.
- output/verification/final.json: final local check results and explicit outstanding work.
- output/verification/postgres.json: real PostgreSQL concurrent transaction results.
- tests/*.test.ts: executable domain, financial, access and provider contracts.
- tests/e2e: web journeys and responsive checks.
- apps/customer/tests: native component behavior on iOS/Android presets.
- apps/customer/dist: generated native bundles (ignored build output, not a signed app).
- output/visual-review: reviewed desktop/phone/tablet captures.
- output/V1-FINISH-REVIEW.md and V1-FINISH-VERDICT.md: finite design review and fix scores.
- packages/brand/manifest.*.json: asset provenance and honest dimensions/alpha metadata.

No production deployment, real transaction, SMS/email to customers, or hosted database reset was performed during this implementation.

September 10 mascot loading implementation: see [MASCOT-MOTION.md](MASCOT-MOTION.md) and `output/mascot-motion/` for blink provenance, web/native integration and local verification. Native physical-device motion/accessibility validation remains a release gate.

## Web calendar release evidence — September 10, 2026

Implemented continuous meal coverage on responsive web; Expo deferred. The strip distinguishes empty, lunch-only, dinner-only and combined days while preserving coverage beneath independent today and selection states. Redundant checklist rows, coverage labels and the footer rail were replaced by palette-aligned sun/moon icons with an active-package count in 120px desktop and 116px mobile cards. Local typecheck, 77 unit/database tests, production build, seven PostgreSQL concurrency/RLS checks and all 10 browser journeys passed. Earlier independent review resolved the picker accessibility findings; the current visual review verified the distilled day-state treatment at desktop and 390px. See [MEAL-CALENDAR.md](MEAL-CALENDAR.md). Hosted gate: apply `20260910160000_calendar_metadata.sql` after reusable dishes and before the web rollout. No hosted migration or deployment was performed for this change.
