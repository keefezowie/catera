# Work-app layout research for Catera Dapur (Mobbin, iOS), 2026-10-24

Scope: LAYOUT only (sizing, spacing, density, hierarchy, module placement, what lives on which screen). No colour, brand or copy. Dapur dials: ENERGY 1 / RHYTHM 1 / MOTION 1, so every pattern below is static and dense. Rule set used for judging: `design-taste-frontend/references/app-screens.md` (cited as "AS §n"). Template for method: [2026-10-22-layout-mobbin-crossindustry.md](2026-10-22-layout-mobbin-crossindustry.md).

## 1. Method and coverage

- Tool: Mobbin MCP `search_screens`, `output_destination: doc`, 31 calls (limit 2-6). Every screen cited was viewed as an image. **Android is not available**: the MCP only accepts `ios` and `web`, so the "prefer Android" instruction could not be met. iOS pt equals Android dp numerically, but iOS chrome (tab bars, safe areas, sheets) is not Android.
- Frames: previews are 299px wide. Masters I downloaded show three frame widths: **393pt** (1179px, most apps), **375pt** (1125px: Stripe, Things, Google Calendar) and **402pt** (1206px: DoorDash Dasher). Preview px x 1.31 = pt on 393 frames, x 1.254 on 375, x 1.344 on 402. All Stripe/Things/GCal figures below already use 1.254. Frames of the apps I did not download (Slack, Notion, Revolut, Monzo, Deel, others) were assumed 393 (+-3% more error).
- Accuracy: by eye on previews, about +-8%. Figures tagged **(px)** were measured on the 3x master by detecting 1px row hairlines (script, +-1pt): Shopify settings rows 47.3, Shopify customer key-value 47.3, Jobber key-value 59.0, Shopify inventory rows 62.3, Dasher list rows 56.7, Todoist two-line rows 63.3 and Asana table rows 43.3. Type sizes are inferred from glyph height, +-2pt.
- Limits: Mobbin frames are single static states, so "totals stay put while scrolling" can only be confirmed where a capture was taken scrolled (Stripe, below) or inferred from layout. "Above the fold" counts are of the captured state on an 852pt viewport, not typical content. Several apps are partial (Monzo Business is one sheet, Stripe only has a web-view and the mobile Dashboard).
- **Present (screens viewed):** Linear 10, Todoist 5 (+7 from the earlier doc), Things 9, Stripe Dashboard 17, Shopify admin 28, Notion 6, Asana 5, Slack 4, Google Calendar 5, Revolut 5 and Revolut Business 7, Wise 6, Jobber 14, DoorDash Dasher 7, Grab Driver 1 (+ Grab stops), Mercury 3, Shopee Seller Centre/orders 7, Monzo Business 1. Bonus ops/finance apps that were returned: Deel, Remote, Fiverr, Upwork, Turo, Instacart Business, Expensify, Matter, GitHub, Quo, Open, Future Pro, ClickUp, Outlook, Gusto, Cash App, Squarespace, Depop, Faire.
- **Missing from Mobbin (search returned other apps):** QuickBooks, Xero, Housecall Pro, ServiceTitan, Deputy, When I Work, Homebase, Google Tasks, GoBiz, Tokopedia Seller (Shopee Seller Centre is the only Indonesian-market merchant app found). Monzo Business: one account-switcher sheet only. Jobber, DoorDash Dasher and Grab Driver are the stand-ins for field-service and shift ops.
- Masters: 25 files in `D:\Project\Catera\catera\output\mobbin\2026-10-24\work\` (section 8). Other screens are cited by link only.

## 2. Measurements by topic

### 2.1 Work "home / today" screens

| App / screen | Dominant module | Summary counts | Above the fold (852pt) | Header |
|---|---|---|---|---|
| Stripe Home [e345975a](https://mobbin.com/screens/e345975a-5113-4ffd-8b71-1abc1481379e) | Report blocks: 229pt each, chart 128pt, full-bleed, 1px rule between (no cards) | One bordered strip 85pt, 3 cells (Gross volume / Payments / Customers), label 14 over value 19, swipes between Today and Yesterday (next day peeks 20pt) | Strip + 1.4 report blocks | Inline centred 18pt + 33pt store avatar; no large title. Period pills (7, 29pt tall, spread full width) sit under the bar and **stay while the reports scroll** ([015d8f95](https://mobbin.com/screens/015d8f95-d080-4e50-ac46-6f37301c0ccb) is captured scrolled) |
| Shopify Home [635cf029](https://mobbin.com/screens/635cf029-446c-4cdb-a3aa-bb1278e8291e) | The one job: tile "1 Order to fulfill", 177x52pt | 4 bare columns (label 13 / value 17), scroll sideways, 4th clipped; chips "Last 30 days", "Live View" 31pt | 4 KPIs + 1 action tile, then end state "That's it for now" (check icon + 2 lines) | Black band, store tile 29pt + name 16; sheet radius 24 |
| Jobber Home [e4979820](https://mobbin.com/screens/e4979820-6f4e-4695-a160-4c243602d36c) | Map, about 45% of the screen | 2 lines 16 bold ("1 visit worth Rp0 / 0 visits complete") + "View all" pill 37pt | 1 visit card (329x124pt, 5pt status bar, next card peeks 16pt) starting at 60% down | Date 14 + greeting 26pt (a hero header, AS §13) |
| Mercury Home [7a717e40](https://mobbin.com/screens/7a717e40-6b9a-4dbc-a81c-b7da99d784cb) | Balance 26pt + 147pt full-bleed chart | Inline "30D v / + $0.00 / - $2.55" 14pt, month in/out in 2 columns | Balance, chart, month row, 2 list rows (60pt) | Workspace switcher 16pt + avatar; no title |
| Fiverr Home [fc807bd4](https://mobbin.com/screens/fc807bd4-3a05-44a1-b5dd-62fcdb6efcfd) | One card, 2x3 key-value grid, 155pt (label 13 / value 17, 59pt pitch) | 6 | Card + To-Dos + My gigs (kv rows 45pt) | Name 18 + avatar, 16pt margin |
| Deel Home [cf5f0f21](https://mobbin.com/screens/cf5f0f21-c5e6-443a-93d0-ffb021425ff7) | "Upcoming actions" card 245pt | 2 rows of 89pt, each with a fixed trailing button (84x45pt); when nothing is due the button is disabled and the frame stays | 1.5 cards | Greeting 18pt + switcher chip 37pt |
| Shopee My Shop [61a30fb5](https://mobbin.com/screens/61a30fb5-e1b0-424d-a460-8d3f4f1df3b7) | Order-status card 120pt | 4 count tiles 80x52pt (number 18, label 13) | Shop card 79pt, status card, 3x2 tool grid 150pt (37pt icons, 76pt pitch) | 10pt margin and card gap |
| Things Today [e90634cd](https://mobbin.com/screens/e90634cd-7e0b-4852-9fc6-f57a017276b6) | The list: 8 rows at 44pt | Calendar box 100pt (5 lines, 19pt pitch) | 8 rows + 1 section | Large title 28pt left with star icon; no filter row |
| Todoist Today [7ff218cf](https://mobbin.com/screens/7ff218cf-1ddd-47ee-9123-72535e5f9283) | "Overdue 4" group; "Reschedule" action sits at its right edge | Count beside the group name | 4 cards (54-83pt) | Inline centred 17pt |

- **Large title vs compact:** left large title in 7 of 17 home/list screens (Linear 24, Things 28, Asana 25, Notion 29, Shopify 21, Revolut 31, Instacart 26); inline or centred 17-18pt in 6 (Stripe, DoorDash, Shopee, Todoist Today, Jobber detail 22, Remote); a switcher or greeting instead of a title in 4 (Mercury, Slack, Deel, Jobber). Median title 25pt, never above 31.
- Summary counts are always bare type in one container or one strip (Stripe, Shopify, Mercury, Fiverr) or tappable tiles only where they are filters (Shopee). No sparkline sits on any count.

### 2.2 Dense lists

| App | Row type and height | Separators | Section header, gaps | Per screen |
|---|---|---|---|---|
| Linear [da5b1f34](https://mobbin.com/screens/da5b1f34-e51d-45c9-90aa-ba08e5684afa) | Single line 48; 18pt status icon, 21pt trailing avatar; 2-line with chip meta about 65 ([3810be1f](https://mobbin.com/screens/3810be1f-d4fa-4938-ae09-d7a2651c0274)) | None on the dense list, hairlines on the chip-meta list | Grey 13 + "+" at right; header to first row 39 (centres); section to section 50 | 8 rows; 10 rows + 3 headers ([30ebc468](https://mobbin.com/screens/30ebc468-06c8-46dd-9503-e197e89a1e5c)) |
| Slack [055ab22c](https://mobbin.com/screens/055ab22c-46dc-4612-bf86-ef117e57da0e) | 44; 17pt name, 21pt icon, unread badge 24x18 | Hairline above each section | 14 bold + collapse chevron; 58 centre to centre | 10 rows + 4 shortcut tiles (97x89) |
| Asana My tasks [9b4aa02b](https://mobbin.com/screens/9b4aa02b-ed37-42f5-bfee-c529f3c9ee44) | Task 47, with project line 62; due chip 79x21 | Hairline from text column | **Header row is 56pt**, same as a row: caret, name, count, kebab; empty sections stay as collapsed rows | 5 tasks + 3 collapsed sections |
| Asana project table [04f565e9](https://mobbin.com/screens/04f565e9-e2d7-4dc0-bbda-35d6d8fb8200) | **43.3 (px)**; column header 29; section rows about 40 | Hairlines; first column fixed, other columns scroll, priority chips 79x24 | Section rows with caret + kebab | 7 rows + 4 sections in 400pt |
| Things Today | 44 with or without a project subline (12pt grey) | One hairline under each section header | 17 bold; **76-80 between sections** (the airiest) | 8 rows |
| Todoist Upcoming [4159b14b](https://mobbin.com/screens/4159b14b-0ff2-4130-8844-616b858a7e78) | **63.3 (px)** (title + meta line); checkbox 22 | Hairline from text column | Date header block 83 hairline to hairline; week strip 111 | 5 rows + Overdue + 2 date headers |
| Stripe Payments [d8b72d98](https://mobbin.com/screens/d8b72d98-48cd-4829-ad08-309ae833dfe4) | 3 lines 90, 4 lines 127; 33pt status tile; **amount and status live in the title** ("$96.00 succeeded"), no value column | Hairline from the text column (x 68) | Underline tabs 45pt tall | **4.5 rows** (loosest of the lot) |
| Shopify Orders [ae89a0e6](https://mobbin.com/screens/ae89a0e6-84c6-4c57-820c-86066c76949a) | 4 lines 109 (id + amount, customer / items / time, 2 pills, "Shipping"); draft orders 70 | Hairline full width | Date band 25pt grey full-bleed; search 39 + sort 39 + filter 39 (count badge); chips 31 | 2 orders (3 drafts) |
| Revolut Business Invoices [f8ac896a](https://mobbin.com/screens/f8ac896a-9fea-4a20-a7bd-55f3c411a6e5) | 72; 42pt file icon; status is **text in line 2** ("Due in 2 days · INV-1"), amount right 16 | None; rows sit in grouped cards (radius 21) | Group header 18; 45 between groups; actions row 39pt (New invoice filled, Recurring, kebab) | 5 rows in 3 groups |
| Revolut [b5fa1102](https://mobbin.com/screens/b5fa1102-5e25-4bbc-b482-0d1c6aa6c692) | 75-80 in a card; 42pt logo | None | **Day total at the right of the group header** (14 grey); a failed amount is struck through | 3 groups |
| Wise [62ecd9e8](https://mobbin.com/screens/62ecd9e8-86a2-4d2b-8d67-678e1693356c) | 70-80; amount over a grey secondary amount, both right-aligned | Hairline under date header | 14 grey date header; swipe reveals a 73pt action panel | 3 rows |
| Grab Driver planner [d44d707e](https://mobbin.com/screens/d44d707e-5028-49aa-827e-8462090b6a32) | 100 (3 lines: name, bold time, zone with dot); value 16 grey at right of the time line | Hairline from x 24 | Week strip about 80 above | 5.5 rows |
| Mercury / Instacart / Revolut Biz team rows | 60 / 62 / 70; avatar 29-38 | Hairline or card | Mercury groups by role ("Admin") | 3-5 rows |
| Quo weekly schedule [e4defe8b](https://mobbin.com/screens/e4defe8b-53b2-481b-b3c9-f20b562f9e4a) | **55 x 7 days**: day left, value right ("Unavailable"), chevron | Hairline | Caption 13 "Weekly schedule" | 7 rows + toggle + timezone |

- **Row pitch (single line):** 44 Slack, 44-46 Things, 47 Asana/Shopify settings/Shopify filter sheet, 48 Linear, 55 Dasher/Quo. **Median 47** (n=9). AS §7.1 says 45.
- **Two lines:** 59 Jobber, 60 Mercury, 62 Instacart/Asana, 63 Todoist, 70 Shopify drafts/Revolut Biz team, 72 Revolut Biz invoices. **Median 63.** Three lines or media: 90-109 (Stripe, Grab, Shopify orders). AS §7.1 median 72.
- **Separators:** hairlines starting at the text column in 7 apps (Todoist, Stripe, Asana, Grab, Shopify, Wise, Things under headers); no separators and rows in grouped cards in 3 (Revolut x2, Linear dense); no zebra, except Shopify's analytics breakdown (against AS §7.3).
- Inline status: 1 mark per row in Revolut Biz (text), Wise, Todoist (date chip); 3-4 marks in Shopify orders (two pills plus a text tag), which fails AS §7.6 "one status mark per row".

### 2.3 Money

| App | Total / balance | Rows and totals | Period switching |
|---|---|---|---|
| Mercury [7a717e40](https://mobbin.com/screens/7a717e40-6b9a-4dbc-a81c-b7da99d784cb) | 26pt, cents 14pt raised; label 16 (ratio 1.6) | Month in/out as 2 columns 14 over 16 | "30D v" dropdown inline in the sub-line |
| DoorDash earnings [1371715f](https://mobbin.com/screens/1371715f-7794-424b-8b4d-00bc11a8b620) | Week total 27pt top-left, expandable | **Key-value rows 28pt** (11pt-grey label, value right); groups split by hairlines; "Dashes" list rows **56.7 (px)** with bold 17 amount + chevron | Period in the nav title ("Nov 17-24") |
| Stripe Home | Values 19 blue (now) next to 19 grey (previous period), same size, date range 12 under each | Delta right of the block title: green good, **orange bad**, grey zero ("+0.0%"); window named by dates | 7 pills, 29pt tall, pinned |
| Wise [44daafcf](https://mobbin.com/screens/44daafcf-9304-46ce-8110-9323e4f5252b) | Balance 38-40pt on the account page, 28-30 on home | 80pt rows; sign with a space ("- 6.48 USD"); stacked second amount in grey | Segmented 38pt (Transactions / Options) |
| Shopify Analytics [42027cab](https://mobbin.com/screens/42027cab-3c3d-4a7c-9786-d79229146001) | Block title 14 + value 18 + delta | Breakdown rows 41pt: label left, value right bold "SGD 199.92", grey dash column right; total row last | Date chip 31pt |
| Shopee order [e490859e](https://mobbin.com/screens/e490859e-c844-4384-8452-99a8f9b06f09) | Total 19 bold bottom-right | **Price rows 26pt**: label 14 grey, "-Rp18.000", struck-through old price "Rp33.500", "Rp5.500" | none |
| Cash App [380b2a2b](https://mobbin.com/screens/380b2a2b-e241-4dae-8783-5e11691f4209) | 47pt light (the outlier) | Key-stats rows 56-76 with a 13pt sub-caption | Month chips 31pt + a **floating 52pt pill** switching metric ($1 / $ / time) |
| Jobber Business health [5097dfd2](https://mobbin.com/screens/5097dfd2-931a-4947-9e84-1e629562b152) | 18 bold values | **Rows 59.0 (px)**: label 16 left, value right, delta pill 21pt trailing; section = title 16 + period sub-line 14 | Period as sub-line text |
| Gusto [fe28fe32](https://mobbin.com/screens/fe28fe32-1331-4dad-8873-137abcbbdb4c) | Row expands in place | Stacked bar 13pt tall with a 3-row legend at 28pt, outlined "Review paycheck" 39pt | Month band 39pt |
| Turo [304ac9ba](https://mobbin.com/screens/304ac9ba-26c6-4263-ad55-a9767a209de5) | Legend-style rows 34pt ("$0 Trip earnings") | Link rows 60 | **Bottom split bar 40pt** pinned above the tab bar: "All vehicles v / 2025 v" |
| Vivid [9caf70c2](https://mobbin.com/screens/9caf70c2-a892-4123-ba1f-2ed5304b8a35) | 22 | List rows 83 | **Two stacked segmented rows** (37 + 29pt): the failure case (AS §12) |

- **Total size:** 17-19 on dashboards (Shopify, Stripe, Jobber, Fiverr), 26-27 as a lead (Mercury, Dasher), 38-47 only in wallets (Wise, Cash App). Median 26. AS §5 asks 30-36 for the answer figure and "nothing at 48".
- **Right edge:** every value in every list sits on one right edge; no app left-aligns a number. Tabular figures cannot be judged by eye; Stripe is the one that hides its amount inside a title and therefore cannot compare rows.
- Rupiah in the wild: Shopee "Rp23.999" (dot thousands, no decimals), Jobber "Rp100.2k" (abbreviated), Remote "Rp 16,000,000.00" (en-US separators). Only Shopee matches Indonesian formatting.

### 2.4 Detail of a person or record

| App | Header block | Key-value | Actions | Rest |
|---|---|---|---|---|
| Shopify customer [eef0daad](https://mobbin.com/screens/eef0daad-490b-4e23-862c-2f97c11f1b6a) | Name 22, sub-line 13, 2 tag chips 18pt: about 115pt | "Insights": 3 rows at **47.3 (px)**, hairlines | **Email / Phone as two outlined 39pt buttons side by side**, 177 wide, 8 gap | Sections split by 10pt grey bands; address 22 pitch; rows with chevron 47; order history 98; timeline; comment input pinned |
| Jobber client [7c66f8f1](https://mobbin.com/screens/7c66f8f1-8ea8-4582-98bf-a0f88dcccf56) | Status tag 14, name 24, "Client balance" row 16, **full-width primary "+ Create" 47pt** | Section titles 16 bold with trailing arrow or "+" | Create sits under the name; underline tabs 47pt (Client / Work / Notes) | Header block 157pt before tabs; Work tab = chips 34pt (All / Requests / Quotes / Jobs) |
| Stripe customer [8113ccdd](https://mobbin.com/screens/8113ccdd-0eac-4bb5-9731-55cf00a433a1) | Sheet title 16 + X | **Tinted key-value well**: rows 45, 2-line value 56, label grey with 14pt leading icon, value bold right | **"+ Create payment" is the last row of its own list**; footer "Share" text action | Sections 18 bold; list rows 70 |
| Linear issue [ed788cb0](https://mobbin.com/screens/ed788cb0-3715-4383-9cbd-783d2a55bdf8) | Id 13, title 22 (28 line pitch) | **Property chips (26pt) in one tinted container**, 2 rows at 33 pitch, about 72 | Pinned composer 47 + 2 round buttons 47; inbox toolbar "Unread / Snooze / Delete" as a 52pt pill ([c25eeb30](https://mobbin.com/screens/c25eeb30-eb9c-421f-87b0-a0f14dfa259d)) | Description 17 on 27; sub-issues card; activity on a rail |
| Shopify order [991b6801](https://mobbin.com/screens/991b6801-791b-4f43-b0e1-ce5e79fddb30) | Inline title 16 + 37pt print and kebab circles | Payment rows about 45, total bold | Per-section status chip 31 + kebab | Line items 100 (52pt thumb, "x 1" 18 bold at right); sections split by 10pt bands |
| Revolut Biz team [f2037916](https://mobbin.com/screens/f2037916-66ac-4617-9aee-1bbde78e9568) | Title 31; Invite (filled, 37) + Settings pills | Role as second line (14 grey) | Search 42; Filters chip 37 | Count header "All · 2" 17 |

### 2.5 Weekly and day schedules (closest to a weekly menu)

| App | Strip / switcher | Row or block | Notes |
|---|---|---|---|
| Google Calendar agenda [9ee1702b](https://mobbin.com/screens/9ee1702b-d324-4d01-b8a0-92951b31dca6) | None; **55pt day gutter** (caps 12, date 23, today a 34pt filled circle) | Blocks from x 64: **1-line 30, 2-line 50, image card 97**; 6 gap; 17 between days | Empty day = one 16pt grey line in the first row ([e528a0cc](https://mobbin.com/screens/e528a0cc-8cbe-44ed-aa7a-4d9fca8a41f8)); week range as 13 caps caption; about 6 days or 10 events per screen |
| Todoist Upcoming | 7-column strip 111pt (13%), 26 selected circle, dot under days with items | 63 rows under 16-bold date headers | Strip collapses by drag |
| Jobber [29dca97e](https://mobbin.com/screens/29dca97e-075f-4b8d-b1d3-fe1164a764d2) | Segmented Day / List / Map 29pt + week strip 62 | Time grid **99pt per hour**, 3-day columns 111 wide; list view = cards | Tinted dismissible banner 39pt above the list; hour grid is too tall to borrow |
| DoorDash Schedule [8d69e6a0](https://mobbin.com/screens/8d69e6a0-4bd7-4d7c-a8ec-80ceab158909) | Strip 72 (label 14, number 17), selected = 37pt filled circle; segmented 31 full width | **Rows 55 with a trailing pencil** in a fixed column | Group header 16 bold per region |
| Open [1e339d42](https://mobbin.com/screens/1e339d42-4e73-4aab-b876-429c65c0a3d7) | Strip with a 1px underline on the selected day | **92 with a 72pt time column and 60pt thumb**, title 17, meta 13 | 6.2 rows |
| Future Pro edit [80b08c96](https://mobbin.com/screens/80b08c96-c384-47f2-adeb-f8c244457c16) | Day rail left (letter 13 + date 12; today a dark pill) | Rows 93 empty, 141 filled; "+ Add" pill 180x39; drag handle | Sheet radius 26; confirm is a 47pt check circle top-right |
| Notion grouped by day [7040ffad](https://mobbin.com/screens/7040ffad-073f-42ee-abd1-a0ff41a7dfad) | Group header 29 + repeated column header 31 | Row 45 + "New page" row 40 | **About 150pt per day**: the chrome repeats per group, the anti-pattern |
| Remote add hours [b7076c61](https://mobbin.com/screens/b7076c61-e536-461d-9b7a-fddd0d659fcd) | "Copy to other days": Mo-Su strip, 37pt circles, a dot under days that already have hours | Time fields as a split box 60 tall | Pinned Discard + Save |

## 3. Forms, sheets, settings, team, selection, import, stops

| Topic | Numbers |
|---|---|
| Settings list [7007b793](https://mobbin.com/screens/7007b793-2530-47a7-945f-9c639a1c010d) | Shopify: rows **47.3 (px)**, 21pt icon, 16pt label, chevron; search 37; group titles 14 bold, 10pt grey band between; **13-14 rows per screen**; "Users" and "Roles" are two rows; version 13 grey last. Jobber profile: "Close account" is the last row, muted, 2 lines (68) |
| Settings form [bbc954d0](https://mobbin.com/screens/bbc954d0-dddc-4021-92db-039276744a1f) | Section title 16 bold + 14 grey help; field 55 tall, 20 gap; radio/checkbox rows 43 (2-line 56); sections split by a grey band with 20 above and below |
| Form fields | Shopify create customer [159bb08d](https://mobbin.com/screens/159bb08d-b03a-43a8-af03-235f973cc294): floating label 12 in a 58pt box, radius 13, pitch 75, phone = 92pt code box + field, disabled field filled grey + 12 helper, toggle row 47 (switch 45x26); Cancel / Save as 29pt pills in the sheet bar, **no pinned footer**. Jobber profile [e9ff9e69](https://mobbin.com/screens/e9ff9e69-a3e2-40a5-bae8-d56268140303): box 56, pitch 73, **pinned Save 47pt full width** (16 margins, fade above). Stripe add customer [c53803b3](https://mobbin.com/screens/c53803b3-5cd4-420f-8135-4a2d26bb8ec5): label 16 bold + "Optional" pill 21, field 35, block 79, inline error line 12 above the field, **pinned 45pt primary, disabled until valid, spinner replaces the label while saving** |
| Pinned footers | 45-55pt primary full width (Stripe 45, DoorDash 47, Expensify 47, Instacart 55), 16 side margin; **two-up** footer: Remote Discard (ghost) + Save, 47pt each, 170 wide, 16 gap; Shopee two outlined 43pt equal buttons ([85032f36](https://mobbin.com/screens/85032f36-e855-4052-8b08-6ff253693537)); Notion primary 37 + "Close" text link under it |
| Segmented / chips | Segmented 29 (Jobber), 31 (DoorDash, ClickUp), 37-38 (Wise, Vivid); period pills 29 x7 (Stripe); filter chips 31 (Shopify, Instacart), scrolling, 4th clipped as the scroll hint; underline tabs 45-52 (Stripe 45, Instacart 47, Squarespace 52) |
| Steppers | Shopify create order [529e6922](https://mobbin.com/screens/529e6922-7507-444d-a06a-c32e1a6b375e): field 55 with label 13 and value 16, **[-][+] as two 34pt square buttons inside the field**, 5 gap, minus disabled at 1; line block 159 (title 16 + variant chip 18, price x qty in blue, line total right). Inventory [14fbc79d](https://mobbin.com/screens/14fbc79d-c3c2-4db4-a874-3f22351e8212): row **62.3 (px)**, "-" glyph, value pill 81x31, "+" glyph, 131 wide, the glyphs are about 24pt (too small for Android). Refund shows "1 / 1" (value over max) |
| Team [485a04ca](https://mobbin.com/screens/485a04ca-c7a6-409c-abc2-bcb56c6641ff) | Mercury: grouped under the role name ("Admin" 18), rows 60, avatar 29, "(You)" suffix, search 37 + "Invite" tinted chip 37. Instacart [23adc075](https://mobbin.com/screens/23adc075-da3e-4a09-9b0f-56bacfe76eeb): tabs Members / Groups 47, status chips 31 (Active / Pending / Deactivated), rows 62, **pinned "Invite members" 55pt**. Wise: dismissible banner 189pt tall (too tall) |
| Selection | Shopee add products [fc8b343a](https://mobbin.com/screens/fc8b343a-574b-447f-9ad5-4c2f9355d9ff) (the checked "Add (3)" state is a sibling capture, same frame): bar 59pt: "Select All" left, **"Add (3)" primary right, 238 wide**. MyFitnessPal [49d7ede0](https://mobbin.com/screens/49d7ede0-87e3-4cff-8ab3-77bb56f014a5): 24pt check circle, rows 56, footer "ADD (2)" 47 (count in the label). Yazio [9fd9026d](https://mobbin.com/screens/9fd9026d-9e5d-412d-8d84-5c9c60f3645f): bottom bar 89pt (3 icon + label actions, greyed until a selection). Matter [a7a67be8](https://mobbin.com/screens/a7a67be8-ab72-4e0e-acf7-0312de48b41d): title becomes "1 selected" 26pt, selected row tinted, 4 floating 45pt round actions. GitHub [5edb4b50](https://mobbin.com/screens/5edb4b50-e0ce-4571-ac92-dc6af0f05cea): Cancel / Select all pills 39, rows 92, two-up footer visible and disabled before selecting. Quo [0a226959](https://mobbin.com/screens/0a226959-dbac-4f0e-accd-e256dadb4eb4): contextual text pill 39pt above the tab bar. Revolut [a784a684](https://mobbin.com/screens/a784a684-3265-4beb-871c-b904a58b7e56): chosen items as avatar chips with x at the top, CTA "Continue · 1" 52pt. Depop [029b131a](https://mobbin.com/screens/029b131a-f173-4a5c-adb0-5c6663c46d2b): standing "Bulk actions" pill 42pt enters the mode |
| Import | Expensify [0c5aadb1](https://mobbin.com/screens/0c5aadb1-430b-4968-bece-12b690c4e292): **one card per source column**, 72-92 tall, 16 gap, label 14 grey, sample values 14, trailing green "mapped to v" pill 29; "File contains column headers" toggle row 52; pinned Import 47. Notion [53ff42bf](https://mobbin.com/screens/53ff42bf-c17f-4181-a61c-704d1075622c): label 14 over dropdown 37, 96 pitch, pinned primary 37 + text link. Matter [1ed1af28](https://mobbin.com/screens/1ed1af28-4918-45aa-9fc6-08d9ecbf74cc): 3 numbered step cards (18pt badge, radius 21, 18 gap). Alta [105f1773](https://mobbin.com/screens/105f1773-1bd8-4852-81cc-1922983ead64): per-item review cards ~164 with Retry / Add two-up 39, "Add All" pill top-right 42 |
| Stops (delivery run) | Grab [fb6c4c16](https://mobbin.com/screens/fb6c4c16-7a55-4b99-8804-c37dd45a97d3): stop fields 38 on a **48pt pitch**, 14pt number badge, drag handle + x trailing, ghost "Add a stop" row, helper "You can add 8 more stops", pinned Done 55. Apple Maps [68ddcf36](https://mobbin.com/screens/68ddcf36-328b-44a7-876f-86e0c0113232): 51pt rows, drag handle. DoorDash current dash [5859ffb5](https://mobbin.com/screens/5859ffb5-02a0-45ee-9065-2ea87eaf43fa): map 40% (291pt) then 2 task rows of **71pt** with 24pt icon, a "Current task" chip 18pt, chevron; toggle row 47 |

## 4. Consensus (3 or more apps)

1. **Side margin 16pt** in 8 of 16 measured (Shopify, Asana, Slack, Jobber, Wise, DoorDash, Todoist, Revolut); 19-20 in 4 (Linear, Stripe, Things, Mercury); Notion 31 and Shopee 10 are outliers. Median 16.
2. **Single-line row 44-48 (median 47), two-line row 59-63 (median 63).** Density comes from pitch and padding, not from type: row text stays 16-17pt, meta 13-14, chips 11-13.
3. **Plain rows plus one hairline that starts at the text column** (Todoist, Stripe, Asana, Grab, Shopify, Wise) or **grouped cards with no dividers** (Revolut x2, Linear). Never a bordered card per row except Todoist Today (54-83pt) and Shopee order cards.
4. **Section header is small and carries a count or action at its right edge**: "+" (Linear), "Reschedule" (Todoist), count + kebab (Asana), "View all" (Jobber, Mercury chevron), day total (Revolut). 44-58pt centre to centre between sections, 39-46 header to first row centre. Things at 76-80 is the airy exception.
5. **A work screen opens on its list or its one number, within 20-32% of the viewport** (Stripe 19%, Linear 26%, Shopify orders 32%). Heroes are rare (Jobber map only) and flagged.
6. **Totals are 17-27pt and bare** in one container or strip (Stripe, Shopify, Mercury, Dasher, Fiverr). Wallets go to 38-47.
7. **Key-value rows 45-47** with label left grey, value right ink (Stripe 45, Shopify 47.3, Dasher 28 compact, Jobber 59, Shopee 26 for price lines).
8. **One filled primary full width, 45-55pt, pinned over the scroll** (Stripe, Jobber, DoorDash, Expensify, Instacart); a second action is outlined and the same height, side by side (Shopee, Remote, GitHub).
9. **Fixed trailing column for row actions** (Dasher pencil, Deel button, Asana kebab) rather than a swipe-only action; swipe appears once (Wise).
10. **Chips and segmented controls 29-37pt**, filter chips scroll sideways with the 4th clipped (Shopify, Instacart, Asana, Squarespace, Shopee tabs).
11. **Underline tabs 45-52pt** for sibling views of one object (Stripe, Instacart, Jobber, Squarespace, Upwork).
12. **Detail = header block (name + 1 meta line + status chips), key-value block, actions, then sections split by 10pt bands** (Shopify x2, Jobber, Stripe).
13. **Add affordance at the end of the list it adds to** ("+ Create payment", "+ Add" pill, "Add a stop", "New page"), not in a top bar.
14. **Selection keeps the count in the primary label** ("Add (3)", "Continue · 1", "ADD (2)") with the bar 47-59pt; "Select all" at the left of that bar (Shopee) or top-right (Yazio).
15. **Empty sections keep their frame** (Deel disabled button, Asana collapsed rows 56pt, Shopify "That's it for now", Revolut Biz card 190pt).
16. **Bottom navigation 52-85pt**: floating pill 52-58pt (Shopify, Revolut Biz, Linear) or docked 85pt incl. safe area with labels (Stripe, Jobber, Asana).

## 5. How dense is dense

Consumer numbers come from [2026-10-22-layout-synthesis.md](2026-10-22-layout-synthesis.md) and the cross-industry doc (P1-P15).

| Measure | Consumer (customer app research) | Work apps (this study) | Difference |
|---|---|---|---|
| Side margin | 16-24 (food 16, editorial 24) | 16 (median), 19-20 for 4 apps | About 4pt tighter |
| Single-line row | 54-56 settings, 56 "row" | 44-48, median 47 | 15% shorter |
| Two-line row | 60-72 (92 with a right action) | 59-72, median 63 | 12% shorter |
| Thumbnail / media | 56-64 (photo rows), photo cards 146-336 wide | 29-42 icon or logo, none in most rows; 60 in Open only | Photos give way to status tiles and icons |
| Section gap | 28-46 | 44-58 centre to centre (about 20-30 clear); Shopify band 10 + 20 + 20 | Same clear gap, smaller headers |
| Heading to content | 12-20 | 16-24 clear (39-46 centre to centre) | Same |
| Screen title | 32-34 large, 22-26 section | 21-31 title (median 25), 14-18 section | Title 7pt smaller |
| Row title / meta | 17 / 14-15 | 16-17 / 13-14 | 1pt smaller |
| Hero / total figure | 40-52 | 17-27 (median 26); 38-47 wallets only | Half the size |
| Type sizes per screen | 4-5 | 4-5 (e.g. 21 / 17 / 14 / 13 / 12) | Same count |
| Primary button | 47-50 | 45-55 | Same |
| Chips / icon buttons | 32-36 / 40-44 | 29-37 (median 31) / 37-47 | 3pt smaller |
| Tab bar | 83-92 docked, 62 floating | 52-58 floating, 85 docked | Same |
| First viewport | 1 dominant module 40-60%, at most 4 modules | List or one strip about 70-85% of the area; 1 summary strip 10% | Dominant module is the list |
| Rows above the fold | 3-4 cards, 8-10 settings rows | 8-10 list rows, **13-14 settings rows**, 4-5 two-line rows | About 40% more rows |
| Card radius | 16-24 | Cards 8-21, sheets 21-31, controls 8-13 | Tighter cards |

**Verdict:** a work app is about 12-15% shorter per row, 30-40% more rows per screen, a title 7pt smaller and a lead number half the size, with the same margins, type ladder length and primary button.

## 6. Where these apps agree and disagree with the rule set (app-screens.md)

- **Agree:** row pitch median 47 vs AS §7.1 median 45; right-aligned figures; delta colour says good or bad (Stripe orange for the bad direction, §5); no sparkline on a count; no icon-in-circle KPI; one container for a KPI strip (Stripe); table that must stay a table fixes the first column (Asana, §12); per-column "mapped to" cards on a phone (Expensify, §12 "fields move to line 2, never dropped"); empty frames kept (§11).
- **Disagree or fail:** lead figure at 17-19pt in 4 apps vs AS §5 30-36 (Mercury 26 is closest); a green "up 100%" from a zero base (Jobber, AS §5 "zero or undefined change is grey"); Shopify orders carry 3-4 marks per row (§7.6); a zebra band in Shopify analytics (§7.3); two stacked segmented rows (Vivid, §12); Jobber's hero greeting over a map (§4.3); a 189pt banner above the Wise team list; Notion repeats headers per group (about 150pt per day); Deel Billing is a card per record at 452pt each. Touch targets: Shopify chips 31, Stripe pills 29, inventory stepper glyphs 24 are under the 44 rule (§12) and 48dp on Android, so draw them at this size but give them a 44-48 hit area.
- The first list row starts in the top 60% in every captured list (Stripe 19%, Linear 26%, Shopify 32%, Jobber home 60% is the edge case).

## 7. Distinctive moves worth taking, mapped to Dapur

| Dapur screen | Move (source) | Layout numbers to start from |
|---|---|---|
| **Hari ini** | One job tile at the top that carries the next action (Shopify "1 Order to fulfill") and an honest end state | Tile 52-56 tall full width; finished state = one 44pt row with check icon, frame kept |
| Hari ini, cooking totals | Plain key-value rows, count right-aligned, one hairline from the text column (Shopify kv 47.3, Linear 48, Things 44) | Row 44-48; row title 16-17; count 17 tabular; section header 14 + total at its right edge (Revolut day total) |
| Hari ini, delivery run | Reorderable stops list (Grab 48 pitch, drag handle, x) and a task row with a status chip (Dasher 71, "Current task" chip) | Stop row 56-64 with 24pt number badge; trailing handle in a fixed column; current stop gets a 3-5pt left bar (Jobber 5pt) instead of a bigger card |
| Hari ini, summary | One bordered container, 3 columns, label 14 over value 19-24 (Stripe 85pt), swipeable day (Today / Tomorrow) | Strip 80-90; never 4 columns; a clipped 4th only if it scrolls (Shopify) |
| Hari ini, late items | Group "Terlambat" with its action at the right edge (Todoist "Reschedule") | Header 40-44 with 17 bold + trailing text action |
| **Pelanggan** list | Mercury / Instacart rows 60-62: avatar 29-38, name 16-17, one meta line 13-14, chevron; search 37-39 + one icon; chips 31 | Row 60; no 4-line rows (Shopify customers 98 is too tall); group band 25 only when sorted by letter |
| Pelanggan detail | Shopify header (name 22, meta 13, 2 chips) then Email / Phone as two 39pt buttons side by side; Jobber "Create" under the name; Stripe tinted kv well with "+ add" as the last row of each list | Header about 115-157; kv rows 47; sections split by 10pt bands; chat or WhatsApp buttons 2-up, 177 wide |
| **Menu** (weekly) | Google Calendar agenda: 55pt day gutter, one block per dish, empty day = one line; Quo 7 rows x 55 (day left, summary right); Asana frozen first column for a package-by-day grid at 43 | Day gutter 52-56; block 30 (1 line) or 50 (2 lines), 6 gap, 17 between days; avoid Notion's 150pt per group and Future Pro's 93-141 rows |
| Menu, day edit | Sheet with day rail + "+ Add" pill 39 + drag handle (Future Pro); copy-to-other-days strip with dots under filled days (Remote) | Strip circles 37 (hit 44), dot 6 |
| **Usaha / Uang** | Mercury balance 26 + in/out line + inline period dropdown; Stripe pinned period pills; Dasher kv rows 28 and 56.7 rows with bold amount; Revolut day total at the group header | Total 26-28 (not 47); period pills 29-31 pinned under the bar, 44 hit; rows 56 with amount right; Rupiah as Shopee ("Rp23.999", "-Rp18.000", 26pt price lines) |
| Uang, breakdown | Shopee price lines 26 + struck-through old price; Gusto stacked bar 13pt with a 28pt legend; Turo bottom split selector 40 | Never two stacked segmented rows (Vivid) |
| **Tim** | Mercury role groups ("Admin") instead of a role chip per row; Instacart chips 31 (Aktif / Menunggu / Nonaktif) + pinned invite 55; Revolut Biz role as second line | Row 60-62, avatar 29-38; pinned primary 48-55; no banner above the list (Wise 189) |
| **Sheets** | Pinned footer with a two-up Discard (ghost) + Save (Remote), 47 each; Cancel / Save pills in the sheet bar for short forms (Shopify); Stripe primary disabled until valid, spinner inside | Footer 16 margins, buttons 48; sheet radius 24-26; fields 55-58 tall, pitch 73-75 (Shopify, Jobber) or 35 / 79 compact (Stripe) |
| Sheets, quantity | Shopify field with [-][+] 34pt squares inside, minus disabled at the floor; avoid glyph-only steppers (inventory, 24pt) | 48dp targets; value shown as "1 / 8" when there is a cap |
| **Import assistant** | Expensify: one card per source column with sample values and a trailing "mapped to" pill; header toggle row; pinned Import | Card 72-92, gap 16, pill 29 (hit 44), footer 47; steps as numbered cards (Matter) only for the intro |
| **Settings** | Shopify list: search 37, group titles 14 bold, rows 47.3, 21pt icon, chevron, 13-14 rows per screen, version last; destructive row last and muted (Jobber) | Row 48, group gap 10 band + 20; one view per area (AS §8.2) |
| **Bulk select** | Count in the primary label ("Hapus (3)") and a bar 47-59 with Select all left (Shopee, MFP, Revolut) | Check circle 24 at the row start; rows 56; no checkboxes until the mode is entered (Depop "Bulk actions" entry 42) |

## 8. Masters (25, in `output/mobbin/2026-10-24/work/`)

All links are `https://mobbin.com/screens/<id>`; ids are the ones in the tables above. Dimensions are pixels, three frame widths in pt as noted in section 1.

