# Native purchase and renewal beats (Phase D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instruction, 2026-10-09; applies to every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui` and `antislop:antislop-layoutmobile`, and apply them. antislop's mode is resolved as **after (session override)**: do not ask the mode question. Every task review and re-review runs the antislop design check (core, ui, layoutmobile, plus DESIGN.md) on its UI hunks.
>
> **Models and process (owner instruction, 2026-10-10):** each task's **Builder** line names the model that builds it the first time. Every reviewer is `opus`; never `haiku`. When a review returns findings, fix round 1 goes to a fresh `opus` implementer in the same worktree, which then owns the task and is resumed for rounds 2 to 5. The final fix wave runs on `opus`. Tasks are scheduled by their **Depends on** lines with no wave barriers and merged as soon as their own review is clean. Implementers end their reports with **Doc facts**; one `opus` dispatch writes DESIGN.md after the last merge (Task 6).

**Goal:** Give the customer app its purchase and renewal beats: a real plan detail screen behind every plan link, a one-time "Paket selesai" recap that leads to renewal, and a payment success screen that shows the food, the first delivery and the reserved dates, so that a paid customer always lands forward, never back in checkout.

**Architecture:**
- Demo (`packages/backend/src/demo-states.ts`): synthetic, date-relative demo records that reach every state this plan and the Phase C carry-overs need. Demo database only.
- Domain (`packages/domain/src/plan.ts`, a leaf module): `planDetail`, `recapCandidates` and `paidSummary` turn the existing customer read and checkout read into screen data. No backend schema change: `Subscription`, `Quote.dates`, `Checkout.subscription_id` and `renewalDefaults` already carry everything.
- Customer app: `src/plan/PlanDetail.tsx` behind `app/subscriptions/[id].tsx`; `src/today/RecapCard.tsx` on Beranda; `src/buy/PaidOutcome.tsx` replacing the paid branch of `PaymentOutcome`.
- No new shared component: screens compose `MoodHeader`, `Screen`, `PhotoRing`, `StickyAction`, `FadeSwap` and `useHaptic` from Phases A to C.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, expo-secure-store, PGlite demo database, Jest (jest-expo), Vitest, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-09-native-visual-identity-design.md](../specs/2026-10-09-native-visual-identity-design.md) section 9 Phase D, which points to [the October 8 spec, Phase 3](../specs/2026-10-08-native-uiux-motion-design.md) (plan detail, "Paket selesai", payment success). Earlier plans for inherited constraints: [Phase A](2026-10-09-native-theme-phase-a.md), [Phase B](2026-10-09-native-mood-phase-b.md), [Phase C](2026-10-09-native-daily-loop-phase-c.md).

## Global Constraints

**Process**
- Work on `v2`. Never stage `apps/web/tsconfig.json` or `.claude/`; stage by explicit path. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Worktree pool:** up to three long-lived worktrees at `C:\wt\1`, `C:\wt\2`, `C:\wt\3`, created once with `git worktree add <path> --detach v2` and installed once. For a task: confirm `git -C <wt> status --porcelain` is empty (never discard), `git -C <wt> switch -c task-N v2`, and run `npm ci --prefer-offline` only when `package-lock.json` differs from the commit the worktree last installed at (recorded in the ledger). Dispatch without the Agent tool's worktree isolation, with the pool path as the working directory. While a pool task runs, nothing writes in the main tree. App Jest in a worktree: `npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from the app folder.
- **Baseline first:** before Task 1, run `npm run typecheck`, `npm test`, `npm run build`, both app suites, `npm run test:postgres` and the e2e suite on the starting head, and record every existing failure in the ledger as `Baseline: <check> — <failure>`. Tasks cite baseline lines and do not debug them.
- **Reports:** each implementer writes its report (RED/GREEN evidence, commands, outputs) and ends it with **Doc facts**: one line per fact that DESIGN.md should state, as what changed, file:line, and evidence (a test name or a captured screenshot path). The task reviewer checks every fact. No task edits `DESIGN.md`.

