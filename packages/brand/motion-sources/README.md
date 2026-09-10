# Mascot blink sources

These 1254 × 1254 files are built-in Imagegen edits of the individually generated `assets/mascot.png`, created September 10, 2026 and retained unchanged. Their generated checkerboard backgrounds are **opaque**, not transparent. They are not runtime assets or higher-resolution masters.

Packaging retains the original mascot body and two disconnected sparkle islands. Only the generated eye region (x=458, y=796, width=174, height=146) is used, with a 14px smooth feather inside the face. All generated background pixels are excluded. The original open eye remains in the body layer; half/closed patches cover it only during a blink. No reference-board extraction, original-asset edits or upscaling occurred.

## Generation requests

`closed.png`: Precise image edit for Catera animated mascot. Preserve the provided full mascot EXACTLY: identical canvas, framing, scale, silhouette, food, open lid, colors, smile, cheeks, existing right-side wink and sparkles. Change ONLY the currently open eye on the left side of the image into a gently CLOSED eye, a small curved forest line with its eyelash, at the identical location. Do not change any other pixels or pose. Transparent background with real alpha. Single full mascot, no text. This will be used as a blink patch registered over original artwork, so exact registration and unchanged cream facial shading around the eye are critical.

`half.png`: Precise animation eye-pose edit. Keep the supplied Catera bento mascot at exactly the same canvas dimensions, framing, position, size and pose. Change ONLY the OPEN eye on image-left to a HALF-CLOSED blinking eye: upper eyelid lowered halfway, same forest-colored lower oval and eyelash, eye height about half its original height. This is an intermediate blink frame, neither fully open nor fully shut. Keep cream shading around the eye, right wink, smile, cheeks, food, lid, outline and sparkles unchanged. No text. Do not draw a checkerboard. Background transparency if possible, otherwise plain cream. Only the small eye patch will be used, all other pixels will come from original.

Rebuild using `node packages/brand/build-mascot-motion.mjs`, then run `node packages/brand/verify-assets.mjs` and `npm run assets`. The motion manifest records actual source dimensions/alpha status, hashes, registration and runtime size. Image generation is not deterministic; packaging from retained sources is reproducible.
