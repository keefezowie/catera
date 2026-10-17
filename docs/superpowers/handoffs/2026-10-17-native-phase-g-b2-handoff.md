# Phase G-b2 handoff (build complete, gates owed), 2026-10-17

Every remaining Phase G build task is merged. The emulator gates did not run, because the emulator went offline and the environment blocked an agent from restarting it. Next session: **G-c**, which runs the gates, then G20 and the APKs.

## Where things are
- Branch `v2`. G-b2 started at 77cd53c6. The last build commit is bb044f66; the commit that adds this file sits on top of it. Nothing is pushed.
- Source of truth (unchanged):
  - spec `docs/superpowers/specs/2026-10-13-native-phase-g-design.md`
  - plan `docs/superpowers/plans/2026-10-13-native-phase-g.md`
- Ledger: `.superpowers/sdd/2026-10-12-native-phase-g/progress.md`, section "G-b2 build session". It holds every review, the attempt counts and the decisions.
- Pool worktrees `C:\wt\1`, `C:\wt\2` and `C:\wt\3` are clean and detached at v2. Briefs are in `C:\wt\logs-g\` (`brief-common.md`, `brief-review.md`, `brief-gate.md`).
- Usage: weekly went from 0% to about 15% this session. Context reached 343k.

## What shipped this session
Each task had an Opus review and reached CLEAN, or minor-only findings checked by the controller.

| Task | Commits | Attempts | Notes |
|---|---|---|---|
| G15 Syarat dan privasi | fcb64a88, b5d2587c | 2 Sonnet | The web page `/syarat-dan-privasi` (`#syarat`, `#privasi`) is labelled a placeholder. Dapur opens it with `Linking.openURL` because it has no expo-web-browser. The shared Pengaturan takes `openWebPage`. BuyParts' terms link is repointed. |
| G1b4 "…" sheet TalkBack | c704d2f4 | 1 Sonnet | Owner decision: patch-package. Root devDependency `patch-package` 8.0.1 plus `postinstall`. `patches/react-native-screens+4.26.2.patch` sets the DimmingView to not important for accessibility. A test fails if a screens bump drops the patch. |
| G1b3 form sheet reach | c2c02d68, 991cb5f1, 5a5475e8 | 3 Sonnet | `SheetHeader.tsx` `useSheetHiddenBelow` measures against `useSafeAreaFrame`. It re-measures on window changes and runs only outside the tabs. |
| G13 address delete and move | 345bf940, 62e30279, abb339e7 | Opus build + 1 Opus fix | Migration `20261014120000` adds `archived_at`, `address.delete`, `address.replace` and the `address-use/{id}` read. Imports refuse removed addresses. Lock order: caller, `pilot:`, row. COVERAGE uses the live offer. Includes PostgreSQL races. |
| G8 customer screens | c916745b, 2085c13b, c91b4144 | 3 Sonnet | Busy buttons and `FormError`/`ReadError` everywhere. ConnectionBanner and `StaleCopy` (online read failure). CalendarPanel in Ubah hari (large detent). Data akun page and the Hapus akun root sheet. Arrived-unconfirmed hero with the proof photo. The customer `LEGACY_BARE_ERRORS` rows are gone. |
| G9 Dapur screens | f59710ba, f5ef07fc, 922674b4, 9927b67c | 3 Sonnet + 1 Opus escalation | Selection mode, the proof-photo grid, Pindah tanggal as a root-stack calendar sheet, error toasts for non-form failures, Data akun, Hapus akun. The tab-to-root hand-off waits for the tab stack's `onFinishTransitioning` (`handoff.ts`), with a 1 s fallback. `deliveryAvailability` serves staff. `LEGACY_BARE_ERRORS` is now `{}`. |
| G17b parked minors | 56efae39, 82b2e9fc | 2 Sonnet | Fixed the v2 baselines: native-font-weights, the empty-states mascot timing, the selection-mode flake. `app_open` counts only after `me()` answers. The `useUnsavedGuard` leaving reset gained a catch and a test. The no-spinner scans are now tag-keyed. Covered the gram range, the act() warnings and the RUNBOOK toolchain checklist. |
| G18 copy pass | a8ca0695, d2a98101, bedf4d0e, 2bd750d0, bb044f66 | 3 Sonnet | Applied the spec 6 table and added `tests/copy-scan.test.ts`. Migration `20261014130000_push_copy.sql` patches live push bodies (`v1.push_day`) and checks anchors and retired fragments. Status `issue` reads "Gagal diantar". The renewal line is weekday-aware and names the blocking plan, or shows the plain start for a completed plan. The empty-states clock is pinned. |

Test state on v2: npm test 1038/1038, customer Jest 1411/1411, caterer Jest 593/593, typecheck, build and test:postgres all pass. The old baseline failures are fixed. The G18 post-merge `test:postgres` passed.

