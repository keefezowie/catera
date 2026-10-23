# Catera Dapur layout inventory (2026-10-24)

Read-only map of how `apps/caterer` lays things out, for a designer rethinking sizing, spacing, density, hierarchy and module placement. Branch `v2`. Colour is out of scope. Paths are repo-relative. "Est." marks my own arithmetic; every other number carries a file:line I read. Template: `2026-10-22-customer-layout-inventory.md`.

Assumptions for every y estimate: 412x916dp Android, font scale 1.0, Indonesian copy (English adds a second label line to the rantang track, +18). Status inset 50. Demo strip 24 when shown (it owns the inset; `MoodHeader` then pays 0 itself, `moodHeaderTopInset` `screenInsets.ts:26`, so everything starts 24 lower). Tab screens: NativeTabs bar 80 + 24 inset, fold at y=820. Pushed screens inside a tab keep the bar (fold 820); root-stack modals (Aktifkan, Impor, Pindah tanggal) cover it (fold about 892). Android stack header = 56 + 50 inset = 106 (est.); an Android `nativeTitle` line adds 36 (4 + 32, `components.tsx:792-793`); a screen body starts 16 below (`components.tsx:790`). Sheets are not laid against the fold; sheet heights are est. contents.

## 1. Tokens and primitives

### 1.1 What Dapur reads

- Dapur mounts no `LayoutScaleProvider`: grep of `apps/caterer` finds none (the only mount is `apps/customer/app/_layout.tsx:201`). The context default is `"classic"` (`packages/mobile-ui/src/layoutScale.tsx:11`), so `useScreenMargin()` returns 20 (`:8,23-25`). Confirmed.
- Dapur imports no `nativeLayout`; grep of `apps/caterer` for it is empty. `nativeLayout` (`packages/design-tokens/src/index.ts:302-314`): space 4/8/12/16/24/32/48, margin 16, sectionGap 32, headingGap 12, groupGap 8, cardPadding 16, radius thumb 8 / control 12 / card 16 / sheet 24, control button 50 / field 50 / search 44 / chip 34 / icon 44, row single 56 / media 72 / keyValue 40 / info 48, thumb 56/64, ratio hero 4:3, card 16:10, tile 4:3.
- Only these shared parts branch on the scale: `Button, Chip, Segmented, Card, Field, Stepper, Screen, ScreenFooter` (`components.tsx:172,237,268,306,337,389,482,637`, all `=== "v2"`), `MoodHeader` (`MoodHeader.tsx:194`), `AuthScreen` (`AuthLayout.tsx:168`), `HeroPager` (margin only). Sheets (`SheetHeader.tsx`), `StopRow`, `CheckRow`, `RantangTrack`, `Skeleton`, `ConnectionBanner`, `ReadError`, settings rows and `StateArt` read no scale: they would not change under `v2`.
- Dapur uses none of the v2 variants (`largeTitle, heroTitle, section, rowTitle, bodyL, bodyStrong, meta`, `components.tsx:50-56`): 0 hits in `apps/caterer`. Dapur uses `hitSlop` 0 times and `aspectRatio` 0 times.

### 1.2 Classic (Dapur today) against v2 (customer), per primitive

| Primitive | Classic, what Dapur renders | v2 | Source |
|---|---|---|---|
| Screen body | side 20, top 16, gap 16, max 760; scroll bottom 32 | side 16, same top/gap; bottom 32 + inset off-tab | `components.tsx:562,571,790`; `layoutScale.tsx:7` |
| ScreenFooter | surface fill, padding 16, bottom 20, 1px line top, gap 8 (iOS adds safe bottom) | canvas fill, bottom 16 (+inset off-tab), hairline only in light | `:794-804` vs `:716` |
| Button | minHeight 48, r10, padH 18, label 15/700; text variant padH 4, 48 | minHeight 50, r25 (pill) | `:737-749` vs `:704` |
| Chip | 48, r9, padH 14, label 13/700, no hitSlop | 34, r17, hitSlop 5 top/bottom | `:750-753` vs `:705,220` |
| Segmented | track pad 4 gap 4 r10; segment 48 r8 | segment 34 r17, track r21 | `:754-761` vs `:707-708` |
| Card | border 1, r16, pad 16, gap 10 | r16, pad 16 minus edge, gap 8 | `:763` vs `:712` |
| Field | label 13/700, label-to-input gap 6, input 48 r9 padH 14 text 15, hint/error 12 | input 50 | `:340,764-778` vs `:709` |
| Stepper | minHeight 52, padL 14 padR 4, 48x48 buttons, glyph 22 | 56, circles 44, value 17/22 | `:779-787` vs `:718-723` |
| MoodHeader | top 12 + inset, bottom 16 (+overlap), content gap 12, 48 row always drawn, r28, side 20 | 44 row (none when empty), 16 top, side 16, `band` 36 | `MoodHeader.tsx:25,197,202-203,214-218,235` |
| Text | display 34/40, title 30/39, heading 21/28, body 14/23, label 12/23, caption 11/18, number 40 (no lineHeight) | same plus 7 new variants | `components.tsx:39-57` |
| Skeleton | radius 8 default, fixed heights | same | `Skeleton.tsx` |
| Sheet side pad | 20 iOS / 24 Android, body top 4, gap 16, foot inset + 24 | same (no branch) | `SheetHeader.tsx:333,474-477` |
| SheetHeader | iOS pad 12/8 around a 44 row, title 17/22 centred; Android 36 handle slot, title 22/28 left, pad H 24 B 12; context 14/20 | same | `:66,612-636,16` |
| Form detents | iOS [0.6, 1]; Android [1] only; fit; large [1]; day [0.75, 1] | same | `nativeHeader.ts:68-98` |
| ConfirmSheet | circle 56, title 20/28 iOS 22/28 Android, message 15/22, buttons 50 iOS / 48 Android, r10 | same | `ConfirmSheet.tsx:12,63-96,124-133` |
| StopRow | min 56, badge 28, two 48 round buttons, gap 12 | same | `StopRow.tsx:7,45,135-136` |
| CheckRow | min 56, qty `heading` min 40, photo 44 r10, box 48, gap 12 | same | `CheckRow.tsx:12-13,77-81,91` |
| RantangTrack | rail 64 (24+4+36), disc 28, ring 36, line 2, gap 8 | same | `RantangTrack.tsx:28-34,214,224` |
| Settings rows | iOS 52 r16 inset 16, label 13/18; Android 56 (72 two-line) inset 20, label 14/20 | same | `SettingsRows.tsx:20,40-41,55,196` |
| Stack header | iOS large 34 / inline 17; Android bar title 22; content title 24/32 | same | `nativeHeader.ts:42-49`; `components.tsx:793` |
| Tab labels | 12 Android / 10 iOS | same | `tabBar.ts:38-39` |
| StateArt | 120 (96 at <=360dp and fontScale >=1.3); count card 72 (58) | same | `StateArt.tsx:11,13,23` |
| DemoStrip | inset + 24 | same | `DemoStrip.tsx:8` |

