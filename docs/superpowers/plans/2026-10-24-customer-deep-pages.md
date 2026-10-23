# Customer deep pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six research bugs and build the ten recommendations exactly as ruled in the spec.

**Architecture:** Eight independent tasks, each owning a disjoint set of customer files, built in parallel in pool worktrees `C:\wt\dp1`..`dp8` (branches `task-DPG-1`..`8`, cut from v2). Shared `packages/mobile-ui` changes are additive or gated on `useLayoutScale() === "v2"`. The controller rebases each task onto v2 and merges `--ff-only`. Then come an emulator gate, a DESIGN.md pass and the handoff.

**Tech Stack:** Expo SDK 57 + expo-router native tabs, React Native, react-native-screens 4.26, Jest (jest-expo/android) per app, vitest at the root.

**Spec:** [specs/2026-10-24-customer-deep-pages-design.md](../specs/2026-10-24-customer-deep-pages-design.md). Its §0 rules and §2 rulings are binding. Research context (per-page references) is in [research/2026-10-24-customer-deep-pages.md](../research/2026-10-24-customer-deep-pages.md).

## Global Constraints

- Speed mode for this phase: Opus builders and reviewers, all 8 tasks in parallel. Quality gates unchanged.
- Skills in every builder: `expo-native-ui` + `design-taste-frontend` (expo-native-ui wins), `humanizer` for copy, superpowers `test-driven-development`, `verification-before-completion`, `systematic-debugging` on failures.
- DESIGN.md sections to respect: 1032-1186 (customer layout scale), 560-628, 846-873, 1232-1251, 1295-1364, 1376-1400 (copy glossary).
- Copy: Indonesian first via `t(id, en)`, "kamu", "pengantaran", "katering", no em dashes, no invented numbers.
- Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/`, `catera-phase-f-artwork.zip`, `graphify-out/`. Never edit DESIGN.md (the final task does). No migrations, no new dependencies.
- Never kill processes you did not start. Do not touch the emulator, Metro (8081/8083) or the server on :3000. Do not push.
- Shared append files (`packages/mobile-ui/src/index.ts`, `apps/customer/tests/fixtures.ts`): append only.
- Known baseline failure on v2: customer Jest "moving a day toasts the new date" (date-dependent). Do not chase it; add no new failures.
- Checks per task, from the worktree: `npx jest --runInBand` in apps/customer (and apps/caterer when `packages/mobile-ui` changed), then `npm run typecheck` at the root.
- Commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No model names in files.

## Review Focus

1. Large text (font 1.3) at 360dp: no label splits mid-word, nothing sits under the gesture bar, rows grow instead of clipping. Every task adds a `fontScale: 1.3` test for its new rows (mock `useWindowDimensions` the way `tests/ui-foundation.test.tsx` does).
2. Dapur regressions through shared components: `apps/caterer` Jest must stay green, and `layout-classic.test.tsx` stays untouched.
3. Missing data: dishes without `image`, packages without menus, no plans, no notifications, quote errors. Each task's tests cover its own missing-data case.
4. Double submit: autosubmit OTP, "Tandai semua dibaca" and review send must not fire twice while busy. Tests assert one call.
5. Dark theme and the Malam mood: new colors come from tokens only. Tests render with the dark palette at least once where a new surface is added.

---

### Task 1: Schedule (B1, B2, B3, R2, R3-Jadwal)

**Worktree:** `C:\wt\dp1`. **Files:** `apps/customer/src/schedule/DayActionRow.tsx`, `DayScreen.tsx` (bottom padding only), `WeekAgenda.tsx`, and the existing dash rule in `MonthGrid.tsx` if needed. **Tests:** `apps/customer/tests/schedule.test.tsx`, `sheet-reach.test.tsx`.
**Depends on:** none. **Builder:** opus.
**States:** wide (circles, unchanged); stacked at 360dp/1.3 (rows); upcoming day (5 actions); yesterday (menu, report, chat); past day with no update; today with a late meal; an unpicked agenda row.

- [ ] Step 1, failing tests:
  - "at font 1.3 on a 360dp screen the Hari actions are full-width rows, none wrapped": `day-action-<key>` present, each row's style `minHeight >= 48`, `day-action-circle-*` absent.
  - "the last action row clears the bottom inset": the sheet body content bottom padding includes `insets.bottom`.
  - Rewrite schedule.test.tsx:495-510 "d-old": a past day with no update shows the delivered label, never "Belum sampai".
  - Today's late meal (l512-526) still reads "Belum sampai".
  - "an unpicked agenda row offers Pilih menu": it navigates to `/pilih-menu/{subscriptionId}`.
- [ ] Step 2: run, see them fail. Command: `cd apps/customer && npx jest tests/schedule.test.tsx tests/sheet-reach.test.tsx`.
- [ ] Step 3: implement.
  - `DayActions` renders `ActionRows` when `useStackedLayout(380)` is true, and the circle row otherwise. Rows: icon 24, label `body`, `minHeight 48`, hairline separators, no chevron on Android.
  - WeekAgenda `due` keeps only `date === today && windowStart <= now`. A past day without a report uses `statusLabel("delivered")`.
- [ ] Step 4: run the app suite and the root typecheck. Pass apart from the baseline.
- [ ] Step 5: commit "fix(customer): Hari actions stack as rows at large text, past days stop reading Belum sampai".

### Task 2: Beranda and Ulasan (R3-Beranda, B5)

**Worktree:** `C:\wt\dp2`. **Files:** `apps/customer/src/today/Plate.tsx` (the hero deadline line), `DayBlocks.tsx`, `UpcomingDays.tsx`, `ReviewSheet.tsx`. **Tests:** `beranda-sections.test.tsx`, `today.test.tsx`, `customer-sheets.test.tsx`.
**Depends on:** none. **Builder:** opus.
**States:**
- A hero with and without `cutoff_at`.
- A day with 6 deliveries (`demoCustomer()`): all unpicked, some picked, or one unpicked.
- Review: no stars yet, overall picked, a sub-rating changed, a send failure.

- [ ] Step 1, failing tests:
  - "the hero says until when it can change": the "Bisa diubah sampai" text.
  - "a day's unpicked deliveries collapse into one row with one Pilih menu": one `day-unpicked-row` with "{n} pengantaran belum ada menu"; no dashed tile per delivery.
  - "one unpicked delivery reads Menu belum dipilih".
  - "the review starts with no stars and Kirim is disabled with Pilih bintang dulu."
  - Update customer-sheets.test.tsx:643: pick 4, change Pengantaran to 3, and the command receives `{rating:4, food:4, delivery:3, value:4}`.
  - "Kirim sends once while busy".
- [ ] Steps 2-4 as in Task 1. Commit "feat(customer): Beranda groups unpicked menus per day and shows the change deadline; reviews start empty with sub-ratings".

### Task 3: Pilih menu (R4)

**Worktree:** `C:\wt\dp3`. **Files:** `apps/customer/src/schedule/ChooseMenu.tsx`, new `apps/customer/src/schedule/DishCard.tsx`. **Tests:** `choose-menu.test.tsx`.
**Depends on:** none. **Builder:** opus.
**States:** dish with an image and without; selected; cutoff under 24 hours; 0 of n and all chosen; 1.3 font (cards keep 2 columns down to 360dp, the name wraps to 2 lines); a past cutoff (read-only).

- [ ] Step 1, failing tests:
  - "options are photo cards with name and serving": `dish-card-<id>`, a `Photo` or the utensil fallback.
  - "the selected card has the accent ring and accessibilityState selected".
  - "Pilih sebelum {cutoff} shows and turns to the warning tone under 24h".
  - "{x} dari {n} hari sudah dipilih".
  - "Simpan menu is pinned in the footer".
  - Existing save test l127 still passes.
- [ ] Steps 2-4. Commit "feat(customer): Pilih menu shows dishes as photo cards with a deadline, a count and a pinned save".

### Task 4: Beli, Renew and Paket detail (R1, R5)

**Worktree:** `C:\wt\dp4`. **Files:** `apps/customer/src/buy/BuyScreen.tsx` (not `pickAddress` lines 176-186, which belong to Task 5), `BuyParts.tsx` (PayWith row, BuySummary), `apps/customer/src/discover/PackageDetail.tsx` ("Isi paket" preview). **Tests:** `buy.test.tsx`, `package-detail-header.test.tsx`, `discover.test.tsx`.
**Depends on:** none. **Builder:** opus.
**States:** quote loading, ready, error; no address; no start date; pending checkout; renew; a trial; a package with dishes with images, without images, or no menus.

- [ ] Step 1, failing tests:
  - "the pay button names the amount" ("Bayar Rp 175.000" with the fixture quote).
  - "a disabled pay button says why", one case each: loading, no address, pending checkout, error.
  - "the title is Beli / Perpanjang and the package name appears once".
  - "Bayar dengan is a row with Ganti, not an input".
  - "Isi paket previews up to 6 dishes" and "no preview without dishes".
- [ ] Steps 2-4. Commit "feat(customer): Beli names the amount and why it waits; Paket previews its dishes".

### Task 5: Addresses (R6)

**Worktree:** `C:\wt\dp5`. **Files:** `apps/customer/src/account/Addresses.tsx`, `AddressForm.tsx`, `addressRemoval.ts` (call-site move only), `apps/customer/src/choice.tsx` (extras list), and `BuyScreen.tsx` lines 176-186 (`pickAddress`) only. **Tests:** `alamat.test.tsx`, `account.test.tsx` (Alamat), `buy.test.tsx` (the pick sheet), `unsaved-guard.test.tsx`.
**Depends on:** none (rebase on Task 4 at merge). **Builder:** opus.
**States:** no addresses, 1, or 3; a custom label (Lainnya); an address in use (the delete is refused through the existing path); the edit form with Hapus; the pick sheet with both extras.

- [ ] Step 1, failing tests:
  - "Alamat has no Makanan diantar ke mana? heading".
  - "a row opens its edit form; the trailing pencil is labelled Ubah {label}".
  - "Hapus alamat lives in the edit form and asks first".
  - "the label is Rumah, Kantor or Lainnya; Lainnya shows the text field; a custom label opens as Lainnya".
  - "the pick sheet offers Tambah alamat and Kelola alamat".
  - The unsaved guard is still asked on typed changes.
- [ ] Steps 2-4. Commit "feat(customer): addresses edit from the row, pick a label, add from the pick sheet".

### Task 6: Help (R7, B4)

**Worktree:** `C:\wt\dp6`. **Files:** `apps/customer/src/help/HelpForm.tsx`, `ReportProblem.tsx`, `ReportList.tsx`, `packages/mobile-ui/src/components.tsx` (`Segmented` stacked guard, v2-gated, only that function and its styles). **Tests:** `help.test.tsx`, `sheets.test.tsx`, `ui-foundation.test.tsx`, plus caterer `layout-classic.test.tsx` must stay green.
**Depends on:** none. **Builder:** opus.
**States:** Bantuan with no reports, with and without a plan; the form with a `paket` param and without; Masalah for lunch and dinner; a long caterer name; Segmented with 3 options at 1.3.

- [ ] Step 1, failing tests:
  - "topics are radio rows with an example line".
  - "the package is one Paket row; the paket param preselects it".
  - "Masalah shows the delivery card and the caterer name is not cut to one line" (`numberOfLines` 2).
  - "Masalah choices are not forest-filled".
  - "empty Bantuan shows the art, the Jadwal line, and Minta bantuan when there is a plan".
  - "Segmented with 3 options stacks into rows at font 1.3 in v2; classic unchanged".
- [ ] Steps 2-4, including `cd apps/caterer && npx jest --runInBand`. Commit "feat(customer): help forms use radio rows and show what they are about; Segmented stacks at large text".

### Task 7: Account settings, Notifikasi, Pembayaran, Hapus akun (R8, R10, B6)

**Worktree:** `C:\wt\dp7`. **Files:** `packages/mobile-ui/src/settings/Pengaturan.tsx` (B6 hide), `packages/mobile-ui/src/settings/SettingsRows.tsx` (v2 grouped cards, trailing value), `packages/mobile-ui/src/components.tsx` (`Button` variant `danger` only, additive), `apps/customer/src/account/DataAkun.tsx`, `Row.tsx`, `Notifications.tsx`, `Payments.tsx`, `HapusAkun.tsx`, `apps/customer/src/settings/*`. **Tests:** `settings.test.tsx`, `pengaturan-shared.test.tsx`, `data-akun.test.tsx`, `account.test.tsx`, `layout-blocks.test.tsx`, caterer Jest.
**Depends on:** none (Task 6 also edits `components.tsx`, in a different function: rebase). **Builder:** opus.
**States:** push available or unavailable; grouped cards in light and dark; notifications none, all read, mixed across today, yesterday and older; Pembayaran in each status; Hapus akun with 0 and 8 plans.

- [ ] Step 1, failing tests:
  - Update settings.test.tsx:407: "Expo Go hides the notification row".
  - "v2 settings sections are grouped cards with trailing values; classic unchanged".
  - "Notifikasi has no Baru label, groups by day, and Tandai semua dibaca reads each unread once then hides".
  - "Pembayaran rows carry Lunas / Menunggu / Diproses / Kedaluwarsa and Mulai {date}".
  - "Hapus akun with 8 plans shows one callout and three consequence lines, and no plan names".
  - "the send button is the danger variant".
- [ ] Steps 2-4, including caterer Jest. Commit "feat(customer): grouped settings, a calmer Notifikasi with mark-all-read, payment status, a clearer Hapus akun".

### Task 8: Auth (R9)

**Worktree:** `C:\wt\dp8`. **Files:** `apps/customer/src/account/Masuk.tsx`, `Register.tsx`, `Recover.tsx`, `AuthCallback.tsx`, new `apps/customer/src/account/CodeInput.tsx` and `CheckEmail.tsx`. **Tests:** `identity.test.tsx`, `masuk-layout.test.tsx`, `auth.test.tsx`, `busy-call-sites.test.tsx`.
**Depends on:** none. **Builder:** opus.
**States:** code empty, partial and full (autosubmit); a wrong code (error and cleared slots); resend counting down and ready; Cek emailmu for register and recover; callback loading, error and success; 1.3 font at 360dp (the 6 slots fit: slot width = min(48, (width - 32 - 5*8)/6)).

- [ ] Step 1, failing tests:
  - "the SMS code is 6 slots and the sixth digit submits once".
  - "a wrong code shows the error and clears the slots".
  - "Kirim ulang counts down 60 seconds then calls sendPhoneOtp" (fake timers).
  - "register and recover show the same Cek emailmu view with the address".
  - "the callback renders on AuthScreen".
- [ ] Steps 2-4. Commit "feat(customer): SMS code slots with autosubmit and resend timer, one Cek emailmu view, callback on the auth layout".

### Task 9 (controller): merge, gate, document

**Depends on:** Tasks 1-8 reviewed.
- [ ] Rebase each branch onto v2 in dependency-free order (1, 2, 3, 4, 5, 6, 7, 8) and merge `--ff-only`. Resolve conflicts in the owning task's favour.
- [ ] Root checks, showing the output: `npm run typecheck`, `npm test`, `npm run build`, customer Jest, caterer Jest.
- [ ] Opus emulator gate: every changed screen at 360dp and font 1.3, in light and dark, against the spec. The report goes to `output/native-review/deep-pages-gate-2026-10-24/`. Fix failures through the owning task's builder.
- [ ] An Opus DESIGN.md pass from the builders' Doc facts.
- [ ] Handoff `docs/superpowers/handoffs/2026-10-24-customer-deep-pages-handoff.md`.

## Self-review (controller)

- Spec coverage: B1/B2/R2/B3 → T1; R3 → T1 and T2; B5 → T2; R4 → T3; R1/R5 → T4; R6 → T5; R7/B4 → T6; R8/R10/B6 → T7; R9 → T8. §4 items are deferred by the spec.
- File overlap: `BuyScreen.tsx` is split by line range between T4 and T5. `packages/mobile-ui/src/components.tsx` is split by function between T6 and T7. Both are rebase conflicts at worst.
- Each task has a States block and a 1.3-font test (Review Focus 1).