**Inherited from Phases A to C**
- Their Global Constraints, Skill rules and Rulings apply. Native sources never read `colors`; mood colours only on mood surfaces (the header and the one hero card per screen); no literal hex in `packages/mobile-ui/src`; no `fontWeight` outside `textVariants`; hand edits only (R-33); no em dashes.
- Every operational number (dates, times, counts, money) uses tabular figures. Price copy keeps the Price Unit Rule.
- Tests that depend on today's date pin the clock: `jest.useFakeTimers({ now, doNotFake: [...] })` with the `pinToday` list (`apps/caterer/tests/today.test.tsx` lines 24 to 32), or the `buy.test.tsx` pattern for polling tests. Never hardcode a date that the real clock will pass.

**Data truth**
- Only real data: plan names, caterers, photos, dates and counts come from `Subscription`, its `snapshot` (`Quote`) and `Checkout`. No invented numbers (R-17, R-38). A count the read cannot give truthfully is not shown.
- A completed plan's past deliveries are mostly outside the customer read window (today minus 7 to plus 60), so the recap uses the subscription and its snapshot only.
- Demo mode stays explicit and synthetic (AGENTS.md). Demo states live only in the demo database, never in `supabase/migrations`, and carry the synthetic labels the seed already uses.

**Navigation**
- Paid is final: from the paid state, back and leave go to `/` with `router.replace`, never to checkout or Bayar.
- Every link that today resolves `/subscriptions/{id}` to `/jadwal` resolves to the plan detail instead, including notification and push taps through `customerLink`.

**Motion:** no new animation component. A `success` haptic once when a payment becomes paid while the screen is open, and `FadeSwap` content fades. Nothing loops; reduced motion is instant.

**Usage counts:** `plan_sheet_opened` once per plan detail open, `renew_started` on each "Lanjutkan paket" tap that leads to renewal, `purchase_confirmed_viewed` once per checkout id per app process (module-level `Set`, as in `Plate.tsx`).

**Parallel tasks:** file ownership per task is in each Files block. No task edits `apps/customer/tests/fixtures.ts`, `package.json`, lockfiles, tokens or `DESIGN.md`. Task 2 alone touches `tests/today.test.tsx`, and only its `customerLink` assertion near line 358.

