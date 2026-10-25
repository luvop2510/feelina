# Feelina — Superior design system

## Reference and scope
The user-selected [Superior Framer project](https://framer.com/projects/Superior-copy--Wp5lgldoGPASM3zKBu7g-bFE1j?node=augiA20Il) is the source of the visual direction. Inspected in the user's signed-in Brave session, with its [public preview](https://superior-template.framer.website/) used to verify typography and color tokens. The template's pictured dashboard is a raster mockup, so its visual structure is implemented as working React components using Feelina's existing data and actions.

This replaces the prior plum/serif/fabric direction across all eight routes, auth and account gates, order creation/details, dialogs, forms, tables, badges, reports and print branding. React, Supabase, role gates and business calculations remain in place. The supplied template takes precedence over a random Taste Skill direction draw: no seed or redraw applies.

## Product contract
Feelina is a wholesale apparel workspace used by retailers and internal operations staff. The first dashboard question is: which orders and stock need action? Its primary action is Create order. The signature remains the eight-size ordering matrix, now inside Superior's neutral panels. Color marks stock/order signals; it does not decorate the navigation.

Inventory of product-specific content:
- Retailer shops and contacts, scoped by role.
- Product SKU, name, photograph when available, category and colors.
- Eight sizes: 30=S, 32=M, 34=L, 36=XL, 38=XXL, 40=XXXL, 42=4XL, 44=5XL.
- MRP and selling rates kept separate.
- Drafts, submitted orders and four further fulfilment stages.
- Stock on hand, reserved and available by size/color.
- Server-calculated money in paise, formatted in rupees.
- Recorded payments, outstanding balances and credits.
- Business verification and invoice eligibility.
- Authenticated business access with separate test-only fixtures.

## Tokens
| Role | Light | Dark |
|---|---|---|
| Canvas | #F6F6F8 | #111216 |
| Surface | #FFFFFF | #1B1C20 |
| Ink | #020A0F | #F5F6F7 |
| Secondary text | #50565D | #B7BDC4 |
| Primary action | #202024 | #F5F6F7 |
| Text on action | #FFFFFF | #1B1C20 |
| Panel border | #E6E6EB | #373A41 |
| Control boundary | #898B93 | #777B85 |
| Positive/data | #2D6E16 | #A6DB92 |
| Error | #A52B39 | #FFB1BA |

`tests/design.test.mjs` reads the actual CSS tokens and checks 12 text/background combinations at 4.5:1 or better. Statuses include visible words. The light tokens come from the Superior reference; the dark counterpart is an accessible adaptation, not a claim that the template supplies dark mode.

## Type and geometry
Inter is locally served at 400/500/600/700, matching the reference and avoiding font-network failures. The SIL Open Font License is included under `public/fonts/LICENSE.txt`. The supplied Feelina script logo, 24–26px page titles, 15–18px panel titles, 13–15px primary UI text, 11–12px metadata/axis labels. Numeric columns use tabular figures. Controls remain at least 44px tall (48px action buttons on phones), except the 40px size-matrix inputs with surrounding space.

A 240px neutral sidebar borders an inset white sheet. At 1440px, content width is approximately 1128px: four equal summary cards plus three 16px gaps; the next row uses two equal panels with a 20px gap. Panel radius 12px, sheet radius 16px, control radius 7–8px. Fine borders replace shadows on resting content. Only native dialogs and notifications float with a shadow.

Regular dashboard:
```
| workspace | page name / date / refresh              |
| nav       | Dashboard                  Create order |
|           | value | fulfilment | balance | low stock|
|           | order pipeline    | attention queue     |
|           | recent orders, full-width table         |
```
Compact:
```
| menu | actual logo | refresh |
| title + create order       |
| summary cards              |
| horizontal pipeline bars   |
| attention queue            |
| scrollable order table     |
```
The sidebar becomes a focus-contained drawer at 800px. At 360px and below summary cards stack to keep currency inside their bounds. Dense matrices/tables scroll inside labelled keyboard-accessible regions. No global horizontal scroll.

## Screen questions
- Dashboard: what needs action across orders and inventory?
- Orders: which order should I review or create?
- Catalogue: which product, color, size and price apply?
- Customers: who is the retailer and what do they owe?
- Inventory: which sizes are available or running low?
- Payments: what was received and what remains outstanding?
- Reports: which records match the selected period and customer?
- Settings: which business details, accounts and rates apply?
- Auth: how do I access or recover my workspace?
- Order editor/detail: what quantities, totals and fulfilment actions apply to this order?

## Behavior and accessibility
Apple foundations apply to this web application; native macOS menu-bar and iOS tab-bar conventions do not. Read references include accessibility, layout, typography, color, branding, sidebars, buttons, lists-and-tables and cross-platform guidance. `branding.md › Best practices`: “Express your brand with familiar components.” `lists-and-tables.md › Content`: “Use descriptive column headings in a multicolumn table.”

Preserve semantic controls, labelled inputs, errors retaining data, disabled pending mutations, empty states, role restrictions, unsaved-draft warnings and server authority. Native dialogs close on Escape and restore focus. Mobile navigation closes even when choosing the current route, traps Tab, closes on Escape and moves focus to the destination heading. Hidden navigation is excluded from keyboard focus. Visible focus, system dark mode, increased contrast and reduced motion are supported. All surfaces are opaque; no reduced-transparency exception is needed.

A4 order/invoice layouts preserve the eight-size columns, totals, repeated headers, snapshot content and verification gates. No marketing assets, testimonials, fictional growth percentages or copied Superior customer identities appear in business records.

## Assets and verification
No stock photographs or template screenshots ship in the UI. Existing product photos render when provided; missing images say so. Auth shows a clearly labelled sample quantity row. The public sample workspace has been removed. Synthetic data is confined to tests/browser/fixtures. The supplied logo is used on sign-in, navigation, account gates, order PDFs and receipts.

See `docs/REBRAND-VERIFICATION.md` for final visual critique, executed checks, inspector warnings and deployment evidence.
