# Customer-choice packages

September 14, 2026. Responsive web implementation; hosted rollout is separate.

`menuSelectionMode: caterer | customer` is additive to the two existing package types. Missing values retain caterer selection. Customers choose after activation, by delivery day and meal, for all purchased portions. Choices cost no extra and must use distinct dishes within the purchased category slots.

## Ownership and interfaces

- `package-options?packageId=…` returns current options, including retired entries only to authorized seller staff. Published options are publicly readable; suspended options remain readable to purchasers. Package copies do not automatically follow source library edits.
- `package.save` accepts `choiceDishIds` for atomic draft setup/publication. The published library changes through `packageOption.save` with package ID, source dish ID for addition, or option ID/version and explicit refresh/archive flags. Every version retains its details. Removing too many active choices rejects the transaction.
- `customer-menu-month` accepts subscription ID, month and meal. It returns purchased delivery dates, authoritative cutoff/editability, selection versions and current package options.
- `customerMenu.saveBatch` accepts subscription ID, meal, delivery IDs/dates/delivery versions/menu versions, and slot-to-option ID/version choices. `customerMenu.resetBatch` accepts the same targets without choices. Commands are authenticated, owner-scoped, idempotent and atomic. Complete saved menus contain server-copied details. No customer-provided name, serving or photo is trusted.
- Historical dishes are retained only for the same saved slot. Multi-date saves are new selections and require active current options. Stale editors reject with conflict/option-changed errors. Rescheduling retains selection identity and requires a fresh delivery version.

## Fulfillment and notifications

Delivery rendering is the common source for customer details, seller operations, production groupings and frozen manifests/CSV. It chooses customer-specific contents for the subtype and leaves existing caterer packages on their prior resolver. Unchosen meals use `pending` before cutoff and `caterer_choice` afterward, with empty dish lists. Portions and reservations are unchanged. Notification maintenance never grants extra editing time.

Activation creates an in-app notification. Existing maintenance sends one reminder within 24 hours of cutoff and notifies customer and seller staff when fallback applies, deduplicated per delivery date and meal. Existing push delivery continues where configured. No new provider or native selection screen is added.

Native consumers display the resolved selection status. New menu notification links resolve to the native subscription, which offers an explicit browser link to the web selector; web authentication remains independent.

## Migration and verification

The forward migration is generated from `packages/backend/src/customer-choice.sql` with `node scripts/compile-customer-choice-migration.mjs`. It adds private RLS-enabled option, option-version and customer-menu tables and extends existing RPCs without rewriting historical purchases or menus. The demo loader applies it only to explicit synthetic storage.

Run root typecheck, unit/integration tests, build, PostgreSQL concurrency checks and native compatibility tests. Browser verification uses `playwright.customer-choice.config.ts`, a fresh synthetic database and port 3136. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium browser when the Playwright browser bundle is unavailable. Screenshots and traces are under `output/customer-choice`.

Local evidence: production build passed; 116 unit/integration tests passed; 13 PostgreSQL verification scenarios passed, including customer menu save/retirement/reschedule/cancellation/production races and private-table access. Nine browser scenarios passed, including the complete seller configuration → purchase → customer selection → delivery/CSV flow and seven existing seller-menu regressions. A final focused pass confirmed customer picker focus restoration and refreshed phone/tablet/desktop screenshots. Serious/critical accessibility checks and horizontal-overflow checks passed. iOS and Android compatibility suites each passed 32 tests. Physical-device and hosted behavior remain unverified.

Apply the forward migration to the separate V1 database before deploying consumers. Verify private grants, authorized RPC behavior and the existing `/api/jobs` maintenance schedule on that target. Follow `docs/RUNBOOK.md`; the hosted pilot, provider configuration and production data are not changed by local verification.
