# Catera v2: "Catera Dapur" caterer app (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. After approval, this file is copied to `docs/superpowers/plans/2026-10-07-v2-caterer-app.md` on branch `v2`.

**Goal:** Build a phone-first React Native caterer app, "Catera Dapur", from the approved design canvas. Include the backend rules it depends on, all on a new `v2` branch.

**Architecture:**
- A second Expo app (`apps/caterer`) sits next to the existing `apps/customer`. Both share `@catera/domain`, `@catera/api-client` and `@catera/design-tokens`.
- Two new shared packages hold what both apps need: `@catera/mobile-core` (session, API, push, i18n) and `@catera/mobile-ui` (RN components from DESIGN.md tokens).
- Kitchen logic (cooking recap, route, WhatsApp share text) is pure functions in `@catera/domain`, so the web caterer workspace reuses it in Plan 2.
- The backend stays the Next.js `/api/v1` plus Supabase SQL. It already accepts bearer-token native clients.

**Tech stack:** Expo SDK 57.0.21, React Native 0.86.3, React 19.2.3, expo-router 57, Supabase JS (SecureStore), Jest 30 + `jest-expo` + `@testing-library/react-native`, Vitest (root), PostgreSQL SQL migrations, `@anthropic-ai/sdk`.

**Spec:** `docs/superpowers/specs/2026-10-07-caterer-simplification-design.md` (commit `5756654`). **Screens:** the design canvas at https://claude.ai/artifact/S1x5TLaxiw8hWoqpdak4zA (18 artboards).

## Context
- Caterers found the web workspace overwhelming.
- The redesign (spec plus canvas) reorganises it around the caterer's day:
  - four tabs: Hari ini, Pelanggan, Menu, Usaha
  - exceptions-only delivery
  - WhatsApp sharing
  - an import assistant
  - renewal as the payment conversion point
- Keefe has now moved product focus to **mobile apps, AYO-style**: separate customer and partner apps plus a full website, all on a new `v2` branch.

**This plan delivers the caterer app first.** Later plans:
- **Plan 2:** the web caterer workspace gets the same four tabs at desktop width (canvas artboard 18), reusing the domain functions from this plan.
- **Plan 3:** the customer app and web customer overhaul, which adopts `mobile-core`/`mobile-ui`.
- **Plan 4:** retire the old 11 web seller screens.

## Decisions (Keefe, Oct 7)
- Two apps sharing code: "Catera" (customer, `id.catera.customer`, existing) and **"Catera Dapur"** (caterer, `id.catera.dapur`, scheme `catera-dapur`).
- The full web is kept (AYO model). The web caterer area gets the same design in Plan 2.
- The caterer app comes first. The customer app keeps working unchanged in this plan.
- Everything else follows the approved spec: exact slot counts, auto-delivered, own customers free, renewal converts, owner + helper, WhatsApp via share links only (no WhatsApp API).

## Global constraints
- Indonesian-first copy through `t(id, en)`. No internal terms in the UI (slot, revisi, siklus, manifest, settlement, cutoff).
- **Visual style:** DESIGN.md tokens only (forest `#163D2E`, cream `#FFF7E9`, sunrise-ink `#9B4309`, canvas `#FDFAF3`, surface `#FFFEFA`, sage `#F0F3E9`, line `#E2E3D8`, muted `#60675F`, danger `#A33024`). Plus Jakarta Sans registered as one family name used everywhere. Touch targets ≥ 44pt.
- **Data hygiene:** demo mode is explicit and synthetic. Never commit secrets or real customer fixtures. `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY` and the Doku keys stay server-side.
- Tenant authorization and entitlement changes happen in SQL transactions. Owner-only actions stay enforced by `v1.is_staff(...)`.
- Run `npm run typecheck`, `npm test`, `npm run build`, the caterer app tests and the PostgreSQL concurrency checks after material changes (AGENTS.md).
- Production release only through `docs/RUNBOOK.md` gates. Preserve the hosted pilot. `v1` stays deployable.

