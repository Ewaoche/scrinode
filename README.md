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

**Pre-implementation.** This repository currently contains specifications only — no application code has been written yet. The design is settled enough to build against; see [Getting started](#getting-started) for what comes first.

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
Database       MongoDB Atlas
Vector search  MongoDB Atlas Vector Search
Auth           Auth.js / NextAuth
AI             Provider abstraction layer (capability roles, not vendor names)
Streaming      Server-Sent Events
Email / SMS    Resend · Termii
Cron           Vercel Cron
Deployment     Vercel
```

Planned monorepo layout (Turborepo):

```text
scrinode/
├── apps/          web (Next.js) · api (NestJS)
├── packages/      ui · scripture · types · validation · ai · config · eslint-config
├── data/          imports · fixtures · schemas
├── tooling/
└── docs/
```

---

## Documentation

| Document | What it covers |
|---|---|
| [AGENTS.md](AGENTS.md) | **Read first when contributing.** Operational rules, prime directives, domain coding rules, change protocol, and the feature completion checklist |
| [docs/SCRINODE_Design_Specification_v1.0.md](docs/SCRINODE_Design_Specification_v1.0.md) | Current product + technical reference: IA, reader, data model, RAG, streaming, stack |
| [docs/Scrinode_Product_Design_Specification_v0.1.md](docs/Scrinode_Product_Design_Specification_v0.1.md) | Product/UX depth: design principles, trust model, Context Engine, user flows, MVP priority table, acceptance criteria, locked decisions |
| [docs/color-pallet.png](docs/color-pallet.png) | Visual palette — light/dark tokens, feature accents, brand colors, neutral scale |

v1.0 supersedes v0.1 as the technical reference. v0.1 remains authoritative for material v1.0 does not repeat: the P0–P2 priority table, MVP acceptance criteria, user flows, and the record of locked decisions.

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

There is no application code yet. The specifications name the build order, and the first artifacts are:

1. **Monorepo scaffold** — Turborepo, shared TypeScript and lint configs.
2. **`packages/types` and `packages/scripture`** — `BibleReference`, canonical ID parsing and formatting, `ScriptureContext`. Reference parsing lives here once and is never duplicated.
3. **Design token system** — resolving the palette discrepancies noted above.
4. **Scripture + Verse Inspector** — v0.1 calls this "the nucleus that every Study, Zedek, Work and Library workflow depends upon." It precedes any AI work.

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