### 1.3 Type as Dapur uses it (variant counts in `apps/caterer/src` + `app`)

caption 76, no-variant body 55, label 29, heading 15, title 2 explicit (`Daftar.tsx:66`, `TodayScreen.tsx:469`; the string titles of the Pelanggan and Usaha headers default to it), display 1 (`MenuWeek.tsx:80,453`), number 2 (`TodayScreen.tsx:121`, `UangScreen.tsx:39`). Emphasis is hand-rolled: `fontFamily: fontFor("800")` on a 14/23 body appears 9 times as the "row title" (`CustomerList.tsx:118`, `ExceptionSheet.tsx:191,219`, `ProofSheet.tsx:90`, `ReportScreen.tsx:245`, `SessionCard.tsx:60`, `TodayScreen.tsx:620,678,724`). `fontFor("700")` 8 more. The two biggest data figures (portions 40, payout 40) sit beside 12/23 `label` figures (every Uang row value, `UangScreen.tsx:53`; the "Antar 10.30" time, `TodayScreen.tsx:138`).

### 1.4 Named layout constants inside Dapur

| What | Value | Where |
|---|---|---|
| Day-strip button | min 64, width computed, slot 54, gap 6, r16, border 2, pad V 6 | `MenuWeek.tsx:98-101,494-503` |
| Dish photo/row slot | 48, r12 | `MenuWeek.tsx:96,120-160` |
| Cover story | width min(220, w-74), height x1.25 | `MenuWeek.tsx:435,628` |
| Import thumb / tile room / remove target / badge | 76 r12 / 10 / 48 / 28 | `Attachments.tsx:11-21` |
| Count-card mascot | 72 | `TodayScreen.tsx:65` |
| Stops shown before "Lihat n alamat lainnya" / note indent | 3 / 40 | `DeliveryOrder.tsx:17,21` |
| Stack thresholds (effective width = width / fontScale) | 340 (count caption, selection bar), 400 (proof tile) | `TodayScreen.tsx:102`, `SelectionBar.tsx:80`, `ProofSheet.tsx:50` |
| Nutrition field bases | 140 and 92, times fontScale | `NutritionFields.tsx:31` |
| Package photo | height 168, r14 | `PackageDetail.tsx:22`, `PackageEditor.tsx:130` |

## 2. Hard-coded sizes (src + app), by file

Flags: **G** off the 4/8 grid, **T** duplicates a `nativeLayout` token or a shared constant, **S** duplicates a size another Dapur file also sets. Skeleton sizes are in their own block.

