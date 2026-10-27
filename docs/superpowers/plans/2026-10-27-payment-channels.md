# Plan: payment channels

Spec: [2026-10-27-payment-channels-design.md](../specs/2026-10-27-payment-channels-design.md). Branch v2, main tree, after `facdc647`. Domain types are done (`packages/domain/src/payment.ts`); `npm run typecheck` fails only in `doku-direct.ts` until Task B lands.

Builders: Sonnet. Reviewer: Opus, one pass over the whole diff (payment code). TDD. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/`, or the owner's uncommitted edits (DESIGN.md hunks, app configs, both `_layout.tsx`, design tokens, LaunchCover, MoodHeader, `launch.test.tsx`, Dapur `today.test.tsx`). No builder commits.

Tasks A, B and C run in parallel; their files do not overlap. D follows.

## Task A: database

Files: `supabase/migrations/20261027120000_payment_channels.sql` (new), `tests/postgres-direct-payments.mjs`.

- Find the newest definitions of `public.catera_v1_command`, `catera_v1_read` and `catera_v1_system` across `supabase/migrations` (later migrations may have wrapped them again) and wrap the newest the same way `20260920154045_direct_payments.sql` does (rename to a `_channels_base`, recreate, revoke and grant as there).
- Widen the `provider_operations.channel` check (drop and re-add the constraint by its real name) and the configure allow-list to every code in `DIRECT_PAYMENT_METHODS`.
- `checkout.payment.start` for a redirect channel: reference `'CT'||left(encode(sha256(convert_to(c.id::text,'UTF8')),'hex'),26)`.
- `provider.payment.customer`: name, phone, email, address line, city, postcode (whatever the schema stores; null when missing) and package name for the checkout's customer; service role only.
- Tests first in `tests/postgres-direct-payments.mjs`: start with a VA bank other than BRI, an e-wallet and a paylater code; the redirect reference equals `dokuInvoice(id)` computed in JS; method lock across kinds; configure rejects an unknown code; `provider.payment.customer` refused to `authenticated` and returns only the listed keys to service role.
- Run `npm run test:postgres` (read `package.json` and `docs/RUNBOOK.md` for how it starts Postgres; never point it at a hosted project).

## Task B: backend and webhooks

Files: `packages/backend/src/doku-direct.ts`, `packages/backend/src/payment-provider.ts`, `packages/backend/src/doku.ts` (allow-list only), `apps/web/src/app/api/webhooks/doku/direct/bri/route.ts`, `apps/web/src/app/api/webhooks/doku/direct/va/route.ts` (new), `apps/web/src/app/api/v1/[...path]/route.ts` (only where it names BRI), `tests/doku-direct.test.ts`, any `tests/*.test.ts` that pins the hosted allow-list.

Per spec "Backend". Tests first: readiness per key (all four flags plus bank config; BRI env names unchanged), VA request and response per bank (channel echoed, `instructions.bank`), VA notification and status for a non-BRI bank, redirect request (single `payment_method_types`, invoice = reference, paylater `customer` and `line_items`, no customer block for wallets), redirect attach result, `recordDokuPayment` routing a redirect operation through `dokuPaymentEvent`, reconcile of a redirect operation through `/orders/v1/status`, hosted allow-list accepting `EMONEY_SHOPEE_PAY` and rejecting junk. Run `npm test` (root Vitest) and `npm run typecheck`.

## Task C: customer and web screens

Files: `apps/customer/src/buy/PaymentScreen.tsx`, `apps/customer/tests/buy.test.tsx` (the Bayar blocks), `apps/web/src/components/direct-payment.tsx` and its test if one exists (grep `direct-payment` under `apps/web` and `tests`).

Per spec "Apps". Tests first: VA card and steps name the bank (BCA case), redirect start button "Bayar dengan DANA", after start "Lanjut ke DANA" opens the URL through `expo-web-browser`, steps shown, status check unchanged; web renders the redirect link. Run customer Jest and `npm run typecheck` (the doku-direct error from Task B may still show; report it, do not fix it).

## Task D: docs (Sonnet), after A to C

- DESIGN.md: under "Payment method and mascot space (October 2026)", a short "Channels" subsection (which methods are supported and how, the Bayar strings). Add only new text; stage only its hunks.
- `docs/RUNBOOK.md`: the per-channel env flags and VA bank config, and the order to enable a channel (sandbox evidence, four flags, `provider.direct.configure`).
- Handoff `docs/superpowers/handoffs/2026-10-27-payment-channels-handoff.md`.

## Final check

Opus review of the whole diff against the spec. Then, in the background: `npm run typecheck`, `npm test`, customer and Dapur Jest, `npm run test:postgres`, `npm run build`. Commit on v2 with only this phase's files. No push without the owner's yes.
