---
target: Active V1 desktop customer and caterer flows
total_score: 31
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
target_identity: "file:/workspace/catera/work/v1-integration/apps/web/src/components"
timestamp: 2026-10-06T02-23-19Z
slug: apps-web-src-components
---
Method: dual independent assessments; A completed before B findings were unsealed.

# Independent Assessment A — active Catera V1 desktop flows

Assessment A only. No detector output, other agent findings, earlier scores/reports or builder summaries were read. Read AGENTS.md, PRODUCT.md, DESIGN.md, critique scoring/cognitive/persona reference, and only the first 31 lines of the landscape contract. Own fresh Chromium/Playwright contexts, explicit synthetic customer/owner auth, local production build 127.0.0.1:3147. No source edits or business-state writes. Main evidence 1920×1080 and 1920×1200; EN and ID, with 1280×800 and 390×844 secondary checks.

## Design specificity (judged before any detector input)

This feels authored for Catera. Food photographs, forest emphasis, cream canvas and Jakarta typography establish an appetizing customer surface; the home layout turns the meal cycle into a useful composition: next arrival and dated lunch/dinner agenda left, purchased packages and explicit renewal right. The seller surface reduces decoration and makes date, meal, portions and exceptions the organizing structure. The same meal vocabulary crosses the two sides. Generic rounded controls remain, but this is not a generic analytics dashboard wearing food imagery.

The desktop objective is convincingly met in the main scenes: actual package price and name in the marketplace, next-delivery action and all three active packages on home, selected lunch and dinner cards together on calendar, and a populated operational row beneath the workload/attention band. At 1280×800, both customer calendar meals and the seller schedule's first order remain readable. Remaining improvement is chiefly in review density and recognition inside secondary work, not wholesale layout change.

## Nielsen scores — Operate, all ten applicable

| # | Heuristic | Score | Observed evidence / reason short of excellent |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Selected date/meal, portion totals, filtered row totals and delivery states are clear. Conflict recovery simultaneously says refreshed and asks to reload. |
| 2 | Match system / real world | 4 | Portions, delivery days, lunch/dinner, included delivery, deadlines in Asia/Jakarta and prepaid/nonautomatic renewal are explained in ordinary customer/seller language. EN scenes preserve the meaning. |
| 3 | User control and freedom | 3 | Calendar arrows, date selection, back links, disclosure controls, cancel selection and Escape from reschedule/attention work. No broad undo for operational status; detail is a separate inline close interaction. |
| 4 | Consistency and standards | 3 | Cohesive navigation, forest primary actions, quiet status chips and familiar controls. Different review presentations (inline full-width detail versus narrow dialog) require slightly different scanning strategies. |
| 5 | Error prevention | 3 | Future-date status updates disabled with reason; reschedule shows original/replacement, portions and address; received confirmation includes recipient, consequences and required acknowledgement. Exhaustive cutoff/refresh edge behavior not established in this run. |
| 6 | Recognition rather than recall | 3 | Date and meal context travel with work; saved addresses, package names and selected scope are visible. Repeated attention subjects still require interpreting references/timestamps to recognize the right person. |
| 7 | Flexibility and efficiency | 3 | Keyboard calendar arrows verified; order selection/bulk controls, grouping/filtering, next-delivery shortcut and phone Swipe/List alternatives are visible. Wide detail panel imposes unnecessary eye travel. |
| 8 | Aesthetic and minimalist design | 3 | Strong meal-first hierarchy, calm operations and useful disclosure. The ultra-wide detail facts and stacked conflict notices dilute otherwise disciplined composition. |
| 9 | Error recovery | 3 | A synthetic CONFLICT returns to review, retains chosen date, visibly refreshes and offers Reload status & dates. Old red reload instruction remains after successful refresh, weakening certainty. |
| 10 | Help and documentation | 3 | Task-specific date-availability help, checkout portion/cycle explanations, status-update guidance and receipt consequences. Contextual help is good; comprehensive searchable help was outside inspected scope. |
| | **Total** | **31/40** | **Good** |

No P0 or P1 found in observed desktop tasks. This is not an exhaustive release or accessibility certification.

