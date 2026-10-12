# Catera Dapur copy audit (Indonesian and English)

Date: 2026-10-12. Branch `v2`. Audit only: no source file was changed.

Scope: `apps/caterer/src/**` and `apps/caterer/app/**` (tests skipped), the server push bodies a caterer receives (`supabase/migrations`, sent by `apps/web/src/lib/push-dispatch.ts`), and shared-package strings only where they appear in a Dapur-only context (marked "shared"). Paths below are relative to `apps/caterer/` unless they start with `packages/`, `supabase/` or `apps/web/`. Current strings are quoted verbatim, including the app's middle dot, ellipsis and the dashes this audit asks to remove.

Method: a TypeScript AST pass listed every `t("id", "en")` pair and every hard-coded literal, JSX text, accessibility label and placeholder; each was then read in its screen context. Skills applied: humanizer, antislop (core, copywriting, human, ui, layoutmobile; mode "after", session override), impeccable (clarify), building-native-ui, apple-design, design-taste-frontend. `material-3` is not installed in this environment, so Android/Material copy conventions were judged from the building-native-ui and antislop references only. Mobbin was used for English pattern reference only (merchant confirm sheets name the action on the button and state the consequence in one line); no string below is attributed to any app.

Rules held: Dapur speaks "kamu" (DESIGN.md:865); `customers/CustomerDetail.tsx:69-71` is sent to the customer and keeps "Anda"; truthfulness R-17 (C5 at DESIGN.md:705 is the model: no number the system cannot know); placeholders such as `{n}` keep their meaning; no em or en dashes in proposals; sentence case.

## 1. Summary: what makes the copy stiff

1. **Strings with no English, or half English (34).** The English setting still shows Indonesian in the menu slot editor, every package validation message, every import row reason, and "porsi" fragments on four screens; the English footer says "1 portions". Examples: `menu/SlotEditor.tsx:71` "Simpan menu" has no English; `business/package.ts:129` "Nama paket minimal 3 huruf" is Indonesian only.
2. **Glossary drift: one thing, two words (14).** "pengantaran" and "antaran" for a delivery; "Terkirim" and "Sampai" for arrived; English "Not delivered" and "marked as failed" for Gagal diantar; "HP" and "ponsel". Examples: `today/DeliveryOrder.tsx:154` "Pengantaran tercatat..." next to `today/TodayScreen.tsx:496` "antaran makan siang"; `customers/CustomerDetail.tsx:129` "Terkirim" where the rest of Dapur says "Sampai".
3. **Register drift to "Anda" (12).** Folds in G18. Examples: `today/TodayScreen.tsx:640` "Siapkan dapur Anda"; `business/money.ts:10` "Ikut pencairan berikutnya ke rekening Anda."
4. **Labels and outcomes that do not say what happens next (12).** A date move is saved with "Simpan laporan"; a failure reads only "Belum tersimpan."; a later step is badged "Segera", which also reads as "right now". Examples: `today/ExceptionSheet.tsx:279` "Simpan laporan"; `menu/MenuWeek.tsx:315` "Belum tersimpan."
5. **Calques and broken English (16).** Examples: `today/TodayScreen.tsx:221` "Leave to deliver now?"; `import/ImportAssistant.tsx:64` "Try retyping it or a clearer photo."
6. **Passive with no actor, or copy about the system instead of the task (8).** Examples: `today/ExceptionSheet.tsx:266` "Hari ini dipindah ke tanggal lain. Pelanggan diberi tahu." (also an R-17 issue, see below); `business/money.ts:9` "Ada keluhan pelanggan yang sedang ditinjau." (who reviews?).
7. **Written register where speech fits (10).** "adalah", "bila", "tercapai", "mengabari", "komunikasikan kepada", "Tinjau dan tanggapi". Examples: `RoleGate.tsx:50` "Akun ini adalah akun pelanggan."; `business/AktifkanScreen.tsx:129` "Kami akan mengabari Anda bila ada dokumen tambahan yang diperlukan."
8. **Dashes (3).** G18's en dashes. Examples: `business/AktifkanScreen.tsx:97` "1–2 hari kerja"; `import/ImportAssistant.tsx:252` placeholder "Bu Ani – 0812… –".

What already works and is kept: the generic fallback "Belum berhasil. Coba lagi." / "That didn't work. Try again." reads like a person; the Hari ini status vocabulary (Mulai masak, Berangkat antar, Terjadwal, Dimasak, Sampai, Tercatat sampai, Semua beres hari ini) is short and spoken; the import error lines name the limit and the way out; C5's departure line is the house standard for truthful copy.

