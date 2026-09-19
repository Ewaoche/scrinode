# SCRINODE Design Specification

**Product:** Scrinode  
**Document Type:** Product + Technical Design Specification  
**Status:** Draft v1.0  
**Platform:** Mobile-first responsive web application  
**Domain:** `scrinode.com`

> **Authority:** AGENTS.md supersedes this document. Where the two conflict, follow AGENTS.md.
>
> **Superseded sections:** §14 (Repository Architecture) and §32 (Security) predate the admin backoffice. Scrinode now has three applications, and two separate identity systems. See AGENTS.md §8, §27, §33 and §51, and `docs/PLAN_backoffice_architecture.md`.

---

## 1. Product Overview

Scrinode is an AI-powered Bible search, reference, study, and ministry-preparation platform for preachers, teachers, Bible scholars, students, and serious readers of Scripture.

The application is fundamentally **Bible-first**. The Bible itself is the primary interface and permanent foundation of the product. Research tools, contextual analysis, original-language resources, cross-references, historical background, theological study, AI assistance, and ministry-preparation workflows are assembled around Scripture rather than existing as disconnected tools.

Scrinode should feel like a modern biblical research environment rather than a generic AI chatbot with Bible data attached.

### Core principle

> **Scripture first. Research around Scripture. AI in service of Scripture.**

---

## 2. Product Goals

Scrinode should enable users to:

- Read the Bible from Genesis through Revelation.
- Navigate by book, chapter, verse, and passage.
- Search Scripture by reference, keyword, topic, phrase, person, place, theme, or question.
- Select words, verses, and passages for further action.
- Quote, copy, save, compare, and share Scripture.
- Switch between available Bible translations.
- Translate or explain biblical text into another language using AI, while clearly distinguishing AI-assisted translation from published Bible translations.
- Study immediate and broader biblical context.
- Explore cross-references.
- Examine Greek, Hebrew, and Aramaic text.
- View morphology, lemmas, lexical definitions, and original-language word relationships.
- Explore historical, cultural, literary, and ancient-world context.
- Trace biblical themes across Scripture.
- Ask contextual questions using Zedek AI.
- Create sermons, Bible studies, liturgies, teaching notes, and research projects.
- Save notes, highlights, passages, research, conversations, and collections.
- Move seamlessly between Scripture, Study, Zedek, Workspaces, and Library.

---

## 3. Product Philosophy

Scrinode follows five foundational rules:

1. **Scripture is the primary interface.**
2. **Every verse and passage is an interactive research object.**
3. **Study capabilities assemble around the active Scripture context.**
4. **AI is contextual and pervasive, but never replaces Scripture or source data.**
5. **Research should flow naturally into ministry and study work.**

---

## 4. Primary Information Architecture

Scrinode has five primary product domains.

### 4.1 Scripture

Purpose: Bible reading and navigation.

Core functionality:

- Bible reader.
- Genesis-to-Revelation navigation.
- Book and chapter navigation.
- Verse navigation.
- Bible search.
- Translation switching.
- Passage selection.
- Word and phrase selection.
- Copy and quote.
- Compare translations.
- Save and highlight.
- Share references.
- Open research actions around a selected verse or passage.

---

### 4.2 Study

Purpose: Structured biblical research independent of generative AI.

Core functionality:

- Passage context.
- Immediate context.
- Book context.
- Canonical context.
- Cross-references.
- Greek/Hebrew/Aramaic text.
- Lexical analysis.
- Lemma exploration.
- Morphology.
- Word occurrence analysis.
- Literary structure.
- Themes.
- People.
- Places.
- Events.
- Historical context.
- Cultural background.
- Ancient-world facts.
- Quotations and allusions.
- Related passages.

Study should prioritize deterministic datasets and traceable sources.

---

### 4.3 Zedek AI

**Formal name:** Zedek AI  
**Conversational name:** Zedek

Zedek is Scrinode's Scripture-grounded AI research assistant.

Zedek should help users:

- Explain passages.
- Explain context.
- Explore original languages.
- Compare passages.
- Compare interpretations.
- Trace themes.
- Research historical background.
- Discover related Scripture.
- Ask follow-up theological questions.
- Generate research summaries.
- Assist with sermon and teaching preparation.
- Continue conversations within the current Scripture context.

Zedek must not act as a spiritual authority or oracle.

### Zedek behavioral contract

