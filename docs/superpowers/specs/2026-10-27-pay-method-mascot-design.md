# Payment method choice and mascot space (customer app)

Date: 2026-10-27. Branch: v2. Research: [2026-10-27-pay-method-mascot.md](../research/2026-10-27-pay-method-mascot.md). Canvas: https://claude.ai/artifact/6Wji9WPhu9V817DR56Dpi6.

Status: approved 2026-10-27. Owner picks: **2B** for Beranda ("2b looks nice"), no preference on payment so **1A** (recommended), then the owner asked for every DOKU method (see "Ready for every DOKU method"; the picker waits for a 3A/3B pick), page-only states shrink to 88, and Dapur shrinks with the customer app. Section 2 below records 2B as built; 2A stays as the rejected option.

## 1. "Bayar dengan" is a choice

### Problem

`PayWith` (`apps/customer/src/buy/BuyParts.tsx:80-157`) shows the chosen method and a button that switches to the other one ("Ganti" on Beli, "Pakai transfer bank (VA)" or "Pakai QRIS" on Bayar). It reads as a toggle, hides what the other method is until it is pressed, and has no way to grow past two methods.

### Options (canvas row 1)

- **1A (recommended): row plus choice sheet.** The page shows one row: a 40 glyph circle, the method name over its one-line description, and a trailing "Ubah" text button. "Ubah" opens a choice sheet titled "Bayar dengan" with one radio row per available method (name and description). Choosing closes the sheet and updates the row. Same anatomy and same sheet as Mulai and Diantar ke on the same screen. Glovo, Careem, Uber Eats, Deliveroo.
- **1B: both methods inline.** The card lists every available method as a 72 radio row; the chosen one carries the filled radio. No sheet. talabat, Keeta. Costs one more row on Beli and on Bayar, and becomes long if a third method is added.

### 1A in detail

Row, on Beli (section heading "Bayar dengan", in its `ListCard`) and on Bayar before the code is shown (the small label heading stays):

- Glyph: `qr-code-outline` for QRIS, `business-outline` for BRI VA (Ionicons, 20, charcoal on the 40 `GlyphCircle`, through `FieldGlyph`).
- Text: name in `bodyStrong` ("QRIS", "Transfer bank BRI (VA)"), description in `meta` ("Pindai dari aplikasi bank atau e-wallet apa pun.", "Bayar ke nomor virtual account BRI."). English strings unchanged.
- Trailing: "Ubah" (`Button variant="text"`), accessibility label "Ubah cara bayar" / "Change payment method". Shown only when more than one method is available; with one method the row has no trailing action.
- Row minimum height 72 (three lines), the `FieldRow` metrics.

Sheet:

- A new choice route `/pembelian/bayar-pakai` that renders `ChoiceRoute` (`apps/customer/src/choice.tsx`), registered beside `pembelian/mulai` with `sheetOptions({ detents: "fit", palette })`.
- Asked through `useChoice()` with `title` "Bayar dengan" / "Pay with", `items` one per available method (`label` the name, `detail` the description), `selected` the chosen method. No extras.
- A choice calls `onChoose(method)`. A close (swipe, back, Close) changes nothing.
- The sheet has no glyphs: `ChoiceList` rows are label, detail and radio, as in the address sheet. The canvas's glyphs in the sheet are not built.

Unchanged: the non-direct mode card ("Pilih cara bayar di halaman berikutnya."), the "Pembayaran belum tersedia" error, the default (QRIS when offered), what Bayar's start command sends, and the "Tampilkan QRIS" / "Tampilkan nomor VA" button that follows the row on Bayar.

Removed: the "Ganti" switch and its "Ganti ke {other}" label, the bordered method card on Bayar, and "Pakai QRIS" / "Pakai transfer bank (VA)".

### Ready for every DOKU method (owner, 2026-10-27; on hold for owner picks)

The owner: QRIS and BRI VA are for testing; the UI must hold every method DOKU offers (about 27 channels in six groups, research addendum). The 1A row on Beli and Bayar stays. The picker behind "Ubah" changes.

**Method catalogue** (`packages/domain/src/paymentMethods.ts`, new): one entry per DOKU code with its group (`qris`, `ewallet`, `va`, `card`, `retail`, `paylater`), its name in Indonesian and English ("BCA Virtual Account", "OVO", "Indomaret"), its one-line description, and its logo key. Group order: QRIS, e-wallet, transfer bank, kartu, bayar di gerai, paylater. The picker and the row read the catalogue. Which methods show is still `availableMethods` from the server; an unknown code is skipped, never shown raw.

**Picker options** (canvas row 3):

