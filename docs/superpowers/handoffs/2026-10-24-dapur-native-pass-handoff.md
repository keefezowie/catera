# Handoff: Dapur native pass, audit to Mobbin research (2026-10-24)

Start a fresh session. Read this file, then [DESIGN.md](../../../DESIGN.md), the memory index, and the customer handoffs listed under "References". Ask before pushing.

**Goal:** run the same loop on Catera Dapur (`apps/caterer`) that the 2026-10-23/24 session ran on the customer app:
1. audit;
2. owner picks the fixes, then build;
3. header band;
4. light theme check;
5. demo login;
6. sign-in;
7. emulator gate;
8. APKs;
9. a handoff for the page-by-page Mobbin research.

Several of those changes already reach Dapur through shared code. Don't redo them. Find where Dapur missed them.

## Where things stand

- **Branch:** `v2` is at `1d736acf` or later, local only. The owner pushes; `git push` is blocked for the agent. Check `git log origin/v2..v2`.
- **Another session is live on the main tree.** It is doing the customer deep-pages research and its bug fixes (it made `1d736acf`).
  - Do every Dapur build in a worktree (`C:\wt\1`-`5` exist, on old task branches). Recreate one from v2: `git worktree add -B task-DP-n C:\wt\n v2`, after checking the old branch is merged.
  - Merge with rebase plus `git merge --ff-only` onto v2.
  - Never stash, reset or check out files in the main tree. A stash `stash@{0}` "restored-after-accidental-pop" holds apps/web CSS edits that are not ours; leave it alone.
  - Shared code (`packages/mobile-ui`, `packages/mobile-core`, `packages/design-tokens`) is also rendered by the customer app. Scope Dapur-only changes with `useLayoutScale() === "classic"`, or verify both apps.
- **Backend:**
  - Catera V2 Supabase is `kdfddipnkcviberrldpk`; the old project is deleted.
  - Vercel `catera-eight.vercel.app` points at V2.
  - `/c/wt/uat-mobile.env` holds the mobile UAT env.
  - Dapur talks to the same backend as customer, so the demo login fix applies to it. Verify that a Dapur demo account signs in; do not assume. Demo caterer accounts are described in docs/RUNBOOK.md and the seed. Never paste secrets into chat.
- **APKs:** `output/apk/catera-dapur-uat-arm64-v8a-20261024-60ec54e1.apk` is the latest Dapur APK. It is built against V2, and the bundle check passed.
  - Rebuild with `C:\wt\logs-g\build-apks.sh`. It builds customer then caterer, always re-bundles JS, and writes "BUNDLE MISSING" to `apk.status` if the Supabase host isn't in the bundle.
  - Never build while a Metro is running. The other session may also be building, so check first.
- **Google Drive upload:** the owner wants every new APK uploaded to their Google Drive automatically. The connector was not loaded in the last session. Check `session_connectors_status` and upload new APKs if it's there; otherwise say so.

## What Dapur already has from the customer round (verify on the device; don't rebuild)

