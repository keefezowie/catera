# Import review: Mobbin references (2026-11-05)

Phone references for the step after the assistant reads a customer list, where the caterer fills in what is missing. Canvas: https://claude.ai/artifact/6jPmGwgobVfYoQEufTsfcz

## What is wrong today

- `apps/caterer/src/import/rows.ts`: every problem joins into one sentence (`reason`), shown above the form and not at the field it belongs to.
- "Sisa hari perlu dicek" fires when the value is above the package's days, and never says the limit.
- `RowEditor.tsx`: Selesai closes the sheet whatever the state, so an incomplete row gives no reaction.
- `RowEditor.tsx`: the date is typed as TTTT-BB-HH, though `CalendarSheet` exists in `packages/mobile-ui`.
- `RowEditor.tsx`: package chips have no heading and do not show their days, which is the number the limit depends on.
- `ImportAssistant.tsx`: "Simpan 0 pelanggan" is a disabled button that names no next step.

## Patterns taken (iOS)

| Pattern | Reference | Use |
| --- | --- | --- |
| Date field opens a calendar with past days struck out | [Polarsteps](https://mobbin.com/screens/89b970dc-4d18-4068-bb5c-265294e92591) | Antar berikutnya |
| Bottom-sheet month calendar with a confirm button | [Shopee](https://mobbin.com/screens/a647baad-25cf-4db5-be80-c262032fee1f), [Agoda](https://mobbin.com/screens/850a16fc-6363-46f4-b765-57111d0122c8) | Calendar sheet |
| Error under the field stating the rule | [CLEAR](https://mobbin.com/screens/9df38301-1932-4865-aa91-53179970adfe), [Revolut Business](https://mobbin.com/screens/cee22708-60af-4d6b-b75b-aa7e53e7bd9e) | Field messages |
| The limit stated up front, + greyed at the limit | [Burger King](https://mobbin.com/screens/15ca65f6-1717-45da-8738-43babe206e36) | Sisa hari |
| Stepper with a typable number between the buttons | [Wanderlog](https://mobbin.com/screens/c0d34a1b-b606-43a6-8d2b-7a70801f87e2) | Sisa hari, for 20-day packages |
| Met and unmet requirements listed with progress | [X](https://mobbin.com/screens/596dda19-5f73-4207-b118-3b2dca5ffce1) | Progress bar, "Kurang N lagi" |
| Sectioned client form with a pinned Save | [Jobber](https://mobbin.com/flows/bf3ff85f-8559-4f6b-8296-f4e441f81ab9) | Kontak, Alamat, Langganan groups |
| Confirm what was read, with add, delete and modify | [Splitwise](https://mobbin.com/flows/973eb780-6f72-4489-8bf5-da466a4c4bf3) | Closest phone match for the review step |

Web, for grouping only: [Attio, resolving import issues](https://mobbin.com/flows/535a7828-5915-47a2-b782-c6bfd708adc0) separates "Needs review" from what mapped cleanly.

## Gap

Mobbin's mobile catalogue is iOS only, and no phone app there has a true bulk-import review. The list structure is adapted from Attio's web flow.
