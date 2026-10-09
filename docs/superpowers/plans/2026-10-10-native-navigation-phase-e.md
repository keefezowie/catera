# Native navigation and Beranda (Phase E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instructions, 2026-10-09 and 2026-10-10; every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `apple-design` (iOS chrome) and `material-3` (Android chrome), and apply them. antislop's mode is **after (session override)**: do not ask the mode question. Every task review runs the antislop design check (core, ui, layoutmobile, plus DESIGN.md) on its UI hunks, and checks iOS hunks against `apple-design` and Android hunks against `material-3`.
>
> **Models and process (owner instruction, 2026-10-10):** each task's **Builder** line names the first builder. Every reviewer is `opus`; never `haiku`. A review finding sends the task to a fresh `opus` fixer that owns rounds 2 to 5. Tasks run by their **Depends on** lines with no wave barriers, at most three at once in the pool worktrees, and merge as soon as their own review is clean. Implementers end their reports with **Doc facts**; one `opus` dispatch writes DESIGN.md in Task 11.

**Goal:** Give both native apps each platform's own navigation chrome (system tab bar and large-title bars on iOS, Material 3 navigation bar and top app bars on Android, a tab bar that stays on detail screens), and rebuild the customer Beranda for customers with several running plans: the day arc as the Siang/Malam switch, swipeable heroes when a meal has more than one delivery, one "Menunggu Anda" list, upcoming days grouped by day and one row for the running plans.

**Architecture:**
- Navigation: `expo-router/unstable-native-tabs` (`NativeTabs`) replaces JS `Tabs` in both apps. Each tab gets its own native stack through an array group (`(index,jadwal,jelajah,akun)` in the customer app), so detail screens push inside the current tab and keep the tab bar. Sign-in, purchase, payment, claim and the Menu besok story stay in the root stack and cover the tabs.
- Headers: pushed screens use the native stack header. iOS: large title that collapses into the bar, minimal chevron back button. Android: the native small top app bar, with the screen's full title as the first content line (M3 `headlineSmall`) that moves into the bar once it scrolls under. `AppHeader` and `MoodHeader`'s `onBack` go away. Mood colours stay on tab-root headers only.
- Beranda: a new leaf domain module `packages/domain/src/home.ts` turns the customer read into sections; `packages/mobile-ui` gains `MoodArc` (the switch) and `HeroPager`; Beranda composes them.
- Predictive back: a report-first spike in a development build; it ships only if hardware and gesture back still reach JavaScript on API 34, 35 and 36.

**Tech Stack:** Expo SDK 57 (targetSdk 36), React Native 0.86, expo-router 57 (`NativeTabs`, native stack), react-native-screens 4.26, Reanimated 4.5, expo-image (new), Jest (jest-expo), Vitest, TypeScript.

