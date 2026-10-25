# Feelina operations and handover

This runbook is for the company administrator and its next developer. It is not evidence that backups, recovery or company ownership transfer have already occurred. Deployment identifiers and the live URL belong in the release record maintained by the deploying developer.

## Provisioned project record

The user-selected Supabase project is `ttmrywjzmdfjsvuxgmpr`, owned by the browser account `worldyashvardhan@gmail.com`, region Seoul (`ap-northeast-2`). Use this exact project for production. The Vercel project is `feelina`, ID `prj_Wg2uLGT3CLQjCXHqMlPoNb0kn9tA`, under the existing `yug19` team. `render.yaml` describes a dedicated Render static deployment using the same Supabase backend. The earlier provisioned projects `nyjvoxaffvmhcqefqtoq` and `kxjoqrrxwtoxkkjesdnc` are superseded, have no business records and are not deployment targets. Do not delete them without confirming the owning account and explicit cleanup authorization.

Record the final production URL, deployed commit, applied migration and cloud verification output in the release handover. The initial owner email remains intentionally unassigned until the user supplies it.

## Before accepting real business orders

1. Obtain the confirmed owner email. Have that person register and verify their email, then grant owner status through trusted project administration using the guarded procedure in `docs/BACKEND.md`. Never publish a bootstrap password or service key.
2. Give at least two company-controlled administrators access to GitHub, Supabase and Vercel, and enable provider MFA. Record recovery methods in the company's password manager.
3. Enter the verified legal name, address, tax registration/configuration, payment terms and bank details. A company representative must review them before marking them verified.
4. Compare the order form with the original paper invoice. Verify every size label, transport field, totals block and A4 pagination. No reference invoice was available during initial specification.
5. Load the real catalogue, variant stock, price lists and customers. Reconcile opening stock with a signed count. Never import the sample workspace as real records.
6. Configure and test email verification, password reset and allowed production redirects. Confirm signup can reach a real recipient and pending users cannot order.
7. Complete the role/stock/payment/print checks in `docs/ACCEPTANCE.md` and an isolated restore drill below.

## Local development

Use the Node version and package manager declared in `package.json`. From the repository root:

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or the exact publishable-key variable in `.env.example`) and `VITE_SUPABASE_READY=true` only after migrations and access checks are complete, using a development project's public configuration. Check `.env.example` for the authoritative names. Do not copy production passwords, service-role keys or customer records into a development checkout. Use a separate test project for destructive or adversarial tests.

## Database changes

Migrations under `supabase/migrations` are ordered and reviewed source. Apply them to a test Supabase project first, run database tests and inspect the security advisor, then apply the same migration to production. Do not edit an already-applied migration to change a live schema: add a new migration. Record its filename, operator, timestamp, project reference and verification output. Back up before a destructive schema/data change. A frontend rollback does not undo database changes.

## Hosting and configuration

Vercel builds the committed source with `npm run build` and publishes `dist`. Set only public Supabase configuration in Vite's environment. Keep the same production settings across deployment environments unless a preview deliberately targets a test database. Preview deployments must not silently write to production. Check deployed response headers against `vercel.json` and configure Supabase Auth Site URL/redirect URLs to the actual production origin. Domain ownership and DNS access stay with Feelina.

When a deploy fails, inspect build logs, reproduce the failed command locally, fix and rerun relevant checks. When a release causes a frontend regression, promote a previously verified deployment and record the rollback. For financial/data errors, suspend affected mutations first; repair through a reviewed and audited transaction, not casual row editing.

## Backup policy to activate

Proposed business targets: daily encrypted backups, a 24-hour recovery-point target and a 4-hour recovery-time target. These are targets awaiting an actual drill, not measured service guarantees. Keep 30 daily copies in company-controlled off-site storage, subject to the company's agreed retention policy. Restrict decryption/access to named administrators. Monitor backup failures; the presence of a scheduled job is not success.

