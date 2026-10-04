/** Helpers shared by every provider: dates, remote detection, relevance. */
import { htmlToText, tokenize, truncate } from '../match/text';
import type { NormalizedJob, ProviderQuery } from './types';

export function toIso(value: unknown): string | null {
  if (typeof value === 'number') {
    // Provider timestamps arrive in seconds or milliseconds.
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = htmlToText(value);
  return text.length > 0 ? text : null;
}

const REMOTE_PATTERN = /\b(remote|anywhere|distributed|work from home|wfh|fully remote)\b/i;

export function detectRemote(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => (value ? REMOTE_PATTERN.test(value) : false));
}

export function normalizeLocation(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*|\s*,$/g, '')
    .trim();
  if (!cleaned) return null;
  return truncate(cleaned, 120);
}

export function joinedLocation(parts: Array<string | null | undefined>): string | null {
  const values = parts.filter((part): part is string => Boolean(part?.trim()));
  if (values.length === 0) return null;
  // Providers routinely send the same place twice with different casing
  // ("Berlin" from the board, "berlin" from the location filter) — dedupe on a
  // normalised key so the UI never shows "Berlin, berlin".
  const seen = new Map<string, string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, value.trim());
  }
  return normalizeLocation([...seen.values()].join(', '));
}

/**
 * Relevance ranking: every keyword token found in the title counts triple,
 * in the location twice, in the description once.
 */
export function relevanceScore(job: NormalizedJob, query: ProviderQuery): number {
  const tokens = [...new Set(tokenize(query.keywords))];
  if (tokens.length === 0) return 1;
  const title = job.title.toLowerCase();
  const locationText = (job.location ?? '').toLowerCase();
  const description = (job.description ?? '').toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 3;
    if (locationText.includes(token)) score += 2;
    if (description.includes(token)) score += 1;
  }
  if (query.remoteOnly && job.remote) score += 1;
  if (query.location) {
    const wanted = query.location.toLowerCase();
    if (locationText.includes(wanted)) score += 3;
    else if (job.remote) score += 1;
  }
  return score;
}

export function matchesQuery(job: NormalizedJob, query: ProviderQuery): boolean {
  if (query.remoteOnly && !job.remote) return false;
  return relevanceScore(job, query) > 0;
}

/** Stable key so the same posting from two providers collapses into one row. */
export function dedupeKey(job: NormalizedJob): string {
  const url = job.url.split('?')[0].replace(/\/$/, '').toLowerCase();
  if (url) return url;
  return `${job.company.toLowerCase().trim()}::${job.title.toLowerCase().trim()}`;
}

export function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const key = dedupeKey(job);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, job);
      continue;
    }
    // Prefer the richer record when both providers returned the same posting.
    const richer =
      (job.description?.length ?? 0) > (existing.description?.length ?? 0) ? job : existing;
    seen.set(key, richer);
  }
  return [...seen.values()];
}
