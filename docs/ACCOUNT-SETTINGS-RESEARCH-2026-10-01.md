# Account and settings research — October 1, 2026

## Scope and evidence

The supplied screenshot shows the customer `/account` page. Review also covered the current `Account` component in `apps/web/src/components/customer.tsx`, `SellerAccountSettings` and payout/team controls in `apps/web/src/components/seller-account.tsx`, and the settings hash handling in `seller.tsx`. PRODUCT.md and DESIGN.md remain authoritative. This is a refinement of existing web functionality.

Firecrawl search and full-page scraping retrieved these official public sources:

| Source | Observed pattern | Application to Catera |
| --- | --- | --- |
| [Airbnb: Quick access to all your essential account settings](https://www.airbnb.com/help/article/280) | Account settings are grouped by recognizable purposes such as personal information, security, notifications and payments. | Group existing Catera destinations and controls by purpose. Do not copy unsupported features. |
| [Shopify: Managing store details](https://help.shopify.com/en/manual/your-account/manage-orgs-and-stores/manage-store-details) | General settings distinguish public store contact details, defaults and other operational sections. | Make the existing business-profile destination easy to find and distinguish business configuration from personal account controls. |
| [GitHub: Personalize your profile](https://docs.github.com/en/account-and-profile/tutorials/personalize-your-profile) | Users reach settings consistently through the profile menu; changes have explicit edit and update actions. | Keep account entry consistent and use explicit controls for changes. This does not authorize new profile-editing functionality. |
| [Stripe: Web Dashboard](https://docs.stripe.com/dashboard/basics#dashboard-settings) | Settings distinguish Personal, Account and Product categories; team access is managed separately with roles. | Separate personal controls, caterer configuration and owner-only finance/team settings. Preserve role restrictions. |

These are documentation observations, not authenticated visual inspections of the products. Firecrawl returned indexed/cached content for some pages. The research supports information architecture and interaction choices; it does not establish current pixel-level layouts or prove user-study outcomes. One outdated GitHub URL returned 404; the current tutorial linked above was subsequently found and successfully scraped.

Impeccable Operate guidance prioritizes scanability, familiarity, restrained color, consistent interaction states and standard navigation. Catera's approved palette, Jakarta typeface, Indonesian-first copy and business rules remain unchanged.

## Findings and direction

Customer account currently gives equal visual weight to unrelated navigation destinations and a language toggle. Its oversized identity block consumes space, internal links use external-link-style arrows, and an empty address collection leaves an unexplained blank section.

Use a compact identity header and grouped rows for existing account, activity, help and workspace destinations. Use right chevrons for internal navigation. Keep language as a labeled selection with a visible current value. Saved-address management should remain obvious, with an explicit empty state and the existing add action. Keep logout separate and provide pending and recoverable error feedback.

Seller settings currently presents a long stack of account/security, payouts, team, help and profile panels. Add a compact section navigator on wide screens, with an accessible narrow-screen arrangement. Preserve the existing profile route and owner-only financial/team content. Keep consequential payout status and review instructions visible in their section. Place logout after routine configuration rather than making it a leading task.

Suggested section vocabulary: Akun & bahasa; Profil katerer; Rekening & pencairan; Tim katerer; Bantuan akun. These labels organize existing capabilities; they do not define new modules.

## Acceptance criteria

- Customer account and seller settings have a clear title, compact identity/context and recognizable groups; destinations and editable controls have distinct affordances.
- Internal navigation uses a consistent right-chevron cue. Selected navigation, hover, keyboard focus, pressed, disabled and loading states remain legible.
- At phone and desktop widths, rows remain readable and operable without clipped labels, overlapping controls or page-level horizontal overflow. Keyboard focus and reduced motion work.
- Indonesian and English labels fit. Language selection exposes both choices and the current value.
- Empty saved addresses explain the state and provide an add action. Add/edit address dialogs retain validation and the scheduled-delivery warning.
- Logout prevents duplicate submission and exposes recoverable failure without implying that the session ended.
- Seller owner/staff authorization remains intact. No unsupported customer profile editing, notification preferences, payment settings or policy modules are introduced.
- Payout configuration, submitted/rejected review, provider readiness and actual transfer timing stay distinct. Staff invitation creation remains separate from sending a message.
- Existing `/seller/settings#payout` and `#help` destinations and the `#verification` redirect continue to work, including direct navigation.
- Browser verification covers the relevant existing flows, empty/loading/error/recovery states and both supported languages. Local synthetic evidence is reported separately from hosted/provider validation.

This research note is design input. Implementation and verification results belong in the associated change report and must not be inferred from these criteria.

## Narrow-screen navigation follow-up

The first 320px English seller-settings screenshot exposed mid-word wrapping of `Schedule` and `Packages` in the shared bottom navigation. Root verified that the existing bar and item padding leave approximately 57.6px for each label at that width. This is a shared navigation issue, not a reason to add destinations or redesign settings.

Firecrawl search and full-page scraping verified [Google Material 3: Navigation bar guidelines](https://m3.material.io/components/navigation-bar/guidelines). The current guidance pairs destination icons with short, meaningful labels, retains labels, and allocates equal-width segments across the window. As supplementary historical detail, [Material 2: Bottom navigation](https://m2.material.io/components/bottom-navigation#anatomy) explicitly discourages truncating, shrinking and wrapping labels; that page states Material 2 is no longer maintained.

Apply the current pattern by reclaiming horizontal padding at the narrowest supported width and preserving five equal destinations with icons and visible labels. Padding alone was insufficient: the longest label measured about 65.5px against 63.2px available. The final bounded adjustment uses 13px labels only at widths of 360px or less, retaining 14px elsewhere and touch targets of at least 44px. This is an explicit exception to the historical Material 2 advice against shrinking labels, justified by the inspected readable full words at 320px. Natural wrapping remains available under 200% text enlargement to prevent overlap. Acceptance: `Schedule` and `Packages` remain complete on one line at ordinary 320px sizing in active and inactive states; Indonesian remains readable; no item overlaps its neighbor or creates horizontal page scrolling. This is a research-informed layout correction, not adoption of Material styling.

## Payment-state clarity follow-up

The final local screenshots exposed a countdown in both expired and payment-received/booking-review views. Firecrawl search and full-page retrieval of [Stripe: Payment status updates](https://docs.stripe.com/payments/payment-intents/verifying-status) confirmed that payment status distinguishes required customer action, asynchronous processing and completed payment; the authoritative state determines the next action. The retrieved document included an hCaptcha preamble but also the substantive status table and next-action guidance. This is documentation research, not a visual inspection of Stripe Checkout.

The Catera design inference is narrow: a payment deadline should appear only while the existing presentation phase permits preparing or awaiting payment. Hide it while checking payment, after expiry, or when funds were received but booking remains unresolved. Keep the existing received-payment warning and support action. This makes displayed urgency agree with Catera's own server-derived state; it does not adopt Stripe's state machine or change payment, reservation, provider or settlement behavior.


## Recovery-page familiarity follow-up

Firecrawl search and full-page retrieval of the official GOV.UK Design System [page-not-found guidance](https://design-system.service.gov.uk/patterns/page-not-found-pages/) and [unexpected service-problem guidance](https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/) support clear state headings, concise non-blaming explanations and useful recovery information. Their published examples use a constrained main content container. Retrieved content was cached documentation, not visual inspection or a Catera user study.

The local Catera captures showed both recovery pages flush against the screen edge, with a small native-looking retry button in the error boundary. The narrow application is to place existing content in a padded, constrained container and give retry the established Catera button styling and touch target. Preserve the actual reset action, existing recovery text and marketplace destination. Do not import GOV.UK branding, contact details, retention promises or a new support workflow. Acceptance requires a real triggered boundary to recover on retry and the not-found link to reach discovery, with readable Indonesian/English content and no overflow on phone and desktop.
