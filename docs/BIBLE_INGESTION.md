# Bible Ingestion

**Status:** Implemented. 34 translations staged and parsed. Migrated from MongoDB Atlas to PostgreSQL + pgvector (2026-09-24); the load and embed stages need re-running against Postgres. Upload awaits credentials.
**Author:** Claude (Opus 5)
**Date:** 2026-09-20
**Implements:** AGENTS.md §21 (Source Provenance), §22.1 (Translation Licensing), §24 (Database Rules)
**Code:** `packages/ingest`
**See also:** `docs/TRANSLATION_LICENSING.md` for which texts may be served

---

## 1. What this is

A four-stage pipeline that turns publisher archives into verse documents:

```text
fetch  →  parse  →  upload  →  load
        USFM zip    verse JSON   DO Spaces   Postgres
```

Run so far: **34 public-domain English translations, 2,040 books, 36,709
chapters, 967,860 verse documents.** All parsed, validated and staged;
upload and load await credentials.

The stages are separate because they fail and cost differently. Downloading
73 MB of archives is slow and network-bound; parsing is fast and
deterministic; uploading costs bandwidth; loading writes to a production
database. Re-running `parse` after a parser fix must not re-download
everything, and `load` must be provable against local JSON before it touches
the database.

---

## 2. Running it

```bash
pnpm --filter @scrinode/ingest run build

node packages/ingest/dist/cli.js list           # every source, and its status
node packages/ingest/dist/cli.js fetch          # download archives  (~73MB)
node packages/ingest/dist/cli.js parse          # USFM → verse JSON  (~650MB)
node packages/ingest/dist/cli.js upload         # → DigitalOcean Spaces
node packages/ingest/dist/cli.js load           # → Postgres
```

Any stage accepts translation codes to limit it: `... parse BSB KJV`.
`load` takes `--all` to include unregistered texts; by default it loads only
translations registered in `packages/scripture/src/translations.ts`.

Credentials come from the environment (see `.env.example`) and are never
written to the staging tree, logged, or committed. The staging directory
`.ingest/` is git-ignored — it is reproducible, and the canonical copy lives
in object storage.

---

## 3. PowerShell scripts

Two scripts wrap the CLI for routine operation. Both are safe to run at any
time and skip work that is already current.

```powershell
.\scripts\Push-BibleSources.ps1      # fetch, parse, upload to Spaces
.\scripts\Push-BibleToPostgres.ps1   # load verse rows into Postgres
```

| Switch | Effect |
|---|---|
| `-Translation BSB, KJV` | limit to specific codes |
| `-WhatIf` | report state and stop |
| `-Force` | redo work the ledger says is current |
| `-SkipFetch` / `-SkipParse` | upload script only |
| `-RegisteredOnly` | Postgres script; load only servable translations |

Both read `.env` at the repository root, rebuild the CLI when its source is
newer than its output, print state before and after, and fail before doing
any work when a setting is missing. Neither prints a secret: the Postgres script
reports the cluster host and database, never the connection string.

The scripts orchestrate; the CLI owns hashing, the ledger and every write, so
a direct CLI invocation behaves identically.

### Idempotency

Two independent mechanisms, which is why an interrupted run is safe.

**Deterministic ids.** Every verse document's `_id` is
`TRANSLATION:BOOK.CHAPTER.VERSE`, so writes are upserts. A load that fails
halfway is repaired by re-running, never duplicated. Verified: a forced
reload of 62,188 verses left the count unchanged.

**The run ledger.** The `ingest_runs` table records the SHA256 of the
publisher archive each stage processed. Parsing is deterministic, so an
unchanged hash means unchanged output and the stage is skipped.

```text
{ _id: 'BSB:2026-08-08:load',
  stage: 'load', archiveSha256: 'c065fa11decc…',
  status: 'completed', verseCount: 31086, host: '…' }
```

Work is redone when the hash differs, when the previous run failed, and when
a run is still marked `running` — an interrupted run cannot be assumed
complete.

### Stale releases

