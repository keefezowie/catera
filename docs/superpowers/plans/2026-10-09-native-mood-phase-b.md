# Native mood identity (Phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instruction, 2026-10-09; applies to every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui` and `antislop:antislop-layoutmobile`, and apply them. antislop's mode is resolved as **after (session override)**: do not ask the mode question. Every task review and re-review runs the antislop design check (core, ui, layoutmobile, plus DESIGN.md) on its UI hunks. There is no separate antislop audit after the plan; Task 11 is the emulator gate.
>
> **Models (owner instruction):** implementers `sonnet`; every reviewer `opus`; never `haiku`. Fix rounds 4 and 5 escalate to `opus`.

**Goal:** Give both native apps the approved D2 + E identity: a Siang/Malam mood the user selects, which colours only the mood header and the hero; photo category circles on Jelajah; a photo calendar on Jadwal; and a Dapur header with a date button, mood toggle and photo prompt. The body and the tab bar never change with the mood.

**Architecture:**
- `@catera/design-tokens` gains `nativeMood[theme][mood]`.
- `@catera/mobile-ui` gains:
  - `MoodProvider` and `useMood`;
  - `useMoodColors`;
  - `MoodHeader` (a `Screen` header slot) with `MoodToggle`, `DayArc` and the Malam lunchbox pattern;
  - `PhotoRing`, `CalendarPhotoCell` and `StoryCover`;
  - a `display` Text variant;
  - a pure `statusBarStyle` helper.
- Both roots mount `MoodProvider`. The Stack `AppHeader` takes the mood fill.
- Screen tasks then adopt the header in three parallel waves of independent files.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, react-native-svg 15.15.4, react-native-reanimated 4.5.1, expo-image-picker (already used in Dapur), Jest (jest-expo), Vitest, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-09-native-visual-identity-design.md](../specs/2026-10-09-native-visual-identity-design.md), sections 3.3 to 7, and 9 Phase B. Phase A plan, for inherited constraints: [2026-10-09-native-theme-phase-a.md](2026-10-09-native-theme-phase-a.md).

## Global Constraints

**Process**
- Work on `v2` (wave tasks in their own worktrees, rebased and fast-forwarded into `v2` one at a time).
- Never stage `apps/web/tsconfig.json` or `.claude/`. Stage by explicit path; other sessions may commit on `v2`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Inherited from Phase A**
- The Phase A Global Constraints, Skill rules and Rulings R1 to R5 all apply.
- Native sources never read `colors`. Only `apps/customer/src/today/Plate.tsx` imports `nativeThemes`.
- No literal hex in `apps/caterer/*` or `packages/mobile-ui/src`. Mood hex lives only in `@catera/design-tokens`.
- No `fontWeight` outside `textVariants`.
- Edits are written by hand. No codemod, `sed` or rewrite script (R-33).
- No em dashes.

**Mood**
- **Values:** `"siang" | "malam"`.
- **Launch default:** Siang before 15:00 Asia/Jakarta, Malam from 15:00 to the end of the day, computed with the Jakarta clock whatever the device timezone. The clock only picks the default and never switches mood while the app is open.
- **State:** in memory, one provider per app.
- **Where mood colours apply:** only on mood surfaces:
  - `MoodHeader`, `AppHeader`, `MoodToggle`, `DayArc`, the Malam pattern and `CalendarPhotoCell`;
  - the Beranda hero card, the Dapur count card and the Jelajah header.
- **Where they never apply:** tab bars, `Screen` bodies, cards, rows and sheets read theme colours only.

**Copy**
- Copy is pinned in each task and passed through `t(id, en)`.
- Toggle labels: "Siang" / "Lunch", "Malam" / "Dinner".
- Never invent numbers, windows or categories (R-17, R-38).

**Motion**
- Mood switch:
  - header and hero fills cross-fade over `nativeMotion.content` (220ms), by animating the opacity of two stacked fills;
  - the arc's active disc travels to the other end over `nativeMotion.feature` (320ms);
  - the toggle pill slides over `nativeMotion.selection` (180ms);
  - a `select` haptic fires.
- Only transform and opacity animate. Under reduced motion, every change is instant.

**Contrast**
- Text at least 4.5:1 on its fill. Marker icons at least 3:1 on the header.
- Enforced for all four theme and mood combinations in `tests/native-contrast.test.ts`.

**Layout (antislop-layoutmobile)**
- Every control at least 48dp.
- Headlines wrap and never truncate.
- No horizontal scroll at font scale 1.0 or 1.3.
- The header paints under the status bar. The demo strip, when present, stays above it.
- The header content is capped at 760 and centred, like `Screen`.

**Status bar:** `"light"` when the theme is dark, or when the mood is Malam and the demo strip is not shown. Otherwise `"dark"`.

**Parallel waves**
- A wave task must not edit `package.json`, lockfiles, `packages/mobile-ui/src/index.ts`, `packages/design-tokens/src/index.ts`, `DESIGN.md` or `apps/*/tests/fixtures.ts`.
- New test data goes in the task's own test file.
- Exception: Task 6 may add one export line to `packages/domain/src/index.ts`. No other task in its wave touches that file.

### Skill rules

From `building-native-ui`:
- Use `React.use` for context.
- Use `process.env.EXPO_OS` for new platform checks.
- New styles are inline objects. `themedStyles` is only for reused stylesheets.
- Use `boxShadow` only: the hero shadow is a `boxShadow` string from the mood tokens.
- Gradients use `experimental_backgroundImage` (no new dependency).
- Error and important data text is `selectable`.
- Counters use `tabular-nums`.
- Use `useWindowDimensions` (never `Dimensions.get`).
- Use `borderCurve: "continuous"` on new rounded surfaces (iOS only; no Android pixel change).

From `antislop`, `antislop-ui` and `antislop-layoutmobile`:
- R-27: loading, error and empty states inside the new headers.
- R-34: both themes and both moods work.
- R-25: contrast.
- R-17 and R-38: real data only.
- R-19: motion has a purpose and never loops.
- One accent per screen (sunrise ink).
- 48dp targets.
- No overflow.
- The bottom bar never covers content.

### Rulings (made 2026-10-09)

