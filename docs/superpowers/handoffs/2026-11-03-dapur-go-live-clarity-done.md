# Dapur go-live clarity: done (2026-11-03)

Follows `2026-11-03-dapur-go-live-clarity-handoff.md`. Owner-approved canvas: https://claude.ai/artifact/GKuP1uNKcysP9oPKRQxHQv

## What changed (apps/caterer)
- `src/business/kitchen.tsx` (new): `packageState` (a published package reads "tayang" only when the kitchen is `approved`, otherwise "belum tampil"), `canAskReview` (draft and corrections), `useAskReview` (`seller.submit`), `ReviewNote`, and `KitchenStatusCard`.
- **Usaha**: `KitchenStatusCard` sits at the top for every status except approved. Draft without a package shows "Buat paket pertama"; draft with one shows "Minta diperiksa"; submitted shows "Sedang ditinjau" with no button; corrections shows the `review_note` and "Kirim lagi untuk diperiksa"; suspended shows an explanation and the note. The payments card shows only once the kitchen is approved, so there's only one cream card at a time. The package rows and the "…" sheet use `packageState`.
- **Package detail**: in an unapproved kitchen there's a "Status: Belum tampil" row and a line saying customers see the package after approval. The lock copy now says "diterbitkan" instead of "tayang". The route passes `kitchenStatus`.
- **First package published** (`PackageEditor`, `kitchenStatus` from `paket/baru`): in draft or corrections, the success beat adds "Satu langkah lagi…" with **Minta diperiksa** and **Nanti saja**. Sending goes back and shows a toast.
- **Aktifkan** step 1: `corrections` shows "Perlu diperbaiki" with the note and a resubmit button; `suspended` shows "Dinonaktifkan" with an explanation. It no longer falls through to "todo".
- Tests: `tests/kitchen-status.test.tsx` (13 cases: every status on Usaha, the detail, Aktifkan, the first-publish beat).

## Gates
- `npm run typecheck`, the full caterer Jest suite (1002/1002, 46 suites) and `npm run build` all pass.
- Android emulator (API 35, Expo Go 58), demo backend on a private copy of `.data/layout-gate` on :3100:
  - Dapur Senja was set to draft (synthetic copy only).
  - The card and "belum tampil" showed; Minta diperiksa moved the kitchen to "Sedang ditinjau".
  - Approval was done through the API with `admin.verify`: the web login buttons didn't hydrate because Next dev blocks HMR when the page is opened on 127.0.0.1 instead of localhost, and the browser's Origin was rejected by `CATERA_PUBLIC_URL`.
  - After approval Dapur showed "tayang" and the payments card, and the customer app's Jelajah listed Dapur Senja.
- The copy and the server are torn down; `apps/web/tsconfig.json` and `next-env.d.ts` were restored.

## Open
- **Owner question:** Dapur has no Catera support contact. The suspended card only says to contact the Catera team, with no button. Give a WhatsApp number or email and add a "Hubungi Catera" button.
- Hari ini has no status card yet (left out on purpose; see the canvas note).
- The web seller dashboard (`apps/web/src/components/seller.tsx`) wasn't checked for the same "tayang" gap.
- `admin.verify` needs a reason of at least 5 characters even when approving.
