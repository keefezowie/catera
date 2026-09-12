# Catera V1 implementation record

September 11 — ID 0006: seller Today owns meal-specific fulfillment and atomic multi-order updates; Schedule owns the calendar/package dashboard and whole-day production/CSV. Seller reads now carry customer identity and timezone-aware operational dates; a bounded calendar aggregate and tenant/version-checked bulk command share the forward migration and synthetic demo implementation. Verified: 96 unit tests, typecheck/build, Android/iOS export, ten PostgreSQL checks, and ten related browser scenarios across final/focused runs. See [seller operations](SELLER-OPERATIONS.md) for behavior and reproduction. No hosted deployment.

September 11 — ID 0003 visual follow-up: the menu calendar expands into a visual package card with large category slots, drag-first desktop assignment, automatic next-slot selection, a filtered library, phone tap selection, and shared icon-led optional nutrition. Per-dish text fields and the legacy editor branch are removed. Explicit synthetic data is normalized transactionally; the local demo now has 14/14 catalog packages and 19/19 selectable revisions on the same model. Verified: 96 unit tests, 17 related browser scenarios in one combined run, ten PostgreSQL checks, typecheck, build, Android/iOS exports and two identical disposable baseline restores. See [behavior and evidence](SLOT-MENU-CALENDAR.md). No hosted data, migration or deployment was changed.

September 11 — ID 0003: both package types now define category slots; dated dishes and nutrition are maintained in a monthly Menu workspace with an integrated categorized library. Batch saves use one transaction and revision/version checks; pending menus remain purchasable and historical purchases remain unchanged. The additive migration also supports databases that already have the recurring-capacity wrapper. Verified locally: web/Expo typecheck, 88 unit tests, production build, Android/iOS export, 15 relevant browser scenarios across the final targeted runs, and eight PostgreSQL concurrency/security scenarios. Desktop/phone evidence and SQL results are under `output/slack-bugs/0003/`. See [slot menu behavior and interfaces](SLOT-MENU-CALENDAR.md). No hosted deployment or physical-device certification is claimed.

September 10 follow-up: reusable caterer dishes, component-first nasi box editing, photo previews, guarded wizard navigation, incomplete draft saving and customer listing previews are implemented. See [implementation and verification](REUSABLE-DISHES.md), including the forward migration and separate hosted/device gates.

Updated September 9, 2026. This record supersedes pilot policies in archive/pilot. It describes the implementation; it does not certify production launch.

## Implemented foundation

September 10: the approved animated bento now serves major web/native loading states. See [mascot implementation and verification](MASCOT-MOTION.md) for artwork provenance, accessibility behavior, local evidence and outstanding physical-device checks.

The follow-up moves web chrome into a persistent marketplace layout so route loaders replace only main content. Eye poses blend smoothly, decoded artwork switches without a blank frame, and reduced-motion loading labels remain visible. Server page guards and per-navigation catalog reads remain in place.

- npm workspaces: apps/web (Next 16.3.4), apps/customer (Expo 57 / React Native 0.86), shared domain, API client, backend, design tokens and brand packages.
- The old source, tests, scripts and documents are preserved in archive/pilot. No hosted pilot code, project data or deployment was changed. The pilot Supabase reference is explicitly refused by the V1 backend.
- The lockfile was repaired. A fresh directory containing only workspace manifests and package-lock.json successfully ran npm ci, installing 1295 packages on Node 24.14.1. Evidence: output/install-verification.json.
- npm run dev explicitly opts into persistent synthetic PGlite storage. Hosted mode requires Supabase; missing configuration never selects demo storage.

## Web and native surfaces

September 10 package contents: caterers can publish single/multiple-dish à la carte and structured nasi boxes with custom component slots, serving descriptions and optional per-meal macros. Web/native detail, comparison, checkout and delivery views share the structure; production and CSV include every dish. Immutable content revisions separate later purchases from dated menus for existing commitments. See [package contents implementation and evidence](PACKAGE-CONTENTS.md).

Public discovery supports area priority, search, meal filters, fixed/flexible/trial filters, package detail, seller profiles, price comparisons at a shared quantity, upcoming menus and purchase-linked reviews. Customers have a global account and calendar across caterers, independent from seller workspaces.

Checkout reviews fixed portions, start date, address, generated delivery dates, discount/promotion, included delivery, service fee and terms. The reviewed quote is checked again transactionally to prevent silent price changes. Web session storage and native SecureStore retain drafts; server checkout IDs retain payment state. /return/ID offers native and web continuation and never asserts payment success.

