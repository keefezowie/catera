# Catera customer app

React Native + Expo. Android is the current verification target; the same source builds for iOS. Seller and admin workspaces remain on the web.

## Local sandbox

From the repository root:

```sh
npm ci
CATERA_V1_DEMO=true npm run dev
```

In a second terminal, with an Android emulator running:

```sh
cd apps/customer
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo run:android
```

Choose **Jelajah sebagai pelanggan demo** on the sign-in screen. This uses the explicit local synthetic database and simulated payment. It does not send money, SMS, email, or messages to real customers.

For a physical Android device, use a reachable development server address, or `adb reverse tcp:3000 tcp:3000` and `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000`. Start the development server before opening the app. Native modules require a development build.

## Hosted sandbox configuration

Copy `.env.example` to `.env.local` inside this directory and supply the sandbox API URL, Supabase URL and **publishable** key. Never use a service-role key in the app. Hosted BRI Virtual Account and QRIS instructions are provided by the existing server; payment verification and booking activation remain server decisions.

Email registration and recovery use a native SecureStore session and PKCE. Allow `catera://auth/callback` in the sandbox Supabase Auth redirect URLs. Email templates must preserve the requested redirect URL. Open verification/recovery links on the device that requested them; expired or cross-device links have a request-new-link path. No Expo/EAS authentication is needed for local debug builds. EAS signing, push credentials and store release are separate setup steps.

## Resume the phone APK build

Use the `v1` branch. The `preview` profile in `eas.json` produces a standalone Android APK with bundled JavaScript, rather than an Expo development client.

1. Verify the documented UAT backend, `https://catera-eight.vercel.app`, and its matching Supabase public configuration. See `docs/DOKU-SANDBOX-INTEGRATION.md` at the repository root. The phone build needs that reachable HTTPS backend; `10.0.2.2` is emulator-only. Existing hosted data must be preserved.
2. Configure the three `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SUPABASE_*` values for the build. They are public client configuration; server credentials must never be bundled. For EAS, configure these in the selected EAS build environment, since ignored local environment files are not a reliable cloud-build input.
3. From `apps/customer`, use the existing authorized Expo project and run `npx eas-cli@latest build --platform android --profile preview`. Authenticate when needed. Alternatively, generate Android with Expo prebuild and build the Gradle release variant for ARM phones; the earlier x86_64 debug attempt was for the emulator only.
4. Download the resulting APK, verify its signature and install it on Android. Check launch without Metro, catalog loading, sign-in and the main customer journeys before calling the APK verified. Store publication and real payments remain deferred.

Session handoff, October 6, 2026: 59 native tests, 319 shared tests, typechecking, PostgreSQL checks, web build and both platform bundle exports passed. No APK has been produced yet: this session's enforced network proxy still returned HTTP 403 for `repo.reactnative.dev` after the environment settings were changed. Retry in the updated environment. Local Android SDKs, caches and test fixtures under `work/` are disposable and are not part of the GitHub handoff. Full verification status is in `docs/CATERA-V1-NATIVE-PARITY-BACKLOG.md`.

## Automatic APK builds from GitHub

The `Native Android APK` workflow builds the `preview` APK on pushes to `v1` that change `apps/customer`, shared packages, dependency manifests, or the workflow. It can also be started manually on `v1`. Native typechecking and tests must pass before a build starts. The completed run's summary contains the APK download link. Each run creates a new installable APK; installed apps must download the new APK to update.

One-time setup:

1. Add an Expo access token as the GitHub repository Actions secret `EXPO_TOKEN`. Its account must have build access to the EAS project in `apps/customer/app.config.ts`.
2. In that project's EAS **preview** environment, set `EXPO_PUBLIC_API_URL` to the documented reachable UAT backend, and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the matching UAT Supabase project. Use plaintext or sensitive visibility so CI can validate these public client values. Never use a service-role key.
3. Complete one interactive `eas build --platform android --profile preview` from `apps/customer` to set up Android signing if the project has no signing credentials. Subsequent GitHub builds run non-interactively.

Builds consume EAS build quota. This workflow creates APKs for phone installation; store submission and over-the-air updates are separate workflows.

## Customer flows

- Browse, filter, compare, save, and open packages independently of the initial catalog page.
- Register/verify email, sign in with email/password or phone OTP, recover passwords, retain purchase destinations.
- Review fixed portions, supported duration cycles, address coverage, complete dates, discounts, fees and explicit consent before purchase.
- Continue hosted or direct sandbox payments; copy BRI details or share QRIS; safely recover pending confirmation and booking exceptions.
- View the action feed, date-grouped agenda and subscriptions; renew using current availability and terms.
- Select menus by date and meal, including category slots and optional multiple dates; preserve drafts on conflicts and block edits after cutoff.
- Review atomic date/address changes, message caterers, manage addresses, report delivery issues, follow support/refund states and open notifications.

## Checks

```sh
npm run typecheck
npm test
npm run native:export
npm test -w @catera/customer
npm run test:postgres
```

Native Jest tests default to Android. Expo export checks both bundles; an iOS bundle is not iOS device verification. Device checks, sandbox-provider transactions and signed release evidence must be recorded separately.
