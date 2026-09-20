# DOKU sandbox integration

Implemented and connected to an isolated hosted sandbox on September 19, 2026; consolidated into the existing Catera UAT deployment on September 20 at the user's request. BRI virtual-account collection was tested against DOKU's simulator, signed hosted callbacks, transactional subscription activation, and collection sub-account balance on the original host. This is not acceptance of refunds, payouts, other channels, or production suitability.

## Hosted sandbox

- App: https://catera-eight.vercel.app
- Vercel project: `catera` (`prj_VogIJfLigT2auxniG2LEs5TerhSt`). The canonical Vercel Production target is currently Catera UAT; DOKU stays in sandbox mode.
- Supabase: existing Catera V1 database `ygzfdqrljunngfrdygzt`. Its existing 54 profiles, 3 caterers and 56 checkouts were retained during the additive DOKU migration and three worker repairs. Do not replace this database with the old sandbox seed.
- Historical isolated database: `bibdpeiwgdqbubbnjfiz`. September 19 payment evidence and its dedicated test accounts remain there. Use the existing UAT credentials in the private `.data/doku-sandbox/E2E-PAYMENT-TEST.md` guide for the unified app.
- DOKU collection profile: `SAC-8933-1789828563532`; withdrawable IDR account `2010182851`; pending IDR account `2030068262`.
- Only `VIRTUAL_ACCOUNT_BRI` is enabled. Refund and payout feature gates remain off.
- DOKU credentials are installed on Vercel project `catera`. The historical `.env.doku-staging.local` still points to the old database; do not use it for unified-app recovery. Existing UAT account credentials are in ignored `.data/demo-accounts.json` and the private testing guide. Never commit credential files.
- Both the workspace root and the disposable upload copy `.data/doku-sandbox/deploy` are linked to `catera`. Use the single root `vercel.json`; no separate DOKU deployment configuration is required.

Consolidation validation: all four existing UAT roles authenticate on the unified host; catalog returns HTTP 200; unsigned callbacks and unauthenticated jobs return HTTP 401. Typecheck, 215 unit tests, hosted `npm run build`, and PostgreSQL concurrency checks passed. Pricing fees were retained while enabling hosted UAT pricing; new immutable settlement policies keep payouts disabled for all approved caterers.

Cutover completed on September 20: the supplied Supabase server key was verified against the existing database, installed as a sensitive Vercel variable, and deployed in `dpl_HNA2m4CRKqQfVRh228dCCv6dbmgv`. Authenticated `/api/jobs` returns HTTP 200 with zero provider errors. Hosted checkout `085aa2b4-7355-4867-bf61-4a0499515c01`, invoice `CTff934a5992d64ccc9c5f8acf47`, collected Rp162,500 through the BRI simulator. The genuine signed callback was automatically processed at `2026-09-20T05:31:10.735228Z`, creating one subscription and one allocation. Pending collection balance increased from Rp20,000 to Rp182,500; withdrawable balance remains zero. Evidence: `output/verification/doku-unified.json`.

The former `catera-doku-sandbox` Vercel project is paused. It remains listed as inactive for recovery, but only `catera` is serving UAT. Historical sandbox database records have not been deleted.

New Checkout requests explicitly send `https://catera-eight.vercel.app/api/webhooks/doku/payment` as the notification override. The dashboard's BRI non-SNAP default was also changed to this URL and verified by reopening the saved configuration. Verified callbacks are committed to the private inbox before HTTP acknowledgement; Next.js `after` then processes them. The unified `vercel.json` schedules authenticated `/api/jobs` at 02:00 UTC (09:00 WIB). Daily recovery is a UAT fallback, not a production payment-recovery SLA; production evaluation needs a more frequent scheduler and missed-callback acceptance testing.

The registered RSA public-key SHA-256 fingerprint is `982aff835d8342a59cc2ac523d0392ff67919953566c6a851080d123bb18dbce`. B2B authentication and signed balance inquiry succeeded. SNAP timestamps must omit fractional seconds: the gateway rejected milliseconds with `4007301`. The sandbox Checkout API returns `https://staging.doku.com/checkout-link-v2/...`; both this exact host and `sandbox.doku.com` are allowlisted, with HTTPS and no credentials or nonstandard ports.

### Routing contract verified against actual balances

