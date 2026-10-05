---
name: Catera
description: Good Food on Repeat.
colors:
  forest: "#163d2e"
  forest-deep: "#103324"
  cream: "#fff7e9"
  orange: "#f47b2a"
  ink: "#2e2e2e"
  muted: "#59685e"
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
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
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

This records the current inherited landscape refinement as of 5 October 2026. The visual source of truth is [the global stylesheet](src/app/globals.css), including its final cascade overrides, and [the components](src/components/). The approved identity is [the original brand board](public/brand/catera-board.png); the inherited direction is [the implementation contract](docs/UI-BRIEF.md). [PRODUCT.md](PRODUCT.md) and [the shape brief](Catera-Shape-Brief.md) retain approved product context; subsequent policies live in [the implementation record](docs/IMPLEMENTATION.md). The [landscape comparison](docs/ux/pilot-landscape-review/references.md) records applied Linear list/disclosure, Shopify reviewed-batch, and HelloFresh planning/settings patterns; no reference assets are copied. The [finish verdict](docs/ux/pilot-landscape-review/finish-verdict.md) ships the three scoped corrections only. This document records source-backed visual behavior, not hosted readiness or an accessibility certification.

**Key Characteristics:**

- Forest actions and emphasis on a pale canvas, with cream and the original artwork adding warmth.
- Operational typography, explicit status text, and tabular numbers.
- Open lists and light borders; raised layers are reserved for overlays; save feedback is a flat forest notice.
- Responsive detail views preserve the context needed to act, with secondary accounting and history disclosed on demand.
- Daily task guidance and customer delivery attention use real record state, explicit deadlines, and reviewed actions.

## Colors

The palette combines deep botanical green, warm paper, orange artwork accents, and charcoal text; the frontmatter holds the normative values.

The companion [.impeccable/design.json](.impeccable/design.json) adds component previews, motion, breakpoints, and elevation metadata. Its synthesized tonal strips are display aids for the design panel, not additional colors implemented by the application.

### Primary

- **Forest** powers primary actions, selected desktop navigation, headings, and the subscriber's next-delivery panel. **Forest deep** marks the selected schedule-switch hover/focus treatment.
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

Generic page headlines step down at widths up to 1200px; subscriber headings have their own desktop and small-screen overrides. Today uses a compact headline at 1024px and above, while the next-task emphasis uses a larger action-context label. The customer landscape meal heading is specific to its delivery panel. These local overrides are not additional global type roles. CSS weights such as 550 and 650 are requested values; available system fonts determine their actual rendered face.

**The Operational Type Rule.** Use the shared sans-serif roles for interface content and the supplied raster artwork for the brand wordmark. Keep status labels and customer names legible when the layout narrows.

Essential screen text has a 12px minimum: status words, table headings, quota labels, supporting captions, and navigation remain readable across widths. Customer names are 13px on small screens; meal-choice descriptions use 14px with a 1.65 line-height. Print tables retain a separate 10px treatment. The one-off large sign-in headline is excluded from the reusable display system.

## Layout

Desktop admin layout uses a fixed sidebar (232px), a main column offset by the same amount, a top bar (76px), and a centered content region capped at 1560px. Generic main padding is 36px 38px 60px; at 1500px and above it becomes 44px 55px 70px. At 1200px and below, the sidebar and main offset become 210px and generic padding becomes 30px 25px 50px. Route-specific subscriber padding still takes precedence where its selector is more specific.

At 1024px and above, daily operations use one title/date band, compact day context, stage links, and actionable rows. Today further overrides the context into a single-column grid with a 12px gap; its next action retains emphasis. Operational table cells use 10px vertical padding and toolbars use 12px 20px. Production places revision/portion context and the reviewed readiness handoff near source records. The adjacent delivery drawer is 470px wide, capped by the viewport; its sticky fulfillment action uses an 84px top offset below its header.

Above 800px, subscriber Home, Schedule, and Help override the earlier base 720px cap with 1180px. Home pairs next delivery and quota/upcoming context in `minmax(0, 1.08fr) minmax(0, 1fr)` columns, separated by 28px and aligned at the top. Schedule groups open rows by date with horizontally scrolling date anchors. Package, Profile, and standalone subscriber detail retain the base 720px desktop cap; the landscape rule does not apply to every subscriber route.

