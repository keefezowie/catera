# Catera native apps: visual identity, mood and dark mode

**Date:** 2026-10-09 · **Branch:** `v2` · **Status:** direction approved on the design canvas ("Go with E"); awaiting written-spec review
**Scope:** `apps/customer`, `apps/caterer` (Catera Dapur), `packages/design-tokens`, `packages/mobile-ui`, `packages/domain`, `packages/mobile-core`, plus the kitchen-status backend carried over from the October 8 spec. Web is out of scope.
**Companions:** [UI/UX and motion pass](2026-10-08-native-uiux-motion-design.md) (Phase 1 shipped), [DESIGN.md](../../../DESIGN.md), [antislop audit 001 follow-up](../../../anti-slop/audit-001-followup-2026-10-08.md)
**Reference board:** the "Catera visual directions" design canvas (rows D2 Siang, D2 Malam, D2 customer and Dapur screens, Mode gelap, and E). It is a reference, not a pixel contract; this spec wins where they differ.

## 1. Why

After Phase 1 the apps were correct but looked generic: a cream page, outlined cards and a stock tab bar, with no picture of the product's own story. The owner asked for a direction that is recognisably Catera, explored four directions on a canvas, and approved this combination:

- **A** food photo hero, plus **B** the sun-to-moon day arc, in **C** colours (deep forest blocks, cream boxes, a sunrise-ink sticker). Together these became D2.
- **Siang/Malam mood**: a button the user selects, not the clock. Switching plays the transition. Only the header and the hero change; the body and the bottom tab bar never change colour.
- **Dark mode** as a separate, real theme with a neutral charcoal body, never dark green.
- **Direction E** patterns on top of D2: the moving lunchbox track, tomorrow's menu as a story, the photo calendar, photo category circles, the kitchen checklist, numbered delivery order and a photo prompt in the Dapur menu.

### What the owner said (binding)
1. "Go with E" (2026-10-09), on top of D2 and the dark-mode row.
2. Mood is driven by the selected Siang/Malam button; the animated transition plays when the user switches.
3. The mood changes the header and hero only. "I dont think it looks good if the body switches colors as well."
4. "No need to change the color of the bottom nav bar when toggling between day and night."
5. Dark mode body must not be the brand green: "it lacks contrasts with the header and footer".
6. Include more screens as direction reference (done on the canvas: customer and Dapur rows beyond the three hero screens).

### What stays fixed
Palette identities (forest, sunrise and sunrise ink, cream, charcoal), Plus Jakarta Sans with the shipped native ramp, Indonesian-first copy, food-led discovery, the mascot as supporting warmth only, opaque artwork described truthfully, 48dp controls, the Three States Rule, the Truthful State Rule, the Price Unit Rule and the Demo Label Rule. No streaks, badges or invented numbers.

## 2. Research behind E (Mobbin, 2026-10-09)

| Pattern | Seen in | Catera use |
| --- | --- | --- |
| Marker that travels along a progress track | Grab, Blinkit, Zomato, Lugg, Waymo live activities | The rantang (lunchbox) marker on Dimasak, Diantar, Sampai, identical in both apps |
| Full-screen story with segment bars | Instagram, Formula 1, Strava | Tomorrow's menu opens as a two-part story: Siang, then Malam |
| Ringed photo circles | Swiggy, Blue Apron | Tomorrow's menu entry on Beranda; categories on Jelajah |
| Calendar days shown as photos | Alta, Hypelist, Whering | Jadwal month grid |
| Visible change deadline | HelloFresh ("Edit delivery by") | "Bisa diubah sampai 20.00" on Beranda and in the story |
| Checklist with large quantities | Kitchen Stories, Recime, Numo | Dapur cooking list (8×, 4×, 12×) |
| Numbered stop list | Grab Driver | Dapur delivery order with a map button per stop |

