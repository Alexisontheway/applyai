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
const ENV_FILE = path.join(REPO_ROOT, 'apps', 'api', '.env');

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

/**
 * Every table ApplyAI owns. Anything else found in `public` belongs to another
 * application — we never migrate a database we did not create.
 */
export const MANAGED_TABLES = [
  'users',
  'session',
  'account',
  'verification',
  'companies',
  'jobs',
  'applications',
  'application_events',
  'resumes',
  'match_results',
  'cover_letters',
] as const;

export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

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

/** Table names in `public`, or null when the database cannot be inspected. */
export async function listPublicTables(connectionString: string): Promise<string[] | null> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString, connectionTimeoutMillis: 2500 });
  try {
    await client.connect();
    const result = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    );
    return result.rows.map((row) => row.table_name);
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Tables in the database that this project did not create. */
export function foreignTables(tables: readonly string[]): string[] {
  return tables.filter((table) => !(MANAGED_TABLES as readonly string[]).includes(table));
}

export function isLocalUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Port/user/database of a local URL, falling back to the defaults. */
export function localDbConfigFromUrl(url: string, fallback = DEFAULT_LOCAL_DB): LocalDbConfig {
  try {
    const parsed = new URL(url);
    return {
      port: Number(parsed.port || 5432),
      user: decodeURIComponent(parsed.username) || fallback.user,
      password: decodeURIComponent(parsed.password) || fallback.password,
      database: parsed.pathname.replace(/^\//, '') || fallback.database,
    };
  } catch {
    return fallback;
  }
}

/** DATABASE_URL from apps/api/.env, if the file exists. */
export function readEnvDatabaseUrl(): string | undefined {
  if (!existsSync(ENV_FILE)) return undefined;
  const match = /^DATABASE_URL=(.*)$/m.exec(readFileSync(ENV_FILE, 'utf8'));
  return match?.[1]?.trim() || undefined;
}

/** True when this repo already has an embedded cluster on disk. */
export function hasLocalCluster(): boolean {
  return existsSync(path.join(DATA_DIR, 'PG_VERSION'));
}

/**
 * Port of the cluster that is running right now (from Postgres' own pid file),
 * or null when nothing of ours is up. Reality beats configuration: if the
 * cluster is live on 5433 we use 5433, whatever the env says.
 */
export function runningClusterPort(): number | null {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (!existsSync(pidFile)) return null;
  const lines = readFileSync(pidFile, 'utf8').split('\n');
  const pid = Number(lines[0]);
  const port = Number(lines[3]);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
  } catch {
    return null; // stale pid file
  }
  return Number.isFinite(port) && port > 0 ? port : null;
}

/**
 * Which local cluster this repo manages, in order of authority:
 *   1. the cluster that is already running (its pid file knows the port)
 *   2. LOCAL_DB_PORT
 *   3. the DATABASE_URL already in apps/api/.env, when it points at localhost
 *   4. the default 5433
 */
export function resolveLocalDbConfig(): { config: LocalDbConfig; source: string } {
  const running = runningClusterPort();
  if (running) {
    return { config: { ...DEFAULT_LOCAL_DB, port: running }, source: 'running cluster' };
  }
  if (process.env.LOCAL_DB_PORT) {
    return {
      config: { ...DEFAULT_LOCAL_DB, port: Number(process.env.LOCAL_DB_PORT) },
      source: 'LOCAL_DB_PORT',
    };
  }
  const url = process.env.DATABASE_URL ?? readEnvDatabaseUrl();
  if (url && isLocalUrl(url)) {
    return { config: localDbConfigFromUrl(url), source: 'apps/api/.env' };
  }
  return { config: DEFAULT_LOCAL_DB, source: 'default' };
}

/** How to find out what is holding a port, per platform. */
export function portLookupCommand(port: number): string {
  return process.platform === 'win32'
    ? `netstat -ano | findstr :${port}   (then: tasklist /FI "PID eq <pid>")`
    : `lsof -iTCP:${port} -sTCP:LISTEN`;
}

/**
 * Raised when the port we want is answering but the server is not this repo's
 * cluster. Adopting a stranger's database is how a schema push silently
 * rewrites somebody else's tables — so we refuse and explain instead.
 */
export function portTakenMessage(port: number, tables: string[] | null): string {
  const foreign = tables ? foreignTables(tables) : [];
  const lines = [
    `Port ${port} is already serving a Postgres database that this repo did not create.`,
  ];
  if (foreign.length > 0) {
    lines.push(`  It contains tables ApplyAI does not manage: ${foreign.join(', ')}`);
    if (foreign.includes('analytics_events')) {
      lines.push('  (that looks like a database from an older version of ApplyAI)');
    }
  } else if (tables && tables.length > 0) {
    lines.push(`  It already contains ${tables.length} tables.`);
  }
  lines.push(
    '',
    '  Pick one:',
    '    1. Give this project its own database on a free port:',
    `         npm run setup -- --port ${port + 1}`,
    `    2. Stop whatever holds ${port}, then start again:`,
    `         ${portLookupCommand(port)}`,
    '    3. If that database really is yours, push the schema into it yourself:',
    '         npm run db:push        (or: npm run db:reset, which wipes it first)',
  );
  return lines.join('\n');
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
    if (hasLocalCluster()) return { connectionString, alreadyRunning: true };
    // Something else owns this port and we have no cluster of our own.
    throw new Error(portTakenMessage(config.port, await listPublicTables(connectionString)));
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
