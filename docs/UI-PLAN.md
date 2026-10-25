# Feelina UI plan

## Purpose and design thesis
Feelina is an innerwear wholesale operations workspace. Its signature is a paper-like size matrix, where product/colour rows intersect eight familiar sizes. The interface should feel like a well-organised buying desk: quiet, exact and comfortable for long sessions. It is not a marketing store.

## Applied skills
UI/UX Pro Max: semantic controls, 44px targets for primary controls, visible focus, controlled matrix fields, inline errors, responsive scroll regions, role-aware navigation. Apple Design: foundation principles apply to this web application; native macOS/iOS navigation conventions do not. `entering-data.md › Best practices`: offer choices instead of repetitive typing. `lists-and-tables.md › Content`: descriptive column headings. `accessibility.md › Vision`: support larger text and do not rely on colour alone.

## Tokens and structure
The user-selected Superior Framer template now supplies the visual system. See [the design contract](../design-system/feelina/MASTER.md) for tokens, responsive wireframes, typography, screen mapping and preservation requirements. The previous plum palette, serif wordmark and fabric illustrations are retired. The implementation uses local Inter fonts, near-black actions, neutral surfaces, fine borders and green data signals.

Regular: 240px sidebar | inset content sheet | four summaries | pipeline and attention | full-width recent orders.
Compact: menu and page context | title and action | summaries | horizontal pipeline | attention | internally scrolling tables.
Order entry retains customer/details → product search → eight-size matrix → terms and calculated total → explicit save draft. Printing preserves A4 order/invoice structure.

## Flow and authority
Anonymous users see sign-in/retailer registration. Public sample access is removed. Registered users remain pending until approved. Initial owner provisioning is a service-admin task, never first-user escalation. App data comes from Supabase; calculations in the browser are estimates, authoritative totals come from RPCs. Synthetic fixtures are kept in tests and are not bundled into the app.

## Quality checks
At 375px, navigation remains reachable, dialogs fit and only matrix/table regions scroll horizontally. Forms have labels, errors retain entered data, dialogs trap focus and close with Escape. Reports export CSV with spreadsheet-injection escaping. No action claims success before the server returns. Auth errors and connectivity failures are visible and recoverable.
