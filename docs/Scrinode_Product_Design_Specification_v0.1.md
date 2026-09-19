**SCRINODE**

Product Design  
Specification

**Mobile-first AI Bible research, study and ministry workspace**

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>PRODUCT THESIS<br />
Scripture is the primary interface. Study, Zedek AI, ministry work and
the user’s library assemble around the active biblical
text.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

| **Product**       | Scrinode                          |
|-------------------|-----------------------------------|
| **Domain**        | scrinode.com                      |
| **Stage**         | MVP / production-ready foundation |
| **Specification** | v0.1                              |
| **Date**          | 19 September 2026                 |

**DESIGN STATUS / FOUNDATION LOCKED, DETAIL ITERATION EXPECTED**

01 / Product definition

# Executive summary

Scrinode is an AI-powered Bible search, reference and theological
research platform for preachers, teachers and Bible scholars. Its
baseline experience is the complete Bible from Genesis to Revelation,
designed for reading, navigation, search, selection, quotation,
comparison and translation switching. Research capabilities are
assembled around the verse or passage currently in view.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>CORE PRINCIPLE<br />
Scrinode is Bible-first, not AI-first. The text remains visible,
addressable and authoritative in the interface; AI operates as an
assistive research layer around it.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## Product goals

- Make serious biblical research feel immediate and approachable on a
  phone without reducing scholarly depth.

- Let a user move naturally from Scripture → Study → Zedek AI → Work →
  Library while preserving the same active passage context.

- Ground AI answers in Scripture and identifiable research sources
  rather than relying on model memory alone.

- Support both rapid ministry preparation and deeper exegetical
  exploration.

- Deliver one coherent experience across mobile, tablet and desktop,
  with mobile as the primary design constraint.

## Primary audiences

| **Audience**                      | **Core needs**                                                                         | **Scrinode value**                                                  |
|-----------------------------------|----------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| Preachers / pastors               | Exegesis, sermon preparation, cross-references, historical context, original languages | Faster research-to-sermon workflow without losing textual grounding |
| Bible teachers / ministry leaders | Lesson planning, themes, explanations, saved notes, teaching structure                 | Structured study plus reusable teaching workspaces                  |
| Students / scholars               | Text comparison, lexical data, context, citations, interpretive options                | Traceable sources and contextual AI assistance                      |
| Serious Bible readers             | Readable Scripture, search, questions, themes, notes                                   | Low-friction path from reading to understanding                     |

## Success definition

The MVP succeeds when a new user can open Scrinode, locate any passage
quickly, understand the surrounding context, inspect cross-references or
original-language information, ask Zedek a grounded follow-up question,
and save useful material into a workspace or library without needing to
learn a complex toolset.

02 / Experience principles

# Design principles

| **Principle**                       | **Implication**                                                                                                                |
|-------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| Scripture first                     | Default screens foreground the biblical text. Research expands from a verse or passage rather than displacing it.              |
| Context travels                     | The selected reference, range, translation and relevant research state persist across Study, Zedek, Work and Library actions.  |
| Progressive disclosure              | Mobile shows one primary task at a time; deeper tools appear through sheets, drawers, tabs and expandable sections.            |
| Evidence before synthesis           | Structured Scripture/research retrieval precedes AI explanation. Claims should expose sources where practical.                 |
| Deterministic study + generative AI | Study provides inspectable data and research views; Zedek synthesizes, compares and converses over that data.                  |
| Same IA, adaptive composition       | Mobile uses bottom navigation and stacked views; large screens use top navigation and multi-pane layouts.                      |
| Ministry output is downstream       | Research should be easily captured into sermons, liturgies, teaching notes and studies.                                        |
| Respect interpretive plurality      | Where views materially differ, Scrinode distinguishes textual observation, historical evidence and theological interpretation. |

## Trust model

