# Customer layout rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill lines (owner instructions; the controller pastes the matching line into every agent prompt):**
>
> - **SL-UI** (every task here except T12): before touching code or reviewing a diff, invoke the Skill tool for `ui-ux-pro-max` and apply its React Native guidance. For this phase only (owner exception, 2026-10-22) also read `C:\Users\nidal\.claude\skills\design-taste-frontend\references\app-screens.md` sections 2.2 and 7 (one question per screen, the biggest block carries it, capped lists, row geometry) and apply those rules; do not run its scripts. Do not invoke `building-native-ui`, `antislop:*`, `apple-design`, `material-3` or `impeccable`. Where any skill conflicts with palette K, DESIGN.md or the spec, those win.
> - **SL-SP** (every agent): builders `test-driven-development` and `verification-before-completion`; fixers `receiving-code-review`, `systematic-debugging`, `verification-before-completion`; reviewers `requesting-code-review`; gate agents `verification-before-completion`.
>
> **Models (owner rule, 2026-10-13):** each task gets up to 3 Sonnet attempts (attempt 1 builds; attempts 2 and 3 resume the same Sonnet agent with the failing review or check output). After 3 failed Sonnet attempts, one fresh Opus agent with all three failure reports; if it fails, stop and report. Every reviewer and every emulator gate is Opus. Never Haiku. Only gate agents drive the emulator.

**Goal:** Re-lay the customer app on one native layout scale: a food-led Beranda, a calm Jadwal with an agenda and a day sheet, Jelajah as a 2-column grid, and tighter package detail, Akun, Paket saya, plan detail and Buy, without moving Dapur.

**Architecture:** `packages/design-tokens` gains `nativeLayout`; `packages/mobile-ui` gains a `LayoutScale` context, new `Text` variants and v2 geometry for its controls, all behind the context so Dapur stays on `classic`. Customer-only building blocks (section header, list card, media row, glyph row, thumb) live in `apps/customer/src/layout/` and every screen task composes them.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, react-native-screens 4.26, Reanimated 4, Jest (jest-expo), Vitest, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-23-customer-layout-design.md](../specs/2026-10-23-customer-layout-design.md). Canvas (visual contract): `https://claude.ai/artifact/9xLxNe1qsVGA7QH6TWaWrT`. Code map: [inventory](../research/2026-10-22-customer-layout-inventory.md).

## Global Constraints

**Process**
- Work on `v2`. Pool worktrees `C:\wt\1`, `C:\wt\2`, `C:\wt\3`; per task `git -C <wt> switch -c task-LN v2` (detach first), `npm ci --prefer-offline` only when `package-lock.json` changed since that worktree's last install. Merge: rebase on `v2`, then `git -C D:\Project\Catera\catera merge --ff-only task-LN`. At most three builders at once. No agent writes in the main tree while pool tasks run.
- Never stage `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `output/verification/postgres.json`, `.claude/`, `graphify-out/`, `catera-phase-f-artwork.zip`; stage by explicit path. No dependency changes in this plan. No DESIGN.md edits except T12. Reports end with **Doc facts**.
- Checks per task: `npm run typecheck` (root) and the customer Jest suite (`npx jest --runInBand` in `apps/customer`); T1 also runs the caterer Jest suite and `npm test`. A failure listed as `Baseline:` in the ledger is cited, not debugged.
- Copy: Indonesian first through `t(id, en)`, "kamu", no em dashes, no invented numbers, glossary unchanged. New strings: "n hal lainnya" / "n more", "Lihat jadwal" / "See schedule", "+n lagi" / "+n more", "n paket aktif" / "n active plans", "Lihat semua" / "See all", "Minggu ini" / "This week", "n pengantaran" / "n deliveries", "Tidak ada" / "None", "Paket saya" / "My plans", "n tersimpan" / "n saved", "Riwayat" / "History", "Aktif" / "Active", "Selesai" / "Finished".

**Layout (spec section 2, verbatim values)**
- Space 4/8/12/16/24/32/48. Margin 16. Section gap 32, heading to content 12, in group 8, card padding 16.
- Radius 8 thumbs, 12 tiles and controls, 16 cards, 24 sheets; buttons fully round.
- Controls: button 50, field 50, search 44, chip 34 (hit area 44 via hitSlop), icon button 44.
- Rows 56 / 72 (thumb 56 radius 8) / key-value 40 / info 48.
- Photos: hero 4:3, cards and sheet 16:10, grid tile 4:3, thumbs 56 and 64.
- Type: `largeTitle` 32/40/700/-0.8, `heroTitle` 24/30/700/-0.4, `section` 20/26/700/-0.2, `rowTitle` 17/22/600, `bodyL` 15/22/400, `bodyStrong` 15/22/600, `meta` 13/18/400 muted. Existing variants unchanged.
- Colour from tokens only (palette K): forest fills only the one primary control per screen and marks selection; surfaces separate by tone, not borders; `stopActive` only on the current status stop.

**States every screen task covers:** light and dark × Siang and Malam; loading skeleton matching the loaded geometry (skeleton reads the same constants); empty; read error with cache and without; offline kept copy; font scale 1.3 (no clipped primary label, rows grow instead of truncating titles they must show); 360dp width. Fixtures: `apps/customer/tests/fixtures.ts` builders; the demo customer (8 plans) for the stress case.

**Verification limit:** Android emulator `Catera_Pixel8_API36`, Expo Go, demo backend on :3000, Metro with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`; helpers `output/native-review/phase-g/scripts/adb.sh`, `contact-sheet.cjs`. iOS NOT VERIFIED (no Mac).

