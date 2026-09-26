# ID 0035 — Practical copy and purposeful UI

Source: [Slack report and attached reference](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1790409579068519). September 26, 2026. All responsive web surfaces, including public and authentication pages, are in scope. Native and IDs 0036–0041 are outside this change.

Applied Catera Product Quality and both Frontend Design skills for scope, canonical component ownership, copy and visual review; Playwright/frontend testing guidance for browser evidence; React and Motion guidance for component and retained animation review.

## Result and preservation rules

Generic slogans became task headings or were removed. Shared operational chrome no longer carries the kitchen slogan, mascot/slogan footer, or admin motto. The marketplace link and language, notification, account, and mobile-menu controls remain. Authentication is a centered form with a mode-specific H1. Empty states retain their explanation and action without an unrelated illustration. Paid confirmation retains its checkmark, package summary, and next actions without a second decorative image.

Food images, featured caterer content and controls, the approved palette/type/wordmark, original asset files, useful discovery steps, and the brand gallery remain. One footer tagline remains. The fallback hero no longer advertises a universal trial or delivery benefit when the current area has no offers. Actual package terms continue to come from the selected offer.

No API, schema, authorization, pricing, payment transition, eligibility, capacity, entitlement, or purchase-snapshot behavior changed. No hosted data, Slack message, commit, push, or deployment is part of this work.

## Route and state inventory

| Route family | Review and intended retention |
| --- | --- |
| `/`, `/discover`, `/search`, `/locations/:area`, `/categories` | Practical catalog copy, factual fallback hero, comparison/search/area controls, result count, empty reset, featured caterers and food imagery. `/discover` remains a redirect. |
| `/packages/:slug`, `/caterers/:slug`, `/compare` | Direct terms/reviews/comparison headings; preserve names, descriptions, nutrition, prices, commitments, rating data, portions and purchase controls. |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Remove story panel and generic subtitles; preserve email/password, OTP alternative, recovery, notices, form errors, demo disclosure, and validated `next` destinations. |
| `/home`, `/calendar`, `/subscriptions`, `/subscriptions/:id`, `/subscriptions/:id/menu`, `/deliveries/:id` | Task headings and upcoming-delivery label; preserve actual dates, menu choices, addresses, reschedule/cancel eligibility, review and renewal controls. |
| `/messages`, `/account`, `/addresses`, `/notifications`, `/support` | Direct page names and notification empty state; preserve messages, account identity, unread/status information, escalation explanation, forms and address consequences. |
| `/checkout/:id`, `/payment/:id` | Direct order/trial headings and factual pending/paid titles using existing conditions; preserve totals, consent, countdown, retry, refund and exception states. |
| `/renew/:id`, `/claim/:token` | Reviewed; retain previous-term explanation, current terms, phone verification and linking consent. No business-rule or copy change needed. |
| `/seller`, `/seller/schedule`, legacy production/delivery/capacity routes | Shared chrome cleanup; preserve daily work, selected date, filters, attention queue, readiness, production revision and whole-day manifest meaning. Redirects unchanged. |
| `/seller/packages`, `/seller/menus`, `/seller/dishes` | Direct headings and package-description label; preserve caterer identity, dish library, menus, lock/cutoff guidance, draft/conflict/discard messages, publication and lifecycle controls. |
| `/seller/customers`, `/seller/support`, `/seller/transactions` | Shared chrome only; preserve customer acquisition rules, messaging/support authority, sales, earnings, settlement readiness, financial terms and status. |
| `/seller/settings`, `/seller/profile`, `/seller/notifications`, `/seller/onboarding` | Practical registration/profile/notification copy; preserve profile link, bank review explanation, security/help, team controls and onboarding fields. |
| `/admin`, `/admin/transactions`, `/admin/support`, `/admin/payouts`, `/admin/promotions`, `/admin/reviews`, `/admin/audit`, `/admin/settlement` | Direct verification/history headings and no generic subtitle; retain review queues, permission boundaries, financial caveats, approvals, historical data and audit content. |
| `/brand`, `/dev/mascot`, error/not-found/loading and metadata | Brand and development reference content remains intentional. Not-found retains its heading and escape link. Loading retains animation with a direct label. Metadata describes catering subscriptions. |

Dialogs, empty/error/loading states were included in the source review. Informative descriptions stay, including immutable package terms, unsaved changes, stale data, menu cutoffs, address-change effects, explicit synthetic-data notices, payment exceptions, and account recovery instructions. User/seller authored text is untouched.

