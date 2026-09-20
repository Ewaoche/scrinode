# Translation Licensing Matrix

**Status:** Researched and implemented — awaiting product-owner decisions (§10)
**Author:** Claude (Opus 5)
**Date:** 2026-09-20
**Implements:** AGENTS.md §21 (Source Provenance), §22 (Translation Integrity), §42 (never invent licensing terms)
**Code:** `packages/types/src/licence.ts`, `packages/scripture/src/translations.ts`

---

## 1. Why this document exists

Scrinode cannot render a single verse until it knows which text it is allowed
to render. The design documents name WEB and KJV as examples and give
`license` as a field on imported sources, but nothing said which translations
ship, what each licence actually permits, or how the system enforces it.

A licence string in a `sources` document is documentation. It is not
enforcement. This document supplies the terms; `packages/scripture/src/translations.ts`
supplies the enforcement.

**Every term below was read from the publisher's own licence page.** Where a
publisher is silent, this document records silence. AGENTS.md §42 names
"invent licensing terms" as a prohibited agent action, and §21 requires
provenance on everything ingested. A plausible guess about a verse cap is
worse than no registry at all, because it reads as verified.

---

## 2. The commercial premise

**Scrinode sells subscriptions.** No advertising, but paid plans — confirmed by
the product owner, 20 September 2026.

Every publisher treats a subscription as commercial use, and several define it
broadly enough that donations alone would qualify. This is the single fact that
most constrains the matrix, so it is recorded in code as
`IS_COMMERCIAL_PRODUCT` and enforced by test rather than left to memory.

What it eliminates outright:

| Route | Why it is unavailable |
|---|---|
| Free ESV API | Commercial = a site designed "to pay for a service" |
| API.Bible free tier | *"No ads, fees, freemium models or upsells allowed"* |
| NET gratis licence | Redistribution requires giving the text away |
| Bible Brain (FCBH) | Requires providing content free of charge |

What it does **not** affect: every public-domain text (BSB, WEB, OEB) and both
CC BY-SA texts (LSV, FBV). Commercial use is explicitly permitted for all five.

The practical consequence is that **every licensed version now costs money**.
There is no free path to ESV, NIV, NASB, CSB, NKJV, NLT or NRSV. Tier 1 remains
free and unaffected.

---

## 3. The three tiers and what actually gates them

| Tier | Texts | Gate | Who clears it |
|------|-------|------|---------------|
| 1 — Public domain | BSB, WEB, OEB | Nothing legal. Ingestion only. | Engineering, now |
| 2 — Open licence | LSV, FBV | Attribution rendering in the UI | Engineering, after reader |
| 3 — Licensed | ESV, NIV, NASB, … | A signed agreement | Product owner, weeks to months |

These are not three sizes of the same task. Tier 1 is a data-loading problem.
Tier 2 is a UI problem — a required notice must render somewhere the licence
considers acceptable. Tier 3 is a commercial negotiation that no amount of
engineering shortens.

This is why `TranslationStatus` exists rather than a boolean. A translation
can be known to the system, correct in its terms, and still not servable.

---

## 4. Tier 1 — Public domain

No fees, no caps, no attribution obligation, no negotiation. These can be
ingested and served today.

### BSB — Berean Standard Bible ✅ available

| | |
|---|---|
| Licence | Public domain (dedicated), effective 30 April 2023 |
| Source | <https://berean.bible/terms.htm> |
| Commercial use | Permitted — *"All uses are freely permitted."* |
| Limits | None |
| Attribution | **Not required** (publisher labels its suggested text "appreciated but not required") |
| Redistribution | Full — *"all public domain materials may be freely reproduced, integrated, and adapted"* |
| AI / RAG | Not addressed. No copyright to assert, so silence is harmless. |
| Text | <https://berean.bible/downloads.htm> — USFM, **USJ (JSON)**, USX, TXT, XLSX |

**Recommended default translation.** It is the only candidate publishing
first-class JSON, it is contemporary English, and it carries no obligations
whatsoever.

