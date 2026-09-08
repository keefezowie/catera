# Catera — Delivery cycle screen brief

Status: APPROVED by the user on 8 September 2026. Direction B and the complete screen scope are confirmed.
Workflow: Impeccable /shape complete. Code-first remains the default. Next authorized session task: prepare an implementation plan, not application code.

## Job, audience, and outcome

Visitor mode: Operate. Owners/admins coordinate recurring catering from a laptop or widescreen, with a usable phone layout. Subscribers manage their own deliveries on a phone. The interface must make the next delivery and the work required to fulfill it easy to find.

Success means an admin can connect a purchased package to its quota, scheduled deliveries, menu choices, production requirements, and fulfillment history; a subscriber can understand their next delivery and make permitted changes before cutoff. One quota equals one delivery. Scheduling, package purchase, and fulfillment remain distinct records.

## Selected direction

B — Delivery cycle is approved. Admin work centers on a selected date, progressing through Schedule → Production → Delivery. These are operational views, not a new definition of backend statuses. Subscriber Home centers on the next delivery, with the upcoming agenda and quota nearby.

Preserve Catera, “Good Food on Repeat.”, the approved bento mascot and wordmark, and the final brand board. Its recorded palette is forest #163D2E, cream #FFF7E9, orange #F47B2A, and charcoal #2E2E2E. The board supersedes earlier palette exploration. Use the actual supplied artwork in implementation; the concept sketch's text wordmark and sample values are placeholders.

The focal interaction is opening a scheduled delivery while retaining its date and operational context. Show its customer, menu, address, fulfillment history, and associated quota activity together. Changing views must not change delivery status or consume quota. Status changes need explicit actions and clear feedback; do not implement drag-to-deduct behavior.

## Screen inventory

These are proposed screen groups, with detail views and forms nested where appropriate.

| Audience | Screen / flow | Main content and action |
| --- | --- | --- |
| Shared | Sign-in and account access | Authenticate, recover access using the selected auth method, and enter the permitted interface. |
| Admin | Today / Hari ini | Selected date, scheduled work, missing information, and access to Schedule, Production, and Delivery. |
| Admin | Schedule → delivery detail | Dated deliveries, customer/menu/address context, permitted edits, and delivery history. |
| Admin | Production | Preparation totals by menu for the selected date, with source deliveries and cutoff context. |
| Admin | Delivery tracking | Fulfillment list, delivery detail, explicit status updates, and traceable quota effects once policy is settled. |
| Admin | Customers → customer detail | Contact and delivery information, assigned packages, remaining quota, schedule, and usage history. |
| Admin | Record purchase / Assign package | Record an external purchase, select a package, review its quota grant, and confirm assignment. |
| Admin | Packages | Maintain available package definitions and delivery entitlements; 26 deliveries is an example, not a fixed rule. |
| Admin | Menus | Maintain dishes/menu options and associate available choices with delivery dates. |
| Admin | Settings | Business and account configuration; expose operational policy controls only after the policies are defined. |
| Subscriber | Home / Beranda | Next delivery, selected menu or selection needed, delivery details, upcoming agenda, and remaining quota. |
| Subscriber | My schedule → delivery detail | Review upcoming deliveries and permitted changes, including the applicable cutoff. |
| Subscriber | Meal selection | Review date-specific options, select a menu, and see confirmation. |
| Subscriber | Change review and confirmation | Show the proposed change and its known consequences, validate eligibility again on submission, and confirm or explain rejection. |
| Subscriber | My package | Active package, remaining deliveries, and quota usage history. |
| Subscriber | Profile & delivery details | Contact and delivery information; distinguish profile edits from changes to already scheduled deliveries. |

Proposed navigation: Admin sidebar groups daily operations (Today, Schedule, Production, Delivery) and records (Customers, Packages, Menus, Settings). Subscriber bottom navigation uses Home, Schedule, Package, and Profile; meal selection opens from a delivery.

## Core journeys and layout

Admin: customer → record external purchase and assign package → schedule delivery → review menu completeness → selected-date production list → explicit fulfillment action → inspect quota history under the confirmed deduction policy.

Subscriber: Home → next delivery → select menu or make a permitted change → review → submit → updated delivery. If a change is no longer permitted, explain why and preserve the existing delivery.

On wide screens, use the available width for operational lists and adjacent detail panels. Keep the date consistent across Schedule, Production, and Delivery. On phones, reflow into one stage/list at a time and open detail as a full screen, with an obvious return path. Do not squeeze a three-column desktop board onto a phone. The subscriber next-delivery panel leads before secondary account information.

Use restrained brand accents, readable operational density, clear labels, and explicit status text. Provide keyboard access, visible focus, labeled fields, legible contrast, touch-friendly targets, and feedback that does not rely on color. Indonesian is primary; English is supported. These accessibility choices are proposed implementation requirements.

## Scope, states, and data ranges

The brief covers both responsive interfaces and their connected flows. Suggested first implementation slice: admin Today, its three operational views and delivery detail, plus subscriber Home, schedule/detail, and meal-selection confirmation. Remaining record-management and settings screens follow in the same system. This sequence is a proposal, not a reduction of scope.

Handle initial setup, no customers, no active package, zero quota, no scheduled deliveries, missing/unselected menu, loading, error/retry, validation, successful save, unauthorized access, expired session, cutoff reached during editing, and concurrent updates. Show a useful next step in empty views. Separate empty data from failed loading.

Support zero, one, and many records; long customer names, addresses, and menu labels; and packages with differing delivery counts. Actual business volumes are unknown: use clearly marked synthetic data for previews and avoid encoding invented capacity limits. Search, filtering, and pagination should reflect the eventual dataset rather than assumed volumes.

In-app checkout and an admin approval queue are outside version one. Invoicing, reporting, integrations, and notification scope remain undecided. Do not infer a marketplace, dedicated kitchen/driver roles, or an implemented backend from this plan.

## Decisions a builder must not invent

- Cutoff time, timezone, per-date exceptions, and which subscriber changes are allowed.
- Exact fulfillment event that deducts quota, duplicate-action protection, and correction/reversal behavior.
- Failed delivery, cancellation, rescheduling, package expiry, and quota rollover policies.
- Whether editing a profile address affects existing deliveries, and how such effects are reviewed.
- Detailed roles, account provisioning, authentication, and visibility of customer data.
- Framework, database, backend, deployment configuration, and production data scale.

Visual work can use explicit demo states while these rules remain open. Production mutations and entitlement accounting require the relevant policy to be resolved first.

## Handoff

The user confirmed this brief and requested a saved handoff, followed by a stop. The next agent should prepare an implementation plan from this approved scope. Do not repeat scope confirmation or concept selection. Preserve open policy decisions as open; propose architecture and sequencing without treating them as approved. No application implementation is authorized by this handoff alone.
