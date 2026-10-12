# Customer app copy audit (Indonesian and English)

Date: 2026-10-12. Branch `v2`. Audit only: no source file was edited.

Scope read: `apps/customer/src/**` and `apps/customer/app/**` (tests skipped), the customer-visible strings in `packages/domain/src/**` (error map, status labels, menu labels, availability reasons, date phrasing), `packages/mobile-ui/src/**` (unsaved-guard sheet, mood labels, theme choice), the load and connect fallbacks in `packages/mobile-core/src/**`, and the push bodies the customer receives. `apps/web/src/lib/push-dispatch.ts` only sends `title: "Catera"` and passes `body` through; the bodies are written in `supabase/migrations/*.sql` (`v1.notify` and `v1.beta_notify_once` calls), so they are audited from there.

Path shorthand: `src/` = `apps/customer/src/`, `app/` = `apps/customer/app/`, `domain/` = `packages/domain/src/`, `mobile-ui/` = `packages/mobile-ui/src/`, `mobile-core/` = `packages/mobile-core/src/`, `mig/` = `supabase/migrations/`. Line numbers are the line of the `t(...)` call or the literal.

Skills applied: humanizer, antislop (mode: after, session override), antislop-copywriting, antislop-human, antislop-ui, antislop-layoutmobile, building-native-ui, apple-design, design-taste-frontend, impeccable. `material-3` is not installed in this environment, so its guidance was not applied.

