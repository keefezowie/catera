# Dapur layout rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill lines (owner instructions; the controller pastes the matching line into every agent prompt):**
>
> - **SL-UI** (every task except D10): before touching code or reviewing a diff, invoke the Skill tool for `expo-native-ui` and apply it for anything platform-specific; also read `C:\Users\nidal\.claude\skills\design-taste-frontend\references\app-screens.md` sections 2.2, 5, 7, 10 and 12 and apply those rules (do not run its scripts). Where they conflict, `expo-native-ui` wins; DESIGN.md, the spec and the canvas win over both. Never invoke `ui-ux-pro-max`, `building-native-ui`, `antislop:*`, `apple-design`, `material-3` or `impeccable` (if a skill template mentions antislop, ignore that line).
> - **SL-COPY** (tasks adding strings): SL-UI plus `humanizer` on every new string.
> - **SL-SP** (every agent): builders `test-driven-development` and `verification-before-completion`; fixers `receiving-code-review`, `systematic-debugging`, `verification-before-completion`; reviewers `requesting-code-review`; gate agents `verification-before-completion`.
>
> **Models:** until 04:00 WIB on 2026-10-24 (21:00 UTC on 10-23) speed mode: Opus builders. From then on the default (memory `catera-usage-aware-execution`): each task gets up to 3 Sonnet attempts (2 and 3 resume the same agent with the failing output), then one fresh Opus agent with all three reports, then stop and report. Every reviewer, gate and the DESIGN.md writer is Opus. Never Haiku. Check `date -u` before each dispatch. Only gate agents drive the emulator.

**Goal:** Re-lay Catera Dapur on the v2 layout scale with a 48 touch target and a dense row ladder: a Hari ini that leads with the day's cooking and run, flat working lists on Pelanggan, Menu and Usaha, money as the biggest thing on Uang, and pinned sheet actions, without changing the customer app's rendering.

**Architecture:** `packages/design-tokens` gains a few additive `nativeLayout` keys; `packages/mobile-ui` gains a `target` on `LayoutScaleProvider`, a `figure` Text variant, the layout blocks moved from the customer app plus four new ones, and Dapur geometry on the Dapur-only rows. `apps/caterer/app/_layout.tsx` provides `v2` with `target={48}`; each screen task re-lays its screens on the shared blocks and moves its own tests to the Dapur scale.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, react-native-screens 4.26, Reanimated 4, Jest (jest-expo), Vitest, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-24-dapur-layout-design.md](../specs/2026-10-24-dapur-layout-design.md). Canvas (visual contract where the spec is silent): `https://claude.ai/artifact/UasscRdNooRxK3cPZtPDEo` ("Sesudah" boards). Code map: [inventory](../research/2026-10-24-dapur-layout-inventory.md). Rulings: [synthesis](../research/2026-10-24-dapur-layout-synthesis.md) section 3.

## Global Constraints

