# Catera native apps, Phase G: owner feedback, a restrained palette, calmer motion and delivery confirmed by the customer

**Date:** 2026-10-13 · **Branch:** `v2` (main tree `D:\Project\Catera\catera`, starting at `f5069ba2`) · **Status:** owner picks recorded; awaiting written-spec review
**Scope:** `apps/customer`, `apps/caterer` (Catera Dapur), `packages/mobile-ui`, `packages/mobile-core`, `packages/design-tokens`, `packages/domain`, `packages/backend` (demo and SQL), `supabase/migrations`, `apps/web` (the delivered button, push dispatch, motion tokens, the terms page), `tests`.
**Inputs:** [Phase G kickoff](../kickoff/phase-g.md) (FB1 to FB11, D1 to D7, E1 to E5, G1 to G18), [ledger](../../../.superpowers/sdd/2026-10-12-native-phase-g/progress.md), [audit 009](../../../anti-slop/audit-009-2026-10-12.md), the design canvas `output/native-review/phase-g/canvas/index.html` (published Artifact `5tEjpNnNsTZEEAZHBh6VNh`), the owner's picks (15 JSON files, listed in section 1), palette files `output/native-review/phase-g/palette/` (`directions-v2.json`, `directions-v2.md`, `mobbin-colour-restraint.md`, `mobbin-brand-research.md`), `output/native-review/phase-g/motion/relaxed-motion.md`, the research [Phase G Mobbin](../research/2026-10-12-native-phase-g-mobbin.md) and the two copy audits ([customer](../research/2026-10-12-copy-audit-customer.md), [Dapur](../research/2026-10-12-copy-audit-dapur.md)). The canvas is a reference, not a pixel contract; this spec wins where they differ.

**Skills applied while writing this spec:** `building-native-ui`, `antislop` (core, ui, layoutmobile, human; mode "after (session override)", the question was not asked), `apple-design` (iOS), `design-taste-frontend` (general rules only: its section 13 scopes native mobile out), `impeccable` (context step run with `--target Phase G native spec`), `humanizer`, `antislop-copywriting`. **`material-3` is not installed** on this machine; Android judgements follow the Material 3 notes already in DESIGN.md and are checked on the emulator.

## 1. Why, and what the owner decided

On October 12, 2026 the owner ran the customer app on their phone and gave eleven pieces of feedback (FB1 to FB11). Audit 009 then measured the colour pairings (all 24 marked wrong), the canvas showed the designs, and on October 13 the owner picked. Everything below is binding unless a later section says it is open.

