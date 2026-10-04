import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUSES,
  JOB_SOURCES,
  createCoverLetterSchema,
  createResumeSchema,
  discoverySearchSchema,
  registerSchema,
  trackJobSchema,
  updateApplicationSchema,
} from './schemas';

describe('registerSchema', () => {
  it('accepts a normal signup and rejects weak input', () => {
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'ada@example.com', password: 'longenough' })
        .success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({ name: 'A', email: 'ada@example.com', password: 'longenough' })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'not-an-email', password: 'longenough' })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'ada@example.com', password: 'short' })
        .success,
    ).toBe(false);
  });
});

describe('trackJobSchema', () => {
  it('fills in the defaults the API relies on', () => {
    const parsed = trackJobSchema.parse({ title: 'Engineer', company: 'Acme' });
    expect(parsed.source).toBe('manual');
    expect(parsed.status).toBe('saved');
    expect(parsed.score).toBe(true);
  });

  it('rejects unknown statuses and sources', () => {
    expect(trackJobSchema.safeParse({ title: 'E', company: 'A', status: 'hired' }).success).toBe(
      false,
    );
    expect(
      trackJobSchema.safeParse({ title: 'E', company: 'A', source: 'craigslist' }).success,
    ).toBe(false);
  });

  it('accepts every status the pipeline board can hold', () => {
    for (const status of APPLICATION_STATUSES) {
      expect(trackJobSchema.safeParse({ title: 'E', company: 'A', status }).success).toBe(true);
    }
  });

  it('accepts every declared job source', () => {
    for (const source of JOB_SOURCES) {
      expect(trackJobSchema.safeParse({ title: 'E', company: 'A', source }).success).toBe(true);
    }
  });
});

describe('updateApplicationSchema', () => {
  it('allows a partial update', () => {
    expect(updateApplicationSchema.parse({ status: 'interview' })).toEqual({ status: 'interview' });
  });

  it('refuses a score outside 0..100', () => {
    expect(updateApplicationSchema.safeParse({ matchScore: 101 }).success).toBe(false);
    expect(updateApplicationSchema.safeParse({ matchScore: -1 }).success).toBe(false);
    expect(updateApplicationSchema.safeParse({ matchScore: 87.5 }).success).toBe(true);
  });
});

describe('createResumeSchema', () => {
  it('requires enough text to actually match against', () => {
    const short = createResumeSchema.safeParse({ label: 'CV', text: 'too short' });
    expect(short.success).toBe(false);

    const good = createResumeSchema.safeParse({ label: 'CV', text: 'x'.repeat(120) });
    expect(good.success).toBe(true);
  });

  it('allows a label-only resume for the upload flow', () => {
    expect(createResumeSchema.safeParse({ label: 'CV from PDF' }).success).toBe(true);
  });
});

describe('discoverySearchSchema', () => {
  it('coerces the limit that arrives as a string from query params', () => {
    const parsed = discoverySearchSchema.parse({ keywords: 'react', limit: '25' });
    expect(parsed.limit).toBe(25);
    expect(parsed.remoteOnly).toBe(false);
    expect(parsed.score).toBe(true);
  });

  it('bounds the limit and requires keywords', () => {
    expect(discoverySearchSchema.safeParse({ keywords: 'react', limit: '500' }).success).toBe(
      false,
    );
    expect(discoverySearchSchema.safeParse({ keywords: '' }).success).toBe(false);
  });
});

describe('createCoverLetterSchema', () => {
  it('defaults to a professional tone generated locally', () => {
    const parsed = createCoverLetterSchema.parse({ applicationId: 'app_1' });
    expect(parsed.tone).toBe('professional');
    expect(parsed.local).toBe(false);
  });
});
