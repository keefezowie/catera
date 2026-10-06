# Active V1 landscape optimization

Scope: the active marketplace in `apps/web`, Customer home/calendar and Caterer Today/schedule. This extends the approved visual world. Archived pilot implementation and scores do not apply.

## Direction contract

THESIS: Bring the next meal and the next operational action into the first desktop viewport, with related context beside the task.

OWN-WORLD: Preserve the approved forest, cream, sunrise, self-hosted Jakarta type, original food photography and regenerated Catera identity. Customer surfaces stay warm; operational surfaces stay restrained.

STORY: Customers see what arrives next and manage their packages alongside the agenda. Caterers select the date and meal, see workload and exceptions, then work directly through orders.

FIRST VIEWPORT: A shorter food-led discovery introduction leads into horizontal result cards; the first package name and actual package price are readable within 1280×800. Search or committed filters focus the results by removing the introduction. Customer home uses a wide delivery/agenda column and a narrower package column. Seller workload and attention share a desktop row above the full-width order table. Attention exposes the highest-priority real issue and discloses the remaining list; order controls share the table heading and explanatory deadline detail follows the work. Calendars retain date selection above adjacent lunch/dinner groups; a shared summary/mode row exposes both selected meal cards within 1280×800.

FORM: Code-first extension of the approved delivery-cycle direction; no identity or concept-selection round. Named interaction: date/meal selection updates the existing scoped worklist, with existing focus, loading and reduced-motion behavior preserved. Concurrent delivery changes refresh both current delivery truth and date availability before a new review; cutoff expiry disables an already-open change form.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Reference comparisons

