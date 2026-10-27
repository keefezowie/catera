# Auth current state — emulator gate, 2026-10-27

Branch `v2`, main tree. Android emulator `emulator-5554` (Pixel 8, API 36, 1080x2400, density 420 = 2.625 px/dp), Expo Go.
Customer Metro :8081, Dapur Metro :8082, both `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100`, no CI mode.
Backend: own demo backend (`PORT=3100 CATERA_V1_DEMO=true CATERA_DEMO_DATA_DIR=.data/auth-gate CATERA_NEXT_DIST_DIR=.next-x npm run dev`) on a copy of `.data/polish-gate-2026-10-26`. The owner's :3000 was not touched.

Captures: `output/native-review/auth-2026-10-27/current/{customer,dapur}/NN-screen-state-theme-lang.png` (48 customer, 36 Dapur). Contact sheets: `output/native-review/auth-2026-10-27/contact-customer.png`, `contact-dapur.png`. Text and tap-target checks came from `uiautomator dump`.

## What the gate could and could not exercise

- Neither app has `EXPO_PUBLIC_SUPABASE_*` set for the demo backend (customer `.env.local` only sets the API URL), so `runtime.supabase` is null. Every Supabase path (phone OTP send/verify, email sign-in, sign-up, recovery) fails before the network with `NOT_CONFIGURED`, which shows as **"Fitur ini belum siap. Hubungi Catera." / "This isn't set up yet. Contact Catera."** That is the error captured for those flows. Phone OTP was not tried against the hosted project (no SMS provider), per brief.
- So the OTP code step (customer `CodeInput`, resend timer; Dapur code `Field`), wrong-OTP, rate limit, CheckEmail, AuthCallback success and the recovery new-password form were **not reachable at runtime**. Findings about them below are from source and are marked "source".
- Demo sign-in (`auth/demo`) worked and is the only real "success" path observed.
- Offline = my backend stopped (not airplane mode).
- Theme: both apps default to "Ikuti sistem", so `cmd uimode night yes|no` was used. Language: Pengaturan → Bahasa (customer Pengaturan is reachable signed out from Akun; Dapur needs a signed-in session). Both apps were set back to Indonesian at the end.

## Gaps

Severity: P0 blocks or misleads, P1 clearly below a top-app bar, P2 polish.

### Shared (S)

| ID | Screen | State | What happens | Why it falls short | Sev | Evidence |
|---|---|---|---|---|---|---|
| S-1 | Pengaturan → Keluar, both apps | sign-out, then app relaunch | After Keluar the app shows Masuk. Reopening the project (or a deep link / config change that relaunches the activity) puts the user straight back into the signed-in app. In Expo Go the **customer app came back signed in as the Dapur owner "Arini — Dapur Senja"**. Cause: `POST /api/v1/auth/demo` sets an HttpOnly `catera_v1_demo` cookie (24 h); `runtime.signOut()` only deletes the SecureStore token; the native cookie jar keeps the cookie and the API accepts it. | Sign-out does not sign out, and one app's identity leaks into the other. Demo mode only as far as observed; the Supabase bearer path was not testable. Check whether any hosted/pilot build runs on demo auth. | P0 (demo builds) | dapur/33, dapur/34, dapur/31, dapur/32, customer/49 |
| S-2 | Every form | invalid input | The primary button is greyed (`disabled`) with no reason: short phone (C 02, D 02), bad email on Recover (C 11), bad email or short password on Daftar (C 15, C 16). Only Dapur Daftar prints a reason line ("Lengkapi … dulu."). Disabled buttons are also not focusable/explainable to TalkBack. | Suspicion confirmed. The user has to guess what is wrong. | P1 | customer/02, 11, 15, 16; dapur/02 |
| S-3 | Masuk email tab, Recover, Daftar email | blur with bad email | No inline validation on blur or submit-attempt; "budi@contoh" sits in the field with no message. | Suspicion confirmed. | P1 | customer/06, dapur/06 |
| S-4 | Masuk email tab, both apps | bad email + 3-char password | "Masuk" is **enabled** (`!!email && !!password`) while Recover/Register gate on `validEmail` and length. Same email field, different rules. | Inconsistent gating; the user only learns from a server round trip. | P2 | customer/07, dapur/07 |
| S-5 | All forms | server/config error | Any failure paints the user's inputs red (`invalid={!!error}`): phone field (C 04, D 04), both email+password fields (C 08, D 08), Recover email (C 13), offline demo (D 28 paints the empty phone field red). | Red fields say "your input is wrong" when the fault is ours (not configured, offline). | P1 | customer/04, 08, 13; dapur/04, 08, 28 |
| S-6 | Masuk, both apps | offline (backend stopped) | Customer: "Belum bisa masuk. Coba lagi." Dapur: "Belum bisa masuk. Periksa nomor atau kodenya, lalu coba lagi." (also used for the email tab and demo buttons). Error after ~3 s. | Neither says "no connection"; Dapur blames the number/code the user never entered. | P1 | customer/48, dapur/28 |
| S-7 | Masuk → home, both apps | success | Demo sign-in drops the user on the home tab skeleton with no confirmation (no greeting, toast or name). Source: real `finish()` paths (`signedIn` → `leaveFor`/`goToTab`) and AuthCallback sign-up verification (`leaveFor(next)`) do the same. | Suspicion confirmed for demo; source for real paths. | P2 | customer/24, 25; dapur/15, 16 |
| S-8 | Masuk | phone tab after error | `"Fitur ini belum siap. Hubungi Catera."` is shown to everyone when Supabase is not configured. Fine as a misconfig guard, but it appears on every auth action in the demo build, including Register and Recover, which a demo user cannot complete at all. | Demo builds advertise flows that cannot work; no hint to use the demo button. | P2 | customer/04, 13, 18; dapur/13 |

