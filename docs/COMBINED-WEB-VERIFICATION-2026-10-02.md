# Combined web verification — October 2, 2026

This combines the completed work from the account/settings familiarity review,
"Fix app-wide UI spacing", and "Diagnose new account error" on `v1`.
The source changes from all three chats are integrated in the primary checkout.

- Account/settings: familiar customer and caterer sections, responsive navigation,
  truthful payment status, and padded error/404 recovery. Research and design
  evidence are recorded in [the account/settings review](ACCOUNT-SETTINGS-UIUX-2026-10-01.md).
- Spacing: shared design-token variables, container-owned flow gaps, disclosure
  insets, and seller Today/Schedule spacing. See [Web spacing](WEB-SPACING.md).
- New accounts/workspaces: a fresh-customer empty-feed regression, seller route
  guards, explicit workspace switching, and role-checked workspace activation
  after onboarding. The existing customer-read migration was already tracked
  and was applied with approval in the diagnosis chat; this integration does
  not repeat it. See [the implementation record](IMPLEMENTATION.md).

| Check on the combined primary checkout | Result |
| --- | --- |
| `npm run typecheck` | Passed; web, native and shared TypeScript projects. |
| `npm test` | Passed; 313 tests in 48 files. |
| `npm run build` | Passed; optimized Next.js production build. |
| `npm run test:postgres` | Passed; all 28 concurrency scenario groups. |
| Combined browser regressions | Passed; 169 tests, zero failures, retries or skips (11.7 minutes). |

Browser verification uses an isolated explicit synthetic Webpack development
server at `http://127.0.0.1:3267`, a dedicated demo store and build directory,
and `playwright.settings.config.ts`. The run covers account/settings,
shared spacing, workspace routing, payment states, recovery, conditional UI,
navigation with enlarged text, responsive geometry and existing journeys in
Indonesian and English. Its local report is
`output/playwright/familiar-settings/combined-release-20261002.json`.
Automatic approval review rejected starting the local production preview as
"blocked by policy"; production-browser verification remains unavailable.

The staged scope includes source, relevant regressions, test configuration and
documentation. Generated captures, traces, demo data, temporary Next.js include
paths and pre-existing output/configuration residue are excluded. These checks
are local synthetic evidence; hosted services and provider behavior retain the
existing release gates. This GitHub integration does not apply a new hosted
database change or perform a manual deployment.