| File | Frame | Shows |
|---|---|---|
| stripe-home-reports.webp, stripe-payments-list.webp, stripe-payment-detail.webp | 375 | Home KPI strip and reports, 3-line payment rows, key-value sheet |
| shopify-orders-list, shopify-order-detail, shopify-settings, shopify-create-order-stepper, shopify-inventory-stepper, shopify-customer-detail | 393 | Order rows and pills, order sections, settings rows (verified 47.3), stepper field, inventory rows (62.3), customer record |
| linear-active-issues, linear-issue-detail | 393 | Grouped dense rows, chip-cloud header and pinned composer |
| things-today, todoist-upcoming | 375, 393 | 44pt rows and 76pt section gap; 111pt strip and 63.3pt rows |
| jobber-business-health, jobber-client | 393 | Key-value rows (59.0), client header with Create under the name |
| gcal-schedule-agenda | 375 | Agenda with 55pt gutter |
| wise-usd-balance, mercury-home, revolut-business-invoices | 393 | Balance + action circles, balance + chart, grouped invoice rows |
| dasher-weekly-earnings | 402 | Key-value rows, 56.7pt list rows |
| grab-stops-editor, expensify-import-mapping, asana-project-sticky-column, shopee-seller-my-shop, remote-add-hours | 393 | Stops, import mapping cards, frozen-column table, seller hub, pinned two-up footer |

Not saved (cited by link only): the other Linear, Todoist, Things, Slack, Notion, Revolut, Deel, team, selection and import screens above.
