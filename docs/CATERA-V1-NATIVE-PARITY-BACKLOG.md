# Catera V1 native parity and verification backlog

Updated October 6, 2026. Customer implementation is authorized and implemented
in React Native + Expo directly on `v1`, following `AGENTS.md`. This supersedes
the September 26 native deferral and isolated-branch instruction. Android is
the current verification target; seller and platform-admin workspaces remain
web-only. iOS device testing, EAS authentication, store release and real-money
transactions are deferred by the user.

The source and automated checks below are complete. Android runtime and visual
acceptance remain blocked: no installed-app journey or native screen captures
have been recorded. Bundle export is not device verification. Local testing uses
an explicitly synthetic backend, separate from the hosted V1 sandbox.

## Implemented customer scope

Paths below are relative to `apps/customer/`. Shared domain/API contracts remain
authoritative for eligibility, reservations, payment confirmation and refunds.

| Outcome | Implemented source | Remaining runtime evidence |
| --- | --- | --- |
| Discovery and Saved | `src/discovery.tsx`, `src/saved.tsx`, `src/purchase.tsx`: food-led feed/list, filters, comparison, private Saved and independently fetched package details. | Deliberate paging, list recovery, filter/selected-card return and Saved login continuation on Android. |
| Account access | `src/identity.tsx`, `src/auth.ts`, `src/context.tsx`: email registration/verification, password recovery, password or phone-OTP sign-in, SecureStore session/PKCE and allowed return destinations. | Hosted sandbox email/OTP delivery; valid, expired, reused and cross-device callbacks; session expiry and logout on device. |
| Purchase and explicit renewal | `src/checkout.tsx`, `src/renewal.tsx`: independent offer reads, fixed portions, supported cycles, address coverage, complete server-quoted dates/prices/fees, explicit accepted terms and current renewal eligibility. Owner/purchase-scoped drafts restore missing selections; explicit route selections take precedence. | Full Android quote → consent → checkout journey, cold restart/draft recovery, expired quote, unavailable capacity and renewal conflict. |
| Payment recovery | `src/payment.tsx`: shared `paymentPresentation`, hosted/direct methods, BRI VA copying, QRIS sharing, method locking, status refresh and safe unresolved-booking recovery. Return navigation never confirms payment. | Clipboard/share sheet, background/return behavior, pending/expired/paid-without-booking states and separately recorded sandbox-provider outcomes. |
| Home and calendar | `src/agenda.tsx`: authoritative top-three action feed with inline expansion, date-grouped lunch/dinner agenda, active subscriptions, meaningful empty states and renewal entry points. | First-viewport hierarchy, action continuation, long lists and data refresh on representative Android sizes. |
| Customer menus | `src/customer-menu.tsx`, `app/subscriptions/[id]/menu.tsx`: date/meal selection, category slots, distinct current dish versions, multiple eligible dates, cutoff checks, saved/fallback states and one selection for all fixed portions. Unsaved/conflicting drafts remain recoverable. | Paid purchase → menu selection → saved menu, stale dish/delivery versions, cutoff crossing, multi-date save and Android Back/discard behavior. |
| Delivery recovery | `src/delivery.tsx`: one schedule-change flow with skip intent, bounded availability/reasons, original/new date and address review, versioned atomic changes and retained choices after conflict. | Both-meal changes, unavailable dates, changed versions and failed replacement retaining the original booking. |
| Messages, addresses and support | `src/daily.tsx`, `src/delivery-issues.tsx`: caterer messages, versioned addresses, delivery-linked cases, delivery issues, actual refund states and notifications. | Keyboard/form behavior, failed-write draft recovery, correct delivery association, refund action links and cold/warm notification continuation. |
| Loading and write safety | `src/context.tsx`, `src/ui.tsx`: owner/resource-scoped reads, obsolete-response protection, initial loading, retained refresh/error states, retry, stale-write guards and duplicate-tap protection. | Offline/slow network, account switching, interrupted writes and recovery after app backgrounding. |
| Native controls and accessibility | `src/ui.tsx` and customer screens: ID/EN copy, safe areas, keyboard handling, native date/select controls, screen-reader labels and 48 dp shared action controls; package-card Compare also has a 48 dp minimum. | TalkBack traversal, enlarged text, actual touch bounds, keyboard/safe-area clearance, reduced motion and long English copy on device. |

## Design comparison