## Three strengths

1. **Desktop context is attached to action.** Home next-meal action, adjacent active packages, and calendar lunch/dinner grouping make the product promise tangible without a banner competing with the task. See customer-home.png, calendar7.png, calendar-1280.png.
2. **Seller workload uses real operational units.** Date/meal selection, portion status buttons, filtered row counts and whole-day production are distinguishable. The empty Oct 6 state is legitimate and clearly dated; Oct 5/7 demonstrate populated behavior. See seller7.png, schedule-en.png, production.png.
3. **High-stakes review is unusually concrete.** Reschedule explains that the old date remains safe; received confirmation names date, meal, source/target status, recipient, address and portion count, and requires explicit acknowledgement of receipt. See review.png and receipt.png.

## Priority issues

### P2 — Conflict recovery gives two different next-step instructions

At /deliveries/:id, open Ubah jadwal → Tinjau perubahan → confirm while intercepting POST commands with HTTP 409 {error:{code:'CONFLICT'}}. After automatic refresh completes, the upper notice says “Status pengantaran sudah dimuat ulang. Periksa cakupan terbaru sebelum mencoba lagi.” with Reload status & dates. The lower red error still says “Data sudah berubah. Muat ulang sebelum mencoba lagi.” Review is enabled and the selected date is retained.

This is a recovery-copy/state problem, not evidence that refresh failed. Jordan must decide whether the refresh already happened or whether another reload is mandatory. Replace the transient conflict error after successful refresh with one current-state notice: “Data terbaru sudah dimuat. Periksa tanggal lalu tinjau lagi.” Keep a reload action as secondary, separated from sentence text. Before refresh success, retain the failure/retry message. Source: customer.tsx recovery/error presentation. Evidence: conflict.png, edges.log. Suggested command: clarify/harden.

### P2 — Wide order details spread labels and values across nearly the entire work area

At 1920×1200, open Oct 5 order Detail. The inline detail is roughly 1,530px wide; labels start around x340 and short values align near x1820. Date, portions, cutoff and meal state need full-screen eye travel for every row, while the panel also moves the viewer away from top-level date/workload context. This is particularly inefficient for Alex repeatedly checking addresses/instructions and Sam tracking rows with low vision.

Use a bounded facts column (around 640–800px), or a desktop two-column detail layout with customer/destination together and date/cutoff/status together. Preserve inline focus and explicit close; do not make the entire order table narrow. Evidence: order-detail.png. Source: seller-operations.tsx detail-panel + scoped CSS. Suggested command: layout.

### P2 — Repeated attention subjects are technically unique but weakly recognizable

The drawer's three leading entries have identical subject and package. Reference fragments and timestamps distinguish them, but no customer/destination identity appears. This is visible in the existing explicitly synthetic repeated-subject data; the critique concerns the row structure, not demo wording. References solve uniqueness but leave a seller recalling or opening cases to identify whom to help.

Where the API supplies identity, show customer name and delivery date/destination beneath the subject; keep reference tertiary. If identity is unavailable, use the best meaningful case context before the opaque ID. Preserve scope and the View all count. Evidence: attention-stable.png. Suggested command: clarify.

## Cognitive load

**Moderate, two checklist failures overall: chunking and minimal choices.** Marketplace exposes six quick-filter options; operational workload exposes five status choices; customer date strip exposes around nine days on wide desktop; seller sidebar has eight destinations, sensibly split into two groups of four. These counts do not independently justify hiding useful controls: meal/day/status choices are well grouped and spatially stable.

Single focus, grouping, hierarchy, one-step decisions and progressive disclosure mostly pass. Working-memory support is strong in purchase/reschedule/receipt reviews, but the attention queue is the specific recognition exception. The wide detail panel creates avoidable visual tracking effort, even though it has little actual content.

## Emotional journey

Food-led discovery and next-meal imagery create anticipation. Package/checkout copy reduces commitment anxiety through fixed portions, included delivery, explicit cycles and no automatic renewal. Reschedule's old-date safety promise is a good reassurance at the potential emotional valley. Receipt acknowledgement conveys appropriate seriousness. The conflict's two competing instructions leave a small uncertainty at the end of an otherwise recoverable action; that ending deserves more attention than another decorative improvement.

