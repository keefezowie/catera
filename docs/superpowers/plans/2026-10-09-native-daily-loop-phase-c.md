# Native daily loop (Phase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instruction, 2026-10-09; applies to every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui` and `antislop:antislop-layoutmobile`, and apply them. antislop's mode is resolved as **after (session override)**: do not ask the mode question. Every task review and re-review runs the antislop design check (core, ui, layoutmobile, plus DESIGN.md) on its UI hunks. There is no separate antislop audit after the plan; Task 10 is the emulator gate.
>
> **Models (owner instruction):** implementers `sonnet`; every reviewer `opus`; never `haiku`. Fix rounds 4 and 5 escalate to `opus`.

**Goal:** Close the daily loop: the kitchen taps "Mulai masak" and "Berangkat antar", both apps show the same rantang (lunchbox) track, customers open tomorrow's menu as a story, and Dapur gets a cooking checklist, a numbered delivery order and a done state. First-party usage counts measure the loop without personal data.

**Architecture:**
- Backend: a `delivery.cook` command wraps the command chain exactly like `delivery.depart`, adds `fulfillments.cooking_started_at`, and `v1.delivery()` exposes it with `confirmed_by`. A separate migration adds `v1.usage_daily` and the `catera_v1_usage` RPC, reached through a new `POST usage` API branch.
- Domain: a leaf `journey.ts` turns a fulfilment into a `Journey` and its caption. `customer-day.ts` gains a real `scheduled` plate state, `Plate.journey`, `UpcomingRow.image` and `tomorrowStory`. `kitchen.ts` gains `kitchenSession`, `kitchenDayDone` and `routeMapsUrl`.
- `@catera/mobile-ui` stays domain-free and gains `RantangTrack`, `StoryViewer`, `CheckRow`, `StopRow` and `StickyAction`. The apps compute stages and captions and pass them in.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, react-native-svg 15.15.4, react-native-reanimated 4.5.1, expo-secure-store, expo-image, Supabase Postgres migrations (PGlite in demo), Next.js route handler in `apps/web`, Jest (jest-expo), Vitest, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-09-native-visual-identity-design.md](../specs/2026-10-09-native-visual-identity-design.md), sections 5.1 (Beranda, Menu besok, before and after cutoff), 5.2 (Hari ini cooking and delivering, Semua beres), 6, 6.1, 7, 8, 9 Phase C and 12. Backend detail comes from [the October 8 spec](../specs/2026-10-08-native-uiux-motion-design.md), Phase 2. Earlier plans, for inherited constraints: [Phase A](2026-10-09-native-theme-phase-a.md), [Phase B](2026-10-09-native-mood-phase-b.md).

## Global Constraints

