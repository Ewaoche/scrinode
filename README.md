# Scrinode

**A Bible-first, AI-assisted research and ministry workspace.**

Scrinode is a mobile-first web application for preachers, teachers, scholars, students, and serious readers of Scripture. The Bible itself is the primary interface — study tools, original-language data, cross-references, historical context, AI assistance, and sermon preparation all assemble *around* an active passage rather than living as separate tools.

It is not a chatbot with Bible data attached.

> **Scripture first. Research around Scripture. AI in service of Scripture.**

The product exists to carry a user through one motion without friction:

```text
READ → SELECT → STUDY → ASK ZEDEK → VERIFY → SAVE → BUILD → PREACH / TEACH / LEARN
```

---

## Status

**Scaffold complete; no interface built yet.** The monorepo, three applications, shared packages, database layer, authentication and test infrastructure are in place and verified. There is deliberately no designed UI — the Bible reader, Verse Inspector and backoffice screens come next.

```bash
pnpm install
pnpm verify                            # build · lint · typecheck · test
pnpm --filter @scrinode/e2e test:e2e   # end-to-end, in-memory database
```

191 unit tests and 19 end-to-end tests across six packages.

---

## The five domains

The information architecture is **locked** and does not change between devices — only its spatial composition does.

| Domain | Purpose |
|---|---|
| **Scripture** | Genesis-to-Revelation reader, navigation, search, translation switching, selection |
| **Study** | Structured, inspectable research: context, cross-references, original languages, morphology, themes, people, places, history |
| **Zedek** | Scripture-grounded AI research assistant — explains, compares, traces themes, cites sources |
| **Work** | Ministry output: sermons, Bible studies, teaching notes, liturgies, research projects |
| **Library** | Persistent saved knowledge: passages, highlights, notes, research cards, conversations, collections |

Bottom navigation on mobile, top navigation on large screens. Profile stays top-right and never occupies a primary navigation slot.

**Work vs. Library:** Work is what I am producing. Library is what I am keeping and reusing.

---

## Core concepts

Three ideas carry most of the architecture. Everything else follows from them.

### Canonical references

A verse is identified by a stable canonical ID (`ROM.8.28`), independent of any translation. Translation text is a *representation* of the verse, not the verse entity.

```text
ROM.8.28
├── translation texts     ├── themes          ├── highlights
├── Greek/Hebrew data     ├── historical notes└── conversations
├── cross-references      ├── user notes
```

References are typed objects, never strings — `BibleReference`, not `"Romans 8:28"`. Human-readable labels are presentation-level values.

### Shared Scripture Context

A single active context — reference, translation, selection range, selected text and tokens — travels across all five domains. Select a verse in Scripture, and Study opens scoped to it, Zedek already knows it, and research flows into a workspace still carrying it. Features accept `ScriptureContext` rather than independently parsing URLs.

### Evidence before synthesis

Retrieval follows a strict priority order, and AI is the *last* layer, never the source of truth:

```text
Canonical Scripture → Structured metadata → Original-language data
→ Cross-references → Lexical/historical sources → Semantic retrieval → AI synthesis
```

Zedek is orchestrated (intent routing, structured retrieval, tools, context assembly, citation validation), not a single prompt. Biblical text, structured research data, sourced scholarly material, and AI synthesis must remain visually and semantically distinct — and that distinction must survive copying, saving, and exporting.

---

## Technology

```text
Frontend       Next.js · React · TypeScript · Tailwind CSS · Radix UI · next-themes
State          Redux Toolkit + RTK Query
Backend        NestJS · TypeScript
Database       PostgreSQL 17 — containerised on a DigitalOcean Droplet
Vector search  pgvector, in the same database
Geospatial     PostGIS — installed, unused until Phase 2
Auth           Auth.js / NextAuth
AI             Provider abstraction layer (capability roles, not vendor names)
Streaming      Server-Sent Events
Email / SMS    Resend · Termii
Cron           Vercel Cron
Deployment     Frontends on Vercel; API and database on a DigitalOcean Droplet
```

### Three applications

```text
apps/api          NestJS    shared by both frontends
apps/web          Next.js   public reader — scrinode.com
apps/backoffice   Next.js   internal admin — admin.scrinode.com
```

The backoffice is internal staff tooling: source and licence registry, ingestion runs, content moderation, user administration, Zedek operations and feature flags. It is **not** a sixth product domain and never appears in product navigation. Admin identity is a separate system from reader identity — not a role on a reader account — so a compromised reader account cannot escalate.

See [docs/PLAN_backoffice_architecture.md](docs/PLAN_backoffice_architecture.md).

### Monorepo layout (Turborepo)

```text
scrinode/
├── apps/          web (Next.js) · backoffice (Next.js) · api (NestJS)
├── packages/      ui · admin-ui · scripture · types · validation · ai · config · eslint-config
├── data/          imports · fixtures · schemas
├── tooling/
└── docs/
```

All workspace packages are scoped `@scrinode/*` — `@scrinode/web`, `@scrinode/types`, `@scrinode/scripture` and so on. Internal dependencies use `workspace:*`, and imports always use the package name rather than a relative path across boundaries.