One truth finding (R-17): `today/ExceptionSheet.tsx:266` promises "Pelanggan diberi tahu." The move command notifies `s.user_id` (`packages/backend/src/paid-pilot.sql:448`), so an imported customer without a Catera account is told nothing. The proposal reuses C5's wording.

## 2. Findings by area

Pattern names: **Register** (Anda), **i18n gap**, **Glossary**, **Vague outcome**, **Calque**, **Passive/system**, **Formal**, **Dash**, **R-17**. "Longer" marks a button or label proposal longer than the current one.

### Masuk, Daftar, role gate, Aktifkan

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/auth/Daftar.tsx:79` | Daftar masak, rute antar, dan semua pelanggan Anda di satu tempat. Gratis untuk pelanggan yang Anda bawa sendiri. | (kept) | Register | Daftar masak, rute antar dan semua pelanggan kamu di satu tempat. Gratis untuk pelanggan yang kamu bawa sendiri. | (unchanged) |
| `src/RoleGate.tsx:50` | Akun ini adalah akun pelanggan. Catera Dapur hanya untuk katerer dan pembantunya. | This is a customer account. Catera Dapur is for caterers and their helpers. | Formal ("adalah") | Ini akun pelanggan. Catera Dapur khusus untuk katerer dan pembantunya. ("pembantu": owner decision O1) | (unchanged) |
| `src/business/AktifkanScreen.tsx:14` | Segera | Soon | Vague outcome ("Segera" also reads "do it now") | Nanti | Later |
| `src/business/AktifkanScreen.tsx:85` | Profil dan paket diperiksa | Profile and packages checked | Passive/system (step title reads as done) | Pemeriksaan profil dan paket | Profile and package check |
| `src/business/AktifkanScreen.tsx:89` | Ajukan pemeriksaan | Request a check | Formal | Minta diperiksa | Ask for a check |
| `src/business/AktifkanScreen.tsx:97` | Tim Catera biasanya memeriksa dalam 1–2 hari kerja. | The Catera team usually checks within 1–2 working days. | Dash; timing claim (owner decision O5) | Tim Catera biasanya memeriksa dalam 1 sampai 2 hari kerja. | The Catera team usually checks within 1 to 2 working days. |
| `src/business/AktifkanScreen.tsx:120` | Kirim rekening | Submit account | Vague outcome (the account goes to review) | Kirim untuk diperiksa (longer) | Send for review |
| `src/business/AktifkanScreen.tsx:129` | Kami akan mengabari Anda bila ada dokumen tambahan yang diperlukan. | We'll let you know if any extra documents are needed. | Register; Formal | Kami kabari kamu kalau perlu dokumen tambahan. | We'll tell you if we need more documents. |

### Hari ini, the count card and the footer actions

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/today/TodayScreen.tsx:126` | Antar ${start} | Deliver ${start} | Calque (EN reads as an order) | (unchanged) | Delivery ${start} |
| `src/today/TodayScreen.tsx:215` | Pelanggan melihat status Dimasak. | Customers see the status Cooking. | Tense; Calque (EN). DESIGN.md:609 quotes it | Pelanggan akan melihat status Dimasak. | Customers will see Cooking. |
| `src/today/TodayScreen.tsx:221` | Berangkat antar sekarang? | Leave to deliver now? | Calque (EN) | (unchanged) | Head out now? |
| `src/today/TodayScreen.tsx:227` | Berangkat | Leave | Calque (EN) | (unchanged) | Head out (longer) |
| `src/today/TodayScreen.tsx:248` | Berangkat antar · ${session.portions} porsi | Leave to deliver · ${session.portions} portions | Calque; i18n gap (no plural: "1 portions") | (unchanged) | Head out · ${plural(n, "portion")} |
| `src/today/TodayScreen.tsx:222`, `:254` | Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat. | Customers using the Catera app get a notification when you leave. | Calque (EN, follows the row above). ID is C5 and stays | (unchanged) | Customers using the Catera app get a notification when you head out. |
| `src/today/TodayScreen.tsx:297` | ${arrived} tercatat sampai, ${failed} ditandai Gagal diantar. | ${arrived} recorded as arrived, ${failed} marked as failed. | Glossary (EN "failed" vs "Not delivered" on the sheet). DESIGN.md:615 quotes it | (unchanged) | ${arrived} recorded as arrived, ${failed} marked Not delivered. |
| `src/today/TodayScreen.tsx:496`, `:500` | ${failedCount} antaran makan siang ditandai Gagal diantar. | ${failedCount} lunch deliveries marked as failed. | Glossary (EN) | (unchanged) | ${failedCount} lunch deliveries marked Not delivered. (dinner the same) |
| `src/today/TodayScreen.tsx:513`, `:517` | Lihat makan siang · ${n} porsi | See lunch · ${n} portions | i18n gap (no plural) | (unchanged) | See lunch · ${plural(n, "portion")} |
| `src/today/TodayScreen.tsx:568` | Sudah dibalas · tandai selesai bila beres | Replied · mark as done when sorted | Formal ("bila"); two sentences joined by a dot | Sudah kamu balas. Tandai selesai kalau sudah beres. | You replied. Mark it done once it's sorted. |
| `src/today/TodayScreen.tsx:584` | Ada pengantaran bermasalah | A delivery needs attention | Glossary | Ada antaran bermasalah | (unchanged) |
| `src/today/TodayScreen.tsx:587` | Ada urusan pembayaran | A payment needs attention | Vague outcome | Ada pembayaran yang perlu dicek | (unchanged) |
| `src/today/TodayScreen.tsx:632` | Satu layar | One screen | Passive/system (describes the UI, not the task) | Nama, foto, harga, hari antar | Name, photo, price, days |
| `src/today/TodayScreen.tsx:640` | Siapkan dapur Anda | Set up your kitchen | Register | Siapkan dapur kamu | (unchanged) |
| `src/today/TodayScreen.tsx:663` | Nanti di sini | Coming up here | Calque; Vague outcome | Setelah ada pelanggan | Once you have customers |
| `src/today/TodayScreen.tsx:665` | Setelah pelanggan masuk, halaman ini menunjukkan berapa porsi yang dimasak dan rute antar hari ini dan besok. | Once customers are in, this page shows what to cook and where to deliver today and tomorrow. | Repeats the new heading | Halaman ini menunjukkan porsi yang perlu dimasak dan rute antar, hari ini dan besok. | This page shows what to cook and where to deliver, today and tomorrow. |
| `src/today/CookingList.tsx:37` | Centang hanya catatan dapur, tidak dikirim ke pelanggan. | Ticks are a kitchen note only and are not sent to customers. | Stiff syntax (ID); Calque (EN). DESIGN.md:608 quotes it | Centang ini cuma catatan dapur. Pelanggan tidak melihatnya. | Ticks are just for the kitchen. Customers don't see them. |
| `src/today/SessionCard.tsx:38` (with `:94`) | `*Makan siang* (12 porsi)` | `*Lunch* (12 porsi)` | i18n gap: the shared recap is Indonesian by design (comment at `:92`), but its title follows the app language, so English mode shares a mixed line | Use the Indonesian title in the shared text whatever the language | (shared text stays Indonesian) |
| `packages/domain/src/kitchen.ts:303` (shared) | `${n} porsi` | `${n} portions` | i18n gap: "1 portions" in the WhatsApp route | (unchanged) | singular for 1 |

