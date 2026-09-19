import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Verifies the Auth.js MongoDB adapter against the driver Scrinode actually
 * uses.
 *
 * @auth/mongodb-adapter declares a peer dependency on mongodb ^6 while the
 * workspace runs ^7. Rather than assume the mismatch is harmless, these tests
 * exercise the adapter's real operations against a real MongoDB 7 server. If
 * the versions are genuinely incompatible, this fails here rather than on a
 * user's first sign-in.
 */
describe('Auth.js MongoDB adapter on the mongodb 7 driver', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let adapter: ReturnType<typeof MongoDBAdapter>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();

    adapter = MongoDBAdapter(Promise.resolve(client), { databaseName: 'auth_test' });
  }, 120_000);

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  it('creates and reads a user', async () => {
    const created = await adapter.createUser!({
      id: '',
      email: 'reader@scrinode.com',
      emailVerified: null,
    });

    expect(created.email).toBe('reader@scrinode.com');

    const fetched = await adapter.getUser!(created.id);
    expect(fetched?.email).toBe('reader@scrinode.com');
  });

  it('finds a user by email', async () => {
    await adapter.createUser!({
      id: '',
      email: 'byemail@scrinode.com',
      emailVerified: null,
    });

    const found = await adapter.getUserByEmail!('byemail@scrinode.com');
    expect(found?.email).toBe('byemail@scrinode.com');
  });

  it('returns null for an unknown email', async () => {
    expect(await adapter.getUserByEmail!('nobody@scrinode.com')).toBeNull();
  });

  it('links an OAuth account and finds the user by it', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'google@scrinode.com',
      emailVerified: null,
    });

    await adapter.linkAccount!({
      userId: user.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: 'google-123',
    });

    const found = await adapter.getUserByAccount!({
      provider: 'google',
      providerAccountId: 'google-123',
    });

    expect(found?.id).toBe(user.id);
  });

  it('creates a session and resolves it back to its user', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'session@scrinode.com',
      emailVerified: null,
    });

    const expires = new Date(Date.now() + 60_000);
    await adapter.createSession!({
      sessionToken: 'token-abc',
      userId: user.id,
      expires,
    });

    const result = await adapter.getSessionAndUser!('token-abc');

    expect(result?.user.id).toBe(user.id);
    expect(result?.session.sessionToken).toBe('token-abc');
  });

  it('deletes a session', async () => {
    const user = await adapter.createUser!({
      id: '',
      email: 'signout@scrinode.com',
      emailVerified: null,
    });

    await adapter.createSession!({
      sessionToken: 'token-del',
      userId: user.id,
      expires: new Date(Date.now() + 60_000),
    });

    await adapter.deleteSession!('token-del');

    expect(await adapter.getSessionAndUser!('token-del')).toBeNull();
  });

  it('stores and consumes a verification token exactly once', async () => {
    const expires = new Date(Date.now() + 60_000);

    await adapter.createVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
      expires,
    });

    const used = await adapter.useVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
    });

    expect(used?.identifier).toBe('magic@scrinode.com');

    // A magic link must not be replayable.
    const reused = await adapter.useVerificationToken!({
      identifier: 'magic@scrinode.com',
      token: 'magic-token',
    });

    expect(reused).toBeNull();
  });
});