Scrinode should visually distinguish four categories of information:
biblical text, structured research data, sourced historical/scholarly
material, and AI-generated synthesis. This distinction must survive
copying, saving and exporting so users can tell what came from where.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>ZEDEK’S ROLE<br />
Zedek AI is a Scripture-grounded research assistant — not an oracle,
spiritual authority or replacement for the user’s theological
judgment.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## Non-goals for the MVP

- Competing immediately with every feature of mature desktop Bible
  suites.

- Replacing pastors, teachers, scholars, commentaries or local church
  discernment.

- Presenting AI-generated paraphrases as established Bible translations.

- Treating every theological disagreement as if a single interpretation
  is undisputed.

- Building separate mini-apps for every research function.

03 / Information architecture

# Global application shell

The global IA is intentionally constrained to five primary destinations.
Account and application settings are excluded from the base menu and
accessed from the profile control in the top-right.

| **Scripture**          | **Study**                 | **Zedek**                | **Work**                    | **Library**     |
|------------------------|---------------------------|--------------------------|-----------------------------|-----------------|
| Read · search · select | Context · language · refs | Ask · explain · research | Sermons · liturgy · studies | Saved knowledge |

## Navigation semantics

| **Destination** | **Purpose**                                 | **Representative content/actions**                                                                             |
|-----------------|---------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| Scripture       | The canonical reading and discovery surface | Bible reader, book/chapter navigation, reference search, translation switching, selection, copy/quote, compare |
| Study           | Structured research around the active text  | Context, cross-references, Greek/Hebrew, lexical data, themes, history, people, places, literary structure     |
| Zedek           | Conversational AI research layer            | Quick AI actions, contextual chat, explanation, comparison, synthesis, research follow-ups                     |
| Work            | Active ministry/research production         | Sermons, liturgies, Bible studies, teaching notes, research projects                                           |
| Library         | Saved and reusable knowledge                | Saved passages, highlights, notes, collections, research cards, conversations, references                      |

## Profile and settings

Profile remains in the top-right across breakpoints. It is deliberately
separate from the five product domains.

- Profile and account details

- Security and authentication

- Notifications

- Appearance

- Bible preferences

- Zedek AI preferences

- Subscription / billing

- Help and support

- Sign out

04 / Responsive behavior

# Mobile-first, desktop-capable

Scrinode is designed from the smallest practical viewport outward.
Desktop does not introduce a separate IA; it unlocks more simultaneous
context and persistent panes.

| **Viewport mode**    | **Primary navigation**                        | **Content composition**                                     | **Research behavior**                                                                      |
|----------------------|-----------------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Mobile (\<768 px)    | Persistent bottom navigation                  | Single primary column; sheets/drawers for secondary actions | One task at a time; verse inspector and AI often use bottom sheets/full-screen transitions |
| Tablet (768–1199 px) | Top or adaptive navigation depending on width | Two-pane layouts where beneficial                           | Scripture + Study/Notes can coexist                                                        |
| Desktop (≥1200 px)   | Primary navigation moves to top app bar       | Two- or three-pane workspaces                               | Persistent Scripture, Study/Zedek and notes/workspace panes as appropriate                 |

## Desktop composition

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>DESKTOP RULE<br />
Use extra width to increase research visibility, not to stretch mobile
content into long lines.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

A wide Scripture research layout can expose Bible/book navigation at
left, the biblical text in the center, and a contextual
Study/Zedek/Notes panel at right. Pane visibility should be
user-controllable and responsive to available width.

## Persistent global elements

- Scrinode brand / contextual title area

- Primary navigation

- Top-right profile/avatar

- Active Scripture context where relevant

- Global search entry point or keyboard shortcut on large screens

- Responsive content container with readable text measure

05 / Core experience

# Scripture

Scripture is the default and foundational destination. The Bible exists
as a complete navigable corpus from Genesis to Revelation. Everything
else is downstream from the current passage.

## Core capabilities

- Browse by testament, book and chapter.

- Navigate directly by canonical reference.

- Search exact words, phrases, topics and natural-language descriptions.

- Switch among available Bible translations without losing position.

- Compare multiple translations.

