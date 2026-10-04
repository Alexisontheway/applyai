/**
 * `npm run doctor` — answer one question: why does this checkout not start?
 *
 * Setup failures on a new machine usually have nothing to do with the code:
 * a file went missing from the working tree, a dependency install script was
 * skipped, an older database still holds the port, an `.env` is empty. Each of
 * those produces a confusing error somewhere else (Vite says "does the file
 * exist?", the seed says "column does not exist").
 *
 * This checks the whole chain and prints one line per finding with the command
 * that fixes it. Exit code is non-zero when something would stop `npm run dev`
 * from working.
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { Client } from 'pg';
import {
  LOCAL_HOSTS,
  REPO_ROOT,
  foreignTables,
  hasLocalCluster,
  isReachable,
  listPublicTables,
  localDbConfigFromUrl,
  readEnvDatabaseUrl,
  runningClusterPort,
} from './lib/local-db';

type Level = 'ok' | 'warn' | 'fail' | 'info';

const counts: Record<Level, number> = { ok: 0, warn: 0, fail: 0, info: 0 };

const SYMBOL: Record<Level, string> = { ok: '✓', warn: '!', fail: '✗', info: '·' };

function report(level: Level, title: string, ...detail: string[]): void {
  counts[level] += 1;
  console.log(`${SYMBOL[level]} ${title}`);
  for (const line of detail) console.log(`    ${line}`);
}

function heading(title: string): void {
  console.log(`\n${title}`);
}

/** Files that must exist and be readable for the app to start. */
const REQUIRED_FILES = [
  'package.json',
  'apps/api/.env.example',
  'apps/api/drizzle.config.ts',
  'apps/api/src/index.ts',
  'apps/api/src/db/schema.ts',
  'apps/web/index.html',
  'apps/web/src/main.tsx',
  'apps/web/src/router.tsx',
  'scripts/seed.ts',
];

/** The client entrypoint: if this one is unreadable, Vite cannot start the app. */
const ENTRYPOINT = 'apps/web/src/main.tsx';

function normalizePath(value: string): string {
  const slashed = value.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
}

function checkRuntime(): void {
  heading('Runtime');
  const node = process.versions.node;
  const major = Number(node.split('.')[0]);
  if (major >= 22) report('ok', `Node ${node}`);
  else report('fail', `Node ${node} is too old`, 'This repository needs Node 22 or newer.');

  const agent = process.env.npm_config_user_agent ?? '';
  const npm = /npm\/(\d+\.\d+\.\d+)/.exec(agent)?.[1];
  if (!npm) {
    report('info', 'npm version unknown (not started through npm?)');
    return;
  }
  const npmMajor = Number(npm.split('.')[0]);
  if (npmMajor >= 12) {
    report(
      'info',
      `npm ${npm}`,
      'npm 12+ blocks dependency install scripts unless package.json allows them.',
      'The check below reports any that are still unapproved.',
    );
  } else {
    report('ok', `npm ${npm}`);
  }
}

function checkLocation(): void {
  heading('Checkout location');
  const physical = realpathSync.native(REPO_ROOT);
  const logical = process.env.INIT_CWD ?? process.env.PWD ?? process.env.CD ?? REPO_ROOT;
  if (normalizePath(logical) !== normalizePath(physical)) {
    report(
      'warn',
      'This checkout is reached through a symlink or junction',
      `you are working in: ${logical}`,
      `which physically is: ${physical}`,
      'File tools, watchers and editors can disagree about which path a file has,',
      'which shows up as "file not found" for files that are clearly there.',
    );
  } else {
    report('ok', 'No symlink or junction in the checkout path');
  }

  const synced = /onedrive|dropbox|google drive|icloud|pcloud|creative cloud|box\.com|mega/i;
  if (synced.test(physical)) {
    report(
      'warn',
      'The checkout lives in a cloud-synced folder',
      `${physical}`,
      'Sync tools can remove or dehydrate files under a running dev server.',
      'If files keep disappearing, clone somewhere plain such as C:\\dev\\applyai.',
    );
  }
}

