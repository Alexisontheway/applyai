/**
 * `npm run setup` — one command from a fresh clone to a running app:
 *   1. create apps/api/.env (with a real BETTER_AUTH_SECRET) if missing
 *   2. start a local Postgres if DATABASE_URL points at localhost
 *   3. create the schema
 *   4. seed a demo account (skip with --no-seed)
 *
 * Flags:
 *   --port <n>   use port <n> for this project's own Postgres (default 5433)
 *   --no-seed    set up the schema without demo data
 *
 * Safety: it refuses to push the schema into a localhost database that this
 * repo did not create. Pointing drizzle-kit at a stranger's database is how you
 * silently rewrite somebody else's tables — see `portTakenMessage`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_LOCAL_DB,
  LOCAL_HOSTS,
  REPO_ROOT,
  hasLocalCluster,
  isReachable,
  listPublicTables,
  localConnectionString,
  portTakenMessage,
  resolveLocalDbConfig,
  runningClusterPort,
} from './lib/local-db';

const API_DIR = path.join(REPO_ROOT, 'apps', 'api');
const ENV_PATH = path.join(API_DIR, '.env');
const EXAMPLE_PATH = path.join(API_DIR, '.env.example');
const args = process.argv.slice(2);
const flags = new Set(args);

function step(message: string): void {
  console.log(`\n▸ ${message}`);
}

function flagValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1];
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function ensureEnvFile(): string {
  if (!existsSync(ENV_PATH)) {
    step('Creating apps/api/.env');
    const template = readFileSync(EXAMPLE_PATH, 'utf8');
    const secret = randomBytes(32).toString('base64');
    const contents = template
      .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`)
      .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${localConnectionString(DEFAULT_LOCAL_DB)}`);
    writeFileSync(ENV_PATH, contents, { mode: 0o600 });
    console.log('  ✓ wrote apps/api/.env (generated auth secret, local database URL)');
  } else {
    console.log('  ✓ apps/api/.env already exists');
    const contents = readFileSync(ENV_PATH, 'utf8');
    if (/^BETTER_AUTH_SECRET=\s*$/m.test(contents)) {
      const secret = randomBytes(32).toString('base64');
      writeFileSync(
        ENV_PATH,
        contents.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`),
        {
          mode: 0o600,
        },
      );
      console.log('  ✓ filled in an empty BETTER_AUTH_SECRET');
    }
  }
  return ENV_PATH;
}

function databaseUrlFromEnvFile(file: string): string | undefined {
  const contents = readFileSync(file, 'utf8');
  const match = /^DATABASE_URL=(.*)$/m.exec(contents);
  return match?.[1]?.trim() || undefined;
}

/** Keep apps/api/.env honest about which database the API should use. */
function setEnvDatabaseUrl(url: string): void {
  const contents = readFileSync(ENV_PATH, 'utf8');
  if (contents.includes(`\nDATABASE_URL=${url}\n`) || contents.startsWith(`DATABASE_URL=${url}\n`))
    return;
  const next = /^DATABASE_URL=/m.test(contents)
    ? contents.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
    : `${contents.trimEnd()}\nDATABASE_URL=${url}\n`;
  writeFileSync(ENV_PATH, next, { mode: 0o600 });
  console.log(`  ✓ DATABASE_URL in apps/api/.env → ${url}`);
}

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv): boolean {
  const result = spawnSync(command, commandArgs, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

/** Keep the local database alive after setup exits. */
function spawnDetachedDatabase(port: number): void {
  const child = spawn('npm', ['run', 'db:local'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, LOCAL_DB_PORT: String(port) },
    shell: process.platform === 'win32',
  });
  child.unref();
}

async function main(): Promise<void> {
  console.log('ApplyAI setup');

  const envPath = ensureEnvFile();
  const envFromFile = databaseUrlFromEnvFile(envPath);
  const databaseUrl = process.env.DATABASE_URL ?? envFromFile;
  const usesLocalDatabase = !databaseUrl || LOCAL_HOSTS.some((host) => databaseUrl.includes(host));

  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (envFromFile) childEnv.DATABASE_URL = databaseUrl;

  if (usesLocalDatabase) {
    const requestedPort = flagValue('--port');
    const resolved = resolveLocalDbConfig();
    const config = requestedPort
      ? { ...DEFAULT_LOCAL_DB, port: Number(requestedPort) }
      : resolved.config;
    if (!Number.isFinite(config.port) || config.port <= 0) {
      console.error(`\n✗ --port needs a port number, got "${requestedPort}".`);
      process.exit(1);
    }

    step('Starting the local Postgres (embedded-postgres, no Docker needed)');
    const target = localConnectionString(config);
    const running = runningClusterPort();
    if (running && running !== config.port && requestedPort) {
      console.error(
        `\n✗ This repo's database is already running on port ${running}.\n` +
          `  Stop it first (npm run db:local:stop) before moving it to ${config.port}.`,
      );
      process.exit(1);
    }

    if (await isReachable(target)) {
      if (!hasLocalCluster()) {
        // Reachable, but not our cluster: never push a schema into it.
        console.error(`\n✗ ${portTakenMessage(config.port, await listPublicTables(target))}`);
        process.exit(1);
      }
      console.log(`  ✓ already running at ${target}`);
    } else {
      // Start it in a detached process so it survives this script exiting.
      spawnDetachedDatabase(config.port);
      const ready = await waitFor(() => isReachable(target, 2_000), 90_000);
      if (!ready) {
        console.error(
          '\n✗ The local database did not start in time. Run `npm run db:local` to see why.',
        );
        process.exit(1);
      }
      console.log(`  ✓ started ${target}`);
    }

    childEnv.DATABASE_URL = target;
    setEnvDatabaseUrl(target);
  } else {
    console.log(
      `  ✓ using the DATABASE_URL from your environment (${databaseUrl?.split('@')[1] ?? 'remote'})`,
    );
  }

  step('Creating the database schema (drizzle-kit push)');
  const pushed = run('npm', ['run', 'db:push', '-w', 'apps/api'], childEnv);
  if (!pushed) {
    console.error(
      '\n✗ Schema push failed. Check DATABASE_URL in apps/api/.env.\n' +
        '  If the database is in a half-migrated state, `npm run db:reset` rebuilds it from scratch.',
    );
    process.exit(1);
  }

  if (!flags.has('--no-seed')) {
    step('Seeding a demo account');
    const seeded = run('npm', ['run', 'db:seed'], childEnv);
    if (!seeded) {
      console.error(
        '\n✗ Seeding the demo account failed. Retry with `npm run db:seed`.\n' +
          '  If the schema looks wrong, `npm run db:reset` rebuilds it from scratch.',
      );
      process.exit(1);
    }
  }

  console.log(`\n✓ Setup complete

  Start everything:   npm run dev          (API :4000 + web :5173)
  With a local DB:    npm run dev:full
  Optional ML:        npm run dev:ml       (semantic matching + PDF parsing)

  Demo login:         demo@applyai.dev / demo1234
`);
}

main().catch((error) => {
  console.error('setup failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
