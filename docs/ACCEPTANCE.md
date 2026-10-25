# Feelina acceptance record

Baseline created 25 October 2026. Status terms: **required** = specified but not yet evidenced; **implemented** = code inspected; **verified** = named check passed; **blocked** = needs an external fact or account action. Do not equate a successful build with functional acceptance. Update this record with actual evidence before release.

## Business acceptance matrix

| Requirement | Required verification | Initial status |
|---|---|---|
| Catalogue selection and product-colour lines | Search/select two products and colours without typing names | Required |
| Exact size matrix | Check specified column sequence; compare original invoice | Blocked: invoice absent |
| Quantities, money and tax | Server tests for quantity validation, discount, rounding, rate tampering | Required |
| Customer-specific pricing | Two retailers with distinct price lists; reject cross-customer access | Required |
| Persistence | Save order, sign out, sign in, reopen same saved values | Required |
| Stock reservation | Confirm competing orders, reject oversell, cancel/retry without drift | Required |
| Payment consistency | Partial payment, overpayment rejection, outstanding and overdue totals | Required |
| A4 order form/PDF | Browser print/PDF at one and multiple pages; no navigation/control leakage | Required |
| Separate tax invoice | Block unverified settings; issue distinct immutable numbered invoice | Required |
| Security | RLS, direct-write denial, suspended tokens, role escalation, audit immutability | Required |
| Backups and recovery | Restore off-site backup into isolated project and exercise restored app | Required |
| Company handover | Named owner and accepted provider/repository admin access | Blocked: owner details deferred |

## Expanded feature coverage

| Capability | Evidence needed |
|---|---|
| Sign-in, registration, confirmation, reset, sign-out | Deployed auth flow and real email delivery |
| Retailer pending/active/suspended/deactivated | Database and UI tests for each status |
| Seven staff/retailer roles | Explicit allowed/denied operation matrix |
| Catalogue active flag, variants and images | Create/edit product; verify inactive ordering rejection |
| Customer create during order entry | Save customer and retain all existing matrix quantities |
| Draft edit and order duplication | New draft; historical order unchanged; current rates applied |
| Workflow and dispatch details | Allowed transitions, invalid transitions, transporter/LR persistence |
| Cancellation | Reserved stock released once; paid/dispatch rules enforced |
| Returns | Per-variant cap, restock/credit audit, repeat protection |
| Partial fulfilment | Actual partial dispatch and remaining reservation, not just a status label |
| Exchanges | Linked return/replacement with correct stock and financial trail |
| Price list administration and credit terms | UI updates and server selection of correct price |
| Payment ledger and receipts | Entries reconcile to order/customer balances and printable receipt |
| Settings and tax modes | Configurable sizes and verified CGST/SGST versus IGST handling |
| Order/invoice numbering | Concurrent uniqueness, no client-chosen number |
| Low stock and movement history | Accurate available stock; actor and source reference |
| Reports | Date/customer/product/size/type/status filters and exported result parity |
| CSV/Excel/PDF exports | Actual formats named correctly; CSV formula neutralization |
| Accessibility | Keyboard, focus, labels, contrast, 375px, zoom, dark and reduced motion |
| Error recovery | Failed save retains input; connectivity/configuration error is actionable |

## Verification log

No test execution is claimed by this baseline. The release coordinator records exact commands, dates and outcomes here or links to committed test reports. Tests run against an embedded PostgreSQL instance validate database logic but do not prove live network behavior, provider auth configuration or multi-connection concurrency unless those are exercised separately.

| Check | Command or procedure | Result / evidence |
|---|---|---|
| TypeScript | `npm run typecheck` | Pending |
| Automated tests | `npm test` | Pending |
| Production build | `npm run build` | Pending |
| Dependencies | `npm audit --omit=dev` plus full development-tool audit | Pending |
| Browser desktop/mobile | Primary order journey at desktop and 375px | Pending |
| Deployed API boundaries | Anonymous, pending, retailer and staff actors | Pending |
| Live headers | Inspect production response headers | Pending |
| Backup/restore drill | `docs/OPERATIONS.md` isolated procedure | Pending |

## Activation gates

Owner email and company details will be supplied later. Statutory details must be verified by the business; this app does not independently certify a registration or tax treatment. The paper invoice comparison, real catalogue import, provider ownership/access checks and successful recovery drill remain explicit gates if not completed during implementation. Public availability of the website is separate from approval to operate on real financial records.
