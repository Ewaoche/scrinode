import type { Collection, Db, Document, Filter, FindOptions, OptionalUnlessRequiredId } from 'mongodb';

/**
 * Base for collection repositories.
 *
 * AGENTS.md §8: domain services must not import the MongoDB driver directly.
 * Repositories are the only place driver types appear, which keeps the data
 * layer replaceable and the domain expressed in domain terms.
 *
 * Subclasses expose domain-shaped methods (`findByReference`, not `find`).
 * The protected helpers here exist to serve those methods, not to be called
 * from outside.
 */
export abstract class BaseRepository<TDocument extends Document> {
  protected constructor(
    protected readonly db: Db,
    private readonly collectionName: string,
  ) {}

  protected get collection(): Collection<TDocument> {
    return this.db.collection<TDocument>(this.collectionName);
  }

  protected async findOne(
    filter: Filter<TDocument>,
    options?: FindOptions,
  ): Promise<TDocument | null> {
    return this.collection.findOne(filter, options) as Promise<TDocument | null>;
  }

  protected async findMany(
    filter: Filter<TDocument>,
    options?: FindOptions,
  ): Promise<TDocument[]> {
    return this.collection.find(filter, options).toArray() as Promise<TDocument[]>;
  }

  protected async insertOne(document: OptionalUnlessRequiredId<TDocument>): Promise<void> {
    await this.collection.insertOne(document);
  }

  protected async count(filter: Filter<TDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter);
  }
}
