#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the Supabase database connection string from the company dashboard}"
command -v pg_dump >/dev/null || { echo 'Install PostgreSQL client tools matching the server major version.' >&2; exit 1; }
command -v pg_restore >/dev/null || { echo 'pg_restore is required to verify the archive.' >&2; exit 1; }
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
umask 077
backup_file="$backup_dir/feelina-$(date -u +%Y%m%dT%H%M%SZ).dump"
# Auth identities are part of recovery; keep this archive encrypted and access-controlled.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --schema=private --schema=auth --file="$backup_file"
pg_restore --list "$backup_file" > "$backup_file.manifest"
shasum -a 256 "$backup_file" > "$backup_file.sha256"
echo "Archive verified: $backup_file. Encrypt and copy it to company-controlled off-site storage."
