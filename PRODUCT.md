# Catera V1

Catera is an Indonesian catering marketplace: discover a caterer, understand an offer, purchase fixed portions for a generated delivery schedule, receive meals, resolve service issues, and explicitly buy again.

This September 9, 2026 baseline replaces the tenant-specific pilot. The user approved the V1 overhaul and implementation on responsive web and Expo Android/iOS together. Historical pilot requirements are archived under archive/pilot; they are evidence, not current instructions. The hosted pilot is preserved and is not the V1 database.

## Audiences and surfaces

- Public marketplace: address/area selection, search, food-led packages, seller profiles, menus, reviews and comparison of up to three offers at one quantity.
- Global customer account: Beranda, Jelajah, Jadwal, Pesan, Akun. One calendar across caterers, immutable purchases, saved addresses, support, delivery changes and explicit renewal.
- Caterer web: Hari ini updates delivery statuses through separate lunch/dinner tabs and atomic bulk actions. Jadwal provides a date/package order dashboard with production and whole-day manifest revisions. Publishing, menus, portions-based capacity, customers, support, transactions and staff remain separate workspaces.
- Catera admin web: verification, listing/review moderation, transactions, support/refunds, legacy payout approval, delivery-earned weekly settlement, historical promotions and permanent audit history. Platform admins are distinct from seller owners.

September 17 seller workspace update: Schedule customer/destination metrics group and filter the order list in place. Menu has one package selector; caterer-selected packages show the dated calendar, while customer-choice packages show their available dish library. Marketplace subscriptions originate from customer purchases. The beta objective explicitly restores a simple prepaid migration: owners enter an existing or accountless customer and remaining paid obligations, preview exact dates and confirm atomically without a new charge or payout. Standalone manual customer creation and the separate external-renewal control remain removed; historical records and customer details remain manageable. Invitation links are prepared for the seller to share; preparation does not send messages.

## Product rules

Web account registration uses name, email and password followed by email verification. Phone OTP remains an alternative. Registration preserves checkout and invitation destinations. Address details are collected when needed for ordering, not as a registration prerequisite. Password recovery uses a verified email link. New identities receive customer access; seller creation and staff invitations retain their existing transactional authorization. Separate email and phone identities are not automatically merged.

1. One slot means one portion for one package/date. A combined lunch/dinner offer reserves its quantity once per day. Its meal fulfillments have separate delivery statuses and share the day's address and date. Recurring package capacity is one value shared by every selected operating weekday; date-specific capacity rows are legacy data and are not seller-editable.
2. Reserve the complete generated schedule atomically. Portions and purchased terms are fixed. Menu updates can be communicated without rewriting the purchase snapshot.
3. Cutoff uses the caterer's timezone. A date change must reserve the replacement before releasing the original. Reject duplicate dates, overlapping active/pending subscriptions, unavailable destinations and capacity reductions below commitments.
4. Trial defaults to one eligible delivery day, with a seller price and optional portion maximum. Only one successful trial per customer/caterer.
5. A pending checkout holds capacity for up to 15 minutes, bounded by the first cutoff. Provider confirmation activates the purchase; browser/native return links are navigation only. Late payment must reacquire the entire schedule or create a visible support exception.
6. All cancellation/refund requests enter support. A request does not release delivery bookings. Caterers respond; platform admins authorize monetary resolutions with an amount and reason. Refund, split reconciliation and payout states remain separate.
7. Reviews require an actual purchased and delivered meal. Staff see only their caterer's relationships. Financial controls require the owner or platform-admin role as applicable.
8. Delivery is included; the service fee is itemized. Fees, attribution, discounts and promotions are purchase snapshots. Invited attribution is verified before first purchase and cannot be downgraded retroactively.
9. Every reservation, entitlement, role-sensitive operation and audit effect belongs to the same database transaction. Commands and provider events are idempotent.

## Multi-cycle purchasing and settlement

Customers may buy selected durations of one through six consecutive package delivery-day cycles, paid in full upfront. One cycle remains the default; cycles are not calendar months. Portions remain fixed and every delivery is reserved atomically within the new purchase's 366-day booking horizon. Owners version duration options and seller-funded savings on the same package. Portion discounts apply before duration discounts. Temporary promotions are disabled for new purchases; historical promotion pricing remains unchanged. Explicit renewal creates a new term after the current term.

New purchases earn seller settlement one complete delivered day at a time; combined lunch/dinner requires both meals. Eligible unheld earnings are scheduled weekly on Monday at 09:00 Asia/Jakarta, with approved policies and provider configuration. Refunds, recoveries and payout events preserve an append-only audit trail. Older allocations retain legacy settlement. See [MULTI-CYCLE-PURCHASES.md](docs/MULTI-CYCLE-PURCHASES.md) for the pricing, migration, and rollout contract.

## Brand and content

