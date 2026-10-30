# Polish artwork prompts (2026-10-30)

These are the pictures the Uber Eats polish phase needs: one specific object picture per moment, in place of the five mascot poses the app reuses today. The source is [the Uber Eats research](../superpowers/research/2026-10-30-uber-eats-patterns.md), section 4 (gap map) and section 5 (top 10). Paste the matching shared style block (A for illustrations, B for food photos) in front of every prompt, attach the reference images it names, then paste the entry's prompt. Entries are numbered in the research's priority order.

## How to use this file

1. Attach references. Illustrations: `packages/brand/assets/mascot.png`, `packages/brand/assets/confirmation.png` and `packages/brand/assets/empty-calendar.png`. Food photos: `packages/brand/assets/food/ayam-sambal.png` and `packages/brand/assets/food/nasi-nusantara.png`.
2. Generate each asset on its own. Never make a sheet of several icons and cut it up, and never crop or extract from the brand reference board.
3. Ask for a transparent background where the entry says so. If your tool cannot do transparency, use the fallback colour in the style block and say so when you send the file. It is then recorded as a segmented derivative, never as a transparent master (DESIGN.md, Brand artwork and image truth).
4. Send the generator's file untouched: no upscaling, cropping or retouching. Keep the prompt (PNG metadata or a note). Clean runtime copies are made later by script, the way `packages/brand/assets/phase-f/` was built, and the original is kept beside them.
5. Save under `packages/brand/assets/polish/` in the group folder each entry names. Check the "Check before saving" line; regenerate rather than fix by hand.

## Shared style A: illustrations (paste before every illustration prompt)

