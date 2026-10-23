# Dapur layout rethink: audit and research synthesis, 2026-10-24

Scope: Catera Dapur (`apps/caterer`) only, layout only: sizing, spacing, density, hierarchy, where modules sit and which screen they live on. Palette K, the artwork, the names, the copy glossary, the motion rules, every server rule, the four tabs and their names, and every Phase A-G behaviour rule stay. Staff still see only Hari ini and Menu (`tabsForRole`).

Inputs:
- **Code inventory:** [2026-10-24-dapur-layout-inventory.md](2026-10-24-dapur-layout-inventory.md) (195 lines, every number with a file:line).
- **Mobbin, merchant and back-office:** [2026-10-24-dapur-mobbin-merchant.md](2026-10-24-dapur-mobbin-merchant.md). Shopify seller app, Fiverr seller, Posh organizer, Luma host, Airbnb host, Cash App, with analogues (Instacart, DoorDash, Swiggy, Noom, BitePal, Blue Apron, Jomo, Starbucks). 25 masters in `output/mobbin/2026-10-24/merchant/`.
- **Mobbin, cross-industry work apps:** [2026-10-24-dapur-mobbin-workapps.md](2026-10-24-dapur-mobbin-workapps.md). Linear, Todoist, Things, Stripe, Shopify admin, Notion, Asana, Slack, Google Calendar, Revolut (and Business), Wise, Jobber, Mercury, DoorDash Dasher, Grab Driver, Shopee Seller Centre. 25 masters in `output/mobbin/2026-10-24/work/`.
- **Before captures:** `output/native-review/layout-2026-10-24/before/` (Pixel 8 API 36 emulator, Expo Go, Dapur Metro on 8082, demo backend on the `layout-gate` data copy), with `INDEX.md`, `measurements.md` and contact sheets in `before/sheets/`.
- **Rule set:** `design-taste-frontend` `references/app-screens.md` (read in full) and `expo-native-ui`.

Limits: Mobbin serves iOS and web only, so every reference number is iOS pt (numerically equal to dp). None of the kitchen, POS or driver apps the kickoff named is on Mobbin (Toast, Square, GoBiz, GrabMerchant, Uber Eats Manager, DoorDash Merchant, Deliveroo Hub). The prep list (aggregated cooking totals), the per-stop delivery run and spreadsheet import therefore rest on analogues (Swiggy and Blue Apron lists, Luma check-in, Grab stops, Expensify column mapping) and on the rule set, not on a direct reference. The kickoff's description of "per-stop Berangkat and Sampai" is wrong: stops carry only a map and a "…" button; Berangkat and Sampai are bulk actions through "Pilih" and the selection bar (`StopRow.tsx:45,139`).

---

## 1. What Dapur does now (audit)

### 1.1 System level

