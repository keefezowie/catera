# Catera direct payments

## Implementation and current gate

New direct-mode checkouts stay on Catera for method selection, BRI virtual-account instructions, QRIS rendering/download, waiting and confirmation. Required bank/payment-app actions happen outside Catera. No direct checkout falls back to hosted DOKU Checkout. Existing hosted checkouts keep their original URLs and reconciliation.

This implementation is **disabled pending merchant-specific sandbox acceptance**. A successful hosted BRI payment does not verify SNAP BRI or QRIS collection routing. The additive migration preserves the current hosted configuration until an explicit cutover; deploying code alone does not change outstanding payments or activate direct channels.

The read-only preflight successfully authenticated against DOKU sandbox on September 20. The available staging configuration lacks BRI SNAP partner-service/customer-prefix settings and QRIS merchant/terminal/postal-code settings. `scripts/direct-payments-preflight.mts` reports missing setting names without exposing values. The dashboard browser tool could not connect during implementation. No account settings, hosted schema, or deployment were changed.

## Contract checkpoint (September 20, 2026)

Contracts below were inspected from official documentation before implementation. Test request/response fixtures are synthetic, not recorded provider acceptance. Actual account enablement, returned contracts, routing, and callbacks remain unverified and block activation.

| Method | Creation | Inquiry | Notification |
| --- | --- | --- | --- |
| BRI | SNAP v1.1 DGPC, `/virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va`; fixed amount `C`, nonreusable, explicit expiry | `/orders/v1.0/transfer-va/status`, stored provider VA identity | SNAP HMAC signature; `/api/webhooks/doku/direct/bri`; correlate `trxId`, validate VA, paid amount and payment request ID |
| QRIS | SNAP `/snap-adapter/b2b/v1.0/qr/qr-mpm-generate`; explicit validity and no tips | `/snap-adapter/b2b/v1.0/qr/qr-mpm-query` | Documented non-SNAP signed QRIS notification, including SNAP-origin direct payments; existing `/api/webhooks/doku/payment` |

Both requests use server-side B2B authentication, unique external IDs, and `CHANNEL-ID: H2H`. Amount and expiry are derived from the immutable checkout, with a 30-second safety margin. QR content must have a valid CRC, dynamic-payment marker, IDR currency and exact amount before display. Provider instruction URLs are never rendered.

