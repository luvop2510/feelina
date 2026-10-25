# Feelina security model

This document describes the required controls and review scope. Check `docs/ACCEPTANCE.md` and `tests/security-review.md` for observed evidence and remaining gaps. A written control is not proof that it is deployed.

## Assets and trust boundaries

Customer contact/address information, retailer-specific prices, order history, stock, financial records, credentials and administrator privileges are protected assets. The browser is untrusted. Supabase Auth proves identity; database policies and functions decide access. Vercel serves public client assets. Provider administrators remain privileged and require company-controlled accounts and MFA.

The application does not process card payments or store card credentials. Payment records are bookkeeping entries, not proof of bank settlement. Product image URLs must not contain private customer data. Any sample workspace is visibly separate from business data.

## Threats and required controls

| Abuse case | Control | Evidence required |
|---|---|---|
| Anonymous visitor reads prices or customers | RLS on all business tables; no anonymous business reads | Anonymous SELECT/RPC test |
| Pending/suspended user reuses a valid token | Database checks current active profile, not a client flag | Status revocation test |
| Retailer submits another customer's ID | Owner/customer scope checked in every RPC and SELECT policy | Cross-customer read/write test |
| User edits signup metadata to become owner | Auth trigger always creates pending retailer; privileged bootstrap only | Metadata escalation test |
| Admin grants owner or removes last owner | Restricted profile RPC with last-owner guard | Privilege escalation test |
| Browser changes rate, tax or amount | Server resolves prices and computes totals in integer paise | Tampered payload test |
| Two orders consume the same stock | Row locks, stable locking order and atomic transactions | Competing confirmation test |
| Retry reserves or cancels twice | State transition checks and same-state idempotency | Repeated transition test |
| Payment exceeds amount due | Order row lock and outstanding validation | Overpayment/concurrent payment test |
| Return duplicates stock or credits | Cap returned quantity per variant/order | Repeat/over-return test |
| Malicious text becomes executable HTML | React escaping; no raw HTML injection | Source review and browser payload test |
| Exported customer text runs a spreadsheet formula | Quote CSV and neutralize formula prefixes | CSV hostile cell test |
| Stolen build artifact reveals credentials | Publishable client key only; secrets excluded from bundle/repo | Staged and built asset scan |
| Unauthorized direct table mutation bypasses RPC | Revoke DML grants; write through restricted functions | Direct INSERT/UPDATE/DELETE denial |

## Database rules

RLS must apply to every business table exposed through the API. Definer functions are privileged code: use fixed/empty `search_path`, qualified object names, explicit authentication and role/customer checks, and restricted execution grants. Revoke default PUBLIC/anonymous function execution where unnecessary. A definer function can bypass RLS, so each function needs its own authorization review. These are the patterns recommended in the [Supabase function documentation](https://supabase.com/docs/guides/database/functions) and [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Money, quantities, enum states, date relationships, text lengths and list sizes require server validation. Database constraints must enforce nonnegative stock/reservations and unique SKU/variant/document identifiers. A transaction may not leave reservations, movements, totals and lifecycle state inconsistent. Historical prices and documents are immutable after the relevant business transition.

Audit events record actor, action, entity, timestamp and relevant before/after details without credentials. Application users cannot rewrite audit events. Audit logs are operational evidence, not tamperproof against the cloud project administrator.

## Browser and transport

Use HTTPS and hosting security headers: content type protection, framing protection, referrer policy and a restrictive Content Security Policy that allows only required Supabase connections and image sources. No `eval`, dynamic untrusted script, or dangerously inserted user HTML. External links use safe opener behavior.

The chosen SPA architecture uses Supabase client sessions rather than an HTTP-only server session. This makes prevention of script injection particularly important. Auth session storage is distinct from business storage; orders, inventory and payments must remain in PostgreSQL. Introducing a server-rendered/BFF cookie session would be a separate architecture change. No secret is made safe merely by prefixing it `VITE_`: every Vite environment variable referenced in client code is public.

## Authentication operations

Keep email verification enabled for real retailer registration. Configure production redirect allowlists narrowly. Provider rate limits, SMTP delivery, password reset and optional MFA need deployment configuration and live checks. Do not claim email deliverability from a successful local test. Never grant initial owner access based on being the first registered account. The owner email is pending; bootstrap must match an explicitly confirmed account through trusted database administration.

## Data handling and retention

Collect contact/address/GST information only for ordering and billing. Do not send it to analytics, advertising or AI services. Restrict exports and backup access to authorized staff. Support export/correction requests through the company administrator. Financial record retention and deletion policy must be set by the business with its advisers; this project does not invent a legal retention period. Deactivating an account does not delete its records. Encrypted backups retain data until their retention expires; explain this in the company's privacy notice.

## Incident response

1. Suspend the affected account or revoke the compromised key; preserve relevant audit events.
2. Determine affected customers/orders/time range. Do not expose data while investigating.
3. Rotate leaked server credentials and redeploy if they entered a build. Removing a secret from Git is insufficient.
4. Reconcile stock, payment and document history before repairing records through an audited administrative procedure.
5. Notify the company owner and follow its applicable reporting obligations.
6. Add a regression test and record the cause, fix and recovery evidence.

## Release checks

Run the lockfile's dependency audit and triage reachable high/critical findings. Check deployed headers and Supabase security advisors. Exercise anonymous/pending/retailer/staff boundaries against the deployed API. Perform a restore drill in isolation. Penetration testing, provider configuration audit and real email delivery are separate checks; do not imply they were performed if only source/unit tests exist.
