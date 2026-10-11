# Phase G kickoff: the device gate and the Phase F carry-overs

Paste this as the first message of the Phase G session. It is self-contained. Phase F is built and green in Jest, Vitest, typecheck, build and PostgreSQL on `v2` (`7cf0f23d` plus the Phase F gate docs), but **nothing in it has been seen on a phone**. Phase G closes that, runs iOS for the first time, builds a development client for the things Expo Go cannot show, and clears the small tasks Phase F parked.

## Read first

- [DESIGN.md](../../../DESIGN.md), the section "Native polish (Phase F), October 11, 2026" and everything it supersedes.
- [Audit 008 follow-up](../../../anti-slop/audit-008-followup-2026-10-11.md): the verdict for each of the 17 findings, the Review Focus lines, the full list of unverified device checks and the antislop Delivery Gate (FAIL on R-35 until a click-through exists).
- [MASCOT-MOTION.md](../../MASCOT-MOTION.md), [the Phase F spec](../specs/2026-10-10-native-phase-f-design.md) and [plan](../plans/2026-10-11-native-polish-phase-f.md), [PREDICTIVE-BACK.md](../../PREDICTIVE-BACK.md), [RUNBOOK.md](../../RUNBOOK.md) and the ledger `.superpowers/sdd/2026-10-11-native-polish-phase-f/progress.md` (rulings and parked items).

## Skills

Before you plan, build, review or critique, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `apple-design` (iOS), `material-3` (Android; if it is not installed, say so in every report), `design-taste-frontend` and `impeccable`, and apply them. antislop's mode is **after (session override)**: never ask the mode question. `design-taste-frontend` scopes native mobile out (its section 13), so apply its general rules (skeletons over spinners, motivated motion, contrast, copy self-audit, no em dashes), not its web stack. `impeccable`: run its context step once per session with `--target` set to the app being changed.

## Fixed rules

- **Work on `v2`** in the main tree `D:\Project\Catera\catera` (`v1` is maintenance-only). AGENTS.md applies: tenant authorization and entitlement changes stay in database transactions; never replace production storage with demo data silently; demo mode is explicit and synthetic; no secrets, no real customer fixtures. After a material change run `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites (`npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from each app folder), the relevant browser or native checks and `npm run test:postgres`. This Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching `apps/web`. Production release needs separate Supabase, SMS/SMTP, Xendit and mobile credentials plus the gates in docs/RUNBOOK.md. Preserve the existing hosted pilot. When publishing, verify the production deployment's commit and the visible active interface.
- **Platform-native chrome, brand in the content.** NativeTabs, native stack headers and native sheets stay native; the identity lives in mood headers, the day arc, the rantang, food photos and the mascot. Native bars read the theme, never the mood.
- **Plus Jakarta Sans** everywhere the app draws text; system-drawn UI (alerts, share sheet, keyboard, pickers) keeps the system font.
- **Copy:** Indonesian first with English through `t(id, en)`. Customer copy says "Anda", Dapur copy says "kamu". No em dashes. Operational numbers tabular. No invented numbers (R-17).
- **Motion:** `nativeMotion` control 120, selection 180, content 220, feature 320 ms, ease `(.16, 1, .3, 1)`, press spring damping 18 stiffness 260; transform and opacity only; instant under reduced motion; loops only while waiting (mascot loop, skeleton pulse); Decision A (no motion on a first load, refresh, pull, search, filter, tab return or mood switch). Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 2.
- **Artwork truth:** apps import only `packages/brand/assets/phase-f/runtime/` (plus the splash marks in `LaunchCover` and `confetti.json`). Everything is a processed derivative, never a master; rig layers are never trimmed; never call opaque or upscaled files transparent or high-resolution masters. Do not reopen naming, concept selection or the approved palette. Never crop the reference board. Preserve the individually regenerated artwork, food-led discovery, the delivery-cycle direction, the Indonesian-first interface and the code-first preference.
- **Never stage** `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/` or `catera-phase-f-artwork.zip`. Stage by explicit path. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Owner's model and gate rules (2026-10-11).** Sonnet writes first builds (Opus only with a written reason), docs and code mapping. Opus runs the fixes (a fresh fixer for round 1, then the same one resumed), every review and every device gate. Only gate agents take screenshots, and contact sheets are captured by script. Contrast, tap-target and truncation checks are scripted, not eyeballed. The final gate re-checks only earlier failures and the unverified list. The controller stays quiet: no idle status turns, it reads return contracts rather than full reports, and it runs checks in the background.

