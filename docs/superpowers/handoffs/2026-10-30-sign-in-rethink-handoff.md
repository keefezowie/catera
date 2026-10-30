# Sign-in rethink: handoff (2026-10-30)

Branch v2. Built and gated; **not committed yet** (waiting on the owner's call about the earlier uncommitted splash/RantangTrack work that shares some files). Speed mode was on.

## What shipped
- **No phone OTP anywhere** in the customer app, Dapur or the web claim page. The SMS helpers, `CodeInput` and `MethodTabs` are deleted. Phone numbers are contact details only, normalized by `normalizeCustomerPhone` (`^\+62[1-9]\d{7,12}$`).
- **Customer:**
  - Masuk is providers first: Apple on iOS, Google, then "Lanjut dengan email".
  - The email step has one nav row and a pinned footer.
  - "Lengkapi akun" has 2 steps: name, then WhatsApp, which can be skipped.
  - Klaim needs the link plus a matching number. Data akun has a plain phone field.
- **Dapur:**
  - Daftar has 4 steps: name, area, WhatsApp, account. Email confirmation follows, then the kitchen is created on the first signed-in session (`pendingKitchen`, settled in `RoleGate` via `auth/pending.ts`).
  - Masuk is email only. Gabung has 2 steps, with `pendingInvite` accepted on the first session.
  - Data akun is flat: the WhatsApp field, then "Ganti" rows.
  - The Tim invite copy is updated.
- **Backend:**
  - Migration `20261030120000_caterer_contact_whatsapp.sql` adds:
    - `caterers.whatsapp` and the owner-only `seller.whatsapp` command;
    - `caterer_whatsapp()`, which prefers the column and falls back to the verified owner phone;
    - `profile.update {phone}` and the actor `phone`;
    - a paylater phone read that prefers the profile phone;
    - claim brute-force protection (`failed_attempts`: the 5th wrong number expires the link).
  - In the API, `customer.claim {token, phone}` no longer needs an SMS-verified phone. The web `auth/phone-send` and `auth/phone-verify` routes are deleted.
- **Shared:**
  - `ProviderButton`, `StepHeader` (back optional), `Button.trailingIcon`.
  - Runtime `signInWithGoogle` (PKCE through expo-web-browser), `signInWithApple` (nonce), `isAppleSignInAvailable` and `oauthRedirectPending`.
  - A `+native-intent` guard, and AuthCallback exchanges a Google code that arrives as a deep link.

## Evidence
- Reviews (Opus): backend approved after fixes (claim cap, phone regex, web claim without SMS); apps approved after fixes (stale-actor retry, normalizer, catererId, offline skip, Android OAuth race).
- Emulator gate: output/native-review/signin-2026-10-30/GATE.md. It passed with deviations F1 to F5, all since fixed and covered by tests. No re-gate on device after those fixes.
- Gates: see the final run in this session (typecheck, root vitest, customer and caterer jest, build, postgres).

## Not verified
- Lengkapi akun on a device: demo mode has no Supabase session, so it's jest only.
- Google completion: needs the hosted provider.
- Apple: iOS only, no Mac.
- Daftar and Gabung submit to CheckEmail: the demo backend refuses register.

## Owner actions (need a yes / the owner's hands)
1. In Supabase (Catera V2, `kdfddipnkcviberrldpk`):
   - Enable **Google**: web client ID and secret from Google Cloud OAuth.
   - Enable **Apple**: Services ID, Team ID, Key ID and the .p8 key, with the iOS bundle IDs as authorized client IDs.
   - Add redirect URLs `catera://auth/callback` and `catera-dapur://auth/callback`.
2. Custom **SMTP** (for example Resend's free tier). Sign-up confirmation and recovery emails depend on it.
3. Apply migration `20261030120000_caterer_contact_whatsapp.sql` to the hosted database. This needs an explicit yes, and the pilot data must be preserved.
4. Phone auth can stay disabled in Supabase; nothing uses it now.

## Parked
- The claim card shows only the address label, on purpose: the preview is visible to anyone holding the link.
- Gabung can't show "Undangan dari <dapur>" because there's no invite-preview read.
- Supabase keeps one PKCE verifier, so a pending email link and a Google sign-in can't overlap. A Google success clears the pending email intent.
- There's no per-user rate limit on `customer.claim`; the per-link cap is the guard.

## Next phase
Uber Eats polish: research in docs/superpowers/research/2026-10-30-uber-eats-patterns.md, and artwork prompts (45 assets) in docs/brand/2026-10-30-polish-artwork-prompts.md. Start with a canvas (owner rule: draft screens first). The Masuk food band (research item #9) touches the sign-in screens.