### Skill rules
From `building-native-ui`: `React.use` for new context reads; `process.env.EXPO_OS` for new platform checks; inline styles unless reused; `boxShadow` only (the hero's mood shadow); error and important data text `selectable`; `useWindowDimensions`, never `Dimensions.get`; `borderCurve: "continuous"` on new rounded surfaces.
From `antislop`: R-27 loading, error and empty states on every new screen; R-34 both themes and both moods; R-25 contrast (text 4.5:1 on its own fill, including struck or dimmed text); R-26 every control acts; R-19 motion with a purpose; 48dp targets; text wraps (no truncation of names, dates or money); one accent per screen (sunrise ink); the footer action sits in `Screen`'s `footer`.

### Rulings (made 2026-10-09)
- **D1. Plan detail is a pushed screen, not a sheet.** Notification links and push taps open it cold, where a sheet has nothing under it. It uses `MoodHeader` with `onBack`. Cost if wrong: a presentation option.
- **D2. Remaining days stay plain:** "{n} hari lagi" from `remainingLabel`, no ring, bar or streak (October 8 decision 9). Cost if wrong: none.
- **D3. "Lanjutkan paket" rules.** An active full plan with `renewalDue` true, or a completed full plan with no renewal (`renewed_from` points to none), shows "Lanjutkan paket" to `/renew/{id}`. A trial shows "Lanjutkan dengan paket penuh" to `/paket/{package_id}` (the existing `TrialCard` path). An active plan that is not yet due shows no renew action. A plan already renewed shows "Sudah diperpanjang" with no action. Cost if wrong: one condition.
- **D4. The recap shows for a completed full plan that ended within the last 14 days, has no renewal, and has no `recap.{id}` key.** The key is written when the card first renders (`"seen"`), so the beat shows on one Beranda visit and stays visible until the customer leaves; "Tutup" hides it at once. Cost if wrong: a storage rule.
- **D5. The recap shows no meal count.** The read cannot count delivered meals for an old plan truthfully (R-17). It names the plan, the caterer and the date range from the snapshot. Cost if wrong: one line later.
- **D6. The reserved dates on the paid screen are wrapped chips:** the first 6 dates from `quote.dates` sorted, then "dan {n} hari lainnya". No horizontal scroll. Cost if wrong: layout.
- **D7. Paid screen actions:** primary "Lihat jadwal" (`router.replace("/jadwal")`); when `menuSelectionMode === "customer"` a secondary "Pilih menu" (`router.replace("/subscriptions/{sid}/menu")`, existing); a text button "Ke Beranda" (`router.replace("/")`). Cost if wrong: copy and order.
- **D8. The `success` haptic fires only when the stage changes to paid while the screen is open**, never when a paid checkout is merely reopened. Cost if wrong: one haptic.
- **D9. Demo states are added for the existing demo customer (Nadia Putri) and Dapur Senja, built relative to the demo database's creation day.** Tests that counted the old demo records are updated in the same task. Cost if wrong: a second demo actor later.

## Review Focus
1. **A cold notification tap on `/subscriptions/{id}` for a plan the read does not return** (cancelled, another account, stale cache): plan detail shows a truthful not-found state with a way home, never a blank screen or a crash. Pinned in Task 3.
2. **A plan already renewed** never offers "Lanjutkan paket" (detail or recap), so no duplicate renewal starts. Pinned in Tasks 2, 3 and 4.
3. **Back after paid** from every entry (fresh purchase, renewal, opened from Payments, opened from a notification) lands on `/`, never on checkout or a pay-again state. Pinned in Task 5.
4. **A paid checkout whose subscription id is not yet set** stays in "checking", never shows the paid beat early. Pinned in Task 5.
5. **The recap on a fresh install after an old completed plan** (ended 6 months ago) never appears; on a plan that ended yesterday it appears once. Pinned in Tasks 2 and 4.

## Order
Task 1 and Task 2 have no dependencies and run in parallel. Tasks 3, 4 and 5 depend on Task 2 (and on Task 1 for their demo states in the gate) and run in parallel. Task 6 runs after all merges.

---

### Task 1: Synthetic demo states

**Files:**
- Create: `packages/backend/src/demo-states.ts`, `tests/demo-states.test.ts`
- Modify: `packages/backend/src/database.ts` (apply the states once, after the seed and the existing fixtures, in demo only), any existing test that counts the demo customer's subscriptions or deliveries

**Interfaces:**
- Consumes: `DEMO_ACTORS`, `CATERER_IDS`, `PACKAGE_IDS`, `ADDRESS_ID`, `localDay`, `addDays` from `seed.ts`; the real `checkout.create` and `checkout.demo_pay` commands where a state can be reached through them.
- Produces: `export function demoStatesSQL(today: string): string` and these named states, each reachable after `createDemoDatabase()`:
  - `renewDue`: an active full plan for Nadia with `remaining` of 2 or 3 and no renewal.
  - `renewed`: an active full plan that another non-cancelled subscription renews.
  - `trialActive`: an active trial plan.
  - `completedRecent`: a completed full plan that ended yesterday, no renewal.
  - `completedOld`: a completed full plan that ended 180 days ago.
  - `paidLong`: a paid checkout with more than 6 reserved dates and a `subscription_id`.
  - `paidMenuChoice`: a paid checkout whose offer has `menuSelectionMode: "customer"`.
  - `paidPending`: a checkout whose read is `paid` with `subscription_id: null` (if the database cannot hold that state, the test documents it and Task 5 covers it in Jest only).
  - Phase C carry-overs: `kitchenToday`: a Dapur Senja delivery for Nadia today, lunch and dinner `scheduled`, no open report, plus at least three more stops from synthetic customer records so "Lihat {n} alamat lainnya" shows; `autoArrived`: a delivery yesterday with `confirmed_by = 'auto'` and a `confirmed_at`.

**Depends on:** none.

**Builder:** `sonnet`

- [ ] **Step 1: Write the failing test** `tests/demo-states.test.ts`: after `createDemoDatabase(true)`, for each named state, query the database through `localRpc` as the demo customer (or owner for kitchen states) and assert the shape listed above (status, remaining, renewal link, dates relative to `localDay()`, `confirmed_by`). Assert every synthetic customer record and address carries the seed's synthetic wording.
- [ ] **Step 2:** `npx vitest run tests/demo-states.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `demoStatesSQL(today)` with real commands where they reach the state and direct demo-only inserts where they cannot (completed and old plans, auto arrival). Apply it in `database.ts` behind the same guard style as the other demo blocks, after the seed and fixtures.
- [ ] **Step 4:** `npx vitest run tests/demo-states.test.ts`, then `npm test`, both app suites and `npm run typecheck`. Update any test that counted the old demo records. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(demo): synthetic states for renewal, payment and the kitchen loop`

---

### Task 2: Domain plan, recap and paid summaries

**Files:**
- Create: `packages/domain/src/plan.ts`, `tests/plan.test.ts`
- Modify: `packages/domain/src/index.ts` (one `export * from "./plan"` line)

**Interfaces:**
- Consumes: `Subscription`, `Checkout`, `Quote`, `Offer` (index.ts), `upcomingRows`, `UpcomingRow`, `renewalDue`, `dayLabel`, `jakartaDay`, `menuCoverImage`.
- Produces:
  - `export type PlanAction = { kind: "renew"; href: string } | { kind: "trial"; href: string } | { kind: "renewed" } | { kind: "none" };`
  - `export type PlanDetail = { sub: Subscription; offer: Offer; status: "active" | "completed" | "other"; remaining: number; startsOn: string; endsOn: string; upcoming: UpcomingRow[]; action: PlanAction };`
  - `export function planDetail(state, id: string, now: Date, locale: "id" | "en"): PlanDetail | null` (state is the type `todayPlates` takes; `upcoming` is `upcomingRows` restricted to this plan's deliveries, at most 5).
  - `export function recapCandidates(state, now: Date): Subscription[]` (Ruling D4 without the storage check).
  - `export type PaidSummary = { subscriptionId: string; offerName: string; caterer: string; image: string; firstDate: string; dates: string[]; more: number; menuChoice: boolean };`
  - `export function paidSummary(checkout: Checkout): PaidSummary | null` (null unless `state === "paid"` and `subscription_id` is set; `dates` is the first 6 of the sorted `quote.dates`, `more` the rest; image is `menuCoverImage(quote.offer.menus?.[0] ?? null, quote.offer.image ?? "")`).

**Depends on:** none.

**Builder:** `sonnet`

- [ ] **Step 1: Write the failing tests** in `tests/plan.test.ts`:
  - `planDetail`: null for an unknown id; `upcoming` holds only this plan's rows, at most 5, in date order; `action` is `renew` with href `/renew/{id}` for an active full plan with `remaining <= 3` and no renewal; `none` for an active plan with 10 remaining; `trial` with href `/paket/{package_id}` for a trial; `renewed` when another non-cancelled subscription has `renewed_from === id` (Review Focus 2); `renew` for a completed full plan with no renewal.
  - `recapCandidates`: includes a completed full plan that ended yesterday (Jakarta); excludes one that ended 15 days ago, a trial, a renewed plan, an active plan and a cancelled plan (Review Focus 5).
  - `paidSummary`: null for `pending`, and for `paid` with `subscription_id: null` (Review Focus 4); sorts `quote.dates`, keeps 6 and reports `more`; `menuChoice` follows `menuSelectionMode === "customer"`; falls back to the package photo.
- [ ] **Step 2:** `npx vitest run tests/plan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `plan.ts` as a leaf module (type-only imports from `./index`; runtime imports only from leaf modules, with no import cycle).
- [ ] **Step 4:** `npx vitest run tests/plan.test.ts`, `npm test`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(domain): plan detail, recap candidates and paid summary`

---

### Task 3: Plan detail screen and plan links

**Files:**
- Create: `apps/customer/src/plan/PlanDetail.tsx`, `apps/customer/tests/plan.test.tsx`
- Modify: `apps/customer/app/subscriptions/[id].tsx` (render `PlanDetail` instead of the redirect), `apps/customer/src/links.ts:73` (`subscriptions` resolves to `/subscriptions/{id}`), `apps/customer/src/account/Akun.tsx:155-160` (plan rows push `/subscriptions/{id}`), `apps/customer/tests/account.test.tsx:682`, `apps/customer/tests/today.test.tsx:358`

**Interfaces:**
- Consumes: `planDetail`, `PlanAction` (Task 2); `MoodHeader`, `Screen`, `StickyAction`, `PhotoRing`; `useTrack`; `remainingLabel`; `photoUri`.
- Produces: the route `/subscriptions/{id}` renders the plan detail.

**Depends on:** Task 2.

**Builder:** `opus`

**States:**
- Loading: "Memuat paket…" / "Loading plan…" (Jest: pending `customer()` promise).
- Error: "Belum bisa memuat" with "Coba lagi" (Jest: rejected read).
- Not found: "Paket tidak ditemukan." with "Ke Beranda" (Jest: unknown id; Review Focus 1).
- Empty upcoming: "Tidak ada antaran mendatang." (Jest: plan with no future deliveries; demo `completedRecent`).
- Active, due for renewal: footer "Lanjutkan paket" (demo `renewDue`).
- Active, not due: no footer (Jest).
- Renewed: line "Sudah diperpanjang", no button (demo `renewed`).
- Trial: "Lanjutkan dengan paket penuh" (demo `trialActive`).
- Completed: hero reads "Paket selesai" with the date range (demo `completedRecent`).
- Offline cache: the same screen from the cached read with no renew action (Jest).
- Large text (font scale 1.3) and 360dp: names, dates and the footer wrap (gate).
- Light/dark × Siang/Malam: header and hero are mood surfaces; the list reads theme tokens (gate).

- [ ] **Step 1: Write the failing tests** (clock pinned) for every state above that names Jest, plus:
  - header: `MoodHeader` with back, title = package name, meta = caterer; the hero card (mood hero) shows the package photo and "{n} hari lagi" for an active plan;
  - "Berikutnya" lists up to 5 upcoming meals of this plan only, each with its photo (`PhotoRing` 60, lunch sunrise, dinner forest), day label and dishes;
  - "Lanjutkan paket" pushes `/renew/{id}` and sends `renew_started`; trial pushes `/paket/{package_id}`;
  - `plan_sheet_opened` is sent once per open;
  - `customerLink("/subscriptions/s-1")` returns `/subscriptions/s-1` and `/subscriptions/s-1/menu?...` still returns the menu route; Akun's plan row pushes `/subscriptions/{id}`.
- [ ] **Step 2:** Run `apps/customer` Jest for `plan`, `account` and `today`. Expected: FAIL.
- [ ] **Step 3: Implement.** Data comes from `runtime.api.customer()` through `useData` with the key `plan:customer`. English through `t(id, en)`: "{n} days left", "Plan finished", "Coming up", "No upcoming deliveries.", "Continue this plan", "Continue with the full plan", "Already renewed", "Loading plan…", "Couldn't load yet", "Try again", "Plan not found.", "Go to Beranda".
- [ ] **Step 4:** Full customer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(customer): plan detail behind every plan link`

---

### Task 4: "Paket selesai" recap on Beranda

**Files:**
- Create: `apps/customer/src/today/RecapCard.tsx`, `apps/customer/tests/recap.test.tsx`
- Modify: `apps/customer/src/today/Beranda.tsx` (render the recap; make `PackageLine` a `PressableScale` row to `/subscriptions/{id}`)

**Interfaces:**
- Consumes: `recapCandidates` (Task 2); `useTrack`; SecureStore with `runtime.storageKey("recap.<id>")`.
- Produces: nothing for later tasks.

**Depends on:** Task 2.

**Builder:** `opus`

**States:**
- Key not yet read: nothing renders, no flash (Jest).
- Shown: card above the plan lines (demo `completedRecent`).
- Already seen: no card (Jest: key holds "seen").
- Dismissed: "Tutup" hides it at once (Jest).
- Not eligible: renewed, trial, ended 15 or 180 days ago (Jest; demo `completedOld`, `renewed`, `trialActive`).
- Offline cache: the card can show from the cached read; "Lanjutkan paket" still navigates (Jest).
- Large text and 360dp: name, caterer and date range wrap; both buttons stay 48dp (gate).
- Light/dark × Siang/Malam: the card is a body card on theme colours, not a mood surface (gate).

- [ ] **Step 1: Write the failing tests** (clock pinned; SecureStore mocked) for every Jest state above, plus:
  - the card shows the package photo, "Paket selesai", "{nama paket} · {katerer}", "{tanggal mulai} – {tanggal selesai}", "Lanjutkan paket" (pushes `/renew/{id}`, sends `renew_started`) and "Tutup";
  - the card writes `recap.{id}` = "seen" on first render;
  - each live plan line is a 48dp-or-taller button labelled "{nama paket}, lihat detail paket" that pushes `/subscriptions/{id}`.
- [ ] **Step 2:** Run `apps/customer` Jest for `recap`. Expected: FAIL.
- [ ] **Step 3: Implement.** Radius 20, photo left. English: "Plan finished", "Continue this plan", "Close", "{package}, see plan details".
- [ ] **Step 4:** Full customer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(customer): a one-time Paket selesai recap that leads to renewal`

---

### Task 5: Payment success

**Files:**
- Create: `apps/customer/src/buy/PaidOutcome.tsx`
- Modify: `apps/customer/src/buy/PaymentOutcome.tsx` (paid branch renders `PaidOutcome`), `apps/customer/src/buy/PaymentScreen.tsx` (leave and back after paid), `apps/customer/tests/buy.test.tsx`

**Interfaces:**
- Consumes: `paidSummary` (Task 2); `MoodHeader`, `Screen`, `StickyAction`, `FadeSwap`, `useHaptic`; `useTrack`; `dayLabel`, `photoUri`.
- Produces: nothing for later tasks.

**Depends on:** Task 2.

**Builder:** `opus`

**States:**
- Checking: a `paid` read with `subscription_id: null` stays "checking" (Jest; demo `paidPending` if Task 1 can hold it; Review Focus 4).
- Paid, short plan: all dates as chips, no "lainnya" line (Jest).
- Paid, long plan: 6 chips then "dan {n} hari lainnya" (demo `paidLong`).
- Paid, customer menu choice: "Pilih menu" shows (demo `paidMenuChoice`).
- Opened already paid: no haptic (Jest; Ruling D8).
- Turned paid while open: one `success` haptic (Jest).
- Back after paid: `router.replace("/")` for a purchase, a renewal and a checkout opened directly (Jest; Review Focus 3).
- Demo mode: the "Bayar (demo)" path ends on this screen (gate).
- Large text and 360dp: chips wrap, no horizontal scroll (gate).
- Light/dark × Siang/Malam: the hero is the one mood surface (gate).

- [ ] **Step 1: Write the failing tests** (the `buy.test.tsx` clock and server helper) for every Jest state above, plus:
  - the paid screen shows header title "Pembayaran diterima"; a hero card (mood hero, photo radius 20) with the food photo, the package name and caterer, "Antar pertama {hari, tanggal}"; the date chips; and "Jadwal antar Anda sudah tersimpan.";
  - buttons per Ruling D7;
  - `purchase_confirmed_viewed` is sent once per checkout id.
- [ ] **Step 2:** Run `apps/customer` Jest for `buy`. Expected: FAIL.
- [ ] **Step 3: Implement.** The paid body enters through `FadeSwap` keyed by stage. Date chips are plain text in the `Chip` look (not buttons), tabular figures, wrapped. Hardware back uses `BackHandler` only while paid. English: "Payment received", "First delivery {day, date}", "and {n} more days", "See schedule", "Choose menu", "Go to Beranda".
- [ ] **Step 4:** Full customer suite and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(customer): payment success shows the food, the first delivery and the reserved days`

---

### Task 6: Gate, DESIGN.md and evidence

**Depends on:** Tasks 1 to 5.

**Builder:** `opus`

- [ ] **Step 1:** As soon as Tasks 3 to 5 merge, a read-only emulator gate check on the merged head covers every gate state listed in Tasks 3, 4 and 5, using the Task 1 demo states. It also runs the Phase C carry-overs: the customer half of the cook and depart end-to-end on `kitchenToday` (Dapur taps "Mulai masak", the customer hero shows "Dimasak {HH.MM}" after a reload; then "Berangkat antar" and "Berangkat {HH.MM}"), "Lihat {n} alamat lainnya", and "Tercatat sampai" on `autoArrived`. Failures go back to the owning task's Opus fixer.
- [ ] **Step 2:** One `opus` dispatch writes the DESIGN.md changes from the approved Doc facts and the ledger rulings, stating nothing the facts do not support; one scoped re-review.
- [ ] **Step 3:** `npm run typecheck`, `npm test`, `npm run build`, both native suites, `npm run test:postgres`; write `anti-slop/audit-005-2026-10-10.md` with the Delivery Gate as PASS/FAIL with evidence; commit `docs(native): renewal beats in DESIGN.md and the Phase D gate`.
