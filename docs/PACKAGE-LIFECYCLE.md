# Package lifecycle - Slack ID 0013

Source: https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789143620281079

Drafts remain editable so incomplete packages can be finished. Published packages cannot be revisioned, repriced, reclassified, returned to draft, or reopened. Create a separate package for new terms. Dated menus still service existing purchased revisions.

The owner uses Suspend, then Archive. Suspension removes the package from the shared web/native catalog and rejects checkout quotes, new checkout requests and imports. Existing checkouts with live holds can complete and existing deliveries continue. Archive checks every delivery date, including overdue and issue states, and live payment holds inside the same transaction that locks the package. Delivered and cancelled days are terminal. Late payment after archive creates the established payment exception/support case and no subscription. No seller deletion endpoint exists; archived records remain available for history.

`package.suspend` and `package.archive` require caterer ID, package ID, version and request ID. Owner authorization, optimistic version checks, receipt replay and audit logging are transactional. The wrapper preserves operational batch commands and revokes access to the internal legacy entry point. Existing paused package rows migrate to suspended. Existing retired rows retain their archived state. Existing purchase snapshots and historical content revisions remain unchanged.

Migration: `supabase/migrations/20260911163608_package_lifecycle.sql`. The later nutrition migration preserves suspended status and the lifecycle validator extends existing rules without replacing nutrition validation.

## Verification

- Unit/integration suite: 103 tests passed; five dedicated lifecycle tests cover draft completion, immutable published terms, authorization, idempotency, discovery/import/checkout denial, purchased deliveries, holds, archival and late payments.
- PostgreSQL: 11 checks passed, including deterministic suspension-before-checkout locking, concurrent archival and archive/payment race handling. Evidence: `output/slack-bugs/0013/postgres.json`.
- Web/Expo/workspace typecheck and production build passed. Native: 31 tests across seven suites passed.
- Browser: desktop 1440px and phone 390px layouts inspected, no horizontal overflow or error overlay, no console errors. Real Suspend/Archive interactions passed, a package with remaining deliveries disabled Archive, archive survived reload, and the catalog excluded suspended/archived packages. Screenshots: `output/slack-bugs/0013/desktop.png` and `mobile.png`.

Local source and isolated synthetic demo only. No hosted migration, deployment, commit/push or Slack message was performed. An already-running demo that cached its database constructor needs a restart to load the migration.
