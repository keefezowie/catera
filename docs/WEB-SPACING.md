# Web spacing

Use the existing design-token scale: `--space-xs` (4px), `--space-sm` (8px),
`--space-md` (12px), `--space-lg` (16px), `--space-xl` (24px),
`--space-xxl` (32px), and `--space-section` (48px). The root layout exposes these
from `packages/design-tokens`; do not maintain a second scale in component CSS.

Spacing belongs to the container. A vertical content group can use `className="flow"`:

```tsx
<section className="flow">
  <h2>Heading</h2>
  <p>Useful instructions.</p>
  <button className="button">Continue</button>
</section>
```

Flow supplies a 16px gap and resets direct-child block margins so spacing does
not accumulate. Direct action controls keep their intrinsic width. A component
can set `--flow-space: var(--space-md)` for a compact group. Nested groups set
their own spacing; form fields, grids, tables and inline icon-label pairs retain
their specialized layouts. Use existing `.form`, `.field`, and `.form-row`
patterns for forms rather than adding flow to every wrapper.

Seller Today and Schedule use flow for their top-level sections, including
conditional loading and verification notices. The same gap separates a notice
from the following filters without individual margin patches. Existing section
margins are cleared at this group boundary to avoid double spacing.

Use `Disclosure` for expandable content. It supplies a padded summary, a 12px
separation before content, and a 12px flow between body blocks. The panel variant
has 16px side padding. New body children inherit these defaults without local
margin fixes. Explicit layout exceptions, such as the full-width production
panel, remain scoped to that component.

Do not add universal padding or margins to every element. Nested controls,
icons, tables, and fixed-size layouts would accumulate space and could overflow.
When adapting an existing group to flow, remove its competing sibling margins
and check both languages, phone widths, expanded content, and keyboard focus.

The spacing regression suite measures positive gaps and actual content insets,
including closed and open disclosures on seller, customer, checkout, and admin
routes. Run against an isolated synthetic demo:

```powershell
$env:CATERA_SPACING_URL = 'http://127.0.0.1:3261'
npx playwright test --config playwright.spacing.config.ts
```
