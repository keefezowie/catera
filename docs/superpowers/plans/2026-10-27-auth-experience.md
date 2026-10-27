# Auth Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every auth screen in the customer app and Catera Dapur validates inline, says what happened on success and failure, and recovers from expired links, offline and rate limits. Both apps use shared pieces.

**Architecture:** Form primitives (validation hook, rules and match lines, outcome screen, reacting mascot, code entry, check-email, recovery forms) live in `packages/mobile-ui`. Email-auth logic (pending intent, PKCE exchange, error mapping) lives in `packages/mobile-core`. App screens only wire routes, navigation and per-app art: the customer mascot, or the "Catera Dapur" wordmark.

**Tech Stack:** Expo SDK 57, expo-router, React Native, Reanimated, Supabase JS (PKCE), Jest (app suites), Vitest (root).

**Spec:** `docs/superpowers/specs/2026-10-27-auth-experience-design.md` (approved; owner picks 1A 2A 3A 4B 5A 6A). Audit: `docs/superpowers/research/2026-10-27-auth-current-state.md`. Canvas: https://claude.ai/artifact/JekWVZZYavVKCXhVqK5zo9

## Global Constraints

- Work on `v2` in the main tree. Never stage `apps/web/tsconfig.json`, `apps/web/next-env.d.ts`, `output/verification/postgres.json` or `.claude/`. The tree already has unrelated uncommitted changes (DESIGN.md, design-tokens, LaunchCover, MoodHeader, app configs, `_layout.tsx`, Register.tsx, some tests). Do not revert them and do not commit them: stage only your own hunks (`git add -p`). Where your task edits one of those files, stage only your hunks.
- Never kill processes you did not start. Never `taskkill /IM node.exe`. Never run Metro with `CI=1`.
- Copy: every string goes through `t("Indonesian", "English")`, using exactly the wording in spec 3.3 and section 10. The Indonesian uses "kamu". No new brand assets. Use only the existing poses: `melambai`, `membaca`, `bingung`, `mencari`, `merayakan`, `tidur`, `memasak`.
- Colours come from `useColors()` or `themedStyles` only, never hex literals. Danger messages carry an icon as well as colour. Touch targets are at least 48dp.
- Reduced motion (`useReduced`): no shake, no gesture, an instant pose swap, the still outcome (SuccessBeat already handles this).
- Recovery stays neutral ("Kalau email ini terdaftar…"). Sign up keeps "Email ini sudah terdaftar".
- No sign-in toast (pick 4B). The primary buttons stay enabled (pick 2A), except the code step, which waits for 6 digits.
- The rate-limit wait is a fixed 60s countdown. Supabase JS does not expose `Retry-After`; spec section 7 is narrowed to that.
- Demo mode stays explicit and synthetic. Phone OTP and email cannot be verified against the hosted project; test them with mocks.
- Model ladder for builders: Sonnet first (3 attempts), then one Opus escalation. Reviewers and gates are Opus.

## Review Focus

1. **Typing after a message shows:** fixing the input clears the message on the same keystroke, and breaking it again brings it back. Owner: Task 2 (`useFieldCheck` test "re-checks on change once shown").
2. **Show/hide on the new-password pair:** toggling one field reveals both, so the person can compare them. Owner: Task 2 (`PasswordField` `shown`/`onShownChange` test) and Task 6.
3. **A link opened on another phone, or opened twice:** the expired screen offers "Masukkan email" (no stored email) and never offers a send to an empty address. Owner: Task 6 (test "expired with no pending intent").
4. **Fast double-taps and a code filled twice:** "Kirim tautan baru", resend and verify each send once. Owner: Task 3 (CodeInput onFilled once) and Task 6 (one resend call for a double press).
5. **Offline in the middle of a form:** typed values survive, the message names the connection, and the fields are not outlined. Owner: Task 5 (customer Masuk offline test) and Task 7 (Dapur Masuk offline test).

---

### Task 1: Email-auth core, error codes, demo sign-out

**Files:**
- Create: `packages/mobile-core/src/emailAuth.ts` (moved from `apps/customer/src/account/emailAuth.ts`; that file becomes a re-export or is deleted with its imports updated)
- Modify: `packages/mobile-core/src/runtime.ts:66-110` (signInPassword, sendPhoneOtp, verifyPhoneOtp, signOut), `packages/mobile-core/src/index.ts`
- Modify: `packages/domain/src/index.ts:641-660` and the English twin near `:728` (`EMAIL_NOT_CONFIRMED`, new `OFFLINE`)
- Test: `apps/customer/tests/email-auth-core.test.tsx`