Wide customer/purchase/scheduling dialogs above 800px are capped at 1040px. With context, they use a 280px saved customer/funding column plus a flexible fields/review column with a 26px gap. The dialog is a bounded flex surface; fields, review content, and context scroll independently while its action footer stays visible. Standard dialogs remain capped at 520px and batch dialogs at 840px. Paired fields use a two-column grid until the 600px rule collapses them. Help uses a 260px topic column and flexible article with a 32px gap.

At 800px and below, the sidebar becomes an off-canvas drawer (245px), the main column fills the viewport, and the top bar becomes 62px. Generic main padding is 27px 20px 40px. Subscriber content is capped at 520px with 24px 20px 85px padding, reserving space for its fixed four-destination bottom navigation (72px, including the existing safe-area treatment). Lists collapse secondary menu/window columns; details remain available through named links. Help becomes one column; a later override keeps its topic groups in one column rather than the earlier two-column declaration. Dialog context stacks and shares the workspace scroll while the actions stay outside it.

At 767px and below, batch review rows stack and production handoffs wrap. At 600px and below, stages use three equal `minmax(0, 1fr)` columns, wrapping labels with counts below; they do not force unwrapping phone labels. At 520px and below, allocation gaps narrow and validity details stack. At 370px and below, subscriber horizontal gutters narrow to 16px. The 801px/800px, 1024px, 1200px, and 1500px rules are separate boundaries; do not flatten their cascade into a single desktop/mobile switch.

Spacing uses the repeated control and section steps in frontmatter, with local paddings retained where the source requires them. Landscape 1280×800 and 1440×900 are the active improvement scope; tablet 768px and phone 390px are regression checks. [The finish evidence](docs/ux/pilot-landscape-review/verification.md) and [scoped verdict](docs/ux/pilot-landscape-review/finish-verdict.md) record the current capture boundary; they do not prove every route/state or certify accessibility.

**The Adjacent Context Rule.** Keep the current delivery list beside desktop detail, and saved customer/funding facts beside wide edits. Keep actions visible while lengthy fields and review content scroll.

## Elevation & Depth

At rest, the interface uses white surfaces, pale canvas, and thin borders. Lists and ordinary cards have no shadows. Overlay scrims separate temporary work from the background; dialogs and the delivery drawer receive soft shadows. Save feedback is an in-flow, flat forest notice; no save-feedback shadow is implemented.

### Shadow Vocabulary

- **Dialog:** `0 16px 55px #163d2e24`, from the shared shadow custom property.
- **Delivery drawer:** `-6px 0 35px #14382620`, separating the side detail from its list.

**The Temporary Layer Rule.** Keep ordinary data surfaces flat. Use the existing soft elevation treatments for temporary overlays. The active help-topic inset mark and checkbox inset are state indicators, not surface elevation.

Controls transition color and background over 180ms. The drawer enters over 200ms, overlay opacity over 180ms, and mobile navigation over 200ms. Reduced-motion preference removes animations and transitions. Loading skeletons pulse only while representing loading; do not borrow that motion for decoration.

## Shapes

Controls have gently rounded corners, with shared field and button radii recorded above. Ordinary containers use the shared surface radius; dialogs use the shared dialog radius. Status labels are compact rounded rectangles rather than pills. Circular forms identify people, status dots, and timeline points. Thin separators structure tables and detail sections without boxing every item into a card.

The original artwork is displayed through CSS background crops. Reuse the final logo and mascot rules from the stylesheet; earlier declarations are overridden later in that file. The standard logo includes the artwork's tagline. Do not replace the board with typed text, an emoji, or a redrawn mascot, and do not crop away the wordmark or tagline when changing its container.

## Components

### Buttons

Compact, explicit actions. Primary is forest with white text; secondary is white with a pale border and forest text; ghost is transparent; cream belongs on forest surfaces. The shared padding and radius are in frontmatter. The earlier 40px button minimum is overridden to 44px both at widths up to 800px and at widths from 801px. Icon buttons are 44px square, navigation links are at least 44px high, and language, date, list-filter, search, weekday, and quota/history disclosure controls use a 44px minimum in their implemented dimensions. Primary hover lightens forest; secondary and ghost hover use sage; cream hover warms. The danger variant uses danger text and a pale warm border, with a warm hover fill for skipping. Disabled buttons reduce opacity and show a not-allowed cursor.

Global keyboard focus uses a warm outline (3px, offset 3px); detail disclosures use the approved orange accent for their focus outline. The sidecar preserves exact hover, focus, and motion CSS. Icon buttons have visible hover/focus states and accessible labels. A focus-revealed skip link reaches main content.

