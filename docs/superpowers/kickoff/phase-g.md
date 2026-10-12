# Phase G kickoff: owner feedback, the device gate and the Phase F carry-overs

Paste this as the first message of the Phase G session. It is self-contained. Phase F is built and passes Jest, Vitest, typecheck, build and PostgreSQL on `v2` (`7cf0f23d` plus the Phase F gate docs). It was never put through a device gate. On October 12, 2026 the owner ran the customer app on their own Android phone in Expo Go and gave eleven pieces of feedback (FB1 to FB11 below, two screenshots). Phase G now does three things in this order:

1. Design and build the owner's feedback.
2. Run the device gate (Android, then iOS, then a development build) once, on the final UI.
3. Clear the small tasks Phase F parked.

**Revised October 12, 2026.** The earlier draft ran the device gate first. That would have captured screens the feedback is about to change (the hero, the tracker, the palette, every button), so the full gate now runs after the build. Only the sheet go/no-go (G1) stays early, because every new sheet in this phase depends on it.

## Read first

- [DESIGN.md](../../../DESIGN.md): the sections "Native polish (Phase F), October 11, 2026", "Native mood and theme" (the mood token table) and "Native dark theme", plus everything they supersede.
- [Audit 008 follow-up](../../../anti-slop/audit-008-followup-2026-10-11.md): the verdict for each of the 17 findings, the Review Focus lines, the full list of unverified device checks and the antislop Delivery Gate (FAIL on R-35 until a click-through exists).
- [Phase G Mobbin research](../research/2026-10-12-native-phase-g-mobbin.md): the references for FB1, FB3, FB5, FB6, FB8, FB9 to FB11, with what Catera should take from each.
- [MASCOT-MOTION.md](../../MASCOT-MOTION.md), [the Phase F spec](../specs/2026-10-10-native-phase-f-design.md) and [plan](../plans/2026-10-11-native-polish-phase-f.md), [PREDICTIVE-BACK.md](../../PREDICTIVE-BACK.md), [RUNBOOK.md](../../RUNBOOK.md) and the ledger `.superpowers/sdd/2026-10-11-native-polish-phase-f/progress.md` (rulings and parked items).

## Skills

Before you plan, build, review or critique, invoke the Skill tool for these skills and apply them: `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `apple-design` (iOS), `material-3` (Android; if it is not installed, say so in every report), `design-taste-frontend`, `impeccable` and `antislop:antislop-human`. Any work that writes or edits UI copy also invokes `humanizer` and `antislop:antislop-copywriting`.

- antislop's mode is **after (session override)**: never ask the mode question.
- `design-taste-frontend` scopes native mobile out (its section 13). Apply its general rules only: skeletons over spinners, motivated motion, contrast, a copy self-audit, no em dashes. Do not apply its web stack.
- `impeccable`: run its context step once per session, with `--target` set to the app being changed.
- For FB2, also use `impeccable` in colorize and critique mode, and the `dataviz` palette validator method for the contrast arithmetic.

## Fixed rules

**Branch, data and checks**
- Work on `v2` in the main tree `D:\Project\Catera\catera`. `v1` is maintenance-only.
- AGENTS.md applies: tenant authorization and entitlement changes stay in database transactions; never replace production storage with demo data silently; demo mode is explicit and synthetic; no secrets, no real customer fixtures.
- After a material change, run:
  - `npm run typecheck`, `npm test` and `npm run build`;
  - both app Jest suites (`npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from each app folder);
  - the relevant browser or native checks;
  - `npm run test:postgres`.
- This Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching `apps/web`.
- Production release needs separate Supabase, SMS/SMTP, Xendit and mobile credentials, plus the gates in docs/RUNBOOK.md. Preserve the existing hosted pilot. When publishing, verify the production deployment's commit and the visible active interface.

**Design**
- **Platform-native chrome, brand in the content.** NativeTabs, native stack headers and native sheets stay native. The identity lives in mood headers, the day arc, the rantang, food photos and the mascot. Native bars read the theme, never the mood.
- **Plus Jakarta Sans** everywhere the app draws text. System-drawn UI (alerts, share sheet, keyboard, pickers) keeps the system font.
- **Copy:** Indonesian first with English through `t(id, en)`. Customer copy says "Anda", Dapur copy says "kamu". No em dashes. Operational numbers are tabular. No invented numbers (R-17).
- **Motion:** `nativeMotion` control 120, selection 180, content 220 and feature 320 ms, ease `(.16, 1, .3, 1)`, press spring damping 18 stiffness 260.
  - Transform and opacity only; instant under reduced motion.
  - Loops only while waiting (mascot loop, skeleton pulse). The tracker does not loop (D3).
  - Decision A: no motion on a first load, refresh, pull, search, filter, tab return or mood switch.
  - Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 2.
- **Artwork truth:** apps import only `packages/brand/assets/phase-f/runtime/` (plus the splash marks in `LaunchCover` and `confetti.json`).
  - Everything is a processed derivative, never a master. Rig layers are never trimmed. Never call opaque or upscaled files transparent or high-resolution masters.
  - Do not reopen naming or concept selection. Never crop the reference board.
  - Preserve the individually regenerated artwork, food-led discovery, the delivery-cycle direction, the Indonesian-first interface and the code-first preference.
- **The palette:** the owner reopened its application on October 12, 2026 (FB2). That overrides "do not reopen the approved palette" for FB2 only, within the scope the owner sets in decision D1. Record the revision in DESIGN.md as a new dated section that names what it supersedes.

**Commits**
- **Never stage** `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/` or `catera-phase-f-artwork.zip`. Stage by explicit path.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Owner's model and gate rules (2026-10-11)**
- Sonnet writes first builds (Opus only with a written reason), docs and code mapping. The FB3/FB11 migrations qualify for an Opus first build: they change tenant-authorized state transitions and need concurrency scenarios. Write that reason in the ledger.
- Opus runs the fixes (a fresh fixer for round 1, then the same one resumed), every review and every device gate.
- Only gate agents take screenshots, and contact sheets are captured by script. Contrast, tap-target and truncation checks are scripted, not eyeballed.
- The final gate re-checks only earlier failures and the unverified list.
- The controller stays quiet: no idle status turns, it reads return contracts rather than full reports, and it runs checks in the background.
- Session budget (2026-10-12): one fresh session per sub-phase (G-a design, G-b build, G-c gate). Compact or hand off near 150k context. Write a handoff file in `docs/superpowers/handoffs/` at each sub-phase end. Record the weekly usage % before and after in the ledger.

## What the machine and the owner need first

