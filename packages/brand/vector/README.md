# Catera vector masters

SVG rebuild of the approved Catera identity (mascot, wordmark, lockups, app icon). Same artwork as the PNGs in `../assets`, redrawn as flat-colour vector paths. No live text, rasters, gradients, filters or masks. Negative space (letter counters, face, food) is real transparency.

## Provenance

These are **traced** from the transparent PNG derivatives (`mascot.png`, `wordmark.png`, `logo-forest.png`) and the opaque `app-icon.png`. They are not newly drawn masters. `trace.py` upscales each source 2x, snaps every pixel to the fixed palette below, removes antialias and generation noise with a 7 px majority filter, traces with vtracer (spline mode), and snaps fills back to the exact palette hex. Lockups are composed from the traced mascot and wordmark, so every file shares one geometry. SVG units are source px x 2; `width`/`height` give the source pixel size.

Rebuild: `py -3 packages/brand/vector/trace.py` (needs numpy, opencv-python-headless, pillow, vtracer).

## Files

| File | Use |
| --- | --- |
| `catera-mascot.svg` | Full-colour bento mascot |
| `catera-mascot-forest.svg` / `-cream.svg` | One-colour line-art mascot for light / dark surfaces |
| `catera-wordmark.svg` / `-cream.svg` | "Catera" only |
| `catera-wordmark-tagline.svg` / `-cream.svg` | "Catera" + GOOD FOOD ON REPEAT |
| `catera-lockup-horizontal[-tagline].svg` | Colour mascot left of the wordmark |
| `catera-lockup-stacked[-tagline].svg` | Colour mascot above the wordmark |
| `catera-lockup-{horizontal,stacked}[-tagline]-forest.svg` | One-colour Forest lockups for light surfaces |
| `catera-lockup-{horizontal,stacked}[-tagline]-cream.svg` | One-colour Cream lockups for dark surfaces |
| `catera-logo-stacked-forest.svg` / `-cream.svg` | Exact rebuild of `logo-forest.png` / `logo-light.png` (stacked, with tagline) |
| `catera-app-icon.svg` | Full-bleed square icon on Forest; the OS supplies the corner mask |

## Palette

Forest `#163D2E`, Sunrise `#F47B2A` and Cream `#FFF7E9` are the DESIGN.md tokens. The other mascot fills are sampled from the artwork:

| Role | Hex | Role | Hex |
| --- | --- | --- | --- |
| Outline ink | `#08291E` | Salmon stripe | `#FCA777` |
| Lid | `#1D543C` | Cheek, tongue | `#F4917C` |
| Lid highlight | `#5B8D74` | Salmon shadow | `#B95106` |
| Body | `#FFF7E9` | Broccoli | `#417711` |
| Rice, glints | `#FFFDF7` | Lettuce | `#2F5E2C` |
| Body shade | `#FBE2B2` | Flower centre | `#F8C342` |
| Warm highlight | `#F9D196` | Salmon, flower, sparkle | `#F47B2A` |

## Known limits

- The full-colour mascot is a detailed illustration (14 colours, around 2,800 anchors). It holds up from about 64 px. Below that, use the one-colour mascot or a dedicated small-size drawing, which doesn't exist yet.
- The tagline is traced, not typeset. Use live Plus Jakarta Sans for the tagline in UI copy.
- The colour mascot has dark outlines, so it disappears on Forest. On dark surfaces, use the Cream one-colour files or the app icon, which carries its own cream outline.