- Select a word, phrase, verse, verse range or paragraph.

- Copy, quote, share, highlight, note and save selected text.

- Open structured Study views or invoke Zedek directly from the selected
  scope.

## Bible reader anatomy

| **Region**         | **Mobile behavior**                                               | **Desktop behavior**                                            |
|--------------------|-------------------------------------------------------------------|-----------------------------------------------------------------|
| Header             | Book/chapter control, translation control, search access, profile | Top navigation plus book/chapter and translation controls       |
| Reading surface    | Single readable column, generous touch targets                    | Centered reading column; optional navigation and research panes |
| Verse interaction  | Tap/select opens Verse Inspector bottom sheet                     | Selection opens contextual side panel or anchored inspector     |
| Contextual actions | Copy, Quote, Compare, Save, Study, Ask Zedek                      | Same actions with more persistent affordances                   |
| Navigation         | Chapter gestures/buttons and book picker                          | Book/chapter tree or compact navigator plus keyboard support    |

## Selection scope

| **Selection**           | **Contextual actions**                                                                     |
|-------------------------|--------------------------------------------------------------------------------------------|
| Word                    | Define; original language; lemma; morphology; occurrences; ask Zedek                       |
| Phrase                  | Copy/quote; compare translations; phrase study; ask Zedek                                  |
| Single verse            | Context; cross-references; compare; history; themes; save; ask Zedek                       |
| Verse range / paragraph | Explain passage; structure; themes; cross-references; create study; add to Work; ask Zedek |

## Translation model

Published Bible versions and AI language transformation must remain
distinct. A licensed or open Bible version is presented as a canonical
translation option. An AI-generated language rendering is clearly
labelled as AI-assisted and retains its source translation metadata.

06 / Contextual research

# Verse Inspector and Study

The Verse Inspector is the bridge between reading and research. It keeps
the user anchored to the selected text while exposing actions and
structured data. Study is the full destination for deeper inspection of
the same active context.

## Verse Inspector — recommended sections

- Selected text + canonical reference

- Copy / Quote / Compare / Save

- Context

- Cross-references

- Original language / word study

- Themes

- History / ancient world

- People and places

- Notes

- Ask Zedek

## Study modules

| **Module**         | **Purpose**                                                                     | **MVP expectation**                                                       |
|--------------------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| Context            | Understand the selected text within paragraph, section, chapter, book and canon | Immediate + broader literary context; context-aware retrieval             |
| Cross-references   | Discover connected passages                                                     | Curated/data-driven references with relation labels where available       |
| Original language  | Inspect Greek/Hebrew/Aramaic source data                                        | Tokens, lemma, transliteration, morphology, gloss/sense, occurrence links |
| Themes             | Trace recurring biblical concepts                                               | Theme tags and related passages; deeper graph later                       |
| History            | Surface relevant ancient setting                                                | Sourced historical/cultural notes; clearly separated from textual claims  |
| People & places    | Explore biblical entities                                                       | Entity summaries and linked occurrences; maps can follow post-MVP         |
| Literary structure | See rhetorical/narrative organization                                           | Section/pericope structure and AI-assisted observations with evidence     |

## Context Engine

For a selected verse, Scrinode should reason across concentric scopes
rather than treating the verse as an isolated sentence:

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>CONTEXT HIERARCHY<br />
VERSE → PARAGRAPH / PERICOPE → CHAPTER → BOOK → AUTHOR / CORPUS →
TESTAMENT → CANONICAL THEMES</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

The exact retrieved scope is query-dependent. Zedek should receive the
relevant surrounding text and structured research context before
generation.

07 / AI experience

# Zedek AI

Zedek AI is Scrinode’s named Scripture-grounded research assistant.
“Zedek” is used conversationally in the interface; “Zedek AI” is used in
formal product language and settings.

## Primary interaction modes

