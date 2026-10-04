/**
 * `npm run db:local` — start (or stop/check) the embedded development database.
 *
 * Runs in the foreground so `concurrently` can manage it alongside the API and
 * the web client: `npm run dev:full`.
 *
 * It only ever manages *this repo's* cluster (`.localdb/`). If the port is held
 * by another Postgres, it says so instead of connecting to it.
 */
import {
  isReachable,
  localConnectionString,
  portTakenMessage,
  resolveLocalDbConfig,
  runningClusterPort,
  startLocalDatabase,
  stopLocalDatabase,
} from './lib/local-db';

const command = process.argv[2] ?? 'start';
const { config, source } = resolveLocalDbConfig();
const connectionString = localConnectionString(config);

async function main(): Promise<void> {
  if (command === 'status') {
    const reachable = await isReachable(connectionString);
    const running = runningClusterPort();
    if (reachable && running) {
      console.log(`● running  ${connectionString}  (port from ${source})`);
      process.exit(0);
    }
    if (reachable) {
      console.log(`▲ ${portTakenMessage(config.port, null)}`);
      process.exit(1);
    }
    console.log(`○ stopped  (expected at ${connectionString})`);
    process.exit(1);
  }

  if (command === 'stop') {
    const stopped = await stopLocalDatabase();
    console.log(
      stopped ? '○ local database stopped' : '○ nothing of ours is running (no live postmaster)',
    );
    return;
  }

  const { alreadyRunning } = await startLocalDatabase(config);
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
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
