# Dapur layout pass: handoff, 2026-10-24

Branch `v2`, Dapur work from `78c8f9a2` (plan commit) to `4069ad17`; the DESIGN.md record is `107a44c8`, on top of the customer session's `4415583c`. Nothing is pushed. Contract: DESIGN.md "Dapur layout scale (October 2026)". Spec `docs/superpowers/specs/2026-10-24-dapur-layout-design.md`, plan `docs/superpowers/plans/2026-10-24-dapur-layout.md`, ledger `.superpowers/sdd/2026-10-24-dapur-layout/progress.md` (every ruling, minor and gate line), canvas `https://claude.ai/artifact/UasscRdNooRxK3cPZtPDEo`, captures `output/native-review/layout-2026-10-24/{before,gateA,gateB,gateC}/`.

## What was built

- **D1** (`ce68c472`): Dapur's root provides `LayoutScaleProvider value="v2" target={48}`. `target` (default 44) and `useTouchTarget()` set the `hitSlop` of chips, segments (7) and stepper buttons (2). New `nativeLayout` keys (`row.compact` 64, `row.check` 56, `thumb.compact` 48, `dense.sectionGap` 24, `figure`) and the `figure` Text variant. `layout-classic.test.tsx` became `layout-dapur.test.tsx`; `withDapurScale` test helper.
- **D2** (`9b7bd500`): the customer layout blocks moved to `packages/mobile-ui/src/layout/`, with one-line re-export shims left in `apps/customer`. New `TwoLineRow`, `KeyValueRow`, `FigureStrip`; `MediaRow size="compact"`, `Thumb size`, `SectionHeader` count and node action.
- **D4** (`9ab16cbe`, `ee46d1e8`): Pelanggan is a plain header, a 48 chip frame that scrolls, and one card of 64 rows. The detail is key-value rows, a WhatsApp and renew pair, an address well and schedules capped at five. Skeleton shapes for Pelanggan are opt-in (`shape="customer"`), so every other screen keeps its loading shape.
- **D5** (`3275645f`, `01be4e2a`): the Menu week range sits between 44 chevrons, the day strip is one row of tiles for any package, dish rows are 64 compact media rows with the camera tile as "Tambah foto", and "Simpan menu" is pinned. Dish photos carry their own radius, with no clipping ancestor.
- **D3** (`5845e060`, `2a861ee1`): Hari ini has a band header with the date button, the figure strip and the compact track (`RantangTrack size`); a live slot; "Daftar masak" with 56 check rows and "Per paket"; "Urutan antar" with 64 stop rows; stacked Maps and WhatsApp; the 48 "Sudah dimasak" summary row after departure; a footer of one height.
- **D8** (`f62777ff`, `2eaccbff`, `15196ebe`): the Impor review is one card of 64 rows (portions in the meta, a problem row's reason and pill), with a field-shaped row editor. Masuk, Daftar, Data akun and Aktifkan are on the 16 / 24 rhythm; `ListSkeleton gap`.
- **D6** (`55d4e457`, `90de9861`, `3a6ebe35`): Usaha is a plain header, a Paket section of 72 rows and one Kelola list ending with Pengaturan; Uang leads with a `figure` payout over 40 key-value rows. Package photos sit at 16:10 in `HeroPhotoFrame clip={false}`, delivery days read as ranges, the price and capacity fields keep digits only, and the editor's sections are 24 apart.
- **D7** (`f33f356c`, `a0fa09e4`, `36adda1a`): Atur antaran, Foto bukti, Balas and the Laporan page pin their actions. Sheet cards use `ListCard tone="sage"` (with a dark `line` edge); the proof rows are 72 with a 48 text action; the Move skeleton follows the calendar. Additive `ListCard tone/clip`, `TwoLineRow wrap`, `GlyphCircle tone`, `Thumb icon`.
- **Fix wave** (`75284cd4` Z, `0aed9db5` X, `884b7eba` and `517c30eb` Y, `44feb2a1` test-only), from the final review and gate A. Z: the move calendar sits inside the sheet padding (`inset`), Daftar's footer rises with the keyboard (`AuthScreen footer`, `Screen footerLift`), and the stop-sheet skeleton is sized from the loaded copy. X: check-row photos are unclipped, stop rows hold to 64 (one title line, one meta line, a note line), the figure strip gets a dark edge, and CheckRow / StopRow key on `useTouchTarget() >= 48`. Y: `PhotoThumb`, `KeyValueRow valueWraps`, one `useActionPairStacked` rule, the compact `MoodToggle`, Menu chevron slop, wrapping Usaha names, the "+ Pelanggan lama" haptic, plus a test-only fix for a leaked English locale.
- **Residual round** (`d059236d`, `16298ad9`, `4069ad17`), from gate B. Header actions use `flush` instead of negative margins (`TextAction`, `IconAction`, `HeaderIconButton`); a `SectionHeader` with a node action is 48 tall, and `reserveAction` holds that 48 when the action may appear; the `MoodHeader` v2 top row is `max(44, target)`; the Foto bukti meta and the Pilih status are one line each.

## Rulings (owner proxy, in ledger order, each with its cost if wrong)

1. D3 to D6 run in parallel with section ownership of `skeletons.tsx`: one rebase round.
2. Dapur opts into `v2` (no third scale) with target 48: one token and branch pass later.
3. Hari ini option A (sections) over B (segmented): restructure the Hari ini body.
4. Stop rows keep both trailing buttons (map, "…"): one row change.
5. Sheet side padding stays the shared `sheetSidePadding` (20/24): Dapur sheets 4-8dp wider in margin than screens.
6. Pool worktrees with merged, clean old branches are reused: none.
7. Plan tasks use D-numbers and briefs are extracted by awk: none stated.
8. Hari ini header target ≤ 380 (not 300), fold 2 check rows with a live slot and 4 without: one dish row less above the fold than planned.
9. Maps and WhatsApp stack full width: 58dp more scroll in Antar.
10. Uang hints become meta paragraphs under the list: hints farther from their amounts.
11. The canvas draws the tab bar at 96: a geometry note only.
12. Gates use a second demo backend on :3005 over a synthetic weekend copy: gate data differs from the owner's demo by two weekend days.
13. Folds are measured against the real tab bar (810dp), not the canvas's 820: none; the after boards are 10dp optimistic.
14. The v2 Card's light hairline stays; the spec's "no border" means no classic border: none.
15. Reviewer template uses SL-UI in place of antislop: none stated.
16. D2 leaves the customer layout files as re-export shims: one shim layer to delete later.
17. Merges are rebase-then-ff by the task's builder: one rebase round per task.
18. Dapur accepts the deep-pages grouped SettingsRows cards and Segmented stacking: Dapur Pengaturan looks like the customer's.
19. D3 and D5 follow the owner's Sonnet-first rule over the plan's Opus note: extra fix rounds on the two hardest screens.
20. D5's blank-photo risk is fixed in code (the image rounds itself) rather than proven on the emulator: Menu photo corners drawn by the image, not a clip.
21. "Antar within 48" means the summary row opens where Daftar masak was and Antar follows at 48 + 24: the run still jumps about 400dp at departure.
22. The lead figure label stays "porsi": one label string.
23. D3 minors (footer note lines, strip skeleton subline, LiveSlot focus) are fixed before merge: one scoped re-review.
24. An import-only rebase resolution with green checks merges without a re-review: an import mistake typecheck would already catch.
25. Wrapped chip rows under target 48 keep their rows 14 apart: 14dp more height per wrapped row.
26. Import rows show " · n porsi" when portions ≠ 1, and the row editor shows the count as a meta line: a longer meta line on unusual rows.
27. D8 may add `gap?` to D4's `ListSkeleton` (default 16): none for other callers.
28. A problem import row shows its reason instead of phone and area (against spec 3.7 and the board): phone and area one tap away.
29. `HeroPhotoFrame` gains `clip` (default true); Dapur's package photo passes false: corners drawn by the image only.
30. Contiguous delivery days read as a range ("Senin–Jumat"): one formatter.
31. Kelola rows stay single-line 48 rows without descriptions: four lost hint lines.
32. The import meta becomes "phone · n porsi · area", merged on test evidence: the area is cut first.
33. D7 may add additive props to the shared `ListCard` and `TwoLineRow`: shared-block churn late in the plan.
34. In dark, `ListCard tone="sage"` draws a 1px `line` edge: a hairline on dark sheet cards.
35. Shared `Thumb` gains `icon?`: none for other callers.
36. The unusable shared emulator is killed and cold-booted: another session loses an emulator state it did not need.
37. `MoodToggle` gains `size="compact"` for the Hari ini band and Menu: one shared prop.
38. Stop rows: title "name · n porsi", meta "package · address", the note as one more line: the package text truncates first.
39. The Usaha fold miss (about 26dp with 2 packages) is accepted; staff report cards and no Pilih before departure are existing behaviour (the boards were wrong): none stated.
40. No backend fix in this plan; the gate copy is patched before first boot: gate data differs from a normal boot in one function comment.
41. The fix wave's last open item (`KeyValueRow` alignment) goes back to builder Y: one more short round.
42. Hari ini header 405.3 against 404 accepted: none.
43. Usaha with 3 packages and the payments card, about 86dp past the fold, accepted: one scroll.
44. One residual round for gate B's four defects instead of a second fix wave: one short round and a targeted re-check.
45. Under target 48 the MoodHeader top row is 48 (customer 44): Dapur tab-root headers 4dp taller.
46. A SectionHeader with a node action grows to 48 (from 26): 22dp more on four section headers.
47. A SectionHeader that can carry an action reserves 48 whenever it may appear: a little more header height in those states.
48. The Daftar masak count-to-Bagikan gap grows about 16 once the clipped overhangs are gone: accepted.
49. The `MoodHeader.tsx:226-227` comment wording is parked; gate B's taps answer the question: a misleading comment.
50. The Hari ini fold at 1.77 check rows with a live slot is accepted: a short scroll for the second dish.

The fix wave's per-item rulings (items 1 to 14) are in `.superpowers/sdd/2026-10-24-dapur-layout/fixwave-brief.md`, and the residual round's in `residual-brief.md`.

## Deferred minors that remain

- D1: `useChipHitSlop` builds a new object each render (`components.tsx:229`); `LayoutScaleProvider` does not validate a `target` below 34; no test pins the stacked Segmented path under target 48.
- D2: `FigureStrip` does not enforce 2 to 4 cells and draws no edge in light (it sits on the mood band); `audit-polish.test.tsx` got three path-only edits; the moved files show as added (use `git log -B -M`).
- D3: row geometry is hand-copied rather than read from `nativeLayout` (`CheckRow`, `StopRow`, `rows.tsx`); `KitchenAction` re-implements `StickyAction`; the LiveSlot link keeps "n hal lainnya" while open; the footer note is keyed by stage only, not by meal and date. Hari ini skeleton: no demo strip and no live-slot block (a 24dp drop on load in demo builds).
- D4: the pin glyph is charcoal (the board has muted); WhatsApp has no chat glyph; new strings outside the allow-list ("n per hari", "Starts/Ends/Left/Portions"); the `stackedLayout.ts` docstring still justifies 340 with "two half-width buttons fit".
- D5: Menu spacing uses negative margins coupled to the Screen body gap of 16; on two-meal packages the strip shifts when the package loads.
- D6: package detail drops the board's "Waktu makan" and Gizi rows (nutrition is one meta line); the "no amount changes a row's height" test compares flattened styles only; the editor `Section` uses `cardPadding` as its field gap; Usaha puts its title in MoodHeader's meta slot.
- D7: the Atur antaran primary is drawn about 100dp high on the sheet's first frame.
- D8: `prettier --check` already failed on its five touched files before (no prettier gate in the repo).
- Fix wave: the lifted Daftar footer keeps its gesture-bar padding (about 24dp gap; accepted); a delivery note shows one line only (the full text is in the label); a long name can cut " · n porsi" on narrow, large-text rows.
- Final review, out of scope: chip frames bleed past their parent with a negative margin (`CustomerList.tsx:148`, `MenuWeek.tsx:568`), so a chip scrolled into the bleed may not take touches on Android; Menu week chevrons are 44 with `hitSlop` 2 inside a 44 row pulled up 8 (gate B tapped them as PASS); Menu's helper `SettingsGear` is not flush. The shared `Thumb` and `ListCard` still clip, and the customer app shows photos through them (package detail, plans row), so the audit-003 F1 blank-photo precondition may apply there.
- Classic `heading` / `label` texts remain in `PackageEditor.tsx:126`, `RoleGate.tsx:56`, `ReportScreen.tsx:369,386` and `TodayScreen.tsx:279`.
- Gate C note: after the cutoff, Besok rows hide "Pindah tanggal" and the "…", leaving an empty 48 slot right of the map icon.
- DESIGN.md colour drift (out of scope here): Colour revision (Phase G) lists light `canvas` `#E4DED1`, but `nativeThemes.light` has drawn a white page with white cards since 2026-10-23 (`packages/design-tokens/src/index.ts:117`).

## Baselines (cite, do not debug)

- Customer Jest `customer-sheets.test.tsx` "outcomes › moving a day toasts the new date" fails because it derives its dates from the real clock (1923 of 1924 at the head).
- Caterer Jest `menu.test.tsx` "photo prompt › gives the pills back when the read after the save fails, so the caterer is never stuck" is an intermittent, pre-existing async flake (failed 5 runs at 3 heads including `9b7bd500`, then passed). Rerun once if it alone fails.
- Root Vitest had two deep-pages failures for a while (copy-scan at `apps/customer/src/today/DayBlocks.tsx:123`, native-theme-guard at `apps/customer/src/schedule/WeekAgenda.tsx:172`). The customer session fixed both in `d28adcc3`, and Vitest has been 1052 of 1052 since.

Final checks at `4069ad17`: typecheck clean, Vitest 1052/1052, caterer Jest 858/858, customer Jest 1923/1924 (baseline). `npm run build` exit 0 at `44feb2a1` (the residual round touched no web code). `107a44c8` changes DESIGN.md only.

## Environment notes

- Gate backend on :3005 from worktree `C:\wt\gate`, over a copy in `C:\wt\gate-data\layout-gate-wkend` (from `.data/phase-g-c-4`, with Sat 24 and Sun 25 Okt mirroring Friday). Reset recipe: `C:\wt\gate-data\RESET.md` (`reset.sh`, `patch-probe.mjs`, `weekend-gate.mjs`, `start-3005.ps1`, `check-survived.mjs`, `fresh-check.mjs`). The copy is mutated by every gate that cooks; reset before the next gate.
- Real bug, follow-up needed: `packages/backend/src/database.ts:555`. The demo boot probe reads `position('INVALID_DATE' in prosrc)` of the top-level `public.catera_v1_command`, which later migrations wrap. So every demo boot re-runs `20261008102500_depart_today_one_push.sql`, clobbers `catera_v1_command` and orphans the `delivery.cook` / `delivery.arrive` and later wrappers in any demo data directory booted by current code ("Mulai masak" then answers 400). Production Supabase is unaffected. It is worked around only in the gate copy (the function is re-created with an `INVALID_DATE` comment before first boot); no code was changed.
- Emulator: during gate 1 the Android framework watchdog-restarted every 4 to 5 minutes under host memory pressure (2.1 GB free of 31, two Metros at 5.5 and 4.2 GB). An adb reboot did not recover it; it was shut down with `adb emu kill` and cold-booted. Set night mode before launching Expo Go, never while it runs.
- Metro: the gates used the controller's Dapur Metro on :8082, serving the main tree with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3005`. Metro :8081 (another session, started 01:07) and :8083 (deep pages) were not ours and were left alone; the owner later stopped the stale :8081 one. Never run Metro with `CI=1`; never `taskkill /IM node.exe`.

## Not verified

- iOS (no Mac).
- The production build without the demo strip; every fold was measured on the demo build.
- Gate B NOT REACHED: the 64 pitch of a stop with no delivery note (the data had none; Jest only).
- The Impor review with rows on a device (the reader calls a paid API and no gate pressed it), and skeleton frames beyond the few gate B caught.
- The customer app on a device (Jest only), and live TalkBack or VoiceOver.

## Next step

1. Owner review on a device: Hari ini through a cooking day, Pelanggan, Menu, Usaha and the sheets, against the canvas boards.
2. An APK build when the owner asks for one.
3. Fix the demo-bootstrap probe at `packages/backend/src/database.ts:555` so it still recognises `20261008102500` once later migrations have wrapped `catera_v1_command`, then reboot a demo data copy twice and confirm "Mulai masak" works.