> Style: match the attached Catera references exactly (Image 1 mascot, Image 2 confirmation, Image 3 calendar). Warm hand-drawn flat illustration in a glossy sticker style: thick, rounded, even dark forest outlines (about 2 percent of the canvas width, the same weight as the mascot's outline), flat fills with one soft shading tone on the side away from the light, light from the upper left, and one or two soft white highlight streaks on forest surfaces like the mascot's lid. Palette only: Forest #163D2E, Cream #FFF7E9, Sunrise orange #F47B2A, Sunrise ink #9B4309, Charcoal #2E2E2E, plus natural food colours (white rice, green vegetables, browned lauk). Chili and sambal red #A33024 only on chili or sambal. A Catera rantang always looks like this: three round stacked enamel tiers with cream bodies and forest rims, held by a forest metal frame with two side bars, a small top latch and an arched carry handle, and a domed forest lid carrying the small cream two-leaf sprout emblem. Objects have no faces, eyes or arms; the mascot does not appear unless the prompt asks for it. One subject, centred, at least 10 percent empty margin on every side. Transparent background (fallback: one flat uniform #FFFFFF with nothing else on it). No text, letters, numbers, labels, logos, UI, ground shadows, background shapes, gradients, textures or checkerboards. 1254x1254.

## Shared style B: food photos (paste before every food photo prompt)

> Style: match the attached Catera food photos (Image 1, Image 2). Realistic food photography of home-style Indonesian food, natural soft daylight from the upper left, gentle real shadows, appetising and slightly imperfect, never glossy stock or plastic-looking. Plates are plain off-white ceramic with a thin raised rim. Garnishes are real Indonesian ones: bawang goreng, sliced cucumber, a lime wedge, kemangi, a small dab of sambal. No hands, no cutlery in motion, no text, labels, logos, watermarks or props with writing on them.

---

## Group 1: spot icon set (top 10 #1, P1)

Sixteen objects that replace the glyph tiles, line icons and mascot fallbacks. They must read as one family: same angle (three-quarter view from slightly above), same light, same outline weight. Folder: `packages/brand/assets/polish/spot/`. Each is 1254x1254 transparent PNG, shown at 24 to 56 pt in tiles and, where noted, at about 160 pt as an empty-state picture. Every prompt below follows shared style A.

### 1. `spot-rantang.png`
- Appears in: Akun tile "Paket saya" (`apps/customer/src/account/AkunTiles.tsx`); "Termasuk" row "Diantar" (`apps/customer/src/discover/PackageDetail.tsx`).
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: one closed Catera rantang standing upright, three tiers stacked and latched, arched handle up, sprout emblem facing the viewer on the domed lid. Bold simple silhouette that still reads at 24 pixels. Nothing else in the picture.
- Check before saving: three tiers clearly countable at 32 px; frame and handle in forest; no face.

### 2. `spot-rantang-open.png`
- Appears in: proposed fallback tile in `apps/customer/src/today/UpcomingDays.tsx` when a chosen dish has no photo.
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: a Catera rantang taken apart, its three round tiers set side by side in a slight arc, the domed lid leaning against the last tier. Left tier white nasi with a few bawang goreng flakes, middle tier ayam goreng pieces with a dab of red sambal, right tier green sayur (kangkung). Food fills each tier to the rim.
- Check before saving: three foods distinct at 40 px; tiers are round, not square bento boxes.

### 3. `spot-menu-card-pencil.png`
- Appears in: the "Pilih menu 5 hari" card (`apps/customer/src/today/LiveSlot.tsx`), in place of the grey circle with the hamburger glyph.
- Size: 1254x1254, transparent PNG; shown at 40 to 56 pt.
- Prompt:
  > Spot icon: a small standing cream menu card with a forest border, folded like a table tent, showing three blank rounded forest lines where text would be (no letters), and a short sunrise-orange pencil with a cream tip leaning across its lower right corner.
- Check before saving: no letters or squiggles that look like writing; pencil reads as a pencil at 40 px.

### 4. `spot-plate-empty-pencil.png`
- Appears in: `UpcomingDays.tsx` row "Menu belum dipilih".
- Size: 1254x1254, transparent PNG; shown at 40 to 56 pt.
- Prompt:
  > Spot icon: one empty round cream plate with a forest rim, seen from above at a three-quarter angle, completely clean, with a short sunrise-orange pencil lying across the right edge of the plate. The plate is empty on purpose: it means "not chosen yet".
- Check before saving: the plate reads as empty, not as a white dish of rice; the icon looks different from #5 at a glance.

### 5. `spot-rantang-clock.png`
- Appears in: `UpcomingDays.tsx` row "3 menu belum diumumkan"; inside the "Tepat waktu" compliment medal (`PackageDetail.tsx`, see the #41 note).
- Size: 1254x1254, transparent PNG; shown at 40 to 56 pt and inside a 72 pt medal.
- Prompt:
  > Spot icon: a closed Catera rantang with a small round cream wall clock with a forest rim leaning against its lower right side. The clock has two forest hands pointing to about ten past ten and no numerals, only four short tick marks.
- Check before saving: no numerals on the clock; the rantang matches #1 in shape and colour.

### 6. `spot-scooter.png`
- Appears in: delivery stage "Diantar" on `packages/mobile-ui/src/RantangTrack.tsx` and `apps/customer/src/today/StatusStops.tsx`.
- Size: 1254x1254, transparent PNG; shown at 24 to 40 pt.
- Prompt:
  > Spot icon: a small rounded forest motor scooter in side three-quarter view, riding to the right, no rider, with a closed Catera rantang strapped upright on the rear rack. Two short cream speed lines behind the back wheel.
- Check before saving: no rider, no plate number; rantang clearly visible on the rack at 32 px.

### 7. `spot-wok.png`
- Appears in: delivery stage "Dimasak" (`RantangTrack.tsx`, `StatusStops.tsx`).
- Size: 1254x1254, transparent PNG; shown at 24 to 40 pt.
- Prompt:
  > Spot icon: a dark charcoal wajan (Indonesian wok) with a wooden handle on one side, holding stir-fried nasi goreng with a few green and orange bits, a wooden sutil (spatula) resting in it, and three soft cream steam curls rising.
- Check before saving: steam stays inside the margin; no flames, no stove.

### 8. `spot-nota.png`
- Appears in: Akun tile "Riwayat" (`AkunTiles.tsx`); the empty state of `apps/customer/src/help/ReportList.tsx` at about 160 pt.
- Size: 1254x1254, transparent PNG; shown at 24 to 160 pt.
- Prompt:
  > Spot icon: a short cream paper nota (receipt) folded once and standing slightly open, with a zigzag torn bottom edge, three blank forest lines, and a round forest stamp with a cream tick mark printed on its lower half.
- Check before saving: lines carry no letters or digits; holds up at 160 pt with no muddy detail.

### 9. `spot-lid-heart.png`
- Appears in: the Disimpan empty state (`apps/customer/src/discover/SavedList.tsx`) at about 160 pt.
- Size: 1254x1254, transparent PNG; shown at 40 to 160 pt.
- Prompt:
  > Spot icon: a single domed forest rantang lid lying on its rim, seen from the front three-quarter view, with a round cream sticker on top showing a plump forest heart in place of the sprout emblem.
- Check before saving: reads as a lid (not a bowl or a hat); heart is centred on the sticker.

### 10. `spot-calendar-tote.png`
- Appears in: "Termasuk" row "Jadwal fleksibel" (`PackageDetail.tsx`).
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: a cream canvas tote bag with forest handles, standing upright, printed with a simple weekly calendar grid of five squares in a row in forest, three of the squares holding a cream tick.
- Check before saving: five squares, three ticks, no digits or day names; simpler than #28, which is the large version.

### 11. `spot-pin-lid.png`
- Appears in: Akun tile "Alamat" (`AkunTiles.tsx`).
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: a classic forest map pin standing on its point, whose round head is a small domed rantang lid with the cream sprout emblem, and a small cream oval under the tip where it touches the ground.
- Check before saving: reads as a map pin first and a lid second; same lid shape as #9.

### 12. `spot-saringan.png`
- Appears in: the Jelajah filter empty state (`apps/customer/src/discover/Jelajah.tsx`, the filter variant) at about 160 pt.
- Size: 1254x1254, transparent PNG; shown at 40 to 160 pt.
- Prompt:
  > Spot icon: a round woven bamboo saringan (strainer) with a short bamboo handle, tilted toward the viewer, completely empty except for one small red chili lying in the middle of the weave.
- Check before saving: the weave is a simple cross-hatch that stays clean at 40 px; exactly one chili.

### 13. `spot-cabai.png`
- Appears in: Jelajah category "Pedas" (`apps/customer/src/discover/categories.ts`, `ChipRow.tsx`).
- Size: 1254x1254, transparent PNG; shown at 40 to 56 pt.
- Prompt:
  > Spot icon: two plump red Indonesian cabai rawit chilies crossed in an X, green stems up, each with a soft white highlight streak, and one tiny sunrise-orange four-point sparkle at the upper right.
- Check before saving: chili red #A33024 family, not orange; looks like chilies, not peppers or carrots.

### 14. `spot-plate-leaf.png`
- Appears in: "Termasuk" row "Sayur tiap hari" (`PackageDetail.tsx`); Jelajah category "Vegetarian".
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: a round cream plate with a forest rim holding a small heap of green sayur (kangkung and long beans), with one large single forest leaf standing up from the heap like a flag.
- Check before saving: the leaf matches the two-leaf sprout's leaf shape; plate matches #4.

### 15. `spot-plate-pause.png`
- Appears in: "Termasuk" row "Bisa libur" (`PackageDetail.tsx`).
- Size: 1254x1254, transparent PNG; shown at 24 to 56 pt.
- Prompt:
  > Spot icon: a round cream plate with a forest rim, with a forest fork and spoon laid parallel and upright across its centre, side by side with a small gap, so together they form a pause symbol.
- Check before saving: the pause reading survives at 24 px; plate matches #4.

### 16. `spot-rantang-gift.png`
- Appears in: the promo card "Ajak teman, dapat 1 hari gratis" at the bottom of `apps/customer/src/account/Akun.tsx`.
- Size: 1254x1254, transparent PNG; shown at 40 to 56 pt.
- Prompt:
  > Spot icon: a closed Catera rantang wrapped with a sunrise-orange ribbon crossing over the lid and down two sides, finished with a neat bow at the top beside the handle.
- Check before saving: the ribbon does not hide the sprout emblem; rantang matches #1.

---

## Group 2: per-cause empty states (top 10 #2, P1)

One picture per cause, replacing the 5x `mencari` and 2x `tidur` reuse. Filter, Disimpan and laporan reuse #12, #9 and #8 from the spot set. Folder: `packages/brand/assets/polish/empty/`. Shown at about 160 pt above a bold line, one line and a small pill. Shared style A.

### 17. `empty-area.png`
- Appears in: the Jelajah area empty state (`Jelajah.tsx`, area variant) with the pill "Lihat semua area".
- Size: 1254x1254, transparent PNG; shown at about 160 pt.
- Prompt:
  > Empty-state illustration: one empty Catera rantang tier, nothing inside, its domed lid tilted open on the back rim, and a small forest map pin peeking up out of the empty tier as if looking around. No food anywhere. Calm and a little playful.
- Check before saving: the tier is clearly empty; the pin is small next to the tier; no face on the pin.

### 18. `empty-kentongan-lid.png`
- Appears in: `apps/customer/src/account/Notifications.tsx` empty state ("Belum ada kabar baru.") with the pill "Pengaturan notifikasi".
- Size: 1254x1254, transparent PNG; shown at about 160 pt.
- Prompt:
  > Empty-state illustration: a single domed forest rantang lid hanging upside down from a short forest cord like a small bell, the sprout emblem facing the viewer, with a small wooden clapper inside and two short sunrise-orange motion ticks on each side as if it just rang once.
- Check before saving: reads as a lid used as a bell, not a standard bell icon.

---

## Group 3: first-run onboarding (top 10 #3, P1)

For the new `apps/customer/app/mulai/` stack: welcome, area primer, "Lauk favoritmu?" plate picker, then the echo loader (which shows the picked plates again, so it needs no art of its own). The siang/malam tiles use the existing code-drawn sun and moon. Folder: `packages/brand/assets/polish/onboarding/`.

### 19. `welcome-meja.png` (photo)
- Appears in: the first welcome screen of `apps/customer/app/mulai/` (new), about the top 75 percent of the phone, with the "Mulai" band below.
- Size: 1024x1536 portrait (closest generator size to the research's 1:1.6; shown with cover fit), opaque PNG. This is an opaque photo, never a transparent master.
- Prompt (after style B):
  > Top-down photo of a table set for lunch on cream linen with a faint forest-green stripe at one edge. Four dishes, each cut off by a different edge of the frame so the table seems to continue: lower left, a plate of nasi putih with ayam bakar kecap and cucumber slices; upper right, a bowl of sayur asem with corn, long beans and melinjo; middle right, the open bottom tier of a cream enamel rantang with a forest rim, full of tempe orek; upper left, a small saucer of sambal terasi with a lime wedge. The centre third of the frame is mostly empty linen. No people, no hands, no phones, no text.
- Check before saving: every dish touches or crosses an edge; the centre stays calm; no text on any object.

### 20. `plate-ayam.png` (photo cut-out)
- Appears in: the "Lauk favoritmu?" plate picker in `apps/customer/app/mulai/` (new); also on the echo loader.
- Size: 1024x1024, transparent PNG; shown at 88 to 132 pt round (picked plates grow about 1.5x).
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate with ayam bakar (two grilled chicken pieces glazed with kecap manis), a scoop of nasi putih, cucumber slices and a small dab of sambal. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no linen, no shadow outside the plate.
- Check before saving: perfect circle viewed straight down; edges clean against transparency.

### 21. `plate-ikan.png` (photo cut-out)
- Appears in: plate picker, as #20.
- Size: 1024x1024, transparent PNG.
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate with ikan bakar (one whole grilled fish with charred skin and a sweet soy glaze), nasi putih, kemangi leaves and a lime wedge. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the plate.
- Check before saving: same plate size and angle as #20.

### 22. `plate-daging.png` (photo cut-out)
- Appears in: plate picker, as #20.
- Size: 1024x1024, transparent PNG.
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate with semur daging (braised beef slices and potato in dark sweet soy gravy), nasi putih and a sprinkle of bawang goreng. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the plate.
- Check before saving: same plate size and angle as #20.

### 23. `plate-sayur.png` (photo cut-out)
- Appears in: plate picker, as #20.
- Size: 1024x1024, transparent PNG.
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate with urap sayur (blanched long beans, bean sprouts, spinach and cabbage tossed with spiced grated coconut), two pieces of tempe goreng and nasi putih. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the plate.
- Check before saving: reads as mostly green at thumbnail size.

### 24. `plate-pedas.png` (photo cut-out)
- Appears in: plate picker, as #20.
- Size: 1024x1024, transparent PNG.
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate with ayam geprek (smashed fried chicken under a thick layer of red sambal bawang), nasi putih, cucumber and a few whole cabai rawit on the side. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the plate.
- Check before saving: reads as clearly spicy (red dominant) without looking like #20.

### 25. `plate-tanpa-santan.png` (photo cut-out)
- Appears in: plate picker, the "Tanpa santan" choice, as #20.
- Size: 1024x1024, transparent PNG.
- Prompt (after style B):
  > Straight top-down photo of one round off-white plate holding a small bowl of sayur bening bayam (clear spinach and corn broth, completely clear, no coconut milk) beside nasi putih and a piece of pepes tahu in a banana leaf. The plate fills the frame edge to edge as a perfect circle. Transparent background outside the plate (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the plate.
- Check before saving: the broth is visibly clear, nothing creamy or white in it.

### 26. `primer-area.png`
- Appears in: the area primer ("Katering di dekatmu", buttons "Pilih area" and "Ketik alamat") in `apps/customer/app/mulai/` (new) and the first open of `apps/customer/src/discover/area.tsx`.
- Size: 1254x1254, transparent PNG; shown about 240 pt wide in the upper half of the screen.
- Prompt (after style A):
  > Primer illustration: a flat square map tile with softly rounded corners seen straight from above, drawn in two greens only (a light sage #F0F3E9 ground and soft mid-green #9CCBAE blocks for parks), with cream roads curving through it and a few tiny forest tree dots. In the centre stands a big forest map pin whose round head is a domed rantang lid with the cream sprout emblem. Only the tile and the pin; transparent outside the tile.
- Check before saving: only two greens plus forest and cream; no street names; pin head matches #11.

---

## Group 4: delivered hero (top 10 #4, P1)

### 27. `moment-rantang-meledak.png`
- Appears in: the screen after "Sudah sampai" and the top of `apps/customer/src/today/ReviewSheet.tsx` ("Selamat makan, {nama}"). This is the signature image.
- Folder and size: `packages/brand/assets/polish/moment/`; 1254x1254, transparent PNG; shown about 280 pt wide. The research's cream and forest split background is drawn in code behind it, so the picture works in dark mode too.
- Prompt (after style A):
  > Hero illustration, exploded view: a Catera rantang whose parts float apart vertically in a straight stack with even gaps, as if it just burst open with joy. From top to bottom: the domed forest lid with the sprout emblem tilted slightly, a tier of fluffy white nasi with bawang goreng, a tier of lauk (two pieces of ayam goreng and a slice of tempe), a tier of green sayur (kangkung with a few red chili slices), and the forest frame with its arched handle at the bottom. A tiny cream saucer of red sambal floats off to the right of the middle tier. Soft cream steam curls rise between the tiers. Every tier is shown in three-quarter view so the food inside is visible.
- Check before saving: four parts plus frame in one vertical line, food visible in every tier; steam and sambal stay inside the margin.

---

## Group 5: subscription confirmed (top 10 #5, P1)

### 28. `moment-langganan-aktif.png`
- Appears in: `apps/customer/src/buy/PaidOutcome.tsx`, in place of the confetti, above the summary card "Langganan aktif · Senin–Jumat · Siang".
- Folder and size: `packages/brand/assets/polish/moment/`; 1254x1254, transparent PNG; shown at about 200 pt.
- Prompt (after style A):
  > Confirmation illustration: a cream canvas tote bag with forest handles standing upright, printed with a weekly calendar grid of five large squares in a row in forest, three of them filled with a thick cream tick. The top of a closed Catera rantang peeks out of the tote with its handle and sprout lid visible. To the left, a small terracotta pot with a young two-leaf forest sprout, the same leaf shape as the emblem. Two small sunrise-orange four-point sparkles at the upper right.
- Check before saving: no digits or day names on the calendar; more detailed than #10 but clearly the same tote.

---

## Group 6: push primer (top 10 #6, P1)

The denied-state walkthrough in Pengaturan uses real UI pictures (the app icon, a notification badge, a toggle), drawn in code, so it needs no generated art.

### 29. `primer-notifikasi.png`
- Appears in: the push primer sheet after `PaidOutcome.tsx` ("Tahu kapan makananmu jalan", "Nyalakan notifikasi" and "Nanti saja"), wired through `packages/mobile-core/src/provider.tsx`.
- Folder and size: `packages/brand/assets/polish/onboarding/`; 1254x1254, transparent PNG; shown about 240 pt wide.
- Prompt (after style A):
  > Primer illustration, isometric: a small square slice of an Indonesian kampung street on a sage #F0F3E9 tile, transparent outside the tile. At the upper left, a small dapur with a sunrise-orange tiled roof and cream steam rising from its chimney. At the lower right, a cream house with a forest front door. A thick forest route line with rounded ends runs along the cream road from the dapur to the door. Halfway along it, a small forest scooter with a closed Catera rantang on the rack is moving toward the house. A few round forest trees and a low fence along the road. No bell, no phone, no people.
- Check before saving: the route reads start to end at 160 pt; no bell or notification symbol anywhere.

---

## Group 7: delivery stage glyphs (top 10 #8, P2)

Four stages on the track. "Dimasak" reuses #7 and "Diantar" reuses #6; two are new. Folder: `packages/brand/assets/polish/spot/` (same family as group 1). Shared style A.

### 30. `spot-rantang-dikemas.png`
- Appears in: the "Dikemas" stop on `RantangTrack.tsx` and `StatusStops.tsx`, next to "Lagi dikemas…".
- Size: 1254x1254, transparent PNG; shown at 24 to 40 pt.
- Prompt:
  > Spot icon: a Catera rantang being stacked: two tiers already in the forest frame, the third tier (full of white nasi) hovering just above them, slightly tilted, with two short cream motion ticks under it showing it is being lowered into place. Lid not on yet, resting beside the frame.
- Check before saving: reads as "packing" at 32 px; matches #1.

### 31. `spot-rantang-sampai.png`
- Appears in: the last stop ("Sebentar lagi!" then "Sudah sampai") on `RantangTrack.tsx` and `StatusStops.tsx`.
- Size: 1254x1254, transparent PNG; shown at 24 to 40 pt.
- Prompt:
  > Spot icon: a forest front door in a cream frame, seen in three-quarter view, with a small cream doormat in front of it and a closed Catera rantang sitting on the mat by the threshold.
- Check before saving: door and rantang both readable at 32 px; no house number.

---

## Group 8: Masuk food tokens (top 10 #9, P2)

Five food cut-outs scattered in the top third of Masuk and Register. Draw the cream wavy seal badges and the small forest "Rp" stickers in code, so the badge shape is identical on all five and no text comes from the generator. Folder: `packages/brand/assets/polish/token/`. Each 1024x1024 transparent PNG, shown at 72 to 104 pt, placed and rotated by `packages/mobile-ui/src/AuthLayout.tsx` for `apps/customer/src/account/Masuk.tsx` and `Register.tsx`. Shared style B, then the prompt.

### 32. `token-nasi-kotak.png`
- Prompt:
  > Product-style photo of one open cream paper nasi kotak (lunch box) seen from above at a three-quarter angle, holding nasi putih, a piece of ayam goreng, sambal goreng kentang, a slice of telur dadar and a lettuce leaf. Transparent background (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the object, no printing on the box.
- Check before saving: box has no logo or writing; edges clean.

### 33. `token-sate.png`
- Prompt:
  > Product-style photo of four sate ayam skewers fanned out on a small banana leaf, glazed with peanut sauce and a drizzle of kecap, with a few slices of shallot and lontong cubes beside them, seen from above at a three-quarter angle. Transparent background (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the leaf.
- Check before saving: the skewers stay inside the frame; the banana leaf edge is clean.

### 34. `token-gado-gado.png`
- Prompt:
  > Product-style photo of one shallow off-white bowl of gado-gado: long beans, bean sprouts, cabbage, potato, tofu, tempe and half a boiled egg under thick peanut sauce, topped with kerupuk and bawang goreng, seen from above at a three-quarter angle. Transparent background (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the bowl.
- Check before saving: kerupuk present; bowl matches the plate style of the plate-picker photos.

### 35. `token-pisang-goreng.png`
- Prompt:
  > Product-style photo of three golden crisp pisang goreng on a small square of brown paper, one broken open to show soft banana inside, seen from above at a three-quarter angle. Transparent background (fallback: one flat uniform #BFBFBF grey). No table, no shadow outside the paper.
- Check before saving: the paper has no print; reads as banana fritters, not fried chicken.

### 36. `token-es-teh.png`
- Prompt:
  > Product-style photo of one tall clear glass of es teh manis, amber tea with ice cubes and a slice of lime on the rim, a few water droplets on the glass, seen from slightly above. Transparent background (fallback: one flat uniform #BFBFBF grey). No straw logo, no table, no shadow outside the glass.
- Check before saving: the glass edges are clean on transparency, with no background showing through as grey.

---

## Group 9: gap-map items outside the top 10 (P3)

The research calls for these in section 4 but not in the top 10. Shared style A.

### 37. `category-nusantara.png`
- Appears in: the Jelajah category row, "Nusantara" (`categories.ts`, `ChipRow.tsx`). The row also uses #13 for "Pedas" and #14 for "Vegetarian".
- Folder and size: `packages/brand/assets/polish/category/`; 1254x1254, transparent PNG; shown at 48 to 56 pt.
- Prompt:
  > Spot icon: a mini tumpeng: a small yellow cone of nasi kuning on a round woven bamboo tray lined with a banana leaf, ringed by tiny pieces of ayam goreng, a half egg, green urap and a red chili flower on the tip.
- Check before saving: cone shape clear at 48 px; same angle and outline weight as group 1.

### 38. `category-sehat.png`
- Appears in: Jelajah category "Sehat".
- Folder and size: as #37.
- Prompt:
  > Spot icon: a round cream bowl with a forest rim filled with a fresh salad of lettuce, cucumber slices, cherry tomato halves, boiled egg slices and a few sprouts, with a small forest leaf tucked at the rim.
- Check before saving: looks fresh and green; different from #14 at a glance.

### 39. `category-keluarga.png`
- Appears in: Jelajah category "Keluarga".
- Folder and size: as #37.
- Prompt:
  > Spot icon: a tall Catera rantang with five tiers instead of three, the family size, with the same forest frame, handle and sprout lid, standing next to one regular three-tier rantang that reaches only halfway up.
- Check before saving: five tiers countable; the size difference is obvious.

### 40. `category-kantor.png`
- Appears in: Jelajah category "Kantor".
- Folder and size: as #37.
- Prompt:
  > Spot icon: three closed cream nasi kotak (paper lunch boxes) stacked neatly, each tied with a thin forest string, the top one slightly turned.
- Check before saving: no print on the boxes; stack reads as several portions.

### 41. `compliment-hangat.png`
- Appears in: "Kata pelanggan" medals on `apps/customer/src/discover/PackageDetail.tsx`, compliment "Masih hangat"; the medal ring and count are drawn in code around the icon. The "Tepat waktu" medal uses #5.
- Folder and size: `packages/brand/assets/polish/compliment/`; 1254x1254, transparent PNG; shown at about 48 pt inside a 72 pt medal.
- Prompt:
  > Spot icon: a round cream bowl with a forest rim full of white nasi, with three tall soft cream steam curls rising high above it, outlined in forest.
- Check before saving: steam reads clearly on a cream medal disc.

### 42. `compliment-porsi-pas.png`
- Appears in: as #41, compliment "Porsi pas".
- Folder and size: as #41.
- Prompt:
  > Spot icon: a round cream plate with a forest rim, generously and neatly full: a dome of nasi, a piece of ayam goreng, tempe and green sayur arranged in neat sections, nothing spilling over.
- Check before saving: plate matches #4; looks full, not overloaded.

### 43. `compliment-rumahan.png`
- Appears in: as #41, compliment "Rasa rumahan".
- Folder and size: as #41.
- Prompt:
  > Spot icon: a small round cream cooking pot with forest handles and a lid set ajar, with cream steam rising from it that curls into the outline of a small house with a pitched roof.
- Check before saving: the house shape in the steam is readable at 48 px.

### 44. `dapur-selesai.png`
- Appears in: the Dapur "day done" state (`apps/caterer/src/today/TodayScreen.tsx`), with "Semua sudah diantar. {n} pelanggan makan dari dapurmu hari ini."
- Folder and size: `packages/brand/assets/polish/dapur/`; 1254x1254, transparent PNG; shown at about 120 pt.
- Prompt:
  > Illustration: a tidy tower of clean, empty Catera rantang tiers stacked high and slightly staggered, a folded forest-and-cream checked cloth draped over the top tier, and a round forest badge with a thick cream tick leaning against the base.
- Check before saving: tiers are clearly empty and clean; badge matches the one in `confirmation.png`.

### 45. `dapur-rak-kosong.png`
- Appears in: the Dapur "no orders" state (`TodayScreen.tsx`); `tidur` stays only for "libur".
- Folder and size: as #44.
- Prompt:
  > Illustration: an empty wooden pass shelf (the counter where finished food waits for pickup) seen in three-quarter view, two plain wooden shelves with nothing on them, and one forest ladle hanging from a hook on its side.
- Check before saving: reads as empty and calm, not broken; no food anywhere.

---

## Checklist

| # | File | Priority | Done |
|---|---|---|---|
| 1 | polish/spot/spot-rantang.png | P1 | [ ] |
| 2 | polish/spot/spot-rantang-open.png | P1 | [ ] |
| 3 | polish/spot/spot-menu-card-pencil.png | P1 | [ ] |
| 4 | polish/spot/spot-plate-empty-pencil.png | P1 | [ ] |
| 5 | polish/spot/spot-rantang-clock.png | P1 | [ ] |
| 6 | polish/spot/spot-scooter.png | P1 | [ ] |
| 7 | polish/spot/spot-wok.png | P1 | [ ] |
| 8 | polish/spot/spot-nota.png | P1 | [ ] |
| 9 | polish/spot/spot-lid-heart.png | P1 | [ ] |
| 10 | polish/spot/spot-calendar-tote.png | P1 | [ ] |
| 11 | polish/spot/spot-pin-lid.png | P1 | [ ] |
| 12 | polish/spot/spot-saringan.png | P1 | [ ] |
| 13 | polish/spot/spot-cabai.png | P1 | [ ] |
| 14 | polish/spot/spot-plate-leaf.png | P1 | [ ] |
| 15 | polish/spot/spot-plate-pause.png | P1 | [ ] |
| 16 | polish/spot/spot-rantang-gift.png | P1 | [ ] |
| 17 | polish/empty/empty-area.png | P1 | [ ] |
| 18 | polish/empty/empty-kentongan-lid.png | P1 | [ ] |
| 19 | polish/onboarding/welcome-meja.png | P1 | [ ] |
| 20 | polish/onboarding/plate-ayam.png | P1 | [ ] |
| 21 | polish/onboarding/plate-ikan.png | P1 | [ ] |
| 22 | polish/onboarding/plate-daging.png | P1 | [ ] |
| 23 | polish/onboarding/plate-sayur.png | P1 | [ ] |
| 24 | polish/onboarding/plate-pedas.png | P1 | [ ] |
| 25 | polish/onboarding/plate-tanpa-santan.png | P1 | [ ] |
| 26 | polish/onboarding/primer-area.png | P1 | [ ] |
| 27 | polish/moment/moment-rantang-meledak.png | P1 | [ ] |
| 28 | polish/moment/moment-langganan-aktif.png | P1 | [ ] |
| 29 | polish/onboarding/primer-notifikasi.png | P1 | [ ] |
| 30 | polish/spot/spot-rantang-dikemas.png | P2 | [ ] |
| 31 | polish/spot/spot-rantang-sampai.png | P2 | [ ] |
| 32 | polish/token/token-nasi-kotak.png | P2 | [ ] |
| 33 | polish/token/token-sate.png | P2 | [ ] |
| 34 | polish/token/token-gado-gado.png | P2 | [ ] |
| 35 | polish/token/token-pisang-goreng.png | P2 | [ ] |
| 36 | polish/token/token-es-teh.png | P2 | [ ] |
| 37 | polish/category/category-nusantara.png | P3 | [ ] |
| 38 | polish/category/category-sehat.png | P3 | [ ] |
| 39 | polish/category/category-keluarga.png | P3 | [ ] |
| 40 | polish/category/category-kantor.png | P3 | [ ] |
| 41 | polish/compliment/compliment-hangat.png | P3 | [ ] |
| 42 | polish/compliment/compliment-porsi-pas.png | P3 | [ ] |
| 43 | polish/compliment/compliment-rumahan.png | P3 | [ ] |
| 44 | polish/dapur/dapur-selesai.png | P3 | [ ] |
| 45 | polish/dapur/dapur-rak-kosong.png | P3 | [ ] |

P1 covers top 10 items 1 to 6, P2 covers items 8 and 9 (7 and 10 need no art), P3 covers the remaining gap-map rows. All paths are under `packages/brand/assets/`.
