# Sign-in rethink: no phone OTP, Google and Apple, stepped sign-up (2026-10-30)

Owner-approved canvas: https://claude.ai/artifact/TPAk5Kj39UH8qLVYpHaxV9 (15 artboards). Research: docs/superpowers/research/2026-10-30-auth-providers-research.md. Speed mode is on for this phase.

## Why

The hosted Supabase project has no SMS provider (`phone_provider_disabled`), and SMS costs money per code. The owner chose to remove phone OTP from both apps. Customers sign in with Google, Apple (iOS only) or email. Dapur uses email and password. Phone numbers become contact details that are checked for format only.

## Rulings (owner, in chat)

1. **Claim.** A claim link plus a matching number is enough proof, with no SMS. `v1.pilot_claim` already compares the phone to the record, so only the API route changes.
2. **Customer Masuk.** Providers first: Apple (iOS only), Google, then "Lanjut dengan email". One screen covers both sign-in and sign-up.
3. **Staff.** They join with email sign-up plus the invite code.
4. **Stepped sign-up.** One topic per step, a segmented bar with an "n/N" count, the account last.
5. **Customer WhatsApp step.** It can be skipped ("Nanti saja"). The canvas was approved as drawn.
6. **Drafts first.** Any new or changed screen is drafted on a canvas first. This phase's canvas is approved.

## Behaviour

### Customer app
- **Masuk** (artboards Main, CustomerMasukAndroid): the mascot heading "Masuk ke Catera" and its line, then provider buttons that are full width, 52 tall and pill-shaped:
  - Apple: a black fill, the white Apple logo, "Lanjut dengan Apple". iOS only, and only when `AppleAuthentication.isAvailableAsync()` returns true.
  - Google: outlined, the four-colour G, "Lanjut dengan Google".
  - Email: outlined, a mail icon, "Lanjut dengan email". It opens the email step.
  - A legal line sits at the bottom.
- **Email step** (CustomerEmail): the existing email and password sign-in, "Lupa kata sandi?", and "Belum punya akun? Daftar dengan email" leading to the existing Register.
- **Google:** `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "catera://auth/callback", skipBrowserRedirect: true } })`, then `WebBrowser.openAuthSessionAsync(url, redirect)`, then `exchangeCodeForSession(code)` (PKCE), then `ensureActor`. Cancel is silent. Other failures map to the existing error codes.
- **Apple (iOS):** `expo-apple-authentication` `signInAsync` with a SHA-256 hashed nonce, then `supabase.auth.signInWithIdToken({ provider: "apple", token, nonce })`, then `ensureActor`. Apple returns the full name only on the first sign-in. Pass it as the profile name when present.
- **Lengkapi akun** (CustomerLengkapi1 and 2): shown once after a sign-in when the profile has no confirmed name or the person hasn't finished or skipped this flow (a `catera.onboarded` flag in user metadata, or an equivalent server field).
  - Step 1 is the name, prefilled from the provider, with the hint "Dari akun Google-mu. Ubah kalau perlu." (Apple version: "Dari akun Apple-mu").
  - Step 2 is the WhatsApp number, format-checked, with "Nanti saja".
  - Saving uses `profile.update { name, phone? }`.
- **Klaim** (CustomerClaimOut, CustomerClaimIn):
  - Signed out: the subscription card and the same three provider buttons. The claim screen returns after sign-in.
  - Signed in: a phone field checked against the masked number (the existing `phoneMatchesMask` check), then "Sambungkan", which sends `customer.claim { token, phone }`.
- **Data akun:** the phone becomes a plain field with Simpan, using `profile.update { phone }`. The phone-change OTP is removed.
- No phone OTP is left anywhere in the customer app.

### Dapur app
- **Daftar** (DapurDaftar1 to 4): one route with in-screen steps.
  1. Business name. The mascot shows here only.
  2. Kitchen area (chips).
  3. WhatsApp number, format-checked, with "Cek di WhatsApp" opening `https://wa.me/<digits>` and the explaining line.
  4. Email, password (at least 8 characters), the terms line and Daftar.
  - Back moves to the previous step. Each step validates on Lanjut.
  - Daftar calls `auth.signUp` with `data: { name, pendingKitchen: { name, area, whatsapp } }` and `emailRedirectTo: catera-dapur://auth/callback`, then shows the existing CheckEmail.
  - On the first confirmed sign-in, an actor with no caterer and a `pendingKitchen` in metadata runs `seller.create { name, slug, description: "", areas: [area], whatsapp }`, then clears the metadata and lands on Hari ini. That covers both the callback and a later Masuk.
