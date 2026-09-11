# Continuous meal coverage calendar

Responsive web customer calendar, September 10, 2026. Expo is deferred.

## Direction contract

THESIS: See the week's lunch and dinner coverage without opening every date; browsing never moves selection.
OWN-WORLD: Existing forest, cream, sunrise, Jakarta typography and food imagery. Indonesian first.
STORY: Scan coverage, select a day, inspect meals, open the existing delivery detail.
FIRST VIEWPORT: Compact month and today/next-delivery controls, continuous labeled date strip, selected-week coverage summary and meal details in one aligned column.
FORM: User-approved continuous coverage strip, code-first extension of the delivery-cycle direction. No new visual world or generated artwork.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Behavior and data

- Date cells form a bounded 151-day moving window. Appending/prepending preserves the first visible date and pixel offset. Clicking a date never scrolls the strip; explicit jumps do.
- Today is Asia/Jakarta. The summary covers Monday–Sunday containing the selection. Each meal contributes at most one covered day; portions, multiple caterers and combined offers do not inflate totals. Delivered meals count; cancelled meals do not.
- Ready days expose one of four coverage states: none, lunch, dinner or both. Covered days use the scheduled background; selection adds a forest ring without replacing coverage, and today retains its Sunrise marker. Sunrise sun and forest moon icons are the sole visual coverage cue, with the active package count beside them. Each date button's complete ARIA description preserves the explicit meal meaning without relying on color. Cancelled-only days read “Belum ada makan” without a count; loading and error use one neutral message each.
- The day view retains cancelled entries. The upcoming view starts today, groups date then meal, omits delivered/cancelled fulfillments, and offers another month until the metadata's final upcoming day.
- Month responses are cached per mounted customer/revision store, deduplicated and prefetched around the visible range. Selected-week and agenda months remain available. Failed/unknown data is not represented as unbooked. Revisions create a fresh store, preventing old requests from overwriting refreshed data.
- Session storage preserves only date navigation state, scoped by customer ID. No delivery/customer records are persisted there.
- `GET /api/v1/customer?from=YYYY-MM-DD&to=YYYY-MM-DD&calendarMeta=true` adds `calendarMeta: {nextDeliveryDate: string|null, lastUpcomingDeliveryDate: string|null}`. Metadata ignores the requested range, uses Jakarta today, and filters by the authenticated customer. Omitting the flag preserves the existing response.

## Release

Apply `20260910160000_calendar_metadata.sql` after the reusable-dishes migration and before deploying the web calendar. It replaces only the read RPC, preserving existing grants and customer authorization; no bookings, entitlements or snapshots change. The explicit local demo applies the same migration. Hosted deployment is a separate step.

## Verification

Local verification, September 10, 2026:

- `npm run typecheck`: passed for web, Expo and shared TypeScript.
- `npm test`: 77 tests across 11 files passed, including 10 calendar/date/cache/metadata tests covering all meal states and active-package counting.
- `npm run build`: production build passed after the picker accessibility fixes.
- `npm run test:postgres`: all seven concurrency/RLS scenarios passed with the calendar migration applied. Evidence: `output/verification/postgres.json`.
- `playwright.calendar.config.ts`: all 10 calendar/customer/API journeys passed, including palette-aligned day-card icons/counts, cancelled/loading/error states, fixed-width scroll recycling and picker keyboard/mobile-entry coverage. Installed Chrome was used via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
- Browser checks include stable selection and pixel anchoring, leap-day/date jumps, return from delivery details, delayed out-of-order months, failed-request recovery, chronological meal statuses, Indonesian/English, and desktop/mobile/picker axe checks. The 320px picker regression verifies all date targets are at least 44×44px.
- Screenshots: `output/meal-calendar/calendar-1440.png`, `calendar-390.png`, `calendar-states-1440.png`, `calendar-states-390.png`, `picker-1440.png`, `picker-390.png`, and `picker-320.png`.
- Independent finish review: initial `fix` for date-picker Tab order and numeric keyboard separators. Both were corrected; the scoped follow-up returned `ship` for those two fixes. The static detector reported 15 advisory type/radius scale differences, no blocking findings.

The local preview runs at `http://127.0.0.1:3112/calendar` with explicitly synthetic, separate demo storage. It is not a hosted release or a physical-phone/native test.
