# Postgres infrastructure

Scrinode runs one Postgres holding relational data, vectors and (later)
geospatial data. It replaces MongoDB Atlas and Atlas Vector Search.

## Why one database

Atlas Vector Search was a separate, metered service whose free tier capped
storage at 512 MB. The measured vector footprint for a single translation was
225 MB, and for all 34 sources 5.5 GB — so the cluster had to be upgraded
before the corpus was even loaded. See `docs/BIBLE_INGESTION.md` §12 for the
numbers that forced the decision.

pgvector runs inside the database we already need. Storage is droplet disk.

## Extensions

| Extension | Purpose | In use |
|---|---|---|
| `vector` | Similarity search over embeddings | Yes |
| `pg_trgm` | Partial and misspelled keyword matching (§14) | Yes |
| `fuzzystrmatch` | Phonetic matching for proper names | Yes |
| `unaccent` | Accent-insensitive search | Yes — via migration 0004 |
| `btree_gin` | One index over a trigram column plus a scalar filter | Yes |
| `postgis` | Geospatial | **No — installed ahead of Phase 2** |

All but `vector` and `postgis` ship with the official `postgres` image, which
pgvector's image is built on. Nothing extra is installed for them.

**`unaccent` needs more than installing.** It is a filtering dictionary:
`unaccent('agápē')` works as a function call, but `to_tsvector` ignores it
entirely unless a text search configuration names it. Migration 0004 creates
`scrinode_english` — English stemming with diacritics stripped first — and an
`immutable_unaccent` wrapper, because the stock function is `STABLE` and
Postgres refuses a `STABLE` function in an index expression.

Two details in that migration were wrong until they were run:

- **The two dictionaries live in different schemas.** `unaccent` is created
  by the extension in `public`; `english_stem` is built in and lives in
  `pg_catalog`. Unqualified names resolve against `search_path`, which a
  migration does not control, and the error — *text search dictionary does
  not exist* — reads like a missing extension.
- **ASCII tokens need mapping too.** Postgres classifies a plain English word
  as `asciiword` and an accented one as `word`. Mapping only `word` leaves
  ordinary English unstemmed while appearing to work on exactly the accented
  cases the change was made for.

An earlier version of this stack had the extension installed and unusable.
Every structural check passed while accent-insensitive search silently did
not exist, which is why `text-search.test.ts` asserts behaviour rather than
schema.

**Why `fuzzystrmatch` alongside `pg_trgm`.** Trigram compares spelling;
`dmetaphone` compares sound. Biblical proper names need both:

| A reader types | The text has | Trigram | Phonetic |
|---|---|---|---|
| Nebuchadnezer | Nebuchadnezzar | likely | yes |
| Zaccheus | Zacchaeus | marginal | yes |
| Isaiah | **Isaias** (Douay-Rheims) | no | yes, with edit distance |

The last row is the argument. Douay-Rheims prints *Isaias*, *Osee* and
*Abdias* where other editions print *Isaiah*, *Hosea* and *Obadiah*, and
Scrinode serves both (AGENTS.md §22.2).

**Phonetic matching needs two conditions, not one.** Measured against a real
database, both of these are true and neither is obvious:

```text
dmetaphone('Isaiah') = 'AS'      dmetaphone('Isaias') = 'ASS'   -> not equal
dmetaphone('was')    = 'AS'      dmetaphone('Esau')   = 'AS'    -> equal to Isaiah
```

So equality both **misses** the variant spellings it was added for and
**matches** the commonest words in the text. `is`, `as`, `was`, `has`, `ease`
and `Esau` all share Isaiah's code. The working form requires the sound to be
close *and* the spelling not to be wildly different:

```sql
levenshtein(dmetaphone(word), dmetaphone($1)) <= 1
  AND levenshtein(lower(word), lower($1))::numeric
        / greatest(length(word), length($1)) <= 0.5
```

The spelling bound is normalised by length: a fixed edit distance is generous
for a three-letter word and harsh for *Nebuchadnezzar*. Measured on the pairs
that matter, this admits all six genuine variants and rejects seven of nine
noise words; the two that remain (*Isaac*, *house*) are real words a reader
might plausibly be offered.

| Reader types | Text has | Phonetic | Spelling ratio | Matched |
|---|---|---|---|---|
| Isaiah | Isaias | 1 | 0.17 | yes |
| Hosea | Osee | 1 | 0.40 | yes |
| Obadiah | Abdias | 1 | 0.43 | yes |
| Elijah | Elias | 1 | 0.33 | yes |
| Isaiah | **was** | 0 | 0.83 | no |
| Isaiah | **Esau** | 0 | 0.67 | no |

