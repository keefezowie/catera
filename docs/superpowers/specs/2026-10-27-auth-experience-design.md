# Auth experience: validation, outcomes and recovery (both native apps)

Date: 2026-10-27. Branch `v2`. Status: **approved 2026-10-27**. Owner picks: 1A, 2A, 3A, 4B, 5A, 6A (section 11). Where a section offers a choice, the picked option is the contract; 4B means no sign-in toast (section 4 sign-in row and the signin.toast strings are dropped).

Inputs: the kickoff `docs/superpowers/kickoff/2026-10-27-auth-experience.md`, the device audit `docs/superpowers/research/2026-10-27-auth-current-state.md` (gap IDs C-n, D-n, S-n), and the pattern research `docs/superpowers/research/2026-10-27-auth-mobbin.md` (28 iOS apps; Mobbin had no Android screens). DESIGN.md stays the visual contract: palette, mascot, `FormError`, `Toast`, `SuccessBeat` and the four feedback sizes (beat, toast, micro, row motion) are reused, not redrawn. No new brand assets.

## 1. What is wrong today (summary)

Read from the code at `ce622f18`. The device audit gives the screenshots and the rest of the list.

1. **Buttons are disabled with no reason.** Every auth form keeps its primary button disabled until the input is valid and never says what is missing. The new-password form (`AuthCallback.tsx:118`) is the worst case: two passwords that differ leave a grey button and nothing else. Only Dapur Daftar has a reason line.
2. **No field ever shows its own message.** `Field` already supports `error`, but no auth screen passes one. Fields only turn red after a server failure, and the words then sit in one `FormError` below the form.
3. **Success is silent.** A reset password `router.replace`s to `/login` with nothing said. A verified email, a sign in, a sign up and a verified OTP all just leave the screen.
4. **The expired-link screen is a dead end.** It says to request a new link, then sends the person to retype their email on Pemulihan akun. It does not know whether the link was a sign-up or a recovery link.
5. **Being offline looks like a server problem.** A network failure maps to `AUTH_UNAVAILABLE` ("Belum bisa masuk sekarang"), and the rate limit message gives no wait time.
6. **"Email not confirmed" at sign in sends the person elsewhere.** The message says to resend the link "dari halaman Daftar" instead of offering the resend right there.
7. **Dapur has drifted from the customer app.** Its OTP is a plain `Field` with no auto-submit, no resend timer and no resend at all on Masuk. The fields have no return-key chain, and the email field lacks `autoCorrect={false}` and `maxLength`. There is no way to recover a forgotten password.
8. **Autofill hints are incomplete.** The customer fields set `autoComplete` but not `textContentType`, so iOS password managers get weaker hints. No form sets iOS `passwordRules`.

The device audit (84 captures, contact sheets in `output/native-review/auth-2026-10-27/`) confirmed the gaps above and found five more. All five are in scope for this build:

9. **S-1, demo builds only (P0 for demos):** sign out does not last. The demo sign-in endpoint sets a 24-hour `catera_v1_demo` cookie (`apps/web/src/app/api/v1/[...path]/route.ts:414`). `apps/web/src/lib/auth.ts:66` falls back to that cookie when no bearer token is sent. Native sign-out only deletes the stored token, so the next launch is signed in again. In Expo Go this even came back as another app's demo actor. **Fix:** native `signOut` calls the demo logout route (which already deletes the cookie, `route.ts:442`) when a demo token is held. The real Supabase path does not use the cookie.
10. **C-1 (P1):** in dark mode the customer auth screens draw white strips behind the status bar and the gesture bar, which hides the status icons. Dapur is fine. This was seen in Expo Go and is re-checked on an APK during the build.
11. **S-5 (P1):** a server, setup or offline failure outlines the person's fields in red, which says their input was wrong. **Fix:** only failures about a field (wrong credentials, a rejected password, a registered email, a wrong code) outline fields.
12. **C-2 / C-3 (P1, P2):** the link-error screen shows its title twice, has no close button, and offers "Pulihkan kata sandi" even when the link was a sign-up link. It also sits on "Memeriksa tautan…" for 5 to 10s first. **Fix:** section 7 replaces the screen, and the check fails fast when there is no pending intent or code (no network call).
13. **D-6 (P2):** a Dapur demo button puts its spinner on the main Masuk button. **Fix:** a per-button `waiting`, as the customer Masuk already does.

