# Catera improvement log

> September 22 integration: see [V1 worktree integration](V1-WORKTREE-INTEGRATION-2026-09-22.md) for the combined implementation, superseded overlaps and fresh verification. Earlier no-push statements below describe their original work sessions.

## September 26, 2026 — V1 UI/UX audit remediation

The audit is treated as evidence, not an instruction source. `PRODUCT.md`, the
current V1 contracts, and the approved web-first scope remain authoritative.
Work is isolated from the dirty root in the managed
`codex/uiux-audit-remediation` worktree at audit commit
`9b9f9713a45e1ffe5df97e179d352e99945fca05`. All browser work uses explicit
loopback synthetic storage; no hosted data, migration, deployment, push, or
provider transaction is part of these results.

| Audit item | Classification | Remediation / validation status |
| --- | --- | --- |
| M1 package lifecycle truth | Confirmed | Implemented locally: seller wording now states permanent closure, existing obligations, and no reopening while retaining the compatible `package.suspend` command. The named confirmation and cancel-without-command path pass browser coverage. |
| M2 customer menu states | Confirmed | Implemented locally: public examples no longer reuse the seller dish library, internal/empty taxonomy is hidden, and post-payment due, saved, missed-cutoff caterer choice, unannounced, example, all-portions, and no-menu-fee states are distinct. Domain and customer-choice browser tests pass. |
| M3 purchase commitment | Confirmed | Implemented locally: one derived contract now supplies discovery, comparison, detail, checkout, quoted breakdown, and renewal. Unknown fees remain unknown until quote; delivery, address eligibility, upfront payment, and manual renewal are explicit. The mobile summary appears only after the primary purchase panel has passed above the viewport. |
| M4 customer Home | Confirmed | Implemented locally: the authorized customer-action feed returns only the signed-in customer's menu, payment, and unresolved-delivery actions in stable priority order. Home shows the top three with inline expansion, groups upcoming meals by date and caterer, uses active (not historical) subscriptions for its empty state, and exposes compact balances with renewal. Customer isolation, seller cross-tenant denial, structured filtering, and more-than-100 keyset pagination pass local database tests. |
| M5 delivery recovery | Confirmed | Implemented locally: delivery detail is the canonical management surface, with meal statuses, exact timezone cutoff, one primary schedule action, bounded availability with disabled dates/reasons/earliest replacement, and a complete old/new review. Final server revalidation and the existing atomic reservation command are unchanged. |
| M6 seller operational scope | Confirmed | Implemented locally: date, meal, package, status, and search now share one compact inline scope while calendar/grouping and the whole-day production export remain separate. Stage quantities filter the URL-addressable table and report selected stage, visible rows, orders, and portions. Bulk changes require a date/meal/source/destination/order/portion confirmation, exclude and explain incompatible selections, and retain selection/context after an atomic conflict. |
| M7 complete exception reachability | Confirmed | Implemented locally: seller attention defaults to the selected day and top three, offers selected/future/all plus meal scopes, and uses structured date, meal, package, destination, and delivery fields. “Lihat semua masalah” expands the queue and continues through opaque keyset pages. Local authorization/pagination tests reach more than 100 eligible records exactly once. |
| M8 payment/resource recovery | Confirmed | Implemented locally: shared reads expose `phase`, `hasData`, and stale-data state; delivery/payment keep stale data visible while disabling unsafe mutations. Payment derives preparing, awaiting, checking, paid, expired, and booking-unresolved views with an order reference and one safe next action. Uncertain states never expose hosted fallback or another-payment guidance. |
| P2 consistency and native parity | Validation-only until P1 passes | Web polish and a native parity backlog follow the P1 acceptance gates; native implementation remains deferred. |

Slice-one local evidence: 21 focused domain/integration tests pass; customer menu
browser flow passes 2/2; package-presentation checks pass after a focused sticky
summary rerun; seller lifecycle cancellation passes. Generated browser output is
local evidence only and is excluded from commits.

Delivery/payment slice evidence: 29 focused domain/provider tests pass; the full
purchase-to-reschedule/support/renewal browser journey passes against fresh
synthetic storage; payment-state and direct-payment recovery pass 17/17 across
ID/EN, 390/1440, BRI VA, QRIS, expiry, uncertainty, and visibility polling.

