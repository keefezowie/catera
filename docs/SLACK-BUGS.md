# Slack bug follow-up

Last full channel scan: **September 26, 2026**, in [#bugs](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS). The newest report at that scan was **ID 0041**, timestamp `1790409819.948689`. This is a historical checkpoint, not a current channel scan. Reports are reviewed when requested; no recurring monitoring is configured and Slack posting is not authorized by this record.

## Unresolved evidence

- [Unspecified spacing screenshot](https://gknight-workspace.slack.com/archives/C0C0XDLFPFS/p1789032164485409): the original record still requires screenshot inspection before closing. Commit `9bea733` repaired marketplace toolbar alignment, but the report text alone did not establish that it resolved this screenshot.
- Hosted **ID0021** upload acceptance and the original **ID0023** date/address-change failure were not closed by local synthetic checks. Their verification requirements are preserved in [the runbook](RUNBOOK.md#13-isolated-browser-fixtures-and-carried-forward-gates).

## Previous work

The [complete tracker through ID0041](https://github.com/keefezowie/catera/blob/525a1392797097f0959bebce1a275cfc117643fb/docs/SLACK-BUGS.md) preserves report URLs, implementation details, original test failures, local verification and dated release claims. The [history index](README.md#historical-records) locates the completed batch reports.

Before the next requested bug pass, inspect the original report/thread and attachments, then compare with the current `v1` source. Old “next run” instructions, fixture failures and no-deployment statements describe their original sessions; they are not evidence of today's branch or hosted state. Preserve current product contracts and unrelated changes, and obtain current verification before closing a report.
