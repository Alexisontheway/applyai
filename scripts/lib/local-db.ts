/**
 * Embedded Postgres for local development and tests.
 *
 * Docker is great, but requiring it to run `npm run dev` is a tax. This starts
 * a real Postgres from the `embedded-postgres` binaries on a dedicated port so
 * a fresh clone boots with zero infrastructure. Production uses a real database
 * (Supabase, RDS, Neon, ...) via DATABASE_URL.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOCAL_DB_DIR = path.join(REPO_ROOT, '.localdb');
const STATE_FILE = path.join(LOCAL_DB_DIR, 'state.json');
const DATA_DIR = path.join(LOCAL_DB_DIR, 'data');

export interface LocalDbConfig {
  port: number;
  user: string;
  password: string;
  database: string;
}

export const DEFAULT_LOCAL_DB: LocalDbConfig = {
  port: Number(process.env.LOCAL_DB_PORT ?? 5433),
  user: 'postgres',
  password: 'postgres',
  database: 'applyai',
};

export function localConnectionString(config: LocalDbConfig = DEFAULT_LOCAL_DB): string {
  return `postgresql://${config.user}:${config.password}@localhost:${config.port}/${config.database}`;
}

export function readState(): { port: number } | null {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { port: number };
  } catch {
    return null;
  }
}

export function writeState(config: LocalDbConfig): void {
  if (!existsSync(LOCAL_DB_DIR)) mkdirSync(LOCAL_DB_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ port: config.port, pid: process.pid }, null, 2));
}

export async function isReachable(connectionString: string, timeoutMs = 1500): Promise<boolean> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis: timeoutMs });
  try {
    await client.connect();
    await client.query('select 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

interface EmbeddedPostgresInstance {
  initialise(): Promise<void>;
  start(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

function makeInstance(
  config: LocalDbConfig,
  initdbFlags: string[],
): Promise<EmbeddedPostgresInstance> {
  return import('embedded-postgres').then(({ default: EmbeddedPostgres }) => {
    const instance = new EmbeddedPostgres({
      databaseDir: DATA_DIR,
      user: config.user,
      password: config.password,
      port: config.port,
      persistent: true,
      initdbFlags,
      onLog: () => undefined,
      onError: () => undefined,
    });
    return instance as unknown as EmbeddedPostgresInstance;
  });
}

/**
 * The library hard-codes `--lc-messages=en_US.UTF-8`, which does not exist on
 * minimal containers and some macOS installs. Flags are appended after theirs,
 * so ours win — with a C-locale fallback if C.utf8 is unavailable.
 */
const LOCALE_FLAGS = ['-E', 'UTF8', '--lc-messages=C.utf8', '--locale=C.utf8'];
const FALLBACK_LOCALE_FLAGS = ['-E', 'UTF8', '--lc-messages=C', '--locale=C'];

export async function createEmbeddedPostgres(
  config: LocalDbConfig = DEFAULT_LOCAL_DB,
): Promise<EmbeddedPostgresInstance> {
  const initialized = existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  const instance = await makeInstance(config, LOCALE_FLAGS);

  if (!initialized) {
    mkdirSync(DATA_DIR, { recursive: true });
    try {
      await instance.initialise();
    } catch (error) {
      // Retry once with the plain C locale before giving up.
      rmSync(DATA_DIR, { recursive: true, force: true });
      mkdirSync(DATA_DIR, { recursive: true });
      const fallback = await makeInstance(config, FALLBACK_LOCALE_FLAGS);
      try {
        await fallback.initialise();
        return fallback;
      } catch {
        rmSync(DATA_DIR, { recursive: true, force: true });
        throw new Error(
          `Could not initialise the embedded Postgres cluster: ${
            error instanceof Error ? error.message : String(error)
          }\n  Use Docker instead: docker compose up postgres -d  (then set DATABASE_URL in apps/api/.env)`,
        );
      }
    }
  }
  return instance;
}

export async function startLocalDatabase(config: LocalDbConfig = DEFAULT_LOCAL_DB): Promise<{
  connectionString: string;
  alreadyRunning: boolean;
}> {
  const connectionString = localConnectionString(config);
  if (await isReachable(connectionString)) {
    return { connectionString, alreadyRunning: true };
  }

  const instance = await createEmbeddedPostgres(config);
  await instance.start();
  await instance.createDatabase(config.database).catch(() => undefined);
  writeState(config);
  return { connectionString, alreadyRunning: false };
}

/** Stop the cluster using the postmaster PID file (works across processes). */
export async function stopLocalDatabase(): Promise<boolean> {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (!existsSync(pidFile)) return false;
  const pid = Number(readFileSync(pidFile, 'utf8').split('\n')[0]);
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 'SIGINT');
  } catch {
    return false;
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
  }
  return false;
}
