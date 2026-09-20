# AGENTS.md — SCRINODE

> **Project:** Scrinode  
> **Purpose:** AI-powered Bible search, study, research, and ministry workspace  
> **Primary Domain:** `scrinode.com`  
> **Repository:** `https://github.com/Ewaoche/scrinode.git`  
> **Document Role:** Operational guidance for AI coding agents, autonomous contributors, and human collaborators  
> **Authority:** **This document supersedes all others.** Where any document in `./docs` conflicts with AGENTS.md, AGENTS.md wins.  
> **Status:** MVP-first, future-ready  
> **Guiding Principle:** **Scripture first. Research around Scripture. AI in service of Scripture.**

---

# 0. Document Authority

**AGENTS.md is the single source of truth for Scrinode.**

The `./docs` directory holds **parts** — specifications, plans and references covering portions of the product. More will be added over time. They are supporting material, not competing authorities.

Rules:

- Where a document in `./docs` conflicts with AGENTS.md, **AGENTS.md is correct** and the doc is stale.
- After an architectural change, update AGENTS.md first. Do not attempt to synchronise every document in `./docs`.
- A `./docs` file may be superseded in part without being rewritten. Note it and move on.
- New specifications, plans and design documents go in `./docs`.
- README.md is kept aligned with AGENTS.md, as the entry point for collaborators.

If you are an agent reading only one document before making changes, read this one.

---

# 1. Mission

Scrinode is a mobile-first, AI-powered Bible platform for preachers, teachers, Bible scholars, ministry teams, students, and serious readers of Scripture.

The product must enable users to move naturally through:

```text
READ
  ↓
SELECT
  ↓
STUDY
  ↓
ASK ZEDEK
  ↓
VERIFY
  ↓
SAVE
  ↓
BUILD
  ↓
PREACH / TEACH / LEARN
```

Scrinode is not a generic chatbot with Bible data attached.

The Bible itself is the foundational interface.

All research, original-language tools, cross-references, historical context, AI assistance, workspaces, and saved knowledge must remain anchored to Scripture.

---

# 2. Agent Prime Directives

Every agent working on Scrinode must follow these priorities in order:

1. **Preserve biblical-text primacy.**
2. **Do not fabricate sources, lexical claims, cross-references, historical facts, or citations.**
3. **Prefer structured data over LLM memory.**
4. **Keep Scripture, interpretation, AI synthesis, and user-generated content visibly distinct.**
5. **Design mobile-first, but never mobile-only.**
6. **Keep the five primary product domains coherent: Scripture, Study, Zedek, Work, Library.** The admin backoffice (§51) is a separate internal application, not a sixth domain.
7. **Do not introduce unnecessary infrastructure complexity before product need exists.**
8. **Build abstractions that allow future growth without overengineering the MVP.**
9. **Treat source provenance and licensing as first-class data.**
10. **Optimize for clarity, reliability, speed, and maintainability over novelty.**
11. **Prefer composable domain primitives over generic abstractions.**
12. **Do not silently make theological conclusions where multiple major interpretations exist.**
13. **Maintain accessibility as a product requirement, not a post-launch task.**
14. **Protect user data, research history, workspaces, and account state.**
15. **Every major feature must have a clean path from MVP implementation to future expansion.**

---

# 3. Core Product Architecture

Scrinode has five primary domains:

```text
SCRIPTURE
STUDY
ZEDEK
WORK
LIBRARY
```

These are the canonical user-facing areas.

## 3.1 Scripture

The Bible reader and navigation core.

Responsibilities:

- Genesis-to-Revelation reading.
- Book/chapter/verse navigation.
- Search.
- Translation switching.
- Verse and passage selection.
- Copy / quote.
- Compare translations.
- Highlight / save.
- Scripture-aware actions.

## 3.2 Study

Structured research around Scripture.

Responsibilities:

- Context.
- Cross-references.
- Original languages.
- Morphology.
- Lemmas.
- Word studies.
- Themes.
- People.
- Places.
- Events.
- Literary structure.
- Historical and cultural context.
- Ancient-world data.
- Canonical relationships.

## 3.3 Zedek

Scrinode's Scripture-grounded AI research assistant.

Responsibilities:

- Explain.
- Compare.
- Research.
- Converse.
- Trace themes.
- Explore language.
- Help synthesize.
- Support sermon and study development.
- Cite Scripture and identifiable research sources.

Zedek is an assistant, not a spiritual authority.

## 3.4 Work

Ministry and study creation.

Initial workspace types:

- Sermon.
- Bible study.
- Teaching notes.
- Liturgy.
- Research project.

Future:

- Team workspaces.
- Shared ministry projects.
- Lesson plans.
- Devotionals.
- Courses.
- Presentation flows.

## 3.5 Library

Persistent user knowledge.

