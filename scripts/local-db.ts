/**
 * `npm run db:local` — start (or stop/check) the embedded development database.
 *
 * Runs in the foreground so `concurrently` can manage it alongside the API and
 * the web client: `npm run dev:full`.
 */
import {
  DEFAULT_LOCAL_DB,
  isReachable,
  localConnectionString,
  startLocalDatabase,
  stopLocalDatabase,
} from './lib/local-db';

const command = process.argv[2] ?? 'start';
const connectionString = localConnectionString(DEFAULT_LOCAL_DB);

async function main(): Promise<void> {
  if (command === 'status') {
    const reachable = await isReachable(connectionString);
    console.log(
      reachable ? `● running  ${connectionString}` : `○ stopped  (expected at ${connectionString})`,
    );
    process.exit(reachable ? 0 : 1);
  }

  if (command === 'stop') {
    await stopLocalDatabase();
    console.log('○ local database stopped');
    return;
  }

  const { alreadyRunning } = await startLocalDatabase(DEFAULT_LOCAL_DB);
  console.log(
    alreadyRunning
      ? `● local database already running: ${connectionString}`
      : `● local database ready: ${connectionString}`,
  );

  // Stay in the foreground so tooling can manage the lifecycle.
  const keepAlive = setInterval(() => undefined, 2 ** 30);
  const shutdown = async () => {
    clearInterval(keepAlive);
    console.log('\n○ stopping local database');
    await stopLocalDatabase().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((error) => {
  console.error('local database error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
