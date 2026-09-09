# Catera shared hosted demo

This configuration is only for the user-authorized synthetic demo, not production
customer onboarding. It uses the existing Catera UI, genuine Supabase user
sessions, and the same database authorization and transactional RPCs.

## Existing infrastructure

- Source: `keefezowie/catera` (not `outsiders-coder/Catera`).
- Vercel: project `catera`, project ID `prj_VogIJfLigT2auxniG2LEs5TerhSt`.
- Vercel team: `team_33Es5MRZqQh8sZyBym3Q9cnB` / `keefezowies-projects`.
- Supabase: `Catera Demo`, ref `otmanljypltxkwjcebni`, Singapore, Free plan.
- Supabase organization: `kwbuhvbgzdsybtbkjcyt`.
- Edge Function: `catera-demo-login`, already deployed; JWT verification enabled.

The function accepts only POST JSON with a `role` equal to `owner`, `admin`, or
`subscriber`. It checks its own Supabase URL against the isolated project,
creates/locates three allowlisted synthetic users, initializes fixtures once via
`initialize_hosted_demo`, and exchanges a server-generated token for a real user
session. It does not send email. Never replace this with service-role access in
the browser or a production authorization bypass.

`vercel.json` includes ONLY public connection identifiers/keys and demo flags.
The legacy anon key is public and is used for the Edge Function JWT gateway;
the publishable key is used by the normal Supabase client. No service-role key,
secret key, database password, or private signing secret belongs in Git.

## Behavior

Login shows the existing Owner / Admin / Subscriber buttons. Session creation
runs server-side. Normal Supabase session refresh and authorization remain in
use. Local PGlite mode stays local-only. Logout uses local session scope in the
shared hosted demo so one visitor does not sign out every visitor of that role.

All visitors using a role share synthetic records. Never enter real customer
information. No automatic fixture reset or rolling-date refresh is configured.
Seeded dates are relative to first initialization, so data may need refreshing
for later demonstrations. Reinitialization should not delete existing records
without explicit operator approval. The Free database may pause when inactive;
resume it manually rather than adding activity solely to prevent pausing.

## Verification required before calling the deployment complete

Run typecheck, unit tests, build, and the local browser suite. Then use the actual
Vercel deployment to test each role, workspace selection, refresh/persistence,
a representative permitted write, forbidden-role operations, and logout.
Check database privileges on `initialize_hosted_demo` (service role only) and RLS.
There should be no email form or real-email onboarding in hosted demo mode.
Do not claim browser success based only on an Edge Function HTTP response.

For production later: turn off hosted demo, remove the public demo deployment
configuration, use a separate real-customer project, and complete the operating
runbook. Never turn this shared demo database into the customer database.
