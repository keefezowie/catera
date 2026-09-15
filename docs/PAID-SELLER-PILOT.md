# Paid seller pilot implementation

September 14, 2026. Implemented locally; hosted rollout is pending a separate V1 staging target. No live commercial rates were approved, no hosted data was changed, and no real payment readiness is claimed.

## Delivered behavior

- `/seller/customers` manages seller-owned contacts before signup, with account status, immutable acquisition history, packages, fixed portions, remaining delivery days, payment route, next delivery, and a renewal follow-up filter. Staff can record customer-requested date/address changes with a reason and optimistic version check; owner/admin financial restrictions remain.
- Owners can add contacts, upload CSV, or paste Excel TSV. Imports retain the 100-row limit. Preview and commit use the same transactional validation, package locks, coverage, cutoff, capacity, duplicate receipt and overlap checks. Existing `customerId`/`addressId` imports remain accepted. External prepaid imports create obligations with zero platform transaction value and no provider payment or payout allocation.
- Customer claim links expire after seven days, store only a token hash, and are single use. The API obtains verified phone identity from Supabase Auth; callers cannot assert their own verification. Email users can add/verify a phone on their existing account. The service-only transaction binds existing records without rewriting purchase, delivery-address or production snapshots. Conflicting identity, ambiguous contacts and overlap return review; obligations survive.
- `/renew/:subscriptionId` prepares the current package, fixed portions, address and next available schedule after existing bookings. Unavailable packages require explicit replacement. Checkout revalidates current terms; only an activated purchase links `renewed_from`. Pending renewals block conflicting date changes, including replacement packages. Late payment conflicts enter payment-exception handling.
- Follow-ups use remaining delivery **days**, so a lunch/dinner pair counts once. The inbox threshold is three remaining days. WhatsApp links prepare text for the seller to send; neither opening nor copying is recorded as confirmed delivery. Owner-recorded external renewals retain their receipt reference and separate payment route.
- `/admin/pilot` supports approved, immutable pricing versions by seller/effective date/cohort; transaction or monthly models; manual invoices/payment/refund/adjustment evidence; 90-day enrollment and exit; and manual cost/time observations. The monthly model sets seller-origin commission to zero while keeping acquisition commission and customer service fees independent. Rates are entered by an authorized admin, never taken from the business document.
- Purchases snapshot the pricing assignment and calculated fees. Existing checkout quotes remain unchanged after a policy update. Historical acquisition relationships are not overwritten by import or claim.
- Reports separate operational observations, paid renewal outcomes, external reports and unknown outcomes, and financial contribution. Revenue comes from server payment records. Missing cost categories keep contribution unknown; acquisition/onboarding remain separate. The financial report follows the current agreement's synthetic/commercial mode and excludes historical payments without an environment marker, showing their amount separately. External historical balances never become processed GMV.
- Paid seller checkpoints distinguish enrollment from recorded fee payment at days 30/60/90; future checkpoints are unknown. These are recorded-payment indicators, not evidence of product satisfaction or customer message delivery. Observational time/cost totals require an explicit measurement scope in the evidence reference.

## Database and API

The canonical SQL is `packages/backend/src/paid-pilot.sql`; `node scripts/compile-paid-pilot-migration.mjs` generates `20260914160856_paid_seller_pilot.sql`. Do not edit historical migrations. New private tables have RLS and no direct client grants. Customer links are additive on checkouts/subscriptions/support. Operational identity is resolved through seller records when no account exists. Legacy nullable-identity authorization predicates are hardened.

Shared contracts are in `packages/domain/src/pilot.ts`. Existing `/api/v1` transport/RPC conventions remain:

| Surface | Additions |
| --- | --- |
| Reads | `seller-customers`, `renewal-context`, `pilot` |
| Seller commands | `customer.save`, `customer.invite`, `customer.followup`, `customer.deliveryChange`, compatible `import.preview` / `import.commit` |
| Authenticated web claim | `customer.claim`; verified provider identity is resolved on the server |
| Same-account phone verification | `auth/phone-send`, `auth/phone-verify` |
| Admin commands | `pilot.pricing`, `pilot.invoice`, `pilot.invoiceEntry`, `pilot.observation`, `pilot.enroll`, `pilot.exit` |
| Service-only | `pilot.claim`, read-only `pilot.releaseRecord` |

