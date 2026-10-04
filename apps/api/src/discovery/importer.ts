/**
 * "Paste a job URL" importer.
 *
 * Most job postings (ATS pages, company career pages) embed a schema.org
 * JobPosting as JSON-LD. When that exists we get title, company, location and
 * description for free. When it does not, we fall back to Open Graph tags and
 * the densest block of text on the page — and we tell the user which fields
 * were guessed instead of pretending they are authoritative.
 */
import type { ImportedJobDraft } from '@applyai/shared/types';
import { AppError } from '../lib/errors';
import { extractSkillHits } from '../match/skills';
import { htmlToText } from '../match/text';
import { fetchText } from './http';
import { normalizeLocation } from './normalize';

const BLOCKED_HOSTS =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|0\.0\.0\.0)/i;

/** Keep the importer from being used to probe internal networks. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw AppError.badRequest('That does not look like a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw AppError.badRequest('Only http(s) URLs can be imported.');
  }
  if (
    BLOCKED_HOSTS.test(url.hostname) ||
    url.hostname.endsWith('.internal') ||
    url.hostname.endsWith('.local')
  ) {
    throw AppError.badRequest('That host is not reachable from the server.');
  }
  return url;
}

interface JsonLdJobPosting {
  '@type'?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string } | string;
  jobLocation?:
    | {
        address?: {
          addressLocality?: string;
          addressRegion?: string;
          addressCountry?: string | { name?: string };
        };
      }
    | Array<{
        address?: {
          addressLocality?: string;
          addressRegion?: string;
          addressCountry?: string | { name?: string };
        };
      }>;
  jobLocationType?: string;
  baseSalary?: {
    value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string };
    currency?: string;
  };
  skills?: string | string[];
  industry?: string;
}

function isJobPosting(value: unknown): value is JsonLdJobPosting {
  if (!value || typeof value !== 'object') return false;
  const type = (value as JsonLdJobPosting)['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some(
    (entry) => typeof entry === 'string' && entry.toLowerCase().includes('jobposting'),
  );
}

/** Walk arbitrary JSON-LD (objects, arrays, @graph) looking for JobPosting nodes. */
function findJobPosting(node: unknown, depth = 0): JsonLdJobPosting | null {
  if (depth > 6 || !node) return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findJobPosting(entry, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (isJobPosting(node)) return node;
  const record = node as Record<string, unknown>;
  for (const key of ['@graph', 'itemListElement', 'mainEntity', 'item']) {
    const found = findJobPosting(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

export function extractJsonLd(html: string): JsonLdJobPosting | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of scripts) {
    const raw = match[1].trim();
    try {
      const found = findJobPosting(JSON.parse(raw));
      if (found) return found;
    } catch {
      // Some sites emit invalid JSON-LD; ignore and keep scanning.
    }
  }
  return null;
}

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return htmlToText(match[1]).trim() || null;
  }
  return null;
}

function locationFromJsonLd(posting: JsonLdJobPosting): string | null {
  const entries = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : posting.jobLocation
      ? [posting.jobLocation]
      : [];
  const parts = entries.map((entry) => {
    const address = entry?.address;
    if (!address) return null;
    const country =
      typeof address.addressCountry === 'string'
        ? address.addressCountry
        : address.addressCountry?.name;
    return [address.addressLocality, address.addressRegion, country].filter(Boolean).join(', ');
  });
  const joined = parts.filter(Boolean).join(' • ');
  if (joined) return normalizeLocation(joined);
  if ((posting.jobLocationType ?? '').toUpperCase().includes('TELECOMMUTE')) return 'Remote';
  return null;
}

function salaryFromJsonLd(posting: JsonLdJobPosting): { min: number | null; max: number | null } {
  const value = posting.baseSalary?.value;
  if (!value) return { min: null, max: null };
  const min = typeof value.minValue === 'number' ? Math.round(value.minValue) : null;
  const max =
    typeof value.maxValue === 'number'
      ? Math.round(value.maxValue)
      : typeof value.value === 'number'
        ? Math.round(value.value)
        : null;
  return { min, max };
}

