# Feelina product requirements

Status: implementation baseline, 25 October 2026. Product brief: user-supplied `prompt.txt`. API and data contract: `docs/CONTRACT.md`. Verification results belong in `docs/ACCEPTANCE.md`; this document does not certify a release.

## Purpose

Replace handwritten retailer orders with a dependable size-wise ordering workspace for Feelina. The primary task is to select a customer, select products and colours, enter quantities under eight size columns, and save a correctly priced order. This is an order management system, not a conventional shopping cart.

Internal staff need fast desktop entry and clear handoffs. Approved retailers need their own prices, orders, payment history, and restricted access. Mobile supports the same order matrix through horizontal scrolling rather than hiding sizes.

## Known inputs and unresolved facts

- Brand name: Feelina. The brief's proposed legal name, Inner Glow Intimates Private Limited, is unverified and must not be presented as verified.
- No reference invoice image/PDF was available. Preserve the specified column order, but visual fidelity and size labels cannot be signed off until it is supplied.
- Default numeric sizes: 30, 32, 34, 36, 38, 40, 42, 44. Provisional labels S, M, L, XL for the first four are configurable and require business verification.
- The owner email and registered company details will be supplied later. Registration never grants owner access automatically.
- The user authorized a new Feelina cloud project. Company ownership and access must be recorded at handover.
- GST rates, GSTIN, bank information, payment terms, and product catalogue must be configured from verified business records. No statutory defaults are invented.

## Capability map

| Module | Responsibility | Depends on |
|---|---|---|
| identity | Authentication, retailer approval, account status, staff permissions | — |
| catalogue | Products, colours, sizes, prices, customer price lists | identity |
| customers | Contacts, addresses, credit terms, customer assignment | identity |
| orders | Matrix entry, immutable snapshots, numbering, lifecycle | catalogue, customers |
| inventory | Reservations, dispatch, adjustments, returns | orders |
| accounts | Payment entries, balances, invoice gates | orders |
| reporting | Order, payment and stock summaries and exports | inventory, accounts |

Build order follows these dependencies. Each phase must pass its own tests before it is described as complete.

## Workflow and acceptance conditions

### Identity and access

Seven roles: owner, admin, sales, inventory, accounts, fulfilment, retailer. New registrations become pending retailers. An authorized administrator associates a customer and approves an account. Pending, suspended and deactivated accounts cannot use business functions. Retailers see only their assigned customer records and prices. Role and account status are checked on the server for every protected mutation; hidden UI controls are not permission controls.

Initial owner assignment is an administrator operation performed after the owner email is confirmed. Do not use a public first-user-wins bootstrap. Administrators must not grant themselves owner access or remove the last owner.

### Catalogue and customers

Products have unique SKU, name, category, image reference, MRP, retail/wholesale rates and active status. Product-colour-size variants hold stock individually. Searchable product selection is required; users do not retype product names. Customers have shop/contact/address details, optional GSTIN, price list and credit terms. Creating a customer while entering an order preserves the draft.

### Order entry and calculations

The matrix columns remain: serial number, particulars with colour, MRP, 30/S, 32/M, 34/L, 36/XL, 38, 40, 42, 44, quantity, rate, amount. Each product-colour pair is one line. Add/remove lines and keyboard entry must work. MRP and selling rate remain separate.

Store money in integer paise. The database resolves the applicable price list and rates, rejects invalid quantities, computes quantities, subtotal, authorized discount, configured tax and total, and ignores browser-supplied financial totals. Snapshot rates and customer/business details so later catalogue or profile changes do not rewrite historical documents. Display INR and Indian-numbering amount in words.

Drafts can be edited by permitted users. Submitted orders keep their commercial terms. Duplicate an earlier order as a new draft priced from current policy. Save orders durably in the cloud; no browser-local business database.

### Lifecycle and inventory

Draft → submitted → confirmed → processing → packed → dispatched → delivered. Confirmation atomically reserves stock; dispatch consumes stock and reservation. Concurrent confirmations cannot oversell. Eligible cancellations release reservations exactly once and create an audit entry. A failed operation rolls back all of its changes. Return quantities cannot exceed quantities actually delivered/dispatched less earlier returns. Partial fulfilment and exchange behavior require explicit implementation and verification; they are not implied by full-order dispatch.

### Accounts and documents

Orders begin unpaid. Record cash, UPI, bank transfer or configured method, amount, reference, payment date and staff actor. Partial payments reduce the outstanding balance; invalid and excessive payments are rejected. Outstanding and overdue amounts derive from ledger/order values, not manually edited status labels.

The default document is ORDER FORM, with sequential unique number, customer and transport details, size matrix, totals, amount in words, due date, payment terms and signature area. A4 portrait printing excludes application controls. Browser Save as PDF is acceptable PDF export if clearly labelled and tested. A tax invoice is a separate document issued only after verified company/tax configuration and an eligible billing state. Issued invoices preserve their data snapshot and separate numbering.

### Operations and reporting

Show daily/total orders, order type and lifecycle breakdowns, outstanding/overdue balances, low stock, sales by relevant dimensions and stock movement history. Filters must apply consistently to displayed and exported results. CSV exports escape spreadsheet formula prefixes. PDF/report exports must state what is included; do not claim Excel workbook export for a CSV file.

## Architecture and implementation conventions

React + TypeScript + Vite client; Supabase Auth and PostgreSQL; Vercel hosting. SQL migrations are the source of truth for schema, permissions and business transactions. Browser code uses the publishable key only. No service-role key or database password enters frontend code or version control. Types and API boundaries live under `src/lib`; components under `src/components`; database code under `supabase/migrations`; tests under `tests`.

Use explicit typed values and short named business operations. Example: `await transitionOrder(order.id, 'confirmed')`; the client must not set stock or payment totals directly. Build/test commands are the committed package scripts (`npm run typecheck`, `npm test`, `npm run build`); changes to these commands must update handover docs.

## Quality floor

- Labels, visible keyboard focus, accessible errors, logical headings and no colour-only status.
- Operable at 375px and desktop width; the matrix may scroll inside its own region.
- System light/dark appearance, reduced-motion support, no animation needed for data correctness.
- Text and meaningful controls meet appropriate contrast checks using actual token values.
- Every async mutation has pending, success and recoverable failure behavior; no silent data loss.
- Financial, inventory and permission rules have database-level tests; primary flows have browser evidence.
- Source, configuration guidance, security controls and backup/restore procedures ship with the app.

## Release boundaries

Always validate at trust boundaries, preserve audit/history, test critical changes and keep deployment evidence. Never commit secrets, fabricate tax/legal data, treat sample data as operational, or claim complete acceptance without evidence. The website may be publicly reachable before business activation; owner setup, verified business configuration, invoice comparison and recovery drill remain explicit release gates where unfinished.
