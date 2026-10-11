# antislop audit 008 follow-up: the Phase F gate (2026-10-11)

- **Mode:** after (session override, carried from earlier Catera sessions). No mode question was asked.
- **Skills applied:** `building-native-ui`, `antislop` (core, ui, layoutmobile), `apple-design`, `design-taste-frontend` (native scope: skeletons over spinners, motivated motion, contrast, copy audit, no em dashes), `impeccable`. **`material-3` is not installed** on this machine, so Android judgements follow the Material 3 rules already recorded in DESIGN.md.
- **Build under test:** `v2` at `7cf0f23d` ("fix(native): held art fades in place and leaves with its section"), checked in the worktree `C:\wt\2`. Audit: [audit 008](audit-008-2026-10-10.md). Contract: [DESIGN.md, Native polish (Phase F)](../DESIGN.md).
- **Evidence kinds:** Jest, Vitest, typecheck, build and PostgreSQL runs (Step 1), code, git history, and the task ledger kept under `.superpowers/sdd/2026-10-11-native-polish-phase-f/`. **No emulator capture exists.** Step 2 of Task 16 (the Android emulator gate in Expo Go) **did not run**: this machine has no Android emulator, SDK or Expo Go image, and there is no Mac for iOS. `output/native-review/phase-f/` therefore holds no captures.
- **Verdict rule.** **PASS:** the defect is gone in code and a test that can fail covers it. **FAIL:** it is not fixed. **NOT VERIFIED:** the finding is about something seen or felt on a device, so Jest cannot close it. A PASS never claims a device result; the "Device remainder" column lists what the device must still confirm.

## Step 1: full checks on `7cf0f23d`

Run by the controller from `C:\wt\2`; log `C:\wt\gate-t16.log`. The baseline on `c1d20e81` was green with no failures.

| Check | Result |
| --- | --- |
| `npm run typecheck` (web, customer, caterer, root) | exit 0 |
| `npm test` (Vitest) | 93 files, 786 tests passed |
| `npm run build` | exit 0 |
| Customer app Jest | 40 suites, 1245 tests passed |
| Dapur app Jest | 28 suites, 520 tests passed |
| `npm run test:postgres` | exit 0, including the new `device.unregister` scenario |
| `node packages/brand/verify-phase-f.mjs` | exit 0, 23 files, no failures or warnings |

The one flaky test seen during the phase (`kitchen-loop.test.tsx` "names the customer in English too") was an order-dependent fixture leak, fixed in `ec9d35a6` (a test-only change).

## Findings 1 to 17

