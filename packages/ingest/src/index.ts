/**
 * @scrinode/ingest — Bible source acquisition and loading.
 *
 * Downloads publisher archives, parses USFM, stages to object storage and
 * loads verse documents into MongoDB. Kept out of apps/api so the API
 * runtime never carries USFM parsing or an S3 client.
 */

export {
  extractStrongs,
  parseUsfm,
  stripMarkup,
  type ParsedBook,
  type ParsedVerse,
} from './usfm.js';

export {
  BIBLE_PREFIX,
  assertValidRelease,
  latestPointerPath,
  releasePaths,
  type LatestPointer,
  type Manifest,
  type ManifestBook,
  type Release,
  type ReleasePaths,
} from './layout.js';

export {
  COLLECTIONS,
  VERSE_INDEXES,
  canonicalRef,
  verseDocumentId,
  verseOrdinal,
  type TranslationDocument,
  type VerseDocument,
} from './documents.js';

export {
  bookCodeFromFilename,
  buildManifest,
  processArchive,
  releaseNotes,
  sha256,
  toVerseDocuments,
  validateRelease,
  type ArchiveEntry,
  type BookResult,
  type ManifestInput,
  type ProcessResult,
} from './pipeline.js';

export {
  LEDGER_COLLECTION,
  isUpToDate,
  reasonToRun,
  runId,
  type IngestRun,
  type IngestStage,
  type RunStatus,
} from './ledger.js';

export {
  DERIVABLE_UNIT_TYPES,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  PASSAGE_STRIDE,
  PASSAGE_WINDOW,
  PENDING_UNIT_TYPES,
  RETRIEVAL_COLLECTION,
  VECTOR_INDEX_NAME,
  vectorIndexDefinition,
  type RetrievalUnit,
  type RetrievalUnitType,
} from './retrieval.js';

export {
  buildChapterUnits,
  needsEmbedding,
  textHash,
  type VerseInput,
} from './units.js';

export {
  EMBED_BATCH_SIZE,
  VoyageError,
  batched,
  embedBatch,
  type EmbeddingResult,
  type InputType,
  type VoyageOptions,
} from './voyage.js';
