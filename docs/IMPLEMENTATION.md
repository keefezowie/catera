# Catera V1 implementation record

Updated September 9, 2026. This record supersedes pilot policies in archive/pilot. It describes the implementation; it does not certify production launch.

## Implemented foundation

- npm workspaces: apps/web (Next 16.3.4), apps/customer (Expo 57 / React Native 0.86), shared domain, API client, backend, design tokens and brand packages.
- The old source, tests, scripts and documents are preserved in archive/pilot. No hosted pilot code, project data or deployment was changed. The pilot Supabase reference is explicitly refused by the V1 backend.
- The lockfile was repaired. A fresh directory containing only workspace manifests and package-lock.json successfully ran npm ci, installing 1295 packages on Node 24.14.1. Evidence: output/install-verification.json.
- npm run dev explicitly opts into persistent synthetic PGlite storage. Hosted mode requires Supabase; missing configuration never selects demo storage.

## Web and native surfaces

Public discovery supports area priority, search, meal filters, fixed/flexible/trial filters, package detail, seller profiles, price comparisons at a shared quantity, upcoming menus and purchase-linked reviews. Customers have a global account and calendar across caterers, independent from seller workspaces.

Checkout reviews fixed portions, start date, address, generated delivery dates, discount/promotion, included delivery, service fee and terms. The reviewed quote is checked again transactionally to prevent silent price changes. Web session storage and native SecureStore retain drafts; server checkout IDs retain payment state. /return/ID offers native and web continuation and never asserts payment success.

Subscriber home puts the next meal and a lunch/dinner agenda before flat active subscriptions. Date changes use server availability and a review step; daily address changes apply to linked meals. Remaining delivery days, delivery statuses, support history, messaging, purchase-linked reviews and explicit renewal are present on web/native. Native has five Expo Router tabs, phone OTP, secure sessions, payment recovery and push registration.

Seller web provides day/meal context across schedule, production and delivery, portion totals including trials, immutable production revisions, print/CSV manifests, guided package editing, dated menus, capacity, verification, customer relationships, messages/support, transactions and staff invitations. Lunch and dinner fulfill independently while retaining one daily capacity commitment. The admin has true pending verification and all-seller views, reasoned decisions, support/refund review, manual payout approval/reconciliation, promotions, review moderation and audit.

## Domain and transaction boundary

The v1 schema is separate from pilot tables. PostgreSQL security-definer RPCs expose explicit resources and commands with a fixed empty search path. Business tables have RLS and no direct client writes. Authenticated identity comes from Supabase; seller membership and platform-admin checks are re-evaluated inside transactions. Command request IDs retain results and reject payload changes. Purchased terms and production snapshots reject rewriting.

Package rows serialize capacity decisions; actor locks serialize customer entitlements. All scheduled dates reserve together. Combined packages reserve portions once/date, not once/meal. Replacement capacity is acquired before the old date is released. Duplicate dates, active/pending overlaps, cutoff violations, out-of-area addresses, trial reuse and capacity reductions below bookings are rejected. Closures affecting bookings require resolving those bookings first.

Xendit calls are isolated in packages/backend/src/payments.ts. Payment sessions use a 15-minute checkout deadline bounded by cutoff; an adapter refuses sessions below the provider's minimum window. Callback tokens, payment/request IDs, amount/currency and event deduplication are checked. Delayed payment reacquires the full reservation or creates a visible payment exception. Redirects cannot activate a subscription.

Cancellation requests retain reservations and hold disputed seller allocations. Caterers respond; only Catera admins authorize refunds or cancellation. Refund execution and split reconciliation remain separate. Admin reconciliation records seller deductions, provider evidence, reasons and audit. Payout approval allocates only available, undisputed funds; failures restore allocations only once. Commercial policies must be approved configuration; the local fee examples are fictional.

A transactional outbox persists notification and financial jobs with leases, retries and deduplication. Persistent inbox and Expo push share event provenance; push tickets are checked and invalid tokens removed. A minimal RLS-protected public event table emits only user ID/topic for scoped Supabase Realtime invalidation. No blanket full-workspace polling remains; payment status has a scoped pending-checkout refresh. Catalog and message/history reads are bounded; calendars use date windows. Large-scale admin/customer-history pagination needs further expansion before high-volume operation.

## Migration and legacy import

Apply only the five 20260909 migrations to a separate new V1 project, in filename order. 202609090003_hardening.sql is generated by scripts/compile-migration.mjs from canonical SQL helpers and the service definitions. Before any deployment, compile it and review the diff; once migrations are applied remotely, append a new migration for further changes. The old 202609080001_core.sql is pilot history, not the V1 setup path.

Legacy import is seller-only, explicit preview then confirmation. It validates customer/package/address, remaining days, fixed portions and external receipt reference. Preview reserves nothing. Confirmation acquires every remaining date transactionally and creates a labeled legacy subscription without inventing a new payment or seller allocation. It does not automatically ingest the hosted pilot.

## Brand deliverables and limits

Sixteen identity/illustration PNGs and six food photographs were generated individually. No board crops, sprites or enlargement of the reference were used. Exact prompts, reference provenance, intended uses, actual dimensions, hashes and font licensing are in packages/brand. /brand exposes reusable individual files; shared components consume the assets and tokens.

The generator returned 1254-pixel square masters and 2172-pixel-wide wordmark/horizontal masters, below the requested 2048/4096 targets. On September 10, fifteen reusable identity PNGs were converted to true-alpha derivatives at their original dimensions. The original opaque masters and prompts are retained in packages/brand/masters; the square app icon stays opaque. Decoded alpha verification and contrasting-background contact sheets cover the cutouts. Platform-specific icon export packs and larger generated masters remain outstanding. Food photographs are 1448 x 1086 and may be used only in synthetic listings.

## Verification and unverified gates

September 10 document fixes: catalog navigation now uses English homepage anchors (`/#packages` and `/#how-it-works`); `/discover` permanently redirects to the catalog anchor. Web selectors share a styled, portaled Radix component with keyboard navigation and responsive positioning. Hosted login supports email/password alongside phone OTP and chooses the destination from the database role. Four synthetic accounts were provisioned transactionally in the separate Catera V1 Supabase project; private credentials are stored only in ignored `.data/demo-accounts.json`. See [document-fix evidence](FIXES-2026-09-10.md) for verification and remaining limits.

Local evidence includes typechecking, 40 domain/database/provider tests, real PostgreSQL concurrency tests, customer/seller/admin Playwright journeys, WCAG serious/critical checks on account, responsive captures at 390/768/1440, native component tests under both iOS and Android presets, a Next production build and both native bundle exports. See output/verification, output/install-verification.json, output/V1-FINISH-REVIEW.md and output/V1-FINISH-VERDICT.md.

The reviewer scored all four web corrections resolved; the historical disposition was fix because true-alpha artwork was outstanding. The September 10 alpha cleanup resolves that asset defect; it does not certify the other release gates. Native controls were corrected to 48 dp in source, but no native simulator/device screenshots or signed Android/iOS build were available. Exports and component tests must not be presented as physical device proof.

Not verified: hosted Supabase migration/RLS/realtime, SMS/SMTP delivery, an actual Xendit sandbox or merchant transaction, provider settlement topology and reconciliation, EAS development builds, native return links/push on devices, backup restoration and production alerts. English exists for navigation and major customer paths; complete operational/native copy coverage and locale-specific visual QA remain a release task. See the runbook for launch gates.
