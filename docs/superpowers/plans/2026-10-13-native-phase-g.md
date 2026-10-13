# Native feedback, restrained palette, calmer motion and customer-confirmed delivery (Phase G build) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Skill lines (owner instructions; the controller pastes the matching line into the prompt of every task, reviewer, fixer and gate agent):**
>
> - **SL-UI** (every task marked UI): before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `apple-design` (iOS), `material-3` (Android; it is **not installed** on this machine, so say so in the report), `design-taste-frontend` (general rules only: skeletons over spinners, motivated motion, contrast, a copy self-audit, no em dashes; its section 13 scopes native mobile out, so apply none of its web stack), `impeccable` (run its context step once per session with `--target` set to the app or package being changed) and `antislop:antislop-human`, and apply them. antislop's mode is **after (session override)**: never ask the mode question.
> - **SL-COPY** (every task marked COPY, which is also UI): SL-UI plus `humanizer` and `antislop:antislop-copywriting`. Copy is Indonesian first, English through `t(id, en)`, "kamu" in both apps, no em dashes, no invented numbers.
> - Data-only tasks (G3, G4, G5 server side, G13 server side) carry `antislop:antislop` and `antislop:antislop-code` only.
>
> **Models and process (owner instruction):** each task's **Builder** line names the first builder. Builders are Sonnet; the two data tasks that change tenant-authorized state (G3, G13) are Opus first builds with the written reason in the ledger. Every fixer, reviewer and gate agent is Opus. Never Haiku. A review finding sends the task to a fresh Opus fixer that owns rounds 2 to 5. Tasks run by their **Depends on** lines with no wave barriers, at most three at once in the pool worktrees, and merge as soon as their own review is clean. The controller stays quiet: no idle status turns, it reads return contracts, and it runs checks in the background. Implementers end their reports with **Doc facts**; one Opus dispatch writes DESIGN.md in G20.
>
> **Session budget (2026-10-12):** this plan is the G-b session. One fresh session per sub-phase; compact or hand off near 150k context; write the handoff file in `docs/superpowers/handoffs/` at the end; record the weekly usage percentage before and after in the ledger.

**Goal:** Land the owner's eleven pieces of feedback and the Phase G decisions: the K palette and the "even slower" motion in tokens, a busy `Button`, `ConnectionBanner`, `FormError` and shared `ReadError`, a four-stop tracker with glyphs, a calendar sheet, the caterer marking Sampai with a proof photo while the customer confirms, per-stop Berangkat and Sampai in Dapur, push at the event, Data akun, address delete and move, the copy pass, and the G1 fixes.

**Architecture:**
- `packages/design-tokens` carries the K palette (`nativeThemes`, `nativeMood` with `heroWarn`, `heroEdge`, `stopActive`), the new `nativeMotion`, and `nativeArt.successDisc` pinned to `#FFEFD9`; `apps/web/src/lib/motion.ts` changes with it.
- `packages/mobile-ui` gains `Button busy`, `FormError`, `ConnectionBanner`, `ReadError`, `CalendarSheet`, the four-stop `RantangTrack`, and the shared Pengaturan (with Data akun rows).
- Delivery state is one new migration set: `arrived_at`, `arrived_by`, `arrived_photo`, `delivery.arrive`, `delivery.depart` subsets, auto-confirm; push is dispatched with `after()` plus a backstop; account commands `profile.update` and the mobile deletion request; `address.delete` and `address.replace`.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57, react-native-screens 4.26, Reanimated 4, `@react-native-community/netinfo` (new), `@react-native-community/datetimepicker` (present, unused), Next.js (read `node_modules/next/dist/docs/` before touching `apps/web`), Supabase SQL migrations, Jest (jest-expo), Vitest, the PostgreSQL concurrency suite, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-13-native-phase-g-design.md](../specs/2026-10-13-native-phase-g-design.md) (sections 1 to 14). Inputs: [kickoff](../kickoff/phase-g.md), [ledger](../../../.superpowers/sdd/2026-10-12-native-phase-g/progress.md), [audit 009](../../../anti-slop/audit-009-2026-10-12.md), the canvas `output/native-review/phase-g/canvas/index.html`, `output/native-review/phase-g/palette/directions-v2.{json,md}` (direction K), `output/native-review/phase-g/motion/relaxed-motion.md`, the two copy audits. Inherited: the Phase A to F plans and their rulings.

## Global Constraints

