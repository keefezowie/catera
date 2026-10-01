# Saved packages and swipe discovery

October 2, 2026. This implements the approved [Saved and discovery brief](SAVED-DISCOVERY-BRIEF.md) within the existing [product](../PRODUCT.md) and [design system](../DESIGN.md). Saved comes first; a cart remains deferred. Web acceptance precedes native release.

The work is isolated on `codex/saved-swipe`, based on `b4a6380bfc31af71d49b9782ae353395d0999675`. The original `D:/Project/Catera/catera` checkout on `v1` was preserved as found. All evidence below is local. This record does not certify a hosted migration, deployment, provider transaction, native device, or engagement outcome.

## Customer behavior

Saved is a private list of packages a signed-in customer wants to revisit. It expresses interest without reserving capacity, delivery dates, price, portions, or payment. Current published offers supply the available package's details; checkout remains responsible for pricing, eligibility, and atomic schedule reservation.

Save controls appear on discovery/list cards and package details. Their selected state changes only after the server confirms `savedPackage.set`. Pending controls retain a visible label and are disabled for that package. A failed write leaves the confirmed state intact and permits retry. Feed, list, details, and Saved share the same owner-scoped membership; changing account discards the prior account's state and ignores its late responses. Web refreshes on app revision, focus, and return to a visible tab; native refreshes on app activation and screen focus.

A guest can browse but must sign in to save. One intent containing a package ID, UUID nonce, and creation time is retained for less than 24 hours: browser local storage on web and SecureStore on native. A new intent replaces the previous one. Login returns to the same safe in-app path, including filters, selected `card`, and view. After the signed-in Saved read is ready, that intent is submitted once with its nonce as the retry request ID. Failure exposes Retry saving and Cancel; success clears the intent. The client does not create a guest wishlist or treat the intent as a saved item.

`/saved` on both platforms has independent loading, failure/retry, populated, empty, and load-more states. Its empty recovery leads to Browse packages. A suspended, archived, or otherwise unavailable package retains only its saved identity summary: package name, caterer, image reference, and slug. The UI marks it Unavailable, omits purchase/compare/detail actions, and still permits removal. Historical saved identity does not assert current commercial terms.

On a fitting phone viewport, public web `/` and native Discover default to a vertical feed showing one package per deliberate gesture. Swipe and List remain visible choices. A remembered preference supplies the default; an explicit `view=swipe` or `view=list` URL takes priority. Desktop web retains the existing landing page and list. The web How it works destination explicitly opens the list layout.

Each feed card shows food photography, caterer, package name, package total, localized per-meal price, delivery-day/cycle and meal context, delivery inclusion/coverage, and separate Save, Compare, and View package actions. Combined lunch/dinner packages identify both meals and use the shared per-meal calculation. The position counter and previous/next controls make navigation available without a gesture.

An accepted vertical gesture advances at most one card from its starting position. Short, cancelled, horizontal, and boundary gestures do not skip cards. Shared `swipeTarget` accepts a distance of at least 45, or at least 12 with velocity of at least 0.45, and clamps the result to one adjacent item. Web measures CSS pixels and pixels per millisecond; native uses its corresponding gesture coordinates. Gestures never save, compare, or purchase automatically. Web also supports Arrow Up/Down and Page Up/Down when the carousel itself owns focus; interactive child controls keep their own keyboard behavior.

Changing filters starts at the first matching package. Detail, comparison, and login return paths retain the current filters, view, and package ID when that package still matches. Comparison still permits up to three offers at one quantity. A Saved package outside the first public catalog page can open current details and participate in comparison through the independent single-offer reader.

Feed sizing accounts for navigation and the live comparison tray. If the essential text/actions plus image allowance cannot fit, web presents the full list with an explanation; enlarged text can trigger the same recovery. Native also uses List above a 1.35 font scale or when measured content does not fit. A new viewport measurement can reconsider the feed. Reduced motion uses immediate navigation; missing or failed feed photographs use a neutral, labeled photo-unavailable treatment. The web filter dialog traps focus, closes with Escape, and returns focus to its opener. These behaviors keep essential actions reachable without requiring swipe.

