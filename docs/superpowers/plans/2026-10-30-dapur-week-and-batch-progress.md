# Dapur Week Strip and Batch Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hari ini in Catera Dapur shows the next seven days, read-only past today, and a seven-day portions-per-dish recap. A batch moving through Dimasak, Diantar and Sampai shows as counts with a status on each stop, instead of the single-order rantang stepper.

**Architecture:** The today/tomorrow toggle becomes a 7-day `WeekStrip` fed by the existing `seller-calendar` read (one request, filtered by the mood's meal). Picking a day re-reads `sellerOperations` for that date exactly as today does. A new `BatchProgress` header block replaces `RantangTrack` in Dapur only; it reads `KitchenSession.counts`, which already exists. `StopRow` gains an optional status pill. A new `belanja` stack route sums `cookingRecap` over seven `sellerOperations` reads through a pure domain helper `weekRecap`. No migration and no backend change.

**Tech Stack:** Expo Router (React Native), `@catera/domain`, `@catera/mobile-ui`, `@catera/mobile-core`, Jest (apps/caterer), Vitest (root `tests/`).

**Spec:** the approved design canvas https://claude.ai/artifact/7pnksNFTdwUNCSufc9LEyc, boards "A · Draft with dummy data" (`OptionA-323w.dc.html`) and "A · Batch progress mid-run" (`OptionA-progress.dc.html`), plus these decisions from the 2026-10-30 session:
- Week strip lives in Hari ini (option A). Today is the only day you can act on.
- No free-text "view only" note on future days: the missing footer and the day word say it.
- Belanja is a portions-per-dish recap over seven days, not ingredients (no ingredient data exists).
- The kitchen header shows the batch as counts, as delivery-ops tools do (Routific "Stops 6/8", Onfleet counts per state). RantangTrack stays in the customer app.

## Global Constraints

- Work on `v2`. Pool slots `C:\wt\1`–`C:\wt\3` may be held by another controller: run `git worktree list` and `git -C <wt> status --porcelain` before taking one; re-check `git log -1 v2` before every `--ff-only` merge. Subagent reports go to the session scratchpad.
- Every implementer and reviewer invokes, with the Skill tool, before working: `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, plus `apple-design` and `material-3` for chrome. antislop mode is AFTER (session override); do not ask again.
- Builders run on `sonnet`; fixers, reviewers and the gate run on `opus`; never `haiku`.
- Indonesian first, English through `t(id, en)` on every string. No em dash in any copy. Sentence case. Operational numbers use `fontVariant: ["tabular-nums"]`. Copy that holds data uses `<Text selectable>`.
- Colours come from `useColors()` / `useMoodColors()` tokens only (packages/design-tokens). Every text pair ≥ 4.5:1 and every bar segment ≥ 3:1 against its neighbour, in light/dark × Siang/Malam; check with the antislop contrast tool and record the ratios in Doc facts.
- Touch targets ≥ 48 in Dapur (`useTouchTarget`); adjacent targets keep a gap.
- Platform chrome stays native (native stack header on `belanja`, NativeTabs untouched). Repo convention wins over the native-ui skill on file naming (PascalCase components) and haptics on both platforms (DESIGN.md).
- Helpers (role `staff`) see Hari ini and Belanja; owner-only actions stay owner-only.
- Implementers do not write DESIGN.md prose. They end their report with Doc facts (what, file:line, evidence).
- Checks per task: `npm run typecheck -w @catera/caterer`, `npm test -w @catera/caterer` (and `npx vitest run tests/kitchen.test.ts` for domain). Full `npm run typecheck && npm test && npm run build` after each merge.

## Review Focus

1. A delivery notification pointing 3–6 days ahead opens that day in the strip; one pointing further ahead (or in the past) opens today. Test in Task 3.
2. A meal where some stops are marked "Gagal diantar": those rows are in no count and no bar segment, and "X dari Y sampai" uses only active rows. Test in Task 1.
3. Belanja when one of the seven day reads fails: the screen shows the error with Coba lagi, never a partial total presented as complete. Test in Task 4.
4. Pull to refresh on Hari ini also re-reads the strip counts; a failed calendar read leaves the strip usable without counts. Test in Task 3.
5. Switching Siang/Malam re-filters the strip counts to that meal and keeps the selected day. Test in Task 3.

---

### Task 1: Batch progress header

**Files:**
- Create: `apps/caterer/src/today/BatchProgress.tsx`
- Modify: `apps/caterer/src/today/TodayScreen.tsx:81-107` (`HeaderFigures`: drop `RantangTrack`, render `BatchProgress`)
- Modify: `apps/caterer/src/skeletons.tsx:37-` (`TodayCountSkeleton`: drop the track room; the progress block never shows while loading)
- Test: `apps/caterer/tests/batch-progress.test.tsx`

**Interfaces:**
- Consumes: `KitchenSession` (`counts: Record<JourneyStage, number>`, `journey.cookingAt | departedAt | arrivedAt`) from `@catera/domain`; `StopGlyph` (`"pot" | "motorbike" | "house"`) from `@catera/mobile-ui`.
- Produces: `export function BatchProgress({ session }: { session: KitchenSession }): JSX.Element | null` and `export function batchCounts(session: KitchenSession): { total: number; cooking: number; out: number; arrived: number }` (arrived = `arrived + delivered`; cooking = `preparing`; total = sum of all counts).

**Depends on:** none · **Builder:** `sonnet`

**States:**
- Every row scheduled (before Mulai masak, and every future day): renders `null`; the header shows the figures only.
- Mid-run (`canvasDay` with stages mixed): title `"{arrived} dari {total} sampai"` / `"{arrived} of {total} arrived"`; trailing meta, the first that applies: `"terakhir {HH.mm}"` (latest `arrivedAt`), `"berangkat {HH.mm}"` (`departedAt`), `"mulai masak {HH.mm}"` (`cookingAt`), Jakarta clock via `jakartaClock`. One bar, three segments in order Sampai, Diantar, Dimasak, 2 gap between, each `flex: count` and absent at 0, on the scheduled-remainder track. Legend: three cells, glyph disc + label + count: Dimasak, Diantar, Sampai.
- All arrived: `"{total} dari {total} sampai"`, meta `"terakhir {HH.mm}"`, bar fully Sampai.
- Rows marked Gagal diantar: excluded already by `kitchenSession`; nothing extra shown here (LiveSlot owns exceptions).
- Accessibility: the bar is one `accessibilityRole="image"` with label `"{arrived} sampai, {out} diantar, {cooking} dimasak, dari {total}"`; legend cells are hidden from the reader (the label already says it).
- Large text (font scale 1.3): legend cells wrap to two lines inside their column; nothing clips.
- light/dark × Siang/Malam: segment colours from mood tokens; record ratios.

- [ ] **Step 1: Write the failing tests** in `batch-progress.test.tsx`: `batchCounts` on a session built from `canvasDay()` with stages set to 3 preparing, 12 out_for_delivery, 10 arrived, 6 delivered → `{ total: 31, cooking: 3, out: 12, arrived: 16 }`; render shows `"16 dari 31 sampai"` and `"terakhir 10.42"` when the latest `arrivedAt` is `2026-10-08T03:42:00Z`; all scheduled renders nothing (`queryByTestId("batch-progress")` null); a session with 2 rows marked issue and 5 delivered reads `"5 dari 5 sampai"`.
- [ ] **Step 2: Run** `npm test -w @catera/caterer -- batch-progress` → FAIL (module missing).
- [ ] **Step 3: Implement** `batchCounts` and `BatchProgress` in `BatchProgress.tsx`; mount it in `HeaderFigures` in place of `RantangTrack`, keyed as today (`${date}:${meal}`). Update `TodayCountSkeleton` and any test asserting the track (`today.test.tsx`, `skeletons.test.tsx`).
- [ ] **Step 4: Run** `npm test -w @catera/caterer` and `npm run typecheck -w @catera/caterer` → PASS.
- [ ] **Step 5: Commit** `feat(dapur): batch progress counts replace the rantang track in Hari ini`.

### Task 2: Stop status and order-first while delivering

**Files:**
- Modify: `packages/mobile-ui/src/StopRow.tsx` (Dapur geometry: optional `status`)
- Modify: `apps/caterer/src/today/DeliveryOrder.tsx:130-170` (`stopRow` passes `status`)
- Modify: `apps/caterer/src/today/SessionCard.tsx:80-175` (section order)
- Test: `apps/caterer/tests/stop-status.test.tsx`

**Interfaces:**
- Consumes: `Stop.stage: JourneyStage`, `Stop.arrivedAt: string | null` from `@catera/domain`.
- Produces: `StopRow` prop `status?: { label: string; tone: "cooking" | "out" | "arrived" }`; `export function stopStatus(stop: Stop, t: T): { label: string; tone: ... } | null` in `apps/caterer/src/today/stopStatus.ts`.

**Depends on:** none · **Builder:** `sonnet`

**States:**
- Session all scheduled: no stop has a status (returns `null` for `scheduled`).
- `preparing` → `"Dimasak"`; `out_for_delivery` → `"Diantar"`; `arrived` and `delivered` → `"Sampai {HH.mm}"` (or `"Sampai"` with no time).
- A stop that has arrived draws its number badge in the muted style (`muted` ink on `line` fill) so the eye goes to stops still out.
- The pill is one more line under the address (after the note when there is one); it is in the row's accessibility label.
- Pilih mode: pills stay; the disabled note keeps its place under them.
- Section order: when `counts.out_for_delivery + counts.arrived + counts.delivered > 0`, `DeliveryOrder` renders before the cooking list or the cooked summary; otherwise the order stays as today.
- light/dark × Siang/Malam: pill fills from tokens (`sage`/`scheduled` family for Dimasak, an attention tint with `sunriseInk` text for Diantar, `forest` fill with `cream` text for Sampai); record ratios.

- [ ] **Step 1: Write the failing tests**: `stopStatus` for each stage; a rendered `SessionCard` mid-run has `getByTestId("delivery-order")` before `getByTestId("cooking-list")` in tree order and stop 1's label contains `"Sampai 10.21"`; all-scheduled has the cooking list first and no `"Diantar"` text.
- [ ] **Step 2: Run** `npm test -w @catera/caterer -- stop-status` → FAIL.
- [ ] **Step 3: Implement** `stopStatus`, the `StopRow` `status` prop (Dapur geometry only; the 44 geometry ignores it like `note`), and the order switch in `SessionCard`.
- [ ] **Step 4: Run** the caterer and customer suites (`npm test -w @catera/caterer`, `npm test -w @catera/customer`; StopRow is shared) and typecheck → PASS.
- [ ] **Step 5: Commit** `feat(dapur): each stop shows its status, and the order leads once stops leave`.

### Task 3: Week strip

**Files:**
- Create: `apps/caterer/src/today/WeekStrip.tsx`
- Modify: `apps/caterer/src/today/TodayScreen.tsx:299-465` (offset `0..6`, title, strip, notification target, DoneCard)
- Modify: `apps/caterer/src/today/SessionCard.tsx:72`, `DeliveryOrder.tsx:82` (`report: "today" | "later" | null`, renaming `"tomorrow"`)
- Test: `apps/caterer/tests/week-strip.test.tsx`; update `today.test.tsx` (`CHANGE_DAY` toggle tests become strip tests)

**Interfaces:**
- Consumes: `runtime.api.sellerCalendar(catererId, { from, to, meal, status: "active" })` → `SellerCalendar.days: { date; orders }[]`; `jakartaDay(now, offset)`, `shortDate`.
- Produces: `export function WeekStrip({ selected, onSelect, counts }: { selected: number; onSelect: (offset: number) => void; counts: Record<string, number> | null }): JSX.Element`; `export function weekOffset(target: string | undefined, now: Date): number` (0–6, else 0).

**Depends on:** Task 1 (both edit `TodayScreen` header; serialize) · **Builder:** `sonnet`

**States:**
- The header title is the plain date `shortDate(date)` (no chevron, no button). The meta line's day word: offset 0 `"Hari ini"` (or `"Sedang diantar"` as today), 1 `"Besok"`, 2–6 the full weekday (`"Senin"`).
- Strip: seven equal cells under the title, each ≥ 48 tall, weekday (`"Jum"`), day number, and the meal's order count, or `"–"` when 0. Selected cell filled `forest`/`cream` (mood tokens on Malam); others the sage surface. `accessibilityRole="tab"`, `accessibilityState={{ selected }}`, label `"Jumat 30 Oktober, 28 pengantaran"` / `"…, tidak ada pengantaran"`. Haptic `select` on change.
- Counts: one `useData` key `cal:${catererId}:${from}:${meal}`. While loading or on error, cells render without the count line (same height); no error banner for the strip alone. Pull to refresh reloads it.
- Siang/Malam toggle: counts switch to that meal; the selected day stays.
- Future day (offset ≥ 1): `report="later"`, no footer action, no Pilih, no proof-photo note, ⋯ keeps Pindah tanggal (as Besok does today); attention and issue cards show only on today (as now).
- `DoneCard` "Lihat besok" selects offset 1. A notification `date` 0–6 days ahead selects that offset; anything else selects 0.
- Narrow phone (320 wide) and font scale 1.3: cells shrink equally; weekday and count stay on one line each (`adjustsFontSizeToFit` with a floor of 0.85); no horizontal scroll.
- light/dark × Siang/Malam.

- [ ] **Step 1: Write the failing tests**: `weekOffset("2026-10-12", 2026-10-08T03:00Z)` → 4; `weekOffset("2026-10-20", …)` → 0; `weekOffset(undefined, …)` → 0; render `TodayScreen` with a calendar returning `{ date: "2026-10-09", orders: 28 }` and `getByRole("tab", { name: /28 pengantaran/ })`; pressing that tab requests `sellerOperations(…, "2026-10-09")`, the meta reads `"Besok"`, and there is no `"Mulai masak"`; calendar rejecting still renders seven tabs; toggling the mood re-requests the calendar with `meal: "dinner"` and keeps the selected tab.
- [ ] **Step 2: Run** `npm test -w @catera/caterer -- week-strip` → FAIL.
- [ ] **Step 3: Implement** `WeekStrip`, `weekOffset`, the `TodayScreen` changes and the `"later"` rename.
- [ ] **Step 4: Run** `npm test -w @catera/caterer` and typecheck → PASS.
- [ ] **Step 5: Commit** `feat(dapur): Hari ini shows the next seven days, read-only past today`.

### Task 4: Belanja 7 hari

**Files:**
- Modify: `packages/domain/src/kitchen.ts` (add `weekRecap`)
- Create: `apps/caterer/app/(tabs)/(index,pelanggan,menu,usaha)/belanja.tsx` (route only, renders the screen)
- Create: `apps/caterer/src/today/BelanjaScreen.tsx`
- Modify: `apps/caterer/src/today/TodayScreen.tsx` (entry row under the header figures), `apps/caterer/src/hrefs.ts` (href), `apps/caterer/app/(tabs)/(index,pelanggan,menu,usaha)/_layout.tsx` (native title `"Belanja 7 hari"`)
- Test: `tests/kitchen.test.ts` (vitest), `apps/caterer/tests/belanja.test.tsx`

**Interfaces:**
- Consumes: `cookingRecap(state, meal)` per day and meal.
- Produces: `export function weekRecap(days: SellerOperationsState[]): { total: number; byDish: { name: string; category: string; count: number }[]; unfilled: number; from: string; to: string }`, dishes merged by `name + category`, sorted by category then count descending.

**Depends on:** Task 3 (entry row sits under the strip in `TodayScreen`) · **Builder:** `sonnet`

**States:**
- Entry row on Hari ini (every day of the strip, owner and helper): one `LinkRow`-style row, glyph + `"Belanja 7 hari"` over `"Porsi per menu, {shortDate(from)} sampai {shortDate(to)}"`, chevron, ≥ 48.
- Screen loading: skeleton rows; no spinner.
- Any of the seven reads fails: `ReadError` with `"Rekap belanja belum bisa dimuat."` and Coba lagi; no partial list.
- Empty (no deliveries in seven days): `StateArt pose="tidur"` and `"Belum ada pesanan 7 hari ke depan."`
- Filled: header figure `"{total} porsi"` with the date range; sections per category (`SectionHeader`), rows `KeyValueRow` dish → `"{count} porsi"`; when `unfilled > 0`, one bold row `"Menu belum diisi · {unfilled} porsi"` (owner gets `"Isi menu"` to `/menu`).
- Native header actions: Bagikan (WhatsApp-ready text, Indonesian whatever the app language, like `recapLines`) and Cetak (`expo-print`), as `SessionCard` does.
- Large text, 320 wide, light/dark × Siang/Malam.

- [ ] **Step 1: Write the failing tests**: vitest `weekRecap` over two `canvasDay`-style states sharing "Ayam bakar madu" sums its count and keeps one row; unfilled slots add to `unfilled` and never appear in `byDish`. Jest: `BelanjaScreen` with seven resolved days shows `"Ayam bakar madu"` and its total; one rejected day shows `"Rekap belanja belum bisa dimuat."` and no dish rows; Hari ini's entry row navigates to `belanja`.
- [ ] **Step 2: Run** `npx vitest run tests/kitchen.test.ts` and `npm test -w @catera/caterer -- belanja` → FAIL.
- [ ] **Step 3: Implement** `weekRecap` (export it from `packages/domain/src/index.ts` if not covered by `export *`), the route, the screen, the entry row and the header title.
- [ ] **Step 4: Run** domain and caterer suites and typecheck → PASS.
- [ ] **Step 5: Commit** `feat(dapur): Belanja 7 hari recaps portions per dish for the week`.

### Task 5: Gate and DESIGN.md

**Depends on:** Tasks 1–4 merged · **Builder:** gate on `opus`; DESIGN.md writer `sonnet`, re-review `opus`

- [ ] **Step 1:** Read-only emulator gate on the merged head (Android, then iOS if available), demo data, contact sheet per screen: Hari ini today before cooking, mid-run, all arrived, a future day, Malam, dark, font scale 1.3, 320 wide; Belanja filled, empty, error. Contrast, tap targets and truncation measured by script.
- [ ] **Step 2:** Failures go back to the owning task as an `opus` fix round; re-gate only the failures.
- [ ] **Step 3:** One `sonnet` dispatch writes DESIGN.md from the approved Doc facts: the week strip, BatchProgress (RantangTrack now customer-only, with the reason), stop status pills, Belanja. `opus` re-review. Commit `docs: DESIGN.md records the Dapur week strip and batch progress`.
- [ ] **Step 4:** `npm run typecheck && npm test && npm run build` on v2 → PASS.
