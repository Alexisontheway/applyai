/**
 * Greenhouse job boards (boards-api.greenhouse.io).
 *
 * Public, documented, no key required: `GET /v1/boards/{token}/jobs`.
 * We list the board without `content` (cheap), rank by relevance, then fetch
 * the full description only for the postings we are actually going to show.
 */
import { fetchJson, mapWithConcurrency } from '../http';
import {
  detectRemote,
  joinedLocation,
  normalizeLocation,
  relevanceScore,
  stripHtml,
  toIso,
} from '../normalize';
import type { JobProvider, NormalizedJob, ProviderContext, ProviderQuery } from '../types';

const DEFAULT_BASE = 'https://boards-api.greenhouse.io/v1/boards';

interface GreenhouseListJob {
  id: number;
  title: string;
  updated_at?: string;
  absolute_url?: string;
  location?: { name?: string };
  company_name?: string;
  metadata?: Array<{ name?: string; value?: string | string[] | null }>;
}

interface GreenhouseListResponse {
  jobs?: GreenhouseListJob[];
}

interface GreenhouseDetail extends GreenhouseListJob {
  /** Greenhouse returns HTML-escaped HTML here. */
  content?: string;
}

function titleCase(token: string): string {
  return token
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Greenhouse double-escapes the description: unescape, then strip tags. */
function cleanDescription(raw: string | undefined): string | null {
  if (!raw) return null;
  const once = stripHtml(raw);
  return once ? stripHtml(once) : null;
}

export function createGreenhouseProvider(options: {
  boards: string[];
  baseUrl?: string;
}): JobProvider {
  const boards = options.boards.map((board) => board.trim()).filter(Boolean);
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;

  async function fetchBoard(
    token: string,
    query: ProviderQuery,
    ctx: ProviderContext,
  ): Promise<NormalizedJob[]> {
    const list = await fetchJson<GreenhouseListResponse>(
      `${baseUrl}/${encodeURIComponent(token)}/jobs`,
      {
        provider: 'greenhouse',
        timeoutMs: ctx.timeoutMs,
        fetchImpl: ctx.fetchImpl,
        signal: ctx.signal,
      },
    );

    const company = titleCase(token);
    const candidates = (list.jobs ?? []).filter((job) => job.title && job.absolute_url);

    const ranked = candidates
      .map((job) => {
        const location = normalizeLocation(job.location?.name ?? null);
        const partial: NormalizedJob = {
          externalId: `gh-${job.id}`,
          source: 'greenhouse',
          sourceLabel: 'Greenhouse',
          title: job.title.trim(),
          company: job.company_name?.trim() || company,
          location,
          remote: detectRemote(location, job.title),
          url: job.absolute_url as string,
          description: null,
          salary: null,
          tags: (job.metadata ?? [])
            .flatMap((entry) => (Array.isArray(entry.value) ? entry.value : [entry.value]))
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .slice(0, 8),
          postedAt: toIso(job.updated_at),
        };
        return { job: partial, score: relevanceScore(partial, query), source: job };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit);

    // Fetch full descriptions only for the postings we keep.
    const detailLimit = Math.min(ranked.length, 12);
    const details = await mapWithConcurrency(ranked.slice(0, detailLimit), 4, async (entry) => {
      const detail = await fetchJson<GreenhouseDetail>(
        `${baseUrl}/${encodeURIComponent(token)}/jobs/${entry.source.id}`,
        {
          provider: 'greenhouse',
          timeoutMs: ctx.timeoutMs,
          fetchImpl: ctx.fetchImpl,
          signal: ctx.signal,
        },
      );
      return { id: entry.job.externalId, description: cleanDescription(detail.content) };
    });

    const descriptions = new Map<string, string | null>();
    for (const result of details) {
      if (result.ok) descriptions.set(result.value.id, result.value.description);
    }

    return ranked.map((entry) => ({
      ...entry.job,
      description: descriptions.get(entry.job.externalId) ?? null,
    }));
  }

  return {
    id: 'greenhouse',
    label: 'Greenhouse boards',
    description: 'Open roles at companies that host their careers page on Greenhouse.',
    kind: 'board',
    boardCount: boards.length,
    isConfigured: () => boards.length > 0,
    async search(query, ctx) {
      if (boards.length === 0) return [];
      const perBoardLimit = Math.max(3, Math.ceil(query.limit / Math.min(boards.length, 6)));
      const scoped: ProviderQuery = { ...query, limit: perBoardLimit };
      const results = await mapWithConcurrency(boards, 6, (token) =>
        fetchBoard(token, scoped, ctx),
      );
      const jobs: NormalizedJob[] = [];
      for (const result of results) {
        if (result.ok) jobs.push(...result.value);
        else ctx.log?.('greenhouse board failed', { error: result.error.message });
      }
      return jobs;
    },
  };
}

export function greenhouseJobUrl(job: GreenhouseListJob): string | null {
  return job.absolute_url ? joinedLocation([job.location?.name]) && job.absolute_url : null;
}