Zedek should:

- Begin with Scripture and its context.
- Clearly distinguish biblical text from interpretation.
- Cite relevant biblical passages.
- Cite identifiable research sources where appropriate.
- Present major interpretive disagreements fairly.
- Avoid invented historical, linguistic, or theological claims.
- Use structured original-language data rather than model memory when available.
- Retain the user's active Scripture context.
- Preserve source provenance.
- Support the user's own judgment rather than replacing it.

---

### 4.4 Workspaces

Purpose: Turn biblical research into ministry and study output.

Initial workspace types:

- Sermon.
- Bible study.
- Teaching notes.
- Liturgy.
- Research project.

Typical sermon workspace structure:

```text
Title
Primary Text
Theme
Central Proposition

Introduction

Exegesis

Point One
  Scripture
  Notes
  Illustration
  Application

Point Two

Point Three

Conclusion

Prayer
```

Research objects from Scripture, Study, and Zedek should be savable directly into a workspace.

---

### 4.5 Library

Purpose: Persistent user knowledge and saved material.

Library content may include:

- Saved passages.
- Highlights.
- Notes.
- Collections.
- Saved studies.
- Saved Zedek conversations.
- Research cards.
- Sermons.
- Teaching notes.
- Liturgies.
- Uploaded resources in future releases.

---

## 5. Global Navigation

### 5.1 Mobile

Scrinode is mobile-first.

The bottom navigation contains exactly five primary destinations:

```text
Scripture | Study | Zedek | Work | Library
```

The mobile navigation should remain persistent where appropriate.

Profile, notifications, settings, security, account, billing, preferences, and related controls do **not** appear in the bottom navigation.

---

### 5.2 Tablet and Desktop

On larger screens, the five primary destinations move to the top navigation:

```text
Scrinode | Scripture | Study | Zedek | Work | Library | Profile
```

The information architecture does not change between mobile and desktop.

Only the spatial composition changes.

### Responsive principle

> **Same product. Same IA. Different spatial composition.**

Suggested layout behavior:

- `< 768px`: mobile, one primary pane.
- `768px–1199px`: tablet, optional two-pane layouts.
- `>= 1200px`: desktop, top navigation and multi-pane layouts.

The exact component behavior should be driven by available width rather than rigid device assumptions.

---

## 6. Profile and Settings

Profile remains in the top-right corner across viewports.

Profile menu may include:

- Profile.
- Account.
- Preferences.
- Notifications.
- Security.
- Appearance.
- Bible preferences.
- Zedek preferences.
- Subscription and billing.
- Help and support.
- Sign out.

### Bible preferences

Potential settings:

- Default Bible translation.
- Preferred comparison translations.
- Scripture font size.
- Reading density.
- Verse number visibility.
- Red-letter preference.
- Original-language visibility.
- Reading theme.

### Zedek preferences

Potential settings:

- Preferred answer depth.
- Preferred theological context.
- Citation verbosity.
- Original-language detail level.
- Whether to surface multiple interpretive traditions by default.

---

## 7. Scripture Reader

The Scripture Reader is the primary application experience.

### 7.1 Default behavior

On first entry, Scrinode should open directly into Scripture rather than an AI dashboard.

The reader should provide:

- Current book.
- Current chapter.
- Current translation.
- Search access.
- Reading content.
- Profile access.
- Persistent app navigation.

### 7.2 Scripture interaction scopes

Users should be able to select:

#### Word

Available actions may include:

- Define.
- Greek/Hebrew.
- Lemma.
- Morphology.
- Occurrences.
- Word study.
- Ask Zedek.

#### Phrase

Available actions may include:

- Copy.
- Quote.
- Translate.
- Explain.
- Compare.
- Ask Zedek.

#### Verse

Available actions may include:

- Copy.
- Quote.
- Save.
- Highlight.
- Compare.
- Context.
- Cross-references.
- Original language.
- History.
- Themes.
- Notes.
- Ask Zedek.

#### Passage

Available actions may include:

- Explain passage.
- Literary structure.
- Summarize.
- Themes.
- Cross-references.
- Compare.
- Create study.
- Add to workspace.
- Ask Zedek.

---

## 8. Verse Inspector

The Verse Inspector is a core reusable UI pattern.

### Mobile

Display as a bottom sheet or full-height sheet depending on complexity.

### Desktop

Display as a side panel or secondary research pane.

