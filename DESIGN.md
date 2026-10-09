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

The native apps have a real dark theme, defined as `nativeThemes.dark` beside `nativeThemes.light` in `@catera/design-tokens`. Both palettes use the same keys as the web `colors` plus `controlRing`, `tabBar` and `disabledFill`, and light reuses today's values unchanged. The keys name roles by their light-mode hue, so dark mode inverts the forest and cream pair: forest (headings, selected fills, primary buttons) becomes cream-white, and cream (text on forest, the attention card) becomes forest. A primary button is therefore a cream fill with forest text in dark mode. The dark body is neutral charcoal, never dark green: brand green appears only where the inverted `cream` role puts it, such as the attention card.

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
| `tabBar` | `#FFFEFA` | `#1E1E1C` |
| `disabledFill` | `#CFD3C6` | `#34332F` |

`controlRing` is new and is the intended colour of the unchecked-box ring and the dashed "not set" cell border, the only cue for those controls. The Dapur checklist box (`CheckRow`) and the dashed photo tile in Dapur Menu read it; the Jadwal "not set" cell sits on the mood header and keeps `markerIdle`. Light measures 3.40:1 on `surface` and dark 4.39:1. `tabBar` is new and does not change with mood. `disabledFill` is new and is the fill of a disabled primary button, so the `muted` label on it reads: dark `#34332F` gives 5.97:1 (the `fieldBorder` it replaced gave 2.08:1), and light equals the old `fieldBorder` grey `#CFD3C6` at 3.83:1, unchanged, so no light pixel moves. Measured on October 9, 2026: dark `forest` on `surface` 14.79:1, dark `sunriseInk` on `surface` 10.34:1, dark `charcoal` on `surface` 13.97:1, dark `muted` on `surface` 7.43:1, dark `danger` on `surface` 7.12:1, dark `cream` against `forest` 11.33:1.

Contrast rules, enforced by `tests/native-contrast.test.ts`: text at least 4.5:1 on its own fill, and `controlRing` at least 3:1 on `surface`, and the `muted` disabled label on `disabledFill` at least 4.5:1 in dark (light keeps its existing 3.83:1, asserted at 3.8). `fieldBorder` and `secondaryBorder` are not enforced, because their controls also carry a label and a fill; light `fieldBorder` measures 1.51:1, a gap that predates dark mode and is left for a later pass. Decorative strokes are exempt. Native sources read these values through `useColors()` or `themedStyles` from `@catera/mobile-ui`; no native source imports `colors`. The fixed surfaces that must not invert (the Plate photo scrim and the Sunrise button) read `nativeThemes.light` keys by name. A theme change is not animated.

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

