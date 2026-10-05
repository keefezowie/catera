---
target: Caterer and Customer landscape web
total_score: 35
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T11-47-43Z
slug: src-components
---
Method: dual-agent (A: /root/goal_review2_a · B: /root/goal_review2_b)

# Landscape design critique — cycle 2

Target: `/workspace/catera/src/components` · live `http://127.0.0.1:3000` · Operate mode · 5 October 2026.

Assessment A completed independently before Assessment B findings entered synthesis. I read AGENTS.md, Impeccable v4.1.3 and its full critique/scoring reference, docs/UI-BRIEF.md, docs/IMPLEMENTATION.md and DESIGN.md. The context script was already run and was not repeated. I did not read critique archives, other assessments or detector output. Both roles were inspected in fresh independent Playwright contexts at 1280×800 and 1440×900. Phones/tablets are outside this score.

## Design specificity verdict

Catera feels authored for recurring catering work. Its date-preserving Schedule → Production → Delivery sequence, adjacent delivery drawer, frozen-production prerequisite, external-purchase wording, quota reservation distinction and customer cutoff/default-menu notice cannot be transplanted unchanged to an unrelated dashboard. The approved forest/cream palette, original wordmark/bento artwork and system sans form a coherent warm operational identity. The visual composition is intentionally restrained; greater decoration, a new font or a different visual concept would not solve the findings below.

## Design health

| # | Heuristic | Score /4 | Judgment and evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Clear current stages, counts, pending buttons, exact success messages and explicit uncertainty. The floating success notice can cover the next modal's action area. |
| 2 | Match between system and real world | 4 | Indonesian labels explain external payment, purchase validity, reservation, default meal and cutoff in the actual business order. Delivered debit, failed reservation and skip release are explicit. |
| 3 | User control and freedom | 3 | Cancel, Back and Escape work in inspected dialogs; filter clearing and drawer focus restoration are present. Normal dismiss/reopen discards unsaved input; this is a minor interruption limitation, distinct from the preserved unknown command. Owner reversal is correctly deliberate. |
| 4 | Consistency and standards | 4 | Shared controls, status labels, date/stage navigation, list/detail patterns and review forms remain cohesive across the two roles. Domain-specific differences are explained. |
| 5 | Error prevention | 4 | Review repeats payment reference and exact validity; a nine-occurrence plan with five quota cannot confirm. A safe shorten-date suggestion returns to editing for fresh review. Cutoff/readiness/reversal safeguards are visible or source-confirmed. |
| 6 | Recognition rather than recall | 3 | Customer/quota/validity stays beside form and review; details disclose accounting/history; contextual Help retains date. Reopened unknown-save recovery shows persisted field values rather than the retained attempted values, requiring recall. |
| 7 | Flexibility and efficiency | 3 | Direct readiness review from Today/Production, selection-based ready/dispatch, search, filters, date navigation and `/`/`?` shortcuts are useful accelerators. This is a capable pilot workflow rather than a highly customizable power-user surface. |
| 8 | Aesthetic and minimalist design | 4 | Focused lists, open rows, flat surfaces and sparse forest emphasis support scanning. Subscriber Home uses the landscape space well, with next delivery and quota/agenda side by side at both sizes. Secondary accounting is disclosed. |
| 9 | Error recovery | 3 | Shortfall pinpoints first unfunded date/slot and offers direct repair; aborted save gives a plain-language original-request retry and preserves pending payload. The reopened recovery form does not visually show that payload. |
| 10 | Help and documentation | 4 | Searchable, role-filtered, task-grouped Help, context-bearing destination links, concrete policy notes and in-place hints supply the right information at decision points. |
| **Total** | | **35/40 — Good** | All ten heuristics apply. No numeric target or prior score was supplied. |

Scores describe the inspected pilot scope, not universal coverage of every possible server response. Four means strong positive evidence within this scope, not a claim that every future edge case is impossible.

## Detector and browser evidence

Assessment B ran the CLI detector exactly once on src/components: exit 0, zero findings. Across 20 main landscape states and three settled confirmations, no horizontal overflow was found. One settled Axe violation remained: the long schedule preview lacked explicit keyboard focus. Chromium automatically focuses the list, but portable keyboard access needs tabIndex and a descriptive label. Transient drawer/History contrast flags cleared after settling; INCOMPLETE results remain separately documented. Production’s generic div aria-label was a semantic follow-up. Four headless mutable detector injections succeeded; no user-visible Human tab was available. Pinned Arial warnings and text in a closed Help group were false positives.

## Overall impression

The core operational story is clear and usable. A caterer knows what to do next; a customer sees the next meal, the next decision deadline and what happens if they do nothing. The remaining opportunity is small but meaningful: recovery and save feedback should preserve the same visual certainty as the successful review flow.