`/home` remains the customer's meal agenda. Purchasing, delivery cutoffs, immutable purchased terms, capacity, reservation, refund/support, settlement, and payment-confirmation contracts remain those in PRODUCT.md. This extension creates no new checkout, cart, reservation, or payment action.

## Data and API

The additive [migration](../supabase/migrations/20261001180039_saved_packages.sql) was created with the Supabase CLI and applied/tested locally only. The explicit synthetic demo installer uses the same file when `v1.saved_packages` is absent; this does not apply it to hosted storage.

| Interface | Contract |
| --- | --- |
| `v1.saved_packages` | One row per `(user_id, package_id)`, with save timestamp and minimal identity summary; recent index ordered by owner, timestamp, and package ID. |
| `POST /api/v1/commands`, `savedPackage.set` | Strict `{ packageId: UUID, saved: boolean }` payload and UUID request ID. Authenticated identity supplies the owner. Saving requires a published package and approved caterer; owner removal also works after unavailability. |
| `GET /api/v1/saved-packages` | Authenticated owner read only. Accepts `limit` and `cursor`; default 50, range 1–100. No caller-supplied owner or filter is accepted. |
| Saved response | `items`, `nextCursor`, and complete `packageIds` membership, including unavailable packages and packages on later pages. Each item has a current `offer` or `null` plus its identity summary. |
| Saved cursor | Strict timestamp/UUID keyset, descending `(saved_at, package_id)` order; invalid cursors fail rather than silently reset. Load more appends unique items independently of the public catalog's first 100 offers. |
| `GET /api/v1/offer/{id-or-slug}` | Public current offer only when the package is published and caterer approved; otherwise `{ offer: null }`. Used by detail and compare without scanning catalog100. |

The command serializes owner operations with a transaction-scoped lock and records the audit, receipt, and owner-scoped change event in the same transaction. Repeating a matching request ID/payload returns the existing receipt; reusing it for different input conflicts. The clients retain the same UUID for retry of a failed owner/package/desired-state write and clear it after confirmation. Duplicate successful saves retain one owner row.

The table has RLS enabled and grants no direct access to anonymous or authenticated roles. The public read/command wrappers enforce authorization; their renamed base functions cannot be called directly by those roles. Existing non-Saved dispatch branches remain delegated to their prior implementation. Saving and removal do not write purchasing, reservation, allocation, or payment tables.

## Implementation map

| Area | Files |
| --- | --- |
| Shared types and gesture decision | [saved-packages.ts](../packages/domain/src/saved-packages.ts), exported through [domain index](../packages/domain/src/index.ts). |
| Shared API client | [API client](../packages/api-client/src/index.ts): `savedPackages(cursor, limit)` and `offer(id)`. |
| Web ownership, intent, and write state | [saved-context.tsx](../apps/web/src/components/saved-context.tsx). |
| Web Saved and feed | [saved-packages.tsx](../apps/web/src/components/saved-packages.tsx), [discovery-feed.tsx](../apps/web/src/components/discovery-feed.tsx), [saved-discovery.css](../apps/web/src/components/saved-discovery.css). |
| Web integration | [marketplace.tsx](../apps/web/src/components/marketplace.tsx), [application.tsx](../apps/web/src/components/application.tsx), [marketplace route](../apps/web/src/app/(marketplace)/[[...path]]/page.tsx), [navigation.ts](../apps/web/src/lib/navigation.ts), and [API route](../apps/web/src/app/api/v1/[...path]/route.ts). |
| Native ownership and discovery | [saved.tsx](../apps/customer/src/saved.tsx), [discovery.tsx](../apps/customer/src/discovery.tsx), [Saved route](../apps/customer/app/saved.tsx), and provider/navigation integration in layout, context, auth, daily, purchase, and UI. |
| Local schema installation | [database.ts](../packages/backend/src/database.ts) and the additive migration above. |
| Verification | [shared tests](../tests/saved-packages.test.ts), [PostgreSQL Saved scenarios](../tests/postgres-saved-packages.mjs), [web scenarios](../tests/e2e/saved-swipe.spec.ts), and [native component tests](../apps/customer/tests/saved-discovery.test.tsx). |

