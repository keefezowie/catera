# Customer deep pages: fixes and polish (design spec, 2026-10-24)

**Source:** [research/2026-10-24-customer-deep-pages.md](../research/2026-10-24-customer-deep-pages.md) (6 bugs, 10 ranked recommendations, per-page sections).
**Owner instruction (2026-10-24):** "fix everything here", fully autonomous. The controller wrote and self-reviewed this spec on the owner's behalf. No canvas.
**Skills:** `expo-native-ui` and `design-taste-frontend` (expo-native-ui wins on conflict), `humanizer` for copy, the superpowers process skills.

## 0. Rules that stay fixed

- The 2026-10-23 customer layout spec ([specs/2026-10-23-customer-layout-design.md](2026-10-23-customer-layout-design.md)) and DESIGN.md "Customer layout scale" (lines 1032-1186) are owner-approved. Where a research recommendation would reverse one of their decisions, this spec takes the smallest change that answers the finding and keeps the approved layout. Each case is ruled in §2.
- Palette K, no forest-filled cards or choice rows, the side margin of 16, 44dp targets (48 for rows), Indonesian first via `t(id, en)`, "kamu", "pengantaran", "katering", no em dashes in copy, no invented numbers.
- Shared `packages/mobile-ui` components are also used by Catera Dapur. Every visual change there is either additive (a new prop or variant) or gated on `useLayoutScale() === "v2"`. Dapur keeps its current look; `apps/caterer` Jest must stay green (`layout-classic.test.tsx` pins classic geometry).
- No schema or API change in this phase. Items that would need one are deferred (§4).

## 1. Bugs

| ID | Fix |
|---|---|
| B1/B2 | The Hari sheet's actions never wrap under the gesture bar. Where circles fit on one row they stay (approved). Where they would wrap (`useStackedLayout(380)`: narrow screens or large text), the actions become full-width 48dp rows (icon, label, Android no chevron), and the body's bottom padding clears the inset. See R2. |
| B3 | "Belum sampai" applies only to today's meals whose window has started (`date === today`). A past day with no update and no report reads as delivered: the server's `auto_deliver` treats silence as delivered. Wording follows the domain `statusLabel("delivered")`. The test that pins "d-old" as "Belum sampai" is rewritten. |
| B4 | No customer screen uses `Segmented` with three or more options: the Bantuan topics become radio rows (R7). `Segmented` itself gets a guard, v2-gated: with 3+ options and `useStackedLayout(360)` true, it renders as stacked full-width rows, each one segment, instead of squeezing the labels. With 2 options it stays a row. Its labels never shrink. |
| B5 | The review starts with no stars. Kirim stays disabled with the hint "Pilih bintang dulu." until a rating is picked. Under the overall stars, three compact rows ("Rasa", "Pengantaran", "Harga") start at the overall rating once it is picked and can be changed. `review.save` sends `food`, `delivery` and `value` separately (the API already takes them). |
| B6 | When push is unavailable (Expo Go), the Notifikasi switch row is hidden instead of shown disabled with an explanation. Shared `Pengaturan`, so it applies to Dapur too (correct there as well). |

## 2. Recommendations, as ruled

**R1 Beli and Renew.**
- The pay button names the amount: "Bayar Rp 175.000" (Renew: the same label). Until a quote is ready it reads "Bayar".
- When the button is disabled, one `meta` line above it says why, in this order: quote loading "Menghitung total…"; no address "Pilih alamat dulu."; no start date "Pilih tanggal mulai dulu."; a pending checkout "Ada pembayaran yang belum selesai."; a quote error shows the error text. The Total row keeps the amount; "-" is replaced by "Menghitung…" while it loads.
- The navigation title becomes "Beli" (Renew: "Perpanjang"). The package name stays once, in the summary card, and is no longer repeated.
- "Bayar dengan" stays a section (spec 3.7). The method row no longer looks like an input: a plain row with the method name and a trailing "Ganti" text action, no box border.

**R2 Hari sheet.** The stacked action layout from B1 replaces the two-row circle wrap: full-width rows with the same `dayVisibleActions` order, test ids `day-action-<key>` kept. Wide screens keep the circle row (spec 3.2.3).