**Spec:** [anti-slop/audit-006-2026-10-10.md](../../../anti-slop/audit-006-2026-10-10.md) (findings 1 to 15, proposals, and "Owner decisions, 2026-10-10") and the design canvas [Catera Beranda directions](https://claude.ai/artifact/VRTSbG3tp8j2fTja2apdDR) (artboards `ArcSiang`, `ArcMalam`, `LunchPager`, `HomeFull`, `IosHome`, `AndroidHome`, `IosPlan`, `AndroidPlan`). Inherited constraints: [Phase A](2026-10-09-native-theme-phase-a.md), [Phase B](2026-10-09-native-mood-phase-b.md), [Phase C](2026-10-09-native-daily-loop-phase-c.md), [Phase D](2026-10-09-native-renewal-phase-d.md).

## Global Constraints

**Process**
- Work on `v2`, starting after Phase D's last merge. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json` or `.claude/`; stage by explicit path. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Worktree pool `C:\wt\1` to `C:\wt\3` as in Phase D (`git -C <wt> status --porcelain` empty, `git -C <wt> switch -c task-N v2`, `npm ci --prefer-offline` only when `package-lock.json` changed since that worktree's last install). App Jest in a worktree: `npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from the app folder.
- **Baseline first:** before Task 1, run `npm run typecheck`, `npm test`, `npm run build`, both app suites, `npm run test:postgres` and the e2e suite on the starting head, and record each failure as `Baseline: <check>: <failure>` in the ledger.
- Reports end with **Doc facts** (what changed, file:line, evidence). No task edits `DESIGN.md` except Task 11.
- Shared files: `package.json`, lockfiles, `packages/mobile-ui/src/index.ts`, `packages/domain/src/index.ts`, `apps/customer/tests/fixtures.ts`, the root `_layout.tsx` of each app. Their owner per task is in its Files block; nobody else edits them.

**Platform chrome (owner decision, 2026-10-10)**
- Each platform follows its own guidelines; the GitHub mobile app is the reference. Navigation and controls in bars are native components with native fonts (SF Pro on iOS, Roboto on Android). Catera's identity lives in the content: mood headers on tab roots, the day arc, the lunchbox, food photos, Plus Jakarta Sans.
- iOS: tabs never hide inside a tab's hierarchy (`tab-bars.md › Best practices`: "Make sure the tab bar is visible when people navigate to different sections of your app"); standard Back and Close symbols with no text label (`toolbars.md`); large titles that collapse on scroll (`toolbars.md`: "Use a large title to help people stay oriented").
- Android: Material 3 navigation bar, 80dp, filled icon plus indicator pill on the selected item, label always shown; top app bar small variant (64dp) with the M3 back arrow; tonal surfaces, not shadows.
- Platform checks use `process.env.EXPO_OS` in new code.

**Inherited from Phases A to D**
- Their Global Constraints, skill rules and rulings apply unless this plan replaces them. Replaced here: the custom `AppHeader` for pushed screens (now native headers), the 1.15 tab-label font cap and the iOS `tabBarAccessibilityLabel` (now the native bar's own label and accessibility), "the tab bar does not change with mood" (still true: the native bar reads the theme only).
- Native sources never read `colors`; mood colours only on mood surfaces; no literal hex in `packages/mobile-ui/src`; no `fontWeight` outside `textVariants`; hand edits only (R-33); no em dashes; operational numbers tabular; tests that depend on today's date pin the clock (`pinToday`).
- Customer copy addresses the reader as "Anda", never "kamu".

**Motion**
- Native transitions stay native: no custom stack animation, no custom tab-switch animation. App-drawn motion uses `nativeMotion` (control 120, selection 180, content 220, feature 320ms), animates only transform and opacity, and is instant under reduced motion. The arc disc travel is `feature` (320ms); the pager uses the platform's scroll physics.

**Data truth**
- Counts on Beranda ("2 antaran", "8 paket aktif", "3 antaran") come from the customer read; nothing invented (R-17). A menu that is not set never shows a dish name.

**Verification limit**
- This environment has an Android emulator and no Mac. iOS chrome is checked on a physical iPhone in Expo Go where the owner can run it, or else listed as unverified. No task claims iOS behaviour it did not see.

## Review Focus

1. **Cold links into a tab.** A push tap or notification for `/subscriptions/{id}`, `/hari/{id}` or `/pilih-menu/{id}` on a cold start opens the screen inside the Beranda tab with the tab bar visible, and Back returns to Beranda, never to an empty stack. Test in Task 2.
2. **Links to tab roots switch tabs.** `router.replace("/jadwal")` (PaidOutcome, ChooseMenu), `router.push("/jelajah")` (EmptyHome, SavedList, BuyParts) and `customerLink("/calendar")` select that tab; they never push a second Jadwal or Jelajah inside another tab. Test in Task 2.
3. **Paid is final.** On Bayar after payment, the native back button, the iOS swipe and Android hardware back all go to `/` with `router.replace`, never back to Beli. Test in Task 4.
4. **Demo strip with native headers.** With the demo strip shown, no screen gets a second status-bar inset under a native header (Android `headerTopInsetEnabled: false`), and status-bar glyphs follow the theme on pushed screens and the mood on tab roots. Test in Task 4.
5. **Large text.** At font scale 1.3 on a 360dp phone: native tab labels stay readable, a long plan name wraps in the Android content title instead of truncating, and the arc switch's labels never collide. Checked in Task 11, with a Jest assertion in Task 9 that arc labels wrap.

## Order

1. **Baseline** (main tree), then Tasks 1, 7 and 8 start at once.
2. Task 1 merged → Tasks 2 and 3. Task 2 merged → Task 4. Tasks 3 and 4 merged → Task 5. Task 4 merged → Task 6.
3. Task 8 merged → Task 9. Tasks 2, 8 and 9 merged → Task 10.
4. Everything merged → Task 11.

---

### Task 1: Native tab bar in both apps

**Files:**
- Modify: `apps/customer/app/(tabs)/_layout.tsx`, `apps/caterer/app/(tabs)/_layout.tsx`
- Modify: `packages/mobile-ui/src/TabBarLabel.tsx` (delete if nothing else imports it), `packages/mobile-ui/src/index.ts`
- Test: `apps/customer/tests/shell.test.tsx` (expo-router mock gains `NativeTabs`), `apps/caterer/tests/tabs.test.tsx`, `apps/caterer/tests/layout.test.tsx`

**Interfaces:**
- Produces: tab triggers named `index`, `jadwal`, `jelajah`, `akun` (customer) and `index`, `pelanggan`, `menu`, `usaha` (Dapur); Task 2 and Task 3 rename them to their group names. Exported `tabBarColors(palette): { backgroundColor; indicatorColor; rippleColor; tintColor; iconColor: { default; selected }; labelColor: { default; selected } }` from `packages/mobile-ui/src/tabBar.ts`.

**Depends on:** none

**Builder:** opus

**States:** light and dark theme (the bar never reads mood); Dapur owner (4 tabs) and staff (`tabsForRole`, hidden tabs use `NativeTabs.Trigger hidden`); legacy `discover` hidden; signed out (customer tabs still show; Dapur redirects to `/masuk` as today); font scale 1.3.

- [ ] **Step 1: Write the failing tests.** Customer: `"the tab bar is the native one with Ionicons, filled when selected"` asserts four triggers in order `index, jadwal, jelajah, akun` with labels Beranda, Jadwal, Jelajah, Akun (English: Home, Schedule, Explore, Account), each `Icon` a `VectorIcon` of family Ionicons with `home`/`home-outline` and so on, and `discover` hidden. `"tab bar colours come from the theme, never the mood"` asserts `tabBarColors(lightPalette)` and `tabBarColors(darkPalette)` values under Siang and Malam are equal. Dapur: `"staff see only their tabs"` asserts `hidden` on the triggers `tabsForRole` excludes.
- [ ] **Step 2:** Run both app suites. Expected: FAIL.
- [ ] **Step 3: Implement.** `NativeTabs` with `labelVisibilityMode="labeled"`, `tabBarColors(useColors())` on the bar, `NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name=… />}` (outline default, filled selected). Colours: `backgroundColor` = `tabBar`, `indicatorColor` = a forest tint that keeps the selected icon at 3:1 or more (light `#CFE3CC`, dark from the dark palette; add the two tokens to `@catera/design-tokens` and to `tests/native-contrast.test.ts`), labels `muted` and `forest`. Drop `TabBarLabel`, the 1.15 cap and `spokenTabLabel` from the tab layouts. Check in Expo Go on the Android emulator that the bar renders; if `NativeTabs` does not run in Expo Go, stop and report.
- [ ] **Step 4:** Both app suites, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(native): platform tab bar in both apps`.

### Task 2: Customer tabs each keep their own stack

**Files:**
- Create: `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/_layout.tsx`
- Move into that folder: the four tab root files (`index.tsx`, `jadwal.tsx`, `jelajah.tsx`, `akun.tsx`), `discover.tsx`, and the detail routes `paket/[id].tsx`, `package/[id].tsx`, `subscriptions/[id].tsx`, `subscriptions/[id]/menu.tsx`, `pilih-menu/[id].tsx`, `hari/[id].tsx`, `bantuan.tsx`, `masalah/[id].tsx`, `alamat.tsx`, `addresses.tsx`, `pembayaran.tsx`, `disimpan.tsx`, `saved.tsx`, `notifications.tsx`
- Keep in the root stack: `login`, `register`, `recover`, `auth/callback`, `beli/[id]`, `renew/[id]`, `bayar/[id]`, `checkout/[id]`, `payment/[id]`, `claim/[token]`, `tomorrow`
- Modify: `apps/customer/app/_layout.tsx`, `apps/customer/app/(tabs)/_layout.tsx` (trigger names become `(index)`, `(jadwal)`, `(jelajah)`, `(akun)`), `apps/customer/src/links.ts`, `apps/customer/src/nav.ts` (create)
- Test: `apps/customer/tests/navigation.test.tsx` (create)

**Interfaces:**
- Produces: `goToTab(tab: "index" | "jadwal" | "jelajah" | "akun"): void` in `src/nav.ts`, which selects the tab (and pops it to its root) instead of pushing. Every in-app link to a tab root uses it. URLs do not change: `/`, `/jadwal`, `/subscriptions/{id}` keep resolving.

**Depends on:** Task 1

**Builder:** opus

**States:** cold start from a push tap into a detail screen; warm tap while another tab is open (the screen opens in the current tab); signed out on Jadwal and Akun (`SignInFirst` unchanged); legacy redirects (`/discover`, `/saved`, `/addresses`, `/package/{id}`, `/subscriptions/{id}/menu`).

- [ ] **Step 1: Write the failing tests** in `navigation.test.tsx` (expo-router's `renderRouter` from `expo-router/testing-library`): `"a cold link to a plan opens it inside Beranda with Back to Beranda"`; `"Lihat jadwal after payment selects the Jadwal tab"` (no second Jadwal in the stack); `"Jelajah paket from an empty home selects Jelajah"`; `"every legacy path still lands on its screen"`; `"login, Beli, Bayar, claim and the story open above the tabs"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** The array-group layout reads `segment` and declares its root screen (pattern in `building-native-ui`, "Common route structure"). Replace the tab-root `router.push`/`replace` calls listed in Review Focus 2 with `goToTab`. `customerLink` keeps returning paths; the mobile-core link handler opens tab-root paths with `goToTab`.
- [ ] **Step 4:** Customer suite and typecheck. Expected: PASS. On the emulator: a detail screen keeps the tab bar; switching tabs and back keeps each tab's stack.
- [ ] **Step 5: Commit** `feat(customer): each tab keeps its own stack`.