Includes:

- Saved passages.
- Highlights.
- Notes.
- Saved studies.
- Zedek conversations.
- Research cards.
- Collections.
- Workspaces.
- Future uploaded resources.

---

# 4. Navigation Contract

The navigation model is fixed unless the product owner explicitly changes it.

## Mobile

```text
Scripture | Study | Zedek | Work | Library
```

Use bottom navigation.

## Tablet / Desktop

Use top navigation with the same IA:

```text
Scrinode | Scripture | Study | Zedek | Work | Library | Profile
```

Profile and settings stay outside the five primary product domains.

Profile is top-right on all supported layouts.

Do not add:

- Settings
- Notifications
- Account
- Billing
- Security

to the bottom nav.

---

# 5. Responsive Design Contract

Scrinode is **mobile-first and desktop-capable**.

## Mobile

- One primary task at a time.
- Bottom navigation.
- Bottom sheets.
- Drawers.
- Compact action rows.
- Thumb-friendly controls.

## Tablet

- Two-pane layouts when context benefits from parallel display.
- Increased persistence of secondary panels.

## Desktop

Use available width productively.

Preferred research pattern:

```text
Bible Navigation | Scripture Text | Study / Zedek / Notes
```

Never merely stretch mobile cards across a desktop screen.

---

# 6. Visual Design Direction

Scrinode should feel:

- Scholarly.
- Calm.
- Reverent.
- Modern.
- Warm.
- Trustworthy.
- Focused.
- Highly readable.

Avoid:

- Loud gradients everywhere.
- Excessive neon.
- "Crypto-dashboard" aesthetics.
- Gamified spiritual language.
- Overly futuristic UI that harms reading.
- Dense enterprise-dashboard clutter.

## Light theme

```text
Background          #F8F7F3
Surface             #FFFFFF
Scripture surface   #FCFAF5
Primary text        #1C2430
Secondary text      #667085
Primary brand       #22304A
Secondary brand     #355070
Zedek accent        #C5A253
Study accent        #6F7D5A
Border              #E4E0D8
Selection           #F0E3B5
```

## Dark theme

```text
Background          #10151F
Surface             #171E2A
Scripture surface   #141A24
Elevated surface    #1E2735
Primary text        #F3F0E8
Secondary text      #B7BFCA
Border              #2C3645
Zedek accent        #D1B363
Study accent        #9BAE83
Reference accent    #91ADD1
Selection           #514528
```

## Semantic accents

```text
Scripture → Ink / Navy
Study     → Olive / Sage
Zedek     → Muted Gold
Work      → Slate Blue
Library   → Warm Stone
```

Use accents sparingly.

---

# 7. Technology Stack

Default stack:

```text
Frontend       Next.js + React + TypeScript
Backend        NestJS + TypeScript
Database       MongoDB Atlas
Vector Search  MongoDB Atlas Vector Search
Auth           Auth.js / NextAuth
State          Redux Toolkit + RTK Query
Styles         Tailwind CSS
Primitives     Radix UI
Themes         next-themes
AI             Provider abstraction layer
Streaming      SSE
Email          Resend
SMS            Termii
Cron           Vercel Cron
Deployment     Vercel
```

Do not replace a core technology without an explicit architectural reason.

---

# 8. Repository Structure

Prefer monorepo organization.

Scrinode has **three applications**.

```text
scrinode/
│
├── apps/
│   ├── web/              Next.js — public reader (scrinode.com)
│   ├── backoffice/       Next.js — internal admin (admin.scrinode.com)
│   └── api/              NestJS  — shared by both frontends
│       └── src/
│           └── admin/    admin-only module, globally guarded
│
├── packages/
│   ├── ui/
│   ├── admin-ui/
│   ├── scripture/
│   ├── types/
│   ├── validation/
│   ├── ai/
│   ├── config/
│   └── eslint-config/
│
├── data/
│   ├── imports/
│   ├── fixtures/
│   └── schemas/
│
├── tooling/
│
├── docs/
│
└── AGENTS.md
```

Recommended orchestration:

- Turborepo.
- Shared TypeScript configs.
- Shared lint config.
- Shared domain types.
- Shared validation.

## Package naming

Every workspace package is scoped **`@scrinode/*`**. No unscoped names, no ad-hoc prefixes.

```text
@scrinode/web              @scrinode/types         @scrinode/ui
@scrinode/backoffice       @scrinode/validation    @scrinode/admin-ui
@scrinode/api              @scrinode/scripture     @scrinode/ai
                           @scrinode/config        @scrinode/eslint-config
```

- The directory name matches the package name after the scope.
- Apps are scoped too, though private and never published.
- Every package sets `"private": true` unless publishing is a deliberate decision.
- Internal dependencies use `workspace:*`, never a version range.
- Import by package name (`@scrinode/scripture`), never a relative path across a package boundary.

