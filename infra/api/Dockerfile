# @scrinode/api — production image.
#
# The API moves to the droplet alongside Postgres so the database needs no
# public port: the two reach each other over a private compose network, and
# only the API is exposed. The frontends stay on Vercel and call the API over
# HTTPS (AGENTS.md §30).
#
# Built from the repository root, not this directory — the API depends on
# @scrinode/validation through `workspace:*`, so the build needs the whole
# workspace:
#
#   docker build -f infra/api/Dockerfile .
#
# Multi-stage so the runtime carries neither the build toolchain nor the
# source. §33 requires secrets outside source control; it follows that the
# image should carry as little as possible besides what it runs.

ARG NODE_VERSION=22

# --- dependencies ----------------------------------------------------------
# Separated so a source-only change does not re-resolve the dependency graph
# for the *build*. The runtime tree is produced separately by `pnpm deploy`,
# which resolves again on its own.
FROM node:${NODE_VERSION}-bookworm-slim AS deps

# Pinned to the version the workspace declares. A different pnpm can resolve
# the lockfile differently, which would make the image's dependency tree
# diverge from the one CI verified.
ARG PNPM_VERSION=11.8.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /repo

# Only the manifests, so this layer is reused whenever no dependency changed.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json                  apps/api/
COPY packages/validation/package.json       packages/validation/
COPY packages/types/package.json            packages/types/
COPY packages/config/package.json           packages/config/
COPY packages/eslint-config/package.json    packages/eslint-config/

# --frozen-lockfile fails when the lockfile does not match the manifests, so
# an image cannot be built from an unrecorded dependency change.
RUN pnpm install --frozen-lockfile --filter @scrinode/api...

# --- build -----------------------------------------------------------------
FROM deps AS build

COPY packages/types       packages/types
COPY packages/config      packages/config
COPY packages/validation  packages/validation
COPY apps/api             apps/api

# The API imports @scrinode/validation's build output, not its source.
RUN pnpm --filter @scrinode/types build \
 && pnpm --filter @scrinode/validation build \
 && pnpm --filter @scrinode/api build

# Collects the API and its production dependencies into one self-contained
# tree, with @scrinode/validation copied in rather than symlinked out to the
# workspace. The runtime needs Nest and pg, not the compiler that built dist/.
#
# --legacy is required, not optional: from pnpm 10, `deploy` refuses a
# workspace that has not set inject-workspace-packages, and points at this
# flag. Verified against pnpm 11.8.0 — without it the command exits 0 and
# produces a tree with no node_modules at all, which fails only at runtime.
RUN pnpm --filter @scrinode/api --prod --legacy deploy /runtime

# --- runtime ---------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# dumb-init reaps zombies and forwards signals. Without an init, Node runs as
# PID 1 and does not receive SIGTERM the way it expects, so a redeploy kills
# connections mid-request instead of draining them.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# The node image ships an unprivileged `node` user. Running as root would
# mean a process escape owns the container.
COPY --from=build --chown=node:node /runtime/node_modules ./node_modules
COPY --from=build --chown=node:node /runtime/dist         ./dist
COPY --from=build --chown=node:node /runtime/package.json ./package.json

USER node

EXPOSE 4000

# Uses the API's own readiness endpoint, so the check exercises the database
# connection rather than only proving the process is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
