/**
 * Environment loading + validation.
 *
 * This module MUST be imported before anything else touches `process.env`
 * (the API entrypoint imports it first). It reads `apps/api/.env` and the repo
 * root `.env`, then validates everything into a typed object so a
 * misconfigured deploy fails loudly at boot instead of at the first request.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Parse a dotenv-style file into process.env without overwriting real env vars. */
function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, '');
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    const quoted = /^(["'])(.*)\1$/s.exec(value);
    if (quoted) value = quoted[2];
    else value = value.split(' #')[0].trim();
    process.env[key] = value;
  }
}

export function loadEnvFiles(): void {
  // apps/api/.env takes precedence over the repo root .env
  loadEnvFile(path.resolve(here, '..', '.env'));
  loadEnvFile(path.resolve(here, '..', '..', '..', '.env'));
}

if (!process.env.APPLYAI_ENV_LOADED) {
  loadEnvFiles();
  process.env.APPLYAI_ENV_LOADED = '1';
}

const DEV_SECRET = 'dev-secret-change-me-in-production-0123456789';
const MIN_SECRET_LENGTH = 32;

function list(value: string | undefined, fallback: string[] = []): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class EnvError extends Error {}

function buildEnv() {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production';
  const isProduction = nodeEnv === 'production';
  const problems: string[] = [];

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    problems.push(
      'DATABASE_URL is required. Run `npm run setup` for a local Postgres, or point it at your own database.',
    );
  }

  let authSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!authSecret) {
    if (isProduction) {
      problems.push(
        'BETTER_AUTH_SECRET is required in production (generate one: openssl rand -base64 32).',
      );
    } else {
      authSecret = DEV_SECRET;
    }
  } else if (isProduction && authSecret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`,
    );
  }

  if (problems.length > 0) {
    throw new EnvError(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }

  const clientUrls = list(process.env.CLIENT_URL, ['http://localhost:5173']);
  const trustedOrigins = list(process.env.TRUSTED_ORIGINS, clientUrls);

  return {
    nodeEnv,
    isProduction,
    port: num(process.env.PORT, 4000),
    databaseUrl: databaseUrl as string,
    auth: {
      secret: authSecret as string,
      baseUrl: process.env.BETTER_AUTH_URL?.trim() || 'http://localhost:4000',
      usingDevSecret: authSecret === DEV_SECRET,
    },
    clientUrls,
    trustedOrigins,
    databaseSsl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    dbPoolMax: num(process.env.DB_POOL_MAX, 10),
    logLevel: (process.env.LOG_LEVEL ?? (nodeEnv === 'test' ? 'warn' : 'info')) as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error',
    ml: {
      url: process.env.ML_SERVICE_URL?.replace(/\/$/, '') || null,
      timeoutMs: num(process.env.ML_TIMEOUT_MS, 12_000),
    },
    ollama: {
      url: process.env.OLLAMA_URL?.replace(/\/$/, '') || null,
      model: process.env.OLLAMA_MODEL || 'llama3.2',
      timeoutMs: num(process.env.OLLAMA_TIMEOUT_MS, 60_000),
    },
    discovery: {
      timeoutMs: num(process.env.DISCOVERY_TIMEOUT_MS, 10_000),
      cacheTtlMs: num(process.env.DISCOVERY_CACHE_TTL_MS, 5 * 60_000),
      greenhouseBoards: list(process.env.GREENHOUSE_BOARDS, DEFAULT_GREENHOUSE_BOARDS),
      leverCompanies: list(process.env.LEVER_COMPANIES, DEFAULT_LEVER_COMPANIES),
      ashbyBoards: list(process.env.ASHBY_BOARDS, DEFAULT_ASHBY_BOARDS),
      disabledSources: list(process.env.DISABLED_JOB_SOURCES),
    },
    rateLimit: {
      windowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
      maxRequests: num(process.env.RATE_LIMIT_MAX, 240),
    },
  };
}

/**
 * Well-known boards that are safe to query by default. Tokens are the slugs used
 * in each provider's public job-board API. Override with GREENHOUSE_BOARDS /
 * LEVER_COMPANIES / ASHBY_BOARDS — every entry that 404s is skipped silently.
 */
export const DEFAULT_GREENHOUSE_BOARDS = [
  'stripe',
  'figma',
  'notion',
  'vercel',
  'datadog',
  'gitlab',
  'discord',
  'airtable',
  'reddit',
  'benchling',
  'gopuff',
  'doordash',
  'affirm',
  'samsara',
  'anthropic',
  'openai',
];

export const DEFAULT_LEVER_COMPANIES = [
  'netflix',
  'spotify',
  'plaid',
  'benchling',
  'ramp',
  'attentive',
  'brex',
  'kraken',
];

export const DEFAULT_ASHBY_BOARDS = ['openai', 'ramp', 'linear', 'clay', 'notion', 'replit'];

export type Env = ReturnType<typeof buildEnv>;
export const env: Env = buildEnv();

export function describeOptionalServices(): string[] {
  const notes: string[] = [];
  if (env.auth.usingDevSecret) {
    notes.push('BETTER_AUTH_SECRET not set — using a development placeholder secret.');
  }
  if (!env.ml.url) {
    notes.push('ML_SERVICE_URL not set — semantic matching and PDF parsing are disabled.');
  }
  if (!env.ollama.url) {
    notes.push('OLLAMA_URL not set — cover letters use the built-in template engine.');
  }
  return notes;
}
