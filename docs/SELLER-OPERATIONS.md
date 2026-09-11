# Seller operations — ID 0006

Hari ini now updates fulfillment by meal; Jadwal is the order dashboard. The former production/delivery sidebar entries and workflow strip are removed. Old `/seller/delivery` links redirect to Hari ini, and `/seller/production` links open the production panel in Jadwal, retaining date and meal context.

## Behavior and interfaces

- Today defaults to the caterer's local date and lunch. Each delivery remains its own row, including separate addresses/orders for the same customer. Bulk selection offers the intersection of valid next statuses; cancelled/completed/future deliveries cannot be updated. Changing date or meal clears selection.
- Schedule filters a month/date by package, meal and cancellation status. Daily orders count a combined lunch/dinner package once; meal portions count both meals. Unique destinations compare normalized address line and area. Cancelled deliveries remain inspectable but do not contribute to summary demand or production.
- `GET /api/v1/seller/:id` adds `operationalDate`, `today`, and `deliveries[].customer = { id, name }`. Customer responses retain their existing shape. Identity comes from the subscription's user relationship.
- `GET /api/v1/seller-calendar/:id?from=YYYY-MM-DD&to=YYYY-MM-DD&meal=all|lunch|dinner&packageId=UUID&status=active|all|cancelled` returns `{ days: [{ date, orders, lunch, dinner }] }`; packageId may be omitted. Ranges are bounded to 63 inclusive days. Empty dates are rendered by the client, and failed requests are not treated as zero orders.
- `delivery.statusBatch` accepts `{ catererId, date, meal, status, items: [{ id, version }] }`, with 1–500 unique items. The public command locks the actor, packages, and delivery rows in stable order and calls the existing single-delivery transition implementation within the transaction. Version failure, invalid transition, or tenant/date mismatch rolls back every status, notification, audit and receipt. An actor/request receipt makes retries idempotent. Legacy RPC implementations are not callable by anonymous/authenticated clients directly.
- Production/CSV always includes all packages and both meals on the selected date regardless of dashboard filters. Each revision remains available after data refresh. The customer calendar's purchased data and content snapshots are unchanged.

## Local verification

September 11 results: 96 unit tests, workspace typecheck, production web build, Android/iOS exports and ten PostgreSQL scenarios passed. All ten targeted browser scenarios passed across the final combined run and focused reruns. Two harness failures in the combined run (a shared screenshot write collision and an assertion treating an empty, opacity-hidden toast as invisible) were resolved with isolated evidence paths and a class-state assertion. This is targeted verification, not a claim that the repository's entire E2E suite passes.

Evidence is under `output/slack-bugs/0006/`. Targeted unit tests cover identity, timezone defaults, combined counts, meal independence, idempotency, rollback, invalid transitions, cancellation, future dates and tenant authorization. PostgreSQL verification additionally races reversed batches from two operators and checks that exactly one version commits without a deadlock.

Browser tests exercise multi-address rows, bulk conflicts and retry selection, filters, redirects, full-date CSV, keyboard navigation, English, 320/390/1440px layouts, and axe accessibility. The same isolated server runs the seven customer calendar regression scenarios. Web/customer typechecks, unit suite, production web build and Android/iOS exports are required; export is not physical-device proof.

To reproduce the browser suite, stop the isolated server before initializing/resetting its synthetic fixture statuses:

```powershell
$env:CATERA_DEMO_DATA_DIR = 'D:\Project\Catera\catera\.data\seller-operations-test'
node --import tsx tests/fixtures/seller-operations.mts
$env:CATERA_NEXT_DIST_DIR = '.next-ops0006'
$env:CATERA_V1_DEMO = 'true'
$env:CATERA_PUBLIC_URL = 'http://127.0.0.1:3106'
npm run dev -w @catera/web -- --port 3106
```

In another terminal:

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npx playwright test --config tests/operations.playwright.config.ts
```

The dedicated configuration enables fixtures-dependent seller tests; normal E2E runs skip those tests unless `CATERA_OPS_TEST_URL` is set. The fixture script only accepts a database directory ending in `seller-operations-test` and resets only rows labeled `Fixture ID 0006`.

## Rollout

Apply forward migration `20260911150142_seller_operations.sql` after existing V1 migrations before deploying the consuming web code. Synthetic PGlite startup applies the same migration once; it does not enter hosted storage. This work is local only: no hosted migration, deployment, Slack posting or changes to real customer data.