When a translation is reloaded at a new release, verses from the previous one
are deleted. Without that, a book the publisher removed would still be served
as current text.

This is also where a real bug was caught before production. Documents were
being stamped with the release pinned in `sources.ts` while the stale sweep
matched on the manifest's release. When those disagreed, a load wrote 7,551
verses and then deleted **all** of them. The manifest is now authoritative —
it describes the bytes actually parsed — and a regression test covers it.

---

## 4. Storage layout

Two rules shape every path.

**Immutability.** Every path contains the source's release date, so a
re-import never overwrites what an earlier import read. eBible.org revises its
texts, and a verse that silently changes under a saved note or a published
sermon is a correctness failure, not a refresh.

**Referenceability.** Every path derives from data Scrinode already holds — a
translation code, a book id, a release. Nothing needs a lookup table, so
provenance records stay small and a lost record can be rebuilt from the object
store itself.

```text
bibles/
  bsb/                              registry code, lowercased
    2026-08-08/                     release = source publication date
      source/
        archive.zip                 publisher's bytes, byte-for-byte
        manifest.json               checksums, counts, provenance
      usfm/
        ROM.usfm                    one file per book, as shipped
      json/
        ROM.json                    parsed verses, ready to load
        index.json                  books, chapters, verse counts
    latest.json                     pointer to the current release
```

Keeping `source/archive.zip` is what makes the rest trustworthy: parsing can
be corrected and re-run without returning to the publisher, and the SHA256
proves the bytes are the ones whose licence was verified.

---

## 5. Database shape

**Verse documents**, one per translation per verse. This follows from
decisions already made elsewhere rather than from storage preference:

- `CanonicalVerseId` is already the database identity (§10)
- cross-references target verses, not chapters
- retrieval needs verse-level chunks for Zedek (§20)
- the Verse Inspector operates on a single verse

```ts
{
  _id:  'BSB:ROM.8.28',        // deterministic, so re-import is idempotent
  translation: 'BSB',
  bookId: 'ROM',
  canon: 'protestant',
  chapter: 8,
  verse: 28,
  ref:  'ROM.8.28',            // translation-independent, for comparison
  text: 'And we know that God works all things together…',
  ordinal: 45008028,           // sortable reading position
  release: '2026-08-08',
}
```

`_id` being deterministic matters: these imports are large enough to fail
partway, and upserts keyed on it mean a re-run repairs rather than duplicates.

Indexes are declared once in `documents.ts` and created by `load`:

| Index | Serves |
|---|---|
| `translation, bookId, chapter, verse` | reading one chapter |
| `ref, translation` | comparing one verse across translations |
| `translation, ordinal` | ordered reads crossing book boundaries |
| `translation, release` | replacing one release without touching others |

---

## 6. The canon problem

Only 13 of the 34 texts are 66-book Protestant Bibles. The rest carry
deuterocanonical books, are Old Testament only, or are partial.

`books.ts` previously held the 66-book canon alone, so ingesting Douay-Rheims
or the Septuagints would have produced book ids the registry rejected.

**Resolved by adding a canon tier, not by widening `Testament`.** A
deuterocanonical book still sits in the Old Testament era; translations
disagree about inclusion, not about era.

```ts
BOOKS                  66 Protestant     (unchanged, order 1–66)
DEUTEROCANONICAL_BOOKS 20 additional     (order 67–86)
ALL_BOOKS              both
```

Twenty deuterocanonical books were found across the archives: Tobit, Judith,
Greek Esther, Wisdom, Sirach, Baruch, Epistle of Jeremy, Song of the Three,
Susanna, Bel and the Dragon, 1–4 Maccabees, 1–2 Esdras, Prayer of Manasses,
Psalm 151, Psalms of Solomon and Greek Daniel. **Names and chapter counts were
read from the USFM files themselves**, not from memory.

`getBook` deliberately still resolves only the Protestant canon; `getAnyBook`
resolves both. Silently widening the existing function would have let
deuterocanonical references leak into surfaces that cannot render them.

---

## 7. What the archives actually contained

Three classes of surprise, all found by running the pipeline rather than by
reading about USFM. Each is recorded here because each looked like a bug and
was not.

