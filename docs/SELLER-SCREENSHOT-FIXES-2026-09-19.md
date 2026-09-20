# Seller screenshot repairs — September 19, 2026

## Missing data in Today, Transactions and Settings

The web client already requested `seller-attention` and `payout-setup`, but hosted V1 (`ygzfdqrljunngfrdygzt`) had neither RPC wrapper installed. Its last migration was earned settlement. Payout setup is shared by Transactions and Settings; changing an empty-state label would not repair these failures.

Applied the existing repository migrations in order:

| Repository migration | Hosted version / name |
| --- | --- |
| `20260915142010_settlement_reporting.sql` | `20260919025959` / `v1_settlement_reporting` |
| `20260916061905_seller_experience.sql` | `20260919030008` / `v1_seller_experience` |
| `20260917131119_beta_operations.sql` | `20260919030018` / `v1_beta_operations` |
| `20260919030408_seller_rpc_permissions.sql` | `20260919030432` / `v1_seller_rpc_permissions` |

The last migration removes anonymous command execution inherited from hosted default privileges when a wrapper is recreated. Authenticated commands and anonymous catalog reads remain available. The PostgreSQL regression explicitly reproduces this default-grant condition before checking the repair.

Hosted verification used transaction-local owner identity and rolled back the read transactions. Every owner received an attention object with an items array and a payout setup object with settlement data. Settlement reporting also returned an object. These are direct hosted database/RPC checks, not a claim of authenticated production browser acceptance.

Before and after: 50 subscriptions, 222 delivery days, 76 settlement entries, ledger total `4367653`, and zero payouts. No seed/reset, payment dispatch or customer-data replacement was performed. New private tables have RLS enabled and deny direct authenticated SELECT.

The security advisor also reported existing mutable search paths on `v1.immutable`/`v1.snapshot_guard`, disabled leaked-password protection, and informational no-policy notices for private RPC-only tables. Those unrelated configuration items remain outside this screenshot fix. [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter).

## Package layout

The duration `<details>` occupied the 110px photo track of a two-column package card. Its nested three-column form overflowed that track, while grid stretching expanded the neighboring card.

The editor now spans the full card, with a visible expand indicator, separate cycle/day labels, aligned discount controls and totals, and a compact portion-preview input. Cards align to their own content height. Narrow cards stack fields as needed. Seller card prices use the existing per-meal calculation; stored daily prices and purchase totals are unchanged.

## Verification and release status

- Typecheck, 198 unit tests, production build and 21 PostgreSQL scenarios passed.
- Eight browser regressions passed at 390, 768, 1440 and 1920px in Indonesian and English. Checks cover all three data pages, duration-field overlap, document overflow, neighboring card height, discount save and persistence after reload, and uncaught browser errors.
- Reviewed desktop and phone screenshots under `output/screenshot-fixes/`.
- Browser verification used explicitly synthetic, isolated local storage; hosted repair used V1.
- Database migrations are live. Frontend source changes have not been committed, pushed or deployed.
