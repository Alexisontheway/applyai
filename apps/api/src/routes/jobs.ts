import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createJobSchema } from '@applyai/shared/schemas';
import { db } from '../db';
import { jobs } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { eq } from 'drizzle-orm';

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

  await db.delete(jobs).where(eq(jobs.id, c.req.param('id')));
  return c.json({ success: true });
});
