# Account and settings design review — October 1, 2026

## Result

The account and settings refinement and bounded web-page design review are complete and accepted on the reviewed local synthetic evidence. Updated captures confirm the 320px English seller navigation, corrected payment-state presentation and consistent recovery pages. No acceptance-blocking visual issue remains from this pass.

## Basis and scope

This review used PRODUCT.md, DESIGN.md, the saved Firecrawl research in ACCOUNT-SETTINGS-RESEARCH-2026-10-01.md, and installed Impeccable Operate and craft-floor guidance. It preserves the approved palette, Jakarta typography, food-led discovery and existing role and business boundaries. External research consisted of official public documentation, not authenticated pixel inspection of those products.

The final visual pass inspected all 20 regenerated contact sheets in output/playwright/familiar-settings/final/contact-sheets-confirmed. These cover Indonesian guest, customer, seller owner and platform-admin route families at 390px and 1440px. Original screenshots were additionally inspected for English customer account, address edit and support dialogs at 390px; Indonesian expanded seller settings; English seller settings and settled messages/support; and English payment exception, unavailable menu and invalid-claim states. The original contact-sheets folder contained invalid NUL-filled derived files and is not review evidence; the regenerated confirmed folder contains valid images.

## Findings

- Customer account now has a compact identity and recognizable activity and support groups. Internal rows have consistent chevrons. Saved addresses retain an explicit add control and individual edit controls; preferences and sign-out remain separate.
- Address editing keeps the scheduled-delivery warning directly above the fields. The dialog has a clear title, close action, visible labels and a distinct save action. The support dialog likewise presents the request type, related purchase and explanation in a familiar form.
- Seller settings separates personal account, public caterer profile, payouts, team and help with a section navigator. Mobile identity and language rows stack without clipping. The payout section clearly distinguishes configuration, processing, paid and held amounts, and states that no transfer date is confirmed.
- Seller team copy distinguishes operational staff from owner financial access. Creating an invitation is visibly separate from sending it. Account-deletion help explains that submitting a request does not delete the account.
- The settled mobile seller messages page shows the selected conversation, message history and composer. The empty composer has a disabled send action. The prior loading-only capture is superseded by the settled recheck.
- Public discovery remains food-led. Customer delivery, subscription, calendar and support screens use recognizable task-oriented layouts. Seller and admin surfaces remain quieter and denser, with consistent selected navigation, labeled forms and progressive disclosure. Admin empty queues, reviews and refunds explain their current state.
- Pending, successful, refunded and partially refunded payment states have distinct headings and next actions. The review flagged the countdown on expired and payment-exception states because it conflicts with an already expired or received payment. This needs a pending-only countdown condition, without changing payment authority or eligibility.

No further material visual or familiarity issue was found in this bounded pass. Sparse unavailable-menu content still retains global navigation; it is not a reason to add a new workflow during this refinement.

## Evidence limits

Contact sheets establish route-level hierarchy and consistency; they are not a claim that every text pixel, interaction state or possible data combination was manually inspected. Browser interaction, focus, geometry, validation, loading and recovery results belong to the accompanying test reports. A fixed navigation bar appearing partway down a full-page screenshot reflects its viewport position during capture and is not by itself evidence of an inaccessible document footer.

All evidence is from an explicit local synthetic demo. This review establishes neither production/provider behavior nor physical-device or user-study validation. It does not authorize a hosted release.

## Final narrow confirmations

The 320px English navigation capture in output/playwright/familiar-settings/after/seller-navigation-en-320.png is accepted: all five labels are complete and readable on one line, including Schedule and Packages. The measured narrow-screen adjustment and its exception to historical guidance are documented in the research note. Fresh rechecks-confirmed English390 invitation-ready settings and settled support were also inspected and accepted.

Additional final-gaps English390 captures cover authenticated caterer onboarding, staff invitation entry, payment return, not-found and controlled error recovery. Onboarding and payment return are accepted; the return page explicitly says the link does not confirm payment. The not-found and error boundary captures exposed flush-to-edge content and an unstyled short retry target; a narrow recovery-layout correction was requested.

The payment correction is accepted from original screenshots in output/playwright/familiar-settings/after/payment-status: Indonesian expired, checking, unresolved-booking and paid-without-booking-hosted; English expired, unresolved-booking, paid-without-booking-hosted and awaiting-direct-payment. Expired, checking and received-payment views omit the countdown. Awaiting direct payment retains it. The paid-without-booking view clearly says payment was received and the schedule is being confirmed, with a status-check action and no second-payment instruction. These visual checks complement the separately reported state-matrix tests.

The recovery correction is accepted from output/playwright/familiar-settings/after/page-recovery: not-found-en-320.png, render-error-en-320.png, render-error-focus-id-390.png and render-error-en-1440.png. Content has clear screen-edge spacing and a constrained desktop measure; retry uses the established forest button and visible orange keyboard focus. The retry-recovered-en-390.png capture shows the settings route restored; dynamic section loading in that immediate post-reset capture is superseded by the separately inspected settled settings images. The verification agent reports all 12 focused recovery cases passed, including actual keyboard-triggered reset and marketplace recovery navigation. The red issue badge in controlled-fault screenshots is development tooling, not the production recovery UI.

This completes the bounded design review. Stop refinement here; remaining release and environment checks are separate from design acceptance.
