# Droplet infrastructure

Scrinode is split across three places:

```text
Vercel                      DigitalOcean Droplet        Neon (us-east-2)
  apps/web        ──HTTPS──▶  apps/api        ──TLS──▶    PostgreSQL 18
  apps/backoffice                                          + pgvector 0.8.6
                                                           + PostGIS 3.6
```

**The database is managed, and that reverses an earlier decision.** The API
and Postgres were to share a compose network on the droplet, so that the
database published no port and no credential crossed the internet. The
droplet that exists has **458 MB of RAM and 8.7 GB of disk**; the corpus is
5.5 GB of vectors and an HNSW build for it wants ~1 GB of
`maintenance_work_mem` alone. It does not fit, and with no swap the OOM
killer would take Postgres.

What that costs, measured rather than estimated:

| | Previous (compose network) | Now (droplet nyc1 → Neon us-east-2) |
|---|---|---|
| Round trip | sub-millisecond | **~22 ms** |
| Credential on the wire | never left the host | TLS, certificate verified |
| Database port | none published | Neon's, public, authenticated |

`DATABASE_SSL=true` is therefore mandatory rather than a preference, and
`apps/api/src/database/deployment.test.ts` asserts it along with the absence
of any Postgres service in the production compose file.

A handler issuing five sequential queries now spends ~110 ms on round trips.
That is within §31's 500 ms budget but no longer free: batch in repositories,
and treat an N+1 as a correctness problem.

**The metering risk is back.** Managed, metered storage is what made Atlas
unaffordable (`docs/BIBLE_INGESTION.md` §12). Check Neon's cost for 5.5 GB
plus compute against the plan **before** ingesting, not after.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local development — publishes 5432, dev password |
| `docker-compose.prod.yml` | The droplet — API only, TLS required, no defaults |
| `infra/api/Dockerfile` | API image, built from the repository root |
| `infra/postgres/Dockerfile` | **Development only** — Postgres + pgvector + PostGIS |
| `infra/postgres/init/001-extensions.sql` | Extensions. Auto-runs locally; **manual against Neon** |
| `infra/deploy.sh` | Build → migrate → restart |
| `infra/postgres/backup.sh` | **Does not run against Neon** — see Backups |
| `infra/postgres/restore.sh` | **Does not run against Neon** — see Backups |

The two compose files are deliberately separate rather than a base and an
override. Development runs its own Postgres container with a default
password; production runs no database at all and requires every credential
to be supplied. An override you can forget to pass is not a safe way to
express that.

## First-time provisioning

Nothing here provisions the droplet automatically. That is a deliberate
limit, not an oversight: a half-written provisioning script invites being
trusted. Until one exists, this is the record.

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Firewall. Only SSH and HTTPS. The API's 4000 is bound to localhost and
#    reached through the proxy; Postgres publishes nothing.
ufw default deny incoming
ufw allow OpenSSH
ufw allow 443/tcp
ufw enable

# 3. Unattended security updates — an unpatched droplet is the likeliest
#    way this gets compromised.
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 4. The repository
git clone https://github.com/Ewaoche/scrinode.git /srv/scrinode
cd /srv/scrinode

# 5. Configuration. Never committed; see the table below.
cp .env.example .env && editor .env

# 6. Bring it up
docker compose -f docker-compose.prod.yml up -d
./infra/deploy.sh
```

### The Neon database

Neon has **no init hook**. A Postgres container runs
`infra/postgres/init/001-extensions.sql` on first boot; Neon does not, so the
extensions must be created once against each new database or branch, before
any migration runs:

```bash
psql "$DATABASE_URL"   -c 'CREATE EXTENSION IF NOT EXISTS vector'   -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'   -c 'CREATE EXTENSION IF NOT EXISTS fuzzystrmatch'   -c 'CREATE EXTENSION IF NOT EXISTS unaccent'   -c 'CREATE EXTENSION IF NOT EXISTS btree_gin'   -c 'CREATE EXTENSION IF NOT EXISTS postgis'
```

Skip it and migration 0001 fails with `operator class "gin_trgm_ops" does not
exist for access method "gin"`, which reads like a broken migration rather
than a missing extension. The `neondb_owner` role may create all six.

`unaccent` must land in `public`, which is where Neon puts it — migration
0004 qualifies the dictionary as `public.unaccent` and would fail otherwise.

### TLS

Vercel calls the API over HTTPS, so it needs a certificate. Caddy is the
smallest thing that does this correctly, including renewal:

```caddyfile
api.scrinode.com {
    reverse_proxy 127.0.0.1:4000
}
```

Point `api.scrinode.com` at the droplet, set `NEXT_PUBLIC_API_URL` to it in
both Vercel projects, and list both Vercel origins in `CORS_ORIGINS`. The API
rejects a wildcard origin outright (§33).

### Scheduled jobs

```cron
# Nightly backup
0 3 * * *  /srv/scrinode/infra/postgres/backup.sh >> /var/log/scrinode-backup.log 2>&1

# Weekly restore rehearsal. A backup nobody has restored is a guess.
0 4 * * 0  /srv/scrinode/infra/postgres/restore.sh --rehearse \
             "$(ls -t /var/lib/docker/volumes/scrinode_postgres_backups/_data/*.dump | head -1 | xargs basename)" \
             >> /var/log/scrinode-restore-test.log 2>&1