| **Mode**         | **Example**                            | **Behavior**                                                                       |
|------------------|----------------------------------------|------------------------------------------------------------------------------------|
| Quick action     | Explain this verse                     | Runs a structured prompt/retrieval workflow against the active selection           |
| Contextual chat  | Why does John call Jesus “the Word”?   | Opens conversation already grounded in the active passage and its research context |
| Open research    | Compare resurrection accounts          | Routes the question to multi-passage retrieval and structured comparison           |
| Workspace assist | Turn these notes into a sermon outline | Uses explicit workspace content plus linked Scripture/research artifacts           |

## Suggested quick actions

- Explain this verse / passage

- Explain the context

- Explore the Greek / Hebrew

- Find related passages

- Historical background

- Trace this theme

- Compare interpretations

- Summarise this section

- Create study questions

- Add insight to workspace

## Zedek behavioral contract

- Start with the biblical text and the user’s active context.

- Distinguish direct textual observation from interpretation and
  application.

- Cite relevant Scripture and identifiable research sources.

- Prefer structured lexical data over model-recalled claims about
  Greek/Hebrew.

- Surface meaningful interpretive disagreement rather than flattening
  it.

- Avoid fabricated quotations, sources, historical facts and lexical
  claims.

- Preserve provenance when research cards are saved into Work or
  Library.

- Support ministry preparation without presenting itself as spiritual
  authority.

## Active Scripture Context object

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>STATE REQUIREMENT<br />
Every contextual Zedek session should know the canonical reference,
selected range, active translation, selected text, relevant surrounding
passage and any explicitly loaded study data.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

08 / User output

# Work and Library

## Work

Work is where research becomes ministry or scholarly output. On mobile
it behaves as focused project editing; on desktop it can pair a
workspace with Scripture and research panes.

| **Workspace type**     | **MVP content model**                                                                                                     |
|------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Sermon                 | Title, text, theme/proposition, outline, exposition, illustration, application, conclusion, prayer, linked research cards |
| Liturgy / service flow | Service sections, readings, prayers, songs/notes, transitions, linked passages                                            |
| Bible study / teaching | Passage, objectives, observations, questions, notes, applications, references                                             |
| Research project       | Freeform structured notes, linked passages, sources, Zedek threads and collections                                        |

## Research capture

Any useful result — verse, cross-reference, lexical insight, historical
note, Zedek response segment or user note — should be saveable as a
reusable research card with source/provenance metadata. A card can be
attached to one or more workspaces without duplicating the underlying
evidence.

## Library

Library is the long-term knowledge layer. It stores and organizes the
user’s saved material rather than becoming another editing environment.

- Saved passages and verse ranges

- Highlights

- Notes

- Research cards

- Collections/folders/tags

- Saved Study views or snapshots

- Zedek conversations worth retaining

- References and sources

- Recently opened items

## Work vs Library rule

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>MENTAL MODEL<br />
Work = what I am producing. Library = what I am keeping and
reusing.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

09 / Discovery

# Universal search and intent routing

Users should not need separate search modes for references, keywords,
topics, lexical terms and theological questions. One input can infer
intent and route the query to the appropriate retrieval path.

| **Input**                                     | **Detected intent**        | **Primary result**                                    |
|-----------------------------------------------|----------------------------|-------------------------------------------------------|
| John 3:16                                     | Reference navigation       | Open passage                                          |
| faith without works                           | Phrase / keyword search    | Scripture results with matching context               |
| verses about resurrection                     | Semantic Scripture search  | Relevant passages first                               |
| agape                                         | Lexical query              | Original-language entry + occurrences                 |
| why did Jesus wash their feet?                | Biblical research question | Relevant passage retrieval, then Zedek synthesis      |
| compare Romans and Galatians on justification | Comparative research       | Multi-passage research view + optional Zedek analysis |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>SEARCH PRINCIPLE<br />
Retrieve Scripture first. Interpret second.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Search results should privilege canonical passages and structured
research results. AI synthesis can be offered alongside or after
retrieval, but should not replace the underlying evidence.

10 / Product data model

# Foundational objects and state

