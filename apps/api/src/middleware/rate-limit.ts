/**
 * In-memory sliding-window rate limiter.
 *
 * Good enough for a single-node deployment and for protecting expensive
 * endpoints (auth, discovery, LLM generation). Behind multiple instances,
 * swap the store for Redis — the interface stays the same.
 */
import type { Context, Next } from 'hono';
import { env } from '../env';

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

function clientKey(c: Context, scope: string): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || c.req.header('x-real-ip') || 'local';
  return `${scope}:${ip}`;
}

function prune(now: number, windowMs: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  scope: string;
}

export function rateLimit(options: RateLimitOptions) {
  const windowMs = options.windowMs ?? env.rateLimit.windowMs;
  const max = options.max ?? env.rateLimit.maxRequests;

  return async (c: Context, next: Next) => {
    if (env.nodeEnv === 'test') return next();
    const now = Date.now();
    const key = clientKey(c, options.scope);
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((time) => now - time < windowMs);

    if (bucket.hits.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
      c.header('retry-after', String(Math.max(1, retryAfter)));
      return c.json(
        {
          success: false as const,
          error: `Too many requests — try again in ${Math.max(1, retryAfter)}s.`,
        },
        429,
      );
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);
    prune(now, windowMs);
    return next();
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}
