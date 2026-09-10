---
name: Catera
description: Good Food on Repeat.
colors:
  forest: "#163d2e"
  cream: "#fff7e9"
  orange: "#f47b2a"
  ink: "#2e2e2e"
  muted: "#65736b"
  line: "#e1e7e1"
  surface: "#fff"
  canvas: "#f8faf7"
  sage: "#edf3ec"
  danger: "#a72d2d"
  scheduled-bg: "#eff2e9"
  scheduled-ink: "#556347"
typography:
  headline:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "32px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  subheading:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.55
  body:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.55
  button:
    fontFamily: 'Arial, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  field: "7px"
  control: "8px"
  surface: "12px"
  dialog: "14px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "26": "26px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-cream:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.forest}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  nav-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  status-scheduled:
    backgroundColor: "{colors.scheduled-bg}"
    textColor: "{colors.scheduled-ink}"
    rounded: "5px"
    padding: "4px 7px"
  list-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

# Design System: Catera

## Overview

**Creative North Star: "Delivery cycle"**

Catera is warm, calm, and organized recurring-catering software. Its approved bento mascot and rounded wordmark supply the personality; quiet surfaces and a compact sans-serif hierarchy keep daily work legible. Indonesian is the primary interface language, with English supported. Preserve the exact name and tagline, “Good Food on Repeat.”

This records the implemented interface as of 8 September 2026. The visual source of truth is [the global stylesheet](src/app/globals.css), including its final cascade overrides, and [the components](src/components/). The approved identity is [the original brand board](public/brand/catera-board.png); the inherited direction is [the implementation contract](docs/UI-BRIEF.md). [PRODUCT.md](PRODUCT.md) and [the shape brief](Catera-Shape-Brief.md) retain approved product context; subsequent policies live in [the implementation record](docs/IMPLEMENTATION.md). This document describes visual behavior, not hosted or production readiness.

**Key Characteristics:**

- Forest actions and emphasis on a pale canvas, with cream and the original artwork adding warmth.
- Operational typography, explicit status text, and tabular numbers.
- Open lists and light borders; raised layers are reserved for overlays and save feedback.
- Responsive detail views preserve the context needed to act.

## Colors

The palette combines deep botanical green, warm paper, orange artwork accents, and charcoal text; the frontmatter holds the normative values.

The companion [.impeccable/design.json](.impeccable/design.json) adds component previews, motion, breakpoints, and elevation metadata. Its synthesized tonal strips are display aids for the design panel, not additional colors implemented by the application.

### Primary

- **Forest** powers primary actions, selected desktop navigation, headings, and the subscriber's next-delivery panel.
- **Sage** supports hover surfaces and informational notices without competing with the primary action.

### Secondary

- **Cream** warms the sign-in story and provides the light action treatment inside the forest delivery panel.
- **Orange** is a declared approved brand color carried by the supplied artwork. It is not an established large interface fill or an error color.

### Neutral

- **Ink** is the normal text color; **muted** is secondary operational copy.
- **Canvas** sits behind white **surface** containers; **line** separates rows, navigation, and forms.
- The sidebar has a slightly warmer paper surface than the main canvas. Keep this tonal distinction subtle.

### Named Rules

**The State Has Words Rule.** Status color accompanies readable text. Preserve the distinction between neutral scheduling, green readiness/completion, amber delivery activity, warm failure, and gray cancellation.

The shared scheduled/pending background and final text override are recorded in the frontmatter. Other state-specific tints stay with their component CSS rather than becoming a general brand palette. Error feedback uses danger text and a pale warm background; it remains distinct from the decorative orange accent.

## Typography

**Body and operational heading font:** Arial, followed by Segoe UI and sans-serif. This user-approved system stack is an operational choice, not a replacement for the artwork's wordmark. No separate display or mono family is established.

