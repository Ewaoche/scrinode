# Plan — reducing Neon cost

> **Status:** proposed, not implemented
> **Supersedes:** nothing. `docs/BIBLE_INGESTION.md` §12 records the storage
> decision this revises upward.
> **Prompted by:** a proposal to split storage across multiple Neon projects.

---

## 1. Why splitting projects does not help

The proposal was to spread the corpus over several Neon projects to
diversify storage. It does not reduce cost, and it breaks retrieval.

- **Neon bills per account, not per project.** 2.7 GB in three projects
  costs the same as 2.7 GB in one, and each extra project runs its own
  compute — so splitting adds cost. This differs from Atlas, which capped
  storage *per cluster*; splitting clusters there genuinely bought headroom,
  which is where the instinct comes from.
- **Postgres cannot JOIN across databases.** Measured against this endpoint:

  ```text
  ERR: cross-database references are not implemented
  ```

  AGENTS.md §19 builds retrieval on combining structured and vector results
  in one query. Splitting `retrieval_units` from `translation_texts` leaves
  `postgres_fdw` (available, but pushes down poorly and would sit in the hot
  path) or joining in application code — which abandons the reason §24 chose
  no ORM.

Multiple projects are still worth having, for **environments** rather than
storage — see §6.

---

## 2. Measured against a loaded database

**This section was revised after a trial ingestion.** The first version
extrapolated from a 2,000-row synthetic probe and was wrong in both
directions. What follows is measured against BSB actually loaded into Neon:
31,086 verses, 41,829 retrieval units.

### 2.1 What a row actually costs

Isolated by copying only the embedded rows into a probe table, so the vector's
marginal cost is separated from the row it sits on:

| | B/row |
|---|---|
| Row without vector | 452 |
| Marginal cost of the `halfvec(1024)` | **297** |
| HNSW index entry | **2,754** |
| **Total per embedded unit** | **3,503** |

**The vector is nearly free; the index is the cost.** 2,754 of 3,503 bytes —
79% — is HNSW. This matters for which levers work: dropping verse-level units
helps because it removes *index entries*, not because it saves vector bytes.

| Scope | Size |
|---|---|
| BSB, all 41,829 units | **0.14 GB** |
| Passages + chapters, 34 sources | **1.19 GB** |
| All 34 sources, all unit types | **4.64 GB** |

So **4.64 GB**, not the 6.8 GB the synthetic probe projected and not the
2.7 GB §12 projects. §12 counted raw vector bytes only, omitting both row
overhead and the index.

### 2.2 Embedding is not the expensive part

Measured from a one-book trial: 580 units, 44,226 tokens, **0.2168
tokens/char**. Projected at Voyage's list rate:

| Scope | Tokens | Approx. cost |
|---|---|---|
| Finish BSB (41,249 units) | 3.2M | **~$0.19** |
| Nine more translations, all units | 29.0M | **~$1.74** |

This was assumed to be a significant cost and is not. **Re-embedding is
therefore affordable**, which changes the risk calculus: a decision to drop
verse units is reversible for cents, so it can be made on measurement rather
than prediction.

### 2.3 Full-text indexes cost more than the text

Unexpected, and it applies to every translation loaded whether or not it is
embedded:

```text
translation_texts   22 MB heap   38 MB indexes
```

The `search_vector` GIN index, the accent-aware trigram index and the scoped
composite index together outweigh the Scripture. Not wrong — §14 needs all
three — but it means **loading a translation is not free even with no
vectors**, which the earlier plan implied.

### 2.4 Superseded: the corpus is larger than §12 says

*(Retained for the reasoning; the numbers are superseded by §2.1.)*

§12 projected 2.7 GB for all 34 sources at `halfvec`. That counted raw
vector bytes only. Measured on Neon at 2,000 rows per table, 1024
dimensions:

| | table | HNSW index | total |
|---|---|---|---|
| `halfvec(1024)` | 2,920 B/row | 2,204 B/row | **5,124 B/row** |
| `vector(1024)` | 5,677 B/row | 6,644 B/row | 12,321 B/row |

Extrapolated from BSB's 41,829 units:

| | halfvec | float32 |
|---|---|---|
| BSB alone | **0.20 GB** | 0.48 GB |
| All 34 sources | **6.79 GB** | 16.32 GB |

So the figure to budget against is **~6.8 GB**, not 2.7 GB. Two things §12
omitted: per-row overhead (a `halfvec(1024)` is 2 KB of payload in a 2.9 KB
row) and the HNSW index, which is not optional — it is what makes retrieval
sub-second.

**`halfvec` is worth more than §12 claimed.** It was justified as halving
storage; measured, it also cuts the index by **3×** (2,204 vs 6,644 B/row),
because HNSW stores the vectors in its own nodes. Total saving is 2.4×, not
2×. Already implemented in migration 0002 — no action needed, but the
reasoning should be recorded correctly.

---

## 3. Levers, cheapest first

### 3.1 Scale-to-zero on idle compute — do this first

Neon suspends compute when idle and bills compute by the hour it runs. The
droplet API holds a pool, so **an idle pool can defeat suspension entirely**
and bill 24/7 for a database nobody is querying.

