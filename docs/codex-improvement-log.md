# Catera beta improvement log

## September 17, 2026 baseline and authorization

Objective: complete the five beta P0 capabilities, then address evidence-backed high-value issues through reproduce, fix, test and review cycles. No shared database writes, real messages/payments, or deployments. Native physical-device and hosted-provider verification require separate environments.

The checkout began with uncommitted seller workspace changes. A baseline patch is retained locally at `output/beta-improvement/preexisting.patch`. Preserve those changes; commits must isolate this goal's work. The user explicitly confirmed restoring a simple prepaid import flow despite the earlier September 17 removal. Other workspace simplifications remain approved.

Baseline checks: root typecheck PASS; 26 Vitest files / 184 tests PASS; production web build PASS; 17 PostgreSQL concurrency/security scenarios PASS in a fresh embedded database. No baseline browser claim yet.

## P0 map and acceptance

| P0 | Existing implementation and evidence | Gap / acceptance | Status |
| --- | --- | --- | --- |
| 1. Onboarding and prepaid migration | Seller onboarding/profile, package wizard and readiness; transactional `paid-pilot.sql` preview/commit, customer claims, invitations | Simple owner-only prepaid preview/confirm restored; fresh seller setup through public commands, package submission/admin approval/publication, duplicate and race recovery verified | Complete locally; hosted identity/invitation delivery unverified |
| 2. Needs attention | Today/production, support queue, customer choice fallback, seller transactions | Added tenant-scoped priority queue with exact next actions, cutoff timezone, complaints, support, fulfillment exceptions, changed production snapshots and payment review. Confirmed resolution/refreeze/fallback follow-up clears the item | Complete locally |
| 3. Notifications | Transactional inbox/outbox, menu choice maintenance, delivery-change notifications, renewal context | Added payment pending/failure/expiry/exception events; repaired menu and renewal links, concurrent maintenance dedupe and eligibility; stale queued pushes suppressed | Complete locally; provider/device delivery unverified |
| 4. Payment and earnings clarity | Checkout recovery, delivery-earned settlement/reporting, legacy separation, held amounts and payouts | Web/native use confirmed payment state rather than timer for failed/expired recovery; refunded/partial refund no longer imply paid success. Existing earnings UI verified across locales, widths, failures and admin switching | Complete locally; provider settlement reconciliation unverified |
| 5. Delivery problem resolution | Subscription support, seller responses/escalation, admin refund authorization | Added purchased delivery/meal reports, operational replies/resolution, immutable events and version checks. Explicit escalation links to existing admin case/hold rules. Report creation/operational resolution leave money and reservations unchanged | Complete locally; native device operation unverified |

## External verification gates

Hosted Supabase/auth/realtime, SMS/SMTP, Xendit sandbox and device push/payment-return evidence are not established by local tests. Never label these passed. Continue independent local work while external verification remains unavailable.

## Cycle 1 — Restore simple prepaid migration

Implemented an owner-only, one-obligation form in Customers. It accepts an existing customer or creates an accountless customer in the same confirmation transaction as the prepaid delivery schedule. Preview shows actual dates, address, portions and receipt; confirmation requires verification. Editing preserves entered data, and failed confirmation leaves the preview available for retry. Standalone customer creation and external renewal controls remain retired. Invitations use the existing verified-phone claim path and seller-controlled sharing.

Reconnected the existing prepaid PostgreSQL race tests to the main runner; they had not been invoked by the baseline. All 19 PostgreSQL scenarios now pass, including two competing 30-customer imports and claim/checkout races. Focused 22 integration tests pass. Root typecheck passes. Four new browser scenarios pass in ID/EN at 390/1440px, including injected HTTP failure, retry, preview editing and invitation preparation. Browser initially could not find Playwright's bundled binary; rerun using installed Chrome passed. Agent-browser homepage smoke check has content and no reported browser errors. Production build verification is recorded with the commit milestone.

No new database migration or financial behavior change is needed for this restoration. Onboarding/package flows still require broader acceptance verification; P0 #1 is not yet labeled fully complete.

## Cycle 2 — Operational resolution, attention and payment recovery

The baseline support model attached financial cases to subscriptions but had no separate meal-level operational resolution. Added private `delivery_issues` and immutable event history, with actor/tenant checks, request receipts, optimistic versions and transactional serialization. Customers report from a purchased delivery; staff can reply or resolve. Customers can escalate even after a seller marks the report resolved. Explicit escalation copies the history into the existing support case and follows existing hold rules; only the existing administrator flow can decide financial outcomes. Admin resolution also updates the linked operational report. Opening/resolving an operational report does not cancel deliveries, release capacity, hold funds or refund money.

The seller queue derives live exceptions rather than storing another status: complaints, open support, meal fulfillment problems, menu deadlines/fallback, changed production captures and payment review. Each entry has urgency and a destination. Fallback follow-up records dishes/communication only after cutoff and server confirmation, without inventing customer selections. Bounded reads have tenant-specific indexes; direct table access is denied.