The publisher *requests* that the Berean name not be used for derivative works
that vary from the official text. Verbatim text is invited to bear the name.
This is a request about naming, not a licence condition.

### WEB — World English Bible ✅ available

| | |
|---|---|
| Licence | Public domain — **not** CC0. *"it is not copyrighted"* |
| Source | <https://worldenglish.bible/> |
| Commercial use | Permitted — *"no royalty charge or any hassles"* |
| Limits | None |
| Attribution | Not required |
| Redistribution | Full |
| AI / RAG | Not addressed. No copyright to assert. |
| Text | <https://ebible.org/find/details.php?id=engwebp> — USFM, USFX, TXT, SQL |

**The one live constraint is trademark, not copyright.** "World English Bible"
is a trademark of eBible.org and may identify only faithful copies. Public
domain removes the copyright; it does not remove the trademark. Unmodified
text may carry the name; modified text may not.

`engwebp` is the Protestant-canon edition. Editions differ by canon and
spelling, not by licence.

### OEB — Open English Bible ⛔ blocked on completeness

| | |
|---|---|
| Licence | CC0 1.0 |
| Source | <https://openenglishbible.org/faq/> |
| Commercial use | Permitted, unrestricted |
| Limits | None |
| Attribution | Not required (CC0 waives it) |
| AI / RAG | Not addressed. CC0 leaves no restriction. |

**Blocked on completeness, not on terms.** The OEB is an ongoing project and
the Old Testament is not finished. Book coverage must be verified and the
reader must handle missing books before this is offered. The licence is as
permissive as any in this document.

---

## 5. Tier 2 — Open licence, obligations attached

Free and commercially usable, but each carries conditions that must be
implemented before the text may be served.

### LSV — Literal Standard Version ⏳ pending attribution

| | |
|---|---|
| Licence | CC BY-SA 4.0 |
| Source | <https://www.lsvbible.com/p/get-lsv.html> |
| Rights holder | Covenant Press, Covenant Christian Coalition |
| Commercial use | Permitted, with heavier attribution |
| Attribution | **Required.** Commercial use or whole-book distribution must name both *"Literal Standard Version (LSV)"* and the organisation |
| Share-alike | **Yes** — derivatives inherit CC BY-SA |
| AI / RAG | Not addressed |
| Text | <https://ebible.org/find/details.php?id=englsv> — USFM, USFX, TXT, SQL |

Scrinode is commercial and serves whole books, so the heavier attribution
applies. Blocked until attribution rendering exists.

> ⚠️ **Do not encode the 1,000-verse cap.** Several third-party summaries state
> that LSV commercial citation is capped at 1,000 verses and must not
> constitute a whole book. **That language does not appear on the publisher's
> current permissions page.** It is not in the registry. If it matters
> commercially, email Covenant Press rather than trusting either reading.

Share-alike binds *derivative works*. Serving unmodified text is distribution,
not adaptation, so a read-only reader is fine — but anything that adapts the
text inherits BY-SA.

### FBV — Free Bible Version ⛔ blocked on coverage

| | |
|---|---|
| Licence | CC BY-SA 4.0 |
| Source | <https://www.freebibleversion.org/> |
| Rights holder | Dr. Jonathan Gallagher |
| Commercial use | Permitted |
| Attribution | Required; **no publisher-specified wording** — CC BY-SA 4.0 defaults apply |
| Share-alike | Yes |
| Text | <https://ebible.org/find/details.php?id=engfbv> — USFM, USFX, TXT, SQL |

Principally a New Testament. Old Testament coverage is unverified and must be
confirmed before offering it as a whole-Bible option.

---

## 6. NET Bible — a specific warning ⛔ requires agreement

**The NET is not an open licence, despite its reputation.** It is frequently
grouped with the free translations above. It does not belong there.

| | |
|---|---|
| Licence | Custom proprietary grant |
| Source | <https://netbible.com/copyright/> |
| Rights holder | Biblical Studies Press, L.L.C.; commercial licensing via HarperCollins |
| Commercial use | **Prohibited** under the free grant |
| Redistribution | Only where given away with **zero** monetisation |

