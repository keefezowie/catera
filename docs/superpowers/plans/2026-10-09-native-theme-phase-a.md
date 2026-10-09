# Native theme foundation (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **REQUIRED SKILLS (owner instruction, 2026-10-09; applies to every implementer and every reviewer):** before touching code or reviewing a diff, invoke the Skill tool for `mcpmarket-me:building-native-ui`, `antislop:antislop`, `antislop:antislop-ui` and `antislop:antislop-layoutmobile`, and apply them. antislop mode is already resolved as **after (session override)**: do not ask the mode question. The concrete rules these skills impose on this plan are listed under "Skill rules" in Global Constraints.

**Goal:** Make both native apps fully themeable (light and dark, following the system or the user's Tampilan choice) with no visible change in light mode, as the base for the mood identity in Phase B.

**Architecture:**
- `@catera/design-tokens` gains `nativeThemes.light` and `nativeThemes.dark`, which share the key set of today's `colors`. Dark inverts the forest and cream pair.
- `@catera/mobile-ui` gains a `ThemeProvider` that resolves the palette from a stored preference (SecureStore), falling back to `useColorScheme()`. Components read it through `useColors()` and, for stylesheets, `themedStyles()`.
- Every native file that reads `colors.*` is migrated mechanically. A guard test then forbids `colors` in native sources.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, expo-secure-store, Jest (jest-expo) for native, Vitest for repo tests, TypeScript.

**Spec:** [docs/superpowers/specs/2026-10-09-native-visual-identity-design.md](../specs/2026-10-09-native-visual-identity-design.md), sections 3.1, 3.2, 6, 9 (Phase A), 10, 12.

## Global Constraints

- Work on `v2`. Never stage `apps/web/tsconfig.json`. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Light-mode values are exactly today's `colors`; Phase A must not change any light-mode pixel.
- Dark palette values are the spec 3.2 table, verbatim (see Task 1).
- Theme preference values are `"system" | "light" | "dark"`, stored under `runtime.storageKey("theme")`, default `"system"`. An unknown stored value means `"system"`.
- UI copy: the row is "Tampilan" / "Appearance" with options "Sistem" / "System", "Terang" / "Light", "Gelap" / "Dark". Indonesian first, via `t(id, en)`. No em dashes in any copy.
- Native sources never write `fontWeight` (existing guard) and, after Task 7, never read `colors` (new guard). Literal hex stays forbidden in Dapur and mobile-ui sources (existing guard). Exceptions are named: the QRIS pure-white quiet zone and translucent `rgba` fills.
- Only transform and opacity animate. A theme change is not animated.
- Contrast: text at least 4.5:1 on its fill; `controlRing` at least 3:1 on `surface`, enforced by `tests/native-contrast.test.ts`.
- antislop mode: after (session override). The Delivery Gate runs in Task 8.

### Skill rules

From `building-native-ui`:
- Read context with `React.use(Context)`, never `useContext`, in new or rewritten code.
- New platform checks use `process.env.EXPO_OS`, not `Platform.OS`. See ruling R1 for the two existing ones in `Screen`.
- New styles are inline objects. An existing file whose module-level `StyleSheet.create` reads colours migrates to `themedStyles` (a memoised stylesheet per theme). This is the skill's "unless reusing styles is faster" exception, because those styles are shared by every render of the component.
- Shadows only through `boxShadow`, never `shadowColor`/`shadowOffset`/`elevation`. None exist today; none may be added.
- Storage through `expo-secure-store` only (never `AsyncStorage`).
- `Text` forwards a `selectable` prop (Task 3). Every error message touched in Tasks 6 and 7 sets `selectable`, so users can copy it into a support message.
- Counters keep `fontVariant: ["tabular-nums"]`.

From `antislop` (core):
- R-21 and R-34: light and dark must both fully work.
- R-25: contrast is checked by test (Task 1) and by eye on the emulator (Task 8).
- R-27: loading, error and empty states keep working in dark mode.
- R-35: run the apps and record a click-through, not a claim.
- R-02: no em dashes in copy or comments.
- R-23: no new assets.
- **R-33: the colour migration is written by hand in each source file. No codemod, `sed`, regex-rewrite or patch script may edit source, and none may be committed.**

From `antislop-ui`:
- A theme is a decision, not a default: dark is offered because the owner asked for it, and the app follows the system unless the user chooses.
- No new decoration: no glow, gradient, glass or extra shadow appears in dark mode.
- The single accent (Sunrise ink) stays limited to the places it marks in light mode.

From `antislop-layoutmobile`:
- Every control stays at least 48dp, with spacing between adjacent targets.
- No text escapes its container and nothing scrolls horizontally, at font scale 1.0 and 1.3, in both themes (checked in Task 8).
- The bottom tab bar never covers content.
- Native screens are phone-width only and capped at 760, so tablet widths are out of scope for this phase.

### Rulings on skill conflicts (made 2026-10-09; repo conventions win)

- **R1:** `Screen` keeps its two `Platform.OS` checks. `apps/customer/tests/ui-foundation.test.tsx` switches platforms at runtime with `jest.replaceProperty(Platform, "OS", "ios")`, and `process.env.EXPO_OS` is inlined at build time, so converting them would break that coverage. Cost if wrong: two lines to convert later.
- **R2:** Component files keep the repo's PascalCase names (`AppHeader.tsx`, `PressableRow.tsx`). The new module is `theme.tsx`, which satisfies both conventions. Cost if wrong: renames only.
- **R3:** Pushed screens keep the shared `AppHeader` (DESIGN.md, Native motion) instead of native Stack titles.
- **R4:** Haptics stay on both platforms, as recorded in DESIGN.md, rather than iOS-only.
- **R5:** The `@expo/vector-icons` Ionicons set stays (DESIGN.md, Navigation), instead of SF Symbols through `expo-image`, because SF Symbols do not render on Android.

## Review Focus

1. **Garbage or unreadable stored preference:** a value like `"blue"`, or a SecureStore read that rejects, must leave the app on the system theme without a crash or a blank screen. Pinned in Task 2.
2. **System reports no scheme:** `useColorScheme()` returning `null` (some Android builds) must give light. Pinned in Task 2.
3. **Theme switched while a Sheet is open:** the open sheet's surface must repaint in the new theme; it must not keep the old palette until reopened. Pinned in Task 3.
4. **QRIS code in dark mode:** the quiet zone must stay pure white, or banking apps cannot scan it. Pinned in Task 6.
5. **Components rendered outside a provider** (every existing test, any future isolated render) must get the light palette, not `undefined` colours. Pinned in Task 2.

---

### Task 1: Theme tokens and contrast test

**Files:**
- Modify: `packages/design-tokens/src/index.ts`
- Test: `tests/native-contrast.test.ts` (create)

**Interfaces:**
- Produces:
  - `type PaletteKey = keyof typeof colors | "controlRing" | "tabBar"`
  - `type NativePalette = Record<PaletteKey, string>`
  - `type ThemeName = "light" | "dark"`
  - `export const nativeThemes: Record<ThemeName, NativePalette>`
  - `export function contrastRatio(a: string, b: string): number` (WCAG 2.x relative luminance, `#RRGGBB` input)

- [ ] **Step 1: Write the failing test** `tests/native-contrast.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { colors, contrastRatio, nativeThemes } from "../packages/design-tokens/src";

const TEXT = ["forest", "charcoal", "muted", "sunriseInk", "danger"] as const;
const FILLS = ["surface", "canvas", "sage", "scheduled", "tabBar"] as const;

describe("native themes", () => {
  it("light is today's colors, untouched", () => {
    for (const [k, v] of Object.entries(colors)) expect(nativeThemes.light[k as keyof typeof colors]).toBe(v);
  });
  it("dark has every light key", () => {
    expect(Object.keys(nativeThemes.dark).sort()).toEqual(Object.keys(nativeThemes.light).sort());
  });
  it("dark matches the spec table", () => {
    expect(nativeThemes.dark).toMatchObject({
      forest: "#FFF7E9", forestDeep: "#E9E3D6", sunrise: "#F47B2A", sunriseInk: "#F5C9A6", cream: "#163D2E",
      charcoal: "#F5F1E8", surface: "#232321", canvas: "#151514", sage: "#2A2D27", scheduled: "#26302A",
      muted: "#B5B2AA", line: "#34332F", fieldBorder: "#7A7872", secondaryBorder: "#4A4944",
      attentionBorder: "#4C3322", danger: "#FF8F80", controlRing: "#8A8780", tabBar: "#1E1E1C",
    });
    expect(nativeThemes.light).toMatchObject({ controlRing: "#858D80", tabBar: "#FFFEFA" });
  });
  for (const theme of ["light", "dark"] as const) {
    const p = nativeThemes[theme];
    it(`${theme}: text roles reach 4.5:1 on every fill`, () => {
      for (const t of TEXT) for (const f of FILLS) expect(contrastRatio(p[t], p[f]), `${t} on ${f}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: text on the cream card and cream on forest reach 4.5:1`, () => {
      for (const t of ["forest", "muted", "danger", "sunriseInk"] as const)
        expect(contrastRatio(p[t], p.cream), `${t} on cream`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.cream, p.forest)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: controlRing reaches 3:1 on surface`, () => {
      expect(contrastRatio(p.controlRing, p.surface)).toBeGreaterThanOrEqual(3);
    });
  }
  it("contrastRatio matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#60675F", "#FFFEFA")).toBeCloseTo(5.78, 1);
  });
});
```

Note: light `sunriseInk` on `cream` must also reach 4.5:1. If it fails, stop and report it; do not change a light value.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/native-contrast.test.ts`
Expected: FAIL, `nativeThemes` / `contrastRatio` not exported.

