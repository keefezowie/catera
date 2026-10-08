# Native UI/UX Phase 1: Foundations and Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both Catera native apps render the brand typeface correctly at the documented scale, give every control press and haptic feedback, and fix the live-pass defects in the customer app and Catera Dapur.

**Architecture:** Shared foundations live in `packages/mobile-ui` (font families, type ramp, motion primitives, app header) and `packages/design-tokens` (native motion tokens). Domain helpers live in `packages/domain`. Screen fixes stay in their existing files in `apps/customer/src` and `apps/caterer/src`. No backend or migration changes in this phase.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, react-native-reanimated 4.5.1, expo-haptics (new), react-native-svg (already installed), Jest (`jest-expo/android` + RNTL) per app, root Vitest.

**Spec:** `docs/superpowers/specs/2026-10-08-native-uiux-motion-design.md` (Phase 1 section, plus Interview log decisions 2, 12, 13, 16–18).

**Deliberate refinements of the spec (flag in review if unwanted):**
- Only the motion primitives Phase 1 uses are built here (`useReduced`, `useHaptic`, `PressableScale`, `FadeSwap`). `AnimatedNumber`, `PlateUnveil`, `JourneyStepper` and `Celebrate` move to the Phase 2/3 plans where they are first used.
- The shared header is rendered once through the Stack `header` option (round back button + one-line heading, the BuyScreen pattern) instead of rebuilding the title inside each screen's content. Same look, far less churn.
- Customer `shortDate` output is "Jumat 9 Okt" (full weekday, short month); tests below use that format.

## Global Constraints

- Palette fixed: forest `#163D2E`, sunrise `#F47B2A` (accent only, "Sunrise is not the default action fill" — DESIGN.md:184), cream `#FFF7E9`, scheduled-bg `#EDF1E6`, scheduled-ink `#4F6445`.
- Native type ramp (DESIGN.md:217-223): Title 30/39 700 −0.8; Heading 21/28 700 −0.4; Body 14/23; Small 11/18; Label 12/23 700.
- Native motion tokens: control 120ms, selection 180ms, content 220ms, feature 320ms, ease `cubic-bezier(.16,1,.3,1)`.
- Motion rules: no staggered catalog/list entrances; navigation, operational rows and money totals stay still; reduced motion disables movement (opacity-only or instant).
- Animate only `transform` and `opacity`.
- Controls ≥ 48dp; operational numbers use `fontVariant: ["tabular-nums"]`.
- Indonesian-first copy through `t(id, en)`; never promise what the server doesn't know.
- Fonts come only from `https://github.com/tokotype/PlusJakartaSans` commit `18d1cd2f7ea10481919d2f05c1f7064b7307fc26`, path `fonts/ttf/`.
- Native only; do not change `apps/web` runtime code (only read `apps/web/src/lib/motion.ts` in a test).
- Expo Go 57 must keep running both apps (customer test `tests/expo-go.test.tsx` stays green).
- Work on branch `v2`; leave the pre-existing changes in `apps/web/next-env.d.ts` and `apps/web/tsconfig.json` uncommitted.

## Review Focus

1. **Bold text on Android after the font change** — every title/label/button must render in Jakarta, including text styled by callers with `fontWeight`; pinned by Task 2's `fontFor` tests and the `fontWeight` guard.
2. **The larger 30/21 ramp wrapping or clipping** in headers, the buy footer total and tab-less screens — pinned by Task 3's emulator screenshot checklist and the header `numberOfLines` test in Task 5.
3. **Reduced motion** — `PressableScale` must not scale when reduce-motion is on; pinned by Task 4 test `does not scale when reduced motion is on`.
4. **A conflicting purchase whose plan ends beyond the 21-day picker window** — "Mulai {date}" must still produce a valid start; pinned by Task 8 test `nextStartAfter finds a start after a long active plan`.
5. **Change-day sheet with zero bookable dates** — the chip strip must show the existing "Belum ada tanggal…" message, not an empty row; pinned by Task 7 test `shows the empty message when no date is bookable`.

---

### Task 1: Break the domain require cycles

Metro warns `Require cycle: packages/domain/src/index.ts -> customer-day.ts -> index.ts` on every launch. Files that import **values** from `./index` cause it.

**Files:**
- Create: `packages/domain/src/dates.ts`, `packages/domain/src/offer-schema.ts`
- Modify: `packages/domain/src/index.ts` (move `addDays` + `schedule` at ~585-608 and `offerSchema` at ~474-560 out; re-export), `packages/domain/src/customer-day.ts:1`, `packages/domain/src/checkout-eligibility.ts:1`, `packages/domain/src/offer-editor.ts:1`
- Test: `tests/domain-import-cycles.test.ts`

**Interfaces:**
- Produces: `addDays(day: string, n: number): string` and `schedule(start, days, weekdays, closed?)` exported from `./dates`; `offerSchema` exported from `./offer-schema`. Both still re-exported from `@catera/domain` (public API unchanged).

