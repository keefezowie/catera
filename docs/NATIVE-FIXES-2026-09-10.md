# Native follow-up to the document fixes

The Expo Android/iOS customer app now carries the relevant web fixes while preserving the five customer tabs, existing English route names, forest/cream palette, Jakarta font and individually generated transparent brand assets.

## Changes

- The shared select uses a bounded scrolling sheet, 48-unit targets, selected-state announcements, an explicit close button, backdrop dismissal and system Back/accessibility escape handling. It moves accessibility focus into the sheet and back to its trigger. It does not animate, so reduced-motion users receive the same stable interaction. Missing values no longer falsely display the first option as selected.
- Language selection is available on discovery and login as well as account. It retains SecureStore persistence. Stack titles, discovery copy and offer controls, authentication and account controls respond to the locale; this is not a claim of complete translation coverage across every native screen.
- Discovery and subscription-explanation actions scroll to distinct sections on the discovery screen, preserving search and filters. Web homepage anchors map to native discovery; routes stay in English.
- Hosted email/password login signs in directly through the native Supabase client once. Sessions use its existing SecureStore adapter. Profile initialization uses the existing transactional RPC, and roles are read from the database. Failed profile initialization signs out the partial local session. Invalid credentials and throttling receive localized errors.
- Customer sign-in returns to an allowed native destination, retaining checkout parameters. Owner, staff and administrator accounts land on Account, which links to their web workspace and explains that browser sign-in is separate. Seller/admin native screens remain outside the product baseline.
- Phone-code login remains available. Hosted login clears stale synthetic-demo tokens; logout affects the current session. The public catalog failing no longer prevents the identity request from updating auth state.

## Verification

- 21 native tests passed under both `jest-expo/ios` and `jest-expo/android`: selection and dismissal, scaled text behavior, command failures, login/error navigation, masked passwords, language controls, distinct scroll positions, safe return destinations and role boundaries.
- `scripts/verify-native-auth.mts` exercised the actual native auth function against all four synthetic V1 Supabase accounts. It verified role reads, admin boundaries, session restoration through the storage interface and sign-out. Only sanitized results are saved in `output/native-fixes-verification/auth.json`; no passwords or tokens are written to this evidence.
- Repository typecheck, 48 shared tests, PostgreSQL concurrency checks and the web production build passed. Android and iOS Hermes bundles exported successfully to ignored `apps/customer/dist`.
- There is no Android SDK/emulator or iOS simulator available on this Windows host. Device screenshots, VoiceOver/TalkBack focus behavior, hardware keyboard behavior and real device session restoration remain unverified. No new APK/IPA was generated, and the existing preview APK is not updated by a JavaScript export.

## Running the updated app

The current ignored `apps/customer/.env.local` points at the explicitly synthetic HTTPS demo tunnel. It continues to use demo login; the tunnel and API must be running for phone testing. Start the app using `npm run dev:native` with the existing development-client workflow.

For hosted email/password login, configure `EXPO_PUBLIC_API_URL` with the V1 web backend and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the same V1 project using `.env.example` as the template, then rebuild/restart the native bundle. Never embed service keys or demo account passwords. Private demo credentials remain in ignored `.data/demo-accounts.json`.

These checks do not certify SMS delivery, a signed release, store distribution, payments or the remaining production gates in `RUNBOOK.md`.
