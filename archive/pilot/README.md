# Catera

Good Food on Repeat.

A catering subscription pilot with an Indonesian-first operational workspace and subscriber portal. Next.js, TypeScript, Supabase/Postgres, and a persistent local PostgreSQL-compatible demo run the same domain migration and transactional commands.

## Run locally

Requirements: Node.js 24 and npm. No account, Docker, or hosted credentials are needed for the synthetic demo.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

On macOS/Linux, use `cp .env.example .env.local`. Open **http://127.0.0.1:3000**. Choose **Masuk sebagai pemilik**, **admin**, or **pelanggan**. The owner and subscriber belong to two separate synthetic businesses; the admin belongs to Dapur Hijau only. Change language with ID / EN.

The explicit `CATERA_DEMO_MODE=true` flag uses a local PGlite database in `.data/postgres`. Data survives navigation and server restarts. The demo does not send email. It is disabled on Vercel even if the flag is accidentally set. Never expose the demo server publicly or enter real customer information.

To restore the original fixtures, stop the server, run `npm run demo:reset`, and start it again. This **moves the old synthetic database into a timestamped backup**, rather than deleting it. The two fixtures are Dapur Hijau and Rasa Rumah; dates are relative to initialization. Generate fresh fixtures after a long gap or a migration change.

## Working pilot workflows

- Owner/admin: customer and package management, external purchase recording, quota grants, reviewed schedule generation and recurrence revision, menus/defaults, daily scheduling, versioned production, dispatch, failure/retry/cancellation, CSV and print.
- Owner: business policy, slots/date exceptions, invitations and access revocation, quota adjustments and delivery-confirmation reversal.
- Subscriber: next delivery, quota and purchase history, meal selection, skip/reschedule, individual address changes with review, and profile defaults.
- Database: tenant checks and composite constraints, RLS, protected writes, idempotent commands, version conflicts, expiry-aware reservations, cutoff enforcement, immutable production versions, audit history, and reconciliation.

Hosted email OTP and cron are implemented but require configuration. No payment checkout, billing, invoice, reminder, WhatsApp, analytics, or driver/kitchen account flows are included.

## Verification

```powershell
npm run typecheck
npm test
npm run test:postgres
npm run build
npm run test:e2e
```

`test:postgres` starts a disposable native PostgreSQL 17 cluster bound to localhost, tests concurrent requests, and stops it. Alternatively, supply `TEST_DATABASE_URL` for a **fresh, empty database named `catera_test`**. Existing databases are never cleared. Generated test clusters stay under ignored `.data/tests`.

Playwright uses Microsoft Edge on Windows by default. Set `PLAYWRIGHT_CHANNEL=chromium` and run `npx playwright install chromium` to use Chromium on another machine; CI installs Chromium automatically. Browser tests mutate only the synthetic fixture and expect a fresh demo database for repeat runs. Stop the server and run `demo:reset` first when repeating the whole suite.

`npm run benchmark` also measures full-workspace queries against synthetic datasets and writes `docs/verification/benchmark.json`. `npm run db:types` regenerates TypeScript table types from the migration. `npm run format` formats application source without changing the supplied skill files.

## Handoff and deployment

- [Implementation and policy decisions](docs/IMPLEMENTATION.md)
- [Deployment, onboarding, monitoring, and recovery runbook](docs/RUNBOOK.md)
- [Verification evidence and outstanding release gates](docs/VERIFICATION.md)
- [Design system](DESIGN.md) and [approved UI direction](docs/UI-BRIEF.md)
- [Original product baseline](PRODUCT.md) and [screen scope](Catera-Shape-Brief.md)

Source is on branch `codex/catera-pilot`. No remote repository or public deployment has been created. Create a **private** Git repository before connecting hosting. Keep `.env.local`, `.data`, customer exports, and credentials out of Git. The supplied `tools/impeccable` files and artwork are preserved in the project.

Local verification is not production release approval. Before real use, complete the environment-specific email, hosted migration/RLS, jobs, backup restoration, and monitoring gates in the runbook.