### Delivery order and stop actions

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/today/DeliveryOrder.tsx:154` | Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya. | Deliveries are recorded as arrived automatically, unless you report a problem at the address. | Glossary; Passive/system. DESIGN.md:614 quotes it | Antaran otomatis tercatat sampai, kecuali kamu laporkan masalah. | Each stop is recorded as arrived automatically unless you report a problem. |
| `src/today/DeliveryOrder.tsx:162` | Tidak ada pengantaran untuk waktu ini. | No deliveries for this meal. | Glossary; vague ("waktu ini") | Tidak ada antaran untuk waktu makan ini. | (unchanged) |
| `src/today/DeliveryOrder.tsx:99` | `${s.portions} porsi · ${s.packageName}` | (none) | i18n gap | (unchanged) | `${plural(n, "portion")} · ${package}` |
| `src/today/ExceptionSheet.tsx:249` | `${stop.portions} porsi · ${stop.packageName}` | (none) | i18n gap | (unchanged) | as above |
| `src/today/ExceptionSheet.tsx:256` | Makanan tidak sampai. Hari ini tidak dihitung terkirim dan tidak dibayarkan ke kamu. Hubungi pelanggan untuk menggantinya. | The food didn't arrive. This day isn't counted as delivered or paid to you. Contact the customer to make up for it. | Glossary ("terkirim"); "menggantinya" is unclear (replace what?) | Makanan tidak sampai. Hari ini tidak dihitung sampai dan tidak dibayar ke kamu. Hubungi pelanggan untuk atur penggantinya. | (unchanged) |
| `src/today/ExceptionSheet.tsx:266` | Hari ini dipindah ke tanggal lain. Pelanggan diberi tahu. | Move this day to another date. The customer is told. | R-17 (accountless customers get no notification, `paid-pilot.sql:448`); Passive/system (ID reads as already done) | Pindahkan antaran ini ke tanggal lain. Pelanggan yang memakai aplikasi Catera dapat notifikasi. | Move this delivery to another date. Customers using the Catera app get a notification. |
| `src/today/ExceptionSheet.tsx:279` | Simpan laporan | Save report | Vague outcome (a date move is not a report). DESIGN.md:612 quotes it | Gagal diantar: "Tandai gagal diantar" (longer); Pindah tanggal: "Pindahkan antaran" (longer) | "Mark not delivered" / "Move delivery" |
| `src/today/ExceptionSheet.tsx:169` | Laporan tersimpan | Report saved | Vague outcome (toast). DESIGN.md:876-877 quotes it | Ditandai gagal diantar / Antaran dipindah | Marked not delivered / Delivery moved |

Problem reports (reached from Hari ini):

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/today/ReportScreen.tsx:211` | Balas sebelum besok 12.00, sebelum pelanggan bisa meminta Catera meninjau. | Reply before tomorrow 12.00, before the customer can ask Catera to review. | Doubled "sebelum/before"; stiff | Balas sebelum besok pukul 12.00. Setelah itu pelanggan bisa minta Catera meninjau. | Reply by 12.00 tomorrow. After that, the customer can ask Catera to review it. |
| `src/today/ReportScreen.tsx:212` | Balas sebelum hari ini 12.00, sebelum pelanggan bisa meminta Catera meninjau. | Reply before today 12.00, before the customer can ask Catera to review. | Same | Balas sebelum pukul 12.00 hari ini. Setelah itu pelanggan bisa minta Catera meninjau. | Reply by 12.00 today. After that, the customer can ask Catera to review it. |