- `today/TodayScreen.tsx`: count card gap 16 / pad 16 / **r22 G** (:113); row gap 12 (:118); footer gap 8 (:260); DoneCard gap 12 (:312); date button minHeight 48 gap 8, chevron 22 (:467,472); body gap 16 (:502); report card text gap 2 (:619); attention gap 10 **G** (:677); chevrons 18 (:629,681); MulaiCard step minHeight 56 **T**, pad 12, r12 **T**, gap 2 (:717-721); `COOKING_ART` 72 (:65).
- `today/SessionCard.tsx`: recap Row padV 8 + 1px bottom border (:54-55, 40 tall with the 23 line); missing-menu padTop 8 (:123); button row gap 8 (:140).
- `today/DeliveryOrder.tsx`: order gap 12 (:123); header row minHeight 48 (:124,149); stop padV 4 + 1px top border (:168); note padL 40 padB 8 (:192); route buttons gap 8 (:216).
- `today/ExceptionSheet.tsx`: option box pad **14 G**, r12 **T**, border 1, gap 2 (:189); move option minHeight 48, pad **14 G**, r12, gap 8 (:207-215); chevron 18 (:227); skeleton 64/64/48 r12 (:162-164).
- `today/ProofSheet.tsx`: tile gap 12, pad 12, r12, border 1 (:57-60); photo 64 r10 (:68-70,82); camera glyph 26 (:86); text gap 2 (:89); skeleton 88 r12 (:242-243).
- `today/MoveSheet.tsx`: skeleton 48 / 240 / 48 r12 (:120-122). `today/ReportScreen.tsx`: status pill padH 12 padV 4 r999 (:254); reply field minHeight 88 padTop 12 (:283); skeleton 96 r14 **G**, 14, 88, 48 (:162-165).
- `today/SelectionBar.tsx`: gap 8 (:82,86).
- `menu/MenuWeek.tsx`: DishRow gap 12 minHeight 48 (:120); "Tambah foto" pill minHeight 48 padH 16 r999 gap 8 (:174-179); dashed tile r12 border **1.5 G** (:151-153); step button 48 (:422); title row minHeight 48 gap 4 (:451); day button padV 6 **G**, r16, border 2 (:500-503); check glyph 14, gap **3 G** (:514,522); chip scroller gap 8 (:545); button row gap 8 (:550); block gap 16 (:393,540,572); group gap 8 (:581).
- `menu/SlotEditor.tsx`: group gap **18 G** (:53), line gap 8 (:127); slot row minHeight 48 padL **14 G** r**10 S** (:137-141); remove 48x48, glyph 18 (:151-153); input minHeight 48 r**10** padH **14** text **15** (:168-174); suggestion box r12 (:181); suggestion row minHeight 48 padH 12 (:187,196).
- `customers/CustomerList.tsx`: block gap 16, chips gap 8 (:97-98); row text gap 2 minHeight 48 (:116); caption row gap **6 G** marginTop 2 (:120); chat 48x48, glyph 22 (:137-139). `customers/CustomerDetail.tsx`: schedule row padV 8 (:130).
- `business/UsahaScreen.tsx`: Row gap 12 minHeight 56 **T** (:47); photo 40 r8 **T** (:50); glyph 22, chevron 18 (:52,58); card inner gap 10 (:117). `UangScreen.tsx`: money row padV **10 G**, 1px top border, gap 2 (:50). `TimScreen.tsx`: side `inset` 20/24 **T** re-derived (:28; also `settings/HapusAkun.tsx:14`) though `sheetSidePadding` is exported (`SheetHeader.tsx:333`); code box pad 16 r**14 G** gap 4 (:59). `AktifkanScreen.tsx`: form gap 10 (:105), step header gap 12 (:18). `PackageEditor.tsx`/`PackageDetail.tsx`: photo 168 r14 **S**. `NutritionFields.tsx`: row gap 8, form gap 12, switch row 48, text **15**, caption **13/19** (:29,33,44,46,113).
- `import/ImportAssistant.tsx`: textarea minHeight 160, r12, pad **14**, text **15**, border 1 (:272); mascot 120 (:236); row card gap 4 (:307). `Attachments.tsx`: doc row minHeight 52, gap 10, padL 12, padR 2 (:199-204). `PhotoViewer.tsx`: margin 20 pad 20 r12 (:43-45). `RowEditor.tsx`: gaps 12 and 8 (:49,153,166), skeleton 56/56/56/40 (:50-53).
- `auth/Masuk.tsx`: field gap **14 G** (:60,93), demo gap 8 (:138). `Daftar.tsx`: gap 8 (:65,89,91). `RoleGate.tsx`: gap 12 (:44). `app/_layout.tsx:138`: pad 24.
- `skeletons.tsx` (51 numbers; line = what it stands for): count card pad/gap 16, number block 36 in a 48 line, caption 10 in 18, track 64 rail + pad 14 + bar 8 (:41-60); Per-paket rows 40 (:88); checklist rows 56 with 44 photo, 48 circle (:100-106); menu chip **168x40 r20** (:148) against a real 48 r9 chip; copy/share 48 r12 (:152,156) against r10 buttons; day card rows 48 with 48 photo r12 (:177-178); list chips 48 r9 (:212); bare row 56 / 40 r8 (:218-219); Uang amount 36 in 48 (:241-250).
- Raw numeric `size`/glyphs: 14, 18, 20, 22, 24, 26 across rows (e.g. `MenuWeek.tsx:141,160,424`, `ProofSheet.tsx:86`).
- Radius census (non-skeleton `borderRadius`): 12 x11, 10 x3, 14 x3, 16 x1, 22 x1, 8 x1, 999 x2; plus shared 9 (Chip, Field), 10 (Button), 16 (Card), 28 (mood header). `Skeleton radius=` values: 12 x17, 5 x4, 7 x5, 6 x3, 20 x2, 4, 8, 9, 10, 14, 16, 22, 24.

## 3. Per screen, top to bottom

