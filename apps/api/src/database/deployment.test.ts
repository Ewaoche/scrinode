import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the droplet deployment's safety properties.
 *
 * The API runs beside Postgres so the database needs no public port. That
 * only holds while the compose file keeps it that way, and each of these is
 * a one-line edit away from being undone — silently, because the stack would
 * still start and still work.
 *
 * Asserted against the file rather than a running stack: these must fail in
 * CI, where no droplet exists.
 */
describe('production deployment', () => {
  const root = join(__dirname, '../../../..');

  const prod = readFileSync(join(root, 'docker-compose.prod.yml'), 'utf8');
  const dev = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
  const dockerfile = readFileSync(join(root, 'infra/api/Dockerfile'), 'utf8');

  describe('database exposure', () => {
    it('publishes no database port', () => {
      // The reason the API moved to the droplet. A published 5432 would put
      // the database on the public internet, where DATABASE_SSL=false —
      // correct for a compose network — becomes a credential in cleartext.
      const postgresBlock = prod.slice(
        prod.indexOf('postgres:'),
        prod.indexOf('  api:'),
      );

      expect(postgresBlock).not.toMatch(/^\s+ports:/m);
      expect(postgresBlock).toMatch(/^\s+expose:/m);
    });

    it('binds the API to localhost, not every interface', () => {
      // A reverse proxy terminates TLS in front of it. Publishing 4000
      // openly would serve the API over plain HTTP.
      expect(prod).toContain("'127.0.0.1:${API_PORT:-4000}:4000'");
    });
  });

  describe('credentials', () => {
    it('gives the production password no default', () => {
      // `:?` fails the stack when unset. A default would mean a production
      // database accepting a password written down in this repository.
      expect(prod).toContain('POSTGRES_PASSWORD:?');
    });

    it('requires an explicit CORS allow-list', () => {
      // The API serves credentialed requests; §33 rejects a wildcard.
      expect(prod).toContain('CORS_ORIGINS:?');
      expect(prod).not.toMatch(/CORS_ORIGINS:\s*['"]?\*/);
    });

    it('composes DATABASE_URL from the Postgres variables', () => {
      // Set separately, the API and the database could disagree about the
      // credentials — and the failure would look like a bad password.
      expect(prod).toContain('DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/');
    });
  });

  describe('development compose stays development', () => {
    it('keeps its published port', () => {
      // Local work needs psql and the test harness to reach the database.
      expect(dev).toMatch(/127\.0\.0\.1:\$\{POSTGRES_PORT:-5432\}:5432/);
    });

    it('is a separate file, not an override of production', () => {
      // An override you can forget to pass is not a safe way to express the
      // difference between a dev default and a production requirement.
      expect(dev).not.toContain('POSTGRES_PASSWORD:?');
    });
  });

  describe('API image', () => {
    it('runs as an unprivileged user', () => {
      expect(dockerfile).toContain('USER node');
    });

    it('passes --legacy to pnpm deploy', () => {
      // Without it, pnpm 10+ refuses the workspace and produces a tree with
      // no node_modules while exiting 0 — a failure that surfaces only when
      // the container starts.
      expect(dockerfile).toContain('--legacy deploy');
    });

    it('installs with a frozen lockfile', () => {
      // An image must not be buildable from an unrecorded dependency change.
      expect(dockerfile).toContain('--frozen-lockfile');
    });

    it('healthchecks readiness, which exercises the database', () => {
      // Liveness alone would report a healthy process that cannot reach
      // Postgres.
      expect(dockerfile).toContain('/health/ready');
    });
  });

  describe('API bootstrap', () => {
    const main = readFileSync(join(root, 'apps/api/src/main.ts'), 'utf8');

    it('binds to every interface', () => {
      // Node may bind to loopback without an explicit host, and inside a
      // container that means nothing can reach it — including the
      // healthcheck and the proxy.
      expect(main).toContain("app.listen(env.API_PORT, '0.0.0.0')");
    });

    it('enables shutdown hooks', () => {
      // Nest ignores SIGTERM without this, so a redeploy kills in-flight
      // requests and leaves Postgres holding connections.
      expect(main).toContain('app.enableShutdownHooks()');
    });
  });
});
