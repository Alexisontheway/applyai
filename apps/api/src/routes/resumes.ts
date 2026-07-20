import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createResumeSchema } from '@applyai/shared/schemas';
import { db } from '../db';
import { resumes } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { eq, and } from 'drizzle-orm';

export const resumeRoutes = new Hono();

resumeRoutes.use('*', requireAuth);

resumeRoutes.get('/', async (c) => {
  const user = c.get('user');
  const result = await db.select().from(resumes).where(eq(resumes.userId, user.id));
  return c.json({ success: true, data: result });
});

resumeRoutes.post('/', zValidator('json', createResumeSchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();

  if (body.isActive) {
    await db.update(resumes).set({ isActive: false }).where(eq(resumes.userId, user.id));
  }

  await db.insert(resumes).values({
    id,
    userId: user.id,
    label: body.label,
    isActive: body.isActive,
  });

  const created = await db.select().from(resumes).where(eq(resumes.id, id));
  return c.json({ success: true, data: created[0] }, 201);
});

resumeRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const existing = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, c.req.param('id')), eq(resumes.userId, user.id)));
  if (!existing[0]) return c.json({ success: false, error: 'Not found' }, 404);

  await db.delete(resumes).where(eq(resumes.id, c.req.param('id')));
  return c.json({ success: true });
});
