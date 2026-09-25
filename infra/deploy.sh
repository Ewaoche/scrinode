#!/usr/bin/env bash
#
# Deploy Scrinode to the droplet.
#
#   cd /srv/scrinode && git pull && ./infra/deploy.sh
#
# Order matters and is the point of this script:
#
#   1. build the new image before stopping anything
#   2. migrate
#   3. restart the API
#
# There is no backup step. It ran `pg_dump` inside the Postgres container,
# and the database is now Neon — see infra/README.md, "Backups", which is
# an open gap rather than a solved problem. Take a Neon branch before a
# migration you are unsure of.
#
# Migrations run as a deliberate step, never on application boot (see
# apps/api/src/database/migrate.ts). Several API instances starting together
# would otherwise each try to migrate; the runner's advisory lock makes that
# safe, but "safe" is not the same as "intended".
#
# Expand → migrate → contract (AGENTS.md §24) is what makes this ordering
# work: a migration must not break the version currently running, because
# between steps 3 and 4 the old code is serving traffic against the new
# schema.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "[$(date -uIs)] deploying $(git rev-parse --short HEAD)"

# --- 1. build --------------------------------------------------------------
# Before anything stops. A build failure should leave the running deployment
# untouched rather than halfway through a restart.
echo "[$(date -uIs)] building"
compose build api

# --- 2. migrate ------------------------------------------------------------
# Run from the newly built image, so the migrations applied are the ones this
# commit defines. `run --rm` gives a throwaway container rather than
# disturbing the API that is still serving.
echo "[$(date -uIs)] migrating"
compose run --rm --no-deps api node dist/database/migrate.js status
compose run --rm --no-deps api node dist/database/migrate.js up

# --- 3. restart ------------------------------------------------------------
echo "[$(date -uIs)] restarting the API"
compose up -d api

# Confirm it actually came back. A deploy that leaves the API failing but
# reports success is worse than one that fails loudly.
echo "[$(date -uIs)] waiting for readiness"
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${API_PORT:-4000}/health/ready" > /dev/null 2>&1; then
    echo "[$(date -uIs)] deployed — API ready"

    # Images accumulate on a small droplet until the disk fills.
    docker image prune -f --filter 'until=168h' > /dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "[$(date -uIs)] FAILED: the API did not become ready" >&2
compose logs --tail=50 api >&2
exit 1