## What's working

1. **Landscape forms genuinely retain decision context.** Customer identity, grant validity and quota stay beside purchase/schedule editing and review. The purchase review repeats `SYNTH-A-20261005`, +5 deliveries and `6 Oktober 2026 → Tanpa kedaluwarsa`. The schedule shortfall shows 9 required / 5 allocatable / 4 unfunded, identifies 13 Oct lunch, disables confirmation and offers shortening to 12 Oct followed by a new review.
2. **The delivery cycle is operationally specific.** Today and the latest complete Production both offer an eight-record readiness review. The drawer puts the next fulfillment action before editing, identifies production revision 1 and separates the closed customer cutoff from permitted administrative correction. Source confirms Delivered explicitly debits one, failure keeps the reservation and owner reversal requires a reason.
3. **Subscriber Home anticipates the next real decision.** It distinguishes today's already-frozen delivery from tomorrow's menu selection and explicitly names the default meal if no choice is made. The following agenda omits the already-prominent next delivery; quota totals retain their three meanings. Profile warns that existing bookings keep their own addresses.

## Priority issues

Only two priority issues survived this fresh assessment. Neither blocks the inspected core task; no P0/P1 finding was observed.

### [P2] Reopened unknown-save recovery displays the wrong version of the form data

**Observed:** On the newly created synthetic customer, I changed the phone from `081200000099` to `081200000088`, intercepted the Server Action POST locally and aborted it before reaching the server. The form correctly displayed uncertainty and a `Coba kembali data awal` retry. Before dismissal the field showed `...0088`; after Escape and reopening Edit, it showed the persisted `...0099`, while the uncertainty/retry remained and Save was disabled. Source in `ui.tsx` confirms retry submits `attempt.current.data.payload`, meaning the retained `...0088` payload, not the reopened field value.

**Why it matters:** Safe idempotent recovery exists, but the user cannot inspect the values about to be retried. They must remember their earlier attempt, and `data awal` can reasonably mean the original saved `...0099` they now see. This undermines confidence at precisely the uncertain-save moment.

**Fix:** Restore the retained attempted values on reopening, or replace the editable fields with a clearly labeled read-only summary of the original attempted payload. Name the action `Periksa dan coba kembali penyimpanan sebelumnya` (or equivalent clear copy), and keep the current UUID/receipt protection and block on unrelated changes. Do not discard the pending attempt or bypass its replay.

**Suggested command:** `$impeccable harden` with `$impeccable clarify`.

**Evidence:** Live DOM before/after values and `23-recovery-1440.png`; source `src/components/ui.tsx` around `changeOpen`, `submit`, `feedback`, and form defaults.

### [P2] Save confirmations float over subsequent modal actions

**Observed:** After the actual synthetic purchase succeeded, its success notice remained visible as I opened and reviewed a schedule. At 1440×900 the notice covers the lower-right disabled Confirm area in the shortfall review (`14-schedule-shortfall-1440.png`). The later schedule-success notice also covers part of the Save footer in the recovery form (`23-recovery-1440.png`). This is a success layer crossing into the next task's controls.

**Why it matters:** Rapid owner work naturally moves purchase → schedule → account edits. Obscuring the next review's action label creates unnecessary hesitation and reduces the confidence earned by the review. The observed covered buttons happened to be disabled; I do not claim an observed enabled-button misclick.

**Fix:** Put success feedback in a reserved shell/inline region, or reposition/dismiss the visual toast when a new modal opens while preserving its live announcement. Keep it clear of the modal's fixed action footer. Check the seven-second expiry survives the refresh triggered by a successful save; its effect currently depends on the translation function and clears its timer on cleanup.

**Suggested command:** `$impeccable polish` or `$impeccable layout`.

**Evidence:** Captures 14 and 23; `shell.tsx` success effect and `save-notice`, `globals.css` `.save-notice`. Timer persistence is a source-supported concern, not a separately measured expiration claim.

### [P2] Long schedule preview needs explicit keyboard focus

The 72-occurrence preview scrolls internally without a declared keyboard focus target. Chromium supports it automatically, but the intent is not portable. Add tabIndex=0 and an accessible list label to allocation/removal previews and verify scrolling and footer reachability. Suggested command: `$impeccable harden`.

## Cognitive load

At rest, Today and subscriber Home are low-load. The staged navigation has three choices; the delivery drawer has one next fulfillment action; the meal comparison has three choices; Help groups its topics instead of displaying eleven equally weighted destinations.

Checklist across the inspected task flow:

