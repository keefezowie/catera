# Handoff: payment method choice and mascot space (2026-10-27)

Branch v2, main tree, not pushed. Spec `docs/superpowers/specs/2026-10-27-pay-method-mascot-design.md`, plan `docs/superpowers/plans/2026-10-27-pay-method-mascot.md`, research `docs/superpowers/research/2026-10-27-pay-method-mascot.md`, canvas https://claude.ai/artifact/6Wji9WPhu9V817DR56Dpi6. DESIGN.md "Payment method and mascot space (October 2026)" is the as-built record.

## Rulings

- Owner: 2B for Beranda ("2b looks nice"); page-only states shrink to 88; Dapur shrinks too.
- Owner: no preference between 1A and 1B, so 1A (recommended) was built.
- Owner: the UI must hold every DOKU method; QRIS and BRI VA are only for testing. Picker 3A.
- Owner: fetch brand logos from the internet, placeholder only where impossible. All 27 were found.
- Controller: scope is UI and catalogue only; the server keeps offering QRIS and BRI VA (owner did not answer the scope question; recommended split taken).
- Controller: mark tile 56×40 with a 48×28 logo box (a 40 square drew wordmarks about 10 tall), white under a mark in every theme.
- Builder: card code `CREDIT_CARD` (DOKU's page names no code); Kartu Kredit Indonesia has no entry. Picker rows stay `row.single` minimum where an existing test pins 56; the sheet rows are 64.

## Open

- Backend per channel for every method past QRIS and BRI VA: SNAP paths and instructions (`packages/backend/src/doku-direct.ts`), `PaymentInstruction` kinds for other banks' VA steps, redirects for e-wallets, cards and paylater, pay codes for stores. Bayar's VA steps are written for BRI.
- Hosted allow-list spells `EMONEY_SHOPEEPAY`; DOKU's code is `EMONEY_SHOPEE_PAY` (`packages/backend/src/doku.ts:136-137`).
- Logo doubts: QRIS mark is monochrome; BNC lockup dated 2023; doku, indodana and kredivo files carry extra words; CIMB is a thin wide wordmark.
- Device checks not run (owner ruling): sheet height and scroll with many methods, mark legibility, TalkBack in the sheet, the 64 hello at large text, Dapur empty states at 88.
