# Apps UX: Mobbin reference research (2026-11-15)

Scope: the ten pain points from `2026-11-13-apps-ux-audit.md`, checked against iOS references on Mobbin. Every screen below was viewed, not described from metadata. "Catera status" compares against the audit plan and design drafts (Beli pin step, Dapur Menu first editable day, Pelanggan search and renewal, guest Jadwal/Akun, Bayar, Hari ini density, small fixes). I judged status from those drafts and the recent commit log, not by re-running the apps, so treat "already does" as "per the draft".

Searches: 14 screen searches, standard first, deep for merchant, menu, calendar and planner queries where standard was off-target. No connector errors. Merchant-side references are thin: Mobbin holds few restaurant-partner apps, so merchant patterns lean on Shopify, Shopee seller, Whatnot, Partiful and Luma.

## 1. Checkout when a required setup step is missing (address pin)

- [Wolt Delivery checkout](https://mobbin.com/screens/7bab1305-1a6c-4891-ab83-d60bafdb28fd?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a map card sits at the top with an "Adjust pin" chip on the map itself. The address row below shows the saved label; the pin is an inline refinement, not a gate.
- [talabat checkout](https://mobbin.com/screens/4918cd52-367d-4da3-9ad9-e381ddeba895?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): map plus address card with a text "Change" link, then delivery ETA, tip and instructions. The map is always shown, so a pin is never "missing", only editable.
- [Glovo checkout](https://mobbin.com/screens/222ec9c4-d996-4e6e-b250-e3e984534809?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): address, courier note and a greyed "Add your phone number" row with a helper line ("We'll send you a message to validate it"). The missing item is a normal grey row with a reason, not a red error.
- [Swiggy address form](https://mobbin.com/screens/e09ef13b-dd58-4956-9fb5-a862dfd610c5?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a read-only "Area" box shows the address text with a map thumbnail and a "Change" link beside it.

Takeaway for Catera: Show the map card (or an empty map placeholder with "Tandai titik di peta") as the first block of Beli, and keep price visible. Make the CTA read "Tandai lokasi" until the pin exists, then "Bayar". Status: the audit draft 1 already does the step and CTA swap (partly built); confirm the price still shows while the pin is missing, and add the "Adjust pin" chip on the map for already-pinned addresses (misses).

## 2. Signed-out or empty tabs

- [talabat Orders empty](https://mobbin.com/screens/909e8614-fb73-4493-a392-c1f0b0f4aaec?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): illustration, one line of what appears here, an outlined "Start ordering" button, plus a membership upsell strip pinned above the tab bar.
- [Shop Orders](https://mobbin.com/screens/8c01f92d-fd68-4144-9106-b5fae2ad6fd8?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a single card with art, a benefit headline ("Track all your orders here"), a filled primary "Connect account" and a quiet secondary action.
- [Glovo Orders](https://mobbin.com/screens/da262c29-437a-41e0-8772-dba9bfb55ce9?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): even with nothing active it shows a "Track your orders" card, then a "Continue your order" cart row and a "review past orders or reorder" prompt, so the page is never blank.
- [Blue Apron Orders](https://mobbin.com/screens/576a73a7-2d9a-49c3-99c1-a1ac6cd088ab?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): bare icon and two lines; this is the weak baseline Catera should beat.

Takeaway for Catera: Guest Jadwal and Akun become a card: art, one benefit headline ("Lihat jadwal makan dan atur pengiriman"), two or three icon bullets, filled "Masuk" and quiet "Lihat paket". Add a secondary shortcut to Jelajah so the tab is never a dead end. Status: audit draft 2 covers this (partly built); add the browse shortcut and a persistent card rather than a text line (misses).

## 3. Pay-now screen with hold timer and summary

- [talabat "One last check"](https://mobbin.com/screens/4ca29a5c-ab19-4bbc-a173-601d3cbe6daf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a short card (address, item, card) and a thin progress bar above a countdown inside the secondary button ("Edit order (00:01)"), with one orange primary "Looks good".
- [Trainline payment](https://mobbin.com/screens/d298edad-9a0e-4d99-9678-c887964f0acf?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a blue note inside the order card states "Price and seats locked in basket until today 10:50pm", an absolute deadline in context rather than a ticking clock.
- [Glovo summary](https://mobbin.com/screens/18097b95-0788-49bc-94f8-eaba8ea8c763?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a clean ledger (products, promotions, delivery with strike-through, fees, total in large type), a green "You're saving" chip, legal line, one full-width primary.
- [Fresha review and checkout](https://mobbin.com/screens/4d4c3586-75d9-4618-a378-bf24e82b856f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): recurring-charge copy ("Renews monthly until cancelled") under the total, and a sticky bar with item count, price and a single "Pay now".

Takeaway for Catera: Bayar gets one primary button, an order summary card on top (package, days, dates, address), the hold expiry as a single line ("Selesaikan sebelum 14.35") with a thin progress bar, and a ledger with the total in large type. Status: audit draft 3 does one action and a summary (partly); the absolute-time expiry line and the thin progress bar need checking (misses).

## 4. Weekly menu and meal planning

- [HelloFresh My Menu](https://mobbin.com/screens/20a26e73-5743-4568-84b9-43c9eeb991be?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a date strip across the top (Past orders link, then upcoming weeks), the selected week's "Edit delivery by" deadline in a banner, "We picked 3 meals" with a primary "Change meals" and a cart badge.
- [HelloFresh skipped week](https://mobbin.com/screens/b245a59a-17ba-4f63-8631-dd050a7f5788?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): Home lists weeks as stacked cards: "Skipped" with a red Unskip, "Coming up" with "Edit delivery by Saturday". Cut-off date is always shown beside the action.
- [Runna training calendar](https://mobbin.com/screens/78f33f57-7f21-402b-8051-9bce15e29d07?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a planner week with a "WEEK 2" badge and total, empty days as quiet "+ Add" rows, a "Reset" action, and the prior week above as a compact filled list. Closest analogue to Dapur planning.
- [BitePal meal plan](https://mobbin.com/screens/6fe19c81-cca8-4b7a-a83c-924360c77685?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): day strip with the selected day inverted, meals grouped under Breakfast/Meals/Snacks with thumbnails, a "Grocery list" shortcut in the header.

Takeaway for Catera: (a) Customer: put the change deadline next to the action ("Ubah sebelum Sabtu") and a "N dari M hari terisi" count. (b) Dapur Menu: header with week badge and fill progress ("3/5 hari terisi"), empty days as one-line "+ Isi" rows, a "Salin dari minggu lalu" action in the header, and past days as a compact filled list. Status: opens on the first editable day (just built); progress, copy-from and compact past days partly or not done (misses copy-from).

## 5. Merchant customer list

- [Shopify Customers](https://mobbin.com/screens/8d012513-7214-4c00-935d-aaa2307452f9?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): search field with a sort icon, rows with a green "Subscribed" status pill, spend and order count, and a note line.
- [Shopify Orders](https://mobbin.com/screens/67520e8c-0f26-44a6-ac5a-b2690d3aa1c1?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): one chip row (All, Unfulfilled, Unpaid, Open, Archived) scrolls horizontally with a filter-count badge on a separate icon; chips never overlap.
- [Partiful Manage Guests](https://mobbin.com/screens/266e1f65-fd5e-4391-8290-633001a292c7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): search, count-tagged status chips (Approved 1, Pending 1, Waitlist 0), per-row status dropdown, and a "Bulk actions" sheet (approve all pending, download CSV).
- [Luma New Blast](https://mobbin.com/screens/fb2ccbd7-04a5-432f-aadd-2718fdd60c4c?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): broadcast to all guests is a full-screen compose with one send arrow, no recipient picker.

Takeaway for Catera: Pelanggan gets search plus a single scrolling chip row with counts ("Perlu diperpanjang 4"), a status pill on each row, and a bulk-actions sheet ("Kirim pengingat ke yang perlu diperpanjang"), which opens a Luma-style one-field compose with a WhatsApp deep link. Status: search, non-overlapping chips and renewal on the list are just built; counts on chips and bulk reminders are missing.

## 6. Merchant "today" operations

- [Whatnot Seller Hub](https://mobbin.com/screens/3d9cd38b-74bd-4443-aba7-471f838e791b?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Today's Tasks" card ("You're all caught up"), a setup progress bar with "Step 3 of 4", then Upcoming Shows with inline Add and Share actions.
- [Shopee seller My Shop](https://mobbin.com/screens/61a30fb5-e1b0-424d-a460-8d3f4f1df3b7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Order Status" is a four-tile count row (To Ship, Cancelled, Return, Review), then icon shortcuts and a daily mission with a progress bar and a Start button.
- [Wonder pickup tracker](https://mobbin.com/screens/ccdc93b4-09b0-4e21-bc67-572651ec59e9?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a compact three-step progress bar (Received, Preparing, Ready) in a dark pill, a dense status component that can sit atop any list.
- [Vestiaire sell checklist](https://mobbin.com/screens/cc1332e3-daa4-4380-84d9-717988b85c32?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): green checks per step, one numbered open step, and a disabled sticky primary until all are done.

Takeaway for Catera: Hari ini opens with a compact counts row (Masak 12, Antar 9, Selesai 3), a step bar (Masak, Kemas, Antar), then the cooking checklist with the sticky primary at the bottom ("Mulai antar" enabled when all cooked). Status: audit draft 6 gives the cooking list more room (partly built); the count row, step bar and gated sticky action are missing.

## 7. Subscription home after purchase

- [Blue Apron Upcoming Orders](https://mobbin.com/screens/d1a35bd9-27c7-4dde-b80f-c96699e5a286?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): one card per delivery date, a four-step tracker (Confirmed, On the way, Out for delivery, Delivered), the estimate, and a single dish thumbnail for the contents. Upcoming and Past tabs split the list.
- [Ro Manage subscription](https://mobbin.com/screens/640c3c2d-a5bd-4f9a-b583-69135635d453?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a flat key-value list (frequency, address, billing, next charge date), each row with its own small Update or Edit button.
- [Swiggy Home with live order](https://mobbin.com/screens/f1b033c4-2764-4a65-b045-9ee2c7affdb2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a floating "Preparing your order, 29 mins" bar above the tab bar keeps the active order one tap away from any home state.
- [Shop Orders](https://mobbin.com/screens/3fea0af7-4ca1-4974-a81c-4dd695f0acda?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): the active delivery is a hero card with a segmented progress bar; past orders collapse to a single one-line row.

Takeaway for Catera: Keep the tracker hero, but collapse the per-day rows into one row per day with a thumbnail strip of that day's meals and a "N hari lagi" tail, and show only the next three days with "Lihat semua". Move subscription facts (alamat, jadwal, perpanjang) into a Ro-style key-value list. Status: tracker already done; per-day merge is in the small-fixes list (partly).

## 8. Calendar with past deliveries

- [HelloFresh date strip](https://mobbin.com/screens/20a26e73-5743-4568-84b9-43c9eeb991be?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): past weeks live behind one "Past orders" text link at the left of the strip; the strip itself shows only future weeks.
- [HelloFresh delivery date picker](https://mobbin.com/screens/624fdb66-0a31-4b2c-869e-b33710e41a43?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): unavailable dates are greyed with no tap target; the one selectable date is filled green with a caption below.
- [Pliability calendar](https://mobbin.com/screens/c9360790-e638-4dae-b3cf-cf6887db0d83?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): month grid with a "Day Selected, Total time" summary line and a Completed Sessions list underneath for the tapped day.
- [Amazon monthly delivery day](https://mobbin.com/screens/10ddbeae-7ca5-42f7-a0cb-39c872db47cc?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): past days are plain, the current and selected days carry a dot or fill; no per-day placeholders.

Takeaway for Catera: Collapse every past day with no content into one line "5 hari lalu, semua terkirim" that expands on tap; list only days that had something notable (diganti, dilewati). Grey past cells in the grid without placeholders. Status: Jadwal past-day collapse is on the small-fixes list (misses today).

## 9. Renewal and expiring prompts, customer side

- [Swiggy One expired](https://mobbin.com/screens/638c0322-24d0-457e-87d1-fa7ddd09fba2?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "Membership ended on 12 Aug" with a red EXPIRED chip, a green card quantifying savings from the last period, and a sticky "Renew One at 1 for 3 months" under "Don't break your savings streak".
- [Tolan Membership](https://mobbin.com/screens/e9a8361a-1bd2-4f8d-b453-9ca01eeaaecc?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a red "Plan ends today" pill on the current plan card and a "Stay on Lite" primary.
- [Insight Timer trial reminder](https://mobbin.com/screens/6dbe8849-58b3-44ff-a86e-eb56b2c48e9f?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): "We'll remind you 2 days before your trial ends", stating the notification date and charge date up front.
- [Shopify Plan](https://mobbin.com/screens/dbc0e8e0-161d-46f0-bda4-24c0664889f7?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): an amber warning bar at the top ("Store deactivates on Sep 2, 2026") with a "Reactivate plan" button directly under it.

Takeaway for Catera: On Beranda show an amber bar once 3 days remain ("Paket habis 20 Nov, 2 hari lagi") with "Perpanjang", a "Berhenti 2 hari" style pill on the plan card, and after expiry a recap card ("Kamu sudah makan 18 kali") with a sticky renew button. Status: the customer side has no renewal prompt in the audit (misses); the Dapur "Perlu diperpanjang" chip exists on the merchant side only.

## 10. Toasts and confirmation after saving inside a multi-step purchase

- [Swiggy address sheet](https://mobbin.com/screens/feffbc88-3202-4320-b9b1-0113c500f113?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): choosing an address is a bottom sheet over the checkout, with a green "SELECTED" tag on the chosen row; the sheet closes and checkout is just updated, no toast.
- [Tripadvisor](https://mobbin.com/screens/1f4eb824-1fba-42d1-bdde-23a41d4d7913?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a dark pill toast ("Saving post review questions...") floats near the bottom, away from the main content and the primary button.
- [Lloyds "What happens now"](https://mobbin.com/screens/335796af-76c2-450e-85ec-1a0d8cedcf99?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): for consequential saves, an explicit consequence screen with a tick and a warning, then "Confirm new address".
- [Waymo Save home](https://mobbin.com/screens/3d8fcf1b-dce6-4520-b096-c87e569a5d08?utm_source=claude&utm_medium=ai-assistant&utm_source_platform=mcp): a confirm button reading "Save home" (verb plus object), nothing after it but the return.

Takeaway for Catera: After saving the pin, return straight to Beli with the CTA already changed to "Bayar"; use the toast only for the transient "Titik lokasi disimpan", placed above the sticky bar and never over a section heading. Status: the toast overlap on the "Bayar dengan" heading is on the small-fixes list (partly).

## Top 10 changes worth making

1. Beli: map card first, price always visible, CTA "Tandai lokasi" then "Bayar", "Adjust pin" chip on map. (customer, M)
2. Dapur Hari ini: counts row, step bar, cooking checklist with sticky gated "Mulai antar". (Dapur, M)
3. Dapur Menu: week fill progress, one-line "+ Isi" empty days, "Salin dari minggu lalu", compact past days. (Dapur, M)
4. Customer renewal prompt: Beranda already shows a "Perpanjang / Tutup" card for an ending package (seen on the emulator 2026-11-13), so this is a refinement, not a gap: add days-left wording and a post-expiry recap. (customer, S)
5. Bayar: summary card on top, absolute expiry line with thin progress bar, ledger with large total, one primary. (customer, M)
6. Pelanggan: counts on chips, status pill per row, bulk "Kirim pengingat" sheet with WhatsApp compose. (Dapur, L)
7. Guest Jadwal and Akun: benefit card with art, bullets, "Masuk" plus "Lihat paket" shortcut. (customer, S)
8. Jadwal: collapse past days into one expandable summary line, grey past cells. (customer, S)
9. Home: one row per day with a thumbnail strip, next three days plus "Lihat semua", facts in a key-value list. (customer, M)
10. Toast placement above sticky bar and return-to-purchase with updated CTA after saving the pin. (customer, S)

## AI usage notice

No search result carried an `ai_usage_notice`, so there is no notice text to reproduce.