## Package boundaries

Enforced by ESLint. A violating import fails `pnpm verify` and fails CI.

```text
@scrinode/web         ✗ @scrinode/admin-ui, @scrinode/backoffice
@scrinode/backoffice  ✗ @scrinode/web, @scrinode/scripture
@scrinode/api         ✗ frontend apps and their components
@scrinode/types       ✗ every runtime dependency
apps/api domain code  ✗ the mongodb driver — use a repository
everywhere but ai/    ✗ vendor AI SDKs — use AIProvider
everywhere            ✗ relative imports across packages
```

Add a package's rules to its `eslint.config`, using `boundaries()` from `@scrinode/eslint-config/boundaries`. When adding a rule, verify it fires: write a deliberate violation, confirm lint fails, then remove it. A rule that cannot fail is not protection.

- `packages/ui` holds genuinely shared primitives.
- Reader-facing domain components (`Verse`, `Passage`, `ScriptureSelection`) stay reader-facing.
- Admin types must not leak into public API response shapes.

See §51 for the backoffice domain rules.

---

# 9. Domain-First Coding Rules

Prefer domain components and services over generic utility sprawl.

Important primitives:

```text
BibleReference
Verse
Passage
ScriptureSelection
Translation
CrossReference
Lexeme
Morphology
Citation
ResearchSource
ResearchCard
ZedekMessage
WorkspaceBlock
SermonBlock
LibraryItem
```

Do not let core biblical concepts become loosely typed strings.

Bad:

```ts
const reference = "Romans 8:28";
```

Preferred:

```ts
type BibleReference = {
  bookId: "ROM";
  chapter: 8;
  verseStart: 28;
  verseEnd?: 30;
};
```

---

# 10. Canonical Scripture Model

Use stable internal reference IDs.

Examples:

```text
GEN.1.1
PSA.23.1
MAT.5.3
JHN.3.16
ROM.8.28
REV.22.21
```

Do not use translated reference labels as database identity.

Canonical concept:

```text
ROM.8.28
│
├── translation texts
├── Greek/Hebrew data
├── cross-references
├── themes
├── historical notes
├── user notes
├── highlights
└── conversations
```

Translation text is a representation of the verse, not the verse entity itself.

---

# 11. Scripture Context

Create and preserve a global Scripture Context.

```ts
interface ScriptureContext {
  reference: BibleReference;
  translation: TranslationCode;

  selection?: {
    startVerse: number;
    endVerse: number;
  };

  selectedText?: string;
  selectedTokens?: string[];

  comparisonTranslations?: TranslationCode[];
}
```

This context must survive navigation between:

```text
Scripture
Study
Zedek
Work
Library
```

Feature implementations should accept `ScriptureContext` when relevant rather than independently parsing URL strings.

---

# 12. Bible Reader Requirements

The Bible Reader is the primary product surface.

MVP requirements:

- Fast chapter loading.
- Clear book and chapter selector.
- Translation selector.
- Verse numbering.
- Word / verse / passage interaction.
- Selected verse state.
- Copy.
- Quote.
- Highlight.
- Save.
- Compare.
- Open Study.
- Ask Zedek.
- Accessible reading controls.
- Responsive typography.

Future-ready requirements:

- Offline reading.
- Reading plans.
- Audio synchronization.
- Interlinear mode.
- Multi-translation compare.
- User annotations.
- Collaborative study.

---

# 13. Verse Inspector

Verse Inspector is a first-class product primitive.

## Mobile

Render as bottom sheet or full-height sheet.

## Desktop

Render as side panel.

Minimum actions:

```text
Copy
Quote
Save
Highlight
Compare
Context
Cross References
Original Language
Word Study
History
Themes
Notes
Ask Zedek
```

Keep the user anchored to the current Scripture.

---

# 14. Search Architecture

Search is universal.

Single input should support:

```text
John 3:16
faith without works
agape
resurrection
Paul and justification
why did Jesus wash the disciples' feet?
```

Supported intent classes:

```text
reference_query
keyword_query
phrase_query
semantic_query
entity_query
original_language_query
theological_question
comparative_query
```

Search principle:

> **Retrieve Scripture first. Interpret second.**

Do not lead semantic queries with AI prose when direct Scripture results are available.

---

# 15. Study Architecture

Study should use structured data whenever possible.

Priority order:

```text
1. Canonical Scripture
2. Structured metadata
3. Original-language datasets
4. Cross-reference datasets
5. Historical / lexical sources
6. Semantic retrieval
7. AI synthesis
```

AI is the final synthesis layer, not the source of truth.

---

# 16. Zedek AI Architecture

Zedek must use orchestration, not a single prompt.

Preferred flow:

