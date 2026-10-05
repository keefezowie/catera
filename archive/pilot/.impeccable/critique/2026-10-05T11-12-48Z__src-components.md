---
target: Catera landscape web improvement loop — cycle 1
total_score: 31
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T11-12-48Z
slug: src-components
---
Method: dual-agent (A: /root/goal_review_a · B: /root/goal_review_b)

# Independent Assessment A — Catera landscape UI/UX

Method: isolated design review by `/root/goal_review_a`, before seeing Assessment B, detector findings, or previous critique archives. Target: `src/components`. Mode: Operate (Help: Read). Live synthetic tenant: Dapur Hijau. Inspected in fresh browser contexts at 1280×800 and 1440×900. No application edits or confirmed database writes.

## Design specificity verdict

Catera is substantially authored for recurring catering. The date → schedule → frozen production → fulfillment cycle, meal comparison, address snapshots, and three distinct quota balances are product-specific structure, not generic dashboard filler. The original bento artwork and forest/cream palette create a warm but restrained identity. Open operational rows and compact type support work rather than decorate metrics.

The neutral sidebar/table shell could serve many admin products, which is acceptable in Operate mode. Product character comes from the correct domain model and selected moments of warmth, particularly customer Home. The biggest missed opportunity is operational guidance: the design knows the prerequisite states but does not always turn that knowledge into the next useful action.

## Overall impression

Both roles have a good, calm foundation. The customer landing view is the stronger composition: next meal, quota, and the following dates are all visible at both landscape sizes, with a clear reminder for the earliest missing menu. Caterer pages are legible and preserve the delivery date across stages. Their main weakness is the handoff from a complete production version to marking shipments ready. Review safeguards are credible, but blocked scheduling and purchase review still leave avoidable interpretation work. This is not a redesign problem; it is a task-guidance and state-finish problem.

## Nielsen scores

All ten heuristics apply. These are judgment scores, not detector scores or production certification.

| # | Heuristic | Score /4 | Basis |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Clear named statuses, cutoff notices, quota totals, production revisions, and review states. Today guidance still says prepare production when an eligible complete frozen version already exists. Success/async recovery is source-only evidence in this review. |
| 2 | Match between system and real world | 4 | Fluent Indonesian catering terms and a faithful external purchase → reservation → cooking/dispatch → received flow. Profile changes explicitly affect new bookings, and missing choices/defaults follow catering policy. |
| 3 | User control and freedom | 3 | Cancel, Back, Escape and drawer focus return work. Menu selection and date fields survive Back. Final mutation/undo behavior was not exercised; ordinary unsaved dismissal discards draft edits. |
| 4 | Consistency and standards | 3 | Cohesive controls, layout and labels across roles, with a real state-style regression: the selected Schedule tab becomes white text on pale sage on hover. |
| 5 | Error prevention | 3 | Invalid date order stops review; insufficient allocation and unfrozen production block confirmation/readiness. Reviews explain effects. Purchase review omits one entered field and exact expiry, reducing the value of its last safety check. |
| 6 | Recognition rather than recall | 3 | Labeled navigation, visible customer/quota context, before/after meal choice, expandable history. Purchase review requires recall of the external payment reference; production handoff requires knowledge of where readiness actions live. |
| 7 | Flexibility and efficiency | 3 | Reviewed batch readiness/dispatch, list search/filtering, print/CSV and help/search keyboard shortcuts exist. The happy path from production to a batch readiness review remains indirect. Batch transaction recovery is source/test evidence only. |
| 8 | Aesthetic and minimalist design | 3 | Warm, coherent and largely uncluttered. Customer Home fits the brief especially well. Owner Help shows nine equally treated topics, and Today’s next task is less prominent than the marketing-like headline. |
| 9 | Recognize, diagnose and recover from errors | 3 | Date-order validation is explicit and preserves input; quota shortfall exposes 68 required /23 allocatable /45 missing and disables confirmation. It names the problem but gives no concrete repair shortcut. Network uncertainty and server field-focus recovery were inspected in source/test definitions only. |
| 10 | Help and documentation | 3 | Role-specific searchable task articles, contextual destination links, current-cutoff guidance and keyboard help. Nine owner topics form a long ungrouped list; guidance often returns to an area rather than the exact record/date being worked on. |
| **Total** | | **31/40 — Good** | **A solid foundation with actionable usability gaps.** |