The canonical verse is an addressable entity independent of any specific
translation. Translation text, original-language tokens,
cross-references, themes and user artifacts attach to stable canonical
identifiers.

## Canonical identifiers

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>EXAMPLE<br />
JHN.1.1 • ROM.8.28 • GEN.1.1</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

An OSIS-style identifier scheme is appropriate because it is
human-debuggable, stable and broadly compatible with Scripture tooling.
The final implementation should define how deuterocanonical/apocryphal
books and versification differences are represented before ingestion
expands.

## Core entities

| **Entity**             | **Key responsibility**                                                    |
|------------------------|---------------------------------------------------------------------------|
| CanonicalReference     | Book/chapter/verse/range identity independent of translation              |
| BibleTranslation       | Version metadata, license, language, versification, text source           |
| VerseText              | Translation-specific text linked to canonical reference                   |
| OriginalToken          | Language, surface form, lemma, morphology, transliteration, lexical links |
| CrossReference         | Source reference, target reference, relation/source metadata              |
| StudyArtifact          | Theme, historical note, entity, literary observation, provenance          |
| ActiveScriptureContext | Runtime state shared across navigation destinations                       |
| UserArtifact           | Highlight, note, saved passage, research card, collection                 |
| Workspace              | Sermon, liturgy, study or project document and its linked artifacts       |
| ZedekThread            | Conversation with explicit Scripture/workspace grounding                  |

## Active context

At minimum, shared app state should preserve: canonical reference/range,
translation, selected text, optional selected tokens, previous reading
position and any Study data explicitly opened for the current
interaction.

11 / AI + retrieval architecture

# Grounded AI system design

The product should avoid a direct “user → model → answer” architecture
for biblical research. Zedek is the final reasoning/synthesis layer over
retrieved Scripture and approved research data.

| **User intent / quick action**   |
|----------------------------------|
| **Intent router**                |
| **Scripture + Study retrieval**  |
| **Context builder**              |
| **Zedek model reasoning**        |
| **Citation / claim checks**      |
| **Streamed answer + provenance** |

## Provider abstraction

The AI layer should be model-provider independent. The application can
expose internal interfaces for generation/streaming, embeddings,
structured output and moderation/validation rather than binding core
product behavior to one vendor.

## Retrieval priorities

**1.** Canonical Scripture text for the active translation and necessary
surrounding scope.

**2.** Structured cross-reference/original-language/theme/entity data.

**3.** Approved historical and scholarly sources with provenance.

**4.** User-authorized workspace/library context.

**5.** Only then: model reasoning and composition.

12 / UI system

# Visual and interaction system

## Visual character

Scrinode should feel calm, scholarly and contemporary rather than
ornamental or ecclesiastically themed. Scripture readability is more
important than decorative branding. Use generous whitespace, strong
typographic hierarchy and restrained accent color.

## Core component families

| **Family** | **Components**                                                                                            |
|------------|-----------------------------------------------------------------------------------------------------------|
| Navigation | Mobile bottom bar, desktop top nav, profile/avatar menu, breadcrumb/context title                         |
| Scripture  | Verse row, passage block, book/chapter picker, translation selector, compare view, selection toolbar      |
| Research   | Verse Inspector, Study tabs/sections, lexical token card, cross-reference card, context card, source chip |
| Zedek      | Ask composer, quick-action chips, answer block, citation/source treatment, conversation history           |
| Work       | Workspace editor, outline blocks, linked research cards, Scripture embed, note block                      |
| Library    | Saved-item card, collection, filters, search, recent activity                                             |
| System     | Bottom sheet, side panel, modal, toast, skeleton/loading, empty/error states                              |

## Interaction rules

- Primary Scripture text must remain selectable and accessible to native
  copy/share behavior where possible.

- Tap targets should be comfortable for one-handed mobile use; do not
  rely on hover for essential actions.

- Secondary research appears without losing reading position.

- Back navigation should restore prior scroll/selection state.

- Loading states should preserve layout and stream content where
  appropriate.