Heights are est. Header of a tab root = inset 50 + 12 + 48 row + 12 + title + (12 + children) + 16. Roles: `tabsForRole` owner = Hari ini, Pelanggan, Menu, Usaha; staff = Hari ini, Menu (`roles.ts:9-13`). A stop row has no per-row Berangkat/Sampai buttons: it has a 28 badge, text, a 48 map button and a 48 "…" (`StopRow.tsx:45,139`); Berangkat and Sampai are bulk, through "Pilih" and the footer `SelectionBar`.

### Tabs

**Hari ini** (`today/TodayScreen.tsx`). Header (mood, scrolls): row 48 (meta "Dapur · Hari ini/Besok/Sedang diantar" + toggle), date title button 48 (title 30/39 + chevron), `CountCard` (pad 16, row 72 holding number 40 / caption 18 / mascot slot 72 / "Antar HH.MM", gap 16, rantang track 139, pad 16 = 259). Header ends y=457 (en 475). With no session the card is absent: header 186 (:479).
Body (starts y=473, gap 16): [kept-copy/refresh caption 18] [read error with art about 234] [MulaiCard, new owner kitchen, about 293 + 126] [issues-read error] [report cards, attention Card each about 102, +20 once replied] [up to 3 action cards, 57-85 each] then exactly one of: `SessionCard`, `DoneCard`, empty meal card, "nothing to cook" card.
`SessionCard` (one Card, gap 10) before departure: meal label 23 | "Per paket" label + 40 per package | "Daftar masak" label + 56 per dish + caption 18 | missing-menu lines (23+, plus a 48 "Isi menu" text button for the owner) | Bagikan/Cetak 48 | Urutan antar (header row 48, first 3 stops about 64-77 each, "Lihat n alamat lainnya" 48, Maps 48 + WhatsApp 48, caption about 54). Typical 4 dishes, 2 packages, 4 stops: about 1025.
Fold (y=820), before departure: card top 473, label 490, Per paket 523-626, Daftar masak label 636, check rows from 659 (3 fit), then footer. The route is below the fold (Urutan antar starts about 970, est.). After "Berangkat antar" the cooking blocks vanish and the order starts at about 523, so 3 stops and the map buttons are above the fold.
Footer states (`KitchenAction`, :160-288): "Mulai masak" = 16 + 48 + 20 + 1 = 85, fold falls to y=735; "Berangkat antar · N porsi" / "Berangkat semua sisa · N porsi" adds a 2-line caption 36 + 8 = 129, fold y=691; "Sudah ditandai…" note adds 26. "Pilih" mode: `SelectionBar` 111 with no selection (caption 18), 85 with one, 141 when stacked below 340 effective width; the order shows all stops plus an area-run header row 48 per run and a top border on every stop (`DeliveryOrder.tsx:149,168`).
Variants: loading = `TodayCountSkeleton` (about 257) + `TodaySkeleton` Card; Besok drops reports, actions and Pilih; staff same screen without MulaiCard and without "Isi menu"; offline adds `ConnectionBanner` (about 80) and hides the footer; "Semua beres" `DoneCard` (sage Card, mascot 120, heading 28, text 23, button 48; about 289) replaces the SessionCard.

**Pelanggan** (`customers/CustomerList.tsx`, owner only). Header 177 (empty 48 row kept on purpose). Body from 193: "+ Pelanggan lama" secondary 48 (auto width, left), chips row 48 (3 chips wrap to a second row when counts grow, +56), customer Cards about 99 each at pitch 115 (padding 34, name 23, 2 caption lines, 18, chat 48). Fold shows about 4.5 cards. States: `ListSkeleton rows=4 chips=3`, error with art, "Belum ada pelanggan di sini." caption.
`pelanggan/[id]` (`CustomerDetail.tsx`): nativeTitle line, body from 158: subscription Card about 181 (label, heading, caption, renew Button 48, hint, FormError), WhatsApp secondary 48, address Card about 90, one schedule Card per package with a 39 row per delivery (unbounded, no cap).

**Menu** (`menu/MenuWeek.tsx`, owner and staff). Header: row 48 (week label + Siang/Malam toggle when the package serves both, staff gear), title row 48 (chevron 48, `display` week range, chevron 48), day strip (5 days: one row 64; 7 days: two rows 64 each + 6, because 7 x 54 = 378 > 372, `MenuWeek.tsx:437-439`), optional single-meal caption 18+12. 262 (5 days), 332 (7 days), +30 single-meal (est.).
Body from 278 (gap 16): package chips (horizontal scroll, 48) | Salin minggu lalu + Bagikan menu 48 (staff: Bagikan only) | 0-3 captions 18 | day Card: date heading 28, then per component group a caption 18 + DishRow (48 with photo, about 75 without photo for the owner because the 48 "Tambah foto" pill joins the text column) | "Ubah menu" 48 | second Card "Tampilan di aplikasi pelanggan": cover 220x275 + caption. Fold: day Card starts 406, 4 photo dishes end near 786, "Ubah menu" straddles the fold, cover Card is a full screen below.
`menu/[date]` (`MenuDayScreen` + `SlotEditor`, a page, not a sheet): bar title, body from 122: caption 18, then groups (label 23, 48 per chosen dish, a 48 input while slots are open, up to 4x48 + 48 suggestions), completeness caption, "Simpan menu" 48 inside the scroll (no pinned footer). Gaps 16 (page) over 18 (editor). Staff: read-only, no ×, no inputs, no Save.