Supabase recommends regular off-site exports for free-tier projects. Database backups do not preserve storage file contents; copy any future uploaded assets separately. Provider settings, auth redirect/SMTP configuration and hosting variables also need a separate configuration record. See [Supabase backups](https://supabase.com/docs/guides/platform/backups).

The repository also contains `scripts/backup.sh` and `scripts/restore-check.sh`. Until a supported target and successful real restore are recorded, treat these as unverified helpers: a custom archive listing does not establish that managed auth objects and privileges can be restored correctly. Do not use an untested restore helper against production.

### Logical backup

Prerequisites: Supabase CLI, Docker, PostgreSQL client tools and a secure connection string from the project's Connect panel. Use an approved secret manager to set `FEELINA_BACKUP_DB_URL`; do not place literal passwords in shell history, committed files or logs. Run in an access-restricted directory outside the repository:

```sh
umask 077
mkdir -p feelina-backup
cd feelina-backup
supabase db dump --db-url "$FEELINA_BACKUP_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$FEELINA_BACKUP_DB_URL" -f schema.sql
supabase db dump --db-url "$FEELINA_BACKUP_DB_URL" -f data.sql --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
supabase db dump --db-url "$FEELINA_BACKUP_DB_URL" -f history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$FEELINA_BACKUP_DB_URL" -f history_data.sql --use-copy --data-only --schema supabase_migrations
shasum -a 256 roles.sql schema.sql data.sql history_schema.sql history_data.sql > SHA256SUMS
```

Encrypt and upload this set through the company's approved backup storage workflow. Do not retain unencrypted dumps on a shared workstation. The commands follow [Supabase's CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore); review that guide when upgrading the CLI.

### Restore drill

Restore only into a newly created, isolated Supabase project. Set `FEELINA_RESTORE_DB_URL` from that project's secret connection string. Confirm its project reference differs from production. Restore the verified backup set:

```sh
shasum -a 256 -c SHA256SUMS
psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command 'SET session_replication_role = replica' --file data.sql --dbname "$FEELINA_RESTORE_DB_URL"
psql --single-transaction --variable ON_ERROR_STOP=1 --file history_schema.sql --file history_data.sql --dbname "$FEELINA_RESTORE_DB_URL"
```

Review provider-managed role conflicts rather than ignoring SQL failures. Recreate the application auth-user trigger from migrations if absent: managed-schema customizations need explicit checking. Restore storage objects separately if used. Reapply project auth/hosting configuration to the isolated environment; never send test email to production customers.

Compare row counts and aggregate stock, reserved quantities, order totals, payments and invoice numbers against the backup record. Then test sign-in, retailer isolation, one test draft, confirmation/cancellation, and document print using fixture accounts. Record start/end times, achieved recovery point, mismatches and cleanup. A successful SQL import alone is not a successful recovery drill.

## Owner bootstrap and staff access

The owner email was intentionally deferred by the user. The project must remain without an implicitly created owner until it is supplied. The bootstrap operator confirms email ownership, checks the exact auth user ID, performs the trusted database procedure, and records the action. Subsequent staff and retailer approval uses the app's role-controlled account management. Do not distribute shared administrator accounts. Suspend departed staff and remove provider access, not just app access.

## Handover inventory

| Asset | Required company control | Evidence to record |
|---|---|---|
| GitHub repository | Company administrator/owner, branch controls | Repository URL and accepted membership |
| Vercel project | Company team ownership/admin, billing access | Team/project IDs and accepted membership |
| Supabase project | Company organization owner/admin | Organization/project references and accepted membership |
| Domain/DNS | Company registrar and DNS access | Registrar, zone and renewal contact |
| Authentication/email | Company SMTP account and sender domain | Provider and verified sender; no credentials in this file |
| Backups | Company storage and encryption key custodians | Successful restore record and retention policy |
| Application | Confirmed owner account and recovery route | Owner email confirmation and sign-in verification |

A repository push and a live URL do not establish company ownership. Complete these transfers/access checks before signing handover. Store credentials only in the company's password manager; rotate temporary setup credentials after handover.
