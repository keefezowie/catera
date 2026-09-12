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

Ground truth is the [shared tokens](packages/design-tokens/src/index.ts), the complete cascade in [web global styles](apps/web/src/app/globals.css), [web components](apps/web/src/components), [native UI source](apps/customer/src/ui.tsx), and the [brand package](packages/brand/README.md). The frontmatter records reused implemented web primitives; the sidecar adds previews and extensions. This is documentation of the local build, not a release certificate.

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

**Body Font:** the same self-hosted Jakarta face. The variable WOFF2 supports weights 200–800. Native registers the matching bundled variable TTF as `Jakarta`. See the [font provenance](packages/brand/manifest.font.json).

**Character:** rounded, clear interface lettering with firm 750-weight web headings and tighter headline tracking. The illustrated wordmark remains an image asset. Normal UI copy stays sentence case; operational numbers use tabular figures.

### Hierarchy

The frontmatter records the reused base web hierarchy: fluid headline, title, subheading, body, label, button, compact button, and status. Body line-height is spacious relative to the compact label sizes; heading descriptions cap at 65ch and ordinary page headlines at 24ch.

The marketplace’s display headline is a surface-specific expression: `clamp(38px, 4.3vw, 62px)`, weight 750, line-height 1.07, tracking −0.04em. Its cascade resolves to 50px at 1150px, 43px at 800px, and 30px at 560px and below. Keep that ramp local to the hero. Section headings use 26px; package titles use 19px on wide screens, 17px in the intermediate layout, and 22px in single-column phone cards.

Native’s actual reusable source ramp is different from the web and from the exported suggested typography values:

| Native role | Size / line-height | Weight  | Tracking |
| ----------- | ------------------ | ------- | -------- |
| Title       | 30 / 39            | 700     | −0.8     |
| Heading     | 21 / 28            | 700     | −0.4     |
| Body        | 14 / 23            | default | normal   |
| Small       | 11 / 18            | default | normal   |
| Label       | 12 / 23            | 700     | normal   |

These are React Native style values, not measured device pixels. Shared exports currently suggest body 16, small 14, title 24, and heading 32, but the native styles do not consume that scale. Do not claim rendered parity or silently replace the built ramp with those exports.

**The One Interface Family Rule.** Use the self-hosted Jakarta face for interface text. Keep the illustrated wordmark separate from live UI typography.

## Layout

Customer web uses centered containers up to 1320px with 44px wide-screen side padding. Intermediate padding steps are 28px at 1150px and 24px at 800px; phone catalog/content and toolbar/hero use 18px gutters. Reused spacing steps live in the frontmatter, but the CSS also uses observed 18px, 20px, 22px, 26px, and 28px adjustments; this is not an enforced single-grid implementation.

The discovery grid is three columns, two at 800px, and one at 560px. Cards retain generous food images rather than shrinking into tiny tiles. A split forest-and-food hero remains split on phone through the final cascade. The phone sparkle is hidden to preserve headline clearance. The surface brief owns this composition.

Customer home places the next meal beside the lunch/dinner agenda in a 1.5:1 grid, changing to 1.4:1 at 1150px and one column at 800px. Items align at the start; the meal card does not stretch to unrelated content. Flat subscription rows follow the meal and agenda; the home-specific subscription override remains flat at all widths.

Seller and admin workspaces use separate navigation on a 244px sidebar, narrowed to 215px at 1150px. At 800px it becomes a 250px off-canvas drawer. Operational content has a 1600px maximum width and 34px initial padding. Tables retain horizontal overflow where necessary. Compact phone metrics form two columns; master/detail work exposes the selected item’s detail in the available width.

Desktop customer navigation hides at 800px; the fixed five-destination customer bottom navigation is enabled at 560px, including safe-area padding. Do not infer a bottom bar at all tablet widths. Native uses five customer destinations, safe-area containers, keyboard avoidance, a scroll page capped at 760 with 22 padding, and platform navigation controls.

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