**Usaha** (`business/UsahaScreen.tsx`, owner). Header 177 (row: meta + gear). Body from 193: optional payments attention Card about 176 | "Paket" Card (label 23, Rows 56 + a 48 "…" button each, gap 10, "+ Paket baru" 48; about 247 for 2 packages) | Card of 4 Rows 56 (Uang, Impor, Tim, Pembayaran; about 288) | Card with one Row (Pengaturan; 90). Total about 850 + 32: Pengaturan sits at the fold, hidden once the payments card shows.

### Root and pushed screens

- **Aktifkan** (`AktifkanScreen.tsx`, root modal, bar title). Body from 122: paragraph 69 | Step Cards: step 1 about 120, step 2 about 422 (3 Fields 72, Segmented 56, button 48), step 3 about 108. Fold 892: step 3 clipped.
- **Impor** (`ImportAssistant.tsx`, root modal, pinned footer 85 "Susun daftar"/"Simpan n pelanggan"). Body: paragraph 69, caption 36, textarea 160, Attachments (label 23 + 86 per tile row; docs 52), "+ PDF / Excel" 48. All above the fold (to about 616). Review stage: one Card per row, about 134-164 each, plus 3 buttons. Reading state puts a mascot 120 + 2 lines into the footer (footer about 220 est.).
- **Impor-baris** (form sheet): header about 76, 5 Fields 72 (name, phone, address, area|city, date|days), package chips 48+, "Hapus baris ini" 48, pinned "Selesai" footer about 76.
- **Impor-foto**: full-screen image `flex 1`, bar title "Foto i dari n".
- **Uang** (`UangScreen.tsx`, bar title, no content title). Body from 122: Card (label 23, `number` 40, caption 18; about 143) | Card of 7 money rows about 63 each (about 481). Fits the fold (est.). A 40pt "Rp ..." figure has about 338 width inside the card.
- **Paket baru** (`PackageEditor.tsx`, bar title, pinned footer "Terbitkan paket" 85). Body from 122: photo 168, name Field 72, description Field 72, "Isi satu porsi" label, six Steppers at pitch 68 (52 + gap 16), `NutritionFields` (label, switch 48, 3 Fields, caption), price Field, Segmented 56, delivery-day chips (2 rows), capacity Field + hint. About 1200 total; fold reaches the steppers. **Paket/[id]** (`PackageDetail.tsx`): nativeTitle, photo 168, description, Card, copy button.
- **Laporan/[id]** (`ReportScreen.tsx`): nativeTitle (customer name); day/meal lines 45; report Card about 149 with a status pill; reply Cards; reply Field (88 min), Balas 48, Tandai selesai 48, hint, WhatsApp 48. More than one screen.
- **Pengaturan** (shared, `packages/mobile-ui/src/settings/Pengaturan.tsx:61-132`): nativeTitle, Notifikasi (switch row 72), Aplikasi (2 x 56), Tentang (2 x 56), Dapur's own "Data akun" section, Keluar. About 640 (Android, est.). **Data akun** (`DataAkun.tsx`): one Card per concern (name, phone, email, password, kitchen request), each with Fields and a button, then a Hapus akun row. Long page.
- **Masuk/Daftar** (`AuthLayout.tsx`): brand 24, `display` 34/40 title, 2-line subtitle, method tabs 48 (3px underline), Fields 72 at gap 14, button 48 in the scroll (Masuk) or pinned footer (Daftar), switch row, dev-only demo block. Error `FormError` appears below the form with no reserved space.

### Sheets

| Sheet | Detent | Contents (est.) | Pinned action? |
|---|---|---|---|
| ExceptionSheet `atur-antaran/[id]` (`ExceptionSheet.tsx:93-236`) | form | header about 96 (title + 20 context), "Gagal diantar" box about 109, "Pindah tanggal" row about 91, FormError, button 48; about 400 | no: button is in the scroll; on Android the sheet is 916 tall |
| MoveSheet `pindah-tanggal/[id]` (`MoveSheet.tsx`, `CalendarSheet.tsx:53-76`) | large [1] | pager 48, weekday row 16, 6 x 48 = 288 grid, caption 20, "Alasan" Field about 90, footer button | yes (`SheetFooter`) |
| ProofSheet `sampai` (`ProofSheet.tsx:57-110,257-294`) | large | context, one tile per stop (about 90 row, about 150 stacked below 400 effective width), error, button 48, reason caption | no |
| ReplySheet `balas/[id]` (`ReportScreen.tsx:122-207`) | form | context, Card about 149, replies, hint, Field about 112, Balas 48, Tandai selesai 48, caption 36, WhatsApp 48; about 650 | no |
| Tim `tim` (`TimScreen.tsx`) | fit | header about 76, paragraph 69, code box about 104, button 48; about 390 | n/a (fit) |
| Hapus akun, Bahasa, Tampilan | fit | paragraph, 48 text button, status or button; choice rows 52/56/72 | n/a |
| Confirm / Action (`konfirmasi`, `aksi`) | fit | confirm about 300 (circle 56, title 28, message 22-66, buttons 48-50); action rows 52 iOS / 56 Android, context photo 56 | n/a |
| ImportRowEditor `impor-baris` | form | about 530 of fields | yes ("Selesai") |