## Persona red flags

- **Alex, impatient operational user:** repeated detail inspection is slowed by full-width label/value separation; similar attention rows require extra case opening or reference recognition. Bulk selection and direct row actions are strengths.
- **Jordan, first-time customer:** dual conflict notices obscure the next step; otherwise portion/delivery-day explanations and review summaries are strong scaffolding.
- **Sam, keyboard/low-vision user:** calendar ArrowRight moved focus from Oct 7 to Oct 8 with a full date/meal accessible label; reschedule Escape dismissed after the transition. Full-width facts make visual row tracking harder. No screen-reader or 200% zoom certification was performed.

## Minor observations and limits

- EN seller meal tabs render a leading separator before counts (“· 1 portion” on its own second line), a small polish issue, not a comprehension blocker.
- Customer calendar deliberately clips the next date at the right edge and provides an arrow. Offscreen date text in DOM dumps must not be mistaken for a giant visible loading calendar.
- An early screenshot caught attention drawer animation mid-transition; attention-stable.png is the settled evidence and is opaque/readable.
- Customer home and discovery phone scenes remain usable with bottom navigation; phone seller schedule needs scrolling to reach orders. This run's primary verdict concerns desktop.
- Receipt used a route-local raw synthetic seller fixture with today advanced to Oct 7 and fulfillment set out_for_delivery. No delivery command was committed. Single receipt dialog and selected-order bulk controls were inspected; final bulk evidence is receipt-bulk.png when present.
- Conflict used the real domain code CONFLICT. An exploratory invalid VERSION_CONFLICT response produced generic fallback and is not counted as an application defect.
- No failing-refresh/retry, in-flight cutoff-expiry, genuine concurrent backend writers, live payment or physical device flow was completed in this assessment; no excellence claim is inferred for them.
- All completed scripts close their own browsers; no browser/server was left running by this agent. No source or production mutations. Own screenshots/scripts/logs remain in work/wide-score-a for parent synthesis.

Questions for parent synthesis if useful: prioritize (a) recovery certainty, (b) repeated-case recognition, or (c) wide detail reading? Address all three P2 items or only the first two? User-facing question policy belongs to the parent, which has full task authorization context.


# Assessment B — fresh detector and browser verification

Target: active V1 `apps/web/src/components`, `/workspace/catera/work/v1-integration`. Server: optimized synthetic production build at http://127.0.0.1:3147. No source edits or real business commands. No prior reports, scripts, grades or other agent assessments were opened; only the two authorized raw JSON fixtures were used. Findings stayed sealed until the parent explicitly unsealed after A finished.

## Concrete defects

1. **P2 — Seller bulk completion and conflict recovery lose keyboard position.** Across ID and EN at 1920×1080, 1920×1200, 1280×800 and 390×844, opening the batch confirmation focuses its safe review button, but success clears the selected items and removes the trigger; focus ends on `BODY`. CONFLICT followed by a failed GET refresh also ends on `BODY`, while the trigger remains disabled. Retry correctly reloads and submits version 2 instead of version 1, but focus is not carried to the error/retry or a stable order heading. `seller-operations.tsx:1271` update handler, `:1747` confirmation Dialog; the reusable Dialog already supports `fallbackFocus` (`ui.tsx:158`), but this invocation supplies none. Supply a focusable stable orders heading/summary, and send failed refresh focus to an actionable recovery notice. Evidence: all eight `journeys.json` runs (`owner.failedRead.focus`, `owner.successFocus`), including fresh version command payloads.

2. **P2 — Attention drawer has no stable focus return when zoom changes the breakpoint.** Normal-width Escape returns to “View issues” / “Lihat masalah” in both languages. Opening at desktop, testing reflow at 200% equivalent CSS viewport (1920→960 or 1280→640), then Escape leaves focus on `BODY`: the desktop opener is hidden at the narrower breakpoint. This is a reflow simulation, not an automated browser-toolbar zoom setting. The drawer remains within the viewport and Tab/Shift+Tab stays trapped, but closing loses position. `seller-attention.tsx:379` Dialog should receive a fallback to a focusable attention heading or equivalent compact-view control. Evidence: `journeys.json` drawerReturn vs `supplement.json` drawer-return-normal.