Rejected on purpose: floating tab bars (Wabi, Crouton) cover content on Android and would change the fixed tab bar; card colours sampled from photos (Apple News) add colours outside the palette; cut-out ingredient collages (Alma) need transparent artwork that does not exist.

## 3. Visual system

### 3.1 Two independent axes
- **Theme**: light or dark. It follows the phone's system setting unless the user picks otherwise under "Tampilan" ("Appearance"): Sistem, Terang or Gelap (System, Light, Dark). The row sits beside "Bahasa" in customer Akun and Dapur Usaha. The choice is stored on the device in SecureStore (`runtime.storageKey("theme")`, values `system | light | dark`, default `system`) and applies immediately, without a restart.
- **Mood**: Siang or Malam. It is chosen by the user and colours only the mood surfaces (section 3.3).

Every screen therefore has four looks: light Siang, light Malam, dark Siang, dark Malam. Body, cards, rows, sheets, forms and the tab bar depend on the theme only.

### 3.2 Theme tokens
`packages/design-tokens` gains `nativeThemes.light` and `nativeThemes.dark`. Both use **the same keys as today's `colors`** plus `controlRing` and `tabBar`, so migrating a file is a mechanical swap from `colors.x` to the themed palette's `x`. The keys name roles by their light-mode hue, so dark mode inverts the forest and cream pair: forest (headings, selected fills, primary buttons) becomes cream-white, and cream (text on forest, the attention card) becomes forest. A primary button is therefore a cream fill with forest text in dark mode, exactly as on the canvas. Light reuses today's values unchanged.

| Key | Light | Dark | Dark contrast (measured 2026-10-09) |
| --- | --- | --- | --- |
| `forest` | `#163D2E` | `#FFF7E9` | 14.79:1 on `surface` |
| `forestDeep` | `#0C2C20` | `#E9E3D6` | |
| `sunrise` | `#F47B2A` | `#F47B2A` | |
| `sunriseInk` | `#9B4309` | `#F5C9A6` | 10.34:1 on `surface` |
| `cream` | `#FFF7E9` | `#163D2E` | 11.33:1 against `forest` |
| `charcoal` | `#2E2E2E` | `#F5F1E8` | 13.97:1 on `surface` |
| `surface` | `#FFFEFA` | `#232321` | |
| `canvas` | `#FDFAF3` | `#151514` | |
| `sage` | `#F0F3E9` | `#2A2D27` | |
| `scheduled` | `#EDF1E6` | `#26302A` | |
| `muted` | `#60675F` | `#B5B2AA` | 7.43:1 on `surface`, 5.69:1 on `cream` |
| `line` | `#E2E3D8` | `#34332F` | |
| `fieldBorder` | `#CFD3C6` | `#7A7872` | |
| `secondaryBorder` | `#CDD4C4` | `#4A4944` | |
| `attentionBorder` | `#F3DFC3` | `#4C3322` | |
| `danger` | `#A33024` | `#FF8F80` | 7.12:1 on `surface` |
| `controlRing` (new: unchecked boxes, dashed "not set" cells) | `#858D80` | `#8A8780` | 3.40:1 light, 4.39:1 dark on `surface` |
| `tabBar` (new) | `#FFFEFA` | `#1E1E1C` | |

`app.config.ts` in both apps switches `userInterfaceStyle` from `"light"` to `"automatic"`. The status bar uses light glyphs in dark theme or on a Malam header, and dark glyphs otherwise.

**Contrast rules (enforced by test):** text at least 4.5:1 on its own fill; state icons and boundaries that are the only cue for a control (`controlRing`) at least 3:1. `fieldBorder` and `secondaryBorder` are not enforced, because their controls also carry a label and a fill; light `fieldBorder` measures 1.51:1, a gap that predates this spec and is left for a later pass. Decorative strokes (the dashed arc track, the lunchbox outline pattern) are exempt and are marked decorative for screen readers. Measured on 2026-10-09: Siang meta `#6B4A2B` on `#FFEFD9` 7.05:1; cream on sunrise ink 6.17:1; Malam muted `#A9BDB0` on `#0B1F16` 8.67:1; dark muted `#B5B2AA` on `#232321` 7.43:1. Three mock colours failed and are replaced here: the idle moon marker on the Siang header (`#B49F82`, 2.26:1, becomes `#9A7A55`, 3.52:1), the dashed "menu belum diisi" cell border (`#D2B48E`, 1.74:1, becomes `#9A7A55`) and the unchecked checklist ring (`#CDD4C4`, 1.51:1, becomes `controlRing` `#858D80`, 3.40:1).