**Process**
- Work on `v2`. Pool worktrees `C:\wt\1`, `C:\wt\2`, `C:\wt\3`; per task `git -C <wt> switch --detach v2 && git -C <wt> switch -c task-DN`. `npm ci --prefer-offline` only when `package-lock.json` changed since that worktree's last install. Merge: the task's builder rebases on `v2` and reruns its checks; the controller runs `git -C D:\Project\Catera\catera merge --ff-only task-DN`. On a rebase conflict the controller aborts and hands the rebase back to the builder. At most three builders at once. No agent writes in the main tree while pool tasks run.
- Never kill processes you did not start; stop only your own PIDs. Never `taskkill /IM node.exe`. Never run Metro with `CI=1`.
- Never stage `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `output/verification/postgres.json`, `.claude/`, `graphify-out/`, `catera-phase-f-artwork.zip`; stage by explicit path. No dependency changes. No DESIGN.md edits except D10. Write only your own report file. Reports end with **Doc facts**.
- Checks per task (run all four, every task): `npm run typecheck` (root), `npm test` (root Vitest; `tests/native-font-weights.test.ts` fails on a direct `fontWeight`, use `fontFor()` or a variant), `npx jest --runInBand` in `apps/caterer`, and in `apps/customer` when the task touches `packages/` or `apps/customer`. A failure recorded as `Baseline:` in the ledger is cited, not debugged.
- Ownership of shared files: `apps/caterer/src/skeletons.tsx` by export (D3 `TodayCountSkeleton`, `TodaySkeleton`; D4 `ListSkeleton`, `DetailSkeleton`; D5 the three `Menu*Skeleton`s; D6 `UangSkeleton`); `apps/caterer/tests/skeletons.test.tsx` by the `describe` block of the skeleton you own; `selection-mode.test.tsx` belongs to D3 (D7 edits only its proof-tile block, after D3 merges). Edit nothing else in those files.
- Copy: Indonesian first through `t(id, en)`, "kamu", no em dashes, no invented numbers, glossary unchanged. New strings only: "n hal lainnya" / "n more", "n menu" / "n dishes", "n alamat" / "n addresses", "Sudah dimasak · n porsi" / "Cooked · n portions", "Lihat semua n" / "See all n", "Kelola" / "Manage", figure labels "porsi" / "portions", "paket" / "packages", "alamat" / "addresses".

**Layout (spec section 2, verbatim values)**
- Dapur root: `LayoutScaleProvider value="v2" target={48}`. Margin 16; sections 24 apart (`nativeLayout.dense.sectionGap`); heading to content 12; in group 8; card padding 16.
- Controls: button 50, field 50, chip and segment 34 drawn with a 48 target (`hitSlop` 7) inside a frame at least 48 tall; stepper circles 44 with `hitSlop` 2; icon buttons 48.
- Rows: link and settings 48; check 56; two-line 64; media 72 (56 thumb r8); compact media 64 (48 thumb r8); key-value 40.
- Type: `heroTitle` 24/30, `section` 20/26 (sibling figures at 800), `rowTitle` 17/22, `bodyStrong`/`bodyL` 15/22, `meta` 13/18, new `figure` 32/40/800 tabular (Hari ini and Uang lead only). Dapur screens no longer use `display` or `number`.
- Radius thumb 8, control 12, card 16, sheet 24. Lists are `ListCard`s (no border, hairlines from the text column); no card per row. Photos by ratio (packages 16:10 in `HeroPhotoFrame`).
- Colour from tokens only (palette K); no colour changes in this plan.

**States every screen task covers:** owner and staff where the screen serves both; light and dark × Siang and Malam; loading skeleton built from the same constants as the loaded layout; empty; read error; offline kept copy; font scale 1.3 and 360dp width (effective width `width / fontScale`) with no clipped primary label; English (`en` labels run longer, e.g. the rantang labels take two lines). Fixtures: `apps/caterer/tests/fixtures.ts` builders; the demo kitchen on the `layout-gate` data for gates.

**Verification limit:** Android emulator `Catera_Pixel8_API36` (emulator-5554), Expo Go, Dapur Metro `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --go --clear --port 8082` started by the controller only, demo backend on :3000 (`apps/web/.data/layout-gate`); helpers `output/native-review/phase-g/scripts/adb.sh`, `contact-sheet.cjs`. iOS NOT VERIFIED (no Mac).

## Review Focus

1. **Customer app unchanged.** Moving the blocks and adding `target` must not move a customer pixel. Expected: the customer Jest suite stays at its baseline, and a test that `Chip` under `v2` without `target` keeps `hitSlop` 5 (D1).
2. **A 48 target that is really there.** A chip inside a horizontal `ScrollView` or a 44 frame loses its slop. Expected: tests asserting each Dapur chip row's frame is at least 48 tall and the chip's `hitSlop` is 7 (D1, D4, D5), and the gates measure targets by tapping.
3. **Big numbers and long money.** A 4-digit portion count, "Rp 12.345.000" and an English label at font scale 1.3 on 360dp. Expected: `FigureStrip` switches to its 2-column grid below 340 effective width (D2), `CheckRow`'s quantity column keeps 4 digits without moving the dish (D3), `KeyValueRow` wraps the label and never truncates the value (D2, D6).
4. **Nothing jumps through the day.** The footer keeps one height from "Mulai masak" to "Berangkat antar", and after departure the Antar section starts within one row of where it was. Expected: render tests of `KitchenAction` in each state asserting equal heights, and of the Masak summary row (D3).
5. **Staff see no owner controls.** Expected: tests that staff Hari ini has no MulaiCard and no "Isi menu", staff Menu rows have no "Tambah foto" target and the day editor has no "Simpan menu" footer (D3, D5).

---

### Task D1: Scale opt-in, touch target and the `figure` variant

**Files:**
- Modify: `packages/design-tokens/src/index.ts` (`nativeLayout` :302-314, additive keys)
- Modify: `packages/mobile-ui/src/layoutScale.tsx`, `packages/mobile-ui/src/components.tsx` (`textVariants` :39-57; Chip :237, Segmented :268, Stepper :389 hitSlop), `packages/mobile-ui/src/index.ts`
- Modify: `apps/caterer/app/_layout.tsx` (provider beside the existing providers, as `apps/customer/app/_layout.tsx:201` does)
- Create: `apps/caterer/tests/dapur-scale.tsx` (`withDapurScale(ui)`), rename `apps/caterer/tests/layout-classic.test.tsx` → `layout-dapur.test.tsx`
- Test: `layout-dapur.test.tsx`, `apps/customer/tests/ui-foundation.test.tsx` (one added case)

**Interfaces (Produces):**
- `nativeLayout.row.compact = 64`, `nativeLayout.row.check = 56`, `nativeLayout.thumb.compact = 48`, `nativeLayout.dense = { sectionGap: 24 }`, `nativeLayout.figure = { lead: 32, leadLine: 40 }`.
- `LayoutScaleProvider({ value, target?: number, children })`; `useTouchTarget(): number` (44 default).
- Under `v2`, `Chip` and each `Segmented` segment: `hitSlop` `{ top, bottom: (useTouchTarget() - 34) / 2 }`; `Stepper` buttons `hitSlop` `(useTouchTarget() - 44) / 2` on all sides.
- `Text variant="figure"`: fontSize 32, lineHeight 40, `fontFor("800")`, `fontVariant: ["tabular-nums"]`, colour charcoal, not a header.
- `withDapurScale(ui: ReactNode): ReactElement` wraps `LayoutScaleProvider value="v2" target={48}`.

**Depends on:** none. **Builder:** opus before 04:00 WIB, else sonnet.

- [ ] Step 1: Failing tests. `layout-dapur.test.tsx`: under `withDapurScale`, Screen body paddingHorizontal 16, Button minHeight 50 radius 25, Chip minHeight 34 and hitSlop top/bottom 7, Segmented segment hitSlop 7, Stepper button hitSlop 2, Field input minHeight 50, Card radius 16 padding 16 gap 8 no border, `figure` 32/40 tabular. `ui-foundation.test.tsx` adds "v2 without target keeps hitSlop 5".
- [ ] Step 2: Run both suites; expect the new cases to fail.
- [ ] Step 3: Implement the interfaces; wrap the Dapur root.
- [ ] Step 4: Run all four checks; expect green (caterer screen tests still render classic, since they mount without the root).
- [ ] Step 5: Commit `feat(native): Dapur opts into the v2 scale with a 48 touch target`.

### Task D2: Shared layout blocks in `packages/mobile-ui`

**Files:**
- Move: `apps/customer/src/layout/{SectionHeader,ListCard,MediaRow,GlyphRow,GlyphCircle,Thumb,DecorativeIcon}.tsx`, `rowLabel.ts`, `metrics.ts` and `HeroPhotoFrame` (+ `heroPhotoInset`) from `apps/customer/src/today/HeroPhoto.tsx` → `packages/mobile-ui/src/layout/` (same names), exported from `packages/mobile-ui/src/index.ts`
- Modify: every customer import of those (16 files; `apps/customer/src/layout/index.tsx` may stay as a re-export of the package)
- Create: `packages/mobile-ui/src/layout/{TwoLineRow,KeyValueRow,FigureStrip}.tsx`; Modify `MediaRow.tsx` (`size`)
- Test: `apps/customer/tests/layout-blocks.test.tsx` (unchanged, must pass), new `apps/caterer/tests/layout-blocks-dapur.test.tsx`

**Interfaces (Produces):**
- `MediaRow({ ..., size?: "media" | "compact" })`: compact minHeight 64, `Thumb` 48, title variant `rowTitle` unless `titleVariant="bodyStrong"`.
- `Thumb({ size?: 48 | 56 | 64 })`.
- `TwoLineRow({ leading?: ReactNode, title: string, meta?: string, trailing?: ReactNode, onPress?, accessibilityLabel?, testID? })`: minHeight 64, gap 12, title `rowTitle` 1 line, meta `meta` 1 line, trailing in a fixed column (width = its children, 48 per button), label from `rowLabel(title, meta)`.
- `KeyValueRow({ label: string, value: string, testID? })`: minHeight 40, label `bodyL` muted (wraps), value `bodyStrong` right-aligned, tabular, `flexShrink: 0`, never truncated.
- `FigureStrip({ cells: { label: string; value: string }[], lead?: boolean, subline?: string, testID? })`: surface, radius 16, padding 12/16, equal cells split by 1px hairlines, each a `meta` label above its value; first value `figure` when `lead`, others `section` at 800 tabular; below effective width 340 a 2-column grid with the lead spanning both.
- `SectionHeader({ title, count?: string, action?: { label, onPress } | ReactNode })`: count in `meta` beside the title; trailing slot accepts a node.

**Depends on:** D1. **Builder:** opus before 04:00 WIB, else sonnet.

- [ ] Step 1: Failing tests in `layout-blocks-dapur.test.tsx`: MediaRow compact 64 with a 48 thumb; TwoLineRow 64, trailing fixed, label "Bu Sari, Jl. Melati 3" with no empty part; KeyValueRow value `flexShrink` 0 and right-aligned with "Rp 12.345.000" at fontScale 1.3 width 360; FigureStrip 3 cells, lead variant `figure`, grid at width 360 fontScale 1.3 (effective 277), 2 hairlines in the row layout; SectionHeader count and node action.
- [ ] Step 2: Run; expect failures.
- [ ] Step 3: Move the files with `git mv`, fix imports, add the new blocks.
- [ ] Step 4: Run all four checks including the customer suite; expect green with no customer test edits beyond import paths.
- [ ] Step 5: Commit `refactor(native): layout blocks move to mobile-ui; Dapur row blocks`.

### Task D3: Hari ini

**Files:**
- Modify: `apps/caterer/src/today/{TodayScreen,SessionCard,CookingList,DeliveryOrder,SelectionBar}.tsx`, `packages/mobile-ui/src/{CheckRow,StopRow}.tsx` (Dapur-only), `packages/mobile-ui/src/RantangTrack.tsx` (additive `size`), `apps/caterer/src/skeletons.tsx` (`TodayCountSkeleton`, `TodaySkeleton`)
- Test: `today.test.tsx`, `kitchen-loop.test.tsx`, `empty-states.test.tsx` (count card cases), `selection-mode.test.tsx`, `skeletons.test.tsx` (today blocks)

**Interfaces:** Consumes D1, D2. Produces `RantangTrack size?: "regular" | "compact"` (default regular: unchanged).

**Depends on:** D1, D2. **Builder:** opus (design judgment).

**States:** before cooking, cooking (checks partly done), ready to depart, departed (Masak summary row), all delivered (DoneCard "Semua beres"), no session ("nothing to cook"), empty meal, Besok, staff, Pilih mode with 0/1/n selected and stacked below 340, report cards replied and not, MulaiCard for a new kitchen, offline (banner, footer hidden), kept copy, read error, loading, English, dark × Malam.

- [ ] Step 1: Failing tests: header order (meta row, date button, `FigureStrip` porsi/paket/alamat with "Antar 10.30" subline, compact track) and no mascot in the header; live slot shows one to-do and "2 hal lainnya" expands two more in place; "Daftar masak" `SectionHeader` with "4 menu" and Bagikan/Cetak 48 buttons; CheckRow 56 with a 48 quantity column showing "1240" without moving the name's x; "Per paket" `KeyValueRow`s; "Urutan antar" with "6 alamat" and Pilih, StopRow 64 with map and "…" in one trailing column, 3 stops then "Lihat 3 alamat lainnya"; Maps and WhatsApp side by side; after departure one 48 row "Sudah dimasak · 24 porsi" and the Antar header's y within 48 of its pre-departure position in a layout measure; `KitchenAction` height equal in "Mulai masak" and "Berangkat antar · 24 porsi"; staff: no MulaiCard, no "Isi menu"; skeletons match the new constants; RantangTrack regular unchanged (customer Plate test untouched).
- [ ] Step 2: Run; expect failures.
- [ ] Step 3: Re-lay the screen per spec 3.1; keep every behaviour and string.
- [ ] Step 4: Run all four checks (customer suite included: RantangTrack is shared).
- [ ] Step 5: Commit `feat(dapur): Hari ini leads with the day's cooking and run`.