## 2. Principles

- **Say it where it happened.** A problem with one field is written under that field. A problem with the request (wrong password, offline, rate limit) goes in the existing `FormError` directly above the primary button.
- **Never make people guess.** The primary button stays enabled. Pressing it with a problem shows every field message, moves focus to the first one, and says how many there are. The one exception is the 6-digit code, where the reason is obvious (owner choice 2 may change this rule).
- **Every flow ends with an answer.** Each flow's last step says what happened and what comes next, in the feedback size that fits: a beat for a milestone, a toast for a routine outcome, a micro for the control itself.
- **One component, both apps.** Shared pieces live in `packages/mobile-ui`, shared email-auth logic in `packages/mobile-core`. App code only wires routes and copy that differs (mascot vs the "Catera Dapur" wordmark).
- **Neutral recovery.** Recovery never reveals whether an address has an account. Sign up does ("Email ini sudah terdaftar"), which is an accepted trade-off.

## 3. Inline validation

### 3.1 When it fires

| Moment | What happens |
| --- | --- |
| Typing for the first time | Nothing. No red while someone is still typing. |
| Leaving a field (blur) with text in it | The field is checked. If it is wrong, its message appears under it and the outline turns danger. An empty field left on blur stays quiet. |
| Typing in a field that shows a message | It is checked on every change, so the message clears the moment the input is right. |
| Pressing the primary button | Every field is checked, empty ones included. If any is wrong: the messages show, focus moves to the first wrong field (scrolled above the keyboard), nothing is sent, the `error` haptic fires once, and a screen reader hears "{n} isian perlu diperbaiki" / "{n} fields need fixing". |
| A server failure about a field | The field gets the outline (`invalid`). The sentence goes in `FormError` above the button, as today. |

Sign-in password fields are only checked for being empty, never against the rules. Someone with an old 6-character password must still be able to sign in.

### 3.2 Placement and look

- The message sits directly under the field in place of the hint. It uses the `caption` size in `danger`, with a 16 `alert-circle` glyph in front so colour is not the only cue. It is `selectable` and in a polite live region. This means `Field`'s existing `error` line gains a glyph. No other screen passes `error` with a glyph yet, so nothing else changes.
- A hint that states a rule (for example "Minimal 8 karakter") stays visible until a message replaces it, and comes back once the message clears.
- The outline goes back to `fieldBorder` once the field is valid. There is no green outline, because a green field reads as a second accent. A valid confirm field shows the match line instead (3.4).

### 3.3 Field rules and wording

Every string comes in Indonesian / English. The Indonesian sounds like a person and uses "kamu" in both apps, matching the existing auth copy.

| Field (screens) | Rule | Message |
| --- | --- | --- |
| Nama (customer Daftar) | trimmed, at least 2 letters | "Tulis namamu, minimal 2 huruf." / "Enter your name, at least 2 letters." |
| Nama usaha katering (Dapur Daftar) | trimmed, at least 3 letters | "Tulis nama usahamu, minimal 3 huruf." / "Enter your business name, at least 3 letters." |
| Email (all) | empty on submit | "Isi emailmu dulu." / "Enter your email first." |
| Email (all) | not the shape `a@b.c` | "Format email belum benar. Contoh: nama@gmail.com" / "That email doesn't look right. Example: name@gmail.com" |
| Nomor HP / WhatsApp (all) | empty on submit | "Isi nomor HP-mu dulu." / "Enter your phone number first." |
| Nomor HP / WhatsApp (all) | fewer than 9 digits, or more than 15 | "Nomor HP belum lengkap. Contoh: 0812 3456 7890" / "That number looks incomplete. Example: 0812 3456 7890" |
| Kata sandi, sign in | empty on submit | "Isi kata sandimu dulu." / "Enter your password first." |
| Kata sandi, sign up and new | fewer than 8 characters | the rules line turns into the message (3.4) |
| Ulangi kata sandi (if kept, choice 1) | differs from the first | "Kata sandinya belum sama." / "The passwords don't match." |
| Lokasi dapur (Dapur Daftar chips) | none picked on submit | "Pilih satu lokasi dapur." / "Choose a kitchen area." (under the chips; focus moves to the first chip) |
| Kode dari SMS (both) | wrong code from the server | "Kodenya salah. Cek SMS-nya, lalu coba lagi." / "That code is wrong. Check the SMS and try again." (under the boxes, see 6) |

