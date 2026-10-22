# Customer app layout rethink: design spec, 2026-10-23

Scope: the customer app (`apps/customer`) only, layout only (sizing, spacing, density, hierarchy, placement). Colour, palette K, artwork, naming, copy glossary, motion rules, server rules, the four tabs and their names stay. Catera Dapur keeps its current layout until its own pass.

Inputs: [research synthesis](../research/2026-10-22-layout-synthesis.md) (audit, 15 patterns, scale 3.1, directions 3.2, owner answers section 4), [code inventory](../research/2026-10-22-customer-layout-inventory.md), and the before/after canvas `https://claude.ai/artifact/9xLxNe1qsVGA7QH6TWaWrT` (22 boards; the after boards are the visual contract for this spec). Before captures: `output/native-review/layout-2026-10-22/before/`.

## 1. Owner decisions

1. 2026-10-22: re-layout and move content; tabs and names stay. Mood header shrinks into a food-led hero (mood tint and day statement kept as its caption; the arc becomes a compact two-stop status line). Balanced density. Design for one plan, sometimes two; several plans get a compact rail; the 8-plan demo is the stress test.
2. 2026-10-23: **Jelajah option B** (2-column grid). **Side margin 16** first (the canvas tweak offered 16 or 20; 20 stays a one-constant switch).
3. Skills: `ui-ux-pro-max` plus `design-taste-frontend` app-screen rules (`references/app-screens.md` sections 2.2 and 7: one question per screen, the biggest block carries it, cap lists, row geometry) for this work; superpowers process skills throughout.

## 2. The native layout scale

One source: a new `nativeLayout` export in `packages/design-tokens/src/index.ts`, read through `packages/mobile-ui`.

| Token | Value |
|---|---|
| space | 4, 8, 12, 16, 24, 32, 48 |
| margin (screen side) | 16 (customer, from `LayoutScale`), 20 elsewhere until opted in |
| section gap / heading to content / in group | 32 / 12 / 8 |
| card padding | 16 |
| radius | 8 small and thumbs, 12 control and tiles, 16 card, 24 sheet; buttons fully round |
| controls | button 50, field 50, search 44, chip 34, icon button 44 (visual circle may be 32-36 inside a 44 target) |
| rows | 56 single line, 72 two lines with a 56 thumb (radius 8); rich key-value rows 40; info rows with icon 48 |
| photo ratios | hero 4:3, card and sheet 16:10, grid tile 4:3, dish 1:1, thumbs 56 and 64 square |

Type ladder (new `Text` variants; existing variants keep their values so Dapur does not move):

| Variant | size / line / weight / tracking |
|---|---|
| `largeTitle` | 32 / 40 / 700 / -0.8 |
| `heroTitle` | 24 / 30 / 700 / -0.4 |
| `section` | 20 / 26 / 700 / -0.2 |
| `rowTitle` | 17 / 22 / 600 |
| `bodyL` | 15 / 22 / 400 (and a 600 `bodyStrong`) |
| `meta` | 13 / 18 / 400, muted |
| tab labels | platform tab bar, unchanged |

Prices and operational numbers keep tabular figures; footer prices use `section` at 800.

**Opt-in.** Shared components read a `LayoutScale` context (`'classic' | 'v2'`, default `'classic'`). The customer root layout provides `'v2'`; Dapur provides nothing and keeps today's geometry. Under `'v2'`: `Screen` side padding 16 (body gap stays 16; each redesigned screen spaces its own sections at 32); `Button` 50 tall, fully round; `Chip`/`FilterChip`/`Segmented` 34 tall, fully round; `Field` 50; search 44; `Card` radius 16, padding 16, no 1px border (tone step on the canvas, per palette K). Skeletons read the same constants instead of restating sizes.

## 3. Screens

Each section lists the order top to bottom. "Keep" means behaviour, data and copy are unchanged; only geometry moves.

### 3.1 Beranda (canvas boards Beranda-Satu, -Dua, -Delapan)