### 3.3 Mood tokens and surfaces
Mood surfaces are exactly: the **mood header** (the rounded top block under the demo strip) and the **hero** (the photo card that overlaps it on Beranda, the count card on Dapur Hari ini, the featured card where a screen has one). Nothing else reads mood colours.

`nativeMood[theme][mood]`:

| Key | Light Siang | Light Malam | Dark Siang | Dark Malam |
| --- | --- | --- | --- | --- |
| `header` | `#FFEFD9` | `#0B1F16` | `#3A2617` | `#163D2E` |
| `headerText` | `#163D2E` | `#FFF7E9` | `#F5F1E8` | `#F5F1E8` |
| `headerMeta` | `#6B4A2B` | `#A9BDB0` | `#E6C3A2` | `#CFE0D2` |
| `toggleTrack` | `#F6DDBE` | `#1C3A2C` | `#4C3322` | `#25553F` |
| `toggleActive` / `onToggleActive` | `#9B4309` / `#FFF7E9` | `#FFF7E9` / `#0B1F16` | `#F5C9A6` / `#3A1A04` | `#FFF7E9` / `#163D2E` |
| `arcTrack` (decorative) | `#E2C29C` | `#2C4C3C` | `#6A4A33` | `#2C5A45` |
| `markerActive` | `#9B4309` | `#FFF7E9` | `#F5C9A6` | `#FFF7E9` |
| `markerIdle` (at least 3:1 on `header`) | `#9A7A55` | `#6E8C7C` | test | test |
| `hero` | `surface` | `#1C3A2C` | `surface` (dark) | `#1C3A2C` |
| `heroText` / `heroMeta` | `strong` / `muted` | `#FFF7E9` / `#A9BDB0` | theme | `#F5F1E8` / `#CFE0D2` |
| `pattern` (lunchbox outlines, Malam only, decorative) | none | `#1A3A2B` | none | `#1F4A38` |

Values marked "test" are picked from the brand ramp by the section 8 contrast test before Phase A lands. The dark Malam values for `arcTrack` and `pattern` are starting points that the test may adjust.

### 3.4 Shapes, depth and type
- Mood header: bottom corners 28 (Dapur and secondary screens) or 32 (Beranda, where the hero overlaps by 58). Hero card radius 28 with an inner photo radius 20. Content cards 20. Existing panels, inputs (9), buttons (10) and chips keep their radii. Toggles and stickers are pills.
- Depth: the hero is the only raised surface on a screen, using `boxShadow` (light Siang `0 10px 28px rgba(107,74,43,0.16)`, Malam `0 10px 28px rgba(0,0,0,0.35)`). Everything else stays flat with borders or tonal fills (Quiet Work Rule).
- Type: the shipped ramp stays. One variant is added, `display` (34/40, `Jakarta-ExtraBold`, −1), used only for the story title. Checklist quantities use `heading` with tabular figures.
- Sticker: the rotated (−2°) cream label with a 1.5 sunrise-ink border marks one fact per screen at most (a delivery window or an unfilled menu). It is not decoration.

### 3.5 Brand objects drawn in code
Ionicons remain the interface icon set. Three Catera objects are drawn with `react-native-svg` (already in Expo Go): the **day arc** (dashed track, progress stroke, sun and moon markers), the **rantang** (lunchbox: body, divider, handle) and the **Malam lunchbox pattern** (three outline rantang behind the Malam header). They live in `packages/mobile-ui/src/brand/`. No generated artwork is added or altered.