The current Collect & Route guide says `additionalInfo.account.id`, but this sandbox's Checkout endpoint ignores that spelling. Test invoice `CT5779e1db57247f30c8b8576b1e` paid successfully yet left the SAC pending balance at zero. Do not use that transaction as evidence of collection routing.

Using Checkout's `additional_info.account.id` instead echoed the SAC identifier in the provider response and credited Rp10,000 to `DOKU_MERCHANT_PENDING_IDR` after simulator payment (invoice `CT4fa2410a2d3713580c8e5097a2`). The implementation retains this verified snake_case contract. A successful Checkout response alone is not routing proof. Withdrawable IDR remained zero: pending funds are not yet available for payouts.

A final purchase through the deployed app's authenticated `/api/v1/commands` endpoint created invoice `CTb40216b485ef62499fe39ab395`. Its real signed DOKU notification automatically activated exactly one subscription and allocation at 15:10:59 UTC, without manually running `/api/jobs`. The collection pending balance then reached Rp20,000 across the two correctly routed payments; withdrawable balance remained zero. Sanitized evidence: `output/verification/doku-hosted.json`.

Hosted execution also exposed two pre-existing worker defects: ambiguous payout polling identifiers and a data-modifying outbox CTE nested inside a RETURN expression. Additive migrations qualify the identifiers and execute the CTE at statement top level. They preserve service-role checks and atomic leases. Concurrency verification now calls these worker paths directly.

Supabase advisors report intentional RPC-only tables with RLS and no direct policies, reviewed public/authenticated RPC entry points, and four inherited mutable-search-path warnings in baseline functions. These are not a claim of a completed production security review. Live checks confirm anonymous/authenticated roles cannot execute the system RPC.

## Delivered scope

| Requirement | Implementation and current boundary |
| --- | --- |
| VA, QRIS, wallets | Hosted Checkout adapter with server signing, configurable channel allowlist, stored provider identity, and payment deadline bounded by Catera's reservation. The hosted sandbox enables BRI VA only; QRIS/wallets still require separate activation and acceptance tests. |
| Multi-cycle purchase | Uses the existing immutable quote, sequential seller-funded discounts and complete delivery reservation. No DOKU recurring debit or calendar-month subscription is introduced. |
| Payment confirmation | Signed notification is durably recorded before acknowledgement. Background processing applies the canonical transactional payment event. Browser redirects never grant entitlement. Failed payment attempts leave the order open. |
| Missing notifications | Status polling, durable operations and an inbox with retries. A submission with an uncertain network outcome is never automatically recreated. |
| Weekly earned payouts | Existing Monday 09:00 WIB settlement preparation remains authoritative. Payout groups are separated by provider, environment and merchant. DOKU V2 balance inquiry, beneficiary inquiry, transfer and status reconciliation are implemented behind activation flags. |
| Refunds | DOKU refunds enter `needs_attention` with a visible reason. Hosted refund-link creation, delivery, expiry and completion are **not implemented**, because the activated Refund Merchant API contract is still required. Amounts outside Rp10,000–Rp25,000,000 are explicitly blocked. No fabricated success or silent amount adjustment. |
| Provider rollback | The default for future checkouts can return to Xendit; existing DOKU records keep their original identity and reconciliation route. Unknown historical payment origins require review. |

## Code map

- `packages/backend/src/doku.ts`: sandbox transport, non-SNAP and SNAP signing, notification verification, checkout contract and payment normalization.
- `packages/backend/src/payment-provider.ts`: provider dispatch, durable checkout creation, inbox processing, refund blocking, payout inquiry/submission and reconciliation.
- `packages/backend/src/doku-sandbox.sql` and `supabase/migrations/20260919100142_doku_sandbox.sql`: identical additive schema/RPC changes, immutable identities, submission leases, private operation records, provider-separated settlement and access control.
- `apps/web/src/app/api/webhooks/doku/payment/route.ts`: payment notification endpoint, 64 KiB limit and raw-body signature validation.
- `apps/web/src/app/api/webhooks/doku/payout/route.ts`: disabled until the account's callback contract is verified. Notifications only schedule authenticated status reconciliation.
- `apps/web/src/app/api/jobs/route.ts` and `apps/web/src/lib/settlement-jobs.ts`: existing job pipeline integration.
- `scripts/doku-sandbox.mts`: staging-only configuration check, provider selection/rollback and read-only balance inquiry.
- Customer payment/refund screens and admin operations display expose sandbox and unresolved states in Indonesian and English.

## Dedicated staging setup