Forest #163D2E, Sunrise #F47B2A, Cream #FFF7E9, Charcoal #2E2E2E. Self-hosted Plus Jakarta Sans is shared between platforms. The illustrated wordmark is separate from interface type. Discovery leads with food; the bento mascot provides occasional warmth. Customer screens are generous and warm; operations are restrained and denser.

Indonesian is the default and English remains supported. Use explicit language: Pengantaran termasuk, Paket fleksibel, Ganti tanggal, Ajukan pembatalan. UI text must describe server eligibility rather than imply an action will always succeed.

Brand artwork must be generated as individual reusable files. Neither board crops nor sprite extraction may ship. Master resolution and real alpha transparency are asset acceptance criteria; limitations must be recorded, never hidden by upscaling or checkerboard backgrounds. Synthetic food photos are for labeled demo listings only; production sellers provide their own images.

## Package lifecycle

Drafts can be completed before publication. Once published, a package's base commercial terms and composition are immutable; duration options and their discounts are a narrow versioned exception affecting only future purchases; caterers create a new package for a different offering. Published packages must be suspended before archival. A suspended package is hidden from discovery and rejects new checkout and imported purchases, while existing purchased deliveries and dated menus continue. Archive is available only after all delivery days are delivered or cancelled and no live pending payment holds remain. A late payment after archival enters the existing support exception path instead of creating new deliveries. Archiving preserves purchase history; physical deletion and reopening are not seller actions.

## Package contents

A package is a caterer-defined container sold at one price per complete portion per delivery day. Both À la carte and Nasi box define category slots (for example, one rice, two mains and one soup), separately for lunch and dinner. Counts describe dishes within a complete portion and never multiply capacity reservations. Packages can be published and purchased before specific dated menus exist; customers see “Menu belum ditentukan” until the caterer assigns dishes.

Calories, protein, carbohydrates and fat are optional caterer-entered package estimates per complete meal portion. Each metric may be one fixed value or an inclusive minimum–maximum range; missing values remain unavailable and zero is a value. Dated menus do not define nutrition. The platform neither calculates nutrition nor infers high-protein claims.

Content revisions are immutable and snapshotted with purchases. Dated changes target the purchased revision and preserve its composition. Both package types support a customer-choice subtype, provisionally labeled “Pilih menu sendiri.” After payment, customers select distinct eligible dishes per delivery date and meal, using the same Menu assembly UI. Their fixed portions share that selection; per-portion customization remains outside V1.

Customer-choice packages keep an independently editable package dish library copied explicitly from the caterer's library. All choices are included in the package price. Published composition, commercial terms and selection mode remain immutable. New selections use current active options; previously saved selections retain their committed dish details even after an option is updated or retired. Each category must retain enough active distinct dishes to fill its slots.

Customer selections close at the purchased caterer-timezone cutoff. Without a complete saved selection, the delivery continues with “Katerer memilih” and no assumed dish list. The caterer decides the dishes and communicates with the customer. Activation, pre-cutoff reminders and fallback notifications use the existing notification system. Kitchen lists and manifests preserve customer selections or explicitly identify unchosen portions. Customer selections follow the delivery identity when rescheduled.

Caterers manage their dish library inside Menu. Built-in categories are Nasi, Lauk, Sayur, Sup, Buah and Dessert; custom categories belong to one caterer. Library dishes and package slots use the same category IDs. Selecting a dish copies its saved details and serving size into a stable dated-menu slot. Library changes are applied explicitly and never propagate automatically into menus or purchases. Archived dishes remain readable in existing contents; uncategorized dishes must be categorized before assignment to slots.

Package editing defines category counts and optional fixed/range nutrition estimates, alongside the offer's cover photo and commercial terms. The Menu calendar expands in place into a visual package card for one or several selected dates. Large clickable placeholders follow the package composition; selecting one filters the library to its category. Desktop users drag dishes into slots, then advance automatically to the next empty slot. Keyboard selection and the phone tap picker provide equivalent access. Saving requires complete dish slots and applies the same menu atomically to all selected dates. Photos retain upload feedback, every wizard step validates prerequisites, and incomplete packages have a separate draft-save action.

All packages use this one assembly workflow. The explicitly synthetic demo graph is converted together to category-slot templates and dated recipes; this demo-only conversion never runs against live storage. Production purchase snapshots and dated revision boundaries remain immutable.

## V1 boundary

No automatic renewal, wallet, variable daily portions, per-portion menu customization, courier dispatch, corporate/event catering or advanced inventory.

## Implementation and release truth

The local implementation uses explicit synthetic data, shared transactional SQL services, and real web/native source. See docs/IMPLEMENTATION.md and docs/CATERA-V1-IMPLEMENTATION-PLAN.md for evidence and remaining gates. Production launch is not implied by a local build: docs/RUNBOOK.md requires a separate configured Supabase project, SMS/SMTP, Xendit merchant setup and reconciliation, mobile credentials, device tests, backups and monitoring.
