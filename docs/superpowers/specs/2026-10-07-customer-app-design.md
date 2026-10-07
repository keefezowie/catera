# Catera customer app: from-scratch redesign

**Date:** 2026-10-07 · **Branch:** `v2` · **Status:** approved in conversation; awaiting written-spec review
**Screens:** design canvas https://claude.ai/artifact/LhXtQnZVv8npM6RtgA494v (16 artboards)
**Research:** [2026-10-07-customer-mobbin.md](../research/2026-10-07-customer-mobbin.md)
**Companion:** [caterer simplification spec](2026-10-07-caterer-simplification-design.md) (its decisions on auto-delivered, renewal converts and WhatsApp-only messaging apply here)

## 1. Why

The current customer app (`apps/customer`, about 7.6k lines) has 5 tabs and about 20 screens:
- Jelajah alone is 951 lines (swipe pager, list, 7 filters, compare, saved).
- Help is split between Pesan and a 5-part Support screen.
- The app cannot open the caterer's claim and renewal links at all.

Under "renewal converts", the first real customers arrive from a caterer's WhatsApp link, so this gap blocks the business model.

The redesign makes one daily moment effortless: **what am I eating today, and has it arrived?** Discovery, buying and renewing are kept short.

## 2. Decisions (Keefe, 7 Oct)

| Topic | Decision |
|---|---|
| Who | Both equally: caterers' existing customers (arriving by link) and new marketplace customers |
| Daily moment | See today's meal and its arrival |
| Arrival | The caterer taps **Berangkat** once per route; customers get "sedang diantar"; the customer confirms **Sudah sampai** |
| No confirmation | One reminder, then auto-confirmed by the next morning's run (the existing `v1.auto_deliver`), so caterers are paid on time. **Belum** opens Ada masalah |
| Feedback | Optional private reaction (Enak / Biasa / Kurang) after arrival; one public review near the end of a package |
| Links | Web first: claim, renew and pay work in the phone browser with no install. The same URLs open the app when installed |
| Discovery | Area + food-photo list + 4 chips + save (heart). No swipe pager, filter modal or compare |
| Help | Chat on the caterer's WhatsApp (`wa.me`); one **Ada masalah** flow per delivery, tracked by Catera, which can lead to a refund. No Pesan tab |
| Checkout | One screen with defaults and the full price breakdown, QRIS first. Renewal is the same screen prefilled |
| Renewal | Explicit (product rule unchanged); "Sisa 3 hari" card + one push; the new term starts the next delivery day after the current term, with no gap |
| Sign-in | Phone OTP by SMS first; email + password second |
| Tabs | Beranda · Jadwal · Jelajah · Akun |
| Code | Rebuild screens inside `apps/customer` on `@catera/mobile-core` and `@catera/mobile-ui`. Same app id and store listing; old `src/` deleted at the end |
| Web | Customer web pages get the same design at phone width, reusing the same domain functions, after the app |

**Assumptions** (stated, not objected to):
- Browsing and prices need no login. Login is asked at Simpan, Beli and claim.
- Pindah tanggal (flexible packages only) and Ganti alamat stay as today: before cutoff, using the existing `delivery.reschedule` and `delivery.address`. No new pause feature.
- Customer menu choice appears only for packages where the caterer enabled it.
- PRODUCT.md rules on reservations, cutoffs, refunds and fees are unchanged.

## 3. Information architecture

Four tabs plus pushed screens:

| Tab | Shows | Canvas |
|---|---|---|
| **Beranda** | Today's plate (photo, one status sentence, dishes, one action) · next days as plain rows with their cutoff · package line with days left and *Chat katering* · renewal card at ≤3 days left. Without an active package: "Mau makan apa minggu ini?" + top Jelajah cards + a hint about caterer links | Main, beranda-pagi, sudah-sampai, beranda-perpanjang, beranda-kosong |
| **Jadwal** | Month grid across all packages and caterers (legend: diantar / sudah sampai / dipindah) + the selected day's meals | jadwal |
| **Jelajah** | Area · search · chips (Siang, Malam, Di bawah Rp30.000, Bisa coba 1 hari) · photo cards with a heart | jelajah |
| **Akun** | Active packages · Alamat · Disimpan · Riwayat pembayaran · Bantuan dan laporan · Notifikasi · Bahasa · Keluar | akun |

**Pushed screens:**
- **Paket** (detail)
- **Beli / Perpanjang** (one screen)
- **Bayar** (QRIS / VA)
- **Ubah hari** (sheet)
- **Ada masalah**
- **Pilih menu** (customer-choice packages only)
- **Klaim** (3 steps)
- **Masuk**

