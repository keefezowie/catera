# Catera Dapur

The caterer app (`id.catera.dapur`, scheme `catera-dapur`). It is built around the caterer's day, in four tabs:

| Tab | For | What it does |
| --- | --- | --- |
| **Hari ini** | owner, helper | Cooking totals by package and dish, the delivery route (shared as WhatsApp-ready text), "Gagal diantar" / "Pindah tanggal" exceptions, and the last loaded day when offline. |
| **Pelanggan** | owner | Active, ending (≤ 3 days left) and finished customers, WhatsApp chat, and renewal links. Renewal needs payments to be on (Aktifkan). |
| **Menu** | owner edits, helper views | The week per package. Dishes autocomplete from the caterer's own library, and *Salin minggu lalu* copies last week. |
| **Usaha** | owner | One-screen package editor, Uang (seven money states), Impor pelanggan (AI assistant), Tim (helper invite) and Aktifkan pembayaran. |

Deliveries count as done unless the caterer reports a problem: the daily job (`/api/jobs`) runs `delivery.autoDeliver` for past days.

## Run locally

From the repo root:

```bash
npm install
CATERA_V1_DEMO=true npm run dev
```

Then start the app:

```bash
cd apps/caterer && cp .env.example .env && npx expo start
```

- **Phones:** set `EXPO_PUBLIC_API_URL` to the dev machine's LAN IP, e.g. `http://192.168.1.20:3000`. The Android emulator uses `http://10.0.2.2:3000`.
- **Demo mode:** synthetic data only. The sign-in screen shows demo roles in development builds.
- **Import assistant:** needs `ANTHROPIC_API_KEY` on the web server. Without it, the assistant reports itself as unavailable.

## Checks

```bash
npm run typecheck -w @catera/caterer
```

```bash
npm test -w @catera/caterer
```

## Shared code

- `@catera/mobile-core`: session, API, live refresh, push and `useData`.
- `@catera/mobile-ui`: components from DESIGN.md tokens.
- `@catera/domain`: kitchen recap, route and share text, also used by the web.

## Release

`.github/workflows/caterer-apk.yml` builds an installable preview APK on pushes to `v2` that touch this app or the shared packages. It requires:

- `EXPO_TOKEN` as a repository secret.
- An EAS project for Catera Dapur, with `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_API_URL` (HTTPS), `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in its `preview` environment.

Production releases follow `docs/RUNBOOK.md`.
