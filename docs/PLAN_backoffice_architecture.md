# Implementation Plan — Admin Backoffice

**Status:** Proposed — awaiting approval
**Author:** Claude (Opus 5)
**Date:** 2026-09-19
**Affects:** AGENTS.md §8, §27, §33; SCRINODE_Design_Specification_v1.0.md §14, §32; README.md

---

## 1. Summary

Scrinode adds a third application: an internal admin backoffice. The monorepo moves from two apps to three.

```text
apps/api          NestJS      — shared by both frontends
apps/web          Next.js     — public Bible reader (scrinode.com)
apps/backoffice   Next.js     — internal admin (admin.scrinode.com)
```

### Decisions (confirmed with product owner)

| Decision | Choice |
|---|---|
| Purpose | Bible/source data management, moderation & curation, user admin, Zedek ops, feature flags |
| Audience | Internal staff only — not customer-facing org admin |
| Deployment | Separate Vercel project, `admin.scrinode.com` |
| API | Shared `apps/api`, with a dedicated admin module |
| Identity | **Separate admin identity system**, with RBAC for admin teams |

### Why this is not "multi-tenant enterprise admin"

`AGENTS.md §36` lists multi-tenant enterprise admin as an MVP non-goal. That refers to customer-facing organization administration — churches and seminaries managing their own members. The backoffice is internal operations tooling. They are unrelated; the non-goal stands.

---

## 2. Architectural rationale

### 2.1 Why the backoffice exists

The specifications already require capabilities that have no interface:

- **§21 Source Provenance** — every imported source must record licence, attribution, origin, and import date. There is currently no way to manage that registry.
- **§38 Data Growth Strategy** — the ingestion pipeline (normalize → validate → provenance → canonical mapping → index) needs operational visibility.
- **§29 Background Jobs** — ingestion, embedding generation, and reindexing need triggering and monitoring.
- **v0.1 Production readiness baseline** — feature flags, source/licence registry, and observability are named requirements.
- **§34 Observability** — AI cost, token usage, and provider failure rates need somewhere to be read.

The backoffice is where these live.

### 2.2 Why a separate identity system

Admin identity is a distinct security domain from reader identity, not a role on the same account.

- A compromised reader account can never escalate to admin, because admin credentials live in a different collection with a different session cookie on a different domain.
- Admin sessions get their own policy: shorter expiry, mandatory MFA, IP logging.
- Reader auth is optimized for frictionless sign-up (Google, Apple, email); admin auth is optimized for control. These are opposing goals in one system.
- The reader `User` schema stays clean — no privilege fields to accidentally expose through a public API response.

**Trade-off accepted:** two auth implementations to maintain, and a staff member who is also a Scrinode user holds two accounts. This is intentional.

### 2.3 Why a shared API

One NestJS app with an isolated admin module, rather than a second API.

- One data-access layer, one set of domain services, one source of truth for validation.
- Admin and public logic over the same collections stays consistent.
- Avoids duplicating Mongo connection handling, provider abstraction, and observability.

**Isolation within the shared API is mandatory:**
- All admin routes namespaced under `/admin/*`.
- A global admin guard on the module — not per-route decorators, which are easy to forget.
- Admin routes never reachable with a reader session token, and the reverse.
- Separate rate limits and audit logging.

### 2.4 Why a separate Vercel project

- Independent deploys — an admin change cannot break the public reader.
- `admin.scrinode.com` can sit behind IP allow-listing or Vercel's access controls at the platform edge.
- Distinct environment variables and secrets.
- Public app's bundle never contains admin code.

---

## 3. Target structure

