import { serve } from '@hono/node-server';
import { app } from './app';
import { checkDatabase, closeDatabase } from './db';
import { describeOptionalServices, env } from './env';
import { logger } from './lib/logger';

const port = env.port;
const hostname = process.env.HOST ?? '0.0.0.0';

const server = serve({ fetch: app.fetch, port, hostname }, async () => {
  const database = await checkDatabase();
  const notes = describeOptionalServices();

  logger.info('ApplyAI API started', {
    url: `http://localhost:${port}`,
    env: env.nodeEnv,
    database: database.ok ? `connected (${database.latencyMs}ms)` : 'UNREACHABLE',
  });

  if (!database.ok) {
    logger.error(
      'Database is not reachable — check DATABASE_URL, or run `npm run db:local` / `npm run setup`',
      {
        error: database.error,
      },
    );
  }
  for (const note of notes) logger.warn(note);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`received ${signal}, shutting down`);
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  // Never hang forever waiting for keep-alive connections.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
