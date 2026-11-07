# Address pin: handoff (2026-11-07)

Branch `v2`. Nothing here is committed, pushed or applied to the hosted database. It sits in the working tree on top of the uncommitted whole-app audit (see `2026-11-07-whole-app-audit-handoff.md`), and both touch `AddressForm`, `BuyScreen`, `customer.tsx`, `purchase.tsx` and the domain package.

Canvas: https://claude.ai/artifact/QHA8NUcoa57uefqzwiBSzn (the owner chose to review it alongside the build, not before it).

## What it does

- Customers mark a pin (GPS, search or dragging) and type the address themselves. Only the coordinates are kept from the map.
- A pin picks the area chip. A chip that disagrees holds the save. Checked free against OpenStreetMap boundaries in `packages/domain/src/area-bounds.ts`, with a 1.5 km margin at borders.
- Driver links (stop, route and WhatsApp text) use the coordinates, through `mapsUrl` in `packages/domain/src/kitchen.ts`. Deliveries with no pin keep the text link, and Dapur marks those stops once any stop on the run has a pin.
- Saved addresses without a pin are asked for one at the next purchase, in the app and on web. Running deliveries are untouched.

## Rulings made

- No maps key means no pin anywhere: the form behaves as it did. So this can deploy before Google Cloud is set up.
- Coordinates are optional in the database and at checkout, so older app builds keep working. A save without a pin leaves the stored one.
- The importer's list of a kitchen's customers answers without pins. Pins reach a kitchen only through deliveries the customer ordered from it.
- The pin is forest, not the canvas's first sunrise: `tests/native-theme-guard.test.ts` reserves sunrise for "on the way".
- A zoom-in guard (from talabat's pattern) was added beyond the first canvas: a pin can't be used zoomed out.

## Trap: the release build crashes without the keep rule

`react-native-maps` depends on WorkManager with Room 2.5. R8 full mode strips the database constructor, and the release app crashes on launch (`Failed to create an instance of class androidx.work.impl.WorkDatabase`). Debug and Jest don't show it. The fix is the `expo-build-properties` rule in `apps/customer/app.config.ts`. Keep it until Room is 2.6 or newer.

## Deploy order

See `docs/RUNBOOK.md` section 18. Apply the audit migration first, then `20261107120000_address_pin.sql`.

## Open for the owner

- Google Cloud billing account, three keys and quotas (RUNBOOK 18).
- Privacy text must name precise location; the terms page is still a placeholder.
- Read Google's terms on storing coordinates. Catera stores the point the customer confirmed on the map, not a geocoding result, but this wasn't checked against the terms.
- "Bandung" means Kota Bandung plus the margin, so Kabupaten Bandung customers are outside. Say if that's wrong.
- `/api/places` has no rate limit of its own beyond sign-in; the Google quota is the cap.

## Not verified

- A real map with a real key, on any device: no key exists yet. Search against the live Places API has only run against a mocked Google.
- iOS: no Mac here.
- The web map's drag and "my location": the placeholder key shows Google's error panel, so only layout and the save refusal ran in a browser.
