# Slot packages and the menu calendar — ID 0003

Source: https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789132010623699

Both package types use category counts; dishes and optional nutrition belong to dated menus. Publication and checkout do not require a dated menu. The web and Expo renderers share the pending-menu label and composition formatting. The September 11 visual follow-up replaces the daily dish-entry form with one package assembly card, and converts explicit synthetic demo records to that model.

## Interfaces and storage

- A `MealMenu` marked `contentModel: "slots"` is a package template when its `items` array is empty and nutrition is null. Its `composition` contains stable group IDs, `categoryId`, category display name and slot count. Both package types use the same model; legacy records omit the marker.
- `v1.dish_categories` stores six global defaults plus tenant-owned custom categories. `category.save` creates a category, checking staff ownership and duplicate names inside the command transaction. Dishes without a category remain readable but cannot be newly assigned to categorized slots.
- `GET /api/v1/menu-month?packageId=…&revision=…&month=YYYY-MM-01&meal=lunch|dinner` returns month dates, versions, saved details and editability plus categories. This resource requires membership in the package's caterer.
- `menu.saveBatch` accepts `catererId`, `packageId`, `contentRevision`, `meal`, shared `details`, and `dates: [{date, version}]`. At most 31 distinct dates in one month are accepted. Every slot must be filled with a matching category. Locking, authorization, optimistic version checks, notifications, audit and idempotency remain within one command transaction; any conflict rolls back all dates.
- `menu.save` remains compatible with old callers and shares the date-save implementation. Past dates and delivered meals are read-only. Purchases continue resolving menus against their own immutable content revision.

## Interaction

The desktop workspace selects a package/revision and meal, then displays its month beside an accordion library. Single-date click or the multi-date “Atur menu” action expands the calendar into a package card in place, with a 280 ms height transition and a short content fade. The library stays in its column. Reduced motion skips these animations. Different existing menus start a blank replacement; saved dates are listed before overwrite. Returning keeps month and selection. Unsaved changes have save/discard/continue choices; network errors retain the draft.

Large slot targets follow the composition's order and counts, with category/position labels retained after insertion. Clicking anywhere in a slot immediately filters the library to matching active dishes. Changing category clears search. Dragging the dish photo or grip shows a dish preview and compatible targets; wrong-category drops leave the draft untouched. Successful assignment activates the next empty slot, wrapping around. Occupied slots require explicit replacement confirmation; removal is explicit. Keyboard insertion and the phone tap picker use the same assignment path, with focus returned to the active slot.

Dish name, description, image and serving size come from the library; no per-dish text fields appear in the assembly card. Optional daily nutrition appears directly below the slots using the same Flame, Dumbbell, Wheat and Droplet icons as the package preview. Changing dishes clears the estimates with an explanation; blank remains unknown and zero remains valid. Save stays disabled until all dish slots are filled. `/seller/dishes` redirects to `/seller/menus?library=1`.

## Migration and release

`20260911134456_slot_menu_calendar.sql` is generated from `packages/backend/src/slot-menus.sql` and the prior command/read definitions by `scripts/compile-slot-menu-migration.mjs`. Regeneration requires the existing CLI-created migration file. The migration adds schema and functions without rewriting any listing, purchase, checkout or frozen production row. It preserves the recurring-capacity command wrapper when that migration is already installed.

PGlite explicitly installs the additive migration at startup. `demo-slot-upgrade.sql` then runs in one transaction inside the synthetic database constructor. It requires explicit demo context, an approved synthetic policy and known demo identity markers. Temporary conversion functions populate shared category IDs, categorized library dishes, dated recipes for existing deliveries, and normalized synthetic package/revision/checkout/subscription/production records. Immutable-history triggers are restored before commit. Re-running conversion or the catalog refresh leaves normalized data unchanged. This is an authorized demo-only exception to historical immutability, not a hosted migration or live-data backfill.

The operator baseline generator includes the same guarded conversion and is versioned `2026.09.11.2`. Its output was restored twice into disposable PostgreSQL with matching manifest hashes; it was not applied to hosted Supabase. The current local demo on port 3000 was restarted and verified: 14/14 catalog packages and 19/19 selectable seller revisions use slots. Test browser fixtures use separate local storage. Hosted release remains governed by RUNBOOK.md.

## Verification

Tests: `tests/slot-menus.test.ts`, `tests/e2e/slot-menus.spec.ts`, and `tests/postgres-slot-menus.mjs` (called by the PostgreSQL suite), alongside the existing legacy contents/library and customer presentation coverage.

Local screenshots and database evidence are under `output/slack-bugs/0003/`. Verification results are recorded after the final checks in the bug tracker and implementation log. Responsive web screenshots and native export/type checks do not establish physical-device certification.

Visual follow-up verification: 96 unit tests, 17 related browser scenarios in one combined run, ten PostgreSQL concurrency/security scenarios (including repeatable demo conversion), web/Expo typecheck, production build, and Android/iOS exports. Browser tests use real pointer movement for drag/drop, including dragging the dish photograph, repeated slots and wraparound, replacement cancellation, nutrition invalidation, keyboard insertion, phone focus restoration, reduced motion, pending-menu purchase, historical rendering and frozen production output. The Impeccable detector reported no findings. Desktop/phone captures include `visual-card-desktop.png`, `visual-card-phone.png`, `editor-desktop.png` and `editor-phone.png`; SQL evidence is `postgres-visual.json`. Exports are not physical-device certification. No full unrelated E2E-suite pass is claimed.
