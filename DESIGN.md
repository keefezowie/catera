---
name: "Catera V1"
description: "Good Food on Repeat."
colors:
  forest: "#163D2E"
  forest-hover: "#25553F"
  sunrise: "#F47B2A"
  sunrise-ink: "#9B4309"
  cream: "#FFF7E9"
  charcoal: "#2E2E2E"
  surface: "#FFFEFA"
  canvas: "#FDFAF3"
  sage: "#F0F3E9"
  muted: "#60675F"
  line: "#E2E3D8"
  danger: "#A33024"
  focus: "#B65B13"
  field-border: "#CFD3C6"
  secondary-border: "#CDD4C4"
  scheduled-bg: "#EDF1E6"
  scheduled-ink: "#4F6445"
typography:
  headline:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 750
    lineHeight: 1.22
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "24px"
    fontWeight: 750
    lineHeight: 1.22
    letterSpacing: "-0.025em"
  subheading:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "17px"
    fontWeight: 750
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.6
  button:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.6
  button-small:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.6
  status:
    fontFamily: "Jakarta, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  status: "5px"
  navigation: "8px"
  field: "9px"
  control: "10px"
  panel: "12px"
  surface: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.cream}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.sage}"
  button-cream:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.forest}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.button-small}"
    padding: "10px 0"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  nav-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.cream}"
    rounded: "{rounded.navigation}"
    padding: "11px 13px"
  chip-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.cream}"
    rounded: "{rounded.field}"
    padding: "10px 18px"
  status-scheduled:
    backgroundColor: "{colors.scheduled-bg}"
    textColor: "{colors.scheduled-ink}"
    typography: "{typography.status}"
    rounded: "{rounded.status}"
    padding: "4px 8px"
  package-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.surface}"
  meal-agenda:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.surface}"
    padding: "28px"
---

# Design System: Catera V1

## Package discovery and dish photography — September 10, 2026

Discovery cards group the package cover, seller/package identity, delivery commitment and meal preview, then price/delivery/actions. Seller identity is readable and semibold; duration has a distinct anchor. Component counts replace exhaustive ingredients on cards. À la carte uses the explicit dish count; legacy menus remain unsplit. The labeled comparison action lives beside “Lihat paket”; “Lihat isi paket” links to the selected meal in details.

Combined offers always identify both meals. Siang/Malam controls preview one meal's contents without changing the offering. Optional package nutrition uses four icon/label/value positions with explicit units, fixed values or minimum–maximum ranges, unavailable marks for missing values, genuine zeroes, and a per-meal-portion caterer-estimate caption. Source labels distinguish example and dated menus.

Package details use a two-column included-dish gallery, collapsing on narrow screens or enlarged text. Photos retain dish names, serving amounts, descriptions and component labels; missing/failed photos leave text entries. A single dish matching the cover has a photo-viewing link instead of a duplicate large image. Enlarged photos use contain sizing and accessible close/focus behavior. Checkout and purchased-menu renderers retain their existing presentation. The palette, Jakarta typography and supplied artwork are unchanged.

Responsive browser evidence and verification notes are recorded in `output/package-presentation/` and `docs/PACKAGE-CONTENTS.md`. This is local verification, not a hosted release or physical-device certification.

## Overview

**Creative North Star: "Delivery cycle"**

Catera makes recurring meals feel tangible, warm, and organized. Food photography carries discovery; the rounded illustrated wordmark and occasional bento mascot add personality. Forest actions, cream fields, and a clear Jakarta hierarchy connect the customer experience to quieter, denser seller and platform-admin workspaces. Indonesian is the primary interface language; preserve the name Catera and the tagline “Good Food on Repeat.”

This records the built September 9, 2026 V1 marketplace world. The code-first direction is already approved; there is no page comp or new concept-selection step. PRODUCT.md provides the current product baseline, while docs/V1-UI-BRIEF.md owns surface composition. The archived pilot design is historical evidence and does not steer new V1 screens.

Ground truth is the [shared tokens](packages/design-tokens/src/index.ts), the complete cascade in [web global styles](apps/web/src/app/globals.css), [web components](apps/web/src/components), [native UI source](packages/mobile-ui/src/components.tsx), and the [brand package](packages/brand/README.md). The frontmatter records reused implemented web primitives; the sidecar adds previews and extensions. This is documentation of the local build, not a release certificate.

**Key Characteristics:**

- Food photographs lead discovery; brand illustrations appear at supporting moments.
- Warm surfaces, forest emphasis, and a compact, expressive sans-serif hierarchy.
- Daily meal context stays legible alongside quieter subscription and operational lists.
- Text names states and actions; color supports their meaning.
- Web and native share identity assets while retaining their implemented platform-specific dimensions.

## Colors

The identity combines botanical forest, sunrise warmth, cream paper, and charcoal text. The frontmatter is normative; its CSS names map to shared tokens (`charcoal` → `--ink`, `sage` → `--soft`). Web layout injects the shared variables. Semantic status tones remain specific to their states.

### Primary

- **Forest** anchors headings, primary actions, selected controls, and the editorial meal introduction.
- **Forest hover** is the implemented primary-button hover tint.
- **Sage** supplies quiet supporting surfaces, the daily agenda, and secondary-control hover.

### Secondary

- **Sunrise** supplies small brand accents and the desktop navigation marker. Its darker ink companion keeps small accent text accessible on quiet surfaces. Sunrise is not the default action fill.
- **Cream** supplies warm identity fields and text on forest actions. It is distinct from the paler content surface and canvas.

### Neutral

- **Charcoal** is the default text color; **Muted** supports secondary copy and current input/textarea placeholders.
- **Canvas** is the customer page ground; **Surface** is the content and field fill.
- **Line**, **Field border**, and **Secondary border** separate content, fields, and secondary actions.
- **Scheduled background / ink** forms the quiet default status pair. Pending states use warm amber; issue states use warm red; cancelled/draft/paused states use neutral tones; completed/paid/approved/resolved states use green.
- **Danger** supports errors and destructive meaning; **Focus** is the warm outline used for keyboard location.

Operations locally use a cooler warm-neutral canvas (`#F5F6F1`), near-white sidebar (`#FCFCF6`), and top bar (`#FCFCF7`). These are scoped operational surfaces, not replacements for the approved palette.

**The Food First Rule.** Use meal photography for food discovery and the next-meal focal point; keep the mascot as supporting brand warmth.

The sidecar’s eight-step OKLCH strips are synthesized panel aids, not additional runtime colors. The app does not define a complete tonal ramp; retain the canonical CSS/TypeScript colors rather than copying preview swatches into production.

### Native dark theme

**Superseded in part by colour direction K (Phase G, October 13, 2026):** in light, `canvas`, `line`, `muted`, `tabBar` and `tabIndicator` changed and no longer equal the web values (light `surface`, `forest` and `forestDeep` still do); in dark, all eight of `canvas`, `surface`, `line`, `muted`, `tabBar`, `tabIndicator`, `forest` and `forestDeep` changed. The table below is the October 9 record; the values in use are in Colour revision (Phase G), October 2026.

The native apps have a real dark theme, defined as `nativeThemes.dark` beside `nativeThemes.light` in `@catera/design-tokens`. Both palettes use the same keys as the web `colors` plus `controlRing`, `tabBar`, `tabIndicator` and `disabledFill`; light reuses the web values unchanged, and the four added keys are native only. The keys name roles by their light-mode hue, so dark mode inverts the forest and cream pair: forest (headings, selected fills, primary buttons) becomes cream-white, and cream (text on forest, the attention card) becomes forest. A primary button is therefore a cream fill with forest text in dark mode. The dark body is neutral charcoal, never dark green: brand green appears only where the inverted `cream` role puts it, such as the attention card.

| Key | Light | Dark |
| --- | --- | --- |
| `forest` | `#163D2E` | `#FFF7E9` |
| `forestDeep` | `#0C2C20` | `#E9E3D6` |
| `sunrise` | `#F47B2A` | `#F47B2A` |
| `sunriseInk` | `#9B4309` | `#F5C9A6` |
| `cream` | `#FFF7E9` | `#163D2E` |
| `charcoal` | `#2E2E2E` | `#F5F1E8` |
| `surface` | `#FFFEFA` | `#232321` |
| `canvas` | `#FDFAF3` | `#151514` |
| `sage` | `#F0F3E9` | `#2A2D27` |
| `scheduled` | `#EDF1E6` | `#26302A` |
| `muted` | `#60675F` | `#B5B2AA` |
| `line` | `#E2E3D8` | `#34332F` |
| `fieldBorder` | `#CFD3C6` | `#7A7872` |
| `secondaryBorder` | `#CDD4C4` | `#4A4944` |
| `attentionBorder` | `#F3DFC3` | `#4C3322` |
| `danger` | `#A33024` | `#FF8F80` |
| `controlRing` | `#858D80` | `#8A8780` |
| `tabBar` | `#F2ECDF` | `#1E1E1C` |
| `tabIndicator` | `#BFD8BB` | `#163D2E` |
| `disabledFill` | `#CFD3C6` | `#34332F` |

`controlRing` is new and is the intended colour of the unchecked-box ring and the dashed "not set" cell border, the only cue for those controls. The Dapur checklist box (`CheckRow`) and the dashed photo tile in Dapur Menu read it; the Jadwal "not set" cell sits on the mood header and keeps `markerIdle`. Light measures 3.40:1 on `surface` and dark 4.39:1. `tabBar` does not change with mood. Its light value `#F2ECDF` (Phase E ruling) is one tonal step below the canvas (1.13:1), where Material 3 puts the navigation bar, and is the value on the owner-approved canvas; the earlier `#FFFEFA` sat about 1.03:1 off the canvas with no border. `tabIndicator` is the Android pill behind the selected tab icon. `disabledFill` is new and is the fill of a disabled primary button, so the `muted` label on it reads: dark `#34332F` gives 5.97:1 (the `fieldBorder` it replaced gave 2.08:1), and light equals the old `fieldBorder` grey `#CFD3C6` at 3.83:1, unchanged, so no light pixel moves. Measured on October 9, 2026: dark `forest` on `surface` 14.79:1, dark `sunriseInk` on `surface` 10.34:1, dark `charcoal` on `surface` 13.97:1, dark `muted` on `surface` 7.43:1, dark `danger` on `surface` 7.12:1, dark `cream` against `forest` 11.33:1.

Contrast rules, enforced by `tests/native-contrast.test.ts`: text at least 4.5:1 on its own fill, and `controlRing` at least 3:1 on `surface`, and the `muted` disabled label on `disabledFill` at least 4.5:1 in dark (light keeps its existing 3.83:1, asserted at 3.8). The tab bar's rules: the `muted` and `forest` labels at least 4.5:1 on `tabBar`, because they are small text (light 4.95:1 and 10.25:1, dark 7.88:1 and 15.69:1); unselected icons at least 3:1 on the bar; the selected icon at least 3:1 on `tabIndicator` (7.90:1 light, 11.33:1 dark); and the pill at least 1.25:1 off the bar in both themes (1.30:1 light, 1.38:1 dark). The pill needs no 3:1 because it is not the only selection cue: the filled glyph and the forest label carry it too. `fieldBorder` and `secondaryBorder` are not enforced, because their controls also carry a label and a fill; light `fieldBorder` measures 1.51:1, a gap that predates dark mode and is left for a later pass. Decorative strokes are exempt. Native sources read these values through `useColors()` or `themedStyles` from `@catera/mobile-ui`; no native source imports `colors`. The fixed surfaces that must not invert (the Plate photo scrim and the Sunrise button) read `nativeThemes.light` keys by name. A theme change is not animated.

## Typography

**Display Font:** self-hosted Plus Jakarta Sans, registered as `Jakarta` on the web with a sans-serif fallback.

**Body Font:** the same self-hosted Jakarta face. The variable WOFF2 supports weights 200–800. Android cannot select weights from a variable TTF, so native registers five static TTFs through `fontAssets` in `@catera/mobile-ui`: `Jakarta` (400), `Jakarta-Medium`, `Jakarta-SemiBold`, `Jakarta-Bold` and `Jakarta-ExtraBold`. `fontFor(weight)` maps a CSS-style weight to its family and native `Text` applies it; an explicit `fontFamily` wins over a weight, and native app source never writes `fontWeight` directly. See the [font provenance](packages/brand/manifest.font.json).

**Character:** rounded, clear interface lettering with firm 750-weight web headings and tighter headline tracking. The illustrated wordmark remains an image asset. Normal UI copy stays sentence case; operational numbers use tabular figures.

### Hierarchy

The frontmatter records the reused base web hierarchy: fluid headline, title, subheading, body, label, button, compact button, and status. Body line-height is spacious relative to the compact label sizes; heading descriptions cap at 65ch and ordinary page headlines at 24ch.

The marketplace’s display headline is a surface-specific expression: `clamp(38px, 4.3vw, 62px)`, weight 750, line-height 1.07, tracking −0.04em. Its cascade resolves to 50px at 1150px, 43px at 800px, and 30px at 560px and below. Keep that ramp local to the hero. Section headings use 26px; package titles use 19px on wide screens, 17px in the intermediate layout, and 22px in single-column phone cards.

Native uses its own reusable ramp, shipped as the `Text` variants in `@catera/mobile-ui`. It differs from the web and from the exported suggested typography values:

| Native role | Size / line-height | Family (weight)           | Tracking |
| ----------- | ------------------ | ------------------------- | -------- |
| Title       | 30 / 39            | `Jakarta-Bold` (700)      | −0.8     |
| Heading     | 21 / 28            | `Jakarta-Bold` (700)      | −0.4     |
| Body        | 14 / 23            | `Jakarta` (400)           | normal   |
| Label       | 12 / 23            | `Jakarta-Bold` (700)      | normal   |
| Small       | 11 / 18            | `Jakarta` (400)           | normal   |
| Number      | 40 / default       | `Jakarta-ExtraBold` (800) | −1       |

Number uses tabular figures, as does every operational number in native source. These are React Native style values, not measured device pixels, so they do not establish rendered parity with the web. Shared exports still suggest body 16, small 14, title 24, and heading 32; the native styles do not consume that scale, and it must not silently replace the built ramp.

**The One Interface Family Rule.** Use the self-hosted Jakarta face for interface text. Keep the illustrated wordmark separate from live UI typography.

## Layout

Customer web uses centered containers up to 1320px with 44px wide-screen side padding. Intermediate padding steps are 28px at 1150px and 24px at 800px; phone catalog/content and toolbar/hero use 18px gutters. Reused spacing steps live in the frontmatter, but the CSS also uses observed 18px, 20px, 22px, 26px, and 28px adjustments; this is not an enforced single-grid implementation.

The discovery grid is three columns, two at 800px, and one at 560px. Cards retain generous food images rather than shrinking into tiny tiles. A split forest-and-food hero remains split on phone through the final cascade. The phone sparkle is hidden to preserve headline clearance. The surface brief owns this composition.

Customer home places the next meal beside the lunch/dinner agenda in a 1.5:1 grid, changing to 1.4:1 at 1150px and one column at 800px. Items align at the start; the meal card does not stretch to unrelated content. Flat subscription rows follow the meal and agenda; the home-specific subscription override remains flat at all widths.

Seller and admin workspaces use separate navigation on a 244px sidebar, narrowed to 215px at 1150px. At 800px it becomes a 250px off-canvas drawer. Operational content has a 1600px maximum width and 34px initial padding. Tables retain horizontal overflow where necessary. Compact phone metrics form two columns; master/detail work exposes the selected item’s detail in the available width.

Desktop customer navigation hides at 800px; the fixed five-destination customer bottom navigation is enabled at 560px, including safe-area padding. Do not infer a bottom bar at all tablet widths. Native uses four customer tabs (Beranda, Jadwal, Jelajah, Akun) and four role-gated Dapur tabs (Hari ini, Pelanggan, Menu, Usaha), safe-area containers, keyboard handling in the shared `Screen` (on iOS the scroll view insets itself through `automaticallyAdjustKeyboardInsets`, and a padding `KeyboardAvoidingView` lifts only a footer, with its offset taken from the screen's own measured window position, so the header and the demo strip above it are counted), a scroll body and footer centered and capped at 760 wide (body 20 side padding, footer 16; on iOS the footer also pays the bottom safe-area inset, so a sticky action clears the floating tab bar), and each platform's own navigation chrome (see Native navigation and chrome).

The sidecar records the actual media-query boundaries: 1150px, 800px, 560px, and a wide-screen adjustment from 1500px. These are implementation breakpoints, not device certification.

## Elevation & Depth

Depth is mostly tonal: light borders frame surfaces while open rows and separators organize denser information. Food cards gain a faint forest-tinted shadow on hover. Floating feedback, comparison controls, and dialogs receive stronger separation. Native base panels rely on borders and fill; the sampled native primitives do not define an elevation ramp.

### Shadow Vocabulary

- **Feedback:** `0 14px 38px #163d2e12`, the shared web shadow used for toast feedback.
- **Package hover:** `0 12px 28px #163d2e10`.
- **Floating comparison:** `0 8px 40px #163d2e35`.
- **Dialog:** `0 20px 70px #0b201f30`, paired with a `#14291fd0` overlay.

**The Quiet Work Rule.** Use borders and tonal surfaces for ordinary content; reserve stronger depth for floating feedback and modal layers.

Button background changes take 180ms; the common easing is `cubic-bezier(0.16, 1, 0.3, 1)`. Card shadows transition over 300ms, food hover scaling over 500ms to 1.025, and the operational drawer over 250ms. The reduced-motion media query disables animation, transitions, and smooth scrolling.

## Shapes

Shapes are gently rounded and defined by purpose. The frontmatter separates 9px fields and meal filters, 10px action controls, 12px operational panels, and 16px larger content surfaces. Small statuses use 5px; operations navigation uses 8px. Icon controls are circular.

The web dialog is actually 16px despite the shared package’s unused 20px dialog export. Native panels are 14, native inputs 9, native buttons 10, and native chips/quantity controls 8. Keep these platform differences explicit; do not record the unconsumed shared radius as built behavior.

Food photographs use cover clipping inside their frames; wide package imagery has an aspect ratio of 1.62 and phone imagery 1.65. Brand compositions retain their full image and intrinsic aspect ratio. The app-icon source is a full square; the operating system owns its final mask.

## Components

### Buttons

Solid and clearly actionable. Primary buttons use forest with cream text, a 48px minimum height, and the frontmatter padding and radius. Secondary buttons are transparent with a light border; cream buttons invert the forest field. The compact variant uses a 44px minimum height and 10px 16px padding. Text buttons are transparent and underline on hover.

Primary hover uses forest-hover; secondary hover uses sage; cream hover uses `#FBE6C8`. Global keyboard focus is a 3px Focus outline with 4px offset. The shared focus export contains an offset of 3, but the built web CSS uses 4px. Disabled controls have 0.5 opacity and no pointer interaction. Native buttons, including text buttons, have a 48 minimum height and 18 horizontal padding (text buttons 4). A disabled native primary button turns to the Field border fill with Muted text; a disabled secondary or text button has no fill to grey out, so it fades to 0.45 opacity. Disabled native buttons fire no haptic. The pressed dim multiplies a control's own resting opacity, so a disabled button keeps its 0.45 (and a disabled sunrise button its 0.6) under reduced motion.

### Inputs / Fields

Quiet near-white fields have a light stroke, rounded corners, and a 44px web minimum height. The generic input inherits body type; inputs inside the existing field wrapper inherit its 12px size. Labels use forest. Input and textarea placeholders use the current Muted token. Search has a 2px forest focus-within outline with a 2px offset and suppresses the inner input outline to avoid a double ring. Ordinary fields retain global keyboard focus.

Native inputs have a 48 minimum height, 14 horizontal padding, the Field border (`fieldBorder`, `#CFD3C6` in light and `#7A7872` in dark), and the Surface fill; an error turns the border Danger. A caller's `style` (the multiline reply and report fields set a minimum height and top alignment) extends this base style rather than replacing it, so the border, fill and ink stay themed. Field border and Secondary border are tokens in `@catera/design-tokens` (`fieldBorder`, `secondaryBorder`), as is `attentionBorder` (`#F3DFC3`), the warm edge of the cream attention card. Native sources take every colour from the active theme (`useColors()` or `themedStyles`, see the native dark theme under Colors) rather than literal hex values, with named exceptions: the QRIS code's pure-white quiet zone, which scanners need, and translucent `rgba` fills for the sheet scrim, the Plate photo overlays and the step rows on the Dapur setup card. Forms keep error messages near the action; button loading states use a spinner and explicit saving text.

### Dialog focus and continuity

Shared dialogs retain a visible location throughout review, pending work, and dismissal. The optional `initialFocus="title"` starts a consequential review on its programmatically focusable heading; otherwise confirmation dialogs retain their safe-action focus default. When a pending operation disables the active control or leaves focus on the document body, focus moves to the dialog title. Pending dialogs retain their layer and block dismissal.

The optional `fallbackFocus` identifies a logical heading or outcome when the original opener is unavailable. Dismissal first tries the recorded opener chain, then this fallback, accepting only connected, visible, enabled targets outside inactive or closing layers. Restoration waits for closing layers and yields to a newer user focus choice. It preserves the current scroll position unless the restored target is vertically outside the viewport, then reveals it with nearest-edge instant scrolling. Focused titles, recovery notices, and fallback headings keep the established visible Focus outline.

**The Focus Continuity Rule.** Keep focus in the current task during pending work, and return it to an available opener or a visible logical continuation when the dialog closes.

The [October 6 landscape record](docs/V1-LANDSCAPE-OPTIMIZATION.md#desktop-task-continuity-refinement--october-6-2026) owns the package, attention drawer, rescheduling, and receipt surface details; these do not introduce new global tokens.

### Date picker

Web date fields use the shared `DatePicker` component instead of the browser-native date control. Its anchored popover uses a Monday-first month grid, Indonesian-first month and weekday labels, explicit previous/next-month controls, a “Hari ini” shortcut, min/max date constraints, and complete arrow-key, Home/End, and Page Up/Page Down navigation. The compact variant belongs in operational toolbars; the standard variant fills a form field and submits an ISO `YYYY-MM-DD` value through its `name` prop. Keep date selection in this component so browsers do not introduce a second visual language.

### Chips / Status

Meal filters are outlined 44px-minimum controls, filled forest with cream text when selected. Native chips, segmented options, text buttons and stepper buttons have a 48 minimum height. Queue filters visibly name “Semua katerer” and “Menunggu tinjauan”; the pending-empty view states the absence of work and directs the user to all caterers.

Statuses are compact, rounded text tags with a small dot and semantic tone. They are read-only indicators, not pills that replace action controls.

The reserved days on the native payment success screen are plain read-only tags, not chips (controller ruling on Phase D Task 5: a non-control must not borrow a control's outline). Each tag has the theme `sage` fill, no border, radius 8 with `borderCurve: "continuous"` and padding 10 by 2; its label is the regular `body` text in theme `charcoal`, tabular and selectable. Tags are not pressable and do not take the 48 minimum height of native chips. Charcoal on sage measures 12.09:1 in light and 12.39:1 in dark (`apps/customer/src/buy/PaidOutcome.tsx:94-109, 143-145`; evidence: `buy.test.tsx` "shows the food, the package, the first delivery and every reserved day of a short plan" and "the reserved-day tags read the dark theme's sage fill and ink").

**The Truthful State Rule.** Pair state color with explicit text, and make the selected filter and its empty result visible. Unavailable choices carry a visible reason: native delivery-date chips caption a blocked day “Penuh” or “Terisi” instead of only dimming it.

**Delivery stages follow the kitchen, never the clock.** The customer's plate state and the domain's journey rule read a meal's fulfilment status and timestamps. A meal that nobody has moved to cooking has the plate state `scheduled` and its plate sentence is "Terjadwal" ("Scheduled"); on the Beranda hero, when the window and address are known, the track says "Terjadwal" and the header is "Diantar {window} ke {address}" instead; "Sedang dimasak" ("Being cooked") is the plate sentence only for a meal the kitchen has moved to cooking. Once a meal's delivery window has started without a departure, a scheduled meal and a cooking meal alike turn `due`, and the plate says "Seharusnya sudah tiba" ("Should have arrived"). The journey caption ("Terjadwal", "Dimasak" and the others, see the table below) is a separate line from the plate sentence and also reads the status only: it never changes with the clock. The customer plate sentence is built and shows on the customer app today. The journey caption and its track are on the Dapur count card (Task 8) and on the Beranda hero (Task 6); the Dapur customer detail still labels every status other than delivered and "Gagal diantar" as "Terjadwal".

### Cards / Containers

Package cards combine food, caterer identity, explicit terms, price, and action. Their body padding is 20px on wide screens and phone, 16px at the intermediate breakpoint. The image hover is restrained; card boundaries remain light. Operations panels use 24px padding and 12px corners with no ordinary raised shadow.

Customer-home subscriptions are flat rows inside one outlined container, with separators and small food thumbnails. That rule belongs to the home hierarchy; other subscription/detail surfaces retain their existing bordered cards where present.

### Discovery and purchase clarity

The [September 19 UX research](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/UIUX-RESEARCH-2026-09-19.md) records the comparative evidence and responsive acceptance checks. Discovery keeps selected filters in its URL, displays removable filter chips and a result count, and offers a complete reset for empty results. Reset retains delivery area and sort. Package cards place total price, the per-meal rate, and delivery coverage after the commitment summary, before detailed contents.

**The Price Unit Rule (web and native).** A per-meal price always carries its unit, “/ sekali makan” (“/ meal”), and a combined lunch-and-dinner offer adds “2 kali makan / hari” (“2 meals / day”), because one portion of a combined offer covers both meals. Never label that number “per porsi” or show it bare. Seller screens are the carve-out: the Dapur price field “Harga per porsi (Rp)” and its package line enter and show the daily price of one portion (which for a combined offer covers both meals), not a per-meal rate; the customer renewal row in “Menunggu Anda” names that same number “harga terakhir {Rp} per porsi”, because a renewal is quoted again at today's price.

Checkout shows the selected package and a labeled base subtotal before the form on phone and beside it on desktop. Package contents remain available in a disclosure. Review displays the selected delivery address and the server-confirmed total; the same total accompanies the payment action. Only one progress step is current, and changing steps focuses the new heading. Phone actions preserve bottom-navigation clearance.

On phone, the thumbnail stays beside the package identity while totals, explanations, and the contents disclosure use the full summary width. Checkout keeps the complete selected address visible beneath its selector and explains empty, stale, or out-of-coverage destinations. Payment availability distinguishes checking, failed lookup, and no available methods; an explicit retry preserves the reviewed order and consent and focuses its result. New explicit purchase choices take precedence over stored drafts. See [the September 24 journey quality record](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/MARKETPLACE-CHECKOUT-QUALITY-2026-09-24.md) for local evidence and limits.

Approved local food artwork and the wordmark may use responsive delivery derivatives while preserving the original files and compositions. Uploaded or signed image URLs retain their established delivery path. Derivative dimensions are not claims about master resolution or transparency.

### Navigation

Customer desktop navigation is compact, with a sunrise dot at the selected link. The phone bar has five labeled destinations; selected labels and icons become stronger forest. Operations use their own sidebar with a forest selected row, quiet hover, and a labeled workspace identity. Use consistent SVG interface icons; supporting brand illustrations do not replace operational icons.

Icons (native): Ionicons via `@expo/vector-icons`, chosen because the set ships with Expo, so both apps run in Expo Go without extra icon assets. Tab icons are outline until focused, filled when focused. State glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill itself carries the state; other interface icons are outline.

The native tab bar (both apps) is the platform's own, expo-router `NativeTabs`: the Material 3 navigation bar on Android and the system tab bar on iOS, at the height, insets and touch areas the platform gives it (see Native navigation and chrome). It uses the `tabBar` surface and the `tabIndicator` pill and does not change with mood. Date rows and other one-line summaries wrap instead of truncating when a status such as "Sudah sampai" is part of the line.

### Tampilan row (native)

**Superseded by Phase F (October 11, 2026):** the segmented control described here moved into Pengaturan as the Tampilan and Bahasa choice sheets, and Akun and Usaha no longer hold it (see Native polish (Phase F), Pengaturan). The storage, system-follow and `Appearance.setColorScheme` behaviour below is unchanged, and the custom bottom sheet it mentions was deleted.

Customer Akun and Dapur Usaha carry a "Tampilan" ("Appearance") row beside "Bahasa": a three-option segmented control with "Sistem", "Terang" and "Gelap" ("System", "Light", "Dark"). The customer row sits under a section label (also while signed out); the Dapur row sits under a label above "Keluar". The app follows the phone's system setting until the user chooses Terang or Gelap, and choosing Sistem returns to following it. The choice is stored on the device in SecureStore (`runtime.storageKey("theme")`, values `system`, `light` or `dark`, default `system`; an unknown stored value means `system`), applies at once without a restart, and survives relaunch. The choice is also handed to the system through `Appearance.setColorScheme` ("unspecified" for Sistem), so `Alert` dialogs, the window background and the iOS keyboard are meant to follow it instead of the phone's setting (the Android keyboard is drawn by another app and keeps following the phone; that limit is verified on the emulator, while the `Alert`, window background and iOS keyboard claims are not yet verified on a device), and the navigator reads its scene and card colours from the active palette. The bottom sheet's window reaches under the status and gesture bars (translucent) and the sheet pads its bottom by the safe-area inset, so the scrim covers the gesture band. The segmented control keeps the 48 minimum height of every native option.

### Meal agenda

The next-meal panel pairs a generous photograph with caterer, portions, date, time, address, and action. The adjacent sage agenda splits lunch and dinner into open rows with a meal icon, explicit details, and status. On phone it follows the next meal and precedes subscriptions. The sidecar’s agenda preview represents this existing pattern without introducing a new page layout.

### Customer meal calendar

The web customer schedule uses a continuous meal-coverage strip within a centered 1040px maximum-width column. A compact month control, “Hari ini”, and the next-delivery shortcut lead into the strip; the selected-week summary, “Per hari” / “Mendatang” control, and meal details align below it. Desktop date cells are fixed at 112px wide by 120px minimum height with 12px corners and 44px paging arrows outside the strip. At 650px and below, cells become 92px wide by 116px minimum height, the arrows disappear, shortcuts take a second row, and the summary and details lose their desktop 52px side inset. Horizontal overflow exposes the next partially visible date on phone. These are local calendar rules for the web strip. Native Jadwal adopts only its coverage model: a month grid whose covered days show a sun icon in Sunrise ink (`sunriseInk`) for lunch and a forest moon for dinner, both turning Muted once the meals have arrived, with the same truthful loading and error states; the strip layout, picker and “Mendatang” list are not adopted. The legend uses the same colours, and today is a Sunrise ink ring on cream. Native coverage marks use Sunrise ink rather than Sunrise because Sunrise measured 2.38:1 on the scheduled background and 2.56:1 as the today ring on cream, below the 3:1 minimum for state icons; Sunrise ink reaches 5.73:1 (owner decision, October 8, 2026, recorded under the native revisions below). Superseded in part on October 9, 2026: native Jadwal draws photo cells instead of these icon cells, with the same coverage model and the same truthful states (see Native mood and theme).

Today uses Jakarta's calendar date with a Sunrise dot and accessible dark-orange “Hari ini” label; selection uses a two-pixel forest ring without replacing coverage. Empty days remain transparent, while any covered day uses the quiet scheduled background. Covered cards use Sunrise sun and forest moon icons as their sole visual coverage cue, with both icons shown when both meals are covered; the former footer rail is removed. The package count sits alongside the icons, while the complete button description still names lunch and dinner for assistive technology. “Belum ada makan”, loading, and error remain visible text states and never claim coverage or a package count. Coverage counts each meal once per day, regardless of portions or multiple caterers; delivered meals count and cancelled meals do not. The summary names the Monday–Sunday week containing the selected date and counts covered lunch and dinner days separately.

Scrolling, paging, and extending the bounded 151-day strip preserve selection; extending its window preserves the first visible date and pixel offset. Clicking a visible date updates its details without repositioning the strip. The month label follows the visible range. Only explicit today, next-delivery, or picker jumps move the strip and selection together. Keyboard focus remains visibly outlined, and navigating focus does not select a date until activation.

The calendar's month control opens its own centered, lightly dimmed popover: a Monday-first six-week grid, previous/next month and year buttons, and an ISO `YYYY-MM-DD` text field with a “Lihat” submit action. The field is a text input; submission is enabled only for a valid supported date. The grid has one roving Tab stop: arrows move one day or week, Home/End move to the week's boundaries, Page Up/Down change month, and Shift with Page Up/Down changes year. Tab then reaches direct date entry; closing or selecting restores focus to the month control. Picker days have a 44px minimum height; at 380px and below the grid removes gaps and uses the available panel width. This dedicated coverage-calendar picker is separate from the shared form-field DatePicker described above.

Monthly loading and failures remain visible as ellipses or error marks with accessible state text; unknown data never appears as an uncovered meal. Incomplete week data produces a loading or unavailable summary, and failed required months expose “Coba lagi”. The day view retains cancelled entries and groups food-thumbnail delivery links under lunch and dinner headings, showing caterer, package, portions, address label, and status. “Mendatang” lists dates chronologically from today, then lunch and dinner, omits delivered/cancelled fulfillments, and offers another month until the final upcoming delivery. Its empty state appears only when the requested months are loaded. The surface reuses existing food images and identity; it introduces no new artwork. The behavior contract and release evidence live in [the meal-calendar record](docs/MEAL-CALENDAR.md).

### Brand artwork and image truth

The [brand manifest](packages/brand/manifest.brand.json) records sixteen separately generated PNG compositions: mascot, wordmark, horizontal and stacked lockups, two monochrome interpretations, app icon, adaptive foreground composition, five supporting symbols, and three state illustrations. The reference board supplied identity guidance only and is not a runtime asset.

The delivered square masters are 1254 × 1254; wordmark and horizontal lockup are 2172 × 724. All sixteen are RGB with opaque cream or forest mattes and slight generated tonal variation. The current wordmark styling uses multiply blending; that does not create an alpha channel. Real transparency, the requested 2048/4096 master targets, and completed adaptive foreground derivatives remain unfinished. Preserve originals and record any future approved derivatives separately. **Superseded in part (October 10, 2026, Decision B):** fifteen of the sixteen now exist as transparent derivatives segmented from the opaque masters at the original 1254 px (`packages/brand/README.md`), not as newly generated transparent masters; only `app-icon.png` stays opaque, and the 2048 and 4096 master targets remain open. The Phase F mascot stills, rigs, splash marks and icons are separate processed derivatives (see Native polish (Phase F), Artwork use and optical size).

The six [synthetic food images](packages/brand/manifest.food.json) are 1448 × 1086 at 4:3. They serve explicitly labeled demo listings. **The Demo Label Rule (web and native).** Whenever the backend reports demo mode, every screen says so, except where a modal or system UI covers the strip: the web shows its demo ribbon, and both native apps show a persistent “Demo · data sintetis” (“Demo · synthetic data”) strip directly under the status bar, signed in or out. Production sellers supply their own food images. Do not claim that generated food establishes a real seller’s meal or endorsement.

The [finish verdict](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/output/V1-FINISH-VERDICT.md) resolves four bounded web findings using the existing desktop, tablet, phone, and viewport captures in `output/visual-review/`, including `admin-pending-empty.png`. Overall disposition remains **fix** for unfinished transparent artwork; high-resolution master acceptance also remains open in the asset manifest. Native source now gives quantity/compare controls 48 × 48 and chips a 48 minimum height. No native device visual approval, gesture/large-text/dark-appearance approval, push verification, or return-link certification is supplied by this documentation.

### Native motion

Native motion is a smaller system than the web's and shares its timing vocabulary through `nativeMotion` in `@catera/design-tokens`: control 120ms, selection 180ms, content 220ms and feature 320ms, with the same `cubic-bezier(.16, 1, .3, 1)` ease. Press feedback is a spring (damping 18, stiffness 260) rather than a timed curve. **Superseded by Phase G ("Even slower", October 13, 2026):** control 200ms, selection 340ms, content 440ms, feature 680ms, ease `cubic-bezier(.33, 1, .68, 1)`, spring damping 22 and stiffness 120. The durations and the ease change on native and web together; the spring is native only, because `webMotion` has none. Every duration below that names its token runs at the token's new value (see Native Phase G, Motion).

Controls (buttons, chips, segmented options, stepper buttons, round buttons, stars, reactions, radio picks) use `PressableScale`: they compress to 0.97 on press-in, return on release, and fire a haptic (`tap` for actions, `select` for choices; `success` and `warning` are reserved for outcomes; a disabled control fires none). Tappable rows and cards that open something use `PressableRow`: an instant 0.7 dim while pressed, no scale, no ripple and no haptic, identical with and without reduced motion. Phase D's one exception, Beranda's running plan line as a `PressableScale` row (I1), left with the plan lines in Phase E; Beranda's plans row and "Menunggu Anda" rows are `PressableRow`s. No raw `Pressable` remains in native app sources; every tappable gives press feedback. `FadeSwap` fades in new content when its key changes. Pushes, modals and tab switches use the platform's own transitions, with no custom stack or tab-switch animation, and pushed screens use the platform's own header (see Native navigation and chrome).

- Choreographed motion belongs to story beats, not to every screen. Native has no sequenced entrance: the former “Cara kerja Catera” steps and their 80ms stagger were removed (owner decision, October 8, 2026), and package detail states package facts instead.
- Never stagger a catalog, any list or any sequence. Navigation, operational rows and money totals stay still. (Phase F, Decision A: rows the user's own action inserts or removes now animate and their neighbours slide; loaded content still never staggers. See Native polish (Phase F), Feedback.)
- Reduced motion (the system setting, read through `useReduced`) replaces scale and movement with opacity-only feedback (pressed controls dim to 0.85) or no motion at all; bottom sheets fade instead of sliding up. (Superseded by Phase F: the custom bottom sheet was deleted; native form sheets follow the platform.)
- Animate only transform and opacity.
- **Rantang marker (Phase C).** The delivery track draws a lunchbox on a line with three stops (kitchen, road, door). The marker slides to its new stop over 320ms (`feature`) only when the stage changes after the track is already on screen, and the progress line grows with it as a scaled bar, so only transform moves. The first render puts the marker in place at once, and the marker and the progress line stay invisible until the track has been measured so nothing flashes at the wrong stop. "Terjadwal" and "Dimasak" are both the first stop: when a scheduled meal turns to cooking the outline box fills with its tint at once and does not move. Nothing loops or pulses.
- **Story open and swipe (Phase C).** The story opens with a fade and a scale from 0.92 to 1 over 320ms, once, when it appears. It never advances by itself: no timer turns a part. Only a tap (the finger moved 10dp or less) or a sideways swipe turns a part: a tap on the right half of the content goes to the next part and on the left half to the previous one, a right-to-left swipe goes to the next part and a left-to-right swipe to the previous one, any other drag does nothing, a swipe down closes it, and the parts never scroll. Changing part fades the new content in over 220ms (`FadeSwap`).
- **Checklist tick (Phase C).** Ticking a checklist row fills the round box with forest and a cream check over 120ms (`control`) and dims only the dish photo, or the meal icon, to 0.55 over 220ms (`content`). The text never dims, so it keeps 4.5:1 (ruling on gate F1, October 9, 2026): the dish name turns `muted` and is struck through, and the quantity turns `muted`. The colour and the strike-through switch at once, because only opacity and transform are animated. Un-ticking reverses all of it. Nothing plays when the row first appears. Against Dapur's dial under Native antislop revisions, October 8, 2026 (MOTION 1, press feedback and content fades), the tick fill and the photo dim are the only motion this work adds to the checklist, and they exist as the tick's feedback; the dial itself is unchanged.
- **Payment success (Phase D, ruling D8).** One `success` haptic fires when the payment's stage turns paid while Bayar is open; reopening a checkout that is already paid fires none, because the first stage of a mount has nothing before it (`apps/customer/src/buy/PaymentScreen.tsx:54-62`; evidence: `buy.test.tsx` "turning paid while the screen is open gives one success haptic" and "opened already paid gives no success haptic"). Every Bayar stage renders the same `Screen` with its body in a `FadeSwap` keyed by the stage, so a stage change (pay to paid, checking to paid) fades the new body in over 220ms (`content`) instead of remounting the page; the first load does not fade (`PaymentScreen.tsx:173-188, 225`; evidence: code inspection, because the Reanimated mock does not animate).
- **Photos fade in (Phase E).** Food photos in `PhotoRing`, the Beranda hero and pager plates and the plan detail draw through `Photo` (expo-image): the theme `sage` ground while loading, then a 180ms (`selection`) cross-dissolve, opacity only. A photo that fails leaves the same-size `sage` ground with no broken-image mark, and a new uri tries again (`packages/mobile-ui/src/PhotoRing.tsx:10-35`; evidence: `loading.test.tsx` "photos fade in over 180ms and appear at once under reduced motion" and "a photo that never loads keeps its soft ground and draws no broken image"). Recorded exception: the dissolve runs on expo-image's own ease-in-out, not the Catera bezier, because expo-image offers only preset curves (`ease-in-out`, `ease-in`, `ease-out`, `linear`); it keeps the other rules (opacity only, a `nativeMotion` duration, instant under reduced motion). Jadwal's photo cells, the day rows and the story still use React Native `Image` and appear without a fade (deferred).
- **Day arc (Phase E).** The arc's disc travels along the half ellipse between the two ends over 320ms (`feature`), transform only, and cross-fades its sun and moon glyphs with its progress (opacity only); colours snap (see Day arc switch).
- **Reduced motion for these.** The marker slide, the progress line, the story opening, the part fade, the tick fill, the photo dim, the Bayar stage fade, the photo fade-in, the arc's disc travel and its glyph cross-fade are all instant. The press feedback of a whole checklist row is the existing `PressableScale` rule: it dims to 0.85 instead of compressing.
- **Stage feedback on the Dapur count card (Phase C).** The rantang marker on the Dapur count card slides to its new stop over 320ms (`feature`) when the session's stage changes while the screen is open, for example after "Berangkat antar", and it is instant under reduced motion. Against Dapur's dial under Native antislop revisions, October 8, 2026 (MOTION 1, presses and content fades), this slide is accepted as the feedback for a stage change, the same way the checklist tick is. The only other motion Task 8 brings to Dapur is the spinner that replaces the footer button's label while its command runs, the same kind of spinner Dapur Menu shows while a photo uploads. The dial's own wording is unchanged.

### Web motion

Web motion uses 120ms control feedback, 180ms selection, 220ms surfaces/content and 320ms food/confirmation moments, with the existing Catera entrance easing. Keep navigation, operational rows and financial totals steady. Animate only visible discovery results together after committed filters; never stagger a catalog or replay entrances for search typing, locale changes or background refreshes. Forward/back steps communicate direction while their actions remain stationary.

Menus and dialogs use 4–8px entrances and faster dismissal without releasing focus or layer ownership early. Preserve pending button dimensions, stationary errors and the mascot loader's existing delay/completion behavior. The featured carousel retains six-second autoplay, swipe, arrows and dots without a playback button; focus/manual input stops autoplay, and hover temporarily pauses it. Reduced motion disables movement and cancels active web animations and smooth calendar scrolling. Implementation choices and before/after evidence are in [the web motion record](docs/WEB-MOTION.md).

## Do's and Don'ts

### Do:

- **Do** use the approved forest, sunrise, cream, and charcoal identity with the current supporting tokens.
- **Do** preserve complete brand compositions, intrinsic aspect ratios, provenance, and the actual dimensions of every generated asset.
- **Do** lead food discovery with meal photography; use synthetic food only in explicitly labeled demo listings.
- **Do** maintain distinct customer, seller, and platform-admin navigation with Indonesian-first labels.
- **Do** keep the next meal and lunch/dinner agenda adjacent on wide customer home and ordered before flat subscriptions on phone.
- **Do** preserve text labels, keyboard focus, reduced-motion handling, and the native source’s 48 dp control sizing.

### Don't:

- **Don't** crop the reference board or extract a sprite to create a runtime brand asset.
- **Don't** describe an opaque PNG, matte, checkerboard, blend mode, or upscaled derivative as a true transparent or high-resolution master.
- **Don't** reuse the superseded pilot palette, system-font hierarchy, or tenant-only surface model for V1.
- **Don't** replace food photographs with mascot decoration or recreate the wordmark as interface text.
- **Don't** turn customer-home subscription rows back into nested cards or imply a pending verification workload when the selected queue is empty.
- **Don't** treat the web verdict, native source checks, or this documentation as device visual approval or production-release approval.

## Caterer journey continuity — September 24, 2026

Package inspection and menu management lead published-package cards. Suspension and archive are secondary, named confirmations that preserve existing obligations. Read-only commercial terms expose recurring capacity, applicable meal windows, and the package timezone.

Operational selections use validated URL context. Sensitive replies and edits remain in actor-scoped workspace memory, with explicit unsaved/discard and conflict states; they are not automatically stored in browser storage. Seller notifications retain the caterer shell.

Transactions start with a compact balance/readiness summary and Sales. Earnings charts belong inside earnings activity; legacy payouts are disclosed within payouts. Approved bank details alone do not imply payout activation or a confirmed processing date. A failed refresh identifies retained information as stale.

Production remains a whole-day handoff independent of schedule-table filters. Live output and the latest saved revision are separately labeled, including whether the saved copy matches current orders. Empty attention queues are compact; populated queues retain priority and next actions.

Implementation, local verification, and release limitations are recorded in [the caterer journey report](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/CATERER-JOURNEY-IMPLEMENTATION-2026-09-24.md).

## Practical copy and purposeful UI — September 26, 2026

Every web surface uses task names, factual product explanations, and explicit states. Remove generic slogans, repeated promotional subtitles, decorative panels, and illustrations that contribute no task information. Preserve instructions, eligibility and permission explanations, consent, consequences, deadlines, recovery actions, and user-authored content. Indonesian and English convey the same meaning; payment headings follow the existing server state.

The approved identity remains: forest/sunrise/cream, Jakarta type, the wordmark, food-led discovery, and the “Good Food on Repeat” brand tagline. Show that tagline once as footer text; do not repeat invented variations throughout the workspace. Artwork masters and the brand reference gallery remain intact. Functional loading animation and semantic status icons remain useful feedback.

Operational chrome contains navigation, workspace identity, language, notifications, and account controls. The marketplace link remains in the compact sidebar footer. Page headings use the existing optional-description pattern; no empty paragraph or spacer replaces removed copy. Authentication uses a centered form, at most 528px including 24px side padding, with one mode-specific primary heading. Empty states retain their explanation and action without a generic calendar illustration. Tokens and behavioral contracts are unchanged.

Inventory, route coverage, and local verification: [ID 0035](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/SLACK-0035.md).

## Native antislop revisions, October 8, 2026

Owner decision, October 8, 2026: “Fix everything, trust the antislop and revise the DESIGN.md where needed.” Where [antislop audit 001](anti-slop/audit-001-2026-10-08.md) conflicted with earlier native direction, this section and the edits above replace that direction: the Sunrise sun coverage cue became Sunrise ink, and the “Cara kerja Catera” stagger exception was removed. Finding-by-finding status and evidence are in [the follow-up record](anti-slop/audit-001-followup-2026-10-08.md).

- `Dial (customer): ENERGY 2 / RHYTHM 2 / MOTION 2`. Customer screens are generous, warm and photo-led; motion is press and selection feedback plus content fades, never list choreography.
- `Dial (Dapur): ENERGY 1 / RHYTHM 1 / MOTION 1 (+ press micro-feedback)` (raised to MOTION 2 on October 10, 2026; see Native polish (Phase F)). Kitchen operations are restrained and denser; rows and money totals stay still, and motion is limited to presses and content fades (the Hari ini / Besok date button; the mood switch adds the header and hero cross-fade described under Native mood and theme).

**The Three States Rule (native).** Every native data screen shows a loading state (since Phase F a skeleton group that screen readers hear as “Memuat {apa}” (for example “Memuat paket”), not a visible spinner or text line; see Native polish (Phase F), Loading), an error message in Danger with a “Coba lagi” action that reloads, and an empty state that says what is missing. Counts and actions that depend on the data stay hidden or disabled until it loads (Dapur Pelanggan filter counts, Menu “Salin minggu lalu” and “Bagikan menu”, Usaha “+ Paket baru”). Dapur uses one shared `ReadError` for failed reads. A font-load failure shows a plain restart message instead of a blank screen.

- **Screen readers.** The `Text` title and heading variants are exposed as headers. A pushed screen has one heading: its native bar title or, for a screen named by its record (a plan, a package, a Dapur customer or report), the `Screen nativeTitle` (the iOS large title, the first content line on Android), with no repeated in-content title. The bottom-sheet scrim is a button labelled “Tutup” / “Close”, and the VoiceOver escape gesture closes the sheet too; a sheet with no title renders no empty heading. Prices are read as text, never as headings. The scrim label and the stepper's decrease and increase labels are translated by the caller.
- **Touch targets.** Every native control is at least 48dp: chips, segmented options, text buttons, stepper buttons, filter chips, review stars, month arrows and icon buttons included.
- **Package detail facts.** Package detail states what a customer can act on: delivery days and windows, the change cutoff (“Ubah hari”, until the cutoff time the day before), the delivery fee, and the earliest bookable start (“Mulai paling cepat”), hidden when nothing is bookable. It has no generic how-it-works steps.
- **Review stars.** Unselected stars are outline icons in Muted; selected stars are filled in Sunrise ink, so the choice never rests on a pale colour alone. **Superseded by colour direction K (Phase G):** native sources no longer read Sunrise or Sunrise ink outside the tracker, `nativeArt`, the confetti and the launch cover (see Colour revision (Phase G), October 2026, The Sunrise spend).
- **Kitchen truth (Dapur).** “Yang dimasak” lists only real dishes. Menu slots nobody has filled read “Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur”, one line per package that still has gaps (never summed across packages), and owners get an “Isi menu” link under each line that opens that package in the menu editor. The shared and printed recap carry the same per-package lines. “Bagikan menu” is disabled, with “Belum ada menu untuk dibagikan”, when no day of the week has dishes, and “Salin minggu lalu” is disabled, with “Minggu lalu belum ada menu untuk disalin”, when last week has nothing to copy. A package still running past its booked last day (moved deliveries) shows only its days left (“Sisa 1 hari”), never a past end date. Attention cards on Hari ini that point to a Dapur screen are links with a chevron; a card with no Dapur destination stays plain.
- **Claims.** No unmeasured durations and no unbacked security claims: the payment card says only “Pilih cara bayar di halaman berikutnya.” until the server names its payment provider. Calls to action name their task (“Aktifkan pembayaran”, not “Mulai”).

These revisions were verified on the Android emulator in Expo Go with the demo backend; iOS behaviour (keyboard offset under the demo strip, VoiceOver reach of the sheet scrim) is not yet device-verified.

## Native theme, October 9, 2026

Owner decisions of October 9, 2026, recorded with Phase A of the native visual identity ([spec](docs/superpowers/specs/2026-10-09-native-visual-identity-design.md), sections 3.1 and 3.2):

- **The app follows the phone by default.** Both native apps read the system appearance (`userInterfaceStyle: "automatic"`). Dark is offered because the owner asked for it, not as a default look.
- **The user can override it.** A "Tampilan" row in customer Akun and Dapur Usaha, beside "Bahasa", offers Sistem, Terang and Gelap. The choice is stored on the device in SecureStore, applies at once and survives relaunch (see Components, Tampilan row).
- **Dark body is neutral charcoal, never dark green.** The owner's reason: a green body "lacks contrasts with the header and footer". Brand green appears only where the inverted forest and cream roles place it, and the tab bar keeps its own fixed surface.
- **Dark is a real theme.** It has its own palette table, a measured contrast rule enforced by test and no new decoration: no glow, glass or extra shadow appears in dark mode, and the only gradients anywhere in the native apps are fixed dark fades over a photo: the StoryCover scrim and the Menu besok story's bottom scrim, whose purpose is to keep text legible, a short fade at the top of the story photo that only joins it to the black header, and (since Phase E) the PackageDetail top scrim, which keeps the light back control and the status glyphs legible over a bright photo (see Shapes, depth and type). A theme change is not animated.
- **Light keeps its palette, with five approved exceptions.** Every light colour value is exactly the value of the shared `colors` (Phase E adds two native-only light keys, `tabBar` `#F2ECDF` and `tabIndicator` `#BFD8BB`; see Native dark theme). The light screens differ from the Phase 1 baseline in five named ways, all approved:
  - Two Dapur text inputs (the menu slot dish name and the import paste box) use charcoal ink instead of the platform default black, because the default is unreadable on the dark surface.
  - The tab bar in both apps was 64dp plus the bottom safe-area inset, with every item at least 48dp, so the gesture pill no longer crossed the labels. Superseded in Phase E by the platform's native tab bar, which owns its height and insets (see Native navigation and chrome).
  - The four multiline report and reply fields (customer help reports and the problem form, the Dapur reply) now show the standard input border and fill, because a caller's `style` extends the `Field` base style instead of replacing it.
  - The customer Jadwal day row's detail line wraps instead of truncating at large font scales, so "Sudah sampai" stays visible.
  - The bottom `Sheet` changed in both themes. Its scrim now covers the status bar, the sheet surface fills the gesture band so no strip of the screen behind it shows through under the sheet, and on iOS its bottom padding grows by the home-indicator inset. The sheet also lifts a focused field above the keyboard (see Native mood and theme). **Superseded by Phase F (October 11, 2026):** this Sheet was deleted (see Sheets and keyboard).

Evidence and limits. Phase A was checked on the Android emulator in Expo Go with the demo backend: light captures against the Phase 1 baseline, dark captures of every tab screen and the main pushed screens, the override and its persistence across relaunch, and font scale 1.3. The record is [antislop audit 002](anti-slop/audit-002-2026-10-09.md), with its click-through. The first pass found four defects, and the controller ruled that none ships: the gesture-navigation pill crossing the tab labels, tab items under 48dp, a truncated Jadwal status at font scale 1.3, and black typed text in the multiline report and reply fields in dark. All four were fixed inside Phase A (tab bar safe-area inset and item height, wrapping day-row detail line, `Field` style composition) and re-checked on the emulator. The multiline fields now also show the standard input border and fill in light, which they lacked before. No iOS, physical-device, TalkBack or standalone-build splash check was run, so this is not a device or release approval.

Dials are unchanged by this phase: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 1 (plus press micro-feedback).

## Native mood and theme

Owner decisions of October 9, 2026 ("Go with E", on top of the D2 direction and the dark-mode row), built as Phase B of the native visual identity ([spec](docs/superpowers/specs/2026-10-09-native-visual-identity-design.md), sections 3 to 7). This section is the contract for the mood layer; the dark palette it sits on is under Native dark theme and Native theme, October 9, 2026.

### Two independent axes

- **Theme** is light or dark and follows the phone unless the user picks Terang or Gelap under "Tampilan". It colours body, cards, rows, sheets, forms, the native top bars and the tab bar.
- **Mood** is Siang or Malam, chosen by the user with a button. It colours mood surfaces only: `MoodHeader` (on tab roots, see Headers on other screens), `MoodToggle`, `MoodArc` (the day arc), the Malam pattern, `CalendarPhotoCell`, the Beranda hero card and each hero pager card, the plan detail hero card, the paid hero card on Bayar ("Pembayaran diterima"), the Dapur count card and the Jelajah header. Bodies, cards, rows, sheets, the native top bars and the tab bar never read mood colours, so a mood switch changes only the header and the hero.
- Every screen therefore has four looks: light Siang, light Malam, dark Siang and dark Malam. A screen without a mood toggle still shows the current mood in its header.
- **Launch default.** The mood starts as Siang before 15.00 Asia/Jakarta and as Malam from 15.00 to the end of the day, computed on the Jakarta clock whatever the device timezone. The clock only picks the default; it never switches the mood while the app is open. Mood lives in memory, one provider per app, and is not stored.
- **Status bar.** The app's default glyphs, set at the root, follow the theme (`statusBarStyle({ mood: null })`), so pushed screens, modals and the startup mascot (`MascotLoading startup`) show the theme's glyphs. A tab root's `MoodHeader` mounts `ScreenStatusBar` with the mood's glyphs only while its screen is focused: light when the theme is dark, or when the mood is Malam and the demo strip is not shown; dark otherwise. PackageDetail shows light glyphs while its bar sits over the photo (see Native navigation and chrome). A fixed `StatusBand` in the header colour sits under the status bar of every screen with a mood header, so the glyph style stays correct once the header has scrolled away. The demo strip stays above the header and owns the status bar inset while it is shown.
- **The tab bar is fixed.** The owner's reason: "No need to change the color of the bottom nav bar when toggling between day and night." The native bar uses the `tabBar` surface and the `tabIndicator` pill in both moods.

### Mood tokens

**Superseded by colour direction K (Phase G, October 13, 2026):** the values below are the October 9 record. The mood tokens in use are in Colour revision (Phase G), October 2026, Mood tokens.

`nativeMood[theme][mood]` in `@catera/design-tokens` is the only place mood hex values live (no literal hex in `apps/caterer` or `packages/mobile-ui/src`).

| Key | Light Siang | Light Malam | Dark Siang | Dark Malam |
| --- | --- | --- | --- | --- |
| `header` | `#FFEFD9` | `#0B1F16` | `#3A2617` | `#163D2E` |
| `headerText` | `#163D2E` | `#FFF7E9` | `#F5F1E8` | `#F5F1E8` |
| `headerMeta` | `#6B4A2B` | `#A9BDB0` | `#E6C3A2` | `#CFE0D2` |
| `toggleTrack` | `#F6DDBE` | `#1C3A2C` | `#4C3322` | `#25553F` |
| `toggleActive` | `#9B4309` | `#FFF7E9` | `#F5C9A6` | `#FFF7E9` |
| `arcTrack` (decorative) | `#E2C29C` | `#2C4C3C` | `#6A4A33` | `#2C5A45` |
| `markerActive` | `#9B4309` | `#FFF7E9` | `#F5C9A6` | `#FFF7E9` |
| `markerIdle` | `#9A7A55` | `#6E8C7C` | `#A88A6A` | `#7FA08E` |
| `todayRing` | `#9B4309` | `#F5C9A6` | `#F5C9A6` | `#F5C9A6` |
| `hero` | `surface` | `#1C3A2C` | `surface` (dark) | `#1C3A2C` |
| `heroText` / `heroMeta` | `#163D2E` / `#60675F` | `#FFF7E9` / `#A9BDB0` | `#F5F1E8` / `#B5B2AA` | `#F5F1E8` / `#CFE0D2` |
| `pattern` (Malam lunchbox outlines, decorative) | none | `#1A3A2B` | none | `#1F4A38` |

`toggleActive` is paired with an `onToggleActive` label colour; the hero shadow is `boxShadow` `0 10px 28px rgba(107,74,43,0.16)` in light Siang and `0 10px 28px rgba(0,0,0,0.35)` in the other three looks. `todayRing` is a ruling added in review: the theme `forest` and `sunriseInk` measured about 1.4:1 and 2.6:1 on the light Malam header, so the calendar's today outline reads this key and the selected outline reads `headerText`.

**Contrast rules, enforced for all four theme and mood combinations by `tests/native-contrast.test.ts`:** text at least 4.5:1 on its own fill; `markerIdle`, `todayRing` and `headerText` (the selected outline) at least 3:1 on `header`. Decorative strokes (`arcTrack`, `pattern`) are exempt and hidden from screen readers. Three mock colours failed in the spec and were replaced: the idle moon marker (`#B49F82`, 2.26:1, became `#9A7A55`, 3.52:1, the tightest margin), the dashed "menu belum diisi" border and the unchecked checklist ring (now `controlRing`).

### Shapes, depth and type

- The mood header has bottom corners 32 on Beranda, where the hero overlaps it, and 28 everywhere else. The Beranda hero's real overlap is 58 (a ruling: the first build overlapped less because the screen body adds 16 of top padding).
- The hero card has radius 28 with an inner photo radius 20. Content cards are 16 (`Card` and the Jelajah package row); the card-variant plate and the Dapur count card were 22 (the count card is gone since the Dapur layout pass). Existing panels (14), inputs (9), buttons (10) and chips keep their radii; toggles are pills. New rounded surfaces use `borderCurve: "continuous"` (iOS only). The one exception is the Dapur Menu dish photo tile, which has a plain `borderRadius` because `ImageStyle` does not accept `borderCurve` and the tile's wrapper matches its image.
- The hero is the only raised surface on a screen (Quiet Work Rule); everything else stays flat with borders or tonal fills. No glow or glass is added, in any look. The only gradients are fixed dark fades over a photo (`experimental_backgroundImage`, no dependency). The StoryCover scrim and the Menu besok story's bottom scrim exist to keep text legible, which antislop R-01 allows when the purpose is written down. The PackageDetail top scrim (Phase E, `linear-gradient(rgba(27,27,26,0.6), rgba(27,27,26,0))`, `PackageDetail.tsx:442`) keeps the light back control and the status glyphs legible over a bright photo. The story page has a second, short fade at the top of the photo; it is not a legibility scrim and carries no text, and its written purpose is joining the photo's top edge to the black header above it. None of them is a mood surface. Legibility rule for the story's bottom scrim: it ramps from clear to `rgba(27,27,26,0.9)` over the first 48dp and holds 0.9 to 0.92 below that, and the title and every line under it start below the ramp, so cream text on it measures about 12:1 against a white photo (cream #FFF7E9 over that fill, computed). The sticker starts 20dp into the scrim, inside the ramp, and needs no scrim because it sits on its own cream fill.
- **`display`** is a new `Text` variant in `components.tsx` (`textVariants`): 34/40, `Jakarta-ExtraBold`, tracking -1. Controller ruling (October 9, 2026, final fix wave): `display` is for short fixed headlines only. A string `MoodHeader` title defaults to the `title` variant (30/39), and a caller opts in with `titleVariant="display"`. Today the opt-ins are the Jelajah two-line headline, the Dapur Menu week range and the Dapur Menu title while it loads; the Menu besok story title uses it in Phase C. The reason: a long, dynamic name (a caterer, a customer, a month) set at 34/40 and font scale 1.3 pushes the content below the fold, and the hero screens (Beranda) already use `title`. The spec (line 104) reserved `display` for the Menu besok story title; the earlier build ruling that made it every header's headline is withdrawn. Counters and checklist quantities use `heading` with tabular figures.
- **Sticker.** A rotated (-2 degrees) cream label with a 1.5 sunrise-ink border and forest text, marking the one fact on a screen. The Menu besok story carries it for the meal and its delivery window ("Makan siang · 11.00–13.00"); no other screen carries one yet.

### Code-drawn brand objects

The day arc (`MoodArc`: dashed track, sun and moon markers, an active disc; since Phase E it is Beranda's Siang/Malam switch), the rantang (lunchbox) and the Malam lunchbox pattern are interface objects drawn in code with `react-native-svg` in `packages/mobile-ui/src/brand/`. They are not generated artwork: no image asset was added or altered, and nothing here is a transparent or high-resolution master. Ionicons remain the interface icon set.

### Mood motion

All timings come from `nativeMotion` and only transform and opacity animate.

- **Mood switch.** The header, hero, Dapur count card and status band fills cross-fade over 220ms by animating the opacity of two stacked fills (one shared `MoodFill`, so they share a curve and a clock); on Beranda the arc's active disc travels to the other end of the arc over 320ms and cross-fades its glyph; where `MoodToggle` remains (Dapur Hari ini, Dapur Menu) its pill slides over 180ms; a `select` haptic fires. The body and the tab bar do not move or change. Title, toggle and disc colours snap while the fill fades (accepted).
- **Reduced motion** makes every one of these instant. The setting is read when the app starts, so it applies after the next launch. **Superseded by Phase G (GC-F2):** the setting is read live and applies at once.
- No entrance animation and no stagger for the calendar, lists or catalogues (unchanged rule). Nothing loops. **Superseded in part by Phase F:** rows the user's own action inserts or removes animate (Decision A), and the mascot loop and the skeleton pulse loop while something waits (see Native polish (Phase F), What Phase F supersedes).

### Components and behaviour (rulings of October 9, 2026)

- **Toggles.** `MoodToggle` is a `tablist` of two equal-width `tab`s with `selected` state, a 48dp hit area and translated labels ("Siang" and "Malam"; "Lunch" and "Dinner" in English). It appears on Dapur Hari ini and, as the two large meal buttons, on Jelajah; Beranda's switch is the day arc (below). Dapur Menu uses the same mood to choose which meal it edits. A single-meal package shows its own meal in Dapur Menu whatever the mood, with its caption (B5).
- **Day arc switch (Beranda, Phase E).** `MoodArc` under the headline is the Siang/Malam switch (owner: "clear and obvious for the user without being too much"): a `tablist` of two `tab`s with `selected` state, one per end of the dashed half ellipse, reading and writing the mood like `MoodToggle`. Each end is a 96dp column (23dp top padding, a 50dp marker holding a 44dp ring, a 13/16 bold title and a 12/15 detail line), so each target is at least 48dp both ways and the block is 104dp at font scale 1.0 (113dp at 1.3 on 360dp). Both ends wear the same-size 1.5dp `markerIdle` idle ring with a `markerIdle` glyph, so both read as buttons; the chosen end is covered by the 44dp `markerActive` disc carrying its glyph in `onToggleActive` (at least 3:1, enforced), from the first frame. The chosen end gives no press feedback and no haptic; the idle end compresses and fires `select`. The detail line is the window start ("11.00") for one delivery of that meal today, "{n} antaran" for several and "Tidak ada" for none, and each end is labelled "Makan siang, {detail}" / "Makan malam, {detail}". Labels wrap under their marker (`maxWidth` is the column) and never truncate. With the arc, `MoodHeader` draws no toggle in its top row, which holds the date alone (`packages/mobile-ui/src/brand/MoodArc.tsx`; evidence: `mood-arc.test.tsx`).
- **Beranda (Phase E, the order approved on the canvas `HomeFull`, audit 006).** From the top: the mood header (the date as its meta line, or "Berikutnya {label}" when nothing is left today; the headline; the day arc), the hero or the hero pager, the offline or error line, the other-meal row, the "Paket selesai" recap, "Perlu kamu urus" (formerly "Menunggu Anda"), "Menu besok", "Berikutnya", the plans row, and nothing after it. Every count comes from the customer read (R-17), and a menu that is not set never shows a dish name (`apps/customer/src/today/Beranda.tsx`; sections from `packages/domain/src/home.ts`; evidence: `beranda-sections.test.tsx`, `tests/home.test.ts`).
  - **Headline.** "Siang ini," and then, for one delivery of the chosen meal, its main dish lowercased (`Plate.lead`, the story's rule: the main-dish category, else the cover dish, else the first in composition order), or the package name in its own casing while the menu is not set; for several, "{n} antaran."; for none, "tidak ada antaran." with a meta line naming the next delivery (B6). The Malam forms likewise. With no deliveries at all, the existing empty state stays. While the other meal's plate is still to come, the meta line keeps its date.
  - **Hero pager.** When the chosen meal has two or more deliveries today, the hero becomes `HeroPager`: equal hero cards, each the pager width minus 64 with a 12 gap, snapping per card with the next card peeking, stretched to the tallest card, so no delivery is demoted to a different card. Under them, dots (the current one 20 wide in `forest`, the others 8 in `secondaryBorder`, no width animation) and "1 dari 2" (12/16 bold, tabular, `forest`). Screen readers get one adjustable control labelled with the meal ("Makan siang") whose value is "{i} dari {n}, {katerer}"; increment and decrement move the pager, and nothing is announced on top. One delivery keeps the single hero with no counter (`packages/mobile-ui/src/HeroPager.tsx`). The hero's "Sudah sampai" and "Belum" share their row 2:1 and wrap on a narrow card at a large font. At 360dp and font scale 1.3 with the demo strip, these actions sit below the fold (accepted: the page scrolls).
  - **Other-meal row.** A 54dp ring, "Malam ini · {window}" or "· {n} antaran" for several, and the main dish (`lead`, else the package name). It carries the status sentence of a plate that needs the customer, and a tap switches the mood.
  - **Perlu kamu urus** ("Needs you"; "Menunggu Anda" until Phase G). Everything that waits on the customer, as one bordered list (radius 16, 1dp `line`, `surface`, no shadow) of `PressableRow`s at least 64dp tall, each with a 36dp `sage` icon circle, a 15/20 title, a 12/16 muted tabular detail and one action word, in this order: menus ("Pilih menu Selasa 13 Okt", "Pilih menu Rabu dan Kamis" or "Pilih menu {n} hari", with "{paket} · sebelum {deadline}" and "Pilih", opening the soonest due day); renewals ("{paket}, sisa {n} hari", with "{katerer} · harga terakhir {Rp} per porsi" and "Perpanjang", which counts `renew_started`); trials ("{paket} selesai hari ini", "… besok", "… {Senin 12 Okt}" or, once ended, "{paket} sudah selesai", with "{katerer} · paket coba" and "Beli paket", which opens the package; "Paket penuh" before Phase G); and the review ("Bagaimana {katerer} selama ini?", with "Nilai", which opens the review form sheet). "Perpanjang" is the only urgent action word and is charcoal; the others are forest (colour direction K, `98af208e`; `WaitingList.tsx:75, 206`). It was sunrise ink before Phase G. Below 340dp of effective width the action word drops under the row's text (see Native Phase G, Narrow widths). Offline there are no menu rows and no review; a failed action feed drops only the menu rows. The section is hidden when empty. It replaces the renewal and trial cards, the menu-due rows and the inline review prompt (`apps/customer/src/today/WaitingList.tsx`).
  - **Berikutnya.** The next three days that have a delivery, grouped by day: one label ("Besok, Sabtu 10 Okt") with "{n} antaran", then one row per meal and plan with a 40dp ring, the main dish or "Menu belum ditentukan", "Siang · {paket} · {katerer}" and a chevron, opening `/hari/{id}`. Lunch comes before dinner, then window order. The rows carry no change deadline; the Menu besok row and the day screen keep theirs (`UpcomingDays.tsx`).
  - **Plans row.** One bordered row: "{n} paket aktif" (tabular) with up to three overlapping package photos and the caterers, opening Paket saya (`/paket-saya`, inside the tab, `Screen nativeTitle="Paket aktif"`). Paket saya lists every active plan, sorted by name and then start date; two active plans with the same name carry their dates ("13–26 Okt", a one-day plan "10 Okt"), in Akun's "Paket aktif" too, because both use `PlanList` (`PlansRow.tsx`, `apps/customer/src/plan/PlanList.tsx`). Chat with the caterer moved from Beranda's plan lines to the plan detail's header.
- **Beranda hero track.** The hero shows a rantang track under the dishes: a lunchbox marker on three stops (Dimasak, Diantar, Sampai) and one caption line that says what is true now ("Terjadwal", "Dimasak 08.10", "Berangkat 10.42", "Sampai", "Tercatat sampai" when nobody tapped and the system closed the meal). The stage follows fulfilment status and timestamps, never the clock, so a meal the kitchen never tapped stays "Terjadwal". The track appears on the hero only, never on the other-meal row, and it is hidden for a failed plate, a reported plate and a meal marked as a problem, which keep their own message. The "Berangkat {jam}" chip that used to sit on the photo is removed, because the caption carries the departure time. Reachability (ruling on Phase D Task 1): production's nightly auto-close only closes days before today (`v1.auto_deliver`, `supabase/migrations/20261008102000_delivery_depart.sql:46`), so "Tercatat sampai" is not reachable on Beranda in production, and the demo has no state for it either (see Demo states). The wording is covered by Jest (`today.test.tsx` "says Tercatat sampai when nobody tapped and the system closed the meal"); the reachability is a release note for the owner, not a Phase D fix.
- **Hero header never repeats the track.** When the hero shows the track, its status header must not say what the caption says. A scheduled meal drops "Terjadwal" from the header and leads with the second line, "Diantar {jendela} ke {alamat}" ("Delivered {window} to {address}"). A meal on the way with no recorded departure time leads with "Tiba sekitar {jendela}" ("Arriving around {window}"), because its caption would otherwise read "Sedang diantar" twice. When the delivery window is empty, or a scheduled meal has no address label, nothing is promoted and both original lines stay, so the header never reads "Tiba sekitar " or "Diantar  ke". A meal the system recorded as arrived (nobody tapped, `confirmed_by` is `auto`) says "Tercatat sampai" ("Recorded as arrived") on the first line of its plate sentence, the same words as the track caption, with "pukul {HH.MM}" ("at {HH.MM}") on the second line. On the hero, whose track shows that same caption, the header promotes the second line instead, "Pukul {HH.MM}" ("At {HH.MM}"), so the two never say the same thing; when no time was kept (malformed data, because the app always records one), the truthful state wins over the no-repeat rule and the hero header reads "Tercatat sampai" ("Recorded as arrived") with no second line. A meal the customer or the caterer closed keeps "Sudah sampai" with "pukul {HH.MM}", beside a track that reads "Sampai". Every other hero state keeps its header and second line unchanged, apart from the due line below. The other-meal row keeps the original first line.
- **Due and unreported.** The hero, for a meal past the start of its window that the kitchen never tapped, keeps "Seharusnya sudah tiba" as its header and says "{jendela} · belum ada catatan dari dapur" ("{window} · no update from the kitchen yet") on the second line, next to a track that still reads "Terjadwal". With no window the line reads "Belum ada catatan dari dapur". The hero, for a due meal the kitchen is cooking, keeps the bare window.
- **Track times and usage.** The status header, its second line and the track caption set their figures tabular, like every other operational number. The hero counts `journey_viewed` at most once per delivery, meal and stage while the app process lives, and in the hero pager only the card in view counts (the next card counts once swiped to); the count row has no user, caterer or device column. A meal the kitchen has not started and a plate shown from the offline cache are never counted.
- **Menu besok row (Beranda).** Under "Menunggu Anda", above "Berikutnya", a row titled "Menu besok" with tomorrow's date ("Sabtu 10 Okt") and one 60dp `PhotoRing` per delivery and meal, lunch first. A lunch ring is sunrise ink and a dinner ring is forest. **Superseded by colour direction K (Phase G):** the section is "Perlu kamu urus" (see Native Phase G, Strings this file quotes that changed), and a lunch ring is `controlRing` grey and a dinner ring charcoal (see Colour revision (Phase G), October 2026, Surfaces). Two packages with a lunch each give two lunch rings. Each ring is a button that opens the story at that part (`/tomorrow?part=<index>`). There is no row when nothing is delivered tomorrow.
  - **Covered rule.** A ring is covered, a closed lunchbox in place of the photo, when the delivery's change cutoff has passed (the cutoff minute counts as passed) and the customer has not yet opened that part of the story. Before the cutoff the rings show the dish photos, for fixed plans too. Until the seen marks have been read a closed day stays covered, so unknown is never shown as uncovered. A covered ring is announced as "Menu besok, makan siang, tertutup, buka untuk melihat"; an uncovered one names the dish ("Menu besok, makan siang, Ayam bakar madu") or says "Menu belum diisi".
  - **Meta line.** If any part can still be changed: "Bisa diubah sampai {hari ini 17.00}". Otherwise, if every part is past its cutoff: "Sudah lewat batas ubah". Otherwise (a fixed plan, still before its cutoff) no meta line.
- **Menu besok story.** A full-screen route, `/tomorrow`, presented as a `fullScreenModal` with a fade and no header; the status bar is light on the story's black. In demo mode on Android the demo strip stays above the story, so one check (the strip owns the top inset and the platform is not iOS) decides two things. The status-bar glyphs follow the strip through the same rule as every other screen with the strip shown: dark on the light theme's sage, light on the dark theme's. And the story starts directly below the strip: its bars, and the close button of its loading, error and empty states, sit 8dp below the strip and do not add the status-bar inset again. On iOS the full-screen story covers the strip, so the glyphs stay light and the story pays the status-bar inset itself (reasoned from the presentation, not yet checked on an iOS device). It sits on black whatever the theme and reads the fixed inks, like the StoryCover. The photo fills the area under the bars and header and the text sits at the bottom.
  - **Header and bars.** One bar per part, and a header line "Menu besok · Sabtu 10 Okt · 1 dari 2" beside a 48dp close button. A one-meal day has one bar. The header is an adjustable control for screen readers.
  - **Part.** The sticker ("Makan siang · {window}") is the one fact on the screen. Under it the title in the `display` variant: the main dish, or "Menu belum diisi oleh {katerer}" over the package photo when the menu is not set. When the menu is set, a line "{katerer} · {side dishes}" follows (the caterer alone when the menu has no side dishes); when it is not set there is no such line, because the title already names the caterer. Then the deadline line and the primary button.
  - **Deadline line.** If the day can be changed: "Bisa diubah sampai {hari ini 17.00}" with a secondary "Ubah hari" button that opens `/hari/{deliveryId}`. Otherwise, past the cutoff: "Sudah lewat batas ubah" and no "Ubah hari". Otherwise (a fixed plan still before its cutoff) no deadline line and no "Ubah hari".
  - **Navigation.** It never advances by itself and never loops. Only a tap or a sideways swipe on the content turns the page. A tap is a press whose finger moved no more than 10dp on either axis between going down and lifting: on the right half of the window (at the lift point) it goes to the next part, on the left half back. A sideways swipe of more than 40dp that is mostly sideways (the horizontal move more than 1.5 times the vertical one) follows the story convention: right to left goes to the next part, left to right goes back, wherever it starts or lifts. Any other drag (up, a short slide, a diagonal) does nothing. The primary button also goes to the next part. A swipe down of more than 80dp, a quick downward flick or the close button dismisses. The primary button reads "Lihat menu malam" (or "Lihat menu siang" when the next part is a second lunch) and "Selesai" on the last part, which closes. Parts never scroll: the part fills the viewer's content region and long text wraps.
  - **States.** Loading reads "Memuat menu besok…". A failed read reads "Belum bisa memuat" with "Coba lagi". A day with no delivery reads "Belum ada antaran besok.". Each has a 48dp close button.
  - **Motion.** The route comes in with its own navigator fade (`animation: "fade"`). Inside it, the viewer opens with a fade and a scale from 0.92 to 1 over 320ms (`feature`), and a part change fades the new part in over 220ms (`content`). Those two viewer animations are instant under reduced motion; the navigator's fade is not part of that rule.
  - **Usage.** `tomorrow_story_viewed` is counted once per open; the count carries the event name and the app and no person (see Usage counts).
- **Seen marks (Menu besok).** Opening a part of the story writes "seen" to the phone's SecureStore under `runtime.storageKey("story.{deliveryId}.{meal}")`, one key per delivery and meal. The mark is written when the part is shown, before or after the cutoff, and is never sent to the server. The Beranda row reads the marks and uncovers a ring when its mark exists; the row, still mounted behind the story, updates at once when the story writes a mark. A failed write leaves the ring covered. Marks are not removed by the app.
- **Jelajah.** The header holds the area, headline, the Siang/Malam meal buttons and search. The meal buttons are the mood, so they follow a switch made on Beranda and the title, buttons and list always agree; a Malam launch shows the Malam list. The category circles are the most frequent `Offer.tags` across the loaded catalogue (top 6, meal tags excluded), each with the photo of the first offer carrying the tag that has a photo (an offer without one never blanks a circle); a tap filters, a second tap clears (B1). Rows omit the start date and show caterer, delivery-day range and meal (B2). When the selected meal has no package, the empty state reads "Belum ada paket makan {siang|malam}" with a "Lihat makan {other}" button that switches the mood; a catalogue with no packages at all reads "Belum ada paket."
- **Jadwal** (see Customer meal calendar). The month grid sits in the mood header and replaces the icon cells with photo cells. A covered day shows the lunch dish photo, then the dinner photo, then the package photo, with the day number in a pill and a moon badge when dinner is also covered. A covered day whose menu is not set has a dashed `markerIdle` border and a sun mark. Past days are dimmed. **Selection is shown by shape:** the selected day has a `headerText` ring plus a 4dp bottom bar, and today has only the `todayRing` outline, so the two stay distinguishable on every look and "past" keeps its meaning. The day-number pill on a photo cell stops scaling at 1.15 times the system font size, so it never grows into the moon badge; the bare day numbers scale to 1.5. With a large font the moon badge becomes a small dot. The grid uses 12dp side padding and 2dp gaps at 360dp, with cells flexible and at least 44dp wide (44dp is the antislop R-03 floor, and a seven-column month needs it). **Jadwal keeps its height while loading (Phase E):** the grid always draws six week rows of 52dp (empty rows after a four- or five-week month), so the header is one height loading, failed and loaded. While the month loads, the header draws the grid's empty frame (weekday names and six empty rows) with a spinner and "Memuat…" inside it; a failed read shows the same frame with the error and an underlined 48dp "Coba lagi"; the legend stays below in every state, and unknown data is never drawn as uncovered (`apps/customer/src/schedule/MonthGrid.tsx`; evidence: `loading.test.tsx` "Jadwal keeps the month grid's height while it loads"). The legend names "Foto menu", "Menu belum diisi" and "Ada makan malam".
- **Tab labels (Phase E).** The native bar draws, scales and speaks its own labels: Plus Jakarta Sans SemiBold, 10 on iOS and 12 on Android, with no text-scale cap and no custom spoken label (`packages/mobile-ui/src/tabBar.ts`). The 1.15 cap and the iOS `tabBarAccessibilityLabel` are retired with the custom bar. At font scale 1.3 on a 360dp phone every label of both apps fits on one line in Indonesian and English (Dapur's "Customers" is 262px in a 270px item, about 3dp spare; larger scales are unchecked). The Jadwal day row's dish name wraps and never truncates.
- **Plan detail (Phase D, ruling D1).** `/subscriptions/{id}` is a pushed screen, not a sheet, because notification links and push taps open it cold, where a sheet has nothing under it (`apps/customer/src/plan/PlanDetail.tsx`, behind `apps/customer/app/subscriptions/[id].tsx`). Since Phase E it has no mood header: the native header carries the platform back, the package name is its `Screen nativeTitle` (the iOS large title, the Android first content line), final on the first frame when the link carried `?title=`, and the caterer is the first body line. A trailing chat button (`HeaderIconButton icon="chat" slot="trailing"`, labelled "Chat {katerer}") opens WhatsApp through `openCatererChat`, and shows only when one of this plan's deliveries in the read carries the caterer's phone (`PlanDetail.tsx:101-121`; ruling from the canvas `IosPlan`/`AndroidPlan`). The hero is the screen's one raised card on the mood's hero fill (`MoodFill` hero, radius 28) and does not overlap the header (the 58 overlap stays a Beranda rule). It holds the package photo (radius 20), a headline, the plan's dates in tabular figures, and "Sudah diperpanjang" ("Already renewed") when another plan renews this one (`PlanDetail.tsx:167-216`). The dates read "{Hari d Bln} – {Hari d Bln}", or the single day "{Hari d Bln}" when the plan starts and ends on the same day, in every state (`PlanDetail.tsx:199-204`; gate fix `63f7970`). The headline is "{n} hari lagi" from `remainingLabel` for an active plan, plain text with no ring, bar or streak (ruling D2); "Paket selesai" ("Plan finished") for a completed plan; and "Paket dibatalkan" ("Plan cancelled") for a cancelled one, with its date range (`PlanDetail.tsx:174-179`). Evidence: `plan.test.tsx` "an active plan that is not due: native title, caterer, hero with days left, no footer action", "Plan detail chat in the native header", "a completed plan reads Paket selesai with its dates, no upcoming days, and offers to continue", "a plan already renewed says Sudah diperpanjang and offers no renewal (Review Focus 2)", "a cancelled plan reads Paket dibatalkan with its dates, and offers nothing and lists nothing" and "%s shows its single date, not the same day twice" (an active, a completed and a cancelled one-day plan).
  - **Berikutnya.** Under the hero, "Berikutnya" lists at most five days of this plan only. Today comes first while this plan's delivery today still has a meal on its way: a meal that is not delivered, not failed ("Gagal diantar"), not cancelled and has no open report, so the plates Beranda counts as done (arrived, failed, reported) never count as coming; a day that lists no meals goes by its own status, and a cancelled day never shows. Today's row is dated the way Beranda dates today, with the short date (for example "Sabtu 10 Okt"). Then come the days after today, in date order (controller rulings on the final review, I3, and on its fix wave). Each row has a 60dp `PhotoRing` (sunrise ink for lunch or both meals, forest for dinner), the day and the dishes, and opens `/hari/{id}`. Today's row names the day's meals that are not cancelled, so it can still name a meal already done that day beside the one on its way (a deferred minor of the final wave). With no row it reads "Tidak ada antaran mendatang." A cancelled plan shows no "Berikutnya" at all (`PlanDetail.tsx:157, 218-266`; `packages/domain/src/plan.ts:33-56, 89`; the row itself is `upcomingRow`, `packages/domain/src/customer-day.ts:201-218`). So on a plan's last or only day the list no longer says "Tidak ada antaran mendatang." under a hero that still counts that day. Parked residual (controller ruling on the final wave): once today's meal is done on the plan's last day, the hero can still read "1 hari lagi" beside "Tidak ada antaran mendatang." until the nightly completion, because the days left are counted by the server while the list follows the meal; the ruling accepts this, since the list shows today only while a meal is on its way. Evidence: `plan.test.tsx` "Berikutnya lists this plan's next five days with their photo ring, day and dishes", "today's day leaves Berikutnya once its meal has arrived" and "a one-day trial on its day lists that day under Berikutnya, not an empty line"; `tests/plan.test.ts` "planDetail > lists only this plan's upcoming rows, at most 5, in date order" and, under "planDetail > today's day under Berikutnya", "comes first while a meal of it is not delivered, labelled the way Beranda labels today", "is left out once every meal of it is delivered or cancelled, and when the day is cancelled", "is left out when today's meal failed or has an open report, as Beranda counts them done" and "counts toward the limit of 5"; on the emulator, check F2 of [antislop audit 005](anti-slop/audit-005-2026-10-10.md).
  - **Footer action (rulings D3 and P2).** One `StickyAction` in `Screen`'s `footer`, chosen by the plan's action (`packages/domain/src/plan.ts:58-75`). A trial offers "Lanjutkan dengan paket penuh" to `/paket/{package_id}` only while it is active or completed and no later non-cancelled plan for the same package exists (ruling P2: never invite a duplicate purchase); otherwise a trial offers nothing. A plan that another non-cancelled plan renews says "Sudah diperpanjang" and offers nothing; a cancelled renewal does not count, so the plan can be renewed again. An active full plan with 3 or fewer days left (`renewalDue`, counted in remaining days) and a completed full plan offer "Lanjutkan paket" to `/renew/{id}`. Any other plan, an active plan not yet due included, has no footer. A cancelled plan and a plan shown from the offline copy have no footer whatever the action says (`PlanDetail.tsx:129-147`). Evidence: `plan.test.tsx` "an active plan due for renewal: Lanjutkan paket opens Perpanjang and counts renew_started", "a trial invites the full package and counts no renewal", the renewed and not-due tests above; `tests/plan.test.ts` "planDetail > action > renewed, never renew, once another non-cancelled plan renews it (Review Focus 2)", "... trial none once a later non-cancelled plan for the same package exists (Ruling P2)" and "... a cancelled renewal does not count: the plan can be renewed again".
  - **States.** Loading reads "Memuat paket…". A failed read falls back to the offline copy when there is one, and the plan then shows with "Terakhir diperbarui HH.MM · tidak ada koneksi" and no footer action; with no copy it reads "Belum bisa memuat" with the read's error and "Coba lagi". A plan the read does not hold (another account's, or gone from a stale link), and a plan in any status other than active, completed or cancelled, read "Paket tidak ditemukan." ("Plan not found.") with "Ke Beranda" (`goToTab("index")`), never a blank screen; the failed and not-found states are titled with the generic "Paket", never the link's title (Phase E I1). Signed out, the screen is `SignInFirst` under the native header, named once by its `nativeTitle`, with "Masuk" and a "Ke Beranda" text button that selects the Beranda tab (`PlanDetail.tsx:72-75`). Evidence: "loading reads Memuat paket… while the read is pending", "a failed read says Belum bisa memuat and Coba lagi reads again", "offline: the cached read shows the plan with no renew action", "a cold link to a plan the read does not hold says so and goes home (Review Focus 1)" and "a plan in a status the screen does not know reads as not found and goes home".
- **Plan links (Phase D).** `customerLink` resolves `/subscriptions/{id}` to the plan detail instead of Jadwal, so notification taps, push taps and the action feed open the plan; `/subscriptions/{id}/menu` still opens Pilih menu (`apps/customer/src/links.ts:53, 59-60`). Akun's "Paket aktif" and Paket saya push the plan detail through the shared `PlanList`, with the plan name as `?title=` (`apps/customer/src/plan/PlanList.tsx`). Beranda has no plan lines since Phase E: its plans row opens Paket saya (see Beranda). Evidence: `plan.test.tsx` "plan links > customerLink opens the plan detail and keeps the menu route", `today.test.tsx` "customerLink > maps server hrefs to the customer app routes", `account.test.tsx` "Akun lists packages and signs out", `recap.test.tsx` "the plans row > is one button of at least 48dp that opens Paket saya".
- **"Paket selesai" recap (Beranda, rulings D4 and D5).** A one-time body card for a full plan that has just ended. The candidates (`recapCandidates`, `packages/domain/src/plan.ts:94-110`) are completed plans that are not trials, have no non-cancelled renewal and ended within the last 14 Jakarta days (the 14th day shows, the 15th does not), newest first. The card (`apps/customer/src/today/RecapCard.tsx`) shows one plan per Beranda visit: the newest candidate whose seen mark, SecureStore `runtime.storageKey("recap.{id}")`, is not stored. Nothing renders until the marks are read, so a seen recap never flashes. The mark is written ("seen") once per Beranda mount, the first time the card renders with Beranda in front (`useIsFocused`). Beranda stays mounted under a screen pushed in its tab and under the screens that cover the tabs (Beli, Bayar, sign-in), and a card rendered there is not seen, so it writes nothing (gate fix `94ccb69`); a cold link to the plan detail opens it inside the Beranda tab with Beranda behind it, not in front, so it writes nothing either. The card then stays for the rest of that mount, which is what a visit means (controller ruling on the final review, M1): it is still there after a push and back, and after a switch to another tab and back within the same app process, while the next mount, for example after a relaunch, reads the mark and shows no card. "Tutup" hides it at once; an older unseen candidate shows on a later visit (`RecapCard.tsx:17-57`, the mark at 44-55).
  - **Content.** The package photo on the left (72dp, radius 12), "Paket selesai", "{paket} · {katerer}" and "{mulai} – {selesai}" in tabular figures (the single day when the plan starts and ends on the same day, gate fix `63f7970`, `RecapCard.tsx:80-85`), then "Lanjutkan paket" (primary, to `/renew/{id}`) and "Tutup" (text button) (`RecapCard.tsx:61-99`). There is no meal count, because the read cannot count an old plan's delivered meals truthfully (D5, R-17). It is a body card on theme colours (`surface` fill, 1dp `line` border, radius 20, `borderCurve: "continuous"`, no shadow), not a mood surface (`RecapCard.tsx:102-121`).
  - **Placement.** After the other-meal row, above "Menunggu Anda" (the Phase E order, see Beranda). With no running plan it leads the empty Beranda, above "Mau makan apa minggu ini?" (`Beranda.tsx`; `apps/customer/src/today/EmptyHome.tsx:13, 20`).
  - Evidence: `recap.test.tsx` "shows the photo, the plan, the caterer and the dates of a plan that ended yesterday, above the plans row", "writes the seen mark on its first render and stays for the rest of the visit; the next visit has no card", "does not write the seen mark while Beranda is mounted behind another screen", "writes the seen mark on the first render with Beranda in front, once, and keeps the card for the visit", "renders nothing until the seen mark has been read, so it never flashes", "names a one-day plan's single date, not the same day twice", "Tutup hides the card at once", "Lanjutkan paket opens the renewal and counts renew_started on each tap", "shows one card at a time: the plan that ended last, then the next one on a later visit", "shows on a Beranda with no running plan, above the catalogue invitation", "still shows for a plan that ended 14 days ago" and "shows no card when %s" (the plan was renewed, was a trial, ended 15 days ago, ended 180 days ago); `tests/plan.test.ts` "recapCandidates > counts days in Jakarta, not UTC (01:00 WIB is still the previous UTC day)" and "recapCandidates > never offers a plan that ended months ago (Review Focus 5)"; on the emulator, after clearing Expo Go's data, the recap re-check of [antislop audit 005](anti-slop/audit-005-2026-10-10.md) (first visit, looks, push and back, "Tutup", once across a relaunch, not eligible).
- **Payment success, "Pembayaran diterima" (Phase D).** The paid state of Bayar is its own beat, built from `paidSummary` (`packages/domain/src/plan.ts:128-143`). The header title reads "Bayar" in every stage, paid included. Since Phase F the success beat's own title is the one place that says "Pembayaran diterima" ("Payment received") (`apps/customer/src/buy/PaymentScreen.tsx:191`; see Native polish (Phase F), Feedback). The hero card is the screen's one mood surface besides the header (`MoodFill` hero, radius 28, padding 10, hero shadow): the food photo (aspect 1.65, radius 20), the package name (`heading`, `heroText`), the caterer (`heroMeta`) and "Antar pertama {Senin 19 Okt}" ("First delivery ...", tabular) (`apps/customer/src/buy/PaidOutcome.tsx:61-91`). The photo is the package photo when the first menu is not set (the customer picks the menus, there is no menu, it is pending, it is an empty slot menu, or it is the caterer's choice with no named dish); a set menu uses its cover (`PaidOutcome.tsx:25-40`).
  - **Reserved days.** Under the hero, on the theme body, "Jadwal antar Anda sudah tersimpan." ("Your deliveries are booked.") and the reserved dates as plain tags (see Chips / Status) in a wrapping row: the first 6 dates of `quote.dates`, sorted, then "dan {n} hari lainnya" ("and {n} more days"). There is no horizontal scroll (ruling D6, with the tags ruling replacing its chips) (`PaidOutcome.tsx:93-109`).
  - **Nothing else.** The paid beat drops the payment help ("Bantuan pembayaran") and the "{paket} · {total}" line that the other outcomes keep: the paid branch renders the hero, the booked sentence, the tags and the footer only (`apps/customer/src/buy/PaymentOutcome.tsx:91`).
  - **Actions (ruling D7, with the controller ruling on the final review, I2, and Phase E).** The footer has the `StickyAction` "Lihat jadwal"; when the offer's `menuSelectionMode` is "customer", a secondary "Pilih menu"; and last a text button "Ke Beranda". "Lihat jadwal" and "Ke Beranda" select their tab through `goToTab("jadwal")` and `goToTab("index")`, which close Bayar and every screen above the tabs first and pop the tab to its root, so no second Jadwal opens and back from the tab never reopens the purchase; on a cold open, with no tabs under it, the tab replaces the screen. "Pilih menu" leaves through `leaveFor`, which closes the screens above the tabs and opens Pilih menu inside the current tab, so back from it never reaches checkout or Bayar (`PaidOutcome.tsx:105-120`; `apps/customer/src/nav.ts`).
  - **Paid is final.** While paid, the header shows no back and the iOS edge swipe is off (`gestureEnabled: false`, `headerBackVisible: false`), and every user back that still reaches the screen goes home through `goToTab("index")`, whatever opened it (a purchase, a renewal, Payments or a notification): a `beforeRemove` listener turns Close and the hardware back (GO_BACK) and the native back or swipe (a POP with a source) into the way home, and a hardware-back listener registered only while paid does the same. The app's own exits carry no source and pass through. While paying, the swipe stays on and back is back (`PaymentScreen.tsx:16-27, 72-100`). The iOS swipe is checked through the option value in Jest only, and the hardware back and Close on the Android emulator only; neither is verified on an iOS device, which is a release item.
  - **Checking guard (Review Focus 4).** `paidSummary` is null until the checkout is paid and its subscription id is set, and a paid read without it stays "Memeriksa pembayaran" under the "Bayar" header, with no hero, dates or paid actions (`PaymentScreen.tsx:46-50`; `plan.ts:129-130`).
  - Evidence: `buy.test.tsx` (describe "Pembayaran diterima") "shows the food, the package, the first delivery and every reserved day of a short plan" (it also asserts no "Bantuan pembayaran" and no total), "a long plan shows its first six days, then how many more", "offers the schedule first and home last when the caterer picks the menus", "adds Pilih menu between them when the customer picks the menus, and shows the package photo, not a menu template", "back after paying a fresh purchase / a renewal / a checkout opened directly (Payments or a notification) goes home, never back to checkout", "{the header back | the hardware back | Ke Beranda | Lihat jadwal} after paying selects the {Beranda | Jadwal} tab", "handles the hardware back only once paid", "turns the iOS edge swipe off once paid, so a swipe cannot pop back to checkout", "opened already paid has the iOS edge swipe and the header back off" and "paid without a booking stays in checking and refreshes from the provider"; `tests/plan.test.ts` "paidSummary > is null while pending and for a paid checkout with no subscription id yet (Review Focus 4)" and "paidSummary > sorts the dates, keeps the first 6 and counts the rest".
- **Dapur Hari ini.** The header holds the kitchen name, the date button ("Kamis 8 Okt" with a chevron, 48dp), the toggle and the count card. The date button replaces the Hari ini / Besok segmented control and flips between today and tomorrow. The count card is a mood surface. It shows the session's portions and addresses, "Antar HH.MM" and, under them, the rantang track with the labels "Dimasak", "Diantar" and "Sampai" and a one-line caption from the session's stage (for example "Terjadwal", then "Dimasak 08.10"). The delivery time counts only the rows still being served, so the window of a stop marked "Gagal diantar" never sets it. With no session for the selected meal the screen says so and offers "Lihat makan {other}" when the other meal has one, unless the day is finished and no row of this meal was marked "Gagal diantar" (see Dapur Semua beres). When every remaining row of the meal was marked "Gagal diantar" (so there is no session), it says "{n} antaran makan {siang|malam} ditandai Gagal diantar." ("{n} {lunch|dinner} deliveries marked as failed.", "delivery" for one) instead of "no deliveries", and the count is of the failed rows only. **Dapur layout scale (October 2026):** the count card is gone. The header is the band's meta row with the compact toggle, the date button, the figure strip (porsi, paket, alamat, "Antar HH.MM") and the compact rantang track, which does not draw its state-words line; the words ("Terjadwal", "Dimasak 08.10") stay in its accessibility value only.
- **Mulai masak (built, on Dapur Hari ini).** `delivery.cook` is the kitchen's "Mulai masak" ("Start cooking") tap for one meal of one day. It takes `{catererId, date, meal}` and works for the owner and staff of that caterer only, and only for today in Asia/Jakarta: another date returns `INVALID_DATE`, a missing or extra key returns `INVALID_INPUT`, a signed-out caller gets `UNAUTHORIZED`, and any other signed-in user gets `FORBIDDEN`. It moves that caterer's meals of that day and meal that are still `scheduled` to `preparing`, stamps `cooking_started_at`, and returns `{moved}`; the day itself moves to `preparing` only if it was still `scheduled`. A second press, or a press after "Berangkat antar", returns `{moved: 0}`, keeps the first stamp and never moves a status backwards or pulls a day back from out for delivery. Repeating a request id returns the first answer; the same id with other input is a `CONFLICT`. Cook takes the caterer lock and then the day and meal locks in the same order as depart, so the two cannot interleave. The Dapur button, its confirmation and its copy are on Dapur Hari ini (see Dapur footer action).
- **Cooking is a kitchen tap, and it sends no push.** The cooking time is written by `delivery.cook` and by nothing else, so a cooking time exists only because the kitchen tapped "Mulai masak". A meal that the older batch status command moved to `preparing` has no cooking time. Cooking is not on the immediate-push list (ruling C2, see the Phase C rulings): each customer with a moved meal gets one realtime event row, so an open app reads again, and nothing else is sent. "Berangkat antar" keeps its push. The plate already says "Sedang dimasak"; the Beranda hero shows the "Dimasak" journey caption and the track (Task 6), and the Dapur count card shows both (Task 8).
- **Cooking is not a production change.** The production signature that decides whether the kitchen is warned "production changed" reads `preparing` as `scheduled` and ignores the cooking time, who confirmed arrival and the day's version, so tapping "Mulai masak" never raises the warning. A move to out for delivery is not masked and still raises it, and a real change to the address, date, portions or menu still counts.
- **What the delivery read adds.** Each meal of the delivery read now carries `cooking_started_at` (a time or null) and `confirmed_by` (`customer`, `auto`, `caterer` or null). The domain code reads both (see "Plate, track and story data (Phase C)" under Native mood and theme); the Dapur count card and the Beranda hero's track show the cooking time in their caption ("Dimasak 08.10") and, when the system closed the meal, "Tercatat sampai".
- **Kitchen session (rule built in the domain, on Dapur Hari ini).** One meal of the day, as Dapur runs it, is one session over that day's deliveries that serve the meal. Rows marked "Gagal diantar" and cancelled rows are left out, and with no row left there is no session. The session's stage is its least advanced row: with one stop already left and the rest scheduled the session is still scheduled, so the rule still allows "Mulai masak" and the session's journey caption stays true. The cooking and departure times are the earliest of the rows. "Mulai masak" is offered on today only, while any row is scheduled. "Berangkat antar" is offered on today only, once no row is scheduled and some row is cooking. A session reads as recorded by the system only when every delivered row was closed by the system. The portions, addresses, cooking recap and stops all come from the same rows, and each recap dish carries its photo, or an empty string. The day is finished only when it is today, it has a row, every row is delivered or marked "Gagal diantar", and no report for that date is still open. The "Buka semua di Peta" link opens at most the first ten stops in route order, the last as the destination and the others as waypoints; a stop with no address takes no place among the ten.
- **Dapur Daftar masak.** On Hari ini, until the meal leaves, "Daftar masak" lists one row per dish of the session's cooking recap, never an invented dish: the quantity (`heading`, tabular), the dish photo or, without one, the sun icon for lunch and the moon icon for dinner, the name, and a round checkbox. The list sits where "Yang dimasak" used to be; "Per paket", the "Menu belum diisi" lines with the owner's "Isi menu", "Bagikan" and "Cetak" are unchanged. They show with the checklist and go with it once the meal is out for delivery (see Dapur order and stage). Under the rows a caption says "Centang hanya catatan dapur, tidak dikirim ke pelanggan." ("Ticks are a kitchen note only and are not sent to customers."). Ticks are a note on this phone only (ruling C11): one SecureStore key per caterer, `runtime.storageKey("ticks.<catererId>")`, holding the ticked dishes by date and meal, never sent to the server. Every write drops the dates before today (Jakarta), so a tick from yesterday is never shown today and is gone after the next tick; tomorrow's ticks are kept. A dish is identified by its category and name, so the same name in two groups is two rows. Ticks never gate an action: "Mulai masak" and "Berangkat antar" read only the session, not the list. Tomorrow shows the same list with no footer action. **Dapur layout scale (October 2026):** the quantity is `section` 800 in a 48 column, "Daftar masak" is a section header carrying "n menu" with Bagikan and Cetak as 48 icon buttons, and "Per paket" is its own section of 40 key-value rows.
- **Dapur footer action.** One sticky action sits in the screen footer, above the tab bar, and follows the day in order: "Mulai masak" while any active row of the selected meal is still scheduled, then "Berangkat antar · {n} porsi" once none is scheduled and some row is cooking. Neither is offered once the meal is out for delivery, on tomorrow, or on a copy kept from before the connection dropped (the existing "tidak ada sinyal" card explains why). Each asks first. "Mulai masak" asks "Mulai masak makan siang?" ("makan malam" for dinner) with "Pelanggan melihat status Dimasak." and the buttons "Batal" and "Mulai". "Berangkat antar" asks "Berangkat antar sekarang?" with "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat." and the buttons "Batal" and "Berangkat" (ruling C5: the line carries no number, because the push reaches only customers with an account and the kitchen cannot count them). The same line is the footer caption above the "Berangkat antar" button. Confirming sends `delivery.cook` or `delivery.depart` with the caterer, today's date and the meal, plays the `success` haptic and counts `cook_started` or `depart_tapped`. While the command runs the button is busy and a second press sends nothing.
- **Dapur action failures.** A failure is one plain line above the button, in the danger ink and selectable. A date that is no longer today reads "Hanya bisa untuk hari ini." ("Only possible for today."); any other code goes through the app's error text, falling back to "Belum berhasil. Coba lagi."; the day is read again after any failure. A late tap that changed nothing (the database answers `{moved: 0}`) plays no haptic and counts nothing; the line reads "Sudah ditandai dimasak." ("Already marked as cooking.") or "Sudah ditandai berangkat." ("Already marked as out for delivery."), in the normal caption ink.
- **Dapur Urutan antar.** On Hari ini and Besok the session card ends with "Urutan antar" ("Delivery order"): the session's stops in route order. A row marked "Gagal diantar" or cancelled is not in the list, because the list is the session's own stops. Each stop is a `StopRow`: its number in a sage circle, the customer's name in bold and, on the same wrapping line, "{n} porsi · {package}", then the address on one line in Muted (line and area, for example "Jl. Melati 5, Tebet"). Only the address is held to one line; the whole address is in the row's spoken label ("1. Bu Sari Wulandari, 2 porsi · Makan Siang Rumahan, Jl. Melati 5, Tebet"). A stop's delivery note sits under its row, indented to the name, in sunrise ink, and wraps. The first three stops show; "Lihat {n} alamat lainnya" ("Show {n} more addresses", "Show 1 more address") reveals the rest and does not fold them back. Rows are separated by a hairline. **Dapur layout scale (October 2026):** a stop is 64, with a one-line title "{name} · {n} porsi", a one-line meta "{package} · {address}", and its delivery note as one more charcoal meta line inside the row; the spoken label still carries the whole text.
- **Dapur stop buttons.** Each row has a 48dp map button, labelled "Buka peta {name}", that opens that stop's maps link. A row also has a 48dp "…" button (ruling C7) only when its sheet would send something: a move ("Pindah tanggal", while the delivery can still be moved), or, on Hari ini, a "Gagal diantar" report while the stop's meal can still fail (it is not yet delivered or failed). A delivered stop has no "…" button, and a failed stop is not in the list. The button opens the existing exception sheet for that stop, and its name says what the sheet can do, followed by a colon and the customer's name, like the map button, so a screen reader hears which stop each button belongs to: "Laporkan masalah atau pindah hari: {name}" ("Report a problem or move the day: {name}") when it offers both, "Laporkan masalah: {name}" ("Report a problem: {name}") when it can only report (the change deadline has passed, the package has fixed dates, the customer is not on this kitchen's list, or the day is no longer scheduled), and "Pindah hari: {name}" ("Move the day: {name}") when it can only move, which is the only form on Besok. The sheet offers "Gagal diantar" only when that report has steps to send, and never closes as if saved when nothing was sent: with no choice to offer it says "Tidak ada yang bisa dilaporkan untuk alamat ini." ("There is nothing to report for this stop.") and "Simpan laporan" stays disabled. A copy kept from before the connection dropped shows no "…" button, because it cannot be acted on. There is no per-stop tick: arrival is recorded automatically.
- **Dapur Buka semua di Peta and WhatsApp.** Under the list, "Buka semua di Peta" ("Open all in Maps") opens one Google Maps directions link for the whole route, the last stop as the destination and the others as waypoints (ruling C8). With more than ten stops the link takes only the first ten and the button reads "Buka 10 alamat pertama di Peta" ("Open the first 10 addresses in Maps"); a stop with no address takes no place among them, and when stops without an address leave fewer than ten in the link, the button reads "Buka semua di Peta". It is a secondary button above "Bagikan rute ke WhatsApp", which is the primary button and is unchanged: it shares the route as WhatsApp text, and for a long route the next press reads "Bagikan bagian {n}" and shares the next part.
- **Dapur order and stage.** While the meal is scheduled or cooking (ruling C6), the delivery order sits in the same card below the checklist, after "Per paket", "Bagikan" and "Cetak", so a stop can still be reported or moved before the meal leaves. Once the meal is out for delivery, or has arrived, the cooking part goes ("Per paket", "Daftar masak", the "Menu belum diisi" lines, "Bagikan" and "Cetak"), the order stands alone under the meal's name and the footer action is gone. While the meal is out for delivery, the header's meta line reads "{kitchen} · Sedang diantar" ("{kitchen} · On the way") in place of "· Hari ini" and the count card's track reads "Berangkat {HH.MM}". Once it has arrived, the header goes back to "{kitchen} · Hari ini" and the track reads "Sampai", or "Tercatat sampai" when the system closed the meal. On Hari ini, under the order, one line in the caption style says "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya." ("Deliveries are recorded as arrived automatically, unless you report a problem at the address."); it names the "…" button's job (ruling C7) and is not shown on Besok or on a copy kept from before the connection dropped. When the session's stage changes the body fades in over 220ms (`content`, through `FadeSwap`; instant under reduced motion), as it already did for a change of day or mood. **Superseded by Phase G (GC-F17, kept by GC-F18):** a stage change (Mulai masak, Berangkat antar, Semua beres) and the Siang/Malam switch change the body in place with no fade; only a new day or the first read fades (see Native Phase G, Swaps, mascot stills and the macro grid). **Dapur layout scale (October 2026):** the cooking part and the order are separate sections 24 apart, not one card. Once the meal is out for delivery the cooking part folds into one 48 row, "Sudah dimasak · {n} porsi", and the order follows under it. The track's "Berangkat {HH.MM}", "Sampai" and "Tercatat sampai" are read by screen readers only, because the compact track draws no words line.
- **Dapur Semua beres.** When the day is finished, the body shows a sage card in place of the session card or the no-session card: a check mark, "Semua beres hari ini" ("All done today"), a line of outcome and a "Lihat besok" ("See tomorrow") button that switches the date to tomorrow. The day is finished by the domain rule (it is today, it has at least one non-cancelled row, every such row of both meals is delivered or marked "Gagal diantar", and no report for today is still open, whether new, answered or anything short of resolved). The outcome line is "Semua antaran tercatat sampai." ("All deliveries recorded as arrived.") only when no row was marked "Gagal diantar". Otherwise it counts both from the real rows of both meals: "{d} tercatat sampai, {f} ditandai Gagal diantar." ("{d} recorded as arrived, {f} marked as failed."), so a day with failures never reads as clean. The card is not shown on Besok, on a copy kept from before the connection dropped, while the customer reports could not be read (a failed read could hide an open report), or while the report list is still loading. A report still open keeps the sessions on screen. A meal whose rows all failed keeps its own card, "{n} antaran makan {siang|malam} ditandai Gagal diantar.", which the done card would otherwise cover; the other meal can still show the done card, counting every row. The header and the count card stay as they are.
- **Dapur Menu.** The header carries the week range and a day strip of 64-high buttons (weekday, date, a check when that day's menu is filled; six or seven delivery days wrap, never stretch). A dish without a photo shows a dashed camera tile and a "Tambah foto" pill with a spinner and "Mengunggah…" while a photo is on its way. "Tambah foto" saves the photo on that day's menu item only, never the library dish (B4), and is offered only on days an owner can still edit. A closed day reads "Sudah lewat batas ubah", muted, when it has no dishes; a past day reads "Lewat". "Ubah menu" is hidden for closed days. A preview card shows the cover customers will see, only when the day has dishes. **Dapur layout scale (October 2026):** the day strip is one row of tiles at least 56 tall that share the width for any number of days, and the dashed camera tile is itself the 48 "Tambah foto" action, with "Mengunggah…" as the row's meta line while a photo uploads.
- **Headers on other screens (Phase E).** A `MoodHeader` heads only the tab roots (Beranda, Jadwal, Jelajah, Akun; Hari ini, Pelanggan, Menu, Usaha), the signed-out Akun and Jadwal, and Dapur's sign-in and role gate. Every pushed screen uses the platform's native header and has no mood block (see Native navigation and chrome). Customer PackageDetail with a photo keeps the photo as its header (B3) under a transparent native bar. The claim states are titled, through `Screen nativeTitle`, "Tautan tidak bisa dipakai" ("This link can't be used") for a dead link, "Belum bisa memuat" ("Couldn't load yet") when offline and "Membuka tautan" ("Opening the link") while loading; "Dari {katering}", the spinner and the Catera wordmark stay in the body. `SignInFirst` is the signed-out stand-in on every customer screen that needs an account: Akun, Jadwal, the plan detail, Paket saya, Alamat, Notifikasi, Riwayat pembayaran, Disimpan, Bantuan dan laporan, Ada masalah, Pilih menu and Hari. It draws its own mood header only on the two tab roots, Akun and Jadwal, where the caller passes a header test id; on a pushed screen it names the screen once through `Screen nativeTitle` and shows only its sentence and button in the body (signed-out Hari uses the day its link carried) (`apps/customer/src/account/SignInFirst.tsx`). The failure screen of the Dapur `ScreenGuard` keeps no header of its own: its only host, Uang, sits under the native bar, and its `Screen` drops the top safe-area edge there (`apps/caterer/src/ErrorBoundary.tsx:17`).

### Sheets and keyboard

**Superseded by Phase F (October 11, 2026):** the bottom `Sheet` described here was deleted. Sheets are react-native-screens form sheet routes (see Native polish (Phase F), Action hierarchy and native sheets).

The bottom `Sheet` lifts the focused field above the keyboard: the sheet body scrolls and the sheet pads for the keyboard height (verified on Android with the Dapur import row editor; the iOS `keyboardWillShow` path is untested). It is the fifth approved light exception, listed above.

### Plate, track and story data (Phase C)

These are the rules the domain code applies today. The Dapur count card shows the track and its caption (Task 8). The Beranda hero track and its caption are built (Task 6), and the Menu besok row and story are built (Task 7).

**Journey captions.** One short line says what is true now; it is not the plate sentence ("Sedang dimasak" and the others, above), the Dapur count card shows it (Task 8), and the Beranda hero shows it on its track (Task 6). Times are `HH.MM` on the Asia/Jakarta clock. A time that is missing or unreadable falls back to the plain caption.

| Stage | Caption | With the time missing |
| --- | --- | --- |
| Scheduled | "Terjadwal" ("Scheduled") | not applicable |
| Cooking | "Dimasak 08.10" ("Cooking since 08.10") | "Dimasak" ("Cooking") |
| On the way | "Berangkat 10.42" ("Left at 10.42") | "Sedang diantar" ("On the way") |
| Arrived, closed by the customer or the caterer | "Sampai" ("Arrived") | not applicable |
| Arrived, closed by the system because nobody tapped | "Tercatat sampai" ("Recorded as arrived") | not applicable |

A meal marked "Gagal diantar" has no caption; its stage stays what its timestamps imply (left, else cooking, else scheduled). "Dimasak" without a time is what a meal reads when something other than "Mulai masak" set it to cooking.

**Tomorrow's story.** The story has one part per delivery and meal for tomorrow in Jakarta, every lunch before any dinner, and the delivery window orders parts of the same meal. Cancelled meals and cancelled days make no part; with nothing to show there is no story. The part's title is the main dish: the dish whose category is the main dish, else the dish whose photo is the menu cover, else the first dish in composition order; the other dishes follow as its sides in composition order. A legacy menu with no dish rows has only its name, as the title. A part is marked changeable only while the day itself can be changed, and then carries the deadline as text such as "hari ini 17.00" ("today 17.00"); once the cutoff has passed, or when only the address can still be edited, it is not changeable and carries no deadline. A part is closed once its cutoff has passed, the cutoff minute included; an unreadable cutoff is not closed; closed holds whatever the plan lets move, so a fixed plan is closed after its cutoff and not before.

**A menu that is not set shows the package photo.** A part's menu counts as not set when there is no menu, when the customer still has to choose, when it is left to the caterer with no dishes, when it is an empty slot menu, or when it has no dish and no name. Such a part has no title and no sides, and its photo is the package photo, never a photo the menu template happens to carry. A set menu uses its cover photo, then the package photo. The upcoming-days rows follow the same rule for their photo: a menu that is not set shows the package photo, never a photo the menu template carries; a set menu uses its cover photo, then the package photo, else none.

### Daily-loop components (Phase C)

Six shared components live in `@catera/mobile-ui`. The package imports nothing from the domain code: the apps compute stages, captions and labels and pass them in. All six are built and covered by tests. Three of them (`RantangTrack`, `CheckRow`, `StickyAction`) are on the Dapur Hari ini screen (Task 8). `StoryViewer` is on the Menu besok story (Task 7). `RantangTrack` is also on the Beranda hero (Task 6). `StopRow` is on the Dapur Hari ini delivery order (Task 9). `Rantang` is already drawn by `PhotoRing`. Phase D adds no shared component: `StickyAction` is also the footer action of the plan detail and of the paid beat on Bayar.

- **Rantang** is the lunchbox drawing (body, divider, handle) that `PhotoRing` already used, now one shared drawing. An outline is a closed box that has not left; a filled one tints the body with its colour at 30%. It is decorative and hidden from screen readers. It remains a drawing in code, not artwork.
- **RantangTrack** shows a meal's journey: a caption above, a line with three stops (kitchen, road, door), a 24dp lunchbox marker above the current stop, and three stop labels below. The marker is an outline while the meal is scheduled and tinted from cooking on. It sits at the kitchen stop for scheduled and cooking, halfway for out for delivery and at the door for arrived. It reads the mood's hero inks (ruling C14, see the Phase C rulings): `heroText` for the marker, the progress line, the stops reached and the caption, `heroMeta` for the stops not yet reached, the rest of the line and the stop labels. Both measured at least 4.5:1 on the hero in all four looks, so it needs no new token, and it belongs only on a surface that carries hero inks (the Beranda hero card, the Dapur count card). A screen reader hears the caption as one element; the three stop labels are decoration and are hidden. Dapur draws it at `size="compact"` in the Hari ini header (rail 40, no caption line, the caption kept in the accessibility value; see Dapur layout scale).
- **StoryViewer** is a full-screen story on black in every theme, so its inks are the fixed light inks, like the story cover. It has one bar per part (the bars up to the current part are solid), a header line beside a 48dp close button, and the current part below, which the caller supplies. The content is one press target. A tap (the finger moved no more than 10dp on either axis) is split at half the window width at the lift point: left half back, right half forward. A sideways swipe of more than 40dp, mostly sideways (the horizontal move more than 1.5 times the vertical one), turns the page in the story convention (right to left forward, left to right back). Any other drag does nothing, and a button inside the content keeps its own press. Controller ruling: this tap region is an accepted exception to the rule above that every tappable gives press feedback and that no raw `Pressable` is used. It is a plain `Pressable` with no press style, and its feedback is the page turn itself, the new part fading in over 220ms. The first part has no back and the last has no forward, so a tap on the left of the first part or on the right of the last part, a left-to-right swipe on the first part and a right-to-left swipe on the last part do nothing and give no feedback at all. Screen readers get the header as an adjustable with increment and decrement actions that move between parts, and the close button; the accessibility escape action closes the story. A part must fit the screen: the photo flexes and long text wraps. The viewer wraps the part in a view that fills the content region (`FadeSwap` takes an optional style and the viewer passes `{ flex: 1 }`), so a part's own `flex: 1` fills it; other users of `FadeSwap` keep a wrapper that sizes to its content.
- **CheckRow** is one line of the kitchen's checklist, and the whole row is the button, at least 56dp: the quantity (set as `heading` with tabular figures), a 44dp dish photo or, with no photo, the meal icon (sun for lunch, moon for dinner), the dish name, and a 48dp round box. The name wraps and is never truncated. The box has the control ring and fills forest with a cream check when ticked. A ticked row keeps its text at full opacity: the name turns `muted` and is struck through, the quantity turns `muted`, and only the photo or icon dims to 0.55. It is a checkbox with its state, labelled with the quantity and the dish ("8× Ayam bakar"), and presses with a `tap` haptic. Under a 48 touch target (Dapur) the row is 56 with a 48 quantity column in `section` 800 and a 40 photo that rounds itself (see Dapur layout scale).
- **StopRow** is one stop of the delivery order: its number in a 28dp sage circle, the name in bold followed by a detail on the same wrapping line, and the address on one line in Muted. Within this row the address is the only text held to one line, so a long address cannot push the buttons off screen. The full address is in the accessibility label of the text block. A 48dp map button always shows; a 48dp "…" button for other actions shows only when the caller has some. Under a 48 touch target (Dapur) the row is 64 with a one-line title and meta, and both buttons share one 96 column that keeps the "…" room when there is no "…" (see Dapur layout scale).
- **StickyAction** is the one action a screen is for: an optional caption line above a full-width primary button. Callers put it in `Screen`'s `footer` slot, so the page scrolls above it and it never covers content; the footer already supplies the 16dp padding, the top border, the surface fill and the 760dp cap, and StickyAction adds none of its own. While busy it swaps the label for a spinner and ignores presses; the button keeps its label as its accessible name. While disabled it ignores presses.

### Usage counts (Phases C and D)

Both native apps count how often a few events happen, to learn whether the daily loop and the purchase and renewal beats are used, and keep no personal data with the count. A count is one row per Jakarta day, app (`customer` or `dapur`) and event name, holding how many times it happened. The table has no user, caterer, device, session or request column, and the apps cannot read it back. Only a signed-in app can add to it. The names are fixed in one allowlist: `app_open`, `tomorrow_story_viewed`, `journey_viewed`, `plan_sheet_opened`, `renew_started`, `purchase_confirmed_viewed`, `cook_started` and `depart_tapped`. All eight are sent: `app_open`, `tomorrow_story_viewed` (the Menu besok story), `journey_viewed` (the Beranda hero), `cook_started` and `depart_tapped` (Dapur Hari ini), and from Phase D `plan_sheet_opened`, `renew_started` and `purchase_confirmed_viewed`. `plan_sheet_opened` is counted once per plan detail open, and only when a plan is shown, never for its loading, error or not-found states (`apps/customer/src/plan/PlanDetail.tsx:86-92`). `renew_started` is counted on each renewal tap: "Lanjutkan paket" on the plan detail, "Lanjutkan paket" on the "Paket selesai" recap, and "Perpanjang" on Beranda's "Menunggu Anda" renewal row, which replaced the renewal card in Phase E (controller ruling on the final review, deferred row 11) (`PlanDetail.tsx`, `apps/customer/src/today/RecapCard.tsx`, `apps/customer/src/today/WaitingList.tsx`). Two other ways into `/renew/{id}` count nothing: "Bayar lagi" for a renewal checkout, whose link `payAgainHref` builds (`apps/customer/src/buy/PaymentOutcome.tsx:53-61`) and which shows on Bayar when the checkout expired or failed (`PaymentOutcome.tsx:136`) and on Riwayat pembayaran for expired checkouts only (`apps/customer/src/account/Payments.tsx:72`); and a server `/renew/{id}` link resolved through `customerLink` (`apps/customer/src/links.ts:76-77`). The trial's "Lanjutkan dengan paket penuh" counts nothing either (`PlanDetail.tsx:142-146`). `purchase_confirmed_viewed` is counted once per checkout id per app process, through a module-level `Set`, for the paid beat only and never while the payment is still being checked (`apps/customer/src/buy/PaidOutcome.tsx:22-23, 53-57`). Evidence: `plan.test.tsx` "counts plan_sheet_opened once per open, however often the screen renders" and "a plan in a status the screen does not know reads as not found and goes home"; `recap.test.tsx` "Lanjutkan paket opens the renewal and counts renew_started on each tap" and "the renewal row > Perpanjang opens the renewal and counts renew_started on each tap"; `buy.test.tsx` "counts purchase_confirmed_viewed once per checkout id, however often it is opened" and "does not count purchase_confirmed_viewed while the payment is still being checked". `app_open` is counted at most once per Jakarta day: the day is kept on the device and in memory and is stored before the request goes out, so a restart, a return to the foreground or a failed request on the same day does not count again, and the first open after midnight in Jakarta counts. Counting never blocks the app. Sending returns at once, does not wait for the answer, never retries, swallows every failure without logging it, and does nothing when nobody is signed in. A count lost to a bad connection is accepted. No count appears in any screen or copy. The behaviour is covered by tests; no emulator or device check was made.

### Demo states (Phase D, ruling D9)

The demo database carries synthetic records for the demo customer, Nadia Putri, and the demo kitchen, Dapur Senja, so that every Phase D beat and the Phase C kitchen loop can be reached in demo mode. They are built relative to the day the demo database is created (`applyDemoStates`, `packages/backend/src/demo-states.ts:285-302`, called last by `createDemoDatabase` at `packages/backend/src/database.ts:646`). They live in demo storage only and are never a migration, so hosted data never carries them, and every added customer, address and package carries the seed's synthetic wording ("Contoh", "Data sintetis"). Evidence for this section: `tests/demo-states.test.ts`, whose shape tests run both in memory and against a fresh stored database.

- **Only on a freshly seeded demo.** The states are added only to a demo database that `createDemoDatabase` has just seeded in the same call: an in-memory one, or a stored one in a new folder. A stored demo made before the states is left untouched and never throws; it logs one line per start that names the reset: "Catera demo: {folder} was made before the synthetic demo states and is left as it is. To get the states, stop the app and delete {folder}, or set CATERA_DEMO_DATA_DIR to a new folder." A fresh stored demo keeps its states, once, across restarts, and Nadia's plans have the same shape in memory and in a fresh stored database. Evidence: "a stored demo database made before the states > starts, gets no states, says how to reset once, and leaves its records as they were", "a fresh stored demo database keeps its states once across restarts", "Nadia's plans have the same shape in memory and in a fresh stored database" and "is built from the day it is given, and never ships in a migration".

**What each state is.** Each row names the state, the record it adds and what it reaches on screen.

| State | Record | What it reaches |
| --- | --- | --- |
| `renewDue` | Ikan Bumbu Kuning at Rumah Rasa (Bandung): 3 days delivered, 2 left (today and the next weekday), no renewal | Plan detail with "Lanjutkan paket" |
| `renewed` | Ikan Bumbu Kuning Dua Pekan, bought by a real checkout for 10 weekdays from the first weekday on or after today plus 3, renewed by a real paid renewal checkout that starts after it ends | Plan detail with "Sudah diperpanjang" |
| `trialActive` | Plant-based Everyday trial, bought by a real checkout: one day, the first weekday on or after today plus 2 | Plan detail with "Lanjutkan dengan paket penuh" |
| `completedRecent` | Ayam Sambal Rumahan, ended yesterday, not renewed | The "Paket selesai" recap and a completed plan detail |
| `completedOld` | Ayam Panggang Harian, ended exactly 180 days before the creation day, not renewed | No recap |
| `autoArrived` | `completedRecent`'s last day, yesterday, closed by the nightly job (`confirmed_by: 'auto'`, `confirmed_at` set); no meal today is closed by the system | No Beranda plate reads "Tercatat sampai" |
| `kitchenToday` | Dapur Senja today: 6 stops in each of lunch and dinner, Nadia once (the operating fixture's Rantang Nusantara trial, Kantor, 2 portions, both meals scheduled, no report) and five synthetic "Contoh" customers | Dapur Hari ini with "Lihat 3 alamat lainnya" under the first 3 stops |
| `paidLong` | Two paid checkouts with 10 upcoming dates and a subscription (the "Dua Pekan" plan and its renewal) | The paid beat with 6 date tags, then "dan 4 hari lainnya" |
| `paidMenuChoice` | A paid checkout of "Pilih Sendiri Nusantara", whose menu the customer chooses; `/subscriptions/{id}/menu` answers | The paid beat with "Pilih menu" |
| `paidPending` | A paid checkout of Ayam Sambal Rumahan with `subscription_id: null` | Bayar stays "Memeriksa pembayaran" |

Overall, Nadia has 10 plans at 3 caterers and three addresses (Kantor, Rumah, Rumah Bandung), all with the synthetic wording; there are exactly 5 synthetic customers; no two of Nadia's active plans of one package overlap; the catalogue has 8 offers, two of them synthetic at Rumah Rasa. Evidence: the test named after each state ("renewDue: an active full plan with 2 or 3 days left and no renewal", "renewed: an active full plan that another non-cancelled plan renews", "trialActive: an active trial plan ahead that has not been continued", "completedRecent: a completed full plan that ended yesterday with no renewal", "completedOld: a completed full plan that ended 180 days ago with no renewal", "autoArrived: yesterday's last delivery was closed by the system, and nothing today is", "kitchenToday: one Dapur Senja delivery for Nadia today, both meals scheduled, no open report, six stops", the two "paidLong" tests, "paidMenuChoice: a paid checkout whose offer lets the customer choose the menu", "paidPending: the database holds a paid checkout with no subscription yet"), "Nadia has ten plans at three caterers", "every added customer, address and package carries the synthetic wording", "no two active plans of one package overlap, as checkout's own rule requires", and `tests/database.test.ts` "returns public packages without disclosing customer data".

- **"Tercatat sampai" has no demo state.** Production's nightly auto-close only closes days before today (`supabase/migrations/20261008102000_delivery_depart.sql:46`), so a state with today's meal closed by the system would show what production cannot reach, and the demo does not fabricate it (ruling on Phase D Task 1). The wording is covered by Jest (see Beranda hero track); its reachability on Beranda is a release note for the owner.
- **Gate procedure.** To see the states: (1) create a new, empty folder for the demo on the gate day, never `.data/v1` or any folder an earlier server wrote, because an older folder starts without the states and logs the reset line; (2) start the web backend (`npm run dev`, port 3000) with `CATERA_V1_DEMO=true`, `CATERA_DEMO_DATA_DIR` set to that folder and `CATERA_V1_FIXTURES` unset, so the first request seeds the folder and adds the states dated from that day, and keep the same server and folder for the whole gate (on a later day the same records are read against a newer today); (3) point the apps at it as before (`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`) and sign in with the demo buttons, customer Nadia Putri and the Dapur Senja owner.

### Splash (owner decision, October 9, 2026)

**Superseded by Decision B (October 10, 2026) and Phase F:** the splash is now the theme canvas (light `#FDFAF3`, dark `#151514`) with a transparent mark, and the Android adaptive icon is configured (see Native polish (Phase F), Launch). The text below is kept as the record of the earlier ruling.

There is no dark splash until real transparent artwork exists. The splash stays cream (`#FFF7E9`) with the opaque app icon, so a standalone build on a dark phone shows a cream launch frame. The owner accepted this, and no dark splash asset or config is added.

### Owner decisions, October 9, 2026

- "Go with E" on top of D2 and the dark-mode row: the day arc and lunchbox as the identity motif, photo-led hero, deep forest and cream blocks (the one-sticker-per-screen idea is Phase C).
- Mood is driven by the selected Siang/Malam button; the transition plays when the user switches.
- Mood changes the header and hero only ("I dont think it looks good if the body switches colors as well"); the tab bar never changes colour.
- Dark body stays neutral charcoal, never brand green.
- Rulings B1 to B6 above, plus the review rulings recorded here (`todayRing`, shape-based selection, the 58 overlap, translated toggle labels, the 360dp Jadwal grid, the StatusBand).
- No dark splash until real transparent artwork exists.
- Phase C rulings (made October 9, 2026 in the Phase C plan, lines 71-84).
  - **C1. Exposed fields.** The meal of the delivery read gains `cooking_started_at` and `confirmed_by`, with those names. The production signature reads `preparing` as `scheduled` for the day and the meal and drops the day's version, so cooking never raises "production changed"; out for delivery stays visible and still does. Backend built (see Mulai masak under Dapur Hari ini).
  - **C2. Cooking sends no push.** It is not on the immediate-push list; only the realtime event row is written. Backend built; the customer's Beranda hero shows "Dimasak" on its track (Task 6).
  - **C3. A Dapur session's stage is its least advanced active row,** and "Mulai masak" and "Berangkat antar" act on today only (see Kitchen session under Dapur Hari ini). Domain rule built; the buttons are on Dapur Hari ini (Task 8).
  - **C4. A meal set to cooking by the older status command has no cooking time,** and its journey caption is "Dimasak" without a time. Domain rule built; the Dapur caption is on the count card (Task 8), and the customer caption is on the Beranda hero track (Task 6).
  - **C5. The departure caption carries no number:** "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat." The push reaches only customers with an account, and Dapur cannot count them truthfully (R-17). Built on Dapur Hari ini (Task 8): it is the confirm message and the footer caption above the "Berangkat antar" button.
  - **C6. Before departure the delivery order stays visible under the checklist,** so the per-stop sheet to move a day or report a failure stays reachable. After departure the checklist goes and the order leads. Built on Dapur Hari ini (Tasks 8 and 9).
  - **C7. "Laporkan masalah" is the per-stop "…" button,** which opens the existing exception sheet; native has no other report entry, and the footer copy says so. Built on Dapur Hari ini (Task 9): each stop's "…" button opens the exception sheet, and the line under the order says arrival is recorded automatically unless a problem is reported.
  - **C8. "Buka semua di Peta" is a Google Maps directions link of at most ten stops.** With more than ten stops the button reads "Buka 10 alamat pertama di Peta". The link rule is built in the domain, and the button is on Dapur Hari ini (Task 9).
  - **C9. The story opens with a fade and a scale from 0.92 to 1 over 320ms** instead of a shared-element ring transition, and closes on a downward swipe (see Native motion and Daily-loop components). Built in the Menu besok story (Task 7).
  - **C11. Checklist ticks live on the device,** in one SecureStore key per caterer, `runtime.storageKey("ticks.<catererId>")`, holding `{ [date]: { lunch: string[]; dinner: string[] } }`. Each write drops dates before today (Jakarta). Ticks are never sent to the server. Built on Dapur Hari ini (Task 8).
  - **C12. Usage names are allowlisted now, including Phase D's.** `journey_viewed` fires at most once per delivery, meal and stage per app process. There is no user, caterer or device column (see Usage counts). The allowlist and table are built; `app_open`, `tomorrow_story_viewed`, `journey_viewed`, `cook_started` and `depart_tapped` are sent by Phase C, the once-per-stage rule is built on the Beranda hero (Task 6), and Phase D sends the other three (`plan_sheet_opened`, `renew_started`, `purchase_confirmed_viewed`; see Usage counts).
  - **C13. After the change cutoff the story's deadline line reads "Sudah lewat batas ubah"** and shows no "Ubah hari", matching Dapur's closed-day copy. Built in the Menu besok story (Task 7); the Beranda row's meta line follows the same rule.
  - **C14. `RantangTrack` reads `heroText` for the marker, the progress line and the caption, and `heroMeta` for idle stops and stop labels,** with no new token (see Daily-loop components). Component built; it is on the Dapur count card (Task 8), and on the Beranda hero (Task 6).

- Phase D rulings (made October 9, 2026 in the [Phase D plan](docs/superpowers/plans/2026-10-09-native-renewal-phase-d.md), lines 53-62, with the controller rulings of October 10, 2026).
  - **D1. The plan detail is a pushed screen, not a sheet,** because notification links and push taps open it cold. Built with `MoodHeader` and `onBack`; Phase E replaced both with the native header (see Plan detail).
  - **D2. Remaining days stay plain:** "{n} hari lagi" from `remainingLabel`, no ring, bar or streak. Built in the plan detail hero.
  - **D3. "Lanjutkan paket" rules,** with controller ruling P2: a trial offers "Lanjutkan dengan paket penuh" only while no later non-cancelled plan for the same package exists, so no duplicate purchase is invited. Built (see Plan detail, Footer action).
  - **D4. The recap shows for a completed full plan that ended within the last 14 days, has no renewal and has no `recap.{id}` key.** Gate fix: the key is written the first time the card renders with Beranda in front, once per Beranda mount, not when the card first renders behind another screen. Built on Beranda (see "Paket selesai" recap).
  - **D5. The recap shows no meal count,** because the read cannot count an old plan's delivered meals truthfully (R-17). Built.
  - **D6. The reserved dates on the paid screen wrap:** the first 6 sorted dates, then "dan {n} hari lainnya", with no horizontal scroll. Controller ruling (Task 5): they are plain tags, not chips (see Chips / Status).
  - **D7. Paid screen actions:** "Lihat jadwal", "Pilih menu" when the customer picks the menus, and "Ke Beranda". Controller ruling on the final review (I2): "Lihat jadwal", "Ke Beranda" and the paid backs dismiss to the tabs (`dismissTo` when `canDismiss`, else `replace`), because a plain replace stacked a second tabs navigator above the package page; "Pilih menu" keeps `router.replace`. Phase E's per-tab stacks carry the same intent through `goToTab` and `leaveFor` (see Payment success, Actions).
  - **D8. The `success` haptic fires only when the stage changes to paid while the screen is open.** Built (see Native motion).
  - **D9. Demo states for Nadia Putri and Dapur Senja, built from the demo database's creation day.** Controller rulings (Task 1): only on a demo seeded in the same call, never on an existing store; the same shapes in memory and stored; no meal closed by the system today. Built (see Demo states).
  - **Controller rulings on review.** A cancelled plan's detail reads "Paket dibatalkan" with its date range, no action and no upcoming list, and any other unknown status reads as not found (Task 3). Paid is final on the iOS edge swipe too, through `gestureEnabled: false` set by the screen while paid (Task 5).
  - **Controller rulings on the gate and the final review (October 10, 2026).** The recap's seen mark waits for Beranda to be in front, and a one-day plan shows one date on the plan detail hero and the recap (gate fixes). "Visit" means one Beranda mount (M1). Plan detail "Berikutnya" lists today first while a meal is still on its way, and a failed or reported meal today is not on its way (I3 and its fix wave); the residual "1 hari lagi" beside "Tidak ada antaran mendatang." on a plan's last evening is parked. The Beranda plan-line label names the caterer and the days left (I4). "Perpanjang" counts `renew_started` (deferred row 11). The paid exits dismiss to the tabs (I2, see D7). The Beranda plan line stays a `PressableScale` row, recorded as the exception to the `PressableRow` rule (I1). Phase E removed Beranda's plan lines, so I1 and I4 no longer apply there. The renewal screen's "tepat setelah paket sekarang" when the start is pushed past other plans is parked for the owner (it predates Phase D).

Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2 and Dapur ENERGY 1 / RHYTHM 1 / MOTION 1 (plus press micro-feedback), unchanged. The identity motif is the day arc and the lunchbox; the one accent is sunrise ink (since Phase G, only on the tracker's current stop; see Colour revision (Phase G), October 2026).

### Evidence and limits

Phase B was checked on the Android emulator in Expo Go with the demo backend in four looks. The record, with every capture it cites, the click-through and the font-scale findings, is [antislop audit 003](anti-slop/audit-003-2026-10-09.md). The first pass found three defects (the Dapur demo photo upload, a truncated Jadwal row name and a truncated Dapur tab label at 360dp and font scale 1.3); all three were fixed, re-checked on the emulator and are recorded there. A whole-branch review then raised five Important items, fixed in the final wave and recorded in the audit's final-wave section: an actionable plate hidden behind the mood (the Beranda other-meal row now carries its status sentence), the status band snapping while the header fades (one shared `MoodFill`), `display` on long dynamic titles (the ruling above), the Dapur date button's accessible name omitting its visible date, and duplicated mood code (`MoodFill`, `Button` `ink` and `edge`, `MoodHeader` `onBack`, a `MoodLabelsProvider` that takes the app's `t`). The sixth, the unverified production upload path, stays a release gate. The audit also lists what the demo data could not show (the Beranda departure chip (since removed, Task 6), the Dapur count card with figures in Malam, the Jelajah meal empty state, the claim loading and offline states, the production status bar without the demo strip, the Dapur ExceptionSheet) and the production upload path (prepare, PUT, complete), which is not verified on a device and is a release follow-up. No iOS, physical-device, TalkBack or standalone-build check was run, so this is not a device or release approval. Phase C's daily loop is built and is part of this contract: the rantang track on the Beranda hero and the Dapur count card, the Menu besok story, the Dapur checklist with "Mulai masak" and "Berangkat antar", and the Dapur delivery order and "Semua beres" (see the Phase C bullets under Components and behaviour, the Native motion bullets and Daily-loop components). The record above is Phase B's and does not cover them; Phase C's record is [antislop audit 004](anti-slop/audit-004-2026-10-09.md), on the Android emulator, with no iOS or physical-device check. Phase D's purchase and renewal beats are built and are part of this contract too: the plan detail behind every plan link, the "Paket selesai" recap, the payment success beat and the demo states (see the Phase D bullets under Components and behaviour, Native motion, Usage counts and Demo states). Besides the Jest and Vitest tests named beside each rule, they were checked on the Android emulator (emulator-5554, Expo Go SDK 57, the demo backend on a fresh demo folder seeded on October 10, 2026) in three passes, recorded with every capture they cite in [antislop audit 005](anti-slop/audit-005-2026-10-10.md): the first gate on `b63bf0b` (18 PASS, 0 FAIL, 6 not exercised, in light and dark, Siang and Malam, and at 360dp with font scale 1.3), a recap re-check on `63f7970` after clearing Expo Go's data (7 PASS), and a re-check of the final fixes on `9803440` (4 PASS). What the first gate could not reach or noticed led to the two gate fixes (the recap's seen mark, a one-day plan's single date), and the whole-branch review to the final wave (the paid exits, today under "Berikutnya", the plan-line label, `renew_started` on "Perpanjang"); each is re-checked in those passes. This is not an iOS or release approval. Phase D's release items: no iOS run and no live VoiceOver or TalkBack pass; no keyboard-only use; the iOS edge swipe on the paid screen is checked only through the option value in Jest; the paid exits are checked on Android only; "Tercatat sampai" on Beranda is not reachable in production (see Beranda hero track); the renewal screen says "tepat setelah paket sekarang" even when the start is pushed past other plans, which is then not true (parked for the owner; the screen predates Phase D); the production photo upload path stays the unverified release gate from Phase B; and there is no dark splash until real transparent artwork exists (owner decision, see Splash).

## Native navigation and chrome (Phase E)

Owner decisions of October 10, 2026 ([antislop audit 006](anti-slop/audit-006-2026-10-10.md), "Owner decisions"), built as Phase E ([plan](docs/superpowers/plans/2026-10-10-native-navigation-phase-e.md)). This section is the contract for navigation chrome in both native apps; the Beranda it frames is under Native mood and theme, Components and behaviour. **iOS is unverified for Phase E:** there is no Mac and no iPhone run, so every iOS rule below is checked through option values in Jest only.

### Platform-native chrome

- **Each platform follows its own guidelines; the GitHub mobile app is the reference.** Navigation and controls are native components at the platform's sizes, placement and behaviour. iOS follows the HIG: the system tab bar, large-title navigation bars that collapse on scroll, the system back with no label, swipe back. Android follows Material 3: the navigation bar with its indicator pill, the small top app bar with the Material back arrow, tonal surfaces instead of shadows. The owner's words: "We're not chasing 100% native look like built-in system apps, but at least keep the native components."
- **Brand lives in content, not chrome.** Catera's identity stays in the content layer: mood headers on tab roots, the day arc, the lunchbox, food photos. Native bars and the tab bar read the theme only, never the mood.
- **One typeface.** Plus Jakarta Sans everywhere the app draws text, native bar titles and tab labels included, at each platform's native size: iOS large title 34 and inline title 17 (`Jakarta-Bold`), tab labels 10 (`Jakarta-SemiBold`); Android top-bar title 22 (`Jakarta-Bold`), navigation labels 12 (`Jakarta-SemiBold`). Weights come from the static families in `fonts`, never `fontWeight`. System-drawn UI (alerts, the share sheet, the keyboard, pickers) keeps the system font. If the iOS bar titles do not scale at the largest Dynamic Type size, they stay at the native size rather than overflow (unchecked).
- Platform checks in new code use `process.env.EXPO_OS`; the chrome helpers take the platform as a parameter, so Jest pins both.

### Tab bar

- **`NativeTabs` replaces the custom tab bar in both apps** (`expo-router/unstable-native-tabs`; `apps/customer/app/(tabs)/_layout.tsx`, `apps/caterer/app/(tabs)/_layout.tsx`). Labels are always shown (`labelVisibilityMode="labeled"`). Icons stay Ionicons through `NativeTabs.Trigger.VectorIcon` on both platforms, outline when unselected and filled when selected (ruling: code-first and Expo Go; to recheck on iOS). Dapur staff see Hari ini and Menu; `tabsForRole` hides the other triggers, and each item keeps the platform's 168dp maximum width.
- **Android: the Material 3 navigation bar** at the platform's own height (items 80dp above the gesture inset at font scale 1.0, 84dp at 1.3, measured), with the selected icon on the M3 indicator pill and a press ripple in the pill's tint. Colours come from `tabBarColors(palette)` (`packages/mobile-ui/src/tabBar.ts`): bar `tabBar` (light `#F2ECDF`, dark `#1E1E1C`), pill and ripple `tabIndicator` (light `#BFD8BB`, dark `#163D2E`), selected icon and label `forest`, the others `muted`. Labels reach at least 4.5:1 on the bar and the pill at least 1.25:1 off it (see Native dark theme).
- **iOS: the system tab bar with `minimizeBehavior="onScrollDown"`.** On iOS 26 it shrinks to the selected tab while a long list scrolls down and returns on scroll up (owner request).
- **Android has no hide on scroll.** `NativeTabs`' `hidden` is a plain visibility toggle: the bar snaps away and the content resizes in one frame (`docs/PREDICTIVE-BACK.md` section 1.5). A sliding hide needs a patch to react-native-screens' native source, a new dependency and a change to every scroll view, so Android's bar stays fixed until a development-build spike passes its go rule (sections 2.6 and 4).
- **No label cap.** The native bar scales and speaks its own labels, so `TabBarLabel`, the 1.15 cap and the iOS spoken labels are retired (see Tab labels).

### Navigation

- **Each tab keeps its own native stack** (array groups `(index,jadwal,jelajah,akun)` and `(index,pelanggan,menu,usaha)`, each anchored at its root). Detail screens push inside the current tab, so the tab bar stays (`tab-bars.md`: keep the tab bar visible when people navigate to different sections), and a tab switch keeps each tab's place. A cold link to a detail screen opens it inside Beranda (Dapur: Hari ini) with the tab root behind it, so Back never lands on an empty stack.
- **`goToTab(tab)` and `openLink(path)`** (`apps/customer/src/nav.ts`, `apps/caterer/src/nav.ts`). Every in-app link to a tab root selects that tab popped to its root, closing any screen above the tabs first; it never pushes a second Jadwal or Jelajah inside another tab. `openLink` routes push taps, notifications and action rows: tab roots through `goToTab`, other screens in the focused tab. It holds a link only while the app is still loading; a tap on a screen above the tabs opened cold opens at once, with Beranda behind it. OS links to a tab root, with any query or hash, open that tab, and `/discover` opens Jelajah. `leaveFor(path)` closes a finished screen above the tabs and opens its target inside its tab, so one-shot flows (the story's "Ubah hari", the renewal's other package) land with the tab root behind them and Back returns to it (`apps/customer/src/nav.ts:190-203`). Dapur drops a held link on sign-out or an account switch, and staff never open an owner screen (`Stack.Protected` guards from `tabsForRole` and `SCREEN_TAB`).
- **The root flows are modal and cover the tab bar.** Beli, Perpanjang and Bayar are `fullScreenModal`, because a sheet's swipe could drop a purchase or a payment midway. Sign-in, register, recovery, the claim link and Dapur's Aktifkan and Impor are `modal`, a sheet on iOS. The Menu besok story stays a `fullScreenModal` with a fade.
- **Close sits at the leading edge.** Modals show Close ("Tutup") instead of back: `HeaderIconButton slot="leading"`, 44pt on iOS; on Android a spoken 48dp target inside the toolbar slot whose icon is pulled 12dp outward, so it centres at 28dp like the back arrow. Close goes back, or to the tab root when the modal was opened cold.
- **Alamat and Bantuan over a purchase** open as `modal` copies at `/pembelian/alamat` and `/pembelian/bantuan`, so the purchase stays underneath, no second tab bar opens and Close returns to it. The bare `/alamat` and `/bantuan` still open the tab's own screens. The copies have their own path because a route-group copy wins expo-router's matcher tie and captures the cold bare links.
- **Paid is final.** No back and no swipe while Bayar is paid, and every user back goes home through `goToTab("index")` (see Payment success).
- **Native transitions only:** no custom stack or tab-switch animation (see Native motion).

### Headers and titles

- **`AppHeader` is removed in both apps.** Pushed screens use the native stack header from `nativeHeaderOptions` and `useStackScreenOptions(demo)` (`packages/mobile-ui/src/nativeHeader.ts`).
  - **iOS:** a large title 34 in `forest` that collapses into the inline title (17, `charcoal`) on scroll, over a transparent bar on the canvas, with no shadow and the system back with no label (`headerBackButtonDisplayMode: "minimal"`, tint `forest`).
  - **Android:** the small top app bar on the canvas with the Material back arrow, a 22 title, `charcoal` tint and no shadow. **Recorded deviation:** the bar is the native 56dp (the theme's `actionBarSize` in react-native-screens' toolbar, measured), not Material 3's 64dp, because changing it needs a native theme that Expo Go can't apply (ruling on Task 4).
- **On Android the full title is the first content line.** `Screen nativeTitle` draws it as Material 3 headline small (`Jakarta-Bold` 24/32, `forest`), which wraps and never truncates, and moves it into the bar once the line has scrolled under the bar (cleared when it comes back). On iOS the same prop is the large title. While the page is scrolled, the Android bar takes the tonal `tabBar` colour (Material's scrolled container) and returns to the canvas at the top; the swap is instant, because react-native-screens has no animated header background.
- **Stable titles.** Links inside the app carry the shown name as `?title=` (`titled()` hrefs), and the route reads it with `linkTitle`, so the bar is final on the first frame: a plan link never shows "Paket", and Hari's bar is the day ("Senin 12 Okt"), empty until it is known; only a signed-out screen opened by a link with no title reads "Hari" (`DayScreen.tsx:26`). A cold link or a notification carries no title and shows the generic name ("Paket", "Pelanggan", "Laporan masalah") until the record loads. A crafted title cannot spoof a screen (Phase E I1): OS links are stripped of `title` before routing, `linkTitle` caps a title at about 60 characters, and error and not-found states fall back to the generic name, never the link's title.
- **MoodHeader only on tab roots.** `onBack` and `backLabel` are gone, and detail screens have no mood block (see Headers on other screens). On every tab root the top row is 48dp whatever it holds, so a tab switch never moves the title, and its meta line carries a fact, never the tab's own name (Akun and Jadwal have none). On pushed screens only hero cards keep the mood fill (the plan detail hero, the paid hero).
- **PackageDetail with a photo** (B3) keeps the photo as its header under a transparent native bar with no title and light ink, over a top scrim from `rgba(27,27,26,0.6)` that rides under the bar; the scrim keeps the light back control and the status glyphs legible over a bright photo. Past the photo the bar turns opaque in the Android scrolled tone (`tabBar`; the canvas on iOS) with the theme tint, and takes the package name once its content line has gone under.

### Status bar and insets

- **Status-bar ownership.** The theme's glyphs are the app default, set at the root (`statusBarStyle({ mood: null })`). A tab root's `MoodHeader` sets the mood's glyphs while its screen is focused and hands them back on blur. PackageDetail sets light glyphs over its photo, unless the demo strip is shown (its own fill keeps the theme's glyphs). The Malam flip without the demo strip is unverified on a device.
- **iOS insets.** Every `Screen` scroll view is `contentInsetAdjustmentBehavior="automatic"`, tab roots included: UIKit offsets the content below the status bar, lets the last rows scroll clear of the floating tab bar, collapses the large title and minimizes the tab bar. Only a photo header (`bleed`) opts out with `"never"`. A `MoodHeader` heading a scrolling `Screen` therefore pays no top inset on iOS, and the screen's `StatusBand` paints the header colour under the status bar (`packages/mobile-ui/src/screenInsets.ts`).
- **Android insets.** `"never"` under a full-bleed header or `bleed`, otherwise `"automatic"`; a `MoodHeader` pays `insets.top` unless the demo strip owns it.
- **Demo strip.** While it is shown it owns the status-bar inset, and the Android native bar adds none through `unstable_nativeProps.headerConfig.disableTopInsetApplication`, because react-native-screens 4.26 ignores `headerTopInsetEnabled` and would pay the inset twice.
- **Footer.** A `Screen` footer sits outside the scroll view. On iOS it pays the bottom safe-area inset, so a sticky action clears the floating tab bar (Phase E I2). On Android it sits above the native bar (checked with Dapur's "Mulai masak").

### Loading continuity

Photos fade in from the theme `sage` ground (see Native motion), Jadwal keeps the month grid's height while it loads (see Jadwal), and record-named screens are titled on the first frame (above).

### Predictive back (Android)

- **Status: not enabled.** `android.predictiveBackGestureEnabled` is unset in both app configs, so the manifest opts out (`docs/PREDICTIVE-BACK.md`). Why: React Native's activity keeps an always-enabled back callback on API 36, so the system never previews back-to-home; the flag alone may stop Back reaching JS on API 33 to 35 (react-native issue 58407); react-native-screens 4.26.2 has no back progress, so there is no in-app peek and none is known for v4; and this machine cannot build a development client (there is no JDK on PATH; the Android SDK is present). A draft root-back plugin lives only on the unmerged `task-7` branch, uncompiled. Expo Go uses its own manifest, so none of this changes Expo Go.
- **How to verify.** Build a development client (`npx expo run:android`) and run the Step 2 matrix on API 34, 35 and 36 emulators with hardware and gesture back: a pushed screen pops once and the tab bar stays; a sheet closes alone; Bayar's paid guard lands on Beranda; Back on the Beranda root leaves the app; Back on another tab root goes to Beranda; the back-to-home preview shows on the Beranda root; Back right after a cold launch leaves on the first press. Repeat with the plugin. Ship the flag and plugin only if all seven rows pass on all three levels with both back types (sections 2.3 to 2.5).

### Rulings, October 10, 2026

Light `tabBar` `#F2ECDF` and light `tabIndicator` `#BFD8BB` (on the new bar, `#CFE3CC` stood only 1.15:1 off it). Android keeps the native 56dp top bar. Past the Paket photo the bar takes the Android scrolled tone like every pushed screen. iOS keeps automatic insets on every `Screen`, and the mood header pays no top inset there. Aktifkan and Impor are modals. The Alamat and Bantuan copies live at `/pembelian/*`. A push tap on a cold screen above the tabs opens at once. The plan detail has a trailing chat button. Predictive back and the Android hide stay report-only until a device spike passes. Beranda's hero actions below the fold at 360dp and font scale 1.3 with the demo strip are accepted.

Dials are unchanged: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 1 (plus press micro-feedback). The identity motif stays the day arc and the lunchbox; the one accent stays sunrise ink ("Perpanjang" on Beranda until Phase G; since colour direction K the accent is the tracker's current stop and "Perpanjang" is charcoal).

### Evidence and limits

The rules are covered by the Jest and Vitest tests named beside them, chiefly `navigation.test.tsx` and `native-header.test.tsx` in both apps, `beranda-sections.test.tsx`, `mood-arc.test.tsx`, `loading.test.tsx`, `tests/home.test.ts` and `tests/native-contrast.test.ts`, and by Android emulator captures in Expo Go with the demo backend (light and dark, Siang and Malam, 360dp at font scale 1.3). Not verified on a device: anything on iOS (the large title and its collapse, the minimizing tab bar, the insets under the mood header and the floating bar, swipe back, the sheets with Close, the bar titles at large Dynamic Type, the paid swipe guard), live TalkBack and VoiceOver (structure only), a push tap delivered to a cold app, the plan detail's chat button (the local demo read carries no caterer phone) and predictive back. This is not a device or release approval.

## Native polish (Phase F), October 11, 2026

Owner decisions of October 10 and 11, 2026 ([antislop audit 008](anti-slop/audit-008-2026-10-10.md), "Owner decisions"), built as Phase F ([spec](docs/superpowers/specs/2026-10-10-native-phase-f-design.md), [plan](docs/superpowers/plans/2026-10-11-native-polish-phase-f.md)) and gated in [audit 008 follow-up](anti-slop/audit-008-followup-2026-10-11.md). This section is the contract for loading, launch, settings, sheets, feedback, mascot art, macros and import previews in both native apps. **Verification limit:** every rule below is checked by Jest, Vitest and typecheck only. The Android emulator gate did not run (the build machine's Android SDK has no system image or AVD, there is no JDK on PATH, and the Expo Go APK has not been downloaded, which needs the owner's permission) and iOS has no Mac, so nothing here is a device or release approval. The open device checks are listed in the follow-up and in [the Phase G kickoff](docs/superpowers/kickoff/phase-g.md).

### What Phase F supersedes

- **Loading text and spinners.** The Three States Rule's loading text ("Memuat…") is now a skeleton group whose label ("Memuat {apa}", for example "Memuat paket") only screen readers read. Every earlier mention of a spinner or a visible "Memuat…" line as a loading state (Jadwal's month frame, plan detail, Dapur screens) is replaced by the skeletons below. Spinners remain only as inline progress (see Loading).
- **Tampilan row (native).** The segmented control in Akun and Usaha is gone. Tampilan and Bahasa live in Pengaturan as choice sheets.
- **Splash.** The October 9 ruling that kept a cream splash "until real transparent artwork exists" is withdrawn by Decision B (below). The splash is the theme canvas with a transparent mark.
- **Sheets.** The custom `Sheet` (a React Native `Modal` bottom sheet) is deleted. Every sheet is a react-native-screens form sheet route, and the `Alert.alert` confirmations are confirm sheets. The "Sheets and keyboard" paragraph above describes code that no longer exists.
- **Paid header.** Bayar's header reads "Bayar" in every stage, paid included. Only the beat's title says "Pembayaran diterima".
- **Loops.** "Nothing loops" is restated: only the mascot loop and the skeleton pulse loop, and only while something waits.
- **Dapur dial.** MOTION 1 became MOTION 2 (see The Dapur MOTION 2 dial).
- **Brand artwork.** Fifteen of the sixteen brand PNGs now have real alpha as segmented derivatives of the opaque masters (`packages/brand/README.md`). Only `app-icon.png` stays opaque on purpose. They are never called newly generated transparent masters, and the 2048 and 4096 master targets remain open.

### Loading

Three tiers, one job each. **There is no full-screen spinner, and a screen never shows two loaders in a row.** `apps/customer/tests/no-spinner.test.tsx` and `apps/caterer/tests/no-spinner.test.tsx` scan the sources: the customer app has no `ActivityIndicator`, and Dapur allows only the Menu "Mengunggah…" photo tile.

| Tier | Use | Component |
| --- | --- | --- |
| Skeleton | The layout is known | `SkeletonGroup` and `Skeleton` |
| Mascot | Nothing can be shown yet | `MascotLoading` |
| Inline | One control or object is busy | busy button, upload tile, pull to refresh |

- **Skeleton** (`packages/mobile-ui/src/Skeleton.tsx`). Blocks fill with the theme `sage`. `onMood` blocks take the mood's `toggleTrack` and `onHero` blocks its `arcTrack` (light Malam paints the hero the same as `toggleTrack`, so `onMood` would vanish there). Default radius 8. One shared pulse, 1 to 0.55 to 1 over 1400ms (two 700ms in-out quad halves), static at 0.75 under reduced motion. A group is a busy progress bar named "Memuat {apa}", for example "Memuat paket" ("Menghitung harga" in the Beli breakdown). A group without `label` only supplies the pulse, for blocks of the same wait that sit outside the data area. Groups mounted in one commit pulse in step.
- **Skeletons hold the final height.** The header and every fixed part are drawn at the size they have loaded, so the swap moves nothing.
  - Beranda: one `HomeHeader` for loading and loaded (the second headline line is held at 39, the arc's detail lines at 15, the 58 hero overlap kept), and the skeleton hero uses the loaded `HeroFrame`. "Memperbarui…" sits after the date in the 48dp meta row, in a polite live region, never under the headline.
  - Dapur Hari ini: the count skeleton's track block is as tall as the compact `RantangTrack` and its strip block as tall as the figure strip. Menu's first load draws the week line, the 44dp title row and one row of 56dp day tiles that share the width (Dapur layout scale, October 2026; until then 97dp, 48dp and 64dp).
  - Akun's contact line is held at 23. A sheet header holds its context line at 20 with `holdContextLine` (see Action hierarchy).
- **One block in.** Loaded content replaces its skeleton in one `FadeSwap` (`content`, 220ms) at the same tree position, keyed by state (`loading`, `fresh`, `kept`, `empty`, `error`). A catalogue or list never staggers. A key change remounts the content (the fade is the new layer's `entering` animation, so it mounts already hidden), so state that must outlive a swap lives above it: Hari ini keeps the checklist ticks, the "Pilih" selection, the order's expanded list and next WhatsApp part, and the connection banner above its day `FadeSwap`. A key names what the content is (the day, loading or ready), never a stage or a mood of the same content (Phase G; see Native Phase G, Swaps, mascot stills and the macro grid).
- **Mascot** (`MascotLoading`, `packages/mobile-ui/src/brand/MascotLoading.tsx`). The approved 2400ms loop from `packages/brand/motion.ts`, size 140 by default, with a task line under it. It appears after 300ms (no minimum display time) and plays only while the app is `active`, its screen is focused, motion is not reduced and every layer has loaded. Otherwise it rests on the neutral poster. `startup` fills the theme canvas and sets the line in the system font, for the launch gate before fonts load. Uses: the launch gate, the SMS code check on Masuk ("Memeriksa kode…"), the claim link ("Membuka tautan…"), and Bayar's checking stage ("Memeriksa pembayaran…", one instance from the first read into the stage, replacing the stage title). Password sign-in keeps its busy-button wait. The import assistant uses the reading mascot (see Import previews).
- **Inline.** The busy button and `StickyAction` spinner, the Menu photo upload tile, and the platform pull to refresh through `Screen.refreshControl` (forest spinner on the surface fill) on Beranda, Jadwal, Paket saya, Hari ini and Pelanggan. Content stays on screen while it reloads.

### Launch

- **Order.** `SplashScreen.preventAutoHideAsync()` runs at module load. Local reads happen in parallel (fonts, stored theme, stored locale, stored session, the kept first-screen read), and `useSplashHold` hides the splash once they finish or after `SPLASH_CEILING` 1500ms, whichever is first. The network never gates the splash. One `me()` runs at launch: the AppState refresh fires only from background or inactive with nothing in flight, and an English locale no longer re-runs it.
- **Cache first.** Beranda and Hari ini paint the last confirmed read under "Memperbarui…" and swap the fresh read in through `FadeSwap`. **A kept copy is never actionable:** while `fromCache` or `savedAt` marks the copy, Sudah sampai, Ubah hari, Mulai masak, Berangkat antar and the "..." sheets stay hidden, exactly as on the offline copy. Caches are keyed by actor id and cleared when the session ends, and a read that lands after sign-out saves nothing (`onSignedOut`, a session check before every save). Another account on the same phone paints its skeleton, never the previous person's home or kitchen.
- **Launch gate.** With no stored session the gate waits on `me()` under `MascotLoading` "Menyiapkan Catera untuk Anda…", visible only after 300ms. It shows once the splash has lifted even if the session read hangs (`booted || released`). "Belum bisa terhubung" with "Coba lagi" stays the failure state.
- **Hand-off beat** (`LaunchCover`, cold start only). The splash mark (the same 1024px derivative the native splash draws, 200dp; an exception to "import only `runtime/`" so the first frame matches) scales 1 to 1.04 and fades out over `feature` 320ms while three code-drawn sparkles drift outward. Input passes through as it fades. It is skipped under reduced motion, on a warm start, or when the mark has not decoded within `DECODE_GRACE` 150ms. The cover takes the system scheme at launch.
- **Splash and icons** (both `app.config.ts`, covered by `tests/app-config.test.ts`). Light: canvas `#FDFAF3`, `splash-mark-light.png`. Dark: `#151514`, `splash-mark-dark.png`. `imageWidth` 200. Android adaptive icon: `adaptive-foreground.png` on `#163D2E` with `icon-monochrome.png`. iOS appearances: `app-icon.png`, `icon-ios-dark.png`, `icon-ios-tinted.png`. All are processed transparent derivatives of the generator originals, never masters. **Unverified on a device** (Expo Go shows its own launch screen; Decision C): the native splash on both platforms, the Android 12 circular mask and the iOS icon appearances.

### Pengaturan

- **Routes and entry.** `pengaturan` is pushed inside the tab stack of each app: Akun for customers; for Dapur, Usaha for owners and a gear beside the Menu toggle for helpers (the route is unguarded). A trailing gear `HeaderIconButton` on the tab root and a "Pengaturan" row at the end of Akun and Usaha open it. Signed-out customers reach it from Akun. Native title "Pengaturan". Akun and Usaha no longer hold a language, theme, notification or sign-out control.
- **Rows.** iOS inset grouped sections, Android Material list with forest subheaders (`SettingsSection`, `SettingsRow`, `SettingsSwitchRow`). Sections: **Notifikasi** (signed in), **Aplikasi** (Bahasa and Tampilan, each with its value and a choice sheet), **Tentang** (Versi aplikasi from `expo-constants`, selectable; "Syarat dan privasi", which reads "Segera hadir" because the web has no terms page to open, a recorded TODO; since Phase G (G15) it opens the web page `/syarat-dan-privasi`, a labelled placeholder until the owner supplies the text), then **Keluar** in the danger ink. Tampilan's sheet shows three thumbnails (Sistem, Terang, Gelap; Android wording "Ikuti sistem"). A choice applies at once and closes the sheet.
- **Truthful switch** (`usePushSwitch`, `packages/mobile-core/src/push.ts`). States: `on`, `off`, `denied`, `unavailable` (Expo Go) and `loading`. The phone's permission wins: a blocked phone is never on, and shows "Izinkan notifikasi di Pengaturan ponsel" with "Buka Pengaturan". The state is read on focus and when the app returns to the foreground, so a permission changed outside the app shows at once. On asks for permission, registers the phone (`device.register`) and stores the flag `push.<actorId>`. Off removes this phone's token through the new `device.unregister` command and clears the flag. A failure puts the switch back where it truly was and shows the error toast "Belum berhasil. Coba lagi." Callers must catch both changes.
- **Keluar lets go of this phone.** `logout()` first sends `device.unregister` with this phone's token, best effort: a failure or 3000ms (`RELEASE_PUSH_MS`) never blocks sign-out, and a failed attempt keeps the flag. The row reads busy (dimmed to 0.45, a trailing indicator) and ignores a second tap, and Dapur's customer-account gate has the same guard. The customer app then pops every tab to its root (`goToTab("index", { everyTab: true })`).
- **Backend.** `device.unregister { token }` returns `{ removed: 0 | 1 }`, deletes only the caller's own row, is idempotent and answers `UNAUTHORIZED` when signed out (`supabase/migrations/20261011090000_device_unregister.sql`; the demo backend applies the same rule).

### Action hierarchy and native sheets

| Weight | Container |
| --- | --- |
| A task with its own context, or the target of a cold link | Pushed page |
| A short task, one to five controls, done in place | Native form sheet |
| Several secondary actions on one item | Action sheet |
| A confirmation before an irreversible or customer-visible action | Confirm sheet |
| A routine outcome | Toast |

- **Form sheets** are routes with `presentation: "formSheet"` from `sheetOptions({ detents, palette })` (`packages/mobile-ui/src/nativeHeader.ts`): grabber on, `fitToContents` for choice, action and confirm sheets or `[0.6, 1]` for forms that can grow, Android corner 28, `surface` ground, no stack header. The sheet draws its own title row (`SheetHeader`). On iOS that is a centred 17 bold title with a 44pt leading Close. On Android it is a 36dp band with a drawn 32 by 4 handle (react-native-screens 4.26.2 stores the Android grabber flag but never draws it) and a 22 bold start title, with no Close. `SheetBody` scrolls under the fixed header. `SheetFitBody` keeps a fit sheet fitting until its content is taller than the window minus the top inset minus 24, then scrolls, so a long address book still reaches "Kelola alamat". Every fit sheet draws its body through it: the choice, action and confirm sheets, Area, Tim, Tampilan and Bahasa. Both set `nestedScrollEnabled`.
- **`holdContextLine`** (opt-in on `SheetHeader`). A sheet that loads its context passes `context={null}` while it waits. The 20dp line is held by a 12dp skeleton, then the text is one line with the full text as the accessibility label. Ada masalah, Ubah hari and the help form opt in. The default context wraps, so large text never cuts a line.
- **Confirm sheet** (`/konfirmasi`, `useConfirm`). A 56 circle in `sage` holding a 28 glyph, a 20 or 22 bold title, a 15/22 muted consequence, then two equal buttons (iOS side by side at 50pt; Android a text button and a filled button end-aligned at 48dp). A danger tone fills the confirm in `danger` with `cream` text (6.6:1 in light, 5.5:1 in dark; `tests/native-contrast.test.ts` enforces at least 4.5:1). In use: Dapur Mulai masak and Berangkat antar, ChooseMenu "Tinggalkan perubahan?" and "Hapus pilihan menu?", and every discard.
- **Action sheet** (`/aksi`, `useActionSheet`). A title, an optional context (56 photo, bold name, muted tabular lines), rows of 52pt on iOS or 56dp on Android with a 22 or 24 icon, a hairline before the first danger row, destructive last. The "..." (`HeaderIconButton icon="more"`, 44 or 48) sits on each Hari meal card, the Beranda hero's photo corner and each upcoming row of the plan detail, and never offline, signed out or with nothing allowed. Items: Pindah tanggal, Ganti alamat hari ini, Chat {katerer}, Laporkan masalah. Dapur's package row offers Lihat paket and Salin jadi paket baru.
- **A question is answered exactly once, after its sheet has gone.** The confirm and action routes and Beli's choice sheets share one registry pattern keyed by `?id=` (`parkQuestion`, `useQuestionRoute` in `packages/mobile-ui/src/sheets.ts`). A route that unmounts unanswered answers `false` or `null`, and a stray cold link goes back, or to Beranda. The answer comes once the sheet has left: on iOS when its close transition ends, or `SHEET_CLOSE_MS` (400) after a close from the sheet's own buttons, so the next sheet (Pindah tanggal after the day's "...") is never presented while one is still sliding away; on Android as the route goes. The 400 wait is unmeasured: an iOS dismissal takes roughly 300 to 500ms, and react-native-screens skips presenting while a sheet is still dismissing, so a short wait can drop the next sheet. Measure it on a device; the preferred signal is the root stack's `onFinishTransitioning`, with a timer of about 800 to 1000 as the fallback. A swipe-down on a device probably answers after the wait too, not at once as the Jest swipe test shows. A cold `/impor-baris` with no row closes to Impor.
- **Unsaved guards** (`useUnsavedGuard`). Back, Close or a swipe with typed text opens one confirm sheet, "Buang {laporan|alamat|permintaan|ulasan|catatan|balasan}?", with "Yang sudah Anda tulis akan hilang." (customer) or "... kamu tulis ..." (Dapur), "Buang" in danger and "Lanjut menulis". With nothing typed the sheet closes and the parent stays. **Android swipe limit:** react-native-screens 4.26.2 Android sheets ignore `preventNativeDismiss`, so a swipe closes without asking. The typed text is kept as an in-memory draft keyed by actor and subject, restored on reopen and dropped on send or Buang. Android two-detent sheets expand to the top detent while the keyboard is up.
- **Cold links open over a parent.** Customer `sheetParent` (`apps/customer/src/nav.ts`): `/masalah/{id}` over its Hari, `/ubah-hari/{id}` over `/hari/{id}`, `/alamat-form` over `/alamat`, `/bantuan-form` over `/bantuan`, `/pengaturan/bahasa` and `/pengaturan/tampilan` over `/pengaturan`, `/ulasan/{id}` over Beranda, `/area` over Jelajah. A link to a sheet already on top replaces it. Dapur names the tab group from `SCREEN_TAB` in `redirectSystemPath`, so staff following an owner link land on Hari ini and a cold `/pengaturan` lands in `(index)`.
- **What moved.** Customer: Ada masalah (the sent page became the toast "Laporan terkirim" with "Lihat"), Alamat add and edit, the two Bantuan forms, Ubah hari, the review form, Beli's address and start-date pickers, and the Jelajah area choice. Dapur: Tim (invite code card on `sage`, "Bagikan undangan"), the report reply, stop exceptions and the import row editor. Both: Bahasa and Tampilan. These stay pages: plan detail, Hari, Pilih menu, package detail, Paket saya, the Alamat and Bantuan lists, the Menu day editor, Pelanggan detail, Uang, Aktifkan and Impor.
- **Not built.** Address delete. No `address.delete` command exists, so there is no delete and no "Alamat dihapus" toast. **Superseded by Phase G (G13):** address delete and move are built (see Native Phase G, Address delete and move).

### Feedback

Four sizes, picked by the weight of the outcome: a **beat** for a milestone, a **toast** for a routine outcome, a **micro** on the control itself, and **row motion** for a list the user's action changed.

- **Toast** (`ToastProvider`, `useToast().show({ message, action?, tone? })`). Colours `toast`, `onToast` and `toastAction`: light `#2E2E2E`, `#FFF7E9`, `#BFD8BB`; dark `#F5F1E8`, `#2E2E2E`, `#163D2E`; every pair is at least 4.5:1. One at a time, and a new toast replaces the old. 3000ms, or 5000ms with an action. With a screen reader on, an action toast stays for Android's recommended timeout or 10000ms on iOS. Announced once per show as "{message}, {action}". It enters with a 12dp slide and fade over `content`, leaves with a fade over `control`, and is instant under reduced motion. The error tone shows an alert glyph.
  - **Placement** follows the focused screen's chrome (`useToastAnchor`). iOS: a pill (radius 22, at least 44pt) under the native header or mood header; in an iOS sheet it sits at the bottom above the home indicator, any footer and the keyboard, and enters from below; full-screen stacks keep the top anchor. Android: a snackbar (radius 4, at least 48dp, at most 600) above the tab bar (`ANDROID_TAB_BAR` 80) or a footer; in a sheet, which has no tab bar under it, on the system inset. A sheet that closes on its outcome shows its toast after it closes, so the toast meets the page under it. The iOS host is a `FullWindowOverlay`.
- **Toast vocabulary.** Customer: "Disimpan" with Lihat; "Dihapus dari simpanan" with Urungkan; "Alamat disimpan"; "Permintaan bantuan terkirim"; "Ulasan terkirim"; "Laporan terkirim" with Lihat; "Hari dipindah ke {Senin 12 Okt}"; "{hari} diantar ke {label}" for an address change; "Menu {Selasa} tersimpan" (also "Selasa dan Rabu", "3 hari"). Dapur: "Paket diterbitkan" (later publishes), "Paket disalin", "Menu {Selasa} tersimpan", "Balasan terkirim", "Laporan tersimpan", and "Undangan dibagikan" on iOS only (Android always reports a share as done, so it shows no toast). Errors use tone `error`: "Belum berhasil. Coba lagi." and "Belum tersimpan. Coba lagi.". Bahasa and Tampilan show no toast; the row shows the new value.
- **Past form for a saved outcome (final review ruling, October 11, 2026).** A future toast for a change that was saved says "tersimpan" ("Menu {Selasa} tersimpan", "Laporan tersimpan"). "Disimpan" stays only as the name of the saved-packages list and its heart toast ("Disimpan" with Lihat). "Alamat disimpan" predates the ruling and is left as shipped.
- **Success beat** (`SuccessBeat`, `SuccessRig`, `SuccessRing`; timings in [MASCOT-MOTION.md](docs/MASCOT-MOTION.md)). A 212 stage holds the 196 disc (`nativeArt.successDisc` `#FFEFD9` with a 3dp `successRing` border, scale 0.35 to 1 over 420ms), the 180 rig and five sparkles bursting from 70 to 112dp between 450 and 1050ms (star, dot, star, dot, star in `sunriseInk`, `sunrise`, `forest`). The title (the `outcome` text variant, 26/32, 700, forest, the one heading that names the outcome) and the facts fade up 8dp from 620ms over `content`. One `success` haptic fires on the first frame of a play, and the title is announced once per play, also under reduced motion. **It plays only on the transition into success while the screen is open.** Reopening an already paid checkout, or rotating back to it, shows the resting frame with no haptic and no announcement. Reduced motion shows `mascot-merayakan` at 180 and the facts. Uses: Bayar "Pembayaran diterima" (the paid hero card stays inside it), Dapur's first publish "Paket diterbitkan", and the Dapur import "{n} pelanggan tersimpan" with "Lihat Pelanggan", which replaces the sage card and replays per save.
- **First-milestone confetti** (`Confetti`, the vector `phase-f/confetti.json` through `lottie-react-native`). It plays once over the beat, is not looped, has `pointerEvents` none and is absent under reduced motion. Only for a customer's first paid plan (no other subscription with a `checkout_id`, fixed at the paid transition) and a caterer's first non-draft package. If the read has not answered, the fact is unknown and there is no confetti.
- **Heart** (`SaveHeart`). A 48dp disc: the saved heart fills `sunriseInk`, the outline is `forest`. Save scales 1 to 1.22 over `control` and springs back, five dots travel to 31dp and fade within 380ms on the Catera ease, and a `select` haptic fires. Unsave is instant with no haptic. Toasts follow the server's answer. A refused save puts the heart back and toasts the error as well as the inline text.
- **Row motion, Decision A** (`packages/mobile-ui/src/motion/layout.ts`, `RowSwap`). Rows the user's own action inserts or removes animate, and their neighbours slide: enter `FadeInDown` from 8dp over `content` on the Catera ease, exit `FadeOut` over `control`, `LinearTransition` over `content` (`useRowMotion`). `useListMotion` gives an entrance only to keys that are new since the last commit. **No motion on a first load, refresh, pull, search, filter, tab return or mood switch.** `RowSwap` keys a `LayoutAnimationConfig` with `skipEntering` and `skipExiting`, so a Pelanggan filter change or a pull swaps the rows as one block, and a page from "Lihat lebih banyak" in Disimpan enters as one block (`useBlockEnter`, a fade over `content`). Where it applies: Disimpan remove, Alamat add, Dapur dish slots, the import rows and attachments, Pelanggan after an import, and Beranda "Menunggu Anda" (exit and move only). Pelanggan rows enter only after `commitImport` on this phone, never for a push or another device's change. Everything is undefined under reduced motion.

### Artwork use and optical size

- **Runtime copies only.** Apps import `packages/brand/assets/phase-f/runtime/`, built by `packages/brand/build-phase-f-runtime.mjs` and recorded with hashes. Stills are trimmed to the visible box plus a 3% margin and downscaled so the subject is at most 540px (180pt at 3x), never enlarged (`tidur`, 476px, is cropped only). Success rig layers are 800px and reading rig layers 600px, full canvas and untrimmed so they stay registered. 7.1 MB of source became 3.1 MB. Exceptions: the splash marks in `LaunchCover`, and `confetti.json` (no runtime copy, 40 KB). The files are processed transparent derivatives of the generator originals, approved on October 11, 2026, and are never called masters. `packages/brand/phaseF.ts` (generated) records each visible box and `crispMaxSize` (the reading rig's is 143.8pt).
- **One optical size.** `MascotArt({ pose, size })` crops transparent padding so every pose has a visible height equal to `size`, and the frame's width follows the pose. The same file is shown in both themes, decorative for screen readers.
- **`StateArt`** places a still above an empty or error title at **120** (96 when `fontScale` is 1.3 or more on a phone 360dp wide or narrower), and the cooking mascot at **72** (58 compact). Success is 180 and the reading mascot 120. Nothing else uses mascot art, and it is never beside a photo of food. Pose map:
  - `tidur`: Beranda with nothing today or next (left out while the Paket selesai photo shows), an empty Jadwal month, Notifikasi with no updates, Dapur with no session.
  - `mencari`: Jelajah with no results, an empty Disimpan. `melambai`: EmptyHome (left out while the recap photo shows), Masuk, the claim preview.
  - `bingung`: the startup gate and every full-page failed read with "Coba lagi" (Beli, Bayar, Paket aktif, a failed Jadwal month, Dapur Laporan). Dapur `ReadError art` is used only where the failure replaces the page, and Akun's embedded plan list stays compact.
  - `merayakan`: Dapur "Semua beres". `memasak`: the Dapur count card while the session is `preparing`, until the Dapur layout pass removed the count card; Hari ini no longer shows it.
- **Held slots fade in place.** `held` keeps the art's box on the page with the mascot invisible (`mascot-{pose}-slot`). The box never remounts, and only the mascot's opacity moves, over `content` on the Catera ease, instant under reduced motion. The art has no entering or exiting animation, so it leaves with its section. The Dapur count card's row is `[numbers][memasak slot][Antar]` for the whole session, so the card keeps one height before, during and after cooking.

### Macros

- **Customer.** `NutritionCard` ("Gizi per porsi", 17/24) in package detail after "Isi paket". Only filled metrics show, in the order Kalori, Protein, Karbohidrat, Lemak. Zero shows as "0 g", and with none filled there is no card. Tiles are `sage`, radius 12, no shadow, values tabular.
  - iOS: label over value, two by two, value 21/28, stepping to 17/24 when any value is a range and two columns do not fit; one column only at larger text.
  - Android: four compact tiles with the value over a short label ("Karbo"; the calorie tile's label is "kkal"), falling back 4, 2, 1 by measured width and font scale. Before the grid's first layout the width is taken as `min(window, 760) - 74`, so the first frame already has the right column count (Phase G, GC-F15; gate g-c-13 PASS, 2x2 from the first frame at 360dp and font 1.3). On a 360dp phone at font 1.0, range tiles go two by two and single-value tiles stay four across (no truncation; not yet seen on a device).
  - Caption: "Perkiraan dari katering. Bisa berbeda tiap menu." A range is written with an en dash between its ends.
  - Package detail adds "{kalori} kkal · {protein} g protein per porsi" under the caterer line only when both exist. Jelajah rows add "± {kalori} kkal" after the price (the lower bound of a range).
- **Dapur.** The editor's "Gizi per porsi (opsional)" section follows "Isi satu porsi": a "Pakai rentang" switch row (the whole row is pressable, switch semantics, 48dp), Kalori as one field or "Kalori dari (kkal)" and "sampai (kkal)", then Protein, Karbo and Lemak (g) as single fields, all `number-pad`. Messages: "Angka bulat saja", "Isi juga batas yang satunya", "Batas bawah tidak boleh lebih dari batas atas". A gram range on a source package (every legacy two-menu package has them) is carried through "Salin jadi paket baru" untouched and shown as a range; the first edit replaces it with one number. Menus keep `nutrition: null`. The package view shows "Gizi per porsi: {gizi}".
- **Truth.** The demo seed fills all six demo packages. The hosted catalogue carries none until a caterer enters them, and Catera never estimates macros.

### Import previews

- **Attachments** (Dapur Impor). "Lampiran · {n} dari 6" counts photos. Photos are 76dp thumbnails (`expo-image`, cover, radius 12, `sage` ground while decoding, 1dp `line` ring, 180ms fade). Remove is a 28dp charcoal badge with a cream glyph hanging 8dp off the photo corner, centred in a 48dp target ("Hapus foto {i}") pinned to the tile's top-right corner. Each tile reserves 10dp so the target stays inside its bounds and thumbnails sit 10dp apart. A thumbnail is an image button ("Foto {i} dari {n}") that opens the viewer, and a dashed 76dp "+ Foto" tile ends the row under six. PDF, CSV and XLSX are 52dp rows with a document glyph, the whole selectable name and a 48dp "Hapus {name}". While photos shrink, the add tile becomes a 76dp skeleton and ignores presses, and the count never passes six.
- **Viewer.** `impor-foto` (`/impor-foto?i={i}`) is a `fullScreenModal` with Close at the leading edge and the title "Foto {i} dari {n}". The whole photo fits (`contain`, no pinch). A failed decode shows the `sage` ground and "Foto ini tidak bisa ditampilkan.", and a photo not in the import replaces itself with `/impor`. Helpers never open it.
- **Reading.** While the assistant reads, the footer button is replaced by `MascotReading` at 120 with "Membaca daftar pelanggan…" and "{n} foto dan {m} file" (non-zero parts only). The start of reading is announced once through `announceForAccessibility`. Attachments stay openable but cannot change. The add tile and "+ PDF / Excel" stay in place, dimmed to 0.45, with the hint "Bisa lagi setelah selesai membaca.", so nothing below them moves.
- **Data.** `Attachment` images keep the picked `uri` on the phone. The request body is unchanged and carries no uri.

### The Dapur MOTION 2 dial

Owner decision of October 10, 2026. Dapur is ENERGY 1 / RHYTHM 1 / MOTION 2 (plus press micro-feedback), and the customer app stays ENERGY 2 / RHYTHM 2 / MOTION 2. Dapur gets the customer vocabulary: skeletons, toasts, outcome beats, insert and remove motion, and mascot art in empty and error states. It keeps its restraint elsewhere: rows and money totals stay still, nothing staggers, Pelanggan filters and pulls swap without motion, and the count card keeps one height. The identity motif stays the day arc and the lunchbox, and the one accent stays sunrise ink (since Phase G, only on the tracker's current stop).

### Owner decisions, October 10 and 11, 2026

- **October 10.** Fix all 17 audit 008 findings. **Decision A:** rows the user's own action inserts or removes animate and neighbours slide, data loads cross-fade from the skeleton as one block, and "never stagger a catalog, any list or any sequence" stays for loaded content. **Decision B:** the fifteen transparent derivatives count as the transparent artwork the October 9 ruling waited for. The splash moves to the theme canvas with light and dark variants and the Android adaptive icon is configured. **Dapur dial:** MOTION 2. **Artwork:** code-drawn motion pieces plus owner-generated illustrated poses. **Canvas:** approved. Decision C (splash verification) was not answered, so the default stands: configured and config-tested, not seen on a device.
- **October 11.** The delivered artwork (13 stills, 10 rig layers, vector confetti) is approved as processed derivatives. Every plan, build, review and design pass also loads `design-taste-frontend` (native scope: skeletons over spinners, motivated motion, contrast, no em dashes) and `impeccable`. Process: Sonnet writes first builds and docs, and Opus writes a first build only with a written reason. Opus fixes, reviews and runs gates. Only gate agents take screenshots, and contact sheets are script-captured. Contrast, tap-target and truncation checks are scripted. The final gate re-checks only earlier failures and the unverified list. The controller runs checks in the background, reads return contracts rather than full reports, and takes no idle status turns.
- **Controller rulings during the build** (not owner decisions, each stated where it applies above): toast anchors and the sheet-bottom toast rule, screen-reader hold times, runtime art sized for 3x screens, sign-out unregisters this phone, no Android share toast, Bayar's header stays "Bayar", no address delete, "Memperbarui…" in the meta row, and held art fading in place.

### Evidence and limits

Covered by Jest, Vitest and typecheck at `7cf0f23d`: root 786, customer 1245 and Dapur 520 tests, a clean `npm run build`, `npm run test:postgres` and `packages/brand/verify-phase-f.mjs` (23 files, no failures), including `tests/native-contrast.test.ts`, `tests/native-theme-guard.test.ts`, `tests/brand-phase-f.test.ts`, `tests/device-unregister.test.ts` and the apps' `launch`, `skeletons`, `settings`, `sheets` (Dapur: `dapur-sheets`), `feedback`, `empty-states`, `nutrition` and `import` suites. The `device.unregister` concurrency scenario is in `tests/postgres-concurrency.mjs`. **Not verified on a device:** everything on iOS (large-title sheets, keyboard in sheets, toast placement, the confirm sheet over a tab-stack sheet), the Android form-sheet go/no-go checks (Task 9 (a) to (e)), the native splash and icons on both platforms, the Android 12 splash mask, predictive back, the confetti box, `RowSwap`'s skipped exits, the real push switch states (Expo Go reports `unavailable`), TalkBack and VoiceOver reading, and font scale 1.3 at 360dp. The follow-up audit lists each check, and the Phase G kickoff carries them forward.

## Colour revision (Phase G), October 2026

Owner decision of October 13, 2026: direction K, "Today's palette, used with restraint" ([Phase G spec](docs/superpowers/specs/2026-10-13-native-phase-g-design.md), section 2), built in `98af208e` and `15413164`. The owner reopened the palette on October 13, turned down directions A to J, and asked for colour to be spent the way top apps spend it. That decision overrides the AGENTS.md sentence "preserve the latest approved palette" for how the hues are used. The hues themselves are unchanged: Forest `#163D2E`, Sunrise `#F47B2A`, Sunrise ink `#9B4309`, Cream `#FFF7E9` and Charcoal `#2E2E2E`, so the artwork needs no recolour. AGENTS.md is the owner's file and still carries the old sentence; whether to amend it is the owner's call (spec section 14.1).

This section covers the native apps only. The web keeps the frontmatter palette.

### What it supersedes

- The `nativeThemes` values for the keys in the theme table below, and the light-equals-web rule of Native dark theme and Native theme, October 9, 2026: light `canvas`, `line`, `muted`, `tabBar` and `tabIndicator` now differ from the web `colors`.
- The whole mood table under Native mood and theme, Mood tokens. Siang and Malam are now a faint header tint plus the sun or moon mark. The Malam pattern is gone (`pattern: null`).
- Dark mode's forest and cream inversion for `forest`: dark `forest` is now forest light `#9CCBAE`, not cream. Dark `cream` stays `#163D2E`, so a dark primary button is a mint fill with a forest label.
- Every rule that puts Sunrise or Sunrise ink on a price, a review star, a heart, a calendar mark, a photo ring, a sticker border, a delivery note or an action word. "Perpanjang" on Beranda is charcoal like the other action words; "the one accent is sunrise ink" now means the tracker's current stop (see rule 4).
- The status bar's mood rule. The glyphs follow the theme alone (`statusBarStyle`, `packages/mobile-ui/src/mood.tsx:99-107`): dark glyphs in light, light glyphs in dark, whatever the mood.

### The seven rules

From 30 Mobbin iOS screens (`output/native-review/phase-g/palette/mobbin-colour-restraint.md`): the median screen spends about 2 percent of its area on the brand colour, structural screens 0 to 4 percent, checkouts 4 to 13 percent, and only four screens reach 15 percent, each one deliberate moment.

1. **Neutral ground and bars.** The page, the headers and the tab bar are cream and neutral steps in light and charcoal steps in dark. Forest and Sunrise never fill a surface behind content.
2. **One filled brand control per screen.** Forest fills only the primary button: the hero button, `StickyAction`, a sheet's main action. Secondary actions are outlined or text.
3. **Selection is a small mark.** Forest marks the active tab, the selected segment (ring and label), the chosen calendar date and the today ring. The saved heart is a selection, so it is forest too.
4. **The tracker is ink.** The line and the stops reached use the hero ink. `stopActive` (Sunrise ink in light, Sunrise in dark) marks the current stop and nothing else.
5. **Personality comes from photos and the mascot.** The meal photo leads the meal card.
6. **One branded moment per screen.** Paket selesai and the payment confirmation: the mascot on the `#FFEFD9` success disc above the one forest button. Nothing else paints a coloured block.
7. **Prices and warnings speak their own language.** A price is bold charcoal. A warning is `heroWarn` on the hero or `danger` off it, always with an icon and words, never the brand accent.

### Theme tokens (`nativeThemes`, K)

`packages/design-tokens/src/index.ts:108-151`. Keys not listed keep their earlier value (light from the web `colors`): `sunrise`, `sunriseInk`, `sage`, `charcoal`, `cream`, `scheduled`, `danger`, `fieldBorder`, `secondaryBorder`, `attentionBorder`, `controlRing`, `disabledFill` and the three toast keys.

| Key | Light | Dark | Was (light / dark) |
| --- | --- | --- | --- |
| `canvas` | `#E4DED1` | `#151514` | `#FDFAF3` / `#151514` |
| `surface` | `#FFFEFA` | `#292927` | `#FFFEFA` / `#232321` |
| `line` | `#D3CEC1` | `#3A3A37` | `#E2E3D8` / `#34332F` |
| `muted` | `#555B54` | `#B5B2AA` | `#60675F` / `#B5B2AA` |
| `tabBar` | `#FFF7E9` | `#292927` | `#F2ECDF` / `#1E1E1C` |
| `tabIndicator` | `#D3CEC1` | `#444441` | `#BFD8BB` / `#163D2E` |
| `forest` | `#163D2E` | `#9CCBAE` | `#163D2E` / `#FFF7E9` |
| `forestDeep` | `#0C2C20` | `#7FB093` | `#0C2C20` / `#E9E3D6` |
| `overlayInk` (new) | `#1B1B1A` | `#1B1B1A` | none |
| `photoGround` (new) | `#2E2E2E` | `#2E2E2E` | none |

`overlayInk` is the neutral photo overlay and `photoGround` the ground of a photo that failed to load; they differ by at most 2:1, so a failed photo shows no band. The Android tab pill (`tabIndicator`) is a neutral pill, not a sage block (spec open item 14.3, closed this way in `98af208e`). The photo scrim is `nativePhoto` (`index.ts:254-259`): a ramp from 0 at the top of the photo to 0.3 at the bottom, a text block ramping 0 to 0.72 over 26dp, and the "⋮" corner button on its own 0.66 ground. The flat 0.66 overlay and the old `scrimSoft` are gone.

### Mood tokens (`nativeMood`, K)

`index.ts:171-215`. The mood is only the header tint: within a theme, every key except `header` is the same for Siang and Malam.

| Key | Light Siang | Light Malam | Dark Siang | Dark Malam |
| --- | --- | --- | --- | --- |
| `header` | `#FFF7E9` | `#F3F6EF` | `#2E2B25` | `#2A2D27` |
| `headerText` | `#2E2E2E` | `#2E2E2E` | `#F5F1E8` | `#F5F1E8` |
| `headerMeta` | `#555B54` | `#555B54` | `#B5B2AA` | `#B5B2AA` |
| `toggleTrack` | `#FFFEFA` | `#FFFEFA` | `#292927` | `#292927` |
| `toggleActive` | `#163D2E` | `#163D2E` | `#9CCBAE` | `#9CCBAE` |
| `onToggleActive` | `#FFFEFA` | `#FFFEFA` | `#292927` | `#292927` |
| `arcTrack` (decorative) | `#C9C6BA` | `#C9C6BA` | `#4E4C47` | `#4E4C47` |
| `markerActive` | `#2E2E2E` | `#2E2E2E` | `#F5F1E8` | `#F5F1E8` |
| `markerIdle` | `#858D80` | `#858D80` | `#8A8780` | `#8A8780` |
| `todayRing` | `#163D2E` | `#163D2E` | `#9CCBAE` | `#9CCBAE` |
| `hero` | `surface` (`#FFFEFA`) | `surface` | `surface` (`#292927`) | `surface` |
| `heroText` / `heroMeta` | `#2E2E2E` / `#555B54` | same | `#F5F1E8` / `#B5B2AA` | same |
| `heroShadow` | `0 6px 18px rgba(46,46,46,0.10)` | same | `0 6px 18px rgba(0,0,0,0.35)` | same |
| `heroWarn` (new) | `#A33024` | `#A33024` | `#FF8F80` | `#FF8F80` |
| `heroEdge` (new) | `#C9C6BA` | `#C9C6BA` | `#4E4C47` | `#4E4C47` |
| `stopActive` (new) | `#9B4309` | `#9B4309` | `#F47B2A` | `#F47B2A` |
| `pattern` | none | none | none | none |

`nativeArt.successDisc` is the literal `#FFEFD9` (`index.ts:223`), because it used to read the light Siang header, which K changed. The success ring stays Sunrise ink and the sparkles keep Sunrise and Sunrise ink (`index.ts:221-233`).

Derived steps, each added because a pair failed with the base hex (spec section 2.4): the page neutral `#E4DED1` (the old canvas sat 1.03:1 under a white card), the pale sage Malam header `#F3F6EF`, muted deep `#555B54` (`#60675F` is 4.35:1 on the new page), the card edge `#C9C6BA`, the dark card `#292927`, the dark warm header `#2E2B25`, the dark card edge `#4E4C47`, forest light `#9CCBAE` (forest itself is 1.21:1 on the dark card) and the overlay ink `#1B1B1A`.

### Surfaces

- **Meal card and hero.** One plain lifted card: the `hero` fill, the food photo first, a 1.5dp `heroEdge`, and the soft `heroShadow`. Package and list cards use `surface` on the new canvas (1.33:1) with no border.
- **Hero button** (the hero and the Dapur count card): forest fill, cream label, no edge.
- **Search field:** `surface` fill, edge `#858D80` light and `#8A8780` dark, placeholder `muted`.
- **Demo strip:** `canvas` fill and `muted` text (`95d4eaf0`).
- **Photo rings** (`PhotoRing`, `packages/mobile-ui/src/PhotoRing.tsx:93`): a selected ring is forest, a dinner ring charcoal, a lunch ring `controlRing` grey. The earlier sunrise-ink lunch ring and forest dinner ring are retired.
- **Headings and titles** read charcoal, not forest: the iOS large and inline titles, the Android bar title and the Android first-line `nativeTitle` (`packages/mobile-ui/src/nativeHeader.ts:42-49`, `components.tsx:645`), superseding the forest titles under Native navigation and chrome. The iOS back tint stays forest. Forest is text only on lines marked as a selection, an action or an accent (`tests/native-theme-guard.test.ts:245-268`), and no `Text` variant reads forest (`:275`).

### Contrast result: 156 of 156 pairs pass

The pair list is 39 per look in four looks, computed from the hex values in `output/native-review/phase-g/palette/directions-v2.json` by `output/native-review/phase-g/scripts/palette-directions-v2.cjs`. The shipped palette of October 12 fails 34 of 144 on the same rules (12 pairs were added after audit 009). Rules: text at least 4.5:1 with no large-text exception; a control boundary that is the only cue (the hero button edge, the Gagal diantar stop) at least 3:1; adjacent surfaces at least 1.2:1, or a named edge token at least 1.5:1 against the outer ground; a failed photo shows no band (overlay and ground within 2:1); the scrim has no straight edge.

| Group | Lowest ratio in any look | Minimum |
| --- | --- | --- |
| Text on its surface (header, hero, card, tab bar, field, strip, button label) | 5.2 (demo strip text, light) | 4.5 |
| Component boundaries (search field, track, idle marker, hero button, Gagal diantar stop) | 3.14 (search field on the header, light Malam) | 3 |
| Adjacent surfaces | 1.23 (mood header on the canvas, light Malam) | 1.2 |
| Hero on the mood header (the edge carries it) | 1.03 raw; edge 1.57 to 1.65 | 1.5 edge |
| Failed-photo band against the overlay | 1.21 | at most 2 |
| Scrim edge across a loaded photo | a ramp from 0, no straight edge | pass |

Outside the 156: the current tracker stop on the meal card is 6.5:1 in light and 5.35:1 in dark (at least 3); a bold charcoal price is 13.46:1 light and 12.93:1 dark; `heroWarn` on the hero is 6.92:1 light and 6.59:1 dark; the forest button label is 11.33:1 light and 6.64:1 dark.

`tests/native-contrast.test.ts` enforces the same rules from the token objects, not from the script: the exact K values (`:27-97`), 37 ratio pairs per look plus the failed-photo band rule (`:151-177`; the comment at `:155-156` maps them to the spec's 39), and the component rules (`:182-247`: the current stop at least 3:1 on the hero, prices, `heroWarn`, the derived dark `forestDeep`, the tab pill at least 1.4:1 off the bar, the lunch and dinner rings, the danger confirm, the toast, and every text colour on every fill).

### The Sunrise spend

After Phase G, Sunrise and Sunrise ink are read only by the tracker's current stop (`stopActive`, `RantangTrack.tsx:432`), `nativeArt` (the success ring, the reading highlight, the sparkles), the confetti file and the launch hand-off sparkles. `tests/native-theme-guard.test.ts:128-141` fails when any other native source reads `sunrise` or `sunriseInk` (allowed: `RantangTrack.tsx`, `Confetti.tsx`, `LaunchCover.tsx`; `nativeArt` lives in the tokens package, outside the scan). No guard restricts who reads `stopActive`; today only `RantangTrack` does. Other guards in the same file: no card is filled in forest (`:145`), the Malam pattern is gone (`:158`), and no loose error text (`:170-234`, see Errors).

## Customer layout scale (October 2026)

Layout only, customer app (`apps/customer`) only: sizing, spacing, density, hierarchy and placement. Palette K (Colour revision (Phase G), above), the artwork, the names, the copy glossary, the motion rules, the server rules and the four tabs are unchanged. Catera Dapur's own layout pass, on this scale with a 48 touch target, is "Dapur layout scale (October 2026)", below. Sources: the [layout spec](docs/superpowers/specs/2026-10-23-customer-layout-design.md), the [plan](docs/superpowers/plans/2026-10-23-customer-layout.md) and the rulings recorded while it was built (listed with their costs in the [layout handoff](docs/superpowers/handoffs/2026-10-23-customer-layout-handoff.md)). Built on `v2` from `fecd0490` to `709e08a8`.

### Owner decisions

- October 22, 2026: re-layout and move content; the tabs and their names stay. The mood header shrinks into a food-led hero, with the mood tint and the day statement kept and the arc replaced by a compact two-stop status line. Balanced density. Design for one plan, sometimes two; several plans get a compact rail; the 8-plan demo customer is the stress case.
- October 23, 2026: Jelajah is option B, a 2-column grid. The side margin is 16 (the canvas offered 16 or 20; 20 stays a one-constant switch).
- Skills for this pass: `ui-ux-pro-max` and the app-screen rules of `design-taste-frontend` (one question per screen, the biggest block carries it, capped lists, row geometry).

### What it supersedes (customer screens only)

Dapur keeps every rule below. For customer screens these earlier statements no longer describe the app:

- Typography, the native ramp table: customer screens use the new variants below. The table still describes the existing variants, which keep their values.
- Layout, "body 20 side padding": the customer margin is 16.
- Native mood and theme, Shapes, depth and type: the Beranda hero overlap of 58, the hero radius 28 with an inner photo radius 20, buttons 10 and chips at their classic size.
- Native mood and theme, Two independent axes: `MoodArc` is no longer drawn on any customer screen, and Jelajah's header no longer carries a mood fill.
- Components and behaviour: the Phase B mood header on Beranda with its headline and the day arc (Day arc switch), the large Siang/Malam meal buttons on Jelajah (Toggles, Jelajah), and the Beranda bullets for the headline, the hero pager's equal heights and 64 inset, the other-meal row, the bordered "Perlu kamu urus" list, the Menu besok row, the Berikutnya rows with 40dp rings and the plans row. The Menu besok story, its seen marks and the recap card are unchanged.
- The Jadwal bullet (photo cells, the day number in a pill, dashed borders) and Hari as a pushed screen with a title bar and the ⋮ menu.
- The plan detail hero (the 10 frame, radius 28 and 168 photo), its caterer line above the hero, and the 60dp `PhotoRing` rows with a per-row ⋮.
- Native navigation and chrome, "On every tab root the top row is 48dp": under the customer scale the MoodHeader top row is 44, Beranda's band row is 36 and Jelajah's header is plain.
- Akun's gear, its embedded plan list and the "Paket aktif" screen title (now "Paket saya").

### Tokens and the opt-in

`nativeLayout` in `packages/design-tokens/src/index.ts`:

| Key | Value |
| --- | --- |
| `space` | 4, 8, 12, 16, 24, 32, 48 |
| `margin` | 16 (classic screens use 20) |
| `sectionGap` / `headingGap` / `groupGap` | 32 / 12 / 8 |
| `cardPadding` | 16 |
| `radius` | thumb 8, control 12, card 16, sheet 24; buttons are fully round |
| `control` | button 50, field 50, search 44, chip 34, icon 44 |
| `row` | single 56, media 72, key-value 40, info 48; Dapur: compact 64, check 56 |
| `thumb` | 56 and 64; Dapur: compact 48 |
| `ratio` | hero 4:3, card 16:10, tile 4:3 |
| `dense.sectionGap` | 24 (Dapur sections) |
| `figure` | lead 32, leadLine 40 (the `figure` variant) |

`LayoutScaleProvider`, `useLayoutScale`, `useScreenMargin` and `LayoutScaleName` live in `packages/mobile-ui/src/layoutScale.tsx` and are exported from `@catera/mobile-ui`. The default scale is `classic`. `apps/customer/app/_layout.tsx` provides `v2`, between `ThemeProvider` and `MoodProvider`. Dapur provides `v2` at the same level with `target={48}` (`apps/caterer/app/_layout.tsx:181`), and `apps/caterer/tests/layout-dapur.test.tsx` (formerly `layout-classic.test.tsx`) pins that opt-in; see "Dapur layout scale (October 2026)".

Shared components under `v2`:

- `Screen`: side margin 16 from `useScreenMargin()` (20 classic), also used by the Android native title and by `MoodHeader`'s content padding.
- `Button`: 50 tall, radius 25 (the `text` variant too).
- `Chip` and each `Segmented` segment: 34 tall, radius 17, `hitSlop` 5 above and below for a 44 target. The segmented track has radius 21. `FilterChip` renders the shared `Chip`.
- `Field`: 50.
- `Card`: radius 16, gap 8 (classic 10), content 16 in. In light the surface and sage tones draw a 1px `cardBorder` hairline with a faint `cardShadow` and pad 15; in dark they have no border and pad 16 (`cardEdge`, `packages/mobile-ui/src/theme.tsx`, from the white-page revision of October 23). The attention tone keeps a 1px `attentionBorder` edge with padding 15, so its content still sits 16 in.
- `MoodHeader`: the top row is 44 (classic 48). `band` gives Beranda's 36 meta row and a 4 gap; `plain` draws the header on the canvas with no mood fill and no rounded panel; `overlap` is a number.
- `ScreenFooter`: no top hairline, 16 bottom padding (82 around a 50 button), filled with the canvas tone so a card scrolling under it stops at a tone step. On Android, on screens above the tabs (Buy, Bayar, Paket, Claim, plan detail), it adds the bottom safe-area inset, so the button clears the system navigation bar. Footers inside the tabs add nothing.
- `Stepper`: 56 row, 44 round buttons on `sage`, charcoal glyphs, optional leading glyph. Classic keeps its 48 buttons and forest glyphs.
- `HeroPager`: the card is the pager width minus (margin + 12 gap + 32 peek), 60 under `v2` and 64 classic. Each page keeps its own height, top-aligned.
- Additive props with unchanged defaults: `Skeleton.aspectRatio`, `SaveHeart.compact` (44 target, 32 surface disc) and `SaveHeart.circle` (44 surface circle), `Chip.accessibilityLabel`, `Card.testID`.

### Text variants

New `Text` variants in `packages/mobile-ui/src/components.tsx`. The weight is applied through `fontFamily` (`fontFor`), as for every native weight. `largeTitle`, `heroTitle` and `section` are headers for screen readers. Existing variants keep their values.

| Variant | Size / line | Weight | Tracking | Colour |
| --- | --- | --- | --- | --- |
| `largeTitle` | 32 / 40 | 700 | -0.8 | charcoal |
| `heroTitle` | 24 / 30 | 700 | -0.4 | charcoal |
| `section` | 20 / 26 | 700 | -0.2 | charcoal |
| `rowTitle` | 17 / 22 | 600 | none | charcoal |
| `bodyL` | 15 / 22 | 400 | none | charcoal |
| `bodyStrong` | 15 / 22 | 600 | none | charcoal |
| `meta` | 13 / 18 | 400 | none | muted |

Prices and footer amounts use `section` at 800 with tabular figures.

### Customer layout blocks

Read by every redesigned screen and by its skeleton. Since the Dapur layout pass they live in `packages/mobile-ui/src/layout/`, and the files in `apps/customer/src/layout` (and `today/HeroPhoto.tsx`) re-export them:

- `SectionHeader`: a `section` title (role header) with an optional trailing link, 12 above the content.
- `ListCard`: one surface card, separators between rows only (n-1). Like `Card`, it draws the light `cardBorder` hairline and shadow with 15 side padding, and no border in dark. Separator insets: `MEDIA_INSET` 68 (default), `GLYPH_INSET` 52, `BARE_GLYPH_INSET` 32.
- `MediaRow`: 72 tall with a 56 thumb, title `rowTitle` and `meta` on one line each, optional chevron or trailing node, a button only with `onPress`. `wrap` is `true` (title and meta grow) or `"title"` (only the title grows).
- `GlyphRow`: 56, 72 or 48. The 56 and 72 rows draw a 40 circle (`GLYPH_CIRCLE`), whose fill `tone` can set; a 48 info row always draws the bare 20 glyph (`GLYPH_BARE`). Optional `wrap`.
- `Thumb`: 56 or 64, radius 8. `notSet` is a dashed 1.5 `controlRing` tile with the restaurant-outline glyph.
- `GlyphCircle`: the 40 circle on its own (Buy's field rows).
- `HeroPhotoFrame` (`today/HeroPhoto.tsx`): an outer layer holding the 1.5 inset and the 14.5 corners, and an inner layer holding only the aspect ratio, so the photo fills the card's inner width. Putting the margin and the ratio on one node left a 4px gutter on the left and 14 to 17px on the right on Android (gate 2).
- `DecorativeIcon` and `rowLabel(...parts)`: row glyphs are hidden from screen readers, and a row's label joins its trimmed non-empty parts with ", ", so TalkBack hears no empty part or stray comma. `MediaRow` and `GlyphRow` label themselves this way unless the caller passes a label.

A `Text` or `Pressable` coloured with `c.forest` needs a `// forest: action|selection` marker (`tests/native-theme-guard.test.ts`).

### Beranda

Order: mood band, hero or hero pager, recap card, live slot, "Berikutnya", "Paket kamu". The loading skeleton reads the same constants.

- Mood band: `MoodHeader band`, the status inset plus 12, a 36 row with the sun or moon glyph (18) and the date in `meta` (with the "Memperbarui…" live region), a 4 gap, the day statement in `section` as one string, then 12 and the 40 status row. The band pads 16 plus 104 at the bottom, and the hero rides up into that 104 (`HERO_BAND_OVERLAP` 104; the data area lifts by `HERO_BAND_RISE`, -120). Radius 32 with a hero, 28 without. The old 58 and -74 numbers are gone.
- The statement names the meal and its state, never the dish: "Makan siang sedang diantar.", "Siang ini, 2 pengantaran.", or "... tidak ada pengantaran." with nothing coming.
- Status line (`StatusStops`): a tablist of two stops on the band, under the statement, for the single hero, the pager and no hero alike. The spec placed it in the hero body; it moved to the band after gate 2, because under a 2-plate pager it fell behind the tab bar. One row at least 40 tall. Each stop is a dot beside a two-line block (label `bodyStrong` "Siang 11.00–13.00", state line `meta`), with `hitSlop` 2 for a 44 target, and a 2dp `heroEdge` track runs between the stops. Dots: now is filled ink with a 16% ink halo, next an ink ring, none a `controlRing` ring, done filled muted. `stopActive` is not used here; palette K rule 4 keeps it for the tracker's current stop. At most one stop is "now": an earlier failed or unconfirmed meal counts as done once the other meal has started. The shown meal's label is forest at 700 and the other is ink at 600. A press calls `useMood().setMood` exactly as the arc did. The shown meal's state line is a short state label (the count for a pager); the other meal's is its waiting label, else its dish, else the count; a meal with nothing says "Tidak ada". `OtherMealRow` is gone.
- Hero card (`Plate`): radius 16, 1.5 `heroEdge`, `heroShadow`, no frame padding. The photo is 16:10 (`nativeLayout.ratio.card`) in a `HeroPhotoFrame`, not the spec's 4:3: with the tracker and the actions kept, 4:3 made the hero 77 to 87% of the first viewport. Body padding 16, gap 12: the meal line (`meta`) and the dish (`heroTitle`) 2 apart, a capitalised detail line (`meta`), the tracker, then the existing actions. The hero card holds no status line and no state sentence. Every Plate state is kept.
- Hero height, accepted: 54 to 76% of the first viewport (761dp on a 412x915 phone), by state. The spec's 40 to 60% holds only in quiet states. The 122dp tracker and the delivery actions are kept because the hero is the screen's question while a meal is under way.
- Hero pager: kept for several plates of the shown meal, with each page at its own height, top-aligned.
- Live slot: one 72 row surface card (radius 16, no border) showing the first waiting item in the existing order, with its action. When more wait, "n hal lainnya" is its own 44 link row under it, opening the pushed screen `/perlu-diurus` ("Perlu kamu urus"), which lists every item as a `ListCard` of 72 rows with a 40 `sage` glyph circle. Hidden when nothing waits.
- Berikutnya: `SectionHeader` with "Lihat jadwal", at most 3 delivery days. When every shown day has one delivery: one card of 72 rows with a 36 date column (weekday over the day number in `section`), a 56 thumb, the dish and "Besok · Siang 11.00–13.00". When a day has 2 or more: a day block (`rowTitle` label, `meta` "n pengantaran"), a 2-column grid (gap 12) of at most 2 tiles (photo 16:10 radius 12, `bodyStrong` dish, `meta` "Siang · caterer"), a canvas-tone tile "Malam tidak ada pengantaran" for an empty meal, and a 36 tall "+n lagi" link row (`hitSlop` to 44). Tomorrow's items open `/tomorrow?part=i`.
- Paket kamu: 1 or 2 plans are 72 rows. With 3 or more: "n paket aktif" with "Lihat semua", over a rail of cards (photo 16:10 radius 12, gap 8) sorted by soonest `ends_on`, then name. The rail bleeds to the screen edge through a wrapper margin (-16) with 16 content padding. A card is `min(168, (width - margin - 16 - 28) / 2)`: 168 from about 400dp up and 150 at 360dp, so a third card peeks.

### Jadwal and the day sheet

- Month band: the month in `heroTitle` in the header's top row with two 44 chevrons; a `meta` weekday row at least 20; cells 40 tall (`hitSlop` 2) with a 32 circle and the number at 15/500. Selected is a filled `toggleActive` circle with an `onToggleActive` number; today is a 2 `todayRing` ring. A delivery day has a 6 ink dot (`headerText`; `markerIdle` once past) placed at the cell's foot, outside the circle; a day whose menu is not set has a 6 ring (1.5, `markerIdle`). Only the weeks the month needs are drawn (October 2026 has 5). No photo, moon, pill or dashed ring. The grid sits at the header's 16 inset. Legend in `meta` with 6 swatches: "Ada pengantaran" and "Menu belum diisi".
- Read window: Jadwal reads whole Monday-to-Sunday weeks, from the month's first Monday to its last Sunday (October 2026 reads `2026-09-28` to `2026-11-01`), so the agenda never cuts a week at the month edge.
- Agenda: `section` "Minggu ini" with the range in `meta` on the heading row; any other week is "Pekan 26 Okt–1 Nov" ("Week of …") with "n pengantaran", because "Minggu <date>" reads as Sunday. One block per delivery day (`bodyStrong` "Kamis 22 Okt · Hari ini"), with a card of 72 rows: thumb 56 from the row's own menu, the lead dish as title (or "Menu belum diisi"), `meta` "Siang 11.00–13.00 · state". States: Terjadwal, Sedang dimasak, Sedang diantar, Sudah sampai, Gagal diantar, Laporan terkirim, and "Belum sampai" for today's meal past the start of its window (Beranda's due rule). A past day with no update reads "Sudah sampai" (see Customer deep pages, Jadwal agenda states). Days with nothing fold into one 56 surface card ("Sabtu dan Minggu tidak ada pengantaran"); the last row is a 56 link "Minggu depan, <range>". Selecting a date selects its week.
- Day sheet: `hari/[id]` is a form sheet in the root stack (`app/hari/[id].tsx`, `sheetOptions({ detents: "day" })`, detents 0.75 and 1, grabber, header hidden), so it covers the tab bar. The URL and every caller are unchanged; a cold link opens Beranda with the day over it. There is no title row: the first meal's `meta` line "date · meal · caterer" is the screen-reader header and focus target. Order: photo 16:10 radius 16, then per meal the `meta` line, the `heroTitle` dish, `bodyL` sides and a state line with a dot ("Terjadwal 11.00–13.00 · bisa diubah sampai hari ini 17.00", or "· sudah tidak bisa diubah"). The action row sits directly under the first meal's state line, before the 56 canvas-tone address well (radius 12, pin glyph) and before any further meal, so it is in view at the first detent. Body gap 16, a meal's own lines 4 apart.
- Day actions: 56 circles on `sage` with `meta` labels, in this order when they apply: Ubah hari, Pilih menu (pick-your-own) or Lihat menu, Ada masalah, Chat, Ganti alamat. One row (12 side padding, items 56 to 96 wide), wrapping to two lines below effective width 380 (`width / fontScale`). Ubah hari hides after the cut-off and on a closed day. Lihat menu opens the package page. The menu circles close the sheet and open their page in the tab beneath. The ⋮ menu, the pinned footer and the "Ada masalah" text link are gone from the sheet; `DayMore` remains in the Beranda hero's photo corner.

### Jelajah

- Header: a `plain` MoodHeader on the canvas with no mood band (spec 3.3: no tall mood stack). A 44 row with the 34 area chip inside a 44 target and the bare 44 saved heart, the `heroTitle` question on one line ("Makan siang minggu depan?"), then the 44 search pill 16 under the title. The chips sit 12 under the search and the grid 16 under the chips.
- Chip row: a 44 tall frame running from the margin to the right screen edge. First the Siang/Malam segment (a 34 surface track centred in the row, 30 pills, 44 tall tabs, sun and moon glyphs, the selected pill with a 1.5 forest ring and a 700 forest label), then the budget and trial chips, then up to six category chips. The 66 photo rings and the 60 tall meal buttons are gone.
- Grid (`PackageGrid`): 2 columns, column gap 12, row gap 20, one column below effective width 300. Tile (`PackageCard`): photo 4:3 radius 12, heart as a 44 target with a 32 surface disc, name `bodyStrong` up to 2 lines, caterer `meta` one line, price `bodyStrong` 700 with "/ makan", and always one `meta` line: "± 610 kkal · coba 1 hari", calories alone, or "Belum bisa dicoba". The "n kali makan / hari" note left the tile and stays on the package page. Disimpan uses the same grid, and its skeleton is the tile grid.
- Fold target: 4 full tiles above the tab bar in production (no demo strip) on Pixel 8 geometry (50dp status inset, 104dp tab bar). The grid starts 262dp from the top. By the builder's arithmetic from the rendered styles, two-line names leave about 9dp to spare in production and overrun the bar by about 15dp on the demo build (its 24dp strip); one-line names fit on both. Gate 2 measured all 4 tiles above the tab bar on the demo build, 3.8dp to spare.

### Package detail

- The photo is 4:3 across the full page width, including the status inset, under the transparent bar. The pull to the top is FadeSwap's alone; the photo has no vertical margin (a negative top margin on a stretched `aspectRatio` box made it 1080x852 on the gate).
- Back and heart sit in the bar as two 44 surface circles (`headerLeft` and `headerRight`). The heart stays in the bar once the photo has scrolled away; back returns to the platform back.
- Then: name `heroTitle`, caterer `meta`, the stat strip (`StatStrip`, one card of up to three cells: kkal, protein, meals a day; numbers `section` 800, labels `meta`; stacks below effective width 340), carbs and fat as one `meta` line, the caveat line, the description in `bodyL`. "Isi paket": 72 `GlyphRow`s with a 40 circle on the Siang or Malam header tint, the meal in `rowTitle` and the menu source with the dishes in `meta` ("Menu contoh · Ayam bakar madu"). "Pengantaran": 48 info rows with bare 20 glyphs in `bodyL` that wrap. Reviews keep their block. Sections are 32 apart.
- Sticky footer 82: price `section` 800 with "Per sekali makan" in `meta`, "Coba 1 hari" outlined and "Pilih jadwal" primary, both 50.

### Akun and Paket saya

- Akun: MoodHeader with the 56 initials avatar (hidden from screen readers) and the name in `heroTitle` in the top row, and a `meta` contact line. Then three tiles (min 96, gap 8, radius 16, padding 12; glyph over a `bodyStrong` label over a `meta` count): Paket saya "n aktif", Alamat "n tersimpan", Riwayat "Pembayaran", with "Tidak ada" for zero. The counts come from the existing `akun:customer` read. Below effective width 340 the tiles stack into one column of 72 rows with the glyph beside the words, so 412dp at font scale 1.3 (316) stacks. Then 32, a card of four 56 bare-glyph rows (Data akun, Disimpan, Notifikasi, Bantuan dan laporan), 16, and a separate Pengaturan card row with "Bahasa, tampilan" under its title. No gear and no plan rows.
- Paket saya (`/paket-saya`, title "Paket saya"): `section` "Aktif" with "n paket", a card of 72 rows (56 photo, "kitchen · n hari lagi") sorted by `ends_on` then name. "Selesai" (completed plans, latest end first) shows only when such plans exist; cancelled plans never show. A failed read shows the puzzled mascot.

### Plan detail

- The hero is Beranda's card: radius 16, 1.5 edge, shadow, a 16:10 photo in `HeroPhotoFrame`, body 16 with gap 12: `meta` "caterer · meal", `heroTitle` "n hari lagi" (`remainingLabel`), `meta` date range, and the renewed tag.
- "Berikutnya": `SectionHeader` and a card of 72 `MediaRow`s (thumb 56, date `rowTitle` that may wrap, dishes on one truncated `meta` line, chevron). No per-row ⋮; day actions live in the day sheet.
- The sticky footer action and its conditions are kept, as spec 3.6 says, instead of the canvas's "Perpanjang paket" outline inside the hero.

### Buy

- Order: summary card (64 thumb, name `rowTitle`, caterer and price `meta`, padding 12), 24, then one card of field rows with 40 glyph circles and separators inset 52: Mulai 72 (trailing "Ubah"), Lama paket 56 (or the existing length options), Porsi per hari 56 (44 stepper circles), Diantar ke 72 (trailing "Ganti", or "Tambah alamat"). Then "Rincian" (a card of 40 rows in `bodyL`), "Bayar dengan", and the terms. Sections are 32 apart with 12 under each heading.
- The terms sentence is one 44 tall link row (`buy-terms`) that opens the terms; the link words keep their underline.
- Footer: "Total" in `meta` over the amount in `section` 800, and the primary "Bayar" (50, min width 168) at the right. They stack below effective width 300, so 360dp at font scale 1.3 stacks and 412dp at 1.3 keeps the row.
- Pending payment, quote error and still-running blocks are kept.

### Evidence

- Jest, customer app (`apps/customer/tests`): `ui-foundation`, `layout-blocks`, `status-stops`, `beranda-sections`, `today`, `hero-arrival`, `tomorrow`, `recap`, `skeletons`, `loading`, `empty-states`, `schedule`, `sheets`, `customer-sheets`, `navigation`, `native-header`, `mood`, `discover`, `feedback`, `nutrition`, `package-detail-header`, `account`, `paket-saya`, `plan`, `buy` and `help`. Caterer: `apps/caterer/tests/layout-classic.test.tsx` and `menu.test.tsx` (classic header). Root Vitest: `tests/native-font-weights.test.ts`, `tests/native-theme-guard.test.ts`, `tests/home.test.ts`.
- Checks at `709e08a8`, as recorded by the final fix wave: customer Jest 1726 of 1727 (the one failure is the baseline `customer-sheets` "moving a day toasts the new date", which derives its dates from the real clock), caterer Jest 618 of 618, root Vitest 1044 of 1044, root typecheck clean.
- Emulator gates on the Pixel 8 API 36 emulator (1080x2400, 412x915dp), Expo Go, the demo customer with 8 plans, captures with uiautomator XML and contact sheets under `output/native-review/layout-2026-10-23/`: `gate1/` (head `0864b2b0`, 10 failures, all routed to fixes), `gate2/` (head `ba9105d2`, 8 failures, all routed to fixes; touch areas checked by tapping), and `final/` (head `d4dee269`: 16 of the 18 earlier failures fixed and 2 partly; 4 failures, which `709e08a8` fixes and covers in Jest). The emulator re-check of those four on `709e08a8` passed (`recheck/`): each pager page keeps its own height with a 16dp foot; at 360dp the plans rail cards are 150dp and the third card shows 28dp; the Buy footer ends Bayar 16dp above the navigation bar inset, and package detail and plan detail keep their footers flush with the tab bar; the terms link is a 44dp target. Final checks on `709e08a8`: typecheck, root Vitest 1044/1044, customer Jest 1726/1727 (the one failure is the recorded date-dependent baseline), caterer Jest 618/618, `npm run build` pass.

### Not verified

- Anything on iOS (no Mac): the bar's back and heart circles (the iOS bar may wrap a `headerRight` view in its glass button), swipe back with a custom `headerLeft`, the day-parented sheets opened by a link (two root sheets pushed in one tick). The Akun avatar is hidden with Android props only, so VoiceOver may still read the initials (an open minor).
- The production build without the demo strip. The Jelajah fold and the Beranda hero heights for production are computed from rendered styles, not measured.
- From the gates: Beranda with one or two plans (Jest only), a status stop in its "now" state, the "Malam tidak ada pengantaran" tile, the screen behind "n hal lainnya" and the "+n lagi" targets on a device, the day sheet's Ubah hari and Pilih menu circles, Jelajah at font scale 1.3 and 360dp after the gate fixes, the area picker, search, filtered-empty and save-error states, the loading grid on a device, the package reviews block and a two-meal package page.
- Live TalkBack and VoiceOver passes. Label structure is tested in Jest only.
- Whether the Android footer keeps the navigation inset above the keyboard.

This is not a device or release approval.

## Dapur layout scale (October 2026)

Layout only, Catera Dapur (`apps/caterer`) only: sizing, spacing, density, hierarchy and placement. Palette K, the artwork, the names, the copy glossary, the motion dials (Dapur ENERGY 1 / RHYTHM 1 / MOTION 2), the server rules, the four tabs and `tabsForRole` are unchanged. Every shared change is additive and keeps the customer's defaults, and the customer Jest suite stayed at its baseline throughout. Sources: the [spec](docs/superpowers/specs/2026-10-24-dapur-layout-design.md), the [plan](docs/superpowers/plans/2026-10-24-dapur-layout.md), the [research synthesis](docs/superpowers/research/2026-10-24-dapur-layout-synthesis.md), the canvas `https://claude.ai/artifact/UasscRdNooRxK3cPZtPDEo` (its "Sesudah" boards are the visual contract where this text is silent), and the rulings recorded while it was built, listed with their costs in the [Dapur layout handoff](docs/superpowers/handoffs/2026-10-24-dapur-layout-handoff.md). Built on `v2` from `78c8f9a2` (the plan) to `4069ad17`.

### Owner decisions

- October 24, 2026: Dapur only, layout only, every screen equally important. Skills: `expo-native-ui` with the app-screen rules of `design-taste-frontend` (`expo-native-ui` wins on a conflict), `humanizer` for copy, superpowers for process. Density: "let research decide".
- October 24, 2026: full autonomy, with the controller deciding on the owner's behalf (owner proxy) and recording each ruling and its cost in the ledger. Speed mode was planned until 04:00 WIB; the owner ended it at about 03:45 WIB and the default model rules ran from then. Pushing still needs the owner.
- The owner-proxy rulings that shape this contract: Dapur opts into `v2` with a 48 target rather than a third scale; Hari ini is built from sections (option A), not a segmented control (option B hides half the day); stop rows keep both trailing buttons; sheet side padding stays the shared `sheetSidePadding`; fold targets are measured against the real tab bar (its top at 810dp on the Pixel 8 in Expo Go), not the canvas's 820.

### What it supersedes (Dapur screens)

For Dapur, these earlier statements no longer describe the app:

- Customer layout scale, "Dapur keeps every rule below": Dapur now takes the shared v2 geometry that section lists (margin 16, Button 50 and round, Field 50, Chip and Segmented 34, Card radius 16 with gap 8, ScreenFooter, Stepper 56 with 44 circles), with a 48 touch target where the customer has 44.
- Typography, the native ramp: Dapur screens use the v2 variants and `figure`, and none uses `display` or `number`. A few classic `heading` and `label` texts remain (`PackageEditor.tsx:126`, `RoleGate.tsx:56`, `ReportScreen.tsx:369` and `:386`, `TodayScreen.tsx:279`).
- Layout, "body 20 side padding": the Dapur margin is 16.
- Native mood and theme, Components and behaviour: the Dapur Hari ini header with its count card, Daftar masak's `heading` quantities and its text Bagikan and Cetak, Urutan antar's wrapping name line and indented note, the one card that held both the cooking part and the run, and Dapur Menu's 64-high day buttons that wrap. Each of those bullets now carries a note that points here.
- Native mood and theme, Daily-loop components: `CheckRow`, `StopRow` and `RantangTrack` keep the geometry described there below a 48 target and at their default size. Dapur draws the geometry below.
- Every earlier mention of the "Dapur count card" (the Phase C stage feedback, the mood cross-fade, the journey captions, the `memasak` still, the 22 radius) now means the Hari ini header: the figure strip and the compact track. The count card and its mascot slot are gone; the mascot stays on DoneCard and the empty states.
- Native polish (Phase F), Loading: the Dapur skeleton numbers. Native Phase G: the 64dp proof thumbnail, the rule that tab-stack sheets keep their actions in the content, and the count-card row of the Narrow widths table. Those lines carry notes too.

### Tokens and the opt-in

`apps/caterer/app/_layout.tsx:181` wraps the app in `LayoutScaleProvider value="v2" target={48}`, between `ThemeProvider` and `MoodProvider`, the level the customer root uses.

- `target` (`packages/mobile-ui/src/layoutScale.tsx`) is optional and defaults to 44, so the customer app, which passes none, is unchanged. It has its own context, read through `useTouchTarget()`; `useLayoutScale()` still returns only the scale's name.
- Under `v2` a `Chip` and each `Segmented` segment get `hitSlop` of `(target - 34) / 2` above and below: 7 in Dapur, 5 in the customer app. A stacked `Segmented` (three or more options at large text) is a column of 48 rows and takes no slop. The `Stepper` buttons get `(target - 44) / 2` on every side: 2 in Dapur, none in the customer app.
- `MoodHeader`'s v2 top row is `max(44, target)`: 48 in Dapur, 44 in the customer app. The `band` row stays 36 and holds only the compact toggle.
- `CheckRow` and `StopRow` switch to the Dapur geometry when `useTouchTarget()` is at least 48, not when the scale is `v2`, so a customer row under `v2` keeps its current shape.
- Android delivers a touch only inside every ancestor's bounds, so a `hitSlop` or a negative margin that reaches past a parent's edge is dead area. Every 48 target lies inside its parents: chip rows sit in frames at least 48 tall, header actions use `flush` (the label or glyph is held against the target's end) instead of a negative margin, and a section header that carries an action is 48 tall.

`nativeLayout` (`packages/design-tokens/src/index.ts`) gains these keys. Existing keys keep their values.

| Key | Value | Use |
| --- | --- | --- |
| `row.compact` | 64 | the two-line row (`TwoLineRow`, compact `MediaRow`) |
| `row.check` | 56 | the Daftar masak check row |
| `thumb.compact` | 48 | the dish thumb in a Menu row |
| `dense.sectionGap` | 24 | between Dapur sections (the customer `sectionGap` stays 32) |
| `figure.lead` / `figure.leadLine` | 32 / 40 | the `figure` variant |

Dapur sections are 24 apart, a heading is 12 above its content, and the parts of a group are 8 apart.

`Text variant="figure"`: 32 / 40, weight 800 through `fontFor`, tabular figures, charcoal, not a header for screen readers. It is the lead number on Hari ini and Uang and nowhere else. Sibling figures are `section` at 800, tabular.

Dapur tests mount a screen under the scale with `withDapurScale(ui)` (`apps/caterer/tests/dapur-scale.tsx`) or the `render` in `apps/caterer/tests/render-dapur.tsx`. `apps/caterer/tests/layout-dapur.test.tsx`, formerly `layout-classic.test.tsx`, pins the opt-in values and keeps one case for the classic geometry a component has with no provider.

### Shared blocks

The customer layout blocks moved to `packages/mobile-ui/src/layout/` and are exported from `@catera/mobile-ui`: `SectionHeader`, `ListCard` with its insets, `MediaRow`, `GlyphRow`, `GlyphCircle`, `Thumb`, `DecorativeIcon`, `rowLabel`, `metrics`, and `HeroPhotoFrame` with `heroPhotoInset`. Each old file under `apps/customer/src/layout/`, and `apps/customer/src/today/HeroPhoto.tsx`, is now a one-line re-export of the package, so no customer import changed (a ruling, taken to avoid conflicts with the customer session that was merging into `v2` at the same time). Git records the package files as added; `git log -B -M` pairs them with their old paths.

New blocks:

- `TwoLineRow`: 64 tall, gap 12, padding 8, a one-line `rowTitle` over a one-line `meta`, an optional leading node (a 28 order badge, a 40 glyph circle) and an optional trailing node in a fixed column as wide as its children (48 per button). It is a button only with `onPress`, and its label is `rowLabel(title, meta)` unless it is given one. `wrap="meta"` lets the meta grow and `wrap` lets the title grow too; the row then pads 12 above and below and top-aligns its leading node.
- `KeyValueRow`: 40 tall, growing when the label wraps. The label is `bodyL` in `muted` at the left; the value is `bodyStrong` with tabular figures at the right and never shrinks or truncates, so the values in one card end on one edge and "Rp 12.345.000" shows whole at large text. A screen reader hears the row as one line. `valueWraps` (default false) is for a text value such as a package name or a list of days: the value wraps within 60% of the row and still ends on the right edge, and the label keeps the width of its longest word within the other 40%. Money keeps the default.
- `FigureStrip`: one surface card, radius 16, padding 12 by 16, with equal cells split by 1px `line` hairlines. Each cell is a `meta` label over its value: `figure` for the first when `lead` is set, `section` at 800 with tabular figures for the rest, none of them a header. An optional `meta` subline sits 6 under the cells. Below effective width 340 (`width / fontScale`) the strip becomes a 2-column grid with the lead across both columns. In dark, where `cardBorder` is empty, it draws a 1px `line` edge and gives up one pixel of padding.

Additive props, each defaulting to the behaviour it had before:

| Block | Prop (default) | Effect |
| --- | --- | --- |
| `SectionHeader` | `count` (none) | a `meta` figure before the trailing slot ("9 menu", "14 alamat") |
| `SectionHeader` | `action` as a node | any node in the trailing slot; the header is then at least 48 tall with the title centred in it. A link object (`{ label, onPress }`) renders the old tree |
| `SectionHeader` | `reserveAction` (false) | keeps the 48 row while the action is absent, so nothing moves when it arrives |
| `ListCard` | `tone` (`"surface"`) | `"sage"` for a card on a sheet; in dark it adds a 1px `line` edge and pads 15 |
| `ListCard` | `clip` (true) | `false` drops `overflow: hidden`, for rows whose photo may finish loading late |
| `ListCard` | new export `COMPACT_MEDIA_INSET` | 60: the 48 thumb plus the 12 gap |
| `MediaRow` | `size` (`"media"`) | `"compact"`: 64 tall with a 48 thumb |
| `MediaRow` | `titleVariant` (`"rowTitle"`) | `"bodyStrong"` for a quieter title |
| `Thumb` | `size` (56), `icon` (`restaurant-outline`) | 48, 56 or 64; the glyph of the not-set tile |
| `GlyphCircle` | `tone` (`sage`) | the circle's fill |
| `HeroPhotoFrame` | `clip` (true) | `false` keeps the 1.5 inset with no clip and no corner radii; the image rounds itself |
| `MoodToggle` / `MoodHeader` | `size` / `toggleSize` (`"regular"`) | `"compact"`: a 34 track with 30 pills and a whole-dp width, whose tabs reach the target through `hitSlop`, so a 36 band row stays 36 |
| `RantangTrack` | `size` (`"regular"`) | `"compact"`: rail 40 (regular 64), ring 32, disc 24, glyph 14, the marker on the current stop, and no state-words line (the words stay in `accessibilityValue`) |
| `StopRow` | `portions`, `packageName`, `note` (none) | read only by the Dapur geometry |
| `HeaderIconButton` | `flush` (false) | holds the glyph against the button's end, so it reaches the margin while the whole target stays in its row |
| `CalendarPanel` / `CalendarSheet` | `inset` (off) | the seven cells share the sheet's inner width, 48 tall, inside its side padding; left out, the grid keeps its 8dp gutter |
| `Screen` / `ScreenFooter` | `footerLift` / `lift` (0) | raises the pinned footer |
| `AuthScreen` | `footer` (none) | a pinned footer that rises with the Android keyboard |

Dapur-only blocks in `apps/caterer/src`:

- `layout/PhotoThumb.tsx`: a 40, 48 or 56 photo tile, radius 8, whose image rounds its own corners over a `sage` (or `surface`) backing, with no clipping ancestor. Rows that use it sit in a `ListCard clip={false}`. On Android a photo that finishes loading inside an `overflow: hidden` rounded view stayed blank until the screen was reopened (audit-003 F1), which is why Dapur rows with late photos do not use the shared, clipping `Thumb`.
- `layout/useActionPairStacked.ts`: one rule for two 50 buttons that would share a row. Below effective width 400 they stack, one full-width line each; from 400 up they sit side by side. Used by the customer detail, Menu and the Menu skeleton. Antar's Maps and WhatsApp always stack.
- `today/rows.tsx`: `IconAction` (a 48 icon button with a forest glyph on no ground), `TextAction` (forest `bodyStrong`, at least 48 by 48), both with `flush`; `LinkRow` (48, forest, an optional `expanded` state); `ActionPair` (no negative margin); and the section constants the screen and its skeleton share.

### Hari ini

Top to bottom, before departure:

1. Header: `MoodHeader band` on the mood tint. A 36 meta row ("{kitchen} · Hari ini", "Besok" or "Sedang diantar") with the compact Siang / Malam toggle at its right, 4, the date as a `heroTitle` button with its chevron (at least 48 tall), 12, the figure strip (`FigureStrip lead`: porsi, paket, alamat, with "Antar HH.MM" as its subline when a window exists), 12, the compact track. No mascot in the header. With the demo strip, the header ends at 405.3dp on the gate (target 404, accepted).
2. Live slot, under the kept-copy caption and the read errors: the first to-do, in the existing order (the setup card, waiting reports, attention items), in one attention-tone card of 64 rows. When more wait, a 48 link "n hal lainnya" opens the rest in place, says whether it is open, and closes them again. Besok has none.
3. Masak: `SectionHeader` "Daftar masak" with "n menu" and Bagikan and Cetak as 48 icon buttons, 48 tall. A `ListCard clip={false}` of `CheckRow`s: 56 tall, a 48 quantity column (`section` 800, tabular, right-aligned, shrinking to fit so four digits never move the dish), the dish in `bodyStrong`, a 40 photo with its own radius 8 (or the meal glyph), the 48 check at the right, hairlines inset 112. Checked rows stay in place. The kitchen-truth lines and the owner's "Isi menu" sit directly under the list, then the note about ticks. Then "Per paket": `KeyValueRow`s with "n porsi".
4. Antar: `SectionHeader` "Urutan antar" with "n alamat" and "Pilih" (`TextAction flush="end"`). The header keeps its 48 whenever Pilih can appear that day, so it does not grow at the first departure. A `ListCard` of `StopRow`s, each 64: the 28 order badge, a one-line title "name · n porsi", a one-line `meta` "package · address" cut at the end, a delivery note as one more charcoal `meta` line when there is one, and the map and "…" buttons as bare 48 icon buttons in one 96 column on every row. A stop with no "…" keeps the room. The first three stops show, then a 48 "Lihat n alamat lainnya". Then Maps and "Bagikan rute ke WhatsApp" stacked as two full-width 50 secondary buttons (the WhatsApp label is about 190dp, more than half the width), and the route caption.
5. After departure the cooking part folds into one 48 row in its own card, "Sudah dimasak · n porsi", and Antar starts 48 + 24 below where Daftar masak began. The strip and the track stay.
6. Footer (`KitchenAction`): its caption slot keeps 36 in every state, and a note takes the caption's place in the stage it was made in, so the footer is one height from "Mulai masak" to "Berangkat antar · n porsi". `SelectionBar` keeps an 18 caption slot and still stacks its two buttons below effective width 340.
7. Pilih mode: each stop's status line is one line. Rows measured 94 at 412dp and font scale 1.0, and 107 at 360dp and 1.3 with the name cut.
8. Fold, before departure with a live slot, at 412x916 with the demo strip: 1.77 check rows above the footer (target 2, accepted because the 48 section header the touch floor needs costs the rest; 1.3 rows showed before this pass). Without a live slot the target is 4.
9. Skeletons (`TodayCountSkeleton`, `TodaySkeleton`) read the same constants: the strip block holds the subline's room (106 for a windowed day), the track block the compact rail, then a heading, four 56 rows and two 40 "Per paket" rows, 24 apart.
10. Kept: DoneCard ("Semua beres"), the empty-meal and nothing-to-cook cards, Besok (no reports, actions or Pilih), staff (no setup card and no "Isi menu"; waiting reports may show in their live slot, as before), the offline banner and hidden footer, and the marker's stage animation.

### Pelanggan

- Header `plain`: one 48 row (the v2 top row under the 48 target) with "Pelanggan" in `heroTitle` and a trailing "+ Pelanggan lama" (glyph and label, a 48 target that keeps its tap haptic). The empty 48 row is gone.
- Filter chips in a 48 frame that scrolls sideways and runs to the screen's right edge; chips are 34 with `hitSlop` 7, never wrap, and their counts stay hidden until the data loads.
- One `ListCard` of 64 `TwoLineRow`s: the name in `rowTitle`; one `meta` line "package · sisa n hari · +n paket lain · area" (the area is cut first; a package ending today or tomorrow keeps its end wording); a trailing 48 chat button. The row opens the detail.
- Detail: the name as the native title; a `meta` status line; per package a `ListCard` of `KeyValueRow`s (Paket and Porsi wrap as text values; Mulai, Selesai, Sisa); WhatsApp and the renew action side by side from effective width 400 and stacked below it, a lone action across the full row; the renew hint and `FormError` under them; the address in a 56 well (radius 12, `well`); then per package a `SectionHeader` with "Jadwal" over a `ListCard` of 48 schedule rows, the first five, then "Lihat semua n" opening the rest in place. Sections are 24 apart.
- Skeletons use the opt-in `shape="customer"` of `ListSkeleton` and `DetailSkeleton` (64 rows and 34 chips in the 48 frame; five 40 rows, the 50 actions and the 56 well). Every other screen keeps the default shapes.

### Menu

- Header: `MoodHeader` (the 48 top row, the staff's gear at its right), then one 44 row with two 44 chevrons (`hitSlop` 2, a 48 target) around the week range in `heroTitle`. For a package that serves both meals, the compact Siang / Malam toggle sits in a frame at least 48 tall, at a whole-dp width so it never lands on a half pixel.
- Day strip: one row for any package. Tiles are `(width - 4 x (n - 1)) / n` wide for n delivery days, at least 56 tall, radius 12, a `meta` weekday over the date in `bodyStrong`, and a 6 dot for the existing state. Seven days come to about 51 each at 412dp and about 44 at 360dp.
- Package chips in a 48 frame that scrolls sideways (chips 34, `hitSlop` 7). "Salin minggu lalu" and "Bagikan menu" are two 50 secondary buttons that stack below effective width 400 (staff: "Bagikan menu" alone, full width). Captions and disabled reasons as before.
- The day: `SectionHeader` with the date and, for the owner, "Ubah menu" in its trailing slot; the owner's day header is 48 on every day, editable or not. Per group a `meta` label over a `ListCard clip={false}` (inset 60) of 64 compact `MediaRow`s: the dish in `bodyStrong`, wrapping rather than cut; a 48 `PhotoThumb`, or for the owner on a day that can still change the dashed camera tile that is the "Tambah foto" action (a 48 target, showing the spinner while a photo uploads, with "Mengunggah…" as the row's meta). Staff and closed days show the inert not-set tile with the utensils glyph.
- "Tampilan di aplikasi pelanggan" stays last, its cover 160 wide.
- Day editor (`menu/[date]`): a `SectionHeader` per group with its count over a `ListCard` of 48 rows; inputs and suggestions at 48; "Simpan menu" pinned in the `Screen` footer for the owner only, disabled until every group is filled. Staff read it with no footer.
- Skeletons: the strip at radius 12, the controls as a 34 chip in a 48 frame with two 50 blocks at radius 25, the day as a heading line over three 64 rows with 48 thumbs.

### Usaha, Uang, Tim and Paket

- Usaha: a `plain` header with the kitchen name in `heroTitle` ("Usaha" until it is known) and the 48 gear (`HeaderIconButton flush`). The payments attention card comes first when it applies, its title in `section`. Then "Paket": `SectionHeader` with "+ Paket baru" in its trailing slot once the read has answered, 48 tall while it loads too, over a `ListCard clip={false}` of 72 `MediaRow`s (a 56 `PhotoThumb`, the name wrapping, `meta` "Rp 25.000 / makan · tayang"), each with its trailing 48 "…". Then "Kelola": one `ListCard` of five 48 `GlyphRow`s with muted glyphs: Uang, Impor pelanggan, Tim, Pembayaran (its status at the right) and Pengaturan, whose one-row card is gone. Blocks are 24 apart.
- Usaha fold, accepted: with the payments card and 2 packages the screen runs about 26dp past the fold, with 3 packages about 86dp.
- Uang: a lead block on the canvas (a `meta` label, the payout in `figure`, a `meta` caption), 24, a `ListCard` of seven 40 `KeyValueRow`s with the amounts on one right edge, and the explanations that sat under each amount as `meta` paragraphs under the list (a 40 row has no room for them). No row changes height when an amount changes. `UangSkeleton` is built from the same numbers.
- Tim and Hapus akun take their side padding from `sheetSidePadding()`. Tim's code box is a `sage` `Card` (radius 16).
- Package detail: the photo at 16:10 in `HeroPhotoFrame clip={false}` (`PackagePhoto`, the image rounding itself at 16; the fixed 168 is gone); the description in `bodyL`; price, delivery days and capacity as `KeyValueRow`s, the text values wrapping; delivery days as a range when three or more run together ("Senin–Jumat", `weekdayLabel`); portion and nutrition as `meta` lines; the copy action as a 50 secondary button. Its skeleton is `DetailSkeleton shape="package"`.
- Package editor: sections "Foto", "Isi satu porsi", "Gizi per porsi (opsional)", "Harga", "Hari antar" and "Kuota", 24 apart under `section` headers; the steppers in one `ListCard`; delivery-day chips in 48 frames in a wrapping row, so the visible chip rows are 14 apart and their 7 slops never overlap; price and capacity keep digits only; "Terbitkan paket" pinned as before.

### Sheets

Sheet bodies keep `sheetSidePadding` (20 iOS, 24 Android) in both apps. Every Dapur action sheet pins its primary in `SheetFooter`.

- Atur antaran (`ExceptionSheet`, `atur-antaran/[id]`): the two options, "Gagal diantar" and "Pindah tanggal", as wrapping `TwoLineRow`s of at least 64 with a 40 `GlyphCircle` on the surface, in one `ListCard tone="sage"`; the reason field when it applies; the primary and a failed save's `FormError` pinned. Its skeleton is sized from an invisible copy of the loaded options, so the sheet does not grow when they arrive.
- Pindah tanggal (`MoveSheet`): the calendar with `inset`, so the grid sits inside the sheet padding at 412 and 360dp; the footer pinned as before; the skeleton built from the calendar's own constants (pager 48, weekdays 16, six 48 weeks, caption 20, then the reason field).
- Foto bukti (`ProofSheet`, `sampai`): one `ListCard tone="sage" clip={false}` of 72 rows, each a 56 `PhotoThumb` on a surface backing (an empty tile shows the camera glyph), the stop, a one-line `meta` with the state word in bold charcoal, and a 48 text action ("Ambil foto" or "Ganti foto"). Below effective width 400 the action goes under the stop name, as before. "Sampai ({n})", its reason line (which keeps 18) and the `FormError` are pinned.
- Balas laporan (`balas/[id]`) and the Laporan page: the report as a `ListCard` (sage in the sheet, surface on the page) with the status pill, the subject in `rowTitle`, the text in `bodyL` and a "Dikirim" `KeyValueRow`; earlier replies in a second card; the reply `Field` (at least 88); WhatsApp as a 48 row in the body. "Tandai selesai" (outlined) and "Balas" sit side by side in the pinned footer, the sheet's or the page's, and stack below effective width 320 with Balas first. A resolved report has no field and no footer.
- Confirm and action sheets, Bahasa, Tampilan and Hapus akun keep their structure and take their margin and controls from v2.

### Impor, auth, settings, Data akun, Aktifkan

- Impor paste step: the field takes `Field` geometry (radius 12, padding 16, at least 160, 15 / 22); the intro is `bodyL` and the privacy note `meta`; attachments are unchanged (76 thumbnails, radius 12).
- Impor review: one `ListCard` of 64 `TwoLineRow`s, one per imported customer: the name ("Tanpa nama" when empty) and `meta` "phone · n porsi · area" (the portions only when not 1, ahead of the area so a narrow line cuts the area first). A row with a problem shows its reason as the meta line instead (a ruling, against spec 3.7 and the board: the reason is the to-do) and a pale `cream` pill "Perlu dicek" (28 tall, radius 14) before a forest "Ubah". The whole row is one button, "Ubah {name}", with ", perlu dicek: {reason}" for a problem row. No rows, no card.
- Impor row editor: field-shaped skeleton; package chips wrap with a 14 row gap so their targets meet without overlapping; a portion count other than 1 shows as a `meta` line under the fields; "Selesai" pinned as before.
- Masuk: field groups 16 apart; the Android keyboard padding follows the v2 `AuthScreen`. Daftar runs on `AuthScreen` with a pinned footer, so on Android "Kirim kode" rises above the keyboard; the intro is `bodyL`, "Lokasi dapur" a 13 bold label, and the area chips wrap with a 14 row gap.
- Pengaturan needed no change: the shared shell under v2, including the grouped settings cards and the Segmented stacking from the customer deep-pages pass (accepted for Dapur by ruling).
- Data akun: one card per concern with `section` titles and `meta` notes, 24 apart with the Hapus akun row. Aktifkan: `section` step titles, steps 24 apart, the bank form 12, and its loading list 24 apart like the loaded steps (`ListSkeleton gap`).

### Evidence

- Jest, Dapur (`apps/caterer/tests`): `layout-dapur`, `layout-blocks-dapur`, `kitchen-loop`, `today`, `selection-mode`, `empty-states`, `skeletons`, `customers`, `menu`, `feedback`, `business`, `nutrition`, `dapur-sheets`, `report`, `import`, `data-akun`, `settings`, `masuk-layout`, `daftar-keyboard` and `onboarding`. Customer: `ui-foundation` ("v2 without target keeps hitSlop 5") and the unchanged `layout-blocks`. Root Vitest: `tests/native-font-weights.test.ts`, `tests/native-theme-guard.test.ts`, `tests/copy-scan.test.ts`.
- Checks at `4069ad17`: typecheck clean, root Vitest 1052 of 1052, Dapur Jest 858 of 858, customer Jest 1923 of 1924 (the one failure is the recorded baseline `customer-sheets` "moving a day toasts the new date", whose dates come from the real clock). `npm run build` passed at `44feb2a1`; the later commits touch no web code. At the start (`86c85876`) the counts were Vitest 1050, Dapur 621 and customer 1804 of 1805.
- Emulator, Pixel 8 API 36 (1080x2400, 412x916dp), Expo Go, Dapur Metro on :8082, a demo backend on :3005 over a synthetic weekend copy of the demo data; captures, uiautomator XML and contact sheets under `output/native-review/layout-2026-10-24/`. `before/` holds 67 captures of the old layout (fold at 809.9dp, status inset 50.3, demo strip 24). Gate 1 (`3a6ebe35`) was blocked: the emulator's framework restarted every 4 to 5 minutes under host memory pressure, and gate A replaced it. Gate A (`36adda1a`), every screen and sheet: 17 PASS, 12 FAIL, 7 NOT REACHED; the blocker was :3005 rejecting "Mulai masak" (a demo-bootstrap bug, see the handoff). Its failures went into the fix wave. Gate B (`44feb2a1`): of gate A's failures 6 passed, the header bottom missed by 1.3dp (accepted) and the 64 pitch of a stop with no note was not reached (the data had none). It reached the cooking loop: one footer height through "Berangkat antar", the Masak summary row with Antar 48 + 24 below it, Pilih with 0 and 2 stops and its bar, the Foto bukti thumbnail showing right after the camera returned and a dish photo showing at once (the audit-003 F1 check), and sheet cards visible in dark. It found four new failures (the Pilih target 41.9 wide, "Ubah menu" 37.3 tall, proof rows 75, the Pilih status wrapping), which the residual round fixed. Gate C (`4069ad17`): 15 PASS and 1 FAIL. Pilih 48x48, Selesai 64.8x48, Pilih semua 93.3x48, "Ubah menu" 94.5x48, "+ Pelanggan lama" 148.2x48 and the Usaha gear 48x48, by bounds and by taps just inside the target's edges; the four action headers 48 with 12 to their content; Foto bukti rows about 72 with one meta line; the Pilih status on one line. The failure is the fold of 1.77 check rows, accepted.
- A final whole-branch review on `36adda1a` found five Important issues (two clipped photos, text values crushing their labels, a duplicated list card, three stacking rules); the fix wave fixed them.

### Not verified

- Anything on iOS (no Mac), including the `flush` header actions and the compact toggle under the iOS bar.
- The production build without the demo strip. Every fold above was measured on the demo build, with its 24dp strip.
- On a device: a stop row with no delivery note (64, Jest only), the Impor review with rows (its reader calls a paid API, so no gate pressed it), and the skeleton frames of most screens (gate B caught a few). Known first-frame gaps: the Hari ini skeleton has no demo strip and no live-slot block, so a demo build drops 24dp when the day loads, and the Atur antaran primary is drawn about 100dp high on the sheet's first frame.
- The customer app on a device. Its rendering is held by the customer Jest suite only. The shared `Thumb` and `ListCard` still clip with `overflow: hidden`, and the customer app shows photos through them (package detail, the plans row), so the late-photo blank (audit-003 F1) may apply there.
- Live TalkBack and VoiceOver. Labels are tested in Jest only.
- Colour is out of scope here, and it has drifted: Colour revision (Phase G) lists the light `canvas` as `#E4DED1`, but `nativeThemes.light` has drawn a white page with white cards, told apart by `cardBorder` and `cardShadow`, since October 23 (`packages/design-tokens/src/index.ts:117`). The canvas boards follow the DESIGN.md palette. This pass records the drift and does not resolve it.

This is not a device or release approval.

## Native Phase G, October 2026

Owner feedback of October 12, 2026 (FB1 to FB11) and the owner's picks of October 13, built as Phase G ([spec](docs/superpowers/specs/2026-10-13-native-phase-g-design.md), [plan](docs/superpowers/plans/2026-10-13-native-phase-g.md)) from `456d5bd4` to `92ca26b5`, and gated on the Android emulator in Expo Go and a debugOptimized build with the demo backend (gates g7-g1a to g-c-14, captures under `output/native-review/phase-g/gates/`). Decisions, reviews and attempt counts are in the ledger, `.superpowers/sdd/2026-10-12-native-phase-g/progress.md`. This section is the contract for motion, loading, errors, the tracker, the calendar, delivery confirmation, Data akun, addresses, form sheets and copy in both native apps; the colour contract is the section above. Dials are unchanged: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 2.

### What Phase G supersedes

- **Colour.** The mood table, the dark `forest` inversion, every Sunrise accent outside the tracker's current stop, and the mood-driven status bar (see Colour revision (Phase G), October 2026).
- **Durations.** The motion numbers in Native motion, Mood motion, Web motion, Native polish (Phase F) and MASCOT-MOTION.md that name a token now run at the token's new value (see Motion).
- **The three-stop rantang track** of Phase C and its 320ms slide. The track has four stops (see Tracker).
- **"Tercatat sampai"** and its Phase C reachability note. The words are "Ditandai sampai otomatis", and auto-confirm makes them reachable on the same day.
- **"Arrival is recorded automatically"** in Dapur (rulings C7 and the line under the order). The kitchen marks Sampai with a photo and the customer confirms; the system closes the meal only after two hours, or the next morning.
- **Phase F sheets:** every form with a field now opens above the tabs, and its primary action is pinned (see Form sheets). "Kirim laporan" and the other main buttons no longer scroll with the form.
- **Phase F "Not built. Address delete."** It is built (see Address delete and move).
- **Phase F Pengaturan:** "Syarat dan privasi" opens a page instead of reading "Segera hadir".
- **Phase F Loading:** the SMS code check uses a busy button, not the mascot (see Loading).
- **Phase F toast vocabulary** gains "Baris dihapus" with "Urungkan" (deleting an Impor row, 5 seconds, announced; G1a), "Alamat dihapus", "{n} pengantaran ditandai sampai" and the error toast with "Coba lagi".
- **Mood motion's "The setting is read when the app starts".** Reduced motion is read live.
- **Dapur order and stage:** "When the session's stage changes the body fades in". A stage change and the mood switch now change Hari ini in place (see Swaps, mascot stills and the macro grid).
- **Copy** quoted in earlier sections, listed under Strings this file quotes that changed.

### Motion: "Even slower"

Owner pick of October 13, 2026 (the owner found the animations too fast and asked for a calmer pace, then picked the third column of `output/native-review/phase-g/motion/relaxed-motion.md`), built in `98af208e`. The durations and the ease change on native and web together; the spring is native only.

| Token | Was | Now |
| --- | --- | --- |
| `control` | 120ms | 200ms |
| `selection` | 180ms | 340ms |
| `content` | 220ms | 440ms |
| `feature` | 320ms | 680ms |
| `ease` | `cubic-bezier(.16, 1, .3, 1)` | `cubic-bezier(.33, 1, .68, 1)` |
| `spring` | damping 18, stiffness 260 (ratio 0.56) | damping 22, stiffness 120 (ratio 1.0, no overshoot) |

Sources: `nativeMotion` (`packages/design-tokens/src/index.ts:45-52`) and `webMotion` (`apps/web/src/lib/motion.ts:2-9`; its web-only `exit` ease `cubic-bezier(.4,0,1,1)` stays). `tests/native-motion-tokens.test.ts` keeps the two equal, pins the values, checks the durations rise and checks the spring is critically damped within 0.02. Every rule above that names a duration by its token (for example "over 220ms (`content`)") now runs at the new value of that token; the token is the contract, the old number is history. The older shared `motion` export (180ms on the old ease, `index.ts:40-43`) still feeds the web `--ease` variable and is not part of this change.

- **Press.** `PressableScale` springs to 0.97 and back on `nativeMotion.spring` (`packages/mobile-ui/src/motion/PressableScale.tsx:52, 57`). The scale starts on press-down, so the response is immediate; only the settle is slower (about 0.4s). The reduced-motion dim to 0.85 runs over `control`.
- **Heart.** `HEART_BURST_MS` is `nativeMotion.feature`, 680ms (`SaveHeart.tsx:23`; it was 380). The heart rises to 1.22 over `control` and springs back on the new spring. Saved and outline hearts are both forest (rule 3); the burst dots alternate `forest` and `forestDeep`.
- **Tracker.** The stage change animates over `feature` (680ms) on the new ease (see Tracker).
- **Toast.** Enters over `content` (440ms) with a 12dp travel and leaves over `control` (200ms) (`Toast.tsx:211-215`).
- **Fixed numbers that do not follow the pace.** The sheet title focus fallback is `SHEET_FOCUS_FALLBACK_MS` 400 and its second try `SHEET_FOCUS_SETTLE_MS` 250 (`packages/mobile-ui/src/sheets.ts:26-27`), so the pace can never delay TalkBack focus. The skeleton pulse (two 700ms halves), the mascot loop (2400ms) and reveal (300ms), the busy-button delay (150ms) and the success beat's own timings stay as they were (see [MASCOT-MOTION.md](docs/MASCOT-MOTION.md)).
- **LaunchCover** still runs on `feature`, so the cold-start hand-off is now 680ms (`LaunchCover.tsx:83-84`). It never blocks input. The spec asked the gate to judge whether it feels slower than the splash: gate g-c-12 PASS (about 570-680ms visible after the Expo Go splash), so the cover stays on `feature`.

Unchanged: no loops except the mascot and the skeleton pulse while something waits; the tracker moves only on a stage change; transform and opacity only; reduced motion is instant; Decision A (no motion on a first load, refresh, pull, search, filter, tab return or mood switch). **Reduced motion is now live:** `useReduced` reads a shared store fed by the system's reduce-motion change event, so turning the setting on or off applies at once, not after the next launch (GC-F2, `ae585c22`, `74c3c81d`). The Mood motion line "The setting is read when the app starts" is superseded.

### Loading: the busy button joins the inline tier

The Phase F loading tiers stand, with one change: a command that waits on the server shows a busy button, not the mascot (owner pick for FB1, October 13, 2026).

- **Busy button** (`Button busy`, `packages/mobile-ui/src/components.tsx:107-187`). The label is replaced by a small spinner in the label colour after `BUSY_DELAY_MS` 150ms, so a fast answer never flashes it; once shown it stays until the answer. The label stays in the layout at opacity 0, so the button keeps its width and height. It ignores presses and fires no haptic while busy, `accessibilityState.busy` is true and the label stays the accessible name. Reduced motion keeps the spinner, because it shows a wait, not decoration. `useBusy` (`useBusy.ts:8-34`) drops a second press while one is in flight. `StickyAction` passes its `busy` through to `Button`.
- **Where.** Every call site that awaits a command in both apps, including the SMS code check on Masuk, which now keeps the code on screen with a busy button instead of the "Memeriksa kode…" mascot screen. The mascot stays only for requests that run long: the import assistant reading files, Bayar's payment check and the claim link (and the launch gate).
- **The tier table** gains the busy button as an inline loader beside `StickyAction`, the Menu upload tile and pull to refresh. The no-spinner scans now allow an `ActivityIndicator` only inside `components.tsx` and `settings/SettingsRows.tsx` in `mobile-ui` (customer, `apps/customer/tests/no-spinner.test.tsx:16, 54-55`), and in Dapur only the Menu upload tile's `photo-spinner` (`apps/caterer/tests/no-spinner.test.tsx:29-55`).

### Errors

Errors are never loose small text (FB8). Four owners, and a scan that fails on anything else.

- **`ConnectionBanner`** (`packages/mobile-ui/src/ConnectionBanner.tsx`). Shows only when NetInfo reports the phone offline (`isConnected` or `isInternetReachable` false), and nothing until NetInfo first answers, so an online phone never reads it. At the top of the content under the header: a `cloud-offline-outline` icon in `danger`, the title "Tidak ada koneksi" ("No connection") in bold `danger`, and, when a copy is on screen, "Menampilkan data terakhir, {HH.MM}" ("Showing data from {HH.MM}"), then a "Coba lagi" text button. A `surface` card with a 1dp `line` edge and radius 12. A polite live region; iOS announces it once per offline spell. Back online, it calls its retry once by itself. Placed on Beranda, the plan detail and Dapur Hari ini (`Beranda.tsx:464`, `PlanDetail.tsx:192`, `TodayScreen.tsx:488-491`). It replaces the loose "Terakhir diperbarui HH.MM · tidak ada koneksi" caption and Dapur's "tidak ada sinyal" line.
- **`StaleCopy`** (customer only, `apps/customer/src/staleCopy.tsx:32-46`). When the phone is online but the read failed and a kept copy is on screen: a `FormError` with "Belum bisa memperbarui. Menampilkan data terakhir, {HH.MM}." ("Couldn't refresh. Showing data from {HH.MM}.") and a busy "Coba lagi". Beranda and the plan detail (`Beranda.tsx:467`, `PlanDetail.tsx:193`). Before this, an online failure fell back to the kept copy in silence.
- **`FormError`** (`packages/mobile-ui/src/FormError.tsx`). A callout at the form's action: an `alert-circle` icon and selectable text in `danger` on a `surface` card with a `line` edge, with an optional "Coba lagi". A polite live region on Android, `announceForAccessibility` on iOS; a repeated failure is re-read through `failureKey`. In a form sheet it sits in the pinned footer and is scrolled into view when the footer is inline (see Form sheets).
- **`ReadError`** moved from Dapur into `packages/mobile-ui/src/ReadError.tsx` (Dapur keeps a re-export). A failed read in `danger` with "Coba lagi"; `art` adds the `bingung` mascot above it where the failure replaces the page. Both apps use it wherever nothing is cached.
- **Non-form action failures** are an error toast with "Coba lagi": "Belum bisa menandai berangkat. Coba lagi." and "Belum bisa menandai Dimasak. Coba lagi." on Dapur Hari ini and the selection bar (`TodayScreen.tsx:203-215`, `SelectionBar.tsx:62-68`), and the customer's "Sudah sampai" (`Plate.tsx:303-319`, message from the error code, falling back to "Belum tersimpan. Coba lagi."). Marking Sampai is the exception: its failure is a `FormError` in the proof-photo sheet, "Belum bisa menandai sampai. Coba lagi." (`ProofSheet.tsx:226-228`), because the sheet stays open with the photos.
- **The scan.** `tests/native-theme-guard.test.ts:170-234` fails on any `danger` or warning text outside its owners: `FormError`, `Field`'s error, `ReadError`, `ConnectionBanner`, the Keluar row and `RantangTrack`'s "Gagal diantar". `LEGACY_BARE_ERRORS` is empty.
- The generic "Belum berhasil. Coba lagi." now says what failed in most places; `tests/copy-scan.test.ts` allows it at most twice.

### Tracker

`RantangTrack` (`packages/mobile-ui/src/RantangTrack.tsx`) has four stops (FB9, FB10; `bb4fc11a`): Terjadwal, Dimasak, Diantar and Sampai ("Scheduled", "Cooking", "On the way", "Arrived"), at 0, a third, two thirds and the end. It supersedes the three-stop track of Phase C (kitchen, road, door).

- **Glyphs.** One code-drawn glyph per stop in the stroke style of `brand/Rantang.tsx`: a calendar, a pot, a motorbike and a house (`:38`). No icon library. The lunchbox marker still rides the line above them.
- **Colour.** Reached stops fill with the hero ink, the current stop is larger (1.14) with a 2.5 ring in `stopActive`, the only Sunrise on the screen, and later stops are outlined in `heroMeta`. The line is ink and fills to the current stop.
- **Marked as arrived, waiting for the customer.** The last stop is half filled and the caption reads "Ditandai sampai, menunggu konfirmasimu" ("Marked as arrived, waiting for you to confirm"); the kitchen's caption reads "Ditandai sampai, menunggu konfirmasi pelanggan" (`packages/domain/src/journey.ts:65-93`).
- **Gagal diantar.** A warning stop with a 2.5 `heroWarn` ring and an alert glyph, a dashed last segment in `heroWarn`, and the words "Gagal diantar" in `heroWarn` (`:202-219, 254-272, 459-478`). Never a silent fallback to a normal stop.
- **Motion.** On a stage change the marker slides, the line fill grows as a `scaleX` from its left edge and the stop disc scales, over `feature` (680ms) on the Catera ease. Nothing moves on first paint, refresh, pull or tab return, nothing loops, and everything is instant under reduced motion (`:162-178`).
- **Screen readers** hear one sentence, "Pesanan: {tahap}, langkah {n} dari 4" ("Order: {stage}, step {n} of 4"), with the caption as its value; the stops are decorative (`:196-214`).
- **Dapur** uses the same component in the Hari ini header (compact since the Dapur layout pass), with counts under each stop. After a first round of departures the line fills to the furthest stage reached.
- **Captions.** The journey caption table of Phase C stands, with "Ditandai sampai otomatis" ("Marked as arrived automatically") for a meal the system closed, replacing "Tercatat sampai", and the two waiting captions above. `statusLabel` reads "Sampai", "Ditandai sampai" and "Gagal diantar" ("Arrived", "Marked as arrived", "Not delivered"; `packages/domain/src/index.ts:539-584`).

### Calendar sheet

`CalendarSheet` and its body `CalendarPanel` (`packages/mobile-ui/src/CalendarSheet.tsx`; FB6, `4af785bd`) replace the customer's date chips in Ubah hari and Dapur's free-text "Tanggal baru (TTTT-BB-HH)" field in Pindah tanggal. Both open at the large detent in the root stack. The buy flow's start-date chips stay chips.

- **Grid.** A Monday-first month of six weeks with "Bulan sebelumnya" and "Bulan berikutnya", clamped to the allowed window (the arrows dim to 0.35 at the ends). Tabular figures. The current delivery day has a 1.5 forest outline; the chosen day a 2 forest ring with a `line` fill and a bold forest number (rule 3: a mark, not a block). An unavailable day is muted and struck through; tapping it reads its reason in a polite caption, "{tanggal}: {alasan}": "Penuh", "Terisi", "Dapur libur" or "Lewat batas waktu" ("Full", "Booked", "Kitchen closed", "Past the cutoff"), mapped from the server codes `CAPACITY`, `DUPLICATE_DATE`/`OVERLAP`, `INVALID_DATE` and `CUTOFF`.
- **Action.** The pinned footer button reads "Pindah ke {Senin 12 Okt}" ("Move to ..."), or "Pindah tanggal" until a new day is chosen, and is busy while the move runs. A failure is a `FormError`, "Belum bisa pindah tanggal. Coba lagi.".
- **Two voices.** The `staff` prop switches the lines to the kitchen's point of view (GC-F2, `f9f98f66`, `74c3c81d`):

| Moment | Customer | Dapur (`staff`) |
| --- | --- | --- |
| Prompt | "Pilih hari baru untuk pengantaranmu." ("Choose a new day for your delivery.") | "Pilih hari baru untuk pengantaran pelanggan." ("Choose a new day for the customer's delivery.") |
| No open day | "Belum ada hari lain yang bisa kamu pilih di rentang ini." | "Belum ada hari lain yang bisa dipilih di rentang ini." ("No other day is open in this range.") |
| Tapping the current day | "Ini hari pengantaranmu sekarang." | "Ini hari pengantaran pelanggan sekarang." ("This is the customer's delivery day now.") |

- **Dapur extras.** The consequence line "Pelanggan yang memakai aplikasi diberi tahu." ("Customers who use the app get notified."), which replaces the untrue "Pelanggan diberi tahu", and an "Alasan" field (`apps/caterer/src/today/MoveSheet.tsx:141-160`). Dapur reads availability through `deliveryAvailability`, which serves staff. The stop sheet hands over to the calendar only after its own native dismissal (`handoff.ts`, `9927b67c`; gate g-c-6 PASS on the race).

### Delivery confirmation: arrived, proof photo, auto-confirm

The kitchen marks a stop Sampai with a proof photo and the customer confirms (FB3 and FB11; `abc9a6f3`, `a4cff03a`; migrations `20261014090000_delivery_arrive.sql` and `20261014091000_delivery_depart_subset.sql`).

- **Data.** No new status. A fulfilment gains `arrived_at`, `arrived_by` and `arrived_photo`, and a meal marked Sampai stays `out_for_delivery` until it is confirmed. A trigger clears the three when the meal goes back to out for delivery or is marked "Gagal diantar". `delivery.arrive {catererId, date, meal, fulfillmentIds, photos}` is staff-only, Jakarta today only, one photo per stop, idempotent, in one transaction with row locks, and queues the customer push "Pesananmu sudah diantar. Sudah diterima?". The older status commands can no longer set `delivered` directly (`NOT_ALLOWED`). The web workspace's delivered button marks Sampai and waits for the customer too.
- **Dapur selection** ("Urutan antar"). "Pilih" turns on circles per stop with "Pilih semua" and "Lepas semua" per area, and a bottom bar with "Berangkat ({n})" and "Sampai ({n})" ("Head out ({n})", "Arrived ({n})"); "Selesai" leaves selection. Stops already past an action cannot be chosen for it. Once some stops have left, the sticky footer reads "Berangkat semua sisa · {n} porsi". Repeated departures are the rounds; there are no named rounds (D4). `delivery.depart` takes the same optional subset and still pushes each customer once.
- **Proof photo sheet** (`apps/caterer/src/today/ProofSheet.tsx`, large detent). Titled "Foto bukti sampai" with "Foto tiap alamat, urutan bebas. Pelanggan melihatnya saat diminta konfirmasi.". One tile per selected stop in a vertical list (the spec's grid became a list so a long name keeps whole words): a 64dp thumbnail, the stop, its state ("Belum ada foto", "Foto siap", "Foto belum terkirim") and a camera button "Ambil foto" or "Ganti foto". Photos are shrunk before upload, in any order. "Sampai ({n})" stays disabled with the reason "Ambil foto untuk {n} alamat lagi." until every stop has a photo, and is busy while sending. A failed upload keeps the other photos. Success toasts "{n} pengantaran ditandai sampai". **Dapur layout scale (October 2026):** each stop is a 72 row with a 56 thumbnail that rounds its own corners (no clipping ancestor), a one-line meta with the state, and "Ambil foto" or "Ganti foto" as a 48 text action; "Sampai ({n})" and its reason are pinned in the sheet footer.
- **Storage.** A private bucket, `catera-v1-proof`, at `{catererId}/{dayId}/{meal}/{uuid}.{ext}`; only that stop's customer and that caterer's staff can read a photo (`v1.can_read_proof`). Upload through `POST /api/uploads/proof`, read through `GET /api/proof`, which redirects to a five-minute signed URL. Demo mode keeps the bytes on disk and serves a flat synthetic image when a file is missing. Release steps: [RUNBOOK](docs/RUNBOOK.md), section 15.
- **Customer hero.** For a meal marked Sampai and not yet confirmed (`PlateState` `arrived_unconfirmed`), the hero says "Dapur menandai pesananmu sudah sampai" with "Sudah diterima?" under it, the kitchen's photo (96dp, radius 12, labelled "Foto dari dapur saat pesanan sampai") beside "Sudah sampai" (primary, busy while it sends) and "Belum", which opens the "Belum sampai" report (`Plate.tsx:96-100, 284-301, 382-388, 493-536`). Gate g-c-6 PASS.
- **Auto-confirm.** `v1.auto_confirm_arrived` closes a meal marked Sampai two or more hours earlier with `confirmed_by = 'auto'`, unless the customer reported a problem after the arrival or any report is still open. The next-morning `v1.auto_deliver` backstop stays. Both run from `/api/jobs`, which the repository schedules once a day at 09.00 Jakarta (`vercel.json`), so the two hours hold only once the hosted scheduler runs it more often (RUNBOOK section 15). `confirmed_by = 'caterer'` stays unused.
- **"Ditandai sampai otomatis".** A meal the system closed reads "Ditandai sampai otomatis" ("Marked as arrived automatically") on the plate and the track, replacing "Tercatat sampai" (owner pick against the recommendation). The Phase C reachability note changes with it: production now closes meals on the same day through auto-confirm, so the wording is reachable on Beranda once the scheduler runs.
- **Dapur copy.** Under the order: "Tandai Sampai dengan foto bukti. Pelanggan lalu mengonfirmasi, dan tanpa laporan pengantaran ditandai sampai otomatis." (`DeliveryOrder.tsx:218-221`). Semua beres reads "Semua pengantaran sudah ditandai sampai." or "{d} ditandai sampai, {f} ditandai Gagal diantar." (`TodayScreen.tsx:318-320`).
- **Pushes at the event.** Every delivery stage pushes the customer right after the command (Dimasak, Berangkat, Sampai waiting for confirmation, Gagal diantar, and a Pindah tanggal by the kitchen), queued by triggers and deduplicated per customer, caterer, date, meal, stage and trip (`20261014110000_push_events.sql:1-9`), with a scheduled backstop. Caterer pushes are titled "Catera Dapur", customer pushes "Catera" (`apps/web/src/lib/push-dispatch.ts:14-15`). Device delivery is NOT VERIFIED until a development build has FCM V1 and APNs credentials.

### Data akun

A "Data akun" page in both apps (FB5; `a8692d88`, `797d7088`, `c916745b`, `f59710ba`), with inline editors rather than one sheet per field.

- **Entry.** Customer: the first row of Akun and an "Akun" section in Pengaturan (signed in only). Dapur: Pengaturan.
- **Rows.** Nama (`profile.update`, own row only, in a transaction); Nomor HP (a code to the new number, then the change; real SMS needs the production SMS credentials and is NOT VERIFIED, demo simulates it); Email (a confirmation link); Kata sandi (only for an email account, with reauthentication); Hapus akun in the danger tone, reading "Permintaan sudah terkirim" while a request is open. Demo mode says so on the page: "Demo (data contoh): nomor HP, email, dan kata sandi hanya disimulasikan.".
- **Hapus akun, customer** (a root form sheet, `apps/customer/src/account/HapusAkun.tsx`). "Permintaan ini dikirim ke tim Catera. Akunmu belum dihapus sampai tim memeriksanya." With a running plan the request still goes through (owner pick): the sheet names the plans ("Kamu masih punya paket yang berjalan: {nama}.") and says "Paket yang masih berjalan diselesaikan dulu oleh tim Catera. Kami hubungi kamu soal sisa harinya sebelum akun dihapus." It promises no timing. Sent: "Permintaan hapus akun terkirim" and "Akunmu belum dihapus. Tim Catera memeriksa permintaan ini lebih dulu."
- **Dapur.** The same rows, plus "Ubah nama atau kontak dapur" for owners only: a request to Catera with its status, "Tim Catera yang mengubahnya. Tulis apa yang perlu diganti." (D5). Dapur's Hapus akun is a fit sheet: "Tim Catera memproses permintaan ini. Pelanggan dan pengantaran yang masih berjalan diselesaikan dulu bersama tim. Kami hubungi kamu soal sisanya sebelum akun dihapus."
- Pengaturan itself moved into `packages/mobile-ui` (`37e6636f`), and its "Syarat dan privasi" row opens the web page `/syarat-dan-privasi`, a labelled placeholder (G15); Dapur opens it with `Linking.openURL`.

### Address delete and move

Built in G13 (`345bf940`, `62e30279`, `abb339e7`; migration `20261014120000_address_delete_replace.sql`), Opus-built because it changes tenant-authorized state. It supersedes "Not built. Address delete." under Phase F.

- **In use** means a delivery day dated today or later, not delivered or cancelled, that carries the address, or a pending checkout with it. `address.delete` refuses such an address with `ADDRESS_IN_USE`; an unused address is soft-deleted (`archived_at`) after one confirm, "Hapus alamat ini?", and the toast "Alamat dihapus".
- **In use, move first.** The sheet "Alamat masih dipakai" says "Alamat ini masih dipakai untuk {n} pengantaran, {13 Okt} sampai {31 Okt}." (`packages/domain/src/address-use.ts:43-57`) and offers "Pindahkan ke alamat lain", then "Pindahkan ke alamat mana?" (or "Tambah alamat baru"). `address.replace` moves the scheduled days before the cutoff whose kitchen covers the new area, keeping the per-caterer lock, the live `COVERAGE` check and the one-day cutoff; the days that stay are counted with their reason and date. The old address is archived once nothing uses it. The result reads "{n} pengantaran dipindahkan" with "Lihat jadwal". A failure toasts "Alamat belum terhapus." with "Coba lagi". A pending payment blocks it: "Alamat ini masih dipakai untuk pembayaran yang belum selesai. Coba lagi setelah dibayar atau kedaluwarsa."
- **An archived address is never used again.** Checkout, quote, address save, the delivery address change and Dapur's import refuse it, and the reads leave it out. Editing an address stays as it was.
- **Dapur shows the live address, never an archived one** (GC-F7, `2b24b99f`; migration `20261020100000_customer_live_address.sql`). Dapur's customer record keeps a copy of the first plan's address. When that copy names an address the customer has since archived, the `seller-customers` read answers the address of the record's next delivery day still to come, else nothing. It never reads the customer's wider address book, so staff see only addresses the customer gave that kitchen. Pelanggan detail hides the "Alamat antar" card when there is no address. In the customer app, Beli drops a picked address that was removed and falls back to the renewal address, then the first address; Ubah hari does the same. Gate g-c-6 PASS ("Kantor" shown after the move).

### Form sheets

How a form sheet behaves, built across G1b to GC-F14 and gated on the Android emulator (gates g1b-2, g-c-2 to g-c-11; captures under `output/native-review/phase-g/gates/`). Owner decision of October 20, 2026: "pin the primary action in a form-sheet footer". Product rules first, then the mechanism. Everything lives in `packages/mobile-ui/src/SheetHeader.tsx` ("SH" below), which holds `SheetHeader`, `SheetBody`, `SheetFooter`, `SheetFitBody` and the measuring hooks.

**What the person sees**

- **Forms with fields open above the tabs.** Ada masalah, Ubah hari, the review form, Alamat (both copies), Bantuan (both copies) and Hapus akun in the customer app, and Impor's row editor and Pindah tanggal in Dapur, are root-stack form sheets (`apps/customer/src/nav.ts:84-86`; the `/pembelian/*` copies at `apps/customer/app/_layout.tsx:115-116`; `apps/caterer/app/_layout.tsx:102, 107`). TalkBack lands on the sheet title, never on the demo strip or the backdrop (gates g1b-2 and g-c-4). Choice, action and confirm sheets, the Dapur reply (`balas`) and the stop sheet (`atur-antaran`) stay in the tab stack. This supersedes the Phase F rule that every sheet lives in its own tab.
- **The primary action is pinned.** A root-stack form sheet keeps its main button in a footer under the scrolling content, above the gesture bar, at every detent and font size. It never scrolls away and the bar never covers it (owner decision, October 20, 2026; built in `74d2fc13`, gate g-c-5 PASS at font scale 1.0 and 1.3, light and dark, 360dp).

| Sheet | Pinned footer |
| --- | --- |
| Ada masalah (`/masalah/{id}`) | "Kirim laporan"; no footer once the day already has a report |
| Review (`/ulasan/{id}`) | "Kirim ulasan" with the text button "Nanti saja" |
| Alamat (`/alamat-form`, `/pembelian/alamat-form`) | "Simpan alamat" |
| Bantuan (`/bantuan-form`, `/pembelian/bantuan-form`) | "Kirim permintaan" (none without a plan), or "Kirim ke Catera" when escalating |
| Hapus akun (customer) | "Kirim permintaan hapus akun" with "Batal"; "Selesai" once sent |
| Ubah hari | "Pindah ke {tanggal}" (date mode) or "Antar ke {label}" ("Pilih alamat" before a choice) |
| Dapur Pindah tanggal | "Pindah ke {tanggal}", "Pindah tanggal" until a day is chosen |
| Dapur Impor row editor | "Selesai" |

- **What stays in the content.** A destructive or secondary action scrolls with the form: "Hapus baris ini" in the Impor row editor (`apps/caterer/src/import/RowEditor.tsx:128, 183-201`). A secondary text button that belongs to the decision ("Nanti saja", "Batal") sits in the footer beside the primary one. Tab-stack sheets now pin their actions in the footer too (Dapur layout scale, October 2026): "Tandai gagal diantar" in the stop sheet, "Balas" and "Tandai selesai" side by side in the reply sheet. The Dapur Hapus akun is a fit sheet (`SheetFitBody`) with no pinned footer.
- **The footer rides the keyboard.** With the keyboard up the footer sits at the keyboard's top, so the focused field and the action are both visible (g-c-8 PASS: the Impor footer at the keyboard top, no over-lift).
- **When there is no room, the footer goes inline.** If the sheet stays at the 0.6 detent under the keyboard and the body would be shorter than 120dp, the footer moves to the end of the scroll content until the keyboard goes, then pins again. This happens only in Expo Go: the real build (debugOptimized, `react-native-screens` from `node_modules`) expands the sheet to the large detent at any font scale (gate g-c-8). The inline footer is a safety net, accepted by controller decision on GC-F8.
- **An error is never hidden.** When a `FormError` or a busy state appears in an inline footer, the sheet scrolls so the footer is in view (gates g-c-9 and g-c-10 PASS, including an Enter-submit error). A keyboard flip on its own never scrolls the sheet, so the first focus keeps the field in view.
- **Tab-stack sheets end at the tab bar in every state.** Opening, dragging to the large detent, the keyboard rising and hiding, a tab switch and back, and backgrounding and resuming all leave the sheet's bottom on the tab bar's top, with no band and no overlap (gate g-c-11 ALL PASS at font scale 1.0, 1.3 and 3-button navigation).

**Mechanism**

- **The footer slot.** `SheetBody` takes a `footer` prop, or a `SheetFooter` anywhere inside it hands its children up through context (SH:489-504; it renders in place outside a `SheetBody`). SH:461-483: a frame view holds the scroll view, then the footer as a sibling after it, so the footer is outside the scroll content and after it in reading order. The footer has a hairline top border on `surface`, 12 top padding and the bottom inset plus 16 when nothing else covers the gesture bar (SH:426-457). On iOS the scroll view adjusts its own keyboard inset only when there is no footer; with one, the footer lifts by the keyboard height (SH:423, 469).
- **The frame carries the lift.** The frame's bottom margin is `bar + lift + iosLift` (SH:461), where `lift = below + keyboardLift` (SH:421): `below` is how far the sheet hangs past the window's bottom edge, and `keyboardLift` is `max(0, keyboard + insets.bottom - tabBar)` on Android (SH:381). The two add because the keyboard covers the window's bottom, not the sheet's (GC-F6).
- **One coordinate space.** `WindowEdge` (`packages/mobile-ui/src/windowEdge.tsx`) is an invisible full-window view mounted inside the `SafeAreaProvider` of both apps (`apps/customer/app/_layout.tsx:196`, `apps/caterer/app/_layout.tsx:177`). `measureWindowEdge` gives its bottom from `measureInWindow`, the same space the sheet frame is measured in. The window height from `useSafeAreaFrame` is only a fallback (SH:178, 210-214). The earlier reference mixed spaces and came out one status bar short (gate g-c-4 logs: edge 864 against window 914.29 minus a 50.29 status bar).
- **Settled readings.** The hook remembers the last trusted reading for keyboard up and keyboard down, and ignores timer readings while the detent is moving (`sheetDetentChange` with `stable` false, a 1000ms stuck guard), so a first focus during the detent change does not over-lift (SH:158-169, 212, 283-291). Re-measures run 50ms after a keyboard change (and 450ms for tab sheets), on a window size change and on `transitionEnd`.
- **Inline mode.** `short` is true when the keyboard is up, the reading is trusted and `frame - (below + keyboard) < footerHeight + 120` (SH:308, `SHEET_MIN_BODY` 120 at SH:328). The footer then renders inside the scroll view (SH:425, 481). `footerKey` (SH:312-325) fingerprints the footer's element types, `message` props and text, and only a change of that key, not a keyboard change, arms the scroll to the footer (SH:387-400, 437-440). Known limit: an identical error shown twice does not change the key, so it does not scroll again.
- **Tab-stack fit, measured, not computed.** The tab bar height is `80 + max(0, ceil(16 × (fontScale − 1)))` plus the bottom inset (`toastAnchor.ts:31, 40-42`; SH:100-106), and `barFit` measures how much of it the sheet must clear in every state (SH:227-231). With the keyboard up the frame is measured ending about 104dp (the bar plus its inset) higher than the bar-only model predicts, so `keyboardLift` subtracts the tab bar. That is an empirical fit from g-c-8; why the keyboard-up frame ends higher is unexplained (comment at SH:374-380). Re-measures run at 50, 450 and 1200ms after a tab returns, only once the sheet has settled and after a blur (so the opening focus never measures mid-slide); a reading with no height recovers up to three times; and the app's return to the foreground re-measures tab sheets (SH:184-185, 197-207, 260-281).
- **TalkBack.** The title gets focus on the sheet's present (`transitionEnd`) and again 250ms later, with a 400ms fallback when no present is reported (`useSheetTitleFocus`, SH:28-55; `sheets.ts:26-27`). On Android the sheet backdrop is not important for accessibility, through `patches/react-native-screens+4.26.2.patch` on `DimmingView.kt` (owner decision of October 17; root `patch-package` 8.0.1 with a `postinstall`). A tap outside still closes the sheet.
- **Detents.** Forms open at `[0.6, 1]`; Ubah hari, Dapur Pindah tanggal and the Dapur proof-photo sheet (`sampai`) at the large detent only (`packages/mobile-ui/src/nativeHeader.ts:70-72`).
- **Held context line.** With `holdContextLine` the context is one line with the full text as its spoken label, and not selectable, because a selectable Android text view does not ellipsize (SH:600-603).

### Narrow widths

`useStackedLayout(threshold)` and `isNarrow` (`packages/mobile-ui/src/stackedLayout.ts:4-14`) stack a row's parts when the effective width, `width / fontScale`, is below a threshold. Effective width catches 360dp at font scale 1.15 as well as a small phone at 1.0.

| Where | Threshold | What stacks |
| --- | --- | --- |
| Dapur proof-photo tiles (`ProofSheet.tsx:87`) | 400 | The photo action goes under the stop name, so a long name never breaks mid-word |
| Dapur selection bar (`SelectionBar.tsx:81`) | 340 | "Berangkat (n)" and "Sampai (n)" stack |
| Dapur figure strip (`FigureStrip.tsx`, the count card until the Dapur layout pass) | 340 | A 2-column grid with the lead figure across both columns |
| Dapur pairs of 50 buttons (`useActionPairStacked`: customer detail, Menu) | 400 | The two buttons stack, one full-width line each |
| Dapur reply actions (`ReportScreen.tsx:201`) | 320 | "Balas" and "Tandai selesai" stack, Balas first |
| Beranda "Perlu kamu urus" (`WaitingList.tsx:102`) | 340 | The action word goes under the row's text |

Gates g-c-4 and g-c-9 PASS at 360dp with font scale 1.0, 1.15 and 1.3, and 393dp at 1.15. The Jadwal photo cell keeps its own rule (`fontScale < 1.3` shows the photo).

### Swaps, mascot stills and the macro grid

Built in GC-F15 and GC-F16 (`0343fd1b`, `1123f9cf`, `cf3eb3a9`, `1b366313`) after gate g-c-12, with the Hari ini key from GC-F17 kept by GC-F18 (`92ca26b5`). Gated in g-c-13 and g-c-14.

- **`FadeSwap` fades in the mount transaction.** It renders an `Animated.View` keyed on `swapKey` with an `entering` `FadeIn` over `content` on the Catera ease (`packages/mobile-ui/src/motion/FadeSwap.tsx:8, 50`). The fresh content mounts already hidden in the same UI-thread transaction, so it never shows at full opacity before the fade. The first key does not fade, because nothing fades in on a screen's own first paint, and reduced motion gets no animation. Both are decided once per key, in the render where the key first appears (`:37-43`). Before this, the opacity was a shared value written from JS that landed after the commit, so new content showed at full opacity for a frame or more and then dropped (gate g-c-12, PackageDetail).
- **A key change remounts the content.** State that must outlive a swap lives above the `FadeSwap` (see Phase F, Loading, "One block in"). The key names what the content is: the day, loading or ready. It never names a session stage or the mood, because those are the same content answering a tap. Bayar keeps its stage key (Phase D), because each payment stage is a different body.
- **Dapur Hari ini.** The day's key is `` `${loading ? "loading" : "day"}-${date}` `` (`apps/caterer/src/today/TodayScreen.tsx:501`). Mulai masak, Berangkat antar, Semua beres and the Siang/Malam switch change the parts in place, and only a new day or the first read fades. Above the swap, kept per date and meal: the checklist ticks (`useTicks`, `:368`), the order's expanded list and next WhatsApp part (`useRouteView`, `:371`, `DeliveryOrder.tsx:31-41`) and the "Pilih" selection (`:386`). The `ConnectionBanner` sits above the swap (`:494-497`), so changing the day neither blanks nor re-announces it (GC-F16; gates g-c-13 and g-c-14 PASS). Because the list state is keyed by meal, a Malam and back round trip collapses the expanded list.
- **The Siang/Malam switch is unchanged.** One `MoodProvider` context carries the mood (`packages/mobile-ui/src/mood.tsx:32-67`). GC-F17 tried an urgent intent beside a deferred mood so the arc could move on the press. On the release build the arc moved sooner but the page swap got slower (gate g-c-14, production JS 0.54-1.21s against 0.22-0.35s), so GC-F18 reverted it (owner decision, October 22, 2026).
- **Mascot stills on expo-image.** `MascotArt` draws through expo-image with `contentFit="fill"` (`packages/mobile-ui/src/brand/MascotArt.tsx:97-104`). The style carries the crop's own aspect, so fill does not distort the pose (gate g-c-12: under 1px). The first mascot to mount loads all seven stills through `Image.loadAsync` and keeps the refs for the session (`:25-46`); until a pose's ref is ready, its `require` is the source. The refs hold about 10.1 MiB of decoded bitmaps for the session, a known cost accepted in review. A mount draws at once. The 200ms (`control`) dissolve plays only when a mounted mascot changes pose, and that change is instant under reduced motion (`:87-101`). Gate g-c-13: the first Desember `tidur` still appears after its month, 35ms on the dev build and 61-555ms in Expo Go, down from 450ms. No reachable screen changes a mounted pose, so the dissolve is covered only by `apps/customer/tests/mascot-art.test.tsx`. [MASCOT-MOTION.md](docs/MASCOT-MOTION.md) has the same row.
- **Macro grid.** `NutritionCard` takes `min(window, 760) - 74` as its width until the grid's first layout (`apps/customer/src/discover/NutritionCard.tsx:63-65, 85`), so it no longer draws four tiles for a frame before settling at two by two (see Phase F, Macros).

### Copy glossary

Indonesian first, English through `t(id, en)`, no em dashes, no slang ("gak", "aja", "banget", "dong"), full verbs (spec section 6; G18, `a8ca0695`, `d2a98101`, `bb044f66`, with GC-F9 and GC-F13). `tests/copy-scan.test.ts` fails on every retired word below in both apps and the push bodies.

| Topic | Use | Retired |
| --- | --- | --- |
| Register, both apps | "kamu", or no pronoun where the sentence works without it ("pengantaranmu", "Akunmu") | "Anda" |
| A delivery (noun) | "pengantaran" ("3 pengantaran", "tidak ada pengantaran.") | "antaran" as a noun; "pengiriman" is never used. The verb stays: "Berangkat antar", "Urutan antar", "Antar HH.MM" |
| The business | "katering" | "katerer" in anything a customer sees |
| Second Dapur role | "staf dapur" ("kitchen staff"); the stored value is unchanged | "Pembantu", visible "helper" |
| Beranda section | "Perlu kamu urus" ("Needs you") | "Menunggu Anda", "Menunggu kamu", "Waiting on you" |
| Dapur move | "Pindah tanggal" ("Move date"), spoken labels too | "Pindah hari", "Move the day" |
| Phone | "HP" | "ponsel" |
| Dapur package button | "Terbitkan paket" ("Publish package") | "Simpan paket" |
| Meal closed by the system | "Ditandai sampai otomatis" ("Marked as arrived automatically") | "Tercatat sampai", "Recorded as arrived" |
| Failed delivery | "Gagal diantar" ("Not delivered") everywhere, including Jadwal and the plate; the hero says "Pesananmu gagal diantar" so the header and the track never repeat each other | "Tidak bisa diantar", "Couldn't be delivered" |
| Demo label | "Demo (data contoh)" ("Demo (sample data)") | "Demo · data sintetis", "synthetic data" |
| Jelajah search | "Cari menu atau katering…" | the invented "Bu Rini" |
| Push title, caterer | "Catera Dapur"; customer pushes stay "Catera" | |
| Formal words | direct verbs | "Silakan", "terlebih dahulu", "tidak dapat", "Please" |
| Dapur English actions | "Head out" for Berangkat and "Arrived" for Sampai ("Head out now?", "Head out ({n})", "Arrived ({n})") | "Mark Sampai", "Mark Berangkat", "Leave…", "Leave to deliver" |
| English counts | `plural(count, singular, plural?)` (`packages/mobile-core/src/plural.ts:5`) in every English count with a number: "1 address", "2 addresses", "1 portion" | "1 addresses" and other unpluralised counts; the scan's plural check is at `tests/copy-scan.test.ts:161-183` |
| Review time (Aktifkan) | "Tim Catera biasanya memeriksa dalam 1 sampai 2 hari kerja." | kept by the owner against the recommendation; a timing the system cannot back (R-17) |
| Renewal start | "Mulai {Selasa 13 Okt}, tepat setelah paket sekarang" only when the start really is the next delivery day; "Mulai {tanggal}. Paket ini masih berjalan sampai {tanggal}." when the same package pushes it; "Mulai {tanggal}. Paketmu {nama} masih berjalan sampai {tanggal}." when another package at the same caterer does; plain "Mulai {tanggal}" for a plan already finished (`apps/customer/src/buy/Breakdown.tsx:145-168`) | the unconditional "tepat setelah paket sekarang" |

### Strings this file quotes that changed in Phase G

Where an earlier section quotes the left column, the right column is what the apps say now. The earlier sections are kept as the record of their phase.

| Earlier wording | Now | Where |
| --- | --- | --- |
| "Menunggu Anda" | "Perlu kamu urus" ("Needs you") | `apps/customer/src/today/WaitingList.tsx:214` |
| "Paket penuh" (trial row action) | "Beli paket" | `WaitingList.tsx:183` |
| "{n} antaran." / "tidak ada antaran." (Beranda headline) and "{n} antaran" (arc detail, Berikutnya day label) | "{n} pengantaran." / "tidak ada pengantaran." and "{n} pengantaran" | `Beranda.tsx:210-224, 251`, `UpcomingDays.tsx:33` |
| "Tercatat sampai" / "Recorded as arrived" | "Ditandai sampai otomatis" / "Marked as arrived automatically" | `packages/domain/src/journey.ts:90`, `Plate.tsx:105` |
| "{jendela} · belum ada catatan dari dapur" / "Belum ada catatan dari dapur" | "{jendela} · belum ada kabar dari dapur" / "Belum ada kabar dari dapur" | `Plate.tsx:158-159` |
| "Sudah lewat batas ubah" (Menu besok row and story, Dapur Menu closed day) | "Sudah tidak bisa diubah"; "Masih bisa diubah" when the day can change but no time is known | `TomorrowRow.tsx:20-26`, `TomorrowStory.tsx:217-222`, `MenuWeek.tsx:599` |
| "Menu belum diisi oleh {katerer}" | "{katering} belum mengisi menunya" | `TomorrowStory.tsx:215` |
| "Belum ada antaran besok." | "Belum ada pengantaran besok." | `TomorrowStory.tsx:144` |
| "Tidak ada antaran mendatang." | "Belum ada pengantaran berikutnya." | `PlanDetail.tsx:301` |
| "Terakhir diperbarui HH.MM · tidak ada koneksi" | `ConnectionBanner` offline, `StaleCopy` online (see Errors) | |
| "Jadwal antar Anda sudah tersimpan." | "Jadwal antar sudah kami simpan." | `PaidOutcome.tsx:92` |
| "Centang hanya catatan dapur, tidak dikirim ke pelanggan." | "Centang ini cuma catatan dapur. Pelanggan tidak melihatnya." | `CookingList.tsx:37` |
| "Pelanggan melihat status Dimasak." | "Pelanggan akan melihat status Dimasak." | `TodayScreen.tsx:232` |
| "Laporkan masalah atau pindah hari: {name}" / "Pindah hari: {name}" | "Laporkan masalah atau pindah tanggal: {name}" / "Pindah tanggal: {name}" ("Report a problem or move the date", "Move date") | `DeliveryOrder.tsx:89-96` |
| "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya." | "Tandai Sampai dengan foto bukti. Pelanggan lalu mengonfirmasi, dan tanpa laporan pengantaran ditandai sampai otomatis." | `DeliveryOrder.tsx:218-221` |
| "Semua antaran tercatat sampai." / "{d} tercatat sampai, {f} ditandai Gagal diantar." | "Semua pengantaran sudah ditandai sampai." / "{d} ditandai sampai, {f} ditandai Gagal diantar." | `TodayScreen.tsx:318-320` |
| "{n} antaran makan {siang\|malam} ditandai Gagal diantar." | "{n} pengantaran makan {siang\|malam} ditandai Gagal diantar." | `TodayScreen.tsx:542-546` |
| "Simpan laporan" (stop sheet) | "Tandai gagal diantar" | `ExceptionSheet.tsx:233` |
| "Tinggalkan perubahan?" (Pilih menu) | "Buang pilihan menu?" with "Pilihan yang belum disimpan akan hilang." | `ChooseMenu.tsx:115-117` |
| "Yang sudah Anda tulis akan hilang." | "Yang sudah kamu tulis akan hilang." in both apps | `packages/mobile-ui/src/sheets.ts:296-306` |
| "Menyiapkan Catera untuk Anda…" | "Menyiapkan Catera…" ("Getting Catera ready…"); Dapur "Menyiapkan dapur kamu…" | `apps/customer/app/_layout.tsx:72, 166`, `apps/caterer/app/_layout.tsx:75, 147` |
| "Memeriksa kode…" (mascot) | a busy button on the code screen | see Loading |
| "Izinkan notifikasi di Pengaturan ponsel" | "Izinkan notifikasi di Pengaturan HP" | `packages/mobile-ui/src/settings/Pengaturan.tsx:40` |
| "Segera hadir" (Syarat dan privasi) | opens `/syarat-dan-privasi` | `Pengaturan.tsx:120` |
| "Demo · data sintetis" | "Demo (data contoh)" | both `app/_layout.tsx` (customer `:80`, Dapur `:84`) |
| "Pelanggan diberi tahu" (Dapur move) | "Pelanggan yang memakai aplikasi diberi tahu." | `MoveSheet.tsx:147`, `ExceptionSheet.tsx:222` |
| "Belum berhasil. Coba lagi." (generic) | a line that names what failed, for example "Belum bisa menandai berangkat. Coba lagi." | see Errors |

### Owner decisions, October 13 to 22, 2026

- **October 13.** Palette K; motion "Even slower"; native sheets kept with the TalkBack focus fixed; no confirm on deleting an Impor row, an "Urungkan" toast instead; a busy button for the code check; proof photos per stop with the action waiting for every photo; Hapus akun with a running plan goes through and the Catera team settles the plan; the copy table (with "pengantaran", "Ditandai sampai otomatis" and "1 sampai 2 hari kerja" kept against the recommendation); a paid "tambah porsi" top-up parked for Phase H.
- **October 17.** The tab-stack action sheet's backdrop is kept out of TalkBack with a `patch-package` patch on `react-native-screens` 4.26.2, and `patch-package` is approved as a new dependency.
- **October 20.** Pin the primary action in a form-sheet footer.
- **October 21.** One more focused round (the Siang/Malam switch and the Mulai masak blink), then wrap up Phase G.
- **October 22.** Revert the Siang/Malam intent part of GC-F17; keep Hari ini's stage changes in place.
- **Controller rulings** (each stated where it applies): forms with fields move to the root stack (the spec 4.1 fallback, after gate g1b); the inline footer is accepted as the Expo Go safety net; "Perpanjang" stays charcoal; the Beranda waiting row stacks only below 340 effective width; the proof sheet's list instead of a grid.

### Evidence and limits

Covered by Jest, Vitest and typecheck at `92ca26b5` (`npm test` 1043, customer Jest 1462, Dapur Jest 616, typecheck with 0 errors), `npm run build` and `npm run test:postgres` with the new scenarios (arrive against confirm, arrive against a report, double arrive, auto-confirm against a late report, overlapping departures, address delete against checkout, address replace against cook), including `tests/native-contrast.test.ts`, `tests/native-theme-guard.test.ts`, `tests/native-motion-tokens.test.ts`, `tests/copy-scan.test.ts` and `tests/app-config.test.ts`. On the Android emulator (API 36, Expo Go, demo backend; light and dark, 360dp at font scale 1.0 and 1.3) the gates passed the tracker, the calendar, selection and proof photos with camera and upload, the arrived-unconfirmed hero, the banner, `ReadError`, `FormError`, Data akun, address delete and move, the form sheets in every state listed above (g-c-11 ALL PASS), live reduced motion, and TalkBack on the sheet titles and the action sheet backdrop (the backdrop on a debugOptimized build). Gates g-c-12 to g-c-14 added the mascot crop and size, the Sparkle colour, the Malam mood in dark, reduced motion, flight mode, the LaunchCover and tracker pace, the macro grid's first frame, Hari ini's state across stages and the banner above its swap.

**Not verified on a device:** everything on iOS (no Mac); real push delivery (needs a development build with FCM V1 and APNs); real SMS for the phone change; the hosted scheduler and so the two-hour auto-confirm on the hosted project; the production proof photo path through `/api/proof`'s redirect; Coba lagi on a busy button; some English plurals (proof, import, review counts); the mascot's pose-change dissolve; Mulai masak on Hari ini since GC-F18. **Known limits:** the Siang/Malam switch takes 0.22-0.35s on production JS, because Beranda redraws and remounts its hero; PackageDetail starts its fade in the loading layout and then jumps to the bleed layout, and its footer pops in; Beranda's cold load and the Jadwal month change swap with no fade; the first Desember mascot still appears a beat after its month; an identical `FormError` shown twice does not scroll the inline footer again; after a failed submit, keyboard focus can land on an earlier chip; the inline footer remount loses TalkBack focus on the pinned and inline switch; the tab-stack sheet's keyboard fit is empirical. The hosted UAT backend lacks the Phase G migrations, so the UAT APKs cannot show these flows end to end (RUNBOOK section 15). This is not a device or release approval.

## Customer deep pages (October 2026)

The deep-pages phase fixed six bugs (B1 to B6) and built ten recommendations (R1 to R10) from the Mobbin comparison in [research/2026-10-24-customer-deep-pages.md](docs/superpowers/research/2026-10-24-customer-deep-pages.md), as ruled in the [spec](docs/superpowers/specs/2026-10-24-customer-deep-pages-design.md). Tasks T1 to T8 merged into v2 from `3d64e509` to `4931c5a7`; attempts and reviews are in `.superpowers/sdd/2026-10-24-deep-pages/progress.md`. The section Customer layout scale (October 2026) still holds; where a recommendation would reverse it, the spec took the smallest change and kept the approved layout. No schema or API changed. File references are under `apps/customer/src/` unless the path says otherwise.

Shared `packages/mobile-ui` changes are either additive (a new prop or variant) or gated on `useLayoutScale() === "v2"`, never on the customer app. Dapur keeps its classic look today, and `layout-classic.test.tsx` pins it. Once Dapur opts into v2, the v2-gated changes (Segmented stacking and the grouped settings cards) apply to Dapur too. The hidden push section on Pengaturan and the Button `danger` variant already apply to both apps.

### Hari actions

- The day sheet's actions keep the one-line circle row where it fits. Below an effective width of 380 (width divided by font scale: a 360 phone, or 412 at font 1.3) they stack as full-width rows instead of wrapping into two lines of circles. `schedule/DayActionRow.tsx:16-23, 40`.
- A stacked row: minimum height 48, vertical padding 8, a 24 charcoal icon, gap 12, the label in `body`. A hairline `line` divides the rows, inset 36 (icon plus gap) so it starts at the label. iOS adds a 20 muted chevron; Android draws none. `DayActionRow.tsx:87-93, 117-120`.
- The order (`dayVisibleActions`) and the test ids `day-action-<key>` are unchanged.
- The bottom inset is paid once, by `SheetBody` on the root route: `insets.bottom + 24` when the sheet has no footer. `packages/mobile-ui/src/SheetHeader.tsx:476`.
- Reason (B1, B2, R2): the second row of circles wrapped under the gesture bar on narrow screens and at large text.

### Jadwal agenda states

- "Belum sampai" shows only for today's meal whose window has opened. A past meal still at scheduled or cooking, with no open report, reads "Sudah sampai", the same as an explicit delivered. A meal with an open report reads "Laporan terkirim" on any day, and a failed one "Gagal diantar". The Hari sheet's state line uses the same rule from one helper, `schedule/mealState.ts` (`mealReported`, `mealSettled`), so the sheet and the agenda never disagree. `schedule/WeekAgenda.tsx:110-131`, `schedule/DayScreen.tsx:195-201`.
- Reason (B3): the server's `auto_deliver` treats silence as delivered, so a past day with no update was delivered.
- An unpicked pick-your-own meal, today or later and still before its change cutoff (`canChangeDay` allows a date or address change, the same rule as Beranda's `changeUntil`), gets a trailing "Pilih menu" text action: `bodyStrong` forest (marked `forest: action`), minimum height 44, `flexShrink: 0`, to `/pilih-menu/{subscriptionId}?date&meal`. `WeekAgenda.tsx:144-148, 160-177, 238`.

### Beranda day blocks and the hero deadline

- In `DayBlocks` (two or more deliveries on a day), unpicked deliveries no longer each get a dashed "Menu belum diisi" tile. They collapse into one row, `day-unpicked-row`: a 44 by 44 utensil tile on the `line` fill at radius 12, the text "{n} pengantaran belum ada menu" (one delivery: "Menu belum dipilih"), and a forest `bodyStrong` "Pilih menu" with a 44 target. Row minimum 48, gap 12. `today/DayBlocks.tsx:66-128, 212-235, 280-290`.
- "Pilih menu" appears only for pick-your-own menus (`UpcomingMeal.pickable`, `menuSelectionMode === "customer"`) while one of them is before its cutoff. A caterer-chosen menu that is not out yet gets `day-unannounced-row`, "Menu belum diumumkan" or "{n} menu belum diumumkan", with no action. `DayBlocks.tsx:73-76, 129-136`; `packages/domain/src/home.ts:33, 69`.
- Picked deliveries keep their photo tiles. `DayRow` (one delivery on a day) keeps its dashed thumb.
- The hero adds `plate-deadline`, "Bisa diubah sampai {hari, jam}" from `cutoff_at`, in `meta` with the hero's quiet ink and tabular figures. It shows only on a fresh read (not offline) while `canChangeDay` still allows a date or address change. `today/Plate.tsx:138-141, 350, 454-458`.

### Ulasan

- The review sheet starts with no stars. Kirim stays disabled with the `meta` hint "Pilih bintang dulu." until a rating is picked. `today/ReviewSheet.tsx:238-248`.
- Once the overall rating is picked, three rows appear: Rasa, Pengantaran and Harga. Each starts at the overall rating and follows it until changed, with 44 targets and 22 glyphs. Below an effective width of 340 the stars stack under the label. `ReviewSheet.tsx:34, 158, 199-215, 272-300`.
- `review.save` sends `food`, `delivery` and `value` separately (B5).

### Pilih menu

- Dish options are photo cards in a two-column grid, column gap 12 and row gap 16, two columns even at 360dp and font 1.3. `schedule/ChooseMenu.tsx:462-480, 573`.
- The cell: `flexBasis` 40%, grow 1, `maxWidth` 50%. The card: a 2dp ring (clear, or forest when selected), radius 16, padding 4. The photo is 4:3 at radius 12; with no photo, a `fill` tile with a `controlRing` restaurant glyph at 28. The check is a 24 forest circle with a cream checkmark, 8 in from the photo's top-right corner. The name is `bodyStrong` on up to two lines, the serving `meta`. Test ids `dish-cell-`, `dish-card-`, `dish-photo-`, `dish-fallback-`, `dish-check-{id}`. `schedule/DishCard.tsx:7, 37-60, 79-107`.
- After a passed cutoff the cards are disabled at opacity 0.45. The outer editor card is gone, so no card sits inside a card. The selected dish's photo per slot shows only in the review step.
- The deadline `menu-deadline` reads "Pilih sebelum {hari, jam}" for the earliest cutoff among the draft days. Under 24 hours (`SOON_MS`) it is a plain view on the `fill` ground with a 1px `attentionBorder` edge, a charcoal time icon and `bodyStrong` text (the shared `attention` Card is forest-filled in dark, which §0 rules out); otherwise a caption with a muted time icon. It hides once any cutoff has passed, and FormError takes over. `ChooseMenu.tsx:47, 284-299, 436-442`.
- The count `menu-count`, "{x} dari {n} hari sudah dipilih", sits under the month bar as a centered caption in tabular figures. It counts the month's saved days out of all its days. `ChooseMenu.tsx:367-369`.
- The footer is one pinned `StickyAction`: "Tinjau pilihan" while choosing, "Simpan menu" while reviewing, with the replace notice as its caption. `ChooseMenu.tsx:301-327`.

### Beli and Perpanjang footer and reasons

- The navigation title is "Beli" (Renew: "Perpanjang"). The package name appears once, in the summary card. `buy/BuyScreen.tsx:245, 322`.
- The pay button reads "Bayar {amount}" once a quote is ready, else "Bayar". The Total row reads "Menghitung…" while the first quote loads. `BuyScreen.tsx:284-287`.
- When the button is disabled, one `meta` line `buy-pay-reason` above the footer row says why, using the first reason that holds: a read or the quote still loading, "Menghitung total…"; no address, "Pilih alamat dulu." ("Tambahkan alamat dulu." with no saved address); no start date, "Pilih tanggal mulai dulu."; a pending checkout, "Ada pembayaran yang belum selesai."; then the quote error, then the blocked message as the last fallback. After a failed read the line is empty, since the page already shows its Retry. The reason is also the button's `accessibilityHint`. `BuyScreen.tsx:263-309`.
- The amount and the button share a row while both fit whole. The row stacks below an effective width of 340 (`FOOTER_STACK_BELOW`), or when `footerFits` estimates that the label and amount will not fit `min(width, 760)` minus both margins. `buy/metrics.ts:27-45`; `BuyScreen.tsx:59, 289-290`.
- "Bayar dengan" stays a section (spec 3.7). On Beli the method is a plain `ListCard` row `buy-pay-method`: minimum 56, no border, the method in `bodyStrong`, how to pay in `meta`, and a trailing "Ganti" text action that switches to the other method (a11y "Ganti ke {method}"). The Bayar page keeps its bordered card. `buy/BuyParts.tsx:80-125, 259-266`.
- Reason (R1): the button named no amount and gave no reason when it waited, and the method box read as an input.

### Paket "Isi paket" preview

- When the package's menus list dishes, "Isi paket" starts with a horizontal row `paket-dishes` of up to six dishes, each name once, in menu order. Each is a 96 square photo at radius 8 (or a 96 `surface` tile with the restaurant glyph) over its name in `meta` charcoal on up to two lines. The row runs edge to edge, above the per-meal rows. `discover/PackageDetail.tsx:138-187, 317, 405-409, 516-519`.
- Kept as approved: the three-cell stat strip and the pinned footer (see Owner rulings and deviations).

### Alamat and the address form

- Alamat drops the heading "Makanan diantar ke mana?"; the title already says it.
- Each address is one `PressableRow` (minimum 48) around its card, with a decorative 20 muted pencil at the end edge. A screen reader hears "{label}, {line}, {area}, {city}" with the hint "Ubah alamat". `account/Addresses.tsx:76-105`.
- The form's label is three chips under "Simpan sebagai": Rumah, Kantor, Lainnya. Lainnya shows the "Label alamat" field, and a custom label opens as Lainnya with its text. A chip alone does not trigger the unsaved-changes guard. `account/AddressForm.tsx:27-39, 273-296`.
- "Petunjuk pengantaran" has the hint "Contoh: pagar hitam, titip satpam". `AddressForm.tsx:319`.
- "Hapus alamat" is a danger-ink text button at the bottom of the edit form only. It runs `useAddressRemoval` with its confirm, and the form closes after a delete. The confirm's "Tambah alamat baru" replaces the edit form with a new one. Simpan and Hapus disable each other while either runs. `AddressForm.tsx:173, 267, 333`; `account/addressRemoval.ts:68`.

### The pick sheet

- The purchase's address sheet offers "Tambah alamat" (opens `/pembelian/alamat-form`) and "Kelola alamat" as secondary buttons. `ChoiceRoute` takes `extras: ChoiceExtra[]`. `choice.tsx:30-37, 55-87`; `buy/BuyScreen.tsx:187-190`.
- The two sit side by side at font scale 1 and each take the full width above it.

### Bantuan and Masalah

- In Bantuan-form the topic is radio rows under "Soal apa?", each with a one-line example: Pembatalan "Batalkan paket atau sisa harinya", Pembayaran "Sudah bayar, tapi paket belum aktif", Lainnya "Pertanyaan lain soal paket atau pengantaran". The rows run to the sheet's edges through `sheetSidePadding`. `help/HelpForm.tsx:29-46, 313-320`.
- The eight package chips became one Paket row, minimum 72: "Paket" over the package name. With several packages it opens inline radio rows under it, and a choice closes them; with one package it only names it. `?paket=` preselects. `HelpForm.tsx:170-245, 253-254`.
- Masalah opens with `delivery-card`: "{day} · {meal}" as a heading and the caterer in muted on up to two lines. The meal ("Makan yang mana?") and kind ("Apa yang terjadi?") choices are `ChoiceList` radio rows, not filled forest pills. `help/ReportProblem.tsx:260-300`.
- The empty Bantuan shows `StateArt` (tidur), "Belum ada laporan", the line "Kalau ada yang salah dengan pengantaran, laporkan dari harinya di Jadwal.", and "Minta bantuan" when the customer has a plan. `help/ReportList.tsx:155-175`.

### Shared Segmented stacking

- Under v2, with three or more options and `useStackedLayout(360)` true, `Segmented` renders as a column of full-width rows: minimum 48, padding 12 by 8, row radius 12 inside a track of radius 16. Labels wrap and never shrink. Two options stay a row, and classic is unchanged. Test id `segmented`. `packages/mobile-ui/src/components.tsx:263-305, 727-740`.
- No customer screen uses three or more options now. Reason (B4): three labels in a row squeezed until words split; the Bantuan topics became radio rows, and the guard covers any later use.

### Pengaturan and grouped settings cards

- Under v2, on both platforms, each settings section is one card: `fill` ground, the card edge (light only, via `cardEdge`), radius 16, rows and dividers inset 16, the section label 8 above the card. Each row shows its value at the trailing edge, on Android too ("Bahasa: Indonesia", "Tampilan: Ikuti sistem"). The iOS pressed tint is `line` under v2 and `sage` in classic. `packages/mobile-ui/src/settings/SettingsRows.tsx:17-32, 64-85, 266`.
- Data akun gets the same cards through `SettingsSection`. `SettingsSection` opens fragments before counting and dividing rows (`flattenRows`, keys prefixed per fragment), so rows grouped in a fragment get dividers like separate rows. `SettingsRows.tsx:36-59`.
- When push is unavailable (Expo Go), the Notifikasi section is not rendered, in both apps, and "Tidak tersedia di versi aplikasi ini" is gone (B6). `packages/mobile-ui/src/settings/Pengaturan.tsx:29`.

### Notifikasi

- The "Baru" label is gone. An unread update keeps its dot and a 700 body. `account/Notifications.tsx:140`.
- Updates group under "Hari ini", "Kemarin" and "Sebelumnya". The first two show the time only, Sebelumnya the date and time. `Notifications.tsx:91-93`.
- "Tandai semua dibaca" is an end-aligned text button above the groups. It sends `notification.read` for each unread item in order (`useBusy`), then reloads, and it hides when nothing is unread. A failed pass toasts "Belum semua ditandai dibaca. Coba lagi." and leaves the rest unread. `Notifications.tsx:76-87, 108-116`.

### Pembayaran status tags

- Each payment row carries a `StatusTag`: `fill` ground, radius 8, padding 8 by 2, caption at 600. The ink is forest for Lunas, danger for Kedaluwarsa and Gagal, and charcoal for Menunggu and Diproses. It wraps with the caption in `payment-status-line`, and the row's a11y label includes the status. `account/Row.tsx:13-25, 61-62, 88`.
- A paid plan's caption reads "Mulai {tanggal} · {katering}". The Menunggu caption no longer repeats "Menunggu pembayaran". A failed payment shows "Gagal". `account/Payments.tsx:95, 123, 147-148, 179-181`.

### Hapus akun

- With running plans, a callout `hapus-akun-plans` replaces the list of plan names: `well` card, radius 16, padding 16, gap 8, `bodyStrong` "{n} paket masih berjalan", then three bulleted lines: "Pengantaran yang belum lewat dibatalkan.", "Riwayat dan alamat dihapus.", and the existing sentence about the Catera team settling the plan, unchanged. No new number or timeframe. `account/HapusAkun.tsx:113-125`.
- The send button uses the `danger` variant. `HapusAkun.tsx:170`.

### Button danger variant

- `Button` takes `variant="danger"`: filled in `danger` with a cream label, and disabled like primary (muted label on the disabled fill). There is no `onDanger` token; ConfirmSheet already used cream on danger. The variant is additive, so both apps have it. `packages/mobile-ui/src/components.tsx:151-152, 170-172, 186, 201`.

### Masuk code input

- The SMS code is six slots over one hidden `TextInput`: digits only, `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`. Slot width is `min(48, (W - 32 - 40) / 6)` and minimum height 56 (it grows with text), with a 2px border at radius 9 on `inputFill` and 22/28 bold tabular digits. The current slot has the forest ring, an invalid code the danger edge, otherwise `fieldBorder`. `account/CodeInput.tsx:6-13, 80-110`.
- It submits on the sixth digit, and a ref lock stops a double submit. A wrong code clears the slots and keeps the danger edge until typing. The manual "Masuk" button stays. `account/Masuk.tsx:37-59, 134-160`.
- "Kirim ulang kode" waits 60 seconds as a muted, disabled "Kirim ulang dalam 0:42", then calls `sendPhoneOtp` again. It sits beside "Ganti nomor" under the slots and wraps. `CodeInput.tsx:125-160`.

### Cek emailmu and AuthCallback

- Register and Recover share one "Cek emailmu" view: the membaca `StateArt` left-aligned (120, or 96 at 360dp and font 1.3), the display title, an intro with the typed address in bold, the muted line "Buka tautannya di HP ini. Cek juga folder spam.", a primary "Buka aplikasi email" (`mailto:`, best effort), "Kirim ulang tautan" with the same 60-second countdown, and "Ubah email". After a resend it says "Terkirim lagi. Cek emailmu." `account/CheckEmail.tsx:8-66`; `Register.tsx:61`; `Recover.tsx:47`; `packages/mobile-ui/src/brand/StateArt.tsx:11-13`.
- AuthCallback renders on `AuthScreen` and `AuthHeading` like the other auth pages. While checking, the subtitle reads "Memeriksa tautan…". The recovery fields are `PasswordField` with show and hide. `account/AuthCallback.tsx:77-132`.

### Dark grounds for blocks on a sheet

- Dark `fill` (#2A2D27) cannot be told apart from the dark sheet `surface` (#292927), and `cardBorder` is empty in dark. A block that sits on a sheet uses the `well` ground (Masalah `delivery-card`, the Hapus akun callout). A block on the canvas may use `fill`. `help/ReportProblem.tsx:~260`, `account/HapusAkun.tsx:~112`. Found by the dark emulator recheck.

### Owner rulings and deviations

The spec kept the approved layout in these places (controller rulings on the owner's behalf, spec §2):

- Jadwal keeps the month grid in the band with the "Minggu ini" agenda. The research's week strip leading Jadwal, with the month behind a toggle, was rejected because it reverses the approved band layout.
- Paket keeps the three-cell stat strip with carbs and fat on the meta line (spec 3.4), and its pinned footer.
- The tab bar stays on Paket. HIG keeps the tab bar on drill-down within a tab, and native tabs have no per-route hide.
- "Bayar dengan" stays a section on Beli (spec 3.7); only its row changed.
- Hari keeps the one-line circle row on wide screens (spec 3.2.3); only the wrapping case became rows.

Builders' recorded deviations:

- Bantuan's Paket row expands inline radio rows instead of opening a choice sheet. A sheet route over a form sheet on Android was untested, and inline rows were the smaller change (T6).
- "Tandai semua dibaca" sits in the content, end-aligned above the groups, not in the native header (T7).
- Selection uses forest, not an accent ring. There is no accent token, and in palette K forest marks selection (Pilih menu cards and the code slots, T3 and T8).
- The Bantuan topic examples differ from the spec: Pembatalan "Batalkan paket atau sisa harinya", Pembayaran "Sudah bayar, tapi paket belum aktif" (T6).
- Pembayaran adds a "Gagal" tag for a failed payment, and the Menunggu caption drops "Menunggu pembayaran" (T7).

### Deferred

These need a schema, an API or owner input (spec §4):

- A default-address field and its marker on Alamat.
- The paid date on Pembayaran. The customer read has no `paid_at`, so the caption shows the start date.
- A bulk `notification.readAll`. The client loops over unread items.
- A Catera support WhatsApp number and reply time. None is in config, and none is invented.
- Photo upload on Masalah.
- Email code login. Email auth is link-based.

### Follow-ups

- After "Tambah alamat" from the pick sheet, Beli does not preselect the new address (T5).
- While only the payment methods are loading, the footer says "Menghitung total…" although the button already shows the amount (T4).
- `footerFits` estimates per-character widths for the current font, so a font change needs new numbers. Its gate case is a 6-digit total at 360dp and font 1.0, estimated at 325 against 328 available (T4).
- In dark, Beli's icon tiles and the Porsi stepper circles barely show against the card; the glyphs stay clear.
- The Bantuan Paket list can show the same package name twice (two subscriptions of one package); add a date or the caterer to tell them apart.
- iOS was not checked on a device (no Mac), including the stacked Hari rows' chevron and the v2 settings pressed tint.