| Item | Result | Evidence |
|---|---|---|
| Single focus | Pass | One emphasized next task on Today, one selected dialog task. |
| Chunking ≤4 | Fail narrowly | Recurrence exposes seven weekdays together. This is natural intrinsic scheduling complexity, not a reason to hide weekdays. |
| Grouping | Pass | Dates, weekdays, slots, funding context and form actions have distinct groups. |
| Visual hierarchy | Pass | Next action, key review totals and cutoff/default outcome are clear. |
| One thing at a time | Pass | Editing precedes review; shortfall repair returns to editing before a fresh confirmation. |
| Minimal choices ≤4 | Fail narrowly | Seven weekday options; opening status filter presents eight options including All/Attention and six statuses. Main owner navigation has five task destinations if Help is counted, but four are grouped under business management. |
| Working memory | Fail in recovery | Reopened unknown save requires remembering attempted values that are no longer in the visible fields. Normal purchase/schedule review keeps context. |
| Progressive disclosure | Pass | Accounting/history, owner adjustment, Help categories and allocation explanation disclose secondary complexity. |

**Three checklist failures = moderate load across the whole workflow**, concentrated in recurrence choices and reopened error recovery. The seven weekdays are intrinsic to the task and should remain visible; the useful fix is preserving attempted recovery context, not flattening the scheduling model. No eight-plus simultaneous primary-action cluster was observed in the resting views. The schedule review contains nine occurrence rows but these are a verification list, not nine action alternatives.

## Emotional journey

Entry feels calm and trustworthy: brand warmth is limited to the supplied artwork, paper tones and quiet forest emphasis. The strongest peak is an explicit reviewed result, with the actual synthetic purchase announcing `Pembelian tercatat dan kuota ditambahkan.` and the schedule announcing `Jadwal dibuat dan kuota dipesan.` The quota shortfall valley is handled well: the system names the first unsupported service date, shows its funding math and offers a concrete correction. Unknown-save recovery avoids blaming the user and gives a safe next step, but dismissal/reopening weakens reassurance by showing different values. The end of a task should validate completion without covering the next task; the toast overlap currently disturbs that transition.

## Persona red flags

- **Alex, power owner:** The direct eight-delivery readiness review and real batch selection are useful, not a one-record-at-a-time bottleneck. Moving promptly from purchase to scheduling encounters the overlapping success notice. Only search/help shortcuts are documented; wider customization is not established and is not needed to invent a release blocker.
- **Jordan, first-time customer/caterer:** The external-purchase → quota → schedule explanation, named default meal and profile-address note reduce confusion. The recovery label `data awal`, coupled with the reverted phone field on reopening, makes it unclear which values will be retried.
- **Sam, keyboard-dependent operator:** Native inputs, labeled controls, dialog semantics, Escape and status words are present. Drawer source restores its originating-row focus; unknown feedback is an alert and successes are a polite status announcement. Full screen-reader/zoom validation belongs to Assessment B; I do not claim it from screenshots. Normal dismissed unsaved forms do not retain draft input, so an interruption can require re-entry.

## Minor observations and constraints

- Browser-native date controls rendered US numeric order in the default English browser context even though nearby written dates and interface copy were Indonesian. This is browser-locale dependence, not evidence that Indonesian browsers necessarily show an incorrect date. Long-date review text correctly disambiguates the saved dates.
- A fresh customer's empty schedule initially presents an empty table. The above-the-table purchase-first guidance still explains the next action; an explicit empty-schedule sentence would be minor refinement, not a blocking issue.
- Menu-card hover and selected treatments share the same sage/forest background; the radio's checked state remains the actual selection signal. The observed three-card comparison is readable and did not require a priority issue.
- The production/readiness review was opened then cancelled. No seeded delivery was changed, and Nadia was only observed. Delivered/failure/reversal safeguards and filtered-empty/history behavior were supplemented by source, not executed as successful transitions.
- Source confirms cutoff-blocked readiness has an explanation/production link, Delivered review states −1, failed asks for a reason, reversal asks for a reason and compensation, Help preserves authorized date/customer/delivery context, and filter empty states offer clearing.
- Only `Assessment A Demo <assessment-a@demo.catera.test>` was created. An actual future-starting five-delivery purchase and two deliveries on 6–7 October were saved. The future grant correctly allowed scheduling while today's availability remained zero. No invitation or external message was sent. No backend reset/change was made.

## Questions to consider

- Should original-request recovery show the attempted values in the restored form or as a read-only review summary?
- Should a new dialog absorb the preceding task's confirmation into its context, or should confirmation remain in a reserved shell region?

These are optional synthesis directions, not permission requests. Two priority issues permit the parent to use `Questions skipped: 2 priority issues; concrete fixes are identified` if closing without questions.
