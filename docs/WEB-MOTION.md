# Catera web motion — implementation and verification

This is the original implementation record. Subsequent combined verification and the authorized `v1` integration are recorded in [the journey and motion integration report](V1-JOURNEY-MOTION-INTEGRATION-2026-09-24.md).

Implemented locally on `codex/web-motion`, based on `v1` at `033fb5b`, in `C:\Users\nidal\.codex\worktrees\web-motion\catera`. The original checkout and its existing local changes were preserved. No push or deployment was performed.

## Motion choices

The existing forest, sunrise and cream palette, typography, food artwork and Indonesian-first copy remain the visual identity. Motion uses CSS for ordinary states and the existing Web Animations API approach for committed content changes. There is no new animation dependency, public API, schema, permission, payment rule or native change.

| Moment | Implementation | Why it helps |
| --- | --- | --- |
| Shared rhythm | Web-only 120ms control, 180ms selection, 220ms surface/content and 320ms featured tokens; existing `cubic-bezier(.16,1,.3,1)` entrance easing | Related interactions feel consistent without making routine work wait. Shared/native token exports remain intact. |
| Food discovery | Existing 1.025 image hover settles in 220ms, only with a precise hover-capable pointer. Detail imagery settles within its reserved, clipped frame over 320ms. | Food gets the emphasis; touch scrolling does not trigger sticky zooms or change image geometry. |
| Filters and comparison | Visible result cards enter together by 6px after an explicit selection, with no stagger. Offscreen cards and the whole list are not animated. Search typing and locale changes do not replay the entrance. The comparison tray enters only on mounting. | Selections have a clear response without distracting from reading or penalizing long catalogs. |
| Featured carousel | Six-second autoplay, swipe, arrows and dots remain. Playback button removed. Hover temporarily pauses; keyboard focus, arrows, dots and drag stop autoplay for that carousel instance. Hidden/offscreen, reduced-motion and single-offer states do not advance. | Discovery keeps its existing character while yielding immediately to interaction. |
| Routes | A newly ready heading gets a short entrance. No keyed/remounted form wrappers; headers, sidebars and navigation remain stationary. Query updates, locale changes and background refreshes do not replay it. | The new destination is clear while persistent navigation stays familiar. |
| Menus and dialogs | Menus move 4px from their placement origin; dialogs arrive by 8px in 220ms and dismiss by 4px in 120ms. Translation composes with Radix positioning. | Small spatial cues explain the surface hierarchy. Dialog focus trapping and layer registration remain active through dismissal; pending guards and focus return are preserved. |
| Checkout and package steps | Content enters from the right going forward and the left going back. Checkout summaries, sticky payment actions and editor footers stay outside moving content. | Direction communicates progress while actions stay in place and drafts stay intact. |
| Menu assembly | Retained its local panel-height transition, normalized to 220ms, with cancellation on preference changes. Selected slot color and completion marks use 180ms feedback. | The work area changes without moving the dish library or surrounding controls. The existing bounded panel-height transition is the intentional layout-animation exception. |
| Pending and save feedback | Idle and pending labels share a reserved grid cell. Compact save checks and an 8px toast entrance replace larger movement. Errors remain stationary. | Buttons keep their dimensions and successful saves are noticeable without celebration on every operation. |
| Confirmed payment | Existing confirmation artwork settles once over 320ms; its checkmark settles over 220ms. Only the existing `paid` plus subscription branch renders this moment. | The meaningful outcome gets character without suggesting that an unconfirmed payment succeeded. |
| Reduced motion | CSS transitions/animations stop; active WAAPI motion is cancelled to the visible DOM state. Carousel motion and active smooth calendar scrolling stop on a live preference change. Status text remains visible. | The same task remains understandable and usable without movement. |

The slow hero clipping entrance was removed. The mascot loader's delayed reveal, neutral fallback, hidden/offscreen pause and immediate completion remain unchanged. Seller rows and financial totals do not bounce, stagger or count up. No continuous animation-frame loop, broad `will-change`, new decorative loop or artificial task delay was added.

Two issues found during verification were fixed: editor validation now focuses the invalid field after pending controls are released, and guest-header spacing below 341px accommodates the existing controls without shrinking their touch targets. The latter was reproduced on the unchanged baseline at 320px (322px document width).

## Before and after evidence

The 21 original exploration captures are copied into [`output/playwright/motion/original`](../output/playwright/motion/original). Before editing, the isolated instance also captured successful checkout/payment, editor validation, editor progress and draft saving: six `before-*` captures in [`output/playwright/motion`](../output/playwright/motion).

Representative comparisons:

| Journey | Before | After |
| --- | --- | --- |
| Confirmed payment, Indonesian phone, same checkout | [Before](../output/playwright/motion/before-id-390-payment-success.png) | [After](../output/playwright/motion/matched-after-id-390-payment-success.png) |
| Confirmed payment, Indonesian desktop, same checkout | [Before](../output/playwright/motion/before-id-1440-payment-success.png) | [After](../output/playwright/motion/matched-after-id-1440-payment-success.png) |
| Editor progress, Indonesian phone | [Before](../output/playwright/motion/before-id-390-editor-step.png) | [After](../output/playwright/motion/after-id-390-editor-step.png) |
| Duration dialog, English desktop | [Before](../output/playwright/motion/original/motion-before-en-desktop-duration-dialog.png) | [After](../output/playwright/motion/after-en-1440-duration-dialog.png) |
| Duration dialog, English phone | [Before](../output/playwright/motion/original/motion-before-en-mobile-duration-dialog.png) | [After](../output/playwright/motion/after-en-390-duration-dialog.png) |
| Menu assembly, Indonesian desktop | [Before](../output/playwright/motion/original/motion-before-id-desktop-menu-assembly.png) | [After](../output/playwright/motion/after-id-1440-menu-assembly.png) |

Screenshots show the final layout; the Playwright traces contain intermediate movement. The final captures use 1440×1000 and 390×844. Reflow captures cover 768px and 320px. Synthetic fixtures created by the verification suites add catalog entries, so catalog/draft-list counts are not pixel-identical to the original exploration. The matched payment views use the exact baseline checkout.

## Verification

Mutation-capable testing used explicit demo mode, `.data/web-motion`, `.next-motion-dev`, and `http://127.0.0.1:3146`. Production compilation used separate `.next-motion-build` output. No hosted/shared records were mutated.

- Indonesian and English: food discovery, filter selection/reset, comparison, details, checkout steps/consent, pending submission, confirmed synthetic payment, customer calendar, seller schedule, editor validation, forward/back steps and draft saving.
- Menus and overlays: nested confirmations and previews, Escape, Tab/focus return, repeated close/open, menu replacement cancellation, retained drafts, failures/retry, pending-action guards, keyboard slot selection and drag/drop.
- Mobile: 390×844 journeys, 320px/768px reflow, touch carousel swipe and vertical scrolling using Chromium touch events. Desktop checks use 1440×1000. Existing short-height overlay checks also pass.
- Reduced motion: startup behavior, a real in-flight step animation cancelled to `idle` when the preference changes, active seller calendar scroll cancellation, carousel autoplay suppression, immediate manual navigation, and retained loading/status text.
- Stability: duplicate checkout submission produces one request; pending button width/height are unchanged; persistent chrome is retained; live validation focus works; search keystrokes and locale changes do not restart content motion.
- Accessibility assertions in the existing suites cover carousel, menus, dialogs and responsive operational/customer surfaces. No new runtime page errors were observed in the journey runs.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed, including web, existing native workspace types and repository TypeScript |
| `npm test` | 37 files / 261 tests passed |
| `npm run build` | Optimized web build passed |
| `npm run test:postgres` | All 26 grouped concurrency checks passed against local PostgreSQL |
| Relevant Playwright suites | 85 distinct scenarios passed across the ten suites below, including focused reruns after fixes |
| `git diff --check` | Passed |

The [browser scenario index](../output/playwright/motion/browser-summary.json) records each scenario's latest result and report. The [PostgreSQL record](../output/playwright/motion/postgres.json), [typecheck log](../output/playwright/motion/typecheck.log) and [build log](../output/playwright/motion/build.log) preserve local check evidence. Initial failures remain in earlier reports; the latest mobile acceptance report includes the corrected 320px header and the 320px/768px discovery/checkout checks in both languages.

## Performance and layout observations

The same English duration-dialog open/close interaction was sampled at 390×844 with Chrome CPU throttling at 4× on the unchanged baseline and the implementation. Both recorded zero non-input layout shift. The panel remained approximately 358.286×812px throughout each sample. Small input-associated scroll-lock shifts were present (baseline approximately 0.00105 combined; after approximately 0.00052); these do not count toward CLS.

These are single local development samples, not production Core Web Vitals or physical-device benchmarks. The after sample recorded four layouts and about 25.8ms aggregate layout work over the whole interaction. Transform/opacity entrances require no app-owned per-frame callback. Menu assembly retains its existing, bounded height measurement and resize observer. The 4× CPU browser journey remained operable while reduced motion cancelled active movement.

## Reproduce

Start a disposable instance with explicit synthetic storage and loopback URL, then use `playwright.polish.config.ts` with `CATERA_POLISH_URL=http://127.0.0.1:3146` and a task-specific `CATERA_EVIDENCE_RUN`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to the local Chrome executable when needed. Run the relevant suites with `--trace on`:

```text
featured-hero.spec.ts
navigation-controls.spec.ts
calendar.spec.ts
conditional-ui.spec.ts
polish-operational-focus.spec.ts
polish-recovery.spec.ts
seller-operational-controls.spec.ts
slot-menus.spec.ts
mascot.spec.ts
web-motion.spec.ts
```

Local reports/traces are in `output/polish-v1/motion-*-report` and `output/polish-v1/motion-*-results`. Initial failed attempts are retained for diagnosis. Two older menu-suite assertions were updated: the conflict message is scoped to its work panel, and the checkout fixture supplies the currently required terms acceptance. Business gates were not relaxed.

Remaining limits: verification uses local synthetic payment, Chrome desktop/mobile emulation and CPU throttling. It does not certify provider callbacks, hosted authentication/storage, Safari/Firefox, physical-device behavior or production performance. The existing development wordmark LCP hint remains unrelated to these motion changes.