Primary hover uses forest-hover; secondary hover uses sage; cream hover uses `#FBE6C8`. Global keyboard focus is a 3px Focus outline with 4px offset. The shared focus export contains an offset of 3, but the built web CSS uses 4px. Disabled controls have 0.5 opacity and no pointer interaction. Native buttons have a 48 minimum height and 13 vertical / 17 horizontal padding.

### Inputs / Fields

Quiet near-white fields have a light stroke, rounded corners, and a 44px web minimum height. The generic input inherits body type; inputs inside the existing field wrapper inherit its 12px size. Labels use forest. Input and textarea placeholders use the current Muted token. Search has a 2px forest focus-within outline with a 2px offset and suppresses the inner input outline to avoid a double ring. Ordinary fields retain global keyboard focus.

Native inputs have a 48 minimum height, 13 padding, a `#C9D2BE` border, and `#FFFEF9` fill. Forms keep error messages near the action; button loading states use a spinner and explicit saving text.

### Date picker

Web date fields use the shared `DatePicker` component instead of the browser-native date control. Its anchored popover uses a Monday-first month grid, Indonesian-first month and weekday labels, explicit previous/next-month controls, a “Hari ini” shortcut, min/max date constraints, and complete arrow-key, Home/End, and Page Up/Page Down navigation. The compact variant belongs in operational toolbars; the standard variant fills a form field and submits an ISO `YYYY-MM-DD` value through its `name` prop. Keep date selection in this component so browsers do not introduce a second visual language.

### Chips / Status

Meal filters are outlined 44px-minimum controls, filled forest with cream text when selected. Native chips have a 48 minimum height. Queue filters visibly name “Semua katerer” and “Menunggu tinjauan”; the pending-empty view states the absence of work and directs the user to all caterers.

Statuses are compact, rounded text tags with a small dot and semantic tone. They are read-only indicators, not pills that replace action controls.

**The Truthful State Rule.** Pair state color with explicit text, and make the selected filter and its empty result visible.

### Cards / Containers

Package cards combine food, caterer identity, explicit terms, price, and action. Their body padding is 20px on wide screens and phone, 16px at the intermediate breakpoint. The image hover is restrained; card boundaries remain light. Operations panels use 24px padding and 12px corners with no ordinary raised shadow.

Customer-home subscriptions are flat rows inside one outlined container, with separators and small food thumbnails. That rule belongs to the home hierarchy; other subscription/detail surfaces retain their existing bordered cards where present.

### Navigation

Customer desktop navigation is compact, with a sunrise dot at the selected link. The phone bar has five labeled destinations; selected labels and icons become stronger forest. Operations use their own sidebar with a forest selected row, quiet hover, and a labeled workspace identity. Use consistent SVG interface icons; supporting brand illustrations do not replace operational icons.

### Meal agenda

The next-meal panel pairs a generous photograph with caterer, portions, date, time, address, and action. The adjacent sage agenda splits lunch and dinner into open rows with a meal icon, explicit details, and status. On phone it follows the next meal and precedes subscriptions. The sidecar’s agenda preview represents this existing pattern without introducing a new page layout.

### Customer meal calendar

The web customer schedule uses a continuous meal-coverage strip within a centered 1040px maximum-width column. A compact month control, “Hari ini”, and the next-delivery shortcut lead into the strip; the selected-week summary, “Per hari” / “Mendatang” control, and meal details align below it. Desktop date cells are fixed at 112px wide by 120px minimum height with 12px corners and 44px paging arrows outside the strip. At 650px and below, cells become 92px wide by 116px minimum height, the arrows disappear, shortcuts take a second row, and the summary and details lose their desktop 52px side inset. Horizontal overflow exposes the next partially visible date on phone. These are local calendar rules; Expo adoption is deferred.

