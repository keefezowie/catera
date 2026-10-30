# Polish: artwork placements across both apps (2026-10-30)

Owner-approved canvas: https://claude.ai/artifact/AYNBDXeKJc6z4CTtADEG67 (22 screens). The owner chose to see every screen on the canvas first, then said "continue with the overhaul implementation, speed mode". Research: docs/superpowers/research/2026-10-30-uber-eats-patterns.md. Artwork: packages/brand/assets/polish/ (prompts in docs/brand/2026-10-30-polish-artwork-prompts.md). The canvas source is in the session scratchpad at polish-canvas/project/*.dc.html (paths in the plan).

## Rulings (controller, speed mode, from what the code supports)
1. **Rating stays 1–5 stars.** The `reviews.rating int 1..5` column and `review.save` stay unchanged. The canvas's compliment chips (compliment-hangat, -porsi-pas, -rumahan) become optional quick-praise chips. Tapping one adds its phrase to the review text, so there's no new backend field.
2. **No referral programme exists, so there's no "Ajak teman" card.** `spot-rantang-gift` marks the trial package ("Paket coba") wherever the app shows a trial. If the app has no trial surface, the asset stays unused and that's reported.
3. **Package "Termasuk" rows only state what the data supports.** "Sayur tiap hari" is dropped because no field backs it. "Bisa libur" becomes "Bisa pindah tanggal" ("can move a date"), shown only when the package isn't fixed (the existing `FIXED_PACKAGE` rule / deliveryChange availability). `spot-plate-leaf` goes to vegetarian or healthy tags/categories where they exist.
4. **The push primer doesn't mention promos,** because the app never sends them. The copy covers cooking, on the way, and arrived.
5. **Onboarding drops "Kapan biasanya makan?"** It has 2 steps (area, favourite lauk) plus the "Mencari" loader. The lauk choice is stored on the device. The "we sort Jelajah from your choices" claim only appears if Jelajah really sorts on it: a simple keyword match against package or menu names and tags. If that can't be done honestly, the subtitle says "Kami ingat pilihanmu." instead.
6. **Dapur's "no orders" art is `dapur/dapur-kosong.png`** (the empty wok, owner pick). `dapur-rak-kosong.png` is kept as a record and not used.
7. **The mascot stays where it's a character:** sign-in headings, CheckEmail, AuthOutcome, loading, and "Dapur libur" (tidur). The repeated "mencari" and "tidur" empty states get their own art per cause, as on the canvas.

## Behaviour
**Owner instructions (2026-10-30):**
- **The canvas decides what and where.** The source artboards are in docs/superpowers/canvas/2026-10-30-polish/*.dc.html. Follow them closely for screen structure, element order, which art goes where, art role and prominence, and copy. Deviate only where a ruling above requires it.
- **The skills decide measurements.** Spacing, sizing (including art display sizes), type scale, tap targets, safe areas and platform behaviour come from the results and calculations of the `expo-native-ui` and `design-taste-frontend` skills, used together with DESIGN.md tokens. `expo-native-ui` wins when the two conflict. The canvas's px values are indicative only. Every builder invokes both skills before building and notes which skill rule set each measurement.
- **The skills audit the result.** After the build, a dedicated audit agent runs both skills over every changed screen (screenshots plus code) and reports findings. Its fixes go in before the gate. The emulator gate then checks the screens against the canvas for structure and placement, and against the skills' rules for measurements.
Build each screen as drawn on the canvas, applying the rulings above. Use the real app components and tokens, and keep everything from DESIGN.md.
- **Customer first-run onboarding** (new route group, shown once before Beranda on a fresh install; "Lewati" skips it): welcome photo (welcome-meja, cover), area (primer-area, area chips or the existing area picker), lauk picker (6 plate-*, pick up to 3), loader (echo). The area choice feeds the existing Jelajah area filter.
- **Masuk / Register:** the food-token band (5 token-* on code-drawn seals) sits above the heading on the providers step only.
- **Hari ini (Beranda):** spot icons replace the generic icon tiles (spot-menu-card-pencil, spot-rantang-open, spot-plate-empty-pencil, spot-rantang-clock) as drawn.
- **Tracker (RantangTrack / LiveSlot):** stage pictures are spot-wok (dimasak), spot-rantang-dikemas (dikemas), spot-scooter (diantar) and spot-rantang-sampai (sampai), plus a short status headline per stage.
- **Selamat makan:** after "Sudah sampai", the review sheet shows moment-rantang-meledak sized by height, the stars, and the compliment chips (ruling 1).
- **After payment:** PaidOutcome becomes "Langganan aktif" with moment-langganan-aktif and a summary card, in place of the confetti-only view. After the first successful payment, a push primer sheet appears (primer-notifikasi; "Nyalakan notifikasi" / "Nanti saja") when permission is undetermined, shown at most once.
- **Jelajah:** category tiles (category-*) where the canvas shows them, backed by real filters. If a category has no real filter, leave that tile out. Empty states get their own art: empty-area (no caterer in the area) and spot-saringan (filters give nothing). Disimpan's empty state uses spot-lid-heart.
- **Package detail:** "Termasuk" rows with spot icons (ruling 3) and "Kata pelanggan" with compliment art, only if reviews exist.
- **Akun:** spot tiles (spot-rantang for Langganan, spot-pin-lid for Alamat, spot-nota for Riwayat/Laporan as drawn). There's no referral card.
- **Empty states:** Notifications uses empty-kentongan-lid, and Laporan uses spot-nota with the existing "Minta bantuan".
- **Dapur Hari ini:** no orders shows dapur-kosong, all delivered shows dapur-selesai, and closed today keeps the sleeping mascot.
- **Remaining assets:** category-*, spot-cabai and spot-calendar-tote go where the canvas places them. Any asset with no truthful home is listed in the handoff, not forced in.

## Rules
- Art comes from the `PolishArt` registry in @catera/mobile-ui (runtime derivatives, never the 1254 px masters). It's decorative unless it carries meaning.
- No new backend tables. Data shown must be real, with no invented numbers (for example "12 pelanggan makan dari dapurmu" uses the real delivered count, or the line is dropped).
- Copy is Indonesian first with English through `t()`, in the approved canvas voice (humanizer).
- Reduce motion is honoured for any entrance animation.

## Acceptance
- typecheck, root vitest, customer and caterer jest, the build and postgres all pass.
- The emulator gate (Opus) compares each screen to the canvas, on light and dark themes and at 1.3× font scale.
- A handoff lists any unused assets and the reason.
