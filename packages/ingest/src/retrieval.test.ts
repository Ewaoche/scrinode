import { describe, expect, it } from 'vitest';
import {
  DERIVABLE_UNIT_TYPES,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  PASSAGE_STRIDE,
  PASSAGE_WINDOW,
  PENDING_UNIT_TYPES,
  UNIT_COLUMNS,
  distanceToScore,
  toVectorLiteral,
} from './retrieval.js';

describe('embedding model', () => {
  it('pins the dimensions the model actually produces', () => {
    // voyage-4 defaults to 1024. A mismatch between this and the halfvec
    // column's width is not a test failure but an insert Postgres rejects
    // with an error naming the column rather than the cause.
    expect(EMBEDDING_MODEL).toBe('voyage-4');
    expect(EMBEDDING_DIMENSIONS).toBe(1024);
  });
});

describe('unit types', () => {
  it('separates what can be derived from what needs new sources', () => {
    // §20 lists nine types. Building the six pending ones without source
    // data would mean inventing Bible data, which directive 2 forbids.
    expect(DERIVABLE_UNIT_TYPES).toEqual(['verse', 'passage', 'chapter']);
    expect(PENDING_UNIT_TYPES).toHaveLength(6);
  });

  it('covers all nine types §20 names', () => {
    expect(DERIVABLE_UNIT_TYPES.length + PENDING_UNIT_TYPES.length).toBe(9);
  });

  it('never lists a type as both derivable and pending', () => {
    const overlap = DERIVABLE_UNIT_TYPES.filter((t) => PENDING_UNIT_TYPES.includes(t));
    expect(overlap).toEqual([]);
  });
});

describe('passage windows', () => {
  it('overlaps so a passage spanning a boundary stays retrievable', () => {
    // Stride below window size is what creates the overlap. Equal values
    // would tile the text and split arguments across units.
    expect(PASSAGE_STRIDE).toBeLessThan(PASSAGE_WINDOW);
  });

  it('keeps windows small enough for a hit to point somewhere specific', () => {
    expect(PASSAGE_WINDOW).toBeGreaterThan(1);
    expect(PASSAGE_WINDOW).toBeLessThanOrEqual(12);
  });
});

describe('column mapping', () => {
  const columns = Object.values(UNIT_COLUMNS);

  it('maps every field of the interface', () => {
    // `satisfies Record<keyof RetrievalUnit, string>` enforces this at
    // compile time; asserting it here means a loosened type still fails.
    expect(Object.keys(UNIT_COLUMNS)).toContain('embedding');
    expect(Object.keys(UNIT_COLUMNS)).toContain('unitType');
  });

  it('uses snake_case, which Postgres folds unquoted identifiers to', () => {
    // A quoted "camelCase" column must be quoted in every query thereafter,
    // and the first one forgotten is a runtime error.
    for (const column of columns) {
      expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('maps the filters a search narrows on', () => {
    // Without translation, a search for "God's love" returns the same verse
    // once for every loaded translation. The rest scope a question to a
    // book, a testament, or a canon a reader's tradition includes.
    expect(UNIT_COLUMNS.translation).toBe('translation');
    expect(UNIT_COLUMNS.unitType).toBe('unit_type');
    expect(UNIT_COLUMNS.bookId).toBe('book_id');
    expect(UNIT_COLUMNS.testament).toBe('testament');
    expect(UNIT_COLUMNS.canon).toBe('canon');
    // So a model change can be migrated without touching current vectors.
    expect(UNIT_COLUMNS.embeddingModel).toBe('embedding_model');
  });

  it('maps the identity column to the primary key', () => {
    expect(UNIT_COLUMNS._id).toBe('id');
  });
});

describe('toVectorLiteral', () => {
  const vector = (n: number) => Array.from({ length: n }, () => 0.5);

  it('formats a vector the way pgvector parses it', () => {
    // Bracketed and comma-separated, with no spaces. Built at full width
    // because the dimension check runs before formatting.
    const literal = toVectorLiteral(vector(EMBEDDING_DIMENSIONS));

    expect(literal.startsWith('[0.5,0.5')).toBe(true);
    expect(literal.endsWith(']')).toBe(true);
    expect(literal.slice(1, -1).split(',')).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('accepts a vector of exactly the declared width', () => {
    expect(() => toVectorLiteral(vector(EMBEDDING_DIMENSIONS))).not.toThrow();
  });

  it('rejects a short vector, naming the real cause', () => {
    // Postgres would reject this too, but with an error about the column
    // rather than about the model that produced the wrong width.
    expect(() => toVectorLiteral(vector(512))).toThrow(/Expected 1024 dimensions/);
  });

  it('rejects a long vector', () => {
    expect(() => toVectorLiteral(vector(2048))).toThrow(/Expected 1024 dimensions/);
  });

  it('rejects an empty vector', () => {
    expect(() => toVectorLiteral([])).toThrow(/Expected 1024 dimensions/);
  });
});

describe('distanceToScore', () => {
  it('maps an identical vector to 1', () => {
    // pgvector returns cosine *distance*, where 0 is identical; Atlas
    // returned similarity, where 1 is. Measured score thresholds are in
    // similarity, so the conversion keeps them meaning what they did.
    expect(distanceToScore(0)).toBe(1);
  });

  it('maps an orthogonal vector to 0', () => {
    expect(distanceToScore(1)).toBe(0);
  });

  it('preserves ordering, so the best hit still ranks first', () => {
    // Getting this backwards does not fail — it silently ranks the least
    // relevant result first.
    const near = distanceToScore(0.2);
    const far = distanceToScore(0.4);

    expect(near).toBeGreaterThan(far);
  });

  it('puts a measured relevant hit above the documented floor', () => {
    // Relevant hits measured 0.74-0.85 similarity, so a distance of 0.25
    // must land above LIKELY_RELEVANT_SCORE (0.68).
    expect(distanceToScore(0.25)).toBeGreaterThan(0.68);
  });

  it('puts a measured irrelevant hit below it', () => {
    // Deliberately unrelated questions measured 0.62-0.64.
    expect(distanceToScore(0.37)).toBeLessThan(0.68);
  });
});