| Customer change | Status in Dapur | What to check |
|---|---|---|
| LT-1 white light theme (canvas/surface #FFFFFF, `cardBorder` #E7E7E4, `fill`/`inputFill` #F4F4F2, `cardShadow`, `tabBarAndroid` #E9E9E7, `well`) | Tokens are shared, so it should apply | Do Dapur's cards get `cardEdge` (a border), or do white cards vanish on the white page? Is the tab bar distinct? |
| Header tint B (Siang `#FBE7C3`, Malam `#E2ECDD`, `LIGHT_HEADER` in design-tokens) | Shared constant | Does Dapur use MoodHeader or its own header, and does the band read on white? |
| HB-1 drop the header's empty row | **Scoped to v2 only** (`MoodHeader.tsx`, `hasRow`) | Offer it to the owner for Dapur, as option A/B screenshots |
| SI-1/SI-2 OKX sign-in (`packages/mobile-ui/src/AuthLayout.tsx`: AuthScreen, AuthHeading with `brand` wordmark for Dapur, MethodTabs, PasswordField, AuthSwitch; error between fields and button; keyboard keeps the button visible) | Dapur `src/auth/Masuk.tsx` and `Daftar.tsx` use it | Gate it on Dapur: phone and email steps, error placement, keyboard, wordmark vs mascot. **Dapur has no password recovery route**; ask the owner whether to add one |
| AU-1 bottom inset outside tabs (Screen `32 + insets.bottom`) | **v2 scale only**; AuthScreen adds the inset for classic | Audit every Dapur stack screen at 3-button nav and font 1.3 |
| AU-2/3 (selectable money, continuous corners, iOS-only chevrons, scrim token, `Photo`/expo-image, secondary-read errors, virtualised lists) | Partly shared components; Dapur's own screens weren't audited | This is the audit's job |
| `1d736acf` Android form sheets open at full height | Shared SheetBody | Check Dapur sheets: ExceptionSheet, MoveSheet, ProofSheet, ChoiceSheets, SlotEditor |

## Step 1. Audit (read-only)

Do it the way the customer audit was done: `output/native-review/expo-native-ui-audit-2026-10-23/REPORT.md`, the format to copy. Run three Opus passes in parallel, as background subagents, each read-only:
- **Styling:** borderCurve, boxShadow, token vs hard-coded colours, `selectable`, tabular-nums, cross-platform chrome.
- **Layout, forms, states:** safe areas, FlatList vs ScrollView (orders, customers, menu, import rows), `keyboardShouldPersistTaps`, primary action vs keyboard, four data states, silent secondary reads, drafts kept on failed save, disabled-without-reason, destructive confirms, unsaved guards.
- **Libraries and native:**
  - RN `Image` vs `Photo`;
  - `Platform.OS`/`useContext`;
  - the image picker, camera and permission-denial flows in `impor*` and the package editor photo upload;
  - deep links (`+native-intent.tsx`);
  - stack titles vs custom text;
  - accessibility on custom controls.

Each pass invokes `expo-native-ui` first. Reuse the customer report's "Conflicts with DESIGN.md" list rather than re-flagging those items.

Write `output/native-review/expo-native-ui-audit-dapur-2026-10-24/REPORT.md` as one ranked table (#, Severity, What, file:line, Fix). Then show the owner the numbered list and **wait for their pick** (last time they said "fix all of these from 1 - 7").

An earlier attempt was stopped by the owner before any pass returned. Nothing from it exists.

## Step 2. Build the picked fixes

- **Builders:** one Sonnet builder per independent task, in its own worktree. Each gets a brief based on `C:\wt\logs-g\brief-common.md` (paths, commands, skills) and follows TDD.
- **Review:** an Opus reviewer per task (`brief-review.md`).
- **Escalation:** up to 3 Sonnet attempts, then one Opus attempt.
- **Before each merge:** `npm run typecheck` and Jest **from inside `apps/caterer`** (`npx jest`). Never run Jest from the repo root with `--runInBand` and a custom testMatch; it stalls. If shared packages changed, also run Jest from `apps/customer`.

## Step 3. Owner-facing design choices

For each visual choice (header row, card edge, any new pattern), publish a quick artifact with options A/B/C and wait. Last time this worked: the header tints B and the OKX sign-in direction were both chosen from an artifact. Use Mobbin (MCP `search_screens` / `search_flows`, modern apps first) when the owner asks "how do top apps do this".

## Step 4. Emulator gate (controller runs it, not a subagent)

Follow `C:\wt\logs-g\brief-gate.md` and the memory note on the emulator gate env.

**Setup:**
- emulator-5554;
- Expo Go;
- Dapur Metro on a free port: 8081 may belong to the owner, so check with `netstat` first;
- never run Metro with `CI=1`;
- the owner's `next dev` on :3000 may already be up; use it as-is;
- a demo backend, if needed, goes on a fresh data dir.

**Process safety:**
- Subagents get refused `am start` and taskkill, so the controller drives the device.
- Kill only processes you started, by PID, after checking their command line. Never `taskkill node.exe`.

**Cover:**
- sign-in (phone, email, error, keyboard);
- Hari ini;
- Pelanggan;
- Menu;
- Usaha;
- one sheet opening and changing detent;
- one form save and its failure;
- the white theme;
- header tint;
- 3-button nav with font 1.3;
- dark mode.

Record PASS / FAIL / NOT VERIFIED in `output/native-review/dapur-audit-2026-10-24/RESULTS.txt` with screenshots. Reset the device afterwards: font, nav, night mode, force-stop Expo Go.

## Step 5. APKs

Rebuild both APKs with the script once v2 has the merged fixes, check `apk.status`, then upload to Drive if the connector is available.

## Step 6. Handoff for the Dapur Mobbin research

Write it the way `2026-10-24-customer-deep-pages-research-handoff.md` was written. **Do not start the research in this session**; the owner wants it in another fresh session.

Every Dapur route (`apps/caterer/app`), grouped by job:
- **Tabs** (`(tabs)/(index,pelanggan,menu,usaha)`):
  - Hari ini (`index`, TodayScreen: CookingList, DeliveryOrder, SessionCard, SelectionBar);
  - Pelanggan (`pelanggan`);
  - Menu (`menu`);
  - Usaha (`usaha`).
- **Today and delivery:**
  - `atur-antaran/[id]`, `sampai`;
  - `laporan/[id]` (ReportScreen), `pindah-tanggal/[id]` (MoveSheet);
  - ExceptionSheet, ProofSheet;
  - `aksi`, `konfirmasi`.
- **Customers:** `pelanggan/[id]` (CustomerDetail, payments), `balas/[id]` (reply to reviews).
- **Menu and packages:**
  - `menu/[date]` (MenuDayScreen, SlotEditor);
  - `paket/[id]` (PackageDetail);
  - `paket/baru` (PackageEditor with NutritionFields).
  - The customer macros card reads this data, and the customer session is fixing "macros card never shows". Coordinate; don't fix it twice.
- **Import:** `impor` (ImportAssistant), `impor-baris` (RowEditor), `impor-foto` (PhotoViewer, Attachments).
- **Business:**
  - `uang` (UangScreen);
  - `tim` (TimScreen, roles and RoleGate);
  - `aktifkan` (AktifkanScreen, onboarding).
- **Settings:** `pengaturan`, `pengaturan/bahasa`, `pengaturan/tampilan`, `pengaturan/data-akun`, `pengaturan/hapus-akun`.
- **Auth:** `(auth)/masuk`, `(auth)/daftar`; recovery is missing.

Research method:
1. Capture each page at 360dp, light, font 1.3.
2. Run 2–4 Mobbin searches per page. Dapur is a merchant/ops tool, so prefer merchant and driver apps: GrabMerchant, GoBiz, Shopify, Square, Toast, Uber Eats Manager, DoorDash Merchant.
3. Per page, write: the references with `mobbin_url`, the patterns that work, Catera's slop, and a ranked recommendation.
4. Publish a summary artifact and wait for the owner's picks.

The capture and research briefs `C:\wt\logs-g\brief-capture-deep-pages.md` and `brief-research-deep-pages.md` were written for the customer app. Copy and adapt them; don't edit them, since the other session uses them.

## Owner rules in force

- **Design skills:** `expo-native-ui` plus `design-taste-frontend`; expo-native-ui wins on conflict. **Never invoke `ui-ux-pro-max`** (retired). Use `humanizer` for copy. Use the superpowers process skills on every pass and put them in every subagent brief.
- **Model ladder:** Sonnet builds, Opus reviews and gates, 3 Sonnet attempts then Opus. Keep the controller quiet and script the gates. Compact near 150k and write a handoff before the context runs out.
- **Indonesian-first copy.** DESIGN.md wins over the skills; owner decisions win over DESIGN.md.
- **Confirmations:** ask before pushing, applying migrations, or killing anything you didn't start.
- **Writing for the owner:** reply in short numbered lists and plain words, with screenshots or artifacts for anything visual.

## Known open items to carry

- DESIGN.md is stale for the 2026-10-23/24 work (white theme tokens, sign-in, header row rule, chevrons iOS-only). The customer handoff lists this; add the Dapur specifics when you're done.
- On first open in Expo Go the mascot drew about 5 s late. Dapur uses the wordmark on sign-in, but check any Dapur mascot surfaces on the APK.
- The hosted `seller-attention` href gets `&delivery=` appended twice. Harmless, and Dapur-related; fix it if it's cheap.

## References

- Customer audit: `output/native-review/expo-native-ui-audit-2026-10-23/REPORT.md`
- Customer gate results: `output/native-review/audit-2026-10-24/RESULTS.txt`
- Customer research handoff: `docs/superpowers/handoffs/2026-10-24-customer-deep-pages-research-handoff.md`
- Phase G-c handoff: `docs/superpowers/handoffs/2026-10-22-native-phase-g-c-handoff.md`
- Full transcript of the customer round: `C:\Users\nidal\.claude\projects\D--Project-Catera-catera\21e2b0dc-6968-4cb7-8af7-3ab450ee89fc.jsonl` (large; grep it, don't read it whole)

## Kickoff prompt for the new session

> Read docs/superpowers/handoffs/2026-10-24-dapur-native-pass-handoff.md and follow it. Run the expo-native-ui audit of the Dapur app (three read-only Opus passes), write the report and give me the numbered fix list to pick from. Use expo-native-ui and design-taste-frontend (expo-native-ui wins on conflict) plus the superpowers process skills. Another session is working on the customer app in the main tree, so build in worktrees. Ask before pushing.
