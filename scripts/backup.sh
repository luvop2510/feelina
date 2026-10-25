#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL from the Feelina Supabase Connect panel}"
: "${FEELINA_PROJECT_REF:?Set FEELINA_PROJECT_REF to the source Supabase project reference}"
[[ "$FEELINA_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]] || { echo 'Invalid source project reference.' >&2; exit 1; }
[[ "$DATABASE_URL" == *"db.${FEELINA_PROJECT_REF}.supabase.co"* || "$DATABASE_URL" == *"postgres.${FEELINA_PROJECT_REF}@"* ]] || { echo 'Connection string does not match the declared source project.' >&2; exit 1; }
for tool in supabase psql shasum; do
  command -v "$tool" >/dev/null || { echo "$tool is required." >&2; exit 1; }
done
umask 077
backup_root="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_root"
backup_dir="$(mktemp -d "$backup_root/feelina-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
chmod 700 "$backup_dir"
# Supabase's logical dump preserves ACLs and excludes provider-managed schema definitions.
supabase db dump --db-url "$DATABASE_URL" -f "$backup_dir/roles.sql" --role-only
supabase db dump --db-url "$DATABASE_URL" -f "$backup_dir/schema.sql"
supabase db dump --db-url "$DATABASE_URL" -f "$backup_dir/data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
supabase db dump --db-url "$DATABASE_URL" -f "$backup_dir/history_schema.sql" --schema supabase_migrations
supabase db dump --db-url "$DATABASE_URL" -f "$backup_dir/history_data.sql" --use-copy --data-only --schema supabase_migrations
# The CLI schema dump can omit custom triggers on managed auth tables.
psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT pg_get_triggerdef(t.oid) || ';' FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='auth' AND c.relname='users' AND NOT t.tgisinternal AND pn.nspname IN ('public','private') ORDER BY t.tgname" > "$backup_dir/auth-triggers.sql"
psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT json_build_object('orders',(SELECT count(*) FROM public.orders),'payments',(SELECT count(*) FROM public.payments),'variants',(SELECT count(*) FROM public.variants),'order_total_paise',(SELECT coalesce(sum(total_paise),0)::text FROM public.orders),'paid_paise',(SELECT coalesce(sum(amount_paise),0)::text FROM public.payments),'stock',(SELECT coalesce(sum(stock),0) FROM public.variants),'reserved',(SELECT coalesce(sum(reserved),0) FROM public.variants))" > "$backup_dir/business-summary.json"
printf '%s\n' "$FEELINA_PROJECT_REF" > "$backup_dir/source-project.txt"
(cd "$backup_dir" && shasum -a 256 roles.sql schema.sql data.sql history_schema.sql history_data.sql auth-triggers.sql business-summary.json source-project.txt > SHA256SUMS)
echo "Logical backup created: $backup_dir"
echo 'Not a verified recovery. Encrypt this directory, copy it off-site, and run the isolated Supabase restore drill.'
