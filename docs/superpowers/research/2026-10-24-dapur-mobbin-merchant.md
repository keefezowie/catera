# Layout research: merchant, back-office, check-in and delivery-status apps (Mobbin, iOS) for Catera Dapur

Date: 2026-10-24. Scope: LAYOUT only (sizing, spacing, density, hierarchy, module placement, what lives on which screen). Colour, brand and copy are out of scope.
Purpose: give the Dapur layout rethink numbers to build against. Dapur ships on Android first; Dapur screen names below are working labels, not copy.

## 1. Method and coverage

- Tool: Mobbin `search_screens` (ios, 34 calls, mostly 4-6 results each) plus 1 `search_flows`. The tool only accepts `ios` or `web`, so **no Android screens could be searched**. iOS pt and Android dp are numerically the same for layout (1 pt = 1 dp on a 390-wide frame); platform chrome differs (see 1.3).
- Measuring: previews are 299 px wide for a 390 pt frame (1 preview px = 1.30 pt), usable height about 648 px = 845 pt. Every number below is read by eye from those previews and converted. Treat as +/-2 to 4 pt (+/-4 on text sizes, inferred from glyph height). Good for ratios and ranges, not for pixel copying. Masters are 1179x2676 (3x of a 393 pt frame).
- Evidence strength differs by section; each section header in 2 says which:
  - **Direct**: a real merchant app on Mobbin (Shopify seller app, Fiverr seller mode, Posh organizer, Luma host).
  - **Analogue**: the closest screen type Mobbin has (a check-in list for a delivery run, a grocery list for cooking totals, consumer tracking sheets for proof of delivery).

### 1.1 Coverage gaps (honest)

| Asked for | Found? | What was returned |
|---|---|---|
| Toast, Toast Now / KDS | No | Panera, Burger King, Chipotle, Shake Shack (consumer ordering apps) |
| Square POS / Dashboard / KDS | No | only Square Go (consumer booking app) |
| GoFood / GoBiz merchant | No | Gojek consumer app (GoFood, GoSend) only |
| GrabMerchant | No | Grab consumer (offers, order tracking, GrabMart) only |
| Shopify POS / seller app | **Yes** | Shopify mobile admin: Home, Orders, Customers, Products, Analytics, Finance, Settings (about 40 screens, one sitting of the app) |
| Uber Eats Manager / Orders | No | Uber Eats consumer + courier profile view in the consumer app |
| DoorDash Merchant / Dasher | No | DoorDash consumer order tracking only |
| Deliveroo Hub / Rider | No | Deliveroo consumer only |
| Lightspeed, Clover | No | empty (Clover) / consumer apps (Lightspeed query) |
| Instacart / Shipt shopper app | No | Instacart consumer "Shopping your order" status only |
| Lalamove, Gojek driver, Uber Driver | No | consumer ride / order screens; Lyft shows only a "Get the driver app" interstitial |
| Kitchen display, ticket queue, prep list, per-stop run list, in-app proof-of-delivery camera | No | none exist as screens; analogues used (2.4, 2.5, 2.6) |

Apps that are real merchant-side and usable: **Shopify, Fiverr (seller mode), Posh (organizer), Luma (host), Cash App (earnings), Airbnb (host menu and Insights)**. Everything else cited is a consumer or utility app used as an analogue and labelled so.

### 1.2 Masters saved

