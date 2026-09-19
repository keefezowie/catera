# Catera desktop and mobile web UX research

Research and implementation: September 19, 2026. Scope: marketplace discovery, package evaluation, checkout, customer delivery management, caterer operations, and shared administrative controls. Product authority: [PRODUCT.md](../PRODUCT.md). Visual authority: [DESIGN.md](../DESIGN.md).

## Conclusion

Catera benefits most from clearer purchase decisions and reliable operational controls. Its existing food photography, forest/cream palette, labeled navigation, meal calendar, and reusable overlays provide a sound foundation. The work below fixes observed friction while retaining that identity and the prepaid delivery-cycle model.

The implemented changes make filters visible and recoverable, retain discovery intent across navigation, bring price forward, expose the delivery destination at checkout, keep the confirmed total beside the payment action, improve keyboard/screen-reader behavior, and reduce downloads for approved local artwork.

“Industry standard” is treated as an explicit set of usability, accessibility, responsive-layout, and performance criteria. Automated checks establish the results listed below for the tested states. Conversion improvement, production Core Web Vitals, physical-device behavior, and accessibility conformance require additional evidence; this report does not claim them.

## Method and evidence quality

1. Reviewed current official public product pages and help documentation from six relevant services, with Indonesian catering and merchant workflows represented alongside international meal subscriptions.
2. Compared task structure, discovery, price disclosure, scheduling, account management, and seller work against Catera's product constraints.
3. Inspected rendered Catera screens and source behavior; audited guest, customer, caterer, and administrator pages.
4. Implemented shared repairs and targeted purchase-flow improvements.
5. Repeated layout/accessibility checks and exercised real local API-backed journeys using synthetic fixtures.

Competitor observations below are desk research from cited public pages. They are not claims of completing competitors' paid checkout, operating their merchant accounts, or testing their native apps. CookUnity's direct browser page rejected automation; its official support documentation was available. No customer interviews or comparative conversion experiment were conducted.

All Catera mutations used an explicitly enabled, isolated synthetic demo at `http://127.0.0.1:3124`, with storage in `.data/ux-research-20260919`. Hosted customer data, Supabase projects, and production configuration were not changed.

## Comparable products and decisions

