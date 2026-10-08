# antislop Audit 001 Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 29 findings of `anti-slop/audit-001-2026-10-08.md` in the Catera native apps and revise DESIGN.md where antislop overrides it.

**Architecture:** Shared fixes land first in `packages/mobile-ui` / `packages/design-tokens` (Task 1), then customer-app fixes (Tasks 2–3), Dapur fixes (Tasks 4–5), then DESIGN.md + click-through evidence + follow-up report (Task 6). Each finding's evidence and suggested fix are in the audit file; this plan records the decisions the audit left open.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router, Reanimated 4.5.1, expo-haptics, Jest (jest-expo/android + RNTL), root Vitest.

**Spec:** `anti-slop/audit-001-2026-10-08.md` (each finding = one requirement, by number). Owner decision (2026-10-08): "Fix everything, trust the antislop and revise the DESIGN.md where needed" — every "direction conflict: owner decides" finding (#12, #13, #20) resolves in favour of the antislop rule, and DESIGN.md is changed to match.

## Global Constraints

- Palette: forest #163D2E, sunrise #F47B2A (accent only), sunriseInk #9B4309, cream #FFF7E9, scheduled #EDF1E6, muted #60675F. New tokens: `fieldBorder: "#CFD3C6"`, `secondaryBorder: "#CDD4C4"`.
- Native type ramp: Title 30/39, Heading 21/28, Body 14/23, Small 11/18, Label 12/23. Never write `fontWeight` in app sources (use `fonts`/`fontFor` from @catera/mobile-ui); guard test enforces it.
- Touch targets ≥ 48dp (DESIGN.md). Text contrast ≥ 4.5:1; non-text state icons ≥ 3:1.
- No em dash (U+2014) in any user-visible string. Indonesian-first copy via `t(id, en)`; never promise what the server does not know.
- Motion: transform/opacity only; reduced motion → opacity-only or instant; no list staggers.
- Every data screen has loading, error (message in `colors.danger` + "Coba lagi"), and empty states.
- Native only; do not change apps/web runtime code. Expo Go 57 must keep running both apps.
- Commit on branch `v2`; never stage `apps/web/tsconfig.json`.

## Review Focus

1. Demo strip must not cover content or the header on any screen, including modals and sheets; pinned by Task 1 test `renders the demo strip only in demo mode` plus emulator shots.
2. `Screen` width cap must not shift phone layouts (cap only applies above 760); pinned by Task 1 test `caps the body at 760`.
3. Price label for a single-meal offer must not gain "2 kali makan / hari"; pinned by Task 2 test `single-meal offer shows only / sekali makan`.
4. Dapur "Menu belum diisi" line must not appear when every slot has a dish; pinned by Task 5 test `no unfilled line when the menu is complete`.
5. Attention cards whose `href` cannot be resolved by `dapurLink` must stay non-pressable rather than becoming dead buttons; pinned by Task 5 test `unknown attention href stays plain`.

---

### Task 1: Shared foundation (audit #1, #5, #11, #14, #17 shared, #18, #23 shared, #28 tokens)

**Files:**
- Modify: `packages/design-tokens/src/index.ts`, `packages/mobile-ui/src/components.tsx`, `packages/mobile-ui/src/index.ts`, `apps/customer/app/_layout.tsx`, `apps/caterer/app/_layout.tsx`, callers of `Sheet` and `Stepper` in both apps (grep)
- Create: `packages/mobile-ui/src/DemoStrip.tsx`, `packages/mobile-ui/src/PressableRow.tsx`
- Test: `apps/customer/tests/ui-foundation.test.tsx`, `apps/caterer/tests/layout.test.tsx`

**Interfaces (Produces):**
- `colors.fieldBorder = "#CFD3C6"`, `colors.secondaryBorder = "#CDD4C4"`; every literal of those hexes in `packages/mobile-ui/src` uses the tokens.
- `DemoStrip({ label }: { label: string })` — full-width strip, background `colors.sage`, text `Text variant="caption"` in `colors.forest`, height ≥ 24, placed directly under the status-bar safe area and above the Stack (so it pushes content down rather than overlaying it), `accessibilityRole="text"`. Both layouts render `{demo ? <DemoStrip label={t("Demo · data sintetis", "Demo · synthetic data")} /> : null}` using `useMobile().demo` (the `me` endpoint reports `demo` even when signed out). AppHeader / Screen must not add a second top inset when the strip is present (strip owns the inset; pass that down or let the strip sit inside the safe area — implementer's choice, emulator-verified).
- `Chip` and `Segmented` segment `minHeight: 48`. Text `Button` variant `minHeight: 48`. Stepper buttons 48×48.
- `Text` accepts and forwards `accessibilityRole`, `accessibilityLabel`, `accessible`; variants `title` and `heading` default to `accessibilityRole="header"` (caller may override).
- `Sheet` gets required prop `closeLabel: string` (scrim gets `accessibilityRole="button"` + that label) and `animationType={useReduced() ? "fade" : "slide"}`.
- `Stepper` gets required props `decreaseLabel: string`, `increaseLabel: string`; its buttons use `PressableScale` (haptic "select").
- `PressableRow(props: PressableProps & { style?: StyleProp<ViewStyle> })` — for full-width tappable rows: no scale, pressed opacity 0.7 (instant), `android_ripple` none, haptic none; passes accessibility props through. Exported for Tasks 3 and 5.
- `Screen`: body centered with `maxWidth: 760, width: "100%", alignSelf: "center"` (footer too); keyboard avoidance via `KeyboardAvoidingView` (`behavior="padding"` on iOS) wrapping the scroll + footer, and `keyboardShouldPersistTaps="handled"` on the ScrollView.

- [ ] **Step 1: Failing tests** in `ui-foundation.test.tsx`: `renders the demo strip only in demo mode` (render DemoStrip conditionally via a tiny harness or the customer layout's Navigation with mocked `useMobile`); `chips and segments are 48dp`; `title and heading are headers` (`getByRole("header", { name: "Jadwal" })`); `Sheet scrim is a labelled button and fades under reduced motion` (mock useReducedMotion true → Modal `animationType` "fade"); `Stepper labels come from props`; `PressableRow dims when pressed and does not scale`; `caps the body at 760` (flattened style of Screen body has maxWidth 760). Caterer `layout.test.tsx`: demo strip shows when `me.demo` is true.
- [ ] **Step 2: Run** `npm test -w @catera/customer -- tests/ui-foundation.test.tsx` and `npm test -w @catera/caterer -- tests/layout.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per Interfaces; update every `Sheet` and `Stepper` caller in both apps to pass `t()` labels (`t("Tutup","Close")`, `t(\`Kurangi ${label}\`, \`Decrease ${label}\`)`, `t(\`Tambah ${label}\`, \`Increase ${label}\`)`).
- [ ] **Step 4: Verify** full customer + caterer jest, root vitest, typecheck → PASS. Emulator: demo strip visible on Jelajah (signed out), Beranda, a pushed screen, a sheet, Dapur Hari ini; nothing covered. Shots → `output/native-review/audit-001/t1/`.
- [ ] **Step 5: Commit** `feat(native): demo strip, 48dp chips, accessible headings, keyboard-safe capped screens`

---

### Task 2: Customer honesty and content (audit #2, #10, #20, #22, #24, #25)

**Files:**
- Modify: `apps/customer/src/discover/PackageCard.tsx`, `discover/PackageDetail.tsx`, `today/EmptyHome.tsx`, `buy/BuyParts.tsx`, `today/UpcomingRows.tsx`, `account/Register.tsx`, `account/Recover.tsx`; domain helper in `packages/domain/src/package-presentation.ts` (or nearest existing presentation module)
- Test: `apps/customer/tests/discover.test.tsx`, `today.test.tsx`, `account.test.tsx` (or the suite that renders Register/Recover), `buy.test.tsx`, `tests/` vitest for the domain helper

**Interfaces:**
- Domain `priceUnitLabel(offer: Pick<Offer, "meal">, locale: Locale): { unit: string; note: string | null }` → unit `"/ sekali makan"` (en `"/ meal"`); note `"2 kali makan / hari"` (en `"2 meals / day"`) only when `offer.meal === "both"`, else `null`.
- #2: PackageCard price shows `{currency(perMealPrice)} {unit}` and, when present, the note as caption; PackageDetail footer label "Per sekali makan" / "Per meal" (+ note); EmptyHome cards show the same per-meal price + unit instead of the full price "per hari".
- #10: EmptyHome: while the catalog read is pending show `Text` "Memuat paket…" / "Loading packages…"; on error show the message in `colors.danger` + `Button variant="text"` "Coba lagi" calling reload; "Jelajah paket" button stays.
- #20: Remove the "Cara kerja Catera" section and its stagger entirely. Add a fact row to the existing facts block: label "Mulai paling cepat" / "Earliest start", value `shortDate(first bookable start, locale)` computed with `purchaseStartAvailable` over the next 21 days (move BuyScreen's local `startDates` into the domain as `startDates(offer, now, count)` and reuse it in both places); hide the row when none is bookable.
- #22: BuyParts card title "Pembayaran lewat {provider}" when the provider name is known from the pay availability data, else drop the title and keep only "Pilih cara bayar di halaman berikutnya." — no "aman" claim.
- #24: Each UpcomingRows row: title stays the day label; add a second line `${packageName} · ${mealLabel(meal)}`; when no dishes are set show "Menu belum ditentukan" instead of an empty line. Extend `upcomingRows` in `packages/domain/src/customer-day.ts` with `packageName` and `meal` if missing.
- #25: Register and Recover: remove the in-content title that duplicates the AppHeader; keep one mode-specific heading only if it says something the header does not (e.g. keep "Daftar dengan email" only if header is "Daftar"? — rule: header title stays; in-content `title` removed; any distinct guidance becomes body text).

- [ ] **Step 1: Failing tests:** vitest `priceUnitLabel` (both → note; lunch → null) and `startDates` (moved, same results as before); discover `single-meal offer shows only / sekali makan`, `combined offer shows 2 kali makan / hari`, `package detail shows earliest start and no Cara kerja`; today `EmptyHome shows loading then error with Coba lagi`, `upcoming rows name the package and meal`, `empty upcoming row says Menu belum ditentukan`; buy `payment card makes no security claim` (`queryByText(/aman/)` null); account `Register shows a single heading`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Verify** suites + typecheck; emulator shots of Jelajah card, package detail, Beranda (signed-in rows, signed-out EmptyHome), Buy pay card → `output/native-review/audit-001/t2/`.
- [ ] **Step 5: Commit** `fix(customer): honest per-meal prices, package facts, clearer rows and states`

---

### Task 3: Customer interaction and visual (audit #12, #13, #17 customer, #19 customer tabs, #23 customer, #28 customer)

**Files:**
- Modify: `apps/customer/src/today/Beranda.tsx` (stars), `today/Plate.tsx` (SunriseButton, reactions), `discover/FilterChip.tsx`, `schedule/Jadwal.tsx` (month arrows, legend), `schedule/MonthGrid.tsx`, `claim/ClaimScreen.tsx` (back), `discover/Jelajah.tsx` (area control), `help/ReportList.tsx`, rows (`today/UpcomingRows.tsx`, `today/MenuDueRows.tsx`, Jadwal `MealRow`, `discover/PackageCard.tsx`, `today/EmptyHome.tsx` cards), `schedule/ChangeDaySheet.tsx` (hexes), `apps/customer/app/(tabs)/_layout.tsx`
- Test: `today.test.tsx`, `schedule.test.tsx`, `discover.test.tsx`, `shell.test.tsx` (tabs)

**Interfaces / decisions:**
- #12: unselected review star = Ionicons `star-outline` in `colors.muted`; selected = `star` in `colors.sunriseInk`; each star `accessibilityRole="radio"` (or button) with `accessibilityState={{ selected }}`; 48×48.
- #13: Sun coverage icon, its legend icon and the today ring use `colors.sunriseInk` (not `colors.sunrise`).
- #17: button-like controls (SunriseButton, FilterChip, Plate reactions, Beranda stars, Jadwal month arrows, Claim back) go through `PressableScale` (haptic "tap", "select" for chips/stars/reactions); tappable rows and MonthGrid cells use `PressableRow` (cells may keep their own selected styling).
- #19: Customer tab bar uses outline icons when inactive and filled when focused (`tabBarIcon: ({ focused }) => …`); content icons stay outline.
- #23: all listed customer 44dp controls → 48 (Claim back reuses `RoundButton`).
- #28: ChangeDaySheet `#B9BFB0` → `colors.fieldBorder`; any other literal palette hexes in customer sources → tokens.

- [ ] **Step 1: Failing tests:** `unselected star is outlined and muted`; `sun icon and legend use sunriseInk`; `month arrows give haptic feedback`; `tab icons are outline until focused`; `upcoming row dims on press`.
- [ ] **Step 2–4:** RED → implement → full customer jest + typecheck; emulator shots of Beranda review prompt, Jadwal, tabs → `output/native-review/audit-001/t3/`.
- [ ] **Step 5: Commit** `fix(customer): readable stars and sun marks, press feedback everywhere, 48dp targets`

---

### Task 4: Dapur states and copy (audit #3, #6, #7, #8, #9, #15, #21, #26)

**Files:**
- Modify: `packages/domain/src/kitchen.ts:188` (+ `tests/kitchen.test.ts:244`), `apps/caterer/src/import/ImportAssistant.tsx:232`, `customers/CustomerList.tsx`, `menu/MenuWeek.tsx`, `business/UsahaScreen.tsx`, `today/TodayScreen.tsx` (error line, MulaiCard copy :194), `business/UangScreen.tsx`, `business/AktifkanScreen.tsx`, `customers/CustomerDetail.tsx`, `apps/caterer/app/_layout.tsx` (font error)
- Test: caterer `customers.test.tsx`, `menu.test.tsx`, `business.test.tsx`, `today.test.tsx`, `layout.test.tsx`, `import.test.tsx`; root `tests/kitchen.test.ts`

**Interfaces / decisions:**
- #3: menu share header `Menu ${caterer} · ${package}`; ImportAssistant row placeholders "Paket belum dipilih" / "Package not chosen" and "sisa hari belum diisi" / "days left not set" instead of "—" and "?".
- #6/#7/#8: shared pattern in each Dapur data screen: pending → `Text` "Memuat…" / "Loading…" (Pelanggan: "Memuat pelanggan…"; chips hidden until data); error → message in `colors.danger` + `Button variant="text"` "Coba lagi" / "Try again" calling the read's `reload()`. Menu: "Salin minggu lalu" and "Bagikan menu" disabled until the week's data is loaded. Usaha: Paket card shows loading/error instead of an empty list.
- #9: Dapur layout mirrors the customer font-error fallback ("Font tidak dapat dimuat. Mulai ulang aplikasi." / en equivalent via plain strings since i18n is not ready before fonts — copy the customer approach exactly).
- #15: MulaiCard copy drops "sekitar 3 menit" (keep "Satu layar").
- #21: Usaha card button label "Aktifkan pembayaran" / "Turn on payments".
- #26: "Bagikan menu" disabled when no day of the visible week has items; caption "Belum ada menu untuk dibagikan" / "No menu to share yet" under it.

- [ ] **Step 1: Failing tests** for each item (names: `menu share header has no em dash`, `import row names a missing package`, `Pelanggan shows loading, hides counts`, `Pelanggan error offers Coba lagi`, `Menu actions wait for data`, `Usaha shows loading and error`, `Today error offers Coba lagi`, `Dapur shows a font error message`, `new kitchen card makes no time claim`, `payments card names the action`, `Bagikan menu disabled when nothing to share`).
- [ ] **Step 2–4:** RED → implement → caterer jest + root vitest + typecheck; emulator shots → `output/native-review/audit-001/t4/`.
- [ ] **Step 5: Commit** `fix(dapur): loading and retry states, honest copy, no em dashes`

---

### Task 5: Dapur kitchen truth and interaction (audit #4, #17 Dapur, #19 Dapur tabs, #23 Dapur, #25 Dapur, #27, #28 Dapur)

**Files:**
- Modify: `packages/domain/src/kitchen.ts` (cooking recap fallback rows ~99-101), `apps/caterer/src/today/SessionCard.tsx`, `today/TodayScreen.tsx` (ActionCards ~173-189), `business/UsahaScreen.tsx` (Row), `customers/CustomerList.tsx` (rows, chat 44→48), `menu/MenuWeek.tsx` (day cards), `menu/SlotEditor.tsx` (44→48), `menu/MenuDayScreen.tsx:69`, `auth/Masuk.tsx`, `auth/Daftar.tsx`, `apps/caterer/app/(tabs)/_layout.tsx`
- Test: root `tests/kitchen.test.ts`; caterer `today.test.tsx`, `menu.test.tsx`, `customers.test.tsx`, `business.test.tsx`, `core.test.tsx` or `layout.test.tsx` (tabs, auth)

**Interfaces / decisions:**
- #4: `cookingRecap` separates real dishes from unfilled slots: add `unfilled: { group: string; portions: number }[]` (category name + portions) and stop emitting category fallback rows into the dish list. SessionCard renders, below "Yang dimasak", `Menu belum diisi: 2 lauk, 1 nasi, 1 sayur` (lower-case group names, joined with ", ") in `colors.sunriseInk`, plus `Button variant="text"` "Isi menu" / "Fill in menu" that navigates to `/menu/${date}?pkg=${packageId}&meal=${meal}` for the first unfilled package (owner role only; staff sees the line without the button). No line when nothing is unfilled.
- #17/#23: Dapur tappable rows (Usaha Row, CustomerList rows, MenuWeek day cards) use `PressableRow`; CustomerList chat and SlotEditor controls 48dp via `PressableScale`/`RoundButton`.
- #19: Dapur tab bar outline when inactive, filled when focused (same rule as customer).
- #25: MenuDayScreen removes the 30px ISO date title (header already says "Menu 8 Okt").
- #27: ActionCards: each card whose `item.href` resolves through `dapurLink` becomes a `PressableRow` with `accessibilityRole="link"` that opens it; unresolvable hrefs stay plain cards.
- #28: Masuk/Daftar literal hexes → `colors.*` tokens.

- [ ] **Step 1: Failing tests:** kitchen vitest `unfilled slots are reported separately` + `no unfilled line when the menu is complete` (Jest SessionCard); `Isi menu opens the day editor`; `attention card opens its link`; `unknown attention href stays plain`; `MenuDayScreen has one heading`; `Dapur tab icons outline until focused`; `chat button is 48dp`.
- [ ] **Step 2–4:** RED → implement → caterer jest + root vitest + typecheck; emulator Besok session card (unfilled line), Hari ini attention card, Menu day → `output/native-review/audit-001/t5/`.
- [ ] **Step 5: Commit** `fix(dapur): name unfilled menus, tappable attention cards, press feedback, 48dp`

---

### Task 6: DESIGN.md revision, click-through evidence and follow-up report (audit #13, #16, #19, #20, #29 + doc sync)

**Files:**
- Modify: `DESIGN.md`
- Create: `anti-slop/audit-001-followup-2026-10-08.md`
- Local (gitignored): `output/native-review/audit-001/README.md`

**Decisions:**
- DESIGN.md: (a) #13 coverage cue = sun icon in sunriseInk (contrast reason), today ring sunriseInk; (b) #19 one line: "Icons: Ionicons via @expo/vector-icons; outline by default, filled only for the focused tab"; (c) #20 remove the "Cara kerja" sanctioned-stagger exception and the stagger; package detail states facts (earliest start, change cutoff, delivery); (d) #29 dial lines `Dial (customer): ENERGY 2 / RHYTHM 2 / MOTION 2` and `Dial (Dapur): ENERGY 1 / RHYTHM 1 / MOTION 1 (+ press micro-feedback)` with one-line reasons; (e) tokens `fieldBorder`/`secondaryBorder` now tokenised; (f) native demo strip ("Demo · data sintetis") satisfies the labelled-demo rule; (g) per-meal price unit rule "/ sekali makan" (+ "2 kali makan / hari" for combined offers); (h) every data screen: loading / error + "Coba lagi" / empty; (i) chips/segments/text buttons 48dp; headings exposed as headers. Keep web sections unchanged except where a shared rule (price unit, demo label) is stated once for both.
- #16: run an element-by-element click-through on the emulator for both apps (customer: Jelajah filters, area sheet, heart save, card → detail, Pilih jadwal, Coba 1 hari, Buy start sheet/address sheet/Mulai, Jadwal arrows/day/Ubah hari sheet modes, review stars, Akun rows, language switch, login modal close; Dapur: Hari ini/Besok, Bagikan, Cetak, map, ellipsis/report sheet, Bagikan rute, attention cards, Isi menu, Menu week arrows, package chips, Salin minggu lalu, Bagikan menu, day card → editor, Pelanggan filters/chat/row, Usaha rows, + Paket baru). Never press Bayar, confirm a date move, submit a report or share to a real contact (cancel the share sheet). Record `element → result` rows in the local README and summarize in the follow-up report.
- Follow-up report: per finding number → status (fixed / fixed with deviation / not fixed + why), commit, evidence (test name or screenshot); then a re-run of the antislop Delivery Gate (Blocks 1–4) with PASS/FAIL + evidence; no em dashes.

- [ ] **Step 1:** Edit DESIGN.md per decisions (a)–(i); verify each sentence against code.
- [ ] **Step 2:** Run `npm run typecheck`, `npm test`, `npm test -w @catera/customer`, `npm test -w @catera/caterer`, `npm run build` → all PASS (record counts).
- [ ] **Step 3:** Emulator click-through + shots → local README.
- [ ] **Step 4:** Write `anti-slop/audit-001-followup-2026-10-08.md`.
- [ ] **Step 5: Commit** `docs(design): antislop audit 001 revisions` (DESIGN.md + both anti-slop files).