| # | Finding | Evidence |
|---|---|---|
| A1 | **Dapur is `classic`.** No `LayoutScaleProvider`, no `nativeLayout`, none of the seven v2 Text variants. Margin 20, controls 48, Card border 1 / r16 / pad 16 / gap 10, the Text ladder 34/30/21/14/12/11 with raw 15 and 13. | inventory 1.1-1.3 |
| A2 | **No row system.** Rows of the same kind run 40, 48, 52, 56, 63, 64-77, 75 and 99. Dividers are border-top on some lists, border-bottom on others, none on the rest. | inventory 4.2 |
| A3 | **Four heading styles, no heading gap.** `label` 12/23 in cards, `heading` 21/28 as card titles, a hand-rolled 14/23 at weight 800 as "row title" in 9 places, and the settings headings. Heading to content is the Card's 10 everywhere, so a heading never gets more air than a row. | inventory 4.1, 1.3 |
| A4 | **Everything is a bordered Card.** Hari ini before departure is one Card of about 1000dp holding cooking totals, kitchen-truth lines, share buttons and the whole route. Seven more surfaces hand-roll their own radius and padding (r22 count card, r12/14 option boxes, r12 proof tiles, r14 code box, r10 slot rows). | inventory 3, 4.3 |
| A5 | **Eight photo sizes, no ratio.** 40, 44, 48, 56, 64, 76, 168 fixed and a 220x275 cover; `aspectRatio` is used 0 times. A 168 photo on a 372 column is 2.2:1. | inventory 4.5 |
| A6 | **Figures have no middle.** The two lead figures are 40 (portions, payout); every other figure is 12/23 `label` (each Uang amount, "Antar 10.30"). Quantities in the checklist are 21/28 with `minWidth: 40`, so a 4-digit count pushes the dish name. | inventory 1.3, 4.8 |
| A7 | **Primary actions float mid-sheet.** Android form sheets open full height; only the calendar and the import-row editor pin their action, so ExceptionSheet's button sits about 400dp into a 916dp sheet. | inventory 4.13, 7.8 |
| A8 | **Skeletons drift** from what loads (menu chip 168x40 r20 against 48 r9; ExceptionSheet 64/64/48 against about 109/91/48; MoveSheet 48/240/48 against about 400). | inventory 4.9 |
| A9 | **The layout moves with the data.** A 7-day package doubles the Menu day strip (7 x 54 = 378 > 372); the Hari ini footer grows 85 to 129 at "Berangkat antar"; filter chips wrap to a second row when counts grow. | inventory 4.8, 4.10, 4.11 |

### 1.2 Screen level

| Screen | What the first viewport spends its space on | Problem |
|---|---|---|
| **Hari ini** before departure | Mood header 62 + 48 row + 12 + 48 date + 12 + count card 259 + 16: the first row starts at y=457 (475 in English). With the 85 footer only about 260dp of body shows: "Per paket" and 1.3 checklist rows. | The screen's questions are "what do I cook, how many" and then "who gets what, in which order". The header answers neither past one number. The route starts near y=970, two screens down, inside the same card as the cooking list. |
| Hari ini after departure | The cooking blocks vanish and the route jumps up under a 23 label; 3 stops and the map buttons show. | The same screen changes shape twice a day. The stop rows are 64-77 with two 48 round buttons each. |
| **Pelanggan** | A 177 header for one word (the empty 48 row is kept and tested), a left-aligned 48 "+ Pelanggan lama", a chip row, then customer Cards of about 99 at a 115 pitch: 4.5 show. | A list to work through, drawn as stacked cards. Chips wrap to a second row when the counts grow. |
| Pelanggan detail | Subscription Card about 181 with a renew button, WhatsApp 48, address Card 90, then one Card per package with a 39 row per delivery, uncapped. | No key-value block; the contact action sits under the renew block; the schedule has no end. |
| **Menu** | Header 262 (332 with a 7-day package): week label row, a 34/40 `display` week range between two 48 chevrons, the day strip. The day Card starts at 406; 4 photo dishes reach 786; "Ubah menu" straddles the fold. | The week range is the largest type in the app. Dish rows are 48 with a photo and about 75 without (the "Tambah foto" pill joins the text column). The cover preview takes a full screen below. |
| Menu day editor | Groups with 48 rows, inputs, suggestions; "Simpan menu" inside the scroll. | The save is lost below the fold on a long day. |
| **Usaha** | Header 177, payments Card 176, "Paket" Card, a Card of 4 rows, a Card with only Pengaturan. Pengaturan sits at the fold and drops below it when the payments card shows. | Three cards for one list of destinations; a one-row card. |
| Uang | One Card with the 40 payout, then 7 money rows of about 63 with the amount in 12/23. | The money is the smallest text on the money screen. |
| Sheets (Exception, Proof, Reply) | Header, option boxes or tiles, the button in the scroll. | The action is mid-sheet; option boxes are hand-rolled. |
| Paket detail and editor | A 168 photo, fields at a 72 pitch, six steppers at a 68 pitch, about 1200dp. | A fixed photo height; the long form is fine in structure. |
| Impor | Paragraph, textarea 160, attachments, pinned footer; review stage one Card per row of 134-164. | Review is one card per row; 4-5 per screen. |
| Masuk, Daftar, Pengaturan, Data akun, Tim | Shared shells; title 34/40 on auth; settings rows 56/72. | Structure is fine; only the scale and the heading ladder change. |

