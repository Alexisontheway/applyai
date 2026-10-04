/** Ashby public job-board API: `GET /posting-api/job-board/{org}`. */
import { fetchJson, mapWithConcurrency } from '../http';
import { detectRemote, joinedLocation, relevanceScore, stripHtml, toIso } from '../normalize';
import type { JobProvider, NormalizedJob, ProviderContext, ProviderQuery } from '../types';

const DEFAULT_BASE = 'https://api.ashbyhq.com/posting-api/job-board';

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string }> | string[];
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
  jobUrl?: string;
  applyUrl?: string;
  publishedAt?: string;
  employmentType?: string;
  compensation?: {
    compensationTierSummary?: string;
    scrapeableCompensationSalarySummary?: string;
  };
}

interface AshbyResponse {
  jobs?: AshbyJob[];
}

function titleCase(token: string): string {
  return token
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function secondaryLocations(job: AshbyJob): string[] {
  const values = job.secondaryLocations ?? [];
  return values
    .map((entry) => (typeof entry === 'string' ? entry : entry?.location))
    .filter((value): value is string => Boolean(value));
}

export function createAshbyProvider(options: { boards: string[]; baseUrl?: string }): JobProvider {
  const boards = options.boards.map((board) => board.trim()).filter(Boolean);
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;

  async function fetchBoard(token: string, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const payload = await fetchJson<AshbyResponse>(
      `${baseUrl}/${encodeURIComponent(token)}?includeCompensation=true`,
      { provider: 'ashby', timeoutMs: ctx.timeoutMs, fetchImpl: ctx.fetchImpl, signal: ctx.signal },
    );
    return (payload.jobs ?? [])
      .filter((job) => job?.title && job.jobUrl && job.isListed !== false)
      .map((job) => {
        const location = joinedLocation([job.location, ...secondaryLocations(job)]);
        const description = job.descriptionPlain ?? stripHtml(job.descriptionHtml);
        return {
          externalId: `ashby-${token}-${job.id}`,
          source: 'ashby' as const,
          sourceLabel: 'Ashby',
          title: job.title.trim(),
          company: titleCase(token),
          location,
          remote: Boolean(job.isRemote) || detectRemote(location),
          url: job.jobUrl as string,
          description: description ?? null,
          salary:
            job.compensation?.compensationTierSummary ??
            job.compensation?.scrapeableCompensationSalarySummary ??
            null,
          tags: [job.department, job.team, job.employmentType].filter((value): value is string =>
            Boolean(value),
          ),
          postedAt: toIso(job.publishedAt),
        } satisfies NormalizedJob;
      });
  }

  return {
    id: 'ashby',
    label: 'Ashby boards',
    description: 'Open roles at startups that host hiring on Ashby.',
    kind: 'board',
    boardCount: boards.length,
    isConfigured: () => boards.length > 0,
    async search(query: ProviderQuery, ctx: ProviderContext) {
      if (boards.length === 0) return [];
      const results = await mapWithConcurrency(boards, 5, (token) => fetchBoard(token, ctx));
      const jobs: NormalizedJob[] = [];
      for (const result of results) {
        if (!result.ok) {
          ctx.log?.('ashby board failed', { error: result.error.message });
          continue;
        }
        jobs.push(
          ...result.value
            .map((job) => ({ job, score: relevanceScore(job, query) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.max(3, Math.ceil(query.limit / 3)))
            .map((entry) => entry.job),
        );
      }
      return jobs;
    },
  };
}