## 4. Mood behaviour

- **State:** one `MoodProvider` per app at the root. It holds `"siang" | "malam"` in memory.
- **Default at launch:** the next meal session. Before 15.00 Asia/Jakarta it is Siang; from 15.00 until the end of the day it is Malam. The time only picks the default and never switches the mood while the app is open.
- **Where the toggle appears:** Beranda header, Jelajah header (the two large Siang/Malam meal buttons act as the toggle and the filter) and Dapur Hari ini header. Dapur Menu uses the same toggle to choose which meal it edits. All other screens show the current mood in their header without a toggle.
- **What it changes on each screen:**
  - Beranda: header headline ("Siang ini, …" or "Malam ini, …"), arc marker position, and which of today's meals the hero shows.
  - Jelajah: which meal the results are for.
  - Dapur Hari ini: which session (lunch or dinner) the count card, checklist and delivery order show.
  - Dapur Menu: which meal is being edited.
- **Accessibility:** the toggle is a `tablist` of two `tab`s with `selected` state, labelled "Siang" and "Malam" (English: "Lunch", "Dinner"); 48dp hit area. The arc is hidden from screen readers; the headline carries the meaning.
- **Dapur date:** the former Hari ini / Besok segmented control becomes a 48dp date button in the header ("Kamis 8 Okt", with a chevron) that toggles between today and tomorrow, so the header holds one toggle, not two.

## 5. Screens

Every screen keeps the Three States Rule. The demo strip stays above the mood header.

### 5.1 Customer
- **Beranda** (canvas: E · Beranda, D2 Siang/Malam · Beranda):
  - Mood header: date, toggle, a two-line headline naming the meal and dish, and the day arc.
  - Hero card: dish photo, dish name, caterer and delivery window, then the rantang track (section 6.1).
  - "Menu besok" row: two ringed photos (lunch ring in sunrise ink, dinner ring in forest), the date and "Bisa diubah sampai {jam}". Tapping opens the story.
  - Plan line (e.g. "Paket siang Dapur Senja · 6 hari lagi") opening plan detail (October 8 spec, Phase 3).
  - With no delivery today, the hero becomes the existing empty state inside the hero frame, and the headline names the next delivery date instead.
- **Menu besok** (canvas: E · Menu besok): a new full-screen modal route, `app/tomorrow.tsx`.
  - Layout: the photo fills the screen; top and bottom gradients exist only to keep text legible; segment bars at the top; header "Menu besok · {tanggal} · 1 dari 2" with a 48dp close button.
  - Content: the sticker shows meal and window, then the `display` title, caterer and sides, and the deadline line with "Ubah hari" and "Lihat menu malam" (or "Selesai" on the last part).
  - Navigation: it never advances by itself. Tap the right half or the button for the next part, tap the left half for the previous one, swipe down or press close to dismiss.
  - A day with only one meal has one segment. A meal whose menu is not set shows the package photo and "Menu belum diisi oleh {katerer}".
- **Before and after cutoff** (keeps interview decision 10): before the change cutoff, the Beranda circles show the dish photos and the story opens directly. After the cutoff, each circle shows a covered plate until that meal's part has been viewed once. Viewed state is stored per delivery in SecureStore. Opening the story is the unveil; there is no separate dome animation.
- **Jadwal** (canvas: E · Jadwal):
  - Month grid in the mood header. A covered day shows the lunch dish photo, falling back to dinner, then to the package photo, with the day number in a cream pill and a forest moon badge when dinner is also covered.
  - Today has a sunrise-ink ring and the selected day a forest ring. Past days are dimmed to 50% with a forest number pill. A covered day whose menu is not set has the dashed `markerIdle` border and a sun mark.
  - Legend: "Foto menu", "Menu belum diisi", "Ada makan malam". The selected day's meals are listed below with "Ubah hari".
  - Loading and error states stay text, and unknown data is never shown as uncovered.