Subscriber home puts the next meal and a lunch/dinner agenda before flat active subscriptions. Date changes use server availability and a review step; daily address changes apply to linked meals. Remaining delivery days, delivery statuses, support history, messaging, purchase-linked reviews and explicit renewal are present on web/native. Native has five Expo Router tabs, phone OTP, secure sessions, payment recovery and push registration.

Seller web provides day/meal context across schedule, production and delivery, portion totals including trials, immutable production revisions, print/CSV manifests, guided package editing, dated menus, capacity, verification, customer relationships, messages/support, transactions and staff invitations. Lunch and dinner fulfill independently while retaining one daily capacity commitment. The admin has true pending verification and all-seller views, reasoned decisions, support/refund review, manual payout approval/reconciliation, promotions, review moderation and audit.

## Domain and transaction boundary

The v1 schema is separate from pilot tables. PostgreSQL security-definer RPCs expose explicit resources and commands with a fixed empty search path. Business tables have RLS and no direct client writes. Authenticated identity comes from Supabase; seller membership and platform-admin checks are re-evaluated inside transactions. Command request IDs retain results and reject payload changes. Purchased terms and production snapshots reject rewriting.

Package rows serialize one shared recurring capacity across selected operating weekdays; actor locks serialize customer entitlements. Existing date-specific capacity rows remain honored as read-only legacy overrides. All scheduled dates reserve together. Combined packages reserve portions once/date, not once/meal. Replacement capacity is acquired before the old date is released. Duplicate dates, active/pending overlaps, cutoff violations, out-of-area addresses, trial reuse and capacity reductions below bookings are rejected. Closures affecting bookings require resolving those bookings first.

Xendit calls are isolated in packages/backend/src/payments.ts. Payment sessions use a 15-minute checkout deadline bounded by cutoff; an adapter refuses sessions below the provider's minimum window. Callback tokens, payment/request IDs, amount/currency and event deduplication are checked. Delayed payment reacquires the full reservation or creates a visible payment exception. Redirects cannot activate a subscription.

Cancellation requests retain reservations and hold disputed seller allocations. Caterers respond; only Catera admins authorize refunds or cancellation. Refund execution and split reconciliation remain separate. Admin reconciliation records seller deductions, provider evidence, reasons and audit. Payout approval allocates only available, undisputed funds; failures restore allocations only once. Commercial policies must be approved configuration; the local fee examples are fictional.

A transactional outbox persists notification and financial jobs with leases, retries and deduplication. Persistent inbox and Expo push share event provenance; push tickets are checked and invalid tokens removed. A minimal RLS-protected public event table emits only user ID/topic for scoped Supabase Realtime invalidation. No blanket full-workspace polling remains; payment status has a scoped pending-checkout refresh. Catalog and message/history reads are bounded; calendars use date windows. Large-scale admin/customer-history pagination needs further expansion before high-volume operation.

## Migration and legacy import

Apply the five 20260909 V1 migrations followed by the forward package-contents, reusable-dishes, calendar, slot-menu, and shared-recurring-capacity migrations to a separate V1 project. Historical migrations are frozen: scripts/compile-migration.mjs now checks their sources and generates only the new contents migration. Once deployed, append another migration for further changes. The old 202609080001_core.sql is pilot history, not the V1 setup path. Local demo startup applies the contents upgrade once and does not replay old service definitions over it.

Legacy import is seller-only, explicit preview then confirmation. It validates customer/package/address, remaining days, fixed portions and external receipt reference. Preview reserves nothing. Confirmation acquires every remaining date transactionally and creates a labeled legacy subscription without inventing a new payment or seller allocation. It does not automatically ingest the hosted pilot.

## Brand deliverables and limits

Sixteen identity/illustration PNGs and six food photographs were generated individually. No board crops, sprites or enlargement of the reference were used. Exact prompts, reference provenance, intended uses, actual dimensions, hashes and font licensing are in packages/brand. /brand exposes reusable individual files; shared components consume the assets and tokens.

The generator returned 1254-pixel square masters and 2172-pixel-wide wordmark/horizontal masters, below the requested 2048/4096 targets. On September 10, fifteen reusable identity PNGs were converted to true-alpha derivatives at their original dimensions. The original opaque masters and prompts are retained in packages/brand/masters; the square app icon stays opaque. Decoded alpha verification and contrasting-background contact sheets cover the cutouts. Platform-specific icon export packs and larger generated masters remain outstanding. Food photographs are 1448 x 1086 and may be used only in synthetic listings.

## Verification and unverified gates

