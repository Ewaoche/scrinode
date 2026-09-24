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
| `pg_trgm` | Partial and fuzzy keyword matching (§14) | Yes |
| `unaccent` | Accent-insensitive transliteration search | Yes |
| `postgis` | Geospatial | **No — installed ahead of Phase 2** |

PostGIS carries no tables yet. It is installed because adding an extension to
a live database later is a migration with superuser requirements, and the cost
now is image size only.

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
