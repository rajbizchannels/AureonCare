#!/usr/bin/env bash
# SEC-05 S9 test runner.
#
# Stands up a throwaway Postgres, runs the full migration chain from scratch, then runs
# the cross-tenant isolation test against it.
#
# In CI, point AC_DB_* at a disposable Postgres and run `node backend/run-migrations.js`
# followed by `node backend/test/sec05/isolation.test.js` directly; this script is the
# local/self-contained path.
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

# Build the database exactly the way a real deployment does: the migration runner on an
# empty database. Hand-picking a subset here is how this harness used to drift from the
# actual chain -- if the chain breaks from scratch, this test should break with it.
export AC_DB_H="$SOCK" AC_DB_P="$PORT" AC_DB_N=postgres AC_DB_U="$PGUSER_" AC_DB_W=
node "$BACKEND/run-migrations.js" >/dev/null
node "$BACKEND/run-tenant-migrations.js" >/dev/null

echo "DB ready; running isolation test..."
node "$BACKEND/test/sec05/isolation.test.js"
