# Twenty UX details: design

Date: 2026-10-26. Branch: `v2`. Apps: `apps/web` (Next.js 16), `apps/customer` and `apps/caterer` (Expo SDK 57), shared `packages/mobile-ui`, `packages/mobile-core`.

## Goal

Check Catera against twenty UX details and build each one that fits the product and is missing. Skip what doesn't fit and what needs backend or hosted work that can't be done from the repo. Constraints from the owner:

- Use what the project already has before adding a library; match the code style around each change.
- Every animation respects reduced motion.
- Build one item at a time and run the project's checks after each.
- Finish with all twenty marked Built, Already done or Skipped.

Success: each Built item has a test or a recorded browser check; `npm run typecheck`, `npm test`, `npm run build` and both mobile Jest suites pass, except failures that also happen without these changes.

## Triage

| # | Detail | Decision |
|---|---|---|
| 1 | Skeleton loaders | Built before this spec (mobile 300ms delay). Web keeps its delayed mascot loader (DESIGN.md). Review only. |
| 2 | Optimistic updates | Built before this spec (web Save, `useOptimistic`). Mobile Save and push switch were already optimistic. Review only. |
| 3 | Command menu | Built before this spec (seller and admin web dashboard). Review only. |
| 4 | Shortcut hints | Built before this spec, with item 3. Review only. |
| 5 | Undo toasts | Built before this spec (web toast action, Saved removal Undo, mobile `role="status"`). Review only. |
| 6 | Stale-while-revalidate | Build (section A). |
| 7 | Prerendering | Skip. Next's `<Link>` already prefetches routes in view, and its client-side navigations never use a prerendered document, so speculation rules would only add server renders. Logout is a POST, not a link. |
| 8 | BlurHash placeholders | Skip. Images are bare URL strings inside package and dish jsonb with shape validators; a hash needs schema migrations, upload route changes and RPC changes. |
| 9 | View transitions | Skip. WEB-MOTION.md keeps headers and navigation stationary and gives routes a heading-only entrance; Next client navigations don't trigger `@view-transition`, and React's `<ViewTransition>` would replace the approved motion system. |
| 10 | Swipe-to-dismiss sheets | Already done on mobile (native `formSheet` with grabber and detents, `Tutup` button on iOS). The web has no bottom sheets to convert. |
| 11 | Interruptible animations | Already done on mobile (Reanimated shared values retarget; springs on press). Web skip: dialog and menu keyframes are 120 to 220ms, never block input, and Radix exit presence waits on `animationend`, so moving them to transitions breaks dismissal. |
| 12 | Predictive back | Build (section B). |
| 13 | Hit slop | Build (section B). |
| 14 | Safe-area insets | Build the web part (section B). Mobile already uses `react-native-safe-area-context` throughout. |
| 15 | One-time-code autofill | Already done for inputs on all three apps. The SMS text is a hosted Supabase Auth setting; skip and give the owner the template line. |
| 16 | Tabular numbers | Build the gaps (section B). |
| 17 | Balanced headlines | Build the gaps (section B). |
| 18 | Continuous corners | Build (section B). |
| 19 | Idempotency keys | Already done: `catera_v1_command` stores a receipt per actor and request id and replays it; web `perform` and mobile `command` reuse the id across retries; Xendit gets `idempotency-key`, DOKU a stable invoice number; submit buttons disable while pending. |
| 20 | Safe triangle | Skip. The only web menu is the single-level profile menu, opened by click. |

## Section A: stale-while-revalidate (item 6)

Both data layers reload everything when a global `revision` counter changes; today it moves only after a command, a push or a realtime event. A background refetch must not reuse that path, because some screens show their skeleton whenever `loading` is true (for example AddressForm) and a command reload is expected to show progress.

Design:

- A second counter, `resumed`, sits beside `revision` in each provider. It moves when the app or tab comes back and when the network returns, at most once every 30 seconds.
  - Mobile (`packages/mobile-core/src/provider.tsx`): the existing AppState listener bumps it on a return from background or inactive; a NetInfo listener bumps it on a `isConnected` false-to-true change. NetInfo is already a dependency of both apps.
  - Web (`apps/web/src/components/context.tsx`): one effect listens for window `focus`, `visibilitychange` to visible, and `online`.
- `useData` (mobile) and `useResource` (web) reload quietly when `resumed` moves: only when the hook already has data for the same key, without setting `loading`, and a failed quiet reload leaves the screen as it was (the next resume tries again). A screen with no data yet is already loading on its own.
- Nothing new paints from cache. The existing `cached` option stays on the Beranda and Dapur day screens only; balances, stock and payment screens get fresher data on resume and never show a kept copy in place of a live read. PaymentScreen and the web payment page keep their own polling.

Tests: Jest for the provider counter (AppState return, NetInfo reconnect, the 30s throttle) and for `useData` keeping data and `loading` false during a quiet reload; vitest with jsdom for the web events and `useResource`.

## Section B: the small items

- **12 Predictive back.** `android.predictiveBackGestureEnabled: true` in `apps/customer/app.config.ts` and `apps/caterer/app.config.ts`. Expo Router and react-native-screens already handle back through the system dispatcher. The one `BackHandler` listener (customer PaymentScreen, only once paid) keeps working; that screen loses the preview only while it holds back. Takes effect in the next native build, not Expo Go.
- **13 Hit slop.** Check each small target the audit found (customer DayBlocks `more`, ReportList pill, DishCard, PaymentScreen, ClaimScreen; caterer UsahaScreen; mobile-ui SettingsRows). For each one that is pressable, reach 44pt on iOS and 48dp on Android with `hitSlop` or padding, without overlapping a neighbour, using the existing `useTouchTarget`/`useChipHitSlop` helpers where they fit. Non-pressable badges stay as they are.
- **14 Safe area (web).** `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }` in `apps/web/src/app/layout.tsx`. The existing `env(safe-area-inset-*)` rules then take effect on notched phones.
- **16 Tabular numbers.** Mobile: `fontVariant: ["tabular-nums"]` on the price, total and count lines the audit listed that lack it. Web: confirm price, total and countdown classes; add the property where missing.
- **17 Balanced headlines.** `globals.css`: add `h4` to the existing `text-wrap: balance` rule and `p, li, figcaption { text-wrap: pretty; }`.
- **18 Continuous corners.** Mobile: add `borderCurve: "continuous"` next to `borderRadius` in the shared mobile-ui components and app files the audit listed, leaving circles (radius equal to half the size) alone. Web: `@supports (corner-shape: squircle)` adds `corner-shape: squircle` to the shared card, dialog, input and rectangular button rules, keeping each existing `border-radius`; pills and circles are excluded because a squircle changes their shape.

## Review of items 1 to 5

The plan ends with an independent code review of the whole diff, items 1 to 5 included, against this spec and AGENTS.md, followed by fixes for confirmed findings.

## Out of scope

Hosted Supabase settings, schema migrations, native builds, release and deployment.