## Review focus (failure modes the spec implies; each has a test in its owning task)
1. **Poor kitchen connectivity:** Hari ini opens offline with the last loaded day and shows "Terakhir diperbarui 06.12" instead of a blank screen or an error. Test in Task 6.
2. **Day boundary in Asia/Jakarta:** a phone in another timezone, or at 23:30, still shows the Jakarta "Hari ini/Besok". Auto-deliver uses the Jakarta date. Tests in Tasks 1 and 2.
3. **Long routes and share-text limits:** 60 stops must not produce a broken `wa.me` URL. The text splits into numbered parts (≤ 1,800 characters each) and the share sheet is used when available. Test in Task 1.
4. **A day with zero deliveries, or a brand-new caterer:** a friendly empty state or the Mulai card appears, never zero-height cards. Test in Task 6.
5. **Helper (staff) role:** no Usaha/Pelanggan tabs, and owner-only commands are never offered. The server refusal (`FORBIDDEN`) shows as a plain message. Test in Task 10.

---

### Task 0: Create branch `v2` and point tooling at it
**Files:** modify `AGENTS.md` (branch line), `.github/workflows/ci.yml` and `native-apk.yml` (add `v2` to triggers); add `docs/superpowers/plans/2026-10-07-v2-caterer-app.md` (this plan).
- [ ] `git switch -c v2` from `v1` HEAD (`5756654`, which includes the spec).
- [ ] AGENTS.md: "Work directly on the `v2` branch for this app; `v1` is maintenance-only." Add `apps/caterer` to the active implementations.
- [ ] CI: run on pushes to `v1` and `v2`.
- [ ] Commit, then `git push -u origin v2`.

### Task 1: Kitchen domain functions (`@catera/domain`)
**Files:** create `packages/domain/src/kitchen.ts` and export it from `packages/domain/src/index.ts`; test `tests/kitchen.test.ts`.

**Interfaces (produced, used by Tasks 6 and 7, and by Plan 2 on the web):**
- `jakartaDay(now: Date, offsetDays?: number): string` returns `YYYY-MM-DD` in Asia/Jakarta.
- `cookingRecap(state: SellerOperationsState, meal: "lunch"|"dinner"): { total: number; byPackage: {packageId,name,portions}[]; byDish: {name,category,count}[]; changes: { added: number; moved: number } }`
  - Dish counts are portions × slots per category, taken from the dated menu for that day.
  - Without a menu, it falls back to category names (e.g. "Lauk ×2").
- `deliveryRoute(state, meal): Stop[]`, where `Stop = { n, deliveryId, version, name, addressLine, area, note, portions, packageName, mapsUrl }`. Ordering is stable (saved order, else area then name). Cancelled deliveries are excluded.
- `routeShareText(stops: Stop[], meta: { date: string; meal; caterer }, locale): string[]` returns parts of at most 1,800 characters with a header like `*Antar siang · Selasa 7 Okt* (12 alamat, 34 porsi)`.
- `menuShareText(week, locale): string` and `whatsappUrl(text: string, phone?: string): string` (`https://wa.me/<digits>?text=` with URL-encoding; Indonesian `0…` numbers are normalised to `62…`).

Steps:
- [ ] **Failing tests:**
  - `cookingRecap` totals 34 for the canvas fixture (28 Rumahan + 6 Hemat), and Ayam bakar madu counts 28.
  - `routeShareText` splits a 60-stop route into ≥ 2 parts, each ≤ 1,800 characters, with numbering kept continuous.
  - `jakartaDay(new Date("2026-10-07T17:30:00Z"))` returns `"2026-10-08"`.
  - `whatsappUrl("a b", "0812-3456")` returns `"https://wa.me/628123456?text=a%20b"`.
- [ ] Run `npx vitest run tests/kitchen.test.ts` and confirm it fails.
- [ ] Implement the functions in `packages/domain/src/kitchen.ts`.
- [ ] Run the tests again and confirm they pass. Commit `feat(domain): kitchen recap, route and share text`.

