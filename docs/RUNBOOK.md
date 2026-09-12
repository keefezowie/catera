# Catera V1 operating runbook

Updated September 9, 2026. **Local verification is not production approval.** The hosted pilot remains unchanged. This runbook supersedes `archive/pilot/docs/RUNBOOK.md`.

## 1. Environment boundary

Create separate V1 staging and production Supabase projects, storage, SMS credentials, Xendit credentials and application hosts. Staging uses invented customers and test payment methods only. Never point V1 at the old pilot project, run a demo seed against hosted storage, copy customer fixtures into tests, or replace an existing database to repair a local test. The backend rejects the known pilot reference.

Use Node 24 and the committed npm lockfile. The web application is `apps/web`; build from the repository root with `npm ci` then `npm run build`, or configure monorepo hosting to run the equivalent workspace command with shared package access. The Expo application is `apps/customer`. Do not deploy `archive/pilot` as V1.

`npm run dev` uses the configured Supabase environment by default. Set `CATERA_V1_DEMO=true` explicitly to start persistent, synthetic local storage. Missing Supabase configuration produces an error. Demo identities and payment confirmation endpoints are unavailable in hosted mode. Production deployment is a separate operation and has not been performed.

## 2. Configuration

Copy the example files locally, then enter secrets through the host's protected environment settings. Never add credentials to Git or public Expo variables.

| Server variable | Required use |
|---|---|
| `CATERA_V1_DEMO=false` | Real Supabase persistence and authentication |
| `CATERA_PUBLIC_URL` | Canonical HTTPS V1 web origin, including payment return routes |
| `NEXT_PUBLIC_SUPABASE_URL` | Environment-specific Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and API authentication |
| `SUPABASE_SECRET_KEY` | Server-only service RPC and background jobs |
| `XENDIT_SECRET_KEY` | Environment-specific Xendit API access |
| `XENDIT_WEBHOOK_TOKEN` | Callback verification token |
| `CATERA_XENDIT_ROUTING_JSON` | Approved caterer UUID to account ID / split rule ID routing |
| `CATERA_PAYOUT_RECIPIENTS_JSON` | Approved caterer UUID to recipient and purposeCode configuration |
| `CRON_SECRET` | Bearer authorization for `/api/jobs` |
| `EXPO_ACCESS_TOKEN` | Server-only Expo push security token if enabled for the project |
| `DATABASE_URL` | Private operator migration/backup access only |

Native public configuration is `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_EAS_PROJECT_ID`. These contain no service, payment, SMS or push access secrets. A phone must reach the API URL; its localhost is not the development computer. Configure distinct staging/production builds and validate that the app's API and Supabase project belong to the same environment.

`TEST_DATABASE_URL` is only for a disposable database named `catera_test`. The concurrency runner refuses existing V1 tables and never resets an existing database. `CATERA_SESSION_SECRET` is only for local synthetic sessions.

## 3. Fresh V1 database installation

Before applying SQL, record the project reference, intended environment, operator, migration hashes and backup status. An operator with database-owner access applies **only** these V1 migrations, in this order:

1. `supabase/migrations/202609090001_marketplace.sql`
2. `supabase/migrations/202609090002_services.sql`
3. `supabase/migrations/202609090003_hardening.sql`
4. `supabase/migrations/202609090004_storage.sql`
5. `supabase/migrations/202609090005_realtime.sql`
6. `supabase/migrations/20260910120930_package_contents.sql`
7. `supabase/migrations/20260910130548_reusable_dishes.sql`
8. `supabase/migrations/20260910160000_calendar_metadata.sql`
9. `supabase/migrations/20260911134456_slot_menu_calendar.sql`
10. `supabase/migrations/20260911150000_shared_recurring_capacity.sql`
11. `supabase/migrations/20260911150142_seller_operations.sql`
12. `supabase/migrations/20260912085515_owner_food_upload_policy.sql`

September 11, 2026: these migrations are installed on Catera V1 (`ygzfdqrljunngfrdygzt`). See [hosted migration verification](SUPABASE-MIGRATION-VERIFICATION-2026-09-11.md) for hosted ledger mappings and test scope. This does not constitute production launch approval. Existing hosted listings and purchase snapshots were preserved; category assignment and conversion of current listings to new slot revisions are separate content operations.

Apply the reusable-dishes migration before deploying the new seller editor. See [compatibility and verification](REUSABLE-DISHES.md). Library changes do not rewrite existing purchases or production snapshots; incomplete drafts cannot be published without full validation and explicit package classification.

The `202609080001_core.sql` migration is retained pilot history. Do not blindly push the mixed migration directory to a fresh V1 project. Use a V1-only migration staging directory with the Supabase CLI, or apply the reviewed SQL files in the hosted SQL editor while keeping a matching migration ledger. Never apply `localBootstrap`, `seedSQL`, `fixture.sql`, or `.data` contents to a hosted project.

