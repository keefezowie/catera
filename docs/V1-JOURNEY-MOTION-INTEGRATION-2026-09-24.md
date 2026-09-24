# V1 caterer journey and web motion integration

The user authorized committing and pushing both completed change sets to `v1`. Integration starts from `033fb5bfbdb61735f82c39f899a6f43415bd89f6`, which matched freshly fetched `origin/v1`.

## Included work

- `6e15134`: the [19-family caterer journey implementation](CATERER-JOURNEY-IMPLEMENTATION-2026-09-24.md), its authorized-read migration, and regression coverage.
- `21f0dfe`: the [web motion system](WEB-MOTION.md), cherry-picked from `7cedfff` on `codex/web-motion`. Both the notification import and the route-motion import were retained when resolving the only textual conflict.
- Integration fixes make suspension cancellation and profile discard explicit non-submit buttons. Shared dialogs reject form submission during retained exit presence. Browser verification found that retaining the outgoing dialog otherwise allowed the implicit Cancel button to submit the suspension form. The regression now creates its own synthetic package and verifies its persisted published status, duration options, and zero cancellation commands.

The original `D:/Project/Catera/catera` checkout's pre-existing generated TypeScript changes and untracked artifacts are excluded and preserved. No dependencies, hosted configuration, or business command contracts were changed during integration.

## Combined verification

Verification uses the existing isolated synthetic preview on `http://127.0.0.1:3131`, with separate demo storage, and the repository's embedded PostgreSQL runner. Local browser artifacts stay outside the commit.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed web, native-source, and root checks. |
| `npm test` | 38 files / 264 tests passed. |
| `npm run build` | Optimized Next.js production build passed after the integration fixes. |
| `npm run test:postgres` | 27 concurrency/authorization evidence statements passed against embedded PostgreSQL. |
| Combined Playwright selection | 60 tests passed in one final run (8.8 minutes), with no skipped or failed cases. |
| Responsive/accessibility matrix within that run | 80 seller screens across ten routes, two languages and four widths; no horizontal overflow. Forty axe scans at 390/1440 passed. |
| `git diff --check` | Passed. |

The first combined attempt exposed the cancellation defect described above and was stopped for repair. Focused cancellation/profile-discard checks passed before the complete final run. Reports and traces remain in `output/polish-v1/journeys-motion-integration-final-report` and `output/polish-v1/journeys-motion-integration-final-results`; PostgreSQL evidence is copied to `output/playwright/journeys/integration-postgres.json`. Playwright MCP also checked the rendered mobile finance and loaded desktop menu views; its viewport captures remain under the original checkout's `output/playwright/v1-integration-20260924-*` paths. Generated types, logs, browser reports and captures are excluded from the Git changes.

The integration browser selection covers `caterer-journeys`, `caterer-journey-recovery`, `conditional-ui`, `slot-menus`, `featured-hero`, and `web-motion`. This includes Indonesian/English, 320/390/768/1440 layouts, axe checks, loading/failure/retry, retained drafts, nested dialogs and focus, actual synthetic menu/publication/checkout/payment operations, and live reduced-motion cancellation. It is a focused combined regression selection, not a new exhaustive replay of every earlier scenario.

## Release boundary

This authorization covers Git commits and the push to `origin/v1`. It does not apply the hosted migration or manually deploy/promote an environment. The new `20260924150757_caterer_journey_reads.sql` migration remains release-coupled: hosted customer search and saved production-copy recovery need that migration applied and verified separately. An automatic deployment triggered by Git is not evidence of Production acceptance.

Hosted authentication/RLS, real email/SMS, payment-provider callbacks and payouts, other browser engines, physical devices, physical printing and seller usability studies remain outside this local integration evidence. The detailed implementation reports retain the earlier MCP execution record and verification limits; no design MCP was rerun for this Git integration.
