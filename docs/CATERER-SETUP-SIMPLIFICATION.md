# Caterer simplification — implementation and study protocol

## Purpose and evidence boundary

Help an owner-operator create a first useful package with fewer unfamiliar decisions and less fear of an unintended commitment. Keep existing business capabilities and purchased terms. The Indonesian interface remains primary; the approved artwork, palette, navigation and delivery-cycle model remain the baseline.

This change is research-informed. No caterer study described below has been performed. Browser and database checks use synthetic data and establish software behavior, not ease of use, adoption, comprehension, hosted readiness, provider acceptance or production performance.

### Research behind the choices

| Evidence                                                                                                                                                | Supported conclusion                                                                                                  | Application and limit                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scheibehenne, Greifeneder & Todd (2010)](https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf), 50 experiments and 5,036 participants          | The average choice-overload effect was near zero, with substantial variation.                                         | Target difficult decisions and uncertainty; there is no universal safe feature or menu count.                                                              |
| [Chernev, Böckenholt & Goodman (2015)](https://www.sciencedirect.com/science/article/abs/pii/S1057740814000916), 99 observations and 7,202 participants | Choice complexity, task difficulty, uncertain preferences and a desire to minimize effort moderated overload.         | Show essential package decisions first and optional controls when relevant. Consumer assortment findings do not determine Catera's exact interface.        |
| [Thompson, Hamilton & Rust (2005)](https://journals.sagepub.com/doi/abs/10.1509/jmkr.2005.42.4.431), three experiments                                  | Capability mattered more before use; usability mattered more after use.                                               | Test completed operating tasks, not just appealing screenshots or requests for features. Student media-player experiments do not prove merchant retention. |
| [Sweller & Cooper (1985)](https://www.jstor.org/stable/3233555), five algebra experiments                                                               | Worked examples improved speed and errors on structurally similar subsequent problems.                                | Use a concrete portion-composition example. This is a hypothesis transferred from education and requires caterer testing.                                  |
| [Compeau & Higgins (1995)](https://misq.umn.edu/misq/article/19/2/189/1161/Computer-Self-Efficacy-Development-of-a-Measure)                             | Computer self-efficacy related to use, expectations and anxiety in a survey of Canadian managers/professionals.       | Provide visible saves, recoverable errors and clear consequences. Association does not establish that a specific UI change causes adoption.                |
| [Davis (1989)](https://www.jstor.org/stable/249008), 152 users and four programs                                                                        | Perceived usefulness and ease of use both correlated with reported/predicted usage; usefulness related more strongly. | Preserve operational value and measure usefulness alongside ease. The study is not a causal test of this redesign.                                         |

## Release 1 behavior

### First package

Retain five steps and direct back navigation:

1. **Package:** identity, package type and meal time.
2. **Contents per portion:** composition with a concrete example, then package photo. Customer-selected dishes and nutrition are optional sections. A customer-choice caterer can create a dish inline without abandoning the package draft.
3. **Price & package length:** base price, delivery days and transparent total. Extra durations, trial and quantity discounts have labeled disclosures with summaries of actual configured values.
4. **Delivery:** operating days, delivery windows, capacity, flexibility and cutoff context.
5. **Review:** commercial summary with edit actions; fuller customer preview is secondary. Save draft and Publish are explicit actions rather than a status selector.

New packages start with trial disabled and price/capacity unentered. Drafts persist an unentered price as `null` and capacity as an empty map; an explicitly entered zero capacity is distinct. Clearing a field must not restore an earlier value or a minimum on blur. Publication requires valid commercial commitments. Published packages and older configured drafts retain their existing values and optional settings.

Optional sections stay discoverable, open when configured or invalid, and summarize their real values. Error recovery exposes the relevant field and moves focus to it. Hidden controls retain unsaved values. User-entered package state survives inline dish creation, failed saves and recoverable validation errors. Explicit draft saving remains available before every publishing prerequisite is complete.

An existing trial with no quantity limit remains unlimited. A newly created dish is selected for the package only when its category is already in the package composition; otherwise a notice explains that it was saved to the dish library. Successful publication offers a direct link to the package's menu workspace.

### Registration and readiness

Suggest the public caterer address from the business name until the user edits that address. After manual editing, later name changes do not overwrite it. Failed submission retains name, address, description and selected delivery areas.

Readiness prioritizes corrections or missing profile information, a first draft, an eligible verification request, then finishing and publishing the package. Pending profile review is distinct from approval; a saved/published package awaiting seller approval is distinct from an offer available to customers. Payout activation remains separate from permission to sell. Status and next action must agree.

### Compatibility and rollout

The new editor depends on readers that safely handle nullable draft prices. Release compatible readers first with `NEXT_PUBLIC_CATERA_PARTIAL_PACKAGE_DRAFTS=false` (the `.env.example` default), then apply the additive migration. After all pilot seller/admin readers are compatible, rebuild with `NEXT_PUBLIC_CATERA_PARTIAL_PACKAGE_DRAFTS=true` to enable the new blank defaults outside demo mode. Explicit demo mode enables them automatically.

Existing incomplete drafts remain editable when the flag is disabled. Rollback must retain compatible readers for already-saved partial drafts. Do not restore invented commercial defaults to make old readers work.

Hosted migration and deployment need a separate authorized release with the repository runbook gates. This local work does not change hosted/shared data, payment credentials or real customer records.

## Release 2 behavior

The second release extends the same approach to repeated operating tasks:

- **Today:** date, meal, preparation and delivery actions remain central. Secondary order filters are disclosed on demand at every width. Active filters have a visible summary and a clear action to reset them while retaining the operating meal. The duplicate order-stage selector is removed; stage actions remain available.
- **Issues:** the attention queue has its own visible date and meal scope. It starts with all dates and both meals. Its optional filters include a specific date or starting date, so changing a kitchen date cannot silently narrow unresolved issues.
- **Schedule:** order filters and grouping share one disclosure. Existing URL filters stay visible through their summary. One clear action resets package, status, search, grouping, customer/destination and meal filters while retaining the date and production view. Whole-day production totals remain distinct from the filtered order table; the scrollable production region is keyboard accessible and labeled.
- **Earnings:** the settlement view remains the money summary. Its payout destination card shows destination and activation information without repeating a second balance summary. The full payout card remains in Settings.
- **Menus:** an empty owner workspace offers a direct action to create or continue package setup. Staff see the relevant owner prerequisite. The reusable dish library remains accessible through a labeled disclosure.

These changes retain the existing filter, grouping, menu, delivery and payout capabilities. Software verification and the human operating-day/menu/money tasks below are separate gates.

## Software verification

Dedicated suite: `tests/e2e/caterer-setup.spec.ts`; configuration: `tests/caterer-setup.playwright.config.ts`.

The suite refuses non-loopback targets and requires the API to report explicit demo mode before writing fixtures. It uses authenticated synthetic commands without resetting shared data. The server must be started separately with an isolated data directory. Default URL: `http://127.0.0.1:3217`; override with `CATERA_SETUP_URL`.

Setup coverage includes Indonesian/English at 390 and 1440 pixels, blank price/capacity after blur, real draft save/reopen/clear persistence, default trial state, preservation of existing optional terms including unlimited trials, publication rejection, registration failure retention, optional error disclosure, keyboard focus, readiness, inline dish recovery and category mismatch, partial-draft display and the post-publication menu link. Screenshots, failure traces and the HTML report are under `output/playwright/caterer-setup/`.

The daily simplification suite covers active filter recovery, independent issue scope, empty menu setup, payout context, filtered versus whole-day totals, keyboard use, reduced motion, accessibility and layout in Indonesian/English at 390 and 1440 pixels.

Required gates after material changes:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:postgres`
- `npx playwright test --config tests/caterer-setup.playwright.config.ts`
- Relevant existing package, customer-choice, seller journey and recovery browser suites.

### Execution record — 27 September 2026

| Check                              | Observed outcome                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup browser suite                | All 21 scenarios passed across runs: 20 in the full run and the remaining case in a targeted rerun after a locator repair. This is not one clean 21-case run.                                                                                                                        |
| Daily simplification               | All 10 new scenarios passed across an initial run and focused repairs. Existing operational/settlement checks passed all 16 scenarios across runs. The real seller-operations suite passed 3/3 in one run, including atomic bulk conflicts, independent meals and whole-day exports. |
| PostgreSQL                         | 28 local assertions passed, including partial-draft persistence and concurrency, and rejection of incomplete publication, quotation, checkout and import without side effects. Evidence: `output/verification/caterer-setup-postgres.json`.                                          |
| Full TypeScript check              | `npm run typecheck` passed.                                                                                                                                                                                                                                                          |
| Unit tests                         | 288/288 passed.                                                                                                                                                                                                                                                                      |
| Other existing browser regressions | Packages/contents 5/5 passed; dialog subset 13/13 passed. The corrected focus-recovery case passed 5/5 repeated runs.                                                                                                                                                                |
| Manual browser checks              | Indonesian at 390 pixels with 200% text, reduced motion and keyboard disclosure: no horizontal page/dialog overflow. A fresh session reported no console errors or warnings. Today at 390 pixels and Schedule/attention at 1440 pixels were visually reviewed.                       |
| Production build                   | Passed (exit 0) with `CATERA_NEXT_DIST_DIR=.next-setup-build` and `NEXT_PUBLIC_CATERA_PARTIAL_PACKAGE_DRAFTS=true`. This verifies the build, not hosted deployment.                                                                                                                  |

These results establish local synthetic behavior only; the participant study, hosted rollout and payment/provider checks remain unperformed for this change.

## Human study protocol — not performed

### Participants and setup

Run a baseline round with **five actual target caterers** and a revised round with **five**, preferably fresh participants matched on business size and digital experience. Include owner-operators, people who mainly use a phone, and caterers who work with one or more helpers. Record device, current workflow, experience and who handles delivery/payment. This is a practical formative sample, not a statistical guarantee or an estimate of population conversion.

Use the same task difficulty, synthetic business scenario, meal dates, portions and money states across versions. Test Indonesian first. Use participants' familiar phones where feasible; otherwise record the test-device limitation. Do not coach a participant before recording independent success or failure. Obtain consent for observation/recording; keep names and customer data out of repository artifacts.

### Tasks

| Task             | Scenario and independent success                                                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First package    | Begin a five-day lunch offer, save before entering price and capacity, leave and resume. Enter the intended commercial terms, explain the customer total and publication consequence, then publish when eligible. Distinguish awaiting approval from availability to customers. |
| Menu preparation | Assign familiar dishes to **two delivery dates** and verify the intended meals and portions without changing a previously purchased package's terms.                                                                                                                            |
| Operating day    | Find meal quantities and recipients for the next operating day, distinguish filtered totals from whole-day output, then update the appropriate meal's delivery status without affecting the other meal.                                                                         |
| Money            | Explain available and pending earnings, held and paid amounts, the payout state and expected window, and any action needed before payout.                                                                                                                                       |

For experienced caterers, add a specialized-feature task that matches their business: configure a customer-choice menu, trial, quantity discount or longer duration and explain its consequences. This guards discoverability of the optional controls; report these participants separately from first-time users.

Include a recoverable failed save and invalid optional setting within the package task. Observe whether the participant keeps their work and finds the relevant correction. Passing software checks does not imply any of these human tasks pass.

### Recording and decision rule

Record raw task results per participant: independent/assisted/failed, completion time, wrong turns, requests for help, errors and the participant's explanation of commitments. Independent success means the intended saved outcome and correct explanation without a moderator hint; assistance is recorded even if the final outcome is correct. Measure time from the task prompt to the outcome check and record abandonment separately.

Use the same custom post-task ratings in both rounds: ease from 1 (very difficult) to 7 (very easy), and confidence in repeating the task from 1 (not confident) to 5 (very confident). Also ask whether the task saves work compared with the participant's current method. Do not describe these custom ratings as validated psychological instruments.

The proposed acceptance gate is **at least 4 of 5 revised-round participants completing each core task independently**, with **zero critical misunderstandings** about price, capacity, publication, delivery obligations or payout. These are product decision thresholds, not established research norms. A critical misunderstanding blocks rollout even if task speed or ratings improve. Review failures by participant segment; never hide a low-confidence user's failure in a combined average.

Examples of critical misunderstandings include publishing unintended commercial terms, believing a saved draft is available to customers, updating the wrong meal or date, and treating pending or held earnings as money available for payout. Record the participant's words and the observed consequence before deciding severity.

Repeat core tasks after several days to check retained understanding. Keep the follow-up separate from immediate completion results. With returning participants, use matched alternate scenarios and report the practice effect; fresh participants are preferred for the main comparison. Compare baseline and revised raw counts and patterns, not claims of statistical significance from five people.

After an authorized pilot, track valid first package, return on the next actual operating day, support requests per active caterer, correct delivery completion and retained use across a full cycle. No percentage improvement or completion-time promise is claimed before those data exist.
