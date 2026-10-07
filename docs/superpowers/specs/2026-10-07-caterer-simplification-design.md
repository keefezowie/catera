# Caterer simplification: design

**Date:** 2026-10-07
**Status:** design approved in Q&A by Keefe; written spec awaiting review (Keefe, Richie)
**Supersedes:** the caterer-facing parts of `docs/CATERER-SETUP-SIMPLIFICATION.md`. Its human-study protocol is still used for the test in §8.

## 1. Problem

Caterers find the seller workspace overwhelming. The cause is structural: the workspace is organised around Catera's data model (packages, revisions, slots, manifests, settlement states) rather than the caterer's day. Earlier simplification rounds trimmed that structure without changing it.

Evidence from the October 7 inventory:
- **Size:** 11 screens, about 14k lines in the main seller files, and about 40 domain terms a caterer must learn.
- **Setup before the first sale:** onboarding, then a 4-step readiness checklist, then a 5-step / ~25-field package wizard, then verification, then admin approval, then a separate payout setup.
- **Daily work:** a status table with bulk select, per-order stage buttons and a 7-type attention queue.
- **The real migration blocker is buried:** importing existing customers sits behind an "Owner actions" disclosure.
- **Testing:** the app has never been tested with a real caterer.

**Goal:** a caterer product that is useful for daily work from day one, so caterers move everything into Catera instead of going back to notebooks and WhatsApp.

## 2. Decisions