- **Jelajah** (canvas: E · Jelajah): mood header with area, headline, Siang/Malam meal buttons and search; a horizontal row of photo category circles (the selected one ringed); package rows with a large photo, name, caterer and days, start date, and price with "/ sekali makan".
- **Other customer screens** (canvas: D2 customer row: Detail paket, Beli, Pembayaran diterima, Hari, Akun): adopt the mood header at the 28 radius, theme tokens and the new card radius. No layout changes beyond those already approved in the October 8 spec.

### 5.2 Catera Dapur
- **Hari ini, cooking** (canvas: E · Dapur masak):
  - Mood header: kitchen name, date button, toggle, and a count card with the session's portions and addresses, delivery time and the rantang track.
  - "Daftar masak": one row per dish with photo or meal icon, quantity (`heading`, tabular), name and a 48dp round checkbox. A ticked row dims and is struck through. Rows come from the existing `kitchen.ts` recap, never from invented dishes.
  - The ticks are a kitchen note: stored in SecureStore per caterer, date and meal, cleared after that date, never sent to the server. The screen says so: "Centang hanya catatan dapur, tidak dikirim ke pelanggan."
  - Sticky action above the tab bar: "Mulai masak" while the session is scheduled; then "Berangkat antar · {n} porsi" with "{n} pelanggan dapat notifikasi saat kamu berangkat." Ticks never gate either action.
- **Hari ini, delivering** (canvas: E · Dapur antar):
  - After departure the header reads "Sedang diantar" and the track shows "Berangkat {jam}".
  - "Urutan antar" lists the existing `stops` in order: number, customer name and portions, address on one line, and a 48dp map button (`mapsUrl`). The first three are shown, with "Lihat {n} alamat lainnya" for the rest. "Buka semua di Peta" and the existing "Bagikan rute ke WhatsApp" stay.
  - Below: "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah." and "Laporkan masalah", which opens the existing report flow. There is no per-stop tick, because V1 records arrival automatically.
- **Semua beres** (canvas: Dapur · Semua beres): the existing done state takes the mood header and the light tab bar.
- **Menu** (canvas: E · Dapur menu):
  - Mood header with the week range, toggle and a five-day strip. Each day is a 64-high button with weekday, date and a check when that day's menu is filled. Today has a sunrise-ink ring and the selected day a forest fill.
  - The day card lists dish rows by role. A dish without a photo shows a dashed camera tile and a "Tambah foto" pill, using the existing `uploadPhoto`. The nudge never blocks saving.
  - A preview card shows the story cover as customers will see it, with the caption that menus without photos use the package photo.
- **Pelanggan, Usaha** (canvas: D2 Dapur row): mood header and theme tokens only.

## 6. Shared components (`packages/mobile-ui`)

| Component | Purpose | Notes |
| --- | --- | --- |
| `ThemeProvider`, `useColors()`, `useThemePreference()` | Resolves `nativeThemes[scheme]` from the stored preference, falling back to `useColorScheme()` | Replaces direct `colors.*` reads in app code; the preference hook backs the Tampilan row |
| `themedStyles(factory)` | Builds a `useStyles()` hook that memoises `StyleSheet.create(factory(palette))` per theme | Replaces module-level `StyleSheet.create` that read `colors` |
| `MoodProvider`, `useMood()` | Mood state and setter, launch default | One per app root |
| `useMoodColors()` | `nativeMood[theme][mood]` | Only mood surfaces may call it |
| `MoodHeader` | Rounded header block with title slots, optional toggle, optional arc, optional Malam pattern | Cross-fades its fill on mood change |
| `MoodToggle` | Siang/Malam tablist | `PressableScale` + `select` haptic |
| `DayArc` | Arc track, progress stroke, sun and moon markers | Decorative; marker slides on mood change |
| `RantangTrack` | Three stops plus the rantang marker and labels | Stage from domain `journey`; see 6.1 |
| `PhotoRing` | Ringed circular photo, optional covered state | Used by Beranda and Jelajah |
| `StoryViewer` | Segmented full-screen viewer with tap zones and swipe-down close | No autoplay |
| `CalendarPhotoCell` | Photo day cell with number pill, moon badge, today and selected rings, dimmed past, dashed not-set | Jadwal |
| `CheckRow` | Photo or icon, quantity, name, 48dp checkbox | Dapur checklist |
| `StopRow` | Number, name, address, map button | Dapur delivery order |
| `StickyAction` | Footer action above the tab bar with an optional caption | Respects the 760 cap and safe area |

