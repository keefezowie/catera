# Marketplace-to-checkout quality, September 24, 2026

## Scope and baseline

Local responsive web improvements on an isolated checkout of current V1. PRODUCT.md, DESIGN.md, the V1 surface brief, checkout implementation, and current Next.js client-component documentation informed this pass. Brand artwork, colors, typography, and transactional business rules remain unchanged.

The local browser reproduced these issues before implementation:

| Priority | Finding | Acceptance |
| --- | --- | --- |
| High | Choosing one portion from package details reopened checkout with two portions from an old draft. | A new explicit selection wins; edits survive reload and address-management returns. |
| High | A failed payment-method lookup disabled payment without a retry. Loading looked like permanent unavailability. | Distinguish checking, lookup failure, and no available methods; retry retains the quoted order and consent and never submits a checkout. |
| Medium | Empty, stale, and out-of-coverage addresses had insufficient guidance before quote submission; narrow selects truncated the destination. | Explain the problem beside the address, show delivery areas and the full selected destination, and retain an add-address route. |
| Medium | Mobile summary details stayed squeezed beside the thumbnail far below the image. | Keep the food/name pairing while giving totals and disclosures the full card width. |

## Research and actual tool use

- **UX MCP**: `suggest_form_pattern` ran for checkout on web/mobile. Applied retained inputs, clear recovery, visible order information, and accessible field feedback. Its generic guest-checkout suggestion was not adopted because Catera's customer-account model is authoritative.
- **shadcn MCP**: `get_item_examples_from_registries` returned `field-demo`. Used as a grouping/labeling reference; no new component library or dependency was added.
- **Design Inspiration MCP**: the initial registered call failed because its process lacked `SERPER_API_KEY`. At the user's request the key was saved only in local Codex MCP configuration. A fresh stdio MCP connection to the same installed server successfully ran `design_search_references`, returning four references. The existing registered process still needs a reload to inherit the configuration. No credential is included in this repository or report.
- **Playwright MCP**: navigation, snapshots, scripted browser interactions, route-controlled fault injection, and screenshot capture ran. **agent-browser CLI** also loaded the isolated preview and captured a screenshot; it is not an MCP.
- **axe-core** ran in Chromium against the marketplace and checkout content, including payment error and address-coverage states. It is an accessibility library, not an MCP.
- **21st.dev, Figma, and Chrome DevTools MCP did not run**. No corresponding callable tool was available in this task. No claim is made about their use.

Sources consulted:

- [Food delivery cart and checkout reference](https://dribbble.com/shots/27429504-Food-Delivery-Cart-Checkout-Mobile-App-UI-UX-Design): relevant separation of item, destination, and review information. This is a visual concept, not evidence of measured usability. Catera does not adopt its tips, promotions, or multi-restaurant basket model.
- [Baymard checkout-flow guidance](https://baymard.com/learn/checkout-flow-ux-optimization): retained input and recoverable checkout errors.
- [W3C WAI form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/): explain errors and correction steps near controls, announce changed states, and manage focus.

## Implementation

- Explicit incoming checkout selections take precedence over stored drafts. Edits synchronize to the current URL using history replacement, retaining unrelated invitation/renewal parameters. Draft storage is account-scoped, and blocked browser storage does not prevent checkout. Previously unscoped drafts are not restored across accounts.
- Payment lookup distinguishes loading, failure, empty direct-method availability, and recovery. Retry is explicitly a non-submit button. Payment remains disabled during lookup or unavailability. Completed retries focus the result for keyboard users.
- Address feedback mirrors the existing server coverage rule; the server remains authoritative for purchase eligibility. Missing or out-of-coverage addresses cannot enter review. Current destination details remain readable outside the truncated selector.
- Mobile summaries allocate a full-width row to price, explanations, and the contents disclosure. The existing food image, forest/cream palette, typography, and business copy remain.

## Verification record

Dedicated local synthetic storage and preview at `http://127.0.0.1:3125`; no hosted database writes, provider requests, push, or deployment. The initial cross-drive dependency junction failed in Next.js and was replaced with an independent installation. A stalled first preview was superseded by port 3125.

The browser matrix covers Indonesian and English at 320, 390, 768, and 1440 CSS pixels. It exercises marketplace empty/reset and package detail, fresh choices versus old drafts, reload, address selection/return URL, quote failure and focus, server-quoted totals, payment lookup failure/delay/empty/retry, consent retention, mobile action clearance, and empty/stale/out-of-coverage addresses. Screenshots and the reproducible browser script live in `output/playwright/journey-quality/`; `matrix-results.json` contains the final per-viewport assertions.

The final matrix passed 260 assertions, including 40 axe scans with zero reported violations in the tested main content. Supplemental Indonesian phone and English desktop checks covered customer-data loading/failure/retry and failed-review recovery to the honest empty state. The existing address editor saved a synthetic instruction change durably and returned to checkout with two portions, the chosen date, and the selected address intact.

A local checkout then remained pending until explicit demo simulation; after simulation and reload, the API reported paid, with one new subscription and five deliveries of two portions, totaling Rp352,500. This verifies the local browser/API/persistence path only. `paymentFlow.json` and `supplemental.json` retain those results.

Repository checks: typecheck, all 261 unit tests in 37 files, production build, and 26 PostgreSQL concurrency checks passed. No full repository E2E-suite pass is claimed; browser verification was targeted to this journey.

## Limits and remaining priorities

- Fault responses and unavailable-method lists are injected only in the local browser. Synthetic payment activation is not a live-provider callback test.
- Hosted authentication, SMTP/SMS, real payment methods/callbacks, physical phones, Safari/Firefox, assistive-technology user testing, production performance, and real-customer comprehension remain unverified.
- No exhaustive product optimization is claimed. A short task-based customer study should test whether people understand portions, delivery-day cycles, and upfront totals. Any future calendar or pricing changes must retain server rules.
- Package-detail breadcrumb navigation still goes to general discovery; browser Back retains URL filters. A deliberate breadcrumb return-context improvement remains a separate candidate.