## Review Focus

1. **Dapur unchanged.** Any shared default changed without the `v2` guard moves Dapur. Expected: caterer Jest suite green and a test that renders Button, Chip, Card, Screen, Field under no provider with today's values (T1).
2. **Mood switch semantics.** The status stops must set the app-wide mood like the arc (Jelajah filter and header tints follow). Expected: a test pressing the Malam stop switches the hero to dinner plates and `useMood().mood` to `malam` (T2).
3. **Capped lists hide nothing silently.** Berikutnya at 3 days, 2 tiles per day, the live slot at one item: every hidden item is reachable ("+n lagi", "n hal lainnya", "Lihat jadwal", "Lihat semua"). Expected: tests with 4 deliveries a day and 5 waiting items (T3).
4. **Day sheet actions keep their conditions.** Closed day, after cut-off, no phone, no report target, customer menu mode. Expected: one test per condition asserting which circles render (T5).
5. **Large text and 360dp.** Two-column tiles, three Akun tiles, the 5-circle action row and the Buy footer must not clip at font scale 1.3 on 360dp. Expected: render tests with `fontScale 1.3` and width 360 asserting wrapping layout (`useStackedLayout`) or a single column fallback (T5, T6, T8, T10).

---

### Task L1: Layout scale foundation

**Files:**
- Modify: `packages/design-tokens/src/index.ts` (add `nativeLayout`)
- Create: `packages/mobile-ui/src/layoutScale.tsx`; Modify: `packages/mobile-ui/src/components.tsx` (`textVariants` :35-45, Button :109-190, Chip :191, Segmented :217, Card :250, Field :265, Screen :351-513, styles :579-660), `packages/mobile-ui/src/index.ts`
- Modify: `apps/customer/app/_layout.tsx` (provider beside `ThemeProvider`/`MoodProvider`, ~:198), `apps/customer/src/discover/FilterChip.tsx` (render the shared `Chip`)
- Create: `apps/customer/src/layout/{SectionHeader,ListCard,MediaRow,GlyphRow,Thumb,index}.tsx`
- Test: `apps/customer/tests/ui-foundation.test.tsx`, new `apps/customer/tests/layout-blocks.test.tsx`, `apps/caterer/tests/` (one classic-geometry test)