## What works

1. **The customer Home answers real questions in one viewport.** Next meal and address, the earliest pending choice/deadline, remaining/reserved/available balances, and two following deliveries fit at 1280×800 and 1440×900. The forest meal panel provides a clear visual anchor; quota has secondary emphasis.
2. **The high-risk boundaries are visible.** The funded schedule review keeps Nadia and the package-validity context beside 2 required /2 allocated /0 missing. The underfunded review disables confirmation. An unfrozen future delivery shows a disabled readiness button, a plain prerequisite explanation, and a production link. The ready review includes the exact production revision.
3. **Temporary work has dependable exits.** Purchase start date survives review/Back; scheduling preserves the edited date range; the chosen Tempe radio survives review/Back. Escape closes forms and restores their triggers. After waiting for drawer dismissal, focus returns to the originating Nadia row with a visible orange outline at both sizes. Batch review lists customers, menus, revisions and status transitions before confirmation.

## Prioritized issues

### [P1] Selected customer schedule tabs lose legibility on hover

**Observed:** Click `Riwayat kiriman` and leave the pointer over it. White label/count sit on the pale sage background at both landscape sizes. Move the pointer away and the expected forest fill returns. This is a hover-state defect, not a disabled zero-count button. `Jadwal mendatang` uses the same state pattern.

**Why:** The current destination appears unavailable or almost blank at the exact moment the user clicks it. Low-vision users lose a primary navigation cue.

**Fix:** Define explicit hover/focus colors for `.schedule-switch button[aria-pressed="true"]`, retaining a forest background or pairing sage with forest text. Inspect selected/unselected, hover and keyboard-focus combinations together. The generic `.button.secondary:hover` currently wins the background cascade over the selected-tab rule.

**Suggested command:** `$impeccable harden`, then `$impeccable polish`.

**Evidence:** `customer-history-hover-1280.png`, `customer-history-nohover-1280.png`, matching 1440 captures. Computed style evidence confirms white `rgb(255,255,255)` over sage `rgb(237,243,236)` while hovered, and forest `rgb(22,61,46)` when not hovered.

### [P2] Complete production lacks a clear handoff to readiness

**Observed:** Today says `Siapkan daftar produksi` with `Lihat produksi`, while the selected day already has a complete Revisi 1 containing all eight shipments. Production presents portions, source rows, print/CSV and stage tabs, but no explicit next action to mark eligible shipments ready. Readiness is discoverable in a shipment drawer or after checking boxes in Pengiriman.

**Why:** A new caterer can follow the instruction into production, verify everything, and still wonder what to do next. An experienced operator must leave the readout and reconstruct the task through stage navigation and selection. The interface has enough state to shorten this.

**Fix:** Keep reviewing the frozen version explicit, but make the contextual message reflect whether production is missing/incomplete versus complete. On complete production, show `Tinjau 8 kiriman untuk ditandai siap` linking to the same date/slot in Pengiriman, or opening the existing explicit selection/review workflow. Never automatically change fulfillment state simply because a user viewed production. Preserve the exact reviewed revision requirement.

**Suggested command:** `$impeccable clarify` / `$impeccable shape` for this handoff.

**Evidence:** `owner-today-1280.png`, `owner-production-1280.png`, `owner-drawer-1280.png`, `owner-batch-review-1280.png`, all with matching 1440 evidence; `operations.tsx` bases its nextTask on scheduled count without considering whether the frozen version is already complete.

### [P2] Insufficient-quota scheduling explains the deficit but leaves repair to trial and error

**Observed:** Selecting all weekdays/both slots from 8 October through 10 November produces 68 required, 23 allocatable, 45 missing. Confirmation is disabled and the warning says available quota is insufficient. Back works and preserves the original choices.

**Why:** Safety succeeds, but recovery still asks the owner to guess how far to shorten the date range or which slot/days to remove, then review again. This is avoidable effort in a routine catering plan.

**Fix:** Add concise repair choices beside the shortfall: `Kurangi rentang/hari pengiriman` (Back with focus on the controlling field), and `Catat pembelian tambahan` only if that route can preserve/restore the draft. Show a concrete earliest shortfall date or a proposed last fully funded date as an optional adjustment. Keep the plan all-or-nothing; do not silently submit a partial schedule.