Customer/seller action evidence: 11 focused domain/read-model tests pass,
including customer isolation, cross-tenant denial, structured scopes and 105+
exception pagination. Customer Home passes desktop/mobile rendering and critical
accessibility checks. Seller scope passes 1440/768/390 ID/EN control checks; the
isolated three-order fixture passes stage/search filtering, explicit batch review,
atomic-conflict selection retention, and whole-day export/accessibility coverage.

## September 19, 2026 — V1 end-to-end polish

This objective supersedes feature expansion. Preserve the approved functionality,
brand, navigation, authorization and commercial rules. Missing capabilities are
deferred, not implemented as part of polish. All writes and transactions below
use disposable local synthetic data. No deployment, remote Git write, shared
database mutation, real payment or customer communication is authorized.

Checkout verified: `keefezowie/catera`, local `v1` and remote `v1` both
`eae0b504f775ae29411522090ea116882f18e690`, original working tree clean.
Work is isolated in `D:/Project/Catera/catera-polish-v1` on
`codex/v1-end-to-end-polish`. Impeccable is not installed; review follows
AGENTS.md, PRODUCT.md, DESIGN.md, the surface brief and installed Next.js docs.

### Baseline and evidence

- Fresh locked dependency install; root typecheck and production build pass.
- PostgreSQL: all 21 concurrency/security scenarios pass against a disposable database.
- Unit suite: 193 pass, 1 fails (`paid-pilot`, cutoff rejection). The test used
  a non-operating Saturday; T01 below corrects its fixture without changing rules.
- Browser smoke: explicit synthetic instance on port 3130, fresh `.data/polish-main`;
  discovery renders with no reported browser errors. Screenshot:
  `output/polish-v1/before-discovery-desktop.png`.
- Broader baseline: diagnostic run, with failures retained. Reproducible local-only runner:
  `playwright.polish.config.ts`; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the
  installed Chrome binary. Reports and matching screenshots use `output/polish-v1/`.

### Journey checklist

| Journey | Existing capabilities to operate | Review / verification status |
| --- | --- | --- |
| Customer discovery | Area, search, filters, comparison, seller profile, package contents/prices | Reviewed and passed: discovery, guest-auth, navigation, package-presentation and new filter/back tests |
| Customer purchase | Guest return, portions/duration/address, quote/review, payment pending/failure/retry | Reviewed and passed: journeys, multi-cycle, payment-state, contents and PostgreSQL capacity/snapshot tests |
| Customer ongoing meals | Home, calendar, menu choice, date/address changes, cutoff/eligibility | Reviewed and passed: calendar, customer-choice, delivery changes, conflict recovery and production/CSV contents |
| Customer relationships | Messages, delivery report, support/escalation, renewal, account/notifications | Reviewed and passed: beta-issues, conversations/retry, renewal, route/accessibility and inbox eligibility integration tests |
| Seller onboarding | Profile/readiness, verification request/correction, staff restrictions | Reviewed and passed: readiness correction/submission/admin decision, profile/settings, workspace-role and authorization checks |
| Seller catalog | Draft/resume/publish/suspend/archive, duration choices, menus/dish library | Reviewed and passed: dishes, slot-menus, contents, package pricing, lifecycle integration/concurrency and responsive wizard tests |
| Seller daily operations | Today/bulk statuses, schedule/group/filter, production revisions/CSV | Reviewed and passed: bulk conflict selections/retry, independent lunch/dinner statuses, date/filter focus, production revisions/whole-day CSV, desktop and phone accessibility |
| Seller relationships | Customers/prepaid obligations, invitations, conversations, reports/support | Reviewed and passed: prepaid preview/failure/retry, customer changes, invitations, delivery reports, first-message and recipient-isolation checks |
| Seller finances/account | Transactions/earnings, bank review, settings/account | Reviewed and passed: ID/EN at 360/768/1440, reporting errors, bank/account-help separation, private-access and settlement concurrency checks |
| Admin | Verification, listings/reviews, transactions/support/refunds, settlement/payouts, audit | Reviewed and passed: route coverage, record-isolated decisions, bank-review recovery, earnings/caterer switching and financial authorization integration checks |
| Shared surfaces/states | Form recovery, dialogs/pickers, focus, loading/error/empty, responsive ID/EN | Reviewed and passed: widths 320–1440 where applicable, 200% text, keyboard/focus, reduced motion, long content, failed reads/writes and axe assertions |