### Customer (C)

| ID | Screen | State | What happens | Why it falls short | Sev | Evidence |
|---|---|---|---|---|---|---|
| C-1 | Masuk, Recover, Register (modal) | dark mode | The status bar strip and the gesture-nav strip render **white** over the dark screen; status icons are invisible. Reproduced on cold start in dark mode with in-app navigation. Dapur auth screens are fine in dark. | Broken dark theme on every customer auth screen. Expo Go only so far; confirm on an APK. | P1 | customer/34, 44, 45, 46 (also 28, 29, 33, 35) |
| C-2 | AuthCallback | error | Title shows twice (native header "Verifikasi akun" plus the display heading); no close/back control unlike the other auth screens; the primary action is "Pulihkan kata sandi" even for a sign-up verification link; copy does not say which kind of link failed. | Confusing dead end for the sign-up case. | P1 | customer/20, 21, 22 |
| C-3 | AuthCallback | checking | With no code, or `error=access_denied`, the page sits on "Memeriksa tautan…" for ~5–10 s before the error (measured ~10 s once, faster on a fresh mount). No spinner, only text. The no-code case could fail without waiting. | Feels hung. | P2 | customer/30, 36, 42 |
| C-4 | AuthCallback recovery | confirm mismatch | Source: "Simpan kata sandi & masuk" stays disabled while `password !== confirm`; only the static hint "keduanya harus sama". No mismatch message. | Suspicion confirmed from source; not reachable at runtime. | P1 | source `AuthCallback.tsx` |
| C-5 | AuthCallback recovery | success | Source: after `updateUser` it signs out and `router.replace('/login')` with no message; the user then has to sign in again despite the button saying "Simpan kata sandi & masuk". | Suspicion confirmed from source; label promises a sign-in that doesn't happen. | P1 | source `AuthCallback.tsx` |
| C-6 | Recover | open from Masuk | Email typed on the Masuk email tab is not carried over; "Kembali ke Masuk" returns to the phone tab, so the typed email is gone. | Extra typing on the most stressful flow. | P2 | customer/09 → 10 |
| C-7 | Register | password | Single password field, static hint "Minimal 8 karakter", no live count/feedback; button just stays disabled at 6 chars. | See S-2; no confirm field either (fine if show/hide is the chosen pattern, but say why the button is off). | P2 | customer/16 |
| C-8 | Masuk | loading | The demo button shows its own spinner (good); the 1st frame after the tap shows no feedback yet. | Fine; noted for parity with D-6. | — | customer/23, 24, 47 |

### Dapur (D)