### Core actions

- Copy.
- Quote.
- Compare.
- Save.
- Highlight.
- Context.
- Cross-references.
- Original language.
- Word study.
- History.
- Themes.
- Notes.
- Ask Zedek.

The inspector should keep the user anchored to the biblical text.

---

## 9. Shared Scripture Context

The entire application should share a persistent active Scripture context.

Example:

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

This context should persist across:

- Scripture.
- Study.
- Zedek.
- Workspaces.
- Library.

Example flow:

```text
Romans 8:28 selected in Scripture
        ↓
Study opens scoped to Romans 8:28
        ↓
Zedek already knows Romans 8:28 is active
        ↓
Research can be added to a sermon workspace
        ↓
Saved material remains available in Library
```

---

## 10. Biblical Reference Model

Scrinode should use stable canonical identifiers internally.

Examples:

```text
GEN.1.1
PSA.23.1
MAT.5.3
JHN.3.16
ROM.8.28
REV.22.21
```

Human-readable strings such as `"Romans 8:28"` should remain presentation-level values.

### Principle

The canonical verse is the biblical reference entity, not a specific translation.

Example:

```text
ROM.8.28
│
├── WEB
├── KJV
├── Greek
├── Cross References
├── Themes
├── Historical Notes
├── User Notes
├── Highlights
└── Zedek Conversations
```

---

## 11. Search

Scrinode should provide a universal search interface.

Example placeholder:

```text
Search Scripture, topic, person, word, or ask a question...
```

The user should not need separate search boxes for reference search, semantic search, AI search, or lexical search.

### Supported query types

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

Examples:

```text
John 3:16
```

Navigate directly.

```text
faith without works
```

Return Scripture matches.

```text
agape
```

Return lexical/original-language results.

```text
verses about resurrection
```

Perform semantic Scripture search.

```text
why did Jesus wash the disciples' feet?
```

Retrieve relevant Scripture and allow Zedek synthesis.

### Search principle

> **Retrieve Scripture first. Interpret second.**

---

## 12. Translation System

Scrinode should distinguish between published Bible translations and AI-assisted translation.

### Published translation switching

Examples may include supported/licensed versions such as:

- WEB.
- KJV.
- ASV.
- Other licensed translations.

### AI-assisted language translation

If a user asks for Scripture to be rendered into a language without a licensed Bible text, Scrinode may provide an AI-assisted translation.

The interface must clearly identify it as:

> **AI-assisted translation from [source translation]**

AI-generated translation must never be presented as if it were an official Bible version.

---

## 13. Technology Stack

### Frontend

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Radix UI.
- next-themes.
- Redux Toolkit.
- RTK Query.

### Backend

- NestJS.
- TypeScript.

### Database

- MongoDB Atlas.

### Semantic Search / RAG

- MongoDB Atlas Vector Search.
- MongoDB embeddings / vector indexes.

### Authentication

- Auth.js / NextAuth.

### AI

- Provider abstraction layer.
- Multiple provider adapters.
- Structured retrieval.
- Semantic retrieval.
- Tool-based Zedek orchestration.

### Streaming

- Server-Sent Events (SSE).

### Email

- Resend.

### SMS

- Termii.

### Scheduling

- Vercel Cron.

### Deployment

- Vercel Cloud for the web application and interactive API workloads.
- Background workers may move to dedicated infrastructure when workload requires it.

---

## 14. Repository Architecture

> **Superseded.** Scrinode now has three applications: `apps/web`, `apps/backoffice` and `apps/api`. See AGENTS.md §8.

Recommended monorepo:

```text
scrinode/
│
├── apps/
│   ├── web/
│   │   └── Next.js
│   │
│   └── api/
│       └── NestJS
│
├── packages/
│   ├── ui/
│   ├── scripture/
│   ├── types/
│   ├── validation/
│   ├── ai/
│   ├── config/
│   └── eslint-config/
│
├── data/
│   ├── imports/
│   └── schemas/
│
└── tooling/
```

Turborepo is recommended.

---

## 15. Frontend State Architecture

Redux should hold interactive application state rather than entire Bible datasets.

Potential slices:

```text
scriptureSlice
studySlice
zedekSlice
workspaceSlice
preferencesSlice
```

RTK Query should handle remote server state and caching.

### Scripture state example