This extends the incumbent Catera visual system. `DESIGN.md` and
`.impeccable/design.json` are preserved; this pass does not refresh global tokens
or repair unrelated design drift. Source comparison checked both documents,
`packages/design-tokens/src/index.ts`, the web global stylesheet, native
`src/ui.tsx`, `app/_layout.tsx`, the tab layout, discovery/dish-gallery/loading
components, `app.config.ts` and the brand README.

- Native imports the shared forest, sunrise, cream, charcoal, sage, muted and
  line colors. Existing native surface/border values remain documented platform
  differences.
- Web and native load the self-hosted Plus Jakarta Sans family. Native keeps
  its documented 30/39 title, 21/28 heading, 14/23 body and 11/18 small type ramp;
  it does not substitute the unused suggested shared typography scale.
- Native retains 14-radius panels, 9-radius inputs, 10-radius buttons and
  48 dp shared controls, plus its safe-area scroll page and five customer tabs.
  These are source values, not measured device pixels.
- Discovery remains food-led. The existing wordmark, empty-calendar, app icon
  and mascot assets retain their roles and contain/cover behavior. No artwork
  was regenerated or relabeled; existing master-resolution limitations remain
  in `packages/brand/README.md`.

This comparison supports continuity in source, not rendered visual parity.
The Impeccable finish-review disposition is **recapture** because native runtime
evidence is missing. Existing web screenshots cannot close that review; the
HTML/CSS detector was not run against native source.

## Verification recorded

Logs are in `work/native-implementation/` for this session.

- Android Jest: **63 tests across 16 suites passed**, including explicit route
  selections taking precedence over a saved checkout draft and ISO month-start
  dates for menu API reads. Startup regressions cover stalled API/session reads,
  HTML tunnel responses, visible retry and sign-out during initialization
  (`startup-all-native.log`).
- Shared suite: **326 tests across 50 files passed** (`startup-shared-tests.log`).
- Repository typecheck, PostgreSQL concurrency checks and production web build
  passed (`startup-typecheck.log`, `startup-postgres.log`, `startup-web-build.log`).
- Expo export produced Android and iOS bundles (`startup-final-export.log`). This does
  not prove either app installs or runs.
- The local synthetic fixture exercised server quote → accepted checkout →
  simulated payment → activated subscription for native menu routes
  (`seed-native-demo.mjs`, `seed-native.log`). This is server-contract evidence,
  not an executed native purchase/menu journey or a provider transaction.
- Further local API checks passed exact menu versions and stale-write rejection,
  lunch/dinner separation, atomic whole-day replacement, renewal ordering,
  delivery-linked support and cross-identity denial (`native-contracts.log`,
  `native-contract-evidence.json`). They caught and fixed a native menu request
  sending `YYYY-MM` instead of the required `YYYY-MM-01`.
- Android debug build executed 229 Gradle tasks, then failed downloading the
  official `com.facebook.react:react-android:0.86.3` debug AAR. Maven Central
  redirected to `https://repo.reactnative.dev/maven2/com/facebook/react/react-android/0.86.3/react-android-0.86.3-debug.aar`,
  which returned **HTTP 403 through the environment proxy**
  (`android-build.log`). No successful APK or app runtime captures resulted.

Startup follow-up: native API calls now include session restoration and response
parsing in a 15-second deadline. A failed connection reaches the existing Retry
screen; late token restoration cannot send a timed-out write. Sign-out during
initialization schedules a fresh guest read. The GitHub APK workflow probes the
public catalog and session endpoints before starting EAS, and the customer README
explains build-time variables and the required live backend. The user's ngrok
endpoint remains unverified from this session because its proxy denies access.

## Next evidence and release boundaries

1. Make the official `repo.reactnative.dev` artifact host reachable in the
   development environment, then rerun the Android debug build using the local
   setup in `apps/customer/README.md`. A request to allow the host or defer
   Android verification is pending; no exception or approval is assumed.
2. Install the build and run the Android customer journeys above against the
   explicit local synthetic backend. Capture Home, discovery, checkout review,
   payment recovery, menu selection and delivery review in ID/EN, including
   loading/empty/error/conflict states. Check representative phone sizes and a
   tablet layout, enlarged text, TalkBack, reduced motion, safe areas, keyboard,
   offline/slow refresh and back navigation. Re-run the native finish review
   with those captures.
3. Keep emulator evidence separate from physical Android, hosted-auth,
   notification delivery, sandbox-provider and performance verification. Those
   outcomes remain unverified. iOS device checks and signed/store distribution
   remain deferred; iOS export alone does not advance them.

Production acceptance still requires the separate credentials and operational
gates in `docs/RUNBOOK.md`. No native visual, device, payment-provider or
production-release acceptance is claimed here.