### Besok

Besok is the same screen with the date flipped. Its strings ("Besok", "ganti hari", "Tidak ada masakan untuk besok.", "Lihat besok") are covered in the Hari ini and empty-state tables.

### Menu and the package editor

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/menu/SlotEditor.tsx:67` | Paket ini berisi ${list}. Lengkapi ${missing} lagi. | (none) | i18n gap | Paket ini berisi ${list}. Tambah ${missing} lagi. | This package has ${list}. Add ${missing} more. |
| `src/menu/SlotEditor.tsx:71` | Simpan menu | (none) | i18n gap | (unchanged) | Save menu |
| `src/menu/SlotEditor.tsx:144` | Hapus ${i.name} (a11y) | (none) | i18n gap | (unchanged) | Remove ${name} |
| `src/menu/SlotEditor.tsx:157` | ${group.name} berikutnya (a11y) | (none) | i18n gap; label does not name the action | Tambah ${group} | Add ${group} |
| `src/menu/SlotEditor.tsx:159` | Ketik nama ${group}… (placeholder) | (none) | i18n gap | (unchanged) | Type a ${group} name… |
| `src/menu/SlotEditor.tsx:186` | dipakai ${n}× | (none) | i18n gap; symbol for a word | dipakai ${n} kali | used ${n} times |
| `src/menu/SlotEditor.tsx:192` | + Buat hidangan baru "${query}" | (none) | i18n gap | (unchanged) | + Create new dish "${query}" |
| `src/menu/MenuDayScreen.tsx:67` | Belum tersimpan. | Not saved. | Vague outcome (no object, no next step) | Menu belum tersimpan. Coba lagi. | Menu not saved. Try again. |
| `src/menu/MenuWeek.tsx:315` | Belum tersimpan. | Not saved. | Vague outcome (this is the copy-last-week failure) | Menu minggu lalu belum tersalin. Coba lagi. | Last week's menu wasn't copied. Try again. |
| `src/menu/MenuWeek.tsx:371` | Belum tersimpan. | Not saved. | Vague outcome (photo save) | Foto belum tersimpan. Coba lagi. | Photo not saved. Try again. |
| `src/business/PackageEditor.tsx:57` | Belum tersimpan. Coba lagi. | Not saved. Try again. | Vague outcome | Paket belum tersimpan. Coba lagi. | Package not saved. Try again. |
| `src/business/PackageEditor.tsx:140` | Ceritakan paketnya | Describe it | Calque (EN pronoun with no referent) | (unchanged) | Describe the package |
| `src/business/PackageEditor.tsx:141` | Isi satu porsi | In one portion | Calque (EN) | (unchanged) | What's in one portion |
| `src/business/PackageEditor.tsx:148` | Waktu makan | Meal | Calque (EN, the field is plural) | (unchanged) | Meal times |
| `src/business/PackageEditor.tsx:172` | Berapa porsi paling banyak yang sanggup Anda masak per hari. | The most portions you can cook in a day. | Register; a question ending in a full stop | Paling banyak berapa porsi yang sanggup kamu masak dalam sehari? | (unchanged) |
| `src/business/PackageDetail.tsx:25` | – (no price) | – | Dash | Belum ada harga | No price yet |
| `src/business/PackageDetail.tsx:37` | Paket yang sudah tayang tidak bisa diubah supaya pelanggan tetap mendapat yang mereka beli. Untuk mengubah harga, isi atau kapasitas, buat paket baru dari paket ini. | A live package can't change, so customers keep what they bought. To change price, contents or capacity, make a new package from this one. | Long; Formal; the action has a button name it can use | Paket yang sudah tayang dikunci, supaya pelanggan dapat persis yang mereka beli. Mau ganti harga, isi atau kapasitas? Salin jadi paket baru. | Live packages are locked so customers get exactly what they bought. To change the price, contents or capacity, copy it into a new package. |
| `src/business/package.ts:112-137` (10 strings) | Angka bulat saja; Isi juga batas yang satunya; Batas bawah tidak boleh lebih dari batas atas; Nama paket minimal 3 huruf; Ceritakan paketnya, minimal 10 huruf; Isi harga per porsi; Pilih hari antar; Isi kapasitas per hari; Tambahkan foto paket; Isi minimal satu hidangan per porsi | (none) | i18n gap (the comment says "Indonesian first", but no English exists) | Keep the Indonesian; `:132` becomes "Harga per porsi minimal Rp1.000" (the rule is `price < 1000`) | Whole numbers only; Fill in the other end too; The lower end can't be above the upper end; Package name needs at least 3 letters; Describe the package in at least 10 letters; Price per portion is at least Rp1,000; Choose delivery days; Enter a daily capacity; Add a package photo; Add at least one dish per portion |

### Pelanggan and import

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/customers/CustomerList.tsx:88` | + Pelanggan lama | + Existing | EN label has no noun | (unchanged) | + Existing customer (longer; check the header button width) |
| `src/customers/CustomerList.tsx:128` | Dari marketplace / Pelanggan Anda | From marketplace / Your customer | Register; Glossary (every customer is "yours") | Dari Catera / Pelanggan sendiri (owner decision O9 for "marketplace") | From Catera / Your own customer |
| `src/customers/CustomerList.tsx:119` | `${pkg} · ${n} porsi` | (none) | i18n gap | (unchanged) | `${pkg} · ${plural(n, "portion")}` |
| `src/customers/CustomerDetail.tsx:93` | `${pkg} · ${n} porsi` | (none) | i18n gap | (unchanged) | as above |
| `src/customers/CustomerDetail.tsx:96` | Dari marketplace · dibayar lewat Catera | From the marketplace · paid through Catera | Glossary (O9) | Pesan dan bayar lewat Catera | Ordered and paid through Catera |
| `src/customers/CustomerDetail.tsx:97` | Pelanggan Anda · dibayar di luar Catera | Your customer · paid outside Catera | Register (G18) | Pelanggan sendiri · dibayar di luar Catera | Your own customer · paid outside Catera |
| `src/customers/CustomerDetail.tsx:104` | Pelanggan ini belum punya akun Catera. Pesannya berisi tautan untuk membuat akun lalu membayar perpanjangan. | This customer has no Catera account yet. The message links to creating one, then paying for the renewal. | Formal; stiff EN | Pelanggan ini belum punya akun Catera. Tautan di pesan mengajaknya buat akun, lalu bayar perpanjangan. | This customer has no Catera account yet. The link in the message takes them to create one, then pay for the renewal. |
| `src/customers/CustomerDetail.tsx:129` | Terkirim | Delivered | Glossary (Dapur says "Sampai"); owner decision O2 | Sampai | Arrived |
| `src/import/ImportAssistant.tsx:64` | Catatan ini belum bisa dibaca. Coba ketik ulang atau kirim foto yang lebih jelas. | We couldn't read this. Try retyping it or a clearer photo. | Broken EN | (unchanged) | We couldn't read this. Retype it, or send a clearer photo. |
| `src/import/ImportAssistant.tsx:67` | Batas baca hari ini sudah tercapai. Coba lagi besok. | Today's reading limit is reached. Try again tomorrow. | Formal ("tercapai"); passive EN | Jatah baca hari ini sudah habis. Coba lagi besok. | You've used today's reading limit. Try again tomorrow. |
| `src/import/ImportAssistant.tsx:68` | Asisten impor belum aktif. Anda tetap bisa memasukkan pelanggan satu per satu. | The import assistant isn't switched on yet. You can still add customers one by one. | Register (G18) | Asisten impor belum aktif. Kamu tetap bisa isi pelanggan satu per satu. | (unchanged) |
| `src/import/ImportAssistant.tsx:236` | Tempel catatan, chat WhatsApp, atau lampirkan foto buku, PDF dan Excel. Asisten akan menyusunnya menjadi daftar untuk Anda periksa. | (kept) | Register (G18); Formal ("akan menyusunnya menjadi") | Tempel catatan atau chat WhatsApp, atau lampirkan foto buku, PDF dan Excel. Asisten menyusunnya jadi daftar, lalu kamu cek. | (unchanged) |
| `src/import/ImportAssistant.tsx:242` | Data ini dibaca oleh AI untuk menyusun daftar. Tidak ada yang tersimpan sebelum Anda menekan Simpan. | This data is read by AI to build the list. Nothing is saved until you press Save. | Register (G18); Passive/system | AI membaca data ini untuk menyusun daftar. Belum ada yang tersimpan sampai kamu tekan Simpan. | AI reads this to build the list. Nothing is saved until you press Save. |
| `src/import/ImportAssistant.tsx:252` | Bu Ani – 0812… – Jl. Melati 5 Tebet – Rumahan, sisa 8 hari (placeholder) | (none) | Dash (G18) | Bu Ani, 0812…, Jl. Melati 5 Tebet, Rumahan, sisa 8 hari | (same placeholder) |
| `src/import/rows.ts:22-29` (7 strings) | Nama belum ada; Nomor WhatsApp tidak lengkap; Paket belum dipilih; Alamat belum lengkap; Tanggal mulai belum ada; Tanggal antar berikutnya paling cepat ${earliest}; Sisa hari perlu dicek | (none) | i18n gap; `:28` prints a raw ISO date | Keep; format `${earliest}` with `shortDate` | Name missing; WhatsApp number incomplete; Package not chosen; Address incomplete; Start date missing; Next delivery can be ${date} at the earliest; Check the days left |