- **Owner's phone.** The owner has an Android phone that runs the customer app in Expo Go (the October 12 screenshots come from it). Use it as the first device: USB debugging through `adb` (the Android SDK is present), and Metro with `EXPO_PUBLIC_API_URL` set to this PC's LAN address, not `10.0.2.2`.
- **Emulator.** There is still no system image or AVD, no JDK on PATH and no Mac. The emulator matters for API 34, 35 and 36 (predictive back) and for font scale and density sweeps. Ask before downloading anything; the emulator image and Expo Go are about 1 GB.
- **Credentials.** Ask for the Apple, EAS and Firebase (FCM V1) credentials that a development build and real push need. If something is missing, stop at that item, record it as NOT VERIFIED with the reason, and continue with the rest. Never enter or invent credentials.

## Goal

1. Each of FB1 to FB11 is designed with the owner's picks, specified, built and tested.
2. Every row of the follow-up audit that says NOT VERIFIED becomes PASS or FAIL with a capture, on the final UI, and every FAIL is fixed.
3. The carry-over tasks are done.
4. The antislop Delivery Gate is re-run with R-35 backed by a recorded click-through.

## Owner feedback, October 12, 2026

Code facts below are from a read-only mapping on `c20e8ee7`. Verify line numbers before editing.

### FB1: pending feedback on actions that wait for the API

**Owner:** sign-in (and likely every action that waits on the API) only greys the button out. That is not how top apps handle it.

**Today:**
- `Button` (`packages/mobile-ui/src/components.tsx:99-157`) has no busy prop. Callers pass `disabled={busy}`, so the label never changes.
- Only `StickyAction` (`StickyAction.tsx:14-51`, used with `busy` only by Dapur Mulai masak / Berangkat antar) and `SettingsRow busy` (Keluar) show a spinner.
- DESIGN.md (Loading continuity, inline tier) already names a "busy Button" that was never built.

**Build:**
- Add `busy` to `Button`. The label is swapped for a small spinner in the label colour, with the width and height kept. The button is not pressable while busy. `accessibilityState.busy` is set and the accessible name stays the label.
- Show the spinner after about 150 ms (D6), so a fast response never flashes it. Once shown, it stays until the response.
- Adopt `busy` at every call site that awaits a command:
  - customer: Masuk, Register, Recover, AuthCallback, AddressForm, BuyScreen, PaymentScreen, ClaimScreen, HelpForm, ReportProblem, ReportList, ChangeDaySheet, ChooseMenu, Plate (Sudah sampai), ReviewSheet, shell "Coba lagi";
  - Dapur: Masuk, Daftar, RoleGate, AktifkanScreen, PackageEditor, TimScreen, CustomerDetail, ImportAssistant, MenuWeek, MenuDayScreen, ExceptionSheet, ReportScreen.
- The OTP check that swaps the whole screen for `MascotLoading` "Memeriksa kode…" (`Masuk.tsx:33,61-66`) is a deliberate mascot-tier wait. Keep it unless the canvas shows the busy button reads better.
- Update both `no-spinner.test.tsx` files so an `ActivityIndicator` is allowed only inside a busy `Button`, `StickyAction`, `SettingsRow` or the Menu upload tile.

**References:** Booking.com, pliability, Greenlight (research section 1).

### FB2: the colour tone

**Owner:** the overall tone does not look great, and some colour pairings do not work. Rethink DESIGN.md's colour contract.

**Measured on the screenshots' pairings** (WCAG ratios, computed):
- Light Malam header `#0B1F16` against the hero `#1C3A2C`: **1.38:1**. Two near-black greens, so the hero card barely separates from the header.
- The Sunrise CTA `#F47B2A` with its charcoal label (4.99:1) sits on the Malam hero at 4.56:1. Orange on near-black green with a charcoal label reads muddy.
- A failed photo turns the hero's status overlay grey (66% dark over the `sage` fallback; see FB7), which adds a fourth unrelated tone.
- Light Siang header `#FFEFD9` against the canvas: **1.08:1**, and against the hero surface: **1.12:1**. The Siang header melts into the page.
- Dark Malam header against the dark canvas: 1.51:1.
- `native-contrast.test.ts` checks text only. It has no rule for adjacent surfaces, and it does not check the Sunrise button or text over photos.

**Process:**
1. Make audit-009 from a scripted contact sheet: the four looks (light/dark × Siang/Malam) × Beranda, Jelajah, Jadwal, plan detail, Akun, Pengaturan, and Dapur Hari ini, captured on the owner's phone.
2. The owner marks the pairings that look wrong.
3. A design canvas shows two or three directions on the same screens, iOS and Android side by side.
4. The owner picks one.
5. Write a new DESIGN.md section "Colour revision (Phase G), October 2026" that supersedes the mood table and any changed theme keys.
6. Update the exact-hex assertions in `native-contrast.test.ts`.
7. Add a surface-separation rule (adjacent surfaces at least about 1.2:1, or a border or shadow that carries the edge) and checks for the Sunrise button and the photo overlay.

**Decision:** the scope is the owner's call (D1). Token source: `packages/design-tokens/src/index.ts` (`colors`, `nativeThemes`, `nativeMood`, `nativeArt`).

### FB3: the caterer marks Sampai, the customer confirms

**Owner:** the caterer should be able to set Delivered. That does not mean the food really arrived: the customer still confirms, as on Shopee and Tokopedia.

**Today:**
- Statuses (`v1.fulfillments`): `scheduled, preparing, out_for_delivery, delivered, issue, cancelled`. Caterer moves go through `delivery.status` (Dapur never sends `delivered`), `delivery.cook` and `delivery.depart`.
- The customer's `delivery.confirm` sets `delivered`, `confirmed_by='customer'`.
- `v1.auto_deliver` (the daily `/api/jobs` at 09.00 Jakarta) marks the previous days' meals delivered with `confirmed_by='auto'`, skipping meals with an open report.
- `confirmed_by='caterer'` is allowed by the CHECK but never written.
- The web workspace lets a caterer set `delivered` directly (`seller-operations.tsx` ~1959).

**Recommended model (D2):**
- Do not add a status. Add `arrived_at` and `arrived_by` to `v1.fulfillments`, in the same way cooking and departure use `cooking_started_at` and `departed_at`.
- A new caterer command `delivery.arrive {catererId, date, meal, fulfillmentIds}`:
  - allowed from `out_for_delivery`, for Jakarta today only;
  - staff-checked and run in a transaction with row locks;
  - carries a **proof-of-delivery photo** per stop (D2, decided: yes), stored as `arrived_photo` on the fulfillment;
  - queues a push "Pesanan Anda sudah diantar. Sudah diterima?".
