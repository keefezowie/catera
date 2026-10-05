---
target: Catera current Caterer and Customer landscape web UIUX at 1440x900 and 1280x800
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/workspace/catera/src/components"
timestamp: 2026-10-05T10-05-18Z
slug: src-components
---
Method: dual-agent (A: /root/landscape_design_review · B: /root/landscape_evidence_review)

# Catera current landscape web review

**Updated score: 28/40 — Good.** The prior baseline was 25/40. The three point improvement comes from error prevention, recognition rather than recall, and efficiency. This is a fresh heuristic assessment of current Caterer and Customer landscape web surfaces at 1440×900 and 1280×800. The earlier review included mobile, so the trend is directional rather than a controlled same-viewport comparison. No real-user task success metric or separate role score is claimed.

## Design health

| Heuristic | Previous /4 | Current /4 | Current evidence or remaining limit |
|---|---:|---:|---|
| Visibility of system status | 3 | 3 | Status, cutoff and production version are clear; main transition is too low in the drawer |
| Match with real-world work | 3 | 3 | Delivery/quota language fits; owner purchase inherits “Paket saya” |
| Control and freedom | 3 | 3 | Cancel, Back, Escape and filter reset work; drawer close loses row focus |
| Consistency and standards | 3 | 3 | Coherent controls and review pattern; a few role/heading inconsistencies |
| Error prevention | 2 | 3 | Funding, cutoff and production readiness safeguards now exist |
| Recognition rather than recall | 2 | 3 | Quota/validity context stays within scheduling; action placement still burdens scanning |
| Efficiency | 1 | 2 | Filters, recurrence, exports and direct review help; no batch fulfillment |
| Minimalist design | 3 | 3 | Calm hierarchy; excess vertical space weakens landscape composition |
| Error recovery | 3 | 3 | State is preserved and errors explained; generic input error lacks field attribution |
| Help and documentation | 2 | 2 | Useful inline help; no visible task-help/support destination |
| **Total** | **25/40** | **28/40** | **Good** |

## Specificity and overall impression

Catera feels authored for recurring catering: date-preserving Schedule → Production → Delivery stages, frozen production revisions, quota reservations, delivered accounting and per-delivery cutoff rules. The forest/cream palette and supplied food art are coherent. Its modernity gap is in desktop composition and operational density: the generic shell and narrow stacked Customer column do not exploit a wide working viewport.

The overall impression is reassuring and competent, with a layout that requires too much vertical travel for routine work. Keep the identity and improve how the landscape viewport supports decisions.

## What works

- Delivery-cycle navigation follows actual catering work and carries the selected date between stages.
- Quota, validity, cutoff, frozen-production eligibility and explicit review support trust at consequential decisions.
- Status words, consistent flat surfaces, progressive disclosure and warm brand art make the interface calm and legible.

## Priority findings

1. **[P1] Fulfillment action follows secondary edits.** On the 1280×800 delivery drawer, the Ready action begins around y828 after meal, address, reschedule and skip. Operators must scroll to the action that advances the delivery. **Fix:** a compact persistent status-action region with readiness prerequisites beside it; keep edits secondary and preserve review/accounting. Relevant source: delivery-detail.tsx:209/:272 and drawer CSS. Suggested commands: `$impeccable layout` and `$impeccable distill`.
2. **[P2] Owner header consumes the working viewport.** Today's first record begins around y658. Greeting, date summary, next-task notice, stages and toolbar precede the actual work rows. **Fix:** consolidate selected date, daily summary and stages into fewer bands; shorten the next-task cue; use comfortable denser desktop rows without shrinking essential text or interactive targets. Relevant source: operations.tsx:149–253 and globals.css operational layout. Command: `$impeccable layout`.
3. **[P2] Customer home remains a narrow vertical composition.** A 720px outer column provides 644px content inside the 1208px post-sidebar region at 1440px. Upcoming agenda starts below y1000. **Fix:** landscape-only two-column home, with next delivery and upcoming planning alongside quota/deadline context. Keep the expiring menu choice prominent and maintain readable text measures. Relevant source: portal.tsx:218 onward and globals.css:1416 onward. Commands: `$impeccable adapt` and `$impeccable layout`.
4. **[P2] Scheduling context hides the form and review footer.** About 440px of context precedes inputs in a 520px-wide modal at 1280×800; even a three-occurrence review initially hides Back/Confirm. **Fix:** wider landscape dialog with compact account context and form/review side by side; disclose the longer allocation explanation; keep footer actions visible while content scrolls. Relevant source: records.tsx:98/:328, ui.tsx dialog composition and modal/context CSS. Commands: `$impeccable layout` and `$impeccable distill`.
5. **[P2] Closing delivery detail loses keyboard position.** Independent reproduction: focus Nadia detail link → Enter → Escape → focus becomes BODY; next Tab restarts at skip link. **Fix:** restore focus to the opening row/link after the route-backed drawer closes, with a safe fallback when the row disappears. Relevant source: operations.tsx:446–465. Command: `$impeccable harden`.

No P0 blocker was observed. The P1 is a significant operational discoverability issue, not a proven inability to complete the task. Bulk ready/dispatch remains a feature opportunity that needs explicit eligibility, stale-version, per-record failure and quota-consequence design.