```text
User Request
    ↓
Intent Router
    ↓
Scripture Context
    ↓
Structured Retrieval
    ↓
Semantic Retrieval
    ↓
Relevant Tools
    ↓
Context Builder
    ↓
Prompt Assembly
    ↓
AI Provider
    ↓
Citation Validation
    ↓
Streaming Response
```

Potential internal tools:

```text
getPassage()
getContext()
searchBible()
getCrossReferences()
getGreekTokens()
getHebrewTokens()
searchLexicon()
searchResearchCorpus()
getWorkspaceContext()
getUserNotes()
```

---

# 17. AI Provider Abstraction

Never couple product logic directly to one LLM provider.

Interface:

```ts
export interface AIProvider {
  generate(input: GenerateInput): Promise<GenerateResult>;

  stream(
    input: GenerateInput
  ): AsyncIterable<AIStreamChunk>;

  embed(input: EmbedInput): Promise<EmbedResult>;
}
```

Adapters may include:

```text
OpenAIProvider
AnthropicProvider
GeminiProvider
LocalProvider
```

## Model roles

Prefer capabilities over model names.

```ts
type AIModelRole =
  | "reasoning"
  | "fast"
  | "embedding"
  | "long-context";
```

Routing example:

```text
reasoning    → strongest reasoning model
fast         → cheap low-latency model
embedding    → embedding model
long-context → large-context model
```

No business logic should depend on vendor-specific response formats.

---

# 18. Zedek Streaming

Use SSE initially.

Stream event types:

```ts
type ZedekStreamEvent =
  | { type: "status"; message: string }
  | { type: "content"; delta: string }
  | { type: "citation"; citation: Citation }
  | { type: "tool"; tool: string; state: "started" | "completed" }
  | { type: "error"; message: string }
  | { type: "complete"; messageId: string };
```

Safe statuses:

```text
Loading Scripture...
Searching cross-references...
Examining original language...
Searching sources...
Generating response...
```

Never expose private chain-of-thought.

Support cancellation.

---

# 19. RAG Strategy

Do not implement RAG as:

```text
question
→ vector search
→ chunks
→ model
```

Use hybrid retrieval.

```text
Question
  ↓
Reference Parser
  ↓
Structured Retrieval
  +
Vector Retrieval
  +
Metadata Filters
  +
Lexical Data
  +
Cross References
  ↓
Context Builder
  ↓
Model
```

---

# 20. Embedding Strategy

Do not embed isolated verses only.

Create multiple retrieval unit types:

```text
verse
passage
pericope
chapter
topic
entity
lexical entry
historical note
research article
```

Include metadata:

```ts
{
  type: "passage",
  bookId: "PHP",
  referenceStart: "PHP.4.10",
  referenceEnd: "PHP.4.20",
  testament: "NT",
  language: "en",
  sourceId: "...",
  embedding: [...]
}
```

Design for filtered vector search.

---

# 21. Source Provenance

Every imported source must include provenance.

Required shape:

```ts
{
  sourceId: string,
  sourceName: string,
  sourceType: string,
  license?: string,
  attribution?: string,
  sourceUrl?: string,
  importedAt: Date
}
```

Never ingest external biblical or scholarly data without recording licensing and origin.

---

# 22. Translation Integrity

Distinguish:

```text
Published Bible translation
vs.
AI-assisted language translation
```

AI-translated Scripture must be clearly labeled.

Never present AI-generated text as an official Bible version.

## 22.1 Translation licensing

`packages/scripture/src/translations.ts` is the translation registry. It is the
only authority on which translations Scrinode may serve. The sourced terms
behind every entry are in `docs/TRANSLATION_LICENSING.md`.

**`isAvailable()` is the gate.** Registry membership is not permission, and
neither is a permissive licence whose obligations are unimplemented. Never
serve, ingest or cache a translation's text without it.

**Scrinode is a commercial product.** Paid subscription plans, no advertising.
Every publisher treats a subscription as commercial use, so no non-commercial
grant may ever be served — this rules out the free ESV API, API.Bible's free
tier, the NET's gratis licence and Bible Brain. The premise is recorded as
`IS_COMMERCIAL_PRODUCT` and enforced by test.

Rules that are not negotiable:

- A translation absent from the registry fails closed. Never add an entry to
  make a code resolve.
- Never fill in a licence field that a publisher has not stated. `'not-stated'`
  is a real answer and must never be read as permission (§42).
- Required attribution is stored verbatim. Paraphrasing a required notice
  breaches the licence.
- **Fair-use verse limits do not authorise Scrinode.** They govern quoting
  within a work; serving passages on demand is redistribution and needs a
  licence regardless of per-page verse count.
- Zedek retrieves Scripture into model context (§20). Only texts with no
  copyright holder may be retrieved until a publisher grants AI use in writing.

