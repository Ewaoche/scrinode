# Implementation Plan — Stage 1: Monorepo Scaffold

**Status:** Proposed — awaiting approval
**Author:** Claude (Opus 5)
**Date:** 2026-09-19
**Depends on:** `PLAN_backoffice_architecture.md` Stage 1
**Scope:** Scaffold and base stack only. **No UI build.**

---

## 1. Scope

### In scope

Turborepo workspace · three apps building and testing · shared packages · Auth.js wiring · theming · Redux Toolkit + RTK Query · MongoDB data layer · migration runner · test infrastructure · lint and boundary rules.

### Explicitly out of scope

No designed UI. Screens exist only as the minimum needed to prove wiring works — an unstyled page that renders, a login form that authenticates, a themed toggle that flips. **The Bible reader, Verse Inspector, backoffice screens and all visual design come later.**

No Bible data ingestion. No Zedek orchestration. No admin features beyond the identity groundwork already planned for Stage 2.

---

## 2. Stack decisions

### 2.1 Data layer — native driver, no Prisma

**Decided:** MongoDB native driver with Mongoose. Prisma rejected.

Prisma's MongoDB connector cannot run `$vectorSearch`, cannot express Atlas Search indexes, and supports only limited aggregation. Atlas Vector Search is the retrieval backbone of Zedek's RAG strategy (AGENTS.md §19, §20), so an ORM that cannot express it is disqualifying.

**Consequence:** `prisma migrate` was never available for MongoDB regardless, so migrations are hand-rolled — see §5.

### 2.2 Versions

Verified against npm on 2026-09-19.

```text
Node            22.17.1  (local)
pnpm            11.8.0   (workspaces)
Turborepo       2.11.2
TypeScript      5.x      — see note
Next.js         16.3.5
NestJS          12.0.3
Mongoose        9.10.1
mongodb driver  7.6.0
Redux Toolkit   2.12.0
next-themes     0.4.6
Tailwind CSS    4.3.3
Vitest          5.0.1
Playwright      1.63.0
```

**TypeScript:** npm's `latest` is 7.0.2. Pin to TypeScript 5.x for Stage 1 — NestJS 12 and the Next.js 16 toolchain have the broadest ecosystem support there, and a compiler major is not a risk worth absorbing in a scaffold. Revisit once the ecosystem settles.

**Auth.js:** use `next-auth@5.0.0-beta.32` with `@auth/mongodb-adapter`. v5 is the current line and the one Next.js 16 App Router targets; v4.24.15 is stable but legacy. This is a beta dependency in a production-first app — flagged as a risk in §7.

### 2.3 Package manager

pnpm workspaces. Strict by default, which is what enforces the package boundaries in §4.

### 2.4 Package naming

Every workspace package is scoped `@scrinode/*`. No unscoped names, no ad-hoc prefixes.

```text
@scrinode/web              apps/web
@scrinode/backoffice       apps/backoffice
@scrinode/api              apps/api

@scrinode/types            packages/types
@scrinode/validation       packages/validation
@scrinode/scripture        packages/scripture
@scrinode/config           packages/config
@scrinode/ui               packages/ui
@scrinode/admin-ui         packages/admin-ui
@scrinode/ai               packages/ai
@scrinode/eslint-config    packages/eslint-config
```

Rules:

- The scope is `@scrinode`, always. The directory name matches the package name after the scope.
- Apps are scoped too, for consistency, even though they are private and never published.
- Every workspace package sets `"private": true` unless a deliberate decision is made to publish it.
- Internal dependencies use `workspace:*`, never a version range.
- Imports read `@scrinode/scripture`, never a relative path across package boundaries. A relative import that escapes a package is a boundary violation and fails lint (§4).

---

## 3. Target structure

```text
scrinode/
├── apps/
│   ├── web/                   @scrinode/web         Next.js — public reader
│   ├── backoffice/            @scrinode/backoffice  Next.js — internal admin
│   └── api/                   @scrinode/api         NestJS  — shared
│       └── src/
│           ├── common/        guards, interceptors, filters
│           ├── database/      connection, repositories, migrations
│           ├── health/        liveness/readiness
│           └── admin/         module shell, globally guarded (Stage 2 fills it)
│
├── packages/
│   ├── types/                 @scrinode/types         domain primitives — no runtime deps
│   ├── validation/            @scrinode/validation    Zod schemas
│   ├── scripture/             @scrinode/scripture     BibleReference parsing, canonical IDs
│   ├── config/                @scrinode/config        shared tsconfig, eslint, tailwind preset
│   ├── ui/                    @scrinode/ui            shared primitives (near-empty in Stage 1)
│   ├── admin-ui/              @scrinode/admin-ui      admin components (empty in Stage 1)
│   ├── ai/                    @scrinode/ai            AIProvider interface only, no adapters
│   └── eslint-config/         @scrinode/eslint-config
│
├── data/{imports,fixtures,schemas}/
├── tooling/
└── docs/
```

### Build order

