# Customer layout rethink: research handoff, 2026-10-22

The owner asked for a rethink of the customer app's layout (sizing, spacing, density, hierarchy, component placement; not colour), customer app first, Catera Dapur later. The research and audit stage is done. The next stage is the canvas.

## Where things are
- Branch `v2` at `1977a972`. The new docs are uncommitted in the main tree `D:\Project\Catera\catera`.
- **Start here:** [2026-10-22-layout-synthesis.md](../research/2026-10-22-layout-synthesis.md). It holds the audit, the 15 consensus patterns, the proposed native layout scale (section 3.1), the screen directions (3.2) and the owner's answers (section 4).
- Supporting docs: [code inventory](../research/2026-10-22-customer-layout-inventory.md), [Mobbin food, 11 apps](../research/2026-10-22-layout-mobbin-food.md), [Mobbin cross-industry, 10 apps](../research/2026-10-22-layout-mobbin-crossindustry.md).
- **Before captures:** `output/native-review/layout-2026-10-22/before/` (34 PNGs, 1080x2400), with contact sheets `sheet-tabs.png` and `sheet-detail.png`. Reference sheets `ref-food.png` and `ref-cross.png`; 31 high-res references in `output/mobbin/2026-10-22/{food,cross}/`.

## Owner decisions (2026-10-22)
1. Re-layout and move content between screens; the four tabs and names stay.
2. The mood header shrinks into a food-led hero (mood colours and day statement kept as its caption; the arc becomes a compact status line).
3. Balanced density: 16-20 margin, fewer but bigger modules, compact secondary rows.
4. Jelajah card style is open: the canvas shows full-width photo-on-top and a 2-up grid.
5. Design for one plan, sometimes two; several plans get a compact rail; the 8-plan demo is a stress test.
6. Skills: the owner asked for `design-taste-frontend` for this work (an exception to the 2026-10-17 skill rule). Read its `references/app-screens.md` sections 2.1-2.2 and 7. It is web-oriented, so it fits the HTML canvas. Keep `ui-ux-pro-max` and the superpowers process skills.

## Next step: the canvas
Make a canvas Artifact with before and after at 412dp phone width, Android first. Cover Beranda (one plan, two plans, the stress case), Jadwal with the day sheet, Jelajah (both card options), package detail, Akun, plan detail and buy. Build it on the 3.1 scale with the approved palette K (DESIGN.md "Colour revision (Phase G)") and Plus Jakarta Sans. Use real demo dish photos from the repo, not placeholders. Annotate the measurements on each screen. The owner picks; then the spec goes in `docs/superpowers/specs/`, then the plan.

## Environment notes
- To capture the app: run `emulator -avd Catera_Pixel8_API36`, which has Expo Go only. The owner's dev backend runs on :3000. Start Metro with `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start` in `apps/customer`, open `exp://10.0.2.2:8081` and sign in with "Masuk sebagai pelanggan demo". The helpers are in `output/native-review/phase-g/scripts/adb.sh` and `contact-sheet.cjs`.
- Never stage `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/`, `graphify-out/` or `catera-phase-f-artwork.zip`.
