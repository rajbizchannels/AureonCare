#!/usr/bin/env bash
# SEC-05 S9 test runner.
#
# Stands up a throwaway Postgres, loads schema.sql + the SEC-05 migrations
# (063-068), then runs the cross-tenant isolation test against it.
#
# In CI, point AC_DB_* at a disposable Postgres that already has schema.sql +
# migrations applied and run `node backend/test/sec05/isolation.test.js` directly;
# this script is the local/self-contained path.
set -euo pipefail

BACKEND="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/tmp/sec05-s9/data}"
SOCK="${PGSOCK:-/tmp/sec05-s9}"
PORT="${PGPORT:-55443}"
PGUSER_="${PGUSER_:-postgres}"

cleanup() { "$BIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true; }
trap cleanup EXIT

# As root, Postgres refuses to run — use an unprivileged user.
RUNAS=""
if [ "$(id -u)" = "0" ]; then
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  RUNAS="pgtest"
fi
run() { if [ -n "$RUNAS" ]; then su "$RUNAS" -c "$*"; else bash -c "$*"; fi; }

rm -rf "$SOCK"; mkdir -p "$PGDATA"
[ -n "$RUNAS" ] && chown -R "$RUNAS" "$SOCK"
run "$BIN/initdb -D $PGDATA -U $PGUSER_ -A trust" >/dev/null 2>&1
run "$BIN/pg_ctl -D $PGDATA -o '-p $PORT -k $SOCK -c listen_addresses=' -l $SOCK/pg.log start" >/dev/null 2>&1
sleep 2
chmod 777 "$SOCK" || true

PSQL="$BIN/psql -h $SOCK -p $PORT -U $PGUSER_ -d postgres"
# schema.sql is a pg_dump; a newer-server SET (transaction_timeout) is a harmless error.
run "$PSQL -q -f $BACKEND/schema.sql" >/dev/null 2>&1 || true
# accounts/inventory feature tables (best-effort; some depend on unloaded billing tables)
run "$PSQL -q -f $BACKEND/migrations/053_create_accounts_tables.sql" >/dev/null 2>&1 || true
run "$PSQL -q -f $BACKEND/migrations/055_create_inventory_tables.sql" >/dev/null 2>&1 || true
for m in 063_sec05_control_plane 064_sec05_template_schema 065_sec05_users_practice_id \
         066_sec05_cutover_default_tenant 067_sec05_provisioner_from_template 068_sec05_expand_tenant_set; do
  run "$PSQL -v ON_ERROR_STOP=1 -q -f $BACKEND/migrations/$m.sql" >/dev/null
done

echo "DB ready; running isolation test..."
AC_DB_H="$SOCK" AC_DB_P="$PORT" AC_DB_N=postgres AC_DB_U="$PGUSER_" AC_DB_W= \
  node "$BACKEND/test/sec05/isolation.test.js"
