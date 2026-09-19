/** Injection tokens for the MongoDB client and database handle. */
export const MONGO_CLIENT = Symbol('MONGO_CLIENT');
export const MONGO_DB = Symbol('MONGO_DB');

/** Collection holding applied migration records. */
export const MIGRATIONS_COLLECTION = 'migrations';