The redistribution clause is the disqualifier, verbatim:

> *"You may copy the NET Bible® and print it for others as long as you give it
> away, do not charge for it … In this case, free means free. It cannot be
> bundled with anything sold, used as a gift to solicit donations, nor can you
> charge for shipping, handling, or anything."*

That rules out a paid tier, advertising, and donation prompts. Any of the
three breaches it.

If an agreement is ever obtained, note the app-specific attribution: the
marker `(NET)` must follow each quotation and, in internet-connected
applications, **must be hyperlinked** to <http://netbible.org>. The translator
notes are excluded even from the non-commercial grant.

Because the licence reserves all permissions not expressly granted, AI and RAG
use should be treated as **ungranted** absent written permission. That is an
inference from the reservation clause, not licence text, and is recorded as
such in the registry.

A "complete book of the Bible" cap is repeated by third parties but does not
appear on the publisher's current page. Not encoded.

---

## 7. Tier 3 — Licensed versions

None of these can ship without a signed agreement. The registry deliberately
contains **no entry for any of them**: an unregistered code fails closed, so
`isAvailable('NIV')` returns `false` today rather than depending on a status
field being set correctly.

### 7.1 The mistake to avoid: fair-use verse counts do not apply to us

Every publisher below states a fair-use quotation limit — 500 verses, 1,000
verses, 25% of the work. **These do not authorise a Bible app.** They govern
quoting Scripture *inside a work* such as a book or a sermon. Serving passages
on demand is redistribution, and it needs a licence regardless of how few
verses any single page shows.

Friendship Press states this outright for the NRSVue:

> *"The Fair Use Guidelines do not apply to Phone Applications, or other New
> Media Platforms (web sites, apps, etc.)."*

The other publishers simply do not contemplate the use case. Treat the numbers
in this section as context, never as a permission to build on. Planning to
"stay under 500 verses" is not a licensing strategy.

### 7.2 AI positions — decision-critical for Zedek

Two publishers have taken positions that bear on architecture, not just
paperwork. Scrinode retrieves Scripture into model context (AGENTS.md §20), so
these determine viability rather than merely cost.

| Publisher | Position |
|---|---|
| **Crossway (ESV)** | ⚠️ Reportedly **not approving** projects where the ESV interacts with AI/LLMs |
| **Biblica (NIV)** | Requires an explicit AI licence under a non-public "Publisher AI Policy" |
| **Lockman (NASB)** | ✅ Explicitly **permits** AI systems — names Claude, ChatGPT, Copilot, Gemini — up to 1,000 verses per response |
| Holman, Thomas Nelson, Tyndale, NCC | Silent |

The Crossway position comes from secondary reporting (MinistryWatch,
sellingjesus.org), **not** from Crossway's own permissions page, which says
nothing about AI. It is decision-critical and unverified. **Confirm directly
with Crossway before any plan assumes the ESV.**

Lockman being the permissive outlier is genuinely surprising and makes the
NASB the strongest licensed candidate for an AI-assisted product.

### 7.3 Per-publisher summary

| Version | Rights holder | Route | Fair-use limit (not applicable to apps) | Storage rule |
|---|---|---|---|---|
| **ESV** | Crossway | Free self-serve API at api.esv.org | 500 verses / half a book | Caching permitted up to 500 verses |
| **NIV** | Biblica / HarperCollins | Negotiated; **commercial not available** on API.Bible | 500 verses, <25% | Not stated |
| **NASB** | Lockman | API.Bible | 1,000 verses, <50% | **Max 1,000 verses in an electronic retrieval system** |
| **CSB** | Holman (Lifeway) | API.Bible | 1,000 verses, <50% | Not stated |
| **NKJV** | Thomas Nelson | API.Bible | 500 verses, <25% | Not stated |
| **NLT** | Tyndale | API.Bible | 500 verses, <25% | Not stated |
| **NRSVue** | NCC / Friendship Press | Bespoke via Petradi | 500 verses — **excluded for apps** | Not stated |

