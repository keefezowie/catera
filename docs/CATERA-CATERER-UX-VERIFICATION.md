# Caterer UX verification — 22 September 2026

> September 22 integration: see [V1 worktree integration](V1-WORKTREE-INTEGRATION-2026-09-22.md) for the combined implementation, superseded overlaps and fresh verification. Earlier no-push statements below describe their original work sessions.

Implemented locally on `codex/caterer-dashboard-ux`, based on `b36f9a6`. The implementation plan was written before application edits. The original `v1` checkout and its untracked evidence were preserved. No commit, push, PR, deployment, shared database mutation, real message or real financial transaction was performed.

## Outcome and acceptance coverage

| Work | Completed behavior | Evidence |
|---|---|---|
| UX-01 | Primary Today clears retained date/filter context; historical operations and order headings identify their date; server current-day refresh and date-keyed selection reset | AT-01, AT-02, AT-03, AT-19 browser scenarios; server timezone unit coverage |
| UX-02 | Both meal quantities visible; dinner-only defaults to dinner; both/empty default to lunch; explicit selection persists in URL; empty-meal switch | AT-04, AT-05, lunch-only/empty browser cases |
| UX-03 | Purchased meal portions and per-meal stage portions, delivered included in totals, cancelled workload excluded, trial counted once | AT-06, AT-07; pure selector tests; 8 lunch / 9 dinner / 17 whole-day reconciliation |
| UX-04 | Actual purchased dated deadlines grouped, passed/not-yet-passed state, timezone and selected service date; operational status eligibility unchanged | AT-03; unit checks before/at/after deadline, browser clock crossing in America/Los_Angeles while displaying Asia/Jakarta |
| UX-05 | Prominent whole-day kitchen link; original production functionality retained; live/saved copy distinguished; print disabled during refresh | AT-10, AT-11, AT-14; actual local revision, download and rendered PDF |
| UX-06/07 | One broad service total, all-dates/both-meals scope, three priority tasks, inline expansion of all returned items, honest 100-item limit, distinct loading/error/zero | AT-12, AT-13, AT-14; 102-task fixture, real dinner exceptions while lunch has zero issues; existing follow-up regression |
| UX-08/09 | One Schedule date area, explicit grouping, searchable customer/destination selection, dependent filter reset, table-matched summary and historical cancellation label | AT-08, AT-09, AT-16, AT-19; U1 lunch gives 2 orders / 4 portions |
| UX-10 | Evaluated and retained bottom navigation | AT-18 mobile paths: kitchen 1 activation (previously Schedule + scroll + disclosure); priority exception 1; Customers 2 via More; Packages 1. No measured human discoverability claim. |

All AT-01–AT-20 have local automated coverage in the new suite and relevant existing checks. Coverage is scenario-specific: it does not establish real-user comprehension, production behavior, physical-device behavior, or every possible permission combination.

AT-14 includes failed initial fetch, attention error, cleared cross-meal batch selection, failed save with no download, a delayed old-date save, and a delayed operational response after browser Back. Date-keyed loading removes old rows while fetching a different date. AT-15 exercises real optimistic conflict through the UI; PostgreSQL separately verifies multi-record atomic rollback, version races, idempotency and cross-tenant rejection. AT-17 exercises staff operational display/restricted financial navigation, supported by existing domain/SQL permission checks. AT-18 includes keyboard meal/date movement and focus restoration, phone main-region axe checks, touch-control geometry, long addresses and 100 rendered orders. AT-20 includes customer home/marketplace smoke and the existing shared control/dialog UI sweep.

## Commands actually run

| Command | Result |
|---|---|
| `npm run typecheck` | Passed, including web, native TypeScript and root tests/domain |
| `npm test -- --reporter=dot` | 37 files, 261 tests passed |
| `npm run test:postgres` with `TEST_DATABASE_URL` unset | 26 local embedded PostgreSQL scenarios passed; no hosted database |
| `npm run build` with separate `.next-ux-build` | Passed; final rerun after implementation corrections passed |
| `npx playwright test -c playwright.caterer-ux.config.ts` | Final run: 23 passed, 1.4 minutes |
| Baseline capture with `UX_PHASE=before`, `--grep "matched visual"` | Passed; original source temporarily loaded with automatic restoration in `finally` |
| `git diff --check` | Passed at handoff |
| CSV parsing + PDF text/page checks | Passed: 1 PDF page; 7 CSV meal rows; lunch 8, dinner 9; one trial meal row; cancelled address absent |

Logs and machine-readable records are in `output/playwright/caterer-ux/`: `browser-final.log`, `unit-tests.log`, `postgres.log`, `postgres.json`, `build-final.log`, `typecheck-final.log`, and `output-verification.json`.

The final browser configuration runs `caterer-ux.spec.ts`, `beta-attention.spec.ts` and `seller-operational-controls.spec.ts`. The older fixture-specific `seller-operations.spec.ts` and broader `seller-workspace-ui.spec.ts` have obsolete selectors/assertions updated, but were **not run in full** against their separate historical fixture contracts. Their affected operational behaviors have new regression coverage here. The full repository browser suite was not run.

## Visual and output evidence