- **Masuk** (DapurMasuk): email and password only, with no method tabs. Links: "Belum punya dapur? Daftar" and "Diundang sebagai staf? Gabung ke dapur".
- **Gabung** (DapurGabung1 and 2):
  1. The invite code, checked against the server before step 2 if a preview read exists. Otherwise it's checked on submit.
  2. Name, email and password, then Gabung. This signs up, stores `pendingInvite` in metadata, and `invite.accept` runs on the first signed-in session.
  - Ruling: no email confirmation is skipped. Supabase confirmation applies to everyone, and staff see CheckEmail like owners. "Sudah punya akun? Masuk dulu" lets a signed-in person enter the code on the existing invite screen.
- **Data akun** (DapurDataAkun): "Nomor WhatsApp dapur" is a plain field with "Cek di WhatsApp" and "Simpan nomor", which writes the caterer's `whatsapp`. The phone-change OTP is removed.
- TimScreen invite message text: "Pasang aplikasi Catera Dapur, daftar lewat 'Gabung ke dapur', lalu masukkan kode undangan ini: …" and the English version.

### Shared UI (packages/mobile-ui)
- `ProviderButton({ provider: "apple" | "google" | "email", label, onPress, busy })`, as drawn. The Apple button follows Apple's style rule: black, the white logo, at least as large as the others.
- `StepHeader({ step, total, onBack })`: a back button (48), a segmented bar (6 tall, 6 gap, forest for done and current steps, a line tone for the rest) and an "n/N" label. `accessibilityRole="progressbar"` with the label "Langkah n dari N" and the value.
- Copy is Indonesian first with English through `t()`, as everywhere else.

### Backend
- **Migration** `20261030120000_caterer_contact_whatsapp.sql`:
  - Adds `v1.caterers.whatsapp text null`, checked against `^\+62[0-9]{8,13}$`.
  - `seller.create` accepts an optional `whatsapp`.
  - A new `seller.whatsapp` command (owner only) sets or clears it.
  - `v1.caterer_whatsapp(cid)` returns `caterers.whatsapp` first and falls back to the existing verified auth phone, so pilot kitchens keep working.
  - Staff keep the existing rule of never being shown the number.
- **`profile.update`** accepts an optional `phone` (normalized to +62, format-checked, null clears it). The customer's phone is stored where paylater's `PaymentCustomer.phone` reads it. Find that source and keep paylater working.
- **`customer.claim`:**
  - The API route takes `payload.phone`, normalizes it and passes it as `verifiedPhone`. It no longer requires `phone_confirmed_at`.
  - The demo no longer throws `PHONE_VERIFICATION_REQUIRED`.
  - Rename the internal key only if that's cheap. The claim token stays the secret.
- The mobile runtime's `sendPhoneOtp`, `verifyPhoneOtp` and the `account.ts` phone-change helpers are removed with their callers.

## Out of scope / owner actions
- **Hosted Supabase (owner):**
  - Enable the Google provider (web client ID and secret from Google Cloud).
  - Enable the Apple provider (Services ID, Team ID, Key ID and .p8 key, plus the iOS bundle IDs as authorized client IDs).
  - Add `catera://auth/callback` and `catera-dapur://auth/callback` to the redirect URLs.
  - Set custom SMTP (Resend free tier).
  - Apply the new migration. It's not applied from this session without a yes.
- **Apple build setup:** `ios.usesAppleSignIn: true` in the customer app config and the `expo-apple-authentication` plugin. iOS isn't verifiable here (no Mac). It's covered by tests and EAS later.

## Acceptance
- `npm run typecheck`, `npm test`, `npm run build`, and caterer plus customer jest all pass.
- The PostgreSQL tests cover the migration: a WhatsApp format reject, owner-only `seller.whatsapp`, and `caterer_whatsapp` preferring the column.
- No `signInWithOtp`, `verifyOtp` with `type: "sms"`, or phone-change OTP is left in apps/customer, apps/caterer or packages/mobile-*.
- An Android emulator gate (Opus) captures every artboard state and compares it against the canvas.
