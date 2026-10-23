# Customer deep pages vs top apps (Mobbin research, 2026-10-24)

Research and audit step of the phase process. Nothing here is built yet: the owner picks first, then canvas, spec and plan.

**Method.** Every customer route was captured on the Android emulator in light, at 360dp and font 1.3 (`output/native-review/deep-pages-2026-10-24/`, one contact sheet per group, `index.md` for how each page was reached). Six agents, one per route group, ran 2 to 4 Mobbin searches per page (iOS, since Mobbin has no Android; Material differences are called out) and judged Catera against `expo-native-ui` (wins on conflict) and `design-taste-frontend`. About 36 searches in total; every reference links to its `mobbin_url`.

**Coverage gaps.**
- Not captured, judged from code: `bayar/[id]`, `konfirmasi`, `pembelian/bantuan`, `pembelian/bantuan-form`, `aksi`, `tomorrow`, `ulasan/[id]`, and the whole auth group (login, register, recover, auth/callback, claim). Reaching them needs a write (Bayar, delete) or signing out, which the capture run was not allowed to do.
- The tabs section is lighter: that agent judged from the contact sheet without reading the route code.

## The pattern across the app

The pages are tidy, but they are built from the same few parts (a stacked card, a text row, a dashed placeholder), whatever the job is. Top apps shape each page around its one job: the money on the button, the food in photos, the next step pinned at the bottom, the empty state pointing somewhere. Four themes come up in almost every group:

1. **Placeholders where the food should be.** Beranda, Jadwal and Pilih menu show dashed "Menu belum diisi" frames per slot. HelloFresh and Factor show one row per day and a single "Pilih menu" action, and dish choices as photo cards.
2. **The primary action does not carry its context.** Beli shows Total "-" and a greyed Bayar with no reason. Top checkouts itemise the total and name the amount on the button ("Bayar Rp 175.000"), pinned at the bottom.
3. **Lists that read as settings tables.** Pengaturan, Data akun, Alamat, Pembayaran and Notifikasi use loose rows and stacked text actions. Top apps group rows into cards with a trailing value or one edit affordance, and use dates and status on history rows.
4. **Choice controls that do not fit Indonesian at large text.** The `Segmented` control splits words at font 1.3 ("Pembatala/n"). Top apps use radio rows with a one-line example for 3+ options.

## Bugs found during the research (fix regardless of the redesign)

| Where | Bug | Evidence |
|---|---|---|
| `hari/[id]` sheet, upcoming day | The third action (Ganti alamat) wraps to a second row under the gesture bar: only the top of its circle shows. | `plans/05-hari-id.png` |
| `hari/[id]` sheet, yesterday | "Ada masalah" wraps and the gesture bar crosses it. | `plans/05c` |
| Plate / WeekAgenda | "Belum sampai" never expires: any past meal with no update maps to `due`, so yesterday still reads "Belum sampai". | `Plate.tsx`, `WeekAgenda.tsx` |
| `Segmented` (bantuan-form at 1.3) | Labels split mid-word: flex:1 segments, 13sp bold, no fit. | `help/` contact sheet; `packages/mobile-ui/src/components.tsx` |
| `ulasan/[id]` | Stars default to 5, so one tap on Kirim sends a 5-star review; food, delivery and value are all sent as the one rating. | code |
| Pengaturan | The notification switch is shown disabled with an explanation line (a dead control). | `account/` |

## Top recommendations, ranked across the app

| # | Page(s) | Change | Effort |
|---|---|---|---|
| 1 | Beli, Renew | One order summary: itemised Rincian, amount on a pinned pay button, a reason when it is disabled; drop the repeated package name and the fake "Bayar dengan" input. | M |
| 2 | Hari sheet | Bottom safe-area inset; full-width 48dp action rows instead of icon circles. | S to M |
| 3 | Beranda, Jadwal | One row per day with a single "Pilih menu" action; the next delivery as the hero with its cutoff; a week strip leading Jadwal, with the month behind a toggle. | M |
| 4 | Pilih menu | Dish options as photo cards, a deadline banner, a "0 dari 5 hari" count, a pinned confirm. | L |
| 5 | Paket detail | Pinned price and action bar, nutrition as a 4-column "per sajian" strip, an "Isi paket" dish preview, no tab bar. | S to M |
| 6 | Address (buy and account) | Rumah/Kantor/Lainnya chips for the label, a courier note field, one edit affordance per row, a default marker, "Tambah alamat" in the pick sheet, no duplicate heading. | M |
| 7 | Bantuan, Masalah | Radio rows for topics, the delivery or plan as a context card at the top (pre-filled from the route), an empty Bantuan that offers a path (Minta bantuan, WhatsApp, reply time). | S to M |
| 8 | Pengaturan, Data akun, Notifikasi, Pembayaran | Grouped `fill` cards with trailing values; dated, status-bearing payment rows; unread dot and mark-all-read in place of a "Baru" tag on every row. | M |
| 9 | Auth | A real 6-slot code input with autosubmit and a countdown resend; one shared "Cek emailmu" state for register and recover; the callback page on the shared auth layout. | M |
| 10 | Hapus akun | One "8 paket berjalan" callout and a short consequence list instead of eight plan names; danger color on the send button. | S |

Each group section below gives the current screenshot, 3 to 5 references, the patterns that work, what reads as slop or unpolished, and its own ranked list.


---

## Tabs group: Beranda, Jadwal, Jelajah, Akun (2026-10-24)

1. Biggest gap: the tabs are tidy, but Beranda and Jadwal show mostly empty placeholders ("Menu belum diisi" dashed boxes, "Tidak ada" slots) where top apps show the food and one clear next step.
2. Top change 1: Beranda leads with the next delivery as a dated card with its cutoff and a filled primary button, as HelloFresh does.
3. Top change 2: Jadwal becomes a week strip plus one row per day; unpicked days read as a single "Pilih menu" action, not a dashed frame per slot.
4. Top change 3: Jelajah gets a photo-led category row and richer cards (rating, area, cutoff); Akun gets a header with real counts and one grouped list.
5. Tabs are lighter than the deep pages: the owner already improved them. Findings focus on what each tab sends the customer into. `discover` is an alias of Jelajah (not reviewed separately).

Mobbin is iOS only. Translate to Material on Android: Material bottom sheets for day and area choice, ripple instead of press-dim, no iOS chevrons (already handled).

### (tabs)/index (Beranda): what comes next and what needs doing
![current](../../../output/native-review/deep-pages-2026-10-24/tabs/01-beranda.png)