### Task 2: Backend: deliveries count as done unless reported
**Files:**
- create `supabase/migrations/<timestamp>_auto_delivered.sql`
- update the matching source in `packages/backend/src/` (follow the newest migration's convention)
- modify `apps/web/src/app/api/jobs/route.ts`
- tests in `tests/auto-delivered.test.ts` plus the concurrency check, using the existing PostgreSQL test helper

**Interface:** a new SQL function `v1.auto_deliver(p_today date) returns integer` (the number of days marked). It is called by the jobs route **before** `settlement.run`.

Behaviour:
- `delivery_days` and `fulfillments` rows with `service_date < p_today` in status `scheduled/preparing/out_for_delivery` become `delivered`.
- The day status and subscription completion are derived with the same logic as `delivery.status` (extract a shared helper rather than duplicating it).
- `recognize_delivery_earning` therefore fires exactly once.
- The function is idempotent, and `issue`/`cancelled` rows are untouched.
- [ ] **Failing tests:**
  - Yesterday's scheduled day becomes delivered with exactly one `earned` settlement entry.
  - A second run marks 0 rows.
  - An `issue` day stays `issue`.
  - A day dated today stays `scheduled`.
  - **Concurrency:** parallel `auto_deliver` and `delivery.status(issue)` on the same day end in one consistent final state, with no duplicate earning.
  - **Concurrency:** parallel `auto_deliver` and refund/cancel produce no earning for a cancelled day.
- [ ] Implement using row locks (`FOR UPDATE SKIP LOCKED` or ordered locking, matching the existing convention). The jobs route passes the Jakarta date.
- [ ] Run the tests and the concurrency check. Commit.

### Task 3: Backend: relaxed import gates
**Files:** a new migration plus the `packages/backend/src` source for `v1.pilot_import_row`; test `tests/import-gates.test.ts`.
- [ ] **Failing tests:**
  - An unapproved seller can import onto its own published package.
  - An address outside the coverage areas imports successfully.
  - Duplicate, overlap, capacity and cutoff checks still reject.
  - Another caterer's package is still `NOT_AVAILABLE`.
  - Money stays 0.
- [ ] Implement the minimal change (drop the approved-seller and coverage conditions for import rows only). Keep everything else.
- [ ] Commit.

### Task 4: `@catera/mobile-core` (shared session, API, push, i18n)
**Files:** create `packages/mobile-core/{package.json,src/index.ts,src/session.ts,src/api.ts,src/push.ts,src/data.ts,src/i18n.ts}`; tests in `packages/mobile-core/tests/`.

**Source:** extract the generic parts of `apps/customer/src/context.tsx` (Supabase client with the SecureStore adapter at :34-50, `createApi` wiring at :51-62, `useData` at :394-450, push at :207-234 and :320-345, realtime refresh at :236-255, `t()` at :355). **The customer app keeps its own copy in this plan**; it adopts the package in Plan 3.

**Interfaces:**
- `createMobileRuntime({ apiUrl, supabaseUrl, supabaseKey, storagePrefix }): Runtime`
  - `Runtime = { supabase, api, signInPassword, sendPhoneOtp, verifyPhoneOtp, signOut, enablePush(router), useData(key, loader), revision, locale, setLocale, t }`
- `MobileProvider` and `useMobile()`.
- [ ] **Failing tests:**
  - `useData` reloads when `revision` increments.
  - The token getter prefers the demo token.
  - The push handler routes `data.href` through the provided mapper.
  - `t()` returns the Indonesian string by default.
- [ ] Implement by moving the code. Run `npm test -w @catera/mobile-core`. Commit.

### Task 5: `@catera/mobile-ui` and the `apps/caterer` scaffold with auth
**Files:**
- `packages/mobile-ui/src/{tokens.ts,Text.tsx,Button.tsx,Chip.tsx,Card.tsx,Field.tsx,Stepper.tsx,Segmented.tsx,Sheet.tsx,TabIcon.tsx}`, built on `@catera/design-tokens`, with Ionicons as the icon set.
- `apps/caterer/{package.json,app.config.ts,eas.json,jest.config.cjs,app/_layout.tsx,app/(auth)/masuk.tsx,app/(auth)/daftar.tsx,app/(tabs)/_layout.tsx}`.
- Dependency versions copied exactly from `apps/customer/package.json`.

**`app.config.ts`:**
- name "Catera Dapur", slug `catera-dapur`, scheme `catera-dapur`
- `id.catera.dapur` for both iOS and Android
- icon from `packages/brand/assets/app-icon.png`
- plugins as in the customer app, plus `expo-image-picker`, `expo-document-picker` and `expo-print`

**Screens:**
- **Daftar** (canvas artboard 1): name, WhatsApp, kitchen area. On submit: Supabase sign-up or phone OTP, then `profile.ensure`, then the `seller.create` command, then route to Hari ini.
- **Masuk:** email/password and phone OTP. The OTP goes through Supabase directly, because `/api/v1/auth/phone-*` is cookie-only.

**Role gate:**
- `actor.role` owner → 4 tabs.
- staff → 2 tabs (Hari ini, Menu).
- customer → a screen pointing to the Catera app.

- [ ] **Failing tests (RN Testing Library):**
  - Daftar submits `seller.create` with the three fields.
  - A staff actor sees exactly 2 tabs.
  - A customer actor sees the "Buka aplikasi Catera" screen.
- [ ] Implement. Add `typecheck` and `test` scripts. Add the workspace to the root `npm run typecheck`. Commit.

### Task 6: Hari ini tab (Masak, Antar, share, exceptions, Mulai)
**Files:** `apps/caterer/app/(tabs)/index.tsx`, `src/today/{Masak.tsx,Antar.tsx,ShareSheet.tsx,ExceptionSheet.tsx,MulaiCard.tsx,ActionCards.tsx,offline.ts}`; tests in `apps/caterer/tests/today.test.tsx`.

Data and behaviour:
- `api.request("seller/<catererId>?date=<jakartaDay>")` returns `SellerOperationsState`, mapped through `cookingRecap` and `deliveryRoute`.
- Action cards come from `seller-attention/<id>`, showing at most 3. The Mulai card shows when the caterer has no deliveries and no customers.
- **Share:** RN `Share.share` with the first part. `Linking.openURL(whatsappUrl(part))` is the fallback, with a *Bagikan bagian 2* button when there are more parts.
- **Cetak:** `expo-print` prints an HTML recap.
- **Exceptions:**
  - *Gagal diantar* → `delivery.status` with `issue` and the reason in the payload note.
  - *Pindah tanggal* → `customer.deliveryChange` with a date picker and a reason of at least 5 characters.
- **Offline:** cache the last successful read per date in AsyncStorage and show "Terakhir diperbarui HH.MM" when offline.
- [ ] **Failing tests:**
  - The canvas fixture renders "34 porsi".
  - The share button calls `Share.share` with text starting `*Antar siang`.
  - The Gagal sheet sends `delivery.status` with status `issue`.
  - Offline shows the cached day plus the "Terakhir diperbarui" label.
  - Zero deliveries plus no customers shows the Mulai card.
- [ ] Implement to the canvas (artboards 2 and 6–9). Commit.

### Task 7: Pelanggan tab (list, detail, renewal, Aktifkan gate)
**Files:** `apps/caterer/app/(tabs)/pelanggan.tsx`, `app/pelanggan/[id].tsx`, `src/customers/*`; tests in `tests/customers.test.tsx`.

- **Data:** `seller-customers/<id>`. Filters: Aktif / Segera berakhir (3 days or fewer) / Selesai.
- **Chat:** `whatsappUrl("", phone)`.
- **Renewal:**
  - A customer with an account → `customer.followup` (kind `prepared`) returns `/renew/<id>`, shared as `${publicUrl}/renew/<id>`.
  - A customer without an account → `customer.invite` returns `/claim/<token>`, shared with the same message.
- **Payment gate:** if payments are inactive (caterer status ≠ `approved`, or `payout-setup` not active), the button opens Aktifkan (artboard 12).
- [ ] **Failing tests:**
  - The "Segera berakhir" filter shows only customers with ≤ 3 days left.
  - Renewal for an account-less customer calls `customer.invite`, not `customer.followup`.
  - An inactive-payments caterer is routed to Aktifkan.
- [ ] Implement to artboards 10–12. Commit.

### Task 8: Menu tab (week view, day editor, autocomplete, share)
**Files:** `apps/caterer/app/(tabs)/menu.tsx`, `app/menu/[date].tsx`, `src/menu/*`; tests in `tests/menu.test.tsx`.

- **Data:** `menu-month` and `package-options`. Autocomplete filters `seller.dishes` by case-insensitive prefix or substring and shows the use count.
- **New dish:** `dish.save` (owner only). Staff can view but not edit.
- **Saving:** `menu.saveBatch`. *Simpan* stays disabled until every category has exactly the package's slot count (mirroring `v1.valid_slot_menu`).
- **Shortcuts:** *Salin minggu lalu* copies last week's dated menus into this week as a single `menu.saveBatch`. *Bagikan menu* uses `menuShareText`.
- [ ] **Failing tests:**
  - Typing "pep" suggests "Pepes ikan kembung" before "Pepes tahu" (ordered by use count).
  - *Simpan* is disabled with 1 of 2 lauk filled.
  - Copying last week sends one `menu.saveBatch` covering 5 dates.
- [ ] Implement to artboards 13–14. Commit.

### Task 9: Usaha tab (packages, money, shop, team, activation)
**Files:** `apps/caterer/app/(tabs)/usaha.tsx`, `app/paket/{baru,[id]}.tsx`, `app/uang.tsx`, `app/aktifkan.tsx`, `app/tim.tsx`, `src/business/*`; tests in `tests/business.test.tsx`.

- **Package editor:** one screen (artboard 3). It writes `package.save` with the defaults from spec §6.4: one duration, no tiers, trial off, cutoff 17:00, flexible. Capacity is required.
- **Photo:** `expo-image-picker`, then `POST /api/uploads/prepare`, PUT to the signed URL, then `/api/uploads/complete` (owner only, bearer auth).
- **Uang:** the `seller-settlement` read mapped to 7 labelled states with one-line explanations (artboard 16).
- **Tim:** `staff.invite`, with the invite code shared via WhatsApp.
- **Aktifkan:** `seller.submit` plus `payoutDestination.submit`. Steps are shown as in artboard 12; the Doku-specific step is a placeholder row until the research is done.
- [ ] **Failing tests:**
  - Saving a package without capacity shows "Isi kapasitas per hari".
  - The saved payload has `trialPrice` unset and one duration.
  - Uang renders all 7 labels from a fixture.
- [ ] Implement. Commit.

### Task 10: Import assistant (backend route and app screen)
**Backend files:**
- `packages/backend/src/import-assistant.ts` exports `extractImportRows(input: { text?: string; images?: {mediaType,data}[]; pdfs?: {data}[]; sheets?: string[] }, packages: {id,name,meal}[]): Promise<{ rows: ImportRow[]; needsReview: number }>`.
- `apps/web/src/app/api/import-assistant/route.ts` (owner only, bearer).
- The staged upload is extended for PDF/CSV/XLSX, with one parser dependency added.

**App files:** `apps/caterer/app/impor.tsx`, `src/import/*`.

**Model call:** `claude-opus-5-5`, `output_config: { effort: "low", format: <row JSON schema> }`, adaptive thinking, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`. Handle `stop_reason` `refusal` and `max_tokens`.

**Flow:**
- Rows go to `import.preview`. Flagged rows stay editable. *Simpan N pelanggan* calls `import.commit` with the clean rows only.
- `externalReference = "impor-<date>-<n>"`.
- The consent line is shown above the composer.

- [ ] **Failing tests:**
  - Backend, with the SDK mocked: rows are mapped to `packageId`, a row missing an address is flagged `needsReview`, and a refusal returns the code `IMPORT_UNREADABLE`.
  - Staff calling the route gets `FORBIDDEN`.
  - App: *Simpan 25 pelanggan* commits exactly the 25 unflagged rows.
- [ ] Implement to artboards 4–5. Add `ANTHROPIC_API_KEY` to the `.env.example` files (name only). Commit.
- [ ] **Eval (separate approval for API spend):** 20 synthetic inputs (notebook photos, WhatsApp dumps, xlsx). Report row recall and field accuracy.

### Task 11: Push, deep links, release pipeline
**Files:** `apps/caterer/src/links.ts`, `.github/workflows/caterer-apk.yml`, `apps/caterer/README.md`.

- **Links:** map `/seller`, `/seller/schedule?date=`, `/seller/support?case=` and `/seller/customers` to the caterer routes. `device.register` runs on push opt-in.
- **Pipeline:** an EAS preview APK on pushes to `v2` touching `apps/caterer` or shared packages, mirroring `native-apk.yml`'s checks (HTTPS API, `catalog?limit=1` and `me` return JSON). It requires `EXPO_TOKEN` and a new EAS project id.
- [ ] **Failing test:** `nativeLink("/seller/schedule?date=2026-10-08")` returns `"/?date=2026-10-08"`.
- [ ] Implement, then run the full verification below and commit.

## Verification
- **Root checks:** `npm run typecheck` (now includes `apps/caterer` and the two new packages), `npm test`, `npm run build`.
- **Package and app tests:** `npm test -w @catera/caterer`, `npm test -w @catera/mobile-core`, `npm test -w @catera/mobile-ui`.
- **Database:** PostgreSQL concurrency checks for Task 2.
- **Manual (demo mode, synthetic):** run `npm run dev` with `CATERA_V1_DEMO=true`, then `npx expo start` in `apps/caterer` against the LAN IP. Walk through:
  - sign-up → package → import → Hari ini populated
  - share route → WhatsApp text
  - mark Gagal
  - the next day after the jobs run, the delivery shows delivered and the earning appears in Uang
  - helper login sees 2 tabs
- **Build:** an EAS preview APK via the new workflow on `v2`. Install it on an Android phone.
- **Rollout:** to production only after the RUNBOOK gates and the 5-caterer human test (spec §8).
