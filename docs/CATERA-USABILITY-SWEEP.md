# Catera web usability sweep

Implementation: 12 September 2026. Audience: owner-operators and staff with limited technical experience. Web only; native work remains paused. All mutation tests use explicit, disposable synthetic data.

## Findings and changes

| Priority | Journey / observed friction | Implemented change |
| --- | --- | --- |
| P0 | Creating a package required six wide step tabs; eight optional nutrition fields preceded progress. | Five steps: Paket, Isi, Harga, Jadwal, Periksa. Optional nutrition is collapsed under Isi; trials/discounts belong to Harga, duration/flexibility to Jadwal. Existing validation paths move with their fields. |
| P0 | Long package forms hid Continue and draft saving, particularly with a tall uploaded photo. | Independently scrolling fields with a persistent Back/Continue/Save draft footer. Phones show the current step and an accessible selector. Closing, Escape, and backdrop clicks protect unsaved edits; uploads and saves block navigation. |
| P0 | Phone order tables pushed quantities, status, selection, and actions off screen. | The same records become cards at 800px and below. Desktop retains tables. Individual next actions use verbs; bulk actions state the result and selected count. Details receive focus, and closing returns focus to their trigger. |
| P0 | Setup was distributed among profile, packages, and verification screens. | Owner readiness checklist derives completion and next action from current profile, package, and review state. Submitted profiles show a waiting message; corrections show the review note. Staff retain their restricted navigation. |
| P1 | Photo editing stacked a large preview, filename, upload instructions, and repeated status text. | Compact thumbnail, Ganti/Hapus controls, one status message, and an on-demand full image preview. Failed replacement keeps the old photo. Discovery labels use removable chips, separate from dish categories. |
| P1 | Seller navigation exposed every destination equally on phones. | Daily and business groups on desktop. Phone navigation: Hari ini, Jadwal, Paket, Menu, Lainnya. Business links in Lainnya preserve role restrictions. Date and meal controls remain together in a sticky operations context bar. |
| P1 | Prepaid importing required UUIDs and JSON. | Owner-only customer, package, and address choices; ordinary quantity, date, remaining-days, and payment-reference fields. Review shows names, addresses, portions, actual service dates, and payment references. Edits survive review and errors. |
| P1 | Menu selection foregrounded revision terminology. | Package names are prominent; contents numbers appear only when needed to distinguish multiple versions of one package. Visual slots, photos, keyboard picking, and replacement confirmations remain. A save bar keeps selected dates, meal period, completion, and saving together. |
| P1 | Seller conversations and support formed two stacked workspaces. | Keyboard-accessible Pesan/Bantuan tabs with conversation and open-case counts. Tab changes preserve mounted workspace state. Seller conversations show the customer's name. |
| P1 | Comparison controls followed customers into account and transaction tasks. | Floating comparison controls appear only on shopping routes. Selections persist through checkout, account, messages, and delivery routes. |
| P1 | Delivery details linked to themselves and hid useful actions below package contents. | Compact status/date/time/address summary followed by eligible actions. Detailed rules and package contents remain available in disclosures. |
| P1 | Checkout exposed optional promotion entry throughout. | Promo entry is collapsed until requested, while existing checkout draft restoration, totals, rule review, and commitment controls remain. |
| P2 | Routine management exposed IDs and technical metadata. | Customer source labels are readable; account and purchase IDs are disclosed on request. Transactions gain authorized customer names. Admin audit and payout reads gain display names; audit action labels are readable and preserve raw metadata in details. Transaction, refund, and audit tables become phone records. Profile, verification, and staff settings are separate groups. |
| P2 | Controls varied in readability and target size. | Shared 16px form inputs, 14px essential labels, and 44px action targets. Important actions pair Lucide icons with visible labels. Error feedback focuses an affected field or the error message. |

The production section is “Daftar dapur & pengantaran.” Its whole-day scope, saved revision, print, and CSV controls remain explicit. This is a saved operational snapshot, not live courier dispatch.

## Screen coverage

Source review and browser checks cover the package editor and lifecycle, Today, order schedule, kitchen/delivery lists, menu calendar and dish library, customer relationships/imports, seller messages/support, settings, transactions/payouts, public discovery and package contents, comparison, authentication return paths, checkout, payment, customer calendar and delivery details, account/address entry, and admin verification, transactions, support/refunds, payouts, promotions, reviews, and audit.

The approved palette, artwork, food photography, Indonesian default, guest discovery, complete-portion pricing, package immutability, purchased snapshots, and existing payment/entitlement rules are retained.

## Data and authorization

Migration: `supabase/migrations/20260912100853_usability_read_options.sql`.

- `seller-import-options` requires the owning seller. It returns only customers with an existing relationship to that caterer, those customers' addresses, and that caterer's currently published packages while the caterer is approved. Delivery areas come from the caterer record.
- No global account lookup, email search, or cross-tenant address directory was added. Missing relationships, addresses, or eligible packages have explicit prerequisite messages.
- Existing read authorization executes before transaction/admin name enrichment. Legacy wrapper execution is revoked.
- `import.preview` and `import.commit` remain unchanged: maximum 100 rows, payment attestation, capacity/cutoff/overlap checks, duplicate-commit rejection, and atomic entitlement creation. No new payment is collected.
- Package payloads and purchased snapshots retain their existing shape. The native app's contracts remain compatible.
- The migration has been exercised against disposable PGlite and PostgreSQL, not applied to a hosted database. Apply and verify it before deploying the dependent web UI under the existing release gates.

