# Catera

The user authorized the September 9, 2026 Catera V1 marketplace overhaul. PRODUCT.md is the current product baseline; docs/IMPLEMENTATION.md records implementation and docs/CATERA-V1-IMPLEMENTATION-PLAN.md tracks release evidence. Pilot instructions in archive/pilot are superseded and must not steer V1 work.

Use Astra's UI/UX capabilities for design work. Preserve the latest approved palette, individually regenerated artwork, food-led discovery, delivery-cycle direction, Indonesian-first interface, and code-first preference. Never crop the reference board or mislabel opaque/upscaled assets as transparent/high-resolution masters. Do not reopen naming or concept selection.

Keep tenant authorization and entitlement changes in database transactions. Never replace production storage with demo data silently. Demo mode is explicit and synthetic. Do not expose secrets or real customer fixtures.

Run npm run typecheck, npm test, npm run build, relevant browser/native tests and PostgreSQL concurrency checks after material changes. Production release requires separate Supabase, SMS/SMTP, Xendit and mobile credentials, plus the gates in docs/RUNBOOK.md. Preserve the existing hosted pilot.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
