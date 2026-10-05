---
target: Caterer and Customer landscape web
total_score: 35
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T12-51-59Z
slug: src-components
---
Method: dual-agent (A: /root/goal_review4_a · B: /root/goal_review4_b)

## Design specificity

Catera feels authored for recurring catering. Date-led Schedule → Production → Delivery, frozen production revisions, reservation arithmetic, per-delivery cutoffs, and the next-meal panel define the composition. Forest, cream, original bento artwork, and restrained Arial/Segoe typography form a coherent identity. The familiar sidebar and bordered forms support that operational world rather than substituting for it. Modern landscape references inform adjacent detail, batch review, and meal comparison without copying another product’s identity.

## Design health

| # | Heuristic | Score /4 | Evidence and remaining friction |
|---|---|---:|---|
| 1 | Visibility of system status | 4 | Explicit statuses, frozen revision, allocation totals, pending guard, and observed save confirmations. |
| 2 | Match system / real world | 3 | Natural Indonesian; profile introduction overstates which future addresses change, and scheduling reuses purchase terminology. |
| 3 | User control and freedom | 3 | Review Back, Cancel, Escape, filters, and restored drawer focus work; ordinary dismissed drafts are not retained. |
| 4 | Consistency and standards | 4 | Cohesive controls, labeled navigation, native fields, predictable review and close behavior. |
| 5 | Error prevention | 4 | Exact purchase review, date/validity constraints, frozen-version guards, unfunded confirmation blocking, and fresh review after repair. |
| 6 | Recognition rather than recall | 3 | Customer/quota/date context accompanies decisions; recovery lacks the saved address beside its attempted replacement. |
| 7 | Flexibility and efficiency | 3 | Search, filters, shortcuts, date jumps, exports, and reviewed readiness/dispatch batches; ordinary draft reuse remains limited. |
| 8 | Aesthetic and minimalist design | 3 | Purposeful two-column customer layout and quiet tables; some header/context space and repeated explanatory copy could be tighter. |
| 9 | Error recovery | 4 | Pinpointed funding shortfall, focused endpoint repair, preserved attempted values, exact replay, and clear success. |
| 10 | Help and documentation | 4 | Searchable role-specific task groups; production help retained the selected date and returned to the actual task. |
| **Total** | **All ten apply** | **35/40** | **Good** |

## What works

- **Operational handoff:** production review showed eight eligible records, their meal, revision, and Terjadwal → Siap dikirim consequence. Cancel restored action focus. Drawer Escape restored its customer row and retained the status filter.
- **Funding truth at the decision:** immediately after an actual synthetic +5 purchase, Schedule showed context 5/0/5 and review 7/5/2, disabled confirmation, named the first shortfall, and offered 10 October as the funded endpoint. That repair focused the end-date field. A separately shortened two-day plan reviewed 2/2/0, saved two rows, and reported 5/2/3.
- **Trust through recovery:** an account save aborted before server execution retained the attempted phone/address through Escape and reopening. Saved phone 0800000051 and attempted phone 0800000052 had distinct labels. Keyboard PageDown scrolled the named retained-values region; retry sent the identical original request body, then confirmed the new saved data.

## Detector and browser synthesis

B ran the CLI exactly once: zero findings, exit 0. Twelve meaningful desktop technical states had zero Axe violations and horizontal overflow. Nine keyboard/recovery checks passed. Three headless overlays ran; pinned Arial and instrument banners were excluded. One P3 support-line measure advisory (~99 characters) remains. Raw INCOMPLETE overlap/focus-guard signals are retained separately. These technical results corroborate A’s recovery, review and navigation observations; no blocking technical finding changes the Nielsen score.

## Priority issues

No P0 or P1 blocker was established in this batch.

1. **[P2] Profile introduction implies existing upcoming addresses change.** `profileDescription` says “Detail kontak dan alamat untuk kiriman berikutnya,” while the nearby explanation correctly limits the profile address to new bookings. A customer scanning the introduction can infer the wrong scope. Say “Detail kontak dan alamat awal untuk jadwal baru” consistently. Suggested command: `$impeccable clarify`.
2. **[P2] Ordinary dismissal loses useful form work.** Source-defined dialog closing clears the draft, and non-recovery fields unmount. Review Back preserves choices, but Escape/reopen does not offer the same continuity for normal unsaved scheduling. Retain the session’s unsaved fields on dismissal and make explicit cancellation the discard path. Suggested command: `$impeccable harden`.
3. **[P2] Saved address is absent from the recovery comparison.** The left saved-context panel provides name, email, and phone; the attempted right column includes street, city, and instructions. The distinction is now clear, but checking an address replacement still requires remembering the old address or closing the dialog. Include saved address/instructions in a compact disclosure or changed-fields comparison. Suggested command: `$impeccable clarify`.
4. **[P3] Schedule starts with “Mulai berlaku.”** That is apt for a purchase grant but less precise for the first delivery date. Give scheduling its own “Tanggal mulai kirim” label; retain “Mulai berlaku” for entitlement validity. Suggested command: `$impeccable clarify`.

**P3 — Schedule support-line measure.** B flagged a supporting sentence at records.tsx:453 (~99 characters) while the review remained readable and unclipped. Cap supporting prose to a readable measure. Suggested command: `$impeccable polish`.

## Cognitive load and emotional journey

Checklist: single focus ✓; chunking △; grouping ✓; hierarchy ✓; one decision at a time ✓; minimal choices △; working-memory support ✓ with the recovery-address exception; progressive disclosure ✓. Two strict checklist failures indicate moderate load. The seven weekday checkboxes exceed four visible options but are a familiar calendar set. The eight status-filter options exceed four when the select opens. Eight batch records are inspection items, not eight competing actions; grouping and a single confirmation keep them manageable. Help groups contain at most four task links, meals offer three radios, and quota uses three totals.

The journey starts calm and task-directed. Funding shortage and uncertain saving create real emotional valleys; exact math, repair, retained values, and explicit success supply reassurance. The purchase → schedule → save ending is credible. Cancellation also ends predictably, with focus restored. Address scope and discarded normal drafts are the remaining avoidable surprises.

## Persona red flags, limits, and minor observations

**Alex:** ordinary Escape/reopen can require re-entering scheduling choices; bulk readiness/dispatch and shortcuts otherwise serve expertise. **Jordan:** profile introduction and “Mulai berlaku” invite literal misunderstandings; help and named default meal substantially reduce uncertainty. **Sam:** recovery fields require the separately named scroll region to inspect disabled inputs. Actual keyboard scrolling and restored drawer/menu focus worked; no click-only blocker was established.

Ten settled screenshots were captured and each inspected once; all had matching document/viewport widths. Nadia and seeded business records were read-only. One synthetic customer was created, purchased +5, scheduled two lunches, and had one recovered account edit. Both contexts closed. Relevant current tests were read as source evidence, not executed; they cover production-version integrity, idempotency, validation, keyboard behavior, and funding refresh. No screen-reader, zoom, hosted network, or all-state accessibility claim is made. The operations future-date DOM sample caught `aria-busy=true`; its completion is unverified, not a product defect. Source/tests define a guarded transition. Native date controls rendered browser-style numerals; the adjacent full Indonesian caption made the date unambiguous.

Questions to consider: Should reopened ordinary forms resume a draft? Could recovery show only changed fields with their saved counterparts? Which profile sentence should define the address promise before a customer acts?