---

## 2. What work apps do (patterns from 25 apps)

### 2.1 Consensus (both studies agree)

| # | Pattern | Numbers |
|---|---|---|
| W1 | **Density is row pitch, not smaller type.** Work apps fit about 40% more rows per screen than consumer apps by shortening the row, keeping the type. | single-line 44-48 (median 47), two-line 59-63 (median 63); 8-10 list rows, 13-14 settings rows per screen; row text 15-17, meta 12-14 |
| W2 | **The same margins and controls as consumer apps.** | margin 16 (median); primary button 45-55; fields 56; tab bar docked 80-85 |
| W3 | **A work screen opens on its list or its one number within 20-32% of the viewport.** Heroes are rare and flagged. | Stripe 19%, Linear 26%, Shopify orders 32%; merchant homes fit in the top 50-60% |
| W4 | **Totals are bare figures in one strip.** Label over value, no tile, no icon; one boxed to-do at most. | totals 17-27 (median 26); wallets alone 38-47; labels 11-12 grey |
| W5 | **Flat rows on a grouped surface, one hairline from the text column.** No card per row except where each row carries a photo and a person. | Shopify, Todoist, Stripe, Asana, Luma, Swiggy; Fiverr's 152-160 card is the exception |
| W6 | **Section header small, with its count or action at the right edge.** | 44-58 centre to centre between sections; "View all", "+", a total |
| W7 | **Key-value rows 45-47, label left grey, value right ink, one right edge.** | Stripe 45, Shopify 47.3 |
| W8 | **State counts live in chips or tabs above the list and recompute on every change; status is one pale 20 chip per row.** | Luma 29 chips with live counts; Shopify 31 chips |
| W9 | **One decision per sheet; the primary is pinned and full width.** A second action is outlined and side by side. | 45-56 pinned; Luma 49+49; Jomo 56 |
| W10 | **Per-row quantity edits are a trailing stepper; actions are a fixed trailing column at one pitch.** | Shopify 78x34 field; Dasher pencil; Asana kebab |
| W11 | **Detail = header block, key-value block, actions, then sections.** Actions sit under the name, side by side. | Shopify Email + Phone 39-43 each; Jobber 47 "Create" |
| W12 | **A week is an agenda, not a stack of day cards.** | Google Calendar: 55 day gutter, 30/50 blocks 6 apart, an empty day one line; Notion's 150 per day is the anti-pattern |

### 2.2 Moves worth taking

1. **Luma check-in → the delivery run.** 56-64 rows, one state pill at the right, a live count in the section header, the row opens a sheet for its action, a toast that never moves the list.
2. **Shopify home strip → the Hari ini figures.** Three or four bare figures in one divided strip, label over value, with the one to-do boxed under it.
3. **Swiggy / Blue Apron list → Daftar masak.** Quantity-first rows at 56 with the check at the right; checked rows stay in place.
4. **Shopify customer → Pelanggan detail.** Key-value block, WhatsApp and the second action side by side, the address in a well.
5. **Google Calendar agenda → Menu week.** One strip of 7 days that always fits, then the day's dishes as constant-height rows.
6. **Stripe / Mercury → Uang.** A lead figure about 26-32 in ink, then key-value rows with right-aligned tabular amounts.
7. **Jomo / Luma sheets → every action sheet.** One decision, the primary pinned at the foot.

### 2.3 Where Dapur departs from the references

