# Native loading, launch, settings, sheets and feedback (Phase F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instructions, 2026-10-09 to 2026-10-11; every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `apple-design` (iOS), `material-3` (Android; if it is not installed, say so in the report), `design-taste-frontend` and `impeccable`, and apply them. antislop's mode is **after (session override)**: do not ask the mode question. `design-taste-frontend` scopes native mobile out (its section 13): apply its general rules (skeletons over spinners, motivated motion, contrast, copy self-audit, no em dashes), not its web stack. `impeccable`: run its context step once per session with `--target` set to the app being changed.
>
> **Models and process (owner instruction):** each task's **Builder** line names the first builder. Every reviewer is `opus`; never `haiku`. A review finding sends the task to a fresh `opus` fixer that owns rounds 2 to 5. Tasks run by their **Depends on** lines with no wave barriers, at most three at once in the pool worktrees, and merge as soon as their own review is clean. Implementers end their reports with **Doc facts**; one `opus` dispatch writes DESIGN.md in Task 16.

**Goal:** Replace generic spinners with skeletons and the restored mascot, make cold start paint from cache under a held splash, add Pengaturan in both apps with a truthful notification switch, move short tasks to native sheets with a written action ladder, give outcomes a sized feedback vocabulary (beat, toast, micro, row motion), bring macros back, show import photo previews, and wire the delivered Phase F artwork.

**Architecture:**
- `packages/mobile-ui` gains the primitives (`Skeleton`, `MascotLoading`, `MascotArt`, `MascotReading`, `SuccessBeat`, `ToastProvider`, `SheetHeader`, `sheetOptions`, `useConfirm`, `useActionSheet`, row motion, settings rows); both apps compose them.
- `packages/mobile-core` gains cache-first reads (`useData` `cached` option), a non-blocking boot (`booted`, `refreshing`) and `usePushSwitch`; one database command, `device.unregister`.
- Sheets are expo-router routes with `presentation: "formSheet"` (react-native-screens 4.26); confirm and action sheets are two generic routes driven by a promise registry.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router 57 (NativeTabs, native stack, form sheets), react-native-screens 4.26, Reanimated 4 (layout animations), expo-image, expo-splash-screen, expo-notifications, lottie-react-native (new), Jest (jest-expo), Vitest, Postgres concurrency suite, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-10-native-phase-f-design.md](../specs/2026-10-10-native-phase-f-design.md) (sections 1 to 15). Inputs: [audit 008](../../../anti-slop/audit-008-2026-10-10.md), [research](../research/2026-10-10-native-phase-f-mobbin.md), canvas [Catera Phase F directions](https://claude.ai/artifact/H6rGFNL1QBBhtvRa8Q8k2R), artwork [packages/brand/assets/phase-f/README.md](../../../packages/brand/assets/phase-f/README.md) and `rig.json`. Inherited: the Phase A to E plans and their rulings.

## Global Constraints

**Process**
- Work on `v2` in the main tree `D:\Project\Catera\catera`. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/` or `catera-phase-f-artwork.zip`; stage by explicit path. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Pool:** `C:\wt\1`, `C:\wt\2`, `C:\wt\3` do not exist yet. Before the first dispatch the controller creates them: `git worktree add C:\wt\N v2 --detach` and `npm ci --prefer-offline` in each. Per task: `git -C <wt> status --porcelain` empty, `git -C <wt> switch -c task-N v2`; rerun `npm ci --prefer-offline` only when `package-lock.json` changed since that worktree's last install. App Jest in a worktree: `npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from the app folder.
- **Merge:** rebase the task branch on the current `v2`, re-check `v2` right before merging, then `git -C D:\Project\Catera\catera merge --ff-only task-N`.
- **Baseline first:** before Task 1, run `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites and `npm run test:postgres` on `v2` at the plan's start and record each failure as `Baseline: <check>: <failure>` in the ledger. (The artwork delivery reported missing `exceljs`, `@anthropic-ai/sdk`, `expo-image`, `expo-haptics` in a stale install; a fresh `npm ci` may clear them; record what remains.)
- Reports end with **Doc facts** (what changed, file:line, evidence). No task edits `DESIGN.md` except Task 16.
- Shared files: `package.json` and lockfiles belong to Task 1 only (no other task adds a dependency). `packages/mobile-ui/src/index.ts`, `packages/mobile-core/src/index.ts`, `apps/*/tests/fixtures.ts` and each app's root `app/_layout.tsx` are append-or-edit by several tasks in dependency order; resolve append-only conflicts on rebase, never by dropping the other task's lines.

**Copy and content**
- Indonesian first with English through `t(id, en)`. Customer copy says "Anda"; Dapur copy says "kamu". No em dashes. Operational numbers tabular. No invented numbers (R-17); a value the read does not hold is not shown.
- Native chrome stays platform-native (NativeTabs, native stack headers, native sheets); brand lives in the content. Plus Jakarta Sans everywhere the app draws text; system-drawn UI keeps the system font.

**Motion (spec sections 6 and 10)**
- `nativeMotion`: control 120, selection 180, content 220, feature 320 ms, ease `(.16, 1, .3, 1)`, press spring damping 18 stiffness 260. Transform and opacity only. Reduced motion (`useReduced`) makes every movement instant or static.
- Loops only while waiting: the mascot loop and the skeleton pulse.
- Loaded content enters as one block from its skeleton (`FadeSwap`); rows the user's own action inserts or removes animate; never a stagger on a first load, refresh, search, filter, tab return or mood switch (Decision A).
- Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2; Dapur ENERGY 1 / RHYTHM 1 / MOTION 2.

**Artwork truth**
- `packages/brand/assets/phase-f/*.png` are processed transparent derivatives of the generator originals; runtime copies are downscaled derivatives. Never call either a master. Apps import only `packages/brand/assets/phase-f/runtime/` (and the splash and icon files from the root of `phase-f/` in app configs). Rig layers are never trimmed.

**Verification limit**
- Android emulator in Expo Go with the demo backend (`CATERA_V1_DEMO=true npm run dev`, Metro per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`). No Mac: iOS behaviour is checked through option values in Jest only and listed as unverified. Expo Go never shows Catera's native splash or icons; those are config-tested and unverified on a device (Decision C default).

## Review Focus

1. **Stale cache acted on.** Beranda and Dapur Hari ini paint the cached read first; a meal moved or cancelled since must not be actionable from that copy. Expected: while `fromCache` is true, every action that changes data (Sudah sampai, Ubah hari, Mulai masak, Berangkat antar, the "…" sheets) is hidden exactly as on today's offline copy, and appears only after the fresh read lands. Test in Task 4.
2. **Another account's cache.** After sign-out, or signing in as another person on the same phone, the first paint must never show the previous person's cached Beranda or kitchen. Expected: caches are keyed by actor id and cleared on logout; a different actor paints its skeleton. Test in Task 4.
3. **Sheet dismissal loses input or the parent.** Android back, swipe down and Close on a form sheet with typed text. Expected: one confirm sheet ("Buang {laporan|alamat|catatan}?") only when text was typed; back with nothing typed closes the sheet and leaves the parent page in place; a cold `/masalah/{id}` opens over its Hari. Test in Task 9.
4. **Notification permission changed outside the app.** The user turns Catera's notifications off in the phone's settings and returns to Pengaturan. Expected: on focus the switch reads the real permission and shows off with "Izinkan notifikasi di Pengaturan ponsel"; it never shows on while the system blocks it. Test in Task 8.
5. **Success beat repeats or goes silent.** Reopening an already paid checkout, rotating back to it, or reduced motion. Expected: the beat plays only on the transition to paid while the screen is open; reopening shows the resting frame with no haptic; reduced motion shows `mascot-merayakan` and still fires the one `success` haptic on the transition. Test in Task 12.

## Order

1. **Baseline** and pool (Global Constraints), then Tasks 1, 7 and 14 start at once.
2. Task 1 merged → Tasks 2 and 3.
3. Task 2 merged → Tasks 4, 5, 6, 9. Tasks 2 and 7 merged → Task 8.
4. Task 9 merged → Tasks 10 and 11. Tasks 2 and 3 merged → Task 12.
5. Tasks 3, 5 and 6 merged → Task 13. Tasks 3 and 11 merged → Task 15.
6. Everything merged → Task 16.

---

### Task 1: Dependencies and install drift

**Files:** `package.json`, `package-lock.json`, `apps/customer/package.json`, `apps/caterer/package.json`, `packages/mobile-ui/package.json` (peer list), `packages/brand/package.json` (only if the runtime-copy script in Task 3 needs a script entry).

**Interfaces:** Produces an install where both apps resolve one `react-native-reanimated` and one `react-native-worklets` that match Expo SDK 57 and Expo Go; `lottie-react-native` in both apps (and as a `packages/mobile-ui` peer); `expo-constants` and `expo-notifications` present in both apps.

**Depends on:** none

**Builder:** sonnet

- [ ] **Step 1:** Record `npm ls react-native-reanimated react-native-worklets` and `npx expo install --check` output for both apps in the report (the audit found worklets 0.12.2 invalid under `expo-modules-core`, and `@catera/caterer` unlinked and resolving Reanimated 4.6.0 while declaring 4.5.1).
- [ ] **Step 2:** In each app, `npx expo install --fix`, then `npx expo install lottie-react-native expo-constants expo-notifications` (skipping any already declared at the expected version). Make `@catera/caterer` a linked workspace that resolves the same Reanimated as `@catera/customer`.
- [ ] **Step 3:** `npm ls react-native-reanimated react-native-worklets` shows one version each with no `invalid`; `npx expo install --check` passes in both apps.
- [ ] **Step 4:** Both app Jest suites, `npm run typecheck`. Expected: no new failures against the baseline lines. Launch each app in Expo Go on the emulator and open one Reanimated screen (customer Beranda arc switch, Dapur Hari ini toggle). Expected: no red box, no worklets version warning.
- [ ] **Step 5: Commit** `chore(native): align Reanimated and worklets, add lottie-react-native`.

### Task 2: Loading, toast, sheet and motion primitives

**Files:**
- Create: `packages/mobile-ui/src/Skeleton.tsx`, `packages/mobile-ui/src/brand/MascotLoading.tsx`, `packages/mobile-ui/src/Toast.tsx`, `packages/mobile-ui/src/motion/layout.ts`, `packages/mobile-ui/src/SheetHeader.tsx`
- Modify: `packages/mobile-ui/src/nativeHeader.ts` (add `sheetOptions`), `packages/mobile-ui/src/motion/index.ts`, `packages/mobile-ui/src/index.ts`, `packages/design-tokens/src/index.ts` (toast tokens in `nativeThemes`), `tests/native-contrast.test.ts`, both `app/_layout.tsx` (wrap in `ToastProvider`)
- Test: `apps/customer/tests/primitives.test.tsx` (create), `tests/native-contrast.test.ts`

**Interfaces (Produces):**
- `Skeleton({ width?: DimensionValue; height: number; radius?: number; onMood?: boolean })` (fill `sage`, or `toggleTrack` from `useMoodColors()` when `onMood`) and `SkeletonGroup({ label: string; children })`: one shared opacity pulse 1 → 0.55 → 1 over 1400ms for all blocks inside, static at 0.75 under reduced motion; the group is `accessibilityRole="progressbar"` with `accessibilityLabel={label}`.
- `MascotLoading({ label: string; size?: number /* default 140 */; startup?: boolean })`: restored from `git show d33069f0^:apps/customer/src/mascot-loading.tsx` into `packages/mobile-ui`, layers from `packages/brand/assets/mascot-motion/`, timings from `packages/brand/motion.ts`; visible group after 300ms (status label immediately), no minimum time, static `neutral` pose under reduced motion, paused in background or when its screen loses focus, everything cancelled on unmount.
- `ToastProvider({ children; os?: string })`, `useToast(): { show(input: ToastInput): void; hide(): void }`, `ToastInput = { message: string; action?: { label: string; onPress: () => void }; tone?: "success" | "error" }`. iOS pill under the header (radius 22, min height 44), Android snackbar above the navigation bar (radius 4, min height 48). One at a time; a new toast replaces the shown one; auto-dismiss 3000ms, 5000ms with an action; `AccessibilityInfo.announceForAccessibility(message)` once per show; enter 12dp slide plus fade (`content`, iOS from above, Android from below), leave fade (`control`); instant under reduced motion.
- Tokens: `nativeThemes.light|dark` gain `toast`, `onToast`, `toastAction` (light `#2E2E2E` / `#FFF7E9` / `#BFD8BB`; dark `#F5F1E8` / `#2E2E2E` / `#163D2E`).
- `useRowMotion(): { entering?: EntryOrExitLayoutType; exiting?: EntryOrExitLayoutType; layout?: LayoutAnimationType }`: entering fade plus 8dp rise over `content` with the Catera ease, exiting fade over `control`, layout `LinearTransition` over `content`; all `undefined` under reduced motion.
- `sheetOptions({ detents, palette, os }: { detents: "fit" | "form"; palette: NativePalette; os?: string }): NativeStackNavigationOptions`: `presentation: "formSheet"`, `sheetGrabberVisible: true`, `sheetAllowedDetents` `"fitToContents"` (fit) or `[0.6, 1]` (form), `sheetCornerRadius: 28` on Android only, `contentStyle: { backgroundColor: palette.surface }`, `headerShown: false`.
- `SheetHeader({ title: string; context?: string; onClose?: () => void; os?: string })`: iOS a 44pt leading Close (`HeaderIconButton icon="close"`, label "Tutup"), title 17 bold centred; Android the 32×4 drag handle in a 36dp band and the title 22 bold start-aligned, no Close (back and swipe close).