## Implementation ownership

- `application.tsx` owns shared shell cleanup; its existing locale/navigation/profile components retain their behavior.
- `ui.tsx` owns optional page descriptions, empty states and the loading label. Existing form controls, overlays, focus management and error feedback remain canonical.
- Existing screen components own bilingual copy. Global styles remove obsolete selectors and center authentication; no new design system or duplicated interaction primitive was introduced.
- Metadata and manifest descriptions now use factual subscription language. Brand names and original artwork files are unchanged.

## Verification

Evidence is in `output/slack-bugs/0035/`. Browser plugin not available (no Browser skill); the repository's Playwright runner and installed Chromium were used against explicit local synthetic storage at `http://127.0.0.1:3135`. Authentication-contract tests use an unused loopback Supabase endpoint and mocked responses; they do not prove SMTP, SMS or hosted authentication.

Verified locally on September 26, 2026 in the isolated `codex/practical-copy-0035` checkout based on `v1` at `9b9f971`. The original checkout and its existing edits were preserved.

| Check | Result and evidence |
| --- | --- |
| Workspace typecheck | Passed; `typecheck-final.log` and `typecheck-complete.log`. |
| Unit tests | 38 files / 264 tests passed; `unit-tests.log`. |
| Production build | Passed; `build-final.log`. |
| PostgreSQL concurrency/security | All 27 recorded checks passed against local test storage; `postgres.log`, `postgres-results.json`. |
| New copy/layout coverage | All 10 tests passed together on fresh synthetic data; `clean-final.log`, `clean-final.json`. Includes eight screens at all six locale/width combinations, both fallback/empty-result recovery cases, and two broader route-family sweeps. |
| Main journey regressions | 49 distinct cases passed across the initial run and focused reruns: customer purchase/reschedule/support/renewal, caterer journeys and menu editing, guest auth, navigation, pending/paid/refund states, and functional mascot/loading motion. See `browser-flows.log`, `remaining.log`, `wizard.log`, `purchase-final.log`. |
| Direct payments and featured discovery | 14/14 passed; `payments-featured.log`. Includes BRI/QRIS, expired/uncertain/polling states, ID/EN phone/desktop, carousel keyboard/swipe, long names and accessibility. |
| Registration/recovery contracts | 7/7 passed with mocked auth responses; `registration.log`. |

The main journey run was interrupted before its final three tests. Focused reruns completed those cases and corrected obsolete text selectors, a comparison-navigation timing assumption, and a test configuration that had inadvertently reduced motion for animation tests. Assertions for behavior remain. An earlier final copy run encountered a local connection reset; the complete fresh-data rerun above passed. These are passes across focused runs, not a claim that one combined 80-test invocation passed.

### Matching visual evidence

`before/` and `clean-final/` contain matching filenames for discovery, login, customer home/calendar/account, caterer menus/packages, and admin: Indonesian and English at 390, 768, and 1440 pixels (48 before and 48 final views). Fallback hero/empty-result views are in `after/fallback-{id,en}-{390,768,1440}.png`. Screens use synthetic data; login screenshots show explicit demo role controls. Separate registration/recovery browser checks exercise the real form branches with mocked provider responses.

- Caterer menu: [before phone](../output/slack-bugs/0035/before/menus-id-390.png), [after phone](../output/slack-bugs/0035/clean-final/menus-id-390.png), [after desktop English](../output/slack-bugs/0035/clean-final/menus-en-1440.png).
- Authentication: [before phone](../output/slack-bugs/0035/before/login-id-390.png), [after phone](../output/slack-bugs/0035/clean-final/login-id-390.png).
- Discovery: [before desktop](../output/slack-bugs/0035/before/discovery-en-1440.png), [after desktop](../output/slack-bugs/0035/clean-final/discovery-en-1440.png), [fallback phone](../output/slack-bugs/0035/after/fallback-id-390.png).

Final matrix assertions found no horizontal overflow or uncaught page errors. Keyboard recovery, retained navigation controls, heading names, reduced motion, menu dialogs, empty/error states and payment status conditions were exercised by the focused suites. Axe checks in discovery/caterer regressions passed their asserted severity thresholds. Source and visual review found no remaining reported slogans, obsolete decorative wrappers or empty spacer elements. Existing viewport-height page space remains intentional; no filler was added to occupy it.

