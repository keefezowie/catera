# Phase F artwork briefs (2026-10-10)

Paste-ready prompts for the artwork Phase F can use. Every asset has a stand-in in the app, so none blocks the build; each one replaces its stand-in when it arrives. Spec: [docs/superpowers/specs/2026-10-10-native-phase-f-design.md](../superpowers/specs/2026-10-10-native-phase-f-design.md), section 7.

## How to use this file

1. For each still, attach two reference images to the generator: `packages/brand/assets/mascot.png` (the approved mascot) and `packages/brand/assets/confirmation.png` (the approved illustration style). Then paste the prompt.
2. **Transparency.** Ask the tool for a transparent background (for example gpt-image `background: "transparent"`, or the "transparent background" option in your tool). If your tool cannot make one, generate on a solid uniform cream `#FFF7E9` instead and say so when you send it: it will then be recorded as a segmented derivative, never as a transparent master (DESIGN.md, Brand artwork and image truth).
3. Never upscale, crop or retouch the result before sending; send the original file. Keep the generation prompt (the PNG metadata or a note).
4. Name each file as listed and put it in `packages/brand/assets/phase-f/` (or send it in chat).
5. Check each result against "Accept when" before sending. Reject and regenerate rather than fix by hand.

## Shared style (already inside every prompt below)

Warm, restrained, hand-drawn flat illustration with controlled rounded dark-forest outlines and subtle tonal depth; the approved Catera mascot: a cream softly rounded open bento lunchbox in three-quarter view, forest green outline, a hinged forest-green lid with a small cream two-leaf sprout emblem, white rice, striped orange salmon, broccoli greens and an orange flower-shaped carrot inside, peach cheeks. Palette: Forest `#163D2E`, Cream `#FFF7E9`, Sunrise `#F47B2A`, Sunrise ink `#9B4309`, Charcoal `#2E2E2E`, plus the mascot's food colours. No text, letters, numbers, labels, logos, UI, shadows outside the subject, textures, gradients behind the subject or checkerboards.

---

## 1. Splash and app icon

### 1. `splash-mark-light.png` (P1)
- **Spec:** 1024×1024, transparent. All artwork inside a centred circle of 680px diameter (Android 12+ crops the splash icon to a circle). Shown at about 176pt on the light canvas `#FDFAF3`.
- **Prompt:**
  > Create one new standalone app splash mark. Transparent background. The approved Catera mascot alone, front three-quarter view, lid open, one sparkling open eye and one wink, peach cheeks, happy open smile, the cream two-leaf sprout on the forest lid, rice, striped salmon, broccoli and orange flower carrot inside. Compact, bold silhouette that reads at small size: slightly thicker forest outlines than usual, simplified food shapes, no sparkles. Center the whole mascot inside a centered circle that spans two thirds of the canvas, leaving the corners completely empty. Warm restrained hand-drawn flat illustration with controlled rounded dark-forest outlines and subtle tonal depth. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, no wordmark, no shadow, no background shape, no glow. 1024x1024.
- **Accept when:** nothing touches the outside of the central circle; it reads clearly at 64px; no wordmark; real transparency.

### 2. `splash-mark-dark.png` (P1)
- **Spec:** as #1, for the dark canvas `#151514`.
- **Prompt:**
  > Same mascot, pose, framing and size as the light splash mark (attach it as Image 1), recolored for a near-black background #151514: keep the cream body and food colors, change the outer outline from dark forest to cream #FFF7E9 or a light sage #CFE0D2 so the silhouette stays crisp on near-black, keep the lid forest green #163D2E with a cream outline. Transparent background. Artwork stays inside the centered two-thirds circle. No text, no shadow, no glow, no background shape. 1024x1024.
- **Accept when:** the outline is clearly visible on `#151514`; same pose and position as #1 so the two can swap without a jump.

### 3. `adaptive-foreground.png` (P1)
- **Spec:** 1024×1024, transparent; artwork inside the centred 66% (676px); sits on forest `#163D2E`.
- **Prompt:**
  > Android adaptive app icon foreground. Transparent background. The Catera mascot, front three-quarter view, lid open, wink, smile, simplified for icon size, thick clean outlines. Because the icon background will be solid forest green #163D2E, give the mascot a cream #FFF7E9 outer outline so it separates from green, and keep the lid a lighter forest #25553F. Center it inside the middle 66 percent of the canvas; leave the outer ring completely empty because launchers crop it to circles, squircles and rounded squares. No text, no shadow, no background. 1024x1024.
- **Accept when:** survives a circle crop of 66% diameter; separates clearly from forest.

