import { discoverySearchSchema, importUrlSchema } from '@applyai/shared/schemas';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { applications, jobs } from '../db/schema';
import { importJobFromUrl } from '../discovery/importer';
import { listSources } from '../discovery/registry';
import { env } from '../env';
import { ok } from '../lib/errors';
import { toJob } from '../lib/serializers';
import { validate } from '../lib/validate';
import { rateLimit } from '../middleware/rate-limit';
import { searchJobs } from '../services/discovery-service';

export const discoveryRoutes = new Hono();

discoveryRoutes.get('/sources', (c) => ok(c, listSources()));

discoveryRoutes.post(
  '/search',
  rateLimit({ scope: 'discovery', max: 30, windowMs: 60_000 }),
  validate('json', discoverySearchSchema),
  async (c) => {
    const user = c.get('user');
    const result = await searchJobs(user.id, c.req.valid('json'));
    return ok(c, result);
  },
);

/** Paste a posting URL → structured draft the client can review before saving. */
discoveryRoutes.post(
  '/import-url',
  rateLimit({ scope: 'import', max: 30, windowMs: 60_000 }),
  validate('json', importUrlSchema),
  async (c) => {
    const body = c.req.valid('json');
    const draft = await importJobFromUrl(body.url, {
      timeoutMs: Math.max(env.discovery.timeoutMs, 15_000),
    });

    const [existing] = await db
      .select({ id: jobs.id, applicationId: applications.id })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(and(eq(jobs.url, draft.url)))
      .limit(1);

    return ok(c, {
      draft,
      alreadySaved: Boolean(existing?.id),
      alreadyTracked: Boolean(existing?.applicationId),
    });
  },
);

/** Recently discovered jobs that are saved but not yet tracked. */
discoveryRoutes.get('/inbox', async (c) => {
  const user = c.get('user');
  const rows = await db
    .select({ job: jobs })
    .from(jobs)
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(and(eq(jobs.userId, user.id), inArray(jobs.source, ['import'])))
    .orderBy(desc(jobs.createdAt))
    .limit(25);
  return ok(
    c,
    rows.map((row) => toJob(row.job)),
  );
});