---

# 23. Theological Integrity

Agents must not flatten contested theology into one asserted answer.

For disputed passages or doctrines:

- Present major interpretations.
- Attribute claims.
- Identify textual support.
- Distinguish text, inference, tradition, and application.

Preferred response structure:

```text
Textual observation
Historical / literary context
Major interpretations
Cross references
Source notes
```

Do not invent denominational consensus.

---

# 24. MongoDB Rules

Prefer multiple collections over giant nested documents.

Conceptual collections:

```text
verses
translation_texts
books
chapters
cross_references
lexemes
morphology
themes
entities
sources
research_chunks

users
notes
highlights
collections
conversations
messages
workspaces
workspace_blocks
notification_events
```

Avoid:

- Entire Bible in one document.
- Entire conversation in one ever-growing document.
- Entire workspace in one unbounded nested structure.

Use denormalization intentionally.

---

# 25. Conversation Storage

Recommended:

```text
conversations
messages
```

Conversation:

```ts
{
  _id,
  userId,
  title,
  scriptureContext,
  createdAt,
  updatedAt
}
```

Message:

```ts
{
  _id,
  conversationId,
  role,
  content,
  citations,
  sources,
  modelMetadata,
  createdAt
}
```

Persist completed assistant messages, not every token.

---

# 26. State Management

Redux Toolkit is for application interaction state.

RTK Query is for remote server state.

Suggested slices:

```text
scriptureSlice
studySlice
zedekSlice
workspaceSlice
preferencesSlice
```

Do not store large Bible corpora in Redux.

---

# 27. Auth Architecture

Scrinode has **two separate identity systems**. They are distinct security domains, not one system with a privilege flag.

```text
Reader identity   apps/web        Auth.js / NextAuth
Admin identity    apps/backoffice separate system, separate collections
```

## 27.1 Reader identity

Use Auth.js / NextAuth.

Initial providers may include:

- Email.
- Google.
- Apple.

Optimized for frictionless sign-up.

Future-ready schema should allow:

```text
User
Organization
Membership
Role
Permission
```

Do not build enterprise organization features in MVP unless required.

## 27.2 Admin identity

Internal staff only. Never the same collection as `users`.

```text
admin_users
admin_sessions
admin_roles
admin_audit_log
```

Requirements:

- Separate session cookie, separate domain.
- Short session expiry.
- MFA required.
- Re-authentication for destructive operations.
- First `superadmin` seeded out-of-band by script. **Never a bootstrap endpoint in the running application.**

## 27.3 Non-negotiable separation

- A reader session token must never authorize an admin route.
- An admin session token must never authorize a reader route.
- A compromised reader account must not be able to escalate to admin.
- No privilege fields on the reader `User` schema.
- **Neither app may set a cookie scoped to a parent domain.** The reader is `scrinode.com` and the backoffice is `admin.scrinode.com`; a cookie with `Domain=.scrinode.com` would be sent to both and hand the backoffice a reader session. Session cookies stay host-only, `HttpOnly`, and never `SameSite=None`.

Both directions must be covered by tests.

## 27.4 RBAC

Check **permissions**, never roles. A role is a named bundle of permissions, so new roles can be added without touching guard logic.

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

Initial roles:

```text
superadmin         full access, including admin management and destructive operations
data-admin         source imports, ingestion, licence registry, reindexing
content-moderator  review and publish datasets
support            read-only user lookups; no data mutation
observer           read-only dashboards and metrics
```

---

# 28. Notification Architecture

Use provider abstraction.

```text
NotificationService
├── EmailProvider → Resend
└── SMSProvider   → Termii
```

Domain methods should be vendor-agnostic:

```text
sendVerificationCode()
sendPasswordReset()
sendSecurityAlert()
sendWorkspaceInvite()
sendStudyReminder()
```

Persist delivery metadata for audit and retry.

---

# 29. Background Jobs

Vercel is suitable for interactive workloads.

Heavy work must remain separable.

Examples:

```text
Bible ingestion
embedding generation
vector reindexing
large document processing
bulk imports
source normalization
```

Preferred future model:

```text
Vercel Cron
   ↓
Job Trigger
   ↓
Queue
   ↓
Worker
```

Potential queue:

```text
BullMQ + Redis
```

Do not force heavy batch work into interactive HTTP requests.

---

# 30. Deployment Strategy

## MVP

```text
Next.js  → Vercel
NestJS   → Vercel
MongoDB  → Atlas
Email    → Resend
SMS      → Termii
```

## Scale Path

If needed:

```text
Next.js → Vercel
NestJS  → Cloud Run / ECS / Railway / Fly.io / Render
Workers → dedicated worker runtime
MongoDB → Atlas
```

Keep NestJS cloud-portable.

