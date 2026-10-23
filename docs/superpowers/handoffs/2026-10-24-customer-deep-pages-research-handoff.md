# Handoff: customer deep pages, Mobbin research (2026-10-24)

Start a fresh session. Read this file, then [DESIGN.md](../../../DESIGN.md) and the memory index. Ask before pushing.

## Where things stand

- **Branch:** `v2` at `57f279d9`, local only. It is about 50 commits ahead of the last push the owner made, so check `git log origin/v2..v2` first. `git push` was blocked for the agent; the owner pushes.
- **APKs:** `output/apk/catera-{customer,dapur}-uat-arm64-v8a-20261024-60ec54e1.apk`. Both are built against Catera V2 (checked inside the bundle). They do not have SI-2 (`57f279d9`); rebuild with `C:\wt\logs-g\build-apks.sh`. That script now always re-bundles JS and refuses a build whose bundle lacks the Supabase host.
- **Backend:** Catera V2 (`kdfddipnkcviberrldpk`) is the live Supabase project, and the old `ygzfdqrljunngfrdygzt` is deleted. Vercel `catera-eight.vercel.app` already points at V2. V2 now has every repo migration plus `supabase/hosted/20261023_catera_v2_live_address_reapply.sql`. `/c/wt/uat-mobile.env` points at V2; there is a backup of the old one beside it.
- **Merged on 2026-10-23 and 2026-10-24:**
  - AU-1/2/3, the expo-native-ui audit fixes: bottom inset, copyable money, continuous corners, iOS-only chevrons, scrim token, Data akun and secondary-read states, the Simpan alamat hint, cached `Photo` everywhere, the virtualised Jelajah list.
  - HB-1: the customer v2 header drops its empty row.
  - SI-1/SI-2: OKX-style sign-in, with the keyboard keeping the button in view.
  - LT-1: the white light theme. Header tint B is owner-approved: Siang `#FBE7C3`, Malam `#E2ECDD`.
- **Gate evidence:** `output/native-review/audit-2026-10-24/RESULTS.txt`. Only a short controller gate ran (white Beranda, sign-in layout, error placement, keyboard). Everything listed under NOT VERIFIED there is still owed.

## Owner rules now in force

- **Design skills:** `expo-native-ui` and `design-taste-frontend`. When they conflict, expo-native-ui wins. `ui-ux-pro-max` is retired. Copy uses `humanizer` as well. Always run the superpowers process skills.
- **Execution ladder:** Sonnet builders, Opus reviewers and gates, at most 3 Sonnet attempts, then Opus. Briefs: `C:\wt\logs-g\brief-*.md`.
- **Gate and process safety:**
  - Never kill processes you did not start.
  - Never run Metro with `CI=1`.
  - Run the demo backend on a fresh data dir.
  - Do not run Metro and an APK build at the same time.
  - Subagents may be refused emulator `am start`. The controller session can run it.

## Open bugs the owner reported (fix before or alongside the research)

1. **Macros card never shows.** The owner could not find any package with nutrition info. `NutritionCard` renders only when a package carries nutrition data. Check whether any demo or V2 package has it. If none does, the card is unverifiable and the empty state needs a decision.
2. **The Simpan alamat sheet blinks.** `alamat-form` blinks when the form sheet expands to the large detent and shrinks back. Owner screenshots show both detents. Suspects:
   - the `SheetBody` frame/footer re-measure on `sheetDetentChange` (`useSheetHiddenBelow`, in `packages/mobile-ui/src/SheetHeader.tsx`);
   - a keyed `FadeSwap` remount (keys now remount content);
   - the pinned footer jumping.

   Reproduce on the emulator with screenrecord before fixing.
3. **Stale DESIGN.md.** Not yet updated for today's work: the palette, the tab bar (`tabBarAndroid`), the new tokens `fill`/`inputFill`/`cardBorder`/`cardShadow`/`well`, card borders, the sign-in (replaces G16/E3 centred), the header row rule, chevrons iOS-only, and the Photo ground. The builders' Doc facts are in the session transcript; the main ones are summarised here.
4. **Smaller items:**
   - Dapur has no password recovery route.
   - The mascot drew about 5 s late on first open in Expo Go; recheck on the APK.
   - The hosted `seller-attention` href gets `&delivery=` appended twice. Harmless.
   - The Google Drive connector is not loaded in sessions yet. The owner wants every new APK uploaded there automatically, so set this up once the connector appears, or via Drive for desktop.

## Next task: page-by-page Mobbin research of the customer app

The owner's goal: the UI has improved, but the deeper pages (beyond the four tabs) are not on par with top apps. For every page, research how top apps handle that kind of screen on Mobbin. Record:
- their patterns;
- what reads polished and what reads as slop;
- how they use UI rules to support the task.

Then recommend per page. This is the research and audit step of the phase process; canvas, spec and plan come after the owner reviews.

Every customer route (apps/customer/app), grouped by job:
- **Tabs:** Beranda (`index`), Jadwal, Jelajah (`jelajah`, `discover`), Akun.
- **Discover and buy:**
  - `paket/[id]` and `package/[id]` (package detail)
  - `beli/[id]`, `checkout/[id]`, `bayar/[id]`, `payment/[id]`, `konfirmasi`
  - `pembelian/*`: mulai, alamat, alamat-pilih, alamat-form, bantuan, bantuan-form
  - `renew/[id]`
  - `area`, `disimpan`, `saved`
- **Plans and schedule:**
  - `paket-saya`
  - `subscriptions/[id]` and its `/menu`
  - `pilih-menu/[id]`, `hari/[id]`, `ubah-hari/[id]`, `tomorrow`, `perlu-diurus`
- **Help and feedback:** `bantuan`, `bantuan-form`, `masalah/[id]`, `ulasan/[id]`, `aksi`.
- **Account:**
  - `alamat`, `addresses`, `alamat-form`
  - `data-akun`, `hapus-akun`, `pembayaran`, `notifications`
  - `pengaturan`, `pengaturan/bahasa`, `pengaturan/tampilan`
- **Auth:** `login`, `register`, `recover`, `auth/callback`, `claim/[token]`.

Suggested method:
1. Capture each page on the emulator in light, at 360 dp and at font 1.3, so the research compares like with like. One contact sheet per group.
2. For each page, run 2 to 4 Mobbin searches for the same job (iOS and Android, modern apps first), and cite each screen with its `mobbin_url`. Group results by pattern.
3. Write `docs/superpowers/research/2026-10-24-customer-deep-pages.md`. Per page:
   - the current screenshot;
   - the 3 to 5 best references;
   - the patterns that work;
   - what in Catera reads as slop or unpolished, judged against expo-native-ui and the taste skill;
   - a ranked recommendation.
4. Publish a short visual summary artifact for the owner. Then wait for their picks before any build.

Use parallel subagents per page group to save context; the Mobbin MCP is available.

## Kickoff prompt for the new session

> Read docs/superpowers/handoffs/2026-10-24-customer-deep-pages-research-handoff.md and follow it. First reproduce and fix the two owner bugs (macros card visibility, Simpan alamat sheet blink), then run the page-by-page Mobbin research of the customer app as described, using expo-native-ui and design-taste-frontend (expo-native-ui wins on conflict) plus the superpowers process skills. Ask before pushing.