Desktop customer navigation hides at 800px; the fixed five-destination customer bottom navigation is enabled at 560px, including safe-area padding. Do not infer a bottom bar at all tablet widths. Native uses four customer tabs (Beranda, Jadwal, Jelajah, Akun) and four role-gated Dapur tabs (Hari ini, Pelanggan, Menu, Usaha), safe-area containers, keyboard avoidance in the shared `Screen` (padding behaviour on iOS, with the keyboard offset taken from the screen's own measured window position, so the header and the demo strip above it are counted), a scroll body and footer centered and capped at 760 wide (body 20 side padding, footer 16), and platform navigation controls.

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

The reserved days on the native payment success screen are plain read-only tags, not chips (controller ruling on Phase D Task 5: a non-control must not borrow a control's outline). Each tag has the theme `sage` fill, no border, radius 8 with `borderCurve: "continuous"` and padding 10 by 2; its label is the regular `body` text in theme `charcoal`, tabular and selectable. Tags are not pressable and do not take the 48 minimum height of native chips. Charcoal on sage measures 12.09:1 in light and 12.39:1 in dark (`apps/customer/src/buy/PaidOutcome.tsx:84-99, 132-134`; evidence: `buy.test.tsx` "shows the food, the package, the first delivery and every reserved day of a short plan" and "the reserved-day tags read the dark theme's sage fill and ink").

**The Truthful State Rule.** Pair state color with explicit text, and make the selected filter and its empty result visible. Unavailable choices carry a visible reason: native delivery-date chips caption a blocked day “Penuh” or “Terisi” instead of only dimming it.

**Delivery stages follow the kitchen, never the clock.** The customer's plate state and the domain's journey rule read a meal's fulfilment status and timestamps. A meal that nobody has moved to cooking has the plate state `scheduled` and its plate sentence is "Terjadwal" ("Scheduled") on a card plate; on the Beranda hero, when the window and address are known, the track says "Terjadwal" and the header is "Diantar {window} ke {address}" instead; "Sedang dimasak" ("Being cooked") is the plate sentence only for a meal the kitchen has moved to cooking. Once a meal's delivery window has started without a departure, a scheduled meal and a cooking meal alike turn `due`, and the plate says "Seharusnya sudah tiba" ("Should have arrived"). The journey caption ("Terjadwal", "Dimasak" and the others, see the table below) is a separate line from the plate sentence and also reads the status only: it never changes with the clock. The customer plate sentence is built and shows on the customer app today. The journey caption and its track are on the Dapur count card (Task 8) and on the Beranda hero (Task 6); the Dapur customer detail still labels every status other than delivered and "Gagal diantar" as "Terjadwal".

### Cards / Containers

Package cards combine food, caterer identity, explicit terms, price, and action. Their body padding is 20px on wide screens and phone, 16px at the intermediate breakpoint. The image hover is restrained; card boundaries remain light. Operations panels use 24px padding and 12px corners with no ordinary raised shadow.

Customer-home subscriptions are flat rows inside one outlined container, with separators and small food thumbnails. That rule belongs to the home hierarchy; other subscription/detail surfaces retain their existing bordered cards where present.

### Discovery and purchase clarity

The [September 19 UX research](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/UIUX-RESEARCH-2026-09-19.md) records the comparative evidence and responsive acceptance checks. Discovery keeps selected filters in its URL, displays removable filter chips and a result count, and offers a complete reset for empty results. Reset retains delivery area and sort. Package cards place total price, the per-meal rate, and delivery coverage after the commitment summary, before detailed contents.

**The Price Unit Rule (web and native).** A per-meal price always carries its unit, “/ sekali makan” (“/ meal”), and a combined lunch-and-dinner offer adds “2 kali makan / hari” (“2 meals / day”), because one portion of a combined offer covers both meals. Never label that number “per porsi” or show it bare. Seller screens are the carve-out: the Dapur price field “Harga per porsi (Rp)” and its package line enter and show the daily price of one portion (which for a combined offer covers both meals), not a per-meal rate; the customer renewal card names that same number “per porsi per hari”.

Checkout shows the selected package and a labeled base subtotal before the form on phone and beside it on desktop. Package contents remain available in a disclosure. Review displays the selected delivery address and the server-confirmed total; the same total accompanies the payment action. Only one progress step is current, and changing steps focuses the new heading. Phone actions preserve bottom-navigation clearance.

On phone, the thumbnail stays beside the package identity while totals, explanations, and the contents disclosure use the full summary width. Checkout keeps the complete selected address visible beneath its selector and explains empty, stale, or out-of-coverage destinations. Payment availability distinguishes checking, failed lookup, and no available methods; an explicit retry preserves the reviewed order and consent and focuses its result. New explicit purchase choices take precedence over stored drafts. See [the September 24 journey quality record](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/MARKETPLACE-CHECKOUT-QUALITY-2026-09-24.md) for local evidence and limits.

Approved local food artwork and the wordmark may use responsive delivery derivatives while preserving the original files and compositions. Uploaded or signed image URLs retain their established delivery path. Derivative dimensions are not claims about master resolution or transparency.

### Navigation

Customer desktop navigation is compact, with a sunrise dot at the selected link. The phone bar has five labeled destinations; selected labels and icons become stronger forest. Operations use their own sidebar with a forest selected row, quiet hover, and a labeled workspace identity. Use consistent SVG interface icons; supporting brand illustrations do not replace operational icons.

Icons (native): Ionicons via `@expo/vector-icons`, chosen because the set ships with Expo, so both apps run in Expo Go without extra icon assets. Tab icons are outline until focused, filled when focused. State glyphs (saved heart, selected star, coverage sun and moon) are filled because the fill itself carries the state; other interface icons are outline.

The native tab bar (both apps) is 64dp plus the bottom safe-area inset and pads that inset, so the labels sit above the Android gesture pill or the iOS home indicator and every tab item keeps a touch area of at least 48dp (64dp tall in practice). The bar uses the `tabBar` surface and does not change with mood. Date rows and other one-line summaries wrap instead of truncating when a status such as "Sudah sampai" is part of the line.

### Tampilan row (native)

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

The delivered square masters are 1254 × 1254; wordmark and horizontal lockup are 2172 × 724. All sixteen are RGB with opaque cream or forest mattes and slight generated tonal variation. The current wordmark styling uses multiply blending; that does not create an alpha channel. Real transparency, the requested 2048/4096 master targets, and completed adaptive foreground derivatives remain unfinished. Preserve originals and record any future approved derivatives separately.

The six [synthetic food images](packages/brand/manifest.food.json) are 1448 × 1086 at 4:3. They serve explicitly labeled demo listings. **The Demo Label Rule (web and native).** Whenever the backend reports demo mode, every screen says so, except where a modal or system UI covers the strip: the web shows its demo ribbon, and both native apps show a persistent “Demo · data sintetis” (“Demo · synthetic data”) strip directly under the status bar, signed in or out. Production sellers supply their own food images. Do not claim that generated food establishes a real seller’s meal or endorsement.

The [finish verdict](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/output/V1-FINISH-VERDICT.md) resolves four bounded web findings using the existing desktop, tablet, phone, and viewport captures in `output/visual-review/`, including `admin-pending-empty.png`. Overall disposition remains **fix** for unfinished transparent artwork; high-resolution master acceptance also remains open in the asset manifest. Native source now gives quantity/compare controls 48 × 48 and chips a 48 minimum height. No native device visual approval, gesture/large-text/dark-appearance approval, push verification, or return-link certification is supplied by this documentation.

### Native motion

Native motion is a smaller system than the web's and shares its timing vocabulary through `nativeMotion` in `@catera/design-tokens`: control 120ms, selection 180ms, content 220ms and feature 320ms, with the same `cubic-bezier(.16, 1, .3, 1)` ease. Press feedback is a spring (damping 18, stiffness 260) rather than a timed curve.

Controls (buttons, chips, segmented options, stepper buttons, round buttons, stars, reactions, radio picks) use `PressableScale`: they compress to 0.97 on press-in, return on release, and fire a haptic (`tap` for actions, `select` for choices; `success` and `warning` are reserved for outcomes; a disabled control fires none). Tappable rows and cards that open something use `PressableRow`: an instant 0.7 dim while pressed, no scale, no ripple and no haptic, identical with and without reduced motion. No raw `Pressable` remains in native app sources; every tappable gives press feedback. `FadeSwap` fades in new content when its key changes. Pushed screens share the `AppHeader` round back button and wrapping heading.

- Choreographed motion belongs to story beats, not to every screen. Native has no sequenced entrance: the former “Cara kerja Catera” steps and their 80ms stagger were removed (owner decision, October 8, 2026), and package detail states package facts instead.
- Never stagger a catalog, any list or any sequence. Navigation, operational rows and money totals stay still.
- Reduced motion (the system setting, read through `useReduced`) replaces scale and movement with opacity-only feedback (pressed controls dim to 0.85) or no motion at all; bottom sheets fade instead of sliding up.
- Animate only transform and opacity.
- **Rantang marker (Phase C).** The delivery track draws a lunchbox on a line with three stops (kitchen, road, door). The marker slides to its new stop over 320ms (`feature`) only when the stage changes after the track is already on screen, and the progress line grows with it as a scaled bar, so only transform moves. The first render puts the marker in place at once, and the marker and the progress line stay invisible until the track has been measured so nothing flashes at the wrong stop. "Terjadwal" and "Dimasak" are both the first stop: when a scheduled meal turns to cooking the outline box fills with its tint at once and does not move. Nothing loops or pulses.
- **Story open and swipe (Phase C).** The story opens with a fade and a scale from 0.92 to 1 over 320ms, once, when it appears. It never advances by itself: no timer turns a part. Only a tap (the finger moved 10dp or less) or a sideways swipe turns a part: a tap on the right half of the content goes to the next part and on the left half to the previous one, a right-to-left swipe goes to the next part and a left-to-right swipe to the previous one, any other drag does nothing, a swipe down closes it, and the parts never scroll. Changing part fades the new content in over 220ms (`FadeSwap`).
- **Checklist tick (Phase C).** Ticking a checklist row fills the round box with forest and a cream check over 120ms (`control`) and dims only the dish photo, or the meal icon, to 0.55 over 220ms (`content`). The text never dims, so it keeps 4.5:1 (ruling on gate F1, October 9, 2026): the dish name turns `muted` and is struck through, and the quantity turns `muted`. The colour and the strike-through switch at once, because only opacity and transform are animated. Un-ticking reverses all of it. Nothing plays when the row first appears. Against Dapur's dial under Native antislop revisions, October 8, 2026 (MOTION 1, press feedback and content fades), the tick fill and the photo dim are the only motion this work adds to the checklist, and they exist as the tick's feedback; the dial itself is unchanged.
- **Payment success (Phase D, ruling D8).** One `success` haptic fires when the payment's stage turns paid while Bayar is open; reopening a checkout that is already paid fires none, because the first stage of a mount has nothing before it (`apps/customer/src/buy/PaymentScreen.tsx:54-62`; evidence: `buy.test.tsx` "turning paid while the screen is open gives one success haptic" and "opened already paid gives no success haptic"). Every Bayar stage renders the same `Screen` with its body in a `FadeSwap` keyed by the stage, so a stage change (pay to paid, checking to paid) fades the new body in over 220ms (`content`) instead of remounting the page; the first load does not fade (`PaymentScreen.tsx:173-188, 225`; evidence: code inspection, because the Reanimated mock does not animate).
- **Reduced motion for these.** The marker slide, the progress line, the story opening, the part fade, the tick fill, the photo dim and the Bayar stage fade are all instant. The press feedback of a whole checklist row is the existing `PressableScale` rule: it dims to 0.85 instead of compressing.
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
- `Dial (Dapur): ENERGY 1 / RHYTHM 1 / MOTION 1 (+ press micro-feedback)`. Kitchen operations are restrained and denser; rows and money totals stay still, and motion is limited to presses and content fades (the Hari ini / Besok date button; the mood switch adds the header and hero cross-fade described under Native mood and theme).

**The Three States Rule (native).** Every native data screen shows loading text (“Memuat…”), an error message in Danger with a “Coba lagi” action that reloads, and an empty state that says what is missing. Counts and actions that depend on the data stay hidden or disabled until it loads (Dapur Pelanggan filter counts, Menu “Salin minggu lalu” and “Bagikan menu”, Usaha “+ Paket baru”). Dapur uses one shared `ReadError` for failed reads. A font-load failure shows a plain restart message instead of a blank screen.

- **Screen readers.** The `Text` title and heading variants are exposed as headers. A pushed screen has one heading, the `AppHeader` title, with no repeated in-content title. The bottom-sheet scrim is a button labelled “Tutup” / “Close”, and the VoiceOver escape gesture closes the sheet too; a sheet with no title renders no empty heading. Prices are read as text, never as headings. The scrim label and the stepper's decrease and increase labels are translated by the caller.
- **Touch targets.** Every native control is at least 48dp: chips, segmented options, text buttons, stepper buttons, filter chips, review stars, month arrows and icon buttons included.
- **Package detail facts.** Package detail states what a customer can act on: delivery days and windows, the change cutoff (“Ubah hari”, until the cutoff time the day before), the delivery fee, and the earliest bookable start (“Mulai paling cepat”), hidden when nothing is bookable. It has no generic how-it-works steps.
- **Review stars.** Unselected stars are outline icons in Muted; selected stars are filled in Sunrise ink, so the choice never rests on a pale colour alone.
- **Kitchen truth (Dapur).** “Yang dimasak” lists only real dishes. Menu slots nobody has filled read “Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur”, one line per package that still has gaps (never summed across packages), and owners get an “Isi menu” link under each line that opens that package in the menu editor. The shared and printed recap carry the same per-package lines. “Bagikan menu” is disabled, with “Belum ada menu untuk dibagikan”, when no day of the week has dishes, and “Salin minggu lalu” is disabled, with “Minggu lalu belum ada menu untuk disalin”, when last week has nothing to copy. A package still running past its booked last day (moved deliveries) shows only its days left (“Sisa 1 hari”), never a past end date. Attention cards on Hari ini that point to a Dapur screen are links with a chevron; a card with no Dapur destination stays plain.
- **Claims.** No unmeasured durations and no unbacked security claims: the payment card says only “Pilih cara bayar di halaman berikutnya.” until the server names its payment provider. Calls to action name their task (“Aktifkan pembayaran”, not “Mulai”).

These revisions were verified on the Android emulator in Expo Go with the demo backend; iOS behaviour (keyboard offset under the demo strip, VoiceOver reach of the sheet scrim) is not yet device-verified.

## Native theme, October 9, 2026

Owner decisions of October 9, 2026, recorded with Phase A of the native visual identity ([spec](docs/superpowers/specs/2026-10-09-native-visual-identity-design.md), sections 3.1 and 3.2):

- **The app follows the phone by default.** Both native apps read the system appearance (`userInterfaceStyle: "automatic"`). Dark is offered because the owner asked for it, not as a default look.
- **The user can override it.** A "Tampilan" row in customer Akun and Dapur Usaha, beside "Bahasa", offers Sistem, Terang and Gelap. The choice is stored on the device in SecureStore, applies at once and survives relaunch (see Components, Tampilan row).
- **Dark body is neutral charcoal, never dark green.** The owner's reason: a green body "lacks contrasts with the header and footer". Brand green appears only where the inverted forest and cream roles place it, and the tab bar keeps its own fixed surface.
- **Dark is a real theme.** It has its own palette table, a measured contrast rule enforced by test and no new decoration: no glow, glass or extra shadow appears in dark mode, and the only gradients anywhere in the native apps are fixed dark fades over a photo: the StoryCover scrim and the Menu besok story's bottom scrim, whose purpose is to keep text legible, and a short fade at the top of the story photo that only joins it to the black header (see Shapes, depth and type). A theme change is not animated.
- **Light keeps its palette, with five approved exceptions.** Every light colour value is exactly the value of the shared `colors`. The light screens differ from the Phase 1 baseline in five named ways, all approved:
  - Two Dapur text inputs (the menu slot dish name and the import paste box) use charcoal ink instead of the platform default black, because the default is unreadable on the dark surface.
  - The tab bar in both apps is 64dp plus the bottom safe-area inset, with the inset as bottom padding and every item at least 48dp, so the gesture pill no longer crosses the labels on gesture-navigation phones. Phones with no bottom inset keep the plain 64dp bar.
  - The four multiline report and reply fields (customer help reports and the problem form, the Dapur reply) now show the standard input border and fill, because a caller's `style` extends the `Field` base style instead of replacing it.
  - The customer Jadwal day row's detail line wraps instead of truncating at large font scales, so "Sudah sampai" stays visible.
  - The bottom `Sheet` changed in both themes. Its scrim now covers the status bar, the sheet surface fills the gesture band so no strip of the screen behind it shows through under the sheet, and on iOS its bottom padding grows by the home-indicator inset. The sheet also lifts a focused field above the keyboard (see Native mood and theme).

Evidence and limits. Phase A was checked on the Android emulator in Expo Go with the demo backend: light captures against the Phase 1 baseline, dark captures of every tab screen and the main pushed screens, the override and its persistence across relaunch, and font scale 1.3. The record is [antislop audit 002](anti-slop/audit-002-2026-10-09.md), with its click-through. The first pass found four defects, and the controller ruled that none ships: the gesture-navigation pill crossing the tab labels, tab items under 48dp, a truncated Jadwal status at font scale 1.3, and black typed text in the multiline report and reply fields in dark. All four were fixed inside Phase A (tab bar safe-area inset and item height, wrapping day-row detail line, `Field` style composition) and re-checked on the emulator. The multiline fields now also show the standard input border and fill in light, which they lacked before. No iOS, physical-device, TalkBack or standalone-build splash check was run, so this is not a device or release approval.

Dials are unchanged by this phase: customer ENERGY 2 / RHYTHM 2 / MOTION 2, Dapur ENERGY 1 / RHYTHM 1 / MOTION 1 (plus press micro-feedback).

## Native mood and theme

Owner decisions of October 9, 2026 ("Go with E", on top of the D2 direction and the dark-mode row), built as Phase B of the native visual identity ([spec](docs/superpowers/specs/2026-10-09-native-visual-identity-design.md), sections 3 to 7). This section is the contract for the mood layer; the dark palette it sits on is under Native dark theme and Native theme, October 9, 2026.

### Two independent axes

- **Theme** is light or dark and follows the phone unless the user picks Terang or Gelap under "Tampilan". It colours body, cards, rows, sheets, forms and the tab bar.
- **Mood** is Siang or Malam, chosen by the user with a button. It colours mood surfaces only: `MoodHeader` and `AppHeader`, `MoodToggle`, `DayArc`, the Malam pattern, `CalendarPhotoCell`, the Beranda hero card, the plan detail hero card, the paid hero card on Bayar ("Pembayaran diterima"), the Dapur count card and the Jelajah header. Bodies, cards, rows, sheets and the tab bar never read mood colours, so a mood switch changes only the header and the hero.
- Every screen therefore has four looks: light Siang, light Malam, dark Siang and dark Malam. A screen without a mood toggle still shows the current mood in its header.
- **Launch default.** The mood starts as Siang before 15.00 Asia/Jakarta and as Malam from 15.00 to the end of the day, computed on the Jakarta clock whatever the device timezone. The clock only picks the default; it never switches the mood while the app is open. Mood lives in memory, one provider per app, and is not stored.
- **Status bar.** Light glyphs when the theme is dark, or when the mood is Malam and the demo strip is not shown; dark glyphs otherwise. A fixed `StatusBand` in the header colour sits under the status bar of every screen with a header, so the glyph style stays correct once the header has scrolled away. The demo strip stays above the header and owns the status bar inset while it is shown.
- **The tab bar is fixed.** The owner's reason: "No need to change the color of the bottom nav bar when toggling between day and night." The bar uses the `tabBar` surface in both moods.

### Mood tokens

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
- The hero card has radius 28 with an inner photo radius 20. Content cards are 16 (`Card` and the Jelajah package row); the card-variant plate and the Dapur count card are 22. Existing panels (14), inputs (9), buttons (10) and chips keep their radii; toggles are pills. New rounded surfaces use `borderCurve: "continuous"` (iOS only). The one exception is the Dapur Menu dish photo tile, which has a plain `borderRadius` because `ImageStyle` does not accept `borderCurve` and the tile's wrapper matches its image.
- The hero is the only raised surface on a screen (Quiet Work Rule); everything else stays flat with borders or tonal fills. No glow or glass is added, in any look. The only gradients are fixed dark fades over a photo (`experimental_backgroundImage`, no dependency). The StoryCover scrim and the Menu besok story's bottom scrim exist to keep text legible, which antislop R-01 allows when the purpose is written down. The story page has a second, short fade at the top of the photo; it is not a legibility scrim and carries no text, and its written purpose is joining the photo's top edge to the black header above it. None of them is a mood surface. Legibility rule for the story's bottom scrim: it ramps from clear to `rgba(11,31,22,0.9)` over the first 48dp and holds 0.9 to 0.92 below that, and the title and every line under it start below the ramp, so cream text on it measures about 12:1 against a white photo (cream #FFF7E9 over that fill, computed). The sticker starts 20dp into the scrim, inside the ramp, and needs no scrim because it sits on its own cream fill.
- **`display`** is a new `Text` variant in `components.tsx` (`textVariants`): 34/40, `Jakarta-ExtraBold`, tracking -1. Controller ruling (October 9, 2026, final fix wave): `display` is for short fixed headlines only. A string `MoodHeader` title defaults to the `title` variant (30/39), and a caller opts in with `titleVariant="display"`. Today the opt-ins are the Jelajah two-line headline, the Dapur Menu week range and the Dapur Menu title while it loads; the Menu besok story title uses it in Phase C. The reason: a long, dynamic name (a caterer, a customer, a month) set at 34/40 and font scale 1.3 pushes the content below the fold, and the hero screens (Beranda) already use `title`. The spec (line 104) reserved `display` for the Menu besok story title; the earlier build ruling that made it every header's headline is withdrawn. Counters and checklist quantities use `heading` with tabular figures.
- **Sticker.** A rotated (-2 degrees) cream label with a 1.5 sunrise-ink border and forest text, marking the one fact on a screen. The Menu besok story carries it for the meal and its delivery window ("Makan siang · 11.00–13.00"); no other screen carries one yet.

### Code-drawn brand objects

The day arc (dashed track, sun and moon markers, an active disc), the rantang (lunchbox) and the Malam lunchbox pattern are interface objects drawn in code with `react-native-svg` in `packages/mobile-ui/src/brand/`. They are not generated artwork: no image asset was added or altered, and nothing here is a transparent or high-resolution master. Ionicons remain the interface icon set.

### Mood motion

All timings come from `nativeMotion` and only transform and opacity animate.

- **Mood switch.** The header, hero, Dapur count card and status band fills cross-fade over 220ms by animating the opacity of two stacked fills (one shared `MoodFill`, so they share a curve and a clock); the arc's active disc travels to the other end of the arc over 320ms; the toggle pill slides over 180ms; a `select` haptic fires. The body and the tab bar do not move or change. Title, toggle and disc colours snap while the fill fades (accepted).
- **Reduced motion** makes every one of these instant. The setting is read when the app starts, so it applies after the next launch.
- No entrance animation and no stagger for the calendar, lists or catalogues (unchanged rule). Nothing loops.

### Components and behaviour (rulings of October 9, 2026)

- **Toggles.** `MoodToggle` is a `tablist` of two equal-width `tab`s with `selected` state, a 48dp hit area and translated labels ("Siang" and "Malam"; "Lunch" and "Dinner" in English). It appears on Beranda, on Dapur Hari ini and, as the two large meal buttons, on Jelajah; Dapur Menu uses the same mood to choose which meal it edits. A single-meal package shows its own meal in Dapur Menu whatever the mood, with its caption (B5).
- **Beranda.** The tab's header title is "Beranda" ("Home" in English). The headline names the meal and dish ("Siang ini, ..."), and the hero shows that meal's plate. "Berikutnya {label}" appears only when nothing is left today: while the other meal's plate is still to come, the meta line keeps its date. When the selected mood has no meal today, the headline reads "Siang ini," / "tidak ada antaran." (or the Malam forms) with a meta line naming the next delivery (B6); with no deliveries at all, the existing empty state stays. The other meal of the day is a row under the hero that switches the mood when tapped. The "Paket selesai" recap and the plan lines that open the plan detail are described below (Phase D).
- **Beranda hero track.** The hero shows a rantang track under the dishes: a lunchbox marker on three stops (Dimasak, Diantar, Sampai) and one caption line that says what is true now ("Terjadwal", "Dimasak 08.10", "Berangkat 10.42", "Sampai", "Tercatat sampai" when nobody tapped and the system closed the meal). The stage follows fulfilment status and timestamps, never the clock, so a meal the kitchen never tapped stays "Terjadwal". The track appears on the hero only, never on a card plate or the other-meal row, and it is hidden for a failed plate, a reported plate and a meal marked as a problem, which keep their own message. The "Berangkat {jam}" chip that used to sit on the photo is removed, because the caption carries the departure time. Reachability (ruling on Phase D Task 1): production's nightly auto-close only closes days before today (`v1.auto_deliver`, `supabase/migrations/20261008102000_delivery_depart.sql:46`), so "Tercatat sampai" is not reachable on Beranda in production, and the demo has no state for it either (see Demo states). The wording is covered by Jest (`today.test.tsx` "says Tercatat sampai when nobody tapped and the system closed the meal"); the reachability is a release note for the owner, not a Phase D fix.
- **Hero header never repeats the track.** When the hero shows the track, its status header must not say what the caption says. A scheduled meal drops "Terjadwal" from the header and leads with the second line, "Diantar {jendela} ke {alamat}" ("Delivered {window} to {address}"). A meal on the way with no recorded departure time leads with "Tiba sekitar {jendela}" ("Arriving around {window}"), because its caption would otherwise read "Sedang diantar" twice. When the delivery window is empty, or a scheduled meal has no address label, nothing is promoted and both original lines stay, so the header never reads "Tiba sekitar " or "Diantar  ke". A meal the system recorded as arrived (nobody tapped, `confirmed_by` is `auto`) says "Tercatat sampai" ("Recorded as arrived") on the first line of its plate sentence, the same words as the track caption, with "pukul {HH.MM}" ("at {HH.MM}") on the second line. On the hero, whose track shows that same caption, the header promotes the second line instead, "Pukul {HH.MM}" ("At {HH.MM}"), so the two never say the same thing; when no time was kept (malformed data, because the app always records one), the truthful state wins over the no-repeat rule and the hero header reads "Tercatat sampai" ("Recorded as arrived") with no second line. A meal the customer or the caterer closed keeps "Sudah sampai" with "pukul {HH.MM}", beside a track that reads "Sampai". Every other hero state keeps its header and second line unchanged, apart from the due line below. Card plates keep both original lines (for an auto arrival, "Tercatat sampai" then the time), and the other-meal row keeps the original first line.
- **Due and unreported.** The hero, for a meal past the start of its window that the kitchen never tapped, keeps "Seharusnya sudah tiba" as its header and says "{jendela} · belum ada catatan dari dapur" ("{window} · no update from the kitchen yet") on the second line, next to a track that still reads "Terjadwal". With no window the line reads "Belum ada catatan dari dapur". The hero, for a due meal the kitchen is cooking, keeps the bare window.
- **Track times and usage.** The status header, its second line and the track caption set their figures tabular, like every other operational number. The hero counts `journey_viewed` at most once per delivery, meal and stage while the app process lives; the count row has no user, caterer or device column. A meal the kitchen has not started and a plate shown from the offline cache are never counted.
- **Menu besok row (Beranda).** Under the other-meal row and the extra plates, above the menu choices, a row titled "Menu besok" with tomorrow's date ("Sabtu 10 Okt") and one 60dp `PhotoRing` per delivery and meal, lunch first. A lunch ring is sunrise ink and a dinner ring is forest. Two packages with a lunch each give two lunch rings. Each ring is a button that opens the story at that part (`/tomorrow?part=<index>`). There is no row when nothing is delivered tomorrow.
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
- **Jadwal** (see Customer meal calendar). The month grid sits in the mood header and replaces the icon cells with photo cells. A covered day shows the lunch dish photo, then the dinner photo, then the package photo, with the day number in a pill and a moon badge when dinner is also covered. A covered day whose menu is not set has a dashed `markerIdle` border and a sun mark. Past days are dimmed. **Selection is shown by shape:** the selected day has a `headerText` ring plus a 4dp bottom bar, and today has only the `todayRing` outline, so the two stay distinguishable on every look and "past" keeps its meaning. The day-number pill on a photo cell stops scaling at 1.15 times the system font size, so it never grows into the moon badge; the bare day numbers scale to 1.5. With a large font the moon badge becomes a small dot. The grid uses 12dp side padding and 2dp gaps at 360dp, with cells flexible and at least 44dp wide (44dp is the antislop R-03 floor, and a seven-column month needs it). While the month loads the header shows "Memuat…" in place of the grid and legend, and a failed read shows the error with "Coba lagi"; unknown data is never drawn as uncovered. The legend names "Foto menu", "Menu belum diisi" and "Ada makan malam".
- **Tab labels.** The bottom tab labels in both apps stop scaling at 1.15 times the system font size (`maxFontSizeMultiplier`), so the four labels stay on one line at font scale 1.3 on a 360dp phone; the icon carries meaning. Because a custom label replaces the label the bar would speak, each tab sets `tabBarAccessibilityLabel` on iOS only ("Pelanggan, tab, 2 dari 4" in Indonesian, "Customers, tab, 2 of 4" in English; a role with fewer tabs counts its own, for example "Menu, tab, 2 dari 2" for Dapur staff), so VoiceOver still hears the title and position. Android sets none, because its tab item already carries the `tab` role and TalkBack would say "tab" twice. The Jadwal day row's dish name wraps and never truncates.
- **Plan detail (Phase D, ruling D1).** `/subscriptions/{id}` is a pushed screen, not a sheet, because notification links and push taps open it cold, where a sheet has nothing under it (`apps/customer/src/plan/PlanDetail.tsx`, behind `apps/customer/app/subscriptions/[id].tsx`). Its `MoodHeader` has the round back button (back, or home when a cold link has nothing behind it), the package name as the title and the caterer on a `headerMeta` line under it (`PlanDetail.tsx:46-47, 94-98, 162-165`). The hero is the screen's one raised card on the mood's hero fill (`MoodFill` hero, radius 28) and does not overlap the header (the 58 overlap stays a Beranda rule). It holds the package photo (radius 20), a headline, the date range "{Hari d Bln} – {Hari d Bln}" in tabular figures, and "Sudah diperpanjang" ("Already renewed") when another plan renews this one (`PlanDetail.tsx:167-213`). The headline is "{n} hari lagi" from `remainingLabel` for an active plan, plain text with no ring, bar or streak (ruling D2); "Paket selesai" ("Plan finished") for a completed plan; and "Paket dibatalkan" ("Plan cancelled") for a cancelled one, with its date range (`PlanDetail.tsx:174-179`). Evidence: `plan.test.tsx` "an active plan that is not due: header, hero with days left, no footer action", "a completed plan reads Paket selesai with its dates, no upcoming days, and offers to continue", "a plan already renewed says Sudah diperpanjang and offers no renewal (Review Focus 2)" and "a cancelled plan reads Paket dibatalkan with its dates, and offers nothing and lists nothing".
  - **Berikutnya.** Under the hero, "Berikutnya" lists at most five upcoming days of this plan only, in date order. Each row has a 60dp `PhotoRing` (sunrise ink for lunch or both meals, forest for dinner), the day and the dishes, and opens `/hari/{id}`. With none it reads "Tidak ada antaran mendatang." A cancelled plan shows no "Berikutnya" at all (`PlanDetail.tsx:157, 215-263`; `packages/domain/src/plan.ts:50-64`). Evidence: "Berikutnya lists this plan's next five days with their photo ring, day and dishes"; `tests/plan.test.ts` "planDetail > lists only this plan's upcoming rows, at most 5, in date order".
  - **Footer action (rulings D3 and P2).** One `StickyAction` in `Screen`'s `footer`, chosen by the plan's action (`packages/domain/src/plan.ts:35-47`). A trial offers "Lanjutkan dengan paket penuh" to `/paket/{package_id}` only while it is active or completed and no later non-cancelled plan for the same package exists (ruling P2: never invite a duplicate purchase); otherwise a trial offers nothing. A plan that another non-cancelled plan renews says "Sudah diperpanjang" and offers nothing; a cancelled renewal does not count, so the plan can be renewed again. An active full plan with 3 or fewer days left (`renewalDue`, counted in remaining days) and a completed full plan offer "Lanjutkan paket" to `/renew/{id}`. Any other plan, an active plan not yet due included, has no footer. A cancelled plan and a plan shown from the offline copy have no footer whatever the action says (`PlanDetail.tsx:129-147`). Evidence: `plan.test.tsx` "an active plan due for renewal: Lanjutkan paket opens Perpanjang and counts renew_started", "a trial invites the full package and counts no renewal", the renewed and not-due tests above; `tests/plan.test.ts` "planDetail > action > renewed, never renew, once another non-cancelled plan renews it (Review Focus 2)", "... trial none once a later non-cancelled plan for the same package exists (Ruling P2)" and "... a cancelled renewal does not count: the plan can be renewed again".
  - **States.** Loading reads "Memuat paket…". A failed read falls back to the offline copy when there is one, and the plan then shows with "Terakhir diperbarui HH.MM · tidak ada koneksi" and no footer action; with no copy it reads "Belum bisa memuat" with the read's error and "Coba lagi". A plan the read does not hold (another account's, or gone from a stale link), and a plan in any status other than active, completed or cancelled, read "Paket tidak ditemukan." ("Plan not found.") with "Ke Beranda" (`router.replace("/")`), never a blank screen (`PlanDetail.tsx:36-44, 80-84, 100-127, 152-156`). Evidence: "loading reads Memuat paket… while the read is pending", "a failed read says Belum bisa memuat and Coba lagi reads again", "offline: the cached read shows the plan with no renew action", "a cold link to a plan the read does not hold says so and goes home (Review Focus 1)" and "a plan in a status the screen does not know reads as not found and goes home".
- **Plan links (Phase D).** `customerLink` resolves `/subscriptions/{id}` to the plan detail instead of Jadwal, so notification taps, push taps and the action feed open the plan; `/subscriptions/{id}/menu` still opens Pilih menu (`apps/customer/src/links.ts:53, 59-60`). Akun's active plan rows push the plan detail (`apps/customer/src/account/Akun.tsx:159`), and so does each running plan line on Beranda: a 48dp `PressableScale` row with a chevron, labelled "{paket}, lihat detail paket" ("{package}, see plan details"), with "Chat katering" a separate button beside it (`apps/customer/src/today/Beranda.tsx:264-288, 416`). Evidence: `plan.test.tsx` "plan links > customerLink opens the plan detail and keeps the menu route", `today.test.tsx` "customerLink > maps server hrefs to the customer app routes", `account.test.tsx` "Akun lists packages and signs out", `recap.test.tsx` "the plan lines > are 48dp buttons that open the plan's detail".
- **"Paket selesai" recap (Beranda, rulings D4 and D5).** A one-time body card for a full plan that has just ended. The candidates (`recapCandidates`, `packages/domain/src/plan.ts:66-82`) are completed plans that are not trials, have no non-cancelled renewal and ended within the last 14 Jakarta days (the 14th day shows, the 15th does not), newest first. The card (`apps/customer/src/today/RecapCard.tsx`) shows one plan per Beranda visit: the newest candidate whose seen mark, SecureStore `runtime.storageKey("recap.{id}")`, is not stored. Nothing renders until the marks are read, so a seen recap never flashes. The mark is written ("seen") when the card first shows, and the card stays for the rest of that visit; "Tutup" hides it at once; an older unseen candidate shows on a later visit (`RecapCard.tsx:21-49`).
  - **Content.** The package photo on the left (72dp, radius 12), "Paket selesai", "{paket} · {katerer}" and "{mulai} – {selesai}" in tabular figures, then "Lanjutkan paket" (primary, to `/renew/{id}`) and "Tutup" (text button) (`RecapCard.tsx:54-87`). There is no meal count, because the read cannot count an old plan's delivered meals truthfully (D5, R-17). It is a body card on theme colours (`surface` fill, 1dp `line` border, radius 20, `borderCurve: "continuous"`, no shadow), not a mood surface (`RecapCard.tsx:91-110`).
  - **Placement.** After the upcoming rows, above the renewal and trial cards and the plan lines. With no running plan it leads the empty Beranda, above "Mau makan apa minggu ini?" (`Beranda.tsx:166-170, 244`; `apps/customer/src/today/EmptyHome.tsx:13, 20`).
  - Evidence: `recap.test.tsx` "shows the photo, the plan, the caterer and the dates of a plan that ended yesterday, above the plan lines", "writes the seen mark on its first render and stays for the rest of the visit; the next visit has no card", "renders nothing until the seen mark has been read, so it never flashes", "Tutup hides the card at once", "Lanjutkan paket opens the renewal and counts renew_started on each tap", "shows one card at a time: the plan that ended last, then the next one on a later visit", "shows on a Beranda with no running plan, above the catalogue invitation", "still shows for a plan that ended 14 days ago" and "shows no card when %s" (the plan was renewed, was a trial, ended 15 days ago, ended 180 days ago); `tests/plan.test.ts` "recapCandidates > counts days in Jakarta, not UTC (01:00 WIB is still the previous UTC day)" and "recapCandidates > never offers a plan that ended months ago (Review Focus 5)".
- **Payment success, "Pembayaran diterima" (Phase D).** The paid state of Bayar is its own beat, built from `paidSummary` (`packages/domain/src/plan.ts:100-115`). The header title reads "Pembayaran diterima" ("Payment received") while paid and "Bayar" otherwise (`apps/customer/src/buy/PaymentScreen.tsx:143-150`). The hero card is the screen's one mood surface besides the header (`MoodFill` hero, radius 28, padding 10, hero shadow): the food photo (aspect 1.65, radius 20), the package name (`heading`, `heroText`), the caterer (`heroMeta`) and "Antar pertama {Senin 19 Okt}" ("First delivery ...", tabular) (`apps/customer/src/buy/PaidOutcome.tsx:53-81`). The photo is the package photo when the first menu is not set (the customer picks the menus, there is no menu, it is pending, it is an empty slot menu, or it is the caterer's choice with no named dish); a set menu uses its cover (`PaidOutcome.tsx:15-30`).
  - **Reserved days.** Under the hero, on the theme body, "Jadwal antar Anda sudah tersimpan." ("Your deliveries are booked.") and the reserved dates as plain tags (see Chips / Status) in a wrapping row: the first 6 dates of `quote.dates`, sorted, then "dan {n} hari lainnya" ("and {n} more days"). There is no horizontal scroll (ruling D6, with the tags ruling replacing its chips) (`PaidOutcome.tsx:83-99`).
  - **Nothing else.** The paid beat drops the payment help ("Bantuan pembayaran") and the "{paket} · {total}" line that the other outcomes keep: the paid branch renders the hero, the booked sentence, the tags and the footer only (`apps/customer/src/buy/PaymentOutcome.tsx:91`).
  - **Actions (ruling D7).** The footer has the `StickyAction` "Lihat jadwal" (`router.replace("/jadwal")`); when the offer's `menuSelectionMode` is "customer", a secondary "Pilih menu" (`router.replace("/subscriptions/{sid}/menu")`); and last a text button "Ke Beranda" (`router.replace("/")`). Every one replaces the screen (`PaidOutcome.tsx:104-121`).
  - **Paid is final.** While paid, the header back and the Android hardware back (`BackHandler`, registered only while paid) both `router.replace("/")`, whatever opened the screen: a purchase, a renewal, Payments or a notification. The screen also sets `gestureEnabled: false` on its own stack options while paid, so the iOS edge swipe cannot pop to the screen below. While paying, the swipe stays on and back keeps `router.back()` (`PaymentScreen.tsx:16-18, 64-80, 147`). The iOS swipe is checked through the option value in Jest only; it is not verified on an iOS device, which is a release item.
  - **Checking guard (Review Focus 4).** `paidSummary` is null until the checkout is paid and its subscription id is set, and a paid read without it stays "Memeriksa pembayaran" under the "Bayar" header, with no hero, dates or paid actions (`PaymentScreen.tsx:46-50`; `plan.ts:101-102`).
  - Evidence: `buy.test.tsx` (describe "Pembayaran diterima") "shows the food, the package, the first delivery and every reserved day of a short plan" (it also asserts no "Bantuan pembayaran" and no total), "a long plan shows its first six days, then how many more", "offers the schedule first and home last when the caterer picks the menus", "adds Pilih menu between them when the customer picks the menus, and shows the package photo, not a menu template", "back after paying a fresh purchase / a renewal / a checkout opened directly (Payments or a notification) goes home, never back to checkout", "handles the hardware back only once paid", "turns the iOS edge swipe off once paid, so a swipe cannot pop back to checkout", "opened already paid has the iOS edge swipe off" and "paid without a booking stays in checking and refreshes from the provider"; `tests/plan.test.ts` "paidSummary > is null while pending and for a paid checkout with no subscription id yet (Review Focus 4)" and "paidSummary > sorts the dates, keeps the first 6 and counts the rest".