1. **Mood band** (full bleed, mood `header` tint): status inset, then date line (`meta`, sun or moon glyph) and the day statement in `section` 20/26, one line where it fits. The band's bottom 104 sits behind the hero (overlap replaces the 58/-74 magic numbers with one constant).
2. **Hero card** (the existing `Plate` hero, regeometried): photo full width at 4:3 on top, radius 16, 1.5 `heroEdge`, `heroShadow`; body padding 16, gap 12: meal line (`meta`), dish (`heroTitle`), the **two-stop status line**, then the hero's existing action area. Keep every Plate state: tracker, answer buttons, reactions, proof photo, chat and report, kept-copy offline. The HeroPager stays for several plates of the chosen meal, with the new card geometry.
3. **Two-stop status line** replaces `MoodArc` on Beranda: Siang stop and Malam stop on one row (40 tall) joined by a 2dp track; each stop is a dot (current `stopActive` with a 4dp halo; next: ink ring; none: `controlRing` ring) over `bodyStrong` label "Siang 11.00–13.00" and a `meta` state line ("Sedang diantar", the other meal's dish, or "Tidak ada"). Each stop is a 44+ target and calls `useMood().setMood` exactly as the arc does today (it is the app-wide Siang/Malam switch; same accessibility semantics: tablist, selected stop). The other meal's `NEEDS_YOU` sentence (today's `OtherMealRow`) becomes that stop's meta line, so `OtherMealRow` goes. The status line sits in the hero body; when there is no hero it sits alone under the band.
4. **One live slot** (replaces the `WaitingList` stack): a 72 row card showing the most urgent waiting item (existing ordering) with its existing action as a trailing text action, and "n hal lainnya" in its meta line when more exist; tapping that opens the full list (a pushed list screen reusing today's WaitingList rows). Hidden when nothing waits.
5. **Berikutnya** (merges `TomorrowEntry` and `UpcomingDays`): `section` heading with trailing "Lihat jadwal" link; at most **3 delivery days**.
   - When every shown day has one delivery: one card of 72 rows: date column 36 wide (`meta` weekday over `section` day number), thumb 56 (dashed `controlRing` tile with utensils glyph when the menu is not set), dish `rowTitle`, `meta` "Besok · Siang 11.00–13.00".
   - When a day has 2 or more deliveries: day blocks: `rowTitle` day label with `meta` "n pengantaran" at right, a 2-column grid (gap 12) of at most 2 tiles (photo 16:10 radius 12, `bodyStrong` dish one line, `meta` "Siang · caterer"), then "+n lagi" as a 36 tall link row when more exist. A meal slot with no delivery shows a canvas-tone tile "Malam tidak ada pengantaran".
6. **Paket kamu** (`PlansRow`): 1 or 2 plans: one card of 72 rows (thumb, name, "caterer · sisa n hari", chevron). 3 or more: heading "n paket aktif" with "Lihat semua", then a horizontal rail of 168 wide cards (photo 16:10 radius 12, name, "caterer · selesai besok / sisa n hari"), gap 8, sorted by soonest end.
7. Keep: empty home (`EmptyHomeBody`), signed out, loading skeleton (rebuilt to these sizes), read error, connection banner, stale copy, recap card (between hero and live slot), dark theme, Malam mood.

### 3.2 Jadwal (boards Jadwal, Jadwal-Lembar)

1. Mood band holds the month: title row (`heroTitle` month, two 44 chevrons), weekday row (`meta`, 20 tall), grid cells 40 tall with the number at 15/500; selected day a filled forest 32 circle with cream number; today a forest ring; a delivery day a 6dp dot under the number (past days muted dot); a day whose menu is not set a 6dp `controlRing` ring; no dashed rings. Render only the weeks the month needs (5 or 6). Legend in `meta` with 6dp swatches.
2. **Agenda** below the band: `section` "Minggu ini" (or "Minggu 26 Okt–1 Nov") with the range in `meta`; one block per delivery day of the selected day's week: `bodyStrong` day label ("Kamis 22 Okt · Hari ini"), card of 72 meal rows (thumb 56, dish `rowTitle`, `meta` "Siang 11.00–13.00 · state", chevron). Days with nothing are collapsed into one muted 56 row ("Sabtu dan Minggu tidak ada pengantaran"). Last a 56 link row to the next week. Selecting a date selects its week.
3. **Day detail** opens as a form sheet (radius 24, handle 32x4) instead of a pushed screen: photo 16:10 radius 16, `meta` date · meal · caterer, `heroTitle` dish, a state line with dot ("Terjadwal 11.00–13.00 · bisa diubah sampai hari ini 17.00" from the existing cut-off data), the address row (56, canvas-tone well, pin glyph), then **visible actions** as 56 circles with `meta` labels in one row: Ubah hari, Lihat menu (or Pilih menu for pick-your-own packages), Ada masalah; chat keeps its existing entry beside them when a number exists. The `DayMore` ⋮ and the text-link "Ada masalah" are removed. Keep each action's existing conditions (closed day hides Ubah hari, etc.).

### 3.3 Jelajah (board Jelajah-B)

1. Header (no tall mood stack): 44 row with the area chip (34, pin, label, chevron) and the saved heart (44); `heroTitle` question ("Makan siang minggu depan?", one line); search pill 44.
2. One horizontal chip row (34, gap 8): the Siang/Malam **segmented chip** first (selected: forest 1.5 ring and forest label), then the filter chips, then the categories as chips (the 66 rings go).
3. **Grid**: 2 columns, column gap 12, row gap 20. Tile: photo 4:3 radius 12; heart top-right, 44 target with a 32 surface circle; name `bodyStrong` up to 2 lines; caterer `meta` one line; price `bodyStrong` 700 with `meta` "/ makan"; `meta` "± 610 kkal · coba 1 hari" (or the existing no-trial wording). Target: 4 packages fully above the fold at 412x915.
4. Keep: empty and filtered-empty states, save error, loading skeleton (rebuilt as a grid), area picker sheet.
5. The Saved list (`Disimpan`) uses the same tile grid.

### 3.4 Package detail (board Paket)

Bleed hero photo 4:3 under the transparent bar (existing top scrim), back and heart as 44 surface circles. Then: `heroTitle` name, `meta` caterer line; a **3-stat strip** (one card, three columns: kkal range, protein range, meals a day; numbers `section` 800, labels `meta`) replacing the 2x2 `NutritionCard`, with carbs and fat as one `meta` line under it; description `bodyL`; "Isi paket" `section` + card of 72 rows (40 circle with the meal glyph on the mood tint, meal `rowTitle`, slot list `meta`); "Pengantaran" `section` + icon info rows 48 (`bodyL`) replacing the 12pt label/value table; reviews keep their block. Sticky footer 82: price `section` 800 + `meta` unit at left, "Coba 1 hari" outlined and "Pilih jadwal" primary (both 50) at right.

### 3.5 Akun and Paket saya (boards Akun, Paket-Saya)

Akun: avatar 56 (initials) beside the name in `heroTitle`; three shortcut tiles (gap 8, radius 16, min 96 tall, glyph over `bodyStrong` label and `meta` count): **Paket saya** ("n aktif"), **Alamat** ("n tersimpan"), **Riwayat** ("Pembayaran"); then one card of 56 rows with leading glyphs: Data akun, Disimpan, Notifikasi, Bantuan dan laporan; then a separate card row: Pengaturan ("Bahasa, tampilan"). The settings gear goes. Active plans leave Akun.

Paket saya (the existing plan-list route, retitled): `section` "Aktif" with "n paket", card of 72 rows sorted by soonest end. A "Selesai" section only if the API already returns ended plans; no new endpoint in this phase.

### 3.6 Plan detail (board Rencana)

Native bar title = package name. Hero card: photo 16:10, `meta` caterer · meal, `heroTitle` "n hari lagi", `meta` date range. "Berikutnya" `section` + card of 72 rows: thumb 56, date `rowTitle` ("Besok, Jumat 23 Okt"), dishes in one truncated `meta` line, chevron (full list in the day sheet). The per-row ⋮ goes (actions live in the day sheet). Keep the sticky action and its conditions.

### 3.7 Buy (board Beli)

Summary card (64 thumb, name `rowTitle`, caterer and price `meta`); one card of field rows with 40 glyph circles: Mulai (72: label, date `bodyStrong`, range `meta`, trailing "Ubah"), Lama paket (56, or the existing `LengthOptions` when offered), Porsi per hari (56 with 44 stepper buttons), Diantar ke (72, trailing "Ganti"); "Rincian" `section` + card of 40 rows in `bodyL`; "Bayar dengan" `section` + the existing PayWith content; terms `meta`. Footer: "Total" `meta` over the amount in `section` 800, primary "Bayar" 50 at right. Keep pending payment, quote error and still-running blocks.

## 4. Out of scope

Payment screens beyond Buy, Pengaturan internals, Masuk, Bantuan, Alamat editor (they inherit the scale through shared components only), Dapur, iOS-specific tuning (iOS inherits; not verified, no Mac), any server or data change.

## 5. Acceptance

- `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites pass with no new failures against the recorded baseline.
- Emulator gate (Pixel 8 API 36, Expo Go, demo customer): every screen in section 3 captured at 1080x2400 in light Siang, plus Beranda and Jadwal in dark and Malam, plus font scale 1.3 for Beranda, Jelajah and Buy; contact sheets compared against the canvas boards; tap targets >= 44 and no truncated primary label by script.
- Beranda one-plan and 8-plan both render (demo customer is the 8-plan case; one-plan via a demo account or fixture if one exists, else Jest render).
- DESIGN.md gains a "Customer layout scale (October 2026)" section after the gate.