### Prioritized findings

Only reproduced issues become implementation work. Each completed item records
before evidence, user impact, acceptance checks, after evidence and status here.

| ID / priority | Reproduced evidence and user impact | Acceptance / implementation | Status |
| --- | --- | --- | --- |
| P01 / high | `before-admin-record-768-id.png`, `before-support-record-768-id.png`: another caterer's verification reason or another support case's refund amount/cancellation checkbox followed the selection. | Remount decision forms by record identity; lock record switching during submission; preserve failures on the same record. ID/EN tests assert reason/amount/checkbox isolation. No financial rules or database mutations changed. | Implemented; targeted browser pass |
| P02 / high | `before-pending-form-390-id.png`: text/numeric/checkbox controls could change after request values were captured, while Save showed processing. | Shared field primitives follow existing form pending context; retry re-enables fields with entered values intact. Existing selectors/date controls already use this context. | Implemented; targeted browser pass |
| P03 / high | `before-conversation-recipient-id-customer.png`: a draft for A appeared under B; sent text also remained available for accidental resubmission. `before-new-conversation-pending-390-id.png`: seller recipient selection remained enabled during the first send. | Keep per-recipient drafts, clear only after confirmed success, preserve failed drafts, guard recipient/search changes during send; localize the label and keep composer/recovery readable on phone. | Verified; customer/owner ID/EN, pending first-send failure recovery and axe pass |
| P04 / medium | `before-filter-reset-390-id.png`: Reset retained Nasi box. Filters also reset on returning from details. | Reset every filter, retain area/sort, store filters in native URL history, expose active count/reset even when collapsed, announce selected meal filters. | Implemented; ID/EN at 390/768/1440 pass |
| P05 / high | `before-customer-filter-error-768-id.png`: Needs renewal selected, failed read, but five old customer cards remained actionable as if matching. | Shared resource reads expose data only for the current key, reject late results, preserve same-resource refresh state. Customer filter/back controls survive errors. The tenant-keyed operations shell alone retains old data, masks dated rows/metrics and preserves calendar focus while loading. | Verified; changed-filter failure/retry and operational date focus/loading/failure/retry pass |
| P06 / medium | `before-admin-refresh-id.png`: failed post-save refresh was silent. Review read failures incorrectly showed “No reviews yet.” | Inline refresh errors with retry keep the current draft; reviews explicitly distinguish loading, failure and confirmed empty history. | Verified; ID/EN refresh/input and gated loading/error/empty retry checks pass |
| T01 / baseline check | 193/194 unit tests passed: cutoff test used today on a non-operating Saturday and correctly advanced to Monday. | Use a date one week in the past so the first eligible service day is deterministically past cutoff; retain the no-obligations assertion. | Verified; all 194 tests pass |

The initial broad browser baseline was interrupted after concrete defects were
reproduced; it is not a full passing baseline. It also exposed stale tests for
retired promotion creation/customer ID disclosures and selectors matching hidden
Next.js retained route trees. Updated tests exercise the active bank-review dialog
with the same pending/dismissal/retry assertions, current customer schedule access,
and visible content. Original failures remain in local reports. No assertion is
removed to accept a product failure.

The first diagnostic whole-suite run had 148 passes, 13 failures and three
fixture-dependent skips. Repeated delivery-report fixtures, outdated labels,
hidden retained route trees and a brief development compile error account for
those failures; each affected current journey was rerun. The resource change
also exposed loss of date-control focus; the fix retains the tenant's navigation
shell while masking stale operational rows, and has a dedicated regression test.
The fresh final run passes all 163 general scenarios. Its three explicit fixture
skips are run separately below. No retries or assertions were relaxed.

### Before/after evidence

These local screenshots were inspected. Use the same locale/viewport and
synthetic interaction when comparing; message recipients and support cases use
deterministic intercepted fixtures. Larger seeded screens can include additional
synthetic records created by the full journey tests.