Actions:

- Confirm autosuspend is enabled on the project.
- **Fix the container healthcheck.** `infra/api/Dockerfile` runs:

  ```dockerfile
  HEALTHCHECK --interval=30s ... /health/ready
  ```

  and `/health/ready` deliberately queries the database, because a readiness
  probe that does not is worthless (§30). Every 30 s is **2,880 queries a
  day, forever** — so Neon's compute never idles, and the project is billed
  for 24/7 compute whether or not a single user is reading Scripture.

  This was correct when Postgres sat on the same compose network, where a
  query cost nothing. It is now the single most expensive line in the setup.

  Options, in order of preference:

  1. **Cache the database check.** Probe it at most once every few minutes
     and serve the cached verdict in between. Readiness still fails when the
     database is genuinely unreachable, only slightly later.
  2. **Widen the interval** to `--interval=5m`. Simplest, but slower to
     detect a real outage.
  3. Split liveness from readiness and let the container probe only
     liveness. Weakest: §30 requires readiness to exercise the database, and
     a healthy process that cannot reach Postgres is exactly what liveness
     misses.

  Recommended: (1). It keeps the guarantee and removes the cost.

- Confirm `pg`'s pool idle timeout closes connections rather than holding
  them open, which can also defeat suspension.

This is the lever most likely to dominate the bill, it is a handful of lines,
and it costs nothing in capability.

### 3.2 Drop verse-level units — the big storage lever

§12 already identifies this and understates how cheap it is. Only `verse`
and `passage` unit types are implemented. Verse units are the overwhelming
majority of rows.

The Verse Inspector looks a verse up **by reference** from
`translation_texts` — not a vector search. Verse units matter for retrieval
only when a question targets one specific verse whose wording is not
distinctive enough to surface its passage.

Measured against the loaded corpus: verses are 31,086 of BSB's 41,829 units
(**74%**), and passages plus chapters are the remaining 26%. Dropping verse
units takes all 34 sources from **4.64 GB to 1.19 GB**.

Because re-embedding costs cents (§2.2), this is reversible: embed passages
and chapters first, measure retrieval quality, and add verse units only if
§14's `semantic_query` class demonstrably needs them.

**Recommended: embed passages for all sources, and verses for BSB only**
(~0.9 GB + 0.17 GB ≈ **1.1 GB**). Retrieval quality for the primary English
translation stays intact; the other 33 are reachable by reference and by
full-text search, which needs no vectors at all.

### 3.3 Do not embed all 34 sources yet

Nothing requires the full corpus for MVP. §35's Zedek scope needs grounded
retrieval, not 34 translations of it. Embedding BSB plus one or two others
covers it at **under 0.5 GB**.

Deferring is free and reversible; ingesting is neither, since embedding costs
Voyage API calls.

### 3.4 Keep full-text search doing the work it already does

`translation_texts.search_vector` and the trigram indexes (migration 0004)
serve §14's keyword, phrase and entity classes with **no vector storage at
all**. Only `semantic_query` needs embeddings. A cost review should confirm
the router is not sending keyword queries down the vector path.

### 3.5 Rejected

| Lever | Why not |
|---|---|
| `int8` quantization | pgvector has no `int8vector`. Real option is binary quantization, which costs recall; `halfvec` already gets 2.4× at negligible loss. |
| Lower embedding dimensions | Voyage emits 1024. Truncating needs re-embedding and loses recall. |
| Multiple projects | §1. |
| Self-host on the droplet | 458 MB RAM. §30 records why this failed. |

---

## 4. What to do before ingesting

Ordered, and the order matters — ingestion is the irreversible step.

1. **Read Neon's actual pricing for this account** and record the plan's
   included storage and compute in `infra/README.md`. Every number here is a
   size, not a price; nobody has checked the bill.
2. **Confirm autosuspend, and audit `/health/ready`'s query interval** (§3.1).
3. **Decide the embedding scope** (§3.2, §3.3). Recommended: passages for
   all sources, verses for BSB only.
4. **Then ingest**, watching `pg_database_size` as it goes rather than
   discovering the total afterwards.

---

## 5. Cost is not the only open question

Two items from `infra/README.md` remain, and neither is solved by this plan:

- **No backups under our control.** The `pg_dump` scripts cannot run against
  Neon. PITR is bounded by the plan's retention and does not survive losing
  the account.
- **Rotate the `neondb_owner` password.** It has been pasted into a chat
  transcript.

---

## 6. Multiple projects, used correctly

Not for storage — for environments. This closes §30's recorded gap that
"migrations meet production first".

```text
scrinode-prod      the droplet API
scrinode-staging   migrations rehearsed here before production
```

For CI and pre-migration safety, use **branches** rather than projects: a
Neon branch is copy-on-write, near-instant, and bills only the diff. A branch
taken immediately before a migration is the cheapest rollback available, and
is what `infra/deploy.sh` no longer does now that the `pg_dump` step is gone.

Not planned here; raised so the project layout is a deliberate decision
rather than an accident.