| # | Verdict | Evidence | Device remainder |
| --- | --- | --- | --- |
| 1 Native mascot loader missing | **PASS** | `MascotLoading` restored in `packages/mobile-ui/src/brand/MascotLoading.tsx` (`cc4f76db`, shared by both apps); tests "mascot" group in `apps/customer/tests/primitives.test.tsx` (300ms reveal, plays only when visible, foreground, focused, not reduced, all layers loaded; poster on a failed layer; dark theme; startup on the canvas). `docs/MASCOT-MOTION.md` rewritten in this commit. | Loop performance on a phone. |
| 2 34 bare `ActivityIndicator`s, no vocabulary | **PASS** | Three tiers in DESIGN.md. Skeleton catalogue `apps/customer/src/skeletons.tsx` (`6956998e`..`681ab3ea`) and `apps/caterer/src/skeletons.tsx` (`889c0acc`, `09d9dd2a`). `apps/customer/tests/no-spinner.test.tsx` finds no `ActivityIndicator` in the customer sources; `apps/caterer/tests/no-spinner.test.tsx` allows only the Menu upload tile. Per-screen tests in both `skeletons.test.tsx` files; pull to refresh via `Screen.refreshControl` (tests "pull to refresh"). | Pulse and fade feel; Android fade clipping. |
| 3 Customer cold start, five frames, two spinners | **NOT VERIFIED** | The sequence is built and tested: splash held by `useSplashHold` (`07569083`, `SPLASH_CEILING` 1500), one `me()` ("only one me() runs at launch even with an English locale and an active event"), cache first with a kept copy never actionable and actor-keyed caches (customer `launch.test.tsx` "a stored session paints the cached Beranda...", "after logout the next launch paints no cached home"), mascot gate after 300ms when `booted \|\| released` (`8033ff5b`). The finding is the owner's perceived launch sequence, and no before or after recording was captured. | Cold start signed in and signed out, before and after. |
| 4 Dapur cold start | **NOT VERIFIED** | Same mechanism in `apps/caterer/app/_layout.tsx`, `TodayScreen.tsx` and `offline.ts`; Dapur `launch.test.tsx` ("another account's kept day never paints...", "a fresh read that lands after logout keeps nothing on the phone"); Hari ini skeleton holds the count card height (`skeletons.test.tsx` "the count skeleton's track is as tall as the loaded rantang track"). Perceived sequence not captured. | As finding 3, Dapur. |
| 5 Splash is a forest square on cream | **NOT VERIFIED** | Both `app.config.ts` use the theme canvas (light `#FDFAF3`, dark `#151514`), `imageWidth` 200, the transparent `splash-mark-*` derivatives, a `#163D2E` adaptive icon with monochrome and the iOS dark and tinted appearances (`07569083`; `tests/app-config.test.ts`). Expo Go never shows this splash (Decision C default). | Native splash and icons on both platforms; the Android 12 circular mask; the iOS 18 appearances. Needs a development build. |
| 6 Splash ruling premise changed | **PASS** | Decision B recorded in DESIGN.md (Native polish, Owner decisions); the cream-splash ruling is marked superseded at its old location; the derivatives are described as segmented derivatives, never as masters (`packages/brand/README.md`, DESIGN.md Brand artwork note). | None. |
| 7 No settings screen | **PASS** | Pengaturan in both apps (`8ef1033c`, `c22f4a25`): `apps/customer/src/settings/Pengaturan.tsx`, `apps/caterer/src/settings/Pengaturan.tsx`, shared rows in `packages/mobile-ui/src/settings/`. Akun and Usaha lost their inline controls. Tests: both `settings.test.tsx`, `layout.test.tsx` "opens Pengaturan for a helper too", `navigation.test.tsx` (cold `/pengaturan` and its sheets). | iOS inset grouping; Tampilan thumbnails on a phone. |
| 8 Notification truth | **PASS** | `usePushSwitch` (`packages/mobile-core/src/push.ts`): the phone's permission wins, read on focus and on return to the foreground, never on while blocked; Off calls `device.unregister` (`311aff30`, `supabase/migrations/20261011090000_device_unregister.sql`); sign-out lets go of this phone's token (`6db46b59`). Tests: customer and Dapur `settings.test.tsx` (switch states, "Keluar lets go of this phone's push token", failed turn-off); `tests/device-unregister.test.ts` (6); Postgres scenario "Two simultaneous device.unregister calls...". | The real states in a development build (Expo Go reports `unavailable`); a permission turned off in the phone's settings. |
| 9 Macros missing natively | **PASS** | `NutritionCard`, package detail line, Jelajah "±" (`12fb378c`); Dapur editor section, carried ranges and validation (`06d367f5`). Tests: both `nutrition.test.tsx`; `tests/caterer-quick-package.test.ts` "Salin jadi paket baru from the seeded Rantang Nusantara saves its four ranges unchanged". No estimate is ever shown. | iOS two by two at 390pt; Android tile wrap at font 1.3; the Dapur switch row with TalkBack. |
| 10 Import photos by file name | **PASS** | Thumbnails, viewer route `impor-foto`, reading mascot, announced reading start, 48dp targets inside tiles (`9cd3b21e`, `d38b8ac4`, `06d0bccd`). Tests: `apps/caterer/tests/import.test.tsx` `describe("photo previews")`, `import-images.test.tsx`, `layout.test.tsx` (photo viewer). | Android corner remove target; VoiceOver and TalkBack reading announce. |
| 11 Short tasks as pages, custom `Sheet` | **NOT VERIFIED** | Structure is done: the custom `Sheet` is deleted; form, choice, action and confirm sheets are routes (`c3c33eb4`, `f3d5d129`, `2b1538c8`, fixes `0550e2f7`, `b5535031`, `18882f86`, `4c02f6fc`, `2606cbf5`). Tests: `sheets.test.tsx`, `customer-sheets.test.tsx`, `dapur-sheets.test.tsx`, both `layout.test.tsx`. The Task 9 go/no-go on a phone, which decides whether native form sheets work in Expo Go, never ran, so no fallback was taken or needed. | Task 9 checks (a) to (e); the confirm sheet over a tab-stack sheet (highest iOS risk); the Android swipe-with-text limit; nested scroll in long fit sheets; the picker to Alamat swap on iOS. |
| 12 Important actions end in silence | **PASS** | `ToastProvider` and the toast vocabulary, `SuccessBeat`, confetti (`cc4f76db`, `18ec39c7`, `b5e060b1`). Tests: customer and Dapur `feedback.test.tsx` ("the header stays Bayar, the beat is the one heading... announced once", "opened already paid...", reduced motion, "confetti only on the first paid plan", "the first publish plays the beat..."), `primitives.test.tsx` Toast group, `buy.test.tsx`. | Beat and toast on a phone, including iOS placement; the confetti box. |
| 13 Heart has no micro-interaction or undo | **PASS** | `SaveHeart` with pop, five dots, `select` haptic on save only; toasts "Disimpan" with Lihat and "Dihapus dari simpanan" with Urungkan (`apps/customer/src/discover/saved.ts`); a refused save toasts the error. Tests: the heart tests in `feedback.test.tsx`. | Dots are clipped on row cards (`PackageCard.tsx`, parked device check). |
| 14 Rows appear and vanish in one frame | **NOT VERIFIED** | `useRowMotion`, `useListMotion`, `RowSwap`, `useBlockEnter` and `commitImport` are applied where Decision A allows (`18ec39c7`, `b5e060b1`). Jest proves the `entering` and `exiting` props and their absence on filter, pull and first load (`feedback.test.tsx` "a filter change swaps the rows...", "a pull to refresh swaps the rows too..."), but the Reanimated mock does not animate. | `RowSwap`'s skipped exits on a phone; insert and remove feel. |
| 15 Motion overall | **NOT VERIFIED** | Vocabulary built to the written dials (customer MOTION 2, Dapur MOTION 2; DESIGN.md Feedback and MASCOT-MOTION.md). Whether it now reads as "playful but polished" against the owner's references is a perception no test can close. | The full motion pass on a device, reduced motion included. |
| 16 Docs drift | **PASS** | This commit: DESIGN.md Native polish section plus corrections in place (Bayar header, Tampilan row, Three States, Splash, Sheets, Brand artwork, Dapur dial), `docs/MASCOT-MOTION.md` native section. | None. |
| 17 Build risk | **PASS** | `56275d55`: one Reanimated 4.5.1 and one worklets 0.10.1 at the root through `overrides`; `npm ls react-native-worklets react-native-reanimated` shows every consumer deduped, and `@catera/caterer` is linked in `node_modules/@catera`. Android Hermes export passed for both apps when Task 1 landed. | An Expo Go launch of the Reanimated screens. |