- [ ] **Step 3: Implement in `packages/design-tokens/src/index.ts`**

Add the types and `contrastRatio` from the Interfaces block. Define `nativeThemes.light = { ...colors, controlRing: "#858D80", tabBar: "#FFFEFA" }`, and `nativeThemes.dark` with the values asserted above. Keep `colors` and `webVariables` unchanged (the web still uses them).

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run tests/native-contrast.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add packages/design-tokens/src/index.ts tests/native-contrast.test.ts
git commit -m "feat(tokens): light and dark native palettes with a contrast test"
```

---

### Task 2: ThemeProvider, useColors, useThemePreference, themedStyles

**Files:**
- Create: `packages/mobile-ui/src/theme.tsx`
- Modify: `packages/mobile-ui/src/index.ts` (export `./theme`), `packages/mobile-ui/package.json` (add `"expo-secure-store": "*"` to `peerDependencies`)
- Test: `apps/customer/tests/theme.test.tsx` (create)

**Interfaces:**
- Consumes: `nativeThemes`, `NativePalette`, `ThemeName` from Task 1.
- Produces:
  - `type ThemePreference = "system" | "light" | "dark"`
  - `function ThemeProvider(props: { storageKey: string; children: ReactNode }): JSX.Element`
  - `function useColors(): NativePalette` (light palette when no provider is mounted)
  - `function useThemePreference(): { preference: ThemePreference; scheme: ThemeName; setPreference(p: ThemePreference): void }`
  - `function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: NativePalette) => T): () => T` (memoised per `ThemeName`: two calls in the same theme return the same object)

- [ ] **Step 1: Write the failing tests** in `apps/customer/tests/theme.test.tsx`

Mock `expo-secure-store` in-memory, as `apps/caterer/tests/setup.cjs` does. Mock `useColorScheme` with `jest.spyOn(require("react-native"), "useColorScheme")`. Use a probe component that renders `useColors().canvas` and `useThemePreference().preference` as text. Tests:
- `uses the light palette with no provider`: probe shows `#FDFAF3`.
- `follows the system scheme by default`: system `"dark"` gives `#151514` and preference `system`.
- `treats a null system scheme as light`: system `null` gives `#FDFAF3`.
- `applies a stored preference`: store `"dark"` under key `k`, system `"light"`; after `await waitFor`, `#151514`.
- `ignores an unknown stored value`: store `"blue"`; stays `system`, follows the system scheme.
- `survives a failing storage read`: `getItemAsync` rejects; renders, preference `system`.
- `setPreference stores and applies immediately`: call `setPreference("dark")`; expect `setItemAsync("k", "dark")` and the probe shows `#151514` in the same render pass after `act`.
- `themedStyles memoises per theme`: a component calling the returned hook twice in light gives the same object (`toBe`); after switching to dark, `backgroundColor` reads the dark value.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -w @catera/customer -- tests/theme.test.tsx`
Expected: FAIL, the module has no `ThemeProvider` export.

- [ ] **Step 3: Implement `packages/mobile-ui/src/theme.tsx`**

- Context default: `{ palette: nativeThemes.light, scheme: "light", preference: "system", setPreference: () => {} }`.
- The provider starts at `"system"`, reads storage once in an effect (a catch keeps `"system"`), validates the value against the three allowed strings, and resolves `scheme = preference === "system" ? (useColorScheme() === "dark" ? "dark" : "light") : preference`.
- `setPreference` updates state, then writes storage without awaiting; a failed write is ignored, and the in-memory choice still applies.
- `themedStyles` keeps a `{ light?: T; dark?: T }` cache in the closure, filled with `StyleSheet.create(factory(nativeThemes[scheme]))` on first use per scheme.
- Use `React.use(ThemeContext)` (building-native-ui preference).

- [ ] **Step 4: Run them and confirm they pass**

Run: `npm test -w @catera/customer -- tests/theme.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile-ui/src/theme.tsx packages/mobile-ui/src/index.ts packages/mobile-ui/package.json apps/customer/tests/theme.test.tsx
git commit -m "feat(mobile-ui): theme provider with stored preference and themed styles"
```

---

### Task 3: Theme the shared mobile-ui components

**Files:**
- Modify: `packages/mobile-ui/src/components.tsx` (Text, Button, Chip, Segmented, Card, Field, Stepper, Sheet, Screen, RoundButton, `cardTones`, `styles`), `packages/mobile-ui/src/AppHeader.tsx`, `packages/mobile-ui/src/DemoStrip.tsx`
- Test: `apps/customer/tests/ui-foundation.test.tsx` (add cases; existing cases must stay green unchanged)

**Interfaces:**
- Consumes: `useColors`, `themedStyles`, `ThemeProvider` (Task 2).
- Produces: every exported mobile-ui component renders from the active palette. `textVariants` keeps its `const textVariants = { ... } satisfies` shape, with its `fontWeight` entries (the font guard depends on that shape) and **no** `color` entries. Add `const variantColor: Record<keyof typeof textVariants, PaletteKey>`: title, heading, label and number map to `forest`, body to `charcoal`, caption to `muted`. `export { colors }` stays until Task 7.

- [ ] **Step 1: Write the failing tests** (in a `describe("dark theme")` block, wrapping renders in a `ThemeProvider` whose stored preference is `"dark"`, and awaiting its read)
- `Text title uses dark forest`: `StyleSheet.flatten(...).color === "#FFF7E9"`.
- `primary Button is a cream fill with forest text`: background `#FFF7E9`, label colour `#163D2E`.
- `Screen and AppHeader paint the dark canvas`: `#151514`.
- `an open Sheet repaints when the theme changes` (Review Focus 3): render a `Sheet` with `visible` under light, call `setPreference("dark")` through a probe button inside the tree, and expect the sheet surface to be `#232321`.
- `explicit style colour still wins over the variant`: `<Text style={{ color: "#123456" }}>` (test-only literal) renders `#123456`.
- `Text forwards selectable`: `<Text selectable>` renders an RN `Text` with `selectable === true`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -w @catera/customer -- tests/ui-foundation.test.tsx`
Expected: the new dark cases FAIL (light colours rendered); existing cases PASS.

- [ ] **Step 3: Migrate the three files**

Replace the module-level `StyleSheet.create` calls that read `colors` with `const useStyles = themedStyles((c) => ({ ... }))` and `const styles = useStyles()` inside each component. Replace inline `colors.x` with `c.x` from `useColors()`. `Text` merges `{ color: palette[variantColor[variant]] }` before the caller's `style`, and accepts and forwards `selectable?: boolean`. Edit by hand (R-33).

- [ ] **Step 4: Run the whole customer and Dapur native suites**

Run: `npm test -w @catera/customer` then `npm test -w @catera/caterer`
Expected: PASS, with no snapshot or style assertion changed (light is identical).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile-ui/src apps/customer/tests/ui-foundation.test.tsx
git commit -m "feat(mobile-ui): shared components follow the active theme"
```