**Depends on:** Task 1

**Builder:** opus

**States:** light and dark; reduced motion on and off; font scale 1.3 at 360dp (toast text wraps to two lines, action stays on one); toast with and without action; error tone; two toasts in a row; mascot before and after the 300ms reveal; mascot when its screen loses focus.

- [ ] **Step 1: Write the failing tests** in `primitives.test.tsx`: `"skeleton blocks share one pulse and the group reads as a progress bar with its label"`; `"skeleton is static under reduced motion"`; `"mascot shows its label at once and its art after 300ms"`; `"mascot under reduced motion shows the neutral pose"`; `"a second toast replaces the first and each is announced once"`; `"a toast with an action stays 5 seconds, without one 3 seconds"` (fake timers); `"toast sits under the header on iOS and above the tab bar on Android"` (`os` param); `"row motion is undefined under reduced motion"`; `"sheetOptions fit uses fitToContents and a 28 corner only on Android"`; `"SheetHeader shows Close on iOS and a drag handle on Android"`. In `tests/native-contrast.test.ts`: `toast`/`onToast` ≥ 4.5:1 and `toastAction`/`toast` ≥ 4.5:1 in both themes.
- [ ] **Step 2:** Run the customer suite and `npx vitest run tests/native-contrast.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces. Wrap each app's root (inside `ThemeProvider`, around the navigator) in `ToastProvider`.
- [ ] **Step 4:** Both app suites, `npx vitest run tests/native-contrast.test.ts`, `npm run typecheck`. Expected: PASS. On the emulator, a temporary dev button is not allowed; check the toast later in Task 12.
- [ ] **Step 5: Commit** `feat(native): skeleton, mascot loader, toast, row motion and sheet primitives`.

### Task 3: Artwork runtime and mascot components

**Files:**
- Create: `packages/brand/build-phase-f-runtime.mjs`, `packages/brand/phaseF.ts` (generated by the script, committed), `packages/brand/assets/phase-f/runtime/*.png` (generated), `packages/mobile-ui/src/brand/MascotArt.tsx`, `packages/mobile-ui/src/brand/MascotReading.tsx`, `packages/mobile-ui/src/brand/SuccessRig.tsx`, `packages/mobile-ui/src/brand/Sparkle.tsx`, `packages/mobile-ui/src/brand/SuccessRing.tsx`
- Modify: `packages/brand/assets/phase-f/processing-records.json` (append runtime records), `packages/brand/manifest.brand.json` (record the runtime derivatives), `packages/mobile-ui/src/index.ts`
- Test: `tests/brand-phase-f.test.ts` (create, Vitest), `apps/customer/tests/mascot-art.test.tsx` (create)

**Interfaces (Produces):**
- Script: reads each still and rig layer, writes 600×600 Lanczos downscales to `runtime/` (never larger than the source), appends a record (`name`, `source`, `sha256`, `method`) to `processing-records.json`, and writes `phaseF.ts` with `visibleBox: Record<MascotPose, { x: number; y: number; w: number; h: number }>` measured from alpha > 8 on the 1254 source, normalised to 0..1.
- `type MascotPose = "merayakan" | "membaca" | "tidur" | "bingung" | "melambai" | "mencari" | "memasak"`.
- `MascotArt({ pose: MascotPose; size: number })`: renders the runtime still inside a `size × size` box, scaled and offset so the pose's `visibleBox` height equals `size` (width follows), transparent padding cropped by `overflow: "hidden"`; `accessible={false}`.
- `SuccessRig({ size: number; play: boolean; onDone?: () => void })`: stacks the seven success layers at one origin per `rig.json` `successRig` draw order; when `play` turns true, runs the spec 6.2 timeline (body squash and hop about `bodyPivot`, lid rotation about `lidHinge`, badge pop about `badgePivot`, sparkles fade) on Reanimated shared values, transform and opacity only, ending on its resting frame; under reduced motion renders `MascotArt pose="merayakan"` instead.
- `MascotReading({ size: number })`: the reading rig per `rig.json` `readingRig` (magnifier ±4° about its grip, eyes following, the code-drawn sunrise paper highlight, per-eye blink); `mascot-membaca` under reduced motion; pauses when its screen loses focus.
- `Sparkle({ kind: "star" | "dot"; color: string; size: number })` (react-native-svg), `SuccessRing({ size: number; progress: SharedValue<number> })` (a `#FFEFD9` disc with a 3dp sunrise-ink ring, scale from 0.35 to 1 driven by `progress`).

**Depends on:** Task 1

**Builder:** opus (the script part may be delegated to a sonnet sub-dispatch by the controller)

**States:** each pose at 120 and 180; light and dark; reduced motion; rig played twice in one mount (second `play` restarts from rest); `onDone` fires once per play.

- [ ] **Step 1: Write the failing tests:** `tests/brand-phase-f.test.ts`: `"every runtime copy is at most 600px and no larger than its source"`, `"runtime copies keep real alpha"`, `"phaseF visible boxes exist for all seven poses and lie inside 0..1"`, `"processing records list every runtime copy with a matching sha256"`. `mascot-art.test.tsx`: `"MascotArt scales the pose so its visible height equals size"` (compute expected transform from a fixture box), `"SuccessRig under reduced motion renders the merayakan still"`, `"SuccessRig calls onDone once per play"`, `"mascot art is hidden from screen readers"`.
- [ ] **Step 2:** `npx vitest run tests/brand-phase-f.test.ts` and the customer suite. Expected: FAIL.
- [ ] **Step 3: Implement.** Run `node packages/brand/build-phase-f-runtime.mjs`, then `node packages/brand/verify-phase-f.mjs` (must still pass for the 23 exports).
- [ ] **Step 4:** The tests above, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(brand): Phase F runtime art, MascotArt and the success and reading rigs`.

### Task 4: Launch sequence, cache-first paint and splash

**Files:**
- Modify: `packages/mobile-core/src/provider.tsx`, `packages/mobile-core/src/data.ts`, `packages/mobile-ui/src/theme.tsx`, `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx`, `apps/customer/app.config.ts`, `apps/caterer/app.config.ts`, `apps/customer/src/today/Beranda.tsx`, `apps/customer/src/today/offline.ts`, `apps/caterer/src/today/TodayScreen.tsx`, `apps/caterer/src/today/offline.ts`
- Create: `packages/mobile-ui/src/LaunchCover.tsx`
- Test: `apps/customer/tests/launch.test.tsx`, `apps/caterer/tests/launch.test.tsx` (create), `tests/app-config.test.ts` (create, Vitest)

**Interfaces:**
- Consumes: `MascotLoading`, `SkeletonGroup` (Task 2).
- Produces (`MobileContextValue`): `booted: boolean` (the stored actor and token have been read); `refreshing: boolean` (a `me()` is in flight after boot). `ready` keeps its meaning for screens (an actor or a definite signed-out answer is known) but now turns true at boot when a stored actor and token exist. Only one `me()` runs at launch (the AppState "active" event and the stored-locale read no longer start a second one).
- Produces: `useData<T>(key, loader, options?: { cached?: () => Promise<T | null> })` returns `{ data, error, loading, reload, stale, fromCache: boolean }`; with `cached`, the cached value paints first (`fromCache: true`) and is replaced by the loader's result.
- Produces: `useThemePreference()` gains `loaded: boolean` (the stored choice has been read or failed).
- Produces: `LaunchCover({ scheme: "light" | "dark"; onDone: () => void })`: the canvas with the splash mark at the native splash's size and position, scales 1 to 1.04 and fades out over `feature` 320ms with three `Sparkle`s drifting out; `pointerEvents="none"` from the start of the fade; not rendered under reduced motion or on a warm start.
- App configs: splash light `#FDFAF3` + `packages/brand/assets/phase-f/splash-mark-light.png`, dark `#151514` + `splash-mark-dark.png`, `imageWidth: 200`; Android adaptive `foregroundImage` `phase-f/adaptive-foreground.png`, `backgroundColor` `#163D2E`, `monochromeImage` `phase-f/icon-monochrome.png`; iOS icon light `app-icon.png`, dark `phase-f/icon-ios-dark.png`, tinted `phase-f/icon-ios-tinted.png` (use the SDK 57 app-config shape for per-appearance iOS icons; if SDK 57 has none, keep `app-icon.png` and report it).

**Depends on:** Task 2

**Builder:** opus

**States:** first launch signed out (gate shows `MascotLoading` "Menyiapkan Catera untuk Anda…" only if `me()` takes over 300ms); first launch signed in on a new phone (no cache: Beranda skeleton under the live header); warm start with cache (cached Beranda with "Memperbarui…" caption, actions hidden until fresh); fresh read fails (cache stays with "Terakhir diperbarui HH.MM · tidak ada koneksi", today's offline line); `me()` returns UNAUTHORIZED after a cached paint (back to signed-out, cache cleared); stored theme dark on a light phone (first frame dark); fonts slow (splash still held, 1500ms ceiling); Dapur owner and staff with a cached day; reduced motion (no `LaunchCover`).

- [ ] **Step 1: Write the failing tests:** customer `launch.test.tsx`: `"the splash stays until fonts, theme and the stored session are read"` (`SplashScreen.hideAsync` mock called once, after the three resolve); `"the splash hides after 1500ms even if a local read hangs"`; `"a stored session paints the cached Beranda before me() answers, with Memperbarui"`; `"actions are hidden on the cached paint and appear after the fresh read"` (Review Focus 1: no "Sudah sampai", no "…" on the cached plate); `"after logout the next launch paints no cached home"` (Review Focus 2: cache keyed by actor id and removed on logout); `"only one me() runs at launch even with an English locale and an active event"`; `"with no stored session the gate shows the mascot only after 300ms"`; `"LaunchCover is skipped under reduced motion"`. Caterer `launch.test.tsx`: `"a stored kitchen paints its cached day first with mutating actions hidden"`, `"staff with a cached day still only see Hari ini and Menu"`. `tests/app-config.test.ts`: `"both apps use the phase-f splash marks with light and dark backgrounds"`, `"both apps set the adaptive foreground, forest background and monochrome icon"`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.** `SplashScreen.preventAutoHideAsync()` at module scope in each root layout; hide when `fontsLoaded && themeLoaded && booted` or after 1500ms, whichever first. Replace the root `ActivityIndicator` gate with `MascotLoading` (shown only while `!ready` after boot). Beranda's `home:customer` and Dapur's day read pass `cached` from their existing `offline.ts` caches, now keyed by actor id; `logout` removes them. Render `LaunchCover` above the navigator on cold start.
- [ ] **Step 4:** Both app suites, `npx vitest run tests/app-config.test.ts`, `npm run typecheck`. Expected: PASS. Emulator (Expo Go): kill and relaunch each app signed in; record the first painted frame (cached content, no centred spinner) in `output/native-review/phase-f/launch-*.png`.
- [ ] **Step 5: Commit** `feat(native): hold the splash, paint from cache, one launch request, new splash and icons`.

### Task 5: Customer loading pass

**Files:**
- Create: `apps/customer/src/skeletons.tsx`
- Modify: every customer file listed in audit 008 finding 2 that renders `ActivityIndicator` as a screen or section loader (Beranda, Jelajah, Jadwal and `MonthGrid`, SavedList, PackageDetail, PlanList, PlanDetail, Akun, Addresses, Payments, Notifications, ReportList, ReportProblem, DayScreen, ChooseMenu, ClaimScreen, BuyScreen, PaymentScreen, EmptyHome's "Memuat paket…"); Beranda, Jadwal and Paket saya gain `RefreshControl`
- Test: `apps/customer/tests/no-spinner.test.ts`, `apps/customer/tests/skeletons.test.tsx` (create)

**Interfaces:**
- Consumes: `Skeleton`, `SkeletonGroup`, `FadeSwap`, `MascotLoading` (Task 2).
- Produces: one exported skeleton per screen in `skeletons.tsx` (`BerandaSkeleton`, `JelajahSkeleton`, `PlanSkeleton`, `ListSkeleton({ rows: number })`, `DaySkeleton`, `ChooseMenuSkeleton`, `JadwalCellsSkeleton`), each with its `SkeletonGroup` label ("Memuat beranda", "Memuat paket", "Memuat jadwal", "Memuat menu", "Memuat riwayat", …).
- Allowed `ActivityIndicator` uses after this task: inside `Button`/`StickyAction` busy states, inside a photo tile while it uploads, and `RefreshControl`. `ClaimScreen` while opening uses `MascotLoading` "Membuka tautan…"; `PaymentScreen` while checking uses `MascotLoading` "Memeriksa pembayaran…"; sign-in and OTP verification in progress use `MascotLoading` "Memeriksa kode…".

**Depends on:** Task 2

**Builder:** opus

**States:** each screen loading, loaded, failed (existing error copy and "Coba lagi" unchanged) and offline copy; light and dark; Siang and Malam on tab roots (`onMood` skeleton blocks in the header); font scale 1.3 at 360dp (skeleton heights match the loaded layout at 1.0; at 1.3 they may be shorter, never taller); reduced motion (static blocks); signed out (no skeleton where `SignInFirst` shows).

- [ ] **Step 1: Write the failing tests:** `no-spinner.test.ts` scans `apps/customer/src` and `apps/customer/app` and fails on any `ActivityIndicator` outside `Button`, `StickyAction`, photo upload tiles and `RefreshControl` usage, listing file:line. `skeletons.test.tsx`: `"Beranda loading shows its skeleton under the live mood header"`, `"skeleton swaps to content in one FadeSwap, not per row"`, `"Jadwal loading draws skeleton cells inside the six-row frame"`, `"Payment while checking shows the mascot with Memeriksa pembayaran"`, `"pull to refresh on Beranda keeps content on screen while it reloads"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Replace each loader; keep every existing error and empty state.
- [ ] **Step 4:** Customer suite, typecheck. Emulator: open each listed screen with the network throttled (`adb shell svc data disable` after first launch is not needed; use the demo backend's slow flag if present, else a cold open) and capture the skeleton of Beranda, Jelajah, Jadwal and plan detail.
- [ ] **Step 5: Commit** `feat(customer): skeletons instead of spinners`.

### Task 6: Dapur loading pass

**Files:**
- Create: `apps/caterer/src/skeletons.tsx`
- Modify: the Dapur screens that show bare "Memuat…" text or a spinner as a screen or section loader (TodayScreen, MenuWeek, MenuDayScreen, CustomerList, CustomerDetail, ReportScreen, UsahaScreen, UangScreen, AktifkanScreen, `paket/[id].tsx`, `paket/baru.tsx`); Hari ini and Pelanggan gain `RefreshControl`
- Test: `apps/caterer/tests/no-spinner.test.ts`, `apps/caterer/tests/skeletons.test.tsx` (create)

**Interfaces:** As Task 5, for Dapur: `TodaySkeleton` (count-card numbers on the mood surface and four checklist rows), `MenuWeekSkeleton`, `ListSkeleton({ rows })`, labels "Memuat dapur", "Memuat menu", "Memuat pelanggan", "Memuat laporan", "Memuat uang". Allowed `ActivityIndicator` uses as in Task 5 plus MenuWeek's "Mengunggah…" photo tile.

**Depends on:** Task 2

**Builder:** opus

**States:** owner and staff; each screen loading, loaded, failed, offline copy ("tidak ada sinyal" card unchanged); light and dark; Siang and Malam on Hari ini and Menu; font scale 1.3 at 360dp; reduced motion.

- [ ] **Step 1: Write the failing tests:** `no-spinner.test.ts` (same rule for `apps/caterer`); `skeletons.test.tsx`: `"Hari ini loading shows the count card and checklist skeleton under the live header"`, `"staff loading never shows Usaha skeletons"`, `"pull to refresh on Hari ini keeps the session on screen"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Caterer suite, typecheck. Emulator capture of Hari ini and Pelanggan loading.
- [ ] **Step 5: Commit** `feat(caterer): skeletons instead of loading text`.

### Task 7: `device.unregister`

**Files:**
- Create: `supabase/migrations/20261011090000_device_unregister.sql`, `tests/device-unregister.test.ts`
- Modify: `tests/postgres-concurrency.mjs` (one scenario), `packages/mobile-core/src/runtime.ts` only if the command list is typed there

**Interfaces:**
- Produces: command `device.unregister` with payload `{ token: string }` (exactly one key, a non-empty string, else `INVALID_INPUT`); signed out `UNAUTHORIZED`; deletes `v1.devices` where `token = payload.token and user_id = auth.uid()`; returns `{ removed: 0 | 1 }`; a token owned by another user is untouched and returns `{ removed: 0 }`. Follow the wrapper pattern of `20261009090000_kitchen_cooking.sql` (rename the current `public.catera_v1_command` to a `_unregister_base`, re-create the wrapper that handles `device.unregister` and delegates everything else).

**Depends on:** none

**Builder:** sonnet

- [ ] **Step 1: Write the failing tests** (`tests/device-unregister.test.ts`, following `tests/delivery-cook.test.ts`): `"removes the caller's own token"`, `"leaves another user's token in place"`, `"repeating it returns removed 0"`, `"rejects extra keys and empty tokens"`, `"signed out is UNAUTHORIZED"`, `"other commands still reach the base"` (`device.register` round trip).
- [ ] **Step 2:** `npx vitest run tests/device-unregister.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration. The demo backend applies migrations through `packages/backend/src/database.ts`; confirm the demo path reaches the new command in the report.
- [ ] **Step 4:** The test, `npm test`, `npm run typecheck`, `npm run test:postgres` with the new scenario (two sessions unregister the same token at once: one `removed: 1`, one `removed: 0`, no error). Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): device.unregister removes only the caller's token`.

### Task 8: Pengaturan in both apps

**Files:**
- Create: `packages/mobile-core/src/push.ts` (from `apps/customer/src/account/push.ts`), `packages/mobile-ui/src/settings/SettingsRows.tsx`, `packages/mobile-ui/src/settings/ThemeChoice.tsx`, `apps/customer/src/settings/Pengaturan.tsx`, `apps/customer/src/settings/ChoiceSheets.tsx`, `apps/caterer/src/settings/Pengaturan.tsx`, `apps/caterer/src/settings/ChoiceSheets.tsx`, routes `apps/customer/app/(tabs)/(index,jadwal,jelajah,akun)/pengaturan.tsx`, `.../tampilan.tsx`, `.../bahasa.tsx`, and the same three under `apps/caterer/app/(tabs)/(index,pelanggan,menu,usaha)/`
- Modify: both array-group `_layout.tsx` (declare `tampilan` and `bahasa` with `sheetOptions({ detents: "fit" })`), `apps/customer/src/account/Akun.tsx`, `apps/customer/src/account/Notifications.tsx`, `apps/caterer/src/business/UsahaScreen.tsx`; delete `apps/caterer/src/business/NotifyButton.tsx` and `apps/customer/src/account/push.ts`
- Test: `apps/customer/tests/settings.test.tsx`, `apps/caterer/tests/settings.test.tsx` (create); update `account.test.tsx`, `business.test.tsx`

**Interfaces:**
- Consumes: `device.unregister` (Task 7), `sheetOptions`, `SheetHeader`, `useToast` (Task 2).
- Produces: `usePushSwitch(channelName: string): { state: "on" | "off" | "denied" | "unavailable" | "loading"; turnOn(): Promise<void>; turnOff(): Promise<void> }`, reading on focus `Notifications.getPermissionsAsync()` and the SecureStore flag `push.<actorId>`; `unavailable` when `pushAvailable` is false (Expo Go). `turnOn` requests permission, registers (`enablePush`), sets the flag; `turnOff` reads the device token and sends `device.unregister`, clears the flag; a failure keeps the previous true state and shows the error toast "Belum berhasil. Coba lagi.".
- Produces: `SettingsSection({ title; children })`, `SettingsRow({ label; value?; supporting?; onPress?; tone?: "danger" })`, `SettingsSwitchRow({ label; supporting; value; disabled?; onValueChange })` (native `Switch`, track `forest`), `ThemeChoice({ value: ThemePreference; onChange; labels })` (the three thumbnails from the canvas `SettingsSheet`, `radiogroup`).
- Entry: a trailing gear `HeaderIconButton` ("Pengaturan") on Akun and Usaha (both platforms) and a "Pengaturan" row at the end of each; signed-out Akun keeps the entry.

**Depends on:** Tasks 2 and 7

**Builder:** opus

**States:** signed out (no Notifikasi section, no Keluar); push on, off, denied ("Izinkan notifikasi di Pengaturan ponsel" with "Buka Pengaturan" calling `Linking.openSettings()`), unavailable in Expo Go ("Tidak tersedia di versi aplikasi ini", switch disabled); turning off fails (switch returns on, error toast); Bahasa Indonesia and English; Tampilan Sistem, Terang, Gelap (Android label "Ikuti sistem"); Dapur staff (they have no Usaha tab, so they reach Pengaturan from a trailing gear on the Menu tab root); light and dark; font scale 1.3 at 360dp.

- [ ] **Step 1: Write the failing tests:** customer `settings.test.tsx`: `"Akun has a Pengaturan entry and no inline Bahasa or Tampilan"`; `"Pengaturan lists Notifikasi, Bahasa, Tampilan, Versi aplikasi, Syarat dan privasi and Keluar in that order"`; `"the switch reads the phone permission on focus"` (Review Focus 4: permission `denied` after a focus event shows off and the system-settings line); `"turning off sends device.unregister with this device's token and clears the flag"`; `"a failed turn-off keeps the switch on and shows the error toast"`; `"Expo Go shows the switch as unavailable"`; `"Tampilan sheet applies the choice at once and closes"`; `"Versi aplikasi reads the app config version"`; `"signed out shows Bahasa and Tampilan only"`. Caterer `settings.test.tsx`: `"Usaha has no notifications button and links to Pengaturan"`, `"staff reach Pengaturan from Menu"`, `"Dapur supporting copy reads Pesanan baru, laporan, pembayaran"`.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both suites, typecheck. Emulator: open Pengaturan in both apps, switch Tampilan and Bahasa, check the switch's unavailable state in Expo Go.
- [ ] **Step 5: Commit** `feat(native): Pengaturan with a truthful notification switch`.

### Task 9: Sheet foundations and Ada masalah (go/no-go)

**Files:**
- Create: `packages/mobile-ui/src/sheets.ts` (confirm and action registries), `packages/mobile-ui/src/ConfirmSheet.tsx`, `packages/mobile-ui/src/ActionSheet.tsx`, `apps/customer/app/konfirmasi.tsx`, `apps/customer/app/aksi.tsx`, `apps/caterer/app/konfirmasi.tsx`, `apps/caterer/app/aksi.tsx`
- Modify: both root `app/_layout.tsx` (declare `konfirmasi` and `aksi` with `sheetOptions({ detents: "fit" })`), the customer array-group `_layout.tsx` (`masalah/[id]` becomes `sheetOptions({ detents: "form" })`), `apps/customer/src/help/ReportProblem.tsx`, `apps/customer/src/nav.ts` (cold `/masalah/{id}` opens over `/hari/{id}`)
- Test: `apps/customer/tests/sheets.test.tsx` (create), update `help.test.tsx`, `navigation.test.tsx`

**Interfaces (Produces):**
- `useConfirm(): (input: { title: string; message: string; confirmLabel: string; cancelLabel: string; tone?: "danger"; icon?: "rantang" | "trash" | "flag" }) => Promise<boolean>`: opens `/konfirmasi?id=…`; resolves `true` on confirm, `false` on cancel, Close, swipe or back (a `beforeRemove` listener resolves `false` when nothing was chosen).
- `useActionSheet(): (input: { title: string; context?: { image?: string; title: string; lines: string[] }; items: { key: string; label: string; icon: string; tone?: "danger"; disabled?: boolean }[] }) => Promise<string | null>`: opens `/aksi?id=…`, resolves the chosen key or `null`; destructive items render last.
- `ConfirmSheet` and `ActionSheet` render the canvas boards `ConfirmSheet` and `ActionSheet` (icon circle, title, consequence, two buttons side by side on iOS and end-aligned text and filled buttons on Android; action rows 52dp iOS / 56dp Android with a divider before a danger row).
- `useUnsavedGuard(dirty: boolean, noun: string)`: on remove with `dirty`, `useConfirm` "Buang {noun}?" / "Yang sudah kamu tulis akan hilang." (Dapur) or "… Anda tulis …" (customer), "Buang" (danger) and "Lanjut menulis".

**Depends on:** Task 2

**Builder:** opus

**States:** Ada masalah with a meal pre-selected and with a day of two meals (meal choice shown); empty note, typed note; send success (sheet closes, toast "Laporan terkirim · Lihat" opening Bantuan; the old full "Laporan terkirim" page goes); `CONFLICT` and `NOT_ALLOWED` errors inline as today; cold link; light and dark; keyboard open (iOS `automaticallyAdjustKeyboardInsets`, Android sheet expands to its top detent); font scale 1.3; TalkBack focus starts on the sheet title.

- [ ] **Step 1: Write the failing tests:** `"masalah is a form sheet with the form detents"`; `"useConfirm resolves false when the sheet is swiped away"`; `"action sheet puts the destructive item last"`; `"typed text asks before closing, empty does not"` (Review Focus 3); `"a cold masalah link opens over its Hari"` (Review Focus 3); `"sending closes the sheet and shows Laporan terkirim with Lihat"`; `"a CONFLICT stays in the sheet with its message"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Go/no-go on the emulator** (Expo Go, Android): open Ada masalah from a Hari row; check (a) the sheet opens at the form detent, (b) typing expands it and the keyboard never covers the focused field, (c) hardware back and swipe close it once and keep Hari, (d) TalkBack lands on the title, (e) the confirm sheet opens over it and returns. Record each as PASS/FAIL with a capture in `output/native-review/phase-f/sheets-*.png`. **If any check fails, stop, do not merge, and report** the failing check, the react-native-screens behaviour and the smallest fallback (keeping the custom `Sheet` for forms with fields while choice, action and confirm sheets stay native). The controller takes it to the owner before Tasks 10 and 11.
- [ ] **Step 5:** Customer suite, typecheck. Expected: PASS.
- [ ] **Step 6: Commit** `feat(native): native confirm and action sheets, Ada masalah as a sheet`.

### Task 10: Customer sheets and day actions

**Files:**
- Create routes in the customer array group: `alamat-form.tsx` (`?id=` to edit), `bantuan-form.tsx` (`?kind=help|review&…`), `ubah-hari/[id].tsx`, `ulasan/[id].tsx`, `area.tsx`; root stack: `pembelian/alamat-pilih.tsx`, `pembelian/mulai.tsx`
- Modify: the array-group `_layout.tsx` and the root `_layout.tsx` (sheet options), `apps/customer/src/account/Addresses.tsx`, `apps/customer/src/help/ReportList.tsx`, `apps/customer/src/schedule/ChangeDaySheet.tsx`, `apps/customer/src/today/WaitingList.tsx`, `apps/customer/src/buy/BuyParts.tsx`, `apps/customer/src/buy/BuyScreen.tsx`, `apps/customer/src/discover/Jelajah.tsx`, `apps/customer/src/schedule/ChooseMenu.tsx` (two `Alert.alert` → `useConfirm`), `apps/customer/src/schedule/DayScreen.tsx`, `apps/customer/src/today/Plate.tsx` (hero "…"), `apps/customer/src/plan/PlanDetail.tsx` (upcoming rows "…")
- Test: `apps/customer/tests/customer-sheets.test.tsx` (create); update `account.test.tsx`, `help.test.tsx`, `schedule.test.tsx`, `buy.test.tsx`, `discover.test.tsx`, `choose-menu.test.tsx`, `today.test.tsx`, `plan.test.tsx`

**Interfaces:**
- Consumes: `sheetOptions`, `SheetHeader`, `useConfirm`, `useActionSheet`, `useUnsavedGuard`, `useToast` (Tasks 2 and 9).
- Day actions (`useDayActions(delivery): () => Promise<void>` in `apps/customer/src/schedule/dayActions.ts`): items "Pindah tanggal" (only before the cutoff and not a fixed plan), "Ganti alamat hari ini" (only before the cutoff), "Chat {katerer}" (only when the read holds the caterer's phone), "Laporkan masalah" (danger, only when a report is allowed today); the context block shows the dish photo, the main dish (or "Menu belum ditentukan"), "{Makan siang|Makan malam} · {katerer}" and "Bisa diubah sampai {hari HH.MM}" or "Sudah lewat batas ubah".
- Toasts on success: "Alamat disimpan", "Alamat dihapus", "Permintaan bantuan terkirim", "Hari dipindah ke {Senin 12 Okt}", "Ulasan terkirim", "Menu {Selasa} tersimpan".

**Depends on:** Task 9

**Builder:** opus

**States:** before and after cutoff; fixed plan; no caterer phone; a day already reported; Beli open with its sheets (the purchase stays under; Close returns to it); Jelajah area with no saved area; ChooseMenu with unsaved changes; signed out (no "…"); light and dark; font scale 1.3; reduced motion (sheets fade).

- [ ] **Step 1: Write the failing tests:** `"each short task opens as a form sheet"` (route options for alamat-form, bantuan-form, ubah-hari, ulasan, area, pembelian/alamat-pilih, pembelian/mulai); `"the day's … sheet lists only allowed actions, report last"` (after cutoff: no Pindah tanggal, no Ganti alamat); `"saving an address closes the sheet and toasts Alamat disimpan"`; `"moving a day toasts the new date"`; `"discarding menu changes asks through a confirm sheet"`; `"Beli's address picker returns to Beli with the chosen address"`; `"the custom Sheet is no longer imported by the customer app"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Pages that stay pages per spec 5.3 are untouched.
- [ ] **Step 4:** Customer suite, typecheck. Emulator: every new sheet once (open, act, close), the day "…" sheet before and after cutoff.
- [ ] **Step 5: Commit** `feat(customer): short tasks in native sheets, day actions sheet`.

### Task 11: Dapur sheets and confirm sheets

**Files:**
- Create routes in the Dapur array group: `tim.tsx` becomes a sheet route (same path), `balas/[id].tsx`, `atur-antaran/[id].tsx`; root stack: `impor-baris.tsx`; `apps/caterer/src/import/store.ts` (import state shared by `impor` and `impor-baris`)
- Modify: both Dapur `_layout.tsx` files, `apps/caterer/src/business/TimScreen.tsx`, `apps/caterer/src/today/ReportScreen.tsx`, `apps/caterer/src/today/ExceptionSheet.tsx`, `apps/caterer/src/today/TodayScreen.tsx` (two `Alert.alert` → `useConfirm`), `apps/caterer/src/import/ImportAssistant.tsx` (row editor to the sheet route), `apps/caterer/src/business/UsahaScreen.tsx` (package row "…"); delete the `Sheet` export from `packages/mobile-ui/src/components.tsx` if no caller remains
- Test: `apps/caterer/tests/dapur-sheets.test.tsx` (create); update `kitchen-loop.test.tsx`, `today.test.tsx`, `import.test.tsx`, `report.test.tsx`, `business.test.tsx`

**Interfaces:**
- Consumes: as Task 10.
- Confirm copy unchanged: "Mulai masak makan siang?" / "… makan malam?", "Pelanggan melihat status Dimasak.", "Batal", "Mulai"; "Berangkat antar sekarang?", "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat.", "Batal", "Berangkat". Icon `rantang`.
- Package "…": "Lihat paket", "Salin jadi paket baru".
- Toasts: "Undangan dibagikan", "Balasan terkirim", "Laporan tersimpan", "Paket disalin".
- `useImportStore()` in `src/import/store.ts`: `{ rows, files, text, setRow(n, row), removeRow(n), … }` (the current `ImportAssistant` state moved out unchanged in shape, plus `uri` on images from Task 15).

**Depends on:** Task 9

**Builder:** opus

**States:** owner and staff (staff have no Tim, no package "…", but do have Mulai masak and stop exceptions); stop "…" with move only, report only and both (existing names unchanged); offline copy (no "…"); a late tap that changed nothing (`{moved: 0}` caption unchanged); import row with errors; light and dark; font scale 1.3.

- [ ] **Step 1: Write the failing tests:** `"Mulai masak asks in a confirm sheet with the existing copy"`; `"cancelling the confirm sends nothing"`; `"stop exceptions open as a form sheet and keep their names"`; `"the import row editor edits the shared store and returns"`; `"Tim is a sheet that shares the invite and toasts"`; `"a package row offers Lihat paket and Salin jadi paket baru"`; `"no Dapur file imports Alert.alert or the custom Sheet"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Caterer suite, typecheck. Emulator: Mulai masak and Berangkat antar confirm, a stop "…", the import row sheet.
- [ ] **Step 5: Commit** `feat(caterer): native sheets and confirm sheets`.

### Task 12: Feedback: success beat, confetti, heart, toasts, row motion

**Files:**
- Create: `packages/mobile-ui/src/SuccessBeat.tsx`, `packages/mobile-ui/src/Confetti.tsx`, `packages/mobile-ui/src/SaveHeart.tsx`
- Modify: `apps/customer/src/buy/PaidOutcome.tsx`, `apps/customer/src/buy/PaymentScreen.tsx`, `apps/customer/src/discover/saved.ts`, `apps/customer/src/discover/PackageCard.tsx`, `apps/customer/src/discover/PackageDetail.tsx`, `apps/customer/src/discover/SavedList.tsx`, `apps/customer/src/account/Addresses.tsx`, `apps/customer/src/today/WaitingList.tsx`, `apps/caterer/src/business/PackageEditor.tsx`, `apps/caterer/src/menu/MenuDayScreen.tsx`, `apps/caterer/src/menu/MenuWeek.tsx` (slot rows), `apps/caterer/src/customers/CustomerList.tsx`, `packages/mobile-ui/src/index.ts`
- Test: `apps/customer/tests/feedback.test.tsx`, `apps/caterer/tests/feedback.test.tsx` (create); update `buy.test.tsx`, `discover.test.tsx`

**Interfaces:**
- Consumes: `SuccessRig`, `SuccessRing`, `Sparkle`, `MascotArt` (Task 3); `useToast`, `useRowMotion` (Task 2).
- `SuccessBeat({ title: string; play: boolean; confetti?: boolean; children })`: `SuccessRing` (420ms) behind `SuccessRig` at 180, five `Sparkle`s bursting 450 to 1050ms, `children` fading up as one block from about 620ms (`content`), one `success` haptic on the first frame of a play. `play` false renders the resting frame. Reduced motion: `MascotArt pose="merayakan" size={180}` and the facts, no movement, the haptic kept.
- `Confetti({ play: boolean })`: `lottie-react-native` `LottieView` with `packages/brand/assets/phase-f/confetti.json`, `loop={false}`, `pointerEvents="none"`, absolute over the screen; not rendered under reduced motion.
- `SaveHeart({ saved: boolean; onToggle: () => void; label: string })`: 48dp; save plays the scale 1 → 1.22 → 1 spring and five dots (sunrise ink and sunrise) bursting within 380ms with the `select` haptic; unsave swaps to the outline at once with no haptic.
- First-milestone facts: customer confetti when the read shows no earlier subscription with a paid checkout besides this one; Dapur confetti when no earlier published package exists. Both from data already in the reads; if a read cannot tell, no confetti.

**Depends on:** Tasks 2 and 3

**Builder:** opus

**States:** paid while open (beat plays, haptic once); opened already paid (resting frame, no haptic; Review Focus 5); renewal paid; first purchase (confetti) and later purchase (none); reduced motion (still, haptic kept); Dapur first publish (beat and confetti), later publish (toast "Paket diterbitkan"); day menu saved (toast "Menu {Selasa} tersimpan"); import saved ("{n} pelanggan tersimpan" beat replacing the sage card, with "Lihat Pelanggan"); heart save and unsave with undo; Disimpan remove (row exits, neighbours slide, toast with "Urungkan" restores it); address delete (row exits); waiting row leaves after its action; Dapur Menu slot add and remove; Pelanggan after an import while open (new rows enter); light and dark; font scale 1.3.

- [ ] **Step 1: Write the failing tests:** customer `feedback.test.tsx`: `"turning paid while open plays the beat with one success haptic"`; `"opened already paid shows the resting frame with no haptic"` (Review Focus 5); `"reduced motion shows merayakan and still fires the haptic"` (Review Focus 5); `"confetti only on the first paid plan"`; `"saving a package pops the heart, haptics and toasts Disimpan with Lihat"`; `"unsaving toasts with Urungkan and undo saves again"`; `"removed rows use the row motion and no first load staggers"` (assert `entering` undefined on initial render rows). Caterer `feedback.test.tsx`: `"the first publish plays the beat, later publishes toast"`, `"a saved day menu toasts its weekday"`, `"import saved plays the beat with the count"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** `PaymentScreen` keeps its `FadeSwap` per stage; the paid body hosts `SuccessBeat` with `play` true only on the in-view transition (the existing D8 logic).
- [ ] **Step 4:** Both suites, typecheck. Emulator: pay in demo and watch the beat; save and unsave a package; remove from Disimpan and undo; publish a package in Dapur. Record captures.
- [ ] **Step 5: Commit** `feat(native): success beat, confetti, heart, toasts and row motion`.

### Task 13: Empty and error states with mascot art

**Files:** `apps/customer/src/today/EmptyHome.tsx`, `apps/customer/src/today/Beranda.tsx` (no delivery today and nothing next), `apps/customer/src/schedule/Jadwal.tsx` (month with no meals), `apps/customer/src/discover/Jelajah.tsx` (no results), `apps/customer/src/discover/SavedList.tsx` (empty), `apps/customer/src/account/Notifications.tsx` (no updates), `apps/customer/src/shell.tsx` ("Belum bisa terhubung"), the customer sign-in screens (`apps/customer/app/login.tsx` and what it renders), `apps/customer/src/claim/ClaimScreen.tsx` (preview), the customer "Belum bisa memuat" states; `apps/caterer/src/today/TodayScreen.tsx` (no session, Semua beres, cooking), `apps/caterer/src/ErrorBoundary.tsx` and the Dapur "Belum bisa memuat" states; test `apps/customer/tests/empty-states.test.tsx`, `apps/caterer/tests/empty-states.test.tsx` (create)

**Interfaces:** Consumes `MascotArt` (Task 3). Mapping (spec 7.2): `tidur` nothing scheduled (Beranda, Jadwal, Dapur no session, Notifikasi empty); `bingung` connection and load failures; `melambai` sign-in, claim preview, `EmptyHome`; `mencari` Jelajah no results, empty Disimpan; `memasak` Dapur session cooking (beside the count card's numbers, 72); `merayakan` Dapur Semua beres. Size 120, centred above the title, never beside food photography; existing copy and actions unchanged.

**Depends on:** Tasks 3, 5 and 6

**Builder:** opus

**States:** each mapped state in light and dark; font scale 1.3 at 360dp (art shrinks to 96 so the title and action stay above the fold); reduced motion (no change: stills).

- [ ] **Step 1: Write the failing tests:** `"each empty and error state shows its pose and keeps its copy and action"` (table-driven over the mapping), `"mascot art is hidden from screen readers"`, `"no mascot art next to a food photo"` (Beranda hero, plan detail hero).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both suites, typecheck. Emulator captures of four states.
- [ ] **Step 5: Commit** `feat(native): mascot art in empty and error states`.

### Task 14: Macros

**Files:** `apps/customer/src/discover/PackageDetail.tsx`, `apps/customer/src/discover/PackageCard.tsx` (Jelajah row line), create `apps/customer/src/discover/NutritionCard.tsx`; `apps/caterer/src/business/package.ts` (`PackageForm.nutrition`, `quickOffer`, `formFromOffer`), `apps/caterer/src/business/PackageEditor.tsx`, create `apps/caterer/src/business/NutritionFields.tsx`, the Dapur package view (`app/(tabs)/(index,pelanggan,menu,usaha)/paket/[id].tsx` screen); tests `apps/customer/tests/nutrition.test.tsx`, `apps/caterer/tests/nutrition.test.tsx` (create), `tests/caterer-quick-package.test.ts` (update)

**Interfaces:**
- Consumes: `packageNutrition`, `nutritionMetrics`, `nutritionSchema` from `@catera/domain` (exist; read their signatures, do not change them).
- `NutritionCard({ offer: Offer })`: tiles for the filled metrics in the order Kalori, Protein, Karbohidrat (Android tile label "Karbo"), Lemak; iOS two by two, Android four in a row wrapping at large text; ranges "580–640"; units "kkal" and "g"; zero shown as "0 g"; caption "Perkiraan dari katering. Bisa berbeda tiap menu."; nothing when no metric is filled. Under the package name "{kalori} kkal · {protein} g protein per porsi" when both exist. Jelajah rows "± {kalori} kkal" when calories exist (a range shows its lower bound with "±").
- `PackageForm` gains `nutrition: { range: boolean; caloriesKcal: [string, string]; proteinG: string; carbsG: string; fatG: string }`; `quickOffer` maps it to the domain nutrition shape (empty strings omitted, a range `{min, max}` only for calories when `range`); `formFromOffer` fills it from `offer.nutrition`; "Salin jadi paket baru" carries it.
- `NutritionFields`: section "Gizi per porsi (opsional)", "Pakai rentang" switch, numeric keyboards, inline errors from `nutritionSchema` ("Angka bulat saja", "Batas bawah tidak boleh lebih dari batas atas"), helper "Isi kalau kamu tahu. Pelanggan melihatnya sebagai perkiraan per porsi; kolom kosong tidak ditampilkan."

**Depends on:** none

**Builder:** opus

**States:** all four filled; only calories; a zero (`fatG: 0` shows "0 g"); a calorie range; none (no card, no line, no Jelajah suffix); demo seed packages (values from `packages/backend/src/seed.ts`); editor invalid range; copy from a package with macros; light and dark; font scale 1.3 at 360dp (tiles wrap, never truncate).

- [ ] **Step 1: Write the failing tests:** customer: `"the card shows filled metrics with units and the caption"`, `"zero is shown and an empty metric is not"`, `"a calorie range reads 580–640"`, `"no metrics, no card and no line"`, `"the Jelajah row shows ± kalori only when present"`. Caterer: `"quickOffer sends the entered macros and omits empty ones"`, `"a range sends min and max"`, `"min above max is refused with the message"`, `"Salin jadi paket baru carries the macros"`. Update `tests/caterer-quick-package.test.ts` for the new mapping.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Both suites, `npm test`, typecheck. Emulator: a demo package detail shows the card; create a Dapur package with macros and see them on its view.
- [ ] **Step 5: Commit** `feat(native): package macros for customers and in the Dapur editor`.

### Task 15: Import photo previews and the reading mascot

**Files:** `apps/caterer/src/import/images.ts` (`shrinkPhoto` returns `uri`), `apps/caterer/src/import/store.ts` (`Attachment` image gains `uri`), `apps/caterer/src/import/ImportAssistant.tsx`, create `apps/caterer/src/import/Attachments.tsx` and route `apps/caterer/app/impor-foto.tsx` (`fullScreenModal` photo viewer with Close); tests `apps/caterer/tests/import.test.tsx`, `apps/caterer/tests/import-images.test.tsx` (update)

**Interfaces:** Consumes `MascotReading` (Task 3), `useRowMotion` (Task 2), `useImportStore` (Task 11). `Attachments({ files; onRemove(index); onAddPhoto; max: 6 })`: label "Lampiran · {n} dari 6"; 76dp thumbnails (`expo-image`, radius 12, `sage` ground, cover fit) with a 28dp remove badge on a 48dp target labelled "Hapus foto {i}", each labelled "Foto {i} dari {n}"; a dashed "+ Foto" tile while under six; PDF and spreadsheet rows with a document icon, the file name and remove; tiles enter and leave with `useRowMotion`. While reading: `MascotReading` 120 with "Membaca daftar pelanggan…" and "{n} foto dan {m} file" in place of the button.

**Depends on:** Tasks 3 and 11

**Builder:** opus

**States:** no attachments; one to six photos; six (no "+ Foto"); photos plus a spreadsheet; a photo that fails to decode (sage ground, still removable); reading; read failed (existing error, attachments kept); offline (existing "off" state); light and dark; font scale 1.3.

- [ ] **Step 1: Write the failing tests:** `"picked photos show as thumbnails with remove targets"`, `"six photos hide the add tile"`, `"spreadsheets keep icon and name"`, `"tapping a thumbnail opens the viewer"`, `"reading shows the reading mascot with the counts"`, `"the picked uri is kept and the base64 still uploads"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Caterer suite, typecheck. Emulator: pick three photos from the emulator gallery, remove one, read.
- [ ] **Step 5: Commit** `feat(caterer): import photo previews and the reading mascot`.

### Task 16: Gate, DESIGN.md and evidence

**Files:** `DESIGN.md`, `docs/MASCOT-MOTION.md`, `anti-slop/audit-008-followup-<date>.md`, `output/native-review/phase-f/`, `docs/superpowers/kickoff/phase-g.md` (create)

**Depends on:** Tasks 1 to 15

**Builder:** opus

- [ ] **Step 1:** Full checks: `npm run typecheck`, `npm test`, `npm run build`, both app suites, `npm run test:postgres`, `node packages/brand/verify-phase-f.mjs`. Compare against the baseline lines.
- [ ] **Step 2: Android emulator gate** (Expo Go, demo backend) in light and dark (`adb shell cmd uimode night yes|no`) and Siang and Malam where relevant: cold start signed in and signed out (before and after captures), Beranda, Jelajah, Jadwal, plan detail, Pengaturan with each switch state reachable in Expo Go, every new sheet, the success beat, heart and toast, list motion, gizi, import, four empty states, Dapur Hari ini with confirm sheets; font scale 1.3 at 360dp; reduced motion (`settings put global animator_duration_scale 0` and "Remove animations"); TalkBack on the switch, a sheet, a toast and thumbnails. Record each Review Focus line as PASS or FAIL with a capture.
- [ ] **Step 3: iOS and native splash:** list as not verified (no Mac; Expo Go shows its own splash): the large-title sheets, keyboard in sheets, the iOS toast placement, the splash and icons on both platforms, the Android 12 splash mask.
- [ ] **Step 4:** One `opus` dispatch writes DESIGN.md from the approved Doc facts: Loading (three tiers, no full-screen spinner), Launch, Pengaturan, Action hierarchy and native sheets, Feedback (beat, toast, heart, row motion, confetti), Artwork use and optical size, Macros, Import previews, the Dapur MOTION 2 dial, the restated motion rule (Decision A), and the owner decisions of 2026-10-10 and 2026-10-11; then one scoped re-review. Update docs/MASCOT-MOTION.md (native mascot restored in `packages/mobile-ui`).
- [ ] **Step 5:** antislop Delivery Gate as PASS/FAIL with evidence in `audit-008-followup`, plus `impeccable` critique notes for the touched surfaces. Write the next-phase kickoff prompt in `docs/superpowers/kickoff/phase-g.md` (carry-overs: iOS run, dev build for splash and predictive back, any fallbacks taken in Task 9). Commit `docs: Phase F gate and DESIGN.md`.