- **Touch floor 48.** DESIGN.md says every native control is at least 48dp, and Android M3 agrees. Chips and segments may be drawn at 34 like the references, but each gets a 48 target, not the customer app's 44.
- **No floating pill tab bar.** NativeTabs stays (the references' pills are iOS 26 chrome).
- **Rows and money totals stay still** (Dapur dial). Live counts update in place; nothing animates in or reorders on a check.

---

## 3. Direction (owner-proxy rulings, 2026-10-24)

The owner answered: skills `expo-native-ui` + `design-taste-frontend` (app-screen rules); density "let research decide"; all screens equally important; layout only. Then speed mode, then full autonomy with the controller deciding on the owner's behalf. These rulings are those decisions; the canvas shows them.

### 3.1 The scale: v2 controls, dense rows

**R1. Dapur opts into `v2`, not a third scale.** The research says work apps keep consumer margins, controls and type and get their density from row pitch, flat lists and smaller headers (W1, W2). The v2 primitives (16 margin, 50 button and field, Card without border, MoodHeader 44 row, pinned ScreenFooter) were built and gated two days ago. A third scale value would mean editing about 11 `=== "v2"` branches and both apps' tests (inventory 6) for no difference the research supports. `apps/caterer/app/_layout.tsx` provides `v2`.

**R2. A 48 touch floor for Dapur.** `LayoutScaleProvider` gains an optional `target` (default 44, so the customer app is unchanged). Dapur passes 48. `Chip`, `Segmented` and the `Stepper` buttons size their `hitSlop` from it (34 chip: 7 above and below). Every chip row sits in a frame at least 48 tall, so no parent clips the target (lesson from the customer gates).

**R3. The Dapur row ladder** (on `nativeLayout` where it exists, new keys marked +):

| Row | Height | Anatomy | Used by |
|---|---|---|---|
| link / settings / info | 48 | bare 20 glyph or none, `bodyL`, chevron | Usaha destinations, "Lihat semua", Pengaturan |
| check | 56 | quantity column 48 (`section` 800, tabular, right-aligned), dish `bodyStrong`, optional 40 thumb, 48 check at the right | Daftar masak |
| two-line (+ `row.compact` 64) | 64 | title `rowTitle`, `meta` line, optional leading 28 badge or 40 glyph, one fixed trailing action column (48) | stops, customers, import review, exception options |
| media | 72 | 56 thumb r8, `rowTitle` + `meta` | packages, Menu dishes, proof stops |
| key-value | 40 | `bodyL` label left, `bodyStrong` value right, tabular, one right edge | Per paket, Uang, customer facts |

**R4. Section rhythm.** Margin 16, sections 24 apart (+ `dense.sectionGap` 24; the customer app keeps 32), heading to content 12, inside a group 8. Section headers are `section` 20/26 with their count or action at the right edge (W6).

**R5. Type.** Dapur uses the v2 variants: `heroTitle` 24/30 for tab-root titles and record names, `section` 20/26 for section headers and sibling figures (at 800, tabular), `rowTitle` 17/22, `bodyStrong`/`bodyL` 15/22, `meta` 13/18. The lead figure on Hari ini and Uang is 32/40 at 800, tabular (W4, app-screens §5: 30-36 and at least 1.3 x its siblings: 32 against 20). `display` 34 and `number` 40 leave Dapur screens. Auth keeps its shared shell (it already branches on `v2`).

**R6. Surfaces.** Lists are `ListCard`s: one surface card, no border, hairlines between rows from the text column (W5). No card per row. Photos take ratios: package photos 16:10 in `HeroPhotoFrame`, thumbs 40/48/56 r8.

**R7. Shared blocks move to `packages/mobile-ui`.** `SectionHeader`, `ListCard`, `MediaRow`, `GlyphRow`, `Thumb`, `GlyphCircle`, `DecorativeIcon`, `rowLabel`, `metrics` and `HeroPhotoFrame` move from `apps/customer/src/layout` (and `today/HeroPhoto.tsx`) to `packages/mobile-ui/src/layout/`, exported from `@catera/mobile-ui`. Customer imports change to the package; the customer screens render the same. New Dapur blocks join them: `KeyValueRow` (40), `CheckRow` geometry, `FigureStrip`, and `MediaRow size="compact"` / a 64 `TwoLineRow`.

**R8. Pinned actions.** Every form sheet with a primary action pins it in `SheetFooter` (ExceptionSheet, ProofSheet, ReplySheet, the Menu day editor's "Simpan menu"). Skeletons are rebuilt from the same constants as the loaded rows.

### 3.2 Screen directions

**Hari ini: the day's work leads.** (The screen's question before departure: "what do I cook, and how much?"; after: "who is next on the run?")
- Header: `MoodHeader band` on the mood tint, as on Beranda: a 36 meta row ("Dapur · Hari ini" with the Hari ini / Besok toggle), the date as a `heroTitle` button with its chevron, then the **figure strip**: one divided container of 3 cells, lead `32` "porsi" and two siblings at `section` 800 ("paket", "alamat"), with "Antar 10.30" as the strip's `meta` subline. The mascot slot leaves the count card (it stays on DoneCard and the empty states). The rantang track stays, compressed to a single 40 row of 4 stops (Masak, Siap, Antar, Sampai) with `meta` labels, as Beranda's StatusStops did for the arc. Target: the header ends near y=300, not 457.
- One live slot: the first attention or report card, with "n hal lainnya" expanding the rest in place (no new route).
- The one 1000dp card splits into sections. **Masak**: `SectionHeader` "Daftar masak" with "n menu" and the Bagikan / Cetak actions in its trailing slot, a `ListCard` of 56 check rows (quantity first), then the kitchen-truth lines and "Isi menu" links unchanged, then "Per paket" as 40 key-value rows. **Antar**: `SectionHeader` "Urutan antar" with "n alamat" and "Pilih", a `ListCard` of 64 stop rows (28 order badge, name `rowTitle`, address `meta`, the map and "…" buttons as one fixed 48 trailing column, since navigating to a stop is the run's most frequent job), the first 3 stops then a 48 "Lihat n alamat lainnya" row, then Maps and WhatsApp as two side-by-side 50 buttons.
- Fold target before departure: the figure strip, the live slot (when there is one) and at least 3 dish rows above the footer. After departure the Masak section collapses to one 48 summary row ("Sudah dimasak · 24 porsi"), so the route keeps the same position instead of jumping.
- The footer (`KitchenAction`) and every daily-loop state, the Pilih mode and the selection bar keep their behaviour; the footer's caption line reserves its height in every state so the footer does not grow at "Berangkat antar" (A9).
- Option B on the canvas, not chosen: a Masak | Antar segmented control at the top of the body. Rejected because it hides half the day behind a tap (app-screens §2.2: every block on the first screen) and adds a control.

**Pelanggan: a list to work through.**
- Header `plain` (no mood panel, no empty 48 row): a 44 row with "Pelanggan" in `heroTitle` and "+ Pelanggan lama" as a trailing 44 icon-and-label action.
- Filter chips in a 48 frame that scrolls sideways (one overflow answer for chips everywhere), counts in the labels.
- One `ListCard` of 64 rows: name `rowTitle`, `meta` "Paket · sisa n hari · area", the trailing 48 chat button. About 8 rows above the fold, up from 4.5.
- Detail: the name as the native title, a `meta` status line, a key-value block (Paket, Mulai, Selesai, Sisa, Porsi), WhatsApp and Perpanjang side by side (50), the address in a 56 well, then the schedule per package as 48 rows capped at 5 with "Lihat semua n".

**Menu: a week that always fits.**
- Header: one 44 row with the week range in `heroTitle` between two 44 chevrons, the Siang / Malam segment under it when the package serves both; the staff gear stays in the top row.
- Day strip: one row always. Tiles share the width (`(width - 32 - 6 x 4) / 7`, about 50 at 412dp, 43 at 360dp) and are 56 tall: weekday `meta` over the date `bodyStrong`, a filled state dot, selected filled. A 5-day package draws 5 wider tiles.
- Package chips in a 48 frame, then Salin minggu lalu and Bagikan menu as two side-by-side 50 secondary buttons (staff: Bagikan alone).
- The day: `SectionHeader` with the date and "Ubah menu" in its trailing slot; each component group is a `meta` label over a `ListCard` of 64 dish rows with a 48 thumb (a dashed not-set thumb with the camera glyph when there is no photo; tapping it is "Tambah foto"), so every dish row is 64 with or without a photo.
- "Tampilan di aplikasi pelanggan" stays last, with the cover at 160 wide.
- Day editor: "Simpan menu" pinned in a `ScreenFooter`; groups as 48 rows.

**Usaha: one list of destinations.**
- Header `plain`: the kitchen name in `heroTitle` with the 44 gear.
- The payments attention card stays first when it applies.
- "Paket": `SectionHeader` with "+ Paket baru" in its trailing slot, a `ListCard` of 72 media rows (56 photo, `meta` "Rp 25.000 / makan · n pelanggan", trailing 48 "…").
- "Kelola": one `ListCard` of 48 glyph rows: Uang, Impor pelanggan, Tim, Pembayaran, Pengaturan (Pengaturan joins the list; its one-row card goes). Everything above the fold with the payments card shown.

**Uang: the money is the biggest thing.** A lead block (`meta` label, the payout at 32/800 tabular, a `meta` caption), then a `ListCard` of 40 key-value rows with right-aligned tabular `bodyStrong` amounts on one right edge.

**Sheets.** ExceptionSheet: the two options as 64 two-line rows in a `ListCard` (glyph circle, title, `meta` consequence), the primary pinned. ProofSheet: one 72 media row per stop with the photo tile as its thumb (stacking below 400 effective width as now), the primary pinned. ReplySheet: the report as a key-value block, the reply field, Balas pinned with Tandai selesai as the outlined second action. MoveSheet keeps its calendar and pinned footer; its skeleton matches it. Tim, Hapus akun, Bahasa, Tampilan: fit sheets, margin from `useScreenMargin`.

**Paket detail and editor.** The photo at 16:10 in `HeroPhotoFrame` (no fixed 168). Fields and v2 steppers in sections 24 apart with `section` headers; "Terbitkan paket" stays pinned.

**Impor.** The paste field uses `Field` geometry (r12, 16 inset). Review: one `ListCard` of 64 rows per imported customer (name, `meta` phone and area, a trailing state pill or "Ubah"), not a card per row. Footer pinned as now.

**Settings, Data akun, auth.** Inherit v2 (margin 16, 50 controls). Data akun keeps one card per concern, with `section` headers. No structural change.

**Staff.** The same screens without the owner controls; nothing moves for staff beyond the shared geometry.

### 3.3 What stays

The tabs and their names, palette K, the mood tint and day statement, the mascot and art, the copy glossary, the motion dials (Dapur ENERGY 1 / RHYTHM 1 / MOTION 2), the NativeTabs bar, the native headers, every server rule, every daily-loop, kitchen-truth, selection, proof and delivery-order behaviour, the Three States Rule and the 48 touch floor.

---

## 4. Open questions and their answers

| # | Question | Answer (owner proxy, 2026-10-24) |
|---|---|---|
| Q1 | `v2` as is, or a denser third scale? | `v2` plus a 48 target and a Dapur row ladder (R1-R3). |
| Q2 | Hari ini's dominant module? | Before departure the cooking list, after it the run; the header shrinks to a figure strip and a compact track (3.2). |
| Q3 | What moves between screens? | Within screens: the route out of the cooking card into its own section, the cooking list into one summary row after departure, Pengaturan into Usaha's list. No new routes. |
| Q4 | List density and row heights for long queues? | 56 check, 64 two-line, 72 media, 48 link, 40 key-value; flat `ListCard`s (R3, R6). |
| Q5 | Which money totals stay still? | All: the figure strip, Uang's lead and its rows keep their positions and widths (tabular figures, reserved caption lines); nothing animates on a change. |
| Q6 | Option A or B on Hari ini? | A (sections), not B (segmented). |

Next step: the canvas (before captures with "Masalah" tags, after mocks at 412dp with a measurement layer), then the spec in `docs/superpowers/specs/2026-10-24-dapur-layout-design.md` and the plan.