## Incumbent design and compact exceptions

The build uses the existing Forest, Sunrise, cream/canvas/surface, semantic colors, self-hosted Jakarta font, icons, and food imagery. Save uses the existing secondary control with sage/forest selected state. The feed frame uses the incumbent surface radius and border; its visible actions keep 44px web minimums. Native shared controls retain their existing 48 minimum size. No new global token, font, palette, shipping raster, or asset-provenance change is introduced.

The existing [detector evidence](../.impeccable/review/detector.json) contains five advisory values in `saved-discovery.css`. The reviewer judged them non-material in the supplied rendered evidence. They describe compact surface choices, not additions to the global DESIGN.md scale:

| Local value | Actual use and purpose |
| --- | --- |
| 22px type | Unavailable Saved package heading; keeps the identity legible in a standard package grid card. |
| 18px type | Phone feed page heading; preserves room for area/search, filters, and view controls. |
| 19px type | Feed package heading with 1.3 line height and wrapping; gives package identity more emphasis than supporting labels within the bounded card. |
| 23px type | Feed package-total price with 1.25 line height and tabular numbers; pairs a prominent total with explicit smaller per-meal and cycle context. |
| 7px radius | Inner Swipe/List buttons inset 3px within the 10px segmented wrapper; follows that nested shape without introducing a new reusable radius. |

DESIGN.md is preserved. Its references to `.impeccable/design.json` predate this work, but that sidecar is absent in this checkout. The incumbent file also contains historical implementation/asset statements and section-order drift. This ordinary extension neither reconciles those statements nor creates a replacement sidecar. The feature-specific dimensions above remain here for future maintainers to assess in this surface.

The desktop hero's visible Katerer pilihan / Featured caterer eyebrow was removed in the finish correction; its accessible section label, caterer heading, photograph, navigation, and View package action remain. The removed eyebrow is not a reusable design rule.

## Local reproduction

Use the repository's installed dependencies with Node 24 or newer. Run from this isolated checkout. The PostgreSQL suite provisions disposable `catera_test` storage when `TEST_DATABASE_URL` is unset; a supplied URL must point to an empty disposable database of that name. Do not point these synthetic checks at hosted customer data.

```powershell
npm run typecheck
npm test
npm run build
$env:CATERA_POSTGRES_EVIDENCE = "output/saved-swipe/postgres.json"
npm run test:postgres
Remove-Item Env:CATERA_POSTGRES_EVIDENCE
npx playwright test --config playwright.saved-swipe.config.ts
npm run test -w @catera/customer -- --preset=jest-expo/android
npm run test -w @catera/customer -- --preset=jest-expo/ios
npm run native:export
```

The [Saved Playwright configuration](../playwright.saved-swipe.config.ts) uses `127.0.0.1:3268`, one worker, explicit `CATERA_V1_DEMO=true` and `CATERA_V1_FIXTURES=true`, `.data/saved-swipe`, `.next-saved-swipe`, and matching `CATERA_PUBLIC_URL`. Because it may reuse an existing server, ensure that port belongs to this isolated synthetic instance. The scenarios verify demo mode before use and clear only the synthetic customer's Saved rows. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium executable.

Manual inspection uses the same environment. In a separate PowerShell terminal:

```powershell
$env:CATERA_V1_DEMO = "true"
$env:CATERA_V1_FIXTURES = "true"
$env:CATERA_DEMO_DATA_DIR = ".data/saved-swipe"
$env:CATERA_NEXT_DIST_DIR = ".next-saved-swipe"
$env:CATERA_PUBLIC_URL = "http://127.0.0.1:3268"
npm run dev -w @catera/web -- --port 3268
```

Inspect guest `/`, `/?view=list`, a filtered selected card, detail/compare/login return, and signed-in `/saved`. Exercise small heights and enlarged text as well as ordinary 390×844, 430×932, and 1440×1000 layouts in Indonesian and English. Keep storage/build paths and origin isolated from the shared demo.

