# Animated loading mascot — September 10, 2026

The approved subtle loop is implemented on web and customer mobile: 2.4 seconds, a 4px rise at 160px display size, at most 1.5 degrees of tilt, one 180ms blink, and gentle sparkle movement. CSS renders web motion; the existing Reanimated dependency renders mobile motion. No animation dependency was added.

> **Update, October 11, 2026 (Phase F).** The native loader was deleted from the customer app on October 7, 2026 (`d33069f0`) and Dapur never had it. It is restored as a shared component in `packages/mobile-ui` that both native apps use, together with the delivered Phase F mascot art. The native parts of this record are replaced by the section [Native mascot (Phase F)](#native-mascot-phase-f-october-11-2026) at the end; the web parts stand.

## Artwork and integration

Five registered 480px alpha PNGs total 363,926 bytes (355.4 KiB). Original body pixels and sparkle silhouettes are retained; Imagegen supplied two small eye patches. Generated checkerboard backgrounds are opaque and excluded, as documented in `packages/brand/motion-sources/README.md`. Original master files are unchanged. The brand verifier checks source/runtime hashes, real alpha, clear borders, dimensions, and the 500 KiB runtime budget.

`MascotAnimation` accepts `size` and `active`; `MascotLoading` additionally accepts `label` and `startup`. Platforms share `packages/brand/motion.ts`. Assets are bundled locally on mobile and copied through the existing web asset pipeline. Root web loading, shared page-level loading, native font initialization, and the native readiness gate use the mascot. Inline command indicators and error/retry behavior are retained. Shared loaders use Indonesian/English context; pre-provider startup defaults to Indonesian and system text.

The visible group appears after 300ms, with immediate accessible status and no minimum display duration. Layer failures or pending assets retain a neutral poster; web layers are decoded before display, including cached images. Reduced motion displays the static mascot and still reveals the label. Motion pauses when web artwork is offscreen/the document is hidden, or native is backgrounded/the readiness-gate route loses focus. Unmount cancels timers/animations. Navigation and data readiness never wait for a loop.

## Preview and verification

Run `npm run dev` (explicit local synthetic demo), then open `/dev/mascot`. Controls show play/pause, reduced motion and loading completion; three backgrounds show 120/160/200px sizes. The route is unavailable outside development. There is no native preview route on `v2` (`/mascot-preview` went with the old customer screens in `f2b98d02`). Use device accessibility settings for native reduced motion.

`scripts/capture-mascot.mjs` captures desktop/mobile web and a neutral/half/closed pose sheet. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an installed browser. Evidence is under `output/mascot-motion/`. The pose sheet is a review derivative, not master artwork.

Checks cover typecheck, core tests, production build, targeted Playwright tests, both iOS/Android Jest presets, both native bundle exports, and brand verification. PostgreSQL concurrency tests used isolated synthetic `catera_test` on port 25439 because Windows reserved the runner's default port 55439; fresh evidence is in `output/verification/postgres.json`.

Physical-device animation performance, VoiceOver/TalkBack and native screenshots remain unverified: this host has no available Android SDK/emulator or iOS simulator. Jest/export results are not device proof. No production deployment or hosted pilot change was made.

Final results: typecheck and production build passed; 48 core tests passed; 24 native tests passed on each Jest platform preset; Android/iOS exports passed; all brand checks passed; five PostgreSQL concurrency/access scenarios passed. The mascot and navigation-control browser checks passed, with no page errors in the visual capture. The broader journey run passed 6/8 tests: checkout showed an authorization error before schedule preview, and seller production lacked the CSV-export link expected by the existing test. Those checkout/export implementations were not changed. Their failures remain recorded rather than bypassed or counted as passing.

## Follow-up: smooth motion and content-scoped loading

The web header/navigation previously lived inside the page covered by the root loading boundary. They now live in the persistent `(marketplace)` layout, above its content loading boundary. Customer headers/bottom navigation and operational sidebars/top bars retain their DOM and state between matching routes. The mascot fills the changing main content region. Only true native startup uses a full-screen loading surface. Per-page server authorization is retained; a separate catalog context keeps fresh per-navigation offers without remounting the shared provider.

The eye poses now blend for 30ms at each transition, with the half-eye patch retained beneath the closed eye to avoid briefly exposing the open eye between poses. All layers are decoded before the poster handoff; the starting sparkle pose matches the poster. Pausing web motion retains the rendered pose rather than swapping artwork. A JS reveal timer replaces the CSS reveal animation, which was suppressed by the global reduced-motion rule.

Follow-up verification: eight mascot tests and two navigation tests pass, including exact loop-end/start transform equality, intermediate eye opacity, delayed customer navigation at 390/1440px, seller navigation, retained DOM identity, loader bounds, reduced motion, cached images and failed layer fallback. Fresh scoped screenshots are `output/mascot-motion/scoped-390.png`, `scoped-1440.png` and `scoped-seller.png`. Core/native/asset checks and real PostgreSQL concurrency checks pass again. Physical-device validation remains outstanding.

## Native mascot (Phase F), October 11, 2026

Both native apps draw the mascot from `packages/mobile-ui` (`src/brand/` and `src/SuccessBeat.tsx`), so Dapur has it too. Two kinds of art feed it: the five 480px loop layers in `packages/brand/assets/mascot-motion/` (neutral, body, half, closed, sparkles) for the waiting loop, and the delivered Phase F stills and rigs, shipped only as the downscaled copies in `packages/brand/assets/phase-f/runtime/` (see DESIGN.md, Native polish (Phase F), Artwork use and optical size). Both are processed transparent derivatives, never masters. Nothing here is a Lottie file except the confetti.

### Pieces

| Piece | File | What it does |
| --- | --- | --- |
| `MascotLoading` | `brand/MascotLoading.tsx` | The waiting loop with a task line. Default size 140. `startup` fills the theme canvas and sets the line in the system font. |
| `MascotArt` | `brand/MascotArt.tsx` | One of seven stills (`merayakan`, `membaca`, `tidur`, `bingung`, `melambai`, `mencari`, `memasak`) at one optical size: visible height equals `size`, frame width follows the pose. Static. |
| `StateArt` | `brand/StateArt.tsx` | A still above an empty or error title, sized by `stateArtSize`. `held` keeps its box with the mascot invisible. |
| `SuccessRig` | `brand/SuccessRig.tsx` | The seven-layer success rig, played once. |
| `SuccessBeat` | `SuccessBeat.tsx` | The rig in front of a code-drawn disc (`SuccessRing`), a five-sparkle burst (`Sparkle`), the facts, the haptic and optional confetti. |
| `MascotReading` | `brand/MascotReading.tsx` | The three-layer reading rig for the Dapur import assistant. |

### Timings against the `nativeMotion` tokens

`nativeMotion` since Phase G ("Even slower", owner pick of October 13, 2026, `98af208e`): `control` 200, `selection` 340, `content` 440, `feature` 680 ms, ease `cubic-bezier(.33, 1, .68, 1)`, spring damping 22 and stiffness 120 (critically damped). Before Phase G they were 120, 180, 220 and 320 ms on `cubic-bezier(.16, 1, .3, 1)` with a damping 18, stiffness 260 spring. Transform and opacity only. Rows tied to a token moved with it; the rig's own segment times did not change. The rig timelines use the Catera ease, solved as a worklet, but their segment times are the rig's own recipe (`rig.json`, `motionRecipes`), so only some line up with a token.

| Piece | Timing | Token relation |
| --- | --- | --- |
| `MascotLoading` loop | 2400ms linear loop (`mascotMotion.duration`); reveal after 300ms (`mascotMotion.delay`); a 4 rise at size 160 scaled to `size`, 1.5 degree tilt, one blink, gentle sparkle | A waiting loop and a reveal delay, not tokens. It is one of the two loops allowed (with the skeleton pulse), only while something waits. |
| `StateArt` `held` change | Opacity only, over `content` (440 since Phase G) on the Catera ease | `content`. No entering or exiting animation, so the art leaves with its section. |
| `SuccessRig` | 1200ms total (`SUCCESS_RIG_MS`): squash to 96% 0 to 120, spring back 120 to 240, hop 6% of the rig height with the lid opening 12 degrees 120 to 420, fall 420 to 560, land 98% then 100% 560 to 700, badge 0.6 to 1.07 to 1 and opacity 0 to 1 between 300 and 620, sparkle layer 0.8 to 1 and out 450 to 1050; rest from 1050 | The 120ms squash equals `control`. The other segments are rig values. |
| `SuccessRing` disc | 0.35 to 1 over 420ms (`SUCCESS_RING_MS`) | Spec value, between `content` and `feature`. |
| `SuccessBeat` burst | Five sparkles from 70 to 112dp, 450 to 1050ms (600ms), Catera ease | Spec value. |
| `SuccessBeat` facts | Title and children fade up 8dp from 620ms (`SUCCESS_FACTS_AT`) over `content` (440 since Phase G, so they settle at 1060ms instead of 840ms) | `content`. |
| `MascotReading` | 2400ms linear loop (`READING_LOOP_MS`): eyes travel 0.67% of the canvas and the magnifier swings 4 degrees on a cosine, a blink to 0.16 at 45 to 55% for each eye about its own pivot, the paper highlight 0 to 1 to 0 at 40, 50, 55 and 65% | A waiting loop, not a token. |
| `LaunchCover` (not a mascot piece) | The splash mark scales 1 to 1.04 and fades over `feature`, 680ms since Phase G (`LaunchCover.tsx:83-84`; was 320) | `feature`. Whether 680ms feels slower than the splash it follows is a device judgement owed to the G20 gate; if it does, the cover moves to `content`. The doc comment at `LaunchCover.tsx:43` still says 320ms. |
| `SaveHeart` burst (not a mascot piece) | The heart rises to 1.22 over `control` and springs back on `nativeMotion.spring`; five dots travel to 31dp and fade within `HEART_BURST_MS`, which is `feature`, 680ms (`SaveHeart.tsx:21-23, 90-93`; was 380ms, a fixed number) | `control`, `feature` and the spring. Unsave is instant. Both hearts are forest since Phase G; the dots alternate `forest` and `forestDeep`. |
| `RantangTrack` stage change (not a mascot piece) | On a stage change the marker slides, the progress bar grows as a `scaleX` from the left edge, the warning dash fades and the reached stop's disc scales 1 to 1.14, all over `feature` 680ms on the Catera ease (`RantangTrack.tsx:162-178`). Nothing animates on first paint, refresh, pull or tab return, and nothing loops. | `feature`. Was 320ms with a three-stop track before Phase G. |

### Reduced motion

| Piece | Fallback |
| --- | --- |
| `MascotLoading` | The neutral poster, static; the label still appears after the 300ms reveal. |
| `StateArt` | A `held` change is instant. |
| `SuccessRig` | Shows the `mascot-merayakan` still at the same size, never moves, and still calls `onDone` once per play. |
| `SuccessBeat` | `mascot-merayakan` at 180 and the facts. No disc, no burst, no confetti. The haptic and the announcement are kept. |
| `MascotReading` | The `mascot-membaca` still. |
| `RantangTrack` | Every value is set at once: the marker, the bar, the dash and the stop discs jump to the new stage (`RantangTrack.tsx:162-165`). Since Phase G (GC-F2) the reduced-motion setting is read live, so a change in the phone's settings applies at once. |

### Haptics and announcements

- `SuccessBeat` fires one `success` haptic on the first frame of a play and announces its title once per play, also under reduced motion. The resting frame (`play` false, for example a reopened paid checkout) fires neither.
- `SuccessRig` fires no haptic; its caller owns it. `MascotLoading`, `MascotArt`, `StateArt` and `MascotReading` fire none. Reading start is announced by the import assistant, once, through `announceForAccessibility`.
- All art is decorative for screen readers except `MascotLoading`, whose group is a busy progress bar named by its label from the first frame.

### Pausing

`MascotLoading` plays only while the app is `active`, its screen is focused, motion is not reduced and every layer has loaded, and it rests on the poster when a layer fails. `MascotReading` plays while its screen is focused and the app is not in the background. Unmounting cancels the loop and removes the listeners. A first-frame rule holds for `SuccessRig` and `SuccessBeat`: mounted already playing, the first painted frame is the timeline's first frame, never the resting frame.

### Evidence and limits

Jest covers the frame math (14 pose and size cases), the success timeline, `onDone` once per play, the focus and blur of the loops, reduced motion and the dark palette (`apps/customer/tests/mascot-art.test.tsx`, `apps/customer/tests/primitives.test.tsx`, both apps' `empty-states.test.tsx`, `feedback.test.tsx`), and `tests/brand-phase-f.test.ts` checks the runtime files, their records and the crisp ceilings. Not verified on a device: the loops' performance, the first painted frame of a second `SuccessRig` play (the clock resets in a layout effect), on-device crispness at 3x, and `MascotReading` above about 144pt, which would upscale its 600px layers (its spec use is 120). Physical-device animation, VoiceOver and TalkBack remain unverified, as in the web record above.
