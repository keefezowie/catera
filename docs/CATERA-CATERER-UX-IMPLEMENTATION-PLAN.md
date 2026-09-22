# Caterer operational UX — implementation and verification plan

## Baseline and boundaries

Inspected 2026-09-22 at `b36f9a6facb9fdd960e3288b66957fa1ab91fd5d`, newer than brief baseline `f37e99f`. Worktree branch: `codex/caterer-dashboard-ux`. Original checkout has unrelated untracked output directories; preserved. Read root/web AGENTS, PRODUCT, DESIGN and installed Next Link/search-parameter guidance. The attachment provides requirements, not proof of implementation or observed user understanding.

Local test server: loopback port 3138, explicit demo mode, `.data/ux-final/caterer-ux-test`, `.next-caterer-ux`. No hosting changes, shared data, financial transactions or outbound messaging. Fixture setup is direct local synthetic SQL, not evidence of customer purchase onboarding. Failed first fixture attempt was abandoned in a separate local directory.

## Verified problem register

| ID | Finding | Evidence / decision |
|---|---|---|
| UX-01 | confirmed | Shell copies date into Today href; historical page/table heading says Today. Server already returns authoritative today and operationalDate. |
| UX-02 | confirmed | Missing meal always becomes lunch; tabs omit quantities. Keep explicit meal; choose dinner only when lunch has no active quantities and dinner does. Persist chosen default for refresh stability. |
| UX-03 | confirmed | Operational KPIs count orders, not portions; existing scheduleSummary correctly counts meal occurrences. Reuse it. |
| UX-04 | confirmed | Headline is recurring cutoff clock, although each delivery has cutoff_at. Group actual dated deadlines; do not invent one universal deadline or new eligibility policy. |
| UX-05 | confirmed / partially already correct | Kitchen is collapsed below Schedule table; whole-day input and production redirect already exist. Preserve them. |
| UX-06 | confirmed | Broad queue and selected-meal issue KPI both say Needs attention. Remove competing KPI. |
| UX-07 | confirmed | Service returns priority-sorted first 100 plus full total. Baseline 390px page exceeds 13,000px with queue above meal controls. |
| UX-08 | confirmed | Two date pickers; customer/destination grouping discovered through KPI buttons. Explicit inline group/filter controls replace these. |
| UX-09 | confirmed | Summary calculated from rows before filteredRows. Production deliberately uses dayRows. Keep those distinct. |
| UX-10 | evidence-dependent | Preserve bottom bar provisionally: direct exception actions and one-activation kitchen entry address daily work. Compare mobile paths after implementation. |

Baseline screenshots: `output/playwright/caterer-ux/before-{today,schedule}-{id,en}-{390,768,1366,1440}.png`. Capture and inspect matching after views. User speed/comprehension remains unmeasured.

## Ordered implementation tasks, dependencies, risks and tests

1. **Context and workload (UX-01–04)**. `application.tsx`: primary Today clears retained scope. `seller-operations.tsx`: remount loader by requested date, refresh server context periodically/on focus, explicitly label service date; normalize/persist initial meal once; prevent stale rows/actions on fetch changes. Add small pure read selectors in `packages/domain/src/seller-operations.ts` for meal workloads and dated deadline grouping, using existing status/cutoff fields. Use stage portions, exclude cancelled workload, keep issue distinct. Dated cutoff is customer-change context, never an operational lock. Tests: exact mixed fixture, dinner/empty/explicit selection, timezone, deadline boundaries, history and stale responses. Dependency: existing seller payload is sufficient; no API/schema changes.
2. **Kitchen handoff (UX-05)**. `seller-operations.tsx`: prominent whole-day link opens existing production section above table, retaining selected date. `seller-production.tsx`: live total/date/scope and saved-revision distinction, retain explicit freeze/download and guard loading print. Date-keyed mount prevents late old-date save from exposing a wrong-date CSV. `seller-operations.css`: print only kitchen output. Tests: filtered 4 versus whole-day 17, actual save/download contents, print media/PDF, changed revision attention, failed save and date-change race. Dependency: task 1 scope separation.
3. **Attention and filtering (UX-06–10)**. `seller-attention.tsx`: scoped total, three priority items, inline show-all/collapse, returned-limit disclosure, truthful loading/error/zero. `seller-operations.tsx`: single Schedule date area, explicit grouping and customer/destination filter with search, reset dependent filters, summary from visible rows; cancelled quantities labelled historical. Keep package/meal/status capabilities. `seller-operations.css`: compact stage/date/control layouts with existing tokens. Tests: 100 valid orders, >100 queue total, broad tasks when selected meal has no issues, grouping/filter/back behavior, ID/EN phone/tablet/1366x768/desktop and keyboard. Preserve mobile nav if direct links resolve task paths.
4. **Regression and evidence**. `tests/fixtures/caterer-ux.mts`, `tests/e2e/caterer-ux.spec.ts`, focused domain tests and isolated Playwright config. Run focused tests then `npm run typecheck`, `npm test`, `npm run build`, `npm run test:postgres`, relevant existing browser cases. Native source unchanged; use typecheck and report lack of native device validation. Record actual results and limitations separately from planned checks.

## Scope contracts and devil's-advocate review

- Server defines current operational day using caterer timezone. Explicit date remains selected through rollover; unscoped Today refreshes server context and clears batch via date key. Browser timezone never defines today.
- Meal tabs show whole selected-day lunch/dinner quantities, independently labelled; immediate Schedule summary matches every table filter. Status stages use fulfillment status, not combined day status. Cancelled rows remain reviewable but are not kitchen workload.
- Broad attention is across dates and both meals, exactly the service total. Do not merge separate tasks or expose new payment actions.
- Kitchen receives original whole-day deliveries, never filteredRows. Print/CSV/revisions retain domain generation. Live overview does not assert latest saved revision freshness; attention remains the existing change warning authority.
- Risk: too many chips could replace too many cards. Use one workload block and plain stage text. Risk: default meal changes after refresh. Persist initial meal in URL without changing explicit selection. Risk: moving queue conceals urgency. Keep three highest-priority items directly inline, no modal/More dependency. Risk: filter reset surprises users. Reset only dependent scope filters and retain visible reset control. Risk: clock drift affects deadline open/passed presentation; use absolute authoritative timestamps and keep server eligibility decisive.
- Preserve transactional permissions, atomic batches, versions, conflict feedback, cutoff rules, purchase snapshots, audit/idempotency and all original output functions. No new business policies or modules. Human usability, real-device and hosted acceptance are outside local evidence.

## Execution record

Plan written after source inspection and baseline synthetic rendered capture, before application edits. Results will be recorded in `docs/CATERA-CATERER-UX-VERIFICATION.md`.