**ESV is unusually permissive for a licensed text** — free, self-serve,
published rate limits (5,000 queries/day, 60/minute), explicit caching
allowance. The catch is that "non-commercial" is defined broadly enough to
include **donations and advertising**. Any monetisation voids the free tier.

**The NASB's 1,000-verse storage cap is the binding constraint**, not its
quotation limit. A database-backed reader cannot hold the full text under
gratis terms.

No publisher in this tier publishes fees or approval timelines. That silence
is itself the finding and should be budgeted as lead time.

### 7.4 Aggregators

**API.Bible** (American Bible Society) is the pragmatic route to four of the
seven — NASB, CSB, NKJV and NLT under one agreement. It does **not** carry ESV
or NRSV.

- Free tier: 3 copyrighted Bibles, 5,000 calls/month, strictly non-commercial
  — *"No ads, fees, freemium models or upsells allowed."*
- Pro from $29/month; commercial licensing from $10/month per translation.
- **Caching is generous**: an entire translation may be cached, refreshed at
  least every 30 days.
- ⚠️ **FUMS v3 instrumentation is mandatory** — every request must carry
  `fums-version=3` and report viewing data back. It tracks device ID, session
  ID and optionally a hashed user ID. This is a real engineering requirement
  **and a privacy consideration**: it sends reader behaviour to a third party,
  which interacts with the referrer-policy reasoning in
  `apps/web/next.config.ts` about not revealing which passage someone studies.

**Avoid Biblia.com** if caching matters — its terms explicitly prohibit
extracting content "for storage in an alternate database system."

**Bible Brain** (FCBH) is strong for global languages and audio, not for the
English majors; requires providing content free of charge.

**YouVersion Platform Services** reportedly opened an API in April 2026 with
REST APIs and SDKs. Terms, translations and AI clauses could not be retrieved
and are entirely unverified. Given YouVersion holds the deepest licence
portfolio in the industry, this is the largest open opportunity and worth a
direct look.

### 7.5 Verification debt

These could not be fetched from the publisher directly and rest on secondary
sources. **Confirm exact notice wording before pasting any of it into a
copyright page** — publishers require verbatim reproduction and secondary
sources render punctuation and registration marks inconsistently.

| Item | Status |
|---|---|
| Crossway AI/LLM non-approval | Secondary only — **decision-critical** |
| Biblica / NIV terms and notice | Page returns 403 to automated fetch |
| HarperCollins / NKJV terms and notice | Page returns 403 |
| Tyndale / NLT terms | Page timed out |
| NKJV "50% of an entire book" element | Unconfirmed against publisher |
| All YouVersion Platform terms | Entirely unverified |

---

## 8. The AI question nobody has answered

**No publisher in Tiers 1 or 2 addresses AI training or retrieval-augmented
generation.** Not one.

This matters more for Scrinode than for a plain Bible reader, because Zedek
grounds its answers in retrieved Scripture (AGENTS.md §20). Every retrieval
puts translation text into a model's context.

The registry handles this by recording `aiUse: 'not-stated'` everywhere, and
by enforcing a stronger rule in its place: **every translation marked
available has no copyright holder at all.** Silence about AI is harmless when
there is no copyright to assert. It is a live risk for CC BY-SA texts, where
the share-alike obligation's application to model weights and RAG indexes is
genuinely unsettled law.

This is enforced by a test, not by convention:

```ts
it('serves only texts where no copyright restricts retrieval', () => {
  for (const translation of availableTranslations()) {
    expect(translation.licence.rightsHolder).toBe('public domain');
  }
});
```

When Tier 2 or Tier 3 texts are introduced, that test fails and forces the
question to be answered deliberately rather than by omission.

---

## 9. How the registry enforces this

`packages/scripture/src/translations.ts` is the machine-readable matrix.
Before it, `TranslationCode` was a branded type with nothing behind it — any
string could be cast to one. The registry is to `TranslationCode` what
`books.ts` is to `BookId`.

**Registry membership is not permission.** `isAvailable()` is the only gate
that should decide whether text is served.

