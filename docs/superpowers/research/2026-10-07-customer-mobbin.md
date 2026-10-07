# Customer app UI/UX research (Mobbin), 2026-10-07

Scope: a from-scratch rethink of the Catera **customer** mobile app (React Native, phone-first, Indonesian-first). Customers buy a fixed number of portions from a local home caterer for a generated delivery schedule, receive a meal each day, can move a date or change the address before a cutoff, report a problem, and explicitly renew. Many first customers arrive through a WhatsApp link from their caterer rather than by browsing.

Method: Mobbin MCP (`search_screens`, `search_flows`), iOS catalog, 26 queries. Every reference below was viewed as an image. Links go to the Mobbin screen or flow.

Coverage gaps: Mobbin had no usable screens for **Factor, CookUnity, Freshly, Home Chef, ShopeeFood (food vertical) or AYO**. The meal-subscription references therefore come from **HelloFresh, Blue Apron, Cherrypick and Wonder**. The Indonesian commerce references come from **Gojek/GoFood, GoPay, Grab and Shopee**.

This document is input for design. It does not change PRODUCT.md or DESIGN.md. Palette, artwork, naming and concept stay as already approved.

---

## 1. Onboarding from a deep link or invitation, and phone OTP

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| inDrive | [Logging in flow](https://mobbin.com/flows/28987315-220a-4635-b90d-139929f7aa3b) | Phone number first ("Join us via phone number"), then a bottom sheet asks **"How would you like to get the code? WhatsApp / SMS"**. | WhatsApp delivery of the OTP fits Indonesian habits, and the user arrived from WhatsApp anyway. One field per screen. |
| Uber | [Logging in flow](https://mobbin.com/flows/55fee460-9699-4657-9b61-e2b725c38b3d) | Mobile number is the main field with a country picker and one black Continue button. Apple, Google and Email sit below a divider. | Phone is plainly the main path, alternatives are secondary, and "Find my account" serves people who forgot how they signed up. |
| Swiggy | [OTP screen](https://mobbin.com/screens/9b97a3b4-eada-47c1-9242-a579f3f1f546) | "OTP sent to +…", six underlined digits, "Retry in 00:20", one "Verify and proceed" button. | Shows the number the code went to, uses an honest resend timer and has a single CTA. |
| World App | [Connecting phone number flow](https://mobbin.com/flows/d9f43ed5-f4a6-44b4-96a5-4ff72216cbfd) | SMS code boxes with a numeric keypad and a "please wait 13s" message. Afterwards, **"Complete your account"** shows a progress ring and a checklist (back up, notifications, connect number), with completed items greyed out. | Lets the user into the app first. Optional setup (notifications, address confirmation) moves to a checklist they can finish later. |
| sweetgreen | [Logging in flow](https://mobbin.com/flows/49d66593-f8fe-4e73-8023-0d7530e79a0d) | The app is browsable before sign-in. "Join or sign in" opens a sheet, then an email OTP ("enter the code in the next 20 minutes", Resend, contact email). | The identity step is a sheet over content the user already wanted, not a wall in front of it. |
| Givingli | [Opening a gift flow](https://mobbin.com/flows/a59d5a5b-5da1-4eed-8fde-634d92254a6b) | Shows **what you received and from whom** ("From Alex Smith", the card and its value) with an "Open my gift" CTA. | Content and sender come before any account step. This is the right model for "your caterer added your package". |
| Binance | [Claiming a red packet flow](https://mobbin.com/flows/f4f38c06-d96e-4795-b95b-fca4918e594a) | A "‑A14‑ sent you a Red Packet!" modal with one Open button, then a "Congratulations, you got …" result. | Leads with the sender's identity, needs one tap to claim and shows an immediate result. |

### What Catera should take

The WhatsApp link should open a **preview screen before any sign-in**. It shows the caterer's photo and name, the package name, the remaining portions or days, the next delivery date, and a masked address. There is one CTA: **"Masuk untuk melihat paket"**.

Next comes the phone screen, prefilled from the invitation where the backend allows. Then the user chooses **"Kirim kode via WhatsApp / SMS"** (the inDrive pattern), then OTP. The app opens straight onto Beranda with today's meal. Address confirmation and notification permission go into a deferred checklist (World App) or into context: ask for notifications when the first "Masakan sedang diantar" status is useful.

For renewal links, the preview shows "Paket kamu selesai Jumat ini" and leads directly to the renewal summary after OTP.

### Anti-patterns

- **bunq [Claiming an invite](https://mobbin.com/flows/92717d8c-f377-43b9-99af-b84a8940d6dc)**: an "What are you interested in?" questionnaire comes before the claim, and "Claim Invite" is a small secondary link under "Next". Never put profiling in front of a claimed, already-paid package.
- **Blue Apron [cancel flow](https://mobbin.com/flows/66e47e54-97fd-4e0c-a359-8d509db9f3b6)**: an email and password login wall appears inside account settings, in the middle of a task. Catera should keep the session long-lived and re-verify only for sensitive actions.
- Forcing name, email, password and address before the user sees anything. PRODUCT.md already says address is collected when needed. Keep that rule.

---

## 2. Home screen for an active subscriber

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| HelloFresh | [Home / My Menu](https://mobbin.com/screens/5aa17c60-2637-4b18-8845-91f3cfd8d7b6), [Home "Orders"](https://mobbin.com/flows/53e8f448-cfb5-47f5-ad98-c52597b52652) | A horizontal strip of delivery dates (THU 14 AUG …). The current delivery card reads "Coming up · Thu, Aug 07 · **Edit delivery by Sat, Aug 02**", with two buttons (Change meals, Edit delivery) and large food photos. Later deliveries stack below with the same anatomy. | The cutoff is stated in plain words on every delivery. Food photos lead, and the two primary actions sit next to the thing they change. |
| Hims | [Home](https://mobbin.com/screens/1fda61b6-f5ae-4921-b07e-9ca9aaddb864) | The top card shows order status with a 4-step bar (Requested, Reviewed, Shipped, Delivered). A "My Subscriptions" card follows: "Refills on Sunday, Jan 5", with Refill now and Manage. | Two clear layers: what is happening now, then the plan with its next date and one manage entry. |
| Grab | [Delivery tracking](https://mobbin.com/screens/bcfa763e-74d6-4b71-9add-b54464f5453f) | "Arriving by 8:30 PM · On time · Out for delivery!", a 4-icon progress line, driver chat and call buttons, Get help at top right. | Indonesians already know this status vocabulary from Grab and Gojek. Help sits next to status. |
| Walmart | [Order status](https://mobbin.com/screens/da5c3b1c-2ff5-424f-ab22-dd8009a58e7f) | "Arrives today by 10pm" over Placed, Preparing, On the way, Delivered. Inline **"Need to make a change?"** offers Cancel delivery and the help center, followed by the delivery address. | The available changes appear right under the status, with no hunting through menus. |
| Bolt Food | [Order timeline](https://mobbin.com/screens/9509b853-f44c-425e-81c0-c6e96efffe2c) | A vertical timeline with timestamps (confirmed 2:10, courier assigned 2:11, ready 2:14 …). | Timestamps build trust when the meal arrives late. Useful as a "Riwayat status" expansion. |
| Cherrypick | [Cook tab](https://mobbin.com/screens/0212035a-2b49-4003-938d-7c8a01771ecf) | Meals grouped under "Arriving 18 August · Delivered by Sainsbury's". | Groups by delivery date and names the provider. Maps to "Diantar oleh Dapur Bu Sri". |

### What Catera should take

Beranda is a **state machine, not a feed**. From top to bottom:

1. **Today card**: dish photo, meal (Makan siang/malam), status pill (Disiapkan, Diantar, Sampai), delivery window, address, and a small "Ada masalah?" link once the meal is delivered.
2. **Next 3 to 5 delivery days** as compact rows or a date strip. Each shows the dish (or "Menu belum ditentukan") and its cutoff line, e.g. "Ubah sampai Selasa 18.00".
3. **Plan card**: package, caterer, "12 dari 20 porsi tersisa", and the renewal prompt when the plan is near its end.

Discovery content shows only below these, or only when there is no active package.

### Anti-patterns

- Grab's tracking page embeds promo banners and a video ad ("Check this out while you wait") inside the order status. Catera's Beranda should never place promotions between the customer and today's meal.
- [Wolt](https://mobbin.com/screens/c669947b-11d6-453e-88d7-f250ef4e6485) uses a big minute countdown and a live map. A home caterer usually cannot supply precise real-time ETAs, so false precision would erode trust. Use a delivery window and coarse statuses.
- HelloFresh puts an "Add an extra meal, 14% off" upsell card inside the current delivery's meal carousel ([flow](https://mobbin.com/flows/b4120430-7ac6-4e38-9782-7addd661f235)). Avoid upsells inside the delivery itself.

---

## 3. Plan management: schedule, skip or move, address, pause, remaining, renewal

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| HelloFresh | [Skipping a delivery](https://mobbin.com/flows/53e8f448-cfb5-47f5-ad98-c52597b52652) | Edit delivery opens a **"Manage your delivery"** sheet: arrival window, then Reschedule delivery, Change box size, Donate this box, and "Can't make this week somehow? **Skip this week**". After skipping there is an optional reason sheet. The card then shows **"Skipped · Unskip by Saturday, Aug 9"** with a red Unskip button. | All per-delivery actions live in one sheet scoped to that date. The destructive action comes last and is reversible until the cutoff, and the reversed state is visible on the card. |
| HelloFresh | [Rescheduling a delivery](https://mobbin.com/flows/b4120430-7ac6-4e38-9782-7addd661f235) | A **"Change your delivery day?"** sheet shows only available days as date tiles (SAT 09 … FRI 15) plus a time-window dropdown, with Cancel and Next. The card then updates to "Fri 15 Aug · Edit by Sun, Aug 10". | Only valid dates can be picked, and the new cutoff appears immediately. This is a direct template for Catera's "Pindah tanggal". |
| Blue Apron | [Skipping a delivery](https://mobbin.com/flows/b423d9b5-4f78-4fac-81ce-0766e0773eed) | "Manage your order · Edit by 12am on Wednesday, Jan. 29" lists Address, Delivery Date, View payment details and (in red) Skip delivery. The week tabs at the top carry status dots, and a skipped week shows a red ✕. | The per-date sheet holds **address and date together** (exactly Catera's two editable fields), and the cutoff sits in the header. |
| Blue Apron | [Account settings](https://mobbin.com/flows/66e47e54-97fd-4e0c-a359-8d509db9f3b6) | Plan type, Recipes per week, Delivery day, and **"Changeable before 12am on January 29th (for your February 3rd delivery)"**. | The cutoff is spelled out with the delivery it affects. |
| Dave | [Pausing membership](https://mobbin.com/flows/a8a463dc-623f-4b47-a3e0-9945451d28d0) | One "Pause membership" link. The paused state shows a PAUSED badge and the text **"By resuming, Dave will charge $1 per month … starting Oct 21"** above a Resume button. | Pausing and resuming are symmetric, and the money consequence is stated before the tap. |
| Amazon | [Subscription changed](https://mobbin.com/screens/d53fd3af-3219-483a-975c-b50ac9e35525) | A confirmation banner ("You have changed the delivery schedule…") above **"Next delivery will arrive by Saturday, September 20"** in large type. | After a change, it restates the result in the user's terms. |
| Thrive Market | [Autoship](https://mobbin.com/screens/028c8b56-4769-4a11-87d1-fa50324a4bf4) | A "Next Shipment · Thu, Jun 20 · Change Date" card with Upcoming Shipments and Manage Items tabs. | One card answers "when is next, and can I move it". |
| GoodRx / talabat | [Manage Gold plan](https://mobbin.com/screens/440942f2-dd10-41d9-9182-362b71f00591), [talabat pro](https://mobbin.com/screens/0fc07405-6d5f-48e7-b1eb-26bfbe35bc5f) | Sectioned plan pages: current plan, renewal date, price, duration, address, payment, then Manage rows. | Calm, scannable plan facts with actions at the bottom. |
| Duolingo / Peerspace / Runna | [Streak calendar](https://mobbin.com/screens/b7578a37-b5f0-4921-a9c2-3b42bad94eb9), [Calendar with legend](https://mobbin.com/screens/77d88766-7eff-42af-a88f-ee0ef10238a7), [Plan weeks](https://mobbin.com/screens/9eb278de-d059-4726-b181-8ec7d161ba4c) | Duolingo fills completed days on a month grid and marks the next milestone. Peerspace pins a colour legend over its calendar. Runna shows week cards with segmented progress ("Workouts 5/6"). | These are analogues for a delivery calendar with delivered, upcoming, moved and cancelled days, and for "Minggu 2 · 5/5 diantar". |
| Glovo / Keeta / Careem | [Where should we deliver?](https://mobbin.com/screens/6672660e-da7d-4a32-8885-f582fb34bfb2), [Address details](https://mobbin.com/screens/65138b4c-2465-4750-b346-f97fe4a2eedc), [Saved addresses](https://mobbin.com/screens/e626f944-516b-4c59-be58-6a204d1944b0) | Saved addresses show labels and notes. Keeta adds instruction chips (Hand it to me, Leave at a spot, Front door, Lobby, Front desk) and labels (Home, Work). | For "Ganti alamat untuk tanggal ini", pick a saved address in one tap. Instruction chips suit Indonesian kos, offices and gated housing (titip satpam, resepsionis). |

### What Catera should take

- Tapping any date (on Beranda or Jadwal) opens one **"Atur pengiriman"** sheet with the cutoff in the header ("Bisa diubah sampai Selasa, 18.00"). It offers **Pindah tanggal**, **Ganti alamat**, **Lihat menu**, and, last and lowest in emphasis, **Batalkan hari ini** if the product allows it.
- **Pindah tanggal** shows only valid dates as tiles (HelloFresh). Afterwards, restate the result: "Makan siang Rabu dipindah ke Senin 20 Okt" (Amazon).
- After the cutoff the sheet stays readable but locked, with a reason: "Sudah lewat batas ubah. Hubungi katerer." Do not hide it.
- Jadwal uses a month grid with four day states plus a pinned legend (Peerspace). Remaining portions read as "12 dari 20 tersisa" with a segmented bar (Runna) rather than a percentage.
- Pause: PRODUCT.md has no pause concept (purchases are immutable and dates move individually). Do **not** add a pause button just because subscription apps have one. If it is ever added, copy Dave's symmetric "what happens when you resume" text.

### Anti-patterns

- Blue Apron's cancel reasons are a list of 11 radios before the cancel button. Keep any reason prompt to one optional sheet (HelloFresh) and never block the action.
- Hiding skip, move and address changes in Profile or Settings. Changes belong on the date card.
- Calendars without a legend, or colour as the only state signal. Add icons or patterns too (✓ delivered, ↷ moved, ✕ cancelled).

---

## 4. Weekly menu display and optional dish choice

### References

| App | Screen / flow | What it does | Why it works |
|---|---|---|---|
| HelloFresh | [Menu flow](https://mobbin.com/flows/800eaca2-42f6-4935-af3c-55342c69704a) | "**We picked 3 meals we thought you'd like**" (pre-selected), with Change meals as the button. The week strip has a highlighted current week and a "Past orders" link. | A default selection means nobody is ever stuck with an empty box. Choosing is optional. |
| Centr | [Day plan](https://mobbin.com/screens/705eaf3c-a294-402a-abd2-870d1eb06136) | A horizontal day picker (Mon 3 … Sun 9), then meal cards (photo, meal type, title) with a swap ⇆ icon and a ✓ when done. | Day first, then meals. The swap affordance is per meal. |
| Wabi | [Week plan](https://mobbin.com/screens/a6147a60-54d3-46a6-9e80-4a6949846227) | A day heading (Monday), then cards labelled BREAKFAST / LUNCH / DINNER, each with a title, description and photo. | A readable, editorial week view with the meal slot label above the dish. |
| Crouton | [Meal plan](https://mobbin.com/screens/9b50fe08-30e6-4bd5-9e0b-265869f53c85) | Empty days show "No recipes" inside the day card, not an error. | A model for Catera's honest "Menu belum ditentukan" state. |
| Cherrypick | [Handpicked menu](https://mobbin.com/screens/27230a79-d688-4f81-9c99-1cfb884905e6) | Pre-picked meals, each with a rating and time, a thumbs-down to swap and a serving stepper. "Add another meal" sits at the top. | Pre-filled choices with low-effort edits. |
| Wonder | [Menu week selector](https://mobbin.com/screens/d518d0f1-4759-4bb3-aa70-c79e564167a2) | A "View menu" sheet: "Apr 14 – Apr 20 · Earliest delivery by Fri, Apr 18" versus the next week. | Switches weeks without losing context and states availability on each option. |

### What Catera should take

- Menu is a **view of the schedule**, not a separate catalogue. Use a day strip (Centr) or a week list (Wabi) with a slot label (Makan siang / Makan malam), a dish photo and the category composition (Nasi, Lauk, Sayur …).
- For "Pilih menu sendiri" packages, make the default explicit: "Belum memilih? **Katerer memilih** untuk kamu". Show a per-date "Pilih menu" CTA with the cutoff ("Pilih sampai Senin 18.00"). Never block delivery on an unmade choice; this matches PRODUCT.md.
- Missing menus render calmly as "Menu belum ditentukan · katerer akan mengisi" (Crouton).

### Anti-patterns

- Blue Apron and HelloFresh menus are full of filters, price per serving, calories and protein options. That is too dense for a fixed-package customer. Show the dish, its photo and its components, and move nutrition into an expandable section.
- Mixing add-on shopping ("Desserts & Treats", the HelloFresh "Your Order" screen) into the menu.

---

## 5. Discovery of meal plans and caterers

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| Gojek GoFood | [Explore](https://mobbin.com/screens/642e7023-1034-44a4-8ccb-49c79a7fa3b1), [Cuisine grid](https://mobbin.com/screens/346c5b1f-2c9d-4dce-a833-57c52454fc91) | Intent tiles in Indonesian commerce language: "Less than 25k", "Healthy food", "Wholesome lunch", "Juara Lokal Tangerang", "Near me", "Best sellers". There is also a full-bleed photographic cuisine grid (Rice, Bakso & soto, Chicken & duck …). | These are the local mental models: price bands in "rb", local champions and lunch intent. Food photography does the navigation. |
| Gojek | [Filter restaurant](https://mobbin.com/screens/dd29e7b9-1c32-4487-81a7-cedc0fb99d0d) | A bottom sheet: Sort (Near me), **Price range as concrete Rp bands** ("Below Rp16.000", "Rp16.000 to Rp40.000" …), ratings 4.0+ / 4.5+, then Clear filter and Apply. | It uses concrete rupiah ranges instead of $$$ symbols. |
| Too Good To Go | [Browse](https://mobbin.com/screens/b344c8f3-d912-47b1-a22e-800c13da94bc), [Discover](https://mobbin.com/screens/1c9bd47f-c101-488f-b6ff-edbe91e1372b), [Item detail](https://mobbin.com/screens/8a21d6e3-8222-4bd5-ad36-781aad767b8e) | Each card has a large photo, the store logo, a "Pick up tomorrow 12:00 – 12:15" line, distance, a struck-through price and the real price, plus "Selling fast" and "Local Heroes" carousels. The detail page shows "3 left", pickup instructions, packaging, an **Ingredients & allergens** accordion, and a sticky price with Reserve. | It is the closest analogue to small local food sellers. The card carries "when you get it" as a first-class line, and scarcity is honest. |
| Zomato | [Home](https://mobbin.com/screens/b2ad718c-1c99-4d69-816c-f5ee8b5192d9) | Chips for "Under ₹200" and "Schedule", plus a persistent **Veg mode** toggle. | A one-tap diet mode, analogous to a Catera "Halal / Vegetarian / Tanpa pedas" chip. |
| Grab / foodpanda / Swiggy | [Grab store](https://mobbin.com/screens/d8be8bcd-8286-4333-b0dc-dc4a03bd04e6), [foodpanda store](https://mobbin.com/screens/dda4e732-2312-4f2c-9364-d05dca714182), [Swiggy store](https://mobbin.com/screens/fb0a0295-b060-456e-9cc0-0f900296ccac) | Store pages with a hero food photo, rating, distance, "Order for later", **"Your last order" / "Previously ordered" / "Want to repeat?"** and trust seals ("Swiggy Seal"). | A caterer profile should lead with food, show trust and distance, and let a returning customer repeat. |
| talabat / Blank Street | [Choose your plan](https://mobbin.com/screens/af4c6e5e-c1e6-4421-9d3d-49e4a674cc87), [Membership options](https://mobbin.com/screens/6216f331-3ced-4bc4-8044-08a4c9f56f68) | Two or three radio cards, each with its price per unit and what is included. | A model for picking a duration (1 to 6 cycles) on the package page. |

### What Catera should take

- Package cards are **food-led**: dish photo first, then caterer name and area, then "Rp25.000/porsi · Makan siang Sen–Jum · 2,1 km", then the next possible start date (the TGTG "Pick up tomorrow" line becomes "Mulai paling cepat Senin 13 Okt").
- Filters use concrete rupiah bands per portion, area or distance, meal (siang/malam), and diet chips (Halal, Vegetarian, Rendah gula). Keep it to one sheet with Reset and Terapkan.
- The package page shows a sample week menu with photos, the category composition, the caterer's mini profile, delivery area and days, the duration options as radio cards with savings, and a sticky "Rp… · Pilih paket".
- Comparison: Mobbin has no strong mobile compare pattern. The pragmatic version: save packages (heart), then compare two or three side by side from the saved list on price per portion, days, area and sample dishes. Do not add a compare checkbox on every card.

### Anti-patterns

- Banner carousels and promo stacks at the top (GoFood, Careem, foodpanda, Glovo "Copa Mundial"). PRODUCT.md disables temporary promotions, and a caterer marketplace with ads pushes food down.
- Abstract "$$$$" price symbols.
- Map-first discovery. Optional only (TGTG's Map FAB is good as a secondary entry).

---

## 6. Checkout for a multi-day plan

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| HelloFresh | [Your Plan summary](https://mobbin.com/screens/7c75827c-a626-43d1-b70f-288c2f35e1f1), [Delivery date picker](https://mobbin.com/screens/624fdb66-0a31-4b2c-869e-b33710e41a43) | "3 recipes for 2 people per week", then "**6 total servings at $5.49 per serving**", then a box total. The start date is a bottom-sheet calendar headed "Does this delivery date work for you?" with past dates disabled and the earliest date highlighted. | Unit price and multiplication are visible, and the start date is a single focused question. |
| Blue Apron | [Meal stepper](https://mobbin.com/screens/97992bb9-58eb-40e0-9208-496d9a5e1134), [Price drawer](https://mobbin.com/screens/40224756-30c4-4203-8415-573d84f97c6b) | A quantity stepper with a "5% savings" tag and a collapsible bottom price drawer ("~~$35~~ $34", line items). | The savings tag sits next to the control that earns it, and the breakdown is available without leaving the step. |
| Grab | [Checkout](https://mobbin.com/screens/502d8c52-1eff-4a31-a177-f67ed93ccadf) | A sticky footer with **"Rp55.000 · See Breakdown"** and a primary button. | Rupiah total always visible, details on demand. |
| Careem / Instacart | [Payment summary](https://mobbin.com/screens/575ecfc4-076b-4db5-9d30-414a0ae47ddd), [Review](https://mobbin.com/screens/a58b6f44-933b-48a8-98b8-f25388694a97) | Line items, "saved on this order", a pay button carrying the amount, and the address and schedule above the summary. | One review page. The CTA states the amount. |
| Gojek | [Select payment method](https://mobbin.com/screens/72d14bb1-2e8d-41fe-8cbb-b1b92d870530) | GoPay with "Low Balance: Rp1.100 · Top up", a card, **BCA Virtual Account** and **CIMB Virtual Account** as radios, and "Add methods" below. | This is the Indonesian standard: e-wallet, then VA by bank, with low-balance warnings inline. |
| Grab | [Payment methods](https://mobbin.com/screens/73a19673-a57c-40f0-810d-8cb447d6230d) | **QRIS** is promoted at the top ("Scan … QR to pay"), followed by linked methods and add methods (OVO, LinkAja …). | QRIS as a universal first option suits a customer who has any banking or e-wallet app. |
| Gojek | [VA pending payment](https://mobbin.com/screens/0091869f-82e7-4e3a-bceb-0990eecf5c28) | The VA number in a large tappable "Copy VA number" block, **"Pay before Wed, 03 Jul, 16:09" with a countdown 01:59:30**, a "How to pay with virtual account" row, the payment detail, and Cancel. | Everything needed to pay from another app is on one screen with a clear deadline. |
| Shopee | [VA instructions](https://mobbin.com/screens/490cbd06-f329-43c7-adb2-ac1c8bc18507) | The account number with COPY, "will take less than 10 minutes to verify", and numbered per-bank steps in an accordion. | Per-bank instructions remove the "how do I do this in BCA mobile?" support load. |

### What Catera should take

Use **one review screen, not a wizard**:

1. Package and caterer (photo).
2. Duration as radio cards (1 to 6 cycles, with seller savings shown as "Hemat Rp…").
3. Start date as a sheet with only eligible dates ("Mulai Senin 13 Okt · 20 hari makan siang, selesai Jum 7 Nov"). Offer an optional "Lihat semua tanggal" preview of the generated dates.
4. Address (pick a saved one, or add one here only).
5. Price breakdown: "20 porsi × Rp25.000", the duration discount, and the total.
6. Payment method: QRIS first, then e-wallets, then VA by bank.

The sticky footer reads "Total Rp480.000 · Bayar". After it comes a pending-payment screen in the Gojek VA style, with the countdown and copy button, plus QRIS save/share-image for paying from another phone. A success screen restates the first delivery date.

### Anti-patterns

- Shopee [payment method list](https://mobbin.com/screens/16822719-924b-4973-86bb-20e8e171e9dc): many options mixed with PayLater upsell banners and Activate buttons. Show three or four relevant methods, with the rest under "Metode lain".
- Hiding the per-portion price, or showing only a total. Multi-day buyers need "× hari × porsi" spelled out.
- Requiring account creation before price is visible.

---

## 7. Help, report a problem, refunds

### References

| App | Flow / screen | What it does | Why it works |
|---|---|---|---|
| DoorDash | [Reporting an issue](https://mobbin.com/flows/2cc3e0a4-2c39-4d3b-a8a8-01f70e549609) | Help is scoped to the order ("Subway · 17 January"). **"What do you need help with?"** lists: someone else's order, never arrived, quality issues, missing or incorrect item, arrived late, something else. The details screen has a description field (required) and Add Photo. The **Resolution** screen states the outcome, including an honest denial ("Issues reported more than 24 hours after delivery aren't eligible"). | Issue types match real failure modes, the flow is three steps, and the outcome is explicit with the rule that caused it. |
| foodpanda | [Get help with orders](https://mobbin.com/flows/ed081ede-ec5e-4a70-bbfa-d590738c44a8), [Giving feedback](https://mobbin.com/flows/57c8c396-5602-4a55-bc50-9a35862b3c4b) | Upcoming / Past tabs, then the order, then issue rows (poor condition, payment or refund inquiry). The photo upload has a privacy note ("make sure no personal information… is in this photo"), followed by a thank-you screen. | Order-first help, and the photo-evidence privacy hint is a good touch. |
| Postmates | [Help](https://mobbin.com/flows/12ce7da9-5889-4de1-8470-8ce05326e09b) | A chat-like help screen pinned to the order ("We delivered your order: Yesterday at 3:34 PM · Details") with quick-reply issue chips. | Conversational, but structured. Works for users used to WhatsApp. |
| 7-Eleven | [Report an issue](https://mobbin.com/flows/4d23bdc2-dde5-4f4b-bfb7-e76c70049093) | Select items, a quantity stepper, issue radios (incorrect, missing, quality, damaged), then a description plus one required photo. | Simple radios, and the photo is required only where evidence matters. |

### What Catera should take

Put **"Ada masalah?" on every delivered or late day card**, not only in Akun.

The issue list maps to catering realities: *Makanan belum sampai*, *Terlambat*, *Porsi kurang / lauk tidak lengkap*, *Makanan basi / rusak*, *Salah alamat*, *Lainnya*. Then comes an optional photo (required for spoilage), a short note, and submit. The customer then sees a ticket status card on that day ("Dilaporkan · menunggu katerer · biasanya dibalas < 2 jam"). The resolution is stated plainly: a replacement date, a refund to the original method, or a rejection with its reason.

The help hub in Akun lists open reports and an FAQ, with contact-caterer as a fallback.

### Anti-patterns

- A generic help center first (the foodpanda Help Center with banners). Always start from the specific delivery.
- Vague "we'll look into it" with no status, or a silent denial. Show the rule (DoorDash's 24h window) at the time of reporting, not only after.

---

## 8. Renewal, reorder and end-of-plan moments

### References

| App | Screen | What it does | Why it works |
|---|---|---|---|
| Uber One | [Renew banner](https://mobbin.com/screens/187ba480-60f6-4c72-ade2-8dd72fd53e55) | A yellow card: "Uber One expires in 20 days. Renew to keep saving. **You'll be charged $9.99 on Mar 31, 2026 when you renew**", with a Renew pill. | Lead time, exact amount and date, and one button. |
| Cash App | [Service ending](https://mobbin.com/screens/4a2ce607-549c-45a1-b03b-fb5d159504b6) | "You've canceled your service, but you can still use it until Sep 7", a "Keep your service" button, and a "Service ends Sep 7" tile. | States what is still available and when it ends, with no guilt. |
| GoPro Quik / Strava | [Renew](https://mobbin.com/screens/ce18fcf4-62a9-4617-932a-c78d0d04dc08), [Resubscribe](https://mobbin.com/screens/b05a266e-a1dc-4343-bea0-79169f5fdf7f) | A single "Renew: $6.98/month" or "Resubscribe Now" button in the plan card after the end. | The ended state still offers a one-tap path back. |
| Gojek | [History · Repeat](https://mobbin.com/screens/f5d0ed5e-8617-4a1c-89f6-8a6f8ef489bb) | A past order with "Completed", "Saved 28k", your review, and a **Repeat** button. | Reorder sits next to the memory of the meal and the user's own rating. |
| talabat / Subway | [Order again](https://mobbin.com/screens/522ccdcd-d9c5-43d7-bc88-ac1823de8b7f), [Order Again tab](https://mobbin.com/screens/98010620-99bc-4e54-ad5f-76eafd10fcb6) | Past orders with item photos and an "Order again" button. | Repeat purchase is first-class. |
| Bolt Food / Swiggy / Uber Eats | [Two-question rating](https://mobbin.com/screens/80c8db6a-1453-4afa-81c6-2b7ad1abd709), [Dish thumbs](https://mobbin.com/screens/b8df603c-43db-4e57-9412-5e7d6c3f6ccc), [Tags](https://mobbin.com/screens/8734b6a7-fc59-49e4-b02b-5f5caa67c462) | Bolt asks only "How was the food?" (stars) and "How was the delivery?" (thumbs). Swiggy adds per-dish thumbs, and Uber Eats offers quick tags. | Feedback costs 2 to 5 seconds. Ratings feed the caterer and help the renewal decision. |

### What Catera should take

Renewal is **explicit** in PRODUCT.md, so:

- From about 5 delivery days before the end, the Beranda plan card turns into **"Paket selesai Jumat 7 Nov · 3 hari tersisa"** with "Perpanjang paket", showing the exact price and the new start date ("Lanjut mulai Senin 10 Nov · Rp480.000").
- One tap opens the checkout review prefilled with the same package, duration and address. The customer only confirms payment.
- The last delivery day shows a small end-of-plan moment: "Terima kasih sudah makan bersama Dapur Bu Sri", a quick rating of the period (stars plus 2 or 3 tags), and the Perpanjang / Coba katerer lain choice.
- An ended plan stays in Jadwal and Akun as "Selesai" with **"Pesan lagi"** (Gojek Repeat).
- The same renewal screen opens from the WhatsApp renewal link.

### Anti-patterns

- Loss-framing and guilt screens: Photoroom ["Are you sure you want to lose your benefits?"](https://mobbin.com/screens/df59c27f-0f7b-4341-b328-38be64757482), Headway "WITHOUT PREMIUM, YOU LOSE", Yazio "Going so soon?". These do not fit a warm, local caterer relationship.
- Auto-renew defaults. They conflict with Catera's explicit renewal.
- Surfacing the renewal prompt from day 1 of the plan. It is noise until the end is near.

---

## Synthesis: design principles

1. **Today first, always.** Beranda answers three questions in order: what is coming today and where is it, what is coming next, and how much of my package is left. Everything else is secondary. (HelloFresh, Hims, Grab.)
2. **Every editable thing carries its cutoff.** Put "Bisa diubah sampai Selasa 18.00" on each date card and in each sheet header. After the cutoff, show it locked with a reason; never hide it. (HelloFresh "Edit delivery by…", Blue Apron "Changeable before…".)
3. **Act on the day, not in settings.** Tapping a day opens one sheet with Pindah tanggal, Ganti alamat, Menu and Ada masalah. Show only valid options, such as available dates. (HelloFresh Manage your delivery, Blue Apron Manage your order.)
4. **Content before identity.** WhatsApp invitation links show the caterer, package and next delivery before OTP. Phone plus a WhatsApp/SMS OTP choice is the only required step, and everything else is deferred. (Givingli, Binance red packet, inDrive, World App checklist.)
5. **Food leads, numbers clarify.** Dish photography carries discovery and menus. Prices always appear as concrete rupiah per portion with the multiplication spelled out, never as "$$$". (GoFood grids, Gojek Rp filter bands, HelloFresh per-serving.)
6. **Honest, coarse statuses over fake precision.** Use Disiapkan, Diantar and Sampai with a delivery window and optional timestamps. No live countdowns a home caterer cannot back. (Walmart, Bolt timeline vs Wolt countdown.)
7. **Defaults that keep food coming.** Unchosen dishes fall back to "Katerer memilih", and missing menus read "Menu belum ditentukan". Nothing blocks a delivery the customer already paid for. (HelloFresh pre-picked meals, Crouton empty days.)
8. **Confirm changes by restating the outcome.** After any change, say what will now happen in plain words and update the card in place. Make reversible actions reversible until the cutoff. (Amazon, HelloFresh Unskip.)
9. **Local payment reality.** QRIS first, then e-wallets, then VA by bank. A pending-payment screen gives the deadline, countdown, copy button and per-bank steps. Show the total in rupiah in a sticky footer. (Grab QRIS, Gojek VA, Shopee instructions.)
10. **Help is attached to the delivery.** "Ada masalah?" lives on the day card, uses catering-specific issue types and takes three steps or fewer. It ends with a visible status and an explicit resolution, including the eligibility rule. (DoorDash, foodpanda, Postmates.)
11. **Renewal is explicit, timely and calm.** Prompt only near the end, with the exact price and new start date, prefilled in one tap. No guilt copy and no auto-renew. (Uber One, Cash App, Gojek Repeat.)
12. **No ads between the customer and their meal.** Discovery, promos and cross-sell never appear inside today's card, the tracking view or the menu of a purchased package. (Counter-examples: Grab tracking ads, HelloFresh in-box upsell.)

---

## Suggested information architecture

The current PRODUCT.md shell is **Beranda · Jelajah · Jadwal · Pesan · Akun**. Recommendation: **four tabs, with an adaptive Beranda**, and Pesan moved into context.

| Tab | Purpose | Contents |
|---|---|---|
| **Beranda** | "What is happening with my food", the default landing | The today card (status, address, Ada masalah), the next 3 to 5 days with cutoffs, and the plan card(s) with "x dari y porsi tersisa" and renewal at the end of a plan. A bell/inbox icon in the header (with badge) for notifications and caterer messages. **With no active package**, Beranda becomes a discovery-first page: "Katering di sekitar kamu" plus the claim/invite entry. |
| **Jadwal** | The schedule across all caterers | A month grid with a legend (delivered, upcoming, moved, cancelled) and the day list. Tapping a day opens the Atur pengiriman sheet. A segmented control **Kalender / Paket** holds "Paket saya" (active, pending payment, ended with Pesan lagi). Per-day menu and dish choice live here. |
| **Jelajah** | Find a new package | Food-led feed, Rp-band, area and diet filters, saved packages with Bandingkan, caterer profiles and package pages. |
| **Akun** | Everything rare | Profile and phone, Alamat tersimpan, Pembayaran & riwayat transaksi, Bantuan (open reports and FAQ), notifications, language. |

### Rationale

- **Four tabs instead of five.** Subscribers open the app daily for two things: today (Beranda) and dates (Jadwal). Discovery is occasional, and settings are rare. The meal-subscription references keep tab bars small (Hims 4, Too Good To Go 4). HelloFresh's 5 tabs include low-value Notifications and HelloFriends tabs, which shows the cost of spending a tab slot.
- **Pesan as context, not a tab.** Caterer conversations relate to specific days (a menu question, a late meal), and many customers already talk to their caterer on WhatsApp. The entry points are a header inbox with a badge, plus "Hubungi katerer" inside each day sheet and each report. If production data shows heavy two-way messaging, Pesan can return as a fifth tab without changing the rest.
- **The adaptive Beranda serves both entry paths.** A WhatsApp-invited customer lands on the package they already own. A marketplace newcomer lands on food. The same tab serves both without a "mode".
- **"Paket" inside Jadwal, not its own tab.** Purchases are immutable terms whose only living surface is dates. Grouping them with the calendar keeps "what did I buy" next to "when do I get it", and renewal also appears on Beranda when relevant.
- **Bantuan stays reachable in two ways.** Contextually from any day ("Ada masalah?") and centrally in Akun for open tickets. Never rely on the central path alone.