- **3A (recommended): one tall sheet, grouped.** Headed sections in the order above, radio rows with logo, name and description. Transfer bank is one row ("BCA, Mandiri, BRI, BNI dan 8 lainnya") that opens in place to list the banks (Shopee). Choosing any radio closes the sheet. Detent `large` once there are more than five methods, `fit` otherwise.
- **3B: groups first, then a second step.** The first level lists QRIS, the single methods and one row per multi-method group (E-wallet, Transfer bank, Paylater) with a chevron; a group opens its own list inside the sheet with a back button (Gojek's VA step).

Rules for both:

- A group with one available method is a plain radio row (today: QRIS and "BRI Virtual Account" as two rows, no headers, the same look as the 1A sheet).
- Section headers show only when more than five methods are available.
- The row on Beli and Bayar names the method the way the catalogue does ("BCA Virtual Account", "DANA").
- Logos: official marks are needed (DOKU's channel logo kit or each brand's press kit; owner action). Until they arrive, a 40 tile with the group glyph.

**Scope.** This phase makes the UI and the catalogue ready; the server keeps offering QRIS and BRI VA. Turning on more methods is backend work per channel: SNAP paths and instructions in `doku-direct.ts`, `PaymentInstruction` kinds for other banks' VA steps, a redirect kind for e-wallets, cards and paylater, and pay codes for stores. Separately, the hosted allow-list in `packages/backend/src/doku.ts:136-137` spells ShopeePay `EMONEY_SHOPEEPAY` where DOKU uses `EMONEY_SHOPEE_PAY`.

Task 1 waits for the owner's 3A/3B pick.

## 2. Mascot only where it is the whole page

### Problem

The 120pt still (`StateArt`) sits centred above content that already says the state. On the empty Beranda it pushes the first package photo about 190pt down. DESIGN.md's Food First Rule says photos lead and the mascot is occasional warmth.

### Options (canvas row 2)

- **2A (recommended): food first.** Remove the mascot from screens that have other content; keep it on screens where it is the only thing, at 88pt instead of 120.
- **2B: small mascot beside the heading.** Keep the mascot on Beranda but at 64pt, right of the heading, so it costs no height. Mimo, Alan. It still sits right above the food photos, which DESIGN.md's `StateArt` rule ("never beside a photo of food") forbids.

### As built (2B on Beranda, 2A sizes elsewhere)

Empty Beranda (`src/today/EmptyHome.tsx:72-91`): the heading block becomes a row. Left, a column with the title and subtitle, left-aligned (drop `centred`), `flex: 1`. Right, `StateArt pose="melambai" base={64}` (52 compact, once Task 3 sets the 88/72 ratio), vertically centred, gap 12. `paddingTop: 8` kept. The recap rule stands: while the recap shows, no art; while its seen marks are read, the 64 box is `held`. This is the one place a still sits on a page with food photos; the owner's 2B pick supersedes the `StateArt` "never beside a photo of food" line for it.

Removed (no heading on the page for the art to sit beside, and the page's own text says the state):

| Place | File | Change |
| --- | --- | --- |
| Beranda nothing today or next `tidur` | `src/today/Beranda.tsx:373-380` | No art; the header statement says it. `recapShown` stays only if EmptyHome still needs it (it does, for `held`). |
| Empty Jadwal month `tidur` | `src/schedule/Jadwal.tsx:198-199` | No art; the agenda says there is nothing. |

Kept at the new size (the page has nothing else): Jelajah no results and empty area (`mencari`), Disimpan empty (`mencari`), Notifikasi empty (`tidur`), Laporan empty (`tidur`), every `ReadError art` (`bingung`), the failed Jadwal month frame (`bingung`), the startup failure (`bingung`), the claim preview (`melambai`).

Size: `STATE_ART` 120 to **88**, `STATE_ART_COMPACT` 96 to **72** (same four-fifths rule at font scale 1.3 on a 360dp phone) in `packages/mobile-ui/src/brand/StateArt.tsx:11-13`. `ReadError`'s art gap `marginBottom: 12` to 8. Call sites that pass their own `marginBottom` keep theirs.

`StateArt` is shared, so Dapur's empty and error states shrink to 88 too (owner: both apps).

Out of scope: the auth mascot (owner pick 6A), `MascotLoading` (140), the success beat (180), the reading mascot (120), the `base` 72 cooking size.

## Docs

DESIGN.md: the `StateArt` line and pose map in Native polish (Phase F) (`DESIGN.md:904-908`) get a superseded note, and a new section "Payment method and mascot space (October 2026)" states 1A and the 2B Beranda row as built.

## Verification

Owner ruling for this phase: unit tests only, no emulator gate. `npm run typecheck`, `npm test`, the customer and Dapur Jest suites, `npm run build`. Not verified on a device: the sheet's fit height with two rows, TalkBack order in the sheet, the new art size on a 360dp phone.
