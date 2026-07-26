import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createJobSchema, updateJobSchema, scrapeJobsSchema } from '@applyai/shared/schemas';
import { db } from '../db';
import { jobs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';

export const jobRoutes = new Hono();

jobRoutes.use('*', requireAuth);

jobRoutes.get('/', async (c) => {
  const user = c.get('user');
  const result = await db.select().from(jobs).where(eq(jobs.userId, user.id));
  return c.json({ success: true, data: result });
});

jobRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const result = await db.select().from(jobs).where(eq(jobs.id, c.req.param('id')));
  const job = result[0];
  if (!job || job.userId !== user.id) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }
  return c.json({ success: true, data: job });
});

jobRoutes.post('/', zValidator('json', createJobSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();

  await db.insert(jobs).values({
    id,
    userId: user.id,
    ...body,
    techStack: body.techStack ?? null,
  });

  const created = await db.select().from(jobs).where(eq(jobs.id, id));
  return c.json({ success: true, data: created[0] }, 201);
});

jobRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const result = await db.select().from(jobs).where(eq(jobs.id, c.req.param('id')));
  const job = result[0];
  if (!job || job.userId !== user.id) {
    return c.json({ success: false, error: 'Not found' }, 404);
  }

  await db.delete(jobs).where(and(eq(jobs.id, c.req.param('id')), eq(jobs.userId, user.id)));
  return c.json({ success: true });
});

jobRoutes.patch('/:id', zValidator('json', updateJobSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const jobId = c.req.param('id');

  const existing = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
  if (!existing[0]) return c.json({ success: false, error: 'Not found' }, 404);

  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.company !== undefined) updateData.company = body.company;
  if (body.location !== undefined) updateData.location = body.location ?? null;
  if (body.url !== undefined) updateData.url = body.url ?? null;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.salaryMin !== undefined) updateData.salaryMin = body.salaryMin ?? null;
  if (body.salaryMax !== undefined) updateData.salaryMax = body.salaryMax ?? null;
  if (body.description !== undefined) updateData.description = body.description ?? null;
  if (body.techStack !== undefined) updateData.techStack = body.techStack ?? null;

  await db.update(jobs).set(updateData).where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)));
  const updated = await db.select().from(jobs).where(eq(jobs.id, jobId));
  return c.json({ success: true, data: updated[0] });
});

jobRoutes.post('/scrape', zValidator('json', scrapeJobsSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${mlBaseUrl}/scrape-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: body.keywords,
        location: body.location || '',
        max_results: body.maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return c.json({ success: false, error: 'ML service scraping failed' }, 502);
    }

    const mlData = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const scrapedJobs = mlData.data || [];
    const createdJobs = [];

    for (const job of scrapedJobs) {
      const id = crypto.randomUUID();
      await db.insert(jobs).values({
        id,
        userId: user.id,
        title: job.title as string,
        company: job.company as string,
        location: (job.location as string) || body.location || null,
        url: (job.url as string) || null,
        source: (job.source as 'scrape') || 'scrape',
        description: null,
        techStack: null,
      });
      createdJobs.push({ id, ...job });
    }

    return c.json({ success: true, data: createdJobs, count: createdJobs.length }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return c.json({ success: false, error: 'Scraping timed out — try fewer keywords' }, 504);
    }
    return c.json({ success: false, error: 'Scraping service unavailable' }, 503);
  } finally {
    clearTimeout(timer);
  }
});
