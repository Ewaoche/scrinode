# API on Vercel

> **Status:** entry point implemented; deployment not yet created.
> **Supersedes:** AGENTS.md §30's droplet topology, once the project exists.

---

## 1. Why

The API had two endpoints, both health checks, when this was decided — no
Scripture routes, no search, no SSE. §18's Zedek streaming is the one part
that would have been awkward to retrofit onto functions, and it was unwritten.
Moving before there is anything to port is the cheapest moment there will ever
be.

The droplet remains provisioned and hardened, and `main.ts` still works, so
this is not a one-way door — §30 requires NestJS stay cloud-portable.

## 2. What exists

```text
apps/api/src/app.factory.ts   createApp / configureApp — the §33 baseline
apps/api/src/main.ts          long-lived server: local dev, any container
apps/api/api/index.ts         Vercel handler, caches Nest across warm calls
apps/api/vercel.json          build, function config, catch-all rewrite
apps/api/tsconfig.vercel.json typechecks api/ without moving build output
```

`deployment.test.ts` asserts both entry points import `createApp` and neither
calls `NestFactory` itself, so a handler cannot quietly skip helmet or the CORS
allow-list.

## 3. Rate limiting — the one real regression

**`ThrottlerModule` counts in process memory.** Each serverless instance keeps
its own counter, so the configured 10/s becomes 10/s *per instance* — which
under load is no limit at all. §33 lists rate limiting as an implemented
baseline.

**The decision is to enforce it at Vercel's edge (WAF) instead.** It runs
before the function is invoked, so it also avoids paying for abusive traffic,
and there is no Redis to operate.

**This cannot be committed to the repository.** Vercel WAF rules live in
project configuration, not `vercel.json`. That is a real drawback and worth
stating: the limit stops being reviewable in a diff, and nothing in CI can
assert it. Mitigations:

- Record the intended rules here, so the repository states what production
  should have.
- After configuring them, verify by hand against the deployed URL.

Intended rules, matching what `ThrottlerModule` declared:

| Path | Limit | Notes |
|---|---|---|
| `/health`, `/health/ready` | **exempt** | A throttled probe reads as an outage (§33). An e2e test asserts 20 consecutive requests all return 200. |
| everything else | 10 / second | Burst absorption. |
| everything else | 120 / minute | Sustained abuse cap. |
| Zedek routes (when they exist) | stricter | They call paid AI providers (§33). |

`ThrottlerModule` stays in place. It is correct for the long-lived server, it
is harmless on functions, and removing it would leave `main.ts` unprotected.

## 4. Connection pooling

**`DATABASE_URL` must use Neon's pooled host** — the one with `-pooler`.

A function does not share a pool across invocations and is frozen rather than
signalled, so it never closes connections on our schedule. Direct connections
accumulate until Neon refuses them.

Measured:

| | connect |
|---|---|
| direct host | 1,408 ms |
| pooled host | **701 ms** |

Two details that were verified rather than assumed:

- **`SET LOCAL hnsw.ef_search` survives transaction pooling**, because
  `packages/ingest/src/search.ts` issues it inside a transaction. A
  session-level `SET` would be silently lost, and retrieval would quietly use
  the default `ef_search`.
- **Migrations must use the direct host.** `withLock` holds an advisory lock on
  a dedicated client while the migration's statements run on the shared pool;
  transaction pooling does not keep that session pinned to one backend, so the
  lock can lapse and two deploys could migrate simultaneously.

  Measured, two clients racing for the same lock key:

  ```text
  direct host   second client acquired it: false   serialised correctly
  pooled host   second client acquired it: true    NOT serialised
  ```

  This is not a theoretical concern — the lock simply does not work through the
  pooler, so a migration run against it has no protection at all.

## 5. Still to do

1. **Create the Vercel project** for `apps/api`, root directory `apps/api`.
2. **Set environment variables**: `DATABASE_URL` (pooled), `DATABASE_SSL=true`,
   `CORS_ORIGINS` (both Vercel frontends, no wildcard), `NODE_ENV=production`.
3. **Configure WAF rules** per §3, then verify against the deployed URL.
4. **Point the frontends** at the new API origin.
5. **Run migrations** from CI or by hand against the *direct* host.
6. **Cold starts.** A function cold start plus a Neon cold start can compound —
   §31 targets a 500 ms common response. Measure before assuming it is fine.
7. **Decide the droplet's fate.** It is hardened and idle. Keeping it costs
   money; destroying it removes the fallback this plan relies on for §30's
   portability claim.

## 6. What this does not solve

- **Backups.** Still Neon's retention window only. Unchanged by this move and
  still the largest unmanaged risk.
- **Monitoring.** §34 requires latency, error and AI-cost tracking. Nothing is
  wired. Vercel provides some of this for functions, which is a partial answer
  rather than a complete one.