| Topic | Decision |
|---|---|
| Users | Home caterers (1–3 people, 10–50 portions/day) and small kitchens (5–15 staff, 50–300 portions/day) |
| Promise | Both: marketplace demand and a tool to run the whole business |
| Anchor moment | The morning delivery run (the cooking recap and money also matter) |
| Delivery | The caterer, family or their own driver, on a fixed route |
| Route handoff | One-tap share to WhatsApp via `wa.me` / the share sheet. No WhatsApp API and no paid messaging. |
| Delivery confirmation | Done unless reported; the caterer handles exceptions only |
| Existing customers | Every subscription lives in one platform; ongoing paid subscriptions are imported |
| Fee on own customers | Free; commission only on marketplace-sourced customers |
| Menus | Default is one menu for everyone, set by the caterer. Customer-choice is an opt-in mode. |
| Dishes | The library builds itself as menus are typed (autocomplete, copy last week). Categories are kept. Daily menus must match the package composition **exactly**; serving 2 lauk means the package says 2 Lauk. |
| Package must-decide | Name, photo, portion contents, price per portion per day, lunch/dinner, delivery days, daily capacity. Everything else has a default and lives under "Pengaturan lanjutan". |
| Money | Full balance breakdown kept; only the presentation changes |
| Device | Phone first; desktop uses the same layout, wider |
| Messaging | Caterer's own WhatsApp plus customer self-serve (automatic before cutoff). Catera keeps problem reports and refunds. |
| Team | Owner plus one helper role (today's lists and menus; no money, packages or settings) |
| Go-live | **Renewal converts.** Imported paid subscriptions run free until they end. Any renewal or new subscription requires "Aktifkan pembayaran". |
| Delivery approach | A new four-tab caterer front door on the existing backend replaces the 11 screens. It is built now; the human test runs once caterers are recruited. |

**Assumptions**
- Doku per-caterer sub-account and KYC requirements are unknown. "Aktifkan pembayaran" is a single step that absorbs them.
- Copy is Indonesian-first in plain words. Internal terms (slot, revisi, siklus, manifest, cutoff jargon) never appear in the caterer UI.
- The customer marketplace and the native app are out of scope, except for the renewal path.

## 3. Information architecture: four tabs

### Hari ini (home, with a toggle to "Besok")
- **Masak:** totals per meal, then per package and per dish. Changes show inline ("+2 baru · 3 pindah tanggal"). One *Bagikan / Cetak* action.
- **Antar:** one route per meal run.
  - *Bagikan ke WhatsApp* shares the run as prefilled text: name, address, Maps link, portions, notes.
  - Stops have exception actions only: *Gagal diantar* and *Pindah tanggal*. Everything else counts as delivered.
- **Action cards:** at most 3, and only when something is actionable (renewals due, a missing menu, a problem report).
- **New caterers:** a "Mulai" card replaces the action cards: *Profil toko → Buat paket / Pindahkan pelanggan lama → Aktifkan pembayaran*.

### Pelanggan
- All subscribers, marketplace and own, filtered by *Aktif · Segera berakhir · Selesai*.
- Each customer has: schedule, address, a WhatsApp *Chat* button and *Kirim tautan perpanjang*.
- Entry point: **+ Pindahkan pelanggan lama** (the import assistant).

### Menu
- Week view. Each day and meal shows category lines, with the dish count set by the package.
- Dish names autocomplete; a new name creates a dish quietly.
- *Salin minggu lalu* and *Bagikan menu* (WhatsApp text).
- The customer-choice mode appears only when enabled.

### Usaha
- **Paket:** a one-screen editor, plus Pengaturan lanjutan.
- **Uang:** the full breakdown, with each state explained.
- **Toko:** profile, delivery areas, shop link.
- **Tim:** helper invite.
- **Aktifkan pembayaran.**
- **Bantuan Catera.**

### Where current features go

| Current | New home |
|---|---|
| Status table, bulk select, stage buttons | Removed; exceptions only |
| Jadwal calendar | Date switch on Hari ini; per-customer schedule |
| Kitchen list, print/CSV, saved copy #N | Masak plus Bagikan/Cetak; saved copies are internal |
| Perlu perhatian (7 types) | Up to 3 action cards |
| Inbox, support queue | WhatsApp chat buttons; Bantuan Catera |
| Readiness checklist, verification | The Mulai card, ending in Aktifkan pembayaran |
| 5-step package wizard | One screen plus Pengaturan lanjutan |
| Dish library page, package revisions | Built inside Menu; revisions are internal |
| Transaksi | Usaha › Uang |
| Settings, profile, verification | Usaha › Toko / Tim / Aktifkan pembayaran |

## 4. Key flows

### 4.1 First day (target: under 15 minutes, on a phone)
1. Sign up with name, WhatsApp number and kitchen area. No slug and no readiness checklist.
2. **Buat paket** on one screen, using the must-decide fields from §2. The package can be published before approval; it stays invisible on the marketplace until "Aktifkan pembayaran" completes.
3. **Pindahkan pelanggan lama**, the import assistant (§6.3):
   - The caterer drops in anything: WhatsApp text, notebook photos, screenshots, Excel/CSV/PDF.
   - The assistant builds a review table and flags uncertain rows *Perlu dicek*.
   - The caterer corrects in chat or by editing cells.
   - Nothing is saved until *Simpan semua*.
   - The screen shows a consent line about sending customer data to the AI provider. Cost is never shown.
4. Hari ini is populated immediately with tomorrow's cooking recap and route.
5. "Aktifkan pembayaran" waits on the Mulai card. It is required before the first renewal or new customer.

### 4.2 Daily run (target: under 1 minute of app time)
1. Read Masak (Hari ini or Besok); *Cetak* is optional.
2. Antar → *Bagikan ke WhatsApp*.
3. Act on exceptions only. Undisputed deliveries become delivered automatically (§6.1).

### 4.3 Customer self-serve
Before the cutoff, customers change their address or move a date (flexible packages only), using the existing commands. Changes apply automatically, and the caterer sees updated counts. Problem reports become action cards; refunds go through Catera support.

### 4.4 Renewal (the conversion point)
1. Three days before the end, the subscription moves to *Segera berakhir* and an action card appears.
2. *Kirim tautan perpanjang* shares a WhatsApp message with the renewal link. If the customer has no Catera account yet, the message carries the existing claim link first.
3. If payments aren't active yet, the button opens Aktifkan pembayaran.

## 5. What stays unchanged
- Renewal and claim links: `customer.followup` → `/renew/:id`, `customer.invite` → `/claim/<token>`.
- Customer self-serve commands: `delivery.address`, `delivery.reschedule`.
- The owner/staff permission model. The helper is the existing `staff` role.
- Settlement maths and every money state. `SellerSettlement` / `BalanceOverview` are reused with clearer copy.
- Exact slot validation: `v1.valid_slot_menu`.

## 6. Changes

### 6.1 Auto-delivered
- **What:** in the daily maintenance run (the 09:00 Jakarta cron, `/api/jobs`), mark every `delivery_days` / `fulfillments` row with `service_date` before today in Asia/Jakarta and status `scheduled`, `preparing` or `out_for_delivery` as `delivered`.
- **Reuse:** the same day-derivation and subscription-completion logic as `delivery.status`, so `recognize_delivery_earning` records earnings exactly once.
- **Safety:** transactional, idempotent, and safe against concurrent `delivery.status`, refund/cancel and the support holds that `v1.settlement_held` already applies.
- **Exceptions:**
  - *Gagal diantar* → `issue`.
  - *Pindah tanggal* → `customer.deliveryChange`.

### 6.2 Import rules
Changes to `v1.pilot_import_row`:
- Allow sellers that are not yet approved, onto their published packages.
- Skip the coverage-area check for import rows.
- Keep the duplicate, overlap, capacity and cutoff checks, and keep zero money.
- `externalReference` is generated as `impor-<date>-<n>` when the caterer has none.
- Batches of up to 100 rows go through the existing `import.preview` / `import.commit`.

### 6.3 Import assistant (new)
- **Route:** `apps/web/src/app/api/import-assistant/route.ts`, owner-only and same-origin. The logic lives in `packages/backend/src/import-assistant.ts`.
- **Model call:**
  - `@anthropic-ai/sdk`, model `claude-opus-5-5`, effort `low` (raised to `medium` only if the eval requires it), adaptive thinking.
  - Structured output via `output_config.format` with a row JSON schema: name, phone, address, packageId, start, remainingDays or end, portions, meal, paid, notes, needsReview with a reason.
  - Server-side refusal fallback: `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`.
  - Handle `refusal` and `max_tokens` stop reasons. One call per chat turn.
- **Context:** the caterer's package list is included so rows map to `packageId`. The rows then go to `import.preview`; nothing is written until `import.commit`.
- **Inputs:**
  - Images and PDFs go in as native content blocks.
  - XLSX and CSV are parsed to text on the server (one new parser dependency).
  - The staged upload flow (`api/uploads/prepare` and `complete`) is extended beyond images.
- **Security and privacy:**
  - `ANTHROPIC_API_KEY` stays server-only.
  - Raw uploads are removed by the existing staging cleanup.
  - The UI shows a consent line, and the privacy policy is updated.
  - No real customer data is used in tests or evals.

### 6.4 Packages
- The one-screen editor writes the existing offer shape with these defaults: one duration, no tiers, trial off, 17:00 cutoff, flexible schedule.
- Pengaturan lanjutan reuses the existing duration, tier and trial editors.

### 6.5 Menus
- Dish autocomplete filters the dishes already returned by the `seller` read. New names go through `dish.save`.
- The week view saves with `menu.saveBatch`.

### 6.6 Aktifkan pembayaran
One guided step that bundles:
- `seller.submit` verification
- `payoutDestination.submit` bank details
- settlement-policy readiness
- the Doku requirements, once they're known

Until it's complete, renewals and new subscriptions can't be paid. Imports and daily lists keep working.

## 7. Build phases

1. **Backend rules.**
   - A migration under `supabase/migrations/` plus matching `packages/backend/src/*.sql`, covering §6.1 and §6.2.
   - Tests, including PostgreSQL concurrency checks: auto-deliver vs. `delivery.status`, and auto-deliver vs. refund/cancel. Earnings must be recognised exactly once.
2. **Import assistant** (§6.3), with an eval on synthetic messy inputs: notebook photos, WhatsApp dumps, Excel files, mixed Indonesian and English. The eval measures row recall, field accuracy and whether ambiguous rows get flagged. Eval API spend is approved before it runs.
3. **Four-tab app** in `apps/web/src/components/caterer/`:
   - Screen designs go on the Catera canvas for review first.
   - Then the components: `today.tsx`, `share.ts`, `customers.tsx`, `menu-week.tsx`, `business.tsx`, `package-quick-editor.tsx`, `import-assistant.tsx`.
   - The seller navigation in `application.tsx` becomes four tabs: a bottom bar on phones, a slim sidebar on desktop.
   - Rollback switch: `CATERA_CATERER_V2`.
4. **Retire the old screens** and their specs: `seller-operations`, the `menu-calendar` UI, `seller-attention`, the support inbox, the 5-step wizard UI, `seller-readiness`, `prepaid-migration`. Update `PRODUCT.md` and `DESIGN.md`, and add `docs/CATERER-V2.md`.

**Parallel track (Keefe and Richie):**
- Research Doku sub-account and KYC requirements.
- Recruit 5 caterers.

## 8. Verification
- `npm run typecheck`, `npm test` and `npm run build` after each phase.
- PostgreSQL concurrency checks for Phase 1.
- The import-assistant eval (Phase 2).
- New Playwright specs, in demo mode with synthetic data:
  - **First day:** sign up → package → import → Hari ini populated.
  - **Daily run:** Masak counts, share text, a *Gagal* exception, auto-delivered the next day.
  - **Renewal:** gated by Aktifkan pembayaran.
  - **Menu week:** autocomplete, copy last week, exact slot validation.
  - **Helper scope.**
  - Each at 390px and on desktop.
- Specs for retired screens are updated or removed.
- **Human test:** the existing protocol with 5 recruited caterers. Gate: at least 4 of 5 complete each core task unaided before production rollout.
- **Production:** only through the `docs/RUNBOOK.md` gates. Verify the deployed commit and the visible interface.
