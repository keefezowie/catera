# Catera V1 UI refinement — 30 September 2026

## Goal and scope

Refine small presentation defects across the web app, starting with the seller schedule's detached change-deadline text. The work used Impeccable and the running app to inspect information that appears after opening disclosures, selecting records, changing tabs, opening forms, and receiving conditional results. Work was performed directly on `v1`, preserving existing uncommitted work.

`PRODUCT.md` and `DESIGN.md` remain authoritative. The approved palette, food-led discovery, Indonesian-first interface, delivery-cycle direction, entitlement rules, payment truthfulness, and purchased snapshots are preserved. This is presentation refinement; it introduces no product policy, database migration, provider integration, or native feature.

## Refinements

- **Disclosures:** shared native `<details>` presentation gives summaries a recognizable control, consistent spacing, a chevron, keyboard focus, and a usable touch target. Seller change deadlines are grouped with their explanation and retain distinct passed/not-yet-passed states, purchased cutoff values, and timezone context. The same treatment covers package settings and contents, menu tools, production information, customer records, support history, and financial detail/help sections.
- **Kitchen production table:** readable minimum column widths and contained horizontal scrolling replace the phone layout that split headers and meal words into individual characters. The existing labeled, focusable region supports keyboard and touch panning to the rightmost counts. Photos, whole-day quantities, CSV behavior and A4 output remain intact. Visible production and saved-copy dates, the Orders heading, and opened order details use medium Indonesian/English UTC civil-date formatting; API keys, request dates, and CSV dates retain their existing representation.
- **Conditional results and purchase context:** claim verification, connected/review-required results, unavailable renewal, and replacement-package notices are grouped as readable status information. Renewal shows labeled portions, localized start date, and address facts beside purchase terms.
- **Staff invitation and help history:** the generated code has a label and explanation. Copy and partner-onboarding actions wrap with space and adequate touch targets. Empty help history is separated from the submit action. Clipboard failure preserves a readable code and recovery message.
- **Financial hierarchy:** legacy payout information no longer repeats a surrounding heading. During settlement loading, a genuine retryable error, or unavailable reporting, previous payouts now have an open, bounded disclosure with the existing localized title. Sales remain available and payout review/disputed-fund instructions remain visible; unavailable reporting never invents balances. The installed settlement layout and business rules remain unchanged.
- **Field guidance:** relevant descriptions remain attached to their fields alongside validation errors; price bounds use task language and localized currency. Draft duration examples keep useful price guidance close to the input.
- **Focus and enlarged text:** rejected mobile package-step selection retains focus on the invalid field; ordinary successful selection and Escape retain the picker's normal focus behavior. Nested discard dialogs wait for retained exits before returning focus, without overriding a new deliberate focus choice. Meal-tab keyboard focus survives calendar restoration. Customer actions remain readable and reachable with text enlarged to 200%.
- **English counts:** one cycle, order, or portion uses singular copy; zero and larger counts retain plural copy in checkout, renewal, schedule review, draft/published duration settings, calendar labels, workload summaries, groups and selection captions. Quantities and their calculations are unchanged.

## Final route and state census

The final census used the explicit local synthetic app at `http://127.0.0.1:3241`, independent browser contexts, Indonesian and English, and widths of 390 and 1440 pixels. It waited for resources and hydration, opened available disclosures, and inspected representative controls/dialogs without saving forms. Staff invitation output was intercepted; it did not create an invitation in the store.

| Role | Routes per language/width | Route cases | Captured states |
| --- | ---: | ---: | ---: |
| Guest | 8 | 32 | 44 |
| Customer | 13 | 52 | 120 |
| Seller owner | 10 | 40 | 112 |
| Platform admin | 9 | 36 | 72 |
| **Total** | **40** | **160** | **348** |

The verified final census has **zero page errors, zero unresolved route failures, and zero document horizontal-overflow states**. A single English desktop renewal navigation returned `ERR_ABORTED`; a fresh-context recheck hydrated normally and passed. The original interruption remains recorded in `navigationRechecks` in the verified customer/guest report. The four schedule cases were refreshed after the production-table repair; `scheduleRechecks` in the verified seller/admin report identifies the superseding captures without changing the census counts. The initial census contained transient errors during source edits; those captures are retained as initial evidence and are superseded by the final census.

### Routes and processes inspected