function checkFiles(): void {
  heading('Files');
  let entrypointBroken = false;
  for (const relative of REQUIRED_FILES) {
    const absolute = path.join(REPO_ROOT, relative);
    try {
      const contents = readFileSync(absolute);
      if (contents.length === 0) {
        report('fail', `${relative} is empty`, `git restore ${relative}`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? 'unknown';
      const isEntry = relative === ENTRYPOINT;
      if (isEntry) entrypointBroken = true;
      if (code === 'ENOENT') {
        report(
          isEntry ? 'fail' : 'warn',
          `${relative} is missing from the working tree`,
          'Git has it; the file is not on disk. Restore it with:',
          `    git restore ${relative}`,
          'If it disappears again, something on this machine is deleting it',
          '(a cloud-sync client or an antivirus quarantine) rather than Git.',
        );
      } else {
        report(
          isEntry ? 'fail' : 'warn',
          `${relative} cannot be read (${code})`,
          'The file is on disk but this process is not allowed to read it.',
          'On Windows this is usually an antivirus real-time scanner or a sync',
          `client holding it. Try: git restore ${relative}`,
        );
      }
    }
  }
  if (!entrypointBroken) report('ok', `All ${REQUIRED_FILES.length} required files readable`);
}

function checkDependencies(): void {
  heading('Dependencies');
  const missing = ['tsx', 'vite', 'drizzle-kit', 'pg', 'embedded-postgres'].filter(
    (name) => !existsSync(path.join(REPO_ROOT, 'node_modules', name)),
  );
  if (missing.length > 0) {
    report('fail', `node_modules is incomplete (${missing.join(', ')})`, 'Run: npm install');
    return;
  }
  report('ok', 'node_modules has the build and test tools');

  const lockPath = path.join(REPO_ROOT, 'package-lock.json');
  const packagePath = path.join(REPO_ROOT, 'package.json');
  if (!existsSync(lockPath)) {
    report('info', 'No package-lock.json — skipping the install-script check');
    return;
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages?: Record<string, { hasInstallScript?: boolean }>;
  };
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    allowScripts?: Record<string, boolean>;
  };
  const approved = new Set(Object.keys(pkg.allowScripts ?? {}));
  const scripted = new Set<string>();
  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    if (!value.hasInstallScript) continue;
    const name =
      key
        .replace(/^node_modules\//, '')
        .split('/node_modules/')
        .pop() ?? key;
    if (!approved.has(name)) scripted.add(name);
  }
  if (scripted.size === 0) {
    report('ok', 'Every dependency with an install script is allowed in package.json');
  } else {
    report(
      'warn',
      `${scripted.size} dependency install script(s) are not approved`,
      [...scripted].sort().join(', '),
      'On npm 12+ those scripts are skipped (a warning, not a failure). If one is',
      'needed, review it and run:',
      `    npm install-scripts approve ${[...scripted].sort()[0]} --no-allow-scripts-pin`,
      'then: npm rebuild',
    );
  }
}

function checkEnvFile(): void {
  heading('Configuration');
  const envPath = path.join(REPO_ROOT, 'apps', 'api', '.env');
  if (!existsSync(envPath)) {
    report('fail', 'apps/api/.env does not exist', 'Run: npm run setup');
    return;
  }
  const contents = readFileSync(envPath, 'utf8');
  const secret = /^BETTER_AUTH_SECRET=(.*)$/m.exec(contents)?.[1]?.trim();
  if (!secret) {
    report('fail', 'BETTER_AUTH_SECRET is empty', 'Run: npm run setup (it fills it in)');
  } else {
    report('ok', 'BETTER_AUTH_SECRET is set');
  }
  if (!readEnvDatabaseUrl()) {
    report('fail', 'DATABASE_URL is missing from apps/api/.env', 'Run: npm run setup');
  } else {
    report('ok', 'DATABASE_URL is set');
  }
}

/** Does `resumes` exist, and does it have the column the current schema needs? */
async function resumeColumns(databaseUrl: string): Promise<string[] | null> {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    const result = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'resumes'`,
    );
    return result.rows.map((row) => row.column_name);
  } catch {
    return null;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkDatabase(): Promise<void> {
  heading('Database');
  const databaseUrl = process.env.DATABASE_URL ?? readEnvDatabaseUrl();
  if (!databaseUrl) {
    report('fail', 'No DATABASE_URL to check', 'Run: npm run setup');
    return;
  }

  const isLocal = LOCAL_HOSTS.some((host) => databaseUrl.includes(host));
  const where = databaseUrl.split('@')[1] ?? 'remote';
  if (!isLocal) {
    report('info', `Using the remote database ${where}`);
    return;
  }

  if (!(await isReachable(databaseUrl))) {
    report(
      'fail',
      `Nothing is listening on ${where}`,
      'Start the embedded database with:',
      '    npm run db:local',
      'or create the whole environment with: npm run setup',
    );
    return;
  }

  const tables = (await listPublicTables(databaseUrl)) ?? [];
  const foreign = foreignTables(tables);
  const clusterPort = runningClusterPort();

  if (foreign.length > 0 && clusterPort === null) {
    report(
      'fail',
      `${where} is not this repo's database`,
      `It contains tables ApplyAI does not manage: ${foreign.join(', ')}`,
      'This is the state that makes `drizzle-kit push` crash half-way. Either:',
      '    npm run setup -- --port 5434     (give this project its own database)',
      '    npm run db:reset -- --yes        (if that database is yours and disposable)',
    );
    return;
  }

  if (!tables.includes('resumes')) {
    report(
      'warn',
      `${where} is reachable but has no ApplyAI schema yet`,
      'Run: npm run db:push && npm run db:seed',
    );
    return;
  }

  const columns = await resumeColumns(databaseUrl);
  if (columns && !columns.includes('file_name')) {
    report(
      'fail',
      'The database schema is from an older version of ApplyAI',
      '`resumes` has no `file_name` column, so the seed cannot insert resumes.',
      'Rebuild it:',
      '    npm run db:reset',
      '(add --yes if the database on that port did not come from this repository)',
    );
    return;
  }

  report('ok', `${where} is reachable with ${tables.length} tables`);
}