- [Shopify Spring '26 orders](https://mobbin.com/screens/a4e33adb-b856-4b54-aa93-7ce15ab4e711): compact scope/status controls directly adjacent to the work table. Adopt the hierarchy, not its commerce rules or branding.
- [Shopify order controls](https://mobbin.com/screens/909c6cdb-f0a1-4183-ab1c-b64f3f2c9aa2): advanced list controls are secondary to the task.
- [HelloFresh delivery overview](https://mobbin.com/screens/24b10f29-df0c-447e-aa28-84a1f60f3157): food and the next arrival remain primary, with management alongside.
- [HelloFresh meal planner](https://mobbin.com/screens/9727fc82-8d4e-483d-81fc-2d2d14c8d5de): date context stays attached to meal planning.

All four screenshots were inspected through Mobbin. No reference pixels are copied into the app. Payment, purchased terms, capacity, menu choice, tenant permissions and settlement behavior are preserved. Synthetic local verification is separate from the hosted production deployment.

## Implemented extension and design consistency — October 5, 2026

This is an ordinary extension of the active V1 surfaces. The documentation pass compared the finished local build with the incumbent `DESIGN.md`, shared tokens, existing CSS and components. It does not establish a new visual world or introduce normative tokens. `DESIGN.md` and `PRODUCT.md` remain byte-identical to `HEAD`; shared design tokens, brand assets, manifests and public asset files have no tracked changes or new untracked assets in this extension. The existing forest/cream/sunrise palette, self-hosted Plus Jakarta Sans, food imagery, rounded controls, quiet borders and distinct customer/operations shells remain in use.

The changed compositions are local surface behavior, recorded here rather than promoted into system-wide rules:

- **Discovery:** from 1100px, the food-led introduction is shorter, heading and search share a row, and two result columns pair each photograph with package facts. The actual package subtotal and per-meal amount precede the action row and menu/nutrition detail. The first package price is within both tested desktop viewports. Search text or committed filters suppress the introduction. Phone discovery keeps the existing Swipe/List experience and food-first card.
- **Customer home:** from 1100px, next delivery and dated meal agenda occupy the main column, with active packages in a 300–340px side column. Each dated agenda group pairs lunch and dinner. Phone keeps next delivery, agenda and then flat subscription rows in reading order; package rows do not become nested cards.
- **Customer calendar:** from 1100px, the date strip uses the available content width, the selected-week summary and view control share a compact utility row, and lunch/dinner details sit alongside each other. Both selected meal cards are visible in the 1280×800 capture. The phone strip, selected-day ring, coverage icons, loading/error text and stacked meal groups retain their established role.
- **Caterer Today:** desktop scope controls lead to workload and compact attention side by side, then the full-width order table. Collapsed attention keeps its explicit scope and highest-priority issue; “View issues” reveals the queue and scope controls. Phone retains the existing three-item preview and full-queue action. Selection/grouping controls share the desktop order heading; task guidance and cutoff detail follow the orders. The first “Start preparing” action fits within the tested 1280×800 viewport.
- **Caterer schedule and details:** date/meal scope, filtered totals and order list retain their sequence. Whole-day kitchen output remains separately labeled. An open desktop order detail uses the full width below the list rather than squeezing the table into a narrow master/detail split. The delivery-detail photograph and factual summary also share the available desktop width.

Current source keeps the commercial explanation attached to offers: delivery days, meal period, subtotal for one portion, included delivery and service fee at checkout. Missing nutrition exposes “Unavailable” to assistive technology while retaining the visual dash. Delivery changes continue to carry the purchase version and server eligibility; expiry disables an already-open change form. A rejected reschedule for capacity, conflict or cutoff clears its review step and reloads both delivery truth and date availability before retry. These are implementation observations; screenshots alone do not verify transactional behavior.

## Evidence checked and verification scope

The documenter opened all fifteen current full-page captures in `.impeccable/review/`: `catalog`, `home`, `calendar`, `seller`, and `seller-schedule`, each at widths `1440`, `1280`, and `390`. Their content matches the named routes and shows explicit synthetic-demo labeling. `evidence.json` records viewports of 1440×900, 1280×800 and 390×844, with no document overflow in all fifteen cases. At 1280×800 it measures the first catalog price at y=728.80 with height 27.59, and the first Today order action at y=720.45 with height 44. Null metric fields are unmeasured targets, not proof of absence. Full-page phone screenshots include the existing fixed bottom navigation at the viewport boundary.

Source evidence checked: root and `apps/web/AGENTS.md`; `PRODUCT.md`; `DESIGN.md`; `packages/design-tokens/src/index.ts`; `apps/web/src/app/globals.css`; and `apps/web/src/components/{application,customer,marketplace,featured-hero,meal-calendar,package-preview,seller-attention,seller-operations}.tsx` plus `landscape.css`. The new layout stylesheet declares no CSS custom properties and no literal colors; it reuses existing colors and applies surface-specific grids, dimensions and type sizes. Relevant browser test definitions checked were `v1-landscape.spec.ts`, `impeccable-journeys.spec.ts`, `impeccable-layout-details.spec.ts`, and `seller-operational-controls.spec.ts`.

The implementation handoff reports nine production-guard checks, 24 regression browser checks, 319 unit checks, 44 native checks, PostgreSQL concurrency checks, typecheck and the optimized build passing. This documentation pass did not rerun those checks and does not treat native source checks as device visual approval. No real production business writes were performed. Current finish-review scores and disposition are intentionally not inferred here; they belong to the separate fresh reviewer result.

## Preserved system files, provenance and existing drift

`DESIGN.md` was preserved (SHA-256 `88d095f3aede8e50b0d930ca092734904efa2a73c72c620c81320fb657b8bece`). `.impeccable/design.json` is absent both in the current tree and at `HEAD`, despite existing prose referring to a sidecar. This is pre-existing drift, reported without creating or repairing the file. The incumbent document also contains earlier layout descriptions (three-column desktop discovery, next-meal/agenda pairing and centered 1040px calendar) that predate the local compositions above. Those descriptions are not silently rewritten by this extension.

Existing asset documentation has a separate pre-existing mismatch: `DESIGN.md` describes all sixteen brand assets as opaque, while the unchanged current brand manifest records fifteen derived transparent UI assets and retained opaque masters. The manifest remains the asset-specific evidence; this pass does not recertify masters or repair the older prose. Sixteen brand asset hashes and all four font hashes match their manifests. All six food-image file hashes match their nested `file.sha256` entries, and each embedded `impeccable:prompt` matches its exact manifest prompt. The unchanged food manifest names the embedded keyword `generation:prompt`; this is a pre-existing metadata-label mismatch, not missing prompt content. Original food dimensions remain 1448×1086; brand master-size limitations remain recorded. No raster, derivative, prompt or manifest was created, replaced, relabeled or deleted.

The shipped documenter agent definition could not be read through the skill resource, so this fresh documenter used Impeccable's `reference/degraded/documenter.md` and `reference/document.md` operating instructions, with `reference/new-work.md` governing ordinary extensions. The context launcher attempt exited 127 because it is absent; direct project reads and the supplied built captures provided the evidence. The implementation handoff likewise reports the detector unavailable; no detector pass is claimed. No visual-world approval or system-refresh question was required because the incumbent system files were preserved. No new normative tokens or named design-system rules were introduced.

## Final correction recheck — October 5, 2026

This bounded recheck supersedes the earlier capture measurements and test counts where stated. Source now labels the calendar summary “Minggu terpilih / Selected week,” accurately naming the selected date's week. When fresh delivery truth makes an open edit ineligible, the dialog replaces its form with Close and Contact caterer actions. Version-keyed forms discard obsolete form errors; a failed or stale read still retains its recovery path. Seller status confirmation lists each submitted customer's name, package, address and portions alongside aggregate scope. Seller refresh copy follows actual loading, separately from the action lock retained after a failed read. Desktop vertical spacing was tightened while using 12px vertical workload/attention padding; the named, focusable order-detail aside has a visible forest focus outline. These remain surface-specific corrections and introduce no normative tokens.

The lead reopened all fifteen refreshed captures; this documenter rechecked `calendar-1280.png`, `seller-1280.png`, current source and the updated `evidence.json`. All fifteen metrics still report no document overflow. The first Today action now starts at y=716.45 with height 44 at 1280×800; the first catalog price remains at y=728.80 with height 27.59.

Final logs inspected: `v1-active-browser-release.log` reports **35 passed** (11 guards and 24 regression checks); `v1-active-unit-release.log` reports **319 passed across 49 files**. Typecheck and optimized-build release logs complete successfully. The PostgreSQL release log records the concurrency checks, with exit 0 confirmed by the implementation handoff after test-only pool/socket shutdown cleanup; no application backend change was made for that cleanup. Prior native evidence remains 44 checks across 10 files, as supplied by the handoff, without a fresh device-visual claim. No real production business writes were performed.

`work/finish-review/verdict.md` records **ship for the selected-week wording fix only** after its three calendar recaptures and EN/ID guards. That bounded disposition is not a whole-surface approval or a new numeric score. The latest full independent A review was **30/40 before the final corrections**; the 36/40 target remains unmet and unrescored. No 36/40 claim is made.

The recheck again confirmed the recorded `DESIGN.md` hash, no changes to protected design tokens/assets/manifests, and the continued absence of `.impeccable/design.json`. Existing drift above remains reported without repair. Only this surface record was appended; no source, raster or system file was edited by the documenter.


### Final publication-evidence update

The final desktop workload/attention vertical padding is 12px. The refreshed 1280×800 Today capture places the first action at y=708.45 with height 44, superseding the preceding measurement. `work/publish-review-a/probe-results.json` verifies the complete Indonesian long-status order row ends at y=794.91 with either one or three attention issues; the English row ends at y=775.72. The lead reopened the six changed Today/schedule captures; unchanged surfaces retain their preceding capture evidence.

`v1-active-browser-publish-verified.log` reports **16 passed**: 12 landscape guards, including the new standalone Indonesian whole-row fit test, and four seller-control checks. Combined with the preceding 24 regression checks, this yields **36 distinct relevant browser checks**, not a heuristic score. The earlier 35-check run comprised 11 guards and those 24 regressions. Final optimized build (`v1-active-build-publish.log`) and typecheck (`v1-active-typecheck-publish-final.log`) completed with exit 0 as confirmed by the handoff. The bounded review scope, unrescored 36/40 target, preserved system files and provenance limitations above remain unchanged.


## Desktop task continuity refinement — October 6, 2026

This ordinary refinement extends the approved V1 world. The October 5 statement that DESIGN.md was byte-identical describes that earlier pass. This pass narrowly merges reusable Dialog focus behavior into DESIGN.md and creates its missing schema-v2 sidecar; the normative YAML remains byte-identical. Forest, sunrise, cream, Jakarta type, shared tokens, PRODUCT.md, package dependencies and existing artwork retain their incumbent authority. No assets were generated or changed, so this pass adds no asset provenance claim.

### Recorded surface behavior

- **Package commitment:** the booking panel leads with the selected package total, followed by package name, fixed portions and delivery-day count. The secondary per-meal figure divides that commitment by its total meal portions. Delivery inclusion and the service fee calculated at checkout remain explicit; duration selection remains at checkout. The phone package view keeps its existing jump to pricing and portions.
- **Attention scope and identity:** desktop Today keeps one compact issue alongside workload; “Lihat masalah” opens an independently scrolling right drawer without expanding the order-table area. The drawer repeats all-date/selected-date/future scope, meal scope and timezone. Entries carry available request context, issue type, customer/package/date/meal identity, a short reference, timestamp and next action. Missing identity fields are omitted rather than invented. Scope filters, additional issues, loading, errors and empty states remain inside this task. The drawer uses the shared modal layer and a logical attention-heading fallback.
- **Bounded order facts:** the inline order detail caps its facts at 800px to keep labels and values associated on wide displays. Escape closes that detail through its existing return path when a nested control has not already handled the key. Whole-day kitchen output remains separate from filtered orders.
- **Rescheduling and recovery:** choosing a replacement explains that skipping a date means moving its delivery, with delivery count and portions preserved. Review replaces editing controls with the old/new dates, meal, portions, address and menu-choice consequences. “Ubah tanggal pilihan” returns to the retained picker value. Rejected changes leave review and refresh current delivery truth and date availability; failed refresh has one local recovery narrative with a retry, retains the selected date, and prevents confirmation against stale data. Cutoff or status closure focuses the explanation and offers close/contact actions. Returning focus uses the management heading if the original action is no longer available.
- **Receipt confirmation:** “Tandai diterima” opens a title-focused confirmation with date, meal, source/destination status, valid orders, portions and customer destinations. The explanation distinguishes receipt of the selected meal from completion of every meal in the delivery day and from settlement payment. A fresh unchecked acknowledgement must be selected before submission. Pending work blocks duplicate action and dismissal; an outcome or the order heading supplies fallback focus if the original action disappears.
- **Task metadata:** affected workload, compact attention and order-action metadata uses 12px text; the drawer uses 14px issue titles and 12px supporting facts. Discovery badges and workspace identity also receive local readability corrections. These are scoped implementation values, not a revised typography scale or permission to shrink new task text. No token was changed to clear a readability finding.

### References actually consulted

The session inspected the [Linear inbox](https://mobbin.com/screens/8337813e-f0dd-4415-8a29-87c114b0442b) and [unread inbox](https://mobbin.com/screens/18c6955a-c42f-4cc1-9aa2-0276456720fb) previews for identifiable issues alongside the operational workspace; [Airbnb confirm-and-pay](https://mobbin.com/screens/4b00d9f1-234d-413c-901a-0c26bd1def9a) and [review reservation](https://mobbin.com/screens/bcd5d2bf-5f5f-4b4b-9967-4fccc6e7450d) previews informed commitment identity near the decision. No reference pixels or foreign product rules were copied. A Firecrawl search excerpt for the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) supported logical focus restoration when the invoking element no longer exists; this is not a claim of full-page retrieval. The session notes are in `work/desktop-optimization/reference-notes.md`.

### Local evidence and limits

The documentation pass inspected current components/CSS and these nine actual captures from the local candidate on port 3147, under `work/desktop-optimization/`:

- `1920x1080-id-package.png`, `1920x1080-id-drawer.png`, `1920x1080-id-receipt.png`.
- `1920x1200-en-package.png`, `1920x1200-en-drawer.png`, `1920x1200-id-review.png`.
- `1280x800-id-seller.png`, `390x844-id-package.png`, `390x844-id-receipt.png`.

Captures establish these visible states; dynamic focus, pending, refresh and recovery behavior is recorded from the implementation and requires behavioral verification. The desktop pass does not redesign the phone layout or certify the full application. Remaining checkout requote action, checkout/order-detail density and carousel pause work is outside this refinement's completed scope. The separate finish record is `work/wide-finish-review/verdict-final.md`; this documentation supplies no new grade, production-release approval, native-device certification or artwork acceptance.

### Final independent assessment and verification — October 6

Fresh isolated A and B assessments covered the optimized local synthetic candidate. A completed before B's sealed detector findings entered synthesis. The final desktop assessment is **36/40**, with all ten Nielsen heuristics applicable, primary viewports 1920×1080 and 1920×1200, and 1280×800/390×844 compatibility guards. A's bounded final focus-helper recheck retained 36/40 without increasing scores. This supersedes the earlier unrescored desktop target above; it does not extend the score to phone, native, admin or settlement flows. The archived report is `.impeccable/critique/2026-10-06T02-55-50Z__apps-web-src-components.md`.

Three P2 issues remain: checkout CONFLICT needs a local refresh/requote action; checkout review and seller detail could use wide space more efficiently; the discovery carousel needs a persistent pause/resume control. No P0/P1 was observed in the inspected desktop flows. Earlier 31/40, 31/40 and final 36/40 snapshots have different responsive emphasis; this is not a uniform whole-app trend.

Final verification: typecheck (including native source), optimized build, 319 unit tests across 49 files, 44 native Jest checks across 10 suites, and PostgreSQL concurrency checks passed. There are **46 distinct relevant browser checks**: 34 desktop/landscape checks and 12 selected shared-dialog checks. In the final 34-check run, 28 passed and six geometry assertions exposed subpixel scroll rounding; a one-CSS-pixel tolerance was added and all six passed on rerun. This tolerance still rejects the previously offscreen focus target. The selected shared-dialog checks then all passed against the final source. The full conditional-UI suite is not claimed.

Reproduction against an explicitly synthetic optimized local server on 127.0.0.1:3147:

```sh
npx playwright test --config=playwright.desktop-ux.config.ts v1-desktop-ux.spec.ts v1-landscape.spec.ts
npx playwright test --config=playwright.desktop-ux.config.ts conditional-ui.spec.ts --grep 'confirmation hierarchy|short viewport|customer address'
```

B recorded 24 selected-route axe/overflow observations with zero axe violations or document overflow, and tested controlled conflict, failed-read/retry, pending, cutoff expiry, receipt acknowledgement and paginated attention states. The real detector reported 82 advisory token/catalogue mismatches; these are not 82 established UX defects. Injected browser detector execution succeeded in four headless pages; no user-visible overlay is claimed. Local browser business commands were intercepted; no actual purchase, payment, reschedule, status or message mutation was performed. This evidence does not certify real provider behavior or physical devices.