**Totals:** PASS 11, FAIL 0, NOT VERIFIED 6 (findings 3, 4, 5, 11, 14, 15).

## The plan's Review Focus lines

| # | Line | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Stale cache acted on | **PASS** in Jest, **NOT VERIFIED** on a device | While a kept copy shows, every data-changing action is hidden: customer `launch.test.tsx` and Dapur `launch.test.tsx` (kept Beranda and kept day tests). |
| 2 | Another account's cache | **PASS** in Jest | "after logout the next launch paints no cached home"; Dapur "another account's kept day never paints..."; Dapur "a fresh read that lands after logout keeps nothing on the phone". |
| 3 | Sheet dismissal loses input or the parent | **PASS** in Jest, **NOT VERIFIED** on a device | `sheets.test.tsx` ("typed text asks before closing", "a cold OS link to the confirm or action route lands on Beranda...", "a kept note belongs to its delivery and its account..."), `navigation.test.tsx` (cold `/masalah/{id}` over its Hari). On Android a swipe cannot ask first (react-native-screens 4.26.2), so the note is kept as a draft. |
| 4 | Permission changed outside the app | **PASS** in Jest, **NOT VERIFIED** on a device | Both `settings.test.tsx` notification switch blocks (`denied` wins, read on focus and on return to the foreground). |
| 5 | Success beat repeats or goes silent | **PASS** in Jest, **NOT VERIFIED** on a device | `feedback.test.tsx` "opened already paid... never announces", reduced motion keeps one haptic and one announcement, `buy.test.tsx` "turning paid while the screen is open gives one success haptic". |

## NOT VERIFIED: checks that need a device

Nothing below ran. Each needs the Android emulator in Expo Go with the demo backend (most items), a development build (items marked DB), or an iPhone (items marked iOS). The same list opens [the Phase G kickoff](../docs/superpowers/kickoff/phase-g.md).

