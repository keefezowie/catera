# Research: payment method choice and mascot space (2026-10-27)

Owner asks, from two device screenshots (Beli and an empty Beranda):

1. "Bayar dengan" is built as a toggle: one row, and "Ganti" flips QRIS and BRI VA. Two methods do not justify a toggle.
2. Across the customer app the mascot takes a lot of white space and adds nothing.

Mobbin, iOS, four searches (checkout payment row, payment method sheet, food-app home, home with mascot).

## Payment method

| App | Pattern |
| --- | --- |
| [Glovo](https://mobbin.com/screens/3e19608e-a585-40b1-b6f2-cd9aefc811aa) | Checkout row with the method; tap opens a sheet "Select your payment method" with radios. |
| [Careem](https://mobbin.com/screens/f641a718-b5dd-4f06-9621-0d21c1acce6b) | Sheet with radio rows and Confirm. The checkout shows the card beside Pay ([screen](https://mobbin.com/screens/575ecfc4-076b-4db5-9d30-414a0ae47ddd)). |
| [Uber Eats](https://mobbin.com/screens/7c20ffb6-6f98-4f69-ade8-efed3871d784) | "Pay with" sheet, check on the chosen row. Checkout row "Apple Pay ›" ([screen](https://mobbin.com/screens/cd54cfe3-1023-4967-b231-f78c74485c38)). |
| [TextNow](https://mobbin.com/screens/caeb9091-ca45-4034-8210-372f9f926ee8), [Transit](https://mobbin.com/screens/cfbaca83-cc3b-4992-ae30-3caf3bc31987), [Revolut Business](https://mobbin.com/screens/7dc63b57-aab3-41d1-aaf6-b52cb393691b) | Sheet with two or three radio rows, each with a one-line description (Revolut). |
| [Deliveroo](https://mobbin.com/screens/8e6edaaa-9cf5-469b-a8b3-cf4f6431402d), [Wonder](https://mobbin.com/screens/f74d0f4e-43d3-4322-9f17-3ecd9c7c2e3b), [Shopee](https://mobbin.com/screens/72d38405-0ccc-499a-b360-cf1de86d99d0) | Checkout row: method plus "Change" or a chevron. |
| [talabat](https://mobbin.com/screens/8d173165-5f03-4472-8954-480b9449ba3d), [Keeta](https://mobbin.com/screens/13bb736f-7e35-4130-8d0e-d76354821379) | Few methods: all listed inline on checkout with radios. |

Findings:

- No app switches methods with a button that flips to "the other one". The control is always a choice: radios, in a sheet or inline.
- The common pattern is one row on checkout (method, short description, "Change" or chevron) that opens a sheet of radio rows. It scales past two methods without a redesign.
- Apps with only a few methods sometimes show them inline with radios (talabat). That costs one extra 72 row on the page.
- Catera's Beli already uses the row-and-sheet pattern for Mulai and Diantar ke (`apps/customer/src/choice.tsx`, routes `/pembelian/mulai` and `/pembelian/alamat-pilih`). The payment row is the odd one out.

## Mascot

| App | Pattern |
| --- | --- |
| [Wonder](https://mobbin.com/screens/fc7e35f5-2d3a-4db4-9e4c-a70e345eace0), [DoorDash](https://mobbin.com/screens/8239b91a-6531-42dc-a159-52236b81f35e), [Grubhub](https://mobbin.com/screens/b12fe83a-38e1-4947-9ca1-1d608957ef21), [Deliveroo](https://mobbin.com/screens/fa8ec815-fc60-4287-91e7-e491e4448dc4), [Bolt Food](https://mobbin.com/screens/af80950c-f4b1-448a-84e9-a9cd3ac43f2a) | Home feeds open with a heading or a short greeting, then food photos. No mascot above the feed. |
| [Mimo](https://mobbin.com/screens/54b61209-26b8-4d28-ac60-9f888e099b6e), [Alan](https://mobbin.com/screens/b6bfa5b2-4bac-42d4-b500-d5f2d0b99751) | When a mascot sits on a content screen it is small and beside text inside a card that does something, not a centred block. |
| [Mindtrip](https://mobbin.com/screens/a3e98124-f000-4a3b-a57f-b338ee1344ac), [Spotify Kids](https://mobbin.com/screens/33da73af-4364-4530-b144-5086f2835ea1) | Mascots stay for screens with nothing else on them (empty history, a blank chat), at about 64 to 96pt. |
| [Finch](https://mobbin.com/screens/b5d29fad-9c88-43e0-9aa0-05b7602ab48d), [BitePal](https://mobbin.com/screens/51e4e1aa-21b7-48c2-bef1-ac3e3c642845) | The mascot is the product (a pet), so it gets the hero. Not Catera's case. |

Findings:

- Food apps lead with food. Catera's empty Beranda puts a 120pt waving mascot, centred, above the photos: about 190pt of the first screen before the first plate. DESIGN.md already says food photos lead and the mascot is occasional warmth ("The Food First Rule").
- Where content exists (packages, an agenda, plans), the heading already says the state, so the mascot repeats it.
- Where the page has nothing else (no search results, an empty list, a failed read), a mascot helps, and 64 to 96pt is the usual size.

Current mascot placements in the customer app (`StateArt`, 120pt):

| Place | File | Other content on the page |
| --- | --- | --- |
| Empty Beranda, `melambai` | `src/today/EmptyHome.tsx:81` | Three package photos, Jelajah button |
| Beranda nothing today or next, `tidur` | `src/today/Beranda.tsx:379` | Header statement, plans row, recap |
| Empty Jadwal month, `tidur` | `src/schedule/Jadwal.tsx:199` | The week agenda below it |
| Jadwal month failed, `bingung` | `src/schedule/Jadwal.tsx:163` | Nothing (the month frame) |
| Jelajah no results, `mencari` | `src/discover/Jelajah.tsx:320-371` | Nothing |
| Disimpan empty, `mencari` | `src/discover/SavedList.tsx:115` | Nothing |
| Notifikasi empty, `tidur` | `src/account/Notifications.tsx:164` | Nothing |
| Laporan empty, `tidur` | `src/help/ReportList.tsx:161` | Nothing |
| Full-page failed reads, `bingung` | `ReadError art` (Beli, Bayar, Paket saya, Alamat, Pembayaran, Pilih menu, Hari) | Nothing |
| Claim preview, `melambai` | `src/claim/ClaimScreen.tsx:180` | The claim card |
| Startup failure, `bingung` | `src/shell.tsx:45` | Nothing |

Out of scope: the auth mascot (owner pick 6A, shipped today), `MascotLoading`, the success beat.

## Addendum: every method DOKU offers (owner, 2026-10-27)

The owner: QRIS and BRI VA are only for testing; the app must be ready for every method DOKU supports.

### DOKU's list

From [DOKU Checkout, Supported Payment Methods](https://developers.doku.com/accept-payments/doku-checkout/configuration/supported-payment-methods), fetched 2026-10-27:

| Group | DOKU codes |
| --- | --- |
| Virtual Account (14) | `VIRTUAL_ACCOUNT_BCA`, `_BANK_MANDIRI`, `_BANK_SYARIAH_MANDIRI` (BSI), `_BRI`, `_BNI`, `_DOKU`, `_BANK_PERMATA`, `_BANK_CIMB`, `_BANK_DANAMON`, `_BTN`, `_BNC`, `_BSS`, `_BJB`, `_Sinarmas` |
| QRIS | `QRIS` |
| E-wallet (5) | `EMONEY_OVO`, `EMONEY_SHOPEE_PAY`, `EMONEY_DOKU`, `EMONEY_LINKAJA`, `EMONEY_DANA` (DANA also through Google Pay) |
| Card | credit card (also through Google Pay), Kartu Kredit Indonesia |
| Convenience store (2) | `ONLINE_TO_OFFLINE_ALFA` (Alfamart, Alfamidi, Dan+Dan), `ONLINE_TO_OFFLINE_INDOMARET` |
| Paylater (3) | `PEER_TO_PEER_AKULAKU`, `PEER_TO_PEER_KREDIVO`, `PEER_TO_PEER_INDODANA` |

About 27 channels in six groups. Virtual accounts are half of them.

### What Catera has today

- `packages/domain/src/payment.ts:1`: `DirectPaymentMethod = "VIRTUAL_ACCOUNT_BRI" | "QRIS"`. `PaymentInstruction` knows only BRI VA and QRIS.
- Two modes. `hosted` sends the customer to DOKU's own checkout page, which already lists any method the account enables (`DOKU_PAYMENT_METHODS`, `packages/backend/src/doku.ts:131-138`). `direct` builds the VA number or QR in Catera's own Bayar screen through DOKU SNAP, one API path per channel (`packages/backend/src/doku-direct.ts:9-12`), and only BRI VA and QRIS exist.
- The hosted allow-list regex accepts `EMONEY_SHOPEEPAY`, but DOKU's code is `EMONEY_SHOPEE_PAY`. It also leaves out cards, convenience stores, paylater and `EMONEY_DOKU`. If ShopeePay is ever enabled on the hosted page, the checkout throws `DOKU_CHANNEL_NOT_SUPPORTED`. Worth a separate fix.

### Indonesian apps on Mobbin

| App | Pattern |
| --- | --- |
| [Shopee, payment method](https://mobbin.com/screens/465ca271-547c-4fb4-9745-2ccd2ace4537) | One full screen. Wallet and paylater first, then rows per group ("Bank Transfer", "Credit / Debit Card", "Pay Cash at Mitra/Agent") that open in place to list their banks ([expanded](https://mobbin.com/flows/db90ca44-558b-4455-a19d-989ef510fd28)). Confirm at the bottom. Checkout shows one row plus "View All" ([checkout](https://mobbin.com/screens/1c54f52d-8580-499f-82d5-0b243f187ad5)). |
| [Gojek, select method](https://mobbin.com/screens/8aa2b885-107e-4b82-8f35-45c475800599) | Sheet with headed sections ("Digital payment method(s)", "Other payment method(s)"), radio rows with logos. |
| [Gojek, Virtual Account](https://mobbin.com/screens/861cb2d6-7a26-4256-88f1-bc9f0d1063c8) | VA is its own step: "Select virtual account", one radio row per bank with its logo, and a reminder to pick the bank you will pay from. |
| [Grab, payment methods](https://mobbin.com/screens/73a19673-a57c-40f0-810d-8cb447d6230d) | QRIS on top as the recommended method, then linked methods, then methods to add (OVO, LinkAja, cards). |
| [Zomato](https://mobbin.com/screens/7aa2b9c3-1437-40d2-88d8-d9fcabd22be3), [Swiggy](https://mobbin.com/screens/21e3dd44-1180-4fb0-bce0-9b3a0f654028) | Same idea elsewhere: headed groups (recommended, cards, UPI, wallets, pay later), each a card of rows. |

Findings:

- Checkout keeps a single row for the chosen method (Shopee, Gojek, Grab), so the 1A row stands as designed.
- The picker is a grouped list: QRIS or the recommended method first, then e-wallets, bank transfer, cards, stores, paylater. Every row has a brand logo, a name and a radio.
- The bank list is never shown flat beside everything else. Shopee opens it in place under "Bank Transfer"; Gojek puts it on its own step.
- Logos carry the recognition in Indonesia. Customers look for the BCA or DANA mark, not a name.