**Process**
- Work on `v2` (wave tasks in their own worktrees, rebased and fast-forwarded into `v2` one at a time).
- Never stage `apps/web/tsconfig.json` or `.claude/`. Stage by explicit path; other sessions may commit on `v2`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Worktree implementers first run `git reset --hard <base>` with the base commit given in the dispatch, then `npm ci --prefer-offline`. In a worktree, run app Jest with `npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from the app folder.

**Inherited from Phases A and B**
- Their Global Constraints, Skill rules and Rulings (Phase A R1 to R5, Phase B B1 to B6) all apply.
- Native sources never read `colors`. Mood colours only on mood surfaces (the header, the Beranda hero, the Dapur count card, the Jelajah header). No literal hex in `apps/caterer/*` or `packages/mobile-ui/src`.
- No `fontWeight` outside `textVariants`. Edits are written by hand: no codemod, `sed` or rewrite script (R-33). No em dashes in copy, comments or docs.

**Data truth**
- Stages come from fulfilment status and timestamps, never from the clock (spec 6.1). A meal the kitchen never tapped stays "Terjadwal".
- Never invent numbers, dishes or customers (R-17, R-38). Checklist rows come from `cookingRecap`, stops from `deliveryRoute`.
- Tenant authorization stays inside the database transaction (`v1.is_staff` in the command). Demo mode stays explicit and synthetic; no real customer fixtures, no secrets.

**Copy:** pinned in each task, passed through `t(id, en)` in the apps and through a `locale` argument in the domain.

**Motion (spec 7):** timings from `nativeMotion` (control 120, selection 180, content 220, feature 320, ease `[0.16, 1, 0.3, 1]`). Only transform and opacity animate. Under reduced motion (`useReduced()`), every change is instant. Nothing loops or pulses. Lists and calendars have no entrance animation.

**Layout (antislop-layoutmobile):** every control at least 48dp; text wraps and never truncates, except a stop address, which is one line with the full address in its accessibility label (spec 5.2); no horizontal scroll at font scale 1.0 or 1.3; the sticky action sits in `Screen`'s `footer` slot so it never covers content; content capped at 760 like `Screen`.

**Tests**
- Every new Jest test that depends on today's date pins the clock: `jest.useFakeTimers({ now, doNotFake: [...] })` with the same `doNotFake` list as `pinToday` in `apps/caterer/tests/today.test.tsx` lines 24 to 32.
- Fixture builders for a task go in that task's own test file.

**Parallel waves**
- A wave task must not edit `package.json`, lockfiles, `packages/design-tokens/src/index.ts`, `DESIGN.md` or `apps/*/tests/fixtures.ts`.
- Wave 1 owns, by task: Task 2 `supabase/`, `packages/backend/src/database.ts`, `tests/postgres-*.mjs`; Task 4 `packages/domain/src/*` and `apps/customer/src/today/Plate.tsx`; Task 5 `packages/mobile-ui/src/*`.
- Wave 2 owns, by task: Task 6 `apps/customer/src/today/{Beranda,Plate}.tsx`; Task 7 `apps/customer/src/tomorrow/*`, `apps/customer/app/tomorrow.tsx`, `apps/customer/app/_layout.tsx`; Task 8 `apps/caterer/src/today/*`. Exception: Task 7 adds exactly one import and one JSX line to `Beranda.tsx` (Ruling C10).

### Skill rules

From `building-native-ui`:
- `React.use` for context; `process.env.EXPO_OS` for new platform checks; `useWindowDimensions`, never `Dimensions.get`.
- New styles are inline objects; `themedStyles` only for reused stylesheets.
- `boxShadow` only; gradients through `experimental_backgroundImage` (no new dependency).
- Error and important data text is `selectable`. Counters and quantities use `tabular-nums`.
- `borderCurve: "continuous"` on new rounded surfaces.
- `expo-image` for photos.

From `antislop`, `antislop-ui` and `antislop-layoutmobile`:
- R-27: loading, error and empty states for the story, the checklist and the delivery order.
- R-34: both themes and both moods work. R-25: contrast on every text-on-fill, including text over photos.
- R-26: every control does something real. R-19: motion has a written purpose and never loops.
- One accent per screen (sunrise ink). 48dp targets. No overflow. The bottom bar never covers content.

### Rulings (made 2026-10-09)

- **C1. Exposed fields.** The meal JSON from `v1.delivery()` gains `cooking_started_at` and `confirmed_by`, with those names. `v1.beta_production_signature` strips both, so cooking never reads as a production change. Cost if wrong: a rename.
- **C2. Cook sends no push** and is not added to `immediatePush`. Customers see "Dimasak" on their next read (realtime event row only). Cost if wrong: one push later.
- **C3. A Dapur session's stage is its least advanced active row.** Rows with status `cancelled` or `issue` are skipped. "Mulai masak" shows while any row is `scheduled`; "Berangkat antar" shows once none is `scheduled` and some row is `preparing`. Both act on today only. Cost if wrong: one aggregation rule.
- **C4. A preparing meal set by the older `delivery.status` path has no `cooking_started_at`.** Its caption is "Dimasak" without a time. Cost if wrong: none.
- **C5. The departure caption carries no number:** "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat." The push reaches only customers with an account, and the Dapur state cannot count them truthfully (R-17). Cost if wrong: a copy edit.
- **C6. Before departure the delivery order stays visible under the checklist,** so the existing per-stop `ExceptionSheet` (move a day, report a failure) remains reachable. After departure the checklist goes and the order leads. Cost if wrong: one section's position.
- **C7. "Laporkan masalah" is the per-stop "…" button,** which opens the existing `ExceptionSheet`. Native has no other report entry. The footer copy says so. Cost if wrong: a copy edit and one button.
- **C8. "Buka semua di Peta" uses a Google Maps directions link of at most 10 stops.** With more than 10 stops the button reads "Buka 10 alamat pertama di Peta". Cost if wrong: one domain function.
- **C9. The story opens with a fade and a scale from 0.92 to 1 (feature 320)** instead of a shared-element ring transition, and closes on a downward swipe through `PanResponder`. No new dependency. Cost if wrong: a richer transition later.
- **C10. Task 7 may add one import and one JSX line to `Beranda.tsx`.** Merge Task 6 before Task 7 and resolve by hand. Cost if wrong: one manual rebase.
- **C11. Checklist ticks live in one SecureStore key per caterer,** `runtime.storageKey("ticks.<catererId>")`, holding `{ [date]: { lunch: string[]; dinner: string[] } }`. Each write drops dates before today (Jakarta). Never sent to the server. Cost if wrong: a storage reshape.
- **C12. Usage names are allowlisted now, including Phase D's.** `journey_viewed` fires at most once per delivery, meal and stage per app process. There is no user, caterer or device column. Cost if wrong: one allowlist edit.
- **C13. After the change cutoff, the story's deadline line reads "Sudah lewat batas ubah"** and shows no "Ubah hari", matching Dapur's closed-day copy (Phase B ruling 16). Cost if wrong: a copy edit.
- **C14. `RantangTrack` reads `heroText` for the marker, the progress line and the caption, and `heroMeta` for idle stops and stop labels.** Both already pass 4.5:1 on `hero` in all four looks, so no new tokens are needed. Cost if wrong: one token swap.

## Review Focus

1. **Double taps and late taps:** "Mulai masak" pressed twice, after departure, or on tomorrow returns `{moved: 0}` or `INVALID_DATE`, never regresses a status, and the Dapur screen shows a plain message. Pinned in Tasks 2 and 8.
2. **A mixed session** (one stop departed on its own, others scheduled): the session stage is the least advanced row, "Mulai masak" is still offered, and the caption tells the truth. Pinned in Task 4.
3. **Tomorrow with two lunches** (two packages for the same meal): the story has one part per delivery and meal, lunch parts first, and the Beranda row shows one ring per part. Pinned in Tasks 4 and 7.
4. **Usage while offline or signed out:** `track()` never throws, never blocks a screen and never retries in a loop; `app_open` counts once per Jakarta day across midnight. Pinned in Task 3.
5. **Yesterday's ticks:** a tick from yesterday is never shown today and is gone from storage after the next write. Pinned in Task 8.

## Execution order and waves

1. **Task 1 (main tree):** Phase B residuals. Its review overlaps wave 1.
2. **Wave 1 (parallel worktrees):** Task 2 (backend cook), Task 4 (domain), Task 5 (mobile-ui components).
3. **Task 3 (main tree):** usage counts. It needs Task 2's `database.ts` and Postgres harness changes.
4. **Wave 2 (parallel worktrees):** Task 6 (Beranda track), Task 7 (Menu besok), Task 8 (Dapur cooking). Merge 6 before 7.
5. **Task 9 (main tree):** Dapur delivery order and done state, after Task 8 merges.
6. **Task 10 (main tree):** DESIGN.md, the end-to-end check and the emulator gate in four looks.

---

### Task 1: Phase B residuals

**Files:**
- Modify: `apps/customer/tests/today.test.tsx` (the other-meal describe, about lines 514 to 612), `DESIGN.md:550`, `anti-slop/audit-003-2026-10-09.md:211`

**Interfaces:** none.

- [ ] **Step 1:** In the other-meal tests, pin the clock in `beforeEach` with `jest.useFakeTimers({ now: new Date(\`${TODAY}T05:00:00Z\`), doNotFake: [...] })` (12.00 Jakarta on the fixtures' `TODAY`, so `todayPlates` and the fixtures can never straddle midnight) and `jest.useRealTimers()` in `afterEach`. Keep the "00.01–00.30" and "23.59–23.59" windows.
- [ ] **Step 2:** Run the customer suite: `npm test -w apps/customer`. Expected: PASS, same count as before.
- [ ] **Step 3:** `DESIGN.md:550`: replace "Langganan Anda" ("Your subscription") with "Membuka tautan" ("Opening the link"), the shipped claim loading title.
- [ ] **Step 4:** `audit-003:211`: replace "each with a test that was red on the old code where behaviour changed" with a sentence naming where red-first evidence exists: `sessionStart`, the other-meal row, `topTags`, the Jadwal legend and labels, and the nested-scroll fix; the other items were verified by passing tests only.
- [ ] **Step 5: Commit**: `fix(test): pin the Beranda other-meal clock; correct claim title and audit evidence`

---

### Task 2: `delivery.cook` command (wave 1)

**Files:**
- Create: `supabase/migrations/20261009090000_kitchen_cooking.sql`, `tests/delivery-cook.test.ts`
- Modify: `packages/backend/src/database.ts` (new guarded block before `return db;`, about line 625), `tests/postgres-delivery-confirm.mjs` (migration list lines 47 to 62; new `verifyDeliveryCook` export), `tests/postgres-concurrency.mjs` (call it after `verifyDeliveryDepart`, about line 319)

**Interfaces:**
- Consumes: the current outermost `public.catera_v1_command(text, jsonb, uuid)` (defined by `20261008121000_delivery_issue_not_future.sql`), the depart wrapper in `20261008102500_depart_today_one_push.sql` as the pattern, `v1.delivery` from `20261008113000_caterer_whatsapp.sql`, `v1.beta_production_signature` from the same file.
- Produces:
  - Command `delivery.cook` with payload `{ catererId: string; date: "YYYY-MM-DD"; meal: "lunch" | "dinner" }` (exactly those keys), result `{ moved: number }`.
  - Column `v1.fulfillments.cooking_started_at timestamptz`.
  - Per-meal JSON keys from `v1.delivery()`: `cooking_started_at: string | null`, `confirmed_by: "customer" | "auto" | "caterer" | null`.

- [ ] **Step 1: Write the failing tests** in `tests/delivery-cook.test.ts`, booting with `createDemoDatabase(true)` and the helpers and seed constants used by `tests/delivery-depart.test.ts` (copy its helper shapes; re-date days with direct updates as it does):
  - `owner cooks today's lunch`: `moved` equals the number of today's lunch fulfilments for Dapur Senja; those rows are `preparing` with `cooking_started_at` set; dinner rows unchanged; each day's status is `preparing`; no new push outbox rows; one `catera_v1_events` row per customer user with topic `delivery.changed`; one `v1.audit` row with action `delivery.cook`.
  - `cooking twice moves nothing`: a second cook with a new request id returns `{moved: 0}` and leaves `cooking_started_at` unchanged.
  - `cook after depart moves nothing`: rows stay `out_for_delivery`.
  - `depart after cook moves the preparing rows` and keeps `cooking_started_at`.
  - `staff can cook; others cannot`: Bima succeeds; the customer and another caterer's owner get `FORBIDDEN`.
  - `rejects bad input`: tomorrow's date gives `INVALID_DATE`; meal `"brunch"` or an extra key gives `INVALID_INPUT`.
  - `replays by request id`: the same request id and payload returns the first result; the same id with another payload gives `CONFLICT`.
  - `the delivery read exposes cooking and arrival facts`: after cook, the meal JSON has `cooking_started_at`; after `auto_deliver`, `confirmed_by` is `"auto"`.
  - `cooking is not a production change`: mirror `tests/customer-arrival.test.ts:67`; the signature before and after cook is equal.
- [ ] **Step 2:** `npx vitest run tests/delivery-cook.test.ts`. Expected: FAIL (unknown action falls through, columns missing).
- [ ] **Step 3: Write the migration.**
  - `alter table v1.fulfillments add column if not exists cooking_started_at timestamptz;`
  - Rename the current `public.catera_v1_command(text,jsonb,uuid)` to `public.catera_v1_command_cook_base`. If its body references `catera_v1_command.request_id`, rewrite that reference with the `pg_get_functiondef` and `replace` block used at `20261008111000_push_report_renewal_dedupe.sql:38`; otherwise rename plainly.
  - New `public.catera_v1_command` wrapper: identical to the 102500 depart wrapper (payload check, `v1.is_staff`, user lock, receipt replay, `INVALID_DATE` for any date other than today in Asia/Jakarta, caterer lock, `delivery_days` lock then fulfilment lock in `day_id` order, audit, receipt, grants) except:
    - it handles only `delivery.cook` and forwards every other action to `catera_v1_command_cook_base`;
    - it locks fulfilments with `status = 'scheduled'` only and sets `status = 'preparing', cooking_started_at = now()`;
    - the day moves to `preparing` only from `scheduled`;
    - it writes the realtime event row per customer user and calls no `v1.notify`.
  - `create or replace` `v1.delivery(d v1.delivery_days)` from the 113000 body, adding `cooking_started_at` and `confirmed_by` to each meal object.
  - `create or replace` `v1.beta_production_signature` from the 113000 body, also stripping `cooking_started_at` and `confirmed_by` from each meal.
  - Close with the same `revoke` and `grant` lines as 102500.
- [ ] **Step 4:** In `database.ts`, add a block that runs the migration when `to_regprocedure('public.catera_v1_command_cook_base(text,jsonb,uuid)') is null`, in the existing `begin;`/`commit;` style.
- [ ] **Step 5:** `npx vitest run tests/delivery-cook.test.ts tests/delivery-depart.test.ts tests/customer-arrival.test.ts tests/caterer-whatsapp.test.ts`. Expected: PASS.
- [ ] **Step 6: Postgres races.** Append the migration to the list in `postgres-delivery-confirm.mjs` and add `verifyDeliveryCook(pool, cmd)`:
  - cook and depart in both forced orders (hold one transaction open, start the other): every row ends `out_for_delivery`, exactly one depart push per customer, and `cooking_started_at` is set only when cook committed first;
  - owner and staff cook free-running with lags `[0, 2, 5, 9]`: the two `moved` values sum to the row count and each row has one `cooking_started_at`;
  - cook against `auto_deliver`: no row that ended `delivered` is ever `preparing` afterwards.
  Call it from `postgres-concurrency.mjs` after `verifyDeliveryDepart`.
- [ ] **Step 7:** `npm run test:postgres`, then `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 8: Commit**: `feat(backend): delivery.cook marks a session cooking, exposes cooking and arrival facts`

---

### Task 3: Usage counts (after wave 1)

**Files:**
- Create: `supabase/migrations/20261009091000_usage_counts.sql`, `packages/mobile-core/src/usage.ts`, `tests/usage-counts.test.ts`, `apps/customer/tests/usage.test.tsx`
- Modify: `packages/backend/src/database.ts` (`localRpc` allowlist lines 638 to 647; new guarded block), `apps/web/src/app/api/v1/[...path]/route.ts` (POST, after the `if (!s.id)` check near line 507), `packages/api-client/src/index.ts`, `packages/domain/src/index.ts` (usage names and schema), `packages/mobile-core/src/{runtime.ts,provider.tsx,index.ts}`, `apps/customer/src/runtime.ts`, `apps/caterer/src/runtime.ts`, `tests/postgres-concurrency.mjs`

**Interfaces:**
- Consumes: Task 2's `database.ts` block and Postgres harness.
- Produces:
  - `export const usageNames = ["app_open", "tomorrow_story_viewed", "journey_viewed", "plan_sheet_opened", "renew_started", "purchase_confirmed_viewed", "cook_started", "depart_tapped"] as const; export type UsageName = (typeof usageNames)[number];` and `export const usageSchema = z.object({ name: z.enum(usageNames), app: z.enum(["customer", "dapur"]) }).strict();` in `@catera/domain`.
  - RPC `public.catera_v1_usage(name text, app text) returns jsonb` (returns `{}`).
  - `api.usage(name: UsageName, app: "customer" | "dapur"): Promise<void>` posting `usage`.
  - `MobileRuntimeConfig.app: "customer" | "dapur"` (customer app passes `"customer"`, Dapur `"dapur"`).
  - `useTrack(): (name: UsageName) => void` exported from `@catera/mobile-core`.

- [ ] **Step 1: Write the failing tests.**
  - `tests/usage-counts.test.ts` (demo database): two `app_open` calls from the customer make `n = 2` for today (Jakarta) and app `customer`; `cook_started` from the owner with app `dapur` is a separate row; an unknown name gives `INVALID_INPUT`; a call with no actor gives `UNAUTHORIZED`; `information_schema.columns` for `v1.usage_daily` lists exactly `day`, `app`, `name`, `n`.
  - `apps/customer/tests/usage.test.tsx` (clock pinned): `useTrack()("journey_viewed")` calls `api.usage` with `("journey_viewed", "customer")`; a rejected `api.usage` raises nothing and logs nothing; with no actor it does not call the API; `app_open` is sent once on mount, not again on an `AppState` "active" the same Jakarta day, and again after the pinned clock moves past 00.00 Jakarta.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3: Migration.** `v1.usage_daily(day date, app text check (app in ('customer','dapur')), name text, n integer not null default 0, primary key (day, app, name))`, RLS enabled with no policies. `catera_v1_usage` is `security definer` with `set search_path`, raises `UNAUTHORIZED` when `auth.uid()` is null and `INVALID_INPUT` for a name outside the eight or a bad app, then upserts `n = n + 1` for today in Asia/Jakarta. `revoke` from `public, anon`; `grant execute` to `authenticated`.
- [ ] **Step 4:** Add `catera_v1_usage` to the `localRpc` allowlist and a guarded install block (`to_regclass('v1.usage_daily') is null`). Read the route handler guide in `node_modules/next/dist/docs` first (AGENTS.md), then add the `usage` branch: `usageSchema.parse(a)`, then `rpc(s.id, s.token, "catera_v1_usage", { name, app })`, returning `ok({})`.
- [ ] **Step 5:** `useTrack` sends with `runtime.config.app`, catches every rejection, and does nothing without an actor. `provider.tsx` sends `app_open` on mount and on `AppState` "active" when `runtime.storageKey("usage.app_open")` does not hold today's Jakarta date, then stores it.
- [ ] **Step 6:** Add to `postgres-concurrency.mjs`: 20 parallel `catera_v1_usage('app_open','customer')` calls from one user leave `n = 20`.
- [ ] **Step 7:** `npx vitest run tests/usage-counts.test.ts`, `npm test -w apps/customer`, `npm run test:postgres`, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 8: Commit**: `feat(usage): daily first-party usage counts with no personal data`

---

### Task 4: Domain journey, tomorrow story and kitchen session (wave 1)

**Files:**
- Create: `packages/domain/src/journey.ts`, `tests/journey.test.ts`
- Modify: `packages/domain/src/index.ts` (`DeliveryMeal` L161 to 168; `export * from "./journey"`), `packages/domain/src/customer-day.ts`, `packages/domain/src/kitchen.ts`, `apps/customer/src/today/Plate.tsx` (`sentences` only), `tests/customer-day.test.ts`, `tests/kitchen.test.ts`, and any customer Jest expectation that asserted "Sedang dimasak" for a scheduled meal

**Interfaces:**
- Consumes: Task 2's field names (`cooking_started_at`, `confirmed_by`); no runtime dependency.
- Produces:
  - `DeliveryMeal` gains `cooking_started_at?: string | null` and `confirmed_by?: "customer" | "auto" | "caterer" | null`.
  - `journey.ts` (leaf module, imports nothing from `./index`):
    - `export type JourneyStage = "scheduled" | "preparing" | "out_for_delivery" | "delivered";`
    - `export type Journey = { stage: JourneyStage; cookingAt: string | null; departedAt: string | null; arrivedAt: string | null; arrivedBy: "customer" | "auto" | "caterer" | null; issue: boolean };`
    - `export function mealJourney(meal: DeliveryMeal): Journey` (a meal with status `issue` keeps the stage its timestamps imply: departed gives `out_for_delivery`, cooking gives `preparing`, else `scheduled`; `issue: true`).
    - `export function journeyCaption(j: Journey, locale: "id" | "en"): string | null` (null when `j.issue`; times as `HH.MM` Asia/Jakarta).
  - `customer-day.ts`: `PlateState` gains `"scheduled"`; `Plate` gains `journey: Journey`; `UpcomingRow` gains `image: string` (`menuCoverImage(menu, offer.image)`); and
    - `export type StoryPart = { deliveryId: string; meal: "lunch" | "dinner"; title: string | null; sides: string[]; catererName: string; window: string; image: string; menuSet: boolean; changeable: boolean; until: string | null };`
    - `export type TomorrowStory = { date: string; parts: StoryPart[] };`
    - `export function tomorrowStory(state, now: Date, locale: "id" | "en"): TomorrowStory | null` (same state type `todayPlates` takes).
  - `kitchen.ts`: `CookingRecap.byDish` items gain `image: string` (dish photo or `""`); and
    - `export type KitchenSession = { meal: KitchenMeal; journey: Journey; portions: number; addresses: number; canCook: boolean; canDepart: boolean; recap: CookingRecap; stops: Stop[] };`
    - `export function kitchenSession(state: SellerOperationsState, meal: KitchenMeal, now: Date): KitchenSession | null`
    - `export function kitchenDayDone(state: SellerOperationsState, issues: DeliveryIssue[], now: Date): boolean`
    - `export function routeMapsUrl(stops: Stop[]): { url: string; count: number } | null`

- [ ] **Step 1: Write the failing tests.**
  - `tests/journey.test.ts`, `journeyCaption` table (id, then en):
    - scheduled: "Terjadwal" / "Scheduled"
    - preparing with `cooking_started_at` `2026-10-09T01:10:00Z`: "Dimasak 08.10" / "Cooking since 08.10"; without it: "Dimasak" / "Cooking" (Ruling C4)
    - out_for_delivery with `departed_at` `03:42Z`: "Berangkat 10.42" / "Left at 10.42"; without it: "Sedang diantar" / "On the way"
    - delivered with `confirmed_by` `"auto"`: "Tercatat sampai" / "Recorded as arrived"; `"customer"` or `"caterer"`: "Sampai" / "Arrived"
    - status `issue` after departure: stage `out_for_delivery`, `issue: true`, caption `null`.
  - `tests/customer-day.test.ts`:
    - a `scheduled` meal before its window is plate state `scheduled`; a `preparing` meal is `cooking`; either one after the window start is `due`; `on_the_way`, `arrived`, `failed` and `reported` are unchanged.
    - `plate.journey.stage` follows the status.
    - `UpcomingRow.image` is the menu cover, then the package photo.
    - `tomorrowStory`: null with no delivery tomorrow; a day with lunch and dinner gives parts lunch then dinner; two packages with lunch give two lunch parts before any dinner (Review Focus 3); a meal with no menu has `title: null`, `menuSet: false` and the package photo; `changeable` and `until` follow `canChangeDay` and `changeDeadline` (true and "hari ini 20.00" style before cutoff, false and `null` after); cancelled meals are skipped.
  - `tests/kitchen.test.ts`:
    - `kitchenSession`: null with no active rows; the stage is the least advanced active row (one row `out_for_delivery`, one `scheduled` gives `scheduled`, Review Focus 2); `canCook` true while any row is `scheduled` and only on today; `canDepart` true when none is `scheduled` and some is `preparing`, only on today; `issue` and `cancelled` rows are skipped; `cookingAt` and `departedAt` are the earliest; delivered sessions use `arrivedBy: "auto"` only when every delivered row is auto.
    - `kitchenDayDone`: false on a day that is not today, false with no active rows, false while any row is not `delivered`, false with an issue for that date whose status is not `resolved`, true otherwise.
    - `routeMapsUrl`: null for no stops; 3 stops give a `https://www.google.com/maps/dir/?api=1` URL with the last stop as `destination`, the others as `waypoints` joined by `|`, and `count: 3`; 12 stops give `count: 10`.
    - `byDish` carries the dish photo, or `""`.
- [ ] **Step 2:** `npx vitest run tests/journey.test.ts tests/customer-day.test.ts tests/kitchen.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types and functions above. Reuse `menuCoverImage`, `canChangeDay`, `changeDeadline`, `cookingRecap`, `deliveryRoute`, `mealWorkload` and `jakartaDay`; build `routeMapsUrl` addresses the way the private `mapsUrl` does.
- [ ] **Step 4:** In `Plate.tsx` `sentences`, add `case "scheduled"`: `[t("Terjadwal", "Scheduled"), t(\`diantar ${p.window} ke ${p.addressLabel}\`, \`delivered ${p.window} to ${p.addressLabel}\`)]`. Update customer tests that expected "Sedang dimasak" for a meal that was only scheduled.
- [ ] **Step 5:** Run the three Vitest files, `npm test -w apps/customer`, `npm test -w apps/caterer`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit**: `feat(domain): journey stages, a truthful scheduled plate, tomorrow story and kitchen session`

---

### Task 5: mobile-ui daily-loop components (wave 1)

**Files:**
- Create: `packages/mobile-ui/src/brand/Rantang.tsx`, `packages/mobile-ui/src/{RantangTrack,StoryViewer,CheckRow,StopRow,StickyAction}.tsx`, `apps/customer/tests/daily-loop-ui.test.tsx`
- Modify: `packages/mobile-ui/src/PhotoRing.tsx` (use the shared `Rantang`), `packages/mobile-ui/src/index.ts`

**Interfaces:**
- Consumes: `useMoodColors`, `useColors`, `useReduced`, `PressableScale`, `FadeSwap`, `Text`, `Button`, `nativeMotion`.
- Produces (exported from `@catera/mobile-ui`):
  - `Rantang({ size, color, filled? }: { size: number; color: string; filled?: boolean })`: the lunchbox drawing moved out of `PhotoRing` (body, divider, handle), decorative.
  - `RantangTrack({ stage, caption, labels, testID? }: { stage: "scheduled" | "preparing" | "out_for_delivery" | "delivered"; caption: string; labels: [string, string, string]; testID?: string })`
  - `StoryViewer({ count, index, onIndexChange, onClose, header, closeLabel, children }: { count: number; index: number; onIndexChange: (i: number) => void; onClose: () => void; header: string; closeLabel: string; children: ReactNode })`
  - `CheckRow({ quantity, name, image, icon, checked, onToggle, testID? }: { quantity: number; name: string; image?: string; icon: "sunny-outline" | "moon-outline"; checked: boolean; onToggle: () => void; testID?: string })`
  - `StopRow({ n, name, detail, address, onMap, mapLabel, onMore, moreLabel }: { n: number; name: string; detail: string; address: string; onMap: () => void; mapLabel: string; onMore?: () => void; moreLabel?: string })`
  - `StickyAction({ label, caption, onPress, busy, disabled, testID? }: { label: string; caption?: string; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string })`, rendered by callers into `Screen`'s `footer`.

- [ ] **Step 1: Write the failing tests** in `apps/customer/tests/daily-loop-ui.test.tsx` (render inside the theme and mood providers):
  - `RantangTrack`: the marker (`testID="rantang-marker"`) sits at stop index 0, 0, 1 and 2 for the four stages; for `scheduled` it is an outline (`filled` false); the container's accessibility label is the caption; the three labels are hidden from screen readers; changing `stage` after mount starts a `withTiming` of `nativeMotion.feature` (mocked Reanimated), while the first render and reduced motion set the position directly.
  - `StoryViewer`: renders `count` segment bars with the first `index + 1` filled; pressing the right half calls `onIndexChange(index + 1)` and does nothing on the last part; the left half calls `onIndexChange(index - 1)` and does nothing on the first; the 48dp close button with `closeLabel` calls `onClose`; nothing advances on a timer (advance fake timers 30s, no call).
  - `CheckRow`: role `checkbox` with `checked` state; label "8× Ayam bakar"; pressing calls `onToggle`; when checked the name has `textDecorationLine: "line-through"`; with no `image` the meal icon shows.
  - `StopRow`: the address renders with `numberOfLines={1}` and the full address is in the row's accessibility label; the map and "…" buttons are at least 48dp and call their handlers; with no `onMore` there is no "…" button.
  - `StickyAction`: shows label and caption; `busy` shows the spinner and blocks presses; `disabled` blocks presses.
- [ ] **Step 2:** `npx jest --runInBand apps/customer/tests/daily-loop-ui.test.tsx` from `apps/customer` (or `npm test -w apps/customer -- daily-loop-ui`). Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `RantangTrack` (Ruling C14): a line between three stop dots at 0, 50% and 100% of the measured width; the progress line and the marker in `heroText`, idle dots, the rest of the line and the stop labels in `heroMeta`; the caption in `heroText`, `label` variant; the marker is a 24dp `Rantang` above the current stop, moved with `translateX`.
  - `StoryViewer`: full-screen black-backed container; bars at the top under the safe area; `header` text beside the close button; two invisible pressables split left and right behind the content, hidden from accessibility; `PanResponder` closes on a downward drag over 80dp or a fast fling; the child swaps through `FadeSwap` keyed by `index`; on mount it fades in and scales from 0.92 to 1 over `nativeMotion.feature` (Ruling C9).
  - `CheckRow`: whole row is one `PressableScale` with `haptic="tap"`, at least 56 high; quantity `heading` with `tabular-nums`; a 48dp round box with a `controlRing` border, filled `forest` with a cream check when ticked (opacity over `control`); the row's opacity drops to 0.55 over `content` when ticked.
  - `StopRow`: number in a 28dp `sage` circle, name and `detail` on one wrapping line, address on one line in `muted`.
  - `StickyAction`: primary `Button` full width, caption `small` `muted` above it, padded 12 with a top `line` border, capped at 760.
- [ ] **Step 4:** Run the test file and `npm test -w apps/customer`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(mobile-ui): rantang track, story viewer, checklist row, stop row and sticky action`

---

### Task 6: Beranda rantang track (wave 2)

**Files:**
- Modify: `apps/customer/src/today/Plate.tsx`, `apps/customer/src/today/Beranda.tsx`, `apps/customer/tests/today.test.tsx`

**Interfaces:**
- Consumes: `Plate.journey`, `journeyCaption` (Task 4); `RantangTrack` (Task 5); `useTrack` (Task 3).
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests** (clock pinned to 12.00 Jakarta on `TODAY`):
  - the hero for a scheduled lunch shows the track with caption "Terjadwal" and the sentence "Terjadwal", not "Sedang dimasak";
  - `preparing` with `cooking_started_at` `${TODAY}T01:10:00Z` shows "Dimasak 08.10";
  - `out_for_delivery` with `departed_at` `03:42Z` shows "Berangkat 10.42", and the old "Berangkat" chip is gone (no duplicate text);
  - `delivered` with `confirmed_by: "auto"` shows "Tercatat sampai";
  - a `failed` or `reported` plate shows no track and keeps its existing message;
  - card plates (`morePlates`) show no track;
  - `journey_viewed` is sent once for a preparing hero across two re-renders and the mood toggled away and back; never for a scheduled one.
- [ ] **Step 2:** `npm test -w apps/customer -- today`. Expected: FAIL.
- [ ] **Step 3: Implement.** The hero variant of `Plate` renders `RantangTrack` after the dish, caterer and window, with `stage={plate.journey.stage}`, `caption={journeyCaption(plate.journey, locale)}` and labels `[t("Dimasak", "Cooking"), t("Diantar", "On the way"), t("Sampai", "Arrived")]`, unless the plate is `failed` or `reported` or `journey.issue`. Remove the "Berangkat {jam}" chip. Send `journey_viewed` from the hero through a module-level `Set` of `deliveryId:meal:stage`.
- [ ] **Step 4:** Run the customer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(customer): rantang track on the Beranda hero`

---

### Task 7: Menu besok row and story (wave 2)

**Files:**
- Create: `apps/customer/src/tomorrow/{viewed.ts,TomorrowRow.tsx,TomorrowStory.tsx}`, `apps/customer/app/tomorrow.tsx`, `apps/customer/tests/tomorrow.test.tsx`
- Modify: `apps/customer/app/_layout.tsx` (register the route), `apps/customer/src/today/Beranda.tsx` (one import, one JSX line between the other-meal row and `MenuDueRows`, Ruling C10)

**Interfaces:**
- Consumes: `tomorrowStory`, `StoryPart`, `dayLabel` (Task 4); `StoryViewer`, `PhotoRing` with `covered` (Task 5, Phase B); `useTrack` (Task 3); the Beranda `useData("home:customer", ...)` key, so the story reads the same cache.
- Produces:
  - `viewed.ts`: `useViewedParts(parts: StoryPart[]): { viewed: Set<string>; markViewed: (part: StoryPart) => void }`, keyed `runtime.storageKey(\`story.${deliveryId}.${meal}\`)` with value `"seen"`.
  - `TomorrowRow({ story }: { story: TomorrowStory })` and the route `/tomorrow?part=<index>`.

- [ ] **Step 1: Write the failing tests** (clock pinned; SecureStore mocked):
  - Row: titled "Menu besok" with the day label; one 60dp ring per part, lunch rings `sunriseInk`, dinner rings `forest`; before cutoff the meta reads "Bisa diubah sampai {until}" and no ring is covered; after cutoff the meta reads "Sudah lewat batas ubah", rings are covered, and a ring whose key holds "seen" shows its photo; each ring's accessibility label reads "Menu besok, makan siang, {title}" (or "Menu belum diisi"); pressing ring 2 pushes `/tomorrow?part=1`; no row when `tomorrowStory` is null.
  - Story: header "Menu besok · {tanggal} · 1 dari 2"; sticker "Makan siang · {window}"; `display` title is the dish; "Lihat menu malam" moves to "2 dari 2" and the last part's button is "Selesai", which closes; a not-set menu shows "Menu belum diisi oleh Dapur Senja" over the package photo; showing a part writes its "seen" key; `tomorrow_story_viewed` is sent once per open; before cutoff "Ubah hari" pushes `/hari/{deliveryId}`; after cutoff the line is "Sudah lewat batas ubah" with no "Ubah hari" (Ruling C13); a one-meal day has one bar and "Selesai"; loading reads "Memuat menu besok…"; an error reads "Belum bisa memuat" with "Coba lagi"; no story reads "Belum ada antaran besok." with a close button.
- [ ] **Step 2:** `npm test -w apps/customer -- tomorrow`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The route registers as `<Stack.Screen name="tomorrow" options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />` and sets a light status bar.
  - A part fills the screen with an `expo-image` photo (`contentFit="cover"`). A top gradient keeps the bars and header legible; a bottom gradient runs from transparent to `rgba(11,31,22,0.92)`, and all bottom text sits where the gradient is at least 0.85 opaque (R-25 over any photo). Text over the photo is cream.
  - Sticker: cream fill, 1.5 `sunriseInk` border, rotated −2°, forest text, the one fact on the screen.
  - Below it: the `display` title (dish, or the not-set line), "{caterer} · {sides joined by ', '}", the deadline line with "Ubah hari" as a secondary button, then the primary button.
  - Close: the viewer's close button and swipe; "Selesai" calls `router.back()`.
- [ ] **Step 4:** Add the row to Beranda when the story exists. Run the customer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(customer): tomorrow's menu as a story, covered after the cutoff until seen`

---

### Task 8: Dapur cooking checklist and actions (wave 2)

**Files:**
- Create: `apps/caterer/src/today/{CookingList.tsx,ticks.ts}`, `apps/caterer/tests/kitchen-loop.test.tsx`
- Modify: `apps/caterer/src/today/{TodayScreen,SessionCard}.tsx`

**Interfaces:**
- Consumes: `kitchenSession`, `journeyCaption` (Task 4); `RantangTrack`, `CheckRow`, `StickyAction` (Task 5); `useTrack` (Task 3); `delivery.cook` (Task 2) and the existing `delivery.depart`.
- Produces:
  - `ticks.ts`: `useTicks(catererId: string, date: string, meal: "lunch" | "dinner"): { ticked: Set<string>; toggle: (dish: string) => void }` (Ruling C11).
  - `CookingList({ session, catererId, date }: { session: KitchenSession; catererId: string; date: string })`.
  - `TodayScreen` computes `kitchenSession(state, mood-meal, now)` once and passes it down; Task 9 builds on that value.

- [ ] **Step 1: Write the failing tests** (`pinToday`):
  - the count card shows the track with caption "Terjadwal", then "Dimasak 08.10" after a reload with a preparing fixture;
  - "Daftar masak" lists one `CheckRow` per `recap.byDish` entry with its count; with no dishes it reads "Menu belum diisi" and keeps the owner's "Isi menu" button;
  - the caption "Centang hanya catatan dapur, tidak dikirim ke pelanggan." is shown;
  - ticking writes `ticks.<catererId>` with today's date; a stored tick for yesterday is not shown today and is dropped on the next write (Review Focus 5); ticks never disable an action;
  - today with a scheduled row: the footer shows "Mulai masak"; pressing opens a confirm ("Mulai masak makan siang?", "Pelanggan melihat status Dimasak.", "Batal", "Mulai"); confirming sends `delivery.cook` with `{catererId, date, meal}`, fires a `success` haptic and sends `cook_started`;
  - an `INVALID_DATE` error shows "Hanya bisa untuk hari ini." in the footer caption, selectable;
  - with no scheduled row and a preparing one, the footer shows "Berangkat antar · {portions} porsi" with the Ruling C5 caption; confirming ("Berangkat antar sekarang?", "Batal", "Berangkat") sends `delivery.depart` and `depart_tapped`;
  - tomorrow's date shows the checklist and no footer action;
  - a double press while the command runs sends one command (`busy`).
- [ ] **Step 2:** `npm test -w apps/caterer -- kitchen-loop`. Expected: FAIL.
- [ ] **Step 3: Implement.** The track goes in `CountCard` under the counts with labels `[t("Dimasak","Cooking"), t("Diantar","On the way"), t("Sampai","Arrived")]`. `CookingList` replaces the "Yang dimasak" list in `SessionCard`; the "Per paket" list, "Menu belum diisi" lines, "Bagikan" and "Cetak" stay. Rows use the dish photo or the meal icon (`sunny-outline` for lunch, `moon-outline` for dinner). The footer goes into `Screen`'s `footer`.
- [ ] **Step 4:** Run the caterer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(dapur): cooking checklist, Mulai masak and Berangkat antar with the rantang track`

---

### Task 9: Dapur delivery order and done state (after Task 8)

**Files:**
- Create: `apps/caterer/src/today/DeliveryOrder.tsx`
- Modify: `apps/caterer/src/today/{TodayScreen,SessionCard}.tsx`, `apps/caterer/tests/kitchen-loop.test.tsx`

**Interfaces:**
- Consumes: `KitchenSession`, `kitchenDayDone`, `routeMapsUrl`, `routeShareText` (Task 4 and existing); `StopRow` (Task 5); the existing `ExceptionSheet`.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests:**
  - "Urutan antar" shows the first three stops as `StopRow`s (number, name, "{n} porsi · {package}", address) and "Lihat {n} alamat lainnya" reveals the rest;
  - each map button opens that stop's `mapsUrl`; "…" opens `ExceptionSheet` for that stop and is labelled "Laporkan masalah atau pindah hari" (Ruling C7);
  - "Buka semua di Peta" opens `routeMapsUrl(...).url`; with 12 stops it reads "Buka 10 alamat pertama di Peta" (Ruling C8);
  - "Bagikan rute ke WhatsApp" still shares the route text;
  - before departure the order sits below the checklist (Ruling C6); after departure the checklist is gone, the header meta reads "Sedang diantar", the track reads "Berangkat {jam}", and the footer line reads "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya.";
  - with `kitchenDayDone` true, the body shows "Semua beres hari ini" with "Semua antaran tercatat sampai." and a "Lihat besok" button that switches the date to tomorrow; an open issue keeps the sessions instead.
- [ ] **Step 2:** `npm test -w apps/caterer -- kitchen-loop`. Expected: FAIL.
- [ ] **Step 3: Implement.** Stage changes swap the body through `FadeSwap` keyed by the session stage. The stop list moves out of `SessionCard` into `DeliveryOrder`.
- [ ] **Step 4:** Run the caterer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(dapur): numbered delivery order, map links and the done state`

---

### Task 10: DESIGN.md, end-to-end check and emulator gate

**Files:**
- Modify: `DESIGN.md` (Native motion: rantang stage, story open, checklist tick, Mulai masak and Berangkat antar; components; Dapur Hari ini; usage counts privacy line; rulings C1 to C14 in the dated owner-decisions section)
- Create: `anti-slop/audit-004-2026-10-09.md`, screenshots under `output/native-review/visual-c/`

**Interfaces:** consumes everything above.

- [ ] **Step 1:** Update DESIGN.md to match what shipped. No em dashes.
- [ ] **Step 2:** Run `npm run typecheck`, `npm test`, `npm run build`, both native suites, `npm run test:postgres` and `npx expo install --check` in both apps. Record the counts.
- [ ] **Step 3: End-to-end in demo mode** (spec 12): Dapur taps "Mulai masak" and the customer track shows "Dimasak" after a reload; "Berangkat antar" makes it "Berangkat {jam}"; after the cutoff the Beranda rings are covered until each part is viewed. If the demo has no delivery today or tomorrow, create one through the apps' own purchase flow; never edit seed data to fake a state. Record what could not be exercised.
- [ ] **Step 4: Emulator gate** in four looks (light and dark by `adb shell cmd uimode night yes|no`, Siang and Malam) for Beranda, the story, Dapur Hari ini cooking, delivering and done; plus font scale 1.3, a 360dp width, reduced motion, and TalkBack labels on the track, story, checklist and stop rows. Write the antislop Delivery Gate as PASS/FAIL with evidence to `audit-004`. Any FAIL is fixed inside this plan before the gate passes.
- [ ] **Step 5: Commit**: `docs(native): daily loop in DESIGN.md and the Phase C gate`