| Role | Routes | Actions and conditional presentation |
| --- | --- | --- |
| Guest | `/`, `/compare`, `/packages/ayam-panggang`, `/caterers/dapur-senja`, `/login`, `/register`, `/forgot-password`, `/seller/onboarding` | Discovery filters, search with no results and recovery, three selected comparisons, package/caterer details, authentication and onboarding route presentation. Comparison keeps its intentional horizontal scroll inside the comparison panel. |
| Customer | `/home`, `/calendar`, `/subscriptions`, `/subscriptions/:id`, `/deliveries/:id`, `/messages`, `/account`, `/addresses`, `/notifications`, `/support`, `/checkout/:id`, `/renew/:id`, `/claim/synthetic` | Calendar controls, purchased package/delivery information, address create/edit dialogs, delivery address/schedule dialogs and explanations, a selected conversation, help request dialog, checkout fields and package contents, renewal context, and invalid-claim recovery. IDs came from the current synthetic API. |
| Seller owner | `/seller`, `/seller/schedule`, `/seller/packages`, `/seller/menus`, `/seller/customers`, `/seller/support`, `/seller/transactions`, `/seller/settings`, `/seller/profile`, `/seller/notifications` | Readiness, schedule cutoffs/production disclosures, new-package validation, published duration dialog, customer detail/edit/message actions, transaction tabs and financial help, invitation result, account help, profile and notification presentation. |
| Platform admin | `/admin`, `/admin/sellers`, `/admin/transactions`, `/admin/support`, `/admin/payouts`, `/admin/settlement`, `/admin/promotions`, `/admin/reviews`, `/admin/audit` | Caterer queue filtering and verification selection, populated support-case review, financial context/decision sections, selected settlement caterer and forms, historical/promotional/review/audit disclosures. |

Additional controlled response captures inspect rejected bank review, failed bank submission, populated financial support decisions and failure, and failed invitation acceptance. Focused regressions exercise distinct deadline states, claim verification and both result states, unavailable/replacement renewal, field-error recovery, invitation copy success/failure, keyboard interaction, and enlarged text. These are synthetic states; they are not live financial or messaging actions.

### Local verification status

| Check | Status |
| --- | --- |
| Final all-role census | Complete: 160 route cases / 348 captured states; zero unresolved failures, page errors, or document overflow |
| Staff invitation geometry, keyboard, clipboard recovery and 200% text | Passed: 4 focused cases across ID/EN and 390/1440px |
| English singular/plural recapture | Complete: 10 cases / 24 states at 390/1440px; single/two-cycle checkout and renewal plus draft/published controls, zero errors/overflow/command requests; no save or checkout creation |
| Production table, panning, whole-day scope and print | Complete: 6 cases / 30 states across ID/EN and 320/390/1440px; zero split header/meal words, errors, document overflow or command requests. Existing CSVs returned 200; two A4 PDFs retain headers, meals, quantities and localized dates with no text outside the page |
| Final order dates, counts and single-update success | Passed: 6 cases / 49 states across ID/EN and 320/390/1440px; localized heading/detail, one/zero/multiple counts, selection captions and focus recovery. One explicitly intercepted update verifies `1 order updated`; zero real business writes, page errors, document overflow or persisted-record changes |
| Broad browser workflows and focused rechecks | Passed: 449 unique scenarios, zero unresolved failures or skipped scenarios; includes separate synthetic Auth and operations fixtures |
| Typecheck, unit tests, production build, PostgreSQL checks | Passed: full web/native/domain typecheck; 47 files / 305 unit tests; optimized production build; 28 PostgreSQL concurrency/authorization scenarios |

The final source also passed 32 controlled development-runtime cases across owner, staff, customer and admin roles in ID/EN at 320/1440px. Separate settlement fallback checks cover 12 loading/error/unavailable states at the same language/width combinations, including keyboard activation, retry recovery, retained financial guidance and four unchanged installed states. These checks used intercepted synthetic responses and made no business-command writes.

Browser test maintenance makes existing prerequisites explicit: open the relevant advanced/preview/owner disclosures before using their controls, complete required wizard price/capacity fields, use current approved step labels and readiness text, wait for dialog entrance motion before measuring hit targets, and measure scrolling geometry in one frame. Long-running tests select populated persisted synthetic dates instead of assuming the fixture date remains today across midnight. Pricing, publication, persistence, authorization, keyboard and exact geometry assertions remain in place; publication and submitted-status assertions were added.

The broad suite includes public/customer journeys, guest authentication, customer menu choice, synthetic direct-payment UI, calendars, menus and dishes, package contents/presentation, seller setup and operations, prepaid/beta lifecycles, multi-cycle purchases, settlement states, navigation, conditional UI, responsive layouts, and existing Impeccable regressions. Tests run sequentially to avoid shared synthetic-store conflicts. Hosted/provider smoke tests are excluded. Registration/recovery form behavior uses separate non-demo synthetic Auth verification; the demo census establishes route presentation only. The staff role-changing acceptance test is separated from the shared customer census.

The initial completed broad run recorded 368 passes and 54 failures across 422 scenarios. Each failure was investigated and has a passing focused recheck after the relevant source repair, current-control prerequisite, settled geometry measurement, or fixture-date correction. One coverage case overlapped a separate synthetic approval test that temporarily hid its caterer; the unchanged coverage workflow passed in the stable store. The aggregate retains the earlier negative results, identifies each scenario by file/description/project, and reports its latest completed result. It does not claim that the initial invocation passed unchanged. Additional regressions and the separate Auth/operations fixtures bring the verified unique scenario count to 449.

