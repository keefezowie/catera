# Handoff: payment channels (2026-10-27/28)

Branch v2, main tree, not pushed. Follows `facdc647`. Spec `docs/superpowers/specs/2026-10-27-payment-channels-design.md`, plan `docs/superpowers/plans/2026-10-27-payment-channels.md`. RUNBOOK section 5, "DOKU direct payment channels", is the enable procedure. DESIGN.md "Payment method and mascot space", "Channels", is the as-built record.

## Rulings

- Owner: support popular e-wallets, several banks' VAs and several paylater, Claude picks after quick research. Picks: ShopeePay, DANA, OVO, LinkAja (GoPay is not on DOKU); BCA, Mandiri, BRI, BNI, BSI, Permata, CIMB Niaga; Kredivo, Akulaku, Indodana; QRIS kept.
- Controller: VAs through SNAP create-va (same API for every bank); e-wallets and paylater through a DOKU Checkout session locked to one method, reusing the verified hosted contract, instead of SNAP direct debit or DOKU's non-SNAP paylater APIs.
- Controller: redirect operations use `dokuInvoice(c.id)` as reference (Checkout needs under 30 characters); VA and QRIS keep the 34-character reference.
- Review (Opus) fixes applied: paylater contact checked before the method is locked; only `{ id }` of the paylater customer stored; redirect events reject a `channel.id` naming another known method; VA names from the catalogue; web radio detail text; phone normalised to `62…`.

## Open

- Every new channel needs DOKU sandbox activation, evidence and its four flags (RUNBOOK). Nothing is enabled.
- Confirm the `channel.id` DOKU sends in wallet and paylater notifications; the echo check assumes it equals the method code and skips other values.
- Postcode is not stored anywhere, so paylater requests send none; Akulaku may require it.
- `checkoutResult` accepts only DOKU sandbox and staging hosts; production needs its host added with evidence.
- Refunds stay blocked for DOKU, as before.
- No device or emulator check (owner ruling); the in-app browser return after a wallet payment is unverified.