```ts
interface ScriptureState {
  activeReference: string;
  selectedRange?: {
    start: number;
    end: number;
  };
  translation: string;
  compareTranslation?: string;
  readerMode: "standard" | "focus" | "compare";
}
```

---

## 16. MongoDB Data Architecture

Avoid storing an entire Bible translation as one deeply nested MongoDB document.

Recommended conceptual structure:

### Canonical verse

```ts
{
  _id: "ROM.8.28",
  bookId: "ROM",
  chapter: 8,
  verse: 28,
  testament: "NT"
}
```

### Translation text

```ts
{
  referenceId: "ROM.8.28",
  translationId: "WEB",
  text: "..."
}
```

### User note

```ts
{
  userId: "...",
  referenceId: "ROM.8.28",
  content: "...",
  createdAt: Date,
  updatedAt: Date
}
```

Denormalization may be used deliberately for read performance.

---

## 17. Retrieval-Augmented Generation

Zedek should not use simplistic:

```text
Question
→ vector search
→ append chunks
→ LLM
```

Instead, use hybrid retrieval:

```text
User Question
      ↓
Intent Router
      ↓
Structured Scripture Retrieval
      +
Semantic Vector Retrieval
      +
Original Language Data
      +
Cross References
      +
Historical Sources
      ↓
Context Builder
      ↓
AI Model
      ↓
Citation / Source Validation
      ↓
Zedek Response
```

---

## 18. Embedding Strategy

Avoid embedding only isolated verses.

Create multiple retrieval units:

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

Example:

```ts
{
  type: "passage",
  referenceStart: "PHP.4.10",
  referenceEnd: "PHP.4.20",
  text: "...",
  embedding: [...]
}
```

This reduces proof-texting and allows semantic retrieval to retain context.

---

## 19. AI Provider Abstraction

Scrinode should not directly couple product logic to a single AI vendor.

### Provider contract

```ts
export interface AIProvider {
  generate(input: GenerateInput): Promise<GenerateResult>;

  stream(
    input: GenerateInput
  ): AsyncIterable<AIStreamChunk>;

  embed(input: EmbedInput): Promise<EmbedResult>;
}
```

Potential adapters:

```text
OpenAIProvider
AnthropicProvider
GeminiProvider
LocalProvider
```

### Provider routing

The product should request capabilities rather than hard-coded model names.

Example roles:

```ts
type AIModelRole =
  | "reasoning"
  | "fast"
  | "embedding"
  | "long-context";
```

Example configuration:

```ts
{
  reasoning: {
    provider: "openai",
    model: "..."
  },
  fast: {
    provider: "anthropic",
    model: "..."
  },
  embedding: {
    provider: "openai",
    model: "..."
  }
}
```

---

## 20. Zedek AI Architecture

Recommended orchestration:

```text
ZedekService
     │
     ├── IntentService
     ├── RetrievalService
     ├── ScriptureContextService
     ├── PromptService
     └── AIService
              │
              └── ProviderRouter
                    ├── OpenAIProvider
                    ├── AnthropicProvider
                    └── GeminiProvider
```

Potential internal research tools:

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
```

---

## 21. Streaming Architecture

Zedek should stream responses using Server-Sent Events.

### Basic flow

```text
Browser
  │
  ├── submit message
  ↓
NestJS
  │
  ├── retrieve Scripture
  ├── retrieve sources
  ├── call AI provider
  ↓
SSE stream
  │
  ├── status
  ├── content
  ├── citations
  └── complete
  ↓
React Client
```

### Stream event types

```ts
type ZedekStreamEvent =
  | {
      type: "status";
      message: string;
    }
  | {
      type: "content";
      delta: string;
    }
  | {
      type: "citation";
      citation: Citation;
    }
  | {
      type: "tool";
      tool: string;
      state: "started" | "completed";
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "complete";
      messageId: string;
    };
```

Safe operational statuses may include:

```text
Loading Scripture...
Searching cross-references...
Examining Greek text...
Searching research sources...
Generating response...
```

Do not expose model chain-of-thought.

---

## 22. AI Cancellation

Users should be able to stop generation.

Browser cancellation should propagate where possible:

```text
Browser AbortController
        ↓
NestJS request cancellation
        ↓
AI provider cancellation
```

This improves UX and reduces unnecessary token usage.

---

## 23. Conversation Persistence

Do not save every generated token to MongoDB.

Recommended lifecycle:

```text
User message
→ persist immediately