**Suggested command:** `$impeccable clarify` / `$impeccable harden`.

**Evidence:** `owner-schedule-underfunded-review-1280.png` and `-1440.png`; review/back values in `evidence.json`.

### [P2] Purchase review omits the payment reference and makes expiry a mental calculation

**Observed:** The form asks for package, start date and external-payment reference. Review shows package/+26, start date and `45 masa berlaku (hari)`, then repeats the external-payment explanation. It does not show the entered reference or the resulting expiry date; `PurchaseForm` source confirms the omission.

**Why:** This is the last check before granting a paid entitlement. The operator cannot verify whether the purchase was tied to the intended external payment without going Back, and must calculate the actual validity endpoint.

**Fix:** Review all transaction-defining inputs: customer, package, quota increment, localized start→expiry date range, and external reference (or an explicit `Tidak diisi`). Keep the external-payment explanation once. Use `Berlaku 45 hari` instead of the current awkward phrase.

**Suggested command:** `$impeccable clarify`.

**Evidence:** `owner-purchase-selected-1280.png`, `owner-purchase-review-1280.png`, matching 1440 captures; `src/components/records.tsx` PurchaseForm review.

### [P2] Home warns about missing menu choice without explaining the known default outcome

**Observed:** Home prominently asks the customer to choose a menu before a deadline. The missing-menu agenda repeats the unresolved state. The explanation that the published main menu is automatically chosen at cutoff appears only after opening the comparison form or reading Help.

**Why:** A busy customer who sees a deadline but cannot act immediately may fear that no food will arrive. The product actually has a precise default policy, so the warning could reassure without weakening the requested action.

**Fix:** Where a published default exists for that delivery, add one quiet line to the reminder or agenda: `Jika belum memilih, [nama menu utama] akan dipakai saat batas perubahan.` If no default exists, keep an attention message appropriate to that real state. Do not invent a universal default guarantee.

**Suggested command:** `$impeccable clarify` / `$impeccable delight` through truthful reassurance.

**Evidence:** `customer-home-1280.png`, `customer-menu-1280.png`, matching 1440 captures.

## Cognitive load

### Caterer: moderate — three checklist failures

- **Single focus: pass.** Daily operations dominate; owner-only accounting is disclosed later.
- **Chunking: fail in Help.** Nine task topics each carry title + explanation in one long flat list.
- **Grouping: pass.** Operations and business management are separated; dates, days, slots, funding and review form distinct groups.
- **Visual hierarchy: pass with a gap.** Table and drawer actions are clear. Today’s useful next-task instruction is smaller and quieter than its promotional headline.
- **One thing at a time: pass.** Draft → review → explicit confirm is coherent; nested ready review is short and purposeful.
- **Minimal choices: fail in owner Help.** Nine visible sibling topics. The work-status select also contains more than four options when opened, but those are meaningful explicit statuses rather than an unstructured wall of primary actions.
- **Working memory: fail in purchase review.** External-reference verification requires recalling the field or going Back; precise expiry is a calculation. Scheduling correctly repeats customer, balances and validity.
- **Progressive disclosure: pass.** Accounting adjustments, allocation explanation, history and version changes are secondary disclosures.

### Customer: low — one checklist failure

Single focus, chunking, grouping, visual hierarchy, one thing at a time, working memory and progressive disclosure pass in the inspected task flows. Minimal choices fails narrowly in Help (five topics), not in meal choice: only three meals are compared side by side. Home offers a clear urgent task plus secondary planning. Four delivery-edit actions are separated by their object and consequence.

**Other >4-option decision points:** Scheduling has seven weekday toggles; this is a familiar calendar set with useful weekday defaults and is not evidence of harmful overload by itself. The owner’s nine-topic Help list is the more convincing issue. Eight shipments in batch review are records to verify, not eight competing actions. Do not remove safety review or domain information merely to satisfy a numeric choice limit.

## Emotional journey

Customer entry feels calm and credible: familiar food, date, address and available quota are tangible. Choosing among three described meals is the pleasant peak. The deadline reminder is the emotional valley; it could better reassure about the default outcome. Review’s before→after framing creates confidence, and Back preserves the choice. Successful saving was intentionally not confirmed, so the final emotional end-state is code/test evidence rather than a witnessed event.