/** Pull the densest visible text block out of a page as a description fallback. */
function densestTextBlock(html: string): string | null {
  const candidates: string[] = [];
  const blocks = html.matchAll(/<(main|article|section|div)[^>]*>([\s\S]{400,20000}?)<\/\1>/gi);
  for (const block of blocks) {
    const text = htmlToText(block[2]);
    if (text.length > 400) candidates.push(text);
  }
  if (candidates.length === 0) {
    const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
    const text = body ? htmlToText(body[1]) : htmlToText(html);
    return text.length > 200 ? text.slice(0, 20_000) : null;
  }
  return candidates.sort((a, b) => b.length - a.length)[0].slice(0, 20_000);
}

export interface ImportOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function importJobFromUrl(
  rawUrl: string,
  options: ImportOptions = {},
): Promise<ImportedJobDraft> {
  const url = assertSafeUrl(rawUrl);
  let html: string;
  try {
    html = await fetchText(url.toString(), {
      provider: 'import',
      timeoutMs: options.timeoutMs ?? 15_000,
      fetchImpl: options.fetchImpl,
      retries: 0,
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
  } catch (error) {
    // Transport failures reach the user as plain English, never as "fetch failed".
    const detail =
      error instanceof Error && /^\d{3}/.test(error.message) ? ` (${error.message})` : '';
    throw AppError.badRequest(
      `Could not read that posting${detail}. The link may be private, expired or block automated requests — ` +
        'you can still add the job manually or paste the description.',
    );
  }

  const warnings: string[] = [];
  const posting = extractJsonLd(html);

  const jsonLdDescription = posting?.description ? htmlToText(posting.description) : null;
  const description =
    jsonLdDescription && jsonLdDescription.length > 200
      ? jsonLdDescription
      : densestTextBlock(html);
  if (!jsonLdDescription || jsonLdDescription.length <= 200) {
    warnings.push(
      'No structured job data on the page — description was extracted from the page text, please review it.',
    );
  }

  let title = posting?.title?.trim() || null;
  let company =
    (typeof posting?.hiringOrganization === 'string'
      ? posting.hiringOrganization
      : posting?.hiringOrganization?.name
    )?.trim() || null;
  let location = posting ? locationFromJsonLd(posting) : null;
  const { min, max } = posting ? salaryFromJsonLd(posting) : { min: null, max: null };

  if (!title) {
    title = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<h1[^>]*>([\s\S]{2,120}?)<\/h1>/i,
      /<title[^>]*>([\s\S]{2,160}?)<\/title>/i,
    ]);
    if (title) warnings.push('Job title was inferred from the page title.');
  }

  if (!company) {
    company =
      firstMatch(html, [
        /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
      ]) ?? null;
    if (company) warnings.push('Company was inferred from the site name.');
    else {
      company = url.hostname.replace(/^www\./, '').split('.')[0];
      company = company.charAt(0).toUpperCase() + company.slice(1);
      warnings.push('Company could not be detected — guessed from the domain.');
    }
  }

  if (!title) {
    throw AppError.badRequest(
      'Could not find a job title on that page. Add the job manually or paste the description.',
    );
  }

  if (!location) {
    location =
      firstMatch(html, [
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,120})["']/i,
      ])?.match(/(?:remote|hybrid|on-?site)/i)?.[0] ?? null;
    if (location) location = normalizeLocation(location);
  }

  // Normalise title noise like "Careers at Acme — Senior Engineer".
  if (title.includes('|')) {
    const parts = title.split('|').map((part) => part.trim());
    title = parts.reduce(
      (longest, part) => (part.length > longest.length ? part : longest),
      parts[0],
    );
    warnings.push('Title cleaned up from the page heading.');
  }

  const techStack = extractSkillHits(description ?? '', { maxContexts: 0 })
    .slice(0, 25)
    .map((hit) => hit.label);

  return {
    title: title.slice(0, 200),
    company: (company ?? 'Unknown').slice(0, 200),
    location,
    description,
    url: url.toString(),
    source: 'import',
    techStack,
    salaryMin: min,
    salaryMax: max,
    warnings: [...new Set(warnings)],
  };
}
