#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a disposable, isolated PostgreSQL database}"
: "${ALLOW_DISPOSABLE_RESTORE:?Set ALLOW_DISPOSABLE_RESTORE=yes after verifying the target is disposable}"
[[ "$ALLOW_DISPOSABLE_RESTORE" == yes ]] || { echo 'Disposable restore was not acknowledged.' >&2; exit 1; }
[[ $# -eq 1 && -f "$1" ]] || { echo 'Usage: scripts/restore-check.sh path/to/feelina.dump' >&2; exit 1; }
# Never use --clean: this drill is for a fresh target, not an in-place production restore.
pg_restore --dbname="$RESTORE_DATABASE_URL" --exit-on-error --single-transaction --no-owner --no-privileges "$1"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.orders) AS orders, (SELECT count(*) FROM public.payments) AS payments, (SELECT count(*) FROM public.variants) AS variants;"
echo 'Compare these counts and representative order totals with the source backup manifest before accepting recovery.'