### 6.1 Rantang track truth
Stages come from the fulfilment status, never from the clock.

| Status | Marker | Labels |
| --- | --- | --- |
| `scheduled` | At the first stop, shown as an outline (not filled) | "Terjadwal" |
| `preparing` | At the first stop | "Dimasak {cookingAt}" |
| `out_for_delivery` | At the middle stop | "Berangkat {departedAt}" |
| `delivered` | At the end | "Sampai" (caterer-confirmed), or "Tercatat sampai" when recorded automatically |
| `issue` | Marker stays where it was | The existing issue message replaces the labels |

The track is identical in both apps, so what the kitchen taps is what the customer sees.

## 7. Motion

All timings come from `nativeMotion`: control 120, selection 180, content 220, feature 320, ease `(.16, 1, .3, 1)`. Only transform and opacity animate; mood colour cross-fades are an opacity swap of two stacked fills. Under reduced motion every item below changes instantly.

| Moment | Motion |
| --- | --- |
| Mood switch | Header and hero fills cross-fade (content 220); arc marker travels along the arc to the other end (feature 320); toggle pill slides (selection 180); `select` haptic. Body and tab bar do not move or change. |
| Rantang stage change | Marker slides to the next stop (feature 320), only when the stage actually changes while the screen is visible; it never pulses or loops. On first render it sits in place. |
| Open Menu besok | The tapped ring scales up into the full-screen story (feature 320); parts change with a content fade (220). |
| Checklist tick | Circle fills (control 120); row dims and strikes through (content 220); `tap` haptic. |
| Mulai masak / Berangkat antar | Confirm first; on success, the marker slides and a `success` haptic fires; the checklist swaps to the delivery order with `FadeSwap`. |
| Calendar, lists, catalogs | No entrance animation and no stagger (unchanged rule). |

## 8. Data and backend dependencies

Carried over unchanged from the October 8 spec, Phase 2 (not yet built):
- `delivery.cook` migration and command, `cooking_started_at`, `v1.delivery()` exposure, demo guard, tests and Postgres races.
- Wiring the existing `delivery.depart` into Dapur.
- Domain `PlateState "scheduled"`, `Plate.journey`, `tomorrowReveal`, `UpcomingRow.image`, `kitchenSession`, `kitchenDayDone`.
- The usage counts (`reveal_unveiled` is renamed `tomorrow_story_viewed`; the rest are unchanged).

New in this spec:
- Calendar day coverage gains `image` (dish photo, then package photo) and `menuSet: boolean` per meal, so Jadwal can tell "menu not set" from "no photo".
- Tomorrow-menu data for the story: per meal, the dish name, sides, caterer, window, image or package image fallback, `menuSet`, and the change deadline. This comes from the same source as `tomorrowReveal`.
- No new tables. Checklist ticks and viewed-story state stay on the device.

Contrast test: `tests/native-contrast.test.ts` computes WCAG ratios for every text-on-fill and state-icon pair in `nativeThemes` and `nativeMood` (all four combinations) and fails below 4.5:1 for text or 3:1 for state icons and control boundaries. Dark values marked "test" are chosen to pass it.

## 9. Phases

Each phase ends with an emulator review of both apps in demo mode, light and dark, Siang and Malam.