**Interfaces (Produces):**
- `nativeLayout = { space: {xs:4, sm:8, md:12, lg:16, xl:24, xxl:32, xxxl:48}, margin: 16, sectionGap: 32, headingGap: 12, groupGap: 8, cardPadding: 16, radius: {thumb:8, control:12, card:16, sheet:24}, control: {button:50, field:50, search:44, chip:34, icon:44}, row: {single:56, media:72, keyValue:40, info:48}, thumb: {sm:56, md:64}, ratio: {hero:4/3, card:16/10, tile:4/3} } as const`
- `type LayoutScaleName = 'classic' | 'v2'`; `LayoutScaleProvider({ value, children })`; `useLayoutScale(): LayoutScaleName`; `useScreenMargin(): number` (16 under v2, 20 classic).
- `Text` variants `largeTitle | heroTitle | section | rowTitle | bodyL | bodyStrong | meta` with the Global Constraints values.
- Under v2: `Screen` horizontal padding `useScreenMargin()`; `Button` minHeight 50, radius 25; `Chip`/`Segmented` segment minHeight 34, radius 17, `hitSlop` 5 vertical; `Field` input minHeight 50; `Card` radius 16, padding 16, gap 8.
- `SectionHeader({ title, action?: { label, onPress } })` — `section` text, trailing `bodyStrong` forest link, marginBottom 12.
- `ListCard({ children })` — surface card, radius 16, paddingHorizontal 16, inserts 1px `line` separators between children, inset to the text column.
- `MediaRow({ image?: string | null, notSet?: boolean, leading?: ReactNode, title, meta?, trailing?: ReactNode | 'chevron', onPress?, testID? })` — minHeight 72, gap 12, `Thumb` 56; title `rowTitle` 1 line, meta `meta` 1 line.
- `GlyphRow({ glyph: ReactNode, title, meta?, trailing?, onPress?, minHeight?: 56 | 72 | 48 })` — 40 circle glyph or bare 20 glyph.
- `Thumb({ uri?: string | null, size?: 56 | 64, notSet?: boolean })` — radius 8; `notSet` draws the 1.5 dashed `controlRing` tile with the utensils glyph.

**Depends on:** none. **Builder:** sonnet.

- [ ] Step 1: Write failing tests: `ui-foundation.test.tsx` "v2 geometry" (under `LayoutScaleProvider value="v2"`: Button minHeight 50 radius 25; Chip minHeight 34; Screen body paddingHorizontal 16; Text `heroTitle` fontSize 24 lineHeight 30) and "classic geometry unchanged" (no provider: Button 48 radius 10, Chip 48, Screen 20, `body` 14/23). `layout-blocks.test.tsx`: MediaRow minHeight 72 and thumb 56; ListCard renders n-1 separators; SectionHeader action press fires; Thumb `notSet` shows the dashed tile.
- [ ] Step 2: Run `npx jest --runInBand tests/ui-foundation.test.tsx tests/layout-blocks.test.tsx` in `apps/customer`; expect failures.
- [ ] Step 3: Implement the interfaces above; wrap the customer root in `LayoutScaleProvider value="v2"`.
- [ ] Step 4: Run both app Jest suites, `npm run typecheck`, `npm test`; fix only tests whose expectations encode the old customer geometry (Button 48, Chip 48, Screen 20) by updating them to the v2 values.
- [ ] Step 5: Commit `feat(native): layout scale v2 for the customer app`.

### Task L2: Beranda band, hero and status line

**Files:** Modify `apps/customer/src/today/Beranda.tsx` (`HomeHeader` :172, hero :408-452, `OtherMealRow` :243/:469 removed), `apps/customer/src/today/Plate.tsx` (frame :165-170, :216-220, :322-367), `packages/mobile-ui/src/HeroPager.tsx` (card inset only under v2), `apps/customer/src/skeletons.tsx` (Beranda part); Create `apps/customer/src/today/StatusStops.tsx`; Tests `today.test.tsx`, `mood-arc.test.tsx` (retarget or replace with `status-stops.test.tsx`), `skeletons.test.tsx`, `hero-arrival.test.tsx`.

**Interfaces:** Consumes L1. Produces `StatusStops({ lunch: StopInfo, dinner: StopInfo })` with `StopInfo = { window: string | null, state: string, status: 'now' | 'next' | 'none' | 'done' }`; `HERO_BAND_OVERLAP = 104` exported from `Beranda.tsx` and read by the skeleton.

**Depends on:** L1. **Builder:** sonnet.