### 4. `icon-monochrome.png` (P2)
- **Spec:** 1024×1024, one solid colour (black is fine) on transparent; inside the centred 66%.
- **Prompt:**
  > Single-color glyph for Android themed icons. Solid black silhouette on a transparent background. A simplified open bento lunchbox in three-quarter view with its hinged lid open and a small two-leaf sprout cut out of the lid, a tiny wink and smile cut out of the box face. Flat, no gradients, no outlines of a second color, bold shapes that survive at 24px. Centered in the middle 66 percent. 1024x1024.
- **Accept when:** one colour only; recognisable at 24px.

### 5. `icon-ios-dark.png` and `icon-ios-tinted.png` (P2)
- **Spec:** 1024×1024 each. Dark: the mascot on a transparent background (iOS draws the dark backdrop). Tinted: greyscale artwork on transparent.
- **Prompt (dark):**
  > iOS dark app icon artwork. Transparent background. The Catera mascot as on the app icon, lid open, wink, smile, with a cream outer outline so it reads on a dark system backdrop. Centered with 12 percent margin. No text, no background shape, no shadow. 1024x1024.
- **Prompt (tinted):**
  > iOS tinted app icon artwork. The same mascot in pure grayscale (white to mid gray values only, no color) on a transparent background, high contrast between lid, box and food. Centered with 12 percent margin. No text, no background. 1024x1024.

---

## 2. Mascot stills (transparent, 1254×1254)

All six: the approved mascot, same proportions and line weight as `mascot.png`, centred with 10% empty margin, transparent background, no text.

### 6. `mascot-merayakan.png`, celebrating (P1)
- **Used for:** payment received, renewal paid, a package published, customers imported.
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is celebrating: lid flipped wide open, small rounded cream arms raised high, holding up a round forest-green badge with one thick cream checkmark, both eyes joyfully squeezed into happy arcs, big open smile, peach cheeks, a tiny hop so the box floats slightly above an implied ground with no shadow. Three Sunrise #F47B2A four-point sparkles and two small Sunrise ink #9B4309 dots burst around the upper sides. Keep the food inside (rice, striped salmon, broccoli, flower carrot) and the cream sprout emblem on the forest lid. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines, subtle tonal depth. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, numbers, labels, UI, shadows, background shapes or textures. Centered with 10 percent margin. 1254x1254.
- **Accept when:** the badge never covers the face or food; sparkles stay inside the margin.

### 7. `mascot-membaca.png`, reading (P1)
- **Used for:** the Dapur import assistant reading photos and files ("Membaca daftar pelanggan…").
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is reading carefully: lid open, small cream arms holding a short paper list with four blank wavy lines (no letters or numbers), a small round magnifying glass with a forest rim held over the paper, eyes focused and looking down at the list, small concentrating smile, peach cheeks. Food inside unchanged, cream sprout on the forest lid. Calm, attentive, friendly. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, letters, numbers, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.
- **Accept when:** the paper has no readable text; the magnifier is clearly a magnifier at 120px.

### 8. `mascot-tidur.png`, resting (P1)
- **Used for:** nothing scheduled today, Dapur with no orders, quiet empty states.
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is resting peacefully: the forest lid is closed and the box sits slightly tilted, both eyes closed as soft downward curves, a tiny content smile, peach cheeks, two small cream-outlined "z" shapes drawn as simple zigzag marks (not letters in a font) floating up to the right in Sunrise ink #9B4309. The cream sprout emblem stays visible on the closed lid. Calm and cozy, not sad. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.
- **Accept when:** reads as content and calm, not sad or sick.

### 9. `mascot-bingung.png`, puzzled (P1)
- **Used for:** offline, "Belum bisa terhubung", a read that failed.
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is gently puzzled: lid open only a little, one eyebrow raised, eyes looking up and to the side, a small wavy uncertain mouth, peach cheeks, one small cream arm scratching the side of the lid, a single rounded question-mark shape in Sunrise ink #9B4309 above (drawn as a simple curved stroke with a dot, not a font character). Friendly and reassuring, never alarmed, no red, no warning symbols. Food inside unchanged. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.
- **Accept when:** feels "let's try again", not "something broke".

### 10. `mascot-melambai.png`, waving (P2)
- **Used for:** sign-in, the claim link, the empty home ("Mau makan apa minggu ini?").
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot waves hello: lid open, one small cream arm raised in a friendly wave with two short motion arcs beside the hand, one sparkling open eye and one wink, big warm smile, peach cheeks. Food inside unchanged, cream sprout on the forest lid. Two small Sunrise four-point sparkles at upper right. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.

### 11. `mascot-mencari.png`, searching (P2)
- **Used for:** Jelajah with no results, an empty Disimpan.
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is searching: lid lifted halfway like a visor, peeking out from under it, one small cream arm holding a round magnifying glass with a forest rim up to one eye (the eye looks bigger through the lens), curious small smile, peach cheeks. Food inside partly visible. Playful and curious. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.

