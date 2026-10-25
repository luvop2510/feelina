# Feelina release acceptance record

Updated 25 October 2026. Primary site: https://feelina.vercel.app. Source: https://github.com/luvop2510/feelina. Backend: Supabase `ttmrywjzmdfjsvuxgmpr`. Render is an optional static mirror, not a required backend service.

## Verified evidence

| Check | Result and scope |
|---|---|
| Production build | `npm run build` passes TypeScript and Vite compilation. |
| Automated business/design checks | `npm test`: 35 passing tests: 22 PostgreSQL/PGlite scenarios, 12 actual CSS contrast checks and the size-chart migration check. |
| Browser checks | 26 passing Playwright tests, including delayed-auth/profile regressions, explicit account logout, corrected one-page PDF, mobile image/action spacing, five viewport widths and: first-password gating, owner/distributor creation and retries, administrator restrictions, 100-row A4 pagination, isolated authenticated journey, 375px matrix, axe on all eight routes in light/dark, dirty navigation cancellation, Google disabled-provider recovery and PKCE redirect parameters. |
| Cloud migrations | Six migrations applied, through `20261025130000_correct_size_chart.sql`; filenames match Supabase's migration history. |
| Real authenticated cloud journey | Disposable owner/retailer identities: email login, catalogue selection, inline customer retaining quantities, server-priced draft, reload persistence, submission, unverified-business confirmation denied, retailer own-order access, forbidden stock mutation, suspended access denied with existing token, sign-out. `tests/cloud-live.mjs` preserves the manual test procedure; all fixture records/accounts were removed. |
| Cloud SQL negative checks | `tests/cloud-smoke.sql` executed in a rolled-back transaction: pending signup/no escalation, retailer scope, direct-write denial and authoritative prices. |
| Security advisor | Final query reports 16 intentionally exposed authenticated SECURITY DEFINER RPCs, each with role/status checks and fixed search paths. Auth also reports disabled leaked-password protection; see the security review. See `tests/security-review.md`. |
| Account management | Three designated owner email logins and initial-password restrictions verified. Disposable hosted Auth/Edge/RLS checks verify password replacement, staff/distributor creation, admin escalation denial, suspended retries, customer scope and anonymous denial. |
| Edge handler | Three isolated Deno tests pass; server SDK version and lockfile pinned. |
| Recovery | Embedded database dump/reload retains orders, payments and stock. Supabase logical backup/restore helpers and runbook exist; a company-controlled off-site restore is still untested. |
| Print | Corrected logo/size-chart A4 PDF fits three rows on one page; 100 long rows paginate without clipping. Cell padding, table boundaries, size headers and amounts are tested. See REBRAND-VERIFICATION.md. |

PGlite uses emulated Supabase auth/storage and a single database connection. Separate hosted sessions additionally verified three rounds of stock reservation contention, competing bounded payments and duplicate payment replay (`tests/cloud-concurrency.mjs`); temporary accounts and business fixtures were removed. Browser tests use isolated authenticated API fixtures; they do not prove real email delivery or manual screen-reader behavior. The cloud journey used the prior release UI; later transport/exchange/Google changes have local automated checks and require operational acceptance with the business.

## Implemented behavior

Server pricing, bounded integer-paise totals, per-order GST supply-state treatment, atomic reservation/partial dispatch/cancellation/returns, stable operation IDs, immutable invoice snapshots and last-owner protection are tested locally. Retailer/customer pricing, role separation, internal notes and public product-image storage with administrator-only writes have dedicated scenarios. Draft line positions, audited late transport updates and a single linked replacement draft per return are covered by the latest migration tests.

The UI includes catalogue/customer maintenance, image uploads, eight-size order matrix, drafts/duplicates, retained unsaved quantities, shipment/return history, staff notes, transport updates, exchange links, price-list editing, payment records, refund-credit visibility, audit views and CSV/print reports. Returns record credit; they do not send money. Cash refund recording/reconciliation is not yet implemented, and paid-order cancellation is blocked.

## Pending activation and acceptance

- **Google credentials:** deferred by user. The option is visible and code paths are tested, but real Google login is inactive until the provider is configured and its full callback tested. See `docs/AUTH.md`.
- **Business identity:** verified company/tax/payment details and original invoice remain deliberately deferred. The three explicitly designated owners are provisioned with mandatory first password replacement; statutory confirmation/issuance stays gated.
- **Real data and review:** load actual catalogue, prices, customers and reconciled opening stock; approve tax treatment and multi-page print fidelity.
- **Email:** verify signup and password reset with a real controlled recipient and production sender configuration.
- **Operations:** conduct encrypted off-site backup/isolated Supabase restore, recovery timing, and company administrator handover.
- **Scale:** full-table loading is paginated beyond the API's 1,000-row default, but large histories still need server-side report aggregation and query-level paging.

A live URL and successful checks establish the tested scope above. They do not establish complete operational or statutory acceptance.
