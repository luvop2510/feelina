# Feelina acceptance record

Updated 25 October 2026. A public URL is separate from approval to operate on real financial records. **Implemented** means code inspected; **verified locally** means the named local check passed; **pending** means evidence is still needed. The release coordinator should append deployed evidence rather than replacing these limits with a blanket completion claim.

## Evidence collected

The release coordinator reported a passing TypeScript/production build, 17 automated tests, and four Playwright tests. The test source was independently inspected. The automated suite contains eight token-contrast checks and nine PostgreSQL/PGlite scenarios. Browser tests run the read-only sample workspace; they do not demonstrate authenticated cloud writes.

| Check | Evidence and scope |
|---|---|
| TypeScript and production bundle | `npm run build` reported passed; includes `tsc -b` |
| Local database/business rules | `npm test`: 17 tests reported passed, including 9 PGlite database scenarios |
| Desktop sample journey | `tests/browser/workspace.spec.ts`: routes, search, matrix quantity calculation, sample write denial, no page errors |
| Small screen | Same browser suite: 375px navigation/matrix and no document-level horizontal overflow |
| Accessibility | Same suite: axe checks on eight main sample routes in light/dark with reduced motion; no reported violations |
| Printing | Browser generated `test-results/sample-order.pdf` in A4 and checked sidebar hidden; this is not a multi-page original-invoice comparison |
| Local recovery | PGlite data-directory dump/reload retains order count, one payment and stock; this is not a Supabase/off-site restore drill |
| Review | `tests/security-review.md` records concrete findings and their resolution state |

PGlite emulates the Supabase auth schema/roles. Its single connection does not prove two-session transaction races, real auth token behavior, provider configuration, network failures or live email delivery. Axe does not replace keyboard/screen-reader evaluation and does not cover every modal/state automatically.

## Business acceptance matrix

| Requirement | Implementation evidence | Remaining acceptance |
|---|---|---|
| Product selection | Searchable catalogue picker, product-colour lines; sample matrix tested | Authenticated create/edit with real catalogue |
| Size matrix | Specified eight numeric size columns and MRP/rate/quantity/amount; configurable labels | Original paper invoice absent; exact fidelity and mapping blocked |
| Correct amounts | Server recomputes prices, discounts and tax; negative quantity/tampered price tests | Safe monetary upper bound, per-transaction tax policy, deployed tests |
| Retailer pricing | Customer-assigned price lists and RLS; isolated retailer tests | Live two-retailer auth test and correct catalogue display for staff |
| Durable orders | PostgreSQL persistence, draft RPC, local backup/reload test | Save/sign-out/sign-in/reopen against live database |
| Stock | Atomic reserve/dispatch/release, partial shipment tables; oversell/idempotent-confirm tests | Two independent cloud sessions, failed-request retry safety, usable shipment history |
| Payments/balances | Server overpayment rejection and idempotent request IDs tested | All UI/export balances account for credits; visible refunds owed; cloud retry test |
| A4/PDF | Print-only order layout and browser Save PDF | Long product names, many-page document, original invoice comparison |
| Separate tax invoice | Separate sequence, immutable DB snapshot, verified-settings gate | Render only invoice snapshot with issue date; transaction tax configuration and business review |
| Access/security | Explicit RLS, RPC guards, direct-write denial; pending/retailer/last-owner tests | All seven roles, suspended/revoked tokens and live API negative tests |
| Backup/recovery | Procedure written; isolated embedded DB recovery test | Company-controlled encrypted off-site backup and real Supabase restore drill |
| Ownership | Repository and hosting provisioned through connected user accounts | Confirmed company owner, accepted company admin memberships and handover |

## Functional coverage and open work

| Area | Current state / material gap |
|---|---|
| Auth | Sign-in, registration, reset and pending-account screen implemented. Real verification/reset delivery not yet evidenced. |
| Staff accounts | Role/status/customer assignment UI and server restrictions implemented. Initial owner email deliberately deferred by user. |
| Catalogue | Product create/edit, active status, HTTPS image URL and variant opening stock implemented. No file-upload/storage service; images are external references. |
| Customer records | Create/edit and assigned price/credit terms implemented. Inline customer creation retains matrix component state; live flow needs verification. |
| Draft/duplicate | Save/edit/duplicate code exists. Review identified navigation-before-reload and retry-after-partial-save defects; resolution tracked in review record. |
| Transport | Transporter, LR/date and dispatch details captured. Post-submission transport editing needs a deliberate audited path; draft-only edit cannot handle a late LR assignment. |
| Partial fulfilment | Database records quantity-level shipments and protects remaining reservations. UI initially lacked remaining-quantity/history reads and partial-return access. |
| Returns/exchanges | Server caps returns and computes cumulative credits. Exchange is documented as return plus new replacement order; explicit linkage/reconciliation UI is not established. |
| Refunds | Returns create accounting credit, not a cash transfer. No refund-entry workflow exists; paid-order cancellation remains blocked. Refunds owed must be visible, not clamped away. |
| Internal notes | Separate staff-only table/RPC exists; initial UI did not load/display/add these. General order notes are customer-visible. |
| Price-list maintenance | Create and assignment implemented. Initial settings screen lacks editing an existing list despite server upsert support. |
| Reports | Date/customer order reports, product-size lines and movement export implemented. Initial movement report ignored selected customer. No native XLSX export; CSV is clearly named. |
| Audit | Append-only application audit and stock movements implemented. Audit UI shows action/actor/entity; live reconciliation and complete staff role coverage pending. |
| Data scale | Initial silent 1,000-row cap replaced by pagination. Full workspace loading remains unsuitable for very large histories; add query-level paging/aggregation when operational volumes require it. |
| Error recovery | Visible errors and busy states implemented. Source review found some successful mutations followed by failed reload may be presented as save failure; retry behavior needs explicit outcome handling. |

These are implementation observations, not permission to waive requirements. The release coordinator updates entries after fixes and checks. Do not describe advanced modules as fully accepted while their material gaps remain.

## Activation gates awaiting the business

- Confirm the initial owner email and grant that exact verified account owner access through trusted administration.
- Supply verified legal name, address, GST and bank/UPI details; review the correct tax treatment with the business's accountant.
- Supply the original paper invoice and verify the size labels and printed structure.
- Load actual products, prices, customers and opening stock, and reconcile them before taking orders.
- Accept company-controlled GitHub, Supabase, Vercel, domain and backup administrator access.
- Complete cloud authentication/persistence/concurrency checks and an isolated off-site restore drill before operational sign-off.