These checks do not establish hosted authentication, SMTP/SMS delivery, real payment-provider processing, physical-device behavior, production performance or user-study acceptance. Existing image loading/size warnings remain separate from this copy cleanup. Native tests were not rerun because native source and behavior were deferred and unchanged.

### Static design audit boundary

The strict Frontend Design Premium audit was run with `sourceRoots: ["apps/web/src"]` to exclude build artifacts. Baseline and changed source both report the same 48 findings: missing canonical map/UX contract (2), undecided native-select ownership (20), missing literal `noValidate` (2), and textarea resize checks (24). These pre-existing contract/heuristic findings are outside ID 0035. No broad form rewrite or new contract was introduced to make this copy-only change pass the tool. Reports: `premium-audit-before.json` and `premium-audit.json`.

## Exact bilingual copy inventory

The following per-component inventory lists removed/rewritten static translation pairs and the new pairs in that component. Other pairs are retained. Dynamic personalized home greetings became “Makanan saya / My meals”. The literal sidebar “Good food. Good days.” was removed; the approved footer tagline remains. Non-translated metadata changes are described above.

| Component | Removed or rewritten (ID / EN) | New or rewritten (ID / EN) |
| --- | --- | --- |
| admin.tsx | Katerer & kepercayaan / Caterers & trust<br><br>Promosi yang terukur / Measured promotions<br><br>Jejak keputusan / Decision trail<br><br>Keputusan yang jelas. Bukti yang dapat ditelusuri. / Clear decisions. Traceable evidence. | Verifikasi katerer / Caterer verification |
| application.tsx | Marketplace & kepercayaan / Marketplace & trust<br><br>Makanan baik dimulai dari dapur yang tertata. / Good food starts with an organized kitchen.<br><br>Makanan baik, untuk hari-hari yang lebih baik. / Good meals, for better everyday living. | Removed; useful adjacent content remains. |
| authentication.tsx | Hari yang baik, / A good day,<br><br>dimulai dari makan. / starts with a good meal.<br><br>Satu tempat untuk makanan favorit dan jadwal yang lebih teratur. / One place for your favorite meals and a more effortless routine.<br><br>Selamat datang di Catera / Welcome to Catera<br><br>Makanan enak untuk hari-harimu yang sibuk. / Good meals for your busy everyday.<br><br>Dengan masuk, Anda dapat mengelola paket, jadwal, dan percakapan di satu tempat. / Sign in to manage packages, schedules, and conversations in one place. | Buat kata sandi baru / Set a new password |
| customer.tsx | Paket yang menemani harimu / Your everyday meal packages<br><br>Hari-hari yang sudah terencana. / Your meals, all in one place.<br><br>Lebih sedikit memikirkan makan. Lebih banyak menikmati hari. / Less meal planning. More enjoying your day.<br><br>Temukan favorit baru / Find a new favorite<br><br>Yuk, temukan paket untuk keseharianmu. / Find a package for your everyday routine.<br><br>Tambah paket yang kamu suka / Add another favorite<br><br>Setelah ini, ada apa? / What comes next?<br><br>Obrolan yang bikin jelas. / A little conversation helps.<br><br>Makanan diantar ke mana? / Where should we deliver?<br><br>Akunmu, keseharianmu. / Your account, your everyday.<br><br>Selamat menikmati hari-hari yang lebih teratur. / Enjoy a more effortless everyday.<br><br>Paket saya / My packages<br><br>Kami bantu sampai selesai. / Let’s work it out. | Langganan saya / My subscriptions<br><br>Makanan saya / My meals<br><br>Jelajah katering / Explore catering<br><br>Pilih paket katering untuk menjadwalkan pengantaran. / Choose a catering package to schedule deliveries.<br><br>Tambah paket / Add a package<br><br>Pengantaran berikutnya / Upcoming deliveries<br><br>Alamat pengantaran / Delivery addresses<br><br>Akun / Account |
| hero-introduction.tsx | Makan enak. / Eat well.<br><br>Setiap hari. / Every day.<br><br>Katering yang pas untuk keseharian Anda. Pilih makanannya, atur jadwalnya, nikmati harinya. / Catering that fits your everyday. Choose your meals, set your schedule, enjoy your day.<br><br>Temukan paketmu / Find your meals<br><br>Pengantaran termasuk / Delivery included<br><br>Bisa coba dulu / Try before subscribing<br><br>Satu urusan berkurang. / One less thing to plan.<br><br>Satu hari lebih menyenangkan. / A little more joy every day. | Paket katering berlangganan / Catering subscriptions<br><br>Bandingkan paket, pilih jumlah porsi, dan tentukan tanggal mulai pengantaran. / Compare packages, choose portions, and select a delivery start date.<br><br>Lihat paket / View packages |
| marketplace.tsx | Temukan katering yang cocok / Find your everyday catering<br><br>Bandingkan isi, jadwal, dan harga paket untuk keseharianmu. / Compare meals, schedules, and package prices for your routine.<br><br>Cari paket, menu, atau katerer favorit… / Find a package, meal, or favorite caterer…<br><br>Makanan sudah dipikirkan. / Meals, already taken care of.<br><br>Harimu tinggal dinikmati. / Your day is yours to enjoy.<br><br>Mulai dari satu kali coba, sampai jadi bagian favorit dari keseharian. / From a first taste to your favorite everyday ritual.<br><br>Pilih yang kamu suka / Find your favorite<br><br>Buat jadwalmu / Make it your routine<br><br>Nikmati, lalu ulangi / Enjoy, then repeat<br><br>Jelas dari awal / Know before you subscribe<br><br>Cerita dari pelanggan / Customer experiences<br><br>hari makanan baik / days of good meals<br><br>Pilih yang paling pas. / Find your best fit.<br><br>Dari dapur, untuk harimu. / From our kitchen to your day.<br><br>Pilih paket dan rutinitas makan yang cocok untukmu. / Choose a package that suits your routine. | Paket katering / Catering packages<br><br>Bandingkan isi, jadwal, dan harga paket. / Compare meals, schedules, and package prices.<br><br>Cari paket, menu, atau katerer… / Search packages, meals, or caterers…<br><br>Cara berlangganan / How to subscribe<br><br>Tentukan porsi & jadwal / Choose portions & dates<br><br>Terima pengantaran / Receive your deliveries<br><br>Ketentuan paket / Package terms<br><br>Ulasan pelanggan / Customer reviews<br><br>Bandingkan paket / Compare packages |
| meal-calendar.tsx | Hari-hari yang sudah terencana. / Your meals, all in one place. | Jadwal makan / Meal calendar |
| notifications.tsx | Kabar untukmu / Updates for you<br><br>Belum ada kabar baru / No new updates yet | Notifikasi / Notifications<br><br>Belum ada notifikasi / No notifications yet |
| purchase.tsx | Simpan pilihanmu. / Keep your selection.<br><br>Kenalan lewat satu kali makan. / Start with a first taste.<br><br>Siapkan hari-hari yang lebih enak. / Make room for good meals.<br><br>Porsi dan jadwal yang jelas, sejak awal. / Clear portions and schedules, from the start.<br><br>Makanan baik sudah dijadwalkan. / Good meals are on the calendar.<br><br>Satu langkah menuju makan enak. / One step away from good meals. | Masuk untuk memesan / Sign in to order<br><br>Pesan uji coba / Order a trial<br><br>Pesan paket / Order package<br><br>Pembayaran berhasil / Payment successful<br><br>Menunggu pembayaran / Awaiting payment |
| seller-account.tsx | Tentang Catera / About Catera<br><br>Catera menghubungkan pelanggan dengan katerer, jadwal pengantaran, dan bantuan dalam satu tempat. / Catera connects customers with caterers, delivery schedules, and support in one place. | Profil katerer / Caterer profile |
| seller.tsx | Paket dari dapurmu. / Packages from your kitchen.<br><br>Menu yang dinanti. / Menus your customers are waiting for.<br><br>Cerita paket / Package story<br><br>Makanan dari dapurmu. Hari baik untuk banyak orang. / Meals from your kitchen. Better days for many people.<br><br>Bangun langganan yang berulang dengan ritme dapur yang kamu tentukan. / Build recurring subscriptions around the rhythm of your kitchen.<br><br>Ilustrasi kotak makanan Catera / Catera meal box illustration | Paket / Packages<br><br>Menu / Menus<br><br>Deskripsi paket / Package description<br><br>Daftar sebagai katerer / Register as a caterer<br><br>Lengkapi profil usaha dan area pengantaran untuk mengajukan verifikasi. / Complete your business profile and delivery coverage to request verification. |
