# Catera beta improvement log

## September 17, 2026 baseline and authorization

Objective: complete the five beta P0 capabilities, then address evidence-backed high-value issues through reproduce, fix, test and review cycles. No shared database writes, real messages/payments, or deployments. Native physical-device and hosted-provider verification require separate environments.

The checkout began with uncommitted seller workspace changes. A baseline patch is retained locally at `output/beta-improvement/preexisting.patch`. Preserve those changes; commits must isolate this goal's work. The user explicitly confirmed restoring a simple prepaid import flow despite the earlier September 17 removal. Other workspace simplifications remain approved.

Baseline checks: root typecheck PASS; 26 Vitest files / 184 tests PASS; production web build PASS; 17 PostgreSQL concurrency/security scenarios PASS in a fresh embedded database. No baseline browser claim yet.

## P0 map and acceptance

| P0 | Existing implementation and evidence | Gap / acceptance | Status |
| --- | --- | --- | --- |
| 1. Onboarding and prepaid migration | Seller onboarding/profile, package wizard and readiness; transactional `paid-pilot.sql` preview/commit, customer claims, invitations; `paid-pilot.test.ts`, `postgres-paid-pilot.mjs` | Restore a simple web flow for existing and accountless customers; review explicit dates/address/portions/receipt before confirmation; no new charge, recoverable failures, duplicate/concurrency tests and browser proof | In progress |
| 2. Needs attention | Today/production, support queue, customer choice fallback, seller transactions | Audit whether exceptions have urgency, next action and working links, and disappear after resolution | Mapping |
| 3. Notifications | Transactional inbox/outbox, menu choice maintenance, delivery-change notifications, renewal context | Audit eligibility, retries, deep links and payment/renewal events with regression evidence | Mapping |
| 4. Payment and earnings clarity | Checkout recovery, delivery-earned settlement/reporting, legacy separation, held amounts and payouts | Verify all money states and recovery; preserve current financial policy | Mapping |
| 5. Delivery problem resolution | Subscription support, seller responses/escalation, admin refund authorization | Check delivery/meal identity and seller operational resolution without financial or reservation side effects | Mapping |

## External verification gates

Hosted Supabase/auth/realtime, SMS/SMTP, Xendit sandbox and device push/payment-return evidence are not established by local tests. Never label these passed. Continue independent local work while external verification remains unavailable.

## Cycle 1 — Restore simple prepaid migration

Implemented an owner-only, one-obligation form in Customers. It accepts an existing customer or creates an accountless customer in the same confirmation transaction as the prepaid delivery schedule. Preview shows actual dates, address, portions and receipt; confirmation requires verification. Editing preserves entered data, and failed confirmation leaves the preview available for retry. Standalone customer creation and external renewal controls remain retired. Invitations use the existing verified-phone claim path and seller-controlled sharing.

Reconnected the existing prepaid PostgreSQL race tests to the main runner; they had not been invoked by the baseline. All 19 PostgreSQL scenarios now pass, including two competing 30-customer imports and claim/checkout races. Focused 22 integration tests pass. Root typecheck passes. Four new browser scenarios pass in ID/EN at 390/1440px, including injected HTTP failure, retry, preview editing and invitation preparation. Browser initially could not find Playwright's bundled binary; rerun using installed Chrome passed. Agent-browser homepage smoke check has content and no reported browser errors. Production build verification is recorded with the commit milestone.

No new database migration or financial behavior change is needed for this restoration. Onboarding/package flows still require broader acceptance verification; P0 #1 is not yet labeled fully complete.