- Destructive account/workspace actions require clear confirmation;
  ordinary research actions should be low-friction.

## Accessibility

- WCAG 2.2 AA target for product UI

- Semantic headings and landmarks

- Keyboard-navigable desktop experience

- Visible focus states

- Screen-reader labels for verse/action controls

- User-adjustable reading size and sufficient contrast

- Do not encode research categories using color alone

13 / Critical journeys

# Core user flows

## Flow A — Read → Study → Ask

**1.** Open Scripture and navigate to a passage.

**2.** Select a verse or range.

**3.** Open Verse Inspector and choose Context, Cross-references,
Original Language or another Study action.

**4.** Tap “Ask Zedek” or a quick AI CTA.

**5.** Receive a grounded answer that retains the active Scripture
context.

**6.** Save the useful result to Library or attach it to a workspace.

## Flow B — Search → Passage

**1.** Enter reference, phrase, topic or question in universal search.

**2.** Intent router returns Scripture-first results.

**3.** Open a result without losing the query context.

**4.** Continue reading, Study, or ask Zedek about the passage.

## Flow C — Research → Sermon

**1.** Create/open a sermon workspace.

**2.** Attach a primary Scripture text.

**3.** Move between Scripture/Study/Zedek while the workspace remains
linked.

**4.** Save selected verses, lexical insights, context notes and sourced
AI insights as research cards.

**5.** Arrange cards/notes into sermon structure and edit the final
manuscript/outline.

## Flow D — Continue across devices

**1.** Read or research on mobile.

**2.** Saved state syncs reading position, highlights, notes and
workspace changes.

**3.** Open desktop and recover the same active project/context.

**4.** Use wider multi-pane layout for deeper preparation.

14 / Delivery scope

# MVP scope and prioritization

| **Priority** | **Capability**                    | **MVP definition**                                                                                            |
|--------------|-----------------------------------|---------------------------------------------------------------------------------------------------------------|
| P0           | Complete Bible reader             | Genesis–Revelation baseline corpus, navigation, reference routing, translation selection, verse range support |
| P0           | Search                            | Reference, keyword/phrase and foundational semantic Scripture search                                          |
| P0           | Selection + Verse Inspector       | Word/verse/range interaction; copy/quote/save; entry points to Study and Zedek                                |
| P0           | Study essentials                  | Context, cross-references, Greek/Hebrew core data, basic themes/history where source quality is ready         |
| P0           | Zedek AI                          | Context-aware quick actions + conversational chat with citations/provenance                                   |
| P0           | Accounts + sync                   | Authentication, profile, security baseline, cloud persistence                                                 |
| P0           | Work                              | Sermon + general study/research workspace; linked Scripture/research cards                                    |
| P0           | Library                           | Saved passages, notes, highlights, research cards, conversations/collections                                  |
| P1           | Translation compare               | Side-by-side/stacked comparison of selected translations                                                      |
| P1           | Liturgy workspace                 | Structured service flow and readings                                                                          |
| P1           | Advanced entity/theme exploration | Richer people/place/theme graph navigation                                                                    |
| P2           | Maps, timelines, collaboration    | Post-MVP depth and team features                                                                              |

## Production readiness baseline

- Observability for search, AI retrieval/generation and errors

- Rate limiting and abuse controls

- Data backup and migration discipline

- Source/license registry for every Scripture/research dataset

- Privacy controls and account deletion/export strategy

- Responsive performance budgets

- Feature flags for experimental Study/Zedek capabilities

- Graceful fallback when AI or external content services are unavailable

15 / Quality and measurement

# Non-functional requirements and product metrics

## Performance targets — design intent

- Bible chapter navigation should feel near-instant after initial app
  load or cache warm-up.

- Reader interactions (selection, inspector open/close, translation
  switch UI) must remain responsive under normal mobile conditions.

- Zedek responses should stream rather than block until full completion.

- Desktop multi-pane layouts must not degrade Scripture readability or
  cause uncontrolled horizontal scrolling.

