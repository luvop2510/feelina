# Feelina

A retailer ordering and internal operations workspace for Feelina. React/TypeScript on Vercel, Supabase Auth and PostgreSQL for authoritative business data. The central order form is an eight-size matrix, with separate MRP and selling rates, server-calculated totals and A4 printing.

## Run

```sh
npm ci
cp .env.example .env.local
# Set the public Supabase URL and publishable key for your project.
npm run dev
npm test
npm run build
```

Use Node.js 22 or newer. Only public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values belong in frontend configuration. Never add a service role key or database password there.

## Product and architecture

- [Product requirements](docs/PRD.md)
- [Design system](design-system/feelina/MASTER.md)
- [Schema and API contract](docs/CONTRACT.md)
- [Backend behavior and owner bootstrap](docs/BACKEND.md)
- [Security model](docs/SECURITY.md)
- [Operations and ownership](docs/OPERATIONS.md)
- [Acceptance evidence](docs/ACCEPTANCE.md)

Apply versioned SQL in `supabase/migrations` to a dedicated project. All new registrations become pending retailers; the owner must be provisioned by a company-controlled project administrator after verifying the intended email. There is no public owner-claim endpoint.

## Before using real business records

Supply the owner email, verified business details and the reference invoice; configure verified tax/size labels and real catalogue stock. Order drafts can be prepared before statutory configuration. Confirmation and tax invoices enforce verification gates. A read-only sample workspace, if opened, is an illustration rather than live business data.

## Deployment

`npm run build` emits `dist`. Vercel settings and security headers live in `vercel.json`. Set the two public Supabase variables in the deployment environment before building. The database is independent of web deployments and is not reset when the site is redeployed. Configure Supabase Auth site URL and approved redirect URLs to the final company domain before email confirmation/recovery is used.

## Recovery

`BACKUP_DIR=/secure/path DATABASE_URL=... scripts/backup.sh` creates a restricted-permission PostgreSQL custom archive and checksum. It includes sensitive Auth records: encrypt it and copy it to company-controlled off-site storage. See the operations runbook for isolated restore prerequisites and cloud verification status. Never commit backup files or database credentials.

## Sources used for implementation decisions

- [Supabase database functions](https://supabase.com/docs/guides/database/functions): fixed search paths and explicit grants for server RPCs.
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): restrict database reads and pair policies with authenticated identities.
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite): static build and public environment configuration.
