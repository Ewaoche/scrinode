import { Logger } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { loadEnv } from '../config/env.config';
import { MigrationRunner } from './migration.runner';
import { MIGRATIONS } from './migrations';

/**
 * Migration CLI.
 *
 *   pnpm --filter @scrinode/api migrate          apply pending
 *   pnpm --filter @scrinode/api migrate:status   show state
 *   pnpm --filter @scrinode/api migrate:down     revert the most recent
 *
 * Run as a deliberate, separate step — never automatically on application
 * boot. Scrinode is production-first: a schema change must be an intentional
 * act, not a side effect of a deploy or an autoscaling event that starts
 * several instances at once.
 */
type Command = 'up' | 'down' | 'status';

const COMMANDS: readonly Command[] = ['up', 'down', 'status'];

function parseCommand(argv: readonly string[]): Command {
  const raw = argv[2];

  if (raw === undefined) {
    return 'status';
  }

  if (!COMMANDS.includes(raw as Command)) {
    throw new Error(`Unknown command "${raw}". Expected one of: ${COMMANDS.join(', ')}`);
  }

  return raw as Command;
}

async function main(): Promise<void> {
  const logger = new Logger('Migrate');
  const command = parseCommand(process.argv);
  const env = loadEnv();

  const client = new MongoClient(env.MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(env.MONGODB_DB);
    const runner = new MigrationRunner(db, MIGRATIONS);

    // Name the target so an accidental run against the wrong database is
    // visible in the log.
    logger.log(`Database: ${env.MONGODB_DB} (${env.NODE_ENV})`);

    if (command === 'status') {
      const { applied, pending } = await runner.status();

      logger.log(`Applied: ${applied.length}`);
      for (const record of applied) {
        logger.log(`  ✓ ${record.version} ${record.name} — ${record.appliedAt.toISOString()}`);
      }

      logger.log(`Pending: ${pending.length}`);
      for (const migration of pending) {
        logger.log(`  · ${migration.version} ${migration.name}`);
      }

      return;
    }

    if (command === 'up') {
      const applied = await runner.up();
      logger.log(`Applied ${applied.length} migration(s)`);
      return;
    }

    const reverted = await runner.down();
    logger.log(reverted ? `Reverted ${reverted.version} ${reverted.name}` : 'Nothing to revert');
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  const logger = new Logger('Migrate');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
