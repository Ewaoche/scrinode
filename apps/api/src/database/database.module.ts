import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import { MONGO_CLIENT, MONGO_DB } from './database.constants';
import { DatabaseHealthIndicator } from './database.health';

/**
 * MongoDB connection.
 *
 * Scrinode uses the native driver rather than an ORM (see
 * docs/PLAN_stage1_scaffold.md §2.1): Prisma's MongoDB connector cannot run
 * $vectorSearch, which Zedek's retrieval strategy depends on (AGENTS.md §19).
 *
 * One pooled client per process. Repositories wrap collections; domain
 * services must never import the driver directly (AGENTS.md §8).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const uri = config.getOrThrow<string>('MONGODB_URI');

        const client = new MongoClient(uri, {
          // Fail fast rather than hanging a request behind a dead connection.
          serverSelectionTimeoutMS: 10_000,
          retryWrites: true,
        });

        await client.connect();
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MONGO_CLIENT, ConfigService],
      useFactory: (client: MongoClient, config: ConfigService) =>
        client.db(config.getOrThrow<string>('MONGODB_DB')),
    },
    DatabaseHealthIndicator,
  ],
  exports: [MONGO_CLIENT, MONGO_DB, DatabaseHealthIndicator],
})
export class DatabaseModule {}