### Task D4: Pelanggan and its detail

**Files:** Modify `apps/caterer/src/customers/{CustomerList,CustomerDetail}.tsx`, the Pelanggan tab header in `apps/caterer/app/(tabs)/(pelanggan)/` if it builds the MoodHeader there, `apps/caterer/src/skeletons.tsx` (`ListSkeleton`, `DetailSkeleton`). Test `customers.test.tsx`, `skeletons.test.tsx` (list block).

**Depends on:** D1, D2. **Builder:** opus before 04:00 WIB, else sonnet.

**States:** 0, 1 and 40 customers; each filter with counts loading and loaded; chat number missing; error; detail with renew shown and hidden, with 1 and 3 packages and a 12-delivery schedule; font scale 1.3; 360dp.

- [ ] Step 1: Failing tests: `plain` header 44 with "Pelanggan" `heroTitle` and the "+ Pelanggan lama" 48 action, no empty 48 row; chip frame ≥ 48 in a horizontal ScrollView, chips hitSlop 7, counts hidden while loading; rows are `TwoLineRow` 64 in one `ListCard` with the 48 chat button; detail key-value block, WhatsApp and renew side by side (renew hidden → WhatsApp full width), address well 56, schedule capped at 5 with "Lihat semua 12" expanding.
- [ ] Step 2: Run; expect failures. Step 3: Implement spec 3.2. Step 4: Four checks. Step 5: Commit `feat(dapur): Pelanggan is a list to work through`.

