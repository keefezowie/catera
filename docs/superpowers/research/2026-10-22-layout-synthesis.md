# Customer app layout rethink: audit and research synthesis, 2026-10-22

Scope: the customer app (`apps/customer`) only. Catera Dapur comes after. The question is layout: sizing, spacing, density, hierarchy and how modules sit on the screen. Colour, palette, artwork, naming and concept are out of scope and stay as approved.

Inputs:
- **Before captures:** 34 screens from the current `v2` (`1977a972`), taken on 2026-10-22 on the Pixel 8 API 36 emulator (Expo Go, demo customer, `.data/phase-g-c-4`). They are in `output/native-review/layout-2026-10-22/before/`, with contact sheets `sheet-tabs.png` and `sheet-detail.png` alongside.
- **Code inventory:** [2026-10-22-customer-layout-inventory.md](2026-10-22-customer-layout-inventory.md).
- **Mobbin, food domain (11 apps):** [2026-10-22-layout-mobbin-food.md](2026-10-22-layout-mobbin-food.md). HelloFresh, Uber Eats, DoorDash, Wolt, Deliveroo, Gojek/GoFood, Grab, Swiggy, Zomato, Instacart, Too Good To Go.
- **Mobbin, cross-industry (10 apps):** [2026-10-22-layout-mobbin-crossindustry.md](2026-10-22-layout-mobbin-crossindustry.md). Oura, Duolingo, Airbnb, Spotify, Revolut, Monzo, Todoist, Headspace, Flo, Strava.
- **Reference contact sheets:** `output/native-review/layout-2026-10-22/ref-food.png` and `ref-cross.png`, made from the 31 high-res files in `output/mobbin/2026-10-22/`.

Limits: Mobbin is iOS only, and every measurement in it is by eye. The demo customer holds 8 active plans, which is an extreme case; the typical customer, with one plan, was not captured here.

---

## 1. What the current app does (audit)

### 1.1 System level

| # | Finding | Evidence |
|---|---|---|
| A1 | **No native layout scale.** `spacing`, `radii` and `typography` in `packages/design-tokens/src/index.ts:22-38` are web-only. Every native gap, radius and size is a literal. Gaps are 8, 10, 12, 14 and 16 in roughly equal measure. | inventory section 1 |
| A2 | **The type ladder jumps from 30-34 straight to 11-14.** There is a display size (34), then body at 14, label 12 and caption 11. The missing middle (17 for row titles, 20 for section titles) is the tier every reference app leans on. As a result, screens feel both shouty and cramped. | `packages/mobile-ui/src/components.tsx:35-45` |
| A3 | **One card, six builds.** The radius-16 bordered card exists as `Card`, WaitingList, PlansRow, PackageCard, OfferCard and the Buy box, each with different padding. The hero frame is copied 3 times. | inventory 4-5 |
| A4 | **Six photo sizes and no ratio system.** Package photos are 112, 196, 150, 250, 180 and 120 high on different surfaces; only one `aspectRatio` exists. | inventory 6 |
| A5 | **Five section-heading styles** (18/24, 21/28, 12 label, 14/20, 13/18), and the heading-to-content gap is 0, 4, 6 or 10. | inventory 2-3 |
| A6 | **Row heights 52, 56, 60, 64, 72 and 76; ring sizes 34, 40, 54, 60 and 66.** | inventory 10 |

### 1.2 Screen level (from the captures)