**States:** hero with each Plate state (scheduled, cooking, on_the_way, due, arrived_unconfirmed, arrived, failed, reported, none), pager with 2 plates, no hero (status line alone under the band), offline kept copy, Malam mood band tint, dark, loading skeleton, font scale 1.3.

- [ ] Step 1: Failing tests: band shows date `meta` and statement in `section` (fontSize 20); hero photo `aspectRatio` 4/3 and card radius 16 with no 10 frame padding; dish uses `heroTitle`; `status-stop-dinner` press sets mood `malam` and the hero shows the dinner plate; the other meal's waiting sentence appears as the dinner stop meta; `OtherMealRow` testID absent; skeleton band and hero heights equal the loaded ones.
- [ ] Step 2: Run them; expect failures.
- [ ] Step 3: Implement per spec 3.1 items 1-3; keep every Plate branch and side effect (`journey_viewed`, `run()` retry); the ⋮ on the photo stays only where it is today; delete `MoodArc` only if no other caller remains (otherwise leave it unused by Beranda).
- [ ] Step 4: Customer Jest suite and typecheck green.
- [ ] Step 5: Commit `feat(customer): food-led Beranda hero with a two-stop status line`.

### Task L3: Beranda live slot, Berikutnya and Paket kamu

**Files:** Modify `apps/customer/src/today/{Beranda,WaitingList,UpcomingDays,PlansRow}.tsx`; Create `apps/customer/src/today/LiveSlot.tsx`, `apps/customer/src/today/DayBlocks.tsx`, route `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/perlu-diurus.tsx` (full waiting list, native title "Perlu kamu urus"); register its options in that group's `_layout.tsx`; skeleton; Tests `beranda-sections.test.tsx`, `tomorrow.test.tsx`, `today.test.tsx`, `skeletons.test.tsx`.

**Interfaces:** Consumes L1 blocks and `upcomingDays`, `activePlans`, waiting items (D/home.ts). Produces nothing others use.

**Depends on:** L2. **Builder:** sonnet.

**States:** 0, 1 and 5 waiting items (offline hides menu and review rows as today); upcoming with 1 delivery a day, 2 a day, 4 a day, menu not set, no upcoming days; plans 0, 1, 2, 3 and 8; loading; dark.

- [ ] Step 1: Failing tests: LiveSlot shows only the first item by the existing order with its action and "4 hal lainnya" opening `/perlu-diurus`; all-single-delivery days render one ListCard of MediaRows with a date column; a 4-delivery day renders 2 tiles (`aspectRatio` 16/10) and "+2 lagi"; at most 3 days; header link "Lihat jadwal" goes to the Jadwal tab; tomorrow's block opens the existing tomorrow story route and other days open `dayHref`; plans 1-2 as MediaRows, 3+ as a horizontal rail of 168-wide cards sorted by soonest end with "n paket aktif" and "Lihat semua" to `/paket-saya`; `TomorrowEntry` no longer rendered on Beranda.
- [ ] Step 2-5: run, implement per spec 3.1 items 4-7, suite and typecheck green, commit `feat(customer): Beranda live slot, capped Berikutnya and plans rail`.

### Task L4: Jadwal month and agenda

**Files:** Modify `apps/customer/src/schedule/{Jadwal,MonthGrid}.tsx`, skeleton part; Tests `schedule.test.tsx`, `skeletons.test.tsx`, `loading.test.tsx`.

**Depends on:** L1. **Builder:** sonnet.

**States:** month with deliveries, month empty, failed month, selected today, selected future day, menu-not-set days, past days, weeks with no delivery days, dark, Malam, font scale 1.3, 360dp.

- [ ] Step 1: Failing tests: cells 40 tall; selected day a 32 filled circle; delivery day dot 6; not-set ring; only the needed weeks render (October 2026 → 5); legend uses `meta`; agenda "Minggu ini" lists one block per delivery day of the selected week with MediaRows (72) and a single muted row for empty days; selecting a date in another week moves the agenda; rows push `dayHref`.
- [ ] Step 2-5: run, implement per spec 3.2 items 1-2, green, commit `feat(customer): calm month grid and week agenda in Jadwal`.

### Task L5: Day sheet with visible actions

