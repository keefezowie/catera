# Customizable package contents

## Discovery cards and dish-photo browsing — September 10, 2026

Web and Expo discovery now separate a concise meal preview from the full contents renderer. Cards emphasize caterer identity and duration, show composition counts (or structured à la carte dish counts), and group the price basis, delivery status, comparison and package navigation. Dish-name search still indexes full menu contents.

Combined lunch/dinner packages expose a local meal-preview switch; price and purchased entitlement never change when switching. Nutrition stays scoped to that menu. Four labeled icon/value positions preserve zero and show unavailable values as an em dash; the group disappears when all estimates are absent. Example/dated context and the per-meal caterer-estimate caption remain explicit.

`PackageContents` adds an opt-in `presentation="gallery"` and `coverImage`; its default rendering remains in checkout, subscriptions, comparison and deliveries. Package details and the seller's matching detail preview use the gallery. Card previews allow meal switching while navigation and comparison are disabled. Native details show the gallery before purchase configuration.

Photo buttons open a named enlarged viewer without cropping, preserving serving information. Web uses the existing Radix dialog with Escape and explicit trigger-focus restoration; native uses Modal with Android Back, close, accessibility focus and cleanup of pending focus work. Missing and failed images preserve dish text. A single dish with the same image as the package cover uses an explicit photo link, avoiding a duplicated large image.

Web contents links target `#isi-paket-lunch` or `#isi-paket-dinner`. Native package routes accept additive `section=contents&meal=lunch|dinner` parameters, scroll after parent/meal layout, and preserve normal navigation for unknown values. No API payloads, schemas, reservations or stored purchase snapshots changed.

Verification fixtures are explicitly synthetic and are installed only for the focused browser suites with `CATERA_V1_FIXTURES=true` (for example, `.data/package-presentation-e2e` on port 3120). They exercise supplied dish photos, missing and broken images, duplicate covers, component groups and package nutrition. The ordinary `npm run dev` catalog uses the six structured offers from the customer demo and does not include these test-only listings. Existing hosted records are not overwritten; no new artwork was generated. Some test photos are existing synthetic meal images used only to exercise image rendering, not newly produced individual-dish assets.

Run `npx playwright test -c playwright.package-presentation.config.ts` for the isolated browser checks; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed browser if needed. The configuration also includes contents, reusable-dish, guest and purchase regression journeys. Focused native tests cover meal switching, viewers, image failure, duplicate photos, contents route parameters and layout-dependent scrolling.

Local acceptance completed: typecheck and production web build passed; 75 Vitest tests passed; iOS and Android each passed 31 component tests; both Expo bundle exports passed; all seven PostgreSQL concurrency scenarios passed. Twelve distinct browser scenarios passed across the focused contents/dishes/gallery suite, guest comparison/login regression, full purchase/reschedule/support/renewal journey and long-content test at 320px with 200% root text size. The guest regression now waits for Account navigation before reloading, avoiding a navigation/reload race in the test itself.

Two bounded browser visual rounds covered desktop, 390px and 320px. The initial round identified an over-wide desktop dish grid; the confirmation captures show the intended two-column desktop/gallery arrangement and narrow-screen collapse. Images, names, amounts, missing-image text, card footers and nutrition are visible without horizontal overflow. Viewer accessibility has no serious/critical axe findings. Screenshots are `output/package-presentation/card-{1440,390,320}.png` and `dishes-{1440,390,320}.png`; `verification.json` summarizes the evidence. Native physical-device visuals and real-device assistive-technology behavior remain unverified. No hosted deployment, database migration, new artwork or signed APK is included.

Follow-up: [reusable dishes and reliable package editing](REUSABLE-DISHES.md) adds optional library reuse, component-first controls, photo previews, guarded steps and customer listing previews without rewriting historical contents.

September 10, 2026. Implements the confirmed caterer-defined package model on seller web, customer web and Expo customer apps. This records local implementation, not a production release.

## Behavior

