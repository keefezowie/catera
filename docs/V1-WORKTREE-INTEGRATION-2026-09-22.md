# V1 worktree integration — September 22, 2026

The user authorized scanning all branches/worktrees except main and catera-pilot, integrating missing changes into v1, validating, committing and pushing. Baseline v1: b36f9a6. Integration was prepared on codex/integrate-worktrees-v1 in the primary checkout; the other worktrees and pre-existing untracked evidence were preserved.

## Branch and worktree audit

GitHub branch search and a fresh origin fetch found main, codex/catera-pilot and v1. The first two were excluded as requested. Local branches and all registered worktrees were inspected, including uncommitted source, tests, documentation and configuration.

| Source | Finding | Integration decision |
| --- | --- | --- |
| codex/v1-end-to-end-polish, 0194cc6 | One commit absent from v1 ancestry; worktree only had untracked evidence | Ported missing form locking, isolated message drafts/recipients, request recovery, keyed resource state, review loading/error handling, customer navigation and tests. Retained newer v1 marketplace query parsing, toolbar, filter chips, checkout and auth changes. |
| codex/caterer-dashboard-ux, b36f9a6 plus uncommitted work | Dashboard implementation, selectors, tests and documentation absent from v1 | Integrated all nine changed tracked files and six untracked source/test/config/document files. Reconciled operations loading with the polish resource hook. |
| codex/catera-direct-payments, 240b10c plus uncommitted work | All non-output files exist in v1; direct-payment implementation and migrations were already integrated by f37e99f | Retained current v1. Remaining differences are formatting, newer registration/checkout/date-picker changes and later provider contract fixes (3f76719, 60420b4), tests and verification history. No missing direct-payment feature was found. |

Generated output, logs, screenshots and build-specific TypeScript paths are not product changes and are excluded from the commit. No original worktree was reset or removed. Old polish/direct-payment revisions must not overwrite the newer v1 implementations.

## Integrated behavior and conflict resolutions

- Forms disable editable controls while submitting and preserve failed drafts. Admin/support record switching cannot transfer inputs to another record. Messages preserve separate conversation drafts and lock recipients during sending.
- Resource reads distinguish initial loading, refresh failure and empty results. Changed keys hide old records immediately; operations explicitly retain their navigation shell while masking old-date rows and totals.
- Today clears retained historical dates. Meal totals include delivered portions, exclude cancellations and distinguish lunch/dinner. Purchased deadlines use the caterer timezone. Dinner-only days default to dinner; explicit meal selections persist in the URL.
- Schedule offers inline grouping/search/filter controls and matching totals. Whole-day production remains independent of table filters. Attention displays three priorities, supports expansion and discloses the existing 100-item service limit. Kitchen print and saved revision explanations are retained.
- Calendar focus is tied to the requested date instead of a boolean. This prevents an earlier response from consuming focus intended for a later arrow-key action. Date-specific order selections and production revisions still reset.
- Default meal selection stays local until explicitly changed. An automatic URL rewrite raced a quick Today-to-Schedule link and cancelled navigation; removing that rewrite fixes the regression.
- Inherited browser tests now use current sales labels, searchbox/filter controls, explicit checkout consent, eligible operating dates and the new Today semantics. Assertions continue to test real controls and transactional outcomes.
- Caterer UX URLs are configurable through CATERA_CATERER_UX_URL and restricted to loopback. Test-created contexts use that same URL.

## Verification performed on the combined implementation

| Check | Result |
| --- | --- |
| npm run typecheck | Passed: web, native and root TypeScript; rerun after final source changes |
| npm test -- --reporter=dot | 261 tests, 37 files passed |
| npm run test:postgres | All 26 embedded PostgreSQL scenarios passed, with TEST_DATABASE_URL unset |
| npm run test -w @catera/customer -- --silent | 39 tests, 9 suites passed |
| npm run build | Passed optimized production build; final rerun after navigation corrections |
| Caterer UX config | 23/23 passed on a fresh fixture; six relevant date/default/navigation scenarios rerun after the final navigation correction also passed |
| Polish recovery and operational focus | 22/22 passed; operational focus rechecked after integration corrections |
| Broader regression selection | 71 scenarios: initially 58 passed, 10 stale fixtures/assertions failed and 3 required a dedicated fixture; all 10 corrected scenarios passed on rerun, all 3 operations scenarios passed using their dedicated fixture and targeted correction rerun |
| Browser total | 116 distinct selected scenarios passed across these runs; this is not a claim that every repository browser test ran |
| Agent-browser smoke and visual review | Local pages rendered without reported browser errors; marketplace and dashboard screenshots inspected |

Browser coverage includes ID/EN, 320–1920px representative widths, messaging/recipient isolation, admin decisions, refresh errors, keyboard/focus, accessibility assertions, package contents, menu choices, guest auth, purchase/reschedule/support, seller settings, kitchen revisions/CSV and all 10 synthetic direct-payment scenarios. The three operations tests were first skipped in the broad run because their explicit fixture URL was absent; they were subsequently executed separately.

The initial dashboard rerun reused mutated test data and found 103 tasks instead of 102, plus a lower-priority revision task outside the collapsed preview. A new isolated fixture restored the deterministic baseline; no production behavior was weakened to hide those failures. The focus and navigation races were actual integration defects and were fixed.

Local evidence is retained under output/branch-integration, output/polish-v1 and output/playwright/caterer-ux. Disposable databases were isolated under .data/integration-20260922, .data/integration-final-20260922, .data/integration-regression-20260922 and .data/integration-ops-20260922. Servers used ports 3148, 3149 and 3150; unrelated port 3138 was left running. The first inherited timezone scenario still used 3138 before its hard-coded context URL was corrected; that run is not used as final evidence, and the scenario subsequently passed against 3148.

No hosted database migration, real provider transaction, message delivery or physical-device test was performed. Git push and production deployment are separate outcomes; this integration does not claim production promotion.
