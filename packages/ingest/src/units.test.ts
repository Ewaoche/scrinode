import { Binary } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { buildChapterUnits, needsEmbedding, textHash, type VerseInput } from './units.js';
import { EMBEDDING_MODEL, PASSAGE_WINDOW } from './retrieval.js';

const verse = (n: number, text: string): VerseInput => ({
  _id: `BSB:ROM.8.${n}`,
  bookId: 'ROM',
  chapter: 8,
  verse: n,
  text,
  ordinal: 45_008_000 + n,
  canon: 'protestant',
});

const context = {
  translation: 'BSB',
  release: '2026-08-08',
  canon: 'protestant' as const,
  sourceId: 'ebible:engbsb',
};

const chapter = (count: number): VerseInput[] =>
  Array.from({ length: count }, (_, i) => verse(i + 1, `Verse ${i + 1} text.`));

describe('buildChapterUnits', () => {
  it('produces a verse unit for every verse', () => {
    const units = buildChapterUnits(chapter(10), context);
    expect(units.filter((u) => u.unitType === 'verse')).toHaveLength(10);
  });

  it('produces exactly one chapter unit', () => {
    const units = buildChapterUnits(chapter(10), context);
    expect(units.filter((u) => u.unitType === 'chapter')).toHaveLength(1);
  });

  it('gives units deterministic ids so rebuilding is idempotent', () => {
    const first = buildChapterUnits(chapter(10), context).map((u) => u._id);
    const again = buildChapterUnits(chapter(10), context).map((u) => u._id);
    expect(first).toEqual(again);
    expect(new Set(first).size).toBe(first.length);
  });

  it('records reference bounds structurally', () => {
    const units = buildChapterUnits(chapter(10), context);
    const chapterUnit = units.find((u) => u.unitType === 'chapter');

    expect(chapterUnit?.referenceStart).toBe('ROM.8.1');
    expect(chapterUnit?.referenceEnd).toBe('ROM.8.10');
  });

  it('joins verse text without injecting verse markers', () => {
    // Injected numbers would be embedded as tokens and dilute the semantic
    // signal; the bounds are already recorded structurally.
    const units = buildChapterUnits(
      [verse(1, 'Grace to you.'), verse(2, 'And peace.')],
      context,
    );
    const chapterUnit = units.find((u) => u.unitType === 'chapter');

    expect(chapterUnit?.text).toBe('Grace to you. And peace.');
  });

  it('links each unit back to the verses it covers', () => {
    const units = buildChapterUnits(chapter(10), context);
    const chapterUnit = units.find((u) => u.unitType === 'chapter');
    expect(chapterUnit?.verseIds).toHaveLength(10);
    expect(chapterUnit?.verseIds?.[0]).toBe('BSB:ROM.8.1');
  });

  it('carries provenance onto every unit', () => {
    for (const unit of buildChapterUnits(chapter(10), context)) {
      expect(unit.sourceId).toBe('ebible:engbsb');
      expect(unit.release).toBe('2026-08-08');
      expect(unit.canon).toBe('protestant');
      expect(unit.testament).toBe('NT');
    }
  });

  it('hashes text so an edit is detectable without comparing vectors', () => {
    const units = buildChapterUnits(chapter(10), context);
    for (const unit of units) {
      expect(unit.textHash).toBe(textHash(unit.text));
    }
  });

  it('carries no vector — embedding is a separate, paid stage', () => {
    for (const unit of buildChapterUnits(chapter(10), context)) {
      expect(unit.embedding).toBeUndefined();
    }
  });
});

describe('passage windows', () => {
  it('overlaps so an argument spanning a boundary stays retrievable whole', () => {
    const units = buildChapterUnits(chapter(20), context);
    const passages = units.filter((u) => u.unitType === 'passage');

    expect(passages.length).toBeGreaterThan(1);

    // Consecutive windows must share verses, or a boundary could split an
    // argument in a way no single unit recovers.
    const first = new Set(passages[0]?.verseIds ?? []);
    const second = passages[1]?.verseIds ?? [];
    expect(second.some((id) => first.has(id))).toBe(true);
  });

  it('covers every verse in at least one passage', () => {
    const units = buildChapterUnits(chapter(20), context);
    const covered = new Set(
      units.filter((u) => u.unitType === 'passage').flatMap((u) => u.verseIds ?? []),
    );
    expect(covered.size).toBe(20);
  });

  it('skips passages for a chapter no longer than one window', () => {
    // A passage would duplicate the chapter unit exactly.
    const units = buildChapterUnits(chapter(PASSAGE_WINDOW), context);
    expect(units.filter((u) => u.unitType === 'passage')).toHaveLength(0);
  });

  it('never spans a chapter boundary', () => {
    const units = buildChapterUnits(chapter(20), context);
    for (const unit of units) {
      expect(unit.referenceStart?.split('.')[1]).toBe(unit.referenceEnd?.split('.')[1]);
    }
  });
});

describe('edge cases', () => {
  it('returns nothing for an empty chapter', () => {
    expect(buildChapterUnits([], context)).toEqual([]);
  });

  it('handles a single-verse chapter', () => {
    const units = buildChapterUnits([verse(1, 'The only verse.')], context);
    expect(units.map((u) => u.unitType)).toEqual(['verse', 'chapter']);
  });

  it('sorts by ordinal regardless of input order', () => {
    const shuffled = [verse(3, 'Third.'), verse(1, 'First.'), verse(2, 'Second.')];
    const chapterUnit = buildChapterUnits(shuffled, context).find(
      (u) => u.unitType === 'chapter',
    );
    expect(chapterUnit?.text).toBe('First. Second. Third.');
  });

  it('skips verses whose text is empty', () => {
    const units = buildChapterUnits([verse(1, 'Real.'), verse(2, '   ')], context);
    expect(units.filter((u) => u.unitType === 'verse')).toHaveLength(1);
  });
});

describe('needsEmbedding', () => {
  // Vectors are stored as BSON BinData rather than arrays of numbers; see
  // the comment on RetrievalUnit.embedding for why.
  const vector = Binary.fromFloat32Array(new Float32Array([0.1, 0.2]));

  const embedded = {
    text: 'Some text.',
    embedding: vector,
    embeddingModel: EMBEDDING_MODEL,
    textHash: textHash('Some text.'),
  };

  it('embeds a unit that has no vector', () => {
    expect(needsEmbedding({ text: 'x' }, EMBEDDING_MODEL)).toBe(true);
  });

  it('skips a unit whose vector is current', () => {
    // The whole point: embedding costs money per token.
    expect(needsEmbedding(embedded, EMBEDDING_MODEL)).toBe(false);
  });

  it('re-embeds when the model changed', () => {
    expect(needsEmbedding(embedded, 'voyage-5')).toBe(true);
  });

  it('re-embeds when the text changed', () => {
    expect(needsEmbedding({ ...embedded, text: 'Different text.' }, EMBEDDING_MODEL)).toBe(true);
  });

  it('re-embeds an empty vector', () => {
    const empty = Binary.fromFloat32Array(new Float32Array([]));
    expect(needsEmbedding({ ...embedded, embedding: empty }, EMBEDDING_MODEL)).toBe(true);
  });
});