| Screen | What the first viewport spends its space on | Problem |
|---|---|---|
| **Beranda** (`10-beranda`) | About 30% goes to the mood header: date, a two-line statement ("Malam ini, tidak ada pengantaran.") and the Siang/Malam arc. Today's meal is an 80dp circle in a text row. Then "Perlu kamu urus", with 4+ action rows that wrap to 3 lines. | The screen's question is "what am I eating today and is it coming?". The answer is the smallest thing on the screen. A statement about an *absence* is the largest. Food-led discovery stops at Jelajah. |
| Beranda scroll (`11`-`13`) | "Menu besok" shows three empty rings. "Berikutnya" lists every delivery of every day, 4 rows a day, with no cap. "8 paket aktif" comes last. | No ranking and no end. Every row has the same weight: a 40dp thumbnail, a 13 title and an 11 meta line. |
| **Jadwal** (`20`) | The month grid sits in the mood header (about 45%), with dashed rings on every delivery day and a legend in 11pt. Below it, one card holds the selected day. The bottom third is empty. | The grid is noisy, and the agenda under it is too thin to use the space. |
| Day detail (`60`) | Photo, a one-line row with a ⋮ menu, the address, "Ada masalah" as a text link, a primary "Ubah hari". About 40% is empty. | The actions are hidden (⋮) or weak (a text link), while the space sits unused. |
| **Jelajah** (`30`) | Area chip and heart, a 2-line display title, two 60dp outlined Siang/Malam buttons, search, 66dp category rings (only 2), 2 filter chips, then the first package card. About 1.3 packages show above the fold. | Discovery's content (the food) starts at 60% down the screen. The controls are oversized for what they do. |
| Package card (`30`) | A 112dp photo on the left, with a 21pt name wrapping to 2 lines, caterer, price, meals, kcal and trial on the right. | The photo is thumbnail-sized, and the text column carries 6 lines. |
| Package detail (`50`) | A bleed photo 250, name 26, meta, description, "Isi paket" cards, a 2x2 nutrition card grid, a label/value table, a sticky price + Coba + Pilih jadwal bar. | Close to the references. Heavy at the nutrition grid (four bordered boxes inside a bordered card), and the facts table is 12pt. |
| **Akun** (`40`) | Name, then "Paket aktif" with 8 rows, then Data akun, Alamat, Disimpan and the rest. | The account controls are below the fold whenever the customer has 3+ plans. Plans have a home on Beranda already. |
| Buy (`55`) | Native title, start date, length, a portions box with an address row, the price rows, "Bayar dengan", terms, a sticky Total + Bayar bar. | Sound order. The field rows are small (12-13pt), and "Ganti" floats inside the portion box. |
| Plan detail (`70`) | A hero card, then "Berikutnya" with 76dp rows, each showing a 4-line dish list. | The dish list makes every row 4 lines tall, so only 3 days fit. |
| Pengaturan, Riwayat, Bantuan, Alamat (`80`-`84`) | Plain lists at 14-15 / 11-12. | Fine in structure; only the type ladder and row height need fixing. |

---

## 2. What the top apps do (patterns from 21 apps)

Numbers are pt on a 390pt-wide frame, so Android dp is roughly the same.

### 2.1 Consensus (both studies agree)