Avoid unnecessary Vercel-specific coupling in domain code.

---

# 31. Performance Targets

MVP targets:

```text
Initial app shell                 < 2s on healthy mobile connection
Chapter navigation               near-instant from cache
Verse interaction                < 100ms local UI response
Search first meaningful result   < 1.5s target
Zedek first stream chunk         < 2s target when retrieval allows
Common API response              < 500ms excluding external AI calls
```

Use caching carefully.

Do not cache user-sensitive data globally.

---

# 32. Accessibility

Target WCAG 2.2 AA.

Required:

- Keyboard navigation.
- Focus-visible states.
- Semantic HTML.
- Screen-reader labels.
- Accessible modals.
- Accessible bottom sheets.
- Touch targets.
- Text scaling.
- Reduced motion.
- Non-color state indicators.
- Contrast-safe dark mode.

---

# 33. Security

Minimum requirements:

- Secure auth cookies.
- CSRF protection where relevant.
- Input validation.
- Rate limiting.
- Resource ownership checks.
- API authorization.
- XSS protection.
- Rich-text sanitization.
- Secrets outside source control.
- Prompt-injection safeguards.
- Source-trust boundaries.
- Audit logging for sensitive changes.
- Provider key rotation capability.

## Implemented baseline

Verified by tests in `apps/e2e/tests/security.spec.ts`; changing any of it fails CI.

```text
API           helmet, explicit CORS allow-list (wildcard rejected by schema),
              rate limiting (10/s, 120/min) with health exempt, 1 MB body cap,
              no x-powered-by
Reader        nonce-based CSP via middleware (no unsafe-inline for scripts),
              DENY framing, nosniff, strict-origin-when-cross-origin, HSTS,
              Permissions-Policy
Backoffice    stricter CSP, noindex, DENY framing, no-referrer, HSTS
```

Rules:

- **Never widen a CSP to `'unsafe-inline'` for scripts.** Use a nonce. The reader renders Scripture, user notes and AI output, none of which may execute.
- **Never set a wildcard CORS origin.** The API serves credentialed requests; the schema rejects `*` and any origin carrying a path.
- Health endpoints stay exempt from rate limiting: a throttled probe reads as an outage.
- Keep `pnpm audit --prod` clean. Dev-only advisories are acceptable; a vulnerable runtime dependency is not.

## Admin security

The backoffice has write access to everything. It gets the strictest treatment in the product.

- Every mutating admin action writes an audit entry: actor, action, target, before/after, timestamp, IP.
- The audit log is **append-only**. No role, including `superadmin`, may delete from it.
- Audit logging ships **before** any admin feature that mutates data. Never leave a window where admin actions are unattributable.
- Destructive operations require `superadmin` **and** explicit typed confirmation.
- Bulk operations support dry-run mode and batched, rate-limited writes.
- Heavy admin jobs go to the queue, never an interactive HTTP request (§29).
- Admin routes are namespaced under `/admin/*` with a **global module guard** — not per-route decorators, which are easy to forget.
- Admin routes carry their own rate limits.

---

# 34. Observability

Implement early.

Track:

```text
frontend errors
backend errors
request IDs
API latency
search latency
vector query latency
AI provider latency
token usage
AI cost
provider failures
notification delivery
job failures
```

Recommended:

```text
Sentry
structured NestJS logs
AI request metadata
```

---

# 35. MVP Scope

Build these before broad expansion.

## Scripture

- Genesis-to-Revelation reader.
- Book/chapter/verse navigation.
- Translation switching.
- Search.
- Select.
- Copy.
- Quote.
- Save.
- Highlight.
- Compare.

## Study

- Passage context.
- Cross-references.
- Basic original-language explorer.
- Basic themes.
- Historical notes from trusted data.

## Zedek

- Quick actions.
- Chat.
- Scripture context.
- Structured retrieval.
- RAG.
- Citations.
- Streaming.
- Conversation persistence.

## Work

- Sermon workspace.
- Bible study workspace.
- Block editing.
- Add research to workspace.

## Library

- Saved passages.
- Highlights.
- Notes.
- Studies.
- Conversations.
- Workspaces.

## Account

- Auth.
- Profile.
- Preferences.
- Theme.
- Notification settings.
- Security basics.

---

# 36. Explicit MVP Non-Goals

Do not delay MVP for:

- Advanced church-team collaboration.
- Native iOS / Android apps.
- Large-scale commentary marketplace.
- Advanced manuscript criticism.
- Full seminary LMS.
- Presentation software.
- Complex biblical maps.
- Audio synchronization.
- Offline-first architecture.
- Multi-tenant enterprise admin (customer-facing organization administration — see note below).
- Real-time collaborative editing.
- Social feed.
- AI autonomous sermon publishing.

Prepare architecture for these only where cheap and sensible.

