# Twenty UX details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the remaining fitting UX details (6, 12, 13, 14, 16, 17, 18) across web and both mobile apps, review items 1 to 5 built earlier, and report all twenty.

**Architecture:** A quiet `resumed` counter beside `revision` drives background refetches in both data layers; everything else is small edits in config, CSS and shared components.

**Tech Stack:** Next.js 16 / React 19 (web), Expo SDK 57 / RN 0.86 / Reanimated 4 (mobile), vitest + jsdom, Jest (jest-expo), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-ux-details-design.md`

## Global Constraints

- No new dependencies. NetInfo (`@react-native-community/netinfo` 12.0.1) is already in both apps.
- Every animation respects reduced motion; this plan adds none.
- One item at a time; after each task run `npm run typecheck` plus the tests it touches. Full `npm test`, `npm run build` and both Jest suites run in Task 9.
- Match the surrounding style; don't reformat files that weren't Prettier-clean (`application.tsx` isn't).
- Stage only files this plan touches. Leave `output/verification/postgres.json`, `.claude/`, `catera-phase-f-artwork.zip`, `graphify-out/`, `packages/brand/vector/` alone.
- Revert the `apps/web/tsconfig.json` `include` lines that the isolated dev server (`CATERA_NEXT_DIST_DIR=.next-ux-details`, port 3290) adds.
- Never kill processes you did not start. The owner's server on :3000 stays untouched.
- Customer Jest has 3 failures on the untouched baseline (`customer-sheets` "moving a day toasts the new date", two `account` "Pilih menu" cases). They are not regressions.

## Review Focus

- A refetch on resume while a command is in flight must not overwrite the command's newer result. Task 1 and Task 2 test that a quiet reload is discarded when a revision reload starts after it.
- A quiet reload that fails offline must leave the screen and its stale banner as they were. Covered by a test in Tasks 1 and 2.
- A burst of focus, visibility and online events, or NetInfo flapping, must produce one refetch per 30s. Covered by a throttle test in Tasks 1 and 2.
- An account switch must never show the previous actor's data from a quiet reload. Mobile keys by actor; Task 1 asserts a quiet reload resolving after the identity changed is dropped.
- A hitSlop increase must not overlap a neighbouring target. Task 5 checks the neighbour gap per target.

---

### Task 1: Mobile quiet refetch on resume and reconnect

**Files:**
- Modify: `packages/mobile-core/src/provider.tsx` (state at ~126, AppState listener at ~262, context value)
- Modify: `packages/mobile-core/src/data.ts`
- Modify: `packages/mobile-core/package.json` (add `@react-native-community/netinfo: "*"` to `peerDependencies`)
- Test: `apps/customer/tests/resume-refetch.test.tsx`

**Interfaces:**
- Produces: `useMobile().resumed: number`; constant `RESUME_THROTTLE = 30_000` exported from `provider.tsx`.

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1: Write the failing tests.** Use `launch.test.tsx`'s AppState spy pattern and the setup's `NetInfo.__emit`. Fake timers.
  - `resumed` moves once on background→active, and not on the launch "active".
  - It moves once on `isConnected` false→true, and not on true→true.
  - A second trigger within 30s doesn't move it; one after 30s does.
  - `useData` with data on screen: a `resumed` change calls the loader again with `loading` staying false, and the new data replaces the old.
  - The loader rejecting during a quiet reload leaves `data` and `error` unchanged.
  - A quiet reload that resolves after a revision reload started is discarded.
  - A quiet reload that resolves after the identity changed is discarded.
  - With no data yet, a `resumed` change does nothing.
- [ ] **Step 2:** Run `cd apps/customer && npx jest tests/resume-refetch.test.tsx`. Expected: FAIL (`resumed` is undefined).
- [ ] **Step 3: Implement.**
  - Provider: `[resumed, setResumed] = useState(0)` and a `lastResume` ref. `resume()` bumps it when `Date.now() - lastResume >= RESUME_THROTTLE`.
  - Call `resume()` from the existing background/inactive→active branch.
  - Add `NetInfo.addEventListener` tracking the previous `isConnected` and calling `resume()` on false→true. Remove it in the same cleanup.
  - Put `resumed` in the context value and its type.
  - `useData`: a separate effect on `resumed` (skip the first run). It does nothing unless `state.key === identity && state.data !== null`. Otherwise it takes `request = ++generation.current` and awaits the loader. On success, while still live, it sets `{...s, data, error: "", fromCache: false}`. On failure it does nothing.
- [ ] **Step 4:** Run the new test plus `npx jest tests/launch.test.tsx tests/offline-start.test.tsx tests/connection-banner.test.tsx` in customer, and `npx jest tests/offline-start.test.tsx tests/today.test.tsx` in caterer. Expected: PASS. Run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(mobile): refetch quietly when the app returns or the network comes back`