Caterer entry promises order and shows real work. Opening a detail gives a clear next action; frozen revision and cutoff notices reduce fear of accidental edits. Discovering a disabled readiness control is softened by a useful production explanation. The valley is a blocked schedule or a complete production readout with no direct handoff. Those moments should finish with a practical next move, not merely an accurate diagnosis.

## Persona red flags

- **Alex, impatient power user / caterer:** Searches and batch review support repeated work. After reviewing complete production, Alex still has to choose Pengiriman, select records and start readiness review; Today does not adapt its guidance to the already complete production state. External-payment reference verification requires an extra Back round trip. Keyboard shortcuts exist in Help; do not claim there are none.
- **Jordan, first-time owner/customer:** Labels and quota explanations are generally excellent. Jordan cannot tell from `Siapkan daftar produksi` whether there is anything still to prepare when the page already says `Lengkap`. `Bisa dijadwalkan` describes capacity rather than promising a customer scheduling action, which should remain clear in Help. Missing-menu reminders could feel like a delivery risk until Jordan opens the default explanation.
- **Sam, low-vision/keyboard user:** Orange focus is visible on the readiness button and returned list row; Escape and focus return worked. Statuses have words. The selected Schedule switch becomes near-invisible under the pointer. Date inputs visually use browser-driven month/day order in this Chromium context despite Indonesian surrounding copy; localized review mitigates it, but mixed browser locales should be checked. No screen-reader or 200% zoom certification is claimed by this landscape review.

## Minor observations

- Today shows around five full records at 1280×800 before scrolling; wide screens still spend considerable vertical space on the title/context band. Moderate density reduction could help a busy kitchen, but this is a usability refinement, not proof that all eight records must fit without scrolling.
- The production tab badge `1`, schedule `8`, and delivery `0/8` count different things (versions/shipments/completion). Labels or accessible descriptions could clarify those units without adding large UI text.
- Native date rendering shows `10/05/2026` while the page says `5 Oktober 2026`. Treat this as a browser-locale-sensitive issue and preserve the native picker unless a verified replacement is justified; a localized helper/review can clarify interpretation.
- The schedule date-order warning appears both immediately beneath date fields and in the shared form alert. It is safe but redundant visually.
- Help’s keyboard-shortcut disclosure falls below the viewport in the nine-topic owner layout. Grouping topics would improve both scanability and shortcut discovery.
- Menu cards are appropriately descriptive; there is no evidence that more food imagery is required to perform the choice reliably.

## Questions to consider

1. If production is already complete, should Today lead directly to reviewing the eligible readiness action while preserving the production-revision safeguard?
2. Could a blocked schedule suggest the exact last funded date instead of asking the owner to adjust dates repeatedly?
3. Could a missing-menu reminder say what will happen at cutoff, so the customer feels informed rather than merely warned?

## Evidence and limits

`work/goal-review-A/evidence.json` records URLs, viewport/document widths, actions and their rectangles, dialog geometry/text, Back-preservation and focus outcomes. Named full-page and viewport PNGs cover all requested routes/states at both sizes, plus batch readiness review and selected-tab hover/no-hover pairs. Images were visually inspected directly and through named viewport contact sheets; no blank animation captures remain. No horizontal document overflow was recorded in these captures.

Initial scripted routing checks were corrected: owner Help must use `/admin/help`, and route URLs must settle before recording customer detail. Corrected named screenshots/evidence replace those initial mislabeled routes. Early immediate drawer-focus samples were false because focus restoration follows dismissal; the settled `owner-drawer-closed-*` captures confirm restored focus at both sizes. These are not application defects.

Browser contexts were closed. This assessment did not run the deterministic detector, inspect Assessment B, or execute transaction/fulfillment writes. Existing tests and code substantiate safeguards but were read rather than re-run here. Unknown-save recovery, delivered debit/reversal, partial batch outcomes, network loading and final-save feedback should not be described as independently browser-verified by A. Demo data and the inspected states do not establish hosted-release readiness or broad accessibility coverage.


Browser evidence: CLI detector 0 findings; 26 landscape states had zero horizontal overflow and zero reported axe violations, with 10 incomplete modal checks. Browser overlays identified the pinned Arial false positive, three long-measure signals and a valid standalone detail h1→h3 heading skip. No user-visible Human overlay was available in this headless harness. All owned overlay servers and browsers were closed.