## Note on "multi-tenant enterprise admin"

This non-goal refers to **customer-facing** organization administration — churches and seminaries managing their own members, shared libraries and permissions.

It does **not** refer to the internal admin backoffice (§51), which is operational tooling for Scrinode staff. These are unrelated. The non-goal stands.

---

# 37. Future Expansion Blueprint

## Phase 1 — MVP Foundation

```text
Bible Reader
Study Core
Zedek AI
Workspaces
Library
Auth
Responsive Shell
```

## Phase 2 — Research Depth

```text
Advanced Greek / Hebrew
Theme Graph
People / Places / Events
Canonical tracing
Historical datasets
Richer compare mode
Better semantic search
```

## Phase 3 — Ministry Productivity

```text
Sermon planning
Liturgy planning
Teaching templates
Study plans
Presentation export
Calendar integration
Team sharing
```

## Phase 4 — Collaborative Ministry

```text
Organizations
Church teams
Seminary groups
Shared libraries
Collaborative workspaces
Permissions
Comments
Version history
```

## Phase 5 — Knowledge Graph

```text
Person ↔ Verse
Place ↔ Event
Theme ↔ Passage
Quotation ↔ Source
Word ↔ Lemma
Book ↔ Author
Covenant ↔ Passage
Prophecy ↔ Fulfillment
```

## Phase 6 — Multimodal Scripture Platform

Potential:

```text
Audio Bible
Video Bible
Maps
Timelines
Genealogies
Manuscripts
OCR imports
Voice study
AI narration
```

## Phase 7 — Developer Platform

Potential:

```text
Scrinode API
Scripture Graph API
Plugin system
Public embeddings API
Research SDK
Church integrations
Seminary integrations
```

---

# 38. Data Growth Strategy

Design ingestion pipelines so sources can be added without schema rewrites.

Preferred pattern:

```text
Raw Source
   ↓
Normalization
   ↓
Validation
   ↓
Provenance
   ↓
Canonical Mapping
   ↓
Search Index
   ↓
Vector Index
```

Never let imported data bypass validation.

---

# 39. Knowledge Graph Readiness

Do not require a graph database in MVP.

Represent relations in MongoDB first.

Examples:

```ts
{
  subjectId: "PAUL",
  relation: "APPEARS_IN",
  objectId: "ACT.9.1"
}
```

or:

```ts
{
  sourceReference: "MAT.4.4",
  relation: "QUOTES",
  targetReference: "DEU.8.3"
}
```

Move to specialized graph infrastructure only when graph-query complexity justifies it.

---

# 40. API Design Principles

APIs should be:

- Typed.
- Versionable.
- Domain-oriented.
- Stable.
- Validation-first.
- Pagination-aware.
- Cursor-based where appropriate.

Examples:

```text
GET /scripture/:translation/:book/:chapter
GET /scripture/reference/:reference
GET /study/context/:reference
GET /study/cross-references/:reference
GET /study/original-language/:reference
POST /search
POST /zedek/conversations
POST /zedek/conversations/:id/messages
GET /library
POST /workspaces
```

Avoid highly generic endpoints like:

```text
POST /do-ai
POST /data
```

---

# 41. Testing Strategy

Minimum layers:

## Unit

- Reference parsing.
- Citation formatting.
- Scripture context.
- Search routing.
- AI provider adapters.
- Validation.
- permissions.

## Integration

- MongoDB repositories.
- Vector search.
- Auth.
- Zedek orchestration.
- Notifications.

## E2E

Critical flows:

```text
Open Bible
Navigate to passage
Select verse
Open Study
Ask Zedek
Save note
Create sermon
Add passage
Return to Library
```

Use realistic biblical fixtures.

---

# 42. Agent Working Style

Agents should:

- Inspect existing code before changing architecture.
- Reuse domain primitives.
- Preserve naming consistency.
- Avoid speculative migrations.
- Prefer incremental implementation.
- Add tests for domain logic.
- Document major decisions.
- Explain breaking changes.
- Keep generated code production-oriented.

Agents should not:

- Introduce a new framework without need.
- Replace the chosen stack casually.
- Duplicate reference parsing.
- Hard-code vendor SDK calls into business logic.
- Store secrets in code.
- fabricate Bible data.
- invent licensing terms.
- turn Zedek into an ungrounded chatbot.
- redesign primary IA without explicit approval.

---

# 43. Agent Change Protocol

Before a major change:

1. Identify impacted domain.
2. Identify current contracts.
3. Check data migration implications.
4. Check mobile and desktop UX.
5. Check source provenance.
6. Check Zedek implications.
7. Check backwards compatibility.
8. Add or update tests.
9. Update docs.
10. Keep scope aligned with MVP unless expansion is explicitly requested.

---

