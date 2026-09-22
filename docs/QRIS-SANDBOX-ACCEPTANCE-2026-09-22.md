# QRIS direct sandbox acceptance

## Account and contract

The dashboard's **Settings > Checkout Appearance > QRIS Credential Settings** supplies the QRIS Client ID (mall ID). It is separate from the BRN client ID used for SNAP authentication. The existing Catera notification URL is `/api/webhooks/doku/payment`.

Sandbox settings use terminal `CATERA` and explicitly synthetic postal code `12345`. These settings are sandbox test data, not verified production merchant-address data. Production remains a separate release.

The merchant-specific SNAP generate request returned HTTP 200 / `2004700`, a dynamic QR with a valid CRC, exact IDR amount, the requested terminal and an expiry before the Catera reservation deadline. The QR's `referenceNo` equals the partner reference in this account. Collection routing uses `additionalInfo.account.id`.

Official references: [QRIS SNAP](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/qris), [QRIS credential settings](https://docs.doku.com/get-started/manage-business/manage-payment-methods). The latter's sandbox FAQ conflicts with the actual working simulator linked by the developer guide; this acceptance relies on observed provider behavior for this specific sandbox account.

## Hosted test

- Clearly labeled synthetic profile from the BRI acceptance test; checkout `c15b9bdc-d4ca-4435-8958-1eed26648b81`.
- Amount IDR 162,500; generated instrument expiry `2026-09-22T08:43:39Z`, reservation expiry `2026-09-22T08:44:09.511978Z`.
- DOKU's QRIS simulator recognized the QR and exact amount, and completed an off-us sandbox payment.
- Collection pending balance increased from IDR 982,500 to IDR 1,145,000, exactly IDR 162,500. Withdrawable balance remained zero; payout readiness is not claimed.
- Genuine signed callback initially reached Catera but was rejected during normalization: `acquirer.id` was `93600899`, not the `DOKU` value in older examples. The adapter now accepts those two DOKU IDs and rejects other acquirers.
- Genuine inquiry returned `2005100`, paid status `00`, matching references and service code `47`, with amount as integer JSON `162500`. The parser accepts safe integer numbers or the existing decimal string contract; mismatched amounts, fractions, booleans, null and scientific-notation strings remain rejected.
- Callback and inquiry share approval reference `TW2026092240`, allowing a single durable inbox identity.

## Verification

Typecheck, all 259 tests, build, PostgreSQL concurrency checks and all 10 browser scenarios passed. Browser checks cover Indonesian/English, mobile/desktop, QR display/download/readability, reload and confirmation with synthetic API responses. Genuine callback replay and activation evidence are recorded below when complete.

Raw provider responses remain in ignored local output and are not committed. No secrets or simulator customer details are included here.

## Callback acceptance

After runtime commit `60420b4` was deployed, DOKU redelivered the genuine signed notification at 08:40:36 UTC. Catera returned HTTP 200, persisted and processed one inbox event in one attempt without error, and automatically marked the checkout paid. Exactly one subscription (`f9e1bc89-c32b-4afa-b571-2ce2c4d79aeb`), one allocation and five confirmed reservations were present. A second genuine redelivery preserved the single inbox event, subscription and allocation.

QRIS's four channel flags were enabled only after this verification. The final application deployment and database method-list cutover follow this acceptance; BRI remains available throughout.

## Live activation

Production-target deployment `dpl_U53nfMdcJ9MdKGvrErjekkYs5aWD` of commit `60420b4b2fb057c99e628e7c989932c15525df60` is ready and aliased to `catera-eight.vercel.app`. DOKU remains sandbox. After service-only database cutover, the public payment-method API returned direct mode with both `VIRTUAL_ACCOUNT_BRI` and `QRIS`. Existing selected methods remain locked; test QRIS with a new checkout or an unsubmitted method-selection screen.
