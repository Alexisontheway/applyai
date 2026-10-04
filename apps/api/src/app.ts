import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { auth } from './auth';
import { checkDatabase } from './db';
import { env } from './env';
import { toAppError } from './lib/errors';
import { logger } from './lib/logger';
import { requireAuth } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { analyticsRoutes } from './routes/analytics';
import { applicationRoutes } from './routes/applications';
import { companyRoutes } from './routes/companies';
import { coverLetterRoutes } from './routes/cover-letters';
import { discoveryRoutes } from './routes/discovery';
import { healthRoutes } from './routes/health';
import { jobRoutes } from './routes/jobs';
import { resumeRoutes } from './routes/resumes';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = new Hono();

  // ------------------------------------------------------------ middleware
  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    await next();
  });

  app.use('/api/*', async (c, next) => {
    const started = Date.now();
    await next();
    logger.info(`${c.req.method} ${c.req.path}`, {
      status: c.res.status,
      ms: Date.now() - started,
      requestId: c.get('requestId'),
    });
  });

  app.use('*', secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: env.clientUrls,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'x-request-id'],
      exposeHeaders: ['x-request-id'],
      maxAge: 86_400,
    }),
  );

  // ------------------------------------------------------------ health
  app.route('/api/health', healthRoutes);

  // ------------------------------------------------------------ auth
  app.use('/api/auth/*', rateLimit({ scope: 'auth', max: 60 }));
  // Every Better Auth route (sign-in, sign-up, session, sign-out, callbacks)
  // is handled by a single wildcard. `app.all` matters: sign-out uses POST
  // while session reads use GET, and password reset uses GET links.
  app.all('/api/auth/*', (c) => auth.handler(c.req.raw));

  // ------------------------------------------------------------ protected API
  const protectedRoutes: Array<[string, Hono]> = [
    ['/api/resumes', resumeRoutes],
    ['/api/jobs', jobRoutes],
    ['/api/applications', applicationRoutes],
    ['/api/cover-letters', coverLetterRoutes],
    ['/api/companies', companyRoutes],
    ['/api/discovery', discoveryRoutes],
    ['/api/analytics', analyticsRoutes],
  ];
  for (const [basePath, router] of protectedRoutes) {
    app.use(`${basePath}/*`, requireAuth);
    app.use(basePath, requireAuth);
    app.route(basePath, router);
  }

  // ------------------------------------------------------------ api index
  app.get('/api', (c) =>
    c.json({
      success: true,
      data: {
        name: 'ApplyAI API',
        version: '0.1.0',
        docs: 'https://github.com/Alexisontheway/applyai#api',
        endpoints: [
          'GET  /api/health/deep',
          'POST /api/jobs/track',
          'POST /api/discovery/search',
          'POST /api/applications/:id/score',
          'POST /api/cover-letters',
          'GET  /api/analytics/overview',
          'GET  /api/analytics/dashboard',
        ],
      },
    }),
  );

  // ------------------------------------------------------------ static web app
  // In production the built client is served from the same origin as the API,
  // which keeps cookies first-party and removes CORS from the deployment.
  const webDist = path.resolve(here, '../../web/dist');
  if (existsSync(webDist)) {
    const relativeRoot = path.relative(process.cwd(), webDist) || '.';
    app.use('*', serveStatic({ root: relativeRoot }));
    app.get('*', serveStatic({ path: path.join(relativeRoot, 'index.html') }));
    logger.debug('serving web client from disk', { webDist });
  }

  // ------------------------------------------------------------ fallbacks
  app.notFound((c) => {
    if (c.req.path.startsWith('/api')) {
      return c.json(
        { success: false as const, error: `No route for ${c.req.method} ${c.req.path}` },
        404,
      );
    }
    return c.json(
      {
        success: true,
        data: {
          message: 'ApplyAI API is running. The web client is served separately in development.',
          clientUrl: env.clientUrls[0],
        },
      },
      200,
    );
  });

  app.onError((error, c) => {
    const appError = toAppError(error);
    const requestId = c.get('requestId');
    if (appError.status >= 500) {
      logger.error('unhandled error', {
        message: appError.message,
        requestId,
        path: c.req.path,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
    return c.json(
      {
        success: false as const,
        error:
          appError.status >= 500 && env.isProduction ? 'Internal server error' : appError.message,
        details: appError.details,
        requestId,
      },
      appError.status,
    );
  });

  return app;
}

export const app = createApp();

/** Used by the startup banner and by tests. */
export async function describeReadiness() {
  return checkDatabase();
}

export default app;
