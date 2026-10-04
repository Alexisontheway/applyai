import type { User } from '@applyai/shared/types';
import { createAuthClient } from 'better-auth/client';

/**
 * Same-origin auth client: the browser talks to `/api/auth/*` on the origin it
 * loaded the app from, and Vite (dev) or the API itself (prod) forwards it.
 */
export const authClient = createAuthClient();

export async function getSessionUser(): Promise<User | null> {
  const result = await authClient.getSession();
  const user = result.data?.user;
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: (user as { image?: string | null }).image ?? null,
  };
}

/** Turn Better Auth's error shapes into a sentence a human can read. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const nested = record.error as Record<string, unknown> | undefined;
    if (typeof nested?.message === 'string') return nested.message;
    if (typeof record.message === 'string') return record.message;
  }
  return 'Something went wrong. Please try again.';
}