Reference screens: Mobbin was used for English patterns only. Tracking screens from talabat, Glovo, Blue Apron and Subway ([talabat](https://mobbin.com/screens/0eb2fefe-f270-43a1-a94c-1fdde2701e65), [Glovo](https://mobbin.com/screens/688974b6-cb57-483b-b75f-e3b5606b7f7e), [Blue Apron](https://mobbin.com/screens/d1a35bd9-27c7-4dde-b80f-c96699e5a286)) lead with a short status in the user's words and an active actor (the restaurant "is preparing your order"). Payment-failure screens from Waymo, Cash App and talabat ([Waymo](https://mobbin.com/screens/fd48c66c-0a4b-4bff-b6df-64ce81887fb2), [Cash App](https://mobbin.com/screens/a8dd3bc5-6b42-48d0-8046-145abb45b193), [talabat](https://mobbin.com/screens/ce8b2238-1b89-4d12-9174-03d175a98b2c)) say what failed and give one next step, in plain contracted English. No Indonesian app was viewed, so no Indonesian string is attributed to Gojek, GoFood, Tokopedia, Shopee or Grab; where this audit mentions them it describes their general voice (they address the user as "kamu" and drop the pronoun when they can).

Punctuation note: source strings that end in the ellipsis character are written here as "...", and the middle-dot separator used in a few source strings is written as "[dot]". All proposals use ASCII punctuation, no em or en dashes, sentence case.

## 1. Summary: what makes the copy stiff

Most of the customer app is already short and plain. The stiffness clusters in three places: the shared error map in `domain/index.ts`, the push bodies in SQL, and the payment and change-day screens that narrate the system in the passive. Eight patterns account for nearly every flag.

1. **Written-register words in spoken UI (30 strings).** "Silakan", "terlebih dahulu", "tidak dapat", "tersebut", "memiliki", "telah", "berada", "Jika", "yang bersangkutan", "mendatang". These read like a form letter. Examples: `domain/index.ts:631` "Verifikasi email Anda terlebih dahulu. Buka halaman Daftar untuk mengirim ulang tautan."; `domain/index.ts:658` "Langganan ini sudah memiliki pengantaran pada tanggal tersebut."
2. **Passive with no actor, the system narrating itself (22 strings).** Things "dicek ulang", "diperiksa", "dipesan dulu, baru ... dilepas", "ditentukan oleh katering", with nobody doing them. Examples: `src/buy/PaymentOutcome.tsx:112` "Waktu habis. Jadwal dicek ulang saat membayar lagi."; `src/schedule/ChangeDaySheet.tsx:365` "Tempat di hari baru dipesan dulu, baru ${oldDay} dilepas. ${caterer} otomatis tahu."
3. **"Anda" stacking (45 strings).** Capital-A "Anda" every few lines, including possessives ("jadwal antar Anda", "katering Anda", "nomor Anda") that the sentence does not need. Examples: `src/buy/PaidOutcome.tsx:92` "Jadwal antar Anda sudah tersimpan."; `app/_layout.tsx:71` "Menyiapkan Catera untuk Anda...". See section 2 for the register decision.
4. **One generic error for every failure (12 call sites).** "Belum berhasil. Coba lagi." / "That didn't work. Try again." after sending a report, saving a change, starting a payment or posting a review. The user is not told what failed or whether their input was kept. Examples: `src/help/ReportProblem.tsx:219`; `src/schedule/ChangeDaySheet.tsx:49`.
5. **Term drift (24 strings).** The app says "katering" 25 times; the shared domain strings and most pushes say "katerer" (11 customer-visible). Day screen statuses come from `statusLabel` ("Disiapkan", "Dalam pengantaran", "Diterima", "Ada kendala") while Beranda says "Sedang dimasak", "Sedang diantar", "Sudah sampai", "Ada masalah" for the same meal. "Menu belum ditentukan" (5) and "Menu belum diisi" (4) mean the same thing. Examples: `domain/index.ts:652` "Alamat ini berada di luar area pengantaran katerer."; `domain/index.ts:573-575` vs `src/today/Plate.tsx:116-127`.
6. **English that is translated, not written (25 strings).** "yet" carried over from "belum" ("Couldn't load yet", "Can't connect yet"), missing contractions next to contracted siblings ("That did not work" in 4 places, "That didn't work" in 8), "Please" in the error map, and Indonesian screen names leaking into English ("Go to Beranda", "in Jadwal") while the tab's English label is "Home" and "Schedule". Examples: `src/shell.tsx:47` "Can't connect yet."; `src/help/ReportList.tsx:160` "...report it from that day in Jadwal."
7. **Writing about the UI instead of the task (8 strings).** Copy that explains the screen ("akan hadir di sini", "pada tanggal di atas", "Sistem mengikuti pengaturan ...") rather than saying what the person gets or does. Examples: `src/account/Notifications.tsx:81` "Kabar makanan dan bantuan akan hadir di sini."; `src/settings/ChoiceSheets.tsx:43` "Ikuti sistem memakai pengaturan ponsel Anda."
8. **Ambiguity and claims the system cannot back (8 strings).** "Hari ini" used in a sheet about another day reads as "today" (4); a time promise "1 menit", a no-gap promise "tanpa jeda", "dari bank" for a status the payment provider reports, and a "Kami kabari" promise that should be checked against the notification triggers (R-17). Examples: `src/schedule/ChangeDaySheet.tsx:236` "Detail hari ini berubah. Periksa lagi."; `src/today/WaitingList.tsx:191` "Ulasan singkat, 1 menit".

## 2. Register: recommend "kamu"

**Recommendation: move the customer app to "kamu", and drop the pronoun wherever the sentence works without it.** All proposals in section 3 are written that way.

Why:
- The apps the owner named as the target voice (Gojek, GoFood, Tokopedia, Shopee, Grab Indonesia) address the customer as "kamu" or "-mu" and leave the pronoun out when they can. "Anda" is the voice of banks, government portals and terms of service, which is exactly the "kaku" the owner hears.
- The customer already gets "kamu" today: the departure push says "Makan siangmu sedang diantar dari ..." (`mig/20261008102500_depart_today_one_push.sql:29`), while the app and the other pushes say "Anda". One voice fixes that mismatch.
- Dapur already speaks "kamu" (DESIGN.md line ~865), and the shared error map (`domain/index.ts`) is read by both apps. Writing those errors pronoun-free, as proposed below, makes them correct in either app.
- Risk: home-catering customers skew older than Tokopedia's. "kamu" stays polite if it avoids slang ("gak", "aja", "banget", "dong") and keeps full verbs ("memilih", not "milih"). The proposals below follow that line.

If adopted: DESIGN.md line ~865 (unsaved guard, customer "Anda") and line ~838 (launch line) need the new wording, and the customer's `useUnsavedGuard` call should pass `voice: "kamu"` (`mobile-ui/sheets.ts:225` defaults to "anda").

Five before/after pairs in both registers:

| # | Where | Current | Polished "Anda" | Recommended "kamu" |
|---|---|---|---|---|
| 1 | `src/account/Masuk.tsx:74` | Pakai nomor HP yang Anda berikan ke katering. Kami kirim kode lewat SMS. | Pakai nomor HP yang Anda berikan ke katering. Kodenya kami kirim lewat SMS. | Pakai nomor HP yang kamu berikan ke katering. Kodenya kami kirim lewat SMS. |
| 2 | `src/schedule/ChooseMenu.tsx:362` | Jika pilihan belum tersimpan sebelum batas waktu, katering yang memilih menu Anda. | Kalau Anda belum menyimpan pilihan sebelum batas waktu, katering yang memilihkan menunya. | Kalau kamu belum menyimpan pilihan sebelum batas waktu, katering yang memilihkan menunya. |
| 3 | `src/today/Plate.tsx:82` | Belum bisa sekarang. Tunggu jam antar dimulai, atau tunggu balasan atas laporan Anda. | Belum bisa sekarang. Tunggu sampai jam antar mulai, atau sampai laporan Anda dibalas. | Belum bisa sekarang. Tunggu sampai jam antar mulai, atau sampai laporanmu dibalas. |
| 4 | `mobile-ui/sheets.ts:229` (customer voice) | Yang sudah Anda tulis akan hilang. | Yang sudah Anda tulis akan hilang. | Yang sudah kamu tulis akan hilang. |
| 5 | push, `mig/20261008102500_depart_today_one_push.sql:29` | Makan siangmu sedang diantar dari {dapur} | Makan siang Anda sedang diantar dari {dapur} | Makan siangmu sedang diantar dari {dapur} (no change) |

Note pair 4: the polished "Anda" version is unchanged because the sentence was already fine; in "Anda" the only fix available is the pronoun itself.

## 3. Findings by area

Columns: location, current Indonesian, current English, problem (pattern number from section 1 or a named issue), proposed Indonesian ("kamu" register), proposed English. "(keep)" means that language is fine as is. A note on length follows any button or chip label that gets longer.

### 3.1 Masuk, daftar, pulihkan akun, launch

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/account/Masuk.tsx:74` | Pakai nomor HP yang Anda berikan ke katering. Kami kirim kode lewat SMS. | Use the phone number you gave your caterer. We'll text you a code. | 3 | Pakai nomor HP yang kamu berikan ke katering. Kodenya kami kirim lewat SMS. | (keep) |
| `src/account/Masuk.tsx:48` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 (sign-in fallback) | Belum bisa masuk. Coba lagi. | Couldn't sign you in. Try again. |
| `src/account/AuthCallback.tsx:117` | Minimal 8 karakter. Kedua isian harus sama. | At least 8 characters. Both fields must match. | 1 ("isian" is form language) | Minimal 8 karakter, dan keduanya harus sama. | At least 8 characters, and both must match. |
| `src/account/Recover.tsx:33` | Kami kirim tautan ke email Anda. Buka tautan itu di HP ini untuk membuat kata sandi baru. | We will email a link. Open it on this phone to choose a new password. | 3, 6 (no contraction) | Kami kirim tautan ke emailmu. Buka tautannya di HP ini untuk membuat kata sandi baru. | We'll email you a link. Open it on this phone to set a new password. |
| `src/account/Recover.tsx:50` | Jika akun itu terdaftar, email pemulihan telah dikirim. Periksa juga folder spam. | If the account exists, a recovery email has been sent. Check your spam folder too. | 1, 2 | Kalau email itu terdaftar, kami sudah mengirim tautan pemulihan. Cek juga folder spam. | If that email has an account, we've sent a recovery link. Check your spam folder too. |
| `src/account/Register.tsx:60` | Periksa email Anda | Check your email | 3 | Cek emailmu | (keep) |
| `src/account/Register.tsx:62` | Jika alamat ini bisa didaftarkan, tautan verifikasi sudah dikirim. Buka tautan itu di HP ini untuk kembali ke Catera. Periksa juga folder spam. | If this address can be registered, a verification link has been sent. Open it on this phone to return to Catera. Check your spam folder too. | 1, 2 | Kalau email ini bisa didaftarkan, kami sudah mengirim tautan verifikasi. Buka tautannya di HP ini untuk kembali ke Catera. Cek juga folder spam. | If this email can be registered, we've sent a verification link. Open it on this phone to come back to Catera. Check your spam folder too. |
| `src/account/Register.tsx:68` | Permintaan terkirim. Periksa email Anda. | Request sent. Check your email. | 3 | Permintaan sudah dikirim. Cek emailmu. | (keep) |
| `src/account/Register.tsx:80` | Kami kirim tautan verifikasi ke email Anda. | We will send a verification link to your email. | 3, 6 | Kami kirim tautan verifikasi ke emailmu. | We'll send a verification link to your email. |
| `src/account/Register.tsx:107` | Daftar & verifikasi email | Sign up & verify email | Button names two steps but does one (it sends the link; the helper line already says verify) | Daftar | Sign up |
| `src/account/Register.tsx:120` | Sudah punya akun? Masuk | Already registered? Sign in | 6 (stiff EN) | (keep) | Have an account? Sign in |
| `src/account/SignInFirst.tsx:29` | Masuk untuk melihat paket dan jadwal antar Anda. | Sign in to see your packages and deliveries. | 3 | Masuk dulu untuk melihat paket dan jadwal antar. | Sign in to see your plans and deliveries. |
| `src/help/ReportProblem.tsx:68` | Masuk untuk melihat paket dan jadwal antar Anda. | Sign in to see your packages and deliveries. | 3 (same string) | Masuk dulu untuk melihat paket dan jadwal antar. | Sign in to see your plans and deliveries. |
| `app/_layout.tsx:71`, `:154` | Menyiapkan Catera untuk Anda... | Getting Catera ready for you... | 3 (filler "untuk Anda"); named in DESIGN.md ~838 | Menyiapkan Catera... | Getting Catera ready... |
| `src/shell.tsx:47` | Belum bisa terhubung. | Can't connect yet. | 6 ("yet" calque); no next step besides the button | Belum bisa terhubung. Cek koneksimu. | Can't connect. Check your connection. |

### 3.2 Beranda, hero and tracker, Menunggu Anda

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/today/WaitingList.tsx:191` | Ulasan singkat, 1 menit | A short review, 1 minute | 8 (R-17: a duration the app cannot know) | Beri bintang, tulisan boleh menyusul | Give stars, add words if you like |
| `src/today/WaitingList.tsx:180` | Paket penuh | Full plan | Ambiguous action word: "paket penuh" also reads "the plan is full (sold out)"; quoted in DESIGN.md ~564 | Beli paket | Get the plan |
| `src/today/Plate.tsx:82` | Belum bisa sekarang. Tunggu jam antar dimulai, atau tunggu balasan atas laporan Anda. | Not yet. Wait until the delivery window starts, or for a reply to your report. | 3, repeated "tunggu" | Belum bisa sekarang. Tunggu sampai jam antar mulai, atau sampai laporanmu dibalas. | Not yet. Wait until the delivery window starts, or until your report gets a reply. |
| `src/today/Plate.tsx:88` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 (confirm or react failed) | Belum tersimpan. Coba lagi. | Didn't save. Try again. |
| `src/today/Plate.tsx:178` | ${p.window} [dot] belum ada catatan dari dapur | ${p.window} [dot] no update from the kitchen yet | "catatan" (note) is the wrong word for a status nobody tapped | ${p.window} [dot] belum ada kabar dari dapur | ${p.window} [dot] no word from the kitchen yet |
| `src/today/Plate.tsx:179` | Belum ada catatan dari dapur | No update from the kitchen yet | same | Belum ada kabar dari dapur | No word from the kitchen yet |
| `src/today/Plate.tsx:392` | Bagaimana rasanya? Hanya katering yang melihat. | How was it? Only the caterer sees this. | Clipped: "sees" what | Bagaimana rasanya? Cuma katering yang bisa melihat jawabanmu. | How was it? Only the caterer sees your answer. |
| `src/today/EmptyHome.tsx:83` | Pilih paket katering rumahan, diantar sesuai jadwal Anda. | Pick a home-style catering package, delivered on your schedule. | 3 | Pilih paket katering rumahan, diantar sesuai jadwalmu. | (keep) |
| `src/today/EmptyHome.tsx:109` | Dapat tautan dari katering Anda? Buka tautannya untuk menyambungkan paket ke akun ini. | Got a link from your caterer? Open it to connect your package to this account. | 3 | Dapat tautan dari katering? Buka tautannya untuk menyambungkan paketmu ke akun ini. | (keep) |
| `domain/index.ts:573` (statusLabel `preparing`, shown on the day screen `src/schedule/DayScreen.tsx:101`) | Disiapkan | Preparing | 5 (Beranda says "Sedang dimasak" / "Cooking") | Dimasak | Cooking |
| `domain/index.ts:574` (`out_for_delivery`) | Dalam pengantaran | Out for delivery | 5 (Beranda: "Sedang diantar" / "On the way") | Sedang diantar | On the way |
| `domain/index.ts:575` (`delivered`) | Diterima | Delivered | 5 (Beranda: "Sudah sampai" / "Arrived"); "Diterima" also implies the customer received it in hand | Sampai | Arrived |
| `domain/index.ts:576` (`issue`) | Ada kendala | Issue reported | 5 (app: "Ada masalah", "Laporan terkirim") | Ada laporan | Problem reported |

Note on the four `statusLabel` rows: `statusLabel` is shared with the web app and Dapur. Change only the customer reading (a customer-facing variant, or pass the app's own words on the day screen) if Dapur should keep its labels.

### 3.3 Menu besok

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/tomorrow/TomorrowStory.tsx:215` | Menu belum diisi oleh ${part.catererName} | ${part.catererName} has not set this menu yet | 2 (passive with "oleh"), 6 | ${part.catererName} belum mengisi menunya | ${part.catererName} hasn't set this menu yet |
| `src/tomorrow/TomorrowRow.tsx:26` | Sudah lewat batas ubah | Change window closed | Clipped noun phrase "batas ubah" | Sudah tidak bisa diubah | Can't be changed anymore |
| `src/tomorrow/TomorrowStory.tsx:222` | Sudah lewat batas ubah | Change window closed | same | Sudah tidak bisa diubah | Can't be changed anymore |
| `src/tomorrow/TomorrowStory.tsx:125` | Belum bisa memuat | Could not load yet | 6 | (keep) | Couldn't load tomorrow's menu |

### 3.4 Rencana and plan detail

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/plan/PlanDetail.tsx:149` | Belum bisa memuat | Couldn't load yet | 6 | Belum bisa memuat paket | Couldn't load this plan |
| `src/plan/PlanDetail.tsx:313` | Tidak ada antaran mendatang. | No upcoming deliveries. | 1 ("mendatang" is bookish) | Belum ada antaran berikutnya. | (keep) |
| `src/plan/PlanDetail.tsx:281` | Menu belum ditentukan | Menu not set yet | 5 (Jadwal and Menu besok say "Menu belum diisi") | Menu belum diisi | (keep) |
| `src/today/UpcomingDays.tsx:37` | Menu belum ditentukan | Menu not set yet | 5 | Menu belum diisi | (keep) |
| `src/schedule/dayActions.ts:69` | Menu belum ditentukan | Menu not set yet | 5 | Menu belum diisi | (keep) |
| `domain/contents.ts:339` (menuSummary) | Menu belum ditentukan | Menu not yet set | 5; EN word order differs from the app | Menu belum diisi | Menu not set yet |
| `domain/package-presentation.ts:72` (menuSourceLabel) | Menu belum ditentukan | Menu not yet set | 5 | Menu belum diisi | Menu not set yet |
| `domain/contents.ts:337` (menuSummary) | Katerer memilih | Caterer chooses | 5 ("katerer" vs the app's "katering") | Katering memilih | (keep) |
| `domain/package-presentation.ts:70` (menuSourceLabel) | Katerer memilih | Caterer chooses | 5 | Katering memilih | (keep) |
| `src/plan/PlanDetail.tsx:83`, `:164` | Ke Beranda | Go to Beranda | 6 (the tab's English label is "Home") | (keep) | Go to Home |

### 3.5 Beli, checkout and payment

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/buy/BuyParts.tsx:131` | Dengan membayar, Anda setuju dengan | By paying, you agree to the | 3 | Dengan membayar, kamu setuju dengan | (keep) |
| `src/buy/BuyScreen.tsx:202` | katering Anda | your caterer | 3 | kateringmu | (keep) |
| `src/buy/BuyScreen.tsx:187` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 (creating the checkout failed) | Pembayaran belum bisa dimulai. Coba lagi. | Couldn't start the payment. Try again. |
| `src/buy/BuyScreen.tsx:276` | Lama paket | Length | 6 (EN too terse to read alone) | (keep) | Plan length |
| `src/buy/PaidOutcome.tsx:92` | Jadwal antar Anda sudah tersimpan. | Your deliveries are booked. | 3; quoted in DESIGN.md ~596 | Jadwal antar sudah kami simpan. | (keep) |
| `src/buy/PaidOutcome.tsx:166` | Ke Beranda | Go to Beranda | 6 | (keep) | Go to Home |
| `src/buy/PaymentOutcome.tsx:110` | Jangan bayar lagi. Status diperiksa langsung dari bank. | Don't pay again. The status is checked with the bank. | 2, 8 (the status comes from the payment provider, not always a bank, e.g. QRIS) | Jangan bayar lagi. Kami sedang mengecek statusnya. | Don't pay again. We're checking the status. |
| `src/buy/PaymentOutcome.tsx:112` | Waktu habis. Jadwal dicek ulang saat membayar lagi. | Time's up. The schedule is checked again when you pay. | 2 | Waktu bayar habis. Kalau bayar lagi, kami cek ulang jadwalnya dulu. | Payment time ran out. If you pay again, we'll check the schedule first. |
| `src/buy/PaymentOutcome.tsx:113` | Pembayaran gagal. Jadwal dicek ulang saat membayar lagi. | Payment failed. The schedule is checked again when you pay. | 2 | Pembayaran gagal. Kalau bayar lagi, kami cek ulang jadwalnya dulu. | Payment failed. If you pay again, we'll check the schedule first. |
| `src/buy/PaymentOutcome.tsx:116` | Pembayaran diterima, tetapi jadwal belum terkonfirmasi. Tim Catera membantu menyelesaikannya. Jangan bayar lagi. | Payment arrived but the schedule isn't confirmed yet. Catera will sort it out. Don't pay again. | 1 ("tetapi", "terkonfirmasi") | Pembayaranmu sudah masuk, tapi jadwalnya belum pasti. Tim Catera sedang membantu menyelesaikannya. Jangan bayar lagi. | Your payment came through, but the schedule isn't confirmed yet. The Catera team is helping sort it out. Don't pay again. |
| `src/buy/PaymentScreen.tsx:184` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 (status check or payment start failed) | Belum bisa mengecek pembayaran. Coba lagi. | Couldn't check the payment. Try again. |
| `src/buy/PaymentScreen.tsx:374` | ${n} hari antar Anda dijaga selama 15 menit. Lewat dari itu, jadwal dicek ulang sebelum dibayar. | {Your delivery day is / Your n delivery days are} held for 15 minutes. After that, the schedule is checked again before payment. | 2, 3 | Kami tahan ${n} hari antarmu selama 15 menit. Lewat dari itu, jadwalnya kami cek ulang sebelum kamu bayar. | We're holding {your delivery day / your n delivery days} for 15 minutes. After that, we check the schedule again before you pay. |
| `src/account/Payments.tsx:27` | Pembayaran diterima, pemesanan sedang ditinjau Catera | Payment received, Catera is reviewing the order | 2, comma splice | Pembayaran masuk. Catera sedang mengecek pesananmu | Payment received. Catera is checking your order |
| `src/account/Payments.tsx:84` | Pembayaran yang menunggu belum bisa dimuat. | Payments waiting could not be loaded. | 2, 6 | Belum bisa memuat pembayaran yang tertunda. | Couldn't load your pending payments. |
| `src/account/Payments.tsx:113` | Jangan membayar lagi. Kami kabari setelah selesai. | Don't pay again. We'll let you know when it's done. | 8 (R-17 check: the payment-state trigger at `mig/20260917131119_beta_operations.sql:232` sends nothing on success; the purchase push "Paket Anda sudah aktif" may cover it. Keep "Kami kabari" only if that push fires on this path) | Jangan bayar lagi. Statusnya muncul di sini setelah selesai. | Don't pay again. The status shows here once it's done. |
| `src/account/Payments.tsx:181` | Paket yang Anda beli lewat Catera muncul di sini. | Packages you buy through Catera appear here. | 3 | Paket yang kamu beli lewat Catera muncul di sini. | Plans you buy through Catera show up here. |

### 3.6 Ubah hari

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/schedule/ChangeDaySheet.tsx:236` | Detail hari ini berubah. Periksa lagi. | This day changed. Please check again. | 8 ("hari ini" reads as "today" in a sheet about another day) | Ada yang berubah di hari itu. Cek lagi sebelum lanjut. | Something changed on this day. Check it again. |
| `src/schedule/ChangeDaySheet.tsx:48` | Hari ini sudah tidak bisa diubah. | This day can no longer be changed. | 8 (same ambiguity) | Hari itu sudah tidak bisa diubah. | (keep) |
| `src/schedule/ChangeDaySheet.tsx:275` | Hari ini sudah tidak bisa diubah | This day can no longer be changed | 8 | Hari itu sudah tidak bisa diubah | (keep) |
| `src/schedule/dayActions.ts:56` | Ganti alamat hari ini | Change today's address | 8 (the row may be any day, not today) | Ganti alamat antar | Change delivery address |
| `src/schedule/ChangeDaySheet.tsx:49` | Belum berhasil. Coba lagi. | That did not work. Try again. | 4, 6 | Perubahannya belum tersimpan. Coba lagi. | Your change didn't save. Try again. |
| `src/schedule/ChangeDaySheet.tsx:258` | Hari dipindah ke ${label} | Day moved to ${label} | 2 | Antaran pindah ke ${label} | Delivery moved to ${label} |
| `src/schedule/ChangeDaySheet.tsx:365` | Tempat di hari baru dipesan dulu, baru ${oldDay} dilepas. ${caterer} otomatis tahu. | The new day is booked first, then ${oldDay} is released. ${caterer} is told automatically. | 2 | Kami pesan tempat di hari baru dulu, baru ${oldDay} dilepas. ${caterer} otomatis dapat kabar. | We book the new day first, then release ${oldDay}. ${caterer} is told automatically. |
| `src/schedule/dayActions.ts:74` | Sudah lewat batas ubah | Past the change cutoff | Clipped noun phrase | Sudah tidak bisa diubah | Can't be changed anymore |
| `domain/delivery-availability.ts:19` (OVERLAP, shown in the date list) | Bertabrakan dengan paket aktif | Overlaps an active package | Literal "collides" | Bentrok dengan paket aktif | Clashes with an active plan |
| `src/account/AddressForm.tsx:206` | Alamat pengantaran yang sudah dijadwalkan hanya berubah lewat Ubah hari di Jadwal. | A delivery already scheduled changes its address only through Change day in Schedule. | 2, 7 | Mengubah alamat ini tidak mengubah antaran yang sudah terjadwal. Untuk itu, pakai Ubah hari di Jadwal. | Changing this address doesn't change deliveries already scheduled. For those, use Change day in Schedule. |

### 3.7 Pilih menu

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/schedule/ChooseMenu.tsx:111` | Tinggalkan perubahan? | Discard changes? | Every other discard sheet says "Buang ...?" (`mobile-ui/sheets.ts:228`) | Buang pilihan menu? | Discard menu choices? |
| `src/schedule/ChooseMenu.tsx:112` | Menu yang belum disimpan akan dihapus. | Unsaved menu changes will be discarded. | 2 | Pilihan yang belum disimpan akan hilang. | Choices you haven't saved will be lost. |
| `src/schedule/ChooseMenu.tsx:113` | Tinggalkan | Discard | Consistency with "Buang" (shorter) | Buang | (keep) |
| `src/schedule/ChooseMenu.tsx:114`, `:471` | Lanjut mengedit | Keep editing | Says "edit" on a choosing screen | Lanjut memilih | Keep choosing |
| `src/schedule/ChooseMenu.tsx:290` | Menu paket ini ditentukan oleh katering. | The caterer chooses this package's menus. | 2 | Katering yang memilih menu paket ini. | The caterer picks the menu for this plan. |
| `src/schedule/ChooseMenu.tsx:362` | Jika pilihan belum tersimpan sebelum batas waktu, katering yang memilih menu Anda. | If no choice is saved before the cutoff, the caterer chooses your menu. | 1, 2, 3 | Kalau kamu belum menyimpan pilihan sebelum batas waktu, katering yang memilihkan menunya. | If you don't save a choice before the cutoff, the caterer picks for you. |
| `src/schedule/ChooseMenu.tsx:381` | Batas pilihan sudah lewat. Pilihan ini tidak bisa disimpan; katering yang memilih. | The cutoff has passed. This choice can't be saved; the caterer chooses. | Semicolon in UI copy, cause and effect split | Batas memilih sudah lewat, jadi pilihan ini tidak bisa disimpan. Katering yang memilihkan. | The cutoff has passed, so this choice can't be saved. The caterer will pick. |
| `src/schedule/ChooseMenu.tsx:456` | Pilihan yang sudah tersimpan pada tanggal di atas akan diganti. Semua porsi mendapat menu yang sama. | Choices already saved on these dates will be replaced. All portions get the same menu. | 7 ("di atas") | Pilihan yang sudah tersimpan di tanggal-tanggal ini akan diganti. Semua porsi dapat menu yang sama. | Choices already saved on these dates will be replaced. Every portion gets the same menu. |
| `src/schedule/ChooseMenu.tsx:487` | Pilihan pada tanggal di atas dihapus. Katering memilih jika Anda tidak memilih lagi sebelum batas waktu. | Choices on these dates are removed. The caterer chooses if you don't choose again before the cutoff. | 1, 3, 7; also a confirm sheet that speaks as if it already happened | Pilihan di tanggal-tanggal ini akan dihapus. Kalau kamu tidak memilih lagi sebelum batas waktu, katering yang memilihkan. | Your choices on these dates will be removed. If you don't choose again before the cutoff, the caterer picks. |

### 3.8 Ada masalah, bantuan dan laporan

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/help/ReportProblem.tsx:31` | Makanan tidak layak | The food is not fit to eat | 6; ID reads unfinished | Makanannya tidak layak dimakan | The food isn't fit to eat |
| `src/help/ReportProblem.tsx:214` | Laporan bisa dikirim mulai hari pengantaran, setelah jam antar dimulai. | You can report from the delivery day, once the delivery window starts. | 2 | Kamu bisa melapor mulai hari antar, setelah jam antarnya mulai. | (keep) |
| `src/help/ReportProblem.tsx:219` | Belum berhasil. Coba lagi. | That did not work. Try again. | 4, 6 | Laporannya belum terkirim. Coba lagi. | Your report didn't send. Try again. |
| `src/help/HelpForm.tsx:42` | Belum berhasil. Coba lagi. | That did not work. Try again. | 4, 6 | Permintaannya belum terkirim. Coba lagi. | Your request didn't send. Try again. |
| `src/help/HelpForm.tsx:189` | Permintaan bantuan butuh paket yang sudah dibeli. | A help request needs a package you bought. | 7 (describes the system's rule) | Kamu bisa minta bantuan setelah membeli paket. | You can ask for help once you've bought a plan. |
| `src/help/HelpForm.tsx:217` | Ceritakan kendalanya | Tell us what is wrong | 5 ("kendala" vs the app's "masalah"), 6 | Ceritakan masalahnya | Tell us what's wrong |
| `src/help/HelpForm.tsx:293` | Apa yang belum beres? | What is still wrong? | 6 | (keep) | What's still wrong? |
| `src/help/ReportList.tsx:160` | Kalau ada masalah dengan makanan, laporkan dari hari yang bersangkutan di Jadwal. | If something is wrong with a meal, report it from that day in Jadwal. | 1 ("yang bersangkutan"), 6 (Indonesian tab name in EN) | Ada masalah dengan makanan? Laporkan dari hari itu di Jadwal. | Something wrong with a meal? Report it from that day in Schedule. |
| `src/help/ReportList.tsx:283` | Belum berhasil. Coba lagi. | That did not work. Try again. | 4, 6 (escalation failed) | Belum bisa diteruskan ke Catera. Coba lagi. | Couldn't send this to Catera. Try again. |

### 3.9 Pengaturan and akun

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/settings/ChoiceSheets.tsx:42` | Sistem mengikuti pengaturan ponsel Anda. | System follows your phone's setting. | 3, 7 | Pilih Sistem supaya tampilan ikut pengaturan ponselmu. | Choose System to match your phone's setting. |
| `src/settings/ChoiceSheets.tsx:43` | Ikuti sistem memakai pengaturan ponsel Anda. | Follow system uses your phone's setting. | 3, 7 | Pilih Ikuti sistem supaya tampilan ikut pengaturan ponselmu. | Choose Follow system to match your phone's setting. |
| `src/settings/Pengaturan.tsx:37` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 (a settings change that did not go through) | Perubahannya belum tersimpan. Coba lagi. | Your change didn't save. Try again. |
| `src/account/Notifications.tsx:81` | Kabar makanan dan bantuan akan hadir di sini. | Meal and support updates will appear here. | 7 ("akan hadir" is a calque) | Kabar soal makananmu dan permintaan bantuan muncul di sini. | Updates on your meals and help requests show up here. |
| `src/discover/SavedList.tsx:103` | Ketuk hati pada paket yang Anda suka. | Tap the heart on a package you like. | 3 | Ketuk hati di paket yang kamu suka. | (keep) |
| `mobile-ui/sheets.ts:229` (customer passes voice "anda") | Yang sudah Anda tulis akan hilang. | What you wrote will be lost. | 3 | Yang sudah kamu tulis akan hilang. (pass `voice: "kamu"`) | (keep) |

### 3.10 Klaim langganan (WhatsApp link)

The web claim page asserts the same Indonesian copy (`tests/claim-web.test.tsx`), so a change here should be mirrored on web.

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/claim/ClaimScreen.tsx:79` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 | Belum bisa menyambungkan langganan. Coba lagi. | Couldn't connect the subscription. Try again. |
| `src/claim/ClaimScreen.tsx:115` | Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda. | This link can't be used. Ask your caterer for a new one. | 3 | Tautan ini tidak bisa dipakai. Minta tautan baru ke kateringmu. | (keep) |
| `src/claim/ClaimScreen.tsx:125` | Belum bisa memuat | Couldn't load yet | 6 | (keep) | Couldn't load |
| `src/claim/ClaimScreen.tsx:148` | ${katering} perlu memeriksa langganan ini dulu. Pengantaran Anda tetap berjalan. | ${katering} needs to check this subscription first. Your deliveries continue. | 3 | ${katering} perlu mengecek langganan ini dulu. Antaranmu tetap jalan. | ${katering} needs to check this subscription first. Your deliveries carry on. |
| `src/claim/ClaimScreen.tsx:160` | Langganan Anda sekarang ada di Catera | Your subscription is now on Catera | 3 | Langgananmu sekarang ada di Catera | (keep) |
| `src/claim/ClaimScreen.tsx:168` | Bukan nomor Anda? Minta ${katering} mengirim tautan baru. | Not your number? Ask ${katering} to send a new link. | 3 | Bukan nomormu? Minta ${katering} mengirim tautan baru. | (keep) |
| `src/claim/ClaimScreen.tsx:183` | Sudah dibayar ke ${katering}, tidak ada tagihan baru. Di sini Anda bisa melihat menu, tahu kapan makanan berangkat, dan memindah hari. | Already paid to ${katering}, no new bill. Here you can see the menu, know when your food leaves, and move days. | 3; "memindah" is clipped | Sudah dibayar ke ${katering}, tidak ada tagihan baru. Di sini kamu bisa melihat menu, tahu kapan makanan berangkat, dan memindahkan hari antar. | Already paid to ${katering}, no new bill. Here you can see the menu, know when your food leaves, and move delivery days. |
| `src/claim/ClaimScreen.tsx:204` | Nomor HP Anda | Your phone number | 3 | Nomor HP kamu | (keep) |
| `src/claim/ClaimScreen.tsx:236` | Nomor ini berbeda dengan yang dicatat ${katering}. Pakai nomor yang Anda berikan ke ${katering}, atau minta ${katering} memperbarui nomor Anda. | This number differs from the one ${katering} has. Use the number you gave ${katering}, or ask ${katering} to update it. | 3; caterer name three times in two sentences | Nomor ini beda dengan yang dicatat ${katering}. Pakai nomor yang kamu berikan ke mereka, atau minta mereka memperbarui nomormu. | This number doesn't match the one ${katering} has. Use the number you gave them, or ask them to update it. |
| `src/claim/ClaimScreen.tsx:261` | Nama Anda | Your name | 3 | Namamu | (keep) |
| `src/claim/ClaimScreen.tsx:273` | Dengan melanjutkan, Anda setuju dengan Ketentuan dan Kebijakan Privasi Catera. | By continuing, you agree to Catera's Terms and Privacy Policy. | 3 | Dengan melanjutkan, kamu setuju dengan Ketentuan dan Kebijakan Privasi Catera. | (keep) |

### 3.11 Errors (shared error map and load fallbacks)

`domain/index.ts` `errors` / `errorsEn` is read by the customer app, Dapur and web. Proposals are pronoun-free so they suit both registers. Only codes a customer can reach are listed; seller-only codes (settlement, package editing, refunds, booked dates) belong to the Dapur audit. Line numbers are the Indonesian entry; the English entry is 65 lines lower.

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `domain/index.ts:607` PAYMENT_UNAVAILABLE | Pembayaran sedang tidak tersedia. Silakan coba lagi nanti. | Payment is currently unavailable. Please try again later. | 1, 6 | Pembayaran sedang tidak bisa dipakai. Coba lagi nanti. | Payments aren't available right now. Try again later. |
| `domain/index.ts:609` PAYMENT_METHOD_LOCKED | Metode pembayaran sudah dipilih dan tidak dapat diganti. | The payment method has already been selected and cannot be changed. | 1, 2 | Cara bayar untuk pesanan ini sudah dipilih dan tidak bisa diganti. | This order's payment method is set and can't be changed. |
| `domain/index.ts:613` BOOKING_HORIZON | Seluruh pengantaran harus selesai dalam 366 hari ke depan. Pilih durasi lebih pendek atau tanggal lebih awal. | All deliveries must finish within the next 366 days. Choose a shorter term or earlier start. | 1 | Semua antaran harus selesai dalam 366 hari dari sekarang. Pilih paket yang lebih pendek atau mulai lebih awal. | All deliveries have to finish within 366 days from now. Pick a shorter plan or an earlier start. |
| `domain/index.ts:623` OPTION_CHANGED | Pilihan hidangan telah berubah. Muat ulang dan pilih hidangan yang tersedia. | Dish options changed. Reload and choose available dishes. | 1 | Pilihan hidangannya sudah berubah. Muat ulang, lalu pilih yang tersedia. | The dish options changed. Reload and pick from what's available. |
| `domain/index.ts:627` COMPOSITION_CHANGED | Isi menu harus sesuai komposisi yang dibeli. Gunakan versi isi paket yang benar. | The menu must match the purchased composition. Use the correct package revision. | System jargon ("komposisi", "versi isi paket") the customer cannot act on. Verify the meaning with the backend before shipping | Isi paket ini baru berubah. Muat ulang, lalu pilih lagi. | This plan's contents just changed. Reload and choose again. |
| `domain/index.ts:629` PRICE_CHANGED | Harga atau ketentuan berubah. Tinjau ulang sebelum membayar. | The price or terms changed. Review them before paying. | 1 ("Tinjau ulang") | Harga atau ketentuannya berubah. Cek lagi sebelum bayar. | The price or terms changed. Check them before you pay. |
| `domain/index.ts:630` UNAUTHORIZED | Silakan masuk kembali. | Please sign in again. | 1, 6 | Masuk lagi untuk melanjutkan. | Sign in again to continue. |
| `domain/index.ts:631` EMAIL_NOT_CONFIRMED | Verifikasi email Anda terlebih dahulu. Buka halaman Daftar untuk mengirim ulang tautan. | Verify your email first. Open Register to resend the link. | 1, 3 | Verifikasi email dulu. Tautannya bisa dikirim ulang dari halaman Daftar. | Verify your email first. You can resend the link from Sign up. |
| `domain/index.ts:635` AUTH_UNAVAILABLE | Layanan akun belum tersedia. Silakan coba lagi nanti. | Account services are unavailable. Please try again later. | 1, 6 | Belum bisa masuk sekarang. Coba lagi nanti. | Sign-in isn't available right now. Try again later. |
| `domain/index.ts:636` RECOVERY_EXPIRED | Sesi pemulihan tidak valid atau kedaluwarsa. Minta tautan pemulihan baru. | The recovery session is invalid or expired. Request a new recovery link. | 1 (system words "sesi", "valid") | Tautan pemulihannya sudah tidak berlaku. Minta tautan baru. | This recovery link no longer works. Request a new one. |
| `domain/index.ts:638` INVALID_CREDENTIALS | Email atau kata sandi tidak cocok. Silakan coba lagi. | Email or password is incorrect. Please try again. | 1, 6 | Email atau kata sandinya salah. Coba lagi. | Wrong email or password. Try again. |
| `domain/index.ts:641` FORBIDDEN | Akun ini tidak memiliki akses. | This account does not have access. | 1, 6 | Akun ini tidak punya akses ke halaman ini. | This account can't open this. |
| `domain/index.ts:652` COVERAGE | Alamat ini berada di luar area pengantaran katerer. | This address is outside the caterer's delivery area. | 1, 5 | Alamat ini di luar area antar katering. | (keep) |
| `domain/index.ts:653` CONFLICT | Data sudah berubah. Muat ulang sebelum mencoba lagi. | The data changed. Reload before trying again. | 1 ("Data") | Ada yang berubah. Muat ulang, lalu coba lagi. | Something changed. Reload and try again. |
| `domain/index.ts:654` OVERLAP | Paket yang sama masih berjalan pada rentang tanggal ini. | The same package is already active during these dates. | 1 | Paket yang sama masih berjalan di tanggal-tanggal ini. | The same plan is already running on these dates. |
| `domain/index.ts:655` TRIAL_USED | Anda sudah pernah membeli trial dari katerer ini. | You have already bought a trial from this caterer. | 3, 5 ("trial", "katerer"; the app says "paket coba", "katering"), 6 | Paket coba dari katering ini sudah pernah kamu beli. | You've already had a trial from this caterer. |
| `domain/index.ts:656` FIXED_PACKAGE | Jadwal paket ini tetap. Hubungi katerer jika membutuhkan bantuan. | This package has fixed dates. Contact the caterer for help. | 1, 5 | Jadwal paket ini tidak bisa diubah. Butuh bantuan? Hubungi katering. | This plan's dates can't be changed. Need help? Contact the caterer. |
| `domain/index.ts:658` DUPLICATE_DATE | Langganan ini sudah memiliki pengantaran pada tanggal tersebut. | This subscription already has a delivery on that date. | 1 | Paket ini sudah ada antaran di tanggal itu. | This plan already has a delivery on that date. |
| `domain/index.ts:660` INVALID_DATE | Tanggal tidak sesuai hari operasional paket. | The date is not an operating day for this package. | 1 ("hari operasional"), 6 | Katering tidak mengantar paket ini di tanggal itu. | The caterer doesn't deliver this plan on that date. |
| `domain/index.ts:661` INVALID_INPUT | Periksa kembali data yang Anda masukkan. | Check the information you entered. | 1, 3 | Ada isian yang belum benar. Cek lagi, ya. | Something isn't right. Check what you entered. |
| `domain/index.ts:662` NOT_FOUND | Data tidak ditemukan. | The requested data was not found. | 1 ("Data") , 6 | Yang dicari tidak ada. | We couldn't find that. |
| `domain/index.ts:663` NOT_CONFIGURED | Layanan ini belum dikonfigurasi. Silakan hubungi Catera. | This service is not configured. Please contact Catera. | 1, 6 | Fitur ini belum siap. Hubungi Catera. | This isn't set up yet. Contact Catera. |
| `domain/index.ts:664` REQUEST_TIMEOUT | Koneksi terlalu lama. Periksa koneksi dan coba lagi. | Connection timed out. Check your connection and try again. | Calque of "connection timed out" | Terlalu lama menunggu jawaban. Cek koneksi lalu coba lagi. | This took too long. Check your connection and try again. |
| `domain/index.ts:665` INVALID_API_RESPONSE | Catera sementara tidak tersedia. Silakan coba lagi. | Catera is temporarily unavailable. Please try again. | 1, 6 | Catera sedang tidak bisa dihubungi. Coba lagi sebentar lagi. | Catera isn't responding right now. Try again in a moment. |
| `domain/index.ts:666` PAYMENT_PENDING | Pembayaran belum terkonfirmasi. | Payment has not been confirmed. | 1, 6 | Pembayarannya belum masuk. | We haven't received the payment yet. |
| `mobile-core/data.ts:78` | Tidak dapat memuat. Periksa koneksi dan coba lagi. | Unable to load. Check your connection and try again. | 1, 6 ("Unable to") | Belum bisa memuat. Cek koneksi lalu coba lagi. | Couldn't load. Check your connection and try again. |
| `mobile-core/provider.tsx:84` | Tidak dapat terhubung. Periksa koneksi dan coba lagi. | Unable to connect. Check your connection and try again. | 1, 6 | Belum bisa terhubung. Cek koneksi lalu coba lagi. | Can't connect. Check your connection and try again. |
| `src/discover/saved.ts:97` | Tidak dapat memuat lagi. Coba lagi. | Could not load more. Try again. | 1, 6 | Belum bisa memuat lebih banyak. Coba lagi. | Couldn't load more. Try again. |
| `src/today/ReviewSheet.tsx:160` | Belum berhasil. Coba lagi. | That didn't work. Try again. | 4 | Ulasannya belum terkirim. Coba lagi. | Your review didn't send. Try again. |

`src/account/failure.ts:6` keeps "Belum berhasil. Coba lagi." as the last-resort fallback when nothing more specific is known; it is not flagged.

### 3.12 Push notifications (customer receives; Indonesian only, title "Catera")

Each body is also listed in the in-app Notifikasi screen. These have no English. The function holding each body is redefined in later migrations in places; the newest definition should be edited.

| Location | Current ID | Problem | Proposed ID |
|---|---|---|---|
| `mig/202609090003_hardening.sql:120` (purchase) | Paket Anda sudah aktif. Lihat jadwal makanan berikutnya. | 3 | Paketmu sudah aktif. Cek jadwal antar berikutnya. |
| `mig/202609090003_hardening.sql:207` (change) | Perubahan pengantaran sudah tersimpan. | 2 | Perubahan antaranmu sudah kami simpan. |
| `mig/20260914160856_paid_seller_pilot.sql:448` (change by caterer) | Katerer memperbarui pengantaran sesuai permintaan Anda. | 3, 5 | Katering sudah mengubah antaranmu sesuai permintaan. |
| `mig/202609090003_hardening.sql:233` (support) | Permintaan bantuan Anda diperbarui. | 2, 3; does not say what changed | Ada kabar baru soal permintaan bantuanmu. |
| `mig/20260916061905_seller_experience.sql:98` (message) | Pesan baru dari katerer. | 5 | Ada pesan baru dari katering. |
| `mig/20260911134456_slot_menu_calendar.sql:146` (menu) | Menu pengantaran Anda diperbarui. | 2, 3 | Katering mengubah menu antaranmu. |
| `mig/202609090003_hardening.sql:341` (refund) | Pengembalian dana sudah diproses. | 2 | Pengembalian danamu sudah diproses. |
| `mig/202609090003_hardening.sql:357` (tomorrow) | Besok ada makanan untuk Anda. Periksa menu dan alamatnya. | 3 | Besok ada kiriman makanan. Cek menu dan alamatnya. |
| `mig/20261008114500_maintenance_renewal_conflict.sql:12` (renewal, links to /renew) | Paket hampir selesai. Pilih makanan untuk hari-hari berikutnya. | Says "pick food" but opens the renewal | Paketmu hampir selesai. Perpanjang supaya antarannya lanjut. |
| `mig/20261008111000_push_report_renewal_dedupe.sql:22` (renewal, 3 days) | Paket {nama} tinggal 3 hari. Perpanjang tanpa jeda. | 8 (R-17: "tanpa jeda" promises no gap; capacity can still block the next dates) | Paket {nama} tinggal 3 hari lagi. Perpanjang sekarang kalau mau lanjut. |
| `mig/20260914055559_customer_choice_menus.sql:219` (menu choice) | Pilih menu untuk pengantaran Anda sebelum batas waktu. Jika belum memilih, katerer menentukan hidangannya. | 1, 3, 5 | Pilih menu antaranmu sebelum batas waktu. Kalau belum memilih, katering yang memilihkan. |
| `mig/20260917131119_beta_operations.sql:256` (choice reminder) | {service_date} (middle dot) Siang: Pilih menu sebelum batas waktu; jika belum memilih, katerer menentukan hidangannya. | 1, 5; the date prints as a raw ISO date (2026-10-13); semicolon | Menu siang {Selasa 13 Okt} belum dipilih. Pilih sebelum batas waktu, atau katering yang memilihkan. (needs an Indonesian date format in SQL) |
| `mig/20260917131119_beta_operations.sql:256` (choice fallback) | {service_date} (middle dot) Siang: Batas waktu telah lewat. Katerer memilih hidangan Anda; pengantaran tetap berjalan. | 1, 3, 5; raw ISO date | Batas memilih menu siang {Selasa 13 Okt} sudah lewat, jadi katering yang memilihkan. Antaran tetap jalan. |
| `mig/20260917131119_beta_operations.sql:233` (payment pending) | Pembayaran belum selesai. Lanjutkan pembayaran sebelum batas waktu. | Repeats "pembayaran" | Pembayaranmu belum selesai. Selesaikan sebelum waktunya habis. |
| `mig/20260917131119_beta_operations.sql:234` (payment failed) | Pembayaran gagal. Periksa status sebelum meninjau pembelian kembali. | 1 ("meninjau pembelian kembali") | Pembayaran gagal. Cek statusnya sebelum mencoba beli lagi. |
| `mig/20260917131119_beta_operations.sql:235` (payment expired) | Waktu pembayaran habis. Periksa status dan tinjau ulang ketersediaan. | 1 | Waktu bayar habis. Kalau mau beli lagi, cek dulu jadwal yang masih tersedia. |
| `mig/20260917131119_beta_operations.sql:236` (payment exception) | Pembayaran memerlukan peninjauan Catera. Jangan melakukan pembayaran ulang untuk pesanan ini. | 1 ("memerlukan", "melakukan") | Pembayaranmu sedang dicek Catera. Jangan bayar ulang untuk pesanan ini. |
| `mig/20260917131119_beta_operations.sql:176` (issue resolved) | Katerer menandai kendala pengantaran selesai. Anda tetap dapat meminta Catera meninjau. | 1, 3, 5 | Katering menandai masalah antaranmu selesai. Kalau belum beres, kamu masih bisa minta Catera meninjau. |
| `mig/20260917131119_beta_operations.sql:176` (issue updated) | Kendala pengantaran Anda diperbarui. | 2, 3, 5 | Ada kabar baru soal laporan antaranmu. |

Read and kept: "Makanan hari ini sudah sampai? Tandai di Catera." (`mig/20261008103000_push_timing.sql:34`) and the departure push "Makan siangmu / Makan malammu sedang diantar dari {dapur}" (already "kamu").

### 3.13 Empty states and the rest

| Location | Current ID | Current EN | Problem | Proposed ID | Proposed EN |
|---|---|---|---|---|---|
| `src/discover/Jelajah.tsx:173` | Belum dipilih | Not chosen | 6 | (keep) | Not set |
| `src/discover/PackageDetail.tsx:303` | Isi paket | What is included | 6 | (keep) | What's included |

Empty states read in full and kept: "Belum ada alamat.", "Belum ada kabar baru.", "Belum ada pembayaran.", "Belum ada paket tersimpan.", "Belum ada laporan.", "Belum ada paket aktif.", "Tidak ada pengantaran di hari ini.", "Belum ada katering yang antar ke ${area}.", "Belum ada paket yang cocok." with "Coba kata kunci atau pilihan lain.", "Mau makan apa minggu ini?". They say what is missing and, where an action exists, offer it.

Read and not flagged because they are not surfaced in the customer UI: `mobile-core/provider.tsx:362-383` (push setup errors; Pengaturan shows its own toast instead). If any of them is ever shown, "Push memerlukan development build dan EAS project yang dikonfigurasi." is developer text and must be replaced with "Notifikasi belum bisa dipakai di versi aplikasi ini." / "Notifications aren't available in this version of the app."

## 4. Owner decisions (not counted as fixes)

1. **Register.** Move the customer app from "Anda" to "kamu" (recommended, section 2). Affects about 45 strings, DESIGN.md ~838 and ~865, and the unsaved-guard voice.
2. **"Menunggu Anda"** (`src/today/WaitingList.tsx:201`, DESIGN.md ~564, 3 test assertions). With "kamu" it becomes "Menunggu kamu", which is fine but flat. Options: "Perlu kamu urus" (EN "Needs you"), or "Untukmu hari ini" (EN "For you today"). Recommendation: "Perlu kamu urus" / "Needs you", because every row is an action.
3. **Delivery stage names** Terjadwal, Dimasak, Berangkat, Sampai (DESIGN.md, `domain/journey.ts:63-75`, the RantangTrack labels at `src/today/Plate.tsx:363`). They read fine and match how Indonesian delivery apps describe a trip; no change proposed. The track says "Diantar" while the caption says "Berangkat {jam}"; either is fine, but pick one verb if the owner wants the track and caption to match.
4. **"Tercatat sampai" / "Recorded as arrived"** (`src/today/Plate.tsx:127`, `domain/journey.ts:74`, DESIGN.md ~614; 10 test assertions). Accurate but clerical. Option: "Ditandai sampai otomatis" / "Marked arrived automatically". Keep if the owner prefers the shorter caption.
5. **"Demo (data sintetis)" and "Demo [dot] data sintetis"** (`src/account/Masuk.tsx:182`, `app/_layout.tsx:79`, DESIGN.md). "sintetis" is jargon for a customer. Option: "Demo (data contoh)" / "Demo (sample data)". AGENTS.md requires demo mode to be explicit and synthetic, so the owner decides whether the word itself is required.
6. **Terms link versus "Segera hadir".** Checkout links to `${apiBase}/terms` ("Ketentuan Catera", `src/buy/BuyParts.tsx:133`), while Pengaturan lists "Syarat dan privasi" as "Segera hadir" (`src/settings/Pengaturan.tsx:120`). One of them is wrong; this is a product fix, not copy.
7. **Search placeholder "Cari ayam bakar, nabati, Bu Rini..."** (`src/discover/Jelajah.tsx:234`). If "Bu Rini" is not a real listed caterer, the placeholder names an invented person (R-38). Use a real caterer name or "Cari menu atau katering...".
8. **"katering" or "katerer"** for the business. The customer app chose "katering"; this audit aligns the shared strings and pushes to it. If the owner prefers "katerer", flip the app's 25 strings instead.


## 5. Test impact

Lines in each test file that contain a current Indonesian string this audit would change (owner decisions excluded and listed separately). Measured with `grep -c -F -f` over `apps/customer/tests` and `tests/` using one fragment per changed string, so a line matching several fragments counts once. Files in `tests/e2e` drive the web app, which reads the same shared domain strings.

Customer app (`apps/customer/tests/`), 134 lines in 22 files:

| File | Lines |
|---|---|
| `help.test.tsx` | 16 |
| `claim.test.tsx` | 15 |
| `choose-menu.test.tsx` | 11 |
| `buy.test.tsx` | 10 |
| `schedule.test.tsx` | 8 |
| `customer-sheets.test.tsx` | 8 |
| `tomorrow.test.tsx` | 7 |
| `beranda-sections.test.tsx` | 7 |
| `today.test.tsx` | 6 |
| `primitives.test.tsx` | 6 |
| `identity.test.tsx` | 6 |
| `plan.test.tsx` | 5 (3 "Tidak ada antaran mendatang", 2 "Belum bisa memuat") |
| `settings.test.tsx` | 5 |
| `empty-states.test.tsx` | 5 |
| `shell.test.tsx` | 4 |
| `skeletons.test.tsx` | 3 |
| `launch.test.tsx` | 3 |
| `ui-foundation.test.tsx` | 2 |
| `sheets.test.tsx` | 2 |
| `discover.test.tsx` | 2 |
| `account.test.tsx` | 2 |
| `loading.test.tsx` | 1 |

English-only changes asserted: `beranda-sections.test.tsx` 3 ("Full plan" 2, "A short review" 1).

Root (`tests/`):

| File | Lines |
|---|---|
| `tests/claim-web.test.tsx` | 7 (the web claim page carries the same Indonesian copy) |
| `tests/push-timing.test.ts` | 3 ("Perpanjang tanpa jeda") |
| `tests/package-presentation.test.ts` | 2, English only ("Out for delivery", "Menu not yet set") |
| `tests/e2e/slot-menus.spec.ts` | 3 |
| `tests/e2e/contents.spec.ts` | 2 ("Menu belum ditentukan") |
| `tests/e2e/v1-landscape.spec.ts` | 2 ("Dalam pengantaran", "Diterima"), plus 1 English ("Delivered") |
| `tests/e2e/seller-workspace-ui.spec.ts` | 2 ("Data tidak ditemukan", shared NOT_FOUND) |
| `tests/e2e/package-presentation.spec.ts` | 1 ("Menu belum ditentukan") |
| `tests/e2e/page-recovery.spec.ts` | 1 ("Silakan") |
| `tests/e2e/mascot.spec.ts` | 1 ("Menyiapkan Catera untuk Anda") |
| `tests/e2e/journeys.spec.ts` | 1 ("Ceritakan kendalanya") |
| `tests/e2e/conditional-ui.spec.ts` | 3 |
| `tests/e2e/ui-refinement-dialog.spec.ts`, `usability.spec.ts`, `web-motion.spec.ts` | 1 each |

The last two rows (and part of `conditional-ui` and `slot-menus`) match "Lanjut mengedit" or "Tinggalkan", which the web app writes in its own sources; they change only if web adopts the same wording.

Owner-decision strings: "Tercatat sampai" in `today.test.tsx` 9 and `tests/journey.test.ts` 1 (plus "Recorded as arrived" in `today.test.tsx` 5); "Menunggu Anda" in `beranda-sections.test.tsx` 3 (plus "Waiting on you" 1); "data sintetis" in `ui-foundation.test.tsx` 4, `shell.test.tsx` 1, `native-header.test.tsx` 1.

## Counts

- Strings read: about 1,190 occurrences. That is 705 `t(...)` calls in the customer app (about 500 distinct Indonesian strings), 45 other customer literals, 13 bilingual calls and 235 multi-word literals in the shared packages, the 38-entry status map and 44-code error map in both languages, and 24 customer push bodies.
- Strings flagged for change: 153 rows in section 3 (a row that covers two identical call sites counts once). 43 of them include the register change; 20 are register-only and apply only if "kamu" is adopted.
- Owner decisions: 8 (section 4), not included in the 153.
