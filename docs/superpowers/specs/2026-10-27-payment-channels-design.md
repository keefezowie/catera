# Payment channels: popular banks, e-wallets and paylater

Date: 2026-10-27. Branch v2. Owner ask: support the popular e-wallets, several banks' virtual accounts and several paylater providers, picked by Claude after a quick research. Follows `2026-10-27-pay-method-mascot-design.md` (the picker and catalogue already list every DOKU method).

## Picks

Research: [2026-10-27-pay-method-mascot.md](../research/2026-10-27-pay-method-mascot.md), addendum, plus:

- E-wallets: GoPay, OVO, DANA, ShopeePay and LinkAja are the top five (about 70% share, Mordor Intelligence 2025). Ipsos 2026 puts ShopeePay first for online use (68%), then GoPay, DANA, OVO. **GoPay is not offered by DOKU**, so Catera supports **ShopeePay, DANA, OVO, LinkAja**.
- Banks: BCA, Mandiri and BRI lead; BNI, BSI, Permata and CIMB Niaga follow. Catera supports **BCA, Mandiri, BRI, BNI, BSI, Permata, CIMB** virtual accounts.
- Paylater: Kredivo and Akulaku lead, then Indodana and Atome. DOKU offers **Kredivo, Akulaku, Indodana**; all three are supported.
- QRIS stays.

## Integration approach

Two ways to take each method through DOKU:

| Kind | Methods | How |
| --- | --- | --- |
| In-app VA | 7 banks | DOKU SNAP `POST /virtual-accounts/bi-snap-va/v1.1/transfer-va/create-va`, the endpoint BRI already uses; each bank has its own `partnerServiceId` and customer prefix and sets `additionalInfo.channel`. Payment notification `POST .../v1/transfer-va/payment` and status `POST /orders/v1.0/transfer-va/status` have the same shape for every bank. The number shows in Bayar. |
| In-app QR | QRIS | Unchanged. |
| Redirect | 4 e-wallets, 3 paylater | A DOKU Checkout session (`POST /checkout/v1/payment`, the hosted path Catera already verified) with `payment_method_types` set to the one chosen code. Bayar opens DOKU's URL; the customer finishes in the wallet or paylater app; DOKU's hosted notification (`/api/webhooks/doku/payment`) and status (`/orders/v1/status/{invoice}`) report the result through the existing hosted parser. |

Chosen over DOKU SNAP direct debit for e-wallets (`/direct-debit/core/v1/debit/payment-host-to-host`, account binding and OTP per wallet) and DOKU's non-SNAP paylater APIs, because the redirect path reuses a contract, signature and notification parser that are already verified in sandbox. Native wallet flows can replace it per wallet later without changing the app.

## Server