### Task D5: Menu week and day editor

**Files:** Modify `apps/caterer/src/menu/{MenuWeek,MenuDayScreen,SlotEditor}.tsx`, `apps/caterer/src/skeletons.tsx` (`MenuStripSkeleton`, `MenuControlsSkeleton`, `MenuWeekSkeleton`). Test `menu.test.tsx`, `skeletons.test.tsx` (menu blocks).

**Depends on:** D1, D2. **Builder:** opus (design judgment).

**States:** 5-day and 7-day packages; one meal and both meals; a day with photos, without photos, partly empty (kitchen-truth captions); Salin and Bagikan disabled with their reasons; owner and staff; 360dp (7 tiles about 44 wide); loading; error.

- [ ] Step 1: Failing tests: week range `heroTitle` between two 44 chevrons in one 44 row; Siang/Malam in a 48 frame only for two-meal packages; the strip is one row for 7 days at width 412 and 360 (tile width `(innerWidth - 6 x 4) / 7`, height 56); Salin and Bagikan side by side (staff: Bagikan alone); dish rows `MediaRow size="compact"` 64 with and without a photo, the not-set thumb is the "Tambah foto" 48 target for the owner and inert for staff; "Ubah menu" in the day header's trailing slot; day editor "Simpan menu" in a pinned `ScreenFooter`, none for staff; the existing 7-day 4+3 wrap test is replaced by the one-row test.
- [ ] Step 2: Run; expect failures. Step 3: Implement spec 3.3. Step 4: Four checks. Step 5: Commit `feat(dapur): Menu week fits one row; dish rows hold one height`.