**Removed from the app:**
- Pesan tab and in-app conversations
- compare
- swipe pager
- filter modal
- separate support hub (merged into Bantuan dan laporan)
- mascot preview
- caterer/admin workspace links in Akun

The demo login and `checkout.demo_pay` remain behind `__DEV__` / explicit demo mode.

## 4. Today's plate: states

The Beranda plate is the one bold element:
- a full-width photo of today's dish, with a single 28–30px status sentence over a dark scrim
- one action underneath
- Sunrise (`#F47B2A` fill with charcoal text) is reserved for "needs you now": Sudah sampai, Perpanjang, and a cutoff today

| State | Condition | Sentence | Action |
|---|---|---|---|
| Dimasak | Today, before Berangkat and before the window starts | "Sedang dimasak · diantar 11.00–13.00 ke {alamat}" | none; tomorrow's change hint below |
| Sedang diantar | Fulfillment `out_for_delivery` | "Sedang diantar · tiba sekitar 11.00–13.00", chip "Berangkat 10.42" | **Sudah sampai** / Belum |
| Sudah waktunya | No Berangkat, window started | "Seharusnya sudah tiba · 11.00–13.00" | **Sudah sampai** / Belum |
| Sudah sampai | `delivered` | "Sudah sampai · pukul 11.48" | optional reaction |
| Ada laporan | Open delivery issue | "Laporan terkirim" + its status | Lihat laporan |
| Libur | No delivery today | Next delivery row becomes the plate (smaller photo) | none |

- For lunch-and-dinner packages, the plate shows the meal whose window is nearest; the other meal is a row.
- With several packages on the same day, there is one plate per meal, stacked in window order.

## 5. Flows

### 5.1 Claim link `/claim/<token>` (web first)
1. **Lihat paket.** Without login, show:
   - the caterer's name, package, days left, next delivery and address label
   - the masked phone the caterer entered
   - one button "Lanjut dengan 0812-•••-0001"

   The read must expose no personal data beyond what the token holder already sent. A new read endpoint `claim-preview/<token>` returns only:
   - package name
   - caterer name
   - remaining days
   - next date and window
   - address label
   - masked phone
2. **Kode SMS** (Supabase phone OTP to that number) + name.
3. **Tersambung:** next 3 days, plus "Pasang aplikasi". The app signs in with the same phone.
4. Any mismatch (different phone, token used or expired) ends in a plain message and "Minta tautan baru ke {katering}". It never shows another customer's data.

The existing `customer.claim` command does the connect; the web route `ClaimCustomer` is rebuilt to these screens.

### 5.2 Renew link `/renew/<id>` and in-app Perpanjang
Both open **Perpanjang**, the one-screen checkout prefilled with:
- start = the next delivery day after the current term
- same package and portions
- length 1 cycle, or longer options the caterer offers ("Hemat 5%")
- current address

Payment: QRIS first, VA second. Then the Bayar screen with a countdown; the 15-minute hold is unchanged. `renewalContext` is called with the chosen `cycles`, fixing the current native bug where cycles are not passed.

### 5.3 Buying from Jelajah
Jelajah → Paket → **Pilih jadwal** or **Coba 1 hari** (trial when the package allows it) → the same one-screen checkout, with the start defaulting to the earliest bookable date. Login (phone OTP) is asked here if needed, and returns to the same screen.

### 5.4 Arrival
1. The caterer taps **Berangkat** on a route in Catera Dapur → command `delivery.depart` (see §6.1) → all that route's fulfillments become `out_for_delivery` → push to each customer: "Makan siangmu sedang diantar dari {katering}".
2. The customer taps **Sudah sampai** → `delivery.confirm` → `delivered` (earning is recognised by the existing trigger).
3. **Belum** opens Ada masalah with "Belum sampai" preselected.
4. **Reminder:** one push "Sudah sampai?" 60 minutes after the window ends, if still unconfirmed and no issue is open.
5. **Silence:** the next morning's `v1.auto_deliver` marks it delivered, as already built.

### 5.5 Ada masalah
1. Choose one of:
   - **Belum sampai**
   - **Ada yang kurang atau salah**
   - **Makanan tidak layak**
2. Optionally add a note and a photo.
3. **Kirim laporan.**

The report uses the existing `deliveryIssue.create`. The outcome screen states the rule:
1. the caterer is notified now
2. the caterer replies by 12.00 the next day
3. otherwise Catera reviews, and a refund for that day is possible (existing `deliveryIssue.escalate` and support/refund flow)

An open issue stops auto-confirmation for that meal (§6.6). Once the issue is resolved without a cancellation or refund, the next morning's run confirms it as usual.

### 5.6 Ubah hari
A bottom sheet from any future delivery row:
- Header: date, package, "Bisa diubah sampai {cutoff}".
- **Pindah tanggal** (flexible packages only) lists only bookable dates. Full or taken dates are shown disabled with the reason.
- **Ganti alamat** picks from saved addresses, for that day only.

