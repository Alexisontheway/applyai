import type { HealthReport } from '@applyai/shared/types';
import { Hono } from 'hono';
import { checkDatabase } from '../db';
import { env } from '../env';
import { mlHealth } from '../services/ml-client';

export const healthRoutes = new Hono();

const version = process.env.npm_package_version ?? '0.1.0';

healthRoutes.get('/', (c) =>
  c.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    },
  }),
);

/** Detail view used by the web sidebar indicator and by deploy checks. */
healthRoutes.get('/deep', async (c) => {
  const [database, ml] = await Promise.all([checkDatabase(), mlHealth()]);
  const llmConfigured = Boolean(env.ollama.url);

  const report: HealthReport = {
    status: database.ok ? 'ok' : 'degraded',
    version,
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      database: { ok: database.ok, latencyMs: database.latencyMs, error: database.error },
      ml: {
        configured: ml.configured,
        ok: ml.ok,
        error: ml.error,
        model: ml.model ?? null,
        embeddings: ml.embeddings,
        note: ml.note,
      },
      llm: {
        configured: llmConfigured,
        ok: llmConfigured,
        model: llmConfigured ? env.ollama.model : null,
        error: llmConfigured ? undefined : 'not configured',
      },
    },
    features: {
      // Semantic matching needs the embedding model, not just a reachable service.
      semanticMatching: ml.configured && ml.ok && ml.embeddings,
      resumeParsing: ml.configured && ml.ok,
      coverLetterGeneration: llmConfigured ? 'llm' : 'local-template',
    },
  };

  return c.json({ success: true, data: report }, database.ok ? 200 : 503);
});