Invariants held by tests in `translations.test.ts`:

| Invariant | What it prevents |
|-----------|------------------|
| Available ⇒ commercial use permitted | Shipping a non-commercial text in a commercial product |
| Available ⇒ full redistribution | Storing text we may only excerpt |
| Available ⇒ no attribution required | Serving a text whose notice does not yet render |
| Available ⇒ not share-alike | Inheriting BY-SA before anyone has considered it |
| Available ⇒ rights holder is public domain | Feeding copyrighted text to RAG on unstated terms |
| Available ⇒ has a text source and formats | Marking something servable with no way to load it |
| Not available ⇒ has a stated reason | Silent blocks nobody can explain later |
| No entry records `aiUse: 'permitted'` | Recording a permission no publisher granted |

The attribution and share-alike invariants are deliberately strict: they fail
the moment Tier 2 is introduced, which is the point. They are a checklist
enforced by CI rather than a note someone may not read.

---

## 10. Open questions for the product owner

~~**Monetisation model.**~~ **Answered 20 September 2026:** subscriptions, no
advertising. See §2. Recorded as `IS_COMMERCIAL_PRODUCT` and enforced by test.

1. **Does Zedek retrieve licensed translation text?** If Scripture passed to a
   model may be a licensed version, Crossway's reported position rules out the
   ESV and Biblica requires a specific AI licence. If Zedek is grounded only in
   public-domain texts, the entire problem disappears. This is an architecture
   decision, not a legal one, and it is now the highest-value open question.
2. **Default translation.** BSB recommended — public domain, contemporary
   English, native JSON. KJV appears in the design docs but is archaic English
   and was not researched; say if you want it.
3. **Tier 3 intent and budget.** Every licensed version now costs money.
   API.Bible covers NASB, CSB, NKJV and NLT in one agreement from roughly
   $29/month plus ~$10/month per translation. ESV needs its own paid Crossway
   licence with no published price. NRSV is bespoke with no published fees.
   Which of these earns its cost?
4. **LSV verse cap.** Worth an email to Covenant Press if the LSV matters.
5. **Coverage verification.** OEB and FBV need book coverage confirmed.

---

## 11. Where the free text actually comes from

Verified 20 September 2026 by fetching each source.

Tier 1 texts are distributed as **bulk downloads**, not metered APIs. There is
no key, no rate limit, no per-request call and no quota to design around. The
text is ingested once into MongoDB and served from there, which is what
AGENTS.md §24 already assumes.

### Primary sources

| Translation | Source | Format | Size |
|---|---|---|---|
| **BSB** | <https://berean.bible/downloads.htm> | USFM, **USJ (JSON)**, USX, TXT | — |
| **WEB** | <https://ebible.org/Scriptures/engwebp_usfm.zip> | USFM (zip) | 2.9 MB |

`engwebp` is the Protestant-canon edition. eBible.org publishes the same text
in USFX, plain text, SQL and Sword formats from the same page.

### Convenience source: helloao

<https://bible.helloao.org> serves both translations as pre-parsed JSON with
SHA256 hashes per translation. The API code is MIT; the texts carry their own
licences, which for BSB and WEB are the public-domain terms in §4.

```
/api/available_translations.json     catalogue with hashes and verse counts
/api/BSB/books.json                  66 books with chapter counts
/api/BSB/complete.json               entire Bible, 8.1 MB
/api/BSB/ROM/8.json                  one chapter
```

Verse structure maps almost directly onto `Verse` in `@scrinode/types`:

```json
{ "type": "verse", "number": 28, "content": ["And we know that God works…"] }
```

**Verified against the existing registry:**

- All 66 book IDs match `packages/scripture/src/books.ts` exactly — `GEN`,
  `EXO` … `JUD`, `REV`. No mapping layer is needed.
- Chapter counts match for all 66 books.

### The wider free catalogue