```text
scrinode/
│
├── apps/
│   ├── web/              Next.js — public reader
│   ├── backoffice/       Next.js — internal admin
│   └── api/              NestJS  — shared
│       └── src/
│           ├── scripture/
│           ├── study/
│           ├── zedek/
│           ├── workspaces/
│           ├── library/
│           └── admin/            ← admin-only module, globally guarded
│               ├── sources/      provenance & licence registry
│               ├── ingestion/    import runs, job triggers
│               ├── moderation/   dataset review & publication
│               ├── users/        support lookups, account state
│               ├── zedek-ops/    prompts, model roles, cost, flagged answers
│               ├── flags/        feature flags
│               └── audit/        audit log
│
├── packages/
│   ├── ui/               shared primitives — used by both frontends
│   ├── admin-ui/         admin-only components (tables, forms, job monitors)
│   ├── scripture/
│   ├── types/
│   ├── validation/
│   ├── ai/
│   ├── config/
│   └── eslint-config/
│
├── data/
├── tooling/
└── docs/
```

### Package boundary rules

- `packages/ui` holds genuinely shared primitives. Domain components that encode the reader experience (Verse, Passage, ScriptureSelection) stay reader-facing.
- `packages/admin-ui` is never imported by `apps/web`. Enforce with an ESLint boundary rule, not convention.
- `packages/types` gains admin types (`AdminUser`, `AdminRole`, `Permission`, `AuditEvent`, `SourceRecord`) — but admin types must not leak into public API response shapes.

---

## 4. RBAC model

### 4.1 Roles

| Role | Capability |
|---|---|
| `superadmin` | Full access, including admin user management and destructive operations |
| `data-admin` | Source imports, ingestion runs, licence registry, reindexing |
| `content-moderator` | Review and publish datasets (cross-references, themes, historical notes) |
| `support` | Read-only user lookups, account state; no data mutation |
| `observer` | Read-only dashboards and metrics |

Permissions are checked, not roles — a role is a named bundle of permissions. This allows adding roles later without touching guard logic.

```ts
type Permission =
  | "sources:read"    | "sources:write"
  | "ingestion:run"   | "ingestion:read"
  | "content:review"  | "content:publish"
  | "users:read"      | "users:write"
  | "zedek:configure" | "zedek:read"
  | "flags:write"     | "admin:manage"
  | "audit:read";
```

### 4.2 Collections

```text
admin_users        separate from `users` — never the same collection
admin_sessions
admin_roles
admin_audit_log    append-only
```

### 4.3 Non-negotiable rules

- Every mutating admin action writes an audit entry: actor, action, target, before/after, timestamp, IP.
- The audit log is append-only. No admin role can delete from it.
- Destructive operations (dataset deletion, bulk reindex, user deletion) require `superadmin` **and** explicit confirmation.
- No admin bootstrap endpoint in the running application. The first `superadmin` is seeded by a script run out-of-band.
- Admin sessions: short expiry, MFA required, re-authentication for destructive operations.

---

## 5. Production safety

The backoffice is, by definition, the surface with write access to everything. It gets the strictest treatment in the product.

| Risk | Mitigation |
|---|---|
| Accidental destructive action on live data | Typed confirmations; `superadmin` gate; dry-run mode for bulk operations |
| Bulk operation overwhelming production DB | Batched writes with rate limits; jobs go to the queue, never an interactive HTTP request (§29) |
| Admin change silently breaking the reader | Shared API contract tests; admin module cannot alter public response shapes without a failing test |
| Privilege escalation from reader to admin | Separate identity system, separate collections, separate cookies, separate domain |
| Unattributable change | Append-only audit log on every mutation |
| Ingestion corrupting canonical data | Import to a staging collection → validate → review → publish. Never write directly to live canonical collections (§38: never let imported data bypass validation) |

### Database migration discipline

Per the production-first rule, all schema work is expand → migrate → contract:

1. Add new fields/collections (additive, reversible).
2. Backfill.
3. Switch readers to the new shape.
4. Only then remove the old — in a later, separate deploy.

Admin collections are entirely new, so stage 1 carries no risk to existing data. The risk arrives when the backoffice begins writing to shared collections; that is gated in Stage 6.

---

## 6. Staged implementation

