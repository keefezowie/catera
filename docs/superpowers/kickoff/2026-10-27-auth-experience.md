# Auth experience kickoff: sign in, sign up, password reset, success states (customer + Dapur)

Paste this as the first message of a fresh session on `v2` in `D:\Project\Catera\catera`. It is self-contained.

## The owner's problem

The auth flows in both native apps work but do not feel like a top shipped app. Three concrete complaints:

1. **No feedback on a mismatch.** On the new-password screen, when the two passwords differ, nothing tells the user. Check every field pair and every validation across all auth screens for the same gap (too short, empty, bad email, wrong code, expired link, rate limit, offline).
2. **No success moment.** After a password reset, sign in or sign up succeeds, the app just moves on (reset sends the user to `/login` with no message). Modern apps show a clear confirmation: a success screen, a toast, or a state change that says what happened and what is next.
3. **The overall flows are below the bar of top apps.** Understand the current state, compare it with shipped apps, and close the gap, for both apps.

Scope: the **customer app** (`apps/customer`) and the **Dapur caterer app** (`apps/caterer`). Shared pieces live in `packages/mobile-ui` (`AuthScreen`, `AuthHeading`, `Field`, `PasswordField`, `FormError`, `AuthSwitch`, `Button`) and `packages/mobile-core`. Fix shared pieces once and reuse them; do not fork per app.

## Current state (verify, do not trust)

Customer (`apps/customer/src/account`, routes `app/login.tsx`, `register.tsx`, `recover.tsx`, `auth/`):
- `Masuk.tsx` sign in (email and password, plus phone OTP), `Register.tsx` email sign up, `CheckEmail.tsx` "check your email" screen with resend, `Recover.tsx` forgot password, `AuthCallback.tsx` handles `catera://auth/callback` for both email verification and the new-password form.
- `AuthCallback.tsx` has `password` and `confirm` state; verify whether a mismatch is checked or shown. After `updateUser` it signs out and `router.replace`s to `/login` silently.
- Sign up already shows an explicit "email already registered" error (added 2026-10-27, `EMAIL_REGISTERED` in `Register.tsx`). Keep that behaviour.
- Errors go through `useAction` and `failureText`/`accountMessages.ts`; `FormError` announces them.

Dapur (`apps/caterer/src/auth`, routes `app/(auth)/masuk.tsx`, `daftar.tsx`):
- `Masuk.tsx` sign in (phone OTP or email and password), `Daftar.tsx` sign up with phone OTP. There is **no password recovery screen** in Dapur at all; decide with the owner whether it needs one (email accounts can have forgotten passwords).
- Compare with the customer screens: same patterns or drifted?

Backend facts (so you do not chase the wrong cause):
- Supabase project is Catera V2 (`kdfddipnkcviberrldpk`). Production web is `https://catera-eight.vercel.app`.
- Email links use the PKCE code flow and must return to `catera://auth/callback`. The owner is adding that URL to Supabase Auth, URL Configuration, Redirect URLs, and setting Site URL to the production domain. If a reset link still ends in `redirect_to=http://localhost:3000`, that is dashboard config, not app code.
- Phone OTP: the hosted project returned `phone_provider_disabled`, so no SMS provider is configured yet. Phone flows cannot be verified against the hosted project; test them with the explicit demo mode or mocks and say so.
- Supabase built-in mailer is rate limited and unsuitable for production; custom SMTP is an owner action (docs/RUNBOOK.md). Do not claim email delivery is verified.

## Work, in this order

