import { Hono } from 'hono';
import { ok } from '../lib/errors';
import { getAnalyticsOverview, getDashboardSummary } from '../services/analytics-service';

export const analyticsRoutes = new Hono();

analyticsRoutes.get('/overview', async (c) => {
  const user = c.get('user');
  return ok(c, await getAnalyticsOverview(user.id));
});

analyticsRoutes.get('/dashboard', async (c) => {
  const user = c.get('user');
  return ok(c, await getDashboardSummary(user.id));
});