### 1.1 Decisions that stand from the kickoff
D2 (auto-confirm 2 hours after `arrived_at`, a proof photo per stop, the web "delivered" button waits for the customer), D3 (no loop; the rantang rides the line), D4 (selection only, no rounds), D5 (Dapur's public details change by request), D6 (busy spinner after 150 ms), D7 (push at the event with a backstop), E1 (the Ada masalah swipe keeps a draft), E2 (placeholder terms page until the owner supplies text), E3 (Masuk centred), E4 (an address in use cannot be deleted), E5 (the renewal line tells the truth). Not reopened here.

### 1.2 Decisions made on October 13, 2026
| Item | Decision |
| --- | --- |
| Palette (FB2) | **Direction K**, "Today's palette, used with restraint" (section 2). The owner reopened the palette on October 13, rejected A to C, asked for more directions (D to J), then asked for colour to be spent the way top apps spend it. Hues are unchanged. |
| Motion pace | **Even slower** (section 3). |
| G1(d), customer Ada masalah TalkBack | Native sheets stay. Fix the focus timing (section 4.1). |
| G1(e), Dapur `impor-baris` delete | No confirm. Deleting a row shows an "Urungkan" toast (section 4.3). |
| Crash | Dapur `MascotReading.tsx:141` transform origin (section 4.4). |
| OTP check (FB1) | **Busy button** on the code screen. The mascot screen stays for requests that run long (section 5.1). |
| Proof photos for several stops (FB3, FB11) | **Grid of stop tiles**, one camera button per tile, the action waits for every photo (section 5.9). |
| Hapus akun with a running plan (FB5) | The request goes through. The Catera team settles the running plan first (section 5.10). |
| Copy | See the table in section 6. |
| Renewal line (E5) | "Mulai Selasa 10 Nov. Paket ini masih berjalan sampai Senin 9 Nov." Only the same package blocks overlapping dates and portions are fixed per plan (PRODUCT.md lines 55 and 56). |
| Parked for Phase H | A paid "tambah porsi" top-up for a running plan. Portions stay fixed per plan today. |

The picks live as JSON in `scratchpad/picks/picks/` of the design session (`pick-fb1-otp`, `pick-fb11-photo-flow`, `pick-fb5-delete-running-plan`, `pick-motion-pace`, `pick-copy-*` ten files); `pick-fb2-direction` = K was set from chat. Three picks went against the canvas recommendation and are kept as the owner chose: "pengantaran", "Ditandai sampai otomatis" and "1 sampai 2 hari kerja".

### 1.3 The palette override
AGENTS.md says "preserve the latest approved palette". The owner reopened the palette on October 13, 2026, and that overrides the sentence for how the hues are used. The hues themselves (Forest `#163D2E`, Sunrise `#F47B2A`, Sunrise ink `#9B4309`, Cream `#FFF7E9`, Charcoal `#2E2E2E`) are unchanged, so the artwork needs no recolour. DESIGN.md records this in a new section "Colour revision (Phase G), October 2026" that supersedes the mood table and the `nativeThemes` values named in section 2. AGENTS.md is the owner's file: this spec does not edit it (see section 14).

### 1.4 Contradictions found in the sources, and how they close
| Contradiction | Closure |
| --- | --- |
| The kickoff still says customer copy is "Anda" (lines 43, 144, 266) | The G18 decision of October 12 stands: both apps say "kamu". The kickoff lines are superseded. |
| G13 and the kickoff write "pengiriman"; DESIGN.md and the apps write "antaran" | The owner chose "pengantaran" as the one noun for a delivery. "Pengiriman" is never used. See section 6. |
| No mood token existed for a warning (the canvas drew Gagal diantar in hero ink) | K defines `heroWarn`: `#A33024` light, `#FF8F80` dark, always with an icon and words. |
| The mascot success disc reads the light Siang header (`nativeArt.successDisc`), and K changes that header | `successDisc` is pinned to `#FFEFD9` as a literal. |

## 2. Palette: direction K

### 2.1 The rule set
K follows the seven rules in `mobbin-colour-restraint.md` (30 Mobbin iOS screens; the median screen spends about 2 percent of its area on the brand colour, structural screens 0 to 4, checkouts 4 to 13, and only four screens reach 15 percent or more, each a single deliberate moment).

1. **Neutral ground and bars.** The page, header and tab bar are cream and neutral steps (charcoal steps in dark). Forest and Sunrise never fill a surface behind content.
2. **One filled brand control per screen.** Forest fills only the primary button (the hero button, `StickyAction`, a sheet's main action). Secondary actions are outlined or text.
3. **Selection is a small mark.** Forest marks the active tab (icon and label), the selected segment (ring and label), the chosen date and the today ring. A saved heart is a selection, so it is forest too (a reading of rule 3 in this spec, see section 14).
4. **The tracker is ink.** The line and done stops use the hero ink. Sunrise (Sunrise ink in light) marks the **current stop only**.
5. **Personality comes from photos and the mascot.** The meal photo leads the meal card.
6. **One branded moment per screen.** It is Paket selesai and the payment confirmation: the mascot on the `#FFEFD9` success disc above the one forest button. Nothing else on a screen paints a coloured block.
7. **Prices and warnings use their own language.** A price is bold charcoal. A warning is `heroWarn` (or `danger` off the hero) with an icon and words, never the brand accent.

Siang and Malam stay. Each is a faint header tint plus the sun or moon mark (the day arc and the toggle keep their glyphs), nothing more. The Malam pattern is dropped (K sets `pattern: null`); `MalamPattern` is deleted once no caller is left.

### 2.2 Theme tokens (`nativeThemes`)
Only the keys K changes. Every other key (`sunrise`, `sunriseInk`, `danger`, `fieldBorder`, `secondaryBorder`, `attentionBorder`, `scheduled`, `controlRing`, `disabledFill`, `tabIndicator`, the three toast keys) keeps today's value.

| Key | Light | Dark | Was (light / dark) |
| --- | --- | --- | --- |
| canvas | `#E4DED1` | `#151514` | `#FDFAF3` / `#151514` |
| surface | `#FFFEFA` | `#292927` | `#FFFEFA` / `#232321` |
| sage | `#F0F3E9` | `#2A2D27` | unchanged |
| line | `#D3CEC1` | `#3A3A37` | `#E2E3D8` / `#34332F` |
| tabBar | `#FFF7E9` | `#292927` | `#F2ECDF` / `#1E1E1C` |
| charcoal | `#2E2E2E` | `#F5F1E8` | unchanged |
| muted | `#555B54` | `#B5B2AA` | `#60675F` / `#B5B2AA` |
| forest | `#163D2E` | `#9CCBAE` | `#163D2E` / `#FFF7E9` |
| cream | `#FFF7E9` | `#163D2E` | unchanged (the label on a forest button) |

New theme keys: `overlayInk` `#1B1B1A` (a neutral photo overlay and the failed-photo overlay, both themes) and `photoGround` `#2E2E2E` (the failed-photo ground, both themes). The dark `forest` change touches every dark consumer of `forest`; the task that lands the tokens audits each one (heading, link, selected state, button) and the contrast test covers the new pairs.

### 2.3 Mood tokens (`nativeMood`)
`MoodKey` gains `heroWarn`, `heroEdge` and `stopActive`. The mood is only the header tint, so the light mood values differ by header alone; dark Siang differs by header alone.

| Key | light-siang | light-malam | dark-siang | dark-malam |
| --- | --- | --- | --- | --- |
| header | `#FFF7E9` | `#F3F6EF` | `#2E2B25` | `#2A2D27` |
| headerText | `#2E2E2E` | `#2E2E2E` | `#F5F1E8` | `#F5F1E8` |
| headerMeta | `#555B54` | `#555B54` | `#B5B2AA` | `#B5B2AA` |
| toggleTrack | `#FFFEFA` | `#FFFEFA` | `#292927` | `#292927` |
| toggleActive | `#163D2E` | `#163D2E` | `#9CCBAE` | `#9CCBAE` |
| onToggleActive | `#FFFEFA` | `#FFFEFA` | `#292927` | `#292927` |
| arcTrack | `#C9C6BA` | `#C9C6BA` | `#4E4C47` | `#4E4C47` |
| markerActive | `#2E2E2E` | `#2E2E2E` | `#F5F1E8` | `#F5F1E8` |
| markerIdle | `#858D80` | `#858D80` | `#8A8780` | `#8A8780` |
| todayRing | `#163D2E` | `#163D2E` | `#9CCBAE` | `#9CCBAE` |
| hero | `#FFFEFA` | `#FFFEFA` | `#292927` | `#292927` |
| heroText | `#2E2E2E` | `#2E2E2E` | `#F5F1E8` | `#F5F1E8` |
| heroMeta | `#555B54` | `#555B54` | `#B5B2AA` | `#B5B2AA` |
| heroShadow | `0 6px 18px rgba(46,46,46,0.10)` | same | `0 6px 18px rgba(0,0,0,0.35)` | same |
| pattern | none | none | none | none |
| **heroWarn** (new) | `#A33024` | `#A33024` | `#FF8F80` | `#FF8F80` |
| **heroEdge** (new) | `#C9C6BA` | `#C9C6BA` | `#4E4C47` | `#4E4C47` |
| **stopActive** (new) | `#9B4309` | `#9B4309` | `#F47B2A` | `#F47B2A` |

Hero button (hero and Dapur count card): fill `forest`, label `cream`, no edge. Search field: fill `surface`, edge `#858D80` light and `#8A8780` dark, placeholder `muted`. Track edge (idle meal tab) equals the idle marker. Demo strip: fill `canvas`, text `muted`. Scrim: a ramp from 0 at the top of the photo to 0.3 at the bottom, plus a text block that ramps 0 to 0.72 over 26dp at the bottom. The flat 0.66 overlay and the old `scrimSoft` (bottom 75 percent with a straight edge) are gone.

### 2.4 Derived steps (each added because a pair failed with the base hex)
Page neutral `#E4DED1` (white cards 1.33:1, the cream tab bar and Siang header 1.26:1, the pale sage Malam header 1.23:1; today's canvas is 1.03:1 under white). Pale sage header `#F3F6EF` (today's `#F0F3E9` is 1.19:1 on the page). Muted deep `#555B54` (`#60675F` is 4.35:1 on the new page). Card edge `#C9C6BA` (the white card is 1.06:1 on the cream header and 1.08:1 on the pale sage one; the edge is 1.61:1 and 1.57:1). Dark card `#292927` (today's `#232321` is 1.16:1 on the dark page). Dark warm header `#2E2B25`. Dark card edge `#4E4C47` (1.65:1 and 1.63:1 on the dark headers). Forest light `#9CCBAE` (forest itself is 1.21:1 on the dark card). Overlay ink `#1B1B1A`. Decorative row lines `#D3CEC1` and `#3A3A37` are outside the pair list.

### 2.5 Contrast result: 156 of 156 pairs pass
The pair list is 39 pairs per look in four looks, computed from the hex values in `directions-v2.json` by `output/native-review/phase-g/scripts/palette-directions-v2.cjs`. Today's shipped palette fails 34 of 144 on the same rules (12 pairs were added after audit 009). Rules: text at least 4.5:1 with no large-text exception (DESIGN.md asks 4.5:1 for all native text); a control boundary that is the only cue, the hero button edge and the Gagal diantar stop at least 3:1; adjacent surfaces at least 1.2:1, or a named edge token at least 1.5:1 against the outer ground; a failed photo shows no band (the overlay and the ground differ by at most 2:1) and the scrim has no straight edge.

| Group | Lowest ratio in any look | Minimum |
| --- | --- | --- |
| Text on its surface (header, hero, card, tab bar, field, strip, button label) | 5.2 (demo strip text on strip, light) | 4.5 |
| Component boundaries (search field, track, idle marker, hero button, Gagal diantar stop) | 3.14 (search field vs header, light-malam) | 3 |
| Adjacent surfaces | 1.23 (mood header vs canvas, light-malam) | 1.2 |
| Hero vs mood header (edge carries it) | 1.03 raw; edge 1.57 to 1.65 | 1.5 edge |
| Failed-photo band vs overlay | 1.21 | at most 2 |
| Scrim edge across a loaded photo | ramp from 0, no straight edge | pass |

Outside the 156: the active tracker stop against the meal card is 6.5:1 (light, both moods) and 5.35:1 (dark, both), at least 3; a price in bold charcoal is 13.46:1 light and 12.93:1 dark; Gagal diantar `heroWarn` on the hero is 6.92:1 light and 6.59:1 dark; the forest button label is 11.33:1 light and 6.64:1 dark. Audit 009 rows 9-01 to 9-26 each map to a named pair in `directions-v2.md`.

### 2.6 Surfaces, the Sunrise spend and the branded moment
- **Meal card and hero.** A plain card: `hero` fill, the food photo first, a 1.5dp `heroEdge`, the soft shadow kept for this one lifted card. Package and list cards use `surface` on the new canvas (1.33:1) with no border.
- **Sunrise spend.** After this phase `sunrise` and `sunriseInk` are read only by the tracker's current stop (`stopActive`), `nativeArt` (the success ring and the reading highlight), the confetti file, and the launch hand-off sparkles. A guard test in `native-theme-guard.test.ts` enforces it. Prices lose their Sunrise ink, the FB8 caption disappears with the loose error text, and the heart turns forest.
- **Success disc.** `nativeArt.successDisc` is the literal `#FFEFD9` (it was `nativeMood.light.siang.header`, which K changes). Paket selesai is the screen's one branded moment: the mascot on the disc with its 3dp Sunrise ink ring above one forest button. The mascot art needs no recolour.
- **Photo text and the corner button.** Cream text over the overlay: 8.6:1 over a white photo and 15.5:1 over a failed photo. The cream "⋮" on its 0.66 ground: 5.16:1.

### 2.7 Tests that change
`tests/native-contrast.test.ts` asserts the new exact hexes and gains the 39 pairs per look (read from the token objects, not from the script), the surface-separation rule, the Sunrise button pair, the photo overlay pairs and the failed-photo band rule. `native-theme-guard.test.ts` gains the Sunrise-spend guard. `native-appearance.test.ts` and any test that pins the old Siang header, brown dark Siang header or Malam pattern are updated in the same commit.

## 3. Motion: "Even slower"

The owner picked the third column of `relaxed-motion.md`. Native and web change together; `tests/native-motion-tokens.test.ts` stays as the parity guard.

| Token | Was | Now |
| --- | --- | --- |
| `control` | 120 ms | **200 ms** |
| `selection` | 180 ms | **340 ms** |
| `content` | 220 ms | **440 ms** |
| `feature` | 320 ms | **680 ms** |
| `ease` | `(.16, 1, .3, 1)` | **`(.33, 1, .68, 1)`** (web string `cubic-bezier(.33,1,.68,1)`) |
| `spring` | damping 18, stiffness 260 (ratio 0.56) | **damping 22, stiffness 120** (ratio 1.0, no overshoot) |
| Heart burst | 380 ms | **680 ms** |
| Success rig | 1200 ms | unchanged (the rig's choreography) |

Changed files: `packages/design-tokens/src/index.ts` (`nativeMotion`), `apps/web/src/lib/motion.ts` (`webMotion`; its `exit` ease is web only and stays), `HEART_BURST_MS` in `packages/mobile-ui/src/SaveHeart.tsx`, the DESIGN.md duration line.

Rules that do not change: **no loops** (D3); the tracker moves only on a stage change; the mascot and the skeleton pulse run only while waiting; reduced motion stays instant (every component already checks it); transform and opacity only; Decision A (no motion on a first load, refresh, pull, search, filter, tab return or mood switch).

Consequences to handle, not assumed:
- `SheetHeader`'s TalkBack focus fallback timer reads `nativeMotion.feature` (`SheetHeader.tsx`, `useSheetTitleFocus`). At 680 ms it would worsen G1(d). It becomes its own constant (section 4.1).
- `LaunchCover` runs on `feature` and would become 680 ms. It never blocks input. The gate checks that the cold start does not feel slower than the splash it hands over from; if it does, the cover moves to `content` and the change is recorded.
- A press must still answer at once. `PressableScale` starts its scale on press-down; the settle of the new spring is about 0.4 s. The gate checks that a tap does not feel late; the response, not the settle, is what the user feels.

## 4. G1 outcomes

### 4.1 Customer Ada masalah: TalkBack focus (FAIL, confirmed with a real double tap)
With TalkBack on, opening Ada masalah from the Hari row sends focus to the demo strip instead of the sheet title. The Dapur `impor-baris` sheet, which sits over a modal rather than inside the tab stack, passes. The sheet title is the first node in the accessibility tree, so the fault is timing or the window under the sheet, not order.

Fix in the build (native sheets kept, by the owner's decision):
1. Replace the `nativeMotion.feature` fallback with a fixed `SHEET_FOCUS_FALLBACK_MS = 400`, so the pace change cannot move it.
2. Send the focus event on the sheet's present (`transitionEnd`, not closing) and once more after a short settle (`SHEET_FOCUS_SETTLE_MS = 250`), because TalkBack re-asserts focus when the window under the sheet regains it.
3. While a sheet route is the topmost route, hide the demo strip and the tab bar from the accessibility tree (`importantForAccessibility="no-hide-descendants"` on Android, `accessibilityElementsHidden` on iOS), restored when the sheet closes.
Proof: a TalkBack **double tap** (not an injected tap) on the Ada masalah row, then the capture shows the focus ring on "Ada masalah". If it still fails, the smallest fallback applies as the kickoff wrote it: forms with fields in the tab stack (Ada masalah, Alamat, review, Ubah hari, the new calendar) move to a root-stack sheet, as `impor-baris` is, while choice, action and confirm sheets stay native. The task stops and reports before moving anything.

### 4.2 Customer: the tab bar covers "Kirim laporan" at the form detent
At the 0.6 detent the tab bar draws over the sheet's bottom and hides the lower edge of the note field and the Kirim laporan button. The sheet's scroll content and footer reserve the tab bar's measured height while the sheet sits in a tab stack, so the button is fully visible and tappable at the form detent. The same reserve applies to every tab-stack form sheet, including the new calendar. If the root-stack fallback in 4.1 is taken, this defect goes away with it.

### 4.3 Dapur Impor: deleting a row can be undone
`impor-baris` writes to the row as you type, and "Hapus baris ini" removes the row at once with no confirm and no undo. No confirm sheet is added (the owner's pick). Deleting a row shows a toast "Baris dihapus" with the action "Urungkan" (5 seconds, announced). "Urungkan" restores the row at its place with its edits. The row card leaves with `exitRow` and returns with `enterRow`. The import's saved count and the "n baris" summary follow the restore.

### 4.4 Dapur crash: `MascotReading` transform origin
`MascotReading.tsx:141` builds `transformOrigin` as `` `${x * 100}% ${y * 100}%` `` and `readingRig.magnifierPivot.y` is `0.8094098883572568`, which prints a long decimal that the native parser reads as a third (z) value: "Transform origin z-position must be a number". With motion on, "Susun daftar" crashes for every caterer who has not enabled reduced motion. Fix: build the origin from numbers (`[x * 100 + "%", y * 100 + "%"]` as an array, or round to 2 decimals), and add a regression test over every `transformOrigin` string in `packages/mobile-ui/src/brand` (none may contain more than two numeric parts). The reading path is then re-run with motion on.

## 5. The owner's feedback

### 5.1 FB1: pending feedback on actions that wait for the API
`Button` gains `busy`. The label is replaced by a small spinner in the label colour; the button keeps its width and height; it is not pressable while busy; `accessibilityState.busy` is true and the accessible name stays the label. The spinner appears after 150 ms (D6) so a fast answer never flashes it, and once shown it stays until the response. Reduced motion keeps the spinner (a wait, not decoration) but a platform activity indicator is allowed to be static.

Adoption at every call site that awaits a command:
- customer: Masuk, Register, Recover, AuthCallback, AddressForm, BuyScreen, PaymentScreen, ClaimScreen, HelpForm, ReportProblem, ReportList, ChangeDaySheet (now the calendar), ChooseMenu, Plate (Sudah sampai), ReviewSheet, the shell's "Coba lagi";
- Dapur: Masuk, Daftar, RoleGate, AktifkanScreen, PackageEditor, TimScreen, CustomerDetail, ImportAssistant, MenuWeek, MenuDayScreen, ExceptionSheet, ReportScreen;
- new in this phase: Data akun forms, the address delete and move sheet, the calendar sheet, Berangkat (n) and Sampai (n), the proof-photo sheet.

**OTP:** the code check uses the busy button on the code screen; the code stays visible. The mascot screen (`MascotLoading`) stays for requests that run long: the import assistant reading files, the payment check, the claim link. Both `no-spinner.test.tsx` files allow an `ActivityIndicator` only inside a busy `Button`, `StickyAction`, `SettingsRow` or the Menu upload tile.

### 5.2 FB8: errors are never loose small text
- **`ConnectionBanner`** (`packages/mobile-ui`), at the top of the content under the header: an icon, the title "Tidak ada koneksi", the line "Menampilkan data terakhir, {HH.MM}" and "Coba lagi". Announced once; hides itself on reconnect. It uses `@react-native-community/netinfo` (added with `expo install`) so it retries on reconnect. Warning tone: `heroWarn` or `danger` on a `surface` card with a `line` edge, icon plus words, never the brand accent.
- **`ReadError`** moves from Dapur into `packages/mobile-ui`; customer screens adopt it where nothing is cached.
- **`FormError`** callout (icon, text) at the form's action; `accessibilityLiveRegion` on Android and `announceForAccessibility` on iOS.
- **Non-form action failures** (Sudah sampai, Berangkat, Sampai) show an error toast with "Coba lagi".
- The loose `sunriseInk` offline caption on Beranda and plan detail, and Dapur's attention card line, are removed. A test fails on a bare danger or warning caption outside `FormError`, `Field error`, `ReadError` and `ConnectionBanner`.

### 5.3 FB7: the hero with a failed photo
Reproduced on the emulator (audit 9-24): clear Expo Go's image caches, cold start on `/pengaturan`, airplane mode on, open Beranda. `Photo` takes `onError` and shows `sage`; `scrimSoft` covers only the bottom 75 percent, so the top quarter is a pale strip over a grey slab, and the "⋮" straddles the edge. K's fix (section 2.3): the failed-photo ground is `photoGround` (`#2E2E2E`) under `overlayInk`, a 1.21:1 difference, so no band; the scrim is a ramp with no straight edge (9-26). The "⋮" keeps its own 0.66 ground. The task also records why a photo failed on the owner's phone (offline, a relative or LAN URL, or the `expo-image` cache policy losing a seen photo); `Photo` sets a disk cache policy and a recycling key, and the finding goes in the Doc facts. Re-check at font scale 1.3 and 360dp with the four-stop tracker.

### 5.4 FB9 and FB10: a four-stop tracker with an icon per stage
`RantangTrack` has four stops at 0, one third, two thirds and the end: Terjadwal, Dimasak, Diantar, Sampai.
- One code-drawn glyph per stop in the stroke style of `brand/Rantang.tsx`: Terjadwal a calendar, Dimasak a pot with steam, Diantar a motorbike, Sampai a house with a check. No icon library (antislop R-04).
- Done stops are filled in the hero ink, the current stop is larger with a ring in `stopActive` (the only Sunrise on the screen), later stops are outlined in `heroMeta`. The line is ink and fills to the current stop.
- **Sampai awaiting confirmation** (FB3): half filled, caption "Ditandai sampai, menunggu konfirmasimu".
- **Gagal diantar** (`issue`): a warning stop in `heroWarn` with an alert glyph and a dashed last segment, with the words "Gagal diantar". Never a silent fallback to a normal stop.
- Motion (D3, no loop): on a stage change the line fill and the stop animate over `feature` (680 ms) with the new ease. The fill is a `scaleX` from the left edge (transform only). Nothing animates on first paint, refresh, pull or tab return. The rantang object stays as the marker riding the line, with the glyphs under it. Instant under reduced motion.
- Accessibility: the container reads one sentence, "Pesanan: {stage}, langkah {n} dari 4", and each stop is decorative.
- Dapur's count card uses the same component with counts under each stop; with mixed stages after a first round (FB11) the line fills to the furthest stage reached.
- `daily-loop-ui.test.tsx` and the Dapur count-card tests are updated.

### 5.5 FB6: a calendar for changing days
A shared `CalendarSheet` in `packages/mobile-ui`, built on `monthWeeks` in `schedule/dates.ts`, presented as a native form sheet at the large detent (it follows the section 4.1 result for tab-stack form sheets).
- Month paging across the allowed window. The current delivery day is outlined, the chosen day filled with a forest ring and label (rule 3, not a block).
- Unavailable days are dimmed; tapping one reads the reason: "Penuh", "Terisi", "Dapur libur", "Lewat batas waktu".
- Tabular numerals; the button "Pindah ke {tanggal}" is disabled until a new day is chosen and shows `busy` while the command runs.
- Customer: replaces the chip strip in Ubah hari, data from `deliveryAvailability`. Dapur: replaces the free-text "Tanggal baru (TTTT-BB-HH)" field in Pindah tanggal, with the consequence line "Pelanggan yang memakai aplikasi diberi tahu" (the old "Pelanggan diberi tahu" was untrue for customers without an account; R-17).
- The buy flow's start-date chips (8 options) stay chips.
- Dapur needs an availability read under staff authorization. Whether `deliveryAvailability` can serve it is checked first; if not, a staff read is added (section 14).

### 5.6 FB3: the caterer marks Sampai, the customer confirms
Data (the Opus build; its reason is written in the ledger: tenant-authorized state transitions that need concurrency scenarios):
- No new status. `v1.fulfillments` gains `arrived_at`, `arrived_by` and `arrived_photo`.
- `delivery.arrive {catererId, date, meal, fulfillmentIds}`: allowed from `out_for_delivery`, for Jakarta today only; staff-checked, in one transaction with row locks; every id must belong to that caterer, date and meal; one proof photo per stop; queues the push to the customer (dedupe per customer, date, meal and stage).
- The meal stays `out_for_delivery` until the customer's `delivery.confirm` (unchanged), or auto-confirm 2 hours after `arrived_at` (D2) when the customer has not tapped Belum and no report is open, or the next-morning `v1.auto_deliver` backstop. Auto-confirm writes `confirmed_by='auto'`; `confirmed_by='caterer'` stays unused.
- "Belum" still opens the "Belum sampai" report; an open report blocks auto-confirm.
- Domain: `PlateState` gains `arrived_unconfirmed`; `JourneyStage` reads `arrived_at`; `mealJourney`, `journeyCaption` and `statusLabel` follow. Customer hero: "Dapur menandai pesananmu sudah sampai. Sudah diterima?" with the photo beside Sudah sampai and Belum, and the photo later in the day's detail.
- A meal closed by the system reads **"Ditandai sampai otomatis"** (replacing "Tercatat sampai").
- Web: the workspace's "delivered" button marks Sampai (with the same photo) and waits for the customer. It no longer sets the final status.
- Storage: a private, tenant-scoped location; only that customer and that caterer's staff read it. This is the production photo upload path (open release item G17), built for real; demo mode serves a synthetic photo. The existing food-upload routes are read first for a path to reuse.
- Scheduling: the 2-hour auto-confirm needs a job every few minutes. It runs in the same scheduler as the push backstop (section 5.8). Until that scheduler is verified on the hosted project, auto-confirm degrades to the next-morning job: slower, still correct.

### 5.7 FB11: Dapur selects stops
- `delivery.depart` takes an optional `fulfillmentIds` subset; the push still goes once per customer. `delivery.arrive` takes the same.
- "Urutan antar" gets a selection mode: "Pilih", circles per stop, the count in the title, "Pilih semua" per area, a bottom bar with "Berangkat (n)" and "Sampai (n)". Stops already past an action cannot be selected for it and show why. The sticky footer becomes "Berangkat semua sisa · {n} porsi" once some stops have left.
- `kitchenSession` (`packages/domain/src/kitchen.ts`) and the count card handle mixed stages. Cooking stays one action per session. No named rounds (D4): repeated departures are the rounds.

### 5.8 FB4: notifications
- **Send at the event (D7).** A push is dispatched right after the command that queued it (the Next.js guide for `after()` is read first: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`). A backstop retries failures every few minutes through Supabase `pg_cron` plus `pg_net` where the hosted project allows it, or a working cron.
- **Events:** every delivery status change pushes the customer: Dimasak (new), Berangkat, Sampai waiting for confirmation (new), Gagal diantar (verified or added) and a Pindah tanggal by the caterer. Existing pushes stay. Dedupe per customer, date, meal and stage.
- **One EAS project per app.** Each app config reads its own project id and a config test fails when it is missing or equals the other app's. The values come from the owner.
- Push bodies change through a new migration (never edit an applied migration) and in `apps/web/src/lib/push-dispatch.ts`. Caterer pushes are titled "Catera Dapur"; customer pushes stay "Catera".
- Device proof (registration, receive, tap to `data.href`, revoke, `device.unregister`) belongs to the dev-build gate (G12) and needs the owner's FCM V1 and APNs credentials. Until then it is NOT VERIFIED. The in-app updates list works without push.

### 5.9 Proof photo flow (FB3 with FB11)
"Sampai (n)" opens a form sheet with a grid of stop tiles. Each tile has the stop name and its own camera button; tiles fill in any order; a missing photo is marked; the button "Sampai (n)" stays disabled (with the reason) until every selected stop has a photo and shows `busy` while the command runs. One stop uses the same sheet with one tile. Photos are shrunk before upload as the import photos are. A failed upload keeps the other photos and shows `FormError` at the button.

### 5.10 FB5: Data akun
A "Data akun" page in both apps (customer: from the Akun header; Dapur: Usaha, Pengaturan). Rows:
- **Nama:** new `profile.update`, own row only, in a transaction.
- **Nomor HP:** a code to the new number, then the change. Real SMS needs the production SMS credentials (NOT VERIFIED until then); demo simulates.
- **Email:** a confirmation link (`double_confirm_changes` is on).
- **Kata sandi:** shown only for email accounts; reauthenticates.
- **Hapus akun:** a request through `accountRequest.create` kind `deletion` with a confirm sheet. **With a running plan** (the owner's pick), the request goes through. The sheet names the running plans and says the Catera team settles them first: "Paket yang masih berjalan diselesaikan dulu oleh tim Catera. Kami hubungi kamu soal sisa harinya sebelum akun dihapus." It promises no timing (R-17). The privacy link follows once the terms page exists.
- Dapur adds "Ubah nama atau kontak dapur" (D5): a change request to Catera (`accountRequest.create` kind `help`, or `support.create`) with the request's status shown.
- Pengaturan moves into `packages/mobile-ui` with `voice`, `supporting` and `onSignedOut` props (parked item M4) before these rows land, so they land once.

### 5.11 G13, G15, G16
- **G13 address.** `address.delete` and `address.replace` in transactions with tenant authorization (own addresses, own days). "In use" is a delivery day dated today or later, not delivered or cancelled, whose address copy carries the id, or a pending checkout with that `address_id`. The confirm sheet says "Alamat ini masih dipakai untuk 12 pengantaran, 13 Okt sampai 31 Okt." and offers "Pindahkan ke alamat lain" and "Batal". The move keeps the per-caterer advisory lock, the `COVERAGE` check per plan and the one-day cutoff; days past the cutoff stay and the sheet says how many and until when. An unused address is soft-deleted (`archived_at`) after one confirm. Toast "Alamat dihapus". Editing an address stays as it is and is recorded.
- **G15.** A "Syarat dan privasi" page in `apps/web`, a clearly labelled placeholder until the owner supplies the text (E2), opened in the in-app browser from both Pengaturan rows; the TODO goes.
- **G16.** Masuk centred: the mascot, the line under it and the text buttons ("Ganti nomor", "Masuk dengan email", "Lupa kata sandi?", "Daftar dengan email"); field labels stay start-aligned; the error moves to `FormError` at the action. Covered in `empty-states.test.tsx`. Runs after the Android gate.

## 6. Copy

Voice: Indonesian first, English through `t(id, en)`. Both apps say **"kamu"**, dropping the pronoun where the sentence works without it, with no slang ("gak", "aja", "banget", "dong") and full verbs. No em dashes. Every pass that writes copy uses `humanizer` and `antislop-copywriting`.

| Topic | Final wording | Notes |
| --- | --- | --- |
| Customer register | "kamu" | About 45 strings, DESIGN.md (unsaved guard, launch line), `useUnsavedGuard` gets `voice: "kamu"`. `CustomerDetail.tsx:69-71` (sent to a customer) follows. |
| The business | "katering" | Every customer-visible "katerer" becomes "katering". |
| Second Dapur role | "staf dapur" (English "kitchen staff") | Visible label only; the stored value stays. Replaces "Pembantu" and "helper". |
| Beranda section | "Perlu kamu urus" / "Needs you" | Replaces "Menunggu Anda". |
| Dapur move | "Pindah tanggal" | Spoken labels too. |
| A delivery (noun) | **"pengantaran"** | Replaces the noun "antaran" and never "pengiriman". The verb forms "antar" ("Berangkat antar", "Urutan antar", "Antar HH.MM") are unchanged. Owner pick against the recommendation. |
| Phone | "HP" | Replaces "ponsel" in the apps. |
| Package button (Dapur) | "Terbitkan paket" | It publishes and locks the package. |
| Push title, caterer | "Catera Dapur" | Customer pushes stay "Catera". |
| Meal closed by the system | **"Ditandai sampai otomatis"** | Replaces "Tercatat sampai". Owner pick against the recommendation. |
| Demo label | "Demo (data contoh)" | AGENTS.md still requires an explicit demo. |
| Jelajah search placeholder | "Cari menu atau katering..." | Drops the invented "Bu Rini" (R-38). |
| Aktifkan review time | "Tim Catera biasanya memeriksa dalam 1 sampai 2 hari kerja." | **Kept by the owner against the recommendation.** It is a timing claim the system cannot back (R-17); see section 14. |
| Renewal (next day) | "Mulai Selasa 13 Okt, tepat setelah paket sekarang" | Only when the start really is the next day. |
| Renewal (pushed later) | "Mulai Selasa 10 Nov. Paket ini masih berjalan sampai Senin 9 Nov." | Names the same package. |
| FB3 hero and push | "Dapur menandai pesananmu sudah sampai. Sudah diterima?" / push "Pesananmu sudah diantar. Sudah diterima?" | New. |
| Tracker captions | Terjadwal, Dimasak, Diantar, Sampai, "Ditandai sampai, menunggu konfirmasimu", Gagal diantar | |
| Banner | "Tidak ada koneksi" / "Menampilkan data terakhir, {HH.MM}" / "Coba lagi" | One wording in both apps. |
| Undo toast | "Baris dihapus" + "Urungkan" | |
| Calendar | "Pindah ke {tanggal}"; reasons Penuh, Terisi, Dapur libur, Lewat batas waktu | |

The shared status words, glossary and error map change once in `packages/domain` so both apps and the pushes agree. The old generic "Belum berhasil. Coba lagi." (12 places) becomes a message that says what failed. Formal words ("Silakan", "terlebih dahulu", "tidak dapat") leave the shared error map and the pushes. Thirty-four Dapur strings that stayed Indonesian in English mode get `t()` pairs. The asserting tests change in the same commit as each string. An Opus copy review of the diff, with `humanizer` in both languages, runs before the Android gate captures the screens.

## 7. Dials and rules (DESIGN.md changes)
- Customer ENERGY 2 / RHYTHM 2 / MOTION 2; Dapur ENERGY 1 / RHYTHM 1 / MOTION 2 (unchanged).
- Motion durations and ease as in section 3; loops only while waiting; the tracker never loops.
- Colour contract: section 2, recorded as "Colour revision (Phase G), October 2026".
- The action ladder gains the calendar sheet (a form sheet) and the proof-photo grid sheet; the toast vocabulary gains "Baris dihapus", "Alamat dihapus" (now real) and the "Coba lagi" error toast.

## 8. Verification
- Every task: `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites (`npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from each app folder). The data tasks add `npm run test:postgres` with the new scenarios: arrive against customer confirm, arrive against a report being filed, double arrive, auto-confirm against a late report, two staff departing overlapping subsets, arrive against depart, an address delete racing a checkout, an address replace racing `delivery.cook`.
- `tests/native-contrast.test.ts` and `tests/native-motion-tokens.test.ts` as in sections 2.7 and 3.
- Android emulator gate on `Catera_Pixel8_API36` (Expo Go, demo backend, `10.0.2.2`), run by an Opus gate agent: light and dark (`adb shell cmd uimode night yes|no`), Siang and Malam, 360dp at font scale 1.3, reduced motion (`animator_duration_scale 0`), TalkBack on the sheets, the tracker, the banner and the calendar, flight mode on and off. Every Review Focus line of the plan is PASS or FAIL with a capture. Only gate agents take screenshots; contact sheets, contrast, tap-target and truncation checks are scripted.
- NOT VERIFIED until their inputs exist: iOS (no Mac), real push (FCM V1 and APNs credentials, a development build), real SMS for the phone change, the hosted scheduler, the native splash and predictive back.

## 9. Out of scope
Web beyond the delivered button, push dispatch, motion tokens and the terms page; a paid "tambah porsi" (Phase H); named delivery rounds; new raster artwork; an iOS run; the development build; editing an applied migration; recolouring the mascot art.

## 10. Risks
- **Delivery state is tenant-authorized state change.** Mitigation: an Opus first build with a written reason, row locks, and the eight PostgreSQL scenarios.
- **Dark `forest` flips from cream to mint.** Every dark consumer moves. Mitigation: an audit step in the token task and the new pairs in the contrast test.
- **Slower motion can make taps feel late.** Mitigation: press-down answers at once; the gate checks it; the pace lives in tokens, so one change reverts it.
- **Sheet focus root cause is a hypothesis.** Mitigation: the proof is a real TalkBack double tap, with a written fallback.
- **Rename churn.** "Anda" to "kamu" and "antaran" to "pengantaran" touch about 180 strings and tests. Mitigation: one copy task after the screens settle, with an Opus review.
- **Scheduler and credentials may not exist.** Mitigation: the 2-hour auto-confirm and the push backstop degrade to the next-morning job; both are listed as NOT VERIFIED until proven.

## 11. Tasks (for the plan)
Builders are Sonnet, except the delivery data task and the address task (Opus, reasons in the ledger). Fixers, reviewers and gate agents are Opus. Never Haiku.

| Task | Covers | Depends on | Builder |
| --- | --- | --- | --- |
| G17a Pengaturan into `mobile-ui` | 5.10 (M4) | none | sonnet |
| G1a Crash and undo toast | 4.3, 4.4 | none | sonnet |
| G7 Tokens: palette K, motion, warning, guards | 2, 3 | none | sonnet |
| G3 Delivery state | 5.6, 5.7 data | none | opus |
| G4 Account commands | 5.10 data | none | sonnet |
| G5 Push at the event, one EAS project per app | 5.8 | G3 | sonnet |
| G1b Sheet focus and tab bar | 4.1, 4.2 | G7 | opus |
| G6a `Button busy`, `FormError`, `ConnectionBanner`, `ReadError` | 5.1, 5.2 | G7 | sonnet |
| G6b `CalendarSheet` | 5.5 | G7, G1b | sonnet |
| G6c Four-stop `RantangTrack` | 5.4 | G7 | sonnet |
| G13 Address delete and move | 5.11 | none | opus |
| G8 Customer screens | 5.1 to 5.6, 5.9, 5.10 | G3, G4, G6a to c, G7, G17a, G1b | sonnet |
| G9 Dapur screens | 5.1 to 5.10 | G3, G4, G6a to c, G7, G17a, G1b | sonnet |
| G15 Syarat dan privasi | 5.11 | none | sonnet |
| G18 Copy pass | 6 | G5, G8, G9, G13, G15 | sonnet, opus copy review |
| G17b Other parked minors | kickoff G17 | G8, G9 | sonnet |
| G20 Gate prep, DESIGN.md, handoff | all | all | opus |

## 12. Return contract
Each task returns the commit SHA, the tests added or changed with their output, the files touched, and PASS, FAIL or NOT VERIFIED with a capture path for every device check. Nothing is called verified without a capture or a recorded click-through. The G-b session ends with a handoff file in `docs/superpowers/handoffs/` and the weekly usage percentage in the ledger.

## 13. What stays fixed
Platform-native chrome (NativeTabs, native stack headers, native sheets; brand in the content), Plus Jakarta Sans everywhere the app draws text, Indonesian-first copy, 48dp controls, Three States, Truthful State, Price Unit and Demo Label rules, no invented numbers (R-17), opaque or derived artwork described truthfully (apps import only `packages/brand/assets/phase-f/runtime/`), transform and opacity only, every motion instant or static under reduced motion, tenant authorization and entitlement changes in database transactions, demo mode explicit and synthetic.

## 14. Open items this spec could not close
1. **AGENTS.md** still says "preserve the latest approved palette". The owner reopened it; the owner decides whether to amend the sentence.
2. **"1 sampai 2 hari kerja"** is an owner-kept timing claim with no backing in the system (R-17). Recorded, not changed.
3. **Android `tabIndicator`** (the active-tab pill) is not defined by K and today is a sage-green pill, which reads as a block. The gate judges it; the fix is a smaller mark or a neutral pill, with a pair added to the test.
4. **Dark `forestDeep`** (a pressed state) is not defined by K. The token task derives one with the palette script and adds its pair.
5. **Heart colour** (forest) and **launch sparkles** (kept in Sunrise as a pre-UI beat) are this spec's reading of K rules 3 and 6, not a pick. A reviewer may overrule.
6. **"Antaran" to "pengantaran"** is read as the noun only; the verb "antar" stays. Confirm in the copy review.
7. **Dapur availability read** for the calendar: unknown until `deliveryAvailability` is tried under staff authorization.
8. **EAS project ids** disagree across the app configs and root `app.json`; which is real needs the owner's EAS account.
9. **Hosted scheduler** (`pg_cron` and `pg_net`) availability is unconfirmed; it decides whether the 2-hour auto-confirm and the push backstop are live.
10. **Why the hero photo failed on the owner's phone** is not known; only the emulator recipe reproduces it.
