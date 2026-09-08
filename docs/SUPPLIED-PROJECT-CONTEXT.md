# Catera — Project Context and Handoff

Last consolidated: 8 September 2026.

## 1. Product and purpose

We are building **Catera**, a web application for recurring-catering businesses that sell meal packages or subscriptions. The product centralizes work that would otherwise be handled through WhatsApp conversations and spreadsheets: customer records, package balances, delivery schedules, menus, customer changes, and production planning.

The main product problem is managing recurring meal deliveries and the remaining entitlement attached to each customer's package. Keep this operational focus when designing the application; do not silently replace it with a generic restaurant-ordering or food-marketplace concept.

The product is **Indonesian-first**, with **English supported**. Indonesian should be the primary consideration for interface language and brand presentation.

## 2. Core business rule and workflow

**One quota equals one delivery.**

The original example was a monthly package containing **26 deliveries**. This is an example, not confirmation that every package must contain 26 deliveries.

The recorded end-to-end workflow is:

```text
Customer buys a meal package
→ Customer receives a delivery quota
→ Deliveries are scheduled
→ Menus are selected
→ The relevant cutoff is reached
→ A production list is generated
→ Meals are prepared and delivered
→ Quota is automatically deducted
```

Quota accounting is central to the product. Preserve the distinction between a package purchase, the quota granted by that purchase, individual scheduled deliveries, and fulfillment.

The broad workflow is established, but the exact cutoff policy, delivery status that triggers deduction, failed-delivery treatment, expiry, rollover, cancellation, and rescheduling rules are not confirmed in this handoff. Do not invent those policies or present assumptions as prior decisions.

## 3. Confirmed functional areas

The product description covers customer management; meal packages/subscriptions and remaining quota; delivery scheduling; menus and menu selection; changes affecting recurring deliveries; cutoff handling; production lists; preparation and delivery; and automatic quota deduction.

These are established workflow areas, **not a finalized screen inventory or permissions specification**. A precise division between customer-facing, administrator, kitchen, and delivery interfaces is not confirmed in the available context.

Detailed payment processing, invoicing, notifications, reporting, integrations, and role permissions are also not established here. Their absence from this handoff does not prove they were rejected or that they do not exist elsewhere.

## 4. Approved brand identity

**Brand name:** Catera  
**Tagline:** Good Food on Repeat.

The user approved an uploaded Catera brand board in the **“Brand Continuation”** conversation on 8 September 2026 and explicitly asked that future work build on it. This board is the definitive visual reference. Do not restart naming, logo exploration, or palette selection unless the user explicitly requests a change.

### Logo and mascot

The approved identity uses a cheerful open bento/lunchbox character with a forest-green lid, a small leaf emblem, a cream-colored box, a smiling/winking face, rice and colorful food, and orange sparkle accents.

The Catera wordmark is bold, soft, rounded, and forest green.

These descriptions support continuity but are not substitutes for the original artwork. Preserve the approved mascot and wordmark instead of inventing a different mark from this text.

### Decision precedence

The latest explicitly approved brand board takes precedence over earlier moodboards and exploratory proposals. The approved tagline is **“Good Food on Repeat.”** Older references should not silently replace it.

## 5. Approved palette: Forest & Cream

| Role | Color | Hex |
| --- | --- | --- |
| Primary brand | Forest green | `#234B3E` |
| Main background | Warm cream | `#F7F6F2` |
| Surfaces | White | `#FFFFFF` |
| Primary text | Dark ink | `#202A25` |
| Secondary text | Muted moss | `#5F6B64` |
| Soft supporting fill | Pale sage | `#EAF0EB` |
| Restrained accent | Apricot | `#E8B48C` |

The agreed visual theme is **warm, calm, modern, and organized**, with gentle rounding and thin borders. Forest and cream anchor the identity; apricot is a restrained accent.

These are the approved textual palette values available in the project history. The original brand board remains the authority for the artwork itself. If its visible colors differ from these tokens, identify the discrepancy instead of silently replacing either source.

## 6. UI direction and working preferences

The user shared logo/UI reference images and asked for the application to look like that direction. The later approved Catera board should guide subsequent work.

Carry the approved brand into the application, including its palette, rounded character, and calm, organized visual language. The actual reference images should inform visual fidelity; descriptions alone cannot preserve exact composition, proportions, typography, or interface layouts.

During branding, the user wanted to focus on the **app name, logo, color theme, and overall design language**—not brand propositions, positioning statements, or a broader brand-strategy exercise.

The exploration sequence changed during the project. Earlier discussions considered choosing reference apps first; the later direction was to establish theme and palette before the logo. These historical steps do not mean the brand is still undecided: **Catera and its final brand board are now approved.**

No specific font family, finalized component library, complete screen map, or responsive specification is confirmed in this handoff.

## 7. Work mode, Cloud, and Impeccable

The user reported that attempting to use Work mode returned this exact error:

```text
Could not use this project for a local chat
```

The user supplied this troubleshooting thread and asked for the project problem to be fixed:

```text
https://community.openai.com/t/codex-could-not-use-this-project-for-a-local-chat-repair/1392960
```

The user also wants to use **Work mode with Cloud while retaining the Impeccable skill**, referring to:

```text
https://impeccable.style/docs/
```

These are recorded requests, not verified technical outcomes. The available context does not establish a successful repair, an installed Impeccable skill, or a verified Cloud configuration. Do not tell the user that any of those steps are complete without inspecting the actual environment or other supporting evidence.

The current request is to migrate the project context to another project. It is not confirmation that the underlying error has been repaired.

## 8. Technical and implementation status

The available context does not confirm the chosen frontend/backend framework, database, authentication approach, repository, local directory, hosting/deployment target, existing codebase contents, or completed implementation milestones.

**Unknown here does not mean nonexistent.** Inspect any code, repository, design assets, and project files provided in the destination before deciding to start over or selecting a stack.

There is also no recorded completion of the Work-mode troubleshooting in the context available for this handoff. Preserve that uncertainty rather than guessing at the cause or fix.

## 9. Assets to keep with this handoff

The most important visual asset is the **final approved Catera brand board** from “Brand Continuation.” Keep the earlier UI/logo reference images as supporting material, with the final board taking precedence.

This Markdown file does not embed those images or transfer any repository, application code, project configuration, or installed skill. Supply existing assets alongside it where available.

An earlier searchable reference is titled **“Catera Brand Moodboard: Good Food, Brighter Days.png.”** It is useful as historical logo/UI reference material, but its title must not override the later approved tagline **“Good Food on Repeat.”**

## 10. Instruction for continuing the project

Continue the existing Catera project from this context rather than restarting product or brand discovery. Preserve the recurring-catering model, the rule that one quota equals one delivery, the Indonesian-first direction with English support, and the approved Catera name, tagline, mascot, wordmark, and Forest & Cream palette.

Build on supplied assets and code. Keep confirmed decisions separate from proposals and unresolved requirements. Do not invent prior approvals, completed implementation, installed tools, or successful repairs. When Work-mode or Impeccable configuration becomes relevant, inspect the actual environment and verify compatibility before claiming the setup works.
