# Catera V1

Catera is an Indonesian catering marketplace: discover a caterer, understand an offer, purchase fixed portions for a generated delivery schedule, receive meals, resolve service issues, and explicitly buy again.

This September 9, 2026 baseline replaces the tenant-specific pilot. The user approved the V1 overhaul and implementation on responsive web and Expo Android/iOS together. Historical pilot requirements are preserved in [Git history](docs/README.md#historical-records); they are evidence, not current instructions. The hosted pilot is preserved and is not the V1 database.

**Status at October 10, 2026 (`v2` branch).** Three applications share one API and transactional database: the responsive web app (`apps/web`), the customer app (`apps/customer`) and the caterer app Catera Dapur (`apps/caterer`). Both native apps are Expo, Indonesian first. Everything is verified only against synthetic data and a DOKU sandbox; no real customer, real payment or store release exists. See [Implementation and release truth](#implementation-and-release-truth).

## Audiences and surfaces

- Public marketplace: address/area selection, search, food-led packages, seller profiles, menus, reviews and comparison of up to three offers at one quantity.
- Global customer account: Beranda, Jelajah, Jadwal, Pesan, Akun on web; Beranda, Jadwal, Jelajah, Akun in the native app (see [Native apps](#native-apps--october-2026)). One calendar across caterers, immutable purchases, saved addresses, support, delivery changes and explicit renewal.
- Caterer web: Hari ini updates delivery statuses through separate lunch/dinner tabs and atomic bulk actions. Jadwal provides a date/package order dashboard with production and whole-day manifest revisions. Publishing, menus, portions-based capacity, customers, support, transactions and staff remain separate workspaces.
- Catera Dapur (caterer app): the phone-first front door for a caterer's day, built on the same backend. See [Native apps](#native-apps--october-2026). The web seller workspace remains for publishing, settlement and heavier work.
- Catera admin web: verification, listing/review moderation, transactions, support/refunds, legacy payout approval, delivery-earned weekly settlement, historical promotions and permanent audit history. Platform admins are distinct from seller owners.

September 17 seller workspace update: Schedule customer/destination metrics group and filter the order list in place. Menu has one package selector; caterer-selected packages show the dated calendar, while customer-choice packages show their available dish library. Marketplace subscriptions originate from customer purchases. The beta objective explicitly restores a simple prepaid migration: owners enter an existing or accountless customer and remaining paid obligations, preview exact dates and confirm atomically without a new charge or payout. Standalone manual customer creation and the separate external-renewal control remain removed; historical records and customer details remain manageable. Invitation links are prepared for the seller to share; preparation does not send messages.

## Saved packages and mobile discovery — October 2 extension

Saved is a private, login-required list of package interests. Saving does not reserve capacity, delivery dates, price, or payment; available entries use current published offers, while unavailable entries retain minimal identity and remain removable. One expiring guest Save intent returns through login to the same filtered/selected card and becomes Saved only after server confirmation. Saved pages load independently of the public catalog's first 100 offers. A cart remains deferred.

Native Discover defaults to one package per deliberate vertical gesture on fitting phone viewports. Since the October 7 UI/UX pass, public web `/` defaults to a scrollable list of photo-led cards on phones, with the vertical swipe feed as a visible alternate. Both keep remembered choice and explicit URL priority. Detail, compare and login returns preserve filters and the selected package; filter changes reset to the first match. Explicit navigation, reduced motion, small-height/enlarged-text list recovery and neutral photo fallbacks preserve access. Desktop discovery uses three photo-on-top columns, and `/home` remains the meal agenda. Web acceptance precedes native release; behavior, local evidence and remaining gates are recorded in [SAVED-DISCOVERY.md](docs/SAVED-DISCOVERY.md).

## Native apps — October 2026

Both apps follow the October 8-10 native UI/UX and motion pass: platform-native tab bars and headers (each tab keeps its own stack), one typeface in bars and labels, mood headers, themed colours, predictive-back handling and photos that fade in. Design contracts are in [DESIGN.md](DESIGN.md) and `docs/superpowers/specs`.

**Customer app.** Four tabs. Beranda leads with today's plate, the next days, "Pilih menu" when a customer-choice menu is due, the renewal card and a one-time Paket selesai recap that leads to renewal. A customer with several plans sees a section per plan, and each plan has a detail screen. Jadwal is a month grid across all packages. Jelajah is area, search and food-led cards with a heart for Saved. Akun holds profile, addresses, Saved, payment history, help and reports, notifications and language. Buying and renewing are one screen each; payment (QRIS or BRI virtual account) ends on a confirmation that shows the food, the first delivery and the reserved days. Sign-in is phone code first, email second. Caterers and admins have no screens here.

**Catera Dapur.** Built around the morning delivery run for home caterers (1-3 people) and small kitchens. Four tabs:

- **Hari ini** (owner and helper): cooking totals by package and dish with a cooking checklist, one session per meal, the numbered delivery route shared as WhatsApp-ready text with map links, and exceptions only (Gagal diantar, Pindah tanggal).
- **Pelanggan** (owner): active, ending and finished customers, WhatsApp chat, renewal links, and an AI-assisted import for moving existing paid customers.
- **Menu** (owner edits, helper views): the week per package, dish autocomplete from the caterer's own library, copy last week, photos.
- **Usaha** (owner): one-screen package editor, the seven money states, team (helper invite) and Aktifkan pembayaran.

Roles are owner and one helper (staff). A helper sees only Hari ini and Menu, with no customers, packages, money or settings. Tab guards enforce this for taps, links and notifications.

Caterer decisions behind the app, from the [caterer simplification design](docs/superpowers/specs/2026-10-07-caterer-simplification-design.md):

1. **Delivery counts as done unless the caterer reports a problem.** A daily job auto-confirms past days. Where no arrival time exists, the app says "Tercatat sampai" rather than implying a time.
2. **Routing and messaging stay on the caterer's own tools.** One-tap sharing to WhatsApp; no WhatsApp API, paid messaging or courier dispatch.
3. **Renewal converts.** Imported paid subscriptions run free until they end. Any renewal or new subscription needs Aktifkan pembayaran. Commission applies only to marketplace-sourced customers. The September 17 removal of standalone manual customer creation and external renewal describes the web seller workspace; the native import assistant is the sanctioned migration path.
4. **Default menu is one menu for everyone**, matching the package composition exactly. Customer-choice stays opt-in.
5. **Must-decide package fields** are name, photo, portion contents, price per portion per day, meal times, delivery days and daily capacity. The rest sits under advanced settings.

The caterer app has not been tested with a real caterer; the study protocol in [CATERER-SETUP-SIMPLIFICATION.md](docs/CATERER-SETUP-SIMPLIFICATION.md) is still unperformed.

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
10. A delivery is treated as delivered once its day passes unless the caterer reports a problem. A reported failure creates support work and does not silently consume or release entitlement.

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

### First caterer setup — September 27 refinement

New packages start with no trial, one cycle and no discounts. After the compatible-reader and validator rollout, price and daily capacity start unentered. Seller/admin drafts may persist `price: null` and `capacity: {}`; an explicitly entered zero capacity remains zero. Publication requires complete commercial fields, and customer-facing offers keep numeric prices. Existing packages and purchases retain their saved terms. Caterers may request verification with a saved draft and publish before approval; customer availability still requires approval. Dated menus remain optional for publication, and payout readiness remains separate.

The five-step editor groups optional settings, summarizes actual configured values, and provides separate draft and publication actions. Inline dish creation saves to the reusable library independently of the package. Today uses the workload buttons for status filtering; the attention queue starts across all dates and both meals and can be narrowed explicitly without following operational-date changes. Whole-day kitchen output remains separate from filtered order totals. See [implementation, compatibility sequence and validation](docs/CATERER-SETUP-SIMPLIFICATION.md).

All packages use this one assembly workflow. The explicitly synthetic demo graph is converted together to category-slot templates and dated recipes; this demo-only conversion never runs against live storage. Production purchase snapshots and dated revision boundaries remain immutable.

## Payments

Direct BRI virtual-account and QRIS checkout run on Catera against the DOKU **sandbox**, with signed callbacks, a durable inbox and recovery by inquiry. New checkouts do not fall back to hosted checkout. Real-money activation, physical banking-app testing and production merchant setup are not done. See [DOKU-DIRECT-PAYMENTS.md](docs/DOKU-DIRECT-PAYMENTS.md). Documents disagree on the production provider: the runbook and AGENTS.md name Xendit, while the verified sandbox is DOKU. Treat the production provider as unresolved until decided.

## V1 boundary

No automatic renewal, wallet, variable daily portions, per-portion menu customization, platform courier dispatch (caterers run their own routes), corporate/event catering or advanced inventory.

## Implementation and release truth

State at October 10, 2026: web, customer app and Catera Dapur are implemented from shared domain, API-client, backend and design-token packages. Android is the native verification target. iOS device testing, EAS builds, store release and real-money transactions are deferred. Native work after October 6 (phases A-E: theme, mood headers, daily loop, renewal, navigation) is planned in `docs/superpowers/plans`. Android runtime and visual acceptance on a physical device remain unrecorded.

The local implementation uses explicit synthetic data, shared transactional SQL services, and real web/native source. See docs/IMPLEMENTATION.md and docs/CATERA-V1-IMPLEMENTATION-PLAN.md for evidence and remaining gates. Production launch is not implied by a local build: docs/RUNBOOK.md requires a separate configured Supabase project, SMS/SMTP, Xendit merchant setup and reconciliation, mobile credentials, device tests, backups and monitoring.
