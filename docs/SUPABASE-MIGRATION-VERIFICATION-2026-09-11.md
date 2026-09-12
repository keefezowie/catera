# Catera V1 hosted migration verification

Executed September 11, 2026 against Catera V1, project `ygzfdqrljunngfrdygzt`, with explicit user authorization. The protected pilot was not modified.

## Applied migrations

| Repository migration | Hosted ledger version | Hosted name |
|---|---|---|
| 20260911134456_slot_menu_calendar.sql | 20260911154708 | v1_slot_menu_calendar |
| 20260911150000_shared_recurring_capacity.sql | 20260911154713 | v1_shared_recurring_capacity |
| 20260911150142_seller_operations.sql | 20260911154721 | v1_seller_operations |

Applied the repository SQL in order using Supabase's migration API. The hosted API assigns its own timestamps; names and the table/function checks confirm installation.

## Hosted verification

- Six built-in categories exist; all seven existing offers pass upgraded validation.
- Anonymous catalog RPC succeeded. Seller reads include operational dates and seller-calendar reads return days.
- Retired capacity writes fail with INVALID_ACTION; empty status batches fail with INVALID_INPUT.
- Legacy command and base-reader RPCs are not executable by their checked client roles.
- A transaction created a temporary slot package, saved two dated menus, repeated the request without increasing versions, and read the menu month with categories. Every test write was rolled back.
- Before/after row counts and complete-row MD5 aggregates match for packages (7), subscriptions (8), checkouts (11), production snapshots (2), content revisions (7), and dated menus (4).

## Local verification

- npm run typecheck: passed. An initial parallel run collided with build generation of next-env.d.ts; the sequential rerun passed.
- npm test: 96 tests passed.
- npm run build: passed.
- npm run test:postgres: all ten reported scenarios passed on disposable PostgreSQL, including reservation races, menu-batch rollback/idempotency, seller-batch concurrency, meal independence, and tenant rejection.
- Native Jest: 31 tests passed across seven suites.
- Browser: ten customer-calendar/seller-operations scenarios and six slot-menu scenarios passed against isolated synthetic storage on port 3106. The first slot-suite attempt against the pre-existing port-3000 demo failed and was stopped; all six passed on fresh isolated storage. These are local browser tests, not hosted authenticated browser evidence.
- Agent-browser: isolated marketplace loaded, rendered interactive content, and reported no page errors.

## Remaining boundaries

All 24 existing hosted dishes remain uncategorized. Existing packages and dated menus retain their legacy content format; the migrations intentionally do not rewrite these or purchased history. Sellers must categorize library dishes and create new slot-based listing revisions to adopt the new assembly workflow.

The security advisor still reports existing mutable-search-path trigger functions and disabled leaked-password protection. Private tables have RLS and intentionally rely on authorized RPC access; adding the category table adds the same no-policy informational notice. Advisor RPC-exposure notices require interpretation against the intended public catalog and authenticated business API. No unrelated security configuration was changed.

This verifies the database upgrade and targeted application regressions. It does not deploy web/native clients, verify physical devices, enable real payments, or approve a production launch.