- **Phase A, theme foundation:** theme tokens and the contrast test; `ThemeProvider`, `useColors`, `themedStyles` and the Tampilan row in Akun and Usaha; migrate the 72 native files that read `colors.*` (forest 106 reads, danger 71, muted 58, and so on); a guard test forbidding `colors.*` imports in app sources; `userInterfaceStyle: "automatic"`; status bar handling. No visual change in light mode is expected; dark mode becomes usable everywhere.
- **Phase B, mood identity:**
  - Mood tokens, `MoodProvider`, `MoodHeader`, `MoodToggle`, `DayArc`, the brand SVGs and the `display` variant.
  - Mood header on every screen and the Beranda hero card.
  - Jelajah circles and rows; Jadwal photo calendar, including the domain `image` and `menuSet` fields.
  - The Dapur header with the date button and toggle; the Dapur Menu week strip, photo prompt and story preview.
- **Phase C, daily loop:**
  - October 8 Phase 2 backend and domain.
  - `RantangTrack` in both apps; the Menu besok story with before- and after-cutoff behaviour.
  - Dapur cooking checklist, Mulai masak and Berangkat antar, delivery order and done state.
  - Usage counts.
- **Phase D, purchase and renewal beats:** October 8 Phase 3 (plan detail, "Paket selesai", payment success) built with the new header, hero and motion vocabulary.

## 10. DESIGN.md changes (land with Phase A and B)

- New "Native mood and theme" section: the two axes, mood surfaces only, the tab bar fixed, the launch default, the token tables and the contrast rules.
- Colors:
  - Dark theme values.
  - The note that dark body is neutral charcoal and brand green appears only in the Malam header, hero and accents.
  - The `markerIdle` and `controlRing` corrections.
- Shapes: mood header 28/32, hero 28 (photo 20), content cards 20.
- Typography: the `display` variant.
- Navigation: Dapur Hari ini / Besok becomes a date button.
- Brand objects: the day arc, rantang and Malam pattern are code-drawn interface objects, not generated artwork.
- Native motion: the moments in section 7.
- Customer meal calendar (native): the photo cells replace the sun and moon icon cells. The coverage model and truthful states stay.
- Record the owner decisions of 2026-10-09 in a dated section.

## 11. Out of scope

Web parity; time-driven mood switching; floating tab bars; colours sampled from photos; transparent or cut-out artwork; streaks, badges and ratings beyond the existing `ReviewPrompt`; per-stop delivery confirmation; story autoplay; mascot animation.

## 12. Verification

- `npm run typecheck`, `npm test`, `npm run build`, native jest for both apps, and `npm run test:postgres` from Phase C.
- `tests/native-contrast.test.ts` green for every theme and mood pair.
- Emulator review: `CATERA_V1_DEMO=true npm run dev`, Metro per app with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.
  - Capture every touched screen in four looks into `output/native-review/visual-{phase}/`.
  - Switch the system theme with `adb shell cmd uimode night yes|no`.
  - Check reduced motion with `settings put global animator_duration_scale 0` plus the system "Remove animations" setting, and check TalkBack labels on the toggle, story, checklist and stop rows.
- Phase C end-to-end:
  - Dapur taps Mulai masak: the customer track shows Dimasak (after a reload; demo has no realtime).
  - Berangkat antar: the track shows Berangkat.
  - After cutoff: the Beranda circles are covered until the story part is viewed.
- `npx expo install --check` for `react-native-svg`, Reanimated and haptics against SDK 57 Expo Go.

## 13. Risks

- **Phase A touches 72 files.** It is mechanical but wide. Mitigation: the codemod-style migration lands first with the guard test, before any visual change, and light-mode screenshots must match the Phase 1 baseline.
- **Photo calendar density at large text sizes.** At the largest font scale, the number pill may cover most of a 47-wide cell. If it does, the cell falls back to the number with a small photo dot. Verify at font scale 1.3.
- **Story without autoplay** relies on users finding the tap zones. The visible "Lihat menu malam" button is the primary path; tap zones are a shortcut.
