# Phase G-a handoff (design), 2026-10-13

Next session: **G-b build**. Follow the plan, task order and gates exactly.

## Where things are
- Branch `v2`. G-a started at f5069ba2. The G-a docs commit is the commit that adds this file (`git log -1 -- docs/superpowers/handoffs`).
- Spec: `docs/superpowers/specs/2026-10-13-native-phase-g-design.md`. Source of truth for every decision.
- Plan: `docs/superpowers/plans/2026-10-13-native-phase-g.md`. 17 tasks: G17a, G7, G3, G4, G5, G1a, G1b, G6a/b/c, G13, G15, G8, G9, G18, G17b, G20.
- Kickoff: `docs/superpowers/kickoff/phase-g.md`.
- Audit: `anti-slop/audit-009-2026-10-12.md`, with captures in `output/native-review/phase-g/audit-009/`.
- Ledger: `.superpowers/sdd/2026-10-12-native-phase-g/progress.md` (git-ignored by design). Keep appending to it.
- Design canvas: https://claude.ai/artifact/5tEjpNnNsTZEEAZHBh6VNh (picks in db `picks/*`). Local source: `output/native-review/phase-g/canvas/index.html`.
- Audit page: https://claude.ai/artifact/CXTgKPgsYw2LMRNYcjgrsP
- Palette data: `output/native-review/phase-g/palette/directions-v2.json` and `.md` (direction K), plus `mobbin-colour-restraint.md` and `refs/`. Contrast script: `output/native-review/phase-g/scripts/palette-directions-v2.cjs`.
- Motion: `output/native-review/phase-g/motion/relaxed-motion.md`, "Even slower" column.

## Decisions (the full list is in spec section 1)
- **Palette K: today's hues, used with restraint.** Forest fills only the primary CTA. The active tab, selected items and the today ring take a small forest mark. Sunrise marks only the current tracker stop. Prices are ink. Warnings use their own tone plus words. Siang and Malam are a faint header tint plus a sun/moon mark. One branded moment per screen (Paket selesai). successDisc is pinned to #FFEFD9. All 156 contrast pairs pass.
- **The owner reopened the palette on 2026-10-13.** That overrides AGENTS.md's "preserve the latest approved palette" for how colour is used; the hues are unchanged. The AGENTS.md wording is left for the owner to amend.
- **Motion "Even slower".** Owner: "the animations happening in the app is too fast, make it more relaxed and chill". No loops (D3), and reduce-motion stays instant. Web motion values must change together with native or the parity test fails.
- **G1 outcomes:**
  - g1d TalkBack focus FAIL: fix the focus timing.
  - g1e Dapur impor-baris delete: add an undo toast.
  - Customer tab bar covers "Kirim laporan" at the form detent: defect.
  - Dapur crash at `MascotReading.tsx:141`: transform-origin z from `${y*100}%`.
- **Chat answers:**
  - OTP shows a busy button; keep the mascot screen for long requests.
  - Deleting an account while a plan is running: the team settles first.
  - The renewal line names the same package.
  - Overlap is blocked only for the same package, and portions are fixed.
- **G18 copy picks** are in canvas db `picks/*` and spec section 6. These went against the recommendation: "pengantaran", "Ditandai sampai otomatis", and keeping "1 sampai 2 hari kerja".
- **Parked for Phase H:** a paid "tambah porsi" top-up.

## Open risks (spec section 14)
- K defines no Android `tabIndicator` and no dark `forestDeep`. Decide in G7 and stay within K's rules.
- The heart in forest and the launch sparkles are an interpretation of K, not an owner pick.
- The TalkBack focus fix is a hypothesis. A fallback is written into the plan.
- The hero photo failure on the owner's phone is unexplained.
- EAS project ids and hosted `pg_cron`/`pg_net` availability are unknown. Never enter or invent credentials (Apple, EAS, Firebase).
- Dapur availability read for the calendar is unresolved.

## Emulator and run commands (G0)
- SDK cmdline-tools 19.0 in `Sdk\cmdline-tools\latest`. JAVA_HOME is `C:\Program Files\Android\Android Studio\jbr`.
- AVDs: `Catera_Pixel8_API36` (primary, emulator-5554), `Catera_Pixel8_API35` and `Catera_Pixel8_API34`. Expo Go 57.0.9 is installed.
- Backend: `CATERA_V1_DEMO=true CATERA_DEMO_DATA_DIR=D:/Project/Catera/catera/.data/phase-g-a-2332 npm run dev` (127.0.0.1:3000). Use a fresh data dir for G-b.
- Customer Metro: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start --go --android --port 8081` (`--go` is required because expo-dev-client is installed; no CI=1).
- Dapur Metro: same command with `--port 8082`. Open it with `adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:8082`.
- Moods are switched in-app. For light/dark: `adb shell cmd uimode night yes|no`.
- If Gboard sticks in hardware-keyboard mode after console key events, reboot the emulator.
- State at G-a close: emulator, backend and Metro were left running. Check them before restarting.

## Session rules (carry over)
- Record the weekly usage % from get_usage at start and end in the ledger. Keep the controller quiet and wait for notifications. Compact near 150k.
- Set the model on every dispatch: Sonnet builds; Opus fixers, reviewers and gates; never Haiku. Only gate agents drive the emulator or take screenshots.
- Every UI or copy prompt carries the full skill line in the plan: SL-UI or SL-COPY.
- Stage by explicit path. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json`, `.claude/` or `catera-phase-f-artwork.zip`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No model identifiers in docs.
- AGENTS.md: keep tenant authorization in database transactions. Demo mode is explicit and synthetic. No secrets and no real customer fixtures. Run typecheck, test and build after material changes.

## Next step
Start G-b: read the spec and plan, record the start usage, then run task G17a onward in plan order with the gates the plan names. Write a G-b handoff at the end.
