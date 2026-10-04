import { createApplicationSchema, updateApplicationSchema } from '@applyai/shared/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import { ok } from '../lib/errors';
import { validate } from '../lib/validate';
import {
  createApplication,
  deleteApplication,
  getApplicationDetail,
  listApplications,
  scoreApplication,
  updateApplication,
} from '../services/application-service';

export const applicationRoutes = new Hono();

const listQuerySchema = z.object({
  status: z.string().max(20).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

applicationRoutes.get('/', validate('query', listQuerySchema), async (c) => {
  const user = c.get('user');
  const query = c.req.valid('query');
  return ok(c, await listApplications(user.id, query));
});

applicationRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  return ok(c, await getApplicationDetail(user.id, c.req.param('id')));
});

applicationRoutes.post('/', validate('json', createApplicationSchema), async (c) => {
  const user = c.get('user');
  const application = await createApplication(user.id, c.req.valid('json'));
  return ok(c, application, 201);
});

applicationRoutes.patch('/:id', validate('json', updateApplicationSchema), async (c) => {
  const user = c.get('user');
  const application = await updateApplication(user.id, c.req.param('id'), c.req.valid('json'));
  return ok(c, application);
});

const scoreBodySchema = z.object({ resumeId: z.string().nullish() });

/** Re-run the matcher against the current resume (or a specific one). */
applicationRoutes.post('/:id/score', validate('json', scoreBodySchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const match = await scoreApplication(user.id, c.req.param('id'), {
    resumeId: body.resumeId ?? null,
  });
  return ok(c, match);
});

applicationRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  await deleteApplication(user.id, c.req.param('id'));
  return ok(c, { deleted: true });
});
