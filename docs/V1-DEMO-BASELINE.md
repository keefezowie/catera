# Catera V1 synthetic demo baseline

This baseline belongs only to the separate Supabase project `Catera V1` (`ygzfdqrljunngfrdygzt`). The protected historical `Catera Demo` pilot (`otmanljypltxkwjcebni`) is outside its scope.

## What it contains

Baseline source version `2026.09.11.2` builds a coherent, synthetic ecosystem around the four authenticated demo accounts. It has three caterers (two approved and one submitted), six published category-slot packages and one draft, categorized reusable dishes, dated menu revisions, seven customers, eight paid subscriptions, exceptional checkout states, historical/current/upcoming operations, support, conversations, reviews, refunds, payouts, notifications, and immutable production history. Provider references start with `demo-`; all outbound jobs are already marked processed. It does not seed new date-specific capacity overrides; existing legacy rows remain supported by the application.

The visual-menu follow-up normalizes the complete synthetic graph through `demo-slot-upgrade.sql` inside the reset transaction. Every package uses the same visual assembly workflow. Version `.2` was verified with two disposable PostgreSQL restores and equal manifest hashes; this source update was not applied to hosted storage in the ID 0003 task. The older private recovery copy below remains the original baseline.

The customer, seller, staff, and admin accounts therefore exercise the same private RPCs and authorization boundaries as live use. Extra fixture profiles do not have authentication identities and use invented Indonesian names and addresses.

## Generate and apply a reset

The versioned operator source is `scripts/v1-demo-baseline.mts`, outside the migration chain. It anchors dates to the current Jakarta day unless `--anchor YYYY-MM-DD` is supplied.

```powershell
npm run demo:baseline -- --output .data/backups/catera-v1-baseline-latest.sql
```

Apply the generated SQL only to `Catera V1` through the Supabase SQL editor or an authenticated database client. The script:

- takes a transaction-scoped advisory lock;
- requires the four named demo identities and the `catera-demo-workspace` marker;
- requires an approved synthetic policy and refuses unknown caterers;
- deletes and rebuilds only the explicit demo-owned relationship graph;
- preserves Auth identities, schema migrations, Storage, and unrelated rows;
- records version, anchor date, counts, and normalized hashes in `v1.audit`.

There is no automatic reset schedule. Running the generator again intentionally re-centers the calendar around the current Jakarta date.

## Exact local recovery copy

The SQL used for initial population is stored privately at `.data/backups/catera-v1-baseline-2026-09-11.sql`. `.data/` is gitignored. This is a data-only recovery artifact: it excludes `auth`, credentials, tokens, environment configuration, and Storage objects.

To test recovery, apply all repository migrations to a disposable Postgres database, provision the four synthetic identities/workspace markers, apply the saved SQL, and run the invariant query described below. Never restore this fixture into the historical pilot or a non-synthetic project.

## Verification

Run the hosted account journeys without displaying credentials:

```powershell
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '<publishable key>'
npm run demo:verify:hosted
```

The database verification must assert: published packages have approved sellers; package content revisions exist; confirmed/active held demand does not exceed capacity; reviews reference delivered subscriptions; trial use is unique per customer and caterer; unresolved cancellation requests do not release reservations; and combined packages have one daily reservation with two meal fulfillments.

For a reset proof, change one seeded delivery status and one seeded message inside a transaction, apply the saved baseline again, and compare the latest `demo.baseline.reset` manifest counts and hashes with the original manifest.

## Hosted advisor baseline

The September 11 post-population Supabase advisor run found no reset-specific regression. Existing findings remain release work and are intentionally tracked separately:

- the private `v1` tables have RLS enabled without direct table policies because clients use the explicitly granted RPC boundary;
- the public read/command/manifest/reconcile RPCs are `SECURITY DEFINER` entry points by design and enforce authorization internally;
- `v1.snapshot_guard` and `v1.immutable` still need fixed `search_path` settings;
- leaked-password protection is disabled in Auth;
- 32 foreign-key indexing opportunities and one currently unused reservations index remain from the base schema.

The first two items must be reviewed against the private-RPC threat model rather than changed mechanically. The mutable search paths, Auth protection, and useful foreign-key indexes should be closed before a production release.
