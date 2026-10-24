# Handoff: customer deep pages, fixes and polish (2026-10-24)

## Where things stand
- **Branch:** `v2`, local only, not pushed. The owner pushes; ask first. The Dapur layout session (catera-94) is merging into the same `v2` in parallel.
- **Source documents:**
  - research [research/2026-10-24-customer-deep-pages.md](../research/2026-10-24-customer-deep-pages.md);
  - spec [specs/2026-10-24-customer-deep-pages-design.md](../specs/2026-10-24-customer-deep-pages-design.md), self-reviewed on the owner's behalf;
  - plan [plans/2026-10-24-customer-deep-pages.md](../plans/2026-10-24-customer-deep-pages.md).
- **DESIGN.md:** the section "Customer deep pages (October 2026)" at the end of the file (commit `96a83861`).
- **Ledger:** `.superpowers/sdd/2026-10-24-deep-pages/progress.md` (git-ignored), with per-task Doc facts in `docfacts/`.

## What shipped
| Task | Scope | Commits on v2 |
|---|---|---|
| Pre | Simpan alamat blink: Android form sheets open at full height | `1d736acf` |
| Pre | Nutrition card: synthetic nutrition on 3 V2 test packages (database write, approved) | (data only) |
| T1 | Hari actions stack as 48dp rows at large text; past days read "Sudah sampai"; open reports read "Laporan terkirim"; the Jadwal Pilih menu action | `aae5c3d4` `29dfc490` `13ae5089` |
| T2 | Beranda: unpicked deliveries collapse into one row; caterer menus read "Menu belum diumumkan"; the hero shows its change deadline. Ulasan: starts with no stars, with sub-ratings | `67acc4e5` `d72b6505` |
| T3 | Pilih menu: dish photo cards, a deadline line, a count, a pinned save | `5df0ac7c` `6fb6a26a` |
| T4 | Beli and Renew: "Bayar Rp …", reason lines, footer stacking for long totals, the Bayar dengan row. Paket: "Isi paket" dish preview | `933a4795` `d1abeb29` |
| T5 | Addresses: the row opens edit; label chips; Hapus inside the form; Tambah alamat in the pick sheet | `2d51cabf` `4931c5a7` |
| T6 | Bantuan and Masalah: radio rows, the Paket row, the delivery card, an empty state. Segmented stacks at large text (v2) | `3d64e509` `64d20838` |
| T7 | Grouped settings cards (v2); Notifikasi groups and mark-all-read; Pembayaran status chips; Hapus akun callout; Button `danger`; Notifikasi hidden in Expo Go | `ebd26f4d` `41dafa27` |
| T8 | 6-slot SMS code with autosubmit and resend timer; one Cek emailmu view; AuthCallback on the auth layout | `c6303978` `417cced0` |
| T9 | Root guard fixes (plural copy, forest action marker); Jadwal Pilih menu respects the cutoff | `d28adcc3` |
| T10 | Gate fixes: the Hari sheet agrees with the agenda (shared `mealState.ts`); settings fragments get dividers with unique keys | `7378f7db` `343bbea0` `3d44c861` |
| T11 | Dark mode: the Pilih menu deadline is never forest-filled; the Masalah delivery card and the Hapus akun callout use `well`, so they show on the dark sheet | `9a8b8312` `4415583c` |

Every task passed an Opus review: first try for T3, T6, T7, T8, T9 and T11; after one fix round for T1, T2, T4, T5 and T10. The builders were Opus in speed mode, then Sonnet once the owner turned speed mode off.

## Checks
- **Final, at `4415583c`** (v2, which also includes the Dapur session's merges up to then): typecheck 0, root vitest 1052/1052, build 0, caterer Jest 858/858, customer Jest 1927/1928. The only failure is the pre-existing date-dependent "moving a day toasts the new date", which fails on v2 without these changes too. DESIGN.md changes since then pass `copy-scan` (24/24).
- **Emulator gate:** `output/native-review/deep-pages-gate-2026-10-24/report.md` and `recheck.md`.
  - Light at 360dp/1.3 (`report.md`): T2-T6 PASS. T1 and T7 FAILed and are fixed in T10.
  - `recheck.md`: the first recheck never ran (system_server crash loop from host memory pressure). The owner stopped the stale `:8081` Metro and the Dapur session cold-booted the emulator.
  - `recheck2.md`: T1 and T7 PASS; dark at 360dp/1.3, T1-T7 PASS (lowest text contrast 5.45:1); default size PASS (Hari circles on one line, the Beli footer as a row, settings cards, Pilih menu). Its three dark design notes are fixed in T11, which Jest checks against the palette tokens; no emulator pass after T11.

## Not verified
- iOS: no Mac.
- States the demo data cannot reach:
  - dish photos in Pilih menu and the Isi paket preview;
  - direct-payment Ganti;
  - non-Lunas Pembayaran chips;
  - Ulasan, which needs a delivered meal;
  - the hero deadline on a delivery day (the gate ran on a Saturday);
  - the plural unpicked row.

  Jest covers them all.
- The SMS code slots and Cek emailmu on a device: sending an SMS or email is a write.

## Deferred (spec §4)
A default-address field; the paid date on Pembayaran; a bulk `notification.readAll`; a Catera support WhatsApp number and reply time; photo upload on Masalah; email-code login.

## Follow-ups
- After Tambah alamat from the Beli pick sheet, the new address is not preselected.
- While only the payment methods load, the Beli footer says "Menghitung total…" though the button already shows the amount.
- The Bantuan Paket list can show duplicate package names: two subscriptions of the same package. It should add a date or the caterer to tell them apart.
- The Pilih menu month arrows are 16dp wide (pre-existing).
- In dark, Beli's icon tiles and the Porsi stepper circles barely show against the card.
- `footerFits` character widths assume the current font.

## Spec deviations recorded
- The Bantuan Paket row expands inline instead of opening a choice sheet.
- "Tandai semua dibaca" sits in the content, not the native header.
- Selection uses forest, since there is no accent token.

## Environment notes
- Metro `:8083` was started by this session and serves the main tree against the owner's demo backend `:3000`. The stale `:8081` Metro was stopped by the owner. The Dapur session owns `:8082` and `:3005`.
- Host memory: Metro servers each hold several GB. Check free memory before an emulator gate; under about 2 GB free, system_server crash-loops.
- Worktrees `C:\wt\dp1`..`dp8` hold the task branches `task-DPG-1`..`11`, all merged. They can be removed.
- Expo Go freezes if night mode is switched while it runs. Set the mode before launching it.

## Next
The owner reviews on the APK. Rebuild with `C:\wt\logs-g\build-apks.sh`, and don't run Metro and the build together. Then push `v2` after a yes.