### Task 3: Dapur tabs each keep their own stack

**Files:**
- Create: `apps/caterer/app/(tabs)/(index,pelanggan,menu,usaha)/_layout.tsx`
- Move into it: the four tab roots and `laporan/[id]`, `menu/[date]`, `paket/[id]`, `paket/baru`, `pelanggan/[id]`, `tim`, `uang`
- Keep in the root stack: `(auth)/masuk`, `(auth)/daftar`, `aktifkan`, `impor`
- Modify: `apps/caterer/app/_layout.tsx`, `apps/caterer/app/(tabs)/_layout.tsx`, `apps/caterer/src/nav.ts` (create, `goToTab` for Dapur tabs)
- Test: `apps/caterer/tests/navigation.test.tsx` (create)

**Interfaces:** Produces `goToTab(tab: CatererTab)`. Staff never reach a hidden tab's routes (RoleGate unchanged).

**Depends on:** Task 1

**Builder:** opus

**States:** owner and staff; a push tap into `laporan/{id}` cold; `impor` and `aktifkan` above the tabs.

- [ ] **Step 1: Write the failing tests:** `"a report link opens inside Hari ini with Back to Hari ini"`, `"staff cannot open Usaha routes"`, `"Impor opens above the tabs"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** as Task 2.
- [ ] **Step 4:** Caterer suite, typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caterer): each tab keeps its own stack`.