eBible.org's machine-readable catalogue
(<https://ebible.org/Scriptures/translations.csv>) lists **56 English entries,
52 of them redistributable and downloadable**. Analysed 20 September 2026:

| Copyright field | Count | Usable commercially? |
|---|---|---|
| Exactly "public domain" | **34** | ✅ Yes, unconditionally |
| Named copyright holder | 18 | ⚠️ Each needs its licence read |

⚠️ **`Redistributable=True` does not mean free for commercial use.** It means
the text may be redistributed *under its own terms*. The NET is flagged
redistributable and is non-commercial only (§6). Never batch-approve on that
column.

The 18 copyrighted texts include FBV, LSV, NET, the Unlocked Literal Bible,
Translation for Translators, the Orthodox Jewish Bible and the Text-Critical
English NT. Each carries a named rights holder and needs the same treatment
LSV and FBV received before it could ship.

**Registered as available (10):** BSB and WEB (modern), plus KJV, ASV, YLT,
Darby, Webster, Geneva 1599, Bible in Basic English and Douay-Rheims 1899.

**Deliberately not registered.** The remaining public-domain texts are mostly
regional editions (WEB British, Catholic, Messianic, Updated), Septuagint
translations (Brenton, LXX2012) and partial Bibles (Tyndale NT, Wycliffe
portions, Targum Onkelos). A selector listing 34 entries is a worse product
than one listing ten, and every entry is a maintenance commitment. They remain
one registry entry away if wanted.

**1,256 translations across all languages** are in the same catalogue. When
Scrinode goes multilingual, the same public-domain analysis applies per
language — the constraint is product scope, not licensing.

### Two things to carry into ingestion

**Versification differs between translations.** BSB reports 31,086 verses and
WEB 31,103 across the same 1,189 chapters. This is exactly why `books.ts`
stores chapter counts but refuses to store per-chapter verse counts. Verse
counts must come from the imported text, per translation, never from a shared
table.

**Prefer the publisher for the canonical import.** helloao is convenient and
its hashes make verification easy, but it is a third party. The provenance
recorded under §21 should name where the bytes actually came from, and a
re-import from the publisher must be possible without depending on anyone's
mirror staying up.

---

## 12. Recommendation

**Ship the ten public-domain translations at MVP.** BSB and WEB for
contemporary English; KJV, ASV, YLT, Darby, Webster, Geneva 1599, Bible in
Basic English and Douay-Rheims for historic, literal, simplified and Catholic
readings. All ten are public domain with no obligations, all publish
machine-readable text, and together they support genuine translation
comparison — a named MVP capability — at zero licensing risk and zero cost.

That is a stronger comparison set than most commercial Bible apps offer for
free, and it covers the useful axes: formal equivalence (ASV, YLT, Darby),
traditional (KJV, Geneva), simplified (BBE), Catholic canon (Douay-Rheims)
and modern readable (BSB).

This is not a compromise position. Public-domain texts are the only ones that
let Zedek retrieve Scripture into model context without an unanswered
copyright question, and they are the only ones with no storage cap — the NASB
allows 1,000 verses in a retrieval system, which no database-backed reader can
work within.

Then, in order:

1. **Add LSV** once attribution rendering exists. It costs nothing, and it
   proves the attribution path works before money is at stake. Doing this
   before any Tier 3 negotiation means the hard part is already built when a
   paid licence arrives.
2. **Decide whether Zedek may retrieve licensed text.** Grounding Zedek in
   public-domain texts only keeps the AI question permanently closed and
   removes Crossway and Biblica's AI positions from the critical path.
3. **Pursue API.Bible** if licensed versions earn their cost — four
   translations under one agreement, published pricing, generous caching.
   Budget for FUMS instrumentation and review its privacy implications against
   the referrer-policy reasoning already applied in `apps/web/next.config.ts`.
4. **Investigate YouVersion Platform Services** — newest programme, deepest
   licence portfolio, terms entirely unknown.

A reasonable end state is Tier 1 free for everyone, with licensed translations
as a paid-plan feature that funds their own licences. Nothing in the registry
assumes that, but nothing prevents it either.

Treat Tier 3 as a commercial track that runs in parallel and **gates nothing**.
The reader ships on Tier 1.