## What the machine needs first

Phase F could not run a device. On this machine the Android SDK is present, but there is no system image or AVD; there is no JDK on PATH; the Expo Go APK has not been downloaded; and there is no Mac. Ask the owner before downloading anything (the emulator image and Expo Go are about 1 GB), and ask for the Apple and EAS credentials a development build needs. If something is missing, stop at that item, record it as NOT VERIFIED with the reason, and continue with the rest. Never enter or invent credentials.

## Goal

Every row of the follow-up audit that says NOT VERIFIED becomes PASS or FAIL with a capture, every FAIL is fixed, and the carry-over tasks below are done. Then re-run the antislop Delivery Gate with R-35 backed by a recorded click-through.

## Order

| Task | What | Depends on | Builder |
| --- | --- | --- | --- |
| G0 | Device environment: emulator image, Expo Go, demo backend on a fresh `CATERA_DEMO_DATA_DIR`, Metro per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` | owner permission | Opus |
| G1 | Task 9 go/no-go on Android (the first thing to run, because every sheet depends on it) | G0 | Opus |
| G2 | Full Android gate (below) | G1 | Opus |
| G3 | iOS run | a Mac or iPhone | Opus |
| G4 | Development build: native splash, Android 12 splash mask, predictive back, real push states | EAS or a local build | Opus |
| G5 | Copy task | none | Sonnet |
| G6 | Address delete (`address.delete`) | none | Sonnet |
| G7 | "Syarat dan privasi" page | none | Sonnet |
| G8 | Masuk alignment | G2 | Sonnet |
| G9 | The other parked Minors (below) | none | Sonnet |
| G10 | Fix rounds from G1 to G4, then the final gate, DESIGN.md corrections and a Phase H kickoff | all | Opus |

## G1: the sheet go/no-go (Task 9 Step 4)

On the Android emulator in Expo Go, open Ada masalah from a Hari row and check: (a) the sheet opens at the form detent; (b) typing expands it and the keyboard never covers the focused field; (c) hardware back and swipe close it once and keep Hari, including a swipe with typed text, which cannot ask on Android because react-native-screens 4.26.2 ignores `preventNativeDismiss` (the note is kept as an in-memory draft instead; the owner decides whether that is acceptable); (d) TalkBack lands on the title; (e) the confirm sheet opens over it and returns, and the same for the Dapur `impor-baris` sheet over the Impor modal. Record each as PASS or FAIL with a capture in `output/native-review/phase-f/sheets-*.png`. **No fallback was taken in Phase F.** If a check fails, stop, report the failing check and the react-native-screens behaviour, and use the smallest fallback: keep the custom `Sheet` for forms with fields (Ada masalah, Alamat, review, Ubah hari) while choice, action and confirm sheets stay native; if only (e) fails, declare `konfirmasi` inside the tab stack layout too and push it in-stack from `useUnsavedGuard`. Take it to the owner before continuing.

## G2: the full Android gate

Expo Go, demo backend, light and dark (`adb shell cmd uimode night yes` and `no`), Siang and Malam where relevant. Cover cold start signed in and signed out (before and after recordings), Beranda, Jelajah, Jadwal, plan detail, Pengaturan with every switch state reachable in Expo Go (Expo Go reports `unavailable`), every new sheet, the success beat, the heart and toast, list motion, gizi, import, the four empty states, and Dapur Hari ini with its confirm sheets. Also font scale 1.3 at 360dp, reduced motion (`adb shell settings put global animator_duration_scale 0` and "Remove animations"), and TalkBack on the switch, a sheet, a toast and the thumbnails. Record each Review Focus line of the plan as PASS or FAIL with a capture. These parked device checks from the ledger must each get a verdict:

- Task 1: the Reanimated screens launch with the aligned Reanimated 4.5.1 and worklets 0.10.1.
- Task 2: Android snackbar assumes an 80dp tab bar and ignores the keyboard over a footer; the screen-reader flag can resolve after launch; a toast whose sheet closes jumps edge (iOS).
- Task 3: a second `SuccessRig` play may paint one resting frame before the layout-effect reset; crispness at 3x; `MascotReading` above 144pt upscales.
- Task 4: the hand-off beat; the splash hides before the cached first-screen read lands.
- Task 5: Android fade clipping; font scale 1.3 on the skeletons; one blank frame on a cached-launch empty reload; iOS VoiceOver reading "Memperbarui…".
- Task 6: header heights measured on the phone, not compared from styles.
- Task 8: Keluar waiting up to 3 seconds; a cold Dapur link to a Pengaturan sheet opens over Hari ini.
- Task 10: Android nested scroll in long fit sheets; the picker to Alamat swap.
- Task 11: sheet detents and keyboard expansion in the Dapur sheets; TalkBack focus on each sheet title.
- Task 12: the confetti box (a square over the beat, not the full screen); the heart's dots clipped on row cards (`PackageCard.tsx`); `RowSwap`'s native exits actually skipped on a filter or a pull; list swaps skip row animations.
- Task 13: empty and error art in light and dark at 360dp and font 1.3; the count card's fade and layout; TalkBack on the art states.
- Task 14: Android range tiles two by two at font 1.0 on 360dp; the Dapur switch row with TalkBack; select-on-focus replacing a carried range on the first keystroke.
- Task 15: the Android corner remove target; TalkBack reading announce.

## G3: the iOS run

No iOS surface has ever run. Check the large-title sheets, the keyboard in sheets, the iOS toast placement (under the large title, under the mood header, at the bottom of a sheet above the keyboard and any footer, which currently over-clears a footer by 34pt), the confirm sheet over a tab-stack sheet (the highest risk), the day's "..." handing off to a sheet in another stack (Hari, the Beranda hero and the plan detail's upcoming rows: "..." then Pindah tanggal, Ganti alamat hari ini and Laporkan masalah must each open their sheet, never be dropped or flash; the answer now waits `SHEET_CLOSE_MS` 400 after `/aksi` leaves, so also judge whether that wait reads as lag and tune it; the final Phase F review recommends answering on the root stack's `onFinishTransitioning` (reachable through `<Stack unstable_nativeProps>`, unconfirmed) with a timer of about 800 to 1000ms as the fallback, because a 400ms answer can land while the old sheet is still dismissing and react-native-screens then drops the next one (RNSScreenStack.mm:481-483); the Jest iOS swipe test sends the two native events in the reverse of their device order, so a device swipe probably answers after the wait), a discard from the confirm sheet closing the form under it, Beli's picker choice, the unsaved guard with a swipe (including the narrow window before `preventNativeDismiss` reaches native), the iOS share toast after a real share, tile layouts at 390pt (two by two with ranges), VoiceOver on the switch, a sheet, a toast, thumbnails and the reading announcement, and everything Phase E left open (the large title and its collapse, the minimizing tab bar, insets under the mood header, swipe back, bar titles at the largest Dynamic Type, the paid swipe guard).

## G4: the development build

Expo Go never shows Catera's splash, icons, predictive back or push. Build a development client (`npx expo run:android`, or an EAS development build if the owner supplies credentials) and check: the native splash and icons on both platforms (light and dark canvases, `imageWidth` 200 against the Android 12 circular mask, which is the first thing to tune), the iOS 18 dark and tinted icons, the hand-off from splash to `LaunchCover`, the real push switch states (on, off, denied after revoking in the phone's settings, and a permission changed while the app is closed), and `device.unregister` on sign-out against a real token. Then run the predictive-back matrix in `docs/PREDICTIVE-BACK.md` on API 34, 35 and 36 (and the hide-on-scroll spike for the Android tab bar) and ship the flag only if every row passes.

## G5: the copy task

This copy predates Phase F. Replace "Anda" with "kamu" and the en dashes in older Dapur copy:

- `apps/caterer/src/import/ImportAssistant.tsx` lines 68, 237 and 243 ("Anda"), and the en dashes in the example placeholder at line 252.
- Other Dapur screens that still say "Anda" to the caterer: `AktifkanScreen.tsx:129`, `TodayScreen.tsx:640` ("Siapkan dapur Anda"), `auth/Daftar.tsx:80`, `PackageEditor.tsx:172`, the hints in `business/money.ts`, `customers/CustomerList.tsx:128`, and `customers/CustomerDetail.tsx:97` ("Pelanggan Anda · dibayar di luar Catera"). **Leave** `customers/CustomerDetail.tsx:69-71`: that message is sent to the customer and correctly says "Anda".
- Check the en dashes in `AktifkanScreen.tsx`, `PackageDetail.tsx`, `menu/logic.ts`; a numeric range such as "29 to 30" in `NutritionFields.tsx` and `package.ts` is a value format the owner may keep.
- Update the matching tests and keep English strings unchanged.

## G6: address delete

No `address.delete` command exists, so Phase F ships no delete and no "Alamat dihapus" toast (the spec listed both). Build the command in a database transaction with tenant authorization (the caller can delete only their own address; an address used by an upcoming delivery or an active plan needs a rule the owner approves first), add the demo implementation, a unit test and a PostgreSQL concurrency scenario, then wire the Alamat row exit (`useListMotion`) and the toast "Alamat dihapus" (no undo; a confirm sheet asks first).

## G7: "Syarat dan privasi"

`apps/customer/src/settings/Pengaturan.tsx:119-120` and `apps/caterer/src/settings/Pengaturan.tsx:118-120` show a "Segera hadir" row with a TODO because `apps/web` has no terms page. Add the page (real terms and privacy text must come from the owner; use a clearly labelled placeholder until then, never invented legal text), then open it in the in-app browser from both rows and remove the TODO.

## G8: Masuk alignment

Task 13 left Masuk with mixed alignment (the waving mascot centred, the rest start-aligned). Decide one alignment with the owner's reference and apply it in both apps' sign-in screens; cover it in `empty-states.test.tsx`.

## G9: the other parked Minors

- **Task 1:** reword the comments at `metro.config.js:6-7` and `jest.config.cjs:2` in both apps (they describe the old hoisted-Reanimated workaround); note in RUNBOOK that the root `package.json` `overrides` pin Reanimated and worklets exactly and must be bumped by hand at the next SDK upgrade; Jest 30 is kept through `expo.install.exclude` against the SDK's 29.7. `expo` and `expo-router` moved from exact pins to tilde (`~57.0.27`, `~57.0.25`) through `expo install --fix`; the lockfile pins the actual version. Record this in RUNBOOK beside the overrides note.
- **Task 2:** add `*` peer dependencies for `react-native-screens`, `react-native-safe-area-context` and `expo-router` to `packages/mobile-ui/package.json`; add `ScreenPresentationContext` (a deep expo-router import) to the upgrade checklist; a test for `MoodHeader` as an iOS `Screen` header; the Android footer anchor following the keyboard; the iOS sheet footer over-clear; detail screens with `headerShown: false` use the toast's fallback anchor, not a measured one.
- **Task 3:** `MascotArt` and the rigs use React Native `Image` where `expo-image` is preferred; `Sparkle` colour is a plain string; `MascotArt` stretches by under 0.4%; `crispMaxSize` is computed from the nominal `subjectPx`, not the measured visible box.
- **Task 4:** count `app_open` only after `me()` confirms (`usage.ts:27-43`); the `act()` warnings added in `shell.test` and `today.test`; the UNAUTHORIZED test should assert no command is sent and the actor key is removed; add the in-flight inactive to active case to the single-`me()` test; the AppState guard is timing-dependent; `TOKEN_REFRESHED` can fire a second `me()`.
- **Task 5:** `stillSignedIn` reads mobile-core's private actor storage (`Beranda.tsx:49-57`); the Jelajah placeholder read keeps hook order; the guard regex spacing; font scale 1.3 on the skeletons; the `inside(heart, node)` tautology at `skeletons.test.tsx:236`; the double blank line at `ReportProblem.tsx:118-119`; the accepted 20pt header difference on sign-in and not-found states.
- **Task 6:** the Pelanggan skeleton lacks the chip row; Hari ini's body skeleton lacks the "Per paket" rows; the no-spinner scan rules are loose (a `photo-spinner` test id substring and "Memuat" literals that end in an ellipsis); `paket/baru` and `[id]` missing-check inconsistency; Menu cold-read residuals (single-meal caption line, the day count when seven days wrap, the empty-kitchen header shrink; keeping the Menu read cached would remove them); the theme guard regex could over-match a non-self-closing `<RefreshControl>`.
- **Task 7:** add a signed-out `{}` payload case to pin the wrapper order; the concurrency scenario cannot prove overlap; a whitespace-only token returns `removed: 0`.
- **Task 8:** Dapur Keluar relies on the root layout swap instead of popping its tab stacks.
- **Task 9:** the sign-in sentence is duplicated (`ReportProblem` and `SignInFirst.tsx:26`); no test for the `leaving` reset (`sheets.ts:209-214`); the finding-3 test reaches an expo-router internal store path; a warm OS link to the same masalah with a typed note now asks "Buang laporan?" (untested).
- **Task 11:** a typed move returns after switching to Gagal diantar plus a swipe; the import phone field saves on blur; the font-scale test is a proxy; Tim bottom padding; the package-row chevron; the parked singleton.
- **Task 12:** nothing beyond the device checks.
- **Task 13:** assert the screen-reader props on a held slot; `bingung` on the Siang Jadwal header; device captures (G2).
- **Task 14:** a one-frame reflow of the tiles before `onLayout` (`NutritionCard.tsx`); the "Gizi per porsi" header is 15/22 while sibling editor headers are 12/23 (`NutritionFields.tsx`); no test for the Dapur gram fields wrapping at font 1.3; a carried gram range clears on the first keystroke if the cursor sits inside it (`package.ts`); `nutrition.test.tsx` has a missing space near "=[full"; the alignment test checks only `alignItems`.
- **Task 15:** the merge cap in `setFiles` is defence behind the slice and the `picking` guard and no test fails without it.
- **Final review M4:** move Pengaturan and its choice sheets (`apps/{customer,caterer}/src/settings/Pengaturan.tsx` and `ChoiceSheets.tsx`) into `packages/mobile-ui` with `voice`, `supporting` and `onSignedOut` props, so a later Pengaturan change cannot land in one app only. They differ only in the voice of two strings, the channel name, the supporting line and the after-logout `goToTab`.
- **T-KL:** `apps/caterer/tests/fixtures.ts:20` `seq` never resets, so ids depend on test order.
- **fix-sheetheader:** the report's SHA and callers list are stale (non-blocking).
- **Release items from earlier phases:** the production photo upload path; "Tercatat sampai" is not reachable in production; the renewal screen's "tepat setelah paket sekarang" (owner decision pending).

## Return contract

Each task returns: commit SHA, tests added or changed with their output, the files touched, and for every device check a PASS, FAIL or NOT VERIFIED with a capture path. Nothing is called verified without a capture or a recorded click-through. When G10 finishes, update the follow-up audit (a new `audit-008-followup-<date>.md`), DESIGN.md, MASCOT-MOTION.md and this file's successor, and commit `docs: Phase G gate`.