Customer payment screens previously offered pending controls for a failed payment whose expiry timestamp was still in the future, and treated refunds as success. Both web/native now branch on server-confirmed state; refunds have explicit labels. Existing settlement arithmetic, fee policy, weekly payout timing and financial topology are unchanged.

Regression evidence: nine beta integration tests, one added customer-choice boundary/retry test, two additional PostgreSQL concurrency scenarios, fourteen beta browser scenarios, and seven new native component tests. Existing settlement and customer-choice suites are also exercised. Fresh seller setup is verified through profile/cutoff/package commands, submission, explicit admin approval and publication; no manual database setup is used for that test.

## Cycle 3 — Security, notification eligibility and audit recovery

Review found a nullable-user authorization hole in legacy `support.escalate` for accountless cases. The public command now positively requires case ownership or tenant staff before delegation; regression rejects an unrelated customer. Permanent history and existing administrator permissions remain intact.

Maintenance now serializes reminder generation, preserves historical dedupe markers, uses the offer timezone for tomorrow, excludes live renewal checkouts, and links renewal directly to `/renew/:id`. Customer-choice reminders recheck date, fulfillment and saved selections after locking. Accountless obligations do not consume future claimed-user reminders. The jobs worker rechecks eligibility before sending payment/menu/renewal pushes, suppressing stale queued events; generic delivery/support event notifications retain their historical-event meaning. No push, email or SMS was actually sent.

Browser audit initially produced 31 passes / 9 failures: eight stale selectors chose a new grouping header instead of an order row; one real synthetic-data defect produced non-RFC UUIDs rejected by API validation when adding a library dish. Updated the order selector without removing assertions, corrected deterministic fixture UUID generation, and added a regression validating all seeded dish IDs. This correction affects explicitly synthetic conversion only; existing persisted demo databases should be replaced with a fresh isolated directory for this test, not reset in place. Full rerun recorded below.

The first complaint browser run also exposed a nonexistent accessibility test selector (`.shell-main`); corrected to the actual `main` landmark and both locale scenarios passed. Visual review covered the mobile prepaid and issue pages; serious/critical accessibility violations are asserted for the new complaint flow, with complete axe assertions in the broader usability flow. Support empty-state copy now distinguishes subscription/financial cases from delivery reports.

## Deployment and remaining gates

Apply `20260917131119_beta_operations.sql` after existing migrations in an authorized staging environment before deploying the jobs worker that calls `notification.eligible`. The migration and local bootstrap SQL are identical. This work has NOT applied hosted migrations, pushed Git, deployed, sent customer communications or exercised real payments/refunds/payouts. Existing hosted pilot remains untouched.

Required external follow-up: hosted Supabase auth/RLS/realtime and verified-phone invitation claim; SMS/SMTP delivery; Xendit sandbox webhook/recovery/refund/payout reconciliation; authenticated device push and payment-return handling. Android `adb devices` reports no device/emulator connected. iOS/Android Jest and export checks are code evidence, not physical-device evidence. Use the release gates in RUNBOOK.md before production.

Local commits isolate goal changes; unrelated preexisting seller workspace changes remain in the working tree. Browser evidence uses the combined current workspace, so it is not proof of a clean deployment from these commits alone. A clean release candidate must intentionally include/review the remaining workspace changes and rerun its gates.

## Final local verification — September 17, 2026

- `npm run typecheck`: PASS (web, native and root TypeScript).
- `npm test`: PASS, 194 tests in 27 files.
- `npm run build`: PASS, optimized Next.js production web build.
- `npm run test:postgres`: PASS, 21 recorded scenarios in fresh embedded PostgreSQL, including prepaid races, meal reports, immutable history and concurrent maintenance. Evidence copied to `output/beta-improvement/postgres-final.json`.
- `npx playwright test -c playwright.beta.config.ts` with installed Chrome, port 3027 and fresh explicit synthetic storage: PASS, 40/40 in 2.8 minutes. Includes 14 beta scenarios, 2 customer-choice scenarios, seller workspace, 12 settlement scenarios and 11 usability/onboarding scenarios, ID/EN and widths 360–1440 where applicable. Previous failures and fixes are recorded above.
- Native Jest iOS preset: PASS, 39 tests / 9 suites. Android preset: PASS, 39 tests / 9 suites. `npm run native:export`: PASS, both iOS and Android bundles. No connected device; no physical-device claim.
- Agent-browser homepage smoke check: PASS, loaded content and no reported browser errors. Migration/local SQL hashes match; `git diff --check` and scoped cached diff review PASS.

Completed local audit priorities: permission bypass, transactional report history, stale reminder recovery, broken payment-state recovery, synthetic fixture/API mismatch, and relevant responsive/accessibility checks. No additional concrete high-value defect remains from this bounded audit. The next work is the authorized staging/provider/device gate sequence above, followed by a deliberately assembled clean release candidate.

Commit 1: `927beab` — restore simple prepaid customer migration. Commit 2: scoped beta operations, notification eligibility, payment recovery, security regression and verification documentation (see Git history for its generated SHA).
