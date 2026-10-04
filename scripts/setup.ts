import { spawn, spawnSync } from 'node:child_process';
/**
 * `npm run setup` — one command from a fresh clone to a running app:
 *   1. create apps/api/.env (with a real BETTER_AUTH_SECRET) if missing
 *   2. start a local Postgres if DATABASE_URL points at localhost
 *   3. create the schema
 *   4. seed a demo account (skip with --no-seed)
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCAL_DB, REPO_ROOT, isReachable, localConnectionString } from './lib/local-db';

const API_DIR = path.join(REPO_ROOT, 'apps', 'api');
const ENV_PATH = path.join(API_DIR, '.env');
const EXAMPLE_PATH = path.join(API_DIR, '.env.example');
const args = new Set(process.argv.slice(2));

function step(message: string): void {
  console.log(`\n▸ ${message}`);
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

async function waitFor(check: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): boolean {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

/** Keep the local database alive after setup exits. */
function spawnDetachedDatabase(): void {
  const child = spawn('npm', ['run', 'db:local'], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: process.env,
    shell: process.platform === 'win32',
  });
  child.unref();
}

async function main(): Promise<void> {
  console.log('ApplyAI setup');

  const envPath = ensureEnvFile();
  const envFromFile = databaseUrlFromEnvFile(envPath);
  const databaseUrl = process.env.DATABASE_URL ?? envFromFile;
  const usesLocalDatabase = !databaseUrl || /localhost|127\.0\.0\.1/.test(databaseUrl);

  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (envFromFile) childEnv.DATABASE_URL = databaseUrl;

  if (usesLocalDatabase) {
    step('Starting the local Postgres (embedded-postgres, no Docker needed)');
    const target = databaseUrl ?? localConnectionString(DEFAULT_LOCAL_DB);
    if (await isReachable(target)) {
      console.log(`  ✓ already running at ${target}`);
    } else {
      // Start it in a detached process so it survives this script exiting.
      spawnDetachedDatabase();
      const ready = await waitFor(() => isReachable(target, 2_000), 90_000);
      if (!ready) {
        console.error(
          '\n✗ The local database did not start in time. Run `npm run db:local` to see why.',
        );
        process.exit(1);
      }
      console.log(`  ✓ started ${localConnectionString(DEFAULT_LOCAL_DB)}`);
    }
  } else {
    console.log(
      `  ✓ using the DATABASE_URL from your environment (${databaseUrl?.split('@')[1] ?? 'remote'})`,
    );
  }

  step('Creating the database schema (drizzle-kit push)');
  const pushed = run('npm', ['run', 'db:push', '-w', 'apps/api'], childEnv);
  if (!pushed) {
    console.error(
      '\n✗ Schema push failed. Check DATABASE_URL in apps/api/.env and run `npm run db:push` again.',
    );
    process.exit(1);
  }

  if (!args.has('--no-seed')) {
    step('Seeding a demo account');
    const seeded = run('npm', ['run', 'db:seed'], childEnv);
    if (!seeded) console.log('  ⚠ seeding failed — you can retry with `npm run db:seed`');
  }

  console.log(`
✓ Setup complete

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