## 4. Inconsistencies

1. **Four ways to be a section heading.** `label` 12/23 inside cards (`SessionCard.tsx:114`, `CookingList.tsx:19`, `UsahaScreen.tsx:113`, `UangScreen.tsx:38`), `heading` 21/28 as card titles (`MenuWeek.tsx:576,619`, `AktifkanScreen.tsx:19`, `DataAkun.tsx:25`, `TodayScreen.tsx:710,732`), 14/23 weight 800 as row titles (9 sites, §1.3), and shared Settings headings 13/18 or 14/20 (`SettingsRows.tsx:40-41`). Heading-to-content gap is the Card's 10 everywhere, so a heading never gets more air than a row.
2. **Same kind of item, many heights.** Rows inside Cards: recap 40, DishRow 48 or 75, slot 48, Stepper 52, Usaha Row 56, CheckRow 56, StopRow 64-77 (est.), money row 63, customer Card 99. List-like rows are 40-99 with a fixed 10 gap, no shared row height, divider style varies (border-bottom `SessionCard.tsx:54`, border-top `DeliveryOrder.tsx:168`, `UangScreen.tsx:50`, none in CheckRow/Usaha).
3. **Hand-rolled surfaces beside `Card` (r16, pad 16).** Count card r22 pad 16 gap 16 (`TodayScreen.tsx:113`); option boxes r12 pad 14 (`ExceptionSheet.tsx:189,208`); proof tile r12 pad 12 (`ProofSheet.tsx:57-59`); code box r14 pad 16 (`TimScreen.tsx:59`); slot row r10 padL 14 (`SlotEditor.tsx:137-141`); suggestion box r12; file row r12 (`Attachments.tsx:199-207`); DoneCard/empty cards use `Card tone=sage` with gap 12 instead of 10.
4. **Inputs drawn three ways.** `Field` r9 padH 14 text 15 (`components.tsx:764-776`); `SlotEditor` input r10 (`SlotEditor.tsx:168-174`); import textarea r12 pad 14 (`ImportAssistant.tsx:272`); reply Field overrides minHeight 88 (`ReportScreen.tsx:283`), account request 88 (`DataAkun.tsx:236`), import 160.
5. **Photo sizes (food and package) are unrelated.** 40 r8 (Usaha), 44 r10 (CheckRow), 48 r12 (Menu), 56 (ActionSheet context), 64 r10 (Proof), 76 r12 (Attachments), 168 r14 fixed (package), 220x275 (cover). No aspect ratio anywhere (0 hits); a 168 photo on a 372-wide column is 2.2:1.
6. **Titles.** Tab roots: `title` 30/39 on Today (date), Pelanggan, Usaha (kitchen name) but `display` 34/40 on Menu (`MenuWeek.tsx:80,453`). Pushed screens: Android content title 24/32 (Pelanggan detail, Paket, Laporan, Pengaturan, Data akun) but a bar-only title on Uang, Paket baru, Menu hari ini, Aktifkan, Impor, Daftar. The dense money screen (Uang) has the least heading.
7. **Header cost on title-only screens.** The classic empty 48 row is deliberate and tested (`customers.test.tsx:224-225`, `menu.test.tsx:671-678`), so Pelanggan spends 177 (est.) on one word and Usaha 177 on a name plus a gear, while Today spends 457.
8. **Count and money jumps.** Footer grows 85 to 129 at the Mulai masak to Berangkat antar step (caption appears). Cooking blocks (about 590) vanish at departure so the order jumps up. "Antar HH.MM" appears only when a window exists (`TodayScreen.tsx:137`). Count card skeleton number block is 48 + 4 + 18 = 70 (`skeletons.tsx:45-48`) against a 72 loaded row (est., 2 off). Quantities in `CheckRow` are 21/28 with `minWidth: 40` (`CheckRow.tsx:83`): 4-digit counts push the name. Chip labels carry counts ("Aktif · 12") and wrap to a second row without notice (`CustomerList.tsx:98-103`). The Uang headline amount is 40 and the per-state amounts 12/23 with nothing between. Field hint/error lines add 6 + 16 below an input with no reserved space.
9. **Skeleton drift.** Menu chip skeleton 168x40 r20 against a 48 r9 chip (`skeletons.tsx:148`); ExceptionSheet skeleton 64/64/48 against about 109/91/48 (`ExceptionSheet.tsx:162-164`); MoveSheet skeleton 48/240/48 against a calendar of about 400 (`MoveSheet.tsx:120-122`); Proof skeleton 88 against about 90 (`ProofSheet.tsx:242`); menu strip skeleton assumes 5 days (`skeletons.tsx:119`).
10. **Day strip height depends on data.** 5-day packages one row (64), 7-day packages two rows (134), set by `STRIP_SLOT` 54 (`MenuWeek.tsx:98,437`); switching a package chip changes the header height.
11. **Two overflow answers for the same chips.** Menu packages scroll sideways (`MenuWeek.tsx:545`), Pelanggan filters and package delivery days wrap (`CustomerList.tsx:98`, `PackageEditor.tsx:161`).
12. **Side padding.** Screen 20 (`components.tsx:562`), sheets 20/24 but Tim and Hapus akun re-derive it and apply it to a View (`TimScreen.tsx:28`), settings rows run edge to edge with -20 (`SettingsRows.tsx:74`), the photo viewer 20 margin + 20 padding.
13. **Primary action placement.** Pinned footer: Today, Impor, Paket baru, Daftar. In-scroll: Uang has none, Aktifkan buttons per Card, SlotEditor Save, every form sheet but two. On Android form sheets are full height (`nativeHeader.ts:77`), so an unpinned button floats mid-sheet (ExceptionSheet content about 400 of 916, est.).
14. **Touch targets are consistent at 48 but visual weight is not.** A text link row (`Lihat n alamat lainnya`, `Isi menu`, `Pilih`, `Hapus baris ini`) is a 48 tall button inside rows whose text is 23; chips are 48 (customer v2 34).