### Letter-suffixed verses

The Septuagints and Greek Esther use `\v 50a` for material with no Hebrew
counterpart. Brenton's Genesis contains **both** 31:50 and 31:50a.

Stripping the suffix collapsed them into one document and lost text — it
surfaced as a duplicate-id failure. The suffix is now part of the verse's
identity: `BRENTON:GEN.31.50a`.

### Versification that differs from the registry

Every apparent excess investigated turned out to be a real textual fact:

| Observed | Reason |
|---|---|
| Brenton Psalms: 151 chapters | Psalm 151 exists in the Greek |
| Greek Esther: 16 chapters | additions with no Hebrew counterpart |
| Douay-Rheims Daniel: 14 | Susanna and Bel are chapters there |
| Brenton Ezra: 23 chapters | its `\h` reads "Ezra and Nehemiah" — merged |

The validator therefore does **not** compare chapter counts against the
registry, which records Hebrew versification. Doing so would refuse the text.
`releaseNotes` reports the differences so imports stay reviewable, while
duplicate ids, empty text and count mismatches still fail the release.

### Peripheral files

Archives ship front matter, introductions, glossaries and publisher extras as
`.usfm` files alongside Scripture. These are skipped by code
(`USFM_NON_BOOK_CODES`) and every skip is recorded in the manifest, so the
decision stays auditable rather than silent.

---

## 8. Parser guarantees

`packages/ingest/src/usfm.ts` extracts canonical verse text and nothing else.
Section headings, footnotes and cross-reference apparatus belong to their own
layers with their own provenance.

Verified against the real archives:

- footnotes and cross-references are removed **with their contents** — leaving
  them would splice editorial comment into Scripture, which §2 forbids
- character markup is removed **without** eating the words it wraps
- verse text spanning several lines and paragraph markers is joined correctly
- Strong's numbers are stripped from display text but recoverable via
  `extractStrongs`, so the original-language layer will not need a re-fetch
- BSB Psalm 119 parses to exactly 176 verses
- zero markup leakage across the Psalms

One deliberate non-change: the KJV carries literal `¶` pilcrows in its source
text. They are traditional paragraph marks, not markup, so ingestion leaves
them intact and the reader decides how to present them. Scripture is not
mutated at import.

---

## 9. Provenance

Every release carries a manifest satisfying §21:

```json
{
  "translation": "BSB",
  "release": "2026-08-08",
  "sourceUrl": "https://ebible.org/Scriptures/details.php?id=engbsb",
  "licenceName": "Public domain",
  "rightsHolder": "public domain",
  "archiveSha256": "c065fa11decc…",
  "totals": { "books": 66, "chapters": 1189, "verses": 31086 },
  "books": [ { "bookId": "ROM", "chapters": 16, "verses": 433, "sha256": "…" } ],
  "skipped": [ "00-FRTengbsb.usfm" ]
}
```

Per-book verse counts live here rather than in `books.ts`, because
versification is a property of a translation. BSB and WEB differ by 17 verses
across the same 1,189 chapters.

---

## 10. What is loaded versus what is stored

**Staging and the database are not the same set.** All 34 texts are downloaded and
archived so the corpus is complete and re-import never depends on a publisher
staying online. Only the 10 registered in
`packages/scripture/src/translations.ts` are servable.

`load` honours that by default; `--all` overrides it for the archive. The
`translations` collection records `available` per translation, and
`isAvailable()` remains the only gate on serving text.

Registering one of the other 24 is a registry entry plus its licence terms —
not another ingestion run.

---

## 11. Retrieval, measured

Tested against 5,609 embedded BSB units on 2026-09-20. Questions were worded
to share no distinctive keywords with their targets.

