# Context: Catera Dapur layout rethink (fresh session)

Read this whole file first. It carries everything the previous session learned doing the same job for the customer app (October 22-24, 2026), so you can repeat the process for the caterer app, **Catera Dapur** (`apps/caterer`), without re-deriving it.

## 1. The goal

The owner wants the same layout rethink the customer app just got, now for Dapur: **layout only** (sizing, spacing, density, hierarchy, placement of modules, moving content between screens). Not colour, not palette, not artwork, not naming, not concept, not server rules. The four Dapur tabs and their names stay (Hari ini, Pelanggan, Menu, Usaha; staff see only Hari ini and Menu via `tabsForRole`).

Dapur is a **work app**, not a browsing app. Its dials are ENERGY 1 / RHYTHM 1 / MOTION 1 plus press micro-feedback (DESIGN.md:470): "kitchen operations are restrained and denser; rows and money totals stay still". Expect the right answer to be denser than the customer app, not a copy of it. The design-taste-frontend app-screen rules (`references/app-screens.md`) were written for exactly this kind of screen (queues, lists, settings, money) and fit Dapur better than they fit the customer app.

## 2. Ground rules (owner, standing)

- Work on branch `v2` in the main tree `D:\Project\Catera\catera`. AGENTS.md, PRODUCT.md and DESIGN.md (palette K section "Colour revision (Phase G), October 2026") apply.
- Never stage: `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `output/verification/postgres.json`, `.claude/`, `graphify-out/`, `catera-phase-f-artwork.zip`. Stage by explicit path. Commits end with the session's Co-Authored-By line; never put a model name in files. Don't push unless asked.
- **Skills:**
  - Design: `ui-ux-pro-max`, plus `design-taste-frontend` (the owner's exception for layout work; confirm with them that it still applies to Dapur). Read its `references/app-screens.md` in full for Dapur, not only sections 2.2 and 7.
  - Copy: `humanizer`.
  - Process: superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, `requesting-code-review` / `receiving-code-review`, `systematic-debugging`, `verification-before-completion`).
  - Retired, never invoke: `building-native-ui`, `antislop:*`, `apple-design`, `material-3`, `impeccable`. The SDD skill's implementer template still mentions antislop; replace that line with the SL-UI line in every dispatch.
- **Models** (owner rule, memory `catera-usage-aware-execution`):
  - Builders are Sonnet, up to 3 attempts each: attempt 1 builds; attempts 2 and 3 resume the same agent with the review or check output.
  - After 3 failed Sonnet attempts, one fresh Opus agent gets all three failure reports. If that fails too, stop and report to the owner.
  - Every reviewer, re-reviewer, emulator gate and the DESIGN.md writer is Opus. Never Haiku. Set `model` on every dispatch.
  - Only gate agents drive the emulator.
- **Quiet controller:** no idle status turns, read return contracts not report files, run checks in the background, keep the controller's context small (hand files over by path).
- **One session per phase.** Compact or hand off near 150k context. Write a handoff file at the end.

## 3. The process that worked (customer app, Oct 22-24)

1. **Research and audit**, written to `docs/superpowers/research/`.
   - Capture "before" screens: 1080x2400 PNGs plus contact sheets in `output/native-review/layout-<date>/before/`.
   - Run a code inventory by a Sonnet Explore agent: tokens, components, every hard-coded size, a per-screen order with fold estimates, inconsistencies.
   - Do Mobbin research. Domain apps for Dapur: kitchen display, restaurant back-office, delivery driver, POS. Look at Toast, Square, GoFood/GrabFood merchant, Shopify POS, Uber Eats Manager, DoorDash Merchant, Deliveroo Hub; plus cross-industry work apps (Linear, Todoist, Stripe dashboard, Monzo business).
   - Write a synthesis: audit tables, consensus patterns with numbers, proposed scale, screen directions, open questions for the owner.
   - The customer synthesis is the template: `docs/superpowers/research/2026-10-22-layout-synthesis.md`.
2. **Owner answers the open questions.** Record them in the synthesis.
3. **Canvas artifact.**
   - Start it with Artifact `quickstart`, intent `design`. That gives the Design type, a canvas of `.dc.html` artboards plus `project/canvas.json`, with a shared `project/catera.css`.
   - Layout: before = the real captures as uploaded JPEGs with red "Masalah" tags; after = HTML mocks at 412dp built on the scale.
   - Measurement layer: blue tags, margin bands, a fold line at 820 (916 − 96 tab bar), and per-board tweaks for Ukuran (show measurements) and Margin.
   - Use real demo dish photos from `apps/web/public/assets/food/*.png` (shrink them to JPEG with the repo's `sharp`).
   - The customer canvas, for reference: https://claude.ai/artifact/9xLxNe1qsVGA7QH6TWaWrT. Its source is gone from the scratchpad, so read files from the artifact if you need them.
4. **Owner picks** the options on the canvas.
5. **Spec** in `docs/superpowers/specs/YYYY-MM-DD-dapur-layout-design.md`, then the **plan** in `docs/superpowers/plans/` (writing-plans header, skill lines SL-UI/SL-SP, Global Constraints, Review Focus, tasks with Files/Interfaces/Depends on/Builder/States).
   - Templates: `docs/superpowers/specs/2026-10-23-customer-layout-design.md` and `docs/superpowers/plans/2026-10-23-customer-layout.md`.
6. **Subagent-driven execution.**
   - Ledger: `.superpowers/sdd/<plan>/progress.md`, git-ignored, holding the baseline, the preflight table, rulings, and fix rounds.
   - Pool worktrees: `C:\wt\1`, `C:\wt\2`, `C:\wt\3`, each currently detached at v2. Per task: `git -C <wt> switch -c task-X v2`. Reinstall only if `package-lock.json` changed.
   - Run at most 3 builders at once. Each task branch rebases onto v2 and merges `--ff-only`.
   - Review each task with Opus, then run scoped re-reviews of the fix diffs.
   - **Incremental emulator gates** as groups of screens merge. Route each failure back to the owning task as a fix batch.
   - Then a final gate, a final whole-branch review, one fix wave, a re-check of the fixes, the DESIGN.md section and the handoff.
7. **APK** when the owner asks (section 9).

## 4. What the customer pass built that Dapur can reuse

- `packages/design-tokens/src/index.ts` exports `nativeLayout`:
  - space 4/8/12/16/24/32/48; margin 16; sectionGap 32, headingGap 12, groupGap 8, cardPadding 16;
  - radius thumb 8 / control 12 / card 16 / sheet 24;
  - controls: button 50, field 50, search 44, chip 34 (44 hit area), icon 44;
  - rows: 56 single / 72 media / 40 key-value / 48 info; thumbs 56/64; ratios hero 4:3, card 16:10, tile 4:3.
- `packages/mobile-ui/src/layoutScale.tsx` provides `LayoutScaleProvider value="classic"|"v2"`, `useLayoutScale()` and `useScreenMargin()` (16 under v2, 20 under classic).
  - The customer root provides `v2`. **Dapur provides nothing, so it is still `classic`.** Every shared change was gated on `v2`, and `apps/caterer/tests` pin classic geometry (for example `layout-classic.test.tsx`, plus a MoodHeader 48-row test in `menu.test.tsx`).
  - Decide early whether Dapur opts into `v2` as is, or gets its own value (e.g. `"dense"`). Opting into `v2` changes all of these at once for Dapur: Button (50, fully round), Chip/Segmented (34), Field (50), Card (no border, radius 16, padding 16), Screen margin (16), the MoodHeader top row (44, with a `plain` mode), ScreenFooter (canvas fill, no hairline, bottom inset on root-stack screens) and the Stepper (44 round buttons, ink glyphs).
- Text variants in mobile-ui (the existing ones are unchanged): `largeTitle` 32/40/700/-0.8, `heroTitle` 24/30/700/-0.4, `section` 20/26/700/-0.2 (header role), `rowTitle` 17/22/600, `bodyL` 15/22/400, `bodyStrong` 15/22/600, `meta` 13/18/400 muted.
- Customer-only blocks in `apps/customer/src/layout/`: SectionHeader, ListCard, MediaRow, GlyphRow, Thumb, `rowLabel`, `metrics.ts`, DecorativeIcon. Plus `today/HeroPhoto.tsx`. If Dapur needs the same blocks, **move them to `packages/mobile-ui`** (or a shared folder) instead of copying them, and keep the customer imports working.
- DESIGN.md "Customer layout scale (October 2026)" (about lines 1032-1190) records the whole contract and every ruling. Read it.

## 5. Lessons (each one cost real time last time)

**Environment**
- **Metro:** start it in the background from the app folder, for example:
  `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --go --clear --port 8081 < /dev/null`.
  - **Never set `CI=1`**: reloads are then off and the gate captures a stale bundle. That cost a whole gate run.
  - Check that Metro's log has no "CI mode" line.
  - Metro grew to an 8 GB heap and crashed after about 3 hours, likely from watching folders that change constantly (the demo Postgres data under `.data/`, captures under `output/`). Before Dapur's gates, add a `resolver.blockList` / watcher exclusion in `apps/caterer/metro.config.js` (and customer's) for `.data/`, `output/`, `graphify-out/` and `.superpowers/`, or keep the demo data dir outside the repo. Use a different port for Dapur if customer Metro also runs.
- **Demo backend:** `CATERA_V1_DEMO=true CATERA_DEMO_DATA_DIR=.data/layout-gate npm run dev` (a copy of `.data/phase-g-c-4`, so the owner's data stays untouched). It may still be running on :3000; check with curl first.
- **Never `taskkill /IM node.exe`.** A builder did it and took down the owner's backend and other agents' runs. Put "never kill processes you did not start; stop only your own PID" in every dispatch.
- **Emulator:** `Catera_Pixel8_API36`, emulator-5554, 1080x2400 at 2.625 px/dp, Expo Go only.
  - Boot it with `emulator -avd Catera_Pixel8_API36 -no-boot-anim -no-snapshot-save -gpu auto` and `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`.
  - Helpers: `source output/native-review/phase-g/scripts/adb.sh` (A, cap, tap, ui, tapt) and `node output/native-review/phase-g/scripts/contact-sheet.cjs`.
  - Variants: 360dp is `wm size 945x2100`, font scale is `settings put system font_scale 1.3`, dark is `cmd uimode night yes`. Always reset afterwards.
  - Dapur demo sign-in: "Masuk sebagai pemilik" / "Masuk sebagai staf dapur" (`apps/caterer/src/auth/Masuk.tsx:145`). Capture both roles, since staff see fewer tabs.

**Process**
- **Rebase conflicts were constant** in shared skeleton files and shared test files: customer `skeletons.tsx` / `skeletons.test.tsx`, `navigation.test.tsx`, a shared `Skeleton` prop added twice.
  - Assign section ownership in the plan.
  - When a rebase conflicts, `git rebase --abort` and have the task's own builder rebase and rerun its tests.
  - Always diff against the task's real base when building a review package. One package once silently included a reversal of a later merge.
- **Run root `npm test` (vitest) in every task.** `tests/native-font-weights.test.ts` fails when native source writes `fontWeight` directly; use `fontFor()` or the Text variants. Three tasks broke it because only Jest ran.
- **Gate agents must confirm the head is live** before capturing (force-close Expo Go and reopen), and must never start their own Metro.
- **Fix agents overwrote the gate report file.** Tell fixers to write only their own report file.
- **The canvas is the visual contract the owner approved.** Where the written spec was silent or vague, reviewers held builders to the canvas. Where real data broke the canvas (the customer hero with a tracker and actions was far taller than the mock), the controller made a ruling and recorded it.
- Expect these to fail on the first emulator gate even when Jest is green:
  - touch targets clipped by a parent (`hitSlop` cannot reach past a parent's bounds; horizontal ScrollViews clip);
  - tab-stack form sheets drawn under the native tab bar (react-native-screens 4.26; fixed by moving the sheet to the root stack);
  - Yoga sizing a negative margin on an `aspectRatio` box from its height;
  - fold arithmetic done with wrong inset numbers (status inset is about 50dp, tab bar 80 + 24 inset; the demo strip costs 24dp);
  - pager pages stretched to the tallest page;
  - TalkBack labels built from icon glyph Text nodes (empty parts like ", Data akun, ").
- Customer baseline failure (still present): `apps/customer/tests/customer-sheets.test.tsx` "outcomes › moving a day toasts the new date" derives its dates from the real clock. Cite it; don't debug it. Record Dapur's own baseline before Task 1.

## 6. Dapur app map (starting points; verify with the inventory)

- Routes (`apps/caterer/app/`):
  - Tabs `(tabs)/(index,pelanggan,menu,usaha)/`: `index` (Hari ini), `pelanggan`, `pelanggan/[id]`, `menu`, `menu/[date]`, `usaha`, `paket/[id]`, `paket/baru`, `uang`, `tim`, `sampai`, `atur-antaran/[id]`, `balas/[id]`, `laporan/[id]`, `pengaturan` (+ bahasa, data-akun, hapus-akun, tampilan).
  - Root: `aksi`, `aktifkan`, `impor`, `impor-baris`, `impor-foto`, `konfirmasi`, `pindah-tanggal/[id]`.
  - Auth: `(auth)/masuk`, `(auth)/daftar`.
- Source (`apps/caterer/src/`):
  - `today/`: TodayScreen, CookingList, DeliveryOrder, SessionCard, SelectionBar, ExceptionSheet, MoveSheet, ProofSheet, ReportScreen. This is the busiest, most-used screen.
  - `menu/`: MenuWeek, MenuDayScreen, SlotEditor.
  - `customers/`: CustomerList, CustomerDetail.
  - `business/`: UsahaScreen, UangScreen, TimScreen, PackageEditor, PackageDetail, AktifkanScreen.
  - `import/`: ImportAssistant, RowEditor, PhotoViewer.
  - `settings/`: Pengaturan, DataAkun, HapusAkun.
  - Also `skeletons.tsx` and 40 test files in `apps/caterer/tests`.
- DESIGN.md has many Dapur rules from Phases A-G: the Hari ini count card (the Dapur hero with the forest hero button), the daily-loop checklist ("Mulai masak", "Berangkat antar", "Semua beres"), kitchen truth ("Menu belum diisi …" lines), delivery order, the proof photo, and per-stop Berangkat and Sampai. They are behaviour. Keep every one, and only move geometry.

## 7. First steps for the new session

1. Invoke `using-superpowers`, then `brainstorming`. Confirm the scope with the owner in one message:
   - Dapur only, layout only.
   - Which screens matter most: the likely order is Hari ini, Menu, Pelanggan, Usaha/Uang, the sheets, then import.
   - Whether `design-taste-frontend` still applies.
   - The density stance: denser than customer?
2. In parallel:
   - a Sonnet Explore code inventory of `apps/caterer` (write it to `docs/superpowers/research/<date>-dapur-layout-inventory.md`);
   - two Mobbin research agents (merchant/kitchen apps and cross-industry work apps);
   - the "before" captures of every Dapur screen in both roles, light, after fixing the Metro watch exclusions.
3. Write the synthesis with open questions. Typical ones:
   - opt into `v2` or a denser scale;
   - Hari ini's dominant module;
   - what moves between tabs;
   - list density and row heights for long queues;
   - which money totals stay still.
4. Build the canvas, then follow sections 3 and 5.

## 8. Customer-pass record (for reference, not to redo)

- Spec: `docs/superpowers/specs/2026-10-23-customer-layout-design.md`. Plan: `docs/superpowers/plans/2026-10-23-customer-layout.md`.
- Handoff, with all 20 rulings and the deferred minors: `docs/superpowers/handoffs/2026-10-23-customer-layout-handoff.md`. Read its rulings list to see the kind of decisions this work forces.
- Ledger and gate reports: `.superpowers/sdd/2026-10-23-customer-layout/`. Captures: `output/native-review/layout-2026-10-23/{gate1,gate2,final,recheck}`.
- v2 head after the customer pass: `57155566` (docs on top of code `709e08a8`).
  - Checks at `709e08a8`: typecheck, Vitest 1044/1044, customer Jest 1726/1727 (baseline only), caterer Jest 618/618, build pass.
- Open from the customer pass, not for this phase unless the owner asks:
  - the owner's device review of the Beranda hero (a 16:10 photo, the card at 54-76% of the first screen);
  - the deferred minors in the handoff;
  - the Metro watch exclusion (section 5).

## 9. APK build (when asked)

`C:\wt\logs-g\build-apks.sh` builds both arm64 UAT release APKs.
- It sources `C:\wt\uat-mobile.env` (never print it) and uses JDK 17 at `/c/Users/nidal/.gradle/jdks/eclipse_adoptium-17-amd64-windows.2` with `ANDROID_HOME=$LOCALAPPDATA/Android/Sdk`.
- It runs `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` in `apps/<app>/android` and copies to `output/apk/catera-<customer|dapur>-uat-arm64-v8a-<YYYYMMDD>-<sha>.apk`. Run it in the background; it takes about 4 minutes per app.
- First check the react-native-screens patch is applied: `grep IMPORTANT_FOR_ACCESSIBILITY_NO node_modules/react-native-screens/android/src/main/java/com/swmansion/rnscreens/bottomsheet/DimmingView.kt`.
- Release APKs reach the hosted UAT backend, not the local demo. The hosted UAT still lacks the Phase G migrations (see the 2026-10-22 Phase G-c handoff).
- arm64 APKs don't run on the x86_64 emulator.
- Files over 30 MB can't be sent to the owner's phone through SendUserFile, so give the path.
