# Cross-industry layout research (Mobbin, iOS), 2026-10-22

Scope: LAYOUT only (sizing, spacing, density, hierarchy, placement). Colour is out of scope.
Purpose: give the Catera customer-app layout redesign (Beranda, Jadwal, Jelajah, package detail, Akun, checkout, login) concrete numbers taken from top apps in other industries.

## 1. Method and coverage gaps

- Tool: Mobbin MCP `search_screens`, platform `ios`, output_destination `doc`. 27 search calls (limit 4-6 each). Every screen cited below was viewed as an image.
- Frame: Mobbin iOS frames are 393pt wide (1179x2676 at 3x). Low-res previews were 299px wide, so preview measurements = px x 1.31. Hi-res downloads displayed at 881px wide, so px / 2.24 = pt.
- Accuracy: measured by eye. Screens tagged **(hi-res)** were measured on the 1179px download and are good to about +-2pt. Everything else was measured on the preview and is good to about +-10%. Type sizes are inferred from cap/x-height and line pitch, so treat them as +-2pt.
- Apps covered (10): Oura, Duolingo, Airbnb, Spotify, Revolut, Monzo, Todoist, Headspace, Flo, Strava.
- Analogue coverage: "today" home (Oura, Headspace, Duolingo, Revolut, Monzo), schedule/calendar (Todoist Upcoming, Flo, Airbnb Trips, Strava streak strip), browse+detail (Airbnb, Spotify, Headspace), account/settings (Airbnb, Revolut, Monzo, Spotify, Duolingo), purchase/plan (Airbnb checkout, Revolut plans, Spotify Premium, Headspace paywall), phone login (Airbnb, Revolut).
- Gaps: Cash App, Pinterest, Booking.com, Things 3, Calm and Oura settings were not searched (budget). Strava was used only for the stat-row and week-streak patterns. Todoist returned only 5 Today results. Mobbin screens can be older app versions (Spotify tab bar, Todoist), and many results are onboarding or promo frames, so "above the fold" counts are of the captured state, not guaranteed typical content. Dark-mode apps (Spotify, Revolut, Todoist dark) were included only where the layout still reads at the same numbers.
- Hi-res images saved to `D:\Project\Catera\catera\output\mobbin\2026-10-22\cross\` (see section 5).

## 2. Per-app sections

### 2.1 Oura (health, "today" with one dominant item)

| Screen | Link | Layout facts |
|---|---|---|
| Today, goal reached (hi-res) | [b4bc9e73](https://mobbin.com/screens/b4bc9e73-f29d-495e-8ff1-9cb625020ac3) | Full-bleed photo background, no cards at all. Top bar: menu icon, wordmark, 2 icons at y~76pt. Score chips row: 71pt circles, 88pt pitch, 4.5 visible (5th clipped = scroll hint), 15pt labels below. Hero gauge arc 310pt wide, caps label 14pt tracked, number ~52pt light, serif headline ~44pt, body ~17pt centred, single "Learn more" pill 120x41pt. Hero block (arc to button) = 41% of the 852pt viewport; with chips row = 59%. Bottom: insight card peeks at y~689pt (rounded top), floating tab pill 276x62pt + separate 63pt FAB, 19pt side margin, 16pt between. Number of text sizes: 5. Progress = arc gauge with tick dots. |
| Today, activity in progress | [9fb55dff](https://mobbin.com/screens/9fb55dff-3d4a-46ad-b429-367596ebf1bc) | Same skeleton with a dismissible toast card inset ~17pt from sides at the top, 2-line, one full-width ghost button inside. State changes the headline ("Making progress"), not the structure. |
| Today with insight peek | [a57dcadf](https://mobbin.com/screens/a57dcadf-5d9a-4562-9175-896daae96c8f) | Row-style insight card (icon, title, chevron) docked above the tab pill, about 56pt tall. Secondary info sits in a peek sheet, never competes with the hero. |
| Today with stacked promo cards | [673abad4](https://mobbin.com/screens/673abad4-e8e1-4213-a3ca-89d969ddb3f0) | Two full-width promo cards (~17pt margin, ~170pt tall, 16pt gap) each with a single 40pt pill button. Shows the failure mode when hero is pushed down: the first viewport becomes all promos. |
| Vitals grid | [0501d553](https://mobbin.com/screens/0501d553-3c49-4752-a4bc-51fcc5bd068b) | 2-column grid, cards ~172x164pt (near square), 12pt gutter, ~18pt margin, ~24pt radius. Each card: 14pt grey label top-left, coloured status word, ~38pt numeral bottom-left. Section heading with icon ~20pt, ~46pt section gap. Floating tab pill overlays the last row. |
| Vitals core metrics | [948c33d6](https://mobbin.com/screens/948c33d6-f91f-4b3f-92e4-0d4d449905d6) | Same grid; every card has the same anatomy (label, "Last sleep" caption, big value + small unit). 4 cards + heading in one viewport. |
| Vitals heart health | [22fd45f7](https://mobbin.com/screens/22fd45f7-030e-47f7-8dab-e15ab6c5b2b3) | One card carries an inline sparkline across its full width, the other a plain number; status is a coloured word, not a chart. |
| Vitals activity/stress | [bce38f7a](https://mobbin.com/screens/bce38f7a-16e5-41ee-bb99-58e64992824d) | Inline horizontal progress bar (goal 114%) and a 5-segment scale in cards. Empty state: "About 14 days of data needed" plus a small icon, inside the same card size. |

### 2.2 Duolingo (gamified path)

| Screen | Link | Layout facts |
|---|---|---|
| Home path | [bfed6f7e](https://mobbin.com/screens/bfed6f7e-2b16-4e4a-a60d-ec4c7011d5b4) | Stats bar: 4 items (course, streak, gems, energy), ~30pt high, no background. Sticky unit banner card ~345x75pt, 24pt margin, ~18pt radius, caps 12pt label + 18pt bold title, a divider and guidebook icon at right. Path nodes ~72pt with a 3D lip; x offsets +-52pt in a sine; ~75-90pt pitch; 5-6 nodes per viewport; mascot occupies side whitespace. Tab bar: 6 icon-only tabs, active one outlined ~42pt, ~92pt total height. Whitespace is the layout. |
| Home with unit bottom card | [f482c76d](https://mobbin.com/screens/f482c76d-09ea-43b4-a3b5-85538d9ff763) | Tap on a node opens an inline green card (~345pt wide) with title, level pill and a full-width 306x42pt button. Inline popover instead of a new screen. |
| Course picker dropdown | [aca28147](https://mobbin.com/screens/aca28147-dff2-40c7-97e4-bb12eb0d3bc6) | Top-bar dropdown panel: 3 tiles ~84x70pt in a row, "New courses" section 3-up. |
| Unit colour change | [a0faf7ba](https://mobbin.com/screens/a0faf7ba-d7f2-4d83-bb74-b9f90337f362) | The banner and nodes re-tint per unit; layout identical. Scroll-to-current arrow button (~44pt) bottom-right. |
| Profile hero | [c85d1118](https://mobbin.com/screens/c85d1118-8d07-4346-ae1f-04a35a6405dc) | Coloured header ~256pt tall with illustration; 3-column stats; outlined "ADD FRIENDS" button ~282x45pt + 45pt QR square; promo card with white button; "OVERVIEW" caps grey 13pt label then a 2x2 stat grid with 18pt bold numbers. Section gap ~40pt. |
| Profile sections | [7dc56e7a](https://mobbin.com/screens/7dc56e7a-5099-44aa-88c1-5a8cb629eab6) | Plain page (no cards): caps grey section labels, row of 5 circle avatars, 4-up badge row (~68pt each). Inline nav title left-aligned ~22pt + gear right. |
| Profile, empty | [64ee7bc1](https://mobbin.com/screens/64ee7bc1-2fbd-4f2d-a5e1-8c27805ba882) | Empty state is a card with mascot + "1 STEP LEFT" + full-width 45pt button; dashed-ring placeholders for empty slots. |
| Profile scrolled, locked slots | [6fc3542d](https://mobbin.com/screens/6fc3542d-206a-486f-999f-aa1fb9ca8a97) | Locked items rendered as grey ghost badges at the same size, so layout never shifts. |

### 2.3 Airbnb (travel, browse + trips + detail + checkout + login)

| Screen | Link | Layout facts |
|---|---|---|
| Trips, compact list (hi-res) | [a12e7c67](https://mobbin.com/screens/a12e7c67-bf56-4ba3-af0f-102bfb2797e0) | Large title "Trips" ~32pt at left, 24pt margin. Group headings ("Miami Beach") ~19pt semibold, ~37pt gap between groups. Row card 344x80pt, ~20pt radius, hairline shadow (no border), 64pt square thumb with ~10pt radius, 8pt inner padding; title ~17pt, meta ~15pt grey. Tab bar 5 tabs, ~83pt incl. safe area. |
| Trips, first card large | [79f36e2f](https://mobbin.com/screens/79f36e2f-ac49-4169-b473-abb7b0dd13bd) | Same title; ID-review banner card (~344pt, 1pt border, 16pt radius, icon + 2-line text); next trip card is large: ~1.6:1 image inset in a white card with ~8pt padding, 22pt title below. Only ~1.3 trips above the fold. |
| Trips, empty | [01f52e72](https://mobbin.com/screens/01f52e72-2105-4946-8936-93d60b15ba7f) | Illustration of a skeleton timeline (3 ghost cards with a rail), 17pt bold headline, 2-line grey copy, one ~102x46pt filled button. Content block vertically around 40%. |
| Trip itinerary | [1e9e8e06](https://mobbin.com/screens/1e9e8e06-9b27-4ac5-8ea4-b6da24875fdb) | Day chips (circle ~29pt with "Fri 5") on a left rail, each day a card ~60pt tall ("Check in after 7:00 PM"). Then "Discover experiences >" 18pt heading and a 168pt-wide ~1.05:1 image carousel with ~12pt gaps and next-card peek. |
| Reservation details | [8153b618](https://mobbin.com/screens/8153b618-9c51-4c1e-8b1b-32b692a02e9b) | Plain page: 22pt section title, label 17pt bold, value 17pt, hairline dividers between fact groups, a thick grey band (~8pt) between major sections, rows with chevron actions ~56pt. Circular back button ~40pt. |
| Trip map section | [c28dbd25](https://mobbin.com/screens/c28dbd25-9b70-474f-86f9-2a0442d8af03) | Map card 344pt wide, ~24pt radius, inside the page margins. Action list 56pt rows with 24pt icon + chevron. |
| Explore, Homes | [2df6111d](https://mobbin.com/screens/2df6111d-0888-47ab-8d35-6a2f20d66eb2) | Search pill ~345x58pt at top with the 3 category tabs (emoji icons) below, then carousels: section header ~19pt + chevron, cards ~168pt wide and ~160pt tall (about 1.05:1, ~21pt radius), 12-13pt gaps, 14pt title + 14pt grey meta below. 2 full carousels per viewport; ~43pt between sections, ~20pt header to image. |
| Explore, recently viewed | [4f347fd4](https://mobbin.com/screens/4f347fd4-5793-41df-a0d9-b29fe02131cc) | "Continue searching" resume card (~345x~100pt, text left, tilted thumbnail right) above a smaller 108pt square thumbnail carousel. Shows size hierarchy: resume card, then small cards, then large cards. |
| Explore, Experiences | [9fb2045b](https://mobbin.com/screens/9fb2045b-480f-432a-a508-769a74b5d491) | Same 2-carousel rhythm; overlay chips on photos ("Original", heart) ~12pt text; 2.2 cards visible. |
| Explore, Services | [49f0730c](https://mobbin.com/screens/49f0730c-6356-476a-b481-b679952db447) | Category tiles ~108x~108pt with label + count underneath, then a titled carousel. |
| Experiences results | [b961fe67](https://mobbin.com/screens/b961fe67-3637-4f52-bbf5-56f79595571e) | Vertical list of full-width cards (344pt) with a 2x2 photo collage, 20pt+ gap, title ~17pt semibold, meta lines 14pt. Filter chips row (Type, Duration) ~36pt tall, 10pt gaps. Search pill collapses to a 2-line summary with back and filter buttons. |
| Listing detail, top (hi-res) | [53d912ff](https://mobbin.com/screens/53d912ff-a3dc-472b-b525-379c327a89e8) | Full-bleed hero 393x350pt (~1.12:1, 41% of viewport), floating 40pt circular back/share/heart chips, "1 / 27" counter chip. White sheet overlaps hero with ~22pt top radius. Centred title ~26pt semibold, 2 lines, 30pt line pitch; centred 16-17pt grey subtitle. 3-column stat strip (4.96 / Guest favorite / 298 Reviews) ~70pt tall with vertical hairlines; 22pt numerals. Host row 82pt tall (40pt avatar). Hairline dividers at 24pt margin. Strip "Rare find!" 33pt full-bleed grey. **Sticky bar**: ~86pt content + safe area, price 17pt bold underlined left, 14pt grey dates, "Free cancellation" chip 130x22pt, Reserve pill 144x49pt, 24pt right margin. |
| Listing detail, host | [d71700a0](https://mobbin.com/screens/d71700a0-2e5e-4274-9d02-75b399408802) | Shadow card (344pt, ~24pt radius) with 105pt avatar left and 3 stacked stats (number 22pt, label 14pt) separated by hairlines at right; below, 24pt icon + 17pt text lines at ~44pt pitch. |
| Listing detail, host message | [a19de186](https://mobbin.com/screens/a19de186-cddf-4b42-98e1-e00d97dd099d) | 17pt body, section titles 22pt, full-width grey button ~345x~50pt "Message host", 12pt legal note with icon; sticky bar persists. |
| Listing detail, map | [c405c80d](https://mobbin.com/screens/c405c80d-fbca-4959-9aae-c95a0dd39d7a) | Section title 22pt, grey location 16pt, map ~345x430pt (portrait ~4:5), 24pt radius. Sticky bar docked. |
| Experience detail, floating bar | [7c01fb4a](https://mobbin.com/screens/7c01fb4a-eef8-4353-b4a5-09f286d74b4c) | Alternate: bar floats as an inset pill (~20pt side margin, ~66pt tall, large shadow) with "From $45 / group" + red "Free cancellation" and a ~104x45pt Reserve. Content scrolls under it. |
| Experience detail, trust block | [9d9a4ceb](https://mobbin.com/screens/9d9a4ceb-25dc-4570-a39c-60cee27df14e) | "Things to know" rows with 24pt icon, 17pt label, 15pt grey detail; then a tinted off-white section with a centred wax-seal illustration, 20pt headline. |
| Account settings list | [936fbfe8](https://mobbin.com/screens/936fbfe8-4c12-4c69-95f0-6c56b7dede64) | Circular back chip ~40pt, large title ~32pt, then plain rows 56pt pitch, 26pt icon at 24pt margin, 17-18pt label, grey chevron, no row dividers, a single hairline before the version footer. 8 rows in one viewport. |
| Profile tab | [dc125dc8](https://mobbin.com/screens/dc125dc8-e3de-45d4-a8fc-116f2dfa2515) | Large title ~24pt; promo card (344pt, shadow) then plain 56pt rows, one hairline separates group 1 and group 2. Floating black pill "Switch to hosting" ~190x42pt above the tab bar. |
| Personal info rows | [45f2625c](https://mobbin.com/screens/45f2625c-6e4e-4385-8e7a-faa4381f0db7) | Two-line rows ~92pt pitch: 17pt label, 14pt grey value, underlined 15pt action ("Edit"/"Add") right-aligned, hairline dividers inside the 24pt margins. |
| Login and security | [324218c7](https://mobbin.com/screens/324218c7-44d9-4e3e-813e-cf46e1ff82d4) | Large title; underlined tab pair (Login / Shared access); 24pt section titles, rows with underlined action, an info card (344pt, 1pt border, ~16pt radius, 24pt icon). |
| Public profile | [ce701cb0](https://mobbin.com/screens/ce701cb0-23d0-4c04-9dfc-f2101053a553) | Centre-aligned shadow card (344pt) with avatar and name, then icon+text list at ~44pt pitch. |
| Host sheet | [9129b0d0](https://mobbin.com/screens/9129b0d0-1399-41f9-8e92-d6c9bb96e093) | Modal sheet with X (not full-screen) over a darkened parent, same card + list. |
| Checkout, review and continue (hi-res previews also saved) | [7860fa67](https://mobbin.com/screens/7860fa67-72b3-42d0-8092-c0ac9fe7dcf7) | Large title ~26pt. Summary card 344pt, 1pt border, ~20pt radius; ~100x~80pt thumb + title; fact rows separated by hairlines at ~16pt padding; small grey "Change"/"Details" pills ~76x29pt. "Choose when to pay" radio group. 4-segment progress bar flush above a black full-width "Next" button ~345x47pt. |
| Checkout, confirm and pay | [4379c3ee](https://mobbin.com/screens/4379c3ee-9796-4e45-a03b-ef100454134d) | Order: payment-method row (344pt, bordered, chevron, ~56pt), card-brand logos 12pt, hairline, coupon row (same style), price details 17pt, hairline, bold total, 12pt legal text with underlined links, full-width gradient CTA ~345x48pt. Section titles 18pt bold. Centred inline title with X. |
| Checkout, group option | [a28898c6](https://mobbin.com/screens/a28898c6-3abf-48d9-8d2d-7cdd41662620) | Checkbox card (bordered, 2-line). CTA sits mid-page here, legal copy below it. |
| Checkout, summary-first | [e9da847d](https://mobbin.com/screens/e9da847d-3b16-4b23-a21c-d750ea9dbf06) | Summary card first, with a floating "Review" pill ~146x~45pt that scrolls the user to the CTA. |
| Checkout, insurance add-on | [6fcb1b5f](https://mobbin.com/screens/6fcb1b5f-1d43-4f53-a444-09897db7de89) | Sticky footer with total row + CTA, thick grey band between header and list. |
| Checkout, processing | [eab5a289](https://mobbin.com/screens/eab5a289-47ce-4cc3-a8f8-6c66dd161db8) | Pure centred illustration + 20pt two-line label; nothing else on screen. |
| Login, phone | [80b459e6](https://mobbin.com/screens/80b459e6-da95-4a46-a7c3-fd67f311ac2a) | Bottom sheet, centred 16pt title + X. Country selector and phone input as one bordered box ~114pt tall (2 rows ~57pt), 12pt helper, gradient Continue ~345x50pt, "or" divider, then 4 outlined buttons ~345x50pt on 63pt pitch (13pt gaps). |
| Login, code | [7c29f93b](https://mobbin.com/screens/7c29f93b-0d2d-4cae-aa7a-ba185f1355b0) | Single bordered field (~47pt) with 6 dash placeholders, "Send again" underlined, disabled Continue directly above the keyboard. |

### 2.4 Spotify (media, browse + settings + plans)

| Screen | Link | Layout facts |
|---|---|---|
| Home, shelves | [5b8cc83b](https://mobbin.com/screens/5b8cc83b-d41b-4cd8-b37d-bb52594fe867) | Dark. 16pt margin. Filter chips row (~34pt tall, 10pt gaps, avatar chip first). Shelf titles ~20pt bold; square art cards ~146pt, ~18pt gap, 13pt title + grey 2-line subtitle; ~50pt between shelves. 3 shelves visible. 4-tab bar with labels. |
| Home, mixes + start listening | [898b4d92](https://mobbin.com/screens/898b4d92-d677-4431-a9a1-c05fd656f678) | Mix cards ~164pt wide with a caption bar over the art, then a 3-row list (60pt pitch, 48pt art, 16pt bold title, 14pt grey subtitle, "..." menu). Mixes cards and lists alternate to vary density. |
| Home, 2-col shortcuts | [ac1946e9](https://mobbin.com/screens/ac1946e9-29ef-4953-a433-d073ed7bb066) | 2-column quick tiles ~176x48pt, 8pt gaps, ~6pt radius, art flush-left 48pt. 3 rows of tiles at the very top of Home. |
| Home with mini player | [a00b0de3](https://mobbin.com/screens/a00b0de3-fd11-4f51-bcae-92208072b6fc) | Mini player docked above tab bar: inset ~8pt, ~50pt tall, ~8pt radius, tinted from art, play control right. |
| Playlist detail (small cover) | [61af77a4](https://mobbin.com/screens/61af77a4-a534-4b48-b0ea-d440f7da6943) | Header: 115pt cover left, 22pt title right. Action row: ~31pt icons and a 47pt green play circle right. Action chips ~37pt tall. Track rows 63pt pitch, 48pt art, 16/14pt text. Header tinted by the cover colour. |
| Playlist detail (large cover) | [d1310d34](https://mobbin.com/screens/d1310d34-174f-48ae-afa1-503c841f9f37) | Cover ~245pt square centred, title 22pt left under it, same action row; ~2.5 track rows visible. |
| Playlist detail variants | [49811125](https://mobbin.com/screens/49811125-7072-43f0-9c31-44d995be6ead), [c04902ce](https://mobbin.com/screens/c04902ce-c07d-49fd-a027-c21ae6babf48) | Toast ("Playlist is now Private") as a white ~345x~44pt card above the tab bar; "Find on this page" search bar replaces the top. |
| Settings, notifications list | [3b16d13c](https://mobbin.com/screens/3b16d13c-6849-41a8-9f72-95d8fa0ab040) | Inline centred 17pt title + back chevron; plain rows on black, no cards, no dividers, ~60pt pitch (17pt title + 13pt grey "Push, Email" value + chevron). 16pt margin. 10 rows per viewport. |
| Settings, playback | [7611d45b](https://mobbin.com/screens/7611d45b-9b6d-4f5a-9b8a-5f0e38c8dcd8) | Section titles ~24pt bold, toggle rows ~56pt with 52x31pt switches, 13pt grey helper under each, a slider (0s to 12s). Hierarchy by weight only. |
| Settings, toggles | [8bb0e993](https://mobbin.com/screens/8bb0e993-ef1b-43a4-8eca-3e45a1ecab60) | A screen with 2 rows only; whitespace below stays empty. |
| Settings, apps and devices | [05996e11](https://mobbin.com/screens/05996e11-1575-498f-9801-3ce2f4bd7e32) | Row with 40pt logo + 17pt name + outlined pill ~86x35pt "Get app"; helper text 13pt grey below. |
| Settings, downloads | [4851d156](https://mobbin.com/screens/4851d156-bf98-4fe7-bf34-d7199b526fd3) | Toast over tab bar; 24pt section titles. |
| Settings, storage | [598d91fd](https://mobbin.com/screens/598d91fd-86ef-4c34-99bc-e1c269f13685) | Segmented storage bar ~10pt tall, full width, with a legend of coloured dots (13pt); action rows with outlined pills ("Remove", "Clear") ~70x34pt right-aligned. |
| Premium, plan cards | [93d81734](https://mobbin.com/screens/93d81734-f8e9-40f4-a2ce-1c248bac5aeb) | One card per plan, full width (~345pt), ~10pt radius, 16pt padding, ~20pt gaps. Tab chip "Current" attached to the card's top-left. Plan name 22pt bold in the plan's accent colour, price 16pt, 3 bullet lines 14pt, full-width CTA ~324x47pt inside the card. Only the plan the user can act on shows a button. |
| Premium, offer plan | [8ab706d8](https://mobbin.com/screens/8ab706d8-db6f-4bcd-8250-142978479938) | Pink promo tab, price emphasised 17pt ("US$0 for 4 months"), small "US$11.99/month after", bullets, full-width pill, 12pt legal under it. |
| Premium, benefits list | [0df807fd](https://mobbin.com/screens/0df807fd-4b48-46c5-8d6d-d0c840fcc040) | "Why join Premium?" in a dark card: 6 rows with 22pt icons at ~34pt pitch. |
| Premium, hero | [f7a66c2e](https://mobbin.com/screens/f7a66c2e-6c88-4d49-bea8-491902d3ff21) | Art header ~230pt, 28pt title, caption pill, full-width white CTA ~345x47pt immediately under the title, legal 12pt. CTA above the fold. |

### 2.5 Revolut (fintech: home, grouped lists, plans, login)

| Screen | Link | Layout facts |
|---|---|---|
| Home | [dad40228](https://mobbin.com/screens/dad40228-042e-4bff-abf4-6c8cee4d9bcb) | Full-bleed gradient header. Top bar: avatar, search pill ~36pt tall, 2 icon buttons ~36pt. Balance centred: caption 13pt, value ~40pt with smaller cents (~26pt), "Accounts" pill ~78x29pt, page dots. **Action row**: 4 circles ~48pt with 14pt labels, 90pt pitch. Then translucent cards (16pt side margin, ~16pt radius, ~12pt gaps): transaction card (1 row ~56pt), "Products for you" rows ~76pt each with ~37pt pill buttons. Header+actions ~60% of the first viewport; first card starts mid-screen. Tab bar 5 tabs. |
| Home, transactions | [a2e597fa](https://mobbin.com/screens/a2e597fa-50af-426b-93ba-5726fc0ef3da) | Transaction card with 2 rows (~76pt each incl. 2-line text, 37pt icon, right-aligned amounts 16pt + secondary 13pt grey) + centred "See all" ~48pt row. |
| Home, empty account | [c6ff440a](https://mobbin.com/screens/c6ff440a-c7e0-4cae-b524-d2e50b746c68) | Empty state = one 56pt row card, puzzle icon + "No transactions yet". No illustration. Below, an "Automations" card with a titled row ("Allowance, Paused"). |
| Home, allowance active | [0582a39e](https://mobbin.com/screens/0582a39e-955b-4b24-9b76-57129bc61544) | Same layout; row subtitle changes ("$2 every Tuesday"). Disabled action ("Withdraw") shown at lower opacity, keeping the 4-slot row stable. |
| Home, goal | [ce5b749f](https://mobbin.com/screens/ce5b749f-117f-46ed-b573-35e9360056c3) | Colourful mesh header, same structure. |
| Home, request card | [5be4e584](https://mobbin.com/screens/5be4e584-20cf-45a5-aade-d505997121b7) | Light variant; a card with row + 2 buttons side by side (~140x37pt each) and a pager of dots under swipeable cards. |
| Menu sheet | [8b0c7aa9](https://mobbin.com/screens/8b0c7aa9-1dd5-45e5-92c4-35dc1ffb5559) | Avatar ~68pt centred, handle, then two half-width tiles ~175x138pt (Premium / Referrals), then a grouped card of 5 rows ~56pt pitch, 21pt icons, red count badge. |
| Menu sheet, scrolled | [e97489fe](https://mobbin.com/screens/e97489fe-6197-4a96-8267-818466b64ecc) | Groups separated by ~10-12pt; footer version 13pt grey centred. Inline red status text ("Verify your email") under a label. |
| Account list (hi-res) | [2562dc46](https://mobbin.com/screens/2562dc46-5414-4d29-9d1c-0792b6b5a129) | Back arrow row at ~76pt, large bold title ~34pt left. Grouped cards: 16.5pt side margin, 360pt wide, ~18pt radius, rows 56pt pitch, 18pt blue icons 34pt from the card edge, 17pt label at x=72pt, **no divider lines, only spacing**, 16.5pt gap between cards, destructive "Close account" in its own card. Toast pill at the bottom ~270x56pt. |
| Settings | [1e04865a](https://mobbin.com/screens/1e04865a-7585-4f75-bb20-fbcc93994b6b) | Section titles ("General") 18pt regular weight above grouped cards; 2-line rows (label 17pt + 13pt grey) ~72pt; red text-only destructive card. |
| Edit profile | [7b3b7eec](https://mobbin.com/screens/7b3b7eec-703d-42b4-b16b-6743dc2400eb) | Each field is its own dark card ~357x56pt, 13pt floating label above a 17pt value, ~10pt gaps. Disabled fields dimmed. |
| Profile photo sheet | [66c55a36](https://mobbin.com/screens/66c55a36-e951-40b8-ae10-277b695e5bb8) | Bottom sheet with handle, 4-up thumbnails ~85pt, a full-width row button ~56pt. |
| Plans, select (hero) | [1af3056a](https://mobbin.com/screens/1af3056a-424f-4d82-8f48-b5797a1e3171) | Large title ~31pt; segmented control ~142x32pt; hero card ~345x97pt with card image + "Special offer" chip, price line 17pt; "Included with Premium" horizontal carousel of ~52pt circular logos with 12pt 2-line captions; features card; **pinned white pill CTA ~345x47pt with 12pt fine print under it**, content scrolling beneath. |
| Plans, feature list | [c7ac52e8](https://mobbin.com/screens/c7ac52e8-727e-4979-bf8e-13c44bde6ebb) | Feature rows with 22pt icon, 17pt title, 14pt grey 2-line detail; same pinned CTA. |
| Plans, upgrade | [901bd0b2](https://mobbin.com/screens/901bd0b2-6a80-4698-9a58-696d6eccf40e) | Same skeleton (title, hero, carousel, features, pinned CTA). The structure is reused for every tier. |
| Plan, current status | [e12750f4](https://mobbin.com/screens/e12750f4-27ea-4fd5-8547-84c6e3f4aa3a) | Large title, subtitle "Free trial · Next payment on ...", two pills ("Upgrade" white, "Manage" dark) ~100x37pt; "Your limits" card of 3 rows with 40pt ring icons; "See all" link right of each section title. |
| Plan, downgrade | [9ff8fb67](https://mobbin.com/screens/9ff8fb67-e2fd-4abc-b43a-1c06b665ca24) | Primary white "Keep my Premium plan" over secondary dark "Proceed with downgrade", both ~345x47pt, 16pt gap. Retention screen puts the benefits in a card first, buttons last. |
| Plan, change | [3f7f502f](https://mobbin.com/screens/3f7f502f-af09-4722-aac5-0ad7034a4b65) | Two cards only: upgrade card (text left, card image right ~110pt) and a plain red "Downgrade to Standard" row. 13pt grey legal. |
| Login, phone | [cd8d5587](https://mobbin.com/screens/cd8d5587-b72e-4de7-aefb-d8d4622cfc11) | Back arrow, ~34pt title, 13pt grey subtitle, country chip ~79x47pt + phone field ~250x47pt on one row, link "Already have an account? Log in", disabled full-width Create account pill above the keypad. |
| Login, confirm number | [a0f2126a](https://mobbin.com/screens/a0f2126a-d587-4e3c-9663-779cf401f10f) | Centred modal ~358pt wide, number 22pt, 2 stacked buttons ~330x47pt (Confirm white / Go back dark). |
| Login, code | [35b44a81](https://mobbin.com/screens/35b44a81-5e79-42a9-9aca-22f79773d90e) | 6 boxes in a 3+3 grouping with a dash, each ~37x47pt, ~7pt gaps; "Choose another method" blue link ~13pt. Keypad up, title ~34pt. |
| Login, welcome back | [306b25b8](https://mobbin.com/screens/306b25b8-5d00-41a4-8f59-01ecd4560a24) | Phone row, "Lost access..." link, Continue, "or", three dark full-width buttons ~345x52pt, ~13pt gaps. |
| Login, typed | [f007822c](https://mobbin.com/screens/f007822c-ed64-4a8d-8c6a-753fb18f7ddc), [ad82bfa1](https://mobbin.com/screens/ad82bfa1-fa75-4dc0-8dd9-0146f2e1745f) | The primary button turns white (enabled) vs grey (disabled), and shows a spinner in place of its label when submitting. |

### 2.6 Monzo (fintech: home with stacked cards, settings)

| Screen | Link | Layout facts |
|---|---|---|
| Home, deck + activity | [d8fad0d1](https://mobbin.com/screens/d8fad0d1-f10e-4aa6-860c-46fe35e23d77) | Warm gradient. Top: avatar chip ~40pt, action pill (gift, search, plus) ~42pt tall. Balance chips carousel ~138x79pt, ~18pt radius, scrolls (3rd clipped). **Stacked card deck**: front card ~358x128pt, ~20pt radius, 2 cards behind peeking ~35pt each. Then white "Activity" card (~358pt, ~24pt radius): section title 14pt bold, rows ~55pt with 34pt icon, 17pt merchant, 21pt amount with smaller pence. Cards ~22pt apart, 16pt margin. |
| Home, compact | [6a68b1f3](https://mobbin.com/screens/6a68b1f3-1b40-4a94-855b-1ba46763c5e5) | Deck + Activity card, then "Savings & Investments" card peeking. Floating tab pill with capsule highlight on the active tab. |
| Home, notification | [07263bcf](https://mobbin.com/screens/07263bcf-0be2-4cfc-a105-c0e047a96e90) | A full-width info card (icon, 2-line text, "See all" pill) above the deck. |
| Home, chips | [97bba5b9](https://mobbin.com/screens/97bba5b9-6e10-4e5c-b6fd-9d29b54831f2) | Same, with a Labs row ("Spending Block") using a "..." right. |
| Home, pots | [9fc7dff6](https://mobbin.com/screens/9fc7dff6-d80d-4034-9986-a17956c78965) | Pots carousel inside a card (tiles ~125x~100pt, ~16pt radius), "Suggested for you" tiles with x dismiss, "Rewards" card with an "Activate" pill ~80x34pt. A long-press menu offers "Edit layout / View as list". |
| Account detail | [6c2bac17](https://mobbin.com/screens/6c2bac17-2f8f-468d-bc8f-c77b4cf7ea5b) | Coral card ~358x~125pt with balance 28pt and 2 pills (Add money, Card); below it a white list card with date headers ("Today", "Yesterday") 14pt bold + rows ~55pt. Back and 2 icon buttons ~43pt. |
| Settings (hi-res) | [6b891ec1](https://mobbin.com/screens/6b891ec1-ab93-464c-b98d-0fef1c262968) | Page is a white-ish sheet with ~24pt top radius; centred 17pt inline title; 43pt circular back chip. Inset grouped cards: 16pt margin, 361pt wide, ~22pt radius; rows 54pt; 31pt rounded-square coloured icon chips; inset hairline dividers that start at the label (79pt) and run to the card edge; chevrons at 357pt. Groups ~34-35pt apart. Profile row first (40pt avatar, name + "Personal details"). "Close account" and "Log out" each in their own single-row card. Version 14pt grey centred. Only 7 rows on a 852pt viewport (airy). |
| Privacy and security | [a0a06b80](https://mobbin.com/screens/a0a06b80-d459-48bb-9a57-cd523c95c2a6) | Caps group headers ~12pt grey ("SECURITY", "PRIVACY") above each card; rows with toggles/values ("On") and 2-line rows; a status card at top with 44pt icon. |
| Account activity | [8c95c08a](https://mobbin.com/screens/8c95c08a-80ac-4a31-b033-a54411f895c2) | Large 24pt title with a ~90pt illustration right; toggles with sub-labels 12pt. |
| Manage apps | [0f8d13ef](https://mobbin.com/screens/0f8d13ef-84e5-493d-b2f0-b961b36a07e9) | Rows ~56pt: 31pt icon, 17pt title, green 13pt status line under it. |
| Appearance | [095fb072](https://mobbin.com/screens/095fb072-1918-482f-9464-98b9b32aef91) | Two cards with a 14pt bold title inside the card, rows ~54pt. |
| Marketing | [0804a8c2](https://mobbin.com/screens/0804a8c2-a020-4b37-bd68-7f38e2c2455c) | Card with a tinted illustration panel (~345x~130pt), title, 2-line body, "Learn more" pill ~85x32pt, then a toggle row inside the same card. |

### 2.7 Todoist (tasks: today and schedule)

| Screen | Link | Layout facts |
|---|---|---|
| Today (cards) | [7ff218cf](https://mobbin.com/screens/7ff218cf-1ddd-47ee-9123-72535e5f9283) | Inline centred 17pt title, top-right pill with 2 icons. Section header "Overdue 4" bold 16pt + red "Reschedule" right. Each task its own card ~345x~82pt, ~10pt radius, ~10pt gaps, 24pt circular checkbox, 17pt title, 13pt meta line with date icon in red, project tag. Floating tab pill (4 tabs, capsule on active). |
| Today (dark) | [b0aa6925](https://mobbin.com/screens/b0aa6925-dc7a-4e60-bfc1-347e57d330b5) | Same layout dark; card surface a half-step lighter than the page. |
| Inbox, plain list | [c7598a02](https://mobbin.com/screens/c7598a02-3ffd-46cc-8c75-aa129b46e237) | Large title ~31pt; plain rows (no cards) with hairline dividers; priority-coloured checkboxes (red/orange/blue); sub-tasks indented ~31pt; red FAB ~60pt circle bottom-right above the tab pill. Same data, rendered in both styles, so Todoist demonstrates the card-vs-list choice. |
| Inbox, dark | [397d967f](https://mobbin.com/screens/397d967f-20aa-42ec-ab91-633a084e601e) | Same, with date chips in priority colours. |
| Upcoming, week strip | [4159b14b](https://mobbin.com/screens/4159b14b-0ff2-4130-8844-616b858a7e78) | Month label "Feb 2026 >" 16pt; 7-column strip with 12pt caps weekday letters and 18pt day numbers; selected day = filled red circle ~29pt; a small dot under days that have tasks; a drag handle to collapse. Under it: "Overdue" header with collapse chevron, then date-grouped headers ("Feb 4 · Today · Wednesday", 16pt bold) with hairline above; rows ~62-66pt (17pt title, 13pt meta, project tag right-aligned in grey). Strip is ~110pt of 852 (13%). |
| Upcoming, dark | [1ae63b10](https://mobbin.com/screens/1ae63b10-6840-42ec-838a-0117cb219e99) | Same; selected day Thursday, showing the strip moves the list. |
| Calendar view | [d47e73a3](https://mobbin.com/screens/d47e73a3-2711-4811-b66f-616f1c905bf3) | 3-day time grid (hours 1pm to 10pm at ~55pt per hour) with coloured blocks; an "All day" row on top; a red now-line. |
| Welcome sheet | [07899b1a](https://mobbin.com/screens/07899b1a-54e6-41be-8d8f-95f219f2bb91) | Sheet with ~22pt top radius, handle, a 16:10 video thumbnail card, 20pt headline, one full-width red pill ~345x47pt. |

### 2.8 Headspace (wellness: Today timeline, plan, paywall)

| Screen | Link | Layout facts |
|---|---|---|
| Today (hi-res) | [1cba404f](https://mobbin.com/screens/1cba404f-413c-4a8b-be36-d791e9ca4fed) | Header icons row (heart, history) ~20pt at y~93pt; greeting 17pt grey, "Start your day" ~24pt bold, left aligned at 24pt. **Timeline rail** at x~26pt: 20pt status dots (green check = done, orange = current, grey ring = upcoming) joined by a dashed line. Cards 329x151pt (x 48 to 377pt, right margin 16pt), ~18pt radius, 1pt bottom shadow, warm-grey surface (no border). Inside: 22pt bold title (up to 3 lines), 15pt meta with type icon, duration 15pt, 32pt "..." circle; illustration 142x95pt (1.5:1, ~12pt radius) right, 12pt padding. Gap between cards 22pt. 3 cards = 61% of the viewport. 3-tab bar with labels 12pt, ~90pt. |
| Today, second state | [c7fcbf0d](https://mobbin.com/screens/c7fcbf0d-0846-43a4-a0b5-89e681b6f4ce) | Two done, one current: the rail alone shows progress. |
| Today, time-of-day sections | [005702a0](https://mobbin.com/screens/005702a0-d4fb-466a-a591-36abe479f465) | Section titles ("Your afternoon lift", "At night") ~22pt bold, ~34pt between sections; cards continue on the same rail. |
| Explore | [9fb74046](https://mobbin.com/screens/9fb74046-d5b5-4af9-9204-78cacdd67661) | Search pill ~345x47pt; 2x2 quick buttons ~168x50pt (10pt gaps, ~18pt radius, 17pt bold label + icon); "Featured Collection" full-width banner ~345x110pt; "Guided Programs" stacked wide cards ~345x~100pt. |
| Plan intro | [3ab1a91f](https://mobbin.com/screens/3ab1a91f-775e-4f76-9610-f6ca895349e7) | Illustrated header ~140pt with a ~56pt avatar overlapping the sheet edge; centred 24pt title; chips "18 sessions", "<10 min a day"; paragraph 17pt; accordion cards (Part 1/2/3) ~345pt wide with a purple "Part 1" pill. Sticky blue pill "Begin program" ~345x47pt, ~24pt from bottom. |
| Plan intro, scrolled | [43017efe](https://mobbin.com/screens/43017efe-d5ed-4074-931b-e63c5d0f1b59) | Close X chip stays pinned; CTA stays pinned; content scrolls under it. |
| Programme session cards | [99e475d3](https://mobbin.com/screens/99e475d3-6e41-4266-aad1-8a2f1e781f2d) | Part/session caps label 13pt, 24pt title, one compact done card (~345x~70pt) then a large card with ~345x~150pt image, title 20pt, 2-line 15pt text, a duration pill; dotted connector between cards. |
| Session progress | [3a435349](https://mobbin.com/screens/3a435349-e9c8-4a37-8759-6abf32039ed9) | Numbered circles 1 to 10 in 5 columns (~47pt circles; done = green check, current = blue play, future = grey), "Download all" toggle row, "Techniques" rows with 56pt thumbnails. Sticky blue "Next Session" pill. |
| Podcast detail | [f2297328](https://mobbin.com/screens/f2297328-ef5d-42b9-96ba-e851f428f5e4) | Header image ~345x~190pt inset (not full-bleed, ~20pt radius), 26pt title, 15pt grey meta, "Episodes" 20pt, cards ~345x~100pt with a ~24pt blue play dot + duration. |
| Browse list rows | [7e28829a](https://mobbin.com/screens/7e28829a-505f-44ac-b26b-7f4b9167fbfd) | Plain rows ~64pt pitch, 56pt rounded thumbnails, 17pt bold title, 14pt meta with icon, chevron. 9 rows per viewport. |
| Paywall, trial timeline | [a9bf58c3](https://mobbin.com/screens/a9bf58c3-250a-4565-9808-c4722933ea54) | Illustrated sun header ~170pt, centred 26pt title, 15pt price line, a segmented Annual/Monthly toggle ~150x32pt, then a **3-step vertical timeline** (Today / In 12 days / In 14 days; 29pt icon circles on a rail, 16pt bold step title + 15pt grey line), "Restore Purchase" link, pinned blue pill CTA ~345x47pt ~29pt from bottom. |
| Cancel retention | [c995f167](https://mobbin.com/screens/c995f167-095b-40b4-b8e1-13e2a3c54cc1) | Centred title, price card with strike-through old price, body paragraph, two stacked buttons (filled dark primary + outlined secondary) pinned at the bottom with a hairline above them. |
| Profile progress | [2f93fcaf](https://mobbin.com/screens/2f93fcaf-1757-407f-a207-9d6072bc00e6) | Illustrated header with a gear chip; "My progress" 22pt, chips for metric, an empty chart state = a bordered tooltip card ("Start tracking your stress...") over the faded axes, then a full-width blue "Check in" pill ~345x47pt. |
| Profile progress, 2nd | [0731479c](https://mobbin.com/screens/0731479c-5e54-49d6-a10c-27cc0a97ce33) | Same layout, different chip selected, shows an empty chart still has the same module height. |

### 2.9 Flo (calendar)

| Screen | Link | Layout facts |
|---|---|---|
| Month calendar, day sheet | [9892668b](https://mobbin.com/screens/9892668b-4961-4e87-b4c9-d94baeb4aee2) | Header: X left, Month/Year segmented ~152x34pt centre, "Today" text right. Continuous vertical months. Cell ~50pt wide x 55pt tall; day numbers 17pt; filled 32pt circle for period days, outlined dotted ring for predicted; "TODAY" micro label (~9pt caps) above the date with a grey dot under it; weekday letters ~9pt tiny. Bottom sheet from ~y 395pt, ~26pt top radius: title "Mar 15 · Cycle day 15" ~22pt bold, 13pt grey subtitle, "Symptoms and activities" row (rounded container ~345x~70pt with 2 stat tiles, 2 emoji chips and a 47pt teal "+"), "My daily insights" carousel of ~112x138pt tall cards. A floating pill "Edit period dates" ~144x29pt hovers over the grid. |
| Month calendar, toast | [489f80c4](https://mobbin.com/screens/489f80c4-ff88-45c5-a33e-a55ac4274051) | Teal toast card ~345x~58pt across the grid top; predicted days in teal text, period in pink filled circles. |
| Calendar loading | [73b8db6f](https://mobbin.com/screens/73b8db6f-1226-49d5-9a95-92379a0a4e41) | Toast with a progress line ("Improving cycle predictions"), grid unchanged. |
| Calendar, pick start date | [2d972013](https://mobbin.com/screens/2d972013-af41-4420-acca-8cecd692cc24) | Coloured banner instruction across the top (full-bleed, 2 lines); unselected days are ~24pt grey circle outlines; future days dimmed. Sticky bottom bar "I don't remember" ~56pt. |
| Calendar onboarding | [15ac3a95](https://mobbin.com/screens/15ac3a95-06a7-41a0-ae0c-9dc24464c1cd) | Same grid with a full-width teal pill pinned at the bottom (~345x~50pt). |
| Calendar empty/intro | [52e7c65f](https://mobbin.com/screens/52e7c65f-044a-4504-891a-9e3016191e9a) | Empty state: mini sample calendar card (~345x~230pt) with a tilted "NEXT PERIOD 25" bubble, 24pt bold headline centred, 15pt grey line, one pink pill ~205x47pt. Sample data labelled "NOTE: This is sample data". |

### 2.10 Strava (feed; used for stat rows and week streak)

| Screen | Link | Layout facts |
|---|---|---|
| Home feed card | [106bee68](https://mobbin.com/screens/106bee68-c61f-48f0-b7fd-5b4625874ec0) | Full-bleed white cards separated by ~10pt grey bands (not inset). Row: 42pt avatar, 14pt name, 12pt grey meta. Title ~21pt bold. 3-column stat row: 12pt grey label over 19pt bold value. Media full-bleed (~393x236pt). Kudos line, 3-up action bar ~52pt. |
| Home with weekly streak | [0d794955](https://mobbin.com/screens/0d794955-16a5-450d-b10e-dc6df2e9c8bb) | "Your streak" module: 1 flame + "1 Weeks" big at left, week strip M-S with ~29pt circles (done = filled dark with icon, today = outlined), pager dots, Share pill ~70x30pt. Module ~140pt tall, sits above the feed. |
| Home, instant workout carousel | [ba77b254](https://mobbin.com/screens/ba77b254-e2a1-4de3-88f0-2667b828fede) | Horizontal card (~345x~110pt) with title, 2-line text, chevron and pager dots; goal progress bar of 4 segments with "4/4" in the next card. |
| Home, feedback card | [f9216faa](https://mobbin.com/screens/f9216faa-47b8-4b6c-9e69-6464b21c3d74) | Full-bleed photo band (~160pt) + centred prompt row + small orange pill ~120x35pt. |
| Home, map activity | [07591af6](https://mobbin.com/screens/07591af6-e60a-4967-b462-da7c5516d2f7), [61218d49](https://mobbin.com/screens/61218d49-29c9-4966-a6ae-06940a329611) | Same card with a map as the media; stat row alternates between 3 and 4 columns. |

## 3. Patterns

### 3.1 Consensus (with numbers)

1. **Side margin 16 to 24pt, never less.** Finance and utility apps use 16pt (Revolut 16.5, Monzo 16, Spotify 16, Todoist ~24 inside cards). Photo and editorial apps use 24pt (Airbnb 24, Headspace 24 left, Duolingo 24). Oura floats at ~18pt. Inside a card, padding is 8 to 16pt (Airbnb card 8pt around an image, Monzo 15pt, Headspace 12pt).
2. **Section gaps 32 to 46pt; heading-to-content 12 to 20pt; gap inside a group 8 to 16pt.** Measured: Airbnb 37pt between trip groups and ~43pt between carousels; Monzo 34 to 35pt between settings groups; Oura ~46pt between Vitals sections; Spotify ~50pt between shelves; Revolut grouped cards 16.5pt (cards are the group, so the gap can shrink); Headspace card to card 22pt; Todoist and Revolut card to card 10 to 12pt. Rule: the bigger the objects, the bigger the gap.
3. **One dominant module takes 40 to 60% of the first viewport.** Oura hero block 41% (59% with chips); Revolut header + balance + actions ~60%; Airbnb detail hero photo 41% (350pt) with title right after it; Headspace shows 3 equal cards at 61%, which only works because a timeline rail ranks them. Nobody opens with more than 4 distinct modules.
4. **Type uses 4 to 5 sizes per screen.** Typical ladder in pt: 32 to 34 (screen title) / 22 to 26 (card or section title) / 17 (row, body) / 14 to 15 (meta) / 12 to 13 (caps label, legal). Hero numerals jump to 40 to 52 (Oura 52, Revolut 40). Hierarchy comes from weight and grey value, not many sizes.
5. **Title style follows the screen role.** Tab roots and settings use a large left title 32 to 34pt (Airbnb Trips/Account, Revolut Account, Todoist Inbox 31). Task and schedule views and settings sub-pages use inline centred 17pt (Todoist Today/Upcoming, Monzo Settings, Spotify). Oura and Duolingo use no title, only a brand row or stats bar. Headspace uses a small greeting + 24pt statement. Header height stays about 44 to 56pt plus status bar; the back control is a 40 to 43pt circular chip (Airbnb, Monzo) or a bare arrow (Revolut).
6. **Settings rows 54 to 56pt, one-line; two-line rows 60 to 72pt (92pt when an action sits on the right).** Airbnb 56, Revolut 56, Monzo 54, Spotify ~60 (two-line), Revolut two-line ~72, Airbnb personal-info 92. Icons 18 to 31pt (accent-coloured glyph, or a 31pt chip) with the label starting at 72 to 79pt from the left edge. 8 to 10 rows fit one viewport.
7. **Grouping idiom splits two ways.** (a) Inset grouped cards, 16pt margin, 16 to 22pt radius, 16 to 35pt between cards, inset hairlines or no dividers (Revolut, Monzo). (b) Plain rows on the page with at most one hairline between groups and a thick band for major sections (Airbnb, Spotify). Both avoid per-row borders. Destructive actions (Log out, Close account) always get their own card or row, last.
8. **Card radius 16 to 24pt; images inside cards 10 to 16pt.** Airbnb cards ~20 to 24, Monzo 18 to 24, Revolut ~18, Headspace 18, Oura ~24; thumbnails 8 to 12 inside, photo carousels 21pt. Tiles of text-only content (Spotify tiles) go down to 6pt; they read as list items, not cards.
9. **Photo cards: near-square (1:1 to 1.05:1) in carousels at 146 to 168pt wide with 2 lines of caption; ~1.6:1 for single full-width cards; ~1.12:1 for the detail hero.** Carousels show 2.2 to 2.5 cards with a 12 to 18pt gap and a 10 to 24pt peek of the next card. Two carousels fit per viewport. Caption: 14 to 16pt title, 14pt grey meta under the image (not over it).
10. **Primary buttons: 47 to 50pt tall, full width (345 to 360pt) or in a sticky bar; pill or ~12pt radius.** Sticky bars: Airbnb 86pt of content (+34pt safe) with the price/summary left and a 144x49pt pill right; Revolut and Headspace pin a full-width 47pt pill ~24 to 29pt above the bottom, with 12pt fine print below. Secondary actions are an outlined or dark button of the same height placed under the primary, 12 to 16pt gap. Small pills (Change, Open, Get app) are 29 to 37pt tall.
11. **Tab bar: 3 to 5 tabs, 11 to 12pt labels, ~49pt plus safe area (83 to 92pt).** Docked (Airbnb, Headspace, Spotify) or floating pill ~62pt tall (Oura, Todoist, Monzo) with a capsule on the active tab. Duolingo's 6 icon-only tabs are the outlier. Nothing else competes in the bottom 90pt except a mini player or a FAB.
12. **Schedules put the strip on top and the grouped list below; strip is 13% of the viewport.** Todoist: 7-col strip ~110pt, selected day a 29pt filled circle, dot under days with items, then date-grouped headers (16pt bold) and 62 to 66pt rows. Flo: continuous vertical months, 50x55pt cells, 32pt filled circles, a bottom sheet (~26pt radius) for the selected day. Airbnb Trips: 29pt day chips on a left rail with 60pt cards. Strava: a 7-circle week strip of 29pt.
13. **Status is visualised with one simple device at card scale.** Arc gauge 310pt wide (Oura), rail with 20pt dots (Headspace), 47pt numbered circles (Headspace), 10pt segmented bar (Spotify storage), 4-segment step bar flush above the CTA (Airbnb checkout), 3 to 5 segment scales (Oura Vitals), 72pt path nodes (Duolingo). None uses a pie chart or a donut.
14. **Empty and locked states keep the module size.** Oura "About 14 days of data needed" in the same card; Revolut a single 56pt "No transactions yet" row, no illustration; Duolingo ghost badges and dashed circles; Headspace a faded chart with a tooltip card; Airbnb Trips (only tab-level empty) gets a skeleton illustration + 17pt headline + one 46pt button. Section-level empties are one row, tab-level empties are one illustration and one button.
15. **Checkout order is fixed.** Summary card (border or shadow, thumb ~100pt) -> payment row (chevron, ~56pt) -> coupon row (same style) -> price details (17pt rows, bold total) -> 12pt legal -> one 47 to 50pt CTA. Section titles 18pt bold, hairline between sections, 24pt vertical padding. A step bar sits flush on the footer; the footer is sticky once the form is longer than one viewport.
16. **Phone login uses one input row and one button.** Revolut: ~34pt title, 13pt subtitle, country chip 79x47pt + field on one row, disabled-then-white primary pill; OTP as 6 boxes 37x47pt grouped 3+3 (Revolut) or a single bordered field with 6 dashes (Airbnb). Keyboard stays up and the button sits just above it. Social/alt methods are 50pt outlined buttons on a 63pt pitch.

### 3.2 Distinctive moves worth stealing

- **A. Oura: state-driven hero.** One centred statement (number ~52pt, one-line headline ~44pt, a 17pt sentence, one 120x41pt pill) over a full-bleed image that changes with the state; a horizontally scrolling chip row (71pt circles, 4.5 visible) above; secondary content collapsed into a peek card below.
- **B. Headspace: status rail.** Cards 329x151pt on a rail with 20pt dots (done / current / upcoming) and a 142x95pt image on the right. The rail makes 3 equal cards readable as a sequence.
- **C. Headspace paywall timeline.** A 3-step vertical timeline (Today / In 12 days / In 14 days) explains what happens and when, with the CTA pinned underneath. A fit for renewal.
- **D. Airbnb Trips progressive card size.** The next item is a large card (image ~1.6:1); the rest are 80pt rows with a 64pt thumb, grouped under 19pt place headers, 37pt between groups.
- **E. Airbnb detail skeleton.** 350pt hero (41%), 22pt sheet overlap, centred 26pt title, 3-stat strip (70pt), host row, sticky 86pt bar with price left and a 144x49pt pill right.
- **F. Revolut action circles.** 4 circles (48pt, 90pt pitch, 14pt labels) directly under the hero value; a disabled action stays in place at lower opacity.
- **G. Monzo stacked deck.** Multiple accounts as overlapping cards with ~35pt peeks; a back card taps to bring it forward. A strong fit for multiple active packages.
- **H. Todoist collapsible week strip + date-grouped list**, and **Flo's bottom sheet for a selected day** (title 22pt, one compact summary row, carousel).
- **I. Monzo settings.** 31pt coloured icon chips, 54pt rows, inset hairlines starting at the label, 34pt between groups, "Log out" last in its own card.
- **J. Spotify plan cards.** One card per plan, accent-coloured name, "Current" tab chip on the card, the CTA only on the actionable plan.

## 4. Map to Catera

Numbers are targets derived from the patterns above (390 to 393pt-wide frame), to be tuned in the design pass.

### Beranda (today's plate, next days, renewal card)
- Borrow A + B + F + C.
- Hero "Hari ini": the plate photo ~350 to 400pt tall full-bleed or one inset card (~1.12:1 to 1.3:1, 24pt radius) = 41 to 50% of the viewport, then 1 headline (22 to 24pt), 1 line of meta (14 to 15pt), and one 47 to 50pt primary action (or a row of 3 to 4 action circles at 48pt for Pindah tanggal, Pilih menu, Lapor, Perpanjang).
- "Hari-hari berikut": cards 329x~110 to 150pt on a status rail (20pt dots: done / today / upcoming), 22pt gap, thumbnail 1.5:1 at right. 2 to 3 visible.
- Renewal card: one row card (56 to 80pt) with the portion count and a progress bar (10pt, segmented per portion). When near expiry, show the Headspace-style 3-step timeline (Sisa porsi / Hari terakhir / Perpanjang) and a pinned 47pt CTA.
- Margins 16 to 20pt, section gap 32 to 40pt, heading to content 12 to 16pt. No more than 4 modules above the fold.

### Jadwal (month calendar of deliveries)
- Borrow H (Todoist/Flo). Prefer a week strip (7 columns, 29pt selected circle, a dot under days with a delivery, collapsible to a month grid, 50x55pt cells, 32pt filled circles) over a full month on top. Below, a date-grouped list (16pt bold date headers with a hairline; rows 62 to 80pt, 56 to 64pt thumbnail). Tapping a date opens a bottom sheet (26pt radius, 22pt title, 3 actions: pindah, menu, lapor) rather than a new page. Month label 16pt with chevron; strip about 13% of the viewport for the week view, 35 to 40% for the month grid.

### Jelajah list (area, search, food-photo cards)
- Borrow Airbnb Explore + Headspace Explore. Search pill ~345x47 to 58pt first; area selector as a 36pt chip row (10pt gaps). Then 2 stacked carousels (header 19pt with chevron, cards 160 to 168pt wide at ~1.05:1, 21pt radius, 12pt gaps, 2.3 visible, caption 14 to 15pt title + 14pt grey meta under the photo, overlay chip 12pt on photo, ~43pt between carousels). Results list uses full-width cards (344pt) with a ~1.6:1 image; filters as a 36pt chip row. A "Lanjutkan" resume card (Airbnb Continue searching, ~345x100pt) before the carousels.

### Package detail
- Borrow E + Spotify + Headspace plan intro. Hero 350pt (41%) full-bleed with 40pt circular back/share/heart chips and a photo counter, 22pt sheet overlap, centred or left 26pt title, 16pt grey subtitle, a 3-stat strip (70pt: porsi, hari, harga per porsi), caterer row (82pt, 40pt avatar). Sections with 22pt titles, 24pt margins, hairlines. Sample menu as 56 to 64pt thumbnail rows. Sticky bar: ~86pt content + safe area, price left (17pt bold), "Pilih paket" pill 144x49pt right. Tier choice (e.g. 6/12/24 portions) as color-coded plan cards (Spotify): one per tier, CTA only on the selected one.

### Akun (profile, addresses, saved, payments, help, settings)
- Borrow I (Monzo) or Revolut grouped cards. Large 32 to 34pt title or a profile row (40pt avatar + name + "Detail akun") in the first card. Groups: (Alamat, Tersimpan, Pembayaran) / (Bantuan, Pengaturan) / (Keluar), 54 to 56pt rows, 18 to 31pt icon, 17pt label, chevron, 16pt margins, 16 to 20pt radius, 34pt between groups (16.5pt if in cards without dividers). Destructive and Keluar last in their own card. Value rows (phone, email) at 72 to 92pt with an inline "Ubah" action. Version footer 13 to 14pt grey.

### Checkout and payment
- Borrow Airbnb checkout + Revolut plan CTA. Order: package summary card (thumb 100pt, title 17pt, 3 fact rows with hairlines, "Ubah" pills 29pt) -> delivery start/address row (56pt, chevron) -> payment method row (56pt) -> voucher row -> price details (17pt rows, bold total) -> 12pt legal -> one 47 to 50pt CTA, pinned if the page scrolls. A 4-segment step bar flush above the CTA for multi-step. Payment processing = one centred illustration + 20pt label.

### Login (phone OTP)
- Borrow Revolut + Airbnb. Back arrow; 32 to 34pt title; 13 to 14pt subtitle; row of country chip (79x47pt, +62) and a phone field; one 47 to 50pt button that is grey until valid; keypad stays up; OTP as 6 boxes 37x47pt (3+3) with "Kirim ulang" and "Pilih metode lain" links as 13pt blue text. Alternative methods only if they exist (50pt outlined buttons, 63pt pitch).

### Cross-cutting
- Tab bar: keep 4 tabs (Beranda, Jadwal, Jelajah, Akun), 11 to 12pt labels, ~49pt + safe area. Consider the floating pill (62pt) only if the hero is full-bleed (Oura-style).
- Pick one grouping idiom per screen type: inset grouped cards for Akun/settings and checkout; plain page with hairlines for lists of photos.
- Tap targets: 44pt minimum for primary and row controls; chips and "Ubah" pills 29 to 37pt only when a larger row also opens the same action.

## 5. Downloaded hi-res images (15)

Directory: `D:\Project\Catera\catera\output\mobbin\2026-10-22\cross\` (webp, 1179x2676, 3x)

| File | Source screen |
|---|---|
| `oura-today-goal.webp` | [b4bc9e73](https://mobbin.com/screens/b4bc9e73-f29d-495e-8ff1-9cb625020ac3) |
| `oura-vitals-grid.webp` | [0501d553](https://mobbin.com/screens/0501d553-3c49-4752-a4bc-51fcc5bd068b) |
| `airbnb-trips-card.webp` | [79f36e2f](https://mobbin.com/screens/79f36e2f-ac49-4169-b473-abb7b0dd13bd) |
| `airbnb-trips-compact.webp` | [a12e7c67](https://mobbin.com/screens/a12e7c67-bf56-4ba3-af0f-102bfb2797e0) |
| `airbnb-explore-homes.webp` | [2df6111d](https://mobbin.com/screens/2df6111d-0888-47ab-8d35-6a2f20d66eb2) |
| `airbnb-detail-reserve.webp` | [53d912ff](https://mobbin.com/screens/53d912ff-a3dc-472b-b525-379c327a89e8) |
| `airbnb-account-settings.webp` | [936fbfe8](https://mobbin.com/screens/936fbfe8-4c12-4c69-95f0-6c56b7dede64) |
| `airbnb-checkout-review.webp` | [7860fa67](https://mobbin.com/screens/7860fa67-72b3-42d0-8092-c0ac9fe7dcf7) |
| `headspace-today-timeline.webp` | [1cba404f](https://mobbin.com/screens/1cba404f-413c-4a8b-be36-d791e9ca4fed) |
| `headspace-trial-paywall.webp` | [a9bf58c3](https://mobbin.com/screens/a9bf58c3-250a-4565-9808-c4722933ea54) |
| `duolingo-home-path.webp` | [bfed6f7e](https://mobbin.com/screens/bfed6f7e-2b16-4e4a-a60d-ec4c7011d5b4) |
| `revolut-account-grouped.webp` | [2562dc46](https://mobbin.com/screens/2562dc46-5414-4d29-9d1c-0792b6b5a129) |
| `monzo-settings-grouped.webp` | [6b891ec1](https://mobbin.com/screens/6b891ec1-ab93-464c-b98d-0fef1c262968) |
| `todoist-upcoming.webp` | [4159b14b](https://mobbin.com/screens/4159b14b-0ff2-4130-8844-616b858a7e78) |
| `flo-calendar-daysheet.webp` | [9892668b](https://mobbin.com/screens/9892668b-4961-4e87-b4c9-d94baeb4aee2) |

Image URLs expire after 30 days; the files above are the durable copies. Mobbin screens are third-party app UI kept here as private research reference, not for redistribution.

---

**Your Mobbin AI usage is high this month**

Usage is unlimited during beta. If your usage stays at this level, you may need to purchase more credits once limits take effect. [View usage and plan options](https://mobbin.com/settings/billing-and-usage)
