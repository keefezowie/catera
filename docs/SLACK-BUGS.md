# Slack bug tracker

Channel: [#bugs](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS). Monitoring every 30 minutes in the originating Codex task. Last full channel scan: September 10, 2026; newest message `1789034247.968729`. Revisit unresolved threads and deduplicate by message timestamp, including new replies to older reports.

## Latest fixed

September 10, 2026 — fixed the marketplace navigation and responsive discovery reports: the food hero now leads the catalog, location/search controls sit below it, the hero remains stable while filtering, language control spacing is tightened without shrinking its touch target, and desktop/mobile active navigation follows anchors, routes, reloads and Back. Validation: navigation regression 3/3, typecheck, unit tests, build and PostgreSQL concurrency checks passed. Committed and pushed as `5965246` to `v1`; two unrelated journey tests still fail.

## Current reports

| Report | Plan and status |
| --- | --- |
| [Hero and location layout](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789034247968729) | Implemented locally: hero leads, delivery/search controls begin the following catalog section. Interpret “next page” as the next section, preserving existing anchor navigation. Keep hero mounted while filtering to avoid scroll jumps. Screenshot attachment transport returned metadata but was not visually inspected; verify any subsequent clarification. |
| [Language spacing](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789033112399299) | Implemented locally: specific selector overrides generic select spacing with 4px gap while preserving a 44px minimum touch target. |
| [Desktop current section](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789032923190529) and [follow-up](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789032929609669) | Implemented locally: derive selected section from scroll position, handle initial anchors after content appears, use aria-current, and handle the bottom of short pages. |
| [Phone navigation](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789032955566119) | Read parent and reply `1789032998.956289`. Implemented locally: map routes and child pages to customer destinations so selected state persists after navigation, reload and Back. This report concerns responsive web; native source was not changed. |
| [Unspecified spacing screenshot](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789032164485409) | Needs screenshot inspection before closing. Existing commit `9bea733` fixes marketplace toolbar alignment, but the text alone does not establish that it resolves this report. |

## Validation and push gate

<<<<<<< HEAD
Base: `9bea733` on `v1`; fix commit `5965246` is pushed to `origin/v1`. Full browser suite is not passing.
=======
Base: `9bea733` on `v1`; fetch confirmed HEAD and origin/v1 matched before edits. No commit or push yet: full browser suite is not passing.
>>>>>>> origin/v1

- Typecheck, 48 unit tests and production build passed during this run; final build/typecheck repeated after anchor correction.
- Navigation regression suite: 3/3 passed with installed Google Chrome via `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Covers desktop anchor selection, direct anchor load, scroll back to top, 1440/390px hero/filter order, stable filtering, language gap/touch target, mobile route navigation, reload and Back.
- Desktop and phone screenshots visually inspected: `output/slack-bugs/catalog-1440.png` and `catalog-390.png`.
- Impeccable source detector returned no findings for changed components. React review: passive scroll listener, frame batching, cleanup of observer/listeners/frame, route-derived state, accessible current markers.
- PostgreSQL: all five concurrency/security checks passed with a fresh disposable local `catera_test` on port 15449; evidence in `output/verification/postgres.json`. Default embedded startup exited without new evidence; use an explicit disposable database and require fresh evidence, not exit code alone. Port 55449 was unavailable; 15449 worked.
- Full browser run: 11/15 passed initially. Both navigation failures were fixed and their 3-test suite then passed. Two broader journey failures remain unresolved: checkout quote returns “Akun ini tidak memiliki akses” (expected 10 preview days), and seller production has no expected “Unduh CSV” link. Their causes are not established. Investigate them before committing/pushing; do not weaken assertions or report all tests green.
- Automatic approval review rejected starting an isolated web test server with copied synthetic fixtures, reporting only “blocked by policy.” No isolated server was started; browser tests used the existing localhost:3000 server.
- No native implementation changed; workspace native typecheck passed. No physical-device certification or production deployment is claimed.

## Next run

<<<<<<< HEAD
Continue from `5965246` before starting duplicate work. Resolve the two journey failures, rerun the full required checks, then stage only intended source/tests/docs and selected evidence. Existing uncommitted artwork, APK, attachments and prior output changes belong to other work. Never force-push or include unrelated files. Record the next commit and verified remote hash here after a successful push. Notify in the originating task only for meaningful changes; Slack posting is not authorized.
=======
Continue these uncommitted fixes before starting duplicate work. Resolve the two journey failures, rerun the full required checks, then stage only intended source/tests/docs and selected evidence. Existing uncommitted artwork, APK, attachments and prior output changes belong to other work. Never force-push or include unrelated files. Record the commit and verified remote hash here after a successful push. Notify in the originating task only for meaningful changes; Slack posting is not authorized.
>>>>>>> origin/v1