- **Proof photo:**
  - Dapur takes the photo with the camera when marking a stop Sampai. With several stops selected (FB11), the app asks for one photo per selected stop in turn; the canvas settles the exact flow.
  - The customer sees the photo on the hero beside Sudah sampai / Belum, and later in the day's detail.
  - Storage is tenant-scoped: only that customer and that caterer's staff can read it.
  - This depends on the production photo upload path, an open release item (G17). Build it for real here, not a demo-only path. Demo mode uses a synthetic photo.
- The meal stays `out_for_delivery` until it is confirmed:
  - by the customer's `delivery.confirm` (unchanged), or
  - by auto-confirm 2 hours after `arrived_at` (D2, decided), unless the customer tapped Belum or a report is open.
- "Belum" keeps opening the "Belum sampai" report. An open report blocks auto-confirm, as it does today.
- The next-day `auto_deliver` stays as the backstop.
- Domain:
  - `PlateState` gains `arrived_unconfirmed`. Hero copy: "Dapur menandai sudah sampai" with Sudah sampai / Belum.
  - `JourneyStage` reads `arrived_at` (see FB9).
  - `mealJourney`, `journeyCaption` and `statusLabel` follow.
- Web (D2, decided): the web workspace's "delivered" button today sets the final, confirmed status and skips the customer. It is changed to mark Sampai and wait for the customer, exactly like Dapur, with the same photo.
- Tests: a unit test, demo implementation, and PostgreSQL scenarios (arrive against customer confirm, arrive against a report being filed, double arrive, auto-confirm against a late report).

### FB4: notifications do not work at all

**Why, from the code:**
1. Expo Go cannot receive remote push on Android since SDK 53. The app correctly turns the switch off ("Tidak tersedia di versi aplikasi ini", `mobile-core/src/notifications.ts:8-14`). Only a development or store build can register.
2. Even with a build, pushes are only sent when `/api/jobs/push` runs. The 15-minute GitHub workflow (`.github/workflows/push-jobs.yml`) fires only from `main`, and Vercel's only cron is the daily `/api/jobs` at 09.00 Jakarta. A depart push queued at 11.00 would go out the next morning.
3. Expo push on Android needs an FCM V1 key in the EAS project, and iOS needs APNs. Neither has been set up.
4. The project IDs disagree: the app configs fall back to `17010cc0…` (customer) and `1c3f597c…` (Dapur), while the root `app.json` has `f5259168…`.

**Build:**
- **Send at the event (D7, decided).** A push goes out within seconds of an important event, not on a schedule:
  - dispatch right after the command that queues it (read the Next.js guide for `after()` first);
  - keep a scheduled backstop every few minutes for any push that failed, using Supabase `pg_cron` + `pg_net` or a working cron.
- **Events that push.** Every delivery status change pushes the customer:
  - Dimasak (new; `delivery.cook` has no push today);
  - Berangkat (exists);
  - Sampai, waiting for confirmation (new, FB3);
  - Gagal diantar (check that it exists);
  - Pindah tanggal by the caterer.
  - Keep the existing pushes: messages, reports, menu reminders, renewal, the "sudah sampai?" reminder.
  - Dedupe per customer, date, meal and stage, so a multi-package customer gets one push per change.
- Settle one EAS project per app.
- Then verify end to end on the development build (G12): enable, receive the depart push, tap through to `data.href`, revoke in phone settings, `device.unregister` on Keluar.
- The in-app updates list (Akun › Notifikasi) works without push. Check it on the phone in the Android gate (G10).

### FB5: no way to change account information

**Today:**
- Neither app has a screen or command to change the name, phone, email or password, or to delete the account.
- Akun shows the name and phone read-only (`apps/customer/src/account/Akun.tsx:106-124`).
- Existing building blocks:
  - `profile.ensure` (insert only);
  - web routes `auth/phone-send` and `auth/phone-verify` (Supabase `phone_change`, no mobile caller);
  - `updateUser({password})` (recovery only);
  - `accountRequest.create` kind `deletion` (web seller form only).

**Build:**
- A "Data akun" page in both apps, opened from the Akun header (customer) and Usaha › Pengaturan (Dapur). Its rows:
  - **Nama:** a new `profile.update`, own row only, in a transaction.
  - **Nomor HP:** a code sent to the new number, then the change; real SMS needs the production SMS credentials.
  - **Email:** a confirmation link; `double_confirm_changes` is on.
  - **Kata sandi:** only for email accounts; uses reauthentication.
  - **Hapus akun:** a request through `accountRequest.create`, with a confirm sheet stating what happens.
- The App Store (guideline 5.1.1(v)) and Google Play require a way to start account deletion inside an app that creates accounts.
- Demo mode simulates each change synthetically.
- Dapur's kitchen details shown to customers (kitchen name, contact) are not edited directly (D5, decided). Data akun in Dapur has a row "Ubah nama atau kontak dapur" that sends a change request to Catera (`accountRequest.create` kind `help`, or `support.create`) and shows the request's status.

**References:** foodpanda, Chick-fil-A, Uber, Booking.com (research section 6).

### FB6: change dates on a calendar

**Today:**
- The customer's Ubah hari (`schedule/ChangeDaySheet.tsx`, `DateChips` :381-432) is a horizontal strip of chips over a 30-day window from `deliveryAvailability`.
- Dapur's Pindah tanggal (`today/ExceptionSheet.tsx:265-281`) is a free-text field "Tanggal baru (TTTT-BB-HH)" validated by a regex.
- `@react-native-community/datetimepicker` is installed in Dapur but unused. The only in-repo calendar is the Jadwal `MonthGrid` (display only).

**Build:**
- A shared `CalendarSheet` (or `MonthPicker`) in `packages/mobile-ui`, built on the `monthWeeks` logic in `schedule/dates.ts`.
- Month paging across the allowed window. The current delivery day is outlined and the chosen day filled. Unavailable days are dimmed, with the reason on tap: Penuh, Terisi, Dapur libur, Lewat batas waktu.
- Tabular numerals, a large detent, and a "Pindah ke {tanggal}" button that is disabled until a new day is chosen.
- Use it in the customer sheet and in Dapur's Pindah tanggal. Dapur needs an availability read for the caterer side; check whether `deliveryAvailability` can serve it under staff authorization.
- The buy flow's start-date chips (`BuyScreen.tsx:100`, 8 options) stay chips unless the owner says otherwise.

**References:** Amazon, DoorDash, Starbucks, Bolt (research section 4).

### FB7: visual bug on the customer Beranda (screenshot 1)

Screenshot 2 shows FB8's error handling, not a visual bug in the arc (owner, October 12, 2026).

