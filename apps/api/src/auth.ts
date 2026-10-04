import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './db/schema';
import { env } from './env';

/**
 * Email + password auth via Better Auth.
 *
 * Cookies are httpOnly and same-site=lax: the web client always talks to the
 * API on its own origin (Vite proxies in dev, nginx/Node serves both in prod),
 * so nothing here needs to be exposed to JavaScript.
 */
export const auth = betterAuth({
  secret: env.auth.secret,
  baseURL: env.auth.baseUrl,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  trustedOrigins: env.trustedOrigins,
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: env.isProduction,
    },
  },
});

export type Auth = typeof auth;
