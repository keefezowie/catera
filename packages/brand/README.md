# Catera brand assets

Sixteen independently regenerated PNG compositions based on the approved Catera identity. The board was used only as visual guidance. Every delivered file preserves the generator's native pixels, without board extraction, cropping, upscaling, tracing, or a raster disguised as SVG.

The exact generation prompts are in `prompts/` and embedded in each PNG as `impeccable:prompt`. `generation-records.json` records the original generated-file paths. `manifest.brand.json` records dimensions, alpha status, intended uses, hashes, and source provenance.

## Current delivery status

All compositions have been visually checked. They are clean opaque cream or forest matte masters. Genuine transparent output and the requested larger master dimensions remain unavailable from the built-in generator used in this run. Requests for transparency and a targeted correction produced baked checkerboards, which were rejected and are not included in this package.

- Square masters: **1254 x 1254 px**.
- Wordmark and horizontal lockup: **2172 x 724 px**.
- All delivered PNGs: **RGB, no alpha channel**.
- No upscaling was used to imitate the requested 2048px mascot or 4096px wordmark.
- `adaptive-foreground.png` needs an approved background-removal workflow before use as a true transparent Android foreground layer.

The master background colors are generated interpretations of the approved cream/forest targets and contain slight tonal variation. They are not exact-color print separations.

## Files and uses

| File | Use |
| --- | --- |
| `assets/mascot.png` | Standalone cheerful bento character |
| `assets/wordmark.png` | Rounded wordmark with leaf in the first a and tagline |
| `assets/lockup-horizontal.png` | Mascot to the left of wordmark and tagline |
| `assets/lockup-stacked.png` | Mascot above wordmark and tagline |
| `assets/logo-forest.png` | Forest monochrome interpretation on cream |
| `assets/logo-light.png` | Cream monochrome interpretation on forest |
| `assets/app-icon.png` | Full square forest icon, with no baked corner mask |
| `assets/adaptive-foreground.png` | Mascot composition with extra mask-safe margin; alpha pending |
| `assets/leaf.png` | Freshness supporting symbol |
| `assets/heart.png` | Care supporting symbol |
| `assets/utensils.png` | Meal supporting symbol |
| `assets/repeat.png` | Recurring-meal supporting symbol |
| `assets/sparkle.png` | Sunrise sparkle pair |
| `assets/welcome.png` | Welcome and onboarding illustration |
| `assets/empty-calendar.png` | Empty meal-schedule illustration |
| `assets/confirmation.png` | Successful-action illustration |

## Usage

Preserve intrinsic aspect ratios and display the complete asset. Use the name **Catera** and tagline **Good Food on Repeat.** Keep UI copy as accessible live text. Supporting symbols are decorative brand illustrations, not a replacement for consistently sized operational UI icons.

Use the approved interface tokens: Forest `#163D2E`, Sunrise `#F47B2A`, Cream `#FFF7E9`, Charcoal `#2E2E2E`. The app icon is intentionally a full square; the operating system supplies its corner shape.

Keep these native masters intact. Any later transparency or size exports should be separate derivatives, with their provenance and actual dimensions recorded. A transparent background must be a real alpha channel, not a checkerboard or an opaque matte described as transparent.

## Verify

Run from the repository root:

```sh
node packages/brand/verify-assets.mjs
```

This verifies all file hashes, dimensions, alpha declarations, PNG image-data hashes, and embedded prompts against the manifest. The initial verification also compared each shipped image's compressed pixel data with the generator's saved original; all sixteen matched exactly.

`--refresh-manifest` is a maintenance command that requires the original local generation paths from `generation-records.json`. Normal verification only needs this package and is portable.