1. **Pale band at the top of the hero photo** (screenshot 1).
   - When the photo fails to load, `Photo` (`packages/mobile-ui/src/PhotoRing.tsx:15-35`) paints the theme `sage` (`#F0F3E9`).
   - The hero's `scrimSoft` covers only the bottom 75% (`Plate.tsx:312-345`), so the top quarter shows as a pale strip. The 66% dark overlay below it turns grey, and the "⋮" button (absolute, `top: 8`) straddles the edge.
   - Fix the fallback inside the mood hero: use the same forest ground as "no image", or a food-led placeholder. Find out why the photo failed on the phone: offline, a LAN or relative URL, or the `expo-image` cache policy losing a photo that was seen before.
2. Re-check the hero at font scale 1.3 and 360dp once FB9's tracker is in.

### FB8: errors must not be loose small text

**Owner:** an error should not appear as small text somewhere random (screenshot 2: "Terakhir diperbarui 21.39 · tidak ada koneksi" between the hero and the next row).

**Today:**
- The customer's offline line is a `sunriseInk` caption (`Beranda.tsx:464-473`, the same in `PlanDetail.tsx:201-203`).
- Dapur shows "tidak ada sinyal" in an attention card (`TodayScreen.tsx:446-457`).
- Command failures are mostly inline danger text with no icon and no announcement.
- Toasts are used for success, and for failures in only two places.
- There is no banner component and no network listener. Offline is inferred only from a failed read that has a kept copy.

**Build** (research section 2):
- **`ConnectionBanner`** in `packages/mobile-ui`, under the header at the top of the content:
  - an icon, the title "Tidak ada koneksi", the line "Menampilkan data terakhir, {HH.MM}" and "Coba lagi";
  - announced once; it hides itself on reconnect;
  - `@react-native-community/netinfo` through `expo install`, so it retries on reconnect;
  - one wording in both apps ("koneksi"), voice per app.
- **`ReadError`** moves from Dapur into `packages/mobile-ui`, and the customer screens adopt it where nothing is cached.
- **Form failures:** a `FormError` callout with an icon, placed at the form's action, using `accessibilityLiveRegion` (Android) and `announceForAccessibility` (iOS).
- **Non-form action failures** (for example Sudah sampai): an error toast with "Coba lagi".
- Remove every loose danger caption. A test fails on a bare `danger` caption outside `FormError`, `Field error` or `ReadError`.

### FB9: the tracker needs a stop for Terjadwal

**Owner:** the track shows three stops (Dimasak, Diantar, Sampai). Terjadwal has no place, so the bar does not move from Terjadwal to Dimasak.

**Today:** `RantangTrack` (`packages/mobile-ui/src/RantangTrack.tsx:21-26`) maps both `scheduled` and `preparing` to position 0. Only the marker outline-to-fill tells them apart, and the caption is the only accessible text. The component is also used by Dapur's count card (`TodayScreen.tsx:130-134`).

**Build:**
- Four stops (Terjadwal, Dimasak, Diantar, Sampai) at 0, ⅓, ⅔ and 1.
- With FB3, the Sampai stop has an "awaiting confirmation" look (half filled, caption "Ditandai sampai, menunggu konfirmasi Anda").
- `issue` (Gagal diantar) shows a warning stop, not a silent fallback.
- Update `daily-loop-ui.test.tsx` and the Dapur count-card tests.

### FB10: an icon per stage and an animated line

**Owner:** each stage gets its own icon (Terjadwal one icon, Dimasak a cooking icon, and so on), and the line may animate, so the current status is clear at a glance.

**Build** (research section 3: Keeta, Grab, talabat, Instacart, Zomato, DoorDash):
- One code-drawn glyph per stop, in the stroke style of `brand/Rantang.tsx`: Terjadwal a calendar or clock, Dimasak a pot with steam, Diantar a motorbike, Sampai a house with a check.
- Done stops filled. The current stop larger, with a ring. Later stops outlined in `heroMeta`.
- The line fills to the current stop. A stage change animates the fill and the stop with `nativeMotion.feature`. Decision A holds: nothing animates on the first paint.
- **No loop (D3, decided):** follow the Mobbin references as they are (Keeta, Grab, talabat, Instacart). Motion happens only when the stage changes; there is no travelling highlight or pulse.
- **Decided (D3):** the rantang brand object stays as the moving marker riding the line; the stop glyphs sit under it.

### FB11: per-customer status in Dapur and several delivery rounds

**Owner:** Dapur can only send the whole session at once. A kitchen may send lunch out in several rounds, so the caterer should select customers and set Berangkat or Sampai for them.

**Today:**
- `delivery.cook` and `delivery.depart` act on the whole session (caterer × date × meal).
- Per stop there is only "⋮" › Gagal diantar or Pindah tanggal (`ExceptionSheet`).
- There is no batch, round or courier concept. The web workspace already has checkbox multi-select with `delivery.statusBatch`.

**Build:**
- `delivery.depart` takes an optional `fulfillmentIds` (a subset). The push still goes once per customer.
- `delivery.arrive` (FB3) takes `fulfillmentIds`.
- Both commands are staff-checked and run in one transaction, and every id must belong to that caterer, date and meal.
- PostgreSQL scenarios: two staff departing overlapping subsets; arrive against depart; arrive against a customer confirm.
- Dapur "Urutan antar" gets a selection mode (research section 7):
  - "Pilih", then circles per stop, the count in the title, "Pilih semua" per area, and a bottom bar with "Berangkat (n)" and "Sampai (n)";
  - stops already past an action cannot be selected for it, and show why.
- The sticky footer becomes "Berangkat semua sisa · {n} porsi" once some stops have left.
- `kitchenSession` (`packages/domain/src/kitchen.ts:235-271`) and the count card handle mixed stages.
- Cooking stays one action per session unless the owner says otherwise. No named rounds (D4, decided): repeated departures are the rounds.

### Owner decisions

All answered on October 12, 2026.

