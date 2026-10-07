# Catera customer app rebuild (Plan 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer app ("Catera", `apps/customer`) from the approved spec and canvas. This covers:
- the arrival loop (Berangkat → Sudah sampai)
- claim and renew links that work on web and open the app
- the one-screen checkout
- the backend rules those need

**Architecture:**
- **Backend:** SQL migrations add `delivery.confirm`, `delivery.depart`, reactions, the claim preview, timed pushes and the open-report hold. Each layers on `catera_v1_command` / `catera_v1_read` / `catera_v1_system` by the rename-and-wrap pattern of `supabase/migrations/20261001180039_saved_packages.sql` and `20261007100000_auto_delivered.sql`.
- **Domain:** pure customer-day functions go in `@catera/domain` so the web reuses them later.
- **App:** `apps/customer` is rebuilt on `@catera/mobile-core` and `@catera/mobile-ui`, screen by screen. The old `src/` is deleted in the last task.

**Tech Stack:** Expo SDK 57.0.21, React Native 0.86.3, React 19.2.3, expo-router 57, Jest 30 + jest-expo + @testing-library/react-native, Vitest (root), PGlite demo DB + PostgreSQL harness (`npm run test:postgres`), Next.js 16 API in `apps/web`, `react-native-qrcode-svg` (already a dependency).

**Spec:** `docs/superpowers/specs/2026-10-07-customer-app-design.md` (commit `406308f`). **Screens:** https://claude.ai/artifact/LhXtQnZVv8npM6RtgA494v.

**Not in this plan:**
- web customer screens other than the claim page (spec §8 → Plan 3b)
- the caterer app's Berangkat button and weekly reaction summary (caterer track)

## Global Constraints

- **Branch and staging:** work on `v2` directly (AGENTS.md). Another session works on `apps/caterer` in the same tree, so stage exact paths only, never `git add -A`.
- **Shared packages:** `packages/mobile-core` and `packages/mobile-ui` are shared with Catera Dapur. Only add exports; never change an existing signature.
- **Copy:** Indonesian first through `t(id, en)`. No internal terms in UI copy (slot, siklus, fulfillment, cutoff, settlement). Times in Asia/Jakarta, formatted `11.00–13.00`.
- **Colours:** DESIGN.md tokens only:

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

  Sunrise is used only for "needs you now" (Sudah sampai, Perpanjang, cutoff today), with charcoal `#2E2E2E` text, never white.
- **Type and touch:** Plus Jakarta Sans (`FONT` from mobile-ui), scale 28/20/16/13, tabular numerals for times and rupiah. Touch targets ≥ 44pt.
- **Layout:** days after today are plain rows. Cards only for the plate, package and renewal.
- **Data safety:** demo mode is explicit and synthetic. No real customer data in fixtures. No secrets in code.
- **Transactions:** reservation, entitlement and role-sensitive changes stay inside one SQL transaction. Commands are idempotent per `request_id`.
- **New migrations:** each one gets an "installed?" guard in `packages/backend/src/database.ts` (`createDemoDatabase`), like the existing `to_regprocedure(...)` guards.
- **Verification after material changes:** `npm run typecheck`, `npm test`, `npm run build`, `npm test -w @catera/customer`, `npm run test:postgres`.

## Review Focus

1. **Phone in another timezone, or after midnight Jakarta.** "Hari ini", the plate state and confirm eligibility use Jakarta dates, never device local dates. Tests in Task 6 and Task 2.
2. **Double taps and retries.** Berangkat twice, Sudah sampai twice, or confirm racing the morning auto-confirm: one final state, one earning, one push. Tests in Tasks 2 and 3.
3. **Someone else's link or delivery.** An unknown or used claim token returns `NOT_FOUND` with no hint. Confirming another customer's delivery returns `FORBIDDEN`. The claim preview exposes only the 7 preview fields. Tests in Tasks 2 and 5.
4. **A report before the morning run.** A reported meal is not auto-confirmed and earns nothing until resolved. Tests in Task 3.
5. **Slow or no network on the phone.** Beranda shows the last loaded day with "Terakhir diperbarui HH.MM", never a blank screen. Payment status survives leaving and reopening the Bayar screen. Tests in Tasks 7 and 12.

---

### Task 1: Customer delivery read exposes arrival facts

**Files:**
- Create: `supabase/migrations/20261008090000_customer_arrival.sql`
- Modify: `packages/backend/src/database.ts` (guard)
- Modify: `packages/domain/src/index.ts` (`Delivery.meals` type)
- Test: `tests/customer-arrival.test.ts`

**Interfaces:**
- Produces:
  - **Columns on `v1.fulfillments`:** `departed_at timestamptz`, `confirmed_at timestamptz`, `confirmed_by text check (confirmed_by in ('customer','auto','caterer'))`.
  - **Table `v1.delivery_reactions`:** `(day_id uuid, meal text, user_id uuid, reaction text check in ('enak','biasa','kurang'), created_at timestamptz default now(), primary key(day_id, meal))`, with RLS enabled and no policies.
  - **`v1.delivery(d)`** is redefined from its latest version in `supabase/migrations/20260914160856_paid_seller_pilot.sql`, changed only so each `meals[]` item is `{meal, status, departed_at, confirmed_at, reaction, issue: {id, status} | null}`. `issue` is the newest `delivery_issues` row for that day and meal in `open`/`responded`/`escalated`.
  - **Domain type** `DeliveryMeal = { meal: "lunch" | "dinner"; status: string; departed_at?: string | null; confirmed_at?: string | null; reaction?: "enak" | "biasa" | "kurang" | null; issue?: { id: string; status: string } | null }`, with `Delivery.meals: DeliveryMeal[]`.