### Task 4: Native headers for customer pushed screens

**Files:**
- Create: `packages/mobile-ui/src/nativeHeader.ts`, `packages/mobile-ui/src/HeaderIconButton.tsx`
- Modify: `packages/mobile-ui/src/components.tsx` (`Screen` gains `nativeTitle`), `packages/mobile-ui/src/MoodHeader.tsx` (drop `onBack`/`backLabel`; owns the status bar while focused), `packages/mobile-ui/src/mood.tsx` (`statusBarStyle` accepts `mood: null`), `packages/mobile-ui/src/index.ts`; delete `packages/mobile-ui/src/AppHeader.tsx`
- Modify: `apps/customer/app/_layout.tsx` and the array-group `_layout.tsx` (screen options), `src/plan/PlanDetail.tsx`, `src/discover/PackageDetail.tsx`, `src/buy/BuyScreen.tsx`, `src/buy/PaymentScreen.tsx`, `src/claim/ClaimScreen.tsx`, `src/schedule/DayScreen.tsx`, and every screen that today relies on the shared `AppHeader`
- Test: `apps/customer/tests/native-header.test.tsx` (create); update `ui-foundation.test.tsx`, `shell.test.tsx`, `mood.test.tsx`

**Interfaces:**
- Produces: `nativeHeaderOptions({ palette, demo }): NativeStackNavigationOptions`. iOS: `headerLargeTitle: true`, `headerTransparent: true`, `headerShadowVisible: false`, `headerLargeTitleShadowVisible: false`, `headerBackButtonDisplayMode: "minimal"`, `headerTintColor: palette.forest`, `headerLargeStyle` and `headerStyle` `{ backgroundColor: palette.canvas }`. Android: `headerShadowVisible: false`, `headerStyle: { backgroundColor: palette.canvas }`, `headerTintColor` and title colour `palette.ink`, `headerTopInsetEnabled: !demo`.
- Produces: `HeaderIconButton({ icon: "close" | "chat" | "share"; label: string; onPress })`, 44pt on iOS and 48dp on Android, icon only, `accessibilityLabel` = label.
- Produces: `Screen` prop `nativeTitle?: string`. When set, the root scroll view is first in the screen with `contentInsetAdjustmentBehavior="automatic"`; on Android it renders `nativeTitle` as the first content line in `headlineSmall` (24/32, wraps) and sets the bar title to it once that line has scrolled under the bar (cleared when it comes back); on iOS it renders nothing extra.
- Pushed screens pass their title through link params (`title` on `/subscriptions/[id]`, `/hari/[id]`, `/paket/[id]`) so the bar is final on the first frame; without the param the screen shows its loading title and swaps once ("Paket" never shows when the link carried the name).