### Task 2: Web quiet refetch on focus and online

**Files:**
- Modify: `apps/web/src/components/context.tsx` (provider state, one effect, `useResource`)
- Test: `tests/resume-refetch-web.test.tsx` (jsdom, the render pattern from `tests/claim-web.test.tsx`)

**Interfaces:** Produces `useApp().resumed: number` and the export `RESUME_THROTTLE = 30_000`.

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1: Write the failing tests.** Fake timers, mocked `fetch`.
  - `window` `focus`, `document` `visibilitychange` (visible) and `window` `online` each move `resumed`, but at most once per 30s.
  - A hidden `visibilitychange` doesn't move it.
  - `useResource` with data: a resume refetches with `loading` false and `phase` unchanged during the request.
  - A failed quiet refetch keeps the data and adds no error.
  - A quiet refetch resolving after a key change is dropped.
- [ ] **Step 2:** Run `npx vitest run tests/resume-refetch-web.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Same shape as Task 1: a `resumed` state plus a throttled `resume()`, with listeners added and removed in one effect.
  - `useResource` gets a separate effect on `resumed` (skip the first run). It runs only when `result.key === key && result.data !== null`. It uses a `live` flag cleared on cleanup and on key change.
- [ ] **Step 4:** Run the new test plus `npx vitest run tests/saved-packages.test.ts tests/claim-web.test.tsx tests/customer-action-refresh.test.ts`, then `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): refetch quietly when the tab regains focus or the network returns`

### Task 3: Predictive back

**Files:** Modify `apps/customer/app.config.ts` (android block ~26) and `apps/caterer/app.config.ts` (android block ~20). Test: `apps/customer/tests/expo-go.test.tsx` or `config.test.tsx` in caterer, whichever already loads the config.

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1:** Add the assertion `config.android.predictiveBackGestureEnabled === true` for both apps in the config test that already imports each `app.config.ts`. Run it and expect FAIL.
- [ ] **Step 2:** Add `predictiveBackGestureEnabled: true` to both android blocks. Run the test and expect PASS. Run `npm run typecheck`.
- [ ] **Step 3: Commit** `feat(native): opt into Android predictive back`

### Task 4: Web viewport covers the notch

**Files:** Modify `apps/web/src/app/layout.tsx`. Verify in the browser on :3290.

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1:** Read `node_modules/next/dist/docs` for the `viewport` export (per apps/web/AGENTS.md). Add `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }`.
- [ ] **Step 2:** On :3290, check that `document.querySelector('meta[name=viewport]').content` includes `viewport-fit=cover` and that there is exactly one viewport meta. Run `npm run typecheck`.
- [ ] **Step 3: Commit** `fix(web): viewport-fit=cover so safe-area insets apply`

### Task 5: Tap targets

**Files (verify each first):**
- `apps/customer/src/today/DayBlocks.tsx:279`
- `apps/customer/src/help/ReportList.tsx:308`
- `apps/customer/src/schedule/DishCard.tsx:100`
- `apps/customer/src/buy/PaymentScreen.tsx:397`
- `apps/customer/src/claim/ClaimScreen.tsx:312`
- `apps/caterer/src/business/UsahaScreen.tsx:55,62`
- `packages/mobile-ui/src/settings/SettingsRows.tsx:420`

Test: `apps/customer/tests/ui-foundation.test.tsx`, plus the caterer test that renders UsahaScreen.

**Depends on:** none. **Builder:** opus.

**States:** default, and large text (`fontScale` 1.3, as `ui-foundation.test.tsx` already uses).

- [ ] **Step 1:** For each spot, decide whether it is pressable. Record non-pressable ones as "badge, no change".
- [ ] **Step 2:** For each pressable one, add a test asserting `minHeight + hitSlop.top + hitSlop.bottom >= 44` (iOS) / `48` (Android), and the same for width. Also assert that half the gap to the nearest sibling target ≥ the slop on that side. Run and expect FAIL.
- [ ] **Step 3:** Raise each to target with `hitSlop` (or `useTouchTarget` where the file already uses the layout scale). Run and expect PASS. Run `npm run typecheck`.
- [ ] **Step 4: Commit** `fix(mobile): small tap targets reach 44pt and 48dp`

### Task 6: Tabular numbers

**Files:**
- `apps/customer/src/buy/BuyParts.tsx:174`
- `apps/customer/src/today/WaitingList.tsx:136`
- `apps/customer/src/today/EmptyHome.tsx:152`
- `apps/customer/src/discover/PackageDetail.tsx:332`
- `apps/customer/src/help/ReportList.tsx:277`
- `apps/customer/src/buy/BuyScreen.tsx:286` (button label)
- `apps/caterer/src/business/UsahaScreen.tsx:192`
- `apps/caterer/src/business/PackageEditor.tsx:158`
- Web CSS where a price, total or countdown class lacks it

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1:** For each line, confirm it renders a currency, count or time and lacks `fontVariant: ["tabular-nums"]`. Add the property. Where a `Button` label carries the price, use the label style prop it already has, or leave it and record why.
- [ ] **Step 2:** Web: `grep` the price, total and countdown class names in `apps/web/src`. Add `font-variant-numeric: tabular-nums` to any that lack it.
- [ ] **Step 3:** Run `npm run typecheck`, plus customer `npx jest tests/buy.test.tsx tests/today.test.tsx tests/discover.test.tsx tests/help.test.tsx` and caterer `npx jest tests/business.test.tsx`. Expected: PASS.
- [ ] **Step 4: Commit** `fix: tabular numbers on prices and counts`

### Task 7: Balanced headings, pretty paragraphs

**Files:** `apps/web/src/app/globals.css:84-108`.

**Depends on:** none. **Builder:** sonnet.

- [ ] **Step 1:** Add `h4` to the `text-wrap: balance` selector. After the `p` rule, add `p, li, figcaption { text-wrap: pretty; }`.
- [ ] **Step 2:** On :3290, check `getComputedStyle(document.querySelector('main p')).textWrap` (or `textWrapStyle`) is `pretty`. Run `npm run typecheck`.
- [ ] **Step 3: Commit** `style(web): pretty paragraph wrapping, balanced h4`

### Task 8: Continuous corners

**Files:**
- Mobile, the audit's list of files with `borderRadius` and no `borderCurve`:
  - mobile-ui: brand/SuccessRing, MoodArc, MascotReading, PhotoRing, RantangTrack, StoryViewer, SheetHeader, layout/GlyphRow, GlyphCircle, SaveHeart, HeroPager, components.tsx, CheckRow
  - customer: WaitingList, PlansRow, StatusStops, DayBlocks, MonthGrid, DayScreen, DayActionRow, Akun, Notifications, TomorrowStory
  - caterer: ReportScreen, LiveSlot
- Web: the shared rules for `.card`-type surfaces, `.dialog`, inputs and rectangular buttons in `globals.css` and `overlays.css`.

**Depends on:** none. **Builder:** opus.

- [ ] **Step 1:** Mobile: add `borderCurve: "continuous"` next to each non-circular `borderRadius`. A radius equal to half the width/height, or 999, stays as it is.
- [ ] **Step 2:** Web: one `@supports (corner-shape: squircle) { … { corner-shape: squircle; } }` block in `globals.css` listing those selectors. No pill or circle selectors.
- [ ] **Step 3:** Run `npm run typecheck`, plus customer `npx jest tests/primitives.test.tsx tests/ui-foundation.test.tsx tests/today.test.tsx tests/schedule.test.tsx` and caterer `npx jest tests/today.test.tsx tests/report.test.tsx`. Expected: PASS. On :3290 in Chromium, confirm `getComputedStyle(document.querySelector('.dialog, .card')).cornerShape` returns squircle where supported.
- [ ] **Step 4: Commit** `style: continuous corners on mobile surfaces, squircle on web cards`

### Task 9: Review, full checks, report

**Depends on:** 1 to 8. **Builder:** opus reviewer.

- [ ] **Step 1:** Commit items 1 to 5 (already in the tree): `feat: skeleton delay, optimistic web Save, command menu, undo toast`.
- [ ] **Step 2:** Dispatch one fresh Opus reviewer over `git diff 14a13ac2~1..HEAD` (it should exclude the spec). It checks against the spec, AGENTS.md and the Review Focus. Fix confirmed findings, then commit.
- [ ] **Step 3:** Run `npm run typecheck`, `npm test`, `npm run build` and both Jest suites (in the background), plus `npx playwright test -c playwright.saved-swipe.config.ts`. Compare against the baseline failures listed above.
- [ ] **Step 4:** Revert the tsconfig include lines. Stop the :3290 server (my own process only).
- [ ] **Step 5:** Report all twenty: Built (what, files, how to see it), Already done (where), Skipped (why).
