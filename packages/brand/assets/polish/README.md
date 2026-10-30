# Catera polish artwork delivery

**Current Dapur empty state (October 30):** the owner chose `dapur/dapur-kosong.png` (asset 46, the empty wok on a switched-off kompor, option C3; byte-identical to `dapur/alternatives/dapur-wok-off-duty-v2.png`) for the Dapur "no orders" state. Asset 45, `dapur/dapur-rak-kosong.png`, is superseded: it holds its original shelf delivery bytes, is marked `usedByApp: false` in the manifest, and is not shipped. The order-spike version briefly selected for asset 45 was withdrawn; its bytes remain as `dapur/alternatives/dapur-order-spike-v1.png` and its record in `revision-order-spike-2026-10-30.json`. Everything in [dapur/alternatives/](dapur/alternatives/README.md) is reference only.

Generated on 2026-10-30 from `docs/brand/2026-10-30-polish-artwork-prompts.md`, using built-in image generation, one asset per call. All 45 requested filenames are present in the specified group folders: 29 P1, 7 P2 and 9 P3; asset 46 (dapur-kosong, P3) was added on October 30 as asset 45's replacement. These are generated originals; the apps use only the runtime derivatives described below.

Open [gallery.html](gallery.html) to review the complete set on cream, forest and pink, including 24/40/56 px previews. Click an image to open the original. [manifest.json](manifest.json) records actual dimensions, SHA-256 hashes, pixel transparency counts and framing warnings. [generation-records.json](generation-records.json) records final prompts, reference selection by asset type, original generator paths, acceptance checks and regeneration attempts.

## Original-file truth

- 46 originals (45 used by the apps, 1 superseded). 45 PNGs have decoded alpha transparency; `onboarding/welcome-meja.png` is intentionally opaque at 1024 × 1536.
- All other originals are 1254 × 1254. Eleven food cutouts were requested at 1024 × 1024 but returned at 1254 × 1254. They have not been resized or represented as exact-size exports.
- Every delivered PNG matches its selected generator source byte-for-byte. No cropping, segmentation, extraction from a reference board, retouching or upscaling was performed.
- The apps never import these originals. `node packages/brand/build-polish-runtime.mjs` writes downscaled derivatives of the 45 used assets to [runtime/](runtime/manifest.json) (3x the largest display size, capped at the source size, never enlarged, not trimmed; alpha kept; welcome-meja as an opaque JPEG at its native 1024 x 1536). The runtime manifest records each derivative's source file and hashes; they are not masters. Use contain sizing for cutouts and cover sizing for the welcome photograph, as directed by the brief.

## Review and remaining deviations

Each generated image was inspected as it was returned. Fresh generations corrected the lid-only address pin and map primer, single-tier area empty state, four-skewer sate, and visibly empty Dapur tier stack. The scooter retry changed the rantang into a lunch box, so the original three-tier scooter was retained. Counts and subject checks were reviewed visually; these are not automated semantic guarantees.

The delivery is **generation complete, with specification deviations**. It is not an assertion that every brief criterion passed:

- 24 illustrations (23 used; the 24th is the superseded shelf) have less than the requested 10% clear margin on at least one side (visible-subject bounds measured at alpha >= 128). Individual files are flagged in the manifest and gallery. No visible subject reaches the canvas edge at that threshold. Layout padding can protect presentation, but it does not make the original satisfy the specified margin.
- Eleven food cutouts differ from the requested dimensions, as described above.
- The revised exploded rantang has a separate carrying arch above three same-width food tiers, no frame or base below, and generous outer margins. Its tier gaps remain small. The family-size pair has the required five and three tiers, but the smaller container is taller than half the larger one. The superseded asset 45 shelf has a tight margin; its replacement, asset 46, has margins above 10% on every side. These should be assessed in their eventual interface context.
- Alpha is real, but generated food cutouts retain fine irregular pixels around their edges. The gallery provides contrasting backgrounds for edge review before runtime integration; no edge cleanup has been applied to the originals.

## Verify and rebuild the gallery

Revision on October 30: replaced assets 11, 15 and 27 with fresh built-in image generations using the user's revised prompts. The pin and pause plate were reviewed after downsampling to 24 px. All three replacements are native 1254 × 1254 PNGs with decoded transparency, copied unchanged from generator output. The pause plate still has a slightly tighter than 10% margin at the sprout and bottom rim; it remains flagged in the manifest. Previous originals are retained under `previous/2026-10-30/`; final revision prompts and source paths are in `revision-2026-10-30.json` and `generation-records.json`.

Run from the repository root:

```sh
node packages/brand/verify-polish.mjs
node packages/brand/build-polish-gallery.mjs
node packages/brand/build-polish-runtime.mjs
```

The verifier checks all 46 entries, decoded transparency, visible subjects, retained hashes and generator-source equality when local source files remain available. It reports size and margin deviations separately from file-integrity failures. Use `--refresh` only when intentionally accepting newly selected generation outputs and updating their manifest.

Validation: 46 files (45 used); 45 transparent; 1 opaque; 11 size deviations; 24 margin warnings (23 among used assets; the 24th is the superseded shelf); zero integrity errors. Application typecheck, tests, build, browser/native flows and PostgreSQL concurrency were not run because this delivery adds artwork and standalone artwork-review utilities without changing consuming application code. No commit, push or deployment was performed.

Order-spike revision (October 30, since withdrawn; see the top of this file): asset 45, dapur/dapur-rak-kosong.png, briefly showed option A: a bare restaurant order spike, one blank ticket and an orange pencil on a cream counter strip. The existing filename is retained for the implementation handoff. The original shelf artwork, preserved under previous/2026-10-30/dapur/, is again the file at dapur/dapur-rak-kosong.png. Full prompt and generator source are in revision-order-spike-2026-10-30.json. Native 1254 x 1254, real alpha, unchanged generator bytes; margin and integrity checks pass. Earlier ZIP packages predate this revision; use the current folder and gallery.