**Depends on:** Task 2

**Builder:** opus

**States:** light and dark, Siang and Malam on the tab root behind, demo strip on and off, plan loading, plan error, paid and unpaid Bayar, modal sign-in (Close at the leading edge), PackageDetail photo header (transparent bar over the photo with the back button legible), font scale 1.3.

- [ ] **Step 1: Write the failing tests:** `"pushed screens use the native header with the platform back button"` (no `app-header`, options equal `nativeHeaderOptions`); `"Android shows the full plan name as the first content line and moves it into the bar on scroll"`; `"a plan link that carries its name never shows Paket"`; `"paid Bayar: header back, iOS swipe and hardware back all replace to /"`; `"with the demo strip the Android header adds no top inset"`; `"status bar follows the mood on Beranda and the theme on a pushed screen"`; `"sign-in shows Close, labelled Tutup, at the leading edge"`; `"the four tab roots start their title at the same height"` (at 360dp the title's top y is equal on Beranda, Jadwal, Jelajah and Akun); `"no tab root repeats its own tab name in the meta line"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** `MoodHeader`'s top row is always 48dp tall, whether it holds a meta line, month arrows, the area picker or nothing, so a tab switch never moves the title (finding 1). The meta line carries a fact, never the tab's name: Akun drops "Akun", Jadwal drops "Jadwal" (finding 5d). Remove `onBack` from `MoodHeader` and its callers; detail screens drop their own mood block and use `Screen nativeTitle`. PaymentScreen keeps "paid is final" through `usePreventRemove` (or `beforeRemove`) that replaces to `/`, plus `gestureEnabled: false` and `headerBackVisible: false` once paid. DayScreen: the bar title is the day label ("Senin 12 Okt"), never "Hari", and the body drops its duplicate title.
- [ ] **Step 4:** Customer suite, `npm run typecheck`. On the emulator: push and pop from Beranda, Jadwal and Akun; Bayar paid; demo strip on. Expected: PASS.
- [ ] **Step 5: Commit** `feat(customer): native headers on pushed screens`.

### Task 5: Native headers for Dapur pushed screens

**Files:** `apps/caterer/app/_layout.tsx`, the Dapur array-group `_layout.tsx`, the screens behind `laporan/[id]`, `menu/[date]`, `paket/[id]`, `paket/baru`, `pelanggan/[id]`, `tim`, `uang`, `aktifkan`, `impor`; tests `apps/caterer/tests/layout.test.tsx` and a new `apps/caterer/tests/native-header.test.tsx`.

**Interfaces:** Consumes Task 4's `nativeHeaderOptions`, `HeaderIconButton`, `Screen nativeTitle`.

**Depends on:** Tasks 3 and 4

**Builder:** opus

**States:** owner and staff, light and dark, demo strip, `ScreenGuard` failure (it keeps no header of its own; the native bar sits above it), font scale 1.3.

- [ ] **Step 1: Write the failing tests:** `"Dapur pushed screens use the native header"`, `"the guard's failure shows under the native bar with no second header"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** with Task 4's helpers.
- [ ] **Step 4:** Caterer suite, typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(caterer): native headers on pushed screens`.

### Task 6: Loading continuity

**Files:**
- Modify: `packages/mobile-ui/src/PhotoRing.tsx`, `apps/customer/src/today/Plate.tsx`, `apps/customer/src/plan/PlanDetail.tsx` (photo), `apps/customer/src/schedule/Jadwal.tsx`, `packages/mobile-ui/package.json`, `apps/customer/package.json`, `apps/caterer/package.json`, `package-lock.json` (`npx expo install expo-image` in each app)
- Test: `apps/customer/tests/loading.test.tsx` (create)

**Interfaces:** `PhotoRing` and plate photos use `expo-image` `Image` with `transition={nativeMotion.selection}` (instant under reduced motion) and the `soft` colour as placeholder background.

**Depends on:** Task 4

**Builder:** opus

**States:** photo loading, photo failed (placeholder stays, no broken icon), reduced motion; Jadwal month loading, failed and loaded.

- [ ] **Step 1: Write the failing tests:** `"photos fade in over 180ms and appear at once under reduced motion"`; `"Jadwal keeps the month grid's height while it loads"` (the loading header's height equals the loaded header's at 360dp, fixed by six week rows).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Jadwal's loading state draws the grid frame (weekday row and six empty week rows at the loaded height) with "Memuat…" inside it; the error keeps that frame too.
- [ ] **Step 4:** Customer and caterer suites, typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(native): photos fade in and Jadwal keeps its height while loading`.

### Task 7: Predictive back spike (report first)

**Files:** `docs/PREDICTIVE-BACK.md` (create); only if the go rule passes: `apps/customer/app.config.ts`, `apps/caterer/app.config.ts` (`android.predictiveBackGestureEnabled: true`) and `plugins/with-root-back-callback.js` (create, both app configs).

**Interfaces:** none for other tasks.

**Depends on:** Task 2

**Builder:** sonnet

- [ ] **Step 1:** Build a development client for the customer app (`npx expo run:android`) and run it on API 34, 35 and 36 emulators.
- [ ] **Step 2:** With the flag on, record for each API level: does hardware back and gesture back pop a pushed screen, close a sheet, keep Bayar's paid guard, and leave the app from a tab root? Does the system show the back-to-home preview on a tab root?
- [ ] **Step 3:** Add the config plugin that turns React Native's `OnBackPressedCallback` off while the root navigator cannot go back (JS reports `canGoBack` through a tiny native module or `BackHandler` bridge), so the system preview plays on tab roots. Repeat Step 2.
- [ ] **Step 4: Go rule.** Ship the flag and plugin only if every Step 2 check passes on all three levels. Otherwise commit only the report with the failing checks and the react-native-screens version that would add in-app back progress.
- [ ] **Step 5: Commit** `docs(native): predictive back spike` (plus `feat(native): predictive back on Android` when it ships).

### Task 8: Beranda sections in the domain

**Files:**
- Create: `packages/domain/src/home.ts` (leaf module), `tests/home.test.ts`
- Modify: `packages/domain/src/customer-day.ts` (`Plate` gains `lead` and `sides`; export `storyDishes`), `packages/domain/src/index.ts`

**Interfaces (all in `home.ts` unless noted):**
- `Plate.lead: string | null` and `Plate.sides: string[]` (customer-day.ts): the story's main-dish rule (main-dish category, then the cover dish, then the first in composition order) on a set menu; `null` and `[]` when the menu is not set.
- `mealPlates(plates: Plate[]): { lunch: Plate[]; dinner: Plate[] }` in window order.
- `upcomingDays(state: CustomerState, now: Date, days: number, locale: Locale): UpcomingDay[]`, `UpcomingDay = { date: string; label: string; meals: UpcomingMeal[] }`, `UpcomingMeal = { deliveryId: string; meal: "lunch" | "dinner"; packageName: string; catererName: string; lead: string | null; image: string; menuSet: boolean; changeUntil: string | null }`. Lunch before dinner within a day, then window order. The next `days` days that have a delivery.
- `waitingItems(state: CustomerState, actions: CustomerActionItem[] | null, now: Date): WaitingItem[]` where `WaitingItem = { kind: "menu"; subscriptionId: string; packageName: string; dates: string[]; deadline: string } | { kind: "renew"; subscription: Subscription } | { kind: "trial"; subscription: Subscription } | { kind: "review"; subscription: Subscription }`. Menu rows group one plan's due dates (from `menu_choice_due` actions with `selection_due`), earliest deadline first; then renewals (`renewalDue`), trials (`trialFollowUp`), the review candidate (Beranda's current `reviewCandidate` rule, moved here). `actions === null` (offline) gives no menu rows.
- `activePlans(state: CustomerState): { count: number; caterers: string[]; images: string[] }` (active only; caterers unique in first-seen order; up to 3 images).
- `planLabel(sub: Subscription, all: Subscription[], locale: Locale): string`: the plan name, plus its date range ("12–23 Okt") only when another active plan has the same name.

**Depends on:** none

**Builder:** sonnet

- [ ] **Step 1: Write the failing tests** in `tests/home.test.ts`: `"lead is the main dish, not the rice"` (composition rice, ayam, sayur, with ayam in category `main`, gives `lead: "Ayam bumbu rujak"`); `"an unset menu has no lead"`; `"two lunches stay two plates, in window order"`; `"upcoming days group three deliveries of one day under one label"`; `"menu rows group a plan's due dates and sort by deadline"`; `"offline: no menu rows"`; `"duplicate plan names carry their date range"`; `"activePlans counts active plans only"`.
- [ ] **Step 2:** `npx vitest run tests/home.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** as a leaf module (type-only imports from `./index`).
- [ ] **Step 4:** `npx vitest run tests/home.test.ts`, `npm test`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): Beranda sections`.

### Task 9: The day arc is the Siang/Malam switch

**Files:**
- Create: `packages/mobile-ui/src/brand/MoodArc.tsx`
- Modify: `packages/mobile-ui/src/MoodHeader.tsx` (`arc` prop renders `MoodArc`; the toggle row is not shown when the arc is), `packages/mobile-ui/src/index.ts`, `apps/customer/src/today/Beranda.tsx` (header only: headline and arc labels)
- Test: `apps/customer/tests/mood-arc.test.tsx` (create), update `apps/customer/tests/today.test.tsx` header assertions

**Interfaces:**
- Produces: `MoodArc({ siang: { title: string; detail: string }; malam: { title: string; detail: string } })`. A `tablist` of two `tab`s with `selected` state; each end is a 48dp-plus button with its icon, title ("Siang"/"Malam"; "Lunch"/"Dinner") and detail line. The selected end is the filled `markerActive` disc; the other end shows the same-size outline ring in `markerIdle` (1.5dp), so both read as buttons. The disc travels along the arc over 320ms; colours snap; `select` haptic; instant under reduced motion. Reads and writes the mood like `MoodToggle`.
- Beranda passes `detail` = the window start ("11.00") with one delivery of that meal today, "{n} antaran" with more than one, and "Tidak ada" with none. Headline: "Siang ini,\n{lead}." with one plate (lead lowercased, the package name when `lead` is null), "Siang ini,\n{n} antaran." with more, the existing "tidak ada antaran." with none (Malam forms likewise).

**Depends on:** Task 8

**Builder:** opus

**States:** light and dark × Siang and Malam (canvas `ArcSiang`, `ArcMalam`); zero, one and two plates for the selected meal; font scale 1.3 at 360dp (labels wrap under their markers, never overlap); reduced motion; TalkBack reads "Makan siang, 2 antaran, tab, dipilih".

- [ ] **Step 1: Write the failing tests:** `"the arc is a tablist and switching fires the select haptic"`; `"the idle end has the outline ring"`; `"headline names the main dish"`; `"headline counts two lunches"`; `"arc labels wrap at font scale 1.3 without overlapping"` (each label's `maxWidth` is its marker column).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `useMoodProgress` for the disc. Contrast for the ring and labels is already covered by `markerIdle` and `headerMeta`; extend `tests/native-contrast.test.ts` only if a new pairing appears.
- [ ] **Step 4:** Customer suite, typecheck. Expected: PASS.
- [ ] **Step 5: Commit** `feat(customer): the day arc switches Siang and Malam`.

### Task 10: Beranda body for several plans

**Files:**
- Create: `packages/mobile-ui/src/HeroPager.tsx`, `apps/customer/src/today/WaitingList.tsx`, `apps/customer/src/today/UpcomingDays.tsx`, `apps/customer/src/today/PlansRow.tsx`, `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/paket-saya.tsx`, `apps/customer/src/plan/PlanList.tsx` (extracted from Akun's "Paket aktif")
- Modify: `apps/customer/src/today/Beranda.tsx`, `apps/customer/src/account/Akun.tsx`, `apps/customer/tests/fixtures.ts` (owner of this shared file for Phase E)
- Delete when unused: `apps/customer/src/today/MenuDueRows.tsx`, `UpcomingRows.tsx`
- Test: `apps/customer/tests/today.test.tsx`, `apps/customer/tests/beranda-sections.test.tsx` (create)

**Interfaces:**
- `HeroPager({ count: number; children; accessibilityLabelFor: (index: number) => string })`: horizontal paging with snap to card width (screen width minus 64, gap 12), the next card peeking; dots plus "{i} dari {n}" under it; nothing extra when `count` is 1. The pager card is the existing hero `Plate`.
- Section order: header, hero (or pager), other-meal row (its label says "{n} antaran" when that meal has more than one), the Phase D `RecapCard` (unchanged), "Menunggu Anda" (`WaitingList`, hidden when empty), "Menu besok" (unchanged), "Berikutnya" (`UpcomingDays`, 3 days), `PlansRow` ("{n} paket aktif" and the caterers, opening `/paket-saya`), then nothing below.
- `WaitingList` rows, one style, one action each: menu "Pilih menu {Selasa 13 Okt}" (or "Pilih menu {n} hari") with "{paket} · sebelum {deadline}" and action "Pilih"; renewal "{paket}, sisa {n} hari" with "Perpanjang" (the screen's one sunrise-ink action); trial "{paket} selesai {hari ini}" with "Paket penuh"; review "Bagaimana {katerer} selama ini?" with "Nilai", which opens the existing review form in a `Sheet`. The renewal and trial cards and the inline review prompt go.

**Depends on:** Tasks 2, 8 and 9

**Builder:** opus

**States:** demo customer as seen on 2026-10-10 (two lunches, one dinner, three menus due, a renewal, two trials, a review); one plan with one meal; Saturday with no delivery today and a next delivery Monday; nothing waiting (no "Menunggu Anda"); offline copy (no menu rows, "Terakhir diperbarui" line kept); actions feed failed; eight plans with two identical names; empty home (unchanged `EmptyHome`); light and dark × Siang and Malam; font scale 1.3; TalkBack on the pager ("Makan siang 1 dari 2, Dapur Senja"). Jest fixtures for each go in `fixtures.ts`.

- [ ] **Step 1: Write the failing tests:** `"two lunches are two equal heroes with 1 dari 2"`; `"the other meal row counts its deliveries"`; `"waiting rows are one list with a single sunrise action"`; `"nothing waiting hides the section"`; `"offline hides menu rows"`; `"Berikutnya groups a day's deliveries under one label"`; `"eight plans become one row that opens Paket saya"`; `"duplicate plan names show their dates"`; `"review opens its form in a sheet"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** per the Interfaces and the canvas `HomeFull` and `LunchPager` artboards. `Paket saya` uses `Screen nativeTitle="Paket aktif"` and `PlanList`.
- [ ] **Step 4:** Customer suite, typecheck. On the emulator with the demo customer: swipe the heroes, open each waiting row, open Paket saya. Expected: PASS.
- [ ] **Step 5: Commit** `feat(customer): Beranda for several plans`.

