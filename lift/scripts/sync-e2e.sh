#!/usr/bin/env bash
# Lift sync end to end, locally (lift/SYNC.md): a throwaway Postgres built from drizzle/ migrations, the coach
# Next.js server on it (DATABASE_DRIVER=pg, a random LIFT_SYNC_TOKEN), the opt-in LiftKit e2e suites against it
# (the real LiftStore and SyncEngine on Linux or macOS), then teardown. Nothing touches Neon or Vercel.
#
#   lift/scripts/sync-e2e.sh             run everything
#   lift/scripts/sync-e2e.sh --keep      leave Postgres and the server running afterwards (prints how to stop them)
#
# Needs: Postgres 14+ server binaries (initdb, pg_ctl, postgres, psql; on PATH or under /usr/lib/postgresql/*/bin),
# node and npm (runs `npm ci` if node_modules is missing), swift, openssl, curl.
# Env: LIFT_E2E_PG_PORT (default 54329), LIFT_E2E_PORT (server, default 3999).
set -euo pipefail

KEEP=0
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    *) echo "usage: $0 [--keep]" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIFTKIT="$ROOT/lift/ios/Packages/LiftKit"
PG_PORT="${LIFT_E2E_PG_PORT:-54329}"
PORT="${LIFT_E2E_PORT:-3999}"
BASE_URL="http://127.0.0.1:$PORT"

say() { printf '\n▸ %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

# --- tools ---
pg_bin() { # PATH first, else the newest Debian/Ubuntu or Homebrew install
  if command -v "$1" >/dev/null 2>&1; then command -v "$1"; return; fi
  find /usr/lib/postgresql /usr/local/opt /opt/homebrew/opt -maxdepth 4 -path '*postgres*' -name "$1" -type f 2>/dev/null \
    | sort -V | tail -1 || true
}
INITDB="$(pg_bin initdb)"; PG_CTL="$(pg_bin pg_ctl)"; PSQL="$(pg_bin psql)"
[ -n "$INITDB" ] && [ -n "$PG_CTL" ] && [ -n "$PSQL" ] || die "Postgres server binaries not found (apt-get install postgresql, or brew install postgresql@16)"
for tool in node npm swift openssl curl; do command -v "$tool" >/dev/null || die "$tool not found"; done

# --- work dir; Postgres refuses to run as root, so as root it runs as the postgres user ---
WORK="$(mktemp -d "${TMPDIR:-/tmp}/lift-sync-e2e.XXXXXX")"
AS_PG=()
if [ "$(id -u)" = 0 ]; then
  id postgres >/dev/null 2>&1 || die "running as root needs a 'postgres' user for the database server"
  chmod 755 "$WORK"
  mkdir -p "$WORK/pg"; chown postgres "$WORK/pg"
  AS_PG=(runuser -u postgres --)
else
  mkdir -p "$WORK/pg"
fi
PGDATA="$WORK/pg/data"
DATABASE_URL="postgresql://lift@127.0.0.1:$PG_PORT/coach"
SERVER_PID=""

pg_start() { "${AS_PG[@]}" "$PG_CTL" -D "$PGDATA" -l "$WORK/pg/postgres.log" -w -o "-p $PG_PORT -k $WORK/pg -c listen_addresses=127.0.0.1 -c fsync=off" start >/dev/null; }
pg_stop() { "${AS_PG[@]}" "$PG_CTL" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true; }

teardown() {
  local status=$?
  if [ "$KEEP" = 1 ] && [ "$status" = 0 ]; then
    printf '\nLeft running: server %s (pid %s), Postgres %s\nStop with: kill %s; %s %s -D %s stop; rm -rf %s\n' \
      "$BASE_URL" "$SERVER_PID" "$DATABASE_URL" "$SERVER_PID" "${AS_PG[*]}" "$PG_CTL" "$PGDATA" "$WORK"
    return
  fi
  if [ -n "$SERVER_PID" ]; then
    pkill -TERM -P "$SERVER_PID" 2>/dev/null || true
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  pg_stop
  if [ "$status" != 0 ]; then
    echo "--- server log (tail) ---" >&2; tail -40 "$WORK/server.log" 2>/dev/null >&2 || true
  fi
  rm -rf "$WORK"
}
trap teardown EXIT
trap 'exit 130' INT TERM

# --- Postgres ---
say "Postgres on 127.0.0.1:$PG_PORT ($("$PSQL" --version))"
"${AS_PG[@]}" "$INITDB" -D "$PGDATA" -A trust -U lift --no-sync >/dev/null
pg_start
"$PSQL" -q -v ON_ERROR_STOP=1 "postgresql://lift@127.0.0.1:$PG_PORT/postgres" -c "CREATE DATABASE coach"
# The full schema, from the same migrations production applies (DATABASE.md).
(cd "$ROOT" && DATABASE_URL="$DATABASE_URL" node scripts/db/migrate.mjs --yes)

# --- server ---
TOKEN="$(openssl rand -hex 32)"  # generated per run, never stored
[ -d "$ROOT/node_modules" ] || (cd "$ROOT" && npm ci --no-audit --no-fund)
say "coach server on $BASE_URL (next dev, DATABASE_DRIVER=pg)"
# Clerk needs a publishable key to start; the sync routes are public to Clerk, so a syntactically valid placeholder
# for a made-up instance is enough (no Clerk request is made for them). Real keys in the environment win.
PLACEHOLDER_PK="pk_test_$(printf 'lift-e2e.clerk.accounts.dev$' | base64 | tr -d '\n=')"
(
  cd "$ROOT"
  export DATABASE_URL DATABASE_DRIVER=pg LIFT_SYNC_TOKEN="$TOKEN" NEXT_TELEMETRY_DISABLED=1
  export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-$PLACEHOLDER_PK}"
  export CLERK_SECRET_KEY="${CLERK_SECRET_KEY:-sk_test_lift_e2e_placeholder}"
  exec node node_modules/next/dist/bin/next dev --turbopack -p "$PORT"
) >"$WORK/server.log" 2>&1 &
SERVER_PID=$!