Matched full-page captures use 390×844, 768×1024, 1366×768 and 1440×1000 viewports in Indonesian and English. Files are `before-{today,schedule}-{id,en}-{width}.png` and `after-{today,schedule}-{id,en}-{width}.png` under `output/playwright/caterer-ux/`. Calendar capture waits for loaded data. Representative phone, tablet, laptop and desktop results in both languages were opened and visually inspected, including before/after Schedule at 1366 and phone Today. Automated overflow checks passed at all capture sizes.

- **Today phone:** before is 390×13187; after is 390×3337. The reduction comes principally from the bounded attention preview. Date, both workloads and kitchen entry now precede the queue. This is layout evidence, not a measured improvement in human task time.
- **Schedule laptop:** before is 1366×1382; after is 1366×1522. The page is slightly longer because date/scope and explicit controls are now visible. This is an intentional tradeoff; smaller page height was not the acceptance goal.
- The fixed mobile navigation appears at the viewport boundary in full-page screenshots; controls remain scrollable and the automated mobile paths and overflow checks passed.
- `scale-phone.png` captures the 100-order scenario with long synthetic destinations.
- `kitchen.pdf`, `final-kitchen-1.png`, `manifest.csv`, `downloaded-manifest.csv`: actual output artifacts. The Print button was exercised with the native print call intercepted for headless testing, then browser print media/PDF was rendered and inspected. No physical printer was used.
- The first rendered PDF exposed a toast/skip-link and extra-page defect. Kitchen-scoped print CSS fixed it. The regenerated one-page PDF shows the selected date, whole-day scope, lunch totals 3+5, dinner totals 4+5, and one included trial. It contains no table filters or operational controls.
- Revision change verification used real local allowed status transitions, observed the service's production-changed task, saved a new revision, and checked that warning removal was server-confirmed. CSV links from a previous date do not appear after date changes, including a deliberately delayed save response.

## Changed files and API impact

Application files:

- `apps/web/src/components/application.tsx`: primary Today link semantics only.
- `apps/web/src/components/seller-operations.tsx`: date/meal workload, deadlines, kitchen path, explicit filters, safe loading and focus preservation.
- `apps/web/src/components/seller-operations.css`: scoped responsive context/workload styles and kitchen print correction.
- `apps/web/src/components/seller-attention.tsx`: scoped total, bounded preview, expansion, truthful error/loading/limit states.
- `apps/web/src/components/seller-production.tsx`: live whole-day quantity, saved-copy explanation and loading print guard.
- `packages/domain/src/seller-operations.ts`: read-only meal workload and dated deadline selectors.

Tests/config/docs:

- `tests/caterer-ux.test.ts`
- `tests/fixtures/caterer-ux.mts`
- `tests/e2e/caterer-ux.spec.ts`
- `tests/e2e/seller-operational-controls.spec.ts`
- `tests/e2e/seller-operations.spec.ts`
- `tests/e2e/seller-workspace-ui.spec.ts`
- `playwright.caterer-ux.config.ts`
- `docs/CATERA-CATERER-UX-IMPLEMENTATION-PLAN.md`
- `docs/CATERA-CATERER-UX-VERIFICATION.md`

No API contract, migration, schema, command, permission, financial policy or production manifest generator changed. The original expected-version fields, permitted transition intersection, atomic command, idempotency, conflict feedback and audit behavior remain in place. The original dayRows collection still feeds whole-day production independently of table filters.

## Reproduction and limitations

Use a **new** isolated local directory whose final name is `caterer-ux-test`; the seed deliberately refuses to overwrite an existing fixture. Set `CATERA_V1_DEMO=true`, `CATERA_DEMO_DATA_DIR` to that directory, then run `node --import tsx tests/fixtures/caterer-ux.mts`. Start `npm run dev` with the same environment, `PORT=3138`, `CATERA_PUBLIC_URL=http://127.0.0.1:3138`, and `CATERA_NEXT_DIST_DIR=.next-caterer-ux`. Run the dedicated Playwright config. The final recorded run used `.data/ux-final/caterer-ux-test`.

The deterministic semantic graph includes valid schema-checked combined/lunch/dinner packages, the brief's A–F records, a dinner-only day, an empty day, 100 distinct-customer combined orders on a separate date and an open support task. IDs are generated locally. SQL fixture construction is not a purchase-onboarding test. Test commands can append local notifications/outbox records; no notification worker or external delivery was run.

Early verification failures were corrected: fixture trial storage/schema assumptions, grouped table-row selectors, CSV label casing, an interception test affected by removing all routes, a strict alert locator matching Next's announcer, and the obsolete support badge assertion. These were not reported as application passes. The output print defect and calendar focus regression were actual implementation findings and were fixed and retested.

Remaining limits: Chromium automation only; no physical mobile devices, native app runtime, other browser engines, physical printer or hosted/provider testing. Midnight rollover is simulated using server-shaped responses; timezone/deadline display is also clock-tested. Absolute deadline display relies on the device clock, while operational date and action eligibility remain server-authoritative. Attention still exposes only the existing first 100 tasks, explicitly disclosed; support remains directly reachable through navigation. Saved revision freshness uses the existing attention workflow rather than a new freshness API. No uncoached caterer walkthrough or user comprehension/speed claim. No policy blocker remains for these scoped fixes.
