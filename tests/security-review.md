# Independent security and correctness review

Review date: 25 October 2026. Assumed use: multiple internal staff and approved retailers on a shared business database. Reviewed the product brief, SQL migration, API loader, auth flow, order editor/detail, catalogue, accounts/reports/settings UI, tests and recovery scripts. This is source review plus inspection of test evidence, not penetration testing.

## Controls that are present

- Signup ignores role metadata and creates a pending retailer; no public owner claim path.
- Business tables have RLS and no authenticated direct writes. RPCs use fixed empty search paths and active-role checks.
- Retailer order/customer isolation, administrator role restrictions and last-owner protection are implemented.
- Server pricing ignores browser totals; integer paise, stock row locks and explicit transition rules protect writes.
- Payments use a stable request ID and validate duplicate payloads; order drafts require stable IDs.
- Audit events and stock movements are append-only to app users; private notes have their own restricted table.
- Sample workspace is labelled, separate and read-only. Vercel configuration has CSP/framing/content-type controls.

## Earlier findings corrected in inspected source

1. **Silent 1,000-row truncation:** loader now ranges through each table in deterministic key order. This prevents missing variants/order lines solely because the API default limit was reached. Live pagination under concurrent inserts is not covered by this source check.
2. **Repeated-return rounding:** credit now uses cumulative returned value entitlement, avoiding a full return that credits less than the original total after many small returns. Existing tests check cumulative full return but not every fractional-paise combination.
3. **Tax configuration drift:** invoice creation rejects a changed GSTIN/mode/rate against the order snapshot. The invoice still records current issuer details; the rendering issue below is separate.
4. **Payment replay:** stable request UUID and comparison of prior payment details prevent the same request from adding a second payment.

## Must fix before operational acceptance

Resolution is pending unless a later entry states otherwise. Findings were sent directly to the release coordinator.

1. **Credits are inconsistent or hidden in account views.** `Orders.tsx` list export/payment badge initially ignores `credit_paise`; `Modules.tsx` balances clamp negative amounts to zero. A fully paid ₹100 order with a ₹40 return owes ₹40 to the customer but displays no refund due. Use a shared net-balance calculation, display collectible and customer-credit separately, and export the same values. Preserve cancelled/draft distinctions.
2. **Invoice output is not wholly the immutable invoice.** `OrderDetail` switches lines/issuer but continues using the live order and order date for other fields. Payments or return credits after issuance alter the displayed document, and the invoice shows the order date instead of issue date. Render `invoice.snapshot.order` and issue timestamp for the document; show current account balance outside it.
3. **Dispatch/return requests can be replayed.** `dispatch_order`, `record_return` and `adjust_stock` have no stable operation ID. If a response is lost and the same partial request is retried while sufficient units remain, stock changes again. Add a request ID and compare operation details; test the response-lost retry case. Disabling a button while one request is running is insufficient.
4. **Partial shipments lack enough UI state.** The initial loader omits fulfilments/returns and the form uses ordered quantities as its maximum. The operator cannot see what is still outstanding or what was already returned. Packed partial orders lack a return action, and inventory staff cannot reach order detail despite permission to record returns. Load and display remaining/returned quantities and expose the permitted workflow.
5. **Duplicate navigation can open an empty editor.** The duplicate handler initially navigates before workspace reload, so `OrderEditor` initializes against missing data and does not reinitialize its state after the result arrives. Reload first, then navigate; verify product/customer/quantities on the duplicated draft.
6. **An internal route change can discard an order draft.** The editor guards its own back button/browser unload, but sidebar/hash navigation unmounts it without checking unsaved changes. Protect all navigation or persist a recoverable server draft. Do not put sensitive business drafts in local storage.
7. **Tax treatment is global rather than transaction-specific.** Every order receives one workspace-wide mode/rate without a verified order-level supply context. The same configuration cannot distinguish intra/interstate orders. Record verified transaction tax treatment and apply it server-side, or keep tax invoice issuance unavailable until the supported billing policy is explicit.
8. **Financial bounds exceed JavaScript integer precision.** The SQL permits 100 lines × 800,000 units × 1,000,000,000 paise, beyond JavaScript's exact integer range. Browser numbers/exports can misstate totals. Bound financial input/totals to an operationally reasonable safe maximum in SQL or carry exact decimal strings/BigInt end-to-end.
9. **Recovery scripts do not establish a working restore.** The initial `backup.sh` strips privileges and dumps managed auth schema; `restore-check.sh` assumes a fresh target without preparing required roles, while a Supabase target already contains managed auth objects. A TOC listing is not restoration. Define one supported restore target, preserve/rebuild the permissions and managed-schema customizations correctly, and run a real isolated drill. The official logical migration procedure in `docs/OPERATIONS.md` is the documented starting point.

## Additional capability gaps

- Post-submission LR/transporter updates have no dedicated RPC; general order editing is draft-only.
- General order notes are customer-visible. Separate internal notes need an actual staff UI, not only a table.
- Existing price-list editing, explicit exchange linkage and refund entries need UI/business workflow completion.
- Catalogue staff price display initially selects the first product-specific price-list entry without selecting a customer/list, so it can mislabel one customer's negotiated rate as general wholesale.
- Stock movement report initially ignores the selected customer filter, while its control remains visible.
- Multi-step save then submit can commit a draft and fail submission; retry may carry stale `updated_at`. Surface the saved draft and retry the failed transition rather than repeat blindly.

## Verification limits

The coordinator reported 17 local automated tests and four sample browser tests passing. Inspected tests cover local RLS/role checks, pricing, stock/payment invariants, partial shipments, return cap, embedded backup/reload, route accessibility and a sample A4 PDF. They do not prove real email delivery, cloud roles/token revocation, two independent database sessions, multi-page invoice fidelity, provider ownership or off-site recovery.

Verdict: source-level protections exist, but fix the operational findings and complete the cloud/business gates before calling this a production-ready order system.
