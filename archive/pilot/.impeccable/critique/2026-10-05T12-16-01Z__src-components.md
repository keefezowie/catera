---
target: Caterer and Customer landscape web
total_score: 35
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T12-16-01Z
slug: src-components
---
Method: dual-agent (A: /root/goal_review3_a · B: /root/goal_review3_b)

## Design specificity and overall judgment

Catera feels authored for recurring catering operations. The Schedule → Production → Delivery spine, frozen production revisions, adjacent delivery drawer, reserved quota, and meal comparisons make the composition product-specific. Forest and cream, approved wordmark/bento artwork, and Arial/Segoe UI remain coherent; restraint suits daily work. Customer Home gives the urgent menu deadline priority while preserving the next delivery and planning context. The biggest opportunity is trustworthy continuity immediately after a save: one observed review contradicts the freshly updated quota.

## Nielsen assessment

Scores use the complete 0–4 rubric; all ten apply to this Operate surface.

| # | Heuristic | Score | Decisive evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Actual purchase, schedule, and retry saves announced success; the immediate next schedule review showed stale allocation. |
| 2 | Match with real world | 4 | Indonesian task language, meal/time/address context, external payment reference, and explicit quota consequences match catering work. |
| 3 | User control and freedom | 4 | Review Back retains meals/dates; Escape exits; delivery and meal openers regained focus; filter/history exits are clear. Reasoned owner reversal is source-supported. |
| 4 | Consistency and standards | 3 | Cohesive shared controls and review patterns; frozen review and live confirmation eligibility diverged after purchase. |
| 5 | Error prevention | 3 | Review before mutation, insufficient-plan confirmation blocked, production prerequisites and cutoff visible; contradictory preview undermines informed confirmation. |
| 6 | Recognition rather than recall | 3 | Customer/validity context stays beside fields, three quota labels, status words, and grouped help aid recognition; stale funding makes users reconcile two accounts. |
| 7 | Flexibility and efficiency | 3 | Batch readiness, search/filter, CSV/print, date jumps, contextual `?` help and `/` search; good accelerators, without broad customization. |
| 8 | Aesthetic and minimalist design | 4 | Clear operational hierarchy, open rows, purposeful forest emphasis, accounting/history disclosures; desktop Customer Home fits its full planning composition. |
| 9 | Error recovery | 4 | A locally aborted save retained exact attempted phone/address/instructions through Escape/reopen; disabled edits, clear retry, identical request, actual successful recovery. |
| 10 | Help and documentation | 4 | Searchable task groups, customer-context topic/deep link, production guidance and actionable empty search state; keyboard discovery worked. |
| **Total** | | **35/40** | **Good** |

A 4 is reserved for the excellent inspected behavior, not a claim about every unexercised branch.

## Strengths

- Both 1280×800 and 1440×900 Customer Homes show next delivery, quota, and following agenda together. Deadline/default-menu guidance is concrete, and the next delivery is not duplicated in the following list.
- The production readiness review repeats eight customers, meals, dates, revision and before/after statuses. Cancel changes nothing; drawer emphasizes the next fulfillment step before secondary edits and accounting.
- Unknown-save recovery protects intent. Attempted values `08000000302`, `Jl. Penilaian Sintetis No. 302`, and the delivery instruction remained visible and locked after reopening; retry sent the identical request and confirmed success.

## Detector and browser synthesis

B ran the CLI exactly once: zero findings, exit0. Its16 technical states had no horizontal overflow. The confirmed application Axe issue was a recovery values container lacking keyboard focus after all retained inputs became disabled; instrumented overlay target-size findings were excluded. Three headless injections ran; pinned Arial was the confirmed false positive, with owner console rule detail incomplete. Eight states retained13 INCOMPLETE rule instances/73nodes separately, not as passes or violations. The250ms drawer-focus sample was inconclusive; independent meaningful e2e samples passed.

## Priority issues