| # | Decision | Status |
| --- | --- | --- |
| D1 | FB2 scope: re-tune how the approved hues (forest, sunrise, cream, charcoal) are applied, or allow new hues | **Decided: show first.** Build the four-look contact sheet and audit-009, show it to the owner, and only then set the scope. Do not draw palette directions before the owner has seen the audit. If the owner asks for a recommendation: re-tune first (mood header and hero values, surface separation, the Sunrise CTA, the photo overlay), and add new hues only if no re-tuned direction works |
| D2 | FB3: auto-confirm time, proof photo, web "delivered" | **Decided:** auto-confirm 2 hours after `arrived_at` unless the customer tapped Belum or a report is open, with the next-morning job as the backstop; a **proof-of-delivery photo** per stop; the web workspace's "delivered" button marks Sampai and waits for the customer, like Dapur |
| D3 | FB10: the tracker's motion; the rantang | **Decided:** no loop, follow the Mobbin references (motion only on a stage change); the rantang stays as the moving marker riding the line, with a glyph per stop |
| D4 | FB11: subset selection only, or named rounds | **Decided: selection only.** Rounds come from repeated departures; no round entity |
| D5 | FB5: the kitchen's public details in Dapur | **Decided:** changed by request to Catera (a request row in Data akun), not edited directly |
| D6 | FB1: the spinner delay (how long a pressed button waits before showing its spinner, so a fast response never flashes one) | **Decided: 150 ms** |
| D7 | FB4: when pushes go out | **Decided:** at the event, for every important event, including every delivery status change; a backstop retries failures |
| E1 | G1(c): on Android, swiping the Ada masalah sheet away with a typed note closes it without asking "Buang laporan?" (react-native-screens ignores the guard there); the note is kept as a draft in memory and comes back when the sheet reopens | **Decided: accept.** The draft comes back on reopen; it is lost only if the app is closed |
| E2 | G15: the real terms and privacy text for "Syarat dan privasi" | **Decided:** the owner supplies the text; until then, a page clearly labelled as a placeholder |
| E3 | G16: Masuk alignment; the sign-in screen centres the waving mascot but left-aligns the title, fields and buttons | **Decided (the owner left it to design): centred.** See G16 |
| E4 | G13: deleting an address that an upcoming delivery or an active plan still uses | **Decided: block, as Amazon Subscribe & Save does,** and offer to move the upcoming deliveries first. See G13 for the rule and the cases a subscription adds |
| E5 | The renewal start line "Mulai {tanggal}, tepat setelah paket sekarang" is not true when the start is pushed past other plans (audit-005: a plan ending 12 Okt offered "Mulai 10 Nov, tepat setelah paket sekarang") | **Decided:** say "tepat setelah paket sekarang" only when the start really is the next day; otherwise say it starts after the other plans end (the final wording comes from the copy audit, G18) |

## Order

Three sub-phases, each in a fresh session with a handoff file.

| Task | What | Depends on | Builder |
| --- | --- | --- | --- |
| **G-a design** | | | |
| G0 | Device environment: the owner's phone over `adb` with Expo Go, the demo backend on a fresh `CATERA_DEMO_DATA_DIR`, Metro per app with `EXPO_PUBLIC_API_URL` set to the LAN address; the emulator only if the owner approves the download | owner permission | Opus |
| G1 | Sheet go/no-go (below), on the phone | G0 | Opus |
| G2 | FB design pass: audit-009 (FB2 contact sheet plus FB1, FB7 to FB10 findings), a design canvas Artifact with iOS and Android side by side (busy button, banner and error states, the four-stop tracker with glyphs and motion, the calendar sheet, Data akun, the Dapur selection mode, two or three palette directions), the owner's picks for D1 to D7, then the spec `docs/superpowers/specs/2026-10-1x-native-phase-g-design.md` and the plan | G0, research doc | Opus (design and gate), Sonnet (spec and plan text) |
| **G-b build** | | | |
| G3 | Delivery state: `arrived_at`/`arrived_by`, `delivery.arrive`, `delivery.depart` subsets, auto-confirm, web alignment, domain states, demo, unit and PostgreSQL scenarios (FB3, FB11 data) | G2 | Opus (written reason) |
| G4 | Account commands: `profile.update`, phone and email change wiring, the deletion request from mobile, demo (FB5 data) | G2 | Sonnet |
| G5 | Push dispatch near the event and one EAS project per app (FB4 code; device proof in G12) | G2 | Sonnet |
| G6 | Shared UI: `Button busy`, `ConnectionBanner`, shared `ReadError`, `FormError`, `CalendarSheet`, the four-stop `RantangTrack` with glyphs and motion (FB1, FB6, FB8, FB9, FB10) | G2 | Sonnet |
| G7 | Palette revision in tokens, tests and DESIGN.md (FB2) | G2 | Sonnet |
| G8 | Customer screens: busy adoption, banner and error adoption, the calendar in Ubah hari, Data akun, the hero fixes, the arrived-unconfirmed hero (FB1, FB3, FB5, FB6, FB7, FB8) | G3, G4, G6, G7 | Sonnet |
| G9 | Dapur screens: busy adoption, the selection mode with Berangkat and Sampai, the calendar in Pindah tanggal, Data akun, the error adoption (FB1, FB5, FB6, FB8, FB11) | G3, G4, G6, G7 | Sonnet |
| G18 | Copy pass from the two copy audits (below) | the owner's copy decisions, settled in G2 | Sonnet (Opus copy review) |
| G13 | Address delete and move (old G6) | none | Opus (written reason: a tenant-authorized multi-row move under kitchen locks) |
| G15 | "Syarat dan privasi" page (old G7) | owner text or placeholder | Sonnet |
| G17 | The other parked Minors (old G9) | none | Sonnet |
| **G-c gate** | | | |
| G10 | Full Android gate on the final UI (old G2, below), plus every FB item on the phone and, if approved, the emulator | G8, G9 | Opus |
| G16 | Masuk alignment (old G8) | G10 | Sonnet |
| G11 | iOS run (old G3) | a Mac or iPhone | Opus |
| G12 | Development build: native splash, the Android 12 splash mask, predictive back, real push end to end (old G4 plus FB4) | EAS or a local build, FCM and APNs credentials | Opus |
| G14 | Fix rounds from G1, G10 to G12, the final gate, DESIGN.md corrections, the follow-up audit and a Phase H kickoff | all | Opus |

## G1: the sheet go/no-go (Task 9 Step 4)

On the phone (or the emulator) in Expo Go, open Ada masalah from a Hari row and check:

- (a) the sheet opens at the form detent;
- (b) typing expands it, and the keyboard never covers the focused field;
- (c) hardware back and swipe close it once and keep Hari. This includes a swipe with typed text, which cannot ask on Android because react-native-screens 4.26.2 ignores `preventNativeDismiss`. The note is kept as an in-memory draft instead; the owner decides whether that is acceptable;
- (d) TalkBack lands on the title;
- (e) the confirm sheet opens over it and returns. Check the same for the Dapur `impor-baris` sheet over the Impor modal.

Record each as PASS or FAIL with a capture in `output/native-review/phase-f/sheets-*.png`. **No fallback was taken in Phase F.**

If a check fails, stop, and report the failing check and the react-native-screens behaviour. Use the smallest fallback:
- keep the custom `Sheet` for forms with fields (Ada masalah, Alamat, review, Ubah hari) while choice, action and confirm sheets stay native;
- if only (e) fails, declare `konfirmasi` inside the tab stack layout too, and push it in-stack from `useUnsavedGuard`.

