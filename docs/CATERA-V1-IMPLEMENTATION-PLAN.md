# Catera V1 implementation and release plan

This is the implementation status of the user-approved September 9, 2026 overhaul. PRODUCT.md defines scope. This plan replaces the tenant-specific pilot plan and distinguishes delivered local functionality from remaining release work.

| Milestone | Delivered | Remaining gate |
|---|---|---|
| 1. Restore foundation | Repaired lockfile; verified fresh npm ci; workspaces; shared types/API/services; archived pilot; isolated explicit synthetic database | CI must run on the eventual remote branch; never connect V1 to the pilot |
| 2. Brand and shells | Individual regenerated identity/food assets; manifests/gallery; shared font/tokens; separate customer/seller/admin web; native tabs; reviewed web compositions | Real alpha, requested master resolution and derivative icon exports; device visual evidence |
| 3. Identity, catalog, onboarding | Phone OTP implementation, saved areas/addresses, coverage, comparisons, seller verification, guided packages, menus and capacity | Separate Supabase auth/storage/realtime configuration and real SMS/SMTP tests |
| 4. Purchasing | Shared quote/hold/activation rules, trials, quantity discounts, immutable purchase snapshots, Xendit adapter, callback verification, payment recovery, native/web return bridge | Xendit sandbox end-to-end evidence; approved fees and split topology; device payment returns |
| 5. Daily operations and recovery | Global calendar, reviewable date/address changes, independent meal fulfillment, production/manifests, messages/inbox/push outbox, reviews, support/refunds, admin payout release/reconciliation, manual renewal | Actual push delivery/receipt tests and merchant refund/payout reconciliation; complete English copy QA; expanded history pagination at scale |
| 6. Release preparation | Explicit preview/confirm external-prepaid import, concurrency and browser checks, native component checks/exports, updated design/product/runbook | Signed Android/iOS dev builds and device E2E, hosted isolation/security tests, restore drill, monitoring and all production checklist evidence |

## Verified customer and operational behavior

- Public discovery and comparison precede login. In-area offers lead; coverage rules are enforced again at checkout.
- Web journey: compare, review a generated schedule, create a checkout, simulate payment in explicit demo mode, replace an eligible date with confirmation, request cancellation without silently releasing delivery, and navigate to manual renewal.
- Shared SQL verifies every-date reservation, combined meals, immutable terms/address snapshots, trial limits, quantity discounts, out-of-area rejection, cutoffs, duplicate/overlapping schedules, closures/capacity commitments, late payments, callback duplication and scoped authorization.
- Seller production includes trial portions and separate meals, preserves date/meal context and produces permanent revisions with CSV/print output. Staff are excluded from financial controls.
- Support review, financial authorization and refund/split/payout reconciliation are separate traceable actions. Legacy imports preview before committing remaining delivery days.

## Remaining work in execution order

1. Finish the asset acceptance gate when cleanup is authorized: derive true-alpha files from regenerated originals, retain masters/prompts, inspect edges at actual UI sizes, provide supported master resolutions and individual icon/favicon/PWA export packs. Do not resize the board or label interpolation as regeneration.
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
- .impeccable/review: reviewed desktop/phone/tablet captures.
- output/V1-FINISH-REVIEW.md and V1-FINISH-VERDICT.md: finite design review and fix scores.
- packages/brand/manifest.*.json: asset provenance and honest dimensions/alpha metadata.

No production deployment, real transaction, SMS/email to customers, or hosted database reset was performed during this implementation.
