# Phase F artwork delivery

Delivered locally on `v2` for all P1 and P2 briefs dated 2026-10-10. This package contains **13 finished stills, 10 aligned rig layers, one vector confetti Lottie and its transparent last-frame PNG**. The mascot animation requests use the brief's explicitly permitted layered-rig alternative.

## Files

| Brief | Delivery | Dimensions |
| --- | --- | --- |
| 1–3, splash and Android foreground | `splash-mark-light.png`, `splash-mark-dark.png`, `adaptive-foreground.png` | 1024 × 1024 |
| 4–5, themed and iOS icons | `icon-monochrome.png`, `icon-ios-dark.png`, `icon-ios-tinted.png` | 1024 × 1024 |
| 6–12, seven mascot poses | `mascot-merayakan.png`, `mascot-membaca.png`, `mascot-tidur.png`, `mascot-bingung.png`, `mascot-melambai.png`, `mascot-mencari.png`, `mascot-memasak.png` | 1254 × 1254 |
| 13–14, success / launch alternative | Seven `rig-*.png` layers: body, lid, eyes-open, eyes-closed, arms-up, badge, sparkles | 1254 × 1254 |
| 15, loading alternative | Approved existing layers in `../mascot-motion/`, with recipe in `rig.json` | 480 × 480 |
| 16, reading alternative | `rig-reading-body.png`, `rig-reading-eyes.png`, `rig-reading-magnifier.png` | 1254 × 1254 |
| 17, confetti | `confetti.json` and `confetti-last-frame.png` | 1024 × 1024 |

The heading “All six” in the brief is a counting typo: briefs 6–12 specify seven poses, all included here.

## Originals and clean exports

The generator returned 1254px canvases, including for requested 1024px icons. Every generated original is retained byte-for-byte under `originals/`. On 2026-10-11 the user explicitly approved preserving originals and creating clean exports, overriding the brief's no-retouch instruction for these derivatives.

Root PNGs are **processed transparent derivatives**, not untouched generated masters. Processing removes near-transparent dust and tiny detached islands, resamples onto the requested canvas, centers stills, enforces empty margins, converts monochrome/grayscale values, and aligns selected rig layers. No upscaling or board extraction was used. `processing-records.json` records exact transforms, methods and SHA-256 hashes; `generation-records.json` preserves each prompt and original hash. `originals/manifest.json` is the earlier raw-output inspection and intentionally contains raw acceptance gaps; `manifest.json` is the current export report.

## Animation handoff

Stack rig PNGs at the same origin and size without trimming. `rig.json` gives draw order, hinge/pivot coordinates, poster choices, timing, and reduced-motion behavior. `preview.html` provides light/dark/forest backgrounds, 24–240px still previews, success-layer, reading-loop and existing loader review, and playable confetti.

Revision 3 incorporates the user's further lid correction: the full-width lid now follows the box perspective and draws over the back food/rim, with the hands and badge in front. Intentional hand/lid overlap creates depth. The separately registered eyes retain space around the mouth, the hand grips the badge below its checkmark, and sparkles stay clear of the subject. The blink swaps eye layers discretely so both expressions never show together. The unchanged originals remain preserved. The verifier now checks assembled eye/mouth and eye/food collisions, checkmark occlusion, hand/badge contact, hinge contact, and sparkle/subject collisions; nine animation frames and the full-size light/dark/forest composites were reviewed separately.

Confetti is a finished 60fps, 1.2-second, 24-piece vector Lottie (about 40 KB), with no raster assets or expressions. It plays once and ends fully transparent. Its last-frame PNG is intentionally empty.

The four mascot animations and dark launch twin are supplied as layers and implementation recipes rather than finished JSON/WebP animations. Success check draw-on needs a code mask/vector stroke. The success rig is separately generated from the finished still; use the named still as its final poster. The launch recipe starts with the matching splash PNG so its first frame can match native splash placement; matching isolated splash lid/eye parts are not included. Native layout and animation integration remain to be implemented and verified on devices.

## Final visual review

A second complete visual pass on 2026-10-11 reviewed every finished still and isolated layer on light, dark and forest backgrounds, plus nine sampled states of each assembled rig/loader. It corrected reading blink pivots, anchored the magnifier to its hand, added system tinting to the monochrome preview, corrected the inherited loader size to 480px, and made reduced motion show the named finished posters. See [VISUAL-QA.md](VISUAL-QA.md) and the QA screenshots (local evidence, not in git: `output/phase-f-artwork/qa/`) for the per-asset findings and remaining integration limits.

## Reproduce and inspect

Run from the repository root:

```sh
node packages/brand/build-phase-f-exports.mjs
node packages/brand/build-phase-f-confetti.mjs
node packages/brand/verify-phase-f.mjs
node packages/brand/preview-phase-f.mjs
```

Open `http://127.0.0.1:4117`. The preview helper caches the official lottie-web 5.13.0 runtime under ignored `output/phase-f-artwork/`; the delivered Lottie JSON has no runtime dependency embedded in it.

The verifier checks dimensions, real transparent backgrounds and empty borders, the full central splash/adaptive safe circles, pose/iOS margins, solid black and neutral grayscale values, retained original hashes, export hashes, and confetti palette/timing/vector/final-opacity contracts. Browser checks cover image loading, background/size controls, rig playback, reduced motion, responsive overflow, and Lottie rendering. These checks do not establish launcher-mask or native-device acceptance.

Validation on 2026-10-11: all 23 new PNGs and confetti passed artifact checks; the existing 16 brand assets and five loader layers passed their existing verifier. Browser review passed three backgrounds, four display sizes, success, reading and existing loading previews, one-shot confetti, transparent completion, reduced motion, and 320px, 390px, 768px and 1440px layouts without horizontal overflow or page errors. Repository typecheck/build could not resolve existing `exceljs` and `@anthropic-ai/sdk` dependencies; both native Jest suites stopped on missing Expo modules. Dependency restoration was blocked because the registry could not resolve the repository's pinned `pg@8.23.0`. See `validation.json` for the handoff record.
