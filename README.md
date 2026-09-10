# Catera V1 — Good Food on Repeat

Indonesian catering marketplace with responsive customer, seller and admin web, plus an Expo customer app for Android/iOS. One versioned API and transactional PostgreSQL services power both platforms.

## Run locally

Requires Node 24 or newer. From the repository root:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Browse before login; /login offers explicit synthetic customer, owner, staff and platform-admin roles. /brand is the identity asset gallery. No real payment or customer data is used. Data persists under .data/v1; startup does not reset it. A labeled operating fixture supplies today's trial meals.

For Supabase, copy .env.example to apps/web/.env.local, configure a separate V1 project, and use npm run dev:web. Missing configuration produces an unavailable state; it never falls back to demo data. The hosted pilot database is protected.

## Native app

```sh
npm run dev:native
npm run native:export
```

Copy apps/customer/.env.example to apps/customer/.env.local. Both platforms call the same API. A physical device needs a reachable HTTPS backend. SecureStore persists sessions and checkout context. The catera://payment/ID link returns to the payment status screen. Configure EAS, Android/iOS credentials and development builds before testing push and external payment returns. An export is not a signed device build.

## Checks

```sh
npm run typecheck
npm test
npm run test:postgres
npm run test:e2e
npm run test -w @catera/customer
npm run test -w @catera/customer -- --preset jest-expo/android
npm run build
npm run native:export
```

Install Chromium with npx playwright install chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed binary. PostgreSQL tests start a disposable embedded database unless TEST_DATABASE_URL names an empty catera_test database; existing V1 data is never reset. Browser tests add synthetic future purchases/support cases without erasing existing demo work.

## Workspace

| Directory | Purpose |
|---|---|
| apps/web | Next.js public/customer/seller/admin UI and API |
| apps/customer | Expo Router customer app |
| packages/domain | Shared types, validation, scheduling and pricing |
| packages/api-client | Typed web/native API client |
| packages/backend | SQL service bridge, payment adapter and explicit demo setup |
| packages/design-tokens | Shared palette, typography, spacing, focus and motion |
| packages/brand | Individual assets, fonts, prompts and manifests |
| supabase/migrations/20260909* | V1 schema, services, hardening, storage and realtime |
| archive/pilot | Preserved pre-V1 implementation and baseline records |

See [implementation record](docs/IMPLEMENTATION.md), [milestone plan](docs/CATERA-V1-IMPLEMENTATION-PLAN.md), [release runbook](docs/RUNBOOK.md), and [asset limitations](packages/brand/README.md). No production deployment or hosted database migration has been performed by this overhaul.
