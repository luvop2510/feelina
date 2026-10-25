# Feelina UI plan

## Purpose and design thesis
Feelina is an innerwear wholesale operations workspace. Its signature is a paper-like size matrix, where product/colour rows intersect eight familiar sizes. The interface should feel like a well-organised buying desk: quiet, exact and comfortable for long sessions. It is not a marketing store.

## Applied skills
UI/UX Pro Max: semantic controls, 44px targets for primary controls, visible focus, controlled matrix fields, inline errors, responsive scroll regions, role-aware navigation. Apple Design: foundation principles apply to this web application; native macOS/iOS navigation conventions do not. `entering-data.md › Best practices`: offer choices instead of repetitive typing. `lists-and-tables.md › Content`: descriptive column headings. `accessibility.md › Vision`: support larger text and do not rely on colour alone.

## Tokens and structure
Plum #713B64 carries primary actions, light surface #F6F5F7, white cards, ink #27212A, secondary #655D68; semantic status text accompanies every colour. System sans for operational text, Georgia wordmark as restrained brand expression. System dark appearance has separate tokens. Spacing 4/8/12/16/24/32/48px, 10px card radius, 44px controls. No decorative animation or frosted content.

Regular: 224px sidebar | page heading and actions | metrics | order table and activity summary.
Compact: compact brand bar and menu | heading | stacked metrics | horizontally scrollable data region with accessible label.
Order entry: customer/details → product search → exact size matrix → terms and calculated total → explicit save draft. Printing hides workspace chrome and fits the matrix to A4 portrait.

## Flow and authority
Anonymous users see sign-in/retailer registration and an optional explicitly read-only sample workspace. Registered users remain pending until approved. Initial owner provisioning is a service-admin task, never first-user escalation. App data comes from Supabase; calculations in the browser are estimates, authoritative totals come from RPCs. Samples are isolated in memory and never presented as real orders.

## Quality checks
At 375px, navigation remains reachable, dialogs fit and only matrix/table regions scroll horizontally. Forms have labels, errors retain entered data, dialogs trap focus and close with Escape. Reports export CSV with spreadsheet-injection escaping. No action claims success before the server returns. Auth errors and connectivity failures are visible and recoverable.
