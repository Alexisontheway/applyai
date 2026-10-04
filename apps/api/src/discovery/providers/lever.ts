/** Lever public postings API: `GET /v0/postings/{company}?mode=json`. */
import { fetchJson, mapWithConcurrency } from '../http';
import { detectRemote, joinedLocation, relevanceScore, stripHtml, toIso } from '../normalize';
import type { JobProvider, NormalizedJob, ProviderContext, ProviderQuery } from '../types';

const DEFAULT_BASE = 'https://api.lever.co/v0/postings';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
    department?: string;
    allLocations?: string[];
  };
  lists?: Array<{ text?: string; content?: string }>;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

function titleCase(token: string): string {
  return token
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildDescription(posting: LeverPosting): string | null {
  const parts: string[] = [];
  if (posting.descriptionPlain) parts.push(posting.descriptionPlain);
  else if (posting.description) parts.push(stripHtml(posting.description) ?? '');
  for (const list of posting.lists ?? []) {
    if (list.text) parts.push(list.text);
    const content = stripHtml(list.content);
    if (content) parts.push(content);
  }
  if (posting.additionalPlain) parts.push(posting.additionalPlain);
  const text = parts.filter(Boolean).join('\n\n').trim();
  return text.length > 0 ? text : null;
}

function formatSalary(posting: LeverPosting): string | null {
  const range = posting.salaryRange;
  if (!range?.min && !range?.max) return null;
  const currency = range.currency ?? 'USD';
  const interval = range.interval ? `/${range.interval}` : '';
  const min = range.min ? Math.round(range.min).toLocaleString('en-US') : '?';
  const max = range.max ? Math.round(range.max).toLocaleString('en-US') : '?';
  return `${currency} ${min} - ${max}${interval}`;
}

export function createLeverProvider(options: {
  companies: string[];
  baseUrl?: string;
}): JobProvider {
  const companies = options.companies.map((company) => company.trim()).filter(Boolean);
  const baseUrl = options.baseUrl ?? DEFAULT_BASE;

  async function fetchCompany(token: string, ctx: ProviderContext): Promise<NormalizedJob[]> {
    const postings = await fetchJson<LeverPosting[]>(
      `${baseUrl}/${encodeURIComponent(token)}?mode=json`,
      {
        provider: 'lever',
        timeoutMs: ctx.timeoutMs,
        fetchImpl: ctx.fetchImpl,
        signal: ctx.signal,
      },
    );
    if (!Array.isArray(postings)) return [];

    return postings
      .filter((posting) => posting?.text && (posting.hostedUrl || posting.applyUrl))
      .map((posting) => {
        const location = joinedLocation([
          posting.categories?.location,
          ...(posting.categories?.allLocations ?? []).slice(0, 2),
        ]);
        return {
          externalId: `lever-${posting.id}`,
          source: 'lever' as const,
          sourceLabel: 'Lever',
          title: posting.text.trim(),
          company: titleCase(token),
          location,
          remote: detectRemote(location, posting.text, posting.categories?.commitment),
          url: (posting.hostedUrl ?? posting.applyUrl) as string,
          description: buildDescription(posting),
          salary: formatSalary(posting),
          tags: [
            posting.categories?.team,
            posting.categories?.department,
            posting.categories?.commitment,
          ].filter((value): value is string => Boolean(value)),
          postedAt: toIso(posting.createdAt),
        } satisfies NormalizedJob;
      });
  }

  return {
    id: 'lever',
    label: 'Lever boards',
    description: 'Open roles at companies that use Lever for hiring.',
    kind: 'board',
    boardCount: companies.length,
    isConfigured: () => companies.length > 0,
    async search(query: ProviderQuery, ctx: ProviderContext) {
      if (companies.length === 0) return [];
      const results = await mapWithConcurrency(companies, 5, (token) => fetchCompany(token, ctx));
      const jobs: NormalizedJob[] = [];
      for (const result of results) {
        if (!result.ok) {
          ctx.log?.('lever company failed', { error: result.error.message });
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
