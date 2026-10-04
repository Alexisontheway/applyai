import {
  createJobSchema,
  listJobsQuerySchema,
  trackJobSchema,
  updateJobSchema,
} from '@applyai/shared/schemas';
import type { Job } from '@applyai/shared/types';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { applications, jobs } from '../db/schema';
import { AppError, ok } from '../lib/errors';
import { toJob } from '../lib/serializers';
import { validate } from '../lib/validate';
import { extractSkillHits } from '../match/skills';
import { shortId } from '../match/text';
import { ensureCompany, trackJob } from '../services/application-service';

export const jobRoutes = new Hono();

jobRoutes.get('/', validate('query', listJobsQuerySchema), async (c) => {
  const user = c.get('user');
  const query = c.req.valid('query');

  const filters = [eq(jobs.userId, user.id)];
  if (query.q) {
    const term = `%${query.q}%`;
    const search = or(
      ilike(jobs.title, term),
      ilike(jobs.company, term),
      ilike(jobs.location, term),
    );
    if (search) filters.push(search);
  }
  if (query.source) filters.push(eq(jobs.source, query.source));
  const where = and(...filters);

  const [rows, totals] = await Promise.all([
    db
      .select({
        job: jobs,
        applicationId: applications.id,
        status: applications.status,
        matchScore: applications.matchScore,
      })
      .from(jobs)
      .leftJoin(applications, eq(applications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(query.limit)
      .offset(query.offset),
    db.select({ value: count() }).from(jobs).where(where),
  ]);

  let items: Job[] = rows.map((row) => ({
    ...toJob(row.job),
    tracked: Boolean(row.applicationId),
    applicationId: row.applicationId,
    applicationStatus: row.status,
    matchScore: row.matchScore === null ? null : Number(row.matchScore),
  }));

  if (query.tracked === 'true') items = items.filter((job) => job.tracked);
  if (query.tracked === 'false') items = items.filter((job) => !job.tracked);

  return ok(c, {
    items,
    total: Number(totals[0]?.value ?? 0),
    limit: query.limit,
    offset: query.offset,
  });
});

jobRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, c.req.param('id')), eq(jobs.userId, user.id)))
    .limit(1);
  if (!row) throw AppError.notFound('Job');
  const [application] = await db
    .select()
    .from(applications)
    .where(eq(applications.jobId, row.id))
    .limit(1);
  return ok(c, {
    ...toJob(row),
    tracked: Boolean(application),
    applicationId: application?.id ?? null,
    applicationStatus: application?.status ?? null,
  });
});

/** Create a job without tracking it yet. Idempotent per (user, url). */
jobRoutes.post('/', validate('json', createJobSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  if (body.url) {
    const [existing] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.userId, user.id), eq(jobs.url, body.url)))
      .limit(1);
    if (existing) return ok(c, toJob(existing));
  }

  const companyId = await ensureCompany(user.id, body.company, {
    techStack: body.techStack ?? null,
  });
  const techStack = body.techStack?.length
    ? body.techStack
    : body.description
      ? extractSkillHits(body.description, { maxContexts: 0 })
          .slice(0, 25)
          .map((hit) => hit.label)
      : null;

  const id = shortId('job');
  await db.insert(jobs).values({
    id,
    userId: user.id,
    companyId,
    title: body.title,
    company: body.company,
    location: body.location ?? null,
    url: body.url ?? null,
    source: body.source,
    salaryMin: body.salaryMin ?? null,
    salaryMax: body.salaryMax ?? null,
    description: body.description ?? null,
    techStack,
    postedAt: body.postedAt ? new Date(body.postedAt) : null,
  });

  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  return ok(c, toJob(row), 201);
});

/**
 * One-call "track this job": saves the job (dedup by URL), starts an
 * application, and scores it against the active resume.
 */
jobRoutes.post('/track', validate('json', trackJobSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const result = await trackJob(user.id, body);
  return ok(c, result, result.created ? 201 : 200);
});

jobRoutes.patch('/:id', validate('json', updateJobSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Job');

  const patch: Partial<typeof jobs.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) patch.title = body.title;
  if (body.company !== undefined) patch.company = body.company;
  if (body.location !== undefined) patch.location = body.location ?? null;
  if (body.url !== undefined) patch.url = body.url ?? null;
  if (body.source !== undefined) patch.source = body.source;
  if (body.salaryMin !== undefined) patch.salaryMin = body.salaryMin ?? null;
  if (body.salaryMax !== undefined) patch.salaryMax = body.salaryMax ?? null;
  if (body.description !== undefined) patch.description = body.description ?? null;
  if (body.postedAt !== undefined) patch.postedAt = body.postedAt ? new Date(body.postedAt) : null;
  if (body.techStack !== undefined) {
    patch.techStack = body.techStack ?? null;
  } else if (body.description) {
    patch.techStack = extractSkillHits(body.description, { maxContexts: 0 })
      .slice(0, 25)
      .map((hit) => hit.label);
  }

  await db.update(jobs).set(patch).where(eq(jobs.id, id));
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id));
  return ok(c, toJob(row));
});

jobRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const [existing] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, user.id)))
    .limit(1);
  if (!existing) throw AppError.notFound('Job');
  // Applications cascade with the job.
  await db.delete(jobs).where(eq(jobs.id, id));
  return ok(c, { deleted: true });
});