**References**
- [HelloFresh, Coming up header](https://mobbin.com/screens/d0473d9c-8008-4a8d-8d1c-3a64bc20967d): date as the title, cutoff line, one dark Edit button, then food cards.
- [HelloFresh, Coming up list](https://mobbin.com/screens/cf135b18-5e4b-4ce0-bd99-127cac0c4848): each upcoming delivery is a block with a date chip and dish photos, with Change and Edit buttons.
- [HelloFresh, change delivery day sheet](https://mobbin.com/screens/6222ed2f-f393-47be-a3f6-f8503a4aeb99): the day change is a bottom sheet of day chips with Cancel and Next.
- [Uber Eats, home](https://mobbin.com/screens/214e62d3-c6fe-48ce-864c-c21b7af7f2b6): address at top, category chips, horizontal rails.
- [Deliveroo, home with order banner](https://mobbin.com/screens/84e6ea4a-bfee-47c5-913f-ea0d9b1319f6): a status banner carries the in-flight order.

**Patterns that work**
- The nearest delivery is the hero, titled by date and carrying its deadline ("Edit delivery by Sat").
- Dishes appear as photos, so the page stays food-led even when nothing is wrong.
- The one thing to do is a full-width dark button right under the hero; the secondary is an outline button.
- Later deliveries repeat the same block in compact form, not a different layout.
- Day and address changes open a sheet and the page behind stays visible.

**What reads as slop or unpolished in Catera**
- Slop: the hero says "Siang ini, tidak ada pengantaran." with two "Tidak ada" slots. A large tinted card announcing nothing. Berikutnya then shows dashed boxes with a crossed-utensils icon, which is filler.
- Slop: "Menu belum diisi" repeats per slot on every upcoming day, so the same empty frame fills two screens (01b).
- Unpolished: the "Pilih menu 5 hari" card has "Pilih" and "3 hal lainnya" as bare text links with no button shape, so the primary action is not recognisable.
- Unpolished: each dashed box is about 220dp tall at font 1.3, so one day takes a screen.

**Recommendation (ranked)**
1. Replace per-slot dashed placeholders with one row per day: date, count ("6 pengantaran"), and a single "Pilih menu" button when unpicked. Follows HelloFresh coming-up list. Effort M.
2. When today has no delivery, drop the big "tidak ada" card and promote the next delivery to the hero with its cutoff ("Pilih menu sebelum besok 17.00") and a filled button. Follows HelloFresh header. Effort M.
3. Make "Pilih menu 5 hari" a real card with a filled "Pilih menu" button; show "3 hal lainnya" as a count badge. Effort S.
4. Show dish thumbnails on days that already have a menu. Effort M.

### jadwal: month and week view of deliveries
![current](../../../output/native-review/deep-pages-2026-10-24/tabs/02-jadwal.png)

**References**
- [BitePal, meal plan week strip](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685): seven-day strip under the title, meals grouped in cards.
- [Centr, meals by day](https://mobbin.com/screens/705eaf3c-a294-402a-abd2-870d1eb06136): one-week strip with arrows, photo cards, a done tick.
- [Crouton, meal plan](https://mobbin.com/screens/5bd666b2-dabd-495d-9d3b-f0e2f0c5bfdb): a card per day with header row, add and more buttons, outlined today.
- [Amazon, change delivery day](https://mobbin.com/screens/10ddbeae-7ca5-42f7-a0cb-39c872db47cc): month grid used only to pick a date.
- [Wonder, view menu sheet](https://mobbin.com/screens/d518d0f1-4759-4bb3-aa70-c79e564167a2): week ranges as a bottom-sheet choice.

**Patterns that work**
- Meal apps use a week strip; the month grid is for picking a new date.
- Each day is a card with dishes as small photos and a state mark (done tick, outlined today).
- Past days read as done; the future carries the actions.
- Empty days are a quiet line ("No recipes") with a small add button, not a framed box.

**What reads as slop or unpolished in Catera**
- Slop: a full month calendar fills the first screen with tiny dots, needing a legend to read, and the week list below repeats the same information.
- Slop: every plate reads "Menu belum diisi / Siang 11.00-13.00 / Sudah sampai" with the same dashed icon, so past and future look identical (02b). Delivered rows saying "Menu belum diisi" reads wrong.
- Unpolished: the calendar header is a peach block while the list below is white cards, so two surfaces compete.
- Unpolished: nothing says what tapping a date does.

**Recommendation (ranked)**
1. Lead with a swipeable week strip, with a "Bulan" toggle opening the month grid in a sheet. Follows Centr and BitePal. Effort M.
2. Make delivered days read as done (tick, dish name) and hide "Menu belum diisi" there. Follows Centr. Effort S.
3. Unpicked future days get a single "Pilih menu" row action instead of a dashed photo frame. Follows Crouton. Effort S.
4. Outline today's day card in the list, not only the grid. Effort S.

### jelajah (and discover alias): find a package by food
![current](../../../output/native-review/deep-pages-2026-10-24/tabs/03-jelajah.png)

`discover` is `useRedirectToTab("jelajah")`.

**References**
- [Uber Eats, home](https://mobbin.com/screens/214e62d3-c6fe-48ce-864c-c21b7af7f2b6): address, circular category icons, filter chips, rails.
- [Glovo, food home](https://mobbin.com/screens/9de1b279-2051-4ba5-953d-60643bfd25e2): big title, search, food-type icons, filter chips.
- [Grab, food list](https://mobbin.com/screens/b6ca5588-deb5-4c0d-8463-38ac2b27785a): Indonesian market; rating, price tier, cuisine, fee and time in two lines.
- [Swiggy, what's on your mind](https://mobbin.com/screens/85869c52-d5a2-4f78-a7bd-a26118b21ea6): dish-photo categories and diet tiles (high protein, low kcal) that suit a nutrition-aware catering menu.
- [foodpanda, nearby](https://mobbin.com/screens/6e232092-f02b-4f88-9fc0-ed8027f438dc): location header, search, category circles, big photo cards.

**Patterns that work**
- The area is the first thing, a tappable header with a chevron.
- Search sits right under it; categories are round food photos.
- Filters are chips that open a sheet (sort, price, rating).
- Cards show a big photo, then name, rating, price and delivery cost or time in one or two lines.
- Diet tiles are a quick shortcut for catering.

**What reads as slop or unpolished in Catera**
- Unpolished: with no area chosen the page still shows prices and "Belum bisa dicoba" with no reason; the area chip is small and the heart floats alone at top right.
- Unpolished: the Siang/Malam chips and the "Di bawah Rp..." chip run off the right edge with no fade or scroll cue.
- Unpolished: cards give no rating, caterer area or cutoff, so customers cannot compare.
- The title "Makan siang minggu depan?" is warm but large; on 360dp it pushes the first photo down.

**Recommendation (ranked)**
1. With no area chosen, show an inline banner ("Pilih area dulu supaya harga dan jadwal sesuai") with a button, and make the area a full-width header row. Follows Uber Eats. Effort S.
2. Add a food category row (ayam, ikan, sayur, vegetarian) as photo circles, with Siang/Malam as a segmented control. Follows Glovo and Swiggy. Effort M.
3. Add rating, caterer area and order cutoff to each card; explain "Belum bisa dicoba" in one line. Follows Grab. Effort M.
4. Add an edge fade to the chip row. Effort S.

### akun: profile and the way into plans, addresses and help
![current](../../../output/native-review/deep-pages-2026-10-24/tabs/04-akun.png)

**References**
- [HelloFresh, profile](https://mobbin.com/screens/1a130933-0ec7-4359-9d17-7af36688c049): name with three live counts, a preference card with Edit, then one grouped list.
- [Bolt Food, account](https://mobbin.com/screens/3ed16c50-e7fb-4dbc-bef6-e8db6311e669): greeting, payment summary inline, profile fields with Edit links.
- [Blinkit, profile](https://mobbin.com/screens/f802f066-149f-4b6f-9fb6-e760e60b883c): grouped sections with small section headers, appearance row on top.
- [Snoonu, My Account](https://mobbin.com/screens/5715de9d-3c26-41cd-bd8d-5c8d74193517): balance card, then a flat list with chevrons.
- [DoorDash, Me](https://mobbin.com/screens/65ca72c6-9b77-4486-add2-74f67bfc500f): shortcut chips under the name.

**Patterns that work**
- The header shows who you are and the numbers that matter.
- One grouped list with section headers replaces a stack of card styles.
- Payment and preferences are summarised in place.
- Settings and sign-out sit last; destructive items are separate.

**What reads as slop or unpolished in Catera**
- Unpolished: two card styles stack on one screen (three subtitled cards, then two grouped lists), reading as unrelated blocks (04, 04b).
- Unpolished: the peach header holds only an avatar and name, with empty space below.
- Unpolished: chevrons appear only on the lower list, so the tappable pattern differs between groups.
- "Paket saya 8 aktif" and "Alamat 3 tersimpan" are counts a header could carry.

**Recommendation (ranked)**
1. Put counts in the header ("8 paket aktif · 3 alamat"), and use one grouped list with section labels (Pesanan, Akun, Bantuan). Follows HelloFresh and Blinkit. Effort M.
2. Show the last payment or method in the Riwayat row subtitle. Follows Bolt Food. Effort S.
3. Shrink the empty header space. Effort S.
4. Keep Keluar and Hapus akun in a separate last group. Effort S.

---

## Deep pages research: buy group

Biggest gap: the buy flow is a stack of identical bordered rows with no price anywhere above the fold of Beli (Total shows "-" and Bayar is disabled with no reason), while top apps lead with a plain order summary, one total, and a pinned pay button that names the amount.
Top 3 changes: (1) Beli/Renew become one order summary with the price line itemised and "Bayar Rp 197.500" on the button; (2) Paket detail gets a real nutrition strip, a "isi paket" preview and a pinned price + full-width primary action; (3) the address form uses label chips and a courier-note field, and Ubah/Hapus on address rows move into one overflow action.
Not captured, judged from code only: bayar/[id], konfirmasi, pembelian/bantuan, pembelian/bantuan-form. Aliases (package, checkout, payment, saved) are redirects.
Platform note: Mobbin has iOS only. Sheets, radios and the back/close controls below are translated to Material where it differs (full-height form sheets on Android per commit 1d736acf, M3 radio lists, no iOS chevrons).
Mobbin searches run: 7 (plan detail with nutrition, delivery checkout, QRIS payment waiting, address form, favorites empty state, start-date picker, area sheet).

### paket/[id] — package detail: what you get, what it costs, start buying
![current](../../../output/native-review/deep-pages-2026-10-24/buy/01-paket-id.png)

**References**
- [HelloFresh — recipe detail](https://mobbin.com/screens/e8dab715-c022-45b3-ada5-81ca580c28fe): photo, title, a single row of Total / Calories / Protein / Difficulty as a flat strip, then allergens, then contents.
- [Centr — nutritional information](https://mobbin.com/screens/5502e316-6321-4840-8feb-5411e8e060fb): a ruled table per serving with a "per serving" qualifier, numbers right-aligned in bold.
- [MyFitnessPal — plan detail](https://mobbin.com/screens/dc9bcf97-edf0-4fa2-9f50-6266471f3407): headline number plus three macro columns in one card, one full-width "Select plan" button pinned at the bottom.
- [Wonder — item detail](https://mobbin.com/screens/c8f7edf8-8989-41d9-91a7-f625b5674dc5): quantity stepper and "Add - price" button share one pinned bar, so price and action never separate.
- [BitePal — meal detail](https://mobbin.com/screens/62f2d1bc-1cb7-42dc-a5c7-e4037b71621c): calories large, macros as colored columns under one bar.

**Patterns that work**
- Nutrition is one horizontal strip, 3 to 4 equal columns with label above value, not label-left/value-right rows.
- State the basis ("per sajian" here) once on the strip.
- The pinned bottom bar holds the price and the one primary action; a secondary trial action is a text link or a second smaller line, not a competing button.
- Content under the title answers "what is in it": dish photos or a sample day, allergens, who cooks.
- Missing data (no reviews) is hidden or turned into a quiet line, not announced.

**What reads as slop or unpolished in Catera**
- Unpolished: the nutrition card is two label/value rows (kkal 620, protein 32 g) that look like a settings table. Karbo and lemak are not missing: by design (`StatStrip`, spec 3.4) they sit on the meta line under the strip, which is easy to miss.
- Unpolished: "Coba 1 hari" and "Pilih jadwal" are shrink-wrapped, right-aligned pills floating above the tab bar, and the tab bar still shows. The price "Rp 35.000 / Per sekali makan" sits in the scroll area, far from the action.
- Slop: "Dapur Senja, Jakarta Selatan. Belum ada ulasan" announces an absence. No dish preview, no description, no sample week: the page is a hero plus numbers, so a food-led product reads as a spec sheet.
- Unpolished: the card border and the outlined "Coba 1 hari" fight; two bordered controls at the same weight.

**Recommendation (ranked)**
1. Pinned bar: price left ("Rp 35.000 / makan"), full-width-ish "Pilih jadwal" right; move "Coba 1 hari" into a text link under the strip. Follows Wonder and MyFitnessPal. Effort S.
2. Replace the two-row card with a 4-column strip (kkal, protein, karbo, lemak) labeled "per sajian", following HelloFresh. Effort S.
3. Add an "Isi paket" block (3 sample dishes or the first week menu with photos) and 2 lines of description; drop "Belum ada ulasan" until there are reviews. Effort M.
4. Hide the tab bar on this detail page so the action bar owns the bottom edge. Effort S.

### beli/[id] — set start date, length, portions and address, then pay
![current](../../../output/native-review/deep-pages-2026-10-24/buy/02-beli-id.png) ![scrolled](../../../output/native-review/deep-pages-2026-10-24/buy/02b-beli-id-scrolled.png) ![trial](../../../output/native-review/deep-pages-2026-10-24/buy/02c-beli-id-trial.png)

**References**
- [Swiggy — checkout bill](https://mobbin.com/screens/515414a4-8186-4bc0-863c-e5a0bbb7b8f4): collapsible "To pay" block, itemised lines, total at the left of a pinned bar with the pay button right.
- [Gojek — payment summary](https://mobbin.com/screens/3b140f4d-51c2-472c-bd92-9dd3ed8f9870): Price, fees, discounts, bold total, pay button names the action.
- [Grab — order summary](https://mobbin.com/screens/d1f1eff1-74b2-413d-a420-0754837bf259): totals, fee lines and "Place order" in one pinned footer.
- [Blue Apron — delivery day and first delivery date](https://mobbin.com/screens/84b950f3-5ad2-42cc-bf2b-a2767fc11c0d): day chosen first, then the first date from a short list.
- [HelloFresh — first delivery date](https://mobbin.com/screens/726a724a-40c4-49ee-8aa8-6dd2570e0c1a): a single date field with a calendar affordance, "does this date work for you" framing.

**Patterns that work**
- The price is visible before the user has to do anything: itemised "5 hari x Rp 35.000" with fees, total pinned next to the pay button.
- The pay button carries the amount ("Bayar Rp 175.000") or the footer shows total left, button right.
- A disabled button explains itself (what is missing).
- Start date is a single tappable row showing the date, not a separate list screen.
- Conflicts ("masih berjalan") are a calm inline notice with one fix action, not body text.

**What reads as slop or unpolished in Catera**
- Unpolished: Total shows "-" and Bayar is greyed with no message. On the first screen the user cannot tell why, and the 02c trial state does the same.
- Slop: the page title and the package card both say "Ayam Panggang Harian", so the name appears twice above the fold, and the title is 28sp plus an X, pushing the first control down.
- Unpolished: "Porsi per hari" wraps to two lines at 1.3 font while the stepper stays on one line; "Lama paket 5 hari" has no control and no hint that it is fixed, unlike Mulai and Diantar ke.
- Unpolished (02b): the sticky title truncates ("Ayam Panggang Hari...") and body text scrolls visibly under it; the "Diantar ke Rumah" row is cut at the header edge.
- Slop: "Bayar dengan" shows a bordered box reading "Pilih cara bayar di halaman berikutnya." It is styled like an input but does nothing.
- Unpolished: the "masih berjalan sampai Jumat 30 Okt" notice is plain body text with a full-width outlined button beneath, reading as another input.

**Recommendation (ranked)**
1. Show a Rincian block as soon as defaults exist (start date, 5 hari, 1 porsi): "5 hari x 1 porsi x Rp 35.000" and total; the footer button becomes "Bayar Rp 175.000". When the total cannot be shown, say why: "Pilih tanggal mulai dulu". Follows Gojek and Swiggy. Effort M.
2. Remove the repeated name: keep the nativeTitle "Beli paket" and let the package card carry the name. Effort S.
3. Turn the conflict into a tinted notice with an inline action, "Paketmu masih jalan sampai Jumat 30 Okt. Mulai Senin 2 Nov?" plus a "Pakai" text button. Effort S.
4. Delete the "Bayar dengan" box; put one muted line under the footer, "Pilih cara bayar di langkah berikutnya", with Ketentuan Catera. Effort S.
5. Make Lama paket a read-only value styled as such (no icon-circle alignment gap), and let Porsi per hari keep its label on one line ("Porsi / hari"). Effort S.

### renew/[id] — renew an ending plan with the same dishes
![current](../../../output/native-review/deep-pages-2026-10-24/buy/13-renew-id.png) ![scrolled](../../../output/native-review/deep-pages-2026-10-24/buy/13b-renew-id-scrolled.png)

**References**
- [Uber Eats — checkout](https://mobbin.com/screens/93e5fd0b-85df-4787-bee0-36da4c8835cd): delivery time as a short horizontal choice, order summary row, one pinned "Next".
- [Instacart — Deliver to](https://mobbin.com/screens/f135c589-ee72-46de-a6cb-5b83f71f4489): address row with chevron, window selection, Summary with strike-through savings, Continue.
- [Blue Apron — delivery day picker](https://mobbin.com/screens/84b950f3-5ad2-42cc-bf2b-a2767fc11c0d): suggested date is pre-selected, alternatives below.
- [Swiggy — checkout bill](https://mobbin.com/screens/515414a4-8186-4bc0-863c-e5a0bbb7b8f4): the same itemised block, collapsible.

**Patterns that work**
- Renewal is Beli with everything prefilled: show what is kept, show only what can change.
- The new start date is a single suggested value in a row, not a paragraph.
- Totals are itemised, footer repeats the total.

**What reads as slop or unpolished in Catera**
- Unpolished: the Mulai row is a paragraph in bold headline weight ("Mulai Senin 23 Nov. Paketmu Ikan Bumbu Kuning Dua Pekan masih berjalan sampai Jumat 20 Nov.") at 5 lines. It is the heaviest text on the page and tells a story instead of showing a date.
- Unpolished: the title wraps to two lines and the close X is a separate row; the package card repeats the name.
- Unpolished (13b): Rincian line "5 hari x 1 porsi x Rp 39.000" wraps so the amount floats on the first line. "Pengantaran Termasuk" next to Biaya layanan Rp 2.500 reads as a table with mixed text/price in one column.
- Slop: the bordered "Bayar dengan" input-lookalike again, same as Beli.

**Recommendation (ranked)**
1. Split the Mulai row: label "Mulai", value "Senin 23 Nov", subline "Paket lama selesai Jumat 20 Nov". Follows Blue Apron. Effort S.
2. Share the Rincian block with Beli (one component), amounts right-aligned on a single line, "Termasuk" in muted text. Effort S.
3. Use the same footer text, "Bayar Rp 197.500". Effort S.

### pembelian/mulai — pick the start date (sheet over Beli)
![current](../../../output/native-review/deep-pages-2026-10-24/buy/08-pembelian-mulai.png)

**References**
- [Blue Apron — first delivery date](https://mobbin.com/screens/84b950f3-5ad2-42cc-bf2b-a2767fc11c0d): stacked choice rows, selected row tinted and outlined.
- [Wonder — view menu sheet](https://mobbin.com/screens/d518d0f1-4759-4bb3-aa70-c79e564167a2): week range rows with "Earliest delivery by" subline.
- [Uber Eats — store locations sheet](https://mobbin.com/screens/7ee73fc6-b426-4180-897b-0abd6597e802): radio list with a Save button at the bottom.

**Patterns that work**
- Rows carry a one-line reason ("Paling cepat").
- A Save/Pilih button confirms, unless selection closes the sheet at once.
- Weekday plans list only valid delivery days.

**What reads as slop or unpolished in Catera**
- Unpolished: plain radios with only a date; no "paling cepat" cue, no weekday grouping. The sheet shows the scrim over a clipped package card, fine on Android.
- Unpolished: Senin 26 Okt and Senin 2 Nov have no week separation. A 30-day list is a long scroll.

**Recommendation (ranked)**
1. Mark the first row "Paling cepat" and group by week with sticky small headers. Effort S.
2. Keep the radio list (native M3 rows), but close on tap if it already does; if not, add a Pilih button. Effort S.

### pembelian/alamat — manage addresses during a purchase (flow copy of Alamat)
![current](../../../output/native-review/deep-pages-2026-10-24/buy/09-pembelian-alamat.png)

**References**
- [Careem — Delivery Address list](https://mobbin.com/screens/e626f944-516b-4c59-be58-6a204d1944b0): one row per address with an overflow "..." and "Add new address" as the last row.
- [foodpanda — Where should we deliver](https://mobbin.com/screens/50d57a79-5c1b-4328-94c8-864590fd087a): selected address with radio, "Add a new address" row.
- [Keeta — delivery address](https://mobbin.com/screens/803a3955-50bf-4fcb-8eaa-a63e46c7c88a): "+ New address" at the section header, empty state line.

**Patterns that work**
- Rows are tappable to select; edit and delete live in one overflow or swipe.
- Add is a persistent row or header action.
- Row text: label (bold), one address line, no tertiary noise.

**What reads as slop or unpolished in Catera**
- Slop: the header says "Alamat" and the body repeats it as a 28sp question "Makanan diantar ke mana?".
- Unpolished: each card has Ubah and Hapus as two same-weight text buttons stacked at the right; Hapus is as easy to hit as Ubah. Third line of every card is "Jakarta Selatan, Jakarta" repeating the area, then a fourth line of tiny demo helper text ("Data sintetis...").
- Unpolished: with 3 cards the Tambah alamat button is below the fold (not visible in the capture).

**Recommendation (ranked)**
1. One overflow (Material "more" icon) per row with Ubah and Hapus; Hapus goes through the confirm sheet. Follows Careem. Effort M.
2. Drop the duplicate heading and the area line; keep label + street. Effort S.
3. Put "Tambah alamat" at the top, outside the scroll, as a header action or first row. Effort S.

### pembelian/alamat-pilih — choose the delivery address (sheet over Beli/Perpanjang)
![current](../../../output/native-review/deep-pages-2026-10-24/buy/10-pembelian-alamat-pilih.png)

**References**
- [foodpanda — Where should we deliver](https://mobbin.com/screens/50d57a79-5c1b-4328-94c8-864590fd087a): radio rows plus "Add a new address".
- [Careem — Delivery Address](https://mobbin.com/screens/e626f944-516b-4c59-be58-6a204d1944b0): label bold, address muted.
- [Uber Eats — store locations](https://mobbin.com/screens/7ee73fc6-b426-4180-897b-0abd6597e802): radios left, Save pinned.

**Patterns that work**
- The sheet states what changes.
- Add is one tap away.

**What reads as slop or unpolished in Catera**
- Good bones: radios, labels and an outlined "Kelola alamat" are close to native.
- Unpolished: "Kelola alamat" is the only way to add one, which means a detour through another page; no "Tambah alamat" here.
- Unpolished: radio sits left of a two-line address that wraps; label bold vs address regular is only slightly different at 1.3 font.

**Recommendation (ranked)**
1. Add a "Tambah alamat" row opening the same form sheet; keep "Kelola alamat" as a text link. Effort S.
2. Keep as is otherwise; small. Effort S.

### pembelian/alamat-form — add an address (full-height sheet)
![current](../../../output/native-review/deep-pages-2026-10-24/buy/11-pembelian-alamat-form.png)

**References**
- [Uber Eats — Address info](https://mobbin.com/screens/e3563856-0943-4f9f-93f4-99835ec05144): dropoff, free-text note for the courier, Home/Work/Other chips, one Save and continue.
- [Wonder — Add address](https://mobbin.com/screens/7d751622-d857-45e0-913d-060da42f0ee5): address, unit, drop-off toggle chips, instructions, nickname chips.
- [Grab — Address details](https://mobbin.com/screens/34e71a03-88f6-450a-b359-faccbc7920f6): hand-over options with radio and a counted note field.
- [Gojek — Delivery details](https://mobbin.com/screens/2e6fe4da-8fe7-43df-a0e0-292b395543a8): label with Edit, optional landmark, recipient details.

**Patterns that work**
- Label is a short chip set (Rumah, Kantor, Lainnya) with a text field only for "Lainnya".
- A courier-note field sits near the end, with a character counter.
- The Save button is pinned and always on; invalid fields are flagged on press.
- Phone and a landmark field are optional.

**What reads as slop or unpolished in Catera**
- Unpolished: "Label alamat" is a free-text field with "Rumah" prefilled; users type a nickname where chips would do. Kota is a second free-text field next to the Area chips, a repeat of the same information.
- Unpolished: Simpan alamat is greyed with a tiny hint "Isi dulu: jalan." far below, at the bottom of a scrolled form; at 1.3 font the hint is barely readable.
- Slop: no courier note, no landmark, no phone, in a catering app where the driver needs "titip ke satpam" or "lantai 3".
- Unpolished: the grey sheet handle plus the title "Alamat baru" and fields on grey fill; fine on Android since the sheet is full height now.

**Recommendation (ranked)**
1. Replace the label field with 3 chips (Rumah, Kantor, Lainnya) and show the text field only for Lainnya. Follows Uber Eats and Wonder. Effort S.
2. Add "Catatan untuk kurir (opsional)" with the counter, e.g. "Titip ke satpam, lantai 3". Effort S.
3. Make Simpan always enabled; on press, scroll to and flag the first missing field with "Isi jalan dulu". Effort M.
4. Drop Kota by deriving it from Area. Effort S.

### area — pick a delivery area (sheet over Jelajah)
![current](../../../output/native-review/deep-pages-2026-10-24/buy/14-area.png)

**References**
- [foodpanda — Where should we deliver](https://mobbin.com/screens/50d57a79-5c1b-4328-94c8-864590fd087a): the current choice first, "Use my current location", add address.
- [Keeta — delivery address](https://mobbin.com/screens/803a3955-50bf-4fcb-8eaa-a63e46c7c88a): one primary "Confirm address" button.
- [Careem — Delivery Address](https://mobbin.com/screens/e626f944-516b-4c59-be58-6a204d1944b0): saved places above search.
- [Uber Eats — store locations](https://mobbin.com/screens/7ee73fc6-b426-4180-897b-0abd6597e802): radio list with Save.

**Patterns that work**
- Saved addresses are offered first when the user has them.
- Selected state is always visible and a button confirms.
- The sheet covers the tab bar.

**What reads as slop or unpolished in Catera**
- Unpolished: nothing is selected, not even "Semua area", so the user cannot tell the current state.
- Unpolished: the tab bar stays visible under the sheet, as noted in the capture index.
- Slop: 8 plain radios, no saved addresses at the top even though the user has 3.

**Recommendation (ranked)**
1. Preselect the current choice ("Semua area" if none) and show saved addresses' areas as "Alamatmu" at the top. Effort M.
2. Raise the sheet above the tab bar (modal presentation). Effort S.
3. Close on tap; no extra button. Effort S.

### disimpan — saved packages
![current](../../../output/native-review/deep-pages-2026-10-24/buy/15-disimpan.png)

**References**
- [foodpanda — no favourites saved](https://mobbin.com/screens/30767f1f-fed1-4ebb-9e9a-e5c99ebafbd4): artwork, one-line reason, one outlined action.
- [Burger King — Favorites empty](https://mobbin.com/screens/ccc6be11-df0b-4faa-b910-12453fd56d19): art, title, one sentence on how to save.
- [sweetgreen — Favorites empty](https://mobbin.com/screens/02aefb19-7ea9-4e6e-a9bd-c0c0f806223b): drawn plant, one line.
- [HelloFresh — Favorites empty](https://mobbin.com/screens/195e4864-dc89-487c-ae1e-bb043ab02b6d): heart, one grey line, no button.

**Patterns that work**
- Illustration or food art above one headline and one how-to line.
- The action returns to browsing.
- The page keeps its tab bar.

**What reads as slop or unpolished in Catera**
- Unpolished: text-only empty state with a large dark button, no picture; the block sits in the middle with a big gap above. For a food-led product the page has no food.
- The copy is fine: "Ketuk hati di paket yang kamu suka." is short and clear.
- Unpolished: the header back arrow plus the "Disimpan" title are fine; the bar shows the tab bar for a page reached from Akun.

**Recommendation (ranked)**
1. Add one regenerated food illustration (an approved asset, not a crop) above the title. Effort S.
2. Make the button an outlined "Jelajahi paket" like foodpanda's. Effort S.

### bayar/[id] — pay for a checkout (QRIS or virtual account) [code only, not captured]
**References**
- [Shopee — QRIS Payment](https://mobbin.com/screens/fdd82990-98dd-4e69-b9cb-6aa5cc5f5d88): QR centered in a white card, countdown in plain text, Share and Set Amount below.
- [Gojek — virtual account request](https://mobbin.com/screens/0091869f-82e7-4e3a-bceb-0990eecf5c28): VA number block with Copy, deadline timer in red, collapsible "how to pay", detail lines, Cancel.
- [Kraken — invoice](https://mobbin.com/screens/41b34fdb-6484-495c-80c4-6530505a63f4): amount large, QR, Copy invoice, an expires chip, warning note.
- [Keeta — payment](https://mobbin.com/screens/fd996dff-6f33-415f-b21e-07f5cddef8b5): "Time left for payment" under the amount, radio method list, one Confirm button.
- [Trip.com — Secure Payment](https://mobbin.com/screens/278a807f-d33c-4b46-8f63-4af481698e5a): total large, countdown at top, method radios, pay button names the method.

**Patterns that work**
- Order: amount, countdown, then the payment artifact (QR or VA), then copy/save actions, then steps.
- Steps are collapsed under "Cara bayar".
- Status changes on its own; a manual check is a fallback.

**What reads as slop or unpolished in Catera (code reading: PaymentScreen.tsx)**
- Good: total at 32sp, "Bayar dalam MM:SS" in bold, QR with "Simpan gambar QR", VA with "Salin nomor", numbered steps, a sage card that explains the 15-minute hold. This matches Gojek and Shopee.
- Unpolished (judged from code, verify on device): the steps are always expanded, which pushes "Saya sudah bayar, cek status" and the sage hold card far down; at 1.3 font the QR may sit under the fold.
- Unpolished: the QR step says "Dari HP ini, simpan gambar QR lalu pilih dari galeri". A user paying on the same phone has no deep link into the wallet.
- Slop: three buttons exist for different modes ("Bayar (demo)", "Buka halaman pembayaran", "Tampilkan QRIS/VA"); in demo they are labelled "(demo)" and the "Sandbox" caption is correct. Not a UI issue, but check they never appear together.

**Recommendation (ranked)**
1. Collapse the steps into "Cara bayar" (collapsed by default) so QR/VA, copy and the status button fit on one screen. Follows Gojek. Effort S.
2. Move "Saya sudah bayar, cek status" into a pinned footer. Effort S.
3. Turn the countdown red under 2:00 and, on expiry, replace the QR with "Waktu habis. Buat kode baru." Follows Gojek and Kraken. Effort M.

### konfirmasi — confirm sheet (`useConfirm`) [code only, not captured]
`app/konfirmasi.tsx` re-exports `ConfirmRoute` from `@catera/mobile-ui`, a fit-to-content native sheet. No Mobbin search was run for it. Judge it on device later: the destructive action should be the filled red button with a specific verb ("Hapus alamat", not "Ya"), Batal as text, and the sheet title should name the object. Not assessed here.

### pembelian/bantuan and pembelian/bantuan-form — help during payment [code only, not captured]
`bantuan.tsx` renders `ReportList flow` (the Bantuan list over Bayar). `bantuan-form.tsx` is `flowSheet(HelpForm, "/bantuan-form")`, the same form as the tab copy. The tab copy is captured in the help group; the issue there (segmented control breaking words, "Pembatala/n", "Pembayara/n" at font 1.3) applies here too. Recommendation: replace the segmented control for topic with a radio list or chips that wrap. Effort S. Reference for Mobbin comparison belongs to the help group.

### Aliases
package/[id] → /paket/[id]; checkout/[id] → /renew/[id] or /beli/[id]; payment/[id] → /bayar/[id]; saved → /disimpan. No UI.

---

## Plans group: deep-page audit against Mobbin (2026-10-24)

1. Biggest gap: the plan pages describe a plan well but run it poorly. Top apps (HelloFresh, Cherrypick, Blue Apron) give each delivery one dated block with its meals, two buttons ("Ganti menu", "Ubah pengantaran") and a stated deadline. Catera spreads that across a hero, a plain list and a sheet whose actions are icon circles with labels below.
2. The Hari sheet has real layout bugs at font 1.3 on a 360dp phone: the third action is cut off under the gesture bar, and "Ada masalah" wraps into the home indicator. Both are confirmed in the screenshots.
3. Top 3 changes: (a) turn the Hari sheet actions into full-width rows with bottom inset padding (S/M); (b) stop showing "Belum sampai" for past days and ask "Sudah diterima?" or settle the day (S/M); (c) give Pilih menu photo options, a progress count and a pinned confirm button (L).
4. Judged from code only: tomorrow (not captured). Alias page: subscriptions/[id]/menu.
5. Palette, name and food-led direction stay fixed; nothing below proposes a rebrand.

---

### /paket-saya: the list of the customer's plans, active and finished
![current](../../../output/native-review/deep-pages-2026-10-24/plans/01-paket-saya.png)

**References**
- [Cherrypick: Orders](https://mobbin.com/screens/6a809515-e486-4db1-b61a-c31d0be54ef8): Upcoming and past are separate titled sections; each card leads with the date and time window, a "can still edit within" line, and two buttons.
- [Blue Apron: Upcoming orders](https://mobbin.com/screens/d1a35bd9-27c7-4dde-b80f-c96699e5a286): Tabs for upcoming and past, a four-step progress strip inside the card, the dish photo under it.
- [Wonder: Track your order](https://mobbin.com/screens/0e81305d-1efc-4553-9609-d5b6a8d1ac96): The active order is first with a full-width primary button; past orders are quiet rows with a status line.
- [Grubhub: Orders](https://mobbin.com/screens/60a75796-719c-4fcb-ad4d-e61eff768708): One active card with the ETA window and a single "Track" button. Nothing else competes.
- [HelloFresh: Home](https://mobbin.com/screens/5aa17c60-2637-4b18-8845-91f3cfd8d7b6): Each delivery is a dated block with its status ("Skipped", "Coming up") and the edit deadline as the subtitle.

**Patterns that work**
- Active comes before finished, and what needs action comes first, not what was bought first.
- A row states time first (next delivery date, "2 hari lagi"), then the name. The user asks "when is my next food", not "what did I buy".
- A deadline sentence sits on the row when a change is still possible, so users learn it before they open anything.
- Past plans are quiet: smaller, lower contrast, one action (reorder) where it makes sense.
- Thumbnails earn their place in food apps; a row without one looks broken.

**What reads as slop or unpolished in Catera**
- Unpolished: at font 1.3 the list is one tall card of 8 near-identical rows. Names like "Ikan Bumbu Kuning Dua Pekan · 26 Okt-6 Nov" wrap to three lines and push the meta line away, so row heights vary.
- Slop: every row has the same weight. Eight plans in one card, no signal about which delivers tomorrow and which in ten days. "5 hari lagi" only means something after reading each row.
- Unpolished: "8 paket" sits right-aligned against "Aktif" and relates to nothing; the section never says which plan needs attention.
- Unpolished: the Selesai rows are dead ends, with no action and no hint why "Ayam Panggang Harian" shows in both sections.

**Recommendation (ranked)**
1. Sort Aktif by next delivery and put a short status on the row ("Besok", "Pilih menu dulu") from the same state Beranda uses. Follows Cherrypick and HelloFresh. M.
2. Cap titles at two lines and move dates to the meta line ("26 Okt-6 Nov · Rumah Rasa") so row height stays even at large type. Follows Grubhub's two-line rows. S.
3. Give plans with a pending task one inline action and leave the fine ones without. Follows Wonder. M.
4. Add "Beli lagi" on Selesai rows. Follows the Re-order buttons in [Shopee](https://mobbin.com/screens/35ea6051-ad1d-4b25-8b3d-19e1d0ddab8a) and [Bolt Food](https://mobbin.com/screens/bcb61ccf-d3ac-4917-8e0a-33270e0acb73). S.

---

### /subscriptions/[id]: one plan, its next delivery and the days after it
![current](../../../output/native-review/deep-pages-2026-10-24/plans/02-subscriptions-id.png)

**References**
- [HelloFresh: My Menu](https://mobbin.com/screens/b245a59a-17ba-4f63-8631-dd050a7f5788): A week strip selects the delivery; a header band says "Coming up Thu, Aug 07" with "Edit delivery".
- [HelloFresh: Coming up blocks](https://mobbin.com/screens/5aa17c60-2637-4b18-8845-91f3cfd8d7b6): Date tile at left, status, the edit deadline, a photo strip of the meals and two buttons. Each delivery is complete in one block.
- [Thrive Market: Manage deliveries](https://mobbin.com/screens/de29e1ea-c35c-4df5-8813-3a2ccffcc176): "Your next delivery is" as a plain bordered card with a text "Manage" link.
- [Oportun: Manage plan](https://mobbin.com/screens/b7677589-efaf-4ca1-9f11-38d21b834d39): Current plan card, a switch section, a cancel row. Short, grouped, no hero.
- [BitePal: Meal plan](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685): Day strip at the top, then meals as grouped rows with a round photo and a plain meta line.

**Patterns that work**
- The page opens on "what happens next". The next delivery gets the most space; later ones are compact.
- A date is a unit: a short tile or day abbreviation, not a sentence per row.
- Plan-level actions (renew, end, default address) sit in one grouped list at the bottom, not mixed into the day list.
- A big photo marks the plan's identity once; repeating it per row adds nothing.

**What reads as slop or unpolished in Catera**
- Slop: the same dish photo appears in the hero and in every day row (Senin to Jumat), because the plan has one menu set. It reads as filler and does no job in the rows.
- Unpolished: "5 hari lagi" is the main fact but the caption above and the date range below are almost its size, so the card has no clear lead.
- Unpolished: every day row says "Pilih menu sendiri". That is a plan attribute, not a day state, so the user cannot tell which days are set.
- Unpolished: title, hero card, then a second heading "Berikutnya": three heading levels before the first actionable row.

**Recommendation (ranked)**
1. Replace the repeated thumbnails with a date tile per row and a real state: "Menu belum dipilih", the chosen dish name, "Sedang diantar". Show a dish's own photo only where one is chosen. Follows BitePal and HelloFresh. M.
2. Make the next delivery block primary: date, meal window, deadline, and the two buttons "Pilih menu" and "Ubah hari". Follows HelloFresh. S/M.
3. Move plan-level actions into a grouped list at the end. Follows Oportun. M.
4. Drop the "Berikutnya" heading when five or fewer days remain. S.

---

### /subscriptions/[id]/menu: alias
Redirects to /pilih-menu/[id]. No separate review.

---

### /pilih-menu/[id]: choose the dish for each day of a pick-your-own plan
![current](../../../output/native-review/deep-pages-2026-10-24/plans/04-pilih-menu-id.png)

**References**
- [HelloFresh: Your order](https://mobbin.com/screens/11e353eb-69ae-4410-a9c9-cbececa87bef): Items as rows with photo, name and a stepper; a banner "order will be placed automatically on ..."; "Changes you make are saved".
- [HelloFresh: Change meals entry](https://mobbin.com/screens/b6c51c49-6398-4547-a481-9062b95beb2f): "Change meals" is the single wide primary under the delivery band.
- [HelloFresh: Skipped week](https://mobbin.com/screens/6565fc8a-d0f1-4324-ab2d-47017548365a): A clear "Unskip" action with the deadline in the subtitle.
- [Cherrypick: Plan](https://mobbin.com/screens/e501f9c7-0c45-4cac-991d-253880923000): "Make changes until 1 Sep, 11pm" printed as a footer band on the order card.
- [BitePal: Meal plan](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685): Day strip at the top, one selected day, meals under it as rows.

**Patterns that work**
- Progress is visible: "2 dari 5 hari terpilih" or a check per day, so the user knows what is left.
- The deadline appears once, in a banner near the top, not on every row.
- Choices save as you go and the page says so; a confirm only appears where money or a cutoff is involved.
- Choosing food shows photos of the food.
- The primary action is pinned at the bottom: "Simpan pilihan" or "Pilih hidangan".

**What reads as slop or unpolished in Catera**
- Unpolished: each day row ends in a tiny "Pilih menu" in low-contrast text. At 1.3 it is among the smallest text on the page and looks disabled, yet it is the action.
- Unpolished: a month header with tiny chevrons takes a full row for a five-day plan whose month never changes.
- Unpolished: the selected-day card repeats the date, adds a two-line cutoff note, then the button, so on the first screen the button is below the fold (see 04b). The user scrolls to act.
- Slop: no food on a menu-choosing page. Dishes only appear after "Pilih hidangan". The food-led direction is missing exactly where it would help.
- Unpolished: the subtitle "Satu pilihan untuk semua 1 porsi. Tanpa biaya tambahan." reads awkwardly ("semua 1 porsi") and is caption-size.

**Recommendation (ranked)**
1. Show the day's dish options as photo cards inline (two columns or a strip) with the confirm button pinned at the bottom. This is the page's job and the biggest gap against HelloFresh. L.
2. Replace per-row "Pilih menu" with a state ("Belum dipilih" in the warning color, the dish name once picked) and make the whole row the target. S.
3. Print the deadline once as a banner ("Pilih sebelum Minggu 25 Okt, 17.00") plus a count ("0 dari 5 hari"). Follows Cherrypick and HelloFresh. S.
4. Hide the month stepper when the plan sits in one month; use a week strip. S.
5. Rewrite the subtitle: "Satu hidangan per hari, tanpa biaya tambahan." S.

---

### /hari/[id]: the sheet for one delivery day (menu, status, actions, address)
![upcoming](../../../output/native-review/deep-pages-2026-10-24/plans/05-hari-id.png)
![delivered](../../../output/native-review/deep-pages-2026-10-24/plans/05b-hari-id-delivered.png)
![yesterday](../../../output/native-review/deep-pages-2026-10-24/plans/05c-hari-id-yesterday.png)

**References**
- [Uber Eats: Preparing your order](https://mobbin.com/screens/755dd9ed-b4ae-4a01-b06f-035d9b1e0592): Sheet with a status headline, arrival window, one delivery details card, then outlined action buttons with a left icon.
- [Talabat: How your order is going](https://mobbin.com/screens/06aced2d-ab5a-4169-b943-823630279351): A vertical timeline with timestamps; done steps filled, future steps faint.
- [Careem: Your order is on time](https://mobbin.com/screens/f0ae07ab-ec33-4553-ab7b-913247c0cfbc): Status as the headline, a timeline, a full-width Close at the bottom.
- [Instacart: Heading to you](https://mobbin.com/screens/74f9f039-f378-4470-970b-c0ca10fb7e54): Stacked cards, each a full-width tap target with a chevron: address, items, receipt.
- [HelloFresh: Change delivery day](https://mobbin.com/screens/9de50067-5712-4a16-94fa-d1178854449f): Sheet whose bottom edge holds Cancel and Next above the home indicator.

**Patterns that work**
- Status is the sheet's headline ("Sedang diantar, tiba 11.30-12.00"), not a bullet under the dish.
- Actions are full-width rows or a two-up button pair, never icon-over-label circles that need a third column at 360dp.
- The sheet's bottom padding includes the safe-area inset and it can grow, so the last action is always reachable.
- Past days get their own action set: delivered offers review and report, nothing else.
- Address is a tappable row with its own change action, not a read-only well far from "Ganti alamat".

**What reads as slop or unpolished in Catera**
- Unpolished (confirmed in 05-hari-id): on an upcoming day the third action, Ganti alamat, wraps to a second row and only the top of its circle is visible above the gesture bar; its label is not on screen. At font 1.3 a user cannot find it. The code comment says actions stay in view at the first detent; at 1.3 they do not.
- Unpolished (confirmed in 05c-hari-id-yesterday): "Ada masalah" wraps to two lines and the gesture bar is drawn across the first line, with "masalah" below it. The most important action on a past day is the clipped one.
- Unpolished (confirmed from the index, and from WeekAgenda and Plate code): yesterday's deliveries still read "Belum sampai". The code treats any past meal with no update as `due`, so the state never expires. A day that was almost certainly delivered keeps saying it did not arrive. This is a state-model problem more than copy.
- Slop: the actions are 56dp grey discs with a generic icon each, a stock quick-actions row. The Pilih menu glyph (fork and knife) is also the empty-menu placeholder on Jadwal.
- Unpolished: "Menu belum diisi" at hero size sits under a full-width dish photo that belongs to the plan, not the day. A photo above "menu not set" contradicts itself.
- Unpolished: the meta line "Senin 26 Okt · Makan siang · Rumah Rasa" wraps with "Rasa" alone on the second line, and the bullet dot before the status adds nothing.

**Recommendation (ranked)**
1. Fix the bottom edge: bottom safe-area inset plus 16dp in the sheet content, and a larger detent when text is scaled. Confirmed bug; it blocks Ganti alamat and Ada masalah. S.
2. Replace the circles with a vertical list of full-width 48dp rows (icon left, label; chevron on iOS only per DESIGN.md), at most three. Follows Instacart and Uber Eats. S/M.
3. Lead with status: "Sedang dimasak", "Sedang diantar, tiba 11.30-12.00", with a timeline only while the day is in motion. Follows Talabat and Careem. M.
4. Expire "Belum sampai": after the window plus a grace period show "Sudah diterima?" with Ya and Belum sampai, or settle the day as "Selesai". Applies on Jadwal and the sheet. Suggested copy: "Sudah sampai? Konfirmasi, atau laporkan kalau belum." S/M.
5. When the menu is not set, drop the dish photo or use the caterer's mark, and say "Menu belum diisi. Biasanya terisi sehari sebelumnya." S.

---

### /ubah-hari/[id]: move a day to another date, or send it to another address
![date mode](../../../output/native-review/deep-pages-2026-10-24/plans/06-ubah-hari-id.png)
![address mode](../../../output/native-review/deep-pages-2026-10-24/plans/06b-ubah-hari-id-alamat.png)

**References**
- [HelloFresh: Change your delivery day](https://mobbin.com/screens/9de50067-5712-4a16-94fa-d1178854449f): Tiles for the available days only, a time-window dropdown, Cancel and Next at the bottom.
- [Starbucks: Select a delivery date](https://mobbin.com/screens/d6f4899c-0d12-411a-9202-f5a4cc2796e1): Month grid where only valid days are bold; Save disabled until a choice, Cancel under it.
- [Uber Eats: Schedule delivery](https://mobbin.com/screens/f3aa3a0a-dcb3-4b58-8cbf-56e85cd3b746): Day chips across the top, time slots as radio rows, Schedule and Cancel pinned at the bottom.
- [Glovo: Schedule delivery](https://mobbin.com/screens/70c0c74a-741a-4b27-b0ef-ddac0983b377): The same pattern with a close X in the header and one green Confirm.
- [Best Buy: Schedule delivery](https://mobbin.com/screens/f9c896d6-01b9-4d51-b117-8c16391418cb): Date chips, time chips and a phone field in one sheet.

**Patterns that work**
- Only valid choices are offered: a short row of day chips for the next five to seven available dates, not a month grid where most cells are dead.
- The primary button names the result once something is chosen ("Pindah ke Rabu 28 Okt") and says what is missing before that.
- Date and address are different jobs with their own entry points.
- The confirm button is pinned and clears the inset.
- An unavailable choice says why on its row ("di luar area antar").

**What reads as slop or unpolished in Catera**
- Unpolished: the October grid shows 31 days with nearly all struck through (past or blocked). Only the 26th and a few later days are live. It says "no" far more than "yes".
- Unpolished: four small facts sit above the real control: the date title, a plan name truncated to "Rumah Ra…", "Bisa diubah sampai besok 17.00", and the segmented control.
- Unpolished: in address mode the cards have dashed borders and a tiny right-aligned "Di luar area antar" or "Alamat sekarang" at the same weight. The current address and the unavailable ones differ only by that text.
- Unpolished: the disabled "Pindah tanggal" and "Pilih alamat" buttons are flat sage with no hint what is needed.
- Slop: dashed borders look like a drop zone, which these are not.

**Recommendation (ranked)**
1. Replace the month grid with a strip of day chips for available dates only, and show "Rabu 28 Okt, sekitar 11.00-13.00" once picked. Follows HelloFresh and Uber Eats. M.
2. Make the button copy specific: "Pilih tanggal baru" while empty, "Pindah ke Rabu 28 Okt" once chosen. S.
3. Open date and address as two sheets from the two Hari actions that already exist, and drop the segmented control. S/M.
4. Address rows: solid cards with a radio, "Di luar area antar" in the danger color with the row dimmed, "Dipakai sekarang" as a chip. Follows Glovo's radios. S.
5. Put the deadline in the subtitle and cut the plan name; the plan is already behind the sheet. S.

---

### /tomorrow: story view of tomorrow's meals (judged from code, not captured)

**References**
- [HelloFresh: Coming up](https://mobbin.com/screens/5aa17c60-2637-4b18-8845-91f3cfd8d7b6): The same job as a list: meals as photo cards with the edit deadline.
- [HelloFresh: Home](https://mobbin.com/screens/d87382bf-b249-4984-97df-93856135e3c9): Photo-led meal cards with names over the photo.
- [Careem: Your order is on time](https://mobbin.com/screens/f0ae07ab-ec33-4553-ab7b-913247c0cfbc): Status and estimate as the headline, one closing button.
- [Uber Eats: Preparing your order](https://mobbin.com/screens/755dd9ed-b4ae-4a01-b06f-035d9b1e0592): One primary fact and the delivery details, nothing else.

**Patterns that work**
- A full-screen photo with the dish name on a scrim suits food-led discovery, as long as close and the next action are obvious.
- One short fact (meal and window) and a deadline are enough text; the photo does the rest.
- The same facts must also be reachable in a normal list, so the story stays optional.

**What reads as slop or unpolished (from `apps/customer/src/tomorrow/TomorrowStory.tsx`)**
- Slop risk: the cream sticker rotated -2deg for "Makan siang · 11.00-13.00" is a decorative flourish on a utility fact. The code treats it as the story's one accent on purpose; keep it only if the owner's look approves it.
- Unpolished: with no menu set, the title becomes "<Caterer> belum mengisi menunya" at display size over a photo. That is the common state in the demo, so many users would see a large apology instead of food.
- Unpolished: there is no scroll. At font 1.3 and 360dp the text block (sticker, two-line title, sides, deadline row with a button, primary button) may take over half the height. Not verified on device.
- Unpolished: two actions compete at the bottom, the deadline row's "Ubah hari" and the full primary button whose label changes ("Lihat menu malam", "Selesai").
- Fine: close always present; loading, error and empty states exist; safe area handled.

**Recommendation (ranked)**
1. Skip story parts whose menu is not set; send them to the Hari sheet or a quiet card. Follows HelloFresh's list-first treatment. S.
2. Capture at font 1.3 and 360dp once tomorrow has deliveries; if the text block passes half the height, drop the sides line. S, needs a capture.
3. Keep "Ubah hari" as a text action beside the deadline and let the primary button own the bottom edge. S.

---

### /perlu-diurus: everything waiting for the customer (menus to pick, plans to renew, trials ended)
![current](../../../output/native-review/deep-pages-2026-10-24/plans/08-perlu-diurus.png)

**References**
- [Citizen: To-Do](https://mobbin.com/screens/9a752beb-df47-4f04-9696-a12274a8d55a): Cards with a status circle, one line of text and one button; a completed count in the header ("2/3 completed").
- [QUITTR: To-do](https://mobbin.com/screens/3d3139e8-db22-4da8-8a92-d4f4eafd6007): Rows with a title, one explanatory line and a control at the right edge.
- [Amie: To-do list](https://mobbin.com/screens/cc46020c-5386-4374-b00a-3b406c57ad63): Compact rows, bold titles, date chips at right, done items collapsed under "Hide 1 done".
- [Wonder: Track your order](https://mobbin.com/screens/0e81305d-1efc-4553-9609-d5b6a8d1ac96): One active item with a full-width action, then a quiet list.
- [Cherrypick: Orders](https://mobbin.com/screens/6a809515-e486-4db1-b61a-c31d0be54ef8): A countdown on the card and two outlined buttons.

**Patterns that work**
- A row is one noun, one reason, one action; the action is a button with a verb at the right, not a text link under the copy.
- Items with a deadline show it as a short chip and sort by it.
- Done items leave or collapse; an empty list says nothing is waiting.
- A count in the header tells the user the size of the job.

**What reads as slop or unpolished in Catera**
- Unpolished: the action ("Pilih", "Perpanjang", "Beli paket") is bold text alone on the last line of each row. At 1.3 it reads like a fourth line of body copy and is the hardest thing to find.
- Unpolished: the leading icons in grey circles (list, refresh, bag) are small and low contrast, and do not signal type or urgency.
- Slop: finished trials ("Rantang Nusantara sudah selesai", "Plant-based Everyday selesai Senin 26 Okt") sit here as to-dos with "Beli paket". They are sales prompts and share a level with a menu cutoff that passes tomorrow.
- Unpolished: titles wrap to two lines ("Ikan Bumbu Kuning, sisa 2 hari"), row heights differ, and the deadline is buried in the sub line ("sebelum besok 17.00") with no visible order of urgency.
- Unpolished: the header has a title but no count.

**Recommendation (ranked)**
1. Group into "Perlu sekarang" (menu to pick, plan about to end) and "Nanti" (finished trials), the first sorted by deadline with a deadline chip on each row. Follows Amie and Wonder. M.
2. Turn the text action into a right-aligned compact button, or a full-width one on the first item, 40 to 48dp high. Follows Citizen and Cherrypick. S.
3. Collapse finished-trial offers into one quiet row ("2 paket coba sudah selesai", chevron on iOS). S.
4. Show the count in the header ("4 hal") and keep the empty line "Tidak ada yang perlu kamu urus sekarang." S.

---

## Help group: bantuan, bantuan-form, masalah/[id], ulasan/[id], aksi (2026-10-24)

1. Biggest gap: top apps make "what went wrong" a list of plain choices with a short hint, and show the order or delivery being discussed at the top. Catera's forms open with a cramped control or a chip stack, and the package choice gets as much weight as the topic.
2. Top 3 changes: (a) replace the 3-way Segmented topic picker with radio rows (fixes the mid-word breaks at font 1.3), (b) collapse the package chips on Bantuan form into one context row, (c) show the delivery (day, meal, caterer in full) as a context card at the top of Ada masalah.
3. Empty Bantuan is a dead end: one line of copy, no contact path. Add a WhatsApp row and a reply-time line.
4. ulasan/[id] and aksi were not captured; those sections are judged from code and marked so.
5. Mobbin: 5 searches, iOS only. Material translations are noted where Android differs.

Verified: on bantuan-form at font 1.3 the topic control does split words ("Pembatala/n", "Pembayara/n"). Cause: `Segmented` (`packages/mobile-ui/src/components.tsx`) gives every segment `flex: 1` with a 13sp bold label, no `numberOfLines`, no `adjustsFontSizeToFit`, no horizontal padding. At 360dp the sheet body leaves about 300dp, so three segments get about 92dp each, and "Pembayaran" at 13 x 1.3 bold does not fit. `ChangeDaySheet` and `ChooseMenu` use the same component (two options each, so safer, but the failure is shared).

---

### bantuan — the list of reports and support cases, plus the way to ask for help
![current](../../../output/native-review/deep-pages-2026-10-24/help/01-bantuan.png)

**References**
- [Stake — Inbox](https://mobbin.com/screens/55aa13e0-068f-4a5b-b1ad-f4dceb4c7acb): title, a small "Contact us" pill at top right, Open/Resolved tabs, then a short empty message. The help entry is a header action, not a full-width button.
- [Qantas — Track my cases](https://mobbin.com/screens/1c49ffd7-1602-49cb-90bf-95a7a83fe7ad): the empty state is a card that says what it is, how a case gets here, and how long it stays visible.
- [Setel — Inbox, Support](https://mobbin.com/screens/d26a5444-c6b9-41e5-a2b7-5df9a9a5aa87): empty state with a help-centre link and a row of common-issue cards below, so an empty screen still has something to tap.
- [IHG — How can we help you?](https://mobbin.com/screens/247002fb-9b30-47a9-9921-a8d1d4c98734): a greeting, then contact channels with a status ("Currently offline") and a one-line description each.
- [Shop — Your order actions](https://mobbin.com/screens/4675eca5-f911-46f2-b911-a09d5b653fd5): "Report an issue with this order" sits in the order's own action list, the entry Catera already has on the day.

**Patterns that work**
- The create action is small and sits in the header or a pill (Stake), not a full-width bar above the content.
- Reports are grouped by state (Open, Resolved), not mixed.
- The empty state says what will appear here and how it gets here, and adds one real next step (a contact channel or common questions).
- Contact channels show availability and expected reply time.
- Each report row carries the thing it is about and a status word, so the list scans without opening anything.

**What reads as slop or unpolished in Catera**
- Unpolished: the screen is two blocks (outlined button, empty text) and then about 60% blank; it looks unfinished rather than calm.
- Unpolished: the full-width outlined "Minta bantuan" button is the largest object on a screen about reports, so the secondary job competes with the primary one (see what happened to my report).
- Slop: "Belum ada laporan." plus an instruction is correct but generic; the only path it offers is "go to Jadwal".
- Note: the "Demo (data contoh)" ribbon above the title is a demo-only element, ignore.
- With reports present, each is a Card with a status pill and a Button; that part holds up. The empty case is the weak one.

**Recommendation (ranked)**
1. Move "Minta bantuan" into the header as a compact action (Android: top app bar action or a small extended button; iOS: nav bar item), and add a Terbuka / Selesai filter once there are 3 or more reports. Stake. S.
2. Rewrite the empty state with a next step: a "Chat katering lewat WhatsApp" row and "Ada masalah dengan makanan? Buka harinya di Jadwal, lalu ketuk Ada masalah." Qantas, IHG. S.
3. Add 2 or 3 common-question rows (Telat datang, Ganti hari, Pembayaran gagal) that open Bantuan form with the topic preset. Setel. M.
4. Show the expected reply time under the title ("Katering biasanya membalas di hari kerja"). IHG. S, copy needs product confirmation.

---

### bantuan-form — a sheet to ask for help: topic, which package, a few words
![current](../../../output/native-review/deep-pages-2026-10-24/help/02-bantuan-form.png)

**References**
- [DoorDash — What was the issue?](https://mobbin.com/screens/08c48b5c-ae40-4bb7-8444-11cc7682f1ea): a sheet of radio rows, each with a one-line example, full-width Submit and Cancel below.
- [Everyday Rewards — Need help](https://mobbin.com/screens/0416a155-c595-4f5d-abbf-8840f9572670): the item first, then "How can we help you today?" as radio rows, Next pinned at the bottom.
- [Monarch — Contact Support](https://mobbin.com/screens/a8b6e767-6bb7-44eb-99cb-a4aa120aeb9e): topic as a picker row, then the message with a hint on what to include.
- [Alan — Describe your question](https://mobbin.com/screens/593ebbad-9821-4172-8312-02afc35c84f7): short form, reply-time promise right under the heading, one Send button.
- [Stake — Contact support](https://mobbin.com/screens/f7969630-f82f-41c2-abed-5194bd8206f5): a "This might answer your question" block that deflects before sending.

**Patterns that work**
- Topics are radio rows or a picker row, not a segmented control: topics are names, not toggles, and rows wrap their text.
- The subject (which order or package) is one context row, not a choice set, unless there is more than one.
- Each topic can carry a one-line example (DoorDash).
- The reply promise sits near the heading or above the button, not as small print.
- The send button stays visible and disabled until the form is valid.

**What reads as slop or unpolished in Catera**
- Unpolished (verified): "Pembatala/n" and "Pembayara/n" break mid-word at font 1.3; "Lainnya" fits on one line, so the three labels also look uneven. A segmented control is the wrong control for long Indonesian nouns.
- Unpolished: nothing is selected, so the first thing seen is three options and a disabled button, with no cue that a topic is required.
- Slop/unpolished: eight package chips stack as eight pills of different widths, two of them both "Ayam Panggang Harian". It is a ragged list that pushes the real input (Ceritakan masalahnya) below the fold. Android now opens the sheet at full height (1d736acf), so the footer is stable, but the field is still out of sight.
- Unpolished: no label above the topic control and no label above the package chips, so neither group says what it is for.
- Copy: the caption "Katering membalas lebih dulu..." is useful but sits under the field where nobody reads it.

**Recommendation (ranked)**
1. Replace `Segmented` with a radio list: three 56dp rows with a short example each ("Ganti atau hentikan paket", "Tagihan atau pengembalian dana", "Hal lain"). Fixes the broken words and matches DoorDash. S. Also give `Segmented` `numberOfLines={1}` and a vertical-stack fallback above font scale 1.15, since two other sheets use it. S.
2. Collapse the package chips into one row "Paket: Ayam Panggang Harian" that opens a choice sheet, default to the plan the user came from (route param), and show it only when there is more than one plan. Everyday Rewards. M.
3. Move the reply promise under the title. Alan. S.
4. For the Pembayaran topic, add a line that links to Riwayat pembayaran before sending. Stake. M.

---

### masalah/[id] — a sheet to report a problem with one delivery
![current](../../../output/native-review/deep-pages-2026-10-24/help/03-masalah-id.png)

**References**
- [DoorDash — What was the issue?](https://mobbin.com/screens/08c48b5c-ae40-4bb7-8444-11cc7682f1ea): issue types as radio rows with an example under each; Submit and Cancel at the foot.
- [Wolt — Order damage or quality issues](https://mobbin.com/screens/cee3e04e-0447-4f81-979d-6fc807248c34): a plain list of specific issues; choosing one moves on.
- [Careem — Order help](https://mobbin.com/screens/afb0ae9d-7613-446c-bfa9-792521d607f1): the order (name, time, amount, status) is a card at the top, then issue rows.
- [Walmart — Item details](https://mobbin.com/screens/e9b61ab8-b910-474c-b92b-135e75bb8249): item with picture and quantity, a required issue field and a comment labelled optional.
- [Shop — Your order](https://mobbin.com/screens/4675eca5-f911-46f2-b911-a09d5b653fd5): "Report an issue" next to "Contact merchant", so reporting and chatting are siblings.

**Patterns that work**
- The thing reported is shown with a picture or a card, so the user can confirm it is the right one.
- Issue types are specific to the product, with a short example each.
- A short optional note, labelled optional; a photo option when the problem is visible.
- One primary button with a quiet Cancel or text action below.
- The chat-with-the-seller path sits next to the report.

**What reads as slop or unpolished in Catera**
- Unpolished: the context line reads "Jumat 23 Okt · Rantang Nusantara..." and is truncated; the caterer name, which confirms the delivery, is cut off (the code builds day, offer and caterer).
- Unpolished: the meal toggle, the three issue rows and the textarea share one 12 to 16dp rhythm; hierarchy comes only from the small bold "Apa yang terjadi?" label.
- Unpolished: the selected meal pill is solid forest and reads as a primary button. Choice-by-fill on both the meal pills and the issue rows is a custom pattern; Material 3 uses a leading radio in a list row.
- Unpolished: "Makanannya tidak layak dimakan" wraps to two lines with the second line close to the border, so row heights differ.
- Missing: no photo option for "Ada yang kurang atau salah" or "tidak layak dimakan"; DoorDash-style flows ask for it because it is the evidence for a refund.
- Unpolished: the disabled sage "Kirim laporan" has low contrast against the white sheet, and nothing says what unlocks it.
- Good: the footer is pinned and the sheet opens at full height on Android, so the button is reachable at font 1.3.

**Recommendation (ranked)**
1. Replace the filled-pill radios with radio rows (leading radio, label, one-line hint such as "Belum sampai: sudah lewat jam antar"). DoorDash. S.
2. Put the delivery in a context card at the top (dish photo, "Jumat 23 Okt, Siang", caterer name on its own line) and drop the truncated header line. Careem. M.
3. Add an optional photo row (up to 3) for the two quality issues. Walmart, DoorDash. L (needs upload and storage).
4. Show the meal choice as a labelled row ("Makan yang mana?") only when the day has two meals. S.
5. Move the WhatsApp text link above Kirim laporan as a sibling alternative ("Chat katering dulu"). Shop. S.

---

### ulasan/[id] — a sheet to rate the caterer after a plan (NOT CAPTURED, judged from code)
No screenshot: the review row is absent from the demo data. Source: `apps/customer/src/today/ReviewSheet.tsx`.

**References**
- [DoorDash — Rate your order](https://mobbin.com/screens/ddf49da9-e77f-4185-9e77-457e99b62beb): the order is named at the top, large outlined stars, an optional text area with a hint, Submit pinned.
- [Chipotle — How was your order?](https://mobbin.com/screens/18b1f556-427f-4168-af69-17556ac8ecac): five big stars with a word for the chosen rating, then an optional comment with a counter.
- [7-Eleven — Rate your order](https://mobbin.com/screens/253bca25-0eb6-4853-a0d6-65b8fd2d6c66): after the stars, "What was great?" as checkboxes, so a review has structure without typing.
- [Careem — Rate the food](https://mobbin.com/screens/62cca029-9aff-4805-9c90-5e0810bbc9a6): the restaurant picture and name over the stars; "Write a note" as a text button.
- [Blinkit — Rate your experience](https://mobbin.com/screens/0cf44dcc-dade-42ef-bf33-4d4dfa8ee0ab): delivery and items rated separately in cards.

**Patterns that work**
- The thing rated is shown (picture or name) above the stars.
- The chosen rating gets a word, which turns five icons into a statement.
- The comment is labelled optional and hints at what to say.
- One primary button, one quiet "later" action.
- Food and delivery are rated apart.

**What reads as slop or unpolished in Catera (from code)**
- Slop risk: stars default to 5 (`useState(... ?? 5)`), so tapping Kirim without thought sends a five-star review and biases the average. Top apps leave stars unset.
- Unpolished: the title "Ulasan untuk {caterer}" names no plan or dates, so a user with several plans from one caterer cannot tell which one this is.
- Missing: no word for the chosen rating. The command also sends `food`, `delivery` and `value` all equal to the one rating, so the data is less honest than the schema suggests.
- Check: five 48dp stars plus gaps is about 264dp; fine at 360dp, untested on narrower screens at font 1.3.
- Good: draft handling, "Nanti saja" as a text button, and outline versus filled stars so shape and colour both carry state.

**Recommendation (ranked)**
1. Start with no star chosen, disable Kirim ulasan until one is, and show the word for the chosen rating. Chipotle. S.
2. Add the plan name and date range as a context line, with the plan photo. Careem. S.
3. Either ask food and delivery separately in two rows, or drop those fields from the command. Blinkit. M.
4. Add 3 or 4 tag choices after the stars ("Rasa", "Porsi", "Ketepatan waktu", "Kemasan"). 7-Eleven. M.

---

### aksi — the shared action sheet (NOT CAPTURED, judged from code)
No screenshot: no entry in the demo data. Source: `packages/mobile-ui/src/ActionSheet.tsx`; the route file `apps/customer/app/aksi.tsx` only re-exports it. It is a fit-to-content sheet with a title row, an optional context block (photo, title, lines), icon rows (52pt iOS, 56dp Android) and danger items last under a divider.

**References**
- [Shop — Your order](https://mobbin.com/screens/4675eca5-f911-46f2-b911-a09d5b653fd5): title row with close, icon rows, the destructive item last in red.
- [Shopify — Actions](https://mobbin.com/screens/af400eec-3fa1-4873-bf09-8595c1f74669): rows grouped under small headings (Actions, Receipt), a drag handle on top.

**Patterns that work**
- Actions are ordered by how common they are, destructive last and in the danger colour.
- Groups get a small heading when there are more than five rows.
- The sheet fits its content, has a handle and a close affordance.
- Rows say what happens, as a verb.

**What reads as slop or unpolished in Catera (from code)**
- The structure matches the pattern, and the context block with photo and lines matches Shop. No clear slop found.
- Risk: the only entries are the day "..." button (not visible in the demo) and a confirm step, so discoverability is low; check the "..." button on plates in the plans group.
- Unverified: the drag handle on Android and the long-list scroll at font 1.3; a capture is needed to confirm.

**Recommendation (ranked)**
1. Capture it once (day "..." on a plate that has the button) and check the handle and danger divider at font 1.3. S, process.
2. Add optional group headings for sheets with more than five items. Shopify. S.
3. Review the caller labels so each row is a verb phrase. S.

---

## Cross-cutting notes
- The same choice-by-fill pill pattern appears in `HelpForm`, `ReportProblem` and `ReviewSheet`. One shared `RadioRow` in `packages/mobile-ui` would give a native-feeling control on both platforms and remove the width problem.
- Pass context (plan, delivery, caterer) into every help sheet as route params so it opens pre-filled; that removes the package chip list.
- `ChatKatering` (WhatsApp) is a text link inside one sheet; it deserves a first-class row on Bantuan and on masalah/[id].
- Mobbin has no Android screens; radio rows, top app bar actions and 56dp list items are the Material 3 translations used above.

---

## Deep pages research: account group (2026-10-24)

1. Biggest gap: the account pages are flat text on a white page. Top apps group rows into cards or sections, show what is tappable (a trailing value or "Ubah"), and give each record a face (a glyph, a status, a default marker). Catera rows look like plain paragraphs.
2. Second gap: copy and states do the work that structure should do. "Makanan diantar ke mana?" repeats the header, the delete sheet is a wall of lines, and notifications repeat the same sentence with no type or grouping.
3. Top 3 across the group: (a) make Pengaturan and Data akun grouped, tappable rows with values (M); (b) rebuild the Alamat cards and the address form around a label picker, a default marker and one Area field (M); (c) restructure Hapus akun as a short consequence list with a count instead of eight plan names (S).
4. Judged on Android (light, 360dp, font 1.3), so iOS-only patterns (chevrons, large titles) are translated to Material: trailing value text, overflow menu, radio dialog.
5. Pages covered: alamat, alamat-form, pembayaran, data-akun, hapus-akun, notifications, pengaturan, pengaturan/bahasa, pengaturan/tampilan. `addresses` is an alias that redirects to `/alamat`, so it is skipped.

### alamat (alias addresses redirects here): the list of delivery addresses
![current](../../../output/native-review/deep-pages-2026-10-24/account/01-alamat.png)

**References**
- [Swiggy — Addresses](https://mobbin.com/screens/56dc8989-ffbf-4d5f-ba5b-419adc3230fb): label as the card title with a glyph, then the address, then Edit and Delete. "Add new address" is a full-width bottom button.
- [Zomato — My Addresses](https://mobbin.com/screens/5898b00e-ac88-4ca9-9a66-88f86cd507bb): "Add address" is the first row; each saved address is one rounded card with small icon buttons instead of two text actions.
- [Blinkit — My Addresses](https://mobbin.com/screens/62f7f7e1-0ee4-44d4-b23b-a30a93230148): an icon tile on the left of each address, secondary actions as small round icon buttons.
- [DoorDash — Addresses](https://mobbin.com/screens/fb216e60-7d86-43da-a16a-a07da6dbd293): the current address is highlighted with a tint; a single pencil icon edits.
- [Taco Bell — Saved Locations](https://mobbin.com/screens/ea59ccce-a5ed-4e44-8b51-bc72e305c467): a bookmark marker shows the default address.

**Patterns that work**
- The title is in the header only. No second heading restates the page.
- Each address has a label (Rumah, Kantor) and a glyph, so the list scans by label before the address text.
- One marker shows which address is selected or default.
- Per-card actions collapse into one pencil or an overflow menu. Delete is a second-level action, not a peer of Edit.
- Add address sits at the top as a row or pinned at the bottom, not both.
- The empty state is one line plus the add action.

**What reads as slop or unpolished in Catera**
- Slop: the "Makanan diantar ke mana?" heading under the header "Alamat". Two titles, and at font 1.3 it costs two lines of height. It reads as marketing copy on a settings list.
- Slop: every card carries the same grey caption "Data sintetis ..." (demo copy). Fine in demo, but it makes each card a line or two taller.
- Unpolished: "Ubah" and "Hapus" are equal-weight green text stacked at the card's right edge. Delete looks as safe as Edit, and the stack squeezes the address text into a narrow column.
- Unpolished: no default or selected marker and no label glyph; the three cards differ only by their first word.
- Unpolished: in 01b the first card is cut under the header with no divider, and the pinned "Tambah alamat" bar covers the last card until scrolled.

**Recommendation (ranked)**
1. Remove the second heading and tighten the top spacing; keep "Tambah alamat" pinned at the bottom only. Follows Swiggy. S.
2. Replace the Ubah/Hapus text pair with one trailing pencil button that opens the form, and move Hapus into the form footer or an overflow menu. Follows Zomato, DoorDash. M.
3. Add a label glyph tile (rumah, kantor, lainnya) and a "Utama" marker for the address used by new plans. Follows Blinkit, Taco Bell. M (needs a default flag; if none exists, mark the address on the next delivery).
4. Hide the synthetic caption outside demo mode and keep it to one short line in demo. S.

### alamat-form: add or edit one address, as a full-height sheet
![current](../../../output/native-review/deep-pages-2026-10-24/account/02-alamat-form.png)
![edit](../../../output/native-review/deep-pages-2026-10-24/account/02b-alamat-form-edit.png)

**References**
- [Blinkit — Add more address details](https://mobbin.com/screens/feb77607-d712-4113-9bdf-ba9b55c55cd6): "Save address as" chips (Home, Work, Hotel, Other) at the top, one primary button pinned above the keyboard.
- [Wonder — Add address](https://mobbin.com/screens/7d751622-d857-45e0-913d-060da42f0ee5): a short form, nickname chips at the bottom, one pinned "Save and continue".
- [Honest Greens — New address](https://mobbin.com/screens/66c021dc-80f1-46a3-af4b-d779644ed2e9): a sheet with Alias chips and a pinned footer that pairs a delete button with Save.
- [Glovo — Address details](https://mobbin.com/screens/ad786479-e0c1-440a-ae56-7baaccd0ebd6): an extra-information field ("leave it at the front door") and a short "Add a label" choice.
- [Shopee — New Address](https://mobbin.com/screens/6838ebed-38ba-45a5-8c17-5896dae1faf3): fields grouped in one white card, a "Set as default" switch, label chips.

**Patterns that work**
- The label is a chip choice with an optional custom name, not a free text field.
- Area and city are one decision. None of the references asks for both a district list and a city.
- A delivery note ("titip di resepsionis") gets its own optional field. It is the most useful field for a recurring meal drop.
- Delete lives in the footer of the edit form, next to Save (Honest Greens).
- A disabled Save is explained by an inline error on the field, not a helper line under the form.
- Fields sit in one grouped surface with labels above them.

**What reads as slop or unpolished in Catera**
- Unpolished: "Label alamat" is free text prefilled with "Rumah". Users can type anything, so the saved list ends up with inconsistent names.
- Unpolished: seven Area chips wrap into four ragged rows (02), then Kota is asked again. Picking "Bandung" with "Jakarta" in Kota is possible.
- Unpolished: the helper "Isi dulu: jalan." sits under the field stack above a greyed, disabled Simpan. The user has to infer which field is missing; the street field carries no mark.
- Unpolished: in 02b a visible scrollbar and a half-clipped Kota field at the footer edge. The sheet now opens full height (1d736acf), so the clip comes from content length, not the sheet.

**Recommendation (ranked)**
1. Replace the label field with chips (Rumah, Kantor, Lainnya) and show a name field only for "Lainnya". Follows Blinkit, Wonder. S.
2. Merge Area and Kota into one Area picker and derive Kota from it. Follows the single location question in all five references. M.
3. Add an optional "Catatan untuk kurir" field and move "Hapus alamat" into the footer of the edit form. Follows Glovo, Honest Greens. M.
4. Replace the disabled button plus helper with an inline error on the street field when the user taps Simpan. Follows Shopee. S.

### pembayaran: read-only list of what the customer paid for
![current](../../../output/native-review/deep-pages-2026-10-24/account/03-pembayaran.png)

**References**
- [Wolt — Your orders](https://mobbin.com/screens/911658e5-e5d2-45d0-ab78-b15db0dda8ea): one card per order with a status line, the total and a "View details" action.
- [DoorDash — Orders](https://mobbin.com/screens/1cca03d1-7b71-4793-ad87-93b0e973c80a): date and total on one meta line, "View receipt" as a visible action.
- [Zomato — Your Orders](https://mobbin.com/screens/4025dd29-66a4-4866-9eb5-622e10c3049f): payment state (failed, with a refund note) shown on the row.
- [Shopee — My Orders](https://mobbin.com/screens/35ea6051-ad1d-4b25-8b3d-19e1d0ddab8a): price right-aligned and larger, status at the bottom of the card, order date as a top-right caption.
- [Bolt Food — My orders](https://mobbin.com/screens/bcb61ccf-d3ac-4917-8e0a-33270e0acb73): a simple row with a status word colored by outcome.

**Patterns that work**
- A row answers: what, when did I pay, how much, did it work. The payment date and status come before service dates.
- The amount is the boldest right-aligned value, with tabular figures.
- A detail target exists even for completed rows.
- Failures and refunds appear in the list with a short reason.
- Long lists are grouped by month.

**What reads as slop or unpolished in Catera**
- Unpolished: the caption "Rumah Rasa · mulai Senin 9 November" is the only second line and it is the service start. The payment date appears nowhere.
- Unpolished: the amount sits in a small right column with the same weight as the caption, so "Rp 392.500" does not lead.
- Unpolished: no tap target, no receipt and no status. The only section is "Sudah dibayar", so a failed or waiting payment has nowhere to appear (the capture notes say the list is paid items only).
- Unpolished: at font 1.3 each row runs three lines (title wraps, caption wraps), and the repeated "Ikan Bumbu Kuning Dua Pekan" rows look identical.

**Recommendation (ranked)**
1. Add the payment date and a "Lunas" status to each row and make the amount the boldest value. Follows Shopee, Zomato. S.
2. Make rows tappable, opening the paket or a simple receipt with "Lihat bukti". Follows DoorDash, Wolt. M.
3. Group by month with a section label, and give the empty list one line ("Belum ada pembayaran."). Follows Wonder's past-orders list. S.
4. Show failed or waiting payments with a reason and a "Bayar lagi" action when such entries exist. M (needs data from checkout).

### data-akun: profile data the customer can read and change
![current](../../../output/native-review/deep-pages-2026-10-24/account/04-data-akun.png)

**References**
- [Shop — Account & login](https://mobbin.com/screens/8ae28765-2e89-4074-8871-35197e932c9e): one rounded card, three rows with a small label, the value and a chevron.
- [Too Good To Go — Account details](https://mobbin.com/screens/c4e8f513-27cd-4c1b-aa44-a18da2cbfa69): value on the right of each row; "Delete account" as the last red row, apart from the data.
- [lululemon — Profile](https://mobbin.com/screens/7268a49c-c8ac-47ad-8f08-9e09e54a9807): "Change" beside the password row; account and personal details in separate groups.
- [Shipt — Account details](https://mobbin.com/screens/ab5da228-4aec-4263-b0cf-504ca7487b77): email locked with "contact support to update", Reset password as a secondary button.
- [Vinted — Account settings](https://mobbin.com/screens/eb2a2cfe-b7a7-4d26-acb6-b09ccd1f4551): a "Verified" mark beside email and phone, with "Change" buttons.

**Patterns that work**
- Rows show a label, the current value and a clear way to change it.
- A missing value reads as an invitation ("Tambah nomor HP"), not "Belum ada".
- Verified state is visible for phone and email.
- Password is a row with "Ubah" and never shows the value.
- Delete account is separated from the data rows and styled as a danger action.
- Rows sit inside a card or grouped section with consistent padding.

**What reads as slop or unpolished in Catera**
- Unpolished: Nama, Nomor HP, Email and Kata sandi are plain text pairs. Nothing says they can be tapped. Chevrons are iOS-only in the contract, so on Android a trailing value or "Ubah" has to carry the affordance, and it is missing.
- Unpolished: "Belum ada" twice in grey reads like a bug. It is the demo state, but the real empty state would look identical.
- Unpolished: the demo caption "Demo (data contoh): nomor HP, email, dan kata sandi hanya disimulasikan." runs full width in small, low-contrast text under the title.
- Unpolished: two thirds of the screen is blank below "Hapus akun", so the page feels unfinished rather than calm.
- Slop: "Hapus akun" is red text at the same size as the data rows, one hairline below them.

**Recommendation (ranked)**
1. Put the four rows in one `fill` grouped card with the label above the value and a trailing "Ubah" on Android; empty values say "Tambah" in the primary color. Follows Shop, Too Good To Go. M.
2. Show "Terverifikasi" beside phone and email once verified. Follows Vinted. S.
3. Move "Hapus akun" into its own group at the bottom with one explanatory line. Follows Too Good To Go. S.
4. Shorten the demo caption to one line, and show it only in demo mode. S.

### hapus-akun: a request to the team to delete the account, as a sheet
![current](../../../output/native-review/deep-pages-2026-10-24/account/05-hapus-akun.png)

**References**
- [Zomato — Delete your account](https://mobbin.com/screens/ec3a0723-ba00-4908-9a09-bebd180dfd96): a short consequence paragraph with the 30 day window, a red primary action and a text escape.
- [Vrbo — Delete account](https://mobbin.com/screens/b06460fa-93a4-4d04-8436-d86a952f710e): three bullet consequences, then "Permanently delete account" and a plain "Don't delete account".
- [Canva — Delete your account](https://mobbin.com/screens/48a410e2-8d53-4002-a4e9-0c1fa5c5047e): the grace period in bold, a bulleted list of what goes, a highlighted note about teams, two stacked buttons.
- [Nike Run Club — Delete Account](https://mobbin.com/screens/bc383f22-26f9-4e60-9040-a1f549592b28): an icon per consequence.
- [LARQ — Delete my account](https://mobbin.com/screens/f48410ef-72f2-4ccf-8d10-5947ce42ffcb): "I changed my mind" is the visually stronger button, the delete is secondary.

**Patterns that work**
- Two or three lines on what happens and when.
- Consequences as a short bulleted list, one line each.
- Open commitments (active subscriptions, teams) get one highlighted note with a way out.
- The destructive button is red and names the real action; the safe exit is a clear second button.
- A long list is summarised ("8 paket"), not listed.

**What reads as slop or unpolished in Catera**
- Unpolished: eight plan names as bare lines (one wraps "Ikan Bumbu Kuning Dua Pekan · 26 Okt-6 Nov") that run under the footer, so the last name is clipped and the user cannot tell the sheet scrolls.
- Unpolished: the primary button is brand green "Kirim permintaan hapus akun". The action is a request and the copy says so, but green on a destructive action sends a mixed signal, and "Batal" as a green text link is weaker than a real secondary button.
- Slop: the explanation is four unstyled paragraphs in one weight, so nothing marks the key fact (the team confirms before anything is deleted).

**Recommendation (ranked)**
1. Replace the plan list with one callout: "Kamu masih punya 8 paket berjalan. Tim Catera menyelesaikannya dulu", with a "Lihat paket" link. Follows Canva's highlighted note. S.
2. Rewrite as one short paragraph plus a three-line list (what the team does, what is removed, what happens to the plans). Follows Vrbo. S.
3. Use the danger color on "Kirim permintaan hapus akun" and a bordered "Batal" button below it. Follows Zomato, Vrbo. S.
4. Keep the request framing and the no-promise-on-time copy; do not add a grace period unless the backend has one. S.

### notifications: the customer's inbox of updates
![current](../../../output/native-review/deep-pages-2026-10-24/account/06-notifications.png)

**References**
- [Mindtrip — Updates](https://mobbin.com/screens/3c451683-6c3d-4c76-be6a-0a129143ba3a): a bold title, the unread count under it, a dot for unread, a glyph per item, the time under the text.
- [Deel — Notifications](https://mobbin.com/screens/301d2fe0-80c5-456e-94f1-1315a50ec1eb): date groups, an action button per item, All and Unread tabs, a clear icon in the header.
- [Todoist — Notifications](https://mobbin.com/screens/064b32dc-a4c1-4b5b-84fc-742831a9a33f): All and Unread tabs and a mark-all-read check in the header.
- [Runna — Notifications](https://mobbin.com/screens/7340ec8d-8cb9-4525-adca-02c34fa4bd7b): a short list ending in a caught-up line.
- [Superlist — Updates](https://mobbin.com/screens/f8cf46ce-c9c0-4041-b707-202046a06247): unread rows tinted, with a "Mark all read" button.

**Patterns that work**
- Unread is a dot plus a tint or weight change, not a word on every row.
- The header offers "Tandai semua dibaca" once anything is unread.
- Each item has a type glyph and a one-line title; the body is one or two lines.
- Time is relative or grouped (Hari ini, Kemarin).
- Items that need action link to their target (jadwal, pilih menu).
- The end of the list says "Sudah semua".

**What reads as slop or unpolished in Catera**
- Slop: "Paketmu sudah aktif. Cek jadwal antar berikutnya." appears three times with the same timestamp, and the only useful item ("Pilih menu pengantaranmu sebelum batas waktu...") is lost among them. This is demo data, but the layout has no way to compress repeats.
- Unpolished: the word "Baru" above each message adds a line to every row, and the dot beside it already says the same. At font 1.3 each row runs five lines.
- Unpolished: the timestamp "Jumat 23 Oktober · 03.04" is small and grey, with no grouping.
- Unpolished: no mark-all-read and no sign of what a tap does (the capture notes rows were left untapped because tapping could mark them read).

**Recommendation (ranked)**
1. Drop the "Baru" word: use a leading dot plus a semibold title on unread rows. Follows Mindtrip, Superlist. S.
2. Add "Tandai semua dibaca" to the header when any item is unread. Follows Todoist. S.
3. Group by Hari ini, Kemarin and Lebih lama, and show relative time. Follows Deel. M.
4. Give actionable items (pilih menu, perpanjang) a deep link and a glyph by type (paket, menu, pembayaran). Follows Deel, Mindtrip. M.

### pengaturan: app settings and sign out
![current](../../../output/native-review/deep-pages-2026-10-24/account/07-pengaturan.png)
![scrolled](../../../output/native-review/deep-pages-2026-10-24/account/07b-pengaturan-scrolled.png)

**References**
- [Mindvalley — Settings](https://mobbin.com/screens/f84303db-a8d3-47de-a759-c9356cff6033): grouped cards with icons, the current value on the right, a full-width Log Out button.
- [Yami — Settings](https://mobbin.com/screens/a493aa61-9f61-4ee0-94ad-8241fc35a26e): white row cards, the value on the right ("Language (English)", Version), a red "Sign Out" in its own card.
- [ShopBack — Settings](https://mobbin.com/screens/2f6db744-3702-4d41-8d5a-6fe5bf028114): plain sections with bold group labels, the version as a centered footer, log out as a text link.
- [BeReal. — Settings](https://mobbin.com/screens/e49ad3ee-1913-46c7-8ae9-b22965472b05): small group labels over rounded rows, Log Out as a separate pill.
- [Speak — Settings](https://mobbin.com/screens/b9a2769f-c724-4948-9a6a-861fd0b49fce): an icon tile, a title and a one-line subtitle per row, a red Log out at the end.

**Patterns that work**
- Rows are grouped into rounded cards or clearly separated sections.
- Every row shows its current value on the right or as a subtitle.
- A switch appears only when the setting can change; an unavailable one is hidden or explained once.
- The version is a quiet footer line, not a row in the middle.
- Log out is last, visually apart from the navigation rows.

**What reads as slop or unpolished in Catera**
- Unpolished: rows are bare text on white with no grouping or trailing affordance. "Bahasa / Indonesia" and "Tampilan / Ikuti sistem" look like captions, not buttons.
- Unpolished: "Notifikasi di HP ini" shows a disabled switch and then "Tidak tersedia di versi aplikasi ini". The two say the same thing, and a dead control is the first thing in the list.
- Unpolished: the group "Akun" holds a single row (Data akun), and every row has identical styling, so the section labels carry the whole structure.
- Unpolished: "Keluar" is red text at the bottom of a long scroll and looks like another row, with no gap and no sign of a confirm step.
- Slop: none; the screen is plain rather than decorated.

**Recommendation (ranked)**
1. Group rows into `fill` cards under small section labels and add trailing value text ("Indonesia", "Ikuti sistem"). Android has no chevron per the contract, so the value does the work. Follows Yami, Mindvalley. M.
2. Hide the notification switch in builds where push is unavailable, or show one disabled row with the reason as its subtitle. Follows Speak's subtitle pattern. S.
3. Merge "Akun" into the top of the page as one "Data akun" row with the name as its value. Follows ShopBack. S.
4. Put Keluar in its own card with a confirm step, and the version as a centered footer line. Follows Yami, ShopBack. S.

### pengaturan/bahasa: choose the interface language, as a sheet
![current](../../../output/native-review/deep-pages-2026-10-24/account/08-pengaturan-bahasa.png)

**References**
- [Jira Cloud — Theme sheet](https://mobbin.com/screens/35932186-1751-437a-ba96-1ccd83efc2a6): a small sheet over Settings with a title, a close button and a check on the selected row (same job as a language choice).
- [Google Arts & Culture — Theme dialog](https://mobbin.com/screens/5fa7b97d-f083-48c8-a52a-0575df0d15f6): the Material radio dialog, the right translation for Android.
- [Mindvalley — Settings](https://mobbin.com/screens/f84303db-a8d3-47de-a759-c9356cff6033): language as one row that shows the current value.

**Patterns that work**
- The choice is immediate: tap a row, the sheet closes and the value updates.
- A Material radio list on Android, a check mark on iOS.
- Each option is written in its own language.

**What reads as slop or unpolished in Catera**
- Unpolished: a bottom sheet for two options is heavy, and it sits over the tab bar, which stays visible beneath it (noted in the capture index).
- Unpolished: the option reads "Indonesia" while the row it came from says "Bahasa"; "Bahasa Indonesia" is clearer.
- Unpolished: a large gap separates the two radio rows, and the sheet height is set by the handle and header, not the content.

**Recommendation (ranked)**
1. On Android use a Material radio dialog (or an in-place radio list) instead of a bottom sheet for two options. Follows Google Arts & Culture. S.
2. Label the options "Bahasa Indonesia" and "English" and close on selection. Follows Jira. S.
3. If the sheet stays, cover the tab bar, as with the other sheets over tabs. M.

### pengaturan/tampilan: light, dark or follow the phone, as a sheet
![current](../../../output/native-review/deep-pages-2026-10-24/account/09-pengaturan-tampilan.png)

**References**
- [Ubank — Appearance](https://mobbin.com/screens/ba67a37d-3109-42f3-9203-a4e217895ce4): three preview cards (Light, Dark, System) with a radio under each. The closest to Catera's design.
- [stoic. — theme](https://mobbin.com/screens/d82f1343-1862-47b0-8814-125805bc6ebb): a plain grouped radio list with a check mark.
- [Remote Global HR — App appearance](https://mobbin.com/screens/8b77c709-6b08-4765-aee8-c9dc58f54505): a radio list plus one info line explaining "Use system settings".
- [NFL — Appearance](https://mobbin.com/screens/3745a354-24dc-448f-b37a-9d101c8733b6): a minimal radio list with the system option last.
- [Spotify for Creators — Theme](https://mobbin.com/screens/9a1d5403-47dc-4bad-b214-866160f559d4): a one-line note under the title about the device option.

**Patterns that work**
- Preview thumbnails suit a three-way choice when the selected state is unmistakable (a filled radio or a check).
- The system option explains itself in one short line.
- The change applies at once, so the user sees it behind the sheet.

**What reads as slop or unpolished in Catera**
- Unpolished: "Ikuti sistem" wraps to two lines at font 1.3 while "Terang" and "Gelap" stay on one, so the three labels do not align.
- Unpolished: the only sign of selection is a blue outline and a blue label. There is no radio or check, which is weak for color-blind users and for the half-light, half-dark thumbnail.
- Unpolished: the Terang thumbnail is pale yellow strips on near-white with a faint border, so it reads washed out next to the black Gelap.
- The line "Ikuti sistem berarti ikut tema HP kamu." is useful and should stay.

**Recommendation (ranked)**
1. Add a radio or check under each thumbnail and shorten the first label to "Sistem" so all three stay on one line. Follows Ubank. S.
2. Keep the preview cards, since they are the most distinctive control in the group, but give the Terang thumbnail a visible border. Follows Ubank. S.
3. Same sheet-over-tab-bar issue as Bahasa: cover the tab bar or open as a page. M.

---

## Auth group: login, register, recover, auth/callback, claim/[token]

All five pages are judged from code only: no screenshots exist for this group, so the screenshot line is skipped. Sign-in was rebuilt on 2026-10-23/24 (SI-1/SI-2, OKX direction, keyboard keeps the button in view) and is the strongest page here besides Claim.
- Biggest gap: the pages after the first tap (code entry, "check your email", expired link, new password) are bare forms with plain paragraphs. Top apps give each of these states one job, a real 6-cell code input, a resend timer, and an "open email app" button.
- Top 3 for the group: (1) a code input that looks and behaves like a code (cells, countdown resend, autosubmit) on Masuk and Claim; (2) one shared "check your email" state with Buka aplikasi email and a timed resend for Register and Recover; (3) bring AuthCallback onto the AuthScreen/AuthHeading system with PasswordField and a live checklist, and give dead-link states art and one next step.
- Mobbin has iOS and web only. Where a pattern is an iOS idiom (back chevron, bottom sheet), translate it to Material on Android.

### /login (Masuk): sign in by phone code, or email and password
Judged from code (`apps/customer/src/account/Masuk.tsx`, `packages/mobile-ui/src/AuthLayout.tsx`).

**References**
- [Uber Eats, Welcome](https://mobbin.com/screens/acc10634-b382-4059-b42b-fdbe210ce716): phone field first, one black Continue, other methods demoted below an "or".
- [Zomato, Log in or sign up](https://mobbin.com/screens/1e0f485e-ea9c-4a51-9203-71fe645ec099): food art above, one headline, one field, one button.
- [Swiggy, Enter your number](https://mobbin.com/screens/acfe08b9-6ad2-44f7-8deb-4fce7a2f142c): numeric keyboard open, flat disabled button above it, consent line directly under the button.
- [Bolt Food, phone sign in](https://mobbin.com/screens/4ea3a6c9-8170-4997-ac5f-8e88a921e459): the disabled button is flat grey, so the enabled state reads as a real change.
- [Instacart, Verify number](https://mobbin.com/screens/3cb88ff4-959e-4ef1-9e8b-246f72513308): code as segmented slots with the keyboard up and a resend countdown.

**Patterns that work**
- One field and one button on first view; the choice of method is a quiet second layer, not a tab bar competing with the field.
- The consent line ("by continuing, you accept ...") sits right under the primary button, not in a footer.
- Code entry is its own state with a 6-slot input, the number it went to with a "change" link, and a countdown before Resend.
- Disabled primary is visibly flat; the keyboard never hides the button.
- Errors sit between field and button, in the field's own colour (Brick, Coinbase), with the field outlined.

**What reads as slop or unpolished in Catera**
- Unpolished: the SMS code is a plain Field with a label, no slots, no countdown and no Kirim ulang. A user who did not get the SMS has only "Ganti nomor", which also clears the code. Every reference gives resend a timer.
- Unpolished: once the code is sent, the phone Field stays visible but disabled above the code Field, so two stacked boxes say the same thing. The sent number could become one text line ("Kode dikirim ke 0812... Ganti").
- Unpolished: Masuk has no consent or terms line, while Claim has one. SMS sign-in to a new number is the path that creates accounts.
- Slop-adjacent: the MethodTabs bar (Nomor HP / Email) with a forest underline is a web-style tab and weighs as much as the phone field. Email is the rare path for Catera (the caterer holds the phone number); a text link "Pakai email" under the button follows Uber Eats' layering and keeps the phone field first.
- Slop-adjacent: the email subtitle ("Masuk dengan email dan kata sandi kamu") restates the label and is filler. The phone one is useful.
- Worth keeping: the left-aligned mark that collapses under the keyboard, the error above the button, Lupa kata sandi right under the password.

**Recommendation (ranked)**
1. Segmented 6-slot code input (one hidden TextInput driving six cells, autocomplete sms-otp, submit at 6 digits) with a 30 to 60 second Kirim ulang countdown, with "Ganti nomor" kept separate. Follows Instacart and Brick. M.
2. Replace the disabled phone Field in the sent state with one text line showing the number and Ganti. S.
3. Move email sign-in from the tab bar to a text link under the primary button. Follows Uber Eats and Zomato. S to M.
4. Add one consent line under the primary button ("Dengan lanjut, kamu setuju dengan Ketentuan dan Kebijakan Privasi"). S.

### /register: create an account with name, email and password
Judged from code (`Register.tsx`).

**References**
- [Trip.com, Create an Account](https://mobbin.com/screens/04ab02d9-3a37-4389-bce7-c3d27b65e5a0): the rule sits under the field as one plain line, button pinned at the bottom.
- [Kit, Create account](https://mobbin.com/screens/4c071fd6-1d72-4222-9371-24477f3642fd): live checklist whose ticks turn green as the password meets each rule.
- [Acorns, Create your password](https://mobbin.com/screens/c0f7bb45-b48c-463e-9983-1b3cc56bb57b): one question per screen, flat grey button until valid.
- [lululemon, Create Account](https://mobbin.com/screens/2884ef2f-a290-4604-9ce6-ff64dea8ea91): short rules as ticks in a two-column grid, Sign in as the secondary action.
- [Wolt Delivery, Check your email](https://mobbin.com/screens/26cba3ed-5d5e-4949-99b4-de04e8136cfb): the sent state, with art, the address in bold and Open email app.

**Patterns that work**
- Few fields; optional ones are marked.
- Password rules shown as a live checklist, in the same place before and after typing.
- The primary label is short ("Create account"), not a sentence.
- The sent state is a separate screen: art, the address in bold, one primary to open the mail app, resend as a quiet action with a countdown.
- Show/hide as a control at the field's end.

**What reads as slop or unpolished in Catera**
- Unpolished: the button reads "Daftar & verifikasi email". At 360dp and font 1.3 that likely wraps inside the pill. "Daftar" says it; the next screen explains verification.
- Unpolished: the password hint mixes a rule ("Minimal 8 karakter") and a process note ("Verifikasi email sebelum masuk"). Two jobs in one line. The rule can tick live; the process note belongs on the sent screen.
- Unpolished: the sent state is a paragraph, two buttons and a text button on a bare page with only the title changed to "Cek emailmu". No art and no address shown. Wolt, Depop and Slack show the address so a typo can be spotted. The hedged copy ("Kalau email ini bisa didaftarkan") correctly avoids account enumeration, but the screen can still echo the typed address.
- Unpolished: there is no "Buka aplikasi email" action, so the user hunts for their mail by hand.
- Unpolished: "Kirim ulang verifikasi" has no cooldown, so it can be mashed; the confirmation is a caption under the paragraph.

**Recommendation (ranked)**
1. One shared "Cek emailmu" state for Register and Recover: StateArt pose, the typed address in bold, Buka aplikasi email (primary), Kirim ulang with a countdown, Ubah email as a text link. Follows Wolt, Depop, Slack. M.
2. Shorten the button to "Daftar" and split the hint: a live 8-character tick under the field, the verification note moves to the sent state. Follows Kit and Trip.com. S.
3. Add a consent line under the button. Follows Trip.com and lululemon. S.

### /recover: ask for a password reset link
Judged from code (`Recover.tsx`).

**References**
- [Wolt Delivery, Check your email](https://mobbin.com/screens/26cba3ed-5d5e-4949-99b4-de04e8136cfb): sent state with the address, a mail app button and an "I didn't get an email" help link.
- [Depop, Check your inbox](https://mobbin.com/screens/4502f87b-cf2f-4f86-8e07-fff5e9b46fad): spam hint plus a greyed "you can resend again in 4 seconds".
- [Slack, Email sent](https://mobbin.com/screens/1882494e-1091-41d5-a8ae-6814c8cd3ccb): one illustration, one instruction, one primary, a quiet alternative below.
- [Bluesky, Set new password](https://mobbin.com/screens/dbb2585f-596a-4526-bc1a-826db32f2f04): short reset form with the error banner directly under the fields.

**Patterns that work**
- One field and one button on the request screen; the reset itself is a different screen.
- After sending, the screen changes state instead of adding a paragraph under the same form.
- The sent message names the address, mentions spam once and offers resend after a delay.
- Back to sign in is a quiet link, not a button of equal weight.

**What reads as slop or unpolished in Catera**
- Unpolished: after sending, the confirmation paragraph appears under a still-editable email Field and the primary label flips to "Kirim ulang tautan". The page grows, and the user can edit and resend by accident.
- Unpolished: the subtitle and the sent paragraph both give the "buka di HP ini" instruction.
- Unpolished: the title "Pemulihan akun" does not match the entry link on Masuk ("Lupa kata sandi?"). Using the user's own word keeps orientation.
- Fine: error above the button, the Kembali ke Masuk text link.

**Recommendation (ranked)**
1. Reuse the shared sent state from Register in place of the form after sending. S once Register item 1 exists.
2. Retitle to "Lupa kata sandi" and cut the sent paragraph to one sentence plus the spam hint. S.

### /auth/callback: finish an email link (verify, or set a new password)
Judged from code (`AuthCallback.tsx`). It is reached by tapping a link in mail, so the first thing seen is the "checking" phase.

**References**
- [Cleo AI, Oops](https://mobbin.com/screens/919d5f6f-6844-40f4-a0c6-553eded73870): a failure with a short reason, a coloured icon and one Go back button pinned low.
- [KOHO, Unable to accept invitation](https://mobbin.com/screens/3ffdccc8-1c2f-4f87-bd48-f17173878465): an invalid link says what failed in one line, with one way out.
- [Coinbase, Enter the 6-digit code](https://mobbin.com/screens/e76b3784-5ea8-425a-b8ca-8e268ea30a0a): inline error under the field in the field's own red, Resend and Go back as the only actions.
- [Upside, Create account](https://mobbin.com/screens/7a90f8e9-906f-4adb-ba4a-27faf5fe112a): strength bar and rule list for a new password.
- [Uxcel Go, Sign up with Email](https://mobbin.com/screens/07ca8f54-2d40-489f-bdb0-9ee9be241619): rule ticks that turn green as the password gets there.

**Patterns that work**
- A link-landing screen says what is happening ("Memverifikasi..."), with a spinner or art.
- Failures state the reason plainly, then offer exactly one recovery that fits it.
- New-password forms use the same field and checklist as sign-up, with show/hide.
- On success the user is carried onward without a confirmation page.

**What reads as slop or unpolished in Catera**
- Unpolished: the page does not use AuthScreen or AuthHeading, so it differs from Masuk, Register and Recover: no mark, a different header, no keyboard-aware layout. It is the one auth page that looks like a stock form.
- Unpolished: the checking phase is one plain line under the title "Verifikasi akun", even on the recovery path. Claim uses MascotLoading for the same wait.
- Unpolished: the error phase is a paragraph and two buttons with no art. After a failed verification (not recovery), "Pulihkan kata sandi" as the primary is the wrong next step; the code cannot tell which case it is, so a neutral "Minta tautan baru" plus Masuk is more honest.
- Unpolished: the new-password form uses two raw Fields with `secureTextEntry` and no show/hide, while Register and Masuk use PasswordField. A hidden password is typed twice with no way to check it.
- Unpolished: a mismatch only disables the button; the hint says both must match, but no inline message appears when the second field differs.

**Recommendation (ranked)**
1. Wrap AuthCallback in AuthScreen and AuthHeading, and use MascotLoading for the checking phase with a title that matches the purpose once known. M.
2. New-password phase: one PasswordField with a live 8-character tick and drop the confirm field (the show toggle replaces it); if confirm stays, add an inline "Belum sama". Follows Uxcel Go and Kit. S to M.
3. Error phase: StateArt, one-sentence reason, one primary "Minta tautan baru" and a text link to Masuk. Follows Cleo and KOHO. S.

### /claim/[token]: a caterer's invite link, see the package, confirm the number, connect
Judged from code (`claim/ClaimScreen.tsx`). Seven states: reading, dead link, offline, preview, phone, code, review.

**References**
- [HelloFresh, Your Plan](https://mobbin.com/screens/6c632632-2f80-4808-a871-7f5543b39ce9): plan summary with the facts that matter before any commitment.
- [Woolworths, Subscribed!](https://mobbin.com/screens/42878139-86a3-4139-aa51-3d85127628d7): summary as labelled rows with one primary below.
- [Cherrypick, Your meals are waiting](https://mobbin.com/screens/76fad378-1d36-4b37-849f-171f5280570e): friendly mascot, one sentence, one pinned primary.
- [Instacart, Verify number](https://mobbin.com/screens/3cb88ff4-959e-4ef1-9e8b-246f72513308): code step with slots, the number shown and a resend countdown.
- [Brick, wrong code](https://mobbin.com/screens/cd3239fd-a502-4e5e-aa98-3e42506886fa): the failure names what to check and sits under the cells, not in a popup.

**Patterns that work**
- The invite leads with what the person gets (plan, days, next delivery, address), then asks for proof of identity; the primary is pinned at the bottom.
- The identity step reuses the sign-in phone and code patterns, so it is recognised.
- A masked number tells them whose phone it is before they type; a mismatch is caught before any SMS.
- Dead and offline are different states: dead is final with a human next step, offline offers retry.
- The success state says what changes next and offers one way forward.

**What reads as slop or unpolished in Catera**
- Strong page. The flow, the pre-SMS mask check and the separate dead and offline states match what top apps do.
- Unpolished: the preview centres its copy ("Dari {katering}", the paragraph) above a left-aligned Card of Fact rows. It is the only centred text in the auth group, and the Card edge does not line up with it.
- Unpolished: the preview paragraph is long for a first screen (three clauses); the card already shows what the user can do.
- Unpolished: the code step stacks the code Field, the name Field, the button, the consent caption and a Kembali text button. At font 1.3 with the keyboard up, the primary can scroll away. The name could be typed with the number on the previous step.
- Unpolished: the code is a plain Field with no slots, no resend and no countdown, same as Masuk.
- Unpolished: the review state has no Header, no art and one paragraph; the dead state is one bold line and a Beranda button.
- Slop-adjacent: the card is a spec sheet with no photo, while DESIGN.md says discovery is food-led. A caterer logo or one menu thumbnail would carry that, if the preview data has one.

**Recommendation (ranked)**
1. Share the segmented code input and resend countdown with Masuk, and move the name field to the number step: fewer stacked items under the keyboard, one identity pattern. M, shared with Masuk.
2. Left-align the preview, shorten the paragraph to "Sudah dibayar ke {katering}, tidak ada tagihan baru", and put the consent line under the pinned primary as Swiggy does. S.
3. Give the dead and review states StateArt, the reason and one next step. S.
4. Add a caterer logo or menu thumbnail to the card if the claim preview payload has one. M, depends on the data.