Sources: [BRI SNAP v1.1](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/virtual-account/bri-virtual-account), [QRIS SNAP](https://developers.doku.com/accept-payments/direct-api/snap/integration-guide/qris), [VA status](https://developers.doku.com/get-started-with-doku-api/check-status-api/snap), [QRIS notification](https://developers.doku.com/get-started-with-doku-api/notification/http-notification-sample-non-snap).

The generic direct-channel schemas do not establish this merchant's Collect & Route contract. The implementation does not guess a routing parameter or copy Checkout's `additional_info.account.id` into SNAP. Verify that the activated direct channel routes to the required collection account; if account-side routing is insufficient, obtain and implement DOKU's exact per-request routing contract before enabling it. Validate the BRI paid inquiry shape and the callback authentication/acknowledgement behavior with the account; unknown inquiry shapes remain unconfirmed.

## Interfaces and invariants

- `GET /api/v1/payment-methods` returns `mode` and the intersection of database-approved and server-configured methods. Checkout blocks unavailable payment before reserving. The database independently checks its configured methods.
- `GET /api/v1/checkouts/:id` adds `payment_mode` and a customer-safe `payment` view, including selected method, status, deadline and instructions. Private operation requests/responses are not returned.
- `checkout.payment.start {id, method}` claims a method transactionally for the authenticated owner. `checkout.payment.refresh {id}` claims at most one inquiry per minute. Ordinary five-second visible-page polling only reads stored state.
- One operation per checkout. Method and integration mode are immutable. Provider submission happens once; uncertain submission is reconciled, never automatically recreated. Retrying an operation still in `preparing` may safely make its first submission if the channel remains enabled.
- An unknown result without provider VA/reference remains in review and needs provider lookup by invoice. Do not generate another instrument. Signed callback correlation still works if notification beats the creation response. Admins can locate the checkout invoice in DOKU; never mark paid from a customer screenshot or redirect.
- Signed events are committed to the existing private inbox before acknowledgment. Activation remains transactional and deduplicated, with the existing full-schedule reacquisition/payment-exception behavior for late payments.
- Instrument expiry and order expiry are distinct. The UI hides old instructions at the earlier deadline and explains that confirmation may still arrive. It never equates an elapsed browser timer with failed payment.

## Enablement and rollback

1. Apply `20260920154045_direct_payments.sql` after its preceding migrations; deploy the compatible application. The migration adds no verified methods and does not overwrite historical records.
2. Configure BRI partner service ID/customer prefix or QRIS merchant ID/terminal/postal code, plus existing sandbox credentials and collection configuration. Register the channel-specific callback, including any DOKU-required notification token setup.
3. For **each** method, capture actual sanitized creation and inquiry contracts, complete a real sandbox simulator payment, verify a genuine signed callback, exactly one subscription/allocation, and the collection-account balance delta. Repeat for missing callback, duplicate callback, reload, late payment, uncertain creation, and correct amount/deadline. Do not label synthetic unit/browser fixtures as hosted acceptance.
4. Only after that evidence passes, set the channel's `DOKU_DIRECT_BRI_*` or `DOKU_DIRECT_QRIS_*` `ENABLED`, `CONTRACT_VERIFIED`, `ROUTING_VERIFIED`, and `CALLBACK_VERIFIED` flags to `true`. Use the service-only `provider.direct.configure` action with `{mode:"direct",methods:["VIRTUAL_ACCOUNT_BRI"],reason:"<verified evidence reference>"}`. Add `QRIS` only after its separate acceptance. This configuration switches new checkouts only.
5. Rollback uses `{mode:"direct",methods:[],reason:"<incident reference>"}` and disables the channel enablement flags. This stops new instruments; existing instructions, callbacks and reconciliation continue. Do not change the configuration back to hosted as an automatic fallback.

The existing daily recovery job remains a UAT fallback. Visible-page status reads do not perform provider inquiries; the manual check is rate-limited. A production recovery SLA and more frequent scheduler remain a separate release gate.

Operational records: private `provider_operations.error_code`, `state`, `polled_at`, and `lease_until`; `provider_inbox` attempts and unprocessed events; existing payment-exception queue. Structured application events include `payment.direct.unresolved` and `payment.direct.notification_failed`, without raw credentials or callback bodies. Alert on unresolved submissions, repeated inquiry failures, stale inbox events and payment exceptions using the existing operations monitoring.

## Verification commands

`npm run typecheck`, `npm test`, `npm run build`, `npm run test:postgres`, and `npx playwright test --config playwright.direct-payments.config.ts`.

Browser tests use synthetic API fixtures for the new payment UI, with actual Catera rendering and demo sign-in. They cover Indonesian/English, 390/1440 widths, copying, QR download, reload, payment confirmation, expired/uncertain states, accessibility and no DOKU navigation. Database/provider-boundary tests independently cover transactional behavior and synthetic provider contracts. Physical banking apps, genuine hosted direct callbacks and collection routing are not proven by these tests.

## Local verification result

Typecheck and production build passed. All 233 unit/integration tests passed. The complete PostgreSQL concurrency suite passed, including the new direct-payment races. All 10 browser scenarios passed; QR downloads were independently decoded back to their expected payload, and the payment section had no axe violations in the tested layouts. Browser visibility changes were simulated to verify polling behavior. Screenshots and sanitized preflight results are under `output/direct-payments/`.

The implementation was integrated into the main `catera` workspace on September 21, preserving the newer registration and checkout safeguards. Fresh verification passed typecheck, build, all 257 unit/integration tests, the full PostgreSQL concurrency suite, and all 10 direct-payment browser scenarios. No commit, push, deployment or hosted migration was performed.

Read-only hosted checks on September 21 confirmed `catera-eight.vercel.app` still serves commit `4af16a3` and the V1 database does not yet contain `checkouts.payment_mode`. Thus the hosted app still uses the old payment-link flow. The repeated sandbox preflight authenticated successfully but still found the five merchant settings above missing. The local implementation is ready for merchant verification; these results do not establish that either direct method can be enabled.
