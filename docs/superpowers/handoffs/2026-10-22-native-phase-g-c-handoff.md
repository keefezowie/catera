# Phase G-c handoff (gates, fixes and wrap-up), 2026-10-22

Phase G is closed. The G-c session ran gates g-c-1 to g-c-14 on the Android emulator, fixed what they found in GC-F1 to GC-F18, and finished G20 (DESIGN.md, MASCOT-MOTION.md, RUNBOOK section 15). Owner decision of October 21, 2026: there is no Phase H kickoff file. Every leftover is in this handoff with an owner: **owner** (you), **next code session**, or **Mac/device** (needs hardware or credentials this machine does not have).

## Where things are
- Branch `v2` at `92ca26b5`, plus the commit that adds this file. G-c started after `e84e4285`. Nothing is pushed.
- Source of truth, unchanged: the spec `docs/superpowers/specs/2026-10-13-native-phase-g-design.md` and the plan `docs/superpowers/plans/2026-10-13-native-phase-g.md`. DESIGN.md "Native Phase G, October 2026" is the contract for what shipped.
- Ledger: `.superpowers/sdd/2026-10-12-native-phase-g/progress.md`, section "G-c gate session". It has every review, attempt and decision.
- Gate results: `output/native-review/phase-g/gates/g-c-1` to `g-c-14`, each with `RESULTS.txt` and its captures.
- Pool worktrees `C:\wt\1`, `C:\wt\2` and `C:\wt\3`. Briefs are in `C:\wt\logs-g\`.
- Final checks on `v2` `92ca26b5`: customer Jest 1462, caterer Jest 616, `npm test` 1043, typecheck 0 errors, build OK.
- APKs: output/apk/catera-customer-uat-arm64-v8a-20261022-92ca26b5.apk (55.1 MB) and output/apk/catera-dapur-uat-arm64-v8a-20261022-92ca26b5.apk (54.4 MB), arm64 UAT release builds from v2 92ca26b5 with the DimmingView patch applied.
- Usage: weekly 52% at the end of G-c (2026-10-22; 15% at the start of G-c), 5-hour 18%.
- Push: `v2` is not pushed. The owner decides when.

## What G-c fixed
Every fix had an Opus review that ended CLEAN, or minor-only findings the controller checked. Commits are the ones on `v2`; rebased commits replace the builder's original hashes.

| Task | Commits on v2 | Attempts | Outcome |
|---|---|---|---|
| GC-F1 | 1deef09f, a0a98fc1 | 2 Sonnet | Form sheets keep the focused field and the action above the keyboard (Dapur Pindah tanggal). g-c-2 PASS. |
| GC-F2 | f9f98f66, ae585c22, 74c3c81d | 3 Sonnet | Reduced motion is read live from a shared store; the Dapur attention row reads "Makan siang/malam" from the payload; the calendar has a staff voice. Fixed the push-timing baseline. g-c-2 PASS. |
| GC-F3 | a408cec4, 06065694, 41230a26 | 3 Sonnet (the third was log cleanup) | `WindowEdge` measures the screen edge in the sheet's own coordinate space; the held context line stays on one line. The masalah button still sat under the gesture bar, which led to GC-F5. |
| GC-F4 | e49e9e48, 468dbacf | 2 Sonnet | `useStackedLayout` by effective width (`width / fontScale`): proof tiles stack below 400, the selection bar below 340. |
| GC-F5 | 74d2fc13 | 1 Sonnet | Pinned footer for the primary action in every root-stack form sheet (owner decision, October 20). g-c-5 PASS except the Dapur row editor with the keyboard. |
| GC-F6 | 6bfdf500 | 1 Sonnet | Dapur form sheets lift the footer to the keyboard top (`lift = below + keyboardLift`). g-c-6 steady state PASS; a first-focus over-lift went to GC-F8. |
| GC-F7 | 2b24b99f | 2 Sonnet | Beli and Ubah hari fall back from a removed address; Dapur shows the live address, scoped to that kitchen. New migration `20261020100000_customer_live_address.sql`. g-c-6 PASS. |
| GC-F8 | d72e2347, 012273c5 | 2 Sonnet | Settled readings per keyboard state; the footer goes inline when the sheet stays at 0.6 under the keyboard. g-c-8 PASS; an inline error scrolled out of view went to GC-F11. |
| GC-F9 | d331bcfb, 8999905a | 2 Sonnet | G18 copy follow-ups: the renewal line names the blocking plan, "Gagal diantar" everywhere, Dapur English "Head out" and "Arrived", staff Pindah ke with a weekday. g-c-9 PASS. |
| GC-F10 | ec85fda9, eeaebb58 | 2 Sonnet | The Perlu kamu urus row and the count card caption stack below 340; one status for a day across screens. g-c-9 PASS. |
| GC-F11 | 24122100, 8f170cbe | 1 Sonnet and a follow-up | Inline footer errors stay in view; tab sheets meet the keyboard. g-c-9 PASS with two findings for GC-F12. |
| GC-F12 | 8da41b57 | 1 Sonnet | Only a footer content change scrolls the sheet (`footerKey`); tab sheets re-fit the bar after the keyboard (`barFit`). g-c-10 PASS; a band after a tab switch went to GC-F14. |
| GC-F13 | e8133251 | 1 Sonnet | English counts use `plural()`; Jadwal shows "Ditandai sampai". Perpanjang stays charcoal. g-c-10 PASS. |
| GC-F14 | 1bc9e6f9, ff9a9b6e | 2 Sonnet | Tab sheets fit the bar in every state, ignore the opening focus and recover from an oversized margin. g-c-11 ALL PASS. |
| GC-F15 | 0343fd1b, 1123f9cf | 2 Sonnet | `MascotArt` on expo-image with stills loaded once through `Image.loadAsync`; dissolve only on a pose change. `NutritionCard` starts at the right column count. g-c-13 PASS on the grid; the mascot pop is shorter but still there. |
| GC-F16 | cf3eb3a9, 1b366313 | 3 Sonnet, then 1 Opus | `FadeSwap` is a keyed `Animated.View` with an `entering` FadeIn, so it fades in the mount transaction. Hari ini keeps the route part, the expanded list and the ticks per date and meal, and the `ConnectionBanner` sits above the swap. g-c-13 PASS on Hari ini state. |
| GC-F17 | 432cf51e, 818825a3, 239cb4b2 | 3 Sonnet | Split a Siang/Malam intent from the mood so the arc moves on the press; Hari ini's key dropped the stage, so a stage change no longer fades the day. g-c-14: Dapur PASS, Beranda page swap regressed. |
| GC-F18 | 92ca26b5 | Controller, mechanical | Reverted the toggle part of GC-F17 (owner decision, October 22): 8 files restored to `1b366313`. Kept the Hari ini key `` `${loading ? "loading" : "day"}-${date}` ``. |

## Gates g-c-1 to g-c-14

| Gate | Commit | PASS | NOT VERIFIED, and why |
|---|---|---|---|
| g-c-1 | e84e4285 | Tracker (stages, a11y sentence, contrast, 360dp at 1.3); calendar (window ends, captions, English, TalkBack); Pindah tanggal title focus | Failed hero photo (demo cannot produce it); calendar one-month window and no open day (demo cannot produce them); action sheet TalkBack (APK built, never installed); the emulator died during check A |
| g-c-2 | 74c3c81d | Pindah tanggal keyboard at 1.0 and 1.3; live reduced motion; impor-baris large detent; bantuan-form, hapus-akun, ubah-hari at 1.3; TalkBack titles | ulasan and the pembelian copies (not reached); a tab-stack sheet with a field (Expo Go ANR); action sheet TalkBack (arm64 APK cannot run on the x86_64 emulator) |
| g-c-3 | 74c3c81d | Nothing | Action sheet TalkBack (release APK has no demo sign-in, no credentials entered); G9 states and device checks (the emulator went offline; host memory at 79 of 90 GB) |
| g-c-4 | 63adb93d (GC-F3 branch), v2 for G9 | masalah header at 1.3; masalah with the keyboard; alamat-form at 1.3 (both copies); G9 selection, rounds, proof photos with camera and upload, failed upload, offline banner, Data akun request; action sheet TalkBack on a debugOptimized build | ulasan and pembelian/bantuan-form (no finished plan, trial already bought); Pindah tanggal race (no movable stop) |
| g-c-5 | 74d2fc13 | Pinned footer at every detent, 1.0 and 1.3, light and dark, 360dp; G13 address flows; G8 offline, ReadError, FormError, Data akun | ulasan (no finished plan); Pindah tanggal (no movable stop); StaleCopy (needs a failing backend while online, and stopping the owner's backend is out of scope); arrived-unconfirmed hero (the meal already had a report) |
| g-c-6 | 2b24b99f | Row editor footer at the keyboard top; GC-F7 buy fallback and Dapur live address; Pindah tanggal keyboard and race; arrived-unconfirmed hero with photo; busy Bayar and Kirim | Buy fallback with no address left (would mean deleting every address); Coba lagi busy frame (offline it fails within one frame) |
| g-c-7 | 2b24b99f | G18 copy in both apps and both languages: 0 retired words, most rows PASS | Push title and bodies (no push in Expo Go); the customer "Ditandai sampai otomatis" hero (the nightly job only closes earlier days); the Aktifkan review time (needs bank details); the unsaved-guard dialog; "Penuh" (no full day) |
| g-c-8 | 012273c5 | Row editor first focus, hide and refocus; inline footer at 0.6; the real build expands the sheet to large at 1.0 | Nothing new |
| g-c-9 | 8f170cbe | Inline errors in view; balas at the keyboard top at 1.0, 1.3 and 3-button; GC-F10 narrow layouts; GC-F9 copy | Floating Gboard (skipped) |
| g-c-10 | e8133251 | First focus; Enter-submit error; balas keyboard hide; Dapur "1 address"; Jadwal 21 Okt | The 0.6 hold with the keyboard (only the stuck IME reproduced it); proof, import and review plurals (each needs a real photo, a server-rejected row or a review) |
| g-c-11 | ff9a9b6e | ALL PASS: every root form sheet slide-in, balas tab return at 1.0, 1.3 and 3-button, fresh-large tab switch, background and resume, keyboard regressions | None |
| g-c-12 | ff9a9b6e | Mascot stretch, crispMaxSize, Sparkle colour, Menu single-meal caption, footer anchor, Malam in dark, reduced motion, TalkBack on tracker, banner and calendar, flight mode, LaunchCover pace, tracker pace | Seven-day wrap and empty-kitchen header (demo kitchen has Mon-Fri packages); iOS sheet over-clear (no Mac); the banner's spoken announcement (no audio) |
| g-c-13 | 1b366313 | NutritionCard 2x2 from the first frame; Hari ini expanded list, ticks and banner; alamat typed text; reduced-motion mascot | "Bagikan bagian 2" (both sessions fit one part); the mascot pose-change dissolve (no reachable screen changes a mounted pose) |
| g-c-14 | 239cb4b2 | Dapur Berangkat in place; Dapur mood toggle never blank; date change fades; banner never changes; PackageDetail fades from low opacity; form typed text kept | Mulai masak (no Terjadwal session left in the demo data) |

g-c-14's Beranda result (page swap 0.54-1.21s on production JS against 0.22-0.35s before) led to GC-F18. GC-F18 was not re-gated on a device; it restores code that g-c-13 measured.

## Owner decisions this session
- **October 20, 2026.** Pin the primary action in a form-sheet footer, outside the scroll content and above the gesture bar, at any detent and font size.
- **Inline footer fallback (controller decision on GC-F8, accepted).** When a sheet stays at 0.6 under the keyboard and the body would be too short, the footer moves into the scroll content until the keyboard goes. g-c-8 showed this happens only in Expo Go; the real build expands to large.
- **WaitingList threshold 340 (controller decision on GC-F10).** The Perlu kamu urus row keeps the action beside the text on typical phones and stacks only below 340 effective width.
- **Perpanjang stays charcoal (controller ruling on GC-F13).** Colour direction K made it charcoal on purpose (`98af208e`).
- **October 21, 2026.** One more focused round (the Siang/Malam toggle and the Mulai masak blink), then wrap up. Handoff only, no Phase H kickoff file.
- **October 22, 2026.** Revert the toggle part of GC-F17. Keep the Hari ini stage changes in place.

## Owner actions on the hosted project
Steps and commands are in `docs/RUNBOOK.md` section 15.
1. **Apply the missing migrations.** The hosted UAT backend lacks G3 (`20261014090000`, `20261014091000`), G4 (`20261014100000`), G5 (`20261014110000`), G13 (`20261014120000`), G18 (`20261014130000`) and GC-F7 (`20261020100000`). Until then the UAT APKs show Phase G screens over an older backend.
2. **Schedule auto-confirm every few minutes.** `/api/jobs` is the only thing that auto-confirms, and the repository runs it once a day at 09.00 WIB (`vercel.json`). The two-hour promise holds only once it runs every few minutes (a Vercel plan cron, or `pg_cron` with `pg_net`).
3. **Push backstop.** `.github/workflows/push-jobs.yml` runs only from the default branch (`main`), so nothing calls `/api/jobs/push` while it lives on `v2`. Put it on `main` with its secrets, or schedule the endpoint elsewhere.
4. **Confirm the EAS project ids.** The customer and Dapur fallback ids in the app configs are unconfirmed.
5. **Other inputs still owed:** FCM V1 and APNs credentials, production SMS, and the text for the "Syarat dan privasi" page.

## Known product gaps

| Gap | Evidence | Owner |
|---|---|---|
| The Beranda Siang/Malam swap takes 0.22-0.35s on production JS (0.97-1.63s on dev JS). The arc disc does not move until the page commits. Cause: the root mood context re-renders all of Beranda, and every toggle remounts the hero (`` <HeroPager key={`pager:${meal}`}> `` at `apps/customer/src/today/Beranda.tsx:423`, `<Plate key="hero">` at `:453`). Suggested approach: keep both meal heroes mounted in one stable container and cross-fade them by opacity, memo the sections that do not depend on mood (WaitingList, TomorrowEntry, UpcomingDays, PlansRow), and only then drive the arc from a shared value written in `onPress`. The intent split was tried in GC-F17 and reverted in GC-F18: in g-c-14 the disc moved 0.10-0.36s after release, but the page swap took 0.54-1.21s and a 285ms frozen frame stalled the disc mid-arc. | g-c-13 Part B, g-c-14 item 1 | next code session |
| PackageDetail starts its fade in the loading layout and then jumps to the bleed layout; the sticky footer is outside the fade, pops in at full opacity and drops about 37px. With production JS only the footer pop remains. | g-c-13 item 1, g-c-14 item 3 | next code session |
| The first Desember `tidur` mascot still appears after its month: 35ms on the dev build, 61-555ms in Expo Go, with no fade. | g-c-13 item 2 | next code session |
| Beranda's cold load and the Jadwal month change swap in one frame with no fade. | g-c-13 item 1 | next code session |
| After a failed submit, keyboard focus lands on an earlier chip (Jakarta Barat, "Ada yang kurang atau salah"), so Enter changes the chip instead of retrying. | g-c-10, g-c-11 | next code session |
| Dapur Hari ini has no `StaleCopy`: an online read failure with a kept copy is silent there. | DESIGN.md review, ledger | next code session |
| The "Demo (data contoh)" band arrives about 1.2s after the content and pushes it down. | g-c-12 extra B, g-c-13 | next code session |
| The Dapur count skeleton is shorter than the loaded card (hero ends at 1202 against 1408 px), so the card grows when data lands. | g-c-9 | next code session |
| "Take {n} more photos first." is not pluralised in the ProofSheet hint (`apps/caterer/src/today/ProofSheet.tsx:283`; the visible line at `:289` is). | DESIGN.md review | next code session |
| The renewal line works out the blocking plan on the client. The server should return a `blockedBy` field from `v1.multi_renewal`, because client and server can disagree on a pending checkout at the same caterer or a cancelled last day. | GC-F9 review | next code session |
| Stale code comments: `packages/mobile-ui/src/LaunchCover.tsx:43` says `feature` 320ms (it is 680ms); `apps/customer/src/today/WaitingList.tsx:38` calls the section title forest. `apps/caterer/src/today/DeliveryOrder.tsx:27` still says a stage change re-keys the swap, which GC-F17 ended. | DESIGN.md review; this handoff | next code session |
| The Hari ini stop list collapses after a Malam and back round trip, because `useRouteView` resets by date and meal (`TodayScreen.tsx:371`). Noted by the gates, not judged. | g-c-13 item 4a, g-c-14 item 2 | owner (decide if it matters) |
| Hardware Back did not close the alamat sheet once, and the first taps on Ubah did nothing for about a minute. Not reproduced; Gboard was in its hardware-keyboard state from console mouse events. | g-c-14 item 3 | next code session (recheck) |

## Carry-overs from the plan

| Item | Owner |
|---|---|
| The full Android device gate (G10) on a real phone | Mac/device |
| The iOS run, including the iOS sheet over-clear and the iOS focused-field scroll with a footer | Mac/device |
| A development build with FCM V1 and APNs, and real push delivery | owner (credentials), then Mac/device |
| Masuk alignment (G16) | next code session |
| The paid "tambah porsi" top-up | owner (scope), then next code session |
| Spec section 14: the AGENTS.md "preserve the latest approved palette" sentence after palette K (item 1), EAS ids (item 8), hosted scheduler (item 9), why the hero photo failed on the owner's phone (item 10) | owner |

G20 Step 4's antislop audit file was retired with the old skill stack on October 17, 2026; this handoff carries the open items instead.

## Environment notes
- **The emulator IME sticks.** When the keyboard draws but the sheets do not lift, `adb reboot` is not enough. Cold-restart: `adb -s emulator-5554 emu kill`, then `emulator -avd Catera_Pixel8_API36 -no-snapshot-load -no-snapshot-save`.
- **Use JDK 17 for builds.** The Studio JBR (JDK 25) fails `:react-native-worklets:configureCMake` ("A restricted method in java.lang.System has been called"). JDK 17 is in `~/.gradle/jdks`.
- **Caterer Jest** must run as `npx jest` from `apps/caterer`. A mis-invoked run stalled in GC-F14.
- **The demo sign-in only works with dev JS** (`__DEV__`). For a production-JS check, sign in on dev JS first, then switch the server to `--no-dev --minify`; the session is kept.
- **Backend data dir** is `.data/phase-g-c-4` (owner's process on :3000). Gates g-c-4 to g-c-14 added demo data to it; each RESULTS.txt lists what changed. A new migration needs a fresh data dir.
- The arm64 APKs cannot run on the x86_64 emulator; gates used a debugOptimized x86_64 build. The emulator died three times on October 20 under host memory pressure, and stayed stable once the owner rebooted the host.
- `graphify-out/`, `catera-phase-f-artwork.zip`, `.claude/`, `apps/web/next-env.d.ts` and `output/verification/postgres.json` are untracked or locally modified in the main tree. Never stage them.