Assistant generation
→ stream in memory

Generation complete
→ persist final response
```

Recommended separation:

### Conversation

```ts
{
  _id: "...",
  userId: "...",
  title: "...",
  scriptureContext: {...},
  createdAt: Date,
  updatedAt: Date
}
```

### Message

```ts
{
  _id: "...",
  conversationId: "...",
  role: "user" | "assistant",
  content: "...",
  citations: [...],
  sources: [...],
  modelMetadata: {...},
  createdAt: Date
}
```

---

## 24. Notifications Architecture

Use a provider abstraction.

```text
NotificationService
      │
      ├── EmailProvider
      │      └── Resend
      │
      └── SMSProvider
             └── Termii
```

### Email provider contract

```ts
interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
```

### SMS provider contract

```ts
interface SMSProvider {
  send(input: SendSmsInput): Promise<SendSmsResult>;
}
```

Domain code should call methods such as:

```ts
sendVerificationCode()
sendPasswordReset()
sendSecurityAlert()
sendWorkspaceInvite()
sendStudyReminder()
```

rather than invoking Resend or Termii directly.

---

## 25. Notification Categories

### Transactional

- Email verification.
- Login verification.
- Password reset.
- Security alerts.
- Account changes.
- Workspace invitations.
- Billing notices.

### Engagement

Future examples:

- Reading reminders.
- Study reminders.
- Sermon-preparation reminders.
- Saved-study digests.
- Product updates.

Users should be able to configure engagement notification preferences.

---

## 26. Background Processing

Vercel is appropriate for interactive Zedek and SSE workloads.

Heavy processing should remain architecturally separable.

Examples of heavy jobs:

- Bible corpus ingestion.
- Dataset normalization.
- Large embedding generation.
- Reindexing.
- Commentary import.
- Document processing.

Recommended model:

```text
Vercel Cron
    ↓
POST /jobs/...
    ↓
Job Queue
    ↓
Worker
    ↓
MongoDB / AI Provider
```

A future queue implementation may use BullMQ + Redis.

---

## 27. Source Provenance

Every imported research object should carry source metadata.

Example:

```ts
{
  sourceId: "...",
  sourceName: "STEPBible",
  license: "CC BY 4.0",
  attribution: "...",
  sourceUrl: "...",
  importedAt: Date
}
```

Source provenance is required for:

- Academic trust.
- Citation quality.
- Licensing compliance.
- Debugging.
- Dataset replacement.
- AI grounding.

---

## 28. Design System

Scrinode should use:

- Tailwind CSS for utility styling.
- Radix UI for accessible primitives.
- Custom Scrinode domain components.

Important domain components include:

```text
Verse
Passage
ScriptureReference
ScriptureSelection
TranslationSelector
CrossReference
Lexeme
MorphologyBadge
ResearchCard
Citation
ZedekMessage
StudyPanel
WorkspaceBlock
SermonBlock
```

These domain-specific components should become more important than generic card abstractions.

---

## 29. Visual Theme

Scrinode should feel:

- Scholarly.
- Calm.
- Reverent.
- Modern.
- Warm.
- Highly readable.
- Trustworthy.

### Light theme

- Background: `#F8F7F3`
- Surface: `#FFFFFF`
- Scripture surface: `#FCFAF5`
- Primary text: `#1C2430`
- Secondary text: `#667085`
- Primary brand: `#22304A`
- Secondary brand: `#355070`
- Zedek accent: `#C5A253`
- Study accent: `#6F7D5A`
- Border: `#E4E0D8`
- Selection: `#F0E3B5`

### Dark theme

- Background: `#10151F`
- Surface: `#171E2A`
- Scripture surface: `#141A24`
- Elevated surface: `#1E2735`
- Primary text: `#F3F0E8`
- Secondary text: `#B7BFCA`
- Border: `#2C3645`
- Zedek accent: `#D1B363`
- Study accent: `#9BAE83`
- Scripture links: `#91ADD1`
- Selection: `#514528`

### Semantic identity

Use these as restrained accents:

- Scripture: Ink/Navy.
- Study: Olive/Sage.
- Zedek: Muted Gold.
- Work: Slate Blue.
- Library: Warm Stone.

---

## 30. Responsive UX

### Mobile

- Single primary task.
- Bottom navigation.
- Bottom sheets.
- Drawer-based research.
- Full-screen modal research where necessary.
- Thumb-friendly actions.

