# Pilot operating runbook

Status: local implementation and synthetic verification. Hosted staging/production, external email delivery, and hosted restoration have not been configured or verified. Record evidence for every release gate below before adding real customers.

## Environments and private source

Use separate Supabase projects and Vercel environments for staging and production. Keep staging synthetic. Create the Git remote as private, preserve branch `codex/catera-pilot`, and connect only that private repository to CI/hosting. The application has no public remote configured at handoff.

Choose Singapore for the database project. `vercel.json` sets the function region to `sin1`; verify the effective region in the deployment. Use Node.js 24, `npm ci`, `npm run build`, and the Next.js preset. Run CI on a clean checkout before deployment. CI provides an isolated PostgreSQL service; local tests can use embedded PostgreSQL instead.

Set hosted application environment variables through the provider's protected settings:

| Variable | Purpose |
|---|---|
| `CATERA_DEMO_MODE=false` | Hosted persistence and real authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Environment-specific Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public project client key |
| `SUPABASE_SECRET_KEY` | Server-only activation of explicitly invited accounts |
| `DATABASE_URL` | Operator commands only; do not add to browser configuration |

Use a separate uncommitted operator environment file for database credentials. `CATERA_SESSION_SECRET` is for local synthetic sessions only. Do not store Resend's SMTP password in frontend variables or Git; configure it in Supabase Auth.

## Database installation

The schema migration is authoritative and runs once on a new Supabase project. Auth roles/schema already exist on Supabase; **never apply the local Auth shim or demo seed to a hosted environment**.

With the Supabase CLI installed and authenticated for the intended environment, link the project and inspect the migration target before applying:

```text
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, the database owner can execute `supabase/migrations/202609080001_core.sql` on a fresh project in the SQL editor. Keep migration history consistent with the chosen method. Future changes must be new migrations, not edits to an already applied migration.

Verify RLS on all business tables, `authenticated` cannot insert/update/delete protected tables, `anon` cannot execute application commands, and authenticated callers cannot execute private helpers, cron or integrity functions. With two staging businesses and two signed-in roles, repeat forged-ID and revoked-membership tests against the hosted RPC, not only the local shim.

## Email access

Disable public signup; enable email authentication and confirmation. Customize the email OTP template to display `{{ .Token }}` and direct users back to Catera's `/verify` screen. Set the environment's site URL and permitted redirect URLs in Supabase. Catera requests `shouldCreateUser: false`; the server creates an Auth account only for an existing pending invitation. Manual provisioning creates the first owner account without sending a message.

Configure Resend SMTP with a verified sender domain and its supplied host, port and credentials. Supabase's built-in sender is intended for testing and has delivery restrictions. Follow the current [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp). Verify the sender's DNS setup and actual delivery to an invited address outside the project team.

Check: correct code, wrong code, expired/reused code, expired session, logout, multi-business workspace choice, subscriber activation, and immediate rejection after membership revocation. A customer may remain unlinked indefinitely. Staff record the invitation in Settings and give the customer the login URL using the existing onboarding process; automated invitation announcements are not part of this pilot.

## Onboard a caterer

From a private operator environment containing the intended project's credentials:

```text
node --env-file=.env.operator scripts/provision.mjs dapur-contoh "Dapur Contoh" owner@example.com
```

This creates the business, its lunch/dinner slots, owner membership and audit entry. It sends no email. Repeated provisioning does not create a duplicate business or membership. Confirm the owner by email OTP, then let that owner configure policies, add customers, define packages, record external purchases, invite subscribers/staff, publish menus, and review schedules in the UI.

Review purchase start dates and validity carefully. A grant's purchased terms are immutable; package edits affect later purchases. Use an owner quota adjustment with a reason for a legitimate entitlement correction. Do not edit or delete ledger rows manually.

## Automatic work and monitoring

Enable `pg_cron`, then execute `scripts/install-cron.sql` as the database owner. It installs an every-minute production freeze and a 15-minute integrity check, replacing only Catera's named jobs when rerun. Inspect runs in the Supabase Cron dashboard. [Supabase Cron documentation](https://supabase.com/docs/guides/cron)

Cutoff checks remain synchronous even if cron is delayed. A late admin edit ensures the baseline freeze first. If no default exists, the incomplete production version is visible in Production; publish the missing default with a reason before marking deliveries ready.

```text
node --env-file=.env.operator scripts/health-report.mjs
```

The command prints aggregate overdue-freeze, unresolved-failure, incomplete-production, integrity and cron-failure counts. It emits no customer details and exits 2 for an actionable condition or stale/missing reconciliation. Connect it to the pilot operator's monitoring system, and verify the alert destination before release. Hosted alert delivery is not configured in this checkout.

Application rejections log only `event=catera.command_rejected`, command action, stable error code and request ID. Search these events in Vercel logs for failure spikes and correlate request IDs with restricted audit data when needed. Never enable full payload logging. Auth failures and email deliverability are monitored in Supabase/Resend.

For a failed delivery, inspect its event history, then explicitly retry or cancel. The reservation remains until resolution. For an incorrect delivery confirmation, the owner chooses **Batalkan konfirmasi terkirim** with a reason; the app appends a reversal and restores the reservation.

## Backups, restoration and incident handling

Check the actual project's backup schedule, retention and restore options. Do not assume a subscription tier provides a particular recovery guarantee. Supabase documents database backups and their scope, including the distinction from Storage objects. [Database backups](https://supabase.com/docs/guides/platform/backups)

Before real use:

1. Record a synthetic staged purchase, upcoming reservations, delivered usage and a production revision. Export that selected version and record non-sensitive counts and checksums.
2. Take the configured hosted backup. Restore it into a separate isolated recovery environment using the project's supported restore procedure. Never use production as a test destination.
3. Reapply/verify application configuration, Auth settings and cron jobs as needed. Verify membership isolation and compare ledger/reservation totals, production revision content and the selected export.
4. Run `select public.check_integrity();` as an operator and require `[]`. Confirm access and email behavior. Record recovery point, elapsed restore time and the operator/evidence.

The automated local PGlite backup test verifies data round-tripping only. It does not establish hosted recovery time, Auth recovery, credentials, SMTP configuration or provider disaster recovery.

During an accounting incident, stop affected operational writes, preserve logs and a backup, inspect immutable audit/ledger history, and resolve through a documented compensating command or reviewed corrective migration. Do not delete history to make totals match. For an application regression, return to a verified deployment compatible with the current schema; database rollback needs a reviewed forward repair or a tested restore procedure. Recovery may require reconciling real deliveries completed after the recovery point.

## Release checklist

- [ ] Private remote and clean-checkout CI green; deployment commit recorded.
- [ ] Separate staging/production credentials, Singapore placement and demo disabled.
- [ ] Fresh hosted migration and caller-JWT/RLS tests verified across two caterers.
- [ ] Custom SMTP and OTP/session/invitation journeys verified externally.
- [ ] Purchase → reserve → default/freeze → ready → dispatch → delivered → history verified in staging.
- [ ] Subscriber meal/skip/reschedule/address changes agree with staff views.
- [ ] Cutoff race, missing defaults, revisions, failed delivery and owner reversal rehearsed.
- [ ] Cron runs, failed-job visibility and actionable alert delivery verified.
- [ ] Hosted backup restored separately and reconciliation/export checks passed.
- [ ] Realistic pilot dataset/network performance measured; larger history uses scoped/paginated reads.
- [ ] Named pilot operator accepts the runbook and records release evidence.

Keep the release checklist unapproved until the external checks actually pass. No real customers are part of the supplied fixtures.