Historical migrations are frozen. `node scripts/compile-migration.mjs` checks historical source consistency and generates only the forward package-contents migration from its SQL helpers and canonical service definitions. Review the resulting diff. After the contents migration has been deployed, subsequent changes also require a new migration. Never replay old service definitions over the upgraded database.

The contents migration creates immutable revisions, revision-scoped dated menus and SQL validation without rewriting purchases, pending quotes or production snapshots. Deploy the database first, then web/native clients; readable legacy menu summaries remain in responses. Verify legacy pending-payment activation, old-revision dated menus, RLS and concurrency on the separate V1 staging project before production. `contents-fixtures.ts` is local synthetic demo data and must never be run against hosted storage.

Hosted Supabase supplies Auth roles and schemas. The private `v1` schema must not be added to the public Data API exposed schemas. Public RPC functions have explicit grants and fixed search paths; protected business tables have RLS and no direct client writes. Verify anonymous catalog reads, authenticated RPC access, revoked staff access, cross-caterer IDs, cross-customer IDs, platform-admin separation and service-only job access using real hosted sessions.

Storage migrations create `catera-v1-food` only where the Supabase storage schema exists. The upload API validates JPEG/PNG/WebP bytes and size before writing with the signed-in owner session; Storage RLS limits inserts to a new UUID filename inside that owner's caterer folder. Validate owner-authorized uploads, size limits, public image delivery, cross-caterer rejection, overwrite rejection and unauthenticated rejection. Seller photographs belong to their listings; generated meal photographs are synthetic fixtures only.

Realtime migration publishes a minimal `catera_v1_events` table when the `supabase_realtime` publication is present. Verify two signed-in customers receive only their own events, reconnect correctly and refresh affected views. Business table contents and message bodies are not published by this channel.

## 4. Identity and first administrators

Enable customer phone OTP and configure a supported SMS provider. Configure site URL, allowed redirects, OTP expiry/rate limits and abuse controls for each environment. Verify new signup, returning login, wrong/expired/reused codes, refresh, logout, native secure storage, login-preserved checkout and account access after session expiry. Web sessions use Supabase SSR cookies; native uses SecureStore. No payment is considered successful because login or a return link completed.

Configure verified SMTP for Auth email and operational account communication where email is enabled. The implemented customer notification channels are the persistent inbox and Expo push; an SMTP configuration is not evidence that application email messages are being sent. Record actual test delivery without including codes or secrets in the evidence.

The first platform administrator is an operator-provisioned, verified Auth identity. After that identity has a `v1.profiles` row, a database owner may promote that exact known UUID to `platform_admin` in a transaction and add a `v1.audit` record with the authorizing operator and reason. Do not grant this role through a public client, give seller owners this role, or use a demo UUID. Verify the identity and action in the audit record before continuing.

Seller applications start as drafts. Sellers submit evidence; a Catera admin requests corrections, approves, or suspends with a reason. Staff join using seller-issued invitation codes. Test consumed/wrong codes and removal of financial privileges. Suspension blocks new sales while existing fulfillment obligations remain visible.

## 5. Commercial and payment setup

No production fee percentages, refund amounts or settlement dates are implied by demo examples. Obtain explicit commercial approval for service fee, marketplace/invited seller fees, tax treatment, promotions, refund handling, dispute holds and payout timing. Record the approver and effective date. An operator installs these approved values in `v1.policies` with `approved=true` and `synthetic=false`, and records an audit event. The schema has one current policy row; each purchase retains its own immutable policy snapshot. Without approved configuration, quoting fails closed.

Confirm the Xendit account is enabled for the selected session, refund, split and payout products. Configure sandbox credentials first. The adapter uses payment sessions, optional xenPlatform headers, refunds and the V3 payout API; available products and beneficiary formats depend on the merchant account. Set seller routing only after verifying the actual settlement topology. A provider split and a manual payout must never pay the same seller allocation twice.

Register the environment's HTTPS `/api/webhooks/xendit` endpoint and callback token. The API accepts verified completed/expired payment-session callbacks and refund callbacks. Provider settlement and payout completion are reconciled by an authorized admin using independent provider evidence; redirects are not callbacks and do not authorize fulfillment.

Run and record these sandbox scenarios:

- A successful payment creates one subscription and one financial allocation, even after repeated callbacks.
- Browser and native background/return recover the server checkout state without losing fixed portions, address or schedule.
- An expired session releases temporary capacity; delayed payment reacquires every date or enters a visible support exception.
- Out-of-order events, unknown IDs, wrong tokens, amount/currency mismatches and payload reuse cannot alter purchases.
- A provider timeout/retry does not create a second session, refund or payout.
- A refund keeps split reconciliation visible until an admin records amount, seller deduction, evidence and reason.
- An approved payout cannot include disputed or already released allocations; failed payout reconciliation restores availability once.

The application aims for 15-minute holds bounded by the first applicable cutoff. The adapter refuses a payment session with less than the provider-supported minimum window. Verify the configured provider deadline matches the server hold. Alert on checkout exceptions rather than silently marking late payments fulfilled.

