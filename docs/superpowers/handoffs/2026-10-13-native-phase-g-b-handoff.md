# Phase G-b handoff (build, partial), 2026-10-13

G-b stopped early on the usage budget. The weekly limit was at 79% when the session started and 93% when it stopped. Nine of the seventeen plan tasks are merged and reviewed. Next session: **G-b2**. Continue the plan from the open items below. Spec, plan and decisions are unchanged.

## Where things are
- Branch `v2`. G-b started at 456d5bd4. The last build commit is 77fba8d1, and the commit that adds this file sits on top of it (`git log -1 -- docs/superpowers/handoffs`).
- Source of truth: the spec `docs/superpowers/specs/2026-10-13-native-phase-g-design.md` and the plan `docs/superpowers/plans/2026-10-13-native-phase-g.md`. The G-a handoff `2026-10-13-native-phase-g-a-handoff.md` still holds the decisions and the run commands.
- Ledger: `.superpowers/sdd/2026-10-12-native-phase-g/progress.md`, section "G-b build session". It holds the baseline, every review and gate result, and the decisions below.
- Pool: `C:\wt\1`, `C:\wt\2`, `C:\wt\3`. Briefs and logs are in `C:\wt\logs-g\` (`brief-common.md`, `brief-review.md`, `brief-gate.md`, plus the check logs).
- Gate captures: `output/native-review/phase-g/gates/g7-g1a/` and `output/native-review/phase-g/gates/g1b/`. They are not committed.
- Demo backend: restarted on the fresh dir `.data/phase-g-b-1`. The old G-a database predated the G3/G4/G5 migrations, which load only when the database is created.

## What shipped (merged into v2; each had an Opus review, reached CLEAN and passed post-rebase checks)
| Task | Commits | Notes |
|---|---|---|
| G17a shared Pengaturan | 37e6636f | `Pengaturan` and the choice sheets now live in mobile-ui, with an `extraRows` slot between Tentang and Keluar. The customer Tampilan note still passes `voice="Anda"`, which G18 flips. |
| G3 delivery arrive | abc9a6f3, a4cff03a | `delivery.arrive` with proof photos (private bucket `catera-v1-proof`, `/api/uploads/proof`, `/api/proof`), subset `delivery.depart`, and `v1.auto_confirm_arrived` (2 h, holds on the caterer pilot lock). Staff can no longer set `delivered` through either status command. The trigger clears the arrival on `issue` or a new departure. Domain stage is `arrived`/`arrived_unconfirmed`. The web workspace has "Tandai sampai", today only. |
| G1a | 248123cd, 98bdbf1e | Numeric transform origins in MascotReading **and SuccessRig** (the same crash), with a test using RN's `processTransformOrigin`. Impor has the "Baris dihapus" / "Urungkan" toast and a safe undo after a save. |
| G7 palette K and motion | 98af208e, 15413164 | Token tables, motion 200/340/440/680 with web parity, Sunrise guard, MalamPattern deleted. Dark `forestDeep` is #7FB093. The light tab pill is #D3CEC1 and the dark one #444441. The brand Card tone is removed. |
| G4 account commands | a8692d88, 797d7088 | `profile.update`. mobile-core gains `updateProfileName`, `sendPhoneChangeCode` and `verifyPhoneChangeCode` (on the mobile Supabase session), `requestEmailChange`, `changePassword({current,next})` (email read from `getUser`, `ACCOUNT_MISMATCH` guard), `requestAccountDeletion` (once per open request, receipt-safe), `requestHelp` and `listAccountRequests`. Errors are typed as `AccountErrorCode`. |
| G5 push at the event | 6c6e57d2, 2547d9be | DB triggers push Dimasak, Berangkat, Sampai, Gagal diantar (opens `/deliveries/<day>`) and Pindah tanggal by the caterer. A redelivery gets a per-trip key. Titles are "Catera Dapur" and "Catera". The root `app.json` EAS fallback is removed. RUNBOOK §14 has the hosted `pg_cron` backstop. |
| G6a busy and errors | 239f0619, 4e3aabb9 | `Button busy` (150 ms), `useBusy`, `FormError({message, retry?, failureKey?})`, `ConnectionBanner` (shows only while NetInfo says offline), shared `ReadError`, netinfo 12.0.1. The loose-danger scan has a strict ratchet table `LEGACY_BARE_ERRORS` (39 files) that G8 and G9 must shrink. |
| G1b sheet focus | d9c7b02f, c0ae2b46 | `SHEET_FOCUS_FALLBACK_MS` 400 and `SHEET_FOCUS_SETTLE_MS` 250. The demo strip and the iOS tab host are hidden while a focused sheet is on top. The `SheetBody` reserve is `androidTabBarHeight(fontScale)` plus the inset. **The emulator gate FAILED**, see below. |
| G6c four-stop tracker | bb4fc11a, 6286fa1f, e446132e, 77fba8d1 | Four stops with glyphs, `arrived_unconfirmed` half fill, `issue` reads "Gagal diantar". No motion on first paint or on a session switch (CountCard keyed by `date:meal`). Labels fit a 64dp column in English. The emulator gate has not run. |

## Update, 2026-10-14 (resumed session, Sonnet-first ladder)
- **Merged:** `task-G6b` (CalendarSheet plus the fixes in 8c6d7d12; re-review CLEAN) and `task-G7gate` (gate fixes, rounds 1 and 2; re-review CLEAN). v2 head is 4f307e7b.
  - `task-G7gate` fixes: the demo strip is canvas with muted text. The failed hero photo ground is `photoGround`. Headings, titles and labels are charcoal. Impor delete runs after the sheet closes. Calendar cells are neutral. Forest text needs a line-scoped `forest: selection|action|accent` marker. Unselected chip labels are charcoal. `returning` is cleared on quiet reads.
- **Built, not reviewed or merged:** `task-G1b2` in C:\wt\2 (ebf82876, Sonnet attempt 1).
  - Step A found no option-only fix. react-native-screens 4.26.2 `DimmingViewManager.kt:30` adds a clickable dimming view on every present (lines 156-166).
  - Step B moved the forms with fields to root-stack sheets: `masalah/[id]`, `ubah-hari/[id]` (which hosts the CalendarSheet), `ulasan/[id]`, `alamat-form` and `bantuan-form`. Links still work through `nav.ts` `isRootSheet`/`openInTab`.
  - **Risk:** the dimming view is added for root-stack form sheets too, so TalkBack may still land on it.
  - Next session: rebase it on v2 (expect conflicts in ChangeDaySheet and the moved route files), run an Opus review, then re-run the full g1b gate. The reproduction steps are in the ledger. If focus still fails, report to the owner: no JS-only route is left without a development build or a native patch.
- **Later on 2026-10-14 (owner: "continue till 98%, then build the two APKs"):**
  - `task-G1b2` was merged as 3badae44 after three Sonnet attempts and Opus reviews. The re-gate `g1b-2` (captures in `output/native-review/phase-g/gates/g1b-2/`) passed on focus: TalkBack lands on the title for Ada masalah and Ubah hari.
  - It failed on one thing: "Kirim laporan" sits about 17px off-screen, under the gesture bar, at the form detent.
  - **Unmerged fix:** `task-G1b3` in C:\wt\2 (7d4dc2b2, Sonnet attempt 1). Root cause: react-native-screens lays out a two-detent sheet at its tallest detent, so the `flex:1` ScrollView never scrolls at 0.6. The fix measures the part of the sheet below the screen edge and shortens the body by that much (`SheetHeader.tsx` `useSheetHiddenBelow`). It needs an Opus review and an emulator check before merging.
  - Side findings: the tab-stack "…" action sheet still focuses its dimming view under TalkBack, which needs an owner call (Android `presentation: "modal"` or patch-package). A dev-only require cycle `Plate.tsx` <-> `schedule/dayActions.ts` shows a LogBox warning.
  - **APKs** (release, debug-signed, arm64-v8a, UAT env from `C:\wt\uat-mobile.env`), built from 3badae44: `output/apk/catera-customer-uat-arm64-v8a-20261014-3badae44.apk` and `output/apk/catera-dapur-uat-arm64-v8a-20261014-3badae44.apk`. Build with `C:\wt\logs-g\build-apks.sh`.
  - Android Studio's JBR is now JDK 25, and its restricted-method warning breaks the react-native-worklets CMake step, so the script uses Gradle's JDK 17. The hosted UAT backend does not have the G3, G4 and G5 migrations yet, so arrive, the account callers and the new pushes will fail against it until they are applied.
- **For G18 or the final gate:** `Plate.tsx:276` (card `ink = c.forest` on unselected reaction labels) and `ChangeDaySheet.tsx:408` (forest ink on unselected date chips) still use forest. The scan cannot see colours passed through variables.
- The customer `empty-states` baseline fails intermittently, 1 to 3 tests per run.
- Weekly usage was 97% at the final stop on 2026-10-14.

## Gate results
- **g7-g1a (G7 and G1a):** 102 sampled colours match the tokens. The Sunrise spend, the pill, reduced motion and audit rows 9-01 to 9-26 pass except 9-07, 9-24 and 9-25, which `task-G7gate` fixes. The gate also found forest used as heading text, also fixed there. G1a passes: no crash, the undo toast works, TalkBack received "Baris dihapus, Urungkan", and SuccessBeat does not crash. NOT VERIFIED: audible TalkBack speech and the Paket selesai disc (no demo route reaches it).
- **g1b: FAIL at check 1.** After a real TalkBack double tap on Ada masalah, focus lands on an unlabelled full-area clickable ViewGroup. This is the react-native-screens formSheet backdrop, the first child of the sheet container. `sendAccessibilityEvent(focus)` on the title has no visible effect, either at `transitionEnd` or after the settle. With TalkBack on, the form's content was also clipped at the tab bar top. Checks 2 to 5 were not run.
  - **Decision for G-b2 (spec 4.1 fallback, pre-agreed in the spec):** first try making the backdrop not important for accessibility, if react-native-screens 4.26 exposes it. If it does not, move the tab-stack forms that have fields (Ada masalah, Alamat, review, Ubah hari, and the calendar from G6b) to root-stack sheets the way `impor-baris` is. Choice, action and confirm sheets stay native. Then re-run the g1b gate in full.
- G6c and G6b gates have not run yet. Their reproduction steps are in the ledger (the G6c builder's gate steps).

## Not started (plan order for G-b2)
G13 (Opus first build), G15, then G8 and G9 (they need G6b merged and the G1b fallback settled), then G18, G17b and G20. Every remaining dependency for G8 and G9 except G6b is merged.

## Open risks and notes
- **Baseline:** `npm test` has 2 date-dependent `tests/push-timing.test.ts` renewal failures, and customer Jest has 3 `tests/empty-states.test.tsx` failures. Both pre-date G-b and are unchanged.
- **Accepted edge (G5):** if package A re-departs and package B in the same group fails at the same moment, B's Gagal diantar push can be silent.
- **EAS ids (spec 14.8):** the removed root id was `f5259168-4993-48b8-9071-a25cfe03ca7b`. The customer config uses `17010cc0-…` and Dapur uses `1c3f597c-…`. The owner confirms which are real. Never invent credentials.
- **Dapur calendar availability read:** still unresolved; G9 decides it.
- **Main-tree environment:** the main tree needed `npm install` for netinfo (the lockfile did not change). The classifier blocks subagents from stopping long-running dev servers, so the controller restarts the backend and Metro.
- `graphify-out/` appeared untracked in the main tree. Do not stage it.
- Skills: from 2026-10-17 the only design skill is `ui-ux-pro-max` (plus `humanizer` for copy); see SL-UI in the Phase G plan. The antislop-contrast MCP failed to connect, so ratios were computed by script.

## Next step: the G-b2 session (state on 2026-10-17)
State: v2 is at 797f7c2d, the weekly limit reset to 0%, and nothing is pushed. `task-G7gate`, `task-G6b` and `task-G1b2` are merged. The pool worktrees are clean (C:\wt\1 and C:\wt\3 detached at v2, C:\wt\2 on `task-G1b3`). The demo backend on :3000 and Metro on :8081/:8082 may still be running from the last session. Check before restarting; use a fresh `CATERA_DEMO_DATA_DIR` if you restart.

Models (owner rule from 2026-10-13, memory `catera-usage-aware-execution`): each task gets up to 3 Sonnet attempts (resume the same agent for attempts 2 and 3), then one fresh Opus escalation. Reviewers and emulator gates are Opus. Never use Haiku. Record each task's attempt count in the ledger.

Steps, in order:
1. Record the start usage in the ledger.
2. `task-G1b3` (7d4dc2b2): Opus review, rebase, merge. Then run a focused gate: "Kirim laporan" fully visible above the gesture bar at the form detent, at font scale 1.0 and 1.3, and again after expanding. Check the other moved sheets too.
3. Ask the owner about the tab-stack "…" action sheet, which still sends TalkBack focus to the react-native-screens dimming view. The options are an Android-only `presentation: "modal"` (a visible change) or a patch-package on `DimmingView` (a dependency change).
4. Run the emulator gates for G6c (the tracker in every stage, the Dapur count card, labels at 360dp and font scale 1.3) and G6b (the calendar at 360dp and 1.3, TalkBack on the cells). The reproduction steps are in the ledger.
5. Build G13 and G15 (no dependencies), then G8 and G9 (every dependency is merged), then G18, G17b and G20, each with the plan's gates. G8 and G9 also shrink `LEGACY_BARE_ERRORS`, pass `failureKey` to `FormError`, and mount `ConnectionBanner` per its header contract.
6. Rebuild the APKs with `C:\wt\logs-g\build-apks.sh`; it uses JDK 17. Write the final G-b handoff with the full gate results and the Phase H kickoff (plan G20).