### Uang (money)

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/business/money.ts:7` | Dari pengantaran yang belum terjadi. | From deliveries that haven't happened yet. | Glossary | Dari antaran yang belum jalan. | (unchanged) |
| `src/business/money.ts:9` | Ada keluhan pelanggan yang sedang ditinjau. | A customer issue is being reviewed. | Passive/system (no actor) | Catera sedang meninjau keluhan pelanggan. | Catera is reviewing a customer complaint. |
| `src/business/money.ts:10` | Ikut pencairan berikutnya ke rekening Anda. | (kept) | Register (G18) | Ikut pencairan berikutnya ke rekening kamu. | (unchanged) |
| `src/business/money.ts:11` | Sedang dikirim ke rekening Anda. | (kept) | Register (G18) | Sedang dikirim ke rekening kamu. | (unchanged) |
| `src/business/money.ts:12` | Sudah masuk ke rekening Anda. | (kept) | Register (G18) | Sudah masuk ke rekening kamu. | (unchanged) |
| `src/business/UangScreen.tsx:37` | Masuk ke rekening berikutnya | Next payout to your account | Stiff label; repeats the caption below it | Akan masuk ke rekening | Going to your bank |
| `src/business/UangScreen.tsx:41` | Pencairan berikutnya ${date} | Next payout ${date} | Pairs with the label above | Cair ${date} | Pays out ${date} |
| `src/business/UangScreen.tsx:23`, `:64` | Catatan uang belum tersedia. / Catatan uang belum bisa ditampilkan. | Money records aren't available yet. / Money records can't be shown right now. | Calque ("money records") | Rincian uang belum tersedia. / Rincian uang belum bisa ditampilkan. | Money details aren't available yet. / Money details can't be shown right now. |

### Pengaturan

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/settings/ChoiceSheets.tsx:42` | Sistem mengikuti pengaturan ponsel kamu. | System follows your phone's setting. | Vague ("pengaturan" means any setting) | Sistem ikut tema HP kamu. | System matches your phone's theme. |
| `src/settings/ChoiceSheets.tsx:43` | Ikuti sistem memakai pengaturan ponsel kamu. | Follow system uses your phone's setting. | Broken EN; stiff ID | Ikuti sistem berarti ikut tema HP kamu. | Follow system matches your phone's theme. |