## Trust / quality metrics

| **Metric**                                    | **Why it matters**                                                          |
|-----------------------------------------------|-----------------------------------------------------------------------------|
| Citation coverage for factual research claims | Measures whether AI synthesis remains inspectable                           |
| Source-open rate                              | Indicates whether users find provenance useful                              |
| Answer correction / negative feedback rate    | Tracks quality regressions in Zedek                                         |
| Search-to-passage success                     | Measures whether users can reach intended Scripture quickly                 |
| Study-to-save / Study-to-Work conversion      | Measures whether research is becoming useful output                         |
| Workspace return rate                         | Signals whether Scrinode is becoming part of sustained ministry preparation |

## Privacy and security

- Treat user notes, ministry drafts and AI conversations as private user
  content by default.

- Apply least-privilege access across application services.

- Separate public Bible/source data from private user/workspace data.

- Encrypt transport; use secure credential/session practices; log
  access-sensitive operations appropriately.

- Do not expose private workspace context to Zedek unless the current
  request/session is authorized to use it.

16 / Definition of done

# MVP acceptance criteria

- A user can browse from Genesis through Revelation and navigate
  directly to a canonical reference.

- A user can change Bible translation without losing their current
  passage.

- A user can select a verse/range and open context-aware actions.

- Study can show at minimum context, cross-references and
  original-language data for supported passages.

- Zedek can be invoked from the active passage and retains that context
  through follow-up questions.

- A user can save research into Library and attach useful material to a
  workspace.

- The five-item IA is consistent across devices: bottom navigation on
  mobile and top navigation on large screens.

- Profile/settings remains top-right and does not consume a primary
  navigation destination.

- Desktop exposes materially better multi-pane research/productivity
  behavior rather than merely scaling up mobile.

- AI output clearly differs visually and semantically from Bible text
  and cited research data.

## Decisions currently locked

| **Decision**                                           | **Status** |
|--------------------------------------------------------|------------|
| Bible-first product model                              | Locked     |
| Primary IA: Scripture / Study / Zedek / Work / Library | Locked     |
| AI assistant name: Zedek AI                            | Locked     |
| Profile/settings in top-right                          | Locked     |
| Mobile-first with top navigation on large screens      | Locked     |
| Shared active Scripture context across product domains | Locked     |
| Study and AI remain conceptually distinct              | Locked     |

## Next design decisions

- Scripture screen wireframe and interaction detail.

- Verse Inspector hierarchy and mobile sheet behavior.

- Study landing screen and module navigation.

- Zedek conversation UI, source/citation treatment and quick-action
  taxonomy.

- Workspace editor model and sermon/liturgy block system.

- Bible/research dataset licensing matrix and normalized ingestion
  schema.

- Design token system: type scale, spacing, radius, color, icons,
  elevation and motion.

- Authentication/onboarding flow and default Bible translation
  selection.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>RECOMMENDED NEXT ARTIFACT<br />
Create the Scripture + Verse Inspector UX specification first. It is the
nucleus that every Study, Zedek, Work and Library workflow depends
upon.</strong></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Appendix A

# Working terminology

| **Term**                 | **Definition**                                                                                         |
|--------------------------|--------------------------------------------------------------------------------------------------------|
| Active Scripture Context | The canonical passage/range, translation, selection and relevant study state shared across the app.    |
| Verse Inspector          | Contextual interaction surface opened from selected Scripture.                                         |
| Study                    | Structured, inspectable research tools and datasets associated with Scripture.                         |
| Zedek AI                 | Scrinode’s Scripture-grounded conversational research assistant.                                       |
| Research card            | Reusable saved artifact containing an insight, source or Scripture reference with provenance.          |
| Work                     | User-authored ministry/research projects: sermons, liturgies, studies and related documents.           |
| Library                  | Persistent store of saved Scripture, notes, highlights, research cards, collections and conversations. |
| Canonical reference      | Stable Bible location independent of a specific translation.                                           |
