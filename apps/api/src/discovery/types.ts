import type { JobSource } from '@applyai/shared/schemas';

/** One job posting, normalised across every provider. */
export interface NormalizedJob {
  externalId: string;
  source: JobSource;
  sourceLabel: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  salary: string | null;
  tags: string[];
  postedAt: string | null;
}

export interface ProviderQuery {
  keywords: string;
  location?: string | null;
  remoteOnly: boolean;
  limit: number;
}

export interface ProviderContext {
  timeoutMs: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  log?: (message: string, context?: Record<string, unknown>) => void;
}

export interface JobProvider {
  id: JobSource;
  label: string;
  description: string;
  kind: 'board' | 'aggregator';
  /** False when the provider has no configured boards / API key. */
  isConfigured(): boolean;
  /** Number of configured boards, for the UI. */
  boardCount?: number;
  search(query: ProviderQuery, ctx: ProviderContext): Promise<NormalizedJob[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