### Task D6: Usaha, Uang, Tim and Paket

**Files:** Modify `apps/caterer/src/business/{UsahaScreen,UangScreen,TimScreen,PackageDetail,PackageEditor,NutritionFields}.tsx`, `apps/caterer/src/settings/HapusAkun.tsx` (side padding only), `apps/caterer/src/skeletons.tsx` (`UangSkeleton`). Test `business.test.tsx`, `nutrition.test.tsx`, `skeletons.test.tsx` (Uang block).

**Depends on:** D1, D2. **Builder:** opus before 04:00 WIB, else sonnet.

**States:** payments card shown and hidden; 0, 1 and 4 packages; payout zero and "Rp 12.345.000"; package with and without photo; editor new and edit; font scale 1.3; 360dp.

- [ ] Step 1: Failing tests: Usaha `plain` header with the kitchen name `heroTitle` and gear; "Paket" `SectionHeader` with "+ Paket baru" trailing, 72 `MediaRow`s with "…"; one "Kelola" `ListCard` of five 48 `GlyphRow`s ending with Pengaturan (no one-row card); Uang lead `figure` and `KeyValueRow`s with right-aligned values; Tim and Hapus akun read `sheetSidePadding`; package photo in `HeroPhotoFrame` at 16:10 (the 168 assertion becomes a ratio assertion); editor sections 24 apart with `section` headers.
- [ ] Step 2: Run; expect failures. Step 3: Implement spec 3.4 and 3.6. Step 4: Four checks. Step 5: Commit `feat(dapur): Usaha is one list; Uang leads with the money`.