| ID | Screen | State | What happens | Why it falls short | Sev | Evidence |
|---|---|---|---|---|---|---|
| D-1 | Masuk email tab | any | No "Lupa kata sandi?" link and no recovery screen in the app. | Suspicion confirmed. An email owner who forgets the password is locked out. | P1 | dapur/05 |
| D-2 | Masuk / Daftar | sign-up model | Masuk offers an Email tab, but Daftar is phone-only; there is no way to create or recover an email account from Dapur. | Email sign-in is a door with no path to it. | P1 | dapur/05, 09 |
| D-3 | Masuk phone | code step | Source: OTP uses a plain `Field` (maxLength 6, `sms-otp`), no `CodeInput`, no auto-verify on the 6th digit, **no resend and no cooldown**. Daftar has "Kirim ulang kode" but no cooldown timer. Customer has CodeInput, auto-submit, 60 s resend timer and "Ganti nomor". | Suspicions confirmed from source; code step not reachable at runtime (NOT_CONFIGURED). | P1 | source `caterer/src/auth/Masuk.tsx`, `Daftar.tsx` |
| D-4 | Masuk phone | empty | Tab says "Nomor HP", field says "Nomor WhatsApp", no placeholder/format example (customer shows "0812…"). | Mixed naming; no format hint. | P2 | dapur/01 |
| D-5 | Daftar | chips | Area chips measure 34dp tall in uiautomator (source says 7dp hitSlop above/below reaches 48; hitSlop is not visible to uiautomator so not verified). | Flag for a manual check. | P2 | dapur/09 |
| D-6 | Masuk | demo loading | Tapping "Masuk sebagai pemilik" puts the spinner on the main "Masuk" button, not the demo button pressed; both demo buttons go disabled. | Feedback on the wrong control. | P2 | dapur/15 |
| D-7 | Daftar | header | Uses the native stack header ("Daftar" + back arrow) and a separate "Kelola katering dari satu HP" title; no "Sudah punya akun? Masuk" switch. | Drift from Masuk and from the customer Register layout. | P2 | dapur/09 |
| D-8 | Daftar | error | Error renders at the bottom of the scroll body, far from the pinned footer button that triggered it. | Easy to miss with the keyboard up. | P2 | dapur/13 |

## Tap targets (uiautomator bounds, 2.625 px/dp)

All auth buttons, fields, tabs and text links are ≥48dp (fields/buttons 379x50, Tutup 48x48, Email tab 50x48, "Daftar"/"Masuk" links 56x50, "Lupa kata sandi?" 131x50). Under 48dp: Dapur Daftar area chips 34dp tall (D-5). The 36x48 ViewGroup inside the customer Tutup button is nested in a 48x48 parent, not a gap.

## Drift between the apps

- OTP entry: customer `CodeInput` + auto-verify + 60 s resend timer; Dapur plain field, no resend on Masuk, resend without timer on Daftar.
- Recovery: customer has Recover + AuthCallback; Dapur has none.
- Sign-up: customer email/password with verification link; Dapur phone OTP + business details. Dapur Masuk still offers email.
- Header: customer mascot + close X (modal); Dapur "Catera Dapur" brand line, no mascot, no close on Masuk, native stack header on Daftar.
- Disabled reason line: only Dapur Daftar.
- Generic error copy differs (S-6). Error container placement differs (D-8).
- Phone field: "Nomor HP" + "0812…" vs "Nomor WhatsApp", no placeholder.
- Email field props (source): customer sets `autoCorrect={false}`, `maxLength`, return-key chaining (next → go submits); Dapur Masuk has none of these; password `autoComplete` "password" vs "current-password".
- Demo: one customer button with its own spinner; two Dapur buttons, spinner on the primary button.
- Dark mode system bars: broken on customer auth modals only (C-1).

## Not verified

- Phone OTP send/verify, wrong OTP, CodeInput behaviour, resend timers, rate limit (`AUTH_RATE_LIMITED`) — no Supabase in the demo backend; hosted project has no SMS provider.
- Email sign-in with real credentials, `EMAIL_NOT_CONFIRMED`, `EMAIL_REGISTERED`, `PASSWORD_REJECTED`.
- CheckEmail (sent / resent / resend cooldown) for Register and Recover.
- AuthCallback success (sign-up verify) and the recovery new-password form (needs a real PKCE link on this device).
- Whether S-1 (cookie revives session) affects anything beyond demo mode, and whether C-1 (white system bars) reproduces outside Expo Go.
- Hit slop on Dapur chips; TalkBack reading of disabled buttons (adb cannot drive TalkBack here).
- Customer phone-tab empty state in light + English (the capture slot 38 shows the error state instead; 32 has dark + English).

## Notes on capture names

- dapur/19, 23, 26 are named "daftar-deeplink-shows-today-skeleton": they were taken right after a Keluar and show the S-1 session revival (the kitchen loading), not a routing bug. dapur/24 is the same effect after a theme switch relaunched the activity. Clean Daftar empties: dapur/09 (light id), 29 (dark id), 35 (dark en), 36 (light en).
- customer/30, 36, 42 are the checking phase (C-3); error phase is 20–22.