Every line of this was found by running SQL, not by reading documentation:
the equality form was written first, looked obviously right, and failed.

PostGIS carries no tables yet. It is installed because adding an extension to
a live database later is a migration with superuser requirements, and the cost
now is image size only.

## Extensions considered and not installed

| Extension | Why not |
|---|---|
| `pgcrypto` | Not needed. `gen_random_uuid()` is core since PG13, which is what every `uuid` key uses. |
| `pg_cron` | AGENTS.md §29 specifies Vercel Cron → queue → worker. Revisit only if that queue never ships; it also needs `shared_preload_libraries`. |
| `pg_stat_statements` | Defensible — §34 requires query-latency tracking. Deferred because observability is not wired up and it needs `shared_preload_libraries`, so it is a compose change rather than init SQL. |
| `vectorscale` | StreamingDiskANN beats HNSW at scale and allows an index larger than RAM, but it needs a different base image. Revisit if the index outgrows the droplet. |

## Vector storage

Embeddings are `halfvec(1024)` — 16-bit floats — indexed with HNSW under
cosine distance.

**Why `halfvec` rather than `vector`:** Voyage emits 1024 dimensions. At
float32 that is 4 KB per unit and roughly 172 MB across all 34 sources; at
float16, 2 KB and ~86 MB. The retrieval quality difference at this
dimensionality is negligible — comparable to the scalar quantization Atlas was
already applying — and halving the index matters when it should stay resident
in droplet RAM.

**The dimension ceiling is real.** pgvector indexes `vector` up to 2,000
dimensions and `halfvec` up to 4,000. At 1024 we fit either way, but `halfvec`
leaves room for a larger embedding model without a storage-type migration.

## Memory settings

The compose file sets these explicitly rather than accepting defaults:

| Setting | Value | Why |
|---|---|---|
| `maintenance_work_mem` | 512MB | HNSW builds that do not fit fall back to a far slower on-disk path. This is the setting that decides whether an index build takes minutes or hours. |
| `shared_buffers` | 512MB | Roughly 25% of a 2 GB droplet. Raise proportionally on larger droplets. |
| `max_parallel_maintenance_workers` | 2 | Parallelises index builds. Above the droplet's core count it only adds contention. |

**Sizing against the droplet:** `shared_buffers` at ~25% of RAM and
`maintenance_work_mem` sized so the largest HNSW build fits. For the full
corpus that build wants roughly 1 GB, which a 2 GB droplet cannot give it
alongside everything else — so either build indexes before loading the full
corpus, or size the droplet at 4 GB.

## Local use

```bash
docker compose up -d postgres      # first run builds the image
docker compose logs -f postgres    # watch for "database system is ready"
pnpm --filter @scrinode/api migrate
```

### Without Docker

The database integration suites skip unless `TEST_DATABASE_URL` is set, and
they are the only thing that catches a migration that does not run. On a
machine without Docker, WSL serves:

```bash
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector
sudo service postgresql start
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'scrinode_test'"
sudo -u postgres createdb scrinode_test
sudo -u postgres psql -d scrinode_test   -c 'CREATE EXTENSION vector'  -c 'CREATE EXTENSION pg_trgm'   -c 'CREATE EXTENSION fuzzystrmatch' -c 'CREATE EXTENSION unaccent'   -c 'CREATE EXTENSION btree_gin'
```

Windows reaches WSL on its interface address, not localhost, and
`pg_hba.conf` must allow it:

```bash
echo 'host all all 172.16.0.0/12 md5' | sudo tee -a /etc/postgresql/16/main/pg_hba.conf
sudo sed -i "s/^#listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf
sudo service postgresql restart
hostname -I | awk '{print $1}'      # the host for TEST_DATABASE_URL
```

**Ubuntu's `postgresql-16-pgvector` is 0.6.0, which has no `halfvec`.**
Migration 0002 will fail against it. That is enough to exercise migrations
0001, 0003 and 0004; for the vector schema, use Docker or build pgvector
0.7+ from source.

The init SQL runs **only when the data directory is empty**. After changing
it, recreate the volume:

```bash
docker compose down -v && docker compose up -d postgres
```

`down -v` destroys local data. Never run it against the droplet.

## Production notes

- Port 5432 is published to `127.0.0.1` only, and on the droplet not at all —
  app containers reach Postgres over the compose network.
- The application role is not a superuser. It cannot create extensions, which
  is why they are created at init.
- `POSTGRES_PASSWORD` comes from the environment and has no production
  default. A missing value must fail the container, not silently accept a
  known password.