| Change | Before | After |
| --- | --- | --- |
| Recipient drafts and phone composer | [Before](../output/polish-v1/before-conversation-recipient-id-customer.png) | [After](../output/polish-v1/after-conversation-recipient-id-customer.png) |
| First-message recipient locking | [Before](../output/polish-v1/before-new-conversation-pending-390-id.png) | [After](../output/polish-v1/after-new-conversation-pending-390-id.png) |
| Support decision isolation | [Before](../output/polish-v1/before-support-record-768-id.png) | [After](../output/polish-v1/after-support-record-768-id.png) |
| Pending form values | [Before](../output/polish-v1/before-pending-form-390-id.png) | [After](../output/polish-v1/after-pending-form-390-id.png) |
| Complete filter reset | [Before](../output/polish-v1/before-filter-reset-390-id.png) | [After](../output/polish-v1/after-catalog-reset-390-id.png) |
| Failed customer filter | [Before](../output/polish-v1/before-customer-filter-error-768-id.png) | [After](../output/polish-v1/after-customer-filter-error-768-id.png) |
| Failed reviews read | [Before](../output/polish-v1/before-reviews-error-390-id.png) | [After](../output/polish-v1/after-reviews-error-390-id.png) |
| Failed admin refresh | [Before](../output/polish-v1/before-admin-refresh-id.png) | [After](../output/polish-v1/after-admin-refresh-id.png) |

### Final local checks

- `npm run typecheck`: PASS for web, native and root TypeScript.
- `npm test`: PASS, 194 tests / 27 files.
- `CATERA_NEXT_DIST_DIR=.next-polish-build npm run build`: PASS, optimized web build.
- `npm run test:postgres`: PASS, 21 scenario groups in disposable embedded PostgreSQL; evidence `output/polish-v1/postgres-final.json`. No business SQL changed.
- `npx playwright test -c playwright.polish.config.ts`: PASS, 163 general scenarios in 9.1 minutes using installed Chrome, port 3130 and fresh `.data/polish-final`. Report: `output/polish-v1/final-journeys-report/index.html`.
- Strengthened gated review loading/error/empty tests: PASS, 2/2 ID/EN; `output/polish-v1/review-states-final.log`.
- Dedicated `seller-operations.spec.ts` fixture: PASS, 3/3 in 20.4 seconds with `CATERA_OPS_TEST_URL=http://127.0.0.1:3130`; `output/polish-v1/operations-verified-report/index.html`. The first run reproduced an outdated selector counting group headings as orders; it now counts selectable order rows and preserves all bulk/conflict assertions. Explicit synthetic directory `.data/seller-operations-test`, seeded by `tests/fixtures/seller-operations.mts`; the server was switched only after the general run stopped.
- Agent-browser discovery smoke: rendered controls and no reported browser errors. Before/after image review and scoped diff review completed; final `git diff --check` recorded with the commit.

Local evidence stays under `output/polish-v1/`; logs/traces and generated Next.js
paths are excluded from the commit. Source, regression tests, the local-only
runner and this improvement log form the validated change. No remote write.

All mapped web journeys have been reviewed. The reproduced high-impact findings
P01/P02/P03/P05 are fixed and verified locally; no unresolved in-scope defect
remains from this pass. There are 166 distinct passing browser scenarios across
the general and dedicated operations runs. Production/provider/device evidence
is explicitly outside those results.

### External blockers and deferred ideas

Native work remains paused; web screenshots do not verify native UI. Hosted
Supabase/auth/realtime, SMS/SMTP, Xendit, device behavior and representative
caterer learnability remain external verification gates. No missing business
module or new policy will be added to bypass them.

Physical-device/native UI and additional browser engines are unverified; no
native UI was changed. Provider-backed payment/refund/payout dispatch, actual
SMS/email delivery and hosted invitation/auth flows remain blocked by the
explicit no-shared-data/no-real-transaction scope, rather than labeled passed
from mocked or local evidence. Feature expansion, cross-session persistent
message drafts and launch/infrastructure work are deferred. This pass preserves
the approved modules and policies.

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