| # | Pattern | Numbers |
|---|---|---|
| P1 | **One dominant module carries the screen's question.** It takes 40-60% of the first viewport, with no more than 4 modules above the fold. | Oura hero 41%, Airbnb detail hero 41%, HelloFresh next delivery block about 380pt |
| P2 | **The object leads, not a sentence about it.** Food apps show the meal photo; Airbnb Trips shows the trip photo; Oura shows the number. Copy sits under or over the picture. | HelloFresh 2-up meal tiles 175pt; Airbnb trip card about 1.6:1 |
| P3 | **Next one big, the rest compact.** The nearest item is a large card; later items are 62-80pt rows with 56-64pt thumbnails, grouped by date; long lists are capped with "Lihat semua". | Airbnb Trips; Todoist Upcoming; HelloFresh |
| P4 | **Five type sizes per screen.** 28-34 page title, 20 section, 16-17 row title, 14-15 secondary, 12-13 caption. Hero numerals 40-52. | all 21 apps |
| P5 | **One margin.** 16pt side margin in all 11 food apps (16-24 elsewhere), 12-16 card padding, 28-40 between sections, 12-16 from heading to content, 8-12 inside a group. | |
| P6 | **Rails with a peek for secondary browsing.** Cards are 60-82% of the screen width, the next card shows 12-20pt, the gap is 8-12. Vertical lists are kept for the main task. | Uber 232, Wolt 254, Deliveroo 276, HelloFresh 336 |
| P7 | **Fixed photo ratios.** Venue/hero 1.8-2.15:1, dish 1:1, full-width card about 1.6:1, detail hero about 1.1:1. The photo is 55-65% of a card's height, with 3 text lines under it. | |
| P8 | **Section heading 19-20 bold with a trailing "see all"** (14pt link or 30-34pt arrow). | food apps |
| P9 | **Discovery controls are small.** Search pill 44 tall, chips 32-36 tall with an 8 gap on one scrolling row, then content. | DoorDash, Uber, Wolt, Swiggy |
| P10 | **Detail page template.** Bleed hero, title block, a 3-stat strip, icon info rows of about 35pt, reviews, and a sticky bar with the price at left and the CTA at right (about 86pt + safe area). | Airbnb, Too Good To Go, Wolt |
| P11 | **Account is a hub, then rows.** 3 shortcut tiles (about 108x64) at the top, then plain or inset-grouped rows at 54-56 (single line) or 60-72 (two lines), with log out last and alone. | Uber, Instacart, Revolut, Monzo, Airbnb |
| P12 | **Schedules are week strip + agenda, or a calm month grid + sheet.** Month cells 50x55, a 32pt filled circle for selected, a small dot for days with items; tapping a day opens a sheet with its actions. | HelloFresh, Flo, Todoist |
| P13 | **Delivery actions are visible buttons, not a ⋮ menu.** HelloFresh's manage sheet shows 3 outlined 61pt actions plus "Skip this week". | HelloFresh |
| P14 | **One live slot for status.** A single fixed place (top card, or a 47-60pt bar above the tab bar) changes text and button with the state, instead of stacking alerts. | Instacart, Swiggy, Zomato |
| P15 | **Controls 47-53 tall, rows 47-56, icon buttons 40-44, chips 32-36.** | |

### 2.2 Distinctive moves worth taking