# 44. Feature Completion Checklist

A feature is not complete until relevant items pass:

```text
[ ] Functional on mobile
[ ] Functional on desktop
[ ] Accessible
[ ] Typed
[ ] Validated
[ ] Error states covered
[ ] Loading states covered
[ ] Empty states covered
[ ] Source provenance preserved
[ ] User ownership enforced
[ ] Analytics/observability considered
[ ] Tests added
[ ] No LLM vendor lock-in introduced
[ ] No Bible data fabricated
[ ] Documentation updated
```

---

# 45. Product Language

Preferred terminology:

```text
Scripture
Study
Zedek
Work
Library
Passage
Verse
Reference
Original Language
Cross References
Context
Research
Workspace
Source
Citation
```

Avoid confusing overlapping labels.

Use **Backoffice** for the internal admin application. Not "admin panel", "dashboard", or "CMS".

Use **Zedek AI** formally and **Zedek** conversationally.

Examples:

```text
Ask Zedek
Study with Zedek
Continue in Zedek
Explain with Zedek
```

---

# 46. Product North Star

Scrinode should eventually become:

> **A Scripture-native operating system for Bible study, theological research, preaching, teaching, and ministry preparation.**

This does not mean adding every possible feature.

It means building a coherent biblical knowledge environment where:

```text
Scripture
Research
AI
User Knowledge
Ministry Work
```

remain connected through one shared reference system.

---

# 47. Long-Term Architectural Vision

Future architecture may evolve toward:

```text
                    SCRINODE PLATFORM

                           │
                    Application Shell
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    Scripture           Research          Workspaces
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    Scripture Context
                           │
              ┌────────────┼────────────┐
              │            │            │
         Structured     Knowledge      Vector
           Data           Graph        Search
              │            │            │
              └────────────┼────────────┘
                           │
                        Zedek
                           │
                  Provider Abstraction
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          Reasoning       Fast       Embeddings
                           │
                      Tool Layer
                           │
                 External Integrations
```

The architecture should grow toward this model gradually.

Do not implement the full future system during MVP.

---

# 48. The Final Rule

When there is uncertainty about a technical or product decision, ask:

> **Does this make it easier for the user to understand, study, verify, save, and work with Scripture?**

If not, it is probably not core to Scrinode.

---

# 49. Definition of Success

Scrinode succeeds when a user can:

```text
Open Scripture
→ understand what they are reading
→ inspect its context
→ examine its language
→ discover related Scripture
→ ask intelligent questions
→ verify the answer
→ save what matters
→ turn research into ministry work
```

without feeling that the Bible has become secondary to the software.

---

# 50. Closing Principle

> **Build Scrinode as a Bible platform first, an AI product second, and an extensible ministry operating system third.**

---

# 51. Admin Backoffice

`apps/backoffice` is Scrinode's **internal** operations application. Staff only.

Deployed as a separate Vercel project at `admin.scrinode.com`.

## 51.1 Purpose

The backoffice exists because the specification already requires capabilities that have no interface:

```text
Source & licence registry          §21 — provenance on every import
Ingestion pipeline operation       §38 — normalize → validate → provenance → index
Background job triggering          §29 — ingestion, embeddings, reindexing
Content moderation & curation      cross-references, themes, historical notes
User administration                support lookups, account state
Zedek operations                   model roles, prompts, cost, flagged answers
Feature flags                      production readiness baseline
Observability dashboards           §34 — AI cost, token usage, provider failures
```

## 51.2 Boundaries

- The backoffice is **not a sixth product domain**. The user-facing IA remains Scripture / Study / Zedek / Work / Library (§3, §4) and is unchanged.
- The backoffice never appears in product navigation.
- Admin code never ships in the public bundle.
- The backoffice is internal tooling, not a customer-facing feature.

## 51.3 Shared API, isolated module

Both frontends use the same `apps/api`. One data-access layer, one set of domain services, one source of truth for validation.

Isolation within that shared API is **mandatory** — see §27.3 and §33.

## 51.4 Ingestion safety

Imported data must never be written directly to live canonical collections.

```text
Import → staging collection → validate → review → publish
```

This enforces §38: never let imported data bypass validation.

Publication must be atomic and reversible.

## 51.5 What must never be built into the backoffice

- A bootstrap endpoint that creates the first admin.
- Any path that grants a reader account admin privileges.
- Deletion of audit log entries.
- Unbatched bulk writes against production collections.
- Destructive operations without `superadmin` and typed confirmation.
- Direct writes to canonical Scripture collections that bypass the staging pipeline.

## 51.6 Implementation staging

See `docs/PLAN_backoffice_architecture.md` for the full staged plan.

Sequence is deliberate: **identity → audit log → shell → features**. Audit logging precedes every mutating feature so no admin action is ever unattributable.

