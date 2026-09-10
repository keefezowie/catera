# Catera — Codex planning handoff

## Current checkpoint

The user approved the complete scope in Catera-Shape-Brief.md and selected B — Delivery cycle. Impeccable /init and /shape are complete. Code-first is saved in .impeccable/config.json. The user requested that this checkpoint be saved and work stop. The next task is to generate an implementation plan; no application code, deployment, or additional concept exploration is requested yet.

## Read in this order

1. AGENTS.md — project working guidelines.
2. PRODUCT.md — confirmed product facts and original context.
3. Catera-Shape-Brief.md — approved scope, direction, screen inventory, first build slice, and open policies; this is the authoritative screen brief.
4. upload/01-image.png — approved brand board, inspect visually.
5. .impeccable/config.json — code-first preference.
6. tools/impeccable/SKILL.md — complete supplied Impeccable 4.1.3 skill, with its references, scripts, and agents beside it.
7. upload/02-Catera_Project_Context.md — historical background, subordinate to later confirmed decisions.

If Catera_Screen_Brief.md exists in an older workspace, it is superseded by Catera-Shape-Brief.md. Its unresolved concept selection and confirmation prompts are historical. Do not use them to reopen decisions. The unselected A/C sketches are not design authority.

## Fixed requirements

- Responsive web app for both owners/admins and subscribers.
- Admin optimized for laptop/widescreen, still usable on phones. Subscriber optimized for phones.
- Admin daily operation follows selected-date Schedule → Production → Delivery views. Subscriber Home prioritizes next delivery.
- One quota equals one delivery; purchases, quota grants, scheduled deliveries, and fulfillment must stay distinct and traceable.
- Admin records external purchases and assigns packages. No initial checkout.
- Subscribers make allowed changes directly before cutoff. No initial approval queue.
- Preserve Catera, “Good Food on Repeat.”, and the supplied mascot and wordmark. Brand board takes precedence over earlier color exploration: forest #163D2E, cream #FFF7E9, orange #F47B2A, charcoal #2E2E2E. Actual artwork, not its textual description, is visual authority.
- Indonesian first, English supported. Code-first. Cross-computer continuity is required.

## What the implementation plan should contain

- Inspect the actual target repository before assuming it is empty. This handoff contains planning material and the skill, not a working application.
- Recommend a stack and explain the choice; label it proposed. No framework, database, authentication, backend, hosting, or external repository has been chosen.
- Map approved screens to routes, layouts, reusable components, responsive behavior, and role/access boundaries.
- Propose a domain model and data relationships for customers, package definitions, purchases/assignments, quota activity, deliveries, menus, and menu selections. Keep proposed names and structure separate from confirmed facts.
- Propose API/service boundaries, authorization, transactional quota updates, idempotency, concurrency handling, validation, and history appropriate to the actual stack.
- Define the first slice from the approved brief, then sequence remaining scope with dependencies and acceptance criteria. Distinguish visual demo work from production behavior.
- Cover empty/loading/error/locked states, keyboard and phone usability, localization, and meaningful verification of entitlement accounting and cutoff races.
- Identify policy questions that block real mutations; allow mock data or isolated interfaces for nonblocking design work. Do not silently decide these policies.
- Include a portable repository workflow for source, product/design documents, and skill availability. A bundle on its own does not establish repository synchronization or install the skill on another device.
- Finish with a concrete, reviewable implementation plan. Do not code or deploy unless the user subsequently requests it.

## Policies still open

Exact cutoff/timezone and exceptions; permitted subscriber changes; quota deduction event and reversals; failed deliveries; cancellation/rescheduling; expiry/rollover; effects of address edits on scheduled deliveries; account provisioning and role permissions; production-list freeze/update behavior; notifications, invoicing, reporting, and integrations.

The operating sequence lists fulfillment before quota deduction, but does not establish the exact status or event that triggers deduction. The UI stage names do not define a backend state machine.

## Impeccable continuation

Read tools/impeccable/SKILL.md and run its context script once from the extracted project root when beginning a new design session. Resolve all script paths from tools/impeccable; no Windows-specific installation path is required. Reuse the approved direction and scope. Read reference/new-work.md for the subsequent workflow and reference/operate.md for operational UI guidance; craft-floor.md applies immediately before UI editing, not to planning alone. Later implementation can create durable design tokens and surface contracts through the skill's workflow. No DESIGN.md or direction contract has been approved yet; absence of these files does not erase the approved brand or direction.

The earlier online concept service and decision-page browser were unavailable. B was still explicitly selected and the brief approved. Do not repeat the roll to recover approval. If optional services are unavailable, use the skill's documented fallback and report the limitation honestly.

The skill files are included unchanged. Bundling them makes them available to read; it does not claim global installation, cross-device sync, or repaired local-chat infrastructure.

## Starter prompt for the next Codex agent

Read AGENTS.md and CODEX-HANDOFF.md, then the sources listed there. Catera's scope and B — Delivery cycle direction are approved. Use the supplied Impeccable skill and preserve code-first. Inspect the target repository, then produce a concrete implementation plan covering architecture, data model, screens/routes, components, milestones, acceptance criteria, and unresolved business rules. Do not restart branding or concept selection. Do not implement or deploy yet.