- [ ] **Step 1: Write the failing guard test** `tests/domain-import-cycles.test.ts`

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../packages/domain/src");
describe("domain modules", () => {
  it("import only types from ./index", () => {
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts")
      .filter((f) => {
        const src = readFileSync(join(dir, f), "utf8");
        return [...src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"\.\/index"/g)].some(
          ([, typeOnly, names]) => !typeOnly && names.split(",").some((n) => n.trim() && !n.trim().startsWith("type ")),
        );
      });
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/domain-import-cycles.test.ts`
Expected: FAIL listing `checkout-eligibility.ts`, `customer-day.ts`, `offer-editor.ts` (and `customer-actions.ts` if it imports values — fix it the same way).

- [ ] **Step 3: Move the code**

Move `addDays` and `schedule` verbatim into `dates.ts`. Move `offerSchema` verbatim into `offer-schema.ts`, importing `z`, `durationOptionsSchema` from `./purchase-pricing` and `menuSchema`/`nutritionSchema` from `./contents` (plus any other value it needs from a leaf module; types only from `./index`). In `index.ts` add `export * from "./dates";` and `export * from "./offer-schema";` and import `addDays`/`schedule`/`offerSchema` from those files where `index.ts` itself uses them. Point the offending files at `./dates` / `./offer-schema` and make the remaining `./index` imports `import type`.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/domain-import-cycles.test.ts tests/domain.test.ts tests/customer-day.test.ts && npm run typecheck`
Expected: all PASS. Then reload the customer app in Expo Go: Metro log shows no `Require cycle` line for `packages/domain`.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src tests/domain-import-cycles.test.ts
git commit -m "refactor(domain): leaf dates and offer-schema modules to end require cycles"
```

---

### Task 2: Static Jakarta weights and weight→family mapping

Android cannot select weights from the variable TTF, so every bold label falls back to Roboto.

**Files:**
- Create: `packages/brand/assets/fonts/static/PlusJakartaSans-{Regular,Medium,SemiBold,Bold,ExtraBold}.ttf`, `packages/mobile-ui/src/type.ts`, `tests/native-font-weights.test.ts`, `apps/customer/tests/ui-foundation.test.tsx`
- Modify: `packages/brand/manifest.font.json`, `packages/mobile-ui/src/components.tsx`, `packages/mobile-ui/src/index.ts`, `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx`, every app file with `fontWeight` (31 files; largest: `apps/customer/src/today/Plate.tsx`, `apps/caterer/src/today/TodayScreen.tsx`, `apps/customer/src/claim/ClaimScreen.tsx`, `apps/customer/src/buy/PaymentScreen.tsx`; also `apps/*/app/(tabs)/_layout.tsx` and the inline `Link` style in `apps/caterer/src/auth/Masuk.tsx:116`)

**Interfaces:**
- Produces (from `@catera/mobile-ui`):
  - `fonts = { regular: "Jakarta", medium: "Jakarta-Medium", semibold: "Jakarta-SemiBold", bold: "Jakarta-Bold", extrabold: "Jakarta-ExtraBold" } as const`
  - `fontFor(weight?: TextStyle["fontWeight"]): string` — `undefined | "normal" | "100".."400"` → regular; `"500"` → medium; `"600"` → semibold; `"bold" | "700"` → bold; `"800" | "900"` → extrabold.
  - `fontAssets: Record<string, number>` — the five `require(...)` entries keyed by family name, for `useFonts`.
  - `Text` flattens its style, sets `fontFamily: fontFor(flattened.fontWeight)` and removes `fontWeight`.
- `FONT` stays exported (= `fonts.regular`).

- [ ] **Step 1: Write failing tests**

`apps/customer/tests/ui-foundation.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { fontFor, fonts, Text } from "@catera/mobile-ui";

test("fontFor maps weights to static families", () => {
  expect(fontFor(undefined)).toBe(fonts.regular);
  expect(fontFor("500")).toBe(fonts.medium);
  expect(fontFor("600")).toBe(fonts.semibold);
  expect(fontFor("bold")).toBe(fonts.bold);
  expect(fontFor("700")).toBe(fonts.bold);
  expect(fontFor("800")).toBe(fonts.extrabold);
});

test("Text turns a caller's fontWeight into a family", () => {
  render(<Text style={{ fontWeight: "700" }}>Halo</Text>);
  const style = StyleSheet.flatten(screen.getByText("Halo").props.style);
  expect(style.fontFamily).toBe("Jakarta-Bold");
  expect(style.fontWeight).toBeUndefined();
});
```

`tests/native-font-weights.test.ts` (Vitest): recursively read `.ts`/`.tsx` under `apps/customer/src`, `apps/customer/app`, `apps/caterer/src`, `apps/caterer/app`; assert the list of files containing `fontWeight` equals `[]`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -w @catera/customer -- tests/ui-foundation.test.tsx` → FAIL (`fontFor` not exported).
Run: `npx vitest run tests/native-font-weights.test.ts` → FAIL listing 31 files.

- [ ] **Step 3: Add the font files with provenance**

Download the five files from `https://raw.githubusercontent.com/tokotype/PlusJakartaSans/18d1cd2f7ea10481919d2f05c1f7064b7307fc26/fonts/ttf/<name>.ttf` into `packages/brand/assets/fonts/static/`. Compute each SHA-256 and git blob hash; confirm the blob hash matches the upstream tree API entry. Add a `static` array to `manifest.font.json` with `{ path, upstreamPath, bytes, sha256, gitBlob, weight }` per file and set `integrationNotes.native` to "Native registers the five static TTFs as Jakarta, Jakarta-Medium, Jakarta-SemiBold, Jakarta-Bold, Jakarta-ExtraBold; variable fonts stay web-only."

- [ ] **Step 4: Implement `type.ts`, wire `Text` and internal styles**

Put `fonts`, `fontFor`, `fontAssets` in `packages/mobile-ui/src/type.ts`; export from `index.ts`. In `components.tsx` replace every `fontFamily: FONT, … fontWeight: "N"` pair with `fontFamily: fontFor("N")` (buttonLabel, chipLabel, fieldLabel, Stepper inline styles). Both `_layout.tsx` files call `useFonts(fontAssets)` and set `headerTitleStyle: { fontFamily: fonts.bold }`.

- [ ] **Step 5: Convert app sources**

In each listed file replace `fontWeight: "N"` with `fontFamily: fontFor("N")` (or `fonts.<name>`), removing a now-redundant `fontFamily: FONT` in the same style object. Tab bar label styles in `(tabs)/_layout.tsx` get `fontFamily: fonts.semibold`/`fonts.bold`.

- [ ] **Step 6: Verify**

Run: `npx vitest run tests/native-font-weights.test.ts && npm test -w @catera/customer && npm test -w @catera/caterer && npm run typecheck`
Expected: all PASS. Emulator: reload both apps; "Hari ini", "1 porsi", "Bayar", tab labels render in Jakarta (rounded "a", "y" without Roboto's flat terminals).

- [ ] **Step 7: Commit**

```bash
git add packages/brand packages/mobile-ui apps tests/native-font-weights.test.ts
git commit -m "fix(native): register static Jakarta weights so bold text stops falling back to Roboto"
```

---

### Task 3: Adopt the documented native type ramp

**Files:**
- Modify: `packages/mobile-ui/src/components.tsx:22-29` (`textVariants`), screens that hard-code sizes the new ramp makes wrong (found in Step 4)
- Test: `apps/customer/tests/ui-foundation.test.tsx`

**Interfaces:**
- Produces `textVariants` (variant names unchanged; `caption` is DESIGN.md "Small"):
  - `title`: 30 / lineHeight 39 / bold / letterSpacing −0.8 / forest
  - `heading`: 21 / 28 / bold / −0.4 / forest
  - `body`: 14 / 23 / regular / charcoal
  - `label`: 12 / 23 / bold / forest
  - `caption`: 11 / 18 / regular / muted
  - `number`: 40 / extrabold / −1 / forest / `fontVariant: ["tabular-nums"]`

- [ ] **Step 1: Write the failing test** — append to `ui-foundation.test.tsx`:

```tsx
test.each([
  ["title", 30, 39],
  ["heading", 21, 28],
  ["body", 14, 23],
  ["label", 12, 23],
  ["caption", 11, 18],
] as const)("%s uses the documented ramp", (variant, size, line) => {
  render(<Text variant={variant}>x</Text>);
  const s = StyleSheet.flatten(screen.getByText("x").props.style);
  expect([s.fontSize, s.lineHeight]).toEqual([size, line]);
});

test("title and heading use the bold family", () => {
  render(<Text variant="title">Jadwal</Text>);
  expect(StyleSheet.flatten(screen.getByText("Jadwal").props.style).fontFamily).toBe("Jakarta-Bold");
});
```

- [ ] **Step 2: Run** `npm test -w @catera/customer -- tests/ui-foundation.test.tsx` → FAIL (24 ≠ 30).
- [ ] **Step 3: Update `textVariants`** with the values above.
- [ ] **Step 4: Emulator wrapping pass.** Screenshot every tab and pushed screen in both apps (same list as the spec's live pass). Fix only real breakage: e.g. drop the `fontSize: 22` override on the buy footer total only if it clips; ensure single-line headings use `numberOfLines`. Record before/after shots in `output/native-review/p1/type/`.
- [ ] **Step 5: Verify** `npm test -w @catera/customer && npm test -w @catera/caterer` → PASS (update snapshot-like text assertions only where they assert sizes).
- [ ] **Step 6: Commit** `git commit -m "feat(native): adopt documented native type ramp (30/21/14)"`

---

### Task 4: Motion and haptics foundation

**Files:**
- Create: `packages/mobile-ui/src/motion/useReduced.ts`, `useHaptic.ts`, `PressableScale.tsx`, `FadeSwap.tsx`, `index.ts`; `tests/native-motion-tokens.test.ts`
- Modify: `packages/design-tokens/src/index.ts` (add `nativeMotion`), `packages/mobile-ui/package.json` (peerDependencies `react-native-reanimated`, `expo-haptics`), `packages/mobile-ui/src/components.tsx` (`Button`, `Chip`, `Segmented`), `packages/mobile-ui/src/index.ts`, `apps/customer/package.json` + `apps/caterer/package.json` (via `npx expo install expo-haptics`), `apps/*/tests/setup.cjs`
- Test: `apps/customer/tests/ui-foundation.test.tsx`

**Interfaces:**
- `nativeMotion = { control: 120, selection: 180, content: 220, feature: 320, ease: [0.16, 1, 0.3, 1] as const, spring: { damping: 18, stiffness: 260 } } as const` in `@catera/design-tokens`.
- `useReduced(): boolean` — wraps Reanimated `useReducedMotion()`.
- `useHaptic(): { tap(): void; select(): void; success(): void; warning(): void }` — `tap` = `impactAsync(Light)`, `select` = `selectionAsync()`, `success`/`warning` = `notificationAsync(...)`; every call swallows rejections.
- `PressableScale(props: PressableProps & { haptic?: "tap" | "select" | "none"; style?: StyleProp<ViewStyle> })` — on press-in springs scale to 0.97 with `nativeMotion.spring`, back to 1 on press-out; when `useReduced()` is true, never scales and dims to opacity 0.85 instead; fires the haptic on `onPress` (default `"tap"`). Does not change `accessibilityRole`/`State` passed through.
- `FadeSwap({ swapKey: string; children })` — cross-fades children over `nativeMotion.content` when `swapKey` changes; renders instantly when reduced.
- `Button` uses `PressableScale` (haptic `"tap"`, none when disabled); `Chip` and `Segmented` segments use `PressableScale` with haptic `"select"`.

- [ ] **Step 1: Install and mock**

Run in `apps/customer` and `apps/caterer`: `npx expo install expo-haptics`. Add to both `tests/setup.cjs`:
```js
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
```

- [ ] **Step 2: Write failing tests**

`tests/native-motion-tokens.test.ts` (Vitest):
```ts
import { nativeMotion } from "../packages/design-tokens/src";
import { webMotion } from "../apps/web/src/lib/motion";
it("native durations match web motion", () => {
  expect([nativeMotion.control, nativeMotion.selection, nativeMotion.content, nativeMotion.feature])
    .toEqual([webMotion.control, webMotion.selection, webMotion.content, webMotion.feature]);
  expect(`cubic-bezier(${nativeMotion.ease.map(String).join(",").replace(/0\./g, ".")})`).toBe(webMotion.ease);
});
```

Append to `ui-foundation.test.tsx`:
- `Button fires onPress and a light haptic` — press `getByRole("button", { name: "Bayar" })`; expect `onPress` called once and `Haptics.impactAsync` called once.
- `disabled Button fires no haptic` — `impactAsync` not called.
- `Chip fires a selection haptic` — `selectionAsync` called once.
- `does not scale when reduced motion is on` — `jest.spyOn(Reanimated, "useReducedMotion").mockReturnValue(true)`; render `PressableScale` with `testID="p"`; fire `pressIn`; flattened style of the animated child has no `transform` scale other than 1.

- [ ] **Step 3: Run** both test files → FAIL (missing exports).
- [ ] **Step 4: Implement** the tokens and the four motion files per Interfaces; export them from `@catera/mobile-ui`; swap `Pressable` for `PressableScale` in `Button`, `Chip`, `Segmented`.
- [ ] **Step 5: Verify** `npx vitest run tests/native-motion-tokens.test.ts && npm test -w @catera/customer && npm test -w @catera/caterer && npm run typecheck` → PASS. Run `npx expo install --check` in both apps → no SDK mismatch for reanimated, worklets, expo-haptics. Emulator: buttons visibly compress on press; with system "Remove animations" on, they only dim.
- [ ] **Step 6: Commit** `git commit -m "feat(native): motion tokens, haptics and press feedback on shared controls"`

---

### Task 5: One header pattern for pushed screens

Pushed screens currently mix the system Stack header (Roboto-styled title, e.g. "Hari", "Masuk") with the round back button on package detail and buy. This task makes every pushed screen use the round back button + title row that BuyScreen already uses, rendered once through the Stack `header` option so no screen rebuilds its own.

**Files:**
- Create: `packages/mobile-ui/src/AppHeader.tsx`
- Modify: move `RoundButton` from `apps/customer/src/discover/PackageCard.tsx:10` into `packages/mobile-ui/src/components.tsx` (update its importers: `PackageCard.tsx`, `PackageDetail.tsx`, `BuyScreen.tsx`, `PaymentScreen.tsx` and any other `grep RoundButton` hit); `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx` (`screenOptions.header`), `apps/customer/src/account/Masuk.tsx:59`
- Test: `apps/customer/tests/ui-foundation.test.tsx`, existing `apps/customer/tests/auth.test.tsx`

**Interfaces:**
- `RoundButton({ icon, label, onPress })` exported from `@catera/mobile-ui` (same props as today).
- `AppHeader({ title, onBack, modal }: { title: string; onBack?: () => void; modal?: boolean })` — safe-area top padding, row with `RoundButton` (`chevron-back`, label `t("Kembali")` supplied by caller; `close` icon when `modal`) and `Text variant="heading" numberOfLines={1}`; canvas background, no bottom border.
- Layout usage: `header: ({ options, navigation, back }) => <AppHeader title={String(options.title ?? "")} onBack={back ? navigation.goBack : undefined} modal={options.presentation === "modal"} />`. Screens with `headerShown: false` are unchanged.

- [ ] **Step 1: Write failing tests** — in `ui-foundation.test.tsx`: `AppHeader shows one-line title and a back button` (renders title with `numberOfLines` 1; pressing button labelled "Kembali" calls `onBack`); `modal AppHeader shows a close button` (button labelled "Tutup"). In `auth.test.tsx` (login modal): assert `queryAllByText("Masuk ke Catera")` has length 0 and the screen's in-content heading is gone (header supplies "Masuk").
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `RoundButton` move, `AppHeader`, both layouts' `header` option, and delete the duplicate in-content title in `Masuk.tsx` (keep its explanatory paragraph).
- [ ] **Step 4: Verify** `npm test -w @catera/customer && npm test -w @catera/caterer && npm run typecheck` → PASS. Emulator: "Hari", "Bantuan dan laporan", Dapur "Pelanggan"/"Paket" show the round back button and Jakarta heading; long titles truncate on one line.
- [ ] **Step 5: Commit** `git commit -m "feat(native): shared round-button header for pushed screens"`

---

### Task 6: Jadwal coverage marks, legend and meal order

DESIGN.md:330 is the coverage model: covered days get the scheduled background; sun (lunch, sunrise) and moon (dinner, forest) icons are the coverage cue.

**Files:**
- Modify: `apps/customer/src/schedule/MonthGrid.tsx`, `apps/customer/src/schedule/Jadwal.tsx` (marks at ~19-31, legend ~97-99, `day` list ~60-62)
- Test: `apps/customer/tests/schedule.test.tsx`

**Interfaces:**
- `DayMark` becomes `{ lunch: boolean; dinner: boolean; done: boolean }` (`done` = every served meal delivered). `ARRIVED_DOT` export removed.
- MonthGrid cell: covered → background `#EDF1E6` (scheduled-bg); renders `Ionicons` `sunny` (12, `colors.sunrise`) when `lunch`, `moon` (11, `colors.forest`) when `dinner`; when `done`, icons use `colors.muted`; selected keeps the forest fill with cream icons; `accessibilityLabel` = `longDay(...)` + `", makan siang dan malam"` / `", makan siang"` / `", makan malam"` (+ `", sudah sampai"` when done).
- Legend items: sun "Makan siang" / "Lunch", moon "Makan malam" / "Dinner", muted icon "Sudah sampai" / "Arrived".
- `day` list sorted by `MEALS.indexOf(m.meal)` (lunch first), then by service window.

- [ ] **Step 1: Failing tests** in `schedule.test.tsx`:
  - `lists lunch before dinner on a day with both` — fixture day with dinner Salmon Teriyaki + lunch Ayam Panggang; the first row's text contains "Makan siang".
  - `labels a covered day with its meals` — `getByLabelText(/Jumat 9 Oktober, makan siang dan malam/)`.
  - `legend names lunch, dinner and arrived` — texts "Makan siang", "Makan malam", "Sudah sampai".
- [ ] **Step 2: Run** `npm test -w @catera/customer -- tests/schedule.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Verify** same command → PASS; emulator screenshot of Jadwal October.
- [ ] **Step 5: Commit** `git commit -m "feat(customer): Jadwal shows lunch and dinner coverage and orders meals"`

---

### Task 7: Change-day sheet date chips

**Files:**
- Modify: `apps/customer/src/schedule/ChangeDaySheet.tsx` (date branch of the `ScrollView` ~157-180, `OptionRow` stays for addresses)
- Test: `apps/customer/tests/schedule.test.tsx`

**Interfaces:**
- New local component `DateChips({ dates, selected, onSelect, reasons, today, locale })` — horizontal `ScrollView` of chips (min 64×56, radius 10). Bookable dates are tappable chips showing weekday short + day number (`shortDate`), selected chip forest/cream. Unavailable dates (full / already has delivery) render as dimmed, non-interactive chips with `accessibilityState={{ disabled: true }}` and the reason in their `accessibilityLabel`. Below the strip, once a date is chosen, show its long label (`dayLabel(date, today, locale)`); nothing before that.
- The 30-day window and `dates` filter stay as they are.

- [ ] **Step 1: Failing tests**:
  - `shows bookable dates as chips and picks one` — press chip labelled `/Senin 12 Okt/`; "Pilih tanggal" button becomes enabled.
  - `marks a full date as unavailable` — chip labelled `/Selasa 13 Okt, Katering penuh/` has `accessibilityState.disabled === true`.
  - `shows the empty message when no date is bookable` — availability `[]` → text "Belum ada tanggal yang tersedia dalam 30 hari ke depan."
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Verify** → PASS; emulator shot of the sheet.
- [ ] **Step 5: Commit** `git commit -m "feat(customer): pick a new delivery date from a chip strip"`

---

### Task 8: Package detail, buy screen and Jelajah fixes

**Files:**
- Modify: `packages/domain/src/checkout-eligibility.ts` (add `nextStartAfter`), `apps/customer/src/discover/PackageDetail.tsx:115-127`, `apps/customer/src/buy/useQuote.ts`, `apps/customer/src/buy/BuyScreen.tsx` (~213 footer, ~246 length, ~284 error), `apps/customer/src/discover/Jelajah.tsx:123-127,204`
- Test: `tests/checkout-sales-safeguards.test.ts` (or new `tests/next-start.test.ts`), `apps/customer/tests/discover.test.tsx`, `apps/customer/tests/buy.test.tsx`

**Interfaces:**
- `nextStartAfter(offer: Pick<Offer, "id" | "timezone" | "cutoff" | "weekdays">, subscriptions: readonly Pick<Subscription, "package_id" | "status" | "ends_on">[], now?: Date): { endsOn: string; start: string } | null` — takes the latest `ends_on` among `status === "active"` subscriptions with `package_id === offer.id`; scans from the next day up to 60 days for the first date where `purchaseStartAvailable(offer, d, now)`; `null` when there is no such subscription or no date. Exported via `@catera/domain`.
- `useQuote` also returns `errorCode: string` (the raw server code, `""` when none).
- PackageDetail: render `menuSummary(m, locale)` only when it differs from `menuSourceLabel(m, locale)`. Below the facts add "Cara kerja Catera" / "How Catera works" with three rows (icons `calendar-outline`, `card-outline`, `bicycle-outline`): "Pilih jadwal antar" / "Choose your delivery days", "Bayar sekali di depan" / "Pay once, upfront", "Diantar sesuai jadwal" / "Delivered on schedule". Rows fade in once on mount with Reanimated `FadeIn.duration(nativeMotion.content).delay(i * 80)`; no entering animation when `useReduced()`.
- BuyScreen:
  - When `quote.errorCode === "OVERLAP"` and `nextStartAfter(...)` is not null: replace the generic Retry with text `t(\`Paket ini masih berjalan sampai ${shortDate(endsOn)}.\`, …)` and a primary `Button` `t(\`Mulai ${shortDate(start)}\`, \`Start ${…}\`)` that sets the existing `start` state to `start`. Other errors keep `Retry` "Hitung ulang".
  - `lengths.length === 1` → plain `Text` with that label instead of `LengthOptions`.
  - Footer pay action: `Button variant="primary"` (forest) replaces `SunriseButton`.
- Jelajah: chips row becomes a horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`, `contentContainerStyle={{ gap: 8 }}`); remove `flexWrap`.

- [ ] **Step 1: Failing tests**
  - Vitest `nextStartAfter`: `returns the first bookable day after the active plan` (Mon–Fri offer, plan ends Thu 2026-10-15, now 2026-10-08 → `{ endsOn: "2026-10-15", start: "2026-10-16" }`); `skips non-operating days` (ends Fri 2026-10-16 → start Mon 2026-10-19); `nextStartAfter finds a start after a long active plan` (ends 2026-11-20 → start 2026-11-23, beyond the 21-day picker); `returns null without an active plan for this package`.
  - `discover.test.tsx`: `shows "Menu belum ditentukan" once` (`getAllByText("Menu belum ditentukan")` length 1); `explains how Catera works` (three step texts present).
  - `buy.test.tsx`: `offers the next start when the same package is still running` (quote rejects `{ code: "OVERLAP" }`, customer has active sub ending 2026-10-15 → button `/Mulai Jumat 16 Okt/`; pressing it re-quotes with `startDate: "2026-10-16"`); `shows a single length as text` (no `radio` roles); `Bayar is a forest primary button`.
- [ ] **Step 2: Run** `npx vitest run tests/next-start.test.ts` and `npm test -w @catera/customer -- tests/discover.test.tsx tests/buy.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Verify** same commands → PASS; `npm run typecheck`; emulator: buy "Ayam Panggang Harian" (has an active plan) → "Mulai …" button works.
- [ ] **Step 5: Commit** `git commit -m "feat(customer): next start for a running package, clearer package detail and filters"`

---

### Task 9: Trial follow-up on Beranda

The demo plan "Rantang Nusantara · 1 hari lagi" gets no prompt because `renewalDue` excludes trials (`packages/domain/src/customer-day.ts:234-238`). A trial ending should offer the full package.

**Files:**
- Modify: `packages/domain/src/customer-day.ts` (add `trialFollowUp`), `apps/customer/src/today/RenewalCard.tsx` (add `TrialCard`), `apps/customer/src/today/Beranda.tsx:~123`
- Test: `tests/customer-day.test.ts`, `apps/customer/tests/today.test.tsx`

**Interfaces:**
- `trialFollowUp(sub: Subscription, subscriptions: readonly Subscription[]): boolean` — `true` when `sub.status === "active"`, `sub.snapshot?.trial`, `sub.remaining <= 1`, and no other non-cancelled subscription with the same `package_id` has `starts_on > sub.starts_on`.
- `TrialCard({ subscription })` — `Card tone="attention"`: heading `t("Suka dengan ${name}?", "Enjoying ${name}?")`, body `t("Coba hari terakhir besok. Lanjutkan dengan paket penuh kapan saja.", …)` only if remaining is 1, primary `Button` `t("Lihat paket penuh", "See the full package")` → `router.push(\`/paket/${sub.package_id}\`)`.
- Beranda renders `TrialCard` for each `trialFollowUp` subscription next to the existing `RenewalCard`s.

- [ ] **Step 1: Failing tests** — Vitest: `trialFollowUp true for a trial with one day left`, `false once a full plan for the package exists`, `false for non-trial`. Jest `today.test.tsx`: `offers the full package when a trial is ending` (button "Lihat paket penuh" navigates to `/paket/<id>`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Verify** → PASS; emulator Beranda shows the card for Rantang Nusantara (or note in the review if the demo plan is not a trial and the copy path was verified by test only).
- [ ] **Step 5: Commit** `git commit -m "feat(customer): invite trial customers to the full package"`

---

### Task 10: Dapur Hari ini — date header, one switch, session cards

**Files:**
- Modify: `apps/caterer/src/today/TodayScreen.tsx` (main body ~45-122, `Masak` ~124-138, `Antar` ~211-310)
- Create: `apps/caterer/src/today/SessionCard.tsx`
- Test: `apps/caterer/tests/today.test.tsx`

**Interfaces:**
- Screen top: `Text variant="title"` = `shortDate(date, locale)` (e.g. "Kamis 8 Okt"), then the existing Hari ini/Besok `Segmented` wrapped in `FadeSwap swapKey={offset}` for the content below. The Masak/Antar `Segmented` and the Siang/Malam `Segmented` are removed.
- `SessionCard({ ops, meal, date, report, caterer }: { ops: SellerOperationsState; meal: KitchenMeal; date: string; report: "today" | "tomorrow" | null; caterer: string })` — one card per meal with `cookingRecap(ops, meal).total > 0` or `deliveryRoute(ops, meal).length > 0`, lunch first. Header: meal label + porsi total (`Text variant="number"`). Body: the existing recap rows and Bagikan/Cetak actions (moved from `RecapCard`), then an "Antar · N" section containing the existing sage note, stop list, `ExceptionSheet` reporting and "Bagikan rute ke WhatsApp" (moved from `Antar`). Phase 2 adds the cook/depart actions to this card's header.
- Empty state (no session cards and not `newKitchen`): `Card tone="sage"` with `t("Tidak ada masakan untuk hari ini.", "Nothing to cook today.")` and caption `t("Pesanan baru akan muncul di sini.", "New orders will appear here.")` (Besok uses "besok").
- Reports (`ReportCards`, `ActionCards`) stay above the session cards on Hari ini.

- [ ] **Step 1: Failing tests** in `today.test.tsx`:
  - `shows the date as the title` — `getByText("Kamis 8 Okt")` with the fixture date.
  - `has a single day switch` — exactly one `tablist`.
  - `shows one card per meal session with its delivery list` — lunch fixture: texts "Makan siang", "1 porsi", "Nadia Putri", "Bagikan rute ke WhatsApp" all present without any tab press.
  - `shows a calm empty state` — no deliveries → "Tidak ada masakan untuk hari ini."
  Update existing tests that pressed the removed "Antar"/"Siang" tabs.
- [ ] **Step 2: Run** `npm test -w @catera/caterer -- tests/today.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per Interfaces (move code; do not change `deliveryRoute`, `routeShareText`, `ExceptionSheet` behavior).
- [ ] **Step 4: Verify** `npm test -w @catera/caterer && npm run typecheck` → PASS; emulator Hari ini + Besok screenshots.
- [ ] **Step 5: Commit** `git commit -m "feat(dapur): Hari ini shows the date and one card per meal session"`

---

### Task 11: Dapur Menu, Usaha and Pelanggan fixes

**Files:**
- Modify: `apps/caterer/src/menu/MenuWeek.tsx` (~151-157, ~184-198), `apps/caterer/src/business/UsahaScreen.tsx` (~10-24, ~47-55), `apps/caterer/src/customers/CustomerList.tsx:19-20`
- Test: `apps/caterer/tests/menu.test.tsx`, `apps/caterer/tests/business.test.tsx`, `apps/caterer/tests/customers.test.tsx`

**Interfaces:**
- MenuWeek: card heading `shortDate(d.date, locale)`; when the day has no items and `d.date < jakartaDay(new Date())`, show caption `t("Lewat", "Past")` in muted instead of the orange "Belum diisi"; week buttons become `RoundButton` with `chevron-back`/`chevron-forward` (48dp) keeping their accessibility labels; package chips row becomes a horizontal `ScrollView`.
- Usaha `Row` gains optional `image?: string`; package rows pass `o.image` and render a 40×40 radius-8 `Image` (`source={{ uri: o.image }}`, matching `business/PackageDetail.tsx:19`) instead of the icon when present.
- CustomerList: "Aktif" counts and shows every customer whose status is not `"ended"` (active ∪ ending); "Segera berakhir" stays the ending subset; "Selesai" unchanged. Each Aktif row whose status is `"ending"` keeps its existing end label.

- [ ] **Step 1: Failing tests**
  - `menu.test.tsx`: `shows localized dates` (`getByText("Senin 5 Okt")`, `queryByText("2026-10-05")` null); `does not ask to fill past days` (past empty day shows "Lewat", no "Belum diisi" for it).
  - `business.test.tsx`: `shows the package photo` (image with uri of fixture offer image).
  - `customers.test.tsx`: `counts ending customers as active` (one customer with remaining 1 → chips "Aktif · 1", "Segera berakhir · 1").
- [ ] **Step 2: Run** `npm test -w @catera/caterer -- tests/menu.test.tsx tests/business.test.tsx tests/customers.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Verify** → PASS; emulator Menu, Usaha, Pelanggan screenshots.
- [ ] **Step 5: Commit** `git commit -m "fix(dapur): readable menu dates, package photos, ending customers count as active"`

---

### Task 12: DESIGN.md amendments and Phase 1 acceptance

**Files:**
- Modify: `DESIGN.md` (Typography ~203-225; add "Native motion" after the web motion paragraph ~348-352)
- Create: `output/native-review/p1/README.md` (screenshot index; images alongside)

- [ ] **Step 1: Update DESIGN.md**
  - Typography: native registers five static TTFs (`Jakarta`, `Jakarta-Medium`, `Jakarta-SemiBold`, `Jakarta-Bold`, `Jakarta-ExtraBold`) via `fontAssets`; weights map through `fontFor`; the native ramp table is now what `mobile-ui` ships (remove the "do not claim parity" caveat only for the variants listed in Task 3).
  - New "Native motion" subsection: tokens `nativeMotion` (120/180/220/320, same ease, press spring damping 18 stiffness 260); press feedback scale 0.97 + haptic on buttons, chips, segments; choreographed motion only at story beats (Phase 2/3); no list staggers; navigation, operational rows and money totals stay still; reduced motion → opacity-only or instant; transforms and opacity only.
- [ ] **Step 2: Full verification**

Run, in order, and require all to pass:
```bash
npm run typecheck
npm test
npm test -w @catera/customer
npm test -w @catera/caterer
npm run build
```

- [ ] **Step 3: Emulator acceptance (demo mode)** — `CATERA_V1_DEMO=true npm run dev`; Metro `npx expo start --go --port 8090` (customer) and `--port 8091` (caterer) with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`; open with `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:<port> host.exp.exponent`. Capture every screen from the spec's live pass into `output/native-review/p1/` and check: bold text is Jakarta; no clipped/wrapped titles at the new ramp; no `Require cycle` in Metro; press feedback visible; with Developer options → "Remove animations" and `adb shell settings put global animator_duration_scale 0`, nothing scales or slides. Reset animator scale to 1 afterwards. List findings and screenshot names in `output/native-review/p1/README.md`.
- [ ] **Step 4: Commit**

```bash
git add DESIGN.md output/native-review/p1
git commit -m "docs(design): native typography and motion contract for Phase 1"
```
