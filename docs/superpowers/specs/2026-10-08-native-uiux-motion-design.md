# Catera native apps: UI/UX and motion pass

**Date:** 2026-10-08 · **Branch:** `v2` · **Status:** approved in conversation; awaiting written-spec review
**Scope:** `apps/customer`, `apps/caterer` (Catera Dapur), shared `packages/*`, domain/backend/migrations for kitchen status and usage counts. Web parity is a follow-up.
**Companions:** [customer app design](2026-10-07-customer-app-design.md), [caterer simplification](2026-10-07-caterer-simplification-design.md)

## Context
Both Expo apps (`apps/customer`, `apps/caterer`) are built. User wants: (1) Mobbin research of top global apps for visual quality, UX and retention; (2) motion that tells the product story; (3) a live UI/UX pass on the Android emulator for both apps; (4) a prioritized improvement plan, shaped by a thorough interview.

Binding constraints (AGENTS.md, DESIGN.md, PRODUCT.md):
- Palette fixed (forest #163D2E, sunrise #F47B2A accent-only, cream #FFF7E9, etc.); Plus Jakarta Sans; native type title 30/39, heading 21/28, body 14/23; native panel radius 14; 48dp controls.
- Motion contract today: 120/180/220/320ms, ease cubic-bezier(.16,1,.3,1); navigation, operational rows and money totals stay still; NO staggered catalog entrances; reduced-motion cancels all; mascot loader 2.4s loop after 300ms delay.
- Indonesian-first; food-led discovery; mascot is supporting warmth; artwork individually generated, opaque PNG masters (no transparency yet) — never crop board / mislabel.
- No cart (purchase = package × cycles × slots); no auto-renew, wallet, courier dispatch in V1. Deliveries auto-complete unless caterer reports a problem.
- Don't reopen naming/concept. Code-first.

## Mobbin research digest (iOS corpus; Android parity assumed)
**Discovery (foodpanda, Swiggy, Wolt, Shopee Food, Grubhub)**
- Photo-first category tiles (Wolt: large dish photos on tinted bg with "142 places" counts) — closest to Catera's food-led brief.
- Sticky filter chips row (Sort / Rating / Open now) above a vertical photo-card list; heart-save on card corner.
- Personal greeting + "what's on your mind" dish circles (Swiggy) — quick re-entry by craving.
- Avoid: promo-banner overload (foodpanda/Shopee) — conflicts with Catera's calm, no-slogan brand.

**Subscription / delivery cycles (Blue Apron, Thrive, Ro, Hims)**
- Stepped setup "STEP 3 OF 4" + progress bar; plan-size pills show per-portion price; live order summary under the choice.
- Horizontal date chips for first delivery; "edit by <cutoff>" line under a scheduled week — maps directly to Catera cutoffs.
- Week tabs with status dot (Blue Apron FEB 3 • FEB 10 •) — good model for Jadwal strip.
- Active-plan card: next delivery, cadence, "manage" CTA (Ro/Thrive) — model for Beranda "next meal" hero.

**Order tracking (Wolt, sweetgreen, Snoonu, Grab, Bolt)**
- Wolt's big circular progress ring with time-left text that morphs to "soon" then a check — strongest storytelling motion in the set.
- 4-step icon stepper (Received → Preparing → On the way → Delivered) with filled/active states; Grab adds a contextual illustration.
- "On time" pill + reassurance copy; post-delivery shows Rate + Reorder side-by-side (sweetgreen).

**Confirmation / delight (Wonder, 7-Eleven, Alan, GoodRx, KOHO)**
- Single illustration + one headline + 1–2 CTAs ("View order status"). Wonder's "Order delivered" drops food illustrations into a bag — story-driven motion.
- Pattern: celebration is brief, then hands off to the next useful action.

**Rating / retention (Uber Eats, Keeta, Postmates, DoorDash, Swiggy)**
- Thumb up/down + tappable reason chips (fast, low effort) beats long forms; optional photo.
- Keeta: mascot-led "How was the delivery?" with Bad/Great — fits Catera mascot as supporting warmth.

**Merchant / seller (Shopee Seller, Fiverr, Whatnot, Jobber, Shopify, Revolut Business)**
- Top: today's money + counts in a compact grid; "To-dos"/order-status tiles with counts (To ship / Cancelled / Review) that deep-link.
- Daily mission/progress card (Shopee "Misi Toko") as retention hook for sellers.
- Empty state reassurance "That's it for now" (Shopify) — calm completion state for Hari ini.

**Add-to-selection micro-interactions (Bolt, Skip, Natural AI)**
- "+" on photo becomes quantity badge; persistent bottom bar "View basket 8,20 €" with live total; sheet with "2 selections required" CTA state.
- Catera analogue: package builder slot picker + sticky summary bar with total portions/price.

## Live emulator UI/UX pass (2026-10-08, AVD `catera`, Expo Go 57.0.9, synthetic demo backend)
**Cross-app (P0)**
- **Bold text renders in Roboto.** Both `_layout.tsx` register only `PlusJakartaSans[wght].ttf` as `"Jakarta"`; `mobile-ui` asks for weight 600/700/800 → Android falls back to system font for every title, label, button, number. Biggest single visual-quality defect.
- Native type scale in `packages/mobile-ui/src/components.tsx:23-28` (title 24, heading 17, body 15/22) ≠ DESIGN.md native scale (title 30/39, heading 21/28, body 14/23).
- Zero motion: no press feedback, no haptics, default stack transitions; Stack headers ("Hari", "Masuk") use system header styling, inconsistent with floating back button on package detail.
- Dev "Require cycle" `packages/domain/src/index.ts ↔ customer-day.ts` (hygiene, dev-only toast).

**Customer**
- Beranda (signed-in) — the daily-habit screen — is text-only: no food photo, no hero for next meal, "Tidak ada pengantaran hari ini" bare; plans listed as "5 hari lagi" without progress; "Rantang Nusantara · 1 hari lagi" has no renewal prompt.
- Tapping an active plan (Akun) jumps to Jadwal — no plan detail / progress / renew surface.
- Jadwal: tiny square dots; legend "Diantar / Sudah sampai" ambiguous; day list sorts Makan malam before Makan siang.
- Day screen: good photo + "Ubah hari"; no status journey. Change-day sheet lists every unavailable date first as dashed rows (wasteful) — should be a date-chip strip with disabled states.
- Package detail: strong hero; "Menu belum ditentukan" shown twice; no sample dishes/week preview, no caterer trust block.
- Buy: conflict error "Paket yang sama masih berjalan…" + "Hitung ulang" is a dead-end (should offer next valid start date); single-option "Lama paket" looks like a selected segment; no schedule preview; disabled "Bayar" uses sunrise fill (DESIGN: sunrise is accent, not default fill).
- Jelajah: good photo cards; filter chips wrap to 2 rows (should scroll horizontally).
- Login modal: plain, double title ("Masuk" header + "Masuk ke Catera").

**Catera Dapur**
- Hari ini: three stacked segmented controls (Hari ini/Besok, Masak/Antar, Siang/Malam) = heavy chrome; no greeting/date header; empty state bare. Big "1 porsi" number is good.
- Menu: ISO dates "2026-10-05" (not localized); past days flagged orange "Belum diisi"; tiny ‹ › week arrows; package chips wrap.
- Pelanggan: "Aktif · 0" while Hari ini delivers to Nadia — verify data/semantics.
- Usaha: clean; packages shown with generic fork icon instead of their photo.

## Interview log
1. Live pass → run everything locally (done).
2. Motion scope → **Story moments + micro**: calm browsing/ops; choreographed motion only at story beats; press/selection micro-feedback + haptics everywhere. DESIGN.md motion section gets amended, not discarded.
3. Retention priority → **Daily meal anticipation**.
4. Daily loop → **Tomorrow's dish reveal + Today's meal journey + Streak/progress** (no ratings in this pass).
5. Journey data → **Caterer batch taps** per session ("Mulai masak", "Berangkat antar"); "Sampai" stays auto unless problem reported.
6. Story visuals → **food-led, code-drawn** (Reanimated + react-native-svg); mascot only in existing loader/empty states.
7. Dapur tone → **utility + small wins**.
8. Dish photos → **gentle nudge** in Menu, never blocks publishing; package photo fallback.
9. Progress → **no streaks/milestones/badges** in this phase (overrides #4's streak pick). Plans show remaining days as plain info only.
10. Reveal → **tap-to-unveil after the change cutoff**; before cutoff dishes show plainly with "Bisa diubah sampai …".
11. Renewal → **include** plan detail sheet + "Paket selesai" recap → renew.
12. Scope → **native apps only** (+ shared packages, domain/backend/migrations). Web parity = follow-up.
13. Onboarding → **keep food-first**, no slides; inline "Cara kerja Catera" on package detail.
14. Delivery → **3 phases**, each with emulator review.
15. Measurement → **minimal first-party usage counts** (no vendor SDK, no personal data).
16. Type scale → **adopt documented native ramp** title 30/39·700·−0.8, heading 21/28·700·−0.4, body 14/23, small 11/18, label 12/23·700. Re-check every screen for wrapping.
17. Existing star `ReviewPrompt` on Beranda → **keep as-is**.
18. Fonts → **download official static OFL TTFs** (pinned Tokotype commit) with SHA-256 provenance.

## Plan

### Key architecture finding (no new status table)
`v1.fulfillments` already models `scheduled → preparing → out_for_delivery → delivered|issue`, and `delivery.depart {catererId,date,meal}` already exists (`supabase/migrations/20261008102000_delivery_depart.sql`, today-only via `…102500_depart_today_one_push.sql`; one push per customer, realtime event row, audited). Dapur simply never calls it. Batch taps = add `delivery.cook` + wire both into Dapur. Demo mode is PGlite running real migrations, guarded in `packages/backend/src/database.ts` `createDemoDatabase()`.

### Phase 1 — Foundations & fixes
**Shared**
- Break require cycle: move `addDays`/`schedule` to new leaf `packages/domain/src/dates.ts`; re-export from `index.ts`; `customer-day.ts`, `checkout-eligibility.ts`, `offer-editor.ts` import from `./dates`.
- Fonts: add static Jakarta Regular/Medium/SemiBold/Bold/ExtraBold to `packages/brand/assets/fonts/static/` (+SHA-256 in `packages/brand/manifest.font.json`); register `Jakarta`, `Jakarta-Medium`, `-SemiBold`, `-Bold`, `-ExtraBold` in `apps/{customer,caterer}/app/_layout.tsx`; new `packages/mobile-ui/src/type.ts` `fontFor(weight)`; `Text`/button/chip/field styles map weight→family and drop `fontWeight`; convert the ~68 raw `fontWeight` uses in app sources; guard test forbidding `fontWeight` outside mobile-ui.
- Type ramp: set `textVariants` in `packages/mobile-ui/src/components.tsx` to the DESIGN.md native table (30/21/14/11/12); keep `number` variant tabular; re-screenshot all screens for wrapping and fix.
- Motion foundation: `npx expo install expo-haptics` in both apps; peerDeps in `packages/mobile-ui/package.json`. Tokens `nativeMotion {control 120, selection 180, content 220, feature 320, ease [.16,1,.3,1], spring {damping 18, stiffness 260}}` in `packages/design-tokens/src/index.ts` (+vitest parity vs `apps/web/src/lib/motion.ts`). New `packages/mobile-ui/src/motion/`: `useReduced`, `useHaptic` (tap/select/success/warning), `PressableScale` (0.97 spring; opacity under reduced motion), `FadeSwap`, `AnimatedNumber` (tabular, instant when reduced), `PlateUnveil` (SVG dome lift 320ms), `JourneyStepper` (animates only on stage advance), `Celebrate` (bag-close/ring beat). Adopt `PressableScale`+haptics inside existing `Button`, `Chip`, `Segmented`. Transforms/opacity only. Add `expo-haptics` mock to `apps/*/tests/setup.cjs`.
- Headers: one consistent pattern — hide system Stack headers on pushed screens and use the floating round back button already used on package detail, with the screen title rendered in the content as `Text variant="title"`. Modal sheets keep a close button.
- DESIGN.md: add "Native motion" section (story beats only, no list staggers, nav/money still, reduced motion), fix typography provenance (static files), keep web motion docs unchanged.

**Customer** (`apps/customer/src/…`)
- `schedule/Jadwal.tsx`, `MonthGrid.tsx`: readable coverage marks, legend "Terjadwal / Selesai", sort lunch before dinner (`mealOrder` in domain).
- `schedule/DayScreen.tsx` change-day sheet: horizontal date-chip strip with disabled states instead of dashed unavailable rows.
- `discover/PackageDetail.tsx`: remove duplicate "Menu belum ditentukan"; inline 3-step "Cara kerja Catera" with gentle sequence.
- `buy/BuyScreen.tsx`: conflict → offer "Mulai {tanggal berikutnya}" via new domain `nextStartAfter()`; single length shown as text; Bayar uses forest primary (DESIGN.md: sunrise is accent).
- `discover/Jelajah.tsx`: chips in horizontal ScrollView. `account/Masuk.tsx`: single title.

**Dapur** (`apps/caterer/src/…`)
- `today/TodayScreen.tsx`: date header "Kamis, 8 Okt"; one Segmented (Hari ini/Besok); Masak/Antar merged into per-meal session cards; calm empty state.
- `menu/MenuWeek.tsx`: localized short dates, no "Belum diisi" on past days, 48dp week chevrons, scrolling chips.
- `business/UsahaScreen.tsx`: package photo thumbnails.
- Investigate Pelanggan "Aktif · 0" (`customers/rules.ts` `customerStatus`, marketplace buyers vs `customer_records`) and "1 hari lagi" without renew prompt (`renewalDue` excludes trials → show full-package CTA for trials).

### Phase 2 — Daily loop
**Backend**
- Migration `supabase/migrations/20261009090000_kitchen_cooking.sql`: `fulfillments.cooking_started_at`; command `delivery.cook {catererId,date,meal}` wrapping the current `catera_v1_command` exactly like depart (auth `v1.is_staff`, today-only `INVALID_DATE`, same lock order as depart, `scheduled→preparing`, day status never regresses, realtime event row, audit + receipt, **no push**); redefine `v1.delivery()` to expose `cooking_started_at`; update `v1.beta_production_signature()`; demo guard in `database.ts`.
- Tests: `tests/delivery-cook.test.ts` (mirror `delivery-depart.test.ts`); add cook-vs-depart-vs-confirm-vs-`auto_deliver` and owner/staff parallel races to `tests/postgres-delivery-confirm.mjs` + `postgres-concurrency.mjs`; regression tests that `canMoveDelivery`/address change/cancel behave correctly for `preparing`.
**Domain** (`packages/domain/src/customer-day.ts`, `kitchen.ts`)
- New `PlateState "scheduled"` so "Sedang dimasak" only shows when truly `preparing` (fixes current over-promise).
- `Plate.journey {stage, cookingAt, departedAt, arrivedAt, arrivedBy}`; `tomorrowReveal(state, now)` built on `canChangeDay`/`changeDeadline` (`Delivery.cutoff_at`); `UpcomingRow.image` (dish/menu image → package fallback).
- `kitchenSession(ops, meal)` and `kitchenDayDone(ops, issues)`.
**Dapur**
- Session card actions: "Mulai masak" → `delivery.cook`; "Berangkat antar" → existing `delivery.depart` with confirm, `Celebrate` beat + success haptic; `AnimatedNumber` porsi; "Semua beres hari ini" state.
- Menu: "Tambah foto" chip on dishes without photo (reuse `business/upload.ts` `uploadPhoto`) + preview of customer reveal; never blocks publish.
**Customer**
- Beranda (`today/Beranda.tsx`): photo next-meal hero; `TomorrowCard` — before cutoff plain dishes + "Bisa diubah sampai {jam}", after cutoff `PlateUnveil` (unveiled state per delivery in SecureStore); today's `Plate.tsx` with `JourneyStepper` and timestamp copy ("Dimasak sejak 08.10", "Berangkat 10.42", "Tercatat sampai" when auto). If caterer never taps, stay "Terjadwal" — never guess. `ReviewPrompt` untouched.
**Usage counts**
- Migration `20261009091000_usage_counts.sql`: `v1.usage_daily(day, app, name, n)` (no user column) + `public.catera_v1_usage(name, app)` security definer with allowlist (`app_open`, `reveal_unveiled`, `journey_viewed`, `plan_sheet_opened`, `renew_started`, `purchase_confirmed_viewed`, `cook_started`, `depart_tapped`); add to `localRpc` allowlist + demo install.
- `apps/web/src/app/api/v1/[...path]/route.ts`: `POST usage` branch (zod, session required) — read `node_modules/next/dist/docs` route-handler guide first.
- `packages/mobile-core/src/usage.ts` `track()` fire-and-forget; `app_open` once per Jakarta day via `provider.tsx` AppState; tests + parallel-increment Postgres check.

### Phase 3 — Purchase & renewal beats
- `apps/customer/app/subscriptions/[id].tsx` → real `PlanDetail` sheet (keeps notification links working): remaining days (plain), upcoming meals with photos, "Lanjutkan paket" → `renew/[id]` prefilled via `renewalDefaults`. Link from Akun plan rows and Beranda plan lines.
- "Paket selesai" recap beat (shown once per completed plan) → renew.
- Payment success (`buy/PaymentScreen.tsx` / outcome): food photo, reserved-dates strip, first meal date, "Lihat jadwal" + `Celebrate`; once paid, back/leave go to `/`, never to checkout.
- Fire usage events; update `buy.test.tsx`, `account.test.tsx`.

### Out of scope (this pass)
Web parity; streaks/milestones/badges; new ratings; onboarding slides; mascot animation/transparent art; auto-renew.

## Verification (every phase)
- `npm run typecheck`, `npm test`, `npm run build`, native jest (`npm test -w` customer + caterer), `npm run test:postgres` from P2 (cook/depart/usage concurrency).
- Emulator review in demo mode: `CATERA_V1_DEMO=true npm run dev`; Metro `npx expo start --go` per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`; open via `adb shell am start -d exp://10.0.2.2:<port> host.exp.exponent`; demo logins. Screenshot every touched screen to `output/native-review/p{n}/`, before/after vs this pass's baseline. Check bold text is Jakarta, no wrapping regressions at the 30/21/14 ramp, reduced motion (`settings put global animator_duration_scale 0` + system "Remove animations"), TalkBack labels on new controls.
- P2 end-to-end: Dapur owner taps "Mulai masak" → customer plate shows Dimasak (after reload — demo has no realtime); "Berangkat antar" → Diantar; after cutoff Beranda shows covered plate → tap unveils.
- `npx expo install --check` to confirm Reanimated/worklets/haptics match SDK 57 Expo Go.

