# Feelina delivery plan

1. Capture the supplied brief as a PRD, module/API contract, design tokens and security boundaries before implementation.
2. Build identity, RLS, catalogue/customer data and the size-matrix order draft as a complete slice.
3. Add atomic stock confirmation and dispatch; immutable printable order snapshots.
4. Add price lists, payment ledgers, verified tax settings and separately issued invoices.
5. Complete partial dispatch, returns/credits, audit visibility and exports.
6. Verify role boundaries and calculations with PostgreSQL integration tests; inspect real UI at desktop/mobile and print.
7. Apply migrations to dedicated Feelina cloud project, deploy Vercel, push source/CI to supplied GitHub repository, check live reachability/security.
8. Document unresolved business inputs: owner email, legal/tax details, invoice reference and real product/customer catalogue. These do not justify inventing data or giving public users owner access.

Team: root owns integration/hosting/design and browser verification; backend owns migrations and database tests; frontend owns UI and API client; quality reviewer owns PRD/security/operations docs and independent review. Agent Teams invoked by user. Shared contract fixes are communicated before changing boundaries.