| Reference | Publicly documented pattern | Application to Catera | Product boundary |
| --- | --- | --- | --- |
| **Kulina, Indonesia** | The current service emphasizes corporate meal provision, catering/restaurant choice, and coordinated ordering and delivery. [Official site](https://www.kulina.id/) | Explain whom the meal is for, the delivery area, schedule, and caterer before requiring commitment. Give operators a clear daily workload. | Kulina's current corporate positioning differs from Catera's consumer marketplace. Older consumer landing pages do not prove current app behavior. |
| **Yellow Fit Kitchen, Indonesia** | Menus, product choices, pricing information, and frequently asked questions are prominent public entry points. [Products and navigation](https://www.yellowfitkitchen.com/), [FAQ](https://www.yellowfitkitchen.com/faq), [menu](https://www.yellowfitkitchen.com/menu) | Make package contents and meal frequency easy to inspect, with price and schedule close to the choice. Keep nutrition available as supporting information. | Preserve Catera's broader catering audience. Do not import weight-loss promises or unsupported health claims. |
| **CookUnity** | Its ordering guide organizes work around a delivery date: review the order, search/filter meals, confirm, then see the order summary and status. Changes follow a cutoff. [Ordering guide](https://support.cookunity.com/hc/en-us/articles/46097340794779-How-to-Place-Your-Orders), [service overview](https://www.cookunity.com/how-it-works) | Preserve the date-led customer calendar, visible selection state, explicit confirmation, and cutoff-aware actions. Carry search/filter intent back from package details. | CookUnity's recurring subscription is not Catera's prepaid fixed delivery-day cycle. Do not add automatic renewal or select arbitrary fallback dishes. |
| **Factor** | Its public flow connects meal preferences and selection with delivery scheduling, plan information, and change deadlines. Its help content explains ordering and shipping. [How it works](https://www.factor75.com/about/how-it-works) | Make meal count, frequency, duration, delivery, and final charges readable before the customer proceeds. | Do not copy subscription incentives or recurrence assumptions. The authoritative Catera quote remains the source of the payable total. |
| **GrabMerchant, Indonesia** | Official guidance separates menu categories/items/options and emphasizes item information and photographs. Scheduled and pickup orders have distinct operational handling. [Menu management](https://merchant.grab.com/id-id/guides/getting-started/panduan-membuat-menu-item-kategori-dan-foto-di-aplikasi-grabmerchant), [order management](https://merchant.grab.com/id-id/guides/default/mengelola-pesanan-pengambilan-sendiri-dan-pesanan-terjadwal) | Keep caterer actions short, recognizable, and attached to the selected date/meal. Preserve status text, package grouping, bulk operations, and dedicated menu editing. | A caterer needs recurring production and delivery planning. Avoid expanding Catera into restaurant POS or dispatch software. |
| **GoFood Merchant, Indonesia** | Official menu guidance distinguishes categories and item fields, including name, description, price, and image. [Menu management guide](https://gofoodmerchant.co.id/biztips/topics/manajemen-menu-dan-inovasi/menu-semua-wajib-tahu/cara-menambah-dan-menghapus-menu-di-go-food) | Retain structured package/dish controls and recognizable actions. Improve shared controls rather than adding explanatory text to every operational row. | Marketplace food-delivery conventions inform clarity; they do not replace Catera's immutable purchased package terms. |

The recurring themes are **recognizable choices, visible commitment, schedule context, and recoverable actions**. These are design inferences from the references, not measured evidence that another app's exact layout will increase Catera's conversion.

## Standards translated into acceptance criteria

| Criterion | Basis | Acceptance used here |
| --- | --- | --- |
| Visible state and recovery | [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | Selected filters remain identifiable; individual removal and clear-all work; empty results provide a recovery action; errors retain user input. |
| Applied-filter overview | [Baymard applied-filter research](https://baymard.com/research-articles/how-to-design-applied-filters) | Desktop and mobile show removable filter chips and a result count outside the advanced-filter disclosure. A count alone is insufficient. |
| Price clarity at commitment | [Baymard payment UX](https://baymard.com/learn/payment-ux), [checkout optimization](https://baymard.com/blog/checkout-flow-ux-optimization) | Package total and per-meal price are visible during comparison; the preliminary subtotal is labeled; the server-confirmed total appears beside the continue-to-payment control. |
| Responsive reflow | [WCAG 2.2 reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | No document-level horizontal overflow at 320, 390, 768, and 1440 CSS pixels. Intentional calendar/filter/table scrollers are checked separately. |
| Target size | [WCAG 2.2 target-size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | WCAG AA uses 24 CSS pixels with defined spacing/exceptions. Common Catera actions retain the stronger existing 44px design target. These are different thresholds. |
| Keyboard and semantics | [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Valid control semantics, named landmarks, logical headings, selected/current state, predictable focus after checkout steps, and reachable actions above the phone navigation. |
| Performance | [Core Web Vitals](https://web.dev/articles/vitals) | Reduce unnecessary image transfer and retain image dimensions. Production goals remain LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile; this local work does not establish those field results. |

## Observed problems and implemented changes

| Observed problem | Change | Why it matters |
| --- | --- | --- |
| Filter choices were hidden once the panel closed; reset omitted package type. | Added removable applied-filter chips, live result counts, complete reset, and a useful empty-results action. | Customers can explain and undo a narrow result set without guessing which hidden option caused it. |
| Search and filter state disappeared after visiting a package or reloading. | Validated discovery state now lives in URL query parameters and survives detail/back/reload. Edits preserve unrelated attribution parameters and the selected sort. | Customers can compare several packages without repeating their work, and share their current selection. |
| Selected meal/diet/trial controls exposed only visual selection. | Added pressed state and descriptive removal labels; reset restores focus to search. | Assistive technology receives the same selection information as sighted users. |
| The populated comparison table had a heading-level gap, an empty action-row header, and no named keyboard scrolling region. Row labels moved out of view on phones. | Added logical headings, header scopes, a labeled action row, keyboard access, a phone scrolling hint, and fixed row labels while scrolling. The empty state now names the actual Compare control. | Customers can understand and navigate comparisons with a keyboard or screen reader, including narrow layouts. |
| Search had a nested border and weak visual alignment; advanced controls competed with results. | Unified the search field, retained a 16px input, aligned controls, and grouped advanced filters with explicit labels. | Desktop controls read as one search/filter system; phone layouts keep usable targets and avoid document overflow. |
| The package price followed detailed contents/nutrition. | Moved package total, per-meal rate, and delivery coverage immediately after the commitment summary. | The comparison sequence now answers what, how often, how much, then details. Pricing calculations and stored daily rates are unchanged. |
| Package booking controls were far below content on narrow screens. | Added a labeled jump to the booking section at tablet/phone sizes. | Customers can reach the purchase decision without manually scrolling through every detail. |
| An image-optimization iteration exposed an oversized package photo on phone layouts. | Explicitly retained responsive image height and added geometry assertions across widths. | The photograph no longer pushes the package identity far below the first screen. |
| Mobile checkout introduced a long form before the selected package; the initial total was a dash. | Placed a compact package summary before the form on narrow layouts and beside it on desktop. Added a clearly labeled base subtotal and expandable package contents. | Customers can verify what they are configuring. Discounts and service fees remain explicitly deferred to the quote. |
| Checkout review asked customers to confirm an address without displaying it there. | Added the selected address label, full line, and area to the review step. | Customers can actually verify the destination before continuing. |
| The confirmed total could be separated from the payment action by a long schedule. | Paired the server-confirmed total with the action; added a phone sticky treatment with bottom-navigation clearance. | The amount remains available at the point of commitment without covering the navigation or confirmation control. |
| Both checkout steps could appear current; changing step did not establish keyboard context. | Used an ordered progress list, one `aria-current="step"`, completed styling, and focused the new step heading. | Customers can identify their place and continue with the keyboard after review or edit. |
| Date/time buttons used unsupported `aria-required`. | Announced required status with a described-by hint while retaining validation/error descriptions. | The shared controls expose valid semantics across customer, seller, and admin forms. |
| A customer shortcut had no accessible name; operational/inbox landmarks were ambiguous; subscription headings skipped a level. | Added a short “View all” label, named landmarks, and context-appropriate subscription headings. | Navigation becomes easier to understand with a screen reader. |
| The seller help link had an undersized target; attention-widget loading used a full-page mascot. | Applied the shared action style and a compact localized loading status; tightened the empty attention panel. | Routine operational work gets consistent controls and less distracting loading. |
| Saving a customer delivery change cleared the caterer's package and meal filters. | Retain filters that still include the changed delivery while moving the calendar to its saved date. | An operator can make successive changes without losing their selected workload. |
| Local food originals were roughly 2.5–2.9 MB and the wordmark approximately 275 KB. | Added responsive Next.js derivatives for approved local food assets and the wordmark. Other image URLs retain their existing delivery path. | Phone users download a suitably sized image; original compositions and masters are preserved. |

## Verification and reproducibility

The route sweep covers **33 pages × four widths = 132 rendered states** in Indonesian: public discovery/package/login, customer home/calendar/delivery/messages/account/addresses/notifications/support/subscriptions/checkout/comparison, nine caterer destinations, and eight administrator destinations. After repairing subscription heading order, those eight combinations were rerun. A further 28 combinations were rerun after responsive image changes; the final audit incorporates the latest results.

Final route-sweep results: **zero axe violations for the configured WCAG A/AA and best-practice tags, zero uncaught page errors, and zero document-level horizontal overflow**. This describes the loaded states, not every possible dialog, fixture, language, or future data shape. Custom sub-24px measurements include native checkbox controls; the axe target-size assessment accounts for spacing exceptions.

New regression coverage exercises search recovery, URL persistence, reset of every filter including package type, empty states, price hierarchy, checkout summary/order, real quote totals, displayed destination, step focus, and bottom-navigation clearance in **Indonesian and English at all four widths**. Existing journey suites supply the broader dialog, calendar, seller, comparison, authentication, and purchase checks.

Verification artifacts:

- [Final route audit](../output/playwright/uiux/final/audit.json); runner: [audit.mjs](../output/playwright/uiux/audit.mjs).
- [New browser regressions](../tests/e2e/uiux-research.spec.ts) and [URL-state unit tests](../tests/catalog-query.test.ts).
- [PostgreSQL concurrency/security results](../output/playwright/uiux/postgres.json).
- [Check summary](../output/playwright/uiux/verification.json).
- Screenshots: `output/playwright/uiux/final/`, corrected subscriptions in `final-subscriptions/`, final image/layout captures in `final-media/`, and Indonesian/English flow captures in `verified/`.

The audit runner expects the isolated demo on port 3124 and an installed Chrome browser. Run `node output/playwright/uiux/audit.mjs final` after starting that fixture server. The new Playwright tests also work through the repository's standard test configuration; this run used a local override pointing at port 3124.

### Measured image transfer

| Asset / request | Original | WebP derivative | Reduction |
| --- | ---: | ---: | ---: |
| `ayam-panggang.png`, 640px width, quality 75 | 2,726,188 bytes | 55,100 bytes | 98.0% |
| Catera wordmark, 384px width, quality 75 | 274,935 bytes | 8,714 bytes | 96.8% |

Measurements are response-body bytes for local requests with `Accept: image/webp`. They are sample asset reductions, not a measured reduction in total page weight or proof of production loading speed. The browser regression also confirms a working responsive image and a response below 200 KB for the tested phone hero.

An additional isolated production-mode server was requested for a performance measurement. Automatic approval review rejected that process launch with “blocked by policy.” It was not started, and no Lighthouse or production-mode performance score is claimed.

### Required checks

| Check | Final result |
| --- | --- |
| `npm run typecheck` | Passed web, native workspace, and root TypeScript checks. |
| `npm test` | 198 tests passed across 28 files. |
| `npm run build` | Production build passed. |
| `npm run test:postgres` | All 21 concurrency/security scenarios passed against disposable local PostgreSQL. |
| Existing browser journeys | All 69 selected scenarios passed across the initial run and focused reruns. |
| New UX regressions | All 18 passed: 16 discovery/checkout language-and-width cases, one responsive-image check, and one populated-comparison check exercising all four widths. |
| Route audit | 132 final rendered states; no reported axe violations, uncaught page errors, or document-level horizontal overflow. |
| Source review | `git diff --check` passed. Reviewed shared components, responsive image dimensions, focus, state preservation, and price provenance. |

The existing browser run covers `conditional-ui`, `featured-hero`, `guest-auth`, `journeys`, `multi-cycle`, `navigation-controls`, `package-presentation`, `seller-experience`, `usability`, and `visual`. This is **87 distinct browser scenarios**, including the 18 new cases; it is not a claim that every repository browser suite was executed.

Eight initial existing-suite failures were investigated. The delivery-calendar failure exposed the real filter-reset defect and now explicitly checks retained package and meal filters after both address and date changes. Other failures used a pre-count filter name, retired promotion creation, old labels, preloaded support-record assumptions, or an outdated route for subscription cancellation. Updated tests exercise current controls and seed their own synthetic support record. Admin pending/error assertions now run against the current bank-review dialog using synthetic read responses and an injected conflict; they still require blocked dismissal, one submission, retained input, and restored focus.

A date-dependent unit-test fixture was repaired because a Saturday request legitimately advanced to the next operating day; the cutoff assertion now uses a previous-week date and retains its original rejection requirement. Production behavior was not changed for that fixture. The combined `npm run check` passed; the final comparison CSS adjustment also received a focused browser rerun and production rebuild.

### Representative captures

[Desktop discovery](../output/playwright/uiux/final/guest-home-1440.png) · [Phone package detail](../output/playwright/uiux/verified/package-id-390.png) · [Phone booking](../output/playwright/uiux/verified/package-booking-id-390.png) · [Phone checkout](../output/playwright/uiux/verified/checkout-id-390.png) · [Phone comparison](../output/playwright/uiux/verified/comparison-id-390.png).

## What still requires external evidence

- **Representative-user usability:** run task-based sessions with new Indonesian customers and caterer owner/operators. Ask customers to find a suitable package within a budget, compare two options, explain the complete charge, inspect a delivery date, and recover from an unavailable choice. Ask caterers to find the next workload, update a menu, process a batch, and recover an interrupted edit. Record task completion, incorrect commitments, time, backtracking, and assistance needed.
- **Real devices and assistive technology:** verify iOS Safari and Android Chrome with the software keyboard, safe areas, touch scrolling, large text, and VoiceOver/TalkBack. Desktop Chrome viewport tests do not substitute for those checks.
- **Production performance:** collect real-user Core Web Vitals and validate image optimization on the actual hosting target with seller uploads and ordinary network conditions. Local synthetic image samples do not characterize those requests.
- **Hosted purchase acceptance:** preserve the separate Supabase, payment, messaging, and release gates in [RUNBOOK.md](RUNBOOK.md). This work does not constitute hosted acceptance or deployment.

The research-backed repairs and automated acceptance checks are implemented locally. Further iteration should be driven by failed acceptance criteria and observed user friction, with conversion and task-completion comparisons after release; a blanket claim that every possible experience is permanently optimized would exceed the evidence.