Each stage leaves the repo in a working, deployable state and ends in its own commit. No stage depends on a later one to compile or pass tests.

### Stage 0 — Documentation alignment *(no code)*
Update `AGENTS.md` §8 (repo structure), §27 (auth — two identity systems), §33 (security — admin rules), and add an admin section. Update `SCRINODE_Design_Specification_v1.0.md` §14 and §32. Update `README.md` to describe three apps.
**Verify:** docs consistent with each other; no contradictions with locked decisions.

### Stage 1 — Monorepo scaffold
Turborepo, shared TS/ESLint configs, `packages/types`, `packages/config`. Three empty-but-building apps. Test infrastructure (Vitest for unit/integration, Playwright for E2E) wired in from the start.
**Verify:** `turbo build` and `turbo test` pass across all three apps.

### Stage 2 — Admin identity & RBAC
`admin_users`, `admin_sessions`, permission model, guards, seed script for the first `superadmin`. No admin features yet — only the ability to authenticate and be authorized.
**Tests:** permission resolution, guard rejection paths, session expiry, reader-token-on-admin-route rejection, admin-token-on-reader-route rejection.

### Stage 3 — Audit log
Append-only collection, interceptor capturing every mutating admin request. Built before any feature that mutates, so nothing is ever unaudited.
**Tests:** every mutation produces an entry; deletion attempts fail for all roles.

### Stage 4 — Backoffice shell
`apps/backoffice` — login, layout, navigation, role-aware menu. Read-only dashboard.
**Tests:** unauthenticated redirect; role-based navigation visibility; E2E login flow.

### Stage 5 — Source & licence registry
First real feature. CRUD over `sources` with full provenance (§21). Read-only against existing data initially.
**Tests:** provenance validation rejects incomplete records; licence required.

### Stage 6 — Ingestion & moderation
Staging-collection import pipeline, validation, review queue, publish step. Job triggering via the queue. **This is the first stage where the backoffice writes to shared data — it carries the highest risk and should be reviewed most carefully.**
**Tests:** imports cannot bypass validation; publish is atomic; rollback works.

### Stage 7 — Zedek ops, user admin, feature flags
Model-role configuration, cost and token dashboards, flagged-answer review, support lookups, flag management.

---

## 7. Open questions

1. **MFA provider for admin auth** — TOTP, or WebAuthn/passkeys? WebAuthn is stronger and there is no legacy constraint.
2. **Vercel access control** — IP allow-list, Vercel Authentication, or application-level only? Platform-edge protection is preferable as defence in depth.
3. **Staging environment** — is there one? Stage 6 in particular wants a rehearsal target that is not production.
4. **Admin user provisioning** — invite flow, or manual seeding only for the near term?
5. **Should `apps/backoffice` be Next.js**, matching `apps/web`? Assumed yes for shared tooling and team familiarity, but it has no SEO or public-performance constraints, so alternatives are viable.

---

## 8. Documentation changes required

| File | Change |
|---|---|
| `AGENTS.md` §8 | Three apps; add `packages/admin-ui`; add `apps/api/src/admin/` |
| `AGENTS.md` §27 | Split into reader identity (Auth.js) and admin identity (separate); RBAC model |
| `AGENTS.md` §33 | Admin security rules: audit logging, destructive-action gating, no bootstrap endpoint |
| `AGENTS.md` (new §) | Admin backoffice domain — purpose, boundaries, what must never be built into it |
| `AGENTS.md` §45 | Product language: "Backoffice" as the term; not "admin panel" or "dashboard" |
| `v1.0 spec` §14 | Repository architecture — three apps |
| `v1.0 spec` §32 | Security — admin identity separation |
| `README.md` | Three-app description; deployment targets |

Note: the five-domain user-facing IA (Scripture / Study / Zedek / Work / Library) is **unchanged**. The backoffice is not a sixth domain — it is a separate application for a different audience and does not appear in the product's navigation.