`@scrinode/types` → `@scrinode/validation` → `@scrinode/scripture` → apps. Turborepo derives this from the dependency graph; no manual ordering.

---

## 4. Package boundaries

Enforced by ESLint (`eslint-plugin-boundaries`), not convention — AGENTS.md §8 requires this.

| Rule | Reason |
|---|---|
| `@scrinode/web` must not import `@scrinode/admin-ui` | Admin code never ships in the public bundle |
| `@scrinode/web` must not import `@scrinode/backoffice` (and reverse) | Apps are independent deploys |
| `@scrinode/types` must have no runtime dependencies | Shared by everything including the edge |
| Domain services must not import the MongoDB driver directly | Repositories only — see §5 |
| Nothing imports a vendor AI SDK outside `@scrinode/ai` | AGENTS.md §17 |
| No relative import may cross a package boundary | Use the `@scrinode/*` name — §2.4 |

A failing boundary rule fails the build.

---

## 5. Data layer and migrations

### 5.1 Repository pattern

Raw driver calls never appear in domain services. Each collection gets a repository class exposing domain-shaped methods. This is what makes the driver choice reversible and keeps AGENTS.md §9 (domain-first) honest.

```ts
// packages/types — no runtime deps
export type BibleReference = {
  bookId: BookId;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};
```

### 5.2 Migration runner

Since there is no Prisma, Stage 1 builds a minimal runner:

```text
data/migrations/
  0001_initial_indexes.ts
  0002_....ts
```

Each migration exports `up` and `down`. A `migrations` collection records which have run. The runner is ordered, idempotent, and refuses to run out of sequence.

**Discipline (production-first):** expand → migrate → contract. Additive first, backfill, switch readers, and only drop in a later, separate deploy. The runner does not enforce this — the review does.

Stage 1 ships the runner plus one migration creating indexes. No data is written.

### 5.3 Connection

Single pooled connection per process, health-checked at `/health`. Connection string from env, never committed.

---

## 6. Staged commits

Each step builds, tests green, and is independently deployable. One commit each.

| # | Step | Verification |
|---|---|---|
| 1 | Workspace root — pnpm, Turborepo, shared tsconfig/eslint/prettier, `.gitignore`, `.env.example` | `pnpm install`; `turbo run lint` |
| 2 | `packages/types`, `packages/config` | `turbo build` |
| 3 | `packages/validation`, `packages/scripture` + unit tests for reference parsing | `turbo test` — real assertions |
| 4 | `apps/api` — NestJS skeleton, config module, health endpoint | `turbo test`; health returns 200 |
| 5 | Database layer — connection, repository base, migration runner + tests | Runner tests pass against in-memory Mongo |
| 6 | `apps/web` — Next.js, Tailwind, next-themes, RTK + RTK Query store | `turbo build`; theme toggle works |
| 7 | Auth.js wiring in `apps/web` — reader identity only | Sign-in flow test |
| 8 | `apps/backoffice` — Next.js shell, its own store, no auth yet (Stage 2) | `turbo build` |
| 9 | Playwright E2E harness + one smoke test per app | `turbo e2e` |
| 10 | Boundary lint rules + CI workflow | Violating import fails the build |

### Test expectations

Per AGENTS.md §41 and the standing instruction that tests must pass: real assertions, not placeholders. Reference parsing is the first genuinely testable domain logic and gets proper coverage in step 3. A red suite is fixed, never skipped or weakened.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| `next-auth@5` is beta in a production-first app | Isolate behind an auth module; v4 fallback is contained. Flagged for approval |
| TypeScript 7 is out; pinning to 5.x | Deliberate. Revisit when NestJS and Next.js ecosystems catch up |
| Hand-rolled migrations lack Prisma's guardrails | Runner is tested; expand→migrate→contract enforced by review |
| Tailwind 4 config differs substantially from v3 | Shared preset in `packages/config` so all three apps stay consistent |
| No staging environment confirmed | Raised in backoffice plan §7. Stage 1 touches no live data, so not blocking here |

---

## 8. Open questions

1. **MongoDB Atlas cluster** — does one exist, and is there a non-production database for development? Stage 1 needs only a connection string; step 5's tests use in-memory Mongo.
2. **`next-auth@5` beta** — acceptable, or pin to v4.24.15 stable?
3. **Auth providers for Stage 1** — wire email only, or Google/Apple too? Email alone is enough to prove the wiring.
4. **CI** — GitHub Actions assumed. Confirm, and whether a pre-commit hook should run tests locally given every commit is deploy-bound.

---

## 9. Definition of done

- `pnpm install && turbo build && turbo test && turbo lint` all pass from clean.
- Three apps build independently.
- Reference parsing has real, passing unit tests.
- Migration runner is tested; one index migration exists.
- A boundary violation fails the build, demonstrably.
- Theme toggle works in `apps/web`.
- A user can sign in to `apps/web`.
- **No designed UI beyond what proves the wiring.**
- AGENTS.md and README.md updated if anything here diverges from them.
