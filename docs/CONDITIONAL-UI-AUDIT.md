# Conditional web UI audit — 14 September 2026

## Result and implementation

The reported package confirmation had two shared causes: the editor's 860px width was capped by the generic 620px maximum, and every backdrop was behind every dialog panel. Explicit dialog sizes now set both constraints. An ordered dialog registry handles sibling confirmations and nested photo viewers; inactive dialogs are inert. Portaled selects and anchored popovers inherit their owner's layer. Date/time controls no longer mix browser-native top-layer popovers with body portals. The schedule calendar now uses the same modal primitive.

Confirmation surfaces are capped at 440px, forms at 620px, and editors/media at 860px. Complex editors fill phone screens below 560px; confirmations retain at least 16px of side clearance. Editor bodies scroll independently, safe-area spacing protects phone controls, and confirmation actions stack on phones. The schedule picker has a specific narrow-screen layout to preserve 44px date targets.

Focus returns to the invoking control, including when a child and its parent close together. Confirmations initially focus the safe action and reject outside dismissal. Pending forms prevent duplicate submission and modal dismissal; secondary form buttons and selects respect pending state. Invalid collapsed sections open before field focus. Inline category drafts remain mounted when collapsed. Failed image previews expose retry feedback. The account-menu trigger waits for hydration so an early click cannot disappear before its handler is ready.

The existing product palette, artwork, Indonesian-first labels, entitlement rules, and database APIs remain unchanged. No deployment or hosted-data changes were made.

## Evidence boundaries

- Real browser checks use local synthetic stores, Chromium, Indonesian/English, 320/390/768/1440px widths, and 740×360 / 720×500 short viewports. Existing suites also cover 360px and enlarged text. The 720×500 case represents the CSS viewport at 200% zoom on a 1440×1000 display; it is not a physical-device zoom claim.
- The initial 84-test browser run passed 76 tests. Its eight failures were investigated: two calendar migration issues, two stale test assumptions, three operations tests launched without their required fixture, and the account-menu hydration race. All eight subsequently passed targeted reruns.
- Rare financial/review/staff-invite states use explicitly intercepted synthetic responses. Financial commands are intercepted; these checks cannot move funds. They establish UI behavior, not payment-provider or messaging integration.
- Screenshots: `output/playwright/conditional-ui/confirmation-{width}-{locale}.png` and `photo-{width}.png`. Other existing suites retain their established screenshot locations.
- Final `npm run check` passed: all workspace typechecks, 116 unit tests across 17 files, and the production build. `npm run test:postgres` passed the transaction, concurrency, and tenant-isolation checks.
- The final targeted browser run passed 26 of 28 cases. The two record-disclosure tests initially targeted a hidden support panel without selecting its tab; after correcting that test sequence, both passed (2/2). All 28 targeted cases therefore have passing results, including all 22 new conditional-UI cases. The dedicated operations fixture passed 3/3. No runtime code changed after the final check/build.
- Desktop confirmation and phone confirmation/photo screenshots were visually reviewed. Browser assertions additionally check dimensions, layer ordering, inert parents, focus, retained values and scroll, keyboard dismissal, and accessibility.

## Dialog inventory

There were 16 shared dialog call sites before this work. The schedule picker is the seventeenth after migration. “Passed” below applies to the named scenarios, not every conceivable server response.

| ID / surface | Trigger and audience | States / correction | Browser evidence |
| --- | --- | --- | --- |
| D01 Package editor | Create/manage package; owner | Empty, draft, invalid, uploading, save/reopen; correct editor width, phone layout and scroll | `conditional-ui`, `dishes`, `usability`, `package-presentation` passed |
| D02 Discard package | Close/Escape while dirty; owner | Keep editing, discard, outside click, repeated open/close; compact layer, safe focus, parent retained | `conditional-ui` passed all eight width/locale combinations |
| D03 Prepaid import | Import prepaid subscriptions; owner | Empty/loading/error options, edit, rejected preview, review, commit; editor sizing and pending guard | `usability` phone preview/edit/failure/commit passed; empty-option branches source-reviewed |
| D04 Dish library | Library button or empty menu slot; seller/customer | Search, empty category, add/edit, choose, archive; large scrollable editor, no duplicate heading | `slot-menus`, `dishes`, `customer-choice`, `seller-operational-controls` passed |
| D05 Leave menu | Switch date/package while dirty | Incomplete/complete, save/discard/keep; compact confirmation, safe focus, disabled pending actions | `slot-menus` passed |
| D06 Replace dated menus | Save over existing dates | Confirm/cancel, conflict and retained draft; compact confirmation and explicit cancel | `slot-menus` passed |
| D07 Replace slot dish | Assign onto filled slot | Confirm/cancel; compact confirmation and explicit cancel | `slot-menus` passed |
| D08 Caterer chooses | Reset customer selections | Confirm/cancel, pending and failed reset; confirmation stays open on failure, visible error | `customer-choice` reset passed; failed-reset branch source-reviewed |
| D09 Upload photo preview | Thumbnail; seller | Nested preview, broken image, retry, Escape; parent scroll/focus preserved | `conditional-ui` desktop/phone passed |
| D10 Dish gallery viewer | Dish photo; public/customer | Image/no image/broken image, long text; media size and accessible close | `package-presentation` passed |
| D11 Review form | Write a review after delivery; customer | Rating dropdowns, draft text, close; generic description removed | `conditional-ui` desktop/phone passed with synthetic delivered-response fixture; submission API unchanged |
| D12 Delivery changes | Address/date/skip buttons; customer | Three variants, picker-within-dialog, preview/confirm and unavailable dates | `conditional-ui`, `journeys` passed |
| D13 Saved addresses | Add/edit address; customer | New/existing fields, area select, validation and close; form sizing and pending guard | `conditional-ui`, `journeys` passed |
| D14 Support request | Request help/deep link; customer | Related package, request type, text, submit and close | `conditional-ui`, `journeys` passed |
| D15 Business navigation | “Lainnya”; seller on phone | Open/close and navigation links; shared layering | `usability`, `journeys` phone navigation passed |
| D16 Promotion form | Create promotion; admin | Invalid/pending/rejected input; close blocked while pending, draft retained after error | `conditional-ui` desktop/phone passed |
| D17 Schedule date picker | Calendar month button; customer | Keyboard day/month/year movement, typed date, narrow targets, Escape | `calendar` passed after migration |

