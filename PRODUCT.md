# Catera V1

Catera is an Indonesian catering marketplace: discover a caterer, understand an offer, purchase fixed portions for a generated delivery schedule, receive meals, resolve service issues, and explicitly buy again.

This September 9, 2026 baseline replaces the tenant-specific pilot. The user approved the V1 overhaul and implementation on responsive web and Expo Android/iOS together. Historical pilot requirements are archived under archive/pilot; they are evidence, not current instructions. The hosted pilot is preserved and is not the V1 database.

## Audiences and surfaces

- Public marketplace: address/area selection, search, food-led packages, seller profiles, menus, reviews and comparison of up to three offers at one quantity.
- Global customer account: Beranda, Jelajah, Jadwal, Pesan, Akun. One calendar across caterers, immutable purchases, saved addresses, support, delivery changes and explicit renewal.
- Caterer web: today, schedule, production and delivery with selected date/meal context; publishing, menus, portions-based capacity, customers, support, transactions and staff.
- Catera admin web: verification, listing/review moderation, transactions, support/refunds, payout approval, promotions and permanent audit history. Platform admins are distinct from seller owners.

## Product rules

1. One slot means one portion for one package/date. A combined lunch/dinner offer reserves its quantity once per day. Its meal fulfillments have separate delivery statuses and share the day's address and date.
2. Reserve the complete generated schedule atomically. Portions and purchased terms are fixed. Menu updates can be communicated without rewriting the purchase snapshot.
3. Cutoff uses the caterer's timezone. A date change must reserve the replacement before releasing the original. Reject duplicate dates, overlapping active/pending subscriptions, unavailable destinations and capacity reductions below commitments.
4. Trial defaults to one eligible delivery day, with a seller price and optional portion maximum. Only one successful trial per customer/caterer.
5. A pending checkout holds capacity for up to 15 minutes, bounded by the first cutoff. Provider confirmation activates the purchase; browser/native return links are navigation only. Late payment must reacquire the entire schedule or create a visible support exception.
6. All cancellation/refund requests enter support. A request does not release delivery bookings. Caterers respond; platform admins authorize monetary resolutions with an amount and reason. Refund, split reconciliation and payout states remain separate.
7. Reviews require an actual purchased and delivered meal. Staff see only their caterer's relationships. Financial controls require the owner or platform-admin role as applicable.
8. Delivery is included; the service fee is itemized. Fees, attribution, discounts and promotions are purchase snapshots. Invited attribution is verified before first purchase and cannot be downgraded retroactively.
9. Every reservation, entitlement, role-sensitive operation and audit effect belongs to the same database transaction. Commands and provider events are idempotent.

## Brand and content

Forest #163D2E, Sunrise #F47B2A, Cream #FFF7E9, Charcoal #2E2E2E. Self-hosted Plus Jakarta Sans is shared between platforms. The illustrated wordmark is separate from interface type. Discovery leads with food; the bento mascot provides occasional warmth. Customer screens are generous and warm; operations are restrained and denser.

Indonesian is the default and English remains supported. Use explicit language: Pengantaran termasuk, Paket fleksibel, Ganti tanggal, Ajukan pembatalan. UI text must describe server eligibility rather than imply an action will always succeed.

Brand artwork must be generated as individual reusable files. Neither board crops nor sprite extraction may ship. Master resolution and real alpha transparency are asset acceptance criteria; limitations must be recorded, never hidden by upscaling or checkerboard backgrounds. Synthetic food photos are for labeled demo listings only; production sellers provide their own images.

## Package contents

A package is a caterer-defined offering sold at one price per complete portion per delivery day. À la carte may contain one dish or multiple dishes. Nasi box defines component slots (for example, nasi, two lauk, vegetables and soup), with named dishes that can change by date. Caterers can add custom component categories and serving descriptions. Lunch and dinner have independent contents; multiple dishes do not multiply capacity reservations.

Calories, protein, carbohydrates and fat are optional caterer-entered estimates per complete meal portion. Missing values remain unavailable; zero is a value. Dated menus carry their own nutrition and never inherit estimates for different dishes. The platform neither calculates nutrition nor infers high-protein claims.

Content revisions are immutable and snapshotted with purchases. Dated changes target the purchased revision and preserve its composition. Customers choose a listed offering; individual customer/per-portion dish choices remain outside V1.

Caterers may optionally save dishes to their own reusable library. Selecting one copies its details into a stable package/menu slot. Package-specific serving overrides are allowed; library changes are applied explicitly and never propagate automatically into offerings or purchases. Archived dishes remain readable in existing contents.

Nasi box editing groups each component with its dish fields. Photos use upload progress, confirmation and previews, with storage addresses hidden. Every forward wizard action validates preceding steps; incomplete work has a separate draft-save action. Review displays the actual discovery-card and package-detail presentation with purchase actions disabled.

## V1 boundary

No automatic renewal, wallet, variable daily portions, per-portion menu customization, courier dispatch, corporate/event catering or advanced inventory.

## Implementation and release truth

The local implementation uses explicit synthetic data, shared transactional SQL services, and real web/native source. See docs/IMPLEMENTATION.md and docs/CATERA-V1-IMPLEMENTATION-PLAN.md for evidence and remaining gates. Production launch is not implied by a local build: docs/RUNBOOK.md requires a separate configured Supabase project, SMS/SMTP, Xendit merchant setup and reconciliation, mobile credentials, device tests, backups and monitoring.