async function portState(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(700);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function checkPorts(): Promise<void> {
  heading('Ports');
  const databaseUrl = process.env.DATABASE_URL ?? readEnvDatabaseUrl();
  const localPort = databaseUrl ? localDbConfigFromUrl(databaseUrl).port : 5433;
  const watched: [number, string][] = [
    [4000, 'API (npm run dev)'],
    [5173, 'web (npm run dev)'],
    [localPort, 'local Postgres'],
  ];
  for (const [port, label] of watched) {
    const inUse = await portState(port);
    if (inUse) {
      report('info', `:${port} is in use — ${label}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`ApplyAI doctor — ${REPO_ROOT}`);
  checkRuntime();
  checkLocation();
  checkFiles();
  checkDependencies();
  checkEnvFile();
  await checkDatabase();
  await checkPorts();

  const clean = counts.fail === 0;
  console.log(
    `\n${clean ? '✓' : '✗'} ${clean ? 'Ready.' : 'Not ready yet.'} ` +
      `${counts.ok} ok, ${counts.warn} warning(s), ${counts.fail} blocking problem(s).`,
  );
  if (!clean) {
    console.log('Fix the ✗ lines above, then run `npm run dev`.');
    process.exit(1);
  }
  if (!hasLocalCluster()) {
    console.log(
      'Note: no embedded cluster in .localdb/ — the database may be one you manage yourself.',
    );
  }
}

main().catch((error) => {
  console.error('doctor failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
