# Caterer journey implementation and local evidence

Implemented the approved 19-family plan on `codex/caterer-journeys`, based on `033fb5bfbdb61735f82c39f899a6f43415bd89f6`. The isolated checkout is `C:/Users/nidal/.codex/worktrees/caterer-journeys/catera`. The original `D:/Project/Catera/catera` checkout, its uncommitted files, and the supplied port-3107 preview were preserved.

Changes are local and uncommitted for review. No push, deployment, hosted migration, real customer message, or real payment was performed. Forest/sunrise/cream tokens, Jakarta typography, existing artwork and food imagery, Indonesian-first copy, and English support are preserved.

**What changed**

| # | Journey | Implementation and evidence |
|---|---|---|
| 1 | Enter/create workspace | Existing owners/staff receive their workspace destination; applicants see the full public-page URL. Missing delivery coverage gives actionable validation without clearing fields. Both operator roles and an account without a workspace were exercised. Real signup remains separate. |
| 2 | Profile and verification | Draft, submitted, corrections, and approved guidance differ. Review notes and prerequisites accompany the next action. Profile drafts retain their original optimistic version in workspace memory; review submission waits for saved changes. All four guidance states and a rejected save were browser checked; bank activation is explicitly separate. |
| 3 | Create/publish package | Existing five-step wizard remains. Meal windows follow the selected meal; review includes commercial terms, capacity, cutoff/timezone, and immutable-term guidance. Draft/publication controls remain distinct. A real synthetic wizard publication and purchase before dated menus passed. API-created packages plus detail inspection cover both package types × both menu modes × three meal combinations (12 combinations); this is not 12 complete wizard submissions. |
| 4 | Inspect/suspend/archive | Added read-only package details; details and menu management precede secondary lifecycle controls. Named confirmation explains existing deliveries and no reopening. Cancel sends no command. A double-click suspension followed by archive persisted exactly two version increments. Server archive eligibility remains authoritative. |
| 5 | Duration pricing | Explicit unsaved indicator and keep/discard choices; fresh sessions initialize from committed values, including an immediately completed save. Cycle-specific discount labels and conflict retention preserve newer pricing. Discard, failed conflict, successful save and reload passed. |
| 6 | Dish library | Category-specific creation prefills the category. Dish forms guard unsaved work, preserve search/context, and explain library versus package/customer snapshots. Category creation, keyboard selection, invalid-image retention, editing and save/reload passed. |
| 7 | Caterer-selected menus | Package, purchased revision, month, meal and selected date persist in query state. Dirty dated-menu drafts remain in memory with their original versions. Locked-date guidance is specific; replacement confirmation remains. Fixed a date-query remount that previously reset month/focus. Tablet, phone, keyboard focus, batch replacement and conflict recovery passed. |
| 8 | Customer-choice menus | Counts remain unknown while loading or failed. Options are grouped by category with required and active counts. Attention links identify date, delivery and meal. Delayed/error/retry reads and category grouping passed; actual selections, saved dishes in delivery/CSV, reset, and atomic multi-date behavior passed. Existing category-sufficiency and fallback command rules remain. |
| 9 | Recurring capacity | Package details expose operating weekdays, recurring portions, meal windows and timezone without adding published-term editing. Combined meals explicitly reserve capacity once per day. Read-only details were checked across all 12 package combinations. No date-specific capacity controls were introduced. |
| 10 | Start the day | Compact zero-exception panel; populated priority queue and all-date/lunch/dinner scope remain. Empty-state browser simulations passed at 390/1440 in both languages. Dinner tasks remain separate from the selected meal; existing server operational dates remain authoritative. |
| 11 | Schedule/order details | Filtered-empty results can reset filters. Selected delivery persists in the URL; Back, reload and close restore detail/context and keyboard focus. Existing inline filters and stale-response protection remain. Whole-day and filtered totals stay distinct. |
| 12 | Production handoff | Authorized seller read returns latest saved revision ID, timestamp and change status using the existing signature. Saved-copy download survives reload. A filtered-empty table still produced a 12-portion, six-row lunch/dinner whole-day print view and CSV across three packages. Browser print media was inspected and a PDF generated. |
| 13 | Fulfil deliveries | Completion feedback identifies count, meal and status. Failed updates retain selections; selections invalidated by refreshed data receive an explanation and reset action. Browser bulk-conflict recovery and independent meals passed. PostgreSQL verified atomic mixed-version batches, retries, tenant boundaries and reservation/fulfilment concurrency. |
| 14 | Customers/change delivery | Added literal name/phone search with matching totals/pagination. Customer/filter/search and calendar context use the URL. True-empty and filtered-empty guidance differ. Date/address fields stay mounted and retain the reason when switching. Dialog identifies customer, package and original delivery. Actual date/address saves, failure retention, reload and focus recovery passed. |
| 15 | Prepaid obligations | Import moved to a secondary owner disclosure; form groups customer, obligation and payment reference. Review/back retains entries; completion opens the imported customer's schedule. Four browser cases cover both languages and 390/1440, preview, failed commit/retry and completion. Zero-price legacy obligations and no new payment/payout are unchanged. |
| 16 | Messages/support | Case/conversation/issue selections persist. Replies and first-message drafts are keyed by record in workspace memory; failures retain text and departure is guarded. Seller empty messaging directs to customers. Actual support reply and delivery-issue resolution/escalation passed; financial decisions remain with Catera. WhatsApp preparation still makes no delivery claim. |
| 17 | Transactions/bank | Compact balance/readiness overview and top tabs; Sales is default. Chart/range live within earnings activity. Bank/legacy payouts are in payouts. Tab/range/payout details survive navigation; retained refresh errors are explicit. Bank submitted/rejected/approved/ready states have truthful guidance; no confirmed processing date appears from approval alone. Financial layout, chart keyboard/race, missing rollout, retry, payout history and administrator caterer switching passed. |
| 18 | Staff/account | Staff financial routes show an owner-only explanation while the API continues denying financial reads. Invitations include copy feedback and instructions; failed acceptance retains code. Local invite creation, clipboard copy, acceptance, persisted staff role and financial denial passed. Sign-out failure/retry passed in both languages. Account help remains separate from business settings and does not promise immediate deletion. |
| 19 | Notifications | Shared notification component/data serves existing `/notifications` and `/seller/notifications`; seller header preserves its operations return URL. Read failures are visible and retryable. Mocked failure/recovery and exact task links passed; an actual synthetic read acknowledgment was independently re-read from the API to confirm persistence. |