No native screens, XLSX parser, automated billing, automatic WhatsApp sending, credits, referrals or ranking changes were added.

## Hosted reconciliation and release order

The read-only `node scripts/pilot-baseline-query.mjs` emits a query comparing normalized SQL definitions with the hosted migration ledger. All 12 installed V1 definitions matched repository definitions on September 14, despite different timestamps. Evidence: `output/verification/paid-pilot-baseline.json`. The old `202609080001_core.sql` belongs to the superseded pilot and must not be applied to V1.

Apply and validate these forward migrations on the separate V1 staging environment, then the target V1 database, before deploying the matching application:

1. `20260911163608_package_lifecycle.sql`
2. `20260911163659_package_nutrition_ranges.sql`
3. `20260912100853_usability_read_options.sql`
4. `20260913052558_menu_customer_cutoff.sql`
5. `20260914055559_customer_choice_menus.sql`
6. `20260914160856_paid_seller_pilot.sql`

Hosted V1 `ygzfdqrljunngfrdygzt` had no staging branch at inspection. The existing historical pilot is excluded. The staging target was requested from the user; no new paid infrastructure was provisioned. The deployment sequence has not been executed.

With protected environment variables set, `node scripts/pilot-release-record.mjs` records commit/dirty state, deployment identifier, migration hash, database capabilities, scheduler health, and approval flags without credentials. This is evidence collection, not launch approval. Existing scheduler authorization uses `CRON_SECRET`; configure an actual schedule for `/api/jobs` and verify execution, retries and alerting on the deployment target. No scheduler has been provisioned by this change.

## Verification and outstanding live gates

Local verification covers the guest → fulfillment → claim → verified payment callback renewal lifecycle; wrong-phone/reused/cross-tenant requests; duplicate imports and capacity; conflicts; both fee models and immutable quotes; manual billing; external renewals; unknown costs; and CSV/TSV bounds. PostgreSQL exercises competing 30-customer imports, simultaneous claims and claim/checkout races in addition to existing concurrency checks. Browser journeys cover imports, invitation preparation, renewal checkout context and reports in Indonesian and English, with phone/desktop import screens and accessibility checks.

The 15 focused paid-pilot tests pass. Six browser cases passed across the import and renewal/reporting runs. A final rerun against a fresh production-build test server was blocked by automatic approval review (the tool supplied only “blocked by policy”). Later report-isolation and follow-up-filter changes have database/type/build coverage, but a final rendered-browser rerun remains outstanding. Do not treat these local runs as hosted verification.

Reproduce with `npm run typecheck`, `npm test`, `npm run build`, `npm run test:postgres`, and `tests/e2e/paid-pilot.spec.ts` using `tests/usability.playwright.config.ts`, a fresh `CATERA_DEMO_DATA_DIR`, explicit `CATERA_V1_DEMO=true`, and an isolated port set through `CATERA_USABILITY_URL`. Browser evidence is under `output/playwright/paid-pilot`; concurrency evidence is `output/verification/paid-pilot-postgres.json`.

Before real enrollment/payments: supply the separate staging environment, validate hosted OTP and same-account phone changes, test Xendit payment/refund/payout and duplicate callbacks with the merchant sandbox, prove scheduler/alerts and backup restoration, install explicitly approved commercial pricing, then deploy and verify the matching application. Local provider-shaped callbacks do not prove merchant readiness, and synthetic phone claims do not prove SMS delivery. Keep the existing production launch gates in `RUNBOOK.md`.


## Multi-cycle integration

The additive multi-cycle extension reuses this pilot's customer records, pricing-policy snapshots, imports and renewal chain. External prepaid imports remain outside fresh payment/earning allocations. New paid purchases use delivery-earned settlement and duration pricing as documented in [MULTI-CYCLE-PURCHASES.md](MULTI-CYCLE-PURCHASES.md); pilot report refund costs still require explicit reconciliation.