- **Dapur Hari ini.** The header holds the kitchen name, the date button ("Kamis 8 Okt" with a chevron, 48dp), the toggle and the count card. The date button replaces the Hari ini / Besok segmented control and flips between today and tomorrow. The count card is a mood surface. It shows the session's portions and addresses, "Antar HH.MM" and, under them, the rantang track with the labels "Dimasak", "Diantar" and "Sampai" and a one-line caption from the session's stage (for example "Terjadwal", then "Dimasak 08.10"). The delivery time counts only the rows still being served, so the window of a stop marked "Gagal diantar" never sets it. With no session for the selected meal the screen says so and offers "Lihat makan {other}" when the other meal has one, unless the day is finished and no row of this meal was marked "Gagal diantar" (see Dapur Semua beres). When every remaining row of the meal was marked "Gagal diantar" (so there is no session), it says "{n} antaran makan {siang|malam} ditandai Gagal diantar." ("{n} {lunch|dinner} deliveries marked as failed.", "delivery" for one) instead of "no deliveries", and the count is of the failed rows only.
- **Mulai masak (built, on Dapur Hari ini).** `delivery.cook` is the kitchen's "Mulai masak" ("Start cooking") tap for one meal of one day. It takes `{catererId, date, meal}` and works for the owner and staff of that caterer only, and only for today in Asia/Jakarta: another date returns `INVALID_DATE`, a missing or extra key returns `INVALID_INPUT`, a signed-out caller gets `UNAUTHORIZED`, and any other signed-in user gets `FORBIDDEN`. It moves that caterer's meals of that day and meal that are still `scheduled` to `preparing`, stamps `cooking_started_at`, and returns `{moved}`; the day itself moves to `preparing` only if it was still `scheduled`. A second press, or a press after "Berangkat antar", returns `{moved: 0}`, keeps the first stamp and never moves a status backwards or pulls a day back from out for delivery. Repeating a request id returns the first answer; the same id with other input is a `CONFLICT`. Cook takes the caterer lock and then the day and meal locks in the same order as depart, so the two cannot interleave. The Dapur button, its confirmation and its copy are on Dapur Hari ini (see Dapur footer action).
- **Cooking is a kitchen tap, and it sends no push.** The cooking time is written by `delivery.cook` and by nothing else, so a cooking time exists only because the kitchen tapped "Mulai masak". A meal that the older batch status command moved to `preparing` has no cooking time. Cooking is not on the immediate-push list (ruling C2, see the Phase C rulings): each customer with a moved meal gets one realtime event row, so an open app reads again, and nothing else is sent. "Berangkat antar" keeps its push. The plate already says "Sedang dimasak"; the Beranda hero shows the "Dimasak" journey caption and the track (Task 6), and the Dapur count card shows both (Task 8).
- **Cooking is not a production change.** The production signature that decides whether the kitchen is warned "production changed" reads `preparing` as `scheduled` and ignores the cooking time, who confirmed arrival and the day's version, so tapping "Mulai masak" never raises the warning. A move to out for delivery is not masked and still raises it, and a real change to the address, date, portions or menu still counts.
- **What the delivery read adds.** Each meal of the delivery read now carries `cooking_started_at` (a time or null) and `confirmed_by` (`customer`, `auto`, `caterer` or null). The domain code reads both (see "Plate, track and story data (Phase C)" under Native mood and theme); the Dapur count card and the Beranda hero's track show the cooking time in their caption ("Dimasak 08.10") and, when the system closed the meal, "Tercatat sampai".
- **Kitchen session (rule built in the domain, on Dapur Hari ini).** One meal of the day, as Dapur runs it, is one session over that day's deliveries that serve the meal. Rows marked "Gagal diantar" and cancelled rows are left out, and with no row left there is no session. The session's stage is its least advanced row: with one stop already left and the rest scheduled the session is still scheduled, so the rule still allows "Mulai masak" and the session's journey caption stays true. The cooking and departure times are the earliest of the rows. "Mulai masak" is offered on today only, while any row is scheduled. "Berangkat antar" is offered on today only, once no row is scheduled and some row is cooking. A session reads as recorded by the system only when every delivered row was closed by the system. The portions, addresses, cooking recap and stops all come from the same rows, and each recap dish carries its photo, or an empty string. The day is finished only when it is today, it has a row, every row is delivered or marked "Gagal diantar", and no report for that date is still open. The "Buka semua di Peta" link opens at most the first ten stops in route order, the last as the destination and the others as waypoints; a stop with no address takes no place among the ten.
- **Dapur Daftar masak.** On Hari ini, until the meal leaves, "Daftar masak" lists one row per dish of the session's cooking recap, never an invented dish: the quantity (`heading`, tabular), the dish photo or, without one, the sun icon for lunch and the moon icon for dinner, the name, and a round checkbox. The list sits where "Yang dimasak" used to be; "Per paket", the "Menu belum diisi" lines with the owner's "Isi menu", "Bagikan" and "Cetak" are unchanged. They show with the checklist and go with it once the meal is out for delivery (see Dapur order and stage). Under the rows a caption says "Centang hanya catatan dapur, tidak dikirim ke pelanggan." ("Ticks are a kitchen note only and are not sent to customers."). Ticks are a note on this phone only (ruling C11): one SecureStore key per caterer, `runtime.storageKey("ticks.<catererId>")`, holding the ticked dishes by date and meal, never sent to the server. Every write drops the dates before today (Jakarta), so a tick from yesterday is never shown today and is gone after the next tick; tomorrow's ticks are kept. A dish is identified by its category and name, so the same name in two groups is two rows. Ticks never gate an action: "Mulai masak" and "Berangkat antar" read only the session, not the list. Tomorrow shows the same list with no footer action.
- **Dapur footer action.** One sticky action sits in the screen footer, above the tab bar, and follows the day in order: "Mulai masak" while any active row of the selected meal is still scheduled, then "Berangkat antar · {n} porsi" once none is scheduled and some row is cooking. Neither is offered once the meal is out for delivery, on tomorrow, or on a copy kept from before the connection dropped (the existing "tidak ada sinyal" card explains why). Each asks first. "Mulai masak" asks "Mulai masak makan siang?" ("makan malam" for dinner) with "Pelanggan melihat status Dimasak." and the buttons "Batal" and "Mulai". "Berangkat antar" asks "Berangkat antar sekarang?" with "Pelanggan yang memakai aplikasi Catera dapat notifikasi saat kamu berangkat." and the buttons "Batal" and "Berangkat" (ruling C5: the line carries no number, because the push reaches only customers with an account and the kitchen cannot count them). The same line is the footer caption above the "Berangkat antar" button. Confirming sends `delivery.cook` or `delivery.depart` with the caterer, today's date and the meal, plays the `success` haptic and counts `cook_started` or `depart_tapped`. While the command runs the button is busy and a second press sends nothing.
- **Dapur action failures.** A failure is one plain line above the button, in the danger ink and selectable. A date that is no longer today reads "Hanya bisa untuk hari ini." ("Only possible for today."); any other code goes through the app's error text, falling back to "Belum berhasil. Coba lagi."; the day is read again after any failure. A late tap that changed nothing (the database answers `{moved: 0}`) plays no haptic and counts nothing; the line reads "Sudah ditandai dimasak." ("Already marked as cooking.") or "Sudah ditandai berangkat." ("Already marked as out for delivery."), in the normal caption ink.
- **Dapur Urutan antar.** On Hari ini and Besok the session card ends with "Urutan antar" ("Delivery order"): the session's stops in route order. A row marked "Gagal diantar" or cancelled is not in the list, because the list is the session's own stops. Each stop is a `StopRow`: its number in a sage circle, the customer's name in bold and, on the same wrapping line, "{n} porsi · {package}", then the address on one line in Muted (line and area, for example "Jl. Melati 5, Tebet"). Only the address is held to one line; the whole address is in the row's spoken label ("1. Bu Sari Wulandari, 2 porsi · Makan Siang Rumahan, Jl. Melati 5, Tebet"). A stop's delivery note sits under its row, indented to the name, in sunrise ink, and wraps. The first three stops show; "Lihat {n} alamat lainnya" ("Show {n} more addresses", "Show 1 more address") reveals the rest and does not fold them back. Rows are separated by a hairline.
- **Dapur stop buttons.** Each row has a 48dp map button, labelled "Buka peta {name}", that opens that stop's maps link. A row also has a 48dp "…" button (ruling C7) only when its sheet would send something: a move ("Pindah tanggal", while the delivery can still be moved), or, on Hari ini, a "Gagal diantar" report while the stop's meal can still fail (it is not yet delivered or failed). A delivered stop has no "…" button, and a failed stop is not in the list. The button opens the existing exception sheet for that stop, and its name says what the sheet can do, followed by a colon and the customer's name, like the map button, so a screen reader hears which stop each button belongs to: "Laporkan masalah atau pindah hari: {name}" ("Report a problem or move the day: {name}") when it offers both, "Laporkan masalah: {name}" ("Report a problem: {name}") when it can only report (the change deadline has passed, the package has fixed dates, the customer is not on this kitchen's list, or the day is no longer scheduled), and "Pindah hari: {name}" ("Move the day: {name}") when it can only move, which is the only form on Besok. The sheet offers "Gagal diantar" only when that report has steps to send, and never closes as if saved when nothing was sent: with no choice to offer it says "Tidak ada yang bisa dilaporkan untuk alamat ini." ("There is nothing to report for this stop.") and "Simpan laporan" stays disabled. A copy kept from before the connection dropped shows no "…" button, because it cannot be acted on. There is no per-stop tick: arrival is recorded automatically.
- **Dapur Buka semua di Peta and WhatsApp.** Under the list, "Buka semua di Peta" ("Open all in Maps") opens one Google Maps directions link for the whole route, the last stop as the destination and the others as waypoints (ruling C8). With more than ten stops the link takes only the first ten and the button reads "Buka 10 alamat pertama di Peta" ("Open the first 10 addresses in Maps"); a stop with no address takes no place among them, and when stops without an address leave fewer than ten in the link, the button reads "Buka semua di Peta". It is a secondary button above "Bagikan rute ke WhatsApp", which is the primary button and is unchanged: it shares the route as WhatsApp text, and for a long route the next press reads "Bagikan bagian {n}" and shares the next part.
- **Dapur order and stage.** While the meal is scheduled or cooking (ruling C6), the delivery order sits in the same card below the checklist, after "Per paket", "Bagikan" and "Cetak", so a stop can still be reported or moved before the meal leaves. Once the meal is out for delivery, or has arrived, the cooking part goes ("Per paket", "Daftar masak", the "Menu belum diisi" lines, "Bagikan" and "Cetak"), the order stands alone under the meal's name and the footer action is gone. While the meal is out for delivery, the header's meta line reads "{kitchen} · Sedang diantar" ("{kitchen} · On the way") in place of "· Hari ini" and the count card's track reads "Berangkat {HH.MM}". Once it has arrived, the header goes back to "{kitchen} · Hari ini" and the track reads "Sampai", or "Tercatat sampai" when the system closed the meal. On Hari ini, under the order, one line in the caption style says "Pengantaran tercatat sampai otomatis, kecuali kamu laporkan masalah di alamatnya." ("Deliveries are recorded as arrived automatically, unless you report a problem at the address."); it names the "…" button's job (ruling C7) and is not shown on Besok or on a copy kept from before the connection dropped. When the session's stage changes the body fades in over 220ms (`content`, through `FadeSwap`; instant under reduced motion), as it already did for a change of day or mood.
- **Dapur Semua beres.** When the day is finished, the body shows a sage card in place of the session card or the no-session card: a check mark, "Semua beres hari ini" ("All done today"), a line of outcome and a "Lihat besok" ("See tomorrow") button that switches the date to tomorrow. The day is finished by the domain rule (it is today, it has at least one non-cancelled row, every such row of both meals is delivered or marked "Gagal diantar", and no report for today is still open, whether new, answered or anything short of resolved). The outcome line is "Semua antaran tercatat sampai." ("All deliveries recorded as arrived.") only when no row was marked "Gagal diantar". Otherwise it counts both from the real rows of both meals: "{d} tercatat sampai, {f} ditandai Gagal diantar." ("{d} recorded as arrived, {f} marked as failed."), so a day with failures never reads as clean. The card is not shown on Besok, on a copy kept from before the connection dropped, while the customer reports could not be read (a failed read could hide an open report), or while the report list is still loading. A report still open keeps the sessions on screen. A meal whose rows all failed keeps its own card, "{n} antaran makan {siang|malam} ditandai Gagal diantar.", which the done card would otherwise cover; the other meal can still show the done card, counting every row. The header and the count card stay as they are.
- **Dapur Menu.** The header carries the week range and a day strip of 64-high buttons (weekday, date, a check when that day's menu is filled; six or seven delivery days wrap, never stretch). A dish without a photo shows a dashed camera tile and a "Tambah foto" pill with a spinner and "Mengunggah..." while a photo is on its way. "Tambah foto" saves the photo on that day's menu item only, never the library dish (B4), and is offered only on days an owner can still edit. A closed day reads "Sudah lewat batas ubah", muted, when it has no dishes; a past day reads "Lewat". "Ubah menu" is hidden for closed days. A preview card shows the cover customers will see, only when the day has dishes.
- **Headers on other screens.** Customer PackageDetail with a photo keeps the photo as its header (B3: it gets no `MoodHeader`); every other screen gets a `MoodHeader`, either through `AppHeader` or its own. The claim states are titled "Tautan tidak bisa dipakai" ("This link can't be used") for a dead link and "Belum bisa memuat" ("Couldn't load yet") when offline, and "Membuka tautan" ("Opening the link") while loading; the Catera wordmark stays in the body, never on the header fill. The "sign in first" header (`SignInFirst`) appears on the two tab roots only, Akun and Jadwal; pushed screens keep their own header. The failure screen of the Dapur `ScreenGuard` keeps no header of its own because its only host sits under a mood-filled `AppHeader`.

### Sheets and keyboard

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
- **RantangTrack** shows a meal's journey: a caption above, a line with three stops (kitchen, road, door), a 24dp lunchbox marker above the current stop, and three stop labels below. The marker is an outline while the meal is scheduled and tinted from cooking on. It sits at the kitchen stop for scheduled and cooking, halfway for out for delivery and at the door for arrived. It reads the mood's hero inks (ruling C14, see the Phase C rulings): `heroText` for the marker, the progress line, the stops reached and the caption, `heroMeta` for the stops not yet reached, the rest of the line and the stop labels. Both measured at least 4.5:1 on the hero in all four looks, so it needs no new token, and it belongs only on a surface that carries hero inks (the Beranda hero card, the Dapur count card). A screen reader hears the caption as one element; the three stop labels are decoration and are hidden.
- **StoryViewer** is a full-screen story on black in every theme, so its inks are the fixed light inks, like the story cover. It has one bar per part (the bars up to the current part are solid), a header line beside a 48dp close button, and the current part below, which the caller supplies. The content is one press target. A tap (the finger moved no more than 10dp on either axis) is split at half the window width at the lift point: left half back, right half forward. A sideways swipe of more than 40dp, mostly sideways (the horizontal move more than 1.5 times the vertical one), turns the page in the story convention (right to left forward, left to right back). Any other drag does nothing, and a button inside the content keeps its own press. Controller ruling: this tap region is an accepted exception to the rule above that every tappable gives press feedback and that no raw `Pressable` is used. It is a plain `Pressable` with no press style, and its feedback is the page turn itself, the new part fading in over 220ms. The first part has no back and the last has no forward, so a tap on the left of the first part or on the right of the last part, a left-to-right swipe on the first part and a right-to-left swipe on the last part do nothing and give no feedback at all. Screen readers get the header as an adjustable with increment and decrement actions that move between parts, and the close button; the accessibility escape action closes the story. A part must fit the screen: the photo flexes and long text wraps. The viewer wraps the part in a view that fills the content region (`FadeSwap` takes an optional style and the viewer passes `{ flex: 1 }`), so a part's own `flex: 1` fills it; other users of `FadeSwap` keep a wrapper that sizes to its content.
- **CheckRow** is one line of the kitchen's checklist, and the whole row is the button, at least 56dp: the quantity (set as `heading` with tabular figures), a 44dp dish photo or, with no photo, the meal icon (sun for lunch, moon for dinner), the dish name, and a 48dp round box. The name wraps and is never truncated. The box has the control ring and fills forest with a cream check when ticked. A ticked row keeps its text at full opacity: the name turns `muted` and is struck through, the quantity turns `muted`, and only the photo or icon dims to 0.55. It is a checkbox with its state, labelled with the quantity and the dish ("8× Ayam bakar"), and presses with a `tap` haptic.
- **StopRow** is one stop of the delivery order: its number in a 28dp sage circle, the name in bold followed by a detail on the same wrapping line, and the address on one line in Muted. Within this row the address is the only text held to one line, so a long address cannot push the buttons off screen. The full address is in the accessibility label of the text block. A 48dp map button always shows; a 48dp "…" button for other actions shows only when the caller has some.
- **StickyAction** is the one action a screen is for: an optional caption line above a full-width primary button. Callers put it in `Screen`'s `footer` slot, so the page scrolls above it and it never covers content; the footer already supplies the 16dp padding, the top border, the surface fill and the 760dp cap, and StickyAction adds none of its own. While busy it swaps the label for a spinner and ignores presses; the button keeps its label as its accessible name. While disabled it ignores presses.

### Usage counts (Phases C and D)

Both native apps count how often a few events happen, to learn whether the daily loop and the purchase and renewal beats are used, and keep no personal data with the count. A count is one row per Jakarta day, app (`customer` or `dapur`) and event name, holding how many times it happened. The table has no user, caterer, device, session or request column, and the apps cannot read it back. Only a signed-in app can add to it. The names are fixed in one allowlist: `app_open`, `tomorrow_story_viewed`, `journey_viewed`, `plan_sheet_opened`, `renew_started`, `purchase_confirmed_viewed`, `cook_started` and `depart_tapped`. All eight are sent: `app_open`, `tomorrow_story_viewed` (the Menu besok story), `journey_viewed` (the Beranda hero), `cook_started` and `depart_tapped` (Dapur Hari ini), and from Phase D `plan_sheet_opened`, `renew_started` and `purchase_confirmed_viewed`. `plan_sheet_opened` is counted once per plan detail open, and only when a plan is shown, never for its loading, error or not-found states (`apps/customer/src/plan/PlanDetail.tsx:86-92`). `renew_started` is counted on each "Lanjutkan paket" tap on the plan detail and on the "Paket selesai" recap; the trial's "Lanjutkan dengan paket penuh" counts nothing (`PlanDetail.tsx:134-147`, `apps/customer/src/today/RecapCard.tsx:78-84`). `purchase_confirmed_viewed` is counted once per checkout id per app process, through a module-level `Set`, for the paid beat only and never while the payment is still being checked (`apps/customer/src/buy/PaidOutcome.tsx:12-13, 43-47`). Evidence: `plan.test.tsx` "counts plan_sheet_opened once per open, however often the screen renders" and "a plan in a status the screen does not know reads as not found and goes home"; `recap.test.tsx` "Lanjutkan paket opens the renewal and counts renew_started on each tap"; `buy.test.tsx` "counts purchase_confirmed_viewed once per checkout id, however often it is opened" and "does not count purchase_confirmed_viewed while the payment is still being checked". `app_open` is counted at most once per Jakarta day: the day is kept on the device and in memory and is stored before the request goes out, so a restart, a return to the foreground or a failed request on the same day does not count again, and the first open after midnight in Jakarta counts. Counting never blocks the app. Sending returns at once, does not wait for the answer, never retries, swallows every failure without logging it, and does nothing when nobody is signed in. A count lost to a bad connection is accepted. No count appears in any screen or copy. The behaviour is covered by tests; no emulator or device check was made.

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
  - **D1. The plan detail is a pushed screen, not a sheet,** with `MoodHeader` and `onBack`, because notification links and push taps open it cold. Built (see Plan detail).
  - **D2. Remaining days stay plain:** "{n} hari lagi" from `remainingLabel`, no ring, bar or streak. Built in the plan detail hero.
  - **D3. "Lanjutkan paket" rules,** with controller ruling P2: a trial offers "Lanjutkan dengan paket penuh" only while no later non-cancelled plan for the same package exists, so no duplicate purchase is invited. Built (see Plan detail, Footer action).
  - **D4. The recap shows for a completed full plan that ended within the last 14 days, has no renewal and has no `recap.{id}` key,** written when the card first renders. Built on Beranda (see "Paket selesai" recap).
  - **D5. The recap shows no meal count,** because the read cannot count an old plan's delivered meals truthfully (R-17). Built.
  - **D6. The reserved dates on the paid screen wrap:** the first 6 sorted dates, then "dan {n} hari lainnya", with no horizontal scroll. Controller ruling (Task 5): they are plain tags, not chips (see Chips / Status).
  - **D7. Paid screen actions:** "Lihat jadwal", "Pilih menu" when the customer picks the menus, and "Ke Beranda", each a `router.replace`. Built.
  - **D8. The `success` haptic fires only when the stage changes to paid while the screen is open.** Built (see Native motion).
  - **D9. Demo states for Nadia Putri and Dapur Senja, built from the demo database's creation day.** Controller rulings (Task 1): only on a demo seeded in the same call, never on an existing store; the same shapes in memory and stored; no meal closed by the system today. Built (see Demo states).
  - **Controller rulings on review.** A cancelled plan's detail reads "Paket dibatalkan" with its date range, no action and no upcoming list, and any other unknown status reads as not found (Task 3). Paid is final on the iOS edge swipe too, through `gestureEnabled: false` set by the screen while paid (Task 5).

Dials: customer ENERGY 2 / RHYTHM 2 / MOTION 2 and Dapur ENERGY 1 / RHYTHM 1 / MOTION 1 (plus press micro-feedback), unchanged. The identity motif is the day arc and the lunchbox; the one accent is sunrise ink.

### Evidence and limits

Phase B was checked on the Android emulator in Expo Go with the demo backend in four looks. The record, with every capture it cites, the click-through and the font-scale findings, is [antislop audit 003](anti-slop/audit-003-2026-10-09.md). The first pass found three defects (the Dapur demo photo upload, a truncated Jadwal row name and a truncated Dapur tab label at 360dp and font scale 1.3); all three were fixed, re-checked on the emulator and are recorded there. A whole-branch review then raised five Important items, fixed in the final wave and recorded in the audit's final-wave section: an actionable plate hidden behind the mood (the Beranda other-meal row now carries its status sentence), the status band snapping while the header fades (one shared `MoodFill`), `display` on long dynamic titles (the ruling above), the Dapur date button's accessible name omitting its visible date, and duplicated mood code (`MoodFill`, `Button` `ink` and `edge`, `MoodHeader` `onBack`, a `MoodLabelsProvider` that takes the app's `t`). The sixth, the unverified production upload path, stays a release gate. The audit also lists what the demo data could not show (the Beranda departure chip (since removed, Task 6), the Dapur count card with figures in Malam, the Jelajah meal empty state, the claim loading and offline states, the production status bar without the demo strip, the Dapur ExceptionSheet) and the production upload path (prepare, PUT, complete), which is not verified on a device and is a release follow-up. No iOS, physical-device, TalkBack or standalone-build check was run, so this is not a device or release approval. Phase C's daily loop is built and is part of this contract: the rantang track on the Beranda hero and the Dapur count card, the Menu besok story, the Dapur checklist with "Mulai masak" and "Berangkat antar", and the Dapur delivery order and "Semua beres" (see the Phase C bullets under Components and behaviour, the Native motion bullets and Daily-loop components). The record above is Phase B's and does not cover them: none of this is checked on an emulator, an iOS device or a physical device in this file. Phase D's purchase and renewal beats are built and are part of this contract too: the plan detail behind every plan link, the "Paket selesai" recap, the payment success beat and the demo states (see the Phase D bullets under Components and behaviour, Native motion, Usage counts and Demo states). The evidence this file cites for them is the Jest and Vitest tests named beside each rule. Two release items stay open: the iOS edge swipe on the paid screen is checked only through the option value in Jest, and live TalkBack is unverified; neither is verified on a device. "Tercatat sampai" on Beranda is not reachable in production (see Beranda hero track).
