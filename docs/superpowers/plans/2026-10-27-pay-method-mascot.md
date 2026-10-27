# Plan: payment method choice and mascot space

Spec: [2026-10-27-pay-method-mascot-design.md](../specs/2026-10-27-pay-method-mascot-design.md). Owner picks: **1A**, **2B** on Beranda, 88 for page-only states, both apps. Branch v2, main tree. Unit tests only (owner ruling, 2026-10-27): no emulator gate.

Models per the usage rules: Sonnet builders (up to 3 attempts, then one Opus), Opus reviewer. TDD: change or add the test first, see it fail, then the code.

Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json` or `.claude/`. The tree has unrelated uncommitted changes (DESIGN.md, app configs, `_layout.tsx` files, tokens, LaunchCover, MoodHeader): stage only the hunks each task makes.

## Baseline

Run once, in the background, before Task 1: `npm run typecheck`, `npm test`, `npx jest` in `apps/customer` and `apps/caterer`. Record existing failures in the ledger; a task is judged against them.

## Task 1: payment row, method catalogue and grouped picker (1A + 3A)

Owner picks (2026-10-27): 1A row, 3A picker, logos fetched from the internet where possible (placeholder tile otherwise). Scope: the UI holds every DOKU method; the server still offers QRIS and BRI VA, so no backend change.

Files: `packages/domain/src/paymentMethods.ts` (new, exported from the domain index), `packages/brand/assets/payment/*.png` and `packages/brand/assets/payment/manifest.json` (Task 1a), `apps/customer/src/buy/paymentLogos.ts` (new: logo key to `require`), `apps/customer/src/buy/PayMethodSheet.tsx` (new), `apps/customer/app/pembelian/bayar-pakai.tsx` (new), `apps/customer/app/_layout.tsx` (one line, stage only that hunk), `apps/customer/src/buy/BuyParts.tsx` (`PayWith`), tests in `apps/customer/tests/buy.test.tsx`, `customer-sheets.test.tsx` and a new `pay-methods.test.ts(x)`.

### Task 1a: logos (runs beside 1b)

Fetch official marks from Wikimedia Commons (or the brand's own site), as PNG with transparency where the source has it, about 128px tall. One file per logo key: qris, ovo, shopeepay, dana, linkaja, doku, bca, mandiri, bsi, bri, bni, permata, cimb, danamon, btn, bnc, sampoerna, bjb, sinarmas, alfamart, indomaret, akulaku, kredivo, indodana, visa, mastercard, jcb. The manifest records for each: source URL, licence or trademark note, pixel size, and whether it really has an alpha channel (never call an opaque file transparent). A logo that cannot be found is left out and listed as missing.

### Task 1b: catalogue, row and picker

Catalogue: one entry per DOKU code (research addendum list): `code`, `group` (`qris` | `ewallet` | `va` | `card` | `retail` | `paylater`), `name` and `detail` in id and en, `logo` key. Group order and Indonesian titles: QRIS (no title), "E-wallet", "Transfer bank", "Kartu", "Bayar di gerai", "Paylater". Helpers: `paymentMethodInfo(code)` (undefined for unknown codes) and `groupPaymentMethods(codes)` (known codes only, in catalogue order, grouped). The server types (`DirectPaymentMethod`) stay; the catalogue takes plain strings.

Row (`PayWith`, both Beli and Bayar): a 40 tile (radius 12, surface, 1px line) with the logo at 28 tall, contain; the group glyph when there is no logo. Name in `bodyStrong` from the catalogue ("BRI Virtual Account", "QRIS"), detail in `meta`. Trailing "Ubah" (label "Ubah cara bayar" / "Change payment method") only with more than one method. Remove the old switch, the bordered card and "Pakai …".

Picker (`/pembelian/bayar-pakai`, `sheetOptions({ detents: "fit" })`; the fit body scrolls when long): asked with `parkQuestion` / `useQuestionRoute` like `src/choice.tsx`, input `{ codes, selected }`, answer a code or null. Title "Bayar dengan". Sections in group order; section titles show only when more than five methods are available. A group with one method is a plain radio row. The VA group with two or more banks is one row ("Transfer bank (VA)", detail lists the first four banks and "dan n lainnya", or the chosen bank) that expands in place to its bank rows; it starts open when the chosen method is a VA. Rows are 64 minimum, `accessibilityRole="radio"` with `checked`; the VA row is a button with `expanded`. Choosing closes the sheet and answers once it has gone.

Tests first: catalogue (every code in the research list has an entry; unknown codes skipped; grouping order; VA detail text). Row: name, detail, logo or glyph, "Ubah cara bayar" only with two or more. Picker: two codes give two plain rows and no section titles; seven or more give titles in order; the VA row expands and lists banks; choosing answers the code; close answers null. Update `buy.test.tsx` 481, 1253 and 2060-2115 to go through the sheet. `customer-sheets.test.tsx`: `expectSheet("pembelian/bayar-pakai", "fit")`.

Done when: new and updated tests pass, customer Jest and typecheck have no new failures.

## Task 2: Beranda heading row (2B) and mascot out of the other content screens

Files: `apps/customer/src/today/EmptyHome.tsx`, `apps/customer/src/today/Beranda.tsx`, `apps/customer/src/schedule/Jadwal.tsx`, `apps/customer/tests/empty-states.test.tsx`, `apps/customer/tests/schedule.test.tsx`, and any other test the grep below finds.

Tests first:

1. `empty-states.test.tsx:520-625` (empty Beranda): keep the `mascot-melambai` / `mascot-melambai-slot` cases (art without a recap, held slot while the recap's marks are read, no art while the recap shows). Add: the art and the title share one row (the art's parent is a row with the title column), the title is not centred, and the art draws at 64 (its `mascot-art-fade` frame height is 64; Task 3 adds the compact 52 case).
2. Same file, Beranda with nothing today or next: assert no `mascot-tidur` or `mascot-tidur-slot`, with or without the recap.
3. `schedule.test.tsx:954`: an empty month shows no `mascot-tidur`. The failed-month `mascot-bingung` case (`empty-states.test.tsx:462`) stays.
4. Grep `apps/customer/tests` for `mascot-tidur` and `textAlign: "center"` on the Beranda title; update only Beranda and Jadwal cases. `help.test.tsx:537-556` (Laporan) and `masuk-layout.test.tsx` (auth) stay.

Code:

- `EmptyHome.tsx`: the heading block becomes `<View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 }}>` with a `flex: 1, minWidth: 0, gap: 6` text column (title, subtitle, no `centred`) and, when `art`, `<StateArt pose="melambai" base={64} held={held} />` on the right. Drop `centred` and the `marginBottom`. Update the comment.
- `Beranda.tsx`: drop the `tidur` block (373-380) and its comment. `recapShown` stays (EmptyHome's `held` reads it through `leadShown`).
- `Jadwal.tsx:198-199`: drop the `monthEmpty` art line; remove `monthEmpty` if unused.

Done when: those tests pass and customer Jest has no new failures.

## Task 3: smaller page-only art

Runs after Task 2 (both touch `empty-states.test.tsx`).

Files: `packages/mobile-ui/src/brand/StateArt.tsx`, `packages/mobile-ui/src/ReadError.tsx`, a test for `stateArtSize`.

Tests first: add or update a `stateArtSize` test (put it beside the existing mascot tests in `apps/customer/tests/mascot-art.test.tsx`): 88 at font scale 1, 72 at 1.3 on a 360dp phone, 88 at 1.3 on a 412dp phone, base 72 gives 72 and 59. Check that `MascotArt` size tests at 120 and 180 (lines 62-138) do not depend on `STATE_ART`; they render `MascotArt` directly and stay.

Code: `STATE_ART = 88`, `STATE_ART_COMPACT = 72`; update the two doc comments (120 and 96 now read 88 and 72). `ReadError`: `marginBottom: 8`. Grep Dapur (`apps/caterer/src`, four `StateArt` uses) and its tests for 120 or 96 assumptions and update them.

Done when: customer and Dapur Jest have no new failures.

## Task 4: DESIGN.md and docs (Sonnet)

After Tasks 1 to 3 merge. DESIGN.md has the owner's uncommitted edits: add only new text, stage only those hunks.

- New section at the end, "Payment method and mascot space (October 2026)": the 1A row and sheet (route, anatomy, strings, one-method case), the 2B Beranda row (64 beside the heading, the one still on a page with food photos), the placements removed and kept, the 88/72 sizes, the verification limit (unit tests only, nothing checked on a device).
- `DESIGN.md:904-908`: one line under the `StateArt` bullet, "Superseded in part (October 2026): 88 (72 compact); the empty Beranda's hello is 64 beside its heading; Beranda with nothing today and the empty Jadwal month show no still. See Payment method and mascot space."
- Handoff: `docs/superpowers/handoffs/2026-10-27-pay-method-mascot-handoff.md` (branch, commits, rulings, open device checks).

## Final check (Opus reviewer)

One review of the whole diff against the spec. Then, once, in the background: `npm run typecheck`, `npm test`, customer and Dapur Jest, `npm run build`. Report counts against the baseline. No push without the owner's yes.