The hierarchy is compact and practical rather than a mathematical scale. The frontmatter records recurring default roles: page headline, section title, subheading, body, compact body, field label, and button. Paragraphs use a more open line-height (1.65); supporting page descriptions stay within a readable measure (70ch), with menu descriptions capped at 65ch. Tables and quota totals use tabular numerals.

Page headlines step down at the existing responsive boundaries: 28px at widths up to 1200px; subscriber headings use 29px on desktop and 26px on small screens. Specific meal names and detail titles have their own source styles; do not treat every local heading size as a new system role. CSS weights such as 550 and 650 are requested values; available system fonts determine their actual rendered face.

**The Operational Type Rule.** Use the shared sans-serif roles for interface content and the supplied raster artwork for the brand wordmark. Keep status labels and customer names legible when the layout narrows.

The final small-screen overrides raise customer names to 13px and status labels to 12px at widths up to 800px. Some secondary captions and desktop status labels remain 9–11px in the source. Those small values are an incumbent density caveat, not a general-purpose microtype scale for new surfaces. The one-off large sign-in headline is also excluded from the reusable display system.

## Layout

Desktop admin layout uses a fixed sidebar (232px) with a main column offset by the same amount, a top bar (76px), and a centered content region capped at 1560px. Default main padding is 36px 38px 60px; widths from 1500px increase that to 44px 55px 70px. At 1200px and below the sidebar becomes 210px and horizontal content padding becomes 25px.

At 800px and below, the sidebar becomes an off-canvas drawer (245px), the main column fills the viewport, and the top bar becomes 62px. Main content uses 20px horizontal padding; headings, tools, and actions wrap. Delivery lists remove the secondary menu and delivery-window columns, keeping customer, status, and detail access. Detail content remains available through the record view. Package and account grids become a single column; two-field form rows remain two columns in the present implementation and need checking with long labels.

The subscriber content column is capped at 720px on desktop and 520px on small screens. On phones, a fixed four-destination bottom navigation occupies 72px and includes safe-area padding; main content reserves bottom space. At 370px and below, horizontal gutters narrow further and nonessential visual details disappear.

Spacing uses repeated small control gaps and larger section gaps, with the recurring steps in the frontmatter. Do not force every existing padding value onto an invented uniform scale. Reference [desktop](.impeccable/review/desktop.png), [subscriber phone](.impeccable/review/mobile.png), [tablet](.impeccable/review/tablet.png), and [admin phone](.impeccable/review/admin-mobile.png) review captures for the implemented density. These are synthetic local previews.

The selected date and Schedule → Production → Delivery navigation are the approved operational composition. Preserve one active stage at a time on narrow screens. Full screen composition remains in [the UI brief](docs/UI-BRIEF.md), not a new universal dashboard template.

## Elevation & Depth

At rest, the interface uses white surfaces, pale canvas, and thin borders. Lists and ordinary cards have no shadows. Overlay scrims separate temporary work from the background; dialogs and the delivery drawer receive soft shadows. Save feedback uses a smaller shadow.

### Shadow Vocabulary

- **Dialog:** `0 16px 55px #163d2e24`, from the shared shadow custom property.
- **Delivery drawer:** `-6px 0 35px #14382620`, separating the side detail from its list.
- **Save feedback:** `0 4px 16px #163d2e22`, making the fixed confirmation visible.

**The Temporary Layer Rule.** Keep ordinary data surfaces flat. Use the existing soft elevation treatments for temporary overlays and confirmation feedback.

Controls transition color and background over 180ms. The drawer enters over 200ms, overlay opacity over 180ms, and mobile navigation over 200ms. Reduced-motion preference removes animations and transitions. Loading skeletons pulse only while representing loading; do not borrow that motion for decoration.

## Shapes

Controls have gently rounded corners, with shared field and button radii recorded above. Ordinary containers use the shared surface radius; dialogs use the shared dialog radius. Status labels are compact rounded rectangles rather than pills. Circular forms identify people, status dots, and timeline points. Thin separators structure tables and detail sections without boxing every item into a card.