### Errors and toasts (global)

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `app/_layout.tsx:133` | Font tidak dapat dimuat. Mulai ulang aplikasi. | (none) | Formal ("tidak dapat"); i18n gap (the language may not be known yet, so a two-line bilingual message is the safe form) | Huruf aplikasi gagal dimuat. Tutup lalu buka lagi aplikasinya. | The app's fonts didn't load. Close and reopen the app. |

Toasts and inline errors on specific screens are in their area tables (ExceptionSheet `:169`, Menu `Belum tersimpan.`, PackageEditor `:57`).

### Empty states

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `src/today/TodayScreen.tsx:531`, `:532` | Tidak ada masakan untuk hari ini. / ...besok. | Nothing to cook today. / ...tomorrow. | Calque ("masakan" is a dish, not cooking work) | Tidak ada yang dimasak hari ini. / ...besok. | (unchanged) |

Also empty states, already flagged above: `TodayScreen.tsx:663-665` (new kitchen) and `DeliveryOrder.tsx:162` (no deliveries).

### Server push bodies a caterer receives

Indonesian only, whatever the caterer's language; changing them needs a new migration that redefines the function, never an edit to an old one.

| file:line | current ID | current EN | problem | proposed ID | proposed EN |
|---|---|---|---|---|---|
| `supabase/migrations/202609090003_hardening.sql:121` | Langganan baru: {paket} | (none) | Glossary (Dapur says "Pesanan baru", `Pengaturan.tsx:56`) | Pesanan baru: {paket} | New order: {package} |
| `supabase/migrations/20260911134456_slot_menu_calendar.sql:440` | Ada permintaan bantuan baru. | (none) | Glossary (Hari ini says "Pertanyaan pelanggan") | Ada pertanyaan baru dari pelanggan. | A customer has a new question. |
| `supabase/migrations/20260917131119_beta_operations.sql:158` | Ada kendala pada pengantaran. Tinjau dan tanggapi. | (none) | Formal | Pelanggan melaporkan masalah antaran. Buka untuk membalas. | A customer reported a delivery problem. Open it to reply. |
| `supabase/migrations/20260917131119_beta_operations.sql:259` | {YYYY-MM-DD} · lunch: Pelanggan belum memilih menu. Tentukan hidangan dan komunikasikan kepada pelanggan. | (none) | Formal; raw ISO date; English "lunch"/"dinner" inside Indonesian | {tanggal} · Siang: pelanggan belum memilih menu. Pilihkan hidangannya, lalu kabari pelanggan. | {date} · Lunch: the customer hasn't chosen a menu. Choose the dishes, then let them know. |
| `supabase/migrations/20260916061905_seller_experience.sql:120` | Status rekening pencairan diperbarui. | (none) | Passive/system | Rekening pencairan kamu sudah diperiksa. Buka untuk lihat hasilnya. | Your payout account has been checked. Open it to see the result. |
| `supabase/migrations/20260916061905_seller_experience.sql:130` | Permintaan akun diperbarui. | (none) | Passive/system | Permintaan akun kamu sudah diproses. | Your account request has been handled. |

