import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createApplicationSchema, updateApplicationSchema } from '@applyai/shared/schemas';
import { db } from '../db';
import { applications, jobs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';

export const applicationRoutes = new Hono();

applicationRoutes.use('*', requireAuth);

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

  await db.insert(applications).values({
    id,
    userId: user.id,
    jobId: body.jobId,
    status: body.status,
    resumeId: body.resumeId,
    matchScore: body.matchScore?.toString() ?? null,
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
  if (body.status) updateData.status = body.status;
  if (body.notes) updateData.notes = body.notes;
  if (body.followUpDate) updateData.followUpDate = body.followUpDate;
  if (body.resumeId) updateData.resumeId = body.resumeId;
  if (body.matchScore !== undefined) updateData.matchScore = body.matchScore.toString();
  updateData.updatedAt = new Date();

  await db.update(applications).set(updateData).where(eq(applications.id, c.req.param('id')));
  const updated = await db.select().from(applications).where(eq(applications.id, c.req.param('id')));
  return c.json({ success: true, data: updated[0] });
});