---

### Task 4: Mount the theme at both app roots

**Files:**
- Modify: `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx`, `apps/customer/app/(tabs)/_layout.tsx`, `apps/caterer/app/(tabs)/_layout.tsx`, `apps/customer/app.config.ts`, `apps/caterer/app.config.ts`
- Test: `apps/caterer/tests/layout.test.tsx` and `apps/customer/tests/shell.test.tsx` (add cases)

**Interfaces:**
- Consumes: `ThemeProvider`, `useColors`, `useThemePreference` (Task 2); `runtime.storageKey` from `src/runtime`.
- Produces: `<ThemeProvider storageKey={runtime.storageKey("theme")}>` sits directly inside `SafeAreaProvider`, around the app providers, in both roots. Both apps set `userInterfaceStyle: "automatic"`.

- [ ] **Step 1: Write the failing tests**
- Dapur layout, dark system scheme: the tab bar style has `backgroundColor: "#1E1E1C"` and `borderTopColor: "#34332F"`, and the status bar receives `style="light"`. Mock `expo-status-bar`'s `StatusBar` to capture props.
- Customer shell, light: the tab bar is `#FFFEFA` with border `#E2E3D8`, and the status bar style is `"dark"`.
- A static test (Vitest, `tests/native-appearance.test.ts`) that reads both `app.config.ts` files and expects `userInterfaceStyle: "automatic"`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -w @catera/caterer -- tests/layout.test.tsx`, `npm test -w @catera/customer -- tests/shell.test.tsx`, `npx vitest run tests/native-appearance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- Tab bars use `tabBar` for the background, `line` for the top border, and `forest` / `muted` for the tints.
- `Navigation` reads the canvas, spinner and `contentStyle` colours from `useColors()`.
- `StatusBar style={scheme === "dark" ? "light" : "dark"}`.