Changes use the existing `delivery.reschedule` / `delivery.address`; the new day is reserved before the old one is released. After cutoff, the sheet says the day can't be changed and offers *Chat katering*.

### 5.7 Reaction and review
- **Reaction:** after Sudah sampai, an optional reaction with three choices. It is private, and the caterer sees a weekly summary in Catera Dapur (a later caterer plan).
- **Review:** the public review is asked once, when 3 or fewer days remain or after the final delivery, using the existing `review.save` (eligibility unchanged).

## 6. Backend changes

All changes are SQL migrations under `supabase/migrations/` with matching `packages/backend/src` sources, layered by wrapping `catera_v1_command` as earlier v2 migrations do, and covered by PGlite tests and the PostgreSQL concurrency harness.

### 6.1 `delivery.depart`
- **Who and input:** caterer owner or staff; payload `{catererId, date, meal}`.
- **Effect:** in one transaction, locks that date and meal's non-cancelled fulfillments for the caterer in a stable order. It moves `scheduled` and `ready` ones to `out_for_delivery`, recording `departed_at`, and leaves others untouched.
- **Idempotent:** a second tap moves 0 rows and sends no second push.
- **Pushes:** enqueues one push per affected customer.
- **Returns** `{moved}`.

The caterer app adds one **Berangkat** button to its Antar list. That change is out of scope here and flagged for the caterer track.

### 6.2 `delivery.confirm`
- **Who and input:** the customer owning the subscription; payload `{fulfillmentId, reaction?}`.
- **Allowed** when the fulfillment is today's or yesterday's (Jakarta) and its status is `out_for_delivery`, or `scheduled`/`ready` with the window started. It moves the fulfillment to `delivered`.
- **Day status:** derived by the same helper `delivery.status` and `auto_deliver` use, so earnings are recognised once.
- **Repeats and errors:**
  - Already delivered → no-op; only the reaction is stored.
  - Day in `issue` → `NOT_ALLOWED`.
  - Cancelled → `NOT_AVAILABLE`.

### 6.3 Reactions
- **Table:** `v1.delivery_reactions(fulfillment_id pk, customer_id, reaction text check in ('enak','biasa','kurang'), created_at)`. It is upserted by `delivery.confirm` or `delivery.react` within 48 hours of delivery.
- **Access:** caterer reads only an aggregate per package per week; the customer reads only their own.
- **Never public.**

### 6.4 Claim preview read
`claim-preview/<token>` returns the minimal fields in §5.1. It is rate-limited like other public reads; an unknown or used token returns `NOT_FOUND` without hinting which.

### 6.5 Push timing
Today pushes are queued and sent by the once-a-day job (09:00 WIB), which is too late for "sedang diantar".
- **Immediate (event pushes):** the API route sends event pushes (depart, renewal-link, issue replies) right after the command commits. It uses the existing Expo sender and ticket bookkeeping; anything not sent immediately is retried by the job.
- **Timed (time-based pushes):** a scheduled GitHub Actions workflow calls `POST /api/jobs/push` with the existing cron secret every 15 minutes. This endpoint only processes due push jobs. It covers the arrival reminder (window end + 60 min) and the 3-days-left renewal push (09:00 on that day).
- **Daily:** the Vercel cron stays daily for maintenance, auto-deliver and settlement.

### 6.6 Open reports hold auto-confirmation
`deliveryIssue.create` does not change the day's status today, so `v1.auto_deliver` would confirm a reported meal the next morning.
- **Change:** `auto_deliver` skips any fulfillment that has a `delivery_issues` row in `open`, `responded` or `escalated` for the same day and meal. That fulfillment and its day stay pending, and no earning is recognised.
- **After resolution:** the next run confirms it, unless support cancelled or refunded the day.
- **Concurrency test:** `deliveryIssue.create` racing `auto_deliver` ends either delivered-then-reported (the report then goes through the existing settlement hold) or held, never both.

### 6.7 Links into the app
- **Web hosting files:** `apps/web/public/.well-known/assetlinks.json` (Android App Links) and `apple-app-site-association` (iOS), both for `id.catera.customer`.
- **App routes:** `app/claim/[token].tsx` and `app/renew/[id].tsx`.
- **Return paths:** `nativeReturnPath` accepts `/claim/*` and `/renew/*`.
- **Fallback:** without the app, the same URLs render the web screens.

## 7. App architecture

- **Shared packages:** `apps/customer` adopts `@catera/mobile-core` (session, API, push, i18n, `useData`) and `@catera/mobile-ui` (Text, Button, Chip, Segmented, Card, Field, Stepper, Sheet, Screen), as Catera Dapur does.
  - New UI parts go in `mobile-ui` when both apps need them (Plate, DayRow, BottomSheet list).
  - Customer-only parts go in `apps/customer/src/<area>/`.