## Impeccable detector triage

The single detector pass produced **296 advisory findings**: 199 font-size, 63 color, and 34 radius advisories. It reported no non-advisory findings. These raw-value advisories were reviewed as design-system maintenance suggestions, not treated as proof of visible defects.

Examples include an earlier placeholder color overridden by the current token rule, a muted search icon, print-table borders, chart baselines, semantic pending/error tones permitted by `DESIGN.md`, and existing compact/responsive type and radii. Approved brand choices and functional distinctions were preserved. No literal-value replacement was made solely to clear the detector count. Browser state evidence drove the presentation fixes.

## Evidence

All paths below are relative to the repository root. Generated reports, screenshots and local fixture data are retained locally and excluded from the source commit.

- Final seller/admin verified report and captures: `output/playwright/ui-refinement-2026-09-30/FINAL/seller-admin-census/report.verified.json`. Raw initial final-census output remains beside it; `schedule-after-production/` supersedes the four schedule cases after the table repair.
- Final guest/customer verified report and captures: `output/playwright/ui-refinement-2026-09-30/FINAL/customer-guest-census/report.verified.json`. The raw report and clean renewal recheck are kept beside it for provenance.
- Additional English count report and captures: `output/playwright/ui-refinement-2026-09-30/FINAL/copy-semantics/final/report.json`. Legible dialog/dropdown viewport captures are in `copy-semantics/viewport/` (also 10 cases / 24 clean states). Earlier harness attempts remain in sibling directories; the final reports supersede those locator/capture attempts.
- Production-table measurements, pan captures, A4 PDFs, rendered pages and PDF checks: `output/playwright/ui-refinement-2026-09-30/FINAL/production-table/final/`. The `before/` captures record the original character stacking; the final report supersedes earlier print/harness attempts.
- Initial census and controlled hidden-state evidence: `output/playwright/ui-refinement-2026-09-30/census/`.
- Focused context/field evidence: `output/playwright/ui-refinement-2026-09-30/context/` and `fields/`.
- Impeccable detector output: `output/playwright/ui-refinement-2026-09-30/impeccable-detect.json`.
- Final required checks: `output/playwright/ui-refinement-2026-09-30/FINAL/typecheck.log`, `tests.log`, `build.log`, `postgres.log`, and `postgres.json`. The pre-existing `output/verification/postgres.json` was preserved byte-for-byte.
- Controlled development-runtime proof: `output/playwright/ui-refinement-2026-09-30/FINAL/production/development/report.json`; fallback before/after proof: `fields/settlement-fallback-{before,after}-checks.json` under the same evidence root.
- Browser configs: `playwright.ui-refinement.config.ts`, `playwright.ui-refinement-auth.config.ts`, and `playwright.ui-refinement-operations.config.ts`.
- Definitive browser aggregate and reproducible summarizer: `output/playwright/ui-refinement-2026-09-30/FINAL/browser-summary.json` and `summarize-browser.mjs`. They retain the full 422-case `workflows-final.json` plus completed final focused reports, `auth.json`, `operations-final.json`, the repeated calendar check and invalid-field focus recheck. Earlier interrupted/diagnostic `workflows.json`, `operations.json` and `context.json` are not final success evidence.
- Latest seller order dates/counts and detail/focus captures: `output/playwright/ui-refinement-2026-09-30/FINAL/seller-order-dates/`. These separate captures verify the last visible copy changes after the route census without increasing its 160/348 counts. The final workload and daily-control rechecks are `ux-clarity-counts-final.json` and `daily-counts-final.json`.

## Evidence boundaries

This evidence covers exercised local synthetic routes, records, forms, disclosures, and controlled conditional responses. It does not establish that every possible data combination is perfect. Empty/populated queues and payment/recovery variants depend on the separate focused/browser suites rather than every variant occurring naturally during the route census.

Desktop Chromium at representative viewport sizes is not physical-device, Safari/Firefox, live provider, hosted Supabase/Auth/RLS/realtime, real SMS/SMTP, or user-study proof. No production data, payment provider, real invitation recipient, or hosted service was changed. Native work remains paused. No deployment or hosted migration was performed. Commit and push to `v1` were separately authorized on 1 October 2026 after the refinement verification finished.

The temporary test servers were stopped after verification. Eight task-specific generated TypeScript include paths were removed, and the initially clean `next-env.d.ts` was restored. Existing unrelated TypeScript configuration and the pre-existing PostgreSQL evidence file were retained and excluded from the UI commit. The final whitespace check passed; work stayed on `v1`.

Automatic approval review blocked both attempts to start an optional local optimized-build server, returning "blocked by policy" with no further reason. No further start or bypass was attempted. The optimized build itself passed; production runtime/CSS ordering remains unverified. The prepared reproduction script and this boundary are recorded in `FINAL/production/README.md`.