Take it to the owner before continuing. The FB6 `CalendarSheet` follows whatever G1 settles for form sheets.

## G10: the full Android gate (was G2)

**Coverage**
- Setup: the phone (and the emulator, if approved), demo backend, light and dark (`adb shell cmd uimode night yes` and `no`), Siang and Malam where relevant.
- Cold start signed in and signed out (before and after recordings).
- Beranda, Jelajah, Jadwal, plan detail, and Pengaturan with every switch state Expo Go can reach (Expo Go reports `unavailable`).
- Every new sheet, the success beat, the heart and toast, list motion, gizi, import, the four empty states, and Dapur Hari ini with its confirm sheets.
- Every FB item:
  - busy buttons;
  - banner, error and callout states, including flight mode on and off;
  - the four-stop tracker through every stage, including arrived-unconfirmed and Gagal diantar;
  - the calendar in both apps;
  - Data akun;
  - the Dapur selection mode with two rounds;
  - the hero with a failed photo;
  - the arc after scrolling;
  - the revised palette in all four looks.
- Font scale 1.3 at 360dp.
- Reduced motion: `adb shell settings put global animator_duration_scale 0` and "Remove animations".
- TalkBack on the switch, a sheet, a toast, the thumbnails, the tracker and the banner.

Record each Review Focus line of the plan as PASS or FAIL with a capture.

**Parked device checks from the ledger.** Each must get a verdict:

- Task 1: the Reanimated screens launch with the aligned Reanimated 4.5.1 and worklets 0.10.1.
- Task 2:
  - the Android snackbar assumes an 80dp tab bar and ignores the keyboard over a footer;
  - the screen-reader flag can resolve after launch;
  - a toast whose sheet closes jumps edge (iOS).
- Task 3:
  - a second `SuccessRig` play may paint one resting frame before the layout-effect reset;
  - crispness at 3x;
  - `MascotReading` above 144pt upscales.
- Task 4: the hand-off beat; the splash hides before the cached first-screen read lands.
- Task 5:
  - Android fade clipping;
  - font scale 1.3 on the skeletons;
  - one blank frame on a cached-launch empty reload;
  - iOS VoiceOver reading "Memperbarui…".
- Task 6: header heights measured on the phone, not compared from styles.
- Task 8: Keluar waiting up to 3 seconds; a cold Dapur link to a Pengaturan sheet opens over Hari ini.
- Task 10: Android nested scroll in long fit sheets; the picker to Alamat swap.
- Task 11: sheet detents and keyboard expansion in the Dapur sheets; TalkBack focus on each sheet title.
- Task 12:
  - the confetti box (a square over the beat, not the full screen);
  - the heart's dots clipped on row cards (`PackageCard.tsx`);
  - `RowSwap`'s native exits actually skipped on a filter or a pull;
  - list swaps skip row animations.
- Task 13:
  - empty and error art in light and dark at 360dp and font 1.3;
  - the count card's fade and layout;
  - TalkBack on the art states.
- Task 14:
  - Android range tiles two by two at font 1.0 on 360dp;
  - the Dapur switch row with TalkBack;
  - select-on-focus replacing a carried range on the first keystroke.
- Task 15: the Android corner remove target; TalkBack reading announce.

## G11: the iOS run (was G3)

No iOS surface has ever run.

**Sheets and toasts**
- The large-title sheets and the keyboard in sheets.
- The iOS toast placement: under the large title, under the mood header, and at the bottom of a sheet above the keyboard and any footer. The bottom-of-sheet toast currently over-clears a footer by 34pt.
- The confirm sheet over a tab-stack sheet. This is the highest risk.

**The day's "..." handing off to a sheet in another stack**
- Where: Hari, the Beranda hero and the plan detail's upcoming rows. "..." then Pindah tanggal (now the FB6 calendar), Ganti alamat hari ini and Laporkan masalah must each open their sheet, never be dropped or flash.
- The answer now waits `SHEET_CLOSE_MS` 400 after `/aksi` leaves. Judge whether that wait reads as lag, and tune it.
- The final Phase F review recommends answering on the root stack's `onFinishTransitioning` (reachable through `<Stack unstable_nativeProps>`, unconfirmed), with a timer of about 800 to 1000ms as the fallback. Its reason: a 400ms answer can land while the old sheet is still dismissing, and react-native-screens then drops the next one (RNSScreenStack.mm:481-483).
- The Jest iOS swipe test sends the two native events in the reverse of their device order, so a device swipe probably answers after the wait.

**Other checks**
- A discard from the confirm sheet closing the form under it.
- Beli's picker choice.
- The unsaved guard with a swipe, including the narrow window before `preventNativeDismiss` reaches native.
- The iOS share toast after a real share.
- Tile layouts at 390pt (two by two with ranges).
- VoiceOver on the switch, a sheet, a toast, the thumbnails, the reading announcement, the tracker and the banner.
- Every FB item on iOS.
- Everything Phase E left open: the large title and its collapse, the minimizing tab bar, insets under the mood header, swipe back, bar titles at the largest Dynamic Type, the paid swipe guard.

## G12: the development build (was G4, now with FB4)

Expo Go never shows Catera's splash, icons, predictive back or push. Build a development client (`npx expo run:android`, which needs a JDK, or an EAS development build if the owner supplies credentials).