## 5. Reuse map (customer layout blocks to Dapur)

| Customer block | Customer file:line | Dapur counterpart (file:line) | Gap |
|---|---|---|---|
| `SectionHeader` (20/26 title, 12 below, optional action) | `layout/SectionHeader.tsx:6` | none; closest `DeliveryOrder.tsx:124-143` (label + "Pilih" action, 48), `SessionCard.tsx:114`, `CookingList.tsx:19`, `UsahaScreen.tsx:113` (12/23 labels), Card `heading`s (`MenuWeek.tsx:576`) | Dapur headings have no shared block and no heading-to-content gap |
| `ListCard` (r16, 16 pad, 1px separators inset to text) | `layout/ListCard.tsx:18` | `UsahaScreen.tsx:134-155` (Cards of Rows, no separators), `UangScreen.tsx:47-56` (hand-set borderTop), `SessionCard.tsx:51-57`, `DeliveryOrder.tsx:168` | each rolls its own divider |
| `MediaRow` (72, 56 thumb, `rowTitle` 17/22 + `meta` 13/18) | `layout/MediaRow.tsx:15` | `UsahaScreen.tsx:23-69` Row (56, 40 photo, 12/23 + 11/18, always a chevron), `CustomerList.tsx:112-143`, `MenuWeek.tsx:104-206`, `CheckRow.tsx:77-124`, `StopRow.tsx:45`, `ProofSheet.tsx:57-110` | six hand-rolled media rows; none uses a 17/22 title |
| `GlyphRow` (40 circle, 56/72/48) | `layout/GlyphRow.tsx:14` | `UsahaScreen.tsx:52` (bare 22 glyph in a 56 row, forest), no circle | closest in spirit |
| `Thumb` (56/64 r8, dashed not-set) | `layout/Thumb.tsx:12` | `MenuWeek.tsx:144-161` (48 r12 dashed 1.5 camera tile), `UsahaScreen.tsx:50` (40 r8) | Usaha alone matches r8 |
| `rowLabel` | `layout/rowLabel.ts:5` | none; hand-built labels: `TodayScreen.tsx:615`, `StopRow.tsx:50`, `CheckRow.tsx:73`, `UsahaScreen.tsx:48` (label only, detail not spoken) | a11y strings differ per row |
| `metrics.ts` (GLYPH 40, BARE 20) | `layout/metrics.ts:2,4` | scattered constants: `StopRow.tsx:7`, `MenuWeek.tsx:96-101`, `Attachments.tsx:11-21`, `CheckRow.tsx:12-13`, `TodayScreen.tsx:65`, `DeliveryOrder.tsx:17-21` | no shared metrics file |
| `DecorativeIcon` | `layout/DecorativeIcon.tsx:10` | raw `Ionicons` chevrons and glyphs in rows (`UsahaScreen.tsx:52,58`, `TodayScreen.tsx:629,681`, `ExceptionSheet.tsx:227`, `CustomerList.tsx:139`) | glyph text can merge into row labels |
| `HeroPhotoFrame` (ratio photo in a card, `heroPhotoInset`) | `today/HeroPhoto.tsx:10,29` | `PackageDetail.tsx:22` and `PackageEditor.tsx:130` (height 168, r14, no ratio), `MenuWeek.tsx:621-629` (cover 220x275 at 1.25); the count card is the real hero (`TodayScreen.tsx:95-152`, r22, no photo) | Dapur has no ratio-based photo |

Already shared by both apps (so a scale change reaches both): `Card, Button, Chip, Segmented, Field, Stepper, Screen, ScreenFooter, MoodHeader, Skeleton, ReadError, StateArt, ConnectionBanner, FormError, Sheet*, Settings*`.

## 6. Tests that pin geometry

Dapur (`apps/caterer/tests`):

