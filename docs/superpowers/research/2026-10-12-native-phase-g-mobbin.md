# Native Phase G research (Mobbin), 2026-10-12

Scope: input for the owner's feedback of October 12, 2026 (items FB1 to FB11 in [the Phase G kickoff](../kickoff/phase-g.md)): button pending states, connection and error display, a delivery tracker with a stop per stage, a calendar for changing a delivery date, a buyer confirmation after the seller marks an order delivered, editing account details, and selecting several stops for a status change.

Method: Mobbin MCP `search_screens`, iOS catalogue, 7 queries, 47 screens viewed as images. Every link below goes to a screen that was viewed. Mobbin is iOS only; Android references come from Material 3 at design time. Screens are stills, so any claim about motion is an inference.

This document is input for design. It does not change PRODUCT.md or DESIGN.md.

---

## 1. Pending state on the button that was pressed (FB1)

| App | Screen | What it does |
|---|---|---|
| Booking.com | [Email step](https://mobbin.com/screens/b9e0d82e-6e8f-4376-890a-904802b194d4) | The primary button keeps its fill and size; the label is replaced by a small ring spinner in the label colour. |
| pliability | [Sign in](https://mobbin.com/screens/7b833136-0ff3-4898-a77a-0ba3365f86ac) | Same pattern on a black pill: label out, spinner in, fields stay readable. |
| Greenlight | [Sign in](https://mobbin.com/screens/e631b818-a3b9-4d38-9161-e250d852f177) | The button dims to its disabled tint and carries the spinner, so both "busy" and "not pressable" read. |
| Glassdoor | [Welcome](https://mobbin.com/screens/0b5bc1de-ba23-4f6f-bda0-c8bace827e6c) | Spinner inside the brand-green button; nothing else on the page changes. |
| Splitwise, Tesla | [Splitwise](https://mobbin.com/screens/7dffcbd3-b683-45f8-af52-fb30edcb4ee4), [Tesla](https://mobbin.com/screens/77f6ce8b-7877-49ea-94a3-f20b096ed498) | Counter-reference: the whole form fades under a centred spinner and a caption. This blocks the page and hides what was sent. |

**Take:** the pressed button carries its own spinner in place of the label, at the same width and height, and is not pressable while busy. The rest of the screen stays as it was. This is the "inline" tier already in DESIGN.md (Loading continuity), which names a busy Button that `packages/mobile-ui` never built.

## 2. Connection and error display (FB8)

| App | Screen | What it does |
|---|---|---|
| Sesame | [Offline card](https://mobbin.com/screens/2d85e6ae-5a90-44c0-9ceb-d0cff29fb561) | A card at the top of the content: alert icon, a bold title ("Oops, something went wrong"), one line of reason. |
| Alta | [Chat offline](https://mobbin.com/screens/2b00c4b9-d2a6-4a6a-9d95-2aba49348be1) | A tinted banner under the header, icon, title "Network offline. Reconnecting…", one line of consequence. The content stays below it. |
| Qantas | [Trips offline](https://mobbin.com/screens/18f77caf-19d5-4199-98b4-a36f34096d23) | Two layers: an empty state with an icon, title, reason and "Try again" where there is nothing cached, plus a snackbar for a failed refresh. |
| eBay | [Sheet load error](https://mobbin.com/screens/f4c64fdd-701e-4ddc-9f28-54d9cd5deda9) | Inside a sheet: retry glyph, one sentence, a "Retry" link, centred in the sheet body. |
| CHOPT, Freenow | [CHOPT](https://mobbin.com/screens/ebc40138-872c-4dab-b77c-1abed601374e), [Freenow](https://mobbin.com/screens/d156add0-4181-489a-8fb7-3afa0b008e96) | Full-screen illustrated error (a mascot in CHOPT's case) with title, reason and one action. Only where nothing can be shown. |

**Take:** three placements. When cached content stays on screen, a status banner at the top of the content (icon, title, reason, last update time, "Coba lagi"), never a caption further down. When nothing is cached, an error state in the place of the content (Catera already has puzzled-mascot art). When an action fails, the error goes beside that action as a callout with an icon, or in a toast with "Coba lagi" when the action has no form. Small danger text with no icon, placed somewhere loose on the page, is the pattern to remove.

## 3. Delivery tracker with a stop per stage (FB9, FB10)

| App | Screen | What it does |
|---|---|---|
| Keeta | [Delivering](https://mobbin.com/screens/35529fd4-0535-4e1f-b1d1-3d2eb1991b37) | Four filled circles, each with its own glyph (receipt, bag, scooter, person); the line is solid up to the current stop and pale after it. |
| Grab | [Out for delivery](https://mobbin.com/screens/bcfa763e-74d6-4b71-9add-b54464f5453f) | Glyphs ride the line (G, bowl, scooter, house); the done part is green, the rest grey; the current glyph sits at the end of the green. |
| talabat | [Order placed](https://mobbin.com/screens/16d8feef-1ce6-41cd-8e5e-5b3f7e1650fa) | The current stop is a filled orange circle with a check; later stops are grey glyphs on a dashed line. |
| Gopuff, Instacart | [Gopuff](https://mobbin.com/screens/111f57d1-be77-440b-b73d-e90380e2df30), [Instacart](https://mobbin.com/screens/20ea8783-b017-41c4-8977-02050fc0f587) | Four glyph circles on a thick line; Instacart draws the last segment partly filled, so the line itself shows progress between stops. |
| Zomato, DoorDash | [Zomato](https://mobbin.com/screens/fe76846f-66e6-4ab7-a673-8936d0ff9885), [DoorDash](https://mobbin.com/screens/8210b47b-9372-4add-9e71-b87192a8c239) | The segment after the current stop has a short bright highlight, which reads as moving (the live activity animates it). |
| sweetgreen | [Received](https://mobbin.com/screens/76e2f253-96bc-4199-9439-8c74a519e0ec) | Counter-reference: plain dots with text labels only. The current stage is hard to spot at a glance, like Catera's track today. |

**Take:** one stop per stage, each with its own glyph, including the first stage (Terjadwal), so the track moves at every change. Done stops are filled, the current stop is the most prominent, and later stops are outlined and muted. The line fills to the current stop. A short travelling highlight on the segment after the current stop (Zomato, DoorDash, Instacart) can show that something is happening; in Catera that is a loop, so it needs a ruling (see FB10 in the kickoff).

## 4. Calendar for changing a delivery date (FB6)

| App | Screen | What it does |
|---|---|---|
| Amazon | [Change your upcoming delivery](https://mobbin.com/screens/76488e1f-6ea2-454a-932b-940b4f598ef6) | Month grid with month paging. Days that cannot be picked are grey. The current day is outlined. A line explains the effect ("This will only affect your next upcoming delivery"). Confirm stays disabled until a new day is picked. |
| DoorDash | [Date to be sent](https://mobbin.com/screens/f57659c2-574c-483b-b623-0fc13904d938) | Month grid. Past days are grey, today is outlined, the chosen day is a filled disc, and one full-width button sits below. |
| Starbucks | [Select a delivery date](https://mobbin.com/screens/d6f4899c-0d12-411a-9202-f5a4cc2796e1) | The month grid sits inside a sheet, with the chosen day in the brand green, available days bold and unavailable days light. |
| Bolt | [Pickup time](https://mobbin.com/screens/5dcc73e9-b380-4509-b04f-e5c360d2f0ac) | A compact calendar popover from a date row, with its range stated above ("up to 90 days in advance"). |
| HelloFresh, Glovo | [HelloFresh](https://mobbin.com/screens/34f825b3-7689-4f74-b3e2-2faf2523532e), [Glovo](https://mobbin.com/screens/70c0c74a-741a-4b27-b0ef-ddac0983b377) | Counter-reference: date tiles or a horizontal strip, which work for about seven choices. They are close to Catera's chips today and scale poorly to a 30-day window. |

**Take:** a month grid in a sheet, paged by month across the allowed window, with unavailable days dimmed and a reason shown when one is tapped. The current delivery day is outlined, the chosen day filled, and a full-width "Pindah ke {tanggal}" button sits below. The Dapur free-text date field (`TTTT-BB-HH`) goes.

## 5. The buyer confirms after the seller marks it delivered (FB3)

The searches returned no direct Mobbin screen of a marketplace's "order received" confirmation (Shopee's and Tokopedia's buyer flows are not in the results). The closest patterns viewed were the timed confirmations of [Uber Eats](https://mobbin.com/screens/334e49f4-1244-4f38-9be5-b15f6516422c) and [Grill'd](https://mobbin.com/screens/f1357069-77cf-415f-85d1-086c7570035d), where a button shows a countdown before the order is placed, and the [Gopuff](https://mobbin.com/screens/2463ac0b-c9b3-4314-bf8e-32bcd78cd0ff) countdown ring. The owner's references are Shopee and Tokopedia themselves: the seller or courier marks the order delivered, the buyer presses "Pesanan Diterima", and the order completes on its own after a set time unless the buyer complains. That model is described from the owner's message, not from a viewed screen.

## 6. Editing account details (FB5)

| App | Screen | What it does |
|---|---|---|
| foodpanda | [Profile](https://mobbin.com/screens/3a4d3b90-bc2e-44cd-9ac3-69af2f43e1a8) | One card per field (Name, Email, Password, Mobile number), each with a pencil. "Verified" chips sit under email and phone. |
| Chick-fil-A | [Edit profile](https://mobbin.com/screens/c04369aa-6800-4aeb-9a02-836b3502aa8d) | Email and phone with "Verified" chips and a "Change" link each, plus a line explaining what a change affects. |
| Uber | [Phone number](https://mobbin.com/screens/567971ad-0424-48cf-b7b0-269a399bd93a) | A dedicated page for one field: why the number matters, the input, "A verification code will be sent to this number", then Update. |
| Booking.com | [Personal details](https://mobbin.com/screens/37ddf702-0b6a-4620-ac4d-bc354bd30b68) | A list of rows with chevrons, each explaining where the value is used. |
| Taco Bell | [Edit profile](https://mobbin.com/screens/c25bfec4-3adc-4891-82db-1e300c1ce6ff) | Counter-reference: one long form with every field and a legal paragraph. |

**Take:** a "Data akun" page of rows (Nama, Nomor HP, Email, Kata sandi when the account has one), each opening its own small form. Phone and email changes go through a code or a link to the new address before they take effect. Account deletion (a request) sits at the bottom of the page.

## 7. Selecting several stops for a status change (FB11)

| App | Screen | What it does |
|---|---|---|
| Shopee | [Edit products](https://mobbin.com/screens/2af849b4-9078-470b-a952-b02051269aea) | A circle per row, and a bottom bar with "Select All", a count ("0/2") and the actions. |
| GitHub | [Select items](https://mobbin.com/screens/5edb4b50-e0ce-4571-ac92-dc6af0f05cea) | Selection mode with Cancel and "Select all" in the bar, a circle per row, and bottom actions that stay disabled until something is selected. |
| Todoist | [2 selected](https://mobbin.com/screens/91160ad8-4c10-4abe-8ee0-d2909ec85b5f) | The large title becomes the count, selected rows are tinted, and the actions sit in a menu. |
| eBay, Yazio | [eBay](https://mobbin.com/screens/1436aec8-2fde-461c-abc0-33ab970e244f), [Yazio](https://mobbin.com/screens/0835e11c-8e55-4816-a1d1-cc3685444fac) | Checkbox rows with actions in a top or bottom bar. |

**Take:** Dapur's "Urutan antar" gets a selection mode. Each stop has a circle, the title shows the count, there is a "Pilih semua" (and per area, since stops are grouped by area), and a bottom bar holds "Berangkat (n)" and "Sampai (n)", disabled until something is selected. A stop that is already ahead of an action stays unselectable for it, with the reason shown.