3. **P2 — Operational and delivery metadata is still very small.** The clean browser detector confirms 10px functional text in calendar month markers and package counts (`meal-calendar.css:140,180`), trial labels (`globals.css` `.image-label`), and the seller workspace name (`globals.css` `.workspace-label small`); 11px body text also appears in attention scope (`landscape.css:362`), marketplace reassurance (`landscape.css:77`), and three onboarding explanation paragraphs (`globals.css:1271`). Raise metadata to 12px and explanatory copy to 13–14px while retaining the density. These are Impeccable readability rules, not axe/WCAG pixel-size violations. The 10px synthetic demo ribbon is lower priority than task-bearing metadata.

4. **P3 — English remaining-day fact is grammatically inconsistent.** The purchased two-portion, one-day Rantang Nusantara fixture correctly shows “1 day remaining” in its badge, then “Remaining days / 1 days” in its facts. `customer.tsx:666` always uses `days`; choose `day` when `s.remaining === 1`. ID is correct. Evidence: `supplement.json` currency entry with portions 2, days 1, total 140500.

## Verified behavior

- 40 fresh rendered page cases: public discovery, customer home/calendar, seller operations and seller schedule, both ID/EN at the four specified viewport sizes. Zero axe violations using WCAG2A/2AA/2.1AA tags and zero document-wide horizontal overflow. Axe is distinct from Impeccable.
- Customer delivery management: dialog initial focus, review-heading focus, 650ms pending disabling, CONFLICT followed by failed resource read, blocked stale mutation, explicit reload, retry with version 2, successful return to Change schedule, cutoff expiry focusing a plain-language alert, and closure when the original action no longer exists. All eight journey runs completed. GET fixture cutoff was moved into the future, then three hours into the past to exercise the edge; these are explicit intercepted synthetic fixtures.
- Seller detail opens with focus on the detail panel and returns to the exact row Detail button on close. Batch pending disables unsafe actions; conflict text explains atomic no-change behavior. Refresh recovers the current version before retry. Single English “1 order updated” / “1 portion” and Indonesian counts are correct.
- Attention: 20 items followed by seven items produce exactly 27, with no duplicates; long subjects remain within row bounds; Tab/Shift+Tab stays in the drawer. Both language phone inline queues load all 27, with document width 390 and zero row overflow. Desktop drawer reflow remains within CSS viewport bounds.
- Whole-day production remains 1 meal portion when the schedule search deliberately produces zero table results. Its note explicitly states that filters do not change the list. The requested operational date is preserved.
- Purchased totals match fixture snapshots in both languages: Rp 177.500 (one portion/five days), Rp 297.500 (one/five), Rp 140.500 (two/one combined lunch/dinner). Home reflects one and two fixed portions correctly. Public package cards correctly distinguish day, meal and package totals. No pricing error was found. Detailed receipt subsection was not expanded, so subtotal/fee rendering is source-reviewed rather than claimed as a browser-tested expanded state.

## CLI detector

The requested launcher was really attempted and failed with `/workspace/catera/tools/impeccable/scripts/impeccable: No such file or directory`. The bundled Node fallback ran successfully and produced valid untruncated JSON, no stderr. Scan scope was the full component directory, including reachable CSS, rather than only layout files. It returned **92 advisories**, exclusively **64 design-system-font-size, 16 design-system-radius, 12 design-system-color**; **zero non-advisory antipattern findings**. The scan command's individual exit code was not separately captured before subsequent shell reads; do not claim an observed exit code.

All 92 are actual disagreements with the current DESIGN.md token catalog, rather than 92 independently confirmed usability defects. Examples of intentional variants that should not be “fixed” blindly: catalog search uses 16px (`catalog.css:40`); count badge pill uses 20px radius (`catalog.css:64`); tighter disclosure uses 11px (`disclosure.css:45`). Off-ramp 11px text deserves manual readability review, as above. No parser false positive is asserted; classification is documentation drift/advisory, not blocker.

