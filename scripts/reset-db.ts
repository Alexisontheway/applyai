/**
 * `npm run db:reset` — rebuild the database from scratch.
 *
 * Drops everything in the `public` schema, pushes the schema again and re-seeds
 * the demo account. This is what you want when a database is in a half-migrated
 * state, or when an old version of the schema is in the way.
 *
 *   npm run db:reset            local database (the default target)
 *   npm run db:reset -- --yes   also allow it against a remote database
 *
 * Non-localhost targets refuse without --yes, and a localhost database that
 * this repo did not create needs --yes too — resetting somebody else's
 * database is never a helpful default.
 */
import { spawnSync } from 'node:child_process';
import {
  LOCAL_HOSTS,
  REPO_ROOT,
  foreignTables,
  hasLocalCluster,
  isReachable,
  listPublicTables,
  readEnvDatabaseUrl,
} from './lib/local-db';

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');

const databaseUrl = process.env.DATABASE_URL ?? readEnvDatabaseUrl();

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!databaseUrl) {
    fail('No DATABASE_URL found. Run `npm run setup` first, or set one in apps/api/.env.');
  }

  const isLocal = LOCAL_HOSTS.some((host) => databaseUrl.includes(host));
  if (!isLocal && !confirmed) {
    fail(
      `DATABASE_URL points at a remote database (${databaseUrl.split('@')[1] ?? 'remote'}).\n` +
        '  Refusing to drop its schema. Re-run with `npm run db:reset -- --yes` if that is what you want.',
    );
  }

  if (!(await isReachable(databaseUrl))) {
    fail(
      'The database is not reachable.\n' +
        '  Start the local one with `npm run db:local`, or check DATABASE_URL in apps/api/.env.',
    );
  }

  const tables = (await listPublicTables(databaseUrl)) ?? [];
  const foreign = foreignTables(tables);
  if (isLocal && !hasLocalCluster() && foreign.length > 0 && !confirmed) {
    fail(
      `This repo has no embedded cluster in .localdb/, so the database on ${databaseUrl.split('@')[1]} is not ours.\n` +
        `  It contains tables ApplyAI does not manage: ${foreign.join(', ')}\n` +
        '  Refusing to wipe it. Use `npm run setup -- --port 5434` to give this project its own database,\n' +
        '  or re-run with `npm run db:reset -- --yes` if that database really is yours and disposable.',
    );
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log(
    `▸ Dropping the public schema (${tables.length} tables: ${tables.join(', ') || 'empty'})`,
  );
  await client.query('drop schema public cascade');
  await client.query('create schema public');
  await client.end();

  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl };

  console.log('▸ Creating the schema (drizzle-kit push)');
  const pushed = spawnSync('npm', ['run', 'db:push', '-w', 'apps/api'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (pushed.status !== 0)
    fail('Schema push failed — run `npm run db:push` to see the full output.');

  console.log('▸ Seeding the demo account');
  const seeded = spawnSync('npm', ['run', 'db:seed'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (seeded.status !== 0) fail('Seeding failed — run `npm run db:seed` to see the full output.');

  console.log('\n✓ Database rebuilt: schema pushed, demo data seeded.');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
