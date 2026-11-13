# Apps UX audit (2026-11-13)

Both apps were walked on the Android emulator (Pixel 8, API 35, Expo Go, demo backend) at commit `b27b8347` plus the two fixes below. iOS, real sign-in, real payments and push were not exercised. Mobbin research could not run: the connector errored on every call that day.

Design drafts: https://claude.ai/artifact/MdgeSFLqvAM9eXk9isdp5R (source `2026-11-13-apps-ux-audit-canvas.html`).

## Grades (1 to 10)

Customer app, overall 7.5

| Journey | Grade | Main reason |
| --- | --- | --- |
| Browse (Beranda, Jelajah, package page) | 8.5 | Food-led, clear price and terms, strong sticky buy bar |
| Sign in | 8 | One screen, Google and email, artwork; the kitchen copy mentions Apple on Android |
| Buy (Beli) | 6 | Red error and no price for anyone whose address has no pin; "Bayar dengan" card does nothing |
| Pay and confirm | 7 | Two primary buttons, no order summary, blank middle; confirmation is good |
| Home after purchase | 8.5 | Status tracker, next meals and actions are clear; the per-day menu rows repeat |
| Jadwal | 7 | Calendar is clear; past days are rows of "Menu belum diisi" placeholders |
| Guest Jadwal and Akun | 4 | A sentence and a button on a blank page |
| Akun | 8 | Clear grouping |

Catera Dapur, overall 7

| Journey | Grade | Main reason |
| --- | --- | --- |
| Sign in and register | 7.5 | Clear; the pinned footer leaves a short scroll area |
| Hari ini (cook and deliver) | 7 | Right content, but one cooking row fits above the fold |
| Menu (weekly) | 5 | Opens on a locked day with disabled buttons and no progress |
| Pelanggan | 5.5 | No search, overlapping chips, renewal two taps away |
| Usaha, packages, payments setup | 8 | Clear steps and status |
| Customer detail | 8 | Facts and one action |

## Fixed during the audit

- Buy: after marking the pin, the purchase switched to another address and stayed blocked (`apps/customer/src/buy/BuyScreen.tsx`).
- Dapur Usaha: a two-meal package showed its daily price as "/ makan" (`apps/caterer/src/business/UsahaScreen.tsx`).

## Plan, in order

1. Beli pin step and price (draft 1). Removes the worst first impression in the money path.
2. Dapur Menu opens on the first editable day, with week progress (draft 4).
3. Dapur Pelanggan: search, non-overlapping chips, renewal actions on the list (draft 5).
4. Guest Jadwal and Akun (draft 2).
5. Bayar page (draft 3).
6. Dapur Hari ini density (draft 6).
7. Small: Android sign-in copy without Apple; Jadwal past days collapse; home menu rows merge per day; toast no longer overlaps the "Bayar dengan" heading.

Each item follows the phase process: owner approves the draft, then spec, plan, build, emulator gate. Rerun the Mobbin research (guest empty states, weekly menu planning, merchant customer lists, checkout) before final specs.