### Task 11: Gate, DESIGN.md and evidence

**Files:** `DESIGN.md`, `anti-slop/audit-007-<date>.md`, `output/native-review/phase-e/`

**Depends on:** Tasks 1 to 10

**Builder:** opus

- [ ] **Step 1:** Full checks: `npm run typecheck`, `npm test`, `npm run build`, both app suites, `npm run test:postgres`, e2e. Compare against the baseline lines.
- [ ] **Step 2: Android emulator gate** in four looks (light and dark by `adb shell cmd uimode night yes|no`; Siang and Malam) for Beranda (two lunches, Saturday, nothing waiting), a pushed plan, Jadwal, Akun, Bayar paid, Dapur Hari ini and a Dapur pushed screen; font scale 1.3 at 360dp; reduced motion; TalkBack on the tab bar, the arc and the pager; the demo strip on. Record each Review Focus line as PASS or FAIL with a screenshot.
- [ ] **Step 3: iOS:** if the owner can run Expo Go on an iPhone, record the tab bar, a large title collapsing, swipe back and the arc; otherwise list each as not verified.
- [ ] **Step 4:** One `opus` dispatch writes DESIGN.md from the approved Doc facts (rulings: platform-native chrome; native tab bar replaces the 1.15 label cap; `AppHeader` removed; the arc is the switch; swipeable heroes; "Menunggu Anda"), then one scoped re-review.
- [ ] **Step 5:** antislop Delivery Gate as PASS/FAIL with evidence in `audit-007`. Commit `docs: Phase E gate and DESIGN.md`.