pull() { curl -s -m 60 -o "$WORK/pull.json" -w '%{http_code}' -H "Authorization: Bearer $1" "$BASE_URL/api/lift/sync/pull" || true; }
for _ in $(seq 1 180); do
  [ "$(pull "$TOKEN")" = 200 ] && break
  kill -0 "$SERVER_PID" 2>/dev/null || die "the server exited"
  sleep 1
done

# --- smoke: the exact checks DEFERRED.md gives for a deploy ---
say "smoke test"
code="$(pull "$TOKEN")"; body="$(cat "$WORK/pull.json")"
[ "$code" = 200 ] && [ "$body" = '{"changes":[],"cursor":"0","hasMore":false}' ] || die "pull on an empty server: $code $body"
echo "  GET /api/lift/sync/pull → 200 $body"
code="$(pull "wrong-token")"
[ "$code" = 401 ] || die "pull with a wrong token: $code"
echo "  GET /api/lift/sync/pull with a wrong token → 401"

# --- the e2e suites ---
export LIFT_SYNC_E2E_URL="$BASE_URL" LIFT_SYNC_E2E_TOKEN="$TOKEN" LIFT_SYNC_E2E_STATE_DIR="$WORK/device"
mkdir -p "$LIFT_SYNC_E2E_STATE_DIR"
say "swift test: SyncEndToEndTests"
(cd "$LIFTKIT" && swift test --filter SyncEndToEndTests)

say "swift test: SyncOutageEndToEndTests (Postgres stopped: the server answers 500)"
pg_stop
(cd "$LIFTKIT" && LIFT_SYNC_E2E_OUTAGE=down swift test --filter SyncOutageEndToEndTests)
pg_start
say "swift test: SyncOutageEndToEndTests (Postgres back: the kept outbox drains)"
(cd "$LIFTKIT" && LIFT_SYNC_E2E_OUTAGE=up swift test --filter SyncOutageEndToEndTests)

rows="$("$PSQL" -At "$DATABASE_URL" -c "SELECT count(*) FROM lift_rows")"
say "all Lift sync e2e checks passed ($rows rows on the server)"