The original artwork is displayed through CSS background crops. Reuse the final logo and mascot rules from the stylesheet; earlier declarations are overridden later in that file. The standard logo includes the artwork's tagline. Do not replace the board with typed text, an emoji, or a redrawn mascot, and do not crop away the wordmark or tagline when changing its container.

## Components

### Buttons

Compact, explicit actions. Primary is forest with white text; secondary is white with a pale border and forest text; ghost is transparent; cream belongs on forest surfaces. The shared padding and radius are in frontmatter. Minimum height is 40px, raised to 44px at widths up to 800px. Primary hover lightens forest; secondary and ghost hover use sage; cream hover warms. Disabled buttons reduce opacity and show a not-allowed cursor.

Global keyboard focus uses a warm outline (3px, offset 3px). The sidecar preserves exact hover, focus, and motion CSS. Icon buttons have visible hover/focus states and accessible labels; their current 36px square size is recorded as implementation context, not as a blanket touch-target guarantee.

### Status Labels

Quiet colored rectangles with a small circular dot and translated status words. These are descriptive labels, not interactive filters. The shared scheduled/pending styles and responsive legibility override are represented in the sidecar. State labels must remain meaningful without their color.

### Cards / Containers

Lists, production views, package definitions, profile forms, and detail surfaces use white backgrounds with light borders and the shared surface radius. Toolbars and content have their own internal padding; an ordinary list container has no universal padding because rows and toolbar own their spacing. Hover highlights belong to actionable rows, not to every surface. The forest subscriber delivery panel is the major tonal exception and keeps its light content and cream action.

### Inputs / Fields

Visible field labels sit above white controls. Inputs, selects, and textareas share the field radius, thin pale border, 13px text, and a minimum height of 41px. Textareas resize vertically. Search combines an icon and field in one outlined container and uses a distinct focus-within outline. Error messages are textual alerts below the relevant form content. Submission state changes the button label and disables repeated submission; there is no separate established visual disabled-field system.

### Navigation

Admin navigation pairs outlined SVG icons with sentence-case labels, separates operations from business records, and fills the selected desktop item in forest. Hover is a pale surface shift. On subscriber phones, labels move below their icons; the current destination uses stronger forest text and icon stroke instead of a filled background. Keep `aria-current` on the current page.

### Delivery Cycle and Detail

Stage links use a thin forest underline for the active stage and small count badges. They preserve the selected date. A delivery opens in an adjacent desktop drawer (470px), becoming full-width on small screens, or in the standalone detail route. Menu, address, cutoff, actions, and history appear as separated sections. Form dialogs use explicit review and confirmation with pending and error feedback. Opening a view is never a fulfillment action.

### Quota and Agenda

Quota totals use three aligned numeric columns and fine separators, retaining the distinction between remaining, reserved, and available deliveries. The agenda uses open rows with a compact date block, readable meal or missing-menu text, and a detail affordance. Retain these concrete operational meanings instead of turning them into decorative metrics.

## Do's and Don'ts

### Do:

- **Do** preserve the supplied board, Catera name, and exact “Good Food on Repeat.” tagline.
- **Do** write Indonesian-first interface copy and check the same layout with English labels.
- **Do** use the shared forest, cream, neutral surfaces, and operational type roles.
- **Do** pair status colors with words, keep keyboard focus visible, and honor reduced motion.
- **Do** verify new list and detail surfaces at desktop, tablet, and phone widths with long content and empty/error states.
- **Do** keep synthetic previews explicitly labeled and release claims separate from visual review.

### Don't:

- **Don't** reconstruct or substitute the approved artwork with a typed wordmark or glyph mascot.
- **Don't** squeeze the three operational stages into parallel phone columns.
- **Don't** use color changes or navigation alone to imply a successful mutation or quota deduction.
- **Don't** promote one-off display styling, tiny secondary captions, or historical overridden crop values into reusable tokens.
- **Don't** add shadows to ordinary lists and cards when borders and tonal separation already establish their structure.
