# Phase F visual review — 2026-10-11

The second complete review found and corrected additional preview defects before delivery. No visible blocking defects remain in the local artwork and sampled fallback animation previews. This is artwork acceptance, not native app or launcher acceptance.

All 13 finished stills were inspected individually on light `#FDFAF3`, dark `#151514` and forest `#163D2E`, with 460px image boxes. All 10 isolated rig PNGs were inspected on the same surfaces and then assembled. Original generator outputs remain provenance records; they are not the approved clean exports.

| Artwork | Visual finding |
| --- | --- |
| Splash light | Open-lid silhouette, face and sprout are clear at 64px; no sparkles or background residue. |
| Splash dark | Same composition and position; cream exterior separates the mark from near-black. |
| Adaptive foreground | Cream exterior separates from forest; full central safe-circle validation passes. |
| Monochrome | Bento silhouette remains recognizable at 24px; fine food/face detail naturally merges at this size. Preview now uses the alpha as a system-tinted mask, while the export remains black. |
| iOS dark | Cream exterior, food and face remain clear on dark; decorations stay inside the margin. |
| iOS tinted | Neutral grayscale, no color cast; lid, body and food remain distinct. |
| Celebrating / merayakan | Happy expression; badge clear of face and food; decorations contained. |
| Reading / membaca | Paper contains only wavy strokes; magnifier recognizable at 120px. |
| Resting / tidur | Closed lid and eyes read as calm; floating zigzags remain contained. |
| Puzzled / bingung | Question mark, raised brow and uncertain mouth convey gentle confusion. |
| Waving / melambai | Hand, motion arcs, wink and smile are clear without collisions. |
| Searching / mencari | Magnifier enlarges the eye; handle, face and food remain distinct. |
| Cooking / memasak | Hat, ladle and steam remain inside the frame; face and food clear. |
| Seven success layers | Full-width lid follows the box perspective, overlaps the back rim and stays behind the hands; eyes clear of food and mouth; badge check clear; sparkles outside the subject. |
| Three reading layers | Eyes sit on the face; translucent lens and handle align with the paper/hand. |
| Existing five loader layers | Reviewed at the intended 160px display size. Source canvas is 480px, corrected in the handoff documentation. |
| Confetti and last-frame PNG | Vector burst, falling/rotating pieces and fade reviewed. Last two animation frames and the last-frame PNG are fully transparent. |

## Motion inspection

Success, reading and loading were each inspected at 0%, 25%, 45%, 47%, 49%, 50%, 53%, 55% and 75% of their preview cycles on all three surfaces. The success blink also has the earlier 99% review. Confetti frames 0, 3, 12, 24, 36, 48, 60, 70 and 71 were inspected.

After the first review pass, the user identified that the smaller lid still looked perched above the box. Revision 3 replaces that registration with a full-width lid following the box perspective. The lid draws above the back food/rim, while both hands and the badge draw above the lid, creating intentional foreground overlap. All nine success preview states were recaptured on all three backgrounds after this correction. Its open/closed expressions switch discretely. Automated overlap checks report zero eye/mouth, eye/food, eye/arm, checkmark occlusion or sparkle/subject collisions; hand/badge and lid/hinge contacts pass.

This pass corrected the reading blink to scale each eye about its own pupil center. Scaling the whole eye canvas had made the eyes jump upward. The magnifier now rotates by ±4° about its grip: translating the isolated prop across a fixed hand visibly detached the handle. The code preview uses this anchored movement, with eye following and the brief paper-line highlight. The eye PNG is reused with two clips through transparent space; generated files remain unchanged.

The loading preview switches between open, half and closed eye patches without crossfading. Its bob is 4px at a 160px displayed canvas, with 1.5° tilt and 90–100% sparkle scale.

## Preview behavior

- Three background controls and four still sizes (24, 64, 120 and 240px) work.
- All images load; the browser reports no page errors.
- The three loop controls start/stop playback. Confetti plays once and finishes transparent.
- Reduced motion stops movement, prevents loop restart, shows the finished success/reading stills and the existing loader poster, and leaves confetti transparent.
- Layouts at 320, 390, 768 and 1440px have no horizontal overflow. The narrow toolbar wraps; motion canvases fit.
- Keyboard focus is visible on the preview controls.
- Both artifact verifiers pass: 23 new PNGs, confetti, 16 existing brand assets and five existing loader layers. Original and export hashes remain verified.

## Evidence and limits

Local evidence, not in git: `output/phase-f-artwork/qa/qa-still-01.png` through `qa-still-13.png` contain the individual three-background reviews. [Stills overview](../../../../output/phase-f-artwork/qa/qa-stills-overview.png), [layer overview](../../../../output/phase-f-artwork/qa/qa-layers-overview.png), and [actual sizes](../../../../output/phase-f-artwork/qa/qa-actual-sizes.png) provide comparisons. The `qa-rig-*`, `qa-reading-rig-*`, and `qa-loader-*` sheets contain the sampled animation states; [confetti frames](../../../../output/phase-f-artwork/qa/qa-confetti-frames.png) show its progression. Desktop, narrow-screen and reduced-motion captures are included alongside them.

The stills have different amounts of internal whitespace, especially the earlier P1 poses. Preserve their files; component-level optical sizing should be checked during app integration. At 24px, judge the monochrome bento silhouette rather than expecting its tiny decorative details to remain individually legible.

The success loop is a layer-registration aid rather than the finished one-shot success timeline. Mascot animations use the permitted rig/recipe alternative; finished mascot Lottie/WebP files are not included. The launch recipe's matching splash PNGs were reviewed, but its native placement, optional lid/wink motion and pixel-identical device handoff have not been implemented or tested. Success and reading rigs are separately generated from their finished posters, so integrating a transition to those posters requires its own visual review.

Repository build/typecheck and native test limitations remain recorded in `validation.json`. No app integration, commit, push or deployment was performed for this artwork review.