**Files:** Modify `apps/customer/src/schedule/DayScreen.tsx`, `apps/customer/src/schedule/dayActions.ts` (reuse `dayActionInput` conditions), `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/_layout.tsx` (`hari/[id]` options → form sheet using `sheetOptions` from mobile-ui, detents `[0.75, 1]`), remove `DayMore` use from DayScreen and `PlanDetail` rows only if L9 has not (coordinate by rebase); Create `apps/customer/src/schedule/DayActions.tsx`; Tests `schedule.test.tsx`, `sheets.test.tsx`, `navigation.test.tsx`, `native-header.test.tsx`.

**Interfaces:** Produces `DayActions({ actions: DayAction[] })`, `DayAction = { key: 'change' | 'menu' | 'report' | 'chat' | 'address', label: string, onPress(): void }`, circles 56 with `meta` labels, one row, wraps to two rows at font scale 1.3 or 360dp.

**Depends on:** L1. **Builder:** sonnet.

**States:** each action condition true and false (closed day hides Ubah hari; after cut-off hides change and address; no phone hides chat; no report target hides report; customer menu mode shows "Pilih menu", else "Lihat menu" when a menu exists, else hidden), several meals in a day, cancelled day, offline, dark, font scale 1.3.

- [ ] Step 1: Failing tests per condition above; the route options for `hari/[id]` are a form sheet; the sheet shows photo 16:10, `heroTitle` dish, state line with the cut-off ("bisa diubah sampai …"), address well, and no ⋮.
- [ ] Step 2-5: run, implement per spec 3.2 item 3, green, commit `feat(customer): day detail as a sheet with visible actions`.

### Task L6: Jelajah grid

**Files:** Modify `apps/customer/src/discover/{Jelajah,PackageCard,FilterChip,SavedList}.tsx`, skeleton part; Tests `discover.test.tsx`, `photo-parts.test.tsx`, `shell.test.tsx`, `skeletons.test.tsx`, `mood-arc.test.tsx` (Jelajah meal control part).

**Interfaces:** Produces `PackageCard layout="tile"` (the only layout after this task; row and tall layouts removed with their callers moved).

**Depends on:** L1. **Builder:** sonnet.

**States:** catalogue loaded, empty, filtered-empty (offers the other meal), save error, area unset and set, Malam, dark, font scale 1.3 and 360dp (tiles keep 2 columns at 360; names wrap to 2 lines; at font scale ≥1.3 on 360 the grid falls back to 1 column via `useStackedLayout`), loading grid skeleton.

- [ ] Step 1: Failing tests: header has no 60-tall meal buttons; a `meal-segment` with Siang/Malam (34 tall) first in the chip row sets the mood; categories render as chips (no `PhotoRing`); the list is a 2-column grid with tile photo `aspectRatio` 4/3, heart hit area 44; Saved list uses tiles.
- [ ] Step 2-5: run, implement per spec 3.3, green, commit `feat(customer): Jelajah as a two-column grid`.

### Task L7: Package detail

**Files:** Modify `apps/customer/src/discover/{PackageDetail,NutritionCard}.tsx`, skeleton part; Tests `discover.test.tsx`, `nutrition.test.tsx`, `package-detail-header.test.tsx`, `skeletons.test.tsx`.

**Depends on:** L1 (independent of L6). **Builder:** sonnet.

**States:** all four nutrition metrics, only kcal, none (strip hidden), with and without trial, with and without reviews, no start date, dark, Malam, font scale 1.3 (strip numbers wrap under each other rather than clip).

- [ ] Step 1: Failing tests: photo `aspectRatio` 4/3; name `heroTitle`; `stat-strip` with up to three cells (kkal, protein, meals a day) and carbs/fat as one `meta` line; "Isi paket" meal rows 72; facts as 48 info rows with `bodyL`; footer price in `section` weight 800.
- [ ] Step 2-5: run, implement per spec 3.4, green, commit `feat(customer): package detail stat strip and info rows`.

### Task L8: Akun and Paket saya

**Files:** Modify `apps/customer/src/account/{Akun,Row}.tsx`, `apps/customer/src/plan/PlanList.tsx`, the `paket-saya` route title; skeleton part; Tests `account.test.tsx`, `plan.test.tsx`, `settings.test.tsx`, `skeletons.test.tsx`, `native-header.test.tsx`.