### 3.4 Password rules and match

- One rule exists on the server, at least 8 characters (Supabase's minimum; `weak_password` and `same_password` come back as `PASSWORD_REJECTED`). Catera shows only that rule. Rules the backend does not enforce are never shown.
- **Rules line** (`PasswordRules`, new in mobile-ui) sits under the password field from the start: a 16 glyph and "Minimal 8 karakter" / "At least 8 characters". It starts muted with an empty ring. When the rule is met it becomes a `forest` check with the same words, and a screen reader hears "Syarat kata sandi terpenuhi" / "Password requirement met" once. After a blur or submit while short, the same line turns `danger` with the alert glyph. It is one line, not a coloured strength bar, so it needs no colour to read.
- **Match line** (only if choice 1 keeps the confirm field): under the confirm field. It stays quiet until the confirm field has as many characters as the first field, or is left on blur. Then it shows a `forest` check with "Kata sandinya sama" / "Passwords match", or the danger message from 3.3. It updates on every change after that, so fixing either field clears it. Toggling show/hide on one field toggles both, so the person can compare them.
- A server `PASSWORD_REJECTED` keeps today's sentence in `FormError` and outlines the password field.

### 3.5 Shared mechanics

`useFieldCheck` (new hook in mobile-ui) holds, per field, whether it has been touched and its message. It takes a map of `{ value, check(value) => message | "" }` and returns `fieldProps(name)` (adds `error`, `onBlur`, `inputRef`) and `submit(action)`. `submit` checks everything, focuses the first wrong field, announces the count, and runs the action only when everything is clean. Both apps use it. `useAction` (customer) and `useFormRun` (Dapur) stay for server failures. Merging those two hooks is out of scope.

## 4. Outcome for every flow

| Flow | Today | New |
| --- | --- | --- |
| Sign in, email or phone (both apps) | Screen closes, nothing said | Unchanged: straight in, no toast (owner pick 4B). On phone sign-in the OTP check micro below is the only acknowledgement; the screen closes before any mascot pose would show |
| Sign up with email (customer) | `CheckEmail`, then the link verifies and leaves silently | `CheckEmail` (5), then the link opens the **verified outcome**: a success beat "Email terverifikasi" / "Email verified", one line "Akunmu sudah siap, {nama}." / "Your account is ready, {name}.", and a primary button "Mulai" / "Get started" that goes to `next` |
| Sign up with phone (Dapur Daftar) | Lands on Hari ini | Success beat "Dapurmu siap" / "Your kitchen is ready", one line "{Nama usaha} sudah terdaftar. Mulai dengan menambah menu." / "{Business name} is registered. Start by adding a menu.", primary "Buka Hari ini" / "Open Today" |
| Password reset done (both, see 8) | `router.replace("/login")`, silent | **Reset outcome**: a success beat "Kata sandi diganti" / "Password changed", a line and a primary button that depend on owner choice 3 |
| OTP verified (both) | Leaves | The six boxes turn to a `forest` ring with a check for 400ms (a micro, still under reduced motion), then the sign-in or sign-up outcome above |
| Resend link or code | "Terkirim lagi" caption (customer only) | Kept, and the line is announced. Dapur gets the same |
| Recovery link sent | `CheckEmail` | Unchanged apart from 5 |

**AuthOutcome** (new in mobile-ui) is the full-screen confirmation used by the verified, reset and Dapur-kitchen outcomes. It wraps the existing `SuccessBeat`: a title (the screen's one heading, announced once), one line of facts, one primary button, and optionally one text button. It plays only on the transition into success, like Bayar. Reopening the route later shows the resting frame. Reduced motion shows the still `merayakan` mascot. Dapur already uses `SuccessBeat` for "Paket diterbitkan", so a mascot beat is within Dapur's contract. Back or swipe from an outcome goes to where the primary button goes, never back into the form.

## 5. "Cek emailmu" (shared)

`CheckEmail` moves from `apps/customer/src/account` to mobile-ui. Dapur passes no mascot art. What changes:

- **Order:** mascot, the title "Cek emailmu", the intro sentence with the address in bold, then "Ubah email" / "Change email" as a text button right after the address, so a typo is fixed where it is seen.
- **Primary:** "Buka aplikasi email" / "Open email app". On Android it opens the mail app chooser (an `ACTION_MAIN` / `CATEGORY_APP_EMAIL` intent through `expo-intent-launcher`, or `mailto:` as a fallback). On iOS it opens `message://`. If no app opens, the screen stays as it is.
- **Resend:** a 60s cooldown, as today, with the time in tabular figures: "Kirim ulang dalam 0:42" / "Resend in 0:42", then "Kirim ulang tautan". After a resend the button reads "Terkirim" with a check for 3s, the caption "Terkirim lagi. Cek emailmu." is announced, and the timer restarts. A rate-limited resend shows the wait from the server, falling back to 60s (7).
- **Spam hint:** "Tidak ada? Cek folder spam atau promosi." / "Nothing there? Check spam or promotions."
- **Link and phone:** "Buka tautannya di HP ini." stays, because PKCE ties the link to this phone.

## 6. Code entry (shared)

`CodeInput`, `ResendButton` and `useResendTimer` move from the customer app to mobile-ui. Dapur Masuk and Daftar switch to them, so both apps get the same boxes, SMS autofill, auto-submit on the sixth digit, the 60s resend timer and "Ganti nomor". A wrong code clears the boxes, keeps focus, and shows the message under the boxes, not only in `FormError`. The boxes shake once (8dp, 3 cycles, 300ms, skipped under reduced motion) and the `error` haptic fires. After 3 wrong codes the message adds "Belum dapat kodenya? Kirim ulang." with the resend button. The number the code went to is written above the boxes ("Kode dikirim ke 0812 •••• 7890" / "Code sent to 0812 •••• 7890"). Phone OTP can only be tested in demo mode and in Jest, because the hosted project has no SMS provider.

## 7. Errors

| Case | Detection | Message (in `FormError` unless noted) |
| --- | --- | --- |
| Wrong email or password | `INVALID_CREDENTIALS` | "Email atau kata sandinya salah." / "Wrong email or password." Keep the email, clear the password and focus it. From the second failure in a row, `FormError` gets a text action "Lupa kata sandi?" |
| Email not verified | `EMAIL_NOT_CONFIRMED` | "Emailmu belum diverifikasi." / "Your email isn't verified yet." with a text action "Kirim ulang tautan" that resends right there and opens `CheckEmail` for that address. The shared `errorLabel` stops pointing to "halaman Daftar" |
| Offline | a fetch error with no HTTP status (`AuthRetryableFetchError`, status 0, or a `TypeError` from fetch) maps to a new code `OFFLINE` | "Belum ada koneksi. Cek internetmu, lalu coba lagi." / "No connection. Check your internet and try again." with "Coba lagi" (retry). Typed values stay |
| Rate limited | HTTP 429 | "Terlalu banyak percobaan. Coba lagi dalam {m:ss}." / "Too many tries. Try again in {m:ss}." The time is a live countdown (from `Retry-After` when present, otherwise 60s). The primary button reads the countdown and is disabled until it ends. On sign in, "Lupa kata sandi?" stays reachable |
| Server or unknown | anything else | "Ada gangguan di sisi kami. Coba lagi sebentar lagi." / "Something went wrong on our side. Try again in a moment." with "Coba lagi" |
| Email already registered (sign up) | as today | Kept. Adds a text action "Masuk dengan email ini" that opens Masuk with the email filled in |

**Expired or used link** (AuthCallback's error phase) becomes its own screen:

- The pending intent gains the email address (`Pending.email`, kept in SecureStore on this phone only), so the screen knows the purpose and the address.
- Title: "Tautannya sudah tidak berlaku" / "This link no longer works". Line: "Tautan hanya berlaku 1 jam, sekali pakai, dan di HP yang memintanya. Kami bisa kirim yang baru ke {email}." / "Links last 1 hour, work once, and only on the phone that asked for them. We can send a new one to {email}."
- Primary: "Kirim tautan baru" / "Send a new link". This is a one-tap resend of the same purpose (sign-up resend, or recovery), which then opens `CheckEmail`. With no stored email (a link opened on another phone), the primary is "Masukkan email" / "Enter email" and goes to the right form.
- Text button: "Kembali ke Masuk" / "Back to sign in".
- The "reading" mascot (customer) or nothing (Dapur). No danger red: nothing the person did was wrong.

## 8. Dapur password recovery (owner choice 5)

Dapur email accounts exist (an email can be added in Data akun, and Masuk has an Email tab), so a forgotten password currently has no way back except signing in by WhatsApp. Recommended: Dapur gets the same recovery as the customer app:

- "Lupa kata sandi?" under the Email tab password field.
- `/(auth)/pulihkan` (Recover), `/auth/callback` (new password, outcome, expired link), all built from the shared pieces. The email-auth logic (`emailAuth.ts`: pending intent, PKCE exchange, error mapping) moves to `packages/mobile-core` and takes the app's redirect URL.
- The redirect is `catera-dapur://auth/callback`. **Owner action:** add it to Supabase Auth, URL Configuration, Redirect URLs, next to `catera://auth/callback`.
- After a reset, a Dapur account that is not a caterer member still meets the existing role gate.

The alternative is a hint under the password field, "Lupa kata sandi? Masuk pakai nomor WhatsApp, lalu ganti di Data akun." This is cheaper, but it fails for an owner whose email is the only sign-in method.

## 9. Busy, keyboard, autofill, accessibility, motion

- **Busy:** the pressed button shows its spinner and busy label, the fields become non-editable, and a second press is ignored (as today). The layout does not move.
- **Keyboard:** every form chains its return keys (`next` until the last field, then `go`, which runs `submit`). Dapur gets this too. `AuthScreen` keeps its existing keyboard room and reveal-on-failure scroll. `submit` scrolls the first wrong field into view above the keyboard. Taps on the form use `keyboardShouldPersistTaps="handled"`.
- **Autofill:** email fields use `textContentType="emailAddress"` and `autoComplete="email"`. Sign-in password fields use `password` and `current-password`. New and sign-up passwords use `newPassword` and `new-password`, plus iOS `passwordRules="minlength: 8;"`. Codes use `oneTimeCode` and `sms-otp`. Phone fields use `telephoneNumber` and `tel`. Name fields use `name`. Both apps get the same props through shared field presets.
- **Accessibility:** every input keeps its label (no placeholder-only fields). Field messages are part of the field's accessibility hint, so a screen reader reads the label, the value and the message together, and the message is announced when it appears. Show/hide stays a 48 target with "Tampilkan kata sandi" / "Sembunyikan kata sandi". The outcome title is announced once. Focus order follows the visual order: heading, method tabs, fields, `FormError`, primary button, secondary actions.
- **Motion:** the error shake, the OTP check micro and the outcome beat all have reduced-motion versions (none, an instant ring, and the still mascot). Toasts are instant under reduced motion, as today.

## 10. Copy reference

All new strings in one place for the plan. Existing strings that are kept are not repeated.

| Key | Indonesian | English |
| --- | --- | --- |
| fix.count | {n} isian perlu diperbaiki | {n} fields need fixing |
| pw.rule | Minimal 8 karakter | At least 8 characters |
| pw.ruleMet.a11y | Syarat kata sandi terpenuhi | Password requirement met |
| pw.match | Kata sandinya sama | Passwords match |
| pw.mismatch | Kata sandinya belum sama. | The passwords don't match. |
| signin.toast | Selamat datang lagi, {nama}. | Welcome back, {name}. |
| signin.toast.noname | Kamu sudah masuk. | You're signed in. |
| verified.title | Email terverifikasi | Email verified |
| verified.body | Akunmu sudah siap, {nama}. | Your account is ready, {name}. |
| verified.cta | Mulai | Get started |
| reset.title | Kata sandi diganti | Password changed |
| reset.body.A | Kamu sudah masuk dengan kata sandi baru. | You're signed in with your new password. |
| reset.cta.A | Lanjut | Continue |
| reset.body.B | Masuk lagi dengan kata sandi barumu. | Sign in again with your new password. |
| reset.cta.B | Masuk | Sign in |
| kitchen.title | Dapurmu siap | Your kitchen is ready |
| kitchen.body | {usaha} sudah terdaftar. Mulai dengan menambah menu. | {business} is registered. Start by adding a menu. |
| kitchen.cta | Buka Hari ini | Open Today |
| code.sentTo | Kode dikirim ke {nomor} | Code sent to {number} |
| code.wrong | Kodenya salah. Cek SMS-nya, lalu coba lagi. | That code is wrong. Check the SMS and try again. |
| code.wrong3 | Belum dapat kodenya? Kirim ulang. | Didn't get the code? Resend it. |
| mail.spam | Tidak ada? Cek folder spam atau promosi. | Nothing there? Check spam or promotions. |
| mail.sent | Terkirim | Sent |
| link.title | Tautannya sudah tidak berlaku | This link no longer works |
| link.body | Tautan hanya berlaku 1 jam, sekali pakai, dan di HP yang memintanya. Kami bisa kirim yang baru ke {email}. | Links last 1 hour, work once, and only on the phone that asked for them. We can send a new one to {email}. |
| link.cta | Kirim tautan baru | Send a new link |
| link.cta.noEmail | Masukkan email | Enter email |
| err.offline | Belum ada koneksi. Cek internetmu, lalu coba lagi. | No connection. Check your internet and try again. |
| err.rate | Terlalu banyak percobaan. Coba lagi dalam {m:ss}. | Too many tries. Try again in {m:ss}. |
| err.server | Ada gangguan di sisi kami. Coba lagi sebentar lagi. | Something went wrong on our side. Try again in a moment. |
| err.unverified | Emailmu belum diverifikasi. | Your email isn't verified yet. |
| err.unverified.action | Kirim ulang tautan | Resend link |
| err.registered.action | Masuk dengan email ini | Sign in with this email |

The field messages are in 3.3.

## 11. Owner choices (needed before the build; canvas https://claude.ai/artifact/JekWVZZYavVKCXhVqK5zo9)

1. **New password: one field or two?**
   - **A (recommended):** keep the confirm field and add the live match line (3.4). This is what you asked for, and it guards against a typo in a password nobody can see.
   - **B:** one field with show/hide and the rules line, as the research's best apps do (BlaBlaCar, Airbnb). This removes the mismatch case entirely.
2. **Primary buttons: enabled or disabled?**
   - **A (recommended):** always enabled. A press with problems shows the messages and focuses the first one. The 6-digit code is the one exception.
   - **B:** stay disabled, with a reason line under the button, like Dapur Daftar today.
3. **After a password reset:**
   - **A (recommended):** stay signed in. The recovery link is already a real session, so the beat says "Kamu sudah masuk dengan kata sandi baru." with "Lanjut". This saves a full sign-in.
   - **B:** sign out, as today. The beat says "Masuk lagi..." and "Masuk" opens Masuk with the email filled in.
4. **After sign in:**
   - **A (recommended):** a welcome-back toast on the page underneath.
   - **B:** straight in with nothing, as Gojek and Grab do.
5. **Dapur password recovery:**
   - **A (recommended):** build it from the shared pieces (section 8). You add `catera-dapur://auth/callback` to Supabase.
   - **B:** only a hint to sign in with WhatsApp.

6. **Mascot that reacts to the state** (the owner's idea, 2026-10-27; playable on the canvas, board 6):
   - **A (recommended):** the auth mascot changes pose when the state changes and stays still otherwise. There is no idle loop. The mapping uses only the seven approved stills:

     | State | Pose |
     | --- | --- |
     | ready | `melambai` |
     | checking a code or link | `membaca` |
     | wrong code, wrong password, expired link | `bingung` |
     | offline | `mencari` |
     | verified, password changed, kitchen ready (outcome beats) | `merayakan` |
     | check email | `membaca` (as today) |

     The transition reuses `MascotArt`'s existing 200ms cross-dissolve. On top of it, each pose plays one short gesture on arrival, all on the Catera ease and at most 640ms:

     | Pose | Gesture on arrival |
     | --- | --- |
     | `bingung` | a 6° tilt and settle |
     | `merayakan` | a 16dp hop with squash (the success rig's hop where the rig is shown) |
     | `membaca` | a small lean in |
     | `mencari` | a look left and right |
     | `melambai` | a small rock |

     Reduced motion swaps the still instantly with no gesture. It works because the poses share one silhouette (the same lunchbox and lid), so the dissolve reads as a change of face and arm, not a slideshow.
   - **B:** keep one still per screen, as today.
   - Limits:
     - The stills are separate illustrations, not one rig, so there is no true limb animation between poses. That would need layered artwork per pose, a new brand asset only you can generate.
     - On sign-in and sign-up forms the mark collapses while the keyboard is up (`AuthHeading`, `ce622f18`). An error that arrives with the keyboard still open therefore changes the pose out of sight. The reaction is fully visible on the keyboard-free screens: Cek emailmu, the link check, the expired link, the outcomes, and a form once the keyboard is closed.
     - Dapur has no mascot on its auth screens (the "Catera Dapur" wordmark); 6A applies only to the customer app unless you want the mascot in Dapur too.

Not taken from the research, so the owner can see what was left out:

- Letting people browse without a verified email. Email confirmation stays on, a backend decision.
- A WhatsApp resend channel. There is no SMS or WhatsApp provider yet.
- A welcome screen before Masuk.
- A WhatsApp support link on stuck states. This needs a support number that has not been decided.

## 12. Build outline (for writing-plans after the picks)

1. mobile-ui:
   - `Field` error glyph
   - `useFieldCheck`
   - `PasswordRules` (+ match line)
   - `AuthOutcome`
   - `CheckEmail`, `CodeInput`, `ResendButton`, `useResendTimer` moved in (customer imports updated)
   - `FormError` text action (exists as `retry`, gains a label)
   - field presets
2. mobile-core: the email-auth module (pending intent with email, PKCE exchange, `authError` with `OFFLINE`, 429 wait), parameterised by redirect URL. The `errorLabel` wording for `EMAIL_NOT_CONFIRMED` and the new `OFFLINE` goes in `packages/domain`.
3. Customer screens: Masuk, Daftar, Pemulihan, AuthCallback (new password, verified outcome, reset outcome, expired link), sign-in toast.
4. Dapur screens: Masuk (shared code entry, resend, return keys, validation), Daftar (validation, shared code entry, kitchen beat), recovery routes if choice 5A.
5. Tests per state in both apps' Jest suites:
   - mismatch and match line
   - rules line
   - submit focus and count
   - each outcome screen
   - expired link with and without stored email
   - resend cooldown and "Terkirim"
   - wrong code ×1 and ×3
   - offline and 429 countdown
   - unverified-email resend action
   - registered-email action
   - sign-in toast with and without a name
6. Gates: typecheck, test, build, both app Jest suites, emulator pass over every flow in light, dark, ID and EN, and DESIGN.md updated by one dispatch at the end.

Not verifiable in this phase: iOS (no Mac), real email delivery (built-in mailer, no custom SMTP), real SMS (no provider), and the new-password and verified states against the hosted project. Those are reached in Jest and, on the emulator, through a test-only route parameter in demo builds that is never compiled into a release.
