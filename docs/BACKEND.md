# Backend architecture and security

## Decisions before implementation

Supabase Auth owns identities; PostgreSQL is the authoritative business database. Each new identity becomes a pending retailer. An existing owner must approve and connect it to a customer. There is no public owner-claim endpoint and no privileged frontend credential. The first owner is assigned in the Supabase SQL editor after the company supplies and verifies an account email.

All business writes use SECURITY DEFINER RPCs with a fixed search path and an active-profile role check. Anonymous callers have no business table access. Authenticated direct writes are denied; row policies restrict reads. Money is integer paise. Order rates, customer information, settings and totals are snapshotted server-side. A browser-submitted price is never authoritative.

Confirmation locks stock variants in UUID order and reserves stock transactionally. Dispatch converts reservations to stock-out movements. Cancellation before dispatch releases reservations, and is blocked after payment until an accounts refund workflow is available. Partial shipment quantities are tracked separately; cancellation of a partly dispatched order is blocked. Return quantities cannot exceed dispatched quantities and create credits instead of falsely reporting a cash refund. Exchanges use a return plus a separately priced replacement order.

Documents use database sequences (unique, gaps permitted after rolled-back transactions). Tax invoices have their own sequence and immutable snapshots, require verified business/tax settings and cannot be issued from drafts. Configuration is not professional verification of statutory compliance; the business must validate it.

## Bootstrap

After signing up and verifying the intended owner email, use the company-controlled Supabase SQL editor:

```sql
-- Substitute the verified owner email; review the single matching identity first.
select id, email from auth.users where email = 'OWNER_EMAIL';
update public.profiles set role = 'owner', status = 'active'
where id = (select id from auth.users where email = 'OWNER_EMAIL');
```

Do not run this with a guessed email, expose it as an application endpoint, or make the first registrant the owner. Other roles are administered through `update_profile`. Administrators cannot appoint or manage administrators/owners; the last active owner is protected.

## Tables and operational semantics

See `docs/CONTRACT.md` and the executable migration. `order_fulfilments` records partial stock dispatch; `returns` / `return_items` record returns and valuation. `orders.credit_paise` reduces collectible balance, but refunds are separately operational and must not be represented as an automatic cash transfer. `stock_movements` and `audit_logs` are append-only to application users. Price-list assignment comes from the customer record. Settings are snapshotted when an order is saved and again when an invoice is issued.

## Testing and recovery

`node --test tests/database.test.mjs` runs migration and business RPCs on PostgreSQL via PGlite, emulating Supabase's auth schema and roles. It checks security boundaries and business invariants. This does not replace a cloud concurrency test or a verified production restore. Use Supabase backups or scheduled encrypted logical exports under company control; test restoration to a separate project before entering live business records. Keep migration history in Git, and never restore over production without a reviewed recovery plan.
