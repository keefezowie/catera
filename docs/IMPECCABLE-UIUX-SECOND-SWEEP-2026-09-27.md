# Catera UI/UX follow-up: internal layout collisions

Date: 27 September 2026. Baseline: `d4c3dab725c46657f9ec4cd9d04050d7792a1495`, the version confirmed on live v1 when this follow-up began.

## Why the previous sweep missed the screenshot

The seller scope bar put six fields into fixed grid tracks. The meal buttons could grow outside their own track and underneath the Package selector. A wide window did not solve this because the operational content has a maximum width. Selecting Dinner added Clear filters and made the collision worse.

The previous route matrix asserted document overflow. That cannot detect two controls colliding inside a page that still fits. Reproduction at 1440–2560px confirmed exactly that failure. At 1181/1280px the same grid also pushed Search and Clear filters beyond the panel. This was a source defect in the released version, not evidence of a stale deployment.

The fresh baseline reproduced collisions in 14 of 28 Schedule combinations: Indonesian and English across 14 widths from 320 to 2560px. At English 2560px, selected Dinner and Package overlapped by 48.06 × 43.59px, and a hit test inside Dinner returned Package.

## Review and scope

Used Impeccable audit, layout, adapt, harden, and polish guidance for the relevant work. Two independent assessments were completed before source edits: a rendered layout assessment and a separate mechanical/geometry assessment. Neither reviewer edited product source. No stored critique snapshot was consumed in this follow-up.

The mechanical baseline covered all 37 routes from the first sweep in both languages at 320, 390, 768, 1024, and 1440px: 370 route visits, plus 52 selected/open/error-state observations and additional seller desktop probes. The independent layout review captured 137 route/viewport combinations, open dialogs, keyboard samples, loading failure, empty results, long unsaved text, and explicit 200% text enlargement.

The route inventory includes public discovery/authentication/package/caterer pages, customer home/calendar/subscriptions/messages/account/addresses/support/notifications/checkout/onboarding, all ten owner routes, and all nine platform-admin routes. Additional independent visits included subscription detail, delivery detail, and renewal.

## Repairs

| Surface | Repair and acceptance criterion |
|---|---|
| Seller Today and Schedule | Date and meal form the primary row; package, status, search, and reset form a wrapping secondary row. The layout responds to available content width. Meal labels and counts can wrap. Every control must stay inside its panel with its own reachable hit area. |
| Customer and seller calendar strips | Coverage labels and package/order counts wrap within their own date cells as text grows. Horizontal date scrolling remains available. |
| Seller menu calendar | In narrow containers, the lock sits beneath its date. Cells grow to contain the heading and dish count. The read-only indicator stays inside its date button. |
| Customer home | The photograph fills its region without making the card inherit its intrinsic 4:3 height. At 1440px the default next-meal card measures 262px instead of about 463px, bringing the agenda closer. |
| Enlarged phone text | The agenda heading/action and workload labels/counts wrap within their own containers. Customer and seller navigation labels stay inside their destinations. |
| Fixed phone controls | Navigation and purchase-summary height is measured so page content and footer links can scroll clear of both bars. The menu save bar follows the actual navigation height. |
| Admin navigation dialog | The heading reserves room for the 44px close control, keeping it separate from the first navigation link. |
| Seller customer filters/search | The same control subtree remains mounted during loading and errors. Keyboard focus survives slow requests, failed follow-up filters, recovery, and search. Previous records still clear immediately when the query changes. |

The spatial order remains date → meal → optional filters → workload/orders. Dense operational controls keep predictable order; supporting filters move to another row before content collides. Customer home retains its food photograph and next-meal action. No business logic, authorization, purchase, payment, storage, or provider configuration changed.

## Verification

The durable layout suite checks sibling rectangles, text ranges, five interior hit points per meal button, selected/hover contrast, pointer selection, roving keyboard focus, open date/package/status controls, Escape focus return, and retained filter values. Stress cases use 200% text, a long package name, and five-digit meal counts. Additional tests cover calendar text containment, narrow lock containment, image sizing, enlarged phone navigation, end-of-page access beneath fixed bars, and focus during delayed or failed customer requests.

