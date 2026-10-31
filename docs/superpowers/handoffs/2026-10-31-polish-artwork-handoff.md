# Polish artwork: handoff (2026-10-31)

Branch v2. Speed mode. Built, audited with expo-native-ui + design-taste-frontend, fixed, all checks green. **The emulator re-gate was interrupted by the session rate limit.** See "Gate" below. Not pushed.

## Commits this phase
- `a7c97f35`: polish artwork set (45 masters, prompts, research).
- `91a50d08`: PolishArt registry, runtime derivatives, empty-wok Dapur art (`dapur-kosong`), spec and canvas source.
- Polish build commit: see `git log` after this handoff. It holds onboarding, Masuk band, Beranda/tracker/Selamat makan/Langganan aktif/push primer, Jelajah/Paket/empties/Akun, Dapur states, the test:fast scripts, DESIGN.md and this handoff.
- Separate work in the same tree by other owner sessions: `0e1b13d2` (web production readiness), `a8c6d98e` (copy audit 001).

## Rulings
1. Stars are kept. Compliment chips toggle phrases into the review text (`today/praise.ts`, REVIEW_MAX 1000).
2. There's no referral card. `spot-rantang-gift` marks trial packages and trial rows.
3. "Termasuk" only shows rows the data backs: "Bisa pindah tanggal" when `flexible`, the trial row when a trial price exists, and no "Sayur tiap hari".
4. The push primer has no promo copy. It's shown once after the first paid plan, as a fit native sheet route `notifikasi-primer`.
5. Onboarding is welcome, area, lauk, loader. There's no meal-time step. `LAUK_SORTS_JELAJAH = true` because Jelajah really sorts.
6. Dapur's no-orders art is the empty wok `dapur-kosong` (owner pick, after measured audits). `dapur-rak-kosong` is kept as a record and not shipped.
7. The mascot only appears in character moments. Empty states use art for their own cause.
8. Later controller rulings:
   - "Selamat makan" is a card on the delivered hero that opens the review sheet; nothing opens on its own.
   - "Tepat waktu" uses `spot-rantang-sampai`.
   - Jelajah categories are art chips at the head of the chip row, not a tile row, to keep the fold rule.
9. Owner rule: the canvas sets structure, placement and copy. Measurements come from expo-native-ui + design-taste-frontend (expo-native-ui wins).

## Deviations from the canvas (data-truth or platform)
- There's no "Dikemas" tracker stage (no packing data), so `spot-rantang-dikemas` is unused.
- There's no separate Lacak screen, so its timeline and "Sambil menunggu" aren't built.
- Real dish photos stay; stock plate photos aren't used as package or paid heroes.
- There's no "Sering dipesan ulang" row (no data behind it).
- The "Ketik alamat" onboarding option was dropped, because nothing maps a typed address to an area.
- The Masuk heading keeps AuthHeading, with the mascot above the title rather than inline.

## Evidence
- Audit: output/native-review/polish-2026-10-30/audit/AUDIT.md. It found 33 issues (2 high, 12 med, 19 low), all addressed by the builders.
- Code review (Opus): one medium (Android back skipping onboarding) and three lows, all fixed.
- Checks on the final tree: typecheck clean; customer jest 2139/2139; caterer jest 986/986; root vitest 1115/1115. They ran in parallel (`npm run test:fast`); the full suite takes about 3 minutes.
- **Gate:** re-gate PASS (output/native-review/polish-2026-10-30/regate/GATE.md). Both highs and all 12 mediums are fixed or changed by ruling, and Android back steps back on every onboarding step. Its three follow-ups (N1 Selamat makan card repeating the headline, N2 art chips after the budget/trial chips, N3 onboarding pre-filling an uncovered area) are fixed in 46496ae0. Those three fixes were checked by tests, not on a device.

## Owner actions / parked
- Shrink the 11 food cutouts to WebP to cut about 4 MB from the 8.3 MB runtime art.
- Reachable only in jest, not in demo: the push primer (no push in Expo Go), Dapur kosong/selesai, Kata pelanggan, and the Notifications empty state.
- The sign-in phase's owner actions are still open (Google/Apple providers, SMTP, applying the hosted migration). See docs/superpowers/handoffs/2026-10-30-sign-in-rethink-handoff.md.
