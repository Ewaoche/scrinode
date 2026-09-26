import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the deployment's safety properties.
 *
 * The API runs on Vercel as a serverless function; the database is Neon,
 * reached across the public internet. Both halves of that moved the risk, and
 * these assert what is now worth guarding rather than what used to be:
 *
 *   - there is no container to leave a database port published on, but there
 *     *is* a credential crossing a network, so TLS is mandatory
 *   - there are now two entry points, and the §33 security baseline must be
 *     applied by both. A handler that forgets helmet fails no other test.
 *
 * Asserted against files rather than a running deployment: these must fail in
 * CI, where nothing is deployed.
 */
describe('deployment', () => {
  const root = join(__dirname, '../../../..');
  const read = (path: string) => readFileSync(join(root, path), 'utf8');

  const factory = read('apps/api/src/app.factory.ts');
  const handler = read('apps/api/api/index.ts');
  const main = read('apps/api/src/main.ts');

  describe('one security baseline, two entry points', () => {
    it('keeps the §33 baseline in the shared factory', () => {
      // Each of these is one line, and a second entry point that copies them
      // is one that will eventually copy three of four.
      expect(factory).toContain('helmet(');
      expect(factory).toContain('enableCors(');
      expect(factory).toContain("useBodyParser('json', { limit: '1mb' })");
      expect(factory).toContain("disable('x-powered-by')");
    });

    it('has both entry points use the factory rather than configuring their own', () => {
      // Assert the *import*, not a mention: a file that merely names createApp
      // in a comment would satisfy a substring check while calling
      // NestFactory itself. Verified by deleting the import, which must fail
      // this test.
      // Matched per line. A regex over the whole file cannot use [^}] to stay
      // inside one import statement, because the imports above it also contain
      // braces — which is why the first version of this passed regardless.
      const importsFactory = (source: string) =>
        source
          .split('\n')
          .some((line) => /^import\s*\{[^}]*createApp/.test(line) && line.includes('app.factory'));

      expect(importsFactory(handler)).toBe(true);
      expect(importsFactory(main)).toBe(true);

      // If an entry point calls NestFactory directly it has its own app, and
      // whatever the factory applies does not reach it.
      expect(handler).not.toContain('NestFactory.create');
      expect(main).not.toContain('NestFactory.create');
    });

    it('rejects a wildcard CORS origin', () => {
      // The API serves credentialed requests; §33 rejects '*'.
      expect(factory).not.toMatch(/origin:\s*['"]\*['"]/);
      expect(factory).toContain('origin: env.CORS_ORIGINS');
    });
  });

  describe('serverless handler', () => {
    it('caches the app across warm invocations', () => {
      // Without this every request rebuilds Nest, which on a function means
      // paying bootstrap per request.
      expect(handler).toMatch(/cached \?\?=|cached =/);
    });

    it('does not listen on a port', () => {
      // Vercel owns the socket. A listen() here would bind inside a function
      // and never receive traffic.
      expect(handler).not.toMatch(/\.listen\(/);
    });

    it('does not register shutdown hooks', () => {
      // A function is frozen between invocations rather than signalled, so
      // SIGTERM never arrives; registering hooks implies a guarantee that does
      // not hold, and the pool is managed by PgBouncer instead.
      // Matches a call, not the comment explaining its absence.
      expect(handler).not.toMatch(/\.enableShutdownHooks\(/);
    });
  });

  describe('the server entry point stays usable', () => {
    it('still binds every interface and handles shutdown', () => {
      // main.ts remains for local development and any container deployment.
      // Keeping it working is what stops Vercel becoming a one-way door (§30
      // requires NestJS stay cloud-portable).
      expect(main).toContain("app.listen(env.API_PORT, '0.0.0.0')");
      expect(main).toContain('app.enableShutdownHooks()');
    });
  });

  describe('database connection', () => {
    it('documents that Vercel needs the pooled Neon host', () => {
      // A serverless function neither shares a pool nor closes connections on
      // our schedule, so direct connections accumulate until Neon refuses
      // them. This is the single easiest thing to get wrong here.
      const example = read('.env.example');

      expect(example).toContain('-pooler');
      expect(example).toMatch(/DATABASE_SSL="?(false|true)"?/);
    });

    it('warns that migrations need a direct connection', () => {
      // withLock holds an advisory lock on one client while the migration runs
      // on another. Transaction pooling does not keep the holding session
      // pinned, so the lock can lapse and two deploys can migrate at once.
      const runner = read('apps/api/src/database/migration.runner.ts');

      expect(runner).toMatch(/direct connection, never a PgBouncer pooled/);
    });
  });

  describe('no stale droplet configuration', () => {
    it('has no production compose file claiming to run the API', () => {
      // If docker-compose.prod.yml survives, it describes a deployment that no
      // longer happens — and someone will eventually run it.
      const prod = join(root, 'docker-compose.prod.yml');

      if (existsSync(prod)) {
        const contents = readFileSync(prod, 'utf8');
        expect(contents).toMatch(/superseded|not used|historical|Vercel/i);
      }
    });
  });
});