- [ ] **Step 4: Run them and confirm they pass**

Same commands. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/customer/app apps/caterer/app apps/customer/app.config.ts apps/caterer/app.config.ts apps/caterer/tests/layout.test.tsx apps/customer/tests/shell.test.tsx tests/native-appearance.test.ts
git commit -m "feat(native): mount the theme at both roots and follow the system appearance"
```

---

### Task 5: Tampilan row in Akun and Usaha

**Files:**
- Modify: `apps/customer/src/account/Akun.tsx` (next to `Language()`), `apps/caterer/src/business/UsahaScreen.tsx` (next to the language `Segmented`)
- Test: `apps/customer/tests/account.test.tsx`, `apps/caterer/tests/business.test.tsx`

**Interfaces:**
- Consumes: `useThemePreference` (Task 2), `Segmented` (existing).
- Produces: a `Segmented<ThemePreference>` labelled "Tampilan" / "Appearance", with options in the order `system`, `light`, `dark` and the labels from Global Constraints.

- [ ] **Step 1: Write the failing tests** (both apps)
- The row shows "Tampilan", with "Sistem" selected by default.
- Pressing "Gelap" calls `SecureStore.setItemAsync(<storageKey("theme")>, "dark")`, and the screen container's background becomes `#151514` without a remount.
- In English, the labels read "Appearance", "System", "Light", "Dark".

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -w @catera/customer -- tests/account.test.tsx`, `npm test -w @catera/caterer -- tests/business.test.tsx`
Expected: FAIL, no "Tampilan" text.

- [ ] **Step 3: Implement** the row in both screens, mirroring each screen's existing language row (customer: `SectionLabel` plus `Segmented`; Dapur: the inline `Segmented`).

- [ ] **Step 4: Run them and confirm they pass**

Same commands. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/customer/src/account/Akun.tsx apps/caterer/src/business/UsahaScreen.tsx apps/customer/tests/account.test.tsx apps/caterer/tests/business.test.tsx
git commit -m "feat(native): Tampilan setting for system, light or dark"
```

