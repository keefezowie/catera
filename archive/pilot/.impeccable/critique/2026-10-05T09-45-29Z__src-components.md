---
target: Catera Caterer and Customer UIUX — original baseline, with implemented optimization disposition
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T09-45-29Z
slug: src-components
---
Method: dual-agent (A: /root/design_review · B: /root/evidence_review)

# Catera UIUX review and implemented optimization

Reviewed Caterer/owner/admin and Customer/subscriber surfaces in `src/components`. This is an Operate product: recurring catering, quota-based scheduling, menu selection, production and delivery. Findings and scores describe the original interface; implementation and verification describe the resulting changes. No new post-change usability score is claimed.

## Answers to the three review goals

1. **Simplicity:** The original interface was calm visually but required unnecessary navigation, remembered quota details and repeated fulfillment dialogs. Caterer navigation now has one daily operations entry with Schedule → Production → Delivery stages, contextual next-task guidance and status filters. Quota detail, adjustments and history use progressive disclosure. Customer home surfaces the earliest outstanding menu choice, and Upcoming is separated from History.
2. **Clarity and hierarchy:** The established forest-green/cream identity fits Catera. The largest defects were tiny essential text, small controls, equally emphasized edits and ambiguous cutoff/readiness states. Essential secondary screen text is now at least 12px, key controls use 44px targets, statuses and cutoff states are explicit, and the next action receives appropriate emphasis. Phone stage tabs wrap within 320px and 390px screens.
3. **Business flow:** The app already had the correct operational spine. The UI now explains and guards that flow at decision points: external purchase → quota grant → schedule reservation → menu selection → cutoff → frozen production → ready → dispatch → delivered. Scheduling displays customer, grant validity and funding allocation; impossible confirmation is blocked. Ready requires the applicable complete production version. Delivered still debits one quota; failure/retry/cancel and reversal keep their existing accounting rules.

## Design health — original interface

| # | Heuristic | Score / 4 | Original weakness |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Ready eligibility and closed cutoff were unclear |
| 2 | Match with the real world | 3 | Quota arithmetic needed explanation |
| 3 | User control and freedom | 3 | Filter recovery and mobile navigation could improve |
| 4 | Consistency and standards | 3 | Customer schedule mixed upcoming and historical records |
| 5 | Error prevention | 2 | Unfunded scheduling could reach Confirm |
| 6 | Recognition rather than recall | 2 | Scheduling hid account and validity context |
| 7 | Flexibility and efficiency | 1 | Redundant fulfillment step; no batch path |
| 8 | Aesthetic and minimalist design | 3 | Repeated navigation and secondary action competition |
| 9 | Error recognition and recovery | 3 | Useful errors, but clearer recovery paths needed |
| 10 | Help and documentation | 2 | Limited contextual entitlement guidance |
| | **Total** | **25/40** | **Acceptable; significant improvements needed** |

## Specificity, overall impression and strengths

The original design is recognizably Catera: recurring delivery stages, Indonesian-first language, approved food art, forest/cream surfaces and explicit quota accounting. The strongest opportunity was to make the next operational decision obvious while retaining that identity.

- Date-preserving Schedule → Production → Delivery matches daily catering work. Frozen versions and exports provide a credible production checkpoint.
- Separate purchase, remaining/reserved/available quota and delivered −1 review preserve understandable accounting. Address changes have explicit consequences.
- Calm brand art, textual statuses and customer bottom navigation give the product a coherent, reassuring character.

## Five priority findings and disposition

1. **[P1] Scheduling required remembered quota and validity information.** This creates uncertainty and lets users review an impossible booking. **Implemented:** customer and quota context inside the form, valid defaults, grant validity, required/funded/unallocated totals, preserved form values and disabled confirmation for insufficient funding or invalid cutoff conditions. Quota explanation states that reservations remain in the balance until delivery is received. Suggested command: `$impeccable harden src/components/records.tsx`.
2. **[P1] Routine fulfillment repeated an empty form before review.** Operators lose time during the busiest part of the day. **Implemented:** actions without fields open directly into contextual review; production readiness is guarded and delivery accounting confirmation remains explicit. **Remaining:** eligible bulk-ready/dispatch actions need a separate transactional feature design. Suggested command: `$impeccable distill src/components/delivery-detail.tsx`.
3. **[P2] Customer home prioritized a locked meal over an expiring choice.** Upcoming also included terminal records in the source. **Implemented:** earliest pending selection above the hero, explicit delivery status and editable/closed cutoff, sorted Upcoming and separate History, no repeated next delivery. Suggested command: `$impeccable clarify src/components/portal.tsx`.
4. **[P2] Essential copy and controls were too small on phones.** Original quota captions reached 10px and several icon controls were 36px. **Implemented:** readable secondary screen text, larger labelled targets, improved contrast, single-column phone fields, a hidden/inert closed navigation drawer with focus handling, and stage tabs that fit small phones. Suggested command: `$impeccable adapt src/app/globals.css`.
5. **[P2] Customer menu selection omitted available descriptions.** An unfamiliar dish name forced guessing. **Implemented:** existing descriptions appear with the selected native menu option. No dietary or allergen claims were invented. Suggested command: `$impeccable clarify src/components/delivery-detail.tsx`.