## Other conditional surfaces

| Surface / trigger | Audience | Review or correction | Evidence |
| --- | --- | --- | --- |
| Date fields / calendar button | Customer/seller | Shared Radix popover, collision/height limits, owning modal focus | `conditional-ui`, `calendar`, `journeys`, `seller-operational-controls` passed |
| Time field / clock button → hour/minute dropdown | Seller | Removed native/manual popover mix; innermost Escape, cancel keeps value | `conditional-ui`, `seller-operational-controls` passed |
| Select menus throughout app | All | Portaled menus inherit owner layer; pending forms disable selection | All browser suites exercise these; nested picker checks passed |
| Account / workspace menu | Signed-in users | Hydration gate, keyboard exit, pending dismissal protection and height limit | `workspace-role` desktop/phone passed |
| Additional discovery filters | Public/customer | Expanded state and region relationship; values survive collapse | `conditional-ui` desktop/phone passed |
| Comparison tray and meal tabs | Public/customer | Existing conditional rendering and responsive behavior retained | `guest-auth`, `navigation-controls`, `package-presentation`, `usability` passed |
| Nutrition, quantity discounts, trial fields | Owner | Stateful disclosures; invalid fields revealed; existing business validation retained | `conditional-ui` invalid nutrition test, `dishes`, `usability` passed; tier/trial error branches source-reviewed |
| Checkout promo disclosure / quote review | Customer | Values stay mounted; shared submission guards | `journeys` checkout passed; promo-specific rejection source-reviewed |
| Delivery address/rules and package contents | Customer | Existing inline disclosures retained; keyboard focus styling | `usability`, `contents`, `journeys` passed |
| Category creation | Seller | Mounted collapsed draft, trigger relationship, input focus, busy protection | `slot-menus`, `contents` passed |
| Library groups, search, archive and edit form | Seller/customer | Existing groups retained; modal scroll body and focus clearance | `slot-menus`, `dishes`, `seller-operational-controls` passed |
| Customer-choice package library and selections | Owner/customer | Existing copied-option states retained; shared confirmations repaired | `customer-choice`, `slot-menus` passed |
| Photo picker / upload feedback | Seller | Existing file validation and retained-photo failure behavior retained; preview retry added | `dishes`, `conditional-ui` passed |
| Operational filters and selected-order bulk actions | Seller | Existing eligibility/selection rules preserved; shared controls | Dedicated `seller-operations` fixture: all three tests passed |
| Order details panel | Seller | Existing inline panel/focus return retained | `seller-operations`, `usability` desktop/phone passed |
| Production/manifest disclosure and export result | Seller | Existing inline workflow retained | `seller-operations`, `contents`, `customer-choice` passed |
| Customer, purchase and support identifiers | Seller/admin | Kept inline; visible keyboard focus and wrapping | `conditional-ui` explicit record-opening checks; other routes covered by `journeys` |
| Selected support response/decision forms | Seller/admin | Shared submit guard; existing financial authorization preserved | `journeys` route checks; response/decision-specific rejection branches source-reviewed |
| Refund/payout reconciliation | Admin | Grouped expanded forms, pending guards and retained failure input | `conditional-ui` desktop/phone synthetic response fixtures passed |
| Audit record details | Admin | Kept inline, visible summary focus | `conditional-ui` desktop/phone expand checks passed |
| Staff invite result / onboarding invite code | Owner/prospective staff | Existing result retained; shared submit guards, disclosure retains input | `conditional-ui` desktop/phone; staff code response mocked and acceptance not submitted |
| Alternate phone sign-in / code-sent state | Public | Source-reviewed conditional form and feedback; shared submit guard applies | Email/guest flows passed; live SMS delivery/code exchange not exercised |
| Legacy standalone `DishLibrary` export | No active web caller found | Source-reviewed; active library is `MenuLibrary` | No standalone route added solely for testing |

## Remaining boundaries

No known failing browser regression remains after the recorded corrections. Source-only branches above are explicitly not claimed as browser-tested. Real SMS/SMTP, payment-provider reconciliation, hosted uploads, physical-device keyboards, Safari/Firefox, and real-user learnability remain outside this local Chromium evidence. The repairs introduce no database migration or native UI change.

## Reproduction

Start a separate local server with `CATERA_V1_DEMO=true`, a new `CATERA_DEMO_DATA_DIR`, `CATERA_NEXT_DIST_DIR`, and matching `CATERA_PUBLIC_URL`. Point `CATERA_USABILITY_URL` to it and run `npx playwright test --config tests/usability.playwright.config.ts`. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if the installed Playwright headless-shell revision is unavailable.

The three `seller-operations` tests require their dedicated fixture: run `node --import tsx tests/fixtures/seller-operations.mts` against a **new synthetic directory ending in `seller-operations-test` before starting its server**, then use `CATERA_OPS_TEST_URL` and `tests/operations.playwright.config.ts`. Do not seed a PGlite directory concurrently with its running server.