**Domain** (`packages/domain/src/payment.ts`, done in the controller's first step): `VA_CHANNELS`, `REDIRECT_CHANNELS`, `DirectPaymentMethod` = QRIS ∪ VA ∪ redirect codes, `DIRECT_PAYMENT_METHODS`, `PAYLATER_CHANNELS`, `directChannelKind`, `vaBankOf`, `redirectKeyOf`. `PaymentInstruction` VA `bank: VaBank`; new `{ kind: "redirect", url, channel }`.

**Database** (new migration, wrapping the functions the same rename-and-wrap way as `20260920154045_direct_payments.sql`; check later migrations for later wrappers of the same functions and wrap the newest):

- `provider_operations.channel` check and `provider.direct.configure` allow-list widen to `DIRECT_PAYMENT_METHODS`.
- `checkout.payment.start` for a redirect channel sets `reference` to `'CT'||left(encode(sha256(convert_to(c.id::text,'UTF8')),'hex'),26)`, the same value as `dokuInvoice(c.id)` (DOKU Checkout needs an invoice under 30 characters; the 34-character direct reference stays for VA and QRIS).
- New system action `provider.payment.customer` (service role only): for a checkout id, the customer's name, phone, email and delivery address line and city/postcode if stored, plus the package name, for paylater requests. Returns only those fields. Never readable by `anon` or `authenticated`.
- Everything else (method lock, hold checks, lease, attach) is unchanged and applies to every channel.

**Backend** (`packages/backend/src/doku-direct.ts`, `payment-provider.ts`, `doku.ts`):

- Readiness per channel, all `false` unless every flag is set, as today: sandbox, controlled collection, collection enabled, credentials, and `DOKU_DIRECT_<KEY>_{ENABLED,CONTRACT_VERIFIED,ROUTING_VERIFIED,CALLBACK_VERIFIED}`. Keys: `QRIS`, `BRI` (existing names kept), `BCA`, `MANDIRI`, `BNI`, `BSI`, `PERMATA`, `CIMB`, `SHOPEEPAY`, `DANA`, `OVO`, `LINKAJA`, `KREDIVO`, `AKULAKU`, `INDODANA`. VA banks also need `DOKU_<BANK>_PARTNER_SERVICE_ID` and `DOKU_<BANK>_CUSTOMER_PREFIX` (BRI keeps `DOKU_BRI_*`).
- VA: the BRI branch becomes one VA branch keyed by `vaBankOf(channel)`: request, response validation, `instructions.bank`, notification and status. Event sources `va_notification` and `va_status` replace `bri_*`.
- Redirect: `directRequest` builds the Checkout body (`checkoutBody` shape) with `payment_method_types: [channel]`, `invoice_number: op.reference`, and for paylater `customer` and `line_items` (one item: package name, total, quantity 1) from `provider.payment.customer`. `submitDirectPayment` posts it with `dokuRequest("/checkout/v1/payment", ...)`, validates with `checkoutResult`, and attaches `{ expiresAt, providerReference: token_id, instructions: { kind: "redirect", url, channel } }`.
- Notifications: `recordDokuPayment` keeps finding the operation by `order.invoice_number`; a direct operation on a redirect channel goes through `dokuPaymentEvent` (paid or expired); QRIS keeps `qris_notification`. Reconcile: redirect channels read `/orders/v1/status/{reference}` and go through the same path.
- Webhooks (`apps/web/src/app/api/webhooks/doku/direct/`): the BRI route becomes the shared VA notification route (keep `bri/route.ts` as an alias that calls it, so a configured DOKU URL keeps working; add `va/route.ts`).
- Hosted allow-list fix: accept DOKU's real codes (`EMONEY_SHOPEE_PAY`, paylater, cards, stores).

## Apps

**Customer** (`apps/customer/src/buy/PaymentScreen.tsx`):

- VA: the number card names the bank ("Nomor virtual account BCA") and the steps name it ("Buka aplikasi BCA atau ATM, lalu pilih Transfer / Virtual Account."). No bank-specific menu names.
- Redirect: after start, a primary button "Lanjut ke {name}" ("Continue to {name}") opens the URL in the in-app browser (`WebBrowser.openBrowserAsync`), with steps: "Selesaikan pembayaran di {name}." and "Kembali ke Catera. Status berubah sendiri." The existing "Saya sudah bayar, cek status" stays. The start button before it reads "Bayar dengan {name}".
- The catalogue names come from `paymentMethodInfo`.

**Web** (`apps/web/src/components/direct-payment.tsx`): the same three kinds, with the same strings, a link that opens the URL in the same tab.

## Not in scope

Native wallet APIs, saved accounts, cards and convenience stores in direct mode (still listed in the catalogue; the server never offers them), refunds per channel (refunds stay blocked for DOKU as today), production hosts (`checkoutResult` accepts only DOKU sandbox and staging hosts).

## Verification

Unit tests (backend Vitest, customer Jest, web), typecheck, build, and `npm run test:postgres` with new scenarios: start per channel kind, method lock across kinds, a redirect invoice matching `dokuInvoice`, `provider.payment.customer` refused to `authenticated`, configure rejecting unknown codes. Nothing is enabled by default; each channel needs DOKU sandbox evidence and its four flags before it shows. Owner ruling for this phase: no emulator gate.