| Final check | Result |
|---|---|
| New layout/focus suite | **54 passed**, zero failed/skipped/flaky, across four files. |
| Existing affected journeys and interaction states | **25 passed**, zero failed/skipped/flaky, including seller filters, customer home, purchase overlap recovery, and admin menu keyboard behavior. |
| Authentication/recovery UI | **7 passed** with intercepted synthetic responses against a separate unused loopback Auth endpoint. |
| Root type checking | Passed, including web, workspace types, and tests. |
| Unit/integration tests | **280 passed across 45 files.** |
| Production build | Passed after all functional source changes. |
| PostgreSQL transactional/concurrency checks | **27 passed.** |
| Screenshot reproduction | All 28 width/language combinations passed after the structural filter repair. |
| Independent seller confirmation | **80 states passed** across Today/Schedule, ID/EN, 1180/1181/1280/1920/2560px, including selected/hover and open controls. |

The final two browser suites provide **79 checks after all functional changes**. Together with the seven authentication checks, this follow-up has 86 distinct passing automated browser tests; repeated runs and route-observation counts are not added to that total. Final results: `regression/release-final.json`, `functional-final-results.json`, and `auth-results.json`.

An earlier existing-test run had 24 passes and one customer-focus failure. That failure drove the stable-control repair and the delayed-response tests; the entire 25-test selection then passed. A PostgreSQL repeat completed its assertions but failed writing the historical evidence file with a Windows file-open error. The unchanged suite was rerun with its supported task-specific evidence path and completed successfully; `postgres-final.json` contains all 27 checks. No assertion was weakened.

The two local app servers were stopped after verification. Task-generated Next.js configuration and the historical PostgreSQL report were restored before staging. The primary checkout's pre-existing changes were preserved. Only source, four new test files, their configuration, and this report belong to the release; screenshots and session output remain local.

## Detector interpretation and evidence

The baseline layout detector reported zero findings while the rendered collisions were present. The full detector reported 296 advisories (64 color, 199 type-size, 33 radius), with no non-advisory findings. These are not 296 reproduced defects. This follow-up did not alter DESIGN.md or add ignores to remove advisory counts.

The final scan after the last functional source repair also returned zero layout findings and the same 296 advisories, with no non-advisory findings. Files: `layout-final-detector.json` and `full-final-detector.json`.

The post-repair broad census completed 422 observations with no navigation, runtime, locale, or document-width failures. Its deeper checks exposed the small admin close/link overlap, English 320px navigation-label collisions, and footer coverage by the purchase bar. The independent enlarged-text pass also exposed agenda/workload overflow. Those findings were repaired and received focused regressions. An existing functional test exposed customer-filter focus loss; a held-request regression reproduced it before the stable-control repair. Therefore, the broad pass alone is not represented as a clean final result.

Raw geometry candidates were inspected before deciding they were defects. Closed disclosures, clipped accessibility table headings, deliberate selector/message ellipsis, offscreen dates in horizontal strips, fixed navigation, and portal overlays were separated from genuine same-layer collisions.

Local evidence is under `output/playwright/impeccable-second/`: `reproduction/`, `layout-review/REPORT.md`, `geometry-audit/REPORT.md`, their `after/` folders, `regression/`, authentication results, and PostgreSQL results. The earlier sweep remains documented separately.

## Boundaries

Browser evidence uses local Chrome, synthetic data, and emulated CSS viewports. Text enlargement explicitly doubles computed font sizes and pixel line heights; it is not a claim of physical-device or browser-zoom certification. No user study, screen-reader audit, Safari/Firefox acceptance, native-device run, hosted Auth/provider acceptance, or production performance certification is implied. The hosted application's existing payment mode and launch gates remain in force. This sweep covers the stated routes and representative states, not every possible content combination.
