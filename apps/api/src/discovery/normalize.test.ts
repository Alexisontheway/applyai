import { describe, expect, it } from 'vitest';
import {
  dedupeJobs,
  detectRemote,
  joinedLocation,
  matchesQuery,
  normalizeLocation,
  relevanceScore,
  stripHtml,
  toIso,
} from './normalize';
import type { NormalizedJob, ProviderQuery } from './types';

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    externalId: 'x1',
    source: 'greenhouse',
    sourceLabel: 'Greenhouse',
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Berlin, Germany',
    remote: false,
    url: 'https://example.com/jobs/x1',
    description: null,
    salary: null,
    tags: [],
    postedAt: null,
    ...overrides,
  };
}

const query: ProviderQuery = { keywords: 'frontend engineer', remoteOnly: false, limit: 30 };

describe('toIso', () => {
  it('normalises the date shapes providers actually send', () => {
    expect(toIso('2026-01-05T10:00:00Z')).toBe('2026-01-05T10:00:00.000Z');
    expect(toIso(1736071200)).toBe(new Date(1736071200 * 1000).toISOString());
    expect(toIso(1736071200000)).toBe(new Date(1736071200000).toISOString());
    expect(toIso('05 Jan 2026')).toBe(new Date('05 Jan 2026').toISOString());
  });

  it('returns null instead of an invalid date', () => {
    expect(toIso(null)).toBeNull();
    expect(toIso('')).toBeNull();
    expect(toIso('not a date')).toBeNull();
    expect(toIso({})).toBeNull();
  });
});

describe('stripHtml', () => {
  it('turns markup into readable text', () => {
    const text = stripHtml(
      '<p>Build <strong>React</strong> apps.</p><br/>Apply &amp; enjoy &nbsp;perks.',
    );
    expect(text).not.toContain('<');
    expect(text).toContain('Build React apps.');
    expect(text).toContain('&');
    expect(text).toContain('perks');
  });

  it('handles empty input', () => {
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml('')).toBeNull();
  });
});

describe('location helpers', () => {
  it('detects remote from any of the fields', () => {
    expect(detectRemote('Remote (EU)', null)).toBe(true);
    expect(detectRemote(null, 'Work from anywhere')).toBe(true);
    expect(detectRemote('Bengaluru')).toBe(false);
    expect(detectRemote(null, undefined)).toBe(false);
  });

  it('deduplicates and trims joined locations', () => {
    expect(joinedLocation(['Berlin', 'berlin', null, 'Remote'])).toBe('Berlin, Remote');
    expect(normalizeLocation('   ')).toBeNull();
    expect(joinedLocation([])).toBeNull();
  });
});

describe('relevance + filtering', () => {
  it('ranks title matches above description matches', () => {
    const titleMatch = relevanceScore(job({ title: 'Frontend Engineer' }), query);
    const descriptionMatch = relevanceScore(
      job({ title: 'Growth Marketer', description: 'supporting our frontend engineer team' }),
      query,
    );
    expect(titleMatch).toBeGreaterThan(descriptionMatch);
  });

  it('drops non-remote jobs when remoteOnly is set', () => {
    expect(matchesQuery(job({ remote: false }), { ...query, remoteOnly: true })).toBe(false);
    expect(matchesQuery(job({ remote: true }), { ...query, remoteOnly: true })).toBe(true);
  });

  it('gives remote roles a boost when the seeker asked for remote', () => {
    const remote = relevanceScore(job({ remote: true }), { ...query, remoteOnly: true });
    const onsite = relevanceScore(job({ remote: false }), { ...query, remoteOnly: true });
    expect(remote).toBeGreaterThan(onsite);
  });

  it('keeps everything when the query has no meaningful tokens', () => {
    expect(relevanceScore(job(), { keywords: 'the and', remoteOnly: false, limit: 10 })).toBe(1);
  });
});

describe('dedupeJobs', () => {
  it('collapses the same posting coming from two providers', () => {
    const jobs = [
      job({ source: 'greenhouse', url: 'https://boards.example.com/acme/jobs/1' }),
      job({ source: 'lever', url: 'https://boards.example.com/acme/jobs/1?utm_source=lever' }),
    ];
    expect(dedupeJobs(jobs)).toHaveLength(1);
  });

  it('keeps the richer record', () => {
    const jobs = [
      job({ url: 'https://x.dev/1', description: 'short' }),
      job({
        source: 'lever',
        url: 'https://x.dev/1',
        description: 'a much longer description of the role',
      }),
    ];
    const [winner] = dedupeJobs(jobs);
    expect(winner.source).toBe('lever');
  });

  it('keeps genuinely different postings', () => {
    const jobs = [job({ url: 'https://x.dev/1' }), job({ url: 'https://x.dev/2' })];
    expect(dedupeJobs(jobs)).toHaveLength(2);
  });

  it('falls back to company + title when a provider sends no url', () => {
    const jobs = [
      job({ url: '', company: 'Acme', title: 'Frontend Engineer' }),
      job({ url: '', company: ' acme ', title: 'frontend engineer', source: 'lever' }),
    ];
    expect(dedupeJobs(jobs)).toHaveLength(1);
  });
});