Read and kept: `slot_menu_calendar.sql:466` "Pesan baru dari pelanggan."

### The rest (read, not changed, or out of scope)

- `src/today/ExceptionSheet.tsx:273` and `src/import/RowEditor.tsx:117`, the typed "(TTTT-BB-HH)" date fields: FB6 replaces them with a calendar, so no copy proposal is counted.
- `src/settings/Pengaturan.tsx:120` "Segera hadir": G15.
- `customers/CustomerDetail.tsx:69-71` and `today/ReportScreen.tsx:38` ("Masalah ini sudah kami tangani."): sent to the customer, left as they are.
- Shared `errorLabel` (`packages/domain/src/index.ts`) messages appear in Dapur but also on web and in the customer app; the other audit covers them.
- Handoff for the customer-app audit: the customer push after a caterer moves a delivery says "Katerer memperbarui pengantaran sesuai permintaan Anda." (`packages/backend/src/paid-pilot.sql:448`), although the caterer started the move.

**Counts.** Strings read: 443 bilingual `t()` pairs (script count), 93 hard-coded literals found by the AST pass, about 25 more fragments, single-word labels and accessibility labels found by targeted greps, 7 server push bodies and 2 shared share-text lines: about 570 in all. Flagged: 109 strings in 88 table rows (rows that group several strings count each string), of which 6 are server push bodies and 1 is shared. Pattern counts in section 1 overlap, because one string can show two patterns.

## 3. Owner decisions

Not counted as fixes.

