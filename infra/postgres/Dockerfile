# Postgres with pgvector and PostGIS.
#
# No published image carries both. pgvector's image is the base because its
# extension is load-bearing for retrieval (AGENTS.md §19, §20); PostGIS is
# added from the PGDG repository that the base image already trusts.

ARG PG_MAJOR=17
FROM pgvector/pgvector:pg${PG_MAJOR}

# Repeated after FROM: an ARG declared before FROM leaves scope at FROM.
ARG PG_MAJOR

# PostGIS is installed but no table uses it yet. Biblical places, journeys and
# maps are Phase 2 and Phase 6 (AGENTS.md §37), and adding the extension later
# would mean a migration on a live database to get a capability we can have
# for the cost of image size now.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        "postgresql-${PG_MAJOR}-postgis-3" \
        "postgresql-${PG_MAJOR}-postgis-3-scripts"; \
    rm -rf /var/lib/apt/lists/*