1. **HelloFresh delivery block** (Beranda, Jadwal). It stacks a date tile (70x57), the state in 19 bold, the deadline in 14 grey, 2-up meal photos with a peek, then the two actions. It is the closest analogue to Catera's whole loop.
2. **Headspace Today rail** (Beranda's next days). Its cards sit on a vertical status rail with 20pt dots for done, current and upcoming. Catera's tracker already speaks this language.
3. **Airbnb Trips** (plan detail, Beranda with several plans). The next item is a big photo card; the rest are 80pt rows with 64pt thumbnails.
4. **Revolut action circles** (day detail): four 48pt circles on a 90pt pitch for Pindah tanggal, Pilih menu, Lapor and Perpanjang.
5. **Uber/Instacart account tiles** (Akun): Paket saya, Alamat and Riwayat as three tiles.
6. **Too Good To Go detail bar** (package detail): the price with its unit at left and one pill CTA at right.

---

## 3. Direction (proposal, for the owner to confirm)

### 3.1 A native layout scale in `packages/mobile-ui`

| Token | Proposal | Replaces |
|---|---|---|
| Space | 4, 8, 12, 16, 24, 32, 48 | literal 6/9/10/14/18/20/22 |
| Side margin | one value for every screen (16 or 20; see question Q3) | 20 with 12/16/24 exceptions |
| Section gap / heading to content / in-group | 32 / 12 / 8 | 0-10 mixed |
| Type ladder | 32 large title · 24 hero title · 20 section · 17 row title · 15 body · 13 meta · 11 tab | 34/30/26/21/14/12/11 + raw 13/15 |
| Row heights | 56 single line, 72 two lines with a 56 thumb | 52-76 |
| Photo ratios | hero 4:3, card 16:10, dish 1:1, thumb 56 or 64 square | six fixed heights |
| Radii | 8 small, 12 control, 16 card, 24 sheet | 9/10/12/16/20/22/24/28/32 |
| Controls | button 50, field 50, chip 34, icon button 44 | 48 and 56-60 one-offs |

### 3.2 Screen directions

- **Beranda: the plate leads.** Today's meal becomes the dominant module: a photo at 4:3 or larger, with the meal time, the state and the one action on it, at about 45% of the viewport. The day statement shrinks to the hero's caption, and the arc becomes a compact two-stop status line. "Perlu kamu urus" collapses into one live slot (the most urgent item, plus "2 lainnya"). "Berikutnya" becomes HelloFresh-style day blocks capped at 3 days, with "Lihat jadwal" at the end. Several plans get a peek rail, not a stacked list.
- **Jadwal: a calm month and a real agenda.** Filled dots instead of dashed rings, a smaller grid (header about 35%), and below it an agenda for the selected week, so the space fills. A day opens a sheet with visible actions (Ubah hari, Pilih menu, Ada masalah), not a ⋮.
- **Jelajah: food above the fold.** The header shrinks to a large title, the area chip and the search pill. Siang/Malam becomes a 34pt segmented chip in the chip row, next to the filters. Cards become photo-on-top at 16:10, full width, or a 2-up grid (question Q4). Target: 2+ packages visible.
- **Package detail.** Keep the template. Add a 3-stat strip (kkal, protein, meals a day) in place of the 2x2 boxed grid, use icon info rows at 15pt, and keep the price-left sticky bar.
- **Akun.** Show the name, then 3 tiles (Paket saya, Alamat, Riwayat pembayaran), then grouped rows. Active plans move to a "Paket saya" page reachable from the tile and from Beranda.
- **Plan detail.** Hero, then compact day rows (dish names on one line, truncated, full list in the day sheet).
- **Buy and payment.** Keep the order. Adopt the 15/17 ladder, 56 field rows and a summary card with the package photo at the top.

### 3.3 What stays

Four tabs and their names, the palette, the mood colours, the mascot, the copy glossary, the motion rules and every server rule. Platform-native tab bar and headers stay.

---

## 4. Open questions for the owner

- Q1: Keep the four-tab information architecture and re-lay each screen, or also move content between screens (for example, plans out of Akun, the agenda in Jadwal)?
- Q2: The mood header (the tinted top panel with rounded corners, the 2-line statement and the Siang/Malam arc) is a Phase B signature. Keep it, shrink it into the hero, or drop it?
- Q3: Density: food-app density (16 margin, more per screen), or the current generous feel (20 margin, larger blocks)? PRODUCT.md says customer screens are "generous and warm".
- Q4: Jelajah cards: full-width photo-on-top (one column), or a 2-up grid?
- Q5: Is the typical customer one plan or several? The design target for Beranda depends on it.

### Owner answers, 2026-10-22

- **Q1 scope:** re-layout and move content. The four tabs and their names stay; content may move to the screen where it belongs (plans out of Akun, a real agenda in Jadwal, actions out of the ⋮ menu).
- **Q2 mood header:** shrink it into the hero. The mood colours and the day statement stay, as the caption of a food-led hero; the arc becomes a compact two-stop status line.
- **Q3 density:** balanced. A 16-20 margin, fewer but bigger modules, compact secondary rows.
- **Q4 Jelajah cards:** open. The canvas shows both options.
- **Q5 typical customer:** one plan, sometimes two. Several plans get a compact rail; the 8-plan demo is a stress test.

Next step: a canvas Artifact with before and after for each main screen (Beranda for one plan and for two plans, Jadwal with the day sheet, Jelajah with both card options, package detail, Akun, plan detail, buy), built to the scale in 3.1. Then a spec in `docs/superpowers/specs/`, then the plan.