Today uses Jakarta's calendar date with a Sunrise dot and accessible dark-orange “Hari ini” label; selection uses a two-pixel forest ring without replacing coverage. Empty days remain transparent, while any covered day uses the quiet scheduled background. Covered cards use Sunrise sun and forest moon icons as their sole visual coverage cue, with both icons shown when both meals are covered; the former footer rail is removed. The package count sits alongside the icons, while the complete button description still names lunch and dinner for assistive technology. “Belum ada makan”, loading, and error remain visible text states and never claim coverage or a package count. Coverage counts each meal once per day, regardless of portions or multiple caterers; delivered meals count and cancelled meals do not. The summary names the Monday–Sunday week containing the selected date and counts covered lunch and dinner days separately.

Scrolling, paging, and extending the bounded 151-day strip preserve selection; extending its window preserves the first visible date and pixel offset. Clicking a visible date updates its details without repositioning the strip. The month label follows the visible range. Only explicit today, next-delivery, or picker jumps move the strip and selection together. Keyboard focus remains visibly outlined, and navigating focus does not select a date until activation.

The calendar's month control opens its own centered, lightly dimmed popover: a Monday-first six-week grid, previous/next month and year buttons, and an ISO `YYYY-MM-DD` text field with a “Lihat” submit action. The field is a text input; submission is enabled only for a valid supported date. The grid has one roving Tab stop: arrows move one day or week, Home/End move to the week's boundaries, Page Up/Down change month, and Shift with Page Up/Down changes year. Tab then reaches direct date entry; closing or selecting restores focus to the month control. Picker days have a 44px minimum height; at 380px and below the grid removes gaps and uses the available panel width. This dedicated coverage-calendar picker is separate from the shared form-field DatePicker described above.

Monthly loading and failures remain visible as ellipses or error marks with accessible state text; unknown data never appears as an uncovered meal. Incomplete week data produces a loading or unavailable summary, and failed required months expose “Coba lagi”. The day view retains cancelled entries and groups food-thumbnail delivery links under lunch and dinner headings, showing caterer, package, portions, address label, and status. “Mendatang” lists dates chronologically from today, then lunch and dinner, omits delivered/cancelled fulfillments, and offers another month until the final upcoming delivery. Its empty state appears only when the requested months are loaded. The surface reuses existing food images and identity; it introduces no new artwork. The behavior contract and release evidence live in [the meal-calendar record](docs/MEAL-CALENDAR.md).

### Brand artwork and image truth

The [brand manifest](packages/brand/manifest.brand.json) records sixteen separately generated PNG compositions: mascot, wordmark, horizontal and stacked lockups, two monochrome interpretations, app icon, adaptive foreground composition, five supporting symbols, and three state illustrations. The reference board supplied identity guidance only and is not a runtime asset.

The delivered square masters are 1254 × 1254; wordmark and horizontal lockup are 2172 × 724. All sixteen are RGB with opaque cream or forest mattes and slight generated tonal variation. The current wordmark styling uses multiply blending; that does not create an alpha channel. Real transparency, the requested 2048/4096 master targets, and completed adaptive foreground derivatives remain unfinished. Preserve originals and record any future approved derivatives separately.

The six [synthetic food images](packages/brand/manifest.food.json) are 1448 × 1086 at 4:3. They serve explicitly labeled demo listings. Production sellers supply their own food images. Do not claim that generated food establishes a real seller’s meal or endorsement.

The [finish verdict](output/V1-FINISH-VERDICT.md) resolves four bounded web findings using the existing desktop, tablet, phone, and viewport captures in `output/visual-review/`, including `admin-pending-empty.png`. Overall disposition remains **fix** for unfinished transparent artwork; high-resolution master acceptance also remains open in the asset manifest. Native source now gives quantity/compare controls 48 × 48 and chips a 48 minimum height. No native device visual approval, gesture/large-text/dark-appearance approval, push verification, or return-link certification is supplied by this documentation.

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
