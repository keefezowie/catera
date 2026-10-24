# Handoff: Dapur pages, Mobbin research (2026-10-24)

Start a fresh session. Read this file, then [DESIGN.md](../../../DESIGN.md) (especially "Dapur layout scale" and "Dapur native pass") and the memory index. Ask before pushing. **Do not build anything in that session until the owner has picked from the research.**

## Where things stand

- **Branch:** `v2` at `f8f56cd7` was pushed to origin on 2026-10-24 with the owner's OK. Commits after that are local; check `git log origin/v2..v2`.
- **The Dapur native pass is done.** It covered the audit, 23 of 25 fixes, the gate and the APKs.
  - Audit: `output/native-review/expo-native-ui-audit-dapur-2026-10-24/REPORT.md`.
  - Emulator gate: `output/native-review/dapur-audit-2026-10-24/RESULTS.txt` (all PASS; the NOT VERIFIED list is there).
  - Builder briefs and the reviewer brief are in `C:\wt\logs-dn\`.
- **APKs:** `output/apk/catera-{customer,dapur}-uat-arm64-v8a-20261024-f8f56cd7.apk`. Both are built against V2 and passed the bundle check.
  - The Google Drive connector is connected, but it takes file contents inline in the call, and a 52 MB APK doesn't fit. Upload stays with the owner (or Drive for desktop).
  - SendUserFile caps files at 30 MB for phone viewers.
- **Another session is still live in the main tree**, doing the customer deep pages. Build and capture from worktrees (`C:\wt\1`, `C:\wt\dp1`-`dp8` are clean and merged). Never stash, reset or check out files in the main tree.

## Open items carried

1. **Item 9, "Lupa kata sandi" (owner will decide later).** Dapur email sign-in has no recovery.
   - `changePassword` (`packages/mobile-core/src/account.ts`) needs the current password, so "sign in by phone, then change it" does not work.
   - Option A: an email reset link. It needs a Dapur redirect URL added in Supabase Auth by the owner, plus a callback route like the customer `Recover`/`AuthCallback`.
   - Option B: a no-current-password `updateUser` step after an OTP sign-in. This changes shared `mobile-core`.
   - Option C: leave it.
2. **Item 25, the doubled `&delivery=` on hosted seller-attention hrefs.** The fix is `supabase/hosted/20261024_catera_v2_attention_href_once.sql`. It is hosted-only and idempotent. A dry run on V2 showed it removes exactly the wrapper's `seller-attention` branch.
   - The owner approved applying it, but the agent's permission classifier refused `execute_sql` on production.
   - The owner applies it (Supabase SQL editor), or allows the tool, then checks that `select position('seller-attention' in prosrc) from pg_proc where proname='catera_v1_read_live_address_reapply_base'` returns 0.
3. **Aktifkan "Kirim untuk diperiksa"** is disabled with no reason shown. This was seen at the gate; it is not in the audit.
4. **Demo boot probe bug** (from the layout handoff): `packages/backend/src/database.ts:555`. Gate data copies still need `patch-probe.mjs` before their first boot.
5. **Expo Go dev toast.** "Cannot connect to Expo CLI" swallows taps on sheet footers while it is up. It appears after the emulator loses Metro (airplane mode). It is dev-only; recheck the reply-sheet footer on the APK.

## Next task: page-by-page Mobbin research of Dapur

The owner's goal is the same as the customer round. Every Dapur page should match top merchant and ops apps. For each page, find how those apps handle the job on Mobbin, what reads polished and what reads as slop, then recommend per page. This is the research and audit step; canvas, spec and plan come after the owner picks.

Every Dapur route (`apps/caterer/app`), grouped by job:
- **Tabs** (`(tabs)/(index,pelanggan,menu,usaha)`):
  - Hari ini (`index`: TodayScreen, CookingList / CheckRow, DeliveryOrder / StopRow, SessionCard, LiveSlot, SelectionBar);
  - Pelanggan;
  - Menu (MenuWeek);
  - Usaha.
- **Today and delivery:**
  - `atur-antaran/[id]`, `sampai` (ProofSheet);
  - `laporan/[id]` (ReportScreen, page and sheet), `pindah-tanggal/[id]` (MoveSheet);
  - the ExceptionSheet;
  - `aksi`, `konfirmasi`.
- **Customers:** `pelanggan/[id]` (CustomerDetail, payments), `balas/[id]`.
- **Menu and packages:**
  - `menu/[date]` (MenuDayScreen, SlotEditor);
  - `paket/[id]` (PackageDetail);
  - `paket/baru` (PackageEditor, NutritionFields).
  - The customer macros card reads the nutrition data; the customer session owns "macros card never shows", so coordinate rather than fix it twice.
- **Import:** `impor` (ImportAssistant), `impor-baris` (RowEditor), `impor-foto` (PhotoViewer, Attachments).
- **Business:** `uang` (UangScreen), `tim` (TimScreen, RoleGate), `aktifkan` (AktifkanScreen).
- **Settings:** `pengaturan`, `pengaturan/bahasa`, `pengaturan/tampilan`, `pengaturan/data-akun`, `pengaturan/hapus-akun`.
- **Auth:** `(auth)/masuk`, `(auth)/daftar`. Recovery is missing (item 1).

Method:
1. **Capture.** The controller follows `C:\wt\logs-dn\brief-capture-dapur-pages.md` (light, 360dp, font 1.3, one contact sheet per group) into `output/native-review/dapur-pages-2026-10-24/`. The controller drives the emulator itself, because subagents may be refused `am start`.
2. **Research.** Run one Opus research subagent per group, in parallel, on `C:\wt\logs-dn\brief-research-dapur-pages.md`. They write `docs/superpowers/research/2026-10-24-dapur-pages/<group>.md`.
   - Prefer merchant and driver apps: GrabMerchant, GoBiz, Shopify, Square, Toast, Uber Eats Manager, DoorDash Merchant.
   - Mobbin has iOS and web only, so translate patterns to Material.
3. **Summary.** Publish a short visual summary artifact with numbered picks per page, then wait for the owner.

The customer versions of these briefs (`C:\wt\logs-g\brief-*-deep-pages.md`) belong to the other session. Do not edit them.

## Owner rules in force

- **Skills:** `expo-native-ui` plus `design-taste-frontend` (expo-native-ui wins on conflict), `humanizer` for copy, the superpowers process skills, and `ponytail` for any code. Never use `ui-ux-pro-max`.
- **Model ladder:** Sonnet builders, Opus reviewers, research and gates, 3 Sonnet attempts then Opus.
- **Process safety:** never kill processes you did not start (check the command line, stop by PID tree); never run Metro with `CI=1`; demo backends go on a fresh data copy; no Metro during an APK build.
- **Confirmations:** ask before pushing, applying migrations, or killing anything you didn't start. Owner decisions win over DESIGN.md, and DESIGN.md wins over the skills.
- **Writing for the owner:** short numbered lists in plain words, with screenshots or artifacts for anything visual.

## Kickoff prompt for the new session

> Read docs/superpowers/handoffs/2026-10-24-dapur-pages-research-handoff.md and follow it. Capture every Dapur page, then run the page-by-page Mobbin research with one research agent per route group, using expo-native-ui and design-taste-frontend (expo-native-ui wins on conflict) plus the superpowers process skills. Publish the summary artifact and wait for my picks. Another session is working on the customer app in the main tree, so use worktrees. Ask before pushing.