**Check**
- The native splash and icons on both platforms: light and dark canvases, and `imageWidth` 200 against the Android 12 circular mask, which is the first thing to tune.
- The iOS 18 dark and tinted icons.
- The hand-off from splash to `LaunchCover`.
- Push, end to end (FB4):
  - registration with the settled EAS project;
  - the depart push arriving within minutes of Berangkat (G5's dispatch);
  - the FB3 arrived push;
  - tapping a push opens its `data.href`;
  - the switch states: on, off, denied after revoking in the phone's settings, and a permission changed while the app is closed;
  - `device.unregister` on sign-out against a real token.

**Predictive back:** run the matrix in `docs/PREDICTIVE-BACK.md` on API 34, 35 and 36 (and the hide-on-scroll spike for the Android tab bar). Ship the flag only if every row passes.

## G18: the copy pass (was G5, widened on October 12, 2026)

The owner found the wording AI-sounding: flat and "kaku", the Indonesian most of all, the English too. The target voice is top shipped apps (Gojek, GoFood, Tokopedia, Shopee and Grab for Indonesian; Uber Eats, DoorDash, Airbnb and Square for English). From now on, every pass that writes UI copy invokes `humanizer`, `antislop:antislop-copywriting` and `antislop:antislop-human`, besides the design skill set.

**Audits (input, read first)**
- [Customer app](../research/2026-10-12-copy-audit-customer.md): about 1,190 strings read, 153 flagged, 8 owner decisions, about 134 test lines affected across 22 customer test files plus a few in `tests/`. The patterns:
  - formal written words such as "Silakan", "terlebih dahulu" and "tidak dapat", mostly in the shared error map and the push bodies;
  - passive sentences with no actor;
  - "Anda" in nearly every sentence;
  - one generic "Belum berhasil. Coba lagi." at 12 places;
  - term drift: "katering" and "katerer", "Disiapkan" against "Sedang dimasak";
  - English translated from the Indonesian ("Couldn't load yet");
  - two pushes printing a raw ISO date;
  - three claims the system cannot back (R-17): "1 menit", "tanpa jeda" and "dari bank".
- [Dapur app](../research/2026-10-12-copy-audit-dapur.md): about 570 strings read, 109 flagged, 8 owner decisions, about 48 test assertions across 10 Dapur test files. The patterns:
  - 34 strings that stay Indonesian in English mode (SlotEditor, package validation, import reasons, the "1 portions" footer);
  - calques such as "Leave to deliver now?";
  - mixed terms: "pengantaran" and "antaran", "Terkirim" and "Sampai", "HP" and "ponsel";
  - the old "Anda" list, folded in;
  - one R-17 problem: the date-move sheet says "Pelanggan diberi tahu", which is not true for customers without an account.

**Owner decisions before the build** (the full lists are in each audit's decisions section)
- Customer register: move from "Anda" to "kamu", and drop the pronoun where the sentence works without it. The audit recommends it. It touches about 45 strings, DESIGN.md (the unsaved guard and the launch line) and the customer `useUnsavedGuard` voice.
- "Menunggu Anda" becomes "Perlu kamu urus" / "Needs you" (recommended) if the register changes.
- **Decided (October 12, 2026): "katering"** for the business, across both apps, the shared strings and the pushes. The owner finds it more familiar. Every customer-visible "katerer" becomes "katering" (about 11 in the shared domain strings and the pushes).
- Dapur: "Pembantu" for the staff role (proposed "staf dapur"; PRODUCT.md fixes the name), "Pindah hari" or "Pindah tanggal", "antaran" and "HP" as the glossary, "Simpan paket" or "Terbitkan paket" (check what `package.save` does first), and the push title "Catera" or "Catera Dapur".
- The rest: "Tercatat sampai", "Demo (data sintetis)", the invented-looking "Bu Rini" search placeholder (R-38), and the review-time claim "1 sampai 2 hari kerja".

**Build**
1. Apply the approved rows in both apps and the shared packages, plus the push bodies in SQL and `apps/web/src/lib/push-dispatch.ts`. Push bodies change through a new migration; never edit an applied migration.
2. The status words, the glossary and the error map are shared. Change them once in `packages/domain` so both apps and the pushes say the same thing.
3. Keep `customers/CustomerDetail.tsx:69-71` as written: it is sent to the customer, and its register follows the customer decision.
4. Update the asserting tests in the same commit as each string. Update DESIGN.md where it quotes a changed string.
5. New copy written for the FB items (busy states, banners, the tracker, the calendar, Data akun, the selection mode, the address sheets) uses the approved voice from the start. G2's canvas shows it.
6. Gate: an Opus copy review of the diff with `humanizer`, both languages, before G10 captures the screens.

## G13: address delete (was G6)

No `address.delete` command exists, so Phase F shipped no delete and no "Alamat dihapus" toast (the spec listed both).

**What the schema already does.** A delivery day keeps its own copy of the address (`v1.delivery_days.address`, written as `to_jsonb(address) - 'user_id'`, so the copy carries the address `id`). Deleting a saved address therefore never changes where a scheduled delivery goes. That is the risk: a customer deletes "Kos lama" and expects the food to stop going there. Only `v1.checkouts.address_id` is a foreign key (nullable since `20260914160856`), so a hard delete also breaks the payment history's link.

**References.** Amazon blocks the delete: "You can't delete an address with pending Subscribe and Save orders"; the customer moves those orders to another address first ([Amazon help](https://www.amazon.com/gp/help/customer/display.html?nodeId=GQT5HV6YYGNDSFNW)). Shopee and Tokopedia orders are one delivery each and keep their own copy, so deleting an address there never affects a placed order; that model does not carry over to a plan of 20 days. HelloFresh's and Factor's public help pages do not describe the case.

**The rule (E4, decided).**
1. "In use" means a delivery day dated today or later, not `delivered` or `cancelled`, whose copy has this address's `id`, or a `pending` checkout with this `address_id`.
2. An address in use cannot be deleted. The confirm sheet says so and names the deliveries: "Alamat ini masih dipakai untuk 12 pengiriman, 13 Okt sampai 31 Okt." (final wording from G18). It offers "Pindahkan ke alamat lain" and "Batal".
3. "Pindahkan ke alamat lain" picks another saved address and moves every movable day in one command (`address.replace`, built on `delivery.address`): same transaction, the same per-caterer advisory lock, the same `COVERAGE` check per plan, and the same cutoff as a one-day change. Days past their cutoff stay where they are; the sheet says how many stay and until when, and the delete becomes possible once they are done.
4. One address can serve several plans with different kitchens; a target address outside one kitchen's areas moves only the other plans' days and names the kitchen whose days could not move.
5. An address not in use is deleted with a confirm sheet, no undo. Keep it as a soft delete (`archived_at`), hidden from Alamat and the pickers, so paid checkouts and past deliveries still read their address.
6. Editing an address is a separate question (does an edit update the copies on upcoming days?). G13 records the current behaviour and does not change it.

**Build**
1. `address.delete` and `address.replace` in database transactions with tenant authorization: the caller acts only on their own addresses and their own delivery days.
2. The demo implementation, unit tests, and PostgreSQL concurrency scenarios: a delete racing a checkout on the same address, and a replace racing a kitchen's `delivery.cook` on the same day.
3. Wire the Alamat row exit (`useListMotion`) and the toast "Alamat dihapus". The delete and move buttons use `busy` (FB1).

## G15: "Syarat dan privasi" (was G7)

`apps/customer/src/settings/Pengaturan.tsx:119-120` and `apps/caterer/src/settings/Pengaturan.tsx:118-120` show a "Segera hadir" row with a TODO, because `apps/web` has no terms page.

- Add the page. Real terms and privacy text must come from the owner; until then use a clearly labelled placeholder, never invented legal text.
- Open it in the in-app browser from both rows, and remove the TODO.
- Data akun's "Hapus akun" (FB5) links to the privacy section once it exists.

## G16: Masuk alignment (was G8)

Task 13 left Masuk with mixed alignment: the waving mascot centred, the rest start-aligned. The owner left the choice to design (E3): **centred**. The mascot and the line under it already sit on the centre axis, and fields and buttons are full width, so they read on either axis. Centre the text buttons under the primary button ("Ganti nomor", "Masuk dengan email", "Lupa kata sandi?", "Daftar dengan email"). Field labels stay start-aligned above their fields, as forms do on both platforms, and the error moves beside the action (FB8 `FormError`). Apply it in both apps' sign-in screens, show it on the G2 canvas, and cover it in `empty-states.test.tsx`. The busy button (FB1) lands first.

## G17: the other parked Minors (was G9)

**Task 1**
- Reword the comments at `metro.config.js:6-7` and `jest.config.cjs:2` in both apps; they describe the old hoisted-Reanimated workaround.
- Note in RUNBOOK that the root `package.json` `overrides` pin Reanimated and worklets exactly, and must be bumped by hand at the next SDK upgrade.
- Jest 30 is kept through `expo.install.exclude`, against the SDK's 29.7.
- `expo` and `expo-router` moved from exact pins to tilde (`~57.0.27`, `~57.0.25`) through `expo install --fix`; the lockfile pins the actual version. Record this in RUNBOOK beside the overrides note.

**Task 2**
- Add `*` peer dependencies for `react-native-screens`, `react-native-safe-area-context` and `expo-router` to `packages/mobile-ui/package.json`.
- Add `ScreenPresentationContext` (a deep expo-router import) to the upgrade checklist.
- Add a test for `MoodHeader` as an iOS `Screen` header.
- The Android footer anchor following the keyboard.
- The iOS sheet footer over-clear.
- Detail screens with `headerShown: false` use the toast's fallback anchor, not a measured one.

**Task 3**
- `MascotArt` and the rigs use React Native `Image` where `expo-image` is preferred.
- `Sparkle` colour is a plain string.
- `MascotArt` stretches by under 0.4%.
- `crispMaxSize` is computed from the nominal `subjectPx`, not the measured visible box.

**Task 4**
- Count `app_open` only after `me()` confirms (`usage.ts:27-43`).
- The `act()` warnings added in `shell.test` and `today.test`.
- The UNAUTHORIZED test should assert no command is sent and the actor key is removed.
- Add the in-flight inactive-to-active case to the single-`me()` test.
- The AppState guard is timing-dependent.
- `TOKEN_REFRESHED` can fire a second `me()`.

**Task 5**
- `stillSignedIn` reads mobile-core's private actor storage (`Beranda.tsx:49-57`).
- The Jelajah placeholder read keeps hook order.
- The guard regex spacing.
- Font scale 1.3 on the skeletons.
- The `inside(heart, node)` tautology at `skeletons.test.tsx:236`.
- The double blank line at `ReportProblem.tsx:118-119`.
- The accepted 20pt header difference on sign-in and not-found states.

**Task 6**
- The Pelanggan skeleton lacks the chip row.
- Hari ini's body skeleton lacks the "Per paket" rows.
- The no-spinner scan rules are loose: a `photo-spinner` test id substring, and "Memuat" literals that end in an ellipsis. Tighten them together with FB1's test change.
- The `paket/baru` and `[id]` missing-check inconsistency.
- Menu cold-read residuals: the single-meal caption line, the day count when seven days wrap, and the empty-kitchen header shrink. Keeping the Menu read cached would remove them.
- The theme guard regex could over-match a non-self-closing `<RefreshControl>`.

**Task 7**
- Add a signed-out `{}` payload case to pin the wrapper order.
- The concurrency scenario cannot prove overlap.
- A whitespace-only token returns `removed: 0`.

**Task 8**
- Dapur Keluar relies on the root layout swap instead of popping its tab stacks.

**Task 9**
- The sign-in sentence is duplicated (`ReportProblem` and `SignInFirst.tsx:26`).
- No test for the `leaving` reset (`sheets.ts:209-214`).
- The finding-3 test reaches an expo-router internal store path.
- A warm OS link to the same masalah with a typed note now asks "Buang laporan?" (untested).

**Task 11**
- A typed move returns after switching to Gagal diantar plus a swipe. FB6 replaces the typed date field; re-check this with the calendar.
- The import phone field saves on blur.
- The font-scale test is a proxy.
- Tim bottom padding.
- The package-row chevron.
- The parked singleton.

**Task 12**
- Nothing beyond the device checks.

**Task 13**
- Assert the screen-reader props on a held slot.
- `bingung` on the Siang Jadwal header.
- Device captures (G10).

**Task 14**
- A one-frame reflow of the tiles before `onLayout` (`NutritionCard.tsx`).
- The "Gizi per porsi" header is 15/22 while sibling editor headers are 12/23 (`NutritionFields.tsx`).
- No test for the Dapur gram fields wrapping at font 1.3.
- A carried gram range clears on the first keystroke if the cursor sits inside it (`package.ts`).
- `nutrition.test.tsx` has a missing space near "=[full".
- The alignment test checks only `alignItems`.

**Task 15**
- The merge cap in `setFiles` is defence behind the slice and the `picking` guard, and no test fails without it.

**Final review M4**
- Move Pengaturan and its choice sheets (`apps/{customer,caterer}/src/settings/Pengaturan.tsx` and `ChoiceSheets.tsx`) into `packages/mobile-ui` with `voice`, `supporting` and `onSignedOut` props, so a later Pengaturan change cannot land in one app only.
- The two copies differ only in the voice of two strings, the channel name, the supporting line and the after-logout `goToTab`.
- Do this before FB5 adds Data akun rows, so they land once.

**Other parked items**
- **T-KL:** `apps/caterer/tests/fixtures.ts:20` `seq` never resets, so ids depend on test order.
- **fix-sheetheader:** the report's SHA and callers list are stale (non-blocking).
- **Release items from earlier phases:**
  - the production photo upload path;
  - "Tercatat sampai" is not reachable in production; FB3's auto-confirm and dispatch may change this, so re-check;
  - the renewal screen's "tepat setelah paket sekarang" (owner decision pending).

## Return contract

Each task returns:
- the commit SHA;
- the tests added or changed, with their output;
- the files touched;
- for every device check, PASS, FAIL or NOT VERIFIED with a capture path.

Nothing is called verified without a capture or a recorded click-through.

At each sub-phase end, write the handoff file. When G14 finishes:
- write a new `audit-008-followup-<date>.md` (or `audit-009-followup-<date>.md` for the FB items);
- update DESIGN.md, MASCOT-MOTION.md and this file's successor;
- commit `docs: Phase G gate`.
