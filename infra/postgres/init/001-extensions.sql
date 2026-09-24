-- Extensions Scrinode depends on.
--
-- Runs once, when the data directory is first created. Migrations may then
-- assume these types and functions exist; a migration that has to
-- CREATE EXTENSION needs superuser, which the application role deliberately
-- does not have.
--
-- Installing an extension is not the same as using it. `unaccent` in
-- particular does nothing for full-text search until a text search
-- configuration wires it in — see migration 0004.

-- Vector similarity search. Replaces Atlas Vector Search (AGENTS.md §19).
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram matching, for the keyword and phrase classes of §14 search.
-- Postgres full-text search handles stemmed words; trigram handles partial
-- and misspelled input, which a reader typing a half-remembered phrase
-- actually produces.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Phonetic and edit-distance matching, for biblical proper names.
--
-- Distinct from pg_trgm, which compares spelling. This compares sound, and
-- the difference decides whether a reader finds what they meant:
--
--   Nebuchadnezer → Nebuchadnezzar   both handle
--   Zaccheus      → Zacchaeus        trigram is marginal
--   Isaias        → Isaiah           trigram fails outright
--
-- The last is not hypothetical. Douay-Rheims prints Isaias, Osee and Abdias
-- where Protestant editions print Isaiah, Hosea and Obadiah, and Scrinode
-- serves both (AGENTS.md §22.2). A reader who knows one set of names must
-- still be able to reach the other.
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Accent-insensitive comparison. Transliterated Greek and Hebrew arrive with
-- diacritics a reader will not type.
--
-- The unaccent() function works on its own; making to_tsvector
-- accent-insensitive additionally needs a text search configuration, which
-- migration 0004 creates.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Lets one GIN index cover a trigram column alongside a scalar filter such
-- as translation. Without it, a keyword search scoped to one translation
-- does two index scans and a bitmap merge — and every §14 keyword query is
-- scoped to a translation, because otherwise results repeat once per
-- translation loaded.
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Geospatial. Installed unused: no table carries a geometry column yet.
-- Biblical places and maps are Phase 2 / Phase 6 (AGENTS.md §37).
CREATE EXTENSION IF NOT EXISTS postgis;