References: [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login), [Xendit payment sessions](https://docs.xendit.co/docs/payment-sessions), [Xendit split payments](https://docs.xendit.co/docs/split-payments).

## 6. Scheduled jobs and notifications

Configure a protected scheduler to GET `/api/jobs` every minute with a Bearer CRON_SECRET authorization header. Do not expose the secret in a public URL. The handler expires holds, creates reminders, claims outbox work with a lease, retries financial/push jobs and checks Expo push receipts. It returns processed count and health counters. No hosted scheduler was configured during local implementation.

Verify retry/backoff, duplicate delivery handling, lease recovery after a crashed worker, invalid-device removal and read/unread inbox persistence. Notification deduplication is keyed to its underlying event. Split reconciliation jobs stay outstanding until an explicit admin reconciliation.

Alert on non-200 job responses, stale unprocessed work, repeated failures, payment exceptions and oversold commitments. Add provider reconciliation for paid transactions, refunds, split movements and payout status. Log event/checkout/job IDs and error codes; redact tokens, phone numbers, addresses and raw payment credentials.

## 7. Operations and service recovery

Seller day/meal selection must stay consistent through schedule → production → delivery. Freeze an immutable production revision, inspect meal-level menu/portion/trial totals, and verify print and CSV output before kitchen handoff. Combined packages have one capacity reservation per day, with independently fulfilled lunch and dinner entries. Address/date changes move the daily commitment together.

Recurring package capacity is shared across the selected operating weekdays. Existing date-specific capacity rows are read-only legacy exceptions; do not create new overrides through normal seller operations. Do not reduce capacity below commitments or close a booked date without resolving affected bookings. A failed replacement reservation must leave the old booking intact. Check cutoff using the caterer's configured timezone, including a request that crosses cutoff during processing.

All cancellation/refund requests enter support and retain bookings on submission. The seller responds first; a Catera administrator approves a financial resolution with amount and reason. Review future obligations, delivered portions and held seller allocations before approval. Never manually delete reservations, rewrite purchase snapshots, or modify financial rows to clear a queue.

For external prepaid subscriptions, use the seller's legacy import preview with verified customer, package, saved address, remaining days, fixed portions and external receipt reference. Review every generated date and source before confirmation. Preview reserves nothing; confirmation reserves all remaining dates transactionally and labels the subscription as legacy. It does not create an invented provider payment or fresh payout allocation. No automatic hosted-pilot import exists.

## 8. Native development and release evidence

Install the environment's development build using `apps/customer/eas.json`; `expo-dev-client` is included. Configure an EAS project, Apple signing and APNs, Android signing and FCM credentials. Use test identities and Xendit sandbox. The local machine has not produced signed Android/iOS builds or device evidence.

On both Android and iOS verify public browsing, OTP, checkout, backgrounding, interrupted network, `catera://payment/<checkout UUID>` return, push permission denial/approval, foreground/background/terminated push navigation, rescheduling review, support, reviews and renewal. Verify native text scaling, screen reader labels, safe areas, keyboard avoidance and touch targets on actual devices. Shared API rules must reject the same invalid actions as web.

`npm run native:export` and the iOS/Android Jest presets verify bundles and components, not these device flows. Keep device model, OS, build ID, API environment, test date and redacted screenshots with release evidence. [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## 9. Verification, backup and rollback

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:postgres`, `npm run test:e2e`, both native Jest presets and `npm run native:export` from a clean checkout. CI runs these with isolated PostgreSQL. Examine concurrency failures before rerunning; do not weaken assertions or reset a shared database.

Before launch, restore a recent staging backup into a separate project and compare purchase counts, reservations, payments, audit history and storage objects. Exercise application rollback against the new schema; database recovery requires a planned migration or restored environment, never a destructive reset of customer data. Record recovery point/time and operator. Backups and monitoring must be operational before collecting real payments.

## 10. Release ledger

| Gate | Current evidence / status |
|---|---|
| Reproducible local installation | Passed, isolated clean npm ci; `output/install-verification.json` |
| Type, domain/database/provider, concurrency, browser, builds | Local evidence in `output/verification`; rerun final commit in CI |
| Web visual review | Four corrections verified; `output/V1-FINISH-VERDICT.md` |
| Brand alpha and requested master/export sizes | Open: opaque generated masters are below target sizes; no crops or artificial enlargement |
| Complete English and accessibility/device QA | Partial English support and local checks; full locale/device evidence required |
| Hosted Supabase Auth/RLS/storage/realtime | Not configured or verified |
| SMS / SMTP and push delivery | Not verified with staging/production credentials |
| Xendit sandbox / merchant settlement topology | Adapter and contract tests only; actual transactions required |
| Approved commercial policies | Required; local examples are fictional |
| Signed Android/iOS development builds and return/push | Not run on devices |
| Backup restore, scheduler and alerts | Not verified in hosted environment |
| High-volume pagination and load testing | Additional admin/customer-history pagination and hosted load evidence required |

Do not mark open gates passed because a local screen renders or a test double responds successfully. Record evidence and explicit commercial/operational authorization before enabling real transactions.
