/** Injection token for the PostgreSQL connection pool. */
export const PG_POOL = Symbol('PG_POOL');

/** Table holding applied migration records. */
export const MIGRATIONS_TABLE = 'schema_migrations';