- [ ] **Step 1: Write the failing test** `tests/customer-arrival.test.ts`. Use `createDemoDatabase`; follow `tests/auto-delivered.test.ts` for setup.
  - `it("exposes departure, confirmation, reaction and open report per meal")`: insert a demo delivery, set `departed_at` on its fulfillment and add an `open` `delivery_issues` row. The demo customer's `customer` read for that delivery has `meals[0]` with `departed_at` set, `confirmed_at: null`, `reaction: null` and `issue.status: "open"`.
- [ ] **Step 2: Run it.** `npx vitest run tests/customer-arrival.test.ts`. Expected: FAIL (`departed_at` undefined).
- [ ] **Step 3:** Write the migration and the guard (`to_regclass('v1.delivery_reactions')`), and extend the domain type.
- [ ] **Step 4: Run it.** Expected: PASS. Then run `npx vitest run tests/calendar.test.ts tests/customer-actions.test.ts`: still PASS.
- [ ] **Step 5: Commit.** `feat(backend): customer delivery read exposes arrival facts`

### Task 2: `delivery.confirm` and `delivery.react`

**Files:**
- Create: `supabase/migrations/20261008091000_delivery_confirm.sql`
- Modify: `packages/backend/src/database.ts`
- Test: `tests/delivery-confirm.test.ts`
- Test: `tests/postgres-delivery-confirm.mjs`, imported from `tests/postgres-concurrency.mjs` after `verifyAutoDelivered`

