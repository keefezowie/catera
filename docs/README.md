# Catera documentation

Read [PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) for the approved product and visual contracts. Start with the relevant current document below; completed audits and the former pilot are historical evidence, not new instructions.

| Work | Current entry points |
| --- | --- |
| Architecture and release | [Implementation](IMPLEMENTATION.md), [release plan](CATERA-V1-IMPLEMENTATION-PLAN.md), [runbook](RUNBOOK.md) |
| Web presentation | [V1 surface brief](V1-UI-BRIEF.md), [landscape details](V1-LANDSCAPE-OPTIMIZATION.md), [spacing](WEB-SPACING.md), [motion](WEB-MOTION.md), [conditional surfaces](CONDITIONAL-UI-AUDIT.md), [action ownership](UX-CLARITY-2026-09-29.md) |
| Packages and menus | [Contents](PACKAGE-CONTENTS.md), [lifecycle](PACKAGE-LIFECYCLE.md), [reusable dishes](REUSABLE-DISHES.md), [slot menus](SLOT-MENU-CALENDAR.md), [customer choices](CUSTOMER-CHOICE.md) |
| Customer and seller journeys | [Meal calendar](MEAL-CALENDAR.md), [Saved discovery](SAVED-DISCOVERY.md), [approved Saved brief](SAVED-DISCOVERY-BRIEF.md), [seller operations](SELLER-OPERATIONS.md), [setup and unperformed study](CATERER-SETUP-SIMPLIFICATION.md) |
| Payments and settlement | [Direct payments](DOKU-DIRECT-PAYMENTS.md), [DOKU sandbox](DOKU-SANDBOX-INTEGRATION.md), [QRIS acceptance](QRIS-SANDBOX-ACCEPTANCE-2026-09-22.md), [multi-cycle contract](MULTI-CYCLE-PURCHASES.md), [paid seller pilot](PAID-SELLER-PILOT.md) |
| Synthetic environments | [Hosted demo](HOSTED-DEMO.md), [baseline and recovery](V1-DEMO-BASELINE.md), [catalog](CLEAN-CATALOG.md), [image credits](CLEAN-CATALOG-IMAGE-CREDITS.md), [settlement fixtures](SETTLEMENT-MOCK-DATA.md), [browser fixtures](RUNBOOK.md#13-isolated-browser-fixtures-and-carried-forward-gates) |
| Native and artwork | [Current native backlog](CATERA-V1-NATIVE-PARITY-BACKLOG.md), [native setup](../apps/customer/README.md), [brand provenance](../packages/brand/README.md), [mascot motion](MASCOT-MOTION.md) |
| Report follow-up | [Slack checkpoint and unresolved cases](SLACK-BUGS.md) |

## Historical records

Historical source, reports and verification artifacts are indexed at commit `525a1392797097f0959bebce1a275cfc117643fb` ([browse baseline](https://github.com/keefezowie/catera/tree/525a1392797097f0959bebce1a275cfc117643fb)). The October 6, 2026 cleanup removed 30 historical documentation files; the pilot source, tracked output artifacts and critique reports remain in the checkout. No Git history was rewritten. Old results describe their original dates and environments; they do not certify today's branch or a hosted release.

| Historical group | Original paths at that commit |
| --- | --- |
| Superseded pilot source, tests and guidance | `archive/pilot/` |
| Saved verification output and temporary scripts | `output/` |
| Completed design critiques | `.impeccable/critique/` |
| Account/settings review | `docs/ACCOUNT-SETTINGS-{DESIGN-REVIEW,RESEARCH,UIUX}-2026-10-01.md`, `docs/COMBINED-WEB-VERIFICATION-2026-10-02.md` |
| Caterer usability and integration | `docs/CATERA-CATERER-UX-IMPLEMENTATION-PLAN.md`, `docs/CATERA-CATERER-UX-VERIFICATION.md`, `docs/CATERA-USABILITY-SWEEP.md`, `docs/CATERER-JOURNEY-IMPLEMENTATION-2026-09-24.md`, `docs/V1-JOURNEY-MOTION-INTEGRATION-2026-09-24.md`, `docs/V1-WORKTREE-INTEGRATION-2026-09-22.md` |
| Completed UI sweeps | `docs/IMPECCABLE-UIUX-{SWEEP,SECOND-SWEEP}-2026-09-27.md`, `docs/MARKETPLACE-CHECKOUT-QUALITY-2026-09-24.md`, `docs/UI-REFINEMENT-2026-09-30.md`, `docs/UI-SWEEP-2026-09-12.md`, `docs/UIUX-RESEARCH-2026-09-19.md`, `docs/codex-improvement-log.md` |
| Fix and hosted-verification reports | `docs/FIXES-2026-09-10.md`, `docs/NATIVE-FIXES-2026-09-10.md`, `docs/SELLER-SCREENSHOT-FIXES-2026-09-19.md`, `docs/MULTI-CYCLE-LIVE-ENABLEMENT-2026-09-21.md`, `docs/SUPABASE-MIGRATION-VERIFICATION-2026-09-11.md`, `docs/SLACK-{0017-0027,0028-0034,0035,0037-0041}.md` |
| Superseded pilot documentation | `docs/SUPPLIED-PROJECT-CONTEXT.md`, `docs/UI-BRIEF.md`, `docs/VERIFICATION.md`, `docs/verification/benchmark.json` |

Braces above abbreviate separate filenames. Retrieve only the needed file, without restoring the old tree:

```sh
git show 525a1392797097f0959bebce1a275cfc117643fb:docs/CATERA-CATERER-UX-VERIFICATION.md
git ls-tree -r --name-only 525a1392797097f0959bebce1a275cfc117643fb -- archive/pilot docs output .impeccable/critique
```

## Local verification artifacts

New screenshots, traces, generated reports and fixture metadata belong under ignored `output/`. Retained documents may name historical output paths; links to uncommitted artifacts point here and keep the original path in their link title. Check the original local worktree or rerun the retained tests when that evidence is needed. Only files returned by the baseline `git ls-tree` command are recoverable from Git; ignored screenshots and local-only reports are not implied to exist in history.

Fresh verification must use the current source and isolated synthetic data. Fixture instructions and unresolved external acceptance are preserved in the [runbook](RUNBOOK.md#13-isolated-browser-fixtures-and-carried-forward-gates); native and provider documents retain their separate evidence limits.
