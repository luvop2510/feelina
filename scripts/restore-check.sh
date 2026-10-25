#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a newly created disposable Supabase project}"
: "${FEELINA_RESTORE_PROJECT_REF:?Set the disposable target Supabase project reference}"
: "${ALLOW_DISPOSABLE_RESTORE:?Set ALLOW_DISPOSABLE_RESTORE to the exact disposable target project reference}"
[[ "$FEELINA_RESTORE_PROJECT_REF" =~ ^[a-z0-9]{20}$ && "$ALLOW_DISPOSABLE_RESTORE" == "$FEELINA_RESTORE_PROJECT_REF" ]] || { echo 'Disposable target acknowledgement does not match.' >&2; exit 1; }
[[ "$RESTORE_DATABASE_URL" == *"db.${FEELINA_RESTORE_PROJECT_REF}.supabase.co"* || "$RESTORE_DATABASE_URL" == *"postgres.${FEELINA_RESTORE_PROJECT_REF}@"* ]] || { echo 'Connection string does not match the declared target project.' >&2; exit 1; }
[[ $# -eq 1 && -d "$1" ]] || { echo 'Usage: scripts/restore-check.sh path/to/logical-backup-directory' >&2; exit 1; }
for tool in psql shasum; do command -v "$tool" >/dev/null || { echo "$tool is required." >&2; exit 1; }; done
backup_dir="$(cd "$1" && pwd)"
[[ -f "$backup_dir/source-project.txt" && -f "$backup_dir/SHA256SUMS" ]] || { echo 'Backup manifest is missing.' >&2; exit 1; }
source_ref="$(cat "$backup_dir/source-project.txt")"
[[ "$source_ref" != "$FEELINA_RESTORE_PROJECT_REF" ]] || { echo 'Refusing to restore onto the source project.' >&2; exit 1; }
(cd "$backup_dir" && shasum -a 256 -c SHA256SUMS)
# Require an empty application schema and no registered target identities. Never use --clean.
target_empty="$(psql "$RESTORE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')) AND NOT EXISTS (SELECT 1 FROM auth.users)")"
[[ "$target_empty" == t ]] || { echo 'Target is not an empty Supabase project. Restore refused.' >&2; exit 1; }
echo 'Review roles.sql for provider-managed role conflicts before proceeding. No SQL errors will be ignored.'
# Provider auth/storage schemas already exist; schema.sql excludes their definitions.
# Replica mode prevents signup triggers from recreating profiles while auth data is restored.
psql "$RESTORE_DATABASE_URL" -X --single-transaction --variable ON_ERROR_STOP=1 \
  --file "$backup_dir/roles.sql" --file "$backup_dir/schema.sql" \
  --command 'SET session_replication_role = replica' --file "$backup_dir/data.sql" \
  --command 'SET session_replication_role = origin' \
  --file "$backup_dir/history_schema.sql" --file "$backup_dir/history_data.sql"
# Recreate a missing application auth trigger only; avoid duplicating one preserved in schema.sql.
trigger_exists="$(psql "$RESTORE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created')")"
if [[ "$trigger_exists" != t ]]; then
  psql "$RESTORE_DATABASE_URL" -X --single-transaction --variable ON_ERROR_STOP=1 --file "$backup_dir/auth-triggers.sql"
fi
psql "$RESTORE_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT json_build_object('orders',(SELECT count(*) FROM public.orders),'payments',(SELECT count(*) FROM public.payments),'variants',(SELECT count(*) FROM public.variants),'order_total_paise',(SELECT coalesce(sum(total_paise),0)::text FROM public.orders),'paid_paise',(SELECT coalesce(sum(amount_paise),0)::text FROM public.payments),'stock',(SELECT coalesce(sum(stock),0) FROM public.variants),'reserved',(SELECT coalesce(sum(reserved),0) FROM public.variants))" > "$backup_dir/restore-summary.json"
if ! cmp -s "$backup_dir/business-summary.json" "$backup_dir/restore-summary.json"; then
  echo 'Restored business totals differ from the backup summary. Investigate before accepting recovery.' >&2
  exit 1
fi
psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r' ORDER BY relname; SELECT has_table_privilege('authenticated','public.orders','SELECT') AS authenticated_read, has_table_privilege('authenticated','public.orders','INSERT') AS direct_insert_must_be_false, has_function_privilege('authenticated','public.save_order(jsonb)','EXECUTE') AS order_rpc_granted;"
echo 'Business counts and totals match. Complete the role/auth/print checks in docs/OPERATIONS.md before accepting recovery.'