Package boundaries are enforced by ESLint rather than convention: the public reader cannot import admin code, `@scrinode/types` cannot take a runtime dependency, domain services cannot import the `pg` driver, and vendor AI SDKs are confined to `@scrinode/ai`. A violating import fails the build.

---

## Documentation

**[AGENTS.md](AGENTS.md) is the single source of truth.** It supersedes every document below. Where any of them conflicts with AGENTS.md, AGENTS.md is correct and the other document is stale. `docs/` holds *parts* — specifications, plans and references covering portions of the product, added to over time.

| Document | What it covers |
|---|---|
| [AGENTS.md](AGENTS.md) | **Authoritative. Read first when contributing.** Operational rules, prime directives, domain coding rules, change protocol, and the feature completion checklist |
| [docs/PLAN_backoffice_architecture.md](docs/PLAN_backoffice_architecture.md) | Admin backoffice: architecture, RBAC model, production safety, staged implementation |
| [docs/SCRINODE_Design_Specification_v1.0.md](docs/SCRINODE_Design_Specification_v1.0.md) | Current product + technical reference: IA, reader, data model, RAG, streaming, stack |
| [docs/Scrinode_Product_Design_Specification_v0.1.md](docs/Scrinode_Product_Design_Specification_v0.1.md) | Product/UX depth: design principles, trust model, Context Engine, user flows, MVP priority table, acceptance criteria, locked decisions |
| [docs/color-pallet.png](docs/color-pallet.png) | Visual palette — light/dark tokens, feature accents, brand colors, neutral scale |

Between the two specifications, v1.0 is the later technical reference; v0.1 remains the best source for material v1.0 does not repeat — the P0–P2 priority table, MVP acceptance criteria, user flows, and the record of locked decisions. Both predate the admin backoffice and are superseded by AGENTS.md wherever they differ.

---

## Design direction

Scholarly, calm, reverent, modern, warm, trustworthy, highly readable. Avoid loud gradients, neon, crypto-dashboard aesthetics, gamified spiritual language, and enterprise clutter. Accents are used sparingly.

Semantic identity: Scripture → Ink/Navy · Study → Olive/Sage · Zedek → Muted Gold · Work → Slate Blue · Library → Warm Stone.

Accessibility targets **WCAG 2.2 AA** and is a product requirement, not a post-launch task.

> **Note:** [docs/color-pallet.png](docs/color-pallet.png) defines several tokens the written specs do not (muted text, success, error, action text, the 50–700 neutral scale, named brand colors) and conflicts with them on the Work accent and dark-mode primary action. Resolve these before writing a token file.

---

## MVP scope

**In:** complete Bible reader with navigation and translation switching · universal search (reference, keyword, semantic) · selection and Verse Inspector · Study essentials (context, cross-references, core Greek/Hebrew) · Zedek quick actions and grounded conversational chat with citations · accounts and sync · sermon and Bible-study workspaces · Library.

**Explicitly deferred:** team collaboration · native mobile apps · offline-first · manuscript criticism · maps and timelines · presentation mode · audio/video Bible · real-time collaborative editing · multi-tenant enterprise admin.

Prepare the architecture for deferred work only where doing so is cheap and sensible.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local     # fill in MONGODB_URI and NEXTAUTH_SECRET
pnpm verify
```

Every environment variable the code reads is documented in [.env.example](.env.example), and a test fails if one is added without being documented there.

Day-to-day:

```bash
pnpm dev                                    # all three apps
pnpm --filter @scrinode/api migrate:status  # pending migrations
pnpm --filter @scrinode/api migrate         # apply them
```

Migrations are a deliberate, separate step — never run on application boot. They follow expand → migrate → contract: add, backfill, switch readers, and only drop in a later deploy. Every migration is reversible.

### What comes next

1. **Scripture reader + Verse Inspector** — v0.1 calls this "the nucleus that every Study, Zedek, Work and Library workflow depends upon." It precedes any AI work.
2. **Admin identity and RBAC**, then the audit log, then backoffice features — see [docs/PLAN_backoffice_architecture.md](docs/PLAN_backoffice_architecture.md).

Two decisions block substantial progress and should be settled early:

- **Translation licensing matrix.** Which translations ship at MVP. WEB, KJV, and ASV are public-domain safe; anything else gates the reader.
- **Structured data sources** for Greek/Hebrew, morphology, and cross-references. Every import must carry provenance — source, license, attribution, origin URL — recorded as first-class data.

---

## Contributing

Read [AGENTS.md](AGENTS.md) before making changes. It applies to human and AI contributors alike. In short:

- Never fabricate Bible data, lexical claims, cross-references, historical facts, citations, or licensing terms.
- Prefer structured data over model memory.
- Keep Scripture, interpretation, AI synthesis, and user content visibly distinct.
- Do not flatten contested theology into a single asserted answer.
- Reuse domain primitives; do not let biblical concepts become loosely typed strings.
- No vendor SDK calls in business logic — go through the provider abstraction.
- Do not redesign the primary IA without explicit approval.

Every feature runs through the checklist in [AGENTS.md §44](AGENTS.md) before it is considered complete.

---

> **Build Scrinode as a Bible platform first, an AI product second, and an extensible ministry operating system third.**

[scrinode.com](https://scrinode.com)