Folder `D:\Project\Catera\catera\output\mobbin\2026-10-24\merchant\` (25 WebP, 1179x2676 except where noted; all are native captures, not upscaled; `shopify-customers-list.webp` is a lossless 1178x2675 capture).

| File | Source screen |
|---|---|
| `shopify-home-kpi-strip` | [Shopify Home, KPI strip + to-fulfil tile](https://mobbin.com/screens/635cf029-446c-4cdb-a3aa-bb1278e8291e) |
| `shopify-home-chart` | [Shopify Home with chart](https://mobbin.com/screens/2063df51-e95a-4a2d-a384-792cc2053144) |
| `shopify-analytics-cards` | [Shopify Analytics KPI cards](https://mobbin.com/screens/61c1f44d-31bc-4c87-b075-41c872410397) |
| `shopify-orders-list` | [Shopify Orders list](https://mobbin.com/screens/ae89a0e6-84c6-4c57-820c-86066c76949a) |
| `shopify-select-bar` | [Shopify multi-select bar](https://mobbin.com/screens/cdf5ce46-7ade-4ac6-83cd-4f02a1e27457) |
| `shopify-fulfill-sheet` | [Shopify Mark as fulfilled sheet](https://mobbin.com/screens/0e400f39-42a6-4e3d-90b3-700bdda50927) |
| `shopify-customers-list` | [Shopify Customers list](https://mobbin.com/screens/8d012513-7214-4c00-935d-aaa2307452f9) |
| `shopify-customer-detail` | [Shopify customer detail](https://mobbin.com/screens/eef0daad-490b-4e23-862c-2f97c11f1b6a) |
| `shopify-product-picker` | [Shopify products picker sheet](https://mobbin.com/screens/586debf9-f0b9-42d8-b5c6-245ee88802eb) |
| `shopify-inventory-sheet` | [Shopify inventory steppers](https://mobbin.com/screens/14fbc79d-c3c2-4db4-a874-3f22351e8212) |
| `shopify-product-editor` | [Shopify product editor](https://mobbin.com/screens/3a6f0411-b701-41db-9b4d-e82e34fab918) |
| `fiverr-seller-home` | [Fiverr seller home](https://mobbin.com/screens/fc807bd4-3a05-44a1-b5dd-62fcdb6efcfd) |
| `fiverr-manage-orders` | [Fiverr Manage orders](https://mobbin.com/screens/9827aec6-7fab-404a-a8d2-073c071ca4e0) |
| `posh-organizer-home` | [Posh organizer home](https://mobbin.com/screens/97ec8c5c-ab63-4b7c-a0fc-018b8aa2a1c9) |
| `luma-guest-list` | [Luma guest list with check-in toast](https://mobbin.com/screens/e02a3aa3-e02c-4019-82cf-163fa8b1eafd) |
| `luma-guest-sheet` | [Luma guest detail sheet](https://mobbin.com/screens/e5ec52a0-6134-4aec-bf98-e531243e8b5f) |
| `luma-add-host-sheet` | [Luma Add Host role sheet](https://mobbin.com/screens/54c36968-7daa-4e8c-ba87-db5507d96aca) |
| `instacart-shopping-status` | [Instacart shopping-your-order status](https://mobbin.com/screens/f245d07c-a94d-4780-aedc-acdeeac65002) |
| `starbucks-delivery-photo` | [Starbucks "order picked up" photo card](https://mobbin.com/screens/dfa12f87-2814-476c-b768-855f75dcbbfc) |
| `jomo-photo-proof` | [Jomo "Prove with a photo" sheet](https://mobbin.com/screens/062abce9-a40d-4d97-9aa6-f916e299b8d1) |
| `swiggy-shopping-list` | [Swiggy checklist with docked CTA](https://mobbin.com/screens/de0f97bc-c665-431e-9cfc-7c47502f8bc8) |
| `bitepal-meal-plan` | [BitePal Meal plan with week strip](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685) |
| `cashapp-earnings` | [Cash App Earnings](https://mobbin.com/screens/380b2a2b-e241-4dae-8783-5e11691f4209) |
| `notion-change-access-sheet` | [Notion Change access sheet](https://mobbin.com/screens/42c70a6f-1dcc-4823-9cd5-a94a6d1d1574) |
| `grailed-order-footer-cta` | [Grailed seller order with docked button](https://mobbin.com/screens/d81c3fa3-8eb7-4e3e-b88a-e71b77d2b26a) |

### 1.3 Platform notes for Android (from expo-native-ui and M3)

- Follow M3 on Android, never iOS chrome: no floating pill tab bars, large-title text or iOS switches. The floating pill nav seen in Shopify, Fiverr and Luma is iOS 26 chrome; on Android use an M3 bottom navigation bar (80 dp) or Expo `NativeTabs`.
- Touch target floor: 48 dp on Android (44 pt on iOS). Every row, chip and icon button below that floor in this study is a finding to avoid, not to copy (Shopify 31 pt chips, Posh 31-33 pt search).
- Bottom sheets: Android form sheets open at full height (already fixed in commit 1d736acf); the 42-52% detail sheets below are iOS detents and need a modal bottom sheet with a fixed footer on Android.

## 2. Per-app findings

### 2.1 Operator home / Today (direct: Shopify, Fiverr, Posh, Airbnb)

| Screen | Layout facts (390 pt frame) |
|---|---|
| [Shopify Home](https://mobbin.com/screens/635cf029-446c-4cdb-a3aa-bb1278e8291e), [with chart](https://mobbin.com/screens/2063df51-e95a-4a2d-a384-792cc2053144) (`shopify-home-kpi-strip`, `shopify-home-chart`) | Black header band to 121 pt (47 pt status area + about 70 pt content: 31 pt store avatar, 16 pt store name, bell, 31 pt profile avatar), then a white sheet with 28-30 pt top radius. Under it, one row of two filter chips (29 pt tall: "Last 30 days", "Live View"). KPI strip is **four bare figures in one row, no tiles**: 12 pt grey label over a 15-16 pt bold value, equal columns, the 4th is clipped at the edge so the strip scrolls. One "1 Order to fulfill" tile 176x55 pt (grey fill, radius 8, count 15 pt + 12 pt label) sits under the strip: the to-do is the only boxed thing. Chart 120 pt tall (14% of viewport), no legend, dashed forecast tail. Below: an honest empty state ("That's it for now") instead of filler. Dominant module: none; the chart is largest at 120 pt. Everything above is inside the top 50% of the viewport. 4-tab docked bar (about 75 pt including safe area) in the earlier build, floating 55 pt pill in the later one. |
| [Shopify "Adding a new product" flow](https://mobbin.com/flows/1252f292-a130-41aa-b32a-8b4155b5cf36) (first-run Home shown at its start) | "Get ready to sell" checklist card: 6 rows at 46 pt pitch, 18 pt dashed circle at left, chevron at right, card radius 12, collapse chevron in its header. A "Go to..." search field 43 pt tall sits above it. First-run = checklist replaces KPI strip, same slot. |
| [Shopify Analytics cards](https://mobbin.com/screens/61c1f44d-31bc-4c87-b075-41c872410397) (`shopify-analytics-cards`) | One KPI per card, 4 stacked: card about 80 pt tall on an 88 pt pitch (8-10 pt grey gap), 12 pt label with dotted underline, 17 pt value, 60x25 pt sparkline at the right. 4 cards plus the start of a chart fit in 845 pt. [Breakdown table](https://mobbin.com/screens/42027cab-3c3d-4a7c-9786-d79229146001): rows 41 pt pitch, blue underlined label left, bold right-aligned value, a dash column for the delta, alternate rows grey-banded (one of the few zebra tables found). |
| [Fiverr seller home](https://mobbin.com/screens/fc807bd4-3a05-44a1-b5dd-62fcdb6efcfd) (`fiverr-seller-home`) | Header row 44 pt (name 16 pt, 26 pt avatar), no bar chrome. "Earnings" 20 pt bold with an underlined "View Details" link at the right. **One card of six key-values** in 2 columns: label 11-12 pt grey over 14 pt bold value, pair pitch 58 pt, card 195 pt tall; only "Available for withdrawal" is coloured. Then "To-Dos" 20 pt + a 85 pt card, then "My gigs" statistics rows at 44 pt pitch (label left, bold value + tiny arrow right). Margin 16, section heading to card 12-14 pt, between sections 24-28 pt. Floating 4-tab pill nav. |
| [Posh organizer home](https://mobbin.com/screens/97ec8c5c-ab63-4b7c-a0fc-018b8aa2a1c9) (`posh-organizer-home`) | Org switcher as the title (24 pt bold + chevron), then a 2x2 of bare figures divided by hairlines: Revenue and Attendees at 22 pt over 12 pt labels, Events and Followers smaller (13 pt bold). Then one grouped card of four link rows at 56 pt pitch, radius 12 (View Events with a count at right, Manage Finances, Edit Profile, Manage In-Person Payments). A 125x34 pt "Create Event" pill floats at the bottom centre above a docked 5-tab bar. Home = 2 figures + 4 links + 1 create action; nothing scrolls. |
| [Airbnb host menu](https://mobbin.com/screens/ec965d5f-a216-49db-b44b-7ee988a9d7d7), [Insights Stats](https://mobbin.com/screens/ec1e902b-2557-4657-913c-9d29c531a542) | Menu: 11 pt grey caps group label ("HOSTING"), rows at 55 pt pitch with 20 pt icon, 17 pt label, chevron, 6 rows per group. Insights: 28-30 pt page title, 3 underline tabs (Opportunities / Stats / Superhost), then a **3-up bare KPI row** (17 pt bold value over 12 pt label, hairline above and below, no tiles). Page margin 24 here (the roomy outlier). Docked 5-tab bar. |
| [Cash App Earnings](https://mobbin.com/screens/380b2a2b-e241-4dae-8783-5e11691f4209) (`cashapp-earnings`) | Month chip pair 36 pt tall; **one headline figure at about 48 pt, light weight, centred**, then a 159 pt bar chart with a dotted baseline, then "Key stats" 20 pt with key-value rows (label left, value right; "Net earnings" has a 12 pt sub-line "minus fees"). The only app with a true hero money number. |
| [Fiverr Earnings](https://mobbin.com/screens/b255822a-f40d-49c4-8d52-f1143a65fbfb) | Available balance centred at 22 pt bold in the accent colour with a 12-13 pt caption; "Overview" 20 pt + a date-range select at the right; 2 equal underline tabs (40 pt); then a **335 pt chart that is empty for a new account** (40% of the viewport wasted). A range picker opens as a native wheel sheet of 247 pt (29%) with Close / Select text actions. |

### 2.2 Order / ticket queues (direct: Shopify, Fiverr, Posh; no KDS exists on Mobbin)

| Screen | Layout facts |
|---|---|
| [Shopify Orders](https://mobbin.com/screens/ae89a0e6-84c6-4c57-820c-86066c76949a) (`shopify-orders-list`) | Title row "Orders v" (a title that is a switcher: Orders / Draft orders / Abandoned) with + and ... at the right. Search field 39 pt with a 36 pt sort button; filter chips 31 pt tall in a scroll row (All, Unfulfilled, Unpaid, Open, Archived). Date group band 20 pt grey ("Today"). **Order row about 100-108 pt, four lines**: `#1002` bold + amount right-aligned; "customer - 5 items - 12:31 PM"; two status chips 20 pt tall (yellow = needs action, grey = state); a fulfilment-method line. Hairline divider inset 16. No thumbnail. [Draft orders](https://mobbin.com/screens/b853a919-c4be-474d-aa31-5b08c84facb4): 2-line row with one inline chip, 70 pt pitch (about 8 rows per screen). |
| [Shopify multi-select](https://mobbin.com/screens/cdf5ce46-7ade-4ac6-83cd-4f02a1e27457) (`shopify-select-bar`) | "Select" at the title row's right turns each row into [checkbox 18 pt + text shifted 38 pt]; a **dark action bar 50 pt tall, 16 pt side margin, floating about 16 pt above the nav**: a count chip "(x) 0" at the left, a "Delete" text button at the right (disabled until >0). The bar replaces nothing; the list keeps its place. |
| [Shopify order detail](https://mobbin.com/screens/9d259720-8e2b-4371-8678-5ee02feb9b56), [edit](https://mobbin.com/screens/44bbd594-5e0d-4f65-9cbe-0e28329b6ce7) | 40 pt circular back, print and "..." buttons; `#1001` 24 pt bold with a state chip beside it; cards separated by 8-10 pt grey bands (no card shadow, no border); each card has a 14 pt bold header + "..." at right. Line item: 52 pt thumb, 14 pt name, grey variant, "x 1" 16 pt right. **Primary "Mark as fulfilled" is a dark 43 pt full-width button inside the unfulfilled card** (radius 8, split chevron for alternatives), not docked. |
| [Mark as fulfilled sheet](https://mobbin.com/screens/0e400f39-42a6-4e3d-90b3-700bdda50927) (`shopify-fulfill-sheet`) | Full-height sheet, Cancel as a 36-40 pt grey pill at top-left, title + order id centred. Items with an 18 pt count badge and a 78x34 pt stepper (see 2.7), outlined fields 56 pt tall radius 12 with a 10-11 pt floating label, 16 pt apart, a notify toggle row 48 pt, then in-flow at the end a dark 43 pt "Mark as fulfilled" and an outlined 43 pt "Print packing slip", 12 pt apart. Footer buttons scroll with the form. |
| [Fiverr Manage orders](https://mobbin.com/screens/9827aec6-7fab-404a-a8d2-073c071ca4e0) (`fiverr-manage-orders`) | Title 17 pt centred, bell and filter as 43 pt circles at the corners. 3 underline tabs with counts ("Updates (1) Active (1) New (1)", 50 pt tall, 2 pt indicator, 14 pt label). **Order card 152-160 pt**: 81x55 thumb, price 14 pt bold, 2-line 13 pt description, a buyer row (18 pt avatar, grey name, uppercase 10 pt status chip 20 pt tall), a hairline, then date (13 pt bold) and a kebab. Radius 12, soft shadow, 16 pt margin, 8-10 pt gaps. About 4 cards per screen. A heading "Due in the next 2-5 days" groups cards by urgency (20 pt). |
| [Posh orders](https://mobbin.com/screens/c47de8ef-1779-4877-88a6-02d22b5b9ef6), [alias orders](https://mobbin.com/screens/3ffbd5fc-b59f-468d-a89a-85738785398c) | Dark list: segmented "Orders / Pending" 150x30 pt next to a 40 pt circular back; search 31-33 pt; row about 50 pt (name 15, "1 ticket - #id" 13, date 11 grey) with a chevron; 10 pt side margin. Alias: two summary rows "Open 0" and "Closed 0" at 56 pt, counts right-aligned as bare numbers before a chevron (a queue's two states as the whole screen). |
| [Faire Orders](https://mobbin.com/screens/67f53dca-d3c2-42db-9290-c441f5403813) | Order block about 340-360 pt: header row (31 pt avatar, name, date right), id + amount line, chip "Processing" + estimate, 36 pt thumb, then **4 stacked text-action rows at 39 pt each with chevrons** (Reorder, View invoice, Cancel order, Get help). Only 2.4 blocks per screen: action rows make a queue heavy. |

### 2.3 Cooking totals and prep list (analogue: checklists and meal plans; nothing aggregated exists on Mobbin)

| Screen | Layout facts |
|---|---|
| [Swiggy shopping list](https://mobbin.com/screens/de0f97bc-c665-431e-9cfc-7c47502f8bc8) (`swiggy-shopping-list`) | Title + "10 items added" sub-line in a 56 pt header; an "Add your items" input 44 pt tall with a grey hint strip under it; **rows 56 pt pitch**: 20 pt checkbox, 16 pt name, 18 pt pencil at right, hairlines inset to the text; 8 rows fit between input and footer. Footer is a white band with a **full-width 53 pt CTA, radius 12, 16 pt margin** that stays docked. Checked rows stay in place (no reordering). |
| [Noom Grocery list](https://mobbin.com/screens/b7950de7-6b61-481f-abfe-959c3916ef58) | Same row at 56 pt, 28 pt round check, a small "x" delete at right, a 34 pt summary strip ("Your grocery list has 1 green foods") above, and a "Clear list" text link right-aligned at 14 pt. |
| [BitePal Meal plan](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685) (`bitepal-meal-plan`) | Title 28 pt; week range as a grey 13 pt dropdown with a "Grocery list" outlined pill (34 pt) at the right on the same row; **7 day tiles about 46x55 pt** (weekday initial 12 pt over date 17 pt bold; selected = white filled tile, today = outlined); below, one white card per meal slot (radius 16, 10 pt margin, 12 pt grey group label "Breakfasts / Meals / Snacks"), rows about 85 pt with a 42-48 pt round photo + 15 pt title + 12 pt grey meta; hairline between rows inside a card, 12 pt between cards. |
| [Blue Apron ingredient list](https://mobbin.com/screens/48abb101-7592-404e-8c4b-5464503eb2d5) | Two-column key list: quantity column 12-14 pt right of the margin ("12 oz", "1 tbsp") then the item name; rows 26-34 pt pitch, no dividers, one grey note line ("Measurements are for 2 serving recipes") at 12 pt. This is the only quantity-first row on Mobbin; it is dense (about 14 rows per screen). |

### 2.4 Delivery run and stop lists (analogue: guest check-in; consumer tracking; no per-stop driver list exists)

| Screen | Layout facts |
|---|---|
| [Luma guest list](https://mobbin.com/screens/e02a3aa3-e02c-4019-82cf-163fa8b1eafd) (`luma-guest-list`) | The closest thing to a run list. Title row 56 pt (40 pt circular back, centred title). **State tabs as scrolling chips with live counts**: "Going 3 | Checked In 2 | Not Checked In 1", 29 pt tall; the counts recompute the moment a row changes. **Rows 56 pt**: 35 pt avatar, name 15 pt, email 12 pt grey, and at the right a green "Checked In" pill 81x20 pt with the relative time ("22 min ago") 11 pt under it. A not-going row shows a grey pill instead. Bottom: a floating bar with a sort circle (39 pt), a "List | Scan" segmented control (130x39 pt) and a search circle (39 pt). A 36 pt green toast ("Guest checked in") drops under the title and does not move the list. |
| [Luma guest sheet](https://mobbin.com/screens/e5ec52a0-6134-4aec-bf98-e531243e8b5f) (`luma-guest-sheet`) | Tapping a row opens a **52% sheet** (about 440 pt): 55 pt avatar, 20 pt name, bio line, social icons, email row, a three-column fact row (Status / Registration time / Referrer, 11 pt grey label over 13 pt value), then **a full-width 49 pt primary and a 49 pt secondary pill side by side** at the sheet's foot. The row itself has no action button; the sheet does the work. |
| [Luma check-in settings](https://mobbin.com/screens/eeccb082-0e2b-4646-a7e1-19b80d01b334) | "Open Check-In Scanner" as a 43 pt white row at the top; "Default scan mode" as a 2-row card (Standard / Express, 56 pt rows, 20 pt radio, 12 pt grey sub-line); a "Lock for Check-In Staff" toggle row; an empty "No Check-In Staff" card with an icon and one sentence (keeps its frame). |
| [Instacart shopping status](https://mobbin.com/screens/f245d07c-a94d-4780-aedc-acdeeac65002) (`instacart-shopping-status`) | One card on a grey page (radius 12, 16 pt margin): 22 pt title, 14 pt window ("Arriving between 11:10am - 11:40am"), **4-node progress** (23 pt circles, 3-4 pt track, nodes: shopped / shopping / on the way / delivered), an address row 43 pt with chevron, then "View items (1 of 2 shopped)" in a 43 pt green row (progress shown as a count in the row). A person card 83 pt (39 pt avatar, name, "405 orders" sub-line, 42 pt filled chat circle at right). |
| [DoorDash tracking](https://mobbin.com/screens/b2543cf1-7f95-4718-92d6-74af14de04d5) | Map takes the top 52%, a white sheet (top radius 24, grabber 36x4) the lower 48% (about 405 pt): 22 pt title, 14 pt window, 4-node progress, a person row with 36 pt call and chat circles, and a **39 pt full-width grey pill "Order details"** that expands. Close, Help and locate are 35 pt circles on the map. State changes swap the title, the node and one pill; the structure stays. |
| Navigation handoff | Not observable: none of the returned navigation screens hands off to another app (Uber, DoorDash and Grab all draw an in-app map). The only handoff-like pattern is a 39 pt pill "Go to X / See directions" over the map above the sheet in [Grab](https://mobbin.com/screens/bf6b896f-c2f0-404c-b75b-1b7b51c8784d). |

### 2.5 Proof-of-delivery photo flow (analogue)

| Screen | Layout facts |
|---|---|
| [Jomo "Prove with a photo"](https://mobbin.com/screens/062abce9-a40d-4d97-9aa6-f916e299b8d1) (`jomo-photo-proof`) | The cleanest capture-gate on Mobbin: a sheet (top radius about 30, grabber), a 22 pt title ("Prove with a photo"), a **347x348 pt square viewfinder** (full width minus 20 pt margins, radius about 30), a 12 pt one-line hint under it, and a **56 pt full-width black pill "Take photo"** docked 16-20 pt above the bottom. One screen, one decision: no secondary action. |
| [Bevel camera](https://mobbin.com/screens/eb0d52eb-7db4-410f-9459-e95ed9cc28ec), [BitePal camera](https://mobbin.com/screens/6aa57cd2-61ec-4a1d-bda4-32c476090dc2), [Lifesum scan](https://mobbin.com/screens/765cd18b-845f-4d57-8d3c-7c0ce37e7d82) | Full-bleed viewfinder takes 71% of the frame; shutter ring 60 pt centred in the bottom strip (about 18% of height); close and flash as 36 pt translucent circles at the top corners; two 52 pt side controls (Import / Describe, or gallery thumb / keyboard) with 12 pt labels either side of the shutter; a 1x / .5x zoom chip 28 pt tall above the shutter. |
| [Starbucks "Order picked up"](https://mobbin.com/screens/dfa12f87-2814-476c-b768-855f75dcbbfc) (`starbucks-delivery-photo`) | The customer-side result of a delivery photo: a card 113 pt tall inside the sheet with the text at the left ("Order picked up", 14 pt line) and a **137x107 pt photo thumbnail (1.28:1) with an expand glyph** at the right. So the photo is shown at about 35% of the frame width and opens full-screen on tap. |

### 2.6 Customers (CRM), menu/catalog editor (direct: Shopify; analogue: Notion/Luma for roles)

| Screen | Layout facts |
|---|---|
| [Shopify Customers](https://mobbin.com/screens/8d012513-7214-4c00-935d-aaa2307452f9) (`shopify-customers-list`) | Search 39 pt + 36 pt sort button. **Row about 98 pt**: name 15 pt semibold, a grey line "Singapore", a "$174,93 - 2 orders" line (value and count in one line), and an icon + note line ("VIP customer"); a pale status chip (26 pt tall, "Subscribed") at the top right. No avatar, no thumbnail, no chevron. [Segments](https://mobbin.com/screens/b8fd7555-20b2-43a9-bbe2-f7562dff89d6): 2-line rows 48 pt ("Email subscribers" 15 pt bold + "Thursday at 3:17 pm" 11 pt grey), same search + sort + Select affordances. |
| [Shopify customer detail](https://mobbin.com/screens/eef0daad-490b-4e23-862c-2f97c11f1b6a) (`shopify-customer-detail`) | Name 24 pt bold, "Since Aug 4, 2026 - Singapore" 12 pt grey, 20 pt chips for flags. **Insights card: 3 key-value rows at 47 pt** (label left, value right, hairlines). Contact card: two outlined 43 pt buttons side by side (Email, Phone; radius 10, 8 pt gap, each about 174 pt), address block 14 pt with a 18 pt copy icon, a grey well (radius 10) for the private note with "Edit" in a 14 pt link. [Lower half](https://mobbin.com/screens/41b067de-2c35-47f3-ad20-adae9e642d45): 47 pt chevron rows (Tags, Tax exemptions, Marketing), Order history (2-line row 70 pt: id + amount, chips), "Store credit" action row, then a Timeline of staff comments with a composer docked at the bottom (40 pt field). |
| [Shopify product picker](https://mobbin.com/screens/586debf9-f0b9-42d8-b5c6-245ee88802eb) (`shopify-product-picker`) | Sheet with a 40 pt close circle, search 43 pt, **rows 66 pt**: 18 pt checkbox, 40 pt thumb (radius 6), 16 pt name, 12-13 pt grey meta line "$100,00 - Active - 0 available" (the problem count in red); about 9 rows per screen. A parent row has a chevron ("3 variants"). |
| [Shopify inventory sheet](https://mobbin.com/screens/14fbc79d-c3c2-4db4-a874-3f22351e8212) (`shopify-inventory-sheet`) | Rows 62 pt: 31 pt thumb, 15 pt variant name, then **a stepper at the right: minus icon, a 78x34 pt grey rounded field with the number, plus icon**; column header "Variant ... Available" 12 pt grey. Per-row editing with no per-row Save: one "Save" pill at the sheet's top-right. |
| [Shopify product editor](https://mobbin.com/screens/3a6f0411-b701-41db-9b4d-e82e34fab918) (`shopify-product-editor`) | Cancel and Save as 36-40 pt grey pills at the corners; content = stacked cards separated by 10 pt grey bands, each with a 14 pt bold header and a blue "Edit" link (Publishing, Options, Variants, Inventory, Metafields). **Setting rows 47 pt** (18 pt icon, 15 pt label, optional 12 pt sub-line, chevron; rows with a sub-line 56 pt). Media carousel of 126 pt squares (radius 8, 6 pt gap, the third peeks); a 20 pt title field; a 40 pt blue tip banner. A 36 pt toast ("Option created") floats over the nav. 26 screens for one "add product" flow: the editor is a long single scroll, not a wizard. |
| [Create customer](https://mobbin.com/screens/53552d4e-8dc0-4f1d-adb8-bacd8ba30398) | Outlined fields **56 pt tall, radius 12, 16 pt apart (pitch 72)**, 10-11 pt floating label, country selector as a 56 pt row, phone as a 78 pt country chip + field on one row. Sheet with Cancel / Save pills. |
| [Luma Add Host](https://mobbin.com/screens/54c36968-7daa-4e8c-ba87-db5507d96aca) (`luma-add-host-sheet`) and [Notion Change access](https://mobbin.com/screens/42c70a6f-1dcc-4823-9cd5-a94a6d1d1574) (`notion-change-access-sheet`) | Roles as **2-line radio rows 66 pt tall**: 15-16 pt role name, 12 pt grey capability sentence, 24 pt check at the right, in a rounded card (radius 14-16). Luma is a 100% sheet with a 49 pt black "Add Host" pill docked 20 pt above the bottom; Notion is a **42% sheet (352 pt)** with a 15 pt title, a 28 pt close circle and four rows, no footer button (tap = select). Instacart's [Add a team member](https://mobbin.com/screens/22cc8dac-d3e9-4790-a4e8-edce0aecc61e) puts the email field first (56 pt), radios 2 rows with a sentence each, a grey info card (the role note), and a 50 pt Continue. |
| Data import | One pattern only: [KOHO](https://mobbin.com/screens/62c3c6ce-4030-45d8-a6eb-a32099732443) "Import contacts" as a 47 pt full-width filled pill above manual fields (name, phone), then "Invite to group" outlined. No spreadsheet or CSV import screen exists on Mobbin mobile. |

### 2.7 Money, settings, tabs (direct: Shopify, Fiverr, Cash App)

| Screen | Layout facts |
|---|---|
| [Shopify Finance](https://mobbin.com/screens/4d049521-0dbf-4de6-b1bb-ee508426a6e7), [Payouts](https://mobbin.com/screens/c64a7249-ff6e-42a5-b8ce-3f7a98304421) | Title "Finance v" is a switcher (Finance / Balance / Credit / Payouts as a popover, 4 rows 40 pt). **"Payout balance" 12 pt label + 18 pt bold value in a plain block, "View payouts" blue link at the right**, an inner grey well (39 pt, radius 8, flag + currency line) under it. Empty payouts: a 110 pt illustration + one sentence + 2 buttons 36-40 pt. Cards separated by 10 pt grey bands; not a table. |
| [Shopify Billing](https://mobbin.com/screens/04916ea4-ad09-4a15-bf25-f54cbe98563e) | "Upcoming bill" 12 pt label, `$0.00 SGD` 24 pt bold, a sentence, a card row for the payment method (card icon 22 pt + last 4); then "Past bills" as a **bordered mini-table inside a card**: All / Paid / Unpaid tabs (30 pt), search + sort icons, rows 47 pt (id bold + amount right; date + "Paid" chip). The only table in the app is nested in a card. |
| [Shopify Security / Users](https://mobbin.com/screens/de9705e3-55c5-48cb-9d08-dd7d90a59762) | Back circle 40 pt, centred title; a 14 pt body sentence + a 34 pt outlined "View" button right; "Collaborators" block with copy / generate / delete as three 36-40 pt buttons in one row. A toast ("PIN copied") floats at the same position as above. Settings are text blocks, not rows. |
| Tab bars | Shopify later build: floating pill 55 pt tall + a separate 55 pt circle for the assistant, 34 pt above the bottom edge, 4 items. Fiverr and Luma: floating 3-4 items. Posh, Airbnb, Shopify earlier build: docked, 5 (Posh, Airbnb) or 4 items (Shopify), about 75 pt including safe area. Active = filled icon + darker label; labels 10-11 pt where present. |

## 3. Consensus (3+ apps share)

Counts are "n of the 6 real merchant apps" unless stated (Shopify, Fiverr, Posh, Luma, Airbnb host, Cash App), using analogues as a second line.

1. **Today is a few bare figures plus one to-do, not a dashboard of tiles.** Shopify (4 figures, 15-16 pt), Fiverr (6 key-values 14 pt), Posh (2 figures 22 pt), Airbnb (3 figures 17 pt): label 11-12 pt grey over a 14-22 pt bold value, no tile, no icon, 12-24 pt between groups. Only Cash App leads with one hero number (48 pt) and only on the money screen. The to-do is the single boxed element (Shopify 176x55 tile, Fiverr 85 pt card, Posh 56 pt link rows). **Home fits in the top 50-60% of 845 pt (4 of 4).**
2. **Operational lists are flat rows, not photo cards.** Shopify orders, customers, products, Luma guests, Swiggy list, Noom list, Posh orders: 7 of 7 are text-led, hairline dividers inset to the text column, no shadow. Only Fiverr uses a card per order (152-160 pt) because each order carries a thumbnail and a buyer.
3. **Row heights by type**: single-line tappable 56 pt (Luma 56, Swiggy 56, Noom 56, Airbnb 55, Posh link rows 56); two-line with media 62-70 pt (Shopify inventory 62, picker 66, drafts 70, Luma role rows 66); three or four lines 98-108 pt (Shopify orders, customers); card per order 152-160. Setting/link rows 47-48 pt (Shopify 47-48, Fiverr 44-46). About 7-9 rows per screen at 56-66 pt; 4-5 at 98-108.
4. **Status is a pale chip, 20 pt tall, at most two per row** (Shopify 20 pt, Fiverr 20 pt, Luma 20 pt, Posh pill; 4 of 4). One chip means state (grey), the second means needs-action (yellow/green). Counts of queue states live in filter chips or tabs above the list (Shopify 5 chips 31 pt, Fiverr 3 tabs 50 pt with counts, Luma 3 chips 29 pt with live counts; 3 of 3).
5. **16 pt side margin** (Shopify, Fiverr, Luma, Instacart, Swiggy, Notion; 6 of 8), dark list apps 10 pt (Posh, BitePal), Airbnb 24. Cards sit directly on a grey ground separated by 8-10 pt grey bands (Shopify everywhere, Instacart, Luma) rather than a border or a shadow. Section headings 14 pt bold inside a card (Shopify) or 20 pt outside (Fiverr, Posh, Cash App).
6. **The primary action is in-flow inside its card, or docked on a one-decision screen.** Shopify "Mark as fulfilled" 43 pt in the card (not docked); docked: Swiggy 53 pt, Luma host 49 pt, Jomo 56 pt, Grailed 49 pt in a 68 pt footer bar, Instacart 50 pt. Rule observed: docked only when the screen is one decision (capture, confirm, save list); lists carry state changes per row or per sheet.
7. **Bulk select = a floating dark bar, 50-52 pt tall, 16 pt margin, count at the left, one verb at the right** (Shopify 50 pt, Notion Mail 4-icon 52 pt, LinkedIn bottom text bar 41 pt; 3 of 3). Selection shows 18-28 pt checkboxes at the row's left edge, the text shifts about 38 pt.
8. **Detail opens as a sheet at 42-59% of the screen** (Luma guest 52%, Notion 42%, DoorDash tracking 48%, Fiverr active orders about 59%) with a 36x4 grabber, 24-30 pt top radius, footer actions 47-49 pt; forms open full height with Cancel / Save pills at the top corners (Shopify, 36-40 pt). Period pickers are a 29% sheet (Fiverr 247 pt).
9. **Per-row quantity editing is a stepper at the right**: minus icon, a 78x34 pt grey field, plus icon (Shopify inventory, fulfil items; Instacart 117x40 pt, Uber Eats cart 117x40 pt from the consumer study). Never a modal per row.
10. **Empty states keep the frame and say one sentence** (Shopify "That's it for now", Luma "No Check-In Staff" with an icon, Shopify payouts illustration). Zero counts print as zeros (Alias "Open 0", Shopify "0 available" in red when it is a problem).
11. **Titles that are switchers**: Shopify "Orders v", "Finance v", "Analytics v", Posh org name with chevron: one list screen hosts 3-4 related queues behind the title popover (3 of 6).

### 3.1 Density against the consumer food study (2026-10-22)

| Dimension | Consumer food apps (11) | Merchant apps (this study) |
|---|---|---|
| Row primary text | 16-17 pt | 15-16 pt (Shopify 15, Luma 15) |
| Row secondary text | 13-14 pt | 12-13 pt |
| Single-line row | 44-56 pt | 56 pt (tappable), 47-48 pt (settings) |
| Media in rows | 100-135 pt photos | none or 36-42 pt thumbs |
| Section gap | 28-40 pt | 8-10 pt grey band between cards, 24-28 pt between headed sections |
| Page margin | 16 | 16 (10 on dark list apps, 24 Airbnb) |
| Tab bar | 49 pt docked / floating pill | 55 pt floating or 75 docked incl. safe area |
| Primary button | 47-53 pt | 43 (in card) to 56 pt (docked) |
| First viewport | 2-3 sections, a hero | 3-4 figures + 1 to-do + 1 chart, no hero |
| Rows per screen | 1.4-5 | 4-9 |

Merchant screens are denser in rows (4-9 per screen against 1.4-5), looser in type scale (3-4 sizes: 11-12, 14-16, 20-24, one figure at 22-48) and flatter in chrome (no photos, no shadows).

## 4. Distinctive moves worth taking (mapped to Dapur)

1. **Luma's live-count state tabs + 56 pt rows + toast that never moves the list** -> `Antar` (delivery run). Tabs "Belum 7 | Berangkat 2 | Sampai 11", counts recompute on every row change; the row is 56 pt (stop name 15 pt, address or window 12 pt grey, right-side state pill 81x20 + relative time 11 pt); tap opens a 50% sheet with the proof photo and Sampai; no per-row action button, so the list stays a clean 8 rows per screen. Source: `luma-guest-list`, `luma-guest-sheet`.
2. **Shopify's 4-figure strip + one boxed to-do** -> `Hari ini`. Totals (portions, boxes, stops) as 3-4 bare figures 15-17 pt over 12 pt grey labels in one strip, and exactly one boxed to-do tile (176x55) such as "Belum dimasak". The cooking totals themselves are the list under it. Source: `shopify-home-kpi-strip`. Add the Posh rule: if the day has 2 figures only, make them 22 pt.
3. **Shopify's floating dark select bar (50 pt, count chip left, verb right)** -> multi-select on `Pelanggan` (kirim pesan massal, tandai) and on stop rows (tandai Berangkat for several). Source: `shopify-select-bar`; 16 pt margin, 16 pt above nav; on Android a 56 dp contextual action bar replaces the title row instead.
4. **Shopify's customer card: 3 key-value insight rows (47 pt) + two side-by-side outlined 43 pt contact buttons + a grey private-note well** -> `Pelanggan` detail: Total belanja / Terakhir pesan / Total pesanan (rows), "WhatsApp" and "Telepon" as two 43-48 pt outlined buttons, "Catatan alamat" in a well. List rows are 98 pt, three lines, no avatar, a pale chip top-right. Source: `shopify-customers-list`, `shopify-customer-detail`.
5. **Shopify's inventory stepper sheet (62 pt rows, minus / 78x34 field / plus, one Save pill)** -> `Menu` weekly editor: per-day rows with dish thumb 31-40 pt, name, and a portion-limit stepper; one Save in the sheet header; no per-row save. Source: `shopify-inventory-sheet`, `shopify-product-picker` (66 pt, checkbox + 40 pt thumb + red "0 tersedia").
6. **Shopify product editor as a single scroll of 10 pt-separated cards with a 14 pt header + "Ubah" link and 47 pt setting rows** -> `Paket` editor (harga, hari kirim, area, kuota). no accordions. Source: `shopify-product-editor`.
7. **Jomo's single-decision capture screen** -> proof photo: a sheet with the 347x348 pt square viewfinder, one-line hint, one 56 pt pill. Put "Sampai" after capture, not before; the thumbnail then sits in the stop row's sheet at 137x107 (Starbucks, 1.28:1). Source: `jomo-photo-proof`, `starbucks-delivery-photo`.
8. **Fiverr's urgency-grouped cards ("Due in the next 2-5 days")** -> `Hari ini` list grouped by delivery window ("Siang 11:00-13:00") with a 20 pt heading and the group's total at the right, rather than a flat list of stops. Source: `fiverr-manage-orders` (heading, 152 pt card), pair with Luma tab counts.
9. **Shopify Finance / Cash App**: payout balance as a 12 pt label + 18 pt bold value + one link, with a grey inner well for the bank line; only the money screen gets a hero figure (Cash App 48 pt light, 159 pt chart under it). Source: `cashapp-earnings`, Shopify Finance link. Do not copy Fiverr's empty 335 pt chart: size charts to the account (a new caterer has 0 weeks of data).
10. **Roles as 66 pt 2-line radio rows (Luma, Notion)** -> `Tim`: Pemilik / Koki / Kurir with one capability sentence each, 24 pt check, sheet height 42% (Notion) when it is only a role pick, 100% with a 49 pt docked button (Luma) when it creates a member. Source: `luma-add-host-sheet`, `notion-change-access-sheet`.
11. **Swiggy's checklist + docked 53 pt CTA** -> cooking totals: item-first rows at 56 pt with a 20 pt check and pencil; checked rows stay in place; the docked CTA only when "Mulai antar" is the next decision. Add the Blue Apron quantity-first column (12-14 pt qty, then name) because totals are the point. Source: `swiggy-shopping-list`.
12. **BitePal's 7-day strip (46x55 tiles, selected = filled)** -> weekly `Menu` day picker above the day's editor; a "Daftar belanja" outlined pill (34 pt) on the same row as the week range. Source: `bitepal-meal-plan`.
13. **Title-as-switcher (Shopify, Posh)** -> `Antar` and `Uang`: "Antar v" for Hari ini / Besok / Riwayat, instead of a second tab row; saves a 50 pt tab strip.

Anti-patterns to avoid (seen here): Fiverr's 335 pt empty earnings chart; Faire's four text-action rows under each order (360 pt per order); Shopify's 31 pt filter chips and 29-31 pt search fields (below the 48 dp Android floor, give chips at least 40 dp tall touch area); a floating pill tab bar on Android.

## 5. AI usage notice (verbatim from the tool result)

---

**Your Mobbin AI usage is high this month**

Usage is unlimited during beta. If your usage stays at this level, you may need to purchase more credits once limits take effect. [View usage and plan options](https://mobbin.com/settings/billing-and-usage)
