-- Extensions Scrinode depends on.
--
-- Runs once, when the data directory is first created. Migrations may then
-- assume these types exist; a migration that has to CREATE EXTENSION needs
-- superuser, which the application role deliberately does not have.

-- Vector similarity search. Replaces Atlas Vector Search (AGENTS.md §19).
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram matching, for the keyword and phrase classes of §14 search.
-- Postgres full-text search handles stemmed words; trigram handles partial
-- and misspelled input, which a reader typing a half-remembered phrase
-- actually produces.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Accent-insensitive comparison. Transliterated Greek and Hebrew arrive with
-- diacritics that a reader will not type.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Geospatial. Installed unused: no table carries a geometry column yet.
-- Biblical places and maps are Phase 2 / Phase 6 (AGENTS.md §37).
CREATE EXTENSION IF NOT EXISTS postgis;
