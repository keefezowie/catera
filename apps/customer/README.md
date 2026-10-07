# Catera customer app

React Native + Expo (SDK 57, expo-router), Indonesian first with English in Akun → Bahasa. Android is the current verification target; the same source builds for iOS. Caterers use Catera Dapur (`apps/caterer`) and the web; this app has no caterer or admin screens.

## Structure

Four tabs (`app/(tabs)`):

| Tab | Route | Screen |
|---|---|---|
| Beranda | `/` | `src/today/Beranda.tsx` — today's plate, the next days, "Pilih menu {hari}" when a menu choice is due, the renewal card, the package line and a one-time review |
| Jadwal | `/jadwal` | `src/schedule/Jadwal.tsx` — month grid across packages and the chosen day's meals |
| Jelajah | `/jelajah` | `src/discover/Jelajah.tsx` — area, search, four chips, photo cards with a heart |
| Akun | `/akun` | `src/account/Akun.tsx` — name and phone, active packages, Alamat, Disimpan, Riwayat pembayaran, Bantuan dan laporan, Notifikasi (Aktif/Nonaktif), Bahasa, Keluar |

Pushed screens: `paket/[id]` (package), `beli/[id]` and `renew/[id]` (one-screen buy/renew), `bayar/[id]` (QRIS/VA), `hari/[id]` (a day, Ubah hari sheet), `masalah/[id]` (Ada masalah), `bantuan`, `pilih-menu/[id]` (customer-choice menus), `claim/[token]`, `alamat`, `pembayaran`, `notifications`, `disimpan`, `login` (Masuk: phone code first, email second), `register`, `recover` and `auth/callback`.

Redirect stubs exist only for hrefs the server or older links still emit: `/subscriptions/<id>` (→ Jadwal), `/subscriptions/<id>/menu` (→ Pilih menu), `/checkout/<id>` (→ Beli or Perpanjang), `/payment/<id>` (→ Bayar), `/package/<id>` (→ Paket), `/saved`, `/addresses` and `/discover`. Push taps and notification rows go through `customerLink` in `src/links.ts`, the one mapper from server hrefs to app routes (it also maps `/deliveries/<id>`, `/packages/<id>`, `/calendar`, `/support`, `/account` and the old web anchors).

Folders in `src/`:

- `runtime.ts` — the one `createMobileRuntime` (API, Supabase session in SecureStore, `catera.*` keys) and `shell.tsx` — `MobileProvider`, which owns the session, commands, realtime, push registration and push-tap routing.
- `today`, `schedule`, `discover`, `buy`, `help`, `claim`, `account` — one folder per area, built on `@catera/mobile-core` (`useMobile`, `useData`) and `@catera/mobile-ui` (`Text`, `Button`, `Field`, `Card`, `Sheet`, `Screen`, `colors`).
- `auth.ts` — `nativeReturnPath`, the allow-list for where sign-in returns (`next`).

## Environment

Copy `.env.example` to `.env.local` in this directory.

| Variable | Use |
|---|---|
| `EXPO_PUBLIC_API_URL` | The Catera web backend origin, without `/api/v1` (`http://10.0.2.2:3000` for the emulator against `npm run dev`). |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Hosted sandbox only; the **publishable** key, never a service-role key. Unset for the local synthetic demo. |
| `EXPO_PUBLIC_CATERA_WEB_HOST` | Host only (for example `catera.example`). `app.config.ts` then adds Android App Links (`/claim/`, `/renew/`, `autoVerify`) and iOS associated domains. Unset, those URLs open in the browser. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Optional override of the EAS project used for push tokens. |

App links on the web deployment: `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` are generated from `CATERA_ANDROID_SHA256` (comma-separated signing-certificate SHA-256 fingerprints) and `CATERA_APPLE_TEAM_ID`; unset, nothing is claimed. `NEXT_PUBLIC_CATERA_ANDROID_URL` shows "Pasang aplikasi" after a web claim. Never commit real fingerprints, team ids or keys.

The standalone APK contains the `EXPO_PUBLIC_*` values from build time; a changed value needs a new build.

Email registration and recovery use PKCE with the session in SecureStore. Allow `catera://auth/callback` in the Supabase Auth redirect URLs, and keep the requested redirect in the email templates. Links must be opened on the phone that asked for them; expired or cross-device links offer a new one.

## Demo mode (synthetic)

From the repository root:

```sh
npm ci
CATERA_V1_DEMO=true npm run dev
```

In a second terminal, with an Android emulator running:

```sh
cd apps/customer
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start
```

In a development build, Masuk shows **Masuk sebagai pelanggan demo** (only under `__DEV__`). Bayar shows **Bayar (demo)** only when the server reports explicit demo mode. Demo data is synthetic: no money, SMS, email or messages reach real people. For a physical phone use `adb reverse tcp:3000 tcp:3000` and `EXPO_PUBLIC_API_URL=http://127.0.0.1:3000`.

Startup requests (including saved-session restoration) time out after 15 seconds; the app then opens as a guest with the reason, and the stored session is kept.

## Checks

```sh
npm run typecheck                # web, customer, caterer and shared packages
npm test                         # shared Vitest suite
npm run build                    # web build
npm test -w @catera/customer     # this app's Jest suite (Android preset)
npm test -w @catera/caterer      # Catera Dapur, which shares mobile-core and mobile-ui
npm run test:postgres            # PostgreSQL concurrency checks
npm run native:export            # Android and iOS bundles
```

Tests use synthetic data only. Device checks, sandbox payments and signed release evidence are recorded separately.

## APK builds

`.github/workflows/native-apk.yml` (`Native Android APK`) runs the customer typecheck and tests, validates the EAS **preview** environment (`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SUPABASE_*` must be phone-reachable HTTPS and answer as the Catera API) and builds the `preview` APK from `apps/customer`. It needs the `EXPO_TOKEN` repository secret and Android signing set up once with an interactive `eas build --platform android --profile preview`. The build job runs for pushes to `v1` and `v2` (and manual runs on either branch).

Production release follows the gates in `docs/RUNBOOK.md` (separate Supabase, SMS/SMTP, Xendit and mobile credentials).