1. **Audit the current flows on a device.** Run both apps on the Android emulator (see memory notes and `docs/RUNBOOK.md` for the emulator gate environment: Metro never `CI=1`, demo backend on a data copy, never `taskkill node.exe`). Screenshot every auth screen and every state (empty, filled, invalid, loading, error, success, expired link, offline) in light and dark, Indonesian and English. Write the findings to `docs/superpowers/research/2026-10-27-auth-current-state.md`: each gap with a screenshot reference and a severity.
2. **Research top apps.** Use Mobbin first (flows for: sign up, sign in, forgot password, reset password, email verification, OTP entry, success and confirmation screens, inline validation, password strength and show/hide, error states). Open it in the built-in browser; if sign-in blocks you, say so and fall back to firecrawl search and scrape of public design write-ups and the Material 3 and Apple HIG guidance. Look at at least 8 shipped apps, preferring food delivery and marketplace apps used in Indonesia (Gojek, Grab, Tokopedia, Shopee) plus best-in-class apps (Airbnb, Uber, Spotify, Notion, Duolingo, Linear). For each pattern record: what they do, why it works, what Catera should take. Write to `docs/superpowers/research/2026-10-27-auth-mobbin.md`. Do not copy artwork or reproduce screens; extract patterns.
3. **Spec.** Write `docs/superpowers/specs/2026-10-27-auth-experience-design.md` covering at least:
   - inline field validation (when it fires: on blur or on change, wording, outline and message placement), including password mismatch and a password rules or strength hint;
   - a success state for every flow: sign up (verify email confirmed), sign in (welcome back or a clean arrival), password reset done (a confirmation screen with a clear next action, then sign in), OTP verified;
   - the email-sent screen, resend with cooldown timer, change email, open-mail-app shortcut;
   - expired or used link recovery: a screen that explains and offers a new link in one tap;
   - loading and busy states, keyboard handling and focus order, autofill and password manager hints, accessibility (labels, announcements, touch targets, screen reader order), reduced motion;
   - the Dapur recovery question (needs one or not);
   - Indonesian-first copy that sounds like a person; every string in both languages.
   Stop here and show the owner the spec and a short list of choices before building (a design canvas Artifact with iOS and Android side by side is the established format; the memory index has the canvas notes). Do not start the build without the owner's pick.
4. **Plan and build.** `writing-plans`, then `subagent-driven-development`. Share the validation, success and error components in `packages/mobile-ui`. Add tests for each new state (mismatch message, success screens, expired link, resend cooldown, both apps).
5. **Gates.** `npm run typecheck`, `npm test`, `npm run build`, both app Jest suites (`npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"` from each app folder), then an emulator pass over every flow with screenshots. State what was not verified (iOS, real email and SMS delivery).

## Skills to invoke first

`expo-native-ui` (wins on any conflict), `design-taste-frontend` (general rules only; its web stack does not apply to native), `impeccable` (critique and polish), `apple-design` (iOS feel and motion), `antislop:antislop`, `antislop:antislop-ui`, `antislop:antislop-layoutmobile`, `antislop:antislop-human` (contrast, focus, states), `humanizer` and `antislop:antislop-copywriting` for every string, `brainstorming` before the spec, `writing-plans`, `subagent-driven-development`, `systematic-debugging` for anything that fails, `verification-before-completion` before claiming done, and `ponytail` on all coding. `ui-ux-pro-max` is retired; do not use it. If a skill is not installed, say so in the report.

## Fixed rules

- Work on `v2` in the main tree. `v1` is maintenance-only. AGENTS.md applies in full: no secrets, no real customer fixtures, demo mode explicit and synthetic, tenant and entitlement changes in database transactions.
- Preserve the approved palette, mascot, food-led direction, Indonesian-first interface, and code-first preference (DESIGN.md owns the visual contract). No new brand assets. Never mislabel assets.
- Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json` or `.claude/`. The working tree has unrelated uncommitted changes (DESIGN.md, launch cover, tokens); do not revert them and do not fold them into your commits.
- Account enumeration is an accepted trade-off for sign up ("this email is already registered"). Keep password reset requests neutral ("if this email has an account...") so reset does not leak registration.
- Model ladder and session budget follow the memory notes (Sonnet first, Opus escalation and review).
- Do not claim email or SMS delivery works. The hosted project has no SMS provider and unverified SMTP.

## Done means

Research and audit docs written; spec approved by the owner; every auth screen in both apps shows inline validation and a success or confirmation state; shared components reused; tests and gates pass; emulator screenshots attached to the report; a handoff file in `docs/superpowers/handoffs/` records what is left.