- **O1. "Pembantu" for the second role** (`RoleGate.tsx:50,60`, `auth/Masuk.tsx:131`, `business/TimScreen.tsx:55,59`, `business/UsahaScreen.tsx:151`). In everyday Indonesian "pembantu" reads as a household servant. Merchant apps use "staf" or "karyawan". Proposal: "staf dapur" ("kitchen staff"). The role name is fixed by PRODUCT.md, so this is the owner's call.
- **O2. Delivery status words outside Hari ini.** `CustomerDetail.tsx:129` says "Terkirim" where the track says "Sampai". Also choose one English term for Gagal diantar: "Not delivered" (sheet) or "failed" (Hari ini, DESIGN.md:602,615). The audit proposes "Sampai" and "Not delivered". Terjadwal, Dimasak, Berangkat and Sampai read well; no change proposed.
- **O3. "Pindah hari" vs "Pindah tanggal".** The stop button's spoken label says "pindah hari" (`DeliveryOrder.tsx:79-81`, DESIGN.md spec); the sheet option says "Pindah tanggal". Pick one; "Pindah tanggal" matches PRODUCT.md's "Ganti tanggal" family.
- **O4. Glossary.** Pick "antaran" over "pengantaran" in Dapur, and "HP" over "ponsel" (Daftar's title already says "HP"; `Pengaturan.tsx:55,63` and `ChoiceSheets.tsx` say "ponsel").
- **O5. "biasanya ... 1 sampai 2 hari kerja"** (`AktifkanScreen.tsx:97`) is a timing claim (R-17). Keep it only if the review team has that target; otherwise "Tim Catera memeriksa, lalu kami kabari kamu."
- **O6. "Simpan paket" vs "Paket diterbitkan"** (`PackageEditor.tsx:123` vs `:93,106`). If `package.save` publishes at once, the button should say "Terbitkan paket" / "Publish package"; if it saves a draft, the toast is wrong. Confirm which is true before changing either.
- **O7. Push title "Catera" on caterer pushes** (`apps/web/src/lib/push-dispatch.ts:67`) and Indonesian-only push bodies. "Catera Dapur" would tell the caterer which app the push opens; English bodies need a language on the server side.
- **O8. "Dari marketplace"** (`CustomerList.tsx:128`, `CustomerDetail.tsx:96`). "marketplace" is product vocabulary in PRODUCT.md; the audit proposes "Dari Catera". Keep it if the owner wants the term.
- Fixed names left alone: Catera, Dapur, rantang, the tabs (Hari ini, Pelanggan, Menu, Usaha) and the screen names (Uang, Tim, Pengaturan, Aktifkan pembayaran).

## 4. Test impact

Counts are the occurrences of a string this audit would change, per test file. Strings where only English is added and the Indonesian stays (SlotEditor, `package.ts`, `rows.ts`, "+ Pelanggan lama") break no test. Hits in `tests/e2e/*.spec.ts` are web-app strings and are not counted.

| test file | count | strings |
|---|---|---|
| `apps/caterer/tests/today.test.tsx` | 19 | Siapkan dapur Anda (6), Tidak ada masakan untuk (6), Simpan laporan (3), Ada urusan pembayaran (2), Satu layar (1), Deliver 10.30 (1) |
| `apps/caterer/tests/kitchen-loop.test.tsx` | 11 | Simpan laporan (5), marked as failed (2), Pelanggan melihat status Dimasak (1), Centang hanya catatan dapur (1), Pengantaran tercatat sampai otomatis (1), Tidak ada masakan untuk (1) |
| `apps/caterer/tests/dapur-sheets.test.tsx` | 8 | Simpan laporan (4), Laporan tersimpan (3), Pelanggan melihat status Dimasak (1) |
| `apps/caterer/tests/business.test.tsx` | 3 (+3 if O6) | Catatan uang (2), Masuk ke rekening berikutnya (1); Simpan paket (3) |
| `apps/caterer/tests/gate-headers.test.tsx` | 2 | Catatan uang |
| `apps/caterer/tests/native-header.test.tsx` | 1 | Catatan uang |
| `apps/caterer/tests/empty-states.test.tsx` | 1 | Tidak ada masakan untuk |
| `apps/caterer/tests/import.test.tsx` | 1 | Asisten impor belum aktif (only if the test matches past the first sentence) |
| `apps/caterer/tests/settings.test.tsx` | 1 | Ikuti sistem memakai |
| `apps/caterer/tests/layout.test.tsx` | 1 | Font tidak dapat dimuat |
| `apps/caterer/tests/feedback.test.tsx` | 0 (+3 if O6) | Simpan paket |
| `apps/caterer/tests/nutrition.test.tsx` | 0 (+5 if O6) | Simpan paket |
| `tests/*` (root) | 0 | no root test asserts these strings or the push bodies |

DESIGN.md quotes strings this audit would change and needs the same edit: lines 602 and 615 ("marked as failed"), 608 (Centang...), 609 (Pelanggan melihat status Dimasak.), 612 (Simpan laporan), 614 (Pengantaran tercatat sampai otomatis...), 876-877 (Laporan tersimpan).