**Interfaces:**
- Produces:
  - `savePending(runtime, purpose: "signup" | "recovery", next: string, email: string): Promise<void>`
  - `readPending(runtime): Promise<Pending | null>` with `Pending = { purpose; next; at; email }`
  - `clearPending(runtime)`
  - `authClient(runtime)`
  - `authError(error)` throws `Error(code)`, where code is one of `AUTH_RATE_LIMITED | OFFLINE | EMAIL_NOT_CONFIRMED | PASSWORD_REJECTED | AUTH_UNAVAILABLE`
  - `isOffline(error: unknown): boolean` is true for a fetch `TypeError`, `name === "AuthRetryableFetchError"`, or `status === 0`
  - `validEmail(s)`
  - `RATE_WAIT_S = 60`
  - Redirect URLs are passed in: `redirectFor(scheme: "catera" | "catera-dapur") => \`${scheme}://auth/callback\``
  - `runtime.signInPassword`, `sendPhoneOtp` and `verifyPhoneOtp` reject with `OFFLINE` on a network failure instead of `INVALID_CREDENTIALS`, `INVALID_INPUT` or `INVALID_OTP`
  - `runtime.signOut()` POSTs `auth/logout` (best effort, errors ignored) when a demo token was held, before deleting it
- `errorLabel("OFFLINE")`:
  - ID: "Belum ada koneksi. Cek internetmu, lalu coba lagi."
  - EN: "No connection. Check your internet and try again."
- `errorLabel("EMAIL_NOT_CONFIRMED")`:
  - ID: "Emailmu belum diverifikasi."
  - EN: "Your email isn't verified yet."

**Depends on:** none. **Builder:** sonnet.

- [ ] Step 1: Write failing tests:
  - `authError({status:429})` throws `AUTH_RATE_LIMITED`
  - `authError` of an `AuthRetryableFetchError` throws `OFFLINE`
  - `signInPassword` with `signInWithPassword` rejecting a `TypeError("Network request failed")` rejects `OFFLINE`
  - `savePending` then `readPending` round-trips `email`
  - `signOut` after a `demoLogin` calls `api.request("auth/logout", …)` once (mock the api)
  - `errorLabel("OFFLINE","id")` equals the spec string
- [ ] Step 2: Run `cd apps/customer && npx jest --runInBand tests/email-auth-core.test.tsx`. Expect FAIL.
- [ ] Step 3: Implement. Move the file, keep the customer imports compiling, and add the `auth/logout` call. The route is `apps/web/src/app/api/v1/[...path]/route.ts`, where `path[1] === "logout"` deletes `catera_v1_demo`. Check which HTTP method it takes.
- [ ] Step 4: Re-run the test (PASS), then `npm run typecheck`.
- [ ] Step 5: Commit `feat(auth): shared email-auth core, OFFLINE code, demo sign-out clears the cookie`.

### Task 2: Form primitives: field messages, validation hook, password lines, FormError action