---

### Task 6: Migrate the customer app off `colors`

**Files:**
- Modify: every file under `apps/customer/src` and `apps/customer/app` that reads `colors` (37 at planning time: `account/*` (10), `buy/*` (6), `claim/ClaimScreen`, `discover/*` (5), `help/*` (2), `schedule/*` (5), `shell.tsx`, `today/*` (6)). Find them with `grep -rl "colors" apps/customer/src apps/customer/app`.
- Test: `tests/native-theme-guard.test.ts` (create), `apps/customer/tests/buy.test.tsx` (QRIS case)

**Interfaces:**
- Consumes: `useColors`, `themedStyles` (Task 2).
- Produces: `tests/native-theme-guard.test.ts` with an `appDirs` list, starting with the two customer directories, and the assertion that no file matches `/\bcolors\b/`. It reuses the `walk`/`rel` helpers pattern from `tests/native-font-weights.test.ts`.

- [ ] **Step 1: Write the failing tests**
- Guard: `customer native sources read the theme, never colors`. The expected offender list is `[]`.
- QRIS (Review Focus 4): render the QRIS code under the dark theme; the quiet-zone container's background is `"#FFFFFF"`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run tests/native-theme-guard.test.ts`
Expected: FAIL, listing the 37 files.

- [ ] **Step 3: Migrate file by file**
- Mechanical rule: `colors.x` becomes `c.x` with `const c = useColors()` inside the component.
- Module-level `StyleSheet.create` that reads colours becomes `themedStyles`.
- A module-level constant or helper that maps state to a colour takes the palette as its first parameter (for example `toneFor(c, state)`).
- Keep the named literal exceptions (QRIS `#FFFFFF`, `rgba` overlays) as they are.
- Error messages rendered in `danger` gain `selectable` (Skill rules).
- Do not change layout, copy or behaviour otherwise.
- Edit each file by hand. No codemod, `sed` or rewrite script (R-33).