`NEXT_PUBLIC_CATERA_SWIPE_DISCOVERY=false` disables web swipe discovery; `EXPO_PUBLIC_CATERA_SWIPE_DISCOVERY=false` disables native swipe discovery. The literal `false` is the opt-out value; otherwise the fitting phone feed is enabled. Rebuild the relevant app when changing these public flags. They select List as the discovery presentation and do not disable Saved or remove its schema.

## Verification and finish scope

Final verification after the three UI corrections passed locally:

| Check | Result and scope |
| --- | --- |
| Root typecheck | Web, native, and shared TypeScript passed. |
| Root Vitest | 319/319 tests across 49 files passed; final run 86.85s. |
| Next production build | Passed. This is a local build. |
| Saved browser suite | All eight scenarios passed together at port 3268. Covers intentional/cancelled gestures, guest login intent, confirmed writes and retry/synchronization, filters/focus/no-result recovery, preference/URL precedence, compare/return, coverage, both-meal economics, height/text fallbacks, broken images, reduced motion, locale geometry, keyboard focus, and serious/critical axe checks. |
| Native component suites | 44 tests across 10 suites passed under both Android and iOS Jest presets. |
| Expo exports | Android and iOS exports passed. |
| PostgreSQL concurrency suite | Complete suite passed with the final migration, including eight simultaneous Saved receipt retries, duplicate-save deduplication, owner privacy, denied direct table/base-function access, and no purchasing/capacity effects. [Recorded evidence](../output/saved-swipe/postgres.json). |
| Saved catalog boundary | Shared tests saved 104 packages, retrieved all entries over three keyset pages with complete membership on each page, resolved a current public offer outside catalog100, returned null for an unpublished offer, and rejected an invalid cursor. |

The [finish review](../.impeccable/review/finish-review.md) first returned `fix`. One batched correction restored per-meal prices on web/native, removed the 390px area/search overlap, and removed the desktop eyebrow. The same reviewer then returned `ship` for those three scored fixes only. All 11 original capture paths plus `both-mobile.png` were reopened and validated; this verdict does not certify the entire application. Native per-meal pricing resolution was checked in code only. No second detector pass was run.

The twelve synthetic web captures are `mobile.png`, `user-430.png`, `en-390.png`, `en-430.png`, `desktop.png`, `en-1440.png`, `id-desktop-viewport.png`, `en-desktop-viewport.png`, `saved-mobile.png`, `saved-empty.png`, `filters-mobile.png`, and `both-mobile.png`, under `.impeccable/review/`. They cover the feed in both languages at 390/430, desktop at 1440, populated/empty Saved, filters, and combined-meal economics. Screenshots are verification artifacts, not shipping artwork or user-study evidence.

## Release gates

1. Apply `20261001180039_saved_packages.sql` to the intended V1 database through an explicitly authorized rollout before deploying the clients that use Saved/offer reads. Verify the migration chain, authenticated owner-only reads/writes, denied direct/base-function access, unavailable removal, receipt retries, and current offer detail/compare outside catalog100 on that target. The local demo installer is not a hosted migration mechanism.
2. Deploy the reviewed web build with the intended swipe flag and verify actual guest login return, selected-card/filter persistence, Saved synchronization, per-meal economics, viewport clearance, keyboard/reduced-motion behavior, and list fallback on the deployed origin. Existing auth/provider/purchasing gates in [RUNBOOK.md](RUNBOOK.md) remain applicable.
3. Accept the web version before native release. On real Android and iOS surfaces, verify physical slow/fast/cancelled gestures, one-card movement, touch controls, safe areas, keyboard overlap, large text, appearance variants, screen-reader focus, hardware/system back and login/detail/compare return, and pager performance. This Windows environment had no connected adb device or configured AVD and provided no native OS captures.
4. Keep local test/export/build evidence separate from signed native builds, deployed behavior, provider outcomes, and representative-customer usability evidence. This implementation makes no measured engagement or conversion claim.

No hosted mutation, deployment, push, provider operation, or native release was performed for this extension.