- À la carte includes one or more dish rows at one price per complete portion/day. Nasi box includes named component groups and positive dish-slot counts. Groups can use familiar presets or custom seller labels. Dish IDs remain stable during edits and reordering; names, descriptions, optional photos and serving descriptions are stored separately.
- Each package has optional calories (kcal), protein, carbohydrates and fat (g) per meal portion. Every metric accepts one fixed value or an inclusive minimum–maximum range. Partial estimates are supported; blank is unavailable and zero is retained. No nutrition calculation or automatic dietary claims are introduced.
- The contents editor follows package basics, before price/schedule/flexibility and review. Its preview uses the same rendering as customer details. Reducing and restoring a component count within the editor restores the removed dish text.
- Dated menus are selected by package, content revision, date and meal. They retain the purchased box composition or à la carte dish count and do not expose nutrition editing.
- Discovery supports package-type filtering and dish-name search. Web/native details, comparison, checkout, subscriptions and deliveries show contents and available estimates. Kitchen groupings and CSV/print include all dishes and serving descriptions, while capacity continues to count whole package portions.

## Database and compatibility

`20260910120930_package_contents.sql` is a forward migration generated by `scripts/compile-contents-migration.mjs`. Its canonical additions are `packages/backend/src/contents.sql` and `contents-command.sql`; the generator extends the frozen V1 service definitions. `scripts/compile-migration.mjs` now refuses historical-source drift instead of overwriting applied history.

`v1.content_revisions` stores immutable templates. Package saves assign revisions transactionally under the package lock; unchanged contents retain their revision. Dated menus use `(package_id, content_revision, service_date, meal)` and optimistic versions. Authorization, idempotency receipts, audit and notifications remain in the same transaction. New business data has RLS and no direct client writes.

Legacy content is revision zero and retains its original data. Display adapters treat each old menu as one unsplit item and never guess its package type or nutrition. Existing purchases, pending quotes and frozen production JSON are not rewritten. Older pending payments can activate after upgrade. Content changes require explicit classification; legacy dated menus remain editable for outstanding purchases.

The local demo upgrades once and does not replay historical service definitions after the contents migration. Its six customer-facing offers are seeded with structured package contents; the three additional examples are explicitly synthetic test fixtures and are only provisioned when `CATERA_V1_FIXTURES=true`. Hosted deployments must apply the forward migration through the separate V1 release process in RUNBOOK.md; never execute demo fixture code remotely.

## Local verification

Typecheck, production web build, both native bundle exports, 3 browser journeys and both native component suites (26 tests each) passed. PostgreSQL concurrency evidence contains all six scenarios. The final aggregate results are recorded in `output/package-contents/verification.json`.

- Shared domain/database suite covers structured validation, direct RPC rejection, combined meals, purchased revisions, immutable snapshots, package nutrition ranges, conflicts, tenant authorization and legacy upgrade/payment activation.
- Real PostgreSQL tests cover existing reservation/payment races plus simultaneous content edits and checkout, and simultaneous dated-menu saves. Evidence: `output/package-contents/postgres.json`. The harness allocates an available loopback port to avoid reserved Windows ports and uses UTF-8.
- iOS and Android component suites cover complete contents, serving sizes, fixed/range package nutrition, unavailable nutrition and English copy.
- Browser journeys are in `tests/e2e/contents.spec.ts`. They cover seller publishing, purchase/payment, dated changes, subscription snapshots, production CSV, nasi box composition, discovery filtering and count restoration. Responsive captures live in `output/package-contents/`; the seller dialog has no serious/critical axe findings.

Run the isolated browser suite with `npx playwright test -c playwright.contents.config.ts`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if using an installed Chrome instead of Playwright's downloaded browser. This config uses port 3100, `.next-contents` and `.data/contents-e2e`, preserving the ordinary demo server's origin and data. Set `CATERA_CAPTURE_CONTENTS=true` only when refreshing visual evidence. Domain/type/build/native commands remain the standard workspace commands.

Hosted migration/RLS verification, signed mobile builds, physical-device screenshots and existing payment/provider release gates remain outstanding. No hosted database, real payment or production deployment was performed for this feature.