**Interfaces:**
- Consumes: Task 1 columns and table.
- Produces: commands through `catera_v1_command`:
  - **`delivery.confirm`** with payload `{deliveryId: uuid, meal: "lunch"|"dinner", reaction?: "enak"|"biasa"|"kurang"}`, returning `{status: "delivered", confirmedAt}`.
    - **Allowed when** the actor owns the subscription and `service_date` is today or yesterday in Asia/Jakarta. The fulfillment must be `out_for_delivery`, or `scheduled`/`preparing` with the window start passed.
    - **Window start** comes from `v1.window_bounds(offer jsonb, meal text, day date) returns tstzrange`: it parses `offer->'windows'->>meal` as `HH.MM–HH.MM` in Asia/Jakarta and falls back to 11.00–13.00 for lunch and 17.00–19.00 for dinner.
    - **Effect:** sets status `delivered`, `confirmed_at = now()`, `confirmed_by = 'customer'`. The day status is derived exactly as `v1.auto_deliver` does: delivered when no fulfillment remains open, and the subscription is completed when no open day remains. Earnings come from the existing trigger.
    - **Errors and repeats:** already delivered → no status change, the reaction is still upserted, the same result is returned. An open report for that day and meal → `NOT_ALLOWED`. Day or fulfillment cancelled → `NOT_AVAILABLE`. Not the owner → `FORBIDDEN`.
    - **Clean-up:** deletes any unprocessed outbox row with `dedupe = 'arrive:'||day_id||':'||meal` (the Task 4 reminder).
  - **`delivery.react`** with payload `{deliveryId, meal, reaction}`: the owner only, the fulfillment `delivered`, and `confirmed_at` (or the day's update time) within 48 hours. It upserts the reaction and returns `{reaction}`.

- [ ] **Step 1: Write the failing tests** in `tests/delivery-confirm.test.ts`:
  - `confirms an on-the-way meal for its owner and records one earning`. Expect `meals[0].status === "delivered"`, `confirmed_at` set, and exactly one `earned` settlement entry for the day (same assertion style as `tests/auto-delivered.test.ts`).
  - `refuses another customer` → `FORBIDDEN`.
  - `refuses while a report is open` → `NOT_ALLOWED`.
  - `refuses before the window when the caterer has not departed` (service date today, window 11.00–13.00, frozen time 10.00 WIB via `set local` of a test clock, or by choosing a future-dated window) → `NOT_ALLOWED`.
  - `is a no-op the second time and keeps the reaction` (confirm with `enak`, then confirm with `kurang` → still delivered, reaction `kurang`, earnings count 1).
  - `uses the Jakarta date` (service date yesterday in Jakarta is accepted; 2 days ago → `NOT_ALLOWED`).
- [ ] **Step 2: Run it.** `npx vitest run tests/delivery-confirm.test.ts`. Expected: FAIL `INVALID_ACTION`.
- [ ] **Step 3:** Implement the migration by wrapping `catera_v1_command` the way `20261001180039_saved_packages.sql` does, with base name `catera_v1_command_confirm_base`. Lock order: `delivery_days` row `for update`, then the fulfillment. Add the guard in `database.ts`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Concurrency module** `tests/postgres-delivery-confirm.mjs` exports `verifyDeliveryConfirm(pool)`. It runs `delivery.confirm` and `catera_v1_system('delivery.autoDeliver', {today: <tomorrow>})` in parallel on the same day 20 times. Assert each day ends `delivered` with exactly one earning, and `confirmed_by ∈ {customer, auto}`. Run `npm run test:postgres`. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(backend): customers confirm arrival and react`

### Task 3: `delivery.depart` and the open-report hold

**Files:**
- Create: `supabase/migrations/20261008092000_delivery_depart.sql`
- Modify: `packages/backend/src/database.ts`
- Test: `tests/delivery-depart.test.ts`
- Test: extend `tests/postgres-delivery-confirm.mjs`

**Interfaces:**
- Produces:
  - **`delivery.depart`** with payload `{catererId, date: "YYYY-MM-DD", meal}`, returning `{moved: number}`.
    - **Who:** owner or staff via `v1.is_staff(catererId)`.
    - **Effect:** locks that caterer's day and meal fulfillments whose subscription package belongs to the caterer, in `day_id` order. Those in `scheduled`/`preparing` become `out_for_delivery` with `departed_at = now()`.
    - **Push:** for each moved fulfillment, `v1.notify(customer, 'delivery', 'Makan siangmu sedang diantar dari ' || caterer name, '/today')`. The dinner copy is `Makan malammu…`. Notifications are deduped by `'depart:'||day_id||':'||meal`, so a second call moves 0 and notifies 0.
  - **`v1.auto_deliver(p_today)`** is redefined from `20261007100000_auto_delivered.sql`. Changes:
    - skip any fulfillment with a `delivery_issues` row in `open`/`responded`/`escalated` for the same day and meal
    - auto-marked fulfillments get `confirmed_at = now()`, `confirmed_by = 'auto'`
    - a day with a held fulfillment stays in its current status

- [ ] **Step 1: Write the failing tests:**
  - `moves scheduled meals on the way once and notifies once`: the first call gives `moved: 2`; the second gives `moved: 0`; one `delivery` notification per customer.
  - `staff may depart, another caterer may not` → second is `FORBIDDEN`.
  - `auto-deliver holds a reported meal`: yesterday's day with an `open` issue stays undelivered with no earning after `delivery.autoDeliver`. After the issue is set `resolved`, the next run delivers it.
  - `auto-deliver records confirmed_by auto`.
- [ ] **Step 2: Run it.** `npx vitest run tests/delivery-depart.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the migration (command wrap base `catera_v1_command_depart_base`) and the guard.
- [ ] **Step 4: Run it.** Then `npx vitest run tests/auto-delivered.test.ts tests/delivery-confirm.test.ts`. Expected: PASS.
- [ ] **Step 5: Concurrency.** Add to `verifyDeliveryConfirm`: 10× parallel `deliveryIssue.create` vs `delivery.autoDeliver` on the same day and meal. Each run ends with either (delivered, report exists, settlement held per `v1.settlement_held`) or (not delivered, no earning). Never delivered with an earning that isn't held. Run `npm run test:postgres`. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(backend): caterer departure and report hold`

### Task 4: Timed and immediate pushes

**Files:**
- Create: `supabase/migrations/20261008093000_push_timing.sql`
- Create: `apps/web/src/lib/push-dispatch.ts`
- Create: `apps/web/src/app/api/jobs/push/route.ts`
- Modify: `apps/web/src/app/api/jobs/route.ts` (use `dispatchPushes`)
- Modify: `apps/web/src/app/api/v1/[...path]/route.ts` (after commands `delivery.depart` and `customer.followup`, and the `deliveryIssue.respond`/`resolve` paths, `await dispatchPushes({limit: 50})` inside `try`, never failing the command response)
- Create: `.github/workflows/push-jobs.yml`
- Test: `tests/push-timing.test.ts`

**Interfaces:**
- Produces system actions, service_role only, in the `catera_v1_system` wrap (base `catera_v1_system_push_base`):
  - **`delivery.remindDue`** with payload `{now: ISO}`, returning `{queued}`.
    - **Queues for** every fulfillment with `service_date` = Jakarta today, status in `scheduled`/`preparing`/`out_for_delivery`, no open report, and `upper(v1.window_bounds(...)) + interval '60 minutes' <= now`.
    - **Push:** `v1.notify(customer,'delivery','Makanan hari ini sudah sampai? Tandai di Catera.','/today')` with dedupe `'arrive:'||day_id||':'||meal`.
    - **Dedupe:** `v1.notify` is extended as `v1.notify(u,k,b,h,dedupe text default null)`, with the old 4-arg form kept.
  - **`subscription.remindRenewal`** with payload `{today: date, hour: int}`. It does nothing unless `hour >= 9`. Otherwise it notifies each active subscription with `remaining = 3`: `'Paket {name} tinggal 3 hari. Perpanjang tanpa jeda.'` with href `/renew/'||id`, deduped by `'renew3:'||id`.
  - **`outbox.claimPush`** with payload `{limit}`. Like `outbox.claim` but `kind='push'` only, `available_at <= now()`, `for update skip locked`.
- Produces `dispatchPushes(options: { limit: number }): Promise<{ sent: number }>` in `apps/web/src/lib/push-dispatch.ts`. It is the push branch moved verbatim out of `api/jobs/route.ts`: eligibility, devices, Expo send, `push.ticket`, `outbox.complete`/retry. It claims through `outbox.claimPush`.
- **`GET /api/jobs/push`:** same `CRON_SECRET` bearer check as `/api/jobs`. It calls `delivery.remindDue {now}`, then `subscription.remindRenewal {today: jakartaDay(now), hour: Jakarta hour}`, then `dispatchPushes({limit: 200})`, and returns `{queued, sent}`.
- **Workflow:** `push-jobs.yml` runs on `schedule: cron "*/15 * * * *"` plus `workflow_dispatch`, and `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$CATERA_PUBLIC_URL/api/jobs/push"`. Secrets: `CRON_SECRET`, `CATERA_PUBLIC_URL`.

- [ ] **Step 1: Write the failing tests:**
  - `queues one arrival reminder an hour after the window`: lunch window 11.00–13.00, `now` 13.59 WIB → 0; 14.00 WIB → 1; again at 14.15 → still 1 outbox row.
  - `does not remind after confirm or report`: confirm, then remindDue → 0; an existing reminder row is deleted by confirm (Task 2).
  - `renewal reminder once at 3 days left after 09.00`: `hour` 8 → 0; `hour` 9 → 1; the second run → 1 row total.
  - `claimPush only claims due push jobs`: one future `available_at` and one `payment.create` row are not returned.
  - `GET /api/jobs/push rejects without the cron secret` (401), using the route test style of `tests/food-upload-routes.test.ts`.
- [ ] **Step 2: Run it.** `npx vitest run tests/push-timing.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the migration, `push-dispatch.ts` (move, don't duplicate), the route, the immediate dispatch call sites and the workflow.
- [ ] **Step 4: Run it.** Then the whole suite `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(backend): timely arrival and renewal pushes`

### Task 5: Claim preview read and api-client additions

**Files:**
- Create: `supabase/migrations/20261008094000_claim_preview.sql`
- Modify: `apps/web/src/app/api/v1/[...path]/route.ts` (public read `claim-preview/<token>`, rate-limited like `catalog`)
- Modify: `packages/api-client/src/index.ts`
- Modify: `packages/domain/src/index.ts`
- Test: `tests/claim-preview.test.ts`

**Interfaces:**
- Produces:
  - **Read `claim-preview`** with params `{token}`, available to anon. It returns `ClaimPreview = { catererName: string; packageName: string; remainingDays: number; nextDate: string | null; nextWindow: string | null; addressLabel: string; maskedPhone: string }`.
    - **Masking:** `maskedPhone` keeps the first 4 and last 4 digits of the local form (`0812-•••-0001`).
    - **Address label:** the address `label` or the first 24 chars of `line`.
    - **Errors:** unknown, used or expired token → `NOT_FOUND`. Same error and same timing path for all three.
  - **api-client:** `claimPreview(token: string): Promise<ClaimPreview>`.
- [ ] **Step 1: Write the failing tests:**
  - `returns exactly the seven preview fields`: `Object.keys(result).sort()` equals the 7 names above, and no `phone`, `address.line` or `id` is present.
  - `masks the phone`.
  - `unknown and used tokens are both NOT_FOUND`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3:** Implement, using the token lookup that `customer.claim` uses in `apps/web/src/app/api/v1/[...path]/route.ts:504-531` and `pilot.claim`.
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(backend): minimal claim preview`

### Task 6: Customer-day domain functions

**Files:**
- Create: `packages/domain/src/customer-day.ts` (export from `index.ts`)
- Test: `tests/customer-day.test.ts`

**Interfaces:**
- Consumes: `CustomerState`, `Delivery`, `DeliveryMeal` (Task 1), `jakartaDay` from `kitchen.ts`.
- Produces:
  - `type PlateState = "cooking" | "on_the_way" | "due" | "arrived" | "reported" | "none"`
  - **Plate:** `type Plate = { state: PlateState; deliveryId: string; meal: "lunch"|"dinner"; packageName: string; catererName: string; window: string; dishes: string[]; image: string; addressLabel: string; departedAt: string | null; confirmedAt: string | null; reaction: DeliveryMeal["reaction"]; issue: DeliveryMeal["issue"] }`
  - **`todayPlates(state: CustomerState, now: Date): Plate[]`.** One per meal delivered today in Jakarta, sorted by window start.
    - **State rule:** reported (open issue) > arrived (`delivered`) > on_the_way (`out_for_delivery`) > due (window started) > cooking.
    - **Dishes:** `offer.menus[meal].items` names in composition order, else the menu name.
  - **`upcomingRows(state: CustomerState, now: Date, n: number): { deliveryId: string; date: string; label: string; dishes: string; changeUntil: string | null }[]`.**
    - **Range:** days after Jakarta today, ascending, `n` rows.
    - **Label:** `"Besok, Kamis 8 Okt"` for tomorrow, else `"Jumat 9 Okt"`.
    - **Change window:** `changeUntil` is the `HH.MM` of `cutoff_at` when `canChange`, else null.
  - **`canChangeDay(d: Delivery, now: Date): { date: boolean; address: boolean; until: string | null }`.**
    - `date` is true only when flexible (`d.canChange`) and `now < cutoff_at`.
    - `address` is true when `now < cutoff_at` and status `scheduled`.
  - **`renewalDefaults(sub: Subscription, offer: Offer): { startDate: string; cycles: number; portions: number; packageId: string; renewedFrom: string }`.** `startDate` is the first operating weekday of `offer.weekdays` after `sub.ends_on`. `cycles` is 1; `portions` is `sub.portions`.
  - **`renewalDue(sub: Subscription): boolean`** returns `sub.status === "active" && sub.remaining <= 3`.
  - **`dayLabel(date: string, today: string, locale: Locale): string`** (Indonesian weekday and month short names; "Besok, " prefix for tomorrow).
- [ ] **Step 1: Write the failing tests:**
  - `plate is cooking before the window and due after it without departure` (now 10.00 and 11.05 WIB).
  - `plate is on the way after departure, arrived after confirm, reported with an open issue` (issue beats arrived).
  - `uses Jakarta today for a phone at 23.30 UTC`: `now = 2026-10-07T17:30:00Z` → plates for `2026-10-08`.
  - `lunch and dinner give two plates in window order`.
  - `upcomingRows labels tomorrow and shows the change deadline`: `"Besok, Kamis 8 Okt"` with `changeUntil` `"17.00"`.
  - `canChangeDay flips at the cutoff minute` (cutoff 17.00: 16.59 → true, 17.00 → false).
  - `renewalDefaults starts the next operating day with no gap`: ends Fri 2026-10-16 with weekdays Mon–Fri → `2026-10-19`.
- [ ] **Step 2: Run it.** `npx vitest run tests/customer-day.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(domain): customer day plates, rows and renewal defaults`

### Task 7: App shell on mobile-core/mobile-ui, sign-in, Beranda

**Files:**
- Modify: `apps/customer/package.json` (add `@catera/mobile-core`, `@catera/mobile-ui`), `jest.config.cjs` (map them like `apps/caterer/jest.config.cjs`), `tsconfig.json` (include their sources)
- Create: `apps/customer/src/runtime.ts`, `src/links.ts`
- Create: `src/today/{Beranda.tsx,Plate.tsx,UpcomingRows.tsx,RenewalCard.tsx,EmptyHome.tsx,offline.ts}`
- Create: `src/account/Masuk.tsx`
- Replace: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/login.tsx`
- Delete routes: `app/(tabs)/messages.tsx`, `app/compare.tsx`, `app/mascot-preview.tsx`
- Test: `apps/customer/tests/today.test.tsx`, `apps/customer/tests/fixtures.ts`

**Interfaces:**
- Consumes: Task 6 functions; `createMobileRuntime`, `MobileProvider`, `useMobile`, `useData` (mobile-core); `Text`, `Button`, `Card`, `Screen`, `colors`, `FONT` (mobile-ui).
- Produces:
  - **`runtime`** from `createMobileRuntime({apiUrl: EXPO_PUBLIC_CATERA_API_URL, supabaseUrl, supabaseKey, storagePrefix: "catera"})`. The prefix `catera` keeps the existing `catera.demo.token` / `catera.locale` keys.
  - **`customerLink(href: string): string`.** Maps `/today` and `/home` → `/`; `/deliveries/<id>` → `/hari/<id>`; `/subscriptions/<id>` → `/jadwal`; `/claim/<t>` → `/claim/<t>`; `/renew/<id>` → `/renew/<id>`; anything else → `/`.
  - **Tabs:** `index` (Beranda), `jadwal`, `jelajah`, `akun`, with labels Beranda/Jadwal/Jelajah/Akun and Ionicons `home`/`calendar`/`search`/`person`. Beranda is visible signed-out as `EmptyHome`.
  - **Beranda:**
    - **Plates:** `todayPlates`. Each `Plate` shows a photo, a 28px state sentence and the dishes line.
    - **Actions:** `on_the_way`/`due` → Sunrise **Sudah sampai** (`delivery.confirm`) plus **Belum** (`router.push("/masalah/<deliveryId>?meal=…&jenis=belum")`); `arrived` → three reaction buttons (`delivery.react`).
    - **Below the plates:** `UpcomingRows` (3), then a `RenewalCard` for each `renewalDue` subscription (`router.push("/renew/<id>")`), then the package line with *Chat katering* (`whatsappUrl("", caterer phone)` when the offer carries one).
    - **Review prompt (spec §5.7):** when a subscription has 3 or fewer days left or its last delivery has arrived, and `review.save` has not been done for it, show one row "Bagaimana {katering} selama ini?" that opens the existing review form (1–5 stars + text) and sends `review.save` with the payload the old `apps/customer/src/daily.tsx` sends. Dismissing it hides it for that subscription (SecureStore `catera.review.<id>`).
  - **Offline:** `saveCachedCustomer` / `loadCachedCustomer` (copy the pattern of `apps/caterer/src/today/offline.ts`) with "Terakhir diperbarui HH.MM".
  - **Masuk:** phone OTP first via `runtime.sendPhoneOtp` / `verifyPhoneOtp`; "Masuk dengan email" reveals email + password (`signInPassword`). Demo buttons only when `__DEV__`. Returns to `next` via `nativeReturnPath`, which is extended in Task 10.
  - **Copy, verbatim:**
    - `"Sedang dimasak"` with `"diantar {window} ke {address}"`
    - `"Sedang diantar"` with `"tiba sekitar {window}"`
    - `"Seharusnya sudah tiba"` with `"{window}"`
    - `"Sudah sampai"` with `"pukul {HH.MM}"`
    - `"Laporan terkirim"`
    - `"Mau makan apa minggu ini?"`
- [ ] **Step 1: Write the failing tests** in `apps/customer/tests/today.test.tsx` (mock expo-router and expo-notifications as `apps/caterer/tests/customers.test.tsx` does; fixture `fixtures.ts` builds a synthetic `CustomerState`):
  - `shows the on-the-way plate and confirms arrival`: renders "Sedang diantar", presses "Sudah sampai" → `command` called with `["delivery.confirm", {deliveryId, meal: "lunch"}, any(String)]`.
  - `Belum opens the report screen preselected` → `router.push` with `/masalah/<id>?meal=lunch&jenis=belum`.
  - `offers a private reaction after arrival` → pressing "Enak" sends `delivery.react` with `reaction: "enak"`.
  - `shows the renewal card at three days left` → "Sisa 3 hari" and "Perpanjang".
  - `asks for a review once near the end` (remaining 2 → row shown; after dismiss → hidden).
  - `signed out shows Mau makan apa minggu ini?`.
  - `offline shows the cached day and when it was updated`: the loader rejects, a cached state exists → plate rendered plus "Terakhir diperbarui".
- [ ] **Step 2: Run it.** `npm test -w @catera/customer -- today`. Expected: FAIL.
- [ ] **Step 3: Implement.** Old screens stay reachable only through routes not yet replaced; old tests for deleted routes are deleted with them in this task: `tests/screens.test.tsx` cases for messages/compare, `tests/mascot.test.tsx`.
- [ ] **Step 4: Run it.** `npm test -w @catera/customer` and `npx tsc --noEmit -p apps/customer`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(customer): Beranda with today's plate on the shared mobile kit`

### Task 8: Jadwal and the Ubah hari sheet

**Files:**
- Create: `apps/customer/src/schedule/{Jadwal.tsx,MonthGrid.tsx,ChangeDaySheet.tsx}`
- Replace: `app/(tabs)/jadwal.tsx` (replaces `calendar.tsx`), `app/hari/[id].tsx` (replaces `delivery/[id].tsx`)
- Test: `apps/customer/tests/schedule.test.tsx`

**Interfaces:**
- Consumes: `api.customer("?from=&to=")`, `api.deliveryAvailability(id, from, to)`, `canChangeDay` (Task 6), commands `delivery.reschedule` / `delivery.address` with the payloads the old `apps/customer/src/delivery.tsx:355-359` sends.
- Produces:
  - **Jadwal:** month grid (Mon-first, Jakarta). Dots: forest = planned, `#8AA399` = arrived. (The canvas "Dipindah" marker is deferred: deliveries carry no moved-from field. Record this as a ruling.) Tapping a day lists its meals; tapping a meal opens `/hari/<id>`.
  - **`ChangeDaySheet`:**
    - **Header:** "Bisa diubah sampai {HH.MM}" or, after cutoff, "Hari ini sudah tidak bisa diubah" + Chat katering.
    - **Segmented:** "Pindah tanggal" (hidden when `!date`) / "Ganti alamat".
    - **Pindah tanggal:** bookable dates from `deliveryAvailability`, with unavailable ones disabled and their reason ("Sudah ada pengantaran", "Katering penuh").
    - **Confirm:** "Pindah ke {label}" / "Antar ke {address}".
- [ ] **Step 1: Write the failing tests:**
  - `hides Pindah tanggal for a fixed package`.
  - `moves a day with the chosen date` → `delivery.reschedule` payload includes `date: "2026-10-19"`.
  - `after cutoff offers only chat`.
  - `month grid marks today and selected day` (accessibility label "Rabu 7 Oktober" has selected state when pressed).
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `app/(tabs)/calendar.tsx` and `app/delivery/[id].tsx`.
- [ ] **Step 4: Run it.** Expected: PASS. Run typecheck.
- [ ] **Step 5: Commit.** `feat(customer): Jadwal and one-day changes`

### Task 9: Ada masalah and Bantuan dan laporan

**Files:**
- Create: `apps/customer/src/help/{ReportProblem.tsx,ReportList.tsx}`
- Create: `app/masalah/[id].tsx`, `app/bantuan.tsx`
- Delete: `app/support.tsx`
- Test: `apps/customer/tests/help.test.tsx`

**Interfaces:**
- Consumes: `deliveryIssue.create` / `deliveryIssue.escalate` with the payloads used by `apps/customer/src/delivery-issues.tsx`; read `delivery-issues`; `customer().cases`.
- Produces:
  - **`ReportProblem`.** Three choices with ids `belum`/`kurang`/`layak`:
    - **Subjects:** "Belum sampai" / "Ada yang kurang atau salah" / "Makanan tidak layak".
    - **Optional note** (and photo when the existing command accepts an image URL; otherwise note only, and ledger the ruling).
    - **Kirim laporan.**
    - **Outcome screen**, with the exact 3 numbered lines from the canvas: "Sekarang: {katering} mendapat laporan Anda." / "Sampai besok 12.00: {katering} membalas atau mengganti di sini." / "Belum beres? Catera meninjau dan bisa mengembalikan dana hari ini."
  - **Bantuan dan laporan:** open and recent reports and support cases with status words Terkirim / Dibalas / Ditinjau Catera / Selesai, plus payment help for a checkout stuck in `awaiting_payment` (link to its Bayar screen).
- [ ] **Step 1: Write the failing tests:**
  - `preselects Belum sampai from the link and sends the report`.
  - `shows the outcome rule after sending`.
  - `lists a responded report as Dibalas`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(customer): one report flow and help list`

### Task 10: Claim and renew links on web and in the app

**Files:**
- Modify: `apps/web/src/components/customer-pilot.tsx` (`ClaimCustomer` → preview-first: `claimPreview` → phone OTP → "Tersambung" with next 3 days and "Pasang aplikasi")
- Create: `apps/web/public/.well-known/assetlinks.json`, `apps/web/public/.well-known/apple-app-site-association`
- Modify: `apps/web/next.config.*` (serve the AASA file with `Content-Type: application/json`)
- Modify: `apps/customer/app.config.ts` (Android `intentFilters` with `autoVerify` for `https://<host>/claim/*` and `/renew/*`; iOS `associatedDomains: ["applinks:<host>"]`; host from `EXPO_PUBLIC_CATERA_WEB_HOST`)
- Create: `apps/customer/src/claim/{ClaimScreen.tsx}`, `app/claim/[token].tsx`
- Modify: `apps/customer/src/auth.ts` (`nativeReturnPath` accepts `/claim/<token>`, `/renew/<id>`, `/hari/<id>`, `/masalah/<id>`, `/bayar/<id>`, `/paket/<id>`, `/beli/<id>`, `/jadwal`, `/jelajah`, `/akun`, `/bantuan`)
- Test: `tests/claim-web.test.tsx`
- Test: `apps/customer/tests/claim.test.tsx`
- Test: extend `apps/customer/tests/auth.test.tsx`

**Interfaces:**
- Consumes: `claimPreview` (Task 5), `customer.claim` (existing; same payload as the web `ClaimCustomer`), `runtime.sendPhoneOtp` / `verifyPhoneOtp`.
- Produces:
  - **Claim screen (web and app):** "Dari {katering}", "Langganan Anda sekarang ada di Catera", "Sudah dibayar ke {katering}, tidak ada tagihan baru…", the preview facts and the button "Lanjut dengan {maskedPhone}". On any error: "Tautan ini tidak bisa dipakai. Minta tautan baru ke katering Anda."
  - **Web only:** after success, an "Pasang aplikasi" card linking to the store (env `NEXT_PUBLIC_CATERA_ANDROID_URL`; hidden when unset).
  - **Link files:** `assetlinks.json` with package `id.catera.customer` and fingerprints from env at build time. If `CATERA_ANDROID_SHA256` is unset, the file holds an empty array; record that ruling. AASA with `appIDs: ["$(TEAM).id.catera.customer"]` from env `CATERA_APPLE_TEAM_ID`, paths `/claim/*` and `/renew/*`.
- [ ] **Step 1: Write the failing tests:**
  - **Web:** `claim shows the package before asking for the phone` (no phone input until "Lanjut…" is pressed).
  - **Web:** `claim error never shows other data` (preview `NOT_FOUND` → only the error copy).
  - **App:** `opens the claim route from a link and connects` (preview → OTP mocked → `customer.claim` called → `router.replace("/")`).
  - **Auth:** `nativeReturnPath accepts the new routes and rejects others` (`/claim/abc` kept, `/admin` → `/`).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Then `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(customer): preview-first claim and app links`

### Task 11: Jelajah and Paket

**Files:**
- Create: `apps/customer/src/discover/{Jelajah.tsx,PackageCard.tsx,PackageDetail.tsx,saved.ts}`
- Replace: `app/(tabs)/jelajah.tsx` (replaces `discover.tsx`), `app/paket/[id].tsx` (replaces `package/[id].tsx`), `app/disimpan.tsx` (replaces `saved.tsx`)
- Test: `apps/customer/tests/discover.test.tsx`

**Interfaces:**
- Consumes: `api.catalog(query)` with the query keys the old `discovery.tsx` used for area, meal, max price and trial; `savedPackage.set`; `api.offer(id)`; `reviews/<id>`.
- Produces:
  - **Jelajah:**
    - **Header:** area picker (`areaOptions`, saved in SecureStore `catera.area`) and search.
    - **Chips:** Siang, Malam, Di bawah Rp30.000, Bisa coba 1 hari. Multi-select; Siang+Malam both on means no meal filter.
    - **Cards:** one per package (photo 196px, name, price per porsi, "{katering}, {jarak} km. {hari} {siang/malam}", "Bisa coba 1 hari dulu" when trial). A heart sends `savedPackage.set`; signed out, it goes to `/login?next=`.
  - **Paket:**
    - photo, name, caterer and rating line, description, "Menu minggu ini" (dated menu for the next 3 operating days)
    - facts: Diantar / Ubah hari / Ongkir "Pengantaran termasuk"
    - footer: price, "Coba 1 hari" (when trial) and "Pilih jadwal", both → `/beli/<id>`, the first with `?trial=1`
- [ ] **Step 1: Write the failing tests:**
  - `chips filter by budget` → catalog query includes the max price 30000.
  - `heart while signed out asks to sign in and comes back` (push `/login?next=/jelajah`).
  - `package detail shows trial only when offered`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `src/discovery.tsx`, `src/saved.tsx` and their tests (`tests/saved-discovery.test.tsx`, `package-navigation`, `package-presentation` cases now covered).
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(customer): simple Jelajah and package detail`

### Task 12: One-screen Beli/Perpanjang and Bayar

**Files:**
- Create: `apps/customer/src/buy/{BuyScreen.tsx,PaymentScreen.tsx,QrisCode.tsx}`
- Replace: `app/beli/[id].tsx` (replaces `checkout/[id].tsx`), `app/bayar/[id].tsx` (replaces `payment/[id].tsx`)
- Create: `app/renew/[id].tsx` (renders `BuyScreen` in renew mode for the subscription id; signed out → `/login?next=/renew/<id>`)
- Test: `apps/customer/tests/buy.test.tsx`

**Interfaces:**
- Consumes: `api.quote(payload)`, `api.renewalContext(subscriptionId, packageId?, cycles)`, `payment-methods`, `checkout.create`, `checkout.payment.start {id, method}`, `checkout.payment.refresh {id}`, `api.checkout(id)`, `renewalDefaults` (Task 6). `PaymentView` / `PaymentInstruction` come from `@catera/domain` `payment.ts`.
- Produces:
  - **`BuyScreen({packageId, renewFrom?, trial?})`.**
    - **Defaults:**
      - renew mode: `renewalDefaults`, title "Perpanjang {paket}", start line "Mulai {label}, tepat setelah paket sekarang"
      - new: earliest bookable date from `deliveryAvailability`
      - trial: 1 day
    - **Length:** options from `offer.durationPricing.options` ("{days×cycles} hari", "Hemat {n}%").
    - **Portions:** `Stepper`.
    - **Address:** default address, with a change button opening the address list.
    - **Breakdown:** from `quote`; each line verbatim from quote fields, including the service fee and "Pengantaran: Termasuk".
    - **Payment method:** "Bayar dengan" QRIS selected first when available; "Pakai transfer bank (VA)" as text button.
    - **Terms line:** "Dengan membayar, Anda setuju dengan Ketentuan Catera." (link to `/terms` on the web origin).
    - **Bayar** runs `checkout.create {...payload, expectedQuote: quote, acceptedTerms: true}`, then `checkout.payment.start {id, method}`, then `router.replace("/bayar/<id>")`.
    - **Signed out:** goes to `/login?next=/beli/<id>?…` first.
  - **`PaymentScreen({checkoutId})`:**
    - **Shows:** total, the countdown to `expiresAt` ("Bayar dalam mm:ss"), a QRIS code (`react-native-qrcode-svg` from `instructions.qrContent`) or VA number with a copy button (`expo-clipboard`), and the 3 steps, plus "{n} hari antar Anda dijaga selama 15 menit."
    - **Refresh:** polls `checkout.payment.refresh` every 10 s while focused.
    - **Paid** → "Pembayaran diterima" → Beranda. **Expired** → "Waktu habis. Jadwal dicek ulang saat membayar lagi." with "Bayar lagi".
    - Demo mode only: "Bayar (demo)" → `checkout.demo_pay`.
- [ ] **Step 1: Write the failing tests:**
  - `renew mode prefills the next operating day and one cycle` (start label "Senin 19 Okt").
  - `changing length requotes with cycles 2` (quote called with `cycles: 2`).
  - `Bayar creates the checkout with accepted terms and starts QRIS` (command calls in order `checkout.create` then `checkout.payment.start` with `method: "QRIS"`).
  - `payment screen survives reopening`: mount with an `awaiting_payment` checkout → QR shown; refresh returns `paid` → "Pembayaran diterima".
  - `expired payment offers Bayar lagi`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete `src/checkout.tsx`, `src/payment.tsx`, `src/renewal.tsx` and their tests (`checkout`, `direct-payment`, `payment-state`).
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(customer): one-screen buy and renew with QRIS`

### Task 13: Akun, cleanup and release pipeline

**Files:**
- Create: `apps/customer/src/account/{Akun.tsx,Addresses.tsx,Payments.tsx}`
- Replace: `app/(tabs)/akun.tsx` (replaces `account.tsx`), `app/alamat.tsx` (replaces `addresses.tsx`)
- Delete: every remaining file of the old `apps/customer/src/` that nothing imports (`agenda.tsx`, `daily.tsx`, `ui.tsx`, `context.tsx`, `identity.tsx`, `purchase.tsx`, `customer-menu.tsx` unless Step 3 keeps it) and their tests
- Keep: the customer-choice menu screen, rewritten on mobile-ui as `src/schedule/ChooseMenu.tsx` at `app/pilih-menu/[id].tsx` when `selection_due` exists
- Modify: `apps/customer/README.md`, `.github/workflows/native-apk.yml` (paths unchanged; confirm it still builds)
- Test: `apps/customer/tests/account.test.tsx`

**Interfaces:**
- Produces:
  - **Akun:**
    - name and phone
    - active packages (→ Jadwal)
    - Alamat (`address.save`)
    - Disimpan
    - Riwayat pembayaran (checkouts from `customer()`)
    - Bantuan dan laporan (Task 9)
    - Notifikasi (`enablePush` from mobile-core; shows Aktif/Nonaktif)
    - Bahasa (`setLocale`)
    - Keluar (`logout`)
  - **Removed:** no caterer/admin links.
- [ ] **Step 1: Write the failing tests:**
  - `Akun lists packages and signs out`.
  - `language switch changes copy to English`.
  - `pilih menu appears only when a selection is due` (Beranda row "Pilih menu Senin" for a `selection_due` customer action).
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.** Delete the old code. `rg "from \"\.\./src/(agenda|daily|ui|context|identity|purchase)\"" apps/customer` returns nothing.
- [ ] **Step 4: Full verification:** `npm run typecheck`, `npm test`, `npm run build`, `npm test -w @catera/customer`, `npm test -w @catera/caterer` (shared packages untouched), `npm run test:postgres`. Expected: all PASS.
- [ ] **Step 5: Commit.** `feat(customer): Akun and retire the old customer screens`

## Verification

- **Commands:** as in Task 13 Step 4.
- **Manual (demo, synthetic):** run `npm run dev` with `CATERA_V1_DEMO=true`, and `npx expo start` in `apps/customer`.
  1. Caterer demo calls `delivery.depart`.
  2. The customer app shows "Sedang diantar".
  3. Press Sudah sampai, then Enak.
  4. Next day Jadwal shows arrived.
  5. Report Belum sampai on another day; run `/api/jobs` and see it is held.
  6. Open `/claim/<demo token>` in a phone browser, then in the app.
  7. Renew from the "Sisa 3 hari" card and pay in demo.
- **Push timing:** dispatch `push-jobs.yml` manually against staging after `CRON_SECRET` and `CATERA_PUBLIC_URL` are set.
- **Release:** an EAS preview APK through `native-apk.yml`. Production only through the `docs/RUNBOOK.md` gates.