**Implementation boundaries**

`journey-state.tsx` centralizes local query navigation and unsaved/discard behavior. `context.tsx` stores actor-scoped in-memory drafts; no new automatic browser-storage persistence contains messages or personal details. URL record selections are resolved against authorized returned records. Changing a URL does not grant access.

`20260924150757_caterer_journey_reads.sql` extends the existing authorized read chain with customer search/matching totals, latest production metadata and precise attention links. It adds no business tables or command contracts. The renamed underlying RPC is private to prevent bypass. Local tests cover 103 matching customer records over two pages, literal wildcard searches, missing records, staff access, customer/cross-tenant denial, saved-copy change detection and exact attention links. This migration is **not applied to hosted Supabase**. Existing clients without the migration cannot provide full search/production-recovery behavior, so these are release-coupled changes.

Tenant transactions, request idempotency, optimistic versions, cutoff rules, complete-portion reservations, immutable purchases, zero-price prepaid obligations, independent lunch/dinner fulfilment, and seller/admin financial authority remain in their existing command implementations.

**Verification evidence**

Synthetic stores are separate from the user's preview: `.data/journeys-20260924` on port 3131 and `.data/journeys-seller-operations-test` used port 3132, with explicit demo/fixture flags and separate Next output directories. The port-3132 test server was stopped after verification; [the implementation preview](http://127.0.0.1:3131/seller) remains available. The second store's synthetic customer accepted a staff invitation; it is intentionally unsuitable for rerunning customer tests without resetting that dedicated fixture. PostgreSQL checks used the repository's isolated embedded PostgreSQL runner.

| Check | Result |
|---|---|
| `npm run typecheck` | Passed web, native-source and root TypeScript checks; no native UI changes or device validation. |
| `npm test` | 38 files / 264 tests, including three new authorized-read regressions. |
| `npm run build` | Optimized Next.js production build passed. |
| `npm run test:postgres` | 27 evidence statements passed, including reservation, fulfilment, menu, immutable-term, import, payment and read-authorization concurrency checks. Provider operations were synthetic. |
| Journey core/recovery + customer choice | 21 Playwright cases passed. |
| Profile/dishes/customer changes + prepaid + slot menus | 19 Playwright cases passed. |
| Settlement dashboard | 12 Playwright cases passed. |
| Settlement rollout/failure compatibility | 4 Playwright cases passed. |
| Seller operations | 3 Playwright cases passed against the separate operations fixture. |
| Handoffs | 4 cases passed across focused runs: 12 package combinations/lifecycle, notification retry, production/print, invitation/role. |
| Account/onboarding | 3 cases passed. |
| Delivery issue → response → operational resolution → escalation | 2 cases passed in Indonesian/English. |