- [ ] **Step 4: Run the guard and the full customer suite**

Run: `npx vitest run tests/native-theme-guard.test.ts` then `npm test -w @catera/customer`
Expected: PASS; no existing assertion edited except imports.

- [ ] **Step 5: Commit**

```bash
git add apps/customer tests/native-theme-guard.test.ts
git commit -m "refactor(customer): read colours from the active theme"
```

---

### Task 7: Migrate Catera Dapur, close the guard

**Files:**
- Modify: every file under `apps/caterer/src` and `apps/caterer/app` that reads `colors` (19 at planning time: `auth/*` (2), `business/*` (6), `customers/*` (2), `import/ImportAssistant`, `menu/*` (3), `ReadError`, `today/*` (4)); `packages/mobile-ui/src/components.tsx` (remove `export { colors }`)
- Test: `tests/native-theme-guard.test.ts` (extend `appDirs` with `apps/caterer/src`, `apps/caterer/app`, and `packages/mobile-ui/src` excluding `theme.tsx`)

**Interfaces:**
- Consumes: as in Task 6.
- Produces: no native source reads `colors`; `@catera/mobile-ui` no longer exports `colors`.

- [ ] **Step 1: Extend the guard** and add `mobile-ui does not re-export colors` (the source of `components.tsx` does not match `/export \{ colors \}/`).

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/native-theme-guard.test.ts`
Expected: FAIL, listing the 19 Dapur files and the re-export.

- [ ] **Step 3: Migrate**, using the same rules as Task 6 (by hand, error messages `selectable`, no rewrite scripts). Also update `apps/customer/tests/ui-foundation.test.tsx`, which imports `colors` from `@catera/mobile-ui`: import `nativeThemes` from `@catera/design-tokens` and read `nativeThemes.light.x`.

- [ ] **Step 4: Run everything**

Run: `npx vitest run tests/native-theme-guard.test.ts tests/native-font-weights.test.ts`, `npm test -w @catera/caterer`, `npm test -w @catera/customer`, `npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/caterer packages/mobile-ui apps/customer/tests/ui-foundation.test.tsx tests/native-theme-guard.test.ts
git commit -m "refactor(dapur): read colours from the active theme; drop the colors re-export"
```

---

### Task 8: DESIGN.md, emulator verification and the antislop Delivery Gate

**Files:**
- Modify: `DESIGN.md` (Colors: a "Native dark theme" subsection with the spec 3.2 table and the forest/cream inversion; Components: the Tampilan row; Typography and Navigation unchanged; a dated "Native theme, October 9, 2026" section recording the owner decisions: system default, the Tampilan override, charcoal body never green)
- Create: `output/native-review/visual-a/` screenshots, `anti-slop/audit-002-2026-10-09.md` (the Delivery Gate report for Phase A)

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified light/dark builds and the Phase A gate record.

- [ ] **Step 1: Run the full checks**

Run: `npm run typecheck`, `npm test`, `npm run build`, `npm test -w @catera/customer`, `npm test -w @catera/caterer`
Expected: all PASS.

- [ ] **Step 2: Emulator pass, both apps, demo mode**
- Setup: `CATERA_V1_DEMO=true npm run dev`; Metro per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.
- For each tab screen and each pushed screen, capture `adb shell cmd uimode night no` and `night yes` into `output/native-review/visual-a/<app>-<screen>-<light|dark>.png`.
- Light captures must match the Phase 1 baseline in `output/native-review/` by eye. Any difference is a bug, not a design change.
- Then set Tampilan to Gelap with the system on light, and confirm the whole app turns dark without a restart and stays dark after relaunch.

- [ ] **Step 3: Click-through (R-35)**: in dark mode, press every control on Beranda, Jadwal, Jelajah, Akun, Hari ini, Pelanggan, Menu and Usaha, plus one sheet per app. Record element, action, result.

- [ ] **Step 4: Layout check (antislop-layoutmobile)**: with `adb shell settings put system font_scale 1.3`, revisit every tab screen and the Tampilan row in both themes. Record any text that escapes its container, any horizontal scroll, any control under 48dp, or content hidden behind the tab bar. Restore `font_scale 1.0` afterwards.

- [ ] **Step 5: Write `anti-slop/audit-002-2026-10-09.md`** with:
  - The four core Delivery Gate blocks, each line with evidence.
  - The antislop-ui "UI Skill Checklist" and the antislop-layoutmobile "Layoutmobile Skill Checklist", each line with evidence.
  - The dials as in DESIGN.md (customer ENERGY 2 / RHYTHM 2 / MOTION 2; Dapur 1 / 1 / 1).
  - The click-through list and the font-scale findings.
  - A building-native-ui compliance line for each Skill rule.

  Any FAIL is fixed before Step 6.

- [ ] **Step 6: Update DESIGN.md and commit**

```bash
git add DESIGN.md anti-slop/audit-002-2026-10-09.md output/native-review/visual-a
git commit -m "docs(design): native dark theme and Tampilan setting, Phase A gate"
```

---

## Later plans

Phases B (mood identity), C (daily loop, which absorbs the October 8 Phase 2 backend) and D (purchase and renewal beats) get their own plans after Phase A lands, because they build on `useColors` and `themedStyles` and on the emulator findings from Task 8. Each of those plans carries the same REQUIRED SKILLS header, its own Skill rules section and the rulings above.