### Status Labels

Quiet colored rectangles with a small circular dot and translated 12px status words. These are descriptive labels, not interactive filters. The shared scheduled/pending styles are represented in the sidecar. State labels must remain meaningful without their color, including on the forest customer delivery panel.

### Cards / Containers

Lists, production views, package definitions, profile forms, and detail surfaces use white backgrounds with light borders and the shared surface radius. Toolbars and content have their own internal padding; an ordinary list container has no universal padding because rows and toolbar own their spacing. Hover highlights belong to actionable rows, not to every surface. The forest subscriber delivery panel is the major tonal exception and keeps its light content and cream action.

### Inputs / Fields

Visible field labels sit above white controls. Inputs, selects, and textareas share the field radius, thin pale border, 13px text, and a base minimum height of 41px. At widths from 801px, inputs and selects override that minimum to 44px; textareas keep their base treatment. Date, search, and list-filter controls already have explicit 44px minima. Textareas resize vertically. Search combines an icon and field in one outlined container and uses a distinct focus-within outline. Error messages are textual alerts below the relevant form content. Submission state changes the button label and disables repeated submission. Unknown-outcome recovery renders the actual attempted native control values in a disabled fieldset inside a separately named, focusable scroll region; do not infer a generic opacity-based disabled-field token from native browser rendering. Date controls retain ISO values and `dateTime` while showing localized, readable date captions beneath the native input. The caption is referenced by the input description; its visible wrapper is hidden from redundant reading.

### Navigation

Admin navigation pairs outlined SVG icons with sentence-case labels, separates one daily operations entry from customers, packages, menus, and owner-only settings, and fills the selected desktop item in forest. That operations entry stays selected across schedule, production, delivery, and delivery-detail routes. Hover is a pale surface shift. On subscriber phones, labels move below their icons; the current destination uses stronger forest text and icon stroke instead of a filled background. Keep `aria-current` on the current page.

The closed mobile sidebar is hidden from visibility and keyboard focus. Opening it supplies dialog semantics, locks body scrolling, makes main content and customer bottom navigation inert, and traps focus within the drawer. Escape, close, and the scrim dismiss it; focus returns to the menu button. Crossing back above 800px closes the mobile drawer.

### Delivery Cycle and Detail

Stage links use a thin forest underline for the active stage and small count badges. They preserve the selected date; their narrow-screen wrapping behavior is recorded under Layout. The daily entry adds a contextual next-task action. At 1024px and above, the operational next-task band overrides the earlier sage panel to transparent, borderless, compact context; smaller surfaces retain their own stacking rules. Priority follows failed deliveries, missing menu choices, scheduled work awaiting production, remaining delivery work, then completion. Status/attention, slot, and search filters sit over the operational list, with a clear-filter action and distinct filtered empty state.

A delivery opens in an adjacent desktop drawer (470px), becoming full-width on small screens, or in the standalone detail route. Menu, address, cutoff, and next valid actions remain visible; grant/quota details and event history use expandable sections. The readiness action is disabled with a visible explanation and production link when the latest production version is absent, incomplete, or lacks the delivery. Menu choice alone never establishes readiness. When the selected menu still exists in current menu metadata, its description appears read-only beneath the meal name, including locked subscriber detail. This is menu information, not allergy verification or a new permission to edit.

Operational form dialogs use explicit review and confirmation with pending and textual error feedback. Direct-save forms such as subscriber profile retain their source behavior; review is not a universal promise for every field edit. No-input transitions and unlocked skips open directly at review; actions needing a failure or override reason retain input before review. Delivered confirmation explicitly shows a one-delivery debit. Opening a view is never a fulfillment action. The visible sequence remains external purchase → quota → schedule reservation → menu selection → cutoff → frozen production → ready → out for delivery → delivered, with quota consumption at delivered confirmation.

Selected eligible rows reveal reviewed Ready/Dispatch batch actions. Review distinguishes eligible records from excluded ones; confirmation reports per-record results and can partially succeed. Unknown outcomes retain their original request IDs and payloads for recovery, known successes are skipped on retry, and changed versions require review again. Batch readiness uses complete latest frozen production; dispatch uses ready deliveries. Neither batch action confirms delivered or consumes quota.

### Quota and Agenda

