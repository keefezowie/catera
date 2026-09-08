# Catera

The user authorized implementation of the September 2026 plan. PRODUCT.md and Catera-Shape-Brief.md contain the inherited product baseline; docs/IMPLEMENTATION.md records subsequent confirmed policies. Historical stop/planning-only instructions in CODEX-HANDOFF.md are superseded by the implementation request.

Use the supplied tools/impeccable/SKILL.md for design work. Preserve the approved artwork, palette, delivery-cycle direction, Indonesian-first interface, and code-first preference. Do not reopen naming or concept selection.

Keep tenant authorization and entitlement changes in database transactions. Never replace production storage with demo data silently. Demo mode is explicit and synthetic. Do not expose secrets or real customer fixtures.

Run npm run typecheck, npm test, npm run build and relevant browser tests after material changes. Production release requires configured Supabase, SMTP, and verified deployment gates in docs/RUNBOOK.md.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