### Task D7: Sheets

**Files:** Modify `apps/caterer/src/today/{ExceptionSheet,ProofSheet,MoveSheet,ReportScreen}.tsx` and their routes in `apps/caterer/app/` only where the footer must move into `SheetFooter`. Test `dapur-sheets.test.tsx`, `report.test.tsx`, `selection-mode.test.tsx` (proof-tile block only).

**Depends on:** D1, D2, D3 (merged). **Builder:** opus before 04:00 WIB, else sonnet.

**States:** exception with each option, with the reason field, with an error; proof with 1 and 4 stops, photo taken and not, stacked below 400 effective width; reply with no replies and 3, resolved; move sheet loading and loaded; Android full-height form sheets.

- [ ] Step 1: Failing tests: ExceptionSheet options are 64 `TwoLineRow`s with 40 glyph circles in one `ListCard`, primary in `SheetFooter`, skeleton two 64 rows; ProofSheet 72 rows with a 56 thumb, primary pinned, stacking below 400 kept; ReplySheet Balas pinned with Tandai selesai beside it; MoveSheet skeleton height equals the calendar's (pager 48 + weekday 16 + 6 x 48 + caption 20 + field).
- [ ] Step 2: Run; expect failures. Step 3: Implement spec 3.5. Step 4: Four checks. Step 5: Commit `feat(dapur): sheet actions are pinned`.

### Task D8: Impor, auth, settings, Data akun, Aktifkan

**Files:** Modify `apps/caterer/src/import/{ImportAssistant,RowEditor,Attachments}.tsx`, `apps/caterer/src/settings/DataAkun.tsx`, `apps/caterer/src/business/AktifkanScreen.tsx`, `apps/caterer/src/auth/{Masuk,Daftar}.tsx` only where they hard-code classic sizes. Test `import.test.tsx`, `data-akun.test.tsx`, `settings.test.tsx`, `masuk-layout.test.tsx`, `onboarding.test.tsx`.

**Depends on:** D1, D2. **Builder:** sonnet (or opus before 04:00 WIB).

**States:** import paste, reading, review with 0, 3 and 20 rows and a row with a problem; row editor; Masuk and Daftar with an error and with the keyboard open (Android inset); Data akun each card; Aktifkan steps 1-3.

- [ ] Step 1: Failing tests: import review is one `ListCard` of 64 `TwoLineRow`s with trailing "Ubah" and a pale pill for a problem row; paste field radius 12 padding 16 min 160; Masuk keyboard padding follows v2 (`AuthLayout.tsx:196`); Data akun and Aktifkan use `section` headers 24 apart.
- [ ] Step 2: Run; expect failures. Step 3: Implement spec 3.7 and 3.8. Step 4: Four checks. Step 5: Commit `feat(dapur): import review and account screens on the Dapur scale`.

### Task D9: Emulator gates (controller-run; no code)

Gate 1 after D3, D4 and D5 merge; gate 2 after D6, D7 and D8; final gate after the fix wave. Each gate (Opus) force-closes Expo Go, opens `exp://10.0.2.2:8082`, confirms the live head, captures per spec section 5 into `output/native-review/layout-2026-10-24/{gate1,gate2,final}/`, measures targets by tapping and folds by uiautomator bounds, compares with the canvas boards, and writes one report. Failures route to the owning task as a fix batch (same builder rules).

### Task D10: DESIGN.md "Dapur layout scale (October 2026)" and the handoff

**Builder:** opus. After the final gate and the whole-branch review fix wave: add the DESIGN.md section (decisions, what it supersedes for Dapur, tokens and the opt-in with `target`, the moved and new blocks, each screen, evidence, not verified), update the customer section's Dapur line, and write `docs/superpowers/handoffs/2026-10-24-dapur-layout-handoff.md` (branch and head, rulings, deferred minors, open risks, next step).
