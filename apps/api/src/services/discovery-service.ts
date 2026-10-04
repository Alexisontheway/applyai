import type { DiscoverySearchInput } from '@applyai/shared/schemas';
import type { DiscoveredJob, DiscoverySearchResult } from '@applyai/shared/types';
/**
 * Orchestrates a discovery search:
 *   providers (parallel, failure-isolated) → dedupe → rank → mark what you
 *   already track → preview a match score against your active resume.
 */
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { jobs, resumes } from '../db/schema';
import { dedupeJobs, relevanceScore } from '../discovery/normalize';
import {
  type DiscoveryConfig,
  buildProviders,
  defaultDiscoveryConfig,
} from '../discovery/registry';
import type {
  JobProvider,
  NormalizedJob,
  ProviderContext,
  ProviderQuery,
} from '../discovery/types';
import { env } from '../env';
import { logger } from '../lib/logger';
import { quickMatchScore } from '../match/score';

interface CacheEntry {
  expiresAt: number;
  value: DiscoverySearchResult;
}

const cache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 60;

function cacheKey(query: DiscoverySearchInput): string {
  return JSON.stringify({
    k: query.keywords.trim().toLowerCase(),
    l: (query.location ?? '').trim().toLowerCase(),
    r: query.remoteOnly,
    s: [...(query.sources ?? [])].sort(),
    n: query.limit,
  });
}

function readCache(key: string): DiscoverySearchResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: DiscoverySearchResult): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { expiresAt: Date.now() + env.discovery.cacheTtlMs, value });
}

export function clearDiscoveryCache(): void {
  cache.clear();
}

export interface SearchDependencies {
  providers?: JobProvider[];
  config?: DiscoveryConfig;
  fetchImpl?: typeof fetch;
}

export async function searchJobs(
  userId: string,
  query: DiscoverySearchInput,
  dependencies: SearchDependencies = {},
): Promise<DiscoverySearchResult> {
  const started = Date.now();
  const key = cacheKey(query);
  const cached = readCache(key);
  if (cached) return { ...cached, tookMs: Date.now() - started };

  const allProviders =
    dependencies.providers ?? buildProviders(dependencies.config ?? defaultDiscoveryConfig());
  const selected = query.sources?.length
    ? allProviders.filter((provider) => query.sources?.includes(provider.id))
    : allProviders;
  const providers = selected.filter((provider) => provider.isConfigured());

  const providerQuery: ProviderQuery = {
    keywords: query.keywords,
    location: query.location ?? null,
    remoteOnly: query.remoteOnly,
    limit: Math.max(8, Math.ceil(query.limit / Math.max(1, Math.min(providers.length, 4)))),
  };

  const errors: Array<{ source: string; message: string }> = [];
  const sourcesUsed: string[] = [];

  const settled = await Promise.all(
    providers.map(async (provider) => {
      const ctx: ProviderContext = {
        timeoutMs: env.discovery.timeoutMs,
        fetchImpl: dependencies.fetchImpl,
        log: (message, context) => logger.debug(message, { provider: provider.id, ...context }),
      };
      try {
        const results = await provider.search(providerQuery, ctx);
        sourcesUsed.push(provider.id);
        return results;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        errors.push({ source: provider.id, message });
        logger.warn('discovery provider failed', { provider: provider.id, error: message });
        return [];
      }
    }),
  );

  const merged = dedupeJobs(settled.flat());
  const ranked = merged
    .map((job) => ({ job, score: relevanceScore(job, providerQuery) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit)
    .map((entry) => entry.job);

  const urls = ranked.map((job) => job.url).filter((url): url is string => Boolean(url));
  const trackedUrls = new Set<string>();
  if (urls.length > 0) {
    const existing = await db
      .select({ url: jobs.url })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), isNotNull(jobs.url), inArray(jobs.url, urls)));
    for (const row of existing) if (row.url) trackedUrls.add(row.url);
  }

  const activeResume = await getActiveResumeText(userId);

  const discovered: DiscoveredJob[] = ranked.map((job) => ({
    externalId: job.externalId,
    source: job.source,
    sourceLabel: job.sourceLabel,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    url: job.url,
    description: job.description ? job.description.slice(0, 6_000) : null,
    salary: job.salary,
    tags: job.tags,
    postedAt: job.postedAt,
    alreadyTracked: trackedUrls.has(job.url),
    matchScore:
      query.score && activeResume && job.description
        ? quickMatchScore(activeResume, job.description)
        : null,
  }));

  const result: DiscoverySearchResult = {
    jobs: discovered,
    errors,
    sourcesUsed,
    tookMs: Date.now() - started,
  };
  writeCache(key, result);
  return result;
}

export async function getActiveResumeText(userId: string): Promise<string | null> {
  const rows = await db
    .select({ parsedText: resumes.parsedText })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isActive, true)))
    .limit(1);
  return rows[0]?.parsedText ?? null;
}

export async function markTracked(userId: string, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const rows = await db
    .select({ url: jobs.url })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.url, urls)));
  return new Set(rows.map((row) => row.url).filter((url): url is string => Boolean(url)));
}
