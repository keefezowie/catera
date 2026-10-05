# Delivery cycle — implementation contract

Direction: approved B, Delivery cycle. Source: Catera-Shape-Brief.md and the user's implementation request. This is an inherited, code-first surface; no new concept seed or image composition was requested.

## WORLD
Warm, calm, organized catering operations. Preserve Catera's original artwork and exact board palette: forest #163D2E, cream #FFF7E9, orange #F47B2A, charcoal #2E2E2E. The supplied raster board is preserved byte-for-byte and displayed through CSS crops. System sans typography serves operational data.

## FIRST VIEWPORT
At 1280×800 and 1440×900, admin work begins with a single title/date band, compact daily context, Schedule → Production → Delivery, then actionable rows. Subscriber Home pairs the next delivery with quota and upcoming agenda in two columns. Scheduling pairs customer/funding context with date fields; review and confirmation stay visible while content scrolls.

## SIGNATURE
Open a delivery beside the current date's list on desktop; closing restores the originating row's focus and filters. The next fulfillment action precedes secondary edits. Selection reveals reviewed Ready/Dispatch batch actions with per-record results. Customer date navigation and comparison radios support choosing meals. Same-page form drafts survive dismissal until explicit Cancel or successful save, and reopening requires fresh review. Recovery distinguishes saved contact/address context from immutable attempted changes. Changes retain explicit review, cutoff feedback, connected history and transaction safeguards. Navigating or opening a record never deducts quota.

## MOTION
180–200 ms drawer and feedback transitions. Controls communicate state. Reduced-motion preference removes animation.

## RESPONSIVE
Admin desktop uses a 232px sidebar and wide operational list. At phone/tablet widths navigation becomes a drawer; secondary list columns collapse while full detail remains available. Subscriber phones use a four-destination bottom navigation. Never compress the three stages into narrow parallel columns.

## FINISH
Verify landscape 1280×800 and 1440×900, with regression checks at tablet 768px and phone 390px. Run meaningful workflow tests and accessibility checks. Inspect the resulting screenshot set, resolve independent review findings, and document actual implemented tokens/components. The local UI is labeled synthetic; hosted services remain a separate deployment gate. Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
