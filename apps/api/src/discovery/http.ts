import { ProviderError } from './types';

export interface FetchJsonOptions {
  timeoutMs: number;
  provider: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Retries for transient failures (5xx/network). Defaults to 1. */
  retries?: number;
  method?: 'GET' | 'POST';
  body?: string;
}

const USER_AGENT = 'ApplyAI/0.1 (+https://github.com/Alexisontheway/applyai) job-search-assistant';
const MAX_BYTES = 4 * 1024 * 1024;

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`response larger than ${Math.round(maxBytes / 1024 / 1024)}MB`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

function linkSignals(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

/** Fetch text with a hard timeout, size cap and one retry on transient errors. */
export async function fetchText(url: string, options: FetchJsonOptions): Promise<string> {
  const { timeoutMs, provider, fetchImpl = fetch, headers = {}, retries = 1 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal, dispose } = linkSignals(options.signal, timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: options.method ?? 'GET',
        body: options.body,
        signal,
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json, text/html;q=0.9, */*;q=0.5',
          ...headers,
        },
      });
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        lastError = new ProviderError(
          `${response.status} ${response.statusText || 'request failed'}`,
          provider,
        );
        if (!retryable || attempt === retries) throw lastError;
      } else {
        return await readCapped(response, MAX_BYTES);
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    } finally {
      dispose();
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  if (lastError instanceof ProviderError) throw lastError;
  const message = lastError instanceof Error ? lastError.message : 'network error';
  throw new ProviderError(message === 'timeout' ? 'request timed out' : message, provider);
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError('provider returned malformed JSON', options.provider);
  }
}

/** Run promises with bounded concurrency, keeping failures isolated. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: Error }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: Error }> = new Array(
    items.length,
  );
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { ok: true, value: await worker(items[index], index) };
      } catch (error) {
        results[index] = {
          ok: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    }
  });
  await Promise.all(runners);
  return results;
}
