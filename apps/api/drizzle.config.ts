import { defineConfig } from 'drizzle-kit';
import { env } from './src/env';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.databaseUrl,
    ssl: env.databaseSsl ? true : undefined,
  },
  verbose: true,
  strict: false,
});