```

## Configuration

Lives in `.env` beside `docker-compose.prod.yml`, on the droplet only.
Everything marked required has no default and fails the stack if unset — a
production API must never silently point at a database nobody named.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | The Neon string, whole, from the Neon console |
| `CORS_ORIGINS` | yes | Both Vercel origins, comma-separated. No wildcard. |
| `DATABASE_POOL_MAX` | no | Default 10 |
| `API_PORT` | no | Default 4000, published to localhost only |

`DATABASE_SSL` is **not** listed: the compose file hard-codes `'true'` rather
than reading it from `.env`, so it cannot be turned off by editing a file on
the droplet. A test asserts that.

The `POSTGRES_*` and `PG_*` variables are gone from production — they
configured the container, and there is none. They remain in `.env.example`
for local development.

**Rotate the Neon role's password if the connection string has ever been
pasted anywhere it could be retained** — a chat log, a ticket, a shell
history. It is the only credential guarding the database.

## Backups

**Not implemented against Neon. Do not assume otherwise.**

`backup.sh` and `restore.sh` run `pg_dump` and `pg_restore` inside the
Postgres container via `docker compose exec`. That container no longer
exists in production, so both scripts fail there. They remain valid against
the development compose stack, and are kept for that and for whatever
replaces them.

What Neon provides instead is **point-in-time restore within the plan's
retention window**, plus branching. That is a genuinely different recovery
model, and the difference matters:

| | `pg_dump` (what the scripts did) | Neon PITR |
|---|---|---|
| Restore one table after a bad `DELETE` | yes, custom format | branch, then copy across |
| Survives losing the Neon account | yes — the file is ours | **no** |
| Retention | 14 days local, longer in Spaces | plan's window |
| Rehearsed | weekly cron, row counts printed | untested here |

**The decision is open.** Either is defensible; holding neither is not.
Until it is settled:

- The scheduled backup and restore-rehearsal cron entries below **must not**
  be installed on the droplet — they would fail nightly and, worse, look
  like backups exist.
- AGENTS.md §30 states plainly that backups are Neon's and unverified.

What is actually at risk differs by table. Scripture text and retrieval
units re-ingest from publishers and Voyage — tedious and, for embeddings,
not free. Notes, highlights, collections and workspaces exist nowhere else;
those are the rows a retention window has to cover.

A `pg_dump` against Neon from the droplet needs only the connection string
and a `postgresql-client` package, so restoring the scripts is a small
change — it is the schedule, the storage target and the rehearsal that make
it a backup rather than a file.

## Deploying

**Deployment is off until you turn it on.** The job is gated on a repository
variable `DEPLOY_ENABLED`, which does not exist yet — so the deploy job is
skipped rather than failing on absent secrets. A pipeline that is always red
stops being read.

Once the droplet exists and the secrets below are set, add the repository
variable `DEPLOY_ENABLED = true` (Settings → Secrets and variables → Actions
→ Variables). Deployment then runs on every push to `main` once `verify` and
`e2e` both pass.

The workflow SSHes in and runs `deploy.sh`; the droplet builds the image
itself, because it holds the layer cache and the running stack, and shipping
an image from CI would need a registry for no benefit at this scale.

By hand, when needed:

```bash
cd /srv/scrinode && git pull && ./infra/deploy.sh
```

Either way it backs up, builds, migrates, restarts, and waits for readiness
before reporting success.

### Repository secrets and variables

Set these under Settings → Secrets and variables → Actions.

| Variable | Value |
|---|---|
| `DEPLOY_ENABLED` | `true` to enable deployment. Absent means the job skips. |

| Secret | Value |
|---|---|
| `DROPLET_HOST` | Hostname or IP |
| `DROPLET_USER` | The deploy user — **not** root |
| `DROPLET_SSH_KEY` | Private key for that user |

Set the secrets *before* the variable. With `DEPLOY_ENABLED` on and secrets
missing, the job runs and fails at the SSH step.

The deploy job is gated on `github.event_name == 'push'` as well as the ref,
so a pull request cannot reach the droplet, and serialised by a concurrency
group so two runs cannot migrate the same stack at once.

**Narrow the deploy key.** It is held by a third-party action, so assume it
can leak. Give it its own unprivileged user and restrict it in
`authorized_keys`:

```text
command="/srv/scrinode/infra/deploy.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA...
```

A stolen key can then deploy and nothing else.

### When a deploy fails

`deploy.sh` does not roll back. Between the migration and the restart, the
old code is already serving against the new schema, so an automatic second
change is more likely to compound the problem than fix it.

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 api
./infra/postgres/restore.sh --list
```

Migrations run as a deliberate step, never on boot. Between the migration and
the restart, the **old** code serves traffic against the **new** schema —
which is why §24 requires expand → migrate → contract. A migration that drops
a column the running version still reads is an outage.

## What is still missing

Honest list, in the order worth doing:

1. **No monitoring.** §34 wants latency, error rates and AI cost tracked;
   Sentry is named and nothing is wired. Disk filling silently is the classic
   self-hosted outage — `log_min_duration_statement` and log rotation are set,
   which is a floor, not a solution.
2. **No provisioning automation.** The steps above are a runbook, not code.
   Rebuilding the droplet means following them by hand.
3. **No staging environment.** Migrations meet production first.
4. **No backups under our control.** The `pg_dump` scripts cannot run
   against Neon; what exists is Neon's retention window. See Backups — this
   is the gap most likely to be discovered at the worst moment.
5. **Neon's cost is unverified against the corpus.** 5.5 GB of vectors plus
   compute, on a provider billed by both. Metered managed storage is what
   made Atlas unaffordable; check the number before ingesting.
6. **The droplet is 458 MB / 8.7 GB / 1 vCPU.** Enough for the API alone.
   It has no headroom for anything else, and no swap.
