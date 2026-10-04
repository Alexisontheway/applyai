import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

const { Pool } = pg;

/**
 * A single shared connection pool. Supabase/RDS/Self-hosted Postgres all work:
 * set DATABASE_URL (and DATABASE_SSL=true for hosted databases that require TLS).
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  ssl: env.databaseSsl,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  // Never kill the process from a background pool error — log and let the
  // next query attempt reconnect.
  console.error('[db] idle client error:', err.message);
});

export const db = drizzle({ client: pool, schema });

export async function checkDatabase(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'unknown database error' };
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export type Db = typeof db;
export { schema };