- **B1. Jelajah categories come from real tags.**
  - There is no category field. The circles are the most frequent `Offer.tags` across the loaded catalogue (top 6), excluding meal tags matching `/makan siang|makan malam|siang & malam/i`.
  - Each circle's photo is the first offer carrying that tag.
  - Selecting a circle filters by that tag; selecting it again clears it.
  - Cost if wrong: swapping the tag source later.
- **B2. Jelajah rows omit the start date.**
  - The earliest start needs one availability call per package.
  - Rows show the caterer, the delivery-day range and the meal instead.
  - Cost if wrong: one line added later.
- **B3. Photo-hero screens keep the photo as their header.**
  - Customer `PackageDetail` and `ClaimScreen` lead with a photo (Food First rule) and get no `MoodHeader`.
  - Every other screen gets one, either through `AppHeader` or its own `MoodHeader`.
  - Cost if wrong: one screen header later.
- **B4. Dapur Menu's "Tambah foto" updates that day's menu item only, never the library dish.**
  - It reuses the existing `menu.saveBatch` command.
  - Cost if wrong: an extra `dish.save` later.
- **B5. A single-meal package shows its own meal in Dapur Menu.**
  - When `offer.meal` is not `"both"`, Dapur Menu shows that meal whatever the mood.
  - It also shows the caption from Task 9.
  - Cost if wrong: copy only.
- **B6. Beranda when the selected mood has no meal today.**
  - The headline reads "Siang ini," / "tidak ada antaran." (or the Malam forms), followed by a meta line naming the next delivery from the existing upcoming rows.
  - With no deliveries at all, Beranda keeps the existing `EmptyHome`.
  - Cost if wrong: copy only.

## Review Focus

1. **Mood switched during loading or error:** the header shows the chosen mood, and the error text and "Coba lagi" stay readable on a Malam header in both themes. Pinned in Tasks 5 and 7.
2. **The selected mood has no meal today:** Beranda and Dapur show a truthful empty state with a way to the other meal, never a blank hero. Pinned in Tasks 5 and 7.
3. **A very long dish name in the Beranda headline:** it wraps at font scale 1.3, never truncates or overflows. Pinned in Task 5 (unit) and Task 11 (emulator).
4. **Launch at the boundary:** 14:59, 15:00, 23:59 and 00:00 Jakarta time give Siang, Malam, Malam and Siang, even with a device timezone of UTC. Pinned in Task 2.
5. **A calendar day with a menu but no dish photo shows the package photo**, not the dashed "not set" cell. A day whose menu is not set is dashed even when a package photo exists. Pinned in Task 6.

## Execution order and waves