**R3 Beranda and Jadwal.** The approved structure stays: Beranda hero first, "Berikutnya" with rows, and the Jadwal month grid in the band with the "Minggu ini" agenda.
- The Beranda hero adds its change deadline: "Bisa diubah sampai {hari, jam}" from `cutoff_at`, `meta`. The hero's existing primary action stays.
- In `DayBlocks` (2+ deliveries on a day), unpicked deliveries no longer each get a dashed "Menu belum diisi" tile. All unpicked deliveries of a day collapse into one row: utensil tile, "{n} pengantaran belum ada menu", and one "Pilih menu" text action (to the first one's `/pilih-menu/{subscriptionId}`). Picked deliveries keep their photo tiles. One unpicked delivery reads "Menu belum dipilih" with the same action.
- In the Jadwal week agenda, past days follow B3, and an unpicked row shows the "Pilih menu" action the same way.
- Rejected: the week strip leading Jadwal, with the month behind a toggle. It reverses the approved band layout.

**R4 Pilih menu.**
- Dish options become photo cards in a 2-column grid: the `Photo` of `option.image`, falling back to the utensil tile; the name in 2 lines; serving as `meta`. The selected card gets a 2dp `accent` ring and a check. This replaces the `FilterChip` per option.
- A deadline line at the top of the editor: "Pilih sebelum {hari, jam}" (`cutoff`), in the warning tone when under 24 hours away.
- The count "{x} dari {n} hari sudah dipilih" sits under the month bar.
- The confirm ("Simpan menu") is pinned at the bottom with `SheetFooter`, or a sticky footer on the stack screen.

**R5 Paket detail.**
- "Isi paket" gains a horizontal preview of up to 6 dishes (`Photo` 96×96, name in 2 lines) when the package's menus list dishes, above the existing per-meal rows.
- Kept as approved: the 3-cell stat strip with carbs and fat on the meta line (spec 3.4), and the pinned footer.
- Rejected: hiding the tab bar. HIG keeps the tab bar on drill-down within a tab, and native tabs have no per-route hide (expo-native-ui).

**R6 Addresses.**
- On Alamat, the heading "Makanan diantar ke mana?" is removed; the title already says it.
- Each row is one press target that opens the edit form, with a trailing pencil icon (`accessibilityLabel` "Ubah {label}"). Hapus moves into the edit form as a danger text action at the bottom, "Hapus alamat", which runs the existing `useAddressRemoval` with its confirm.
- In the form, the label is three chips (Rumah, Kantor, Lainnya); Lainnya shows the free-text field. An existing custom label opens with Lainnya selected and its text. "Petunjuk pengantaran" gets the hint "Contoh: pagar hitam, titip satpam".
- The purchase's address pick sheet offers "Tambah alamat" (opens `/pembelian/alamat-form`) beside "Kelola alamat". `ChoiceRoute` takes a list of extras.
- Deferred: a default-address marker (no field exists; §4).

**R7 Bantuan and Masalah.**
- In Bantuan-form, the topic is radio rows in the `ChoiceList` style: Pembatalan, Pembayaran, Lainnya, each with a one-line example. The 8 package chips become one "Paket" row that opens a choice sheet. A `paket` route param preselects it.
- In Masalah, the kind and meal choices use the same radio-row style, not filled forest pills. A context card at the top shows the delivery: the date, the meal, and the caterer name on up to 2 lines, never cut to one.
- The empty Bantuan shows the `StateArt` empty state: "Belum ada laporan", the line "Kalau ada yang salah dengan pengantaran, laporkan dari harinya di Jadwal.", and the "Minta bantuan" button whenever the customer has a plan.
- Deferred: a Catera WhatsApp row and reply-time copy (no number in config; never invented).

**R8 Pengaturan, Data akun, Notifikasi, Pembayaran.**
- Settings sections render as grouped cards (`fill` ground, `cardBorder`, radius card, inset dividers) in v2. Each row shows its current value trailing ("Bahasa: Indonesia", "Tampilan: Ikuti sistem"). Dapur keeps its classic rows.
- Data akun uses the same grouped cards.
- Notifikasi drops the "Baru" label (the unread dot and bold title remain). Rows group under "Hari ini", "Kemarin" and "Sebelumnya". A header action "Tandai semua dibaca" sends `notification.read` for each unread item in order, then refreshes; it is hidden when nothing is unread.
- Pembayaran rows get a status chip derived from existing data: "Lunas" (a paid plan), "Menunggu" (awaiting payment), "Diproses" (checking), "Kedaluwarsa" (expired). The date line reads "Mulai {tanggal}". The paid date is deferred (§4).

**R9 Masuk and the auth pages.**
- The SMS code is a 6-slot input: one hidden `TextInput` with `textContentType="oneTimeCode"` and `autoComplete="sms-otp"`, digits only, and 6 visible boxes. The current box gets the accent ring. It submits by itself on the sixth digit.
- "Kirim ulang kode" counts down 60 seconds ("Kirim ulang dalam 0:42") and calls `sendPhoneOtp` again.
- Register and Recover share one "Cek emailmu" view: art, the typed address in bold, "Buka aplikasi email" (`Linking.openURL("mailto:")`, best effort), and a resend with the same 60-second countdown.
- AuthCallback renders on `AuthScreen` and `AuthHeading`, like the other auth pages.

**R10 Hapus akun.**
- With running plans, a callout replaces the list of plan names: "{n} paket masih berjalan", then three consequence lines: "Pengantaran yang belum lewat dibatalkan.", "Riwayat dan alamat dihapus.", and the existing review line from the current sheet copy, unchanged. No new number or timeframe.
- The send button uses a new additive `Button` variant `danger` (filled `danger`, text `onDanger` or white by contrast).

## 3. States every task must cover
Light and dark × Siang and Malam; font 1.0 and 1.3 at 360dp; loading, empty and error where the screen reads data; the demo fixtures named in the plan.

## 4. Deferred (needs schema, API or owner input)
- A default-address field.
- The paid date on Pembayaran (the customer read has no `paid_at`).
- A bulk `notification.readAll` (the client loops over unread items instead).
- A Catera support WhatsApp number and reply time.
- Photo upload on Masalah.
- The email code login (email auth is link-based).

## 5. Self-review (controller, on the owner's behalf)
- Every bug B1–B6 and recommendation R1–R10 has a ruling above. R3, R5 and R1 were narrowed where they would reverse approved layout decisions, and the reasons are recorded.
- No ruling needs a migration.
- Every shared-component change is additive or v2-gated (Segmented, Button `danger`, settings grouped cards, the Pengaturan switch hide).
- Copy was checked against the glossary (DESIGN.md 1376-1400): "pengantaran", "katering", "kamu", no em dashes.