1. Register a [DOKU sandbox account](https://sandbox.doku.com/bo/sandbox-registration). Request Checkout, the needed VA/QRIS/wallet channels, Sub-Account **V2**, and Refund Service sandbox access. Sandbox access does not establish production marketplace eligibility.
2. For current UAT, use the existing Catera database and unified HTTPS host above. Inspect the target and pending migrations before applying additive changes. Do not apply a seed or reset to the existing hosted project. A separate Vercel project is not required for DOKU sandbox.
3. Store credentials in ignored `apps/web/.env.local` or protected server environment settings using `apps/web/.env.example`. Keep `CATERA_V1_DEMO=false`; demo confirmation is not a DOKU test. Set `CATERA_DOKU_STAGING=true`, `DOKU_ENVIRONMENT=sandbox`, `DOKU_CLIENT_ID`, `DOKU_SECRET_KEY` and canonical HTTPS `CATERA_PUBLIC_URL`.
4. Obtain the platform collection profile and its withdrawable IDR account. Set `DOKU_COLLECTION_PROFILE_ID` and `DOKU_COLLECTION_ACCOUNT_NO`. Use the verified Checkout `additional_info.account.id` wire format. Confirm the commercial delivery-earned holding model with DOKU before any production launch.
5. Configure the dashboard payment notification URL as `https://<staging-host>/api/webhooks/doku/payment`, including expiry notifications. Return URLs are generated as `/return/<checkout-id>`. Enable only provisioned `DOKU_PAYMENT_METHODS`; supported wallet configuration names are `EMONEY_OVO`, `EMONEY_DANA`, `EMONEY_SHOPEEPAY`, and `EMONEY_LINKAJA`.
6. After verifying routing, set `DOKU_ROUTING_VERIFIED=true`, `CATERA_CONTROLLED_COLLECTION=true` and `DOKU_COLLECTION_ENABLED=true`. Select DOKU for new checkouts with the audited command below. Keep payouts disabled until their separate contract and funding tests pass.
7. For payouts, register the RSA public key with DOKU and store its private key as `DOKU_PRIVATE_KEY` (PEM; escaped newlines are accepted). Set an explicit whole-IDR `DOKU_PAYOUT_FEE_RESERVE_IDR`, including `0` only if confirmed appropriate. Review seller bank destinations through the existing admin workflow; the approved SWIFT code and beneficiary name are reused. Enable `DOKU_PAYOUT_CONTRACT_VERIFIED` and `DOKU_PAYOUTS_ENABLED` only after sandbox verification. Existing seller settlement policy and automatic-payout controls also remain required.
8. Run the protected `/api/jobs` endpoint regularly with `Authorization: Bearer <CRON_SECRET>` using the existing scheduler. This change does not provision a scheduler. At least once per minute is the intended staging cadence for callback processing and polling. Do not expose the secret in URLs or logs. Confirm successful job responses and monitor `providerErrors`, `providerInboxPending`, and `refundsNeedingAttention` in health output.

From the repository root, after securely loading the unified UAT environment (including its correct Supabase server key and URL; the unchanged `apps/web/.env.local` alone is insufficient):

```powershell
node --env-file=apps/web/.env.local --import tsx scripts/doku-sandbox.mts check
node --env-file=apps/web/.env.local --import tsx scripts/doku-sandbox.mts select "DOKU sandbox evaluation"
node --env-file=apps/web/.env.local --import tsx scripts/doku-sandbox.mts balance
node --env-file=apps/web/.env.local --import tsx scripts/doku-sandbox.mts rollback "Pause new DOKU checkout creation"
```

The script prints configuration presence and sanitized balances, never secret values. Selection changes the database default; environment flags must also permit collection. Rollback keeps DOKU credentials and reconciliation available for old transactions. To stop all new DOKU network submissions, disable both collection and payout flags as well.

## Transaction behavior and operational limits

Every new checkout captures provider/environment/merchant. A database claim creates a stable invoice reference before any network call. Duplicate requests cannot create another provider operation, including when a callback arrives before the checkout response. Checkout expiry is shortened to fit the remaining Catera hold; a provider deadline beyond the hold is rejected and left for reconciliation.

Payments and payouts use different DOKU protocols: Checkout uses HMAC-SHA256 non-SNAP requests, while Sub-Account V2 uses an RSA-signed B2B token and HMAC-SHA512 SNAP requests. Numeric external request IDs come from a database sequence. API hosts are hardcoded to sandbox and redirects are rejected.

Payout preparation snapshots the approved destination and funding source, checks available balance including the configured fee reserve, validates inquiry identity, then captures the transfer before submission. Expired workers cannot submit after another worker takes the preparation lease. Only one unsettled transfer per merchant is allowed in this initial sandbox adapter. Insufficient funding can retry preparation without releasing the seller's reserved funds. An ambiguous transfer remains reserved and is polled; it is not resent. A confirmed reversal updates the existing ledger once.

An ambiguous transfer that never receives a definitive provider status can block subsequent transfers. Resolve it with DOKU using the saved partner reference and inquiry reference; do not delete its operation or manually mark it paid. There is no automated override or operator resolution command in this version. Successful transfers are polled hourly for reversal; failed/reversed transfers are terminal in this adapter and require review for any later correction.

Collection routing, fund availability, fees, settlement timing and Refund Service funding must be demonstrated together. This implementation does not assume instantaneous settlement or automatically sweep funds between unrelated DOKU products. It does not implement seller sub-account provisioning or immediate seller splits.

## Remaining Refund Service work

Obtain the activated sandbox API specification for non-direct refund creation, authentication, idempotency, status, callbacks, resend and expiration. Confirm which balance funds refunds and the relationship to the collection account. Then implement the transport using the existing provider operation/inbox pattern, collect a verified email or WhatsApp contact, persist link expiry, and apply only confirmed disbursement to the existing refund reconciliation ledger. Expose a customer action link only after validating its host and expiry.

Decide and validate a supported route for refunds below Rp10,000 or above Rp25,000,000; do not round them or split them silently. Until this work is complete, a blocked refund remains a financial obligation and prevents affected earnings from becoming payable. DOKU's public [Refund Service documentation](https://docs.doku.com/payouts/refund-service) describes the product and limits, but does not supply the activated API contract used by this account.

## Verification and acceptance

Local coverage includes sandbox enforcement, signature tampering, immutable provider identity, checkout deadline validation, early/duplicate callbacks, failed attempts, uncertain submissions, refund limits, mixed-provider payout separation, funding-preparation leases, stale-worker rejection and payout reversal idempotency. The existing suite also exercises delivery earnings, refund holds and weekly settlement concurrency.

Verification commands:

```powershell
npm run typecheck
npm test
npm run build
$env:CATERA_POSTGRES_EVIDENCE='output/verification/doku-postgres.json'
npm run test:postgres
```

Browser checks use a separate synthetic data directory and `.next-doku` output at port 3039 with `CATERA_V1_DEMO=true`, `DOKU_ENVIRONMENT=sandbox` and synthetic DOKU client/secret values. Run `npx playwright test -c playwright.doku.config.ts` after starting that server. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select installed Chrome. The browser suite uses mocked provider states, not live DOKU payments.

Recorded local results: all 215 tests in 31 files passed; web/native/backend typecheck and production build passed; 12 browser cases passed across Indonesian/English and 390/1440 px widths. PostgreSQL verification passed, including five simultaneous DOKU claims and callback deliveries producing one subscription/allocation. See `output/verification/doku-postgres.json` and `output/doku/browser-report/index.html`. These local counts are separate from the hosted BRI evidence above; physical-device acceptance is not included.

Before declaring the full business flow accepted, record sandbox evidence for each enabled channel; successful, abandoned and expired checkout; duplicate, delayed and invalid callbacks; capacity lost before a late payment; a missed callback recovered by polling; collection balance and fee reconciliation; weekly payout success, inadequate funding, timeout, duplicate worker and reversal; hosted full/partial refunds, link expiry and unsupported amounts; and provider rollback with outstanding transactions. BRI successful payment, signed hosted callback, one-time activation, and pending-balance routing have run. Remaining scenarios are still open.

## Official contract references

- [Checkout backend integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration)
- [Checkout simulation](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/simulate-payment-and-notification)
- [Sub-Account V2 integration](https://developers.doku.com/wallet-as-a-service/sub-account/sub-account-v2/integration-guide)
- [Collection routing](https://docs.doku.com/wallet-as-a-service/sub-account/collect-and-route)
- [Refund Service](https://docs.doku.com/payouts/refund-service)

Production onboarding, commercial approval for Catera's marketplace model, legal/business eligibility, live credentials and migration to production endpoints remain separate work. The adapter deliberately has no production mode.
