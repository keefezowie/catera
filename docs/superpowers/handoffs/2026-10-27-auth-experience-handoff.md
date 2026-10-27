# Auth experience handoff (2026-10-27)

Branch `v2`, main tree. The phase started at `ce622f18`. Nothing is pushed. The last commit is in `git log`; the gate fix (`fix(auth): offline demo sign-in says OFFLINE…`) is the final code commit.

## What shipped
- **Research:**
  - `docs/superpowers/research/2026-10-27-auth-current-state.md` is the emulator audit (84 captures, `output/native-review/auth-2026-10-27/current/`).
  - `docs/superpowers/research/2026-10-27-auth-mobbin.md` covers 28 apps from Mobbin, iOS only.
- **Spec:** `docs/superpowers/specs/2026-10-27-auth-experience-design.md`, approved with owner picks 1A 2A 3A 4B 5A 6A.
- **Canvas:** https://claude.ai/artifact/JekWVZZYavVKCXhVqK5zo9. Board 6 is the reacting-mascot prototype.
- **Plan:** `docs/superpowers/plans/2026-10-27-auth-experience.md`. DESIGN.md has a new section, "Auth experience (October 2026)".
- **Both apps:**
  - inline field messages on blur and submit, with buttons always enabled except the 6-digit code
  - password rule and match lines
  - error copy from spec 7, held in `@catera/domain`
  - "Coba lagi" for offline and server failures
  - a 60s rate-limit countdown
  - the outline rule: only the person's own errors outline fields
  - the shared 6-box code entry with resend timer
  - "Cek emailmu" with an open-mail intent and "Terkirim"
  - expired-link recovery with a one-tap resend
  - outcome screens with their exits locked
- **Customer:**
  - "Email terverifikasi" outcome
  - "Kata sandi diganti" outcome; the user stays signed in (3A)
  - the reacting mascot (6A)
  - no sign-in toast (4B)
- **Dapur:**
  - "Dapurmu siap" after sign-up
  - password recovery (5A): `(auth)/pulihkan` and `auth/callback`, using the shared `packages/mobile-core/src/emailLink.ts`
- **Fixes found on the way:**
  - S-1: demo sign-out now clears the server's demo cookie.
  - C-1: the white strips in Expo Go came from `useAnimatedKeyboard` without its translucent flags. Release APKs were never affected.

## Gates
- At `98009483`, before the gate fix:
  - `npm run typecheck`, `npm test` (111 files) and `npm run build` all pass.
  - Customer Jest: 2049/2049, twice, with no flaky test.
  - Dapur Jest: 982/982.
- The gate fix re-ran both suites: customer 2053, Dapur 981.
- The emulator gate is at `output/native-review/auth-2026-10-27/final/GATE.md`, with 104 captures and contact sheets.
  - PASS: C-1 dark strips gone in both apps, S-1 sign-out persists, field messages and wording in light/dark × ID/EN, outlines, buttons, Pulihkan, expired link, mascot poses.
  - One FAIL (offline demo sign-in wording) was fixed afterwards and checked in Jest only. It was not re-captured on the emulator.

## Not verified
- iOS: there is no Mac.
- Real email delivery: the built-in mailer, with no custom SMTP.
- Real SMS: the project has no SMS provider.
- On device, these Supabase-only states were reached in Jest only:
  - the new-password form
  - every outcome screen
  - Cek emailmu
  - the code step and a wrong code
  - the rate limit
  - wrong credentials, and unverified or registered email
- TalkBack and VoiceOver reading, haptics, font scale 1.3, reduced motion and the mascot gestures on device.

## Owner actions
1. Supabase Auth → URL Configuration → Redirect URLs: add `catera://auth/callback` and `catera-dapur://auth/callback`. Set Site URL to the production domain.
2. Custom SMTP (docs/RUNBOOK.md), and an SMS provider for phone OTP.
3. The phase's commit `ce909562` contains your earlier uncommitted `EMAIL_REGISTERED` work in `apps/customer/src/account/Register.tsx` and `apps/customer/tests/identity.test.tsx`, because Task 5 built on it. Your other uncommitted files were left out of every commit and are still in the working tree. Your uncommitted `apps/customer/app/_layout.tsx` and `apps/caterer/app/_layout.tsx` edits sit beside this phase's committed route changes there.

## Rulings made on your behalf
- **Sonnet-first builders.** Builders followed your Sonnet-first ladder, with Opus for reviews and gates. One Opus escalation: Task 5, round 3. *If wrong:* more fix rounds.
- **CheckEmail art.** CheckEmail's art defaults to the mascot, and Dapur passes `art={null}`. *If wrong:* none seen.
- **Offline detection.** `isOffline` is true only with no HTTP status, so a 5xx is a server error. *If wrong:* an offline error carrying a status would show the server sentence.
- **Error haptic.** New `error` haptic kind. *If wrong:* one more kind in the contract.
- **"1 field needs fixing".** The English count reads "1 field needs fixing" for n=1. *If wrong:* none.
- **Mascot timing.** The mencari gesture stays 640ms, as in the prototype you approved (the spec said under 600). *If wrong:* 40ms.
- **Your WIP in Task 5.** Task 5 committed your EMAIL_REGISTERED work, because it extends it. *If wrong:* split it with git.
- **Dapur "Lupa kata sandi?".** The second-wrong-password "Lupa kata sandi?" in Dapur moved to Task 8. *If wrong:* none.
- **C-1 diagnosed separately.** C-1 was taken out of Task 5 and diagnosed on the emulator. *If wrong:* one extra dispatch.
- **Shared email-link logic.** The link logic went into mobile-core so Dapur does not copy security code. *If wrong:* a larger Task 8.
- **Fixed 60s rate wait.** The rate wait is a fixed 60s, because Supabase JS does not expose Retry-After. *If wrong:* the wait is sometimes too long or too short.
- **Parked: checking subtitle.** "Memeriksa tautan…" stays visible beside a link-failure message. *If wrong:* a confusing subtitle on a rare failure.
- **Parked: offline `profile.ensure`.** An offline `profile.ensure` shows the server sentence (`ensured.status === 0` is not checked). *If wrong:* wrong words in a rare window; Coba lagi works.
- **Parked: unrecognised 4xx.** Unrecognised Supabase 4xx errors map to AUTH_UNAVAILABLE ("Ada gangguan di sisi kami"). This mapping predates the phase. *If wrong:* a misleading message on rare server validation errors.

## Deferred minors worth a follow-up
- Dapur Daftar has no verified-code ring.
- Dapur fields stay editable while a request runs.
- Dapur's retry replays a stale closure (the customer's reads current state).
- The outcome-exit code is written three ways.
- `FormError` `action` silently overrides `retry`.
- The Cek emailmu resend ignores a running rate wait.
- Dapur's unverified-email error has no resend action.
- The caterer suite mocks `usePreventRemove` globally.
- Dapur Pulihkan uses `router.replace` instead of a dismiss.
- The confirm field does not outline on a mismatch.
- RecoverForm's pending-clear has no test of its own.
- The modal close buttons hold an unlabelled 36dp inner element.
- `adb` deep links need `-p host.exp.exponent` when the customer APK is installed.

## Next
1. Your device review on a fresh release APK, built per the emulator memory note: hosted Supabase key from `get_publishable_keys`, never grepped.
2. A follow-up session for the parked items and the deferred minors above.
3. Push v2 only when you say so.
