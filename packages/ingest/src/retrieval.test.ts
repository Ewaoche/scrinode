import { describe, expect, it } from 'vitest';
import {
  DERIVABLE_UNIT_TYPES,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  PASSAGE_STRIDE,
  PASSAGE_WINDOW,
  PENDING_UNIT_TYPES,
  vectorIndexDefinition,
} from './retrieval.js';

describe('embedding model', () => {
  it('pins the dimensions voyage-3 actually produces', () => {
    // voyage-3 is fixed at 1024 and does not support Matryoshka reduction.
    // A mismatch here is not a test failure but a silent index that rejects
    // every insert.
    expect(EMBEDDING_MODEL).toBe('voyage-3');
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

describe('vectorIndexDefinition', () => {
  const definition = vectorIndexDefinition() as {
    fields: { type: string; path: string; numDimensions?: number; similarity?: string }[];
  };

  const vector = definition.fields.find((f) => f.type === 'vector');
  const filters = definition.fields.filter((f) => f.type === 'filter').map((f) => f.path);

  it('declares dimensions matching the model', () => {
    // Generated rather than hand-written precisely so these cannot drift.
    expect(vector?.numDimensions).toBe(EMBEDDING_DIMENSIONS);
  });

  it('embeds on the field the documents carry', () => {
    expect(vector?.path).toBe('embedding');
  });

  it('uses a similarity Atlas accepts', () => {
    expect(['cosine', 'dotProduct', 'euclidean']).toContain(vector?.similarity);
  });

  it('filters on translation, without which results repeat per translation', () => {
    // The single most important filter: a search for "God's love" would
    // otherwise return the same verse once for every loaded translation.
    expect(filters).toContain('translation');
  });

  it('filters on unit type, so passages can be retrieved without verse noise', () => {
    expect(filters).toContain('unitType');
  });

  it('filters on canon, so deuterocanon can be suppressed', () => {
    expect(filters).toContain('canon');
  });

  it('filters on embedding model, so a model change can be migrated', () => {
    expect(filters).toContain('embeddingModel');
  });

  it('declares every filter up front', () => {
    // Atlas requires filter fields at index creation; adding one later means
    // a rebuild. This asserts the set is deliberate rather than incidental.
    expect(filters.sort()).toEqual(
      ['bookId', 'canon', 'embeddingModel', 'testament', 'translation', 'unitType'].sort(),
    );
  });
});
