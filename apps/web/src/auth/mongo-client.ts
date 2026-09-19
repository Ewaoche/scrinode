import { MongoClient } from 'mongodb';

/**
 * MongoDB client for the Auth.js adapter.
 *
 * Connection is deferred until first use rather than established at import.
 * `next build` evaluates route modules without runtime environment present,
 * so connecting at module scope would fail the build — and would attach a
 * configuration error to the build rather than to the deployment that is
 * actually misconfigured.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a
 * new pool on every reload until the server exhausts them. The promise is
 * cached on globalThis so development reuses one pool.
 */
declare global {
  var _scrinodeMongoClient: Promise<MongoClient> | undefined;
}

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is required for authentication');
  }

  return new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 }).connect();
}

let cached: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  // One pool per process in production; one pool across hot reloads in
  // development, where module scope is discarded but globalThis survives.
  if (process.env.NODE_ENV === 'production') {
    return (cached ??= connect());
  }

  return (globalThis._scrinodeMongoClient ??= connect());
}
