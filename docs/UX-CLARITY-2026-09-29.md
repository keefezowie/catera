# Catera V1: action ownership, delivery coverage and seller totals

## Scope and baseline

Implemented and verified on `codex/ux-clarity`, based on V1 commit `2cb8009b7e93fc3a7e8a7cc80f8d21453027939b`. The managed verification worktree is `C:\Users\nidal\.codex\worktrees\ux-clarity\catera`. Integration into `v1` includes only the scoped source, tests, configuration and documentation; unrelated checkout changes are preserved.

This patch implements the three approved optimizations. It keeps the action-feed API, payment states, purchase rules, seller calculations and database schema unchanged.

## Final behavior

### Customer Home

The shared presentation model records the next responsible actor separately from visual urgency. One classifier groups the feed while preserving its order and item links:

| Status | Next actor | Home section |
| --- | --- | --- |
| `selection_due` | Customer | Action needed through tomorrow; upcoming menu choices for later deadlines |
| `choose_method`, `awaiting_payment`, `responded` | Customer | Action needed |
| `checking_payment` | System | Payment and issue updates |
| `open` | Caterer | Payment and issue updates |
| `escalated` | Catera | Payment and issue updates |
| `payment_exception` | Catera | Booking needs review |

Home displays booking reviews, immediate customer tasks, the next meal, quieter status updates, the agenda, future menu choices and active packages in that order. Only customer sections use action counts. Every group retains its three-item expansion control.

One feed notice handles loading and errors. The existing resource hook retains the last successful records during refresh or failure; a successful read replaces them, including removal of resolved items. When the feed returns fewer records than its total, Home reports the loaded count and total. A waiting-only or truncated feed does not claim that everything is resolved. Pending payment verification never says payment was received.

### Delivery price and coverage

Cards always state that delivery is included in the price. A separate coverage line distinguishes an unselected area, a supported area and an unsupported area. Package details use the same states and explain address checking at checkout when the area is unknown.

Unknown coverage allows regular and trial checkout. A known unsupported area keeps both purchase routes unavailable. An area match describes the service area; checkout still validates the selected address on the server. The catalogue's existing area selector and persistence remain in use. Seller card previews retain disabled links, and detail previews remain inert.

### Seller totals

Today names the selected meal and full package scope beside its workload count: “Total siang · semua paket: N porsi” / “Lunch total · all packages: N portions”, with dinner equivalents. The visible order summary begins with “Sesuai filter” / “Matching filters”. Workload and stage counts remain independent of the table filters.

Schedule retains its filtered table summary and explicit whole-day kitchen/CSV scope. Combined lunch-and-dinner deliveries count once per meal in production totals.

### Responsive refinements required by verification

Home action text and controls wrap at enlarged text sizes; narrow action buttons can use the full card width. The active-package heading can wrap its adjacent link. Package details allow their content and portion controls to wrap without forcing the page wider than the viewport.

## Verification

All app interaction used explicit synthetic data on `http://127.0.0.1:3231`, with `CATERA_V1_DEMO=true`, `CATERA_V1_FIXTURES=true`, and `.data/ux-clarity` in this worktree. PostgreSQL ran in a separate disposable local database with `TEST_DATABASE_URL` unset.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed: web, native types and shared/test TypeScript |
| `npm test` | Passed: 305 tests across 47 files |
| `npm run test:postgres` | Passed: 28 PostgreSQL verification groups |
| `npm run build` | Passed: optimized Next.js production build |
| `npx playwright test --config tests/ux-clarity.playwright.config.ts` | Passed: 74 scenarios, zero skipped, failed or flaky |
| `git diff --check` | Passed |

The focused regression coverage includes all eight action statuses, mixed and waiting-only feeds, booking exceptions, Jakarta deadline boundaries, retained records during delayed/failed refresh, resolution after a successful read, retry and 20-of-25 truncation. Coverage checks exercise unknown, supported, unsupported and cleared areas, persistence, regular/trial navigation, static seller previews and actual server rejection of unsupported addresses. Seller checks reproduce zero filtered portions beside nonzero global workload, switch lunch/dinner, count combined meals, and save/read a whole-day CSV despite a zero-row table filter.

Browser scenarios cover Indonesian and English at 320, 390 and 1440 pixels, keyboard activation/focus, loading/error recovery, control geometry and 200% text on the affected content. Existing discovery, checkout, Home and seller journey suites run alongside the new checks; discovery also covers 360, 430, 768 and 1280 pixels. The older seller journey selector was updated from “Change scope” to the “Filter issues” label already present on the V1 baseline.

The refresh test mounts the actual web resource hook with controlled responses. It uses the web workspace's React instance because web and native have separate installations. Root test TypeScript enables JSX to check that imported web component; no dependency was added.

### Evidence files

These generated reports and captures were recorded locally in the managed verification worktree. The links below open the retrieval index and retain each original artifact path in the link title; they do not confirm that local files are still available. The implementation, repeatable tests and verification record are versioned.

- [PostgreSQL evidence](README.md#local-verification-artifacts "output/verification/ux-clarity-postgres.json")
- [Verification summary](README.md#local-verification-artifacts "output/verification/ux-clarity.json")
- [Browser results](README.md#local-verification-artifacts "output/playwright/ux-clarity/results.json")
- [Browser report](README.md#local-verification-artifacts "output/playwright/ux-clarity/report/index.html")
- [Repeatable screenshot capture](README.md#local-verification-artifacts "output/playwright/ux-clarity/capture.mjs")

Comparable captures exist for all six language/width combinations in `output/playwright/ux-clarity/before` and `after`. Selected examples:

| Surface | Before | After |
| --- | --- | --- |
| Waiting-only Home, Indonesian, 390 px | [Before](README.md#local-verification-artifacts "output/playwright/ux-clarity/before/home-id-390.png") | [After](README.md#local-verification-artifacts "output/playwright/ux-clarity/after/home-id-390.png") |
| Card with no area, English, 320 px | [Before](README.md#local-verification-artifacts "output/playwright/ux-clarity/before/card-en-320.png") | [After](README.md#local-verification-artifacts "output/playwright/ux-clarity/after/card-en-320.png") |
| Package booking panel, English, 390 px | [Before](README.md#local-verification-artifacts "output/playwright/ux-clarity/before/details-en-390.png") | [After](README.md#local-verification-artifacts "output/playwright/ux-clarity/after/details-en-390.png") |
| Seller workload, English, 1440 px | [Before](README.md#local-verification-artifacts "output/playwright/ux-clarity/before/seller-en-1440.png") | [After](README.md#local-verification-artifacts "output/playwright/ux-clarity/after/seller-en-1440.png") |

## Evidence limits

These checks establish local software behavior using synthetic data and Chromium. They do not measure customer comprehension, conversion or seller task success. Hosted authentication/payment providers, physical devices, native implementation, production performance and deployment are outside this patch. Verification did not change hosted data or deployments. Git integration and push do not establish deployment status.

The verification server and browser session were stopped after the checks; the worktree and local evidence remain available for review.
