# Verification record

Verified locally on 8 September 2026 with Node.js 24, Windows, Microsoft Edge and native PostgreSQL 17.10. All application data was synthetic.

| Check | Result and scope |
|---|---|
| TypeScript | `npm run typecheck` passed |
| Application/database suite | 29 Vitest checks passed against the real migration in PGlite |
| Concurrent transactions | Native PostgreSQL: last-quota race, simultaneous delivery confirmations, a request blocked across cutoff, and accounting reconciliation passed |
| Operational report | Native PostgreSQL: aggregate output correctly reports missing cron and zero ledger discrepancies |
| Browser journeys | Six Playwright journeys cover management navigation/date policy, purchase/scheduling, subscriber changes, responsive/keyboard behavior, shared fulfillment/accounting, and a stale form after background refresh |
| Accessibility | Automated WCAG 2 A/AA and 2.1 AA checks passed on admin and subscriber home; this is scoped automated evidence, not an accessibility certification |
| Responsive review | Desktop 1440px, tablet 768px, phone 390px captures checked; Impeccable reviewer scored both listed material fixes resolved, disposition `ship` at fix scope |
| Production compilation | Next.js production build passed |
| Clean dependency install | Isolated source copy: `npm ci` and production build passed with its own dependencies; no hosted credentials needed |
| Backup round trip | PGlite dump/load preserves deliveries, grants, ledger, reservations and frozen production; reconciliation returns `[]` |
| Brand/source preservation | Original artwork pixel chunks match the supplied PNG; only origin metadata was added. All 169 supplied tool/skill files match their originals |
| Secret hygiene | Environment/local database files are ignored; no deployed keys or real customer fixtures were added |

## Scenario coverage

The database tests exercise two isolated businesses; a subscriber linked to both; unrelated staff rejection; anonymous/function execution restrictions; direct RLS reads and protected DML; foreign package rejection; verified-email invitation activation and revocation; duplicate purchases and request conflicts; atomic quota exhaustion; skip tombstones; recurrence retention/cancellation/version conflicts; rescheduling and validity; failed deliveries; duplicate completion and reversal; purchased term snapshots; profile-address independence; stale delivery and configuration versions; missing/default menus; delayed-freeze baseline and immutable revisions; timezone/date exceptions; expired grants and late completion; CSV formula protection; HTML escaping; matching translation keys; and recovery integrity.

The browser tests use real server actions and persisted synthetic data. They verify both roles see the same meal, fulfillment and quota changes, navigation does not change accounting, stale open forms retain their original expected version after refresh, and subscriber/anonymous callers cannot read operational manifests.

During validation, unreliable URL/label selectors were corrected, including waiting for completed route navigation before reading an occurrence ID. The final code includes these corrections. Run browser tests against a fresh demo database as documented in the README.

## Clean install finding

The first independent `npm ci` exposed an optional bundled dependency mismatch in Tailwind's WASI dependency tree. A direct pinned development dependency on `@emnapi/wasi-threads` makes npm's lock graph complete. The final lockfile was verified by a subsequent actual `npm ci` and independent build. Keep that dependency until an upstream dependency update is verified with a clean install; it is not an application runtime feature.

## Synthetic performance measurement

Raw results: [benchmark.json](verification/benchmark.json). These are local native PostgreSQL full-workspace RPC timings, five warm samples after one warm-up. They exclude network transfer, server rendering and browser rendering. Dataset numbers are **additional synthetic fixtures**, not actual demand, proposed service limits or production capacity.

| Added customers / deliveries | Median | Slowest of five | JSON response |
|---|---:|---:|---:|
| 100 / 2,000 | 94 ms | 95 ms | 1.29 MB |
| 500 / 10,000 | 1,322 ms | 1,544 ms | 6.22 MB |

The result identifies a read-model scaling concern: the current app retrieves one authorized workspace snapshot and paginates lists locally. Date/customer-scoped reads and server pagination should precede a larger rollout or substantial retained history. Remeasure with the actual pilot's dataset and network; do not interpret local measurements as a latency guarantee.

## Gates still requiring external evidence

Private Git remote/hosted CI, Supabase staging and production migrations, hosted caller-JWT/RLS checks, custom SMTP and real OTP/session journeys, cron execution and alert delivery, Singapore deployment configuration, and hosted backup restoration remain unverified. Hosted backup retention and recovery times are not inferred from the local restore test. The [runbook](RUNBOOK.md) contains concrete commands and an unapproved release checklist.

The implementation can be exercised locally. It has not been released for real customer use.
