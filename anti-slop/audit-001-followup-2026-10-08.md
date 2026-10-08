# antislop audit 001 follow-up (2026-10-08)

- **Audit:** [audit-001-2026-10-08.md](audit-001-2026-10-08.md), 29 findings, native apps on `v2` at `a851bb6`.
- **Owner decision (2026-10-08):** "Fix everything, trust the antislop and revise the DESIGN.md where needed." All 29 numbers were approved. Where antislop and DESIGN.md disagreed (#12, #13, #20), antislop won and DESIGN.md was revised.
- **Fix commits** (`git log --oneline 17e9ad8..HEAD`, plan commit `17e9ad8`):

| Commit | Scope |
|---|---|
| `6e55555` | Shared foundation: demo strip, 48dp chips/segments/text buttons/stepper, accessible headings, keyboard-safe capped Screen, PressableRow, Sheet fade, border tokens |
| `0a3bdc8`, `4952079` | Customer honesty and content: per-meal price unit, package facts, EmptyHome states, payment card, upcoming rows, single headings |
| `9531bdb` | Customer interaction and visual: stars, sun marks, press feedback, tab icons, 48dp, tokens |
| `1f74677` | Dapur states and copy: em dashes, loading/error with "Coba lagi", font fallback, honest copy, "Bagikan menu" gating |
| `5b81cc0` | Dapur kitchen truth and interaction: unfilled menus, attention links, press feedback, 48dp, tab icons, tokens |
| `a7e4e75`, `04e82e1` | Sweep: press feedback on every remaining tappable, attention-card chevron, payments heading |
| this commit | DESIGN.md revision, this report, the click-through record |

- **Verification on the final tree:** `npm run typecheck` clean (web, customer, caterer, root); `npm test` 79 files / 520 tests pass; `npm test -w @catera/customer` 14 suites / 329 pass; `npm test -w @catera/caterer` 14 suites / 153 pass; `npm run build` passes. Element-by-element click-through on the Android emulator (Expo Go 57, demo backend): 53 customer rows and 31 Dapur rows in `output/native-review/audit-001/README.md`, 64 screenshots in `output/native-review/audit-001/final/` (local, gitignored).

## Findings

Status key: **fixed**, **fixed with deviation** (the outcome the rule asks for is met, but differently from the audit's suggested fix, or with a stated limit), **not fixed**.

| # | Finding | Status | Commit(s) | Evidence |
|---|---|---|---|---|
| 1 | Demo data never labelled | fixed | `6e55555` | Persistent "Demo · data sintetis" strip in both root layouts whenever `demo` is true, signed in or out (`DemoStrip`, `TopInsetOwner`). Tests: customer "renders the demo strip only in demo mode", "Screen leaves the top inset to the demo strip while it is shown"; caterer "shows the synthetic-data strip when the server reports demo". Every click-through shot shows it, English "Demo · synthetic data" in `c28-english` |
| 2 | Per-meal price "Per porsi" / no unit | fixed | `0a3bdc8` | Domain `priceUnitLabel`: "/ sekali makan", plus "2 kali makan / hari" for `meal: "both"`, on card, detail footer ("Per sekali makan") and EmptyHome. Tests: `price-unit-label.test.ts`, "single-meal offer shows only / sekali makan", "combined offer shows 2 kali makan / hari and its per-meal price", "package detail labels the price per meal and notes a combined day", "EmptyHome prices a combined package per meal, not per day". Shots `c03`, `c05`, `c06`, `c29` |
| 3 | Two em dashes in Dapur | fixed | `1f74677` | Menu share header "Menu Dapur Senja · Rantang Nusantara"; ImportAssistant "Paket belum dipilih" / "sisa hari belum diisi". Tests "menu share header has no em dash", "import row names a missing package". Shot `d13-bagikan-menu` |
| 4 | Undecided menu slots listed as dishes | fixed with deviation | `5b81cc0` | `cookingRecap` reports `unfilled` separately; SessionCard shows "Menu belum diisi: 2 lauk, 1 nasi, 1 sayur" (Sunrise ink) and, for owners, "Isi menu" to the editor; share and print text carry the same line. Deviation: the line sums missing slots across packages instead of one line per package, and "Isi menu" opens the first unfilled package. Tests "unfilled slots are reported separately and never listed as dishes", "keeps real dishes and reports only the slots still missing", "puts the unfilled line, not placeholder dishes, in the shared recap", "prints the unfilled line too". Shots `d01`, `d03`, `d04`, `d05` |
| 5 | Chip and Segmented 40dp | fixed | `6e55555` | `minHeight: 48` on chip and segment. Test "chips and segments are 48dp". Language segment measured 126px = 48dp on device (Task 1) |
| 6 | Pelanggan false zero counts, no retry | fixed | `1f74677` | "Memuat pelanggan…", chips hidden until data, `ReadError` with "Coba lagi". Tests "Pelanggan shows loading, hides counts", "Pelanggan error offers Coba lagi". Shot `d15` (real counts) |
| 7 | Menu and Usaha without loading/error | fixed | `1f74677` | Menu "Memuat…" with actions disabled until a week loads; Usaha "Memuat…" or `ReadError`, "+ Paket baru" hidden until data. Tests "shows Memuat while the packages load, with no actions", "Usaha shows loading and error" |
| 8 | Dapur errors with no next action | fixed | `1f74677` | Shared `apps/caterer/src/ReadError.tsx` (Danger message + "Coba lagi" calling `reload()`) in Today, Uang, Aktifkan, CustomerDetail, CustomerList, Usaha. Tests "Today error offers Coba lagi", "Uang error offers Coba lagi", "Aktifkan error offers Coba lagi", "Pelanggan detail error offers Coba lagi". Pull-to-refresh was mentioned in the evidence, not in the fix, and was not added |
| 9 | Dapur blank screen on font failure | fixed | `1f74677` | `app/_layout.tsx` renders "Font tidak dapat dimuat. Mulai ulang aplikasi." Test "Dapur shows a font error message" |
| 10 | Signed-out Beranda without states | fixed | `0a3bdc8`, `4952079` | "Memuat paket…", Danger error + "Coba lagi", and "Belum ada paket di area ini." for an empty catalog. Tests "EmptyHome shows loading then error with Coba lagi", "EmptyHome says so when the catalog has no packages". Shot `c29` (loaded state) |
| 11 | Headings not exposed; scrim and labels | fixed with deviation | `6e55555` | `Text` title/heading default to `accessibilityRole="header"` and pass accessibility props through; Sheet scrim is a button with a required translated `closeLabel`; Stepper takes translated `decreaseLabel`/`increaseLabel`. Tests "title and heading are headers", "Text forwards accessibilityLabel and accessible", "Sheet scrim is a labelled button and fades under reduced motion", "Stepper labels come from props and its buttons are 48dp". Limit: on iOS VoiceOver the sheet's `accessibilityViewIsModal` hides the scrim, so the close path there is the modal's own escape gesture (not device-verified) |
| 12 | Review star 1.51:1 | fixed | `9531bdb` | Unselected `star-outline` in Muted (5.78:1), selected `star` in Sunrise ink; each star 48x48 with a selection haptic. Test "unselected star is outlined and muted". Shot `t3/beranda-review-stars.png` (not reachable on today's demo data) |
| 13 | Sunrise sun 2.38:1, ring 2.56:1 | fixed | `9531bdb`, this commit | Sun icon, legend and today ring use Sunrise ink (5.73:1 on scheduled, 6.17:1 on cream); DESIGN.md Customer meal calendar revised with the reason. Test "sun icon and legend use sunriseInk". Shots `c19-jadwal`, `c21-day13` |
| 14 | Screen without 760 cap or keyboard avoidance | fixed with deviation | `6e55555` | Body and footer centered at `maxWidth: 760`; `KeyboardAvoidingView` (padding on iOS) wraps scroll and footer; `keyboardShouldPersistTaps="handled"`. Test "caps the body at 760 and keeps taps alive over the keyboard". Limit: no `keyboardVerticalOffset` for the header and demo strip on iOS; landscape and tablet not device-tested |
| 15 | "sekitar 3 menit" claim | fixed | `1f74677` | MulaiCard subtitle "Satu layar". Test "new kitchen card makes no time claim" |
| 16 | No click-through record | fixed | this commit | `output/native-review/audit-001/README.md`: 84 element rows across both apps, screenshots in `final/`; summary below |
| 17 | Press feedback missing | fixed | `6e55555`, `9531bdb`, `5b81cc0`, `a7e4e75`, `04e82e1` | Controls use `PressableScale` (scale 0.97 + haptic), rows use `PressableRow` (instant 0.7 dim). `grep -rn "<Pressable\b" apps/customer/src apps/caterer/src` returns nothing. Tests include "PressableRow dims when pressed and does not scale", "upcoming row dims on press", "day cells and meal rows dim on press without losing their state", "month arrows give haptic feedback at 48dp", "filter chips give a selection haptic", "customer rows dim on press and still open the record", "day cards dim on press and keep opening the day editor", "Usaha rows dim on press and still navigate", "report cards and setup rows dim on press and still navigate", "the stop menu button and the problem options give haptics" |
| 18 | Sheets slide under reduced motion | fixed | `6e55555` | `animationType={reduced ? "fade" : "slide"}`. Test "Sheet scrim is a labelled button and fades under reduced motion" |
| 19 | Icon set and filled/outline split unwritten | fixed | `9531bdb`, `5b81cc0`, this commit | Both tab bars: outline until focused, filled when focused. DESIGN.md Navigation: "Icons (native): Ionicons via `@expo/vector-icons`; outline by default, filled only for the focused tab" with its reason. Tests "tab icons are outline until focused", "Dapur tab icons are outline until focused". Shots `c19`, `d01` |
| 20 | "Cara kerja" 3-step template | fixed | `0a3bdc8`, this commit | Section and its stagger removed; package detail states Diantar, Ubah hari cutoff, Ongkir and "Mulai paling cepat" (hidden when nothing is bookable). DESIGN.md native motion no longer sanctions any stagger. Tests "package detail shows earliest start and no Cara kerja", "package detail hides the earliest start when nothing is bookable". Shot `c03` |
| 21 | Generic "Mulai" CTA | fixed | `1f74677`, `a7e4e75` | Button "Aktifkan pembayaran"; the card heading now says what it unlocks, "Terima pembayaran lewat Catera". Test "payments card names the action". Shot `d19-usaha` |
| 22 | "Halaman pembayaran aman" | fixed with deviation | `0a3bdc8`, `4952079` | The claim is gone; the card says only "Pilih cara bayar di halaman berikutnya." Deviation: the provider is not named because `PaymentAvailability` carries no provider field. Test "payment card makes no security claim" (word-boundary regex, proven RED against the old title). Shot `c12` |
| 23 | Controls at 44dp vs DESIGN 48 | fixed | `6e55555`, `9531bdb`, `5b81cc0` | Stepper, text Button, FilterChip, Jelajah area, Jadwal arrows, stars, Claim back (now `RoundButton`), ReportList pick, Dapur chat, SlotEditor controls all 48. Tests "every chip and the area control is at least 48 points tall", "month arrows give haptic feedback at 48dp", "the back button is a 48dp round button with a haptic", "package picks are 48dp and give a selection haptic", "chat button is 48dp", "remove and suggestion controls are 48dp" |
| 24 | Beranda rows say nothing, no focal point | fixed with deviation | `0a3bdc8` | Each row names package and meal, and an unset menu reads "Menu belum ditentukan". Tests "upcoming rows name the package and meal", "empty upcoming row says Menu belum ditentukan". Shot `c00`. Deviation: as the audit itself planned, the photo hero for the no-plate state is a Phase 2 item; today that state's focal point is the trial or renewal card when one exists |
| 25 | Doubled headings | fixed | `0a3bdc8`, `4952079`, `5b81cc0` | MenuDayScreen has no raw ISO title; Register and Recover keep only the header title. Tests "MenuDayScreen has one heading: the header, not a second raw date", "shows a single heading: the header names the screen, the body explains", "shows a single heading: the header names the screen, the body says how". Click-through row 51 |
| 26 | "Bagikan menu" active with nothing to share | fixed | `1f74677` | Disabled with "Belum ada menu untuk dibagikan" when no day of the week has dishes. Tests "Bagikan menu disabled when nothing to share", "offers Bagikan menu once a day of the week has dishes". Shots `d11`, `d13`; click-through row 15 (disabled tap does nothing) |
| 27 | Attention cards not tappable | fixed | `5b81cc0`, `a7e4e75`, `04e82e1` | Cards whose `href` maps through `dapurLink` are `PressableRow accessibilityRole="link"` with a chevron; unmapped ones stay plain. Tests "opens its link when the href maps to a Dapur screen", "a link card shows a chevron, a plain card does not". Not reachable on demo data (no attention items) |
| 28 | Hard-coded colours | fixed with deviation | `6e55555`, `9531bdb`, `5b81cc0` | `colors.fieldBorder` `#CFD3C6` and `colors.secondaryBorder` `#CDD4C4`; every app-source use of those two and the stray `#B9BFB0` now goes through them; Dapur auth uses `colors.*`. Guard test "Dapur app sources use colors.* tokens instead of literal hex values". The only app-source literal left is the QRIS quiet zone `#FFFFFF` in `buy/QrisCode.tsx`, which must stay pure white for scanners. Deviation: the second stray, `#F3DFC3`, is still the attention Card border inside `packages/mobile-ui/src/components.tsx:350`; mapping it onto a grey-green border token would lose the cream card's warm edge, so it should become its own token (follow-up) |
| 29 | No dials declared | fixed | this commit | DESIGN.md "Native antislop revisions, October 8, 2026": `Dial (customer): ENERGY 2 / RHYTHM 2 / MOTION 2` and `Dial (Dapur): ENERGY 1 / RHYTHM 1 / MOTION 1 (+ press micro-feedback)`, each with a one-line reason |

Totals: 23 fixed, 6 fixed with deviation (#4, #11, #14, #22, #24, #28), 0 not fixed.

## Fixed beyond the audit

- **Inset ownership:** `TopInsetOwner` so the demo strip owns the status-bar inset and `Screen` / `AppHeader` do not add a second one (`6e55555`).
- **`ChoiceSheet` closeLabel** made required so every sheet scrim is labelled (`6e55555`).
- **Disabled secondary and text buttons** fade to 0.45 opacity; before, a disabled "Salin minggu lalu" looked enabled (`1f74677`).
- **EmptyHome zero-package state**, Register body copy, flexible fact-label column so "Mulai paling cepat" wraps instead of clipping at large font scale, and `startDates` moved into `@catera/domain` and shared with Buy (`4952079`, `0a3bdc8`).
- **Sweep 5b** (`a7e4e75`, `04e82e1`): press feedback on every remaining raw `Pressable` (customer ChooseMenu, ChangeDaySheet address rows, BuyParts picks, ReportProblem picks, Breakdown cycles, account Row and Notifications; Dapur ReportCards, MulaiCard rows, ImportAssistant rows, PackageEditor photo picker, ExceptionSheet options, SessionCard map and stop-menu buttons); chevrons aligned on Hari ini cards; payments heading states the benefit.
- **New guard test** against literal hex values in Dapur sources (`5b81cc0`).
- **DESIGN.md corrections found while verifying:** native has four customer tabs, not five; Screen side padding is 20, not 22; native inputs use the Field border token and Surface fill (the old `#C9D2BE` / `#FFFEF9` values were stale); native button padding is 18 horizontal; shared Price Unit and Demo Label rules stated once for web and native.

## Click-through summary (R-35)

Full table: `output/native-review/audit-001/README.md`. Run on Thursday 8 Oct 2026 around 21:30, after the 17.00 change cutoff for Friday.

- **Customer (53 rows):** Beranda rows open Hari; change-day sheet shows the locked state past cutoff and both modes before it ("Pindah tanggal" with "Terisi" captions, "Ganti alamat"), confirm buttons left unpressed; trial card opens package detail with the facts and per-meal footer; heart save toggles on detail and card and Disimpan reflects it; Jelajah chips, empty result with "Hapus pilihan", search, area sheet (Bandung narrows to one caterer); "Coba 1 hari" shows the used-trial message with "Hitung ulang"; Buy start-date sheet, stepper, address sheet, "Mulai Jumat 16 Okt" quotes Rp 177.500 (Bayar not pressed); "Ketentuan Catera" opens the browser; Jadwal month arrows, day selection, today ring, meal row to Hari; every Akun row, "Minta bantuan" form (not submitted), English switch and back, Keluar, signed-out home, login modal modes, Register, modal close, demo sign-in.
- **Dapur (31 rows):** Hari ini / Besok; Bagikan and "Bagikan rute ke WhatsApp" open the share sheet (cancelled); Cetak opens the print preview (cancelled); map opens Google Maps; "Isi menu" and day cards open the editor (not saved); Menu package chips (combined offer adds Siang / Malam), week arrows, disabled "Bagikan menu" with its caption, "Salin minggu lalu" ("0 hari disalin" on an empty week), enabled "Bagikan menu"; Pelanggan filters, record, "Kirim tautan perpanjang" (routes to Aktifkan pembayaran while payments are off), import; every Usaha row including "+ Paket baru" (nothing created).
- **Not reachable on the demo data, covered by tests:** review stars, Dapur attention cards, stop ellipsis (past cutoff), chat (no customer phone), every loading and error state, font fallback.
- **Observations (outside the audit, not changed):** English "1 days to go" has no singular (`Akun.tsx:118`, `Beranda.tsx:150`); Dapur record reads "Berakhir Rabu 7 Okt · sisa 1 hari" on 8 Okt for a package still delivering on 9 Okt; "0 hari disalin" could say that last week has no menu.

## Delivery Gate re-run

### Block 1: Hard Gate

| Item | Status | Evidence |
|---|---|---|
| R-02 em dash | PASS | No U+2014 in any user-visible string in `apps/*/src`, `apps/*/app`, `packages/mobile-ui/src` or the share text; the only hit is a code comment (`UsahaScreen.tsx:46`). Test "menu share header has no em dash"; shot `d13` |
| R-03 mobile layout / targets | PASS | Every native control is 48dp (#5, #23 tests); Screen capped at 760 (#14 test); no overflow or clipping in 64 phone screenshots |
| R-17 unsourced numbers | PASS | "sekitar 3 menit" removed (test "new kitchen card makes no time claim"); on-screen numbers are live data |
| R-18 testimonials | PASS | No testimonial section; reviews come from purchased deliveries and are hidden when there are none ("Belum ada ulasan", `c03`) |
| R-23 assets | PASS | No new assets; approved wordmark, icon and manifest food photos only |
| R-24 navigation | PASS | Click-through opened all 4 customer and 4 Dapur tabs and every pushed screen they lead to |
| R-25 contrast | PASS | Unselected star Muted 5.78:1; sun and today ring Sunrise ink 5.73:1 / 6.17:1; demo strip forest on sage 10.74:1; "Menu belum diisi" Sunrise ink |
| R-26 dead controls | PASS | 84 click-through rows, every enabled control did something; the one disabled control ("Bagikan menu") says why |
| R-27 states | PASS | Loading, Danger error + "Coba lagi", and empty states on every data screen (#6 to #10 tests); Jelajah empty and Disimpan empty seen on device (`c07`, `c10`) |
| R-28 FAQ | N/A | No FAQ |
| R-32 keyboard (native: screen reader) | PASS | Headers exposed, labelled and translated scrim and stepper labels (#11 tests). Limit: VoiceOver scrim reach not device-verified |
| R-33 patch scripts | PASS | None |
| R-34 themes | N/A | Single light theme |
| R-35 run + click-through | PASS | typecheck, 520 + 329 + 153 tests, build; click-through record above |
| R-36 fabricated claims | PASS | Security claim removed (#22 test) |
| R-37 direction | PASS | DESIGN.md revised to match the owner decision; dials declared |
| R-38 real content | PASS | Demo strip on every screen; per-meal price carries its unit; unfilled menu slots are labelled, never listed as dishes |

### Block 2: Purpose-Gate

| Item | Status | Evidence |
|---|---|---|
| R-01 gradients/glow | PASS | None; Plate's flat overlay keeps its written contrast reason |
| R-04 icons | PASS | Ionicons with a written reason and the outline/filled rule in DESIGN.md Navigation; tab tests |
| R-06 typography | PASS | Jakarta with written reason and native ramp; no wide-tracked uppercase |
| R-07 background pattern | PASS | None |
| R-08 arrows | PASS | Chevrons only on navigational rows and link cards |
| R-09 badges | PASS | Only real status pills |
| R-10 glass | PASS | None |
| R-12 shadow | PASS | Borders and tonal fills only |
| R-13 glow | PASS | None |
| R-14 cards | PASS | Catalog cards are uniform because each is one package |
| R-19 motion | PASS | No list or sequence stagger anywhere (grep for `Animated`/`entering` in app sources finds none); sheets fade under reduced motion; press feedback on every tappable; matches MOTION 2 (customer) and MOTION 1 + press (Dapur) |
| R-22 illustrations | PASS | None; food photos are content |

### Block 3: Liveliness

| Item | Status | Evidence |
|---|---|---|
| Dials declared | PASS | DESIGN.md "Native antislop revisions, October 8, 2026" |
| Output matches dials | PASS | Customer: photo-led cards, press and selection feedback, content fades; Dapur: still rows and totals, press feedback only |
| One focal point per screen | PASS | Food photo on detail and Hari, the portion number on Dapur sessions, the trial card on no-plate Beranda (`c00`). Limit: a no-plate Beranda with no trial or renewal card has only rows until the Phase 2 photo hero |
| Structural whitespace | PASS | Consistent 16/20 rhythm, sectioned rows |
| One deliberate accent | PASS | Sunrise for "needs you now" fills; its ink companion for small accent text and the coverage marks |
| Identity motif | PASS | Food photography with forest/cream and sun/moon coverage marks |
| Design Read declared | PASS | Audit header and the native UI spec |

### Block 4: Craftsmanship and Quality Locks

| Item | Status | Evidence |
|---|---|---|
| C-1 intentionality | PASS | Icon set and dials now have written reasons (#19, #29) |
| C-2 functional completeness | PASS | #26 fixed; click-through found no dead control |
| C-3 content-driven composition | PASS | "Cara kerja" replaced by package facts (#20); attention cards link to the work (#27) |
| C-4 resilience | PASS | States (#6 to #10), headers (#11), width cap and keyboard avoidance (#14), single headings (#25). Limits under Known limits |
| C-5 evidence over claims | PASS | Demo strip (#1), honest per-meal price (#2), no security claim (#22) |
| R-05 template layout | PASS | No how-it-works steps remain |
| R-11 radius | PASS | 8 to 24 by role |
| R-15 CTA | PASS | "Aktifkan pembayaran" (#21); every other CTA names its task |
| R-16 buzzwords | PASS | "aman" removed; none found |
| R-20 identity | PASS | Still reads as Catera with the name swapped |
| R-21 dark mode | PASS | Light locked on purpose for the cream identity |
| R-29 palette | PASS | 2 cores + 1 accent + neutrals; app sources go through tokens (#28 guard test); one untokenised border (`#F3DFC3`) remains inside mobile-ui, see Known limits |
| R-30 clone | PASS | No product clone |
| R-31 reasons written | PASS | DESIGN.md records the icon, dial, coverage-colour and motion reasons |

Gate result: no FAIL. The PASS items marked with a limit are listed below.

## Known limits

- **Android only.** Every device check ran on the Android emulator in Expo Go. iOS is unverified: the `KeyboardAvoidingView` in `Screen` has no `keyboardVerticalOffset` for the header and demo strip, the login page-sheet modal with the strip was not seen, and VoiceOver may not reach the sheet scrim because the sheet sets `accessibilityViewIsModal`.
- **Width cap** (760) is unit-tested, not device-tested in landscape or on a tablet.
- **#22:** the payment provider cannot be named until the server exposes it in `PaymentAvailability`.
- **#24:** the photo-hero focal point for a no-plate Beranda is a Phase 2 item.
- **#4:** "Isi menu" opens the first unfilled package; others are reached from Menu.
- **Demo-data reach:** review stars, attention cards, stop ellipsis, chat button and every loading/error state were proven by jest, not on device.
- **#28:** the attention Card border `#F3DFC3` in `packages/mobile-ui/src/components.tsx:350` is still a literal; it needs its own token.
- **No pull-to-refresh** in Dapur; "Coba lagi" is the recovery path.
- **Deferred minors from the task reviews:** an em dash in a code comment (`UsahaScreen.tsx:46`, not user-visible); ChooseMenu row scale includes its divider; re-tapping a selected radio fires a selection haptic; Menu "Memuat…" caption placement; Button's disabled opacity is an inline style; the customer demo-strip test uses a harness rather than the real layout.
- **Click-through observations** listed above (English plural, Dapur end date versus remaining days, "0 hari disalin") are new items, not audit findings, and were not changed.