| File:line | Asserts | Breaks when |
|---|---|---|
| `layout-classic.test.tsx:17-29` | body padH 20; Button 48 r10; Chip 48 r9, no hitSlop; Segmented 48; Field 48 r9; Card r16 pad 16 gap 10; Text body 14/23 | any v2 value, or any new default |
| `menu.test.tsx:671-678` | mood header row minHeight 48, content gap 12, overflow hidden, padB 16 | v2 or denser header |
| `menu.test.tsx:751,822-830,836-837` | day buttons minHeight 64; 7 days on a 320 strip = width 75, flexGrow 0, 4+3 rows | strip metrics change |
| `menu.test.tsx:499-504,869` | remove 48x48; suggestion and create rows >= 48; dish photo r12 | row/photo changes |
| `skeletons.test.tsx:212,238-257,371,423-444,538` | Per paket rows 40; track skeleton equals loaded track (23+8+64+8+36, en +54); checklist rows 56; menu title row 48, day blocks 64; list chips 48 | any resize that is not done in both places |
| `today.test.tsx:111,179-181,431,495-507,828` | exactly one fontSize 40 text; MulaiCard step minHeight 56; date button 48; count card r22 curve continuous, tabular figure; attention body gap 10 | card radius, number size, gaps |
| `customers.test.tsx:211,224-225,437` | + Pelanggan lama 48; empty header row 48 + padTop 12; chat 48x48 | header or button geometry |
| `empty-states.test.tsx:260-296,304-372` | mascot 120 / 96 compact; count art 72 / 58; caption full width at 360 @1.3; count card row shape identical before, during and after cooking | count card or art sizes |
| `selection-mode.test.tsx:483-539` | proof tile column below 400 effective width, row at 411 @1.0; selection actions column below 340, row at 360 @1.0 | thresholds `ProofSheet.tsx:50`, `SelectionBar.tsx:80` |
| `import.test.tsx:559-580,617-620,785,833` | thumbs 76 r12; tile pad 10; remove 48 abs top/right 0; badge 28 r14; doc row minHeight 52 | import tile metrics |
| `business.test.tsx:85`, `nutrition.test.tsx:252,280-311`, `dapur-sheets.test.tsx:458,684-688`, `native-header.test.tsx:177-179`, `settings.test.tsx:229-235`, `tabs.test.tsx:120-121` | package photo 168; nutrition rows flex-start and bases grow with fontScale; "Gizi" label 12/23; sheet maxHeight below window and option boxes have no fixed height; Close 48 with icon marginStart -12; fit-sheet scroller; tab label 12 | photo height, caps |
| `masuk-layout.test.tsx:85-95` | Android keyboard padding adds the bottom inset because Dapur's Screen pays none | v2 (`AuthLayout.tsx:196` drops the inset) |

Shared primitives are tested only inside `apps/customer/tests` (`packages/mobile-ui` has no tests of its own). They run without a provider, so they pin classic: `ui-foundation.test.tsx:188-199,228-236,267-280,327-330,512,536,611-616,768-778,831-844` (48 chips/segments/text button, stepper 48, body and footer 760 cap, content title 24/32, footer padB 20, classic card border and pad 16, classic footer surface/line and 48 stepper) and `mood.test.tsx:175-178,284,290,293-336,415-430` (toggle tabs >= 48, title 30/39, display 34/40, classic empty 48 row and padTop 12, 48 row with meta, padH 20 against 16, 760 cap). Moving Dapur to `v2` needs only the Dapur files above changed. Changing the classic defaults breaks both lists. `LayoutScaleName` is a two-value union (`layoutScale.tsx:5`) and every branch is `=== "v2"` (about 11 sites), so a third, denser scale means editing each of them, not adding a value. Root `tests/` has no geometry pins (colour, font weight, copy scans only).

## 7. What a designer must know

1. Dapur is `classic`: 20 side margin, 48 controls, Card 16/16/10, and the Text ladder 34/30/21/14/12/11 with 15 and 13 raw. Sheets, StopRow, CheckRow, RantangTrack and skeletons ignore the scale.
2. Hari ini spends 457dp (en 475) before its first row: mood header 62 + 48 + 12 + 48 + 12 + count card 259 + 16. With the 85 footer only about 260dp of body shows above the fold, which holds Per paket and 1.3 checklist rows. The delivery route starts about 970, below the fold, until the meal departs.
3. Before departure everything is one Card of about 1000dp with label text for sections and no separators. After departure the cooking half disappears and the route moves up under a 23 label.
4. Money is mostly small: payout figure 40 once, per-state amounts at 12/23 `label`; customer money lives only on Uang. Caption 11/18 is the workhorse (76 uses) and carries state and instruction text.
5. 48dp floor is tested everywhere (buttons, chips, step, chat, map, remove). Denser rows must reach it through hitSlop (Dapur uses none) or keep 48.
6. Each tab root pays a 48 top row plus 12 gap even when empty (Pelanggan, Usaha); tests pin it. Menu's strip adds 64 per row and doubles for 7-day packages on 412dp.
7. Photos are fixed heights with 8 unrelated sizes and no aspect ratio; the package photo is 168 on both viewer and editor.
8. Android form sheets are full height (`ANDROID_FORM_DETENTS = [1]`); only the calendar and the import-row editor pin a footer, so the others leave a button mid-sheet.
9. Skeletons restate sizes by hand in `skeletons.tsx` and 3 sheets; several already drift (§4.9), and tests pin the track and row heights (§6).
10. Role limits the layout: staff get Hari ini and Menu only, with the gear in the Menu header, no Salin/Ubah/Isi menu/Tambah foto, and read-only SlotEditor, so staff Menu rows are all 48.