Execution runs in this order (spelled out in each task's Interfaces):

1. **Foundation (sequential, main tree, review overlapped with the next task):** Task 1, then Task 2, then Task 3, then Task 4.
2. **Wave 1 (parallel worktrees):** Task 5 (customer Beranda), Task 6 (customer Jadwal plus domain calendar) and Task 7 (Dapur Hari ini).
3. **Wave 2 (parallel worktrees):** Task 8 (customer Jelajah), Task 9 (Dapur Menu) and Task 10 (the other screens' headers).
4. **Task 11 (main tree):** DESIGN.md, the emulator gate in four looks, and the gate report.

---

### Task 1: Mood tokens and their contrast test

**Files:**
- Modify: `packages/design-tokens/src/index.ts`, `docs/superpowers/specs/2026-10-09-native-visual-identity-design.md` (section 3.3: replace each "test" cell with the value below)
- Test: `tests/native-contrast.test.ts`

**Interfaces:**
- Produces:
  - `type Mood = "siang" | "malam"`
  - `type MoodKey = "header" | "headerText" | "headerMeta" | "toggleTrack" | "toggleActive" | "onToggleActive" | "arcTrack" | "markerActive" | "markerIdle" | "hero" | "heroText" | "heroMeta" | "heroShadow"`
  - `type MoodPalette = Record<MoodKey, string> & { pattern: string | null }`
  - `export const nativeMood: Record<ThemeName, Record<Mood, MoodPalette>>`

- [ ] **Step 1: Write the failing tests** (append to `tests/native-contrast.test.ts`)
  - `nativeMood matches the spec`: `toEqual` on all four palettes, using exactly the values in this table:

    | key | light siang | light malam | dark siang | dark malam |
    | --- | --- | --- | --- | --- |
    | header | `#FFEFD9` | `#0B1F16` | `#3A2617` | `#163D2E` |
    | headerText | `#163D2E` | `#FFF7E9` | `#F5F1E8` | `#F5F1E8` |
    | headerMeta | `#6B4A2B` | `#A9BDB0` | `#E6C3A2` | `#CFE0D2` |
    | toggleTrack | `#F6DDBE` | `#1C3A2C` | `#4C3322` | `#25553F` |
    | toggleActive | `#9B4309` | `#FFF7E9` | `#F5C9A6` | `#FFF7E9` |
    | onToggleActive | `#FFF7E9` | `#0B1F16` | `#3A1A04` | `#163D2E` |
    | arcTrack | `#E2C29C` | `#2C4C3C` | `#6A4A33` | `#2C5A45` |
    | markerActive | `#9B4309` | `#FFF7E9` | `#F5C9A6` | `#FFF7E9` |
    | markerIdle | `#9A7A55` | `#6E8C7C` | `#A88A6A` | `#7FA08E` |
    | hero | `#FFFEFA` | `#1C3A2C` | `#232321` | `#1C3A2C` |
    | heroText | `#163D2E` | `#FFF7E9` | `#F5F1E8` | `#F5F1E8` |
    | heroMeta | `#60675F` | `#A9BDB0` | `#B5B2AA` | `#CFE0D2` |
    | heroShadow | `0 10px 28px rgba(107,74,43,0.16)` | `0 10px 28px rgba(0,0,0,0.35)` | `0 10px 28px rgba(0,0,0,0.35)` | `0 10px 28px rgba(0,0,0,0.35)` |
    | pattern | `null` | `#1A3A2B` | `null` | `#1F4A38` |

  - Then, for each of the four combinations:
    - `headerText`, `headerMeta`: at least 4.5:1 on `header`;
    - `headerMeta`: at least 4.5:1 on `toggleTrack` (idle toggle label);
    - `onToggleActive`: at least 4.5:1 on `toggleActive`;
    - `markerActive`, `markerIdle`: at least 3:1 on `header`;
    - `heroText`, `heroMeta`: at least 4.5:1 on `hero`.
  - `light siang hero equals the light surface` and `dark siang hero equals the dark surface` (against `nativeThemes`).

- [ ] **Step 2:** Run `npx vitest run tests/native-contrast.test.ts`. It must FAIL because `nativeMood` is not exported.

- [ ] **Step 3: Implement** the types and `nativeMood` in `packages/design-tokens/src/index.ts`, using the table values. Define each Siang hero by referencing the `nativeThemes` surface so the two cannot drift. Update the spec table cells marked "test".

- [ ] **Step 4:** Run `npx vitest run tests/native-contrast.test.ts`. It must PASS. Then run `npm run typecheck`.

- [ ] **Step 5: Commit**: `feat(tokens): Siang and Malam mood palettes for both themes`

---

### Task 2: Mood state, toggle, header, arc and display type

**Files:**
- Create:
  - `packages/mobile-ui/src/mood.tsx`: `MoodProvider`, `useMood`, `useMoodColors`, `defaultMood`, `statusBarStyle`
  - `packages/mobile-ui/src/MoodHeader.tsx`: `MoodHeader`, `MoodToggle`
  - `packages/mobile-ui/src/brand/DayArc.tsx`
  - `packages/mobile-ui/src/brand/MalamPattern.tsx`
- Modify:
  - `packages/mobile-ui/src/components.tsx`: add the `display` variant; add a `header?: ReactNode` slot to `Screen`
  - `packages/mobile-ui/src/index.ts`: export the new modules
  - `tests/native-theme-guard.test.ts`: add the mood guard
- Test: `apps/customer/tests/mood.test.tsx` (create)

**Interfaces:**
- Consumes: `nativeMood`, `Mood`, `MoodPalette` (Task 1); `useThemePreference` and `useColors` (Phase A); `useReduced`, `useHaptic` and `PressableScale` (existing motion).
- Produces:
  - `function defaultMood(now: Date): Mood`
  - `function MoodProvider(props: { children: ReactNode; now?: () => Date }): JSX.Element`
  - `function useMood(): { mood: Mood; setMood(m: Mood): void }`. Without a provider it returns `"siang"` and a no-op setter.
  - `function useMoodColors(): MoodPalette`, using the current theme scheme and the current mood.
  - `function statusBarStyle(o: { scheme: ThemeName; mood: Mood; demo: boolean }): "light" | "dark"`
  - `function MoodToggle(): JSX.Element`: a tablist of two tabs reading and writing `useMood`.
  - `function MoodHeader(props: { meta?: ReactNode; title: ReactNode; trailing?: ReactNode; toggle?: boolean; arc?: boolean; children?: ReactNode; overlap?: 0 | 58; testID?: string }): JSX.Element`
  - `function DayArc(): JSX.Element`
  - `function MalamPattern(): JSX.Element`
  - `Screen` gains `header?: ReactNode`. When it is set, `Screen` renders the header full-bleed as the first child inside the scroll view (above the 760-capped body), drops `"top"` from its safe-area edges, and the header pays the top inset itself (`insets.top` unless the demo strip owns it).
  - Text variant `display`: 34/40, weight 800, tracking −1, colour key `forest` (callers on mood surfaces pass `headerText` or `heroText` explicitly).

- [ ] **Step 1: Write the failing tests** in `apps/customer/tests/mood.test.tsx`

  `defaultMood`, with `process.env.TZ` unaffected (pass `Date` instances built from UTC):
  - 2026-10-09T07:59:00Z (14:59 WIB) gives `siang`.
  - 2026-10-09T08:00:00Z (15:00 WIB) gives `malam`.
  - 2026-10-09T16:59:00Z (23:59 WIB) gives `malam`.
  - 2026-10-09T17:00:00Z (00:00 WIB next day) gives `siang`.

  Provider and colours:
  - `MoodProvider` with `now` returning 15:00 WIB renders `useMood().mood === "malam"`.
  - `useMoodColors()` in the light theme returns `#0B1F16` as the header for Malam.
  - `useMoodColors()` in the dark theme returns `#3A2617` for Siang.

  Status bar:
  - `statusBarStyle({ scheme: "light", mood: "malam", demo: false })` is `"light"`.
  - `statusBarStyle({ scheme: "light", mood: "malam", demo: true })` is `"dark"`.
  - `statusBarStyle({ scheme: "dark", mood: "siang", demo: true })` is `"light"`.
  - `statusBarStyle({ scheme: "light", mood: "siang", demo: false })` is `"dark"`.

  `MoodToggle`:
  - It has `role` tablist, with tabs "Siang" and "Malam", and the selected one has `accessibilityState.selected`.
  - Pressing "Malam" sets the mood and fires the `select` haptic (`Haptics.selectionAsync` called).
  - Each tab is at least 48dp (`minHeight >= 48`).

  `MoodHeader`:
  - The fill testID `mood-fill-malam` has opacity 1 after switching to Malam (with reduced motion mocked on, it is instant).
  - The title colour equals `headerText`.
  - `arc` renders `DayArc` with testID `day-arc`, and `accessibilityElementsHidden` is true.
  - `MalamPattern` renders only when the mood is Malam (testID `malam-pattern`).
  - With `overlap={58}`, the header has `paddingBottom` of at least 58 + 16.

  `Screen` with `header`:
  - The header renders before `screen-body`.
  - The `SafeAreaView` edges exclude `"top"`.

  `Text`: `variant="display"` has `fontSize` 34 and `lineHeight` 40.

  `Sheet` keyboard (carried from the Phase A final review). Since Phase A, the Sheet Modal is `navigationBarTranslucent`, so Android no longer resizes it for the keyboard. Test: with a mocked keyboard height (Keyboard `keyboardDidShow` with `endCoordinates.height` 300), the sheet's content container gains bottom padding of at least 300 (or sits inside a `KeyboardAvoidingView` with `behavior` set on both platforms). The bottom field and its save button stay above the keyboard.

  Guard (Vitest), `mood colours never reach tab bars or shared bodies`:
  - No file under `apps/*/app/(tabs)/` contains `useMoodColors` or `nativeMood`.
  - `packages/mobile-ui/src/components.tsx` contains neither.
  - `nativeMood` appears only in `packages/mobile-ui/src/mood.tsx` among native sources.

- [ ] **Step 2:** Run `npm test -w @catera/customer -- tests/mood.test.tsx` and `npx vitest run tests/native-theme-guard.test.ts`. Both must FAIL.

- [ ] **Step 3: Implement.**

  `defaultMood` uses `Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" })`, then `hour < 15 ? "siang" : "malam"`.

  `MoodHeader`:
  - Stacks two absolute fills (`mood-fill-siang` and `mood-fill-malam`). The Malam one's opacity animates with `withTiming(…, { duration: nativeMotion.content, easing: Easing.bezier(...nativeMotion.ease) })`, or is set directly under reduced motion.
  - Bottom corners 28, or 32 when `overlap === 58`.
  - Content is capped at 760 and centred.
  - Row 1 is `meta` on the left, with `toggle` or `trailing` on the right. Then `title`, then `arc` when set, then `children`.

  `MoodToggle`:
  - A pill track `toggleTrack` with a sliding active pill `toggleActive` (`translateX` over `nativeMotion.selection`).
  - Labels are `onToggleActive` when active and `headerMeta` when idle.
  - Icons are a filled sun (`Ionicons "sunny"`) and moon (`"moon"`), size 14.

  `DayArc` (react-native-svg, width from `onLayout`, height 70):
  - A dashed half-ellipse track in `arcTrack`.
  - An idle sun marker at 0.3 of the arc and an idle moon at 0.72. Each is a 32dp outline circle in `markerIdle` with its glyph.
  - An active 40dp disc in `markerActive`, holding the active glyph in the `header` colour.
  - The active disc translates along the ellipse between those two positions (`feature` duration; a `useAnimatedStyle` computes x and y from progress).
  - A baseline line in `headerText`.
  - The whole arc is decorative and hidden from accessibility.

  `Sheet`: add keyboard avoidance inside the Modal, so input sheets (Dapur `ExceptionSheet`, `ImportAssistant` row editor) keep the focused field and the save button above the keyboard. Verify on the emulator: "Pindah tanggal", then focus "Alasan". Save a capture as `output/native-review/visual-b/caterer-exception-sheet-keyboard.png`.

  `MalamPattern`: three 34×22 outline lunchboxes (a rounded rect plus a handle arc), stroke `pattern`, top-right, behind the content, hidden from accessibility, rendered only when `pattern` is not null.

- [ ] **Step 4:** Run `npm test -w @catera/customer`, `npm test -w @catera/caterer`, `npx vitest run tests/native-theme-guard.test.ts tests/native-font-weights.test.ts tests/native-contrast.test.ts` and `npm run typecheck`. All must PASS.

- [ ] **Step 5: Commit**: `feat(mobile-ui): Siang/Malam mood provider, toggle, header and day arc`

---

### Task 3: PhotoRing, CalendarPhotoCell and StoryCover

**Files:**
- Create: `packages/mobile-ui/src/PhotoRing.tsx`, `packages/mobile-ui/src/CalendarPhotoCell.tsx`, `packages/mobile-ui/src/StoryCover.tsx`
- Modify: `packages/mobile-ui/src/index.ts`
- Test: `apps/customer/tests/photo-parts.test.tsx` (create)

**Interfaces:**
- Consumes: `useColors`, `useMoodColors`, `PressableScale`, `nativeThemes` (only for StoryCover's fixed inks; add `packages/mobile-ui/src/StoryCover.tsx` to the guard's `nativeThemes` allowlist).
- Produces:
  - `function PhotoRing(props: { uri: string; size: 60 | 66; ring: "sunrise" | "forest" | "none"; covered?: boolean; label?: string; selected?: boolean; onPress?: () => void; accessibilityLabel: string }): JSX.Element`
    - The ring is 3dp in `sunriseInk` or `forest`, from the theme.
    - `covered` shows a cream disc with a closed-lunchbox glyph instead of the photo.
    - With `onPress` it is a `PressableScale` with `select` haptic, `accessibilityRole="button"` and `selected` state. The label sits below it, `label` variant when selected and caption otherwise.
  - `type CalendarCellState = { day: number; uri: string | null; menuSet: boolean; dinnerToo: boolean; past: boolean; today: boolean; selected: boolean }`
  - `function CalendarPhotoCell(props: CalendarCellState & { onPress: () => void; accessibilityLabel: string }): JSX.Element`
    - Height 52, radius 12, at least 48dp.
    - With a `uri` and `menuSet` true, it shows the photo, a day number in a cream pill at the bottom-left, and a forest moon badge at the top-right when `dinnerToo`.
    - `menuSet` false shows a dashed 1.5dp border in `markerIdle` plus a small sun mark.
    - `uri` null (no meal) shows the plain number in `headerMeta`.
    - `past` dims the photo to 0.5, and the number pill is forest with cream text.
    - `today` adds a 2.5dp `sunriseInk` outline; `selected` adds a 2.5dp `forest` outline.
    - When `useWindowDimensions().fontScale >= 1.3`, a photo cell falls back to the number with a 6dp photo dot (spec risk 13).
  - `function StoryCover(props: { uri: string; title: string; segments: number; active: number; width: number; height: number }): JSX.Element`
    - The photo is cover-fit.
    - A bottom gradient via `experimental_backgroundImage: "linear-gradient(rgba(11,31,22,0) 40%, rgba(11,31,22,0.9))"`.
    - `segments` bars at the top (active ones cream, the rest cream at 0.4 opacity).
    - The title in cream `label` variant at the bottom.
    - Inks are fixed from `nativeThemes.light`, because they sit on a photo.

- [ ] **Step 1: Write the failing tests**:
  - `PhotoRing`:
    - The ring colour equals the light `sunriseInk` for `"sunrise"`.
    - With `covered`, no `Image` is rendered and the testID `photo-ring-covered` is present.
    - When pressable it fires `select`, exposes `selected`, and is at least 48dp.
  - `CalendarPhotoCell` (Review Focus 5):
    - `uri` set with `menuSet` true renders the image and no dashed border.
    - `menuSet` false with a `uri` renders the dashed border (`borderStyle "dashed"`, colour = Siang `markerIdle` `#9A7A55`) and no image.
    - `dinnerToo` renders `cell-moon`.
    - `past` gives image opacity 0.5.
    - `today` and `selected` outlines carry the right colours.
    - With `fontScale` mocked to 1.3, no full image renders and `cell-photo-dot` is present.
  - `StoryCover` renders the given number of segments, with the first `active` ones at opacity 1, and the title text.

- [ ] **Step 2:** Run `npm test -w @catera/customer -- tests/photo-parts.test.tsx`. It must FAIL.

- [ ] **Step 3: Implement** the three components and the barrel exports. Update the guard allowlist for `StoryCover.tsx`.

- [ ] **Step 4:** Run the customer suite, the caterer suite, the four native Vitest guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(mobile-ui): photo ring, photo calendar cell and story cover`

---

### Task 4: Mount the mood at both roots; AppHeader takes the mood

**Files:**
- Modify: `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx`, `packages/mobile-ui/src/AppHeader.tsx`
- Test: `apps/customer/tests/shell.test.tsx`, `apps/caterer/tests/layout.test.tsx`

**Interfaces:**
- Consumes: `MoodProvider`, `useMood`, `useMoodColors`, `statusBarStyle` (Task 2).
- Produces:
  - `<MoodProvider>` sits directly inside `ThemeProvider` in both roots, around the app providers.
  - `StatusBar style={statusBarStyle({ scheme, mood, demo })}`.
  - `AppHeader`:
    - background `header`, title colour `headerText`, bottom corners 28;
    - it pays the top inset as before;
    - its `RoundButton` stays on the theme surface.

- [ ] **Step 1: Write the failing tests** (both apps)
  - With the system theme light and mood Malam (`MoodProvider now` at 16:00 WIB):
    - the status bar receives `"light"`;
    - a pushed screen's `AppHeader` background is `#0B1F16` and its title is `#FFF7E9`;
    - the tab bar background is still `#FFFEFA` (the mood never reaches the tab bar).
  - With demo on and Malam, the status bar is `"dark"`.

- [ ] **Step 2:** Run `npm test -w @catera/customer -- tests/shell.test.tsx` and `npm test -w @catera/caterer -- tests/layout.test.tsx`. Both must FAIL.

- [ ] **Step 3: Implement** the root wiring and the `AppHeader` restyle.

- [ ] **Step 4:** Run both suites in full, the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(native): mood provider at both roots; pushed headers take the mood`

---

### Task 5 (wave 1): Customer Beranda mood header and hero

**Files:**
- Modify: `apps/customer/src/today/Beranda.tsx`, `apps/customer/src/today/Plate.tsx`
- Test: `apps/customer/tests/today.test.tsx` (add local fixtures in the file; do not edit `fixtures.ts`)

**Interfaces:**
- Consumes: `Screen` `header`, `MoodHeader` (`toggle`, `arc`, `overlap={58}`), `useMood`, `useMoodColors`, `PhotoRing` (Tasks 2 and 3); `todayPlates` and `upcomingRows` (existing).
- Produces:
  - `Plate` gains `variant?: "card" | "hero"` (default `"card"`). The hero variant:
    - outer padding 10, radius 28, inner photo radius 20 with a photo height of 168, `marginTop: -58`;
    - fill `hero`, shadow `heroShadow`;
    - body text in `heroText` and `heroMeta`;
    - every existing action, reaction and status sentence kept.

- [ ] **Step 1: Write the failing tests** (`describe("Beranda mood")`):
  - Header and hero:
    - With two plates today (lunch and dinner) and mood Siang, the header title reads "Siang ini," followed by the lunch plate's first dish lowercased and a period.
    - The hero is the lunch `Plate` (testID `plate-hero`).
    - A compact row (testID `other-meal-row`) reads "Malam ini · {dinner window}" with the dinner dish.
  - Switching mood:
    - Pressing "Malam" in the toggle shows "Malam ini," with the dinner dish and the dinner plate as the hero.
    - Pressing `other-meal-row` also switches the mood.
  - Empty mood (Review Focus 2, ruling B6):
    - Only a lunch plate today and mood Malam: the title reads "Malam ini," / "tidak ada antaran.".
    - The meta reads "Berikutnya {label}", taken from `upcomingRows(...)[0].label`.
    - The lunch row appears as `other-meal-row`.
  - Long dish (Review Focus 3): a 60-character dish name renders in the title with no `numberOfLines` set.
  - Malam surfaces:
    - The hero fill is `#1C3A2C` in light Malam.
    - The plate body heading colour is `#FFF7E9`.
  - Error state (Review Focus 1):
    - With the read failing and mood Malam, the screen renders `MoodHeader` with title "Beranda".
    - The `home-error` text is `selectable`, with colour = dark-safe `danger` on the canvas.
    - "Coba lagi" still reloads.
  - All existing today tests stay green. Update a test only where it asserted the old title "Hari ini", and say so in the report.

- [ ] **Step 2:** Run `npm test -w @catera/customer -- tests/today.test.tsx`. It must FAIL.

- [ ] **Step 3: Implement.**

  Header contents:
  - `meta`: the date via `dayLabel` (existing).
  - `toggle`, `arc`, `overlap={58}`.
  - `title`: two lines, using the `title` variant in `headerText`.

  Below the header, in order:
  - the hero `Plate` for the mood's meal;
  - `other-meal-row` when the other meal has a plate (a 60dp `PhotoRing` with ring `forest` for dinner or `sunrise` for lunch, plus label and dish; press calls `setMood`);
  - then the existing `MenuDueRows`, `UpcomingRows`, `RenewalCard`, `TrialCard`, `PackageLine` and `ReviewPrompt`, in their current order.

  Copy:
  - Lunch: "Siang ini," / "Lunch today,". Dinner: "Malam ini," / "Dinner tonight,".
  - Empty second line: "tidak ada antaran." / "no delivery.".
  - Meta: "Berikutnya {label}" / "Next {label}".
  - Row labels: "Siang ini" / "Lunch today", "Malam ini" / "Dinner tonight".

- [ ] **Step 4:** Run the full customer suite, the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(customer): Beranda mood header, day arc and hero plate`

---

### Task 6 (wave 1): Customer Jadwal photo calendar

**Files:**
- Create: `packages/domain/src/calendar.ts`
- Modify: `packages/domain/src/index.ts` (one export line), `apps/customer/src/schedule/Jadwal.tsx`, `apps/customer/src/schedule/MonthGrid.tsx`
- Test: `tests/calendar-days.test.ts` (Vitest, create), `apps/customer/tests/schedule.test.tsx`

**Interfaces:**
- Consumes: `CalendarPhotoCell`, `MoodHeader`, `Screen` `header` (Tasks 2 and 3); `pendingMenu` from `packages/domain/src/contents.ts`; `Delivery` and `MealMenu` (domain).
- Produces:
  - `type CalendarMeal = { image: string; menuSet: boolean; delivered: boolean }`
  - `type CalendarDay = { lunch: CalendarMeal | null; dinner: CalendarMeal | null }`
  - `function calendarDays(deliveries: Delivery[]): Map<string, CalendarDay>`
    - Skip cancelled days, cancelled meals and failed (`"issue"`) meals, as `marksOf` does today.
    - `menu = d.offer.menus.find(m => m.meal === meal)`.
    - `menuSet = !!menu && !pendingMenu(menu)`.
    - `image = menu?.image || menu?.items?.find(i => i.image)?.image || d.offer.image || ""`.
    - `delivered = status === "delivered"`.

- [ ] **Step 1: Write the failing tests.**

  `tests/calendar-days.test.ts`:
  - A lunch menu with its own image gives that image.
  - A menu image of `""` with no item images falls back to the package image, with `menuSet` true (Review Focus 5).
  - A slot menu with no items gives `menuSet` false while still carrying the package image (Review Focus 5).
  - A cancelled day is absent.
  - A failed dinner gives `dinner` null.
  - Lunch plus dinner on one day gives both meals.

  `schedule.test.tsx`: replace the old sun and moon mark assertions with photo-cell assertions.
  - A covered day renders `CalendarPhotoCell` with the lunch image.
  - A day covering both meals shows `cell-moon`.
  - A not-set day is dashed.
  - Today has the `sunriseInk` outline; the selected day the `forest` outline.
  - A past delivered day is dimmed.
  - The legend reads "Foto menu", "Menu belum diisi" and "Ada makan malam" (in English: "Menu photo", "Menu not set", "Dinner too").
  - Lunch is listed before dinner on the selected day.
  - Loading and error states are unchanged.
  - The month grid sits inside `MoodHeader`, testID `jadwal-header`.

- [ ] **Step 2:** Run `npx vitest run tests/calendar-days.test.ts` and `npm test -w @catera/customer -- tests/schedule.test.tsx`. Both must FAIL.

- [ ] **Step 3: Implement.**
  - `Jadwal` renders `Screen header={<MoodHeader testID="jadwal-header" title={monthTitle} trailing={chevrons}>…grid, legend…</MoodHeader>}`.
  - The 48dp month chevrons move into the header's `trailing` slot.
  - `MonthGrid` maps `calendarDays` into `CalendarPhotoCell` props:
    - `uri` = lunch image, else dinner image, else null;
    - `menuSet` = every covered meal is set;
    - `dinnerToo` = lunch and dinner both covered;
    - `past` = the date is before today and every covered meal is delivered.
  - Delete `marksOf` and `DayMark` once unused.
  - Each cell's accessibility label names the date and the covered meals, for example "Jumat 9 Oktober, makan siang dan makan malam" or "…, menu belum diisi".

- [ ] **Step 4:** Run the full customer suite, `npm test` (root), the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(customer): Jadwal photo calendar in the mood header`

---

### Task 7 (wave 1): Dapur Hari ini header, date button and session by mood

**Files:**
- Modify: `apps/caterer/src/today/TodayScreen.tsx`, `apps/caterer/src/today/SessionCard.tsx`, `packages/domain/src/kitchen.ts`
- Test: `apps/caterer/tests/today.test.tsx` (local fixtures only), `tests/kitchen.test.ts`

**Interfaces:**
- Consumes: `MoodHeader`, `MoodToggle`, `useMood`, `useMoodColors`, `Screen` `header` (Task 2); `cookingRecap`, `deliveryRoute`, `jakartaDay` and `shortDate` (kitchen.ts); `windowStartMinutes` (customer-day.ts).
- Produces:
  - `function sessionStart(state: SellerOperationsState, meal: KitchenMeal): string | null` in `kitchen.ts`: the earliest window start ("HH.MM") among that meal's deliveries, or null.
  - In `TodayScreen`:
    - the Hari ini / Besok `Segmented` is replaced by a 48dp date button in the header;
    - one `SessionCard` is shown, for the mood's meal.

- [ ] **Step 1: Write the failing tests.**

  `tests/kitchen.test.ts`: `sessionStart` returns the earliest window start for lunch, and null when the meal has no deliveries.

  `apps/caterer/tests/today.test.tsx`:
  - Header:
    - The header title is `shortDate(date)` as a button, `accessibilityRole="button"`, labelled "Ganti hari, sekarang Hari ini" (English: "Change day, now Today").
    - Pressing it switches to tomorrow: the meta reads "{caterer} · Besok" and the title shows tomorrow's date.
    - Pressing again returns to today.
  - Toggle (this replaces the old "has a single day switch" test): exactly one `tablist`, the mood toggle, with tabs "Siang" and "Malam".
  - Count card:
    - With lunch work and mood Siang, the card (testID `session-count`) shows `recap.total`, "porsi siang · {n} alamat" and "Antar {sessionStart}".
    - It sits on the mood `hero` fill.
    - Its number uses `tabular-nums`.
  - Session by mood:
    - Mood Malam with only lunch work shows "Tidak ada antaran makan malam.".
    - A button reads "Lihat makan siang · {n} porsi"; pressing it sets the mood to Siang (Review Focus 2).
    - Only the mood's `SessionCard` renders.
  - Malam surfaces: the header fill is `#0B1F16` in light Malam, and `ReadError` text stays readable (Review Focus 1).
  - Existing report, attention and offline tests stay green.

- [ ] **Step 2:** Run `npx vitest run tests/kitchen.test.ts` and `npm test -w @catera/caterer -- tests/today.test.tsx`. Both must FAIL.

- [ ] **Step 3: Implement.**

  Header:
  - `meta` = "{caterer name} · Hari ini|Besok".
  - `title` = the date button (title variant in `headerText`, with a `chevron-down` icon).
  - `toggle`.
  - `children` = the count card: a radius 22 surface on the `hero` fill, the `number` variant in `heroText`, and the caption in `heroMeta`.

  Body:
  - The existing offline card, `ReadError`, `MulaiCard`, `ReportCards` and `ActionCards` stay as they are.
  - One `SessionCard` for the mood's meal, inside the existing `FadeSwap` keyed by date and mood.

  Copy:
  - "porsi siang|malam · {n} alamat" / "lunch|dinner portions · {n} addresses".
  - "Antar {HH.MM}" / "Deliver {HH.MM}".
  - "Tidak ada antaran makan siang|malam." / "No lunch|dinner deliveries.".
  - "Lihat makan siang|malam · {n} porsi" / "See lunch|dinner · {n} portions".

- [ ] **Step 4:** Run the full caterer suite, `npm test` (root), the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(dapur): Hari ini mood header, date button and one session at a time`

---

### Task 8 (wave 2): Customer Jelajah header, category circles and rows

**Files:**
- Modify: `apps/customer/src/discover/Jelajah.tsx`, `apps/customer/src/discover/PackageCard.tsx`
- Create: `apps/customer/src/discover/categories.ts`
- Test: `apps/customer/tests/discover.test.tsx`

**Interfaces:**
- Consumes: `MoodHeader`, `useMood`, `useMoodColors`, `PhotoRing`, `Screen` `header` (Tasks 2 and 3).
- Produces:
  - `function topTags(offers: Offer[], max: number): { tag: string; image: string }[]`, following ruling B1:
    - frequency order, ties broken alphabetically;
    - meal tags excluded;
    - `image` = the first offer with the tag.
  - `PackageCard` gains `layout?: "row"`. It renders a 112dp square photo on the left, with name, the existing `cardLine` and price with unit on the right.

- [ ] **Step 1: Write the failing tests.**

  `topTags`:
  - Returns the six most frequent tags.
  - Drops "Makan siang".
  - Ties are alphabetical.
  - The image comes from the first carrying offer.

  Jelajah header:
  - The header shows the area line.
  - The title "Makan siang" / "minggu depan?" changes to "Makan malam" / "minggu depan?" when the mood is Malam.
  - Two 60dp meal buttons, "Siang" and "Malam", are the mood toggle and the meal filter. Selecting "Malam" filters to `meal === "dinner" || "both"` and sets the mood.
  - The old Siang/Malam `FilterChip`s are gone.
  - The budget and trial chips remain.

  Category circles:
  - The `PhotoRing` circles render from `topTags`.
  - Tapping one filters to offers whose tags include it and marks it `selected`; tapping again clears it.
  - With no tags in the catalogue, the circle row does not render.

  Rows and states:
  - Results render as row cards with the price unit "/ sekali makan".
  - The empty, error and loading states are unchanged and readable on a Malam header.
  - The search field sits in the header with the existing placeholder.

- [ ] **Step 2:** Run `npm test -w @catera/customer -- tests/discover.test.tsx`. It must FAIL.

- [ ] **Step 3: Implement** as specified. Copy:
  - "Makan siang" / "Lunch", "Makan malam" / "Dinner", "minggu depan?" / "next week?".
  - Circle accessibility label: "Kategori {tag}" / "Category {tag}".

- [ ] **Step 4:** Run the full customer suite, the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(customer): Jelajah mood header, meal buttons, tag circles and photo rows`

---

### Task 9 (wave 2): Dapur Menu week strip, day card, photo prompt and story preview

**Files:**
- Modify: `apps/caterer/src/menu/MenuWeek.tsx`, `apps/caterer/src/menu/MenuDayScreen.tsx`, `apps/caterer/src/menu/logic.ts`, `packages/domain/src/contents.ts`
- Test: `apps/caterer/tests/menu.test.tsx`, `tests/contents.test.ts`

**Interfaces:**
- Consumes:
  - `MoodHeader`, `useMood`, `StoryCover`, `Screen` `header` (Tasks 2 and 3);
  - `uploadPhoto(runtime, photo, demo)` (`apps/caterer/src/business/upload.ts`);
  - `expo-image-picker` `launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 })`, as `PackageEditor` uses it;
  - `loadMenus` and `MenuDay` (existing).
- Produces:
  - `function menuCoverImage(menu: MealMenu | null, fallback: string): string` in `contents.ts`: the first item with `categoryId === "main"` and an image, else the first item with an image, else `menu.image`, else `fallback`.
  - `function saveMenuDay(runtime: MobileRuntime, args: { catererId: string; offer: Offer; meal: "lunch" | "dinner"; day: MenuDay; items: Dish[] }): Promise<void>` in `menu/logic.ts`. It is extracted from `MenuDayScreen`'s save, uses the same `menu.saveBatch` payload, and is used by both screens.

- [ ] **Step 1: Write the failing tests.**

  `tests/contents.test.ts`: `menuCoverImage` prefers the main dish image, then any dish image, then the menu image, then the fallback.

  `apps/caterer/tests/menu.test.tsx`, header and strip:
  - The `MoodHeader` title is the week range, for example "5–9 Okt".
  - The toggle picks the meal for a `"both"` package.
  - A single-meal package shows its own meal and the caption "Paket ini hanya untuk makan siang" (ruling B5).
  - The strip renders one 64dp button per delivery date.
  - Each button shows the weekday, the date and a check when that day has dishes.
  - Today has a `sunriseInk` ring; the selected day a forest fill.
  - Tapping a day selects it without navigating.

  Day card:
  - Lists the dishes grouped by composition group label.
  - A dish without an image shows a dashed camera tile and a "Tambah foto" pill.
  - "Ubah menu" pushes `/menu/{date}?pkg=…&meal=…` (the existing editor).

  Photo prompt (ruling B4):
  - Pressing "Tambah foto" with a mocked picker result calls `uploadPhoto`.
  - It then calls `command("menu.saveBatch", …)`, with that item's `image` set to the uploaded URL and every other item unchanged.
  - The pill shows "Mengunggah…" while pending.
  - A failed upload shows "Foto gagal diunggah. Coba lagi." as `selectable` danger text.
  - A cancelled picker does nothing.

  Story preview and existing behaviour:
  - The preview card renders `StoryCover` with `menuCoverImage(day.details, offer.image)` and the caption text.
  - `MenuDayScreen` still saves through `saveMenuDay` (an existing save test stays green).
  - "Salin minggu lalu" and "Bagikan menu" are unchanged.

- [ ] **Step 2:** Run `npx vitest run tests/contents.test.ts` and `npm test -w @catera/caterer -- tests/menu.test.tsx`. Both must FAIL.

- [ ] **Step 3: Implement** as specified. Copy:
  - "Tambah foto" / "Add photo", "Mengunggah…" / "Uploading…".
  - "Foto gagal diunggah. Coba lagi." / "Photo upload failed. Try again.".
  - "Ubah menu" / "Edit menu".
  - "Tampilan di aplikasi pelanggan" / "How customers see it".
  - "Foto lauk utama jadi sampul menu besok. Menu tanpa foto memakai foto paket." / "The main dish photo becomes the cover of tomorrow's menu. A menu without photos uses the package photo."
  - "Paket ini hanya untuk makan siang|malam" / "This package is lunch|dinner only".

- [ ] **Step 4:** Run the full caterer suite, `npm test` (root), the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(dapur): Menu week strip, day card, photo prompt and story preview`

---

### Task 10 (wave 2): Mood header on the remaining screens

**Files:**
- Modify: `apps/customer/src/account/Akun.tsx`, `apps/customer/src/buy/BuyScreen.tsx`, `apps/customer/src/buy/PaymentScreen.tsx`, `apps/caterer/src/customers/CustomerList.tsx`, `apps/caterer/src/business/UsahaScreen.tsx`
- Test: `apps/customer/tests/account.test.tsx`, `apps/customer/tests/buy.test.tsx`, `apps/caterer/tests/customers.test.tsx`, `apps/caterer/tests/business.test.tsx`

**Interfaces:**
- Consumes: `MoodHeader`, `Screen` `header` (Task 2).
- Produces: these screens render their current title inside `Screen header={<MoodHeader title=… />}`, with no toggle.
  - Buy and Payment move their own `RoundButton` back control into the header's `meta` slot and keep its label.
  - `PackageDetail` and `ClaimScreen` are unchanged (ruling B3).

- [ ] **Step 1: Write the failing tests** (one per screen):
  - Each screen's title renders inside a `MoodHeader`, testIDs `akun-header`, `buy-header`, `payment-header`, `pelanggan-header` and `usaha-header`.
  - Under light Malam the header fill is `#0B1F16` and the title is `#FFF7E9`, while the body cards keep the theme surface `#FFFEFA`.
  - The Buy and Payment back buttons still navigate back and are at least 48dp.
  - Existing tests stay green.

- [ ] **Step 2:** Run the four focused test files. They must FAIL.

- [ ] **Step 3: Implement.** Keep every existing control, copy and state.

- [ ] **Step 4:** Run both full native suites, the guards and typecheck. All must PASS.

- [ ] **Step 5: Commit**: `feat(native): mood header on Akun, Beli, Bayar, Pelanggan and Usaha`

---

### Task 11: DESIGN.md, emulator gate in four looks, gate report

**Files:**
- Modify: `DESIGN.md`. Add a "Native mood and theme" section per spec 10:
  - the two axes, mood surfaces only and the fixed tab bar;
  - the launch default;
  - the `nativeMood` table and the contrast rules;
  - shapes (header 28/32, hero 28 with photo 20, cards 20);
  - the `display` variant;
  - the Dapur date button;
  - code-drawn brand objects;
  - mood motion;
  - the photo calendar replacing the icon cells;
  - rulings B1 to B6;
  - a dated owner-decisions entry.

  Corrections carried from the Phase A final review:
  - Add the Sheet change as a fifth approved light exception (the scrim covers the status bar; the sheet surface fills the gesture band; bottom padding grows by the home-indicator inset on iOS).
  - The claim that `Alert`, the window background and the iOS keyboard follow the Tampilan override gets "not yet verified on device" (only the Android Gboard limit is verified).
  - Correct `anti-slop/audit-002-2026-10-09.md`'s "Fix round 3" sentence that says every other change is dark-only or invisible in light.
- Create: `anti-slop/audit-003-2026-10-09.md`; screenshots in `output/native-review/visual-b/`.

**Interfaces:**
- Consumes: Tasks 1 to 10, integrated on `v2`.

- [ ] **Step 1:** Run `npm run typecheck`, `npm test`, `npm run build`, `npm test -w @catera/customer` and `npm test -w @catera/caterer`. All must PASS.

- [ ] **Step 2: Emulator in four looks** (light Siang, light Malam, dark Siang, dark Malam; demo backend `CATERA_V1_DEMO=true`):
  - Capture Beranda, Jadwal, Jelajah, Akun, a pushed screen, Beli, and Dapur Hari ini, Menu, Pelanggan, Usaha and a pushed screen, as `<app>-<screen>-<theme>-<mood>.png`.
  - Toggle the mood on Beranda and on Dapur Hari ini. Confirm the header and hero cross-fade while the body and tab bar do not change, and the arc disc travels.
  - Turn on reduced motion and confirm the switch is instant.

- [ ] **Step 3: Click-through (R-35):** press every new control in both moods (the toggles, the date button, other-meal row, circles, calendar cells, strip days, "Tambah foto" with a demo image, "Ubah menu", preview). Record each one.

- [ ] **Step 4: Layout:** at `font_scale 1.3`, check:
  - the Beranda headline with a long dish name, the Jadwal grid (the photo-dot fallback), the Jelajah header and the Dapur header;
  - no overflow, no control under 48dp, nothing hidden by the tab bar.

  Restore `font_scale 1.0` afterwards.

- [ ] **Step 5: Write `anti-slop/audit-003-2026-10-09.md`** with:
  - the four core Delivery Gate blocks, with evidence;
  - the UI and Layoutmobile checklists;
  - the dials (customer 2/2/2, Dapur 1/1/1);
  - the identity motif (the day arc and the lunchbox);
  - the one accent;
  - the click-through and font-scale findings;
  - a building-native-ui compliance line per Skill rule.

  Cite only captures that exist. Fix any FAIL before Step 6, through a fix round dispatched by the controller.

- [ ] **Step 6: Commit**: `docs(design): native mood identity, Phase B gate`

---

## Later plans

Phase C (daily loop: `delivery.cook`, the rantang track, the Menu besok story, the Dapur checklist and delivery order) and Phase D (purchase and renewal beats) get their own plans after Phase B. They carry the same REQUIRED SKILLS header, model rules and throughput rules.
