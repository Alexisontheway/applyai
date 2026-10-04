/**
 * Client for the optional Python ML service.
 *
 * Everything here degrades gracefully: if the service is down, matching falls
 * back to the local engine and PDF parsing returns a clear, actionable error
 * instead of a stack trace.
 */
import { env } from '../env';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { calibrateCosine } from '../match/similarity';

interface SemanticResponse {
  semantic_score?: number;
  model?: string;
}

export function mlConfigured(): boolean {
  return Boolean(env.ml.url);
}

async function request<T>(
  path: string,
  init: RequestInit,
  timeoutMs = env.ml.timeoutMs,
): Promise<T | null> {
  if (!env.ml.url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${env.ml.url}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      logger.warn('ml service returned an error', { path, status: response.status });
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    logger.debug('ml service unreachable', {
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Embedding similarity, calibrated the same way as the lexical score so the
 * two signals are comparable inside the blend.
 */
export async function semanticSimilarity(
  resumeText: string,
  jdText: string,
): Promise<number | null> {
  if (!mlConfigured()) return null;
  const payload = await request<SemanticResponse>('/match', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resume_text: resumeText.slice(0, 20_000),
      jd_text: jdText.slice(0, 20_000),
    }),
  });
  const raw = payload?.semantic_score;
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
  return Number(calibrateCosine(raw).toFixed(3));
}

export interface ParsedResume {
  text: string;
  pages: number | null;
  engine: string;
}

export async function parseResumeFile(file: File): Promise<ParsedResume> {
  if (!mlConfigured()) {
    throw AppError.unavailable(
      'PDF/DOCX parsing needs the ML service. Start it with `npm run dev:ml`, or create the resume by pasting text.',
    );
  }
  const form = new FormData();
  form.append('file', file, file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ml.timeoutMs * 2);
  try {
    const response = await fetch(`${env.ml.url}/parse-resume`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw AppError.upstream(
        `The ML service could not parse that file (${response.status}). ${detail.slice(0, 200)}`.trim(),
      );
    }
    const payload = (await response.json()) as { text?: string; pages?: number; engine?: string };
    if (!payload.text || payload.text.trim().length < 40) {
      throw AppError.badRequest('No readable text found in that file — it may be a scanned image.');
    }
    return {
      text: payload.text,
      pages: payload.pages ?? null,
      engine: payload.engine ?? 'ml-service',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unavailable(
      'The ML service is unreachable — start it with `npm run dev:ml` or paste the resume text.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface MlHealth {
  configured: boolean;
  ok: boolean;
  model?: string | null;
  error?: string;
  /** The service can run without embeddings (parsing only) — report that honestly. */
  embeddings: boolean;
  note?: string;
}

interface MlHealthPayload {
  status?: string;
  model?: string | null;
  embeddings_available?: boolean;
  note?: string;
}

export async function mlHealth(): Promise<MlHealth> {
  if (!mlConfigured()) return { configured: false, ok: false, embeddings: false };
  const payload = await request<MlHealthPayload>('/health', { method: 'GET' }, 4_000);
  if (!payload) return { configured: true, ok: false, embeddings: false, error: 'unreachable' };
  return {
    configured: true,
    ok: payload.status === 'ok',
    model: payload.model ?? null,
    embeddings: payload.embeddings_available === true,
    note: payload.note,
  };
}
