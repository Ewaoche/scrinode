import { spawn } from 'node:child_process';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Runs the E2E suite against an in-memory MongoDB.
 *
 * Playwright starts its `webServer` processes before `globalSetup`, so a
 * database started there would come up after the apps had already failed to
 * connect. Starting it here, before Playwright is invoked at all, removes the
 * ordering problem entirely.
 *
 * E2E must never reach the Atlas cluster: Scrinode is production-first, and a
 * suite that can touch production data is one mistake away from destroying
 * it.
 */
const PORT = 27_117;

const mongod = await MongoMemoryServer.create({
  instance: { port: PORT, ip: '127.0.0.1' },
});

process.env.MONGODB_URI = mongod.getUri();
process.env.MONGODB_DB = 'scrinode_e2e';

const playwright = spawn(
  'npx',
  ['playwright', 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', shell: true, env: process.env },
);

const exitCode = await new Promise((resolve) => {
  playwright.on('close', resolve);
});

await mongod.stop();

process.exit(exitCode ?? 1);
