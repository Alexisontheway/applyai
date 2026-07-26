import { createApplicationSchema, updateApplicationSchema } from '@applyai/shared/schemas';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { applications, jobs, resumes } from '../db/schema';
import { requireAuth } from '../middleware/auth';

export const applicationRoutes = new Hono();

applicationRoutes.use('*', requireAuth);

async function computeMatchScore(resumeText: string, jdText: string): Promise<number | null> {
  if (!resumeText || !jdText) return null;
  const mlBaseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${mlBaseUrl}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: resumeText, jd_text: jdText }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      typeof data === 'object' &&
      data !== null &&
      'match_score' in data &&
      typeof data.match_score === 'number'
    ) {
      return data.match_score;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

applicationRoutes.get('/', async (c) => {
  const user = c.get('user');
  const result = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))
    .leftJoin(jobs, eq(applications.jobId, jobs.id));
  return c.json({ success: true, data: result });
});

applicationRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const result = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, c.req.param('id')), eq(applications.userId, user.id)));
  const app = result[0];
  if (!app) return c.json({ success: false, error: 'Not found' }, 404);
  return c.json({ success: true, data: app });
});

applicationRoutes.post('/', zValidator('json', createApplicationSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();

  let matchScore = body.matchScore ?? null;

  if (matchScore === null) {
    const job = await db.select().from(jobs).where(eq(jobs.id, body.jobId));
    if (job[0]) {
      const resume = body.resumeId
        ? await db.select().from(resumes).where(eq(resumes.id, body.resumeId))
        : null;
      const resumeText = resume?.[0]?.parsedText || null;
      const jdText = job[0].description || null;
      if (resumeText && jdText) {
        matchScore = await computeMatchScore(resumeText, jdText);
      }
    }
  }

  await db.insert(applications).values({
    id,
    userId: user.id,
    jobId: body.jobId,
    status: body.status,
    resumeId: body.resumeId,
    matchScore: matchScore !== null ? matchScore.toString() : null,
    notes: body.notes,
    followUpDate: body.followUpDate,
  });

  const created = await db.select().from(applications).where(eq(applications.id, id));
  return c.json({ success: true, data: created[0] }, 201);
});

applicationRoutes.patch('/:id', zValidator('json', updateApplicationSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, c.req.param('id')), eq(applications.userId, user.id)));
  if (!existing[0]) return c.json({ success: false, error: 'Not found' }, 404);

  const updateData: Record<string, unknown> = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes ?? null;
  if (body.followUpDate !== undefined) updateData.followUpDate = body.followUpDate ?? null;
  if (body.resumeId !== undefined) updateData.resumeId = body.resumeId ?? null;
  if (body.matchScore !== undefined)
    updateData.matchScore = body.matchScore !== null ? body.matchScore.toString() : null;
  updateData.updatedAt = new Date();

  await db
    .update(applications)
    .set(updateData)
    .where(eq(applications.id, c.req.param('id')));
  const updated = await db
    .select()
    .from(applications)
    .where(eq(applications.id, c.req.param('id')));
  return c.json({ success: true, data: updated[0] });
});
