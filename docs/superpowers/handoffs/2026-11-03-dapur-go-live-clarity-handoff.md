# Dapur go-live clarity: handoff (2026-11-03)

For a fresh session. Branch `v2`: SDK 58 was merged on 2026-11-03, and v2 is unpushed. Load AGENTS.md, DESIGN.md and the memory index first. Owner rule: draw any changed screen in a design canvas and get the owner's OK before writing code ([[catera-artifact-draft-first]]).

## The problem
The owner made a package in Catera Dapur. Dapur listed it as **"tayang"** (live), but the customer app never showed it. The owner, who is also the developer, took this for an app bug. It isn't a bug: the kitchen was never approved. But nothing in Dapur says so, and a real caterer would hit the same wall.

Evidence from the live database (Supabase `kdfddipnkcviberrldpk`, read on 2026-11-03):
- Package "twilly bad dog" (`v1.packages` `67852049-…`): `status = 'published'`.
- Its kitchen "PuffyFooods" (`v1.caterers` `a12b7df2-…`): `status = 'draft'`, areas `["Jakarta Utara"]`. It was never submitted.
- The only `platform_admin` is `demo.admin@catera.example`.

## How visibility works today
- **Customer discovery** lists a package only when `p.status = 'published'` **and** `c.status = 'approved'`. The same `catalog` RPC is defined in several migrations, for example `supabase/migrations/20260910160000_calendar_metadata.sql:6`. Package detail, chat and checkout use the same kitchen rule.
- **Kitchen status values:** `draft → submitted → approved`, plus `corrections` and `suspended` (`202609090001_marketplace.sql:4`).
- **The kitchen submits** with the command `seller.submit` (draft → submitted). **The admin approves** on the website at `/admin/sellers` with the command `admin.verify` (`apps/web/src/components/admin.tsx`).

## Why Dapur misleads
1. **`apps/caterer/src/business/UsahaScreen.tsx:191`.** The row label comes from the package's status alone (`published` shows as "tayang"). The kitchen's status is ignored, so a published package in an unapproved kitchen still reads "live".
2. **Submitting for review is filed under payments.** "Minta diperiksa" sits in `AktifkanScreen.tsx` as step 1 of "Aktifkan pembayaran". The way in is a "Terima pembayaran lewat Catera" card and a "Pembayaran · Belum aktif" row. Nothing tells the caterer that **customers can't see the kitchen at all** until it's reviewed. A caterer who doesn't want payments yet never finds the step.
3. **No screen shows the kitchen's state.** That includes Hari ini, Usaha, the package detail and the success message after creating a package (`PackageDetail.tsx`, "Paket baru"). `corrections`, `suspended` and "in review" are never explained either. Only Aktifkan reads them, and even there `corrections` and `suspended` fall through to "todo".

## Direction (to confirm on a canvas with the owner)
Expected shape. Follow the design skills, expo-native-ui first.
- **Make the package state honest.** In an unapproved kitchen, show a published package as "menunggu dapur aktif" or similar, not "tayang". Show "tayang" only when both the package and the kitchen are live. Do the same in the package detail and the "…" sheet.
- **Add a kitchen go-live card at the top of Usaha** (perhaps also on Hari ini) for every status that isn't `approved`, with one clear next step:
  - `draft` with no package: "Buat paket pertama".
  - `draft` with a package: "Pelanggan belum bisa melihat dapurmu" and the button **Minta diperiksa** right there.
  - `submitted`: "Sedang ditinjau tim Catera". This needs no button.
  - `corrections`: the reviewer's note (`review_note`) and a way to resubmit. Check `seller.submit` accepts `corrections`.
  - `suspended`: an explanation and how to reach Catera.
- **Separate going live from payments.** Aktifkan can stay the payments screen, but its step 1 should reflect the kitchen's review state rather than be the only place to ask for it.
- **After the first package is created**, the success message or the next screen should point to the review step if the kitchen isn't approved.
- **Copy:** Indonesian first, short, and no unexplained internal terms.

Out of scope unless the owner asks:
- Changing the approval rule itself.
- Auto-approval.
- The web seller dashboard (`apps/web/src/components/seller.tsx`). It's worth checking whether it has the same gap; if it does, record it.

## Where to look
- Data: `runtime.api.sellerOperations(catererId)` returns `caterer.status` and `offers[].status`. Usaha, Aktifkan and `usePaymentsActive` already read it, so no new endpoint should be needed. If `review_note` isn't in the response, check whether the API exposes it before adding it.
- Screens: `apps/caterer/src/business/{UsahaScreen,AktifkanScreen,PackageDetail}.tsx`, `apps/caterer/src/customers/usePayments.ts`, and the Hari ini screen under `apps/caterer/src/today/`.
- Tests: `apps/caterer/tests/business.test.tsx`, `layout-blocks-dapur.test.tsx` and `empty-states.test.tsx` cover these screens. Add cases for each kitchen status.

## Gates
- `npm run typecheck`, caterer Jest (related tests while building, the full suite once at the end) and `npm run build`.
- An Android emulator gate on the demo backend copy (`CATERA_DEMO_DATA_DIR=.data/layout-gate`): a draft kitchen shows the card and the honest state; submitting moves it to "in review"; approving as the demo admin on the website makes it "tayang" and visible in the customer app.
- Emulator rules ([[catera-emulator-gate-env]]):
  - Metro never runs with CI=1.
  - Never kill node.exe processes you didn't start.
  - Force-stop Expo Go between the two apps.

## Owner's live test (not a code change)
The owner's PuffyFooods kitchen is still `draft` in the live database.
1. To see the package now: Dapur, then Usaha → Pembayaran (Aktifkan) → **Minta diperiksa**.
2. Sign in on the website as the demo admin and approve PuffyFooods under Katering.
3. Pull to refresh in the customer app.

Don't flip the status in SQL: approval is a tenant flow, and this is production data.

## Related open items from today
- Password reset links: add `catera://auth/callback` and `catera-dapur://auth/callback` to Supabase Redirect URLs. They can't open from Expo Go; test them on the APK.
- Supabase's built-in email allows about 2 emails per hour, which blocked reset testing. Set up custom SMTP (RUNBOOK) and raise the auth rate limit.
- The live site runs code older than v2 (unpushed), so new features that need the server may fail against it.