| Question | Top hit |
|---|---|
| how should I pray | MAT.6.7-12 (the Lord's Prayer) |
| what happens after we die | 1CO.15.19-24 |
| advice about money and greed | PRO.23.4-9 |
| the shepherd psalm | PSA.23 |
| instructions for building the tabernacle | EXO.35.10-15 |

### Do not filter by unit type

Granularities compete on score and the right one wins. "The shepherd psalm"
surfaces Psalm 23 as a **chapter** unit; "how should I pray" surfaces Matthew
6 **passages**. Both were found without a type filter.

Filtering to `passage` hides every chapter shorter than one window. Psalm 23
is six verses, so it has no passage unit at all — with `--type=passage` the
best available answer was Isaiah 40.

### Scores separate signal from noise

| Query | Score |
|---|---|
| instructions for building the tabernacle | 0.854 |
| the shepherd psalm | 0.801 |
| how should I pray | 0.768 |
| recipe for chocolate cake | 0.638 |
| how to configure a firewall | 0.622 |

Vector search always returns its top-k, so an unrelated question still gets
results. `LIKELY_RELEVANT_SCORE` (0.68) marks the gap. It is deliberately not
enforced in `searchUnits`: the right floor depends on what the caller does
with a miss, and Zedek saying "I have nothing relevant" is better than Zedek
grounding on a 0.62 match.

---

## 12. Storage — resolved by the move to Postgres

This section previously recorded a deferred decision: a BinData float32
vector measured 4.74 KB, BSB's 41,829 units projected to **225 MB**, and all
34 translations to **5.5 GB** — against an Atlas M0 cluster capped at 512 MB.
A single full embedding run filled it. The options were an M10 upgrade at
roughly $57/month, dropping verse-level units, or `int8` quantization.

**The move to self-hosted Postgres removes the constraint that forced the
choice.** Storage is droplet disk, and 5.5 GB is unremarkable there.

What replaced it is a different decision, already made: vectors are stored as
`halfvec(1024)` — 16-bit floats — rather than full `vector`.

| | float32 (`vector`) | float16 (`halfvec`) |
|---|---|---|
| Per unit | 4 KB | 2 KB |
| BSB (41,829 units) | ~172 MB | ~86 MB |
| All 34 translations | ~5.5 GB | ~2.7 GB |
| pgvector index ceiling | 2,000 dims | 4,000 dims |

At 1024 dimensions the recall difference is negligible — comparable to the
scalar quantization Atlas was already applying — while the HNSW index halves.
That matters because the index should stay resident in droplet RAM, and it is
RAM rather than disk that now sets the practical limit.

**What is still worth knowing.** Dropping verse-level units remains the
cheapest lever if memory ever becomes tight, and it costs less than it
sounds: the Verse Inspector looks a verse up by reference from
`translation_texts`, which is not a vector search. Verse units matter for
retrieval only when a question targets one specific verse whose wording is
not distinctive enough to surface its passage.

**Sizing the droplet.** `maintenance_work_mem` decides whether an HNSW build
takes minutes or hours; the full corpus wants roughly 1 GB for it, which a
2 GB droplet cannot give alongside everything else. Either build indexes
before loading the full corpus, or size at 4 GB. See
`infra/postgres/README.md`.

---

## 13. Open items

1. **Upload has not been run against real Spaces.** It needs credentials.
2. **The load and embed stages need re-running against Postgres.** Both were
   exercised end to end against MongoDB — 62,188 verses loaded, 5,609 units
   embedded, ledger tracking, idempotent re-runs, stale cleanup — but that
   proof does not carry over to the rewritten SQL path. The parsed staging
   tree is unchanged and needs no re-fetch.
3. **The 5,609 vectors embedded on Atlas do not transfer.** They were paid
   for per token. Export them before the cluster is decommissioned, or budget
   for re-embedding.
4. **Ordinal for deuterocanonical books** places them after Revelation
   (order 67–86). That keeps sorting stable but is not how Catholic or
   Orthodox editions print them. Worth revisiting when the reader gains a
   canon-aware table of contents.
5. **Strong's numbers are parsed but not stored.** `extractStrongs` works and
   the BSB carries lemma data on most words; wiring it into a lexemes table
   belongs with the original-language layer.
6. **`latest.json` is written by `upload` but nothing reads it yet.** It
   exists so the API can resolve "current text" without knowing dates.