- **Step 2 matrix.** Cold start signed in and signed out, before and after; Beranda, Jelajah, Jadwal, plan detail, Pengaturan with each switch state reachable in Expo Go; every new sheet; the success beat; heart and toast; list motion; gizi; import; the four empty states; Dapur Hari ini with its confirm sheets; light and dark, Siang and Malam; font scale 1.3 at 360dp; reduced motion (`animator_duration_scale 0` and "Remove animations"); TalkBack on the switch, a sheet, a toast and thumbnails.
- **Task 1:** an Expo Go launch of the Reanimated screens with the aligned Reanimated and worklets.
- **Task 2 (toast):** iOS placement under the large title, under the mood header and as it collapses; iOS sheet toast at the bottom with the keyboard (it over-clears a footer by 34pt); Android snackbar assumes an 80dp tab bar and ignores the keyboard when over a footer; a toast jumps from bottom to top if its sheet closes; iPad sheets place it below the card; the screen-reader flag can resolve after launch.
- **Task 3 (art):** a second `SuccessRig` play may paint one resting frame before the layout-effect reset; crispness at 3x; `MascotReading` above 144pt would upscale.
- **Task 4 (launch):** the native splash and icons on both platforms (DB); the Android 12 splash mask (DB); the hand-off beat; the splash hides before the cached first-screen read lands.
- **Task 5 (customer loading):** Android fade clipping; iOS VoiceOver reading "Memperbarui..."; font scale 1.3 on the skeletons; one blank frame on a cached-launch empty reload.
- **Task 6 (Dapur loading):** header heights are compared from styles in Jest, not measured.
- **Task 8 (Pengaturan):** the real push states in a development build; a permission revoked outside the app; Keluar waiting up to 3 seconds on a bad connection; a cold Dapur link to a Pengaturan sheet opens over Hari ini.
- **Task 9 (sheet go/no-go):** (a) the sheet opens at the form detent; (b) typing expands it and the keyboard never covers the field; (c) back and swipe close it once and keep Hari, including the Android swipe with text; (d) TalkBack lands on the title; (e) the confirm sheet opens over it and returns (highest iOS risk); the iOS narrow-window swipe before `preventNativeDismiss` reaches native.
- **Task 10:** Android nested scroll in long fit sheets; the picker to Alamat swap on iOS.
- **Task 11:** the iOS share toast; the root `impor-baris` sheet over the Impor modal; TalkBack focus on each Dapur sheet title; sheet detents and keyboard expansion.
- **Task 12:** the confetti box (a square over the beat, not the full screen); heart dots clipped on row cards (`PackageCard.tsx`); `RowSwap`'s native exits actually skipped on a filter or a pull; list swaps skip row animations.
- **Task 13:** light and dark captures of the empty and error art, 360dp at font scale 1.3, TalkBack; the count card's fade and layout.
- **Task 14:** iOS two by two at 390pt with ranges; Android range tiles two by two at font 1.0 on 360dp; the Dapur switch row with TalkBack; select-on-focus replacing a carried range on the first keystroke.
- **Task 15:** the Android corner remove target; VoiceOver and TalkBack reading announce.
- **Release items already open:** predictive back and the Android tab-bar hide (a development-build spike); iOS for everything in Phase E; the production photo upload path.

## antislop Delivery Gate

**Result: FAIL.** One Hard Gate item fails (R-35), and six items have a NOT VERIFIED part that needs a device (R-03, R-25, R-32, R-34, R-19 and C-4). Nothing else fails. The Phase F code is not released by this gate; the open items are the Phase G device run. Everything is judged from code, tests and the written contracts, since no render was captured.

### Block 1: Hard Gate