- **Domain logic:** pure functions go in `@catera/domain` so the web reuses them:
  - `todayPlate(customerState, now)` → state + sentence data (§4)
  - `upcomingRows(customerState, now, n)`
  - `renewalDefaults(subscription, offer)` → start date, cycles, portions
  - `checkoutBreakdown(quote)`
  - `canChangeDay(fulfillment, now)` → `{date: boolean, address: boolean, until}`
  - `issueOutcome(issue)`
- **Screen folders:** `src/today`, `src/schedule`, `src/discover`, `src/buy`, `src/help`, `src/account`, `src/claim`. Each screen file stays under about 300 lines.
- **Migration path:** each new screen replaces its old route. Old `src/agenda.tsx`, `daily.tsx`, `discovery.tsx`, `purchase.tsx`, `ui.tsx` and `context.tsx` are deleted when nothing imports them. `saved.tsx` logic moves to `src/discover`.
- **Offline:** Beranda caches the last customer read (expo-file-system, like Catera Dapur) and shows "Terakhir diperbarui HH.MM".
- **Copy:** Indonesian first, English through `t()`. No internal terms (slot, siklus, fulfillment, cutoff, settlement). Times use Jakarta time and "11.00–13.00" formatting.

## 8. Web

After the app, the customer web routes get the same screens at phone width and a centred column on desktop:
- `(marketplace)` home/Jelajah
- package detail
- checkout and payment
- `/home` (Beranda)
- schedule
- claim
- renew
- support

They reuse the §7 domain functions. The 2,010-line `components/customer.tsx` is split by area in the same way. The desktop marketplace keeps three photo columns (PRODUCT.md).

## 9. Visual contract

DESIGN.md tokens only:

| Token | Hex |
|---|---|
| Forest | `#163D2E` |
| Sunrise | `#F47B2A` |
| Sunrise-ink | `#9B4309` |
| Cream | `#FFF7E9` |
| Canvas | `#FDFAF3` |
| Surface | `#FFFEFA` |
| Sage | `#F0F3E9` |
| Line | `#E2E3D8` |
| Muted | `#60675F` |
| Danger | `#A33024` |

- **Type:** Plus Jakarta Sans, scale 28/20/16/13, tabular numerals for times and rupiah.
- **Layout:**
  - Days after today are plain rows, not cards.
  - Cards only for the plate, package and renewal.
  - Touch targets ≥ 44pt.
  - Text contrast ≥ 4.5:1 (charcoal on Sunrise, never white).
- **Motion:** one moment only: the plate's sentence cross-fades on state change, with reduced motion respected.
- **Photos:** synthetic food photos only for labelled demo listings.

## 10. Testing

- **Domain** (Vitest): every `todayPlate` state, including:
  - lunch+dinner
  - two packages
  - no delivery
  - after midnight in Jakarta from a phone in another timezone

  Also `renewalDefaults` (no gap, cycles), `canChangeDay` at cutoff minus and plus one minute, and breakdown totals.
- **Backend** (PGlite + PostgreSQL harness):
  - `delivery.depart` idempotency and staff scope
  - `delivery.confirm` by owner, another customer (FORBIDDEN), after an issue and twice
  - **concurrency:** confirm vs `auto_deliver` and depart vs confirm leave one final state with one earning
  - reaction privacy
  - claim-preview minimal fields and unknown token
- **App** (Jest + RN Testing Library):
  - plate states render the right sentence and action
  - Sudah sampai calls `delivery.confirm`
  - Belum opens Ada masalah preselected
  - the claim route reads the preview before asking for the phone
  - Perpanjang prefills start and cycles
  - offline Beranda shows the cached day
- **Web:** existing Playwright smoke extended to claim → OTP (demo) → schedule, and renew → checkout.

## 11. Out of scope

- Auto-renew and saved payment methods.
- WhatsApp Business API / automated messages; WhatsApp OTP delivery.
- Live courier tracking.
- Pause.
- Cart.
- Customer-to-customer gifting.
- The caterer app's Berangkat button and weekly reaction summary (caterer track).
- Doku/Xendit provider changes beyond what checkout already uses.

## 12. Build order

1. Backend: §6.1–6.7 with tests.
2. Domain functions (§7) with tests.
3. App shell on mobile-core/mobile-ui; Beranda + plate; Jadwal + Ubah hari; Ada masalah.
4. Claim and renew routes, app links, one-screen checkout and Bayar; Jelajah + Paket; Akun.
5. Delete the old app code; EAS preview build.
6. Web customer screens (may be its own plan).
