# Polish artwork: build plan (2026-10-30, speed mode)

Spec: docs/superpowers/specs/2026-10-30-polish-artwork.md (rulings + owner instructions). Canvas source: docs/superpowers/canvas/2026-10-30-polish/*.dc.html. Art: `import { PolishArt, type PolishArtName } from "@catera/mobile-ui"`, used as `<PolishArt name="spot-wok" size={…} />` (decorative by default; pass `accessibilityLabel` only when the art carries meaning; `contentFit="cover"` for welcome-meja).

## Rules for every builder
- **Skills, in order:** `expo-native-ui`, then `design-taste-frontend` (app-screen rules), then `humanizer` for copy, plus `ponytail` and the superpowers process skills (test-driven-development, systematic-debugging, verification-before-completion). Never ui-ux-pro-max.
- **Canvas:** it decides structure, element order, art placement and copy.
- **Measurements:** spacing, sizes, type, targets and safe areas come from the two design skills plus the DESIGN.md tokens (`expo-native-ui` wins). Note which rule set each measurement in a short comment only where it isn't obvious.
- **Data:** show real data only, with no invented numbers or claims.
- **Copy:** Indonesian first, with English through `t()`.
- **Motion:** honour reduce motion.
- **Process:** never kill processes you did not start (never `taskkill /IM node.exe`). No commits, stash, reset, checkout or reverts. The tree is shared with the other builders, so touch only your own files (below). Need something outside them? Report it; don't edit it.
- **Checks before returning:** `npm run typecheck`, `npx jest` in your app, and root `npx vitest run tests/native-theme-guard.test.ts tests/native-font-weights.test.ts tests/copy-scan*.test.ts` (whichever exist). Update or replace any tests your change breaks.

## Tasks and file ownership
- **P1, customer first-run onboarding and the Masuk band.**
  - Owns: new `apps/customer/app/mulai/**`, new `apps/customer/src/onboarding/**`, the first-run gate wiring in `apps/customer/app/_layout.tsx` (only the lines it needs), `apps/customer/src/account/Masuk.tsx` and `Register.tsx` (band on the providers step only).
  - Artboards: Main, MulaiArea, MulaiLauk, MulaiMencari, Masuk.
  - Exposes `apps/customer/src/onboarding/prefs.ts`: `readLaukPrefs(): Promise<LaukPref[]>` and `type LaukPref = "ayam"|"ikan"|"daging"|"sayur"|"pedas"|"tanpa-santan"`. P3 consumes it.
  - The area choice goes through the existing Jelajah area storage (apps/customer/src/discover/area.tsx). Read it there; don't edit area.tsx. If a setter is missing, report it.
- **P2, Hari ini, the tracker, Selamat makan, after payment and the push primer.**
  - Owns: `apps/customer/src/today/**`, `apps/customer/src/tomorrow/**`, `packages/mobile-ui/src/RantangTrack.tsx` and any LiveSlot/UpcomingDays files in mobile-ui, `apps/customer/src/buy/PaidOutcome.tsx` (and its outcome parts), the review sheet, and `packages/mobile-core/src/provider.tsx` plus `push.ts` for the primer.
  - Artboards: Beranda, Lacak, SelamatMakan, Lunas, PrimerNotif.
- **P3, Jelajah, package detail, Disimpan, Akun and the empty states.**
  - Owns: `apps/customer/src/discover/**` (except P1's read of area), `apps/customer/src/account/Akun*.tsx` and AkunTiles, `apps/customer/src/account/Notifications.tsx`, the Disimpan/saved and Laporan/report screens.
  - Artboards: Jelajah, JelajahArea, JelajahFilter, Paket, Disimpan, Akun, Notifikasi, Laporan.
  - Sorts Jelajah by `readLaukPrefs()` when an honest keyword match exists (spec ruling 5). Until P1 lands, use a local stub with the same signature and tell the controller.
- **P4, Dapur.**
  - Owns: `apps/caterer/src/today/**` and any Dapur empty or done-state files.
  - Artboards: DapurKosong (dapur-kosong), DapurSelesai (dapur-selesai), DapurLibur (keeps mascot-tidur).
  - "N pelanggan makan dari dapurmu hari ini" only with the real delivered count; otherwise drop the line.

## After the builds
1. A UI/UX audit agent runs `expo-native-ui` and `design-taste-frontend` over every changed screen, then the fixes go in.
2. A code review (Opus).
3. Full checks: typecheck, vitest, both jests, build, postgres.
4. The emulator gate against the canvas (structure and placement) and the skills (measurements).
5. DESIGN.md update, handoff, commit.