Locations and counts (all under apps/web/src/components; exact rule/value details in detect.json):

| File | Count | Lines |
|---|---:|---|
| catalog.css | 4 | 8,40,64,107 |
| customer-account.css | 3 | 37,42,107 |
| disclosure.css | 1 | 45 |
| landscape.css | 15 | 63,77,123,164,196,230,307,314,325,358,362,441,469,484,659 |
| meal-calendar.css | 15 | 28,134,157,217,234,245,272,305,327,335,394,412,419,431,455 |
| menu-calendar.css | 9 | 202,227,258,277,291,361,393,576,610 |
| package-choice-library.css | 4 | 4,5,155,165 |
| package-presentation.css | 7 | 27,88,135,151,165,247,298 |
| saved-discovery.css | 5 | 59,86,163,346,367 |
| seller-account.module.css | 1 | 89 |
| seller-experience.css | 2 | 42,75 |
| seller-operations.css | 4 | 34,157,163,262 |
| seller-settlement.css | 22 | 22,91,127,143,159,174,186,195,196,235,264,271,275,286,289,296,302,399,464,580,591,596 |

## Browser detector and false positives

Native tools exposed in this session provided no local browser-canvas/localhost automation. A fresh Playwright Chromium browser was used. Real mutable preflight changed document.title and appended an executable script; both read back successfully. The owned bundled live server started detached on port 8463. Injection succeeded on three representative pages; console messages and screenshots confirm overlays ran. There is no user-visible Human tab in this headless harness, so do not claim that a user can currently see an overlay.

Clean second captures used autoScan:false to collect raw findings without scanning the detector's own overlay labels:

| Page | Total | Rules |
|---|---:|---|
| / | 11 | tiny-text 5, undersized-ui-text 5, cream-palette 1 |
| /calendar | 13 | tiny-text 1, undersized-ui-text 11, cream-palette 1 |
| /seller?date=2026-10-07 | 8 | tiny-text 2, undersized-ui-text 1, line-length 4, cream-palette 1 |

False-positive / conditional accounting:

- **3 cream-palette findings**, body of each representative page: explicit approved Catera cream/canvas colors. Reject as category-generic detector preference.
- **4 seller line-length findings**: three list entries and one help paragraph inside collapsed disclosures are explicitly `isHidden:true`; do not describe them as clutter visible at rest. They are conditional expanded-help readability advisories, not current task obstruction.
- Calendar's 11 undersized-ui findings are repeated instances of two CSS rules: five month markers, six package counts. Several are offscreen inside an intentionally scrollable timeline; these are not eleven distinct usability defects or document overflow.
- First overlay capture's self-rescan adds occlusion of its own “tiny body text” / “undersized functional text” annotations and monotonous-spacing due to overlay DOM. These are instrumentation artifacts; the clean capture excludes them. Initial source-only console counts are 11,13,8. All exact selectors, rects and findings are in overlay-raw.json.
- Bare 20×20 seller checkbox elements are reported by the geometric target inventory; select-all has an enclosing label and generous row space. This inventory is not evidence that all button targets fail. Primary button controls generally meet the measured 44px floor; inline links and metadata links can be shorter. Do not promote raw element bounds into blanket accessibility violations.

## Cleanup and evidence

All owned contexts and Chromium browsers were closed. The port-8463 live server was stopped with the bundled `stop --keep-inject`; subsequent health connection failed, confirming shutdown. Parent production server port 3147 was not stopped. No remote session or existing user tab was used. Scratch overlay context copies and durable raw/screenshot evidence remain under work/wide-score-b; there were no source injections or edits to clean. Missing requested launcher, fallback browser, and headless visibility limitation are explicitly recorded. Ignore.md was absent. Parent handles target slug, report synthesis, persistence and trend.

Evidence files: detect.json, detector-locations.json, overlays.json, overlay-raw.json, matrix.json, journeys.json, supplement.json, plus named screenshots and execution logs. Scripts are fresh authored evidence harnesses, not reused old assessment code.

Questions skipped: 0 decisions require clarification; the user authorized the desktop optimization loop and all verified fixes.