No P0 blocker was observed in the inspected journeys.

## Cognitive load and emotional journey

Original load concentrated at decision points: eight owner destinations, five detail actions, seven weekday choices with small labels, the account-to-schedule memory bridge and redundant no-input dialogs. Domain-specific weekday choices remain, with clearer grouping and larger targets. Reduced navigation, contextual guidance and disclosure reduce simultaneous decisions.

The original welcome and purchase review felt reassuring. Scheduling was the main uncertainty valley because entitlement and dates were disconnected. Frozen production restored confidence; repetitive fulfillment added friction. The delivered −1 and reversal explanation provided a trustworthy ending. The changes put reassurance at scheduling, cutoff and readiness decisions.

## Persona red flags

- **Alex, Caterer power user:** repeated empty fulfillment steps are removed. One-record-at-a-time advancement still limits larger daily workloads; batch operations are the clearest next feature.
- **Jordan, first-time operator/customer:** previously had to infer remaining versus reserved quota and remember grant validity. Scheduling now carries that context and explains the funding result.
- **Casey, distracted mobile customer:** previously saw a locked meal before actionable future choices and tiny cutoff/quota labels. Pending selection is surfaced earlier, with explicit status and readable controls.

These are heuristic walkthroughs, not recruited-user research.

## Detector evidence and minor observations

The component CLI detector returned **0 findings**. Rendered overlays nevertheless found undersized targets and tiny text: 29 flagged element groups on owner Today, 6 on Production and 15 on Customer home; rule categories overlap. This agrees with the independent design assessment. Overlay-label occlusion was a false positive; Arial is an approved font and was retained. Regular spacing was advisory. An offscreen closed drawer did not overflow the document but still exposed focus/accessibility surfaces; this was fixed.

Menu publication summaries and first-version production change wording remain candidates for later copy work. Larger operating volumes should guide batch-work and history-pagination priorities. The 44px target is a comfort recommendation; WCAG 2.2 AA target-size minimum is generally 24px with defined exceptions.

## Research and design references

Mobbin references were inspected as pattern inspiration, not proof of industry-wide standards or user-tested success for catering:

- [HelloFresh delivery date and edit deadline](https://mobbin.com/screens/5aa17c60-2637-4b18-8845-91f3cfd8d7b6) informed explicit next-delivery/cutoff states; [related flow](https://mobbin.com/flows/800eaca2-42f6-4935-af3c-55342c69704a).
- [Airtable contextual operational filters](https://mobbin.com/screens/1ccf6613-4abd-420f-9d18-ac7b40a04848) informed recoverable status filtering.
- [Asana status-grouped work](https://mobbin.com/screens/850b4efd-2be3-4dd7-85bc-293f5cc7ee3e) informed the next-task hierarchy.

Firecrawl was used to consult [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) and [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Mobbin screenshots were not copied into the app.

## Verification and limits

- Type checking and 34 unit tests passed.
- All 9 browser scenarios passed across the full run and targeted rerun: 7 passed in the full run; the 2 initially failing locator/accessibility-name cases passed after correction. Coverage includes shared role updates, quota debit, address snapshots, stale forms, permission boundaries, scheduling funding, filters and mobile focus handling.
- Final production build passed after the last responsive correction.
- Five final captures at 1440px, 768px, 390px and 320px had document widths matching the viewport and zero automated axe violations in the selected WCAG rule sets. This is sampled verification, not full accessibility conformance.
- Independent finish reviewer disposition: **ship**, after verifying the sole requested phone-overflow correction.

Changes are in the local project. No production deployment or real-user usability study was performed. Browser tests used temporary synthetic data; the original local demo database was restored.

## Design questions for future feature discovery

Which daily transitions deserve eligible batch actions? Which history volumes warrant server-side pagination? What evidence from actual Caterers and Customers would demonstrate lower task time and fewer scheduling mistakes?