## Cognitive load, emotional journey and personas

Owner load is moderate: the detail exposes five actions, with the main transition following four secondary ones. Seven weekdays are a natural useful scheduling group; eight statuses live in a single select rather than competing visible buttons. Context and disclosure now reduce the previous memory bridge. The remaining load is vertical fragmentation.

Customer load is low: a dated future menu deadline appears above today's delivery, with clear dates distinguishing them. The narrow desktop stack prolongs the journey to the agenda.

Arrival and reviewed quota/production decisions feel reassuring. The Owner's main valley is repeated scrolling and individual record transitions; the Customer gets a useful deadline cue but must travel too far to see the following days. No completion action was submitted, so post-save feelings are inferred from source rather than observed this run.

- **Alex, Caterer power user:** scrolls to Ready, reviews, repeats per record; daily filters and exports help, but batch transitions and a quicker keyboard path are absent.
- **Jordan, first-time user:** scheduling now explains entitlement, but context occupies most of the initial modal. Owner purchase says “Paket saya,” which sounds like the operator's package.
- **Sam, keyboard/low-vision user:** text statuses, labels and focus treatments help. The drawer trap works, but closing it loses the originating row; long internally scrolling forms add effort.

## Modern Mobbin comparison

Nine web screens were visually inspected. These six are the selected references; they provide pattern inspiration, not proof of industry-wide standards or catering-specific usability. Capture dates are not supplied for every result. Shopify's sampled UI displays a Spring '26 label.

| Reference | Observed pattern | Application to Catera landscape |
|---|---|---|
| [Linear issue list](https://mobbin.com/screens/212fda35-366e-4dc0-a1d1-3b679659d6ab) | Compact rows and adjacent project properties | More working rows and context in view; retain readable operational text |
| [Linear display options](https://mobbin.com/screens/94bb4d3b-a8e3-41e8-b8f1-b82d1f904b03) | Grouping and optional display controls in a popover | Essential filters visible, occasional controls disclosed |
| [Shopify selected orders](https://mobbin.com/screens/168c2cfe-2399-4b47-ae3a-6a3df57970bd) | Row selection reveals contextual actions and preserves fulfillment status | Model a future eligible batch-action workflow |
| [Shopify fulfillment batch](https://mobbin.com/screens/10bda18e-95a0-4c93-8be9-3b3775477e90) | Batch identity, visible operational steps and timeline | Strengthen Catera's existing delivery cycle and frozen-production context |
| [HelloFresh delivery menu](https://mobbin.com/screens/9727fc82-8d4e-483d-81fc-2d2d14c8d5de) | Horizontal date navigation, deadline and side-by-side meal cards | Customer planning should use width and keep deadlines near choices |
| [HelloFresh account settings](https://mobbin.com/screens/b63b99be-d195-42c1-b421-d8b3b85076d3) | Section navigation, paired fields and distinct delivery settings | Align landscape account/form sections while preserving address snapshot rules |

Do not copy Linear's tiny labels, Shopify's broad warehouse workflow, or HelloFresh's upselling mechanics into Catera. Translate the useful spatial and interaction patterns into Catera's approved identity and business flow. No Mobbin image was embedded or exported. Further Notion Calendar exploration returned no screens; the Airbnb query timed out and is not evidence.

## Focused landscape plan

1. **Caterer daily workspace first:** compact the header and row density; make the fulfillment action persistently visible; restore focus when detail closes. Acceptance: current day rows start substantially higher, the main action is visible at 1280×800, and closing a detail returns to its opening row.
2. **Caterer scheduling and account context:** widen the landscape dialog, separate compact context from decision content, and retain a visible review footer. Acceptance: dates, weekdays, slot and review action are readily discoverable; funding and cutoff guardrails remain intact.
3. **Customer home and schedule:** use a broad two-column composition and horizontal date planning where useful. Acceptance: next meal, expiring choice, quota and upcoming days are visible together on the tested landscape widths.
4. **Re-review that same layout class:** 1280×800 and 1440×900, long Indonesian/English labels, low/high record counts, filters, keyboard navigation and open dialogs. Check shared-style regressions, then move to another layout class after landscape is settled.

This turn is a review, comparison and plan; no new UI revamp or transaction feature was implemented.

## Minor observations and detector evidence

Owner Today repeats production access in task cue, stage tab and footer. Menu descriptions appear after selection; a compact landscape comparison could help. Some role-specific labels and search placeholders need copy corrections. Detail routes should be checked for page-heading hierarchy.

The CLI scan returned zero findings. Three rendered overlays each returned only the page-level overused-font Arial warning, a false positive against the approved font. There were no other overlay rules. All twelve view/viewport samples had zero document overflow and zero axe violations for the selected WCAG tags; both drawer samples had an incomplete aria-hidden-focus result, with Tab trapping verified. The independent focus-restoration defect remains despite the zero-violation result. Some desktop controls are below the 44px comfort benchmark, but none measured below 24×24px; this is not an observed WCAG target-size failure. These samples do not establish universal accessibility or user-tested performance.

## Questions for the next design pass

Can the operator see the day's records and its next action without excessive scrolling? Can the Customer see today's meal, tomorrow's decision and the following days together? Which quota facts must remain visible to decide, and which can be disclosed?
