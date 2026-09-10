# Animated loading mascot — September 10, 2026

The approved subtle loop is implemented on web and customer mobile: 2.4 seconds, a 4px rise at 160px display size, at most 1.5 degrees of tilt, one 180ms blink, and gentle sparkle movement. CSS renders web motion; the existing Reanimated dependency renders mobile motion. No animation dependency was added.

## Artwork and integration

Five registered 480px alpha PNGs total 363,926 bytes (355.4 KiB). Original body pixels and sparkle silhouettes are retained; Imagegen supplied two small eye patches. Generated checkerboard backgrounds are opaque and excluded, as documented in `packages/brand/motion-sources/README.md`. Original master files are unchanged. The brand verifier checks source/runtime hashes, real alpha, clear borders, dimensions, and the 500 KiB runtime budget.

`MascotAnimation` accepts `size` and `active`; `MascotLoading` additionally accepts `label` and `startup`. Platforms share `packages/brand/motion.ts`. Assets are bundled locally on mobile and copied through the existing web asset pipeline. Root web loading, shared page-level loading, native font initialization, and the native readiness gate use the mascot. Inline command indicators and error/retry behavior are retained. Shared loaders use Indonesian/English context; pre-provider startup defaults to Indonesian and system text.

The visible group appears after 300ms, with immediate accessible status and no minimum display duration. Layer failures or pending assets retain a neutral poster; web layers are decoded before display, including cached images. Reduced motion displays the static mascot and still reveals the label. Motion pauses when web artwork is offscreen/the document is hidden, or native is backgrounded/the readiness-gate route loses focus. Unmount cancels timers/animations. Navigation and data readiness never wait for a loop.

## Preview and verification

Run `npm run dev` (explicit local synthetic demo), then open `/dev/mascot`. Controls show play/pause, reduced motion and loading completion; three backgrounds show 120/160/200px sizes. The route is unavailable outside development. Native development builds expose `/mascot-preview`; release builds redirect away. Use device accessibility settings for native reduced motion.

`scripts/capture-mascot.mjs` captures desktop/mobile web and a neutral/half/closed pose sheet. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using an installed browser. Evidence is under `output/mascot-motion/`. The pose sheet is a review derivative, not master artwork.

Checks cover typecheck, core tests, production build, targeted Playwright tests, both iOS/Android Jest presets, both native bundle exports, and brand verification. PostgreSQL concurrency tests used isolated synthetic `catera_test` on port 25439 because Windows reserved the runner's default port 55439; fresh evidence is in `output/verification/postgres.json`.

Physical-device animation performance, VoiceOver/TalkBack and native screenshots remain unverified: this host has no available Android SDK/emulator or iOS simulator. Jest/export results are not device proof. No production deployment or hosted pilot change was made.

Final results: typecheck and production build passed; 48 core tests passed; 24 native tests passed on each Jest platform preset; Android/iOS exports passed; all brand checks passed; five PostgreSQL concurrency/access scenarios passed. The mascot and navigation-control browser checks passed, with no page errors in the visual capture. The broader journey run passed 6/8 tests: checkout showed an authorization error before schedule preview, and seller production lacked the CSV-export link expected by the existing test. Those checkout/export implementations were not changed. Their failures remain recorded rather than bypassed or counted as passing.

## Follow-up: smooth motion and content-scoped loading

The web header/navigation previously lived inside the page covered by the root loading boundary. They now live in the persistent `(marketplace)` layout, above its content loading boundary. Customer headers/bottom navigation and operational sidebars/top bars retain their DOM and state between matching routes. The mascot fills the changing main content region. Only true native startup uses a full-screen loading surface. Per-page server authorization is retained; a separate catalog context keeps fresh per-navigation offers without remounting the shared provider.

The eye poses now blend for 30ms at each transition, with the half-eye patch retained beneath the closed eye to avoid briefly exposing the open eye between poses. All layers are decoded before the poster handoff; the starting sparkle pose matches the poster. Pausing web motion retains the rendered pose rather than swapping artwork. A JS reveal timer replaces the CSS reveal animation, which was suppressed by the global reduced-motion rule.

Follow-up verification: eight mascot tests and two navigation tests pass, including exact loop-end/start transform equality, intermediate eye opacity, delayed customer navigation at 390/1440px, seller navigation, retained DOM identity, loader bounds, reduced motion, cached images and failed layer fallback. Fresh scoped screenshots are `output/mascot-motion/scoped-390.png`, `scoped-1440.png` and `scoped-seller.png`. Core/native/asset checks and real PostgreSQL concurrency checks pass again. Physical-device validation remains outstanding.