**Process**
- Work on `v2` in the main tree `D:\Project\Catera\catera`. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/` or `catera-phase-f-artwork.zip`; stage by explicit path. Commit messages end with the attribution line the session's commit reminder gives; this plan names no model in any file.
- **Pool:** worktrees `C:\wt\1`, `C:\wt\2`, `C:\wt\3` (create with `git worktree add C:\wt\N v2 --detach` and `npm ci --prefer-offline` in each if they do not exist). Per task: `git -C <wt> status --porcelain` empty, `git -C <wt> switch -c task-N v2`; rerun `npm ci --prefer-offline` only when `package-lock.json` changed since that worktree's last install. App Jest in a worktree: `npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from the app folder.
- **Merge:** rebase the task branch on the current `v2`, re-check `v2` right before merging, then `git -C D:\Project\Catera\catera merge --ff-only task-N`.
- **Baseline first:** before the first task, run `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites and `npm run test:postgres` on `v2` and record each failure as `Baseline: <check>: <failure>` in the ledger.
- Reports end with **Doc facts** (what changed, file:line, evidence). No task edits `DESIGN.md` except G20.
- Shared files: `package.json` and lockfiles belong to G6a only (`@react-native-community/netinfo`); no other task adds a dependency. `packages/mobile-ui/src/index.ts`, `packages/mobile-core/src/index.ts`, `apps/*/tests/fixtures.ts`, `packages/backend/src/database.ts` (the migration list) and each app's `app/_layout.tsx` are append-or-edit by several tasks; resolve append-only conflicts on rebase, never by dropping the other task's lines.
- **Migrations:** never edit an applied migration. New files use timestamps after `20261011090000` (this plan reserves `20261014090000` to `20261014190000`), and each is registered in `packages/backend/src/database.ts` the way `20261008102000_delivery_depart.sql` is.
- Next.js has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching `apps/web`.
- AGENTS.md applies: tenant authorization and entitlement changes stay in database transactions; no production storage replaced by demo data; demo mode explicit and synthetic ("Demo (data contoh)"); no secrets, no real customer fixtures.

**Copy and content**
- The glossary and final wording are the table in spec section 6. New copy in any task uses it from the start. "Anda" never appears in a new string. The noun for a delivery is "pengantaran".

**Palette and motion (spec sections 2 and 3)**
- Colours come from tokens only. After G7, `sunrise` and `sunriseInk` are read only by the tracker's current stop (`stopActive`), `nativeArt`, the confetti file and the launch hand-off sparkles. Forest fills only the primary button and marks selection. A saved heart is forest.
- `nativeMotion`: control 200, selection 340, content 440, feature 680 ms; ease `(.33, 1, .68, 1)`; spring damping 22 stiffness 120. Transform and opacity only. Instant under reduced motion. Loops only while waiting (mascot, skeleton). The tracker never loops (D3). Decision A holds.
- Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2; Dapur ENERGY 1 / RHYTHM 1 / MOTION 2.

**Artwork truth**
- Apps import only `packages/brand/assets/phase-f/runtime/` (plus the splash marks and `confetti.json`). Everything is a processed derivative, never a master; rig layers are never trimmed. No recolour of the art.

**Verification limit**
- Android emulator `Catera_Pixel8_API36` in Expo Go with the demo backend (`CATERA_V1_DEMO=true CATERA_DEMO_DATA_DIR=<fresh dir> npm run dev`; Metro per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`, `expo start --go --android`). Boot: `emulator -avd Catera_Pixel8_API36 -no-boot-anim -no-snapshot-save -gpu auto`, `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`. 360dp is `adb shell wm size 945x2100` at 420 dpi (reset after); font scale 1.3 is `adb shell settings put system font_scale 1.3`; reduced motion is the three animator scales at 0. No Mac: iOS is checked through option values in Jest and listed NOT VERIFIED. Real push, real SMS, the hosted scheduler and the native splash are NOT VERIFIED until their inputs exist.

## Review Focus

1. **Arrive races.** `delivery.arrive` against a customer confirm, against a report being filed, twice, and against auto-confirm with a late report. Expected: exactly one final state, an open report always blocks auto-confirm, a second arrive is a no-op that returns the stored `arrived_at`, and no meal is ever `delivered` without `confirmed_by` set. Tests in G3 (unit, demo, PostgreSQL).
2. **Proof photo access.** A customer reads only their own stops' photos, a caterer's staff read only their caterer's, and another tenant reads none. Expected: storage policy and signed-URL tests for all four roles. Test in G3.
3. **Subset departure.** Two staff departing overlapping subsets, ids from another caterer, date or meal, and a customer with two packages. Expected: no id outside the caterer, date and meal is touched; each customer gets one push per stage change. Tests in G3 and G5.
4. **Busy button.** A fast response must not flash the spinner; a slow one shows it once and keeps width and height; a second press while busy sends nothing. Expected: fake-timer tests at 149 and 150 ms, and a double-press test, in G6a.
5. **Palette spend.** Every look passes the 156 pairs; Sunrise appears only where the guard allows; dark `forest` consumers still read. Expected: the contrast test, the Sunrise-spend guard test, and the four-look contact sheet at the G7 gate.
6. **Tracker.** Four stops, a glyph each, no loop, nothing on first paint, instant under reduced motion; arrived-unconfirmed and Gagal diantar are visibly different from the normal stops and say so in words. Expected: component tests and emulator captures in G6c and the final gate.
7. **Sheet focus.** TalkBack double tap on Ada masalah lands on the sheet title; Kirim laporan is visible and tappable at the form detent with the tab bar present. Expected: capture of the focus ring on the title and of the button, in G1b.
8. **Deletion with a running plan.** The request is sent and the sheet names the running plans without promising a time. Expected: component test and capture in G8.
9. **Copy.** No "Anda" in a customer string, no "antaran" as a noun, no "katerer", no "Pembantu" label, no em dash, no loose danger caption. Expected: scripted scans in G18 plus the Opus copy review.

## Order

1. **Baseline** and pool (Global Constraints), then G7, G3 and G17a start at once.
2. G7 merged → G6a, G6c and G1b. G3 merged → G5. G7 and G1b merged → G6b.
3. G1a, G4, G13 and G15 have no dependencies; they fill free slots in any order.
4. G3, G4, G6a, G6b, G6c, G7, G17a and G1b merged → G8 and G9.
5. G5, G8, G9, G13 and G15 merged → G18. G8 and G9 merged → G17b.
6. Everything merged → G20.

---

### Task G17a: Shared Pengaturan (parked item M4)

**Skill line:** UI

**Files:**
- Create: `packages/mobile-ui/src/settings/Pengaturan.tsx`, `packages/mobile-ui/src/settings/ChoiceSheets.tsx`
- Modify: `packages/mobile-ui/src/settings/SettingsRows.tsx`, `packages/mobile-ui/src/index.ts`, `apps/customer/src/settings/Pengaturan.tsx` and `ChoiceSheets.tsx` (become thin wrappers or are deleted), `apps/caterer/src/settings/Pengaturan.tsx` and `ChoiceSheets.tsx` (same), the two `pengaturan.tsx` route files
- Test: `apps/customer/tests/settings.test.tsx`, `apps/caterer/tests/settings.test.tsx` (update), `packages/mobile-ui` shared test in `apps/customer/tests/pengaturan-shared.test.tsx` (create)

**Interfaces (Produces):** `Pengaturan({ voice: "kamu"; supporting: string; channelName: string; onSignedOut(): void; extraRows?: ReactNode })` rendering the Notifikasi, Aplikasi, Tentang and Keluar sections exactly as today, with `extraRows` slotted after Tentang so Data akun rows (G8, G9) land once. The two apps differ only in `supporting`, `channelName`, the two voice strings and the after-logout `goToTab`.

**Depends on:** none

**Builder:** sonnet

**States:** signed in and signed out; every switch state Expo Go reaches (`unavailable`); denied permission row; light and dark; font scale 1.3.

- [ ] **Step 1: Write the failing test:** `"both apps render the same Pengaturan rows from one component"`, `"the after-logout hook receives onSignedOut"`, `"extraRows render after Tentang"`.
- [ ] **Step 2:** Run both app suites. Expected: FAIL on the new test, existing settings tests unchanged.
- [ ] **Step 3: Implement** the move; keep every existing row, label, test id and behaviour. Do not change copy here (G18 does).
- [ ] **Step 4:** Both app suites, `npm run typecheck`. Expected: PASS with no snapshot churn.
- [ ] **Step 5: Commit** `refactor(native): move Pengaturan into mobile-ui`.

---

### Task G7: Tokens: palette K, motion, warning, guards

**Skill line:** UI

**Files:**
- Modify: `packages/design-tokens/src/index.ts` (`nativeThemes`, `nativeMood`, `MoodKey`, `nativeArt`, `nativeMotion`), `apps/web/src/lib/motion.ts`, `packages/mobile-ui/src/SaveHeart.tsx` (`HEART_BURST_MS`, heart colour), `packages/mobile-ui/src/MoodHeader.tsx`, `packages/mobile-ui/src/mood.tsx`, `packages/mobile-ui/src/brand/MoodArc.tsx`, `packages/mobile-ui/src/brand/MalamPattern.tsx` (delete when unused), `packages/mobile-ui/src/RantangTrack.tsx` (colours only: ink, `stopActive`), `packages/mobile-ui/src/PhotoRing.tsx` (`photoGround` fallback), `apps/customer/src/today/Plate.tsx` and `apps/caterer/src/today/TodayScreen.tsx` (scrim ramp, `heroEdge`, hero button colours), every price and `sunriseInk` consumer found by the audit step, `apps/web` motion CSS variables if they are consumed
- Test: `tests/native-contrast.test.ts`, `tests/native-motion-tokens.test.ts`, `tests/native-theme-guard.test.ts`, `tests/native-appearance.test.ts`, `apps/customer/tests/theme.test.tsx` and any test that pins an old hex (grep for `#FFEFD9`, `#0B1F16`, `#1C3A2C`, `#3A2617`, `#FDFAF3`, `#F2ECDF`)

**Interfaces:** Produces the token tables in spec 2.2 and 2.3 (exact hex), `overlayInk`, `photoGround`, `heroWarn`, `heroEdge`, `stopActive`, `nativeArt.successDisc = "#FFEFD9"` (a literal), and the motion table in spec section 3 (`control: 200, selection: 340, content: 440, feature: 680`, `ease: [0.33, 1, 0.68, 1]`, `spring: { damping: 22, stiffness: 120 }`). Consumes nothing.

**Depends on:** none

**Builder:** sonnet

**States:** all four looks (light and dark by Siang and Malam) on Beranda, Jelajah, Jadwal, plan detail, Akun, Pengaturan and Dapur Hari ini; a failed photo; a loaded photo; the sheet and the toast; reduced motion.

- [ ] **Step 1: Write the failing tests.** `native-contrast.test.ts`: assert each theme and mood hex in spec 2.2 and 2.3; add the 39 pair definitions per look (port them from `output/native-review/phase-g/scripts/palette-directions-v2.cjs`, computing from the token objects) with the rules in spec 2.5; `"the failed-photo band differs from the overlay by at most 2:1"`; `"the active tracker stop is at least 3:1 on the meal card in all four looks"`; `"a bold charcoal price is at least 4.5:1"`. `native-motion-tokens.test.ts`: the four durations and the ease string equal `webMotion`, strictly increasing, and `spring.damping / (2 * Math.sqrt(spring.stiffness))` is within 0.02 of 1. `native-theme-guard.test.ts`: `"sunrise and sunriseInk are read only by RantangTrack, nativeArt, Confetti and LaunchCover"` (a source scan with an allow-list).
- [ ] **Step 2:** `npx vitest run tests/native-contrast.test.ts tests/native-motion-tokens.test.ts tests/native-theme-guard.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the tokens. Then the audit step: list every consumer of dark `forest`, dark `cream`, `forestDeep`, `sunrise`, `sunriseInk`, `tabIndicator`, the Malam pattern and the scrim (`scrimSoft`, the 0.66 overlay). Each either stays correct under the new value or is changed here; the list goes in the Doc facts. Derive a dark `forestDeep` (pressed) with the palette script and add its pair. Prices become bold `charcoal`. The heart turns forest. The scrim becomes the K ramp. The hero and Dapur count card get `heroEdge`. Delete `MalamPattern` and its tests once no caller is left.
- [ ] **Step 4:** the three Vitest files, both app suites, `npm run typecheck`, `npm run build` (the web motion variables). Expected: PASS.
- [ ] **Step 5: Gate (Opus gate agent, emulator):** a scripted four-look contact sheet of the seven screens, sampled colours against the token table (a script, not the eye), and the Android indicator pill judged as spec 14 item 3. Record each audit 009 row 9-01 to 9-26 as PASS or FAIL with a capture.
- [ ] **Step 6: Commit** `feat(native): colour direction K, even slower motion and the warning token`.

---

### Task G3: Delivery state: arrive, subsets, auto-confirm

**Skill line:** data (`antislop`, `antislop-code`); the domain strings are COPY

**Files:**
- Create: `supabase/migrations/20261014090000_delivery_arrive.sql` (columns, `delivery.arrive`, `v1.auto_confirm_arrived`), `supabase/migrations/20261014091000_delivery_depart_subset.sql`, `tests/delivery-arrive.test.ts`, `tests/postgres-delivery-arrive.mjs`
- Modify: `packages/backend/src/database.ts` (register both), `packages/backend/src/demo-states.ts` and the demo command layer (demo `delivery.arrive` and a synthetic proof photo), `apps/web/src/app/api/v1/[...path]/route.ts` (the two commands), `apps/web/src/app/api/jobs/route.ts` (call `v1.auto_confirm_arrived`), the web workspace's delivered button in the seller operations component (`grep -rn "delivered" apps/web/src --include=*.tsx` near `seller-operations.tsx`), `packages/domain/src/customer-day.ts` (`PlateState` gains `arrived_unconfirmed`), `packages/domain/src/journey.ts` (`JourneyStage`, `mealJourney`, `journeyCaption`), `packages/domain/src/kitchen.ts` (`kitchenSession` mixed stages), `packages/domain/src/seller-operations.ts`, `tests/postgres-concurrency.mjs` (wire the new scenarios), the storage policy for `arrived_photo`
- Test: `tests/delivery-arrive.test.ts`, `tests/postgres-delivery-arrive.mjs`, `tests/delivery-depart.test.ts` (extend), `tests/journey.test.ts`, `tests/kitchen.test.ts`, `tests/customer-day.test.ts`, `tests/auto-delivered.test.ts`, `tests/postgres-auto-delivered.mjs`

**Interfaces (Produces):**
- `v1.fulfillments`: `arrived_at timestamptz`, `arrived_by uuid`, `arrived_photo text`. No new status.
- `delivery.arrive {catererId, date, meal, fulfillmentIds: string[], photos: Record<fulfillmentId, storagePath>}`: staff-checked; one transaction; `select ... for update` on the listed fulfillments; every id must belong to that caterer, date and meal and be `out_for_delivery`; Jakarta today only; every id needs a photo; idempotent (a repeat returns the stored `arrived_at`, writes nothing); queues the arrived push with dedupe key (customer, date, meal, stage `arrived`).
- `delivery.depart {catererId, date, meal, fulfillmentIds?: string[]}`: omitted means every remaining stop; a subset departs only those; ids outside the caterer, date and meal are rejected with `NOT_FOUND`; one push per customer.
- `v1.auto_confirm_arrived()`: confirms (`delivered`, `confirmed_by='auto'`) rows with `arrived_at <= now() - interval '2 hours'`, no open report, no customer "Belum" mark; called by `/api/jobs` and, when G5's scheduler is live, every few minutes. `v1.auto_deliver` stays the next-morning backstop and skips rows with an open report.
- Domain: customer hero state `arrived_unconfirmed`, caption "Ditandai sampai, menunggu konfirmasimu"; the system-closed caption "Ditandai sampai otomatis".
- Storage: a private location scoped by caterer and fulfillment; read for that customer and that caterer's staff only. Read `tests/food-upload*.test.ts` and the food upload routes first and reuse the path if it can be made tenant-scoped.

**Depends on:** none

**Builder:** opus. **Written reason (ledger):** these commands change tenant-authorized state transitions across many rows under locks and need concurrency scenarios; a first build by a faster model risks a race that only PostgreSQL scenarios catch.

**States:** one stop; many stops; a stop with an open report; a stop the customer already confirmed; a stop already arrived; a customer with two packages in one session; a late report after arrive; auto-confirm exactly at 2 hours; demo mode.

- [ ] **Step 1: Write the failing tests.** Unit: `"arrive moves selected stops from out_for_delivery and keeps the meal open"`, `"a second arrive writes nothing and returns the first arrived_at"`, `"arrive rejects ids from another caterer, date or meal"`, `"arrive without a photo for every id is rejected"`, `"depart with a subset leaves the others scheduled"`, `"auto-confirm skips an open report and a Belum mark"`, `"customer confirm after arrive sets confirmed_by customer"`, `"mealJourney reads arrived_at"`, `"kitchenSession handles mixed stages"`. PostgreSQL: arrive against customer confirm, arrive against a report being filed, double arrive, auto-confirm against a late report, two staff departing overlapping subsets, arrive against depart, and the four storage-read roles from Review Focus 2.
- [ ] **Step 2:** `npx vitest run tests/delivery-arrive.test.ts tests/delivery-depart.test.ts tests/journey.test.ts tests/kitchen.test.ts tests/customer-day.test.ts tests/auto-delivered.test.ts` and `npm run test:postgres`. Expected: FAIL.
- [ ] **Step 3: Implement** the migrations, the route wiring, the demo implementation, the domain states and strings, and the web workspace change (its button now marks Sampai with a photo and waits for the customer).
- [ ] **Step 4:** the same commands plus `npm run typecheck`, `npm test`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(delivery): caterer marks Sampai with a proof photo, the customer confirms`.

---

### Task G4: Account commands

**Skill line:** data

**Files:**
- Create: `supabase/migrations/20261014100000_profile_update.sql`, `tests/profile-update.test.ts`, `tests/postgres-profile-update.mjs`
- Modify: `packages/backend/src/database.ts`, the demo command layer (`profile.update`, simulated phone and email change, deletion request), `apps/web/src/app/api/v1/[...path]/route.ts`, `packages/mobile-core/src/` (typed client calls for `profile.update`, `phone-send`, `phone-verify`, email change, `accountRequest.create` kind `deletion` and kind `help`)
- Test: `tests/profile-update.test.ts`, `tests/postgres-profile-update.mjs`, `tests/device-unregister.test.ts` pattern for the demo

**Interfaces (Produces):** `profile.update {name}`: own row only, trimmed, 2 to 80 characters, in a transaction, `UNAUTHORIZED` when signed out. Mobile callers for the existing `auth/phone-send` and `auth/phone-verify` web routes (Supabase `phone_change`) and for an email change that relies on `double_confirm_changes`. A typed `accountRequest.create` call from mobile for `deletion` and `help` (the Dapur kitchen-details request returns its status). `updateUser({password})` with reauthentication for email accounts. Demo mode simulates each change and says so.

**Depends on:** none

**Builder:** sonnet

**States:** signed out; a name that is empty, too long, or unchanged; another user's row (rejected); a phone already in use; a wrong or expired code; demo.

- [ ] **Step 1: Write the failing tests:** `"profile.update changes only the caller's row"`, `"profile.update rejects an empty name and a name over 80"`, `"profile.update is UNAUTHORIZED when signed out"`, a PostgreSQL case where two users update at once and each keeps their own row, `"the deletion request is created once per open request"`, `"the demo simulates phone and email change without calling Supabase"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** No secrets in the repo; real SMS needs production credentials and is NOT VERIFIED.
- [ ] **Step 4:** `npx vitest run` for the new tests, `npm run test:postgres`, `npm run typecheck`, `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(account): profile.update and the mobile account-change callers`.

---

### Task G5: Push at the event, one EAS project per app

**Skill line:** data; push bodies are COPY (SL-COPY for those lines)

**Files:**
- Create: `supabase/migrations/20261014110000_push_events.sql` (new bodies for Dimasak and Sampai, dedupe key, `kamu` register, "katering"), `tests/push-events.test.ts`
- Modify: `apps/web/src/lib/push-dispatch.ts` (dispatch after the command with `after()`; the title "Catera Dapur" for caterer pushes, "Catera" for customer pushes), `apps/web/src/app/api/jobs/push/route.ts` (the backstop), `.github/workflows/push-jobs.yml` (document that it is only a fallback), `apps/customer/app.config.ts`, `apps/caterer/app.config.ts`, the root `app.json` (remove the fallback to another app's project id), `tests/app-config.test.ts`, `tests/push-dispatch.test.ts`, `tests/push-timing.test.ts`, `packages/mobile-core/src/notifications.ts` (comment only)
- Test: as listed

**Interfaces:** Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` first. A command that queues a push calls `after(() => dispatchPending(ids))`; the dispatcher claims rows so a backstop run never double-sends. Backstop: a `pg_cron` plus `pg_net` job every 5 minutes where the hosted project allows it (documented in `docs/RUNBOOK.md` as a hosted step; not applied from this repo), else the workflow. Each app config reads its own EAS project id (`extra.eas.projectId`); a config test fails when it is missing or equals the other app's id. Events: Dimasak, Berangkat, Sampai waiting for confirmation, Gagal diantar (verify it exists, add if not), Pindah tanggal by the caterer; existing pushes unchanged. Dedupe on customer, date, meal and stage.

**Depends on:** G3

**Builder:** sonnet

**States:** a command that succeeds and a dispatch that fails (backstop retries once, no duplicate); two packages for one customer; a stage repeated; the message for a customer without an account (none).

- [ ] **Step 1: Write the failing tests:** `"a command queues and dispatches its push after responding"`, `"a failed dispatch is retried by the backstop and never sent twice"`, `"one push per customer per stage for a multi-package customer"`, `"Dimasak and Sampai pushes exist with the approved bodies"`, `"caterer pushes are titled Catera Dapur and customer pushes Catera"`, `"each app config declares its own project id and the two differ"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** The real project ids come from the owner; until then the config test uses the ids already in each app config and the root fallback is removed.
- [ ] **Step 4:** `npx vitest run` for the tests, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:postgres`. Expected: PASS. Real push stays NOT VERIFIED (no development build, no FCM V1 or APNs credentials).
- [ ] **Step 5: Commit** `feat(push): send at the event, one EAS project per app`.

---

### Task G1a: Reading crash and the Impor undo toast

**Skill line:** UI

**Files:**
- Modify: `packages/mobile-ui/src/brand/MascotReading.tsx` (line 141 area), `apps/caterer/src/import/` (the row sheet route and store; `grep -rn "impor-baris" apps/caterer`), `packages/mobile-ui/src/Toast.tsx` only if the action needs a longer life
- Test: `apps/caterer/tests/import.test.tsx`, `apps/customer/tests/mascot-art.test.tsx`, a new `packages/mobile-ui` scan test in `apps/customer/tests/transform-origin.test.tsx`

**Interfaces:** `MascotReading` builds its `transformOrigin` from numbers, never from an unrounded float in a string. The row sheet's "Hapus baris ini" removes the row, shows the toast "Baris dihapus" with the action "Urungkan" (5 seconds), and "Urungkan" restores the row at its index with its edits through the import store; the row card leaves with `exitRow` and returns with `enterRow`.

**Depends on:** none

**Builder:** sonnet

**States:** motion on and off; delete then undo; delete then let the toast pass; delete the only row; delete during a save.

- [ ] **Step 1: Write the failing tests:** `"every transformOrigin in packages/mobile-ui/src/brand has at most two numeric parts"`, `"MascotReading renders with magnifierPivot y 0.8094098883572568"`, `"deleting an import row shows the undo toast"`, `"Urungkan restores the row at its place with its edits"`, `"the toast passing leaves the row deleted"`.
- [ ] **Step 2:** Run both app suites. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both suites, `npm run typecheck`. Gate (Opus, emulator, motion ON): Impor, "Susun daftar" no longer crashes; capture the reading mascot; delete a row, capture the toast, tap Urungkan, capture the restored row; TalkBack announces the toast.
- [ ] **Step 5: Commit** `fix(caterer): MascotReading transform origin and an undo toast for deleted import rows`.

---

### Task G1b: Sheet focus and the tab bar over the form detent

**Skill line:** UI

**Files:**
- Modify: `packages/mobile-ui/src/SheetHeader.tsx` (`useSheetTitleFocus`), `packages/mobile-ui/src/sheets.ts`, `packages/mobile-ui/src/nativeHeader.ts` (`sheetOptions`), `packages/mobile-ui/src/DemoStrip.tsx`, `packages/mobile-ui/src/tabBar.ts`, the customer Ada masalah sheet route and its tab-stack layout (`grep -rn "masalah" apps/customer/app`), the other tab-stack form sheets (Alamat, review, Ubah hari)
- Test: `apps/customer/tests/sheets.test.tsx`, `apps/customer/tests/report-problem.test.tsx` (update), a new focus test in `apps/customer/tests/sheet-focus.test.tsx`

**Interfaces:** `SHEET_FOCUS_FALLBACK_MS = 400` and `SHEET_FOCUS_SETTLE_MS = 250` exported from `sheets.ts` (no dependence on `nativeMotion.feature`). `useSheetTitleFocus` sends the focus event on the present `transitionEnd` and once more after the settle. While a sheet route is topmost, the demo strip and the tab bar are hidden from the accessibility tree and restored on close. Tab-stack form sheets reserve the tab bar's measured height at the bottom of their scroll content and footer.

**Depends on:** G7

**Builder:** opus (a device-driven fix with a hypothesis to prove; written reason in the ledger)

**States:** sheet opened by TalkBack double tap; by an injected tap; back; swipe; typing (detent expands); keyboard open; a cold link to `/masalah/{id}`; light and dark; font scale 1.3.

- [ ] **Step 1: Write the failing tests:** `"the fallback timer does not read nativeMotion.feature"`, `"focus is sent on present and again after the settle"`, `"the demo strip and tab bar are hidden from accessibility while a sheet is on top and restored after"`, `"the form sheet content reserves the tab bar height"`.
- [ ] **Step 2:** Run the customer suite. Expected: FAIL.
- [ ] **Step 3: Implement** the three changes in spec 4.1 and the reserve in 4.2.
- [ ] **Step 4:** Customer suite, `npm run typecheck`. **Gate (Opus, emulator):** TalkBack on, a real double tap (touch exploration through the emulator console, `adb emu event mouse`, as in the first retry) on the Ada masalah row; capture the focus ring on the title; capture "Kirim laporan" fully visible and tappable at the form detent; re-run G1 (a), (b), (c) and (e). If the title still loses focus, stop, report the failing step and the react-native-screens behaviour, and move forms with fields to a root-stack sheet only after the controller agrees (spec 4.1 fallback).
- [ ] **Step 5: Commit** `fix(native): sheet title focus after present and the tab bar clear of the form detent`.

---

### Task G6a: `Button busy`, `FormError`, `ConnectionBanner`, `ReadError`

**Skill line:** COPY

**Files:**
- Create: `packages/mobile-ui/src/FormError.tsx`, `packages/mobile-ui/src/ConnectionBanner.tsx`, `packages/mobile-ui/src/ReadError.tsx` (moved from `apps/caterer/src/ReadError.tsx`), `packages/mobile-ui/src/useBusy.ts`
- Modify: `packages/mobile-ui/src/components.tsx` (`Button`, lines near 99-157), `packages/mobile-ui/src/StickyAction.tsx`, `packages/mobile-ui/src/index.ts`, `package.json` and `package-lock.json` (`npx expo install @react-native-community/netinfo` in both apps), `apps/caterer/src/ReadError.tsx` (re-export), `apps/customer/tests/no-spinner.test.tsx`, `apps/caterer/tests/no-spinner.test.tsx`
- Test: `apps/customer/tests/busy-button.test.tsx` (create), `apps/customer/tests/connection-banner.test.tsx` (create), both `no-spinner.test.tsx`, `tests/native-theme-guard.test.ts` (the loose danger caption scan)

**Interfaces (Produces):**
- `Button({ busy?: boolean; ... })`: label replaced by a spinner in the label colour after 150 ms (`BUSY_DELAY_MS = 150`); width and height held; not pressable while busy; `accessibilityState={{ busy: true }}`; the accessible name stays the label. `useBusy(run): [busy, wrapped]` drops a press while a run is in flight.
- `FormError({ message: string; retry?: () => void })`: icon plus text on a `heroWarn` or `danger` ground rule from tokens, `accessibilityLiveRegion="polite"` on Android, `AccessibilityInfo.announceForAccessibility` on iOS.
- `ConnectionBanner({ lastSeen?: Date; onRetry(): void })`: icon, "Tidak ada koneksi", "Menampilkan data terakhir, {HH.MM}", "Coba lagi"; announced once; hides itself on reconnect (netinfo); retries on reconnect.
- `ReadError({ onRetry; ... })` shared; customer screens adopt it where nothing is cached (G8).
- The scan test fails on a bare `danger` or warning `Text` outside `FormError`, `Field error`, `ReadError` and `ConnectionBanner`.

**Depends on:** G7

**Builder:** sonnet

**States:** idle, busy under 150 ms (no spinner), busy over 150 ms, busy then done, double press, reduced motion (spinner stays), font scale 1.3, light and dark; banner online, offline, offline with no cache, reconnect; form error with and without retry.

- [ ] **Step 1: Write the failing tests:** `"busy under 150 ms never shows the spinner"`, `"busy over 150 ms shows it and keeps width and height"`, `"a pressed busy button sends nothing"`, `"busy sets accessibilityState and keeps the label as the name"`, `"the banner announces once and hides on reconnect"`, `"the banner retries on reconnect"`, `"a bare danger caption fails the scan"`, `"an ActivityIndicator is allowed only inside a busy Button, StickyAction, SettingsRow or the Menu upload tile"`.
- [ ] **Step 2:** Run both app suites. Expected: FAIL.
- [ ] **Step 3: Implement.** Install netinfo with `npx expo install` in both apps.
- [ ] **Step 4:** Both app suites, `npm run typecheck`, `npx expo install --check` in both apps. Expected: PASS.
- [ ] **Step 5: Commit** `feat(native): busy buttons, form errors and the connection banner`.

---

### Task G6b: `CalendarSheet`

**Skill line:** COPY

**Files:**
- Create: `packages/mobile-ui/src/CalendarSheet.tsx`
- Modify: `packages/mobile-ui/src/index.ts`; reads `monthWeeks` from `apps/customer/src/schedule/dates.ts` (move the pure date helpers to `packages/domain/src/dates.ts` or re-export, whichever keeps both apps importing one copy)
- Test: `apps/customer/tests/calendar-sheet.test.tsx` (create)

**Interfaces (Produces):** `CalendarSheet({ month: string; days: Record<string, { state: "available" | "current" | "unavailable"; reason?: "Penuh" | "Terisi" | "Dapur libur" | "Lewat batas waktu" }>; current: string; onPick(date): void; confirmLabel: (date) => string; onConfirm(date): Promise<void>; window: { from: string; to: string } })`. Month paging across the window; the current day outlined, the chosen day filled with a forest ring and label; unavailable days dimmed, a tap reads the reason in a caption (not a toast); tabular numerals; the button "Pindah ke {tanggal}" disabled until a new day is chosen and `busy` while `onConfirm` runs. A native form sheet at the large detent that follows G1b's result for tab-stack form sheets.

**Depends on:** G7, G1b, G6a

**Builder:** sonnet

**States:** first month; last month; a window of one month; no available day; a chosen day then a tap on an unavailable day; Indonesian and English day names; screen reader reads each cell as "{Senin 12 Okt}, {state}"; font scale 1.3 at 360dp; light and dark.

- [ ] **Step 1: Write the failing tests:** `"the button stays disabled until a new day is chosen"`, `"an unavailable day reads its reason on tap"`, `"month paging stops at the window edges"`, `"the current day is outlined and the chosen day filled"`, `"cells carry tabular numerals and an accessibility label with the state"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Customer suite, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(native): CalendarSheet`.

---

### Task G6c: Four-stop `RantangTrack`

**Skill line:** UI

**Files:**
- Create: `packages/mobile-ui/src/brand/StopGlyphs.tsx` (calendar, pot with steam, motorbike, house with check, code drawn in the `brand/Rantang.tsx` stroke style)
- Modify: `packages/mobile-ui/src/RantangTrack.tsx` (lines near 21-26, the position map), `apps/customer/src/today/Plate.tsx`, `apps/caterer/src/today/TodayScreen.tsx` (lines near 130-134, the count card)
- Test: `apps/customer/tests/daily-loop-ui.test.tsx` (update), `apps/caterer/tests/today.test.tsx` (update), `apps/customer/tests/rantang-track.test.tsx` (create)

**Interfaces:** `RantangTrack({ stage: "scheduled" | "preparing" | "out_for_delivery" | "arrived_unconfirmed" | "delivered" | "issue"; counts?: Partial<Record<Stop, number>> })` with stops at 0, 1/3, 2/3, 1. Done stops filled in `heroText`; the current stop larger with a ring in `stopActive`; later stops outlined in `heroMeta`. `arrived_unconfirmed`: Sampai half filled. `issue`: a warning stop in `heroWarn` with an alert glyph, a dashed last segment, and the words "Gagal diantar". The line fill is a `scaleX` from the left; on a stage change the fill and stop animate over `nativeMotion.feature`; no animation on first paint, refresh or tab return; no loop; instant under reduced motion. The rantang marker rides the line. The container reads "Pesanan: {stage}, langkah {n} dari 4"; stops are decorative. With `counts` (Dapur) the counts sit under the stops and the line fills to the furthest stage reached.

**Depends on:** G7

**Builder:** sonnet

**States:** each of the six stages; first paint; a stage change; mixed-stage counts; reduced motion; font scale 1.3 at 360dp; light and dark by both moods; hero with a failed photo.

- [ ] **Step 1: Write the failing tests:** `"the track has four stops at 0, a third, two thirds and the end"`, `"scheduled and preparing sit at different stops"`, `"arrived_unconfirmed half fills Sampai and says it in words"`, `"issue shows the warning stop and the words Gagal diantar"`, `"nothing animates on first paint"`, `"a stage change animates the fill with transform only"`, `"reduced motion makes the change instant"`, `"the track never starts a loop"`, `"the container reads one sentence"`.
- [ ] **Step 2:** Run both app suites. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both suites, `npm run typecheck`. Gate (Opus, emulator): drive the demo through every stage; capture the five frames plus Gagal diantar in light Siang and dark Malam; capture the Dapur count card with mixed stages; scripted contrast of the active stop.
- [ ] **Step 5: Commit** `feat(native): four-stop tracker with a glyph per stage`.

---

### Task G13: Address delete and move

**Skill line:** data for the server; UI and COPY for the sheet (SL-COPY)

**Files:**
- Create: `supabase/migrations/20261014120000_address_delete_replace.sql` (`archived_at`, `address.delete`, `address.replace`), `tests/address-delete.test.ts`, `tests/postgres-address-delete.mjs`
- Modify: `packages/backend/src/database.ts`, the demo command layer, `apps/web/src/app/api/v1/[...path]/route.ts`, `packages/domain/src/` (an `addressUse` read for "in use" counts and date range), `apps/customer/src/account/` (the Alamat list: delete, the in-use sheet, the pick-another-address sheet), `packages/mobile-ui/src/index.ts` (toast), `tests/postgres-concurrency.mjs`
- Test: as listed, plus `apps/customer/tests/alamat.test.tsx` (update)

**Interfaces (Produces):** `address.delete {addressId}` and `address.replace {fromAddressId, toAddressId}` in transactions; the caller acts only on their own addresses and delivery days. "In use": a delivery day dated today or later, not delivered or cancelled, whose address copy carries the id, or a pending checkout with that `address_id`. `address.replace` keeps the per-caterer advisory lock, the `COVERAGE` check per plan and the one-day cutoff, moves every movable day, and returns how many stayed and until when plus the kitchens whose days could not move. An unused address is soft-deleted (`archived_at`), hidden from Alamat and the pickers; paid checkouts and past deliveries still read it. Toast "Alamat dihapus". Delete and move buttons use `busy`. Editing an address is unchanged and the current behaviour (copies on upcoming days) is recorded in the Doc facts.

**Depends on:** none (the `busy` prop is wired in G8 if G6a has not merged)

**Builder:** opus. **Written reason (ledger):** a tenant-authorized multi-row move under kitchen locks that must not race `delivery.cook` or a checkout.

**States:** unused address; in use by one plan; in use by two plans with different kitchens; target outside one kitchen's area; days past the cutoff; the last address; delete racing a checkout; replace racing `delivery.cook` on the same day.

- [ ] **Step 1: Write the failing tests:** unit and PostgreSQL for each state above, including `"an address in use cannot be deleted"`, `"replace moves every movable day in one transaction and reports the days that stayed"`, `"delete racing a checkout never leaves a pending checkout without an address"`, `"replace racing delivery.cook leaves the day either moved or cooked, never both"`, and a customer test for the sheet wording "Alamat ini masih dipakai untuk {n} pengantaran, {tanggal} sampai {tanggal}.".
- [ ] **Step 2:** Run unit tests and `npm run test:postgres`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** the same plus `npm run typecheck`, `npm test`, `npm run build`, customer suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(address): delete, with a move for addresses still in use`.

---

### Task G15: "Syarat dan privasi" page

**Skill line:** COPY

**Files:**
- Create: `apps/web/src/app/syarat-dan-privasi/page.tsx` (read the Next.js guide for the app router first), `tests/terms-page.test.tsx`
- Modify: `apps/customer/src/settings/Pengaturan.tsx` and `apps/caterer/src/settings/Pengaturan.tsx` (or the shared one after G17a: the row opens the page in the in-app browser; the "Segera hadir" row and its TODO go), `tests/app-links.test.ts` if links are listed

**Interfaces:** A page whose first line says plainly that the text is a placeholder until the owner supplies the terms and privacy policy (E2). No invented legal text, no invented dates or company details. Data akun's "Hapus akun" sheet links to the privacy section (G8, G9).

**Depends on:** none

**Builder:** sonnet

**States:** the page in light and dark on the web; the row opens it in the in-app browser; offline.

- [ ] **Step 1: Write the failing tests:** `"the page renders and says it is a placeholder"`, `"both Pengaturan rows open the page and the TODO is gone"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npx vitest run`, both app suites, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): a labelled placeholder for Syarat dan privasi`.

---

### Task G8: Customer screens

**Skill line:** COPY

**Files:**
- Modify (verify line numbers first): `apps/customer/src/auth/` (Masuk, Register, Recover, AuthCallback; OTP busy button, Masuk centred is G16), `apps/customer/src/account/` (Akun header, Data akun page, AddressForm, the address delete sheet from G13), `apps/customer/src/buy/` (BuyScreen, PaymentScreen), `apps/customer/src/claim/ClaimScreen`, `apps/customer/src/help/` (HelpForm), `apps/customer/src/schedule/ChangeDaySheet.tsx` (replace `DateChips` with `CalendarSheet`), `apps/customer/src/schedule/ChooseMenu`, `apps/customer/src/today/Plate.tsx` (arrived-unconfirmed hero with the proof photo, Sudah sampai and Belum, the hero fallback from G7, the corner "⋮"), `apps/customer/src/today/Beranda.tsx` (remove the loose offline caption at lines near 464-473, adopt `ConnectionBanner`), `apps/customer/src/plan/PlanDetail.tsx` (same near 201-203), `apps/customer/src/shell.tsx` ("Coba lagi"), the review sheet, `apps/customer/app/_layout.tsx` and the route files for Data akun
- Test: the affected files under `apps/customer/tests/`, `apps/customer/tests/no-spinner.test.tsx`, `apps/customer/tests/empty-states.test.tsx`, a new `apps/customer/tests/data-akun.test.tsx`

**Interfaces:** Consumes G3 (domain states, `delivery.arrive` photo read), G4 (account callers), G6a (`Button busy`, `FormError`, `ConnectionBanner`, `ReadError`), G6b, G6c, G7, G17a (`extraRows`), G1b. Adds the Data akun page (rows in spec 5.10) opened from the Akun header and as `extraRows`; the deletion sheet names the running plans with the approved sentence and promises no timing. Adopts `busy` at every call site in spec 5.1. Non-form failures (Sudah sampai) use the error toast with "Coba lagi". The hero reads "Dapur menandai pesananmu sudah sampai. Sudah diterima?" with the proof photo beside the two buttons.

**Depends on:** G3, G4, G6a, G6b, G6c, G7, G17a, G1b

**Builder:** sonnet

**States:** every FB1 call site idle, busy, failed; offline with a cache, offline without one, reconnect; the hero in each stage including arrived-unconfirmed with a photo, with a photo that fails to load, and Gagal diantar; the calendar from Hari, the Beranda hero "⋮" and plan detail rows; Data akun for a phone account, an email account and a demo account; delete with and without a running plan; light and dark by both moods; font scale 1.3 at 360dp; signed out.

- [ ] **Step 1: Write the failing tests:** `"every awaiting command button is busy while it waits"` (table-driven over the call-site list), `"the OTP check keeps the code visible and busies Masuk"`, `"the offline copy shows the banner and no loose caption"`, `"a read with no cache shows ReadError"`, `"Sudah sampai failure shows an error toast with Coba lagi"`, `"the arrived-unconfirmed hero shows the photo, Sudah sampai and Belum"`, `"Belum opens the Belum sampai report"`, `"Ubah hari uses the calendar and disables the button until a day is chosen"`, `"Data akun hides the password row for phone accounts"`, `"Hapus akun with a running plan sends the request and names the plans"`, `"the hero with a failed photo shows the overlay ground and no pale band"`.
- [ ] **Step 2:** Run the customer suite. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Customer suite, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(customer): busy buttons, banner, calendar, Data akun and the customer-confirmed hero`.

---

### Task G9: Dapur screens

**Skill line:** COPY

**Files:**
- Modify (verify line numbers first): `apps/caterer/src/auth/` (Masuk, Daftar), `apps/caterer/src/RoleGate.tsx`, `apps/caterer/src/business/` (AktifkanScreen, PackageEditor, TimScreen, UsahaScreen, Data akun page and the "Ubah nama atau kontak dapur" request), `apps/caterer/src/customers/CustomerDetail.tsx`, `apps/caterer/src/import/` (ImportAssistant), `apps/caterer/src/menu/` (MenuWeek, MenuDayScreen), `apps/caterer/src/today/ExceptionSheet.tsx` (replace the free-text date field near lines 265-281 with `CalendarSheet`), `apps/caterer/src/today/TodayScreen.tsx` ("Urutan antar" selection mode, the proof-photo grid sheet, the footer "Berangkat semua sisa · {n} porsi", the offline attention card near lines 446-457 becomes `ConnectionBanner`), the report screen, `apps/caterer/app/` routes for the new sheets
- Test: the affected files under `apps/caterer/tests/`, `apps/caterer/tests/no-spinner.test.tsx`, a new `apps/caterer/tests/selection-mode.test.tsx`

**Interfaces:** Consumes G3, G4, G6a to c, G7, G17a, G1b. Selection mode: "Pilih", a circle per stop, the count in the title, "Pilih semua" per area, a bottom bar with "Berangkat (n)" and "Sampai (n)"; a stop past an action cannot be selected for it and shows why. "Sampai (n)" opens the proof-photo grid sheet (spec 5.9): a tile per stop with its own camera button, any order, missing photos marked, the button disabled with the reason until every tile has a photo, `busy` while the command runs, `FormError` on failure. Pindah tanggal uses `CalendarSheet` with the consequence line "Pelanggan yang memakai aplikasi diberi tahu." Step 1 decides whether `deliveryAvailability` can serve the Dapur calendar under staff authorization; if not, the task stops that part, records why, and hands a one-command staff read to a G3 Opus fixer.

**Depends on:** G3, G4, G6a, G6b, G6c, G7, G17a, G1b

**Builder:** sonnet

**States:** nothing selected; some selected; all selected; stops past an action; a session with two rounds (some departed, some left); the photo grid with 0, some and all photos; a failed upload; offline; every FB1 call site idle, busy, failed; Data akun and the kitchen-details request with its status; light and dark by both moods; font scale 1.3 at 360dp.

- [ ] **Step 1: Write the failing tests:** `"selecting stops shows the count and Berangkat (n) and Sampai (n)"`, `"a stop already departed cannot be selected for Berangkat and says why"`, `"the footer reads Berangkat semua sisa after a first round"`, `"Sampai (n) stays disabled until every selected stop has a photo"`, `"a failed photo upload keeps the other photos and shows FormError"`, `"Pindah tanggal uses the calendar"`, `"the consequence line says only customers with the app are told"`, `"every awaiting command button is busy while it waits"`, `"the offline state shows the banner"`, `"Data akun sends the kitchen-details request and shows its status"`.
- [ ] **Step 2:** Run the Dapur suite. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Dapur suite, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caterer): selection mode, proof photos, calendar, busy buttons and Data akun`.

---

### Task G18: Copy pass

**Skill line:** COPY

**Files:**
- Modify: `packages/domain/src/` (the shared status words, glossary and error map), both apps' strings, `apps/web/src/lib/push-dispatch.ts`, a new migration `supabase/migrations/20261014130000_push_copy.sql` for the push bodies that live in SQL (never edit an applied migration), `DESIGN.md` is left to G20, the asserting tests in `apps/customer/tests/` (about 22 files), `apps/caterer/tests/` (about 10 files) and `tests/`
- Test: the files above, plus a scripted scan test `tests/copy-scan.test.ts` (create)

**Interfaces:** Applies the table in spec section 6 to every old string: "Anda" to "kamu" (customer, about 45 strings, `useUnsavedGuard` gets `voice: "kamu"`, `CustomerDetail.tsx:69-71`), "katerer" to "katering", "Pembantu" and "helper" to "staf dapur" and "kitchen staff" (label only), "Menunggu Anda" to "Perlu kamu urus", "Pindah hari" to "Pindah tanggal", the noun "antaran" to "pengantaran", "ponsel" to "HP", "Simpan paket" to "Terbitkan paket" (with the toast unchanged), "Tercatat sampai" to "Ditandai sampai otomatis", "Demo (data sintetis)" to "Demo (data contoh)", the search placeholder, the review-time line kept as the owner chose, the renewal lines (E5, with the next-day form only when the start really is the next day), the two pushes that print a raw ISO date, the three unbacked claims ("1 menit", "tanpa jeda", "dari bank"), the 34 Dapur strings that stay Indonesian in English mode, the calques ("Leave to deliver now?"), and the 12 generic "Belum berhasil. Coba lagi." messages. Verbs "antar" stay. The scan test fails on an em dash, "Anda" in a customer string, "katerer", "Pembantu" as a label, the noun "antaran", "Tercatat sampai", "data sintetis" in a label, and a raw ISO date in a push body.

**Depends on:** G5, G8, G9, G13, G15

**Builder:** sonnet. **Review:** an Opus copy review of the diff with `humanizer` in both languages, before the Android gate captures the screens.

**States:** Indonesian and English modes in both apps; every push body; the renewal screen next-day and pushed-later; the error map.

- [ ] **Step 1: Write the failing tests:** `tests/copy-scan.test.ts` and the updated assertions in each affected test file, written first from the approved wording.
- [ ] **Step 2:** Run both app suites, `npx vitest run tests/copy-scan.test.ts tests/push-dispatch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** shared strings once in `packages/domain`; push bodies through the new migration and `push-dispatch.ts`.
- [ ] **Step 4:** Both app suites, `npm test`, `npm run typecheck`, `npm run build`, `npm run test:postgres`. Then the Opus copy review; fix findings in a fresh Opus fixer.
- [ ] **Step 5: Commit** `copy: kamu, katering, pengantaran and a direct voice in both apps`.

---

### Task G17b: The other parked minors

**Skill line:** UI where a screen changes

**Files:** the kickoff's G17 list for Tasks 1 to 15 and the final review, minus M4 (done in G17a): `metro.config.js:6-7` and `jest.config.cjs:2` comments in both apps; `docs/RUNBOOK.md` (Reanimated and worklets `overrides`, Jest 30 through `expo.install.exclude`, `expo` and `expo-router` tilde pins); `packages/mobile-ui/package.json` peer dependencies; the upgrade checklist; `MoodHeader` iOS `Screen` test; mascot art `expo-image`; `usage.ts` `app_open` after `me()`; the Pelanggan and Hari ini skeleton rows; the loose no-spinner scan rules; Dapur Tim bottom padding and the package-row chevron; the Menu cold-read residuals; the import phone field; the nutrition tile items; `apps/caterer/tests/fixtures.ts:20` `seq` reset; the Dapur Keluar tab-stack pop; the duplicated sign-in sentence; the `leaving` reset test
- Test: the test each item names

**Interfaces:** None new. Each item is closed with a test, a doc line, or a recorded decision. Items that need a device (Android footer anchor, iOS sheet over-clear) stay NOT VERIFIED and move to the final gate list.

**Depends on:** G8, G9

**Builder:** sonnet

**States:** per item.

- [ ] **Step 1:** Write the failing test (or the doc assertion) for each item, in the order of the kickoff.
- [ ] **Step 2:** Run both app suites and the relevant Vitest files. Expected: FAIL on the new tests only.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both app suites, `npm test`, `npm run typecheck`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `chore(native): close the parked minors`.

---

### Task G20: Gate prep, DESIGN.md, handoff

**Skill line:** COPY (the DESIGN.md dispatch)

**Files:** `DESIGN.md`, `docs/MASCOT-MOTION.md` (the heart and tracker timings), `docs/RUNBOOK.md` (the hosted scheduler step, EAS project ids, the proof photo storage), `output/native-review/phase-g/`, `docs/superpowers/handoffs/` (create the G-b handoff), `docs/superpowers/kickoff/phase-h.md` (create)

**Depends on:** all tasks above

**Builder:** opus

- [ ] **Step 1:** Full checks: `npm run typecheck`, `npm test`, `npm run build`, both app suites, `npm run test:postgres`, `node packages/brand/verify-phase-f.mjs`. Compare against the baseline lines.
- [ ] **Step 2: Android emulator gate prep** (the full device gate is G10 in the next session): run every task gate that was deferred, in light and dark (`adb shell cmd uimode night yes|no`), Siang and Malam, 360dp at font scale 1.3, reduced motion, TalkBack on the sheets, the tracker, the banner and the calendar, flight mode on and off. Record each Review Focus line as PASS or FAIL with a capture. Judge the new pace: a tap does not feel late, `LaunchCover` at 680 ms does not feel slower than the splash it follows (else move it to `content` and record it), the tracker change reads calm.
- [ ] **Step 3:** One Opus dispatch writes DESIGN.md from the approved Doc facts: the new section "Colour revision (Phase G), October 2026" (the K tables, the 156-pair result, the seven rules, the override of the palette sentence, what it supersedes), the motion section with the new durations and spring, Loading (the busy button joins the inline tier), errors (`ConnectionBanner`, `FormError`, `ReadError`), the tracker, the calendar sheet, delivery confirmation (arrived, proof photo, auto-confirm), Data akun, address delete, the copy glossary ("kamu", "pengantaran", "katering", "staf dapur"), and every string DESIGN.md quotes that changed; then one scoped re-review.
- [ ] **Step 4:** Write the antislop Delivery Gate as PASS or FAIL with evidence in `anti-slop/audit-009-followup-<date>.md`, with `impeccable` critique notes for the touched surfaces. Open items from spec section 14 are listed with their owner and input.
- [ ] **Step 5:** Write the G-b handoff and the Phase H kickoff (carry-overs: the full Android gate G10, the iOS run, the development build and real push, Masuk alignment G16, the paid "tambah porsi" top-up, the unresolved items). Record the weekly usage percentage in the ledger. Commit `docs: Phase G build gate and DESIGN.md`.