**Files:**
- Modify: `packages/mobile-ui/src/components.tsx:352-400` (`Field` error line gains a 16 `alert-circle` glyph, which is hidden from screen readers; the field's `accessibilityHint` becomes the error text when one is shown)
- Modify: `packages/mobile-ui/src/AuthLayout.tsx:166-206` (`PasswordField` gains optional controlled `shown?: boolean` and `onShownChange?(v)`)
- Modify: `packages/mobile-ui/src/FormError.tsx` (adds `action?: { label: string; onPress(): void }`; `retry` stays and renders as `action` with "Coba lagi")
- Create: `packages/mobile-ui/src/form/useFieldCheck.ts`, `packages/mobile-ui/src/form/PasswordLines.tsx`, `packages/mobile-ui/src/form/authFields.ts`; export them from `index.ts`
- Test: `apps/customer/tests/form-primitives.test.tsx`

**Interfaces:**
- `useFieldCheck<K extends string>(fields: Record<K, { value: string; check: (v: string) => string }>)` returns:
  - `fieldProps(k: K): { error?: string; onBlur(): void; inputRef: RefObject<TextInput> }`
  - `submit(run: () => void): void`
  - `messages: Partial<Record<K, string>>`
  - `reset(): void`
- `useFieldCheck` rules (spec 3.1):
  - Blur with a non-empty value marks the field touched.
  - A touched field re-checks on every value change.
  - `submit` marks all fields touched, then runs only if every check returns `""`. Otherwise it focuses the first failing field (in `fields` key order), fires `useHaptic` error once, and announces `t("{n} isian perlu diperbaiki", "{n} fields need fixing")` with n substituted (use `AccessibilityInfo.announceForAccessibility`).
- `PasswordRule({ value, min = 8, failed }: { value: string; min?: number; failed: boolean })` is one line with three looks:
  - Idle: a muted ring and "Minimal 8 karakter".
  - Met: a forest check, and it announces "Syarat kata sandi terpenuhi" once on the transition.
  - Failed and short: danger with the alert glyph.
- `PasswordMatch({ first, second, touched }: { first: string; second: string; touched: boolean })` is quiet until `touched || second.length >= first.length`. Then it shows either the forest check with "Kata sandinya sama", or danger with "Kata sandinya belum sama.".
- `authFields`: prop presets `email`, `currentPassword`, `newPassword` (adds `passwordRules: "minlength: 8;"`), `phone`, `name`, `code`. Each preset carries `autoComplete`, `textContentType`, `autoCapitalize`, `autoCorrect`, `keyboardType` and `maxLength` (email 254, password 256, name 100).
- `FormError` with `action` renders a text `Button` under the message.

**Depends on:** none. **Builder:** opus.

**States:** field idle / touched-valid / touched-error / server-invalid outline. Rule line idle / met / failed. Match line quiet / match / mismatch. FormError with and without an action. Light and dark. Font scale 1.3 (the glyph stays top-aligned and the text wraps).

- [ ] Step 1: Failing tests:
  - "no message while typing for the first time"
  - "blur with text shows the message"
  - "re-checks on change once shown" (fix clears, break returns)
  - "submit focuses the first failing field and announces the count" (mock `AccessibilityInfo.announceForAccessibility`, expect "2 isian perlu diperbaiki")
  - "submit runs when all checks pass"
  - "PasswordRule announces met once"
  - "PasswordMatch quiet until the second field is as long as the first"
  - "toggling a controlled PasswordField pair shows both"
  - "FormError action calls onPress"
- [ ] Step 2: Run `cd apps/customer && npx jest --runInBand tests/form-primitives.test.tsx`. Expect FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: PASS, then `npx jest --runInBand` for the full customer suite (the Field change must keep the existing snapshots and queries green; update an assertion only where it pinned the old error line).
- [ ] Step 5: Commit `feat(mobile-ui): inline field messages, useFieldCheck, password rule and match lines`.

### Task 3: Shared code entry and Cek emailmu

**Files:**
- Move: `apps/customer/src/account/CodeInput.tsx` to `packages/mobile-ui/src/form/CodeInput.tsx`, and `apps/customer/src/account/CheckEmail.tsx` to `packages/mobile-ui/src/form/CheckEmail.tsx`. Update the customer imports, and export both from `index.ts`.
- Modify: `apps/customer/package.json` and `apps/caterer/package.json` (`npx expo install expo-intent-launcher` from each app folder); the mobile-ui peerDependencies gain `expo-intent-launcher`.
- Test: `apps/customer/tests/code-and-mail.test.tsx`

**Interfaces:**
- `CodeInput` keeps today's props and adds:
  - `sentTo?: string`, rendered above the boxes as "Kode dikirim ke {masked}". The masking is `maskPhone("0812 3456 7890") => "0812 •••• 7890"`: keep the first 4 and last 4 digits.
  - `error?: string`. When set, the boxes get the danger outline, a message renders under them (glyph + text, live region), and the boxes shake once: translateX 8dp, 3 cycles, 300ms, skipped under reduced motion. Fire the `error` haptic once per new error key.
  - `errorKey?: number`
  - `verified?: boolean`. When it flips true, the boxes draw a forest ring with a check for 400ms (instant under reduced motion).
- `useResendTimer(seconds, startNow?)`, `ResendButton`: unchanged API, moved.
- `CheckEmail` gains:
  - `art?: ReactNode` (the customer passes `<AuthMascot pose="membaca"/>` once Task 4 lands; until then `StateArt pose="membaca"`; Dapur passes nothing)
  - `onOpenMail` is internal. Android uses `IntentLauncher.startActivityAsync("android.intent.action.MAIN", { category: "android.intent.category.APP_EMAIL", flags: 268435456 })`, falling back to `Linking.openURL("mailto:")`. iOS uses `Linking.openURL("message://")`. All failures are swallowed.
  - "Ubah email" moves to directly under the address line.
  - The spam line becomes "Buka tautannya di HP ini. Tidak ada? Cek folder spam atau promosi."
  - After a resend the resend button reads "Terkirim" with a check for 3000ms, then the countdown.

**Depends on:** none. **Builder:** opus.

**States:** CodeInput empty / partial / full / verifying (not editable) / wrong (shake + message) / verified (ring). CheckEmail waiting (countdown) / ready / just resent ("Terkirim") / resend error (FormError) / no mascot (Dapur). Light and dark. 360dp width (codeSlotWidth already narrows).

- [ ] Step 1: Failing tests:
  - "maskPhone keeps 4 and 4"
  - "wrong code shows the message under the boxes"
  - "onFilled fires once for a code filled twice"
  - "verified ring renders with testID code-verified"
  - "Terkirim shows after resent and the countdown returns after 3s" (fake timers)
  - "open mail on Android calls IntentLauncher with APP_EMAIL" (mock `expo-intent-launcher`; `os` via `process.env.EXPO_OS`)
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS plus the full customer suite.
- [ ] Step 5: Commit `feat(mobile-ui): shared code entry and check-email with open-mail and resend confirmation`.

### Task 4: Reacting mascot and AuthOutcome

**Files:**
- Create: `packages/mobile-ui/src/brand/AuthMascot.tsx`, `packages/mobile-ui/src/AuthOutcome.tsx`; export both
- Modify: `packages/mobile-ui/src/AuthLayout.tsx:88-104` (`AuthHeading` gains `pose?: MascotPose`, default `"melambai"`; the mark renders `AuthMascot` instead of `StateArt`; `brand` still wins for Dapur)
- Test: `apps/customer/tests/auth-mascot.test.tsx`

**Interfaces:**
- `AuthMascot({ pose, base = AUTH_MARK }: { pose: MascotPose; base?: number })`
  - A mount draws the pose still.
  - A pose change uses `MascotArt`'s existing 200ms dissolve, plus one arrival gesture on the Catera ease (`nativeMotion.ease`):

    | Pose | Gesture |
    | --- | --- |
    | `bingung` | rotate 0→-6°→3°→0, 520ms |
    | `merayakan` | translateY 0→-16→0 with scaleY 0.98/1.02, 560ms |
    | `membaca` | translateY 4→-2→0, 480ms |
    | `mencari` | translateX 0→-6→5→0, 640ms |
    | `melambai` | rotate 0→2°→0, 520ms |

  - No loop, and no gesture when the pose is unchanged.
  - Reduced motion is an instant swap with no gesture. It is decorative: hidden from screen readers.
  - testID `auth-mascot-{pose}`.
- `AuthOutcome({ title, body, primary, secondary?, play }: { title: string; body: string; primary: { label: string; onPress(): void }; secondary?: { label: string; onPress(): void }; play: boolean })`
  - Wraps `SuccessBeat` (title, play, the body as children) with the primary `Button` pinned in `AuthScreen`'s `footer`.
  - testID `auth-outcome`.
  - The caller blocks back/swipe to the form: `usePreventRemove` or `router.replace` targets; the plan's Tasks 6 to 8 call `primary.onPress` on back.

**Depends on:** none. **Builder:** opus.

**States:**
- AuthMascot: mount, change to each of the 5 poses, the same pose again (no gesture), reduced motion.
- AuthOutcome: play true (beat), play false (resting), reduced motion, with and without secondary, light and dark, font scale 1.3 (the footer button stays reachable).

- [ ] Step 1: Failing tests:
  - "a pose change renders the new pose testID"
  - "the same pose again starts no animation" (spy on `withSequence`/`withTiming` count, or expose a `gestureCount` test hook via testID prop)
  - "reduced motion swaps without a gesture"
  - "AuthOutcome renders title, body and calls primary"
  - "AuthOutcome play=false shows the resting frame"
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS plus the full customer suite.
- [ ] Step 5: Commit `feat(mobile-ui): reacting auth mascot and AuthOutcome`.

### Task 5: Customer Masuk, Daftar, Pemulihan

**Files:**
- Modify: `apps/customer/src/account/Masuk.tsx`, `apps/customer/src/account/Register.tsx` (keep the uncommitted `EMAIL_REGISTERED` behaviour already in the tree; stage only your hunks), `apps/customer/src/account/Recover.tsx`
- Modify for C-1, the dark-mode white strips on the customer auth screens: find the cause in `AuthScreen` / `Screen` / `ScreenStatusBar` (compare with Dapur, which is correct) and fix it in shared code
- Test: `apps/customer/tests/auth-forms.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1 (`authError`, `OFFLINE`, `RATE_WAIT_S`, `savePending(…, email)`)
  - Task 2 (`useFieldCheck`, `PasswordRule`, `authFields`, `FormError action`)
  - Task 3 (`CodeInput` `error`/`verified`/`sentTo`)
  - Task 4 (`AuthHeading pose`)
- Behaviour:
  - Buttons are always enabled, except the code step (`code.length < 6`).
  - Masuk email checks: email empty or bad shape; password only for empty. Masuk phone checks the number. Daftar checks name (2+), email and password (8+), with a `PasswordRule` under the password. Pemulihan checks email.
  - Field outlines from server failures only for `INVALID_CREDENTIALS`, `PASSWORD_REJECTED`, `EMAIL_REGISTERED`, `EMAIL_NOT_CONFIRMED` and a wrong code. Never for `OFFLINE`, `AUTH_UNAVAILABLE` or `NOT_CONFIGURED` (S-5).
  - Wrong credentials clear the password and focus it. From the 2nd consecutive `INVALID_CREDENTIALS`, `FormError` gets the action "Lupa kata sandi?" (push `/recover` with `next`).
  - `EMAIL_NOT_CONFIRMED` gets the action "Kirim ulang tautan". It calls `auth.resend({type:"signup"})`, then shows `CheckEmail` in place for that address.
  - `EMAIL_REGISTERED` on Daftar gets the action "Masuk dengan email ini". It replaces to `/login` with `params {next, email}`, and Masuk prefills `email` on the Email tab.
  - `AUTH_RATE_LIMITED` starts a 60s countdown. The message is "Terlalu banyak percobaan. Coba lagi dalam {m:ss}.", and the primary button reads "Coba lagi dalam {m:ss}" and is disabled until 0.
  - `OFFLINE` gets "Coba lagi" via `retry`.
  - Mascot pose:

    | State | Pose |
    | --- | --- |
    | idle | `melambai` |
    | busy on the code check | `membaca` |
    | any field or credential failure | `bingung` |
    | `OFFLINE` | `mencari` |

    The pose returns to `melambai` on the next edit.
  - All fields use the `authFields` presets and a return-key chain.
- Spec copy: 3.3, section 7.

**Depends on:** 1, 2, 3, 4. **Builder:** opus.

**States:**
- Masuk (both tabs): empty / filled / invalid on submit / busy / wrong credentials ×1 and ×2 / unverified with resend / offline / rate limited (countdown) / code wrong / code verified. Light and dark × ID and EN.
- Daftar: empty / rule met / submit with errors / registered with action / sent (CheckEmail).
- Pemulihan: invalid / sent / resend.

Fixtures: Jest mocks of `runtime` and `supabase.auth`. On the emulator these are reachable only up to `NOT_CONFIGURED` (demo backend), which is a gate limit.

- [ ] Step 1: Failing tests:
  - "Masuk submit with a bad email shows the field message and sends nothing"
  - "second wrong password adds Lupa kata sandi?"
  - "unverified offers Kirim ulang tautan and opens CheckEmail"
  - "offline keeps typed values, outlines nothing, says Belum ada koneksi"
  - "429 shows a 60s countdown on the button" (fake timers: 0:59 → enabled at 0)
  - "Daftar registered email action opens Masuk with the email filled"
  - "Pemulihan stays neutral for an unknown email"
  - "mascot is bingung after a failure and melambai after the next edit"
  - "dark auth screen has no light strip" (assert the status/edge backgrounds use the theme canvas)
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS plus the full customer suite and typecheck.
- [ ] Step 5: Commit `feat(customer): inline validation and clear errors on sign-in, sign-up and recovery`.

### Task 6: Shared recovery and link screens; customer callback

**Files:**
- Create: `packages/mobile-ui/src/form/NewPasswordForm.tsx`, `packages/mobile-ui/src/form/ExpiredLink.tsx`, `packages/mobile-ui/src/form/RecoverForm.tsx` (the body of today's `Recover.tsx`, made app-neutral: `art?`, `onBack`, `redirectTo`, `next`)
- Modify: `apps/customer/src/account/AuthCallback.tsx`, `apps/customer/src/account/Recover.tsx` (now thin, built on `RecoverForm`)
- Test: `apps/customer/tests/auth-callback.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 4.
- `NewPasswordForm({ onSave }: { onSave(password: string): Promise<void> })`: two `PasswordField`s with shared shown state, a `PasswordRule` and `PasswordMatch`, `useFieldCheck`, and the button "Simpan kata sandi".
- `ExpiredLink({ email, purpose, onResend, onEnterEmail, onBack, art? })`:
  - With an email: the primary "Kirim tautan baru" (busy, one call per press).
  - Without one: the primary "Masukkan email".
  - The text button "Kembali ke Masuk".
  - The copy is spec section 7. No danger colour, and a single title.
- AuthCallback:
  - Fail fast: no `code`, `error` param, or no pending intent goes to expired at once, with no network call (C-3).
  - Recovery saves, then **stays signed in** (pick 3A). It calls `refresh()`, then shows `AuthOutcome` "Kata sandi diganti" / "Kamu sudah masuk dengan kata sandi baru." with "Lanjut", which calls `leaveFor(next)`.
  - Sign-up verified shows `AuthOutcome` "Email terverifikasi" / "Akunmu sudah siap, {nama}." with "Mulai", which calls `leaveFor(next)`.
  - The expired screen's resend uses the stored `purpose` (`auth.resend({type:"signup"})` or `resetPasswordForEmail`), then shows `CheckEmail`.
  - The screen has a close affordance (native header close, or the "Kembali ke Masuk" text button) and one title (C-2).

**Depends on:** 1, 2, 3, 4. **Builder:** opus.

**States:** checking / new password: empty, rule met, mismatch, match, busy, rejected / reset outcome (play) / verified outcome (play) / expired with email / expired without / resend busy / resend sent (CheckEmail) / resend offline. Light and dark × ID and EN.

- [ ] Step 1: Failing tests:
  - "mismatch shows Kata sandinya belum sama."
  - "save keeps the session and shows Kata sandi diganti" (no `signOut` call)
  - "verified shows Email terverifikasi with the name"
  - "expired with no pending intent offers Masukkan email and makes no request"
  - "Kirim tautan baru sends one recovery email for a double press"
  - "back from an outcome goes where Lanjut goes"
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS plus the full customer suite and typecheck.
- [ ] Step 5: Commit `feat(customer): new-password match, reset and verified outcomes, one-tap expired-link recovery`.

### Task 7: Dapur Masuk and Daftar

**Files:**
- Modify: `apps/caterer/src/auth/Masuk.tsx`, `apps/caterer/src/auth/Daftar.tsx`, `apps/caterer/src/useFormRun.ts` (add the failure `code`, so the field outline rule can read it)
- Test: `apps/caterer/tests/auth-dapur.test.tsx`

**Interfaces:**
- Consumes: Tasks 1 to 4.
- Masuk:
  - The shared `CodeInput` (`sentTo`, `error`, `verified`, auto-submit), `ResendButton` with a 60s timer, and "Ganti nomor".
  - `useFieldCheck` on number, email and password, with `authFields` presets and a return-key chain.
  - Per-button busy: the demo buttons spin themselves, not Masuk (D-6).
  - The S-5 outline rule; `OFFLINE`, rate-limit and wrong-credentials copy as in Task 5.
  - The S-6 fallback is no longer "Periksa nomor atau kodenya" for every failure. Use the server code's label, else "Ada gangguan di sisi kami. Coba lagi sebentar lagi."
- Daftar:
  - `useFieldCheck` on business name (3+), number and area. The area message sits under the chips and focus goes to the first chip.
  - The reason line is removed (pick 2A).
  - The shared `CodeInput` with a resend timer.
  - On success, `AuthOutcome` "Dapurmu siap" / "{nama usaha} sudah terdaftar. Mulai dengan menambah menu." with "Buka Hari ini", which calls `goToTab("index")`.
- No mascot on the Dapur forms (the wordmark stays). `AuthOutcome` uses `SuccessBeat`, as Dapur's publish beat does.

**Depends on:** 1, 2, 3, 4. **Builder:** opus.

**States:** Masuk phone: empty / bad number / code sent / wrong code / resend countdown / verified. Masuk email: empty / invalid / wrong ×2 / offline / rate limited. Daftar: empty submit (three messages) / code step / wrong code / kitchen outcome. Light and dark × ID and EN, 360dp at font scale 1.3.

- [ ] Step 1: Failing tests:
  - "Dapur code entry auto-submits on the sixth digit"
  - "resend waits 60s"
  - "demo button shows its own spinner"
  - "offline says Belum ada koneksi and outlines nothing"
  - "Daftar empty submit shows three messages and focuses the name"
  - "kitchen outcome says Dapurmu siap and opens Hari ini"
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS: `cd apps/caterer && npx jest --runInBand --testMatch "**/tests/**/*.test.tsx"`, plus typecheck.
- [ ] Step 5: Commit `feat(dapur): shared code entry, inline validation, clear errors and the kitchen-ready beat`.

### Task 8: Dapur password recovery

**Files:**
- Create: `apps/caterer/app/(auth)/pulihkan.tsx`, `apps/caterer/app/auth/callback.tsx`, `apps/caterer/src/auth/Pulihkan.tsx`, `apps/caterer/src/auth/AuthCallback.tsx`
- Modify: `apps/caterer/app/_layout.tsx:84-90` (register both screens; modal flow like the customer's `recover`; stage only your hunks, because the file has uncommitted changes), `apps/caterer/app/+native-intent.tsx` (let `catera-dapur://auth/callback?code=…` through, if it rewrites paths), `apps/caterer/src/auth/Masuk.tsx` (the "Lupa kata sandi?" text button under the password field)
- Test: `apps/caterer/tests/auth-recovery.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`redirectFor("catera-dapur")`, pending intent) and Task 6 (`RecoverForm`, `NewPasswordForm`, `ExpiredLink`, `AuthOutcome`).
- The Dapur callback handles recovery only. Dapur has no email sign-up, so any non-recovery intent goes to expired.
- After the save, `AuthOutcome` "Kata sandi diganti" with "Lanjut" calls `refresh()` then `goToTab("index")`. The role gate still applies.
- Owner action, recorded in the handoff: add `catera-dapur://auth/callback` to Supabase Redirect URLs.

**Depends on:** 6, 7. **Builder:** opus.

**States:** Pulihkan empty / invalid / sent / resend. Callback: checking / new password / mismatch / outcome / expired with and without email. Light and dark.

- [ ] Step 1: Failing tests:
  - "Masuk email tab links to Pulihkan"
  - "Pulihkan sends with redirect catera-dapur://auth/callback"
  - "callback recovery shows the new-password form and the outcome"
  - "a signup intent in Dapur goes to expired"
- [ ] Step 2: FAIL, Step 3: implement, Step 4: PASS plus the Dapur suite and typecheck.
- [ ] Step 5: Commit `feat(dapur): password recovery by email link`.

### Task 9: Gates, DESIGN.md, handoff (controller-run, Opus)

- [ ] Step 1: Run `npm run typecheck`, `npm test`, `npm run build`, and both app Jest suites, in the background. Record the counts.
- [ ] Step 2: Opus emulator gate (the environment rules are in the memory note on the emulator gate). Script-capture every flow from Tasks 5 to 8 in light and dark × ID and EN into `output/native-review/auth-2026-10-27/final/`, with one contact sheet per app, and tap-target and truncation checks by script. Reachable on the demo backend: field validation, offline (stop your own backend), the expired link (deep link with no intent), Dapur Masuk validation, and the sign-out persistence fix (S-1). Not reachable: Supabase-only states; mark them "Jest only". Also verify C-1 dark strips on a release APK if one is built for the owner; otherwise mark it unverified.
- [ ] Step 3: One Opus dispatch updates DESIGN.md with an "Auth experience (October 2026)" section: the validation rules, outcomes, mascot reactions, and shared components with paths. Stage only those hunks.
- [ ] Step 4: Write `docs/superpowers/handoffs/2026-10-27-auth-experience-handoff.md`. It records:
  - the commits
  - the rulings, including the narrowed 60s rate wait and pick 4B
  - the owner actions: the Supabase redirect URLs for both schemes, custom SMTP, an SMS provider
  - what was not verified: iOS, real email and SMS, TalkBack and VoiceOver
  - the next steps