| Rule | Verdict | Evidence |
| --- | --- | --- |
| R-02 Em dash | **PASS** | `git diff 6fcbaa66..7cf0f23d` adds two lines holding the character: a test asserting that the character is absent from the screen and the heading of `packages/brand/assets/phase-f/VISUAL-QA.md`, which came with the artwork delivery. Neither is app text. The four docs written in this commit add none. |
| R-03 Mobile layout | **NOT VERIFIED** | No render at 360dp or font 1.3. Jest checks fixed parts and wrapping (`stateArtSize`, "no cut lines" in `dapur-sheets.test.tsx`, header-height tests). |
| R-17 Numbers | **PASS** | Macros come only from the read and are hidden when empty (`nutrition.test.tsx` "no metrics, no card"); the first-milestone facts come from the read; no stat or count was added. |
| R-18 Testimonials | **PASS** | None added. |
| R-23 Assets | **PASS** | The mascot art, splash marks, icons and confetti are the owner-delivered set approved on 2026-10-11, described as derivatives; code-drawn pieces are the disc, the sparkles and the heart dots. Nothing was generated here. |
| R-24 Navigation | **PASS** | The gear and the "Pengaturan" rows open real routes in both apps; cold links land over a parent (`navigation.test.tsx`). |
| R-25 Contrast | **PASS** for token pairs, **NOT VERIFIED** over photos | `tests/native-contrast.test.ts`: toast and its action in both themes, cream on danger (6.6:1 light, 5.5:1 dark), danger on sage. Skeleton blocks differ from their surfaces (`onHero` for light Malam). Text over photos was not measured on a device. |
| R-26 Interactive elements | **PASS** | Every new control has a real behaviour. One labelled placeholder: "Syarat dan privasi" shows "Segera hadir" with a TODO (`apps/customer/src/settings/Pengaturan.tsx:117`, `apps/caterer/src/settings/Pengaturan.tsx:118`), as R-26 allows. |
| R-27 UI states | **PASS** | Loading, empty and error per screen: both `skeletons.test.tsx`, both `empty-states.test.tsx` (table-driven in light and dark), `help.test.tsx` "shows the shape of the choices while the day loads" and "says why the day did not load...". |
| R-28 FAQ | **PASS** | None. |
| R-32 Keyboard and screen readers | **NOT VERIFIED** | Roles, labels, hints and announcements are asserted in Jest; TalkBack, VoiceOver and hardware keyboard use did not run. |
| R-33 No patch scripts | **PASS** | UI features are in source. `packages/brand/build-phase-f-runtime.mjs` generates asset files and a manifest; it does not rewrite UI source. |
| R-34 Themes | **PASS** in Jest, **NOT VERIFIED** on a device | Light and dark palette tests for `Skeleton`, `Toast`, `SheetHeader`, `MascotLoading`, empty-state art and the choice sheet. |
| R-35 Verify before delivering | **FAIL** | Built and tested (Step 1 above), but there is no recorded click-through of the interactive elements on a device. Step 2 did not run. |
| R-36 Fabricated claims | **PASS** | No security, compliance or performance claim; macros read "Perkiraan dari katering". |
| R-37 Direction | **PASS** | DESIGN.md, the Phase F spec and the dials (customer ENERGY 2 / RHYTHM 2 / MOTION 2; Dapur ENERGY 1 / RHYTHM 1 / MOTION 2). |
| R-38 Real content | **PASS** | Demo mode stays labelled; the hosted catalogue's missing macros show nothing rather than an estimate; the one placeholder is labelled. |

### Block 2: Purpose-Gate

