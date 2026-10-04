import type { Context, Next } from 'hono';
import { auth } from '../auth';

/**
 * Resolves the Better Auth session from the request cookies and puts the user
 * on the context. Every /api route except health and auth is behind this.
 */
export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json(
      { success: false as const, error: 'Sign in to continue', requestId: c.get('requestId') },
      401,
    );
  }

  c.set('user', {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  });
  c.set('session', { id: session.session.id });
  await next();
}
