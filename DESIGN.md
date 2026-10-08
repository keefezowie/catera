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

Native inputs have a 48 minimum height, 14 horizontal padding, the Field border (`colors.fieldBorder`, `#CFD3C6`), and the Surface fill; an error turns the border Danger. Field border and Secondary border are tokens in `@catera/design-tokens` (`fieldBorder`, `secondaryBorder`), as is `attentionBorder` (`#F3DFC3`), the warm edge of the cream attention card. Native sources use `colors.*` rather than literal hex values, with named exceptions: the QRIS code's pure-white quiet zone, which scanners need, and translucent `rgba` fills for the sheet scrim, the Plate photo overlays and the step rows on the Dapur setup card. Forms keep error messages near the action; button loading states use a spinner and explicit saving text.

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

**The Truthful State Rule.** Pair state color with explicit text, and make the selected filter and its empty result visible. Unavailable choices carry a visible reason: native delivery-date chips caption a blocked day “Penuh” or “Terisi” instead of only dimming it.

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

### Meal agenda

The next-meal panel pairs a generous photograph with caterer, portions, date, time, address, and action. The adjacent sage agenda splits lunch and dinner into open rows with a meal icon, explicit details, and status. On phone it follows the next meal and precedes subscriptions. The sidecar’s agenda preview represents this existing pattern without introducing a new page layout.

### Customer meal calendar

The web customer schedule uses a continuous meal-coverage strip within a centered 1040px maximum-width column. A compact month control, “Hari ini”, and the next-delivery shortcut lead into the strip; the selected-week summary, “Per hari” / “Mendatang” control, and meal details align below it. Desktop date cells are fixed at 112px wide by 120px minimum height with 12px corners and 44px paging arrows outside the strip. At 650px and below, cells become 92px wide by 116px minimum height, the arrows disappear, shortcuts take a second row, and the summary and details lose their desktop 52px side inset. Horizontal overflow exposes the next partially visible date on phone. These are local calendar rules for the web strip. Native Jadwal adopts only its coverage model: a month grid whose covered days show a sun icon in Sunrise ink (`sunriseInk`) for lunch and a forest moon for dinner, both turning Muted once the meals have arrived, with the same truthful loading and error states; the strip layout, picker and “Mendatang” list are not adopted. The legend uses the same colours, and today is a Sunrise ink ring on cream. Native coverage marks use Sunrise ink rather than Sunrise because Sunrise measured 2.38:1 on the scheduled background and 2.56:1 as the today ring on cream, below the 3:1 minimum for state icons; Sunrise ink reaches 5.73:1 (owner decision, October 8, 2026, recorded under the native revisions below).

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

Controls (buttons, chips, segmented options, stepper buttons, round buttons, stars, reactions, radio picks) use `PressableScale`: they compress to 0.97 on press-in, return on release, and fire a haptic (`tap` for actions, `select` for choices; `success` and `warning` are reserved for outcomes; a disabled control fires none). Tappable rows and cards that open something use `PressableRow`: an instant 0.7 dim while pressed, no scale, no ripple and no haptic, identical with and without reduced motion. No raw `Pressable` remains in native app sources; every tappable gives press feedback. `FadeSwap` fades in new content when its key changes. Pushed screens share the `AppHeader` round back button and one-line heading.

- Choreographed motion belongs to story beats, not to every screen. Native has no sequenced entrance: the former “Cara kerja Catera” steps and their 80ms stagger were removed (owner decision, October 8, 2026), and package detail states package facts instead.
- Never stagger a catalog, any list or any sequence. Navigation, operational rows and money totals stay still.
- Reduced motion (the system setting, read through `useReduced`) replaces scale and movement with opacity-only feedback (pressed controls dim to 0.85) or no motion at all; bottom sheets fade instead of sliding up.
- Animate only transform and opacity.

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
- `Dial (Dapur): ENERGY 1 / RHYTHM 1 / MOTION 1 (+ press micro-feedback)`. Kitchen operations are restrained and denser; rows and money totals stay still, and motion is limited to presses and content fades (the Hari ini / Besok switch).

**The Three States Rule (native).** Every native data screen shows loading text (“Memuat…”), an error message in Danger with a “Coba lagi” action that reloads, and an empty state that says what is missing. Counts and actions that depend on the data stay hidden or disabled until it loads (Dapur Pelanggan filter counts, Menu “Salin minggu lalu” and “Bagikan menu”, Usaha “+ Paket baru”). Dapur uses one shared `ReadError` for failed reads. A font-load failure shows a plain restart message instead of a blank screen.

- **Screen readers.** The `Text` title and heading variants are exposed as headers. A pushed screen has one heading, the `AppHeader` title, with no repeated in-content title. The bottom-sheet scrim is a button labelled “Tutup” / “Close”, and the VoiceOver escape gesture closes the sheet too; a sheet with no title renders no empty heading. Prices are read as text, never as headings. The scrim label and the stepper's decrease and increase labels are translated by the caller.
- **Touch targets.** Every native control is at least 48dp: chips, segmented options, text buttons, stepper buttons, filter chips, review stars, month arrows and icon buttons included.
- **Package detail facts.** Package detail states what a customer can act on: delivery days and windows, the change cutoff (“Ubah hari”, until the cutoff time the day before), the delivery fee, and the earliest bookable start (“Mulai paling cepat”), hidden when nothing is bookable. It has no generic how-it-works steps.
- **Review stars.** Unselected stars are outline icons in Muted; selected stars are filled in Sunrise ink, so the choice never rests on a pale colour alone.
- **Kitchen truth (Dapur).** “Yang dimasak” lists only real dishes. Menu slots nobody has filled read “Menu belum diisi · Makan Siang Rumahan: 2 lauk, 1 nasi, 1 sayur”, one line per package that still has gaps (never summed across packages), and owners get an “Isi menu” link under each line that opens that package in the menu editor. The shared and printed recap carry the same per-package lines. “Bagikan menu” is disabled, with “Belum ada menu untuk dibagikan”, when no day of the week has dishes, and “Salin minggu lalu” is disabled, with “Minggu lalu belum ada menu untuk disalin”, when last week has nothing to copy. A package still running past its booked last day (moved deliveries) shows only its days left (“Sisa 1 hari”), never a past end date. Attention cards on Hari ini that point to a Dapur screen are links with a chevron; a card with no Dapur destination stays plain.
- **Claims.** No unmeasured durations and no unbacked security claims: the payment card says only “Pilih cara bayar di halaman berikutnya.” until the server names its payment provider. Calls to action name their task (“Aktifkan pembayaran”, not “Mulai”).

These revisions were verified on the Android emulator in Expo Go with the demo backend; iOS behaviour (keyboard offset under the demo strip, VoiceOver reach of the sheet scrim) is not yet device-verified.
