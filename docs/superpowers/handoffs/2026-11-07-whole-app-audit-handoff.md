# Whole-app audit and fixes: handoff (2026-11-07)

Branch `v2`. Nothing from this work is committed, pushed or applied to the hosted database.
The changes sit in the working tree on top of earlier uncommitted work (the Dapur kitchen-opening flow and others).
`refs/audit/pre-2026-11-06` is a snapshot of the tracked files before this work, so `git diff refs/audit/pre-2026-11-06` shows only this round's tracked edits. It holds no untracked files.

## Deploy order

1. Apply `supabase/migrations/20261107100000_audit_hardening.sql` to hosted (`kdfddipnkcviberrldpk`).
2. Run `scripts/verify-function-stack.mjs` against hosted.
3. Deploy web, then ship the Dapur build.

The new Dapur client sends "Gagal diantar" as one call, and that call fails on scheduled or preparing meals until the migration is live.

## Evidence

- `npm run typecheck`, `npm test` (1239), customer jest (2265), caterer jest (1228), `npm run build`, `npm run test:postgres`: all pass.
- Web checked in Playwright at 360px on public pages. Signed-in web screens were not driven.
- Nothing ran on a device or emulator.

## Needs a device check

- Android keyboard room in `Screen` (`packages/mobile-ui/src/components.tsx`), especially `paket/[id]` and `paket/baru` inside tabs.
- `autoComplete="name"` in `apps/caterer/src/import/RowEditor.tsx` may offer the owner's own name on a customer's row.
- Headers with a "Lihat semua" link grew about 18dp.
- iOS is untested: there is no Mac here.

## Open for the owner

- DOKU SNAP notification token is still not verified (`packages/backend/src/doku.ts:247`). Log mismatches during a real sandbox payment and a retry, then enforce.
- SMS and email sign-up need CAPTCHA (Turnstile or hCaptcha keys) and an app-level throttle.
- Enrol the admin TOTP: first enrolment is trust-on-first-use, and `admin_mfa` is not applied on hosted.
- Enable Supabase leaked-password protection.
- Hosted has migration `index_hot_foreign_keys` (20261106123600) that is not in the repo.
- Account erase: deletion is still a ticket; personal data and push tokens remain. Needs a decision and a routine.
- Seller `transactions` still carry `payment_url` on unpaid checkouts.
- Palette: light `fieldBorder` and `secondaryBorder` are about 1.5:1 against 3:1.
- Toast durations changed from the recent 2.5 s / 3 s: error and action toasts are now at least 5 s.
- Real terms text: checkout now links to the placeholder `/syarat-dan-privasi`.
- Unused SQL copies in `packages/backend/src`: `earned-settlement.sql`, `multi-cycle.sql`, `seller-experience.sql`, `settlement-reporting.sql`.
- Sign-up reveals whether an email is registered (customer `Register.tsx`, Dapur `Daftar.tsx`, `Gabung.tsx`).
- A held Dapur invite code is not tied to an email.

## Known limits left in code

- Webhook recovery is daily if DOKU does not resend: the Vercel job is `0 2 * * *`.
- `session()` still does an actor RPC on every API read: a lazy actor could not be shown to keep authorization identical.
- The `seller` read still recomputes `v1.delivery` several times; needs its own rewrite.
- `SECURITY DEFINER` commands skip the new image and tier-percent zod checks if the RPC is called directly.
- Web catalog stays capped at 100 packages (`apps/web/src/lib/catalog-cache.ts`); paging needs a design draft.
- No ESLint is installed, so `react-hooks` rules are not enforced.

## Needs a design draft (not built)

Signed-out mobile web navigation, compare on phones, unread indicators, Pelanggan search, stop contact from the delivery row, Dapur package archive, Tim staff list, Jelajah search clear.
