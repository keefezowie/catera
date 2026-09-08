# Catera — Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Undecided. No application source, framework, database, authentication configuration, repository, or deployment target was supplied in this workspace. Initialization does not select a stack.

## Users

Catera serves recurring-catering businesses selling meal packages or subscriptions. Their work includes maintaining customer records, tracking remaining delivery entitlements, scheduling deliveries, handling changes, and planning production.

Both catering owners/admins and meal subscribers are in the initial interface scope.

- Owner/admin interface: optimized for laptops and widescreens while remaining functional on mobile phones.
- Meal subscriber interface: optimized for mobile phones.

These are responsive web interfaces. Detailed role permissions and any separate kitchen or delivery interfaces remain undecided.

## Product Purpose

Centralize recurring-catering operations otherwise managed through WhatsApp conversations and spreadsheets. Keep package purchases, remaining entitlements, scheduled deliveries, and fulfillment understandable and connected.

This is a recurring-catering operations product. Do not reinterpret it as a generic restaurant-ordering application or food marketplace.

## Operating Context

The established workflow is:

1. A customer buys a meal package.
2. The customer receives a delivery quota.
3. Deliveries are scheduled.
4. Menus are selected.
5. The relevant cutoff is reached.
6. A production list is generated.
7. Meals are prepared and delivered.
8. Quota is automatically deducted.

The product is Indonesian-first, with English supported. Prioritize Indonesian when developing interface language and brand presentation.

## Capabilities and Constraints

- **One quota equals one delivery.**
- Preserve the distinction between package purchase, quota granted, each scheduled delivery, and fulfillment.
- A monthly package containing 26 deliveries is an example, not a universal package requirement.
- Confirmed functional areas: customers, packages/subscriptions, remaining quota, delivery scheduling, menus and selection, recurring-delivery changes, cutoff handling, production lists, preparation, delivery, and automatic quota deduction.
- Open business decisions: cutoff policy, the exact delivery status triggering quota deduction, failed deliveries, expiry, rollover, cancellation, and rescheduling.
- Initial package purchases happen outside Catera; owners/admins record purchases and assign the corresponding package and quota. In-app checkout is outside the first version.
- Subscribers can make permitted delivery changes themselves before cutoff, without an admin approval queue. The allowed changes and exact cutoff policy remain undecided.
- Open scope decisions: final screen inventory, detailed role permissions, invoicing, notifications, reporting, and integrations. Missing decisions do not mean these capabilities were rejected.
- Cross-computer work is a user requirement. The handoff requests Cloud work with Impeccable; no completed infrastructure setup or repair is established by that request.

## Brand Commitments

The approved name is **Catera** and the approved tagline is **Good Food on Repeat.** Preserve both.

The supplied final brand board is the definitive visual reference. Preserve its cheerful open bento/lunchbox mascot, leaf emblem, food details, orange sparkle accents, and soft rounded wordmark. Use the actual artwork as evidence; its written description is not replacement artwork.

The confirmed character is warm, calm, modern, and organized. Do not restart naming, logo exploration, palette selection, positioning exercises, or broader brand strategy without a request.

Evidence discrepancy: the final board's printed palette differs from the earlier textual Forest & Cream tokens in the handoff. Preserve both source records; do not silently merge them. The latest approved board takes precedence over earlier exploration. This product record does not establish implementation tokens or a new visual system.

## Evidence on Hand

- `upload/02-Catera_Project_Context.md`: user-supplied project context and handoff, consolidated 8 September 2026. Source of the product facts captured here; historical request/status statements inside it are not proof of completed work.
- `upload/01-image.png`: user-supplied approved Catera brand board, inspected in this conversation.
- `upload/01-impeccable.zip`: user-supplied Impeccable 4.1.3 skill archive. Its init playbook was read and its context script ran successfully with the optional network update check disabled. This verifies availability in this workspace, not installation on other computers.

No application implementation was supplied. Do not invent implementation milestones, customers, testimonials, performance claims, pricing, or successful fixes to the earlier local-chat error.

## Product Principles

1. Keep delivery entitlement accounting explicit and traceable through the recurring-delivery workflow.
2. Organize the real catering operation around connected customer, schedule, menu, and production information.
3. Preserve approved identity and Indonesian-first communication across future surfaces.
4. Keep confirmed facts separate from proposals and unresolved business policies.

## Initialization Status

Created from the user-supplied handoff and approved artwork. After the structured interview returned no selections, the user confirmed both audiences and their device priorities in plain text; those decisions are recorded under Users. Accessibility requirements beyond the confirmed language support remain unestablished.
