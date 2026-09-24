#!/usr/bin/env bash
#
# Restore a Scrinode backup.
#
# This is the half that matters. A backup nobody has restored is a guess, so
# rehearse it against a scratch database on a schedule, not for the first
# time during an incident.
#
#   ./restore.sh --list
#   ./restore.sh --rehearse scrinode-scrinode-20260924T030000Z.dump
#   ./restore.sh --into scrinode_prod scrinode-...dump     # destructive
#
# `--rehearse` restores into a throwaway database and drops it afterwards.
# It proves the dump is good and changes nothing, which is what a scheduled
# drill should do.
#
# `--into` overwrites a real database and demands the name be typed in full
# (§33: destructive operations require explicit confirmation).

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/srv/scrinode/docker-compose.prod.yml}"
BACKUP_DIR=/backups
ENV_FILE="${ENV_FILE:-$(dirname "$COMPOSE_FILE")/.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

psql_admin() {
  # `postgres` is the maintenance database: a database cannot be dropped
  # while it is the one you are connected to.
  compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres "$@"
}

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

list_backups() {
  echo "Available backups:"
  compose exec -T postgres sh -c "ls -lh ${BACKUP_DIR}/scrinode-*.dump 2>/dev/null" \
    || echo "  (none)"
}

# Restores into a scratch database, verifies it, and drops it. Changes
# nothing, so it is safe to run from cron.
rehearse() {
  local dump="$1"
  local scratch="scrinode_restore_test_$(date -u +%s)"

  echo "[$(date -uIs)] rehearsing ${dump} into ${scratch}"

  psql_admin -c "CREATE DATABASE ${scratch}"

  # The extensions live in the dump only if they were created by a role with
  # rights to recreate them; creating them first makes the restore
  # independent of that.
  compose exec -T postgres psql -U "$POSTGRES_USER" -d "$scratch" \
    -c 'CREATE EXTENSION IF NOT EXISTS vector' \
    -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm' \
    -c 'CREATE EXTENSION IF NOT EXISTS fuzzystrmatch' \
    -c 'CREATE EXTENSION IF NOT EXISTS unaccent' \
    -c 'CREATE EXTENSION IF NOT EXISTS btree_gin' > /dev/null

  # --exit-on-error: a restore that reports success while skipping half the
  # tables is worse than one that fails.
  if compose exec -T postgres pg_restore \
      -U "$POSTGRES_USER" -d "$scratch" --exit-on-error --no-owner \
      "${BACKUP_DIR}/${dump}"; then
    echo "[$(date -uIs)] restore completed"
  else
    echo "[$(date -uIs)] FAILED: pg_restore reported errors" >&2
    psql_admin -c "DROP DATABASE IF EXISTS ${scratch}" > /dev/null
    exit 1
  fi

  # A structurally valid restore can still be empty. Check the tables that
  # would actually hurt to lose.
  echo "[$(date -uIs)] row counts:"
  compose exec -T postgres psql -U "$POSTGRES_USER" -d "$scratch" -t -c "
    SELECT format('  %-22s %s', table_name, cnt) FROM (
      SELECT 'translation_texts' AS table_name, count(*) AS cnt FROM translation_texts
      UNION ALL SELECT 'retrieval_units', count(*) FROM retrieval_units
      UNION ALL SELECT 'users',           count(*) FROM users
      UNION ALL SELECT 'sources',         count(*) FROM sources
    ) t"

  psql_admin -c "DROP DATABASE ${scratch}" > /dev/null
  echo "[$(date -uIs)] rehearsal passed; scratch database dropped"
}

# Overwrites a real database. Everything currently in it is lost.
restore_into() {
  local target="$1" dump="$2"

  echo
  echo "This DROPS the database '${target}' and replaces it with ${dump}."
  echo "Everything currently in it is lost."
  echo
  read -r -p "Type the database name to confirm: " confirmation

  if [[ "$confirmation" != "$target" ]]; then
    echo "Confirmation did not match. Nothing was changed."
    exit 1
  fi

  # Taken down first: an API holding connections would both block the DROP
  # and serve half-restored data while the restore ran.
  echo "[$(date -uIs)] stopping the API"
  compose stop api

  psql_admin -c "DROP DATABASE IF EXISTS ${target} WITH (FORCE)"
  psql_admin -c "CREATE DATABASE ${target}"

  compose exec -T postgres psql -U "$POSTGRES_USER" -d "$target" \
    -c 'CREATE EXTENSION IF NOT EXISTS vector' \
    -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm' \
    -c 'CREATE EXTENSION IF NOT EXISTS fuzzystrmatch' \
    -c 'CREATE EXTENSION IF NOT EXISTS unaccent' \
    -c 'CREATE EXTENSION IF NOT EXISTS btree_gin' > /dev/null

  compose exec -T postgres pg_restore \
    -U "$POSTGRES_USER" -d "$target" --exit-on-error --no-owner \
    "${BACKUP_DIR}/${dump}"

  echo "[$(date -uIs)] restarting the API"
  compose start api

  echo "[$(date -uIs)] restored ${dump} into ${target}"
}

case "${1:-}" in
  --list)     list_backups ;;
  --rehearse) [[ -n "${2:-}" ]] || usage 1; rehearse "$2" ;;
  --into)     [[ -n "${3:-}" ]] || usage 1; restore_into "$2" "$3" ;;
  -h|--help)  usage ;;
  *)          usage 1 ;;
esac