**[P1] The immediate purchase-to-schedule handoff mixes snapshots.** After saving one Paket Coba purchase (+5), I opened Buat jadwal immediately upon its success notice, before refresh fully settled. The context then showed 5 remaining / 0 reserved / 5 available, valid from 5 October without expiry. For 12–18 October lunch, review showed required 7 / allocatable 0 / unallocated 7 and first shortfall 12 October; Confirm was disabled. Manual repair retained the choices and shortened the end to 13 October. After settling, review still showed required 2 / allocatable 0 / unallocated 2 with a red shortage, but Confirm was enabled. Confirm succeeded, announced “Jadwal dibuat dan kuota dipesan,” and produced 5 remaining / 2 reserved / 3 available. This can cause support requests or abandoned bookings despite valid funding.

The source explains the divergence: `ui.tsx:203` captures `openedReview` on opening, while `records.tsx:662` context and `:663` confirmation eligibility use refreshed props; review allocation at `:677` remains bound to the older snapshot. Keep context, preview and confirmation gating on one coherent snapshot; after a known successful purchase refresh, open the schedule against the refreshed grant or explicitly refresh and require a new review. Preserve reviewed record/version safeguards. Suggested command: `$impeccable harden`.

**[P2] Numeric dates can conflict with Indonesian reading order.** Chromium’s fresh default locale displayed Today’s 5 October as `10/05/2026`, while the adjacent caption said “5 Oktober 2026”; schedule inputs likewise displayed `10/12/2026`. Native browser localization is the cause, not wrong stored dates. Add a localized, unambiguous date caption beside editable native dates, especially review-sensitive starts/ends. Users should not need to infer whether 10/05 means May or October. Suggested command: `$impeccable clarify`.

No P0 found; no third priority invented.

**[P2] Recovery values require a keyboard-scroll target.** B found a settled scrollable-region-focusable violation at ui.tsx .form-fields during account recovery. Name that region and add tabIndex0 while maintaining disabled attempted fields and receipt replay. Suggested command: `$impeccable harden`.

## Cognitive load

Checklist: single focus **pass**; chunking **pass**; grouping **pass**; hierarchy **pass**; one decision at a time **pass**; minimal choices **fail locally**; working-memory support **fail in the stale handoff**; progressive disclosure **pass**. Two failures: moderate load, concentrated in one broken handoff and option sets.

More than four choices: seven weekday checkboxes are a natural calendar group; eight status-filter options are contained in a dropdown; owner navigation has six destinations separated into operations, management, and help; help’s current group has four topics under three task categories. None is an undifferentiated wall. Three meal radios and three stage links stay within the limit. Fresh quota versus stale allocation is the avoidable memory/reconciliation burden.

## Emotional journey and personas

Entry is calm and purposeful; production completeness gives confidence. The peak is a clear saved purchase/reservation. The valley is the contradictory next review, which makes that success feel unreliable. Recovery ends well: explicit uncertainty, retained work, controlled retry, clear confirmation. Customer choice feels safe because deadline/default consequences and Back are visible.

**Alex, power user:** Fast purchase → immediate scheduling exposes the stale review; bulk readiness and shortcuts otherwise serve rapid work.

**Jordan, first-timer:** “5 bisa dijadwalkan” versus “0 dapat dialokasikan” lacks an explanation; an enabled Confirm below a shortage warning is particularly confusing.

**Sam, keyboard/low-vision user:** Observed Escape/focus return and text statuses work well. Numeric native dates require extra interpretation in Indonesian. Full screen-reader behavior was not established by this visual review.

## Scope, minor observations, and questions

Fourteen PNGs captured and inspected once; capture 05 was discarded because navigation had not reached its intended customer-record route. Customer record, schedule/history, quota, and repair were additionally inspected by live DOM. Finite animations settled 800 ms; phones/tablets excluded. Both browser contexts and Chromium closed. Only one new `@demo.catera.test` customer was mutated; Nadia and seeded deliveries remained untouched.

Source/test definitions supplement—not live-exercise—the delivered one-unit debit, frozen-production prerequisites, failed reservation retention/retry/skip release, and reasoned owner reversal. No tests rerun. Profile explicitly says address changes apply to new bookings, not existing snapshots. Longer recovery forms correctly keep feedback/actions separate from scrolling fields. The browser-local date concern should be weighed against real Indonesian browser configuration.

Questions: Should a successful purchase offer a scheduling action only after its grant is available in the client snapshot? When funding changes during an open schedule, should Catera refresh the entire review with a visible “review updated” notice?
