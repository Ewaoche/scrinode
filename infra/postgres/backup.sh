#!/usr/bin/env bash
#
# Nightly logical backup of the Scrinode database.
#
# Self-hosting moved backups from Atlas to us (AGENTS.md §30). Protecting
# user data is a prime directive (§2.14), and notes, highlights, collections
# and workspaces exist nowhere else — Scripture text can be re-ingested from
# publishers, a reader's sermon draft cannot.
#
# Run from cron on the droplet:
#   0 3 * * *  /srv/scrinode/infra/postgres/backup.sh >> /var/log/scrinode-backup.log 2>&1
#
# Writes a compressed custom-format dump, prunes old ones, and optionally
# uploads to DigitalOcean Spaces. Custom format rather than plain SQL so
# pg_restore can restore selectively — after an accidental DELETE you want
# one table, not the whole database.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/srv/scrinode/docker-compose.prod.yml}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
BACKUP_DIR=/backups

# Loaded from the same .env the stack uses, so the credentials cannot drift
# apart from the ones Postgres is running with.
ENV_FILE="${ENV_FILE:-$(dirname "$COMPOSE_FILE")/.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
filename="scrinode-${POSTGRES_DB}-${timestamp}.dump"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "[$(date -uIs)] starting backup ${filename}"

# -Fc is the custom format: compressed, and restorable table by table.
# Written inside the container to the postgres_backups volume, so the dump
# survives the repository directory being replaced on deploy.
compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "${BACKUP_DIR}/${filename}"

size=$(compose exec -T postgres stat -c %s "${BACKUP_DIR}/${filename}")
echo "[$(date -uIs)] wrote ${filename} (${size} bytes)"

# A dump that pg_restore cannot read is not a backup. Listing its table of
# contents is cheap and catches a truncated or corrupt file now rather than
# during an incident.
if ! compose exec -T postgres pg_restore --list "${BACKUP_DIR}/${filename}" > /dev/null; then
  echo "[$(date -uIs)] FAILED: ${filename} is not readable by pg_restore" >&2
  compose exec -T postgres rm -f "${BACKUP_DIR}/${filename}"
  exit 1
fi

echo "[$(date -uIs)] verified ${filename} is readable"

# Off-site copy. A backup on the same droplet does not survive losing the
# droplet, which is one of the things a backup is for.
if [[ -n "${DO_SPACES_BUCKET:-}" ]] && command -v aws > /dev/null; then
  compose exec -T postgres cat "${BACKUP_DIR}/${filename}" \
    | aws s3 cp - "s3://${DO_SPACES_BUCKET}/backups/${filename}" \
        --endpoint-url "${DO_SPACES_ENDPOINT}"

  echo "[$(date -uIs)] uploaded to Spaces"
else
  echo "[$(date -uIs)] WARNING: no off-site copy — DO_SPACES_BUCKET unset or aws CLI missing" >&2
fi

# Prune local dumps. Spaces retention is set by a bucket lifecycle rule, not
# here: deleting remote backups from the machine being backed up means one
# compromised droplet can destroy its own history.
compose exec -T postgres \
  find "$BACKUP_DIR" -name 'scrinode-*.dump' -mtime "+${RETAIN_DAYS}" -delete

remaining=$(compose exec -T postgres sh -c "ls -1 ${BACKUP_DIR}/scrinode-*.dump 2>/dev/null | wc -l")
echo "[$(date -uIs)] done — ${remaining} local backup(s) retained"