**Depends on:** L1. **Builder:** sonnet.

**States:** signed out (`SignInFirst` keeps its rows), 0 / 1 / 8 active plans, completed plans present or not, plan read error, dark, font scale 1.3 and 360dp (tiles wrap to two lines of text; never truncate the label).

- [ ] Step 1: Failing tests: Akun shows avatar initials and name `heroTitle`, three tiles (Paket saya "n aktif" → `/paket-saya`, Alamat "n tersimpan" → `/alamat`, Riwayat → `/pembayaran`), one ListCard of GlyphRows (Data akun, Disimpan, Notifikasi, Bantuan dan laporan) and a separate Pengaturan row; no plan rows on Akun; Paket saya titled "Paket saya" lists active plans sorted by soonest end and a "Selesai" section from `status === 'completed'` subscriptions when any exist.
- [ ] Step 2-5: run, implement per spec 3.5, green, commit `feat(customer): Akun hub tiles and Paket saya`.

### Task L9: Plan detail

**Files:** Modify `apps/customer/src/plan/PlanDetail.tsx`, skeleton part; Tests `plan.test.tsx`, `stale-plan.test.tsx`, `skeletons.test.tsx`.

**Depends on:** L1. **Builder:** sonnet.

**States:** active, renewal due, trial, completed, cancelled (no list), offline, stale copy, not found, dark, font scale 1.3.

- [ ] Step 1: Failing tests: hero photo `aspectRatio` 16/10, card radius 16 without the 10 frame; "n hari lagi" in `heroTitle`; upcoming rows are MediaRows (72) with the date as title and dishes as one truncated `meta` line; no per-row ⋮; sticky action unchanged.
- [ ] Step 2-5: run, implement per spec 3.6, green, commit `feat(customer): plan detail compact day rows`.

### Task L10: Buy

**Files:** Modify `apps/customer/src/buy/{BuyScreen,Breakdown,BuyParts}.tsx`; Tests `buy.test.tsx`, `customer-sheets.test.tsx`.

**Depends on:** L1. **Builder:** sonnet.

**States:** full and trial, single length and options, no address ("Tambah alamat"), pending payment, quote loading, quote error, still running, blocked error, dark, font scale 1.3 and 360dp (footer amount and button stack when they do not fit).

- [ ] Step 1: Failing tests: summary card with a 64 thumb; field rows inside one ListCard (Mulai 72 with "Ubah", Lama paket, Porsi with 44 stepper buttons, Diantar ke 72 with "Ganti"); Rincian rows 40 in `bodyL`; footer total in `section` weight 800 and "Bayar" 50.
- [ ] Step 2-5: run, implement per spec 3.7, green, commit `feat(customer): Buy summary and field rows`.

### Task L11: Emulator gate

**Builder/agent:** opus gate agent, read-only. **Depends on:** L2-L10 merged (run partial gates as groups merge: Beranda after L3; Jadwal after L4+L5; Jelajah and detail after L6+L7; Akun, plan, Buy after L8-L10).

- [ ] Capture with the adb helpers at 1080x2400: Beranda (top and scrolled), Jadwal, day sheet, Jelajah, package detail, Akun, Paket saya, plan detail, Buy; light Siang for all, dark and Malam for Beranda and Jadwal, font scale 1.3 for Beranda, Jelajah, Buy; 360dp for Jelajah and Akun. Contact sheet per group under `output/native-review/layout-2026-10-23/`.
- [ ] Compare each against its canvas board and spec section; measure tap targets ≥ 44 and truncation by uiautomator bounds script. Report failures as `screen — finding — owning task`; the controller routes each to that task as a fix attempt.

### Task L12: DESIGN.md and handoff

**Agent:** opus. **Depends on:** L11 clean.

- [ ] Write "Customer layout scale (October 2026)" into DESIGN.md from the approved Doc facts and ledger rulings only; supersede the native type table rows it replaces for customer screens.
- [ ] Write `docs/superpowers/handoffs/2026-10-23-customer-layout-handoff.md`: branch and last commit, rulings, open risks, NOT VERIFIED items, next step (Dapur layout pass).