### Tablet

- Two-pane layouts where useful.
- Persistent Scripture and Study combinations.
- More visible contextual controls.

### Desktop

Potential three-pane layout:

```text
Bible Navigation | Scripture Text | Study / Zedek / Notes
```

Desktop should use available space for parallel research rather than simply stretching mobile content.

---

## 31. Accessibility

Scrinode should target WCAG 2.2 AA.

Requirements:

- Keyboard-accessible navigation.
- Visible focus states.
- Sufficient color contrast.
- Screen-reader labels.
- Semantic HTML.
- Adjustable Scripture text size.
- Reduced-motion support.
- Touch targets appropriate for mobile.
- Non-color indicators for important states.
- Accessible modal and sheet behavior.

---

## 32. Security

> **Extended.** Admin identity is a separate system from reader identity, with its own collections, sessions and RBAC. Admin security rules are in AGENTS.md §27 and §33.

Minimum security requirements:

- Secure cookie-based authentication.
- CSRF protection where relevant.
- Rate limiting.
- Input validation.
- API authorization.
- Object-level user ownership validation.
- Secure password reset flows.
- Email verification.
- SMS verification where used.
- Audit logging for security-sensitive account actions.
- API secret isolation.
- Provider key rotation capability.
- Sanitization of user-generated rich text.
- Protection against prompt injection from retrieved content.

---

## 33. Observability

Recommended:

- Sentry for frontend/backend error tracking.
- Structured NestJS logging.
- Request IDs.
- AI request tracing.
- AI latency measurement.
- Token usage.
- Estimated AI cost.
- Retrieval performance.
- Vector-search metrics.
- Provider failure rates.
- Notification delivery status.

AI operational metadata may include:

```ts
{
  provider: "...",
  model: "...",
  inputTokens: 0,
  outputTokens: 0,
  latencyMs: 0,
  estimatedCost: 0
}
```

---

## 34. MVP Scope

The MVP should prioritize:

- Genesis-to-Revelation Bible reader.
- Book/chapter/verse navigation.
- Translation switching.
- Scripture search.
- Verse/passage selection.
- Copy and quote.
- Compare translations.
- Verse Inspector.
- Passage context.
- Cross-references.
- Basic Greek/Hebrew study.
- Zedek quick actions.
- Zedek conversational AI.
- Grounded citations.
- Notes.
- Highlights.
- Saved passages.
- Sermon workspace.
- Basic Bible-study workspace.
- Library.
- User account.
- Theme preferences.
- Responsive mobile/tablet/desktop design.

---

## 35. Features Deferred Beyond MVP

Potential later releases:

- Full church-team collaboration.
- Seminary organization accounts.
- Advanced textual criticism.
- Manuscript comparison.
- Full lectionary systems.
- Church calendar integration.
- Advanced biblical maps.
- Timelines.
- Genealogy visualizations.
- Presentation mode.
- Collaborative sermon editing.
- Audio Bible.
- Video Bible.
- Extensive licensed commentary libraries.
- Native mobile applications.
- Offline Scripture reading.

---

## 36. Core Acceptance Principles

A Scrinode feature should satisfy the following where applicable:

1. The user remains anchored to Scripture.
2. The biblical reference is explicit.
3. Translation identity is explicit.
4. AI output is visibly distinguishable from Bible text.
5. Research data has identifiable provenance.
6. Major interpretive disagreements are not falsely collapsed into certainty.
7. Original-language claims use structured lexical/morphological data where available.
8. Scripture context survives navigation between primary sections.
9. Mobile remains a first-class experience.
10. Desktop uses space productively rather than simply scaling the mobile UI.

---

## 37. Product North Star

Scrinode should become a workspace where a user can move naturally through:

```text
READ
  ↓
SELECT
  ↓
STUDY
  ↓
ASK ZEDEK
  ↓
VERIFY SOURCES
  ↓
SAVE
  ↓
BUILD
  ↓
PREACH / TEACH / LEARN
```

The product should reduce friction between encountering Scripture and performing serious, traceable biblical research while ensuring that the biblical text remains visually, conceptually, and technically foundational.

---

## 38. Final Product Statement

> **Scrinode is a Bible-first, AI-assisted research and ministry workspace that helps users move from Scripture to context, study, understanding, and application without losing sight of the text itself.**