## Verification

Automated evidence is local Chromium, using installed Chrome. The primary synthetic instance is on port 3118, with a separate seller operations fixture on port 3120.

Completed checks:

- Root typecheck, unit suite (106 tests), production build, and PostgreSQL concurrency suite.
- Package step guards, incomplete draft creation, persisted draft resumption, publication, custom category/slot composition, pending uploads, failed replacement preservation, and successful upload.
- Menu batch creation, drag/drop, keyboard navigation, phone library picking, cancelled replacement, stale revision recovery, and atomic date replacement.
- Order quantities, statuses, primary actions, selection, detail focus, and no horizontal scrolling at 360, 390, 768, and 1440 CSS pixels, in both Indonesian and English.
- Axe audits of the wizard and order surfaces at all eight viewport/language combinations; additional accessibility checks in existing journey tests.
- Zoom-equivalent reflow: a 720 × 500 CSS viewport representing 200% desktop browser zoom on a 1440 × 1000 display. Draft values and the footer remain reachable. This is viewport emulation, not a physical-device test.
- Prepaid picker/preview/edit/commit flow on a 390px phone viewport.
- Staff/customer/anonymous and cross-tenant read denial, relationship scoping, address ownership, package eligibility, and protected admin enrichment.
- Bulk delivery conflict recovery, selected-count retention, independent lunch/dinner updates, whole-day export despite filters, keyboard date/meal control behavior, and phone detail access.
- PostgreSQL purchase-capacity races, duplicate payment confirmation, reschedule races, immutable purchased content, concurrent menu edits, atomic bulk statuses, and package archival/payment races.

Browser checks found and corrected a shrinking Details target, an empty selection header, a missing delivery-area join, and old test selectors for renamed steps/menu options. These were fixed without relaxing the corresponding business assertions.

Final verification completed successfully:

| Check | Result |
| --- | --- |
| Root typecheck | Pass; web, existing native types, and root TypeScript |
| Unit tests | 106 passed across 16 files |
| Production build | Pass; isolated build output |
| PostgreSQL concurrency | Pass; all migrations applied in a disposable PostgreSQL database |
| Focused browser checks | 48 distinct tests passed across 10 files, combined successful runs |
| Final usability regression run | 15/15 passed: four sizes × two languages, draft reflow, importer error/edit/commit, messages/comparison, readiness/admin approval, and existing operational control checks |
| Customer and admin journeys | Purchase, rescheduling, support, renewal, route coverage, auth boundaries, and navigation pass |
| Real caterer study | Not yet performed; protocol below |

The final browser run corrected preview centering and verified the verification-correction → seller-submission → admin-approval journey. Import error recovery uses a simulated capacity response for the UI assertion; real capacity and atomic commitment remain covered by database tests. There was no production deployment.

Repeat the focused browser tests with installed Chrome using `tests/usability.playwright.config.ts`. `CATERA_USABILITY_URL` selects the synthetic web instance; `CATERA_OPS_TEST_URL` selects the separately seeded operations instance; `CATERA_EVIDENCE_RUN` gives each invocation a separate evidence directory. Seed `tests/fixtures/seller-operations.mts` only into its guarded disposable storage before testing status transitions. Do not point these mutation tests at hosted environments.

## Visual evidence

Images are synthetic examples, not real customer or caterer records. Paths are relative to the repository.

- Original reference: `output/usability-overhaul/before-package.png`.
- Contents step: `output/usability-overhaul/contents-390-id.png` and `contents-1440-en.png`.
- Order details: `output/usability-overhaul/order-360-id.png`, `order-390-en.png`, `order-768-id.png`, and `order-1440-en.png`.
- Draft reflow: `output/usability-overhaul/wizard-200-percent.png`.
- Readable import review: `output/usability-overhaul/import-390.png`.
- Playwright reports and traces: `output/usability-overhaul/*-report/`.

## Five-caterer learnability study — still required

Automated checks establish behavior and accessibility, not learnability. No representative participants have been recruited or observed for this implementation. Do not treat synthetic browser runs as participant completions.

Recruit five caterers who handle their own order/menu coordination, including people who mainly use WhatsApp and have limited experience with business software. Use realistic synthetic profiles and orders, and include their usual phone plus desktop where relevant.

Give each person these tasks without naming controls:

1. Complete setup, create a package draft, leave and return to it, and request verification.
2. Plan lunch and dinner menus for two dates using familiar dishes.
3. Find today's quantities and address, begin preparation, update several deliveries, and obtain the kitchen/delivery list.

For each task record elapsed time, independent completion, assistance, wrong turns, mistaken selections, uncertainty at commitment, and recovery after a mistake. Ask participants to explain what they expect each primary action to do. Never use real payments or customer data.

| Participant | Setup: independent / assistance / mistakes | Menu planning: independent / assistance / mistakes | Delivery work: independent / assistance / mistakes |
| --- | --- | --- | --- |
| 1 | Not observed | Not observed | Not observed |
| 2 | Not observed | Not observed | Not observed |
| 3 | Not observed | Not observed | Not observed |
| 4 | Not observed | Not observed | Not observed |
| 5 | Not observed | Not observed | Not observed |

Acceptance target: at least four of five people complete each task independently. Revise any repeated hesitation, navigation miss, or mistaken commitment and retest that task. Hosted deployment, production credentials, and physical-device confirmation remain separate gates in `docs/RUNBOOK.md`.