The 68 targeted browser cases above passed across focused runs, not one combined clean-database suite. Earlier failures included outdated fixture assumptions and shared artifact output collisions; final runs use distinct report directories. UI defects found during implementation included menu query remounting, inaccessible scrollable conversation history at enlarged size, package-grid compression, and the administrator's invalid default financial tab; all were corrected and rerun.

The screen matrix is **80 rendered screens**: ten seller routes × two languages × 320/390/768/1440 widths. No page-level horizontal overflow was detected. **40 axe scans** covered all ten routes at 390/1440 in both languages with no detected violations in `main`. Additional tests exercise tablet, keyboard selection/focus return, chart keys, 200% CSS enlargement on five screens, and 200% root-text sizing on settlement. CSS enlargement is browser emulation, not a claim of physical-device or native browser-menu zoom certification. Four additional compact-empty-attention screenshots cover both languages at 390/1440.

Read failures, loading/unknown counts, true and filtered empty, retained-data refresh failure, save failure, conflict and retry were exercised on affected surfaces. The matrix does not exhaustively cross every error with every route, locale, width and business state.

Evidence is under `output/playwright/journeys/`, with final focused HTML reports under `output/playwright/journeys-report-*` and PostgreSQL evidence in `output/playwright/journeys-postgres.json`. Useful captures include `review-finance-390.png`, `en-1440-packages.png`, `id-390-customers.png`, `empty-attention-id-390.png`, `whole-day-print.png`, and `whole-day-handoff.pdf`. Browser captures and reports are local review artifacts, not hosted acceptance evidence.

**MCP execution**

| Capability | What actually ran |
|---|---|
| Playwright MCP | Ran during this implementation: real browser navigation, API-backed synthetic actions, screenshot inspection, responsive checks, empty-state simulations and persisted notification acknowledgment. Playwright CLI also ran the repository tests; axe ran through the installed library. |
| UX MCP | The approved planning pass recorded a successful heuristic review. Not rerun during implementation. |
| shadcn MCP | The approved planning pass recorded successful component-reference retrieval. Not rerun during implementation. Existing Catera controls were reused. |
| Design Inspiration | Planning attempt failed because the registered process lacked the Serper environment variable. No successful run is claimed here; changing a key does not prove a running process picked it up. |
| Vercel connector | Planning lookup failed argument validation. No deployment action was taken. |
| Chrome DevTools / 21st.dev / Figma | Did not run. |

The Codex worktree tool also ran. Official Supabase documentation was consulted through the web tool; that is not a design-MCP run.

**Remaining verification and release work**

- Apply and verify the read migration in an authorized hosted environment, then check tenant/RLS behavior and representative hosted volumes. Local synthetic and embedded PostgreSQL results do not prove hosted configuration.
- Real signup/password recovery/email/SMS, invitation delivery outside the browser, provider callbacks, transfers/payout arrival, real refunds, and production payment onboarding remain unverified. Automated payment/concurrency fixtures do not establish provider acceptance.
- Cross-browser engines, physical devices, actual browser-menu zoom, physical printing, production performance and seller usability studies remain unverified. Automated axe and reflow checks do not prove complete accessibility or comprehension.
- Full Cartesian coverage of all package/verification/linkage/support/financial states is not claimed. Twelve package combinations were created through the API and inspected; representative wizard and saved-state journeys were completed through the browser. Financial administration and refund approval were not redesigned.
- Sensitive drafts intentionally survive client navigation in memory, not a closed browser or confirmed full reload. Browser unload warnings and in-app discard choices protect that boundary.
- Automatic approval review rejected launching an additional optimized local preview on port 3133 with the stated reason **“blocked by policy.”** No alternate launch was attempted. The optimized build passed, but runtime verification used the existing development previews. Port 3131 is the implementation review preview.

Before release, review this local diff and the migration together, stage an explicit file allowlist, and run the separate hosted/provider gates in `docs/RUNBOOK.md`. Pushing, deployment and hosted migrations remain separate actions.