### 12. `mascot-memasak.png`, cooking, Dapur (P2)
- **Used for:** Dapur after "Mulai masak", "Semua beres hari ini".
- **Prompt:**
  > Create one new illustration of the approved Catera mascot (Image 1) in the approved style (Image 2). Transparent background. The mascot is cooking proudly: a small cream chef hat with a forest outline perched on the open lid, one small cream arm holding a wooden ladle, one sparkling open eye and one wink, confident smile, peach cheeks, a few soft cream steam curls rising from the food. Food inside unchanged, cream sprout on the forest lid. Warm restrained hand-drawn flat illustration, controlled rounded dark-forest outlines. Palette Forest #163D2E, Cream #FFF7E9, Sunrise #F47B2A, Sunrise ink #9B4309. No text, labels, UI, shadows or background. Centered with 10 percent margin. 1254x1254.

---

## 3. Animations

Lottie JSON preferred (After Effects with Bodymovin, LottieFiles, or a motion designer). Rules for every file: 60fps; no expressions; no embedded raster images; palette colours only; under about 150 KB; transparent; plays once unless marked loop; a PNG of the last frame sent with it (shown under reduced motion). Fallback: animated WebP with real transparency at 2× size, under about 500 KB. GIF only as a preview.

Easing to match the app: ease out `cubic-bezier(.16, 1, .3, 1)`; springs critically damped unless the move is a hop or pop (then a light overshoot).

### 13. `success.json` (P1)
- **Length:** 1.0 to 1.4s, then holds the last frame.
- **Brief:**
  - 0 to 120ms: the mascot crouches slightly (squash to 96% height).
  - 120 to 420ms: hops up about 6% of its height; the lid flips open wider.
  - 300 to 620ms: a forest badge with a cream check pops in at its right (scale 0.6 to 1.07 to 1); the check stroke draws on over 200ms.
  - 420 to 700ms: lands with a soft squash (98%), back to 100%.
  - 450 to 1050ms: three Sunrise sparkles and two Sunrise ink dots burst outward and fade.
  - Last frame: the pose of `mascot-merayakan.png`.
- **Used for:** payment received, renewal, first published package, import saved.

### 14. `launch-handoff.json` (P1)
- **Length:** 0.6 to 0.9s.
- **Brief:** frame 1 is identical to `splash-mark-light.png` at the same size and position. The lid lifts open by about 15° and settles, the mascot winks once, two small sparkles appear at the upper right and fade, then the whole mark scales 1 to 1.04 while fading to 0 over the last 250ms. Needs a dark twin, `launch-handoff-dark.json`, matching `splash-mark-dark.png`.
- **Accept when:** the first frame matches the splash pixel for pixel, so there is no jump.

### 15. `loading-loop.json` (P2, loop)
- **Length:** 2.4s loop, seamless.
- **Brief:** the approved web loop: a 4px rise and 1.5° tilt over the cycle, pivot at the bottom centre (50%, 80%); one blink between 46% and 54% of the loop (open, half, closed, half, open); the two sparkles gently scale between 90% and 100%. Same pose as `packages/brand/assets/mascot-motion/neutral.png`.

### 16. `reading-loop.json` (P2, loop)
- **Length:** 2 to 3s loop, seamless.
- **Brief:** `mascot-membaca.png` animated: the magnifier glides left to right across the list and back; the eyes follow it; one paper line highlights briefly in Sunrise at the midpoint; one blink.

### 17. `confetti.json` (P2)
- **Length:** 1.2s.
- **Brief:** about 24 small pieces (rounded rectangles, dots and four-point sparkles) in Forest, Sunrise, Sunrise ink and Cream with a forest outline, burst from the top centre, fall and rotate with light gravity, fully gone by the end. Transparent. No other colours. (Optional: this can be drawn in code instead.)

### Alternative if Lottie is hard: a rig kit
If you can generate stills but not animate, send each animated pose as separate transparent layers on the same 1254×1254 canvas, aligned so they stack exactly, and I will animate them in code the way the current loader is built:
- `rig-body.png`: the box with food, no lid, no eyes;
- `rig-lid.png`: the lid alone, in its open position, with its hinge point noted (for example "hinge at x 410, y 560");
- `rig-eyes-open.png`, `rig-eyes-closed.png`;
- `rig-arms-up.png` (for success) and `rig-badge.png` (the check badge alone);
- `rig-sparkles.png`.

## Priority summary

| Priority | Assets |
| --- | --- |
| P1, covers every Phase F moment | 1, 2, 3, 6, 7, 8, 9, 13, 14 |
| P2, nice to have | 4, 5, 10, 11, 12, 15, 16, 17 |

Stand-ins until delivery: the logo derivatives for the splash, `confirmation.png` for success, the layered mascot loop for loading and reading, and the existing empty and error states.
