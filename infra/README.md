# Droplet infrastructure

Scrinode is split across two places:

```text
Vercel                      DigitalOcean Droplet
  apps/web        ──HTTPS──▶  apps/api  ──compose network──▶  PostgreSQL
  apps/backoffice                                              + pgvector
```

**The API runs beside the database on purpose.** Postgres publishes no port
at all: the two reach each other over a private compose network, so there is
no public database surface to firewall and no credential crossing the
internet. Only the API is exposed, behind TLS.

The frontends stay on Vercel because they benefit from its edge network and
hold no database credentials. AGENTS.md §30 requires NestJS stay
cloud-portable, and containerising it satisfies that rather than working
against it.

## Files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local development — publishes 5432, dev password |
| `docker-compose.prod.yml` | The droplet — no database port, no defaults |
| `infra/api/Dockerfile` | API image, built from the repository root |
| `infra/postgres/Dockerfile` | Postgres + pgvector + PostGIS |
| `infra/deploy.sh` | Backup → build → migrate → restart |
| `infra/postgres/backup.sh` | Nightly dump, verified, uploaded to Spaces |
| `infra/postgres/restore.sh` | Restore, and the rehearsal that proves it |

The two compose files are deliberately separate rather than a base and an
override. Development publishes a port and accepts a default password;
production must do neither, and an override you can forget to pass is not a
safe way to express that.

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
Everything marked required has no default and fails the stack if unset —
a production database must never accept a password written down in a
repository.

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_USER` | yes | |
| `POSTGRES_PASSWORD` | yes | `openssl rand -base64 32` |
| `POSTGRES_DB` | yes | |
| `CORS_ORIGINS` | yes | Both Vercel origins, comma-separated. No wildcard. |
| `DATABASE_POOL_MAX` | no | Default 10 |
| `PG_SHARED_BUFFERS` | no | ~25% of RAM |
| `PG_MAINTENANCE_WORK_MEM` | no | Sized so an HNSW build fits — see `postgres/README.md` |
| `DO_SPACES_BUCKET` | no | Without it, backups stay on the droplet only |
| `DO_SPACES_ENDPOINT` | no | |

`DATABASE_URL` is composed from the Postgres variables in the compose file
rather than set separately, so the API and the database cannot disagree about
the credentials.

## Backups

Nightly `pg_dump` in custom format, verified with `pg_restore --list`, kept 14
days locally and uploaded to Spaces.

**Custom format, not plain SQL**, so `pg_restore` can restore one table. After
an accidental `DELETE` you want that table, not the whole database.

**Verified on write.** A dump `pg_restore` cannot read is not a backup, and
the check is cheap enough to run every night.

**Pruning is local only.** Spaces retention belongs in a bucket lifecycle
rule: a droplet that deletes its own remote history is one compromise away
from having none.

**Rehearse restores.** `restore.sh --rehearse` restores into a scratch
database, prints row counts for the tables that would hurt to lose, and drops
it. Safe to run from cron, and the only thing that turns a backup into a
recovery plan.

What is actually at risk differs by table. Scripture text and retrieval units
re-ingest from publishers and Voyage — tedious and, for embeddings, not free.
Notes, highlights, collections and workspaces exist nowhere else.

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
4. **Single droplet.** No replica, so recovery means restoring a backup.
   Acceptable at current scale; worth revisiting before it is not.
