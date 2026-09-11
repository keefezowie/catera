# Reusable dishes and package editor

September 10, 2026. Implemented locally against explicit synthetic fixtures; this is not a hosted release.

## Seller behavior

- `/seller/dishes` provides the caterer-owned library, search, create/edit and archive/restore. Package and dated-menu slots allow direct entry or selection from the library. Saving a package-only dish to the library is optional.
- Selection copies name, description, image and default serving into the slot, retaining its own ID and recording `sourceDishId`, `sourceDishVersion` and `sourceServing`. Edits in a package do not update the library. “Gunakan versi terbaru” explicitly refreshes values, retaining a serving override unless the seller opts to reset it. Meal nutrition clears for dish/serving changes and explicit refreshes, but survives reordering and photo-only changes.
- Nasi box components contain their own counts and dish editors. Reordering retains IDs; reduced slots can be restored within the editor. Switching package type retains each type's in-progress contents during the current editor session.
- Photos share upload/progress/confirmation/preview/replace/remove controls. URLs stay internal, failed replacements retain the previous image, and active uploads block advancement and saving. Removing a reference does not delete media used elsewhere.
- Named wizard steps share validation for forward buttons, direct step clicks and keyboard submission. Errors appear inline and receive focus. “Simpan draf” accepts incomplete work while validating supplied values; publication validates the complete offering.
- Review uses the same `PackageCard` and `PackagePage` rendering as customers, with current unsaved values. Preview purchase/comparison actions are inert. Existing review data stays factual; new packages show the normal new-listing state.

## API and storage

Forward migration `20260910130548_reusable_dishes.sql` introduces private, RLS-enabled `v1.dishes`. Reads use the authenticated seller response (`SellerState.dishes`). Owner-authorized `dish.save` and `dish.archive` use the existing idempotency receipt and audit transaction. API schemas and SQL independently enforce field types, limits, ownership and optimistic versions. Archive/restore increments the version. Clients receive no direct table-write grants.

Library values are defaults; embedded contents and immutable package revisions remain authoritative. Source references must belong to the same caterer. Archived sources cannot be newly attached, while existing packages or dated templates retain their original references. Library mutations never rewrite package, checkout, subscription or production snapshots.

`scripts/compile-dishes-migration.mjs` generates the migration from the preceding frozen contents migration and `dishes.sql`, `dishes-command.sql`, and `offer-validation.sql`. The main migration generator includes it. Demo startup applies it once after the contents migration; PostgreSQL tests apply the same migration. Existing embedded dishes stay package-only, with no automatic deduplication or classification. Legacy optional trial limits retain their semantics. No seeds or snapshot rewrites occur in the migration.

## Verification

- Typecheck, production web build and the repository test suite pass (64 tests at verification). Build output was isolated in `.next-dishes-build` to avoid interfering with the demo.
- Domain/database tests cover copying, serving overrides, explicit refresh, stale writes, tenant authorization, invalid direct RPC inputs, archived sources, incomplete drafts, whole portions, and populated synthetic upgrades. Historical purchase and pending-checkout JSON is compared before/after upgrade.
- Real PostgreSQL checks cover purchase/payment/reschedule contention, package-edit/checkout races, dated-menu locking, and library-edit contention: `output/reusable-dishes/postgres.json`.
- Six browser journeys under `playwright.dishes.config.ts` cover existing purchase/production flows, direct-step/keyboard validation, drafts, component entry, reuse, explicit refresh, archiving, upload failures and preview parity. Serious/critical axe checks pass for the editor.
- Phone (390), tablet (768) and desktop (1440) screenshots were inspected. The correction pass removed empty-draft image warnings. Evidence: `output/reusable-dishes/contents-*.png` and `review-*.png`.
- Both native consumer suites pass: 26 tests each for iOS and Android. Consumers continue rendering embedded snapshots and do not access the seller library.

Repeat browser checks with `npx playwright test --config playwright.dishes.config.ts`; on this Windows workspace, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the installed Chrome executable. The configuration uses isolated synthetic storage and localhost port 3102.

Physical-device checks and hosted migration/storage verification remain separate release gates. Apply the forward migration before deploying this web editor through the separate V1 workflow in RUNBOOK.md. The hosted pilot remains untouched.