September 10 document fixes: catalog navigation now uses English homepage anchors (`/#packages` and `/#how-it-works`); `/discover` permanently redirects to the catalog anchor. Web selectors share a styled, portaled Radix component with keyboard navigation and responsive positioning. Hosted login supports email/password alongside phone OTP and chooses the destination from the database role. Four synthetic accounts were provisioned transactionally in the separate Catera V1 Supabase project; private credentials are stored only in ignored `.data/demo-accounts.json`. See [document-fix evidence](FIXES-2026-09-10.md) for verification and remaining limits.

September 11 live-like demo: the separate Catera V1 project received the package-contents, reusable-dishes, and calendar-metadata forward migrations, then baseline `2026.09.11.1`. The generated data models full customer, operations, support, review, refund, payout, and admin journeys while preserving the four authenticated demo accounts. Operational date and meal-period controls now render as independent 44px fields with a 12px token-based gap. Reset and private recovery steps are documented in [V1-DEMO-BASELINE.md](V1-DEMO-BASELINE.md); the historical Catera Demo pilot remains excluded.

The same fixes now extend to native: scrollable accessible selection sheets, language selection before login, localized navigation/discovery/login/account controls, same-screen discovery/explanation scrolling, and single-session Supabase password authentication. Customer returns retain checkout context; operational roles land on the account screen with an explicit web-workspace handoff. See [native-fix evidence](NATIVE-FIXES-2026-09-10.md).

Local evidence includes typechecking, 40 domain/database/provider tests, real PostgreSQL concurrency tests, customer/seller/admin Playwright journeys, WCAG serious/critical checks on account, responsive captures at 390/768/1440, native component tests under both iOS and Android presets, a Next production build and both native bundle exports. See output/verification, output/install-verification.json, output/V1-FINISH-REVIEW.md and output/V1-FINISH-VERDICT.md.

The reviewer scored all four web corrections resolved; the historical disposition was fix because true-alpha artwork was outstanding. The September 10 alpha cleanup resolves that asset defect; it does not certify the other release gates. Native controls were corrected to 48 dp in source, but no native simulator/device screenshots or signed Android/iOS build were available. Exports and component tests must not be presented as physical device proof.

Not verified: hosted Supabase migration/RLS/realtime, SMS/SMTP delivery, an actual Xendit sandbox or merchant transaction, provider settlement topology and reconciliation, EAS development builds, native return links/push on devices, backup restoration and production alerts. English exists for navigation and major customer paths; complete operational/native copy coverage and locale-specific visual QA remain a release task. See the runbook for launch gates.

## Continuous web meal calendar — September 10, 2026

The web calendar now separates continuous date browsing from selection, exposes lunch/dinner coverage and selected-week counts, and supports date/today/next-delivery jumps plus a chronological upcoming agenda. Compact date cards use Sunrise sun and forest moon icons as the sole visual coverage cue, with active-package counts beside them; the redundant checklist, labels and footer rail are removed. Selection preserves coverage with a forest ring, while today retains its Sunrise marker. Month requests are cached and errors remain distinct from empty days. The additive calendar metadata migration scopes next/last upcoming dates to the authenticated customer. Expo remains unchanged. See [MEAL-CALENDAR.md](MEAL-CALENDAR.md) for behavior, API, verification evidence and migration ordering.

# Package presentation update — September 10, 2026

Responsive web and Expo package cards now share concise composition/nutrition formatting, prominent seller/duration hierarchy, labeled comparison and direct contents links. Package details use an opt-in dish gallery with enlarged photo viewing; the standard contents presentation remains in checkout and purchased records. See `docs/PACKAGE-CONTENTS.md` for behavior and `output/package-presentation/verification.json` for local acceptance evidence. Existing uncommitted changes and stored purchase semantics were preserved. This update does not deploy or migrate hosted services.

# Web usability sweep — September 12, 2026

Implemented the approved five-step package wizard, persistent draft/navigation controls, compact photo tools, discovery-label chips, responsive order cards, owner readiness checklist, guided prepaid importer, grouped seller navigation, menu saving context, messages/support tabs, shopping-only comparison controls, and simpler delivery/admin details. The additive owner-scoped import-options read and authorized display-name joins are validated in disposable databases. Existing financial commands, purchased snapshots, tenant boundaries, and the hosted pilot remain intact.

Local verification includes root typecheck, 106 unit tests, production build, PostgreSQL concurrency checks, and 48 focused browser tests across the affected journeys. Phone/tablet/desktop and both languages are covered, with zoom-equivalent reflow and accessibility checks. See [CATERA-USABILITY-SWEEP.md](CATERA-USABILITY-SWEEP.md) for findings, screenshots, test evidence, migration ordering, and the five-caterer study protocol. The representative-user study and hosted deployment remain outstanding. Native development is paused.
