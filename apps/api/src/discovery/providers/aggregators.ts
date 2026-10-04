/**
 * Remote-first aggregators with public, key-less JSON APIs:
 * Remotive, RemoteOK and Arbeitnow.
 */
import { fetchJson } from '../http';
import {
  detectRemote,
  joinedLocation,
  normalizeLocation,
  relevanceScore,
  stripHtml,
  toIso,
} from '../normalize';
import type { JobProvider, NormalizedJob, ProviderContext, ProviderQuery } from '../types';

// ------------------------------------------------------------------ Remotive
const REMOTIVE_BASE = 'https://remotive.com/api/remote-jobs';

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  tags?: string[];
}

export function createRemotiveProvider(options: { baseUrl?: string } = {}): JobProvider {
  const baseUrl = options.baseUrl ?? REMOTIVE_BASE;
  return {
    id: 'remotive',
    label: 'Remotive',
    description: 'Curated remote roles, filterable by keyword.',
    kind: 'aggregator',
    isConfigured: () => true,
    async search(query: ProviderQuery, ctx: ProviderContext) {
      const url = new URL(baseUrl);
      url.searchParams.set('search', query.keywords);
      url.searchParams.set('limit', String(Math.min(100, Math.max(query.limit * 3, 30))));
      const payload = await fetchJson<{ jobs?: RemotiveJob[] }>(url.toString(), {
        provider: 'remotive',
        timeoutMs: ctx.timeoutMs,
        fetchImpl: ctx.fetchImpl,
        signal: ctx.signal,
      });
      const jobs = (payload.jobs ?? [])
        .filter((job) => job?.title && job.url)
        .map(
          (job) =>
            ({
              externalId: `remotive-${job.id}`,
              source: 'remotive' as const,
              sourceLabel: 'Remotive',
              title: job.title.trim(),
              company: job.company_name?.trim() || 'Unknown',
              location: normalizeLocation(job.candidate_required_location) ?? 'Remote',
              remote: true,
              url: job.url,
              description: stripHtml(job.description),
              salary: job.salary?.trim() ? job.salary.trim() : null,
              tags: [job.category, job.job_type, ...(job.tags ?? [])]
                .filter((value): value is string => Boolean(value))
                .slice(0, 10),
              postedAt: toIso(job.publication_date),
            }) satisfies NormalizedJob,
        );

      return jobs
        .map((job) => ({ job, score: relevanceScore(job, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, query.limit)
        .map((entry) => entry.job);
    },
  };
}

// ------------------------------------------------------------------ RemoteOK
const REMOTEOK_BASE = 'https://remoteok.com/api';

interface RemoteOkJob {
  id?: string;
  slug?: string;
  company?: string;
  position?: string;
  tags?: string[];
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  apply_url?: string;
  date?: string;
  epoch?: number;
}

export function createRemoteOkProvider(options: { baseUrl?: string } = {}): JobProvider {
  const baseUrl = options.baseUrl ?? REMOTEOK_BASE;
  return {
    id: 'remoteok',
    label: 'RemoteOK',
    description: 'Large remote job board; results are keyword-filtered locally.',
    kind: 'aggregator',
    isConfigured: () => true,
    async search(query: ProviderQuery, ctx: ProviderContext) {
      const payload = await fetchJson<RemoteOkJob[]>(baseUrl, {
        provider: 'remoteok',
        timeoutMs: Math.max(ctx.timeoutMs, 12_000),
        fetchImpl: ctx.fetchImpl,
        signal: ctx.signal,
      });
      // The first element is a legal notice, not a job.
      const rows = Array.isArray(payload)
        ? payload.filter((entry) => entry?.position && entry?.company)
        : [];
      const jobs = rows.map((job) => {
        const salary =
          job.salary_min || job.salary_max
            ? `$${Math.round((job.salary_min ?? 0) / 1000)}k - $${Math.round((job.salary_max ?? 0) / 1000)}k`
            : null;
        return {
          externalId: `remoteok-${job.id ?? job.slug ?? job.position}`,
          source: 'remoteok' as const,
          sourceLabel: 'RemoteOK',
          title: (job.position as string).trim(),
          company: (job.company as string).trim(),
          location: normalizeLocation(job.location) ?? 'Remote',
          remote: true,
          url: (job.url ?? job.apply_url ?? '') as string,
          description: stripHtml(job.description),
          salary,
          tags: (job.tags ?? []).slice(0, 10),
          postedAt: toIso(job.date ?? job.epoch),
        } satisfies NormalizedJob;
      });

      return jobs
        .filter((job) => job.url)
        .map((job) => ({ job, score: relevanceScore(job, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, query.limit)
        .map((entry) => entry.job);
    },
  };
}

// ---------------------------------------------------------------- Arbeitnow
const ARBEITNOW_BASE = 'https://www.arbeitnow.com/api/job-board-api';

interface ArbeitnowJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export function createArbeitnowProvider(options: { baseUrl?: string } = {}): JobProvider {
  const baseUrl = options.baseUrl ?? ARBEITNOW_BASE;
  return {
    id: 'arbeitnow',
    label: 'Arbeitnow',
    description: 'European + remote job board with a free JSON API.',
    kind: 'aggregator',
    isConfigured: () => true,
    async search(query: ProviderQuery, ctx: ProviderContext) {
      const collected: NormalizedJob[] = [];
      // The API paginates; two pages is plenty for a search UI.
      for (const page of [1, 2]) {
        const url = new URL(baseUrl);
        url.searchParams.set('page', String(page));
        const payload = await fetchJson<{ data?: ArbeitnowJob[] }>(url.toString(), {
          provider: 'arbeitnow',
          timeoutMs: ctx.timeoutMs,
          fetchImpl: ctx.fetchImpl,
          signal: ctx.signal,
        });
        const rows = payload.data ?? [];
        if (rows.length === 0) break;
        collected.push(
          ...rows
            .filter((job) => job?.title && job.url)
            .map((job) => {
              const location = normalizeLocation(job.location);
              return {
                externalId: `arbeitnow-${job.slug}`,
                source: 'arbeitnow' as const,
                sourceLabel: 'Arbeitnow',
                title: job.title.trim(),
                company: job.company_name?.trim() || 'Unknown',
                location,
                remote: Boolean(job.remote) || detectRemote(location),
                url: job.url,
                description: stripHtml(job.description),
                salary: null,
                tags: [...(job.tags ?? []), ...(job.job_types ?? [])].slice(0, 10),
                postedAt: toIso(job.created_at),
              } satisfies NormalizedJob;
            }),
        );
        if (collected.length >= query.limit * 4) break;
      }

      return collected
        .map((job) => ({ job, score: relevanceScore(job, query) }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, query.limit)
        .map((entry) => entry.job);
    },
  };
}

/** Shared location formatting for providers that return several location fields. */
export function combineLocations(...values: Array<string | null | undefined>): string | null {
  return joinedLocation(values);
}