Quota totals use three aligned numeric columns and fine separators, retaining the distinction between remaining, reserved, and available deliveries. An expandable explanation supports these totals. Customer records prioritize recording an external purchase or creating a schedule according to available capacity. Scheduling keeps customer quota and grant validity in context; review shows required, allocatable, and unallocated occurrences and blocks confirmation for an empty plan, missing allocation, or elapsed cutoff. Owner accounting adjustments remain inside a separate disclosure.

The customer schedule starts on Upcoming, retaining active unresolved deliveries even when their service date has passed; History contains delivered and cancelled entries. Both views show counts, status text, and their own empty-state copy. The agenda uses open rows with a compact date block, readable meal or missing-menu text, and a detail affordance. Customer home shows the next delivery's status and change deadline, flags the earliest pending menu choice before cutoff, and excludes the next delivery from its following agenda. Menu-choice descriptions appear with the selected meal in detail. Retain these concrete operational meanings instead of turning them into decorative metrics.

### Menu Comparison

Menu options are real radio controls inside a labeled fieldset, with a shared instruction and each available description linked to its radio. Options use white surfaces, a sage hover/selected fill, forest border, and an orange focus outline around the whole option. Above 800px, an auto-fit grid uses a 180px minimum option column; it stacks below that boundary. Default labels describe published menu fallback, not an extra purchase or food-kit upsell. Read-only selected descriptions use existing menu metadata and remain visible when changes are locked.

### Retained Forms and Recovery

Ordinary field-bearing forms retain their same-mounted values after Escape, outside click, or close. Reopening restores the values, clears the old review stage, and shows a localized quiet status cue explaining that renewed review is required and Batal discards the draft. Explicit Batal discards ordinary retained fields; successful save clears them and the cue. This is mounted-page memory, not durable storage or a promise to survive navigation/reload.

An unknown save outcome is a distinct protected state. Retained presentation captures the actual native controls (including date values, selected options, and checked/unchecked choices) separately from the command payload. The attempted changes are immutable, titled, and placed in a named focusable region; saved account, address, customer, and quota context remains separately identified, including the saved-address comparison where provided. Closing or Batal does not erase an unresolved attempt. Retry sends its original payload and request ID; it must resolve before a changed request is allowed. Ordinary resumption copy is excluded from this state. Do not style attempted values as confirmed saved values.

**The Review Again Rule.** Restoring an ordinary draft restores inputs, not authorization. Require a fresh operational review before confirming resumed changes; unresolved saves instead use the protected original attempt.

### Help

Role-aware help uses disclosed groups of at most four topics, a broad article, title-first search ranking, and a visible current-topic inset mark. Contextual links carry available customer, delivery, date, and slot context to a relevant task destination. The help article shows current cutoff policy for the cutoff topic; it does not claim an unimplemented service or workflow. `/` focuses an available main search and `?` opens contextual help when the user is outside an editable field and no dialog is open. Escape and Tab remain the documented dialog/navigation keyboard behaviors.

## Do's and Don'ts

### Do:

- **Do** preserve the supplied board, Catera name, and exact “Good Food on Repeat.” tagline.
- **Do** write Indonesian-first interface copy and check the same layout with English labels.
- **Do** use the shared forest, cream, neutral surfaces, and operational type roles.
- **Do** pair status colors with words, keep keyboard focus visible, and honor reduced motion.
- **Do** retain readable 12px minimum essential screen text and the implemented 44px key touch controls.
- **Do** show prerequisites, quota consequences, and explicit review before a fulfillment change.
- **Do** distinguish ordinary restored drafts from immutable unknown-outcome recovery and distinguish attempted changes from saved context.
- **Do** verify new list and detail surfaces at desktop, tablet, and phone widths with long content and empty/error states.
- **Do** keep synthetic previews explicitly labeled and release claims separate from visual review.

### Don't:

- **Don't** reconstruct or substitute the approved artwork with a typed wordmark or glyph mascot.
- **Don't** truncate or force the three stage labels into an unwrapping phone row; preserve their equal-width wrapping navigation layout.
- **Don't** use color changes or navigation alone to imply a successful mutation or quota deduction.
- **Don't** promote one-off sign-in display styling or historical overridden crop values into reusable tokens.
- **Don't** add shadows to ordinary lists and cards when borders and tonal separation already establish their structure.
- **Don't** imply in-app checkout, verified allergies, or quota consumption before delivered confirmation.
- **Don't** present synthesized sidecar tonal ramps as live application tokens.