## Skill line change (seen at the end of this session, not made by it)
Two files in the main tree have uncommitted edits made outside this session:
- `docs/superpowers/plans/2026-10-13-native-phase-g.md` lines 7-9: SL-UI now names only `ui-ux-pro-max`. The other design skills are retired as of 2026-10-17. SL-COPY is that skill plus `humanizer`. Data tasks carry no design skill.
- The G-b handoff's Skills line, to match.

Every G-b2 agent used the old skill list. G-c should confirm the change with the owner, commit it if it is theirs, and brief agents with the new SL-UI line.

## Decisions this session
- The tab-stack "…" action-sheet backdrop is fixed with a patch-package patch, not an Android `presentation: "modal"` (owner).
- Data akun is a page with inline editors, opened from the first row of Akun and from Pengaturan `extraRows`. Hapus akun is a root form sheet.
- The departure line "dapat notifikasi saat kamu berangkat" stays, per DESIGN.md C5. The move line is spec 5.5's "Pelanggan yang memakai aplikasi diberi tahu."
- Out of scope, left for a web pass: apps/web strings ("Silakan", "Hubungi katerer", the claim page) and the RowEditor ISO date field (FB6).

## Environment, owner action needed first
1. **The emulator is offline.** A gate agent's `adb reboot` left `emulator-5554` offline, and the classifier blocks agents from killing it. Owner runs: `adb -s emulator-5554 emu kill`, then `emulator -avd Catera_Pixel8_API36 -no-boot-anim -no-snapshot-save -gpu auto`.
2. **The backend needs a fresh data dir.** G13's and G18's migrations load only when the database is created. Owner stops the backend on :3000 (agents are blocked from doing it) and runs `CATERA_V1_DEMO=true CATERA_DEMO_DATA_DIR=D:/Project/Catera/catera/.data/phase-g-c-1 npm run dev`.
3. Metro may still be running on 8081 and 8082 from gate g-b2-1. Restart with `--clear` if bundles look stale.
4. Gate APK: `output/apk/gate-g-b2-1-catera-customer-uat-arm64-v8a-abb339e7.apk` (UAT env, patch applied) is built from abb339e7, so rebuild it from the current v2. Release builds refuse cleartext HTTP, so a release APK cannot reach the local backend.

## Next step: the G-c session
Same rules apply:
- Record the ledger usage %.
- Quiet controller.
- Sonnet-first ladder: 3 Sonnet attempts, then one Opus. Opus reviewers and gates.
- Stage by explicit path.
- Ask before pushing.

Steps:
1. Confirm the owner restarted the emulator and the backend (above). Record the start usage.
2. Run the gate that g-b2-1 could not, with the same checks (its brief is in this ledger's g-b2-1 line):
   - A: G1b3 reach on every root-stack form sheet at 1.0 and 1.3, the large detent and the keyboard, plus TalkBack title focus.
   - B: G1b4 TalkBack on the "…" sheet, on a release APK rebuilt from v2.
   - C: G6c tracker.
   - D: G6b calendar.
3. Gate G8 and G9 per the plan's States lists, and G13's Alamat flows. Then gate G18 per the plan: Android captures of the changed copy in both languages.
4. Device checks owed:
   - G9: tap Pindah tanggal while the stop sheet is still presenting; the calendar must open, not be dismissed with the sheet. Also the camera and proof upload on the gate APK.
   - G8: the proof photo across the `/api/proof` 302 (production only) and TalkBack focus on the Data akun editors.
   - G17b final-gate list: the mascot expo-image swap and stretch, crispMaxSize, the Sparkle colour, the nutrition one-frame reflow, the Menu cold-read residuals, the Android footer anchor and the iOS sheet over-clear (no Mac, so NOT VERIFIED).
5. Fix gate failures through the ladder.
6. G20 (plan lines ~479+): gate prep, the DESIGN.md pass (one Opus dispatch; Doc facts are in the ledger and the builders' returns), and the Phase G handoff with the Phase H kickoff.
7. Rebuild the APKs with `C:\wt\logs-g\build-apks.sh` (JDK 17). The script does not run `npm ci`, so first confirm the patch is applied in the main tree: `grep IMPORTANT_FOR_ACCESSIBILITY_NO node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt`.
8. The hosted UAT backend still lacks the G3, G4, G5, G13 and G18 migrations.

## Open risks
- G9 hand-off edge (NEEDS DEVICE): a tap during the stop sheet's present animation can fire the hand-off early. Also, the four tab stacks share one settle signal within 1 s; this is negligible, and blur cancels the hand-off.
- G13: an archived-address NOT_FOUND from the import wrapper fires before the ownership check. The ids are UUIDs, so this leaks almost nothing.
- The 20261014130000 migration patches function bodies dynamically, following the 20261014110000 precedent. A production database whose bodies differ fails loudly on its post-checks, which is intended.
- EAS project ids (spec 14.8) are still unconfirmed by the owner.
- `graphify-out/` and `catera-phase-f-artwork.zip` are untracked in the main tree. Never stage them.
