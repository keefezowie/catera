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