| Rule | Verdict | Reason or evidence |
| --- | --- | --- |
| R-01 Gradient and glow | **PASS** | None added. Confetti uses palette colours; the beat disc is flat `#FFEFD9` with a 3dp ring. |
| R-04 Icons | **PASS** | Ionicons, chosen for relevance (ellipsis for "...", document for files, trash for discard, flag for a report). The code-drawn `Sparkle` is a written-purpose celebration mark (success burst, launch hand-off), limited to `sunriseInk`, `sunrise` and `forest`. |
| R-06 Typography | **PASS** | Plus Jakarta Sans only; the beat title is the named `outcome` variant (26/32). No monospace or tracked caps. |
| R-07 Background pattern | **PASS** | None added. |
| R-08 Arrows | **PASS** | None added. |
| R-09 Badges | **PASS** | None. The thumbnail remove badge is a functional control. |
| R-10 Glass | **PASS** | None. |
| R-12 Shadow | **PASS** | No new shadow; the hero stays the only raised surface. Toasts, cards and tiles are flat. |
| R-13 Glow | **PASS** | None. |
| R-14 Cards | **PASS** | `NutritionCard` tiles are identical because they are four peer metrics in a data grid; the layout varies by platform and by font scale instead. |
| R-19 Animation | **PASS** in code, **NOT VERIFIED** on a device | Each motion has a written purpose in DESIGN.md (beat for a milestone, toast for an outcome, row motion for the user's own insertion). Loops run only while waiting. Reduced motion is covered per piece (MASCOT-MOTION.md). The feel of the motion is not verified. |
| R-22 Illustrations | **PASS** | The Catera mascot, owner-delivered, tied to product states; never beside food photography. |

### Block 3: Liveliness

Design Read: a food-led customer meal-subscription app and a calm kitchen tool for Indonesian home caterers, in the warm forest, cream and charcoal language with the Siang and Malam mood and platform-native chrome; dials as in R-37; motif the day arc and the rantang, with the mascot as occasional warmth; accent sunrise ink. Dials set and explicit: **yes**. Output consistent with the dials: **yes** by contract (Dapur no longer promises MOTION 1). One accent, one motif, structural whitespace and a focal point per screen: **yes by the written contracts; not seen in a render.**

### Block 4: Craftsmanship and Quality Locks

| Item | Verdict | Evidence |
| --- | --- | --- |
| C-1 Intentionality | **PASS** | Reasons are written in DESIGN.md and the code comments next to each decision. |
| C-2 Functional completeness | **PASS** | No dead control; address delete is not built and not shown. |
| C-3 Content-driven | **PASS** | Pengaturan is a platform-grouped list; no template sections. |
| C-4 Resilience | **PASS** for states and themes, **NOT VERIFIED** for breakpoints and keyboard-only | As R-03, R-27, R-32, R-34. |
| C-5 Evidence over claims | **PASS** | Every device claim is marked unverified. |
| R-05 Layout | **PASS** | No template layouts or bento. |
| R-11 Radius | **PASS** | Sheet corner 28, tiles and cards 12 to 16, toggles pills; no pill-everything. |
| R-15 CTAs | **PASS** | "Bagikan undangan", "Lanjut menulis", "Buang", "Lihat Pelanggan", "Buka Pengaturan". |
| R-16 Buzzwords | **PASS** | None. |
| R-20 Identity | **PASS** | Mascot art, arc and rantang. |
| R-21 Dark mode | **PASS** | Both themes tested; Tampilan offers Sistem, Terang, Gelap. |
| R-29 Palette | **PASS** | Existing tokens plus the three toast tokens, contrast-tested. |
| R-30 No clone | **PASS** | Platform-native chrome is the owner's ruling, not a product clone. |
| R-31 Reasons | **PASS** | As C-1. |

## impeccable critique notes

Scope: code, tests and the contracts. No render was viewed, so these are not a visual review. Each note names a strength, then the risk to look at first on a device.

- **Launch and splash.** The hold has a ceiling, the cover matches the native splash geometry, and the gate shows the mascot only after 300ms. Risk: the splash lifts before the cached first-screen read lands (a parked minor), the 1024px marks cost about 525 KB per app to decode at cold start, and the Android 12 mask is untested.
- **Skeletons.** Header heights are held and loaded content arrives as one block, which is what removes the "popping" the owner described. Risk: a dish name that wraps at font 1.3, or a single-meal Menu caption, still makes a loaded header taller than its skeleton.
- **Pengaturan.** Plain grouped rows, a switch that tells the truth, and Keluar that releases the phone. Risk: "Syarat dan privasi" is a dead end labelled "Segera hadir"; Keluar can wait 3 seconds with only a dimmed row to show it; Dapur's Keluar relies on the root swap rather than popping its tab stacks.
- **Sheets.** The ladder makes short tasks stay short, and the held context line stops header jumps. Risk: the Android swipe closes without asking (draft kept instead), and the confirm sheet over a tab-stack sheet is the likeliest thing to fail on iOS.
- **Success beat and Bayar.** One heading, one announcement, one haptic, only on the transition. Risk: confetti is clipped to the beat's square, and the facts begin at 620ms, so a fast reader waits on a beat.
- **Toast.** Anchored to the chrome and held longer for screen readers. Risk: iOS placement rests on measured formulas that no device has confirmed; a toast shown from a closing sheet changes edge.
- **Heart and row motion.** Decision A is followed literally: motion only for the user's own insert or remove. Risk: the heart's dots are clipped by row cards, and `RowSwap` relies on a native config the Jest mock cannot exercise.
- **Empty and error art.** One optical size, 120 shrinking to 96, never beside a food photo, and the held slots stop the count card from jumping. Risk: Masuk's mixed alignment and `bingung` on the Siang Jadwal header are parked; held art keeps the still mounted at opacity 0.
- **Macros.** Only what the caterer entered, with a caption that says it is an estimate. Risk: iOS range values step down to 17/24, Android range tiles go two by two even at normal text on 360dp, and tiles reflow once before the first layout measure.
- **Import previews.** Thumbnails make the six photos recognisable, and the remove target is large and inside its tile. Risk: the Android corner target is untested on a phone, and the older ImportAssistant copy still says "Anda" and uses an en dash in its example (a parked copy task).

## What this commit changes

`DESIGN.md` (Native polish section and in-place corrections), `docs/MASCOT-MOTION.md` (native section), this file, and `docs/superpowers/kickoff/phase-g.md`. No code.
