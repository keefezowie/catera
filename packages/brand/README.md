# Catera brand assets

Sixteen independently regenerated PNG compositions based on the approved Catera identity. The board was used only as visual guidance. The unchanged generated originals are retained in `masters/`. The reusable UI files in `assets/` are transparent derivatives at the original dimensions, without board extraction, cropping, upscaling, tracing, or a raster disguised as SVG.

The exact generation prompts are in `prompts/` and embedded in each PNG as `impeccable:prompt`. `generation-records.json` records the original generated-file paths. `manifest.brand.json` records dimensions, alpha status, intended uses, hashes, and source provenance.

## Current delivery status

Fifteen reusable assets now contain real alpha transparency. The full-square app icon remains intentionally opaque, as do the six demo food photographs. Cutouts were inspected on pink, forest and white backgrounds; cream paper and mascot fills remain intact. The monochrome logos and symbols have transparent negative space, including letter counters.

- Square files: **1254 x 1254 px**; wordmark/horizontal lockup: **2172 x 724 px**.
- No upscaling; requested 2048/4096 master sizes remain outstanding.
- Original opaque masters and embedded generation prompts are preserved.
- transparent-assets.mjs reproducibly segments the original background and removes matte contamination from antialiased edges. These are processed derivatives, not newly generated images.
- Review contact sheets: output/asset-alpha/after-{pink,forest,white}.png.

## Files and uses

| File | Use |
| --- | --- |
| `assets/mascot.png` | Standalone cheerful bento character |
| `assets/wordmark.png` | Rounded wordmark with leaf in the first a and tagline |
| `assets/lockup-horizontal.png` | Mascot to the left of wordmark and tagline |
| `assets/lockup-stacked.png` | Mascot above wordmark and tagline |
| `assets/logo-forest.png` | Forest monochrome cutout for light surfaces |
| `assets/logo-light.png` | Cream monochrome cutout for dark surfaces |
| `assets/app-icon.png` | Full square forest icon, with no baked corner mask |
| `assets/adaptive-foreground.png` | Transparent mascot composition with original safe-area margin |
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

Keep the originals in `masters/` intact. UI derivatives remain in `assets/`, with their provenance and actual dimensions recorded. A transparent background must be a real alpha channel, not a checkerboard or an opaque matte described as transparent.

## Verify

Run from the repository root:

```sh
node packages/brand/verify-assets.mjs
```

This verifies file hashes, dimensions, decoded transparent/opaque/partial-alpha pixel counts, fully transparent borders, retained-original hashes, and embedded prompts against the manifest. It rejects opaque cutouts even if the PNG has an alpha channel.

To reproduce: run `node packages/brand/transparent-assets.mjs`, then `node packages/brand/verify-assets.mjs --refresh-manifest`, and `npm run assets`. Both derivation and verification use the retained repository masters and are portable.
