import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { auth } from './auth';
import { jobRoutes } from './routes/jobs';
import { applicationRoutes } from './routes/applications';
import { resumeRoutes } from './routes/resumes';

const app = new Hono();

// --- Global middleware ---
app.use('*', logger());
app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use('*', csrf());

// --- Health check ---
app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }),
);

// --- Auth routes (Better Auth) ---
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw));

// --- Protected API routes ---
app.route('/api/jobs', jobRoutes);
app.route('/api/applications', applicationRoutes);
app.route('/api/resumes', resumeRoutes);

// --- 404 ---
app.notFound((c) => c.json({ success: false, error: 'Route not found' }, 404));

// --- Error handler ---
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { success: false, error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message },
    500,
  );
});

export default app;
